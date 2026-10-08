/**
 * Falling Star, aimed anywhere (M12 §5.2): the hold / release / cancel state machine, the landing
 * point, the walkable set, the arc and its check. Pure: no DOM or three.js.
 */
import { FALLING_STAR_RANGE, FALLING_STAR_SNAP } from '../data/weapons';
import { aimDir } from '../sim/combat';
import { EPS, PLAYER_EYE, PLAYER_HEIGHT, STEP_UP } from '../sim/constants';
import { K_VOID } from '../sim/heights';
import { lineOfSight, raycastTerrainHit } from '../sim/los';
import type { GameMap } from '../sim/map';

/** A wall's side hit puts the landing point this far back along the ray, horizontally. */
export const WALL_BACK = 0.5;
/** The arc is checked every this many meters along its line. */
export const ARC_SAMPLE = 0.5;
/** The preview's arc is this many segments. */
export const ARC_SEGMENTS = 24;

/** The arc's peak above the straight line between its ends: 1.5 m plus 0.08 per meter (3.9 m at 30 m). */
export function arcHeight(d: number): number {
  return 1.5 + 0.08 * d;
}

/**
 * The point at `u` (0–1) along the leap's arc from (x0, y0, z0) to (x1, y1, z1), both feet: a straight
 * line horizontally, in height z₀ + (z₁ − z₀)u + 4H·u(1 − u).
 */
export function arcPoint(x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, u: number): [number, number, number] {
  const h = arcHeight(Math.hypot(x1 - x0, y1 - y0));
  return [x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, z0 + (z1 - z0) * u + 4 * h * u * (1 - u)];
}

/**
 * The cells reachable on foot from any spawn point of any arena (M12 §5.2): a breadth-first search with
 * the ground step rule (up at most 0.5 m, down any height; a diagonal needs both orthogonal steps).
 * Door cells count as open at their floor; walls and void cells are never walkable. Once per map.
 */
export function walkableCells(map: GameMap): Uint8Array {
  const { w, h } = map;
  const out = new Uint8Array(w * h);
  const open = (c: number, r: number): boolean => {
    if (c < 0 || r < 0 || c >= w || r >= h) return false;
    const i = r * w + c;
    return !map.wall[i] && map.heights.kind[i] !== K_VOID;
  };
  const step = (ac: number, ar: number, bc: number, br: number): boolean => open(bc, br) && map.floor[br * w + bc] - map.floor[ar * w + ac] <= STEP_UP + EPS;
  const queue: number[] = [];
  for (const points of map.arenaSpawnPoints) {
    for (const [c, r] of points) {
      if (!open(c, r) || out[r * w + c]) continue;
      out[r * w + c] = 1;
      queue.push(r * w + c);
    }
  }
  for (let q = 0; q < queue.length; q++) {
    const ac = queue[q] % w;
    const ar = Math.floor(queue[q] / w);
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const bc = ac + dx;
        const br = ar + dy;
        if (bc < 0 || br < 0 || bc >= w || br >= h || out[br * w + bc]) continue;
        if (!step(ac, ar, bc, br)) continue;
        if (dx && dy && !(step(ac, ar, bc, ar) && step(ac, ar, ac, br))) continue;
        out[br * w + bc] = 1;
        queue.push(br * w + bc);
      }
    }
  }
  return out;
}

/** A teammate the leap can snap to: their interpolated feet. */
export interface StarAlly {
  id: number;
  x: number;
  y: number;
  z: number;
  dead: boolean;
}

export interface Landing {
  x: number;
  y: number;
  z: number;
  /** The ally snapped to, or −1. */
  ally: number;
  valid: boolean;
}

/** The floor of the cell at (x, y): 0 outside the map, as for walls. */
function floorOf(map: GameMap, x: number, y: number): number {
  const c = Math.floor(x);
  const r = Math.floor(y);
  if (c < 0 || r < 0 || c >= map.w || r >= map.h) return 0;
  return map.floor[r * map.w + c];
}

/**
 * This frame's landing point for the Fallen with its feet at (x, y, z), aiming along yaw and pitch
 * (M12 §5.2). The aim ray from the eye: a floor or top within 30 m horizontally is the point; a wall's
 * side puts it 0.5 m back along the ray, on the floor of the cell there; nothing within 30 m puts it 30 m
 * along the yaw, on the floor there. A living ally whose feet are within 2.5 m of that point, seen from
 * the eye within 30 m, snaps it to their feet.
 */
