import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons/index';
import { K_DOOR, K_FLOOR, K_WALL } from '../sim/heights';
import { loadMap } from '../sim/map';
import { BAND_MAX, bandTop, CORNICE, floorLooks, FRIEZE, FRIEZE_V, L_CORNICE, L_FLOOR, L_FLOOR_PLAIN, L_MEDALLION, L_PILASTER, L_WALL, L_WINDOW, segmentLook, TILE, wallPieces } from './looks';

const MAPS = ['sandbox', 'pearly-gates'] as const;
const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

describe('texture choice (M10 §5.1)', () => {
  for (const id of MAPS) {
    describe(id, () => {
      const map = loadMap(DUNGEONS[id]);
      const { w, h } = map;
      const hz = map.heights;
      const looks = floorLooks(map);

      it('the same map always gives the same looks', () => {
        const again = floorLooks(loadMap(DUNGEONS[id]));
        expect(again.layer).toEqual(looks.layer);
        expect(again.medallions).toEqual(looks.medallions);
      });

      it('wall segments alternate window and pilaster, with plain wall where cut or beside stairs', () => {
        let decorated = 0;
        for (let r = 0; r < h; r++) {
          for (let c = 0; c < w; c++) {
            if (hz.kind[r * w + c] !== K_WALL) continue;
            for (const [dx, dy] of DIRS) {
              const fc = c + dx;
              const fr = r + dy;
              if (fc < 0 || fr < 0 || fc >= w || fr >= h || hz.kind[fr * w + fc] !== K_FLOOR) continue;
              const look = segmentLook(map, c, r, dx, dy);
              const alongX = dy !== 0;
              const k = Math.floor((alongX ? c : r) / TILE);
              // Every cell of the segment is a wall looking onto floor at one height, or it's plain.
              let whole = true;
              const floors = new Set<number>();
              for (let j = 0; j < TILE; j++) {
                const cc = alongX ? k * TILE + j : c;
                const rr = alongX ? r : k * TILE + j;
                const ok = cc >= 0 && rr >= 0 && cc < w && rr < h && hz.kind[rr * w + cc] === K_WALL && hz.kind[(rr + dy) * w + cc + dx] === K_FLOOR;
                if (!ok) whole = false;
                else floors.add(map.floor[(rr + dy) * w + cc + dx]);
              }
              if (!whole || floors.size !== 1) expect(look).toBe(L_WALL);
              else {
                expect(look).toBe(k % 2 === 0 ? L_WINDOW : L_PILASTER);
                decorated++;
              }
            }
          }
        }
        expect(decorated).toBeGreaterThanOrEqual(id === 'pearly-gates' ? 300 : 40);
      });

      it('medallions sit on valid blocks, at each arena center and in front of each door', () => {
        for (const [c0, r0] of looks.medallions) {
          expect(c0 % 2).toBe(0);
          expect(r0 % 2).toBe(0);
          const f = map.floor[r0 * w + c0];
          for (let r = r0; r < r0 + 4; r++) {
            for (let c = c0; c < c0 + 4; c++) {
              expect(hz.kind[r * w + c]).toBe(K_FLOOR);
              expect(map.floor[r * w + c]).toBe(f);
              expect(looks.layer[r * w + c]).toBe(L_MEDALLION);
            }
          }
        }
        map.arenas.forEach((a) => {
          const cx = (a.rect.x0 + a.rect.x1 + 1) / 2;
          const cy = (a.rect.y0 + a.rect.y1 + 1) / 2;
          const center = looks.medallions.find(([c0, r0]) => Math.hypot(c0 + 2 - cx, r0 + 2 - cy) <= 6);
          expect(center, a.id).toBeDefined();
        });
        // Every other medallion is in front of a door: it touches a floor cell next to one.
        const doors = map.arenas.flatMap((a) => [a.doors, a.exitDoors ?? []]).filter((d) => d.length > 0);
        const centers = map.arenas.map((a) => {
          const cx = (a.rect.x0 + a.rect.x1 + 1) / 2;
          const cy = (a.rect.y0 + a.rect.y1 + 1) / 2;
          return looks.medallions.findIndex(([c0, r0]) => Math.hypot(c0 + 2 - cx, r0 + 2 - cy) <= 6);
        });
        looks.medallions.forEach(([c0, r0], k) => {
          if (centers.includes(k)) return;
          const touching = doors.some((door) => door.some(([dc, dr]) => DIRS.some(([dx, dy]) => dc + dx >= c0 && dc + dx < c0 + 4 && dr + dy >= r0 && dr + dy < r0 + 4)));
          expect(touching, `medallion ${c0},${r0}`).toBe(true);
        });
        // The Pearly Gates has door medallions (Arena 2's entry walkway is too narrow for one).
        if (id === 'pearly-gates') expect(looks.medallions.length).toBeGreaterThan(map.arenas.length + 3);
        // Nowhere else: one per arena center and at most one per door.
        const doorCount = map.arenas.reduce((n, a) => n + (a.doors.length ? 1 : 0) + ((a.exitDoors ?? []).length ? 1 : 0), 0);
        expect(looks.medallions.length).toBeLessThanOrEqual(map.arenas.length + doorCount);
      });

      it('tex-floor covers exactly the runners, whose edges lie on the 4 m grid', () => {
        for (const run of looks.runners) expect(run.from % 4).toBe(0);
        for (let i = 0; i < w * h; i++) {
          const k = hz.kind[i];
          if (k !== K_FLOOR && k !== K_DOOR) continue;
          if (looks.layer[i] === L_MEDALLION) continue;
          const c = i % w;
          const r = (i - c) / w;
          const inRunner = looks.runners.some((run) => run.zone === hz.zone[i] && (run.axis === 'x' ? r : c) >= run.from && (run.axis === 'x' ? r : c) < run.from + 4);
          expect(looks.layer[i]).toBe(inRunner ? L_FLOOR : L_FLOOR_PLAIN);
        }
        // Every arena has a cross of two runners; the Lobby and corridors one each.
        map.arenas.forEach((_, ai) => expect(looks.runners.filter((run) => run.zone === ai).map((run) => run.axis).sort()).toEqual(['x', 'y']));
      });
    });
  }
});

