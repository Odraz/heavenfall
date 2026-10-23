import { INPUT_DEFAULTS } from '../sim/testutil/sims';
import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons/index';

const sandbox = DUNGEONS.sandbox;
import { BLESSED, CANTOR, CARRIER, DOMINION, WATCHMAN } from '../data/enemies';
import type { WatchmanAim } from '../data/watchman';
import { WATCHMAN_BYTES } from './watchmanCodec';
import type { CommanderCast } from '../data/commanders';
import { COMMANDER_BYTES } from './commanderCodec';
import { FIRE_LEFT, FIRE_RIGHT, FIRE_RIGHT_LAST } from '../data/weapons';
import { Simulation } from '../sim/sim';
import type { GameEvent } from './messages';
import { PROTOCOL_VERSION } from './version';
import {
  decodeInput,
  decodeSnapshot,
  encodeInput,
  encodeSnapshot,
  FLAG_HURT,
  FLAG_ROOTED,
  FLAG_SILENCED,
  FLAG_SLOWED,
  FLAG_STUNNED,
  FLAG_TAUNTED,
  HEADER_BYTES,
  PLAYER_BYTES,
  ENEMY_BYTES,
  PROJECTILE_BYTES,
  PICKUP_BYTES,
  INPUT_BYTES,
  MAX_SNAPSHOT_BYTES,
  SnapshotAssembler,
  type InputMsg,
  type SnapshotEntities,
  type SnapshotHeader,
  type SnapshotPlayer,
} from './protocol';

const header: SnapshotHeader = {
  runId: '0123456789abcdef0011223344556677',
  stateRevision: 0x12345678,
  tick: 123456,
  activeRoom: 2,
  activePhase: 3,
  clearedMask: 0x8001_0003,
  countdown: 473,
  hold: 0x8c,
  enemiesRemaining: 777,
  bossHp: 31234,
  bossMaxHp: 40000,
  bossCast: 2,
  bossCastProgress: 200,
  // The Gatekeeper's encounter (protocol 21): a signed cycle start may precede tick 0 after an early transition.
  bossPhase: 2 | 128,
  bossBreak: 77,
  bossFlags: 3,
  bossCycleStart: -390,
  tollTick: 123400,
  heldPlayer: 2,
  callTarget: 255,
  heldUntil: 123500,
  heldSince: 123320,
  bossTransitionUntil: 123460,
};

function players(n: number): SnapshotPlayer[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    x: 10.25 + i,
    y: 20.5,
    z: 2.75,
    yaw: -1.25,
    hp: 150 - i,
    shield: i * 10,
    dead: i === 2,
    cdQ: 4000,
    cdE: 250,
    kills: 42 + i,
    revive: i * 60,
    // Wrapping: 255 + 2 shots read back as 1.
    shots: (250 + i * 3) & 0xff,
    shots2: (100 + i * 50) & 0xff,
    // Player 1 is being healed by player 2's Sacrament (M9 §10).
    beam: i === 2 ? 1 : 255,
    shotsDone: (7 + i * 100) & 0xff,
    wallet: i * 999, carrySlot: -1, teleportId: 0,
  }));
}

function entities(ne: number, np: number, nk = 0): SnapshotEntities {
  const e: SnapshotEntities = {
    enemyCount: ne,
    enemySlot: new Uint16Array(ne),
    enemyX: new Float32Array(ne),
    enemyY: new Float32Array(ne),
    enemyTypeState: new Uint8Array(ne),
    enemyFlags: new Uint8Array(ne),
    enemyZ: new Float32Array(ne),
    enemyIncarnation: new Uint32Array(ne),
    enemyHp: new Float32Array(ne),
    projectileCount: np,
    projSlot: new Uint16Array(np),
    projKind: new Uint8Array(np),
    projOwner: new Uint8Array(np),
    projX: new Float32Array(np),
    projY: new Float32Array(np),
    projZ: new Float32Array(np),
    pickupCount: nk,
    pickupId: Uint32Array.from({ length: nk }, (_, i) => 65536 + i),
    pickupX: new Float32Array(nk).fill(12.5),
    pickupY: new Float32Array(nk).fill(23.25),
    pickupKind: Uint8Array.from({ length: nk }, (_, i) => i % 16),
  };
  for (let i = 0; i < ne; i++) {
    e.enemySlot[i] = i * 2;
    e.enemyX[i] = (i % 200) + 0.5;
    e.enemyY[i] = 3.125 + (i % 7);
    e.enemyTypeState[i] = (i % 4) | ((i % 5) << 4);
    e.enemyFlags[i] = i % 64;
    e.enemyZ[i] = i / 64;
    e.enemyIncarnation[i] = 70000 + i;
    e.enemyHp[i] = i * 1.25 + 0.1;
  }
  for (let i = 0; i < np; i++) {
    e.projSlot[i] = i;
    e.projKind[i] = i % 3;
    e.projOwner[i] = i % 2 ? 3 : 255;
    e.projX[i] = 5 + i / 64;
    e.projY[i] = 6;
    e.projZ[i] = 15.984375;
  }
  return e;
}

