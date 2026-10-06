/**
 * Arches (M10 §6): every open edge is an arcade of painted cut-out bays with real stone reveals, and
 * every door gets a pointed doorway arch. Drawn only; nothing in play is behind or under them. The
 * painted faces go into one cut-out mesh, the reveals, sills and solid parts into the terrain mesh.
 */
import type { Bay } from '../sim/heights';
import { HEADROOM, K_DOOR, K_FLOOR, PARAPET } from '../sim/heights';
import type { GameMap } from '../sim/map';
import { ARCH_OPENING } from './arch.gen';
import { CORNICE, TILE } from './looks';

/** How deep an arch's stone is: the arcades' reveal, and the doorway arches' thickness. */
export const REVEAL = 0.6;
/** A bay is this tall (its painting covers base to base + BAY_H). */
export const BAY_H = 8;
/** The ledge behind an arcade's balustrade, above its base. */
export const LEDGE = 0.2;
/** Pier strips at the arcades' joints are this wide. */
export const PIER_STRIP = 0.6;

/** The opening's outline in bay meters, as a closed polygon (the rail closes it). */
export const OPENING: ReadonlyArray<readonly [number, number]> = ARCH_OPENING;

/** The opening's x range at height z (bay meters), or null above the apex. */
export function openingAt(z: number): [number, number] | null {
  const half = OPENING.length >> 1;
  // The left side runs from the rail up to the apex (index half).
  for (let i = 0; i < half; i++) {
    const [x0, z0] = OPENING[i];
    const [x1, z1] = OPENING[i + 1];
    if (z >= z0 - 1e-9 && z <= z1 + 1e-9) {
      const x = z1 - z0 < 1e-9 ? Math.min(x0, x1) : x0 + ((x1 - x0) * (z - z0)) / (z1 - z0);
      return [x, 4 - x];
    }
  }
  return null;
}

/** Whether (x, z) in bay meters is inside the opening (above the rail, under the arch). */
export function inOpening(x: number, z: number): boolean {
  if (z < OPENING[0][1]) return false;
  const r = openingAt(z);
  return !!r && x > r[0] && x < r[1];
}

/** An arcade bay as drawn: its face plane and range, its base and the arcade's height. */
export interface ArcadeBay {
  bay: Bay;
  /** The face's normal toward the floor (the bay's outward direction reversed). */
  nx: number;
  ny: number;
  /** The face's plane (x for ±x faces, y for ±y), on the cells' inner edge. */
  plane: number;
  /** Along the face: a0 to a0 + 4. */
  a0: number;
  base: number;
  /** The arcade's height H; the painted face stops at its cornice's underside. */
  top: number;
  /** The painted face's top: base + 8, or the cornice's underside if lower. */
  faceTop: number;
}

/** A doorway arch (M10 §6.2). */
export interface DoorArch {
  /** The arch's center plane through the middle of the door cells, and its normal (the passage). */
  nx: number;
  ny: number;
  plane: number;
  /** The passage across: a0 to a1 along the plane. */
  a0: number;
  a1: number;
  /** The opening's bottom: the highest floor among the door cells and their neighbors, + HEADROOM. */
  L: number;
  /** The arch's top (with its cornice): the higher of L + 4 and the door's height. */
  A: number;
  /** The painted face's top: L + 4, or the cornice's underside if lower. */
  faceTop: number;
}

/** The opening's x range at the top of arcade-lower (bay z = 4 m): the doorway arch's crop. */
export const DOOR_CROP: [number, number] = openingAt(4)!;

export interface Arches {
  bays: ArcadeBay[];
  doors: DoorArch[];
}

