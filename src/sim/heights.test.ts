import { describe, expect, it } from 'vitest';
import { DUNGEONS } from '../data/dungeons/index';
import { BOSS_EYE } from './sim';
import { PHASE_COMBAT } from '../net/protocol';
import { PLAYER_EYE, PLAYER_HEIGHT, WALL_TOP, JUMP_VZ, GRAVITY } from './constants';
import { computeHeights, CROWN, HEADROOM, K_DOOR, K_FLOOR, K_OPEN, K_PILLAR, K_VOID, K_WALL, PARAPET, WALL_MIN, type Heights } from './heights';
import { lineOfSight } from './los';
import { loadMap, setArenaDoors, type GameMap } from './map';

const MAPS = ['sandbox', 'pearly-gates'] as const;
const DX8 = [1, -1, 0, 0, 1, 1, -1, -1];
const DY8 = [0, 0, 1, -1, 1, -1, 1, -1];

/** The map with every door closed. */
function closedMap(id: string): GameMap {
  const map = loadMap(DUNGEONS[id]);
  map.arenas.forEach((_, ai) => setArenaDoors(map, ai, PHASE_COMBAT));
  return map;
}

/** The same map with every wall cell, closed door and the outside of the grid at 16 m (before M10). */
function with16(map: GameMap): GameMap {
  const top = map.top.slice();
  for (let i = 0; i < top.length; i++) if (map.wall[i] || map.solid[i]) top[i] = WALL_TOP;
  // A margin of 16 m cells around the grid stands in for the old "outside is 16 m".
  const w = map.w + 2;
  const h = map.h + 2;
  const padded = new Float32Array(w * h).fill(WALL_TOP);
  for (let r = 0; r < map.h; r++) padded.set(top.subarray(r * map.w, (r + 1) * map.w), (r + 1) * w + 1);
  return { ...map, w, h, top: padded };
}

/** Line of sight on the padded map, in the original map's coordinates. */
function los16(m16: GameMap, ax: number, ay: number, az: number, bx: number, by: number, bz: number): boolean {
  return lineOfSight(m16, ax + 1, ay + 1, az, bx + 1, by + 1, bz);
}

function neighbors(map: GameMap, c: number, r: number): number[] {
  const out: number[] = [];
  for (let k = 0; k < 8; k++) {
    const cc = c + DX8[k];
    const rr = r + DY8[k];
    if (cc >= 0 && rr >= 0 && cc < map.w && rr < map.h && !map.wall[rr * map.w + cc]) out.push(rr * map.w + cc);
  }
  return out;
}

/** Whether the segment passes over an open-edge or void cell, or outside the grid. */
function crossesOpen(map: GameMap, ax: number, ay: number, bx: number, by: number): boolean {
  const steps = Math.ceil(Math.hypot(bx - ax, by - ay) / 0.05);
  for (let i = 0; i <= steps; i++) {
    const c = Math.floor(ax + ((bx - ax) * i) / steps);
    const r = Math.floor(ay + ((by - ay) * i) / steps);
    if (c < 0 || r < 0 || c >= map.w || r >= map.h) return true;
    const k = map.heights.kind[r * map.w + c];
    if (k === K_OPEN || k === K_VOID) return true;
  }
  return false;
}

/** Sample points every `step` cells in every zone, at its floor + 0.1 m and at its zone top − 0.1 m. */
function samples(map: GameMap, step: number, low: number): Array<{ zone: number; x: number; y: number; z: number }> {
  const out: Array<{ zone: number; x: number; y: number; z: number }> = [];
  const hz = map.heights;
  for (let r = 0; r < map.h; r += step) {
    for (let c = 0; c < map.w; c += step) {
      const i = r * map.w + c;
      if (hz.kind[i] !== K_FLOOR) continue;
      const z = hz.zone[i];
      out.push({ zone: z, x: c + 0.5, y: r + 0.5, z: map.floor[i] + low });
      out.push({ zone: z, x: c + 0.5, y: r + 0.5, z: hz.zoneTop[z] - 0.1 });
    }
  }
  return out;
}

