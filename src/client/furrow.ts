/** Ploughshares' furrow on the client (R06 follow-up §7): it burns as class floor fire, cell by cell. */
import type { TalentArea } from '../net/messages';
import type { GameMap } from '../sim/map';

/**
 * The floor cells a Ploughshares furrow burns on (R06 follow-up §7): those whose centers lie within its
 * 1.5 m width of the segment it spans, on walkable floor. Pure, for tests.
 */
export function furrowCells(a: Pick<TalentArea, 'x' | 'y' | 'x1' | 'y1'>, map: Pick<GameMap, 'w' | 'h' | 'floor' | 'solid'>): number[] {
  const out: number[] = [], half = 0.75 + 0.05;
  const dx = a.x1 - a.x, dy = a.y1 - a.y, len2 = Math.max(1e-9, dx * dx + dy * dy);
  for (let r = Math.floor(Math.min(a.y, a.y1) - 1); r <= Math.ceil(Math.max(a.y, a.y1) + 1); r++) {
    for (let c = Math.floor(Math.min(a.x, a.x1) - 1); c <= Math.ceil(Math.max(a.x, a.x1) + 1); c++) {
      if (r < 0 || c < 0 || r >= map.h || c >= map.w) continue;
      const i = r * map.w + c;
      if (map.solid[i] || !Number.isFinite(map.floor[i])) continue;
      const t = Math.max(0, Math.min(1, ((c + 0.5 - a.x) * dx + (r + 0.5 - a.y) * dy) / len2));
      if (Math.hypot(c + 0.5 - a.x - dx * t, r + 0.5 - a.y - dy * t) <= half) out.push(i);
    }
  }
  return out;
}
