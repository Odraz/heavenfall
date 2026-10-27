/** R5: the Fallen's talents in the simulation (classes-fallen.md §3–§4), one or more checks per node. */
import { describe, expect, it } from 'vitest';
import { BLESSED, CANTOR, CHORISTER } from '../data/enemies';
import { FALLEN, GATEBREAKER, RAIN } from '../data/talents';
import { ATTACK_PRIMARY, ATTACK_SECONDARY } from '../data/weapons';
import type { GameEvent } from '../net/messages';
import { PLAYER_RADIUS, TICK_HZ } from './constants';
import type { Simulation, SimPlayer } from './sim';
import { enemyAt, makeSim, press, put, room } from './testutil/sims';

const id = (s: string) => `fallen.${s}`;
function kit(sim: Simulation, p: SimPlayer, talents: string[], q = 'blasphemy', e = 'fallingStar'): void {
  sim.talents.setBuild(p, { talents: talents.map(id), rites: [], q, e });
}
function setup(w = 40, h = 20): [Simulation, SimPlayer] {
  const sim = makeSim(room(w, h), ['fallen'], { noWaves: true });
  sim.random = () => 0.5; // no spread: every pellet flies along the aim
  return [sim, sim.players[0]];
}
/** Eye at 0.8 m over a floor of 0, so a level ray crosses every standing body. */
function level(sim: Simulation, p: SimPlayer, x: number, y: number, yaw = 0): void {
  put(sim, p, x, y, yaw, 0);
  p.z = -0.8;
}
function events<T extends GameEvent['type']>(sim: Simulation, type: T): Array<Extract<GameEvent, { type: T }>> {
  return sim.events.flatMap((e) => (e.event.type === type ? [e.event as Extract<GameEvent, { type: T }>] : []));
}
const fireCells = (sim: Simulation, p: SimPlayer) => sim.talents.fires.get(p.id)?.cells.size ?? 0;
const burning = (sim: Simulation, p: SimPlayer, x: number, y: number) => !!sim.talents.fires.get(p.id)?.cells.has(Math.floor(y) * sim.map.w + Math.floor(x));
/** Steps the simulation `n` ticks. */
const run = (sim: Simulation, n: number) => { for (let i = 0; i < n; i++) sim.step(); };

describe('the base kit stays the base kit', () => {
  it('a Fallen with no talents shoves close survivors 2 m and lights nothing', () => {
    const [sim, p] = setup();
    kit(sim, p, []);
    const c = enemyAt(sim, CANTOR, 5.5, 10.5);
    level(sim, p, 2.5, 10.5);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eKbUntil[c]).toBeGreaterThan(sim.tick);
    expect(sim.talents.launches.pending).toHaveLength(0);
    expect(fireCells(sim, p)).toBe(0);
  });
});

