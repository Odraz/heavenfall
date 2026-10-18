/** R5: the Heretic Saint's talents in the simulation (classes-heretic.md §3–§4), one or more checks per node. */
import { describe, expect, it } from 'vitest';
import { BLESSED, CANTOR, CHERUB, CHORISTER } from '../data/enemies';
import { HEAL_MOTE } from '../data/pickups';
import { BREAD, HERETIC, TRIAL, WITNESSES } from '../data/talents';
import { ATTACK_PRIMARY, ATTACK_SECONDARY, CLOUD_DAMAGE, CLOUD_TIME } from '../data/weapons';
import type { ClassId } from '../data/classes';
import { TICK_HZ } from './constants';
import { PHASE_CLEARED } from '../net/protocol';
import type { Simulation, SimPlayer } from './sim';
import { Simulation as Sim } from './sim';
import { dungeonOf } from './testutil/maps';
import { enemyAt, press, put, room } from './testutil/sims';

const id = (s: string) => `heretic.${s}`;
function kit(sim: Simulation, p: SimPlayer, talents: string[], q = 'communion', e = 'shroud'): void {
  sim.talents.setBuild(p, { talents: talents.map(id), rites: [], q, e });
}
/** An open 40 × 20 room that is one arena, so drops and room checks have a room. */
function setup(classes: ClassId[] = ['heretic'], w = 40, h = 20): Simulation {
  const dungeon = dungeonOf(room(w, h), { arenas: [{ id: 'a', name: 'A', rect: { x0: 1, y0: 1, x1: w, y1: h }, doors: [], entryCells: [[2, 2], [3, 2], [2, 3], [3, 3]], waves: [], boss: false }] });
  const sim = new Sim({ dungeon, players: classes.map((classId, id) => ({ id, name: `P${id}`, classId })), seed: 1, noWaves: true });
  // Already cleared: its countdown, seal and clear stay out of these tests (a clear ends combat effects).
  sim.rooms[0].phase = PHASE_CLEARED;
  return sim;
}
const run = (sim: Simulation, n: number) => { for (let i = 0; i < n; i++) sim.step(); };
/** Throws a censer straight at an enemy from 2 m and lets it break. */
function censerAt(sim: Simulation, p: SimPlayer, s: number): void {
  put(sim, p, sim.eX[s] - 3, sim.eY[s], 0, 0);
  p.z = sim.eZ[s] - 0.6;
  sim.fireWeapon(p, ATTACK_PRIMARY);
  for (let i = 0; i < 10 && sim.projectiles.length; i++) sim.step();
}
const fireCells = (sim: Simulation, p: SimPlayer) => sim.talents.fires.get(p.id)?.cells.size ?? 0;

describe('base clouds through the talent module', () => {
  it('a censer with no talents leaves one 3 m cloud for 4 s, published to everyone', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, []);
    const s = enemyAt(sim, CANTOR, 20.5, 10.5);
    censerAt(sim, p, s);
    expect(sim.clouds).toHaveLength(1);
    expect(sim.clouds[0].radius ?? 3).toBe(3);
    expect(sim.clouds[0].until - sim.clouds[0].from).toBe(CLOUD_TIME * TICK_HZ);
    expect(sim.talents.areaOf(p.id, 'cloud')).toBeDefined();
  });
});

