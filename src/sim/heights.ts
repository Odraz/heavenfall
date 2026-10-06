/**
 * Wall heights and open edges (M10 §3): zones, zone tops, the kind and height of every wall cell, the
 * open edges where the level meets the sky, and their arcade bays. Computed from the map when it's
 * loaded, the same way on the host and every client, so the protocol doesn't change.
 */
import { CHERUB, CHERUB_HOVER, ENEMIES, GATEKEEPER, LAUNCH_HEIGHT } from '../data/enemies';
import type { ArenaDef } from '../data/dungeons/types';
import { GRAVITY, JUMP_VZ, PLAYER_EYE } from './constants';
import { SOUL_BOB, SOUL_HEIGHT, SOUL_RISE } from './souls';

/** Cell kinds (§3.2). */
export const K_FLOOR = 0;
export const K_WALL = 1;
export const K_PILLAR = 2;
export const K_OPEN = 3;
export const K_VOID = 4;
export const K_DOOR = 5;

/**
 * The highest point anything can reach above the floor, plus 0.5 m (§3.1): a player's eye at the top
 * of a jump, a Cherub's top, a launched enemy's top (walking enemies; a launched Cherub isn't drawn
 * higher, decisions M10 §3.1) and a soul's top.
 */
export const HEADROOM =
  Math.max(
    PLAYER_EYE + (JUMP_VZ * JUMP_VZ) / (2 * GRAVITY),
    CHERUB_HOVER + ENEMIES[CHERUB].height,
    LAUNCH_HEIGHT + Math.max(...ENEMIES.filter((d, t) => !d.flying && t !== GATEKEEPER).map((d) => d.height)),
    SOUL_RISE + SOUL_HEIGHT + SOUL_BOB,
  ) + 0.5;

/** No wall is lower than this above the floor it stands beside (§3.2). */
export const WALL_MIN = 8;
/** Every wall rises at least this far above the zone tops next to it, for the cornice's crown (§3.2). */
export const CROWN = 0.5;
/**
 * An open edge's parapet above its bay's base: the height of the balustrade's rail in the prepared
 * `tex-arcade` (§3.2, §6), measured by scripts/cutout.py.
 */
export const PARAPET = 1.4;
/** Open-edge candidates of different zones this close that face each other become walls (§3.3). */
const FACING_RANGE = 150;
/** Bays are this many cells wide, aligned to world coordinates (§6.1). */
export const BAY_CELLS = 4;

/** An arcade bay (§6.1): 4 open-edge cells in a row with the same outward direction. */
export interface Bay {
  /** The cells, in order of increasing x (north and south sides) or y (east and west sides). */
  cells: Array<[number, number]>;
  /** Outward direction, a unit axis vector. */
  ox: number;
  oy: number;
  /** The highest floor next to any of its cells. */
  base: number;
  /** The arcade's height, shared by the bays of one run (§3.2). */
  top: number;
}

export interface Heights {
  /** Per cell: one of the K_ kinds. Door cells are K_DOOR. */
  kind: Uint8Array;
  /** Per cell: the zone of a floor or door cell, -1 for wall cells. */
  zone: Int16Array;
  /** Per zone: the zone top (§3.1). */
  zoneTop: Float32Array;
  /** Number of zones; arenas are zones 0 to arenas.length − 1. */
  zoneCount: number;
  /**
   * Per cell: the simulation height of a wall cell (an open edge: its parapet), the closed height of a
   * door cell, −∞ for void cells, and the floor for floor cells.
   */
  height: Float32Array;
  /** Per open-edge cell: the outward direction (0, 0 elsewhere). */
  outX: Float32Array;
  outY: Float32Array;
  /** Per open-edge cell: the height the arcade or its solid segment is drawn to (§6.1). */
  openTop: Float32Array;
  bays: Bay[];
}

const DX8 = [1, -1, 0, 0, 1, 1, -1, -1];
const DY8 = [0, 0, 1, -1, 1, -1, 1, -1];
const DX4 = [1, -1, 0, 0];
const DY4 = [0, 0, 1, -1];

interface MapLike {
  w: number;
  h: number;
  floor: Float32Array;
  wall: Uint8Array;
  doorArena: Int16Array;
  boss: [number, number] | null;
  arenas: ArenaDef[];
}

