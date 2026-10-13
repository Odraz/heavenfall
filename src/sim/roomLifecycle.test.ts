import { describe, expect, it, vi } from 'vitest';
import { GridBuilder } from '../data/dungeons/build';
import { validateLevel } from '../data/dungeons/validate';
import type { DungeonDef, RoomDef } from '../data/dungeons/types';
import { BLESSED, CHERUB, CHORISTER } from '../data/enemies';
import { PHASE_CLEARED, PHASE_COMBAT, PHASE_IDLE, decodeSnapshot } from '../net/protocol';
import { PINNED } from '../gen/pinned';
import { TICK_HZ } from './constants';
import { FlowField, UNREACHABLE } from './flowfield';
import { applyLeaves } from './map';
import { loadRunMap } from './runMap';
import { ROOM_NONE, Simulation, bossMultiplier, partyMultiplier, scaleCount } from './sim';
import { sealNow } from './testutil/sims';

const wave = { blessed: 50, choristers: 0, cherubs: 0 };
function dungeon(): DungeonDef {
  const g = new GridBuilder(54, 23);
  g.fillRect(1, 1, 52, 21, 0);
  for (const [x, y] of [[2, 2], [2, 3], [3, 2], [3, 3]]) g.marker(x, y, 'S');
  for (const [x, y] of [[8, 3], [8, 18], [20, 3], [20, 18], [30, 3], [50, 18]]) g.marker(x, y, 'x');
  const make = (id: number, x0: number, x1: number, kind: RoomDef['kind']): RoomDef => ({
    id: `r${id}`, name: `R${id}`, kind, rect: { x0, y0: 1, x1, y1: 21 },
    leaves: [],
    entry: [{ socket: 0, cells: [[x0 + 1, 9], [x0 + 1, 10], [x0 + 1, 11], [x0 + 1, 12]] },
      { socket: 2, cells: [[x1 - 1, 9], [x1 - 1, 10], [x1 - 1, 11], [x1 - 1, 12]] }],
    waves: kind === 'combat' ? [wave, wave] : [], boss: kind === 'boss', shape: '1x1',
  });
  return { id: 'lifecycle-test', name: 'Lifecycle', ...g.build(), rooms: [make(0, 1, 4, 'breach'), make(1, 7, 23, 'combat'), make(2, 28, 52, 'combat')] };
}
function make(bots: boolean[] = [false], noWaves = false): Simulation {
  return new Simulation({ dungeon: dungeon(), players: bots.map((bot, id) => ({ id, name: `P${id}`, classId: 'binder', bot })), seed: 1, god: true, noWaves });
}
function put(sim: Simulation, id: number, x: number, y = 10.5): void {
  Object.assign(sim.slots[id]!, { x, y, z: sim.map.floor[Math.floor(y) * sim.map.w + Math.floor(x)] });
}
function run(sim: Simulation, seconds: number): void {
  for (let i = 0; i < seconds * TICK_HZ; i++) sim.step();
}

