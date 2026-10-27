/**
 * Template fixtures (rogue game.md §4.7 rule 9): one template in one orientation, its legal entry
 * joined to a Breach (the Breach template alone supplies its own starts), stamped and validated with
 * the template scope.
 */
import type { RoomKind, RoomShape } from '../data/dungeons/types';
import type { RoomTemplate } from '../data/rooms/types';
import { orientTemplate, type Assignment } from './assign';
import { connect, footprint, type Layout, type LayoutRoom } from './layout';
import { stampFloor, type StampedFloor } from './stamp';
import { DIR_DX, DIR_DY, socketList } from './transform';

export function templateFixture(t: RoomTemplate, o: number, placed: RoomShape, breach: RoomTemplate): StampedFloor {
  const room = (kind: RoomKind, shape: RoomShape, ax: number, ay: number, parent: number): LayoutRoom => ({ kind, shape, slots: footprint(shape, ax, ay), parent, dist: parent < 0 ? 0 : 1, doors: [] });
  if (t.kind === 'breach') {
    const layout: Layout = { n: 1, rooms: [room('breach', '1x1', 3, 3, -1)], confessional: -1, boss: -1, reliquary: -1, pardoner: -1, keyRoom: -1, mapRoom: -1, bells: [-1, -1] };
    return stampFloor(layout, { templates: [t], orientations: [o], props: [] }, 'template', `fixture-${t.id}-${o}`);
  }
  // The template room at slot (2, 2); its entry socket (the boss's, else socket 0) opens onto the Breach.
  const ot = orientTemplate(t, o);
  const s = t.kind === 'boss' ? ot.entrySocket! : 0;
  const ref = socketList(placed)[s];
  const [rx, ry] = [2, 2];
  const n: [number, number] = [rx + ref.sx, ry + ref.sy];
  const c: [number, number] = [n[0] + DIR_DX[ref.dir], n[1] + DIR_DY[ref.dir]];
  const rooms: LayoutRoom[] = [room('breach', '1x1', c[0], c[1], -1), room(t.kind, placed, rx, ry, 0)];
  if (t.kind === 'combat') rooms[1].band = 2;
  connect(rooms, 1, n, 0, c);
  const layout: Layout = { n: 2, rooms, confessional: -1, boss: t.kind === 'boss' ? 1 : -1, reliquary: -1, pardoner: -1, keyRoom: -1, mapRoom: -1, bells: [-1, -1] };
  const a: Assignment = { templates: [breach, t], orientations: [0, o], props: [] };
  return stampFloor(layout, a, 'template', `fixture-${t.id}-${o}`);
}