describe('wall heights (M10 §3.2)', () => {
  it('HEADROOM is 5.3 m', () => {
    expect(HEADROOM).toBeCloseTo(5.3);
  });

  for (const id of MAPS) {
    describe(id, () => {
      const map = loadMap(DUNGEONS[id]);
      const hz = map.heights;
      const { w } = map;

      it('computing them twice gives identical results', () => {
        const again: Heights = computeHeights(map);
        expect(again.kind).toEqual(hz.kind);
        expect(again.zone).toEqual(hz.zone);
        expect(again.height).toEqual(hz.height);
        expect(again.openTop).toEqual(hz.openTop);
        expect(again.bays).toEqual(hz.bays);
      });

      it('walls, pillars and doors are CROWN above every zone top next to them and WALL_MIN above their floors', () => {
        for (let i = 0; i < w * map.h; i++) {
          const k = hz.kind[i];
          if (k !== K_WALL && k !== K_PILLAR && k !== K_DOOR) continue;
          for (const j of neighbors(map, i % w, Math.floor(i / w))) {
            expect(hz.height[i]).toBeGreaterThanOrEqual(hz.zoneTop[hz.zone[j]] + CROWN - 1e-4);
            expect(hz.height[i]).toBeGreaterThanOrEqual(map.floor[j] + WALL_MIN - 1e-4);
          }
        }
      });

      it('open edges are PARAPET above their bay base, or their highest floor, and above every floor next to them', () => {
        const inBay = new Map<number, number>();
        for (const b of hz.bays) for (const [c, r] of b.cells) inBay.set(r * w + c, b.base);
        for (let i = 0; i < w * map.h; i++) {
          if (hz.kind[i] !== K_OPEN) continue;
          const ns = neighbors(map, i % w, Math.floor(i / w));
          const highest = Math.max(...ns.map((j) => map.floor[j]));
          const base = inBay.get(i) ?? highest;
          expect(hz.height[i]).toBeCloseTo(base + PARAPET);
          for (const j of ns) expect(hz.height[i]).toBeGreaterThanOrEqual(map.floor[j] + PARAPET - 1e-4);
        }
      });

      it('no height exceeds WALL_TOP', () => {
        for (let i = 0; i < w * map.h; i++) expect(hz.height[i]).toBeLessThanOrEqual(WALL_TOP);
      });

      it('every pillar group has one height, and the bays of one run one top', () => {
        // Pillar cells next to each other share a height.
        for (let i = 0; i < w * map.h; i++) {
          if (hz.kind[i] !== K_PILLAR) continue;
          if (i % w + 1 < w && hz.kind[i + 1] === K_PILLAR) expect(hz.height[i + 1]).toBe(hz.height[i]);
          if (i + w < w * map.h && hz.kind[i + w] === K_PILLAR) expect(hz.height[i + w]).toBe(hz.height[i]);
        }
        // Neighboring bays of one side share their top.
        for (const a of hz.bays) {
          for (const b of hz.bays) {
            const [ac, ar] = a.cells[3];
            const [bc, br] = b.cells[0];
            if (a.ox === b.ox && a.oy === b.oy && Math.abs(bc - ac) + Math.abs(br - ar) === 1) expect(b.top).toBe(a.top);
          }
        }
      });

      it('every cell of a run has the highest height of the runs it is in', () => {
        // Along each run (a straight line of wall cells facing floor of one zone in one direction), the
        // heights can only differ where a cell is also in a taller run, so none is lower than the run's
        // table height: check that the height never steps down along a run except to a cell of another.
        for (let k = 0; k < 4; k++) {
          const fx = DX8[k];
          const fy = DY8[k];
          const ax = fy !== 0 ? 1 : 0;
          const ay = fx !== 0 ? 1 : 0;
          const faceZone = (c: number, r: number) => {
            if (c < 0 || r < 0 || c >= w || r >= map.h || hz.kind[r * w + c] !== K_WALL) return -1;
            const fc = c + fx;
            const fr = r + fy;
            if (fc < 0 || fr < 0 || fc >= w || fr >= map.h || map.wall[fr * w + fc]) return -1;
            return hz.zone[fr * w + fc];
          };
          for (let r = 0; r < map.h; r++) {
            for (let c = 0; c < w; c++) {
              const z = faceZone(c, r);
              if (z < 0 || faceZone(c - ax, r - ay) === z) continue;
              const cells: number[] = [];
              for (let cc = c, rr = r; faceZone(cc, rr) === z; cc += ax, rr += ay) cells.push(rr * w + cc);
              const min = Math.min(...cells.map((j) => hz.height[j]));
              const table = Math.max(...cells.map((j) => {
                let t = -Infinity;
                for (const n of neighbors(map, j % w, Math.floor(j / w))) t = Math.max(t, hz.zoneTop[hz.zone[n]] + CROWN, map.floor[n] + WALL_MIN);
                return t;
              }));
              expect(min).toBeGreaterThanOrEqual(table - 1e-4);
            }
          }
        }
      });
    });
  }

  it('the Pearly Gates has at least one open edge in every arena, and bays', () => {
    const map = loadMap(DUNGEONS['pearly-gates']);
    const hz = map.heights;
    map.arenas.forEach((_, ai) => {
      let found = false;
      for (let i = 0; i < map.w * map.h && !found; i++) {
        if (hz.kind[i] !== K_OPEN) continue;
        if (neighbors(map, i % map.w, Math.floor(i / map.w)).some((j) => hz.zone[j] === ai)) found = true;
      }
      expect(found, `arena ${ai}`).toBe(true);
    });
    expect(hz.bays.length).toBeGreaterThan(10);
    for (const b of hz.bays) {
      const along = b.ox === 0 ? b.cells[0][0] : b.cells[0][1];
      expect(along % 4).toBe(0);
    }
  });
});

