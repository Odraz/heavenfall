import { describe, expect, it } from 'vitest';
import { PLAYER_WALK_CYCLE_M, PlayerAnimator } from './playerAnim';

/** Runs player `id` at 30 frames per second, moving (vx, vy) m/s, and returns where it ends. */
function run(a: PlayerAnimator, id: number, from: { x: number; y: number }, frames: number, vx: number, vy: number): { x: number; y: number } {
  let { x, y } = from;
  for (let i = 0; i < frames; i++) {
    a.begin();
    x += vx / 30;
    y += vy / 30;
    a.update(id, x, y, 1 / 30);
  }
  return { x, y };
}

describe('PlayerAnimator', () => {
  it('stands idle when it has not moved, or when it is unknown', () => {
    const a = new PlayerAnimator();
    expect(a.pick(3)).toEqual({ anim: 'idle', frame: 0 });
    run(a, 3, { x: 0, y: 0 }, 30, 0, 0);
    expect(a.pick(3)).toEqual({ anim: 'idle', frame: 0 });
  });

  it('walks while moving, one cycle of 8 frames per 2.5 m', () => {
    const a = new PlayerAnimator();
    const speed = 5;
    let p = run(a, 0, { x: 0, y: 0 }, 30, speed, 0);
    expect(a.pick(0).anim).toBe('walk');
    // Sample the frame across one cycle: it advances by one every 2.5 / 8 m.
    const frames: number[] = [];
    for (let i = 0; i < 8; i++) {
      frames.push(a.pick(0).frame);
      p = run(a, 0, p, Math.round((PLAYER_WALK_CYCLE_M / 8 / speed) * 30), speed, 0);
    }
    const steps = frames.map((f, i) => (f - frames[(i + 7) % 8] + 8) % 8).slice(1);
    expect(steps.every((s) => s === 1)).toBe(true);
  });

  it('goes back to idle shortly after stopping', () => {
    const a = new PlayerAnimator();
    const p = run(a, 0, { x: 0, y: 0 }, 30, 0, 5);
    run(a, 0, p, 15, 0, 0);
    expect(a.pick(0).anim).toBe('idle');
  });

  it("doesn't count a jump in position (a teleport) as walking", () => {
    const a = new PlayerAnimator();
    run(a, 0, { x: 0, y: 0 }, 10, 0, 0);
    a.begin();
    a.update(0, 40, 0, 1 / 30);
    expect(a.pick(0).anim).toBe('idle');
  });
});
