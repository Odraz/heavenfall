/** R6: St Peter's key, the Reliquary chest, relic offers and the Advocate's bargain (game.md §6.5, §9.6). */
import { describe, expect, it } from 'vitest';
import { generateFloor } from '../gen';
import { PINNED } from '../gen/pinned';
import { PEARLY_POOL } from '../data/rooms/1';
import { KEY, RITE_PAGE } from '../data/pickups';
import { CHEST_RELICS, RELICS, type RelicId } from '../data/relics';
import { CLASSES } from '../data/classes';
import { PHASE_CLEARED, PHASE_COUNTDOWN } from '../net/protocol';
import type { GameEvent } from '../net/messages';
import { createProfile } from '../profile/model';
import { RunRecords } from '../net/runRecords';
import { applyProgress, stakeProfile } from '../profile/lifecycle';
import { Simulation, type SimPlayer } from './sim';
import { drawRelics } from './relicOffers';
import { SOURCE_BELL_FIRST, SOURCE_CHEST, SUNDIAL_TICKS, judgmentWave } from './route';
import { sealNow } from './testutil/sims';

const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
type Room = 'keyRoom' | 'reliquary' | 'confessional';

function floorSim(start: Room, players = 1, relics: string[] = []): Simulation {
  const classes = ['fallen', 'heretic', 'binder', 'betrayer'] as const;
  const profiles = Array.from({ length: players }, (_, i) => {
    const p = createProfile(`P${i}`, String(i + 1).repeat(32), 1); p.relics = [...relics]; return p;
  });
  return new Simulation({ dungeon: g.def, floor: g.floor, seed: 7, startRoom: g.floor[start], noWaves: true,
    players: profiles.map((profile, id) => ({ id, name: profile.name, classId: classes[id], profile })) });
}
/** Seals the room the players stand in (no waves) and steps until it clears. */
function clear(sim: Simulation, ai: number): void {
  sim.step();
  sealNow(sim, ai);
  for (let i = 0; i < 5 && sim.rooms[ai].phase !== PHASE_CLEARED; i++) sim.step();
  expect(sim.rooms[ai].phase).toBe(PHASE_CLEARED);
}
function events<T extends GameEvent['type']>(sim: Simulation, type: T, to?: number): Array<Extract<GameEvent, { type: T }>> {
  return sim.events.flatMap((e) => (e.event.type === type && (to === undefined || e.to === to || e.to === 'all') ? [e.event as Extract<GameEvent, { type: T }>] : []));
}
function reasons(sim: Simulation, to: number): string[] {
  return events(sim, 'interactionResult', to).map((e) => e.reason);
}
function interact(sim: Simulation, p: SimPlayer, sourceId = SOURCE_CHEST): void {
  sim.interact(p.id, p.requests.next, sourceId);
}
function standAtChest(sim: Simulation, p: SimPlayer): void {
  const c = sim.route.chest!;
  p.x = c.x + 1; p.y = c.y; p.z = c.z;
}
function lastOffers(sim: Simulation, p: SimPlayer) {
  return events(sim, 'relicOffers', p.id).at(-1)!.offers;
}
/** The first player holds the key (the key room was cleared without a fight here) and opens the chest. */
function openChest(sim: Simulation): void {
  sim.route.keyHolder = sim.players[0].id;
  standAtChest(sim, sim.players[0]);
  interact(sim, sim.players[0]);
}

describe('the key', () => {
  it("lies at the key room's reward square once it clears, and a human within 1 m takes it", () => {
    const sim = floorSim('keyRoom');
    clear(sim, g.floor.keyRoom);
    const key = sim.pickups.live.filter((q) => q.kind === KEY);
    expect(key).toHaveLength(1);
    expect(key[0].expiresTick).toBe(-1);
    const p = sim.players[0];
    expect(sim.rewards.collect(key[0], p)).toBe(true);
    expect(sim.route.keyHolder).toBe(p.id);
    expect(events(sim, 'route').at(-1)!.state.keyHolder).toBe(p.id);
  });

  it('a bot never takes it; a holder who dies drops it at their feet', () => {
    const sim = floorSim('keyRoom', 2);
    clear(sim, g.floor.keyRoom);
    const key = sim.pickups.live.find((q) => q.kind === KEY)!;
    const [a, b] = sim.players;
    b.bot = true;
    expect(sim.route.takeKey(b)).toBe(false);
    sim.rewards.collect(key, a);
    sim.pickups.live.splice(sim.pickups.live.indexOf(key), 1);
    a.hp = 1; sim.damagePlayer(a, 100);
    expect(a.dead).toBe(true);
    expect(sim.route.keyHolder).toBe(-1);
    const dropped = sim.pickups.live.find((q) => q.kind === KEY)!;
    expect(Math.hypot(dropped.x - a.x, dropped.y - a.y)).toBeLessThan(2.1);
  });
});

