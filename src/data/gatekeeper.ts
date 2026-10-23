/**
 * The authored Gatekeeper (rogue bosses.md §3): the fixed 28 s cycle, its moves' numbers and the pure
 * geometry the host and every client share, so a client draws and predicts exactly what the host
 * decides (the Toll's ring, the Call's drag). No DOM or three.js.
 */
import { EPS, PLAYER_EYE, SUBSTEP, TICK_HZ } from '../sim/constants';
import type { GameMap } from '../sim/map';
import { lineOfSight } from '../sim/los';
import { cellBlocks, circleOverlapsCell } from '../sim/movement';

const t = (seconds: number) => Math.round(seconds * TICK_HZ);

/** The Gatekeeper's HP at four players (§3.1); `bossFactor` scales it. */
export const GATEKEEPER_HP = 52000;

/** HP factor f(P), the §3.4.1 interpolation through (1, 0.30), (2, 0.55), (3, 0.78), (4, 1.0). */
export function bossFactor(p: number): number {
  const pts: Array<[number, number]> = [[1, 0.3], [2, 0.55], [3, 0.78], [4, 1]];
  const x = Math.max(1, Math.min(4, p));
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
    if (x <= x1 + 1e-9) return y0 + (y1 - y0) * (x - x0) / (x1 - x0);
  }
  return 1;
}

// ---------------------------------------------------------------- the cycle (§3.2.1), ticks from `cycleStart`

export const CYCLE_TICKS = t(28);
export const C_HOST = t(1);
export const C_CALL = t(4);
/** Called may wait until c 10; the first Toll until c 10, the second until c 17. */
export const C_CALL_DEADLINE = t(10);
export const C_TOLL_1 = t(8);
export const C_TOLL_1_DEADLINE = t(10);
export const C_TOLL_2 = t(15);
export const C_TOLL_2_DEADLINE = t(17);
export const C_WATCHERS = t(17);
/** Judgment's pre-warning: the quiet drone and the crosshair eye, six seconds before its impact. */
export const C_PREWARN = t(22);
export const C_JUDGMENT = t(25);
/** Volleys try at c 3, 8, 13, 18 and 23; a busy or silenced attempt is skipped, not queued. */
export const C_VOLLEYS = [t(3), t(8), t(13), t(18), t(23)];
/** The phase transition's end sets `cycleStart = tick − C_PHASE_ENTRY`: the next event is c 17. */
export const C_PHASE_ENTRY = C_WATCHERS;

/** Scheduled-event bits, consumed once per cycle. */
export const EV_HOST = 1, EV_CALL = 2, EV_TOLL_1 = 4, EV_TOLL_2 = 8, EV_WATCHERS = 16, EV_JUDGMENT = 32, EV_SEAL_WAVE = 64;
export const EV_VOLLEY = (i: number) => 128 << i;
/** Every event before c 17: consumed by the phase entry. */
export const EV_BEFORE_WATCHERS = EV_HOST | EV_CALL | EV_TOLL_1 | EV_TOLL_2 | EV_SEAL_WAVE | EV_VOLLEY(0) | EV_VOLLEY(1) | EV_VOLLEY(2);

// ---------------------------------------------------------------- casts

/** Cast ids, as the snapshot's `bossCast` sends them (§3.5; Volley 1 and Judgment 2 unchanged). */
export const BOSS_CAST_NONE = 0;
export const BOSS_CAST_VOLLEY = 1;
export const BOSS_CAST_JUDGMENT = 2;
export const BOSS_CAST_TOLL = 3;
export const BOSS_CAST_CALL = 4;
/** Wind-ups: single-target 1.0 s, area 1.5 s, Judgment's 3 s cast. */
export const CAST_TICKS: Record<number, number> = { [BOSS_CAST_VOLLEY]: t(1), [BOSS_CAST_JUDGMENT]: t(3), [BOSS_CAST_TOLL]: t(1.5), [BOSS_CAST_CALL]: t(1) };

