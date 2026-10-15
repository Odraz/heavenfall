/** Seed-selected, immutable breakable bodies shared by host and clients (rogue rooms.md §8). */
import type { Floor } from '../gen';
import type { PropFamily } from './rooms/types';

export const PROP_RADIUS = 0.5;
export const PROP_HEIGHT: Record<PropFamily, number> = { loot: 1.5, blast: 1.1, blessing: 1 };
export const PROP_BLAST_PLAYER_DAMAGE = 40;
/**
 * An unmarked loot prop's single roll, as cumulative upper bounds for nothing, a coin and a heal mote;
 * the rest is an item. Audit batch 4 doubled the combat item share and added items elsewhere.
 */
export const LOOT_ROLL = {
  combat: { nothing: 0.7, coin: 0.8, mote: 0.9 },
  other: { nothing: 0.8, coin: 0.9, mote: 0.95 },
} as const;
/** Host ticks; active props recharge after fifteen seconds, including the lamp's tell. */
export const PROP_RECHARGE_TICKS = 450;
export const PROP_SPRITES = ['amphora-tall', 'amphora-squat', 'amphora-lily', 'amphora-marked', 'sanctuary-lamp', 'blessing-chalice'] as const;
export interface PropDef {
  id: number;
  room: number;
  family: PropFamily;
  x: number;
  y: number;
  variant: number;
  marked: boolean;
}

/** Identity uses the original socket index, including unfilled sockets; never compact it. */
export function propDefs(floor: Pick<Floor, 'props'> | null): PropDef[] {
  return (floor?.props ?? []).map((p) => ({ id: (p.room + 1) * 65536 + p.index, room: p.room,
    family: p.family, x: p.at[0] + 0.5, y: p.at[1] + 0.5, variant: p.variant, marked: p.marked }));
}
