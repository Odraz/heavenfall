/** Benchmark measurement (§2.5, §12): starts when 1 500 Blessed are alive for the first time, lasts 30 s. */
import { MAX_LIVING_ENEMIES } from '../sim/constants';
import type { Snapshot } from '../net/protocol';
import type { HostSession } from './hostSession';

const DURATION_MS = 30000;

export interface BenchResult {
  fps: number;
  fpsLow: number;
  simMs: number;
  simMsMax: number;
}

export class BenchRunner {
  private startTime = -1;
  private done = false;
  private readonly frameMs: number[] = [];
  private readonly tickMs: number[] = [];
  private readonly el: HTMLDivElement;

  constructor(
    root: HTMLElement,
    host: HostSession,
    private readonly rendererString: () => string,
  ) {
    this.el = document.createElement('div');
    this.el.className = 'bench-overlay';
    this.el.textContent = 'Benchmark: waiting for 1 500 enemies…';
    root.appendChild(this.el);
    host.onTickMs = (ms) => {
      if (this.startTime >= 0 && !this.done) this.tickMs.push(ms);
    };
  }

  onSnapshot(s: Snapshot): void {
    if (this.startTime < 0 && s.enemyCount >= MAX_LIVING_ENEMIES) {
      this.startTime = performance.now();
      this.el.textContent = 'Benchmark: measuring for 30 s…';
    }
  }

  onFrame(now: number, dt: number): void {
    if (this.startTime < 0 || this.done) return;
    // The first frame after the start may include time from before it.
    if (now - dt * 1000 >= this.startTime) this.frameMs.push(dt * 1000);
    if (now - this.startTime >= DURATION_MS) this.finish(now);
  }

  private finish(now: number): void {
    this.done = true;
    const elapsed = now - this.startTime;
    const fps = (this.frameMs.length * 1000) / elapsed;
    // 1%-low: the frame rate of the slowest 1% of frames (their average frame time).
    const sorted = [...this.frameMs].sort((a, b) => b - a);
    const n = Math.max(1, Math.ceil(sorted.length * 0.01));
    const slowAvg = sorted.slice(0, n).reduce((a, b) => a + b, 0) / n;
    const fpsLow = slowAvg > 0 ? 1000 / slowAvg : 0;
    const simMs = this.tickMs.length ? this.tickMs.reduce((a, b) => a + b, 0) / this.tickMs.length : 0;
    const simMsMax = this.tickMs.length ? Math.max(...this.tickMs) : 0;
    const r: BenchResult = { fps: round2(fps), fpsLow: round2(fpsLow), simMs: round2(simMs), simMsMax: round2(simMsMax) };
    this.el.textContent = [
      'Benchmark finished (30 s, 1 500 enemies)',
      `Average FPS: ${r.fps}`,
      `1%-low FPS: ${r.fpsLow}`,
      `Simulation: ${r.simMs} ms per tick on average, ${r.simMsMax} ms max`,
      `Renderer: ${this.rendererString()}`,
    ].join('\n');
    console.log(`BENCH ${JSON.stringify(r)}`);
  }

  dispose(): void {
    this.el.remove();
  }
}

function round2(v: number): number {
  return Math.round(v * 100) / 100;
}
