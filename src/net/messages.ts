/** `ctrl` messages and game events (§9.2). */
import type { ClassId } from '../data/classes';

export type GameEvent =
  /**
   * `targets`: the player IDs the ability affected (M8 §10): every player Communion healed, including
   * at full HP; the player Martyr's Shroud shielded; the Falling Star ally. Empty for the others.
   */
  | { type: 'abilityUsed'; playerId: number; slot: 'Q' | 'E'; x: number; y: number; z: number; targets: number[] }
  | { type: 'teleport'; teleportId: number; x: number; y: number; z: number }
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
  | { type: 'arenaStarted'; arenaIndex: number }
  | { type: 'arenaCleared'; arenaIndex: number }
  | { type: 'bossCast'; phase: 'start' | 'interrupted' | 'completed' }
  /** `stats`: the players still connected at the end, by ID. */
  | { type: 'gameOver'; result: 'victory' | 'defeat'; timeMs: number; stats: Record<number, PlayerStats> };

/** One player's numbers on Results. */
export interface PlayerStats {
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
  isHost: boolean;
  /** Still on Results after a game; the host's `Start` waits for them. */
  inResults: boolean;
}

export type RejectReason = 'bad_password' | 'full' | 'in_progress' | 'version' | 'load_timeout';

export type CtrlMessage =
  | { type: 'hello'; name: string; password: string; version: string }
  /** `inProgress`: the game is running, so the client waits in the in-progress Lobby (M8 §6.2). */
  | { type: 'welcome'; playerId: number; lobby: { dungeonId: string; players: LobbyPlayer[] }; inProgress: boolean }
  | { type: 'reject'; reason: RejectReason }
  | { type: 'pickClass'; classId: ClassId }
  /** Sent on every change, during the game too (M8 §6.2). */
  | { type: 'lobby'; dungeonId: string; players: LobbyPlayer[] }
  | { type: 'start'; dungeonId: string; players: Array<{ id: number; name: string; classId: ClassId }> }
  | { type: 'ready' }
  /** From the in-progress Lobby: the client enters the game (M8 §6.2). */
  | { type: 'enterGame' }
  /** From Results: the player is back in the Lobby. */
  | { type: 'backToLobby' }
  /** C→H with `text` only; H→all with the sender's `playerId` too (M8 §7). */
  | { type: 'chat'; text: string; playerId?: number }
  | { type: 'go' }
  | { type: 'event'; event: GameEvent }
  | { type: 'ping' }
  | { type: 'leave' };
