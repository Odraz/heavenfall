/**
 * Recorded sound effects (docs/rogue/audio-prompts.md): the cut takes in assets/sfx/<name>-NN.wav
 * (made by scripts/sfx_cut.py) replace the synthesized cue of the same name while the Recorded
 * SFX setting is on. Each play picks one of a sound's takes, never the same one twice in a row,
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
    if (!m || !(m[1] in SFX)) continue;
    const name = m[1] as SfxName;
    const list = out.get(name) ?? [];
    list.push(paths[path]);
    out.set(name, list);
  }
  return out;
}

/** Every recorded sound's take URLs. */
export const TAKES = groupTakes(files);

/** The take to play out of `count`: random, but not `last` again when there is a choice. */
export function nextTake(count: number, last: number, rnd: () => number = Math.random): number {
  if (count <= 1) return 0;
  const i = Math.floor(rnd() * (count - 1));
  return last >= 0 && i >= last ? i + 1 : i;
}

/** The loudest 50 ms of a sound as RMS: how loud its hit is, whatever its tail. */
export function peakRms(samples: Float32Array, rate: number): number {
  const win = Math.max(1, Math.round(rate * 0.05));
  const hop = Math.max(1, Math.round(win / 4));
  let best = 0;
  for (let s = 0; s < samples.length; s += hop) {
    const e = Math.min(samples.length, s + win);
    let sum = 0;
    for (let i = s; i < e; i++) sum += samples[i] * samples[i];
    best = Math.max(best, sum / win);
    if (e === samples.length) break;
  }
  return Math.sqrt(best);
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