describe('the Reliquary', () => {
  it('opens only for the key holder, uses the key up, then gives each sealed human their own offer of two unowned relics', () => {
    const sim = floorSim('reliquary', 2);
    clear(sim, g.floor.reliquary);
    expect(sim.route.chest?.open).toBe(false);
    const [a, b] = sim.players;
    standAtChest(sim, b); interact(sim, b);
    expect(reasons(sim, b.id).at(-1)).toBe('The Reliquary needs the key');
    sim.route.keyHolder = a.id;
    standAtChest(sim, a); interact(sim, a);
    expect(sim.route.chest?.open).toBe(true);
    expect(sim.route.keyUsed).toBe(true);
    const offerA = lastOffers(sim, a);
    expect(offerA[0].cards).toHaveLength(2);
    for (const c of offerA[0].cards) expect(CHEST_RELICS).toContain(c.id);
    interact(sim, b);
    expect(lastOffers(sim, b)[0].cards).toHaveLength(2);
  });

  it('reopening shows the same cards; taking one makes it owned and saved, and the chest has nothing more', () => {
    const sim = floorSim('reliquary');
    clear(sim, g.floor.reliquary);
    openChest(sim);
    const p = sim.players[0];
    const first = lastOffers(sim, p)[0];
    interact(sim, p);
    expect(lastOffers(sim, p)[0].cards).toEqual(first.cards);
    sim.relicChoice(p.id, p.requests.next, first.offerId, first.cards[0].id);
    expect(p.ownedRelics).toContain(first.cards[0].id);
    expect(p.claimedRelics).toEqual([first.cards[0].id]);
    expect(lastOffers(sim, p)).toHaveLength(0);
    interact(sim, p);
    expect(reasons(sim, p.id).at(-1)).toBe('The Reliquary has nothing more for you');
    expect(sim.route.choicesPending()).toBe(false);
  });

  it('Pass settles the chest with nothing and frees the exit hold', () => {
    const sim = floorSim('reliquary');
    clear(sim, g.floor.reliquary);
    openChest(sim);
    const p = sim.players[0], offer = lastOffers(sim, p)[0];
    expect(sim.route.choicesPending()).toBe(true);
    sim.relicChoice(p.id, p.requests.next, offer.offerId, 'pass');
    expect(p.ownedRelics).toHaveLength(0);
    expect(sim.route.choicesPending()).toBe(false);
    interact(sim, p);
    expect(lastOffers(sim, p)).toHaveLength(0);
  });

  it('a complete chest collection gets a Rite instead, settling the chest', () => {
    const sim = floorSim('reliquary', 1, [...CHEST_RELICS]);
    clear(sim, g.floor.reliquary);
    openChest(sim);
    const p = sim.players[0];
    expect(events(sim, 'riteOffers', p.id).at(-1)!.offers.map((o) => o.source)).toEqual(['chest']);
    expect(sim.relicOffers.offers(p)).toHaveLength(0);
    expect(sim.route.choicesPending()).toBe(false);
  });

  it('one unowned relic left makes one card', () => {
    const sim = floorSim('reliquary', 1, CHEST_RELICS.filter((id) => id !== 'wheel'));
    clear(sim, g.floor.reliquary);
    openChest(sim);
    expect(lastOffers(sim, sim.players[0])[0].cards.map((c) => c.id)).toEqual(['wheel']);
  });

  it('ids shown on a pending bargain are reserved: the chest asks to finish that offer first', () => {
    const sim = floorSim('reliquary', 1, CHEST_RELICS.filter((id) => id !== 'wheel'));
    const p = sim.players[0];
    expect(sim.bargain.open(p).accepted).toBe(true);
    clear(sim, g.floor.reliquary);
    openChest(sim);
    expect(reasons(sim, p.id).at(-1)).toBe('Finish your other offer first');
  });

  it('a claim must be made at the open chest, not across the floor', () => {
    const sim = floorSim('reliquary');
    clear(sim, g.floor.reliquary);
    openChest(sim);
    const p = sim.players[0], offer = lastOffers(sim, p)[0];
    p.x += 6;
    sim.relicChoice(p.id, p.requests.next, offer.offerId, offer.cards[0].id);
    expect(reasons(sim, p.id).at(-1)).toBe('Choose at the Reliquary');
    expect(p.ownedRelics).toHaveLength(0);
  });
});

