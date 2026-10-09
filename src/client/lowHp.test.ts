/** M12 stage 5: knowing how you're doing (M12 §6.1, §6.2, §11.1). */
import { describe, expect, it } from 'vitest';
import { HEAL_FADE_MS, HEAL_VIGNETTE, HURT_FADE_MS, hurtVignette, LowHp, SHIELD_EDGE, SHIELD_FADE_MS, SHIELD_GONE_FLASH, SHIELD_UP_FLASH } from './lowHp';

describe('HP feedback (M12 §6.1)', () => {
  it('damage: lost ÷ max HP × 3 between 0.3 and 0.85, fading over 500 ms', () => {
    expect(hurtVignette(5, 400)).toBe(0.3);
    expect(hurtVignette(80, 400)).toBeCloseTo(0.6, 9);
    expect(hurtVignette(400, 400)).toBe(0.85);
    expect(HURT_FADE_MS).toBe(500);
  });

  it('healed 0.45 over 600 ms; the shield edge 0.2, flashing 0.6 up and 0.7 gone over 500 ms', () => {
    expect([HEAL_VIGNETTE, HEAL_FADE_MS]).toEqual([0.45, 600]);
    expect([SHIELD_EDGE, SHIELD_UP_FLASH, SHIELD_GONE_FLASH, SHIELD_FADE_MS]).toEqual([0.2, 0.6, 0.7, 500]);
  });
});

describe('low HP (M12 §6.2)', () => {
  it('enters below 35%, leaves at 40% or on death; the shield is not counted', () => {
    const l = new LowHp();
    l.update(0, true, 36, 100);
    expect(l.low).toBe(false);
    l.update(10, true, 34.9, 100);
    expect(l.low).toBe(true);
    // Between the two: it stays low.
    l.update(20, true, 39, 100);
    expect(l.low).toBe(true);
    l.update(30, true, 40, 100);
    expect(l.low).toBe(false);
    l.update(40, true, 20, 100);
    expect(l.low).toBe(true);
    l.update(50, false, 20, 100);
    expect(l.low).toBe(false);
    expect(l.edge(50)).toBe(0);
  });

  it('beats on entering, then every 0.7 s, every 0.5 s below 15%', () => {
    const l = new LowHp();
    const beats: number[] = [];
    for (let t = 0; t <= 2000; t += 10) if (l.update(t, true, t < 1500 ? 30 : 10, 100)) beats.push(t);
    expect(beats).toEqual([0, 700, 1400, 1900]);
  });

  it('the crimson edge: 0.3, rising to 0.55 on each beat and falling back over 0.35 s', () => {
    const l = new LowHp();
    l.update(0, true, 30, 100);
    expect(l.edge(0)).toBeCloseTo(0.55, 9);
    expect(l.edge(175)).toBeCloseTo(0.425, 9);
    expect(l.edge(350)).toBeCloseTo(0.3, 9);
    expect(l.edge(600)).toBeCloseTo(0.3, 9);
  });
});
