/**
 * The host's lobby state (§3, §9.2): players and classes, then the start → ready → go handshake.
 * Pure TS; the simulation worker owns one and sends the messages it produces.
 */
import { isClassId, type ClassId } from '../data/classes';
import type { CtrlMessage, LobbyPlayer, RejectReason } from './messages';

export const MAX_PLAYERS = 4;
export const NAME_MAX = 16;
export const PASSWORD_MAX = 32;
/** A client not ready this long after `start` is dropped (§3). */
export const LOAD_TIMEOUT_MS = 20000;

export type LobbyPhase = 'lobby' | 'loading' | 'game';

export interface LobbyOptions {
  dungeonId: string;
  /** Empty means an open game. */
  password: string;
  version: string;
  hostName: string;
}

export type JoinResult = { ok: true; playerId: number } | { ok: false; reason: RejectReason };

type StartPlayer = Extract<CtrlMessage, { type: 'start' }>['players'][number];

/** A player name as the host keeps it: trimmed and at most 16 characters; empty becomes `Player`. */
export function cleanName(raw: unknown): string {
  const name = typeof raw === 'string' ? raw.trim().slice(0, NAME_MAX).trim() : '';
  return name || 'Player';
}

export class Lobby {
  phase: LobbyPhase = 'lobby';
  readonly dungeonId: string;
  private readonly password: string;
  private readonly version: string;
  /** Connected players by id; the host is 0. */
  private readonly players = new Map<number, LobbyPlayer>();
  /** The players in `start`, sorted by id (§3). */
  private started: StartPlayer[] = [];
  private readonly readyIds = new Set<number>();
  private startedAt = 0;

  constructor(o: LobbyOptions) {
    this.dungeonId = o.dungeonId;
    this.password = o.password;
    this.version = o.version;
    this.players.set(0, { id: 0, name: cleanName(o.hostName), classId: null, isHost: true });
  }

  /**
   * A `hello` from a new client. The checks run in this order: version, game in progress,
   * password, full. An accepted client gets the lowest free id from 1 to 3.
   */
  join(name: unknown, password: unknown, version: unknown): JoinResult {
    if (version !== this.version) return { ok: false, reason: 'version' };
    if (this.phase !== 'lobby') return { ok: false, reason: 'in_progress' };
    if (password !== this.password) return { ok: false, reason: 'bad_password' };
    for (let id = 1; id < MAX_PLAYERS; id++) {
      if (this.players.has(id)) continue;
      this.players.set(id, { id, name: cleanName(name), classId: null, isHost: false });
      return { ok: true, playerId: id };
    }
    return { ok: false, reason: 'full' };
  }

  has(id: number): boolean {
    return this.players.has(id);
  }

  /** The `lobby` message: every connected player, sorted by id. */
  lobbyMessage(): Extract<CtrlMessage, { type: 'lobby' }> {
    const players = [...this.players.values()].sort((a, b) => a.id - b.id).map((p) => ({ ...p }));
    return { type: 'lobby', dungeonId: this.dungeonId, players };
  }

  /** Picks a class; returns false (and changes nothing) if it's taken, unknown, or the lobby is closed. */
  pickClass(id: number, classId: unknown): boolean {
    const p = this.players.get(id);
    if (!p || this.phase !== 'lobby' || !isClassId(classId)) return false;
    if (p.classId === classId) return false;
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

  /** The host's `Start` is enabled only when every connected player has picked a class (§3). */
  canStart(): boolean {
    if (this.phase !== 'lobby') return false;
    for (const p of this.players.values()) if (!p.classId) return false;
    return true;
  }

  /** Starts Loading: returns the `start` message, or null if the lobby can't start. */
  start(nowMs: number): Extract<CtrlMessage, { type: 'start' }> | null {
    if (!this.canStart()) return null;
    this.phase = 'loading';
    this.startedAt = nowMs;
    this.started = [...this.players.values()].sort((a, b) => a.id - b.id).map((p) => ({ id: p.id, name: p.name, classId: p.classId as ClassId }));
    return { type: 'start', dungeonId: this.dungeonId, players: this.started.map((p) => ({ ...p })) };
  }

  ready(id: number): void {
    if (this.phase === 'loading' && this.players.has(id)) this.readyIds.add(id);
  }

  /** Players still loading (between `start` and their `ready`). */
  loadingIds(): number[] {
    if (this.phase !== 'loading') return [];
    return [...this.players.keys()].filter((id) => !this.readyIds.has(id));
  }

  /** Clients (never the host) still loading 20 s after `start`. */
  loadTimedOut(nowMs: number): number[] {
    if (this.phase !== 'loading' || nowMs - this.startedAt < LOAD_TIMEOUT_MS) return [];
    return [...this.players.keys()].filter((id) => id !== 0 && !this.readyIds.has(id));
  }

  /** Whether every player still connected has sent `ready`. */
  allReady(): boolean {
    if (this.phase !== 'loading') return false;
    for (const id of this.players.keys()) if (!this.readyIds.has(id)) return false;
    return true;
  }

  /**
   * Enters the game: the players of `start` in order, those who left or were dropped during Loading
   * marked as not connected, so every player keeps the index `start` gave it.
   */
  go(): Array<StartPlayer & { connected: boolean }> {
    this.phase = 'game';
    return this.started.map((p) => ({ ...p, connected: this.players.has(p.id) }));
  }
}
