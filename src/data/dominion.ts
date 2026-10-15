/** Dominion authority/readability constants (rogue rooms.md §6). */
export const DOMINION_REACH = 5;
export const DOMINION_RADIUS = 6;
/**
 * The slam is strongest at the Dominion's feet and fades linearly to the ring's edge (audit batch 4):
 * standing close costs more, and baiting it into its own horde kills the Blessed near it while the
 * edge only throws them.
 */
export const DOMINION_PLAYER_DAMAGE = { center: 110, edge: 50 } as const;
export const DOMINION_ENEMY_DAMAGE = { center: 40, edge: 10 } as const;
/** Horizontal launch speed in m/s, for players and enemies, over DOMINION_LAUNCH_SECONDS. */
export const DOMINION_LAUNCH_SPEED = { center: 15, edge: 9 } as const;
export const DOMINION_MELEE_RANGE = 2;
export const DOMINION_MELEE_DAMAGE = 12;
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
export const DOMINION_LEAP_LEAD_SECONDS = 1;
export const DOMINION_LEAP_MIN_RANGE = 16;
export const DOMINION_LEAP_MAX_RANGE = 48;
/** A slam value at `distance` metres from the strike center. */
export function dominionFalloff(value: { center: number; edge: number }, distance: number): number {
  return value.edge + (value.center - value.edge) * Math.max(0, Math.min(1, 1 - distance / DOMINION_RADIUS));
}
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
