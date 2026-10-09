/** Ray and swept-segment tests against vertical cylinders (§5.3, §5.4). Shared by the host and the client's cosmetic rays. */
import { ENEMIES, GATEKEEPER } from '../data/enemies';

/**
 * Distance along a ray (unit direction) to where it enters a vertical cylinder with its feet at
 * (cx, cy, cz), radius r and height h; 0 if the origin is inside, Infinity if it misses.
 */
export function rayCylinder(
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  cx: number,
  cy: number,
  cz: number,
  r: number,
  h: number,
): number {
  const hx = ox - cx;
  const hy = oy - cy;
  const top = cz + h;
  const c = hx * hx + hy * hy - r * r;
  if (c <= 0 && oz >= cz && oz <= top) return 0;
  let best = Infinity;
  const a = dx * dx + dy * dy;
  if (a > 1e-12) {
    const b = 2 * (hx * dx + hy * dy);
    const disc = b * b - 4 * a * c;
    if (disc >= 0) {
      const t = (-b - Math.sqrt(disc)) / (2 * a);
      if (t >= 0) {
        const z = oz + dz * t;
        if (z >= cz && z <= top) best = t;
      }
    }
  }
  if (Math.abs(dz) > 1e-12) {
    for (const zc of [cz, top]) {
      const t = (zc - oz) / dz;
      if (t < 0 || t >= best) continue;
      const x = hx + dx * t;
      const y = hy + dy * t;
      if (x * x + y * y <= r * r) best = t;
    }
  }
  return best;
}

/** A burst death's force thresholds, in multiples of the type's max HP (M12 §4.1). */
export const BURST_LIGHT = 2;
export const BURST_HEAVY = 4;

/** The death a force summed over one tick causes (M12 §4.1): 0 normal, 1 light burst, 2 heavy burst. */
export function burstTier(force: number, maxHp: number): 0 | 1 | 2 {
  if (force >= BURST_HEAVY * maxHp - 1e-9) return 2;
  if (force >= BURST_LIGHT * maxHp - 1e-9) return 1;
  return 0;
}

/**
 * A burst's angle in whole degrees 0–359, from (fx, fy) to the enemy at (x, y); `slot` picks a fixed
 * angle when the two coincide, as the knockback does (M12 §4.1).
 */
export function burstAngle(fx: number, fy: number, x: number, y: number, slot: number): number {
  const dx = x - fx;
  const dy = y - fy;
  const a = Math.hypot(dx, dy) < 1e-6 ? (slot % 16) * 22.5 : (Math.atan2(dy, dx) * 180) / Math.PI;
  return ((Math.round(a) % 360) + 360) % 360;
}

/** Unit aim direction from yaw and pitch (§2.3). */
export function aimDir(yaw: number, pitch: number): [number, number, number] {
  const cp = Math.cos(pitch);
  return [cp * Math.cos(yaw), cp * Math.sin(yaw), Math.sin(pitch)];
}

/** An enemy along the Silver Bullet's line, nearest first (M9 §2.4). */
export interface BulletTarget {
  s: number;
  hp: number;
  /** Rooted (pull included): the Bound step doubles its hit. */
  rooted: boolean;
  /** The Gatekeeper takes whatever is left. */
  boss: boolean;
}

/**
 * The Silver Bullet's damage carried through the line (M9 §2.4): each enemy, nearest first, takes
 * what's left, a rooted one costing half its HP; the bullet stops when nothing is left, at an enemy
 * it can't kill, or at the Gatekeeper. Returns the damage to deal to each (before the Bound step) and
 * whether it stopped at the last one. Shared by the host and the client's tracer estimate.
 */
export function silverBulletHits(
  targets: readonly BulletTarget[],
  damage: number,
): { hits: Array<{ s: number; amount: number; carried: number }>; stopped: boolean } {
  const hits: Array<{ s: number; amount: number; carried: number }> = [];
  let remaining = damage;
  for (const t of targets) {
    const m = t.rooted ? 2 : 1;
    if (!t.boss && remaining * m >= t.hp - 1e-9) {
      hits.push({ s: t.s, amount: t.hp / m, carried: remaining });
      remaining -= t.hp / m;
      if (remaining <= 1e-9) return { hits, stopped: true };
    } else {
      hits.push({ s: t.s, amount: remaining, carried: remaining });
      return { hits, stopped: true };
    }
  }
  return { hits, stopped: false };
}

/**
 * The client's estimate of the Silver Bullet (M9 §5.1): snapshots carry no enemy HP, so each enemy
 * along the line, nearest first, is taken at its type's full HP, doubled for the rooted flag. Returns
 * how many of them it reaches, whether it stops at the last, and what the bullet still carried on
 * reaching each (M12 §4.4).
 */
export function estimateSilverBullet(
  line: ReadonlyArray<{ type: number; rooted: boolean }>,
  damage: number,
): { reached: number; stopped: boolean; carried: number[] } {
  const r = silverBulletHits(
    line.map((e, i) => ({ s: i, hp: ENEMIES[e.type].hp, rooted: e.rooted, boss: e.type === GATEKEEPER })),
    damage,
  );
  return { reached: r.hits.length, stopped: r.stopped, carried: r.hits.map((h) => h.carried) };
}
