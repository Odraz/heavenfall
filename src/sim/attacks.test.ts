/** M9 stage 1: controls, the shared fire timer and the secondary attacks (M9 §2, §11.1). */
import { describe, expect, it, vi } from 'vitest';
import { CLASSES } from '../data/classes';
import { BLESSED, CHERUB, CHORISTER, GATEKEEPER } from '../data/enemies';
import {
  ATTACK_NONE,
  ATTACK_PRIMARY,
  ATTACK_SECONDARY,
  chooseAttack,
  FIRE_LEFT,
  FIRE_RIGHT,
  FIRE_RIGHT_LAST,
  SECONDARIES,
  WEAPONS,
  type AttackSlot,
} from '../data/weapons';
import { decodeSnapshot } from '../net/protocol';
import { estimateSilverBullet } from './combat';
import type { Simulation, SimPlayer } from './sim';
import { TICK_HZ } from './constants';
import { REVIVE_DECAY } from './souls';
import { enemyAt, makeSim, put, room } from './testutil/sims';

/** Records every attack fired: [slot, tick], without resolving it. */
function recordShots(sim: Simulation): Array<[AttackSlot, number]> {
  const shots: Array<[AttackSlot, number]> = [];
  vi.spyOn(sim, 'fireWeapon').mockImplementation((_p, slot = ATTACK_PRIMARY) => {
    shots.push([slot, sim.tick]);
  });
  return shots;
}

/** Puts the player's eye 0.8 m above the floor, aiming level along +x, so a level ray crosses every body. */
function aimLevel(sim: Simulation, p: SimPlayer, x: number, y: number): void {
  put(sim, p, x, y, 0, 0);
  p.z = -0.8;
}

const bulletEvents = (sim: Simulation) => sim.events.flatMap((e) => (e.event.type === 'silverBullet' ? [e.event] : []));

describe('controls (M9 §2.1)', () => {
  it('holding both buttons uses the one pressed last; releasing it returns to the other', () => {
    expect(chooseAttack('fallen', FIRE_LEFT, false)).toBe(ATTACK_PRIMARY);
    expect(chooseAttack('fallen', FIRE_RIGHT | FIRE_RIGHT_LAST, false)).toBe(ATTACK_SECONDARY);
    expect(chooseAttack('fallen', FIRE_LEFT | FIRE_RIGHT, false)).toBe(ATTACK_PRIMARY);
    expect(chooseAttack('fallen', FIRE_LEFT | FIRE_RIGHT | FIRE_RIGHT_LAST, false)).toBe(ATTACK_SECONDARY);
    // The right button released: back to the left.
    expect(chooseAttack('fallen', FIRE_LEFT, false)).toBe(ATTACK_PRIMARY);
    expect(chooseAttack('betrayer', 0, false)).toBe(ATTACK_NONE);
  });

  it("the Heretic heals whenever Sacrament can fire, whichever button was pressed last; otherwise the right button doesn't count", () => {
    expect(chooseAttack('heretic', FIRE_LEFT | FIRE_RIGHT, true)).toBe(ATTACK_SECONDARY);
    expect(chooseAttack('heretic', FIRE_LEFT | FIRE_RIGHT | FIRE_RIGHT_LAST, true)).toBe(ATTACK_SECONDARY);
    expect(chooseAttack('heretic', FIRE_LEFT | FIRE_RIGHT | FIRE_RIGHT_LAST, false)).toBe(ATTACK_PRIMARY);
    expect(chooseAttack('heretic', FIRE_RIGHT | FIRE_RIGHT_LAST, false)).toBe(ATTACK_NONE);
  });

  it('when the host finds the ally target invalid, a held left button fires censers', () => {
    // The ally is 43 m away: beyond Sacrament's 40 m.
    const sim = makeSim(room(60, 10), ['heretic', 'fallen']);
    const [h, ally] = sim.players;
    put(sim, h, 2.5, 5.5);
    put(sim, ally, 45.5, 5.5);
    h.fire = FIRE_LEFT | FIRE_RIGHT | FIRE_RIGHT_LAST;
    h.allyTargetId = ally.id;
    const shots = recordShots(sim);
    sim.step();
    expect(shots.map((s) => s[0])).toEqual([ATTACK_PRIMARY]);
  });
});

