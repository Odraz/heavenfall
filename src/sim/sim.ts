/** The host simulation: pure TypeScript, no three.js or DOM (§2.2). */
import { CLASSES, type ClassId } from '../data/classes';
import { copyInventory, emptyInventory, FEATHER_SPEED, ITEM_IDS, isItemId, PLUME_LIFT, PLUME_THROW, type Inventory, type ItemId } from '../data/items';
import { Consumables } from './consumables';
import { VictoryExit } from './victory';
import { levelForXp } from '../profile/model';
import type { Profile } from '../profile/model';
import { saturatingAdd } from '../profile/model';
import type { Floor } from '../gen/generate';
import { ScopedRequests } from '../net/requests';
import { buyItem, CHART_PRICE, stairPoints, type InteractionResult } from './shop';
import type { DungeonDef, WaveDef } from '../data/dungeons/types';
import {
  BLESSED,
  CHERUB,
  CHERUB_CLIMB,
  CHERUB_HOVER,
  CHORISTER,
  DOMINION, CANTOR, CARRIER, isCommander,
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
  BLASPHEMY_STUN,
  CLOUD_DAMAGE,
  CLOUD_MAX,
  CLOUD_PULSE_TICKS,
  CLOUD_RADIUS,
  CLOUD_TIME,
  CENSER_RADIUS,
  CENSER_SPEED,
  CHAINS_ANGLE,
  CHAINS_MAX,
  CHAINS_PULL_TIME,
  CHAINS_RANGE,
  CHAINS_ROOT,
  COMMUNION_HEAL,
  COMMUNION_RADIUS,
  DISCORD_HALF_ANGLE,
  DISCORD_RANGE,
  DISCORD_SILENCE,
  FALLING_STAR_CRATER,
  FALLING_STAR_DAMAGE,
  FALLING_STAR_LANDING_TICKS,
  FALLING_STAR_RADIUS,
  FALLING_STAR_REACH_DAMAGE,
  FALLING_STAR_KNOCKBACK_TIME,
  KNOCKBACK_DIST,
  KNOCKBACK_TIME,
  SHOTGUN_CLOSE_DAMAGE,
  SHOTGUN_KNOCKBACK_DIST,
  SHOTGUN_KNOCKBACK_RANGE,
  SHROUD_BURST_DAMAGE,
  SHROUD_BURST_RADIUS,
  MOVEMENT_GRACE,
  MOVEMENT_SPEED_CHECK_SKIP,
  SHADOWSTEP_CUT_DAMAGE,
  SHADOWSTEP_CUT_REACH,
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
import type { FloorSync, GameEvent, InventoryState, PlayerStats } from '../net/messages';
import {
  ALLY_NONE,
  encodeSnapshot,
  FLAG_HURT,
  FLAG_ROOTED,
  FLAG_SILENCED,
  FLAG_SLOWED,
  FLAG_STUNNED,
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
  MAX_LIVING_ENEMIES,
  PLAYER_EYE,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  PLAYER_SLOTS,
  PROJECTILE_SLOTS,
  SLOT_REUSE_TICKS,
  TICK_DT,
  TICK_HZ,
  TICK_MS,
  WALL_TOP,
} from './constants';
import { aimDir, burstAngle, burstTier, rayCylinder, silverBulletHits } from './combat';
import { Director, ENGAGED_HIT_TICKS, ENGAGED_RADIUS, KILL_NEAR_RADIUS, type DirectorInfo } from './director';
import { FIELD_FIRE_RATE, FIELD_TIME, fieldCenter, inField, walkDestination } from './field';
import { directStepAllowed, FlowField, UNREACHABLE } from './flowfield';
import { DryNavigation, FIRE_ENEMY_DAMAGE, FIRE_PLAYER_DAMAGE, Hazards } from './hazards';
import { SpawnWarnings } from './spawnWarnings';
import { lineOfSight, raycastTerrain } from './los';
import { applyLeaves, insideRect, loadMap, overVoid, type GameMap } from './map';
import { distToCylinder, groundHeight, moveHorizontal, stepBody, tryDisplace, type Body, type MoveResult } from './movement';
import { mulberry32 } from './rng';
import { COIN, DROPPED_ITEM_LIFETIME, GOLD_HALO, HEAL_MOTE, ITEM_FIRST, PICKUP_CAP, REWARD_GOLD_VALUE, RITE_PAGE_HALOS, itemDrop, type PickupRecord } from '../data/pickups';
import { LOOT_ROLL, PROP_HEIGHT, PROP_BLAST_PLAYER_DAMAGE, type PropDef } from '../data/props';
import { Props, type Prop } from './props';
import { HaloLedger, HALO_WEIGHT, haloBudget, moteCap } from './economy';
import { Pickups } from './pickups';
import { Dominions } from './dominion';
import { Commanders, carryPathClear, type beamSegment } from './commanders';
import { hymnalReduction } from '../data/commanders';
import { directionalSpeedFactor } from '../data/movement';
import { dominionLeapClear } from './dominionLeap';
import { DOMINION_ALIVE_CAP, DOMINION_COOLDOWN_TICKS, DOMINION_REACH, DOMINION_RADIUS, DOMINION_HEIGHT_TOLERANCE, DOMINION_ENEMY_DAMAGE, DOMINION_PLAYER_DAMAGE, DOMINION_LAUNCH_SPEED, dominionFalloff, DOMINION_LAUNCH_SECONDS, DOMINION_LAUNCH_VZ, DOMINION_LEAP_CHARGE_TICKS, DOMINION_LEAP_LEAD_SECONDS, DOMINION_LEAP_MIN_RANGE, DOMINION_LEAP_MAX_RANGE, DOMINION_TELL_TICKS, DOMINION_MELEE_RANGE, DOMINION_MELEE_DAMAGE, dominionLeapPosition, type DominionLeap, type DominionCast, type DominionPhase } from '../data/dominion';
import { REVIVE_CENSER_RADIUS, REVIVE_COMMUNION, REVIVE_DECAY, REVIVE_HP, REVIVE_INVULNERABLE, reviveHit, reviveSlowdown, SOUL_HEIGHT, SOUL_RADIUS, soulRise, SOUL_RISE_TIME } from './souls';

/** Linear party scaling, including half-player bots (rogue game.md §0). */
export function partyMultiplier(partySize: number): number {
  return (2 + 2 * Math.max(1, Math.min(4, partySize))) / 10;
}

/**
 * The Gatekeeper's HP and Judgment's interrupt multiplier: 0.3 for a solo game (M12 follow-up §3.3,
 * was 0.4), the party-size multiplier otherwise.
 */
export function bossMultiplier(partySize: number, solo = partySize === 1): number {
  return solo ? 0.3 : partyMultiplier(partySize);
}

/** A wave's enemies for the party size, each type and its squad (M12 follow-up §4.2) scaled. */
export function waveSize(w: WaveDef, partySize: number): number {
  return scaleCount(w.blessed, partySize) + scaleCount(w.choristers, partySize) + scaleCount(w.cherubs, partySize) + scaleCount(w.dominions ?? 0, partySize) + (w.squad ? scaleCount(w.squad.count, partySize) : 0);
}

/** Scales one enemy count for the party size, rounding up (§7.5). */
export function scaleCount(count: number, partySize: number): number {
  return Math.max(0, Math.ceil(count * partyMultiplier(partySize) - 1e-9));
}

export interface SimPlayerInit {
  profile?: Profile;
  /** The player ID, which is also its index: its spawn and entry cells (M8 §6.2). */
  id: number;
  name: string;
  classId: ClassId;
  /** Absent in inherited simulation fixtures; real sessions always carry it from admission. */
  bot?: boolean;
}

export interface SimOptions {
  floor?: Floor | null;
  progressionEnabled?: boolean;
  dungeon: DungeonDef;
  /** Real sessions always supply it; standalone simulation fixtures use the zero identity. */
  runId?: string;
  /** Reuse the map already generated and validated during Loading. */
  map?: GameMap;
  /** Generated, seed-selected prop bodies. Fixed fixtures retain their inherited content. */
  props?: readonly PropDef[];
  /** Players at `go`; each one's index is its ID (M8 §6.2). */
  players: SimPlayerInit[];
  seed: number;
  /** Every player is invulnerable (`god=1`). */
  god?: boolean;
  /** The benchmark's room (§2.5, M10 gate §4); absent or -1 when not benchmarking. */
  benchRoom?: number;
  /** With `benchRoom`: every 0.5 s, 40 damage to the 20 Blessed nearest a point 8 m ahead of player 0 (M12 §10). */
  benchBurst?: boolean;
  /** Arena waves are disabled (tests). */
  noWaves?: boolean;
  /** Dev entry: fixtures clear rooms before N; generated floors clear every other room. */
  startRoom?: number;
}

export interface SimEvent {
  to: number | 'all';
  tick: number;
  revision: number;
  event: GameEvent;
}

export interface SimPlayer {
  offerKey: string;
  sold: number;
  xpBase: number;
  requests: ScopedRequests<InteractionResult>;
  inventory: Inventory;
  runXp: number;
  xpCorrection: number;
  itemsTried: ItemId[];
  id: number;
  /** Equal to the ID (M8 §6.2). */
  index: number;
  name: string;
  classId: ClassId;
  bot: boolean;
  speed: number;
  maxHp: number;
  hp: number;
  wallet: number;
  itemReadyTick: number;
  featherUntil: number;
  sealUntil: number;
  itemPresses: [number, number];
  pendingItems: [boolean, boolean];
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
  /** Who cast the current shield; it bursts for them when damage breaks it (M9 §3.3). */
  shieldCaster: SimPlayer | null;
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
  /** Damage dealt to enemies, up to their remaining HP, for Results. */
  damage: number;
  /** Revives this player helped with, for Results. */
  reviveAssists: number;
  /** Primary attacks fired, for others' shot sounds (M8 §9.1); wrapped only in snapshots. */
  shots: number;
  /** Secondary attacks fired (M9 §10). */
  shots2: number;
  /** The ally Sacrament last healed, sent as the `beam` while tick < beamUntil (M9 §2.5). */
  beamId: number;
  beamUntil: number;
  /** Revive progress of the player's soul, 0–1, while dead (M8 §4.2). */
  revive: number;
  /** Times the player has died this game; reviving slows from the second (M9 review). */
  deaths: number;
  /** Bit per player index that added to this soul's revive progress since it last was 0. */
  revivers: number;
  /** Tick the soul started rising (the death); its ground point is the dead player's feet. */
  soulTick: number;
  /** Seconds of cooldown remaining. */
  cdQ: number;
  cdE: number;
  /** Tick of the last hit that did damage after invulnerability (for regeneration). */
  lastDamageTick: number;
  /** Tick of the last `damagePlayer` hit that removed HP or shield; unlike `lastDamageTick`, revive and respawn don't set it (M12 §2.3). */
  lastHurtTick: number;
  /** Highest accepted input sequence number, or -1. */
  lastSeq: number;
  /** Host time (ms) when the previous accepted input arrived, or the latest teleport. */
  lastAcceptMs: number;
  /** Smoothed ordinary horizontal velocity from accepted inputs; never a dash or correction. */
  moveVx: number;
  moveVy: number;
  /** The Betrayer's Shadowstep being recorded and cut along (M12 §5.7), or null. */
  dash: DashRecord | null;
  /** The host's latest teleport ID for this player. */
  teleportId: number;
  /** Speed check skipped until this host time (ms). */
  speedCheckSkipUntil: number;
  /** -1 awaits the launch correction's first acknowledged input; otherwise a bounded host deadline. */
  launchUntilMs: number;
}

/**
 * A Shadowstep's path (M12 §5.7): from the press on, each accepted position is appended; once the host
 * accepts the press, the path's new segments cut each tick until the window closes.
 */
interface DashRecord {
  /** The `seq` of the input whose `ePresses` changed. */
  pressSeq: number;
  /** x, y, z triples: the accepted position before the press input, then each accepted input's up to `pressSeq + 9`. */
  pts: number[];
  /** Points whose segment from the previous point has been cut along (the first has none). */
  done: number;
  /** The tick `useE` accepted the press, or -1 before. */
  acceptTick: number;
  /** An input with `seq ≥ pressSeq + 9` was accepted: nothing more is appended. */
  full: boolean;
  /** Enemies this dash already cut. */
  cut: Set<number>;
}

interface SpawnBatch {
  counts: number[];
  spawned: number[];
  /** Wave index, or -1 for benchmark top-ups and summons. */
  wave: number;
}

interface RoomState {
  /** Knowledge replication and neighbour discovery arrive in R1.5. */
  knowledge: number;
  entrySocket: number;
  cancelTicks: number;
  refills: number;
  lastHumanTick: number;
  trickleAt: number;
  humanInside: boolean;
  lastLivingTick: number;
  holdUsed: number;
  phase: number;
  /** Index of the latest started wave, or -1. */
  wave: number;
  queue: SpawnBatch[];
  /** Round-robin position over the spawn points. */
  rr: number;
  budgets: Float64Array;
  waveTotals: number[];
  waveAlive: number[];
  waveFullySpawned: boolean[];
  /** Living enemies belonging to this room (not counting the Gatekeeper). */
  alive: number;
  /** During the countdown: the tick the room seals (M8 §5). */
  sealTick: number;
  /** Players in the game when it sealed, for party-size scaling (M8 §6.3); 0 before. */
  partySize: number;
  /** A combat arena's director (M12 §2.3), made at the seal; null otherwise. */
  director: Director | null;
  /** A combat arena's placements left this tick: a wave arrives over 10 s (M12 §2.2). */
  pace: number;
  /** ...gained per tick: the latest wave's total without its squad, over 10 s. */
  paceRate: number;
  /** The latest wave's squad still to place (M12 follow-up §4.2), or null. */
  squad: Squad | null;
}

/** A wave's squad being placed: `left` more of `type` on `at`, the next on tick `next` or later. */
interface Squad {
  type: number;
  at: Array<[number, number]>;
  left: number;
  next: number;
  rr: number;
  wave: number;
}

/** Globes fly at this speed, a Chorister's from this high above its feet (M12 follow-up §1.3). */
export const GLOBE_SPEED = 6;
export const GLOBE_CAST_Z = 2.3;

/** Projectile kinds, as encoded in snapshots (§9.4). */
export const PROJ_CENSER = 0;
/** A Chorister's or the Orb Volley's globe (M12 follow-up §1.3; was the orb, the same value). */
export const PROJ_GLOBE = 1;
export const PROJ_ARROW = 2;
const MAX_PROJECTILES = 400;
const PROJECTILE_RANGE = 60;

/** Enemy type order for spawning ties: Blessed, Choristers, Cherubs. */
const SPAWN_TYPES = [BLESSED, CHORISTER, CHERUB, DOMINION];
const SPAWN_ELIGIBLE_DIST = 8;
/** Combat arenas place a wave only on spawn points this far from every living player, when any are (M12 §2.2). */
const SPAWN_FAR_DIST = 15;
const SPAWN_MIN_DIST = 3;
/** A combat arena's wave arrives over this many ticks (M12 §2.2). */
const WAVE_ARRIVAL_TICKS = 10 * TICK_HZ;
export const CREST_ARRIVAL_TICKS = 6 * TICK_HZ;
export const CREST_SPAWN_RATE = 20;
/** A wave's squad starts this long after the wave, one every SQUAD_EVERY_TICKS (M12 follow-up §4.2). */
const SQUAD_DELAY_TICKS = 5 * TICK_HZ;
const SQUAD_EVERY_TICKS = TICK_HZ / 2;
/** Enemies per second each spawn point can place (§8.2 says 50; lowered after playtesting, see decisions.md). */
export const SPAWN_RATE = 10;
/** The benchmark's bursts (M12 §10). */
const BENCH_BURST_TICKS = TICK_HZ / 2;
const BENCH_BURST_AHEAD = 8;
const BENCH_BURST_COUNT = 20;
const BENCH_BURST_DAMAGE = 40;
const BUDGET_PER_TICK = SPAWN_RATE / TICK_HZ;
const BUDGET_MAX = 2;
const RETARGET_TICKS = TICK_HZ;
/** Line of sight is checked at most twice per second per enemy. */
const LOS_TICKS = TICK_HZ / 2;
const MAX_SEPARATION_NEIGHBORS = 8;

// Enemy behavior (§7.1).
const BLESSED_STOP = 1.0;
const MELEE_RANGE = 1.2;
const MELEE_HEIGHT = 1.5;
const MELEE_DAMAGE = 5;
/** M12 §3.2 (was 0.5): with the per-tick countdown, the first strike lands on the 8th tick in range (0.267 s). */
const MELEE_FIRST = 0.25;
const MELEE_INTERVAL = 1.0;
const CHORISTER_RANGE = 20;
const CHERUB_RANGE = 25;
const CHERUB_STRAFE_SPEED = 2;
const CHERUB_STRAFE_SWITCH = 2;

interface CasterDef {
  /** Where its projectile starts, above its feet; half its height when not given. */
  castZ?: number;
  range: number;
  windup: number;
  recovery: number;
  kind: number;
  speed: number;
  damage: number;
  radius: number;
}

const CASTERS: Record<number, CasterDef> = {
  // The globe leaves from the orb the Chorister holds above its head (2.3 m, as drawn) and flies at
  // 6 m/s, so it's seen coming and can be shot (M12 follow-up §1.3, after playtesting stage 9).
  [CHORISTER]: { castZ: GLOBE_CAST_Z, range: CHORISTER_RANGE, windup: 1.0, recovery: 1.5, kind: PROJ_GLOBE, speed: GLOBE_SPEED, damage: 12, radius: 0.3 },
  [CARRIER]: { range: CHERUB_RANGE, windup: 0.5, recovery: 1.3, kind: PROJ_ARROW, speed: 18, damage: 8, radius: 0.15 },
  [CHERUB]: { range: CHERUB_RANGE, windup: 0.5, recovery: 1.3, kind: PROJ_ARROW, speed: 18, damage: 8, radius: 0.15 },
};

// The Gatekeeper (§7.4).
export const BOSS_EYE = 5;
const VOLLEY_FIRST = 2;
const VOLLEY_INTERVAL = 4;
const VOLLEY_WINDUP = 0.5;
const VOLLEY_ORBS = 8;
const VOLLEY_SPREAD = (25 * Math.PI) / 180;
const VOLLEY_ORB = { speed: GLOBE_SPEED, damage: 15, radius: 0.3 };

// The globe (M12 follow-up §1.3).
/** A shattering globe hurts the players within this many meters of it, in its line of sight. */
export const GLOBE_BLAST = 1.5;
/** A player's ray or censer passing this close to a globe's path shatters it... */
export const GLOBE_SHOT_REACH = 0.5;
/**
 * ...over the path it flew in the last this many seconds, as far back as the client sees it drawn
 * (other players' render delay plus their input's way to the host), so it hits what was aimed at.
 */
export const GLOBE_SHOT_TRAIL = 0.25;
/** Shot down, it deals this to every enemy within GLOBE_SHOT_BLAST, in its line of sight, credited to the shooter. */
export const GLOBE_SHOT_DAMAGE = 40;
export const GLOBE_SHOT_BLAST = 3;
/** The shatter point is moved back along the flight this far for line of sight, out of the wall it hit. */
const GLOBE_LOS_BACK = 0.1;
const JUDGMENT_FIRST = 20;
const JUDGMENT_INTERVAL = 25;
const JUDGMENT_CAST = 3;
/** M9 §4 (was 2 000): Field of Blood replaced Kiss as the boss multiplier, and party damage on it fell. */
const JUDGMENT_INTERRUPT = 1300;
const SUMMON_FIRST = 30;
const SUMMON_INTERVAL = 30;
const SUMMON = { blessed: 150, cherubs: 10 };

/** Gatekeeper casts, as sent in snapshots (§9.4). */
export const BOSS_CAST_NONE = 0;
export const BOSS_CAST_VOLLEY = 1;
export const BOSS_CAST_JUDGMENT = 2;

/** No room is active (the snapshot's `activeRoom`, rogue game.md §14.3). */
export const ROOM_NONE = 255;

/** Human quorum countdown (rogue game.md §4.3), shortened when everyone is inside. */
const COUNTDOWN = 20;
const COUNTDOWN_ALL_IN = 3;
const COUNTDOWN_CANCEL = 3;

const REGEN_DELAY_TICKS = 8 * TICK_HZ;
const REGEN_FRACTION = 0.015;
/** A breath in single player (M12 §2.5, follow-up §3.1): in a combat arena's fight, only while its director relaxes. */
const BREATH_DELAY_TICKS = 2 * TICK_HZ;
const BREATH_FRACTION = 0.08;
/** Bound enemies take this much damage (M8 §8). */
const BOUND_FACTOR = 2;
/** Sacrament's `beam` stays on this long after its last firing (M9 §2.5). */
const BEAM_HOLD_TICKS = Math.round(0.6 * TICK_HZ);

/** A dash's path holds the inputs up to this many after the press; its window closes this long after acceptance (M12 §5.7). */
const DASH_INPUTS = 9;
const DASH_WINDOW_TICKS = 15;
/** A path segment longer than this is a teleport, not a dash, and cuts nothing. */
const DASH_MAX_SEGMENT = 12;

const ticks = (seconds: number) => Math.round(seconds * TICK_HZ);

/** The shortest distance between segments p0–p1 and q0–q1 (Ericson, Real-Time Collision Detection 5.1.9). */
export function segmentDistance(
  p0x: number, p0y: number, p0z: number, p1x: number, p1y: number, p1z: number,
  q0x: number, q0y: number, q0z: number, q1x: number, q1y: number, q1z: number,
): number {
  const d1x = p1x - p0x, d1y = p1y - p0y, d1z = p1z - p0z;
  const d2x = q1x - q0x, d2y = q1y - q0y, d2z = q1z - q0z;
  const rx = p0x - q0x, ry = p0y - q0y, rz = p0z - q0z;
  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  let s = 0;
  let t = 0;
  if (a <= 1e-12) {
    if (e > 1e-12) t = clamp(f / e);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;
    if (e <= 1e-12) s = clamp(-c / a);
    else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denom = a * e - b * b;
      s = denom > 1e-12 ? clamp((b * f - c * e) / denom) : 0;
      t = (b * s + f) / e;
      if (t < 0) {
        t = 0;
        s = clamp(-c / a);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a);
      }
    }
  }
  return Math.hypot(p0x + d1x * s - (q0x + d2x * t), p0y + d1y * s - (q0y + d2y * t), p0z + d1z * s - (q0z + d2z * t));
}

export class Simulation {
  readonly floor: Floor | null;
  chartRevealed = false;
  victory: VictoryExit | null = null;
  admissionClosed = false;
  get won(): boolean { return this.victory !== null; }
  readonly items = new Consumables(this);
  private readonly rewardRecipients = new Map<number, Set<string>>();
  private readonly pageRecipients = new Map<number, Set<string>>();
  private nextOfferKey = 1;
  readonly progressionEnabled: boolean;
  readonly retainedPlayers = new Map<number, { player: SimPlayer; tick: number }>();
  readonly eXp = new Float64Array(ENEMY_SLOTS);
  halosCredited = 0;
  readonly map: GameMap;
  readonly runId: string;
  /** The players in the game, sorted by ID. */
  readonly players: SimPlayer[] = [];
  /** The players by index, which is their ID (M8 §6.2); empty slots are undefined. */
  readonly slots: Array<SimPlayer | undefined> = new Array(PLAYER_SLOTS).fill(undefined);
  /** The benchmark's arena, or -1 when not benchmarking. */
  readonly benchRoom: number;
  private readonly benchBurst: boolean;
  readonly noWaves: boolean;
  /** Every player is invulnerable (`god=1`). */
  private readonly god: boolean;
  /** Seeded PRNG for all simulation randomness (§2.2); tests may replace it. */
  random: () => number;
  /** Ticks simulated so far; the tick being simulated during step(). */
  tick = 0;
  /** Host time of the current tick, ms. */
  nowMs = 0;
  readonly events: SimEvent[] = [];
  readonly rooms: RoomState[];
  /** The room in countdown or combat, ROOM_NONE when none (rogue game.md §4.2: at most one). */
  activeRoom = ROOM_NONE;
  /** The run's result, once decided; the simulation stops then. */
  result: null | 'victory' | 'defeat' = null;

