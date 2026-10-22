/** R06 follow-up §8: the host sends each human only their own accepted damage, merged per enemy per tick. */
import { describe, expect, it } from 'vitest';
import { BLESSED, CHORISTER, ENEMIES } from '../data/enemies';
import { DAMAGE_STRIDE, HURT_MELEE, HURT_RANGED, HURT_WORLD } from '../net/protocol';
import { enemyAt, makeSim, put, room } from './testutil/sims';
import type { Simulation } from './sim';

const damageTo = (sim: Simulation, playerId: number) => sim.events.filter((e) => e.event.type === 'damage' && e.to === playerId)
  .map((e) => (e.event as { hits: number[] }).hits);

describe('damage events', () => {
  it('merges one tick of hits on an enemy into one entry, above its drawn head, to the credited player only', () => {
    const sim = makeSim(room(30, 10), ['fallen', 'binder'], { noWaves: true });
    const c = enemyAt(sim, CHORISTER, 10.5, 5.5), b = enemyAt(sim, BLESSED, 14.5, 5.5);
    sim.events.length = 0;
    sim.damageEnemy(c, 12, 0); sim.damageEnemy(c, 13, 0); sim.damageEnemy(b, 25, 0);
    sim.damageEnemy(c, 5, 1);
    sim.flushDamage();
    const [own] = damageTo(sim, 0);
    expect(own).toHaveLength(2 * DAMAGE_STRIDE);
    // The largest first; the killed Blessed counts only the 20 HP it had.
    expect(own.slice(0, DAMAGE_STRIDE)).toEqual([c, 10.5, 5.5, expect.closeTo(sim.eZ[c] + ENEMIES[CHORISTER].shot.top + 0.3, 1), 25, 0]);
    expect(own.slice(DAMAGE_STRIDE)).toEqual([b, 14.5, 5.5, expect.any(Number), 20, 1]);
    expect(damageTo(sim, 1)).toEqual([[c, 10.5, 5.5, expect.any(Number), 5, 0]]);
    sim.events.length = 0; sim.flushDamage();
    expect(damageTo(sim, 0)).toEqual([]);
  });

  it('sends nothing for world damage or bots', () => {
    const sim = makeSim(room(30, 10), ['fallen', 'binder'], { noWaves: true });
    sim.players[1].bot = true;
    const c = enemyAt(sim, CHORISTER, 10.5, 5.5);
    sim.events.length = 0;
    sim.damageEnemy(c, 10, -1); sim.damageEnemy(c, 10, 1); sim.flushDamage();
    expect(sim.events.filter((e) => e.event.type === 'damage')).toEqual([]);
  });

  it('flushes every tick from the simulation step', () => {
    const sim = makeSim(room(30, 10), ['fallen'], { noWaves: true });
    const c = enemyAt(sim, CHORISTER, 10.5, 5.5);
    sim.events.length = 0;
    sim.damageEnemy(c, 7, 0); sim.step();
    expect(damageTo(sim, 0).flat()[4]).toBe(7);
  });
});

describe('hurt events (R06 follow-up §9)', () => {
  it('tells the struck player where a melee blow came from, and world damage has no direction', () => {
    const sim = makeSim(room(30, 10), ['binder', 'fallen'], { noWaves: true });
    const [p, q] = sim.players;
    put(sim, p, 10.5, 5.5);
    const s = enemyAt(sim, BLESSED, 11.3, 5.5);
    sim.eTarget[s] = p.index;
    sim.events.length = 0;
    for (let i = 0; i < 8; i++) sim.updateMelee(s);
    sim.damagePlayer(p, 3);
    sim.damagePlayer(q, 4, { x: 1, y: 2, kind: HURT_RANGED });
    sim.flushDamage();
    const own = sim.events.filter((e) => e.event.type === 'hurt' && e.to === p.id).map((e) => (e.event as { hits: number[] }).hits);
    expect(own).toEqual([[11.3, 5.5, 5, HURT_MELEE, 10.5, 5.5, 3, HURT_WORLD]]);
    // The Fallen's Hide is applied first: 4 lands as 2.4.
    expect(sim.events.filter((e) => e.event.type === 'hurt' && e.to === q.id).map((e) => (e.event as { hits: number[] }).hits)).toEqual([[1, 2, 2.4, HURT_RANGED]]);
  });
});

describe('close-quarters charge (R06 follow-up §9 option 5)', () => {
  it('a kill within 5 m takes 0.25 s off Q and E, at most 2 s per second; farther kills do nothing', () => {
    const sim = makeSim(room(30, 10), ['fallen'], { noWaves: true });
    const p = sim.players[0]; put(sim, p, 10.5, 5.5);
    p.cdQ = 10; p.cdE = 8;
    const far = enemyAt(sim, CHORISTER, 17.5, 5.5);
    sim.damageEnemy(far, 100, 0);
    expect([p.cdQ, p.cdE]).toEqual([10, 8]);
    const near = enemyAt(sim, CHORISTER, 13.5, 5.5);
    sim.damageEnemy(near, 100, 0);
    expect([p.cdQ, p.cdE]).toEqual([9.75, 7.75]);
    // A burst of kills in one tick spends the rest of the 2 s budget: seven more count, the rest don't.
    for (let i = 0; i < 12; i++) sim.damageEnemy(enemyAt(sim, BLESSED, 12.5, 4.5 + (i % 3)), 100, 0);
    expect(p.cdQ).toBeCloseTo(8, 9); expect(p.cdE).toBeCloseTo(6, 9);
    // Half a second later, one more second of budget.
    sim.tick += 15;
    for (let i = 0; i < 6; i++) sim.damageEnemy(enemyAt(sim, BLESSED, 12.5, 5.5), 100, 0);
    expect(p.cdQ).toBeCloseTo(7, 9);
    // World kills credit nobody.
    const before = p.cdQ; sim.damageEnemy(enemyAt(sim, BLESSED, 12.5, 5.5), 100, -1); expect(p.cdQ).toBe(before);
  });
});
