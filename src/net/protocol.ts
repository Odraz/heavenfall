import { COMMANDER_RECORD_CAP, validCommanderCasts, type CommanderCast } from '../data/commanders';
import { COMMANDER_BYTES, writeCommander, readCommander } from './commanderCodec';
import { WATCHMAN_RECORD_CAP, validWatchmanAims, type WatchmanAim } from '../data/watchman';
import { WATCHMAN_BYTES, writeWatchman, readWatchman } from './watchmanCodec';
/** Binary input and snapshot encoding, little-endian (§9.3, §9.4). */
import { PROTOCOL_VERSION } from './version';
import { PICKUP_CAP, PICKUP_KIND_COUNT } from '../data/pickups';
import { BOSS_PART, CANTOR, CARRIER, DOMINION, ENEMIES, ST_WINDUP, WATCHMAN } from '../data/enemies';
import { FLAG_PART_SEAL } from '../data/gatekeeper';
import { DOMINION_CAST_CAP, DOMINION_TELL_TICKS, DOMINION_LEAP_MIN_RANGE, DOMINION_LEAP_MAX_RANGE, type DominionCast } from '../data/dominion';
import { ENEMY_SLOTS, MAX_LIVING_ENEMIES, PROJECTILE_SLOTS } from '../sim/constants';

function writeRunId(v: DataView, offset: number, runId: string): void {
  if (!/^[0-9a-f]{32}$/.test(runId)) throw new Error('invalid run id');
  for (let i = 0; i < 16; i++) v.setUint8(offset + i, parseInt(runId.slice(i * 2, i * 2 + 2), 16));
}

function readRunId(v: DataView, offset: number): string {
  let id = '';
  for (let i = 0; i < 16; i++) id += v.getUint8(offset + i).toString(16).padStart(2, '0');
  return id;
}

// ---------------------------------------------------------------- input

export const INPUT_BYTES = 73;
export const ALLY_NONE = 255;

export interface InputMsg {
  runId: string;
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
  /** Reserved for R3; sent as zero in R1. */
  item1Presses: number;
  item2Presses: number;
  mapHeld: boolean;
  /** Held state has no cast consumer until R4. */
  qHeld: boolean;
  eHeld: boolean;
  /** Running mouse press counters, wrapping at 256: each press fires once (click latching). */
  leftPresses: number;
  rightPresses: number;
  /** What the screen showed (lag compensation): snapshot tick, -1 for none; ticks to the next, 0..255; 0..1 between. */
  viewTick: number;
  viewGap: number;
  viewFrac: number;
  /** Running counter of the shots the screen fired, wrapping at 256 (client-timed shots). */
  shots: number;
  /** The latest shot's button, 0 left or 1 right; HELD_FIRE (255) leaves firing to the host's own timer. */
  shotButton: number;
  /**
   * The latest shot's aim and view, repeated by every input until the next shot (netcode stage 4): a shot
   * the host learns of from a later input, its own lost or late, still fires as it was aimed.
   */
  shotYaw: number;
  shotPitch: number;
  shotViewTick: number;
  shotViewGap: number;
  shotViewFrac: number;
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
  writeRunId(v, 30, m.runId);
  v.setUint8(46, m.item1Presses & 0xff);
  v.setUint8(47, m.item2Presses & 0xff);
  v.setUint8(48, (m.mapHeld ? 1 : 0) | (m.qHeld ? 2 : 0) | (m.eHeld ? 4 : 0));
  v.setUint8(49, m.leftPresses & 0xff);
  v.setUint8(50, m.rightPresses & 0xff);
  v.setUint32(51, m.viewTick < 0 ? 0xffffffff : m.viewTick >>> 0, true);
  v.setUint8(55, Math.max(0, Math.min(255, m.viewGap | 0)));
  v.setUint8(56, Math.round(Math.max(0, Math.min(1, m.viewFrac)) * 255));
  v.setUint8(57, m.shots & 0xff);
  v.setUint8(58, m.shotButton & 0xff);
  v.setFloat32(59, m.shotYaw, true);
  v.setFloat32(63, m.shotPitch, true);
  v.setUint32(67, m.shotViewTick < 0 ? 0xffffffff : m.shotViewTick >>> 0, true);
  v.setUint8(71, Math.max(0, Math.min(255, m.shotViewGap | 0)));
  v.setUint8(72, Math.round(Math.max(0, Math.min(1, m.shotViewFrac)) * 255));
  return buf;
}