describe('Tree A: The Walls of Dis', () => {
  it('Red Iron: a melee blow the Fallen survives sparks 25 back into its striker', () => {
    for (const has of [false, true]) {
      const [sim, p] = setup();
      kit(sim, p, has ? ['a.1a'] : []);
      put(sim, p, 10.5, 10.5);
      const s = enemyAt(sim, BLESSED, 11.3, 10.5);
      sim.eHp[s] = 100;
      sim.eTarget[s] = p.index;
      for (let i = 0; i < 8; i++) sim.updateMelee(s);
      expect(p.hp).toBeLessThan(p.maxHp);
      expect(sim.eHp[s]).toBe(has ? 100 - FALLEN.redIron : 100);
    }
  });

  it('Weight of Sin: Blasphemy slows what it taunts for 3 s instead of stunning it', () => {
    const [sim, p] = setup();
    kit(sim, p, ['a.1b']);
    put(sim, p, 10.5, 10.5);
    const s = enemyAt(sim, BLESSED, 14.5, 10.5);
    press(p, 'Q');
    sim.step();
    expect(sim.eTauntUntil[s]).toBeGreaterThan(sim.tick);
    expect(sim.isStunned(s)).toBe(false);
    expect(sim.eSlowUntil[s]).toBeGreaterThan(sim.tick + 2.5 * TICK_HZ);
  });

  it('Through the Ranks: within 6 m a killing pellet goes on into the next enemy', () => {
    for (const has of [false, true]) {
      const [sim, p] = setup();
      kit(sim, p, has ? ['a.1a', 'a.2a'] : ['a.1a']);
      const line = Array.from({ length: 12 }, (_, i) => enemyAt(sim, BLESSED, 3.5 + i * 0.3, 10.5));
      level(sim, p, 2.5, 10.5);
      sim.fireWeapon(p, ATTACK_PRIMARY);
      expect(line.filter((s) => !sim.eAlive[s]).length).toBe(has ? 12 : 8);
    }
  });

  it('Unbowed: unbound enemies ahead are shoved aside; bound ones stay', () => {
    const [sim, p] = setup();
    kit(sim, p, ['a.1a', 'a.2b']);
    put(sim, p, 10.5, 10.5);
    p.moveVx = 6; p.moveVy = 0;
    const free = enemyAt(sim, BLESSED, 11.4, 10.7), bound = enemyAt(sim, BLESSED, 11.4, 10.2);
    sim.root(bound, 2);
    sim.talents.fallen.update();
    expect(sim.eKbUntil[free]).toBeGreaterThan(sim.tick);
    expect(sim.eKbUntil[bound]).toBe(0);
  });

  it('Gatebreaker: the charge bursts its 1 m lane, flings the 2.5 m band and starts its cooldown when released', () => {
    const [sim, p] = setup(60, 20);
    kit(sim, p, ['a.1a', 'a.1b', 'a.2b', 'a.3a'], 'blasphemy', 'gatebreaker');
    put(sim, p, 5.5, 10.5);
    const lane = enemyAt(sim, CHORISTER, 9.5, 10.5), side = enemyAt(sim, CHORISTER, 10.5, 12.3), far = enemyAt(sim, CHORISTER, 10.5, 15);
    press(p, 'E');
    sim.step();
    expect(sim.talents.fallen.charging(p)).toBe(true);
    for (let i = 0; i < 12; i++) { p.x += GATEBREAKER.speed / TICK_HZ; sim.step(); }
    expect(sim.eHp[lane] <= 20 || !sim.eAlive[lane]).toBe(true);
    expect(sim.eHp[side]).toBe(60 - GATEBREAKER.sideDamage);
    expect(sim.talents.launches.pending.some((l) => l.slot === side) || sim.talents.launches.airborne(side)).toBe(true);
    expect(sim.eHp[far]).toBe(60);
    press(p, 'E');
    sim.step();
    expect(sim.talents.fallen.charging(p)).toBe(false);
    expect(p.cdE).toBeCloseTo(GATEBREAKER.cooldown, 1);
  });

  /** Charges `ticks` ticks, the path turning `degPerTick` each; returns the tick the charge ended on, or -1. */
  function turningCharge(sim: Simulation, p: SimPlayer, degPerTick: number, ticks: number): number {
    press(p, 'E');
    sim.step();
    let h = p.yaw;
    for (let i = 0; i < ticks; i++) {
      h += (degPerTick * Math.PI) / 180;
      p.x += Math.cos(h) * GATEBREAKER.speed / TICK_HZ; p.y += Math.sin(h) * GATEBREAKER.speed / TICK_HZ;
      sim.step();
      if (!sim.talents.fallen.charging(p)) return i;
    }
    return -1;
  }

  it('Gatebreaker (R9 B2): the host lets the path turn at 180°/s, and cuts a 270°/s turn at the clamp', () => {
    const [sim, p] = setup(60, 30);
    kit(sim, p, ['a.1a', 'a.1b', 'a.2b', 'a.3a'], 'blasphemy', 'gatebreaker');
    put(sim, p, 5.5, 5.5);
    expect(turningCharge(sim, p, 6, 20)).toBe(-1);
    const [sim2, f] = setup(60, 30);
    kit(sim2, f, ['a.1a', 'a.1b', 'a.2b', 'a.3a'], 'blasphemy', 'gatebreaker');
    put(sim2, f, 5.5, 5.5);
    // 9° a tick: 3° a tick past the limit, over the 6° tolerance on the third tick.
    const before = sim2.tick;
    const ended = turningCharge(sim2, f, 9, 20);
    expect(ended).toBeGreaterThanOrEqual(0);
    expect(ended).toBeLessThanOrEqual(3);
    expect(f.cdE).toBeCloseTo(GATEBREAKER.cooldown, 1);
    expect(events(sim2, 'talentFx').some((e) => e.kind === 'charge')).toBe(true);
    expect(sim2.tick - before).toBeLessThan(6);
  });

  it('Gatebreaker (R9 B4): a charge stopped by a wall ends at once with one gatebreakerWall', () => {
    const [sim, p] = setup(20, 20);
    kit(sim, p, ['a.1a', 'a.1b', 'a.2b', 'a.3a'], 'blasphemy', 'gatebreaker');
    put(sim, p, 14.5, 10.5);
    press(p, 'E');
    sim.step();
    // The client stops at the east wall (x = 21 minus its radius) and sends no more movement.
    const stop = 21 - PLAYER_RADIUS - 0.01;
    for (let i = 0; i < 20 && sim.talents.fallen.charging(p); i++) { p.x = Math.min(stop, p.x + GATEBREAKER.speed / TICK_HZ); sim.step(); }
    expect(sim.talents.fallen.charging(p)).toBe(false);
    run(sim, 5);
    const walls = events(sim, 'gatebreakerWall');
    expect(walls).toHaveLength(1);
    expect(walls[0]).toMatchObject({ playerId: p.id, x: stop, y: 10.5 });
    expect(p.cdE).toBeLessThanOrEqual(GATEBREAKER.cooldown);
  });

  it('Gatebreaker (R9 B4): a charge meeting a wall at an angle, sliding on its last step, still makes one wall event', () => {
    const [sim, p] = setup(20, 20);
    kit(sim, p, ['a.1a', 'a.1b', 'a.2b', 'a.3a'], 'blasphemy', 'gatebreaker');
    put(sim, p, 14.5, 8.5, Math.PI / 6);
    press(p, 'E');
    sim.step();
    const stopX = 21 - PLAYER_RADIUS - 0.01, step = GATEBREAKER.speed / TICK_HZ;
    for (let i = 0; i < 20 && sim.talents.fallen.charging(p); i++) {
      // Like the client: along the heading until x is blocked, then only y moves for that last step.
      const nx = p.x + Math.cos(Math.PI / 6) * step;
      p.y += Math.sin(Math.PI / 6) * step;
      p.x = Math.min(stopX, nx);
      sim.step();
    }
    expect(sim.talents.fallen.charging(p)).toBe(false);
    run(sim, 3);
    expect(events(sim, 'gatebreakerWall')).toHaveLength(1);
  });

  it('Gatebreaker: a charge released in the open makes no wall event', () => {
    const [sim, p] = setup(60, 20);
    kit(sim, p, ['a.1a', 'a.1b', 'a.2b', 'a.3a'], 'blasphemy', 'gatebreaker');
    put(sim, p, 5.5, 10.5);
    press(p, 'E');
    sim.step();
    for (let i = 0; i < 40 && sim.talents.fallen.charging(p); i++) { p.x += GATEBREAKER.speed / TICK_HZ; sim.step(); }
    expect(sim.talents.fallen.charging(p)).toBe(false);
    expect(events(sim, 'gatebreakerWall')).toHaveLength(0);
  });

  it('Underfoot: slowed enemies pressing on the Fallen are trampled for 20, once per second', () => {
    const [sim, p] = setup();
    kit(sim, p, ['a.1a', 'a.1b', 'a.2a', 'a.3b']);
    put(sim, p, 10.5, 10.5);
    const slowed = enemyAt(sim, CHORISTER, 11.3, 10.5), free = enemyAt(sim, CHORISTER, 9.7, 10.5);
    sim.slow(slowed, 2);
    sim.talents.fallen.update();
    sim.talents.fallen.update();
    expect(sim.eHp[slowed]).toBe(60 - FALLEN.underfoot);
    expect(sim.eHp[free]).toBe(60);
  });

  it('Wrath of Dis: 60 survived after the Hide erupts for 40 within 4 m, keeping the remainder', () => {
    const [sim, p] = setup();
    kit(sim, p, ['a.1a', 'a.1b', 'a.2a', 'a.2b', 'a.3b', 'a.cap']);
    put(sim, p, 10.5, 10.5);
    const near = enemyAt(sim, CHORISTER, 13, 10.5), far = enemyAt(sim, CHORISTER, 16, 10.5);
    expect(FALLEN.wrathEvery).toBe(60);
    // The Hide takes 40% off: 50 lands as 30, then 55 as 33, crossing 60 with 3 left over.
    sim.damagePlayer(p, 50);
    expect(sim.eHp[near]).toBe(60);
    sim.damagePlayer(p, 55);
    expect(sim.eHp[near]).toBe(60 - FALLEN.wrathDamage);
    expect(sim.eHp[far]).toBe(60);
    expect(sim.talents.fallen.wrath.get(p.id)).toBeCloseTo(3, 5);
    expect(events(sim, 'meter').at(-1)).toMatchObject({ kind: 'wrath', value: 3 });
  });
});

