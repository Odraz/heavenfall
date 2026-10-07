import { describe, expect, it } from 'vitest';
import { fogAmount } from './fog';

describe('fog curve (M10 §4.2)', () => {
  it('is 0 at 10 m and 100% at 150 m', () => {
    for (const scenery of [true, false]) {
      expect(fogAmount(0, scenery)).toBe(0);
      expect(fogAmount(10, scenery)).toBe(0);
      expect(fogAmount(150, scenery)).toBeCloseTo(1);
      expect(fogAmount(300, scenery)).toBeCloseTo(1);
    }
  });

  it('is 30% at 40 m for the scenery and 15% for sprites and effects', () => {
    expect(fogAmount(40, true)).toBeCloseTo(0.3);
    expect(fogAmount(40, false)).toBeCloseTo(0.15);
  });

  it('rises linearly in each part', () => {
    expect(fogAmount(25, true)).toBeCloseTo(0.15);
    expect(fogAmount(95, true)).toBeCloseTo(0.65);
    expect(fogAmount(60, true)).toBeGreaterThan(fogAmount(60, false));
  });
});