export function decodeInput(buf: ArrayBuffer, expectedRunId: string): InputMsg | null {
  if (buf.byteLength !== INPUT_BYTES) return null;
  const v = new DataView(buf);
  const runId = readRunId(v, 30);
  if (runId !== expectedRunId) return null;
  const flags = v.getUint8(48);
  const fire = v.getUint8(24);
  const shotButton = v.getUint8(58);
  if ((flags & ~7) !== 0 || (fire & ~7) !== 0 || (shotButton > 1 && shotButton !== 255)) return null;
  for (const offset of [4, 8, 12, 16, 20, 59, 63]) if (!Number.isFinite(v.getFloat32(offset, true))) return null;
  return {
    runId,
    seq: v.getUint32(0, true),
    x: v.getFloat32(4, true),
    y: v.getFloat32(8, true),
    z: v.getFloat32(12, true),
    yaw: v.getFloat32(16, true),
    pitch: v.getFloat32(20, true),
    fire,
    qPresses: v.getUint8(25),
    ePresses: v.getUint8(26),
    allyTargetId: v.getUint8(27),
    lastTeleportId: v.getUint16(28, true),
    item1Presses: v.getUint8(46),
    item2Presses: v.getUint8(47),
    mapHeld: (flags & 1) !== 0,
    qHeld: (flags & 2) !== 0,
    eHeld: (flags & 4) !== 0,
    leftPresses: v.getUint8(49),
    rightPresses: v.getUint8(50),
    viewTick: v.getUint32(51, true) === 0xffffffff ? -1 : v.getUint32(51, true),
    viewGap: v.getUint8(55),
    viewFrac: v.getUint8(56) / 255,
    shots: v.getUint8(57),
    shotButton,
    shotYaw: v.getFloat32(59, true),
    shotPitch: v.getFloat32(63, true),
    shotViewTick: v.getUint32(67, true) === 0xffffffff ? -1 : v.getUint32(67, true),
    shotViewGap: v.getUint8(71),
    shotViewFrac: v.getUint8(72) / 255,
  };
}

// ---------------------------------------------------------------- snapshots

/**
 * Run-scoped header, repeated in every part (rogue r01.md, R1.6); bytes 69–70 count the Watchman aims (protocol 13);
 * bytes 71–95 carry the Gatekeeper's encounter (protocol 21, rogue bosses.md §3.5).
 */
export const HEADER_BYTES = 96;
export const DOMINION_CAST_BYTES = 44;
/** The MVP's 28 bytes plus `revive` and `shots` (M8 §10), `shots2` and `beam` (M9 §10), `shotsDone` (netcode stage 3). */
export const PLAYER_BYTES = 41;
/** Netcode stage 3 added the enemy's HP (2 bytes), for the shooter's kill prediction. */
export const ENEMY_BYTES = 16;
/** An enemy HP above this is sent as it. */
export const HP_WIRE_MAX = 0xffff;
/** Netcode stage 4 added the owner's player ID (1 byte), so the Heretic's screen knows its own censers. */
export const PROJECTILE_BYTES = 10;
/** A projectile no player owns (an enemy's). */
export const PROJ_NO_OWNER = 255;
export const PICKUP_BYTES = 9;
export const MAX_SNAPSHOT_BYTES = 16000;
/** Positions of enemies and projectiles are sent in 1/64 m. */
export const POS_SCALE = 64;

export const PHASE_IDLE = 0;
export const PHASE_COMBAT = 1;
export const PHASE_CLEARED = 2;
/** The room countdown before it seals (M8 §5). */
export const PHASE_COUNTDOWN = 3;

/** Enemy `flags` bits. */
/** At most this many enemies per `damage` event (R06 follow-up §8); the largest hits first. */
export const DAMAGE_HITS_MAX = 24;
/** Numbers per hit in a `damage` event: slot, x, y, z, amount, killed. */
export const DAMAGE_STRIDE = 6;
/** Numbers per hit in a `hurt` event (R06 follow-up §9 option 1): x, y of the source, amount, kind. */
export const HURT_STRIDE = 4;
/** At most this many hits per `hurt` event; the largest first. */
export const HURT_HITS_MAX = 6;
/** A hurt's kind: struck up close, shot from range, or world damage with no direction (fire, Judgment). */
export const HURT_MELEE = 0, HURT_RANGED = 1, HURT_WORLD = 2;
export type HurtKind = typeof HURT_MELEE | typeof HURT_RANGED | typeof HURT_WORLD;

export const FLAG_HURT = 1;
/** Stunned by Blasphemy (M12 §5.3); the bit was Kiss of Betrayal's mark until M9. */
export const FLAG_STUNNED = 2;
export const FLAG_ROOTED = 4;
export const FLAG_SILENCED = 8;
export const FLAG_SLOWED = 16;
/** The enemy's target is overridden by Blasphemy (M8 §10). */
export const FLAG_TAUNTED = 32;

export interface SnapshotHeader {
  runId: string;
  stateRevision: number;
  tick: number;
  /** The room in countdown or combat, 255 for none (rogue game.md §14.3). */
  activeRoom: number;
  /** Its phase; PHASE_IDLE when no room is active. */
  activePhase: number;
  /** Bit i: room i is cleared. Every leaf derives from these three fields (rogue game.md §3.4). */
  clearedMask: number;
  /** Tenths of a second until the room seals, 0 outside the countdown (M8 §5). */
  countdown: number;
  /** Bit 7 waiting; bits 3–5 living humans in rect/vestibules; bits 0–2 living humans. */
  hold: number;
  enemiesRemaining: number;
  bossHp: number;
  bossMaxHp: number;
  bossCast: number;
  bossCastProgress: number;
  /** 1 or 2, + BOSS_PHASE_INVULNERABLE during the 1.5 s transition; 0 outside the fight. */
  bossPhase: number;
  /** Judgment's accepted damage toward its break, 0–255 of the threshold. */
  bossBreak: number;
  /** BOSS_FLAG_* bits. */
  bossFlags: number;
  /** The scheduled cycle's start tick (may be negative after an early transition). */
  bossCycleStart: number;
  /** The Toll's impact tick: announced during its tell, then the rolling ring's; 0 for none. */
  tollTick: number;
  /** The held player's ID, 255 for none; the Call's tell target, 255 for none. */
  heldPlayer: number;
  callTarget: number;
  /** The hold's deadline and start tick, 0 outside a hold. */
  heldUntil: number;
  heldSince: number;
  /** The transition's end tick, 0 outside it. */
  bossTransitionUntil: number;
}

