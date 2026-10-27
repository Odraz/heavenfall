/**
 * Recorded sound effects (docs/rogue/audio-prompts.md): the cut takes in assets/sfx/<name>-NN.wav
 * (made by scripts/sfx_cut.py) replace the synthesized cue of the same name while the Recorded
 * SFX setting is on. Cosmetic shuffle bags play each take once, with no repeated boundary take,
 * and each take is played at the loudness of the synthesized cue, so switching compares the sound,
 * not the level. A sound without takes stays synthesized.
 */
import { SFX, type SfxName } from './sfx';

const files = import.meta.glob('../../assets/sfx/*.wav', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Takes' URLs grouped by sound name, in file order; files not named after a sound are skipped. */
export function groupTakes(paths: Record<string, string>): Map<SfxName, string[]> {
  const out = new Map<SfxName, string[]>();
  for (const path of Object.keys(paths).sort()) {
    const m = /([^/]+)-\d\d\.wav$/.exec(path);
    if (!m || !Object.hasOwn(SFX, m[1])) continue;
    const name = m[1] as SfxName;
    const list = out.get(name) ?? [];
    list.push(paths[path]);
    out.set(name, list);
  }
  return out;
}

/** Every recorded sound's take URLs. */
export const TAKES = groupTakes(files);

/** Cosmetic RNG only. Peek does not consume a take rejected by playback admission. */
export class ShuffleBag {
  private bag: number[] = [];
  private cursor = 0;
  private last = -1;
  constructor(readonly count: number, private readonly rnd: () => number = Math.random) {
    if (!Number.isInteger(count) || count < 1 || count > 256) throw new RangeError('invalid take count');
  }
  peek(): number {
    if (this.cursor >= this.bag.length) {
      this.bag = Array.from({ length: this.count }, (_, i) => i);
      for (let i = this.count - 1; i > 0; i--) {
        const j = Math.floor(this.rnd() * (i + 1));
        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];
      }
      if (this.count > 1 && this.bag[0] === this.last) {
        const j = 1 + Math.floor(this.rnd() * (this.count - 1));
        [this.bag[0], this.bag[j]] = [this.bag[j], this.bag[0]];
      }
      this.cursor = 0;
    }
    return this.bag[this.cursor];
  }
  take(): number { const i = this.peek(); this.cursor++; this.last = i; return i; }
}

/** The loudest 50 ms of a sound as RMS: how loud its hit is, whatever its tail. */
export function peakRms(samples: Float32Array, rate: number): number {
  if (!Number.isFinite(rate) || rate <= 0 || samples.length === 0) return 0;
  const win = Math.max(1, Math.round(rate * 0.05));
  const hop = Math.max(1, Math.round(win / 4));
  let best = 0;
  for (let s = 0; s < samples.length; s += hop) {
    const e = Math.min(samples.length, s + win);
    let sum = 0;
    for (let i = s; i < e; i++) {
      if (!Number.isFinite(samples[i])) return 0;
      sum += samples[i] * samples[i];
    }
    best = Math.max(best, sum / win);
    if (e === samples.length) break;
  }
  return Math.sqrt(best);
}

/** Maximum normalization boost: quiet/corrupt files cannot produce an unbounded gain. */
export const MAX_RECORDED_GAIN = 4;
interface RecordedBuffer { sampleRate: number; getChannelData(channel: number): Float32Array; }
interface TakeIO<T> {
  fetch(url: string): Promise<{ ok: boolean; arrayBuffer(): Promise<ArrayBuffer> }>;
  decode(data: ArrayBuffer): Promise<T>;
}

/** Partial families survive failures; no good takes means the caller keeps its synthesized cue. */
export async function loadRecordedTakes<T extends RecordedBuffer>(urls: readonly string[], synth: RecordedBuffer, io: TakeIO<T>): Promise<{ bufs: T[]; gains: number[] }> {
  const bufs: T[] = [], gains: number[] = [];
  const target = peakRms(synth.getChannelData(0), synth.sampleRate);
  if (!Number.isFinite(target) || target <= 0) return { bufs, gains };
  for (const url of urls) {
    try {
      const response = await io.fetch(url);
      if (!response.ok) continue;
      const buf = await io.decode(await response.arrayBuffer());
      const rms = peakRms(buf.getChannelData(0), buf.sampleRate);
      if (!Number.isFinite(rms) || rms <= 1e-6) continue;
      bufs.push(buf); gains.push(Math.min(MAX_RECORDED_GAIN, target / rms));
    } catch {
      // A failed fetch/body/decode leaves other takes available and the synth intact.
    }
  }
  return { bufs, gains };
}

/** The Recorded SFX setting's `localStorage` key; on unless it's "0". */
export const RECORDED_KEY = 'heavenfall.recordedSfx';

export function loadRecordedSetting(): boolean {
  try {
    return localStorage.getItem(RECORDED_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveRecordedSetting(on: boolean): void {
  try {
    localStorage.setItem(RECORDED_KEY, on ? '1' : '0');
  } catch {
    // Storage may be unavailable; the setting applies to this page only.
  }
}
