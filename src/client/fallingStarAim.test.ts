/** M12 stage 4: Falling Star, aimed anywhere (M12 §5.2, §11.1). */
import { describe, expect, it } from 'vitest';
import { DECOR } from '../data/decor';
import { DUNGEONS } from '../data/dungeons';
import { PHASE_CLEARED, PHASE_COMBAT, PHASE_IDLE } from '../net/protocol';
import { PLAYER_EYE } from '../sim/constants';
import { loadMap, setArenaDoors } from '../sim/map';
import { mapOf } from '../sim/testutil/maps';
import { arcClear, arcPoint, aimLanding, StarAim, starLanding, walkableCells } from './fallingStarAim';
import { LocalPlayer } from './localPlayer';

/** An open floor `w` × `h` cells inside a wall border, with optional wall columns at the given x. */
function floor(w: number, h: number, walls: number[] = []): ReturnType<typeof mapOf> {
  const rows = Array.from({ length: h }, () => '#' + Array.from({ length: w }, (_, c) => (walls.includes(c + 1) ? '#' : '0')).join('') + '#');
  return mapOf(['#'.repeat(w + 2), ...rows, '#'.repeat(w + 2)]);
}

const ALL = (m: { w: number; h: number }) => new Uint8Array(m.w * m.h).fill(1);

describe('the landing point (M12 §5.2)', () => {
  it('is where the aim ray meets the floor', () => {
    const m = floor(40, 5);
    const l = aimLanding(m, 2.5, 3.5, 0, 0, -Math.atan2(PLAYER_EYE, 10), []);
    expect(l.x).toBeCloseTo(12.5, 6);
    expect(l.y).toBeCloseTo(3.5, 6);
    expect(l.z).toBeCloseTo(0, 6);
    expect(l.ally).toBe(-1);
  });

  it("is 0.5 m back from a wall's side, on the floor there", () => {
    const m = floor(40, 5, [11]);
    const l = aimLanding(m, 2.5, 3.5, 0, 0, 0, []);
    expect(l.x).toBeCloseTo(11 - 0.5, 6);
    expect(l.z).toBe(0);
  });

  it('is 30 m along the yaw when the ray meets nothing within 30 m', () => {
    const m = floor(60, 5);
    const l = aimLanding(m, 2.5, 3.5, 0, 0, 0.3, []);
    expect(l.x).toBeCloseTo(32.5, 6);
    expect(l.y).toBeCloseTo(3.5, 6);
    expect(l.z).toBe(0);
  });

  it("snaps to a living ally's feet within 2.5 m of the aim point only", () => {
    const m = floor(40, 9);
    const pitch = -Math.atan2(PLAYER_EYE, 10);
    expect(aimLanding(m, 2.5, 3.5, 0, 0, pitch, [{ id: 2, x: 12.5, y: 5.9, z: 0, dead: false }])).toMatchObject({ x: 12.5, y: 5.9, ally: 2 });
    expect(aimLanding(m, 2.5, 3.5, 0, 0, pitch, [{ id: 2, x: 12.5, y: 6.1, z: 0, dead: false }]).ally).toBe(-1);
    expect(aimLanding(m, 2.5, 3.5, 0, 0, pitch, [{ id: 2, x: 12.5, y: 4.5, z: 0, dead: true }]).ally).toBe(-1);
  });
});

describe('validity (M12 §5.2)', () => {
  it('a landing 0.5 m away, a slam, is valid; a clear arc onto the floor is valid', () => {
    const m = floor(40, 5);
    const slam = starLanding(m, ALL(m), 2.5, 3.5, 0, 0, -Math.atan2(PLAYER_EYE, 0.5), []);
    expect(slam.x).toBeCloseTo(3, 6);
    expect(slam.valid).toBe(true);
    expect(arcClear(m, 2.5, 3.5, 0, 2.5, 3.5, 0)).toBe(true);
    expect(starLanding(m, ALL(m), 2.5, 3.5, 0, 0, -Math.atan2(PLAYER_EYE, 20), []).valid).toBe(true);
  });

  it('an arc through a wall is invalid', () => {
    const m = floor(40, 5, [8]);
    expect(arcClear(m, 2.5, 3.5, 0, 12.5, 3.5, 0)).toBe(false);
    expect(arcClear(floor(40, 5), 2.5, 3.5, 0, 12.5, 3.5, 0)).toBe(true);
  });

  it('a landing cell not walkable is invalid', () => {
    const m = floor(40, 5);
    expect(starLanding(m, new Uint8Array(m.w * m.h), 2.5, 3.5, 0, 0, -Math.atan2(PLAYER_EYE, 10), []).valid).toBe(false);
  });

  describe('on the Pearly Gates', () => {
    const map = loadMap(DUNGEONS['pearly-gates']);
    const walk = walkableCells(map);
    const at = (c: number, r: number) => walk[r * map.w + c];

    it("the Gatekeeper's dais and the decorations' pedestals aren't walkable; spawn points and door cells are", () => {
      const [bc, br] = map.boss!;
      expect(at(bc, br)).toBe(0);
      // The large decorations stand on 1.5 m pedestals.
      const pedestals = map.decorations.filter((d) => DECOR[d.id].large);
      expect(pedestals.length).toBeGreaterThan(0);
      for (const d of pedestals) expect(at(d.c, d.r)).toBe(0);
      for (const pts of map.arenaSpawnPoints) for (const [c, r] of pts) expect(at(c, r)).toBe(1);
      const doors = [...map.doorArena.keys()].filter((i) => map.doorArena[i] >= 0);
      expect(doors.length).toBeGreaterThan(0);
      expect(doors.every((i) => walk[i] === 1)).toBe(true);
    });

    it('an arc through a closed door is invalid, through the open doorway clear', () => {
      // A door cell with floor 3 m on either side along x (the doors are columns of cells across x).
      const floorCell = (k: number) => !map.wall[k] && map.doorArena[k] < 0;
      const i = [...map.doorArena.keys()].find((k) => map.doorArena[k] >= 0 && floorCell(k - 3) && floorCell(k + 3))!;
      expect(i).toBeDefined();
      const c = (i % map.w) + 0.5;
      const r = Math.floor(i / map.w) + 0.5;
      const ai = map.doorArena[i];
      const across = () => arcClear(map, c - 3, r, map.floor[i - 3], c + 3, r, map.floor[i + 3]);
      // Cleared, every door of the arena is open; in combat, every one is closed.
      setArenaDoors(map, ai, PHASE_CLEARED);
      const open = across();
      setArenaDoors(map, ai, PHASE_COMBAT);
      const closed = across();
      setArenaDoors(map, ai, PHASE_IDLE);
      expect([open, closed]).toEqual([true, false]);
    });
  });
});