/** The boss fields of the header. */
export type BossHeader = Pick<SnapshotHeader, 'bossHp' | 'bossMaxHp' | 'bossCast' | 'bossCastProgress' | 'bossPhase' | 'bossBreak' | 'bossFlags' |
  'bossCycleStart' | 'tollTick' | 'heldPlayer' | 'callTarget' | 'heldUntil' | 'heldSince' | 'bossTransitionUntil'>;

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
  /**
   * The player's own shot counter (client-timed shots, wrapping at 256) up to which the host has fired
   * or dropped every shot: the shooter's predicted damage of later shots isn't in this snapshot yet
   * (netcode stage 3).
   */
  shotsDone: number;
  wallet: number;
  carrySlot?: number;
  teleportId?: number;
}

/** Dense entity arrays for encoding; only the first `enemyCount` / `projectileCount` entries are used. */
export interface SnapshotEntities {
  dominionCasts?: readonly DominionCast[];
  commanderCasts?: readonly CommanderCast[];
  watchmanAims?: readonly WatchmanAim[];
  enemyCount: number;
  enemySlot: Uint16Array;
  enemyX: Float32Array;
  enemyY: Float32Array;
  /** type (low 4 bits) | state << 4 */
  enemyTypeState: Uint8Array;
  enemyFlags: Uint8Array;
  enemyZ: Float32Array;
  enemyIncarnation: Uint32Array;
  /** HP left, sent rounded up (netcode stage 3). */
  enemyHp: Float32Array;
  projectileCount: number;
  projSlot: Uint16Array;
  projKind: Uint8Array;
  /** The owner's player ID, PROJ_NO_OWNER for an enemy's. */
  projOwner: Uint8Array;
  projX: Float32Array;
  projY: Float32Array;
  projZ: Float32Array;
  pickupCount: number;
  pickupId: Uint32Array;
  pickupX: Float32Array;
  pickupY: Float32Array;
  pickupKind: Uint8Array;
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
  const family = e.commanderCasts ?? [];
  if (!validCommanderCasts(family, h.tick)) throw new Error('invalid commander casts');
  const casts = e.dominionCasts ?? [];
  if (casts.length > DOMINION_CAST_CAP || !validCasts(casts, h.tick)) throw new Error('invalid Dominion casts');
  const aims = e.watchmanAims ?? [];
  if (!validWatchmanAims(aims, h.tick)) throw new Error('invalid Watchman aims');
  const fixed = HEADER_BYTES + players.length * PLAYER_BYTES;
  if (players.length > 4 || e.enemyCount > MAX_LIVING_ENEMIES || e.projectileCount > 400 || e.pickupCount > PICKUP_CAP ||
    maxBytes > MAX_SNAPSHOT_BYTES || maxBytes < fixed) throw new Error('snapshot size out of range');
  const ranges: Array<[number, number, number, number]> = [];
  let ei = 0;
  let pi = 0;
  do {
    let cap = maxBytes - fixed;
    if (ranges.length === 0) cap -= e.pickupCount * PICKUP_BYTES + casts.length * DOMINION_CAST_BYTES + family.length * COMMANDER_BYTES + aims.length * WATCHMAN_BYTES;
    if (cap < 0) throw new Error('snapshot part too small');
    const ne = Math.max(0, Math.min(e.enemyCount - ei, Math.floor(cap / ENEMY_BYTES)));
    cap -= ne * ENEMY_BYTES;
    const np = Math.max(0, Math.min(e.projectileCount - pi, Math.floor(cap / PROJECTILE_BYTES)));
    if (ne === 0 && np === 0 && (ei < e.enemyCount || pi < e.projectileCount)) throw new Error('snapshot part too small');
    ranges.push([ei, ne, pi, np]);
    ei += ne;
    pi += np;
  } while (ei < e.enemyCount || pi < e.projectileCount);
  if (ranges.length > 4) throw new Error('too many snapshot parts');

