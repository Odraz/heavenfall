/** The three volume sliders (M8 §9.3), saved in localStorage. */

export type VolumeKey = 'master' | 'music' | 'sfx';

export const VOLUME_KEYS: readonly VolumeKey[] = ['master', 'music', 'sfx'];
export const VOLUME_LABELS: Record<VolumeKey, string> = { master: 'Master', music: 'Music', sfx: 'SFX' };
export const VOLUME_DEFAULTS: Record<VolumeKey, number> = { master: 0.5, music: 0.5, sfx: 0.7 };

const storageKey = (k: VolumeKey) => `heavenfall.volume.${k}`;

/** A slider's saved value (0–1), or its default. */
export function loadVolume(k: VolumeKey): number {
  try {
    const raw = localStorage.getItem(storageKey(k));
    const v = raw === null ? NaN : Number(raw);
    return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : VOLUME_DEFAULTS[k];
  } catch {
    return VOLUME_DEFAULTS[k];
  }
}

export function saveVolume(k: VolumeKey, v: number): void {
  try {
    localStorage.setItem(storageKey(k), String(v));
  } catch {
    // Storage may be unavailable; the value applies to this page only.
  }
}

/** A slider's value label: `70%`, or `Off` at 0. */
export function volumeText(v: number): string {
  const pct = Math.round(v * 100);
  return pct === 0 ? 'Off' : `${pct}%`;
}