  // Enemies, structure of arrays indexed by slot.
  readonly eAlive = new Uint8Array(ENEMY_SLOTS);
  readonly eIncarnation = new Uint32Array(ENEMY_SLOTS);
  readonly eSpawnTick = new Uint32Array(ENEMY_SLOTS);
  private nextIncarnation = 1;
  readonly pickups: Pickups;
  readonly props: Props;
  readonly dominions: Dominions;
  readonly commanders = new Commanders(this);
  readonly eGoldEntitled = new Uint8Array(ENEMY_SLOTS);
  private readonly eliteGold = new Map<number, number[]>();
  private readonly elitePlaced = new Map<number, number[]>();
  private livingDominions = 0;
  readonly haloLedgers = new Map<number, HaloLedger>();
  private readonly moteDrops = new Map<number, number>();
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
  /** Native area membership (Field of Blood or active ground hazard); no extra wire flag. */
  readonly ePooled = new Uint8Array(ENEMY_SLOTS);
  readonly eHp = new Float64Array(ENEMY_SLOTS);
  readonly eTarget = new Int8Array(ENEMY_SLOTS);
  private readonly eWaypoint = new Int32Array(ENEMY_SLOTS).fill(-1);
  private readonly eWaypointGoal = new Int32Array(ENEMY_SLOTS).fill(-1);
  readonly eRoom = new Int8Array(ENEMY_SLOTS);
  readonly eWave = new Int16Array(ENEMY_SLOTS);
  readonly home = new Uint8Array(ENEMY_SLOTS).fill(ROOM_NONE);
  readonly leashed = new Uint8Array(ENEMY_SLOTS);
  private readonly eUnreachableSince = new Int32Array(ENEMY_SLOTS).fill(-1);
  private readonly eRecoveryFailed = new Int32Array(ENEMY_SLOTS).fill(-1);
  private readonly eStillSince = new Int32Array(ENEMY_SLOTS);
  private readonly eStillX = new Float64Array(ENEMY_SLOTS);
  private readonly eStillY = new Float64Array(ENEMY_SLOTS);
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
  /** Stunned by Blasphemy (M12 §5.3): no steering, striking or casting. */
  readonly eStunUntil = new Int32Array(ENEMY_SLOTS);
  /** The last tick incense hurt the enemy: at most once per 15 ticks (M12 §5.4). */
  private readonly eIncenseTick = new Int32Array(ENEMY_SLOTS).fill(-CLOUD_PULSE_TICKS);
  /** Knocked back on ticks kbFrom < tick ≤ kbUntil. */
  readonly eKbUntil = new Int32Array(ENEMY_SLOTS);
  private readonly eKbFrom = new Int32Array(ENEMY_SLOTS);
  private readonly eKbVx = new Float64Array(ENEMY_SLOTS);
  private readonly eKbVy = new Float64Array(ENEMY_SLOTS);
  /** Chains pull: start tick (-1 = none), from and to. */
  readonly ePullStart = new Int32Array(ENEMY_SLOTS).fill(-1);
  private readonly ePull = new Float64Array(ENEMY_SLOTS * 6);
  /** Burst deaths (M12 §4.1): the force summed over the hits of tick `eForceTick`. */
  private readonly eForce = new Float64Array(ENEMY_SLOTS);
  private readonly eForceTick = new Int32Array(ENEMY_SLOTS).fill(-1);
  /** This tick's burst deaths: [slot, angle (+360 if heavy), playerId, …], sent as one `bursts` event. */
  private readonly tickBursts: number[] = [];
  // Casts and melee (§7.1).
  /** 1 while winding up a cast. */
  readonly eCast = new Uint8Array(ENEMY_SLOTS);
  readonly eCastT = new Float64Array(ENEMY_SLOTS);
  /** Seconds until the next cast may start. */
  readonly eCastCd = new Float64Array(ENEMY_SLOTS);
  /** Seconds until the next melee hit while in range; -1 when out of range. */
  readonly eMeleeNext = new Float64Array(ENEMY_SLOTS).fill(-1);
  /** Incense clouds (M9 §2.8), oldest first: where each censer broke, who threw it, and its ticks. */
  readonly clouds: Array<{ x: number; y: number; z: number; owner: SimPlayer; from: number; until: number }> = [];
  /** The one Field of Blood (M9 §3.4): its center and floor, active while tick < fieldUntil. */
  fieldX = 0;
  fieldY = 0;
  fieldZ = 0;
  fieldUntil = 0;

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
  private bossSolo = false;

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
  readonly pReflected = new Uint8Array(PROJECTILE_SLOTS);
  private readonly pHostileBudget = new Uint8Array(PROJECTILE_SLOTS);
  private readonly pOrigin = new Float64Array(PROJECTILE_SLOTS * 3);
  private readonly pRoom = new Uint8Array(PROJECTILE_SLOTS);
  private readonly pReflectOwner = new Map<number, SimPlayer>();
  private readonly pFreedTick = new Int32Array(PROJECTILE_SLOTS).fill(-SLOT_REUSE_TICKS);
  /** Living projectile slots, oldest first. */
  readonly projectiles: number[] = [];
  private readonly pFree: number[] = [];
  private pNextFresh = 0;

  /** Flow fields by player index, made when a player first takes the slot. */
  readonly groundFields: FlowField[] = [];
  readonly airFields: FlowField[] = [];
  readonly hazards: Hazards;
  readonly dryNavigation: DryNavigation;
  readonly spawnWarnings: SpawnWarnings;
  private readonly floorSpawnPoints = new Map<string, { room: number; c: number; r: number; budget: number }>();
  private readonly spawnBlockedSince = new Map<string, number>();
  private readonly spawnFloorCells = new Map<number, Uint32Array>();
  private floorScanTick = -1;
  private readonly recoveryArrivals = new Map<number, { incarnation: number; room: number; c: number; r: number; x: number; y: number; tick: number; unreachable: boolean }>();
  private readonly recoveryPointUsers = new Map<string, number>();
  private readonly hazardVictims = new Uint16Array(ENEMY_SLOTS);
  private readonly fieldValid: boolean[] = new Array(PLAYER_SLOTS).fill(false);

  // Separation spatial hashes (ground, air): counting sort of slots by cell.
  private readonly hashStart: [Int32Array, Int32Array];
  private readonly hashItems: [Int32Array, Int32Array];
  private readonly hashFill: Int32Array;

