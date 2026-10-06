import { describe, expect, it } from 'vitest';
import { K_OPEN, K_VOID } from './heights';
import { makeSim, put } from './testutil/sims';

/** A strip 5 cells deep: `floor` floor cells inside a wall border, then `beyond` more wall columns. */
function strip(floor: number, beyond: number): string[] {
  const wall = '#'.repeat(floor + 2 + beyond);
  const row = '#' + '0'.repeat(floor) + '#'.repeat(1 + beyond);
  return [wall, row, row, row, row, row, wall];
}

/** Fires one censer east, level, from (2.5, 3.5); steps until it's gone; returns where it ended. */
function fire(heights: string[]) {
  const sim = makeSim(heights, ['heretic']);
  const p = sim.players[0];
  put(sim, p, 2.5, 3.5, 0, 0);
  sim.fireWeapon(p);
  const s = sim.projectiles[0];
  // The flight's private fields: where the range ends.
  const q = sim as unknown as Record<'pX' | 'pY' | 'pDx' | 'pDy' | 'pMaxDist', Float64Array>;
  const end = { x: q.pX[s] + q.pDx[s] * q.pMaxDist[s], y: q.pY[s] + q.pDy[s] * q.pMaxDist[s] };
  while (sim.projectiles.length) sim.step();
  return { sim, end };
}

describe('censers beyond the level (M10 §3.4)', () => {
  it('a censer whose range ends over a void cell vanishes: no cloud, no damage', () => {
    const { sim, end } = fire(strip(5, 40));
    const c = Math.floor(end.x);
    expect(sim.map.heights.kind[3 * sim.map.w + c]).toBe(K_VOID);
    expect(sim.clouds).toHaveLength(0);
  });

  it('one whose range ends over the level breaks and leaves its cloud', () => {
    const { sim } = fire(strip(40, 0));
    expect(sim.clouds).toHaveLength(1);
  });

  it('one whose range ends over an open-edge cell breaks and leaves its cloud', () => {
    const probe = fire(strip(5, 40));
    // Floor up to the cell before the end, so the end is over the open edge (the censer flies over
    // its 1.4 m parapet at eye height).
    const { sim, end } = fire(strip(Math.floor(probe.end.x) - 1, 5));
    expect(sim.map.heights.kind[3 * sim.map.w + Math.floor(end.x)]).toBe(K_OPEN);
    expect(sim.clouds).toHaveLength(1);
  });
});