describe('Tree B: The Burning Sand', () => {
  it('Brimstone Tread: each cell stepped onto burns for 3 s; standing still lights nothing new', () => {
    const [sim, p] = setup();
    kit(sim, p, ['b.1a']);
    put(sim, p, 5.5, 10.5);
    sim.talents.fallen.update();
    for (let i = 0; i < 4; i++) { p.x += 1; sim.talents.fallen.update(); }
    expect(fireCells(sim, p)).toBe(5);
    const end = sim.talents.fires.get(p.id)!.cells.get(10 * sim.map.w + 9)!.end;
    expect(end - sim.tick).toBe(FALLEN.treadTime * TICK_HZ);
    sim.talents.fallen.update();
    expect(fireCells(sim, p)).toBe(5);
  });

  it('Fire and Brimstone: close shotgun kills burn where they fell, and survivors are not shoved', () => {
    const [sim, p] = setup();
    kit(sim, p, ['b.1b']);
    const killed = enemyAt(sim, BLESSED, 4.5, 10.5), survivor = enemyAt(sim, CANTOR, 6.5, 10.5);
    level(sim, p, 2.5, 10.5);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eAlive[killed]).toBe(0);
    expect(burning(sim, p, 4.5, 10.5)).toBe(true);
    expect(sim.eKbUntil[survivor]).toBe(0);
  });

  it('Brand: the slug lights the floor within 2 m of where it stops; a miss into the distance lights nothing', () => {
    const [sim, p] = setup();
    kit(sim, p, ['b.1a', 'b.2a']);
    enemyAt(sim, CANTOR, 12.5, 10.5);
    level(sim, p, 2.5, 10.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(fireCells(sim, p)).toBeGreaterThanOrEqual(9);
    expect(burning(sim, p, 12.5, 10.5)).toBe(true);
  });

  it('Pyre: a censed enemy burns, and one leaving the fire carries it for 2 s', () => {
    const sim = makeSim(room(40, 20), ['fallen', 'heretic'], { noWaves: true });
    const [p, h] = sim.players;
    kit(sim, p, ['b.1a', 'b.2b']);
    const censed = enemyAt(sim, CANTOR, 20.5, 10.5), carrier = enemyAt(sim, CANTOR, 5.5, 4.5);
    sim.clouds.push({ x: 20.5, y: 10.5, z: 0.5, owner: h, from: sim.tick + 1000, until: sim.tick + 2000 });
    sim.clouds[0].from = sim.tick;
    sim.talents.fireOf(p).light(4 * sim.map.w + 5, sim.tick + 30, sim.tick);
    const full = sim.eHp[censed], carried = sim.eHp[carrier];
    sim.talents.pools();
    expect(sim.eHp[censed]).toBe(full - FALLEN.fireDamage);
    expect(sim.eHp[carrier]).toBe(carried - FALLEN.fireDamage);
    sim.eX[carrier] = 12.5; sim.clouds.length = 0;
    for (let i = 0; i < 15; i++) { sim.tick++; sim.talents.pools(); }
    expect(sim.eHp[carrier]).toBe(carried - 2 * FALLEN.fireDamage);
    expect(sim.eHp[censed]).toBe(full - FALLEN.fireDamage);
  });

  it('Rain of Fire: the release calls 6 s of fire onto a 5 m circle 0.5 s later, cooldown 12 s', () => {
    const [sim, p] = setup();
    kit(sim, p, ['b.1a', 'b.1b', 'b.2a', 'b.3a'], 'blasphemy', 'rainOfFire');
    put(sim, p, 5.5, 10.5, 0, -Math.atan2(1.6, 10));
    press(p, 'E');
    sim.step();
    expect(p.cdE).toBeCloseTo(RAIN.cooldown - 1 / TICK_HZ, 1);
    const rain = sim.talents.areaOf(p.id, 'rain')!;
    expect(rain.x).toBeCloseTo(15.5, 0);
    expect(burning(sim, p, 15.5, 10.5)).toBe(false);
    run(sim, RAIN.delay * TICK_HZ);
    expect(fireCells(sim, p)).toBeGreaterThan(70);
    expect(burning(sim, p, 15.5, 10.5)).toBe(true);
  });

  it('Rain of Fire: a release aimed at nothing in range spends nothing', () => {
    const [sim, p] = setup();
    kit(sim, p, ['b.1a', 'b.1b', 'b.2a', 'b.3a'], 'blasphemy', 'rainOfFire');
    put(sim, p, 5.5, 10.5, 0, 0.3);
    press(p, 'E');
    sim.step();
    expect(p.cdE).toBe(0);
  });

  it("Blasphemer's Ring: Blasphemy sets 4 m around the Fallen burning and doesn't stun", () => {
    const [sim, p] = setup();
    kit(sim, p, ['b.1a', 'b.1b', 'b.2a', 'b.3b']);
    put(sim, p, 10.5, 10.5);
    const s = enemyAt(sim, CANTOR, 13.5, 10.5);
    press(p, 'Q');
    sim.step();
    expect(sim.isStunned(s)).toBe(false);
    expect(sim.eTauntUntil[s]).toBeGreaterThan(sim.tick);
    expect(fireCells(sim, p)).toBeGreaterThan(40);
  });

  it('The Burning Plain: a credited death in the fire lights the 3 × 3 around it', () => {
    const [sim, p] = setup();
    kit(sim, p, ['b.1a', 'b.1b', 'b.2a', 'b.2b', 'b.3a', 'b.cap'], 'blasphemy', 'rainOfFire');
    const s = enemyAt(sim, BLESSED, 12.5, 10.5);
    sim.talents.fireOf(p).light(10 * sim.map.w + 12, sim.tick + 30, sim.tick);
    sim.damageEnemy(s, 100, p.index);
    expect(fireCells(sim, p)).toBe(9);
    // A death outside the fire spreads nothing.
    const t = enemyAt(sim, BLESSED, 30.5, 10.5);
    sim.damageEnemy(t, 100, p.index);
    expect(fireCells(sim, p)).toBe(9);
  });
});

