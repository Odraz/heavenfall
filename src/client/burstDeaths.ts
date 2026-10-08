/**
 * Burst deaths on the client (M12 §4.2): the host's `bursts` remembered by slot until the death plays,
 * the ripple that spreads one event's bursts over 90 ms, the feather budget, the burst sprite's size
 * and the torn pieces each enemy type leaves. Pure: no DOM or three.js.
 */
import { BLESSED, CHERUB } from '../data/enemies';
import shredHeights from '../../assets/art-src/shred-blessed.json';

/** A `bursts` entry is remembered this long; slots are reused only after 1 s. */
export const BURST_MEMORY_MS = 1000;
/** One event's bursts by the same player play up to this much later, by distance from that player. */
export const RIPPLE_MS = 90;

export interface BurstInfo {
  /** The angle the body is blasted, in degrees 0–359. */
  angle: number;
  heavy: boolean;
  playerId: number;
  /** When the event arrived (ms). */
  at: number;
  /** The ripple's extra delay (ms). */
  ripple: number;
}

/** The slots of the host's `bursts` events, until their deaths play (M12 §4.2). */
export class BurstMemory {
  private readonly entries = new Map<number, BurstInfo>();

  /**
   * Remembers a `bursts` list ([slot, angle (+360 if heavy), playerId, …]); `dist(slot, playerId)` is
   * the enemy's distance from its credited player, for the ripple.
   */
  remember(list: readonly number[], now: number, dist: (slot: number, playerId: number) => number): void {
    const slots: number[] = [];
    const players: number[] = [];
    for (let i = 0; i + 2 < list.length; i += 3) {
      const [slot, a, playerId] = [list[i], list[i + 1], list[i + 2]];
      this.entries.set(slot, { angle: a >= 360 ? a - 360 : a, heavy: a >= 360, playerId, at: now, ripple: 0 });
      slots.push(slot);
      players.push(playerId);
    }
    for (const id of new Set(players)) {
      const mine = slots.filter((_, k) => players[k] === id);
      const delays = rippleDelays(mine.map((s) => dist(s, id)));
      mine.forEach((s, k) => (this.entries.get(s)!.ripple = delays[k]));
    }
  }

  /** The remembered burst of a slot, if it hasn't expired; it stays remembered. */
  peek(slot: number, now: number): BurstInfo | null {
    const e = this.entries.get(slot);
    if (!e) return null;
    if (now - e.at >= BURST_MEMORY_MS) {
      this.entries.delete(slot);
      return null;
    }
    return e;
  }

  /** The remembered burst of a slot, forgotten as it plays; null plays a normal death. */
  take(slot: number, now: number): BurstInfo | null {
    const e = this.peek(slot, now);
    this.entries.delete(slot);
    return e;
  }

  /** A slot seen as a new enemy is forgotten. */
  forget(slot: number): void {
    this.entries.delete(slot);
  }

  /** Drops the expired entries. */
  expire(now: number): void {
    for (const [slot, e] of this.entries) if (now - e.at >= BURST_MEMORY_MS) this.entries.delete(slot);
  }

  get size(): number {
    return this.entries.size;
  }
}

/** The ripple (M12 §4.2): 90 ms × (d − d_min) / (d_max − d_min) for each distance; 0 when all are equal. */
export function rippleDelays(dists: readonly number[]): number[] {
  const lo = Math.min(...dists);
  const hi = Math.max(...dists);
  return dists.map((d) => (hi - lo > 1e-9 ? (RIPPLE_MS * (d - lo)) / (hi - lo) : 0));
}

/** A burst death's tier values (M12 §4.2). */
export interface Tier {
  /** The body flies this far along the angle over the first 80 ms, lifted this much. */
  blast: number;
  lift: number;
  /** It swells to this scale. */
  swell: number;
  /** The burst sprite grows between these heights (m). */
  sprite0: number;
  sprite1: number;
  feathers: number;
  sparks: number;
  /** The torn pieces' speed factor. */
  pieceSpeed: number;
}

export const LIGHT: Tier = { blast: 0.6, lift: 0.25, swell: 1.15, sprite0: 0.9, sprite1: 1.3, feathers: 16, sparks: 6, pieceSpeed: 0.7 };
export const HEAVY: Tier = { blast: 1.0, lift: 0.45, swell: 1.3, sprite0: 1.2, sprite1: 1.9, feathers: 30, sparks: 14, pieceSpeed: 1 };

/** The body is blasted back for this long, then bursts. */
export const BLAST_MS = 80;
/** The body also moves sideways along the camera's right by this much (random sign). */
export const BLAST_SIDE = 0.25;
/** The body's glow rises between these amounts while it's blasted back. */
export const BLAST_GLOW_FROM = 0.35;
export const BLAST_GLOW_TO = 0.75;
/**
 * The burst moves this far toward the camera horizontally, and up, so it isn't behind the next row; but
 * never closer to the camera than TOWARD_CAMERA_MIN, so a point-blank burst stays in front of it.
 */
export const TOWARD_CAMERA = 0.6;
export const TOWARD_CAMERA_MIN = 1;

