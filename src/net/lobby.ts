/**
 * The host's lobby state (§3, §9.2): players and classes, the start → ready → go handshake, from
 * M8 joining the game in progress (§6.2), and back to the Lobby after the game. Pure TS; the
 * simulation worker owns one and sends the messages it produces.
 */
import { isClassId, type ClassId } from '../data/classes';
import type { CtrlMessage, LobbyPlayer, RejectReason } from './messages';

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
  dungeonId: string;
  /** Empty means an open game. */
  password: string;
  version: string;
  hostName: string;
}

export type JoinResult = { ok: true; playerId: number; inProgress: boolean } | { ok: false; reason: RejectReason };

export type StartPlayer = Extract<CtrlMessage, { type: 'start' }>['players'][number];

/**
 * Where a player is: in the Lobby (before the game, or the in-progress Lobby during it), loading
 * (between its `start` and its `ready`), in the game, or on Results after it.
 */
type MemberState = 'lobby' | 'loading' | 'game' | 'results';

interface Member extends LobbyPlayer {
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
  readonly dungeonId: string;
  private readonly password: string;
  private readonly version: string;
  /** Connected players by id; the host is 0. */
  private readonly players = new Map<number, Member>();
  private readonly readyIds = new Set<number>();

  constructor(o: LobbyOptions) {
    this.dungeonId = o.dungeonId;
    this.password = o.password;
    this.version = o.version;
    this.players.set(0, { id: 0, name: cleanName(o.hostName), classId: null, isHost: true, inResults: false, state: 'lobby', startedAt: 0 });
  }

  /**
   * A `hello` from a new client. The checks run in this order: version, Loading in progress,
   * password, full (M8 §6.2). An accepted client gets the lowest free id from 1 to 3; during the game
   * it waits in the in-progress Lobby.
   */
  join(name: unknown, password: unknown, version: unknown): JoinResult {
    if (version !== this.version) return { ok: false, reason: 'version' };
    if (this.phase === 'loading') return { ok: false, reason: 'in_progress' };
    if (password !== this.password) return { ok: false, reason: 'bad_password' };
    for (let id = 1; id < MAX_PLAYERS; id++) {
      if (this.players.has(id)) continue;
      this.players.set(id, { id, name: cleanName(name), classId: null, isHost: false, inResults: false, state: 'lobby', startedAt: 0 });
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
      .map(({ id, name, classId, isHost, state }) => ({ id, name, classId, isHost, inResults: state === 'results' }));
    return { type: 'lobby', dungeonId: this.dungeonId, players };
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
    p.classId = classId;
    return true;
  }

  /** A player left or disconnected: frees their slot and class, and drops them from Loading. */
  remove(id: number): boolean {
    if (id === 0 || !this.players.delete(id)) return false;
    this.readyIds.delete(id);
    return true;
  }

  /**
   * The host's `Start` is enabled only when every connected player has picked a class (§3) and is
   * back from Results.
   */
  canStart(): boolean {
    if (this.phase !== 'lobby') return false;
    for (const p of this.players.values()) if (!p.classId || p.state !== 'lobby') return false;
    return true;
  }

  /** The players in the game or loading into it, sorted by id, as `start` lists them. */
  private startPlayers(): StartPlayer[] {
    return [...this.players.values()]
      .filter((p) => p.state !== 'lobby' && p.classId)
      .sort((a, b) => a.id - b.id)
      .map((p) => ({ id: p.id, name: p.name, classId: p.classId as ClassId }));
  }

  /** Starts Loading: returns the `start` message, or null if the lobby can't start. */
  start(nowMs: number): Extract<CtrlMessage, { type: 'start' }> | null {
    if (!this.canStart()) return null;
    this.phase = 'loading';
    for (const p of this.players.values()) {
      p.state = 'loading';
      p.startedAt = nowMs;
    }
    return { type: 'start', dungeonId: this.dungeonId, players: this.startPlayers() };
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
    return { type: 'start', dungeonId: this.dungeonId, players: this.startPlayers() };
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
    return { id: p.id, name: p.name, classId: p.classId as ClassId };
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
