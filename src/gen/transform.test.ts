import { describe, expect, it } from 'vitest';
import { orientGate } from './assign';
import { cell, entryCellsOf, mapSocket, ORIENTATIONS, orientedShape, point, rewardRect, socketCells, socketList, stripCells } from './transform';

const SHAPES = ['1x1', '2x1', '1x2', '2x2'] as const;

describe('the 8 orientations (rogue game.md §3.3 step 12)', () => {
  it('each is a bijection of the interior cells; identity is 0', () => {
    for (const [w, h] of [[32, 32], [68, 32], [68, 68]]) {
      for (const o of ORIENTATIONS) {
        const seen = new Set<string>();
        for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) seen.add(cell(o, w, h, [x, y]).join(','));
        expect(seen.size).toBe(w * h);
      }
      expect(cell(0, w, h, [3, 5])).toEqual([3, 5]);
    }
  });

  it('the group laws: four quarter-turns and two mirrors are the identity; mirror then 270° is the transpose', () => {
    const [w, h] = [68, 32];
    const turn = (c: [number, number], k: number) => {
      let p = c;
      let [ww, hh] = [w, h];
      for (let i = 0; i < k; i++) {
        p = cell(1, ww, hh, p);
        [ww, hh] = [hh, ww];
      }
      return p;
    };
    for (const c of [[0, 0], [5, 17], [67, 31]] as Array<[number, number]>) {
      expect(turn(c, 4)).toEqual(c);
      expect(cell(4, w, h, cell(4, w, h, c))).toEqual(c);
      expect(cell(2, w, h, c)).toEqual(turn(c, 2));
      expect(cell(7, w, h, c)).toEqual([c[1], c[0]]);
    }
  });

  it('a quarter-turn swaps a rectangle’s sides; 0 and 7 put a 2×1 template on 2×1 and 1×2 rooms', () => {
    expect(ORIENTATIONS.map((o) => orientedShape(o, '2x1'))).toEqual(['2x1', '1x2', '2x1', '1x2', '2x1', '1x2', '2x1', '1x2']);
  });
});

describe('sockets (rogue game.md §3.4)', () => {
  it('are numbered clockwise from the top-left', () => {
    const name = (shape: (typeof SHAPES)[number]) => socketList(shape).map((s) => `${'NESW'[s.dir]}${s.sx}${s.sy}`);
    expect(name('1x1')).toEqual(['N00', 'E00', 'S00', 'W00']);
    expect(name('2x1')).toEqual(['N00', 'N10', 'E10', 'S10', 'S00', 'W00']);
    expect(name('1x2')).toEqual(['N00', 'E00', 'E01', 'S01', 'W01', 'W00']);
    expect(name('2x2')).toEqual(['N00', 'N10', 'E10', 'E11', 'S11', 'S01', 'W01', 'W00']);
  });

  it('a 1×1 quarter-turn adds 1 mod 4; a mirror keeps N/S and swaps E/W', () => {
    for (let s = 0; s < 4; s++) expect(mapSocket(1, '1x1', s)).toBe((s + 1) % 4);
    expect([0, 1, 2, 3].map((s) => mapSocket(4, '1x1', s))).toEqual([0, 3, 2, 1]);
  });

  it('a 2×2 quarter-turn adds 2 mod 8; a mirror swaps 0↔1, 2↔7, 3↔6, 4↔5', () => {
    for (let s = 0; s < 8; s++) expect(mapSocket(1, '2x2', s)).toBe((s + 2) % 8);
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((s) => mapSocket(4, '2x2', s))).toEqual([1, 0, 7, 6, 5, 4, 3, 2]);
  });

  it('a 2×1 quarter-turn maps N-left→E-top, N-right→E-bottom, E→S, S-right→W-bottom, S-left→W-top, W→N', () => {
    expect([0, 1, 2, 3, 4, 5].map((s) => mapSocket(1, '2x1', s))).toEqual([1, 2, 3, 4, 5, 0]);
  });

  it('sit at offsets 12–15 (and 48–51), strips 6 deep, entry cells 3 in', () => {
    expect(socketCells('1x1', 0)).toEqual([[12, 0], [13, 0], [14, 0], [15, 0]]);
    expect(socketCells('2x2', 3)).toEqual([[67, 48], [67, 49], [67, 50], [67, 51]]);
    expect(socketCells('1x2', 4)).toEqual([[0, 48], [0, 49], [0, 50], [0, 51]]);
    expect(stripCells('1x1', 3).length).toBe(24);
    expect(stripCells('1x1', 3).every(([x, y]) => x <= 5 && y >= 12 && y <= 15)).toBe(true);
    expect(entryCellsOf('1x1', 2)).toEqual([[12, 28], [13, 28], [14, 28], [15, 28]]);
  });
});

describe('the reward square and the gate under all 8 orientations', () => {
  it('rewardSpot transforms all four corners and keeps the minimum', () => {
    // The Gate's (32,32)–(35,35) mirrors onto itself (rooms.md §2.2); its old top-left alone would be (35, 32).
    expect(rewardRect(4, 68, 68, [32, 32])).toEqual([32, 32]);
    expect(cell(4, 68, 68, [32, 32])).toEqual([35, 32]);
    for (const o of ORIENTATIONS) {
      const [x, y] = rewardRect(o, 32, 32, [2, 5]);
      const corners = [[2, 5], [5, 5], [2, 8], [5, 8]].map((c) => cell(o, 32, 32, c as [number, number]));
      expect([x, y]).toEqual([Math.min(...corners.map((c) => c[0])), Math.min(...corners.map((c) => c[1]))]);
    }
  });

  it('the gate is continuous: the 52-cell span stays [8, 60) about 34 on a boundary plane', () => {
    const g = { facing: 'W', plane: 0, u0: 8, u1: 60, uCenter: 34 } as const;
    const got = ORIENTATIONS.map((o) => orientGate(g, o, 68, 68));
    expect(got.map((q) => q.facing)).toEqual(['W', 'N', 'E', 'S', 'E', 'S', 'W', 'N']);
    for (const q of got) {
      expect([q.u0, q.u1, q.uCenter]).toEqual([8, 60, 34]);
      expect([0, 68]).toContain(q.plane);
    }
    // A mirrored west boundary is at x = 68, not 67 (rogue game.md §14.2).
    expect(got[4]).toEqual({ facing: 'E', plane: 68, u0: 8, u1: 60, uCenter: 34 });
    expect(point(4, 68, 68, [0, 34])).toEqual([68, 34]);
  });
});