/** Computes the arcades' bays and the doorway arches. Deterministic. */
export function computeArches(map: GameMap): Arches {
  const { w, h } = map;
  const hz = map.heights;
  const bays: ArcadeBay[] = hz.bays.map((bay) => {
    const [c, r] = bay.cells[0];
    const nx = -bay.ox;
    const ny = -bay.oy;
    const plane = ny !== 0 ? (ny > 0 ? r + 1 : r) : nx > 0 ? c + 1 : c;
    const a0 = ny !== 0 ? c : r;
    return { bay, nx, ny, plane, a0, base: bay.base, top: bay.top, faceTop: Math.min(bay.base + BAY_H, bay.top - CORNICE) };
  });

  const doors: DoorArch[] = [];
  for (const a of map.arenas) {
    for (const cells of [a.doors, a.exitDoors ?? []]) {
      if (cells.length === 0) continue;
      const xs = cells.map(([c]) => c);
      const ys = cells.map(([, r]) => r);
      const alongY = Math.min(...xs) === Math.max(...xs);
      let L = -Infinity;
      let doorTop = -Infinity;
      for (const [c, r] of cells) {
        doorTop = Math.max(doorTop, hz.height[r * w + c]);
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const cc = c + dc;
            const rr = r + dr;
            if (cc < 0 || rr < 0 || cc >= w || rr >= h) continue;
            const k = hz.kind[rr * w + cc];
            if (k === K_FLOOR || k === K_DOOR) L = Math.max(L, map.floor[rr * w + cc]);
          }
        }
      }
      L += HEADROOM;
      const A = Math.max(L + 4, doorTop);
      doors.push({
        nx: alongY ? 1 : 0,
        ny: alongY ? 0 : 1,
        plane: alongY ? xs[0] + 0.5 : ys[0] + 0.5,
        a0: alongY ? Math.min(...ys) : Math.min(...xs),
        a1: alongY ? Math.max(...ys) + 1 : Math.max(...xs) + 1,
        L,
        A,
        faceTop: Math.min(L + 4, A - CORNICE),
      });
    }
  }
  return { bays, doors };
}

/** A point in front of (d > 0, toward the face's normal) or behind a face, in map coordinates. */
export function atFace(f: { nx: number; ny: number; plane: number }, along: number, d: number, z: number): number[] {
  return f.ny !== 0 ? [along, f.plane + d * f.ny, z] : [f.plane + d * f.nx, along, z];
}

/** The doorway arch's x in bay meters for a point `along` its passage. */
export function doorBayX(d: DoorArch, along: number): number {
  return DOOR_CROP[0] + ((along - d.a0) / (d.a1 - d.a0)) * (DOOR_CROP[1] - DOOR_CROP[0]);
}

/**
 * Whether the arches block a ray from (x, y, z) along (dx, dy, dz) before `maxT` (M10 §5.2, §6): an
 * opaque part of a bay's painted face (outside the opening, or above the painting), a bay's reveal
 * (a ray through the face's opening that leaves it through the reveal), or a doorway arch's stone.
 * The parapets below the rails are cells, tested by the heightfield.
 */
export function archesBlock(arches: Arches, x: number, y: number, z: number, dx: number, dy: number, dz: number, maxT: number): boolean {
  for (const b of arches.bays) {
    // The ray must run outward through the face: against its normal.
    const dn = dx * b.nx + dy * b.ny;
    if (dn >= -1e-9) continue;
    const pAxis = b.ny !== 0 ? y : x;
    const dAxis = b.ny !== 0 ? dy : dx;
    const t = (b.plane - pAxis) / dAxis;
    if (t <= 0 || t > maxT) continue;
    const along = (b.ny !== 0 ? x : y) + (b.ny !== 0 ? dx : dy) * t;
    const zz = z + dz * t;
    if (along < b.a0 || along > b.a0 + 4 || zz < b.base || zz > b.top) continue;
    const bx = along - b.a0;
    const bz = zz - b.base;
    if (zz >= b.faceTop || !inOpening(bx, bz)) {
      // Opaque stone above the rail; below it, the parapet cell already blocks.
      if (bz >= PARAPET) return true;
      continue;
    }
    // Through the opening: it must leave the reveal's outer end inside the opening too.
    const t2 = t + REVEAL / -dn;
    const along2 = along + (b.ny !== 0 ? dx : dy) * (t2 - t);
    const z2 = zz + dz * (t2 - t);
    if (!inOpening(along2 - b.a0, z2 - b.base)) return true;
  }
  for (const d of arches.doors) {
    // Both painted faces, REVEAL apart: blocked unless the ray passes the opening at both.
    const pAxis = d.ny !== 0 ? y : x;
    const dAxis = d.ny !== 0 ? dy : dx;
    if (Math.abs(dAxis) < 1e-9) continue;
    let blocked = false;
    let crossed = false;
    for (const off of [-REVEAL / 2, REVEAL / 2]) {
      const t = (d.plane + off - pAxis) / dAxis;
      if (t <= 0 || t > maxT) continue;
      const along = (d.ny !== 0 ? x : y) + (d.ny !== 0 ? dx : dy) * t;
      const zz = z + dz * t;
      if (along < d.a0 || along > d.a1 || zz < d.L || zz > d.A) continue;
      crossed = true;
      if (zz >= d.faceTop || !inOpening(doorBayX(d, along), 4 + zz - d.L)) blocked = true;
    }
    if (crossed && blocked) return true;
  }
  return false;
}

