import { describe, expect, it } from 'vitest';
import { Dominions } from './dominion';
import { DOMINION, BLESSED, CHORISTER, CHERUB, GATEKEEPER, ENEMIES } from '../data/enemies';
import { COIN, GOLD_HALO, HEAL_MOTE, ITEM_FIRST } from '../data/pickups';
import type { DominionCast, DominionPhase } from '../data/dominion';
import { waveCounts } from '../gen/stamp';
import { Simulation, scaleCount, partyMultiplier, waveSize } from './sim';
import { arenaDungeon, sealAt } from './testutil/arenas';
import { dungeonOf } from './testutil/maps';
import { put, room } from './testutil/sims';
import { PHASE_CLEARED, decodeSnapshot } from '../net/protocol';
import { HaloLedger } from './economy';

const ready = { incarnation: 1, room: 0, grounded: true, stunned: false, silenced: false, inRange: true };
function controller() {
  const events: Array<{ phase: DominionPhase; cast: DominionCast }> = [];
  const casts = new Dominions((phase, cast) => events.push({ phase, cast }));
  return { casts, events };
}
function fixture(heights = room(32, 20)) {
  const dungeon = dungeonOf(heights);
  dungeon.rooms = [{ id: 'dominion', name: 'Dominion', kind: 'combat', shape: '1x1', band: 2,
    rect: { x0: 1, y0: 1, x1: heights[0].length - 2, y1: heights.length - 2 },
    entry: [{ socket: 0, cells: [[1, 1], [2, 1], [3, 1], [4, 1]] }], leaves: [],
    waves: [{ blessed: 1, choristers: 0, cherubs: 0 }], boss: false }];
  const sim = new Simulation({ dungeon, noWaves: true, seed: 1, players: [{ id: 0, name: 'P', classId: 'betrayer' }] });
  sim.rooms[0].phase = PHASE_CLEARED;
  put(sim, sim.players[0], 12.5, 10.5);
  sim.random = () => 0.5;
  sim.refreshFields();
  const slot = sim.placeEnemy(DOMINION, 10, 10, 0);
  return { sim, slot };
}
function slam(sim: Simulation, slot: number) {
  const state = { ...ready, incarnation: sim.eIncarnation[slot] };
  sim.dominions.update(slot, sim.tick, state);
  sim.tick += 45; sim.dominions.update(slot, sim.tick, state);
}

describe('Dominion accepted cast deadlines', () => {
  it('strikes at 45 ticks, holds recovery 30, and waits 90 after impact even if the target leaves', () => {
    const h = controller(); h.casts.update(2, 10, ready);
    expect(h.events[0].cast).toMatchObject({ slot: 2, startTick: 10, impactTick: 55 });
    const detached = h.casts.checkpoint(); detached[0].impactTick = 1;
    h.casts.update(2, 54, { ...ready, inRange: false }); expect(h.events).toHaveLength(1);
    h.casts.update(2, 55, { ...ready, inRange: false }); expect(h.events.map((e) => e.phase)).toEqual(['start', 'strike']);
    expect(h.casts.holding(2, 84)).toBe(true); expect(h.casts.holding(2, 85)).toBe(false);
    h.casts.update(2, 144, ready); expect(h.events).toHaveLength(2);
    h.casts.update(2, 145, ready); expect(h.events[2].cast.castId).toBe(2);
  });
  for (const control of ['stunned', 'silenced', 'grounded'] as const) it(`${control} cancels once and cannot reschedule through refresh`, () => {
    const h = controller(); h.casts.update(0, 0, ready);
    const blocked = { ...ready, [control]: control !== 'grounded' };
    h.casts.update(0, 12, blocked); h.casts.cancel(0, 20); h.casts.update(0, 45, blocked);
    h.casts.update(0, 101, ready); expect(h.events.map((e) => e.phase)).toEqual(['start', 'cancel']);
    h.casts.update(0, 102, ready); expect(h.events[2].phase).toBe('start');
  });
  it('bounds active records, isolates reused slots and refuses cast-ID overflow', () => {
    const h = controller();
    for (let slot = 0; slot < 4; slot++) h.casts.update(slot, 0, { ...ready, incarnation: slot + 1 });
    expect(h.casts.checkpoint()).toHaveLength(3);
    h.casts.update(0, 1, { ...ready, incarnation: 99 }); expect(h.events.at(-1)?.phase).toBe('cancel');
    h.casts.reset(0); h.casts.update(0, 2, { ...ready, incarnation: 99 });
    expect(h.events.at(-1)?.cast.incarnation).toBe(99); expect(h.events.at(-1)?.cast.castId).toBe(4);
    h.casts.cancel(0, 3); h.casts.reset(0);
    (h.casts as unknown as { nextId: number }).nextId = 0xffffffff;
    h.casts.update(0, 4, ready); expect(h.events.at(-1)?.cast.castId).toBe(0xffffffff);
    h.casts.cancel(0, 5); h.casts.reset(0); h.casts.update(0, 6, ready);
    expect(h.casts.active.has(0)).toBe(false); expect(h.casts.exhausted).toBe(1);
  });
});

