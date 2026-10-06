/** Binary input and snapshot encoding, little-endian (§9.3, §9.4). */

// ---------------------------------------------------------------- input

export const INPUT_BYTES = 30;
export const ALLY_NONE = 255;

export interface InputMsg {
  seq: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** The mouse buttons (M9 §10): FIRE_LEFT, FIRE_RIGHT and FIRE_RIGHT_LAST bits. */
  fire: number;
  /** Running press counters, wrapping at 256. */
  qPresses: number;
  ePresses: number;
  /** 255 = none. */
  allyTargetId: number;
  lastTeleportId: number;
}

export function encodeInput(m: InputMsg): ArrayBuffer {
  const buf = new ArrayBuffer(INPUT_BYTES);
  const v = new DataView(buf);
  v.setUint32(0, m.seq >>> 0, true);
  v.setFloat32(4, m.x, true);
  v.setFloat32(8, m.y, true);
  v.setFloat32(12, m.z, true);
  v.setFloat32(16, m.yaw, true);
  v.setFloat32(20, m.pitch, true);
  v.setUint8(24, m.fire & 0x07);
  v.setUint8(25, m.qPresses & 0xff);
  v.setUint8(26, m.ePresses & 0xff);
  v.setUint8(27, m.allyTargetId & 0xff);
  v.setUint16(28, m.lastTeleportId & 0xffff, true);
  return buf;
}

export function decodeInput(buf: ArrayBuffer): InputMsg | null {
  if (buf.byteLength !== INPUT_BYTES) return null;
  const v = new DataView(buf);
  return {
    seq: v.getUint32(0, true),
    x: v.getFloat32(4, true),
    y: v.getFloat32(8, true),
    z: v.getFloat32(12, true),
    yaw: v.getFloat32(16, true),
    pitch: v.getFloat32(20, true),
    fire: v.getUint8(24) & 0x07,
    qPresses: v.getUint8(25),
    ePresses: v.getUint8(26),
    allyTargetId: v.getUint8(27),
    lastTeleportId: v.getUint16(28, true),
  };
}

// ---------------------------------------------------------------- snapshots

/** The MVP's 25 bytes plus `countdown` (M8 §10). */
export const HEADER_BYTES = 27;
/** The MVP's 28 bytes plus `revive` and `shots` (M8 §10), `shots2` and `beam` (M9 §10). */
export const PLAYER_BYTES = 32;
export const ENEMY_BYTES = 8;
export const PROJECTILE_BYTES = 9;
export const MAX_SNAPSHOT_BYTES = 16000;
/** Positions of enemies and projectiles are sent in 1/64 m. */
export const POS_SCALE = 64;

export const PHASE_IDLE = 0;
export const PHASE_COMBAT = 1;
export const PHASE_CLEARED = 2;
/** The arena countdown before it seals (M8 §5). */
export const PHASE_COUNTDOWN = 3;

/** Enemy `flags` bits. */
export const FLAG_HURT = 1;
/** Bit 1 (Kiss of Betrayal's mark) is unused since M9. */
export const FLAG_MARKED = 2;
export const FLAG_ROOTED = 4;
export const FLAG_SILENCED = 8;
export const FLAG_SLOWED = 16;
/** The enemy's target is overridden by Blasphemy (M8 §10). */
export const FLAG_TAUNTED = 32;

export interface SnapshotHeader {
  tick: number;
  arenaIndex: number;
  arenaPhase: number;
  /** Tenths of a second until the arena seals, 0 outside the countdown (M8 §5). */
  countdown: number;
  enemiesRemaining: number;
  bossHp: number;
  bossMaxHp: number;
  bossCast: number;
  bossCastProgress: number;
}

export interface SnapshotPlayer {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  hp: number;
  shield: number;
  dead: boolean;
  /** Milliseconds of cooldown remaining. */
  cdQ: number;
  cdE: number;
  kills: number;
  /** Revive progress × 255, 0 while alive (M8 §4.2). */
  revive: number;
  /** A wrapping counter of primary attacks fired, for others' shot sounds (M8 §9.1). */
  shots: number;
  /** A wrapping counter of secondary attacks fired (M9 §10). */
  shots2: number;
  /** The ally being healed by Sacrament, 255 for none (M9 §2.5). */
  beam: number;
}

