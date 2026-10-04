/** Internal messages between the main thread and the simulation worker (not part of §9.2). */
import type { CtrlMessage } from '../net/messages';
import type { SimPlayerInit } from './sim';

export type MainToWorker =
  /** Singleplayer (and dev and bench modes): starts the game at once. */
  | {
      t: 'start';
      dungeonId: string;
      players: SimPlayerInit[];
      seed: number;
      god: boolean;
      bench: boolean;
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
  /** All parts of one tick's snapshot for one player, and that tick's simulation time. */
  | { t: 'snap'; to: number; bufs: ArrayBuffer[]; simMs: number }
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