describe('input protocol', () => {
  it('round-trips', () => {
    const m: InputMsg = { ...INPUT_DEFAULTS, runId: header.runId, item1Presses: 255, item2Presses: 3,
      mapHeld: true, qHeld: true, eHeld: true, seq: 4000000000, x: 12.5, y: 7.25, z: 1.5, yaw: 3.0, pitch: -0.5,
      fire: 1, qPresses: 255, ePresses: 3, allyTargetId: 255, lastTeleportId: 65535 };
    const buf = encodeInput(m);
    expect(buf.byteLength).toBe(INPUT_BYTES);
    const d = decodeInput(buf, m.runId)!;
    expect(d.seq).toBe(m.seq);
    expect(d.x).toBe(12.5);
    expect(d.yaw).toBeCloseTo(3.0, 6);
    expect(d.pitch).toBeCloseTo(-0.5, 6);
    expect(d).toEqual(m);
    expect(Array.from(new Uint8Array(buf, 30, 16))).toEqual([1, 35, 69, 103, 137, 171, 205, 239, 0, 17, 34, 51, 68, 85, 102, 119]);
    expect(Array.from(new Uint8Array(buf, 46, 3))).toEqual([255, 3, 7]);
    // No view yet: the tick is all ones.
    expect(Array.from(new Uint8Array(buf, 51, 4))).toEqual([255, 255, 255, 255]);
    // Mouse press counters wrap; the view tick, gap and fraction round-trip (frac to 1/255).
    const v = decodeInput(encodeInput({ ...m, leftPresses: 257, rightPresses: 255, viewTick: 123456, viewGap: 3, viewFrac: 0.5 }), m.runId)!;
    expect(v).toMatchObject({ leftPresses: 1, rightPresses: 255, viewTick: 123456, viewGap: 3 });
    expect(v.viewFrac).toBeCloseTo(0.5, 2);
    expect(decodeInput(encodeInput({ ...m, viewTick: 0, viewGap: 999, viewFrac: 7 }), m.runId)).toMatchObject({ viewTick: 0, viewGap: 255, viewFrac: 1 });
    // Counters wrap.
    expect(decodeInput(encodeInput({ ...m, qPresses: 256, item1Presses: 256 }), m.runId)).toMatchObject({ qPresses: 0, item1Presses: 0 });
    // Client-timed shots: the wrapping shot counter and the latest shot's button; any other button is refused.
    expect(decodeInput(encodeInput({ ...m, shots: 258, shotButton: 1 }), m.runId)).toMatchObject({ shots: 2, shotButton: 1 });
    expect(decodeInput(encodeInput({ ...m, shotButton: 255 }), m.runId)).toMatchObject({ shotButton: 255 });
    expect(decodeInput(encodeInput({ ...m, shotButton: 2 }), m.runId)).toBeNull();
    // The latest shot's aim and view, repeated by every input (netcode stage 4); a non-finite aim is refused.
    const aim = decodeInput(encodeInput({ ...m, shotYaw: 1.25, shotPitch: -0.25, shotViewTick: 4321, shotViewGap: 3, shotViewFrac: 0.5 }), m.runId)!;
    expect(aim).toMatchObject({ shotYaw: 1.25, shotPitch: -0.25, shotViewTick: 4321, shotViewGap: 3 });
    expect(aim.shotViewFrac).toBeCloseTo(0.5, 2);
    expect(decodeInput(encodeInput({ ...m, shotViewTick: -1 }), m.runId)!.shotViewTick).toBe(-1);
    expect(decodeInput(encodeInput({ ...m, shotYaw: NaN }), m.runId)).toBeNull();
    // The `fire` bits (M9 §10): left, right, right pressed last.
    for (const fire of [0, FIRE_LEFT, FIRE_RIGHT, FIRE_LEFT | FIRE_RIGHT, FIRE_LEFT | FIRE_RIGHT | FIRE_RIGHT_LAST]) {
      expect(decodeInput(encodeInput({ ...m, fire }), m.runId)!.fire).toBe(fire);
    }
    expect(buf.byteLength).toBe(73);
  });

  const valid: InputMsg = { ...INPUT_DEFAULTS, runId: header.runId, seq: 1, x: 4.5, y: 4.5, z: 0,
    yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 };

  it('rejects wrong lengths and another run', () => {
    for (const length of [0, 30, 49, 56, 58, 100]) expect(decodeInput(new ArrayBuffer(length), valid.runId)).toBeNull();
    expect(decodeInput(encodeInput(valid), 'f'.repeat(32))).toBeNull();
  });

  it('rejects non-finite values in every float and every reserved flags/fire bit', () => {
    for (const offset of [4, 8, 12, 16, 20]) for (const value of [NaN, Infinity, -Infinity]) {
      const buf = encodeInput(valid); new DataView(buf).setFloat32(offset, value, true);
      expect(decodeInput(buf, valid.runId)).toBeNull();
    }
    for (const offset of [24, 48]) for (const bit of [8, 16, 32, 64, 128]) {
      const buf = encodeInput(valid); new DataView(buf).setUint8(offset, bit);
      expect(decodeInput(buf, valid.runId)).toBeNull();
    }
  });

  it('ignores stale inputs on the host', () => {
    const sim = new Simulation({ dungeon: sandbox, players: [{ id: 0, name: 'A', classId: 'fallen' }], seed: 1 });
    const p = sim.players[0];
    const base = { z: 0, yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses: 0, allyTargetId: 255, ...INPUT_DEFAULTS, lastTeleportId: 0 };
    sim.applyInput(0, { ...base, seq: 5, x: 4.6, y: 4.5 }, 100);
    expect(p.x).toBeCloseTo(4.6);
    sim.applyInput(0, { ...base, seq: 4, x: 4.7, y: 4.5 }, 133);
    expect(p.x).toBeCloseTo(4.6);
    sim.applyInput(0, { ...base, seq: 5, x: 4.7, y: 4.5 }, 166);
    expect(p.x).toBeCloseTo(4.6);
    sim.applyInput(0, { ...base, seq: 6, x: 4.7, y: 4.5 }, 200);
    expect(p.x).toBeCloseTo(4.7);
  });

  it('limits reported movement to 1.2 × speed × elapsed + 0.5 m, and raises feet to the floor', () => {
    const sim = new Simulation({ dungeon: sandbox, players: [{ id: 0, name: 'A', classId: 'fallen' }], seed: 1 });
    const p = sim.players[0];
    p.lastAcceptMs = 1000;
    const base = { yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses: 0, allyTargetId: 255, ...INPUT_DEFAULTS, lastTeleportId: 0 };
    // 100 ms at the Fallen's 6 m/s (M9 §2.7): at most 1.2 × 0.6 + 0.5 = 1.22 m.
    sim.applyInput(0, { ...base, seq: 1, x: p.x + 5, y: p.y, z: -1 }, 1100);
    expect(p.x).toBeCloseTo(4.5 + 1.22, 5);
    expect(p.z).toBe(0);
  });
});