  /** Scratch for the director (M12 §2.3), by player index. */
  private readonly livingScratch: boolean[] = new Array(PLAYER_SLOTS).fill(false);
  private readonly engagedScratch: boolean[] = new Array(PLAYER_SLOTS).fill(false);

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
    enemyZ: new Float32Array(ENEMY_SLOTS),
    enemyIncarnation: new Uint32Array(ENEMY_SLOTS),
    projectileCount: 0,
    projSlot: new Uint16Array(MAX_PROJECTILES),
    projKind: new Uint8Array(MAX_PROJECTILES),
    projX: new Float32Array(MAX_PROJECTILES),
    projY: new Float32Array(MAX_PROJECTILES),
    projZ: new Float32Array(MAX_PROJECTILES),
    pickupCount: 0,
    pickupId: new Uint32Array(PICKUP_CAP),
    pickupX: new Float32Array(PICKUP_CAP),
    pickupY: new Float32Array(PICKUP_CAP),
    pickupKind: new Uint8Array(PICKUP_CAP),
  };
  private readonly baseFlags = new Uint8Array(ENEMY_SLOTS);
  private preparedTick = -1;
  private readonly lastSentTick = new Map<number, number>();

  constructor(opts: SimOptions) {
    this.floor = opts.floor ?? null;
    this.progressionEnabled = opts.progressionEnabled ?? false;
    this.runId = opts.runId ?? '00000000000000000000000000000000';
    this.map = opts.map ?? loadMap(opts.dungeon);
    this.hazards = new Hazards(this.map);
    this.dryNavigation = new DryNavigation(this.map, this.hazards.active);
    this.spawnWarnings = new SpawnWarnings((phase, warning) => this.emit('all', { type: 'spawnWarning', phase, warning }));
    this.pickups = new Pickups(this.map, (p) => this.emit('all', { type: 'pickupState', pickup: { ...p } }));
    this.props = new Props(this.map, opts.props ?? [], (p, origin) => this.propBroken(p, origin));
    this.dominions = new Dominions((phase, cast) => this.dominionPhase(phase, cast));
    this.benchRoom = opts.benchRoom ?? -1;
    this.benchBurst = !!opts.benchBurst && this.benchRoom >= 0;
    this.noWaves = !!opts.noWaves;
    this.random = mulberry32(opts.seed);
    this.rooms = this.map.rooms.map((a, i) => ({
      phase: a.kind === 'breach' ? PHASE_CLEARED : PHASE_IDLE,
      knowledge: a.kind === 'breach' ? 2 : 0,
      entrySocket: a.entry[0]?.socket ?? 0,
      cancelTicks: 0,
      refills: 3,
      lastHumanTick: 0,
      trickleAt: -1,
      humanInside: false,
      lastLivingTick: 0,
      holdUsed: 0,
      wave: -1,
      queue: [],
      rr: 0,
      budgets: new Float64Array(this.map.roomSpawnPoints[i].length),
      waveTotals: a.waves.map(() => 0),
      waveAlive: a.waves.map(() => 0),
      waveFullySpawned: a.waves.map(() => false),
      alive: 0,
      sealTick: 0,
      partySize: 0,
      director: null,
      pace: 0,
      paceRate: 0,
      squad: null,
    }));
    // Dev `arena=N`: the rooms before it are cleared, their doors open.
    const startRoom = this.benchRoom >= 0 ? 0 : Math.max(0, Math.min(opts.startRoom ?? 0, this.rooms.length - 1));
    for (let ai = 0; ai < startRoom; ai++) this.rooms[ai].phase = PHASE_CLEARED;
    if (opts.startRoom !== undefined && this.map.rooms.some((r) => r.kind === 'breach')) {
      for (let i = 0; i < this.rooms.length; i++) if (i !== startRoom) this.rooms[i].phase = PHASE_CLEARED;
    }
    for (const st of this.rooms) if (st.phase === PHASE_CLEARED) st.knowledge = 2;
    for (let i = 0; i < this.rooms.length; i++) if (this.rooms[i].knowledge === 2) this.discoverNeighbours(i);
    this.updateLeaves();
    this.god = !!opts.god;
    const useEntry = opts.startRoom !== undefined;
    for (const p of opts.players) {
      const [c, r] = this.benchRoom >= 0 ? this.map.rooms[this.benchRoom].entry[0].cells[0] : useEntry ? this.map.rooms[startRoom].entry[0].cells[p.id] : this.map.spawns[p.id];
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

  get solo(): boolean {
    const connected = this.players.filter((p) => p.connected);
    return connected.length === 1 && !connected[0].bot;
  }

  partySize(): number {
    let p = 0;
    for (const player of this.players) if (player.connected) p += player.bot ? 0.5 : 1;
    return Math.max(1, p);
  }

  private entry(ai: number) {
    const room = this.map.rooms[ai];
    return room.entry.find((e) => e.socket === this.rooms[ai].entrySocket) ?? room.entry[0];
  }

  stateRevision = 0;

  /** Detached records: subsequent simulation changes cannot mutate a queued checkpoint. */
  floorSync(runId: string): FloorSync {
    return { type: 'floorSync', runId, tick: this.tick, revision: this.stateRevision,
      progressionEnabled: this.progressionEnabled, inventories: this.players.map(p => this.inventoryState(p)), itemEffects: this.items.records(), victory: this.victory ? { ...this.victory.state } : null,
      rooms: this.rooms.map(({ phase, knowledge, entrySocket, refills }) => ({ phase, knowledge, entrySocket, refills })),
      pickups: this.pickups.live.map((p) => ({ ...p })), ...this.props.checkpoint(), dominionCasts: this.dominions.checkpoint(), commanderCasts: this.commanders.checkpoint(), spawnWarnings: this.spawnWarnings.checkpoint(this.tick) };
  }

  private discoverNeighbours(ai: number): void {
    for (const leaf of this.map.rooms[ai].leaves) {
      if (leaf.to < 0 || this.rooms[leaf.to].knowledge !== 0) continue;
      this.rooms[leaf.to].knowledge = 1;
      this.roomState(leaf.to);
    }
  }

  private visitRoom(ai: number): void {
    if (this.rooms[ai].knowledge === 2) return;
    this.rooms[ai].knowledge = 2;
    this.roomState(ai);
    this.discoverNeighbours(ai);
  }

  private roomState(ai: number): void {
    const { phase, knowledge, entrySocket } = this.rooms[ai];
    this.emit('all', { type: 'roomState', room: ai, phase, knowledge, entrySocket });
  }

  /** R1 has one reliable payload per revision; capture identity when the event is emitted. */
  private emit(to: number | 'all', event: GameEvent): void {
    this.events.push({ to, tick: this.tick, revision: ++this.stateRevision, event });
  }
  itemEvent(event: GameEvent): void { this.emit('all', event); }

  /** The active room's phase (countdown or combat), PHASE_IDLE when no room is active (rogue game.md §14.3). */
  get activePhase(): number {
    return this.activeRoom === ROOM_NONE ? PHASE_IDLE : this.rooms[this.activeRoom].phase;
  }

  /** Bit i: room i is cleared (rogue game.md §14.3). */
  clearedMask(): number {
    let m = 0;
    for (let i = 0; i < this.rooms.length; i++) if (this.rooms[i].phase === PHASE_CLEARED) m |= 1 << i;
    return m >>> 0;
  }

  /** Opens and closes every leaf by the leaf rule, from the same values the snapshot header carries. */
  private updateLeaves(): void {
    applyLeaves(this.map, { activeRoom: this.activeRoom, activePhase: this.activePhase, clearedMask: this.clearedMask() });
  }

  isInvulnerable(p: SimPlayer): boolean {
    return this.won || p.god || p.devGod || this.tick < p.invulUntil;
  }

  // ------------------------------------------------------------------ input

  /** Applies an input message from a player (§9.3). `nowMs` is the host time of arrival. */
  applyInput(playerId: number, m: InputMsg, nowMs: number): void {
    if (m.runId !== this.runId) return;
    const p = this.playerById(playerId);
    if (!p || !p.connected) return;
    if (p.lastSeq >= 0 && m.seq <= p.lastSeq) return;
    // Inputs sent before the client saw the host's latest teleport are ignored.
    const behind = (p.teleportId - m.lastTeleportId) & 0xffff;
    if (behind !== 0 && behind < 0x8000) return;
    const initial = p.lastSeq < 0;
    for (const slot of [0, 1] as const) {
      const counter = slot === 0 ? m.item1Presses : m.item2Presses;
      const delta = (counter - p.itemPresses[slot]) & 255;
      if (!initial && delta >= 1 && delta <= 127 && !p.dead) p.pendingItems[slot] = true;
      if (initial || delta <= 127) p.itemPresses[slot] = counter;
    }
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
    if (this.commanders.carriedBy(p.id)) {
      // Consume press counters above, but never queue a blocked action for release.
      this.cancelPlayerActions(p);
      p.lastAcceptMs = nowMs;
      return;
    }
    let x = m.x;
    let y = m.y;
    if (p.launchUntilMs === -1) p.launchUntilMs = nowMs + DOMINION_LAUNCH_SECONDS * 1000;
    if (nowMs >= p.speedCheckSkipUntil) {
      const elapsed = Math.max(0, nowMs - p.lastAcceptMs) / 1000;
      const launched = Math.max(0, Math.min(nowMs, p.launchUntilMs) - p.lastAcceptMs) / 1000;
      const walkingSpeed = p.speed * directionalSpeedFactor(p.yaw, x - p.x, y - p.y);
      const maxD = 1.2 * (walkingSpeed * elapsed + Math.max(0, DOMINION_LAUNCH_SPEED.center - walkingSpeed) * Math.min(elapsed, launched)) + 0.5;
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
    // A Shadowstep press starts its path where the Betrayer stood before this input (M12 §5.7).
    if (ePressed && p.classId === 'betrayer') {
      if (p.dash) this.endDash(p);
      p.dash = { pressSeq: m.seq, pts: [p.x, p.y, p.z], done: 1, acceptTick: -1, full: false, cut: new Set() };
    }
    const elapsed = (nowMs - p.lastAcceptMs) / 1000;
    const dx = x - p.x, dy = y - p.y, distance = Math.hypot(dx, dy);
    if (elapsed >= 0.008 && elapsed <= 0.25 && nowMs >= p.speedCheckSkipUntil && nowMs >= p.launchUntilMs &&
      distance > 0.001 && distance <= p.speed * elapsed * 1.5 + 0.1) {
      const scale = Math.min(1 / elapsed, p.speed / distance), blend = Math.min(1, elapsed / 0.1);
      p.moveVx += (dx * scale - p.moveVx) * blend;
      p.moveVy += (dy * scale - p.moveVy) * blend;
    } else p.moveVx = p.moveVy = 0;
    p.x = x;
    p.y = y;
    p.z = z;
    const dash = p.dash;
    if (dash && !dash.full) {
      if (m.seq <= dash.pressSeq + DASH_INPUTS) dash.pts.push(x, y, z);
      if (m.seq >= dash.pressSeq + DASH_INPUTS) dash.full = true;
    }
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

  /** Moves a player on the host and tells its client (§9.3). `launch` is a horizontal velocity in m/s. */
  teleport(p: SimPlayer, x: number, y: number, z: number, launch?: { dx: number; dy: number }, carry?: boolean): void {
    if (carry === undefined) this.commanders.releasePlayer(p.id, false);
    p.x = x;
    p.y = y;
    p.z = z;
    p.teleportId = (p.teleportId + 1) & 0xffff;
    p.lastAcceptMs = this.nowMs;
    p.moveVx = p.moveVy = 0;
    p.launchUntilMs = launch ? -1 : 0;
    this.emit(p.id, { type: 'teleport', teleportId: p.teleportId, x, y, z, ...(launch ? { launch } : {}), ...(carry !== undefined ? { carry } : {}) });
  }

  /** Adds a player to the game in its slot, with its feet at (x, y, z). */
  private insertPlayer(init: SimPlayerInit, x: number, y: number, z: number): SimPlayer {
    const cls = CLASSES[init.classId];
    const p: SimPlayer = {
      id: init.id,
      index: init.id,
      name: init.name,
      classId: init.classId,
      bot: !!init.bot,
      speed: cls.speed,
      maxHp: cls.hp,
      hp: cls.hp,
      wallet: 0,
      offerKey: init.profile?.id ?? `disposable:${this.nextOfferKey++}`,
      sold: 0, xpBase: init.profile?.characters[init.classId].xp ?? 0, requests: new ScopedRequests(),
      inventory: init.bot ? emptyInventory() : copyInventory(init.profile?.inventory ?? emptyInventory()),
      runXp: 0, xpCorrection: 0, itemsTried: init.bot ? [] : (init.profile?.codex.itemsTried ?? []).filter(isItemId),
      itemReadyTick: 0,
      featherUntil: 0, sealUntil: 0, itemPresses: [0, 0], pendingItems: [false, false],
      shield: 0,
      shieldUntil: 0,
      dead: false,
      connected: true,
      god: this.god || this.benchRoom >= 0,
      devGod: false,
      invulUntil: 0,
      x,
      y,
      z,
      yaw: 0,
      pitch: 0,
      fire: 0,
      fireTimer: 0,
      shieldCaster: null,
      qPresses: 0,
      ePresses: 0,
      allyTargetId: ALLY_NONE,
      pendingQ: false,
      pendingE: false,
      pendingEAlly: ALLY_NONE,
      landingTick: -1,
      kills: 0,
      damage: 0,
      reviveAssists: 0,
      shots: 0,
      shots2: 0,
      beamId: ALLY_NONE,
      beamUntil: 0,
      revive: 0,
      deaths: 0,
      revivers: 0,
      soulTick: 0,
      cdQ: 0,
      cdE: 0,
      lastDamageTick: this.tick,
      lastHurtTick: -ENGAGED_HIT_TICKS,
      lastSeq: -1,
      lastAcceptMs: this.nowMs,
      moveVx: 0, moveVy: 0,
      dash: null,
      teleportId: 0,
      speedCheckSkipUntil: 0,
      launchUntilMs: 0,
    };
    this.slots[p.index] = p;
    this.activeDirector()?.clear(p.index);
    this.players.push(p);
    this.players.sort((a, b) => a.id - b.id);
    this.groundFields[p.index] ??= new FlowField(this.map, false);
    this.airFields[p.index] ??= new FlowField(this.map, true);
    this.fieldValid[p.index] = false;
    return p;
  }

  /**
   * A player joins the game in progress (M8 §6.2), placed by the active room: in combat as a soul on
   * its entry cell, already floating; in the countdown alive on its entry cell; otherwise alive on the
   * feet of the living player with the lowest ID or, with none alive, on its entry cell of the first
   * room not cleared. The host tells its client where with a `teleport`.
   */
  addPlayer(init: SimPlayerInit): SimPlayer | null {
    if (init.id < 0 || init.id >= PLAYER_SLOTS || this.slots[init.id] || this.result) return null;
    const saved = this.retainedPlayers.get(init.id);
    const phase = this.activePhase;
    const lead = this.players.find((q) => this.livingTargetable(q));
    const p = this.insertPlayer(init, 0, 0, 0);
    let x: number;
    let y: number;
    let z: number;
    if (phase === PHASE_COMBAT || !lead) {
      const next = this.activeRoom !== ROOM_NONE ? this.activeRoom : this.rooms.findIndex((st) => st.phase !== PHASE_CLEARED);
      const a = next >= 0 ? this.map.rooms[next] : undefined;
      const [c, r] = a ? this.entry(next).cells[p.index] : this.map.spawns[p.index];
      [x, y, z] = [c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c]];
    } else {
      [x, y, z] = [lead.x, lead.y, lead.z];
      if (saved && this.activeRoom === ROOM_NONE) {
        const old = saved.player, cell = Math.floor(old.y) * this.map.w + Math.floor(old.x), room = this.map.roomOf[cell];
        if (!this.map.solid[cell] && this.rooms[room]?.phase === PHASE_CLEARED && Number.isFinite(this.map.floor[cell])) [x, y, z] = [old.x, old.y, this.map.floor[cell]];
      }
    }
    if (phase === PHASE_COMBAT) {
      // A soul with progress 0 that starts already floating (M8 §4.1).
      p.dead = true;
      p.hp = 0;
      p.soulTick = this.tick - ticks(SOUL_RISE_TIME);
    }
    this.teleport(p, x, y, z);
    if (saved) {
      const old = saved.player, elapsed = (this.tick - saved.tick) / TICK_HZ;
      Object.assign(p, old, { connected: true, x, y, z, lastSeq: -1, lastAcceptMs: this.nowMs,
        cdQ: Math.max(0, old.cdQ - elapsed), cdE: Math.max(0, old.cdE - elapsed),
        shield: 0, shieldCaster: null, featherUntil: 0, sealUntil: 0, speed: CLASSES[p.classId].speed, pendingItems: [false, false], invulUntil: 0, fire: 0, pendingQ: false, pendingE: false,
        dash: null, landingTick: -1, teleportId: p.teleportId,
        revive: old.dead ? Math.max(0, old.revive - elapsed * REVIVE_DECAY) : 0 });
      this.retainedPlayers.delete(init.id);
    } else if (!p.bot) p.wallet = this.halosCredited;
    return p;
  }

  /**
   * A player left or timed out (§9.4, M8 §6.2): their player is removed, with their soul, and the game
   * continues. Enemies retarget at once, and the run is a defeat if every player left is dead.
   */
  removePlayer(playerId: number, retain = false): void {
    const p = this.playerById(playerId);
    if (!p) return;
    p.connected = false;
    this.items.clearOwner(playerId);
    p.featherUntil = p.sealUntil = 0; p.shield = 0; p.speed = CLASSES[p.classId].speed;
    if (retain) this.retainedPlayers.set(playerId, { player: p, tick: this.tick });
    this.activeDirector()?.clear(p.index);
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
    if (this.progressionEnabled) return;
    const p = this.playerById(playerId);
    if (p) p.devGod = !p.devGod;
  }

  // ------------------------------------------------------------------ tick

  /** Simulates one tick. `nowMs` is the host time used for input timing. Does nothing after the result. */
  step(nowMs?: number): void {
    if (this.result) return;
    this.tick++;
    this.nowMs = nowMs ?? this.tick * TICK_MS;
    this.checkRoomStarts();
    this.syncHazards();
    this.updateSpawnWarnings();
    this.updateTrickle();
    this.updateFlowFields();
    this.updateSpawning();
    this.updatePlayers();
    this.items.update();
    this.updateEnemies();
    this.separate(0);
    this.separate(1);
    this.commanders.pulse();
    this.updateProjectiles();
    this.updateClouds();
    this.props.update(this.tick, (p) => this.explodeProp(p), (p) => this.emit('all', { type: 'propReady', id: p.id, x: p.x, y: p.y, z: p.z }));
    this.updateHazardDamage();
    this.items.membership();
    this.updateSouls();
    this.pickups.update(this.tick, this.players, (drop, collector) => this.collectPickup(drop, this.slots[collector.id]!));
    this.recoverEnemies();
    this.checkVictory();
    this.updateExit();
    this.checkRoomClears();
    this.checkDefeat();
    this.syncHazards();
    this.updateSpawnWarnings();
    if (this.benchBurst && this.tick % BENCH_BURST_TICKS === 0) this.benchBurstHit();
    this.flushBursts();
  }

  /** The benchmark's bursts (M12 §10): 40 damage, credited to player 0, to the 20 Blessed nearest a point 8 m ahead of it. */
  private benchBurstHit(): void {
    const p = this.slots[0];
    if (!p) return;
    const ax = p.x + Math.cos(p.yaw) * BENCH_BURST_AHEAD;
    const ay = p.y + Math.sin(p.yaw) * BENCH_BURST_AHEAD;
    const near: Array<{ s: number; d: number }> = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (this.eType[s] === BLESSED) near.push({ s, d: Math.hypot(this.eX[s] - ax, this.eY[s] - ay) });
    }
    near.sort((a, b) => a.d - b.d);
    for (let i = 0; i < near.length && i < BENCH_BURST_COUNT; i++) this.damageEnemy(near[i].s, BENCH_BURST_DAMAGE, p.index);
  }

  /** Sends this tick's burst deaths as one `bursts` event, if there were any (M12 §4.1). */
  flushBursts(): void {
    if (this.tickBursts.length === 0) return;
    this.emit('all', { type: 'bursts', list: this.tickBursts.slice() });
    this.tickBursts.length = 0;
  }

  /** Victory: when the Gatekeeper dies, every remaining enemy bursts without kill credit (§8.2). */
  private checkVictory(): void {
    if (!this.bossKilled || this.result || this.won) return;
    while (this.activeCount > 0) this.removeEnemy(this.active[this.activeCount - 1], true);
    // Hand-authored legacy maps keep their immediate-ending development fixture.
    if (!this.floor) { this.finish('victory'); return; }
    const at = stairPoints(this.map, this.floor.boss)[0];
    this.victory = new VictoryExit(this.tick, this.timeMs, at); this.admissionClosed = true;
    for (const p of [...this.players, ...[...this.retainedPlayers.values()].map(r => r.player)]) {
      if (p.dead) {
        p.dead = false; p.hp = p.maxHp * .5; p.shield = 0; p.revive = 0; p.revivers = 0;
        if (p.connected) { this.emit('all', { type: 'playerRevived', playerId: p.id }); this.teleport(p, at.x, at.y, at.z); }
      } else if (p.connected) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * .3);
    }
    this.items.clearAll(); for (const s of [...this.projectiles]) this.removeProjectile(s);
    this.clouds.length = 0; this.fieldUntil = 0;
    for (let i = 0; i < this.rooms.length; i++) { this.rooms[i].queue.length = 0; this.rooms[i].squad = null; this.items.clearCombat(i); }
    this.rooms[this.floor.boss].phase = PHASE_CLEARED; this.activeRoom = ROOM_NONE;
    this.updateLeaves(); this.roomState(this.floor.boss);
    this.emit('all', { type: 'victoryState', state: { ...this.victory.state } });
  }
  private updateExit(): void {
    if (!this.victory || this.result) return;
    const pending = [...this.pageRecipients.values()].some(set => this.players.some(p => p.connected && !p.bot && set.has(p.offerKey)));
    if (this.victory.update(this.tick, this.players, pending)) this.finish('victory');
    else if (this.tick % 30 === 0) this.emit('all', { type: 'victoryState', state: { ...this.victory.state } });
  }

  livingTargetable(p: SimPlayer | undefined): p is SimPlayer {
    return !!p && p.connected && !p.dead;
  }

  /** Room kinds, one active encounter, and human quorum (rogue game.md §4.3). */
  private checkRoomStarts(): void {
    if (this.result || this.bossKilled) return;
    for (let ai = 0; ai < this.rooms.length; ai++) {
      const a = this.map.rooms[ai], st = this.rooms[ai];
      let started = false;
      const humans = this.players.filter((p) => this.livingTargetable(p) && !p.bot);
      const inside = humans.filter((p) => insideRect(a, p.x, p.y) && !this.onDoor(p));
      if (inside.length > 0) this.visitRoom(ai);
      if (st.phase === PHASE_IDLE && inside.length > 0) {
        if (a.kind === 'breach' || a.kind === 'pardoner' || a.kind === 'confessional') {
          st.phase = PHASE_CLEARED;
          this.updateLeaves();
          this.roomState(ai);
          continue;
        }
        if (this.activeRoom !== ROOM_NONE) continue;
        const p = inside[0];
        let best = Infinity;
        for (const e of a.entry) {
          const x = e.cells.reduce((sum, c) => sum + c[0] + 0.5, 0) / 4;
          const y = e.cells.reduce((sum, c) => sum + c[1] + 0.5, 0) / 4;
          const d = (p.x - x) ** 2 + (p.y - y) ** 2;
          if (d < best || (d === best && e.socket < st.entrySocket)) {
            best = d;
            st.entrySocket = e.socket;
          }
        }
        if (ai === this.benchRoom) { this.startRoom(ai); continue; }
        st.phase = PHASE_COUNTDOWN;
        st.cancelTicks = 0;
        st.sealTick = this.tick + ticks(COUNTDOWN);
        started = true;
        this.activeRoom = ai;
        this.roomState(ai);
        this.updateLeaves();
      }
      if (st.phase !== PHASE_COUNTDOWN) continue;
      st.cancelTicks = inside.length === 0 ? st.cancelTicks + 1 : 0;
      if (humans.length === 0 || st.cancelTicks >= ticks(COUNTDOWN_CANCEL)) {
        st.phase = PHASE_IDLE;
        st.cancelTicks = 0;
        this.activeRoom = ROOM_NONE;
        this.roomState(ai);
        this.updateLeaves();
        continue;
      }
      const near = humans.filter((p) => insideRect(a, p.x, p.y) || this.inVestibule(ai, p)).length;
      if (near < Math.ceil(humans.length / 2) && !started) st.sealTick++;
      if (inside.length === humans.length) st.sealTick = Math.min(st.sealTick, this.tick + ticks(COUNTDOWN_ALL_IN));
      if (this.tick >= st.sealTick) this.startRoom(ai);
    }
  }

  private inVestibule(ai: number, p: SimPlayer): boolean {
    const { x0, y0, x1, y1 } = this.map.rooms[ai].rect;
    return this.roomAt(p.x, p.y) === ROOM_NONE && p.x >= x0 - 4 && p.x < x1 + 5 && p.y >= y0 - 4 && p.y < y1 + 5;
  }

  private enemyMayTarget(slot: number, p: SimPlayer): boolean {
    return !this.leashed[slot] || this.roomAt(p.x, p.y) === this.home[slot];
  }

  /** Check the whole displacement, including pulls across a corner, and retain the last home cell. */
  private clampLeash(slot: number, b: Body): void {
    const x = this.eX[slot], y = this.eY[slot];
    const dx = b.x - x, dy = b.y - y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy)) * 4));
    let last = 0;
    for (let k = 1; k <= steps; k++) {
      const f = k / steps;
      if (this.roomAt(x + dx * f, y + dy * f) !== this.home[slot]) {
        b.x = x + dx * last;
        b.y = y + dy * last;
        b.z = this.eZ[slot];
        return;
      }
      last = f;
    }
  }

  /** Finite revisit encounters; passing through spends no refill. Doors stay open. */
  private updateTrickle(): void {
    for (let ai = 0; ai < this.rooms.length; ai++) {
      const st = this.rooms[ai];
      const human = this.players.some((p) => this.livingTargetable(p) && !p.bot && this.roomAt(p.x, p.y) === ai);
      const living = this.players.some((p) => this.livingTargetable(p) && this.roomAt(p.x, p.y) === ai);
      if (living) st.lastLivingTick = this.tick;
      else if (st.alive > 0 && this.tick - st.lastLivingTick >= ticks(10)) {
        for (let k = this.activeCount - 1; k >= 0; k--) {
          const s = this.active[k];
          if (this.leashed[s] && this.home[s] === ai) this.removeEnemy(s, true);
        }
      }
      const allowed = this.activeRoom === ROOM_NONE && !this.bossKilled && !this.result &&
        this.map.rooms[ai].kind === 'combat' && st.phase === PHASE_CLEARED && st.refills > 0;
      if (!allowed || !human) st.trickleAt = -1;
      else if (!st.humanInside && this.tick - st.lastHumanTick >= ticks(10)) st.trickleAt = this.tick + ticks(3);
      if (human) st.lastHumanTick = this.tick;
      st.humanInside = human;
      if (st.trickleAt < 0 || this.tick < st.trickleAt) continue;
      const count = Math.floor(Math.min(12, 4 + 2 * this.partySize()));
      if (!this.canAlloc(count)) continue;
      const points = this.map.roomSpawnPoints[ai];
      const safe = new Uint8Array(points.length);
      const markerSafe = this.markEligible(points, SPAWN_MIN_DIST, safe, this.spawnEligibility(ai, points, BLESSED));
      const key = `${ai}:${BLESSED}`;
      let temporary: { room: number; c: number; r: number; budget: number } | undefined;
      if (!markerSafe) {
        if (!this.spawnBlockedSince.has(key)) this.spawnBlockedSince.set(key, this.tick);
        if (this.tick - this.spawnBlockedSince.get(key)! < 2 * TICK_HZ) continue;
        temporary = this.floorSpawn(ai, BLESSED); if (!temporary) continue;
      } else this.spawnBlockedSince.delete(key);
      const hidden: number[] = [];
      let farthest = -1, farDist = -1;
      for (let i = 0; i < points.length; i++) {
        if (!safe[i]) continue;
        const [c, r] = points[i];
        let seen = false, distance = Infinity;
        for (const p of this.players) {
          if (!this.livingTargetable(p)) continue;
          if (lineOfSight(this.map, p.x, p.y, p.z + PLAYER_EYE, c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c] + 1)) seen = true;
          distance = Math.min(distance, (p.x - c - 0.5) ** 2 + (p.y - r - 0.5) ** 2);
        }
        if (!seen) hidden.push(i);
        if (distance > farDist) { farDist = distance; farthest = i; }
      }
      if (!temporary && hidden.length === 0) {
        const [c, r] = points[farthest];
        if (!this.spawnWarnings.permit(ai, c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c], this.tick)) continue;
      }
      let placed = 0;
      for (; placed < count; placed++) {
        const i = hidden.length > 0 ? hidden[placed % hidden.length] : farthest;
        const [c, r] = temporary ? [temporary.c, temporary.r] : points[i];
        const slot = this.allocSlot();
        if (slot < 0) break;
        this.spawnAt(slot, BLESSED, c, r, ai, -1);
        this.home[slot] = ai;
        this.leashed[slot] = 1;
        this.retarget(slot);
      }
      if (placed > 0) { st.refills--; st.trickleAt = -1; this.invalidateFields(); }
    }
  }

  /** Warned anti-softlock relocation keeps identity, HP, statuses and reward entitlement. */
  private recoverEnemies(): void {
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if ((this.eX[s] - this.eStillX[s]) ** 2 + (this.eY[s] - this.eStillY[s]) ** 2 >= 1 || this.eHurtTick[s] > this.eStillSince[s]) {
        this.eStillSince[s] = this.tick;
        this.eStillX[s] = this.eX[s];
        this.eStillY[s] = this.eY[s];
      }
    }
    this.updateRecoveryArrivals();
    if (this.tick % ticks(5) !== 0 || this.activePhase !== PHASE_COMBAT) return;
    const ai = this.activeRoom, st = this.rooms[ai];
    const lastPlaced = st.wave === this.map.rooms[ai].waves.length - 1 && st.waveFullySpawned[st.wave];
    const fallback = new Map<number, [number, number] | null>();
    for (let k = this.activeCount - 1; k >= 0; k--) {
      const s = this.active[k];
      if (this.eRoom[s] !== ai || this.eType[s] === GATEKEEPER || this.leashed[s]) continue;
      if (this.recoveryArrivals.has(s)) continue;
      const avoids = !ENEMIES[this.eType[s]].flying && this.dryNavigation.room === ai;
      const fields = ENEMIES[this.eType[s]].flying ? this.airFields : avoids ? this.dryNavigation.fields : this.groundFields;
      const c = Math.floor(this.eX[s]), r = Math.floor(this.eY[s]);
      const anchor = avoids && this.hazards.active[r * this.map.w + c] ? this.dryNavigation.project(r * this.map.w + c) : r * this.map.w + c;
      const reachable = anchor >= 0 && this.players.some((p) => this.livingTargetable(p) && this.fieldValid[p.index] && fields[p.index] && fields[p.index]!.targetCell >= 0 && fields[p.index]!.at(anchor % this.map.w, Math.floor(anchor / this.map.w)) !== UNREACHABLE);
      if (reachable) this.eUnreachableSince[s] = -1;
      else if (this.eUnreachableSince[s] < 0) this.eUnreachableSince[s] = this.tick;
      const unreachable = this.eUnreachableSince[s] >= 0 && this.tick - this.eUnreachableSince[s] >= ticks(10);
      const stuck = lastPlaced && st.alive <= 10 && this.tick - this.eStillSince[s] >= ticks(20);
      if (reachable && !stuck) { this.eRecoveryFailed[s] = -1; continue; }
      if (!unreachable && !stuck && this.eRecoveryFailed[s] < 0) continue;
      const points = this.map.roomSpawnPoints[ai], safe = new Uint8Array(points.length);
      this.markEligible(points, SPAWN_MIN_DIST, safe, this.spawnEligibility(ai, points, this.eType[s]));
      let best = -1, distance = -1;
      for (let i = 0; i < points.length; i++) {
        if (!safe[i]) continue;
        const [x, y] = points[i];
        let nearest = Infinity;
        let reachableMarker = false;
        for (const p of this.players) {
          if (!this.livingTargetable(p)) continue;
          nearest = Math.min(nearest, (p.x - x - 0.5) ** 2 + (p.y - y - 0.5) ** 2);
          if (this.fieldValid[p.index] && fields[p.index] && fields[p.index]!.targetCell >= 0 && fields[p.index]!.at(x, y) !== UNREACHABLE) reachableMarker = true;
        }
        if (reachableMarker && nearest > distance) { distance = nearest; best = i; }
      }
      let point = best >= 0 ? points[best] : null;
      if (!point) {
        const type = this.eType[s];
        if (!fallback.has(type)) {
          let cell = -1, far = -1; const def = ENEMIES[type];
          for (const i of this.fallbackSpawnCells(ai)) {
            const x = i % this.map.w, y = Math.floor(i / this.map.w), z = this.map.floor[i];
            if (this.map.solid[i] || this.props.blocksSpawn(ai, x + 0.5, y + 0.5, z, def.radius, def.height) || !this.spawnClearance(x + 0.5, y + 0.5, z, SPAWN_MIN_DIST)) continue;
            let distance = Infinity, target = false;
            for (const p of this.players) if (this.livingTargetable(p)) {
              distance = Math.min(distance, (p.x - x - 0.5) ** 2 + (p.y - y - 0.5) ** 2);
              if (this.fieldValid[p.index] && fields[p.index] && fields[p.index]!.at(x, y) !== UNREACHABLE) target = true;
            }
            if (target && distance > far) { far = distance; cell = i; }
          }
          fallback.set(type, cell >= 0 ? [cell % this.map.w, Math.floor(cell / this.map.w)] : null);
        }
        point = fallback.get(this.eType[s])!;
      }
      if (point) {
        const [x, y] = point, key = `${ai}:${x}:${y}`;
        this.recoveryArrivals.set(s, { incarnation: this.eIncarnation[s], room: ai, c: x, r: y, x: this.eX[s], y: this.eY[s], tick: this.tick, unreachable });
        this.recoveryPointUsers.set(key, (this.recoveryPointUsers.get(key) ?? 0) + 1);
        this.spawnWarnings.permit(ai, x + 0.5, y + 0.5, this.map.floor[y * this.map.w + x], this.tick, undefined, 'recovery');
      } else if (this.eRecoveryFailed[s] < 0) this.eRecoveryFailed[s] = this.tick;
      else if (this.tick - this.eRecoveryFailed[s] >= ticks(10)) {
        console.warn('diagnostic: unreachable enemy removed', { room: ai, slot: s });
        this.settleEnemyXp(s);
        this.removeEnemy(s, true);
      }
    }
  }

  private updateRecoveryArrivals(): void {
    for (const [s, q] of this.recoveryArrivals) {
      const type = this.eType[s], cell = Math.floor(this.eY[s]) * this.map.w + Math.floor(this.eX[s]);
      const fields = ENEMIES[type].flying ? this.airFields : this.dryNavigation.room === q.room ? this.dryNavigation.fields : this.groundFields;
      const reachable = this.players.some((p) => this.livingTargetable(p) && this.fieldValid[p.index] && fields[p.index] && fields[p.index]!.at(cell % this.map.w, Math.floor(cell / this.map.w)) !== UNREACHABLE);
      const z = this.map.floor[q.r * this.map.w + q.c], def = ENEMIES[type];
      const cancel = !this.eAlive[s] || this.eIncarnation[s] !== q.incarnation || this.eRoom[s] !== q.room || this.activePhase !== PHASE_COMBAT || this.activeRoom !== q.room ||
        !this.spawnClearance(q.c + 0.5, q.r + 0.5, z, SPAWN_MIN_DIST) || this.map.solid[q.r * this.map.w + q.c] ||
        this.props.blocksSpawn(q.room, q.c + 0.5, q.r + 0.5, z, def.radius, def.height) ||
        reachable && (q.unreachable || (this.eX[s] - q.x) ** 2 + (this.eY[s] - q.y) ** 2 >= 1 || this.eHurtTick[s] >= q.tick);
      if (!cancel && !this.spawnWarnings.permit(q.room, q.c + 0.5, q.r + 0.5, z, this.tick, undefined, 'recovery')) continue;
      if (!cancel) {
        this.eX[s] = this.eStillX[s] = q.c + 0.5; this.eY[s] = this.eStillY[s] = q.r + 0.5;
        this.eZ[s] = z + (ENEMIES[type].flying ? CHERUB_HOVER : 0); this.eStillSince[s] = this.eSpawnTick[s] = this.tick;
        this.eUnreachableSince[s] = this.eRecoveryFailed[s] = -1; this.retarget(s);
      }
      this.recoveryArrivals.delete(s); const key = `${q.room}:${q.c}:${q.r}`, left = this.recoveryPointUsers.get(key)! - 1;
      if (left) this.recoveryPointUsers.set(key, left);
      else { this.recoveryPointUsers.delete(key); this.spawnWarnings.cancel(q.room, q.c + 0.5, q.r + 0.5, 'recovery'); }
    }
  }

  roomAt(x: number, y: number): number {
    const c = Math.floor(x), r = Math.floor(y);
    return c >= 0 && r >= 0 && c < this.map.w && r < this.map.h ? this.map.roomOf[r * this.map.w + c] : ROOM_NONE;
  }

  private onDoor(p: SimPlayer): boolean {
    return this.map.doorRoom[Math.floor(p.y) * this.map.w + Math.floor(p.x)] >= 0;
  }

  /** Seconds until the countdown room seals, or 0 (M8 §5). */
  countdownLeft(): number {
    if (this.activePhase !== PHASE_COUNTDOWN) return 0;
    return Math.max(0, this.rooms[this.activeRoom].sealTick - this.tick) / TICK_HZ;
  }

  /** The same living-human quorum used by the countdown, projected for the HUD. */
  countdownHold(): number {
    if (this.activePhase !== PHASE_COUNTDOWN) return 0;
    const humans = this.players.filter((p) => this.livingTargetable(p) && !p.bot);
    const room = this.map.rooms[this.activeRoom];
    const inside = humans.filter((p) => insideRect(room, p.x, p.y) || this.inVestibule(this.activeRoom, p)).length;
    return (inside < Math.ceil(humans.length / 2) ? 0x80 : 0) | (inside << 3) | humans.length;
  }

  private startRoom(ai: number): void {
    if (this.won) return;
    if (this.map.rooms[ai].boss) this.admissionClosed = true;
    this.rewardRecipients.set(ai, new Set(this.players.filter(p => p.connected && !p.bot).map(p => p.offerKey)));
    const a = this.map.rooms[ai];
    const st = this.rooms[ai];
    st.phase = PHASE_COMBAT;
    this.activeRoom = ai;
    // Freeze P at the seal: connected humans plus half-player bots.
    st.partySize = this.partySize();
    if (a.kind === 'combat' && a.shape && a.band) {
      const weight = a.waves.reduce((sum, w) => sum + HALO_WEIGHT[BLESSED] * scaleCount(w.blessed, st.partySize) +
        HALO_WEIGHT[CHORISTER] * scaleCount(w.choristers, st.partySize) + HALO_WEIGHT[CHERUB] * scaleCount(w.cherubs, st.partySize), 0);
      const counts = a.waves.map((w) => scaleCount(w.dominions ?? 0, st.partySize));
      const budget = haloBudget(a.shape, a.band);
      // More commanders must not take the crowd's reward budget: reserve at most one quarter.
      const ledger = new HaloLedger(budget, weight, Math.min(counts.reduce((sum, n) => sum + n, 0), Math.floor(budget / 24)));
      this.haloLedgers.set(ai, ledger);
      let gold = ledger.reservedElites;
      this.eliteGold.set(ai, counts.map((n) => { const granted = Math.min(gold, n); gold -= granted; return granted; }));
      this.elitePlaced.set(ai, counts.map(() => 0));
    }
    this.updateLeaves();
    this.invalidateFields();
    this.roomState(ai);
    for (const p of this.players) {
      if (!p.connected) continue;
      if (!insideRect(a, p.x, p.y) || this.onDoor(p)) {
        const [c, r] = this.entry(ai).cells[p.index];
        this.teleport(p, c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c]);
      }
    }
    if (this.isPacedRoom(ai)) {
      // Account for the previous wave's 30% carry-over, bounded by the global cap.
      const sizes = a.waves.map((w) => waveSize(w, st.partySize));
      const cap = Math.min(MAX_LIVING_ENEMIES, Math.max(...sizes.map((size, i) => size + Math.floor(0.3 * (sizes[i - 1] ?? 0)))));
      st.director = new Director(a.waves.length, cap, this.solo);
    }
    if (this.benchRoom < 0 && !this.noWaves && a.waves.length > 0) this.startWave(ai, 0);
    if (a.boss && this.map.boss) this.placeBoss(ai);
  }

  /**
   * A room whose waves the director paces and which arrive from far away over 10 s (M12 §2): a room
   * with more than one wave, outside the benchmark, with waves enabled. The boss room and the
   * sandbox's single wave keep the MVP's rules.
   */
  private isPacedRoom(ai: number): boolean {
    const a = this.map.rooms[ai];
    return a.kind === 'combat' && (a.shape !== undefined || a.waves.length > 1) && ai !== this.benchRoom && !this.noWaves;
  }

  /** The director of the arena in combat, if it has one (M12 §2.3). */
  private activeDirector(): Director | null {
    for (const st of this.rooms) if (st.phase === PHASE_COMBAT && st.director) return st.director;
    return null;
  }

  /** The director's state for the F3 overlay (M12 §2.3), or null when no combat arena is in combat. */
  directorInfo(): DirectorInfo | null {
    const st = this.rooms.find((a) => a.phase === PHASE_COMBAT && a.director);
    if (!st || !st.director) return null;
    const d = st.director;
    return {
      phase: d.phase,
      phaseTime: d.phaseTicks / TICK_HZ,
      intensity: d.party(this.livingMask()),
      wave: st.wave,
      alive: st.alive,
      waveTotal: st.wave >= 0 ? st.waveTotals[st.wave] : 0,
    };
  }

  /** Which player slots hold a living, connected player. */
  private livingMask(): boolean[] {
    const m = this.livingScratch;
    for (let i = 0; i < PLAYER_SLOTS; i++) m[i] = this.livingTargetable(this.slots[i]);
    return m;
  }

  /** Places the Gatekeeper on `B` when the boss arena enters combat; all its timers start now (§7.4). */
  private placeBoss(ai: number): void {
    const [c, r] = this.map.boss!;
    const slot = this.allocSlot();
    if (slot < 0) return;
    this.bossParty = this.rooms[ai].partySize;
    this.bossSolo = this.solo;
    this.bossMaxHp = ENEMIES[GATEKEEPER].hp * bossMultiplier(this.bossParty, this.bossSolo);
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
    const st = this.rooms[ai];
    const w = this.map.rooms[ai].waves[n];
    const counts = [scaleCount(w.blessed, st.partySize), scaleCount(w.choristers, st.partySize), scaleCount(w.cherubs, st.partySize), scaleCount(w.dominions ?? 0, st.partySize)];
    const squad = w.squad ? scaleCount(w.squad.count, st.partySize) : 0;
    st.wave = n;
    const queued = counts.reduce((sum, n) => sum + n, 0);
    st.waveTotals[n] = queued + squad;
    st.waveAlive[n] = 0;
    st.waveFullySpawned[n] = st.waveTotals[n] === 0;
    st.pace = 0;
    st.paceRate = queued / (this.isCrest(ai, n) ? CREST_ARRIVAL_TICKS : WAVE_ARRIVAL_TICKS);
    if (this.isCrest(ai, n)) this.emit('all', { type: 'crest', room: ai, wave: n, total: queued });
    if (queued > 0) st.queue.push({ counts, spawned: [0, 0, 0, 0], wave: n });
    st.squad = squad > 0 ? { type: w.squad!.type === 'cherubs' ? CHERUB : CHORISTER, at: w.squad!.at, left: squad, next: this.tick + SQUAD_DELAY_TICKS, rr: 0, wave: n } : null;
    st.director?.waveStarted(n);
  }

  private checkRoomClears(): void {
    this.map.rooms.forEach((a, ai) => {
      const st = this.rooms[ai];
      if (st.phase !== PHASE_COMBAT || a.boss || this.benchRoom >= 0) return;
      const allWavesStarted = this.noWaves || st.wave >= a.waves.length - 1;
      if (!allWavesStarted || st.queue.length > 0 || st.squad || st.alive > 0) return;
      st.phase = PHASE_CLEARED;
      this.awardXp(100);
      this.clearReward(ai);
      this.items.clearCombat(ai);
      for (const { player } of this.retainedPlayers.values()) if (player.dead) {
        player.dead = false; player.hp = player.maxHp * 0.5; player.revive = 0; player.shield = 0;
      }
      if (this.activeRoom === ai) this.activeRoom = ROOM_NONE;
      this.updateLeaves();
      this.invalidateFields();
      this.roomState(ai);
      st.lastHumanTick = this.tick;
      // Clear sustain (rogue game.md §4.3), once per encounter.
      for (const p of this.players) if (p.connected && !p.dead) p.hp = Math.min(p.maxHp, p.hp + 0.3 * p.maxHp);
      for (const p of this.players) {
        if (!p.connected || !p.dead) continue;
        p.dead = false;
        p.hp = 0.5 * p.maxHp;
        p.shield = 0;
        p.revive = 0;
        p.revivers = 0;
        p.lastDamageTick = this.tick;
        const [c, r] = this.entry(ai).cells[p.index];
        this.emit('all', { type: 'playerRespawned', playerId: p.id });
        this.teleport(p, c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c]);
      }
    });
  }

  /** Defeat: all connected players are dead at the same time (§5.7). */
  private checkDefeat(): void {
    if (this.result || this.won || this.benchRoom >= 0) return;
    const connected = this.players.filter((p) => p.connected);
    if (connected.length > 0 && connected.every((p) => p.dead)) this.finish('defeat');
  }

  /** Ends the run: the host sends one last snapshot and `gameOver`, then stops simulating (§3). */
  finish(result: 'victory' | 'defeat'): void {
    if (this.result) return;
    this.result = result;
    const stats: Record<number, PlayerStats> = {};
    for (const p of this.players) {
      if (p.connected) stats[p.id] = { kills: p.kills, damage: Math.round(p.damage), deaths: p.deaths, reviveAssists: p.reviveAssists,
        runXp: Math.floor(p.runXp), levelBefore: levelForXp(p.xpBase), levelAfter: levelForXp(saturatingAdd(p.xpBase, Math.floor(p.runXp))) };
    }
    this.emit('all', { type: 'gameOver', result, timeMs: Math.round(this.victory?.state.clearTimeMs ?? this.timeMs), unclaimed: this.victory?.unclaimed ?? false, stats });
  }

  // ------------------------------------------------------------------ flow fields

  private invalidateFields(): void {
    this.fieldValid.fill(false);
  }

  /** Only rebuild occupied enemy rooms, at the inherited staggered cadence. */
  private updateFlowFields(): void {
    for (const p of this.players) {
      const room = this.roomAt(p.x, p.y);
      // Roomless hand-written geometry fixtures retain their explicit fields.
      if (this.map.rooms.length === 0) {
        if (this.livingTargetable(p) && this.activeCount > 0) this.computeFields(p, ROOM_NONE);
        continue;
      }
      if (!this.livingTargetable(p) || room === ROOM_NONE || !this.hasEnemies(room) && this.rooms[room].queue.length === 0 && !this.rooms[room].squad && this.rooms[room].trickleAt < 0) {
        this.fieldValid[p.index] = false;
        this.dryNavigation.release(p.index);
        continue;
      }
      const k = p.index * 2;
      const due = Math.floor((this.tick + k) / 7.5) !== Math.floor((this.tick + k - 1) / 7.5);
      const cell = Math.floor(p.y) * this.map.w + Math.floor(p.x);
      if (!due && this.fieldValid[p.index] && this.groundFields[p.index].targetCell === cell) continue;
      this.computeFields(p, room);
    }
  }

  private hasEnemies(room: number): boolean {
    if (this.rooms[room].alive > 0 || (this.bossSlot >= 0 && this.eRoom[this.bossSlot] === room)) return true;
    // Dev/test enemies may be placed without an owning wave.
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (this.eRoom[s] < 0 && this.roomAt(this.eX[s], this.eY[s]) === room) return true;
    }
    return false;
  }

  /** Explicit refresh for dev/test placements, including roomless geometry fixtures. */
  refreshFields(): void {
    this.syncHazards();
    for (const p of this.players) if (this.livingTargetable(p)) this.computeFields(p, this.roomAt(p.x, p.y), true);
  }

  private computeFields(p: SimPlayer, room: number, forceAir = false): void {
    const c = Math.floor(p.x), r = Math.floor(p.y);
    const rect = room === ROOM_NONE ? undefined : this.map.rooms[room].rect;
    const clamp = rect ? { x0: rect.x0 - 4, y0: rect.y0 - 4, x1: rect.x1 + 4, y1: rect.y1 + 4 } : undefined;
    this.groundFields[p.index].compute(c, r, clamp);
    let flyers = forceAir || room !== ROOM_NONE && (this.rooms[room].squad?.type === CHERUB || this.rooms[room].queue.some((b) => b.counts[2] > b.spawned[2]));
    for (let k = 0; k < this.activeCount && !flyers; k++) {
      const s = this.active[k];
      flyers = ENEMIES[this.eType[s]].flying && (this.eRoom[s] === room || (this.eRoom[s] < 0 && this.roomAt(this.eX[s], this.eY[s]) === room));
    }
    if (flyers) this.airFields[p.index].compute(c, r, clamp);
    else this.airFields[p.index].targetCell = -1;
    this.fieldValid[p.index] = true;
    if (this.dryNavigation.room === room && room !== ROOM_NONE) this.dryNavigation.compute(p.index, c, r);
    else this.dryNavigation.release(p.index);
  }

  private syncHazards(): void {
    const room = !this.result && this.activePhase === PHASE_COMBAT ? this.activeRoom : -1;
    const changed = this.hazards.setRoom(room);
    let avoiding = false;
    if (this.hazards.room >= 0) for (let k = 0; k < this.activeCount && !avoiding; k++) {
      const s = this.active[k]; avoiding = !ENEMIES[this.eType[s]].flying && this.eType[s] !== GATEKEEPER && this.roomAt(this.eX[s], this.eY[s]) === this.hazards.room;
    }
    if (this.dryNavigation.setRoom(avoiding ? this.hazards.room : -1) || changed) this.invalidateFields();
  }

  private updateHazardDamage(): void {
    this.ePooled.fill(0);
    if (this.hazards.room < 0 && this.tick >= this.fieldUntil) return;
    // Player snapshots carry accepted feet, not a grounded bit; actual floor contact is the test.
    for (const p of this.players) if (this.livingTargetable(p) && this.hazards.contact(p.x, p.y, p.z, true)) this.damagePlayer(p, FIRE_PLAYER_DAMAGE);
    let count = 0;
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k], fire = this.hazards.contact(this.eX[s], this.eY[s], this.eZ[s], this.eGrounded[s] === 1);
      this.ePooled[s] = fire || this.tick < this.fieldUntil && inField(this.fieldX, this.fieldY, this.eX[s], this.eY[s]) ? 1 : 0;
      if (fire) this.hazardVictims[count++] = s;
    }
    // Stable bounded slots: owned shield bursts/removals cannot skip or damage a victim twice.
    for (let k = 0; k < count; k++) {
      const s = this.hazardVictims[k];
      if (this.eAlive[s]) this.damageEnemy(s, FIRE_ENEMY_DAMAGE, -1, FIRE_ENEMY_DAMAGE, this.eX[s], this.eY[s], true);
    }
  }

  // ------------------------------------------------------------------ spawning

  private updateSpawning(): void {
    for (const p of this.floorSpawnPoints.values()) p.budget = Math.min(BUDGET_MAX, p.budget + (this.isCrest(p.room) ? CREST_SPAWN_RATE : SPAWN_RATE) / TICK_HZ);
    this.rooms.forEach((st, ai) => {
      const b = st.budgets;
      const rate = this.isCrest(ai) ? CREST_SPAWN_RATE / TICK_HZ : BUDGET_PER_TICK;
      for (let i = 0; i < b.length; i++) b[i] += rate;
      if (st.phase === PHASE_COMBAT) this.updateRoomSpawning(ai);
      // The cap applies to the budget carried into the next tick, so a busy point sustains its rate.
      for (let i = 0; i < b.length; i++) if (b[i] > BUDGET_MAX) b[i] = BUDGET_MAX;
    });
  }

  private isCrest(ai: number, wave = this.rooms[ai].wave): boolean {
    const room = this.map.rooms[ai];
    return room.kind === 'combat' && room.shape === '2x2' && wave === room.waves.length - 1;
  }

  private updateRoomSpawning(ai: number): void {
    const st = this.rooms[ai];
    if (ai === this.benchRoom) {
      // Benchmark: keep exactly 1 500 enemies alive instead of waves, topped up with Blessed. The
      // Gatekeeper and his summons count (`living` leaves the Gatekeeper out).
      let queued = 0;
      for (const q of st.queue) for (let t = 0; t < q.counts.length; t++) queued += q.counts[t] - q.spawned[t];
      const boss = this.bossSlot >= 0 && this.eRoom[this.bossSlot] === ai ? 1 : 0;
      const need = MAX_LIVING_ENEMIES - this.living - boss - queued;
      if (need > 0) st.queue.push({ counts: [need, 0, 0], spawned: [0, 0, 0], wave: -1 });
    }

    const d = st.director;
    if (d) {
      this.updateIntensity(d);
      const n = st.wave;
      if (d.step(d.party(this.livingMask()), st.waveFullySpawned[n], st.alive, st.waveTotals[n])) this.startWave(ai, n + 1);
      // A wave arrives at an even pace over 10 s (M12 §2.2); its squad doesn't count (M12 follow-up §4.2).
      if (st.queue.length > 0) st.pace += st.paceRate;
    }

    this.placeQueued(ai);
    this.placeSquad(ai);
  }

  /**
   * A wave's squad (M12 follow-up §4.2): from 5 s after the wave starts, one every 0.5 s, round-robin
   * over its points more than 8 m from every living player. When none is (a player stands among
   * them), it uses the same distant-marker or warned safe-floor fallback as its ordinary wave.
   */
  private placeSquad(ai: number): void {
    const st = this.rooms[ai];
    const q = st.squad;
    if (!q || q.left <= 0 || this.tick < q.next || this.activeCount >= MAX_LIVING_ENEMIES) return;
    let points = q.at;
    let eligible = new Uint8Array(points.length);
    const own = this.markEligible(points, SPAWN_ELIGIBLE_DIST, eligible, this.spawnEligibility(ai, points, q.type));
    let warned = false;
    let temporary: { room: number; c: number; r: number; budget: number } | undefined;
    if (!own) {
      points = this.map.roomSpawnPoints[ai];
      eligible = new Uint8Array(points.length);
      const allowed = this.spawnEligibility(ai, points, q.type);
      if (!this.markEligible(points, this.map.rooms[ai].shape === '1x1' ? 10 : SPAWN_FAR_DIST, eligible, allowed) && !this.markEligible(points, SPAWN_ELIGIBLE_DIST, eligible, allowed)) {
        warned = true;
        if (!this.markEligible(points, SPAWN_MIN_DIST, eligible, allowed)) {
          const key = `${ai}:${q.type}`; if (!this.spawnBlockedSince.has(key)) this.spawnBlockedSince.set(key, this.tick);
          if (this.tick - this.spawnBlockedSince.get(key)! < 2 * TICK_HZ) return;
          temporary = this.floorSpawn(ai, q.type); if (!temporary) return;
        }
      }
    }
    if (own || eligible.some(Boolean)) this.spawnBlockedSince.delete(`${ai}:${q.type}`);
    let found = -1;
    const rr = own ? q.rr : st.rr;
    for (let k = 0; k < points.length; k++) {
      const i = (rr + k) % points.length;
      if (eligible[i]) {
        const [x, y] = points[i];
        if (warned && !this.spawnWarnings.permit(ai, x + 0.5, y + 0.5, this.map.floor[y * this.map.w + x], this.tick)) continue;
        found = i;
        break;
      }
    }
    if (found < 0 && !temporary) return;
    const slot = this.allocSlot();
    if (slot < 0) return;
    const [c, r] = temporary ? [temporary.c, temporary.r] : points[found];
    this.spawnAt(slot, q.type, c, r, ai, q.wave);
    if (temporary) temporary.budget--;
    else if (own) q.rr = (found + 1) % points.length;
    else st.rr = (found + 1) % points.length;
    q.left--;
    q.next = this.tick + SQUAD_EVERY_TICKS;
    if (q.left === 0) {
      st.squad = null;
      if (!st.queue.some((b) => b.wave === q.wave)) st.waveFullySpawned[q.wave] = true;
    }
  }

  /**
   * Intensity decay (M12 §2.3), once per tick: −20 per second for each living player who isn't
   * engaged, that is with no living enemy within 8 m horizontally and no hit in the last 30 ticks.
   */
  private updateIntensity(d: Director): void {
    const engaged = this.engagedScratch;
    let left = 0;
    for (let i = 0; i < PLAYER_SLOTS; i++) {
      const p = this.slots[i];
      engaged[i] = !this.livingTargetable(p) || this.tick - p.lastHurtTick < ENGAGED_HIT_TICKS;
      if (!engaged[i]) left++;
    }
    const r2 = ENGAGED_RADIUS * ENGAGED_RADIUS;
    for (let k = 0; k < this.activeCount && left > 0; k++) {
      const s = this.active[k];
      if (this.eType[s] === GATEKEEPER) continue;
      for (let i = 0; i < PLAYER_SLOTS; i++) {
        if (engaged[i]) continue;
        const p = this.slots[i]!;
        const dx = this.eX[s] - p.x;
        const dy = this.eY[s] - p.y;
        if (dx * dx + dy * dy <= r2) {
          engaged[i] = true;
          left--;
        }
      }
    }
    for (let i = 0; i < PLAYER_SLOTS; i++) if (!engaged[i]) d.decay(i);
  }

  private placeQueued(ai: number): void {
    const st = this.rooms[ai];
    if (st.queue.length === 0) return;
    const points = this.map.roomSpawnPoints[ai];
    const np = points.length;
    // Preferred markers stay distant. Exhaustion falls back to a one-second warning,
    // with the three-metre body clearance rechecked on every tick and placement.
    const paced = st.director !== null;
    const def = this.map.rooms[ai];
    const warned = new Map<number, boolean>();
    const maskFor = (type: number) => {
      const allowed = this.spawnEligibility(ai, points, type);
      const eligible = new Uint8Array(np);
      const far = paced && this.markEligible(points, def.shape === '1x1' ? 10 : SPAWN_FAR_DIST, eligible, allowed);
      if (!far && !this.markEligible(points, SPAWN_ELIGIBLE_DIST, eligible, allowed)) { this.markEligible(points, SPAWN_MIN_DIST, eligible, allowed); warned.set(type, true); }
      return eligible;
    };
    const shared = def.spawnTags?.length ? null : maskFor(BLESSED);
    const eligibleByType = SPAWN_TYPES.map((type) => shared ?? maskFor(type));
    if (shared && warned.get(BLESSED)) for (const type of SPAWN_TYPES) warned.set(type, true);
    for (let k = 0; k < SPAWN_TYPES.length; k++) {
      const key = `${ai}:${SPAWN_TYPES[k]}`;
      if (warned.get(SPAWN_TYPES[k]) && !eligibleByType[k].some(Boolean)) {
        if (!this.spawnBlockedSince.has(key)) this.spawnBlockedSince.set(key, this.tick);
      } else this.spawnBlockedSince.delete(key);
    }

    while (st.queue.length > 0) {
      if (this.activeCount >= MAX_LIVING_ENEMIES) return;
      if (paced && st.pace < 1 - 1e-9) return;
      const batch = st.queue[0];
      const family = batch.wave >= 0 && batch.spawned[3] === 0 ? def.waves[batch.wave].commander : undefined;
      const preferredType = family === 'cantor' ? CANTOR : family === 'carrier' ? CARRIER : DOMINION;
      const leaderType = preferredType !== DOMINION && !this.commanders.hasFamily(preferredType, ai) ? preferredType : DOMINION;
      eligibleByType[3] = maskFor(leaderType);
      if (warned.get(leaderType) && !eligibleByType[3].some(Boolean)) {
        const key = `${ai}:${leaderType}`; if (!this.spawnBlockedSince.has(key)) this.spawnBlockedSince.set(key, this.tick);
      }
      const typeIndex = this.nextType(batch, eligibleByType.map((mask, k) => mask.some((ok, i) => !!ok && st.budgets[i] >= 1) || warned.get(k === 3 ? leaderType : SPAWN_TYPES[k]) === true));
      if (typeIndex < 0) return; // Pending elites wait; fodder remains eligible while the cap is full.
      let found = -1;
      const eligible = eligibleByType[typeIndex], type = typeIndex === 3 ? leaderType : SPAWN_TYPES[typeIndex];
      const affinity = (type === CHORISTER || type === CANTOR) ? def.chorister : type === DOMINION ? def.dominion : undefined;
      const preferred = affinity?.filter((i) => eligible[i] && st.budgets[i] >= 1);
      if (preferred?.length && !warned.get(type)) found = preferred[Math.floor(this.random() * preferred.length)];
      for (let k = 0; k < np; k++) {
        if (found >= 0) break;
        const i = (st.rr + k) % np;
        if (eligible[i] && st.budgets[i] >= 1) {
          if (warned.get(type)) { const [c, r] = points[i]; if (!this.spawnWarnings.permit(ai, c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c], this.tick, () => { st.budgets[i] = Math.min(1, st.budgets[i]); })) continue; }
          found = i;
          break;
        }
      }
      let temporary: { room: number; c: number; r: number; budget: number } | undefined;
      if (found < 0 && warned.get(type) && !eligible.some(Boolean) && this.tick - this.spawnBlockedSince.get(`${ai}:${type}`)! >= 2 * TICK_HZ) temporary = this.floorSpawn(ai, type);
      if (found < 0 && !temporary) return;
      const slot = this.allocSlot();
      if (slot < 0) return;
      batch.spawned[typeIndex]++;
      if (batch.spawned.every((s, t) => s >= batch.counts[t])) {
        st.queue.shift();
        // Fully placed once its squad is too (M12 follow-up §4.2).
        if (batch.wave >= 0 && st.squad?.wave !== batch.wave) st.waveFullySpawned[batch.wave] = true;
      }
      const [c, r] = temporary ? [temporary.c, temporary.r] : points[found];
      this.spawnAt(slot, type, c, r, ai, batch.wave);
      if (temporary) temporary.budget -= 1;
      else { st.budgets[found] -= 1; st.rr = (found + 1) % np; }
      // Budget left when the wave is fully placed is dropped.
      if (paced) st.pace = st.queue.length > 0 ? st.pace - 1 : 0;
    }
  }

  private updateSpawnWarnings(): void {
    const active = (room: number) => !this.result && (this.activePhase === PHASE_COMBAT && this.activeRoom === room || this.activeRoom === ROOM_NONE && this.rooms[room]?.trickleAt >= 0);
    this.spawnWarnings.update(this.tick, active, (w) => this.spawnClearance(w.x, w.y, w.z, SPAWN_MIN_DIST));
    for (const [key, p] of this.floorSpawnPoints) if (!active(p.room)) this.floorSpawnPoints.delete(key);
    for (const key of this.spawnBlockedSince.keys()) if (!active(Number(key.split(':')[0]))) this.spawnBlockedSince.delete(key);
  }

  private floorSpawn(ai: number, type: number): { room: number; c: number; r: number; budget: number } | undefined {
    const key = `${ai}:${type}`, def = ENEMIES[type];
    let p = this.floorSpawnPoints.get(key);
    const legal = (c: number, r: number) => {
      const i = r * this.map.w + c, z = this.map.floor[i];
      if (this.map.solid[i] || this.map.roomOf[i] !== ai || this.map.hazard[i] || this.props.blocksSpawn(ai, c + 0.5, r + 0.5, z, def.radius, def.height)) return false;
      if (!this.spawnClearance(c + 0.5, r + 0.5, z, SPAWN_MIN_DIST)) return false;
      const fields = this.groundFields;
      return this.players.some((q) => this.livingTargetable(q) && this.fieldValid[q.index] && fields[q.index].at(c, r) !== UNREACHABLE);
    };
    if (p && !legal(p.c, p.r)) { this.floorSpawnPoints.delete(key); p = undefined; }
    if (!p && this.floorScanTick !== this.tick) {
      this.floorScanTick = this.tick; let best = -1, distance = -1;
      for (const cell of this.fallbackSpawnCells(ai)) {
        const c = cell % this.map.w, r = Math.floor(cell / this.map.w);
        if (!legal(c, r)) continue;
        let d = Infinity;
        for (const q of this.players) if (this.livingTargetable(q)) d = Math.min(d, (q.x - c - 0.5) ** 2 + (q.y - r - 0.5) ** 2);
        if (d > distance) { distance = d; best = r * this.map.w + c; }
      }
      if (best >= 0) { p = { room: ai, c: best % this.map.w, r: Math.floor(best / this.map.w), budget: 1 }; this.floorSpawnPoints.set(key, p); }
    }
    if (!p || p.budget < 1) return undefined;
    return this.spawnWarnings.permit(ai, p.c + 0.5, p.r + 0.5, this.map.floor[p.r * this.map.w + p.c], this.tick) ? p : undefined;
  }

  private fallbackSpawnCells(ai: number): Uint32Array {
    let cells = this.spawnFloorCells.get(ai); if (cells) return cells;
    const room = this.map.rooms[ai], rect = room.rect, out: number[] = [];
    const rewards = [room.points?.reward, room.points?.advocate, ...(room.points?.pedestals ?? [])].filter((p): p is [number, number] => !!p);
    const entries = room.entry.flatMap((e) => e.cells);
    for (let r = rect.y0; r <= rect.y1; r++) for (let c = rect.x0; c <= rect.x1; c++) {
      const i = r * this.map.w + c;
      if (this.map.wall[i] || this.map.hazard[i] || this.map.doorRoom[i] >= 0 || this.map.roomOf[i] !== ai ||
        rewards.some(([x, y]) => Math.abs(x - c) <= 1 && Math.abs(y - r) <= 1) ||
        entries.some(([x, y]) => Math.abs(x - c) <= 1 && Math.abs(y - r) <= 1)) continue;
      out.push(i);
    }
    cells = Uint32Array.from(out); this.spawnFloorCells.set(ai, cells); return cells;
  }

  private spawnClearance(x: number, y: number, z: number, distance: number): boolean {
    for (const p of this.players) if (this.livingTargetable(p) && distToCylinder(x, y, z, p.x, p.y, p.z, PLAYER_RADIUS, PLAYER_HEIGHT) <= distance) return false;
    return true;
  }

  /** Authored marker tags also apply when squads or trickles borrow ordinary points. */
  private spawnEligibility(ai: number, points: Array<[number, number]>, type: number): boolean[] | undefined {
    const tags = this.map.rooms[ai].spawnTags;
    if (!tags?.length) return undefined;
    const markers = this.map.roomSpawnPoints[ai];
    return points.map(([x, y]) => {
      const index = markers.findIndex(([c, r]) => x === c && y === r);
      const tag = tags.find((t) => t.index === index);
      return !tag || tag.only.some((id) => (id === 'chorister' ? type === CHORISTER || type === CANTOR : type === DOMINION));
    });
  }

  /** Marks the spawn points farther than `dist` from every living player; returns whether any is. */
  private markEligible(points: Array<[number, number]>, dist: number, eligible: Uint8Array, allowed?: readonly boolean[]): boolean {
    let any = false;
    for (let i = 0; i < points.length; i++) {
      if (allowed && !allowed[i]) { eligible[i] = 0; continue; }
      const [c, r] = points[i];
      const px = c + 0.5;
      const py = r + 0.5;
      const pz = this.map.floor[r * this.map.w + c];
      let ok = true;
      for (const p of this.players) {
        if (!this.livingTargetable(p)) continue;
        if (distToCylinder(px, py, pz, p.x, p.y, p.z, PLAYER_RADIUS, PLAYER_HEIGHT) <= dist) {
          ok = false;
          break;
        }
      }
      eligible[i] = ok ? 1 : 0;
      if (ok) any = true;
    }
    return any;
  }

  /** The type with the lowest (spawned + 0.5) / count among types with enemies left (§8.2). */
  private nextType(batch: SpawnBatch, canSpawn?: readonly boolean[]): number {
    let best = -1;
    let bestV = Infinity;
    const eliteCap = this.dominionAlive() >= DOMINION_ALIVE_CAP;
    // Put the wave's first commander in the opening arrivals, not halfway through its minions.
    const leader = SPAWN_TYPES.indexOf(DOMINION);
    if (!eliteCap && batch.counts[leader] > 0 && batch.spawned[leader] === 0 && (!canSpawn || canSpawn[leader])) return leader;
    for (let t = 0; t < batch.counts.length; t++) {
      if (canSpawn && !canSpawn[t]) continue;
      if (SPAWN_TYPES[t] === DOMINION && eliteCap) continue;
      if (batch.spawned[t] >= batch.counts[t]) continue;
      const v = (batch.spawned[t] + 0.5) / batch.counts[t];
      if (v < bestV) {
        bestV = v;
        best = t;
      }
    }
    return best;
  }

  private dominionAlive(): number {
    return this.livingDominions;
  }

  private allocSlot(): number {
    if (this.activeCount >= MAX_LIVING_ENEMIES) return -1;
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

  /** A trickle is one complete batch; wait rather than spending a refill on a partial placement. */
  private canAlloc(count: number): boolean {
    if (this.activeCount + count > MAX_LIVING_ENEMIES) return false;
    let available = ENEMY_SLOTS - this.nextFresh;
    for (let k = 0; k < this.freeCount && available < count; k++) {
      const s = this.freeFifo[(this.freeHead + k) % ENEMY_SLOTS];
      if (this.tick - this.eFreedTick[s] < SLOT_REUSE_TICKS) break;
      available++;
    }
    return available >= count;
  }

  /** Places a new enemy on a cell (§2.3) and returns its slot, or -1 if no slot is free. */
  placeEnemy(type: number, c: number, r: number, room: number): number {
    const slot = this.allocSlot();
    if (slot >= 0) this.spawnAt(slot, type, c, r, room, -1);
    return slot;
  }

  private spawnAt(slot: number, type: number, c: number, r: number, room: number, wave: number): void {
    if (this.nextIncarnation > 0xffffffff) throw new Error('enemy incarnation exhausted');
    if ((type === CANTOR || type === CARRIER) && this.commanders.hasFamily(type, room)) type = DOMINION;
    const def = ENEMIES[type];
    this.eIncarnation[slot] = this.nextIncarnation++;
    this.eSpawnTick[slot] = this.tick;
    this.eAlive[slot] = 1;
    this.eType[slot] = type;
    this.eState[slot] = ST_IDLE;
    this.eX[slot] = c + 0.5;
    this.eY[slot] = r + 0.5;
    this.eZ[slot] = this.map.floor[r * this.map.w + c] + (ENEMIES[type].flying ? CHERUB_HOVER : 0);
    this.eStartX[slot] = this.eX[slot];
    this.eStartY[slot] = this.eY[slot];
    this.eVz[slot] = 0;
    this.eGrounded[slot] = 1;
    this.eHp[slot] = def.hp;
    if (isCommander(type)) this.livingDominions++;
    this.eGoldEntitled[slot] = 0;
    this.eXp[slot] = 0;
    if (wave >= 0) {
      const w = this.map.rooms[room].waves[wave], party = this.rooms[room].partySize;
      const group = isCommander(type) ? 3 : type;
      const counts = [w.blessed, w.choristers, w.cherubs, w.dominions ?? 0];
      const count = scaleCount(counts[group] ?? 0, party);
      if (count > 0) this.eXp[slot] = (w.xp?.[group] ?? counts[group] * [1, 6, 4, 60][group]) / count;
    }
    this.dominions.reset(slot);
    this.dominions.leapReadyAt[slot] = this.tick + DOMINION_COOLDOWN_TICKS;
    if (isCommander(type) && wave >= 0) {
      const n4 = this.map.rooms[room].waves[wave].dominions ?? 0;
      const party = this.rooms[room].partySize, count = scaleCount(n4, party);
      if (count > 0) this.eHp[slot] *= n4 * partyMultiplier(party) / count;
      const placed = this.elitePlaced.get(room);
      if (placed) this.eGoldEntitled[slot] = placed[wave]++ < (this.eliteGold.get(room)?.[wave] ?? 0) ? 1 : 0;
    }
    this.eRoom[slot] = room;
    this.eWave[slot] = wave;
    this.home[slot] = ROOM_NONE;
    this.leashed[slot] = 0;
    this.eUnreachableSince[slot] = -1;
    this.eRecoveryFailed[slot] = -1;
    this.eStillSince[slot] = this.tick;
    this.eStillX[slot] = this.eX[slot];
    this.eStillY[slot] = this.eY[slot];
    this.eLos[slot] = 0;
    this.eTarget[slot] = -1;
    this.eWaypoint[slot] = this.eWaypointGoal[slot] = -1;
    this.eStrafe[slot] = 1;
    this.eStrafeT[slot] = 0;
    this.eHurtTick[slot] = -1;
    this.eSlowUntil[slot] = 0;
    this.eRootUntil[slot] = 0;
    this.eSilenceUntil[slot] = 0;
    this.eTauntUntil[slot] = 0;
    this.eStunUntil[slot] = 0;
    this.eIncenseTick[slot] = -CLOUD_PULSE_TICKS;
    this.eKbUntil[slot] = 0;
    this.ePullStart[slot] = -1;
    this.eCast[slot] = 0;
    this.eCastT[slot] = 0;
    this.eCastCd[slot] = 0;
    this.eMeleeNext[slot] = -1;
    this.activePos[slot] = this.activeCount;
    this.active[this.activeCount++] = slot;
    if (type !== GATEKEEPER) this.living++;
    if (room >= 0) {
      const st = this.rooms[room];
      if (type !== GATEKEEPER) st.alive++;
      if (wave >= 0) st.waveAlive[wave]++;
    }
    this.retarget(slot);
    this.commanders.spawn(slot);
  }

  /**
   * Removes an enemy and frees its slot (reusable after 1 s). Except in the victory sweep (`sweep`), it
   * adds 1 to the intensity of each living player within 5 m horizontally (M12 §2.3).
   */
  removeEnemy(slot: number, sweep = false): void {
    if (!this.eAlive[slot]) return;
    this.dominions.cancel(slot, this.tick);
    this.commanders.remove(slot);
    this.eAlive[slot] = 0;
    this.ePooled[slot] = 0;
    const type = this.eType[slot];
    if (isCommander(type)) this.livingDominions--;
    const d = sweep || type === GATEKEEPER ? null : this.activeDirector();
    if (d) {
      for (const p of this.players) {
        if (this.livingTargetable(p) && Math.hypot(this.eX[slot] - p.x, this.eY[slot] - p.y) <= KILL_NEAR_RADIUS) d.killNear(p.index);
      }
    }
    if (type !== GATEKEEPER) this.living--;
    const room = this.eRoom[slot];
    if (room >= 0) {
      const st = this.rooms[room];
      if (type !== GATEKEEPER) st.alive--;
      const wave = this.eWave[slot];
      if (wave >= 0) st.waveAlive[wave]--;
    }
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
  killAll(blessedOnly = false): void {
    if (this.progressionEnabled) return;
    if (!blessedOnly) {
      while (this.activeCount > 0) this.removeEnemy(this.active[this.activeCount - 1]);
      return;
    }
    for (let k = this.activeCount - 1; k >= 0; k--) if (this.eType[this.active[k]] === BLESSED) this.removeEnemy(this.active[k]);
  }

  /** Marks an enemy as hurt this tick (sets the per-recipient `hurt` flag). */
  markHurt(slot: number): void {
    this.eHurtTick[slot] = this.tick;
  }

  // ------------------------------------------------------------------ damage (§5.5)

  /**
   * A hit on an enemy. `source` is the player index that gets the kill credit, or -1. `force` decides a
   * burst death (M12 §4.1), summed over the tick; a burst is blasted away from (fromX, fromY), by
   * default the credited player.
   */
  damageEnemy(slot: number, amount: number, source: number, force = amount, fromX = NaN, fromY = NaN, worldBurst = false, areaSource = Number.isFinite(fromX) && Number.isFinite(fromY)): void {
    if (!this.eAlive[slot] || amount <= 0) return;
    const cast = this.commanders.active.get(slot);
    if (cast?.kind === 'beam' && (cast.phase === 'tell' || cast.phase === 'active') && !worldBurst && (source >= 0 || Number.isFinite(fromX) && Number.isFinite(fromY))) {
      const area = areaSource, attacker = this.slots[source];
      const x = area ? fromX : attacker?.x, y = area ? fromY : attacker?.y;
      if (x !== undefined && y !== undefined) { const factor = hymnalReduction(cast.yaw, x - this.eX[slot], y - this.eY[slot], area); amount *= factor; force *= factor; }
    }
    // 1. Bound (M9 §3.6): a rooted enemy, during the pull too, takes double damage, and double force.
    if (this.isRooted(slot)) {
      amount *= BOUND_FACTOR;
      force *= BOUND_FACTOR;
    }
    if (this.eForceTick[slot] !== this.tick) {
      this.eForceTick[slot] = this.tick;
      this.eForce[slot] = 0;
    }
    this.eForce[slot] += force;
    // Judgment is interrupted by the boss taking 1 300 damage during it, counted after step 1.
    if (slot === this.bossSlot && this.bossCast === BOSS_CAST_JUDGMENT) {
      this.judgmentDamage += amount;
      if (this.judgmentDamage >= JUDGMENT_INTERRUPT * bossMultiplier(this.bossParty, this.bossSolo) - 1e-9) this.interruptJudgment();
    }
    const shooter = source >= 0 ? this.slots[source] : undefined;
    if (shooter) shooter.damage += Math.min(amount, this.eHp[slot]);
    this.commanders.damaged(slot, Math.min(amount, this.eHp[slot]));
    this.eHp[slot] -= amount;
    this.eHurtTick[slot] = this.tick;
    // 5. Death and kill credit.
    if (this.eHp[slot] <= 0) {
      this.settleEnemyXp(slot);
      this.enemyDrops(slot);
      if (shooter) {
        shooter.kills++;
        this.noteBurst(slot, shooter, fromX, fromY);
      } else if (worldBurst) this.noteBurst(slot, null, fromX, fromY);
      this.removeEnemy(slot);
    }
  }

  /** Only accepted damage deaths reach this path; recovery/dev removal never settles rewards. */
  private enemyDrops(slot: number): void {
    const room = this.eRoom[slot], type = this.eType[slot], def = this.map.rooms[room];
    if (!def?.shape || type === GATEKEEPER || this.leashed[slot]) return;
    const x = this.eX[slot], y = this.eY[slot];
    if (this.eWave[slot] >= 0) {
      const coins = this.haloLedgers.get(room)?.death(HALO_WEIGHT[type as 0 | 1 | 2] ?? 0) ?? 0;
      for (let i = 0; i < coins; i++) this.pickups.drop(COIN, room, x, y, this.tick, 1);
      if (isCommander(type)) {
        if (this.eGoldEntitled[slot]) this.pickups.drop(GOLD_HALO, room, x, y, this.tick);
        this.eGoldEntitled[slot] = 0;
        this.dropMote(room, x, y); this.dropMote(room, x, y);
      }
      // Reward ordinary wave kills too; cleanup, leashed enemies and boss adds never roll items.
      const itemChance = isCommander(type) ? 0.5 : type === BLESSED ? 0.02 : 0.12;
      if (this.random() < itemChance) this.pickups.drop(itemDrop(this.random), room, x, y, this.tick, 0, DROPPED_ITEM_LIFETIME);
    }
    if ((type === CHORISTER || type === CHERUB) && this.random() < 0.35) this.dropMote(room, x, y);
  }

  private dropMote(room: number, x: number, y: number): void {
    const count = this.moteDrops.get(room) ?? 0;
    if (count >= moteCap(this.map.rooms[room]?.shape)) return;
    this.moteDrops.set(room, count + 1);
    this.pickups.drop(HEAL_MOTE, room, x, y, this.tick);
  }

  private collectPickup(drop: PickupRecord, p: SimPlayer): boolean {
    if (drop.kind === COIN || drop.kind === GOLD_HALO) {
      this.halosCredited += drop.value;
      for (const human of this.players) if (human.connected && !human.bot) human.wallet += drop.value;
    } else if (drop.kind === HEAL_MOTE) p.hp = Math.min(p.maxHp, p.hp + p.maxHp * 0.08);
    else if (drop.kind >= ITEM_FIRST && drop.kind < ITEM_FIRST + ITEM_IDS.length && !p.bot) {
      const item = ITEM_IDS[drop.kind - ITEM_FIRST];
      if (!this.items.pickup(p, item)) return false;
      this.publishInventory(p);
    } else if (drop.kind === 13 && !p.bot) {
      this.revealChart();
    } else if (drop.kind === 15 && !p.bot) {
      const recipients = this.pageRecipients.get(drop.id);
      if (!recipients?.delete(p.offerKey)) return false;
      p.wallet += RITE_PAGE_HALOS; this.publishInventory(p);
      if (recipients.size) return false; // A page retains other humans' personal entitlements.
      this.pageRecipients.delete(drop.id);
    } else return false;
    this.emit('all', { type: 'pickupCollected', id: drop.id, kind: drop.kind, playerId: p.id, x: drop.x, y: drop.y, z: this.pickups.floor(drop.x, drop.y) });
    return true;
  }

  private awardXp(amount: number): void {
    for (const p of this.players) if (p.connected && !p.bot) {
      const adjusted = amount - p.xpCorrection, sum = p.runXp + adjusted;
      p.xpCorrection = (sum - p.runXp) - adjusted; p.runXp = sum;
    }
  }

  inventoryState(p: SimPlayer): InventoryState {
    return { playerId: p.id, inventory: copyInventory(p.inventory), wallet: p.wallet, sold: p.sold, chart: this.chartRevealed,
      nextRequestId: p.requests.next, itemReadyTick: p.itemReadyTick, featherUntil: p.featherUntil, sealUntil: p.sealUntil, itemsTried: [...p.itemsTried], xp: saturatingAdd(p.xpBase, Math.floor(p.runXp)), runXp: Math.floor(p.runXp) };
  }
  publishInventory(p: SimPlayer): void { this.emit(p.id, { type: 'inventory', state: this.inventoryState(p) }); }
  /** Accepted eye/range/aim/LOS, evaluated again at commit rather than trusting the visible card. */
  interact(playerId: number, requestId: number, sourceId: number): void {
    const p = this.playerById(playerId); if (!p || p.bot) return;
    const result = p.requests.execute(requestId, `shop:${sourceId}`, () => {
      const original = sourceId < 5 ? sourceId : sourceId - 5;
      const room = this.floor ? sourceId < 5 ? this.floor.pardoner : this.floor.boss : -1;
      const point = this.floor && sourceId < 5 ? this.map.rooms[this.floor.pardoner].points?.pedestals?.[sourceId] : null;
      const stair = this.won && this.floor && sourceId >= 5 && sourceId <= 8 ? stairPoints(this.map, this.floor.boss)[original + 1] : null;
      if ((!point && !stair) || !Number.isInteger(sourceId) || !p.connected || p.dead || this.result) return { accepted: false, reason: 'Unavailable' };
      const x = stair ? stair.x : point![0] + .5, y = stair ? stair.y : point![1] + .5, z = stair ? stair.z + 1 : this.map.floor[point![1] * this.map.w + point![0]] + 1;
      const dx = x - p.x, dy = y - p.y, dz = z - p.z - PLAYER_EYE, d = Math.hypot(dx, dy, dz), aim = aimDir(p.yaw, p.pitch);
      if (d > 2 || this.pickups.roomAt(p.x, p.y) !== room || !lineOfSight(this.map, p.x, p.y, p.z + PLAYER_EYE, x, y, z) || d > 0.01 && (dx * aim[0] + dy * aim[1] + dz * aim[2]) / d < 0.8) return { accepted: false, reason: 'Look at a pedestal within 2 m' };
      if (sourceId !== 4) return buyItem(p, this.floor!.stock, original);
      if (this.chartRevealed) return { accepted: false, reason: 'Chart already revealed' };
      if (p.wallet < CHART_PRICE) return { accepted: false, reason: 'Not enough halos' };
      p.wallet -= CHART_PRICE; this.revealChart();
      return { accepted: true, reason: "Pardoner’s Chart revealed the floor" };
    });
    this.emit(playerId, { type: 'interactionResult', requestId, ...(result ?? { accepted: false, reason: 'Stale interaction; try again' }) });
    this.publishInventory(p);
  }
  private clearReward(room: number): void {
    const reward = this.floor?.rewards[room], point = this.map.rooms[room].points?.reward;
    if (!reward || !point || reward.kind === 'nothing') return;
    const kind = reward.kind === 'gold' ? GOLD_HALO : reward.kind === 'item' ? ITEM_FIRST + ITEM_IDS.indexOf(reward.item) : 15;
    const drop = this.pickups.drop(kind, room, point[0] + 0.5, point[1] + 0.5, this.tick, reward.kind === 'gold' ? REWARD_GOLD_VALUE : 0);
    if (reward.kind === 'rite' && drop) this.pageRecipients.set(drop.id, new Set(this.rewardRecipients.get(room) ?? []));
  }
  private revealChart(): void {
    if (this.chartRevealed) return;
    this.chartRevealed = true;
    this.rooms.forEach((r, i) => { r.knowledge = Math.max(1, r.knowledge); this.roomState(i); });
    for (const other of this.players) this.publishInventory(other);
  }
  private settleEnemyXp(slot: number): void {
    if (this.eType[slot] === GATEKEEPER) this.awardXp(1500);
    else if (this.eXp[slot] > 0) { this.awardXp(this.eXp[slot]); this.eXp[slot] = 0; }
    else if (this.leashed[slot] && this.eType[slot] === BLESSED) this.awardXp(1);
  }

  /** A credited kill bursts when its tick's force reaches 2× the type's max HP, heavy at 4× (M12 §4.1). */
  private noteBurst(slot: number, shooter: SimPlayer | null, fromX: number, fromY: number): void {
    const type = this.eType[slot];
    if (type === GATEKEEPER) return;
    const tier = burstTier(this.eForce[slot], ENEMIES[type].hp);
    if (tier === 0) return;
    const fx = Number.isNaN(fromX) ? shooter?.x ?? this.eX[slot] : fromX;
    const fy = Number.isNaN(fromY) ? shooter?.y ?? this.eY[slot] : fromY;
    const angle = burstAngle(fx, fy, this.eX[slot], this.eY[slot], slot);
    this.tickBursts.push(slot, tier === 2 ? angle + 360 : angle, shooter?.id ?? -1);
  }

  // ------------------------------------------------------------------ generated props (rogue R2.2)

  private propBroken(p: Prop, origin: 'player' | 'world'): void {
    const z = p.z + PROP_HEIGHT[p.family] / 2;
    const targets: number[] = [];
    if (p.family === 'loot') {
      if (p.marked) this.pickups.drop(this.floor ? 13 : GOLD_HALO, p.room, p.x, p.y, this.tick);
      else {
        const odds = ['combat', 'boss'].includes(this.map.rooms[p.room].kind) ? LOOT_ROLL.combat : LOOT_ROLL.other;
        const roll = this.random();
        if (roll >= odds.nothing && roll < odds.coin) this.pickups.drop(COIN, p.room, p.x, p.y, this.tick);
        else if (roll >= odds.coin && roll < odds.mote) this.pickups.drop(HEAL_MOTE, p.room, p.x, p.y, this.tick);
        else if (roll >= odds.mote) this.pickups.drop(itemDrop(this.random), p.room, p.x, p.y, this.tick, 0, DROPPED_ITEM_LIFETIME);
      }
    } else if (p.family === 'blessing' && origin === 'player') {
      for (const q of this.players) {
        if (!this.livingTargetable(q) || this.roomAt(q.x, q.y) !== p.room ||
          distToCylinder(p.x, p.y, z, q.x, q.y, q.z, PLAYER_RADIUS, PLAYER_HEIGHT) > 6 ||
          !lineOfSight(this.map, p.x, p.y, z, q.x, q.y, q.z + PLAYER_HEIGHT / 2)) continue;
        this.heal(q, 30); targets.push(q.id);
      }
    }
    this.emit('all', { type: 'propBroken', id: p.id, family: p.family, x: p.x, y: p.y, z: p.z,
      marked: p.marked, impactTick: p.blastTick, readyTick: p.readyTick, targets });
  }

  private explodeProp(p: Prop): void {
    const z = p.z + PROP_HEIGHT.blast / 2;
    this.emit('all', { type: 'propBlast', id: p.id, x: p.x, y: p.y, z: p.z });
    const victims: number[] = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k], def = ENEMIES[this.eType[s]];
      if (this.roomAt(this.eX[s], this.eY[s]) !== p.room ||
        distToCylinder(p.x, p.y, z, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) > 4 ||
        !lineOfSight(this.map, p.x, p.y, z, this.eX[s], this.eY[s], this.eZ[s] + def.height / 2)) continue;
      victims.push(s);
    }
    for (const s of victims) this.damageEnemy(s, 60, -1, Infinity, p.x, p.y, true);
    for (const q of this.players) {
      if (!this.livingTargetable(q) || this.roomAt(q.x, q.y) !== p.room ||
        distToCylinder(p.x, p.y, z, q.x, q.y, q.z, PLAYER_RADIUS, PLAYER_HEIGHT) > 4 ||
        !lineOfSight(this.map, p.x, p.y, z, q.x, q.y, q.z + PLAYER_HEIGHT / 2)) continue;
      this.damagePlayer(q, PROP_BLAST_PLAYER_DAMAGE);
    }
    this.props.area(p.x, p.y, z, 4, this.tick, 'world', (q) => q.room === p.room);
  }

  /** Native damage rays carry on through props, like globes, until their accepted enemy/terrain stop. */
  private propsOnRay(x: number, y: number, z: number, dx: number, dy: number, dz: number, stop: number): void {
    for (const { prop } of this.props.ray(x, y, z, dx, dy, dz, stop)) this.props.break(prop.id, this.tick);
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
    p.lastHurtTick = this.tick;
    // 4. Shield; one taken to 0 bursts (M9 §3.3).
    let burst = false;
    let absorbed = 0;
    if (p.shield > 0) {
      absorbed = Math.min(p.shield, amount);
      p.shield -= absorbed;
      amount -= absorbed;
      burst = p.shield <= 0 && p.sealUntil <= this.tick;
    }
    const [x, y, z] = [p.x, p.y, p.z];
    // Intensity (M12 §2.3): the shield absorbed plus the HP lost, counted down to 0 only.
    this.activeDirector()?.hurt(p.index, absorbed + Math.min(amount, p.hp), p.maxHp);
    p.hp -= amount;
    // 5. Death.
    if (p.hp <= 0) this.killPlayer(p);
    // Even if the hit killed the player: the burst is where they stood.
    if (burst) this.shroudBurst(p, x, y, z);
  }

  /**
   * Martyr's Shroud bursts (M9 §3.3): 50 damage to every enemy within 3.5 m of the shielded player's body
   * center (M12 §5.4), credited to the caster, or to no one if the caster has left. Its force is
   * Infinity: what it kills bursts heavy, blasted away from its center (M12 §4.1).
   */
  private shroudBurst(p: SimPlayer, x: number, y: number, z: number): void {
    const caster = p.shieldCaster;
    p.shieldCaster = null;
    const source = caster && caster.connected ? caster.index : -1;
    const cz = z + PLAYER_HEIGHT / 2;
    const hit: number[] = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      const def = ENEMIES[this.eType[s]];
      if (distToCylinder(x, y, cz, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) <= SHROUD_BURST_RADIUS) hit.push(s);
    }
    // Applied after the scan: a kill removes the enemy from the active list.
    for (const s of hit) this.damageEnemy(s, SHROUD_BURST_DAMAGE, source, Infinity, x, y);
    if (caster?.connected) this.props.area(x, y, cz, SHROUD_BURST_RADIUS, this.tick);
    this.emit('all', { type: 'shroudBurst', playerId: p.id, x, y, z });
  }

  private killPlayer(p: SimPlayer): void {
    // A death is a peak (M12 §2.3), and the player's intensity is 0.
    this.activeDirector()?.died(p.index);
    p.dead = true;
    p.deaths++;
    p.featherUntil = p.sealUntil = 0; p.speed = CLASSES[p.classId].speed; p.pendingItems = [false, false];
    p.hp = 0;
    p.shield = 0;
    // The soul (M8 §4.1): its ground point is the feet, dropped to the ground under them.
    const g = groundHeight(this.map, p.x, p.y, PLAYER_RADIUS, Infinity, false, true);
    if (g !== -Infinity) p.z = g;
    p.soulTick = this.tick;
    p.revive = 0;
    p.revivers = 0;
    // Its `beam` runs out 0.6 s after its last firing, as while alive (M9 §2.5).
    p.fire = 0;
    p.pendingQ = false;
    p.pendingE = false;
    p.landingTick = -1;
    p.dash = null;
    this.emit('all', { type: 'playerDied', playerId: p.id });
    // Blasphemy ends when the Fallen dies (§7.2).
    if (p.classId === 'fallen') for (let k = 0; k < this.activeCount; k++) this.eTauntUntil[this.active[k]] = 0;
  }

  /** Heals a living player, capped at max HP. */
  heal(p: SimPlayer, amount: number): void {
    if (p.dead || !p.connected) return;
    p.hp = Math.min(p.maxHp, p.hp + amount);
  }

  /** Gives a living player a shield; a new shield replaces the old one. The host remembers who cast it (M9 §3.3). */
  giveShield(p: SimPlayer, amount: number, seconds: number, caster: SimPlayer | null = null): void {
    if (p.dead || !p.connected) return;
    p.shield = amount;
    p.shieldUntil = this.tick + ticks(seconds);
    p.shieldCaster = caster;
    p.sealUntil = 0;
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
    if (this.eType[slot] === CARRIER) this.commanders.cancel(slot);
    this.eRootUntil[slot] = Math.max(this.eRootUntil[slot], this.tick + ticks(seconds));
    if (this.dominions.active.get(slot)?.leap) this.dominions.cancel(slot, this.tick);
  }

  /** Rooted: by Chains, including the 0.3 s pull. The Gatekeeper can't be rooted. */
  isRooted(slot: number): boolean {
    return this.tick < this.eRootUntil[slot] || this.ePullStart[slot] >= 0;
  }

  /** Stun (M12 §5.3): a new stun takes the later end; a cast in progress is cancelled. The Gatekeeper can't be stunned. */
  stun(slot: number, seconds: number): void {
    if (this.immune(slot)) return;
    this.eStunUntil[slot] = Math.max(this.eStunUntil[slot], this.tick + ticks(seconds));
    this.dominions.cancel(slot, this.tick);
    this.commanders.cancel(slot);
    this.eCast[slot] = 0;
    this.eCastT[slot] = 0;
  }

  isStunned(slot: number): boolean {
    return this.tick < this.eStunUntil[slot];
  }

  /** Silence: a cast in progress is cancelled. */
  silence(slot: number, seconds: number): void {
    this.eSilenceUntil[slot] = Math.max(this.eSilenceUntil[slot], this.tick + ticks(seconds));
    this.dominions.cancel(slot, this.tick);
    this.commanders.cancel(slot);
    this.eCast[slot] = 0;
    this.eCastT[slot] = 0;
  }

  /**
   * Knockback: pushed horizontally by `dist` over `seconds` (0.2 s, or Falling Star's 0.4 s), with
   * normal collision and no steering. A new knockback replaces one in progress.
   */
  knockback(slot: number, dirX: number, dirY: number, dist: number, seconds = KNOCKBACK_TIME): void {
    if (this.immune(slot)) return;
    const len = Math.hypot(dirX, dirY);
    if (len < 1e-9) return;
    if (this.dominions.active.get(slot)?.leap) this.dominions.cancel(slot, this.tick);
    const v = dist / seconds;
    this.eKbVx[slot] = (dirX / len) * v;
    this.eKbVy[slot] = (dirY / len) * v;
    this.eKbFrom[slot] = this.tick;
    this.eKbUntil[slot] = this.tick + ticks(seconds);
  }
  /**
   * Plume of Expulsion's throw: a real half-second flight whose hit cylinder follows gravity, not client
   * VFX. Returns whether the body was thrown (and so takes the Plume's damage).
   */
  itemLaunch(slot: number, x: number, y: number): boolean {
    if (this.immune(slot) || this.isRooted(slot) || !this.eGrounded[slot] || this.tick < this.eKbUntil[slot]) return false;
    this.knockAway(slot, x, y, PLUME_THROW, .5);
    this.eVz[slot] = PLUME_LIFT; this.eGrounded[slot] = 0;
    this.commanders.cancel(slot); this.dominions.cancel(slot, this.tick);
    return true;
  }

  /** Knocks an enemy away from (cx, cy); one exactly there goes along a fixed angle from its slot. */
  private knockAway(slot: number, cx: number, cy: number, dist: number, seconds: number): void {
    let dx = this.eX[slot] - cx;
    let dy = this.eY[slot] - cy;
    if (Math.hypot(dx, dy) < 1e-6) {
      const a = (slot % 16) * (Math.PI / 8);
      dx = Math.cos(a);
      dy = Math.sin(a);
    }
    this.knockback(slot, dx, dy, dist, seconds);
  }

  /** Chains: moves linearly to (x, y) over 0.3 s ignoring collision, then roots for 1.5 s. */
  pull(slot: number, x: number, y: number, floorZ: number): void {
    if (this.immune(slot)) return;
    if (this.eType[slot] === CARRIER) this.commanders.cancel(slot);
    const o = slot * 6;
    this.ePull[o] = this.eX[slot];
    this.ePull[o + 1] = this.eY[slot];
    this.ePull[o + 2] = this.eZ[slot];
    this.ePull[o + 3] = x;
    this.ePull[o + 4] = y;
    // Ground enemies end on the floor there; flyers keep their hover height.
    this.ePull[o + 5] = ENEMIES[this.eType[slot]].flying ? this.eZ[slot] : floorZ;
    this.ePullStart[slot] = this.tick;
    this.eKbUntil[slot] = 0;
  }

  // ------------------------------------------------------------------ players

  /**
   * True solo sustain (rogue game.md §4.3): breath during ordinary combat relax, baseline during
   * boss combat. There is no passive recovery between encounters.
   */
  private regenerate(p: SimPlayer): void {
    if (this.activePhase !== PHASE_COMBAT || this.roomAt(p.x, p.y) !== this.activeRoom) return;
    const d = this.activeDirector();
    if (!d && this.map.rooms[this.activeRoom].kind !== 'boss') return;
    const [delay, fraction] = d ? [BREATH_DELAY_TICKS, BREATH_FRACTION] : [REGEN_DELAY_TICKS, REGEN_FRACTION];
    if (d && d.phase !== 'relax') return;
    if (this.tick - p.lastDamageTick < delay) return;
    p.hp = Math.min(p.maxHp, p.hp + fraction * p.maxHp * TICK_DT);
  }

  /** A grab cancels queued actions and unfinished movement attacks without executing them. */
  cancelPlayerActions(p: SimPlayer): void {
    p.fire = 0; p.pendingQ = p.pendingE = false;
    p.pendingItems[0] = p.pendingItems[1] = false;
    p.dash = null; p.landingTick = -1;
  }

  private updatePlayers(): void {
    for (const p of this.players) {
      const carried = !!this.commanders.carriedBy(p.id);
      if (carried) this.cancelPlayerActions(p);
      p.speed = CLASSES[p.classId].speed + (this.tick < p.featherUntil ? FEATHER_SPEED : 0);
      for (const slot of [0, 1] as const) if (p.pendingItems[slot]) { p.pendingItems[slot] = false; this.items.manual(p, slot); }
      p.cdQ = Math.max(0, p.cdQ - TICK_DT);
      p.cdE = Math.max(0, p.cdE - TICK_DT);
      if (p.shield > 0 && this.tick >= p.shieldUntil) p.shield = 0;
      if (!p.dead && this.solo) this.regenerate(p);
      if (p.dead || carried) {
        p.fireTimer = Math.max(0, p.fireTimer - TICK_DT);
        continue;
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
      if (p.dash) this.updateDash(p);
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
  fireRate(p: SimPlayer): number {
    return this.inField(p) ? FIELD_FIRE_RATE : 1;
  }

  /** A living player in the Field of Blood, by its latest accepted position (M9 §3.4). */
  inField(p: SimPlayer): boolean {
    return this.tick < this.fieldUntil && !p.dead && inField(this.fieldX, this.fieldY, p.x, p.y);
  }

  /**
   * Sacrament's ally (M9 §2.5): the latest input's ally target, if it's another living player, or a
   * soul, within 40 m of the eye (to the soul's cylinder). Line of sight isn't rechecked.
   */
  sacramentTarget(p: SimPlayer): SimPlayer | undefined {
    if (p.classId !== 'heretic' || p.allyTargetId === ALLY_NONE) return undefined;
    const ally = this.playerById(p.allyTargetId);
    if (!ally || ally === p) return undefined;
    const ez = p.z + PLAYER_EYE;
    let d: number;
    if (this.hasSoul(ally)) d = distToCylinder(p.x, p.y, ez, ally.x, ally.y, this.soulBase(ally), SOUL_RADIUS, SOUL_HEIGHT);
    else if (this.livingTargetable(ally)) d = distToCylinder(p.x, p.y, ez, ally.x, ally.y, ally.z, PLAYER_RADIUS, PLAYER_HEIGHT);
    else return undefined;
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
        // Heals even at full HP, so the beam stays steady; it never heals the Heretic. On a soul it
        // revives instead, like a hit (M8 §4.2).
        const ally = this.sacramentTarget(p);
        if (!ally) return;
        if (ally.dead) this.addRevive(ally, reviveHit(w.interval, true), p);
        else this.heal(ally, w.damage);
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
    const knock = p.classId === 'fallen' && slot === ATTACK_PRIMARY ? new Set<number>() : null;
    const bodyZ = p.z + PLAYER_HEIGHT / 2;
    for (let i = 0; i < w.pellets; i++) {
      const yaw = w.spreadYaw > 0 ? p.yaw + (this.random() * 2 - 1) * w.spreadYaw : p.yaw;
      const pitch = w.spreadPitch > 0 ? p.pitch + (this.random() * 2 - 1) * w.spreadPitch : p.pitch;
      const [dx, dy, dz] = aimDir(yaw, pitch);
      const hits = this.rayEnemies(ex, ey, ez, dx, dy, dz, w.range, w.maxHits);
      // Where the ray stops: the terrain or its range, or the last enemy it can pierce.
      let stop = raycastTerrain(this.map, ex, ey, ez, dx, dy, dz, w.range);
      if (hits.length >= w.maxHits) stop = this.rayT(hits[hits.length - 1], ex, ey, ez, dx, dy, dz);
      this.soulsOnRay(p, ex, ey, ez, dx, dy, dz, stop, souls);
      this.globesOnRay(p, ex, ey, ez, dx, dy, dz, stop);
      this.propsOnRay(ex, ey, ez, dx, dy, dz, stop);
      for (const s of hits) {
        // A shotgun pellet within 6 m deals 20, a Blessed's HP, and always bursts what it kills; beyond, 10
        // (M12 §5.1, §4.1).
        const def = ENEMIES[this.eType[s]];
        const close = knock !== null && distToCylinder(p.x, p.y, bodyZ, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) <= SHOTGUN_KNOCKBACK_RANGE;
        const damage = close ? SHOTGUN_CLOSE_DAMAGE : w.damage;
        this.damageEnemy(s, damage, p.index, close ? Infinity : damage);
        if (w.slow > 0 && this.eAlive[s]) this.slow(s, w.slow);
        knock?.add(s);
      }
    }
    for (const o of souls) this.addRevive(o, reviveHit(w.interval, p.classId === 'heretic'), p);
    // The shotgun knocks back each survivor within 6 m once per shot, except rooted ones (M9 §3.1).
    if (knock) {
      for (const s of knock) {
        if (!this.eAlive[s] || this.isRooted(s)) continue;
        const def = ENEMIES[this.eType[s]];
        if (distToCylinder(p.x, p.y, bodyZ, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) > SHOTGUN_KNOCKBACK_RANGE) continue;
        this.knockAway(s, p.x, p.y, SHOTGUN_KNOCKBACK_DIST, KNOCKBACK_TIME);
      }
    }
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
   * Shoots down every globe whose path in the last 0.25 s passes within 0.3 m of a player's ray from
   * (ox, oy, oz) along the unit (dx, dy, dz) up to `stop` (M12 follow-up §1.3). The ray carries on.
   */
  private globesOnRay(p: SimPlayer, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, stop: number): void {
    let hit: number[] | null = null;
    for (const g of this.projectiles) {
      if (this.pKind[g] !== PROJ_GLOBE || this.pOwner[g] >= 0) continue;
      const back = Math.min(this.pTraveled[g], this.pSpeed[g] * GLOBE_SHOT_TRAIL);
      const gx = this.pX[g];
      const gy = this.pY[g];
      const gz = this.pZ[g];
      const d = segmentDistance(ox, oy, oz, ox + dx * stop, oy + dy * stop, oz + dz * stop, gx - this.pDx[g] * back, gy - this.pDy[g] * back, gz - this.pDz[g] * back, gx, gy, gz);
      if (d <= GLOBE_SHOT_REACH + 1e-9) {
        if (!hit) hit = [];
        hit.push(g);
      }
    }
    if (hit) for (const g of hit) this.shootDownGlobe(g, p);
  }

  /** A globe shot down by player `p`: 40 to every enemy within 3 m in its line of sight, credited, and nothing to players. */
  private shootDownGlobe(slot: number, p: SimPlayer): void {
    if (!this.pAlive[slot]) return;
    const x = this.pX[slot];
    const y = this.pY[slot];
    const z = this.pZ[slot];
    this.removeProjectile(slot);
    this.props.area(x, y, z, GLOBE_SHOT_BLAST, this.tick);
    for (let k = this.activeCount - 1; k >= 0; k--) {
      const s = this.active[k];
      const def = ENEMIES[this.eType[s]];
      if (distToCylinder(x, y, z, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) > GLOBE_SHOT_BLAST + 1e-9) continue;
      if (!lineOfSight(this.map, x, y, z, this.eX[s], this.eY[s], this.eZ[s] + def.height / 2)) continue;
      this.damageEnemy(s, GLOBE_SHOT_DAMAGE, p.index, GLOBE_SHOT_DAMAGE, x, y);
    }
    this.emit('all', { type: 'globeShatter', x, y, z, by: p.id });
  }

  /**
   * A globe shatters on what it touched at (x, y, z) (M12 follow-up §1.3): its damage to the player it hit
   * (`direct`, or none) and to every other living targetable player within 1.5 m in its line of sight.
   */
  private shatterGlobe(slot: number, x: number, y: number, z: number, direct: SimPlayer | null): void {
    const damage = this.pDamage[slot];
    const lx = x - this.pDx[slot] * GLOBE_LOS_BACK;
    const ly = y - this.pDy[slot] * GLOBE_LOS_BACK;
    const lz = z - this.pDz[slot] * GLOBE_LOS_BACK;
    this.removeProjectile(slot);
    for (const p of this.players) {
      if (!this.livingTargetable(p)) continue;
      if (p !== direct) {
        if (distToCylinder(x, y, z, p.x, p.y, p.z, PLAYER_RADIUS, PLAYER_HEIGHT) > GLOBE_BLAST + 1e-9) continue;
        if (!lineOfSight(this.map, lx, ly, lz, p.x, p.y, p.z + PLAYER_HEIGHT / 2)) continue;
      }
      this.damagePlayer(p, damage);
    }
    this.emit('all', { type: 'globeShatter', x, y, z, by: -1 });
  }

  /**
   * The Scourge (M9 §2.6): 25 damage to every living enemy within 3 m of the body center and within 60°
   * of the horizontal aim (M12 §5.5), slowing the survivors for 1 s. No line of sight is needed. Its
   * force is Infinity: what it kills bursts heavy (M12 §4.1).
   */
  scourge(p: SimPlayer): void {
    const w = SECONDARIES.binder;
    const cx = p.x;
    const cy = p.y;
    const cz = p.z + PLAYER_HEIGHT / 2;
    const ax = Math.cos(p.yaw);
    const ay = Math.sin(p.yaw);
    const cosMax = Math.cos(SCOURGE_HALF_ARC);
    this.props.area(cx, cy, cz, w.range, this.tick, 'player', (q) => {
      const dx = q.x - cx, dy = q.y - cy, length = Math.hypot(dx, dy);
      return length < 1e-9 || (dx * ax + dy * ay) / length >= cosMax - 1e-9;
    });
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
      this.damageEnemy(s, w.damage, p.index, Infinity);
      if (this.eAlive[s]) this.slow(s, w.slow);
    }
  }

  /**
   * The Silver Bullet (M9 §2.4): 200 damage (M12 §5.6) carried through the line, nearest first. A rooted enemy
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
    this.globesOnRay(p, ex, ey, ez, dx, dy, dz, stop);
    this.propsOnRay(ex, ey, ez, dx, dy, dz, stop);
    // Its force is what the bullet still carried on reaching the enemy (M12 §4.1).
    for (const h of dealt.hits) this.damageEnemy(h.s, h.amount, p.index, h.carried);
    for (const o of souls) this.addRevive(o, reviveHit(w.interval, false), p);
    this.emit('all', { type: 'silverBullet', playerId: p.id, x: ex, y: ey, z: ez, ex: ex + dx * stop, ey: ey + dy * stop, ez: ez + dz * stop });
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

  /**
   * Adds revive progress to a soul, slowed for a player who died before; at 1 the player is revived.
   * `by` is the player who added it: everyone who did since the progress was last 0 gets a revive assist.
   */
  addRevive(p: SimPlayer, amount: number, by: SimPlayer | null = null): void {
    if (!this.hasSoul(p)) return;
    p.revive = Math.min(1, p.revive + amount / reviveSlowdown(p.deaths));
    if (by) p.revivers |= 1 << by.index;
    if (p.revive >= 1 - 1e-9) this.revivePlayer(p);
  }

  /** Revived on the soul's ground point with half HP, invulnerable for 2 s. */
  private revivePlayer(p: SimPlayer): void {
    for (const q of this.players) if (q !== p && p.revivers & (1 << q.index)) q.reviveAssists++;
    p.dead = false;
    p.revive = 0;
    p.revivers = 0;
    p.hp = p.maxHp * REVIVE_HP;
    p.shield = 0;
    p.lastDamageTick = this.tick;
    p.invulUntil = Math.max(p.invulUntil, this.tick + ticks(REVIVE_INVULNERABLE));
    this.invalidateFields();
    this.emit('all', { type: 'playerRevived', playerId: p.id });
    this.teleport(p, p.x, p.y, p.z);
  }

  /** Revive progress decays every tick, slowed like the progress, so every source takes the same times longer. */
  private updateSouls(): void {
    for (const p of this.players) {
      if (!this.hasSoul(p)) continue;
      p.revive = Math.max(0, p.revive - (REVIVE_DECAY * TICK_DT) / reviveSlowdown(p.deaths));
      if (p.revive === 0) p.revivers = 0;
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
    this.emit('all', { type: 'abilityUsed', playerId: p.id, slot, x, y, z, targets });
  }

  private useQ(p: SimPlayer): void {
    if (p.cdQ > 1e-6) return;
    const cd = ABILITIES[p.classId].Q.cooldown;
    const bx = p.x;
    const by = p.y;
    const bz = p.z + PLAYER_HEIGHT / 2;
    switch (p.classId) {
      case 'fallen': {
        // Blasphemy: every enemy within 12 m, including the Gatekeeper, targets the Fallen for 5 s, and
        // every one but the Gatekeeper is stunned for 1 s (M12 §5.3).
        for (let k = 0; k < this.activeCount; k++) {
          const s = this.active[k];
          const def = ENEMIES[this.eType[s]];
          if (distToCylinder(bx, by, bz, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) > BLASPHEMY_RADIUS) continue;
          this.eTauntUntil[s] = this.tick + ticks(BLASPHEMY_DURATION);
          this.eTarget[s] = p.index;
          this.stun(s, BLASPHEMY_STUN);
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
          if (distToCylinder(bx, by, bz, o.x, o.y, this.soulBase(o), SOUL_RADIUS, SOUL_HEIGHT) <= COMMUNION_RADIUS) this.addRevive(o, REVIVE_COMMUNION, p);
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
        // Field of Blood (M9 §3.4): 3 m ahead along the yaw; it always has a place. A new field
        // replaces the old one, and it lasts its 8 s whatever happens to the Betrayer.
        [this.fieldX, this.fieldY, this.fieldZ] = fieldCenter(this.map, p.x, p.y, p.yaw);
        this.fieldUntil = this.tick + ticks(FIELD_TIME);
        p.cdQ = cd;
        this.abilityEvent(p, 'Q', this.fieldX, this.fieldY, this.fieldZ);
        return;
      }
    }
    p.cdQ = cd;
    this.abilityEvent(p, 'Q', p.x, p.y, p.z);
  }

  private useE(p: SimPlayer, allyId: number): void {
    const def = ABILITIES[p.classId].E;
    if (def.movement) {
      // Movement abilities run on the client; the host accepts within 0.25 s of ready (§9.3). A
      // Shadowstep that isn't accepted cuts nothing (M12 §5.7).
      if (p.cdE > MOVEMENT_GRACE + 1e-6) {
        p.dash = null;
        return;
      }
      this.commanders.releasePlayer(p.id, false);
      if (p.classId === 'fallen') {
        // Falling Star (M12 §5.2): the leap goes wherever the Fallen aimed, so no ally is needed; it
        // lands 15 ticks later, invulnerable until then. `targets` is the ally it went to, if valid.
        const ally = allyId === ALLY_NONE ? undefined : this.playerById(allyId);
        const toAlly = !!ally && ally !== p && this.livingTargetable(ally);
        p.landingTick = this.tick + FALLING_STAR_LANDING_TICKS;
        p.invulUntil = Math.max(p.invulUntil, p.landingTick);
        p.cdE = def.cooldown;
        p.speedCheckSkipUntil = this.nowMs + MOVEMENT_SPEED_CHECK_SKIP * 1000;
        this.abilityEvent(p, 'E', p.x, p.y, p.z, toAlly ? [ally.id] : []);
      } else {
        p.invulUntil = Math.max(p.invulUntil, this.tick + ticks(SHADOWSTEP_INVULN));
        p.cdE = def.cooldown;
        p.speedCheckSkipUntil = this.nowMs + MOVEMENT_SPEED_CHECK_SKIP * 1000;
        if (p.dash) p.dash.acceptTick = this.tick;
        this.abilityEvent(p, 'E', p.x, p.y, p.z);
      }
      return;
    }
    if (p.cdE > 1e-6) return;
    if (p.classId === 'heretic') {
      // Martyr's Shroud: on the ally target sent with the press, or on self.
      const ally = allyId === ALLY_NONE ? undefined : this.playerById(allyId);
      const target = ally && ally !== p && this.livingTargetable(ally) ? ally : p;
      this.giveShield(target, SHROUD_AMOUNT, SHROUD_DURATION, p);
      p.cdE = def.cooldown;
      this.abilityEvent(p, 'E', target.x, target.y, target.z, [target.id]);
    } else if (p.classId === 'binder') {
      for (const s of this.discordTargets(p)) this.silence(s, DISCORD_SILENCE);
      p.cdE = def.cooldown;
      // At the Binder's feet; clients fan the shout out along its yaw.
      this.abilityEvent(p, 'E', p.x, p.y, p.z);
    }
  }

  /**
   * Falling Star landing (M12 §5.2), at the Fallen's latest accepted position on the floor under it, so
   * a late input caught mid-arc still puts the crater on the ground: 40 damage within 3.5 m (the crater,
   * whose kills always burst, §4.1) and 10 out to 6 m; then the survivors within 6 m are knocked back 4 m
   * over 0.4 s away from the landing point, except rooted ones (their piles hold). `starLanded` lists
   * the enemies launched.
   */
  private fallingStarLanding(p: SimPlayer): void {
    const cx = p.x;
    const cy = p.y;
    const g = groundHeight(this.map, cx, cy, PLAYER_RADIUS, Infinity, false, true);
    const floor = g === -Infinity ? p.z : g;
    const cz = floor + PLAYER_HEIGHT / 2;
    this.props.area(cx, cy, cz, FALLING_STAR_RADIUS, this.tick);
    const hit: Array<{ s: number; d: number }> = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      const def = ENEMIES[this.eType[s]];
      const d = distToCylinder(cx, cy, cz, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height);
      if (d <= FALLING_STAR_RADIUS) hit.push({ s, d });
    }
    const launched: number[] = [];
    for (const { s, d } of hit) {
      if (d <= FALLING_STAR_CRATER) this.damageEnemy(s, FALLING_STAR_DAMAGE, p.index, Infinity, cx, cy);
      else this.damageEnemy(s, FALLING_STAR_REACH_DAMAGE, p.index, FALLING_STAR_REACH_DAMAGE, cx, cy);
      if (!this.eAlive[s] || this.isRooted(s) || this.immune(s)) continue;
      this.knockAway(s, cx, cy, KNOCKBACK_DIST, FALLING_STAR_KNOCKBACK_TIME);
      this.commanders.cancel(s);
      this.dominions.cancel(s, this.tick); // Falling Star's accepted launch, even though its arc is drawn only.
      launched.push(s);
    }
    this.emit('all', { type: 'starLanded', playerId: p.id, x: cx, y: cy, z: floor, launched });
  }

  /**
   * Shadowstep's cut (M12 §5.7), each tick after `useE` while the window is open: every living enemy
   * whose cylinder is within 0.5 m of a new path segment (from the closest point of the segment, raised
   * to the body center) takes 40, once per dash, credited to the Betrayer and blasted along the segment.
   * A segment longer than 12 m is a teleport and cuts nothing. The window closes once an input with
   * `seq ≥ pressSeq + 9` was accepted, or 15 ticks after acceptance; then `dashCut` is sent.
   */
  private updateDash(p: SimPlayer): void {
    const dash = p.dash!;
    if (dash.acceptTick < 0) return;
    this.cutNewSegments(p, dash);
    if (dash.full || this.tick >= dash.acceptTick + DASH_WINDOW_TICKS) this.endDash(p);
  }

  private cutNewSegments(p: SimPlayer, dash: DashRecord): void {
    const q = dash.pts;
    const n = q.length / 3;
    for (let i = dash.done; i < n; i++) this.cutSegment(p, dash, q[i * 3 - 3], q[i * 3 - 2], q[i * 3 - 1], q[i * 3], q[i * 3 + 1], q[i * 3 + 2]);
    dash.done = n;
  }

  private cutSegment(p: SimPlayer, dash: DashRecord, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const len2 = dx * dx + dy * dy;
    if (len2 > DASH_MAX_SEGMENT * DASH_MAX_SEGMENT) return;
    const len = Math.sqrt(len2);
    const ux = len > 1e-9 ? dx / len : 0;
    const uy = len > 1e-9 ? dy / len : 0;
    for (const q of this.props.all) {
      if (q.broken) continue;
      const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((q.x - x0) * dx + (q.y - y0) * dy) / len2)) : 0;
      const x = x0 + dx * t, y = y0 + dy * t, z = z0 + (z1 - z0) * t + PLAYER_HEIGHT / 2;
      if (this.props.inArea(q, x, y, z, SHADOWSTEP_CUT_REACH)) this.props.break(q.id, this.tick);
    }
    const hit: number[] = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (dash.cut.has(s)) continue;
      const def = ENEMIES[this.eType[s]];
      const t = len2 > 1e-12 ? Math.max(0, Math.min(1, ((this.eX[s] - x0) * dx + (this.eY[s] - y0) * dy) / len2)) : 0;
      const cz = z0 + (z1 - z0) * t + PLAYER_HEIGHT / 2;
      if (distToCylinder(x0 + dx * t, y0 + dy * t, cz, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) <= SHADOWSTEP_CUT_REACH) hit.push(s);
    }
    // Applied after the scan: a kill removes the enemy from the active list. A burst flies along the
    // dash, from a point behind the enemy on the segment's direction (M12 §4.1).
    for (const s of hit) {
      dash.cut.add(s);
      this.damageEnemy(s, SHADOWSTEP_CUT_DAMAGE, p.index, SHADOWSTEP_CUT_DAMAGE, this.eX[s] - ux, this.eY[s] - uy, false, false);
    }
  }

  /** Closes a dash's window, cutting along what's left of its path; `dashCut` carries the path's ends. A press never accepted sends nothing. */
  private endDash(p: SimPlayer): void {
    const dash = p.dash;
    p.dash = null;
    if (!dash || dash.acceptTick < 0) return;
    this.cutNewSegments(p, dash);
    const q = dash.pts;
    const l = q.length - 3;
    this.emit('all', { type: 'dashCut', playerId: p.id, x0: q[0], y0: q[1], z0: q[2], x1: q[l], y1: q[l + 1], z1: q[l + 2] });
  }

  /**
   * Chains destination (§6.3): from the Binder's feet along the horizontal aim in 0.25 m steps, up to
   * 5 m; a step into a wall, a closed door or a floor more than 0.5 m above the previous one is blocked.
   */
  chainsDestination(p: SimPlayer): [number, number] {
    const [x, y] = walkDestination(this.map, p.x, p.y, p.yaw, CHAINS_MAX);
    return [x, y];
  }

  /**
   * Discord's shout (M12 follow-up §2.4): every living enemy, the Gatekeeper included, within 30 m of the
   * eye (to its cylinder), within 35° either side of the Binder's yaw horizontally (any height, so flyers
   * overhead too; one on the Binder's own axis counts), and in line of sight of its body center.
   */
  discordTargets(p: SimPlayer): number[] {
    const ex = p.x;
    const ey = p.y;
    const ez = p.z + PLAYER_EYE;
    const ax = Math.cos(p.yaw);
    const ay = Math.sin(p.yaw);
    const cosMax = Math.cos(DISCORD_HALF_ANGLE);
    const out: number[] = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      const def = ENEMIES[this.eType[s]];
      if (distToCylinder(ex, ey, ez, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) > DISCORD_RANGE) continue;
      const bx = this.eX[s] - ex;
      const by = this.eY[s] - ey;
      const len = Math.hypot(bx, by);
      if (len > 1e-9 && (bx * ax + by * ay) / len < cosMax - 1e-9) continue;
      if (!lineOfSight(this.map, ex, ey, ez, this.eX[s], this.eY[s], this.eZ[s] + def.height / 2)) continue;
      out.push(s);
    }
    return out;
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

  itemProjectileCapacity(replacingFlight = false): boolean {
    const flights = this.items.flights - (replacingFlight ? 1 : 0);
    return this.projectiles.length + flights < MAX_PROJECTILES && this.projectiles.filter(s => !this.pHostileBudget[s]).length + flights < MAX_PROJECTILES - 64;
  }

  spawnProjectile(kind: number, x: number, y: number, z: number, dx: number, dy: number, dz: number, speed: number, radius: number, damage: number, maxDist: number, owner: number): number {
    if (owner >= 0 && !this.itemProjectileCapacity()) return -1;
    if (this.projectiles.length + this.items.flights >= MAX_PROJECTILES) {
      // Only a hostile shot may replace the oldest projectile. Reserved item flights survive.
      const victim = this.projectiles.find(s => !this.pHostileBudget[s]) ?? this.projectiles[0];
      if (victim === undefined) return -1;
      this.removeProjectile(victim);
    }
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
    this.pReflected[slot] = 0; this.pHostileBudget[slot] = owner < 0 ? 1 : 0;
    this.pOrigin.set([x, y, z], slot * 3); this.pRoom[slot] = this.pickups.roomAt(x, y);
    this.projectiles.push(slot);
    return slot;
  }

  removeProjectile(slot: number): void {
    if (!this.pAlive[slot]) return;
    this.pAlive[slot] = 0;
    this.pReflectOwner.delete(slot);
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
    if (this.pReflected[slot]) { this.updateReflected(slot); return; }
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
      // A censer passing a globe shatters it and flies on (M12 follow-up §1.3).
      const shooter = this.slots[owner];
      const propHit = this.pDamage[slot] > 0 ? this.props.ray(x, y, z, dx, dy, dz, Math.min(len, terrainT, hitT, soulT), pr)[0] : undefined;
      if (shooter) this.globesOnRay(shooter, x, y, z, dx, dy, dz, Math.min(len, terrainT, hitT, soulT, propHit?.distance ?? Infinity));
      if (propHit) {
        this.props.break(propHit.prop.id, this.tick);
        this.explodeCenser(slot, x + dx * propHit.distance, y + dy * propHit.distance, z + dz * propHit.distance, -1);
        return;
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
      const reflection = this.items.reflection(x, y, z, dx, dy, dz, Math.min(len, terrainT, hitT));
      if (reflection) {
        const t = reflection.distance, rx = x + dx * t, ry = y + dy * t, rz = z + dz * t;
        let ax = this.pOrigin[slot * 3] - rx, ay = this.pOrigin[slot * 3 + 1] - ry, az = this.pOrigin[slot * 3 + 2] - rz;
        let length = Math.hypot(ax, ay, az); if (length < 1e-9) { ax = -dx; ay = -dy; az = -dz; length = 1; }
        this.pX[slot] = rx; this.pY[slot] = ry; this.pZ[slot] = rz; this.pTraveled[slot] += t;
        this.pDx[slot] = ax / length; this.pDy[slot] = ay / length; this.pDz[slot] = az / length;
        this.pReflected[slot] = 1; this.pRoom[slot] = reflection.area.room;
        const caster = this.playerById(reflection.area.owner);
        if (caster) { this.pOwner[slot] = caster.index; this.pReflectOwner.set(slot, caster); }
        this.itemEvent({ type: 'itemReflected', playerId: reflection.area.owner, projectile: slot, x: rx, y: ry, z: rz });
        this.updateReflected(slot, len - t); return;
      }
    }
    if (hitSlot >= 0) {
      if (owner >= 0) this.explodeCenser(slot, x + dx * hitT, y + dy * hitT, z + dz * hitT, hitSlot);
      else if (this.pKind[slot] === PROJ_GLOBE) this.shatterGlobe(slot, x + dx * hitT, y + dy * hitT, z + dz * hitT, this.slots[hitSlot]!);
      else {
        this.damagePlayer(this.slots[hitSlot]!, this.pDamage[slot]);
        this.removeProjectile(slot);
      }
      return;
    }
    if (terrainT < len) {
      if (owner >= 0) this.explodeCenser(slot, x + dx * terrainT, y + dy * terrainT, z + dz * terrainT, -1);
      else if (this.pKind[slot] === PROJ_GLOBE) this.shatterGlobe(slot, x + dx * terrainT, y + dy * terrainT, z + dz * terrainT, null);
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
      // Beyond an open edge a censer vanishes without breaking (M10 §3.4): its cloud would hurt nothing.
      if (owner >= 0 && !overVoid(this.map, nx, ny)) this.explodeCenser(slot, nx, ny, nz, -1);
      else if (owner < 0 && this.pKind[slot] === PROJ_GLOBE) this.shatterGlobe(slot, nx, ny, nz, null);
      else this.removeProjectile(slot);
      return;
    }
    if (nx < 0 || ny < 0 || nx >= this.map.w || ny >= this.map.h || nz > WALL_TOP) this.removeProjectile(slot);
  }

  private updateReflected(slot: number, distance = this.pSpeed[slot] * TICK_DT): void {
    const x = this.pX[slot], y = this.pY[slot], z = this.pZ[slot], dx = this.pDx[slot], dy = this.pDy[slot], dz = this.pDz[slot];
    const remaining = this.pMaxDist[slot] - this.pTraveled[slot], length = Math.min(distance, remaining);
    const stop = Math.min(raycastTerrain(this.map, x, y, z, dx, dy, dz, length), this.items.roomBound(x, y, dx, dy, length, this.pRoom[slot]));
    let victim = -1, hit = stop;
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k], d = ENEMIES[this.eType[s]], radius = this.pRadius[slot];
      const t = rayCylinder(x, y, z, dx, dy, dz, this.eX[s], this.eY[s], this.eZ[s] - radius, d.radius + radius, d.height + 2 * radius);
      if (t >= 0 && t <= hit) { hit = t; victim = s; }
    }
    const owner = this.pReflectOwner.get(slot);
    if (victim >= 0 && owner?.connected) this.damageEnemy(victim, this.pDamage[slot], owner.index, this.pDamage[slot], x, y, false, false);
    this.pX[slot] += dx * hit; this.pY[slot] += dy * hit; this.pZ[slot] += dz * hit; this.pTraveled[slot] += hit;
    if (victim >= 0 || stop < length || length >= remaining) this.removeProjectile(slot);
  }

  /**
   * A censer breaks (M9 §2.8): 40 damage to the enemy it hit (-1 for none), nothing to others, and an
   * incense cloud where it broke. Souls within 2.5 m count one hit each (M8 §4.2).
   */
  private explodeCenser(slot: number, x: number, y: number, z: number, direct: number): void {
    const owner = this.pOwner[slot];
    const damage = this.pDamage[slot];
    this.pX[slot] = x;
    this.pY[slot] = y;
    this.pZ[slot] = z;
    this.removeProjectile(slot);
    if (direct >= 0) this.damageEnemy(direct, damage, owner, damage, x, y);
    const shooter = this.slots[owner];
    if (!shooter) return;
    // At most 6 clouds: a new one replaces the oldest.
    if (this.clouds.length >= CLOUD_MAX) this.clouds.shift();
    this.clouds.push({ x, y, z, owner: shooter, from: this.tick, until: this.tick + ticks(CLOUD_TIME) });
    for (const o of this.players) {
      if (o === shooter || !this.hasSoul(o)) continue;
      if (distToCylinder(x, y, z, o.x, o.y, this.soulBase(o), SOUL_RADIUS, SOUL_HEIGHT) <= REVIVE_CENSER_RADIUS) {
        this.addRevive(o, reviveHit(WEAPONS[shooter.classId].interval, shooter.classId === 'heretic'), shooter);
      }
    }
  }

  /**
   * Incense clouds (M9 §2.8, M12 §5.4): each cloud pulses on the tick it appears and every 15 ticks
   * after, while before its end (8 pulses). A pulse deals 5 to each living enemy within 2.5 m that
   * incense hasn't hurt in the last 15 ticks, so clouds don't stack; the credit goes to the newest
   * pulsing cloud's Heretic (no one if it left).
   */
  private updateClouds(): void {
    while (this.clouds.length && this.tick >= this.clouds[0].until) this.clouds.shift();
    const pulsing = this.clouds.filter((c) => this.tick >= c.from && (this.tick - c.from) % CLOUD_PULSE_TICKS === 0);
    if (pulsing.length === 0) return;
    for (const c of pulsing) if (c.owner.connected) this.props.area(c.x, c.y, c.z, CLOUD_RADIUS, this.tick);
    const hits: Array<[number, number, number, number]> = [];
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (this.tick - this.eIncenseTick[s] < CLOUD_PULSE_TICKS) continue;
      const def = ENEMIES[this.eType[s]];
      // Newest first, so the credit goes to the newest cloud covering the enemy.
      for (let i = pulsing.length - 1; i >= 0; i--) {
        const c = pulsing[i];
        if (distToCylinder(c.x, c.y, c.z, this.eX[s], this.eY[s], this.eZ[s], def.radius, def.height) > CLOUD_RADIUS) continue;
        hits.push([s, c.owner.connected ? c.owner.index : -1, c.x, c.y]);
        this.eIncenseTick[s] = this.tick;
        break;
      }
    }
    // Applied after the scan: a kill removes the enemy from the active list.
    for (const [s, source, x, y] of hits) this.damageEnemy(s, CLOUD_DAMAGE, source, CLOUD_DAMAGE, x, y);
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
      if (f >= 0 && this.livingTargetable(this.slots[f]) && this.enemyMayTarget(slot, this.slots[f]!)) {
        this.eTarget[slot] = f;
        return;
      }
    }
    const air = ENEMIES[this.eType[slot]].flying;
    const c = Math.floor(this.eX[slot]);
    const r = Math.floor(this.eY[slot]);
    let best = -1;
    let bestD = Infinity;
    for (const p of this.players) {
      if (!this.livingTargetable(p) || !this.enemyMayTarget(slot, p) || !this.fieldValid[p.index]) continue;
      const avoids = !air && this.dryNavigation.room >= 0 && this.dryNavigation.room === this.roomAt(this.eX[slot], this.eY[slot]);
      const field = air ? this.airFields[p.index] : avoids ? this.dryNavigation.fields[p.index] : this.groundFields[p.index];
      if (!field || field.targetCell < 0) continue;
      const cell = r * this.map.w + c, anchor = avoids ? this.dryNavigation.project(cell) : cell;
      let d = anchor < 0 ? UNREACHABLE : field.at(anchor % this.map.w, Math.floor(anchor / this.map.w));
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
      if (this.eSpawnTick[slot] === tick) continue;
      const t = this.eTarget[slot];
      const targetGone = t >= 0 && (!this.livingTargetable(this.slots[t]) || !this.enemyMayTarget(slot, this.slots[t]!));
      if (targetGone || t < 0 || slot % RETARGET_TICKS === tick % RETARGET_TICKS) this.retarget(slot);
      const type = this.eType[slot];
      if (type === GATEKEEPER) {
        this.updateLos(slot);
        this.updateBoss(slot);
        continue;
      }
      const familyHolding = this.commanders.update(slot);
      if (familyHolding && type === CARRIER) continue;
      if (type === DOMINION && this.updateDominionFlight(slot)) continue;
      if (this.ePullStart[slot] >= 0) {
        this.updatePull(slot);
        continue;
      }
      if (type !== BLESSED) this.updateLos(slot);
      // Stunned (M12 §5.3): it moves with zero intent (gravity, hovering and knockback still apply),
      // doesn't strike or cast, and is idle.
      const stunned = this.isStunned(slot);
      if (tick > this.eKbFrom[slot] && tick <= this.eKbUntil[slot]) this.updateKnockback(slot);
      else if (ENEMIES[type].flying) this.updateCherub(slot, stunned);
      else this.updateWalker(slot, stunned, familyHolding);
      const thrown = tick <= this.eKbUntil[slot] && !this.eGrounded[slot];
      if (stunned || thrown) {
        this.eMeleeNext[slot] = -1;
        this.eCast[slot] = 0;
        this.eCastT[slot] = 0;
        if (this.eCastCd[slot] > 0) this.eCastCd[slot] = Math.max(0, this.eCastCd[slot] - TICK_DT);
        this.eState[slot] = thrown ? ST_FALLING : ST_IDLE;
      } else if (type === CANTOR && familyHolding) { const phase = this.commanders.active.get(slot)?.phase; this.eState[slot] = phase === 'tell' ? ST_WINDUP : ST_ATTACKING; }
      else if (type === BLESSED) this.updateMelee(slot);
      else if (type !== DOMINION && type !== CANTOR) this.updateCast(slot);
    }
    this.updateDominions();
  }

  private dominionInRange(slot: number): boolean {
    const p = this.slots[this.eTarget[slot]];
    const room = this.roomAt(this.eX[slot], this.eY[slot]);
    return room !== ROOM_NONE && this.livingTargetable(p) && this.roomAt(p!.x, p!.y) === room &&
      Math.hypot(p!.x - this.eX[slot], p!.y - this.eY[slot]) <= DOMINION_REACH && Math.abs(p!.z - this.eZ[slot]) <= DOMINION_HEIGHT_TOLERANCE &&
      lineOfSight(this.map, this.eX[slot], this.eY[slot], this.eyeZ(slot), p!.x, p!.y, p!.z + PLAYER_HEIGHT / 2);
  }

  private dominionLeapTarget(slot: number): DominionLeap | undefined {
    const room = this.roomAt(this.eX[slot], this.eY[slot]);
    const choices: DominionLeap[] = [];
    for (const p of this.players) {
      if (!this.livingTargetable(p) || this.roomAt(p.x, p.y) !== room) continue;
      const distance = Math.hypot(p.x - this.eX[slot], p.y - this.eY[slot]);
      if (distance < DOMINION_LEAP_MIN_RANGE || distance > DOMINION_LEAP_MAX_RANGE) continue;
      const recent = this.nowMs >= p.lastAcceptMs && this.nowMs - p.lastAcceptMs <= 250 && this.nowMs >= p.speedCheckSkipUntil && this.nowMs >= p.launchUntilMs;
      // Prefer a one-second lead; shorten it when geometry or leap reach makes it unsafe.
      for (const fraction of [1, 0.75, 0.5, 0.25, 0]) {
        const lead = recent ? DOMINION_LEAP_LEAD_SECONDS * fraction : 0;
        const x = p.x + p.moveVx * lead, y = p.y + p.moveVy * lead;
        const reach = Math.hypot(x - this.eX[slot], y - this.eY[slot]);
        if (reach < DOMINION_LEAP_MIN_RANGE || reach > DOMINION_LEAP_MAX_RANGE || this.roomAt(x, y) !== room) continue;
        const z = groundHeight(this.map, x, y, ENEMIES[DOMINION].radius, Infinity, false, true);
        if (!Number.isFinite(z)) continue;
        const leap: DominionLeap = { fromX: Math.fround(this.eX[slot]), fromY: Math.fround(this.eY[slot]), fromZ: Math.fround(this.eZ[slot]), x: Math.fround(x), y: Math.fround(y), z: Math.fround(z) };
        if (dominionLeapClear(this.map, room, leap)) { choices.push(leap); break; }
        if (!recent || p.moveVx === 0 && p.moveVy === 0) break;
      }
    }
    return choices.length ? choices[Math.floor(this.random() * choices.length)] : undefined;
  }

  private updateDominionFlight(slot: number): boolean {
    const cast = this.dominions.active.get(slot), leap = cast?.leap;
    if (!cast || !leap) return false;
    const flightStart = cast.startTick + DOMINION_LEAP_CHARGE_TICKS;
    if (this.isRooted(slot) || this.isStunned(slot) || this.tick < this.eSilenceUntil[slot] ||
      this.roomAt(this.eX[slot], this.eY[slot]) !== cast.room || this.tick < flightStart && !this.eGrounded[slot]) {
      this.dominions.cancel(slot, this.tick); return false;
    }
    if (this.tick < flightStart) { this.eState[slot] = ST_WINDUP; return true; }
    const duration = DOMINION_TELL_TICKS - DOMINION_LEAP_CHARGE_TICKS;
    const from = Math.max(0, (this.tick - 1 - flightStart) / duration), to = Math.min(1, (this.tick - flightStart) / duration);
    if (!dominionLeapClear(this.map, cast.room, leap, from, to)) { this.dominions.cancel(slot, this.tick); return false; }
    const [x, y, z] = dominionLeapPosition(leap, to);
    this.eVz[slot] = to < 1 ? (z - this.eZ[slot]) / TICK_DT : 0;
    this.eX[slot] = x; this.eY[slot] = y; this.eZ[slot] = to < 1 ? z : leap.z;
    this.eGrounded[slot] = to >= 1 ? 1 : 0; this.eState[slot] = ST_WINDUP;
    return true;
  }

  private updateDominions(): void {
    if (this.livingDominions === 0) return;
    // Resolve the bounded casters after ordinary movement; displacement can cancel other casts.
    const slots: number[] = [];
    for (let k = 0; k < this.activeCount; k++) if (this.eType[this.active[k]] === DOMINION) slots.push(this.active[k]);
    for (const s of slots) {
      if (!this.eAlive[s] || this.eSpawnTick[s] === this.tick) continue; // A prior slam may trigger an owned Shroud burst that kills this caster.
      const ownFlight = this.dominions.active.get(s)?.leap !== undefined;
      const leap = this.tick % 15 === s % 15 && !this.dominions.holding(s, this.tick) && this.tick >= this.dominions.readyAt[s] && this.tick >= this.dominions.leapReadyAt[s] && !this.isRooted(s) && !this.isStunned(s) && this.tick >= this.eSilenceUntil[s] && this.eGrounded[s] ? this.dominionLeapTarget(s) : undefined;
      this.dominions.update(s, this.tick, { incarnation: this.eIncarnation[s], room: this.roomAt(this.eX[s], this.eY[s]),
        grounded: this.eGrounded[s] === 1 || ownFlight, stunned: this.isStunned(s), silenced: this.tick < this.eSilenceUntil[s], inRange: this.dominionInRange(s), leap });
      if (!this.eAlive[s]) continue;
      if (this.dominions.holding(s, this.tick)) {
        this.eMeleeNext[s] = -1;
        this.eState[s] = this.dominions.active.has(s) ? ST_WINDUP : ST_ATTACKING;
      } else if (!this.isStunned(s) && this.eGrounded[s]) this.updateMelee(s);
      else this.eMeleeNext[s] = -1;
    }
  }

  private dominionPhase(phase: DominionPhase, cast: DominionCast): void {
    const s = cast.slot, x = cast.leap?.x ?? this.eX[s], y = cast.leap?.y ?? this.eY[s], z = cast.leap?.z ?? this.eZ[s];
    this.emit('all', { type: 'dominionCast', phase, cast: { ...cast }, x, y, z });
    if (phase !== 'strike') return;
    const eligible = (vx: number, vy: number, vz: number, height: number) => this.roomAt(vx, vy) === cast.room &&
      Math.hypot(vx - x, vy - y) <= DOMINION_RADIUS + 1e-9 && Math.abs(vz - z) <= DOMINION_HEIGHT_TOLERANCE + 1e-9 &&
      lineOfSight(this.map, x, y, z + ENEMIES[DOMINION].height / 2, vx, vy, vz + height / 2);
    const victims: number[] = [];
    for (let k = 0; k < this.activeCount; k++) {
      const q = this.active[k], type = this.eType[q], def = ENEMIES[type];
      if (q === s || type === GATEKEEPER || !this.eGrounded[q]) continue;
      if (def.flying && Math.abs(this.eZ[q] - groundHeight(this.map, this.eX[q], this.eY[q], def.radius, Infinity, false, true)) > 0.05) continue;
      if (eligible(this.eX[q], this.eY[q], this.eZ[q], def.height)) victims.push(q);
    }
    for (const q of victims) {
      const distance = Math.hypot(this.eX[q] - x, this.eY[q] - y);
      // A world hit: no player credit, but a kill still pays its coins (game.md §6.1).
      this.damageEnemy(q, Math.round(dominionFalloff(DOMINION_ENEMY_DAMAGE, distance)), -1, undefined, x, y, true);
      if (!this.eAlive[q]) continue;
      this.dominions.cancel(q, this.tick);
      this.commanders.cancel(q);
      this.ePullStart[q] = -1;
      this.knockAway(q, x, y, dominionFalloff(DOMINION_LAUNCH_SPEED, distance) * DOMINION_LAUNCH_SECONDS, DOMINION_LAUNCH_SECONDS);
      this.eVz[q] = DOMINION_LAUNCH_VZ; this.eGrounded[q] = 0;
      this.eMeleeNext[q] = -1; this.eCast[q] = 0; this.eCastT[q] = 0;
    }
    for (const p of this.players) if (this.livingTargetable(p) && eligible(p.x, p.y, p.z, PLAYER_HEIGHT)) {
      const immune = this.isInvulnerable(p);
      const dx = p.x - x, dy = p.y - y, distance = Math.hypot(dx, dy);
      this.damagePlayer(p, Math.round(dominionFalloff(DOMINION_PLAYER_DAMAGE, distance)));
      if (immune || p.dead) continue;
      // Reuse the acknowledged host correction: stale pre-impact positions cannot undo the launch.
      const speed = dominionFalloff(DOMINION_LAUNCH_SPEED, distance);
      const launch = distance > 1e-9 ? { dx: dx / distance * speed, dy: dy / distance * speed } : { dx: Math.cos(p.yaw) * speed, dy: Math.sin(p.yaw) * speed };
      p.dash = null; p.landingTick = -1;
      this.teleport(p, p.x, p.y, p.z, launch);
    }
  }

  private updatePull(slot: number): void {
    const o = slot * 6;
    const f = Math.min(1, (this.tick - this.ePullStart[slot]) / ticks(CHAINS_PULL_TIME));
    const p = this.ePull;
    const b = this.loadBody(slot);
    b.x = p[o] + (p[o + 3] - p[o]) * f;
    b.y = p[o + 1] + (p[o + 4] - p[o + 1]) * f;
    b.z = p[o + 2] + (p[o + 5] - p[o + 2]) * f;
    this.storeBody(slot, b);
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
      const ai = this.eRoom[slot];
      const counts = [scaleCount(SUMMON.blessed, this.bossParty), 0, scaleCount(SUMMON.cherubs, this.bossParty)];
      if (ai >= 0) this.rooms[ai].queue.push({ counts, spawned: [0, 0, 0], wave: -1 });
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
      this.emit('all', { type: 'bossCast', phase: 'start' });
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
      this.spawnProjectile(PROJ_GLOBE, ox, oy, oz, rx / len, ry / len, dz / len, VOLLEY_ORB.speed, VOLLEY_ORB.radius, VOLLEY_ORB.damage, PROJECTILE_RANGE, -1);
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
    this.emit('all', { type: 'bossCast', phase: 'completed' });
    for (const p of this.players) {
      if (!this.livingTargetable(p)) continue;
      if (lineOfSight(this.map, p.x, p.y, p.z + PLAYER_EYE, bx, by, bz)) this.damagePlayer(p, p.maxHp);
    }
  }

  /** Discord or 1 300 damage (scaled, M9 §4) interrupts Judgment; the next one is due 25 s later. */
  private interruptJudgment(): void {
    if (this.bossCast !== BOSS_CAST_JUDGMENT) return;
    this.bossCast = BOSS_CAST_NONE;
    this.judgmentDue = this.tick + ticks(JUDGMENT_INTERVAL);
    this.emit('all', { type: 'bossCast', phase: 'interrupted' });
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
    return this.tick < this.eSlowUntil[slot] || this.items.slowed[slot] ? s * SLOW_FACTOR : s;
  }

  private updateKnockback(slot: number): void {
    const b = this.loadBody(slot);
    const dx = this.eKbVx[slot] * TICK_DT;
    const dy = this.eKbVy[slot] * TICK_DT;
    if (b.flying && b.vz === 0) moveHorizontal(this.map, b, dx, dy);
    else { b.flying = false; stepBody(this.map, b, dx, dy, TICK_DT); }
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
    if (this.leashed[slot]) this.clampLeash(slot, b);
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
    const projected = !!field.excluded && field.targetCell !== Math.floor(p.y) * this.map.w + Math.floor(p.x);
    const tc = projected ? field.targetCell % this.map.w : Math.floor(p.x);
    const tr = projected ? Math.floor(field.targetCell / this.map.w) : Math.floor(p.y);
    let gx: number;
    let gy: number;
    if (Math.abs(c - tc) <= 1 && Math.abs(r - tr) <= 1 && directStepAllowed(field, c, r, tc, tr)) {
      gx = projected ? tc + 0.5 : p.x;
      gy = projected ? tr + 0.5 : p.y;
      out.direct = true;
      this.eWaypoint[slot] = -1;
    } else {
      let n = this.eWaypoint[slot];
      const distance = n < 0 ? Infinity : Math.hypot(n % this.map.w + 0.5 - x, Math.floor(n / this.map.w) + 0.5 - y);
      // Finish the cell-centre waypoint before replanning at a diagonal's intermediate cell.
      if (n < 0 || this.eWaypointGoal[slot] !== field.targetCell || field.dist[n] === UNREACHABLE || distance < 0.12 || distance > 2 ||
        !directStepAllowed(field, c, r, n % this.map.w, Math.floor(n / this.map.w))) {
        n = field.bestNeighbor(c, r);
        this.eWaypoint[slot] = n; this.eWaypointGoal[slot] = field.targetCell;
      }
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

  /** Blessed and Choristers: follow the ground field; Choristers stop to cast in range. A stunned one doesn't steer. */
  private updateWalker(slot: number, stunned: boolean, familyHolding = false): void {
    const type = this.eType[slot];
    const b = this.loadBody(slot);
    const t = this.eTarget[slot];
    let mx = 0;
    let my = 0;
    const rooted = this.tick < this.eRootUntil[slot];
    const holds = familyHolding || (type === DOMINION ? this.dominions.holding(slot, this.tick) : type === CHORISTER && (this.eCast[slot] === 1 || this.casterInRange(slot)));
    const p = t >= 0 ? this.slots[t] : undefined;
    const avoids = this.dryNavigation.room >= 0 && this.dryNavigation.room === this.roomAt(b.x, b.y);
    const cell = avoids ? this.hazards.cell(b.x, b.y) : -1, inFire = avoids && !!this.hazards.active[cell];
    if ((p || inFire) && !rooted && (!holds || inFire) && !stunned) {
      const s = this.steerOut;
      const field = avoids ? this.dryNavigation.fields[t] : this.groundFields[t];
      let steered = false;
      if (inFire) {
        const next = this.dryNavigation.escapeStep(cell);
        if (next >= 0) {
          const dx = next % this.map.w + 0.5 - b.x, dy = Math.floor(next / this.map.w) + 0.5 - b.y, d = Math.hypot(dx, dy);
          if (d > 1e-9) { s.dx = dx / d; s.dy = dy / d; s.dist = d; s.direct = false; steered = true; }
        }
      } else if (p && field && (!avoids || field.targetCell >= 0)) steered = this.steer(slot, field, p, s);
      if (steered) {
        let step = this.speedOf(slot) * TICK_DT;
        if (s.direct && type === BLESSED) step = Math.min(step, s.dist - BLESSED_STOP);
        else step = Math.min(step, s.dist);
        if (step > 0) {
          mx = s.dx * step;
          my = s.dy * step;
          // Only ordinary steering refuses fire. Accepted knockbacks, pulls and separation keep their existing paths.
          if (avoids && !inFire && this.hazards.active[this.hazards.cell(b.x + mx, b.y + my)]) mx = my = 0;
        }
      }
    }
    stepBody(this.map, b, mx, my, TICK_DT);
    this.storeBody(slot, b);
    this.eState[slot] = !b.grounded ? ST_FALLING : mx !== 0 || my !== 0 ? ST_MOVING : ST_IDLE;
  }

  private updateCherub(slot: number, stunned: boolean): void {
    const b = this.loadBody(slot);
    b.vz = 0; b.grounded = true; // Resume ordinary hovering after an accepted physical launch.
    const t = this.eTarget[slot];
    let mx = 0;
    let my = 0;
    let strafing = false;
    const rooted = this.tick < this.eRootUntil[slot];
    const p = t >= 0 ? this.slots[t] : undefined;
    if (p && !rooted && !stunned) {
      // A Carrier must approach inside its 20 m acquisition range. Strafing at the Cherub's
      // 25 m arrow range otherwise leaves it circling forever without a chance to carry.
      const carryApproach = this.eType[slot] === CARRIER && (Math.hypot(p.x - b.x, p.y - b.y) > 20 ||
        !carryPathClear(this.map, this.eRoom[slot], b.x, b.y, b.z, b.x, b.y, b.z));
      if (this.casterInRange(slot) && !carryApproach) {
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
   * on the 8th tick in range (0.267 s, M12 §3.2), then every 1 s. Leaving range resets the timer.
   */
  private updateMelee(slot: number): void {
    const dominion = this.eType[slot] === DOMINION;
    const t = this.eTarget[slot];
    let inRange = false;
    const p = t >= 0 ? this.slots[t] : undefined;
    if (p) {
      inRange = Math.hypot(p.x - this.eX[slot], p.y - this.eY[slot]) <= (dominion ? DOMINION_MELEE_RANGE : MELEE_RANGE) && Math.abs(p.z - this.eZ[slot]) < MELEE_HEIGHT &&
        (!dominion || lineOfSight(this.map, this.eX[slot], this.eY[slot], this.eyeZ(slot), p.x, p.y, p.z + PLAYER_HEIGHT / 2));
    }
    if (!inRange) {
      this.eMeleeNext[slot] = -1;
      return;
    }
    if (this.eMeleeNext[slot] < 0) this.eMeleeNext[slot] = MELEE_FIRST;
    this.eMeleeNext[slot] -= TICK_DT;
    if (this.eMeleeNext[slot] <= 1e-9) {
      this.damagePlayer(p!, dominion ? DOMINION_MELEE_DAMAGE : MELEE_DAMAGE);
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
    const oz = this.eZ[slot] + (c.castZ ?? def.height / 2);
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

  /** Candidate cells along the beam, padded for bodies/separation displacement. */
  commanderBeamCandidates(b: ReturnType<typeof beamSegment>): number[] {
    const cells = new Set<number>(), found = new Set<number>(), { w, h } = this.map;
    for (let t = 0; t <= b.length + 0.5; t += 0.5) {
      const x = b.x + b.dx * Math.min(t, b.length), y = b.y + b.dy * Math.min(t, b.length);
      for (let r = Math.max(0, Math.floor(y - 1.5)); r <= Math.min(h - 1, Math.floor(y + 1.5)); r++)
        for (let c = Math.max(0, Math.floor(x - 1.5)); c <= Math.min(w - 1, Math.floor(x + 1.5)); c++) cells.add(r * w + c);
    }
    for (const cell of cells) for (const layer of [0, 1] as const) for (let i = this.hashStart[layer][cell]; i < this.hashStart[layer][cell + 1]; i++) found.add(this.hashItems[layer][i]);
    return [...found];
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
      return t !== GATEKEEPER && ENEMIES[t].flying === (layer === 1);
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
    if (n === 0) return;
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
      if (!isLayer(s) || this.ePullStart[s] >= 0 || this.dominions.active.get(s)?.leap || this.commanders.active.get(s)?.phase === 'carry' || this.commanders.active.get(s)?.phase === 'active') continue;
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
      if (tryDisplace(this.map, b, px, py)) this.storeBody(s, b);
    }
  }

  // ------------------------------------------------------------------ snapshots

  /** Living enemies in the active room plus its enemies not yet spawned (§8.2). */
  enemiesRemaining(): number {
    const ai = this.activeRoom;
    const st = this.rooms[ai];
    if (!st) return 0;
    if (this.map.rooms[ai].boss) return st.alive;
    let n = st.alive;
    for (const q of st.queue) for (let t = 0; t < q.counts.length; t++) n += q.counts[t] - q.spawned[t];
    n += st.squad?.left ?? 0;
    const waves = this.map.rooms[ai].waves;
    if (!this.noWaves && this.benchRoom < 0) {
      for (let i = st.wave + 1; i < waves.length; i++) n += waveSize(waves[i], st.partySize);
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
    e.dominionCasts = this.dominions.checkpoint();
    e.commanderCasts = this.commanders.checkpoint();
    const tick = this.tick;
    e.enemyCount = this.activeCount;
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      e.enemySlot[k] = s;
      e.enemyX[k] = this.eX[s];
      e.enemyY[k] = this.eY[s];
      e.enemyZ[k] = this.eZ[s];
      e.enemyIncarnation[k] = this.eIncarnation[s];
      e.enemyTypeState[k] = (this.eType[s] & 0x0f) | (this.eState[s] << 4);
      let f = 0;
      if (this.isRooted(s)) f |= FLAG_ROOTED;
      if (tick < this.eSilenceUntil[s]) f |= FLAG_SILENCED;
      if (tick < this.eSlowUntil[s] || this.items.slowed[s]) f |= FLAG_SLOWED;
      if (tick < this.eTauntUntil[s]) f |= FLAG_TAUNTED;
      if (tick < this.eStunUntil[s]) f |= FLAG_STUNNED;
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
    e.pickupCount = this.pickups.live.length;
    this.pickups.live.forEach((p, i) => {
      e.pickupId[i] = p.id; e.pickupX[i] = p.x; e.pickupY[i] = p.y; e.pickupKind[i] = p.kind;
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
    const header: SnapshotHeader = {
      runId: this.runId,
      stateRevision: this.stateRevision,
      tick: this.tick,
      activeRoom: this.activeRoom,
      activePhase: this.activePhase,
      clearedMask: this.clearedMask(),
      countdown: Math.ceil(this.countdownLeft() * 10 - 1e-6),
      hold: this.countdownHold(),
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
        wallet: p.wallet,
        carrySlot: this.commanders.carriedBy(p.id)?.slot ?? -1, teleportId: p.teleportId,
      });
    }
    return encodeSnapshot(header, players, e);
  }
}

export { PHASE_CLEARED, PHASE_COMBAT, PHASE_IDLE };
