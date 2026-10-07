/**
 * Relief (M10 §5.3): real geometry where a flat painting would read as flat. The cornice's projecting
 * crown, pilaster strips standing RELIEF forward of the walls, and window glass set back into them.
 * Drawn only; merged into the terrain mesh. Computed from the level data, deterministically.
 */
import * as THREE from 'three';
import { K_DOOR, K_FLOOR, K_OPEN, K_PILLAR, K_VOID, K_WALL } from '../sim/heights';
import type { GameMap } from '../sim/map';
import { bandTop, CORNICE, CORNICE_CROWN, FRIEZE, FRIEZE_V, L_PILASTER, L_WINDOW, segmentLook, TILE } from './looks';
import { WINDOW_GLASS } from './window.gen';
import { computeArches, REVEAL } from './arches';

/** How far a crown projects from its wall face. */
export const CROWN_DEPTH = 0.35;
/** How far a pilaster strip stands forward of its wall (the relief limit of M10 §1). */
export const RELIEF = 0.12;
/** How far a window's glass is set back into its wall. */
export const RECESS = 0.25;
/**
 * The pilaster strip in tex-wall-pilaster: the fluted shaft and its gold edges, columns 736-1 312 of
 * the 2 048 px source (measured), centered in the tile.
 */
export const STRIP_U0 = 736 / 2048;
export const STRIP_U1 = 1312 / 2048;

/** A wall face: the cell, its outward normal (toward the lower side), and the face's line. */
interface Face {
  c: number;
  r: number;
  nx: number;
  ny: number;
}

/**
 * A crown: a box CROWN_DEPTH deep in front of a face, from `zb` to `zt`, along the face from `a0` to
 * `a1` (world coordinate along the face's axis: x for faces whose normal is ±y, y for ±x). `plane` is
 * the face's coordinate on the other axis. `capA0`/`capA1`: whether its ends are visible and closed.
 * `topA0`/`topA1`: how far its top and underside run (they stop at outer corners on ±x faces, so two
 * crowns never overlap there).
 */
export interface Crown extends Face {
  plane: number;
  a0: number;
  a1: number;
  topA0: number;
  topA1: number;
  zb: number;
  zt: number;
  capA0: boolean;
  capA1: boolean;
  /** A doorway arch's crown (M10 §6.2), above the passage rather than on a wall cell. */
  door?: boolean;
}

/** A pilaster strip: RELIEF in front of a face, from a0 to a1 along it, from z0 up to z1. */
export interface Strip extends Face {
  plane: number;
  a0: number;
  a1: number;
  z0: number;
  z1: number;
  /** The floor the face looks onto and the band's top, for the texture mapping. */
  floor: number;
  band: number;
  /** The tile's start along the face (the 4 m segment), for u. */
  tile0: number;
  /** A pier strip at an arcade's joint (M10 §5.3), on an open edge rather than a wall. */
  pier?: boolean;
}

/** A window recess: the window segment's face (4 m from a0), its band, and the glass outline. */
export interface Window extends Face {
  plane: number;
  a0: number;
  floor: number;
  band: number;
  /** The glass outline on the face, as (along, z) points, counterclockwise seen from the floor. */
  outline: Array<[number, number]>;
}