describe('snapshot protocol', () => {
  it('round-trips header, players, enemies and projectiles', () => {
    const parts = encodeSnapshot(header, players(4), entities(100, 20));
    expect(parts.length).toBe(1);
    expect(parts[0].byteLength).toBe(HEADER_BYTES + 4 * PLAYER_BYTES + 100 * ENEMY_BYTES + 20 * PROJECTILE_BYTES);
    const s = decodeSnapshot(parts[0])!;
    expect(HEADER_BYTES).toBe(96);
    // The Gatekeeper's encounter fields (protocol 21), the cycle start signed.
    expect([s.bossPhase, s.bossBreak, s.bossFlags, s.bossCycleStart, s.tollTick, s.heldPlayer, s.callTarget, s.heldUntil, s.heldSince, s.bossTransitionUntil])
      .toEqual([130, 77, 3, -390, 123400, 2, 255, 123500, 123320, 123460]);
    const v = new DataView(parts[0]);
    expect([v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3)]).toEqual([PROTOCOL_VERSION, 0, 1, 4]);
    expect(Array.from(new Uint8Array(parts[0], 4, 16))).toEqual(Array.from(new Uint8Array(encodeInput({
      ...INPUT_DEFAULTS, runId: header.runId, seq: 0, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fire: 0,
      qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0,
    }), 30, 16)));
    expect([v.getUint32(20, true), v.getUint32(24, true), v.getUint8(28), v.getUint8(29), v.getUint16(30, true), v.getUint8(32),
      v.getUint32(33, true), v.getUint16(37, true), v.getUint32(39, true), v.getUint32(43, true), v.getUint8(47), v.getUint8(48)])
      .toEqual([header.tick, header.stateRevision, 2, 3, 473, 0x8c, header.clearedMask, 777, 31234, 40000, 2, 200]);
    expect([49, 51, 53, 55, 57, 59].map((o) => v.getUint16(o, true))).toEqual([100, 20, 0, 100, 20, 0]);
    expect(s).toMatchObject({ ...header, partIndex: 0, partCount: 1, enemyCount: 100, projectileCount: 20 });
    expect(s.players).toEqual(players(4));
    expect(s.enemySlot[50]).toBe(100);
    expect(s.enemyX[50]).toBe(50.5);
    expect(s.enemyY[50]).toBe(3.125 + 1);
    expect(s.enemyType[50]).toBe(2);
    expect(s.enemyState[50]).toBe(0);
    expect(s.enemyFlags[50]).toBe(50);
    // HP rounded up (netcode stage 3): 62.6 reads 63.
    expect(s.enemyHp[50]).toBe(63);
    expect(s.enemyHp[0]).toBe(1);
    expect(s.projKind[5]).toBe(2);
    // Its owner's player ID (netcode stage 4); an even one is an enemy's.
    expect(s.projOwner[5]).toBe(3);
    expect(s.projOwner[4]).toBe(255);
    expect(s.projX[5]).toBe(5 + 5 / 64);
    expect(s.projZ[5]).toBe(15.984375);
  });

  it('sends whole HP, at least 0 and at most 65 535, and whole numbers exactly (netcode stage 3)', () => {
    const e = entities(4, 0);
    e.enemyHp.set([20, 0, -3, 1e6]);
    const s = decodeSnapshot(encodeSnapshot(header, players(1), e)[0])!;
    expect(Array.from(s.enemyHp)).toEqual([20, 0, 0, 65535]);
  });

  it('reserves the full pickup pool in part zero and fits all maximum entities in two parts', () => {
    const parts = encodeSnapshot(header, players(4), entities(1500, 400, 160));
    expect(parts.length).toBe(2);
    expect(parts.every((p) => p.byteLength <= MAX_SNAPSHOT_BYTES)).toBe(true);
    expect(parts.reduce((n, p) => n + p.byteLength, 0)).toBe(2 * (HEADER_BYTES + 4 * PLAYER_BYTES) + 1500 * ENEMY_BYTES + 400 * PROJECTILE_BYTES + 160 * PICKUP_BYTES);
    expect(decodeSnapshot(parts[0])!.pickupCount).toBe(160);
    expect(decodeSnapshot(parts[1])!.pickupCount).toBe(0);
    const a = new SnapshotAssembler(); a.reset(header.runId); a.add(decodeSnapshot(parts[1])!);
    const joined = a.add(decodeSnapshot(parts[0])!)!;
    expect(joined.pickupId[159]).toBe(65695); expect(joined.enemyZ[1499]).toBe(1499 / 64);
    expect(joined.enemyIncarnation[1499]).toBe(71499);
  });

  it('splits snapshots above 16 000 bytes into parts that each carry the header and all players', () => {
    const e = entities(1500, 400);
    const parts = encodeSnapshot(header, players(4), e);
    expect(parts.length).toBe(2);
    let enemies = 0;
    let projectiles = 0;
    parts.forEach((buf, i) => {
      expect(buf.byteLength).toBeLessThanOrEqual(MAX_SNAPSHOT_BYTES);
      const s = decodeSnapshot(buf)!;
      expect(s.partIndex).toBe(i);
      expect(s.partCount).toBe(2);
      expect(s.players).toEqual(players(4));
      expect(s.tick).toBe(header.tick);
      enemies += s.enemyCount;
      projectiles += s.projectileCount;
    });
    expect(enemies).toBe(1500);
    expect(projectiles).toBe(400);
    // The first part is as full as fits: (16 000 − 27 − 120) ÷ 8 enemies.
    expect(decodeSnapshot(parts[0])!.enemyCount).toBe(Math.floor((MAX_SNAPSHOT_BYTES - HEADER_BYTES - 4 * PLAYER_BYTES) / ENEMY_BYTES));
  });

  it('reassembles parts that arrive out of order', () => {
    const parts = encodeSnapshot(header, players(2), entities(1500, 400)).map((b) => decodeSnapshot(b)!);
    const a = new SnapshotAssembler();
    a.reset(header.runId);
    expect(a.add(parts[1])).toBeNull();
    const s = a.add(parts[0])!;
    expect(s).not.toBeNull();
    expect(s.enemyCount).toBe(1500);
    expect(s.projectileCount).toBe(400);
    for (let i = 0; i < 1500; i++) expect(s.enemySlot[i]).toBe(i * 2);
    expect(a.newestCompleteTick).toBe(header.tick);
  });

  it('ignores stale parts and drops older incomplete ticks', () => {
    const at = (tick: number) => encodeSnapshot({ ...header, tick }, players(1), entities(1500, 0)).map((b) => decodeSnapshot(b)!);
    const a = new SnapshotAssembler();
    a.reset(header.runId);
    const t10 = at(10);
    const t11 = at(11);
    const t12 = at(12);
    a.add(t11[0]); // tick 11 stays incomplete
    expect(a.add(t12[0])).toBeNull();
    expect(a.add(t12[1])).not.toBeNull();
    expect(a.pendingTicks).toBe(0);
    // Parts of ticks that aren't newer than the newest complete one are ignored.
    expect(a.add(t11[1])).toBeNull();
    expect(a.add(t10[0])).toBeNull();
    expect(a.add(t10[1])).toBeNull();
    expect(a.add(at(12)[0])).toBeNull();
    expect(a.newestCompleteTick).toBe(12);
  });

  it('rejects schema, truncation, extra bytes, wrong runs and impossible part/entity/pickup counts', () => {
    const buf = encodeSnapshot(header, players(1), entities(2, 1))[0];
    for (const length of [0, 32, 60, buf.byteLength - 1]) expect(decodeSnapshot(buf.slice(0, length))).toBeNull();
    const extra = new Uint8Array(buf.byteLength + 1); extra.set(new Uint8Array(buf));
    expect(decodeSnapshot(extra.buffer)).toBeNull();
    expect(decodeSnapshot(buf, 'f'.repeat(32))).toBeNull();
    for (const [offset, value] of [[0, 1], [1, 1], [2, 0], [3, 5], [49, 1], [51, 0], [53, 1], [59, 1]]) {
      const bad = buf.slice(0); new DataView(bad).setUint8(offset, value);
      expect(decodeSnapshot(bad), `offset ${offset}`).toBeNull();
    }
    for (const offset of [1, 5, 9, 13]) for (const value of [NaN, Infinity, -Infinity]) {
      const bad = buf.slice(0); new DataView(bad).setFloat32(HEADER_BYTES + offset, value, true);
      expect(decodeSnapshot(bad), `player float ${offset}`).toBeNull();
    }
  });

  it('drops another run before allocating pending ticks and resets both pending and watermark for a new run', () => {
    const a = new SnapshotAssembler(); a.reset(header.runId);
    const parts = encodeSnapshot(header, players(1), entities(1500, 0)).map((b) => decodeSnapshot(b)!);
    const foreign = { ...parts[0], runId: 'f'.repeat(32), tick: 0xffffffff };
    expect(a.add(foreign)).toBeNull(); expect(a.pendingTicks).toBe(0); expect(a.newestCompleteTick).toBe(-1);
    a.add(parts[0]); a.reset(foreign.runId);
    expect(a.pendingTicks).toBe(0); expect(a.add(parts[1])).toBeNull();
    const empty = decodeSnapshot(encodeSnapshot({ ...header, runId: foreign.runId, tick: 1 }, [], entities(0, 0))[0])!;
    expect(a.add(empty)?.tick).toBe(1);
    a.reset(header.runId); expect(a.newestCompleteTick).toBe(-1);
    expect(a.add(parts[1])).toBeNull(); expect(a.add(parts[0])?.enemyCount).toBe(1500);
  });

  it('permanently invalidates a tick with disagreeing sibling totals, part counts, headers or players', () => {
    const parts = encodeSnapshot(header, players(1), entities(1500, 400)).map((b) => decodeSnapshot(b)!);
    const variants = [
      { ...parts[1], totalEnemyCount: 1499 }, { ...parts[1], totalProjectileCount: 399 },
      { ...parts[1], totalPickupCount: 1 }, { ...parts[1], partCount: 3 },
      { ...parts[1], stateRevision: header.stateRevision + 1 },
      { ...parts[1], players: [{ ...parts[1].players[0], x: 99 }] },
    ];
    for (const bad of variants) {
      const a = new SnapshotAssembler(); a.reset(header.runId); a.add(parts[0]);
      expect(a.add(bad)).toBeNull(); expect(a.pendingTicks).toBe(0);
      expect(a.add(parts[1])).toBeNull(); expect(a.add(parts[0])).toBeNull(); expect(a.newestCompleteTick).toBe(-1);
      const next = decodeSnapshot(encodeSnapshot({ ...header, tick: header.tick + 1 }, [], entities(0, 0))[0])!;
      expect(a.add(next)?.tick).toBe(next.tick);
    }
  });

  it('requires assembled entity sums to match the repeated totals and rejects undersized encoder parts', () => {
    const parts = encodeSnapshot(header, players(1), entities(1500, 0)).map((b) => decodeSnapshot(b)!);
    const a = new SnapshotAssembler(); a.reset(header.runId); a.add(parts[0]);
    expect(a.add({ ...parts[1], enemyCount: parts[1].enemyCount - 1 })).toBeNull();
    expect(a.add(parts[1])).toBeNull();
    expect(() => encodeSnapshot(header, players(1), entities(1, 0), HEADER_BYTES + PLAYER_BYTES)).toThrow('snapshot part too small');
  });

  it('bounds incomplete ticks and expires them by local receipt time', () => {
    const a = new SnapshotAssembler(); a.reset(header.runId);
    const parts = (tick: number) => encodeSnapshot({ ...header, tick }, players(1), entities(1500, 0)).map((b) => decodeSnapshot(b)!);
    for (let tick = 1; tick <= 20; tick++) { a.add(parts(tick)[0], tick); expect(a.pendingTicks).toBeLessThanOrEqual(4); }
    expect(a.add(parts(20)[1], 520)).toBeNull(); // first part expired; no partial publish
    expect(a.pendingTicks).toBe(1);
    expect(a.add(parts(20)[0], 521)?.enemyCount).toBe(1500);
  });

  it('ignores identical duplicates but invalidates changed duplicates and overlapping ranges', () => {
    const parts = encodeSnapshot(header, players(1), entities(1500, 400, 160)).map((b) => decodeSnapshot(b)!);
    const a = new SnapshotAssembler(); a.reset(header.runId); a.add(parts[0], 0);
    expect(a.add(parts[0], 1)).toBeNull(); expect(a.pendingTicks).toBe(1);
    const changed = { ...parts[0], pickupId: parts[0].pickupId.slice() }; changed.pickupId[0]++;
    expect(a.add(changed, 2)).toBeNull(); expect(a.pendingTicks).toBe(0);
    expect(a.add(parts[1], 3)).toBeNull();
    a.reset(header.runId); a.add(parts[0], 0);
    expect(a.add({ ...parts[1], enemyStart: 0 }, 1)).toBeNull(); expect(a.pendingTicks).toBe(0);
  });

  it('rejects global caps and malformed pickup identity/kinds before allocating a tick', () => {
    for (const e of [entities(1501, 0), entities(0, 401), entities(0, 0, 161)]) expect(() => encodeSnapshot(header, [], e)).toThrow();
    const good = encodeSnapshot(header, [], entities(0, 0, 1))[0];
    for (const [offset, value] of [[HEADER_BYTES, 0], [HEADER_BYTES + 8, 16], [2, 5]]) {
      const bad = good.slice(0); const view = new DataView(bad);
      if (offset === HEADER_BYTES) view.setUint32(offset, value, true); else view.setUint8(offset, value);
      expect(decodeSnapshot(bad)).toBeNull();
    }
  });
});

