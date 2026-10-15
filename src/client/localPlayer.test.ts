import { expect, it } from 'vitest';
import { LocalPlayer } from './localPlayer';
import { mapOf } from '../sim/testutil/maps';
import { room } from '../sim/testutil/sims';

it('a Dominion launch rises about two metres and throws six metres despite opposing movement, then lands', () => {
  const p = new LocalPlayer(4.5, 5.5, 0, 6), map = mapOf(room(24, 12));
  p.teleport(4.5, 5.5, 0, { dx: 12, dy: 0 }); // the host's velocity, m/s, over half a second
  let peak = 0;
  for (let i = 0; i < 30; i++) { p.update(map, 1 / 60, -1, 0, true); peak = Math.max(peak, p.body.z); }
  expect(p.body.x).toBeCloseTo(10.5); expect(peak).toBeCloseTo(2.025, 2);
  for (let i = 0; i < 40; i++) p.update(map, 1 / 60, 0, 0, false);
  expect(p.body.grounded).toBe(true); expect(p.body.z).toBe(0); expect(p.body.x).toBeCloseTo(10.5);
});

it('launch collision stops at walls and a later room correction clears residual motion', () => {
  const p = new LocalPlayer(4.5, 5.5, 0, 6), map = mapOf(room(8, 12));
  p.teleport(4.5, 5.5, 0, { dx: 12, dy: 0 });
  for (let i = 0; i < 30; i++) p.update(map, 1 / 60, 0, 0, false);
  expect(p.body.x).toBeLessThanOrEqual(9 - p.body.radius);
  p.teleport(4.5, 5.5, 0, { dx: 12, dy: 0 });
  p.update(map, 1 / 60, 0, 0, false); p.teleport(2.5, 5.5, 0);
  p.update(map, 1 / 60, 0, 0, false);
  expect(p.body).toMatchObject({ x: 2.5, y: 5.5, z: 0, vz: 0, grounded: true });
});

for (const speed of [6, 8, 9]) it(`slows ordinary backward movement at speed ${speed}, preserving forward/strafe and ability movement`, () => {
  const map = mapOf(room(50, 50));
  const travel = (dx: number, dy: number, yaw = 0, wade = 1, jump = false) => {
    const p = new LocalPlayer(25, 25, 0, speed); p.yaw = yaw; p.wade = wade;
    for (let i = 0; i < 60; i++) p.update(map, 1 / 60, dx, dy, jump);
    return Math.hypot(p.body.x - 25, p.body.y - 25);
  };
  expect(travel(1, 0)).toBeCloseTo(speed);
  expect(travel(0, 1)).toBeCloseTo(speed);
  expect(travel(-1, 0)).toBeCloseTo(speed * 0.8);
  expect(travel(0, -1, Math.PI / 2)).toBeCloseTo(speed * 0.8);
  expect(travel(-1, 0, 0, 0.55, true)).toBeCloseTo(speed * 0.8 * 0.55);
  expect(travel(-Math.SQRT1_2, Math.SQRT1_2)).toBeCloseTo(speed * (1 - 0.2 * Math.SQRT1_2));
  const dash = new LocalPlayer(25, 25, 0, speed); dash.startDash(-1, 0);
  for (let i = 0; i < 4; i++) dash.update(map, 0.05, -1, 0, false);
  expect(dash.body.x).toBeCloseTo(17);
});
