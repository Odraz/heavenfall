import { describe, expect, it } from 'vitest';
import { SFX } from './sfx';
import { MAX_PARTS, renderSound, soundLength } from './synth';

const RATE = 48000;

describe('synthesizer (M8 §9.1)', () => {
  for (const [name, def] of Object.entries(SFX)) {
    it(`renders ${name} deterministically to a non-silent buffer of its length, within ±1`, () => {
      expect(def.parts.length).toBeLessThanOrEqual(MAX_PARTS);
      const a = renderSound(def, RATE);
      const b = renderSound(def, RATE);
      expect(a.length).toBe(Math.round(soundLength(def) * RATE));
      expect(a).toEqual(b);
      let peak = 0;
      for (const v of a) {
        expect(Number.isFinite(v)).toBe(true);
        peak = Math.max(peak, Math.abs(v));
      }
      expect(peak).toBeGreaterThan(0.01);
      expect(peak).toBeLessThanOrEqual(1);
    });
  }

  it('renders every sound in at most 3 s', () => {
    for (const def of Object.values(SFX)) expect(soundLength(def)).toBeLessThanOrEqual(3 + 1e-9);
  });
});
