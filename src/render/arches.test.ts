import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons/index';
import { HEADROOM, K_DOOR, K_FLOOR, K_OPEN, PARAPET } from '../sim/heights';
import { loadMap } from '../sim/map';
import { archesBlock, archStoneHit, computeArches, DOOR_CROP, doorBayX, inOpening, OPENING, openingAt, REVEAL } from './arches';
import { CORNICE } from './looks';
import { inShadow, SUN } from './lightmap';

const MAPS = ['sandbox', 'pearly-gates'] as const;

describe('arches (M10 §6)', () => {
  for (const id of MAPS) {
    describe(id, () => {
      const map = loadMap(DUNGEONS[id]);
      const { w, h } = map;
      const hz = map.heights;
      const arches = computeArches(map);
      const kind = (c: number, r: number) => (c < 0 || r < 0 || c >= w || r >= h ? -1 : hz.kind[r * w + c]);

      it('every bay stands on 4 open-edge cells in a row, aligned to the 4 m grid', () => {
        for (const b of arches.bays) {
          expect(b.a0 % 4).toBe(0);
          expect(b.bay.cells).toHaveLength(4);
          b.bay.cells.forEach(([c, r], k) => {
            expect(kind(c, r)).toBe(K_OPEN);
            expect(b.ny !== 0 ? c : r).toBe(b.a0 + k);
          });
        }
      });

      it('no painted face overlaps a cornice band', () => {
        for (const b of arches.bays) expect(b.faceTop).toBeLessThanOrEqual(b.top - CORNICE + 1e-9);
        for (const d of arches.doors) expect(d.faceTop).toBeLessThanOrEqual(d.A - CORNICE + 1e-9);
      });

      it('every doorway arch is HEADROOM above every floor next to it, and its opening at L is the passage', () => {
        for (const d of arches.doors) {
          for (let a = Math.floor(d.a0) - 1; a <= Math.ceil(d.a1); a++) {
            for (const off of [-1, 0, 1]) {
              const c = d.ny !== 0 ? a : Math.floor(d.plane) + off;
              const r = d.ny !== 0 ? Math.floor(d.plane) + off : a;
              const k = kind(c, r);
              if (k === K_FLOOR || k === K_DOOR) expect(d.L).toBeGreaterThanOrEqual(map.floor[r * w + c] + HEADROOM - 1e-9);
            }
          }
          // The opening's sides at L meet the passage's sides.
          expect(doorBayX(d, d.a0)).toBeCloseTo(DOOR_CROP[0]);
          expect(doorBayX(d, d.a1)).toBeCloseTo(DOOR_CROP[1]);
          expect(openingAt(4)).toEqual(DOOR_CROP);
        }
        if (id === 'pearly-gates') expect(arches.doors.length).toBe(7);
      });

      it('no arcade face or reveal stands over a floor cell; every reveal lies inside its open-edge cells', () => {
        for (const b of arches.bays) {
          // The face is on the cells' inner edge; the reveal runs REVEAL outward, inside the cells.
          for (const [c, r] of b.bay.cells) {
            const outward = b.ny !== 0 ? (b.ny < 0 ? [c, r] : [c, r]) : [c, r];
            expect(kind(outward[0], outward[1])).toBe(K_OPEN);
          }
          expect(REVEAL).toBeLessThan(1);
          // The floor is on the face's normal side.
          const [c, r] = b.bay.cells[0];
          expect([K_FLOOR, K_DOOR]).toContain(kind(c + b.nx, r + b.ny));
        }
      });

      it('building them twice gives identical results', () => {
        expect(computeArches(loadMap(DUNGEONS[id]))).toEqual(arches);
      });
    });
  }

  it('the traced outline is symmetric about the bay\'s center, from the rail to the apex', () => {
    expect(OPENING.length).toBeLessThanOrEqual(32);
    for (const [x, z] of OPENING) expect(OPENING.some(([x2, z2]) => Math.abs(x2 - (4 - x)) < 1e-4 && Math.abs(z2 - z) < 1e-4)).toBe(true);
    expect(OPENING[0][1]).toBeCloseTo(PARAPET, 1);
    expect(inOpening(2, 3)).toBe(true);
    expect(inOpening(0.3, 3)).toBe(false);
    expect(inOpening(2, 6)).toBe(false);
  });
});

describe('the arcades in the light (M10 §5.2, stage 6)', () => {
  const map = loadMap(DUNGEONS['pearly-gates']);
  const arches = computeArches(map);
  const extra = (x: number, y: number, z: number) => archesBlock(arches, x, y, z, SUN.x, SUN.y, SUN.z, 400);
  // Arena 1's north arcade is sunlit (the sun is north-east). Find a floor point whose ray to the sun
  // crosses a bay's face at a given point (bay meters), going back from the face along the ray.
  const bay = arches.bays.find((b) => b.ny > 0 && b.a0 === 40)!;
  const pointBehind = (bx: number, bz: number) => {
    // The ray reaches height base + bz at the face: start at the floor, horizontally back along the sun.
    const t = (bz - 0.05) / SUN.z;
    return { x: bay.a0 + bx - SUN.x * t, y: bay.plane - SUN.y * t, z: bay.base + 0.05 };
  };

  it('a texel the sun reaches through an opening is lit, one behind a pier is in shadow', () => {
    const lit = pointBehind(2, 3);
    expect(inShadow(map, lit.x, lit.y, lit.z, extra)).toBe(false);
    const pier = pointBehind(0.2, 3);
    expect(inShadow(map, pier.x, pier.y, pier.z, extra)).toBe(true);
  });

  it('a ray through the face\'s opening that leaves through the reveal is in shadow', () => {
    // Near the opening's side: inside it at the face, but the ray runs sideways (+x) over REVEAL and
    // meets the reveal.
    const r = openingAt(3)!;
    const p = pointBehind(r[1] - 0.05, 3);
    expect(inShadow(map, p.x, p.y, p.z, extra)).toBe(true);
  });
});

describe('arcade tracers (M10 §6.1)', () => {
  const map = loadMap(DUNGEONS['pearly-gates']);
  const arches = computeArches(map);
  const bay = arches.bays.find((b) => b.ny > 0 && b.a0 === 40)!;
  // From inside Arena 1, aiming north at the arcade's face.
  const shoot = (bx: number, bz: number) => {
    const ox = bay.a0 + bx;
    const oy = bay.plane + 10;
    const oz = bay.base + bz;
    return archStoneHit(arches, ox, oy, oz, 0, -1, 0, 60);
  };

  it('a shot crossing a pier or the stone above the opening ends on the face', () => {
    expect(shoot(0.2, 3)).toBeCloseTo(10);
    expect(shoot(2, 6)).toBeCloseTo(10);
  });

  it('one through the opening does not', () => {
    expect(shoot(2, 3)).toBe(Infinity);
  });
});
