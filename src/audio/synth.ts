/**
 * A small retro synthesizer (M8 §9.1): renders a sound's parameter set once into samples, the same
 * samples every time for the same parameters. Pure TS, no Web Audio, so it's unit-testable.
 */

export type Wave = 'square' | 'saw' | 'triangle' | 'sine' | 'noise';

/** One layer of a sound. Times are seconds, frequencies Hz, levels 0–1. */
export interface SynthPart {
  wave: Wave;
  /** Start frequency; for noise, the rate at which a new random value is drawn. */
  freq: number;
  /** Pitch slide: the frequency moves exponentially to this over `slide` seconds (default: the whole part). */
  freqEnd?: number;
  slide?: number;
  /** Square wave duty cycle (default 0.5). */
  duty?: number;
  /** Vibrato: rate in Hz and depth in semitones. */
  vibratoRate?: number;
  vibratoDepth?: number;
  /** Envelope: attack to 1, decay to `sustain`, hold for `hold`, release to 0. */
  attack: number;
  decay: number;
  sustain: number;
  hold: number;
  release: number;
  volume: number;
  /** Low-pass filter cutoff, sweeping exponentially to `lowpassEnd` over the part (default: none). */
  lowpass?: number;
  lowpassEnd?: number;
  /** Bit crushing: quantize to this many bits (default: none). */
  bits?: number;
  /** Seconds before this part starts. */
  delay?: number;
}

/** A sound: up to 3 parts mixed together. */
export interface SoundDef {
  parts: SynthPart[];
}

export const MAX_PARTS = 3;

/** A part's length in seconds, from the sound's start. */
function partLength(p: SynthPart): number {
  return (p.delay ?? 0) + p.attack + p.decay + p.hold + p.release;
}

/** The sound's length in seconds. */
export function soundLength(def: SoundDef): number {
  return Math.max(0, ...def.parts.map(partLength));
}

/** mulberry32: noise is seeded, so a sound renders the same every time. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function envelope(p: SynthPart, t: number): number {
  if (t < 0) return 0;
  if (t < p.attack) return t / p.attack;
  t -= p.attack;
  if (t < p.decay) return 1 - (1 - p.sustain) * (t / p.decay);
  t -= p.decay;
  if (t < p.hold) return p.sustain;
  t -= p.hold;
  if (t < p.release) return p.sustain * (1 - t / p.release);
  return 0;
}

/** Renders one part, adding it into `out`. */
function renderPart(p: SynthPart, out: Float32Array, rate: number, seed: number): void {
  const random = prng(seed);
  const start = Math.round((p.delay ?? 0) * rate);
  const len = Math.round((p.attack + p.decay + p.hold + p.release) * rate);
  const slide = p.slide ?? p.attack + p.decay + p.hold + p.release;
  const duty = p.duty ?? 0.5;
  let phase = 0;
  let noise = random() * 2 - 1;
  // A 2-pole low-pass (RBJ biquad, Q = 0.707), its coefficients updated every 32 samples.
  let b0 = 1;
  let b1 = 0;
  let b2 = 0;
  let a1 = 0;
  let a2 = 0;
  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;
  const levels = p.bits ? 2 ** (p.bits - 1) : 0;
  for (let i = 0; i < len && start + i < out.length; i++) {
    const t = i / rate;
    // Pitch: exponential slide, then vibrato in semitones.
    let f = p.freq;
    if (p.freqEnd !== undefined && slide > 0) f = p.freq * (p.freqEnd / p.freq) ** Math.min(1, t / slide);
    if (p.vibratoRate && p.vibratoDepth) f *= 2 ** ((p.vibratoDepth * Math.sin(2 * Math.PI * p.vibratoRate * t)) / 12);
    const prev = phase;
    phase = (phase + f / rate) % 1;
    let v: number;
    switch (p.wave) {
      case 'square':
        v = phase < duty ? 1 : -1;
        break;
      case 'saw':
        v = 2 * phase - 1;
        break;
      case 'triangle':
        v = phase < 0.5 ? 4 * phase - 1 : 3 - 4 * phase;
        break;
      case 'sine':
        v = Math.sin(2 * Math.PI * phase);
        break;
      case 'noise':
        // A new random value each cycle: lower `freq` gives a darker, grainier noise.
        if (phase < prev) noise = random() * 2 - 1;
        v = noise;
        break;
    }
    if (p.lowpass !== undefined) {
      if ((i & 31) === 0) {
        const end = p.lowpassEnd ?? p.lowpass;
        const fc = Math.min(rate * 0.45, p.lowpass * (end / p.lowpass) ** Math.min(1, i / Math.max(1, len)));
        const w = (2 * Math.PI * fc) / rate;
        const alpha = Math.sin(w) / (2 * Math.SQRT1_2);
        const cos = Math.cos(w);
        const a0 = 1 + alpha;
        b0 = (1 - cos) / 2 / a0;
        b1 = (1 - cos) / a0;
        b2 = b0;
        a1 = (-2 * cos) / a0;
        a2 = (1 - alpha) / a0;
      }
      const y = b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1;
      x1 = v;
      y2 = y1;
      y1 = y;
      v = y;
    }
    if (levels) v = Math.round(v * levels) / levels;
    out[start + i] += v * envelope(p, t) * p.volume;
  }
}

/**
 * Renders a sound at `rate` samples per second: its parts mixed, clamped to ±1. The same
 * definition always gives the same samples.
 */
export function renderSound(def: SoundDef, rate: number): Float32Array<ArrayBuffer> {
  const out = new Float32Array(Math.max(1, Math.round(soundLength(def) * rate)));
  def.parts.slice(0, MAX_PARTS).forEach((p, i) => renderPart(p, out, rate, 0x9e3779b9 + i * 7919));
  for (let i = 0; i < out.length; i++) out[i] = Math.max(-1, Math.min(1, out[i]));
  return out;
}
