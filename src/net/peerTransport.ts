/**
 * A remote client's connection to the host (§2.2, §9.1): two PeerJS DataConnections, `ctrl`
 * (reliable, JSON) and `snap` (unordered, raw ArrayBuffers), and the heartbeat.
 */
import Peer, { type DataConnection } from 'peerjs';
import { hostPeerId } from './gameId';
import type { CtrlMessage, LobbyPlayer, RejectReason } from './messages';
import { jsonBytes, NetStats } from './netStats';
import { FLUSH_MS, LOADING_PEER_TIMEOUT_MS, PEER_OPTIONS, PEER_TIMEOUT_MS, PING_MS, STALL_MS } from './peerConfig';
import type { Transport } from './transport';

/** `Join` fails if there's no `welcome` within this long (§3). */
const WELCOME_TIMEOUT_MS = 10000;

const REJECT_TEXT: Record<RejectReason, string> = {
  bad_password: 'Wrong password',
  full: 'Game is full',
  in_progress: 'Game already started',
  version: 'Version mismatch',
  load_timeout: 'Connection failed',
};

/** Thrown by `joinGame` with the error text the Join screen shows (§3). */
export class JoinError extends Error {}

export interface Joined {
  transport: PeerTransport;
  playerId: number;
  lobby: { dungeonId: string; players: LobbyPlayer[] };
}

function isCtrl(data: unknown): data is CtrlMessage {
  return typeof data === 'object' && data !== null && typeof (data as { type?: unknown }).type === 'string';
}

export class PeerTransport implements Transport {
  readonly stats = new NetStats();
  onSnapshot: (buf: ArrayBuffer) => void = () => {};
  /** The host left: `leave`, a heartbeat timeout, or the connection closed (§9.4). Called once. */
  onHostLeft: () => void = () => {};
  private ctrlHandler: ((msg: CtrlMessage) => void) | null = null;
  /** `ctrl` messages that arrived before anyone listened. */
  private readonly queued: CtrlMessage[] = [];
  private lastHeard = performance.now();
  private pingTimer: ReturnType<typeof setInterval> | undefined;
  private lastBeat = 0;
  private closed = false;
  /** Between `start` and `go`: the host may be loading too, so a longer silence is allowed. */
  loading = false;

  constructor(
    private readonly peer: Peer,
    private readonly ctrl: DataConnection,
    private readonly snap: DataConnection,
  ) {
    ctrl.on('data', (data) => {
      if (this.closed || !isCtrl(data)) return;
      const now = performance.now();
      this.lastHeard = now;
      this.stats.received(jsonBytes(data), now);
      if (data.type === 'ping') return;
      if (data.type === 'leave') {
        this.hostLeft();
        return;
      }
      if (this.ctrlHandler) this.ctrlHandler(data);
      else this.queued.push(data);
    });
    snap.on('data', (data) => {
      if (this.closed || !(data instanceof ArrayBuffer)) return;
      const now = performance.now();
      this.lastHeard = now;
      this.stats.received(data.byteLength, now);
      this.onSnapshot(data);
    });
    for (const dc of [ctrl, snap]) {
      dc.on('close', () => this.hostLeft());
      dc.on('error', () => {});
    }
  }

  get onCtrl(): (msg: CtrlMessage) => void {
    return this.ctrlHandler ?? (() => {});
  }

  /** Setting a handler delivers the messages that arrived before it. */
  set onCtrl(fn: (msg: CtrlMessage) => void) {
    this.ctrlHandler = fn;
    while (this.queued.length && this.ctrlHandler === fn && !this.closed) fn(this.queued.shift()!);
  }

  /** Removes the `ctrl` handler: messages wait until the next one is set. */
  holdCtrl(): void {
    this.ctrlHandler = null;
  }

