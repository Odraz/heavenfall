/// <reference lib="webworker" />
/**
 * Web Worker entry that runs the host simulation (§2.2). In multiplayer it also owns the lobby
 * (§3): every `ctrl` message to or from the host is handled here.
 */
import { getDungeon } from '../data/dungeons/index';
import { cleanChat, Lobby } from '../net/lobby';
import type { CtrlMessage } from '../net/messages';
import { decodeInput } from '../net/protocol';
import { PING_MS } from '../net/peerConfig';
import { MAX_TICKS_PER_LOOP, TICK_MS } from './constants';
import { Simulation, type SimPlayerInit } from './sim';
import type { MainToWorker, WorkerToMain } from './workerMessages';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** Remote clients get a snapshot every 3rd tick: 10 Hz (§9.4). */
const REMOTE_SNAPSHOT_EVERY = 3;
/** How often the Loading timeout is checked. */
const LOAD_CHECK_MS = 250;

let sim: Simulation | null = null;
/** The host's own player, who gets a snapshot every tick. */
let localPlayerId = 0;
let running = false;
let paused = false;
let acc = 0;
let last = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

// Multiplayer
let lobby: Lobby | null = null;
let god = false;
const connPlayer = new Map<number, number>();
const playerConn = new Map<number, number>();
let heartbeatTimer: ReturnType<typeof setInterval> | undefined;
let loadTimer: ReturnType<typeof setInterval> | undefined;

function post(msg: WorkerToMain, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function send(to: number | 'all', msg: CtrlMessage): void {
  post({ t: 'ctrl', to, msg });
}

function flushEvents(): void {
  if (!sim) return;
  for (const e of sim.events) send(e.to, { type: 'event', event: e.event });
  sim.events.length = 0;
}

function runTick(): void {
  if (!sim) return;
  const t0 = performance.now();
  sim.step(t0);
  const parts = sim.encodeFor(localPlayerId);
  // Remote clients at 10 Hz, plus the last snapshot at the result (§3).
  const remote: Array<[number, ArrayBuffer[]]> = [];
  if (sim.tick % REMOTE_SNAPSHOT_EVERY === 0 || sim.result) {
    for (const p of sim.players) {
      if (p.id !== localPlayerId && p.connected) remote.push([p.id, sim.encodeFor(p.id)]);
    }
  }
  // A tick's measured time includes encoding that tick's snapshots (§2.2).
  const ms = performance.now() - t0;
  post({ t: 'snap', to: localPlayerId, bufs: parts, simMs: ms }, parts);
  for (const [to, bufs] of remote) post({ t: 'snap', to, bufs, simMs: ms }, bufs);
  flushEvents();
  // At the result the host sends one last snapshot and gameOver, then stops simulating (§3).
  if (sim.result) stopLoop();
}

function stopLoop(): void {
  running = false;
  if (timer !== undefined) clearTimeout(timer);
}

/** Fixed 30 Hz with an accumulator; at most 5 ticks per iteration, the rest of the backlog is discarded. */
function loop(): void {
  if (!running) return;
  const now = performance.now();
  if (!paused) acc += now - last;
  last = now;
  let n = 0;
  while (acc >= TICK_MS && n < MAX_TICKS_PER_LOOP) {
    runTick();
    acc -= TICK_MS;
    n++;
  }
  if (acc >= TICK_MS) acc %= TICK_MS;
  timer = setTimeout(loop, Math.max(1, TICK_MS - acc - 1));
}

function start(players: SimPlayerInit[], dungeonId: string, seed: number, godMode: boolean, bench: boolean, singleplayer: boolean, localId: number): void {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon) throw new Error(`Unknown dungeon ${dungeonId}`);
  sim = new Simulation({ dungeon, players, seed, god: godMode, bench, singleplayer });
  localPlayerId = localId;
  for (const p of sim.players) p.lastAcceptMs = performance.now();
  running = true;
  last = performance.now();
  acc = TICK_MS; // the first tick runs right away
  loop();
}

// ------------------------------------------------------------------ multiplayer lobby (§3)

function host(dungeonId: string, password: string, name: string, godMode: boolean): void {
  lobby = new Lobby({ dungeonId, password, version: __BUILD_VERSION__, hostName: name });
  god = godMode;
  localPlayerId = 0;
  send(0, lobby.lobbyMessage());
  heartbeatTimer = setInterval(() => post({ t: 'heartbeat', loading: lobby?.loadingIds() ?? [] }), PING_MS);
  // Players load at Loading, and later one at a time from the in-progress Lobby (M8 §6.2).
  loadTimer = setInterval(checkLoadTimeout, LOAD_CHECK_MS);
}

function broadcastLobby(): void {
  if (lobby) send('all', lobby.lobbyMessage());
}

