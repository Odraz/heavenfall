import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons/index';
import { loadMap, type GameMap } from '../sim/map';
import { archesBlock, computeArches } from './arches';
import { arc, emitGate, G_LEAVES, G_RAILING, gateHit, gateLayout, gateSkip, PLINTH, type GateLayout } from './gate';
import { bakeLightmap, faceColor, facesSun, shadowZ, SUN } from './lightmap';
import { computeRelief } from './relief';
import { buildTerrain, GeometryBuilder } from './terrain';
import type { TerrainTextures } from './textures';

/** Stand-ins for the loaded textures: building the terrain only needs their kinds. */
function fakeTextures(gate: boolean): TerrainTextures {
  const array = () => new THREE.DataArrayTexture(new Uint8Array(4), 1, 1, 1);
  return { array: array(), door: new THREE.Texture(), sky: new THREE.Texture(), shaft: new THREE.Texture(), atmosphere: new THREE.Texture(), gate: gate ? array() : null };
}

function lightOf(map: GameMap) {
  const arches = computeArches(map);
  const archShadow = (x: number, y: number, z: number) => archesBlock(arches, x, y, z, SUN.x, SUN.y, SUN.z, 400);
  return { faceColor, facesSun, shadowZ: (x: number, y: number, nx: number, ny: number, foot: number, top: number) => shadowZ(map, x, y, nx, ny, foot, top, archShadow) };
}

/** The gate's mesh as a builder, its vertices in map coordinates (x, y, z). */
function buildGate(map: GameMap, L: GateLayout): { g: GeometryBuilder; at: (i: number) => [number, number, number] } {
  const g = new GeometryBuilder();
  emitGate(g, L, lightOf(map));
  // The builder stores three.js order (x, z, y).
  return { g, at: (i) => [g.pos[i * 3], g.pos[i * 3 + 2], g.pos[i * 3 + 1]] };
}

/** A hash of number arrays as 32-bit floats (FNV-1a), to compare builds with the code before the gate. */
function hash(...arrays: ArrayLike<number>[]): string {
  let h = 2166136261;
  for (const a of arrays) {
    const bytes = new Uint8Array(new Float32Array(Array.from(a)).buffer);
    for (let i = 0; i < bytes.length; i++) h = Math.imul(h ^ bytes[i], 16777619);
  }
  return (h >>> 0).toString(16);
}

const map = loadMap(DUNGEONS['pearly-gates']);
const L = gateLayout(map)!;
const F = L.F;

