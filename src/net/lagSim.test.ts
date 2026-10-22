import { describe, expect, it } from 'vitest';
import { LagLine, parseNetLag } from './lagSim';

/** A LagLine on a fake clock: `run(ms)` delivers everything due by then, in time order. */
function line(lag: { lagMs: number; jitterMs: number; lossPct: number }, randoms: number[]) {
  let now = 0, k = 0;
  const due: Array<{ at: number; fn: () => void; n: number }> = [];
  const l = new LagLine(lag, () => randoms[k++ % randoms.length], (fn, ms) => due.push({ at: now + ms, fn, n: due.length }), () => now);
  return {
    l,
    run(ms: number) {
      now = ms;
      due.sort((a, b) => a.at - b.at || a.n - b.n);
      while (due.length && due[0].at <= ms) due.shift()!.fn();
    },
    at(ms: number) { now = ms; },
  };
}

describe('simulated bad connection', () => {
  it('reads lag, jitter and loss from the URL, clamped, and nothing without them', () => {
    expect(parseNetLag(new URLSearchParams(''))).toBeNull();
    expect(parseNetLag(new URLSearchParams('lag=150&jitter=20&loss=2'))).toEqual({ lagMs: 150, jitterMs: 20, lossPct: 2 });
    expect(parseNetLag(new URLSearchParams('lag=-5&loss=900&jitter=x'))).toEqual({ lagMs: 0, jitterMs: 0, lossPct: 50 });
  });

  it('delays ordered messages by half the round trip and never reorders them, whatever the jitter', () => {
    // Sent at 0, 10 and 20 ms with delays 100 + 40, 100 − 40 and 100 + 40: due at 140, 70 and 160.
    const t = line({ lagMs: 200, jitterMs: 40, lossPct: 0 }, [1, 0, 1]);
    const got: number[] = [];
    t.l.ordered(() => got.push(1));
    t.at(10); t.l.ordered(() => got.push(2));
    t.at(20); t.l.ordered(() => got.push(3));
    t.run(139);
    expect(got).toEqual([]);
    // The second waits for the first.
    t.run(140);
    expect(got).toEqual([1, 2]);
    t.run(160);
    expect(got).toEqual([1, 2, 3]);
  });

  it('lets unordered messages overtake and drops them at the loss rate', () => {
    // First message: kept (50 ≥ 10), delay 100 + 40. Second: kept, delay 100 − 40. Third: lost (5 < 10).
    const t = line({ lagMs: 200, jitterMs: 40, lossPct: 10 }, [0.5, 1, 0.5, 0, 0.05]);
    const got: number[] = [];
    t.l.unordered(() => got.push(1));
    t.l.unordered(() => got.push(2));
    t.l.unordered(() => got.push(3));
    t.run(1000);
    expect(got).toEqual([2, 1]);
  });

  it('delivers nothing after closing', () => {
    const t = line({ lagMs: 100, jitterMs: 0, lossPct: 0 }, [0.5]);
    let n = 0;
    t.l.ordered(() => n++);
    t.l.close();
    t.run(1000);
    expect(n).toBe(0);
  });
});
