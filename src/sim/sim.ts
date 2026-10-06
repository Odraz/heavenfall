/** The host simulation: pure TypeScript, no three.js or DOM (§2.2). */
import { CLASSES, type ClassId } from '../data/classes';
import type { DungeonDef } from '../data/dungeons/types';
import {
  BLESSED,
  CHERUB,
  CHERUB_CLIMB,
  CHERUB_HOVER,
  CHORISTER,
  ENEMIES,
  GATEKEEPER,
  ST_ATTACKING,
  ST_FALLING,
  ST_IDLE,
  ST_MOVING,
  ST_WINDUP,
} from '../data/enemies';
import {
  ABILITIES,
  BLASPHEMY_DURATION,
  BLASPHEMY_RADIUS,
  CENSER_BLAST,
  CENSER_RADIUS,
  CENSER_SPEED,
  CENSER_SPLASH_DAMAGE,
  CENSER_SPLASH_MAX,
  CHAINS_ANGLE,
  CHAINS_MAX,
  CHAINS_PULL_TIME,
  CHAINS_RANGE,
  CHAINS_ROOT,
  CHAINS_STEP,
  COMMUNION_HEAL,
  COMMUNION_RADIUS,
  DISCORD_RADIUS,
  DISCORD_RANGE,
  DISCORD_SILENCE,
  FALLING_STAR_DAMAGE,
  FALLING_STAR_RADIUS,
  FALLING_STAR_TIME,
  KISS_DURATION,
  KISS_RANGE,
  KNOCKBACK_DIST,
  KNOCKBACK_TIME,
  MOVEMENT_GRACE,
  MOVEMENT_SPEED_CHECK_SKIP,
  SHADOWSTEP_INVULN,
  SHROUD_AMOUNT,
  SHROUD_DURATION,
  SCOURGE_HALF_ARC,
  SLOW_FACTOR,
  ATTACK_NONE,
  ATTACK_PRIMARY,
  attackDef,
  chooseAttack,
  SECONDARIES,
  WEAPONS,
  type AttackSlot,
} from '../data/weapons';
import type { GameEvent } from '../net/messages';
import {
  ALLY_NONE,
  encodeSnapshot,
  FLAG_HURT,
  FLAG_MARKED,
  FLAG_ROOTED,
  FLAG_SILENCED,
  FLAG_SLOWED,
  FLAG_TAUNTED,
  PHASE_CLEARED,
  PHASE_COMBAT,
  PHASE_COUNTDOWN,
  PHASE_IDLE,
  type InputMsg,
  type SnapshotEntities,
  type SnapshotHeader,
  type SnapshotPlayer,
} from '../net/protocol';
import {
  ENEMY_SLOTS,
  EPS,
  MAX_LIVING_ENEMIES,
  PLAYER_EYE,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SLOTS,
  PROJECTILE_SLOTS,
  SLOT_REUSE_TICKS,
  STEP_UP,
  TICK_DT,
  TICK_HZ,
  TICK_MS,
  WALL_TOP,
} from './constants';
import { aimDir, rayCylinder, silverBulletHits } from './combat';
import { FlowField, UNREACHABLE } from './flowfield';
import { lineOfSight, raycastTerrain } from './los';
import { insideRect, isSolid, loadMap, setArenaDoors, type GameMap } from './map';
import { distToCylinder, groundHeight, moveHorizontal, stepBody, tryDisplace, type Body, type MoveResult } from './movement';
import { mulberry32 } from './rng';
import { REVIVE_CENSER_RADIUS, REVIVE_COMMUNION, REVIVE_DECAY, REVIVE_HP, REVIVE_INVULNERABLE, reviveHit, SOUL_HEIGHT, SOUL_RADIUS, soulRise, SOUL_RISE_TIME } from './souls';

/** Party-size multipliers ×10 (§7.5), indexed by party size. */
const MULT10 = [0, 4, 6, 8, 10];

/** The party-size multiplier (§7.5). */
export function partyMultiplier(partySize: number): number {
  return MULT10[Math.max(1, Math.min(4, partySize))] / 10;
}

/** Scales one enemy count for the party size, rounding up (§7.5). */
export function scaleCount(count: number, partySize: number): number {
  const m = MULT10[Math.max(1, Math.min(4, partySize))];
  return Math.ceil((count * m) / 10);
}

export interface SimPlayerInit {
  /** The player ID, which is also its index: its spawn and entry cells (M8 §6.2). */
  id: number;
  name: string;
  classId: ClassId;
}

export interface SimOptions {
  dungeon: DungeonDef;
  /** Players at `go`; each one's index is its ID (M8 §6.2). */
  players: SimPlayerInit[];
  seed: number;
  /** Every player is invulnerable (`god=1`). */
  god?: boolean;
  /** Benchmark mode (§2.5). */
  bench?: boolean;
  /** Singleplayer: enables health regeneration (§5.7). */
  singleplayer?: boolean;
  /** Arena waves are disabled (tests). */
  noWaves?: boolean;
}

export interface SimEvent {
  to: number | 'all';
  event: GameEvent;
}

export interface SimPlayer {
  id: number;
  /** Equal to the ID (M8 §6.2). */
  index: number;
  name: string;
  classId: ClassId;
  speed: number;
  maxHp: number;
  hp: number;
  shield: number;
  /** Tick at which the shield expires. */
  shieldUntil: number;
  dead: boolean;
  connected: boolean;
  /** Invulnerable for the whole game (`god=1`, benchmark). */
  god: boolean;
  /** Dev key G toggle. */
  devGod: boolean;
  /** Invulnerable while tick < invulUntil (Falling Star, Shadowstep). */
  invulUntil: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  /** The held mouse buttons, as sent in the input's `fire` bits (M9 §10). */
  fire: number;
  /** One fire timer for both attacks (M9 §2.2). */
  fireTimer: number;
  qPresses: number;
  ePresses: number;
  allyTargetId: number;
  /** Presses seen since the last tick, resolved on the next tick. */
  pendingQ: boolean;
  pendingE: boolean;
  /** The allyTargetId sent with the E press. */
  pendingEAlly: number;
  /** Tick of a pending Falling Star landing, or -1. */
  landingTick: number;
  kills: number;
  /** Primary attacks fired, for others' shot sounds (M8 §9.1); wrapped only in snapshots. */
  shots: number;
  /** Secondary attacks fired (M9 §10). */
  shots2: number;
  /** The ally Sacrament last healed, sent as the `beam` while tick < beamUntil (M9 §2.5). */
  beamId: number;
  beamUntil: number;
  /** Revive progress of the player's soul, 0–1, while dead (M8 §4.2). */
  revive: number;
  /** Tick the soul started rising (the death); its ground point is the dead player's feet. */
  soulTick: number;
  /** Seconds of cooldown remaining. */
  cdQ: number;
  cdE: number;
  /** Tick of the last hit that did damage after invulnerability (for regeneration). */
  lastDamageTick: number;
  /** Highest accepted input sequence number, or -1. */
  lastSeq: number;
  /** Host time (ms) when the previous accepted input arrived, or the latest teleport. */
  lastAcceptMs: number;
  /** The host's latest teleport ID for this player. */
  teleportId: number;
  /** Speed check skipped until this host time (ms). */
  speedCheckSkipUntil: number;
}

interface SpawnBatch {
  counts: number[];
  spawned: number[];
  /** Wave index, or -1 for benchmark top-ups and summons. */
  wave: number;
}

interface ArenaState {
  phase: number;
  /** Index of the latest started wave, or -1. */
  wave: number;
  waveStartTick: number;
  queue: SpawnBatch[];
  /** Round-robin position over the spawn points. */
  rr: number;
  budgets: Float64Array;
  waveTotals: number[];
  waveAlive: number[];
  waveFullySpawned: boolean[];
  /** Living enemies belonging to this arena (not counting the Gatekeeper). */
  alive: number;
  /** During the countdown: the tick the arena seals (M8 §5). */
  sealTick: number;
  /** Players in the game when it sealed, for party-size scaling (M8 §6.3); 0 before. */
  partySize: number;
}

/** Projectile kinds, as encoded in snapshots (§9.4). */
export const PROJ_CENSER = 0;
export const PROJ_ORB = 1;
export const PROJ_ARROW = 2;
const MAX_PROJECTILES = 400;
const PROJECTILE_RANGE = 60;

/** Enemy type order for spawning ties: Blessed, Choristers, Cherubs. */
const SPAWN_TYPES = [BLESSED, CHORISTER, CHERUB];
const SPAWN_ELIGIBLE_DIST = 8;
/** Enemies per second each spawn point can place (§8.2 says 50; lowered after playtesting, see decisions.md). */
export const SPAWN_RATE = 10;
const BUDGET_PER_TICK = SPAWN_RATE / TICK_HZ;
const BUDGET_MAX = 2;
const WAVE_NEXT_FRACTION = 0.2;
const WAVE_NEXT_TICKS = 20 * TICK_HZ;
const RETARGET_TICKS = TICK_HZ;
/** Line of sight is checked at most twice per second per enemy. */
const LOS_TICKS = TICK_HZ / 2;
const MAX_SEPARATION_NEIGHBORS = 8;

// Enemy behavior (§7.1).
const BLESSED_STOP = 1.0;
const MELEE_RANGE = 1.2;
const MELEE_HEIGHT = 1.5;
const MELEE_DAMAGE = 5;
const MELEE_FIRST = 0.5;
const MELEE_INTERVAL = 1.0;
const CHORISTER_RANGE = 20;
const CHERUB_RANGE = 25;
const CHERUB_STRAFE_SPEED = 2;
const CHERUB_STRAFE_SWITCH = 2;

interface CasterDef {
  range: number;
  windup: number;
  recovery: number;
  kind: number;
  speed: number;
  damage: number;
  radius: number;
}

const CASTERS: Record<number, CasterDef> = {
  [CHORISTER]: { range: CHORISTER_RANGE, windup: 1.0, recovery: 1.5, kind: PROJ_ORB, speed: 12, damage: 12, radius: 0.3 },
  [CHERUB]: { range: CHERUB_RANGE, windup: 0.5, recovery: 1.3, kind: PROJ_ARROW, speed: 25, damage: 8, radius: 0.15 },
};

// The Gatekeeper (§7.4).
const BOSS_EYE = 5;
const VOLLEY_FIRST = 2;
const VOLLEY_INTERVAL = 4;
const VOLLEY_WINDUP = 0.5;
const VOLLEY_ORBS = 8;
const VOLLEY_SPREAD = (25 * Math.PI) / 180;
const VOLLEY_ORB = { speed: 12, damage: 15, radius: 0.3 };
const JUDGMENT_FIRST = 20;
const JUDGMENT_INTERVAL = 25;
const JUDGMENT_CAST = 3;
const JUDGMENT_INTERRUPT = 2000;
const SUMMON_FIRST = 30;
const SUMMON_INTERVAL = 30;
const SUMMON = { blessed: 150, cherubs: 10 };

/** Gatekeeper casts, as sent in snapshots (§9.4). */
export const BOSS_CAST_NONE = 0;
export const BOSS_CAST_VOLLEY = 1;
export const BOSS_CAST_JUDGMENT = 2;

/** The arena countdown (M8 §5): 60 s, cut to 5 s once every living player is inside. */
const COUNTDOWN = 60;
const COUNTDOWN_ALL_IN = 5;

const REGEN_DELAY_TICKS = 8 * TICK_HZ;
const REGEN_FRACTION = 0.015;
/** Bound enemies take this much damage (M8 §8). */
const BOUND_FACTOR = 2;
/** Sacrament's `beam` stays on this long after its last firing (M9 §2.5). */
const BEAM_HOLD_TICKS = Math.round(0.6 * TICK_HZ);

const ticks = (seconds: number) => Math.round(seconds * TICK_HZ);

export class Simulation {
  readonly map: GameMap;
  /** The players in the game, sorted by ID. */
  readonly players: SimPlayer[] = [];
  /** The players by index, which is their ID (M8 §6.2); empty slots are undefined. */
  readonly slots: Array<SimPlayer | undefined> = new Array(PLAYER_SLOTS).fill(undefined);
  readonly bench: boolean;
  readonly noWaves: boolean;
  readonly singleplayer: boolean;
  /** Every player is invulnerable (`god=1`). */
  private readonly god: boolean;
  /** Seeded PRNG for all simulation randomness (§2.2); tests may replace it. */
  random: () => number;
  /** Ticks simulated so far; the tick being simulated during step(). */
  tick = 0;
  /** Host time of the current tick, ms. */
  nowMs = 0;
  readonly events: SimEvent[] = [];
  readonly arenas: ArenaState[];
  /** The run's result, once decided; the simulation stops then. */
  result: null | 'victory' | 'defeat' = null;

