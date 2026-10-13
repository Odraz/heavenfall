import { describe, expect, it } from 'vitest';
import { PEARLY_POOL_R1 } from '../data/rooms/1';
import { lampstands } from '../data/rooms/1/pg-c-1x1-elite-01';
import { fallbackLayout } from './fallback';
import { stampFloor } from './stamp';
import { cell } from './transform';
describe('type eligible authored spawn metadata', () => {
  for (let o = 0; o < 8; o++) it(`preserves canonical tags and both affinities under orientation ${o}`, () => {
    const fb = fallbackLayout(PEARLY_POOL_R1, 1);
    fb.assignment.templates[6] = { ...lampstands, spawnTags: [{ at: [0, 0], only: ['dominion'] }],
      spawnAffinity: { dominion: [{ x0: 0, y0: 0, x1: 7, y1: 0 }], chorister: [{ x0: 24, y0: 0, x1: 31, y1: 0 }] } };
    fb.assignment.orientations[6] = o;
    const s = stampFloor(fb.layout, fb.assignment), r = s.def.rooms[6], points = s.map.roomSpawnPoints[6];
    expect(s.errors).toEqual([]); expect(r.spawnTags).toHaveLength(1);
    const [x, y] = cell(o, 32, 32, [0, 0]);
    expect(points[r.spawnTags![0].index]).toEqual([r.rect.x0 + x, r.rect.y0 + y]);
    expect(r.dominion).toContain(r.spawnTags![0].index); expect(r.chorister).not.toContain(r.spawnTags![0].index);
    expect(r.dominion).toHaveLength(2); expect(r.chorister).toHaveLength(2);
  });
});
