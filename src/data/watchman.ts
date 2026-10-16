/** The Watchman's shot (rogue rooms.md §6.4): constants and the bounded aim record shared by host, protocol and client. */
import { ENEMY_SLOTS } from '../sim/constants';

/** It aims at the nearest visible player within this many meters of its muzzle. */
export const WATCHMAN_RANGE = 20;
/** The muzzle (the Clarion's bell when levelled) is this high above its feet. */
export const WATCHMAN_MUZZLE_Z = 1.5;
/** Aim 1.0 s, then fire; reload 1.5 s. */
export const WATCHMAN_AIM_TICKS = 30;
export const WATCHMAN_RELOAD_TICKS = 45;
export const WATCHMAN_DAMAGE = 12;
/** The shot's trace reaches this far; past it, the shot falls short. */
export const WATCHMAN_REACH = 30;
/** A fired record stays in snapshots this long, for the flash, tracer and spark. */
export const WATCHMAN_FIRED_TICKS = 15;
/** At most this many records per snapshot (the alive cap is 6). */
export const WATCHMAN_RECORD_CAP = 8;
export const WATCHMAN_PHASES = ['aim', 'fired'] as const;

/**
 * One Watchman's aim, from its start until 0.5 s after it fires. `targetId` is the aimed player's id;
 * `fireTick` the accepted (or planned) fire tick; `shot` a wrapping counter that changes once per shot;
 * `x`/`y`/`z` where the fired shot ended (the target's body center or the blocker), 0 while aiming.
 */
export interface WatchmanAim {
  slot: number;
  incarnation: number;
  targetId: number;
  phase: typeof WATCHMAN_PHASES[number];
  fireTick: number;
  shot: number;
  x: number;
  y: number;
  z: number;
}

/** Records attach to distinct live slots; an aim ends at its fire tick, a fired record within 0.5 s of it. */
export function validWatchmanAims(aims: readonly WatchmanAim[], tick: number): boolean {
  if (!Array.isArray(aims) || aims.length > WATCHMAN_RECORD_CAP || !Number.isInteger(tick) || tick < 0 || tick > 0xffffffff) return false;
  const slots = new Set<number>();
  return aims.every((a) => {
    if (!a || typeof a !== 'object' || !WATCHMAN_PHASES.includes(a.phase) || slots.has(a.slot)) return false;
    slots.add(a.slot);
    return Number.isInteger(a.slot) && a.slot >= 0 && a.slot < ENEMY_SLOTS && Number.isInteger(a.incarnation) && a.incarnation > 0 && a.incarnation <= 0xffffffff &&
      Number.isInteger(a.targetId) && a.targetId >= 0 && a.targetId < 4 && Number.isInteger(a.shot) && a.shot >= 0 && a.shot <= 255 &&
      Number.isInteger(a.fireTick) && a.fireTick >= 0 && a.fireTick <= 0xffffffff &&
      (a.phase === 'aim' ? a.fireTick > tick && a.fireTick - tick <= WATCHMAN_AIM_TICKS : a.fireTick <= tick && tick - a.fireTick < WATCHMAN_FIRED_TICKS) &&
      [a.x, a.y].every((n) => Number.isFinite(n) && n >= 0 && n <= 1023) && Number.isFinite(a.z) && a.z >= 0 && a.z <= 1023;
  });
}
