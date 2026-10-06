/** Terrain: one merged mesh built from the heightfield, plus door meshes (§11.1, M10 §3.5, §5.1). */
import * as THREE from 'three';
import { K_DOOR, K_FLOOR, K_OPEN, K_PILLAR, K_VOID } from '../sim/heights';
import type { GameMap } from '../sim/map';
import { CORNICE, floorLooks, L_CORNICE, L_MEDALLION, L_PILASTER, L_RISER, L_WALL, segmentLook, TILE, wallPieces } from './looks';
import { bakeLightmap, faceColor, facesSun, shadowZ as faceShadowZ } from './lightmap';
import { makeTerrainMaterial } from './terrainMaterial';
import type { TerrainTextures } from './textures';

/** Cliffs reach this far below the map's lowest floor; their lowest CLIFF_FADE meters fade out (M10 §3.5). */
const CLIFF_DEPTH = 30;
const CLIFF_FADE = 10;

class GeometryBuilder {
  readonly pos: number[] = [];
  readonly uv: number[] = [];
  readonly color: number[] = [];
  /** The texture array's layer (M10 §5.1). */
  readonly layer: number[] = [];
  /** 1 where a cliff has faded into the sky (M10 §3.5). */
  readonly fade: number[] = [];
  /** The height below which a sun-facing face is in shadow (M10 §5.2); far below for other faces. */
  readonly shadowZ: number[] = [];
  /** 1 for floor tops, which take the lightmap. */
  readonly floorTop: number[] = [];
  readonly index: number[] = [];
  /** The color, shadow line function and floor flag of the next quads. */
  rgb: [number, number, number] = [1, 1, 1];
  shadowAt: ((x: number, y: number) => number) | null = null;
  isFloor = 0;

