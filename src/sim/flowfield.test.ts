import { describe, expect, it } from 'vitest';
import { FlowField, UNREACHABLE } from './flowfield';
import { mapOf } from './testutil/maps';

// A 2 m plateau (x 5..8, rows 2..4) whose only stairs run along row 4 from the west.
const CLIFF = [
  '##########',
  '#00000000#',
  '#00008888#',
  '#00008888#',
  '#02468888#',
  '##########',
];

describe('flow fields', () => {
  it('ground field routes via stairs, not up a cliff', () => {
    const map = mapOf(CLIFF);
    const ground = new FlowField(map, false);
    ground.compute(7, 2);
    // From the cliff foot at (4, 2) the plateau edge (5, 2) is 2 m up: not a step.
    const n = ground.bestNeighbor(4, 2);
    expect(n).toBeGreaterThanOrEqual(0);
    expect(n % map.w).toBeLessThanOrEqual(4);
    // The path goes around through the stairs, so it's much longer than the straight 3 steps.
    expect(ground.at(4, 2)).toBeGreaterThan(30);
    expect(ground.at(4, 2)).not.toBe(UNREACHABLE);
    // Stair cells are on the path.
    expect(ground.at(2, 4)).toBeLessThan(ground.at(1, 4));
  });

  it('dropping down is allowed', () => {
    const map = mapOf(CLIFF);
    const ground = new FlowField(map, false);
    ground.compute(2, 2);
    // From the plateau straight west, dropping 2 m off the edge.
    expect(ground.at(6, 2)).toBe(40);
    expect(ground.bestNeighbor(5, 2) % map.w).toBe(4);
  });

  it('the air field crosses cliffs', () => {
    const map = mapOf(CLIFF);
    const air = new FlowField(map, true);
    air.compute(7, 2);
    expect(air.at(4, 2)).toBe(30);
    expect(air.bestNeighbor(4, 2)).toBe(2 * map.w + 5);
  });

  it('walls block both fields', () => {
    const map = mapOf(['#######', '#00#00#', '#00#00#', '#00#00#', '#######']);
    for (const air of [false, true]) {
      const f = new FlowField(map, air);
      f.compute(1, 1);
      expect(f.at(2, 2)).not.toBe(UNREACHABLE);
      expect(f.at(4, 2)).toBe(UNREACHABLE);
    }
  });

  it('diagonal corner-cutting is blocked', () => {
    const open = mapOf(['######', '#0000#', '#0000#', '#0000#', '######']);
    const f = new FlowField(open, false);
    f.compute(2, 2);
    expect(f.at(1, 1)).toBe(14);
    const corner = mapOf(['######', '#0#00#', '#0000#', '#0000#', '######']);
    const g = new FlowField(corner, false);
    g.compute(2, 2);
    // (1,1) → (2,2) would cut past the wall at (2,1).
    expect(g.at(1, 1)).toBe(20);
  });

  it('costs are 10 orthogonal and 14 diagonal', () => {
    const map = mapOf(['#######', '#00000#', '#00000#', '#00000#', '#######']);
    const f = new FlowField(map, false);
    f.compute(1, 1);
    expect(f.at(1, 1)).toBe(0);
    expect(f.at(2, 1)).toBe(10);
    expect(f.at(2, 2)).toBe(14);
    expect(f.at(3, 2)).toBe(24);
    expect(f.at(5, 3)).toBe(14 * 2 + 10 * 2);
  });

  it('steps up at most 0.5 m', () => {
    const map = mapOf(['#######', '#0123#', '#0123#', '#######'].map((r) => r.padEnd(7, '#')));
    const f = new FlowField(map, false);
    f.compute(4, 1);
    // Heights 0, 0.25, 0.5, 0.75: each step is at most 0.5 m, so everything is reachable.
    expect(f.at(1, 1)).toBe(30);
    const steep = mapOf(['######', '#0030#', '#0030#', '######']);
    const g = new FlowField(steep, false);
    g.compute(3, 1);
    // 0 → 0.75 is too steep from either side cell.
    expect(g.at(1, 1)).toBe(UNREACHABLE);
  });
});
