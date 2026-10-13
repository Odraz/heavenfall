/// <reference lib="webworker" />
/**
 * Web Worker entry that runs the host simulation (§2.2). In multiplayer it also owns the lobby
 * (§3): every `ctrl` message to or from the host is handled here.
 */
import { cleanChat, Lobby } from '../net/lobby';
import type { CtrlMessage } from '../net/messages';
import { decodeInput } from '../net/protocol';
import { PING_MS } from '../net/peerConfig';
import { MAX_TICKS_PER_LOOP, TICK_MS } from './constants';
import { Simulation } from './sim';
import { loadRunMap } from './runMap';
import { propDefs } from '../data/props';
import { localSnap, type MainToWorker, type WorkerToMain } from './workerMessages';
import { RunRecords, SettlementCache } from '../net/runRecords';
import { validateProfile, type Profile } from '../profile/model';
import { copyInventory } from '../data/items';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

/** Remote clients get a snapshot every 3rd tick: 10 Hz (§9.4). */
const REMOTE_SNAPSHOT_EVERY = 3;
/** How often the Loading timeout is checked. */
const LOAD_CHECK_MS = 250;

let sim: Simulation | null = null;
let runId = '';
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
let records: RunRecords | null = null;
const completed = new SettlementCache();
const admissionReady = new Set<number>();
const assetsReady = new Set<number>();
let pendingSolo: Extract<MainToWorker, { t: 'start' }> | null = null;

function validProfile(input: unknown): Profile | undefined {
  try { return validateProfile(input).profile; } catch { return undefined; }
}
function checkpoint(force = false): void {
  if (!sim || !records) return;
  const shouldSend = force || sim.tick % 30 === 0 || sim.events.some(e => e.event.type === 'roomState');
  for (const r of records.records.values()) {
    if (r.closed) continue;
    const p = sim.players.find(p => p.id === r.playerId) ?? sim.retainedPlayers.get(r.playerId)?.player;
    if (p) { r.runXp = p.runXp; r.wallet = p.wallet; r.inventory = copyInventory(p.inventory); r.itemsTried = [...p.itemsTried]; }
    if (!r.committed || r.closed) continue;
    if (sim.result) send(r.playerId, { type: 'progress', state: records.settle(r, sim.result) });
    else if (shouldSend && r.connected) send(r.playerId, { type: 'progress', state: records.state(r) });
  }
  if (sim.result) completed.save(records);
}

function post(msg: WorkerToMain, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function send(to: number | 'all', msg: CtrlMessage): void {
  post({ t: 'ctrl', to, msg });
}

function flushEvents(): void {
  if (!sim) return;
  for (const e of sim.events) send(e.to, { type: 'event', runId, tick: e.tick, revision: e.revision, event: e.event });
  sim.events.length = 0;
}

function runTick(): void {
  if (!sim) return;
  const t0 = performance.now();
  sim.step(t0);
  checkpoint();
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
  post(localSnap(sim, localPlayerId, parts, ms), parts);
  for (const [to, bufs] of remote) post({ t: 'snap', to, bufs, simMs: ms }, bufs);
  flushEvents();
  // At the result the host sends one last snapshot and gameOver, then stops simulating (§3). In
  // multiplayer the lobby opens again.
  if (sim.result) {
    stopLoop();
    if (lobby) {
      sim = null;
      lobby.endGame();
      broadcastLobby();
    }
  }
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
    if (!running) return;
  }
  if (acc >= TICK_MS) acc %= TICK_MS;
  timer = setTimeout(loop, Math.max(1, TICK_MS - acc - 1));
}

function start(m: Extract<MainToWorker, { t: 'start' }>): void {
  stopLoop();
  const { def, map, floor } = loadRunMap(m);
  sim = new Simulation({
    dungeon: def, map, props: propDefs(floor), runId: m.runId, players: m.players, seed: m.simSeed, god: !m.progressionEnabled && m.god, benchRoom: m.benchArena, benchBurst: m.benchBurst,
    startRoom: m.startRoom, progressionEnabled: m.progressionEnabled,
  });
  runId = m.runId;
  localPlayerId = m.localPlayerId;
  for (const r of records?.records.values() ?? []) if (!r.closed) send(r.playerId, { type: 'progress', state: records!.commit(r) });
  send('all', { type: 'go' });
  for (const p of sim.players) send(p.id, sim.floorSync(runId));
  paused = false;
  for (const p of sim.players) p.lastAcceptMs = performance.now();
  running = true;
  last = performance.now();
  acc = TICK_MS; // the first tick runs right away
  loop();
}