/** Dense entity arrays for encoding; only the first `enemyCount` / `projectileCount` entries are used. */
export interface SnapshotEntities {
  enemyCount: number;
  enemySlot: Uint16Array;
  enemyX: Float32Array;
  enemyY: Float32Array;
  /** type (low 4 bits) | state << 4 */
  enemyTypeState: Uint8Array;
  enemyFlags: Uint8Array;
  projectileCount: number;
  projSlot: Uint16Array;
  projKind: Uint8Array;
  projX: Float32Array;
  projY: Float32Array;
  projZ: Float32Array;
}

function pos16(v: number): number {
  const q = Math.round(v * POS_SCALE);
  return q < 0 ? 0 : q > 0xffff ? 0xffff : q;
}

function clamp16(v: number): number {
  const q = Math.ceil(v);
  return q < 0 ? 0 : q > 0xffff ? 0xffff : q;
}

/**
 * Encodes a snapshot, split into parts of at most `maxBytes` when needed. Every part carries the
 * full header and all players, plus a contiguous range of enemies and projectiles, as full as fits.
 */
export function encodeSnapshot(
  h: SnapshotHeader,
  players: readonly SnapshotPlayer[],
  e: SnapshotEntities,
  maxBytes = MAX_SNAPSHOT_BYTES,
): ArrayBuffer[] {
  const fixed = HEADER_BYTES + players.length * PLAYER_BYTES;
  const ranges: Array<[number, number, number, number]> = [];
  let ei = 0;
  let pi = 0;
  do {
    let cap = maxBytes - fixed;
    const ne = Math.max(0, Math.min(e.enemyCount - ei, Math.floor(cap / ENEMY_BYTES)));
    cap -= ne * ENEMY_BYTES;
    const np = Math.max(0, Math.min(e.projectileCount - pi, Math.floor(cap / PROJECTILE_BYTES)));
    if (ne === 0 && np === 0 && ranges.length > 0) throw new Error('snapshot part too small');
    ranges.push([ei, ne, pi, np]);
    ei += ne;
    pi += np;
  } while (ei < e.enemyCount || pi < e.projectileCount);

  return ranges.map(([e0, ne, p0, np], partIndex) => {
    const buf = new ArrayBuffer(fixed + ne * ENEMY_BYTES + np * PROJECTILE_BYTES);
    const v = new DataView(buf);
    v.setUint32(0, h.tick >>> 0, true);
    v.setUint8(4, partIndex);
    v.setUint8(5, ranges.length);
    v.setUint8(6, h.arenaIndex);
    v.setUint8(7, h.arenaPhase);
    v.setUint16(8, Math.min(0xffff, h.countdown), true);
    v.setUint16(10, Math.min(0xffff, h.enemiesRemaining), true);
    v.setUint32(12, Math.max(0, Math.ceil(h.bossHp)), true);
    v.setUint32(16, h.bossMaxHp, true);
    v.setUint8(20, h.bossCast);
    v.setUint8(21, h.bossCastProgress);
    v.setUint8(22, players.length);
    v.setUint16(23, ne, true);
    v.setUint16(25, np, true);
    let o = HEADER_BYTES;
    for (const p of players) {
      v.setUint8(o, p.id);
      v.setFloat32(o + 1, p.x, true);
      v.setFloat32(o + 5, p.y, true);
      v.setFloat32(o + 9, p.z, true);
      v.setFloat32(o + 13, p.yaw, true);
      v.setUint16(o + 17, clamp16(p.hp), true);
      v.setUint16(o + 19, clamp16(p.shield), true);
      v.setUint8(o + 21, p.dead ? 1 : 0);
      v.setUint16(o + 22, clamp16(p.cdQ), true);
      v.setUint16(o + 24, clamp16(p.cdE), true);
      v.setUint16(o + 26, Math.min(0xffff, p.kills), true);
      v.setUint8(o + 28, Math.max(0, Math.min(255, Math.round(p.revive))));
      v.setUint8(o + 29, p.shots & 0xff);
      v.setUint8(o + 30, p.shots2 & 0xff);
      v.setUint8(o + 31, p.beam & 0xff);
      o += PLAYER_BYTES;
    }
    for (let i = e0; i < e0 + ne; i++) {
      v.setUint16(o, e.enemySlot[i], true);
      v.setUint16(o + 2, pos16(e.enemyX[i]), true);
      v.setUint16(o + 4, pos16(e.enemyY[i]), true);
      v.setUint8(o + 6, e.enemyTypeState[i]);
      v.setUint8(o + 7, e.enemyFlags[i]);
      o += ENEMY_BYTES;
    }
    for (let i = p0; i < p0 + np; i++) {
      v.setUint16(o, e.projSlot[i], true);
      v.setUint8(o + 2, e.projKind[i]);
      v.setUint16(o + 3, pos16(e.projX[i]), true);
      v.setUint16(o + 5, pos16(e.projY[i]), true);
      v.setUint16(o + 7, pos16(e.projZ[i]), true);
      o += PROJECTILE_BYTES;
    }
    return buf;
  });
}

