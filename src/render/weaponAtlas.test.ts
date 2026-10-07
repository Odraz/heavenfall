import { describe, expect, it } from 'vitest';
import { CLASS_IDS } from '../data/classes';
import { weaponArt, type WeaponLayer } from './weaponAtlas';

const VIEW_W = 3840;
const VIEW_H = 2160;

describe('weapon manifests (M11 §6)', () => {
  for (const id of CLASS_IDS) {
    it(`${id}: the frame, muzzle, pivot and axis are where M11 puts them, and its files exist`, () => {
      const { manifest: m, url } = weaponArt(id);
      expect(m.viewH).toBe(VIEW_H);
      expect(m.top).toBeGreaterThanOrEqual(864);
      expect(m.top + m.h).toBe(VIEW_H);
      for (const [x, y] of [m.muzzle, m.pivot]) {
        expect(x).toBeGreaterThanOrEqual(m.left);
        expect(x).toBeLessThanOrEqual(m.left + m.w);
        expect(y).toBeGreaterThanOrEqual(m.top);
        expect(y).toBeLessThanOrEqual(VIEW_H);
      }
      // The muzzle's area, widened for the smaller untilted weapons (docs/decisions.md, M11 §2).
      const mx = (m.muzzle[0] + VIEW_W / 2) / VIEW_W;
      const my = m.muzzle[1] / VIEW_H;
      expect(mx).toBeGreaterThanOrEqual(0.55);
      expect(mx).toBeLessThanOrEqual(0.76);
      expect(my).toBeGreaterThanOrEqual(0.56);
      expect(my).toBeLessThanOrEqual(0.68);
      // The axis, a unit vector toward the muzzle, crosses the crosshair's row within ±115 px of the center.
      const [ax, ay] = m.axis;
      expect(Math.hypot(ax, ay)).toBeCloseTo(1, 3);
      const cross = m.muzzle[0] + ((VIEW_H / 2 - m.muzzle[1]) / ay) * ax;
      expect(Math.abs(cross)).toBeLessThanOrEqual(115);

      const layers: WeaponLayer[] = ['idle'];
      if (m.glow) layers.push('idle-glow');
      if (m.alt) layers.push('alt', ...(m.alt.glow ? (['alt-glow'] as const) : []));
      if (m.hammer) layers.push('hammer');
      if (m.cylinder) layers.push('cylinder');
      if (m.heal) layers.push('censer-green', 'censer-green-glow');
      if (m.swing) layers.push('fist', 'chain', 'chain-glow');
      for (const l of layers) expect(url(l)).toBeTruthy();
    });
  }

  it('gives each class the layers M11 gives it', () => {
    const m = Object.fromEntries(CLASS_IDS.map((id) => [id, weaponArt(id).manifest]));
    expect(m.heretic.alt?.kind).toBe('empty');
    expect(m.binder.alt?.kind).toBe('spin');
    expect(m.fallen.alt?.kind ?? 'pump').toBe('pump');
    expect(m.betrayer.alt).toBeUndefined();
    expect(CLASS_IDS.filter((id) => m[id].swing)).toEqual(['binder']);
    expect(CLASS_IDS.filter((id) => m[id].hammer).sort()).toEqual(['betrayer', 'heretic']);
    expect(CLASS_IDS.filter((id) => m[id].cylinder).every((id) => id === 'betrayer')).toBe(true);
    expect(CLASS_IDS.filter((id) => m[id].heal)).toEqual(['heretic']);
  });
});