// ------------------------------------------------------------------ multiplayer lobby (§3)

function host(m: Extract<MainToWorker, { t: 'host' }>): void {
  lobby = new Lobby({ heaven: m.heaven, fixture: m.fixture, password: m.password, version: __BUILD_VERSION__, hostName: m.name, hostBot: m.bot,
    profile: m.bot ? undefined : validProfile(m.profile), progressionEnabled: m.progressionEnabled });
  god = m.god;
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
  const profile = msg.bot ? undefined : validProfile(msg.profile);
  if (lobby.progressionEnabled && !msg.bot && !profile) {
    post({ t: 'connCtrl', conn, msg: { type: 'reject', reason: 'version' } }); post({ t: 'drop', conn }); return;
  }
  const r = lobby.join(msg.name, msg.password, msg.version, msg.bot, profile);
  if (!r.ok) {
    post({ t: 'connCtrl', conn, msg: { type: 'reject', reason: r.reason } });
    post({ t: 'drop', conn });
    return;
  }
  connPlayer.set(conn, r.playerId);
  playerConn.set(r.playerId, conn);
  post({ t: 'bind', conn, playerId: r.playerId });
  const { heaven, fixture, players } = lobby.lobbyMessage();
  send(r.playerId, { type: 'welcome', playerId: r.playerId, lobby: { heaven, fixture, players }, inProgress: r.inProgress });
  broadcastLobby();
}