describe('Tree A: Forbidden Physic', () => {
  it('Cunning Folk: a mote near the Saint flies to the most hurt player near it', () => {
    const sim = setup(['heretic', 'fallen', 'binder']);
    const [h, f, b] = sim.players;
    kit(sim, h, ['a.1a']);
    put(sim, h, 10.5, 10.5); put(sim, f, 13.5, 10.5); put(sim, b, 7.5, 10.5);
    f.hp = f.maxHp * 0.9; b.hp = b.maxHp * 0.3;
    sim.pickups.drop(HEAL_MOTE, sim.roomAt(11, 10), 11.5, 10.5, sim.tick);
    run(sim, 20);
    expect(b.hp).toBeGreaterThan(b.maxHp * 0.3);
    expect(f.hp).toBe(f.maxHp * 0.9);
  });

  it('Exorcism: Communion also throws the walking crowd within 5 m 4 m away (not Cherubs)', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['a.1b']);
    put(sim, p, 10.5, 10.5);
    const near = enemyAt(sim, CHORISTER, 13.5, 10.5), far = enemyAt(sim, CHORISTER, 17.5, 10.5), flyer = enemyAt(sim, CHERUB, 12.5, 11.5);
    press(p, 'Q');
    sim.step();
    expect(sim.talents.launches.airborne(near)).toBe(true);
    expect(sim.talents.launches.airborne(far)).toBe(false);
    expect(sim.talents.launches.airborne(flyer)).toBe(false);
  });

  it('In Both Kinds: Sacrament forks to the nearest other ally within 10 m of the healed one, never the Saint', () => {
    const sim = setup(['heretic', 'fallen', 'binder', 'betrayer']);
    const [h, f, b, t] = sim.players;
    kit(sim, h, ['a.1a', 'a.2a']);
    put(sim, h, 5.5, 10.5); put(sim, f, 12.5, 10.5); put(sim, b, 15.5, 10.5); put(sim, t, 30.5, 10.5);
    for (const q of [f, b, t]) q.hp = 50;
    h.hp = 50;
    h.allyTargetId = f.id;
    sim.fireWeapon(h, ATTACK_SECONDARY);
    expect(f.hp).toBe(50 + 15);
    expect(b.hp).toBe(50 + 15);
    expect(t.hp).toBe(50);
    expect(h.hp).toBe(50);
  });

  it('Lazarus: a mote the Saint collects bursts 20 within 2 m, at most every 0.5 s; a revival it completes bursts 50', () => {
    const sim = setup(['heretic', 'fallen']);
    const [h, f] = sim.players;
    kit(sim, h, ['a.1a', 'a.2b']);
    put(sim, h, 10.5, 10.5);
    const near = enemyAt(sim, CANTOR, 11.8, 10.5), full = sim.eHp[near];
    sim.talents.heretic.motePicked(h);
    sim.talents.heretic.motePicked(h);
    expect(sim.eHp[near]).toBe(full - HERETIC.lazarusMote);
    put(sim, f, 20.5, 10.5);
    const byAlly = enemyAt(sim, CANTOR, 22.5, 10.5), allyFull = sim.eHp[byAlly];
    sim.damagePlayer(f, 10000);
    expect(f.dead).toBe(true);
    sim.addRevive(f, 1, h);
    expect(f.dead).toBe(false);
    expect(sim.eHp[byAlly]).toBe(allyFull - HERETIC.lazarusRevive);
  });

  it('Bread of Angels: kills within 8 m drop heal motes, six per cast, for 6 s; cooldown 18 s', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['a.1a', 'a.1b', 'a.2b', 'a.3a'], 'communion', 'breadOfAngels');
    put(sim, p, 10.5, 10.5);
    press(p, 'E');
    sim.step();
    expect(p.cdE).toBeGreaterThan(BREAD.cooldown - 0.1);
    const motes = () => sim.pickups.live.filter((m) => m.kind === HEAL_MOTE).length;
    const before = motes();
    const root = sim.talents.root(p, 'LMB');
    for (let i = 0; i < 8; i++) sim.talents.primary(root, enemyAt(sim, BLESSED, 13.5, 8.5 + i * 0.5), 100, 100);
    expect(motes() - before).toBe(BREAD.motes);
    // A secondary (non-primary) kill harvests nothing.
    const other = enemyAt(sim, BLESSED, 12.5, 12.5);
    sim.damageEnemy(other, 100, p.index);
    expect(motes() - before).toBe(BREAD.motes);
  });

  it('The Long Chain: the censer flies through Blessed and breaks on a Chorister behind them', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['a.1a', 'a.1b', 'a.2b', 'a.3b']);
    const blessed = enemyAt(sim, BLESSED, 8.5, 10.5), chorister = enemyAt(sim, CHORISTER, 14.5, 10.5);
    put(sim, p, 4.5, 10.5);
    p.z = -0.4;
    sim.fireWeapon(p, ATTACK_PRIMARY);
    run(sim, 20);
    expect(sim.eHp[blessed] > 0 || sim.eAlive[blessed]).toBe(true);
    expect(sim.eHp[chorister]).toBeLessThan(60);
  });

  it('Resurrection of the Body: Communion raises each soul in reach at once and rallies motes to the healed', () => {
    const sim = setup(['heretic', 'fallen']);
    const [h, f] = sim.players;
    kit(sim, h, ['a.1a', 'a.1b', 'a.2b', 'a.3a', 'a.3b', 'a.cap'], 'communion', 'breadOfAngels');
    put(sim, h, 10.5, 10.5); put(sim, f, 14.5, 10.5);
    sim.damagePlayer(f, 10000);
    run(sim, 40);
    expect(f.dead).toBe(true);
    press(h, 'Q');
    sim.step();
    expect(f.dead).toBe(false);
    expect(f.hp).toBe(f.maxHp / 2);
    // The rally: a mote 12 m away flies to the hurt Saint.
    h.hp = 50;
    sim.pickups.drop(HEAL_MOTE, sim.roomAt(22, 10), 22.5, 10.5, sim.tick);
    run(sim, 30);
    expect(h.hp).toBeGreaterThan(50);
  });
});

