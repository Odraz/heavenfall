import { describe, expect, it } from 'vitest';
import { PEARLY_POOL_R1 } from './1/index';
import { expandRoom } from './notation';
import { templateSize } from './types';

/** A 1×1 combat block grid: base floor, its four strips, a reward square; `edit` changes blocks. */
function room1x1(edit: (h: string[][], f: string[][]) => void = () => {}, extra = ''): string {
  const h = Array.from({ length: 16 }, () => new Array<string>(16).fill('.'));
  const f = Array.from({ length: 16 }, () => new Array<string>(16).fill('.'));
  for (let y = 0; y < 3; y++) for (const x of [6, 7]) h[y][x] = h[15 - y][x] = ':';
  for (let x = 0; x < 3; x++) for (const y of [6, 7]) h[y][x] = h[y][15 - x] = ':';
  for (const [x, y] of [[9, 9], [10, 9], [9, 10], [10, 10]]) f[y][x] = 'R';
  edit(h, f);
  const rows = h.map((row, i) => `${String(i).padStart(2)} ${row.join('')} ${f[i].join('')}`);
  return ['id        t', 'name      T', 'kind      combat', 'shape     1x1', 'focus     ranged', 'bands     1 2', 'grid', ...rows, extra].join('\n');
}

/** The heights (m) of a template's cells along column x from row y0 to y1. */
function column(t: ReturnType<typeof expandRoom>, x: number, y0: number, y1: number): number[] {
  const out: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const ch = t.heights[y][x];
    const i = ch.charCodeAt(0) >= 97 ? ch.charCodeAt(0) - 97 + 10 : ch.charCodeAt(0) - 48;
    out.push(i * 0.25);
  }
  return out;
}

