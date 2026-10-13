import type { CommanderCast } from '../data/commanders';
/** `ctrl` messages and game events (§9.2). */
import type { ClassId } from '../data/classes';
import type { PickupRecord } from '../data/pickups';
import type { PropFamily } from '../data/rooms/types';
import type { DominionCast, DominionPhase } from '../data/dominion';
import type { SpawnWarning } from '../data/spawns';
import type { RunIdentity } from './version';
import type { Profile } from '../profile/model';
import type { Admission, ProgressState } from '../profile/lifecycle';
import type { Inventory } from '../data/items';
import type { ItemId } from '../data/items';
import type { ItemEffect } from '../sim/consumables';
import type { VictoryState } from '../sim/victory';

/** The host's choice, carried by both welcome and lobby. Fixed maps are development fixtures. */
export interface LobbyState {
  heaven: 1;
  fixture: string | null;
  players: LobbyPlayer[];
}

/** One R1 run: no progression or Edicts yet (rogue r01.md, R1.3). */
export interface RunConfig extends RunIdentity {
  heaven: 1;
  floor: 1;
  edicts: 0;
  progressionEnabled: boolean;
  fixture: string | null;
}

/** Shared room checkpoint, sent after go and before live events (rogue r01.md, R1.5). */
export interface RoomSync {
  phase: number;
  knowledge: number;
  entrySocket: number;
  refills: number;
}
export interface FloorSync {
  victory?: VictoryState | null;
  itemEffects?: ItemEffect[];
  progressionEnabled?: boolean;
  inventories?: InventoryState[];
  type: 'floorSync';
  runId: string;
  tick: number;
  revision: number;
  rooms: RoomSync[];
  pickups?: PickupRecord[];
  brokenProps?: number[];
  propBlasts?: Array<{ id: number; impactTick: number }>;
  propRecharges?: Array<{ id: number; readyTick: number }>;
  dominionCasts?: DominionCast[];
  commanderCasts?: CommanderCast[];
  spawnWarnings?: SpawnWarning[];
}

export interface InventoryState {
  playerId: number; inventory: Inventory; wallet: number; sold: number; chart: boolean;
  nextRequestId: number; itemReadyTick: number; xp: number; runXp: number;
  featherUntil: number; sealUntil: number; itemsTried: ItemId[];
}

