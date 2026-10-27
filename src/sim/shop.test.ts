import { describe, expect, it } from 'vitest';
import { CHART_PRICE, buyItem } from './shop';
import { ScopedRequests } from '../net/requests';
import { BALM_HEAL_FRACTION, CHAIN_BIND_SECONDS, FEATHER_SPEED, ITEMS, PLUME_DAMAGE, SEAL_SHIELD, VENOM_DAMAGE, type Inventory } from '../data/items';
import { generateFloor } from '../gen';
import { PEARLY_POOL } from '../data/rooms/1';
import { PINNED } from '../gen/pinned';
import { Simulation } from './sim';
import { HaloLedger, haloBudget } from './economy';
import { BLESSED } from '../data/enemies';
import { sealNow } from './testutil/sims';
import { GOLD_HALO, REWARD_GOLD_VALUE } from '../data/pickups';

describe('R3 shop transactions', () => {
  it('keeps Rite-page entitlements personal across reconnect and gives no reward to a later arrival', () => {
    const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL), room = g.floor.rewards.findIndex(r => r.kind === 'rite');
    g.def.rooms[room].waves = [];
    const sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 1, startRoom: room, god: true,
      players: [{ id: 0, name: 'A', classId: 'fallen' }, { id: 1, name: 'B', classId: 'heretic' }] });
    sim.step(); sealNow(sim, room);
    const page = sim.pickups.live.find(p => p.kind === 15)!; expect(page).toBeDefined();
    const touch = (id: number) => {
      Object.assign(sim.playerById(id)!, { x: page.x, y: page.y, z: sim.pickups.floor(page.x, page.y) }); sim.step();
    };
    sim.removePlayer(1, true); sim.addPlayer({ id: 2, name: 'Late', classId: 'binder' }); touch(2);
    // R5: every class has trees, so the page opens one personal Rite offer instead of paying halos.
    expect(sim.playerById(2)!.wallet).toBe(0); expect(sim.rites.hasPending(sim.playerById(2)!)).toBe(false);
    touch(0); touch(0); expect(sim.rites.hasPending(sim.playerById(0)!)).toBe(true); expect(sim.playerById(0)!.wallet).toBe(0);
    expect(sim.pickups.live.some(p => p.id === page.id)).toBe(true);
    sim.addPlayer({ id: 1, name: 'B', classId: 'heretic' }); touch(1);
    expect(sim.rites.hasPending(sim.playerById(1)!)).toBe(true); expect(sim.pickups.live.some(p => p.id === page.id)).toBe(false);
  });
  it('a gold clear reward is worth a quarter room budget, credited to every human (audit batch 4)', () => {
    // The pinned floor rolls no gold, so its route Rite room pays gold here.
    const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL), room = g.floor.rewards.findIndex(r => r.kind === 'rite');
    g.floor.rewards[room] = { kind: 'gold' }; g.def.rooms[room].waves = [];
    const sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 1, startRoom: room, god: true,
      players: [{ id: 0, name: 'A', classId: 'fallen' }, { id: 1, name: 'B', classId: 'heretic' }] });
    sim.step(); sealNow(sim, room);
    const gold = sim.pickups.live.find(p => p.kind === GOLD_HALO)!;
    expect(gold.value).toBe(REWARD_GOLD_VALUE);
    Object.assign(sim.players[0], { x: gold.x, y: gold.y, z: sim.pickups.floor(gold.x, gold.y) }); sim.step();
    expect(sim.players.map(p => p.wallet)).toEqual([24, 24]);
  });
  it('credits halos collected while a human is away to reconnect, as a late joiner gets them (R9 review P1)', () => {
    const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL), room = g.floor.rewards.findIndex(r => r.kind === 'rite');
    g.floor.rewards[room] = { kind: 'gold' }; g.def.rooms[room].waves = [];
    const sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 1, startRoom: room, god: true,
      players: [{ id: 0, name: 'A', classId: 'fallen' }, { id: 1, name: 'B', classId: 'heretic' }] });
    sim.step(); sealNow(sim, room);
    sim.playerById(1)!.wallet = 5; sim.removePlayer(1, true);
    const gold = sim.pickups.live.find(p => p.kind === GOLD_HALO)!;
    Object.assign(sim.players[0], { x: gold.x, y: gold.y, z: sim.pickups.floor(gold.x, gold.y) }); sim.step();
    expect(sim.players[0].wallet).toBe(24);
    const back = sim.addPlayer({ id: 1, name: 'B', classId: 'heretic' })!;
    expect(back.wallet).toBe(5 + 24);
    const late = sim.addPlayer({ id: 2, name: 'Late', classId: 'binder' })!;
    expect(late.wallet).toBe(sim.rewards.halosCredited);
  });
  it('free Chart contact reveals the party without spending a slot or wallet', () => {
    const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
    const sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 1, startRoom: 0,
      players: [{ id: 0, name: 'A', classId: 'fallen' }] });
    const p = sim.players[0]; p.wallet = 10; p.inventory = [{ item: 'balm', count: 3 }, { item: 'seal', count: 2 }];
    const before = structuredClone(p.inventory);
    sim.pickups.drop(13, 0, p.x, p.y, 0); sim.step();
    expect(sim.rewards.chartRevealed).toBe(true); expect(p.wallet).toBe(10); expect(p.inventory).toEqual(before);
    expect(sim.pickups.live.some(p => p.kind === 13)).toBe(false);
  });
  it('cannot charge a full inventory, stacks matching slots first, and retries never charge again', () => {
    const p = { wallet: 1000, inventory: [{ item: 'balm', count: 3 }, { item: 'seal', count: 2 }] as Inventory };
    expect(buyItem(p, ['feather'], 0).accepted).toBe(false); expect(p.wallet).toBe(1000);
    p.inventory[1] = { item: 'balm', count: 1 };
    const requests = new ScopedRequests();
    const result = requests.execute(1, 'shop:0', () => buyItem(p, ['balm'], 0));
    expect(requests.execute(1, 'shop:0', () => { throw Error('reapplied'); })).toBe(result);
    expect(requests.execute(1, 'shop:1', () => { throw Error('wrong scope'); })).toBeNull();
    expect(p.inventory[1]?.count).toBe(2); expect(p.wallet).toBe(1000 - ITEMS.balm.price);
    // The pedestal never sells out (R06 follow-up §3): a new purchase fills the stack to its cap, then stops.
    expect(buyItem(p, ['balm'], 0).accepted).toBe(true); expect(p.inventory[1]?.count).toBe(3);
    expect(buyItem(p, ['balm'], 0)).toEqual({ accepted: false, reason: 'Inventory full' });
    expect(p.wallet).toBe(1000 - 2 * ITEMS.balm.price);
  });
  it('prices items at half the R03 prices; the Chart stays 120', () => {
    expect(Object.fromEntries(Object.entries(ITEMS).map(([id, d]) => [id, d.price]))).toEqual({ balm: 50, seal: 60, feather: 60, mirror: 90, venom: 80, frost: 70, chain: 80, plume: 90 });
    expect(CHART_PRICE).toBe(120);
  });
  it('keeps old replay IDs rejected after eviction and never wraps exhausted IDs', () => {
    const ids = new ScopedRequests<number>(); for (let i = 1; i <= 70; i++) ids.execute(i, 's', () => i);
    expect(ids.execute(1, 's', () => 99)).toBeNull();
    expect(ids.execute(0xffffffff, 's', () => 7)).toBe(7); expect(ids.execute(0, 's', () => 8)).toBeNull();
  });
  it('rechecks real geometry, keeps stock personal, and reveals the Chart only once', () => {
    const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
    const sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 1, startRoom: g.floor.pardoner,
      players: [{ id: 0, name: 'A', classId: 'fallen' }, { id: 1, name: 'B', classId: 'heretic' }] });
    const [a, b] = sim.players; a.wallet = b.wallet = 1000;
    sim.interact(0, 1, 0); expect(a.wallet).toBe(1000);
    const stand = (index: number) => {
      const [x, y] = g.def.rooms[g.floor.pardoner].points!.pedestals![index];
      Object.assign(a, { x: x + .5, y: y + 1.5, z: g.map.floor[y * g.map.w + x], yaw: -Math.PI / 2, pitch: Math.atan2(-.6, 1) });
    };
    stand(0); sim.interact(0, 2, 0); sim.interact(0, 2, 0);
    const price = ITEMS[g.floor.stock[0]].price;
    expect(a.wallet).toBe(1000 - price); expect(b.wallet).toBe(1000);
    // A new request buys the same pedestal again; the replayed one above charged once.
    sim.interact(0, 3, 0); expect(a.wallet).toBe(1000 - 2 * price);
    stand(4); const wallet = a.wallet; sim.interact(0, 4, 4); sim.interact(0, 5, 4);
    expect(a.wallet).toBe(wallet - 120); expect(sim.rewards.chartRevealed).toBe(true);
    expect(sim.rooms.every(r => r.knowledge > 0)).toBe(true);
  });
  it('measures collected pinned-room income through world deaths and contacts without bypassing wallets', () => {
    const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
    const sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 1, startRoom: 0, god: true,
      players: [{ id: 0, name: 'Collector', classId: 'fallen' }] });
    const p = sim.players[0]; sim.random = () => .99; let expected = 0;
    for (const [i, room] of g.def.rooms.entries()) {
      if (room.kind !== 'combat') continue;
      const budget = haloBudget(room.shape!, room.band!); expected += budget;
      sim.rewards.haloLedgers.set(i, new HaloLedger(budget, 100));
      const [x, y] = room.points!.reward!; Object.assign(p, { x: x + .5, y: y + .5, z: g.map.floor[y * g.map.w + x] });
      for (let n = 0; n < 100; n++) {
        const s = sim.placeEnemy(BLESSED, x, y, i); sim.eWave[s] = 0;
        sim.damageEnemy(s, 1000, -1); sim.step();
      }
    }
    expect(p.wallet).toBe(expected); expect(expected).toBeGreaterThan(300);
    console.info(`R03 pinned all-room currency collected: ${p.wallet}; Chart + Balm + Ash: 360; drop rate 100% in controlled contact fixture.`);
  });
});

