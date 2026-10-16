import { describe, expect, it } from 'vitest';
import { PEARLY_POOL, poolTemplate } from '../data/rooms/1/index';
import type { WaveDef } from '../data/dungeons/types';
import { convertWatchmen, roomBudget, waveCounts, WATCHMAN_TP } from './stamp';
import { generateFloor } from './index';
import { PINNED } from './pinned';

/** A template's stamped wave at band 2, as stampFloor builds it before the conversion. */
function stamped(id: string, index: number): WaveDef {
  const t = poolTemplate(PEARLY_POOL, id), wv = t.waves[index], budget = roomBudget(t.shape, 2);
  const rest = wv.share * budget - (wv.elites ?? 0) * 60;
  return { ...waveCounts(wv, budget), xp: [rest * (wv.mix.blessed ?? 0), rest * (wv.mix.chorister ?? 0), rest * (wv.mix.cherub ?? 0), index * 60], dominions: index };
}
const tp = (w: WaveDef) => w.blessed + 6 * w.choristers + 4 * w.cherubs + WATCHMAN_TP * (w.watchmen ?? 0);
const xpSum = (w: WaveDef) => w.xp!.reduce<number>((a, b) => a + (b ?? 0), 0);

describe('Watchman conversion (rooms.md §6.4)', () => {
  it("turns the Cloudbridge's last wave of 224 Blessed into 197 Blessed and 9 Watchmen", () => {
    const before = stamped('pg-c-2x1-horde-01', 3);
    expect(before.blessed).toBe(224);
    const after = convertWatchmen(before, 3, false, false);
    expect([after.blessed, after.watchmen]).toEqual([197, 9]);
    expect(tp(after)).toBe(tp(before));
    expect(xpSum(after)).toBeCloseTo(xpSum(before), 9);
    expect(after.xp![4]).toBe(27);
  });
  it("turns the Choir Loft's last wave (112 Blessed, 8 Choristers) into 79 Blessed, 11 Watchmen and 8 Choristers", () => {
    const before = stamped('pg-c-1x1-ranged-01', 2);
    expect([before.blessed, before.choristers]).toEqual([112, 8]);
    const after = convertWatchmen(before, 2, true, false);
    expect([after.blessed, after.watchmen, after.choristers]).toEqual([79, 11, 8]);
    expect(tp(after)).toBe(tp(before));
    expect(xpSum(after)).toBeCloseTo(xpSum(before), 9);
  });
  it('gives none below 24 Blessed (10 when ranged), in the first wave, with Cherubs or in the crest', () => {
    const w: WaveDef = { blessed: 23, choristers: 0, cherubs: 0, xp: [29, 0, 0, 60] };
    expect(convertWatchmen(w, 1, false, false)).toBe(w);
    expect(convertWatchmen({ ...w, blessed: 9 }, 1, true, false).watchmen).toBeUndefined();
    expect(convertWatchmen({ ...w, blessed: 10 }, 1, true, false).watchmen).toBe(1);
    expect(convertWatchmen({ ...w, blessed: 300 }, 0, false, false).watchmen).toBeUndefined();
    expect(convertWatchmen({ ...w, blessed: 300, cherubs: 5 }, 2, false, false).watchmen).toBeUndefined();
    expect(convertWatchmen({ ...w, blessed: 1200 }, 4, false, true).watchmen).toBeUndefined();
    expect(convertWatchmen({ ...w, blessed: 24 }, 1, false, false).watchmen).toBe(1);
  });
  it('keeps every generated wave total and XP, never converts the first wave, Cherub waves or the crest', () => {
    const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
    let converted = 0;
    for (const room of g.def.rooms) {
      if (room.kind !== 'combat') { expect(room.waves.every((w) => !w.watchmen)).toBe(true); continue; }
      const t = poolTemplate(PEARLY_POOL, room.templateId!), budget = roomBudget(room.shape!, room.band!);
      const ranged = t.focus === 'ranged' || t.secondary === 'ranged';
      room.waves.forEach((w, index) => {
        const raw = waveCounts(t.waves[index], budget);
        expect(tp(w)).toBe(tp(raw));
        expect(xpSum(w)).toBeCloseTo(t.waves[index].share * budget - (t.waves[index].elites ?? 0) * 60 + index * 60, 8);
        const crest = room.shape === '2x2' && index === room.waves.length - 1;
        const expected = index === 0 || crest || raw.cherubs > 0 ? 0 : Math.floor(raw.blessed / (ranged ? 10 : 24));
        expect(w.watchmen ?? 0).toBe(expected);
        converted += w.watchmen ?? 0;
      });
    }
    expect(converted).toBeGreaterThan(0);
  });
});
