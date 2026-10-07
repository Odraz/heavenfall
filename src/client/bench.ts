/** Benchmark measurement (§2.5, §12): starts when 1 500 Blessed are alive for the first time, lasts 30 s. */
import { MAX_LIVING_ENEMIES } from '../sim/constants';
import type { Snapshot } from '../net/protocol';
import type { HostSession } from './hostSession';

const DURATION_MS = 30000;

export interface BenchResult {
  fps: number;
  fpsLow: number;
  /** Average frame time in ms (M10 §2.3: the sensitive measure when the frame rate is uncapped). */
  frameMs: number;
  simMs: number;
  simMsMax: number;
  /** Renderer statistics of the last measured frame (M10 §2.1). */
  stats: RenderStats;
  /** Frames over 20 ms, and the median time between them in ms (a diagnostic for hitches). */
  slow: number;
  slowGapMs: number;
}

/** What the renderer drew in one frame, and the GPU memory its textures take (M10 §2.1). */
export interface RenderStats {
  calls: number;
  triangles: number;
  textures: number;
  textureMB: number;
}

export class BenchRunner {
  private startTime = -1;
  private done = false;
  private readonly frameMs: number[] = [];
  /** When each frame over 20 ms ended. */
  private readonly slowAt: number[] = [];
  private readonly tickMs: number[] = [];
  private readonly el: HTMLDivElement;

  constructor(
    root: HTMLElement,
    host: HostSession,
    private readonly rendererString: () => string,
    private readonly renderStats: () => RenderStats,
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
    if (now - dt * 1000 >= this.startTime) {
      this.frameMs.push(dt * 1000);
      if (dt * 1000 > 20) this.slowAt.push(now);
    }
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
    const frameMs = this.frameMs.length ? this.frameMs.reduce((a, b) => a + b, 0) / this.frameMs.length : 0;
    const gaps = this.slowAt.slice(1).map((t, i) => t - this.slowAt[i]).sort((a, b) => a - b);
    const slowGapMs = gaps.length ? round2(gaps[gaps.length >> 1]) : 0;
    const r: BenchResult = { fps: round2(fps), fpsLow: round2(fpsLow), frameMs: round2(frameMs), simMs: round2(simMs), simMsMax: round2(simMsMax), stats: this.renderStats(), slow: this.slowAt.length, slowGapMs };
    this.el.textContent = [
      'Benchmark finished (30 s, 1 500 enemies)',
      `Average FPS: ${r.fps}`,
      `1%-low FPS: ${r.fpsLow}`,
      `Frame time: ${r.frameMs} ms on average`,
      `Draw calls ${r.stats.calls}, triangles ${r.stats.triangles}, textures ${r.stats.textures} (${r.stats.textureMB} MB)`,
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
