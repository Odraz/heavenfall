/**
 * Your kills, at once (M12 §4.4): the shooter's own screen predicts kills and bursts from its local ray
 * tests, flinches what it hits, and plays the kill marker and `killTick` on the prediction. Cosmetic
 * and local. Pure: no DOM or three.js.
 */
import { ENEMIES, GATEKEEPER } from '../data/enemies';
import { BURST_LIGHT } from '../sim/combat';

/** A predicted hit's outcome: 0 survives, 1 a kill, 2 a kill that bursts. */
export type Predicted = 0 | 1 | 2;

/**
 * A hit of `damage` on an enemy of `type` (rooted: doubled). A kill when it reaches the type's max HP
 * (never the Gatekeeper, never when `canKill` is false: the Chain Gun); a burst when `alwaysBursts`
 * (the shotgun within 6 m, the Scourge) or the damage reaches 2× the max HP.
 */
export function predictHit(type: number, damage: number, rooted: boolean, alwaysBursts = false, canKill = true): Predicted {
  if (!canKill || type === GATEKEEPER) return 0;
  const hp = ENEMIES[type].hp;
  const d = rooted ? damage * 2 : damage;
  if (d < hp - 1e-9) return 0;
  return alwaysBursts || d >= BURST_LIGHT * hp - 1e-9 ? 2 : 1;
}

/**
 * The Silver Bullet (M12 §4.4): each reached enemy with at least its full HP left in the bullet
 * (doubled if rooted) is a predicted kill, and a burst when the carried amount (doubled if rooted)
 * reaches 2× its max HP.
 */
export function predictSilverBullet(line: ReadonlyArray<{ type: number; rooted: boolean }>, carried: readonly number[]): Predicted[] {
  return carried.map((c, i) => predictHit(line[i].type, c, line[i].rooted));
}

/** Predicted kills within this long climb the `killTick` pitch ladder. */
export const LADDER_MS = 500;
/** The snapshot's own kill marker is skipped this long after a predicted one. */
export const PREDICTED_KILL_HOLD_MS = 400;

/**
 * `killTick`'s playback rate: 2^(min(k, 7) / 12), with k the predicted kills in the last 0.5 s before
 * this one, so a lone kill plays at 1 and a streak climbs a semitone each, up to 7.
 */
export function ladderRate(k: number): number {
  return 2 ** (Math.min(k, 7) / 12);
}

/** The local player's predicted kills: the ladder and when the last one was. */
export class PredictedKills {
  private readonly times: number[] = [];
  lastAt = -Infinity;

  /** A predicted kill now; returns `killTick`'s rate. */
  kill(now: number): number {
    while (this.times.length && now - this.times[0] > LADDER_MS) this.times.shift();
    const rate = ladderRate(this.times.length);
    this.times.push(now);
    this.lastAt = now;
    return rate;
  }

  /** Whether the snapshot's kill marker is skipped now. */
  holdsMarker(now: number): boolean {
    return now - this.lastAt < PREDICTED_KILL_HOLD_MS;
  }
}

/** A flinch's shape (M12 §4.4). */
export interface FlinchKind {
  push: number;
  lift: number;
  /** Width and height scales. */
  wide: number;
  tall: number;
  /** Glow color and amount. */
  r: number;
  g: number;
  b: number;
  a: number;
  /** Full for this long, then easing back over `ease` (ms). */
  hold: number;
  ease: number;
}

export const HIT_FLINCH: FlinchKind = { push: 0.15, lift: 0, wide: 1.1, tall: 0.92, r: 1, g: 1, b: 1, a: 0.4, hold: 50, ease: 120 };
export const KILL_FLINCH: FlinchKind = { push: 0.3, lift: 0.12, wide: 1.15, tall: 0.88, r: 1, g: 0.8, b: 0.4, a: 0.6, hold: 60, ease: 140 };
/** Every flinch also moves this far along the camera's right. */
export const FLINCH_RIGHT = 0.05;
export const MAX_FLINCHES = 64;

/** A flinch at one moment: the offset along the shot (m), the lift, the scales and the glow amount. */
export interface FlinchPose {
  dx: number;
  dy: number;
  /** Along the camera's right (m). */
  right: number;
  dz: number;
  wide: number;
  tall: number;
  kind: FlinchKind;
  /** The glow's amount now. */
  glow: number;
}

/** The enemies flinching from the local player's hits: at most 64, a new one replacing the oldest. */
export class Flinches {
  private readonly list: Array<{ slot: number; start: number; dx: number; dy: number; kind: FlinchKind }> = [];
  private readonly pose: FlinchPose = { dx: 0, dy: 0, right: 0, dz: 0, wide: 1, tall: 1, kind: HIT_FLINCH, glow: 0 };

  /** A hit on `slot` along the horizontal direction (dx, dy); a new hit on a flinching enemy restarts it. */
  add(slot: number, now: number, dx: number, dy: number, kind: FlinchKind): void {
    const len = Math.hypot(dx, dy);
    const ux = len > 1e-9 ? dx / len : 0;
    const uy = len > 1e-9 ? dy / len : 0;
    const i = this.list.findIndex((f) => f.slot === slot);
    if (i >= 0) this.list.splice(i, 1);
    else if (this.list.length >= MAX_FLINCHES) this.list.shift();
    this.list.push({ slot, start: now, dx: ux, dy: uy, kind });
  }

  get count(): number {
    return this.list.length;
  }

  /** Drops the flinches that ended. */
  expire(now: number): void {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (now - f.start >= f.kind.hold + f.kind.ease) this.list.splice(i, 1);
    }
  }

  /** The flinch of a slot now, or null. The returned object is reused. */
  at(slot: number, now: number): FlinchPose | null {
    for (let i = this.list.length - 1; i >= 0; i--) {
      const f = this.list[i];
      if (f.slot !== slot) continue;
      const t = now - f.start;
      const k = f.kind;
      if (t < 0 || t >= k.hold + k.ease) return null;
      // Full while held, then easing back (smoothly) to nothing.
      const u = t <= k.hold ? 1 : 1 - (t - k.hold) / k.ease;
      const e = u * u * (3 - 2 * u);
      const p = this.pose;
      p.dx = f.dx * k.push * e;
      p.dy = f.dy * k.push * e;
      p.right = FLINCH_RIGHT * e;
      p.dz = k.lift * e;
      p.wide = 1 + (k.wide - 1) * e;
      p.tall = 1 + (k.tall - 1) * e;
      p.kind = k;
      p.glow = k.a * e;
      return p;
    }
    return null;
  }
}
