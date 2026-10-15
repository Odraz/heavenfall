import { describe, expect, it } from 'vitest';
import { carriedHints, hpTier, newItemSlots, xpProgress } from './hudModel';
import { xpForLevel } from '../profile/model';

describe('HUD model', () => {
  it('colors health green above half, amber down to a quarter, red below', () => {
    expect(hpTier(240, 240)).toBe('ok');
    expect(hpTier(121, 240)).toBe('ok');
    expect(hpTier(120, 240)).toBe('warn');
    expect(hpTier(60, 240)).toBe('warn');
    expect(hpTier(59, 240)).toBe('low');
    expect(hpTier(-5, 240)).toBe('low');
    expect(hpTier(10, 0)).toBe('low');
  });

  it('measures experience inside the current level and stops at the cap', () => {
    expect(xpProgress(0)).toEqual({ level: 1, into: 0, span: 1500, percent: 0, max: false });
    const two = xpForLevel(2), three = xpForLevel(3);
    expect(xpProgress(two + 400)).toMatchObject({ level: 2, into: 400, span: three - two });
    expect(xpProgress(three - 1).percent).toBeLessThan(100);
    expect(xpProgress(xpForLevel(10) + 99999)).toEqual({ level: 10, into: 0, span: 0, percent: 100, max: true });
  });

  it('describes each carried stack with its key, name, count and rule', () => {
    expect(carriedHints([{ item: 'balm', count: 2 }, null])).toEqual([
      { slot: 1, item: 'balm', text: '1 · Balm of the Rejected ×2: heal yourself for 40% of your max HP.' },
    ]);
    expect(carriedHints([null, { item: 'feather', count: 1 }]).map((h) => h.slot)).toEqual([2]);
    expect(carriedHints([null, null])).toEqual([]);
  });

  it('pulses only slots that just received an untried item type', () => {
    expect(newItemSlots(null, [{ item: 'balm', count: 1 }, null], [])).toEqual([0]);
    // A count change of the same item, or an item already used, does not pulse.
    expect(newItemSlots([{ item: 'balm', count: 1 }, null], [{ item: 'balm', count: 2 }, null], [])).toEqual([]);
    expect(newItemSlots([null, null], [null, { item: 'seal', count: 1 }], ['seal'])).toEqual([]);
    expect(newItemSlots([{ item: 'balm', count: 1 }, null], [{ item: 'venom', count: 1 }, { item: 'frost', count: 1 }], [])).toEqual([0, 1]);
  });
});
