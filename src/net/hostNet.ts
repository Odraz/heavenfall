/**
 * The host's PeerJS side, on the main thread (§2.2, §9.1): registers the game ID, accepts each
 * client's `ctrl` and `snap` connections, runs the heartbeat, and moves bytes between the
 * connections and the host session, which relays them to and from the simulation worker.
 */
import Peer, { type BufferedConnection, type DataConnection } from 'peerjs';
import { hostPeerId, randomGameId, REGISTER_ATTEMPTS } from './gameId';
import type { CtrlMessage } from './messages';
import { jsonBytes, NetStats } from './netStats';
import { FLUSH_MS, PEER_OPTIONS, PEER_TIMEOUT_MS, SNAP_BUFFER_LIMIT, STALL_MS } from './peerConfig';

/** How long the host waits for the signaling server to confirm a game ID. */
const REGISTER_TIMEOUT_MS = 10000;
/** After losing the signaling server, the host retries this often, so new clients can still join. */
const RECONNECT_MS = 3000;

interface Remote {
  /** The connection's key for the host session and the worker. */
  conn: number;
  peer: string;
  ctrl: DataConnection | null;
  snap: DataConnection | null;
  /** performance.now() when anything last arrived on either channel. */
  lastHeard: number;
  closed: boolean;
}

/** Thrown when the game can't be created: `Couldn't reach the matchmaking server` (§3). */
export class HostError extends Error {}

/** Opens a peer with the given ID; resolves with it, or with the PeerJS error type on failure. */
function openPeer(id: string): Promise<{ peer: Peer } | { error: string }> {
  return new Promise((resolve) => {
    const peer = new Peer(id, PEER_OPTIONS);
    const timer = setTimeout(() => done({ error: 'timeout' }), REGISTER_TIMEOUT_MS);
    let settled = false;
    const done = (r: { peer: Peer } | { error: string }): void => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if ('error' in r) peer.destroy();
      resolve(r);
    };
    peer.on('open', () => done({ peer }));
    peer.on('error', (e) => done({ error: e.type }));
  });
}

/**
 * Registers a random game ID as the peer ID `heavenfall-<ID>`, trying a new ID on `unavailable-id`,
 * up to 5 attempts (§9.1). `cancelled` is checked after each attempt.
 */
export async function createHostNet(cancelled: () => boolean = () => false): Promise<HostNet> {
  for (let attempt = 0; attempt < REGISTER_ATTEMPTS; attempt++) {
    const gameId = randomGameId();
    const r = await openPeer(hostPeerId(gameId));
    if ('peer' in r) {
      if (cancelled()) {
        r.peer.destroy();
        throw new HostError('cancelled');
      }
      return new HostNet(r.peer, gameId);
    }
    if (cancelled()) throw new HostError('cancelled');
    if (r.error !== 'unavailable-id') break;
  }
  throw new HostError("Couldn't reach the matchmaking server");
}

export class HostNet {
  readonly stats = new NetStats();
  /** A `ctrl` message from a connection (pings are handled here). */
  onCtrl: (conn: number, msg: CtrlMessage) => void = () => {};
  /** An input message from a connection's `snap` channel. */
  onInput: (conn: number, buf: ArrayBuffer) => void = () => {};
  /** A connection closed or timed out. */
  onClosed: (conn: number) => void = () => {};
  private readonly remotes = new Map<number, Remote>();
  private nextConn = 1;
  private destroyed = false;
  private lastBeat = performance.now();
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;

  constructor(
    private readonly peer: Peer,
    readonly gameId: string,
  ) {
    peer.on('connection', (dc) => this.accept(dc));
    // Existing connections survive losing the signaling server, but new clients need it.
    peer.on('disconnected', () => this.scheduleReconnect());
    peer.on('error', () => {
      if (this.peer.disconnected) this.scheduleReconnect();
    });
  }