/** Judgment breaks at this share of the sealed max HP in damage during its cast. */
export const JUDGMENT_BREAK = 0.045;
/** 1.5 s harmless invulnerable transition at 50%. */
export const TRANSITION_TICKS = t(1.5);
export const PHASE_THRESHOLD = 0.5;

// ---------------------------------------------------------------- the Toll (§3.3.1)

export const TOLL_DAMAGE = 35;
/** The ring is born covering this disk, then rolls out at this speed to this radius. */
export const RING_START = 3.5;
export const RING_SPEED = 9.5;
export const RING_MAX = 70;
export const RING_TICKS = t(7);
/** It hits feet less than this above the floor under them... */
export const RING_HEIGHT = 0.5;
/** ...on floors at most this far above the room's base floor (not the dais or the +2 m gallery). */
export const RING_FLOOR_MAX = 1;

/** The ring's radius at (fractional) tick `tick` for an impact at `impact`; −1 before it or after it expired. */
export function ringRadius(impact: number, tick: number): number {
  const dt = tick - impact;
  if (dt < 0 || dt > RING_TICKS + 1e-9) return -1;
  return Math.min(RING_MAX, RING_START + RING_SPEED * dt / TICK_HZ);
}

/** Whether the ring travels on a floor of height `floor` in a room whose base floor is `base`. */
export function ringFloor(floor: number, base: number): boolean {
  return Number.isFinite(floor) && floor <= base + RING_FLOOR_MAX + EPS;
}

/**
 * Whether the front sweeping from `r0` (−1: the ring's birth, sweep from its center) to `r1` crosses a
 * body of radius `radius` at horizontal distance `d` from its center.
 */
export function ringCrosses(r0: number, r1: number, d: number, radius: number): boolean {
  if (r1 < 0) return false;
  const lo = r0 < 0 ? 0 : r0;
  return d + radius >= lo - 1e-9 && d - radius <= r1 + 1e-9;
}

// ---------------------------------------------------------------- Called to the Gate (§3.3)

export const HOLD_TICKS = t(6);
export const HOLD_LIFT = 1.5;
export const DRAG_SPEED = 2.5;
/** The drag stops this close to the Gatekeeper's center: his 2 m body plus the held player's radius and a margin. */
export const DRAG_STOP = 2.6;
export const SEAL_HP_PER_HEAD = 150;
export const CALL_HEAL = 0.1;
export const SEAL_FORWARD = 1.5;
/**
 * Both boss parts share the one `BOSS_PART` enemy type and so its one shot cylinder (enemies.ts): the
 * Watcher's 0.6 m radius and 1.2 m height. The Seal (specified 0.5 × 1.0 m) is therefore drawn and
 * hit as a slightly larger padlock, centered at the held player's eye height.
 */
export const SEAL_RADIUS = 0.6;
export const SEAL_HEIGHT = 1.2;

/**
 * One tick (or frame) of the Call's drag: the held body, at its fixed feet height `z`, moves
 * horizontally by up to `dist` toward (tx, ty), in substeps along x then y, sliding along walls and
 * stopped by any floor higher than its feet (the dais). Never follows a rising floor. Returns whether
 * it moved. Host and client run the same steps, so the held player's own screen predicts its drag.
 */
export function dragStep(map: GameMap, b: { x: number; y: number; z: number; radius: number }, tx: number, ty: number, dist: number): boolean {
  const dx = tx - b.x, dy = ty - b.y, len = Math.hypot(dx, dy);
  if (len < 1e-6 || dist <= 0) return false;
  const go = Math.min(dist, len);
  const steps = Math.max(1, Math.ceil(go / SUBSTEP - EPS));
  const sx = dx / len * go / steps, sy = dy / len * go / steps;
  let moved = false;
  for (let s = 0; s < steps; s++) {
    if (!blocksNew(map, b.x, b.y, b.x + sx, b.y, b.radius, b.z)) { b.x += sx; moved = true; }
    if (!blocksNew(map, b.x, b.y, b.x, b.y + sy, b.radius, b.z)) { b.y += sy; moved = true; }
  }
  return moved;
}

