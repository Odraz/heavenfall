/**
 * Client-side animation of 8-direction enemy sprites (§11.1). Snapshots carry no facing or
 * animation time, so both are derived here: facing from the interpolated movement (or the nearest
 * player while winding up or attacking), the walk cycle from distance walked, the Blessed attack
 * cycle from when the `attacking` state began, matching the melee timing (first hit 267 ms in, on
 * the 8th tick in range, then every 1 s: M12 §3.2), and casts from when the wind-up began and when the shot fired. Cherubs flap their
 * wings on a clock instead of walking; the Gatekeeper's casts follow the boss cast in the snapshot.
 */
import { BLESSED, CHERUB, CHORISTER, GATEKEEPER, ST_ATTACKING, ST_FALLING, ST_MOVING, ST_WINDUP } from '../data/enemies';
import { BOSS_CAST_JUDGMENT, BOSS_CAST_VOLLEY } from '../sim/sim';
import { ENEMY_SLOTS } from '../sim/constants';

export type EnemyAnimName = 'idle' | 'walk' | 'fly' | 'attack' | 'cast' | 'volley' | 'judgment' | 'pain' | 'death';

/** Meters walked per walk cycle (two steps), so the feet keep pace with the ground: the Blessed's. */
export const WALK_CYCLE_M = 1.6;
/** Walk cycle lengths by enemy type (§11.1). */
const WALK_CYCLES: Record<number, number> = { [BLESSED]: WALK_CYCLE_M, [CHORISTER]: 2.0 };
/**
 * Casts (§11.1): the wind-up frames play over the wind-up and hold the last one; the release
 * frames play from the tick the shot fires.
 */
export interface CastTiming {
  windupFrames: number;
  windupMs: number;
  releaseFrames: number;
  releaseMs: number;
}
export const CAST_TIMINGS: Partial<Record<number, CastTiming>> = {
  [CHORISTER]: { windupFrames: 6, windupMs: 1000, releaseFrames: 2, releaseMs: 250 },
  [CHERUB]: { windupFrames: 4, windupMs: 500, releaseFrames: 2, releaseMs: 200 },
};
/** The Cherub's wingbeat: 6 frames every 0.5 s. */
export const FLY_FRAMES = 6;
export const FLY_CYCLE_MS = 500;
/** A Cherub's corpse falls to the ground under it at this acceleration while it dies, in m/s². */
export const CORPSE_FALL_G = 20;
/** The Gatekeeper's Volley: frames 1–3 over the wind-up, then frame 4 for 0.3 s once it fires. */
export const VOLLEY_WINDUP_FRAMES = 3;
export const VOLLEY_WINDUP_MS = 500;
export const VOLLEY_RELEASE_MS = 300;
/** Judgment's 4 frames loop every second while it is cast. */
export const JUDGMENT_FRAMES = 4;
export const JUDGMENT_CYCLE_MS = 1000;
/** The Gatekeeper's death plays over 1.5 s, and its corpse stays. */
export const BOSS_DEATH_MS = 1500;
export const WALK_FRAMES = 8;
/** The attack cycle: 8 frames over 1 s, the blow landing on frame 4. */
export const ATTACK_FRAMES = 8;
export const ATTACK_CYCLE_MS = 1000;
/**
 * The cycle starts this far in when `attacking` begins (M12 §3.2), so the blow (frame 4, 500–625 ms
 * into the cycle) is on screen when the first strike lands, 267 ms after.
 */
