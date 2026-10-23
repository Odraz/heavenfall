/**
 * The host's lobby state (§3, §9.2): players and classes, the start → ready → go handshake, from
 * M8 joining the game in progress (§6.2), and back to the Lobby after the game. Pure TS; the
 * simulation worker owns one and sends the messages it produces.
 */
import { isClassId, type ClassId } from '../data/classes';
import type { CtrlMessage, LobbyPlayer, RejectReason, RunConfig } from './messages';
import { newRunIdentity } from './version';
import { cleanEdicts } from '../data/edicts';
import type { Profile } from '../profile/model';

export const MAX_PLAYERS = 4;
export const NAME_MAX = 16;
export const PASSWORD_MAX = 32;
/** Chat messages are cut to this many characters (M8 §7). */
export const CHAT_MAX = 120;
/** A client not ready this long after its `start` is dropped (§3). */
export const LOAD_TIMEOUT_MS = 20000;

/** The whole lobby: before `start` (and again after the game), Loading (everyone loads at once), then the game. */
export type LobbyPhase = 'lobby' | 'loading' | 'game';

export interface LobbyOptions {
  heaven: 1;
  fixture: string | null;
  /** Empty means an open game. */
  password: string;
  version: string;
  hostName: string;
  hostBot?: boolean;
  progressionEnabled?: boolean;
  profile?: Profile;
  /** A dev co-op host's fixed floor seed and starting room; disposable runs only. */
  devSeed?: number;
  devStartRoom?: number;
}

export type JoinResult = { ok: true; playerId: number; inProgress: boolean } | { ok: false; reason: RejectReason };

export type StartPlayer = Extract<CtrlMessage, { type: 'start' }>['players'][number];

/**
 * Where a player is: in the Lobby (before the game, or the in-progress Lobby during it), loading
 * (between its `start` and its `ready`), in the game, or on Results after it.
 */
type MemberState = 'lobby' | 'loading' | 'game' | 'results';

interface Member extends LobbyPlayer {
  profile?: Profile;
  bot: boolean;
  state: MemberState;
  /** Host time (ms) of this player's `start`. */
  startedAt: number;
}

/** A player name as the host keeps it: trimmed and at most 16 characters; empty becomes `Player`. */
export function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, NAME_MAX).trim() : '';
  return name || 'Player';
}

/** A chat message as the host relays it (M8 §7): trimmed and cut to 120 characters; null if empty. */
export function cleanChat(raw: unknown): string | null {
  const text = typeof raw === 'string' ? raw.trim().slice(0, CHAT_MAX) : '';
  return text || null;
}

export class Lobby {
  phase: LobbyPhase = 'lobby';
  readonly heaven: 1 = 1;
  readonly fixture: string | null;
  /** Created at Start, retained through Loading and late admission. */
  private runConfig: RunConfig | null = null;
  private readonly password: string;
  private readonly version: string;
  /** Connected players by id; the host is 0. */
  private readonly players = new Map<number, Member>();
  private readonly readyIds = new Set<number>();
  private readonly retained = new Map<string, Member>();
  readonly progressionEnabled: boolean;
  /** The host's Edicts for the next run (§2.5). */
  edicts: number[] = [];

  /** A dev co-op host's fixed floor seed (R7 observation setups). */
  private readonly devSeed: number | undefined;
  private readonly devStartRoom: number | undefined;

  constructor(o: LobbyOptions) {
    this.fixture = o.fixture;
    this.password = o.password;
    this.version = o.version;
    this.progressionEnabled = o.progressionEnabled ?? false;
    this.devSeed = this.progressionEnabled ? undefined : o.devSeed;
    this.devStartRoom = this.progressionEnabled || this.fixture !== null ? undefined : o.devStartRoom;
    this.players.set(0, { id: 0, name: cleanName(o.hostName), classId: null, bot: !!o.hostBot, isHost: true, inResults: false, state: 'lobby', startedAt: 0, profile: o.profile });
  }

