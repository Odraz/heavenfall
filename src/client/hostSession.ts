/**
 * The host side on the main thread (§2.2): owns the simulation worker and the host player's
 * LocalTransport and, in multiplayer, relays between the worker and the clients' PeerJS connections.
 */
import type { CarrierCheck } from '../data/commanders';
import type { HostNet } from '../net/hostNet';
import type { RunConfig } from '../net/messages';
import { LocalTransport } from '../net/transport';
import type { DirectorInfo } from '../sim/director';
import type { SimPlayerInit } from '../sim/sim';
import type { MainToWorker, WorkerToMain } from '../sim/workerMessages';
import type { Profile } from '../profile/model';

export class HostSession {
  readonly worker: Worker;
  readonly local: LocalTransport;
  /** The clients' connections, in multiplayer. */
  private net: HostNet | null = null;
  private readonly connPlayer = new Map<number, number>();
  private readonly playerConn = new Map<number, number>();
  /** Per-tick worker times (ms) with their arrival times, for the last 1 s. */
  private readonly tickTimes: Array<[number, number]> = [];
  private stopped = false;
  /** The director's state from the latest local snapshot (M12 §2.3). */
  director: DirectorInfo | null = null;
  carrierChecks: CarrierCheck[] = [];
  /** Each player's kills by their own weapon hits, from the latest local snapshot (netcode stage 3). */
  weaponKills: Record<number, number> = {};
  /** Called with each tick's simulation time (ms). */
  onTickMs: (ms: number) => void = () => {};

  constructor(readonly localPlayerId: number) {
    this.worker = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });
    this.local = new LocalTransport(localPlayerId, this.worker);
    this.worker.onmessage = (e: MessageEvent<WorkerToMain>) => this.onWorkerMessage(e.data);
  }

  private post(msg: MainToWorker, transfer: Transferable[] = []): void {
    if (!this.stopped) this.worker.postMessage(msg, transfer);
  }

  /** Singleplayer: starts the game at once. */
  start(run: RunConfig, players: SimPlayerInit[], god: boolean, benchArena: number, benchBurst = false, startRoom?: number, diagnostics = false, devBuild?: string, devRelics?: string[]): void {
    this.post({ ...run, t: 'start', players, god, benchArena, benchBurst, localPlayerId: this.localPlayerId, startRoom, diagnostics, devBuild, devRelics });
  }

  /** Multiplayer: opens the lobby in the worker and connects the clients' connections to it. */
  hostLobby(net: HostNet, fixture: string | null, password: string, name: string, god: boolean, bot: boolean, profile?: Profile, progressionEnabled = false, diagnostics = false, dev: { seed?: number; startRoom?: number } = {}): void {
    this.net = net;
    net.onCtrl = (conn, msg) => this.post({ t: 'connCtrl', conn, msg });
    net.onInput = (conn, buf) => {
      const playerId = this.connPlayer.get(conn);
      if (playerId !== undefined) this.post({ t: 'input', playerId, buf }, [buf]);
    };
    net.onClosed = (conn) => {
      this.unbind(conn);
      this.post({ t: 'connClosed', conn });
    };
    this.post({ t: 'host', heaven: 1, fixture, password, name, god, bot, profile, progressionEnabled, diagnostics, devSeed: dev.seed, devStartRoom: dev.startRoom });
  }

  /** The host's `Start` in the Lobby. */
  startGame(): void {
    this.post({ t: 'startGame' });
  }

  get netStats(): HostNet['stats'] | null {
    return this.net?.stats ?? null;
  }

  /** One line per connected client: its player, round trip and route (the host's F3). */
  linkLines(): string[] {
    if (!this.net) return [];
    return this.net.links().map(({ conn, link }) => `P${this.connPlayer.get(conn) ?? '?'} ${link.text()}`);
  }

  /** Dev keys K and J: removes every enemy, or every Blessed (`blessedOnly`, screenshots). */
  killAll(blessedOnly = false): void {
    this.post({ t: 'killAll', blessedOnly });
  }

  /** Dev key G: toggles invulnerability for the local player. */
  toggleGod(): void {
    this.post({ t: 'toggleGod', playerId: this.localPlayerId });
  }

  /** Dev key I: fills the local player's item slots with the next pair of items. */
  devItems(): void {
    this.post({ t: 'devItems', playerId: this.localPlayerId });
  }

  /** Dev key B: the next development quick build for the local player. */
  devBuild(): void {
    this.post({ t: 'devBuild', playerId: this.localPlayerId });
  }

  /** Dev key R: a Rite offer for the local player now. */
  devRite(): void {
    this.post({ t: 'devRite', playerId: this.localPlayerId });
  }

  setPaused(paused: boolean): void {
    this.post({ t: 'pause', paused });
  }

  /** Average worker ms per tick over the last 1 s. */
  simMs(now: number): number {
    while (this.tickTimes.length && this.tickTimes[0][0] < now - 1000) this.tickTimes.shift();
    if (!this.tickTimes.length) return 0;
    let sum = 0;
    for (const [, ms] of this.tickTimes) sum += ms;
    return sum / this.tickTimes.length;
  }

  /**
   * Ends the session: terminates the worker and, in multiplayer, closes every connection and destroys
   * the PeerJS peer, after sending `leave` to every client if `sendLeave` (the host left).
   */
  stop(sendLeave = false): void {
    if (this.stopped) return;
    this.post({ t: 'stop' });
    this.stopped = true;
    this.worker.terminate();
    this.net?.destroy(sendLeave);
  }

  private unbind(conn: number): void {
    const playerId = this.connPlayer.get(conn);
    this.connPlayer.delete(conn);
    if (playerId !== undefined) this.playerConn.delete(playerId);
  }

  private onWorkerMessage(m: WorkerToMain): void {
    if (this.stopped) return;
    const net = this.net;
    switch (m.t) {
      case 'snap':
        if (m.to === this.localPlayerId) {
          this.tickTimes.push([performance.now(), m.simMs]);
          this.onTickMs(m.simMs);
          this.director = m.director ?? null;
          this.carrierChecks = m.carrierChecks ?? [];
          this.weaponKills = m.weaponKills ?? {};
          for (const buf of m.bufs) this.local.deliverSnapshot(buf);
        } else {
          // Forwarding is driven by worker messages, so it keeps full rate in a background tab (§2.2).
          const conn = this.playerConn.get(m.to);
          if (net && conn !== undefined) net.sendSnaps(conn, m.bufs);
        }
        break;
      case 'ctrl':
        if (m.to === 'all') {
          if (net) for (const conn of this.connPlayer.keys()) net.sendCtrl(conn, m.msg);
          this.local.deliverCtrl(m.msg);
        } else if (m.to === this.localPlayerId) this.local.deliverCtrl(m.msg);
        else {
          const conn = this.playerConn.get(m.to);
          if (net && conn !== undefined) net.sendCtrl(conn, m.msg);
        }
        break;
      case 'connCtrl':
        net?.sendCtrl(m.conn, m.msg);
        break;
      case 'bind':
        this.connPlayer.set(m.conn, m.playerId);
        this.playerConn.set(m.playerId, m.conn);
        break;
      case 'drop':
        this.unbind(m.conn);
        net?.close(m.conn);
        break;
      case 'heartbeat': {
        const loading = new Set<number>();
        for (const id of m.loading) {
          const conn = this.playerConn.get(id);
          if (conn !== undefined) loading.add(conn);
        }
        net?.heartbeat(loading);
        break;
      }
    }
  }
}
