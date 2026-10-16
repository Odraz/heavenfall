/** R4: the Betrayer's talents in the simulation (classes-betrayer.md §3–§4), its Rites and the Advocate. */
import { describe, expect, it } from 'vitest';
import { BLESSED, CHORISTER } from '../data/enemies';
import { ATTACK_PRIMARY, ATTACK_SECONDARY } from '../data/weapons';
import { RITE_FALLBACK_HALOS } from '../data/talents';
import { RITE_PAGE_HALOS } from '../data/pickups';
import { PHASE_COMBAT } from '../net/protocol';
import type { GameEvent } from '../net/messages';
import type { Simulation, SimPlayer } from './sim';
import { TICK_HZ } from './constants';
import { enemyAt, makeSim, press, put, room } from './testutil/sims';
import { arenaSim, sealAt } from './testutil/arenas';

const id = (s: string) => `betrayer.${s}`;
function kit(sim: Simulation, p: SimPlayer, talents: string[], q = 'field', e = 'shadowstep', rites: string[] = []): void {
  sim.talents.setBuild(p, { talents: talents.map(id), rites: rites.map(id), q, e });
}
/** Eye at 0.8 m over a floor of 0, so a level ray crosses every standing body. */
function level(sim: Simulation, p: SimPlayer, x: number, y: number, yaw = 0): void {
  put(sim, p, x, y, yaw, 0);
  p.z = -0.8;
}
function events<T extends GameEvent['type']>(sim: Simulation, type: T): Array<Extract<GameEvent, { type: T }>> {
  return sim.events.flatMap((e) => (e.event.type === type ? [e.event as Extract<GameEvent, { type: T }>] : []));
}

describe('base kit is unchanged', () => {
  it('a Betrayer with no talents fires the base revolver: one 60-damage hit, no extra events', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    const a = enemyAt(sim, BLESSED, 6.5, 4.5), b = enemyAt(sim, BLESSED, 8.5, 4.5);
    level(sim, p, 2.5, 4.5);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eAlive[a]).toBe(0);
    expect(sim.eAlive[b]).toBe(1);
    expect(events(sim, 'tracer')).toHaveLength(0);
    expect(events(sim, 'talentFx')).toHaveLength(0);
  });
});