export type GameEvent =
  | { type: 'victoryState'; state: VictoryState }
  | { type: 'itemUsed'; actionId: number; playerId: number; item: ItemId; first: boolean; instance: ItemEffect | null; x: number; y: number; z: number }
  | { type: 'itemEffectActivated'; effect: ItemEffect }
  | { type: 'itemEffectEnded'; instanceId: number; reason: string }
  | { type: 'itemReflected'; playerId: number; projectile: number; x: number; y: number; z: number }
  | { type: 'inventory'; state: InventoryState }
  | { type: 'interactionResult'; requestId: number; accepted: boolean; reason: string }
  | { type: 'spawnWarning'; phase: 'start' | 'cancel'; warning: SpawnWarning }
  | { type: 'crest'; room: number; wave: number; total: number }
  | { type: 'dominionCast'; phase: DominionPhase; cast: DominionCast; x: number; y: number; z: number }
  | { type: 'propBroken'; id: number; family: PropFamily; x: number; y: number; z: number; marked: boolean; impactTick: number; readyTick: number; targets: number[] }
  | { type: 'propReady'; id: number; x: number; y: number; z: number }
  | { type: 'propBlast'; id: number; x: number; y: number; z: number }
  | { type: 'pickupState'; pickup: PickupRecord }
  | { type: 'pickupCollected'; id: number; kind: number; playerId: number; x: number; y: number; z: number }
  /**
   * `targets`: the player IDs the ability affected (M8 §10): every player Communion healed, including
   * at full HP; the player Martyr's Shroud shielded; the Falling Star ally. Empty for the others.
   */
  | { type: 'abilityUsed'; playerId: number; slot: 'Q' | 'E'; x: number; y: number; z: number; targets: number[] }
  | { type: 'teleport'; teleportId: number; x: number; y: number; z: number; launch?: { dx: number; dy: number }; carry?: boolean }
  | { type: 'playerDied'; playerId: number }
  | { type: 'playerRespawned'; playerId: number }
  /** Revived by the party at the soul's ground point (M8 §4.2). */
  | { type: 'playerRevived'; playerId: number }
  /** A Silver Bullet (M9 §2.4): from the eye to where the ray stopped. */
  | { type: 'silverBullet'; playerId: number; x: number; y: number; z: number; ex: number; ey: number; ez: number }
  /** Falling Star landed (M9 §3.2): the enemy slots it knocked back, which fly an arc on every client. */
  | { type: 'starLanded'; playerId: number; x: number; y: number; z: number; launched: number[] }
  /** Martyr's Shroud burst (M9 §3.3), where the shielded player stood. */
  | { type: 'shroudBurst'; playerId: number; x: number; y: number; z: number }
  /** Burst deaths this tick (M12 §4.1): `[slot, angle, playerId, …]`, the angle in degrees, + 360 if heavy. */
  | { type: 'bursts'; list: number[] }
  /** Shadowstep cut through its path (M12 §5.7): the path's first and last points. */
  | { type: 'dashCut'; playerId: number; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
  /** A globe shattered (M12 follow-up §1.3): `by` is the player who shot it down, or −1 when it broke on its own. */
  | { type: 'globeShatter'; x: number; y: number; z: number; by: number }
  | { type: 'roomState'; room: number; phase: number; knowledge: number; entrySocket: number }
  | { type: 'bossCast'; phase: 'start' | 'interrupted' | 'completed' }
  /** `stats`: the players still connected at the end, by ID. */
  | { type: 'gameOver'; result: 'victory' | 'defeat'; timeMs: number; unclaimed?: boolean; stats: Record<number, PlayerStats> };

/** One player's numbers on Results. */
export interface PlayerStats {
  runXp?: number; levelBefore?: number; levelAfter?: number;
  kills: number;
  /** Damage dealt to enemies, rounded. */
  damage: number;
  deaths: number;
  /** Revives the player helped with. */
  reviveAssists: number;
}

export interface LobbyPlayer {
  id: number;
  name: string;
  classId: ClassId | null;
  bot?: boolean;
  isHost: boolean;
  /** Still on Results after a game; the host's `Start` waits for them. */
  inResults: boolean;
}

export type RejectReason = 'bad_password' | 'full' | 'in_progress' | 'version' | 'load_timeout';

export type CtrlMessage =
  | { type: 'interact'; runId: string; requestId: number; sourceId: number }
  | FloorSync
  | { type: 'hello'; name: string; password: string; version: string; bot: boolean; profile?: Profile }
  | { type: 'loadout'; profile: Profile }
  | { type: 'admission'; admission: Admission }
  | { type: 'admissionReady'; runId: string; admissionId: number }
  | { type: 'admissionRejected'; runId: string; admissionId: number; reason: string }
  | { type: 'progress'; state: ProgressState }
  | { type: 'recover'; runId: string; profileId: string }
  | { type: 'recovery'; runId: string; state: ProgressState | null }
  /** `inProgress`: the game is running, so the client waits in the in-progress Lobby (M8 §6.2). */
  | { type: 'welcome'; playerId: number; lobby: LobbyState; inProgress: boolean }
  | { type: 'reject'; reason: RejectReason }
  | { type: 'pickClass'; classId: ClassId }
  /** Sent on every change, during the game too (M8 §6.2). */
  | ({ type: 'lobby' } & LobbyState)
  | ({ type: 'start'; players: Array<{ id: number; name: string; classId: ClassId; bot: boolean }> } & RunConfig)
  | { type: 'ready' }
  /** From the in-progress Lobby: the client enters the game (M8 §6.2). */
  | { type: 'enterGame' }
  /** From Results: the player is back in the Lobby. */
  | { type: 'backToLobby' }
  /** C→H with `text` only; H→all with the sender's `playerId` too (M8 §7). */
  | { type: 'chat'; text: string; playerId?: number }
  | { type: 'go' }
  | { type: 'event'; runId: string; tick: number; revision: number; event: GameEvent }
  | { type: 'ping' }
  | { type: 'leave' };
