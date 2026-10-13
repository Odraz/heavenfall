import { describe, expect, it } from 'vitest';
import { COIN, HEAL_MOTE, ITEM_FIRST } from '../data/pickups';
import { makeSim as makeEmptySim, put, room } from './testutil/sims';
import { dungeonOf } from './testutil/maps';
import type { ClassId } from '../data/classes';
import type { SimOptions } from './sim';
import { Pickups } from './pickups';
import { decodeSnapshot } from '../net/protocol';
import { HaloLedger } from './economy';
import { BLESSED, CHORISTER, CHERUB, DOMINION } from '../data/enemies';

function makeSim(heights: string[], classes: ClassId[], opts: Partial<SimOptions> = {}) {
  const dungeon = dungeonOf(heights);
  dungeon.rooms = [{ id: 'pickup-room', name: 'Pickup room', kind: 'breach', shape: '1x1',
    rect: { x0: 1, y0: 1, x1: heights[0].length - 2, y1: heights.length - 2 }, leaves: [],
    entry: [{ socket: 0, cells: [[1, 1], [2, 1], [3, 1], [1, 2]] }], waves: [{ blessed: 0, choristers: 0, cherubs: 0 }], boss: false }];
  return makeEmptySim(heights, classes, { ...opts, dungeon });
}

