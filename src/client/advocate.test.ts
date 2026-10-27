import { describe, expect, it } from 'vitest';
import { PEARLY_POOL } from '../data/rooms/1';
import { generateFloor } from '../gen';
import { advocateMount } from './advocate';
import { RELIEF } from '../render/relief';

describe('the Advocate on the Confessional wall (rogue game.md §9.6)', () => {
  it('hangs on the wall beside its point in every orientation, facing into the room', () => {
    const facings = new Set<string>();
    for (let seed = 1; seed <= 40; seed++) {
      const { map, floor } = generateFloor(seed, 1, 1, PEARLY_POOL);
      const room = floor!.confessional;
      const [c, r] = map.rooms[room].points!.advocate!;
      const m = advocateMount(map, room)!;
      // Just in front of the wall face (and of its pilaster strips), half a cell from the point's center.
      expect(Math.hypot(m.x - (c + 0.5), m.y - (r + 0.5))).toBeCloseTo(0.5 - RELIEF - 0.02, 9);
      // Behind it a static wall cell; in front the room's floor.
      expect(map.wall[(r - m.ny) * map.w + c - m.nx]).toBe(1);
      expect(map.wall[(r + m.ny) * map.w + c + m.nx]).toBe(0);
      expect(map.roomOf[(r + m.ny) * map.w + c + m.nx]).toBe(room);
      facings.add(`${m.nx},${m.ny}`);
    }
    expect(facings.size).toBeGreaterThan(1);
  });
});
