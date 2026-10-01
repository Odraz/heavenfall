/// <reference lib="webworker" />
/** Web Worker entry that runs the host simulation (§2.2). */
import { getDungeon } from '../data/dungeons/index';
import type { CtrlMessage } from '../net/messages';
import { decodeInput } from '../net/protocol';
import { MAX_TICKS_PER_LOOP, TICK_MS } from './constants';
import { Simulation, type SimPlayerInit } from './sim';
import type { MainToWorker, WorkerToMain } from './workerMessages';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let sim: Simulation | null = null;
/** The host's own player, who gets a snapshot every tick. */
let localPlayerId = 0;
let running = false;
let paused = false;
let acc = 0;
let last = 0;
let timer: ReturnType<typeof setTimeout> | undefined;

function post(msg: WorkerToMain, transfer: Transferable[] = []): void {
  ctx.postMessage(msg, transfer);
}

function flushEvents(): void {
  if (!sim) return;
  for (const e of sim.events) {
    const msg: CtrlMessage = { type: 'event', event: e.event };
    post({ t: 'ctrl', to: e.to, msg });
  }
  sim.events.length = 0;
}

function runTick(): void {
  if (!sim) return;
  const t0 = performance.now();
  sim.step(t0);
  const parts = sim.encodeFor(localPlayerId);
  const ms = performance.now() - t0;
  flushEvents();
  post({ t: 'snap', to: localPlayerId, bufs: parts, simMs: ms }, parts);
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

function start(players: SimPlayerInit[], dungeonId: string, seed: number, god: boolean, bench: boolean, localId: number): void {
  const dungeon = getDungeon(dungeonId);
  if (!dungeon) throw new Error(`Unknown dungeon ${dungeonId}`);
  sim = new Simulation({ dungeon, players, seed, god, bench });
  localPlayerId = localId;
  for (const p of sim.players) p.lastAcceptMs = performance.now();
  running = true;
  last = performance.now();
  acc = TICK_MS; // the first tick runs right away
  loop();
}

ctx.onmessage = (e: MessageEvent<MainToWorker>) => {
  const m = e.data;
  switch (m.t) {
    case 'start':
      start(m.players, m.dungeonId, m.seed, m.god, m.bench, m.localPlayerId);
      break;
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
    case 'stop':
      running = false;
      if (timer !== undefined) clearTimeout(timer);
      sim = null;
      break;
  }
};
