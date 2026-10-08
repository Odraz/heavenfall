/**
 * Sound playback (M8 §9.1, §9.3): one AudioContext with a master gain fed by a music group and a
 * sound-effects group; every sound effect rendered once by the synthesizer; voice limits; and
 * positional sounds with distance falloff and stereo panning.
 */
import type { TrackId } from '../data/music';
import { MusicPlayer } from './music';
import { SFX, type SfxName } from './sfx';
import { renderSound } from './synth';
import { loadVolume, saveVolume, VOLUME_KEYS, type VolumeKey } from './volume';

/** At most this many sound-effect voices play at once. */
const MAX_VOICES = 24;
/** Per sound: at most this many at once, and at least this long between starts. */
const MAX_PER_SOUND = 4;
const MIN_GAP_S = 0.03;
/** Positioned sounds: full volume within 2 m, silent from 40 m. */
const NEAR = 2;
const FAR = 40;
/** Each play varies the pitch by up to ±5% (UI sounds excepted). */
const PITCH_VARIATION = 0.05;
/** Gains change over 50 ms, so dragging a slider doesn't click. */
const GAIN_RAMP_S = 0.05;
/** The limiter before the destination (M12 §4.3). */
export const LIMITER = { threshold: -12, knee: 6, ratio: 6, attack: 0.003, release: 0.15 };

interface Voice {
  name: SfxName;
  priority: number;
  started: number;
  src: AudioBufferSourceNode;
  ended: boolean;
}

/** A world position in simulation coordinates. */
export interface SoundPos {
  x: number;
  y: number;
}

/** A looping sound whose pitch the caller sets (the revive hum). */
export interface LoopHandle {
  setRate(rate: number): void;
  stop(): void;
}

export class AudioEngine {
  readonly ctx: AudioContext;
  private readonly master: GainNode;
  readonly musicBus: GainNode;
  private readonly sfxBus: GainNode;
  readonly music: MusicPlayer;
  private readonly buffers = new Map<SfxName, AudioBuffer>();
  private readonly voices: Voice[] = [];
  private readonly lastStart = new Map<SfxName, number>();
  private readonly volumes: Record<VolumeKey, number>;
  /** The listener: the local player's position and yaw. */
  private lx = 0;
  private ly = 0;
  private lyaw = 0;

  constructor() {
    this.ctx = new AudioContext();
    this.master = masterChain(this.ctx);
    this.musicBus = this.ctx.createGain();
    this.musicBus.connect(this.master);
    this.sfxBus = this.ctx.createGain();
    this.sfxBus.connect(this.master);
    this.volumes = { master: loadVolume('master'), music: loadVolume('music'), sfx: loadVolume('sfx') };
    for (const k of VOLUME_KEYS) this.bus(k).gain.value = this.volumes[k];
    this.music = new MusicPlayer(this.ctx, this.musicBus);
    void this.renderAll();
  }