describe('enemy slots and per-recipient flags', () => {
  function sim(): Simulation {
    const s = new Simulation({ dungeon: sandbox, players: [{ id: 0, name: 'A', classId: 'fallen' }, { id: 1, name: 'B', classId: 'binder' }], seed: 1 });
    s.refreshFields();
    return s;
  }

  it("doesn't reuse a freed slot for 1 s", () => {
    const s = sim();
    const slot = s.placeEnemy(BLESSED, 30, 3, -1);
    s.removeEnemy(slot);
    const freedAt = s.tick;
    const seen: number[] = [];
    while (s.tick < freedAt + 29) {
      s.step();
      seen.push(s.placeEnemy(BLESSED, 30, 3, -1));
    }
    expect(seen).not.toContain(slot);
    s.step();
    expect(s.placeEnemy(BLESSED, 30, 3, -1)).toBe(slot);
  });

  it('sets the hurt flag once per recipient, since the previous snapshot sent to it', () => {
    const s = sim();
    const slot = s.placeEnemy(BLESSED, 30, 3, -1);
    const hurt = (recipient: number) => {
      const snap = decodeSnapshot(s.encodeFor(recipient)[0])!;
      const i = Array.from(snap.enemySlot).indexOf(slot);
      return (snap.enemyFlags[i] & FLAG_HURT) !== 0;
    };
    s.step();
    expect(hurt(0)).toBe(false);
    expect(hurt(1)).toBe(false);
    // A hit during a tick (here: right after stepping, before encoding).
    s.step();
    s.markHurt(slot);
    expect(hurt(0)).toBe(true);
    s.step();
    expect(hurt(0)).toBe(false);
    // Recipient 1 wasn't sent the previous snapshot: it still sees the hit.
    expect(hurt(1)).toBe(true);
    s.step();
    expect(hurt(1)).toBe(false);
  });
});

