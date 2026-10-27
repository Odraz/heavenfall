/**
 * Shared pellet spread (netcode stage 3): a client-timed shot's pellets scatter by its shooter and its
 * own shot counter, so the shooter's screen and the host draw the same pellets. Pure.
 */
import { fmix32 } from '../gen/hash';

/**
 * Pellet `pellet`'s offset on `axis` (0 yaw, 1 pitch) for player `playerId`'s shot `shot` (the wrapping
 * counter), in [-1, 1): what `random() * 2 - 1` gives a shot fired by the host's own timer.
 */
export function shotSpread(playerId: number, shot: number, pellet: number, axis: 0 | 1): number {
  const h = fmix32((Math.imul(playerId + 1, 0x9e3779b1) ^ Math.imul((shot & 0xff) + 1, 0x85ebca77) ^ Math.imul(pellet * 2 + axis + 1, 0xc2b2ae3d)) >>> 0);
  return (h / 0x100000000) * 2 - 1;
}
