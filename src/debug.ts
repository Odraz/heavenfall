/** The read-only debug object `window.__heavenfall` (§2.5). */
import type { DirectorInfo } from './sim/director';

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
  /** The director's state (M12 §2.3), on the host and in single player while a combat arena fights; else null. */
  director: DirectorInfo | null;
  /** Wading (M12 §3.1): ground enemies pressing against the local player this frame, and the applied speed factor. */
  wade: { count: number; factor: number };
  /** Burst deaths (M12 §4.2) played on this client: light and heavy, and mass kills played. */
  bursts: { light: number; heavy: number; massKills: number };
  /** performance.now() when the local Shadowstep's slash last began (M12 §5.7), for screenshots; -1 before. */
  slashAt: number;
  /** ...and when its streak was last drawn, as the dash ended; -1 before. */
  streakAt: number;
  /** With `dev=1`: the local player's feet and view (radians), and the interpolated enemies within 8 m of it (screenshots). */
  self: { x: number; y: number; z: number; yaw: number; pitch: number };
  near: number;
  /** ...and the yaw (radians) from it to their centroid. */
  nearYaw: number;
  /** With `dev=1`: Falling Star's preview this frame (M12 §5.2), or null when not aiming. */
  star: { x: number; y: number; z: number; valid: boolean; ally: number } | null;
  /** Globe shatters (M12 follow-up §1.3) played on this client, and those shot down; performance.now() of the latest. */
  globes: { shattered: number; shotDown: number; at: number };
  /** performance.now() when the chains over a Binder's pile last came down (M12 follow-up §2.2); -1 before. */
  chainsAt: number;
  /** With `dev=1`: the yaw and pitch (radians) from the eye to the nearest Chorister's body center within 30 m, or null. */
  casterAim: { yaw: number; pitch: number } | null;
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
  director: null,
  wade: { count: 0, factor: 1 },
  bursts: { light: 0, heavy: 0, massKills: 0 },
  slashAt: -1,
  streakAt: -1,
  self: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
  near: 0,
  nearYaw: 0,
  star: null,
  globes: { shattered: 0, shotDown: 0, at: -1 },
  chainsAt: -1,
  casterAim: null,
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
    director: null,
    wade: { count: 0, factor: 1 },
    bursts: { light: 0, heavy: 0, massKills: 0 },
    slashAt: -1,
    streakAt: -1,
    self: { x: 0, y: 0, z: 0, yaw: 0, pitch: 0 },
    near: 0,
    nearYaw: 0,
    star: null,
  });
}

declare global {
  interface Window {
    readonly __heavenfall: Readonly<DebugState>;
    /** With `dev=1`, in game: moves the local player to (x, y) on the floor there, as a teleport (screenshots, M12 stage 4). */
    __heavenfallTeleport?: (x: number, y: number) => void;
  }
}

Object.defineProperty(window, '__heavenfall', {
  get: () => debugState,
  configurable: false,
  enumerable: true,
});