describe('M12 stage 4 protocol (M12 §9)', () => {
  it('FLAG_STUNNED is value 2, a bit of its own', () => {
    expect(FLAG_STUNNED).toBe(2);
    const flags = [FLAG_HURT, FLAG_STUNNED, FLAG_ROOTED, FLAG_SILENCED, FLAG_SLOWED, FLAG_TAUNTED];
    expect(new Set(flags).size).toBe(flags.length);
    expect(flags.reduce((a, f) => a | f, 0)).toBe(flags.reduce((a, f) => a + f, 0));
  });

  it("`bursts` carries the player and `dashCut` the path's ends", () => {
    const bursts: GameEvent = { type: 'bursts', list: [3, 400, 1] };
    const cut: GameEvent = { type: 'dashCut', playerId: 1, x0: 1, y0: 2, z0: 0, x1: 9, y1: 2, z1: 0 };
    expect(JSON.parse(JSON.stringify([bursts, cut]))).toEqual([bursts, cut]);
  });
});

describe('R2 Dominion snapshot control metadata', () => {
  it('round-trips locked leap geometry and rejects malformed kinds and destinations', () => {
    const e = casting(1);
    e.dominionCasts![0].leap = { fromX: 10, fromY: 10, fromZ: 2, x: 30, y: 10, z: 2 };
    const packet = encodeSnapshot(header, players(1), e)[0], o = HEADER_BYTES + PLAYER_BYTES;
    expect(decodeSnapshot(packet)?.dominionCasts).toEqual(e.dominionCasts);
    for (const [offset, value] of [[20, NaN], [32, Infinity], [32, 1000], [32, 12]]) {
      const bad = packet.slice(0); new DataView(bad).setFloat32(o + offset, value, true); expect(decodeSnapshot(bad)).toBeNull();
    }
    const bad = packet.slice(0); new DataView(bad).setUint8(o + 19, 2); expect(decodeSnapshot(bad)).toBeNull();
  });
  function casting(ne = 1500) {
    const e = entities(ne, ne === 1500 ? 400 : 0, ne === 1500 ? 160 : 0);
    const count = Math.min(3, ne);
    e.dominionCasts = Array.from({ length: count }, (_, k) => {
      const i = ne - count + k; e.enemyTypeState[i] = DOMINION | (2 << 4);
      return { slot: e.enemySlot[i], incarnation: e.enemyIncarnation[i], castId: k + 1,
        startTick: header.tick - 10, impactTick: header.tick + 35, room: 2 };
    });
    return e;
  }
  it('reserves three 44-byte records in part zero at maximum capacity, even when their enemies are in part one', () => {
    const e = casting(), packets = encodeSnapshot(header, players(4), e);
    expect(packets).toHaveLength(2); expect(packets.every((p) => p.byteLength <= 16000)).toBe(true);
    expect(packets.reduce((n, p) => n + p.byteLength, 0)).toBe(2 * (HEADER_BYTES + 4 * PLAYER_BYTES) + 1500 * ENEMY_BYTES + 400 * PROJECTILE_BYTES + 160 * PICKUP_BYTES + 3 * 44);
    const zero = decodeSnapshot(packets[0])!, one = decodeSnapshot(packets[1])!;
    expect(zero.dominionCasts).toEqual(e.dominionCasts); expect(one.dominionCasts).toEqual([]);
    expect(one.totalDominionCasts).toBe(3); expect(zero.enemySlot.includes(e.dominionCasts![0].slot)).toBe(false);
    const a = new SnapshotAssembler(); a.reset(header.runId);
    expect(a.add(one, 0)).toBeNull(); expect(a.add(zero, 1)?.dominionCasts).toEqual(e.dominionCasts);
  });
  it('ignores identical metadata duplicates and rejects conflicting records or sibling counts', () => {
    const packets = encodeSnapshot(header, players(4), casting());
    const a = new SnapshotAssembler(); a.reset(header.runId);
    expect(a.add(decodeSnapshot(packets[0])!, 0)).toBeNull();
    expect(a.add(decodeSnapshot(packets[0])!, 1)).toBeNull();
    expect(a.add(decodeSnapshot(packets[1])!, 2)?.dominionCasts).toHaveLength(3);
    a.reset(header.runId); a.add(decodeSnapshot(packets[0])!, 0);
    const changed = packets[0].slice(0), v = new DataView(changed), o = HEADER_BYTES + 4 * PLAYER_BYTES;
    v.setUint32(o + 10, header.tick - 11, true); v.setUint32(o + 14, header.tick + 34, true);
    expect(a.add(decodeSnapshot(changed)!, 1)).toBeNull(); expect(a.add(decodeSnapshot(packets[1])!, 2)).toBeNull();
    expect(a.newestCompleteTick).toBe(-1);
    a.reset(header.runId); a.add(decodeSnapshot(packets[0])!, 0);
    const sibling = packets[1].slice(0); new DataView(sibling).setUint8(65, 2);
    expect(a.add(decodeSnapshot(sibling)!, 1)).toBeNull(); expect(a.newestCompleteTick).toBe(-1);
  });
  it('rejects malformed identities, deadlines, caps and inactive records before publication', () => {
    const e = casting(1), packet = encodeSnapshot(header, players(1), e)[0], o = HEADER_BYTES + PLAYER_BYTES;
    const bad = (offset: number, value: number, bytes: 1 | 2 | 4) => {
      const b = packet.slice(0), v = new DataView(b);
      if (bytes === 1) v.setUint8(offset, value); else if (bytes === 2) v.setUint16(offset, value, true); else v.setUint32(offset, value, true);
      expect(decodeSnapshot(b)).toBeNull();
    };
    bad(65, 4, 1); bad(66, 0, 1); bad(o, 65535, 2); bad(o + 2, 0, 4); bad(o + 6, 0, 4);
    bad(o + 10, header.tick + 1, 4); bad(o + 14, header.tick, 4); bad(o + 18, 32, 1);
    bad(o + 2, 999, 4); // Reused slot: the record does not match its current incarnation.
    for (const extra of [4, 15, 0xf4]) bad(o + 44 + 6, extra, 1);
    bad(o + 44 + 7, 128, 1);
    expect(() => encodeSnapshot(header, [], { ...e, dominionCasts: [...e.dominionCasts!, ...e.dominionCasts!] })).toThrow('invalid Dominion casts');
  });
  it('does not advance the complete watermark for a multipart cast attached to a reused slot', () => {
    const e = casting(); e.dominionCasts = e.dominionCasts!.map((c) => ({ ...c, incarnation: c.incarnation + 1 }));
    const packets = encodeSnapshot(header, players(4), e), a = new SnapshotAssembler(); a.reset(header.runId);
    a.add(decodeSnapshot(packets[0])!, 0);
    expect(a.add(decodeSnapshot(packets[1])!, 1)).toBeNull(); expect(a.newestCompleteTick).toBe(-1);
  });
});


