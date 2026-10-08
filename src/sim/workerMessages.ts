/** Internal messages between the main thread and the simulation worker (not part of §9.2). */
import type { CtrlMessage } from '../net/messages';
import type { DirectorInfo } from './director';
import type { Simulation, SimPlayerInit } from './sim';

export type MainToWorker =
  /** Singleplayer (and dev and bench modes): starts the game at once. */
  | {
      t: 'start';
      dungeonId: string;
      players: SimPlayerInit[];
      seed: number;
      god: boolean;
      /** The benchmark's arena, or -1 when not benchmarking (M10 gate §4). */
      benchArena: number;
      singleplayer: boolean;
      localPlayerId: number;
    }
  /** Multiplayer: the host clicked `Create`; the worker opens the lobby with the host as player 0. */
  | { t: 'host'; dungeonId: string; password: string; name: string; god: boolean }
  /** The host clicked `Start` in the Lobby. */
  | { t: 'startGame' }
  /** A `ctrl` message from the host's own player, through `LocalTransport`. */
  | { t: 'ctrl'; playerId: number; msg: CtrlMessage }
  /** A `ctrl` message from a remote client's connection. */
  | { t: 'connCtrl'; conn: number; msg: CtrlMessage }
  /** A remote client's connection closed or timed out. */
  | { t: 'connClosed'; conn: number }
  | { t: 'input'; playerId: number; buf: ArrayBuffer }
  | { t: 'pause'; paused: boolean }
  | { t: 'killAll' }
  | { t: 'toggleGod'; playerId: number }
  | { t: 'stop' };

export type WorkerToMain =
  /**
   * All parts of one tick's snapshot for one player, and that tick's simulation time. The local
   * player's also carry the director's state (M12 §2.3), null when no combat arena is in combat.
   */
  | { t: 'snap'; to: number; bufs: ArrayBuffer[]; simMs: number; director?: DirectorInfo | null }
  | { t: 'ctrl'; to: number | 'all'; msg: CtrlMessage }
  /** A `ctrl` message to a connection that has no player (the `reject` of a `hello`). */
  | { t: 'connCtrl'; conn: number; msg: CtrlMessage }
  /** A connection's `hello` was accepted: it is this player from now on. Sent before `welcome`. */
  | { t: 'bind'; conn: number; playerId: number }
  /** Close this connection once its last messages are out (after `reject`, or a player who left). */
  | { t: 'drop'; conn: number }
  /**
   * Every 1 s while hosting: send `ping` to every client and check the heartbeat timeouts (§9.1),
   * except for `loading`, the players still loading during Loading.
   */
  | { t: 'heartbeat'; loading: number[] };

/** The `snap` message for the host's own player: it also carries the director's state (M12 §2.3). */
export function localSnap(sim: Pick<Simulation, 'directorInfo'>, to: number, bufs: ArrayBuffer[], simMs: number): WorkerToMain {
  return { t: 'snap', to, bufs, simMs, director: sim.directorInfo() };
}