  /**
   * Adds a quad from 4 corners given in simulation coordinates (x, y, z-up), in order around the quad.
   * `normal` (simulation coordinates) picks the visible side.
   */
  quad(corners: number[][], uvs: number[][], shade: number | number[], normal: [number, number, number], layer: number, fade: number[] = [0, 0, 0, 0]): void {
    const base = this.pos.length / 3;
    // Three.js mapping: three.x = x, three.y = z, three.z = y.
    for (let i = 0; i < 4; i++) {
      const [x, y, z] = corners[i];
      this.pos.push(x, z, y);
      this.uv.push(uvs[i][0], uvs[i][1]);
      const sh = typeof shade === 'number' ? shade : shade[i];
      this.color.push(sh * this.rgb[0], sh * this.rgb[1], sh * this.rgb[2]);
      this.layer.push(layer);
      this.fade.push(fade[i]);
      this.shadowZ.push(this.shadowAt ? this.shadowAt(x, y) : -1e4);
      this.floorTop.push(this.isFloor);
    }
    // Check winding against the wanted normal (in three.js space).
    const p = (i: number) => new THREE.Vector3(this.pos[(base + i) * 3], this.pos[(base + i) * 3 + 1], this.pos[(base + i) * 3 + 2]);
    const n = new THREE.Vector3().subVectors(p(1), p(0)).cross(new THREE.Vector3().subVectors(p(2), p(0)));
    const want = new THREE.Vector3(normal[0], normal[2], normal[1]);
    if (n.dot(want) >= 0) this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  /**
   * Vertical quad on the edge from (x0, y0) to (x1, y1), from z0 to z1, facing `normal`, with u from
   * u0 to u1 and v from v0 to v1. Shaded darker toward the foot of the whole face (zFoot to zTop).
   */
  side(
    x0: number, y0: number, x1: number, y1: number, z0: number, z1: number,
    u0: number, u1: number, v0: number, v1: number,
    normal: [number, number, number], shade: number, layer: number,
    face: { foot: number; top: number }, fade0 = 0, fade1 = 0,
  ): void {
    const s = (z: number) => shade * (0.8 + 0.2 * Math.min(1, Math.max(0, (z - face.foot) / Math.max(1e-6, face.top - face.foot))));
    this.quad(
      [[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]],
      [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
      [s(z0), s(z0), s(z1), s(z1)],
      normal,
      layer,
      [fade0, fade0, fade1, fade1],
    );
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    g.setAttribute('layer', new THREE.Float32BufferAttribute(this.layer, 1));
    g.setAttribute('fade', new THREE.Float32BufferAttribute(this.fade, 1));
    g.setAttribute('shadowZ', new THREE.Float32BufferAttribute(this.shadowZ, 1));
    g.setAttribute('floorTop', new THREE.Float32BufferAttribute(this.floorTop, 1));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}

/** The four edge directions: offset to the neighbor, the edge endpoints relative to the cell, and shading. */
const EDGES = [
  { dx: 1, dy: 0, e: [1, 0, 1, 1], shade: 1 },
  { dx: -1, dy: 0, e: [0, 1, 0, 0], shade: 1 },
  { dx: 0, dy: 1, e: [1, 1, 0, 1], shade: 1 },
  { dx: 0, dy: -1, e: [0, 0, 1, 0], shade: 1 },
] as const;

export interface Terrain {
  /** Tops, sides and walls, with doors open. */
  mesh: THREE.Mesh;
  /** The baked floor lightmap (M10 §5.2), which the characters sample too (§5.4). */
  lightmap: THREE.DataTexture;
  /** Closed-door columns per arena, entry and exit door (null where the arena has none). */
  doors: Array<{ entry: THREE.Mesh | null; exit: THREE.Mesh | null }>;
}

export function buildTerrain(map: GameMap, textures: TerrainTextures): Terrain {
  const g = new GeometryBuilder();
  const { w, h } = map;
  const hz = map.heights;
  const looks = floorLooks(map);
  const kindAt = (c: number, r: number) => (c < 0 || r < 0 || c >= w || r >= h ? K_VOID : hz.kind[r * w + c]);
  /** What's drawn at a cell: its floor (doors open), or its wall height; −∞ for void. */
  const topAt = (c: number, r: number): number => {
    const k = kindAt(c, r);
    if (k === K_VOID) return -Infinity;
    const i = r * w + c;
    return k === K_FLOOR || k === K_DOOR ? map.floor[i] : hz.height[i];
  };
  let lowest = Infinity;
  for (let i = 0; i < w * h; i++) if (!map.wall[i]) lowest = Math.min(lowest, map.floor[i]);
  const cliffBottom = lowest - CLIFF_DEPTH;
  // Baked light (M10 §5.2).
  const lm = bakeLightmap(map);
  const lightmap = new THREE.DataTexture(lm.data, lm.w, lm.h, THREE.RGBAFormat, THREE.UnsignedByteType);
  lightmap.magFilter = THREE.LinearFilter;
  lightmap.minFilter = THREE.LinearMipmapLinearFilter;
  lightmap.generateMipmaps = true;
  lightmap.needsUpdate = true;
  /** A pillar's face: the extent of its pillar cells along the face, to center the pilaster on it. */
  const pillarSpan = (c: number, r: number, alongX: boolean): [number, number] => {
    let a = alongX ? c : r;
    let b = a;
    const at = (v: number) => (alongX ? kindAt(v, r) : kindAt(c, v));
    while (at(a - 1) === K_PILLAR) a--;
    while (at(b + 1) === K_PILLAR) b++;
    return [a, b + 1];
  };

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const k = kindAt(c, r);
      if (k === K_VOID) continue;
      const i = r * w + c;
      const floor = k === K_FLOOR || k === K_DOOR;
      const t = topAt(c, r);
      g.rgb = [1, 1, 1];
      g.shadowAt = null;
      g.isFloor = floor ? 1 : 0;
      if (floor) {
        const m = looks.medallionOf[i];
        let uv: number[][];
        if (m >= 0) {
          // A medallion: whole across its 4 × 4 block.
          const [c0, r0] = looks.medallions[m];
          const [u0, v0, u1, v1] = [c - c0, r - r0, c + 1 - c0, r + 1 - r0].map((x) => x / TILE);
          uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        } else {
          const [u0, v0, u1, v1] = [c, r, c + 1, r + 1].map((x) => x / TILE);
          uv = [[u0, v0], [u1, v0], [u1, v1], [u0, v1]];
        }
        g.quad([[c, r, t], [c + 1, r, t], [c + 1, r + 1, t], [c, r + 1, t]], uv, 1, [0, 0, 1], m >= 0 ? L_MEDALLION : looks.layer[i]);
      } else {
        // Wall tops are rarely seen.
        const [u0, v0, u1, v1] = [c, r, c + 1, r + 1].map((x) => x / TILE);
        g.quad([[c, r, t], [c + 1, r, t], [c + 1, r + 1, t], [c, r + 1, t]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], 0.95, [0, 0, 1], L_WALL);
      }
      // Each vertical face is drawn once, from the higher cell, facing the lower one.
      for (const edge of EDGES) {
        const nc = c + edge.dx;
        const nr = r + edge.dy;
        const nt = topAt(nc, nr);
        if (nt >= t) continue;
        const [ex0, ey0, ex1, ey1] = edge.e;
        const x0 = c + ex0;
        const y0 = r + ey0;
        const x1 = c + ex1;
        const y1 = r + ey1;
        const normal: [number, number, number] = [edge.dx, edge.dy, 0];
        const alongX = edge.dy !== 0;
        // u along the face, aligned to world coordinates.
        const u0 = (alongX ? x0 : y0) / TILE;
        const u1 = (alongX ? x1 : y1) / TILE;
        const face = { foot: nt === -Infinity ? cliffBottom : nt, top: t };
        const nk = kindAt(nc, nr);
        // Baked: the face's direction shading, and its shadow line if it's turned to the sun, at each
        // end of the face, 1 cm inside it.
        g.isFloor = 0;
        g.rgb = faceColor(edge.dx, edge.dy);
        if (facesSun(edge.dx, edge.dy)) {
          const ends = new Map<string, number>();
          g.shadowAt = (x, y) => {
            const key = `${x},${y}`;
            let z = ends.get(key);
            if (z === undefined) {
              const tx = alongX ? (x === x0 ? 0.01 : -0.01) * Math.sign(x1 - x0) : 0;
              const ty = alongX ? 0 : (y === y0 ? 0.01 : -0.01) * Math.sign(y1 - y0);
              z = faceShadowZ(map, x + tx, y + ty, edge.dx, edge.dy, face.foot, t);
              ends.set(key, z);
            }
            return z;
          };
        } else g.shadowAt = null;
        if (floor) {
          g.side(x0, y0, x1, y1, nt, t, u0, u1, nt / TILE, t / TILE, normal, edge.shade, L_RISER, face);
        } else if (nk === K_VOID) {
          // A cliff below the level, or the back of a wall: tex-wall down to CLIFF_DEPTH under the
          // lowest floor, its foot fading into the sky.
          const s = edge.shade * 0.92;
          g.side(x0, y0, x1, y1, cliffBottom, cliffBottom + CLIFF_FADE, u0, u1, cliffBottom / TILE, (cliffBottom + CLIFF_FADE) / TILE, normal, s, L_WALL, face, 1, 0);
          g.side(x0, y0, x1, y1, cliffBottom + CLIFF_FADE, t, u0, u1, (cliffBottom + CLIFF_FADE) / TILE, t / TILE, normal, s, L_WALL, face);
        } else if ((nk === K_FLOOR || nk === K_DOOR) && k !== K_OPEN) {
          // A wall or pillar looking onto floor: the decorated band, tex-wall above it, the cornice.
          const band = k === K_PILLAR ? L_PILASTER : segmentLook(map, c, r, edge.dx, edge.dy);
          let fu0 = u0;
          let fu1 = u1;
          if (k === K_PILLAR) {
            // Pillars: the pilaster centered on each face.
            const [a, b] = pillarSpan(c, r, alongX);
            const mid = (a + b) / 2;
            fu0 = 0.5 + ((alongX ? x0 : y0) - mid) / TILE;
            fu1 = 0.5 + ((alongX ? x1 : y1) - mid) / TILE;
          }
          for (const piece of wallPieces(nt, t, nt, t, band, k === K_PILLAR ? L_PILASTER : L_WALL)) {
            const inBand = piece.layer === band;
            g.side(x0, y0, x1, y1, piece.z0, piece.z1, inBand ? fu0 : u0, inBand ? fu1 : u1, piece.v0, piece.v1, normal, edge.shade * 0.92, piece.layer, face);
          }
        } else if (k === K_OPEN) {
          // An open edge's parapet (until stage 6): tex-wall from the floor beside it.
          g.side(x0, y0, x1, y1, nt, t, u0, u1, (nt - face.foot) / TILE, (t - face.foot) / TILE, normal, edge.shade * 0.92, L_WALL, face);
        } else {
          // A step down to a lower wall or parapet: tex-wall, and the cornice turning onto this end face.
          const cb = Math.max(nt, t - CORNICE);
          const s = edge.shade * 0.92;
          if (cb > nt) g.side(x0, y0, x1, y1, nt, cb, u0, u1, nt / TILE, cb / TILE, normal, s, L_WALL, face);
          g.side(x0, y0, x1, y1, cb, t, u0, u1, (cb - (t - CORNICE)) / CORNICE, 1, normal, s, L_CORNICE, face);
        }
      }
    }
  }

  const mesh = new THREE.Mesh(g.toGeometry(), makeTerrainMaterial(textures.array, textures.sky, lightmap, w, h));

  const doorMat = makeTerrainMaterial(textures.door, textures.sky, lightmap, w, h);
  const doorMesh = (cells: ReadonlyArray<[number, number]>): THREE.Mesh | null => {
    if (cells.length === 0) return null;
    const b = new GeometryBuilder();
    for (const [c, r] of cells) {
      b.shadowAt = null;
      const f = map.floor[r * w + c];
      // A closed door's column is as tall as its *Door* height (M10 §3.5).
      const top = hz.height[r * w + c];
      for (const edge of EDGES) {
        const [ex0, ey0, ex1, ey1] = edge.e;
        const x0 = c + ex0;
        const y0 = r + ey0;
        const x1 = c + ex1;
        const y1 = r + ey1;
        b.rgb = faceColor(edge.dx, edge.dy);
        b.side(x0, y0, x1, y1, f, top, (x0 + y0) / TILE, (x1 + y1) / TILE, f / TILE, top / TILE, [edge.dx, edge.dy, 0], edge.shade, 0, { foot: f, top });
      }
      const [u0, v0, u1, v1] = [c, r, c + 1, r + 1].map((m) => m / TILE);
      b.rgb = [1, 1, 1];
      b.quad([[c, r, top], [c + 1, r, top], [c + 1, r + 1, top], [c, r + 1, top]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], 0.95, [0, 0, 1], 0);
    }
    const m = new THREE.Mesh(b.toGeometry(), doorMat);
    m.visible = false;
    return m;
  };
  const doors = map.arenas.map((arena) => ({ entry: doorMesh(arena.doors), exit: doorMesh(arena.exitDoors ?? []) }));

  return { mesh, lightmap, doors };
}
