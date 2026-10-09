/**
 * The host side on the main thread (§2.2): owns the simulation worker and the host player's
 * LocalTransport and, in multiplayer, relays between the worker and the clients' PeerJS connections.
 */
import type { HostNet } from '../net/hostNet';
import { LocalTransport } from '../net/transport';
import type { DirectorInfo } from '../sim/director';
import type { SimPlayerInit } from '../sim/sim';
import type { MainToWorker, WorkerToMain } from '../sim/workerMessages';

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
  start(dungeonId: string, players: SimPlayerInit[], seed: number, god: boolean, benchArena: number, singleplayer: boolean, benchBurst = false, startArena = 0): void {
    this.post({ t: 'start', dungeonId, players, seed, god, benchArena, benchBurst, singleplayer, localPlayerId: this.localPlayerId, startArena });
  }

  /** Multiplayer: opens the lobby in the worker and connects the clients' connections to it. */
  hostLobby(net: HostNet, dungeonId: string, password: string, name: string, god: boolean): void {
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
    this.post({ t: 'host', dungeonId, password, name, god });
  }

  /** The host's `Start` in the Lobby. */
  startGame(): void {
    this.post({ t: 'startGame' });
  }

  get netStats(): HostNet['stats'] | null {
    return this.net?.stats ?? null;
  }

  /** Dev keys K and J: removes every enemy, or every Blessed (`blessedOnly`, screenshots). */
  killAll(blessedOnly = false): void {
    this.post({ t: 'killAll', blessedOnly });
  }

  /** Dev key G: toggles invulnerability for the local player. */
  toggleGod(): void {
    this.post({ t: 'toggleGod', playerId: this.localPlayerId });
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
          for (const buf of m.bufs) this.local.deliverSnapshot(buf);
        } else {
          // Forwarding is driven by worker messages, so it keeps full rate in a background tab (§2.2).
          const conn = this.playerConn.get(m.to);
          if (net && conn !== undefined) for (const buf of m.bufs) net.sendSnap(conn, buf);
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
