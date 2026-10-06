import { isDecorId, type DecorId } from '../data/decor';
import type { ArenaDef, DungeonDef } from '../data/dungeons/types';
import { PHASE_CLEARED, PHASE_COMBAT, PHASE_IDLE } from '../net/protocol';
import { HEIGHT_STEP, MAX_MAP_SIZE } from './constants';
import { computeHeights, K_VOID, type Heights } from './heights';

/** A map that failed to load, naming the row and column of the problem (§8.1). */
export class MapError extends Error {
  constructor(
    readonly row: number,
    readonly col: number,
    readonly reason: string,
  ) {
    super(`Map error at row ${row}, column ${col}: ${reason}`);
    this.name = 'MapError';
  }
}

export interface GameMap {
  id: string;
  name: string;
  w: number;
  h: number;
  /** Floor height in meters for floor cells (door cells: when open); 0 for walls. */
  floor: Float32Array;
  /** 1 for static wall cells. */
  wall: Uint8Array;
  /** Index of the arena that owns this door cell, or -1. */
  doorArena: Int16Array;
  /** 1 for walls and closed doors. Changes as doors open and close. */
  solid: Uint8Array;
  /**
   * Used by ray tests (M10 §3.4): the floor height of floor cells and open doors, a wall cell's height
   * (open edges: the parapet; void: −∞), a closed door's *Door* height. Changes with doors.
   */
  top: Float32Array;
  /** Zones, wall kinds and heights, open edges and bays (M10 §3). */
  heights: Heights;
  /** Player spawn cells (`S`) in reading order. */
  spawns: Array<[number, number]>;
  /** Enemy spawn cells (`x`) inside each arena's rect, per arena, in reading order. */
  arenaSpawnPoints: Array<Array<[number, number]>>;
  /** Gatekeeper cell (`B`), if any. */
  boss: [number, number] | null;
  /** Decorations in reading order; drawn only (§8.1). */
  decorations: Array<{ id: DecorId; c: number; r: number }>;
  arenas: ArenaDef[];
}

/** Marker characters with a fixed meaning; a `decor` key can't be one of these. */
const RESERVED_MARKERS = '.SDxB';

function heightIndex(ch: string): number {
  const c = ch.charCodeAt(0);
  if (c >= 48 && c <= 57) return c - 48;
  if (c >= 97 && c <= 122) return c - 97 + 10;
  return -1;
}

