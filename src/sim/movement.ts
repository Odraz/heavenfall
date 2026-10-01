/** Shared player and enemy movement (§5.2). Used by local player movement, the host and the bot. */
import { EPS, GRAVITY, STEP_UP, SUBSTEP } from './constants';
import type { GameMap } from './map';

export interface Body {
  x: number;
  y: number;
  /** Feet height. */
  z: number;
  /** Vertical velocity, m/s. */
  vz: number;
  grounded: boolean;
  radius: number;
  /** Flyers collide with walls and closed doors only. */
  flying: boolean;
}

export interface MoveResult {
  /** A horizontal axis move was cancelled by collision. */
  blocked: boolean;
}

/** Whether a circle at (x, y) with radius r intersects cell (c, row). */
export function circleOverlapsCell(x: number, y: number, r: number, c: number, row: number): boolean {
  const nx = x < c ? c : x > c + 1 ? c + 1 : x;
  const ny = y < row ? row : y > row + 1 ? row + 1 : y;
  const dx = x - nx;
  const dy = y - ny;
  return dx * dx + dy * dy < r * r;
}

/** Whether a cell blocks a body with the given feet height and grounded state (§5.2). */
export function cellBlocks(map: GameMap, c: number, row: number, z: number, grounded: boolean, flying: boolean): boolean {
  if (c < 0 || row < 0 || c >= map.w || row >= map.h) return true;
  const i = row * map.w + c;
  if (map.solid[i]) return true;
  if (flying) return false;
  const f = map.floor[i];
  return grounded ? f > z + STEP_UP + EPS : f > z + EPS;
}

/**
 * Ground height: the highest floor among the overlapped cells that don't block the body.
 * Returns -Infinity if every overlapped cell blocks.
 */
export function groundHeight(map: GameMap, x: number, y: number, r: number, z: number, grounded: boolean, flying: boolean): number {
  let g = -Infinity;
  const c0 = Math.floor(x - r);
  const c1 = Math.floor(x + r);
  const r0 = Math.floor(y - r);
  const r1 = Math.floor(y + r);
  for (let row = r0; row <= r1; row++) {
    for (let c = c0; c <= c1; c++) {
      if (!circleOverlapsCell(x, y, r, c, row)) continue;
      if (cellBlocks(map, c, row, z, grounded, flying)) continue;
      const f = map.floor[row * map.w + c];
      if (f > g) g = f;
    }
  }
  return g;
}

/**
 * Whether the circle at (nx, ny) overlaps a blocking cell that the circle at (ox, oy) didn't overlap.
 */
function overlapsNewBlocking(map: GameMap, ox: number, oy: number, nx: number, ny: number, b: Body): boolean {
  const r = b.radius;
  const c0 = Math.floor(nx - r);
  const c1 = Math.floor(nx + r);
  const r0 = Math.floor(ny - r);
  const r1 = Math.floor(ny + r);
  for (let row = r0; row <= r1; row++) {
    for (let c = c0; c <= c1; c++) {
      if (!circleOverlapsCell(nx, ny, r, c, row)) continue;
      if (!cellBlocks(map, c, row, b.z, b.grounded, b.flying)) continue;
      if (!circleOverlapsCell(ox, oy, r, c, row)) return true;
    }
  }
  return false;
}

/**
 * Moves a body by (dx, dy) at once, unless that would make it overlap a blocking cell it didn't
 * overlap before. Returns whether it moved. Used for separation pushes (§7.3).
 */
export function tryDisplace(map: GameMap, b: Body, dx: number, dy: number): boolean {
  const nx = b.x + dx;
  const ny = b.y + dy;
  if (overlapsNewBlocking(map, b.x, b.y, nx, ny, b)) return false;
  b.x = nx;
  b.y = ny;
  return true;
}

/** 3D distance from a point to the closest point of a vertical cylinder with its feet at (cx, cy, cz). */
export function distToCylinder(px: number, py: number, pz: number, cx: number, cy: number, cz: number, r: number, h: number): number {
  const dh = Math.max(0, Math.hypot(px - cx, py - cy) - r);
  const dz = pz < cz ? cz - pz : pz > cz + h ? pz - cz - h : 0;
  return Math.hypot(dh, dz);
}

/** Applies ground snapping, leaving the ground and landing (§5.2). Not for flyers. */
export function updateGround(map: GameMap, b: Body): void {
  if (b.flying) return;
  const g = groundHeight(map, b.x, b.y, b.radius, b.z, b.grounded, false);
  if (g === -Infinity) return;
  if (b.grounded) {
    if (g > b.z) b.z = g;
    else if (g < b.z - EPS) {
      b.grounded = false;
      b.vz = 0;
    }
  } else if (b.vz <= 0 && b.z <= g + EPS) {
    b.z = g;
    b.vz = 0;
    b.grounded = true;
  }
}

/**
 * Tries to move a body horizontally by (dx, dy) with collision, in substeps of at most 0.25 m,
 * each applied along x then along y.
 */
export function moveHorizontal(map: GameMap, b: Body, dx: number, dy: number, out?: MoveResult): void {
  const dist = Math.hypot(dx, dy);
  if (dist === 0) return;
  const steps = Math.max(1, Math.ceil(dist / SUBSTEP - EPS));
  const sx = dx / steps;
  const sy = dy / steps;
  for (let s = 0; s < steps; s++) {
    if (sx !== 0) {
      const nx = b.x + sx;
      if (overlapsNewBlocking(map, b.x, b.y, nx, b.y, b)) {
        if (out) out.blocked = true;
      } else b.x = nx;
    }
    if (sy !== 0) {
      const ny = b.y + sy;
      if (overlapsNewBlocking(map, b.x, b.y, b.x, ny, b)) {
        if (out) out.blocked = true;
      } else b.y = ny;
    }
    updateGround(map, b);
  }
}

/**
 * One movement update for a non-flying body: gravity (exact for constant acceleration),
 * then horizontal movement, then ground handling.
 */
export function stepBody(map: GameMap, b: Body, dx: number, dy: number, dt: number, out?: MoveResult): void {
  if (out) out.blocked = false;
  if (!b.grounded) {
    // The ground under the feet before this fall; the body lands when its feet reach it.
    const g = groundHeight(map, b.x, b.y, b.radius, b.z, false, false);
    b.z += b.vz * dt - 0.5 * GRAVITY * dt * dt;
    b.vz -= GRAVITY * dt;
    if (b.vz <= 0 && b.z <= g + EPS) {
      b.z = g;
      b.vz = 0;
      b.grounded = true;
    }
  }
  // moveHorizontal updates the ground after every substep; without movement, update it once here.
  if (dx !== 0 || dy !== 0) moveHorizontal(map, b, dx, dy, out);
  else updateGround(map, b);
}

/** Starts a jump if the body is grounded (§5.2). */
export function jump(b: Body, vz: number): boolean {
  if (!b.grounded) return false;
  b.grounded = false;
  b.vz = vz;
  return true;
}
