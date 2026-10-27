/**
 * Geometry the host and the client share for the Betrayer's talents (classes-betrayer.md §3–§4): the
 * Way Back's return path, Thrown Silver's landing, the Judas Coin's spot, the Silver Wire's ends and the
 * Silver Bullet's glance. Pure functions of the map; no simulation state.
 */
import { JUDAS, TALENT, WAY_BACK, WIRE } from '../data/talents';
import { PLAYER_EYE, PLAYER_RADIUS } from './constants';
import { walkDestination } from './field';
import { lineOfSight, raycastTerrain, raycastTerrainHit } from './los';
import type { GameMap } from './map';
import { groundHeight, moveHorizontal, type Body, type MoveResult } from './movement';

const STEP = 0.25;

/**
 * The Way Back's straight return from the feet (x, y, z) toward the shadow: normal floor movement,
 * stopping within 0.5 m of the shadow, at the first obstruction, or after 30 m. Returns the points
 * every 0.25 m, the start first.
 */
export function wayBackPath(map: GameMap, x: number, y: number, z: number, tx: number, ty: number): number[] {
  const body: Body = { x, y, z, vz: 0, grounded: true, radius: PLAYER_RADIUS, flying: false };
  const out: MoveResult = { blocked: false };
  const pts = [x, y, z];
  const total = Math.min(WAY_BACK.range, Math.hypot(tx - x, ty - y));
  if (total < 1e-6) return pts;
  const ux = (tx - x) / Math.hypot(tx - x, ty - y), uy = (ty - y) / Math.hypot(tx - x, ty - y);
  for (let d = 0; d < total - 0.5 + 1e-9;) {
    const step = Math.min(STEP, total - d);
    const bx = body.x, by = body.y;
    out.blocked = false;
    moveHorizontal(map, body, ux * step, uy * step, out);
    // A straight line: any sideways slide along a wall is a stop.
    if (out.blocked) { body.x = bx; body.y = by; break; }
    d += step;
    pts.push(body.x, body.y, body.z);
  }
  return pts;
}

/** Length of a polyline of x, y, z triples, horizontally. */
export function pathLength(pts: readonly number[]): number {
  let l = 0;
  for (let i = 3; i < pts.length; i += 3) l += Math.hypot(pts[i] - pts[i - 3], pts[i + 1] - pts[i - 2]);
  return l;
}

/** The point at horizontal distance `d` along a polyline, clamped to its end. */
export function pathPoint(pts: readonly number[], d: number): [number, number, number] {
  for (let i = 3; i < pts.length; i += 3) {
    const l = Math.hypot(pts[i] - pts[i - 3], pts[i + 1] - pts[i - 2]);
    if (d <= l && l > 1e-9) {
      const f = d / l;
      return [pts[i - 3] + (pts[i] - pts[i - 3]) * f, pts[i - 2] + (pts[i + 1] - pts[i - 2]) * f, pts[i - 1] + (pts[i + 2] - pts[i - 1]) * f];
    }
    d -= l;
  }
  const n = pts.length;
  return [pts[n - 3], pts[n - 2], pts[n - 1]];
}

/**
 * Thrown Silver's center (classes-betrayer.md `c.1b`): the first floor point the crosshair ray meets
 * within 25 m; at a wall, the floor 0.5 m back from its foot; meeting nothing, the floor under the
 * point 25 m along. Returns feet coordinates on that floor.
 */
export function thrownFieldCenter(map: GameMap, x: number, y: number, z: number, dx: number, dy: number, dz: number): [number, number, number] {
  const ez = z + PLAYER_EYE;
  const hit = raycastTerrainHit(map, x, y, ez, dx, dy, dz, TALENT.thrownRange);
  let px = x + dx * hit.t, py = y + dy * hit.t;
  if (hit.side) {
    const h = Math.hypot(dx, dy);
    if (h > 1e-6) { px -= (dx / h) * 0.5; py -= (dy / h) * 0.5; }
  }
  // Never outside the map or inside a wall: walk back along the line to the last open floor.
  for (let back = 0; back < 60; back++) {
    const g = floorAt(map, px, py);
    if (g !== null) return [px, py, g];
    const h = Math.hypot(dx, dy) || 1;
    px -= (dx / h) * 0.5; py -= (dy / h) * 0.5;
  }
  return [x, y, z];
}

