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

// ------------------------------------------------------------------------------------- the Scourge

/** The Scourge's swing lasts this (M9 §5.1), fading out over its last SWING_FADE_MS. */
export const SWING_MS = 300;
const SWING_FADE_MS = 60;
/** The Chain Gun drops this far (vh) out of the left hand's way during the swing, and jolts this far right. */
export const SWING_DROP = 30;
const SWING_JOLT = 3;

/**
 * The swing `elapsed` ms after the Scourge (M11 §3.6, as reviewed in stage 1): which of the chain's
 * `frames` shows (with the fist where its hand is), the swing's opacity, and how far the Chain Gun is
 * moved out of the way (vh, x right, y down). Null outside the swing.
 */
export function swingPose(elapsed: number, frames: number): { frame: number; opacity: number; gunX: number; gunY: number } | null {
  if (!(elapsed >= 0) || elapsed >= SWING_MS) return null;
  const t = elapsed / SWING_MS;
  const s = Math.sin(Math.PI * t);
  return {
    frame: Math.min(frames - 1, Math.floor(t * frames)),
    opacity: Math.min(1, (SWING_MS - elapsed) / SWING_FADE_MS),
    gunX: SWING_JOLT * s,
    gunY: SWING_DROP * Math.min(1, 1.6 * s),
  };
}

/**
 * Shadowstep's slash (M12 §5.7, tuned in stage 4, decisions.md): the dagger, with the painting's height
 * at 0.55 of the view's, sweeps a backhand cut for 200 ms, its fist's center going from (+40, +22) vh to
 * (−40, +6) vh from the screen's center (x right, y down) and turning from +25° to −15° relative to the
 * painting (CSS, clockwise positive), by smoothstep; it fades in over 30 ms and out over the last 40 ms.
 */
export const SLASH_MS = 200;
export const SLASH_S = 0.55;
const SLASH_FROM: readonly [number, number] = [40, 22];
const SLASH_TO: readonly [number, number] = [-40, 6];
const SLASH_TURN: readonly [number, number] = [25, -15];
const SLASH_FADE_IN = 30;
const SLASH_FADE_OUT = 40;
/** The revolver drops 30 vh over 60 ms as the slash starts, and rises back over 120 ms after it. */
export const SLASH_DROP = 30;
const SLASH_DROP_MS = 60;
const SLASH_RISE_MS = 120;
/** The smear: the last 40 vh of the tip's path, 2.5 vh wide at the tip tapering to 0, fading over 80 ms after the slash. */
export const SMEAR_LENGTH = 40;
export const SMEAR_WIDTH = 2.5;
export const SMEAR_FADE_MS = 80;
/** The smear's path is the tip's, sampled this often (ms). */
const SMEAR_STEP_MS = 4;

/** The dagger's image (weapon.json's `slash`): its size, the painting's height, the fist's center and the tip, in its pixels. */
export interface SlashDagger {
  paintH: number;
  w: number;
  h: number;
  fist: [number, number];
  tip: [number, number];
}

/** vh per dagger pixel. */
export function daggerScale(d: SlashDagger): number {
  return (SLASH_S * 100) / d.paintH;
}

/** The slash `elapsed` ms after it started: the fist's center (vh from the screen's center), its turn and opacity; null outside it. */
export function slashPose(elapsed: number): { x: number; y: number; angle: number; opacity: number } | null {
  if (!(elapsed >= 0) || elapsed >= SLASH_MS) return null;
  const t = elapsed / SLASH_MS;
  const u = t * t * (3 - 2 * t);
  return {
    x: SLASH_FROM[0] + (SLASH_TO[0] - SLASH_FROM[0]) * u,
    y: SLASH_FROM[1] + (SLASH_TO[1] - SLASH_FROM[1]) * u,
    angle: SLASH_TURN[0] + (SLASH_TURN[1] - SLASH_TURN[0]) * u,
    opacity: Math.min(1, elapsed / SLASH_FADE_IN, (SLASH_MS - elapsed) / SLASH_FADE_OUT),
  };
}

/** How far the revolver is dropped (vh) `elapsed` ms after the slash started. */
export function slashGunDrop(elapsed: number): number {
  if (!(elapsed >= 0)) return 0;
  if (elapsed < SLASH_MS) return SLASH_DROP * Math.min(1, elapsed / SLASH_DROP_MS);
  return SLASH_DROP * Math.max(0, 1 - (elapsed - SLASH_MS) / SLASH_RISE_MS);
}

/** Where the blade's tip is on screen (vh from the center) at a pose: the measured tip through the dagger's transform. */
export function slashTip(d: SlashDagger, pose: { x: number; y: number; angle: number }): [number, number] {
  const k = daggerScale(d);
  const dx = (d.tip[0] - d.fist[0]) * k;
  const dy = (d.tip[1] - d.fist[1]) * k;
  const a = (pose.angle * Math.PI) / 180;
  return [pose.x + dx * Math.cos(a) - dy * Math.sin(a), pose.y + dx * Math.sin(a) + dy * Math.cos(a)];
}

/**
 * The smear `elapsed` ms after the slash started: an outline (vh from the screen's center) around the
 * last 40 vh of the path the tip traced, 2.5 vh wide at the tip and tapering to 0, and its opacity,
 * fading out over 80 ms after the slash; null when there's none.
 */
export function smearOutline(d: SlashDagger, elapsed: number): { points: Array<[number, number]>; opacity: number } | null {
  if (!(elapsed >= 0) || elapsed >= SLASH_MS + SMEAR_FADE_MS) return null;
  const end = Math.min(elapsed, SLASH_MS - 1e-6);
  // The tip's path, newest first.
  const path: Array<[number, number]> = [];
  for (let t = end; ; t -= SMEAR_STEP_MS) {
    path.push(slashTip(d, slashPose(Math.max(0, t))!));
    if (t <= 0) break;
  }
  const left: Array<[number, number]> = [];
  const right: Array<[number, number]> = [];
  let along = 0;
  for (let i = 0; i < path.length && along < SMEAR_LENGTH; i++) {
    if (i > 0) along += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
    const a = path[Math.max(0, i - 1)];
    const b = path[Math.min(path.length - 1, i + 1)];
    let nx = -(b[1] - a[1]);
    let ny = b[0] - a[0];
    const len = Math.hypot(nx, ny);
    if (len < 1e-9) continue;
    const half = (SMEAR_WIDTH / 2) * Math.max(0, 1 - along / SMEAR_LENGTH);
    nx = (nx / len) * half;
    ny = (ny / len) * half;
    left.push([path[i][0] + nx, path[i][1] + ny]);
    right.push([path[i][0] - nx, path[i][1] - ny]);
  }
  if (left.length < 2) return null;
  return { points: [...left, ...right.reverse()], opacity: elapsed < SLASH_MS ? 1 : 1 - (elapsed - SLASH_MS) / SMEAR_FADE_MS };
}
