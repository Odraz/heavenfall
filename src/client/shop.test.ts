import { expect, it } from 'vitest';
import { loadRunMap } from '../sim/runMap';
import { PINNED } from '../gen/pinned';
import { pardonerSpot } from './shop';

it('the Pardoner stands on the base floor, clear of his plinth, in every orientation the floors use', () => {
  const orientations = new Set<number>();
  for (const seed of [PINNED.seed, 317434499, 12345, 987654, 4242, 777, 31337, 2026]) {
    const { map, floor } = loadRunMap({ heaven: 1, floor: 1, seed, fixture: null });
    const room = floor!.pardoner, rect = map.rooms[room].rect;
    orientations.add(map.rooms[room].orientation ?? 0);
    const spot = pardonerSpot(map, room);
    let base = Infinity, raised = 0;
    for (let r = rect.y0; r <= rect.y1; r++) for (let c = rect.x0; c <= rect.x1; c++) {
      const i = r * map.w + c;
      if (map.roomOf[i] === room && !map.solid[i]) base = Math.min(base, map.floor[i]);
    }
    expect(spot.z).toBe(base);
    // No raised plinth cell or wall within the sprite's half-width of where he stands.
    for (let r = Math.floor(spot.y - 0.9); r <= Math.floor(spot.y + 0.9); r++) for (let c = Math.floor(spot.x - 0.9); c <= Math.floor(spot.x + 0.9); c++) {
      const i = r * map.w + c;
      if (map.solid[i] || map.floor[i] !== base || map.roomOf[i] !== room) raised++;
    }
    expect(raised, `seed ${seed}`).toBe(0);
  }
  expect(orientations.size).toBeGreaterThan(1);
});
