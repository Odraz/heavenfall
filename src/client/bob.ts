/**
 * Doom-style view and weapon bob while walking (M8 §3.4), purely cosmetic: aiming, hit tests and
 * input use the unbobbed eye.
 */

/** One bob cycle per player walk stride (§11.1). */
const STRIDE = 2.5;
/** The eye moves down by this much at the bottom of each step. */
const EYE_DROP = 0.035;
/** Weapon frame sway, in % of the screen height: sideways and down. */
const WEAPON_X = 1.2;
const WEAPON_Y = 1.0;
/** The amplitude eases toward its target with this time constant, in seconds. */
const EASE = 0.15;
/** A horizontal move longer than this in one frame is a teleport, not walking. */
const TELEPORT_DIST = 2;

export class ViewBob {
  private phase = 0;
  private amp = 0;
  /** How far the eye is lowered this frame, in meters. */
  eyeDrop = 0;
  /** Weapon frame offset this frame, in % of the screen height (x right, y down). */
  weaponX = 0;
  weaponY = 0;

  /**
   * Advances the bob by a frame in which the player moved `dist` meters horizontally over `dt`
   * seconds. `grounded` is false while airborne or leaping; `dead` stops it.
   */
  update(dt: number, dist: number, speed: number, grounded: boolean, dead: boolean): void {
    if (dist > TELEPORT_DIST) dist = 0;
    const moving = dt > 0 && grounded && !dead;
    const target = moving ? Math.min(1, dist / dt / speed) : 0;
    this.amp += (target - this.amp) * (1 - Math.exp(-Math.max(0, dt) / EASE));
    if (moving) this.phase = (this.phase + (2 * Math.PI * dist) / STRIDE) % (2 * Math.PI);
    const s = Math.sin(this.phase);
    this.eyeDrop = EYE_DROP * Math.abs(s) * this.amp;
    this.weaponX = WEAPON_X * s * this.amp;
    this.weaponY = WEAPON_Y * Math.abs(s) * this.amp;
  }
}
