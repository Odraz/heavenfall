import { expect, it } from 'vitest';
import { LocalPlayer } from './localPlayer';
import { mapOf } from '../sim/testutil/maps';
import { room } from '../sim/testutil/sims';

it('a Dominion launch rises about two metres and throws six metres despite opposing movement, then lands', () => {
  const p = new LocalPlayer(4.5, 5.5, 0, 6), map = mapOf(room(24, 12));
  p.teleport(4.5, 5.5, 0, { dx: 1, dy: 0 });
  let peak = 0;
  for (let i = 0; i < 30; i++) { p.update(map, 1 / 60, -1, 0, true); peak = Math.max(peak, p.body.z); }
  expect(p.body.x).toBeCloseTo(10.5); expect(peak).toBeCloseTo(2.025, 2);
  for (let i = 0; i < 40; i++) p.update(map, 1 / 60, 0, 0, false);
  expect(p.body.grounded).toBe(true); expect(p.body.z).toBe(0); expect(p.body.x).toBeCloseTo(10.5);
});

it('launch collision stops at walls and a later room correction clears residual motion', () => {
  const p = new LocalPlayer(4.5, 5.5, 0, 6), map = mapOf(room(8, 12));
  p.teleport(4.5, 5.5, 0, { dx: 1, dy: 0 });
  for (let i = 0; i < 30; i++) p.update(map, 1 / 60, 0, 0, false);
  expect(p.body.x).toBeLessThanOrEqual(9 - p.body.radius);
  p.teleport(4.5, 5.5, 0, { dx: 1, dy: 0 });
  p.update(map, 1 / 60, 0, 0, false); p.teleport(2.5, 5.5, 0);
  p.update(map, 1 / 60, 0, 0, false);
  expect(p.body).toMatchObject({ x: 2.5, y: 5.5, z: 0, vz: 0, grounded: true });
});