export const ATTACK_LEAD_MS = 267;
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
export const MOVING_SPEED = 0.4;
/** Time constant of the velocity smoothing, in seconds. */
export const VELOCITY_TAU = 0.12;
/** Interpolated jumps longer than this in one frame aren't walking (a reused slot, a stall). */
export const MAX_STEP_M = 1.5;

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
  anim: EnemyAnimName;
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
  /** When a casting enemy last fired (its state became `attacking`). */
  private readonly firedAt = new Float64Array(ENEMY_SLOTS).fill(-Infinity);
  private readonly type = new Uint8Array(ENEMY_SLOTS);
  /** Frame number when each slot was last updated; a gap means the slot is a new enemy. */
  private readonly seen = new Uint32Array(ENEMY_SLOTS);
  private frameNo = 1;

  /** Starts a frame; call before `update`. */
  begin(): void {
    this.frameNo++;
  }

  /**
   * Advances one enemy to time `now` (ms) after `dt` seconds, at its interpolated position.
   * `targetX/Y` is the nearest player, faced while winding up or attacking and when the enemy first
   * appears. `type` is the enemy type (BLESSED by default).
   */
  update(slot: number, x: number, y: number, state: number, now: number, dt: number, targetX: number, targetY: number, type = BLESSED): void {
    const fresh = this.seen[slot] !== this.frameNo - 1 || this.type[slot] !== type;
    this.seen[slot] = this.frameNo;
    if (fresh) {
      this.type[slot] = type;
      this.firedAt[slot] = -Infinity;
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
      this.walk[slot] = (this.walk[slot] + step / (WALK_CYCLES[type] ?? WALK_CYCLE_M)) % 1;
    }
    if (state !== this.state[slot]) {
      this.state[slot] = state;
      this.stateSince[slot] = now;
      if (state === ST_ATTACKING) this.firedAt[slot] = now;
    }
    // The Gatekeeper always faces the nearest player; others while winding up or attacking.
    if (type === GATEKEEPER || state === ST_ATTACKING || state === ST_WINDUP) this.facing[slot] = Math.atan2(targetY - y, targetX - x);
    else if (this.speed(slot) >= MOVING_SPEED) this.facing[slot] = Math.atan2(this.vy[slot], this.vx[slot]);
  }

  /** The enemy was hurt at `now`: it flinches unless it flinched within the cooldown. */
  hurt(slot: number, now: number): void {
    if (now - this.painStart[slot] >= PAIN_COOLDOWN_MS) this.painStart[slot] = now;
  }

  /** The animation and frame to show for a slot at `now`; `bossCast` is the snapshot's (BOSS_CAST_*). */
  pick(slot: number, now: number, bossCast = 0): AnimPick {
    const sincePain = now - this.painStart[slot];
    if (sincePain >= 0 && sincePain < PAIN_MS) return { anim: 'pain', frame: Math.min(PAIN_FRAMES - 1, Math.floor((sincePain / PAIN_MS) * PAIN_FRAMES)) };
    const state = this.state[slot];
    const type = this.type[slot];
    if (type === GATEKEEPER) return this.pickBoss(slot, now, bossCast);
    const cast = CAST_TIMINGS[type];
    if (cast) {
      // The release plays out even though `attacking` lasts only the tick the shot fires.
      const sinceFired = now - this.firedAt[slot];
      if (sinceFired >= 0 && sinceFired < cast.releaseMs) {
        return { anim: 'cast', frame: cast.windupFrames + Math.min(cast.releaseFrames - 1, Math.floor((sinceFired / cast.releaseMs) * cast.releaseFrames)) };
      }
      if (state === ST_WINDUP) {
        const t = Math.max(0, now - this.stateSince[slot]);
        return { anim: 'cast', frame: Math.min(cast.windupFrames - 1, Math.floor((t / cast.windupMs) * cast.windupFrames)) };
      }
    } else if (state === ST_ATTACKING) {
      const t = (((now - this.stateSince[slot] + ATTACK_LEAD_MS) % ATTACK_CYCLE_MS) + ATTACK_CYCLE_MS) % ATTACK_CYCLE_MS;
      return { anim: 'attack', frame: Math.floor((t / ATTACK_CYCLE_MS) * ATTACK_FRAMES) };
    }
    if (type === CHERUB) {
      // Wingbeats on a clock, offset per slot so a flock doesn't flap in unison.
      const t = (((now + slot * 0.618034 * FLY_CYCLE_MS) % FLY_CYCLE_MS) + FLY_CYCLE_MS) % FLY_CYCLE_MS;
      return { anim: 'fly', frame: Math.floor((t / FLY_CYCLE_MS) * FLY_FRAMES) % FLY_FRAMES };
    }
    if ((state === ST_MOVING || state === ST_FALLING) && this.speed(slot) >= MOVING_SPEED) {
      return { anim: 'walk', frame: Math.floor(this.walk[slot] * WALK_FRAMES) % WALK_FRAMES };
    }
    return { anim: 'idle', frame: 0 };
  }

  private pickBoss(slot: number, now: number, bossCast: number): AnimPick {
    const sinceFired = now - this.firedAt[slot];
    if (sinceFired >= 0 && sinceFired < VOLLEY_RELEASE_MS) return { anim: 'volley', frame: VOLLEY_WINDUP_FRAMES };
    const t = Math.max(0, now - this.stateSince[slot]);
    if (bossCast === BOSS_CAST_JUDGMENT) return { anim: 'judgment', frame: Math.floor((t % JUDGMENT_CYCLE_MS) / (JUDGMENT_CYCLE_MS / JUDGMENT_FRAMES)) };
    if (bossCast === BOSS_CAST_VOLLEY && this.state[slot] === ST_WINDUP) {
      return { anim: 'volley', frame: Math.min(VOLLEY_WINDUP_FRAMES - 1, Math.floor((t / VOLLEY_WINDUP_MS) * VOLLEY_WINDUP_FRAMES)) };
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
  /** The enemy type, whose atlas draws it. */
  type: number;
  /** Where a flying enemy died, above `z`: it falls to `z` while dying (Cherubs). */
  fallFrom?: number;
}

export const CORPSE_MS = DEATH_MS + CORPSE_LIE_MS + CORPSE_SINK_MS;

/**
 * The death frame and how far below its `z` to draw the corpse at `now` (negative while a falling
 * corpse is still in the air), or null once it's gone.
 */
export function corpseFrame(c: Corpse, now: number): { frame: number; sink: number } | null {
  const t = now - c.start;
  if (t < 0) return null;
  // The Gatekeeper falls more slowly and stays where it fell.
  if (c.type === GATEKEEPER) return { frame: Math.min(DEATH_FRAMES - 1, Math.floor((t / BOSS_DEATH_MS) * DEATH_FRAMES)), sink: 0 };
  if (t >= CORPSE_MS) return null;
  const frame = Math.min(DEATH_FRAMES - 1, Math.floor((t / DEATH_MS) * DEATH_FRAMES));
  const sink = Math.max(0, (t - DEATH_MS - CORPSE_LIE_MS) / CORPSE_SINK_MS) * CORPSE_SINK_M;
  // `sink` is how far below `z` to draw it; a falling corpse is drawn above `z` until it lands.
  const s = t / 1000;
  const above = c.fallFrom === undefined ? 0 : Math.max(0, c.fallFrom - c.z - 0.5 * CORPSE_FALL_G * s * s);
  return { frame, sink: sink - above };
}
