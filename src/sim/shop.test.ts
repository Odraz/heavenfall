import { describe, expect, it } from 'vitest';
import { buyItem } from './shop';
import { ScopedRequests } from '../net/requests';
import { ITEMS, type Inventory } from '../data/items';
import { generateFloor } from '../gen';
import { PEARLY_POOL } from '../data/rooms/1';
import { PINNED } from '../gen/pinned';
import { Simulation } from './sim';
import { HaloLedger, haloBudget } from './economy';
import { BLESSED } from '../data/enemies';

describe('R3 shop transactions', () => {
  it('cannot charge a full inventory or sold stock, stacks matching slots first, and retries never charge again', () => {
    const p = { wallet: 1000, inventory: [{ item: 'balm', count: 3 }, { item: 'seal', count: 2 }] as Inventory, sold: 0 };
    expect(buyItem(p, ['feather'], 0).accepted).toBe(false); expect(p.wallet).toBe(1000);
    p.inventory[1] = { item: 'balm', count: 1 };
    const requests = new ScopedRequests();
    const result = requests.execute(1, 'shop:0', () => buyItem(p, ['balm'], 0));
    expect(requests.execute(1, 'shop:0', () => { throw Error('reapplied'); })).toBe(result);
    expect(requests.execute(1, 'shop:1', () => { throw Error('wrong scope'); })).toBeNull();
    expect(p.inventory[1]?.count).toBe(2); expect(p.wallet).toBe(1000 - ITEMS.balm.price);
    expect(buyItem(p, ['balm'], 0).accepted).toBe(false);
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
    sim.interact(0, 1, 0); expect(a.sold).toBe(0); expect(a.wallet).toBe(1000);
    const stand = (index: number) => {
      const [x, y] = g.def.rooms[g.floor.pardoner].points!.pedestals![index];
      Object.assign(a, { x: x + .5, y: y + 1.5, z: g.map.floor[y * g.map.w + x], yaw: -Math.PI / 2, pitch: Math.atan2(-.6, 1) });
    };
    stand(0); sim.interact(0, 2, 0); sim.interact(0, 2, 0);
    expect(a.sold).toBe(1); expect(b.sold).toBe(0); expect(a.wallet).toBe(1000 - ITEMS[g.floor.stock[0]].price);
    stand(4); const wallet = a.wallet; sim.interact(0, 3, 4); sim.interact(0, 4, 4);
    expect(a.wallet).toBe(wallet - 120); expect(sim.chartRevealed).toBe(true);
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
      sim.haloLedgers.set(i, new HaloLedger(budget, 100));
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
