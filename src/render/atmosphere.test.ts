import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons/index';
import { K_DOOR, K_FLOOR } from '../sim/heights';
import { loadMap } from '../sim/map';
import { computeArches } from './arches';
import { MAX_SHAFTS, placeCards, placeShafts, shaftThroughOpening } from './atmosphere';
import { SUN_DIR_X, SUN_DIR_Y } from './sun';

describe('atmosphere (M10 §7)', () => {
  const map = loadMap(DUNGEONS['pearly-gates']);
  const cards = placeCards(map);
  const arches = computeArches(map);

  it('no cloud or spire card, at its full size and drift, is over a floor cell', () => {
    for (const c of cards) {
      const rad = c.size / 2 + c.drift;
      for (let r = Math.max(0, Math.floor(c.y - rad)); r <= Math.min(map.h - 1, Math.floor(c.y + rad)); r++) {
        for (let col = Math.max(0, Math.floor(c.x - rad)); col <= Math.min(map.w - 1, Math.floor(c.x + rad)); col++) {
          const k = map.heights.kind[r * map.w + col];
          if (k !== K_FLOOR && k !== K_DOOR) continue;
          const dx = Math.max(col - c.x, 0, c.x - (col + 1));
          const dy = Math.max(r - c.y, 0, c.y - (r + 1));
          expect(dx * dx + dy * dy, `${c.kind} at ${c.x.toFixed(1)},${c.y.toFixed(1)}`).toBeGreaterThanOrEqual(rad * rad);
        }
      }
    }
    expect(cards.filter((c) => c.kind === 'sea').length).toBeGreaterThanOrEqual(30);
    expect(cards.filter((c) => c.kind === 'bank').length).toBeGreaterThanOrEqual(10);
    expect(cards.filter((c) => c.kind === 'wisp').length).toBeLessThanOrEqual(20);
  });

  it('6 to 12 spires, at least 25 m apart, all outside the grid', () => {
    const spires = cards.filter((c) => c.kind === 'spire');
    expect(spires.length).toBeGreaterThanOrEqual(6);
    expect(spires.length).toBeLessThanOrEqual(12);
    for (const s of spires) {
      expect(s.x < 0 || s.y < 0 || s.x > map.w || s.y > map.h).toBe(true);
      for (const o of spires) if (o !== s) expect(Math.hypot(o.x - s.x, o.y - s.y)).toBeGreaterThanOrEqual(25);
    }
  });

  it("the mesh's instances are ordered far to near from the level's center", () => {
    const d = cards.map((c) => Math.hypot(c.x - map.w / 2, c.y - map.h / 2));
    for (let i = 1; i < d.length; i++) expect(d[i]).toBeLessThanOrEqual(d[i - 1] + 1e-9);
  });

  it('placing them twice gives identical results', () => {
    expect(placeCards(loadMap(DUNGEONS['pearly-gates']))).toEqual(cards);
  });

  it('at most 24 light shafts, each through a sunlit bay', () => {
    const shafts = placeShafts(arches);
    expect(shafts.length).toBeGreaterThan(0);
    expect(shafts.length).toBeLessThanOrEqual(MAX_SHAFTS);
    for (const s of shafts) {
      const b = arches.bays[s.bay];
      expect(-b.nx * SUN_DIR_X - b.ny * SUN_DIR_Y).toBeGreaterThan(0);
      expect(shaftThroughOpening(arches, s)).toBe(true);
      // It runs down and into the level, to its bay's floor.
      expect(s.bottom[2]).toBeCloseTo(b.base);
      expect((s.bottom[0] - s.top[0]) * b.nx + (s.bottom[1] - s.top[1]) * b.ny).toBeGreaterThan(0);
    }
  });
});
