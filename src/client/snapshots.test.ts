import { describe, expect, it } from 'vitest';
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

describe('the snapshot clock (netcode stage)', () => {
  const id = '0'.repeat(32);
  const sim = new Simulation({ dungeon: DUNGEONS.sandbox, runId: id, seed: 1, players: [{ id: 0, name: 'P', classId: 'fallen' }] });
  /** Snapshot ticks 3, 6, 9, … at 10 Hz from `t0` ms, each arriving `late(i)` ms late. */
  function feed(buffer: SnapshotBuffer, n: number, late: (i: number) => number, t0 = 1000): number[] {
    const at: number[] = [];
    for (let i = 1; i <= n; i++) {
      sim.tick = i * 3;
      const t = t0 + i * 100 + late(i);
      buffer.addPart(sim.encodeFor(0)[0], t);
      at.push(t);
    }
    return at;
  }

  it('starts at the first snapshot and runs at 30 ticks per second on a steady connection', () => {
    const b = new SnapshotBuffer(4.5, id);
    feed(b, 1, () => 0);
    expect(b.estimatedTick(1100)).toBe(3);
    expect(b.estimatedTick(1200)).toBeCloseTo(6, 6);
    feed(b, 20, () => 0);
    // Tick 60 arrived at 3 000 ms.
    expect(b.estimatedTick(3100)).toBeCloseTo(63, 6);
    expect(b.jitterTicks).toBe(0);
    expect(b.delayTicks).toBe(4.5);
  });

  it('never runs backwards when a late snapshot arrives, and stays near the average', () => {
    const b = new SnapshotBuffer(4.5, id);
    // Every third snapshot arrives 60 ms late, the others on time.
    const lateOf = (i: number) => (i % 3 === 0 ? 60 : 0);
    let last = -Infinity, next = 1;
    // Frames every 16 ms; each snapshot is added on the first frame after it arrived.
    for (let now = 1100; now < 1000 + 61 * 100; now += 16) {
      while (1000 + next * 100 + lateOf(next) <= now) {
        sim.tick = next * 3;
        b.addPart(sim.encodeFor(0)[0], now);
        next++;
      }
      const e = b.estimatedTick(now);
      expect(e).toBeGreaterThanOrEqual(last);
      last = e;
    }
    // The average arrival is 20 ms late: the clock sits between the on-time and the late sample.
    const now = 1000 + 61 * 100;
    expect(b.estimatedTick(now)).toBeGreaterThan(61 * 3 - 2.5);
    expect(b.estimatedTick(now)).toBeLessThan(61 * 3 + 0.5);
  });

  it('adds render delay for a jittery connection, up to 3 ticks, and none for a steady one', () => {
    const steady = new SnapshotBuffer(4.5, id);
    feed(steady, 100, (i) => (i % 2 ? 2 : -2));
    expect(steady.delayTicks).toBeCloseTo(4.5, 1);
    const jittery = new SnapshotBuffer(4.5, id);
    feed(jittery, 200, (i) => [0, 90, 20, 60, 0, 120][i % 6]);
    expect(jittery.delayTicks).toBeGreaterThan(5.5);
    expect(jittery.delayTicks).toBeLessThanOrEqual(4.5 + 3);
  });

  it('takes a large jump (a stalled host) at once, and a pause shifts the clock with the arrivals', () => {
    const b = new SnapshotBuffer(4.5, id);
    feed(b, 10, () => 0);
    // The host stalls for 2 s: the next snapshot is 60 ticks ahead of the clock's samples.
    sim.tick = 31 * 3;
    b.addPart(sim.encodeFor(0)[0], 1000 + 11 * 100);
    expect(b.estimatedTick(1000 + 11 * 100)).toBe(93);
    b.shiftArrivals(500);
    expect(b.estimatedTick(1000 + 11 * 100 + 500)).toBeCloseTo(93, 6);
  });

  it('records the view it drew: the snapshot at or before the render tick, the gap to the next and the fraction', () => {
    const b = new SnapshotBuffer(4.5, id);
    feed(b, 10, () => 0);
    // At 2 000 ms the clock is at tick 30, the render tick at 25.5: between snapshots 24 and 27.
    b.interpolate(2000);
    expect(b.view.tick).toBe(24);
    expect(b.view.gap).toBe(3);
    expect(b.view.frac).toBeCloseTo(0.5, 6);
    b.reset(id);
    expect(b.view.tick).toBe(-1);
  });
});
