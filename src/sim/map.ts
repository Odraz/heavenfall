import { isDecorId, type DecorId } from '../data/decor';
import type { DungeonDef, GateDef, RoomDef, RoomLeaf } from '../data/dungeons/types';
import { PHASE_COMBAT } from '../net/protocol';
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
  /** Index of the room that owns this door (leaf) cell, or -1. */
  doorRoom: Int16Array;
  /** Index of the room whose rect holds this cell, 255 elsewhere (vestibules, bands, void; rogue game.md §14.2). */
  roomOf: Uint8Array;
  /** Hazard per cell: 0 none, 1 `refiners-fire` (rogue game.md §14.2); stamped, inactive until R2. */
  hazard: Uint8Array;
  /** 1 where an open edge may form (rogue game.md §3.5); null: unrestricted. */
  viewMask: Uint8Array | null;
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
  /** Enemy spawn cells (`x`) inside each room's rect, per room, in reading order. */
  roomSpawnPoints: Array<Array<[number, number]>>;
  /** Each room's squad points (M12 follow-up §4.2), every wave's together, without repeats; fixtures only. */
  roomSquadPoints: Array<Array<[number, number]>>;
  /** Gatekeeper cell (`B`), if any. */
  boss: [number, number] | null;
  /** Decorations in reading order; drawn only (§8.1). */
  decorations: Array<{ id: DecorId; c: number; r: number }>;
  rooms: RoomDef[];
  /** The Heavenly Gate (M10 gate §3), drawn only; null on maps without one. */
  gate: GateDef | null;
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
  const doorRoom = new Int16Array(n).fill(-1);
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

  def.rooms.forEach((room, ri) => {
    for (const leaf of room.leaves) {
      for (const [c, r] of leaf.cells) {
        if (c < 0 || r < 0 || c >= w || r >= h || markers[r][c] !== 'D') {
          throw new MapError(r, c, `room '${room.id}' lists a door that isn't a D cell`);
        }
        const i = r * w + c;
        if (doorRoom[i] !== -1) throw new MapError(r, c, 'a D cell is in more than one room\'s doors');
        doorRoom[i] = ri;
      }
    }
  });
  for (const [c, r] of doorCells) {
    if (doorRoom[r * w + c] === -1) throw new MapError(r, c, 'a D cell isn\'t in any room\'s doors');
  }

  const roomOf = new Uint8Array(n).fill(255);
  def.rooms.forEach((a, ri) => {
    for (let r = Math.max(0, a.rect.y0); r <= Math.min(h - 1, a.rect.y1); r++) {
      for (let c = Math.max(0, a.rect.x0); c <= Math.min(w - 1, a.rect.x1); c++) roomOf[r * w + c] = ri;
    }
  });
  const hazard = new Uint8Array(n);
  for (const a of def.rooms) {
    for (const hz of a.hazards ?? []) {
      if (hz.hazard !== 'refiners-fire') throw new MapError(hz.rect.y0, hz.rect.x0, `unknown hazard '${hz.hazard}'`);
      for (let r = Math.max(0, hz.rect.y0); r <= Math.min(h - 1, hz.rect.y1); r++) {
        for (let c = Math.max(0, hz.rect.x0); c <= Math.min(w - 1, hz.rect.x1); c++) hazard[r * w + c] = 1;
      }
    }
  }
  let viewMask: Uint8Array | null = null;
  if (def.viewMask) {
    if (def.viewMask.length !== h) throw new MapError(Math.min(def.viewMask.length, h), 0, `the view mask has ${def.viewMask.length} rows, the height grid ${h}`);
    viewMask = new Uint8Array(n);
    for (let r = 0; r < h; r++) {
      const row = def.viewMask[r];
      if (row.length !== w) throw new MapError(r, Math.min(w, row.length), `view mask row length ${row.length} differs from ${w}`);
      for (let c = 0; c < w; c++) viewMask[r * w + c] = row.charCodeAt(c) === 49 ? 1 : 0;
    }
  }

  const roomSpawnPoints = def.rooms.map((a) =>
    xCells.filter(([c, r]) => c >= a.rect.x0 && c <= a.rect.x1 && r >= a.rect.y0 && r <= a.rect.y1),
  );

  const roomSquadPoints = def.rooms.map((a) => {
    const out: Array<[number, number]> = [];
    for (const wv of a.waves) {
      for (const [c, r] of wv.squad?.at ?? []) {
        if (c < a.rect.x0 || c > a.rect.x1 || r < a.rect.y0 || r > a.rect.y1 || wall[r * w + c]) throw new MapError(r, c, `a squad point of ${a.id} isn't a floor cell in it`);
        if (!out.some(([x, y]) => x === c && y === r)) out.push([c, r]);
      }
    }
    return out;
  });

  const solid = new Uint8Array(wall);
  const walls = computeHeights({ w, h, floor, wall, doorRoom, boss, rooms: def.rooms, viewMask });
  const top = new Float32Array(n);
  for (let i = 0; i < n; i++) top[i] = wall[i] ? walls.height[i] : floor[i];

  return {
    id: def.id, name: def.name, w, h, floor, wall, doorRoom, roomOf, hazard, viewMask, solid, top, heights: walls, spawns,
    roomSpawnPoints, roomSquadPoints, boss, decorations, rooms: def.rooms, gate: def.gate ?? null,
  };
}

/** The snapshot header's room fields every leaf derives from (rogue game.md §3.4, §14.3). */
export interface LeafState {
  /** The room in countdown or combat, 255 for none. */
  activeRoom: number;
  activePhase: number;
  /** Bit i: room i is cleared. */
  clearedMask: number;
}

/** Whether room `i` is cleared in the mask; -1 (outside every room) counts as cleared. */
export function roomCleared(clearedMask: number, i: number): boolean {
  return i < 0 || ((clearedMask >>> i) & 1) === 1;
}

/**
 * The leaf rule (rogue game.md §3.4): room `r`'s leaf is open iff the room isn't in combat and either
 * it or the room on the leaf's other side is cleared.
 */
export function leafOpen(r: number, leaf: Pick<RoomLeaf, 'to'>, activeRoom: number, activePhase: number, clearedMask: number): boolean {
  if (r === activeRoom && activePhase === PHASE_COMBAT) return false;
  return roomCleared(clearedMask, r) || roomCleared(clearedMask, leaf.to);
}

/** Sets every leaf's cells open or closed from the header's room fields; host and clients call it alike. */
export function applyLeaves(map: GameMap, st: LeafState): void {
  map.rooms.forEach((room, ri) => {
    for (const leaf of room.leaves) setLeafCells(map, leaf.cells, !leafOpen(ri, leaf, st.activeRoom, st.activePhase, st.clearedMask));
  });
}

/** Opens or closes the given door cells. */
export function setLeafCells(map: GameMap, cells: ReadonlyArray<[number, number]>, closed: boolean): void {
  for (const [c, r] of cells) {
    const i = r * map.w + c;
    map.solid[i] = closed ? 1 : 0;
    map.top[i] = closed ? map.heights.height[i] : map.floor[i];
  }
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

/** Whether the position is inside the room's rect (§8.2). */
export function insideRect(a: Pick<RoomDef, 'rect'>, x: number, y: number): boolean {
  return x >= a.rect.x0 && x < a.rect.x1 + 1 && y >= a.rect.y0 && y < a.rect.y1 + 1;
}