describe('zones never see each other (M10 §3.1)', () => {
  for (const id of MAPS) {
    it(`${id}: no line of sight between points of different zones with all doors closed`, () => {
      const map = closedMap(id);
      const pts = samples(map, 2, 0.1);
      let leaks = 0;
      const examples: string[] = [];
      for (let a = 0; a < pts.length; a++) {
        const p = pts[a];
        for (let b = a + 1; b < pts.length; b++) {
          const q = pts[b];
          if (p.zone === q.zone) continue;
          if (lineOfSight(map, p.x, p.y, p.z, q.x, q.y, q.z)) {
            leaks++;
            if (examples.length < 5) examples.push(`${JSON.stringify(p)} -> ${JSON.stringify(q)}`);
          }
        }
      }
      expect(leaks, examples.join('\n')).toBe(0);
    });
  }
});

describe('gameplay inside a zone is unchanged (M10 §3.4)', () => {
  for (const id of MAPS) {
    it(`${id}: line of sight within a zone equals line of sight with every wall at 16 m`, () => {
      const map = closedMap(id);
      const m16 = with16(map);
      const pts = samples(map, 4, PLAYER_EYE);
      let diffs = 0;
      for (let a = 0; a < pts.length; a++) {
        const p = pts[a];
        for (let b = a + 1; b < pts.length; b++) {
          const q = pts[b];
          if (p.zone !== q.zone) continue;
          const now = lineOfSight(map, p.x, p.y, p.z, q.x, q.y, q.z);
          if (now === los16(m16, p.x, p.y, p.z, q.x, q.y, q.z)) continue;
          if (crossesOpen(map, p.x, p.y, q.x, q.y)) continue;
          diffs++;
        }
      }
      expect(diffs).toBe(0);
    });
  }

  it("Judgment cover is unchanged: from the Gatekeeper's eye to every floor cell of the boss arena", () => {
    const map = closedMap('pearly-gates');
    const m16 = with16(map);
    const [bc, br] = map.boss!;
    const ex = bc + 0.5;
    const ey = br + 0.5;
    const ez = map.floor[br * map.w + bc] + BOSS_EYE;
    const boss = map.arenas[map.arenas.length - 1];
    const jump = (JUMP_VZ * JUMP_VZ) / (2 * GRAVITY);
    let hidden = 0;
    for (let r = boss.rect.y0; r <= boss.rect.y1; r++) {
      for (let c = boss.rect.x0; c <= boss.rect.x1; c++) {
        const i = r * map.w + c;
        if (map.wall[i]) continue;
        for (const lift of [0, jump]) {
          const z = map.floor[i] + lift + PLAYER_HEIGHT / 2;
          const now = lineOfSight(map, ex, ey, ez, c + 0.5, r + 0.5, z);
          expect(now, `cell ${c},${r} lift ${lift}`).toBe(los16(m16, ex, ey, ez, c + 0.5, r + 0.5, z));
          if (!now) hidden++;
        }
      }
    }
    // The pillars do hide cells.
    expect(hidden).toBeGreaterThan(50);
  });
});

describe('open edges (M10 §3.3)', () => {
  it('in the Pearly Gates: the Lobby west, Arena 1 north, Arena 2 north and east, Arena 3 east, the boss arena south', () => {
    const map = loadMap(DUNGEONS['pearly-gates']);
    const hz = map.heights;
    const sides = new Set<string>();
    for (const b of hz.bays) {
      const [c, r] = b.cells[0];
      const zone = hz.zone[(r - b.oy) * map.w + c - b.ox];
      sides.add(`${zone}:${b.ox},${b.oy}`);
    }
    const lobby = hz.zone[20 * map.w + 5];
    expect([...sides].sort()).toEqual([`${lobby}:-1,0`, '0:0,-1', '1:0,-1', '1:1,0', '2:1,0', '3:0,1'].sort());
  });
});