function floorAt(map: GameMap, x: number, y: number): number | null {
  const c = Math.floor(x), r = Math.floor(y);
  if (c < 0 || r < 0 || c >= map.w || r >= map.h) return null;
  const i = r * map.w + c;
  if (map.solid[i] || !Number.isFinite(map.floor[i])) return null;
  const g = groundHeight(map, x, y, 0, Infinity, false, true);
  return g === -Infinity ? map.floor[i] : g;
}

/**
 * The Judas Coin's spot: eye height, 6 m ahead along the yaw, or 0.5 m before the first wall; null when
 * the wall leaves less than 0.5 m in front of the caster (rejected without cooldown).
 */
export function judasCoinSpot(map: GameMap, x: number, y: number, z: number, yaw: number): [number, number, number] | null {
  const ez = z + PLAYER_EYE, dx = Math.cos(yaw), dy = Math.sin(yaw);
  const t = raycastTerrain(map, x, y, ez, dx, dy, 0, JUDAS.ahead + JUDAS.wallBack);
  const d = Math.min(JUDAS.ahead, t - JUDAS.wallBack);
  if (d < 0.5) return null;
  return [x + dx * d, y + dy * d, ez];
}

/** The coin's height while it sinks 0.5 m over its 4 s. */
export function coinHeight(z0: number, ageSeconds: number): number {
  return z0 - JUDAS.sink * Math.min(1, Math.max(0, ageSeconds / JUDAS.life));
}

/** The Silver Wire's ends: from the feet along the yaw, up to 15 m, as Field's walk; at 0.6 m above each floor. */
export function wireEnds(map: GameMap, x: number, y: number, yaw: number): [number, number, number, number, number, number] {
  const [ex, ey, ez] = walkDestination(map, x, y, yaw, WIRE.length);
  const sz = map.floor[Math.floor(y) * map.w + Math.floor(x)];
  return [x, y, sz + WIRE.height, ex, ey, ez + WIRE.height];
}

/** Distance along a ray (unit direction) to a sphere, or Infinity. */
export function raySphere(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, cx: number, cy: number, cz: number, r: number): number {
  const lx = cx - ox, ly = cy - oy, lz = cz - oz;
  const tc = lx * dx + ly * dy + lz * dz;
  const d2 = lx * lx + ly * ly + lz * lz - tc * tc;
  if (d2 > r * r) return Infinity;
  const th = Math.sqrt(r * r - d2);
  const t = tc - th;
  if (t >= 0) return t;
  return tc + th >= 0 ? 0 : Infinity;
}

/**
 * Glancing Silver's reflection at a ray's terrain stop: null unless it struck a vertical wall face
 * (floors and ceilings stop it). Returns the mirrored direction.
 */
export function glance(map: GameMap, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, t: number): [number, number, number] | null {
  if (!raycastTerrainHit(map, ox, oy, oz, dx, dy, dz, t + 1e-3).side) return null;
  const hx = ox + dx * t, hy = oy + dy * t, hz = oz + dz * t;
  const top = (c: number, r: number) => c < 0 || r < 0 || c >= map.w || r >= map.h ? Infinity : map.top[r * map.w + c];
  const e = 1e-3;
  // Which face it entered: stepping across x alone, or y alone, from the point just before the hit.
  const bx = hx - dx * e, by = hy - dy * e;
  const xWall = top(Math.floor(bx + dx * 2 * e), Math.floor(by)) > hz;
  const yWall = top(Math.floor(bx), Math.floor(by + dy * 2 * e)) > hz;
  if (xWall && !yWall) return [-dx, dy, dz];
  if (yWall && !xWall) return [dx, -dy, dz];
  return [-dx, -dy, dz];
}

