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
});