  return ranges.map(([e0, ne, p0, np], partIndex) => {
    const nk = partIndex === 0 ? e.pickupCount : 0;
    const nc = partIndex === 0 ? casts.length : 0;
    const nf = partIndex === 0 ? family.length : 0;
    const nw = partIndex === 0 ? aims.length : 0;
    const buf = new ArrayBuffer(fixed + ne * ENEMY_BYTES + np * PROJECTILE_BYTES + nk * PICKUP_BYTES + nc * DOMINION_CAST_BYTES + nf * COMMANDER_BYTES + nw * WATCHMAN_BYTES);
    const v = new DataView(buf);
    v.setUint8(0, PROTOCOL_VERSION);
    v.setUint8(1, partIndex);
    v.setUint8(2, ranges.length);
    v.setUint8(3, players.length);
    writeRunId(v, 4, h.runId);
    v.setUint32(20, h.tick >>> 0, true);
    v.setUint32(24, h.stateRevision >>> 0, true);
    v.setUint8(28, h.activeRoom);
    v.setUint8(29, h.activePhase);
    v.setUint16(30, Math.min(0xffff, h.countdown), true);
    v.setUint8(32, h.hold);
    v.setUint32(33, h.clearedMask >>> 0, true);
    v.setUint16(37, Math.min(0xffff, h.enemiesRemaining), true);
    v.setUint32(39, Math.max(0, Math.ceil(h.bossHp)), true);
    v.setUint32(43, h.bossMaxHp, true);
    v.setUint8(47, h.bossCast);
    v.setUint8(48, h.bossCastProgress);
    v.setUint16(49, e.enemyCount, true);
    v.setUint16(51, e.projectileCount, true);
    v.setUint16(53, e.pickupCount, true);
    v.setUint16(55, ne, true);
    v.setUint16(57, np, true);
    v.setUint16(59, nk, true);
    v.setUint16(61, e0, true);
    v.setUint16(63, p0, true);
    v.setUint8(65, casts.length);
    v.setUint8(66, nc);
    v.setUint8(67, family.length); v.setUint8(68, nf);
    v.setUint8(69, aims.length); v.setUint8(70, nw);
    v.setUint8(71, h.bossPhase); v.setUint8(72, h.bossBreak); v.setUint8(73, h.bossFlags);
    v.setInt32(74, h.bossCycleStart | 0, true); v.setUint32(78, h.tollTick >>> 0, true);
    v.setUint8(82, h.heldPlayer); v.setUint8(83, h.callTarget);
    v.setUint32(84, h.heldUntil >>> 0, true); v.setUint32(88, h.heldSince >>> 0, true); v.setUint32(92, h.bossTransitionUntil >>> 0, true);
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
      v.setUint32(o + 32, p.wallet, true);
      v.setInt16(o + 36, p.carrySlot ?? -1, true); v.setUint16(o + 38, p.teleportId ?? 0, true);
      v.setUint8(o + 40, p.shotsDone & 0xff);
      o += PLAYER_BYTES;
    }
    for (let i = 0; i < nc; i++) {
      const c = casts[i];
      v.setUint16(o, c.slot, true); v.setUint32(o + 2, c.incarnation, true); v.setUint32(o + 6, c.castId, true);
      v.setUint32(o + 10, c.startTick, true); v.setUint32(o + 14, c.impactTick, true); v.setUint8(o + 18, c.room);
      v.setUint8(o + 19, c.leap ? 1 : 0);
      if (c.leap) ['fromX', 'fromY', 'fromZ', 'x', 'y', 'z'].forEach((key, j) => v.setFloat32(o + 20 + j * 4, c.leap![key as keyof NonNullable<typeof c.leap>], true));
      o += DOMINION_CAST_BYTES;
    }
    for (let i = 0; i < nf; i++) { writeCommander(v, o, family[i]); o += COMMANDER_BYTES; }
    for (let i = 0; i < nw; i++) { writeWatchman(v, o, aims[i]); o += WATCHMAN_BYTES; }
    for (let i = e0; i < e0 + ne; i++) {
      v.setUint16(o, e.enemySlot[i], true);
      v.setUint16(o + 2, pos16(e.enemyX[i]), true);
      v.setUint16(o + 4, pos16(e.enemyY[i]), true);
      v.setUint8(o + 6, e.enemyTypeState[i]);
      v.setUint8(o + 7, e.enemyFlags[i]);
      v.setUint16(o + 8, pos16(e.enemyZ[i]), true);
      v.setUint32(o + 10, e.enemyIncarnation[i], true);
      v.setUint16(o + 14, Math.max(0, Math.min(HP_WIRE_MAX, Math.ceil(e.enemyHp[i] - 1e-6))), true);
      o += ENEMY_BYTES;
    }
    for (let i = p0; i < p0 + np; i++) {
      v.setUint16(o, e.projSlot[i], true);
      v.setUint8(o + 2, e.projKind[i]);
      v.setUint16(o + 3, pos16(e.projX[i]), true);
      v.setUint16(o + 5, pos16(e.projY[i]), true);
      v.setUint16(o + 7, pos16(e.projZ[i]), true);
      v.setUint8(o + 9, e.projOwner[i]);
      o += PROJECTILE_BYTES;
    }
    for (let i = 0; i < nk; i++) {
      v.setUint32(o, e.pickupId[i], true);
      v.setUint16(o + 4, pos16(e.pickupX[i]), true);
      v.setUint16(o + 6, pos16(e.pickupY[i]), true);
      v.setUint8(o + 8, e.pickupKind[i]);
      o += PICKUP_BYTES;
    }
    return buf;
  });
}