describe('family commander snapshot metadata', () => {
  function familyEntities() {
    const e = entities(1500, 400, 160);
    e.commanderCasts = [CANTOR, CARRIER].map((type, k): CommanderCast => {
      const i = 1498 + k; e.enemyTypeState[i] = type | (2 << 4);
      return { slot: e.enemySlot[i], incarnation: e.enemyIncarnation[i], castId: 10 + k, room: 2, kind: k === 0 ? 'beam' : 'carry',
        phase: 'tell', startTick: header.tick - 10, phaseTick: header.tick - 10, endTick: header.tick + 20,
        targetId: k, yaw: 0.5, pitch: 0.25, x: 10, y: 10, z: 0, targetX: 20, targetY: 10, targetZ: 0, dropX: 22, dropY: 10 };
    });
    return e;
  }
  it('reassembles bounded beam/carry records with enemies in a later part at maximum occupancy', () => {
    const e = familyEntities(), packets = encodeSnapshot(header, players(4), e), assembler = new SnapshotAssembler(); assembler.reset(header.runId);
    expect(packets).toHaveLength(2); expect(packets.every((p) => p.byteLength <= MAX_SNAPSHOT_BYTES)).toBe(true);
    expect(packets.reduce((n, p) => n + p.byteLength, 0)).toBe(2 * (HEADER_BYTES + 4 * PLAYER_BYTES) + 1500 * ENEMY_BYTES + 400 * PROJECTILE_BYTES + 160 * PICKUP_BYTES + 2 * COMMANDER_BYTES);
    expect(assembler.add(decodeSnapshot(packets[1])!)).toBeNull();
    expect(assembler.add(decodeSnapshot(packets[0])!)?.commanderCasts).toEqual(e.commanderCasts);
  });
  it('rejects malformed phase, nonfinite orientation, cap, identity and carry-victim mismatches', () => {
    const e = familyEntities(), packets = encodeSnapshot(header, players(4), e), offset = HEADER_BYTES + 4 * PLAYER_BYTES;
    for (const [at, value] of [[67, 4], [offset + 23, 2], [offset + 24, 9], [offset + 25, 4]]) {
      const bad = packets[0].slice(0); new DataView(bad).setUint8(at, value); expect(decodeSnapshot(bad)).toBeNull();
    }
    const bad = packets[0].slice(0); new DataView(bad).setFloat32(offset + 26, NaN, true); expect(decodeSnapshot(bad)).toBeNull();
    const mismatch = familyEntities(); mismatch.enemyIncarnation[1498]++;
    const a = new SnapshotAssembler(); a.reset(header.runId);
    for (const p of encodeSnapshot(header, players(4), mismatch)) a.add(decodeSnapshot(p)!);
    expect(a.newestCompleteTick).toBe(-1);
    const p = players(1); p[0].carrySlot = 1;
    expect(decodeSnapshot(encodeSnapshot(header, p, entities(1, 0))[0])).toBeNull();
  });
});

