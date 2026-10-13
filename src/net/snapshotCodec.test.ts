import { expect, it } from 'vitest';
import { packSnapshot, unpackSnapshot, SnapshotSender, SnapshotReceiver } from './snapshotCodec';
import { decodeSnapshot, SnapshotAssembler } from './protocol';
import { Simulation } from '../sim/sim';
import { DUNGEONS } from '../data/dungeons';
import { DOMINION } from '../data/enemies';
import { mulberry32 } from '../sim/rng';

it('round-trips maximum moving crowds losslessly through the complete-tick assembler within the unchanged upload budget', async () => {
  const sim = new Simulation({ dungeon: DUNGEONS.sandbox, seed: 5, god: true, noWaves: true,
    players: ['fallen', 'heretic', 'binder', 'betrayer'].map((classId, id) => ({ id, classId: classId as 'fallen', name: `P${id}` })) });
  const rng = mulberry32(33);
  for (let i = 0; i < 1500; i++) {
    const slot = sim.placeEnemy(i < 3 ? DOMINION : i % 3, 10, 10, -1);
    sim.eX[slot] = 8 + rng() * 45; sim.eY[slot] = 5 + rng() * 40; sim.eZ[slot] = rng() * 6;
    sim.eState[slot] = i % 5;
    if (i < 3) { sim.eState[slot] = 2; sim.dominions.active.set(slot, { slot, incarnation: sim.eIncarnation[slot], castId: i + 1, room: 0, startTick: 0, impactTick: 45 }); }
  }
  for (let i = 0; i < 400; i++) { sim.projectiles.push(i); sim.pKind[i] = i % 3; sim.pX[i] = 8 + rng() * 45; sim.pY[i] = 5 + rng() * 40; sim.pZ[i] = rng() * 10; }
  for (let i = 0; i < 160; i++) sim.pickups.live.push({ id: i + 1, room: 0, kind: i < 128 ? i % 11 : 11 + i % 5, x: 8 + rng() * 45, y: 5 + rng() * 40, value: 3, expiresTick: 600 });
  const raw = sim.encodeFor(1); expect(raw).toHaveLength(2);
  const wire = await Promise.all(raw.map(packSnapshot));
  const wireBytes = wire.reduce((n, b) => n + b.byteLength, 0);
  console.log(JSON.stringify({ rawSnapshotBytes: raw.reduce((n, b) => n + b.byteLength, 0), wireSnapshotBytes: wireBytes, payloadHostKBpsAt10HzThreeRemotes: wireBytes * 10 * 3 / 1000 }));
  expect(wireBytes * 10 * 3 / 1000).toBeLessThanOrEqual(437);
  const a = new SnapshotAssembler(); a.reset(sim.runId); let complete = null;
  for (let i = wire.length - 1; i >= 0; i--) {
    expect(wire[i].byteLength).toBeLessThanOrEqual(16000);
    const out = await unpackSnapshot(wire[i]); expect(new Uint8Array(out!)).toEqual(new Uint8Array(raw[i]));
    complete = a.add(decodeSnapshot(out!)!);
  }
  expect(complete?.enemyCount).toBe(1500);
  expect(complete?.projectileCount).toBe(400); expect(complete?.pickupCount).toBe(160);
  expect(complete?.dominionCasts).toHaveLength(3);
});
it('rejects corrupt, oversize, truncated, false declared lengths and expansion beyond the packet bound', async () => {
  const raw = new Uint8Array(16000).fill(5).buffer, wire = await packSnapshot(raw);
  expect(wire.byteLength).toBeLessThan(raw.byteLength);
  for (const size of [0, 1023, 16001, 15999]) {
    const bad = wire.slice(0); new DataView(bad).setUint16(1, size, true); expect(await unpackSnapshot(bad)).toBeNull();
  }
  expect(await unpackSnapshot(wire.slice(0, -1))).toBeNull();
  const bad = wire.slice(0); new Uint8Array(bad)[4] ^= 64; expect(await unpackSnapshot(bad)).toBeNull();
  expect(await unpackSnapshot(new ArrayBuffer(16001))).toBeNull();
  expect(await unpackSnapshot(new ArrayBuffer(0))).toBeNull();
  const small = new Uint8Array(200).fill(5).buffer; expect(await packSnapshot(small)).toBe(small); expect(await unpackSnapshot(small)).toBe(small);
});
it('coalesces whole pending ticks, caps decoder waiting parts and suppresses work after close', async () => {
  const releases: Array<() => void> = [], sent: Array<readonly ArrayBuffer[]> = [];
  const sender = new SnapshotSender((parts) => sent.push(parts), async (b) => { await new Promise<void>((resolve) => releases.push(resolve)); return b; });
  const buffer = (id: number) => new Uint8Array([id]).buffer;
  sender.offer([buffer(1), buffer(2)]); sender.offer([buffer(3)]); sender.offer([buffer(4)]);
  releases.shift()!(); await new Promise((resolve) => setTimeout(resolve, 0)); releases.shift()!();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(sent.map((s) => s.map((b) => new Uint8Array(b)[0]))).toEqual([[1, 2]]);
  releases.shift()!(); await new Promise((resolve) => setTimeout(resolve, 0));
  expect(sent.map((s) => s.map((b) => new Uint8Array(b)[0]))).toEqual([[1, 2], [4]]);
  sender.offer([buffer(5)]); sender.close(); releases.shift()!(); await new Promise((resolve) => setTimeout(resolve, 0)); expect(sent).toHaveLength(2);
  const output: number[] = [], waits: Array<() => void> = [];
  const receiver = new SnapshotReceiver((b) => output.push(new Uint8Array(b)[0]), async (b) => { await new Promise<void>((r) => waits.push(r)); return b; });
  for (let i = 1; i <= 8; i++) receiver.offer(buffer(i));
  waits.shift()!(); await new Promise((resolve) => setTimeout(resolve, 0)); expect(output).toEqual([1]);
  waits.shift()!(); await new Promise((resolve) => setTimeout(resolve, 0)); expect(output).toEqual([1, 5]);
  receiver.close(); waits.shift()!(); await new Promise((resolve) => setTimeout(resolve, 0)); expect(output).toEqual([1, 5]);
});
