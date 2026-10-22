/**
 * A simulated bad connection for testing (netcode stage, 2026-10-22): `lag=` round trip in ms,
 * `jitter=` ± ms per message and `loss=` percent of `snap` messages dropped, applied by a client to
 * everything it sends and receives. `ctrl` stays reliable and ordered, as on a real connection.
 */

export interface NetLag {
  /** Round trip added, ms: half on the way out, half on the way in. */
  lagMs: number;
  /** Each message's one-way delay varies by up to ± this, ms. */
  jitterMs: number;
  /** Percent of `snap` messages lost, each way. */
  lossPct: number;
}

/** The URL parameters `lag`, `jitter` and `loss`, or null when none is set. */
export function parseNetLag(q: URLSearchParams): NetLag | null {
  const num = (k: string, max: number): number => {
    const v = Number(q.get(k));
    return Number.isFinite(v) ? Math.max(0, Math.min(max, v)) : 0;
  };
  const lag: NetLag = { lagMs: num('lag', 2000), jitterMs: num('jitter', 500), lossPct: num('loss', 50) };
  return lag.lagMs || lag.jitterMs || lag.lossPct ? lag : null;
}

/** One direction of a simulated connection. */
export class LagLine {
  /** When the last ordered message is delivered: an ordered one never overtakes it. */
  private orderedAt = 0;
  private closed = false;

  constructor(
    private readonly lag: NetLag,
    private readonly random: () => number = Math.random,
    private readonly schedule: (fn: () => void, ms: number) => void = (fn, ms) => { setTimeout(fn, ms); },
    private readonly clock: () => number = () => performance.now(),
  ) {}

  /** This message's one-way delay, ms. */
  private delay(): number {
    return Math.max(0, this.lag.lagMs / 2 + (this.random() * 2 - 1) * this.lag.jitterMs);
  }

  /** A reliable, ordered message (`ctrl`): delayed, never lost or reordered. */
  ordered(fn: () => void): void {
    const now = this.clock();
    this.orderedAt = Math.max(this.orderedAt, now + this.delay());
    this.schedule(() => { if (!this.closed) fn(); }, this.orderedAt - now);
  }

  /** An unordered message (`snap`): delayed independently, and lost at the loss rate. */
  unordered(fn: () => void): void {
    if (this.random() * 100 < this.lag.lossPct) return;
    this.schedule(() => { if (!this.closed) fn(); }, this.delay());
  }

  close(): void {
    this.closed = true;
  }
}
