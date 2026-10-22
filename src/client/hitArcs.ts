/**
 * Felt hits (R06 follow-up §9 option 1): a red arc on a ring around the crosshair pointing at where a
 * hit came from, kept pointing there as you turn, with a short view flinch. Ranged hits stay longer, so
 * a shot from behind is noticed. World damage without a direction only flinches and reddens the edge.
 */
import { HURT_RANGED, HURT_STRIDE, HURT_WORLD } from '../net/protocol';

export const ARC_MS = 900;
export const RANGED_ARC_MS = 1400;
/** At most this many arcs at once; a new hit replaces the oldest. */
export const ARCS_MAX = 6;

/**
 * The ring angle of a source in radians from its position in camera space (x right, −z ahead): 0 straight
 * ahead (the top of the ring), π/2 to the right, ±π behind. Height is ignored.
 */
export function arcAngle(viewX: number, viewZ: number): number {
  return Math.atan2(viewX, -viewZ);
}

/** The flinch for a hit removing `amount` of `maxHp`: 0.4° up to 1.2°, over 160 ms. */
export function hurtShake(amount: number, maxHp: number): { amp: number; decay: number; dip: number } {
  const share = maxHp > 0 ? Math.min(1, amount / maxHp / 0.15) : 1;
  return { amp: 0.4 + 0.8 * share, decay: 160, dip: 0.3 * share };
}

export interface Arc { x: number; y: number; at: number; ms: number; strength: number }

/** Adds one `hurt` event's hits to `arcs` (dropping the oldest past the cap); returns the largest amount. */
export function addHurt(arcs: Arc[], hits: readonly number[], now: number, maxHp: number): number {
  let largest = 0;
  for (let i = 0; i + HURT_STRIDE <= hits.length; i += HURT_STRIDE) {
    const [x, y, amount, kind] = hits.slice(i, i + HURT_STRIDE);
    largest = Math.max(largest, amount);
    if (kind === HURT_WORLD) continue;
    if (arcs.length >= ARCS_MAX) arcs.shift();
    arcs.push({ x, y, at: now, ms: kind === HURT_RANGED ? RANGED_ARC_MS : ARC_MS, strength: Math.min(1, 0.45 + amount / Math.max(1, maxHp) * 4) });
  }
  return largest;
}

/** Drops the arcs whose time is up. */
export function pruneArcs(arcs: Arc[], now: number): void {
  for (let i = arcs.length - 1; i >= 0; i--) if (now - arcs[i].at >= arcs[i].ms) arcs.splice(i, 1);
}

export class HitArcs {
  readonly arcs: Arc[] = [];
  private readonly els: HTMLDivElement[] = [];

  constructor(parent: HTMLElement) {
    const layer = document.createElement('div');
    layer.className = 'hit-arcs';
    parent.appendChild(layer);
    for (let i = 0; i < ARCS_MAX; i++) {
      const arc = document.createElement('div');
      arc.className = 'hit-arc';
      arc.hidden = true;
      layer.appendChild(arc);
      this.els.push(arc);
    }
  }

  /** One `hurt` event's hits; returns the largest amount, for the flinch. */
  add(hits: readonly number[], now: number, maxHp: number): number {
    return addHurt(this.arcs, hits, now, maxHp);
  }

  /** Points each live arc at its source; `angle` gives a world point's ring angle from the current view. */
  update(now: number, angle: (x: number, y: number) => number): void {
    pruneArcs(this.arcs, now);
    this.els.forEach((el, i) => {
      const a = this.arcs[i];
      if (!a) { el.hidden = true; return; }
      el.hidden = false;
      el.style.transform = `translate(-50%, -50%) rotate(${angle(a.x, a.y)}rad)`;
      el.style.opacity = String(a.strength * Math.min(1, 1.6 * (1 - (now - a.at) / a.ms)));
    });
  }

  clear(): void {
    this.arcs.length = 0;
    for (const el of this.els) el.hidden = true;
  }
}