describe('the shared fire timer (M9 §2.2)', () => {
  it('a Silver Bullet followed by the primary: the next revolver shot comes 1.2 s later', () => {
    const sim = makeSim(room(30, 5), ['betrayer']);
    const p = sim.players[0];
    const shots = recordShots(sim);
    p.fire = FIRE_RIGHT | FIRE_RIGHT_LAST;
    sim.step();
    const t0 = sim.tick;
    p.fire = FIRE_LEFT;
    for (let i = 0; i < 60; i++) sim.step();
    expect(shots[0]).toEqual([ATTACK_SECONDARY, t0]);
    expect(shots[1]).toEqual([ATTACK_PRIMARY, t0 + 36]);
  });

  it("switching doesn't reset the timer, and an attack waiting for it still counts as held", () => {
    const sim = makeSim(room(30, 5), ['betrayer']);
    const p = sim.players[0];
    const shots = recordShots(sim);
    p.fire = FIRE_LEFT;
    sim.step();
    const t0 = sim.tick;
    // Switch to the Silver Bullet at once: it waits for the revolver's 0.3 s, then fires.
    p.fire = FIRE_LEFT | FIRE_RIGHT | FIRE_RIGHT_LAST;
    for (let i = 0; i < 10; i++) sim.step();
    expect(shots).toEqual([
      [ATTACK_PRIMARY, t0],
      [ATTACK_SECONDARY, t0 + 9],
    ]);
    // The timer kept counting while the Silver Bullet waited; nothing was reset.
    expect(p.fireTimer).toBeCloseTo(0.3 + 1.2 - 11 / 30, 9);
  });

  it('released, the timer stops at 0', () => {
    const sim = makeSim(room(30, 5), ['binder']);
    const p = sim.players[0];
    recordShots(sim);
    p.fire = FIRE_LEFT;
    sim.step();
    p.fire = 0;
    for (let i = 0; i < 10; i++) sim.step();
    expect(p.fireTimer).toBe(0);
  });

  it("a Heretic holding only the right button with no ally target holds nothing: the timer doesn't move", () => {
    const sim = makeSim(room(30, 5), ['heretic']);
    const p = sim.players[0];
    const shots = recordShots(sim);
    p.fire = FIRE_RIGHT | FIRE_RIGHT_LAST;
    for (let i = 0; i < 10; i++) sim.step();
    expect(shots).toEqual([]);
    expect(p.fireTimer).toBe(0);
    expect(p.shots2).toBe(0);
  });

  it('counts primary and secondary attacks separately', () => {
    const sim = makeSim(room(30, 5), ['fallen']);
    const p = sim.players[0];
    recordShots(sim);
    p.fire = FIRE_RIGHT | FIRE_RIGHT_LAST;
    for (let i = 0; i < 31; i++) sim.step();
    expect([p.shots, p.shots2]).toEqual([0, 2]);
  });
});