describe('R1.4 room lifecycle', () => {
  it('rejects ordinary combat without waves in both generated content and fixtures', () => {
    const sim = make(); sim.map.rooms[1].waves = [];
    for (const mode of ['floor', 'fixture'] as const) {
      expect(validateLevel(sim.map, dungeon().markers, mode)).toContain('room 1: an ordinary combat room has no waves');
    }
  });

  it('starts only for a living human and allows only one branch to count down', () => {
    const sim = make([false, false, true]);
    put(sim, 2, 10.5); sim.step();
    expect(sim.activeRoom).toBe(ROOM_NONE);
    put(sim, 0, 12.5); put(sim, 1, 32.5); sim.step();
    expect(sim.activeRoom).toBe(1);
    expect(sim.rooms[2].phase).toBe(PHASE_IDLE);
    expect(sim.countdownLeft()).toBe(20);
    expect(sim.rooms[1].knowledge).toBe(2);
  });

  it('holds for a minority, counts a vestibule toward quorum, and drops to three seconds when all are inside', () => {
    const sim = make([false, false, false, true]);
    put(sim, 0, 12.5); sim.step(); run(sim, 1);
    expect(sim.countdownLeft()).toBe(20);
    put(sim, 1, 5.5); run(sim, 1);
    expect(sim.countdownLeft()).toBe(19);
    put(sim, 1, 12.5); put(sim, 2, 13.5); sim.step();
    expect(sim.countdownLeft()).toBe(3);
    run(sim, 3);
    expect(sim.activePhase).toBe(PHASE_COMBAT);
  });

  it('cancels after three empty seconds, retains visited state, and starts a fresh timer on reentry', () => {
    const sim = make([false, false]);
    put(sim, 0, 12.5); sim.step(); put(sim, 0, 2.5);
    run(sim, 3);
    expect(sim.activeRoom).toBe(ROOM_NONE);
    expect(sim.rooms[1].phase).toBe(PHASE_IDLE);
    expect(sim.rooms[1].knowledge).toBe(2);
    put(sim, 0, 12.5); sim.step(); expect(sim.countdownLeft()).toBe(20);
    sim.players[0].dead = true; sim.players[1].bot = true; sim.step();
    expect(sim.activeRoom).toBe(ROOM_NONE);
  });

  it('seals at the nearest socket and teleports outsiders, vestibules and souls, without resurrecting them', () => {
    const sim = make([false, false, true, false]);
    put(sim, 0, 22.5); put(sim, 1, 25.5); put(sim, 2, 32.5);
    sim.players[3].dead = true; sim.players[3].hp = 0;
    sim.step(); expect(sim.rooms[1].entrySocket).toBe(2);
    sealNow(sim, 1);
    for (const p of sim.players.slice(1)) {
      const [x, y] = sim.map.rooms[1].entry[1].cells[p.id];
      expect([p.x, p.y]).toEqual([x + 0.5, y + 0.5]);
      expect(p.teleportId).toBe(1);
    }
    expect(sim.players[3].dead).toBe(true);
    expect(sim.rooms[1].partySize).toBe(3.5);
    expect(sim.rooms[1].director?.cap).toBe(58); // 45 + floor(45 * .3)
    const joiner = make([false]); put(joiner, 0, 22.5); joiner.step(); sealNow(joiner, 1);
    const p = joiner.addPlayer({ id: 2, name: 'Late', classId: 'heretic' })!;
    expect(p.dead).toBe(true);
    expect([p.x, p.y]).toEqual([22.5, 11.5]);
    expect(joiner.rooms[1].partySize).toBe(1);
  });

  it('joins a countdown next to the lowest-id living player', () => {
    const sim = make(); put(sim, 0, 22.5); sim.step();
    const p = sim.addPlayer({ id: 1, name: 'Late', classId: 'heretic' })!;
    expect(p.dead).toBe(false);
    expect([p.x, p.y, p.z]).toEqual([sim.players[0].x, sim.players[0].y, sim.players[0].z]);
  });

  it('clears non-combat rooms on first visit and runs the boss despite empty ordinary waves', () => {
    const loaded = loadRunMap({ seed: PINNED.seed, heaven: 1, floor: 1, fixture: null });
    const sim = new Simulation({ dungeon: loaded.def, map: loaded.map, players: [{ id: 0, name: 'P', classId: 'binder' }], seed: 1, god: true });
    for (const kind of ['pardoner', 'confessional'] as const) {
      const i = sim.map.rooms.findIndex((r) => r.kind === kind);
      const [c, r] = sim.map.rooms[i].entry[0].cells[0]; put(sim, 0, c + 0.5, r + 0.5); sim.step();
      expect(sim.rooms[i].phase).toBe(PHASE_CLEARED);
      expect(sim.activeRoom).toBe(ROOM_NONE);
    }
    const i = loaded.floor!.boss, room = sim.map.rooms[i];
    expect(room.waves).toHaveLength(0);
    const [c, r] = room.entry[0].cells[0]; put(sim, 0, c + 0.5, r + 0.5); sim.step(); sealNow(sim, i);
    expect(sim.activePhase).toBe(PHASE_COMBAT);
    expect(sim.bossSlot).toBeGreaterThanOrEqual(0);
    expect(sim.rooms[i].phase).not.toBe(PHASE_CLEARED);
  });

  it('derives all generated leaves from the snapshot header on both host and client', () => {
    const config = { seed: PINNED.seed, heaven: 1, floor: 1, fixture: null } as const;
    const a = loadRunMap(config), b = loadRunMap(config);
    const sim = new Simulation({ dungeon: a.def, map: a.map, players: [{ id: 0, name: 'P', classId: 'binder' }], seed: 1 });
    const combat = sim.map.rooms.findIndex((r) => r.kind === 'combat');
    const [c, r] = sim.map.rooms[combat].entry[0].cells[0]; put(sim, 0, c + 0.5, r + 0.5); sim.step();
    for (const seal of [false, true]) {
      if (seal) sealNow(sim, combat);
      const header = decodeSnapshot(sim.encodeFor(0)[0])!; applyLeaves(b.map, header);
      expect(b.map.solid).toEqual(a.map.solid); expect(b.map.top).toEqual(a.map.top);
    }
  });

  it('heals living players by 30%, caps at max HP, and respawns souls at 50% on the selected entry', () => {
    const sim = make([false, false, false], true);
    put(sim, 0, 22.5); put(sim, 1, 22.5);
    sim.players[0].hp = 40; sim.players[1].hp = 220; sim.players[2].dead = true;
    sim.step(); sealNow(sim, 1);
    expect(sim.rooms[1].phase).toBe(PHASE_CLEARED);
    expect(sim.players.map((p) => p.hp)).toEqual([112, 240, 120]);
    expect(sim.players[2].dead).toBe(false);
    expect([sim.players[2].x, sim.players[2].y]).toEqual([22.5, 11.5]);
    run(sim, 1); expect(sim.players[0].hp).toBe(112);
  });

  it('interpolates half-player scaling and infers solo from connected humans and bots', () => {
    expect(partyMultiplier(1.5)).toBe(0.5); expect(partyMultiplier(3.5)).toBe(0.9);
    expect(scaleCount(33, 1.5)).toBe(17); expect(scaleCount(33, 3.5)).toBe(30);
    expect(scaleCount(10, 3.5)).toBe(9);
    expect(bossMultiplier(1, false)).toBe(0.4);
    const sim = make([false, true]); expect(sim.solo).toBe(false); expect(sim.partySize()).toBe(1.5);
    sim.removePlayer(1); expect(sim.solo).toBe(true);
  });

  it('limits baseline regeneration to true solo boss combat and stops it when a bot joins', () => {
    const loaded = loadRunMap({ seed: PINNED.seed, heaven: 1, floor: 1, fixture: null });
    const sim = new Simulation({ dungeon: loaded.def, map: loaded.map, players: [{ id: 0, name: 'P', classId: 'binder' }], seed: 1, god: true, startRoom: loaded.floor!.boss });
    const p = sim.players[0]; p.hp = p.maxHp * 0.5;
    sim.step(); expect(p.hp).toBe(p.maxHp * 0.5); sealNow(sim, loaded.floor!.boss);
    p.lastDamageTick = sim.tick - 8 * TICK_HZ;
    run(sim, 1); expect(p.hp).toBeCloseTo(p.maxHp * 0.515);
    sim.addPlayer({ id: 1, name: 'Bot', classId: 'fallen', bot: true });
    const hp = p.hp; run(sim, 1); expect(p.hp).toBe(hp);
  });

  it('uses 10 m for a generated 1x1, 15 m otherwise, and queues markers within 3 m', () => {
    for (const shape of ['1x1', '2x1', '2x2', undefined] as const) {
      const sim = make(); sim.map.rooms[1].shape = shape;
      sim.map.roomSpawnPoints[1] = [[19, 10], [23, 10]];
      put(sim, 0, 7.5); sim.step(); sealNow(sim, 1);
      run(sim, 1);
      const slots = [...sim.active.slice(0, sim.activeCount)];
      expect(slots.length).toBeGreaterThan(0);
      if (shape === '1x1') expect(slots.some((s) => sim.eX[s] < 20)).toBe(true);
      else expect(slots.every((s) => sim.eX[s] > 20)).toBe(true);
    }
    const sim = make(); sim.map.roomSpawnPoints[1] = [[11, 10]];
    put(sim, 0, 10.5); sim.step(); sealNow(sim, 1); run(sim, 2);
    expect(sim.living).toBe(0); expect(sim.rooms[1].queue.length).toBe(1);
    expect(sim.rooms[1].waveFullySpawned[0]).toBe(false);
    put(sim, 0, 20.5); run(sim, 1); expect(sim.living).toBeGreaterThan(0);
  });
});

