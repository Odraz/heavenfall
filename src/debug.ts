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
  /** Revive progress 0–1 while dead (M8 §10). */
  revive: number;
  /** The host's counts of primary and secondary attacks fired, not wrapped (M9 §10). */
  primaryShots: number;
  secondaryShots: number;
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
  arenaPhase: 'idle' | 'countdown' | 'combat' | 'cleared';
  /** Seconds until the arena seals, 0 outside the countdown (M8 §10). */
  countdown: number;
  netInKBps: number;
  netOutKBps: number;
  players: DebugPlayer[];
  gameResult: null | 'victory' | 'defeat';
  /** The last 50 chat messages of the session (M8 §10). */
  chat: Array<{ playerId: number; text: string }>;
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
  countdown: 0,
  netInKBps: 0,
  netOutKBps: 0,
  players: [],
  gameResult: null,
  chat: [],
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
    countdown: 0,
    netInKBps: 0,
    netOutKBps: 0,
    players: [],
    gameResult: null,
    chat: [],
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