describe('the Heavenly Gate (M10 gate)', () => {
  it('is on the Pearly Gates only, at the boss arena', () => {
    expect(map.gate).toEqual({ x: 6, yCenter: 75, y0: 49, y1: 101 });
    expect(F).toBe(4.5);
    expect(loadMap(DUNGEONS.sandbox).gate).toBeNull();
    expect(gateLayout(loadMap(DUNGEONS.sandbox))).toBeNull();
  });

  describe('geometry', () => {
    const { g, at } = buildGate(map, L);
    const n = g.pos.length / 3;

    it('is identical built twice, and about 1 100 triangles', () => {
      const again = buildGate(map, L).g;
      expect(hash(again.pos, again.uv, again.color, again.layer, again.shadowZ)).toBe(hash(g.pos, g.uv, g.color, g.layer, g.shadowZ));
      expect(g.index.length / 3).toBeGreaterThan(900);
      expect(g.index.length / 3).toBeLessThan(1300);
    });

    it('stays within x −2 to 7.3 and y 48.5 to 101.5, and above 14.5 m wherever it reaches past the plane', () => {
      for (let i = 0; i < n; i++) {
        const [x, y, z] = at(i);
        expect(x).toBeGreaterThanOrEqual(-2);
        expect(x).toBeLessThanOrEqual(7.3);
        expect(y).toBeGreaterThanOrEqual(48.5);
        expect(y).toBeLessThanOrEqual(101.5);
        if (x > 6.01) expect(z, `vertex at ${x}, ${y}, ${z}`).toBeGreaterThanOrEqual(14.5);
      }
    });

    it('is symmetric about the center line', () => {
      const key = (x: number, y: number, z: number) => `${x.toFixed(3)},${y.toFixed(3)},${z.toFixed(3)}`;
      const all = new Set<string>();
      for (let i = 0; i < n; i++) all.add(key(...at(i)));
      for (let i = 0; i < n; i++) {
        const [x, y, z] = at(i);
        expect(all.has(key(x, 2 * L.yc - y, z)), `mirror of ${key(x, y, z)}`).toBe(true);
      }
    });

    it("the railing's top follows the arc, and the ironwork stands on the plinth", () => {
      const near = (a: number, b: number) => expect(Math.abs(a - b)).toBeLessThan(0.01);
      near(arc(25), 10.67);
      near(arc(12), 26);
      near(arc(19), 20.55);
      near(arc(18), 21.58);
      const tops = new Map<number, number>();
      let bottom = Infinity;
      for (let i = 0; i < n; i++) {
        const layer = g.layer[i];
        if (layer !== G_RAILING && layer !== G_LEAVES) continue;
        const [, y, z] = at(i);
        bottom = Math.min(bottom, z);
        if (layer === G_RAILING) tops.set(y, Math.max(tops.get(y) ?? -Infinity, z));
      }
      expect(bottom).toBeCloseTo(F + PLINTH, 6);
      // Every column edge: 4 panels of 6 m in 0.25 m columns.
      expect(tops.size).toBe(4 * 25);
      for (const [y, z] of tops) expect(Math.abs(z - (F + arc(Math.abs(y - L.yc))))).toBeLessThan(0.01);
      near(tops.get(50)! - F, 10.67);
      near(tops.get(100)! - F, 10.67);
      near(tops.get(63)! - F, 26);
      near(tops.get(87)! - F, 26);
    });
  });

  describe('light', () => {
    const { g, at } = buildGate(map, L);

    it("every face's vertex color is its normal's shading, with a shadow line only where it faces the sun", () => {
      for (let t = 0; t < g.index.length; t += 3) {
        const [a, b, c] = [g.index[t], g.index[t + 1], g.index[t + 2]].map((i) => new THREE.Vector3(...at(i)));
        // The builder winds each triangle to face its normal; in map coordinates (y south) the cross
        // product of a triangle wound that way points the other way.
        const nrm = new THREE.Vector3().subVectors(b, a).cross(new THREE.Vector3().subVectors(c, a)).normalize().negate();
        expect(Math.abs(nrm.z)).toBeLessThan(1e-6);
        const nx = Math.round(nrm.x);
        const ny = Math.round(nrm.y);
        const want = faceColor(nx, ny);
        for (const i of [g.index[t], g.index[t + 1], g.index[t + 2]]) {
          for (let k = 0; k < 3; k++) expect(g.color[i * 3 + k]).toBeCloseTo(want[k], 6);
          if (facesSun(nx, ny)) expect(g.shadowZ[i]).toBeGreaterThan(-1000);
          else expect(g.shadowZ[i]).toBe(-1e4);
        }
      }
    });

    it('the north railing is in the north wall\'s shadow low down; the leaves are lit', () => {
      const shadowAt = (y: number) => {
        const zs: number[] = [];
        for (let i = 0; i < g.pos.length / 3; i++) {
          const [x, vy] = at(i);
          if (Math.abs(x - 6) < 1e-6 && Math.abs(vy - y) < 1e-6) zs.push(g.shadowZ[i]);
        }
        expect(zs.length).toBeGreaterThan(0);
        return Math.min(...zs);
      };
      expect(shadowAt(52)).toBeGreaterThan(F + 1);
      expect(shadowAt(75)).toBeLessThan(F + 2);
    });
  });

  describe('tracers', () => {
    // From the boss arena's middle, at a Silver Revolver's range.
    const shot = (tx: number, ty: number, tz: number) => {
      const [ox, oy, oz] = [35.5, 75, F + 1.6];
      const d = new THREE.Vector3(tx - ox, ty - oy, tz - oz).normalize();
      const t = gateHit(L, ox, oy, oz, d.x, d.y, d.z, 60);
      return { t, x: ox + d.x * t, y: oy + d.y * t, z: oz + d.z * t };
    };

    it('end at the leaves, at a spire, at the railing over the corner parapet, and fly on between the spires', () => {
      const leaves = shot(6, 75, F + 20);
      expect(leaves.x).toBeCloseTo(6, 2);
      expect(leaves.t).toBeCloseTo(34.8, 0);
      const spire = shot(4.5, 64.5, F + 40);
      expect(Math.hypot(spire.x - 4.5, spire.y - 64.5)).toBeLessThan(1.2);
      expect(spire.t).toBeGreaterThan(48);
      expect(spire.t).toBeLessThan(51);
      expect(shot(6, 75, F + 40).t).toBe(Infinity);
      expect(shot(6, 99.5, F + 3).x).toBeCloseTo(6, 2);
    });
  });

  describe('terrain and relief', () => {
    const skip = gateSkip(map)!;

    it('the terrain draws nothing west of the gate but the plinth', () => {
      const terrain = buildTerrain(map, fakeTextures(true));
      const geo = terrain.mesh.geometry;
      const pos = geo.getAttribute('position');
      const idx = geo.getIndex()!;
      const v = (i: number): [number, number, number] => [pos.getX(i), pos.getZ(i), pos.getY(i)];
      let plinth = 0;
      for (let t = 0; t < idx.count; t += 3) {
        const tri = [v(idx.getX(t)), v(idx.getX(t + 1)), v(idx.getX(t + 2))];
        const inside = tri.every(([x, y]) => x < 6.01 && y > 48.99 && y < 101.01) && tri.some(([x, y]) => x < 5.99 && y > 49.01 && y < 100.99);
        if (!inside) continue;
        const isPlinth = tri.every(([, , z]) => z <= F + PLINTH + 0.01) || tri.every(([x]) => Math.abs(x - 5) < 1e-6);
        expect(isPlinth, `triangle ${JSON.stringify(tri)}`).toBe(true);
        plinth++;
      }
      expect(plinth).toBeGreaterThan(0);
      expect(terrain.gate).not.toBeNull();
    });

    it('the relief skips the gate, and the crowns beside it end at its plane, closed', () => {
      const relief = computeRelief(map);
      for (const k of relief.crowns) if (!k.door) expect(skip(k.c, k.r), `crown at ${k.c},${k.r}`).toBe(false);
      for (const s of relief.strips) expect(skip(s.c, s.r)).toBe(false);
      for (const w of relief.windows) expect(skip(w.c, w.r)).toBe(false);
      // The north wall's crown on its south face, and the south arcade's on its north face.
      const north = relief.crowns.find((k) => k.ny === 1 && k.plane === 50 && Math.abs(k.a0 - 6) < 1e-9);
      const south = relief.crowns.find((k) => k.ny === -1 && k.plane === 100 && Math.abs(k.a0 - 6) < 1e-9);
      expect(north?.capA0).toBe(true);
      expect(south?.capA0).toBe(true);
    });

    it('the floor lightmap and the sandbox are as before the gate', () => {
      const arches = computeArches(map);
      const lm = bakeLightmap(map, (x, y, z) => archesBlock(arches, x, y, z, SUN.x, SUN.y, SUN.z, 400));
      expect(hash(lm.data)).toBe(LIGHTMAP_BEFORE);
      const sandbox = buildTerrain(loadMap(DUNGEONS.sandbox), fakeTextures(false));
      const geo = sandbox.mesh.geometry;
      expect(hash(...['position', 'uv', 'color', 'layer', 'shadowZ'].map((a) => geo.getAttribute(a).array), geo.getIndex()!.array)).toBe(SANDBOX_BEFORE);
      expect(sandbox.gate).toBeNull();
    });
  });
});

/** Measured on the M10 final build (7491068), before the gate. */
const LIGHTMAP_BEFORE = 'e321df47';
const SANDBOX_BEFORE = '561ee9c2';