describe('the pedestal labels describe what the items do (R8)', () => {
  it('states each item rule with the numbers the simulation uses', () => {
    const secs = (ticks: number) => `${ticks / 30} seconds`;
    expect(ITEMS.balm.rule).toContain(`${BALM_HEAL_FRACTION * 100}% of your max HP`);
    expect(ITEMS.seal.rule).toContain(`${SEAL_SHIELD} shield for ${secs(ITEMS.seal.duration)}`);
    expect(ITEMS.feather.rule).toContain(`${FEATHER_SPEED} m/s faster for ${secs(ITEMS.feather.duration)}`);
    expect(ITEMS.mirror.rule).toContain(`${ITEMS.mirror.radius} m dome for ${secs(ITEMS.mirror.duration)}`);
    expect(ITEMS.venom.rule).toContain(`${ITEMS.venom.radius} m pool: ${VENOM_DAMAGE} damage every half second`);
    expect(ITEMS.frost.rule).toContain(`${ITEMS.frost.radius} m circle for ${secs(ITEMS.frost.duration)}`);
    expect(ITEMS.chain.rule).toContain(`${CHAIN_BIND_SECONDS} seconds in a ${ITEMS.chain.radius} m circle`);
    expect(ITEMS.plume.rule).toContain(`${ITEMS.plume.radius} m circle for ${PLUME_DAMAGE} damage`);
  });
});