describe('the decorated band (M10 §5.1)', () => {
  it('reaches the cornice underside or 7.5 m above its floor, whichever is lower', () => {
    expect(bandTop(0, 8)).toBe(8 - CORNICE);
    expect(bandTop(0, 14.5)).toBe(BAND_MAX);
    expect(bandTop(4, 15)).toBe(4 + BAND_MAX);
  });

  for (const [floor, top] of [[0, 8], [0.5, 9.3], [4.5, 14.5], [7, 15]]) {
    it(`a face on floor ${floor} under a ${top} m wall shows one tile, its frieze at 1:1, then tex-wall and the cornice`, () => {
      const pieces = wallPieces(floor, top, floor, top, L_WINDOW);
      const band = pieces.filter((p) => p.layer === L_WINDOW);
      // One tile over the band: v from 0 at the floor to 1 at the band's top.
      expect(band[0].z0).toBe(floor);
      expect(band[0].v0).toBe(0);
      expect(band[band.length - 1].z1).toBeCloseTo(bandTop(floor, top));
      expect(band[band.length - 1].v1).toBeCloseTo(1);
      // The frieze rows at 1:1.
      expect(band[0].z1 - band[0].z0).toBeCloseTo(FRIEZE);
      expect(band[0].v1).toBeCloseTo(FRIEZE_V);
      expect((band[0].v1 - band[0].v0) * TILE).toBeCloseTo(band[0].z1 - band[0].z0);
      // Above a capped band, tex-wall's v starts at the band's top.
      const plain = pieces.find((p) => p.layer === L_WALL);
      if (bandTop(floor, top) < top - CORNICE) {
        expect(plain!.z0).toBeCloseTo(bandTop(floor, top));
        expect(plain!.v0).toBe(0);
        expect(plain!.z1 - plain!.z0).toBeLessThan(TILE);
      } else expect(plain).toBeUndefined();
      // The cornice along the top 1.5 m, one tile tall.
      const cornice = pieces[pieces.length - 1];
      expect(cornice.layer).toBe(L_CORNICE);
      expect(cornice.z0).toBeCloseTo(top - CORNICE);
      expect(cornice.v0).toBeCloseTo(0);
      expect(cornice.v1).toBeCloseTo(1);
    });
  }
});
