/** R06 follow-up §7: Ploughshares' furrow burns as class floor fire on the cells its strip covers. */
import { expect, it } from 'vitest';
import { furrowCells } from './furrow';
import { loadMap } from '../sim/map';
import { dungeonOf } from '../sim/testutil/maps';
import { room } from '../sim/testutil/sims';

it('lights the floor cells within the furrow\'s 1.5 m width along its 6 m, and none through walls', () => {
  const map = loadMap(dungeonOf(room(20, 12)));
  const cells = furrowCells({ x: 4.5, y: 6.5, x1: 10.5, y1: 6.5 }, map);
  const rows = new Set(cells.map((i) => Math.floor(i / map.w))), cols = cells.map((i) => i % map.w);
  // One row along the strip's center line, 7 cells from end to end; the neighbouring rows are 1 m off, beyond 0.8 m.
  expect([...rows]).toEqual([6]);
  expect(Math.min(...cols)).toBe(4); expect(Math.max(...cols)).toBe(10);
  // A diagonal strip still covers its own width.
  expect(furrowCells({ x: 4, y: 4, x1: 8, y1: 8 }, map).length).toBeGreaterThan(5);
  map.solid[6 * map.w + 7] = 1;
  expect(furrowCells({ x: 4.5, y: 6.5, x1: 10.5, y1: 6.5 }, map)).not.toContain(6 * map.w + 7);
});
