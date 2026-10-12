/** Seed-selected, immutable breakable bodies shared by host and clients (rogue rooms.md §8). */
import type { Floor } from '../gen';
import type { PropFamily } from './rooms/types';

export const PROP_RADIUS = 0.5;
export const PROP_HEIGHT: Record<PropFamily, number> = { loot: 1, blast: 1.3, blessing: 1.2 };
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