/** A decoded snapshot part, or a whole snapshot after reassembly. */
export interface Snapshot extends SnapshotHeader {
  dominionCasts?: DominionCast[];
  commanderCasts?: CommanderCast[];
  totalCommanderCasts?: number;
  totalDominionCasts?: number;
  watchmanAims?: WatchmanAim[];
  totalWatchmanAims?: number;
  partIndex: number;
  partCount: number;
  totalEnemyCount: number;
  totalProjectileCount: number;
  totalPickupCount: number;
  pickupCount: number;
  enemyStart: number;
  projectileStart: number;
  players: SnapshotPlayer[];
  enemyCount: number;
  enemySlot: Uint16Array;
  enemyX: Float32Array;
  enemyY: Float32Array;
  enemyType: Uint8Array;
  enemyState: Uint8Array;
  enemyFlags: Uint8Array;
  enemyZ: Float32Array;
  enemyIncarnation: Uint32Array;
  /** HP left, rounded up; HP_WIRE_MAX for that much or more. */
  enemyHp: Uint16Array;
  projectileCount: number;
  projSlot: Uint16Array;
  projKind: Uint8Array;
  /** The owner's player ID, PROJ_NO_OWNER for an enemy's (netcode stage 4). */
  projOwner: Uint8Array;
  projX: Float32Array;
  projY: Float32Array;
  projZ: Float32Array;
  pickupId: Uint32Array;
  pickupX: Float32Array;
  pickupY: Float32Array;
  pickupKind: Uint8Array;
}

