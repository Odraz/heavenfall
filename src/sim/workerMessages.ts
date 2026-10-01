/** Internal messages between the main thread and the simulation worker (not part of §9.2). */
import type { CtrlMessage } from '../net/messages';
import type { SimPlayerInit } from './sim';

export type MainToWorker =
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
  | { t: 'input'; playerId: number; buf: ArrayBuffer }
  | { t: 'pause'; paused: boolean }
  | { t: 'killAll' }
  | { t: 'toggleGod'; playerId: number }
  | { t: 'stop' };

export type WorkerToMain =
  /** All parts of one tick's snapshot for one player, and that tick's simulation time. */
  | { t: 'snap'; to: number; bufs: ArrayBuffer[]; simMs: number }
  | { t: 'ctrl'; to: number | 'all'; msg: CtrlMessage };
