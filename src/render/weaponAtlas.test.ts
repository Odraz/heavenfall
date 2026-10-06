import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../data/classes';
import { fireFrame, weaponAtlas } from './weaponAtlas';

describe('fireFrame', () => {
  it('plays the 4 fire frames over 0.3 s for a slow weapon, then idles', () => {
    expect(fireFrame(0, 900)).toBe(0);
    expect(fireFrame(80, 900)).toBe(1);
    expect(fireFrame(160, 900)).toBe(2);
    expect(fireFrame(299, 900)).toBe(3);
    expect(fireFrame(300, 900)).toBe(-1);
  });

  it('fits them into the time between shots for a fast weapon', () => {
    expect(fireFrame(0, 100)).toBe(0);
    expect(fireFrame(26, 100)).toBe(1);
    expect(fireFrame(99, 100)).toBe(3);
    expect(fireFrame(100, 100)).toBe(-1);
  });

  it('idles before any shot', () => {
    expect(fireFrame(-Infinity, 900)).toBe(-1);
    expect(fireFrame(Infinity, 900)).toBe(-1);
  });
});

describe('weapon atlases', () => {
  it('every class has an idle frame and 4 fire frames inside its atlas, 600 px tall', () => {
    for (const id of CLASS_IDS) {
      const m = weaponAtlas(id).manifest;
      expect(m.frameH).toBe(600);
      expect(m.idle).toHaveLength(1);
      expect(m.fire).toHaveLength(4);
      for (const [x, y, mx, my] of [...m.idle, ...m.fire]) {
        expect(x + m.frameW).toBeLessThanOrEqual(m.width);
        expect(y + m.frameH).toBeLessThanOrEqual(m.height);
        // The muzzle point lies within the frame.
        expect(mx).toBeGreaterThanOrEqual(0);
        expect(mx).toBeLessThanOrEqual(m.frameW);
        expect(my).toBeGreaterThanOrEqual(0);
        expect(my).toBeLessThanOrEqual(m.frameH);
      }
    }
  });
});

describe('the Scourge swing (M9 §5.1)', () => {
  it("is in the Binder's atlas only: 4 half-resolution frames inside it", () => {
    for (const id of CLASS_IDS) expect(!!weaponAtlas(id).manifest.swing).toBe(id === 'binder');
    const m = weaponAtlas('binder').manifest;
    const sw = m.swing!;
    expect(sw.frames).toHaveLength(4);
    for (const [x, y] of sw.frames) {
      expect(x + sw.frameW / sw.scale).toBeLessThanOrEqual(m.width);
      expect(y + m.frameH / sw.scale).toBeLessThanOrEqual(m.height);
    }
  });
});