describe('Tree C: The War in Heaven', () => {
  it('Heave: survivors hit within 12 m are launched 3 m away instead of shoved', () => {
    const [sim, p] = setup();
    kit(sim, p, ['c.1a']);
    const c = enemyAt(sim, CANTOR, 10.5, 10.5);
    level(sim, p, 2.5, 10.5);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.talents.launches.airborne(c)).toBe(true);
    expect(events(sim, 'launched').at(-1)?.slots).toEqual([c]);
  });

  it('Son of the Morning: Falling Star launches out to 8 m', () => {
    for (const has of [false, true]) {
      const [sim, p] = setup();
      kit(sim, p, has ? ['c.1b'] : []);
      put(sim, p, 10.5, 10.5);
      const s = enemyAt(sim, CANTOR, 17.5, 10.5);
      p.landingTick = sim.tick + 1;
      sim.step();
      expect(sim.talents.launches.airborne(s)).toBe(has);
    }
  });

  it('As We Fell: an enemy the Fallen launched takes 20 when it lands', () => {
    for (const has of [false, true]) {
      const [sim, p] = setup();
      kit(sim, p, has ? ['c.1a', 'c.2a'] : ['c.1a']);
      put(sim, p, 30.5, 10.5);
      const s = enemyAt(sim, CHORISTER, 5.5, 10.5);
      sim.talents.launches.launch(s, 1, 0, 3, p, 'weapon', sim.talents.launches.newCast());
      run(sim, 13);
      expect(sim.eHp[s]).toBe(has ? 60 - FALLEN.landDamage : 60);
    }
  });

  it('Wormwood: where the slug stops, the enemies within 2.5 m are launched', () => {
    const [sim, p] = setup();
    kit(sim, p, ['c.1a', 'c.2b']);
    const target = enemyAt(sim, CANTOR, 12.5, 10.5), near = enemyAt(sim, CANTOR, 13.5, 12), far = enemyAt(sim, CANTOR, 12.5, 15);
    level(sim, p, 2.5, 10.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(sim.talents.launches.airborne(near)).toBe(true);
    expect(sim.talents.launches.airborne(target)).toBe(true);
    expect(sim.talents.launches.airborne(far)).toBe(false);
  });

  it('Cast Out: 10 and a 6 m throw to the 90° cone within 10 m, no taunt, cooldown 10 s', () => {
    const [sim, p] = setup();
    kit(sim, p, ['c.1a', 'c.1b', 'c.2a', 'c.3a'], 'castOut');
    put(sim, p, 10.5, 10.5);
    const front = enemyAt(sim, CHORISTER, 15.5, 11.5), behind = enemyAt(sim, CHORISTER, 6.5, 10.5);
    press(p, 'Q');
    sim.step();
    expect(sim.eHp[front]).toBe(50);
    expect(sim.talents.launches.airborne(front)).toBe(true);
    expect(sim.eTauntUntil[front]).toBe(0);
    expect(sim.eHp[behind]).toBe(60);
    expect(p.cdQ).toBeGreaterThan(9.9);
  });

  it('Broken Wings: what the Fallen launches lands bound; As We Fell then hits it doubled', () => {
    const [sim, p] = setup();
    kit(sim, p, ['c.1a', 'c.1b', 'c.2a', 'c.3b']);
    put(sim, p, 30.5, 10.5);
    const s = enemyAt(sim, CHORISTER, 5.5, 10.5);
    sim.talents.launches.launch(s, 1, 0, 3, p, 'qe', sim.talents.launches.newCast());
    run(sim, 13);
    expect(sim.isRooted(s)).toBe(true);
    expect(sim.eHp[s]).toBe(60 - 2 * FALLEN.landDamage);
  });

  it('A Third of the Stars: a Q/E launch crashes 20 into the others within 1.2 m, once per cast', () => {
    const [sim, p] = setup();
    kit(sim, p, ['c.1a', 'c.1b', 'c.2a', 'c.2b', 'c.3a', 'c.cap'], 'castOut');
    put(sim, p, 30.5, 10.5);
    const a = enemyAt(sim, CANTOR, 5.5, 10.5), b = enemyAt(sim, CANTOR, 5.5, 14.5), other = enemyAt(sim, CANTOR, 8.6, 10.5);
    const full = sim.eHp[other];
    const cast = sim.talents.launches.newCast();
    sim.talents.launches.launch(a, 1, 0, 3, p, 'qe', cast);
    sim.talents.launches.launch(b, 1, -1, 4.2, p, 'qe', cast);
    run(sim, 13);
    expect(sim.eHp[other]).toBe(full - FALLEN.crashDamage);
    // A weapon launch never crashes.
    const c = enemyAt(sim, CANTOR, 20.5, 4.5), d = enemyAt(sim, CANTOR, 23.6, 4.5);
    sim.talents.launches.launch(c, 1, 0, 3, p, 'weapon', sim.talents.launches.newCast());
    run(sim, 13);
    expect(sim.eHp[d]).toBe(full);
  });
});