describe('the draw', () => {
  it('card one comes from the usable relics when any are, card two from the rest; weights favor commons', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const [a, b] = drawRelics(CHEST_RELICS, new Set<RelicId>(['usher', 'wheel']), random);
      expect(['usher', 'wheel']).toContain(a);
      expect(b).not.toBe(a);
      counts[a] = (counts[a] ?? 0) + 1;
    }
    // 60 : 10 between a common and the legendary.
    expect(counts.usher / counts.wheel).toBeGreaterThan(4);
    expect(drawRelics([], new Set(), random)).toEqual([]);
  });
});

describe("the Advocate's bargain", () => {
  it('accepting pawns the relic for 30% of max HP; it can be equipped; the bargain is once per floor', () => {
    const sim = floorSim('confessional');
    const p = sim.players[0];
    expect(sim.bargain.open(p).accepted).toBe(true);
    const offer = lastOffers(sim, p)[0];
    expect(offer.source).toBe('bargain');
    expect(offer.price).toBe(Math.floor(CLASSES.fallen.hp * 0.3));
    sim.relicChoice(p.id, p.requests.next, offer.offerId, offer.cards[0].id);
    expect(p.maxHp).toBe(CLASSES.fallen.hp - offer.price);
    expect(p.hp).toBeLessThanOrEqual(p.maxHp);
    expect(p.pawnedRelics).toEqual([offer.cards[0].id]);
    expect(p.ownedRelics).not.toContain(offer.cards[0].id);
    sim.equipRelics(p.id, p.requests.next, [offer.cards[0].id, null]);
    expect(p.relics[0]).toBe(offer.cards[0].id);
    // The saved loadout keeps its old slot until victory.
    expect(p.savedRelics[0]).toBeNull();
    expect(sim.bargain.open(p).reason).toBe('Your bargain for this floor is settled');
  });

  it('declining costs nothing and closes it; victory closes an unaccepted one', () => {
    const sim = floorSim('confessional');
    const p = sim.players[0];
    sim.bargain.open(p);
    const offer = lastOffers(sim, p)[0];
    sim.relicChoice(p.id, p.requests.next, offer.offerId, 'pass');
    expect(p.maxHp).toBe(CLASSES.fallen.hp);
    expect(sim.bargain.open(p).accepted).toBe(false);
    const sim2 = floorSim('confessional'), q = sim2.players[0];
    sim2.bargain.open(q);
    sim2.relicOffers.closeBargains();
    expect(sim2.relicOffers.offers(q)).toHaveLength(0);
  });

  it('with every chest relic owned it sells a legal Rite, or nothing: never halos for health', () => {
    const sim = floorSim('confessional', 1, [...CHEST_RELICS]);
    const p = sim.players[0];
    expect(sim.bargain.open(p).reason).toBe('The Advocate offers a Rite');
    const offer = events(sim, 'riteOffers', p.id).at(-1)!.offers[0];
    expect(offer.source).toBe('bargain');
    const card = offer.cards.find((c) => c.ok)!;
    sim.rite(p.id, p.requests.next, offer.offerId, card.id);
    expect(p.build.rites).toEqual([card.id]);
    expect(p.maxHp).toBe(CLASSES.fallen.hp - Math.floor(CLASSES.fallen.hp * 0.3));
    expect(p.wallet).toBe(0);
  });

  it('the sanctuary heals each human to full once on entering the Confessional', () => {
    const sim = floorSim('confessional');
    const p = sim.players[0];
    p.hp = 10;
    const [c, r] = g.def.rooms![g.floor.confessional].entry[0].cells[0];
    p.x = c + 0.5; p.y = r + 0.5;
    for (let i = 0; i < 3; i++) sim.step();
    expect(p.hp).toBe(p.maxHp);
    p.hp = 10; sim.step();
    expect(p.hp).toBe(10);
  });
});

