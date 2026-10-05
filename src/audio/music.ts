/**
 * Music (M8 §9.2): looping tracks with 2 s crossfades, the Victory and Defeat stings, and at most
 * two looping tracks decoded at once (the playing one and the next likely one).
 */
import { MUSIC, type TrackId } from '../data/music';

const files = import.meta.glob('../../assets/music/*.mp3', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
/** Every music file's URL by its name without `.mp3`. */
const urls = new Map(Object.entries(files).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.mp3$/, ''), url]));

const CROSSFADE_S = 2;
const STING_FADE_S = 1;
const STINGS: readonly TrackId[] = ['victory', 'defeat'];

interface Playing {
  id: TrackId;
  src: AudioBufferSourceNode;
  gain: GainNode;
}

export class MusicPlayer {
  private readonly decoded = new Map<TrackId, AudioBuffer>();
  private readonly pending = new Map<TrackId, Promise<AudioBuffer | null>>();
  /** The track that should be playing, or null for silence. */
  private wanted: TrackId | null = null;
  private next: TrackId | null = null;
  private playing: Playing | null = null;
  private stingsWanted = false;

  constructor(
    private readonly ctx: AudioContext,
    private readonly out: AudioNode,
  ) {}

  /** A track is playable when it's listed in src/data/music.ts and its file exists. */
  static available(id: TrackId): boolean {
    return MUSIC.some((t) => t.id === id) && urls.has(id);
  }

  /**
   * Plays `play` (looping), crossfading from the current track (null fades to silence), and decodes
   * `next`, the track likely to play next, ahead so the switch is immediate.
   */
  set(play: TrackId | null, next: TrackId | null): void {
    if (play !== null && !MusicPlayer.available(play)) play = null;
    if (next !== null && !MusicPlayer.available(next)) next = null;
    this.next = next;
    if (next) void this.load(next);
    if (play !== this.wanted) {
      this.wanted = play;
      this.fadeOut(CROSSFADE_S);
      if (play) void this.load(play).then((buf) => buf && this.wanted === play && !this.playing && this.start(play, buf));
    }
    this.release();
  }

  /** Keeps the stings decoded while a game runs, or releases them. */
  keepStings(keep: boolean): void {
    this.stingsWanted = keep;
    if (keep) for (const s of STINGS) if (MusicPlayer.available(s)) void this.load(s);
    this.release();
  }

  /**
   * At the result: the playing track fades out over 1 s and the sting plays once; then silence.
   * Returns false if the sting isn't available (decoded), so the caller plays the synthesized one.
   */
  sting(id: 'victory' | 'defeat'): boolean {
    this.wanted = null;
    this.fadeOut(STING_FADE_S);
    const buf = this.decoded.get(id);
    if (!buf) return false;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    src.connect(this.out);
    src.start();
    return true;
  }

  private load(id: TrackId): Promise<AudioBuffer | null> {
    const have = this.decoded.get(id);
    if (have) return Promise.resolve(have);
    let p = this.pending.get(id);
    if (!p) {
      p = fetch(urls.get(id)!)
        .then((r) => r.arrayBuffer())
        .then((data) => this.ctx.decodeAudioData(data))
        .then(
          (buf) => {
            this.pending.delete(id);
            // Still wanted? A track released while decoding isn't kept.
            if (this.keeps(id)) this.decoded.set(id, buf);
            return buf;
          },
          () => {
            this.pending.delete(id);
            return null;
          },
        );
      this.pending.set(id, p);
    }
    return p;
  }

  private start(id: TrackId, buf: AudioBuffer): void {
    const def = MUSIC.find((t) => t.id === id)!;
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    if (def.loopEnd !== undefined) {
      src.loop = true;
      src.loopStart = def.loopStart ?? 0;
      src.loopEnd = def.loopEnd;
    }
    const gain = this.ctx.createGain();
    const t = this.ctx.currentTime;
    gain.gain.setValueAtTime(0, t);
    gain.gain.linearRampToValueAtTime(1, t + CROSSFADE_S);
    src.connect(gain);
    gain.connect(this.out);
    src.start();
    this.playing = { id, src, gain };
  }

  private fadeOut(seconds: number): void {
    const p = this.playing;
    if (!p) return;
    this.playing = null;
    const t = this.ctx.currentTime;
    p.gain.gain.cancelScheduledValues(t);
    p.gain.gain.setValueAtTime(p.gain.gain.value, t);
    p.gain.gain.linearRampToValueAtTime(0, t + seconds);
    p.src.stop(t + seconds + 0.05);
  }

  private keeps(id: TrackId): boolean {
    return id === this.wanted || id === this.next || id === this.playing?.id || (this.stingsWanted && STINGS.includes(id));
  }

  /** Releases decoded tracks that are neither playing nor next (nor a sting during a game). */
  private release(): void {
    for (const id of [...this.decoded.keys()]) if (!this.keeps(id)) this.decoded.delete(id);
  }
}
