/** The host side on the main thread: owns the simulation worker and the host player's LocalTransport (§2.2). */
import { LocalTransport } from '../net/transport';
import type { SimPlayerInit } from '../sim/sim';
import type { MainToWorker, WorkerToMain } from '../sim/workerMessages';

export class HostSession {
  readonly worker: Worker;
  readonly local: LocalTransport;
  /** Per-tick worker times (ms) with their arrival times, for the last 1 s. */
  private readonly tickTimes: Array<[number, number]> = [];
  /** Called with each tick's simulation time (ms). */
  onTickMs: (ms: number) => void = () => {};

  constructor(readonly localPlayerId: number) {
    this.worker = new Worker(new URL('../sim/worker.ts', import.meta.url), { type: 'module' });
    this.local = new LocalTransport(localPlayerId, this.worker);
    this.worker.onmessage = (e: MessageEvent<WorkerToMain>) => this.onWorkerMessage(e.data);
  }

  private post(msg: MainToWorker): void {
    this.worker.postMessage(msg);
  }

  start(dungeonId: string, players: SimPlayerInit[], seed: number, god: boolean, bench: boolean, singleplayer: boolean): void {
    this.post({ t: 'start', dungeonId, players, seed, god, bench, singleplayer, localPlayerId: this.localPlayerId });
  }

  killAll(): void {
    this.post({ t: 'killAll' });
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

  stop(): void {
    this.post({ t: 'stop' });
    this.worker.terminate();
  }

  private onWorkerMessage(m: WorkerToMain): void {
    if (m.t === 'snap') {
      if (m.to === this.localPlayerId) {
        this.tickTimes.push([performance.now(), m.simMs]);
        this.onTickMs(m.simMs);
        for (const buf of m.bufs) this.local.deliverSnapshot(buf);
      }
    } else if (m.to === 'all' || m.to === this.localPlayerId) {
      this.local.deliverCtrl(m.msg);
    }
  }
}