describe('R1.4 trickle and bounded fields', () => {
  function cleared(bots: boolean[] = [false]): Simulation {
    const sim = make(bots); sim.rooms[1].phase = PHASE_CLEARED; run(sim, 10); return sim;
  }

  it.each([[false], [false, true], [false, false, false, false]])('warns a visible revisit after three seconds, then spends a refill only on arrival, sized using P: %j', (...bots: boolean[]) => {
    const sim = cleared(bots); put(sim, 0, 12.5); sim.step(); run(sim, 3);
    expect(sim.living).toBe(0); expect(sim.rooms[1].refills).toBe(3);
    expect(sim.floorSync('run').spawnWarnings).toHaveLength(1); run(sim, 1);
    expect(sim.living).toBe(Math.floor(Math.min(12, 4 + 2 * sim.partySize())));
    expect(sim.rooms[1].refills).toBe(2);
    expect(sim.activeRoom).toBe(ROOM_NONE);
    for (const s of sim.active.slice(0, sim.activeCount)) expect([sim.home[s], sim.leashed[s], sim.eType[s]]).toEqual([1, 1, BLESSED]);
  });

  it('passing through, bots alone and another active room spend no refill; at most three visits refill', () => {
    const sim = cleared([false, true]); put(sim, 0, 12.5); sim.step(); run(sim, 2); put(sim, 0, 2.5); run(sim, 1);
    expect(sim.rooms[1].refills).toBe(3);
    put(sim, 1, 12.5); run(sim, 10); expect(sim.living).toBe(0);
    put(sim, 0, 32.5); sim.step(); put(sim, 0, 12.5); run(sim, 2); expect(sim.rooms[1].refills).toBe(3);
    // Cancel the other countdown before exercising three revisits.
    put(sim, 0, 2.5); run(sim, 11);
    for (let i = 0; i < 4; i++) {
      put(sim, 0, 12.5); sim.step(); run(sim, 4); sim.killAll();
      put(sim, 0, 2.5); run(sim, 11);
    }
    expect(sim.rooms[1].refills).toBe(0);
  });

  it('targets only players at home, refuses pull/knockback/separation across its boundary, and fades without credit', () => {
    const sim = cleared(); put(sim, 0, 12.5); sim.step(); run(sim, 4);
    const s = sim.active[0]; sim.eX[s] = 23.8; sim.eY[s] = 10.5;
    sim.pull(s, 30.5, 10.5, 0); run(sim, 1);
    expect(Math.floor(sim.eX[s])).toBeLessThanOrEqual(23);
    sim.knockback(s, 1, 0, 8); run(sim, 1);
    expect(Math.floor(sim.eX[s])).toBeLessThanOrEqual(23);
    const other = sim.active[1]; sim.eX[other] = 23.8; sim.eY[other] = 10.5;
    run(sim, 1); expect(Math.floor(sim.eX[other])).toBeLessThanOrEqual(23);
    put(sim, 0, 2.5); sim.step();
    for (const slot of sim.active.slice(0, sim.activeCount)) expect(sim.eTarget[slot]).toBe(-1);
    run(sim, 10); expect(sim.living).toBe(0); expect(sim.players[0].kills).toBe(0);
    expect(sim.rooms[1].refills).toBe(2);
  });

  it('clamps ground and air searches and computes no automatic fields without enemies', () => {
    const sim = make(); const field = new FlowField(sim.map, false);
    field.compute(12, 10, { x0: 7, y0: 1, x1: 23, y1: 21 });
    expect(field.at(22, 10)).not.toBe(UNREACHABLE); expect(field.at(25, 10)).toBe(UNREACHABLE);
    const ground = vi.spyOn(sim.groundFields[0], 'compute'), air = vi.spyOn(sim.airFields[0], 'compute');
    run(sim, 1); expect(ground).not.toHaveBeenCalled(); expect(air).not.toHaveBeenCalled();
    put(sim, 0, 12.5); sim.placeEnemy(BLESSED, 20, 10, 1); sim.step();
    expect(ground).toHaveBeenCalled(); expect(air).not.toHaveBeenCalled();
    expect(sim.groundFields[0].at(29, 10)).toBe(UNREACHABLE);
    sim.placeEnemy(CHERUB, 20, 10, 1); run(sim, 0.5); expect(air).toHaveBeenCalled();
  });

  it('prefers hidden markers even when a visible marker is farther from the party', () => {
    const sim = cleared();
    sim.map.roomSpawnPoints[1] = [[8, 10], [20, 10]];
    for (let y = 7; y <= 13; y++) {
      const cell = y * sim.map.w + 10;
      sim.map.wall[cell] = sim.map.solid[cell] = 1; sim.map.top[cell] = 8;
    }
    put(sim, 0, 12.5); sim.step(); run(sim, 3);
    expect(sim.living).toBe(6);
    expect([...sim.active.slice(0, sim.activeCount)].every((s) => sim.eX[s] < 10)).toBe(true);
  });

  it('does not activate a pending refill after victory', () => {
    const sim = cleared(); put(sim, 0, 12.5); sim.step(); run(sim, 2);
    sim.finish('victory'); run(sim, 2);
    expect(sim.living).toBe(0); expect(sim.rooms[1].refills).toBe(3);
  });

  it('waits for complete batch capacity and does not spend a refill at the global cap', () => {
    const sim = cleared();
    for (let i = 0; i < 1500; i++) expect(sim.placeEnemy(BLESSED, 45, 10, 2)).toBeGreaterThanOrEqual(0);
    expect(sim.placeEnemy(BLESSED, 45, 10, 2)).toBe(-1);
    put(sim, 0, 12.5); sim.step(); run(sim, 3);
    expect(sim.activeCount).toBe(1500); expect(sim.rooms[1].refills).toBe(3);
    while (sim.activeCount > 0) sim.removeEnemy(sim.active[sim.activeCount - 1], true);
    sim.step();
    expect(sim.living).toBe(0); expect(sim.rooms[1].refills).toBe(3); run(sim, 1);
    expect(sim.living).toBe(6); expect(sim.rooms[1].refills).toBe(2);
  });
});

