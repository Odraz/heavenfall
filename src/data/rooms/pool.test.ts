import { describe, expect, it } from 'vitest';
import { allowedOrientations } from '../../gen/assign';
import { templateFixture } from '../../gen/fixture';
import { PEARLY_POOL_R1 } from './1/index';
import { placedShapes, validateTemplate } from './validate';

const breach = PEARLY_POOL_R1.find((t) => t.kind === 'breach')!;

describe('the R1 room pool (rogue game.md §4.7)', () => {
  it('has the 10 combat templates and the 4 specials, ids unique', () => {
    expect(PEARLY_POOL_R1.map((t) => t.kind).filter((k) => k === 'combat').length).toBe(10);
    for (const k of ['breach', 'pardoner', 'confessional', 'boss']) expect(PEARLY_POOL_R1.filter((t) => t.kind === k).length).toBe(1);
    expect(new Set(PEARLY_POOL_R1.map((t) => t.id)).size).toBe(PEARLY_POOL_R1.length);
    // Six 1×1 combat templates: enough for any legal floor without a repeat (rogue r01.md coverage check).
    expect(PEARLY_POOL_R1.filter((t) => t.kind === 'combat' && t.shape === '1x1').length).toBe(6);
  });

  for (const t of PEARLY_POOL_R1) {
    it(`${t.id} meets rules 1–8 and 10`, () => {
      expect(validateTemplate(t)).toEqual([]);
    });

    it(`${t.id} passes the geometry rule in every allowed orientation (rule 9)`, () => {
      for (const shape of placedShapes(t)) {
        const allowed = allowedOrientations(t, shape);
        expect(allowed.length, `${t.id} as ${shape}`).toBeGreaterThan(0);
        for (const o of allowed) {
          const f = templateFixture(t, o, shape, breach);
          expect(f.errors.slice(0, 5), `${t.id} as ${shape}, orientation ${o}`).toEqual([]);
        }
      }
    });
  }

  it('identity and the transpose keep every non-fixed template valid (rogue game.md §3.4)', () => {
    for (const t of PEARLY_POOL_R1) {
      if (t.kind === 'boss') continue;
      if (t.shape === '2x1') {
        expect(allowedOrientations(t, '2x1')).toContain(0);
        expect(allowedOrientations(t, '1x2')).toContain(7);
      } else expect(allowedOrientations(t, t.shape), t.id).toEqual(expect.arrayContaining([0, 7]));
    }
  });
});

describe('the pool checks catch broken templates', () => {
  const ranged = PEARLY_POOL_R1.find((t) => t.id === 'pg-c-1x1-ranged-01')!;

  it('an untagged pillar', () => {
    const t = { ...ranged, obstacles: ranged.obstacles.filter((o) => o.purpose !== 'cover') };
    expect(validateTemplate(t).some((e) => e.includes('untagged wall'))).toBe(true);
  });

  it('a composition that misses its focus, and shares that don’t sum to 1', () => {
    const t = { ...ranged, waves: ranged.waves.map((w) => ({ ...w, mix: { blessed: 1 } })) };
    expect(validateTemplate(t).some((e) => e.includes('ranged focus'))).toBe(true);
    const u = { ...ranged, waves: ranged.waves.map((w) => ({ ...w, share: 0.3 })) };
    expect(validateTemplate(u).some((e) => e.includes('shares sum'))).toBe(true);
  });

  it('a lamp at a door, or a marker on a threshold, leaves no valid orientation', () => {
    const lamp = { ...ranged, props: [...ranged.props, { at: [14, 7] as [number, number], family: 'blast' as const, chance: 0.5 }] };
    expect(allowedOrientations(lamp, '1x1')).toEqual([]);
    const markers = ranged.markers.map((row, y) => (y === 2 ? row.slice(0, 13) + 'x' + row.slice(14) : row));
    expect(allowedOrientations({ ...ranged, markers }, '1x1')).toEqual([]);
  });

  it('a spawn point enemies can’t reach fails the fixture', () => {
    // Wall in the north-west spawn point (0, 0) on its own.
    const heights = ranged.heights.map((row, y) => (y === 1 ? '#' + row.slice(1) : y === 0 ? row[0] + '#' + row.slice(2) : row));
    const obstacles = [...ranged.obstacles, { rect: { x0: 0, y0: 0, x1: 1, y1: 1 }, purpose: 'cover' as const }];
    const f = templateFixture({ ...ranged, heights, obstacles }, 0, '1x1', breach);
    expect(f.errors.some((e) => e.includes("isn't enemy-reachable"))).toBe(true);
  });
});