/** Whether (along, z) on a doorway arch's face is in its opening. */
export function inDoorOpening(d: DoorArch, along: number, z: number): boolean {
  return z < d.L || (z < d.faceTop && inOpening(doorBayX(d, along), 4 + z - d.L));
}

/** A face's u for a point along a bay. */
export function bayU(b: ArcadeBay, along: number): number {
  return (along - b.a0) / TILE;
}

/** What the arches' geometry is emitted into (the terrain's builder, or the cut-out mesh's). */
export interface ArchBuilder {
  rgb: [number, number, number];
  shadowAt: ((x: number, y: number) => number) | null;
  isFloor: number;
  quad(corners: number[][], uvs: number[][], shade: number | number[], normal: [number, number, number], layer: number): void;
}

export interface ArchLight {
  faceColor(nx: number, ny: number, deep?: boolean): [number, number, number];
  facesSun(nx: number, ny: number): boolean;
  shadowZ(x: number, y: number, nx: number, ny: number, foot: number, top: number): number;
}

export interface ArchLayers {
  lower: number;
  upper: number;
  wall: number;
  riser: number;
  cornice: number;
}

/** A face's shadow line, cached per point (M10 §5.2), or none for faces turned away from the sun. */
function sunLine(light: ArchLight, nx: number, ny: number, foot: number, top: number): ((x: number, y: number) => number) | null {
  if (!light.facesSun(nx, ny)) return null;
  const cache = new Map<string, number>();
  return (x, y) => {
    const key = `${x.toFixed(3)},${y.toFixed(3)}`;
    let z = cache.get(key);
    if (z === undefined) {
      z = light.shadowZ(x, y, nx, ny, foot, top);
      cache.set(key, z);
    }
    return z;
  };
}

/** A vertical quad on a face (d from it) from along a0 to a1 and z0 to z1. */
function faceQuad(g: ArchBuilder, f: { nx: number; ny: number; plane: number }, d: number, a0: number, a1: number, z0: number, z1: number, uv: number[], normal: [number, number, number], layer: number): void {
  const [u0, v0, u1, v1] = uv;
  g.quad([atFace(f, a0, d, z0), atFace(f, a1, d, z0), atFace(f, a1, d, z1), atFace(f, a0, d, z1)], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], 1, normal, layer);
}

/**
 * The painted faces (the cut-out mesh): each bay's arcade-lower and arcade-upper, cropped at the
 * cornice's underside, in 1 m columns for the shadow lines; each doorway arch's two faces of
 * arcade-upper cropped to the opening's width at its bottom row and stretched to the passage.
 */
export function emitPaintedFaces(g: ArchBuilder, arches: Arches, light: ArchLight, layers: ArchLayers): void {
  g.isFloor = 0;
  for (const b of arches.bays) {
    const n: [number, number, number] = [b.nx, b.ny, 0];
    g.rgb = light.faceColor(b.nx, b.ny);
    g.shadowAt = sunLine(light, b.nx, b.ny, b.base, b.top);
    const pieces: Array<[number, number, number, number]> = [
      [b.base, b.base + 4, layers.lower, 1],
      [b.base + 4, b.faceTop, layers.upper, (b.faceTop - b.base - 4) / 4],
    ];
    for (const [z0, z1, layer, v1] of pieces) {
      if (z1 <= z0 + 1e-6) continue;
      for (let m = 0; m < 4; m++) faceQuad(g, b, 0, b.a0 + m, b.a0 + m + 1, z0, z1, [m / 4, 0, (m + 1) / 4, v1], n, layer);
    }
  }
  for (const d of arches.doors) {
    const v1 = (d.faceTop - d.L) / 4;
    for (const s of [-1, 1]) {
      const f = { nx: d.nx * s, ny: d.ny * s, plane: d.plane };
      g.rgb = light.faceColor(f.nx, f.ny);
      g.shadowAt = null;
      faceQuad(g, f, REVEAL / 2, d.a0, d.a1, d.L, d.faceTop, [DOOR_CROP[0] / TILE, 0, DOOR_CROP[1] / TILE, v1], [f.nx, f.ny, 0], layers.upper);
    }
  }
  g.shadowAt = null;
}