export interface Relief {
  crowns: Crown[];
  strips: Strip[];
  windows: Window[];
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/** The face's line: its coordinate across (plane) and its cell's range along. */
function faceLine(f: Face): { plane: number; a0: number; a1: number } {
  if (f.ny !== 0) return { plane: f.ny > 0 ? f.r + 1 : f.r, a0: f.c, a1: f.c + 1 };
  return { plane: f.nx > 0 ? f.c + 1 : f.c, a0: f.r, a1: f.r + 1 };
}

/** Computes every crown, strip and window recess of a map. */
export function computeRelief(map: GameMap): Relief {
  const { w, h } = map;
  const hz = map.heights;
  const kind = (c: number, r: number) => (c < 0 || r < 0 || c >= w || r >= h ? K_VOID : hz.kind[r * w + c]);
  const drawnTop = (c: number, r: number): number => {
    const k = kind(c, r);
    if (k === K_VOID) return -Infinity;
    return k === K_FLOOR || k === K_DOOR ? map.floor[r * w + c] : hz.height[r * w + c];
  };
  // Walls, pillars and the arcades (open edges, drawn up to their arcade's height, M10 §6.1).
  const crowned = (c: number, r: number) => kind(c, r) === K_WALL || kind(c, r) === K_PILLAR || kind(c, r) === K_OPEN;
  /** A crowned cell's top: its height, or an open edge's arcade height. */
  const crownTop = (c: number, r: number): number => (kind(c, r) === K_OPEN ? hz.openTop[r * w + c] : hz.height[r * w + c]);
  /** What a crown's face looks onto: as drawn, with an open edge as tall as its arcade. */
  const besideTop = (c: number, r: number): number => (kind(c, r) === K_OPEN ? hz.openTop[r * w + c] : drawnTop(c, r));
  /** Whether a crown runs on this face: a wall or pillar whose face is exposed down past the crown,
   * and doesn't look onto void (cliffs and the backs of walls get none). */
  const hasCrown = (c: number, r: number, nx: number, ny: number): boolean => {
    if (!crowned(c, r)) return false;
    const nk = kind(c + nx, r + ny);
    if (nk === K_VOID) return false;
    return besideTop(c + nx, r + ny) < crownTop(c, r) - CORNICE_CROWN - 1e-6;
  };

  const crowns: Crown[] = [];
  const strips: Strip[] = [];
  const windows: Window[] = [];
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      for (const [nx, ny] of DIRS) {
        if (!hasCrown(c, r, nx, ny)) continue;
        const top = crownTop(c, r);
        const zb = top - CORNICE_CROWN;
        const line = faceLine({ c, r, nx, ny });
        // Along the face: t = +1 toward a1, −1 toward a0.
        const tx = ny !== 0 ? 1 : 0;
        const ty = nx !== 0 ? 1 : 0;
        const end = (sgn: 1 | -1): { ext: number; cap: boolean; outer: boolean } => {
          const bc = c + tx * sgn;
          const br = r + ty * sgn;
          const bTop = besideTop(bc, br);
          // The face continues: the next cell has a crown on this side at the same height.
          if (hasCrown(bc, br, nx, ny) && Math.abs(crownTop(bc, br) - top) < 1e-6) return { ext: 0, cap: false, outer: false };
          // An inner corner: a wall stands across the end, in front of the next cell.
          const across = kind(bc + nx, br + ny);
          if (across !== K_VOID && across !== K_FLOOR && across !== K_DOOR && besideTop(bc + nx, br + ny) > zb + 1e-6) {
            const aTop = besideTop(bc + nx, br + ny);
            if (Math.abs(aTop - top) < 1e-6 && hasCrown(bc + nx, br + ny, -tx * sgn, -ty * sgn)) return { ext: -CROWN_DEPTH, cap: false, outer: false };
            return { ext: 0, cap: aTop < top - 1e-6, outer: false };
          }
          // The next cell is lower than the crown: an outer corner, the crown runs on past it.
          if (bTop < zb + 1e-6) return { ext: CROWN_DEPTH, cap: false, outer: true };
          // The next cell is taller: the crown stops against it.
          if (bTop > top - 1e-6) return { ext: 0, cap: false, outer: false };
          return { ext: 0, cap: true, outer: false };
        };
        const e0 = end(-1);
        const e1 = end(1);
        // On ±x faces the top and underside stop at outer corners; the ±y face's covers the corner.
        const topStop = nx !== 0;
        crowns.push({
          c, r, nx, ny, plane: line.plane,
          a0: line.a0 - e0.ext,
          a1: line.a1 + e1.ext,
          topA0: line.a0 - (e0.outer && topStop ? 0 : e0.ext),
          topA1: line.a1 + (e1.outer && topStop ? 0 : e1.ext),
          zb, zt: top, capA0: e0.cap, capA1: e1.cap,
        });
      }
    }
  }

  // Crowns along one straight run join into one box (fewer triangles): same face line and height,
  // touching, with no cap between them.
  crowns.sort((p, q) => p.nx - q.nx || p.ny - q.ny || p.plane - q.plane || p.zt - q.zt || p.a0 - q.a0);
  const merged: Crown[] = [];
  for (const k of crowns) {
    const last = merged[merged.length - 1];
    if (last && last.nx === k.nx && last.ny === k.ny && last.plane === k.plane && last.zt === k.zt && Math.abs(last.a1 - k.a0) < 1e-9 && Math.abs(last.topA1 - k.topA0) < 1e-9 && !last.capA1 && !k.capA0) {
      last.a1 = k.a1;
      last.topA1 = k.topA1;
      last.capA1 = k.capA1;
    } else merged.push({ ...k });
  }
  crowns.length = 0;
  crowns.push(...merged);

  // Pilaster strips and window recesses, once per decorated 4 m segment.
  const seen = new Set<string>();
  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (kind(c, r) !== K_WALL) continue;
      for (const [nx, ny] of DIRS) {
        const fk = kind(c + nx, r + ny);
        if (fk !== K_FLOOR) continue;
        const look = segmentLook(map, c, r, nx, ny);
        if (look !== L_PILASTER && look !== L_WINDOW) continue;
        const alongX = ny !== 0;
        const k = Math.floor((alongX ? c : r) / TILE);
        const key = `${alongX ? 'x' : 'y'}${alongX ? r : c}:${k}:${nx},${ny}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const floor = map.floor[(r + ny) * w + c + nx];
        const top = hz.height[r * w + c];
        const band = bandTop(floor, top);
        const plane = faceLine({ c, r, nx, ny }).plane;
        const a0 = k * TILE;
        if (look === L_PILASTER) {
          strips.push({ c, r, nx, ny, plane, a0: a0 + STRIP_U0 * TILE, a1: a0 + STRIP_U1 * TILE, z0: floor, z1: top - CORNICE, floor, band, tile0: a0 });
        } else {
          const zOf = (v: number) => floor + FRIEZE + ((v - FRIEZE_V) / (1 - FRIEZE_V)) * (band - floor - FRIEZE);
          windows.push({ c, r, nx, ny, plane, a0, floor, band, outline: WINDOW_GLASS.map(([u, v]) => [a0 + u * TILE, zOf(v)]) });
        }
      }
    }
  }
  // The doorway arches' crowns (M10 §6.2): along both faces, across the passage, capped at both ends.
  for (const d of computeArches(map).doors) {
    for (const s of [-1, 1]) {
      const nx = d.nx * s;
      const ny = d.ny * s;
      const cell = d.ny !== 0 ? [Math.floor(d.a0), Math.floor(d.plane)] : [Math.floor(d.plane), Math.floor(d.a0)];
      crowns.push({
        c: cell[0], r: cell[1], nx, ny, plane: d.plane + (REVEAL / 2) * s,
        a0: d.a0, a1: d.a1, topA0: d.a0, topA1: d.a1,
        zb: d.A - CORNICE_CROWN, zt: d.A, capA0: true, capA1: true, door: true,
      });
    }
  }

  // Pier strips on the arcades (M10 §5.3): at every joint between two bays and at both ends of each
  // run of bays, PIER_STRIP wide, from the floor beside it up to the cornice.
  const bays = [...hz.bays].sort((p, q) => p.ox - q.ox || p.oy - q.oy || (p.oy !== 0 ? p.cells[0][1] - q.cells[0][1] : p.cells[0][0] - q.cells[0][0]) || (p.oy !== 0 ? p.cells[0][0] - q.cells[0][0] : p.cells[0][1] - q.cells[0][1]));
  const joints = new Map<string, { bay: (typeof bays)[number]; j: number }>();
  for (const bay of bays) {
    const [c, r] = bay.cells[0];
    const a0 = bay.oy !== 0 ? c : r;
    for (const j of [a0, a0 + 4]) joints.set(`${bay.ox},${bay.oy},${bay.oy !== 0 ? r : c},${j}`, { bay, j });
  }
  for (const { bay, j } of joints.values()) {
    const [c0, r0] = bay.cells[0];
    const nx = -bay.ox;
    const ny = -bay.oy;
    const alongX = ny !== 0;
    const plane = faceLine({ c: c0, r: r0, nx, ny }).plane;
    // The floor beside the joint: the lower of the floors in front of the cells on either side.
    let floor = Infinity;
    for (const a of [j - 1, j]) {
      const fc = alongX ? a : c0 + nx;
      const fr = alongX ? r0 + ny : a;
      if (kind(fc, fr) === K_FLOOR || kind(fc, fr) === K_DOOR) floor = Math.min(floor, map.floor[fr * w + fc]);
    }
    if (floor === Infinity) floor = bay.base;
    const top = bay.top;
    const cell = alongX ? [Math.min(j, c0 + 3), r0] : [c0, Math.min(j, r0 + 3)];
    strips.push({
      c: cell[0], r: cell[1], nx, ny, plane,
      a0: j - PIER_HALF, a1: j + PIER_HALF,
      z0: floor, z1: top - CORNICE, floor, band: bandTop(floor, top), tile0: j - TILE / 2, pier: true,
    });
  }
  return { crowns, strips, windows };
}

/** Half a pier strip's width (0.6 m, M10 §5.3). */
const PIER_HALF = 0.3;

/** What the relief's geometry is emitted into (the terrain's builder). */
export interface ReliefBuilder {
  rgb: [number, number, number];
  shadowAt: ((x: number, y: number) => number) | null;
  isFloor: number;
  quad(corners: number[][], uvs: number[][], shade: number | number[], normal: [number, number, number], layer: number): void;
  tri(corners: number[][], uvs: number[][], normal: [number, number, number], layer: number): void;
}

/** Shading and the sun, from lightmap.ts (passed in to keep this module free of the baking). */
export interface ReliefLight {
  faceColor(nx: number, ny: number, deep?: boolean): [number, number, number];
  facesSun(nx: number, ny: number): boolean;
  shadowZ(x: number, y: number, nx: number, ny: number, foot: number, top: number): number;
}

/** A point in front of (d > 0) or behind (d < 0) a face, at `along` and height z, in map coordinates. */
function at(f: { nx: number; ny: number; plane: number }, along: number, d: number, z: number): number[] {
  return f.ny !== 0 ? [along, f.plane + d * f.ny, z] : [f.plane + d * f.nx, along, z];
}

/** Emits every crown, strip and window recess (M10 §5.3). Layers come from looks.ts. */
export function emitRelief(g: ReliefBuilder, relief: Relief, light: ReliefLight, layers: { cornice: number; riser: number; pilaster: number; window: number }): void {
  const sunLine = (f: Face, foot: number, top: number) => {
    if (!light.facesSun(f.nx, f.ny)) return null;
    const cache = new Map<string, number>();
    return (x: number, y: number) => {
      const key = `${x.toFixed(3)},${y.toFixed(3)}`;
      let z = cache.get(key);
      if (z === undefined) {
        z = light.shadowZ(x, y, f.nx, f.ny, foot, top);
        cache.set(key, z);
      }
      return z;
    };
  };
  const tAxis = (f: Face): [number, number] => (f.ny !== 0 ? [1, 0] : [0, 1]);
  g.isFloor = 0;

  // ---- Crowns: front (the cornice's top rows), top and underside, and visible end caps.
  const v0 = 1 - CORNICE_CROWN / CORNICE;
  for (const k of relief.crowns) {
    const D = CROWN_DEPTH;
    const n: [number, number, number] = [k.nx, k.ny, 0];
    g.rgb = light.faceColor(k.nx, k.ny);
    g.shadowAt = sunLine(k, k.zb, k.zt);
    g.quad([at(k, k.a0, D, k.zb), at(k, k.a1, D, k.zb), at(k, k.a1, D, k.zt), at(k, k.a0, D, k.zt)], [[k.a0 / TILE, v0], [k.a1 / TILE, v0], [k.a1 / TILE, 1], [k.a0 / TILE, 1]], 1, n, layers.cornice);
    g.shadowAt = null;
    const flat = (z: number, up: boolean) => {
      const pts = [at(k, k.topA0, 0, z), at(k, k.topA1, 0, z), at(k, k.topA1, D, z), at(k, k.topA0, D, z)];
      g.quad(pts, pts.map((p) => [p[0] / TILE, p[1] / TILE]), 1, [0, 0, up ? 1 : -1], layers.riser);
    };
    g.rgb = [1, 1, 1];
    flat(k.zt, true);
    // The underside is shaded as facing away from the sun, and darker (M10 §5.2).
    g.rgb = light.faceColor(k.nx, k.ny, true);
    flat(k.zb, false);
    const [tx, ty] = tAxis(k);
    for (const [cap, a, s] of [[k.capA0, k.a0, -1], [k.capA1, k.a1, 1]] as const) {
      if (!cap) continue;
      g.rgb = light.faceColor(tx * s, ty * s);
      g.quad([at(k, a, 0, k.zb), at(k, a, D, k.zb), at(k, a, D, k.zt), at(k, a, 0, k.zt)], [[0, 0], [D / TILE, 0], [D / TILE, CORNICE_CROWN / TILE], [0, CORNICE_CROWN / TILE]], 1, [tx * s, ty * s, 0], layers.riser);
    }
  }

  // ---- Pilaster strips: the pilaster's columns on the front, its edge columns on the sides.
  for (const s of relief.strips) {
    const D = RELIEF;
    const vAt = (z: number): number => {
      if (z <= s.floor + FRIEZE + 1e-6) return (z - s.floor) / TILE;
      if (z <= s.band + 1e-6) return FRIEZE_V + ((z - s.floor - FRIEZE) / (s.band - s.floor - FRIEZE)) * (1 - FRIEZE_V);
      return 1 + (z - s.band) / TILE;
    };
    const zs = [s.z0, s.floor + FRIEZE, s.band, s.z1].filter((z, i, a) => z >= s.z0 - 1e-6 && z <= s.z1 + 1e-6 && (i === 0 || z > a[i - 1] + 1e-6));
    const u0 = (s.a0 - s.tile0) / TILE;
    const u1 = (s.a1 - s.tile0) / TILE;
    const [tx, ty] = tAxis(s);
    for (let i = 0; i + 1 < zs.length; i++) {
      const za = zs[i];
      const zb = zs[i + 1];
      const va = vAt(za);
      const vb = vAt(zb);
      g.rgb = light.faceColor(s.nx, s.ny);
      g.shadowAt = sunLine(s, s.z0, s.z1);
      g.quad([at(s, s.a0, D, za), at(s, s.a1, D, za), at(s, s.a1, D, zb), at(s, s.a0, D, zb)], [[u0, va], [u1, va], [u1, vb], [u0, vb]], 1, [s.nx, s.ny, 0], layers.pilaster);
      // The sides: the strip's edge columns, stretched over its depth.
      for (const [a, sg, u] of [[s.a0, -1, u0], [s.a1, 1, u1]] as const) {
        g.rgb = light.faceColor(tx * sg, ty * sg);
        g.shadowAt = sunLine({ c: s.c, r: s.r, nx: tx * sg, ny: ty * sg }, s.z0, s.z1);
        const du = 0.004 * -sg;
        g.quad([at(s, a, 0, za), at(s, a, D, za), at(s, a, D, zb), at(s, a, 0, zb)], [[u + du, va], [u, va], [u, vb], [u + du, vb]], 1, [tx * sg, ty * sg, 0], layers.pilaster);
      }
    }
    g.shadowAt = null;
    g.rgb = light.faceColor(s.nx, s.ny, true);
    const capPts = [at(s, s.a0, 0, s.z1), at(s, s.a1, 0, s.z1), at(s, s.a1, D, s.z1), at(s, s.a0, D, s.z1)];
    g.quad(capPts, capPts.map((p) => [p[0] / TILE, p[1] / TILE]), 1, [0, 0, 1], layers.riser);
  }
}

/**
 * Emits the window recesses (M10 §5.3): each window segment's band (from the frieze's top to the band's
 * top) as one face with the glass outline as a hole, the glass RECESS behind it with the same UVs, and
 * the reveal joining them. The terrain leaves out its own band piece on these segments.
 */
export function emitWindows(g: ReliefBuilder, relief: Relief, light: ReliefLight, layers: { riser: number; window: number }): void {
  g.isFloor = 0;
  for (const win of relief.windows) {
    const zLo = win.floor + FRIEZE;
    const zHi = win.band;
    const vAt = (z: number) => FRIEZE_V + ((z - zLo) / (zHi - zLo)) * (1 - FRIEZE_V);
    const n: [number, number, number] = [win.nx, win.ny, 0];
    // The face's shadow line along its whole 4 m, every 1 m, straight in between (as the faces).
    const line = light.facesSun(win.nx, win.ny) ? [0, 1, 2, 3, 4].map((m) => {
      const a = win.a0 + m;
      const p = at(win, a + (m === 0 ? 0.01 : m === 4 ? -0.01 : 0), 0, 0);
      return light.shadowZ(p[0], p[1], win.nx, win.ny, win.floor, zHi + CORNICE);
    }) : null;
    const shadowAlong = (a: number) => {
      if (!line) return -1e4;
      const s = Math.min(4, Math.max(0, a - win.a0));
      const i = Math.min(3, Math.floor(s));
      return line[i] + (line[i + 1] - line[i]) * (s - i);
    };
    const alongOf = (x: number, y: number) => (win.ny !== 0 ? x : y);
    g.shadowAt = (x, y) => shadowAlong(alongOf(x, y));
    g.rgb = light.faceColor(win.nx, win.ny);
    // The face: a rectangle with points every meter along its bottom and top, minus the glass.
    const contour: THREE.Vector2[] = [];
    for (let m = 0; m <= 4; m++) contour.push(new THREE.Vector2(win.a0 + m, zLo));
    for (let m = 4; m >= 0; m--) contour.push(new THREE.Vector2(win.a0 + m, zHi));
    const hole = win.outline.map(([a, z]) => new THREE.Vector2(a, z));
    const pts = [...contour, ...hole];
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(contour, [hole])) {
      const tri = [pts[i], pts[j], pts[k]];
      g.tri(tri.map((p) => at(win, p.x, 0, p.y)), tri.map((p) => [p.x / TILE, vAt(p.y)]), n, layers.window);
    }
    // The glass, set back, showing the same part of the texture.
    for (const [i, j, k] of THREE.ShapeUtils.triangulateShape(hole, [])) {
      const tri = [hole[i], hole[j], hole[k]];
      g.tri(tri.map((p) => at(win, p.x, -RECESS, p.y)), tri.map((p) => [p.x / TILE, vAt(p.y)]), n, layers.window);
    }
    // The reveal along the outline, shaded as the inside of a window: each quad faces into the opening
    // (the outline runs counterclockwise in (along, z), so its inside is on the left).
    g.rgb = light.faceColor(win.nx, win.ny, true);
    const [tx, ty] = win.ny !== 0 ? [1, 0] : [0, 1];
    let u = 0;
    for (let m = 0; m < win.outline.length; m++) {
      const [a1, z1] = win.outline[m];
      const [a2, z2] = win.outline[(m + 1) % win.outline.length];
      const len = Math.hypot(a2 - a1, z2 - z1);
      const da = a2 - a1;
      const dz = z2 - z1;
      const normal: [number, number, number] = [-dz * tx, -dz * ty, da];
      g.quad(
        [at(win, a1, 0, z1), at(win, a2, 0, z2), at(win, a2, -RECESS, z2), at(win, a1, -RECESS, z1)],
        [[u / TILE, 0], [(u + len) / TILE, 0], [(u + len) / TILE, RECESS / TILE], [u / TILE, RECESS / TILE]],
        1,
        normal,
        layers.riser,
      );
      u += len;
    }
    g.shadowAt = null;
  }
}

/** An axis-aligned box in map coordinates. */
interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  z0: number;
  z1: number;
}

/** Where a ray enters a box, or Infinity. */
function rayBox(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, b: Box): number {
  let t0 = -Infinity;
  let t1 = Infinity;
  for (const [o, d, lo, hi] of [[ox, dx, b.x0, b.x1], [oy, dy, b.y0, b.y1], [oz, dz, b.z0, b.z1]]) {
    if (Math.abs(d) < 1e-12) {
      if (o < lo || o > hi) return Infinity;
      continue;
    }
    let a = (lo - o) / d;
    let c = (hi - o) / d;
    if (a > c) [a, c] = [c, a];
    t0 = Math.max(t0, a);
    t1 = Math.min(t1, c);
  }
  return t0 <= t1 && t1 >= 0 ? Math.max(t0, 0) : Infinity;
}

function boxOf(f: { nx: number; ny: number; plane: number }, a0: number, a1: number, d: number, z0: number, z1: number): Box {
  const p = at(f, a0, 0, z0);
  const q = at(f, a1, d, z1);
  return { x0: Math.min(p[0], q[0]), x1: Math.max(p[0], q[0]), y0: Math.min(p[1], q[1]), y1: Math.max(p[1], q[1]), z0, z1 };
}

/** Whether (a, z) is inside a polygon of (along, z) points. */
function inside(poly: Array<[number, number]>, a: number, z: number): boolean {
  let inPoly = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [ai, zi] = poly[i];
    const [aj, zj] = poly[j];
    if (zi > z !== zj > z && a < ((aj - ai) * (z - zi)) / (zj - zi) + ai) inPoly = !inPoly;
  }
  return inPoly;
}

/**
 * Moves where a shot meets a wall onto the drawn surface (M10 §5.3): the simulation stops shots at the
 * wall's face, which can be inside a pilaster strip, behind a crown or in front of a window's glass.
 * Tracer ends are moved back out of a relief or on into a recess up to the glass.
 */
export class ReliefIndex {
  private readonly boxes = new Map<number, Box[]>();
  private readonly windows = new Map<string, Window>();

  constructor(
    relief: Relief,
    private readonly w: number,
  ) {
    const add = (c: number, r: number, b: Box) => {
      const key = r * w + c;
      const list = this.boxes.get(key);
      if (list) list.push(b);
      else this.boxes.set(key, [b]);
    };
    for (const k of relief.crowns) add(k.c, k.r, boxOf(k, k.a0, k.a1, CROWN_DEPTH, k.zb, k.zt));
    for (const s of relief.strips) {
      const b = boxOf(s, s.a0, s.a1, RELIEF, s.z0, s.z1);
      for (let a = Math.floor(s.a0); a < Math.ceil(s.a1); a++) add(s.ny !== 0 ? a : s.c, s.ny !== 0 ? s.r : a, b);
    }
    for (const win of relief.windows) {
      for (let m = 0; m < TILE; m++) {
        const c = win.ny !== 0 ? win.a0 + m : win.c;
        const r = win.ny !== 0 ? win.r : win.a0 + m;
        this.windows.set(`${c},${r},${win.nx},${win.ny}`, win);
      }
    }
  }

  /** The adjusted distance along the ray (o + d·t) for a shot that stopped at a wall at distance t. */
  adjust(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, t: number): number {
    const px = ox + dx * t;
    const py = oy + dy * t;
    const pz = oz + dz * t;
    // Relief in front of the face: the nearest box entered within the last 0.5 m.
    let best = t;
    const c0 = Math.floor(px);
    const r0 = Math.floor(py);
    for (let r = r0 - 1; r <= r0 + 1; r++) {
      for (let c = c0 - 1; c <= c0 + 1; c++) {
        for (const b of this.boxes.get(r * this.w + c) ?? []) {
          const e = rayBox(ox, oy, oz, dx, dy, dz, b);
          if (e >= t - 0.5 && e < best) best = e;
        }
      }
    }
    if (best < t) return best;
    // A window: the face the shot met, from which side of a cell line the point lies on.
    const fx = Math.abs(px - Math.round(px)) < 1e-3;
    const fy = Math.abs(py - Math.round(py)) < 1e-3;
    if (fx === fy) return t;
    const nx = fx ? -Math.sign(dx) : 0;
    const ny = fy ? -Math.sign(dy) : 0;
    const c = fx ? Math.round(px) - (nx > 0 ? 1 : 0) : Math.floor(px);
    const r = fy ? Math.round(py) - (ny > 0 ? 1 : 0) : Math.floor(py);
    const win = this.windows.get(`${c},${r},${nx},${ny}`);
    if (!win || !inside(win.outline, fy ? px : py, pz)) return t;
    const into = -(dx * nx + dy * ny);
    return into > 1e-6 ? t + RECESS / into : t;
  }
}
