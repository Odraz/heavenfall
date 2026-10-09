/**
 * Knowing how you're doing (M12 §6.1, §6.2): the vignettes' strengths and fades, and low HP with its
 * heartbeat and crimson edge. Pure: no DOM or three.js.
 */

/** Damage taken: a red vignette at lost ÷ max HP × 3, between 0.3 and 0.85, fading over 500 ms. */
export const HURT_MIN = 0.3;
export const HURT_MAX = 0.85;
export const HURT_FADE_MS = 500;
/** Healed (and Communion): green at 0.45, fading over 600 ms. */
export const HEAL_VIGNETTE = 0.45;
export const HEAL_FADE_MS = 600;
/** The shield: a steady blue edge at 0.2 while it's up; the fading blue flashes at 0.6 when it goes up and 0.7 when it's gone, over 500 ms. */
export const SHIELD_EDGE = 0.2;
export const SHIELD_UP_FLASH = 0.6;
export const SHIELD_GONE_FLASH = 0.7;
export const SHIELD_FADE_MS = 500;

/** The red vignette's strength for `lost` HP and shield. */
export function hurtVignette(lost: number, maxHp: number): number {
  return Math.min(HURT_MAX, Math.max(HURT_MIN, (lost / maxHp) * 3));
}

/** Low HP: entered below 35% of max HP (the shield doesn't count), left at 40% or more, or on death. */
export const LOW_ENTER = 0.35;
export const LOW_LEAVE = 0.4;
/** The heartbeat every 0.7 s while low, every 0.5 s below 15%. */
export const BEAT_MS = 700;
export const BEAT_FAST_MS = 500;
export const BEAT_FAST_BELOW = 0.15;
/** The crimson edge: 0.3, rising to 0.55 on each heartbeat and falling back over 0.35 s. */
export const EDGE_BASE = 0.3;
export const EDGE_BEAT = 0.55;
export const EDGE_FALL_MS = 350;

/** Low HP over time: whether it's on, when a heartbeat plays, and the crimson edge's opacity. */
export class LowHp {
  low = false;
  private beatAt = -Infinity;

  /**
   * The local player's state at `now` (ms): alive or not, HP (without the shield) and max HP. Returns
   * whether a heartbeat plays now. Entering low HP beats at once.
   */
  update(now: number, alive: boolean, hp: number, maxHp: number): boolean {
    const f = hp / maxHp;
    if (!alive || f >= LOW_LEAVE - 1e-9) this.low = false;
    else if (f < LOW_ENTER - 1e-9) this.low = true;
    if (!this.low) {
      this.beatAt = -Infinity;
      return false;
    }
    const gap = f < BEAT_FAST_BELOW - 1e-9 ? BEAT_FAST_MS : BEAT_MS;
    if (now - this.beatAt < gap) return false;
    this.beatAt = now;
    return true;
  }

  /** The crimson edge's opacity now: 0 unless low. */
  edge(now: number): number {
    if (!this.low) return 0;
    const t = (now - this.beatAt) / EDGE_FALL_MS;
    return EDGE_BASE + (EDGE_BEAT - EDGE_BASE) * Math.max(0, 1 - t);
  }
}