/** Computes zones, wall heights, open edges and bays (§3.1–3.3). Deterministic. */
export function computeHeights(map: MapLike): Heights {
  const { w, h, floor, wall } = map;
  const n = w * h;
  const inside = (c: number, r: number) => c >= 0 && r >= 0 && c < w && r < h;
  const isFloor = (c: number, r: number) => inside(c, r) && !wall[r * w + c];

  // ---- Zones (§3.1): arenas' floor inside their rect, door cells by their arena, the rest connected.
  const zone = new Int16Array(n).fill(-1);
  map.arenas.forEach((a, ai) => {
    for (let r = a.rect.y0; r <= a.rect.y1; r++) for (let c = a.rect.x0; c <= a.rect.x1; c++) if (isFloor(c, r)) zone[r * w + c] = ai;
  });
  for (let i = 0; i < n; i++) if (map.doorArena[i] >= 0) zone[i] = map.doorArena[i];
  let zoneCount = map.arenas.length;
  for (let i = 0; i < n; i++) {
    if (wall[i] || zone[i] >= 0) continue;
    const z = zoneCount++;
    zone[i] = z;
    const stack = [i];
    while (stack.length) {
      const a = stack.pop()!;
      const ac = a % w;
      const ar = (a - ac) / w;
      for (let k = 0; k < 4; k++) {
        const bc = ac + DX4[k];
        const br = ar + DY4[k];
        if (!isFloor(bc, br)) continue;
        const b = br * w + bc;
        if (zone[b] >= 0) continue;
        zone[b] = z;
        stack.push(b);
      }
    }
  }
  const zoneTop = new Float32Array(zoneCount).fill(-Infinity);
  for (let i = 0; i < n; i++) if (zone[i] >= 0) zoneTop[zone[i]] = Math.max(zoneTop[zone[i]], floor[i] + HEADROOM);
  if (map.boss) {
    const b = map.boss[1] * w + map.boss[0];
    zoneTop[zone[b]] = Math.max(zoneTop[zone[b]], floor[b] + ENEMIES[GATEKEEPER].height + 0.5);
  }

  // Floor neighbors (8) of a cell: their zones and highest floor.
  const neighborZones = (c: number, r: number): Set<number> => {
    const s = new Set<number>();
    for (let k = 0; k < 8; k++) if (isFloor(c + DX8[k], r + DY8[k])) s.add(zone[(r + DY8[k]) * w + c + DX8[k]]);
    return s;
  };
  const neighborFloorMax = (c: number, r: number): number => {
    let m = -Infinity;
    for (let k = 0; k < 8; k++) if (isFloor(c + DX8[k], r + DY8[k])) m = Math.max(m, floor[(r + DY8[k]) * w + c + DX8[k]]);
    return m;
  };
  /** The *Wall* height of a cell (§3.2): above every neighboring zone top and WALL_MIN above its floors. */
  const wallHeight = (c: number, r: number): number => {
    let t = -Infinity;
    for (const z of neighborZones(c, r)) t = Math.max(t, zoneTop[z] + CROWN);
    return Math.max(t, neighborFloorMax(c, r) + WALL_MIN);
  };

  // ---- Kinds: floor, door, void, and the wall groups that don't touch the border (pillars).
  const kind = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const c = i % w;
    const r = (i - c) / w;
    if (map.doorArena[i] >= 0) kind[i] = K_DOOR;
    else if (!wall[i]) kind[i] = K_FLOOR;
    else kind[i] = neighborFloorMax(c, r) === -Infinity ? K_VOID : K_WALL;
  }
  const group = new Int32Array(n).fill(-1);
  const groups: number[][] = [];
  for (let i = 0; i < n; i++) {
    if (!wall[i] || group[i] >= 0) continue;
    const cells = [i];
    group[i] = groups.length;
    let border = false;
    for (let q = 0; q < cells.length; q++) {
      const a = cells[q];
      const ac = a % w;
      const ar = (a - ac) / w;
      if (ac === 0 || ar === 0 || ac === w - 1 || ar === h - 1) border = true;
      for (let k = 0; k < 4; k++) {
        const bc = ac + DX4[k];
        const br = ar + DY4[k];
        if (!inside(bc, br)) continue;
        const b = br * w + bc;
        if (!wall[b] || group[b] >= 0) continue;
        group[b] = groups.length;
        cells.push(b);
      }
    }
    groups.push(border ? [] : cells);
    if (!border) for (const a of cells) kind[a] = K_PILLAR;
  }

  // ---- Open edges (§3.3): candidates next to floor of exactly one zone, minus facing pairs.
  const outX = new Float32Array(n);
  const outY = new Float32Array(n);
  const candidates: number[] = [];
  for (let i = 0; i < n; i++) {
    if (kind[i] !== K_WALL) continue;
    const c = i % w;
    const r = (i - c) / w;
    if (neighborZones(c, r).size !== 1) continue;
    let sx = 0;
    let sy = 0;
    for (let k = 0; k < 8; k++) {
      if (!isFloor(c + DX8[k], r + DY8[k])) continue;
      sx -= DX8[k];
      sy -= DY8[k];
    }
    const len = Math.hypot(sx, sy);
    if (len < 1e-9) continue;
    outX[i] = sx / len;
    outY[i] = sy / len;
    candidates.push(i);
  }
  const candZone = (i: number) => neighborZones(i % w, Math.floor(i / w)).values().next().value as number;
  const zoneOf = new Map(candidates.map((i) => [i, candZone(i)]));
  const closed = new Set<number>();
  const inFront = (a: number, b: number) => {
    const ac = a % w;
    const ar = (a - ac) / w;
    const bc = b % w;
    const br = (b - bc) / w;
    return (bc - ac) * outX[a] + (br - ar) * outY[a] > 1e-9;
  };
  for (let x = 0; x < candidates.length; x++) {
    const a = candidates[x];
    const ac = a % w;
    const ar = (a - ac) / w;
    for (let y = x + 1; y < candidates.length; y++) {
      const b = candidates[y];
      if (zoneOf.get(a) === zoneOf.get(b)) continue;
      const bc = b % w;
      const br = (b - bc) / w;
      if (Math.hypot(bc - ac, br - ar) > FACING_RANGE) continue;
      if (inFront(a, b) && inFront(b, a)) {
        closed.add(a);
        closed.add(b);
      }
    }
  }
  for (const i of candidates) {
    if (closed.has(i)) {
      outX[i] = 0;
      outY[i] = 0;
    } else kind[i] = K_OPEN;
  }

  // ---- Bays (§6.1): 4 m segments aligned to world coordinates, all 4 cells open with one direction.
  const axisDir = (i: number): [number, number] | null => {
    const ox = Math.round(outX[i] * 1000) / 1000;
    const oy = Math.round(outY[i] * 1000) / 1000;
    if (Math.abs(ox) === 1 && oy === 0) return [ox, 0];
    if (ox === 0 && Math.abs(oy) === 1) return [0, oy];
    return null;
  };
  const sameOpen = (i: number, d: [number, number]) => {
    if (kind[i] !== K_OPEN) return false;
    const e = axisDir(i);
    return !!e && e[0] === d[0] && e[1] === d[1];
  };
  const bays: Bay[] = [];
  const bayOf = new Int32Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    if (kind[i] !== K_OPEN) continue;
    const d = axisDir(i);
    if (!d) continue;
    const c = i % w;
    const r = (i - c) / w;
    // The first cell of its segment only.
    const along = d[0] === 0 ? c : r;
    if (along % BAY_CELLS !== 0) continue;
    const cells: Array<[number, number]> = [];
    for (let k = 0; k < BAY_CELLS; k++) {
      const cc = d[0] === 0 ? c + k : c;
      const rr = d[0] === 0 ? r : r + k;
      if (!inside(cc, rr) || !sameOpen(rr * w + cc, d)) break;
      cells.push([cc, rr]);
    }
    if (cells.length < BAY_CELLS) continue;
    const base = Math.max(...cells.map(([cc, rr]) => neighborFloorMax(cc, rr)));
    for (const [cc, rr] of cells) bayOf[rr * w + cc] = bays.length;
    bays.push({ cells, ox: d[0], oy: d[1], base, top: 0 });
  }

  // ---- The height table (§3.2).
  const height = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const c = i % w;
    const r = (i - c) / w;
    switch (kind[i]) {
      case K_FLOOR:
        height[i] = floor[i];
        break;
      case K_VOID:
        height[i] = -Infinity;
        break;
      case K_OPEN:
        height[i] = (bayOf[i] >= 0 ? bays[bayOf[i]].base : neighborFloorMax(c, r)) + PARAPET;
        break;
      default:
        // Wall, pillar, door.
        height[i] = wallHeight(c, r);
    }
  }

  // ---- One height per run (§3.2), from the table's heights.
  const table = height.slice();
  // Runs of *Wall* cells with a face onto floor of one zone, in one direction.
  const runMax = new Float32Array(n).fill(-Infinity);
  for (let k = 0; k < 4; k++) {
    const fx = DX4[k];
    const fy = DY4[k];
    // A run goes along the perpendicular axis.
    const ax = fy !== 0 ? 1 : 0;
    const ay = fx !== 0 ? 1 : 0;
    const faceZone = (c: number, r: number): number => {
      if (!inside(c, r) || kind[r * w + c] !== K_WALL || !isFloor(c + fx, r + fy)) return -1;
      return zone[(r + fy) * w + c + fx];
    };
    const seen = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      if (seen[i]) continue;
      const c = i % w;
      const r = (i - c) / w;
      const z = faceZone(c, r);
      if (z < 0) continue;
      // Only from the run's first cell.
      if (faceZone(c - ax, r - ay) === z) continue;
      const cells: number[] = [];
      for (let cc = c, rr = r; faceZone(cc, rr) === z; cc += ax, rr += ay) cells.push(rr * w + cc);
      let m = -Infinity;
      for (const j of cells) m = Math.max(m, table[j]);
      for (const j of cells) {
        seen[j] = 1;
        runMax[j] = Math.max(runMax[j], m);
      }
    }
  }
  const inRun = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (kind[i] === K_WALL && runMax[i] > -Infinity) {
      height[i] = Math.max(height[i], runMax[i]);
      inRun[i] = 1;
    }
  }
  // Wall cells in no run (behind an inner corner) take the highest of their 4 neighbors.
  const evened = height.slice();
  for (let i = 0; i < n; i++) {
    if (kind[i] !== K_WALL || inRun[i]) continue;
    const c = i % w;
    const r = (i - c) / w;
    let m = height[i];
    for (let k = 0; k < 4; k++) {
      const cc = c + DX4[k];
      const rr = r + DY4[k];
      if (!inside(cc, rr)) continue;
      const j = rr * w + cc;
      if (kind[j] === K_WALL || kind[j] === K_PILLAR || kind[j] === K_DOOR) m = Math.max(m, height[j]);
    }
    evened[i] = m;
  }
  height.set(evened);
  // Every cell of a pillar group takes the group's highest.
  for (const cells of groups) {
    if (cells.length === 0) continue;
    let m = -Infinity;
    for (const i of cells) m = Math.max(m, height[i]);
    for (const i of cells) height[i] = m;
  }

  // ---- Arcade heights (§6.1): computed like a *Wall*, shared along each straight run of open edges.
  const openTop = new Float32Array(n);
  const ownTop = (i: number): number => {
    const c = i % w;
    const r = (i - c) / w;
    const base = bayOf[i] >= 0 ? bays[bayOf[i]].base : neighborFloorMax(c, r);
    let t = -Infinity;
    for (const z of neighborZones(c, r)) t = Math.max(t, zoneTop[z] + CROWN);
    return Math.max(t, base + WALL_MIN);
  };
  const openSeen = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    if (kind[i] !== K_OPEN || openSeen[i]) continue;
    const d = axisDir(i);
    if (!d) continue;
    const ax = d[0] === 0 ? 1 : 0;
    const ay = d[0] === 0 ? 0 : 1;
    const c = i % w;
    const r = (i - c) / w;
    if (inside(c - ax, r - ay) && sameOpen((r - ay) * w + c - ax, d)) continue;
    const cells: number[] = [];
    for (let cc = c, rr = r; inside(cc, rr) && sameOpen(rr * w + cc, d); cc += ax, rr += ay) cells.push(rr * w + cc);
    let m = -Infinity;
    for (const j of cells) m = Math.max(m, ownTop(j));
    for (const j of cells) {
      openSeen[j] = 1;
      openTop[j] = m;
    }
  }
  // Corner cells (a diagonal outward direction): the highest neighboring run, or their own.
  for (let i = 0; i < n; i++) {
    if (kind[i] !== K_OPEN || openSeen[i]) continue;
    const c = i % w;
    const r = (i - c) / w;
    let m = ownTop(i);
    for (let k = 0; k < 4; k++) {
      const cc = c + DX4[k];
      const rr = r + DY4[k];
      if (inside(cc, rr) && openSeen[rr * w + cc]) m = Math.max(m, openTop[rr * w + cc]);
    }
    openTop[i] = m;
  }
  for (const b of bays) b.top = openTop[b.cells[0][1] * w + b.cells[0][0]];

  return { kind, zone, zoneTop, zoneCount, height, outX, outY, openTop, bays };
}