export function decodeSnapshot(buf: ArrayBuffer, expectedRunId?: string): Snapshot | null {
  if (buf.byteLength < HEADER_BYTES || buf.byteLength > MAX_SNAPSHOT_BYTES) return null;
  const v = new DataView(buf);
  if (v.getUint8(0) !== PROTOCOL_VERSION) return null;
  const runId = readRunId(v, 4);
  if (expectedRunId !== undefined && runId !== expectedRunId) return null;
  const partIndex = v.getUint8(1), partCount = v.getUint8(2), playerCount = v.getUint8(3);
  const totalEnemyCount = v.getUint16(49, true), totalProjectileCount = v.getUint16(51, true);
  const totalPickupCount = v.getUint16(53, true), pickupCount = v.getUint16(59, true);
  const ne = v.getUint16(55, true);
  const np = v.getUint16(57, true);
  const enemyStart = v.getUint16(61, true), projectileStart = v.getUint16(63, true);
  const totalDominionCasts = v.getUint8(65), nc = v.getUint8(66);
  const totalCommanderCasts = v.getUint8(67), nf = v.getUint8(68);
  if (totalCommanderCasts > COMMANDER_RECORD_CAP || nf !== (partIndex === 0 ? totalCommanderCasts : 0)) return null;
  const totalWatchmanAims = v.getUint8(69), nw = v.getUint8(70);
  if (totalWatchmanAims > WATCHMAN_RECORD_CAP || nw !== (partIndex === 0 ? totalWatchmanAims : 0)) return null;
  if (playerCount > 4 || partCount === 0 || partCount > 4 || partIndex >= partCount ||
    totalEnemyCount > MAX_LIVING_ENEMIES || totalProjectileCount > 400 || totalPickupCount > PICKUP_CAP ||
    enemyStart + ne > totalEnemyCount || projectileStart + np > totalProjectileCount ||
    pickupCount !== (partIndex === 0 ? totalPickupCount : 0) || totalDominionCasts > DOMINION_CAST_CAP || nc !== (partIndex === 0 ? totalDominionCasts : 0) ||
    (partIndex === 0 && (enemyStart !== 0 || projectileStart !== 0))) return null;
  if (partCount === 1 && (ne !== totalEnemyCount || np !== totalProjectileCount)) return null;
  if (buf.byteLength !== HEADER_BYTES + playerCount * PLAYER_BYTES + ne * ENEMY_BYTES + np * PROJECTILE_BYTES + pickupCount * PICKUP_BYTES + nc * DOMINION_CAST_BYTES + nf * COMMANDER_BYTES + nw * WATCHMAN_BYTES) return null;
  const ids = new Set<number>();
  for (let i = 0; i < playerCount; i++) {
    const o = HEADER_BYTES + i * PLAYER_BYTES;
    const id = v.getUint8(o);
    if (id >= 4 || ids.has(id)) return null;
    ids.add(id);
    for (const offset of [1, 5, 9, 13]) if (!Number.isFinite(v.getFloat32(o + offset, true))) return null;
  }
  const s: Snapshot = {
    runId,
    totalDominionCasts, dominionCasts: [], totalCommanderCasts, commanderCasts: [], totalWatchmanAims, watchmanAims: [],
    stateRevision: v.getUint32(24, true),
    tick: v.getUint32(20, true),
    partIndex, partCount, totalEnemyCount, totalProjectileCount, totalPickupCount, pickupCount, enemyStart, projectileStart,
    activeRoom: v.getUint8(28),
    activePhase: v.getUint8(29),
    clearedMask: v.getUint32(33, true),
    countdown: v.getUint16(30, true),
    hold: v.getUint8(32),
    enemiesRemaining: v.getUint16(37, true),
    bossHp: v.getUint32(39, true),
    bossMaxHp: v.getUint32(43, true),
    bossCast: v.getUint8(47),
    bossCastProgress: v.getUint8(48),
    bossPhase: v.getUint8(71), bossBreak: v.getUint8(72), bossFlags: v.getUint8(73),
    bossCycleStart: v.getInt32(74, true), tollTick: v.getUint32(78, true),
    heldPlayer: v.getUint8(82), callTarget: v.getUint8(83),
    heldUntil: v.getUint32(84, true), heldSince: v.getUint32(88, true), bossTransitionUntil: v.getUint32(92, true),
    players: [],
    enemyCount: ne,
    enemySlot: new Uint16Array(ne),
    enemyX: new Float32Array(ne),
    enemyY: new Float32Array(ne),
    enemyType: new Uint8Array(ne),
    enemyState: new Uint8Array(ne),
    enemyFlags: new Uint8Array(ne),
    enemyZ: new Float32Array(ne),
    enemyIncarnation: new Uint32Array(ne),
    enemyHp: new Uint16Array(ne),
    projectileCount: np,
    projSlot: new Uint16Array(np),
    projKind: new Uint8Array(np),
    projOwner: new Uint8Array(np),
    projX: new Float32Array(np),
    projY: new Float32Array(np),
    projZ: new Float32Array(np),
    pickupId: new Uint32Array(pickupCount),
    pickupX: new Float32Array(pickupCount),
    pickupY: new Float32Array(pickupCount),
    pickupKind: new Uint8Array(pickupCount),
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
      wallet: v.getUint32(o + 32, true),
      carrySlot: v.getInt16(o + 36, true), teleportId: v.getUint16(o + 38, true),
      shotsDone: v.getUint8(o + 40),
    });
    o += PLAYER_BYTES;
  }
  for (let i = 0; i < nc; i++) {
    const kind = v.getUint8(o + 19);
    if (kind > 1 || kind === 0 && Array.from({ length: 6 }, (_, j) => v.getFloat32(o + 20 + j * 4, true)).some((n) => n !== 0)) return null;
    s.dominionCasts!.push({ slot: v.getUint16(o, true), incarnation: v.getUint32(o + 2, true), castId: v.getUint32(o + 6, true),
      startTick: v.getUint32(o + 10, true), impactTick: v.getUint32(o + 14, true), room: v.getUint8(o + 18),
      ...(kind ? { leap: { fromX: v.getFloat32(o + 20, true), fromY: v.getFloat32(o + 24, true), fromZ: v.getFloat32(o + 28, true), x: v.getFloat32(o + 32, true), y: v.getFloat32(o + 36, true), z: v.getFloat32(o + 40, true) } } : {}) });
    o += DOMINION_CAST_BYTES;
  }
  if (!validCasts(s.dominionCasts!, s.tick)) return null;
  for (let i = 0; i < nf; i++) { const c = readCommander(v, o); if (!c) return null; s.commanderCasts!.push(c); o += COMMANDER_BYTES; }
  if (!validCommanderCasts(s.commanderCasts!, s.tick) || s.players.some((p) => p.carrySlot! < -1 || p.carrySlot! >= ENEMY_SLOTS)) return null;
  for (let i = 0; i < nw; i++) { const a = readWatchman(v, o); if (!a) return null; s.watchmanAims!.push(a); o += WATCHMAN_BYTES; }
  if (!validWatchmanAims(s.watchmanAims!, s.tick)) return null;
  for (let i = 0; i < ne; i++) {
    s.enemySlot[i] = v.getUint16(o, true);
    s.enemyX[i] = v.getUint16(o + 2, true) / POS_SCALE;
    s.enemyY[i] = v.getUint16(o + 4, true) / POS_SCALE;
    const ts = v.getUint8(o + 6);
    s.enemyType[i] = ts & 0x0f;
    s.enemyState[i] = ts >> 4;
    s.enemyFlags[i] = v.getUint8(o + 7);
    s.enemyZ[i] = v.getUint16(o + 8, true) / POS_SCALE;
    s.enemyIncarnation[i] = v.getUint32(o + 10, true);
    s.enemyHp[i] = v.getUint16(o + 14, true);
    if (s.enemySlot[i] >= ENEMY_SLOTS || s.enemyIncarnation[i] === 0 || s.enemyType[i] >= ENEMIES.length || s.enemyState[i] > 4 || (s.enemyFlags[i] & ~(s.enemyType[i] === BOSS_PART ? 63 | FLAG_PART_SEAL : 63)) !== 0) return null;
    o += ENEMY_BYTES;
  }
  for (let i = 0; i < np; i++) {
    s.projSlot[i] = v.getUint16(o, true);
    s.projKind[i] = v.getUint8(o + 2);
    s.projX[i] = v.getUint16(o + 3, true) / POS_SCALE;
    s.projY[i] = v.getUint16(o + 5, true) / POS_SCALE;
    s.projZ[i] = v.getUint16(o + 7, true) / POS_SCALE;
    s.projOwner[i] = v.getUint8(o + 9);
    if (s.projSlot[i] >= PROJECTILE_SLOTS) return null;
    o += PROJECTILE_BYTES;
  }
  for (let i = 0; i < pickupCount; i++) {
    s.pickupId[i] = v.getUint32(o, true);
    s.pickupX[i] = v.getUint16(o + 4, true) / POS_SCALE;
    s.pickupY[i] = v.getUint16(o + 6, true) / POS_SCALE;
    s.pickupKind[i] = v.getUint8(o + 8);
    if (s.pickupId[i] === 0 || s.pickupKind[i] >= PICKUP_KIND_COUNT) return null;
    o += PICKUP_BYTES;
  }
  if (new Set(s.enemySlot).size !== ne || new Set(s.projSlot).size !== np || new Set(s.pickupId).size !== pickupCount) return null;
  if (partCount === 1 && !castsMatchEnemies(s)) return null;
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
    enemyZ: new Float32Array(ne),
    enemyIncarnation: new Uint32Array(ne),
    enemyHp: new Uint16Array(ne),
    projectileCount: np,
    projSlot: new Uint16Array(np),
    projKind: new Uint8Array(np),
    projOwner: new Uint8Array(np),
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
    s.enemyZ.set(p.enemyZ, eo);
    s.enemyIncarnation.set(p.enemyIncarnation, eo);
    s.enemyHp.set(p.enemyHp, eo);
    eo += p.enemyCount;
    s.projSlot.set(p.projSlot, po);
    s.projKind.set(p.projKind, po);
    s.projOwner.set(p.projOwner, po);
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
  private runId = '';
  private readonly pending = new Map<number, Array<Snapshot | undefined>>();
  private readonly received = new Map<number, number>();
  private readonly invalid = new Map<number, number>();

  reset(runId: string): void {
    this.runId = runId;
    this.newestCompleteTick = -1;
    this.pending.clear();
    this.received.clear();
    this.invalid.clear();
  }

  private invalidate(tick: number, now: number): null {
    this.pending.delete(tick);
    this.received.delete(tick);
    this.invalid.set(tick, now);
    if (this.invalid.size > 4) this.invalid.delete(this.invalid.keys().next().value!);
    return null;
  }

  /** Adds a part; returns the complete snapshot when this part completes a tick. */
  add(part: Snapshot, now = performance.now()): Snapshot | null {
    for (const [tick, received] of this.received) if (now - received >= 500) { this.pending.delete(tick); this.received.delete(tick); }
    for (const [tick, received] of this.invalid) if (now - received >= 500) this.invalid.delete(tick);
    // Check identity before allocating pending state or touching the watermark.
    if (part.runId !== this.runId || part.tick <= this.newestCompleteTick || this.invalid.has(part.tick)) return null;
    if (part.partCount === 0 || part.partCount > 4 || part.partIndex >= part.partCount) return null;
    let parts = this.pending.get(part.tick);
    if (!parts) {
      if (this.pending.size >= 4) {
        const oldest = this.received.keys().next().value!;
        this.pending.delete(oldest); this.received.delete(oldest);
      }
      parts = new Array<Snapshot | undefined>(part.partCount);
      this.pending.set(part.tick, parts);
      this.received.set(part.tick, now);
    }
    if (parts.length !== part.partCount) return this.invalidate(part.tick, now);
    const sibling = parts.find((p) => p !== undefined);
    if (sibling) {
      for (const key of SHARED_HEADER) if (sibling[key] !== part[key]) return this.invalidate(part.tick, now);
      if (sibling.players.length !== part.players.length) return this.invalidate(part.tick, now);
      for (let i = 0; i < part.players.length; i++) {
        for (const key of Object.keys(sibling.players[i]) as Array<keyof SnapshotPlayer>) {
          if (sibling.players[i][key] !== part.players[i][key]) return this.invalidate(part.tick, now);
        }
      }
    }
    const duplicate = parts[part.partIndex];
    if (duplicate) {
      for (const key of Object.keys(part) as Array<keyof Snapshot>) {
        if (key === 'players') continue;
        if (key === 'dominionCasts' || key === 'commanderCasts' || key === 'watchmanAims') {
          if (JSON.stringify(duplicate[key]) !== JSON.stringify(part[key])) return this.invalidate(part.tick, now);
          continue;
        }
        const a = duplicate[key], b = part[key];
        if (ArrayBuffer.isView(a) && ArrayBuffer.isView(b)) {
          const av = a as unknown as ArrayLike<number>, bv = b as unknown as ArrayLike<number>;
          if (av.length !== bv.length || Array.from(av).some((v, i) => v !== bv[i])) return this.invalidate(part.tick, now);
        } else if (a !== b) return this.invalidate(part.tick, now);
      }
      return null;
    }
    parts[part.partIndex] = part;
    for (let i = 0; i < parts.length; i++) if (!parts[i]) return null;
    const complete = parts as Snapshot[];
    if (complete.reduce((n, p) => n + p.enemyCount, 0) !== part.totalEnemyCount ||
      complete.reduce((n, p) => n + p.projectileCount, 0) !== part.totalProjectileCount ||
      complete.reduce((n, p) => n + p.pickupCount, 0) !== part.totalPickupCount) return this.invalidate(part.tick, now);
    let ei = 0, pi = 0;
    const enemySlots = new Set<number>(), projectileSlots = new Set<number>();
    for (const p of complete) {
      if (p.enemyStart !== ei || p.projectileStart !== pi) return this.invalidate(part.tick, now);
      ei += p.enemyCount; pi += p.projectileCount;
      for (const s of p.enemySlot) { if (enemySlots.has(s)) return this.invalidate(part.tick, now); enemySlots.add(s); }
      for (const s of p.projSlot) { if (projectileSlots.has(s)) return this.invalidate(part.tick, now); projectileSlots.add(s); }
    }
    const snapshot = concatParts(complete);
    if (!castsMatchEnemies(snapshot)) return this.invalidate(part.tick, now);
    this.newestCompleteTick = part.tick;
    for (const t of this.pending.keys()) if (t <= part.tick) { this.pending.delete(t); this.received.delete(t); }
    for (const t of this.invalid.keys()) if (t <= part.tick) this.invalid.delete(t);
    return snapshot;
  }

  /** Number of incomplete ticks kept. */
  get pendingTicks(): number {
    return this.pending.size;
  }
}

