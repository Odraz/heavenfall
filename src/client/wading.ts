/**
 * Wading (M12 §3.1): each ground enemy pressing against the local player slows them. Client only:
 * movement is the client's, and the host's speed check only caps from above. Pure, for tests.
 */
import { BLESSED, CHORISTER, ENEMIES } from '../data/enemies';
import { PLAYER_RADIUS } from '../sim/constants';
import type { GameMap } from '../sim/map';
import { groundHeight } from '../sim/movement';

/** An enemy presses against the player within its radius + the player's + this, horizontally (1.2 m for a Blessed: its melee range). */
export const WADE_REACH = 0.45;
/** ...and with its feet within this of the player's feet. */
export const WADE_HEIGHT = 1.5;
/** Each pressing enemy takes this much off the speed factor... */
export const WADE_PER_ENEMY = 0.15;
/** ...down to this. */
export const WADE_MIN = 0.55;
/** The applied factor eases toward its target with this time constant, in seconds. */
export const WADE_EASE = 0.1;
/** An enemy launched by a Falling Star landing doesn't press for this long after the event arrives. */
export const WADE_LAUNCH_MS = 400;

/** The newest snapshot's enemies, as `Snapshot` carries them. */
export interface WadeEnemies {
  enemyCount: number;
  enemySlot: ArrayLike<number>;
  enemyX: ArrayLike<number>;
  enemyY: ArrayLike<number>;
  enemyType: ArrayLike<number>;
}

/**
 * The living ground enemies (Blessed and Choristers) pressing against a player whose feet are at
 * (x, y, z): centers within the player's radius + the enemy's + 0.45 m horizontally and feet within
 * 1.5 m vertically. An enemy's feet are the ground under it (snapshots carry no height), computed only
 * for enemies within reach. `launchedUntil[slot]` (ms): launched enemies don't count until then.
 */
export function wadeCount(map: GameMap, x: number, y: number, z: number, e: WadeEnemies, launchedUntil: ArrayLike<number>, now: number): number {
  let n = 0;
  for (let i = 0; i < e.enemyCount; i++) {
    const type = e.enemyType[i];
    if (type !== BLESSED && type !== CHORISTER) continue;
    const r = ENEMIES[type].radius;
    const reach = PLAYER_RADIUS + r + WADE_REACH;
    const dx = e.enemyX[i] - x;
    const dy = e.enemyY[i] - y;
    if (dx * dx + dy * dy > reach * reach) continue;
    if (now < launchedUntil[e.enemySlot[i]]) continue;
    const g = groundHeight(map, e.enemyX[i], e.enemyY[i], r, Infinity, false, true);
    if (g === -Infinity || Math.abs(g - z) > WADE_HEIGHT) continue;
    n++;
  }
  return n;
}

/** The speed factor for `count` pressing enemies: 1 with none, 0.7 with two, 0.55 at three or more. */
export function wadeTarget(count: number): number {
  return Math.max(WADE_MIN, 1 - WADE_PER_ENEMY * count);
}

/** The applied speed factor, easing toward its target. */
export class Wading {
  factor = 1;

  /** Eases toward the target for `count` pressing enemies over `dt` seconds; returns the factor. */
  update(count: number, dt: number): number {
    this.factor += (wadeTarget(count) - this.factor) * Math.min(1, dt / WADE_EASE);
    return this.factor;
  }
}
