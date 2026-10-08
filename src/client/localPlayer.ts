/** Local player movement, run every render frame on the player's own main thread (§2.2, §5.2). */
import { FALLING_STAR_TIME, SHADOWSTEP_SPEED, SHADOWSTEP_TIME } from '../data/weapons';
import { JUMP_VZ, PLAYER_RADIUS } from '../sim/constants';
import type { GameMap } from '../sim/map';
import { jump, stepBody, updateGround, type Body, type MoveResult } from '../sim/movement';

export const PITCH_LIMIT = (85 * Math.PI) / 180;
/** Render-frame dt is clamped to 50 ms. */
export const MAX_FRAME_DT = 0.05;

export class LocalPlayer {
  readonly body: Body;
  yaw = 0;
  pitch = 0;
  readonly moveResult: MoveResult = { blocked: false };
  /** Wading's speed factor (M12 §3.1), set every frame; the dash and the leap ignore it. */
  wade = 1;

  constructor(
    x: number,
    y: number,
    z: number,
    public speed: number,
  ) {
    this.body = { x, y, z, vz: 0, grounded: true, radius: PLAYER_RADIUS, flying: false };
  }

  look(dYaw: number, dPitch: number): void {
    this.yaw = wrapAngle(this.yaw + dYaw);
    this.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, this.pitch + dPitch));
  }

  /** Falling Star in progress: a straight line from → to, ignoring collision. */
  private leap: { fx: number; fy: number; fz: number; tx: number; ty: number; tz: number; t: number } | null = null;
  /** Shadowstep in progress: a horizontal dash with normal movement rules. */
  private dash: { dx: number; dy: number; t: number } | null = null;

  /** Falling Star (§6.1): moves linearly to the ally's position over 0.4 s, ignoring collision. */
  startLeap(tx: number, ty: number, tz: number): void {
    const b = this.body;
    this.leap = { fx: b.x, fy: b.y, fz: b.z, tx, ty, tz, t: 0 };
    this.dash = null;
  }

  /** Shadowstep (§6.4): 40 m/s for 0.2 s along the horizontal direction (dx, dy). */
  startDash(dx: number, dy: number): void {
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return;
    this.dash = { dx: dx / len, dy: dy / len, t: 0 };
  }

  get leaping(): boolean {
    return this.leap !== null;
  }

  /**
   * Moves the player. `dirX`, `dirY` is the horizontal movement direction in world space
   * (normalized, or zero to stand still).
   */
  update(map: GameMap, dt: number, dirX: number, dirY: number, wantJump: boolean): void {
    dt = Math.min(dt, MAX_FRAME_DT);
    const b = this.body;
    if (this.leap) {
      const l = this.leap;
      l.t += dt;
      const f = Math.min(1, l.t / FALLING_STAR_TIME);
      b.x = l.fx + (l.tx - l.fx) * f;
      b.y = l.fy + (l.ty - l.fy) * f;
      b.z = l.fz + (l.tz - l.fz) * f;
      this.moveResult.blocked = false;
      if (f >= 1) {
        this.leap = null;
        b.vz = 0;
        b.grounded = true;
        updateGround(map, b);
      }
      return;
    }
    let speed = this.speed * this.wade;
    if (this.dash) {
      this.dash.t += dt;
      dirX = this.dash.dx;
      dirY = this.dash.dy;
      speed = SHADOWSTEP_SPEED;
      if (this.dash.t >= SHADOWSTEP_TIME) this.dash = null;
    }
    if (wantJump) jump(b, JUMP_VZ);
    stepBody(map, b, dirX * speed * dt, dirY * speed * dt, dt, this.moveResult);
  }

  /** Moves the player instantly, as for a teleport. */
  teleport(x: number, y: number, z: number): void {
    this.leap = null;
    this.dash = null;
    this.body.x = x;
    this.body.y = y;
    this.body.z = z;
    this.body.vz = 0;
    this.body.grounded = true;
  }
}

/** World-space direction for WASD axes relative to yaw (yaw measured from +x toward +y). */
export function wasdDirection(yaw: number, forward: number, right: number): [number, number] {
  if (forward === 0 && right === 0) return [0, 0];
  const fx = Math.cos(yaw);
  const fy = Math.sin(yaw);
  // Right is yaw + 90°.
  const x = fx * forward - fy * right;
  const y = fy * forward + fx * right;
  const len = Math.hypot(x, y);
  return [x / len, y / len];
}

export function wrapAngle(a: number): number {
  a %= Math.PI * 2;
  if (a > Math.PI) a -= Math.PI * 2;
  else if (a < -Math.PI) a += Math.PI * 2;
  return a;
}