/** How far to move a burst `camDist` m from the camera toward it. */
export function towardCamera(camDist: number): number {
  return Math.max(0, Math.min(TOWARD_CAMERA, camDist - TOWARD_CAMERA_MIN));
}
export const BURST_RISE = 0.25;
/** The burst sprite: grows over 220 ms, opaque until 110 ms, then dithered out by 220 ms. */
export const SPRITE_MS = 220;
export const SPRITE_OPAQUE_MS = 110;
/** Its height is at most this times its horizontal distance to the camera. */
export const SPRITE_CAP = 0.38;

/** The burst sprite's height `t` ms after the burst: a cubic ease-out from h0 to h1, capped by its distance to the camera. */
export function burstSpriteHeight(h0: number, h1: number, t: number, camDist: number): number {
  const u = Math.min(1, Math.max(0, t / SPRITE_MS));
  const h = h0 + (h1 - h0) * (1 - (1 - u) ** 3);
  return Math.min(h, SPRITE_CAP * camDist);
}

/** The burst sprite's opacity `t` ms after the burst. */
export function burstSpriteAlpha(t: number): number {
  return t <= SPRITE_OPAQUE_MS ? 1 : Math.max(0, 1 - (t - SPRITE_OPAQUE_MS) / (SPRITE_MS - SPRITE_OPAQUE_MS));
}

/** The feather budget's window, and the distance beyond which a burst gets half. */
export const BUDGET_WINDOW_MS = 500;
export const BUDGET_FAR = 20;

/**
 * The feather budget (M12 §4.2): feathers and sparks × 1 with n ≤ 8 burst deaths played in the last
 * 0.5 s, × 0.5 for 9–24, × 0.25 above; × 0.5 again beyond 20 m from the camera; rounded, at least 4
 * feathers and 2 sparks.
 */
export function featherBudget(feathers: number, sparks: number, n: number, camDist: number): { feathers: number; sparks: number } {
  let m = n <= 8 ? 1 : n <= 24 ? 0.5 : 0.25;
  if (camDist > BUDGET_FAR) m *= 0.5;
  return { feathers: Math.max(4, Math.round(feathers * m)), sparks: Math.max(2, Math.round(sparks * m)) };
}

/** The times of the burst deaths played lately, for the feather budget. */
export class RecentBursts {
  private readonly times: number[] = [];

  add(now: number): void {
    this.times.push(now);
  }

  /** Burst deaths played in the last 0.5 s. */
  count(now: number): number {
    while (this.times.length && now - this.times[0] > BUDGET_WINDOW_MS) this.times.shift();
    return this.times.length;
  }
}

/** One torn piece a burst throws (M12 §4.2.1). */
export interface PieceSpec {
  /** The sprite's base name; its frames are `<sprite>-r0` … `-r3`. */
  sprite: string;
  /** Its 0° frame's drawn height (m). */
  size: number;
  /** Speed along the angle, sideways along p (sign: +1, −1, or 0 for a random one) and up, as [min, max]. */
  along: [number, number];
  side: [number, number];
  sideSign: 1 | -1 | 0;
  vz: [number, number];
  /** It turns to its next rotation this often (ms). */
  turnMs: number;
  /** It starts this far above (or below) the body center. */
  dz: number;
  /** A half lies on its side when it lands. */
  half: boolean;
}

const BLESSED_PIECES: PieceSpec[] = [
  { sprite: 'shred-blessed-upper', size: shredHeights.upper.heightM, along: [2, 4], side: [1, 2.5], sideSign: 1, vz: [3, 5], turnMs: 120, dz: 0.2, half: true },
  { sprite: 'shred-blessed-lower', size: shredHeights.lower.heightM, along: [2, 4], side: [1, 2.5], sideSign: -1, vz: [1.5, 3], turnMs: 120, dz: -0.2, half: true },
  { sprite: 'shred-blessed-sword', size: shredHeights.sword.heightM, along: [3, 6], side: [1, 2.5], sideSign: 0, vz: [3.5, 5.5], turnMs: 60, dz: 0, half: false },
];

const CHERUB_PIECES: PieceSpec[] = [
  { sprite: 'shred-wing', size: 0.55, along: [3, 6], side: [1, 2.5], sideSign: 0, vz: [2, 4.5], turnMs: 80, dz: 0, half: false },
  { sprite: 'shred-wingtip', size: 0.35, along: [3, 6], side: [1, 2.5], sideSign: 0, vz: [2, 4.5], turnMs: 80, dz: 0, half: false },
];

/** The pieces an enemy type is torn into: none for a Chorister (the burst and feathers only) or the Gatekeeper. */
export function piecesFor(type: number): readonly PieceSpec[] {
  return type === BLESSED ? BLESSED_PIECES : type === CHERUB ? CHERUB_PIECES : [];
}

/** Every sprite with 4 rotations a burst draws. */
export const ROTATED_SPRITES = ['fx-burst', ...BLESSED_PIECES.map((p) => p.sprite), ...CHERUB_PIECES.map((p) => p.sprite)];

/** A uniform random number in [a, b]. */
export function uniform([a, b]: readonly [number, number], rnd: () => number = Math.random): number {
  return a + (b - a) * rnd();
}
