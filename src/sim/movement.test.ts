import { describe, expect, it } from 'vitest';
import type { DungeonDef } from '../data/dungeons/types';
import { GRAVITY, JUMP_VZ, PLAYER_RADIUS } from './constants';
import { loadMap, type GameMap } from './map';
import { groundHeight, jump, stepBody, type Body } from './movement';

/** A map from height rows; markers are all '.', plus S on the first 4 floor cells in reading order. */
function mapOf(rows: string[]): GameMap {
  const cells = rows.map((r) => [...r].map(() => '.'));
  let s = 0;
  rows.forEach((row, r) => [...row].forEach((ch, c) => {
    if (ch !== '#' && s < 4) { cells[r][c] = 'S'; s++; }
  }));
  const markers = cells.map((r) => r.join(''));
  const def: DungeonDef = { id: 't', name: 'T', heights: rows, markers, arenas: [] };
  return loadMap(def);
}

function body(x: number, y: number, z = 0): Body {
  return { x, y, z, vz: 0, grounded: true, radius: PLAYER_RADIUS, flying: false };
}

/** Runs `seconds` of movement at speed `vx` along +x in frames of `dt`, jumping on the first frame if asked. */
function run(map: GameMap, b: Body, vx: number, seconds: number, dt: number, doJump = false) {
  const frames = Math.round(seconds / dt);
  for (let i = 0; i < frames; i++) {
    if (doJump && i === 0) jump(b, JUMP_VZ);
    stepBody(map, b, vx * dt, 0, dt);
  }
}

// A corridor running east: floor 0, then a raised section of the given height character.
function step(ch: string): GameMap {
  return mapOf(['##############', '#00000' + ch.repeat(7) + '#', '#00000' + ch.repeat(7) + '#', '##############']);
}

describe('movement', () => {
  it('steps up 0.5 m but not 0.75 m', () => {
    const up = body(4, 1.5);
    run(step('2'), up, 5, 1, 1 / 60);
    expect(up.x).toBeGreaterThan(8);
    expect(up.z).toBe(0.5);

    const blocked = body(4, 1.5);
    run(step('3'), blocked, 5, 1, 1 / 60);
    expect(blocked.x).toBeLessThan(6 - PLAYER_RADIUS + 1e-9);
    expect(blocked.z).toBe(0);
  });

  for (const dt of [0.016, 0.05]) {
    it(`a jump reaches a 1.0 m ledge but not a 1.25 m one at ${dt * 1000} ms frames`, () => {
      // Start against the ledge so the jump happens right at it.
      const ok = body(6 - PLAYER_RADIUS - 0.01, 1.5);
      run(step('4'), ok, 3, 1, dt, true);
      expect(ok.z).toBe(1);
      expect(ok.x).toBeGreaterThan(6.5);
      expect(ok.grounded).toBe(true);

      const no = body(6 - PLAYER_RADIUS - 0.01, 1.5);
      run(step('5'), no, 3, 1, dt, true);
      expect(no.z).toBe(0);
      expect(no.x).toBeLessThan(6 - PLAYER_RADIUS);
    });
  }

  it('jump height is about 1.22 m', () => {
    const b = body(3, 1.5);
    jump(b, JUMP_VZ);
    let peak = 0;
    for (let i = 0; i < 60; i++) {
      stepBody(step('0'), b, 0, 0, 1 / 60);
      peak = Math.max(peak, b.z);
    }
    expect(peak).toBeCloseTo((JUMP_VZ * JUMP_VZ) / (2 * GRAVITY), 2);
    expect(b.grounded).toBe(true);
  });

  it('walking off a ledge falls and lands', () => {
    const map = mapOf(['##########', '#8888000##', '#8888000##', '##########']);
    const b = body(2, 1.5, 2);
    stepBody(map, b, 0, 0, 1 / 60);
    expect(b.z).toBe(2);
    let wasAirborne = false;
    for (let i = 0; i < 60; i++) {
      stepBody(map, b, 4 / 60, 0, 1 / 60);
      if (!b.grounded) wasAirborne = true;
      if (b.x > 6) break;
    }
    expect(wasAirborne).toBe(true);
    for (let i = 0; i < 60; i++) stepBody(map, b, 0, 0, 1 / 60);
    expect(b.grounded).toBe(true);
    expect(b.z).toBe(0);
  });

  it('walls block', () => {
    const map = mapOf(['#######', '#0000##', '#0000##', '#######']);
    const b = body(2, 1.5);
    run(map, b, 5, 1, 1 / 60);
    expect(b.x).toBeCloseTo(5 - PLAYER_RADIUS, 1);
    expect(b.x).toBeLessThanOrEqual(5 - PLAYER_RADIUS);
  });

  it("a 2 m move in one update doesn't pass through a 1 m wall", () => {
    const map = mapOf(['#########', '#000#000#', '#000#000#', '#########']);
    const b = body(3.5, 1.5);
    stepBody(map, b, 2, 0, 1 / 30);
    expect(b.x).toBeLessThan(4);
  });

  it('a body placed overlapping a wall can move out of it', () => {
    const map = mapOf(['#######', '#00000#', '#00000#', '#######']);
    const b = body(1.2, 1.5); // overlaps the west wall
    stepBody(map, b, 0.5, 0, 1 / 30);
    expect(b.x).toBeCloseTo(1.7);
  });

  it('ground height uses the highest overlapped non-blocking cell', () => {
    const map = mapOf(['#######', '#00248#', '#00248#', '#######']);
    // At x = 3.9 the body overlaps cells 2 (0 m), 3 (0.5 m) and 4 (1 m).
    expect(groundHeight(map, 3.9, 1.5, PLAYER_RADIUS, 0.5, true, false)).toBe(1);
    // Grounded at 0: cell 4 (1 m) blocks, so the ground is 0.5.
    expect(groundHeight(map, 3.9, 1.5, PLAYER_RADIUS, 0, true, false)).toBe(0.5);
    // Airborne at 0.75: cell 4 (1 m) is above the feet and blocks.
    expect(groundHeight(map, 3.9, 1.5, PLAYER_RADIUS, 0.75, false, false)).toBe(0.5);
  });

  it('movement along x and y is applied separately (sliding along a wall)', () => {
    const map = mapOf(['#######', '#00000#', '#00000#', '#######']);
    const b = body(2, 2.5);
    // Moving diagonally into the south wall: y is blocked, x still moves.
    stepBody(map, b, 0.2, 0.2, 1 / 30);
    expect(b.x).toBeCloseTo(2.2);
    expect(b.y).toBe(2.5);
  });
});
