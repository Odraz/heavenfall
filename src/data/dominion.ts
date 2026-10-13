/** Dominion authority/readability constants (rogue rooms.md §6). */
export const DOMINION_REACH = 5;
export const DOMINION_RADIUS = 6;
export const DOMINION_PLAYER_DAMAGE = 80;
export const DOMINION_MELEE_RANGE = 2;
export const DOMINION_MELEE_DAMAGE = 12;
export const DOMINION_LAUNCH_SPEED = 12;
export const DOMINION_LAUNCH_VZ = 9;
export const DOMINION_LAUNCH_SECONDS = 0.5;
export const DOMINION_HEIGHT_TOLERANCE = 1.5;
export const DOMINION_TELL_TICKS = 45;
export const DOMINION_RECOVERY_TICKS = 30;
export const DOMINION_COOLDOWN_TICKS = 90;
export const DOMINION_ALIVE_CAP = 2;
export const DOMINION_CAST_CAP = 3;
export const DOMINION_LEAP_COOLDOWN_TICKS = 240;
export const DOMINION_LEAP_CHARGE_TICKS = 15;
export const DOMINION_LEAP_MIN_RANGE = 16;
export const DOMINION_LEAP_MAX_RANGE = 48;
export interface DominionLeap { fromX: number; fromY: number; fromZ: number; x: number; y: number; z: number; }
export interface DominionCast {
  slot: number; incarnation: number; castId: number;
  startTick: number; impactTick: number; room: number;
  leap?: DominionLeap;
}
export function copyDominionCast(c: DominionCast): DominionCast { return { ...c, ...(c.leap ? { leap: { ...c.leap } } : {}) }; }
export function dominionLeapPosition(l: DominionLeap, progress: number): [number, number, number] {
  const f = Math.max(0, Math.min(1, progress));
  // Rise straight up, cross overhead, then drop vertically onto the locked marker.
  const t = Math.max(0, Math.min(1, (f - 0.2) / 0.6));
  const horizontal = t * t * (3 - 2 * t);
  return [l.fromX + (l.x - l.fromX) * horizontal, l.fromY + (l.y - l.fromY) * horizontal,
    l.fromZ + (l.z - l.fromZ) * horizontal + 8 * Math.sin(Math.PI * f)];
}
export type DominionPhase = 'start' | 'strike' | 'cancel';
