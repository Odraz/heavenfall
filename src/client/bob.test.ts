import { describe, expect, it } from 'vitest';
import { ViewBob } from './bob';

/** Sign changes of the weapon's sideways bob over `seconds` walking at full speed. */
function crossings(speed: number, seconds: number): number {
  const b = new ViewBob();
  const dt = 1 / 120;
  let n = 0;
  let last = 0;
  for (let t = 0; t < seconds; t += dt) {
    b.update(dt, speed * dt, speed, true, false);
    if (last !== 0 && Math.sign(b.weaponX) !== Math.sign(last)) n++;
    if (b.weaponX !== 0) last = b.weaponX;
  }
  return n;
}

describe('the walking bob (M8 §3.4)', () => {
  it('cycles once per 2.5 m stride at 6 m/s', () => {
    // 6 m/s over 10 s: 24 strides, 2 crossings each.
    expect(crossings(6, 10)).toBeGreaterThanOrEqual(47);
    expect(crossings(6, 10)).toBeLessThanOrEqual(48);
  });

  it("keeps the fast classes' weapons at the same pace (the M11 stage 2 playtest)", () => {
    expect(Math.abs(crossings(9, 10) - crossings(6, 10))).toBeLessThanOrEqual(1);
    expect(Math.abs(crossings(8, 10) - crossings(6, 10))).toBeLessThanOrEqual(1);
  });
});