const SHARED_HEADER = ['runId', 'tick', 'stateRevision', 'activeRoom', 'activePhase', 'countdown', 'hold',
  'clearedMask', 'enemiesRemaining', 'bossHp', 'bossMaxHp', 'bossCast', 'bossCastProgress',
  'bossPhase', 'bossBreak', 'bossFlags', 'bossCycleStart', 'tollTick', 'heldPlayer', 'callTarget', 'heldUntil', 'heldSince', 'bossTransitionUntil',
  'totalEnemyCount', 'totalProjectileCount', 'totalPickupCount', 'totalDominionCasts', 'totalCommanderCasts', 'totalWatchmanAims'] as const;

/** Bounded authoritative records; active only before their accepted impact deadline. */
export function validCasts(casts: readonly DominionCast[], tick: number): boolean {
  if (!Array.isArray(casts) || !Number.isInteger(tick) || tick < 0 || tick > 0xffffffff || casts.some((c) => !c || typeof c !== 'object')) return false;
  return casts.length <= DOMINION_CAST_CAP && new Set(casts.map((c) => c.slot)).size === casts.length && new Set(casts.map((c) => c.castId)).size === casts.length &&
    casts.every((c) => Number.isInteger(c.slot) && c.slot >= 0 && c.slot < ENEMY_SLOTS && Number.isInteger(c.room) && c.room >= 0 && c.room < 32 &&
      [c.incarnation, c.castId].every((n) => Number.isInteger(n) && n > 0 && n <= 0xffffffff) && Number.isInteger(c.startTick) && c.startTick >= 0 && c.startTick <= tick &&
      Number.isInteger(c.impactTick) && c.impactTick <= 0xffffffff && c.impactTick > tick && c.impactTick - c.startTick === DOMINION_TELL_TICKS &&
      (c.leap === undefined || c.leap !== null && typeof c.leap === 'object' &&
        [c.leap.fromX, c.leap.fromY, c.leap.x, c.leap.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 2048) &&
        [c.leap.fromZ, c.leap.z].every((n) => Number.isFinite(n) && n >= -64 && n <= 256) &&
        Math.hypot(c.leap.x - c.leap.fromX, c.leap.y - c.leap.fromY) >= DOMINION_LEAP_MIN_RANGE - 0.001 && Math.hypot(c.leap.x - c.leap.fromX, c.leap.y - c.leap.fromY) <= DOMINION_LEAP_MAX_RANGE + 0.001));
}
function castsMatchEnemies(s: Snapshot): boolean {
  // A Watchman record attaches only to the live incarnation of a Watchman slot.
  if ((s.watchmanAims ?? []).length !== (s.totalWatchmanAims ?? 0) || !(s.watchmanAims ?? []).every((a) => {
    const i = s.enemySlot.indexOf(a.slot);
    return i >= 0 && s.enemyType[i] === WATCHMAN && s.enemyIncarnation[i] === a.incarnation;
  })) return false;
  if ((s.commanderCasts ?? []).length !== (s.totalCommanderCasts ?? 0) || !(s.commanderCasts ?? []).every((c) => {
    const i = s.enemySlot.indexOf(c.slot);
    return i >= 0 && s.enemyType[i] === (c.kind === 'beam' ? CANTOR : CARRIER) && s.enemyIncarnation[i] === c.incarnation;
  }) || s.players.some((p) => (p.carrySlot ?? -1) >= 0 && !(s.commanderCasts ?? []).some((c) => c.slot === p.carrySlot && c.phase === 'carry' && c.kind === 'carry' && c.targetId === p.id))) return false;
  return (s.dominionCasts ?? []).every((c) => {
    const i = s.enemySlot.indexOf(c.slot);
    return i >= 0 && s.enemyType[i] === DOMINION && s.enemyState[i] === ST_WINDUP && s.enemyIncarnation[i] === c.incarnation;
  });
}
