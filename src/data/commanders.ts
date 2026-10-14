import { ENEMY_SLOTS } from '../sim/constants';
import type { DominionCast } from './dominion';

/** Host-owned family commander state. Idle records also carry the shield's accepted facing. */
export interface CommanderCast extends Pick<DominionCast, 'slot' | 'incarnation' | 'castId' | 'room' | 'startTick'> {
  kind: 'beam' | 'carry';
  phase: 'idle' | 'tell' | 'active' | 'carry' | 'recover';
  targetId: number;
  phaseTick: number;
  endTick: number;
  yaw: number;
  pitch: number;
  x: number; y: number; z: number;
  targetX: number; targetY: number; targetZ: number;
  dropX: number; dropY: number;
}
export const COMMANDER_RECORD_CAP = 3;
/** Local host diagnostics only: never part of the gameplay snapshot or remote protocol. */
export interface CarrierCheck {
  slot: number;
  phase: CommanderCast['phase'];
  tick: number;
  targetId: number;
  distance: number;
  nearbyBlessed: number;
  crowdCount: number;
  reason: string;
  readyTick: number;
}
export const CANTOR_TELL = 75, CANTOR_BEAM = 90, CANTOR_RECOVERY = 60, CANTOR_COOLDOWN = 180;
/** Radians per second. Tracking must leave room to strafe out of an active beam. */
export const CANTOR_AIM_SPEED = Math.PI / 6, CANTOR_BEAM_TURN_SPEED = Math.PI / 18;
export const CARRIER_SWOOP = 30, CARRIER_RECOVERY = 45, CARRIER_COOLDOWN = 240;
export const CARRIER_GRAB_RADIUS = 2.25, CARRIER_FLY_THROUGH = 12, CARRIER_MIN_HOLD = 90;
export const CARRIER_MIN_FLIGHT = 24, CARRIER_TRACK_TICKS = 6, CARRIER_FLIGHT_HEIGHT = 6;
export const CARRIER_DAMAGE = 10, CARRIER_DAMAGE_INTERVAL = 15;
export const COMMANDER_PHASES = ['idle', 'tell', 'active', 'carry', 'recover'] as const;
export function turnToward(yaw: number, target: number, limit: number): number {
  const delta = Math.atan2(Math.sin(target - yaw), Math.cos(target - yaw));
  const result = yaw + Math.max(-limit, Math.min(limit, delta));
  return Math.atan2(Math.sin(result), Math.cos(result));
}
export function hymnalReduction(yaw: number, dx: number, dy: number, area: boolean): number {
  const distance = Math.hypot(dx, dy);
  return distance < 1e-9 || area && distance <= 1 ? 1 : (dx * Math.cos(yaw) + dy * Math.sin(yaw)) / distance >= 0.5 - 1e-9 ? 0.2 : 1;
}
export function validCommanderCasts(casts: readonly CommanderCast[], tick: number): boolean {
  if (!Array.isArray(casts) || casts.length > COMMANDER_RECORD_CAP || !Number.isInteger(tick) || tick < 0 || tick > 0xffffffff) return false;
  const slots = new Set<number>(), families = new Set<string>();
  return casts.every((c) => {
    if (!c || !['beam', 'carry'].includes(c.kind) || !COMMANDER_PHASES.includes(c.phase) || c.kind === 'beam' && c.phase === 'carry') return false;
    const key = `${c.room}:${c.kind}`;
    if (slots.has(c.slot) || families.has(key)) return false;
    slots.add(c.slot); families.add(key);
    return Number.isInteger(c.slot) && c.slot >= 0 && c.slot < ENEMY_SLOTS && Number.isInteger(c.room) && c.room >= 0 && c.room < 32 &&
      [c.incarnation, c.castId].every((n) => Number.isInteger(n) && n > 0 && n <= 0xffffffff) &&
      [c.startTick, c.phaseTick, c.endTick].every((n) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff) &&
      c.startTick <= c.phaseTick && c.phaseTick <= tick && c.endTick >= c.phaseTick &&
      (c.phase === 'idle' || c.phase === 'recover' || c.endTick > tick) &&
      Number.isInteger(c.targetId) && c.targetId >= -1 && c.targetId < 4 &&
      [c.x, c.y, c.targetX, c.targetY, c.dropX, c.dropY].every((n) => Number.isFinite(n) && n >= 0 && n <= 2048) &&
      [c.z, c.targetZ].every((n) => Number.isFinite(n) && n >= -64 && n <= 256) &&
      Number.isFinite(c.yaw) && Math.abs(c.yaw) <= Math.PI + 1e-6 && Number.isFinite(c.pitch) && Math.abs(c.pitch) <= Math.PI / 2;
  });
}
