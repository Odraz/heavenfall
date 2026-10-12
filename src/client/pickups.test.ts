import { expect, it } from 'vitest';
import { PickupProjection } from './pickups';
import { Simulation } from '../sim/sim';
import { loadRunMap } from '../sim/runMap';
import { PINNED } from '../gen/pinned';
import { decodeSnapshot } from '../net/protocol';

it('restores pickup deadlines atomically and ignores pre-checkpoint metadata without removing future drops', () => {
  const { map, def } = loadRunMap({ heaven: 1, floor: 1, seed: PINNED.seed, fixture: null });
  const sim = new Simulation({ dungeon: def, map, seed: 1, players: [{ id: 0, name: 'P', classId: 'fallen' }] });
  const model = new PickupProjection(sim.runId);
  const at = map.spawns[0]; sim.pickups.drop(0, 0, at[0] + 0.5, at[1] + 0.5, 0);
  const sync = sim.floorSync(sim.runId);
  expect(model.sync(sync)).toBe(true); expect(model.records.get(1)?.pickup.expiresTick).toBe(600);
  expect(model.sync({ ...sync, pickups: [...sync.pickups!, ...sync.pickups!] })).toBe(false);
  expect(model.records.size).toBe(1);
  model.state({ ...sync.pickups![0], value: 99 }, 0, sync.revision); expect(model.records.get(1)?.pickup.value).toBe(3);
  model.state({ ...sync.pickups![0], id: 2 }, 10, sync.revision + 1);
  model.snapshot(decodeSnapshot(sim.encodeFor(0)[0])!); expect(model.records.has(2)).toBe(true);
  sim.pickups.live.length = 0; sim.tick = 11;
  model.snapshot(decodeSnapshot(sim.encodeFor(0)[0])!); expect(model.records.size).toBe(0);
  expect(model.sync({ ...sync, runId: 'f'.repeat(32) })).toBe(false);
});