describe('Tree A: The Long Watch', () => {
  it('Glancing Silver banks the Silver Bullet once off a wall with what it has left', () => {
    for (const glance of [false, true]) {
      const sim = makeSim(room(20, 8), ['betrayer']);
      const p = sim.players[0];
      kit(sim, p, glance ? ['a.1a'] : []);
      const behind = enemyAt(sim, BLESSED, 12.5, 5.5);
      level(sim, p, 2.5, 2.5, Math.PI / 4);
      sim.fireWeapon(p, ATTACK_SECONDARY);
      expect(sim.eAlive[behind]).toBe(glance ? 0 : 1);
      expect(events(sim, 'tracer').length).toBe(glance ? 1 : 0);
    }
  });

  it('the Judas Coin splits a revolver shot into three lines, center and ±15°', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['a.1a', 'a.1b', 'a.2b', 'a.3a'], 'judasCoin');
    level(sim, p, 2.5, 4.5);
    press(p, 'Q');
    sim.step();
    level(sim, p, 2.5, 4.5);
    const coin = sim.talents.areaOf(0, 'coin');
    expect(coin).toMatchObject({ x: 8.5, y: 4.5 });
    expect(p.cdQ).toBe(10);
    const c = Math.cos(Math.PI / 12) * 10, s = Math.sin(Math.PI / 12) * 10;
    const targets = [enemyAt(sim, BLESSED, 18.5, 4.5), enemyAt(sim, BLESSED, 8.5 + c, 4.5 - s), enemyAt(sim, BLESSED, 8.5 + c, 4.5 + s)];
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(targets.map((t) => sim.eAlive[t])).toEqual([0, 0, 0]);
    expect(sim.talents.areaOf(0, 'coin')).toBeUndefined();
    expect(events(sim, 'tracer')).toHaveLength(3);
  });

  it('refuses the coin without cooldown when a wall leaves no room for it', () => {
    const sim = makeSim(room(4, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['a.1a', 'a.1b', 'a.2b', 'a.3a'], 'judasCoin');
    level(sim, p, 4.2, 4.5);
    press(p, 'Q');
    sim.step();
    expect(sim.talents.areaOf(0, 'coin')).toBeUndefined();
    expect(p.cdQ).toBe(0);
  });

  it('The Halt and the Lame: a revolver shot through a slowed kill goes on to the next enemy', () => {
    for (const slowed of [false, true]) {
      const sim = makeSim(room(30, 8), ['betrayer']);
      const p = sim.players[0];
      kit(sim, p, ['a.1b', 'a.2a']);
      const a = enemyAt(sim, BLESSED, 6.5, 4.5), b = enemyAt(sim, BLESSED, 8.5, 4.5), c = enemyAt(sim, BLESSED, 10.5, 4.5);
      if (slowed) { sim.slow(a, 5); sim.slow(b, 5); }
      level(sim, p, 2.5, 4.5);
      sim.fireWeapon(p, ATTACK_PRIMARY);
      // One pass only: at most two hits.
      expect([a, b, c].map((s) => sim.eAlive[s])).toEqual(slowed ? [0, 0, 1] : [0, 1, 1]);
    }
  });

  it('Judecca: kills slow the enemies near each body; one bundle per root', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['a.1b']);
    const line = [6.5, 7.5, 8.5].map((x) => enemyAt(sim, BLESSED, x, 4.5));
    const near = enemyAt(sim, BLESSED, 7.5, 6.2);
    level(sim, p, 2.5, 4.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(line.every((s) => !sim.eAlive[s])).toBe(true);
    expect(sim.eSlowUntil[near]).toBeGreaterThan(sim.tick);
    const frost = events(sim, 'talentFx').filter((e) => e.kind === 'frost');
    expect(frost).toHaveLength(1);
    expect(frost[0].pts).toHaveLength(9);
  });

  it('Behind His Back: taunted enemies cost the Silver Bullet half', () => {
    const sim = makeSim(room(40, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['a.1b', 'a.2a', 'a.2b', 'a.3b']);
    const line = Array.from({ length: 20 }, (_, i) => enemyAt(sim, BLESSED, 5.5 + i, 4.5));
    for (const s of line) sim.eTauntUntil[s] = sim.tick + 100;
    level(sim, p, 2.5, 4.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(line.filter((s) => !sim.eAlive[s])).toHaveLength(20);
  });

  it('From Hand to Hand passes one spark per kill to a distinct nearby enemy', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['a.cap']);
    const victim = enemyAt(sim, BLESSED, 6.5, 4.5);
    const next = enemyAt(sim, BLESSED, 6.5, 7.5);
    level(sim, p, 2.5, 4.5);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eAlive[victim]).toBe(0);
    expect(sim.eAlive[next]).toBe(0);
    expect(events(sim, 'talentFx').find((e) => e.kind === 'spark')?.pts).toHaveLength(6);
  });
});