/**
 * The arches' stone (the terrain mesh): each bay's reveal (the opening's outline extruded REVEAL
 * outward), its sill at the rail, the solid wall above the painting and the cornice band; each
 * doorway arch's reveal between its faces, the solid wall above its painting, its cornice band, and
 * closed ends where it rises above the walls beside it.
 */
export function emitArchStone(g: ArchBuilder, map: GameMap, arches: Arches, light: ArchLight, layers: ArchLayers): void {
  g.isFloor = 0;
  /** A reveal along a polyline of (along, z) points, between faces d0 and d1, facing into the opening
   * (going up the left side, the opening is on the right). */
  const reveal = (f: { nx: number; ny: number; plane: number }, pts: Array<[number, number]>, d0: number, d1: number) => {
    const [tx, ty] = f.ny !== 0 ? [1, 0] : [0, 1];
    let u = 0;
    for (let i = 0; i + 1 < pts.length; i++) {
      const [a0, z0] = pts[i];
      const [a1, z1] = pts[i + 1];
      const len = Math.hypot(a1 - a0, z1 - z0);
      if (len < 1e-6) continue;
      const normal: [number, number, number] = [(z1 - z0) * tx, (z1 - z0) * ty, -(a1 - a0)];
      g.quad(
        [atFace(f, a0, d0, z0), atFace(f, a1, d0, z1), atFace(f, a1, d1, z1), atFace(f, a0, d1, z0)],
        [[u / TILE, 0], [(u + len) / TILE, 0], [(u + len) / TILE, REVEAL / TILE], [u / TILE, REVEAL / TILE]],
        1,
        normal,
        layers.wall,
      );
      u += len;
    }
  };

  for (const b of arches.bays) {
    g.rgb = light.faceColor(b.nx, b.ny, true);
    g.shadowAt = null;
    reveal(b, OPENING.map(([x, z]) => [b.a0 + x, b.base + z]), 0, -REVEAL);
    // The sill: the rail's top, REVEAL deep.
    const sz = b.base + OPENING[0][1];
    const sill = [atFace(b, b.a0 + OPENING[0][0], 0, sz), atFace(b, b.a0 + OPENING[OPENING.length - 1][0], 0, sz), atFace(b, b.a0 + OPENING[OPENING.length - 1][0], -REVEAL, sz), atFace(b, b.a0 + OPENING[0][0], -REVEAL, sz)];
    g.rgb = [1, 1, 1];
    g.quad(sill, sill.map((p) => [p[0] / TILE, p[1] / TILE]), 1, [0, 0, 1], layers.riser);
    // Above the painting: solid wall up to the cornice, then the cornice band.
    const n: [number, number, number] = [b.nx, b.ny, 0];
    g.rgb = light.faceColor(b.nx, b.ny);
    g.shadowAt = sunLine(light, b.nx, b.ny, b.base, b.top);
    const cb = b.top - CORNICE;
    const a1 = b.a0 + 4;
    if (cb > b.base + BAY_H + 1e-6) faceQuad(g, b, 0, b.a0, a1, b.base + BAY_H, cb, [b.a0 / TILE, (b.base + BAY_H) / TILE, a1 / TILE, cb / TILE], n, layers.wall);
    faceQuad(g, b, 0, b.a0, a1, cb, b.top, [b.a0 / TILE, 0, a1 / TILE, 1], n, layers.cornice);
  }

  const { w } = map;
  for (const d of arches.doors) {
    const [tx, ty] = d.ny !== 0 ? [1, 0] : [0, 1];
    const crop = DOOR_CROP[1] - DOOR_CROP[0];
    const alongOf = (x: number) => d.a0 + ((x - DOOR_CROP[0]) / crop) * (d.a1 - d.a0);
    // The reveal between the two faces, along the opening above L (bay z from 4 up).
    const pts: Array<[number, number]> = [[DOOR_CROP[0], 4]];
    for (const p of OPENING) if (p[1] > 4 + 1e-6) pts.push([p[0], p[1]]);
    pts.push([DOOR_CROP[1], 4]);
    g.rgb = light.faceColor(d.nx, d.ny, true);
    g.shadowAt = null;
    reveal(d, pts.map(([x, z]) => [alongOf(x), d.L + z - 4]), -REVEAL / 2, REVEAL / 2);
    // Each face: solid wall above the painting up to the cornice, and the cornice band.
    const cb = d.A - CORNICE;
    for (const s of [-1, 1]) {
      const f = { nx: d.nx * s, ny: d.ny * s, plane: d.plane };
      const n: [number, number, number] = [f.nx, f.ny, 0];
      g.rgb = light.faceColor(f.nx, f.ny);
      if (cb > d.L + 4 + 1e-6) faceQuad(g, f, REVEAL / 2, d.a0, d.a1, d.L + 4, cb, [d.a0 / TILE, (d.L + 4) / TILE, d.a1 / TILE, cb / TILE], n, layers.wall);
      faceQuad(g, f, REVEAL / 2, d.a0, d.a1, cb, d.A, [d.a0 / TILE, 0, d.a1 / TILE, 1], n, layers.cornice);
    }
    // The top, and the ends where the arch rises above the walls beside it.
    g.rgb = [1, 1, 1];
    const topPts = [atFace(d, d.a0, -REVEAL / 2, d.A), atFace(d, d.a1, -REVEAL / 2, d.A), atFace(d, d.a1, REVEAL / 2, d.A), atFace(d, d.a0, REVEAL / 2, d.A)];
    g.quad(topPts, topPts.map((p) => [p[0] / TILE, p[1] / TILE]), 1, [0, 0, 1], layers.wall);
    for (const [a, s] of [[d.a0, -1], [d.a1, 1]] as const) {
      const ca = Math.floor(a + 0.5 * s);
      const cp = Math.floor(d.plane);
      const wallTop = d.ny !== 0 ? map.heights.height[cp * w + ca] : map.heights.height[ca * w + cp];
      if (!(d.A > wallTop + 1e-6)) continue;
      const z0 = Math.max(wallTop, d.L);
      const zc = Math.max(z0, cb);
      const n: [number, number, number] = [tx * s, ty * s, 0];
      g.rgb = light.faceColor(tx * s, ty * s);
      const corner = (dd: number, zz: number) => atFace(d, a, dd, zz);
      if (zc > z0 + 1e-6) g.quad([corner(-REVEAL / 2, z0), corner(REVEAL / 2, z0), corner(REVEAL / 2, zc), corner(-REVEAL / 2, zc)], [[0, z0 / TILE], [REVEAL / TILE, z0 / TILE], [REVEAL / TILE, zc / TILE], [0, zc / TILE]], 1, n, layers.wall);
      g.quad([corner(-REVEAL / 2, zc), corner(REVEAL / 2, zc), corner(REVEAL / 2, d.A), corner(-REVEAL / 2, d.A)], [[0, (zc - cb) / CORNICE], [REVEAL / TILE, (zc - cb) / CORNICE], [REVEAL / TILE, 1], [0, 1]], 1, n, layers.cornice);
    }
  }
  g.shadowAt = null;
}

