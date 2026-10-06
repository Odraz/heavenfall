/** M9 stage 2: shotgun knockback, the Shroud burst, Field of Blood and the Gatekeeper (M9 §3, §4, §11.1). */
import { describe, expect, it, vi } from 'vitest';
import { BLESSED, CHORISTER, ENEMIES, GATEKEEPER } from '../data/enemies';
import { ABILITIES, ATTACK_PRIMARY, ATTACK_SECONDARY, FIRE_LEFT, FIRE_RIGHT, FIRE_RIGHT_LAST, type AttackSlot } from '../data/weapons';
import type { ArenaDef } from '../data/dungeons/types';
import { decodeSnapshot } from '../net/protocol';
import { fieldCenter, inField } from './field';
import { Simulation } from './sim';
import { dungeonOf } from './testutil/maps';
import { enemyAt, makeSim, press, put, room } from './testutil/sims';

const eventsOf = (sim: Simulation, type: string) => sim.events.map((e) => e.event).filter((e) => e.type === type);

describe('shotgun knockback (M9 §3.1)', () => {
  /** A Fallen at (5.5, 5.5) aiming along +x with no spread, so every pellet flies the same line. */
  function fallenSim() {
    const sim = makeSim(room(30, 11), ['fallen']);
    const p = sim.players[0];
    put(sim, p, 5.5, 5.5);
    p.z = -0.8;
    sim.random = () => 0.5;
    return { sim, p };
  }

  it('knocks back a survivor within 6 m by 2 m over 0.2 s, once per shot', () => {
    const { sim, p } = fallenSim();
    const c = enemyAt(sim, CHORISTER, 9.5, 5.5);
    sim.eHp[c] = 1000;
    sim.fireWeapon(p, ATTACK_PRIMARY);
    // All 8 pellets hit it (no spread), but it's knocked back once: 2 m over 6 ticks, away from the Fallen.
    expect(sim.eHp[c]).toBe(1000 - 96);
    expect(sim.eKbUntil[c]).toBe(sim.tick + 6);
    sim.root(c, 10); // so it doesn't walk; knockbacks still move rooted enemies (MVP §5.6)
    for (let i = 0; i < 6; i++) sim.step();
    expect(sim.eX[c]).toBeCloseTo(11.5, 5);
    expect(sim.eY[c]).toBeCloseTo(5.5, 5);
  });

  it("doesn't knock back rooted enemies, the Gatekeeper, killed ones or those beyond 6 m", () => {
    const { sim, p } = fallenSim();
    const rooted = enemyAt(sim, CHORISTER, 8.5, 5.5);
    sim.eHp[rooted] = 10000;
    sim.root(rooted, 10);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eKbUntil[rooted]).toBe(0);
    sim.removeEnemy(rooted);
    const far = enemyAt(sim, CHORISTER, 12.5 + 0.45, 5.5);
    sim.eHp[far] = 10000;
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eHp[far]).toBeLessThan(10000);
    expect(sim.eKbUntil[far]).toBe(0);
    const boss = enemyAt(sim, GATEKEEPER, 14.5, 5.5);
    sim.removeEnemy(far);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eHp[boss]).toBeLessThan(ENEMIES[GATEKEEPER].hp);
    expect(sim.eKbUntil[boss]).toBe(0);
  });

  it("the slug doesn't knock back", () => {
    const { sim, p } = fallenSim();
    const c = enemyAt(sim, CHORISTER, 8.5, 5.5);
    sim.eHp[c] = 1000;
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(sim.eKbUntil[c]).toBe(0);
  });
});