describe('Dominion host geometry, controls and drops', () => {
  it('starts from real range/LOS, remains still, and bound permits the slam', () => {
    const { sim, slot } = fixture(); sim.root(slot, 10);
    sim.step(); const cast = sim.dominions.checkpoint()[0]; expect(cast).toBeDefined();
    const [x, y] = [sim.eX[slot], sim.eY[slot]];
    sim.players[0].x = 20.5;
    while (sim.tick < cast.impactTick) sim.step();
    expect([sim.eX[slot], sim.eY[slot]]).toEqual([x, y]);
    expect(sim.events.filter((e) => e.event.type === 'dominionCast').map((e) => e.event.type === 'dominionCast' && e.event.phase)).toEqual(['start', 'strike']);
    expect(sim.players[0].hp).toBe(sim.players[0].maxHp);
  });
  it('encodes the live incarnation/deadline and removes it from catch-up after cancellation', () => {
    const { sim, slot } = fixture(); sim.step();
    const snapshot = decodeSnapshot(sim.encodeFor(0)[0])!;
    expect(snapshot.dominionCasts).toEqual(sim.floorSync(sim.runId).dominionCasts);
    expect(snapshot.dominionCasts?.[0]).toMatchObject({ slot, incarnation: sim.eIncarnation[slot], startTick: sim.tick, impactTick: sim.tick + 45 });
    const detached = sim.floorSync(sim.runId); detached.dominionCasts![0].impactTick = 1;
    expect(sim.dominions.checkpoint()[0].impactTick).toBe(sim.tick + 45);
    sim.silence(slot, 1); expect(sim.floorSync(sim.runId).dominionCasts).toEqual([]);
    sim.step(); expect(decodeSnapshot(sim.encodeFor(0)[0])?.dominionCasts).toEqual([]);
  });
  it('the native Falling Star landing cancels a launch but a bound Dominion keeps swinging', () => {
    for (const bound of [false, true]) {
      const { sim, slot } = fixture(); sim.players[0].classId = 'fallen';
      sim.step(); expect(sim.dominions.active.has(slot)).toBe(true);
      if (bound) sim.root(slot, 10);
      sim.players[0].landingTick = sim.tick + 1;
      sim.step();
      expect(sim.dominions.active.has(slot)).toBe(bound);
      expect(sim.events.filter((e) => e.event.type === 'starLanded')).toHaveLength(1);
    }
  });
  it('uses horizontal radius/feet height and body-center LOS; protects elites, bosses and hovering Cherubs', () => {
    const { sim, slot } = fixture();
    const near = sim.placeEnemy(BLESSED, 13, 10, 0), edge = sim.placeEnemy(CHORISTER, 15, 10, 0);
    sim.eX[edge] = sim.eX[slot] + 4.5;
    const far = sim.placeEnemy(BLESSED, 16, 10, 0), high = sim.placeEnemy(BLESSED, 13, 11, 0);
    sim.eZ[high] = 1.51;
    const elite = sim.placeEnemy(DOMINION, 11, 11, 0), boss = sim.placeEnemy(GATEKEEPER, 12, 12, 0), flyer = sim.placeEnemy(CHERUB, 13, 12, 0);
    const grounded = sim.placeEnemy(CHERUB, 13, 9, 0); sim.eZ[grounded] = 0;
    sim.players[0].z = 1; sim.giveShield(sim.players[0], 150, 20);
    slam(sim, slot);
    for (const s of [near, edge, grounded]) expect(sim.eAlive[s]).toBe(0);
    for (const s of [far, high, elite, boss, flyer]) expect(sim.eAlive[s]).toBe(1);
    expect(sim.players[0].shield).toBe(110); expect(sim.players[0].hp).toBe(120);
    expect(sim.players[0].kills).toBe(0); expect(sim.players[0].damage).toBe(0);
  });
  it('blocks a tall obstacle while admitting the +1m dais through body-center sight', () => {
    const heights = room(32, 20).map((row, r) => r >= 7 && r <= 14 ? row.slice(0, 13) + '#' + row.slice(14) : row);
    heights[12] = heights[12].slice(0, 10) + '4' + heights[12].slice(11);
    const { sim, slot } = fixture(heights);
    const blocked = sim.placeEnemy(BLESSED, 14, 10, 0);
    const dais = sim.placeEnemy(BLESSED, 10, 12, 0); sim.eZ[dais] = 1;
    slam(sim, slot); expect(sim.eAlive[blocked]).toBe(1); expect(sim.eAlive[dais]).toBe(0);
  });
  for (const control of ['stun', 'silence', 'removeEnemy'] as const) it(`${control} immediately sends one terminal cancellation`, () => {
    const { sim, slot } = fixture(); sim.step(); expect(sim.dominions.active.has(slot)).toBe(true);
    if (control === 'removeEnemy') sim.removeEnemy(slot); else sim[control](slot, 1);
    if (control === 'removeEnemy') sim.removeEnemy(slot); else sim[control](slot, 2);
    expect(sim.dominions.active.size).toBe(0);
    expect(sim.events.filter((e) => e.event.type === 'dominionCast' && e.event.phase === 'cancel')).toHaveLength(1);
    expect(sim.pickups.live).toHaveLength(0);
  });
  it('world heavy deaths settle ordinary entitlements once, without player final blows', () => {
    const { sim, slot } = fixture();
    const victim = sim.placeEnemy(CHORISTER, 13, 10, 0); sim.eWave[victim] = 0;
    sim.rooms[0].waveAlive[0]++;
    sim.haloLedgers.set(0, new HaloLedger(12, 10));
    sim.random = () => 0.5;
    slam(sim, slot);
    expect(sim.eAlive[victim]).toBe(0); expect(sim.players[0].kills).toBe(0);
    expect(sim.pickups.live.filter((p) => p.kind === COIN).reduce((sum, p) => sum + p.value, 0)).toBe(12);
    sim.damageEnemy(victim, 200, -1);
    expect(sim.haloLedgers.get(0)?.paid).toBe(12);
    expect(sim.floorSync(sim.runId).dominionCasts).toEqual([]);
    const bursts = (sim as unknown as { tickBursts: number[] }).tickBursts;
    expect(bursts[1]).toBeGreaterThanOrEqual(360); expect(bursts[2]).toBe(-1);
  });
  it('cannot restart a dead simultaneous caster after an accepted slam triggers Shroud', () => {
    const { sim, slot } = fixture(); const second = sim.placeEnemy(DOMINION, 14, 10, 0);
    sim.eHp[slot] = sim.eHp[second] = 1;
    sim.giveShield(sim.players[0], 1, 20, sim.players[0]);
    sim.step(); expect(sim.dominions.active.size).toBe(2);
    const impact = sim.dominions.checkpoint()[0].impactTick;
    while (sim.tick < impact) sim.step();
    expect(sim.eAlive[slot]).toBe(0); expect(sim.eAlive[second]).toBe(0);
    expect(sim.dominions.active.size).toBe(0);
    expect(sim.events.filter((e) => e.event.type === 'dominionCast' && e.event.phase === 'start')).toHaveLength(2);
  });
});