/**
 * Where a hitscan shot first crosses painted stone (M10 §6.1): a bay's or doorway arch's face above
 * the rail but outside the opening (a pier, a spandrel, the stone above). The simulation flies on;
 * the client ends the tracer there. Returns the distance, or Infinity.
 */
export function archStoneHit(arches: Arches, x: number, y: number, z: number, dx: number, dy: number, dz: number, maxT: number): number {
  let best = Infinity;
  for (const b of arches.bays) {
    const pAxis = b.ny !== 0 ? y : x;
    const dAxis = b.ny !== 0 ? dy : dx;
    if (Math.abs(dAxis) < 1e-9) continue;
    const t = (b.plane - pAxis) / dAxis;
    if (t <= 0 || t > maxT || t >= best) continue;
    const along = (b.ny !== 0 ? x : y) + (b.ny !== 0 ? dx : dy) * t;
    const zz = z + dz * t;
    if (along < b.a0 || along > b.a0 + 4 || zz > b.top) continue;
    const bz = zz - b.base;
    if (bz < PARAPET) continue;
    if (zz >= b.faceTop || !inOpening(along - b.a0, bz)) best = t;
  }
  for (const d of arches.doors) {
    const pAxis = d.ny !== 0 ? y : x;
    const dAxis = d.ny !== 0 ? dy : dx;
    if (Math.abs(dAxis) < 1e-9) continue;
    for (const off of [-REVEAL / 2, REVEAL / 2]) {
      const t = (d.plane + off - pAxis) / dAxis;
      if (t <= 0 || t > maxT || t >= best) continue;
      const along = (d.ny !== 0 ? x : y) + (d.ny !== 0 ? dx : dy) * t;
      const zz = z + dz * t;
      if (along < d.a0 || along > d.a1 || zz > d.A) continue;
      if (!inDoorOpening(d, along, zz)) best = t;
    }
  }
  return best;
}