describe('Tree B: The Burning Tombs', () => {
  it('Ploughshares: the censer leaves a 6 m burning furrow instead of a cloud', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1a']);
    const s = enemyAt(sim, CANTOR, 20.5, 10.5), beside = enemyAt(sim, CANTOR, 22.5, 10.5), hp = sim.eHp[beside];
    censerAt(sim, p, s);
    const furrow = sim.clouds.find((c) => c.furrow)!;
    expect(furrow).toBeDefined();
    expect(Math.hypot(furrow.x1! - furrow.x, furrow.y1! - furrow.y)).toBeCloseTo(HERETIC.furrowLength, 0);
    expect(sim.clouds.some((c) => !c.furrow)).toBe(false);
    expect(sim.eHp[beside]).toBeLessThan(hp);
    expect(sim.ePooled[beside]).toBe(1);
  });

  it('Kindling: a censer kill lights the cell where the angel fell for 3 s', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1b']);
    const s = enemyAt(sim, BLESSED, 20.5, 10.5);
    censerAt(sim, p, s);
    expect(sim.eAlive[s]).toBe(0);
    expect(sim.talents.fires.get(p.id)?.cells.size).toBe(1);
    expect(sim.events.some((e) => e.event.type === 'talentFx' && e.event.kind === 'kindle')).toBe(true);
  });

  it('Pitch: a slowed enemy that leaves the incense keeps taking its pulse for 2 s', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1b', 'b.2a']);
    const s = enemyAt(sim, CANTOR, 20.5, 10.5), full = sim.eHp[s];
    sim.slow(s, 5);
    sim.talents.heretic.addCloud({ x: 20.5, y: 10.5, z: 1, owner: p, from: sim.tick + 1, until: sim.tick + 200 });
    sim.tick++;
    sim.talents.heretic.updateClouds();
    sim.talents.pools();
    expect(sim.eHp[s]).toBe(full - CLOUD_DAMAGE);
    sim.eX[s] = 35.5;
    for (let i = 0; i < 15; i++) { sim.tick++; sim.talents.heretic.updateClouds(); sim.talents.pools(); }
    expect(sim.eHp[s]).toBe(full - 2 * CLOUD_DAMAGE);
    for (let i = 0; i < 60; i++) { sim.tick++; sim.talents.pools(); }
    expect(sim.eHp[s]).toBe(full - 4 * CLOUD_DAMAGE);
  });

  it('Wall of Fire: Communion also draws a burning ring 4 m around the Saint, leaving the center safe', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1b', 'b.2b']);
    put(sim, p, 10.5, 10.5);
    press(p, 'Q');
    sim.step();
    const fire = sim.talents.fires.get(p.id)!;
    expect(fire.cells.size).toBeGreaterThan(15);
    expect(fire.cells.has(10 * sim.map.w + 10)).toBe(false);
    expect(fire.cells.has(10 * sim.map.w + 14)).toBe(true);
  });

  it('Trial by Fire: for 4 s the floor within 1.5 m of the walked route burns; cooldown 14 s', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.1b', 'b.2a', 'b.3a'], 'communion', 'trialByFire');
    put(sim, p, 5.5, 10.5);
    press(p, 'E');
    sim.step();
    expect(p.cdE).toBeGreaterThan(TRIAL.cooldown - 0.1);
    for (let i = 0; i < 30; i++) { p.x += 0.3; sim.step(); }
    expect(sim.talents.fires.get(p.id)!.cells.has(10 * sim.map.w + 12)).toBe(true);
    const n = fireCells(sim, p);
    run(sim, 4 * TICK_HZ);
    p.x += 3; sim.step();
    expect(fireCells(sim, p)).toBeLessThan(n);
  });

  it('Irons in the Fire: a direct hit pins a pooled survivor for 1 s', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.1b', 'b.2a', 'b.3b']);
    const s = enemyAt(sim, CANTOR, 20.5, 10.5);
    sim.talents.fireOf(p).light(10 * sim.map.w + 20, sim.tick + 300, sim.tick);
    sim.talents.pools();
    expect(sim.ePooled[s]).toBe(1);
    censerAt(sim, p, s);
    expect(sim.isRooted(s)).toBe(true);
  });

  it('The Sixth Circle: a death on the Saint\'s fire spreads the 3 × 3 around it', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.1b', 'b.2a', 'b.3a', 'b.3b', 'b.cap'], 'communion', 'trialByFire');
    const s = enemyAt(sim, BLESSED, 20.5, 10.5);
    sim.talents.fireOf(p).light(10 * sim.map.w + 20, sim.tick + 300, sim.tick);
    sim.damageEnemy(s, 100, p.index);
    expect(fireCells(sim, p)).toBe(9);
  });
});