/** A player's `ctrl` message (the host's own player included). */
function playerCtrl(playerId: number, msg: CtrlMessage): void {
  if (msg.type === 'admissionReady') {
    const r = records?.ready(playerId, msg.runId, msg.admissionId);
    if (!r) return;
    admissionReady.add(playerId);
    if (pendingSolo) { const pending = pendingSolo; pendingSolo = null; start(pending); }
    else if (assetsReady.has(playerId)) acceptReady(playerId);
    return;
  }
  if (msg.type === 'admissionRejected') {
    const r = records?.ready(playerId, msg.runId, msg.admissionId);
    if (r && !r.committed) send(playerId, { type: 'progress', state: records!.settle(r, 'admissionAborted') });
    pendingSolo = null;
    if (playerId !== 0) playerGone(playerId, true);
    return;
  }
  if (msg.type === 'recover') {
    const profile = lobby?.profile(playerId);
    if (profile?.id !== msg.profileId) return;
    const live = records?.runId === msg.runId ? records.records.get(msg.profileId) : undefined;
    send(playerId, { type: 'recovery', runId: msg.runId, state: live ? records!.state(live) : completed.get(msg.runId, msg.profileId) }); return;
  }
  if (!lobby) return;
  switch (msg.type) {
    case 'loadout': {
      const profile = validProfile(msg.profile);
      if (profile && lobby.setProfile(playerId, profile)) broadcastLobby();
      break;
    }
    case 'pickClass':
      if (lobby.phase === 'game' && records?.byPlayer(playerId)) break;
      if (lobby.pickClass(playerId, msg.classId)) broadcastLobby();
      break;
    case 'ready': {
      assetsReady.add(playerId);
      if (!records?.byPlayer(playerId) || admissionReady.has(playerId)) acceptReady(playerId);
      break;
    }
    case 'backToLobby':
      if (lobby.backToLobby(playerId)) broadcastLobby();
      break;
    case 'enterGame': {
      const known = records?.byPlayer(playerId);
      if (known?.closed || !known && sim && (sim.result || sim.map.rooms[sim.activeRoom]?.boss)) break;
      const start = lobby.enterGame(playerId, performance.now());
      if (start) {
        if (!reservePlayer(start, playerId)) break;
        send(playerId, start);
        const r = records?.byPlayer(playerId); if (r) send(playerId, { type: 'admission', admission: records!.admission(r) });
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
      playerGone(playerId, true);
      break;
  }
}

function acceptReady(playerId: number): void {
  if (!lobby) return;
  const joiner = lobby.ready(playerId);
  if (!joiner) maybeGo();
  else if (sim?.addPlayer({ ...joiner, profile: lobby.profile(playerId) })) {
    const r = records?.byPlayer(playerId); if (r) send(playerId, { type: 'progress', state: records!.commit(r) });
    send(playerId, { type: 'go' }); send(playerId, sim.floorSync(runId)); broadcastLobby();
  }
}
function reservePlayer(start: Extract<CtrlMessage, { type: 'start' }>, id: number): boolean {
  const p = start.players.find(p => p.id === id), profile = lobby?.profile(id);
  if (!p || p.bot || !profile) return !start.progressionEnabled || !!p?.bot;
  try { records!.reserve(id, p.classId, profile, lobby?.phase === 'loading'); return true; }
  catch { send(id, { type: 'reject', reason: 'version' }); return false; }
}

/**
 * A client left or disconnected (§3, §9.4). In the lobby it frees the slot and class; during Loading
 * it's dropped and the game starts without it; in the game its player is removed, soul and all. Every
 * client gets the new roster (M8 §6.2). The host leaving ends the session on the main thread instead.
 */
function playerGone(playerId: number, voluntary = false): void {
  if (!lobby || playerId === 0) return;
  checkpoint(true);
  const r = records?.byPlayer(playerId);
  if (r) {
    r.connected = false;
    if (!r.committed || voluntary) send(playerId, { type: 'progress', state: records!.settle(r, r.committed ? 'leave' : 'admissionAborted') });
  }
  const conn = playerConn.get(playerId);
  if (conn !== undefined) {
    connPlayer.delete(conn);
    playerConn.delete(playerId);
    post({ t: 'drop', conn });
  }
  if (!lobby.remove(playerId, !!r?.committed && !voluntary)) return;
  if (lobby.phase === 'loading') maybeGo();
  else if (lobby.phase === 'game') sim?.removePlayer(playerId, !!r?.committed && !voluntary);
  assetsReady.delete(playerId); admissionReady.delete(playerId);
  broadcastLobby();
}

function startGame(): void {
  if (!lobby) return;
  const msg = lobby.start(performance.now());
  if (!msg) return;
  records = new RunRecords(msg.runId, msg.progressionEnabled); assetsReady.clear(); admissionReady.clear();
  for (const p of msg.players) if (!reservePlayer(msg, p.id)) return;
  send('all', msg);
  for (const r of records.records.values()) send(r.playerId, { type: 'admission', admission: records.admission(r) });
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
  const players = lobby.go().map(p => ({ ...p, profile: lobby!.profile(p.id) }));
  start({ ...lobby.run!, t: 'start', players, god, benchArena: -1, benchBurst: false, localPlayerId: 0 });
}

ctx.onmessage = (e: MessageEvent<MainToWorker>) => {
  const m = e.data;
  switch (m.t) {
    case 'start':
      records = new RunRecords(m.runId, m.progressionEnabled);
      for (const p of m.players) if (!p.bot && p.profile) records.reserve(p.id, p.classId, p.profile, true);
      if (m.progressionEnabled) {
        const r = records.byPlayer(m.localPlayerId); if (!r) break;
        pendingSolo = m; send(m.localPlayerId, { type: 'admission', admission: records.admission(r) });
      } else start(m);
      break;
    case 'host':
      host(m);
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
      if (!sim) break;
      const input = decodeInput(m.buf, runId);
      if (sim && input) sim.applyInput(m.playerId, input, performance.now());
      break;
    }
    case 'pause':
      paused = m.paused;
      break;
    case 'killAll':
      sim?.killAll(m.blessedOnly);
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
      runId = '';
      connPlayer.clear();
      playerConn.clear();
      break;
  }
};