function blocksNew(map: GameMap, ox: number, oy: number, nx: number, ny: number, r: number, z: number): boolean {
  for (let row = Math.floor(ny - r); row <= Math.floor(ny + r); row++) {
    for (let c = Math.floor(nx - r); c <= Math.floor(nx + r); c++) {
      if (!circleOverlapsCell(nx, ny, r, c, row) || !cellBlocks(map, c, row, z, false, false)) continue;
      if (!circleOverlapsCell(ox, oy, r, c, row)) return true;
    }
  }
  return false;
}

/** Whether a vertical cylinder (feet `z`) is entirely clear of solid cells and floors above its feet. */
export function cylinderClear(map: GameMap, x: number, y: number, z: number, radius: number): boolean {
  for (let row = Math.floor(y - radius); row <= Math.floor(y + radius); row++) {
    for (let c = Math.floor(x - radius); c <= Math.floor(x + radius); c++) {
      if (circleOverlapsCell(x, y, radius, c, row) && cellBlocks(map, c, row, z, false, false)) return false;
    }
  }
  return true;
}

/**
 * Where the Seal hangs (§3.5): its center 1.5 m in front of the held player's eye toward the
 * Gatekeeper, at eye height; else 1 m; else the canonical N/E/S/W points at 1.5 then 1 m, at eye height
 * then 0.5 m above. The whole cylinder must be clear and the owner's eye must see its center. Returns
 * the center, or null when no legal shootable point exists (the hold is released without a heal).
 */
export function sealPoint(map: GameMap, feetX: number, feetY: number, feetZ: number, bx: number, by: number): [number, number, number] | null {
  const ez = feetZ + PLAYER_EYE;
  const dx = bx - feetX, dy = by - feetY, h = Math.hypot(dx, dy);
  const dirs: Array<[number, number]> = [];
  if (h > 1e-6) dirs.push([dx / h, dy / h]);
  dirs.push([0, -1], [1, 0], [0, 1], [-1, 0]);
  for (const lift of [0, 0.5]) {
    for (const [ux, uy] of dirs) {
      for (const d of [SEAL_FORWARD, 1]) {
        const x = feetX + ux * d, y = feetY + uy * d, z = ez + lift;
        if (cylinderClear(map, x, y, z - SEAL_HEIGHT / 2, SEAL_RADIUS) && lineOfSight(map, feetX, feetY, ez, x, y, z)) return [x, y, z];
      }
    }
  }
  return null;
}

// ---------------------------------------------------------------- the Watchers (§3.3.2)

export const WATCHER_HP = 60;
export const WATCHER_RADIUS = 0.6;
export const WATCHER_HEIGHT = 1.2;
/** The eye's center hovers this high above the floor. */
export const WATCHER_HOVER = 6;
export const WATCHER_OPENING = t(2);
/** An eye judges, and draws its thread, only within this horizontal distance. */
export const WATCHER_GAZE = 24;
/** At opening every eye is within this horizontal distance and sight of a living human's eye. */
export const WATCHER_ACCESS = 20;
/** The whole destroyed pack routes this share of the sealed max HP through its tethers. */
export const TETHER_TOTAL = 0.08;

/** Boss-part kinds in the enemy record's flags (§3.5): the Seal bit; the opening bit reuses the stun bit. */
export const FLAG_PART_OPENING = 2;
export const FLAG_PART_SEAL = 128;

// ---------------------------------------------------------------- the Host (§3.4)

export const HOST = { blessed: 120, cherubs: 6 };
export const SEAL_WAVE = { choristers: 4, cherubs: 6 };
export const HOST_ARRIVAL_TICKS = t(6);
/** Boss adds drop at most this many heal motes in the whole fight. */
export const BOSS_MOTE_CAP = 8;
/** Slots kept free for the eyes and the Seal, outside the add cap. */
export const PART_RESERVE = 8;

/** Snapshot `bossPhase` bit: the 1.5 s invulnerable transition. */
export const BOSS_PHASE_INVULNERABLE = 128;
/** Snapshot `bossFlags`: the final hit is deferred ("Break the seals of Judgment"); the Watchers are open. */
export const BOSS_FLAG_DEFERRED = 1;
export const BOSS_FLAG_WATCHERS = 2;
