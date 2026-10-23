/**
 * Dodge compensation (netcode stage 2, 2026-10-22): a player dodges the enemy globes and arrows their
 * screen draws, which are a round trip plus the render delay behind the host. The host therefore tests
 * each player against the stretch of an enemy projectile's flight that player's screen drew this tick,
 * not where the projectile is now. A projectile that ends (a wall, its range) stays as a late shot for
 * the players whose screens haven't drawn its end yet: it can still hit them, or catch them in a
 * globe's shatter, when their screen gets there. Pure: no DOM or three.js.
 */
import { rayCylinder } from './combat';

/** A spent enemy projectile still owed to the players whose screens draw it behind its end. */
export interface LateShot {
  kind: number;
  damage: number;
  radius: number;
  /** Distance flown per tick. */
  step: number;
  /** Where it ended, and its unit flight direction. */
  x: number;
  y: number;
  z: number;
  dx: number;
  dy: number;
  dz: number;
  /** Distance flown from its spawn to its end. */
  flown: number;
  /** How far past its end it would be now, had it flown on. */
  over: number;
  /** A globe that shattered at its end: the players still owed it get the shatter when they reach it. */
  blast: boolean;
  /** The players whose screens haven't drawn its end yet. */
  owed: number[];
  /** Its Orb Volley (0 or absent: none): one hit per player per volley. */
  volley?: number;
}

/**
 * The stretch of one tick's flight a player's screen drew, as distances along the flight from a
 * reference point: the screen is `back` behind, the flight can't start before its spawn (`flown` behind
 * the reference) and stops at `stop`. `from`..`to` is the present flight this tick. Null if the screen
 * hasn't drawn any of it yet.
 */
export function lateStretch(back: number, flown: number, from: number, to: number, stop: number): [number, number] | null {
  const s0 = Math.max(from - back, -flown);
  const s1 = Math.min(to - back, stop);
  return s1 < s0 ? null : [s0, s1];
}

/**
 * Where along the flight from (x, y, z) in the unit direction (dx, dy, dz) the stretch s0..s1 first
 * meets the cylinder with its feet at (cx, cy, cz), radius r and height h; Infinity if it doesn't.
 */
export function stretchHit(
  x: number, y: number, z: number, dx: number, dy: number, dz: number, s0: number, s1: number,
  cx: number, cy: number, cz: number, r: number, h: number,
): number {
  const t = rayCylinder(x + dx * s0, y + dy * s0, z + dz * s0, dx, dy, dz, cx, cy, cz, r, h);
  return t <= s1 - s0 ? s0 + t : Infinity;
}
