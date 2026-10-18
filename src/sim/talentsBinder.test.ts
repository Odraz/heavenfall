/** R5: the Binder's talents in the simulation (classes-binder.md §3–§4), one or more checks per node. */
import { describe, expect, it } from 'vitest';
import { BLESSED, CANTOR, CHERUB, CHORISTER } from '../data/enemies';
import { BINDER, BOUNDARY, RING, WELL } from '../data/talents';
import { ATTACK_PRIMARY, ATTACK_SECONDARY, CHAINS_ROOT } from '../data/weapons';
import type { ClassId } from '../data/classes';
import { TICK_HZ } from './constants';
import { PHASE_CLEARED } from '../net/protocol';
import { PROJ_ARROW, PROJ_GLOBE, Simulation, type SimPlayer } from './sim';
import { dungeonOf } from './testutil/maps';
import { enemyAt, press, put, room } from './testutil/sims';

const id = (s: string) => `binder.${s}`;
function kit(sim: Simulation, p: SimPlayer, talents: string[], q = 'chains', e = 'discord'): void {
  sim.talents.setBuild(p, { talents: talents.map(id), rites: [], q, e });
}
/** An open 40 × 20 room that is one arena. */
function setup(classes: ClassId[] = ['binder'], w = 40, h = 20): Simulation {
  const dungeon = dungeonOf(room(w, h), { arenas: [{ id: 'a', name: 'A', rect: { x0: 1, y0: 1, x1: w, y1: h }, doors: [], entryCells: [[2, 2], [3, 2], [2, 3], [3, 3]], waves: [], boss: false }] });
  const sim = new Simulation({ dungeon, players: classes.map((classId, i) => ({ id: i, name: `P${i}`, classId })), seed: 1, noWaves: true });
  sim.random = () => 0.5;
  // Already cleared: its countdown, seal and clear stay out of these tests (a clear ends combat effects).
  sim.rooms[0].phase = PHASE_CLEARED;
  return sim;
}
/** Eye at 0.8 m over a floor of 0, so a level ray crosses every standing body. */
function level(sim: Simulation, p: SimPlayer, x: number, y: number, yaw = 0): void {
  put(sim, p, x, y, yaw, 0);
  p.z = -0.8;
}
const run = (sim: Simulation, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
const kill = (sim: Simulation, p: SimPlayer, s: number) => { const r = sim.talents.root(p, 'LMB'); sim.talents.primary(r, s, 10000, 10000); sim.talents.finish(r); };

describe('Tree A: Keeper of the Well', () => {
  it('Cast Down: the pile drops where the crosshair meets the floor, up to 15 m away', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['a.1a']);
    put(sim, p, 5.5, 10.5, 0, -Math.atan2(1.6, 12));
    const [x, y] = sim.chainsDestination(p);
    expect(x).toBeCloseTo(17.5, 0);
    expect(y).toBeCloseTo(10.5, 5);
    kit(sim, p, []);
    expect(sim.chainsDestination(p)[0]).toBeCloseTo(10.5, 5);
  });

  it('The Chain Holds: killing an enemy the Binder bound passes its remaining chain, without refreshing it', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['a.1b']);
    put(sim, p, 5.5, 10.5);
    const bound = enemyAt(sim, CANTOR, 15.5, 10.5), next = enemyAt(sim, CANTOR, 17.5, 10.5), far = enemyAt(sim, CANTOR, 25.5, 10.5);
    sim.talents.binder.bind(p, bound, 2, 1);
    const end = sim.eRootUntil[bound];
    kill(sim, p, bound);
    expect(sim.isRooted(next)).toBe(true);
    expect(sim.eRootUntil[next]).toBe(end);
    expect(sim.talents.binder.ownBound(next, p)).toBe(true);
    expect(sim.isRooted(far)).toBe(false);
  });

  it('Where They Fall: a launched enemy landing within 20 m of the Binder is chained for 2 s', () => {
    const sim = setup(['binder', 'fallen']);
    const [p, f] = sim.players;
    kit(sim, p, ['a.1a', 'a.2a']);
    put(sim, p, 5.5, 10.5); put(sim, f, 35.5, 18.5);
    const s = enemyAt(sim, CANTOR, 12.5, 10.5);
    sim.talents.launches.launch(s, 1, 0, 3, f, 'qe', sim.talents.launches.newCast());
    run(sim, 13);
    expect(sim.isRooted(s)).toBe(true);
    expect(sim.talents.binder.ownBound(s, p)).toBe(true);
  });

  it('Brought Low: a Cherub the Binder binds drops to the floor and stays there while bound', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['a.1a', 'a.2b']);
    put(sim, p, 5.5, 10.5);
    const c = enemyAt(sim, CHERUB, 12.5, 10.5, 4);
    sim.talents.binder.bind(p, c, 2.5, 1);
    run(sim, 12);
    expect(sim.eZ[c]).toBeCloseTo(0, 1);
    run(sim, 3 * TICK_HZ);
    expect(sim.eZ[c]).toBeGreaterThan(1);
  });

  it('The Well of the Giants: drags ground enemies within 7 m toward its center for 5 s and pools them', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['a.1a', 'a.1b', 'a.2a', 'a.3a'], 'chains', 'well');
    put(sim, p, 5.5, 10.5, 0, -Math.atan2(1.6, 10));
    press(p, 'E');
    sim.step();
    const well = sim.talents.areaOf(p.id, 'well')!;
    expect(well.x).toBeCloseTo(15.5, 0);
    expect(p.cdE).toBeGreaterThan(WELL.cooldown - 0.1);
    const s = enemyAt(sim, CANTOR, well.x + 5, 10.5);
    sim.root(enemyAt(sim, CANTOR, well.x - 5, 10.5), 10);
    const x0 = sim.eX[s];
    sim.talents.binder.pools();
    expect(sim.eX[s]).toBeCloseTo(x0 - WELL.drag / TICK_HZ, 5);
    expect(sim.ePooled[s]).toBe(1);
  });

  it('Sunk in the Lake: an own bind in a pool holds past its end, up to 6 s from the cast', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['a.1a', 'a.1b', 'a.2a', 'a.3b']);
    const s = enemyAt(sim, CANTOR, 20.5, 10.5);
    sim.talents.binder.bind(p, s, 2.5, 1);
    const ceiling = sim.tick + BINDER.ceiling * TICK_HZ;
    for (let i = 0; i < 8 * TICK_HZ; i++) { sim.tick++; sim.ePooled[s] = 1; sim.talents.binder.pools(); }
    expect(sim.eRootUntil[s]).toBe(ceiling);
  });

  it('All of Tartarus: Chains reaches every direction, cooldown 12 s', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['a.1a', 'a.1b', 'a.2a', 'a.2b', 'a.3b', 'a.cap']);
    put(sim, p, 20.5, 10.5);
    const behind = enemyAt(sim, BLESSED, 12.5, 10.5);
    press(p, 'Q');
    sim.step();
    expect(sim.isRooted(behind)).toBe(true);
    expect(p.cdQ).toBeGreaterThan(BINDER.tartarusCooldown - 0.1);
  });
});

