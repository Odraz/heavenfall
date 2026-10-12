import { INPUT_DEFAULTS } from '../sim/testutil/sims';
import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons/index';

const sandbox = DUNGEONS.sandbox;
import { BLESSED } from '../data/enemies';
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
  }));
}

function entities(ne: number, np: number): SnapshotEntities {
  const e: SnapshotEntities = {
    enemyCount: ne,
    enemySlot: new Uint16Array(ne),
    enemyX: new Float32Array(ne),
    enemyY: new Float32Array(ne),
    enemyTypeState: new Uint8Array(ne),
    enemyFlags: new Uint8Array(ne),
    projectileCount: np,
    projSlot: new Uint16Array(np),
    projKind: new Uint8Array(np),
    projX: new Float32Array(np),
    projY: new Float32Array(np),
    projZ: new Float32Array(np),
  };
  for (let i = 0; i < ne; i++) {
    e.enemySlot[i] = i * 2;
    e.enemyX[i] = (i % 200) + 0.5;
    e.enemyY[i] = 3.125 + (i % 7);
    e.enemyTypeState[i] = (i % 4) | ((i % 5) << 4);
    e.enemyFlags[i] = i % 64;
  }
  for (let i = 0; i < np; i++) {
    e.projSlot[i] = i;
    e.projKind[i] = i % 3;
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
    expect(Array.from(new Uint8Array(buf, 46))).toEqual([255, 3, 7]);
    // Counters wrap.
    expect(decodeInput(encodeInput({ ...m, qPresses: 256, item1Presses: 256 }), m.runId)).toMatchObject({ qPresses: 0, item1Presses: 0 });
    // The `fire` bits (M9 §10): left, right, right pressed last.
    for (const fire of [0, FIRE_LEFT, FIRE_RIGHT, FIRE_LEFT | FIRE_RIGHT, FIRE_LEFT | FIRE_RIGHT | FIRE_RIGHT_LAST]) {
      expect(decodeInput(encodeInput({ ...m, fire }), m.runId)!.fire).toBe(fire);
    }
    expect(buf.byteLength).toBe(49);
  });

  const valid: InputMsg = { ...INPUT_DEFAULTS, runId: header.runId, seq: 1, x: 4.5, y: 4.5, z: 0,
    yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 };

  it('rejects wrong lengths and another run', () => {
    for (const length of [0, 30, 48, 50, 100]) expect(decodeInput(new ArrayBuffer(length), valid.runId)).toBeNull();
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
    expect(parts[0].byteLength).toBe(HEADER_BYTES + 4 * 32 + 100 * 8 + 20 * 9);
    const s = decodeSnapshot(parts[0])!;
    expect(HEADER_BYTES).toBe(61);
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
    expect(s.projKind[5]).toBe(2);
    expect(s.projX[5]).toBe(5 + 5 / 64);
    expect(s.projZ[5]).toBe(15.984375);
  });

  it('fits the largest snapshot at the current caps in one part (15 797 bytes)', () => {
    const parts = encodeSnapshot(header, players(4), entities(1501, 400));
    expect(parts.length).toBe(1);
    expect(parts[0].byteLength).toBe(15797);
  });

  it('splits snapshots above 16 000 bytes into parts that each carry the header and all players', () => {
    const e = entities(2500, 400);
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
    expect(enemies).toBe(2500);
    expect(projectiles).toBe(400);
    // The first part is as full as fits: (16 000 − 27 − 120) ÷ 8 enemies.
    expect(decodeSnapshot(parts[0])!.enemyCount).toBe(Math.floor((MAX_SNAPSHOT_BYTES - HEADER_BYTES - 4 * PLAYER_BYTES) / 8));
  });

  it('reassembles parts that arrive out of order', () => {
    const parts = encodeSnapshot(header, players(2), entities(2500, 400)).map((b) => decodeSnapshot(b)!);
    const a = new SnapshotAssembler();
    a.reset(header.runId);
    expect(a.add(parts[1])).toBeNull();
    const s = a.add(parts[0])!;
    expect(s).not.toBeNull();
    expect(s.enemyCount).toBe(2500);
    expect(s.projectileCount).toBe(400);
    for (let i = 0; i < 2500; i++) expect(s.enemySlot[i]).toBe(i * 2);
    expect(a.newestCompleteTick).toBe(header.tick);
  });

  it('ignores stale parts and drops older incomplete ticks', () => {
    const at = (tick: number) => encodeSnapshot({ ...header, tick }, players(1), entities(2500, 0)).map((b) => decodeSnapshot(b)!);
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
    const parts = encodeSnapshot(header, players(1), entities(2500, 0)).map((b) => decodeSnapshot(b)!);
    const foreign = { ...parts[0], runId: 'f'.repeat(32), tick: 0xffffffff };
    expect(a.add(foreign)).toBeNull(); expect(a.pendingTicks).toBe(0); expect(a.newestCompleteTick).toBe(-1);
    a.add(parts[0]); a.reset(foreign.runId);
    expect(a.pendingTicks).toBe(0); expect(a.add(parts[1])).toBeNull();
    const empty = decodeSnapshot(encodeSnapshot({ ...header, runId: foreign.runId, tick: 1 }, [], entities(0, 0))[0])!;
    expect(a.add(empty)?.tick).toBe(1);
    a.reset(header.runId); expect(a.newestCompleteTick).toBe(-1);
    expect(a.add(parts[1])).toBeNull(); expect(a.add(parts[0])?.enemyCount).toBe(2500);
  });

  it('permanently invalidates a tick with disagreeing sibling totals, part counts, headers or players', () => {
    const parts = encodeSnapshot(header, players(1), entities(2500, 400)).map((b) => decodeSnapshot(b)!);
    const variants = [
      { ...parts[1], totalEnemyCount: 2499 }, { ...parts[1], totalProjectileCount: 399 },
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
    const parts = encodeSnapshot(header, players(1), entities(2500, 0)).map((b) => decodeSnapshot(b)!);
    const a = new SnapshotAssembler(); a.reset(header.runId); a.add(parts[0]);
    expect(a.add({ ...parts[1], enemyCount: parts[1].enemyCount - 1 })).toBeNull();
    expect(a.add(parts[1])).toBeNull();
    expect(() => encodeSnapshot(header, players(1), entities(1, 0), HEADER_BYTES + PLAYER_BYTES)).toThrow('snapshot part too small');
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
