import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons/index';
import { K_FLOOR, K_PILLAR, K_VOID, K_WALL } from '../sim/heights';
import { loadMap } from '../sim/map';
import { L_WINDOW, segmentLook } from './looks';
import { computeRelief, CROWN_DEPTH, RECESS, RELIEF } from './relief';
import { WINDOW_GLASS } from './window.gen';

const MAPS = ['sandbox', 'pearly-gates'] as const;

describe('relief (M10 §5.3)', () => {
  for (const id of MAPS) {
    describe(id, () => {
      const map = loadMap(DUNGEONS[id]);
      const { w, h } = map;
      const hz = map.heights;
      const relief = computeRelief(map);
      const kind = (c: number, r: number) => (c < 0 || r < 0 || c >= w || r >= h ? K_VOID : hz.kind[r * w + c]);
      /** The zones of the floor cells within 2 cells of a face cell's front: the zones it overhangs. */
      const zonesNear = (c: number, r: number): number[] => {
        const out = new Set<number>();
        for (let rr = r - 2; rr <= r + 2; rr++) for (let cc = c - 2; cc <= c + 2; cc++) if (kind(cc, rr) === K_FLOOR) out.add(hz.zone[rr * w + cc]);
        return [...out];
      };

      it('every crown is at or above the zone top of every zone next to it, at most 0.35 m in front of its face', () => {
        expect(relief.crowns.length).toBeGreaterThan(id === 'pearly-gates' ? 100 : 10);
        for (const k of relief.crowns) {
          // The cells it covers: its ends are whole cells, 0.35 m past one (an outer corner), or 0.35 m
          // short of one (an inner corner).
          const cellOf = (a: number, end: boolean) => {
            const f = a - Math.floor(a);
            if (f < 1e-6 || f > 1 - 1e-6) return Math.round(a);
            return Math.abs(f - CROWN_DEPTH) < 1e-6 ? (end ? Math.floor(a) : Math.floor(a)) : end ? Math.ceil(a) : Math.ceil(a);
          };
          const cs = cellOf(k.a0, false);
          const ce = cellOf(k.a1, true);
          expect(ce).toBeGreaterThan(cs);
          expect(Math.abs(k.a0 - cs)).toBeLessThanOrEqual(CROWN_DEPTH + 1e-9);
          expect(Math.abs(k.a1 - ce)).toBeLessThanOrEqual(CROWN_DEPTH + 1e-9);
          const alongX = k.ny !== 0;
          for (let a = cs; a < ce; a++) {
            const c = alongX ? a : k.c;
            const r = alongX ? k.r : a;
            expect(kind(c, r) === K_WALL || kind(c, r) === K_PILLAR, `crown cell ${c},${r}`).toBe(true);
            expect(hz.height[r * w + c]).toBe(k.zt);
            // Its underside is at or above every zone top next to it.
            for (const z of zonesNear(c, r)) expect(k.zb).toBeGreaterThanOrEqual(hz.zoneTop[z] - 1e-4);
            // It never stands in front of a face that looks onto void.
            expect(kind(c + k.nx, r + k.ny)).not.toBe(K_VOID);
          }
        }
      });

      it('every pilaster strip stands RELIEF in front of a straight wall, at least 1 m from every convex corner, never on a pillar or before void', () => {
        expect(RELIEF).toBeLessThanOrEqual(0.12);
        for (const s of relief.strips) {
          expect(kind(s.c, s.r)).toBe(K_WALL);
          // The straight wall it stands on: the 4 m segment's cells are all walls with floor in front.
          const alongX = s.ny !== 0;
          for (let a = Math.floor(s.a0); a < Math.ceil(s.a1); a++) {
            const c = alongX ? a : s.c;
            const r = alongX ? s.r : a;
            expect(kind(c, r)).toBe(K_WALL);
            expect(kind(c + s.nx, r + s.ny)).toBe(K_FLOOR);
          }
          // Convex corners: a face end where the next cell along isn't wall. Find the nearest on both sides.
          for (const sgn of [-1, 1]) {
            let a = sgn < 0 ? Math.floor(s.a0) : Math.ceil(s.a1) - 1;
            for (;;) {
              const c = alongX ? a + sgn : s.c;
              const r = alongX ? s.r : a + sgn;
              if (kind(c, r) !== K_WALL && kind(c, r) !== K_PILLAR) break;
              if (kind(c + s.nx, r + s.ny) !== K_FLOOR) break;
              a += sgn;
            }
            const corner = sgn < 0 ? a : a + 1;
            if (kind(alongX ? corner - (sgn < 0 ? 1 : 0) : s.c, alongX ? s.r : corner - (sgn < 0 ? 1 : 0)) === K_FLOOR) {
              expect(Math.min(Math.abs(s.a0 - corner), Math.abs(s.a1 - corner))).toBeGreaterThanOrEqual(1);
            }
          }
        }
      });

      it('every window recess lies inside its wall cells, behind the face, only on window segments', () => {
        for (const win of relief.windows) {
          expect(segmentLook(map, win.c, win.r, win.nx, win.ny)).toBe(L_WINDOW);
          // The glass RECESS behind the face is inside the wall cells of the segment (each at least 1 m deep).
          expect(RECESS).toBeLessThan(1);
          for (const [a, z] of win.outline) {
            const alongX = win.ny !== 0;
            const behind = win.plane - RECESS * (alongX ? win.ny : win.nx);
            const c = alongX ? Math.floor(a) : Math.floor(behind);
            const r = alongX ? Math.floor(behind) : Math.floor(a);
            expect(kind(c, r)).toBe(K_WALL);
            expect(z).toBeGreaterThan(win.floor);
            expect(z).toBeLessThan(win.band);
          }
        }
        if (id === 'pearly-gates') expect(relief.windows.length).toBeGreaterThan(50);
      });

      it('building it twice gives identical results', () => {
        expect(computeRelief(loadMap(DUNGEONS[id]))).toEqual(relief);
      });
    });
  }

  it('the traced glass outline is symmetric and inside the frame', () => {
    const pts = WINDOW_GLASS;
    expect(pts.length).toBeLessThanOrEqual(24);
    for (const [u, v] of pts) {
      expect(pts.some(([u2, v2]) => Math.abs(u2 - (1 - u)) < 1e-4 && Math.abs(v2 - v) < 1e-4)).toBe(true);
      // The frame's inner edge in the prepared image: the glass spans columns 808-1 240 and rows
      // 348-1 514 of 2 048 (measured).
      expect(u).toBeGreaterThanOrEqual(806 / 2048);
      expect(u).toBeLessThanOrEqual(1242 / 2048);
      expect(v).toBeGreaterThanOrEqual(1 - 1516 / 2048);
      expect(v).toBeLessThanOrEqual(1 - 346 / 2048);
    }
  });
});
