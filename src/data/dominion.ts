/** Dominion authority/readability constants (rogue rooms.md §6). */
export const DOMINION_REACH = 5;
export const DOMINION_RADIUS = 6;
export const DOMINION_PLAYER_DAMAGE = 80;
export const DOMINION_LAUNCH_SPEED = 12;
export const DOMINION_LAUNCH_VZ = 9;
export const DOMINION_LAUNCH_SECONDS = 0.5;
export const DOMINION_HEIGHT_TOLERANCE = 1.5;
export const DOMINION_TELL_TICKS = 45;
export const DOMINION_RECOVERY_TICKS = 30;
export const DOMINION_COOLDOWN_TICKS = 90;
export const DOMINION_ALIVE_CAP = 2;
export const DOMINION_CAST_CAP = 3;
export interface DominionCast {
  slot: number; incarnation: number; castId: number;
  startTick: number; impactTick: number; room: number;
}
export type DominionPhase = 'start' | 'strike' | 'cancel';
