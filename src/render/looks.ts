/**
 * Where each surface look goes (M10 §5.1): floor runners and medallions, the walls' decorated band of
 * alternating window and pilaster segments, the cornice. Deterministic, from the level data only, so
 * every client builds the same world.
 */
import { K_DOOR, K_FLOOR, K_WALL } from '../sim/heights';
import type { GameMap } from '../sim/map';

/** Layers of the terrain's texture array (M10 §5.1). */
export const L_FLOOR = 0;
export const L_FLOOR_PLAIN = 1;
export const L_MEDALLION = 2;
export const L_RISER = 3;
export const L_WALL = 4;
export const L_WINDOW = 5;
export const L_PILASTER = 6;
export const L_CORNICE = 7;
export const L_ARCADE_LOWER = 8;
export const L_ARCADE_UPPER = 9;

/** Every tiling texture covers this many meters. */
export const TILE = 4;
/**
 * The frieze at the foot of tex-wall, tex-wall-window and tex-wall-pilaster: their bottom rows from
 * the gold line above the carved band, measured in the prepared images (1 786 of 2 048 px down).
 */
export const FRIEZE_V = (2048 - 1786) / 2048;
export const FRIEZE = FRIEZE_V * TILE;
/** The decorated band reaches the cornice's underside, but at most this far above its floor. */
export const BAND_MAX = 7.5;
/** The cornice band along the top of every wall that looks onto floor. */
export const CORNICE = 1.5;
/**
 * The cornice's crown (M10 §5.3): the band's top part down to the gold line under its dentils, rows
 * 1-418 of the 1 308 px band in the prepared tex-cornice.
 */
export const CORNICE_CROWN = (418 / 1308) * CORNICE;

/** The top of the decorated band on a wall face looking onto floor `floor`, whose wall top is `top`. */
export function bandTop(floor: number, top: number): number {
  return Math.min(top - CORNICE, floor + BAND_MAX);
}

/** A horizontal piece of a wall face, in one layer, with v linear from its foot to its top. */
export interface WallPiece {
  z0: number;
  z1: number;
  layer: number;
  v0: number;
  v1: number;
}

/**
 * The pieces of a wall face from z0 to z1 that looks onto floor `floor`, on a wall `top` high, with the
 * band's look `band` (M10 §5.1): one tile of the band, its frieze rows at 1:1 and the rest stretched up
 * to the band's top; `above` (tex-wall; a pillar's pilaster) at 1:1 from there, only where the band
 * was capped at BAND_MAX; the cornice along the top CORNICE meters.
 */
export function wallPieces(z0: number, z1: number, floor: number, top: number, band: number, above = L_WALL): WallPiece[] {
  const b = bandTop(floor, top);
  const fr = floor + FRIEZE;
  const cb = top - CORNICE;
  const out: WallPiece[] = [];
  const add = (lo: number, hi: number, layer: number, v: (z: number) => number) => {
    const a = Math.max(lo, z0);
    const c = Math.min(hi, z1);
    if (c > a + 1e-6) out.push({ z0: a, z1: c, layer, v0: v(a), v1: v(c) });
  };
  add(-Infinity, fr, band, (z) => (z - floor) / TILE);
  add(fr, b, band, (z) => FRIEZE_V + ((z - fr) / (b - fr)) * (1 - FRIEZE_V));
  add(b, cb, above, (z) => (z - b) / TILE);
  add(cb, Infinity, L_CORNICE, (z) => (z - cb) / CORNICE);
  return out;
}

export interface FloorLooks {
  /** Per cell: L_FLOOR (a runner), L_FLOOR_PLAIN or L_MEDALLION. */
  layer: Uint8Array;
  /** Medallion blocks: their top-left cells (4 × 4 cells). */
  medallions: Array<[number, number]>;
  /** Per cell: the index of its medallion, or -1. */
  medallionOf: Int32Array;
  /** Runners: 4 m strips aligned to the 4 m grid, along x (rows r0..r0+3) or y (columns c0..c0+3), per zone. */
  runners: Array<{ zone: number; axis: 'x' | 'y'; from: number }>;
}