describe('the block notation (rooms.md §2.1)', () => {
  it('one block ^ from . to 1 gives 2.5 and 3.0', () => {
    const t = expandRoom(room1x1((h) => {
      h[3][3] = '1';
      h[4][3] = '^';
    }));
    // The run's cells from the low (south) end: rows 9 then 8.
    expect(column(t, 6, 8, 9).reverse()).toEqual([2.5, 3]);
    expect(column(t, 7, 8, 9).reverse()).toEqual([2.5, 3]);
  });

  it('two blocks from . to 2 give 2.5, 3.0, 3.5 and 4.0', () => {
    const t = expandRoom(room1x1((h) => {
      h[2][3] = '2';
      h[3][3] = '^';
      h[4][3] = '^';
    }));
    expect(column(t, 6, 6, 9).reverse()).toEqual([2.5, 3, 3.5, 4]);
  });

  it('three blocks from = to . give 0.5 … 2.0, the last cells 2.0', () => {
    const t = expandRoom(room1x1((h) => {
      for (const y of [2, 3, 4]) h[y][3] = 'v';
      h[1][3] = '=';
      h[5][3] = '.';
      h[1][2] = h[1][4] = '-';
    }));
    // 'v' rises south: from row 4 (block 2, after the well at block 1) to row 9.
    expect(column(t, 6, 4, 9)).toEqual([0.5, 1, 1.5, 2, 2, 2]);
  });

  it('rejects a stair run that climbs too far', () => {
    expect(() => expandRoom(room1x1((h) => {
      h[3][3] = '1';
      h[4][3] = '^';
      h[5][3] = '=';
    }))).toThrow(/climbs/);
  });

  it("rejects a ':' block outside its shape's strips, and a strip block that isn't ':'", () => {
    expect(() => expandRoom(room1x1((h) => (h[10][10] = ':')))).toThrow(/outside/);
    expect(() => expandRoom(room1x1((h) => (h[0][6] = '.')))).toThrow(/isn't ':'/);
  });

  it("rejects 'a' or 'f' off a B block", () => {
    expect(() => expandRoom(room1x1((_h, f) => (f[4][4] = 'a')))).toThrow(/isn't on a B block/);
    expect(() => expandRoom(room1x1((h, f) => {
      h[4][4] = 'B';
      f[4][4] = 'f';
    }))).not.toThrow();
  });

  it('rejects the wrong count of S, P or M', () => {
    expect(() => expandRoom(room1x1((_h, f) => (f[4][4] = 'S')))).toThrow(/S, expected 0/);
    expect(() => expandRoom(room1x1((_h, f) => (f[4][4] = 'P')))).toThrow(/P, expected 0/);
    expect(() => expandRoom(room1x1((_h, f) => (f[4][4] = 'M')))).toThrow(/M, expected 0/);
  });

  it('turns features, obstacles, props and waves into the template', () => {
    const t = expandRoom(room1x1((h, f) => {
      h[4][4] = '#';
      f[1][1] = 'x';
      f[2][2] = 'o';
      f[2][3] = '!';
      f[3][2] = 'o';
      f[5][5] = 'c';
    }, ['obstacles', '  cover  4,4 4,4 a pillar', 'props     loot 0.8 blast 0.75', 'waves', '  1 0.4 blessed 0.7 chorister 0.3 elites 1'].join('\n')));
    expect(t.markers[2][2]).toBe('x');
    expect(t.markers[10][10]).toBe('c');
    expect(t.rewardSpot).toEqual([18, 18]);
    expect(t.props).toEqual([
      { at: [4, 4], family: 'loot', chance: 0.8 },
      { at: [6, 4], family: 'blast', chance: 0.75 },
      { at: [4, 6], family: 'loot', chance: 0.8 },
    ]);
    expect(t.obstacles).toEqual([{ rect: { x0: 8, y0: 8, x1: 9, y1: 9 }, purpose: 'cover', note: 'a pillar' }]);
    expect(t.waves).toEqual([{ share: 0.4, mix: { blessed: 0.7, chorister: 0.3 }, elites: 1 }]);
    expect(t.heights[8].slice(8, 10)).toBe('##');
  });
});

describe('the R1 pool expands', () => {
  it('every template has its shape’s grid size', () => {
    for (const t of PEARLY_POOL_R1) {
      const [w, h] = templateSize(t.shape);
      expect(t.heights.length, t.id).toBe(h);
      expect(t.markers.length, t.id).toBe(h);
      for (const row of [...t.heights, ...t.markers]) expect(row.length, t.id).toBe(w);
    }
  });

  it('the boss: its point, 20 add markers split 8 gate / 12 field, 12 Watcher anchors and the gate insets', () => {
    const gate = PEARLY_POOL_R1.find((t) => t.kind === 'boss')!;
    expect(gate.points?.boss).toEqual([10, 34]);
    expect(gate.markers[34][10]).toBe('B');
    expect(gate.points?.addSpawns?.gate.length).toBe(8);
    expect(gate.points?.addSpawns?.field.length).toBe(12);
    expect(gate.points?.watchers?.length).toBe(12);
    expect(gate.entrySocket).toBe(3);
    expect(gate.gate).toEqual({ facing: 'W', plane: 0, u0: 8, u1: 60, uCenter: 34 });
    for (const y of [0, 8, 59, 67]) expect(gate.heights[y].slice(0, 4)).toBe('####');
    for (const y of [9, 58]) expect(gate.heights[y][0]).not.toBe('#');
  });

  it('the Pardoner lists four item pedestals, then the map pedestal', () => {
    const p = PEARLY_POOL_R1.find((t) => t.kind === 'pardoner')!;
    expect(p.points?.pedestals).toEqual([[8, 8], [22, 8], [8, 22], [22, 22], [18, 10]]);
  });

  it('the Breach has its four starts and six amphorae', () => {
    const b = PEARLY_POOL_R1.find((t) => t.kind === 'breach')!;
    expect(b.markers.join('').split('S').length - 1).toBe(4);
    expect(b.props.map((q) => q.family)).toEqual(new Array(6).fill('loot'));
  });
});
