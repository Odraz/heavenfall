/**
 * Client-side animation of other players' 8-direction sprites (§11.1). A player faces its `yaw`;
 * the walk cycle follows the distance walked, shown while the smoothed horizontal speed is at
 * least the walking threshold, as for enemies.
 */
import type { PlayerAnimName } from '../render/animAtlas';
import { MAX_STEP_M, MOVING_SPEED, VELOCITY_TAU, WALK_FRAMES } from './enemyAnim';

/** Meters walked per walk cycle (two steps) for every class (§11.1). */
export const PLAYER_WALK_CYCLE_M = 2.5;

interface State {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Walk cycles completed, fractional. */
  walk: number;
  /** Frame number of the last update; a gap means the player reappeared (respawn, teleport). */
  seen: number;
}

export interface PlayerAnimPick {
  anim: PlayerAnimName;
  frame: number;
}

export class PlayerAnimator {
  private readonly players = new Map<number, State>();
  private frameNo = 1;

  /** Starts a frame; call before `update`. */
  begin(): void {
    this.frameNo++;
  }

  /** Advances player `id` after `dt` seconds, at its interpolated position. */
  update(id: number, x: number, y: number, dt: number): void {
    const s = this.players.get(id);
    if (!s || s.seen !== this.frameNo - 1) {
      this.players.set(id, { x, y, vx: 0, vy: 0, walk: s?.walk ?? 0, seen: this.frameNo });
      return;
    }
    s.seen = this.frameNo;
    const dx = x - s.x;
    const dy = y - s.y;
    s.x = x;
    s.y = y;
    const step = Math.hypot(dx, dy);
    if (dt > 0 && step < MAX_STEP_M) {
      const k = 1 - Math.exp(-dt / VELOCITY_TAU);
      s.vx += (dx / dt - s.vx) * k;
      s.vy += (dy / dt - s.vy) * k;
      s.walk = (s.walk + step / PLAYER_WALK_CYCLE_M) % 1;
    }
  }

  /** The animation and frame to show for player `id`. */
  pick(id: number): PlayerAnimPick {
    const s = this.players.get(id);
    if (s && Math.hypot(s.vx, s.vy) >= MOVING_SPEED) return { anim: 'walk', frame: Math.floor(s.walk * WALK_FRAMES) % WALK_FRAMES };
    return { anim: 'idle', frame: 0 };
  }
}