/** A `hello` from a connection that has no player yet. */
function hello(conn: number, msg: Extract<CtrlMessage, { type: 'hello' }>): void {
  if (!lobby) return;
  const r = lobby.join(msg.name, msg.password, msg.version);
  if (!r.ok) {
    post({ t: 'connCtrl', conn, msg: { type: 'reject', reason: r.reason } });
    post({ t: 'drop', conn });
    return;
  }
  connPlayer.set(conn, r.playerId);
  playerConn.set(r.playerId, conn);
  post({ t: 'bind', conn, playerId: r.playerId });
  const { dungeonId, players } = lobby.lobbyMessage();
  send(r.playerId, { type: 'welcome', playerId: r.playerId, lobby: { dungeonId, players }, inProgress: r.inProgress });
  broadcastLobby();
}

/** A player's `ctrl` message (the host's own player included). */
function playerCtrl(playerId: number, msg: CtrlMessage): void {
  if (!lobby) return;
  switch (msg.type) {
    case 'pickClass':
      if (lobby.pickClass(playerId, msg.classId)) broadcastLobby();
      break;
    case 'ready': {
      const joiner = lobby.ready(playerId);
      if (!joiner) maybeGo();
      // A player from the in-progress Lobby joins the game now (M8 §6.2); `go` goes out before the
      // simulation's teleport placing them.
      else if (sim?.addPlayer(joiner)) {
        send(playerId, { type: 'go' });
        broadcastLobby();
      }
      break;
    }
    case 'enterGame': {
      const start = lobby.enterGame(playerId, performance.now());
      if (start && !sim?.result) {
        send(playerId, start);
        broadcastLobby();
      }
      break;
    }
    case 'chat': {
      // Trimmed, dropped if empty, cut to 120 characters (M8 §7).
      const text = cleanChat(msg.text);
      if (text) send('all', { type: 'chat', playerId, text });
      break;
    }
    case 'leave':
      playerGone(playerId);
      break;
  }
}

/**
 * A client left or disconnected (§3, §9.4). In the lobby it frees the slot and class; during Loading
 * it's dropped and the game starts without it; in the game its player is removed, soul and all. Every
 * client gets the new roster (M8 §6.2). The host leaving ends the session on the main thread instead.
 */
function playerGone(playerId: number): void {
  if (!lobby || playerId === 0) return;
  const conn = playerConn.get(playerId);
  if (conn !== undefined) {
    connPlayer.delete(conn);
    playerConn.delete(playerId);
    post({ t: 'drop', conn });
  }
  if (!lobby.remove(playerId)) return;
  if (lobby.phase === 'loading') maybeGo();
  else if (lobby.phase === 'game') sim?.removePlayer(playerId);
  broadcastLobby();
}

function startGame(): void {
  if (!lobby) return;
  const msg = lobby.start(performance.now());
  if (!msg) return;
  send('all', msg);
}

/** A client not ready 20 s after its `start` gets `reject { reason: 'load_timeout' }` and is dropped (§3). */
function checkLoadTimeout(): void {
  if (!lobby) return;
  for (const id of lobby.loadTimedOut(performance.now())) {
    send(id, { type: 'reject', reason: 'load_timeout' });
    playerGone(id);
  }
}

/** When every player still connected is ready, the host sends `go` and the game starts (§3). */
function maybeGo(): void {
  if (!lobby?.allReady()) return;
  const players = lobby.go();
  send('all', { type: 'go' });
  start(players, lobby.dungeonId, (Math.random() * 2 ** 32) >>> 0, god, false, false, 0);
}

ctx.onmessage = (e: MessageEvent<MainToWorker>) => {
  const m = e.data;
  switch (m.t) {
    case 'start':
      start(m.players, m.dungeonId, m.seed, m.god, m.bench, m.singleplayer, m.localPlayerId);
      break;
    case 'host':
      host(m.dungeonId, m.password, m.name, m.god);
      break;
    case 'startGame':
      startGame();
      break;
    case 'ctrl':
      playerCtrl(m.playerId, m.msg);
      break;
    case 'connCtrl': {
      const playerId = connPlayer.get(m.conn);
      if (playerId !== undefined) playerCtrl(playerId, m.msg);
      else if (m.msg.type === 'hello') hello(m.conn, m.msg);
      break;
    }
    case 'connClosed': {
      const playerId = connPlayer.get(m.conn);
      if (playerId !== undefined) playerGone(playerId);
      break;
    }
    case 'input': {
      const input = decodeInput(m.buf);
      if (sim && input) sim.applyInput(m.playerId, input, performance.now());
      break;
    }
    case 'pause':
      paused = m.paused;
      break;
    case 'killAll':
      sim?.killAll();
      break;
    case 'toggleGod':
      sim?.toggleDevGod(m.playerId);
      break;
    case 'stop':
      stopLoop();
      clearInterval(heartbeatTimer);
      clearInterval(loadTimer);
      sim = null;
      lobby = null;
      break;
  }
};