  /**
   * A `hello` from a new client. The checks run in this order: version, Loading in progress,
   * password, full (M8 §6.2). An accepted client gets the lowest free id from 1 to 3; during the game
   * it waits in the in-progress Lobby.
   */
  join(name: unknown, password: unknown, version: unknown, bot: unknown = false, profile?: Profile): JoinResult {
    if (version !== this.version) return { ok: false, reason: 'version' };
    if (this.phase === 'loading') return { ok: false, reason: 'in_progress' };
    if (password !== this.password) return { ok: false, reason: 'bad_password' };
    if (profile && [...this.players.values()].some(p => p.profile?.id === profile.id)) return { ok: false, reason: 'full' };
    const retained = profile && this.retained.get(profile.id);
    if (retained) {
      retained.state = 'lobby'; retained.profile = profile;
      this.players.set(retained.id, retained); this.retained.delete(profile.id);
      return { ok: true, playerId: retained.id, inProgress: this.phase === 'game' };
    }
    for (let id = 1; id < MAX_PLAYERS; id++) {
      if (this.players.has(id) || [...this.retained.values()].some(p => p.id === id)) continue;
      this.players.set(id, { id, name: cleanName(name), classId: null, bot: bot === true, isHost: false, inResults: false, state: 'lobby', startedAt: 0, profile });
      return { ok: true, playerId: id, inProgress: this.phase === 'game' };
    }
    return { ok: false, reason: 'full' };
  }

  has(id: number): boolean {
    return this.players.has(id);
  }

  /** The `lobby` message: every connected player, sorted by id. */
  lobbyMessage(): Extract<CtrlMessage, { type: 'lobby' }> {
    const players = [...this.players.values()]
      .sort((a, b) => a.id - b.id)
      .map(({ id, name, classId, bot, isHost, state }) => ({ id, name, classId, bot, isHost, inResults: state === 'results' }));
    return { type: 'lobby', heaven: this.heaven, fixture: this.fixture, players, edicts: [...this.edicts] };
  }

  /**
   * Picks a class, or clears the pick when it's the player's own class already (clicked again);
   * returns false (and changes nothing) if it's taken, unknown, or the player can't pick now: only in
   * the Lobby, or in the in-progress Lobby during the game.
   */
  pickClass(id: number, classId: unknown): boolean {
    const p = this.players.get(id);
    if (!p || p.state !== 'lobby' || this.phase === 'loading' || !isClassId(classId)) return false;
    if (p.classId === classId) {
      p.classId = null;
      return true;
    }
    for (const q of this.players.values()) if (q.classId === classId) return false;
    for (const q of this.retained.values()) if (q.classId === classId) return false;
    p.classId = classId;
    return true;
  }

  /** A player left or disconnected: frees their slot and class, and drops them from Loading. */
  remove(id: number, retain = false): boolean {
    const member = this.players.get(id);
    if (id === 0 || !member || !this.players.delete(id)) return false;
    if (retain && member.profile) this.retained.set(member.profile.id, member);
    this.readyIds.delete(id);
    return true;
  }

  profile(id: number): Profile | undefined { return this.players.get(id)?.profile; }
  /** The host's Edicts, in the Lobby only, once its profile has cleared the heaven (or the run saves nothing). */
  setEdicts(id: number, edicts: unknown): boolean {
    const host = this.players.get(0);
    if (id !== 0 || this.phase !== 'lobby' || !host) return false;
    if (this.progressionEnabled && (host.profile?.heavens.clears[this.heaven] ?? 0) < 1) return false;
    this.edicts = cleanEdicts(edicts);
    return true;
  }
  setProfile(id: number, profile: Profile): boolean {
    const p = this.players.get(id);
    if (!p || p.bot || p.state !== 'lobby' || this.phase === 'loading' || p.profile && p.profile.id !== profile.id) return false;
    if ([...this.players.values()].some(q => q.id !== id && q.profile?.id === profile.id)) return false;
    p.profile = profile; p.name = profile.name; return true;
  }

  /**
   * The host's `Start` is enabled only when every connected player has picked a class (§3) and is
   * back from Results.
   */
  canStart(): boolean {
    if (this.phase !== 'lobby') return false;
    for (const p of this.players.values()) if (!p.classId || p.state !== 'lobby' || this.progressionEnabled && !p.bot && !p.profile) return false;
    return true;
  }

