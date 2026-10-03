/**
 * Client-side animation of 8-direction enemy sprites. Snapshots carry no facing or animation
 * time, so both are derived here: facing from the interpolated movement (or the nearest player
 * while attacking), the walk cycle from distance walked, and the attack cycle from when the
 * `attacking` state began, matching the Blessed melee timing (first hit 0.5 s in, then every 1 s).
 */
import { ST_ATTACKING, ST_FALLING, ST_MOVING } from '../data/enemies';
import { ENEMY_SLOTS } from '../sim/constants';
import type { AnimName } from '../render/animAtlas';

/** Meters walked per walk cycle (two steps), so the feet keep pace with the ground. */
export const WALK_CYCLE_M = 1.6;
export const WALK_FRAMES = 8;
/** The attack cycle: 8 frames over 1 s, the blow landing on frame 4. */
export const ATTACK_FRAMES = 8;
export const ATTACK_CYCLE_MS = 1000;
export const PAIN_FRAMES = 3;
export const PAIN_MS = 250;
/** A new flinch can't start sooner than this after the previous one, so steady fire doesn't freeze the swarm in pain. */
export const PAIN_COOLDOWN_MS = 700;
export const DEATH_FRAMES = 8;
export const DEATH_MS = 800;
/** A corpse lies for this long after its death animation, then sinks into the floor. */
export const CORPSE_LIE_MS = 3000;
export const CORPSE_SINK_MS = 1000;
export const CORPSE_SINK_M = 0.6;
/** Smoothed speeds below this count as standing still. */
const MOVING_SPEED = 0.4;
/** Time constant of the velocity smoothing, in seconds. */
const VELOCITY_TAU = 0.12;
/** Interpolated jumps longer than this in one frame aren't walking (a reused slot, a stall). */
const MAX_STEP_M = 1.5;

/**
 * The sprite direction (0–7) showing an enemy with yaw `facing` to a viewer in direction
 * (toViewerX, toViewerY) from it. Direction 0 faces the viewer; each step turns the enemy 45°
 * clockwise in simulation angles (counterclockwise on screen seen from above, since the
 * renderer maps simulation y to three.js z), so direction 2 shows its right side.
 */
export function spriteDirection(facing: number, toViewerX: number, toViewerY: number): number {
  const rel = Math.atan2(toViewerY, toViewerX) - facing;
  const d = Math.round(rel / (Math.PI / 4));
  return ((d % 8) + 8) % 8;
}

export interface AnimPick {
  anim: AnimName;
  frame: number;
}

/** Per-slot animation state for every enemy slot. */
export class EnemyAnimator {
  readonly facing = new Float32Array(ENEMY_SLOTS);
  private readonly lastX = new Float32Array(ENEMY_SLOTS);
  private readonly lastY = new Float32Array(ENEMY_SLOTS);
  private readonly vx = new Float32Array(ENEMY_SLOTS);
  private readonly vy = new Float32Array(ENEMY_SLOTS);
  /** Walk cycles completed, fractional. */
  private readonly walk = new Float32Array(ENEMY_SLOTS);
  private readonly state = new Uint8Array(ENEMY_SLOTS);
  private readonly stateSince = new Float64Array(ENEMY_SLOTS);
  private readonly painStart = new Float64Array(ENEMY_SLOTS).fill(-Infinity);
  /** Frame number when each slot was last updated; a gap means the slot is a new enemy. */
  private readonly seen = new Uint32Array(ENEMY_SLOTS);
  private frameNo = 1;

  /** Starts a frame; call before `update`. */
  begin(): void {
    this.frameNo++;
  }

