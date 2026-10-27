/** Local player movement, run every render frame on the player's own main thread (§2.2, §5.2). */
import { FALLING_STAR_TIME, SHADOWSTEP_SPEED, SHADOWSTEP_TIME } from '../data/weapons';
import { GATEBREAKER } from '../data/talents';
import { DOMINION_LAUNCH_SECONDS, DOMINION_LAUNCH_VZ } from '../data/dominion';
import { directionalSpeedFactor } from '../data/movement';
import { arcPoint } from './fallingStarAim';
import { JUMP_VZ, PLAYER_RADIUS } from '../sim/constants';
import type { GameMap } from '../sim/map';
import { jump, stepBody, updateGround, type Body, type MoveResult } from '../sim/movement';
import { dragStep, DRAG_SPEED, DRAG_STOP } from '../data/gatekeeper';

export const PITCH_LIMIT = (85 * Math.PI) / 180;
/** Render-frame dt is clamped to 50 ms. */
export const MAX_FRAME_DT = 0.05;

export class LocalPlayer {
  readonly body: Body;
  carried = false;
  /**
   * Called to the Gate (rogue bosses.md §3.5): lifted and dragged toward (x, y) at the host's fixed feet
   * height. The screen predicts the drag with the host's own sweep, so a held player's view glides at
   * 2.5 m/s instead of stepping with 10 Hz snapshots; the host's release teleport ends it.
   */
  held: { x: number; y: number } | null = null;
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

  /** Falling Star in progress: the arc from → to, ignoring collision. */
  private leap: { fx: number; fy: number; fz: number; tx: number; ty: number; tz: number; t: number } | null = null;
  /** Shadowstep in progress: a horizontal dash with normal movement rules. */
  private dash: { dx: number; dy: number; t: number; speed: number; time: number } | null = null;
  private launch: { dx: number; dy: number; remaining: number } | null = null;
  /** Gatebreaker in progress (classes-fallen.md §4): its heading, elapsed time and the requested end. */
  private charge: { heading: number; t: number; release: number } | null = null;

  /** Gatebreaker: charges at 15 m/s along the view, turning toward it at up to 180°/s, for 0.3–1.2 s. */
  startCharge(): void {
    if (this.carried || this.held || this.leap) return;
    this.charge = { heading: this.yaw, t: 0, release: GATEBREAKER.maxTime };
    this.dash = null;
    this.launch = null;
  }

  /** E released: the charge ends now, or at its 0.3 s minimum. */
  releaseCharge(): void {
    if (this.charge) this.charge.release = Math.max(GATEBREAKER.minTime, Math.min(this.charge.release, this.charge.t));
  }

  get charging(): boolean {
    return this.charge !== null;
  }

  /** Falling Star (M12 §5.2): flies the arc to the landing point (feet) over 0.4 s, ignoring collision. */
  startLeap(tx: number, ty: number, tz: number): void {
    if (this.carried || this.held) return;
    const b = this.body;
    this.leap = { fx: b.x, fy: b.y, fz: b.z, tx, ty, tz, t: 0 };
    this.dash = null;
    this.launch = null;
    this.carried = false;
  }

  /** Shadowstep (§6.4): 40 m/s for 0.2 s along the horizontal direction (dx, dy). */
  startDash(dx: number, dy: number): void {
    if (this.carried || this.held) return;
    const len = Math.hypot(dx, dy);
    if (len < 1e-9) return;
    this.dash = { dx: dx / len, dy: dy / len, t: 0, speed: SHADOWSTEP_SPEED, time: SHADOWSTEP_TIME };
    this.launch = null;
    this.carried = false;
  }

  /**
   * A host-granted straight move with normal movement rules (R4): the Way Back's return toward its
   * shadow, or Recoil's push. (vx, vy) in m/s for `seconds`.
   */
  startMove(vx: number, vy: number, seconds: number): void {
    if (this.carried || this.held || this.leap) return;
    const speed = Math.hypot(vx, vy);
    if (speed < 1e-9 || seconds <= 0) return;
    this.dash = { dx: vx / speed, dy: vy / speed, t: 0, speed, time: seconds };
    this.launch = null;
  }

