/**
 * Ally targeting (M8 §3.5, replacing the 10° rule of MVP §5.3): acquire at 15°, keep at 25°, and
 * switch only to a clearly better candidate. Range and line of sight are as in the MVP.
 */
import { lineOfSight } from '../sim/los';
import type { GameMap } from '../sim/map';
import { distToCylinder } from '../sim/movement';
import { PLAYER_HEIGHT, PLAYER_RADIUS } from '../sim/constants';
import { ALLY_NONE } from '../net/protocol';

const DEG = Math.PI / 180;
/** A new ally target is acquired up to this angle from the aim. */
export const ALLY_ACQUIRE_ANGLE = 15 * DEG;
/** The current ally target stays selected up to this angle. */
export const ALLY_KEEP_ANGLE = 25 * DEG;
/** Another ally takes over only if its angle is smaller than the current target's by more than this. */
export const ALLY_SWITCH_MARGIN = 5 * DEG;

export interface AllyCandidate {
  id: number;
  x: number;
  y: number;
  /** Feet height. */
  z: number;
  dead: boolean;
}

export interface AllyTargetResult {
  /** The ally target's player ID, or ALLY_NONE. */
  target: number;
  /**
   * With no ally target: the ally nearest the aim within the acquire angle that fails only the range
   * check, for the grey chevron; otherwise ALLY_NONE.
   */
  outOfRange: number;
}

/**
 * Picks the ally target from the eye (ex, ey, ez) along the unit aim (ax, ay, az). `current` is the
 * previous frame's target. Candidates must not include the local player.
 */
export function pickAllyTarget(
  map: GameMap,
  ex: number,
  ey: number,
  ez: number,
  ax: number,
  ay: number,
  az: number,
  candidates: readonly AllyCandidate[],
  range: number,
  current: number,
): AllyTargetResult {
  let currentAngle = Infinity;
  let best = ALLY_NONE;
  let bestAngle = Infinity;
  let grey = ALLY_NONE;
  let greyAngle = Infinity;
  for (const q of candidates) {
    if (q.dead) continue;
    const cz = q.z + PLAYER_HEIGHT / 2;
    const dx = q.x - ex;
    const dy = q.y - ey;
    const dz = cz - ez;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-6) continue;
    const angle = Math.acos(Math.max(-1, Math.min(1, (dx * ax + dy * ay + dz * az) / len)));
    const limit = q.id === current ? ALLY_KEEP_ANGLE : ALLY_ACQUIRE_ANGLE;
    if (angle > limit + 1e-9) continue;
    if (!lineOfSight(map, ex, ey, ez, q.x, q.y, cz)) continue;
    if (distToCylinder(ex, ey, ez, q.x, q.y, q.z, PLAYER_RADIUS, PLAYER_HEIGHT) > range) {
      if (angle <= ALLY_ACQUIRE_ANGLE + 1e-9 && angle < greyAngle) {
        grey = q.id;
        greyAngle = angle;
      }
      continue;
    }
    if (q.id === current) currentAngle = angle;
    else if (angle < bestAngle) {
      best = q.id;
      bestAngle = angle;
    }
  }
  let target = ALLY_NONE;
  if (currentAngle < Infinity) {
    // Keep the current target unless another is within the acquire angle and clearly better.
    target = best !== ALLY_NONE && bestAngle < currentAngle - ALLY_SWITCH_MARGIN ? best : current;
  } else target = best;
  return { target, outOfRange: target === ALLY_NONE ? grey : ALLY_NONE };
}
