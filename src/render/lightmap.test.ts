import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons/index';
import { loadMap } from '../sim/map';
import { mapOf } from '../sim/testutil/maps';
import { K_VOID, K_WALL } from '../sim/heights';
import type { GameMap } from '../sim/map';
import { bakeLightmap, DARKEST, facesSun, inShadow, LIGHTMAP_TEXELS, lightTint, lum, resetLightmapCache, shadowZ } from './lightmap';

/** A test map whose wall cells (all open edges in a bare room) are all walls 8 m high instead. */
function walled(map: GameMap): GameMap {
  for (let i = 0; i < map.w * map.h; i++) {
    if (!map.wall[i] || map.heights.kind[i] === K_VOID) continue;
    map.heights.kind[i] = K_WALL;
    map.heights.height[i] = 8;
  }
  resetLightmapCache();
  return map;
}

describe('baked lighting (M10 §5.2)', () => {
  const map = loadMap(DUNGEONS['pearly-gates']);
  const lm = bakeLightmap(map);
  const texel = (x: number, y: number) => {
    const o = (Math.floor(y * LIGHTMAP_TEXELS) * lm.w + Math.floor(x * LIGHTMAP_TEXELS)) * 4;
    return [lm.data[o] / 255, lm.data[o + 1] / 255, lm.data[o + 2] / 255, lm.data[o + 3] / 255];
  };

  it('a floor texel behind a wall in the sun\'s direction is darker than one in the open', () => {
    // Arena 1's east wall (column 64) stands between the sun (north-east) and the floor at its foot.
    const shaded = texel(62.6, 30.5);
    const open = texel(30.5, 10.5);
    expect(lum(shaded)).toBeLessThan(lum(open));
  });

  it('the darkest floor is at least 60% of the brightest', () => {
    let lo = Infinity;
    let hi = -Infinity;
    for (let i = 0; i < lm.w * lm.h; i++) {
      const c = map.heights.kind[Math.floor(i / lm.w / LIGHTMAP_TEXELS) * map.w + Math.floor((i % lm.w) / LIGHTMAP_TEXELS)];
      if (c !== 0) continue;
      const l = lum([lm.data[i * 4], lm.data[i * 4 + 1], lm.data[i * 4 + 2]]);
      lo = Math.min(lo, l);
      hi = Math.max(hi, l);
    }
    expect(lo / hi).toBeGreaterThanOrEqual(0.6 - 1e-3);
    expect(DARKEST).toBeGreaterThanOrEqual(0.6);
  });

  it('baking a map twice gives identical results', () => {
    expect(bakeLightmap(loadMap(DUNGEONS['pearly-gates'])).data).toEqual(lm.data);
  });

  describe('wall shadows', () => {
    // A corridor running east-west, 4 m wide, between 8 m walls: the sun (north-east) shines on the
    // south wall's north face over the north wall.
    const rows = ['#'.repeat(30), '#'.repeat(30), ...Array.from({ length: 4 }, () => '##' + '0'.repeat(26) + '##'), '#'.repeat(30), '#'.repeat(30)];
    const corridor = walled(mapOf(rows));

    it('in a corridor the sunny wall\'s foot is in shadow and its top is lit', () => {
      // The south wall's face looks north (normal −y), at y = 6.
      const top = corridor.heights.height[6 * corridor.w + 10];
      expect(facesSun(0, -1)).toBe(true);
      const z = shadowZ(corridor, 10.5, 6, 0, -1, 0, top);
      expect(z).toBeGreaterThan(0.5);
      expect(z).toBeLessThan(top);
    });

    it('a sun-facing face with nothing between it and the sun has its shadow line at its foot', () => {
      // The east side of a lone pillar in an open floor, toward the sun's east component.
      const open = walled(mapOf(['#'.repeat(40), ...Array.from({ length: 30 }, (_, r) => '#' + [...'0'.repeat(38)].map((ch, c) => (r === 20 && c === 10 ? '#' : ch)).join('') + '#'), '#'.repeat(40)]));
      expect(inShadow(open, 13, 20.5, 0.05)).toBe(false);
      expect(shadowZ(open, 12, 21.5, 1, 0, 0, 8)).toBe(0);
    });

    it('faces turned away from the sun get none', () => {
      expect(facesSun(0, 1)).toBe(false);
      expect(facesSun(-1, 0)).toBe(false);
    });
  });
});

describe('characters in the light (M10 §5.4)', () => {
  it('the tint is 1 in full sun, at least 0.85 in the darkest shadow, and 1 for a flyer', () => {
    expect(lightTint(1, false).brightness).toBeCloseTo(1);
    expect(lightTint(0, false).brightness).toBeGreaterThanOrEqual(0.85);
    expect(lightTint(0, true).brightness).toBeCloseTo(1);
  });
});
