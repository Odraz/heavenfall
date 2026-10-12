import { describe, expect, it } from 'vitest';
import { groupTakes, nextTake, peakRms, TAKES } from './recorded';

describe('recorded sound effects', () => {
  it('groups takes by sound name in file order and skips files that name no sound', () => {
    const g = groupTakes({
      '../../assets/sfx/revolver-02.wav': 'r2',
      '../../assets/sfx/revolver-01.wav': 'r1',
      '../../assets/sfx/hitTick-01.wav': 'h1',
      '../../assets/sfx/porcelainBreak-01.wav': 'p1',
      '../../assets/sfx/unlistedSound-01.wav': 'x1',
      '../../assets/sfx/revolver.wav': 'x',
    });
    expect([...g.entries()]).toEqual([
      ['hitTick', ['h1']],
      ['porcelainBreak', ['p1']],
      ['revolver', ['r1', 'r2']],
    ]);
  });

  it('finds the S1 takes in assets/sfx', () => {
    for (const name of ['chaingun', 'revolver', 'blessedDeath'] as const) expect(TAKES.get(name)?.length).toBe(3);
  });

  it('never picks the same take twice in a row when there is a choice', () => {
    expect(nextTake(1, 0, () => 0.9)).toBe(0);
    for (let last = 0; last < 3; last++)
      for (const r of [0, 0.3, 0.49, 0.5, 0.99]) {
        const i = nextTake(3, last, () => r);
        expect(i).not.toBe(last);
        expect(i).toBeGreaterThanOrEqual(0);
        expect(i).toBeLessThan(3);
      }
    // With no last take, every take can come up.
    expect(new Set([0, 0.4, 0.8].map((r) => nextTake(3, -1, () => r)))).toEqual(new Set([0, 1]));
  });

  it('measures the loudest 50 ms, not the average over the tail', () => {
    const rate = 1000;
    const s = new Float32Array(1000);
    for (let i = 0; i < 50; i++) s[i] = i % 2 ? 0.5 : -0.5;
    expect(peakRms(s, rate)).toBeCloseTo(0.5, 2);
    expect(peakRms(new Float32Array(10), rate)).toBe(0);
  });
});