  /**
   * Advances one enemy to time `now` (ms) after `dt` seconds, at its interpolated position.
   * `targetX/Y` is the nearest player, faced while attacking and when the enemy first appears.
   */
  update(slot: number, x: number, y: number, state: number, now: number, dt: number, targetX: number, targetY: number): void {
    const fresh = this.seen[slot] !== this.frameNo - 1;
    this.seen[slot] = this.frameNo;
    if (fresh) {
      this.lastX[slot] = x;
      this.lastY[slot] = y;
      this.vx[slot] = 0;
      this.vy[slot] = 0;
      // Spread the swarm's steps so it doesn't march in lockstep.
      this.walk[slot] = (slot * 0.618034) % 1;
      this.state[slot] = state;
      this.stateSince[slot] = now;
      this.painStart[slot] = -Infinity;
      this.facing[slot] = Math.atan2(targetY - y, targetX - x);
      return;
    }
    const dx = x - this.lastX[slot];
    const dy = y - this.lastY[slot];
    this.lastX[slot] = x;
    this.lastY[slot] = y;
    const step = Math.hypot(dx, dy);
    if (dt > 0 && step < MAX_STEP_M) {
      const k = 1 - Math.exp(-dt / VELOCITY_TAU);
      this.vx[slot] += (dx / dt - this.vx[slot]) * k;
      this.vy[slot] += (dy / dt - this.vy[slot]) * k;
      this.walk[slot] = (this.walk[slot] + step / WALK_CYCLE_M) % 1;
    }
    if (state !== this.state[slot]) {
      this.state[slot] = state;
      this.stateSince[slot] = now;
    }
    if (state === ST_ATTACKING) this.facing[slot] = Math.atan2(targetY - y, targetX - x);
    else if (this.speed(slot) >= MOVING_SPEED) this.facing[slot] = Math.atan2(this.vy[slot], this.vx[slot]);
  }

  /** The enemy was hurt at `now`: it flinches unless it flinched within the cooldown. */
  hurt(slot: number, now: number): void {
    if (now - this.painStart[slot] >= PAIN_COOLDOWN_MS) this.painStart[slot] = now;
  }

  /** The animation and frame to show for a slot at `now`. */
  pick(slot: number, now: number): AnimPick {
    const sincePain = now - this.painStart[slot];
    if (sincePain >= 0 && sincePain < PAIN_MS) return { anim: 'pain', frame: Math.min(PAIN_FRAMES - 1, Math.floor((sincePain / PAIN_MS) * PAIN_FRAMES)) };
    const state = this.state[slot];
    if (state === ST_ATTACKING) {
      const t = (((now - this.stateSince[slot]) % ATTACK_CYCLE_MS) + ATTACK_CYCLE_MS) % ATTACK_CYCLE_MS;
      return { anim: 'attack', frame: Math.floor((t / ATTACK_CYCLE_MS) * ATTACK_FRAMES) };
    }
    if ((state === ST_MOVING || state === ST_FALLING) && this.speed(slot) >= MOVING_SPEED) {
      return { anim: 'walk', frame: Math.floor(this.walk[slot] * WALK_FRAMES) % WALK_FRAMES };
    }
    return { anim: 'idle', frame: 0 };
  }

  private speed(slot: number): number {
    return Math.hypot(this.vx[slot], this.vy[slot]);
  }
}

/** A dead enemy playing its death animation, then lying on the floor and sinking into it. */
export interface Corpse {
  /** performance.now() when it died on screen. */
  start: number;
  x: number;
  y: number;
  z: number;
  facing: number;
}

export const CORPSE_MS = DEATH_MS + CORPSE_LIE_MS + CORPSE_SINK_MS;

/** The death frame and how far the corpse has sunk at `now`, or null once it's gone. */
export function corpseFrame(c: Corpse, now: number): { frame: number; sink: number } | null {
  const t = now - c.start;
  if (t < 0 || t >= CORPSE_MS) return null;
  const frame = Math.min(DEATH_FRAMES - 1, Math.floor((t / DEATH_MS) * DEATH_FRAMES));
  const sink = Math.max(0, (t - DEATH_MS - CORPSE_LIE_MS) / CORPSE_SINK_MS) * CORPSE_SINK_M;
  return { frame, sink };
}