/** A decoded snapshot part, or a whole snapshot after reassembly. */
export interface Snapshot extends SnapshotHeader {
  partIndex: number;
  partCount: number;
  players: SnapshotPlayer[];
  enemyCount: number;
  enemySlot: Uint16Array;
  enemyX: Float32Array;
  enemyY: Float32Array;
  enemyType: Uint8Array;
  enemyState: Uint8Array;
  enemyFlags: Uint8Array;
  projectileCount: number;
  projSlot: Uint16Array;
  projKind: Uint8Array;
  projX: Float32Array;
  projY: Float32Array;
  projZ: Float32Array;
}

export function decodeSnapshot(buf: ArrayBuffer): Snapshot | null {
  if (buf.byteLength < HEADER_BYTES) return null;
  const v = new DataView(buf);
  const playerCount = v.getUint8(22);
  const ne = v.getUint16(23, true);
  const np = v.getUint16(25, true);
  if (buf.byteLength !== HEADER_BYTES + playerCount * PLAYER_BYTES + ne * ENEMY_BYTES + np * PROJECTILE_BYTES) return null;
  const s: Snapshot = {
    tick: v.getUint32(0, true),
    partIndex: v.getUint8(4),
    partCount: v.getUint8(5),
    arenaIndex: v.getUint8(6),
    arenaPhase: v.getUint8(7),
    countdown: v.getUint16(8, true),
    enemiesRemaining: v.getUint16(10, true),
    bossHp: v.getUint32(12, true),
    bossMaxHp: v.getUint32(16, true),
    bossCast: v.getUint8(20),
    bossCastProgress: v.getUint8(21),
    players: [],
    enemyCount: ne,
    enemySlot: new Uint16Array(ne),
    enemyX: new Float32Array(ne),
    enemyY: new Float32Array(ne),
    enemyType: new Uint8Array(ne),
    enemyState: new Uint8Array(ne),
    enemyFlags: new Uint8Array(ne),
    projectileCount: np,
    projSlot: new Uint16Array(np),
    projKind: new Uint8Array(np),
    projX: new Float32Array(np),
    projY: new Float32Array(np),
    projZ: new Float32Array(np),
  };
  let o = HEADER_BYTES;
  for (let i = 0; i < playerCount; i++) {
    s.players.push({
      id: v.getUint8(o),
      x: v.getFloat32(o + 1, true),
      y: v.getFloat32(o + 5, true),
      z: v.getFloat32(o + 9, true),
      yaw: v.getFloat32(o + 13, true),
      hp: v.getUint16(o + 17, true),
      shield: v.getUint16(o + 19, true),
      dead: v.getUint8(o + 21) !== 0,
      cdQ: v.getUint16(o + 22, true),
      cdE: v.getUint16(o + 24, true),
      kills: v.getUint16(o + 26, true),
      revive: v.getUint8(o + 28),
      shots: v.getUint8(o + 29),
      shots2: v.getUint8(o + 30),
      beam: v.getUint8(o + 31),
    });
    o += PLAYER_BYTES;
  }
  for (let i = 0; i < ne; i++) {
    s.enemySlot[i] = v.getUint16(o, true);
    s.enemyX[i] = v.getUint16(o + 2, true) / POS_SCALE;
    s.enemyY[i] = v.getUint16(o + 4, true) / POS_SCALE;
    const ts = v.getUint8(o + 6);
    s.enemyType[i] = ts & 0x0f;
    s.enemyState[i] = ts >> 4;
    s.enemyFlags[i] = v.getUint8(o + 7);
    o += ENEMY_BYTES;
  }
  for (let i = 0; i < np; i++) {
    s.projSlot[i] = v.getUint16(o, true);
    s.projKind[i] = v.getUint8(o + 2);
    s.projX[i] = v.getUint16(o + 3, true) / POS_SCALE;
    s.projY[i] = v.getUint16(o + 5, true) / POS_SCALE;
    s.projZ[i] = v.getUint16(o + 7, true) / POS_SCALE;
    o += PROJECTILE_BYTES;
  }
  return s;
}

