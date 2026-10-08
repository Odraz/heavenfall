/** Ray tests against the heightfield (§5.3): walls at their own heights (M10 §3.4), closed doors and terrain. */
import type { GameMap } from './map';

function topAt(map: GameMap, c: number, r: number): number {
  if (c < 0 || r < 0 || c >= map.w || r >= map.h) return -Infinity;
  return map.top[r * map.w + c];
}

/** Whether the last `raycastTerrain` hit a cell at its entry (a wall's side) rather than descending onto a top or floor. */
let lastSide = false;

/**
 * Casts a 3D ray from (ox, oy, oz) along the unit direction (dx, dy, dz) for up to maxDist.
 * Returns the distance to the first point that is below the top of the cell it's in (walls at their
 * heights, void cells and outside the grid at −∞), or maxDist if there's none.
 */
export function raycastTerrain(
  map: GameMap,
  ox: number,
  oy: number,
  oz: number,
  dx: number,
  dy: number,
  dz: number,
  maxDist: number,
): number {
  let c = Math.floor(ox);
  let r = Math.floor(oy);
  const stepC = dx > 0 ? 1 : -1;
  const stepR = dy > 0 ? 1 : -1;
  const tDeltaX = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDeltaY = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  let tMaxX = dx > 0 ? (c + 1 - ox) * tDeltaX : dx < 0 ? (ox - c) * tDeltaX : Infinity;
  let tMaxY = dy > 0 ? (r + 1 - oy) * tDeltaY : dy < 0 ? (oy - r) * tDeltaY : Infinity;
  let t0 = 0;
  lastSide = false;
  for (;;) {
    const t1 = Math.min(tMaxX, tMaxY, maxDist);
    const top = topAt(map, c, r);
    const z0 = oz + dz * t0;
    const z1 = oz + dz * t1;
    if (z0 < top) {
      lastSide = true;
      return t0;
    }
    if (z1 < top) {
      // The ray descends below this cell's top inside the cell.
      return dz < 0 ? Math.max(t0, (top - oz) / dz) : t0;
    }
    if (t1 >= maxDist) return maxDist;
    if (tMaxX < tMaxY) {
      t0 = tMaxX;
      tMaxX += tDeltaX;
      c += stepC;
    } else {
      t0 = tMaxY;
      tMaxY += tDeltaY;
      r += stepR;
    }
    // A straight line that leaves the grid never comes back into it: nothing more to hit.
    if (c < 0 || r < 0 || c >= map.w || r >= map.h) return maxDist;
  }
}

/**
 * `raycastTerrain`, with whether it hit at a cell's entry (`side`: a wall's side, where the ray enters
 * a cell below its top) rather than descending onto a top or floor inside a cell (M12 §5.2).
 */
export function raycastTerrainHit(map: GameMap, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, maxDist: number): { t: number; side: boolean } {
  const t = raycastTerrain(map, ox, oy, oz, dx, dy, dz, maxDist);
  return { t, side: t < maxDist && lastSide };
}

/** Line of sight between two points, blocked by walls, closed doors and terrain only (§5.3). */
export function lineOfSight(map: GameMap, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  const dx = bx - ax;
  const dy = by - ay;
  const dz = bz - az;
  const len = Math.hypot(dx, dy, dz);
  if (len < 1e-9) return topAt(map, Math.floor(ax), Math.floor(ay)) <= az;
  return raycastTerrain(map, ax, ay, az, dx / len, dy / len, dz / len, len) >= len;
}