  get leaping(): boolean {
    return this.leap !== null;
  }

  get dashing(): boolean {
    return this.dash !== null;
  }

  /**
   * Moves the player. `dirX`, `dirY` is the horizontal movement direction in world space
   * (normalized, or zero to stand still).
   */
  update(map: GameMap, dt: number, dirX: number, dirY: number, wantJump: boolean): void {
    if (this.carried) { this.moveResult.blocked = false; return; }
    dt = Math.min(dt, MAX_FRAME_DT);
    const b = this.body;
    if (this.held) {
      this.moveResult.blocked = false;
      b.vz = 0;
      b.grounded = false;
      if (Math.hypot(this.held.x - b.x, this.held.y - b.y) > DRAG_STOP) dragStep(map, b, this.held.x, this.held.y, DRAG_SPEED * dt);
      return;
    }
    if (this.launch) {
      const force = this.launch, slice = Math.min(dt, force.remaining);
      stepBody(map, b, force.dx * slice, force.dy * slice, dt, this.moveResult);
      force.remaining -= dt;
      if (force.remaining <= 1e-9) this.launch = null;
      return;
    }
    if (this.leap) {
      const l = this.leap;
      l.t += dt;
      const f = Math.min(1, l.t / FALLING_STAR_TIME);
      [b.x, b.y, b.z] = arcPoint(l.fx, l.fy, l.fz, l.tx, l.ty, l.tz, f);
      this.moveResult.blocked = false;
      if (f >= 1) {
        this.leap = null;
        b.vz = 0;
        b.grounded = true;
        updateGround(map, b);
      }
      return;
    }
    if (this.charge) {
      const c = this.charge, step = Math.min(dt, Math.max(0, c.release - c.t));
      const turn = wrapAngle(this.yaw - c.heading), max = GATEBREAKER.turn * dt;
      c.heading = wrapAngle(c.heading + Math.max(-max, Math.min(max, turn)));
      c.t += dt;
      this.moveResult.blocked = false;
      stepBody(map, b, Math.cos(c.heading) * GATEBREAKER.speed * step, Math.sin(c.heading) * GATEBREAKER.speed * step, dt, this.moveResult);
      // A wall stops the charge; so does its end.
      if (this.moveResult.blocked || c.t >= c.release - 1e-9) this.charge = null;
      return;
    }
    let speed = this.speed * this.wade * directionalSpeedFactor(this.yaw, dirX, dirY);
    if (this.dash) {
      this.dash.t += dt;
      dirX = this.dash.dx;
      dirY = this.dash.dy;
      speed = this.dash.speed;
      if (this.dash.t >= this.dash.time) this.dash = null;
    }
    if (wantJump) jump(b, JUMP_VZ);
    stepBody(map, b, dirX * speed * dt, dirY * speed * dt, dt, this.moveResult);
  }

  /**
   * The Call's hold starts at feet (x, y, z), dragging toward (tx, ty), `elapsed` seconds ago on the host
   * (the event's way here): the drag is caught up at once, so the screen matches the host's position.
   */
  hold(map: GameMap, x: number, y: number, z: number, tx: number, ty: number, elapsed: number): void {
    this.teleport(x, y, z);
    this.held = { x: tx, y: ty };
    this.body.grounded = false;
    const catchUp = Math.max(0, Math.min(0.5, elapsed));
    if (catchUp > 0 && Math.hypot(tx - x, ty - y) > DRAG_STOP) dragStep(map, this.body, tx, ty, DRAG_SPEED * catchUp);
  }

  /** Moves the player instantly, as for a teleport. `launch` is the host's horizontal velocity in m/s. */
  teleport(x: number, y: number, z: number, launch?: { dx: number; dy: number }): void {
    this.carried = false;
    this.held = null;
    this.leap = null;
    this.dash = null;
    this.charge = null;
    this.launch = launch ? { ...launch, remaining: DOMINION_LAUNCH_SECONDS } : null;
    this.body.x = x;
    this.body.y = y;
    this.body.z = z;
    this.body.vz = launch ? DOMINION_LAUNCH_VZ : 0;
    this.body.grounded = !launch;
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
