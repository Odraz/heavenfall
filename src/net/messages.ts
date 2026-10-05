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
  | { type: 'arenaStarted'; arenaIndex: number }
  | { type: 'arenaCleared'; arenaIndex: number }
  | { type: 'bossCast'; phase: 'start' | 'interrupted' | 'completed' }
  | { type: 'gameOver'; result: 'victory' | 'defeat'; timeMs: number; kills: Record<number, number> };

export interface LobbyPlayer {
  id: number;
  name: string;
  classId: ClassId | null;
  isHost: boolean;
}

export type RejectReason = 'bad_password' | 'full' | 'in_progress' | 'version' | 'load_timeout';

export type CtrlMessage =
  | { type: 'hello'; name: string; password: string; version: string }
  | { type: 'welcome'; playerId: number; lobby: { dungeonId: string; players: LobbyPlayer[] } }
  | { type: 'reject'; reason: RejectReason }
  | { type: 'pickClass'; classId: ClassId }
  | { type: 'lobby'; dungeonId: string; players: LobbyPlayer[] }
  | { type: 'start'; dungeonId: string; players: Array<{ id: number; name: string; classId: ClassId }> }
  | { type: 'ready' }
  | { type: 'go' }
  | { type: 'event'; event: GameEvent }
  | { type: 'ping' }
  | { type: 'leave' };