describe("Martyr's Shroud burst (M9 §3.3)", () => {
  function setup() {
    const sim = makeSim(room(30, 20), ['heretic', 'binder']);
    const [heretic, binder] = sim.players;
    put(sim, heretic, 3.5, 3.5);
    put(sim, binder, 15.5, 10.5);
    press(heretic, 'E', binder.id);
    sim.step();
    expect(binder.shield).toBe(150);
    // 10 Choristers around the Binder, from 1 m to 5.5 m away.
    const ring = Array.from({ length: 10 }, (_, i) => {
      const a = i * 0.6;
      const d = 1 + 0.5 * i + 0.45;
      return enemyAt(sim, CHORISTER, 15.5 + Math.cos(a) * d, 10.5 + Math.sin(a) * d);
    });
    for (const s of ring) sim.root(s, 30);
    sim.events.length = 0;
    return { sim, heretic, binder, ring };
  }

  it('bursts for 50 to the 8 nearest enemies within 5 m when damage breaks it, credited to the caster', () => {
    const { sim, heretic, binder, ring } = setup();
    sim.damagePlayer(binder, 100);
    expect(eventsOf(sim, 'shroudBurst')).toEqual([]);
    sim.damagePlayer(binder, 60);
    expect(binder.shield).toBe(0);
    expect(binder.hp).toBe(190);
    // Rooted, so bound: 50 × 2 kills a Chorister.
    expect(ring.map((s) => sim.eAlive[s])).toEqual([0, 0, 0, 0, 0, 0, 0, 0, 1, 1]);
    expect(heretic.kills).toBe(8);
    expect(eventsOf(sim, 'shroudBurst')).toEqual([{ type: 'shroudBurst', playerId: binder.id, x: 15.5, y: 10.5, z: 0 }]);
  });

  it('bursts even when the breaking hit kills the shielded player, where they stood', () => {
    const { sim, binder, ring } = setup();
    binder.hp = 10;
    sim.damagePlayer(binder, 500);
    expect(binder.dead).toBe(true);
    expect(sim.eAlive[ring[0]]).toBe(0);
    expect(eventsOf(sim, 'shroudBurst')).toHaveLength(1);
  });

  it("doesn't burst when it expires, is replaced, or its player leaves", () => {
    const a = setup();
    // Invulnerable meanwhile, so the Choristers' orbs don't break it.
    a.binder.god = true;
    for (let i = 0; i < 8 * 30; i++) a.sim.step();
    a.binder.god = false;
    expect(a.binder.shield).toBe(0);
    a.sim.damagePlayer(a.binder, 10);
    expect(eventsOf(a.sim, 'shroudBurst')).toEqual([]);
    const b = setup();
    b.sim.giveShield(b.binder, 150, 8, b.heretic);
    expect(eventsOf(b.sim, 'shroudBurst')).toEqual([]);
    const c = setup();
    c.sim.removePlayer(c.binder.id);
    expect(eventsOf(c.sim, 'shroudBurst')).toEqual([]);
  });

  it('still bursts after its caster died (credited) or left (credited to no one)', () => {
    const died = setup();
    died.sim.damagePlayer(died.heretic, 1000);
    died.sim.damagePlayer(died.binder, 150);
    expect(died.sim.eAlive[died.ring[0]]).toBe(0);
    expect(died.heretic.kills).toBe(8);
    const left = setup();
    left.sim.removePlayer(left.heretic.id);
    left.sim.damagePlayer(left.binder, 150);
    expect(left.sim.eAlive[left.ring[0]]).toBe(0);
    expect(left.heretic.kills).toBe(0);
  });
});

