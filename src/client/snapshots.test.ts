import { expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons';
import { decodeSnapshot } from '../net/protocol';
import { Simulation } from '../sim/sim';
import { SnapshotBuffer } from './snapshots';

it('isolates complete snapshots and interpolation history across runs, including lower ticks after reset', () => {
  const id = '0'.repeat(32), next = '1'.repeat(32);
  const sim = new Simulation({ dungeon: DUNGEONS.sandbox, runId: id, seed: 1, players: [{ id: 0, name: 'P', classId: 'fallen' }] });
  const buffer = new SnapshotBuffer(1.5, id);
  let calls = 0; buffer.onComplete = () => calls++;
  sim.tick = 90;
  const old = sim.encodeFor(0)[0];
  buffer.addPart(old, 1000); expect(buffer.newest?.tick).toBe(90);
  expect(buffer.interpolate(1050).count).toBe(0); expect(buffer.playersOut).toHaveLength(1);
  buffer.reset(next);
  expect(buffer.newest).toBeNull(); expect(buffer.enemyCountsByTick.size).toBe(0); expect(buffer.playersOut).toEqual([]);
  buffer.addPart(old, 1100); expect(buffer.newest).toBeNull(); expect(calls).toBe(1);
  const fresh = new Simulation({ dungeon: DUNGEONS.sandbox, runId: next, seed: 2, players: [{ id: 0, name: 'P', classId: 'binder' }] });
  const buf = fresh.encodeFor(0)[0];
  buffer.addPart(buf, 1200); expect(buffer.newest).toEqual(decodeSnapshot(buf)); expect(calls).toBe(2);
  buffer.addPart(old, 1300); expect(buffer.newest?.tick).toBe(0); expect(calls).toBe(2);
});
