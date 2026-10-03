import { describe, expect, it } from 'vitest';
import type { DungeonDef } from '../data/dungeons/types';
import { loadMap, MapError } from './map';

function def(heights: string[], markers: string[], arenas: DungeonDef['arenas'] = [], decor?: DungeonDef['decor']): DungeonDef {
  return { id: 't', name: 'T', heights, markers, arenas, decor };
}

const H = ['#######', '#0123a#', '#00z00#', '#######'];
const M = ['.......', '.S.S...', '.S.S...', '.......'];

function expectError(d: DungeonDef, row: number, col: number) {
  try {
    loadMap(d);
  } catch (e) {
    expect(e).toBeInstanceOf(MapError);
    expect((e as MapError).row).toBe(row);
    expect((e as MapError).col).toBe(col);
    expect((e as MapError).message).toContain(`row ${row}, column ${col}`);
    return;
  }
  throw new Error('expected a MapError');
}

describe('map loader', () => {
  it('parses heights and markers', () => {
    const m = loadMap(def(H, ['.......', '.S.Sx..', '.S.S.B.', '.......']));
    expect(m.w).toBe(7);
    expect(m.h).toBe(4);
    expect(m.wall[0]).toBe(1);
    expect(m.floor[1 * 7 + 1]).toBe(0);
    expect(m.floor[1 * 7 + 2]).toBe(0.25);
    expect(m.floor[1 * 7 + 4]).toBe(0.75);
    expect(m.floor[1 * 7 + 5]).toBe(2.5);
    expect(m.floor[2 * 7 + 3]).toBe(8.75);
    expect(m.spawns).toEqual([[1, 1], [3, 1], [1, 2], [3, 2]]);
    expect(m.boss).toEqual([5, 2]);
    expect(m.top[0]).toBe(16);
  });

  it('parses decorations', () => {
    const m = loadMap(def(H, ['.......', '.S.Sh..', '.S.S.u.', '.......'], [], { h: 'harp', u: 'lily-urn' }));
    expect(m.decorations).toEqual([
      { id: 'harp', c: 4, r: 1 },
      { id: 'lily-urn', c: 5, r: 2 },
    ]);
  });

  it('parses doors and assigns them to arenas', () => {
    const m = loadMap(
      def(H, ['.......', '.S.S.D.', '.S.S...', '.......'], [
        { id: 'a', name: 'A', rect: { x0: 4, y0: 1, x1: 5, y1: 2 }, doors: [[5, 1]], entryCells: [], waves: [], boss: false },
      ]),
    );
    expect(m.doorArena[1 * 7 + 5]).toBe(0);
    expect(m.doorArena[1 * 7 + 4]).toBe(-1);
  });

  it('rejects an empty grid', () => expectError(def([], []), 0, 0));
  it('rejects a grid larger than 256 × 256', () => {
    expectError(def(Array(257).fill('#'), Array(257).fill('.')), 256, 0);
    expectError(def(['#'.repeat(257)], ['.'.repeat(257)]), 0, 256);
  });
  it('rejects grids of different sizes', () => expectError(def(H, M.slice(0, 3)), 3, 0));
  it('rejects a row of a different length', () => {
    expectError(def([H[0], H[1], '#00z0#', H[3]], M), 2, 6);
    expectError(def(H, [M[0], '.S.S..', M[2], M[3]]), 1, 6);
  });
  it('rejects an unknown height character', () => expectError(def([H[0], '#0123A#', H[2], H[3]], M), 1, 5));
  it('rejects an unknown marker character', () => expectError(def(H, [M[0], '.S.S.q.', M[2], M[3]]), 1, 5));
  it('rejects a marker on a wall', () => expectError(def(H, ['..x....', M[1], M[2], M[3]]), 0, 2));
  it('rejects a decoration on a wall', () => expectError(def(H, ['...h...', M[1], M[2], M[3]], [], { h: 'harp' }), 0, 3));
  it('rejects a decoration key that is a reserved marker character', () => {
    expectError(def(H, M, [], { S: 'harp' }), 1, 1);
    expectError(def(H, M, [], { x: 'harp' }), 0, 0);
  });
  it('rejects an unknown decoration ID', () => {
    expectError(def(H, [M[0], '.S.Sq..', M[2], M[3]], [], { q: 'gargoyle' as 'harp' }), 1, 4);
  });
  it('rejects more than 4 S markers', () => expectError(def(H, [M[0], '.S.SS..', M[2], M[3]]), 2, 3));
  it('rejects fewer than 4 S markers', () => expectError(def(H, [M[0], '.S.....', M[2], M[3]]), 0, 0));
  it('rejects more than one B', () => expectError(def(H, [M[0], '.S.SB..', '.S.S.B.', M[3]]), 2, 5));
  it("rejects an arena door entry that isn't a D cell", () => {
    expectError(
      def(H, M, [{ id: 'a', name: 'A', rect: { x0: 4, y0: 1, x1: 5, y1: 2 }, doors: [[5, 2]], entryCells: [], waves: [], boss: false }]),
      2,
      5,
    );
  });
  it("rejects a D cell that isn't in any arena's doors", () => expectError(def(H, [M[0], '.S.S.D.', M[2], M[3]]), 1, 5));
  it("rejects a D cell that's in two arenas' doors", () => {
    const a = { id: 'a', name: 'A', rect: { x0: 4, y0: 1, x1: 4, y1: 1 }, doors: [[5, 1]] as Array<[number, number]>, entryCells: [], waves: [], boss: false };
    expectError(def(H, [M[0], '.S.S.D.', M[2], M[3]], [a, { ...a, id: 'b', rect: { x0: 5, y0: 2, x1: 5, y1: 2 } }]), 1, 5);
  });
});