describe('saved ownership', () => {
  it('a claim reaches the profile at once; a pawn only with the victory settlement', () => {
    const profile = createProfile('P', '1'.repeat(32), 1);
    const records = new RunRecords('a'.repeat(32), true);
    const admission = records.reserve(0, 'fallen', profile, true);
    let saved = stakeProfile(profile, admission);
    const r = records.byPlayer(0)!;
    saved = applyProgress(saved, records.commit(r))!;
    r.claimed = ['usher']; r.pawned = ['wheel']; r.savedRelics = ['usher', null];
    saved = applyProgress(saved, records.state(r))!;
    expect(saved.relics).toEqual(['usher']);
    expect(saved.characters.fallen.relics).toEqual(['usher', null]);
    r.savedRelics = ['usher', 'wheel'];
    saved = applyProgress(saved, records.settle(r, 'victory'))!;
    expect(saved.relics.sort()).toEqual(['usher', 'wheel']);
    expect(saved.characters.fallen.relics).toEqual(['usher', 'wheel']);
  });

  it('a defeat keeps the claim and loses the pawn', () => {
    const profile = createProfile('P', '1'.repeat(32), 1);
    const records = new RunRecords('b'.repeat(32), true);
    let saved = stakeProfile(profile, records.reserve(0, 'binder', profile, true));
    const r = records.byPlayer(0)!;
    saved = applyProgress(saved, records.commit(r))!;
    r.claimed = ['link']; r.pawned = ['comb'];
    saved = applyProgress(saved, records.settle(r, 'defeat'))!;
    expect(saved.relics).toEqual(['link']);
    expect(RELICS.comb.source).toBe('chest');
  });
});

describe('the Bells of Judgment', () => {
  function bellSim(): { sim: Simulation; ai: number } {
    const ai = g.floor.bells[0];
    const classes = ['fallen'] as const;
    const profile = createProfile('P', '1'.repeat(32), 1);
    const sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 7, startRoom: ai, noWaves: true,
      players: [{ id: 0, name: 'P', classId: classes[0], profile }] });
    return { sim, ai };
  }
  const underBell = (sim: Simulation, p: SimPlayer, ai: number) => {
    const b = sim.route.bells.find((x) => x.room === ai)!;
    p.x = b.x + 0.6; p.y = b.y; p.z = b.z - 3;
  };

  it('the Judgment wave is 40% of the room budget in its last wave’s mix plus two elites, paying 0.4 × budget + 120', () => {
    const waves = [
      { blessed: 40, choristers: 2, cherubs: 0, xp: [40, 12, 0, 0] as [number, number, number, number] },
      { blessed: 60, choristers: 4, cherubs: 2, xp: [60, 24, 8, 0] as [number, number, number, number] },
    ];
    const w = judgmentWave(waves);
    const budget = 40 + 12 + 60 + 24 + 8;
    expect(w.dominions).toBe(2);
    expect(w.xp!.reduce((a: number, b) => a + (b ?? 0), 0)).toBeCloseTo(0.4 * budget + 120);
    expect(w.blessed).toBe(Math.round(60 * (0.4 * budget) / 92));
    expect(judgmentWave(waves, true).dominions).toBe(3);
  });

  it('hangs after its room clears; a ring from afar is refused; walking away before the seal restores it', () => {
    const { sim, ai } = bellSim();
    const p = sim.players[0];
    expect(sim.route.bells.find((b) => b.room === ai)!.state).toBe('hidden');
    clear(sim, ai);
    const bell = sim.route.bells.find((b) => b.room === ai)!;
    expect(bell.state).toBe('available');
    interact(sim, p, SOURCE_BELL_FIRST + ai);
    expect(reasons(sim, p.id).at(-1)).toBe('Look at a Bell within 2.5 m');
    underBell(sim, p, ai);
    interact(sim, p, SOURCE_BELL_FIRST + ai);
    expect(bell.state).toBe('pending');
    expect(sim.rooms[ai].phase).toBe(PHASE_COUNTDOWN);
    // Leave the room: the countdown is abandoned and the Bell can be rung again.
    const [c, r] = g.def.rooms![g.def.rooms!.findIndex((x) => x.kind === 'breach')].entry[0].cells[0];
    p.x = c + 0.5; p.y = r + 0.5;
    for (let i = 0; i < 4 * 30; i++) sim.step();
    expect(sim.rooms[ai].phase).toBe(PHASE_CLEARED);
    expect(bell.state).toBe('available');
  });

  it('sealing spends it: one wave, then a Rite page for each human in the seal, with no clear XP or heal', () => {
    const { sim, ai } = bellSim();
    const p = sim.players[0];
    clear(sim, ai);
    const waves = sim.map.rooms[ai].waves;
    underBell(sim, p, ai);
    interact(sim, p, SOURCE_BELL_FIRST + ai);
    p.hp = 50;
    const xp = p.runXp;
    sim.step(); sealNow(sim, ai);
    expect(sim.route.bells.find((b) => b.room === ai)!.state).toBe('spent');
    for (let i = 0; i < 5 && sim.rooms[ai].phase !== PHASE_CLEARED; i++) sim.step();
    expect(sim.rooms[ai].phase).toBe(PHASE_CLEARED);
    expect(sim.map.rooms[ai].waves).toBe(waves);
    expect(p.runXp).toBe(xp);
    expect(p.hp).toBe(50);
    const page = sim.pickups.live.find((q) => q.kind === RITE_PAGE && q.room === ai)!;
    expect(page).toBeTruthy();
    expect(sim.rewards.collect(page, p)).toBe(true);
    expect(events(sim, 'riteOffers', p.id).at(-1)!.offers.map((o) => o.source)).toEqual(['bell']);
    underBell(sim, p, ai);
    interact(sim, p, SOURCE_BELL_FIRST + ai);
    expect(reasons(sim, p.id).at(-1)).toBe('Look at a Bell within 2.5 m');
  });
});

