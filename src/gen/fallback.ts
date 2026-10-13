/**
 * The fallback floor (rooms.md §5, rogue game.md Appendix A.1), using the real R2 templates; the
 * immutable historical R1 pool keeps its substitutions. Fixed: 11 rooms, first valid orientation, every
 * prop socket with a chance of at least 0.75; no RNG draw.
 */
import type { RoomKind, RoomShape } from '../data/dungeons/types';
import type { RoomTemplate } from '../data/rooms/types';
import { allowedOrientations, bossOrientation, type Assignment } from './assign';
import { connect, footprint, type Layout, type LayoutRoom } from './layout';

/** Room, kind, shape, anchor, parent (−1 for the Breach), the child's and parent's door slots, template. */
const ROOMS: Array<[RoomKind, RoomShape, [number, number], number, [number, number], [number, number], string]> = [
  ['breach', '1x1', [3, 3], -1, [0, 0], [0, 0], 'pg-s-breach-01'],
  ['combat', '1x1', [4, 3], 0, [4, 3], [3, 3], 'pg-c-1x1-flyers-01'],
  // Spec pg-c-2x1-horde-hazard-01 (outside the R1 pool).
  ['combat', '1x2', [3, 4], 0, [3, 4], [3, 3], 'pg-c-2x1-horde-01'],
  ['combat', '2x2', [5, 2], 1, [5, 3], [4, 3], 'pg-c-2x2-horde-flyers-01'],
  ['combat', '1x1', [2, 4], 2, [2, 4], [3, 4], 'pg-c-1x1-ranged-01'],
  ['pardoner', '1x1', [3, 6], 2, [3, 6], [3, 5], 'pg-s-pardoner-01'],
  // Spec pg-c-1x1-elite-01.
  ['combat', '1x1', [5, 1], 3, [5, 1], [5, 2], 'pg-c-1x1-flyers-02'],
  // Spec pg-c-1x1-hazard-02.
  ['combat', '1x1', [5, 4], 3, [5, 4], [5, 3], 'pg-c-1x1-ranged-02'],
  // Spec pg-c-1x1-ranged-hazard-01.
  ['combat', '1x1', [1, 4], 4, [1, 4], [2, 4], 'pg-c-1x1-ranged-03'],
  ['confessional', '1x1', [4, 1], 6, [4, 1], [5, 1], 'pg-s-confessional-01'],
  ['boss', '2x2', [2, 0], 9, [3, 1], [4, 1], 'pg-b-gate-01'],
];
/** The fallback's always-filled prop sockets: chance at least this. */
const FILL_CHANCE = 0.75;

export function fallbackLayout(pool: readonly RoomTemplate[], heaven: number): { layout: Layout; assignment: Assignment } {
  const full = pool.some((t) => t.focus === 'elite' || t.focus === 'hazard' || t.secondary === 'elite' || t.secondary === 'hazard');
  const restored: Record<string, string> = {
    'pg-c-2x1-horde-01': 'pg-c-2x1-horde-hazard-01',
    'pg-c-1x1-flyers-02': 'pg-c-1x1-elite-01',
    'pg-c-1x1-ranged-02': 'pg-c-1x1-hazard-02',
    'pg-c-1x1-ranged-03': 'pg-c-1x1-ranged-hazard-01',
  };
  const rooms: LayoutRoom[] = [];
  for (const [kind, shape, [ax, ay], parent, n, c] of ROOMS) {
    const i = rooms.length;
    rooms.push({ kind, shape, slots: footprint(shape, ax, ay), parent, dist: parent < 0 ? 0 : rooms[parent].dist + 1, doors: [] });
    if (parent >= 0) connect(rooms, i, n, parent, c);
  }
  for (const r of rooms) {
    if (r.kind === 'combat') {
      const d = Math.min(3, r.dist);
      r.band = (r.shape === '2x2' ? Math.max(2, d) : d) as 1 | 2 | 3;
    }
  }
  const layout: Layout = { n: rooms.length, rooms, confessional: 9, boss: 10, reliquary: 8, pardoner: 5, keyRoom: 4, mapRoom: 7, bells: [2, 6] };
  const templates = ROOMS.map(([, , , , , , legacyId]) => {
    const id = full ? restored[legacyId] ?? legacyId : legacyId;
    const t = pool.find((p) => p.id === id && p.heaven === heaven);
    if (!t) throw new Error(`the fallback floor's template '${id}' isn't in the pool`);
    return t;
  });
  const orientations = rooms.map((r, i) => (r.kind === 'boss' ? bossOrientation(templates[i], r.doors[0].socket) : allowedOrientations(templates[i], r.shape)[0] ?? -1));
  orientations.forEach((o, i) => {
    if (o < 0) throw new Error(`the fallback floor's ${templates[i].id} has no valid orientation`);
  });
  const props: Assignment['props'] = [];
  rooms.forEach((_, i) => {
    const t = templates[i];
    const firstLoot = i === layout.mapRoom ? t.props.findIndex((p) => p.family === 'loot') : -1;
    t.props.forEach((p, index) => props.push({ room: i, index, filled: index === firstLoot || p.chance >= FILL_CHANCE, marked: index === firstLoot }));
  });
  return { layout, assignment: { templates, orientations, props } };
}