describe('R2 pickups', () => {
  it.each([[BLESSED, 0.02], [CHORISTER, 0.12], [CHERUB, 0.12], [DOMINION, 0.5]])(
    'rolls consumables for wave enemy %i at its exact chance, once per accepted death', (type, chance) => {
      const sim = makeSim(room(20, 20), ['fallen'], { noWaves: true });
      put(sim, sim.players[0], 18, 18);
      for (const roll of [chance - 0.0001, chance]) {
        sim.random = () => roll;
        const s = sim.placeEnemy(type, 5, 5, 0); sim.eWave[s] = 0;
        sim.damageEnemy(s, 10000, -1); sim.damageEnemy(s, 10000, -1);
      }
      expect(sim.pickups.live.filter((p) => p.kind >= ITEM_FIRST)).toHaveLength(1);
      sim.random = () => 0;
      const cleanup = sim.placeEnemy(type, 5, 5, 0); sim.eWave[cleanup] = 0; sim.removeEnemy(cleanup);
      const add = sim.placeEnemy(type, 5, 5, 0); sim.eWave[add] = -1; sim.damageEnemy(add, 10000, -1);
      const leashed = sim.placeEnemy(type, 5, 5, 0); sim.eWave[leashed] = 0; sim.leashed[leashed] = 1;
      sim.damageEnemy(leashed, 10000, -1);
      expect(sim.pickups.live.filter((p) => p.kind >= ITEM_FIRST)).toHaveLength(1);
    });

  it('attracts collision-safely and bots credit all connected humans exactly once', () => {
    const sim = makeSim(room(20, 20), ['fallen', 'heretic', 'binder'], { noWaves: true });
    const [a, b, bot] = sim.players; b.dead = true; bot.bot = true;
    put(sim, a, 18, 18); put(sim, b, 17, 17); put(sim, bot, 5.5, 5.5);
    sim.pickups.drop(COIN, 0, 8.5, 5.5, 0);
    for (let i = 0; i < 10; i++) sim.step();
    expect(sim.pickups.live).toHaveLength(0);
    expect([a.wallet, b.wallet, bot.wallet]).toEqual([3, 3, 0]);
    expect(sim.events.filter((e) => e.event.type === 'pickupCollected')).toHaveLength(1);
    sim.step(); expect(a.wallet).toBe(3);
    expect(decodeSnapshot(sim.encodeFor(0)[0])!.players[0].wallet).toBe(3);
  });
  it('motes ignore full HP, heal only the collector and reselect after death/disconnection', () => {
    const sim = makeSim(room(20, 20), ['fallen', 'heretic'], { noWaves: true });
    const [a, b] = sim.players; put(sim, a, 5, 5); put(sim, b, 5.5, 5); b.hp = 50;
    sim.pickups.drop(HEAL_MOTE, 0, 5.2, 5, 0); sim.step();
    expect(a.hp).toBe(a.maxHp); expect(b.hp).toBe(62);
    a.hp = 50; b.dead = true;
    sim.pickups.drop(HEAL_MOTE, 0, 5.2, 5, sim.tick); sim.step(); expect(a.hp).toBe(82);
    a.connected = false; sim.pickups.drop(HEAL_MOTE, 0, 5.2, 5, sim.tick); sim.step();
    expect(sim.pickups.live).toHaveLength(1);
  });
  it('uses 3D accepted feet, room ownership and LOS; cannot pull through a wall or from another terrace', () => {
    const sim = makeSim(['##########', '#000#0000#', '#000#0000#', '#000#0000#', '#00000000#', '##########'], ['fallen'], { noWaves: true });
    const p = sim.players[0]; put(sim, p, 3.5, 2.5);
    const drop = sim.pickups.drop(COIN, 0, 5.5, 2.5, 0)!;
    expect(sim.pickups.eligible(drop, p, 4)).toBe(false);
    for (let i = 0; i < 5; i++) sim.step(); expect(drop.x).toBe(5.5);
    put(sim, p, 5.5, 2.5); p.z = 5;
    expect(sim.pickups.eligible(drop, p, 4)).toBe(false);
    expect(sim.pickups.eligible({ ...drop, room: 1 }, { ...p, z: 0 }, 4)).toBe(false);
  });
  it('keeps structural reservation, merges overflow coins without refreshing lifetime, and bounds pending drops', () => {
    const sim = makeSim(room(20, 20), ['fallen'], { noWaves: true });
    const pool = new Pickups(sim.map);
    for (let i = 0; i < 128; i++) pool.drop(COIN, 0, 5, 5, 0);
    const merged = pool.drop(COIN, 0, 6, 5, 200)!;
    expect(pool.live).toHaveLength(128); expect(merged.value).toBe(6); expect(merged.expiresTick).toBe(600);
    pool.drop(COIN, 0, 15, 15, 200); expect(pool.forfeitedCoins).toBe(3);
    for (let i = 0; i < 32; i++) pool.drop(11, 0, 5, 5, 0);
    expect(pool.live).toHaveLength(160);
    for (let i = 0; i < 33; i++) pool.drop(HEAL_MOTE, 0, 5, 5, 10);
    expect(pool.pending).toHaveLength(32); expect(pool.discardedDrops).toBe(1);
    pool.update(610, [], () => false);
    expect(pool.pending).toHaveLength(0); expect(pool.live).toHaveLength(32);
    const item = pool.drop(ITEM_FIRST + 1, 0, 5, 5, 610)!;
    expect(item.id).toBeGreaterThan(192); expect(item.expiresTick).toBe(-1);
    pool.update(6000, [], () => false); expect(pool.live).toContain(item);
  });
  it('promotes pending drops on a freed slot with the original ID and deadline', () => {
    const sim = makeSim(room(20, 20), ['fallen'], { noWaves: true }); const pool = new Pickups(sim.map);
    for (let i = 0; i < 128; i++) pool.drop(COIN, 0, 5, 5, 0);
    pool.drop(HEAL_MOTE, 0, 5, 5, 100); const queued = pool.pending[0];
    pool.live.pop(); pool.update(200, [], () => false);
    expect(pool.pending).toHaveLength(0); expect(pool.live.at(-1)).toBe(queued); expect(queued.expiresTick).toBe(700);
  });
  it('does not merge into an expired coin or exceed 99 halos, and refuses exhausted IDs without wrapping', () => {
    const sim = makeSim(room(20, 20), ['fallen'], { noWaves: true }); const pool = new Pickups(sim.map);
    for (let i = 0; i < 128; i++) pool.drop(COIN, 0, 5, 5, 0, 99);
    expect(pool.drop(COIN, 0, 5, 5, 500)).toBeNull(); expect(pool.forfeitedCoins).toBe(3);
    const fresh = pool.drop(COIN, 0, 5, 5, 600)!;
    expect(pool.live).toHaveLength(1); expect(fresh.value).toBe(3); expect(fresh.expiresTick).toBe(1200);
    (pool as unknown as { nextId: number }).nextId = 0xffffffff;
    expect(pool.drop(HEAL_MOTE, 0, 5, 5, 600)!.id).toBe(0xffffffff);
    expect(pool.drop(HEAL_MOTE, 0, 5, 5, 600)).toBeNull(); expect(pool.exhausted).toBe(true);
  });
  it('only accepted damage deaths settle ordinary ledger and capped mote rewards', () => {
    const sim = makeSim(room(20, 20), ['fallen'], { noWaves: true });
    sim.map.rooms[0].shape = '1x1'; sim.haloLedgers.set(0, new HaloLedger(12, 4)); sim.random = () => 0;
    put(sim, sim.players[0], 18, 18);
    for (let i = 0; i < 4; i++) {
      const s = sim.placeEnemy(BLESSED, 5, 5, 0); sim.eWave[s] = 0;
      sim.damageEnemy(s, 100, -1); sim.damageEnemy(s, 100, -1);
    }
    expect(sim.pickups.live.filter((p) => p.kind === COIN)).toHaveLength(12);
    expect(sim.pickups.live.filter((p) => p.kind === COIN).reduce((sum, p) => sum + p.value, 0)).toBe(12);
    expect(sim.players[0].kills).toBe(0);
    for (let i = 0; i < 6; i++) sim.damageEnemy(sim.placeEnemy(CHORISTER, 5, 5, 0), 100, -1);
    expect(sim.pickups.live.filter((p) => p.kind === HEAL_MOTE)).toHaveLength(4);
    const cleanup = sim.placeEnemy(CHORISTER, 5, 5, 0); sim.removeEnemy(cleanup);
    expect(sim.pickups.live.filter((p) => p.kind === HEAL_MOTE)).toHaveLength(4);
  });
  it('Balm stores at full HP and automatic uses share the one-second cooldown with all items', () => {
    const sim = makeSim(room(20, 20), ['heretic'], { noWaves: true }); const p = sim.players[0]; put(sim, p, 5, 5);
    sim.pickups.drop(ITEM_FIRST, 0, 5, 5, 0); sim.step(); expect(p.inventory[0]).toEqual({ item: 'balm', count: 1 });
    p.hp = 10; sim.pickups.drop(ITEM_FIRST, 0, 5, 5, sim.tick); sim.step();
    expect(p.hp).toBe(50); expect(sim.pickups.live).toHaveLength(0);
    sim.pickups.drop(ITEM_FIRST + 1, 0, 5, 5, sim.tick);
    for (let i = 0; i < 30; i++) sim.step(); expect(p.hp).toBe(50); expect(p.inventory[1]).toEqual({ item: 'seal', count: 1 });
  });
});
