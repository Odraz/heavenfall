/**
 * Click latching (netcode stage, 2026-10-22): a mouse press counts as held until the attack it asks
 * for fires or FIRE_LATCH_TICKS pass, so a quick click always fires once even when its press and
 * release reach the host in the same tick, or the host's fire timer is a moment behind the shooter's.
 * The host and the shooter's cosmetic timer run the same rule. Pure.
 */
import { ATTACK_PRIMARY, ATTACK_SECONDARY, FIRE_LEFT, FIRE_RIGHT, type AttackSlot } from '../data/weapons';

/** A press waits this long for its shot: 0.3 s at 30 Hz. */
export const FIRE_LATCH_TICKS = 9;

/** The latch of the two mouse buttons: the tick each press expires at, or -1. */
export type FireLatch = [number, number];

export function newFireLatch(): FireLatch {
  return [-1, -1];
}

/** A press of the left (0) or right (1) button at `tick`. */
export function latchPress(latch: FireLatch, button: 0 | 1, tick: number): void {
  latch[button] = tick + FIRE_LATCH_TICKS;
}

/** The latched buttons at `tick`, as FIRE_LEFT / FIRE_RIGHT bits. */
export function latchBits(latch: FireLatch, tick: number): number {
  return (latch[0] >= tick ? FIRE_LEFT : 0) | (latch[1] >= tick ? FIRE_RIGHT : 0);
}

/** An attack fired: the press of its button is spent. */
export function latchFired(latch: FireLatch, slot: AttackSlot): void {
  if (slot === ATTACK_PRIMARY) latch[0] = -1;
  else if (slot === ATTACK_SECONDARY) latch[1] = -1;
}

export function latchClear(latch: FireLatch): void {
  latch[0] = latch[1] = -1;
}

/** How many presses a wrapping u8 counter moved by: 0 for none or a value that went backwards. */
export function pressDelta(counter: number, previous: number): number {
  const d = (counter - previous) & 0xff;
  return d <= 127 ? d : 0;
}