export function aimLanding(map: GameMap, x: number, y: number, z: number, yaw: number, pitch: number, allies: readonly StarAlly[]): { x: number; y: number; z: number; ally: number } {
  const ez = z + PLAYER_EYE;
  const [dx, dy, dz] = aimDir(yaw, pitch);
  const maxDist = FALLING_STAR_RANGE / Math.max(Math.cos(pitch), 0.01);
  const hit = raycastTerrainHit(map, x, y, ez, dx, dy, dz, maxDist);
  let px: number;
  let py: number;
  let pz: number;
  if (hit.t < maxDist && !hit.side) {
    px = x + dx * hit.t;
    py = y + dy * hit.t;
    pz = ez + dz * hit.t;
  } else {
    const h = hit.t < maxDist ? hit.t * Math.cos(pitch) - WALL_BACK : FALLING_STAR_RANGE;
    px = x + Math.cos(yaw) * h;
    py = y + Math.sin(yaw) * h;
    pz = floorOf(map, px, py);
  }
  let best: StarAlly | null = null;
  let bestD = FALLING_STAR_SNAP;
  for (const a of allies) {
    if (a.dead) continue;
    const d = Math.hypot(a.x - px, a.y - py);
    if (d > bestD) continue;
    const cz = a.z + PLAYER_HEIGHT / 2;
    if (Math.hypot(a.x - x, a.y - y, cz - ez) > FALLING_STAR_RANGE || !lineOfSight(map, x, y, ez, a.x, a.y, cz)) continue;
    best = a;
    bestD = d;
  }
  return best ? { x: best.x, y: best.y, z: best.z, ally: best.id } : { x: px, y: py, z: pz, ally: -1 };
}

/**
 * Whether the arc from the feet (x0, y0, z0) to the landing point is clear: sampled every 0.5 m along
 * its line, each consecutive pair raised to the body center (+0.9 m) in line of sight on the live map.
 * With no horizontal distance (a slam in place) there's nothing to check.
 */
export function arcClear(map: GameMap, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): boolean {
  const d = Math.hypot(x1 - x0, y1 - y0);
  if (d < 1e-9) return true;
  const n = Math.max(1, Math.ceil(d / ARC_SAMPLE - 1e-9));
  const up = PLAYER_HEIGHT / 2;
  let prev = arcPoint(x0, y0, z0, x1, y1, z1, 0);
  for (let k = 1; k <= n; k++) {
    const p = arcPoint(x0, y0, z0, x1, y1, z1, k / n);
    if (!lineOfSight(map, prev[0], prev[1], prev[2] + up, p[0], p[1], p[2] + up)) return false;
    prev = p;
  }
  return true;
}

/** The landing point with its validity: a walkable landing cell and a clear arc. */
export function starLanding(map: GameMap, walkable: Uint8Array, x: number, y: number, z: number, yaw: number, pitch: number, allies: readonly StarAlly[]): Landing {
  const l = aimLanding(map, x, y, z, yaw, pitch, allies);
  const c = Math.floor(l.x);
  const r = Math.floor(l.y);
  const inside = c >= 0 && r >= 0 && c < map.w && r < map.h;
  const valid = inside && walkable[r * map.w + c] === 1 && arcClear(map, x, y, z, l.x, l.y, l.z);
  return { ...l, valid };
}

/** What a frame of the aim did. */
export type AimStep = 'none' | 'release' | 'cancel';

/**
 * The hold / release / cancel state machine (M12 §5.2). E's key-down while ready and alive starts the
 * preview; on the first frame E isn't held, it's released (the caller leaps if the landing is valid).
 * A right-button press while aiming cancels, and the right button then counts as released until it
 * is let go, so that press doesn't fire the slug. A frame on which `Input.release()` was called (death,
 * Pause, the chat line, losing focus) cancels instead of releasing.
 */
export class StarAim {
  aiming = false;
  /** The right button is ignored until it's let go. */
  rightBlocked = false;
  private releases = 0;
  private rightWas = false;

  /** E's key-down: a preview starts only if Falling Star is ready now. */
  keyDown(ready: boolean, alive: boolean): void {
    if (ready && alive) this.aiming = true;
  }

  /** Once per frame, before acting on the result. `releases` is `Input`'s count of `release()` calls. */
  frame(eHeld: boolean, rightHeld: boolean, releases: number): AimStep {
    const released = releases !== this.releases;
    this.releases = releases;
    const rightPressed = rightHeld && !this.rightWas;
    this.rightWas = rightHeld;
    if (!rightHeld) this.rightBlocked = false;
    if (!this.aiming) return 'none';
    if (released) {
      this.aiming = false;
      return 'cancel';
    }
    if (rightPressed) {
      this.aiming = false;
      this.rightBlocked = true;
      return 'cancel';
    }
    if (!eHeld) {
      this.aiming = false;
      return 'release';
    }
    return 'none';
  }

  /** Ends any preview without a leap (Pause, death) and forgets the right button. */
  reset(): void {
    this.aiming = false;
  }
}