describe('Tree C: Martyrdom', () => {
  it('The Stake: a broken Shroud binds the close crowd for 1.5 s instead of its 50 burst', () => {
    const sim = setup(['heretic', 'fallen']);
    const [h, f] = sim.players;
    kit(sim, h, ['c.1a']);
    put(sim, f, 10.5, 10.5);
    const s = enemyAt(sim, CHORISTER, 12.5, 10.5);
    sim.giveShield(f, 150, 8, h);
    sim.damagePlayer(f, 1000);
    expect(sim.eHp[s]).toBe(60);
    expect(sim.isRooted(s)).toBe(true);
  });

  it('Walk in the Smoke is a client wading rule fed by the published incense', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['c.1b']);
    const s = enemyAt(sim, CANTOR, 20.5, 10.5);
    censerAt(sim, p, s);
    expect(sim.talents.areaOf(p.id, 'cloud')).toMatchObject({ x1: 3 });
  });

  it('The Altar: an impact within 3 m of a player makes a cloud that follows them', () => {
    const sim = setup(['heretic', 'fallen']);
    const [h, f] = sim.players;
    kit(sim, h, ['c.1a', 'c.2a']);
    const s = enemyAt(sim, CANTOR, 20.5, 10.5);
    put(sim, f, 21.5, 11.5);
    censerAt(sim, h, s);
    const cloud = sim.clouds[0];
    expect(cloud.wearer).toBe(f);
    f.x = 25.5; sim.step();
    expect(cloud.x).toBeCloseTo(25.5, 5);
  });

  it('Scapegoat: three 2 m clouds across the impact, square to the censer\'s flight', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['c.1a', 'c.2b']);
    const s = enemyAt(sim, CANTOR, 20.5, 10.5);
    censerAt(sim, p, s);
    expect(sim.clouds).toHaveLength(3);
    // Centers at the impact and 3 m to either side, square to the censer's flight along +x.
    expect(sim.clouds.map((c) => c.y).sort((a, b) => a - b)).toEqual([7.5, 10.5, 13.5]);
    expect(sim.clouds.every((c) => c.radius === HERETIC.scapegoatRadius)).toBe(true);
  });

  it('Cloud of Witnesses: a 5 m incense cloud on the aimed ally for 6 s, one per caster, cooldown 16 s', () => {
    const sim = setup(['heretic', 'fallen']);
    const [h, f] = sim.players;
    kit(sim, h, ['c.1a', 'c.1b', 'c.2a', 'c.3a'], 'cloudOfWitnesses');
    put(sim, h, 5.5, 10.5); put(sim, f, 15.5, 10.5);
    h.allyTargetId = f.id;
    press(h, 'Q');
    sim.step();
    expect(h.cdQ).toBeGreaterThan(WITNESSES.cooldown - 0.1);
    const c = sim.clouds.find((x) => x.witness)!;
    expect(c.wearer).toBe(f);
    expect(c.radius).toBe(WITNESSES.radius);
    expect(c.until - c.from).toBe(WITNESSES.life * TICK_HZ);
  });

  it('The Common Cause: a pooled enemy in the Saint\'s incense is slowed', () => {
    const sim = setup();
    const p = sim.players[0];
    kit(sim, p, ['c.1a', 'c.1b', 'c.2a', 'c.3b']);
    const s = enemyAt(sim, CANTOR, 20.5, 10.5);
    sim.talents.heretic.addCloud({ x: 20.5, y: 10.5, z: 1, owner: p, from: sim.tick, until: sim.tick + 200 });
    sim.talents.pools();
    expect(sim.eSlowUntil[s]).toBe(0);
    sim.talents.fireOf(p).light(10 * sim.map.w + 20, sim.tick + 300, sim.tick);
    sim.talents.pools();
    expect(sim.eSlowUntil[s]).toBeGreaterThan(sim.tick);
  });

  it('Pillar of Cloud: incense reaches a Cherub hovering above it', () => {
    for (const has of [false, true]) {
      const sim = setup();
      const p = sim.players[0];
      kit(sim, p, has ? ['c.1a', 'c.1b', 'c.2a', 'c.3a', 'c.3b', 'c.cap'] : ['c.1a'], has ? 'cloudOfWitnesses' : 'communion');
      const flyer = enemyAt(sim, CHERUB, 20.5, 10.5, 4);
      sim.talents.heretic.addCloud({ x: 20.5, y: 10.5, z: 0.5, owner: p, from: sim.tick, until: sim.tick + 200 });
      expect(sim.talents.heretic.censed(flyer)).toBe(has);
    }
  });
});
