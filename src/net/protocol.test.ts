import { describe, expect, it } from 'vitest';
import { sandbox } from '../data/dungeons/sandbox';
import { BLESSED } from '../data/enemies';
import { Simulation } from '../sim/sim';
import {
  decodeInput,
  decodeSnapshot,
  encodeInput,
  encodeSnapshot,
  FLAG_HURT,
  HEADER_BYTES,
  INPUT_BYTES,
  MAX_SNAPSHOT_BYTES,
  SnapshotAssembler,
  type InputMsg,
  type SnapshotEntities,
  type SnapshotHeader,
  type SnapshotPlayer,
} from './protocol';

const header: SnapshotHeader = {
  tick: 123456,
  arenaIndex: 2,
  arenaPhase: 1,
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
    const m: InputMsg = { seq: 4000000000, x: 12.5, y: 7.25, z: 1.5, yaw: 3.0, pitch: -0.5, fireHeld: true, qPresses: 255, ePresses: 3, allyTargetId: 255, lastTeleportId: 65535 };
    const buf = encodeInput(m);
    expect(buf.byteLength).toBe(INPUT_BYTES);
    const d = decodeInput(buf)!;
    expect(d.seq).toBe(m.seq);
    expect(d.x).toBe(12.5);
    expect(d.yaw).toBeCloseTo(3.0, 6);
    expect(d.pitch).toBeCloseTo(-0.5, 6);
    expect(d).toMatchObject({ fireHeld: true, qPresses: 255, ePresses: 3, allyTargetId: 255, lastTeleportId: 65535 });
    // Counters wrap.
    expect(decodeInput(encodeInput({ ...m, qPresses: 256 }))!.qPresses).toBe(0);
  });

  it('ignores stale inputs on the host', () => {
    const sim = new Simulation({ dungeon: sandbox, players: [{ id: 0, name: 'A', classId: 'fallen' }], seed: 1 });
    const p = sim.players[0];
    const base = { z: 0, yaw: 0, pitch: 0, fireHeld: false, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 };
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
    const base = { yaw: 0, pitch: 0, fireHeld: false, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 };
    // 100 ms at 7 m/s: at most 1.2 × 0.7 + 0.5 = 1.34 m.
    sim.applyInput(0, { ...base, seq: 1, x: p.x + 5, y: p.y, z: -1 }, 1100);
    expect(p.x).toBeCloseTo(4.5 + 1.34, 5);
    expect(p.z).toBe(0);
  });
});

describe('snapshot protocol', () => {
  it('round-trips header, players, enemies and projectiles', () => {
    const parts = encodeSnapshot(header, players(4), entities(100, 20));
    expect(parts.length).toBe(1);
    expect(parts[0].byteLength).toBe(25 + 4 * 28 + 100 * 8 + 20 * 9);
    const s = decodeSnapshot(parts[0])!;
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

  it('fits the largest snapshot at the current caps in one part (15 745 bytes)', () => {
    const parts = encodeSnapshot(header, players(4), entities(1501, 400));
    expect(parts.length).toBe(1);
    expect(parts[0].byteLength).toBe(15745);
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
    // The first part is as full as fits: (16 000 − 25 − 112) ÷ 8 enemies.
    expect(decodeSnapshot(parts[0])!.enemyCount).toBe(Math.floor((MAX_SNAPSHOT_BYTES - HEADER_BYTES - 4 * 28) / 8));
  });

  it('reassembles parts that arrive out of order', () => {
    const parts = encodeSnapshot(header, players(2), entities(2500, 400)).map((b) => decodeSnapshot(b)!);
    const a = new SnapshotAssembler();
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