describe('Field of Blood (M9 §3.4)', () => {
  function sim2() {
    const sim = makeSim(room(40, 12), ['betrayer', 'binder', 'heretic']);
    return sim;
  }

  it('lands 3 m ahead along the yaw whatever the pitch, always going on cooldown (30 s)', () => {
    const sim = sim2();
    const p = sim.players[0];
    put(sim, p, 10.5, 6.5, 0, -1.2);
    press(p, 'Q');
    sim.step();
    expect([sim.fieldX, sim.fieldY, sim.fieldZ]).toEqual([13.5, 6.5, 0]);
    expect(p.cdQ).toBe(30);
    expect(ABILITIES.betrayer.Q).toMatchObject({ name: 'Field of Blood', cooldown: 30 });
    expect(eventsOf(sim, 'abilityUsed')).toContainEqual(expect.objectContaining({ playerId: 0, slot: 'Q', x: 13.5, y: 6.5, z: 0 }));
    // Facing a wall 1 m away it lands in front of the wall, and still cools down.
    p.cdQ = 0;
    put(sim, p, 39.2, 6.5, 0);
    press(p, 'Q');
    sim.step();
    expect(sim.fieldX).toBeCloseTo(40.95, 9);
    expect(p.cdQ).toBe(30);
  });

  it('players within 6 m fire twice as fast for 8 s; damage and cooldowns are unchanged; a new field replaces the old', () => {
    const sim = sim2();
    const [betrayer, binder, heretic] = sim.players;
    put(sim, betrayer, 10.5, 6.5, 0);
    put(sim, binder, 13.5 + 5.9, 6.5);
    put(sim, heretic, 13.5 - 6.2, 6.5);
    press(betrayer, 'Q');
    sim.step();
    expect([sim.inField(betrayer), sim.inField(binder), sim.inField(heretic)]).toEqual([true, true, false]);
    // The revolver fires every 0.075 s on average: 0.15 s of timer per 2/30 s per tick.
    const shots: Array<[number, number]> = [];
    vi.spyOn(sim, 'fireWeapon').mockImplementation((q) => {
      shots.push([q.index, sim.tick]);
    });
    betrayer.fire = FIRE_LEFT;
    const t0 = sim.tick + 1;
    for (let i = 0; i < 30; i++) sim.step();
    expect(shots.filter((s) => s[0] === 0).map((s) => s[1] - t0)).toEqual([0, 3, 5, 7, 9, 12, 14, 16, 18, 21, 23, 25, 27]);
    // Cooldowns run at their normal rate.
    expect(betrayer.cdQ).toBeCloseTo(30 - 30 / 30, 6);
    // The field ends after 8 s.
    for (let i = 0; i < 8 * 30; i++) sim.step();
    expect(sim.inField(betrayer)).toBe(false);
    // A new one replaces the old one.
    betrayer.cdQ = 0;
    put(sim, betrayer, 30.5, 6.5, 0);
    press(betrayer, 'Q');
    sim.step();
    expect(sim.fieldX).toBe(33.5);
  });

  it('outlives its dead Betrayer; dead players are not in it', () => {
    const sim = sim2();
    const [betrayer, binder] = sim.players;
    put(sim, betrayer, 10.5, 6.5, 0);
    put(sim, binder, 13.5, 6.5);
    press(betrayer, 'Q');
    sim.step();
    sim.damagePlayer(betrayer, 1000);
    expect(sim.inField(betrayer)).toBe(false);
    for (let i = 0; i < 100; i++) sim.step();
    expect(sim.inField(binder)).toBe(true);
  });

  it('Sacrament heals twice as often in it', () => {
    const sim = sim2();
    const [betrayer, binder, heretic] = sim.players;
    put(sim, betrayer, 10.5, 6.5, 0);
    put(sim, heretic, 13.5, 6.5);
    put(sim, binder, 20.5, 6.5);
    press(betrayer, 'Q');
    sim.step();
    binder.hp = 100;
    heretic.allyTargetId = binder.id;
    heretic.fire = FIRE_RIGHT | FIRE_RIGHT_LAST;
    for (let i = 0; i < 30; i++) sim.step();
    // Every 0.25 s instead of 0.5 s: 4 heals in 1 s.
    expect(binder.hp).toBe(140);
  });

  it("doesn't change what a Silver Bullet carries", () => {
    const sim = sim2();
    const [betrayer] = sim.players;
    put(sim, betrayer, 5.5, 6.5, 0);
    press(betrayer, 'Q');
    sim.step();
    const line = Array.from({ length: 16 }, (_, i) => enemyAt(sim, BLESSED, 10.5 + i, 6.5));
    betrayer.z = -0.8;
    sim.fireWeapon(betrayer, ATTACK_SECONDARY as AttackSlot);
    expect(line.filter((s) => !sim.eAlive[s])).toHaveLength(15);
  });

  it('counts a player by its ground within ±0.5 m of the center floor: a 0.5 m step yes, the 1 m ledge no, jumping still in', () => {
    // Floor digits are heights in 0.25 m steps: 2 = 0.5 m, 4 = 1 m.
    const heights = ['#################', '#000000002222444#', '#000000002222444#', '#000000000004444#', '#################'];
    const sim = makeSim(heights, ['betrayer']);
    const m = sim.map;
    expect(m.floor[1 * m.w + 10]).toBe(0.5);
    expect(m.floor[1 * m.w + 14]).toBe(1);
    const c: [number, number, number] = [9.0, 2.5, 0];
    expect(inField(m, ...c, 11.5, 2.5)).toBe(true); // on the 0.5 m step
    expect(inField(m, ...c, 14.6, 2.5)).toBe(false); // on the 1 m ledge, 5.6 m away
    expect(inField(m, ...c, 3.5, 2.5)).toBe(true);
    expect(inField(m, ...c, 2.9, 2.5)).toBe(false); // 6.1 m away
    // A jump changes the feet, not the ground under the circle.
    const p = sim.players[0];
    put(sim, p, 5.5, 2.5);
    sim.fieldX = 9;
    sim.fieldY = 2.5;
    sim.fieldZ = 0;
    sim.fieldUntil = sim.tick + 100;
    p.z = 1.2;
    expect(sim.inField(p)).toBe(true);
    // Tossed at the 1 m ledge it lands in front of it; tossed off a ledge it lands below.
    const [x1, y1, z1] = fieldCenter(m, 10.5, 3.5, 0);
    expect([x1, y1, z1]).toEqual([11.75, 3.5, 0]);
    const [x2, y2, z2] = fieldCenter(m, 14.5, 3.5, Math.PI);
    expect([x2, z2]).toEqual([11.5, 0]);
    expect(y2).toBeCloseTo(3.5, 9);
  });
});

