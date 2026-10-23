import { describe, expect, it } from 'vitest';
import { ENEMY_SLOTS } from '../sim/constants';
import { CONFIRMED_HIDE_MS, PREDICTION_MAX_MS, PredictedDeaths, REVEAL_MARGIN_TICKS, revealTick, UNKNOWN_RTT_MS } from './predictedDeaths';
import type { InterpolatedEnemies } from './snapshots';

/** Interpolated enemies in the given slots, all of incarnation 1, x = slot. */
function ents(slots: number[]): InterpolatedEnemies {
  const e: InterpolatedEnemies = {
    count: slots.length,
    slot: new Uint16Array(ENEMY_SLOTS), x: new Float32Array(ENEMY_SLOTS), y: new Float32Array(ENEMY_SLOTS), z: new Float32Array(ENEMY_SLOTS),
    incarnation: new Uint32Array(ENEMY_SLOTS), type: new Uint8Array(ENEMY_SLOTS), state: new Uint8Array(ENEMY_SLOTS), flags: new Uint8Array(ENEMY_SLOTS),
  };
  slots.forEach((s, i) => { e.slot[i] = s; e.x[i] = s; e.incarnation[i] = 1; });
  return e;
}

/** A snapshot that holds incarnation 1 in the given slots. */
const holding = (...slots: number[]) => (slot: number) => (slots.includes(slot) ? 1 : -1);

describe('predicted deaths (netcode stage 2)', () => {
  it('the reveal tick allows the round trip and a margin, assuming 300 ms before one is measured', () => {
    expect(revealTick(100, 99, 33)).toBe(100 + 3 + REVEAL_MARGIN_TICKS);
    expect(revealTick(100, 0, 33)).toBe(100 + REVEAL_MARGIN_TICKS);
    expect(revealTick(100, null, 30)).toBe(100 + UNKNOWN_RTT_MS / 30 + REVEAL_MARGIN_TICKS);
  });

  it('a predicted kill disappears from the drawn enemies at once, the others keep their order', () => {
    const d = new PredictedDeaths();
    const e = ents([4, 7, 9]);
    expect(d.add(7, 1, 50, 0)).toBe(true);
    d.filter(e);
    expect(e.count).toBe(2);
    expect([e.slot[0], e.slot[1]]).toEqual([4, 9]);
    expect([e.x[0], e.x[1]]).toEqual([4, 9]);
  });

  it('a second prediction of the same enemy is refused: its death plays once', () => {
    const d = new PredictedDeaths();
    expect(d.add(7, 1, 50, 0)).toBe(true);
    expect(d.add(7, 1, 50, 10)).toBe(false);
  });

  it('a new enemy in the slot is not hidden', () => {
    const d = new PredictedDeaths();
    d.add(7, 1, 50, 0);
    expect(d.hides(7, 1)).toBe(true);
    expect(d.hides(7, 2)).toBe(false);
  });

  it('the host’s confirmation tells the death already played, and it stays hidden while still drawn', () => {
    const d = new PredictedDeaths();
    d.add(7, 1, 50, 0);
    expect(d.confirm(7, 1, 100)).toBe(true);
    // Snapshots up to the reveal tick and beyond: confirmed, it never reappears.
    expect(d.settle(60, holding(), 200)).toEqual([]);
    expect(d.hides(7, 1)).toBe(true);
    d.settle(61, holding(), 100 + CONFIRMED_HIDE_MS);
    expect(d.size).toBe(0);
    // An unpredicted death is the snapshots' to play.
    expect(d.confirm(8, 1, 0)).toBe(false);
  });

  it('a snapshot that still shows it alive before the reveal tick keeps it hidden; one at the reveal tick brings it back', () => {
    const d = new PredictedDeaths();
    d.add(7, 1, 50, 0);
    expect(d.settle(49, holding(7), 100)).toEqual([]);
    expect(d.hides(7, 1)).toBe(true);
    expect(d.settle(50, holding(7), 200)).toEqual([7]);
    expect(d.hides(7, 1)).toBe(false);
  });

  it('a slot found empty or reused counts as dead even without a confirmation', () => {
    const d = new PredictedDeaths();
    d.add(7, 1, 50, 0);
    expect(d.settle(60, (slot) => (slot === 7 ? 2 : -1), 100)).toEqual([]);
    expect(d.hides(7, 1)).toBe(true);
  });

  it('a prediction the snapshots never settle reappears after 2 s', () => {
    const d = new PredictedDeaths();
    d.add(7, 1, 1e9, 0);
    expect(d.settle(10, holding(7), PREDICTION_MAX_MS - 1)).toEqual([]);
    expect(d.settle(11, holding(7), PREDICTION_MAX_MS)).toEqual([7]);
  });
});
