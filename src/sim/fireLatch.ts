/**
 * Click latching (netcode stage, 2026-10-22): a mouse press counts as held until the attack it asks
 * for fires or FIRE_LATCH_TICKS pass, so a quick click always fires once even when its press and
 * release reach the host in the same tick, or the host's fire timer is a moment behind the shooter's.
 * The host and the shooter's cosmetic timer run the same rule. Pure.
 */
import { ATTACK_PRIMARY, ATTACK_SECONDARY, FIRE_LEFT, FIRE_RIGHT, type AttackSlot } from '../data/weapons';
import type { ViewTick } from './lagComp';

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

/**
 * Client-timed shots (netcode stage 2, 2026-10-22): the shooter's screen counts the shots its cosmetic
 * fire timer fires and sends an input in the same frame, so that input carries the shot's own aim and
 * view. The host fires those shots, each with the aim and view of the input that carried it, no faster
 * than its fire timer allows. Its own timer no longer picks the moment, so the host's shot is the one
 * the shooter saw, not one aimed wherever the newest input happened to point.
 */
export interface ClientShot {
  /** 0 the left button's attack, 1 the right's. */
  button: 0 | 1;
  yaw: number;
  pitch: number;
  view: ViewTick;
  /** The host tick it arrived at. */
  tick: number;
  /** The shooter's own counter for this shot, wrapping at 256: it seeds the shot's spread (netcode stage 3). */
  index: number;
}

/** The input's `shotButton` for a client that sends no shots: the host fires its held buttons itself. */
export const HELD_FIRE = 255;
/** At most this many shots wait for the fire timer; older ones give way. */
export const SHOT_QUEUE = 3;
/** A shot not fired this many ticks after it arrived is dropped: 0.3 s. */
export const SHOT_WAIT_TICKS = 9;
/** A shot may fire this many ticks before the fire timer is ready, so network jitter doesn't hold it back. */
export const SHOT_EARLY_TICKS = 2;

/**
 * Queues `count` shots of the same aim and view (one input can carry several after a slow frame);
 * `last` is the input's shot counter, the index of the newest of them.
 */
export function queueShots(queue: ClientShot[], count: number, shot: Omit<ClientShot, 'index'>, last: number): void {
  for (let k = 0; k < count; k++) {
    queue.push({ ...shot, index: (last - count + 1 + k) & 0xff });
    if (queue.length > SHOT_QUEUE) queue.shift();
  }
}

/**
 * The shot counter up to which every shot the host has seen has been fired or dropped (netcode stage
 * 3): the one before the oldest waiting shot, or the newest seen when none waits.
 */
export function shotsDone(queue: readonly ClientShot[], seen: number): number {
  return queue.length ? (queue[0].index - 1) & 0xff : seen & 0xff;
}

/** The next shot to fire at `tick`, after dropping the ones that waited too long. */
export function nextShot(queue: ClientShot[], tick: number): ClientShot | undefined {
  while (queue.length && tick - queue[0].tick > SHOT_WAIT_TICKS) queue.shift();
  return queue[0];
}