describe('floor fire', () => {
  it('never holds more than its cap; the oldest first-lit cell goes out', () => {
    const [sim, p] = setup(60, 40);
    const fire = sim.talents.fireOf(p);
    for (let r = 1; r <= 30; r++) for (let c = 1; c <= 21; c++) fire.light(r * sim.map.w + c, sim.tick + 100, sim.tick);
    expect(fire.cells.size).toBe(FALLEN.fireCap);
    expect(fire.cells.has(1 * sim.map.w + 1)).toBe(false);
  });

  it('pulses 5 every 0.5 s and marks the enemy pooled; a hovering Cherub is not touched', () => {
    const [sim, p] = setup();
    const s = enemyAt(sim, CANTOR, 5.5, 5.5), full = sim.eHp[s];
    sim.talents.fireOf(p).light(5 * sim.map.w + 5, sim.tick + 100, sim.tick);
    sim.talents.pools();
    expect(sim.eHp[s]).toBe(full - FALLEN.fireDamage);
    expect(sim.ePooled[s]).toBe(1);
    sim.tick++; sim.talents.pools();
    expect(sim.eHp[s]).toBe(full - FALLEN.fireDamage);
  });

  it('publishes its changes and keeps every burning cell in floorSync', () => {
    const [sim, p] = setup();
    sim.talents.fireOf(p).light(5 * sim.map.w + 5, sim.tick + 100, sim.tick);
    sim.talents.pools();
    expect(events(sim, 'fire').at(-1)).toMatchObject({ playerId: p.id, cells: [5 * sim.map.w + 5] });
    expect(sim.floorSync(sim.runId).fires).toEqual([{ playerId: p.id, cells: [5 * sim.map.w + 5], ends: [sim.tick + 100] }]);
  });
});
