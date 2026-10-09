/**
 * Screen shake (M12 §4.5): offsets the view only (yaw, pitch and roll), never the aim. Each shake's
 * amplitude decays as (1 − t / decay)²; overlapping shakes add, capped at 2°. Each axis follows noise in
 * −1…1 with a new target every 30 ms, interpolated. Pure: the caller adds the offsets to the camera.
 */

/** The shakes of §4.5: amplitude and pitch dip in degrees, decay in ms. */
export const SHAKE_LANDING = { amp: 1.6, decay: 350, dip: 1.2 };
export const SHAKE_SHROUD = { amp: 0.7, decay: 200, dip: 0 };
export const SHAKE_BLASPHEMY = { amp: 0.5, decay: 200, dip: 0 };
/** A Shroud burst shakes players within this many meters. */
export const SHROUD_SHAKE_RANGE = 6;
/** The mass kill's: 0.5° + 0.02° per burst beyond 6, at most 1.0°, over 180 ms. */
export function massKillShake(count: number): { amp: number; decay: number; dip: number } {
  return { amp: Math.min(1, 0.5 + 0.02 * Math.max(0, count - 6)), decay: 180, dip: 0 };
}

export const SHAKE_CAP = 2;
export const SHAKE_STEP_MS = 30;
export const ROLL_FACTOR = 0.6;

/** The screen shake setting's `localStorage` key; on unless it's "0". */
export const SHAKE_KEY = 'heavenfall.screenShake';

export function loadShakeSetting(): boolean {
  try {
    return localStorage.getItem(SHAKE_KEY) !== '0';
  } catch {
    return true;
  }
}

export function saveShakeSetting(on: boolean): void {
  try {
    localStorage.setItem(SHAKE_KEY, on ? '1' : '0');
  } catch {
    // Storage blocked: the setting lasts for this page only.
  }
}

/** `amplitude × (1 − t / decay)²`, 0 outside [0, decay). */
export function envelope(amp: number, decay: number, t: number): number {
  if (t < 0 || t >= decay) return 0;
  return amp * (1 - t / decay) ** 2;
}

export interface ShakeOffset {
  /** Degrees. */
  yaw: number;
  pitch: number;
  roll: number;
}

export class Shake {
  private readonly shakes: Array<{ start: number; amp: number; decay: number; dip: number }> = [];
  /** Noise targets per axis: the previous and next, and the step they belong to. */
  private step = -1;
  /** No shake was running: the next one's noise starts from the center, so it doesn't jump. */
  private idle = true;
  private readonly from = [0, 0, 0];
  private readonly to = [0, 0, 0];
  private readonly out: ShakeOffset = { yaw: 0, pitch: 0, roll: 0 };

  constructor(
    private readonly enabled: () => boolean = loadShakeSetting,
    private readonly rnd: () => number = Math.random,
  ) {}

  /** Starts a shake; the setting is read now, so turning it off in Pause takes effect at once. */
  add(now: number, s: { amp: number; decay: number; dip: number }): void {
    if (!this.enabled()) return;
    this.shakes.push({ start: now, amp: s.amp, decay: s.decay, dip: s.dip });
  }

  /** The view's offsets at `now`, in degrees: noise on each axis, and the landing's dip pitching down. */
  sample(now: number): ShakeOffset {
    let amp = 0;
    let dip = 0;
    for (let i = this.shakes.length - 1; i >= 0; i--) {
      const s = this.shakes[i];
      const t = now - s.start;
      if (t >= s.decay) {
        this.shakes.splice(i, 1);
        continue;
      }
      amp += envelope(s.amp, s.decay, t);
      dip += envelope(s.dip, s.decay, t);
    }
    amp = Math.min(SHAKE_CAP, amp);
    const o = this.out;
    if (amp === 0 && dip === 0) {
      o.yaw = o.pitch = o.roll = 0;
      this.idle = true;
      return o;
    }
    const k = Math.floor(now / SHAKE_STEP_MS);
    if (k !== this.step) {
      // A new step starts where the last one was heading (from the center after a rest).
      for (let a = 0; a < 3; a++) {
        this.from[a] = this.idle ? 0 : k === this.step + 1 ? this.to[a] : this.rnd() * 2 - 1;
        this.to[a] = this.rnd() * 2 - 1;
      }
      this.step = k;
      this.idle = false;
    }
    const u = (now - k * SHAKE_STEP_MS) / SHAKE_STEP_MS;
    const n = (a: number) => this.from[a] + (this.to[a] - this.from[a]) * u;
    o.yaw = amp * n(0);
    o.pitch = amp * n(1) - dip;
    o.roll = ROLL_FACTOR * amp * n(2);
    return o;
  }
}
