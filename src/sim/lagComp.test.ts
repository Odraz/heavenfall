import { describe, expect, it } from 'vitest';
import { BLESSED } from '../data/enemies';
import { FIRE_LEFT } from '../data/weapons';
import { EnemyHistory, HISTORY_TICKS, MAX_REWIND_TICKS, NO_VIEW } from './lagComp';
import { aimAt, enemyAt, makeSim, put, room } from './testutil/sims';

/** A history of `slots` slots, slot 0 at x = tick (y 0, z 1) for ticks `from`..`to`. */
function history(from: number, to: number, slots = 4): EnemyHistory {
  const h = new EnemyHistory(slots);
  const x = new Float64Array(slots), y = new Float64Array(slots), z = new Float64Array(slots);
  for (let t = from; t <= to; t++) {
    x[0] = t; z[0] = 1;
    h.record(t, [0], 1, x, y, z);
  }
  return h;
}

describe('enemy history (lag compensation)', () => {
  it('interpolates between the two snapshot ticks the client drew, not the ticks between them', () => {
    const h = new EnemyHistory(2);
    const x = new Float64Array(2), y = new Float64Array(2), z = new Float64Array(2);
    // The enemy zig-zags: snapshot ticks 9 and 12 are at y 0 and 3, the ticks between elsewhere.
    for (const [t, ty] of [[9, 0], [10, 5], [11, -5], [12, 3]] as const) { y[0] = ty; h.record(t, [0], 1, x, y, z); }
    const out: [number, number, number] = [0, 0, 0];
    expect(h.positionAt(0, { tick: 9, gap: 3, frac: 1 / 3 }, out)).toBe(true);
    expect(out[1]).toBeCloseTo(1, 9);
    expect(h.positionAt(0, { tick: 12, gap: 0, frac: 0 }, out)).toBe(true);
    expect(out[1]).toBe(3);
  });

  it('clamps a view older than the rewind limit or newer than the history', () => {
    const h = history(0, 40);
    const out: [number, number, number] = [0, 0, 0];
    // 40 − 12: a view from tick 5 is resolved at the oldest allowed tick.
    h.positionAt(0, { tick: 5, gap: 3, frac: 0.5 }, out);
    expect(out[0]).toBe(40 - MAX_REWIND_TICKS);
    // A view past the newest record holds the newest.
    h.positionAt(0, { tick: 39, gap: 3, frac: 1 }, out);
    expect(out[0]).toBe(40);
    expect(HISTORY_TICKS).toBeGreaterThan(MAX_REWIND_TICKS);
  });

  it('knows nothing of a slot that was not alive at the view, or a slot recorded in an older lap of the ring', () => {
    const h = new EnemyHistory(2);
    const x = new Float64Array(2), y = new Float64Array(2), z = new Float64Array(2);
    h.record(1, [0], 1, x, y, z);
    for (let t = 2; t <= 1 + HISTORY_TICKS; t++) h.record(t, [1], 1, x, y, z);
    const out: [number, number, number] = [0, 0, 0];
    // Slot 0 was recorded at tick 1 only: its ring entry now belongs to tick 1 + HISTORY_TICKS.
    expect(h.positionAt(0, { tick: 1 + HISTORY_TICKS, gap: 0, frac: 0 }, out)).toBe(false);
    // Slot 1 spawned at tick 2: a view of tick 1 is clamped and finds no record.
    expect(h.positionAt(1, NO_VIEW, out)).toBe(false);
  });

  it('rewinds the living enemies and restores them, keeping what the attack moved', () => {
    const h = history(0, 10);
    const ex = new Float64Array(4), ey = new Float64Array(4), ez = new Float64Array(4);
    ex[0] = 10; ez[0] = 1; ex[1] = 7; // slot 1 has no history
    expect(h.rewind({ tick: 6, gap: 3, frac: 0 }, [0, 1], 2, ex, ey, ez)).toBe(1);
    expect([ex[0], ex[1]]).toEqual([6, 7]);
    // The attack knocks slot 0 back 0.5 m.
    ex[0] += 0.5;
    h.restore(ex, ey, ez);
    expect([ex[0], ey[0], ez[0], ex[1]]).toEqual([10.5, 0, 1, 7]);
    // No view moves nothing, nor does a view of where the enemy already is.
    expect(h.rewind(NO_VIEW, [0], 1, ex, ey, ez)).toBe(0);
    ex[0] = 10;
    expect(h.rewind({ tick: 10, gap: 0, frac: 0 }, [0], 1, ex, ey, ez)).toBe(0);
  });
});

describe('lag-compensated attacks on the host', () => {
  /** A Betrayer 12 m from a Blessed, aimed at it; the Blessed then strafes 1.5 m before the shot arrives. */
  function strafe(view: boolean) {
    const sim = makeSim(room(30, 20), ['betrayer'], { god: true });
    const p = sim.players[0];
    put(sim, p, 3.5, 10.5);
    const s = enemyAt(sim, BLESSED, 15.5, 10.5);
    aimAt(sim, p, s);
    sim.step();
    const seen = sim.tick;
    const [x, y] = [sim.eX[s], sim.eY[s]];
    aimAt(sim, p, s);
    sim.eY[s] += 1.5;
    p.view = view ? { tick: seen, gap: 0, frac: 0 } : NO_VIEW;
    p.fire = FIRE_LEFT;
    p.fireTimer = 0;
    sim.step();
    return { sim, s, x, y, p };
  }

  it('hits the enemy where the shooter saw it', () => {
    const { sim, s, p } = strafe(true);
    expect(p.shots).toBe(1);
    expect(sim.eAlive[s]).toBe(0);
  });

  it('without a view it resolves against the present, and misses', () => {
    const { sim, s, p } = strafe(false);
    expect(p.shots).toBe(1);
    expect(sim.eAlive[s]).toBe(1);
  });

  it('leaves an enemy it did not kill where the present has it', () => {
    const sim = makeSim(room(30, 20), ['binder'], { god: true });
    const p = sim.players[0];
    put(sim, p, 3.5, 10.5);
    const s = enemyAt(sim, BLESSED, 15.5, 10.5);
    aimAt(sim, p, s);
    sim.step();
    const seen = sim.tick;
    aimAt(sim, p, s);
    sim.eY[s] += 1.5;
    const y = sim.eY[s];
    // One Chain Gun bullet (12) leaves a Blessed (20) alive, slowed.
    p.view = { tick: seen, gap: 0, frac: 0 };
    p.fire = FIRE_LEFT;
    p.fireTimer = 0;
    sim.step();
    expect(sim.eAlive[s]).toBe(1);
    expect(sim.eHp[s]).toBeLessThan(20);
    expect(Math.abs(sim.eY[s] - y)).toBeLessThan(0.5);
  });

  it('records every tick, so an input from a client 0.3 s behind is resolved', () => {
    const sim = makeSim(room(30, 20), ['betrayer'], { god: true });
    enemyAt(sim, BLESSED, 15.5, 10.5);
    for (let i = 0; i < 20; i++) sim.step();
    expect(sim.enemyHistory.newest).toBe(sim.tick);
    const out: [number, number, number] = [0, 0, 0];
    expect(sim.enemyHistory.positionAt(sim.active[0], { tick: sim.tick - 9, gap: 3, frac: 0.5 }, out)).toBe(true);
  });
});
