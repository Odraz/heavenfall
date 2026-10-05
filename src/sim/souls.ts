/**
 * Souls and reviving (M8 §4): a dead player's soul floats over the spot they fell, and teammates
 * revive them by shooting it. Shared by the host simulation and the clients.
 */

/** The soul rises until its base is this high above its ground point. */
export const SOUL_RISE = 1.0;
/** Seconds the rise takes, easing out. */
export const SOUL_RISE_TIME = 1.5;
/** The soul's hit cylinder. */
export const SOUL_RADIUS = 0.5;
export const SOUL_HEIGHT = 1.8;
/** Progress lost per second, every tick, down to 0. */
export const REVIVE_DECAY = 0.1;
/** Each hit adds the shooter's time between shots ÷ this; the Heretic Saint adds double. */
export const REVIVE_HIT_DIVISOR = 3;
export const REVIVE_HERETIC_FACTOR = 2;
/** Unholy Communion adds this to every soul within its radius. */
export const REVIVE_COMMUNION = 0.25;
/** A censer explosion within this distance of a soul counts one hit on it. */
export const REVIVE_CENSER_RADIUS = 2.5;
/** A revived player rises with this fraction of max HP and is invulnerable this long. */
export const REVIVE_HP = 0.5;
export const REVIVE_INVULNERABLE = 2;
/** Clients bob a floating soul by ± this much over this period (cosmetic). */
export const SOUL_BOB = 0.1;
export const SOUL_BOB_PERIOD = 2;

/** How far the soul's base has risen above its ground point `t` seconds after death. */
export function soulRise(t: number): number {
  if (t <= 0) return 0;
  if (t >= SOUL_RISE_TIME) return SOUL_RISE;
  const f = t / SOUL_RISE_TIME;
  // Ease out: fast at first, settling at the top.
  return SOUL_RISE * (1 - (1 - f) * (1 - f));
}

/** Revive progress one hit adds, for a weapon firing every `interval` seconds. */
export function reviveHit(interval: number, heretic: boolean): number {
  return (interval / REVIVE_HIT_DIVISOR) * (heretic ? REVIVE_HERETIC_FACTOR : 1);
}