describe('Tree B: Sicarius', () => {
  it('Recoil throws the shooter back from the aim with one envelope per bullet', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['b.1b']);
    level(sim, p, 10.5, 4.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    const recoil = events(sim, 'recoil');
    expect(recoil).toHaveLength(1);
    expect(recoil[0].vx).toBeLessThan(0);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    // The first envelope is still running: no second one.
    expect(events(sim, 'recoil')).toHaveLength(1);
  });

  it('Scattered Sheep throws the crowd aside instead of cutting it; The Long Knife widens the path', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.1b', 'b.2a', 'b.3b']);
    const wide = enemyAt(sim, BLESSED, 6.5, 5.6);
    put(sim, p, 2.5, 4.5);
    sim.talents.cutSegment(p, sim.talents.root(p, 'E'), new Set(), sim.talents.dashReach(p), 2.5, 4.5, 0, 10.5, 4.5, 0);
    expect(sim.eAlive[wide]).toBe(1);
    expect(sim.eHp[wide]).toBe(20);
    expect(sim.eKbUntil[wide]).toBeGreaterThan(sim.tick);
    expect(events(sim, 'talentFx').find((e) => e.kind === 'sheep')?.slots).toEqual([wide]);
  });

  it('The Way Back: leave a shadow, then return to it through the crowd, cutting; 12 s cooldown after', () => {
    const sim = makeSim(room(40, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.1b', 'b.2b', 'b.3a'], 'field', 'wayBack');
    put(sim, p, 5.5, 4.5);
    press(p, 'E');
    sim.step();
    expect(sim.talents.areaOf(0, 'shadow')).toMatchObject({ x: 5.5, y: 4.5 });
    expect(p.cdE).toBe(0);
    put(sim, p, 20.5, 4.5);
    const onPath = enemyAt(sim, BLESSED, 12.5, 4.5);
    press(p, 'E');
    sim.step();
    expect(events(sim, 'wayBack')).toHaveLength(1);
    expect(sim.talents.areaOf(0, 'shadow')).toBeUndefined();
    expect(sim.isInvulnerable(p)).toBe(true);
    for (let i = 0; i < 25; i++) sim.step();
    expect(sim.eAlive[onPath]).toBe(0);
    expect(p.cdE).toBeGreaterThan(10);
  });

  it('The Way Back ignores a second press out of range and keeps the shadow', () => {
    const sim = makeSim(room(40, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.1b', 'b.2b', 'b.3a'], 'field', 'wayBack');
    put(sim, p, 2.5, 4.5);
    press(p, 'E');
    sim.step();
    put(sim, p, 38.5, 4.5);
    press(p, 'E');
    sim.step();
    expect(events(sim, 'wayBack')).toHaveLength(0);
    expect(sim.talents.areaOf(0, 'shadow')).toBeDefined();
    // It fades after 5 s and the cooldown starts then.
    for (let i = 0; i < 5 * TICK_HZ; i++) sim.step();
    expect(sim.talents.areaOf(0, 'shadow')).toBeUndefined();
    expect(p.cdE).toBeGreaterThan(11);
  });

  it('One of Them hides the player from ordinary casters while the crowd presses on it', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['b.1a', 'b.2b']);
    put(sim, p, 10.5, 4.5);
    const caster = enemyAt(sim, CHORISTER, 25.5, 4.5);
    expect(sim.eTarget[caster]).toBe(0);
    enemyAt(sim, BLESSED, 11.3, 4.5);
    sim.step();
    expect(sim.talents.hidden.has(0)).toBe(true);
    expect(events(sim, 'hidden')).toContainEqual(expect.objectContaining({ playerId: 0, hidden: true }));
    sim.retarget(caster);
    expect(sim.eTarget[caster]).toBe(-1);
  });

  it('A Thousand Years Among Them cuts enemies whose centers the player passes through', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['b.cap']);
    const s = enemyAt(sim, BLESSED, 6.5, 4.5);
    put(sim, p, 4.5, 4.5);
    sim.step();
    put(sim, p, 8.5, 4.5);
    sim.eX[s] = 6.5; sim.eY[s] = 4.5;
    sim.step();
    expect(sim.eAlive[s]).toBe(0);
  });
});

