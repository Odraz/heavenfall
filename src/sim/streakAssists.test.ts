/** R9 B1: streak assists from states, clouds and the Field (rogue game.md §10), on the host. */
import { describe, expect, it } from 'vitest';
import { BLESSED } from '../data/enemies';
import { TICK_HZ } from './constants';
import type { Simulation, SimPlayer } from './sim';
import { enemyAt, makeSim, put, room } from './testutil/sims';
import { dungeonOf } from './testutil/maps';

function withRoom(classes: Array<'fallen' | 'betrayer' | 'binder' | 'heretic'>): Simulation {
  const geometry = room(40, 24), dungeon = dungeonOf(geometry);
  dungeon.rooms = [{ id: 'assists', name: 'Assists', kind: 'breach', rect: { x0: 1, y0: 1, x1: 40, y1: 24 },
    leaves: [], entry: [{ socket: 0, cells: [[2, 2], [3, 2], [4, 2], [5, 2]] }], waves: [], boss: false }];
  return makeSim(geometry, classes, { dungeon, noWaves: true });
}
/** A Binder or Heretic `b` sets up; the Betrayer `a` kills with a native shot. */
function pair(helper: 'binder' | 'heretic' | 'fallen' = 'binder'): [Simulation, SimPlayer, SimPlayer, number] {
  const sim = withRoom(['betrayer', helper]);
  const [a, b] = sim.players;
  put(sim, a, 3.5, 12.5); put(sim, b, 3.5, 20.5);
  const s = enemyAt(sim, BLESSED, 20.5, 12.5);
  sim.eHp[s] = 100;
  return [sim, a, b, s];
}
function kill(sim: Simulation, p: SimPlayer, s: number): void {
  sim.talents.primary(sim.talents.root(p, 'LMB'), s, 9999, 9999);
  sim.streaks.flush();
}
const run = (sim: Simulation, n: number) => { for (let i = 0; i < n; i++) sim.step(); };

describe('streak assists from states, clouds and the Field (§10)', () => {
  it('a bind counts the binder an assist', () => {
    const [sim, a, b, s] = pair();
    sim.root(s, 2, b.index);
    kill(sim, a, s);
    expect([a.streak, a.streakKills, b.streak, b.assists]).toEqual([1, 1, 1, 1]);
  });

  it('a slow counts the slower an assist', () => {
    const [sim, a, b, s] = pair();
    sim.slow(s, 2, b.index);
    kill(sim, a, s);
    expect([b.streak, b.assists]).toEqual([1, 1]);
  });

  it('a silence and a launch count too', () => {
    const [sim, a, b, s] = pair();
    sim.silence(s, 2, b.index);
    kill(sim, a, s);
    expect(b.assists).toBe(1);
    const [sim2, a2, f, s2] = pair('fallen');
    sim2.talents.launches.launchFrom(s2, 19.5, 12.5, 4, f, 'qe', sim2.talents.launches.newCast());
    kill(sim2, a2, s2);
    expect(f.assists).toBe(1);
  });

  it('a kill inside your incense cloud counts you an assist; outside it does not', () => {
    const [sim, a, h, s] = pair('heretic');
    sim.talents.heretic.addCloud({ x: sim.eX[s], y: sim.eY[s], z: 0, owner: h, from: sim.tick, until: sim.tick + 5 * TICK_HZ });
    kill(sim, a, s);
    expect(h.assists).toBe(1);
    const far = enemyAt(sim, BLESSED, 35.5, 4.5);
    kill(sim, a, far);
    expect(h.assists).toBe(1);
  });

  it('an enemy pooled in your Field of Blood, or a killer standing in it, counts you an assist', () => {
    const sim = withRoom(['fallen', 'betrayer']);
    const [f, b] = sim.players;
    put(sim, f, 3.5, 12.5); put(sim, b, 3.5, 20.5);
    const s = enemyAt(sim, BLESSED, 30.5, 12.5);
    Object.assign(sim, { fieldBy: b.index, fieldX: 30.5, fieldY: 12.5, fieldZ: 0, fieldStart: sim.tick, fieldUntil: sim.tick + 8 * TICK_HZ });
    run(sim, 1);
    expect(sim.ePooled[s]).toBe(1);
    kill(sim, f, s);
    expect(b.assists).toBe(1);
    // The killer in the Field: the victim far outside it.
    Object.assign(sim, { fieldX: f.x, fieldY: f.y });
    run(sim, 1);
    const out = enemyAt(sim, BLESSED, 36.5, 4.5);
    kill(sim, f, out);
    expect(b.assists).toBe(2);
  });

  it('counts each human once, however many ways they touched the enemy', () => {
    const [sim, a, b, s] = pair();
    sim.damageEnemy(s, 5, b.index);
    sim.slow(s, 2, b.index);
    sim.root(s, 2, b.index);
    kill(sim, a, s);
    expect([b.streak, b.assists]).toEqual([1, 1]);
    expect([a.streak, a.assists]).toEqual([1, 0]);
  });

  it('only inside 1.5 s: a slow applied 1.6 s ago no longer counts', () => {
    const [sim, a, b, s] = pair();
    sim.slow(s, 5, b.index);
    run(sim, Math.round(1.6 * TICK_HZ));
    expect(sim.eAlive[s]).toBe(1);
    kill(sim, a, s);
    expect(b.assists).toBe(0);
    expect(a.streak).toBe(1);
  });

  it('a state with no player source (a world effect) credits nobody', () => {
    const [sim, a, b, s] = pair();
    sim.slow(s, 2);
    sim.root(s, 2);
    kill(sim, a, s);
    expect(b.assists).toBe(0);
  });
});