  // Enemies, structure of arrays indexed by slot.
  readonly eAlive = new Uint8Array(ENEMY_SLOTS);
  readonly eType = new Uint8Array(ENEMY_SLOTS);
  readonly eState = new Uint8Array(ENEMY_SLOTS);
  readonly eX = new Float64Array(ENEMY_SLOTS);
  readonly eY = new Float64Array(ENEMY_SLOTS);
  readonly eZ = new Float64Array(ENEMY_SLOTS);
  /** Position at the start of the current tick, for limiting separation pushes. */
  private readonly eStartX = new Float64Array(ENEMY_SLOTS);
  private readonly eStartY = new Float64Array(ENEMY_SLOTS);
  readonly eVz = new Float64Array(ENEMY_SLOTS);
  readonly eGrounded = new Uint8Array(ENEMY_SLOTS);
  readonly eHp = new Float64Array(ENEMY_SLOTS);
  readonly eTarget = new Int8Array(ENEMY_SLOTS);
  readonly eArena = new Int8Array(ENEMY_SLOTS);
  readonly eWave = new Int16Array(ENEMY_SLOTS);
  readonly eLos = new Uint8Array(ENEMY_SLOTS);
  readonly eStrafe = new Int8Array(ENEMY_SLOTS);
  readonly eStrafeT = new Float64Array(ENEMY_SLOTS);
  readonly eHurtTick = new Int32Array(ENEMY_SLOTS).fill(-1);
  readonly eFreedTick = new Int32Array(ENEMY_SLOTS);
  // Status effects: active while tick < until (§5.6).
  readonly eSlowUntil = new Int32Array(ENEMY_SLOTS);
  readonly eRootUntil = new Int32Array(ENEMY_SLOTS);
  readonly eSilenceUntil = new Int32Array(ENEMY_SLOTS);
  readonly eTauntUntil = new Int32Array(ENEMY_SLOTS);
  /** Knocked back on ticks kbFrom < tick ≤ kbUntil. */
  readonly eKbUntil = new Int32Array(ENEMY_SLOTS);
  private readonly eKbFrom = new Int32Array(ENEMY_SLOTS);
  private readonly eKbVx = new Float64Array(ENEMY_SLOTS);
  private readonly eKbVy = new Float64Array(ENEMY_SLOTS);
  /** Chains pull: start tick (-1 = none), from and to. */
  readonly ePullStart = new Int32Array(ENEMY_SLOTS).fill(-1);
  private readonly ePull = new Float64Array(ENEMY_SLOTS * 6);
  // Casts and melee (§7.1).
  /** 1 while winding up a cast. */
  readonly eCast = new Uint8Array(ENEMY_SLOTS);
  readonly eCastT = new Float64Array(ENEMY_SLOTS);
  /** Seconds until the next cast may start. */
  readonly eCastCd = new Float64Array(ENEMY_SLOTS);
  /** Seconds until the next melee hit while in range; -1 when out of range. */
  readonly eMeleeNext = new Float64Array(ENEMY_SLOTS).fill(-1);
  /** The one marked enemy (Kiss of Betrayal), or -1. */
  markSlot = -1;
  markUntil = 0;

  // The Gatekeeper (§7.4). Timers are ticks.
  /** The living Gatekeeper's slot, or -1. */
  bossSlot = -1;
  bossMaxHp = 0;
  /** BOSS_CAST_*: the cast in progress. */
  bossCast = BOSS_CAST_NONE;
  /** Ticks since the cast in progress started. */
  bossCastTicks = 0;
  volleyDue = 0;
  judgmentDue = 0;
  summonDue = 0;
  /** Damage taken during the Judgment cast in progress (after step 1 of §5.5). */
  private judgmentDamage = 0;
  /** The Gatekeeper died this tick or since the last one (dev key K); the run ends in victory. */
  private bossKilled = false;
  /** The boss arena's party size, for the Judgment interrupt threshold and summons (M8 §6.3). */
  private bossParty = 1;

  /** Dense list of living enemy slots. */
  readonly active = new Int32Array(ENEMY_SLOTS);
  activeCount = 0;
  private readonly activePos = new Int32Array(ENEMY_SLOTS).fill(-1);
  /** Living enemies, not counting the Gatekeeper. */
  living = 0;
  private readonly freeFifo = new Int32Array(ENEMY_SLOTS);
  private freeHead = 0;
  private freeCount = 0;
  private nextFresh = 0;

  // Projectiles (§5.4).
  readonly pAlive = new Uint8Array(PROJECTILE_SLOTS);
  readonly pKind = new Uint8Array(PROJECTILE_SLOTS);
  readonly pX = new Float64Array(PROJECTILE_SLOTS);
  readonly pY = new Float64Array(PROJECTILE_SLOTS);
  readonly pZ = new Float64Array(PROJECTILE_SLOTS);
  private readonly pDx = new Float64Array(PROJECTILE_SLOTS);
  private readonly pDy = new Float64Array(PROJECTILE_SLOTS);
  private readonly pDz = new Float64Array(PROJECTILE_SLOTS);
  private readonly pSpeed = new Float64Array(PROJECTILE_SLOTS);
  private readonly pRadius = new Float64Array(PROJECTILE_SLOTS);
  private readonly pDamage = new Float64Array(PROJECTILE_SLOTS);
  readonly pTraveled = new Float64Array(PROJECTILE_SLOTS);
  private readonly pMaxDist = new Float64Array(PROJECTILE_SLOTS);
  /** Player index for player projectiles, -1 for enemy projectiles. */
  private readonly pOwner = new Int8Array(PROJECTILE_SLOTS);
  private readonly pFreedTick = new Int32Array(PROJECTILE_SLOTS).fill(-SLOT_REUSE_TICKS);
  /** Living projectile slots, oldest first. */
  readonly projectiles: number[] = [];
  private readonly pFree: number[] = [];
  private pNextFresh = 0;

  /** Flow fields by player index, made when a player first takes the slot. */
  readonly groundFields: FlowField[] = [];
  readonly airFields: FlowField[] = [];
  private readonly fieldValid: boolean[] = new Array(PLAYER_SLOTS).fill(false);

  // Separation spatial hashes (ground, air): counting sort of slots by cell.
  private readonly hashStart: [Int32Array, Int32Array];
  private readonly hashItems: [Int32Array, Int32Array];
  private readonly hashFill: Int32Array;

  private readonly body: Body = { x: 0, y: 0, z: 0, vz: 0, grounded: true, radius: 0, flying: false };
  private readonly moveResult: MoveResult = { blocked: false };

  // Snapshot scratch.
  private readonly ent: SnapshotEntities = {
    enemyCount: 0,
    enemySlot: new Uint16Array(ENEMY_SLOTS),
    enemyX: new Float32Array(ENEMY_SLOTS),
    enemyY: new Float32Array(ENEMY_SLOTS),
    enemyTypeState: new Uint8Array(ENEMY_SLOTS),
    enemyFlags: new Uint8Array(ENEMY_SLOTS),
    projectileCount: 0,
    projSlot: new Uint16Array(MAX_PROJECTILES),
    projKind: new Uint8Array(MAX_PROJECTILES),
    projX: new Float32Array(MAX_PROJECTILES),
    projY: new Float32Array(MAX_PROJECTILES),
    projZ: new Float32Array(MAX_PROJECTILES),
  };
  private readonly baseFlags = new Uint8Array(ENEMY_SLOTS);
  private preparedTick = -1;
  private readonly lastSentTick = new Map<number, number>();

