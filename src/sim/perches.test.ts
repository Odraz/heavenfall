import { expect, it } from 'vitest';
import { BLESSED } from '../data/enemies';
import { enemyAt, makeSim, put, room } from './testutil/sims';

it('takes the stairs to an adjacent raised target instead of walking into the ledge forever', () => {
  const heights = room(18, 18).map((row) => row.split(''));
  // Two-metre platform: its western face is a wall to walkers; stairs are to the south.
  for (let y = 4; y <= 12; y++) for (let x = 9; x <= 13; x++) heights[y][x] = '8';
  for (let y = 13; y <= 15; y++) for (let x = 10; x <= 12; x++) heights[y][x] = String((16 - y) * 2);
  const sim = makeSim(heights.map((row) => row.join('')), ['betrayer'], { noWaves: true, god: true });
  const p = sim.players[0]; put(sim, p, 9.5, 8.5);
  const s = enemyAt(sim, BLESSED, 8.5, 8.5);
  for (let i = 0; i < 600; i++) sim.step();
  expect(sim.eZ[s]).toBe(2);
  expect(Math.hypot(sim.eX[s] - p.x, sim.eY[s] - p.y)).toBeLessThan(1.3);
});