describe('the arc and the leap (M12 §5.2)', () => {
  it('is a straight line horizontally, 1.5 m + 0.08 m per meter high in the middle', () => {
    expect(arcPoint(0, 0, 0, 30, 0, 0, 0.5)).toEqual([15, 0, 3.9]);
    const [x, , z] = arcPoint(0, 0, 1, 10, 0, 3, 0.25);
    expect(x).toBe(2.5);
    expect(z).toBeCloseTo(1 + 2 * 0.25 + 4 * 2.3 * 0.25 * 0.75, 9);
  });

  it('the Fallen flies the arc over 0.4 s, then is grounded on the landing cell', () => {
    const m = floor(40, 5);
    const p = new LocalPlayer(2.5, 3.5, 0, 6);
    p.startLeap(12.5, 3.5, 0);
    for (let i = 0; i < 10; i++) p.update(m, 0.02, 0, 0, false);
    expect(p.body.x).toBeCloseTo(7.5, 6);
    expect(p.body.z).toBeCloseTo(2.3, 6);
    for (let i = 0; i < 12; i++) p.update(m, 0.02, 0, 0, false);
    expect(p.leaping).toBe(false);
    expect(p.body.x).toBeCloseTo(12.5, 6);
    expect(p.body.z).toBe(0);
    expect(p.body.grounded).toBe(true);
  });
});

describe('the hold, release and cancel (M12 §5.2)', () => {
  it('holding E while ready previews; releasing it leaps', () => {
    const a = new StarAim();
    a.keyDown(true, true);
    expect(a.frame(true, false, 0)).toBe('none');
    expect(a.aiming).toBe(true);
    expect(a.frame(false, false, 0)).toBe('release');
    expect(a.aiming).toBe(false);
    expect(a.frame(false, false, 0)).toBe('none');
  });

  it('a key-down on cooldown never previews, even if the cooldown ends while E is held; nor while dead', () => {
    const a = new StarAim();
    a.keyDown(false, true);
    expect(a.aiming).toBe(false);
    expect(a.frame(true, false, 0)).toBe('none');
    expect(a.frame(false, false, 0)).toBe('none');
    a.keyDown(true, false);
    expect(a.aiming).toBe(false);
  });

  it("the right button cancels, and doesn't count as held until it's let go", () => {
    const a = new StarAim();
    a.keyDown(true, true);
    a.frame(true, false, 0);
    expect(a.frame(true, true, 0)).toBe('cancel');
    expect(a.rightBlocked).toBe(true);
    // Still holding both: no preview, no release.
    expect(a.frame(true, true, 0)).toBe('none');
    expect(a.frame(false, true, 0)).toBe('none');
    expect(a.rightBlocked).toBe(true);
    a.frame(false, false, 0);
    expect(a.rightBlocked).toBe(false);
  });

  it('a right button held from before E is pressed fires on; only a press cancels', () => {
    const a = new StarAim();
    a.frame(false, true, 0);
    a.keyDown(true, true);
    expect(a.frame(true, true, 0)).toBe('none');
    expect(a.aiming).toBe(true);
  });

  it('a release() (blur, Pause, the chat line, death) cancels without leaping', () => {
    const a = new StarAim();
    a.frame(false, false, 3);
    a.keyDown(true, true);
    expect(a.frame(true, false, 3)).toBe('none');
    expect(a.frame(false, false, 4)).toBe('cancel');
  });
});