  constructor(opts: SimOptions) {
    this.map = loadMap(opts.dungeon);
    this.bench = !!opts.bench;
    this.noWaves = !!opts.noWaves;
    this.singleplayer = !!opts.singleplayer;
    this.random = mulberry32(opts.seed);
    this.arenas = this.map.arenas.map((a, i) => ({
      phase: PHASE_IDLE,
      wave: -1,
      waveStartTick: 0,
      queue: [],
      rr: 0,
      budgets: new Float64Array(this.map.arenaSpawnPoints[i].length),
      waveTotals: a.waves.map(() => 0),
      waveAlive: a.waves.map(() => 0),
      waveFullySpawned: a.waves.map(() => false),
      alive: 0,
      sealTick: 0,
      partySize: 0,
    }));
    // Idle arenas keep their exit doors closed.
    this.map.arenas.forEach((_, ai) => setArenaDoors(this.map, ai, PHASE_IDLE));
    this.god = !!opts.god;
    for (const p of opts.players) {
      const [c, r] = this.bench ? this.map.arenas[0].entryCells[0] : this.map.spawns[p.id];
      this.insertPlayer(p, c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c]);
    }
    const cells = this.map.w * this.map.h;
    this.hashStart = [new Int32Array(cells + 1), new Int32Array(cells + 1)];
    this.hashItems = [new Int32Array(ENEMY_SLOTS), new Int32Array(ENEMY_SLOTS)];
    this.hashFill = new Int32Array(cells);
    this.eFreedTick.fill(-SLOT_REUSE_TICKS);
  }

  /** Simulation time since the start, ms. */
  get timeMs(): number {
    return this.tick * TICK_MS;
  }

  playerById(id: number): SimPlayer | undefined {
    return this.players.find((p) => p.id === id);
  }

  /** Arena index and phase as sent in snapshots (§8.2). */
  arenaStatus(): { arenaIndex: number; arenaPhase: number } {
    for (let i = this.arenas.length - 1; i >= 0; i--) {
      if (this.arenas[i].phase !== PHASE_IDLE) return { arenaIndex: i, arenaPhase: this.arenas[i].phase };
    }
    return { arenaIndex: 0, arenaPhase: this.arenas.length ? this.arenas[0].phase : PHASE_IDLE };
  }

  isInvulnerable(p: SimPlayer): boolean {
    return p.god || p.devGod || this.tick < p.invulUntil;
  }

  // ------------------------------------------------------------------ input

  /** Applies an input message from a player (§9.3). `nowMs` is the host time of arrival. */
  applyInput(playerId: number, m: InputMsg, nowMs: number): void {
    const p = this.playerById(playerId);
    if (!p || !p.connected) return;
    if (p.lastSeq >= 0 && m.seq <= p.lastSeq) return;
    // Inputs sent before the client saw the host's latest teleport are ignored.
    const behind = (p.teleportId - m.lastTeleportId) & 0xffff;
    if (behind !== 0 && behind < 0x8000) return;
    p.lastSeq = m.seq;
    p.yaw = m.yaw;
    p.pitch = m.pitch;
    const qPressed = m.qPresses !== p.qPresses;
    const ePressed = m.ePresses !== p.ePresses;
    p.qPresses = m.qPresses;
    p.ePresses = m.ePresses;
    if (p.dead) {
      // Position, fire and ability input are ignored while dead.
      p.lastAcceptMs = nowMs;
      return;
    }
    let x = m.x;
    let y = m.y;
    if (nowMs >= p.speedCheckSkipUntil) {
      const elapsed = Math.max(0, nowMs - p.lastAcceptMs) / 1000;
      const maxD = 1.2 * p.speed * elapsed + 0.5;
      const dx = x - p.x;
      const dy = y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > maxD) {
        x = p.x + (dx / d) * maxD;
        y = p.y + (dy / d) * maxD;
      }
    }
    let z = m.z;
    const g = groundHeight(this.map, x, y, PLAYER_RADIUS, Infinity, false, true);
    if (g !== -Infinity && z < g) z = g;
    p.x = x;
    p.y = y;
    p.z = z;
    p.lastAcceptMs = nowMs;
    p.fire = m.fire;
    p.allyTargetId = m.allyTargetId;
    // Any increase of a press counter is one press (§9.3).
    if (qPressed) p.pendingQ = true;
    if (ePressed) {
      p.pendingE = true;
      p.pendingEAlly = m.allyTargetId;
    }
  }

  /** Moves a player on the host and tells its client (§9.3). */
  teleport(p: SimPlayer, x: number, y: number, z: number): void {
    p.x = x;
    p.y = y;
    p.z = z;
    p.teleportId = (p.teleportId + 1) & 0xffff;
    p.lastAcceptMs = this.nowMs;
    this.events.push({ to: p.id, event: { type: 'teleport', teleportId: p.teleportId, x, y, z } });
  }

  /** Adds a player to the game in its slot, with its feet at (x, y, z). */
  private insertPlayer(init: SimPlayerInit, x: number, y: number, z: number): SimPlayer {
    const cls = CLASSES[init.classId];
    const p: SimPlayer = {
      id: init.id,
      index: init.id,
      name: init.name,
      classId: init.classId,
      speed: cls.speed,
      maxHp: cls.hp,
      hp: cls.hp,
      shield: 0,
      shieldUntil: 0,
      dead: false,
      connected: true,
      god: this.god || this.bench,
      devGod: false,
      invulUntil: 0,
      x,
      y,
      z,
      yaw: 0,
      pitch: 0,
      fire: 0,
      fireTimer: 0,
      qPresses: 0,
      ePresses: 0,
      allyTargetId: ALLY_NONE,
      pendingQ: false,
      pendingE: false,
      pendingEAlly: ALLY_NONE,
      landingTick: -1,
      kills: 0,
      shots: 0,
      shots2: 0,
      beamId: ALLY_NONE,
      beamUntil: 0,
      revive: 0,
      soulTick: 0,
      cdQ: 0,
      cdE: 0,
      lastDamageTick: this.tick,
      lastSeq: -1,
      lastAcceptMs: this.nowMs,
      teleportId: 0,
      speedCheckSkipUntil: 0,
    };
    this.slots[p.index] = p;
    this.players.push(p);
    this.players.sort((a, b) => a.id - b.id);
    this.groundFields[p.index] ??= new FlowField(this.map, false);
    this.airFields[p.index] ??= new FlowField(this.map, true);
    this.fieldValid[p.index] = false;
    return p;
  }

  /**
   * A player joins the game in progress (M8 §6.2), placed by the state of arena `arenaIndex`: in
   * combat as a soul on its entry cell, already floating; in the countdown alive on its entry cell;
   * otherwise alive on the feet of the living player with the lowest ID or, with none alive, on its
   * entry cell of the next arena. The host tells its client where with a `teleport`.
   */
  addPlayer(init: SimPlayerInit): SimPlayer | null {
    if (init.id < 0 || init.id >= PLAYER_SLOTS || this.slots[init.id] || this.result) return null;
    const { arenaIndex, arenaPhase } = this.arenaStatus();
    const lead = this.players.find((q) => this.livingTargetable(q));
    const p = this.insertPlayer(init, 0, 0, 0);
    let x: number;
    let y: number;
    let z: number;
    if (arenaPhase === PHASE_COMBAT || arenaPhase === PHASE_COUNTDOWN || !lead) {
      const next = arenaPhase === PHASE_CLEARED && !lead ? arenaIndex + 1 : arenaIndex;
      const a = this.map.arenas[next];
      const [c, r] = a ? a.entryCells[p.index] : this.map.spawns[p.index];
      [x, y, z] = [c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c]];
    } else [x, y, z] = [lead.x, lead.y, lead.z];
    if (arenaPhase === PHASE_COMBAT) {
      // A soul with progress 0 that starts already floating (M8 §4.1).
      p.dead = true;
      p.hp = 0;
      p.soulTick = this.tick - ticks(SOUL_RISE_TIME);
    }
    this.teleport(p, x, y, z);
    return p;
  }

  /**
   * A player left or timed out (§9.4, M8 §6.2): their player is removed, with their soul, and the game
   * continues. Enemies retarget at once, and the run is a defeat if every player left is dead.
   */
  removePlayer(playerId: number): void {
    const p = this.playerById(playerId);
    if (!p) return;
    p.connected = false;
    this.players.splice(this.players.indexOf(p), 1);
    this.slots[p.index] = undefined;
    // Enemies that targeted them retarget at once (§7.2).
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (this.eTarget[s] === p.index) this.retarget(s);
    }
    if (!this.result) this.checkDefeat();
  }

  /** Dev key G: toggles invulnerability for one player. */
  toggleDevGod(playerId: number): void {
    const p = this.playerById(playerId);
    if (p) p.devGod = !p.devGod;
  }

  // ------------------------------------------------------------------ tick

  /** Simulates one tick. `nowMs` is the host time used for input timing. Does nothing after the result. */
  step(nowMs?: number): void {
    if (this.result) return;
    this.tick++;
    this.nowMs = nowMs ?? this.tick * TICK_MS;
    this.checkArenaStarts();
    this.updateFlowFields();
    this.updateSpawning();
    this.updatePlayers();
    this.updateEnemies();
    this.separate(0);
    this.separate(1);
    this.updateProjectiles();
    this.updateSouls();
    this.checkVictory();
    this.checkArenaClears();
    this.checkDefeat();
  }

  /** Victory: when the Gatekeeper dies, every remaining enemy bursts without kill credit (§8.2). */
  private checkVictory(): void {
    if (!this.bossKilled || this.result) return;
    while (this.activeCount > 0) this.removeEnemy(this.active[this.activeCount - 1]);
    this.finish('victory');
  }

  private livingTargetable(p: SimPlayer | undefined): p is SimPlayer {
    return !!p && p.connected && !p.dead;
  }

  /**
   * Arena countdown (M8 §5): a living player entering an idle arena, once every earlier one is
   * cleared, starts a 60 s countdown; it drops to 5 s when every living player is inside (none on a
   * door cell), never restarts, and seals the arena at 0. The benchmark's arena starts at once.
   */
  private checkArenaStarts(): void {
    this.map.arenas.forEach((a, ai) => {
      const st = this.arenas[ai];
      if (st.phase === PHASE_IDLE) {
        if (!this.players.some((p) => this.livingTargetable(p) && insideRect(a, p.x, p.y))) return;
        if (this.arenas.slice(0, ai).some((e) => e.phase !== PHASE_CLEARED)) return;
        if (this.bench) {
          this.startArena(ai);
          return;
        }
        st.phase = PHASE_COUNTDOWN;
        st.sealTick = this.tick + ticks(COUNTDOWN);
      }
      if (st.phase !== PHASE_COUNTDOWN) return;
      const living = this.players.filter((p) => this.livingTargetable(p));
      if (living.length > 0 && living.every((p) => insideRect(a, p.x, p.y) && !this.onDoor(p))) {
        st.sealTick = Math.min(st.sealTick, this.tick + ticks(COUNTDOWN_ALL_IN));
      }
      if (this.tick >= st.sealTick) this.startArena(ai);
    });
  }

  private onDoor(p: SimPlayer): boolean {
    return this.map.doorArena[Math.floor(p.y) * this.map.w + Math.floor(p.x)] >= 0;
  }

  /** Seconds until the countdown arena seals, or 0 (M8 §5). */
  countdownLeft(): number {
    const { arenaIndex, arenaPhase } = this.arenaStatus();
    if (arenaPhase !== PHASE_COUNTDOWN) return 0;
    return Math.max(0, this.arenas[arenaIndex].sealTick - this.tick) / TICK_HZ;
  }

  private startArena(ai: number): void {
    const a = this.map.arenas[ai];
    const st = this.arenas[ai];
    st.phase = PHASE_COMBAT;
    // Party-size scaling counts the players in the game at the seal (M8 §6.3).
    st.partySize = Math.max(1, this.players.length);
    setArenaDoors(this.map, ai, PHASE_COMBAT);
    this.invalidateFields();
    this.events.push({ to: 'all', event: { type: 'arenaStarted', arenaIndex: ai } });
    for (const p of this.players) {
      if (!this.livingTargetable(p)) continue;
      if (!insideRect(a, p.x, p.y) || this.onDoor(p)) {
        const [c, r] = a.entryCells[p.index];
        this.teleport(p, c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c]);
      }
    }
    if (!this.bench && !this.noWaves && a.waves.length > 0) this.startWave(ai, 0);
    if (a.boss && this.map.boss) this.placeBoss(ai);
  }

  /** Places the Gatekeeper on `B` when the boss arena enters combat; all its timers start now (§7.4). */
  private placeBoss(ai: number): void {
    const [c, r] = this.map.boss!;
    const slot = this.allocSlot();
    if (slot < 0) return;
    this.bossParty = this.arenas[ai].partySize;
    this.bossMaxHp = ENEMIES[GATEKEEPER].hp * partyMultiplier(this.bossParty);
    this.bossCast = BOSS_CAST_NONE;
    this.bossCastTicks = 0;
    this.volleyDue = this.tick + ticks(VOLLEY_FIRST);
    this.judgmentDue = this.tick + ticks(JUDGMENT_FIRST);
    this.summonDue = this.tick + ticks(SUMMON_FIRST);
    this.bossSlot = slot;
    this.spawnAt(slot, GATEKEEPER, c, r, ai, -1);
    this.eHp[slot] = this.bossMaxHp;
  }

  private startWave(ai: number, n: number): void {
    const st = this.arenas[ai];
    const w = this.map.arenas[ai].waves[n];
    const counts = [scaleCount(w.blessed, st.partySize), scaleCount(w.choristers, st.partySize), scaleCount(w.cherubs, st.partySize)];
    st.wave = n;
    st.waveStartTick = this.tick;
    st.waveTotals[n] = counts[0] + counts[1] + counts[2];
    st.waveAlive[n] = 0;
    st.waveFullySpawned[n] = st.waveTotals[n] === 0;
    if (st.waveTotals[n] > 0) st.queue.push({ counts, spawned: [0, 0, 0], wave: n });
  }

  private checkArenaClears(): void {
    this.map.arenas.forEach((a, ai) => {
      const st = this.arenas[ai];
      if (st.phase !== PHASE_COMBAT || a.boss || this.bench) return;
      const allWavesStarted = this.noWaves || st.wave >= a.waves.length - 1;
      if (!allWavesStarted || st.queue.length > 0 || st.alive > 0) return;
      st.phase = PHASE_CLEARED;
      setArenaDoors(this.map, ai, PHASE_CLEARED);
      this.invalidateFields();
      this.events.push({ to: 'all', event: { type: 'arenaCleared', arenaIndex: ai } });
      for (const p of this.players) {
        if (!p.connected || !p.dead) continue;
        p.dead = false;
        p.hp = p.maxHp;
        p.shield = 0;
        p.revive = 0;
        p.lastDamageTick = this.tick;
        const [c, r] = a.entryCells[p.index];
        this.events.push({ to: 'all', event: { type: 'playerRespawned', playerId: p.id } });
        this.teleport(p, c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c]);
      }
    });
  }

  /** Defeat: all connected players are dead at the same time (§5.7). */
  private checkDefeat(): void {
    if (this.result || this.bench) return;
    const connected = this.players.filter((p) => p.connected);
    if (connected.length > 0 && connected.every((p) => p.dead)) this.finish('defeat');
  }

  /** Ends the run: the host sends one last snapshot and `gameOver`, then stops simulating (§3). */
  finish(result: 'victory' | 'defeat'): void {
    if (this.result) return;
    this.result = result;
    const kills: Record<number, number> = {};
    for (const p of this.players) if (p.connected) kills[p.id] = p.kills;
    this.events.push({ to: 'all', event: { type: 'gameOver', result, timeMs: Math.round(this.timeMs), kills } });
  }

  // ------------------------------------------------------------------ flow fields

  private invalidateFields(): void {
    this.fieldValid.fill(false);
  }

  /** One ground and one air field per living player, each recomputed every 0.25 s on staggered ticks. */
  private updateFlowFields(): void {
    for (const p of this.players) {
      if (!this.livingTargetable(p)) continue;
      const k = p.index * 2;
      const due = Math.floor((this.tick + k) / 7.5) !== Math.floor((this.tick + k - 1) / 7.5);
      if (!due && this.fieldValid[p.index]) continue;
      this.computeFields(p);
    }
  }

  /** Computes every living player's flow fields now. */
  refreshFields(): void {
    for (const p of this.players) if (this.livingTargetable(p)) this.computeFields(p);
  }

  private computeFields(p: SimPlayer): void {
    const c = Math.floor(p.x);
    const r = Math.floor(p.y);
    this.groundFields[p.index].compute(c, r);
    this.airFields[p.index].compute(c, r);
    this.fieldValid[p.index] = true;
  }

  // ------------------------------------------------------------------ spawning

  private updateSpawning(): void {
    this.arenas.forEach((st, ai) => {
      const b = st.budgets;
      for (let i = 0; i < b.length; i++) b[i] += BUDGET_PER_TICK;
      if (st.phase === PHASE_COMBAT) this.updateArenaSpawning(ai);
      // The cap applies to the budget carried into the next tick, so a busy point sustains its rate.
      for (let i = 0; i < b.length; i++) if (b[i] > BUDGET_MAX) b[i] = BUDGET_MAX;
    });
  }

  private updateArenaSpawning(ai: number): void {
    const st = this.arenas[ai];
    if (this.bench && ai === 0) {
      // Benchmark: keep exactly 1 500 Blessed alive instead of waves.
      const queued = st.queue.reduce((n, q) => n + q.counts[0] - q.spawned[0], 0);
      const need = MAX_LIVING_ENEMIES - this.living - queued;
      if (need > 0) st.queue.push({ counts: [need, 0, 0], spawned: [0, 0, 0], wave: -1 });
    }

    const waves = this.map.arenas[ai].waves;
    const n = st.wave;
    if (n >= 0 && n < waves.length - 1 && st.waveFullySpawned[n]) {
      const fewLeft = st.waveAlive[n] <= WAVE_NEXT_FRACTION * st.waveTotals[n] + 1e-9;
      if (fewLeft || this.tick - st.waveStartTick >= WAVE_NEXT_TICKS) this.startWave(ai, n + 1);
    }

    this.placeQueued(ai);
  }

  private placeQueued(ai: number): void {
    const st = this.arenas[ai];
    if (st.queue.length === 0) return;
    const points = this.map.arenaSpawnPoints[ai];
    const np = points.length;
    if (np === 0) return;
    const eligible = new Uint8Array(np);
    let any = false;
    for (let i = 0; i < np; i++) {
      const [c, r] = points[i];
      const px = c + 0.5;
      const py = r + 0.5;
      const pz = this.map.floor[r * this.map.w + c];
      let ok = true;
      for (const p of this.players) {
        if (!this.livingTargetable(p)) continue;
        if (distToCylinder(px, py, pz, p.x, p.y, p.z, PLAYER_RADIUS, PLAYER_HEIGHT) <= SPAWN_ELIGIBLE_DIST) {
          ok = false;
          break;
        }
      }
      eligible[i] = ok ? 1 : 0;
      if (ok) any = true;
    }
    if (!any) eligible.fill(1);

    while (st.queue.length > 0) {
      if (this.living >= MAX_LIVING_ENEMIES) return;
      let found = -1;
      for (let k = 0; k < np; k++) {
        const i = (st.rr + k) % np;
        if (eligible[i] && st.budgets[i] >= 1) {
          found = i;
          break;
        }
      }
      if (found < 0) return;
      const slot = this.allocSlot();
      if (slot < 0) return;
      const batch = st.queue[0];
      const type = this.takeNextType(batch);
      if (batch.spawned.every((s, t) => s >= batch.counts[t])) {
        st.queue.shift();
        if (batch.wave >= 0) st.waveFullySpawned[batch.wave] = true;
      }
      const [c, r] = points[found];
      this.spawnAt(slot, type, c, r, ai, batch.wave);
      st.budgets[found] -= 1;
      st.rr = (found + 1) % np;
    }
  }

  /** The type with the lowest (spawned + 0.5) / count among types with enemies left (§8.2). */
  private takeNextType(batch: SpawnBatch): number {
    let best = -1;
    let bestV = Infinity;
    for (let t = 0; t < 3; t++) {
      if (batch.spawned[t] >= batch.counts[t]) continue;
      const v = (batch.spawned[t] + 0.5) / batch.counts[t];
      if (v < bestV) {
        bestV = v;
        best = t;
      }
    }
    batch.spawned[best]++;
    return SPAWN_TYPES[best];
  }

  private allocSlot(): number {
    if (this.freeCount > 0) {
      const s = this.freeFifo[this.freeHead];
      if (this.eFreedTick[s] + SLOT_REUSE_TICKS <= this.tick) {
        this.freeHead = (this.freeHead + 1) % ENEMY_SLOTS;
        this.freeCount--;
        return s;
      }
    }
    if (this.nextFresh < ENEMY_SLOTS) return this.nextFresh++;
    return -1;
  }

  /** Places a new enemy on a cell (§2.3) and returns its slot, or -1 if no slot is free. */
  placeEnemy(type: number, c: number, r: number, arena: number): number {
    const slot = this.allocSlot();
    if (slot >= 0) this.spawnAt(slot, type, c, r, arena, -1);
    return slot;
  }

  private spawnAt(slot: number, type: number, c: number, r: number, arena: number, wave: number): void {
    const def = ENEMIES[type];
    this.eAlive[slot] = 1;
    this.eType[slot] = type;
    this.eState[slot] = ST_IDLE;
    this.eX[slot] = c + 0.5;
    this.eY[slot] = r + 0.5;
    this.eZ[slot] = this.map.floor[r * this.map.w + c] + (type === CHERUB ? CHERUB_HOVER : 0);
    this.eStartX[slot] = this.eX[slot];
    this.eStartY[slot] = this.eY[slot];
    this.eVz[slot] = 0;
    this.eGrounded[slot] = 1;
    this.eHp[slot] = def.hp;
    this.eArena[slot] = arena;
    this.eWave[slot] = wave;
    this.eLos[slot] = 0;
    this.eTarget[slot] = -1;
    this.eStrafe[slot] = 1;
    this.eStrafeT[slot] = 0;
    this.eHurtTick[slot] = -1;
    this.eSlowUntil[slot] = 0;
    this.eRootUntil[slot] = 0;
    this.eSilenceUntil[slot] = 0;
    this.eTauntUntil[slot] = 0;
    this.eKbUntil[slot] = 0;
    this.ePullStart[slot] = -1;
    this.eCast[slot] = 0;
    this.eCastT[slot] = 0;
    this.eCastCd[slot] = 0;
    this.eMeleeNext[slot] = -1;
    this.activePos[slot] = this.activeCount;
    this.active[this.activeCount++] = slot;
    if (type !== GATEKEEPER) this.living++;
    if (arena >= 0) {
      const st = this.arenas[arena];
      if (type !== GATEKEEPER) st.alive++;
      if (wave >= 0) st.waveAlive[wave]++;
    }
    this.retarget(slot);
  }

  /** Removes an enemy and frees its slot (reusable after 1 s). */
  removeEnemy(slot: number): void {
    if (!this.eAlive[slot]) return;
    this.eAlive[slot] = 0;
    const type = this.eType[slot];
    if (type !== GATEKEEPER) this.living--;
    const arena = this.eArena[slot];
    if (arena >= 0) {
      const st = this.arenas[arena];
      if (type !== GATEKEEPER) st.alive--;
      const wave = this.eWave[slot];
      if (wave >= 0) st.waveAlive[wave]--;
    }
    if (this.markSlot === slot) this.markSlot = -1;
    if (slot === this.bossSlot) {
      this.bossSlot = -1;
      this.bossCast = BOSS_CAST_NONE;
      this.bossKilled = true;
    }
    const pos = this.activePos[slot];
    const last = this.active[--this.activeCount];
    this.active[pos] = last;
    this.activePos[last] = pos;
    this.activePos[slot] = -1;
    this.eFreedTick[slot] = this.tick;
    this.freeFifo[(this.freeHead + this.freeCount) % ENEMY_SLOTS] = slot;
    this.freeCount++;
  }

  /** Dev key K: kills every living enemy, including the Gatekeeper, without kill credit. */
  killAll(): void {
    while (this.activeCount > 0) this.removeEnemy(this.active[this.activeCount - 1]);
  }

  /** Marks an enemy as hurt this tick (sets the per-recipient `hurt` flag). */
  markHurt(slot: number): void {
    this.eHurtTick[slot] = this.tick;
  }

  // ------------------------------------------------------------------ damage (§5.5)

  /** A hit on an enemy. `source` is the player index that gets the kill credit, or -1. */
  damageEnemy(slot: number, amount: number, source: number): void {
    if (!this.eAlive[slot]) return;
    // 1. Kiss of Betrayal.
    if (slot === this.markSlot && this.tick < this.markUntil) amount *= 3;
    if (amount <= 0) return;
    // Judgment is interrupted by the boss taking 2 000 damage during it, counted after step 1.
    if (slot === this.bossSlot && this.bossCast === BOSS_CAST_JUDGMENT) {
      this.judgmentDamage += amount;
      if (this.judgmentDamage >= JUDGMENT_INTERRUPT * partyMultiplier(this.bossParty) - 1e-9) this.interruptJudgment();
    }
    // 2. Bound (M8 §8): a rooted enemy, during the pull too, takes double damage.
    if (this.isRooted(slot)) amount *= BOUND_FACTOR;
    this.eHp[slot] -= amount;
    this.eHurtTick[slot] = this.tick;
    // 5. Death and kill credit.
    if (this.eHp[slot] <= 0) {
      const shooter = source >= 0 ? this.slots[source] : undefined;
      if (shooter) shooter.kills++;
      this.removeEnemy(slot);
    }
  }

  /** A hit on a player. */
  damagePlayer(p: SimPlayer, amount: number): void {
    if (p.dead || !p.connected) return;
    // 2. Brimstone Hide.
    if (p.classId === 'fallen') amount *= 0.6;
    // 3. Invulnerability.
    if (this.isInvulnerable(p)) amount = 0;
    if (amount <= 0) return;
    p.lastDamageTick = this.tick;
    // 4. Shield.
    if (p.shield > 0) {
      const absorbed = Math.min(p.shield, amount);
      p.shield -= absorbed;
      amount -= absorbed;
    }
    p.hp -= amount;
    // 5. Death.
    if (p.hp <= 0) this.killPlayer(p);
  }

  private killPlayer(p: SimPlayer): void {
    p.dead = true;
    p.hp = 0;
    p.shield = 0;
    // The soul (M8 §4.1): its ground point is the feet, dropped to the ground under them.
    const g = groundHeight(this.map, p.x, p.y, PLAYER_RADIUS, Infinity, false, true);
    if (g !== -Infinity) p.z = g;
    p.soulTick = this.tick;
    p.revive = 0;
    p.fire = 0;
    p.beamUntil = 0;
    p.pendingQ = false;
    p.pendingE = false;
    p.landingTick = -1;
    this.events.push({ to: 'all', event: { type: 'playerDied', playerId: p.id } });
    // Blasphemy ends when the Fallen dies (§7.2).
    if (p.classId === 'fallen') for (let k = 0; k < this.activeCount; k++) this.eTauntUntil[this.active[k]] = 0;
  }

  /** Heals a living player, capped at max HP. */
  heal(p: SimPlayer, amount: number): void {
    if (p.dead || !p.connected) return;
    p.hp = Math.min(p.maxHp, p.hp + amount);
  }

  /** Gives a living player a shield; a new shield replaces the old one. */
  giveShield(p: SimPlayer, amount: number, seconds: number): void {
    if (p.dead || !p.connected) return;
    p.shield = amount;
    p.shieldUntil = this.tick + ticks(seconds);
  }

  // ------------------------------------------------------------------ status effects (§5.6)

  private immune(slot: number): boolean {
    return this.eType[slot] === GATEKEEPER;
  }

  /** Slow: refreshes the duration, doesn't stack. */
  slow(slot: number, seconds: number): void {
    if (this.immune(slot)) return;
    this.eSlowUntil[slot] = this.tick + ticks(seconds);
  }

  root(slot: number, seconds: number): void {
    if (this.immune(slot)) return;
    this.eRootUntil[slot] = Math.max(this.eRootUntil[slot], this.tick + ticks(seconds));
  }

  /** Rooted: by Chains, including the 0.3 s pull. The Gatekeeper can't be rooted. */
  isRooted(slot: number): boolean {
    return this.tick < this.eRootUntil[slot] || this.ePullStart[slot] >= 0;
  }

  /** Silence: a cast in progress is cancelled. */
  silence(slot: number, seconds: number): void {
    this.eSilenceUntil[slot] = Math.max(this.eSilenceUntil[slot], this.tick + ticks(seconds));
    this.eCast[slot] = 0;
    this.eCastT[slot] = 0;
  }

  /** Mark: only one exists; a new mark replaces the old one. */
  mark(slot: number, seconds: number): void {
    this.markSlot = slot;
    this.markUntil = this.tick + ticks(seconds);
  }

  /** Knockback: pushed horizontally by `dist` over 0.2 s, with normal collision and no steering. */
  knockback(slot: number, dirX: number, dirY: number, dist: number): void {
    if (this.immune(slot)) return;
    const len = Math.hypot(dirX, dirY);
    if (len < 1e-9) return;
    const v = dist / KNOCKBACK_TIME;
    this.eKbVx[slot] = (dirX / len) * v;
    this.eKbVy[slot] = (dirY / len) * v;
    this.eKbFrom[slot] = this.tick;
    this.eKbUntil[slot] = this.tick + ticks(KNOCKBACK_TIME);
  }

  /** Chains: moves linearly to (x, y) over 0.3 s ignoring collision, then roots for 1.5 s. */
  pull(slot: number, x: number, y: number, floorZ: number): void {
    if (this.immune(slot)) return;
    const o = slot * 6;
    this.ePull[o] = this.eX[slot];
    this.ePull[o + 1] = this.eY[slot];
    this.ePull[o + 2] = this.eZ[slot];
    this.ePull[o + 3] = x;
    this.ePull[o + 4] = y;
    // Ground enemies end on the floor there; flyers keep their hover height.
    this.ePull[o + 5] = this.eType[slot] === CHERUB ? this.eZ[slot] : floorZ;
    this.ePullStart[slot] = this.tick;
    this.eKbUntil[slot] = 0;
  }

  // ------------------------------------------------------------------ players

  private updatePlayers(): void {
    for (const p of this.players) {
      p.cdQ = Math.max(0, p.cdQ - TICK_DT);
      p.cdE = Math.max(0, p.cdE - TICK_DT);
      if (p.shield > 0 && this.tick >= p.shieldUntil) p.shield = 0;
      if (p.dead) {
        p.fireTimer = Math.max(0, p.fireTimer - TICK_DT);
        continue;
      }
      if (this.singleplayer && this.tick - p.lastDamageTick >= REGEN_DELAY_TICKS) {
        p.hp = Math.min(p.maxHp, p.hp + REGEN_FRACTION * p.maxHp * TICK_DT);
      }
      if (p.landingTick >= 0 && this.tick >= p.landingTick) {
        p.landingTick = -1;
        this.fallingStarLanding(p);
      }
      if (p.pendingQ) {
        p.pendingQ = false;
        this.useQ(p);
      }
      if (p.pendingE) {
        p.pendingE = false;
        this.useE(p, p.pendingEAlly);
      }
      this.updateWeapon(p);
    }
  }

  /**
   * The shared fire timer (M9 §2.2): the held attack (§2.1) fires when the timer is 0 or less and
   * adds its own interval; the timer counts down twice as fast in a Field of Blood.
   */
  private updateWeapon(p: SimPlayer): void {
    const slot = chooseAttack(p.classId, p.fire, this.sacramentTarget(p) !== undefined);
    if (slot !== ATTACK_NONE && p.fireTimer <= 1e-6) {
      this.fireWeapon(p, slot);
      if (slot === ATTACK_PRIMARY) p.shots++;
      else p.shots2++;
      p.fireTimer += attackDef(p.classId, slot).interval;
    }
    p.fireTimer -= TICK_DT * this.fireRate(p);
    if (slot === ATTACK_NONE && p.fireTimer < 0) p.fireTimer = 0;
  }

  /** How fast a player's fire timer counts down: 2 in a Field of Blood, otherwise 1 (M9 §3.4). */
  fireRate(_p: SimPlayer): number {
    return 1;
  }

  /**
   * Sacrament's ally (M9 §2.5): the latest input's ally target, if it's another living player within
   * 40 m of the eye. Line of sight isn't rechecked.
   */
  sacramentTarget(p: SimPlayer): SimPlayer | undefined {
    if (p.classId !== 'heretic' || p.allyTargetId === ALLY_NONE) return undefined;
    const ally = this.playerById(p.allyTargetId);
    if (!ally || ally === p || !this.livingTargetable(ally)) return undefined;
    const d = distToCylinder(p.x, p.y, p.z + PLAYER_EYE, ally.x, ally.y, ally.z, PLAYER_RADIUS, PLAYER_HEIGHT);
    return d <= SECONDARIES.heretic.range ? ally : undefined;
  }

  /** Fires one of the player's attacks from the eye, along the latest reported aim. */
  fireWeapon(p: SimPlayer, slot: AttackSlot = ATTACK_PRIMARY): void {
    const w = attackDef(p.classId, slot);
    const ex = p.x;
    const ey = p.y;
    const ez = p.z + PLAYER_EYE;
    switch (w.kind) {
      case 'censer': {
        const [dx, dy, dz] = aimDir(p.yaw, p.pitch);
        this.spawnProjectile(PROJ_CENSER, ex, ey, ez, dx, dy, dz, CENSER_SPEED, CENSER_RADIUS, w.damage, w.range, p.index);
        return;
      }
      case 'sacrament': {
        // Heals even at full HP, so the beam stays steady; it never heals the Heretic.
        const ally = this.sacramentTarget(p);
        if (!ally) return;
        this.heal(ally, w.damage);
        p.beamId = ally.id;
        p.beamUntil = this.tick + BEAM_HOLD_TICKS;
        return;
      }
      case 'scourge':
        this.scourge(p);
        return;
      case 'silverBullet':
        this.silverBullet(p);
        return;
    }
    // Souls this trigger pull hit: all pellets together count one hit per soul (M8 §4.2).
    const souls = new Set<SimPlayer>();
    for (let i = 0; i < w.pellets; i++) {
      const yaw = w.spreadYaw > 0 ? p.yaw + (this.random() * 2 - 1) * w.spreadYaw : p.yaw;
      const pitch = w.spreadPitch > 0 ? p.pitch + (this.random() * 2 - 1) * w.spreadPitch : p.pitch;
      const [dx, dy, dz] = aimDir(yaw, pitch);
      const hits = this.rayEnemies(ex, ey, ez, dx, dy, dz, w.range, w.maxHits);
      // Where the ray stops: the terrain or its range, or the last enemy it can pierce.
      let stop = raycastTerrain(this.map, ex, ey, ez, dx, dy, dz, w.range);
      if (hits.length >= w.maxHits) stop = this.rayT(hits[hits.length - 1], ex, ey, ez, dx, dy, dz);
      this.soulsOnRay(p, ex, ey, ez, dx, dy, dz, stop, souls);
      for (const s of hits) {
        this.damageEnemy(s, w.damage, p.index);
        if (w.slow > 0 && this.eAlive[s]) this.slow(s, w.slow);
      }
    }
    for (const o of souls) this.addRevive(o, reviveHit(w.interval, p.classId === 'heretic'));
  }

  /** Distance along a ray to where it enters an enemy's cylinder. */
  private rayT(slot: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
    const def = ENEMIES[this.eType[slot]];
    return rayCylinder(ox, oy, oz, dx, dy, dz, this.eX[slot], this.eY[slot], this.eZ[slot], def.radius, def.height);
  }

  /** Adds to `out` the souls (not the shooter's) that a ray passes through before `stop` (M8 §4.2). */
  private soulsOnRay(p: SimPlayer, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, stop: number, out: Set<SimPlayer>): void {
    for (const o of this.players) {
      if (o === p || !this.hasSoul(o) || out.has(o)) continue;
      if (rayCylinder(ox, oy, oz, dx, dy, dz, o.x, o.y, this.soulBase(o), SOUL_RADIUS, SOUL_HEIGHT) <= stop) out.add(o);
    }
  }

  /**
   * The Scourge (M9 §2.6): 25 damage to the 6 nearest living enemies within 3 m of the body center
   * and within 60° of the horizontal aim, slowing the survivors for 1 s. No line of sight is needed.
   */
  scourge(p: SimPlayer): void {
    const w = SECONDARIES.binder;
    const cx = p.x;
    const cy = p.y;
    const cz = p.z + PLAYER_HEIGHT / 2;
    const ax = Math.cos(p.yaw);
    const ay = Math.sin(p.yaw);
    const cosMax = Math.cos(SCOURGE_HALF_ARC);
    const hit: Array<{ s: number; d: number }> = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      const def = ENEMIES[this.eType[s]];
      const d = distToCylinder(cx, cy, cz, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height);
      if (d > w.range) continue;
      const hx = this.eX[s] - cx;
      const hy = this.eY[s] - cy;
      const len = Math.hypot(hx, hy);
      // An enemy on the Binder's own axis has no direction; it counts as in the arc.
      if (len > 1e-9 && (hx * ax + hy * ay) / len < cosMax - 1e-9) continue;
      hit.push({ s, d });
    }
    // Stable sort: equal distances keep active-list order, so the result is deterministic.
    hit.sort((a, b) => a.d - b.d);
    for (let i = 0; i < hit.length && i < w.maxHits; i++) {
      const s = hit[i].s;
      this.damageEnemy(s, w.damage, p.index);
      if (this.eAlive[s]) this.slow(s, w.slow);
    }
  }

  /**
   * The Silver Bullet (M9 §2.4): 300 damage carried through the line, nearest first. A rooted enemy
   * costs half its HP, since the Bound step doubles its hit; the Gatekeeper takes whatever is left.
   * Sends `silverBullet` with where the ray stopped.
   */
  silverBullet(p: SimPlayer): void {
    const w = SECONDARIES.betrayer;
    const ex = p.x;
    const ey = p.y;
    const ez = p.z + PLAYER_EYE;
    const [dx, dy, dz] = aimDir(p.yaw, p.pitch);
    let stop = raycastTerrain(this.map, ex, ey, ez, dx, dy, dz, w.range);
    const dealt = silverBulletHits(
      this.rayEnemies(ex, ey, ez, dx, dy, dz, w.range, Infinity).map((s) => ({ s, hp: this.eHp[s], rooted: this.isRooted(s), boss: this.eType[s] === GATEKEEPER })),
      w.damage,
    );
    if (dealt.stopped) stop = this.rayT(dealt.hits[dealt.hits.length - 1].s, ex, ey, ez, dx, dy, dz);
    const souls = new Set<SimPlayer>();
    this.soulsOnRay(p, ex, ey, ez, dx, dy, dz, stop, souls);
    for (const h of dealt.hits) this.damageEnemy(h.s, h.amount, p.index);
    for (const o of souls) this.addRevive(o, reviveHit(w.interval, false));
    this.events.push({ to: 'all', event: { type: 'silverBullet', playerId: p.id, x: ex, y: ey, z: ez, ex: ex + dx * stop, ey: ey + dy * stop, ez: ez + dz * stop } });
  }

  // ------------------------------------------------------------------ souls (M8 §4)

  /** A dead, connected player has a soul. */
  private hasSoul(p: SimPlayer): boolean {
    return p.dead && p.connected;
  }

  /** The base of a soul's hit cylinder: its ground point plus the rise since death. */
  soulBase(p: SimPlayer): number {
    return p.z + soulRise((this.tick - p.soulTick) / TICK_HZ);
  }

  /** Adds revive progress to a soul; at 1 the player is revived. */
  addRevive(p: SimPlayer, amount: number): void {
    if (!this.hasSoul(p)) return;
    p.revive = Math.min(1, p.revive + amount);
    if (p.revive >= 1 - 1e-9) this.revivePlayer(p);
  }

  /** Revived on the soul's ground point with half HP, invulnerable for 2 s. */
  private revivePlayer(p: SimPlayer): void {
    p.dead = false;
    p.revive = 0;
    p.hp = p.maxHp * REVIVE_HP;
    p.shield = 0;
    p.lastDamageTick = this.tick;
    p.invulUntil = Math.max(p.invulUntil, this.tick + ticks(REVIVE_INVULNERABLE));
    this.invalidateFields();
    this.events.push({ to: 'all', event: { type: 'playerRevived', playerId: p.id } });
    this.teleport(p, p.x, p.y, p.z);
  }

  /** Revive progress decays every tick. */
  private updateSouls(): void {
    for (const p of this.players) {
      if (this.hasSoul(p)) p.revive = Math.max(0, p.revive - REVIVE_DECAY * TICK_DT);
    }
  }

  /**
   * Hitscan: the first `maxHits` enemies along the ray, nearest first, before it reaches a wall,
   * terrain or `range` (§5.3).
   */
  rayEnemies(ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, range: number, maxHits: number): number[] {
    const stop = raycastTerrain(this.map, ox, oy, oz, dx, dy, dz, range);
    const hits: Array<[number, number]> = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      const def = ENEMIES[this.eType[s]];
      const t = rayCylinder(ox, oy, oz, dx, dy, dz, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height);
      if (t > stop) continue;
      if (hits.length < maxHits) {
        hits.push([t, s]);
        hits.sort((a, b) => a[0] - b[0]);
      } else if (t < hits[hits.length - 1][0]) {
        hits[hits.length - 1] = [t, s];
        hits.sort((a, b) => a[0] - b[0]);
      }
    }
    return hits.map((h) => h[1]);
  }

  /**
   * The crosshair ray (§5.3): stops at the first enemy cylinder or at a wall or terrain.
   * Returns the distance (up to maxDist) and the enemy hit, or -1.
   */
  crosshair(p: SimPlayer, maxDist: number): { t: number; slot: number } {
    const [dx, dy, dz] = aimDir(p.yaw, p.pitch);
    const ex = p.x;
    const ey = p.y;
    const ez = p.z + PLAYER_EYE;
    const stop = raycastTerrain(this.map, ex, ey, ez, dx, dy, dz, maxDist);
    const hit = this.rayEnemies(ex, ey, ez, dx, dy, dz, stop, 1);
    if (hit.length === 0) return { t: stop, slot: -1 };
    const s = hit[0];
    const def = ENEMIES[this.eType[s]];
    return { t: rayCylinder(ex, ey, ez, dx, dy, dz, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height), slot: s };
  }

  private abilityEvent(p: SimPlayer, slot: 'Q' | 'E', x: number, y: number, z: number, targets: number[] = []): void {
    this.events.push({ to: 'all', event: { type: 'abilityUsed', playerId: p.id, slot, x, y, z, targets } });
  }

  private useQ(p: SimPlayer): void {
    if (p.cdQ > 1e-6) return;
    const cd = ABILITIES[p.classId].Q.cooldown;
    const bx = p.x;
    const by = p.y;
    const bz = p.z + PLAYER_HEIGHT / 2;
    switch (p.classId) {
      case 'fallen': {
        // Blasphemy: every enemy within 15 m, including the Gatekeeper, targets the Fallen for 5 s.
        for (let k = 0; k < this.activeCount; k++) {
          const s = this.active[k];
          const def = ENEMIES[this.eType[s]];
          if (distToCylinder(bx, by, bz, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) > BLASPHEMY_RADIUS) continue;
          this.eTauntUntil[s] = this.tick + ticks(BLASPHEMY_DURATION);
          this.eTarget[s] = p.index;
        }
        break;
      }
      case 'heretic': {
        // Unholy Communion: heals every living player within 15 m, including self.
        const healed: number[] = [];
        for (const o of this.players) {
          if (!this.livingTargetable(o)) continue;
          if (distToCylinder(bx, by, bz, o.x, o.y, o.z, PLAYER_RADIUS, PLAYER_HEIGHT) > COMMUNION_RADIUS) continue;
          this.heal(o, COMMUNION_HEAL);
          healed.push(o.id);
        }
        // It also adds to every soul within its radius.
        for (const o of this.players) {
          if (o === p || !this.hasSoul(o)) continue;
          if (distToCylinder(bx, by, bz, o.x, o.y, this.soulBase(o), SOUL_RADIUS, SOUL_HEIGHT) <= COMMUNION_RADIUS) this.addRevive(o, REVIVE_COMMUNION);
        }
        p.cdQ = cd;
        this.abilityEvent(p, 'Q', p.x, p.y, p.z, healed);
        return;
      }
      case 'binder': {
        const [dx, dy] = this.chainsDestination(p);
        const c = Math.floor(dx);
        const r = Math.floor(dy);
        const floorZ = this.map.floor[r * this.map.w + c];
        for (const s of this.chainsTargets(p)) this.pull(s, dx, dy, floorZ);
        p.cdQ = cd;
        this.abilityEvent(p, 'Q', dx, dy, floorZ);
        return;
      }
      case 'betrayer': {
        // Kiss of Betrayal: no target, no cooldown.
        const hit = this.crosshair(p, KISS_RANGE);
        if (hit.slot < 0) return;
        this.mark(hit.slot, KISS_DURATION);
        p.cdQ = cd;
        this.abilityEvent(p, 'Q', this.eX[hit.slot], this.eY[hit.slot], this.eZ[hit.slot]);
        return;
      }
    }
    p.cdQ = cd;
    this.abilityEvent(p, 'Q', p.x, p.y, p.z);
  }

  private useE(p: SimPlayer, allyId: number): void {
    const def = ABILITIES[p.classId].E;
    if (def.movement) {
      // Movement abilities run on the client; the host accepts within 0.25 s of ready (§9.3).
      if (p.cdE > MOVEMENT_GRACE + 1e-6) return;
      if (p.classId === 'fallen') {
        const ally = allyId === ALLY_NONE ? undefined : this.playerById(allyId);
        if (!ally || ally === p || !this.livingTargetable(ally)) return;
        p.landingTick = this.tick + ticks(FALLING_STAR_TIME);
        p.invulUntil = Math.max(p.invulUntil, this.tick + ticks(FALLING_STAR_TIME));
        p.cdE = def.cooldown;
        p.speedCheckSkipUntil = this.nowMs + MOVEMENT_SPEED_CHECK_SKIP * 1000;
        this.abilityEvent(p, 'E', ally.x, ally.y, ally.z, [ally.id]);
      } else {
        p.invulUntil = Math.max(p.invulUntil, this.tick + ticks(SHADOWSTEP_INVULN));
        p.cdE = def.cooldown;
        p.speedCheckSkipUntil = this.nowMs + MOVEMENT_SPEED_CHECK_SKIP * 1000;
        this.abilityEvent(p, 'E', p.x, p.y, p.z);
      }
      return;
    }
    if (p.cdE > 1e-6) return;
    if (p.classId === 'heretic') {
      // Martyr's Shroud: on the ally target sent with the press, or on self.
      const ally = allyId === ALLY_NONE ? undefined : this.playerById(allyId);
      const target = ally && ally !== p && this.livingTargetable(ally) ? ally : p;
      this.giveShield(target, SHROUD_AMOUNT, SHROUD_DURATION);
      p.cdE = def.cooldown;
      this.abilityEvent(p, 'E', target.x, target.y, target.z, [target.id]);
    } else if (p.classId === 'binder') {
      // Discord: silences every enemy within 8 m of the impact point.
      const hit = this.crosshair(p, DISCORD_RANGE);
      const [dx, dy, dz] = aimDir(p.yaw, p.pitch);
      const ix = p.x + dx * hit.t;
      const iy = p.y + dy * hit.t;
      const iz = p.z + PLAYER_EYE + dz * hit.t;
      for (let k = 0; k < this.activeCount; k++) {
        const s = this.active[k];
        const ed = ENEMIES[this.eType[s]];
        if (distToCylinder(ix, iy, iz, this.eX[s], this.eY[s], this.eZ[s], ed.radius, ed.height) <= DISCORD_RADIUS) this.silence(s, DISCORD_SILENCE);
      }
      p.cdE = def.cooldown;
      this.abilityEvent(p, 'E', ix, iy, iz);
    }
  }

  /** Falling Star landing: 30 damage within 5 m and a 4 m knockback away from the landing point. */
  private fallingStarLanding(p: SimPlayer): void {
    const cx = p.x;
    const cy = p.y;
    const cz = p.z + PLAYER_HEIGHT / 2;
    const hit: number[] = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      const def = ENEMIES[this.eType[s]];
      if (distToCylinder(cx, cy, cz, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) <= FALLING_STAR_RADIUS) hit.push(s);
    }
    for (const s of hit) {
      this.damageEnemy(s, FALLING_STAR_DAMAGE, p.index);
      if (!this.eAlive[s]) continue;
      let dx = this.eX[s] - cx;
      let dy = this.eY[s] - cy;
      if (Math.hypot(dx, dy) < 1e-6) {
        const a = (s % 16) * (Math.PI / 8);
        dx = Math.cos(a);
        dy = Math.sin(a);
      }
      this.knockback(s, dx, dy, KNOCKBACK_DIST);
    }
  }

  /**
   * Chains destination (§6.3): from the Binder's feet along the horizontal aim in 0.25 m steps, up to
   * 5 m; a step into a wall, a closed door or a floor more than 0.5 m above the previous one is blocked.
   */
  chainsDestination(p: SimPlayer): [number, number] {
    const cx = Math.cos(p.yaw);
    const cy = Math.sin(p.yaw);
    let x = p.x;
    let y = p.y;
    let prevFloor = this.map.floor[Math.floor(y) * this.map.w + Math.floor(x)];
    const steps = Math.round(CHAINS_MAX / CHAINS_STEP);
    for (let i = 1; i <= steps; i++) {
      const nx = p.x + cx * CHAINS_STEP * i;
      const ny = p.y + cy * CHAINS_STEP * i;
      const c = Math.floor(nx);
      const r = Math.floor(ny);
      if (isSolid(this.map, c, r)) break;
      const f = this.map.floor[r * this.map.w + c];
      if (f > prevFloor + STEP_UP + EPS) break;
      x = nx;
      y = ny;
      prevFloor = f;
    }
    return [x, y];
  }

  /** Non-boss enemies within 20 m, in line of sight, with the body center within 30° of the aim. */
  chainsTargets(p: SimPlayer): number[] {
    const [ax, ay, az] = aimDir(p.yaw, p.pitch);
    const ex = p.x;
    const ey = p.y;
    const ez = p.z + PLAYER_EYE;
    const cosMax = Math.cos(CHAINS_ANGLE);
    const out: number[] = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (this.eType[s] === GATEKEEPER) continue;
      const def = ENEMIES[this.eType[s]];
      if (distToCylinder(ex, ey, ez, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) > CHAINS_RANGE) continue;
      const bx = this.eX[s] - ex;
      const by = this.eY[s] - ey;
      const bz = this.eZ[s] + def.height / 2 - ez;
      const len = Math.hypot(bx, by, bz);
      if (len > 1e-9 && (bx * ax + by * ay + bz * az) / len < cosMax - 1e-9) continue;
      if (!lineOfSight(this.map, ex, ey, ez, this.eX[s], this.eY[s], this.eZ[s] + def.height / 2)) continue;
      out.push(s);
    }
    return out;
  }

  // ------------------------------------------------------------------ projectiles (§5.4)

  spawnProjectile(kind: number, x: number, y: number, z: number, dx: number, dy: number, dz: number, speed: number, radius: number, damage: number, maxDist: number, owner: number): number {
    if (this.projectiles.length >= MAX_PROJECTILES) this.removeProjectile(this.projectiles[0]);
    let slot = -1;
    if (this.pFree.length > 0 && this.pFreedTick[this.pFree[0]] + SLOT_REUSE_TICKS <= this.tick) slot = this.pFree.shift()!;
    else if (this.pNextFresh < PROJECTILE_SLOTS) slot = this.pNextFresh++;
    if (slot < 0) return -1;
    this.pAlive[slot] = 1;
    this.pKind[slot] = kind;
    this.pX[slot] = x;
    this.pY[slot] = y;
    this.pZ[slot] = z;
    this.pDx[slot] = dx;
    this.pDy[slot] = dy;
    this.pDz[slot] = dz;
    this.pSpeed[slot] = speed;
    this.pRadius[slot] = radius;
    this.pDamage[slot] = damage;
    this.pTraveled[slot] = 0;
    this.pMaxDist[slot] = Math.min(maxDist, PROJECTILE_RANGE);
    this.pOwner[slot] = owner;
    this.projectiles.push(slot);
    return slot;
  }

  removeProjectile(slot: number): void {
    if (!this.pAlive[slot]) return;
    this.pAlive[slot] = 0;
    const i = this.projectiles.indexOf(slot);
    if (i >= 0) this.projectiles.splice(i, 1);
    this.pFreedTick[slot] = this.tick;
    this.pFree.push(slot);
  }

  private updateProjectiles(): void {
    for (const slot of [...this.projectiles]) {
      if (this.pAlive[slot]) this.updateProjectile(slot);
    }
  }

  /** Moves one projectile as a swept segment against the heightfield and enlarged target cylinders. */
  private updateProjectile(slot: number): void {
    const x = this.pX[slot];
    const y = this.pY[slot];
    const z = this.pZ[slot];
    const dx = this.pDx[slot];
    const dy = this.pDy[slot];
    const dz = this.pDz[slot];
    const pr = this.pRadius[slot];
    const owner = this.pOwner[slot];
    const len = Math.min(this.pSpeed[slot] * TICK_DT, this.pMaxDist[slot] - this.pTraveled[slot]);
    const terrainT = raycastTerrain(this.map, x, y, z, dx, dy, dz, len);
    let hitT = Infinity;
    let hitSlot = -1;
    if (owner >= 0) {
      for (let k = 0; k < this.activeCount; k++) {
        const s = this.active[k];
        const def = ENEMIES[this.eType[s]];
        const t = rayCylinder(x, y, z, dx, dy, dz, this.eX[s], this.eY[s], this.eZ[s] - pr, def.radius + pr, def.height + 2 * pr);
        if (t <= terrainT && t < hitT) {
          hitT = t;
          hitSlot = s;
        }
      }
      // A censer explodes on a soul like on an enemy (M8 §4.2); the explosion counts the hit.
      let soulT = Infinity;
      for (const o of this.players) {
        if (o.index === owner || !this.hasSoul(o)) continue;
        const t = rayCylinder(x, y, z, dx, dy, dz, o.x, o.y, this.soulBase(o) - pr, SOUL_RADIUS + pr, SOUL_HEIGHT + 2 * pr);
        if (t <= terrainT) soulT = Math.min(soulT, t);
      }
      if (soulT < hitT) {
        this.explodeCenser(slot, x + dx * soulT, y + dy * soulT, z + dz * soulT, -1);
        return;
      }
    } else {
      for (const p of this.players) {
        if (!this.livingTargetable(p)) continue;
        const t = rayCylinder(x, y, z, dx, dy, dz, p.x, p.y, p.z - pr, PLAYER_RADIUS + pr, PLAYER_HEIGHT + 2 * pr);
        if (t <= terrainT && t < hitT) {
          hitT = t;
          hitSlot = p.index;
        }
      }
    }
    if (hitSlot >= 0) {
      if (owner >= 0) this.explodeCenser(slot, x + dx * hitT, y + dy * hitT, z + dz * hitT, hitSlot);
      else {
        this.damagePlayer(this.slots[hitSlot]!, this.pDamage[slot]);
        this.removeProjectile(slot);
      }
      return;
    }
    if (terrainT < len) {
      if (owner >= 0) this.explodeCenser(slot, x + dx * terrainT, y + dy * terrainT, z + dz * terrainT, -1);
      else this.removeProjectile(slot);
      return;
    }
    const nx = x + dx * len;
    const ny = y + dy * len;
    const nz = z + dz * len;
    this.pX[slot] = nx;
    this.pY[slot] = ny;
    this.pZ[slot] = nz;
    this.pTraveled[slot] += len;
    if (this.pTraveled[slot] >= this.pMaxDist[slot] - 1e-9) {
      if (owner >= 0) this.explodeCenser(slot, nx, ny, nz, -1);
      else this.removeProjectile(slot);
      return;
    }
    if (nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h || nz > WALL_TOP) this.removeProjectile(slot);
  }

  /**
   * Censer explosion: 40 damage to the enemy hit directly (-1 for none), and 10 to the 6 other enemies
   * nearest the point within 2 m (§6.2, decisions.md).
   */
  private explodeCenser(slot: number, x: number, y: number, z: number, direct: number): void {
    const owner = this.pOwner[slot];
    const damage = this.pDamage[slot];
    this.pX[slot] = x;
    this.pY[slot] = y;
    this.pZ[slot] = z;
    this.removeProjectile(slot);
    const hit: Array<{ s: number; d: number }> = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (s === direct) continue;
      const def = ENEMIES[this.eType[s]];
      const d = distToCylinder(x, y, z, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height);
      if (d <= CENSER_BLAST) hit.push({ s, d });
    }
    // Stable sort: equal distances keep active-list order, so the result is deterministic.
    hit.sort((a, b) => a.d - b.d);
    if (direct >= 0) this.damageEnemy(direct, damage, owner);
    for (let i = 0; i < hit.length && i < CENSER_SPLASH_MAX; i++) this.damageEnemy(hit[i].s, CENSER_SPLASH_DAMAGE, owner);
    // Souls within 2.5 m count one hit each (M8 §4.2).
    const shooter = this.slots[owner];
    if (!shooter) return;
    for (const o of this.players) {
      if (o === shooter || !this.hasSoul(o)) continue;
      if (distToCylinder(x, y, z, o.x, o.y, this.soulBase(o), SOUL_RADIUS, SOUL_HEIGHT) <= REVIVE_CENSER_RADIUS) {
        this.addRevive(o, reviveHit(WEAPONS[shooter.classId].interval, shooter.classId === 'heretic'));
      }
    }
  }

  // ------------------------------------------------------------------ enemies

  private fallenIndex(): number {
    const f = this.players.find((p) => p.classId === 'fallen');
    return f ? f.index : -1;
  }

  /**
   * Targets the living, connected player with the lowest flow-field distance; Sinful halves the
   * Fallen's (§7.2). Blasphemy overrides this for its duration.
   */
  retarget(slot: number): void {
    if (this.eType[slot] === GATEKEEPER) {
      this.retargetBoss(slot);
      return;
    }
    if (this.eTauntUntil[slot] > this.tick) {
      const f = this.fallenIndex();
      if (f >= 0 && this.livingTargetable(this.slots[f])) {
        this.eTarget[slot] = f;
        return;
      }
    }
    const air = this.eType[slot] === CHERUB;
    const c = Math.floor(this.eX[slot]);
    const r = Math.floor(this.eY[slot]);
    let best = -1;
    let bestD = Infinity;
    for (const p of this.players) {
      if (!this.livingTargetable(p) || !this.fieldValid[p.index]) continue;
      const field = air ? this.airFields[p.index] : this.groundFields[p.index];
      let d = field.at(c, r);
      if (d === UNREACHABLE) continue;
      if (p.classId === 'fallen') d *= 0.5;
      if (d < bestD) {
        bestD = d;
        best = p.index;
      }
    }
    this.eTarget[slot] = best;
  }

  /** An enemy's eye: the Gatekeeper's is 5 m above its feet, every other enemy's at its body center (§2.3). */
  private eyeZ(slot: number): number {
    return this.eZ[slot] + (this.eType[slot] === GATEKEEPER ? BOSS_EYE : ENEMIES[this.eType[slot]].height / 2);
  }

  private bossSees(slot: number, p: SimPlayer): boolean {
    return lineOfSight(this.map, this.eX[slot], this.eY[slot], this.eyeZ(slot), p.x, p.y, p.z + PLAYER_HEIGHT / 2);
  }

  /**
   * Gatekeeper targeting (§7.2): the lowest straight-line distance among the players it has line of
   * sight to, Sinful halving the Fallen's. With none visible it keeps its target, or takes the nearest
   * living player if it has none. Blasphemy overrides this for its duration.
   */
  private retargetBoss(slot: number): void {
    const ex = this.eX[slot];
    const ey = this.eY[slot];
    const ez = this.eyeZ(slot);
    if (this.eTauntUntil[slot] > this.tick) {
      const f = this.fallenIndex();
      if (f >= 0 && this.livingTargetable(this.slots[f])) {
        this.eTarget[slot] = f;
        this.eLos[slot] = this.bossSees(slot, this.slots[f]) ? 1 : 0;
        return;
      }
    }
    let best = -1;
    let bestD = Infinity;
    let nearest = -1;
    let nearestD = Infinity;
    for (const p of this.players) {
      if (!this.livingTargetable(p)) continue;
      const d = distToCylinder(ex, ey, ez, p.x, p.y, p.z, PLAYER_RADIUS, PLAYER_HEIGHT);
      if (d < nearestD) {
        nearestD = d;
        nearest = p.index;
      }
      if (!this.bossSees(slot, p)) continue;
      const v = p.classId === 'fallen' ? d * 0.5 : d;
      if (v < bestD) {
        bestD = v;
        best = p.index;
      }
    }
    if (best >= 0) {
      this.eTarget[slot] = best;
      this.eLos[slot] = 1;
      return;
    }
    const cur = this.eTarget[slot];
    if (cur < 0 || !this.livingTargetable(this.slots[cur])) this.eTarget[slot] = nearest;
    this.eLos[slot] = 0;
  }

  private updateEnemies(): void {
    const tick = this.tick;
    // Attacks and statuses don't remove enemies, so the active list is stable during this loop.
    for (let k = 0; k < this.activeCount; k++) {
      const slot = this.active[k];
      this.eStartX[slot] = this.eX[slot];
      this.eStartY[slot] = this.eY[slot];
      const t = this.eTarget[slot];
      const targetGone = t >= 0 && !this.livingTargetable(this.slots[t]);
      if (targetGone || slot % RETARGET_TICKS === tick % RETARGET_TICKS) this.retarget(slot);
      const type = this.eType[slot];
      if (type === GATEKEEPER) {
        this.updateLos(slot);
        this.updateBoss(slot);
        continue;
      }
      if (this.ePullStart[slot] >= 0) {
        this.updatePull(slot);
        continue;
      }
      if (type !== BLESSED) this.updateLos(slot);
      if (tick > this.eKbFrom[slot] && tick <= this.eKbUntil[slot]) this.updateKnockback(slot);
      else if (type === CHERUB) this.updateCherub(slot);
      else this.updateWalker(slot);
      if (type === BLESSED) this.updateMelee(slot);
      else this.updateCast(slot);
    }
  }

  private updatePull(slot: number): void {
    const o = slot * 6;
    const f = Math.min(1, (this.tick - this.ePullStart[slot]) / ticks(CHAINS_PULL_TIME));
    const p = this.ePull;
    this.eX[slot] = p[o] + (p[o + 3] - p[o]) * f;
    this.eY[slot] = p[o + 1] + (p[o + 4] - p[o + 1]) * f;
    this.eZ[slot] = p[o + 2] + (p[o + 5] - p[o + 2]) * f;
    this.eState[slot] = ST_MOVING;
    if (f >= 1) {
      this.ePullStart[slot] = -1;
      this.eGrounded[slot] = 1;
      this.eVz[slot] = 0;
      this.root(slot, CHAINS_ROOT);
    }
  }

  private updateLos(slot: number): void {
    const t = this.eTarget[slot];
    if (t < 0 || slot % LOS_TICKS !== this.tick % LOS_TICKS) return;
    const p = this.slots[t];
    if (!p) return;
    this.eLos[slot] = lineOfSight(this.map, this.eX[slot], this.eY[slot], this.eyeZ(slot), p.x, p.y, p.z + PLAYER_HEIGHT / 2) ? 1 : 0;
  }

  /**
   * The Gatekeeper's casts and summons (§7.4, §5.6). A cast that becomes allowed when another one ends
   * starts on the next tick.
   */
  private updateBoss(slot: number): void {
    const tick = this.tick;
    const silenced = tick < this.eSilenceUntil[slot];
    const t = this.eTarget[slot];
    const wasCasting = this.bossCast !== BOSS_CAST_NONE;
    this.eState[slot] = ST_IDLE;

    if (tick >= this.summonDue) {
      // Not a cast: silence doesn't stop it.
      const ai = this.eArena[slot];
      const counts = [scaleCount(SUMMON.blessed, this.bossParty), 0, scaleCount(SUMMON.cherubs, this.bossParty)];
      if (ai >= 0) this.arenas[ai].queue.push({ counts, spawned: [0, 0, 0], wave: -1 });
      this.summonDue += ticks(SUMMON_INTERVAL);
    }

    if (this.bossCast === BOSS_CAST_VOLLEY) {
      if (silenced || t < 0) {
        this.bossCast = BOSS_CAST_NONE;
        this.volleyDue = tick + ticks(VOLLEY_INTERVAL);
      } else if (++this.bossCastTicks >= ticks(VOLLEY_WINDUP)) {
        this.fireVolley(slot);
        this.bossCast = BOSS_CAST_NONE;
        this.volleyDue = tick + ticks(VOLLEY_INTERVAL);
        this.eState[slot] = ST_ATTACKING;
      } else this.eState[slot] = ST_WINDUP;
    } else if (this.bossCast === BOSS_CAST_JUDGMENT) {
      if (silenced) this.interruptJudgment();
      else if (++this.bossCastTicks >= ticks(JUDGMENT_CAST)) this.completeJudgment(slot);
      else this.eState[slot] = ST_WINDUP;
    }
    if (wasCasting || silenced) return;

    if (tick >= this.judgmentDue) {
      this.bossCast = BOSS_CAST_JUDGMENT;
      this.bossCastTicks = 0;
      this.judgmentDamage = 0;
      this.eState[slot] = ST_WINDUP;
      this.events.push({ to: 'all', event: { type: 'bossCast', phase: 'start' } });
    } else if (tick >= this.volleyDue && t >= 0 && this.eLos[slot]) {
      this.bossCast = BOSS_CAST_VOLLEY;
      this.bossCastTicks = 0;
      this.eState[slot] = ST_WINDUP;
    }
  }

  /** Orb Volley: 8 orbs at the target's body center, rotated by evenly spread angles from −25° to +25°. */
  private fireVolley(slot: number): void {
    const p = this.slots[this.eTarget[slot]];
    if (!p) return;
    const ox = this.eX[slot];
    const oy = this.eY[slot];
    const oz = this.eyeZ(slot);
    const dx = p.x - ox;
    const dy = p.y - oy;
    const dz = p.z + PLAYER_HEIGHT / 2 - oz;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-9) return;
    for (let i = 0; i < VOLLEY_ORBS; i++) {
      const a = -VOLLEY_SPREAD + (2 * VOLLEY_SPREAD * i) / (VOLLEY_ORBS - 1);
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const rx = dx * ca - dy * sa;
      const ry = dx * sa + dy * ca;
      this.spawnProjectile(PROJ_ORB, ox, oy, oz, rx / len, ry / len, dz / len, VOLLEY_ORB.speed, VOLLEY_ORB.radius, VOLLEY_ORB.damage, PROJECTILE_RANGE, -1);
    }
  }

  /** Judgment completes: 100% of max HP to every living player whose eye sees the boss's eye. */
  private completeJudgment(slot: number): void {
    const bx = this.eX[slot];
    const by = this.eY[slot];
    const bz = this.eyeZ(slot);
    this.bossCast = BOSS_CAST_NONE;
    this.judgmentDue = this.tick + ticks(JUDGMENT_INTERVAL);
    this.eState[slot] = ST_ATTACKING;
    this.events.push({ to: 'all', event: { type: 'bossCast', phase: 'completed' } });
    for (const p of this.players) {
      if (!this.livingTargetable(p)) continue;
      if (lineOfSight(this.map, p.x, p.y, p.z + PLAYER_EYE, bx, by, bz)) this.damagePlayer(p, p.maxHp);
    }
  }

  /** Discord or 2 000 damage interrupts Judgment; the next one is due 25 s later. */
  private interruptJudgment(): void {
    if (this.bossCast !== BOSS_CAST_JUDGMENT) return;
    this.bossCast = BOSS_CAST_NONE;
    this.judgmentDue = this.tick + ticks(JUDGMENT_INTERVAL);
    this.events.push({ to: 'all', event: { type: 'bossCast', phase: 'interrupted' } });
  }

  /** Whether a caster's target is within its range with line of sight. */
  private casterInRange(slot: number): boolean {
    const t = this.eTarget[slot];
    if (t < 0 || !this.eLos[slot]) return false;
    const p = this.slots[t];
    if (!p) return false;
    const def = ENEMIES[this.eType[slot]];
    const range = CASTERS[this.eType[slot]].range;
    return distToCylinder(this.eX[slot], this.eY[slot], this.eZ[slot] + def.height / 2, p.x, p.y, p.z, PLAYER_RADIUS, PLAYER_HEIGHT) <= range;
  }

  private speedOf(slot: number): number {
    const s = ENEMIES[this.eType[slot]].speed;
    return this.tick < this.eSlowUntil[slot] ? s * SLOW_FACTOR : s;
  }

  private updateKnockback(slot: number): void {
    const b = this.loadBody(slot);
    const dx = this.eKbVx[slot] * TICK_DT;
    const dy = this.eKbVy[slot] * TICK_DT;
    if (b.flying) moveHorizontal(this.map, b, dx, dy);
    else stepBody(this.map, b, dx, dy, TICK_DT);
    this.storeBody(slot, b);
    this.eState[slot] = !b.grounded ? ST_FALLING : ST_MOVING;
  }

  private loadBody(slot: number): Body {
    const b = this.body;
    const def = ENEMIES[this.eType[slot]];
    b.x = this.eX[slot];
    b.y = this.eY[slot];
    b.z = this.eZ[slot];
    b.vz = this.eVz[slot];
    b.grounded = this.eGrounded[slot] === 1;
    b.radius = def.radius;
    b.flying = def.flying;
    return b;
  }

  private storeBody(slot: number, b: Body): void {
    this.eX[slot] = b.x;
    this.eY[slot] = b.y;
    this.eZ[slot] = b.z;
    this.eVz[slot] = b.vz;
    this.eGrounded[slot] = b.grounded ? 1 : 0;
  }

  /**
   * Steering (§7.3): toward the center of the best neighbor cell, or directly toward the target when
   * in its cell or an adjacent one. Writes the horizontal direction and the distance available.
   */
  private steer(slot: number, field: FlowField, p: SimPlayer, out: { dx: number; dy: number; dist: number; direct: boolean }): boolean {
    const x = this.eX[slot];
    const y = this.eY[slot];
    const c = Math.floor(x);
    const r = Math.floor(y);
    const tc = Math.floor(p.x);
    const tr = Math.floor(p.y);
    let gx: number;
    let gy: number;
    if (Math.abs(c - tc) <= 1 && Math.abs(r - tr) <= 1) {
      gx = p.x;
      gy = p.y;
      out.direct = true;
    } else {
      const n = field.bestNeighbor(c, r);
      if (n < 0) return false;
      gx = (n % this.map.w) + 0.5;
      gy = Math.floor(n / this.map.w) + 0.5;
      out.direct = false;
    }
    const dx = gx - x;
    const dy = gy - y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return false;
    out.dx = dx / d;
    out.dy = dy / d;
    out.dist = d;
    return true;
  }

  private readonly steerOut = { dx: 0, dy: 0, dist: 0, direct: false };

  /** Blessed and Choristers: follow the ground field; Choristers stop to cast in range. */
  private updateWalker(slot: number): void {
    const type = this.eType[slot];
    const b = this.loadBody(slot);
    const t = this.eTarget[slot];
    let mx = 0;
    let my = 0;
    const rooted = this.tick < this.eRootUntil[slot];
    const holds = type === CHORISTER && (this.eCast[slot] === 1 || this.casterInRange(slot));
    const p = t >= 0 ? this.slots[t] : undefined;
    if (p && !rooted && !holds) {
      const s = this.steerOut;
      if (this.steer(slot, this.groundFields[t], p, s)) {
        let step = this.speedOf(slot) * TICK_DT;
        if (s.direct && type === BLESSED) step = Math.min(step, s.dist - BLESSED_STOP);
        else if (s.direct) step = Math.min(step, s.dist);
        if (step > 0) {
          mx = s.dx * step;
          my = s.dy * step;
        }
      }
    }
    stepBody(this.map, b, mx, my, TICK_DT);
    this.storeBody(slot, b);
    this.eState[slot] = !b.grounded ? ST_FALLING : mx !== 0 || my !== 0 ? ST_MOVING : ST_IDLE;
  }

  private updateCherub(slot: number): void {
    const b = this.loadBody(slot);
    const t = this.eTarget[slot];
    let mx = 0;
    let my = 0;
    let strafing = false;
    const rooted = this.tick < this.eRootUntil[slot];
    const p = t >= 0 ? this.slots[t] : undefined;
    if (p && !rooted) {
      if (this.casterInRange(slot)) {
        strafing = true;
        const base = Math.atan2(p.y - b.y, p.x - b.x);
        const a = base + (this.eStrafe[slot] * Math.PI) / 2;
        const v = CHERUB_STRAFE_SPEED * (this.tick < this.eSlowUntil[slot] ? SLOW_FACTOR : 1) * TICK_DT;
        mx = Math.cos(a) * v;
        my = Math.sin(a) * v;
      } else {
        const s = this.steerOut;
        if (this.steer(slot, this.airFields[t], p, s)) {
          const v = this.speedOf(slot) * TICK_DT;
          const step = s.direct ? Math.min(v, s.dist) : v;
          mx = s.dx * step;
          my = s.dy * step;
        }
      }
    }
    this.moveResult.blocked = false;
    moveHorizontal(this.map, b, mx, my, this.moveResult);
    if (strafing) {
      this.eStrafeT[slot] += TICK_DT;
      if (this.moveResult.blocked || this.eStrafeT[slot] >= CHERUB_STRAFE_SWITCH - 1e-9) {
        this.eStrafe[slot] = -this.eStrafe[slot];
        this.eStrafeT[slot] = 0;
      }
    }
    // Hover with the feet 4 m above the ground height, changing height at up to 6 m/s.
    const g = groundHeight(this.map, b.x, b.y, b.radius, Infinity, false, true);
    if (g !== -Infinity) {
      const want = g + CHERUB_HOVER;
      const maxDz = CHERUB_CLIMB * TICK_DT;
      b.z += Math.max(-maxDz, Math.min(maxDz, want - b.z));
    }
    this.storeBody(slot, b);
    this.eState[slot] = mx !== 0 || my !== 0 ? ST_MOVING : ST_IDLE;
  }

  /**
   * Blessed melee (§7.1): while within 1.2 m horizontally and less than 1.5 m apart in height, 5 damage
   * 0.5 s after entering range, then every 1 s. Leaving range resets the timer.
   */
  private updateMelee(slot: number): void {
    const t = this.eTarget[slot];
    let inRange = false;
    const p = t >= 0 ? this.slots[t] : undefined;
    if (p) {
      inRange = Math.hypot(p.x - this.eX[slot], p.y - this.eY[slot]) <= MELEE_RANGE && Math.abs(p.z - this.eZ[slot]) < MELEE_HEIGHT;
    }
    if (!inRange) {
      this.eMeleeNext[slot] = -1;
      return;
    }
    if (this.eMeleeNext[slot] < 0) this.eMeleeNext[slot] = MELEE_FIRST;
    this.eMeleeNext[slot] -= TICK_DT;
    if (this.eMeleeNext[slot] <= 1e-9) {
      this.damagePlayer(p!, MELEE_DAMAGE);
      this.eMeleeNext[slot] += MELEE_INTERVAL;
    }
    if (this.eState[slot] !== ST_FALLING) this.eState[slot] = ST_ATTACKING;
  }

  /**
   * Chorister and Cherub casts (§7.1, §5.6): a wind-up, then a projectile at the target's body center;
   * the next cast may start `recovery` seconds after firing. Silence cancels a wind-up and keeps new
   * ones from starting until it ends.
   */
  private updateCast(slot: number): void {
    const c = CASTERS[this.eType[slot]];
    if (this.eCastCd[slot] > 0) this.eCastCd[slot] = Math.max(0, this.eCastCd[slot] - TICK_DT);
    const silenced = this.tick < this.eSilenceUntil[slot];
    const t = this.eTarget[slot];
    if (this.eCast[slot] === 1) {
      if (silenced || t < 0) {
        this.eCast[slot] = 0;
        this.eCastT[slot] = 0;
        return;
      }
      this.eCastT[slot] += TICK_DT;
      this.eState[slot] = ST_WINDUP;
      if (this.eCastT[slot] >= c.windup - 1e-9) {
        this.fireCast(slot, c);
        this.eCast[slot] = 0;
        this.eCastT[slot] = 0;
        this.eCastCd[slot] = c.recovery;
        this.eState[slot] = ST_ATTACKING;
      }
      return;
    }
    if (!silenced && t >= 0 && this.eCastCd[slot] <= 1e-9 && this.casterInRange(slot)) {
      this.eCast[slot] = 1;
      this.eCastT[slot] = 0;
      this.eState[slot] = ST_WINDUP;
    }
  }

  private fireCast(slot: number, c: CasterDef): void {
    const p = this.slots[this.eTarget[slot]];
    if (!p) return;
    const def = ENEMIES[this.eType[slot]];
    const ox = this.eX[slot];
    const oy = this.eY[slot];
    const oz = this.eZ[slot] + def.height / 2;
    let dx = p.x - ox;
    let dy = p.y - oy;
    let dz = p.z + PLAYER_HEIGHT / 2 - oz;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-9) return;
    dx /= len;
    dy /= len;
    dz /= len;
    this.spawnProjectile(c.kind, ox, oy, oz, dx, dy, dz, c.speed, c.radius, c.damage, PROJECTILE_RANGE, -1);
  }

  /** Pushes overlapping enemies apart, half the overlap each, up to 8 neighbors (§7.3). */
  private separate(layer: 0 | 1): void {
    const { w, h } = this.map;
    const start = this.hashStart[layer];
    const items = this.hashItems[layer];
    const cells = w * h;
    start.fill(0);
    const isLayer = (slot: number) => {
      const t = this.eType[slot];
      return t !== GATEKEEPER && (t === CHERUB) === (layer === 1);
    };
    const cellOf = (slot: number) => {
      let c = Math.floor(this.eX[slot]);
      let r = Math.floor(this.eY[slot]);
      c = c < 0 ? 0 : c >= w ? w - 1 : c;
      r = r < 0 ? 0 : r >= h ? h - 1 : r;
      return r * w + c;
    };
    let n = 0;
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (!isLayer(s)) continue;
      start[cellOf(s) + 1]++;
      n++;
    }
    if (n < 2) return;
    for (let i = 0; i < cells; i++) start[i + 1] += start[i];
    const fill = this.hashFill;
    fill.set(start.subarray(0, cells));
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (!isLayer(s)) continue;
      items[fill[cellOf(s)]++] = s;
    }

    const b = this.body;
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (!isLayer(s) || this.ePullStart[s] >= 0) continue;
      const def = ENEMIES[this.eType[s]];
      const x = this.eX[s];
      const y = this.eY[s];
      const z = this.eZ[s];
      const c0 = Math.floor(x);
      const r0 = Math.floor(y);
      let px = 0;
      let py = 0;
      let found = 0;
      for (let r = r0 - 1; r <= r0 + 1 && found < MAX_SEPARATION_NEIGHBORS; r++) {
        if (r < 0 || r >= h) continue;
        for (let c = c0 - 1; c <= c0 + 1 && found < MAX_SEPARATION_NEIGHBORS; c++) {
          if (c < 0 || c >= w) continue;
          const cell = r * w + c;
          for (let j = start[cell]; j < start[cell + 1]; j++) {
            const o = items[j];
            if (o === s) continue;
            const od = ENEMIES[this.eType[o]];
            const oz = this.eZ[o];
            if (z >= oz + od.height || oz >= z + def.height) continue;
            const dx = x - this.eX[o];
            const dy = y - this.eY[o];
            const min = def.radius + od.radius;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min) continue;
            const d = Math.sqrt(d2);
            const push = (min - d) / 2;
            if (d > 1e-6) {
              px += (dx / d) * push;
              py += (dy / d) * push;
            } else {
              // Exactly on top of each other: push along a fixed angle from the slot numbers.
              const a = ((s * 7 + o * 13) % 16) * (Math.PI / 8);
              px += Math.cos(a) * push;
              py += Math.sin(a) * push;
            }
            if (++found >= MAX_SEPARATION_NEIGHBORS) break;
          }
        }
      }
      if (found === 0) continue;
      // Pushes from the crowd behind mustn't carry an enemy faster than it walks: limit this tick's
      // total displacement to its speed (or to its own movement, if that was already longer).
      const sx = this.eStartX[s];
      const sy = this.eStartY[s];
      const tx = x + px - sx;
      const ty = y + py - sy;
      const total = Math.hypot(tx, ty);
      const limit = Math.max(def.speed * TICK_DT, Math.hypot(x - sx, y - sy));
      if (total > limit) {
        const k2 = limit / total;
        px = sx + tx * k2 - x;
        py = sy + ty * k2 - y;
      }
      this.loadBody(s);
      if (tryDisplace(this.map, b, px, py)) {
        this.eX[s] = b.x;
        this.eY[s] = b.y;
      }
    }
  }

  // ------------------------------------------------------------------ snapshots

  /** Living enemies in the current arena plus its enemies not yet spawned (§8.2). */
  enemiesRemaining(): number {
    const { arenaIndex } = this.arenaStatus();
    const st = this.arenas[arenaIndex];
    if (!st) return 0;
    if (this.map.arenas[arenaIndex].boss) return st.alive;
    let n = st.alive;
    for (const q of st.queue) for (let t = 0; t < 3; t++) n += q.counts[t] - q.spawned[t];
    const waves = this.map.arenas[arenaIndex].waves;
    if (!this.noWaves && !this.bench) {
      for (let i = st.wave + 1; i < waves.length; i++) {
        const w = waves[i];
        n += scaleCount(w.blessed, st.partySize) + scaleCount(w.choristers, st.partySize) + scaleCount(w.cherubs, st.partySize);
      }
    }
    return n;
  }

  /** The boss fields of the snapshot header; 0 outside the boss fight (§9.4). */
  private bossHeader(): Pick<SnapshotHeader, 'bossHp' | 'bossMaxHp' | 'bossCast' | 'bossCastProgress'> {
    const s = this.bossSlot;
    if (s < 0) return { bossHp: 0, bossMaxHp: 0, bossCast: BOSS_CAST_NONE, bossCastProgress: 0 };
    const len = this.bossCast === BOSS_CAST_VOLLEY ? ticks(VOLLEY_WINDUP) : ticks(JUDGMENT_CAST);
    const progress = this.bossCast === BOSS_CAST_NONE ? 0 : Math.min(255, Math.round((this.bossCastTicks / len) * 255));
    return { bossHp: Math.max(0, this.eHp[s]), bossMaxHp: Math.round(this.bossMaxHp), bossCast: this.bossCast, bossCastProgress: progress };
  }

  private prepareSnapshot(): void {
    if (this.preparedTick === this.tick) return;
    this.preparedTick = this.tick;
    const e = this.ent;
    const tick = this.tick;
    e.enemyCount = this.activeCount;
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      e.enemySlot[k] = s;
      e.enemyX[k] = this.eX[s];
      e.enemyY[k] = this.eY[s];
      e.enemyTypeState[k] = (this.eType[s] & 0x0f) | (this.eState[s] << 4);
      let f = 0;
      if (s === this.markSlot && tick < this.markUntil) f |= FLAG_MARKED;
      if (this.isRooted(s)) f |= FLAG_ROOTED;
      if (tick < this.eSilenceUntil[s]) f |= FLAG_SILENCED;
      if (tick < this.eSlowUntil[s]) f |= FLAG_SLOWED;
      if (tick < this.eTauntUntil[s]) f |= FLAG_TAUNTED;
      this.baseFlags[k] = f;
    }
    e.projectileCount = this.projectiles.length;
    this.projectiles.forEach((slot, i) => {
      e.projSlot[i] = slot;
      e.projKind[i] = this.pKind[slot];
      e.projX[i] = this.pX[slot];
      e.projY[i] = this.pY[slot];
      e.projZ[i] = this.pZ[slot];
    });
  }

  /** Encodes this tick's snapshot for one recipient (the `hurt` flag is per recipient). */
  encodeFor(recipientId: number): ArrayBuffer[] {
    this.prepareSnapshot();
    const e = this.ent;
    const since = this.lastSentTick.get(recipientId) ?? -1;
    for (let k = 0; k < e.enemyCount; k++) {
      const s = e.enemySlot[k];
      e.enemyFlags[k] = this.baseFlags[k] | (this.eHurtTick[s] > since ? FLAG_HURT : 0);
    }
    this.lastSentTick.set(recipientId, this.tick);
    const { arenaIndex, arenaPhase } = this.arenaStatus();
    const header: SnapshotHeader = {
      tick: this.tick,
      arenaIndex,
      arenaPhase,
      countdown: Math.ceil(this.countdownLeft() * 10 - 1e-6),
      enemiesRemaining: this.enemiesRemaining(),
      ...this.bossHeader(),
    };
    const players: SnapshotPlayer[] = [];
    for (const p of this.players) {
      if (!p.connected) continue;
      players.push({
        id: p.id,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        hp: p.hp,
        shield: p.shield,
        dead: p.dead,
        // Rounded to whole ms: the countdown leaves float dust (1e-16 s) that would show as "not ready".
        cdQ: Math.round(p.cdQ * 1000),
        cdE: Math.round(p.cdE * 1000),
        kills: p.kills,
        revive: p.dead ? p.revive * 255 : 0,
        shots: p.shots & 0xff,
        shots2: p.shots2 & 0xff,
        beam: this.tick < p.beamUntil ? p.beamId : ALLY_NONE,
      });
    }
    return encodeSnapshot(header, players, e);
  }
}

export { PHASE_CLEARED, PHASE_COMBAT, PHASE_IDLE };
