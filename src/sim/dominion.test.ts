import { describe, expect, it } from 'vitest';
import { Dominions } from './dominion';
import { DOMINION, BLESSED, CHORISTER, CHERUB, GATEKEEPER, ENEMIES } from '../data/enemies';
import { COIN, GOLD_HALO, HEAL_MOTE, ITEM_FIRST } from '../data/pickups';
import type { DominionCast, DominionPhase, DominionLeap } from '../data/dominion';
import { DOMINION_ENEMY_DAMAGE, DOMINION_LAUNCH_SPEED, DOMINION_PLAYER_DAMAGE, dominionFalloff, dominionLeapPosition } from '../data/dominion';
import { dominionLeapClear } from './dominionLeap';
import { waveCounts } from '../gen/stamp';
import { Simulation, scaleCount, partyMultiplier, waveSize } from './sim';
import { arenaDungeon, sealAt } from './testutil/arenas';
import { dungeonOf } from './testutil/maps';
import { INPUT_DEFAULTS, put, room } from './testutil/sims';
import { PHASE_CLEARED, decodeSnapshot } from '../net/protocol';
import { HaloLedger, HALO_WEIGHT } from './economy';

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
  it('uses Blessed melee cadence between casts, with no melee during the slam tell or recovery', () => {
    const { sim, slot } = fixture(), p = sim.players[0];
    put(sim, p, sim.eX[slot] + 1.8, sim.eY[slot]); sim.root(slot, 20);
    sim.dominions.readyAt[slot] = 1000;
    for (let i = 0; i < 7; i++) sim.step(); expect(p.hp).toBe(120);
    sim.step(); expect(p.hp).toBe(108);
    for (let i = 0; i < 30; i++) sim.step(); expect(p.hp).toBe(96);
    sim.dominions.readyAt[slot] = 0; sim.step(); const cast = sim.dominions.checkpoint()[0];
    while (sim.tick < cast.impactTick - 1) sim.step(); expect(p.hp).toBe(96);
    sim.step(); expect(p.hp).toBe(4); // 92 at 1.8 m
    for (let i = 0; i < 29; i++) sim.step(); expect(p.hp).toBe(4);
  });
  it('only chooses living same-room players 16–48 metres away with a clear arc and dry landing', () => {
    const { sim, slot } = fixture(room(80, 25)), p = sim.players[0];
    const choose = () => (sim as unknown as { dominionLeapTarget(s: number): DominionLeap | undefined }).dominionLeapTarget(slot);
    for (const distance of [8, 15.9, 48.1]) { put(sim, p, sim.eX[slot] + distance, sim.eY[slot]); expect(choose()).toBeUndefined(); }
    for (const distance of [16, 48]) { put(sim, p, sim.eX[slot] + distance, sim.eY[slot]); expect(choose()?.x).toBe(p.x); }
    p.dead = true; expect(choose()).toBeUndefined(); p.dead = false;
    sim.map.hazard[Math.floor(p.y) * sim.map.w + Math.floor(p.x)] = 1; expect(choose()).toBeUndefined();
    sim.map.hazard.fill(0); sim.map.solid[10 * sim.map.w + 20] = 1; expect(choose()).toBeUndefined();
  });
  it('locks a distant spot, charges in place, flies the final second and strikes only at landing', () => {
    const { sim, slot } = fixture(room(80, 25)), p = sim.players[0];
    put(sim, p, 35.5, 10.5); sim.dominions.leapReadyAt[slot] = 0;
    for (let i = 0; i < 30 && !sim.dominions.active.size; i++) sim.step();
    const cast = sim.dominions.checkpoint()[0]; expect(cast.leap).toBeDefined();
    const target = cast.leap!; p.x = 60.5;
    const detached = sim.dominions.checkpoint()[0]; detached.leap!.x = 70;
    while (sim.tick < cast.startTick + 14) sim.step();
    expect(sim.eX[slot]).toBeCloseTo(target.fromX); expect(sim.eZ[slot]).toBe(0);
    while (sim.tick < cast.startTick + 38) sim.step();
    expect(sim.eZ[slot]).toBeGreaterThan(3.5); expect(sim.eX[slot]).toBeGreaterThan(target.fromX);
    expect(sim.events.some((e) => e.event.type === 'dominionCast' && e.event.phase === 'strike')).toBe(false);
    while (sim.tick < cast.impactTick) sim.step();
    expect(sim.eX[slot]).toBe(target.x); expect(sim.eZ[slot]).toBe(target.z);
    expect(sim.dominions.leapReadyAt[slot]).toBe(cast.impactTick + 240);
    expect(sim.events.find((e) => e.event.type === 'dominionCast' && e.event.phase === 'strike')?.event).toMatchObject({ x: target.x, y: target.y, z: target.z });
    expect(p.hp).toBe(p.maxHp);
  });
  for (const control of ['root', 'stun', 'silence'] as const) it(`${control} cancels a flying slam without a delayed impact`, () => {
    const { sim, slot } = fixture(room(80, 25)); put(sim, sim.players[0], 35.5, 10.5); sim.dominions.leapReadyAt[slot] = 0;
    while (!sim.dominions.active.size && sim.tick < 30) sim.step();
    const cast = sim.dominions.checkpoint()[0];
    while (sim.tick < cast.startTick + 35) sim.step();
    sim[control](slot, 10); expect(sim.dominions.active.size).toBe(0);
    while (sim.tick <= cast.impactTick) sim.step();
    expect(sim.events.filter((e) => e.event.type === 'dominionCast' && e.event.phase === 'strike')).toEqual([]);
    expect(sim.eZ[slot]).toBeGreaterThanOrEqual(0);
  });
  it('starts at five metres and launches a surviving player outward with the edge-side damage and speed', () => {
    const { sim, slot } = fixture(), p = sim.players[0];
    put(sim, p, sim.eX[slot] + 5, sim.eY[slot]); sim.root(slot, 10);
    sim.step(); expect(sim.dominions.active.has(slot)).toBe(true);
    const impact = sim.dominions.checkpoint()[0].impactTick;
    while (sim.tick < impact) sim.step();
    // One sixth of the way in from the 6 m edge: 50 + 60 / 6 damage, 9 + 6 / 6 m/s.
    expect(p.hp).toBe(60);
    expect(sim.events.find((e) => e.event.type === 'teleport')?.event).toMatchObject({ launch: { dx: 10, dy: 0 } });
  });
  it('gates launch acknowledgement, bounds the extra movement allowance and clears it on teleport', () => {
    const { sim, slot } = fixture(), p = sim.players[0]; slam(sim, slot);
    const x = p.x;
    const input = { ...INPUT_DEFAULTS, seq: 1, x: x + 0.7, y: p.y, z: 1, yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 };
    sim.applyInput(p.id, input, 33); expect(p.x).toBe(x); expect(p.launchUntilMs).toBe(-1);
    sim.applyInput(p.id, { ...input, lastTeleportId: p.teleportId }, 33);
    expect(p.x).toBe(x + 0.7); expect(p.launchUntilMs).toBe(533);
    sim.applyInput(p.id, { ...input, seq: 2, x: p.x, lastTeleportId: p.teleportId }, 600);
    const before = p.x;
    sim.applyInput(p.id, { ...input, seq: 3, x: before + 20, lastTeleportId: p.teleportId }, 633);
    expect(p.x - before).toBeCloseTo(1.2 * p.speed * 0.033 + 0.5);
    slam(sim, slot); sim.teleport(p, 4, 4, 0); expect(p.launchUntilMs).toBe(0);
  });
  it('launches shielded survivors but not immune, lethal, out-of-ring or vertically excluded targets', () => {
    for (const mode of ['shield', 'god', 'invulnerable', 'lethal', 'far', 'high', 'center'] as const) {
      const { sim, slot } = fixture(), p = sim.players[0];
      if (mode === 'shield') sim.giveShield(p, 150, 20);
      if (mode === 'god') p.god = true;
      if (mode === 'invulnerable') p.invulUntil = 100;
      if (mode === 'lethal') p.hp = 70;
      if (mode === 'far') p.x = sim.eX[slot] + 6.01;
      if (mode === 'high') p.z = 1.51;
      if (mode === 'center') { p.x = sim.eX[slot]; p.y = sim.eY[slot]; }
      slam(sim, slot);
      const launches = sim.events.filter((e) => e.event.type === 'teleport' && e.event.launch);
      expect(launches.length, mode).toBe(mode === 'shield' || mode === 'center' ? 1 : 0);
      if (mode === 'shield') { expect(p.hp).toBe(120); expect(p.shield).toBe(60); } // 90 at 2 m
      if (mode === 'lethal') expect(p.dead).toBe(true);
    }
  });
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
    sim.eX[edge] = sim.eX[slot] + 6;
    const far = sim.placeEnemy(BLESSED, 17, 10, 0), high = sim.placeEnemy(BLESSED, 13, 11, 0);
    sim.eZ[high] = 1.51;
    const elite = sim.placeEnemy(DOMINION, 11, 11, 0), boss = sim.placeEnemy(GATEKEEPER, 12, 12, 0), flyer = sim.placeEnemy(CHERUB, 13, 12, 0);
    const grounded = sim.placeEnemy(CHERUB, 13, 9, 0); sim.eZ[grounded] = 0;
    for (const s of [near, edge, grounded]) sim.eHp[s] = 1000; // survive the slam's damage to show the throw
    sim.players[0].z = 1; sim.giveShield(sim.players[0], 150, 20);
    slam(sim, slot);
    for (const s of [near, edge, grounded, elite]) { expect(sim.eAlive[s]).toBe(1); expect(sim.eVz[s]).toBe(9); }
    for (const s of [far, high, elite, boss, flyer]) expect(sim.eAlive[s]).toBe(1);
    expect(sim.players[0].shield).toBe(60); expect(sim.players[0].hp).toBe(120); // 90 at 2 m
    expect(sim.players[0].kills).toBe(0); expect(sim.players[0].damage).toBe(0);
  });
  it('blocks a tall obstacle while admitting the +1m dais through body-center sight', () => {
    const heights = room(32, 20).map((row, r) => r >= 7 && r <= 14 ? row.slice(0, 13) + '#' + row.slice(14) : row);
    heights[12] = heights[12].slice(0, 10) + '4' + heights[12].slice(11);
    const { sim, slot } = fixture(heights);
    const blocked = sim.placeEnemy(BLESSED, 14, 10, 0);
    const dais = sim.placeEnemy(BLESSED, 10, 12, 0); sim.eZ[dais] = 1; sim.eHp[dais] = 1000;
    slam(sim, slot); expect(sim.eAlive[blocked]).toBe(1); expect(sim.eAlive[dais]).toBe(1); expect(sim.eVz[dais]).toBe(9);
  });
  for (const control of ['stun', 'silence', 'removeEnemy'] as const) it(`${control} immediately sends one terminal cancellation`, () => {
    const { sim, slot } = fixture(); sim.step(); expect(sim.dominions.active.has(slot)).toBe(true);
    if (control === 'removeEnemy') sim.removeEnemy(slot); else sim[control](slot, 1);
    if (control === 'removeEnemy') sim.removeEnemy(slot); else sim[control](slot, 2);
    expect(sim.dominions.active.size).toBe(0);
    expect(sim.events.filter((e) => e.event.type === 'dominionCast' && e.event.phase === 'cancel')).toHaveLength(1);
    expect(sim.pickups.live).toHaveLength(0);
  });
  it('hurts and throws enemies by distance, without fabricated player credit', () => {
    const { sim, slot } = fixture();
    const victim = sim.placeEnemy(CHORISTER, 13, 10, 0); sim.eWave[victim] = 0;
    sim.rooms[0].waveAlive[0]++;
    sim.haloLedgers.set(0, new HaloLedger(12, HALO_WEIGHT[CHORISTER]));
    const hp = sim.eHp[victim], x = sim.eX[victim], distance = Math.hypot(sim.eX[victim] - sim.eX[slot], sim.eY[victim] - sim.eY[slot]);
    slam(sim, slot);
    expect(sim.eAlive[victim]).toBe(1); expect(sim.eHp[victim]).toBe(hp - Math.round(dominionFalloff(DOMINION_ENEMY_DAMAGE, distance)));
    expect(sim.players[0].kills).toBe(0); expect(sim.players[0].damage).toBe(0); expect(sim.pickups.live).toEqual([]);
    expect(sim.haloLedgers.get(0)?.paid).toBe(0);
    for (let i = 0; i < 15; i++) sim.step();
    expect(sim.eX[victim] - x).toBeCloseTo(dominionFalloff(DOMINION_LAUNCH_SPEED, distance) * 0.5, 1); expect(sim.eZ[victim]).toBeGreaterThan(1.9);
  });
  it('kills Blessed near its feet for their coins, but only throws them at the edge', () => {
    const { sim, slot } = fixture();
    const [x, y] = [sim.eX[slot], sim.eY[slot]];
    const near = sim.placeEnemy(BLESSED, 13, 10, 0), edge = sim.placeEnemy(BLESSED, 13, 10, 0);
    sim.eX[near] = x + 2; sim.eY[near] = y; sim.eX[edge] = x; sim.eY[edge] = y + 5.5;
    for (const s of [near, edge]) { sim.eWave[s] = 0; sim.rooms[0].waveAlive[0]++; }
    sim.haloLedgers.set(0, new HaloLedger(2, 2 * HALO_WEIGHT[BLESSED]));
    slam(sim, slot);
    // 30 at 2 m kills a 20 HP Blessed; 12.5 at 5.5 m does not.
    expect(sim.eAlive[near]).toBe(0); expect(sim.eAlive[edge]).toBe(1);
    expect(sim.eHp[edge]).toBe(ENEMIES[BLESSED].hp - Math.round(dominionFalloff(DOMINION_ENEMY_DAMAGE, 5.5)));
    expect(sim.eVz[edge]).toBe(9);
    expect(sim.haloLedgers.get(0)?.paid).toBe(1); expect(sim.pickups.live.filter((p) => p.kind === COIN)).toHaveLength(1);
    expect(sim.players[0].kills).toBe(0);
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
  it('places a commander in the first arrivals while retaining the two-alive queue cap', () => {
    const dungeon = arenaDungeon([{ blessed: 100, choristers: 0, cherubs: 0, dominions: 3 }]);
    dungeon.rooms[0].shape = '1x1'; dungeon.rooms[0].band = 1;
    const sim = new Simulation({ dungeon, players: Array.from({ length: 4 }, (_, id) => ({ id, name: `P${id}`, classId: 'betrayer' as const })), seed: 1, god: true });
    sealAt(sim);
    while (sim.activeCount === 0 && sim.tick < 1000) sim.step();
    expect(sim.eType[sim.active[0]]).toBe(DOMINION);
    expect(sim.tick - sim.rooms[0].sealTick).toBeLessThan(30);
  });
  for (const party of [1, 4]) it(`spreads substantially more halos through Blessed kills at party ${party}`, () => {
    const dungeon = arenaDungeon([{ blessed: 200, choristers: 10, cherubs: 0, dominions: 8 }]);
    dungeon.rooms[0].shape = '1x1'; dungeon.rooms[0].band = 1;
    const sim = new Simulation({ dungeon, players: Array.from({ length: party }, (_, id) => ({ id, name: `P${id}`, classId: 'betrayer' as const })), seed: 1, god: true });
    sim.random = () => 0.99; sealAt(sim);
    const ledger = sim.haloLedgers.get(0)!;
    expect(ledger.budget).toBe(72); expect(ledger.reservedElites).toBe(3);
    expect(ledger.remainder).toBe(54);
    let dry = 0, longestDry = 0;
    for (let i = 0; i < scaleCount(200, party); i++) {
      const before = ledger.paid, slot = sim.placeEnemy(BLESSED, 20, 5, 0); sim.eWave[slot] = 0;
      sim.damageEnemy(slot, 10000, -1);
      dry = ledger.paid === before ? dry + 1 : 0; longestDry = Math.max(longestDry, dry);
    }
    expect(ledger.paid).toBe(46); expect(longestDry).toBeLessThanOrEqual(4);
    expect(sim.pickups.live.filter((p) => p.kind === COIN).reduce((sum, p) => sum + p.value, 0)).toBe(46);
    for (let i = 0; i < scaleCount(10, party); i++) {
      const slot = sim.placeEnemy(CHORISTER, 20, 5, 0); sim.eWave[slot] = 0; sim.damageEnemy(slot, 10000, -1);
    }
    expect(ledger.paid).toBe(54);
  });
  it('filters tags before safety, prefers eligible affinity and never stalls fodder on a blocked elite point', () => {
    const dungeon = arenaDungeon([{ blessed: 12, choristers: 4, cherubs: 0, dominions: 1 }]);
    const r = dungeon.rooms[0]; r.shape = '1x1'; r.band = 1; r.dominion = [2]; r.chorister = [5];
    r.spawnTags = [{ index: 2, only: ['dominion'] }, { index: 5, only: ['chorister'] }];
    const sim = new Simulation({ dungeon, players: Array.from({ length: 4 }, (_, id) => ({ id, name: `P${id}`, classId: 'fallen' as const })), seed: 1, god: true });
    const placements: Array<{ type: number; c: number; r: number }> = [];
    const internal = sim as unknown as { spawnAt(slot: number, type: number, c: number, r: number, ai: number, wave: number): void };
    const original = internal.spawnAt.bind(sim); internal.spawnAt = (slot, type, c, row, ai, wave) => { placements.push({ type, c, r: row }); original(slot, type, c, row, ai, wave); };
    sealAt(sim); for (let i = 0; i < 310; i++) sim.step();
    expect(placements.find((p) => p.type === DOMINION)).toMatchObject({ c: 31, r: 2 });
    expect(placements.filter((p) => p.type === CHORISTER)).toHaveLength(4);
    expect(placements.filter((p) => p.type === CHORISTER).every((p) => p.c === 31 && p.r === 5)).toBe(true);
    expect(placements.filter((p) => p.type === BLESSED).every((p) => !(p.c === 31 && [2, 5].includes(p.r)))).toBe(true);
  });
  it('falls back from an unsafe preferred point only to type eligible ordinary markers', () => {
    const dungeon = arenaDungeon([{ blessed: 0, choristers: 0, cherubs: 0, dominions: 1 }]);
    dungeon.rooms[0].dominion = [0]; // West marker camped by the party.
    dungeon.rooms[0].spawnTags = [{ index: 2, only: ['chorister'] }, { index: 5, only: ['chorister'] }, { index: 8, only: ['chorister'] }];
    const sim = new Simulation({ dungeon, players: [{ id: 0, name: 'P', classId: 'fallen' }], seed: 1, god: true });
    const placed: number[] = [], internal = sim as unknown as { spawnAt(slot: number, type: number, c: number, r: number, ai: number, wave: number): void };
    const original = internal.spawnAt.bind(sim); internal.spawnAt = (slot, type, c, r, ai, wave) => { placed.push(c); original(slot, type, c, r, ai, wave); };
    sealAt(sim); for (let i = 0; i < 310; i++) sim.step();
    const slot = Array.from(sim.active.subarray(0, sim.activeCount)).find((s) => sim.eType[s] === DOMINION)!;
    expect(placed).toEqual([19]);
    expect(slot).toBeDefined(); expect(sim.rooms[0].waveFullySpawned[0]).toBe(true);
  });
  it('retains authored elite counts without changing historical zero-elite records', () => {
    expect(waveCounts({ share: 1, mix: { blessed: 1 }, elites: 2 }, 400)).toEqual({ blessed: 280, choristers: 0, cherubs: 0, dominions: 2 });
    expect(waveCounts({ share: 1, mix: { blessed: 1 } }, 400)).toEqual({ blessed: 400, choristers: 0, cherubs: 0 });
    expect(waveSize({ blessed: 10, choristers: 0, cherubs: 0, dominions: 3 }, 1)).toBe(6);
    expect(ENEMIES[DOMINION]).toEqual({ hp: 1500, radius: 0.45, height: 3.2, speed: 3.5, flying: false, draw: 1.9 });
  });
  it('scales HP per rounded group, reserves first elites and does not stall fodder behind the alive cap', () => {
    // A 72-halo room reserves gold for floor(72 / 24) = 3 of its 4 elites.
    const dungeon = arenaDungeon([{ blessed: 40, choristers: 0, cherubs: 0, dominions: 4 }]);
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
    expect(sim.haloLedgers.get(0)?.reservedElites).toBe(3);
    expect(elites.map((s) => sim.eGoldEntitled[s])).toEqual([1, 1]);
    sim.random = () => 0.1; sim.damageEnemy(elites[0], 10000, -1);
    expect(sim.pickups.live.filter((p) => p.kind === GOLD_HALO)).toHaveLength(1);
    expect(sim.pickups.live.filter((p) => p.kind === HEAL_MOTE)).toHaveLength(2);
    expect(sim.pickups.live.filter((p) => p.kind >= ITEM_FIRST)).toHaveLength(1);
    const next = () => Array.from(sim.active.subarray(0, sim.activeCount)).find((s) => sim.eType[s] === DOMINION && !elites.includes(s))!;
    sim.step(); expect(sim.rooms[0].waveFullySpawned[0]).toBe(false);
    const third = next(); elites.push(third);
    expect(sim.eGoldEntitled[third]).toBe(1);
    sim.damageEnemy(third, 10000, -1);
    sim.step(); expect(sim.rooms[0].waveFullySpawned[0]).toBe(true);
    const fourth = next();
    expect(sim.eGoldEntitled[fourth]).toBe(0);
    sim.damageEnemy(fourth, 10000, -1); sim.damageEnemy(fourth, 10000, -1);
    expect(sim.pickups.live.filter((p) => p.kind === GOLD_HALO)).toHaveLength(2);
    expect(sim.pickups.live.filter((p) => p.kind === HEAL_MOTE)).toHaveLength(4); // the 1×1 room's mote cap
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

 it('flies vertically at takeoff and landing, and clears the whole silhouette around columns', () => {
   const { sim } = fixture(room(80, 25));
   const leap = { fromX: 10.5, fromY: 10.5, fromZ: 0, x: 58.5, y: 10.5, z: 0 };
   const up = dominionLeapPosition(leap, 0.2), down = dominionLeapPosition(leap, 0.8);
   expect(up[0]).toBe(leap.fromX); expect(up[2]).toBeGreaterThan(4);
   expect(down[0]).toBe(leap.x); expect(down[2]).toBeGreaterThan(4);
   expect(dominionLeapPosition(leap, 0.5)[2]).toBe(8);
   expect(dominionLeapClear(sim.map, 0, leap)).toBe(true);
   sim.map.hazard[11 * sim.map.w + 58] = 1;
   expect(dominionLeapClear(sim.map, 0, leap)).toBe(false);
   sim.map.hazard.fill(0);
   // Off the center line, outside the walking radius but inside the flying silhouette.
   sim.map.solid[11 * sim.map.w + 30] = 1;
   expect(dominionLeapClear(sim.map, 0, leap)).toBe(false);
   expect(dominionLeapClear(sim.map, 0, leap, 0.4, 0.6)).toBe(false);
 });

it('leads accepted running movement, shortens unsafe leads, and forgets stopped/stale/teleported motion', () => {
  const { sim, slot } = fixture(room(80, 25)), p = sim.players[0]; put(sim, p, 35.5, 10.5);
  const input = { ...INPUT_DEFAULTS, seq: 0, x: p.x, y: p.y, z: 0, yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 };
  for (let n = 1; n <= 12; n++) { sim.applyInput(p.id, { ...input, seq: n, x: p.x + p.speed / 30 }, n * 1000 / 30); }
  sim.nowMs = p.lastAcceptMs;
  const choose = () => (sim as unknown as { dominionLeapTarget(s: number): DominionLeap | undefined }).dominionLeapTarget(slot);
  const target = choose()!;
  expect(target.x - p.x).toBeGreaterThan(8.5); expect(target.y).toBe(p.y);
  // Continuing at the fastest class's speed stays in the 6 m impact radius; turning escapes.
  expect(Math.abs(p.x + p.speed * 1.5 - target.x)).toBeLessThan(6);
  expect(Math.hypot(p.x - target.x, p.speed * 1.5)).toBeGreaterThan(6);
  sim.map.hazard[10 * sim.map.w + Math.floor(target.x)] = 1;
  expect(choose()!.x).toBeLessThan(target.x); expect(choose()!.x).toBeGreaterThan(p.x);
  sim.map.hazard.fill(0);
  sim.nowMs += 251; expect(choose()!.x).toBeCloseTo(p.x);
  sim.nowMs = p.lastAcceptMs;
  sim.applyInput(p.id, { ...input, seq: 13, x: p.x }, p.lastAcceptMs + 33);
  sim.nowMs = p.lastAcceptMs; expect(choose()!.x).toBeCloseTo(p.x);
  p.moveVx = 9; sim.teleport(p, 35.5, 10.5, 0); expect(choose()!.x).toBe(35.5);
  // A dev jump or packet spike cannot create a huge leading velocity.
  sim.applyInput(p.id, { ...input, seq: 14, x: 70, lastTeleportId: p.teleportId }, p.lastAcceptMs + 33);
  expect(p.moveVx).toBe(0); expect(p.moveVy).toBe(0);
});

it('applies the same backward speed factor to the host movement bound', () => {
  const { sim } = fixture(room(80, 25)), p = sim.players[0]; put(sim, p, 35.5, 10.5);
  sim.applyInput(p.id, { ...INPUT_DEFAULTS, seq: 1, x: 1, y: p.y, z: 0, yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 }, 1000);
  expect(35.5 - p.x).toBeCloseTo(1.2 * p.speed * 0.8 + 0.5);
});

for (const turn of [false, true]) it(`a ${turn ? 'turning' : 'straight'} runner ${turn ? 'escapes' : 'is hit by'} the locked predictive flying slam`, () => {
  const { sim, slot } = fixture(room(90, 40)), p = sim.players[0]; put(sim, p, 35.5, 10.5);
  sim.dominions.leapReadyAt[slot] = 0;
  let seq = 0;
  const run = (sideways: boolean) => {
    const now = (sim.tick + 1) * 1000 / 30;
    sim.applyInput(p.id, { ...INPUT_DEFAULTS, seq: ++seq, x: p.x + (sideways ? 0 : p.speed / 30), y: p.y + (sideways ? p.speed / 30 : 0),
      z: 0, yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: p.teleportId }, now);
    sim.step(now);
  };
  while (!sim.dominions.active.size && sim.tick < 30) run(false);
  const cast = sim.dominions.checkpoint()[0]; expect(cast.leap).toBeDefined();
  expect(cast.leap!.x - p.x).toBeGreaterThan(8.5);
  while (sim.tick < cast.impactTick) run(turn);
  const distance = Math.hypot(p.x - cast.leap!.x, p.y - cast.leap!.y);
  expect(p.hp).toBe(turn ? p.maxHp : p.maxHp - Math.round(dominionFalloff(DOMINION_PLAYER_DAMAGE, distance)));
  const strike = sim.events.find((e) => e.event.type === 'dominionCast' && e.event.phase === 'strike');
  expect(strike?.event).toMatchObject({ x: cast.leap!.x, y: cast.leap!.y });
});
