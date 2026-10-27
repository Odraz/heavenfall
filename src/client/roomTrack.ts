import type { TrackId } from '../data/music';
import type { GameMap } from '../sim/map';

/**
 * The music for room `i`: the boss track for the boss, calm outside combat rooms, and for generated
 * combat rooms a track by shape. Small rooms, most of a floor's fights, alternate Arena 3 and Arena 4
 * by room index, so the fights don't all share one track. Fixtures keep their authored arena order.
 */
export function roomTrack(map: GameMap, i: number): TrackId {
  const room = map.rooms[i];
  if (room?.boss) return 'boss';
  if (room?.shape) {
    if (room.kind !== 'combat') return 'calm';
    if (room.shape === '2x2') return 'arena-1';
    if (room.shape === '1x1') return i % 2 ? 'arena-4' : 'arena-3';
    return 'arena-2';
  }
  if (map.id === 'sandbox') return 'arena-1';
  return (['arena-1', 'arena-2', 'arena-3'] as const)[Math.min(i, 2)];
}
