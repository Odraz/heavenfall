/** Terrain: one merged mesh built from the heightfield, plus door meshes (§11.1, M10 §3.5). */
import * as THREE from 'three';
import { K_DOOR, K_FLOOR, K_VOID } from '../sim/heights';
import type { GameMap } from '../sim/map';
import type { TerrainTextures } from './textures';

/** Every terrain texture covers this many meters, aligned to world coordinates (§11.1). */
const TEXTURE_METERS = 4;
/** Cliffs reach this far below the map's lowest floor; their lowest CLIFF_FADE meters fade out (M10 §3.5). */
const CLIFF_DEPTH = 30;
const CLIFF_FADE = 10;

class GeometryBuilder {
  readonly pos: number[] = [];
  readonly uv: number[] = [];
  readonly color: number[] = [];
  /** 1 where a cliff has faded into the sky (M10 §3.5). */
  readonly fade: number[] = [];
  readonly index: number[] = [];

  /**
   * Adds a quad from 4 corners given in simulation coordinates (x, y, z-up), in order around the quad.
   * `normal` (simulation coordinates) picks the visible side.
   */
  quad(corners: number[][], uvs: number[][], shade: number | number[], normal: [number, number, number], fade: number[] = [0, 0, 0, 0]): void {
    const base = this.pos.length / 3;
    // Three.js mapping: three.x = x, three.y = z, three.z = y.
    for (let i = 0; i < 4; i++) {
      const [x, y, z] = corners[i];
      this.pos.push(x, z, y);
      this.uv.push(uvs[i][0], uvs[i][1]);
      const sh = typeof shade === 'number' ? shade : shade[i];
      this.color.push(sh, sh, sh);
      this.fade.push(fade[i]);
    }
    // Check winding against the wanted normal (in three.js space).
    const p = (i: number) => new THREE.Vector3(this.pos[(base + i) * 3], this.pos[(base + i) * 3 + 1], this.pos[(base + i) * 3 + 2]);
    const n = new THREE.Vector3().subVectors(p(1), p(0)).cross(new THREE.Vector3().subVectors(p(2), p(0)));
    const want = new THREE.Vector3(normal[0], normal[2], normal[1]);
    if (n.dot(want) >= 0) this.index.push(base, base + 1, base + 2, base, base + 2, base + 3);
    else this.index.push(base, base + 2, base + 1, base, base + 3, base + 2);
  }

  /** Vertical quad on the cell edge between (x0, y0) and (x1, y1), from z0 to z1, facing `normal`. */
  side(x0: number, y0: number, x1: number, y1: number, z0: number, z1: number, normal: [number, number, number], shade: number, fade0 = 0, fade1 = 0): void {
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
      [fade0, fade0, fade1, fade1],
    );
  }

  toGeometry(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.color, 3));
    g.setAttribute('fade', new THREE.Float32BufferAttribute(this.fade, 1));
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

/**
 * A terrain material: the texture times the vertex colors, faded into the fog color where a cliff
 * melts into the sky, then fogged as scenery (M10 §3.5, §4.2).
 */
function terrainMaterial(map: THREE.Texture): THREE.MeshBasicMaterial {
  const m = new THREE.MeshBasicMaterial({ map, vertexColors: true });
  m.defines = { FOG_SCENERY: '' };
  m.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute float fade;\nvarying float vFade;')
      .replace('#include <fog_vertex>', '#include <fog_vertex>\nvFade = fade;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vFade;')
      .replace('#include <fog_fragment>', 'gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, vFade);\n#include <fog_fragment>');
  };
  return m;
}

export function buildTerrain(map: GameMap, textures: TerrainTextures): Terrain {
  const tops = new GeometryBuilder();
  const risers = new GeometryBuilder();
  const walls = new GeometryBuilder();
  const { w, h } = map;
  const hz = map.heights;
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

  for (let r = 0; r < h; r++) {
    for (let c = 0; c < w; c++) {
      const k = kindAt(c, r);
      if (k === K_VOID) continue;
      const floor = k === K_FLOOR || k === K_DOOR;
      const t = topAt(c, r);
      const [u0, v0, u1, v1] = [c, r, c + 1, r + 1].map((m) => m / TEXTURE_METERS);
      // Wall tops are rarely seen; they get the wall texture, shaded like a sunlit face.
      (floor ? tops : walls).quad(
        [[c, r, t], [c + 1, r, t], [c + 1, r + 1, t], [c, r + 1, t]],
        [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
        floor ? 0.9 + 0.1 * (t / 8.75) : 0.95,
        [0, 0, 1],
      );
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
        if (floor) risers.side(x0, y0, x1, y1, nt, t, normal, edge.shade);
        else if (nt === -Infinity) {
          // A cliff below the level: down to CLIFF_DEPTH under the lowest floor, its foot fading out.
          walls.side(x0, y0, x1, y1, cliffBottom, cliffBottom + CLIFF_FADE, normal, edge.shade * 0.92, 1, 0);
          walls.side(x0, y0, x1, y1, cliffBottom + CLIFF_FADE, t, normal, edge.shade * 0.92);
        } else walls.side(x0, y0, x1, y1, nt, t, normal, edge.shade * 0.92);
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
    for (const v of part.fade) merged.fade.push(v);
    for (const i of part.index) merged.index.push(i + base);
  }
  const geometry = merged.toGeometry();
  groups.forEach(([start, count], i) => geometry.addGroup(start, count, i));
  const mesh = new THREE.Mesh(geometry, [textures.floor, textures.riser, textures.wall].map(terrainMaterial));

  const doorMat = terrainMaterial(textures.door);
  const doorMesh = (cells: ReadonlyArray<[number, number]>): THREE.Mesh | null => {
    if (cells.length === 0) return null;
    const b = new GeometryBuilder();
    for (const [c, r] of cells) {
      const f = map.floor[r * w + c];
      // A closed door's column is as tall as its *Door* height (M10 §3.5).
      const top = hz.height[r * w + c];
      for (const edge of EDGES) {
        const [ex0, ey0, ex1, ey1] = edge.e;
        b.side(c + ex0, r + ey0, c + ex1, r + ey1, f, top, [edge.dx, edge.dy, 0], edge.shade);
      }
      const [u0, v0, u1, v1] = [c, r, c + 1, r + 1].map((m) => m / TEXTURE_METERS);
      b.quad([[c, r, top], [c + 1, r, top], [c + 1, r + 1, top], [c, r + 1, top]], [[u0, v0], [u1, v0], [u1, v1], [u0, v1]], 0.95, [0, 0, 1]);
    }
    const m = new THREE.Mesh(b.toGeometry(), doorMat);
    m.visible = false;
    return m;
  };
  const doors = map.arenas.map((arena) => ({ entry: doorMesh(arena.doors), exit: doorMesh(arena.exitDoors ?? []) }));

  return { mesh, doors };
}
