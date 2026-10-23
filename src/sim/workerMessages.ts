/** Internal messages between the main thread and the simulation worker (not part of §9.2). */
import type { CtrlMessage, RunConfig } from '../net/messages';
import type { CarrierCheck } from '../data/commanders';
import type { DirectorInfo } from './director';
import type { Simulation, SimPlayerInit } from './sim';
import type { Profile } from '../profile/model';

export type MainToWorker =
  /** Singleplayer (and dev and bench modes): starts the game at once. */
  | ({
      t: 'start';
      players: SimPlayerInit[];
      god: boolean;
      /** The benchmark's arena, or -1 when not benchmarking (M10 gate §4). */
      benchArena: number;
      /** The benchmark's bursts (M12 §10). */
      benchBurst: boolean;
      localPlayerId: number;
      /** Dev room/arena override, resolved after loading the generated floor or fixture. */
      startRoom?: number;
      /** `dev=1`: the host records local debug diagnostics. */
      diagnostics?: boolean;
      /** `build=<name>` with dev=1: a development quick build for the human players. */
      devBuild?: string;
      devRelics?: string[];
    } & RunConfig)
  /** Multiplayer: the host clicked `Create`; the worker opens the lobby with the host as player 0. */
  | { t: 'host'; heaven: 1; fixture: string | null; password: string; name: string; god: boolean; bot: boolean; profile?: Profile; progressionEnabled?: boolean; diagnostics?: boolean;
      /** Dev co-op setups (`dev=1`, disposable runs only): the floor seed and the room the party starts in. */
      devSeed?: number; devStartRoom?: number }
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
  | { t: 'killAll'; blessedOnly?: boolean }
  | { t: 'toggleGod'; playerId: number }
  | { t: 'devItems'; playerId: number }
  /** Dev key B: the next quick build; dev key R: a Rite offer now. */
  | { t: 'devBuild'; playerId: number }
  | { t: 'devRite'; playerId: number }
  | { t: 'stop' };

export type WorkerToMain =
  /**
   * All parts of one tick's snapshot for one player, and that tick's simulation time. The local
   * player's also carry the director's state (M12 §2.3), null when no combat arena is in combat.
   */
  | { t: 'snap'; to: number; bufs: ArrayBuffer[]; simMs: number; director?: DirectorInfo | null; carrierChecks?: CarrierCheck[]; weaponKills?: Record<number, number> }
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

/**
 * The `snap` message for the host's own player: it also carries the director's state (M12 §2.3) and
 * each player's weapon kills (netcode stage 3).
 */
export function localSnap(sim: Pick<Simulation, 'directorInfo' | 'commanders' | 'weaponKills'>, to: number, bufs: ArrayBuffer[], simMs: number): WorkerToMain {
  return { t: 'snap', to, bufs, simMs, director: sim.directorInfo(), carrierChecks: sim.commanders.diagnostics(), weaponKills: sim.weaponKills() };
}