  /**
   * Renders every sound effect, one per task: all at once would freeze the page for about 0.4 s on
   * the first click. A sound asked for before it's rendered doesn't play.
   */
  private async renderAll(): Promise<void> {
    const rate = this.ctx.sampleRate;
    for (const [name, def] of Object.entries(SFX) as Array<[SfxName, (typeof SFX)[SfxName]]>) {
      const samples = renderSound(def, rate);
      const buf = this.ctx.createBuffer(1, samples.length, rate);
      buf.copyToChannel(samples, 0);
      this.buffers.set(name, buf);
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  private bus(k: VolumeKey): GainNode {
    return k === 'master' ? this.master : k === 'music' ? this.musicBus : this.sfxBus;
  }

  volume(k: VolumeKey): number {
    return this.volumes[k];
  }

  /** Sets and saves a slider (0–1); it takes effect at once, ramped over 50 ms. */
  setVolume(k: VolumeKey, v: number): void {
    this.volumes[k] = v;
    saveVolume(k, v);
    const g = this.bus(k).gain;
    const t = this.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(g.value, t);
    g.linearRampToValueAtTime(v, t + GAIN_RAMP_S);
  }

  /** Resumes a context the browser suspended until a user gesture. */
  resume(): void {
    if (this.ctx.state === 'suspended') void this.ctx.resume().catch(() => {});
  }

  /** Where positioned sounds are heard from. */
  setListener(x: number, y: number, yaw: number): void {
    this.lx = x;
    this.ly = y;
    this.lyaw = yaw;
  }

  /**
   * Plays a sound effect, positioned at `pos` if given, at `gain`, `when` seconds from now. It's
   * dropped when out of range, too soon after the same sound, or when no voice of lower or equal
   * priority can be taken over. `priority` overrides the sound's own (another player's weapon). An
   * explicit `rate` (playback rate) plays without the random pitch variation, so ladders stay exact.
   */
  play(name: SfxName, pos: SoundPos | null = null, gain = 1, when = 0, priority?: number, rate?: number): void {
    const def = SFX[name];
    const buffer = this.buffers.get(name);
    if (!buffer) return;
    const prio = priority ?? def.priority;
    const now = this.ctx.currentTime;
    const start = Math.max(now, now + when);
    let pan = 0;
    if (pos) {
      const dx = pos.x - this.lx;
      const dy = pos.y - this.ly;
      const d = Math.hypot(dx, dy);
      if (d >= FAR) return;
      gain *= d <= NEAR ? 1 : 1 - (d - NEAR) / (FAR - NEAR);
      // Right of the view is yaw + 90°.
      if (d > 1e-3) pan = Math.sin(Math.atan2(dy, dx) - this.lyaw);
    }
    if (gain <= 0.001) return;
    if (start - (this.lastStart.get(name) ?? -Infinity) < MIN_GAP_S) return;
    this.prune();
    const same = this.voices.filter((v) => v.name === name);
    if (same.length >= MAX_PER_SOUND) this.steal(same[0]);
    else if (this.voices.length >= MAX_VOICES) {
      const victim = this.voices.find((v) => v.priority <= prio);
      if (!victim) return;
      this.steal(victim);
    }
    this.lastStart.set(name, start);
    const src = this.ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = playbackRate('ui' in def && def.ui === true, rate);
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    if (pan !== 0) {
      const p = this.ctx.createStereoPanner();
      p.pan.value = pan;
      g.connect(p);
      p.connect(this.sfxBus);
    } else g.connect(this.sfxBus);
    const voice: Voice = { name, priority: prio, started: start, src, ended: false };
    src.onended = () => (voice.ended = true);
    this.voices.push(voice);
    src.start(start);
  }

  /** Starts a looping sound effect; it plays outside the voice limits until stopped. */
  loop(name: SfxName, gain = 1): LoopHandle {
    const src = this.ctx.createBufferSource();
    src.buffer = this.buffers.get(name) ?? null;
    src.loop = true;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(this.sfxBus);
    src.start();
    return {
      setRate: (r) => src.playbackRate.setTargetAtTime(r, this.ctx.currentTime, 0.05),
      stop: () => {
        g.gain.setTargetAtTime(0, this.ctx.currentTime, 0.03);
        src.stop(this.ctx.currentTime + 0.2);
      },
    };
  }

  private prune(): void {
    for (let i = this.voices.length - 1; i >= 0; i--) if (this.voices[i].ended) this.voices.splice(i, 1);
  }

  /** Stops the oldest of these voices (the list is in start order) to make room. */
  private steal(v: Voice): void {
    try {
      v.src.stop();
    } catch {
      // Already stopped.
    }
    v.ended = true;
    this.voices.splice(this.voices.indexOf(v), 1);
  }
}

/** The master gain, through a limiter to the destination, so 24 voices at once don't clip (M12 §4.3). */
export function masterChain(ctx: Pick<BaseAudioContext, 'createGain' | 'createDynamicsCompressor' | 'destination'>): GainNode {
  const master = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = LIMITER.threshold;
  limiter.knee.value = LIMITER.knee;
  limiter.ratio.value = LIMITER.ratio;
  limiter.attack.value = LIMITER.attack;
  limiter.release.value = LIMITER.release;
  master.connect(limiter);
  limiter.connect(ctx.destination);
  return master;
}

/** A play's playback rate: an explicit `rate` exactly; otherwise ±5% at random, UI sounds excepted. */
export function playbackRate(ui: boolean, rate?: number, rnd: () => number = Math.random): number {
  if (rate !== undefined) return rate;
  return ui ? 1 : 1 + (rnd() * 2 - 1) * PITCH_VARIATION;
}

let engine: AudioEngine | null = null;

/** The audio engine, once created (on the first user gesture, or at load in dev and bench). */
export function audio(): AudioEngine | null {
  return engine;
}

/** The music that should play, kept until audio starts. */
let wanted: { play: TrackId | null; next: TrackId | null } = { play: null, next: null };

/** Creates the audio engine if it doesn't exist yet; a failure leaves the game silent. */
export function initAudio(): AudioEngine | null {
  if (!engine) {
    try {
      engine = new AudioEngine();
      engine.music.set(wanted.play, wanted.next);
    } catch {
      engine = null;
    }
  }
  engine?.resume();
  return engine;
}

/** Sets the looping track to play (null: silence) and the one likely to play next (M8 §9.2). */
export function setMusic(play: TrackId | null, next: TrackId | null = null): void {
  wanted = { play, next };
  engine?.music.set(play, next);
}

/** Plays a sound effect if audio is running (M8 §9.1). */
export function sfx(name: SfxName, pos: SoundPos | null = null, gain = 1, when = 0, priority?: number, rate?: number): void {
  engine?.play(name, pos, gain, when, priority, rate);
}
