import { describe, expect, it } from 'vitest';
import { loadMap } from '../../sim/map';
import { DUNGEONS } from './index';
import { validateLevel } from './validate';

describe('level validation', () => {
  for (const def of Object.values(DUNGEONS)) {
    it(`${def.id} satisfies every rule in §8.1`, () => {
      const map = loadMap(def);
      expect(validateLevel(map, def.markers)).toEqual([]);
    });
  }

  it('detects a jump-only perch', () => {
    const def = DUNGEONS.sandbox;
    // Raise a 1 m block in the start room with no stairs: players can jump onto it, enemies can't.
    const heights = def.heights.map((row, r) => (r === 3 ? row.slice(0, 6) + '4' + row.slice(7) : row));
    const map = loadMap({ ...def, heights });
    expect(validateLevel(map, def.markers).some((e) => e.includes('jump-only perch'))).toBe(true);
  });

  it('detects a large decoration that players can reach', () => {
    const def = DUNGEONS.sandbox;
    // Lower the statue's pedestal to the arena floor.
    const map = loadMap(def);
    const statue = map.decorations.find((d) => d.id === 'angel-statue')!;
    const heights = def.heights.map((row, r) => (r === statue.r ? row.slice(0, statue.c) + '0' + row.slice(statue.c + 1) : row));
    const errors = validateLevel(loadMap({ ...def, heights }), def.markers);
    expect(errors.some((e) => e.includes("large decoration 'angel-statue'"))).toBe(true);
  });
});