describe('Dominion authored group scaling and reservations', () => {
  it('retains authored elite counts without changing historical zero-elite records', () => {
    expect(waveCounts({ share: 1, mix: { blessed: 1 }, elites: 2 }, 400)).toEqual({ blessed: 280, choristers: 0, cherubs: 0, dominions: 2 });
    expect(waveCounts({ share: 1, mix: { blessed: 1 } }, 400)).toEqual({ blessed: 400, choristers: 0, cherubs: 0 });
    expect(waveSize({ blessed: 10, choristers: 0, cherubs: 0, dominions: 3 }, 1)).toBe(6);
    expect(ENEMIES[DOMINION]).toEqual({ hp: 1500, radius: 0.45, height: 3.2, speed: 3.5, flying: false, draw: 1 });
  });
  it('scales HP per rounded group, reserves first elites and does not stall fodder behind the alive cap', () => {
    const dungeon = arenaDungeon([{ blessed: 40, choristers: 0, cherubs: 0, dominions: 3 }]);
    dungeon.rooms[0].shape = '1x1'; dungeon.rooms[0].band = 1;
    const sim = new Simulation({ dungeon, players: Array.from({ length: 4 }, (_, id) => ({ id, name: `P${id}`, classId: 'betrayer' as const })), seed: 1, god: true });
    sim.random = () => 0.5; sealAt(sim);
    for (let i = 0; i < 350; i++) {
      sim.step();
      for (let k = 0; k < sim.activeCount; k++) if (sim.eType[sim.active[k]] === DOMINION) sim.stun(sim.active[k], 100);
    }
    const slots = Array.from(sim.active.subarray(0, sim.activeCount)), elites = slots.filter((s) => sim.eType[s] === DOMINION);
    expect(elites).toHaveLength(2); expect(slots.filter((s) => sim.eType[s] === BLESSED)).toHaveLength(40);
    expect(sim.rooms[0].queue[0].spawned).toEqual([40, 0, 0, 2]); expect(sim.rooms[0].waveFullySpawned[0]).toBe(false);
    expect(sim.haloLedgers.get(0)?.reservedElites).toBe(2);
    expect(elites.map((s) => sim.eGoldEntitled[s])).toEqual([1, 1]);
    sim.random = () => 0.1; sim.damageEnemy(elites[0], 10000, -1);
    expect(sim.pickups.live.filter((p) => p.kind === GOLD_HALO)).toHaveLength(1);
    expect(sim.pickups.live.filter((p) => p.kind === HEAL_MOTE)).toHaveLength(2);
    expect(sim.pickups.live.filter((p) => p.kind >= ITEM_FIRST)).toHaveLength(1);
    sim.step(); expect(sim.rooms[0].waveFullySpawned[0]).toBe(true);
    const third = Array.from(sim.active.subarray(0, sim.activeCount)).find((s) => sim.eType[s] === DOMINION && !elites.includes(s))!;
    expect(sim.eGoldEntitled[third]).toBe(0);
    sim.damageEnemy(third, 10000, -1); sim.damageEnemy(third, 10000, -1);
    expect(sim.pickups.live.filter((p) => p.kind === GOLD_HALO)).toHaveLength(1);
    expect(sim.pickups.live.filter((p) => p.kind === HEAL_MOTE)).toHaveLength(4);
    expect(sim.pickups.live.filter((p) => p.kind === COIN)).toHaveLength(0);
  });
  for (const party of [1, 1.5, 2, 2.5, 3, 4]) it(`keeps the group's HP budget at party ${party}`, () => {
    const dungeon = arenaDungeon([{ blessed: 0, choristers: 0, cherubs: 0, dominions: 1 }]);
    dungeon.rooms[0].shape = '1x1'; dungeon.rooms[0].band = 1;
    const players = Array.from({ length: Math.ceil(party) }, (_, id) => ({ id, name: `P${id}`, classId: 'betrayer' as const, bot: id === Math.ceil(party) - 1 && party % 1 !== 0 }));
    const sim = new Simulation({ dungeon, players, seed: 1, god: true }); sealAt(sim);
    for (let i = 0; i < 310; i++) sim.step();
    const elite = Array.from(sim.active.subarray(0, sim.activeCount)).find((s) => sim.eType[s] === DOMINION)!;
    expect(sim.eHp[elite]).toBeCloseTo(1500 * partyMultiplier(party) / scaleCount(1, party));
  });
});