describe('attacks (M9 §2.3)', () => {
  it('have the new intervals', () => {
    expect(WEAPONS.betrayer).toMatchObject({ interval: 0.3, damage: 60, maxHits: 1, range: 60 });
    expect(SECONDARIES.fallen).toMatchObject({ interval: 1.0, damage: 60, maxHits: 1, range: 50 });
    expect(SECONDARIES.heretic).toMatchObject({ interval: 0.5, damage: 15, range: 40 });
    expect(SECONDARIES.binder).toMatchObject({ interval: 0.8, damage: 25, maxHits: 6, range: 3 });
    expect(SECONDARIES.betrayer).toMatchObject({ interval: 1.2, damage: 240, range: 60 });
  });

  it('the slug deals 60 to the first enemy only, up to 50 m', () => {
    const sim = makeSim(room(70, 5), ['fallen']);
    const p = sim.players[0];
    aimLevel(sim, p, 1.5, 2.5);
    const a = enemyAt(sim, CHORISTER, 20.5, 2.5);
    const b = enemyAt(sim, CHORISTER, 25.5, 2.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect([sim.eAlive[a], sim.eHp[b]]).toEqual([0, 60]);
    // In range at 50 m from the eye, not beyond.
    const near = enemyAt(sim, CHORISTER, 1.5 + 49.5 + 0.45, 3.5);
    const far = enemyAt(sim, CHORISTER, 1.5 + 50.5 + 0.45, 1.5);
    aimLevel(sim, p, 1.5, 3.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    aimLevel(sim, p, 1.5, 1.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect([sim.eAlive[near], sim.eHp[far]]).toEqual([0, 60]);
  });

  it('every hitscan attack revives with its own interval ÷ 3; the Scourge doesn’t revive', () => {
    for (const [cls, slot, interval] of [
      ['fallen', ATTACK_SECONDARY, 1.0],
      ['betrayer', ATTACK_SECONDARY, 1.2],
      ['betrayer', ATTACK_PRIMARY, 0.3],
    ] as const) {
      const sim = makeSim(room(30, 10), [cls, 'binder']);
      const [shooter, dead] = sim.players;
      put(sim, shooter, 2.5, 5.5);
      put(sim, dead, 10.5, 5.5);
      sim.damagePlayer(dead, 10000);
      sim.fireWeapon(shooter, slot);
      expect(dead.revive).toBeCloseTo(interval / 3, 9);
    }
    // The Scourge's arc covers a soul right in front of the Binder.
    const sim = makeSim(room(30, 10), ['binder', 'fallen']);
    const [binder, dead] = sim.players;
    put(sim, binder, 5.5, 5.5);
    put(sim, dead, 6.5, 5.5);
    sim.damagePlayer(dead, 10000);
    sim.fireWeapon(binder, ATTACK_SECONDARY);
    expect(dead.revive).toBe(0);
  });
});

describe('the Silver Bullet (M9 §2.4)', () => {
  /** A line of enemies along +x from x = 5, one per meter; returns their slots. */
  function line(sim: Simulation, types: number[], bound: (i: number) => boolean = () => false): number[] {
    return types.map((t, i) => {
      const s = enemyAt(sim, t, 5.5 + i, 2.5, t === CHERUB ? 0 : undefined);
      if (bound(i)) sim.root(s, 10);
      return s;
    });
  }

  function fire(types: number[], bound?: (i: number) => boolean): { sim: Simulation; slots: number[] } {
    const sim = makeSim(room(80, 4), ['betrayer']);
    const slots = line(sim, types, bound);
    aimLevel(sim, sim.players[0], 1.5, 2.5);
    sim.fireWeapon(sim.players[0], ATTACK_SECONDARY);
    return { sim, slots };
  }

  it('kills 12 Blessed in a line and stops at the 12th', () => {
    const { sim, slots } = fire(Array(13).fill(BLESSED));
    expect(slots.slice(0, 12).every((s) => !sim.eAlive[s])).toBe(true);
    expect(sim.eHp[slots[12]]).toBe(20);
    expect(sim.players[0].kills).toBe(12);
    // The tracer ends at the 12th, where the ray enters its cylinder.
    expect(bulletEvents(sim)[0].ex).toBeCloseTo(5.5 + 11 - 0.35, 6);
  });

  it('kills 24 bound Blessed', () => {
    const { sim, slots } = fire(Array(25).fill(BLESSED), () => true);
    expect(slots.slice(0, 24).every((s) => !sim.eAlive[s])).toBe(true);
    expect(sim.eHp[slots[24]]).toBe(20);
  });

  it('11 Blessed then a Chorister: the Chorister takes the remaining 20', () => {
    const { sim, slots } = fire([...Array(11).fill(BLESSED), CHORISTER]);
    expect(sim.eHp[slots[11]]).toBe(40);
  });

  it("11 Blessed then a bound Chorister: it takes 40 and survives with 20 (the doubling isn't applied twice)", () => {
    const { sim, slots } = fire([...Array(11).fill(BLESSED), CHORISTER], (i) => i === 11);
    expect(sim.eHp[slots[11]]).toBe(20);
  });

  it('a Chorister then 9 Blessed: all die, and a 10th is untouched', () => {
    const { sim, slots } = fire([CHORISTER, ...Array(10).fill(BLESSED)]);
    expect(slots.slice(0, 10).every((s) => !sim.eAlive[s])).toBe(true);
    expect(sim.eHp[slots[10]]).toBe(20);
  });

  it('the Gatekeeper absorbs the rest and stops it', () => {
    const sim = makeSim(room(80, 8), ['betrayer']);
    const blessed = [0, 1, 2, 3, 4].map((i) => enemyAt(sim, BLESSED, 5.5 + i, 4.5));
    const boss = enemyAt(sim, GATEKEEPER, 15.5, 4.5);
    const behind = enemyAt(sim, BLESSED, 20.5, 4.5);
    aimLevel(sim, sim.players[0], 1.5, 4.5);
    sim.fireWeapon(sim.players[0], ATTACK_SECONDARY);
    expect(blessed.every((s) => !sim.eAlive[s])).toBe(true);
    expect(sim.eHp[boss]).toBe(29000 - 140);
    expect(sim.eHp[behind]).toBe(20);
  });

  it("souls behind the enemy it stops at don't count", () => {
    const sim = makeSim(room(80, 4), ['betrayer', 'binder', 'fallen']);
    const [p, front, back] = sim.players;
    put(sim, front, 4.5, 2.5);
    put(sim, back, 25.5, 2.5);
    sim.damagePlayer(front, 10000);
    sim.damagePlayer(back, 10000);
    line(sim, Array(12).fill(BLESSED));
    aimLevel(sim, p, 1.5, 2.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(front.revive).toBeCloseTo(1.2 / 3, 9);
    expect(back.revive).toBe(0);
  });

  it("the client's estimate (full HP by type, ×2 for the rooted flag) stops where the host's does with unhurt enemies", () => {
    const types = [BLESSED, CHORISTER, BLESSED, CHERUB, CHORISTER, BLESSED, BLESSED, CHORISTER, BLESSED, BLESSED, CHORISTER, BLESSED, CHORISTER, BLESSED];
    const bound = (i: number) => i % 3 === 1;
    // The Cherub is put at ground level, so the level ray crosses it like the others.
    const { sim, slots } = fire(types, bound);
    const reachedOnHost = slots.filter((s) => sim.eHp[s] !== [20, 60, 30][sim.eType[s]] || !sim.eAlive[s]).length;
    const est = estimateSilverBullet(types.map((type, i) => ({ type, rooted: bound(i) })), 240);
    expect(est.reached).toBe(reachedOnHost);
    expect(est.stopped).toBe(true);
  });
});

describe('Sacrament (M9 §2.5)', () => {
  function setup(allyX = 12.5) {
    const sim = makeSim(room(60, 10), ['heretic', 'fallen']);
    const [h, ally] = sim.players;
    put(sim, h, 2.5, 5.5);
    put(sim, ally, allyX, 5.5);
    h.allyTargetId = ally.id;
    h.fire = FIRE_RIGHT | FIRE_RIGHT_LAST;
    return { sim, h, ally };
  }

  const beamOf = (sim: Simulation, id: number) => decodeSnapshot(sim.encodeFor(0)[0])!.players.find((p) => p.id === id)!.beam;

  it('heals the ally 15 every 0.5 s, capped at max HP', () => {
    const { sim, h, ally } = setup();
    ally.hp = 300;
    for (let i = 0; i < 30; i++) sim.step();
    expect(ally.hp).toBe(330);
    expect(h.shots2).toBe(2);
    ally.hp = 395;
    for (let i = 0; i < 15; i++) sim.step();
    expect(ally.hp).toBe(400);
  });

  it('revives a soul within 40 m like a hit of the Heretic: 1/3 per firing', () => {
    const { sim, h, ally } = setup();
    sim.damagePlayer(ally, 10000);
    sim.step();
    expect(ally.revive).toBeCloseTo(1 / 3 - REVIVE_DECAY / TICK_HZ, 9);
    expect(sim.sacramentTarget(h)).toBe(ally);
    // Three firings, less the decay between them, fall just short; the fourth revives.
    for (let i = 0; i < 45; i++) sim.step();
    expect(ally.dead).toBe(false);
    expect(ally.hp).toBe(200);
    const far = setup(45.5);
    far.sim.damagePlayer(far.ally, 10000);
    for (let i = 0; i < 10; i++) far.sim.step();
    expect([far.ally.revive, far.h.shots2]).toEqual([0, 0]);
  });

  it("needs a living ally or a soul within 40 m; with none it doesn't fire or touch the timer, and it never heals the Heretic", () => {
    const far = setup(45.5);
    far.ally.hp = 300;
    for (let i = 0; i < 10; i++) far.sim.step();
    expect([far.ally.hp, far.h.shots2, far.h.fireTimer]).toEqual([300, 0, 0]);
    const self = setup();
    self.h.allyTargetId = self.h.id;
    self.h.hp = 100;
    for (let i = 0; i < 10; i++) self.sim.step();
    expect([self.h.hp, self.h.shots2]).toEqual([100, 0]);
  });

  it('sets `beam` on firing and clears it 0.6 s after the last firing', () => {
    const { sim, h, ally } = setup();
    sim.step();
    expect(beamOf(sim, h.id)).toBe(ally.id);
    h.fire = 0;
    for (let i = 0; i < 17; i++) sim.step();
    expect(beamOf(sim, h.id)).toBe(ally.id);
    sim.step();
    expect(beamOf(sim, h.id)).toBe(255);
  });
});

describe('the Scourge (M9 §2.6)', () => {
  it('hits at most the 6 nearest within 3 m and the 120° arc for 25, slowing them for 1 s', () => {
    const sim = makeSim(room(20, 20), ['binder']);
    const p = sim.players[0];
    put(sim, p, 10.5, 10.5, 0);
    // 8 Choristers in front, from 1.2 m to 2.6 m away, alternating sides within 50°.
    const front = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
      const a = (i % 2 ? 1 : -1) * (i * 6 * Math.PI) / 180;
      const d = 1.2 + 0.2 * i + 0.45;
      return enemyAt(sim, CHORISTER, 10.5 + Math.cos(a) * d, 10.5 + Math.sin(a) * d);
    });
    const behind = enemyAt(sim, CHORISTER, 8.8, 10.5);
    const side = enemyAt(sim, CHORISTER, 10.5 + Math.cos(1.25) * 1.5, 10.5 + Math.sin(1.25) * 1.5);
    const beyond = enemyAt(sim, CHORISTER, 10.5 + 3.6, 10.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(front.map((s) => sim.eHp[s])).toEqual([35, 35, 35, 35, 35, 35, 60, 60]);
    expect(front.slice(0, 6).every((s) => sim.eSlowUntil[s] === sim.tick + 30)).toBe(true);
    expect([behind, side, beyond].map((s) => sim.eHp[s])).toEqual([60, 60, 60]);
  });

  it('fires with nothing in range', () => {
    const sim = makeSim(room(20, 20), ['binder']);
    const p = sim.players[0];
    p.fire = FIRE_RIGHT | FIRE_RIGHT_LAST;
    sim.step();
    expect(p.shots2).toBe(1);
    expect(p.fireTimer).toBeCloseTo(0.8 - 1 / 30, 9);
  });
});

describe('speeds (M9 §2.7)', () => {
  it('the Fallen and the Binder move at 6 m/s, in movement and the host’s speed check', () => {
    expect(CLASSES.fallen.speed).toBe(6);
    expect(CLASSES.binder.speed).toBe(6);
    const sim = makeSim(room(30, 5), ['binder']);
    const p = sim.players[0];
    expect(p.speed).toBe(6);
    put(sim, p, 2.5, 2.5);
    p.lastAcceptMs = 0;
    sim.applyInput(0, { seq: 1, x: 12.5, y: 2.5, z: 0, yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 }, 100);
    expect(p.x).toBeCloseTo(2.5 + 1.2 * 0.6 + 0.5, 6);
  });
});
