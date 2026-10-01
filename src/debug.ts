/** The read-only debug object `window.__heavenfall` (§2.5). */

export type Screen =
  | 'title'
  | 'singleplayerSetup'
  | 'multiplayer'
  | 'hostSetup'
  | 'join'
  | 'lobby'
  | 'loading'
  | 'inGame'
  | 'results';

export interface DebugPlayer {
  id: number;
  classId: string;
  hp: number;
  dead: boolean;
  kills: number;
}

export interface DebugState {
  screen: Screen;
  paused: boolean;
  fps: number;
  simMs: number;
  lastSnapshotTick: number;
  enemies: number;
  enemyCountsByTick: Record<number, number>;
  projectiles: number;
  arenaIndex: number;
  arenaPhase: 'idle' | 'combat' | 'cleared';
  netInKBps: number;
  netOutKBps: number;
  players: DebugPlayer[];
  gameResult: null | 'victory' | 'defeat';
}

export const debugState: DebugState = {
  screen: 'title',
  paused: false,
  fps: 0,
  simMs: 0,
  lastSnapshotTick: 0,
  enemies: 0,
  enemyCountsByTick: {},
  projectiles: 0,
  arenaIndex: 0,
  arenaPhase: 'idle',
  netInKBps: 0,
  netOutKBps: 0,
  players: [],
  gameResult: null,
};

/** Resets the game fields to their outside-a-game values. */
export function resetGameDebug(): void {
  Object.assign(debugState, {
    paused: false,
    fps: 0,
    simMs: 0,
    lastSnapshotTick: 0,
    enemies: 0,
    enemyCountsByTick: {},
    projectiles: 0,
    arenaIndex: 0,
    arenaPhase: 'idle',
    netInKBps: 0,
    netOutKBps: 0,
    players: [],
    gameResult: null,
  });
}

declare global {
  interface Window {
    readonly __heavenfall: Readonly<DebugState>;
  }
}

Object.defineProperty(window, '__heavenfall', {
  get: () => debugState,
  configurable: false,
  enumerable: true,
});
