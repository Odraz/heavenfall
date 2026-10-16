import { describe, expect, it } from 'vitest';
import { PEARLY_POOL_R1, PEARLY_POOL, poolTemplate } from '../data/rooms/1/index';
import { PINNED as PINNED_R2 } from './pinned';
import { stampFloor, waveCounts, roomBudget } from './stamp';
import { fallbackLayout } from './fallback';
import { attemptSeed, fmix32, makeRng } from './hash';
import { floorHash, generateFloor, pinnedSeed, roomCount } from './index';
import { PINNED_R1 as PINNED } from './pinned';
import { floorRuleErrors, zoneLeaks } from './testutil/rules';

describe('seeds (rogue game.md §3.2)', () => {
  it('fmix32 and the attempt seed are murmur3 and the spec formula', () => {
    expect(fmix32(0)).toBe(0);
    expect(fmix32(1)).toBe(0x514e28b7);
    expect(attemptSeed(5, 1, 1, 0)).toBe(fmix32((5 ^ Math.imul(1, 0x9e3779b1) ^ Math.imul(1, 0x85ebca77)) >>> 0));
  });

  it('the room count is 9 + heaven + one seed bit', () => {
    const counts = new Set(Array.from({ length: 50 }, (_, i) => roomCount(pinnedSeed(i), 1)));
    expect([...counts].sort()).toEqual([10, 11]);
  });

  it('a weighted pick walks the list in order with one draw', () => {
    const a = makeRng(7);
    const b = makeRng(7);
    const u = b.next();
    expect(a.weighted(['x', 'y', 'z'], (t) => (t === 'y' ? 2 : 1))).toBe(u * 4 < 1 ? 'x' : u * 4 < 3 ? 'y' : 'z');
    expect(a.next()).toBe(b.next());
  });
});

describe('generateFloor (rogue game.md §3.3)', () => {
  it('ramps generated commanders from zero while preserving every authored minion', () => {
    const g = generateFloor(PINNED_R2.seed, 1, 1, PEARLY_POOL);
    for (const room of g.def.rooms) {
      if (room.kind !== 'combat') { expect(room.waves).toEqual([]); continue; }
      const template = poolTemplate(PEARLY_POOL, room.templateId!);
      room.waves.forEach((wave, index) => {
        const authored = waveCounts(template.waves[index], roomBudget(room.shape!, room.band!));
        // Watchmen take three Blessed each (rooms.md §6.4).
        const { xp, watchmen = 0, ...counts } = wave;
        expect({ ...counts, blessed: counts.blessed + 3 * watchmen }).toEqual({ ...authored, dominions: index, ...(authored.choristers ? { commander: 'cantor' } : authored.cherubs ? { commander: 'carrier' } : {}) });
        const templateWave = template.waves[index], budget = roomBudget(room.shape!, room.band!);
        expect(xp?.reduce<number>((a, b) => a + (b ?? 0), 0)).toBeCloseTo(templateWave.share * budget - (templateWave.elites ?? 0) * 60 + index * 60, 8);
      });
      if (room.shape === '2x2') expect(room.waves.at(-1)!.blessed).toBeGreaterThanOrEqual(1000);
    }
  });
  it('repins the complete R2 pool and restores the real fallback hazard/elite templates', () => {
    const g = generateFloor(PINNED_R2.seed, 1, 1, PEARLY_POOL);
    expect({ seed: g.floor.seed, attempts: g.floor.attempts, n: g.floor.n, floorHash: floorHash(g.def) }).toEqual(PINNED_R2);
    const fb = fallbackLayout(PEARLY_POOL, 1), stamped = stampFloor(fb.layout, fb.assignment);
    expect(stamped.errors).toEqual([]); expect(zoneLeaks(stamped.map)).toEqual([]);
    expect([2, 6, 7, 8].map((i) => fb.assignment.templates[i].id)).toEqual([
      'pg-c-2x1-horde-hazard-01', 'pg-c-1x1-elite-01', 'pg-c-1x1-hazard-02', 'pg-c-1x1-ranged-hazard-01',
    ]);
    expect(stamped.def.gate?.facing).toBe('W');
  });
  it('is deterministic: the same seed gives the same floorHash', () => {
    const a = generateFloor(pinnedSeed(3), 1, 1, PEARLY_POOL_R1);
    const b = generateFloor(pinnedSeed(3), 1, 1, PEARLY_POOL_R1);
    expect(floorHash(a.def)).toBe(floorHash(b.def));
    expect(JSON.stringify(a.floor)).toBe(JSON.stringify(b.floor));
    expect(floorHash(generateFloor(pinnedSeed(4), 1, 1, PEARLY_POOL_R1).def)).not.toBe(floorHash(a.def));
  });

  it('matches the pinned output', () => {
    const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
    expect({ seed: g.floor.seed, attempts: g.floor.attempts, n: g.floor.n, floorHash: floorHash(g.def) }).toEqual(PINNED);
  });

  it('the fallback floor validates: 11 rooms, the fixed templates, 220 × 256 cells', () => {
    const fb = fallbackLayout(PEARLY_POOL_R1, 1);
    const s = stampFloor(fb.layout, fb.assignment);
    expect(s.errors).toEqual([]);
    expect(fb.layout.n).toBe(11);
    expect([s.def.heights[0].length, s.def.heights.length]).toEqual([220, 256]);
    expect(fb.assignment.orientations[2]).toBe(7);
    expect(s.def.gate?.facing).toBe('W');
    expect(zoneLeaks(s.map)).toEqual([]);
  });

  it('50 seeds: every floor passes validateLevel and every §3.3 rule', () => {
    for (let i = 0; i < 50; i++) {
      const g = generateFloor(pinnedSeed(i), 1, 1, PEARLY_POOL_R1);
      expect(floorRuleErrors(g, PEARLY_POOL_R1), `seed ${pinnedSeed(i)}`).toEqual([]);
    }
  });
});
