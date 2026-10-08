import { describe, expect, it } from 'vitest';
import { LOADING_CARDS, pickCard } from './loading';

describe('pickCard', () => {
  const n = LOADING_CARDS.length;

  it('never repeats the card it must avoid, and reaches every other card', () => {
    for (let not = 0; not < n; not++) {
      const seen = new Set<number>();
      for (let i = 0; i < n - 1; i++) seen.add(pickCard(not, () => (i + 0.5) / (n - 1)));
      expect(seen.has(not)).toBe(false);
      expect(seen.size).toBe(n - 1);
    }
  });

  it('picks any card when there is none to avoid', () => {
    expect(pickCard(null, () => 0)).toBe(0);
    expect(pickCard(null, () => 0.999)).toBe(n - 1);
    expect(pickCard(Number.NaN, () => 0)).toBe(0);
    expect(pickCard(99, () => 0.999)).toBe(n - 1);
  });
});
