/** Local player movement, run every render frame on the player's own main thread (§2.2, §5.2). */
import { JUMP_VZ, PLAYER_RADIUS } from '../sim/constants';
import type { GameMap } from '../sim/map';
import { jump, stepBody, type Body, type MoveResult } from '../sim/movement';

export const PITCH_LIMIT = (85 * Math.PI) / 180;
/** Render-frame dt is clamped to 50 ms. */
export const MAX_FRAME_DT = 0.05;

export class LocalPlayer {
  readonly body: Body;
  yaw = 0;
  pitch = 0;
  readonly moveResult: MoveResult = { blocked: false };

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

  /**
   * Moves the player. `dirX`, `dirY` is the horizontal movement direction in world space
   * (normalized, or zero to stand still).
   */
  update(map: GameMap, dt: number, dirX: number, dirY: number, wantJump: boolean): void {
    dt = Math.min(dt, MAX_FRAME_DT);
    if (wantJump) jump(this.body, JUMP_VZ);
    stepBody(map, this.body, dirX * this.speed * dt, dirY * this.speed * dt, dt, this.moveResult);
  }

  /** Moves the player instantly, as for a teleport. */
  teleport(x: number, y: number, z: number): void {
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