describe('R1.4 anti-softlock', () => {
  it('recovers each motionless survivor after the last wave, even while another enemy moves', () => {
    const sim = make(); put(sim, 0, 12.5); sim.step(); sealNow(sim, 1);
    sim.rooms[1].queue.length = 0;
    sim.rooms[1].wave = 1; sim.rooms[1].waveFullySpawned[1] = true;
    sim.rooms[1].director!.waveStarted(1);
    const s = sim.placeEnemy(BLESSED, 8, 10, 1);
    sim.eRootUntil[s] = 2000;
    sim.placeEnemy(CHORISTER, 20, 18, 1);
    while (sim.tick < 25 * TICK_HZ) sim.step();
    expect([sim.eX[s], sim.eY[s]]).toEqual([8.5, 10.5]);
    expect(sim.floorSync('run').spawnWarnings?.some((w) => w.readyTick - w.startTick === TICK_HZ)).toBe(true);
    run(sim, 1); // R2 warns for a full second before the same recovery.
    expect([sim.eX[s], sim.eY[s]]).toEqual([20.5, 18.5]);
    expect(sim.eRootUntil[s]).toBe(2000);
    expect(sim.eAlive[s]).toBe(1);
  });

  it('relocates an unreachable enemy to the farthest safe reachable marker, keeping HP and statuses', () => {
    const sim = make(); put(sim, 0, 12.5); sim.step(); sealNow(sim, 1);
    sim.rooms[1].queue.length = 0;
    const s = sim.placeEnemy(CHORISTER, 25, 10, 1);
    sim.eHp[s] = 7; sim.eSilenceUntil[s] = 2000; sim.eRootUntil[s] = 2000;
    for (const [x, y] of [[24, 10], [26, 10], [25, 9], [25, 11]]) sim.map.solid[y * sim.map.w + x] = 1;
    run(sim, 15);
    expect(sim.eHp[s]).toBe(7); expect(sim.eSilenceUntil[s]).toBe(2000);
    const incarnation = sim.eIncarnation[s];
    expect(sim.eX[s]).toBe(25.5); expect(sim.floorSync('run').spawnWarnings).toHaveLength(1);
    run(sim, 1); expect(sim.eIncarnation[s]).toBe(incarnation);
    expect(sim.eX[s]).toBe(20.5); expect(sim.eY[s]).toBe(18.5);
    expect(sim.eAlive[s]).toBe(1); expect(sim.players[0].kills).toBe(0);
  });

  it('uses a warned reachable floor when authored markers are absent', () => {
    const sim = make(); put(sim, 0, 12.5); sim.step(); sealNow(sim, 1);
    sim.rooms[1].queue.length = 0; sim.map.roomSpawnPoints[1] = [];
    const s = sim.placeEnemy(CHORISTER, 25, 10, 1); sim.eRootUntil[s] = 2000;
    for (const [x, y] of [[24, 10], [26, 10], [25, 9], [25, 11]]) sim.map.solid[y * sim.map.w + x] = 1;
    run(sim, 15); const w = sim.floorSync('run').spawnWarnings![0]; expect(w).toBeDefined();
    expect(sim.eX[s]).toBe(25.5); run(sim, 1);
    expect([sim.eX[s], sim.eY[s]]).toEqual([w.x, w.y]); expect(sim.players[0].kills).toBe(0);
  });

  it('cancels recovery when the player occupies the warned point and retains the original actor and statuses', () => {
    const sim = make(); put(sim, 0, 12.5); sim.step(); sealNow(sim, 1); sim.rooms[1].queue.length = 0;
    const s = sim.placeEnemy(CHORISTER, 25, 10, 1); sim.eRootUntil[s] = sim.eSilenceUntil[s] = 2000; sim.eHp[s] = 7;
    for (const [x, y] of [[24, 10], [26, 10], [25, 9], [25, 11]]) sim.map.solid[y * sim.map.w + x] = 1;
    run(sim, 15); const w = sim.floorSync('run').spawnWarnings![0]; put(sim, 0, w.x, w.y); run(sim, 1);
    expect(sim.eX[s]).toBe(25.5); expect(sim.eHp[s]).toBe(7); expect(sim.eSilenceUntil[s]).toBe(2000);
    expect(sim.floorSync('run').spawnWarnings?.some((q) => q.id === w.id)).toBe(false);
  });

  it('removes without credit and logs a defect only after another ten seconds without a legal floor point', () => {
    const sim = make(); put(sim, 0, 12.5); sim.step(); sealNow(sim, 1);
    sim.rooms[1].queue.length = 0; sim.map.roomSpawnPoints[1] = [];
    const s = sim.placeEnemy(BLESSED, 25, 10, 1);
    for (let y = 1; y <= 21; y++) for (let x = 7; x <= 23; x++) if (Math.abs(x - 12) > 2 || Math.abs(y - 10) > 2) sim.map.solid[y * sim.map.w + x] = 1;
    for (const [x, y] of [[24, 10], [26, 10], [25, 9], [25, 11]]) sim.map.solid[y * sim.map.w + x] = 1;
    const log = vi.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      run(sim, 20); expect(sim.eAlive[s]).toBe(1);
      run(sim, 5); expect(sim.eAlive[s]).toBe(0);
      expect(log).toHaveBeenCalledWith('diagnostic: unreachable enemy removed', { room: 1, slot: s });
      expect(sim.players[0].kills).toBe(0);
    } finally { log.mockRestore(); }
  });
});
