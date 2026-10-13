import { dominionLeapPosition, type DominionLeap } from '../data/dominion';
import type { GameMap } from './map';
import { circleOverlapsCell } from './movement';

/** Bounded footprint checks: a leap never crosses a wall/closed leaf or leaves its room. */
export function dominionLeapClear(map: GameMap, room: number, leap: DominionLeap, from = 0, to = 1): boolean {
  // Wings and shoulders need more clearance than the narrow walking collision body.
  const radius = 1;
  const steps = Math.max(1, Math.ceil(Math.hypot(leap.x - leap.fromX, leap.y - leap.fromY) * (to - from) * 2.5 / 0.2));
  for (let n = 0; n <= steps; n++) {
    const [x, y, z] = dominionLeapPosition(leap, from + (to - from) * n / steps);
    for (let r = Math.floor(y - radius); r <= Math.floor(y + radius); r++) for (let c = Math.floor(x - radius); c <= Math.floor(x + radius); c++) {
      if (!circleOverlapsCell(x, y, radius, c, r)) continue;
      const i = r * map.w + c;
      if (c < 0 || r < 0 || c >= map.w || r >= map.h || map.solid[i] || map.roomOf[i] !== room || map.floor[i] > z + 0.001 || n === steps && to === 1 && (map.hazard[i] || !Number.isFinite(map.floor[i]))) return false;
    }
  }
  return true;
}