/** Floor looks (M10 §5.1): plain everywhere, tex-floor runners, medallions at arena centers and doors. */
export function floorLooks(map: GameMap): FloorLooks {
  const { w, h } = map;
  const hz = map.heights;
  const isFloorCell = (c: number, r: number) => c >= 0 && r >= 0 && c < w && r < h && (hz.kind[r * w + c] === K_FLOOR || hz.kind[r * w + c] === K_DOOR);
  /** A medallion block: corners on even coordinates, 16 floor cells at one height, no door cell. */
  const valid = (c0: number, r0: number): boolean => {
    if (c0 % 2 !== 0 || r0 % 2 !== 0 || c0 < 0 || r0 < 0 || c0 + 4 > w || r0 + 4 > h) return false;
    const f = map.floor[r0 * w + c0];
    for (let r = r0; r < r0 + 4; r++) for (let c = c0; c < c0 + 4; c++) if (hz.kind[r * w + c] !== K_FLOOR || map.floor[r * w + c] !== f) return false;
    return true;
  };
  const medallions: Array<[number, number]> = [];
  const overlaps = (c0: number, r0: number) => medallions.some(([c, r]) => Math.abs(c - c0) < 4 && Math.abs(r - r0) < 4);
  const runners: FloorLooks['runners'] = [];

  map.arenas.forEach((a, ai) => {
    const inRect = (c0: number, r0: number) => c0 >= a.rect.x0 && r0 >= a.rect.y0 && c0 + 3 <= a.rect.x1 && r0 + 3 <= a.rect.y1;
    const cx = (a.rect.x0 + a.rect.x1 + 1) / 2;
    const cy = (a.rect.y0 + a.rect.y1 + 1) / 2;
    // The center medallion: on the 4 m grid, so the runners through it line up with it.
    let best: [number, number] | null = null;
    let bestD = 6 + 1e-9;
    for (let r0 = a.rect.y0; r0 <= a.rect.y1; r0++) {
      for (let c0 = a.rect.x0; c0 <= a.rect.x1; c0++) {
        if (c0 % 4 !== 0 || r0 % 4 !== 0 || !inRect(c0, r0) || !valid(c0, r0)) continue;
        const d = Math.hypot(c0 + 2 - cx, r0 + 2 - cy);
        if (d < bestD - 1e-9) {
          bestD = d;
          best = [c0, r0];
        }
      }
    }
    if (best) medallions.push(best);
    const rowFrom = best ? best[1] : Math.round((cy - 2) / 4) * 4;
    const colFrom = best ? best[0] : Math.round((cx - 2) / 4) * 4;
    runners.push({ zone: ai, axis: 'x', from: rowFrom }, { zone: ai, axis: 'y', from: colFrom });

    // One in front of each door, inside the arena, touching the cells next to the door.
    for (const door of [a.doors, a.exitDoors ?? []]) {
      if (door.length === 0) continue;
      const next = new Set<number>();
      for (const [c, r] of door) {
        for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nc = c + dc;
          const nr = r + dr;
          if (nc >= a.rect.x0 && nc <= a.rect.x1 && nr >= a.rect.y0 && nr <= a.rect.y1 && isFloorCell(nc, nr)) next.add(nr * w + nc);
        }
      }
      const mx = door.reduce((s, [c]) => s + c + 0.5, 0) / door.length;
      const my = door.reduce((s, [, r]) => s + r + 0.5, 0) / door.length;
      let pick: [number, number] | null = null;
      let pickD = Infinity;
      for (let r0 = a.rect.y0; r0 <= a.rect.y1; r0++) {
        for (let c0 = a.rect.x0; c0 <= a.rect.x1; c0++) {
          if (!inRect(c0, r0) || !valid(c0, r0) || overlaps(c0, r0)) continue;
          let touches = false;
          for (let r = r0; r < r0 + 4 && !touches; r++) for (let c = c0; c < c0 + 4 && !touches; c++) touches = next.has(r * w + c);
          if (!touches) continue;
          const d = Math.hypot(c0 + 2 - mx, r0 + 2 - my);
          if (d < pickD - 1e-9) {
            pickD = d;
            pick = [c0, r0];
          }
        }
      }
      if (pick) medallions.push(pick);
    }
  });

  // The Lobby and each corridor: one runner along its long axis, through its middle.
  for (let z = map.arenas.length; z < hz.zoneCount; z++) {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (let i = 0; i < w * h; i++) {
      if (hz.zone[i] !== z) continue;
      const c = i % w;
      const r = (i - c) / w;
      x0 = Math.min(x0, c);
      x1 = Math.max(x1, c);
      y0 = Math.min(y0, r);
      y1 = Math.max(y1, r);
    }
    if (x1 - x0 >= y1 - y0) runners.push({ zone: z, axis: 'x', from: Math.round(((y0 + y1 + 1) / 2 - 2) / 4) * 4 });
    else runners.push({ zone: z, axis: 'y', from: Math.round(((x0 + x1 + 1) / 2 - 2) / 4) * 4 });
  }

  const layer = new Uint8Array(w * h).fill(L_FLOOR_PLAIN);
  for (let i = 0; i < w * h; i++) {
    if (!isFloorCell(i % w, Math.floor(i / w))) continue;
    const c = i % w;
    const r = (i - c) / w;
    for (const run of runners) {
      if (run.zone !== hz.zone[i]) continue;
      const along = run.axis === 'x' ? r : c;
      if (along >= run.from && along < run.from + 4) layer[i] = L_FLOOR;
    }
  }
  const medallionOf = new Int32Array(w * h).fill(-1);
  medallions.forEach(([c0, r0], k) => {
    for (let r = r0; r < r0 + 4; r++) {
      for (let c = c0; c < c0 + 4; c++) {
        layer[r * w + c] = L_MEDALLION;
        medallionOf[r * w + c] = k;
      }
    }
  });
  return { layer, medallions, medallionOf, runners };
}

/**
 * The band's look for the 4 m wall segment (aligned to world coordinates) holding wall cell (c, r),
 * on its face with normal (dx, dy), toward the floor: window and pilaster alternate; a segment that isn't 4 whole wall cells whose faces all
 * look onto floor at one height (cut by a corner or a door, beside stairs) is plain.
 */
export function segmentLook(map: GameMap, c: number, r: number, dx: number, dy: number): number {
  const { w, h } = map;
  const hz = map.heights;
  const alongX = dy !== 0;
  const k = Math.floor((alongX ? c : r) / TILE);
  let floor = NaN;
  for (let j = 0; j < TILE; j++) {
    const cc = alongX ? k * TILE + j : c;
    const rr = alongX ? r : k * TILE + j;
    const fc = cc + dx;
    const fr = rr + dy;
    if (cc < 0 || rr < 0 || cc >= w || rr >= h || fc < 0 || fr < 0 || fc >= w || fr >= h) return L_WALL;
    if (hz.kind[rr * w + cc] !== K_WALL || hz.kind[fr * w + fc] !== K_FLOOR) return L_WALL;
    const f = map.floor[fr * w + fc];
    if (j === 0) floor = f;
    else if (f !== floor) return L_WALL;
  }
  return k % 2 === 0 ? L_WINDOW : L_PILASTER;
}
