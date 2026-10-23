import type { CommanderCast, CarrierCheck } from './data/commanders';
import type { WatchmanAim } from './data/watchman';
/** The read-only debug object `window.__heavenfall` (§2.5). */
import type { DirectorInfo } from './sim/director';
import type { DominionLeap } from './data/dominion';

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
  wallet: number;
  pickups: Array<{ id: number; kind: number; x: number; y: number }>;
  props: Array<{ id: number; room: number; family: string; x: number; y: number; z: number; marked: boolean }>;
  brokenProps: number[];
  propRecharges: Array<{ id: number; readyTick: number }>;
  hazards: { activeRoom: number; activeCells: number };
  spawnWarnings: Array<{ id: number; room: number; x: number; y: number; z: number; startTick: number; readyTick: number }>;
  crests: number;
  /** R5: class floor fire cells drawn now, and live talent areas by kind. */
  talentFire: number;
  talentAreas: string[];
  /** R6: the own equipped relics and combo, live relic area effects, the route state, own pending relic offers, the own streak and the Sentence. */
  relics: { equipped: [string | null, string | null]; combo: string | null };
  relicAreas: string[];
  relicShots: number;
  route: { keyHolder: number; keyUsed: boolean; chest: { open: boolean } | null; bells: string[]; sundial: string } | null;
  relicOffers: number;
  streak: { count: number; best: number };
  sentence: number;
  commanders: CommanderCast[];
  /** The latest snapshot's Watchman aim records (rogue rooms.md §6.4). */
  watchmen: WatchmanAim[];
  /** The Gatekeeper fight as this screen draws it (rogue bosses.md §3); null outside it. */
  boss: { phase: number; cast: number; cycle: number; held: number; heldLocal: boolean; eyes: number; seals: number; sight: string; rings: number[]; hp: number; maxHp: number; flags: number; at: [number, number, number]; seal: [number, number, number] | null } | null;
  /** ...and every Watchman's accepted feet in that snapshot. */
  watchmanBodies: Array<{ slot: number; incarnation: number; x: number; y: number; z: number }>;
  carrierChecks: CarrierCheck[];
  /** The host's count of each player's weapon kills (netcode stage 3); empty on a guest. */
  weaponKills: Record<number, number>;
  dominion: { rendered: Array<{ slot: number; type: number; z: number; floor: number }>; actors: Array<{ slot: number; incarnation: number; x: number; y: number; z: number }>; casts: Array<{ slot: number; incarnation: number; castId: number; startTick: number; impactTick: number; room: number; x: number; y: number; z: number; leap?: DominionLeap }>; starts: number; startedCastIds: number[]; strikes: number; cancels: number };
  seed: number | null;
  simSeed: number | null;
  runId: string | null;
  attempts: number;
  fallbackUsed: boolean;
  genMs: number;
  floorHash: string | null;
  /** The room in countdown or combat, 255 for none (rogue game.md §14.3). */
  activeRoom: number;
  activePhase: 'idle' | 'countdown' | 'combat';
  /** Bit i: room i is cleared. */
  clearedMask: number;
  roomKnowledge: number[];
  floorSyncTick: number;
  mapHeld: boolean;
  /** Seconds until the room seals, 0 outside the countdown (M8 §10). */
  countdown: number;
  netInKBps: number;
  netOutKBps: number;
  /**
   * The connection (netcode stage): a client's round trip (ms) and route to the host, the render
   * delay and the snapshot jitter (ms), and the F3 lines: the client's own, or one per client on the host.
   */
  link: { rttMs: number | null; route: 'direct' | 'relay' | null; delayMs: number; jitterMs: number; lines: string[] };
  /**
   * The local player's predicted kills: made, confirmed by the host (the enemy left the snapshots), missed,
   * reappeared; and `reported`, its other kills the host reported that died at once (netcode stage 4).
   */
  killMarkers: { predicted: number; confirmed: number; missed: number; revealed: number; reported: number };
  /**
   * The local Heretic's own censers (netcode stage 4): thrown here, matched to the host's, ending where the
   * local one broke, and host censers of its own that matched no throw (drawn late, as the host's).
   */
  censers: { thrown: number; matched: number; agreed: number; unmatched: number };
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
  wallet: 0,
  spawnWarnings: [],
  crests: 0,
  talentFire: 0,
  talentAreas: [],
  relics: { equipped: [null, null], combo: null },
  relicAreas: [],
  relicShots: 0,
  route: null,
  relicOffers: 0,
  streak: { count: 0, best: 0 },
  sentence: 0,
  pickups: [],
  props: [],
  brokenProps: [],
  propRecharges: [],
  hazards: { activeRoom: -1, activeCells: 0 },
  commanders: [],
  watchmen: [],
  boss: null,
  watchmanBodies: [],
  carrierChecks: [],
  weaponKills: {},
  dominion: { rendered: [], actors: [], casts: [], starts: 0, startedCastIds: [], strikes: 0, cancels: 0 },
  seed: null,
  simSeed: null,
  runId: null,
  attempts: 0,
  fallbackUsed: false,
  genMs: 0,
  floorHash: null,
  activeRoom: 255,
  activePhase: 'idle',
  clearedMask: 0,
  roomKnowledge: [],
  floorSyncTick: -1,
  mapHeld: false,
  countdown: 0,
  netInKBps: 0,
  netOutKBps: 0,
  link: { rttMs: null, route: null, delayMs: 0, jitterMs: 0, lines: [] },
  killMarkers: { predicted: 0, confirmed: 0, missed: 0, revealed: 0, reported: 0 },
  censers: { thrown: 0, matched: 0, agreed: 0, unmatched: 0 },
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
    wallet: 0,
    relics: { equipped: [null, null], combo: null }, relicAreas: [], relicShots: 0, route: null, relicOffers: 0, streak: { count: 0, best: 0 }, sentence: 0,
    pickups: [],
    props: [],
    brokenProps: [],
    propRecharges: [],
    hazards: { activeRoom: -1, activeCells: 0 },
    commanders: [],
  watchmen: [],
  boss: null,
  watchmanBodies: [],
    carrierChecks: [],
    weaponKills: {},
    dominion: { rendered: [], actors: [], casts: [], starts: 0, startedCastIds: [], strikes: 0, cancels: 0 },
    seed: null,
    simSeed: null,
    runId: null,
    attempts: 0,
    fallbackUsed: false,
    genMs: 0,
    floorHash: null,
    activeRoom: 255,
    activePhase: 'idle',
    clearedMask: 0,
    roomKnowledge: [],
    floorSyncTick: -1,
    mapHeld: false,
    countdown: 0,
    netInKBps: 0,
    netOutKBps: 0,
    link: { rttMs: null, route: null, delayMs: 0, jitterMs: 0, lines: [] },
    killMarkers: { predicted: 0, confirmed: 0, missed: 0, revealed: 0, reported: 0 },
    censers: { thrown: 0, matched: 0, agreed: 0, unmatched: 0 },
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
    __heavenfallLook?: (yaw: number, pitch?: number) => void;
    /** Dev menu only: finish the prepared client's real ready handshake. */
    __heavenfallReady?: () => void;
  }
}

Object.defineProperty(window, '__heavenfall', {
  get: () => debugState,
  configurable: false,
  enumerable: true,
});
