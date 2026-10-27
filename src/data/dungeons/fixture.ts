/**
 * The fixed dungeons (the development fixtures, rogue r01.md) keep their arena source; this turns
 * each arena into a room record, so every caller sees rooms only.
 */
import type { DungeonDef, FixtureDef, Quad, RoomDef } from './types';

/**
 * Arena `i` becomes room `i`: `boss` or `combat`; its entry cells are socket 0's; its entry door's
 * leaf opens toward room `i − 1` (outside every room for arena 0) and its exit door's toward `i + 1`,
 * which reproduces the fixed dungeon's doors under the leaf rule. The gate faces west.
 */
export function adaptFixture(def: FixtureDef): DungeonDef {
  const rooms: RoomDef[] = def.arenas.map((a, i) => {
    const leaves: RoomDef['leaves'] = [];
    if (a.doors.length > 0) leaves.push({ socket: 0, to: i - 1, cells: a.doors.map(([c, r]) => [c, r]) });
    if ((a.exitDoors ?? []).length > 0) leaves.push({ socket: 1, to: i + 1, cells: a.exitDoors!.map(([c, r]) => [c, r]) });
    return {
      id: a.id,
      name: a.name,
      kind: a.boss ? 'boss' : 'combat',
      rect: { ...a.rect },
      leaves,
      entry: [{ socket: 0, cells: a.entryCells.map(([c, r]) => [c, r]) as Quad }],
      waves: a.waves,
      boss: a.boss,
    };
  });
  const out: DungeonDef = { id: def.id, name: def.name, heights: def.heights, markers: def.markers, rooms };
  if (def.decor) out.decor = def.decor;
  if (def.gate) out.gate = { facing: 'W', plane: def.gate.x, u0: def.gate.y0, u1: def.gate.y1, uCenter: def.gate.yCenter };
  return out;
}