  /** The players in the game or loading into it, sorted by id, as `start` lists them. */
  private startPlayers(): StartPlayer[] {
    return [...this.players.values()]
      .filter((p) => p.state !== 'lobby' && p.classId)
      .sort((a, b) => a.id - b.id)
      .map((p) => ({ id: p.id, name: p.name, classId: p.classId as ClassId, bot: p.bot }));
  }

  get run(): RunConfig | null {
    return this.runConfig;
  }

  private startMessage(): Extract<CtrlMessage, { type: 'start' }> {
    return { type: 'start', ...this.runConfig!, players: this.startPlayers() };
  }

  /** Starts Loading: returns the `start` message, or null if the lobby can't start. */
  start(nowMs: number): Extract<CtrlMessage, { type: 'start' }> | null {
    if (!this.canStart()) return null;
    this.runConfig = { ...newRunIdentity(this.devSeed), heaven: this.heaven, floor: 1, edicts: [...this.edicts], progressionEnabled: this.progressionEnabled, fixture: this.fixture,
      ...(this.devStartRoom !== undefined ? { devStartRoom: this.devStartRoom } : {}) };
    this.phase = 'loading';
    for (const p of this.players.values()) {
      p.state = 'loading';
      p.startedAt = nowMs;
    }
    return this.startMessage();
  }

  /**
   * `enterGame` from the in-progress Lobby (M8 §6.2): the player, with a class picked, starts loading.
   * Returns that player's `start`, listing the players in the game and itself, or null if it can't
   * enter now.
   */
  enterGame(id: number, nowMs: number): Extract<CtrlMessage, { type: 'start' }> | null {
    const p = this.players.get(id);
    if (this.phase !== 'game' || !p || p.state !== 'lobby' || !p.classId) return null;
    p.state = 'loading';
    p.startedAt = nowMs;
    return this.startMessage();
  }

  /**
   * A player's `ready`. During Loading it's counted toward `go` (and null is returned). During the
   * game, a player who entered from the in-progress Lobby is in the game from now on: the player is
   * returned, for the host to add to the simulation and send `go`.
   */
  ready(id: number): StartPlayer | null {
    const p = this.players.get(id);
    if (!p || p.state !== 'loading') return null;
    if (this.phase === 'loading') {
      this.readyIds.add(id);
      return null;
    }
    p.state = 'game';
    return { id: p.id, name: p.name, classId: p.classId as ClassId, bot: p.bot };
  }

  /** Players still loading (between their `start` and their `ready`). */
  loadingIds(): number[] {
    return [...this.players.values()].filter((p) => p.state === 'loading' && !this.readyIds.has(p.id)).map((p) => p.id);
  }

  /** Clients (never the host) still loading 20 s after their `start`. */
  loadTimedOut(nowMs: number): number[] {
    return this.loadingIds().filter((id) => id !== 0 && nowMs - this.players.get(id)!.startedAt >= LOAD_TIMEOUT_MS);
  }

  /** Whether every player still connected has sent `ready` during Loading. */
  allReady(): boolean {
    if (this.phase !== 'loading') return false;
    for (const id of this.players.keys()) if (!this.readyIds.has(id)) return false;
    return true;
  }

  /** Enters the game: the players still connected, sorted by id. Those who left during Loading are gone. */
  go(): StartPlayer[] {
    this.phase = 'game';
    this.readyIds.clear();
    for (const p of this.players.values()) p.state = 'game';
    return this.startPlayers();
  }

  /**
   * The game ended: the lobby opens again. Players in the game are on Results until their
   * `backToLobby`; the rest (the in-progress Lobby, or loading into the game) are in the Lobby at
   * once. Everyone keeps their class.
   */
  endGame(): void {
    if (this.phase !== 'game') return;
    this.phase = 'lobby';
    this.retained.clear();
    for (const p of this.players.values()) p.state = p.state === 'game' ? 'results' : 'lobby';
  }

  /** A player's `backToLobby` from Results; false if the player isn't on Results. */
  backToLobby(id: number): boolean {
    const p = this.players.get(id);
    if (!p || p.state !== 'results') return false;
    p.state = 'lobby';
    return true;
  }
}
