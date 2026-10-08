import { describe, expect, it } from 'vitest';
import { BLESSED, CHERUB, CHORISTER, GATEKEEPER } from '../data/enemies';
import { SHADOWSTEP_SPEED } from '../data/weapons';
import { ENEMY_SLOTS } from '../sim/constants';
import { mapOf } from '../sim/testutil/maps';
import { LocalPlayer } from './localPlayer';
import { WADE_LAUNCH_MS, wadeCount, wadeTarget, Wading, type WadeEnemies } from './wading';

/** A room with floor 0 at x 1–5 and a raised floor (height character `h`) at x 6–9. */
function room(h: string) {
  const row = '#' + '00000' + h.repeat(4) + '#';
  return mapOf(['#'.repeat(11), row, row, row, row, row, '#'.repeat(11)]);
}

function enemies(list: Array<[number, number, number]>): WadeEnemies {
  return {
    enemyCount: list.length,
    enemySlot: list.map((_, i) => i),
    enemyX: list.map(([, x]) => x),
    enemyY: list.map(([, , y]) => y),
    enemyType: list.map(([t]) => t),
  };
}

const NEVER = new Float64Array(ENEMY_SLOTS).fill(-Infinity);

describe('wading (M12 §3.1)', () => {
  const map = room('0');

  it('counts Blessed within 1.2 m horizontally, Choristers within 1.3 m', () => {
    expect(wadeCount(map, 3.5, 3.5, 0, enemies([[BLESSED, 3.5 + 1.19, 3.5]]), NEVER, 0)).toBe(1);
    expect(wadeCount(map, 3.5, 3.5, 0, enemies([[BLESSED, 3.5 + 1.21, 3.5]]), NEVER, 0)).toBe(0);
    expect(wadeCount(map, 3.5, 3.5, 0, enemies([[CHORISTER, 3.5, 3.5 + 1.29]]), NEVER, 0)).toBe(1);
    expect(wadeCount(map, 3.5, 3.5, 0, enemies([[CHORISTER, 3.5, 3.5 + 1.31]]), NEVER, 0)).toBe(0);
  });

  it("doesn't count Cherubs or the Gatekeeper", () => {
    expect(wadeCount(map, 3.5, 3.5, 0, enemies([[CHERUB, 3.6, 3.5], [GATEKEEPER, 3.4, 3.5]]), NEVER, 0)).toBe(0);
  });

  it("counts enemies whose feet are within 1.5 m of the player's, by the ground under them", () => {
    // An enemy on the raised floor at x 6.6 (it overlaps only raised cells), the player 1 m away at x 5.6.
    const at = enemies([[BLESSED, 6.6, 3.5]]);
    expect(wadeCount(room('6'), 5.6, 3.5, 0, at, NEVER, 0)).toBe(1); // 1.5 m up
    expect(wadeCount(room('7'), 5.6, 3.5, 0, at, NEVER, 0)).toBe(0); // 1.75 m up
    // A player standing on the raised floor counts it again.
    expect(wadeCount(room('7'), 5.6, 3.5, 1.75, at, NEVER, 0)).toBe(1);
  });

  it("doesn't count launched enemies until 0.4 s after the event arrived", () => {
    const launched = new Float64Array(ENEMY_SLOTS).fill(-Infinity);
    launched[0] = 1000 + WADE_LAUNCH_MS;
    const e = enemies([[BLESSED, 4, 3.5], [BLESSED, 3, 3.5]]);
    expect(wadeCount(map, 3.5, 3.5, 0, e, launched, 1000)).toBe(1);
    expect(wadeCount(map, 3.5, 3.5, 0, e, launched, 1000 + WADE_LAUNCH_MS - 1)).toBe(1);
    expect(wadeCount(map, 3.5, 3.5, 0, e, launched, 1000 + WADE_LAUNCH_MS)).toBe(2);
  });

  it('slows to 1 with none, 0.85 with one, 0.7 with two, 0.55 at three or more', () => {
    expect([0, 1, 2, 3, 4, 10].map(wadeTarget).map((v) => +v.toFixed(9))).toEqual([1, 0.85, 0.7, 0.55, 0.55, 0.55]);
  });

  it('eases toward its target: factor += (target − factor) × min(1, dt / 0.1)', () => {
    const w = new Wading();
    expect(w.update(2, 0.05)).toBeCloseTo(0.85, 9);
    expect(w.update(2, 0.05)).toBeCloseTo(0.775, 9);
    expect(w.update(2, 0.5)).toBeCloseTo(0.7, 9);
    expect(w.update(0, 0.01)).toBeCloseTo(0.73, 9);
  });

  it('slows walking, in the air too, but not the dash or the leap', () => {
    const p = new LocalPlayer(2.5, 3.5, 0, 6);
    p.wade = 0.55;
    p.update(map, 0.05, 1, 0, false);
    expect(p.body.x).toBeCloseTo(2.5 + 6 * 0.55 * 0.05, 6);
    // In the air.
    const air = new LocalPlayer(2.5, 3.5, 0, 6);
    air.wade = 0.55;
    air.update(map, 0.02, 0, 0, true);
    const x0 = air.body.x;
    air.update(map, 0.05, 1, 0, false);
    expect(air.body.grounded).toBe(false);
    expect(air.body.x - x0).toBeCloseTo(6 * 0.55 * 0.05, 6);
    // The dash keeps its speed.
    const dash = new LocalPlayer(1.5, 3.5, 0, 6);
    dash.wade = 0.55;
    dash.startDash(1, 0);
    dash.update(map, 0.05, 0, 0, false);
    expect(dash.body.x).toBeCloseTo(1.5 + SHADOWSTEP_SPEED * 0.05, 6);
    // The leap reaches its point in its 0.4 s.
    const leap = new LocalPlayer(1.5, 3.5, 0, 6);
    leap.wade = 0.55;
    leap.startLeap(4.5, 3.5, 0);
    for (let i = 0; i < 8; i++) leap.update(map, 0.05, 0, 0, false);
    expect(leap.body.x).toBeCloseTo(4.5, 6);
  });
});
