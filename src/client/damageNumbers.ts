/**
 * Damage numbers (R06 follow-up §8): the host's accepted damage credited to you, as small numbers over
 * the enemies you hit, rising and fading over 0.6 s. Only your own damage, only host facts, never a
 * guess. Hits on one enemy within 0.15 s merge into one number; a kill shows it larger.
 */
import { DAMAGE_STRIDE } from '../net/protocol';

export const DAMAGE_NUMBER_MS = 600;
export const DAMAGE_MERGE_MS = 150;
/** At most this many on screen; a new one replaces the oldest. */
export const DAMAGE_NUMBERS_MAX = 24;
/** They rise this far, in meters, over their life. */
const RISE = 0.6;

/** The setting's `localStorage` key; on unless it's "0". */
export const DAMAGE_NUMBERS_KEY = 'heavenfall.damageNumbers';

let enabled: boolean | null = null;

export function loadDamageNumbersSetting(): boolean {
  if (enabled !== null) return enabled;
  try {
    enabled = localStorage.getItem(DAMAGE_NUMBERS_KEY) !== '0';
  } catch {
    enabled = true;
  }
  return enabled;
}

export function saveDamageNumbersSetting(on: boolean): void {
  enabled = on;
  try {
    localStorage.setItem(DAMAGE_NUMBERS_KEY, on ? '1' : '0');
  } catch {
    // Storage blocked: the setting lasts for this page only.
  }
}

export interface DamageNumber {
  slot: number;
  x: number; y: number; z: number;
  amount: number;
  kill: boolean;
  /** When it appeared; a merge restarts it. */
  at: number;
}

/**
 * Adds one `damage` event's hits to the live list: a hit on an enemy whose number appeared within
 * DAMAGE_MERGE_MS adds to it and restarts it; otherwise a new number, dropping the oldest beyond the cap.
 */
export function mergeHits(live: DamageNumber[], hits: readonly number[], now: number): void {
  for (let i = 0; i + DAMAGE_STRIDE <= hits.length; i += DAMAGE_STRIDE) {
    const [slot, x, y, z, amount, kill] = hits.slice(i, i + DAMAGE_STRIDE);
    const same = live.find((n) => n.slot === slot && now - n.at <= DAMAGE_MERGE_MS && !n.kill);
    if (same) {
      same.amount += amount; same.kill = kill === 1; same.x = x; same.y = y; same.z = z; same.at = now;
      continue;
    }
    if (live.length >= DAMAGE_NUMBERS_MAX) live.splice(live.indexOf(live.reduce((a, b) => (b.at < a.at ? b : a))), 1);
    live.push({ slot, x, y, z, amount, kill: kill === 1, at: now });
  }
}

/** A fixed screen offset per enemy slot, in pixels, so numbers over a packed crowd don't print over each other. */
export function spread(slot: number): [number, number] {
  return [((slot * 53) % 9 - 4) * 11, ((slot * 29) % 5 - 2) * 7];
}

/** The text of an amount: whole numbers, at least 1. */
export const damageText = (amount: number): string => String(Math.max(1, Math.round(amount)));

/** The pooled labels over the game view. */
export class DamageNumbers {
  readonly live: DamageNumber[] = [];
  private readonly labels: HTMLDivElement[] = [];

  constructor(parent: HTMLElement) {
    const layer = document.createElement('div');
    layer.className = 'damage-numbers';
    parent.appendChild(layer);
    for (let i = 0; i < DAMAGE_NUMBERS_MAX; i++) {
      const label = document.createElement('div');
      label.className = 'damage-number';
      label.hidden = true;
      layer.appendChild(label);
      this.labels.push(label);
    }
  }

  add(hits: readonly number[], now: number): void {
    mergeHits(this.live, hits, now);
  }

  /** Places each live number, `project` giving its screen point or null when behind the camera. */
  update(now: number, project: (x: number, y: number, z: number) => [number, number] | null): void {
    for (let i = this.live.length - 1; i >= 0; i--) if (now - this.live[i].at >= DAMAGE_NUMBER_MS) this.live.splice(i, 1);
    this.labels.forEach((label, i) => {
      const n = this.live[i];
      const t = n ? (now - n.at) / DAMAGE_NUMBER_MS : 1;
      const at = n ? project(n.x, n.y, n.z + RISE * t) : null;
      if (!n || !at) { label.hidden = true; return; }
      label.hidden = false;
      label.textContent = damageText(n.amount);
      label.classList.toggle('kill', n.kill);
      const [ox, oy] = spread(n.slot);
      label.style.transform = `translate(${at[0] + ox}px, ${at[1] + oy}px) translate(-50%, -50%)`;
      // Full for the first half, then fading out.
      label.style.opacity = String(Math.min(1, 2 * (1 - t)));
    });
  }

  clear(): void {
    this.live.length = 0;
    for (const label of this.labels) label.hidden = true;
  }
}
