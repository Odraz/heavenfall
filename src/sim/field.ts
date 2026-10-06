/**
 * Field of Blood (M9 §3.4): where it lands and who stands in it. Shared by the host simulation and
 * the clients, which run the same rule for their feedback and local fire timer (§5.1).
 */
import { EPS, PLAYER_RADIUS, STEP_UP } from './constants';
import { isSolid, type GameMap } from './map';
import { groundHeight } from './movement';

/** The field's radius around its center, horizontally. */
export const FIELD_RADIUS = 6;
/** A player's ground must be within this of the center's floor, up or down. */
export const FIELD_BAND = 0.5;
/** Seconds the field lasts. */
export const FIELD_TIME = 8;
/** The field's center lands this far ahead of the Betrayer's feet. */
export const FIELD_TOSS = 3;
/** Players in the field fire this much faster. */
export const FIELD_FIRE_RATE = 2;
/** The destination walk's step (as for Chains of Tartarus, MVP §6.3). */
const WALK_STEP = 0.25;

/**
 * Walks from (x, y) along the horizontal direction `yaw` in 0.25 m steps, up to `max` m, starting from
 * the floor of the cell under (x, y). A step is blocked if its point lies in a wall, a closed door, or a
 * floor more than 0.5 m above the previous point's floor; dropping down is allowed. Returns the last
 * point reached before the first blocked step and the floor of its cell (MVP §6.3, decisions.md §6.3).
 */
export function walkDestination(map: GameMap, x: number, y: number, yaw: number, max: number): [number, number, number] {
  const cx = Math.cos(yaw);
  const cy = Math.sin(yaw);
  let px = x;
  let py = y;
  let prevFloor = map.floor[Math.floor(y) * map.w + Math.floor(x)];
  const steps = Math.round(max / WALK_STEP);
  for (let i = 1; i <= steps; i++) {
    const nx = x + cx * WALK_STEP * i;
    const ny = y + cy * WALK_STEP * i;
    const c = Math.floor(nx);
    const r = Math.floor(ny);
    if (isSolid(map, c, r)) break;
    const f = map.floor[r * map.w + c];
    if (f > prevFloor + STEP_UP + EPS) break;
    px = nx;
    py = ny;
    prevFloor = f;
  }
  return [px, py, map.floor[Math.floor(py) * map.w + Math.floor(px)]];
}

/** The field's center for a Betrayer standing at (x, y) facing `yaw`: 3 m ahead, on that cell's floor. */
export function fieldCenter(map: GameMap, x: number, y: number, yaw: number): [number, number, number] {
  return walkDestination(map, x, y, yaw, FIELD_TOSS);
}

/**
 * Whether a player whose feet are at (px, py) stands in the field centered at (fx, fy) on floor fz:
 * within 6 m horizontally, with its ground (the highest floor its circle overlaps, as in the host's
 * floor check) within 0.5 m of the center's floor. How high the player is doesn't matter.
 */
export function inField(map: GameMap, fx: number, fy: number, fz: number, px: number, py: number): boolean {
  if (Math.hypot(px - fx, py - fy) > FIELD_RADIUS + EPS) return false;
  const g = groundHeight(map, px, py, PLAYER_RADIUS, Infinity, false, true);
  return g !== -Infinity && Math.abs(g - fz) <= FIELD_BAND + EPS;
}

/** The floor cells the pool covers (M9 §5.1): any part within 6 m, floor within 0.5 m of the center's. */
export function fieldCells(map: GameMap, fx: number, fy: number, fz: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = Math.floor(fy - FIELD_RADIUS); r <= Math.floor(fy + FIELD_RADIUS); r++) {
    for (let c = Math.floor(fx - FIELD_RADIUS); c <= Math.floor(fx + FIELD_RADIUS); c++) {
      if (isSolid(map, c, r)) continue;
      // The nearest point of the cell's square to the center.
      const nx = Math.max(c, Math.min(c + 1, fx));
      const ny = Math.max(r, Math.min(r + 1, fy));
      if (Math.hypot(nx - fx, ny - fy) > FIELD_RADIUS) continue;
      if (Math.abs(map.floor[r * map.w + c] - fz) > FIELD_BAND + EPS) continue;
      out.push([c, r]);
    }
  }
  return out;
}