/** Squared horizontal distance from (px, py) to the segment (x0, y0)–(x1, y1), and its parameter. */
export function segmentClosest(px: number, py: number, x0: number, y0: number, x1: number, y1: number): { d2: number; t: number } {
  const dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy;
  const t = l2 > 1e-12 ? Math.max(0, Math.min(1, ((px - x0) * dx + (py - y0) * dy) / l2)) : 0;
  const qx = x0 + dx * t - px, qy = y0 + dy * t - py;
  return { d2: qx * qx + qy * qy, t };
}

/**
 * The floor point the crosshair ray from the eye meets within `reach` m (R5 aimed casts): a wall hit is
 * brought 0.5 m back from its foot; null when the ray meets nothing within reach or no open floor.
 */
export function aimFloorPoint(map: GameMap, x: number, y: number, z: number, dx: number, dy: number, dz: number, reach: number): [number, number, number] | null {
  const ez = z + PLAYER_EYE;
  const hit = raycastTerrainHit(map, x, y, ez, dx, dy, dz, reach);
  if (hit.t >= reach - 1e-6) return null;
  let px = x + dx * hit.t, py = y + dy * hit.t;
  const h = Math.hypot(dx, dy);
  if (hit.side && h > 1e-6) { px -= (dx / h) * 0.5; py -= (dy / h) * 0.5; }
  for (let back = 0; back < 4; back++) {
    const g = floorAt(map, px, py);
    if (g !== null) return [px, py, g];
    if (h < 1e-6) break;
    px -= (dx / h) * 0.25; py -= (dy / h) * 0.25;
  }
  return null;
}

/**
 * Rain of Fire's circle (classes-fallen.md §4): the crosshair's floor point, at most 30 m away
 * horizontally, in the caster's room, in sight of the eye. `valid` false draws the preview red.
 */
export function rainPoint(map: GameMap, x: number, y: number, z: number, dx: number, dy: number, dz: number, range: number): { x: number; y: number; z: number; valid: boolean } {
  const pt = aimFloorPoint(map, x, y, z, dx, dy, dz, range * 2);
  if (!pt) {
    const h = Math.hypot(dx, dy) || 1;
    return { x: x + (dx / h) * range, y: y + (dy / h) * range, z, valid: false };
  }
  const [px, py, pz] = pt;
  const room = map.roomOf[Math.floor(y) * map.w + Math.floor(x)];
  const valid = Math.hypot(px - x, py - y) <= range + 1e-6 && map.roomOf[Math.floor(py) * map.w + Math.floor(px)] === room &&
    lineOfSight(map, x, y, z + PLAYER_EYE, px, py, pz + 0.3);
  return { x: px, y: py, z: pz, valid };
}

/**
 * An aimed walked destination (classes-binder.md Cast Down, the Well, the Boundary): the horizontal
 * distance to the crosshair's floor point (aimed above the horizon or at nothing: `max`), held between
 * `min` and `max`, then walked from the feet along the yaw like Chains' pile point (a wall, a closed
 * door or a step over 0.5 m stops it).
 */
export function aimedWalk(map: GameMap, x: number, y: number, z: number, yaw: number, pitch: number, min: number, max: number): [number, number, number] {
  const dx = Math.cos(pitch) * Math.cos(yaw), dy = Math.cos(pitch) * Math.sin(yaw), dz = Math.sin(pitch);
  const pt = pitch >= 0 ? null : aimFloorPoint(map, x, y, z, dx, dy, dz, 80);
  const d = pt ? Math.max(min, Math.min(max, Math.hypot(pt[0] - x, pt[1] - y))) : max;
  return walkDestination(map, x, y, yaw, d);
}

/** The Boundary Chain's ends: each half walked sideways from the center, square to the yaw. */
export function boundaryEnds(map: GameMap, cx: number, cy: number, yaw: number, length: number): [number, number, number, number, number, number] {
  const [ax, ay, az] = walkDestination(map, cx, cy, yaw + Math.PI / 2, length / 2);
  const [bx, by, bz] = walkDestination(map, cx, cy, yaw - Math.PI / 2, length / 2);
  return [ax, ay, az, bx, by, bz];
}