describe('Tree C: Akeldama', () => {
  it('The Nail binds the survivors near where the Silver Bullet stops', () => {
    const sim = makeSim(room(10, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['c.1a']);
    const near = enemyAt(sim, CHORISTER, 9.8, 5.9);
    level(sim, p, 2.5, 4.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(sim.isRooted(near)).toBe(true);
  });

  it('Blood Money drops a silver coin per revolver kill that binds the next enemy on it', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['c.1a', 'c.2a']);
    const v = enemyAt(sim, BLESSED, 6.5, 4.5);
    level(sim, p, 2.5, 4.5);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eAlive[v]).toBe(0);
    expect(sim.talents.areaOf(0, 'trap')).toMatchObject({ x: 6.5, y: 4.5 });
    const next = enemyAt(sim, BLESSED, 6.7, 4.5);
    sim.step();
    expect(sim.isRooted(next)).toBe(true);
    expect(sim.talents.areaOf(0, 'trap')).toBeUndefined();
  });

  it('Broken Vessel: a button kill of a bound enemy shatters into a 20-damage ring', () => {
    for (const vessel of [false, true]) {
      const sim = makeSim(room(30, 8), ['betrayer']);
      const p = sim.players[0];
      kit(sim, p, vessel ? ['c.1a', 'c.2b'] : ['c.1a']);
      const bound = enemyAt(sim, BLESSED, 6.5, 4.5);
      sim.root(bound, 5);
      const side = enemyAt(sim, BLESSED, 7.0, 5.6);
      level(sim, p, 2.5, 4.5);
      sim.fireWeapon(p, ATTACK_PRIMARY);
      expect(sim.eAlive[bound]).toBe(0);
      expect(sim.eAlive[side]).toBe(vessel ? 0 : 1);
    }
  });

  it('Silver Wire binds each ground enemy that touches it, once per wire', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['c.1a', 'c.2a', 'c.2b', 'c.3a'], 'field', 'silverWire');
    put(sim, p, 2.5, 4.5, 0);
    press(p, 'E');
    sim.step();
    const wire = sim.talents.areaOf(0, 'wire')!;
    expect(wire.x1).toBeGreaterThan(16);
    expect(p.cdE).toBe(10);
    const s = enemyAt(sim, BLESSED, 8.5, 4.7);
    sim.step();
    expect(sim.isRooted(s)).toBe(true);
    sim.eRootUntil[s] = 0;
    sim.step();
    expect(sim.isRooted(s)).toBe(false);
  });

  it('Thrown Silver lands the Field where the crosshair meets the floor, after a 0.5 s flight', () => {
    const sim = makeSim(room(40, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['c.1b']);
    put(sim, p, 2.5, 4.5, 0, -Math.atan2(1.6, 12));
    press(p, 'Q');
    sim.step();
    expect(sim.fieldX).toBeCloseTo(14.5, 1);
    expect(sim.fieldActive()).toBe(false);
    for (let i = 0; i < 15; i++) sim.step();
    expect(sim.fieldActive()).toBe(true);
    expect(events(sim, 'abilityUsed')).toContainEqual(expect.objectContaining({ slot: 'Q', thrown: true }));
  });

  it("The Potter's Field binds each ground enemy once per cast as it enters", () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['c.cap']);
    put(sim, p, 5.5, 4.5, 0);
    const inside = enemyAt(sim, BLESSED, 9.5, 4.5);
    press(p, 'Q');
    sim.step();
    sim.step();
    expect(sim.isRooted(inside)).toBe(true);
    sim.eRootUntil[inside] = 0;
    sim.step();
    expect(sim.isRooted(inside)).toBe(false);
  });

  it('Known Ground keeps blast props and hazards from hurting the player', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    expect(sim.talents.ignoresWorld(p)).toBe(false);
    kit(sim, p, ['c.1a', 'c.2a', 'c.2b', 'c.3b']);
    expect(sim.talents.ignoresWorld(p)).toBe(true);
  });
});