  /**
   * Starts the heartbeat: `ping` every 1 s, and the host is gone after 5 s of silence (§9.1). A late
   * check means this page was blocked and couldn't have heard the host, so that time doesn't count.
   */
  startHeartbeat(): void {
    if (this.pingTimer !== undefined) return;
    this.lastHeard = this.lastBeat = performance.now();
    this.pingTimer = setInterval(() => {
      const now = performance.now();
      if (now - this.lastBeat > STALL_MS) this.lastHeard = Math.max(this.lastHeard, now);
      this.lastBeat = now;
      if (now - this.lastHeard > (this.loading ? LOADING_PEER_TIMEOUT_MS : PEER_TIMEOUT_MS)) this.hostLeft();
      else this.sendCtrl({ type: 'ping' });
    }, PING_MS);
  }

  private hostLeft(): void {
    if (this.closed) return;
    this.close();
    this.onHostLeft();
  }

  sendInput(buf: ArrayBuffer): void {
    if (this.closed || !this.snap.open) return;
    this.snap.send(buf);
    this.stats.sent(buf.byteLength);
  }

  sendCtrl(msg: CtrlMessage): void {
    if (this.closed || !this.ctrl.open) return;
    this.ctrl.send(msg);
    this.stats.sent(jsonBytes(msg));
  }

  /** Closes the connection; messages already sent (such as `leave`) go out first. */
  close(): void {
    if (this.closed) return;
    this.closed = true;
    clearInterval(this.pingTimer);
    this.queued.length = 0;
    const peer = this.peer;
    setTimeout(() => peer.destroy(), FLUSH_MS);
  }
}

/**
 * Joins a game (§3): connects `ctrl` and `snap` to the host's peer, sends `hello`, and resolves on
 * `welcome` once both channels are open. Rejects with a `JoinError` carrying the Join screen's text.
 * `cancelled` stops the attempt (the player pressed `Back`).
 */
export function joinGame(gameId: string, name: string, password: string, cancelled: () => boolean = () => false): Promise<Joined> {
  return new Promise((resolve, reject) => {
    const peer = new Peer(PEER_OPTIONS);
    let settled = false;
    let ctrl: DataConnection | null = null;
    let snap: DataConnection | null = null;
    let welcome: Extract<CtrlMessage, { type: 'welcome' }> | null = null;
    let transport: PeerTransport | null = null;
    const timer = setTimeout(() => fail('Connection failed'), WELCOME_TIMEOUT_MS);
    const cancelTimer = setInterval(() => {
      if (cancelled()) fail('cancelled');
    }, 100);

    function fail(text: string): void {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(cancelTimer);
      peer.destroy();
      reject(new JoinError(text));
    }

    function maybeDone(): void {
      if (settled || !welcome || !snap?.open || !transport) return;
      settled = true;
      clearTimeout(timer);
      clearInterval(cancelTimer);
      transport.startHeartbeat();
      resolve({ transport, playerId: welcome.playerId, lobby: welcome.lobby });
    }

    peer.on('error', (e) => fail(e.type === 'peer-unavailable' ? 'Game not found' : 'Connection failed'));
    peer.on('open', () => {
      if (settled) return;
      const host = hostPeerId(gameId);
      ctrl = peer.connect(host, { label: 'ctrl', reliable: true, serialization: 'json' });
      snap = peer.connect(host, { label: 'snap', reliable: false, serialization: 'raw' });
      transport = new PeerTransport(peer, ctrl, snap);
      transport.onHostLeft = () => fail('Connection failed');
      // Until `welcome`, `ctrl` answers the hello; afterwards the transport's handler takes over.
      transport.onCtrl = (msg) => {
        if (settled) return;
        if (msg.type === 'welcome') {
          welcome = msg;
          // Messages after `welcome` wait in the transport's queue for the Lobby.
          transport!.holdCtrl();
          maybeDone();
        } else if (msg.type === 'reject') fail(REJECT_TEXT[msg.reason] ?? 'Connection failed');
      };
      ctrl.on('open', () => transport!.sendCtrl({ type: 'hello', name, password, version: __BUILD_VERSION__ }));
      snap.on('open', () => maybeDone());
    });
  });
}