  private scheduleReconnect(): void {
    if (this.destroyed || this.reconnectTimer !== undefined) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      if (this.destroyed || !this.peer.disconnected) return;
      try {
        this.peer.reconnect();
      } catch {
        this.scheduleReconnect();
      }
    }, RECONNECT_MS);
  }

  /** A client's connection: its `ctrl` and `snap` channels are paired by the client's peer ID. */
  private accept(dc: DataConnection): void {
    if (this.destroyed) {
      dc.close();
      return;
    }
    let r = [...this.remotes.values()].find((q) => q.peer === dc.peer && !q.closed);
    if (!r) {
      r = { conn: this.nextConn++, peer: dc.peer, ctrl: null, snap: null, lastHeard: performance.now(), closed: false };
      this.remotes.set(r.conn, r);
    }
    const remote = r;
    if (dc.label === 'ctrl' && !remote.ctrl) remote.ctrl = dc;
    else if (dc.label === 'snap' && !remote.snap) remote.snap = dc;
    else {
      dc.close();
      return;
    }
    dc.on('data', (data) => this.receive(remote, dc, data));
    dc.on('close', () => this.lose(remote));
    // Fatal errors also close the connection; the rest (such as a send before it opened) don't matter.
    dc.on('error', () => {});
  }

  private receive(r: Remote, dc: DataConnection, data: unknown): void {
    if (r.closed) return;
    const now = performance.now();
    r.lastHeard = now;
    if (dc === r.snap) {
      if (!(data instanceof ArrayBuffer)) return;
      this.stats.received(data.byteLength, now);
      this.onInput(r.conn, data);
      return;
    }
    if (typeof data !== 'object' || data === null || typeof (data as { type?: unknown }).type !== 'string') return;
    this.stats.received(jsonBytes(data), now);
    const msg = data as CtrlMessage;
    if (msg.type === 'ping') return;
    this.onCtrl(r.conn, msg);
  }

  /** Closes a connection the host lost: the other side closed it or it timed out. */
  private lose(r: Remote): void {
    if (r.closed) return;
    r.closed = true;
    this.remotes.delete(r.conn);
    r.ctrl?.close();
    r.snap?.close();
    this.onClosed(r.conn);
  }

  sendCtrl(conn: number, msg: CtrlMessage): void {
    const dc = this.remotes.get(conn)?.ctrl;
    if (!dc?.open) return;
    dc.send(msg);
    this.stats.sent(jsonBytes(msg));
  }

  /**
   * Sends a snapshot part, unless the client's `snap` channel has more than 64 KB buffered, so a slow
   * connection can't build up lag (§9.1).
   */
  sendSnap(conn: number, buf: ArrayBuffer): void {
    const dc = this.remotes.get(conn)?.snap;
    if (!dc?.open) return;
    // Raw connections are buffered ones: PeerJS queues sends itself once the channel is full.
    if (dc.dataChannel.bufferedAmount > SNAP_BUFFER_LIMIT || (dc as BufferedConnection).bufferSize > 0) return;
    dc.send(buf);
    this.stats.sent(buf.byteLength);
  }

  /**
   * Closes a connection on the host's initiative (after `reject`, or a player who left): its last
   * messages go out first. The host session isn't told; it already knows.
   */
  close(conn: number): void {
    const r = this.remotes.get(conn);
    if (!r || r.closed) return;
    r.closed = true;
    this.remotes.delete(conn);
    setTimeout(() => {
      r.ctrl?.close();
      r.snap?.close();
    }, FLUSH_MS);
  }

  /**
   * Every 1 s: `ping` to every client, and disconnect those silent for 5 s (§9.1), except `loading`
   * connections, whose clients are between `start` and `ready`: loading can block a browser for
   * seconds, and the 20 s Loading timeout covers them (§3). If this heartbeat comes late, the host's own
   * main thread was blocked and couldn't have heard anyone, so every client gets a fresh 5 s.
   */
  heartbeat(loading: ReadonlySet<number>, now = performance.now()): void {
    const stalled = now - this.lastBeat > STALL_MS;
    this.lastBeat = now;
    for (const r of [...this.remotes.values()]) {
      if (stalled || loading.has(r.conn)) r.lastHeard = Math.max(r.lastHeard, now);
      if (now - r.lastHeard > PEER_TIMEOUT_MS) {
        this.lose(r);
        continue;
      }
      this.sendCtrl(r.conn, { type: 'ping' });
    }
  }

  /**
   * Ends the session: optionally sends `leave` to every client, then closes every connection and
   * destroys the peer once those have gone out.
   */
  destroy(sendLeave: boolean): void {
    if (this.destroyed) return;
    if (sendLeave) for (const r of this.remotes.values()) this.sendCtrl(r.conn, { type: 'leave' });
    this.destroyed = true;
    clearTimeout(this.reconnectTimer);
    for (const r of this.remotes.values()) r.closed = true;
    this.remotes.clear();
    const peer = this.peer;
    if (sendLeave) setTimeout(() => peer.destroy(), FLUSH_MS);
    else peer.destroy();
  }
}
