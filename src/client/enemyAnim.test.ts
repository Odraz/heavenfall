import { describe, expect, it } from 'vitest';
import { CHERUB, CHORISTER, GATEKEEPER, ST_ATTACKING, ST_IDLE, ST_MOVING, ST_WINDUP } from '../data/enemies';
import { BOSS_CAST_JUDGMENT, BOSS_CAST_NONE, BOSS_CAST_VOLLEY } from '../sim/sim';
import { CORPSE_FALL_G, corpseFrame, CORPSE_MS, DEATH_MS, EnemyAnimator, PAIN_COOLDOWN_MS, PAIN_FRAMES, PAIN_MS, spriteDirection, WALK_CYCLE_M } from './enemyAnim';

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
function run(a: EnemyAnimator, slot: number, from: { x: number; y: number; t: number }, frames: number, vx: number, vy: number, state: number, type?: number): { x: number; y: number; t: number } {
  let { x, y, t } = from;
  for (let i = 0; i < frames; i++) {
    a.begin();
    x += vx / 30;
    y += vy / 30;
    t += 1000 / 30;
    a.update(slot, x, y, state, t, 1 / 30, 100, 0, type);
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

  it('the attack cycle starts 267 ms in when attacking begins (M12 §3.2): the blow (frame 4) is up at the first strike, 267 ms in, then every 1 s', () => {
    const a = new EnemyAnimator();
    let s = run(a, 2, { x: 0, y: 0, t: 0 }, 10, 0, 4, ST_MOVING);
    s = run(a, 2, s, 1, 0, 0, ST_ATTACKING);
    const start = s.t;
    expect(a.pick(2, start)).toEqual({ anim: 'attack', frame: 2 });
    expect(a.pick(2, start + 232)).toEqual({ anim: 'attack', frame: 3 });
    expect(a.pick(2, start + 267)).toEqual({ anim: 'attack', frame: 4 });
    expect(a.pick(2, start + 1267)).toEqual({ anim: 'attack', frame: 4 });
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

describe('EnemyAnimator, Chorister', () => {
  it('walks one cycle per 2 m', () => {
    const a = new EnemyAnimator();
    let s = run(a, 9, { x: 0, y: 0, t: 0 }, 30, 0, 3, ST_MOVING, CHORISTER);
    const before = a.pick(9, s.t).frame;
    s = run(a, 9, s, Math.round((2.0 / 3) * 30), 0, 3, ST_MOVING, CHORISTER);
    expect(a.pick(9, s.t)).toEqual({ anim: 'walk', frame: before });
  });

  it('casts frames 1–6 over the 1 s wind-up and holds frame 6, facing its target', () => {
    const a = new EnemyAnimator();
    let s = run(a, 6, { x: 0, y: 0, t: 0 }, 10, 0, 3, ST_MOVING, CHORISTER);
    s = run(a, 6, s, 1, 0, 0, ST_WINDUP, CHORISTER);
    const start = s.t;
    expect(a.facing[6]).toBeCloseTo(0, 1); // toward the target at x = 100
    expect(a.pick(6, start)).toEqual({ anim: 'cast', frame: 0 });
    expect(a.pick(6, start + 500)).toEqual({ anim: 'cast', frame: 3 });
    expect(a.pick(6, start + 990)).toEqual({ anim: 'cast', frame: 5 });
    expect(a.pick(6, start + 1400)).toEqual({ anim: 'cast', frame: 5 });
  });

  it('plays frames 7–8 over 0.25 s from the tick it fires, then goes back to idle', () => {
    const a = new EnemyAnimator();
    let s = run(a, 8, { x: 0, y: 0, t: 0 }, 1, 0, 0, ST_WINDUP, CHORISTER);
    s = run(a, 8, s, 30, 0, 0, ST_WINDUP, CHORISTER);
    s = run(a, 8, s, 1, 0, 0, ST_ATTACKING, CHORISTER);
    const fired = s.t;
    // `attacking` lasts one tick; the release plays on regardless.
    s = run(a, 8, s, 2, 0, 0, ST_IDLE, CHORISTER);
    expect(a.pick(8, fired)).toEqual({ anim: 'cast', frame: 6 });
    expect(a.pick(8, fired + 130)).toEqual({ anim: 'cast', frame: 7 });
    expect(a.pick(8, fired + 260)).toEqual({ anim: 'idle', frame: 0 });
  });
});

describe('EnemyAnimator, Cherub', () => {
  it('flaps on a 0.5 s clock whether moving or not, 6 frames a beat', () => {
    const a = new EnemyAnimator();
    const s = run(a, 0, { x: 0, y: 0, t: 0 }, 3, 0, 0, ST_IDLE, CHERUB);
    const frames = [0, 1, 2, 3, 4, 5].map((k) => a.pick(0, s.t + (k * 500) / 6 + 1));
    expect(frames.every((f) => f.anim === 'fly')).toBe(true);
    expect(new Set(frames.map((f) => f.frame)).size).toBe(6);
    expect(a.pick(0, s.t + 500 + 1)).toEqual(a.pick(0, s.t + 1));
  });

  it('casts frames 1–4 over the 0.5 s wind-up, then 5–6 over 0.2 s once it fires', () => {
    const a = new EnemyAnimator();
    let s = run(a, 2, { x: 0, y: 0, t: 0 }, 1, 0, 0, ST_IDLE, CHERUB);
    s = run(a, 2, s, 1, 0, 0, ST_WINDUP, CHERUB);
    const start = s.t;
    expect(a.pick(2, start)).toEqual({ anim: 'cast', frame: 0 });
    expect(a.pick(2, start + 260)).toEqual({ anim: 'cast', frame: 2 });
    expect(a.pick(2, start + 800)).toEqual({ anim: 'cast', frame: 3 });
    s = run(a, 2, { ...s, t: start + 500 }, 1, 0, 0, ST_ATTACKING, CHERUB);
    expect(a.pick(2, s.t)).toEqual({ anim: 'cast', frame: 4 });
    expect(a.pick(2, s.t + 110)).toEqual({ anim: 'cast', frame: 5 });
    expect(a.pick(2, s.t + 210).anim).toBe('fly');
  });
});

describe('EnemyAnimator, Gatekeeper', () => {
  it('always faces the nearest player, even standing idle', () => {
    const a = new EnemyAnimator();
    run(a, 1, { x: 0, y: 0, t: 0 }, 2, 0, 0, ST_IDLE, GATEKEEPER);
    a.begin();
    a.update(1, 0, 0, ST_IDLE, 100, 1 / 30, 0, -10, GATEKEEPER);
    expect(a.facing[1]).toBeCloseTo(-Math.PI / 2);
    expect(a.pick(1, 100, BOSS_CAST_NONE)).toEqual({ anim: 'idle', frame: 0 });
  });

  it('plays Volley frames 1–3 over the 0.5 s wind-up, then frame 4 for 0.3 s after it fires', () => {
    const a = new EnemyAnimator();
    let s = run(a, 1, { x: 0, y: 0, t: 0 }, 2, 0, 0, ST_IDLE, GATEKEEPER);
    s = run(a, 1, s, 1, 0, 0, ST_WINDUP, GATEKEEPER);
    const start = s.t;
    expect(a.pick(1, start, BOSS_CAST_VOLLEY)).toEqual({ anim: 'volley', frame: 0 });
    expect(a.pick(1, start + 250, BOSS_CAST_VOLLEY)).toEqual({ anim: 'volley', frame: 1 });
    expect(a.pick(1, start + 480, BOSS_CAST_VOLLEY)).toEqual({ anim: 'volley', frame: 2 });
    s = run(a, 1, { ...s, t: start + 500 }, 1, 0, 0, ST_ATTACKING, GATEKEEPER);
    s = run(a, 1, s, 1, 0, 0, ST_IDLE, GATEKEEPER);
    expect(a.pick(1, start + 600, BOSS_CAST_NONE)).toEqual({ anim: 'volley', frame: 3 });
    expect(a.pick(1, start + 850, BOSS_CAST_NONE)).toEqual({ anim: 'idle', frame: 0 });
  });

  it('loops Judgment every second while it is cast', () => {
    const a = new EnemyAnimator();
    let s = run(a, 1, { x: 0, y: 0, t: 0 }, 2, 0, 0, ST_IDLE, GATEKEEPER);
    s = run(a, 1, s, 1, 0, 0, ST_WINDUP, GATEKEEPER);
    const start = s.t;
    expect(a.pick(1, start + 10, BOSS_CAST_JUDGMENT)).toEqual({ anim: 'judgment', frame: 0 });
    expect(a.pick(1, start + 760, BOSS_CAST_JUDGMENT)).toEqual({ anim: 'judgment', frame: 3 });
    expect(a.pick(1, start + 1010, BOSS_CAST_JUDGMENT)).toEqual({ anim: 'judgment', frame: 0 });
  });
});

describe('corpseFrame', () => {
  it('plays the death frames, holds the last one, sinks, then is gone', () => {
    const c = { start: 1000, x: 0, y: 0, z: 0, facing: 0, type: 0 };
    expect(corpseFrame(c, 999)).toBeNull();
    expect(corpseFrame(c, 1000)).toEqual({ frame: 0, sink: 0 });
    expect(corpseFrame(c, 1000 + DEATH_MS / 2)?.frame).toBe(4);
    expect(corpseFrame(c, 1000 + DEATH_MS + 100)).toEqual({ frame: 7, sink: 0 });
    expect(corpseFrame(c, 1000 + CORPSE_MS - 1)!.sink).toBeGreaterThan(0.5);
    expect(corpseFrame(c, 1000 + CORPSE_MS)).toBeNull();
  });

  it("the Gatekeeper's corpse plays its death over 1.5 s and stays", () => {
    const c = { start: 0, x: 0, y: 0, z: 3, facing: 0, type: GATEKEEPER };
    expect(corpseFrame(c, 750)).toEqual({ frame: 4, sink: 0 });
    expect(corpseFrame(c, 1600)).toEqual({ frame: 7, sink: 0 });
    expect(corpseFrame(c, 600000)).toEqual({ frame: 7, sink: 0 });
  });

  it('a corpse that died in the air falls to its ground height at 20 m/s²', () => {
    const c = { start: 0, x: 0, y: 0, z: 2, facing: 0, type: CHERUB, fallFrom: 6 };
    expect(corpseFrame(c, 0)!.sink).toBeCloseTo(-4);
    // After 0.5 s it has fallen 2.5 m.
    expect(corpseFrame(c, 500)!.sink).toBeCloseTo(-(4 - 0.5 * CORPSE_FALL_G * 0.25));
    // It lands after √(2 · 4 / 20) ≈ 0.63 s, before the death animation ends.
    expect(corpseFrame(c, 700)!.sink).toBe(0);
  });
});

describe('stunned enemies recoil (M12 §5.3)', () => {
  it("the pain animation plays from the flag's rising edge, ignoring the cooldown, and holds its last frame while it's set", () => {
    const a = new EnemyAnimator();
    a.begin();
    a.update(1, 0, 0, ST_IDLE, 0, 0.016, 5, 0);
    // Hurt just before: the cooldown would block a new flinch.
    a.hurt(1, 0);
    a.begin();
    a.update(1, 0, 0, ST_IDLE, 100, 0.016, 5, 0);
    a.setStunned(1, true, 100);
    expect(a.pick(1, 100)).toEqual({ anim: 'pain', frame: 0 });
    expect(100).toBeLessThan(PAIN_COOLDOWN_MS);
    for (const t of [100 + PAIN_MS, 100 + 900]) {
      a.begin();
      a.update(1, 0, 0, ST_IDLE, t, 0.016, 5, 0);
      a.setStunned(1, true, t);
      expect(a.pick(1, t)).toEqual({ anim: 'pain', frame: PAIN_FRAMES - 1 });
    }
    a.begin();
    a.update(1, 0, 0, ST_IDLE, 1100, 0.016, 5, 0);
    a.setStunned(1, false, 1100);
    expect(a.pick(1, 1100).anim).toBe('idle');
  });
});