/** Parses and checks a dungeon definition (§8.1). Throws MapError. */
export function loadMap(def: DungeonDef): GameMap {
  const { heights, markers } = def;
  const decor = def.decor ?? {};
  if (heights.length === 0 || heights[0].length === 0) throw new MapError(0, 0, 'the grid is empty');
  const h = heights.length;
  const w = heights[0].length;
  if (h > MAX_MAP_SIZE) throw new MapError(MAX_MAP_SIZE, 0, `the grid has more than ${MAX_MAP_SIZE} rows`);
  if (w > MAX_MAP_SIZE) throw new MapError(0, MAX_MAP_SIZE, `the grid has more than ${MAX_MAP_SIZE} columns`);
  if (markers.length !== h) {
    const row = Math.min(markers.length, h);
    throw new MapError(row, 0, `the marker grid has ${markers.length} rows, the height grid ${h}`);
  }
  for (let r = 0; r < h; r++) {
    if (heights[r].length !== w) throw new MapError(r, Math.min(w, heights[r].length), `height row length ${heights[r].length} differs from ${w}`);
    if (markers[r].length !== w) throw new MapError(r, Math.min(w, markers[r].length), `marker row length ${markers[r].length} differs from ${w}`);
  }

  const n = w * h;
  const floor = new Float32Array(n);
  const wall = new Uint8Array(n);
  const doorArena = new Int16Array(n).fill(-1);
  const spawns: Array<[number, number]> = [];
  const xCells: Array<[number, number]> = [];
  const doorCells: Array<[number, number]> = [];
  let boss: [number, number] | null = null;
  const decorations: GameMap['decorations'] = [];

  for (const [key, id] of Object.entries(decor)) {
    if (key.length === 1 && !RESERVED_MARKERS.includes(key) && isDecorId(id)) continue;
    // Name the first cell using the key, if any.
    let at: [number, number] = [0, 0];
    const r = markers.findIndex((row) => row.includes(key));
    if (r >= 0) at = [r, markers[r].indexOf(key)];
    const why = isDecorId(id) ? `decoration key '${key}' isn't a single unreserved character` : `unknown decoration '${String(id)}'`;
    throw new MapError(at[0], at[1], why);
  }

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const hc = heights[r][c];
      const i = r * w + c;
      if (hc === '#') {
        wall[i] = 1;
      } else {
        const hi = heightIndex(hc);
        if (hi < 0) throw new MapError(r, c, `unknown height character '${hc}'`);
        floor[i] = hi * HEIGHT_STEP;
      }
      const mc = markers[r][c];
      if (mc === '.') continue;
      const decorId = Object.hasOwn(decor, mc) ? decor[mc] : undefined;
      if (!RESERVED_MARKERS.includes(mc) && !decorId) throw new MapError(r, c, `unknown marker character '${mc}'`);
      if (wall[i]) throw new MapError(r, c, `marker '${mc}' sits on a wall`);
      if (decorId) decorations.push({ id: decorId, c, r });
      else if (mc === 'S') {
        spawns.push([c, r]);
        if (spawns.length > 4) throw new MapError(r, c, 'more than 4 S markers');
      } else if (mc === 'x') xCells.push([c, r]);
      else if (mc === 'D') doorCells.push([c, r]);
      else {
        if (boss) throw new MapError(r, c, 'more than one B marker');
        boss = [c, r];
      }
    }
  }
  if (spawns.length !== 4) throw new MapError(0, 0, `expected exactly 4 S markers, found ${spawns.length}`);

  def.arenas.forEach((arena, ai) => {
    for (const [c, r] of [...arena.doors, ...(arena.exitDoors ?? [])]) {
      if (c < 0 || r < 0 || c >= w || r >= h || markers[r][c] !== 'D') {
        throw new MapError(r, c, `arena '${arena.id}' lists a door that isn't a D cell`);
      }
      const i = r * w + c;
      if (doorArena[i] !== -1) throw new MapError(r, c, 'a D cell is in more than one arena\'s doors');
      doorArena[i] = ai;
    }
  });
  for (const [c, r] of doorCells) {
    if (doorArena[r * w + c] === -1) throw new MapError(r, c, 'a D cell isn\'t in any arena\'s doors');
  }

  const arenaSpawnPoints = def.arenas.map((a) =>
    xCells.filter(([c, r]) => c >= a.rect.x0 && c <= a.rect.x1 && r >= a.rect.y0 && r <= a.rect.y1),
  );

  const solid = new Uint8Array(wall);
  const walls = computeHeights({ w, h, floor, wall, doorArena, boss, arenas: def.arenas });
  const top = new Float32Array(n);
  for (let i = 0; i < n; i++) top[i] = wall[i] ? walls.height[i] : floor[i];

  return { id: def.id, name: def.name, w, h, floor, wall, doorArena, solid, top, heights: walls, spawns, arenaSpawnPoints, boss, decorations, arenas: def.arenas };
}

/** Opens or closes the doors of one arena. */
export function setArenaDoors(map: GameMap, arenaIndex: number, phase: number): void {
  const a = map.arenas[arenaIndex];
  const closed = doorsClosed(phase);
  setCells(map, a.doors, closed.entry);
  setCells(map, a.exitDoors ?? [], closed.exit);
}

function setCells(map: GameMap, cells: ReadonlyArray<[number, number]>, closed: boolean): void {
  for (const [c, r] of cells) {
    const i = r * map.w + c;
    map.solid[i] = closed ? 1 : 0;
    map.top[i] = closed ? map.heights.height[i] : map.floor[i];
  }
}

/**
 * An arena's doors for its phase (§8.2 lifecycle): the entry door is closed only in combat; the exit
 * door, toward the next arena, stays closed until the arena is cleared.
 */
export function doorsClosed(phase: number): { entry: boolean; exit: boolean } {
  return { entry: phase === PHASE_COMBAT, exit: phase !== PHASE_CLEARED };
}

/** Arena `ai`'s phase, from the snapshot's `arenaIndex` and `arenaPhase`: arenas are entered in order. */
export function arenaPhaseOf(ai: number, arenaIndex: number, arenaPhase: number): number {
  return ai < arenaIndex ? PHASE_CLEARED : ai === arenaIndex ? arenaPhase : PHASE_IDLE;
}

/** Whether the cell is solid (wall, closed door, or outside the grid). */
export function isSolid(map: GameMap, c: number, r: number): boolean {
  if (c < 0 || r < 0 || c >= map.w || r >= map.h) return true;
  return map.solid[r * map.w + c] === 1;
}

/** Whether the point is over a void cell or outside the grid (M10 §3.2): only sky there. */
export function overVoid(map: GameMap, x: number, y: number): boolean {
  const c = Math.floor(x);
  const r = Math.floor(y);
  if (c < 0 || r < 0 || c >= map.w || r >= map.h) return true;
  return map.heights.kind[r * map.w + c] === K_VOID;
}

/** Whether the position is inside the arena's rect (§8.2). */
export function insideRect(a: ArenaDef, x: number, y: number): boolean {
  return x >= a.rect.x0 && x < a.rect.x1 + 1 && y >= a.rect.y0 && y < a.rect.y1 + 1;
}