describe('Watchman aim records (rogue rooms.md §6.4)', () => {
  function watchEntities(n = 2) {
    const e = entities(1500, 400, 160);
    e.watchmanAims = Array.from({ length: n }, (_, k): WatchmanAim => {
      const i = 1400 + k; e.enemyTypeState[i] = WATCHMAN | (2 << 4);
      return k % 2 === 0
        ? { slot: e.enemySlot[i], incarnation: e.enemyIncarnation[i], targetId: k % 4, phase: 'aim', fireTick: header.tick + 12, shot: 7, x: 0, y: 0, z: 0 }
        : { slot: e.enemySlot[i], incarnation: e.enemyIncarnation[i], targetId: k % 4, phase: 'fired', fireTick: header.tick - 3, shot: 255, x: 20.25, y: 10.5, z: 1.5 };
    });
    return e;
  }
  it('round-trips 19-byte records with the enemies in a later part', () => {
    const e = watchEntities(8), packets = encodeSnapshot(header, players(4), e), assembler = new SnapshotAssembler(); assembler.reset(header.runId);
    expect(WATCHMAN_BYTES).toBe(19);
    expect(packets.reduce((n, p) => n + p.byteLength, 0)).toBe(packets.length * (HEADER_BYTES + 4 * PLAYER_BYTES) + 1500 * ENEMY_BYTES + 400 * PROJECTILE_BYTES + 160 * PICKUP_BYTES + 8 * WATCHMAN_BYTES);
    expect(assembler.add(decodeSnapshot(packets[1])!)).toBeNull();
    expect(assembler.add(decodeSnapshot(packets[0])!)?.watchmanAims).toEqual(e.watchmanAims);
  });
  it('rejects a ninth record, a bad phase, an expired aim and a stale incarnation', () => {
    expect(() => encodeSnapshot(header, players(4), watchEntities(9))).toThrow('invalid Watchman aims');
    const late = watchEntities(); late.watchmanAims = [late.watchmanAims![0], { ...late.watchmanAims![1], fireTick: header.tick - 15 }];
    expect(() => encodeSnapshot(header, players(4), late)).toThrow('invalid Watchman aims');
    const packets = encodeSnapshot(header, players(4), watchEntities()), offset = HEADER_BYTES + 4 * PLAYER_BYTES;
    for (const [at, value] of [[69, 9], [70, 1], [offset + 7, 2]]) {
      const bad = packets[0].slice(0); new DataView(bad).setUint8(at, value); expect(decodeSnapshot(bad)).toBeNull();
    }
    const stale = watchEntities(); stale.enemyIncarnation[1400]++;
    const a = new SnapshotAssembler(); a.reset(header.runId);
    for (const p of encodeSnapshot(header, players(4), stale)) a.add(decodeSnapshot(p)!);
    expect(a.newestCompleteTick).toBe(-1);
    const notWatchman = watchEntities(); notWatchman.enemyTypeState[1401] = BLESSED;
    const b = new SnapshotAssembler(); b.reset(header.runId);
    for (const p of encodeSnapshot(header, players(4), notWatchman)) b.add(decodeSnapshot(p)!);
    expect(b.newestCompleteTick).toBe(-1);
  });
});