describe('Rites (§9.10)', () => {
  const offers = (sim: Simulation) => events(sim, 'riteOffers').at(-1)?.offers ?? [];

  it('a page opens one offer of two fixed cards; taking one applies it at once', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    sim.rites.grant(p, 'clear');
    const [offer] = offers(sim);
    expect(offer.cards).toHaveLength(2);
    expect(offer.cards.every((c) => c.ok)).toBe(true);
    const r = sim.rites.choose(p, offer.offerId, offer.cards[0].id);
    expect(r.accepted).toBe(true);
    expect(p.build.rites).toEqual([offer.cards[0].id]);
    expect(p.kit.active.has(offer.cards[0].id)).toBe(true);
    expect(offers(sim)).toEqual([]);
    expect(sim.rites.choose(p, offer.offerId, offer.cards[1].id).accepted).toBe(false);
  });

  it('draws the same cards for the same seed and player', () => {
    const draw = () => { const sim = makeSim(room(30, 8), ['betrayer']); sim.rites.grant(sim.players[0], 'clear'); return offers(sim)[0].cards.map((c) => c.id); };
    expect(draw()).toEqual(draw());
  });

  it('Pass settles the offer with no node and no halos', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    sim.rites.grant(p, 'clear');
    const wallet = p.wallet;
    expect(sim.rites.choose(p, offers(sim)[0].offerId, 'pass').accepted).toBe(true);
    expect(p.build.rites).toEqual([]);
    expect(p.wallet).toBe(wallet);
    expect(sim.rites.anyPending()).toBe(false);
  });

  it('refuses a choice while the doors are sealed and keeps the offer', () => {
    const sim = arenaSim([{ blessed: 40, choristers: 0, cherubs: 0 }], { players: 1, god: true });
    const p = sim.players[0];
    sim.rites.grant(p, 'clear');
    sealAt(sim);
    expect(sim.activePhase).toBe(PHASE_COMBAT);
    const offer = offers(sim)[0];
    expect(sim.rites.choose(p, offer.offerId, offer.cards[0].id)).toMatchObject({ accepted: false });
    expect(sim.rites.hasPending(p)).toBe(true);
  });

  it('pays the six-halo fallback at the four-Rite cap, and the page halos to a class without trees yet', () => {
    const sim = makeSim(room(30, 8), ['betrayer', 'heretic']);
    const [p, h] = sim.players;
    kit(sim, p, [], 'field', 'shadowstep', ['a.1a', 'b.1a', 'b.1b', 'c.1b']);
    sim.rites.grant(p, 'clear');
    expect(p.wallet).toBe(RITE_FALLBACK_HALOS);
    expect(sim.rites.hasPending(p)).toBe(false);
    sim.rites.grant(h, 'clear');
    expect(h.wallet).toBe(RITE_PAGE_HALOS);
  });

  it('a Rite substitution suppresses the learned augment of its channel until the run ends', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    kit(sim, p, ['c.1a']);
    const r = sim.talents.edit(p, [id('c.1a')], 'field', 'shadowstep', true);
    expect(r).toBeNull();
    sim.talents.setBuild(p, { ...p.build, rites: [id('b.1b')] });
    expect(p.kit.suppressed.get(id('c.1a'))).toBe(id('b.1b'));
    expect(p.kit.active.has(id('c.1a'))).toBe(false);
  });
});

describe('the Advocate (§9.5, §9.6)', () => {
  it('a development run accepts a whole legal build anywhere and refuses an illegal one whole', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    sim.advocate(0, 1, [id('a.1a'), id('c.1a')], 'field', 'shadowstep');
    expect(p.build.talents).toEqual([id('a.1a'), id('c.1a')]);
    sim.advocate(0, 2, [id('b.1b'), id('c.1a')], 'field', 'shadowstep');
    expect(p.build.talents).toEqual([id('a.1a'), id('c.1a')]);
    expect(events(sim, 'interactionResult').at(-1)).toMatchObject({ requestId: 2, accepted: false });
  });

  it('a progression run needs the Advocate in reach and the points', () => {
    const sim = makeSim(room(30, 8), ['betrayer'], { progressionEnabled: true });
    const p = sim.players[0];
    sim.advocate(0, 1, [id('a.1a')], 'field', 'shadowstep');
    expect(p.build.talents).toEqual([]);
    expect(events(sim, 'interactionResult').at(-1)).toMatchObject({ accepted: false, reason: 'Speak to the Advocate in the Confessional' });
  });

  it('a dev quick build cycles through the reproducible plans', () => {
    const sim = makeSim(room(30, 8), ['betrayer']);
    const p = sim.players[0];
    sim.devBuildCycle(0);
    expect(p.kit.q).toBe('judasCoin');
    expect(p.build.talents).toHaveLength(9);
    sim.devBuildCycle(0);
    expect(p.kit.e).toBe('silverWire');
  });

  it('starts with a quick build when asked, never with saved progression', () => {
    const dev = makeSim(room(30, 8), ['betrayer'], { devBuild: 'saboteur' });
    expect(dev.players[0].build.talents).toHaveLength(9);
    const real = makeSim(room(30, 8), ['betrayer'], { devBuild: 'saboteur', progressionEnabled: true });
    expect(real.players[0].build.talents).toHaveLength(0);
  });
});
