import { describe, expect, it } from 'vitest';
import { hpTier, xpProgress } from './hudModel';
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
});