describe('M9 audit additions (§11.1)', () => {
  it('the shotgun doesn\'t knock back an enemy its pellets killed', () => {
    const sim = makeSim(room(30, 11), ['fallen']);
    const p = sim.players[0];
    put(sim, p, 5.5, 5.5);
    p.z = -0.8;
    sim.random = () => 0.5;
    const b = enemyAt(sim, BLESSED, 8.5, 5.5);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eAlive[b]).toBe(0);
    expect(sim.eKbUntil[b]).toBe(0);
  });

  it('Field of Blood lands before a closed door', () => {
    // A corridor whose exit door at x 6 stays closed while its arena is idle.
    const heights = ['##########', '#00000000#', '#00000000#', '##########'];
    const markers = ['..........', '.SS...D...', '.SS...D...', '..........'];
    const arenas: ArenaDef[] = [
      { id: 'a', name: 'A', rect: { x0: 1, y0: 1, x1: 5, y1: 2 }, doors: [], exitDoors: [[6, 1], [6, 2]], entryCells: [[1, 1], [1, 2], [2, 1], [2, 2]], waves: [{ blessed: 1, choristers: 0, cherubs: 0 }], boss: false },
    ];
    const sim = new Simulation({ dungeon: dungeonOf(heights, { markers, arenas }), players: [{ id: 0, name: 'P', classId: 'betrayer' }], seed: 1 });
    expect(sim.map.solid[1 * sim.map.w + 6]).toBe(1);
    expect(fieldCenter(sim.map, 4.5, 1.5, 0)[0]).toBeCloseTo(5.75, 9);
  });

  it('a player is checked each tick: stepping out of the field slows the fire rate at once', () => {
    const sim = makeSim(room(40, 12), ['betrayer', 'binder']);
    const [betrayer, binder] = sim.players;
    put(sim, betrayer, 10.5, 6.5, 0);
    press(betrayer, 'Q');
    sim.step();
    put(sim, binder, 13.5, 6.5);
    expect(sim.inField(binder)).toBe(true);
    expect(sim.fireRate(binder)).toBe(2);
    put(sim, binder, 13.5 + 6.5, 6.5);
    expect(sim.inField(binder)).toBe(false);
    expect(sim.fireRate(binder)).toBe(1);
    put(sim, binder, 13.5 + 5.5, 6.5);
    expect(sim.fireRate(binder)).toBe(2);
  });

  it('in a field a revolver hit still deals 30 (no Field of Blood step in the pipeline)', () => {
    const sim = makeSim(room(40, 12), ['betrayer']);
    const p = sim.players[0];
    put(sim, p, 10.5, 6.5, 0);
    press(p, 'Q');
    sim.step();
    expect(sim.inField(p)).toBe(true);
    const c = enemyAt(sim, CHORISTER, 20.5, 6.5);
    p.z = -0.8;
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eHp[c]).toBe(30);
  });

  it('never sets enemy flag bit 1 (Kiss of Betrayal\'s mark is gone)', () => {
    const sim = makeSim(room(30, 11), ['binder']);
    const s = [enemyAt(sim, BLESSED, 10.5, 5.5), enemyAt(sim, CHORISTER, 12.5, 5.5), enemyAt(sim, BLESSED, 14.5, 5.5)];
    sim.root(s[0], 5);
    sim.slow(s[1], 5);
    sim.silence(s[2], 5);
    sim.damageEnemy(s[1], 10, 0);
    const snap = decodeSnapshot(sim.encodeFor(0)[0])!;
    expect(snap.enemyCount).toBe(3);
    for (let i = 0; i < snap.enemyCount; i++) expect(snap.enemyFlags[i] & 2).toBe(0);
  });

  it('sends silverBullet from the eye to where the ray stopped', () => {
    const sim = makeSim(room(80, 4), ['betrayer']);
    const p = sim.players[0];
    put(sim, p, 1.5, 2.5, 0, 0);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    // Nothing in the way: it stops at 60 m.
    expect(eventsOf(sim, 'silverBullet')).toEqual([{ type: 'silverBullet', playerId: 0, x: 1.5, y: 2.5, z: 1.6, ex: 61.5, ey: 2.5, ez: 1.6 }]);
  });
});
