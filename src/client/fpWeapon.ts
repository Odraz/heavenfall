/**
 * The painted first-person weapon's motion and layers (M11 §3), as pure functions and small state
 * holders, so the HUD only writes styles. Times are in ms; angles in degrees, CSS's way (clockwise
 * positive on screen); offsets in vh unless named otherwise.
 */
import type { ClassId } from '../data/classes';
import { ATTACK_SECONDARY, type AttackSlot } from '../data/weapons';
import { lightTint } from '../render/lightmap';

/** The view the paintings are composed in (M11 §1): one view pixel is 100 / VIEW_H vh. */
export const VIEW_H = 2160;
export const VH_PER_PX = 100 / VIEW_H;

// ---------------------------------------------------------------------------------------------- tilt

/**
 * An attack's kick (M11 §3.2, as tuned in the stage 2 playtest): the muzzle's tilt in degrees (the Chain
 * Gun's alternates up and down) and the recoil, the weapon pushed down by this % of the screen height. The
 * shotgun and slug keep M9's 8 and 12; the faster weapons kick less, so they don't shake.
 */
export function attackKick(classId: ClassId, slot: AttackSlot): { deg: number; alternate: boolean; recoil: number } {
  const secondary = slot === ATTACK_SECONDARY;
  switch (classId) {
    case 'fallen':
      return secondary ? { deg: 6, alternate: false, recoil: 12 } : { deg: 4, alternate: false, recoil: 8 };
    case 'heretic':
      return { deg: 4, alternate: false, recoil: 5 };
    case 'binder':
      return { deg: 0.8, alternate: true, recoil: 1.5 };
    case 'betrayer':
      return secondary ? { deg: 7, alternate: false, recoil: 8 } : { deg: 4, alternate: false, recoil: 3.5 };
  }
}

/** The recoil falls back over this, or the time between shots if shorter, so a fast weapon settles each shot. */
export const RECOIL_MS = 120;

/** The recoil's share left `sinceShot` after a shot (1 at the shot, 0 once settled). */
export function recoilLeft(sinceShot: number, intervalMs: number): number {
  if (!(sinceShot >= 0) || !Number.isFinite(sinceShot)) return 0;
  return Math.max(0, 1 - sinceShot / Math.min(RECOIL_MS, intervalMs));
}

/**
 * The hammer and cylinder animate over at most this (M11 §3.8, as tuned in the stage 2 playtest): a slow
 * shot (the Silver Bullet, the Censer Launcher) moves them as fast as the revolver's normal shot.
 */
export const ACTION_MAX_MS = 300;

/** The tilt `sinceShot` after a shot of tilt `T`: T (1 − s)², s = sinceShot / min(interval, 250 ms). */
export function recoilTilt(T: number, sinceShot: number, intervalMs: number): number {
  if (!(sinceShot >= 0) || !Number.isFinite(sinceShot)) return 0;
  const s = Math.min(1, sinceShot / Math.min(intervalMs, 250));
  return T * (1 - s) * (1 - s);
}

/** The last shot's tilt, alternating its sign for the Chain Gun. */
export class Tilt {
  private sign = -1;
  /** The signed tilt of the last shot. */
  T = 0;

  shot(deg: number, alternate: boolean): void {
    if (alternate) {
      this.sign = -this.sign;
      this.T = deg * this.sign;
    } else this.T = deg;
  }
}

// --------------------------------------------------------------------------------------- transform

/**
 * Where a point of the weapon box lands after its transform (M11 §3.2): turned clockwise by `tiltDeg`
 * around `pivot`, then moved by (dx, dy). All in the same units (view pixels, say).
 */
export function transformPoint(p: readonly [number, number], pivot: readonly [number, number], tiltDeg: number, dx: number, dy: number): [number, number] {
  const t = (tiltDeg * Math.PI) / 180;
  const c = Math.cos(t);
  const s = Math.sin(t);
  const x = p[0] - pivot[0];
  const y = p[1] - pivot[1];
  return [pivot[0] + x * c - y * s + dx, pivot[1] + x * s + y * c + dy];
}

// -------------------------------------------------------------------------------------------- sway

const SWAY_X = -0.006;
const SWAY_Y = 0.004;
const SWAY_X_MAX = 2;
const SWAY_Y_MAX = 1.5;
const SWAY_EASE = 0.08;

/** The weapon lagging behind the view's turning (M11 §3.2), in vh. */
export class Sway {
  x = 0;
  y = 0;

  /**
   * `yawRate` and `pitchRate` in degrees per second (yaw positive to the right, pitch positive up);
   * `reset` on a teleport or respawn; `dead` holds it at 0.
   */
  update(dt: number, yawRate: number, pitchRate: number, dead: boolean, reset: boolean): void {
    if (reset || dead) {
      this.x = 0;
      this.y = 0;
      return;
    }
    const tx = Math.max(-SWAY_X_MAX, Math.min(SWAY_X_MAX, SWAY_X * yawRate));
    const ty = Math.max(-SWAY_Y_MAX, Math.min(SWAY_Y_MAX, SWAY_Y * pitchRate));
    const k = 1 - Math.exp(-Math.max(0, dt) / SWAY_EASE);
    this.x += (tx - this.x) * k;
    this.y += (ty - this.y) * k;
  }
}