function concatParts(parts: Snapshot[]): Snapshot {
  if (parts.length === 1) return parts[0];
  const ne = parts.reduce((n, p) => n + p.enemyCount, 0);
  const np = parts.reduce((n, p) => n + p.projectileCount, 0);
  const first = parts[0];
  const s: Snapshot = {
    ...first,
    partIndex: 0,
    enemyCount: ne,
    enemySlot: new Uint16Array(ne),
    enemyX: new Float32Array(ne),
    enemyY: new Float32Array(ne),
    enemyType: new Uint8Array(ne),
    enemyState: new Uint8Array(ne),
    enemyFlags: new Uint8Array(ne),
    projectileCount: np,
    projSlot: new Uint16Array(np),
    projKind: new Uint8Array(np),
    projX: new Float32Array(np),
    projY: new Float32Array(np),
    projZ: new Float32Array(np),
  };
  let eo = 0;
  let po = 0;
  for (const p of parts) {
    s.enemySlot.set(p.enemySlot, eo);
    s.enemyX.set(p.enemyX, eo);
    s.enemyY.set(p.enemyY, eo);
    s.enemyType.set(p.enemyType, eo);
    s.enemyState.set(p.enemyState, eo);
    s.enemyFlags.set(p.enemyFlags, eo);
    eo += p.enemyCount;
    s.projSlot.set(p.projSlot, po);
    s.projKind.set(p.projKind, po);
    s.projX.set(p.projX, po);
    s.projY.set(p.projY, po);
    s.projZ.set(p.projZ, po);
    po += p.projectileCount;
  }
  return s;
}

/**
 * Reassembles snapshot parts that may arrive out of order (§9.4). Keeps incomplete ticks until a
 * newer tick becomes complete; ignores parts of ticks that aren't newer than the newest complete one.
 */
export class SnapshotAssembler {
  newestCompleteTick = -1;
  private readonly pending = new Map<number, Array<Snapshot | undefined>>();

  /** Adds a part; returns the complete snapshot when this part completes a tick. */
  add(part: Snapshot): Snapshot | null {
    if (part.tick <= this.newestCompleteTick) return null;
    if (part.partCount === 0 || part.partIndex >= part.partCount) return null;
    let parts = this.pending.get(part.tick);
    if (!parts) {
      parts = new Array<Snapshot | undefined>(part.partCount);
      this.pending.set(part.tick, parts);
    }
    if (parts.length !== part.partCount) return null;
    parts[part.partIndex] = part;
    for (let i = 0; i < parts.length; i++) if (!parts[i]) return null;
    this.newestCompleteTick = part.tick;
    for (const t of this.pending.keys()) if (t <= part.tick) this.pending.delete(t);
    return concatParts(parts as Snapshot[]);
  }

  /** Number of incomplete ticks kept. */
  get pendingTicks(): number {
    return this.pending.size;
  }
}
