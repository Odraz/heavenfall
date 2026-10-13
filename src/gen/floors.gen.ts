/**
 * The generator acceptance check (rogue game.md §3.3, §14.9): the 1 000 pinned seeds of heaven 1. At
 * least 99% succeed within 20 attempts; every floor passes validateLevel, the coarse zone-leak check and
 * every §3.3 rule. Run by `npm run test:gen`.
 */
import { expect, it } from 'vitest';
import { PEARLY_POOL } from '../data/rooms/1/index';
import { generateFloor, pinnedSeed } from './index';
import { floorRuleErrors } from './testutil/rules';

const SEEDS = 1000;

it('1 000 pinned seeds: ≥ 99% within 20 attempts, every floor valid', () => {
  let within20 = 0;
  let fallbacks = 0;
  let maxAttempts = 0;
  let totalAttempts = 0;
  let ms = 0;
  const rejects: Record<string, number> = {};
  const failures: string[] = [];
  for (let i = 0; i < SEEDS; i++) {
    const seed = pinnedSeed(i);
    const t0 = performance.now();
    const g = generateFloor(seed, 1, 1, PEARLY_POOL);
    ms += performance.now() - t0;
    if (!g.floor.fallbackUsed && g.floor.attempts <= 20) within20++;
    if (g.floor.fallbackUsed) fallbacks++;
    maxAttempts = Math.max(maxAttempts, g.floor.attempts);
    totalAttempts += g.floor.attempts;
    for (const r of g.rejects) {
      const k = r.replace(/\(.*$/, '').slice(0, 48);
      rejects[k] = (rejects[k] ?? 0) + 1;
    }
    const errors = floorRuleErrors(g, PEARLY_POOL);
    if (errors.length) failures.push(`seed ${seed} (i ${i}): ${errors.slice(0, 3).join('; ')}`);
  }
  const summary = { seeds: SEEDS, within20, rate: within20 / SEEDS, fallbacks, maxAttempts, meanAttempts: totalAttempts / SEEDS, meanMs: ms / SEEDS, rejects };
  console.log(JSON.stringify(summary, null, 1));
  expect(failures.slice(0, 10)).toEqual([]);
  expect(within20 / SEEDS).toBeGreaterThanOrEqual(0.99);
});
