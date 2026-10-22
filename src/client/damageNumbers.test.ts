import { expect, it } from 'vitest';
import { DAMAGE_MERGE_MS, DAMAGE_NUMBERS_MAX, damageText, mergeHits, spread, type DamageNumber } from './damageNumbers';

it('merges hits on one enemy within 0.15 s, starts a new number after, and drops the oldest past the cap (R06 follow-up §8)', () => {
  const live: DamageNumber[] = [];
  mergeHits(live, [3, 1, 2, 3, 10, 0], 1000);
  mergeHits(live, [3, 1.5, 2, 3, 12.4, 0, 4, 5, 5, 2, 8, 1], 1000 + DAMAGE_MERGE_MS);
  expect(live.map((n) => [n.slot, n.amount, n.kill, n.at])).toEqual([[3, 22.4, false, 1150], [4, 8, true, 1150]]);
  expect(live[0].x).toBe(1.5);
  mergeHits(live, [3, 1, 2, 3, 5, 0], 1150 + DAMAGE_MERGE_MS + 1);
  expect(live).toHaveLength(3);
  // A kill's number is final: a later hit on a reused slot starts a new one.
  mergeHits(live, [4, 0, 0, 0, 3, 0], 1160);
  expect(live.filter((n) => n.slot === 4)).toHaveLength(2);
  for (let i = 0; i < DAMAGE_NUMBERS_MAX; i++) mergeHits(live, [100 + i, 0, 0, 0, 1, 0], 2000 + i);
  expect(live).toHaveLength(DAMAGE_NUMBERS_MAX);
  expect(live.some((n) => n.slot === 3)).toBe(false);
  expect([damageText(0.2), damageText(22.4), damageText(22.5)]).toEqual(['1', '22', '23']);
});

it('spreads numbers of neighbouring enemies apart on screen, within a small box', () => {
  const offsets = Array.from({ length: 9 }, (_, slot) => spread(slot));
  expect(new Set(offsets.map(([x]) => x)).size).toBe(9);
  for (const [x, y] of offsets) { expect(Math.abs(x)).toBeLessThanOrEqual(44); expect(Math.abs(y)).toBeLessThanOrEqual(14); }
});