describe('the Bell fight swaps in its wave', () => {
  it('a sealed Bell room fights only the Judgment wave until it clears', () => {
    const ai = g.floor.bells[1], sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 7, startRoom: ai, noWaves: true, players: [{ id: 0, name: 'P', classId: 'fallen' }] });
    const own = sim.map.rooms[ai].waves;
    sim.route.bells.find((b) => b.room === ai)!.state = 'available';
    sim.route.ringBell(Object.assign(sim.players[0], { x: sim.route.bells.find((b) => b.room === ai)!.x + 0.5, y: sim.route.bells.find((b) => b.room === ai)!.y, z: sim.route.bells.find((b) => b.room === ai)!.z - 3 }), ai);
    sim.route.bellSealed(ai);
    expect(sim.map.rooms[ai].waves).toEqual([judgmentWave(own)]);
    sim.route.bellCleared(ai);
    expect(sim.map.rooms[ai].waves).toBe(own);
  });
});

describe('the Sundial', () => {
  function sundialSim(): Simulation {
    const profile = createProfile('P', '1'.repeat(32), 1);
    return new Simulation({ dungeon: g.def, floor: g.floor, seed: 7, startRoom: g.floor.boss, noWaves: true,
      players: [{ id: 0, name: 'P', classId: 'betrayer', profile }] });
  }

  it('a card selected at the Advocate becomes a Rite when the Gatekeeper seals before 14:00', () => {
    const sim = sundialSim(), p = sim.players[0];
    expect(sim.sundialOffer(p).accepted).toBe(true);
    const offer = events(sim, 'riteOffers', p.id).at(-1)!.offers.find((o) => o.source === 'sundial')!;
    const card = offer.cards.find((c) => c.ok)!;
    sim.rite(p.id, p.requests.next, offer.offerId, card.id);
    expect(p.build.rites).toEqual([]);
    expect(sim.rites.anyPending()).toBe(false); // a Sundial offer never holds the exit
    sim.step(); sealNow(sim, g.floor.boss);
    expect(p.build.rites).toEqual([card.id]);
    expect(p.sundialQualified).toBe(true);
    expect(sim.route.sundial).toBe('qualified');
  });

  it('an unselected offer gives nothing at the seal; at 14:00 the Sundial goes dark and its offer is gone', () => {
    const sim = sundialSim(), p = sim.players[0];
    sim.sundialOffer(p);
    sim.tick = SUNDIAL_TICKS - 1; sim.step();
    expect(sim.route.sundial).toBe('missed');
    expect(sim.rites.offerOf(p, 'sundial')).toBe(0);
    expect(sim.sundialOffer(p).reason).toBe('The Sundial has gone dark');
    sim.step(); sealNow(sim, g.floor.boss);
    expect(p.sundialQualified).toBe(false);
    expect(p.build.rites).toEqual([]);
  });

  it('a full hand at the Advocate is a pending fallback: six halos only at a qualifying seal', () => {
    const sim = sundialSim(), p = sim.players[0];
    p.build = { ...p.build, rites: ['betrayer.a.1a', 'betrayer.b.1a', 'betrayer.c.1a', 'betrayer.a.2a'] };
    sim.sundialOffer(p);
    expect(events(sim, 'riteOffers', p.id).at(-1)!.offers.find((o) => o.source === 'sundial')!.fallback).toBe(true);
    expect(p.wallet).toBe(0);
    sim.step(); sealNow(sim, g.floor.boss);
    expect(p.wallet).toBe(6);
  });
});