describe('Tree B: Breaker of Giants', () => {
  it('Whirl: the Scourge swings all the way round, 1.2 s between swings', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1a']);
    put(sim, p, 20.5, 10.5);
    const behind = enemyAt(sim, CANTOR, 18.5, 10.5), hp = sim.eHp[behind];
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(sim.eHp[behind]).toBe(hp - 25);
    expect(sim.talents.binder.scourgeInterval(p)).toBe(BINDER.whirlInterval);
  });

  it('Iron Stride is a client wading rule: slowed enemies leave the count (wading.test)', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1b']);
    expect(p.kit.active.has('binder.b.1b')).toBe(true);
  });

  it('Voice of the Pit: Discord also throws the close ground ranks 4 m back', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.2a']);
    put(sim, p, 10.5, 10.5);
    const close = enemyAt(sim, CHORISTER, 15.5, 10.5), far = enemyAt(sim, CHORISTER, 25.5, 10.5);
    press(p, 'E');
    sim.step();
    expect(sim.talents.launches.airborne(close)).toBe(true);
    expect(sim.talents.launches.airborne(far)).toBe(false);
    expect(sim.eSilenceUntil[far]).toBeGreaterThan(sim.tick);
  });

  it('Fettered Hands: an enemy the Binder bound skips its blows', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.2b']);
    put(sim, p, 10.5, 10.5);
    const s = enemyAt(sim, BLESSED, 11.3, 10.5);
    sim.eTarget[s] = p.index;
    sim.talents.binder.bind(p, s, 2, 1);
    for (let i = 0; i < 20; i++) sim.updateMelee(s);
    expect(p.hp).toBe(p.maxHp);
  });

  it('Ring of the Giants: every enemy within 7 m is dragged to 2.5 m and bound, cooldown 10 s', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.1b', 'b.2a', 'b.3a'], 'ring');
    put(sim, p, 20.5, 10.5);
    const near = enemyAt(sim, CANTOR, 21.5, 10.5), far = enemyAt(sim, CANTOR, 20.5, 16), out = enemyAt(sim, CANTOR, 30.5, 10.5);
    press(p, 'Q');
    run(sim, 10);
    // On the 2.5 m ring, give or take the crowd's separation.
    expect(Math.abs(Math.hypot(sim.eX[near] - 20.5, sim.eY[near] - 10.5) - RING.ring)).toBeLessThan(0.1);
    expect(Math.abs(Math.hypot(sim.eX[far] - 20.5, sim.eY[far] - 10.5) - RING.ring)).toBeLessThan(0.1);
    expect(sim.isRooted(near)).toBe(true);
    expect(sim.talents.binder.ownBound(near, p)).toBe(true);
    expect(sim.isRooted(out)).toBe(false);
    expect(p.cdQ).toBeGreaterThan(RING.cooldown - 0.5);
  });

  it('The Long Flail: the Scourge reaches 4 m in its arc', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1b', 'b.2a', 'b.2b', 'b.3b']);
    put(sim, p, 20.5, 10.5);
    const s = enemyAt(sim, CANTOR, 23.9, 10.5), hp = sim.eHp[s];
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(sim.eHp[s]).toBe(hp - 25);
  });

  it('The Chains Shatter: a bound kill rings 20 into those within 2 m, once per action', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.1b', 'b.2a', 'b.2b', 'b.3a', 'b.cap'], 'ring');
    const a = enemyAt(sim, BLESSED, 20.5, 10.5), b = enemyAt(sim, BLESSED, 21.5, 10.5), other = enemyAt(sim, CANTOR, 21, 11.5), hp = sim.eHp[other];
    sim.root(a, 2); sim.root(b, 2);
    const r = sim.talents.root(p, 'RMB');
    sim.talents.primary(r, a, 1000, 1000); sim.talents.primary(r, b, 1000, 1000);
    sim.talents.finish(r);
    expect(sim.eHp[other]).toBe(hp - BINDER.shatterDamage);
  });
});

