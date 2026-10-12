import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons';
import type { GateDef } from '../data/dungeons/types';
import { gateFloor, gateLocal, gatePoint } from '../sim/gate';
import { loadMap } from '../sim/map';
import { emitGate, emitPlinth, G_LEAVES, gateHit, gateLayout, gateSkip, PLINTH } from './gate';
import { GeometryBuilder } from './terrain';
import { PEARLY_POOL_R1 } from '../data/rooms/1';
import { generateFloor } from '../gen';
import { computeArches } from './arches';

// Planes on the map boundary, including E/S just beyond the final cell. Expected coordinates are
// authored independently of the Gate transform; a wrong facing or one-cell sampling offset fails.
const cases: Array<{
  facing: GateDef['facing']; plane: number; floorCell: [number, number];
  ray: [number, number]; dir: [number, number]; postRay: [number, number]; outside: [number, number];
}> = [
  { facing: 'W', plane: 0, floorCell: [0, 80], ray: [10, 80], dir: [-1, 0], postRay: [10, 90.5], outside: [-1, 80] },
  { facing: 'N', plane: 0, floorCell: [80, 0], ray: [80, 10], dir: [0, -1], postRay: [69.5, 10], outside: [80, -1] },
  { facing: 'E', plane: 160, floorCell: [159, 80], ray: [150, 80], dir: [1, 0], postRay: [150, 69.5], outside: [160, 80] },
  { facing: 'S', plane: 160, floorCell: [80, 159], ray: [80, 150], dir: [0, 1], postRay: [90.5, 150], outside: [80, 160] },
];

describe('the generated Gate facing (rogue R1.3)', () => {
  it('replaces the generated arcade behind the Gate in every facing, including boundary-straddling bays', () => {
    const seen = new Set<GateDef['facing']>();
    for (let seed = 1; seed <= 64 && seen.size < 4; seed++) {
      const { map } = generateFloor(seed, 1, 1, PEARLY_POOL_R1);
      const skip = gateSkip(map)!;
      const replaced = map.heights.bays.filter((b) => b.cells.some(([c, r]) => skip(c, r)));
      if (replaced.length === 0) continue;
      const without = computeArches({ ...map, gate: null });
      const arches = computeArches(map);
      expect(arches.bays).toEqual(without.bays.filter((b) => !replaced.includes(b.bay)));
      expect(arches.doors).toEqual(without.doors);
      expect(arches.bays.length).toBeGreaterThan(0);
      const bay = replaced[0];
      const along = map.gate!.facing === 'W' || map.gate!.facing === 'E' ? 1 : 0;
      const narrowed = { ...map, gate: { ...map.gate!, u0: bay.cells[0][along] + 1 } };
      const narrowSkip = gateSkip(narrowed)!;
      expect(bay.cells.some(([c, r]) => narrowSkip(c, r))).toBe(true);
      expect(bay.cells.some(([c, r]) => !narrowSkip(c, r))).toBe(true);
      expect(computeArches(narrowed).bays.some((b) => b.bay === bay)).toBe(false);
      seen.add(map.gate!.facing);
    }
    expect([...seen].sort()).toEqual(['E', 'N', 'S', 'W']);
  });
  for (const c of cases) {
    it(`${c.facing}: samples the interior cell, rotates leaves/plinth/light and hits the leaves and posts`, () => {
      const gate: GateDef = { facing: c.facing, plane: c.plane, uCenter: 80, u0: 54, u1: 106 };
      const floor = new Float32Array(160 * 160).fill(NaN);
      floor[c.floorCell[1] * 160 + c.floorCell[0]] = 2;
      const map = { ...loadMap(DUNGEONS.sandbox), w: 160, h: 160, floor, gate };
      expect(gateFloor(map)).toBe(2);
      const L = gateLayout(map)!;
      expect(L.F).toBe(2);
      const light = {
        faceColor: (nx: number, ny: number): [number, number, number] => [0.5 + nx * 0.1, 0.5 + ny * 0.1, 0.5],
        facesSun: () => true,
        shadowZ: (x: number, y: number) => x * 1000 + y,
      };
      const g = new GeometryBuilder();
      emitGate(g, L, light);
      const axis = c.facing === 'W' || c.facing === 'E' ? 0 : 2; // Builder order x,z,y.
      const leafVertices = g.layer.map((layer, i) => layer === G_LEAVES ? i : -1).filter((i) => i >= 0);
      expect(leafVertices.length).toBe(8);
      for (const i of leafVertices) {
        expect(g.pos[i * 3 + axis]).toBe(c.plane);
        expect(g.color.slice(i * 3, i * 3 + 3)).toEqual(light.faceColor(-c.dir[0], -c.dir[1]));
        // Shadow queries must be in world coordinates beside the emitted vertex (1 cm offset).
        expect(Math.abs(g.shadowZ[i] - (g.pos[i * 3] * 1000 + g.pos[i * 3 + 2]))).toBeLessThan(10.02);
      }
      expect(g.pos.every(Number.isFinite)).toBe(true);
      const plinth = new GeometryBuilder();
      emitPlinth(plinth, L, light, () => false, 0, 1, -50, 10);
      expect(plinth.pos.length).toBeGreaterThan(0);
      expect(plinth.pos.every(Number.isFinite)).toBe(true);
      expect(plinth.shadowAt).toBeNull();
      const tops = plinth.pos.filter((_v, i) => i % 3 === 1);
      expect(Math.max(...tops)).toBe(2 + PLINTH);
      expect(gateHit(L, ...c.ray, 7, ...c.dir, 0, 30)).toBeCloseTo(10, 8);
      expect(gateHit(L, ...c.postRay, 7, ...c.dir, 0, 30)).toBeCloseTo(10, 8);
      expect(gateHit(L, ...c.ray, 70, ...c.dir, 0, 30)).toBe(Infinity);
      expect(gateHit(L, ...c.ray, 7, ...c.dir, 0, 9)).toBe(Infinity);
      const skip = gateSkip(map)!;
      expect(skip(...c.outside)).toBe(true);
      expect(skip(...c.floorCell)).toBe(false);
      expect(skip(c.outside[0] + 200, c.outside[1] + 200)).toBe(false);
      const world = gatePoint(gate, 3.25, -5.5);
      expect(gateLocal(gate, ...world)).toEqual([3.25, -5.5]);
    });
  }
});