// -------------------------------------------------------------------------------------------- glow

const GLOW_PERIOD = 2400;
const GLOW_FLARE = 300;

/** The glow layers' strength g (M11 §3.3): breathing 0.2–0.5 while idle, 1 at a shot, back over 300 ms. */
export function glowLevel(now: number, sinceShot: number): number {
  const idle = 0.35 + 0.15 * Math.sin((2 * Math.PI * now) / GLOW_PERIOD);
  if (!(sinceShot >= 0) || !Number.isFinite(sinceShot)) return idle;
  return Math.max(idle, 1 - sinceShot / GLOW_FLARE);
}

// -------------------------------------------------------------------------------------- alt frames

export type AltKind = 'pump' | 'empty' | 'spin';

/** The alt frame's opacity a (M11 §3.4) `sinceShot` after the last shot of `kind`'s weapon. */
export function altLevel(kind: AltKind, sinceShot: number, intervalMs: number): number {
  if (!(sinceShot >= 0) || !Number.isFinite(sinceShot)) return 0;
  switch (kind) {
    case 'empty': {
      const s = sinceShot / intervalMs;
      if (s < 0.5) return 1;
      return Math.max(0, 1 - (s - 0.5) / 0.3);
    }
    case 'spin':
      if (sinceShot < 150) return 1;
      return Math.max(0, 1 - (sinceShot - 150) / 100);
    case 'pump': {
      const s = sinceShot / intervalMs;
      return s >= 0.3 && s < 0.6 ? 1 : 0;
    }
  }
}

// ------------------------------------------------------------------------------ hammer and cylinder

/** The hammer's angle (M11 §3.8): `fall` from the shot to s = 0.15, back to 0 by s = 0.45 by (1 − p)²; s is the time over min(interval, ACTION_MAX_MS). */
export function hammerAngle(fall: number, sinceShot: number, intervalMs: number): number {
  if (!(sinceShot >= 0) || !Number.isFinite(sinceShot)) return 0;
  const s = sinceShot / Math.min(intervalMs, ACTION_MAX_MS);
  if (s <= 0.15) return fall;
  if (s >= 0.45) return 0;
  const p = (s - 0.15) / 0.3;
  return fall * (1 - p) * (1 - p);
}

/** The cylinder blur's opacity (M11 §3.8): rising over s 0.15–0.22, held to 0.35, gone by 0.45. */
export function cylinderBlur(sinceShot: number, intervalMs: number): number {
  if (!(sinceShot >= 0) || !Number.isFinite(sinceShot)) return 0;
  const s = sinceShot / Math.min(intervalMs, ACTION_MAX_MS);
  if (s <= 0.15 || s >= 0.45) return 0;
  if (s < 0.22) return (s - 0.15) / 0.07;
  if (s <= 0.35) return 1;
  return (0.45 - s) / 0.1;
}

// ------------------------------------------------------------------------------------ healing censer

const HEAL_RISE = 150;
const HEAL_FALL = 300;

/** The green censer's opacity h (M11 §3.9): toward 1 over 150 ms while healing, toward 0 over 300 ms after. */
export class HealFade {
  private on = false;
  private from = 0;
  private at = 0;

  set(on: boolean, now: number): void {
    if (on === this.on) return;
    this.from = this.value(now);
    this.at = now;
    this.on = on;
  }

  value(now: number): number {
    const t = Math.max(0, now - this.at);
    return this.on ? Math.min(1, this.from + t / HEAL_RISE) : Math.max(0, this.from - t / HEAL_FALL);
  }
}

/** The opacities of the glow and censer layers (M11 §3.1, §3.9) from g, a and h. */
export function layerOpacities(g: number, a: number, h: number): { idleGlow: number; altGlow: number; censer: number; censerGlow: number } {
  return { idleGlow: g * (1 - a) * (1 - h), altGlow: g * a, censer: h * (1 - a), censerGlow: g * h * (1 - a) };
}

// ------------------------------------------------------------------------------------------- light

const LIGHT_EASE = 0.25;
const LIGHT_STEP = 0.005;

/** The weapon's brightness in shade (M11 §3.5): `lightTint(L).brightness`, eased; written only on a 0.005 change. */
export class WeaponLight {
  b = 1;
  private written = NaN;

  /** Eases toward the light at L (0–1); returns the brightness to write, or null if it needn't be. */
  update(dt: number, L: number): number | null {
    const target = lightTint(L, false).brightness;
    this.b += (target - this.b) * (1 - Math.exp(-Math.max(0, dt) / LIGHT_EASE));
    if (Math.abs(this.b - this.written) < LIGHT_STEP) return null;
    this.written = this.b;
    return this.b;
  }

  /** Jumps to the light at L (the first frame). */
  reset(L: number): void {
    this.b = lightTint(L, false).brightness;
    this.written = NaN;
  }
}