describe('Tree C: Warden of the Boundary', () => {
  it('Barbed Rounds: a bullet goes on into the next enemy, slowing both', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['c.1a']);
    const a = enemyAt(sim, CANTOR, 10.5, 10.5), b = enemyAt(sim, CANTOR, 12.5, 10.5), ha = sim.eHp[a], hb = sim.eHp[b];
    level(sim, p, 5.5, 10.5);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect([ha - sim.eHp[a], hb - sim.eHp[b]]).toEqual([12, 12]);
    expect(sim.eSlowUntil[b]).toBeGreaterThan(sim.tick);
  });

  it('Frost of Cocytus: kills leave slowing frost that pools; a nearby origin refreshes it', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['c.1b']);
    const a = enemyAt(sim, BLESSED, 20.5, 10.5);
    kill(sim, p, a);
    const frost = [...sim.talents.areas.values()].filter((x) => x.kind === 'frost');
    expect(frost).toHaveLength(1);
    const s = enemyAt(sim, CANTOR, 21, 10.5);
    sim.talents.binder.pools();
    expect(sim.ePooled[s]).toBe(1);
    expect(sim.eSlowUntil[s]).toBeGreaterThan(sim.tick);
    kill(sim, p, enemyAt(sim, BLESSED, 21.2, 10.5));
    expect([...sim.talents.areas.values()].filter((x) => x.kind === 'frost')).toHaveLength(1);
  });

  it('The Procession: Chains draws the enemy behind a target into a bound file', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['c.1a', 'c.2a']);
    level(sim, p, 5.5, 10.5);
    const target = enemyAt(sim, BLESSED, 15.5, 10.5), behind = enemyAt(sim, BLESSED, 17.5, 10.5);
    press(p, 'Q');
    run(sim, 10);
    expect(sim.isRooted(target)).toBe(true);
    expect(sim.isRooted(behind)).toBe(true);
    expect(Math.hypot(sim.eX[behind] - sim.eX[target], sim.eY[behind] - sim.eY[target])).toBeLessThan(1.6);
  });

  it('The Whip: the Scourge lashes a 7 m line instead of the 3 m arc', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['c.1a', 'c.2b']);
    put(sim, p, 10.5, 10.5);
    const far = enemyAt(sim, CANTOR, 16.5, 10.5), side = enemyAt(sim, CANTOR, 11.5, 12.5), hf = sim.eHp[far], hs = sim.eHp[side];
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(sim.eHp[far]).toBe(hf - 25);
    expect(sim.eHp[side]).toBe(hs);
  });

  it('The Boundary Chain: a 12 m floor chain binds each crossing enemy once for 2.5 s, for 8 s', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['c.1a', 'c.1b', 'c.2a', 'c.3a'], 'boundary');
    put(sim, p, 5.5, 10.5, 0, -Math.atan2(1.6, 10));
    press(p, 'Q');
    sim.step();
    const chain = sim.talents.areaOf(p.id, 'boundary')!;
    expect(Math.hypot(chain.x1 - chain.x, chain.y1 - chain.y)).toBeCloseTo(BOUNDARY.length, 0);
    expect(p.cdQ).toBeGreaterThan(BOUNDARY.cooldown - 0.1);
    const s = enemyAt(sim, CANTOR, (chain.x + chain.x1) / 2, 10.5);
    sim.talents.binder.pools();
    expect(sim.isRooted(s)).toBe(true);
    expect(sim.ePooled[s]).toBe(1);
    const until = sim.eRootUntil[s];
    sim.tick += 10; sim.talents.binder.pools();
    expect(sim.eRootUntil[s]).toBe(until);
  });

  it('Shattered Hymn: Discord also breaks globes (a 40 burst) and arrows in its cone', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['c.1a', 'c.1b', 'c.2a', 'c.3b']);
    put(sim, p, 5.5, 10.5);
    const near = enemyAt(sim, CANTOR, 15.5, 11.5), hp = sim.eHp[near];
    const globe = sim.spawnProjectile(PROJ_GLOBE, 15.5, 10.5, 1.5, -1, 0, 0, 0.0001, 0.3, 12, 60, -1);
    const arrow = sim.spawnProjectile(PROJ_ARROW, 12.5, 10.5, 1.5, -1, 0, 0, 0.0001, 0.15, 8, 60, -1);
    press(p, 'E');
    sim.step();
    expect(sim.pAlive[globe]).toBe(0);
    expect(sim.pAlive[arrow]).toBe(0);
    expect(sim.eHp[near]).toBeLessThan(hp);
  });

  it('The Wind of Cocytus: Discord\'s targets are bound for 2.5 s when its 4 s silence ends', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['c.1a', 'c.1b', 'c.2a', 'c.2b', 'c.3b', 'c.cap']);
    put(sim, p, 5.5, 10.5);
    const s = enemyAt(sim, CANTOR, 15.5, 10.5);
    press(p, 'E');
    sim.step();
    expect(sim.isRooted(s)).toBe(false);
    run(sim, 4 * TICK_HZ);
    expect(sim.isRooted(s)).toBe(true);
    expect(sim.eRootUntil[s] - sim.tick).toBeGreaterThan(2 * TICK_HZ);
  });
});

describe('own bind sources', () => {
  it('a Chains pull records the Binder\'s own bind when it completes', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, []);
    level(sim, p, 5.5, 10.5);
    const s = enemyAt(sim, BLESSED, 12.5, 10.5);
    press(p, 'Q');
    sim.step();
    expect(sim.talents.binder.ownBound(s, p)).toBe(true);
    run(sim, 10);
    expect(sim.talents.binder.ownBound(s, p)).toBe(true);
    run(sim, CHAINS_ROOT * TICK_HZ);
    expect(sim.talents.binder.ownBound(s, p)).toBe(false);
  });
});
