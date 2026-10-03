import { describe, expect, it } from 'vitest';
import { ST_ATTACKING, ST_IDLE, ST_MOVING } from '../data/enemies';
import { corpseFrame, CORPSE_MS, DEATH_MS, EnemyAnimator, PAIN_COOLDOWN_MS, spriteDirection, WALK_CYCLE_M } from './enemyAnim';

describe('spriteDirection', () => {
  it('shows the front to a viewer the enemy faces, and the back to one behind it', () => {
    expect(spriteDirection(0, 5, 0)).toBe(0);
    expect(spriteDirection(0, -5, 0)).toBe(4);
    expect(spriteDirection(Math.PI / 2, 0, 3)).toBe(0);
  });

  it('shows the right side (direction 2) when the viewer is on the enemy’s right', () => {
    // Simulation y maps to three.js z, so facing +x with +y up on a top-down map, the enemy's
    // right hand is toward +y; direction 2 is the render with the right side to the camera.
    expect(spriteDirection(0, 0, 5)).toBe(2);
    expect(spriteDirection(0, 0, -5)).toBe(6);
  });

  it('rounds to the nearest of 8 directions and wraps around', () => {
    expect(spriteDirection(0, 1, 0.3)).toBe(0); // 17°
    expect(spriteDirection(0, 1, 0.6)).toBe(1); // 31°
    expect(spriteDirection(2 * Math.PI, -1, -0.01)).toBe(4);
    expect(spriteDirection(-Math.PI / 4, 1, 0)).toBe(1);
  });
});

/** Runs an enemy at 30 frames per second, moving (vx, vy) m/s, and returns the time reached. */
function run(a: EnemyAnimator, slot: number, from: { x: number; y: number; t: number }, frames: number, vx: number, vy: number, state: number): { x: number; y: number; t: number } {
  let { x, y, t } = from;
  for (let i = 0; i < frames; i++) {
    a.begin();
    x += vx / 30;
    y += vy / 30;
    t += 1000 / 30;
    a.update(slot, x, y, state, t, 1 / 30, 100, 0);
  }
  return { x, y, t };
}

describe('EnemyAnimator', () => {
  it('a new enemy faces the nearest player and stands idle', () => {
    const a = new EnemyAnimator();
    a.begin();
    a.update(5, 0, 0, ST_IDLE, 0, 1 / 30, 0, 10);
    expect(a.facing[5]).toBeCloseTo(Math.PI / 2);
    expect(a.pick(5, 0)).toEqual({ anim: 'idle', frame: 0 });
  });

  it('a walking enemy faces where it walks and steps once per walk cycle of distance', () => {
    const a = new EnemyAnimator();
    let s = run(a, 7, { x: 0, y: 0, t: 0 }, 30, 0, 4, ST_MOVING);
    expect(a.facing[7]).toBeCloseTo(Math.PI / 2, 2);
    expect(a.pick(7, s.t).anim).toBe('walk');
    // One more walk cycle of distance brings the same frame back.
    const before = a.pick(7, s.t).frame;
    s = run(a, 7, s, Math.round((WALK_CYCLE_M / 4) * 30), 0, 4, ST_MOVING);
    expect(a.pick(7, s.t).frame).toBe(before);
  });

  it('a "moving" enemy stuck in the crowd stands idle instead of freezing mid-stride', () => {
    const a = new EnemyAnimator();
    const s = run(a, 1, { x: 0, y: 0, t: 0 }, 30, 0, 0, ST_MOVING);
    expect(a.pick(1, s.t).anim).toBe('idle');
  });

  it('the attack cycle starts when attacking begins: the blow (frame 4) lands 0.5 s in, then every 1 s', () => {
    const a = new EnemyAnimator();
    let s = run(a, 2, { x: 0, y: 0, t: 0 }, 10, 0, 4, ST_MOVING);
    s = run(a, 2, s, 1, 0, 0, ST_ATTACKING);
    const start = s.t;
    expect(a.pick(2, start)).toEqual({ anim: 'attack', frame: 0 });
    expect(a.pick(2, start + 500)).toEqual({ anim: 'attack', frame: 4 });
    expect(a.pick(2, start + 1500)).toEqual({ anim: 'attack', frame: 4 });
    // Attacking enemies face their target (the nearest player at x = 100).
    expect(a.facing[2]).toBeCloseTo(0, 1);
  });

  it('pain plays over other animations, but not again within the cooldown', () => {
    const a = new EnemyAnimator();
    const s = run(a, 3, { x: 0, y: 0, t: 0 }, 5, 0, 0, ST_IDLE);
    a.hurt(3, s.t);
    expect(a.pick(3, s.t).anim).toBe('pain');
    expect(a.pick(3, s.t + 300).anim).toBe('idle');
    a.hurt(3, s.t + 300);
    expect(a.pick(3, s.t + 300).anim).toBe('idle');
    a.hurt(3, s.t + PAIN_COOLDOWN_MS);
    expect(a.pick(3, s.t + PAIN_COOLDOWN_MS).anim).toBe('pain');
  });

  it('a reused slot starts over as a new enemy', () => {
    const a = new EnemyAnimator();
    let s = run(a, 4, { x: 0, y: 0, t: 0 }, 10, 4, 0, ST_MOVING);
    a.begin(); // a frame where slot 4 is absent
    s = run(a, 4, { x: 50, y: 50, t: s.t + 33 }, 1, 0, 0, ST_IDLE);
    expect(a.pick(4, s.t)).toEqual({ anim: 'idle', frame: 0 });
  });
});

describe('corpseFrame', () => {
  it('plays the death frames, holds the last one, sinks, then is gone', () => {
    const c = { start: 1000, x: 0, y: 0, z: 0, facing: 0 };
    expect(corpseFrame(c, 999)).toBeNull();
    expect(corpseFrame(c, 1000)).toEqual({ frame: 0, sink: 0 });
    expect(corpseFrame(c, 1000 + DEATH_MS / 2)?.frame).toBe(4);
    expect(corpseFrame(c, 1000 + DEATH_MS + 100)).toEqual({ frame: 7, sink: 0 });
    expect(corpseFrame(c, 1000 + CORPSE_MS - 1)!.sink).toBeGreaterThan(0.5);
    expect(corpseFrame(c, 1000 + CORPSE_MS)).toBeNull();
  });
});
