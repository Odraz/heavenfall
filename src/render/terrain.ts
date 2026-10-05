/** Terrain: one merged mesh built from the heightfield, plus door meshes (§11.1). */
import * as THREE from 'three';
import { WALL_TOP } from '../sim/constants';
import type { GameMap } from '../sim/map';
import type { TerrainTextures } from './textures';

/** Every terrain texture covers this many meters, aligned to world coordinates (§11.1). */
const TEXTURE_METERS = 4;

class GeometryBuilder {
  readonly pos: number[] = [];
  readonly uv: number[] = [];
  readonly color: number[] = [];
  readonly index: number[] = [];

  /**
   * Adds a quad from 4 corners given in simulation coordinates (x, y, z-up), in order around the quad.
   * `normal` (simulation coordinates) picks the visible side.
   */
  quad(corners: number[][], uvs: number[][], shade: number | number[], normal: [number, number, number]): void {
    const base = this.pos.length / 3;
    // Three.js mapping: three.x = x, three.y = z, three.z = y.
    for (let i = 0; i < 4; i++) {
      const [x, y, z] = corners[i];
      this.pos.push(x, z, y);
      this.uv.push(uvs[i][0], uvs[i][1]);
      const sh = typeof shade === 'number' ? shade : shade[i];
      this.color.push(sh, sh, sh);
    }
    // Check winding against the wanted normal (in three.js space).
    const p = (i: number) => new THREE.Vector3(this.pos[(base + i) * 3], this.pos[(base + i) * 3 + 1], this.pos[(base + i) * 3 + 2]);
    const n = new THREE.Vector3().subVectors(p(1), p(0)).cross(new THREE.Vector3().subVectors(p(2), p(0)));
    const want = new THREE.Vector3(normal[0], normal[2], normal[1]);
    if (n.dot(want) >= 0) this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  /** Vertical quad on the cell edge between (x0, y0) and (x1, y1), from z0 to z1, facing `normal`. */
  side(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, normal: [number, number, number], shade: number): void {
    const u0 = (x0 + y0) / TEXTURE_METERS;
    const u1 = (x1 + y1) / TEXTURE_METERS;
    const v0 = z0 / TEXTURE_METERS;
    const v1 = z1 / TEXTURE_METERS;
    this.quad(
      [[x0, y0, z0], [x1, y1, z0], [x1, y1, z1], [x0, y0, z1]],
      [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
      // Darker at the bottom, so edges and corners read without lighting.
      [shade * 0.8, shade * 0.8, shade, shade],
      normal,
    );
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    g.setIndex(this.index);
    g.computeBoundingSphere();
    return g;
  }
}

/** The four edge directions: offset to the neighbor, the edge endpoints relative to the cell, and shading. */
const EDGES = [
  { dx: 1, dy: 0, e: [1, 0, 1, 1], shade: 0.78 },
  { dx: -1, dy: 0, e: [0, 1, 0, 0], shade: 0.74 },
  { dx: 0, dy: 1, e: [1, 1, 0, 1], shade: 0.86 },
  { dx: 0, dy: -1, e: [0, 0, 1, 0], shade: 0.9 },
] as const;

export interface Terrain {
  /** Tops, sides and walls, with doors open. */
  mesh: THREE.Mesh;
  /** Closed-door columns per arena, entry and exit door (null where the arena has none). */
  doors: Array<{ entry: THREE.Mesh | null; exit: THREE.Mesh | null }>;
}

export function buildTerrain(map: GameMap, textures: TerrainTextures): Terrain {
  const tops = new GeometryBuilder();
  const risers = new GeometryBuilder();
  const walls = new GeometryBuilder();
  const { w, h } = map;
  const isWall = (c: number, r: number) => c < 0 || r < 0 || c >= w || r >= h || map.wall[r * w + c] === 1;

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      if (isWall(c, r)) continue;
      const f = map.floor[r * w + c];
      const shade = 0.9 + 0.1 * (f / 8.75);
      const [u0, v0, u1, v1] = [c, r, c + 1, r + 1].map((m) => m / TEXTURE_METERS);
      tops.quad(
        [[c, r, f], [c + 1, r, f], [c + 1, r + 1, f], [c, r + 1, f]],
        [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        shade,
        [0, 0, 1],
      );
      for (const edge of EDGES) {
        const nc = c + edge.dx;
        const nr = r + edge.dy;
        const [ex0, ey0, ex1, ey1] = edge.e;
        // The face is seen from this cell for walls (normal toward this cell), from the neighbor for ledges.
        if (isWall(nc, nr)) {
          walls.side(c + ex0, r + ey0, c + ex1, r + ey1, f, WALL_TOP, [-edge.dx, -edge.dy, 0], edge.shade * 0.92);
        } else {
          const nf = map.floor[nr * w + nc];
          if (nf < f) risers.side(c + ex0, r + ey0, c + ex1, r + ey1, nf, f, [edge.dx, edge.dy, 0], edge.shade);
        }
      }
    }
  }

  // One mesh with a material group per texture: tops, then risers, then walls.
  const merged = new GeometryBuilder();
  const groups: Array<[number, number]> = [];
  for (const part of [tops, risers, walls]) {
    const base = merged.pos.length / 3;
    groups.push([merged.index.length, part.index.length]);
    for (const v of part.pos) merged.pos.push(v);
    for (const v of part.uv) merged.uv.push(v);
    for (const v of part.color) merged.color.push(v);
    for (const i of part.index) merged.index.push(i + base);
  }
  const geometry = merged.toGeometry();
  groups.forEach(([start, count], i) => geometry.addGroup(start, count, i));
  const material = (map: THREE.Texture) => new THREE.MeshBasicMaterial({ map, vertexColors: true });
  const mesh = new THREE.Mesh(geometry, [textures.floor, textures.riser, textures.wall].map(material));

  const doorMat = material(textures.door);
  const doorMesh = (cells: ReadonlyArray<[number, number]>): THREE.Mesh | null => {
    if (cells.length === 0) return null;
    const b = new GeometryBuilder();
    for (const [c, r] of cells) {
      const f = map.floor[r * w + c];
      for (const edge of EDGES) {
        const [ex0, ey0, ex1, ey1] = edge.e;
        b.side(c + ex0, r + ey0, c + ex1, r + ey1, f, WALL_TOP, [edge.dx, edge.dy, 0], edge.shade);
      }
    }
    const m = new THREE.Mesh(b.toGeometry(), doorMat);
    m.visible = false;
    return m;
  };
  const doors = map.arenas.map((arena) => ({ entry: doorMesh(arena.doors), exit: doorMesh(arena.exitDoors ?? []) }));

  return { mesh, doors };
}
