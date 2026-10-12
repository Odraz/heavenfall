/** `generateFloor` (rogue game.md §3.2–§3.3): attempts 0–199, then the fallback floor. Pure. */
import type { Cell, DungeonDef } from '../data/dungeons/types';
import type { PropFamily, RoomTemplate } from '../data/rooms/types';
import type { GameMap } from '../sim/map';
import { assignFloor, type Assignment } from './assign';
import { fallbackLayout } from './fallback';
import { attemptSeed, fmix32, makeRng } from './hash';
import { layoutFloor, type Layout, type LayoutRoom } from './layout';
import { stampFloor, type StampedFloor } from './stamp';

export const MAX_ATTEMPTS = 200;

/** The generated floor's record (rogue r01.md): rooms in placement order, the Breach 0 and the boss last. */
export interface Floor {
  heaven: number;
  floor: number;
  seed: number;
  /** Attempts used: the accepted attempt's index + 1, or 200 with the fallback. */
  attempts: number;
  fallbackUsed: boolean;
  n: number;
  /** The crop's top-left slot. */
  slotOrigin: [number, number];
  rooms: Array<LayoutRoom & { templateId: string; orientation: number }>;
  /** Filled prop sockets (inactive until R2), in room then template order. */
  props: Array<{ room: number; index: number; family: PropFamily; at: Cell; marked: boolean; variant: number }>;
  confessional: number;
  boss: number;
  reliquary: number;
  pardoner: number;
  keyRoom: number;
  mapRoom: number;
  bells: [number, number];
}

export interface GeneratedFloor {
  def: DungeonDef;
  floor: Floor;
  /** The map step 14 validated, for the caller to reuse (rogue game.md §14.1). */
  map: GameMap;
  /** Why each rejected attempt failed, in order (diagnostics). */
  rejects: string[];
}

/** N = 9 + heaven + r, with r = fmix32(seed ^ 0x52) & 1 drawn once per seed (rogue game.md §3.1). */
export function roomCount(seed: number, heaven: number): number {
  return 9 + heaven + (fmix32((seed ^ 0x52) >>> 0) & 1);
}

export function floorRecord(heaven: number, floor: number, seed: number, attempts: number, fallbackUsed: boolean, layout: Layout, a: Assignment, s: StampedFloor): Floor {
  return {
    heaven,
    floor,
    seed,
    attempts,
    fallbackUsed,
    n: layout.n,
    slotOrigin: s.slotOrigin,
    rooms: layout.rooms.map((r, i) => ({ ...r, templateId: a.templates[i].id, orientation: a.orientations[i] })),
    props: a.props
      .filter((p) => p.filled)
      .map((p) => {
        const ot = s.oriented[p.room];
        const room = s.def.rooms[p.room];
        const q = ot.props[p.index];
        const variant = ot.template.props.slice(0, p.index).filter((s) => s.family === 'loot').length % 3;
        return { room: p.room, index: p.index, family: q.family, at: [q.at[0] + room.rect.x0, q.at[1] + room.rect.y0] as Cell, marked: p.marked, variant };
      }),
    confessional: layout.confessional,
    boss: layout.boss,
    reliquary: layout.reliquary,
    pardoner: layout.pardoner,
    keyRoom: layout.keyRoom,
    mapRoom: layout.mapRoom,
    bells: layout.bells,
  };
}

export function generateFloor(seed: number, heaven: number, floor: number, pool: readonly RoomTemplate[]): GeneratedFloor {
  const n = roomCount(seed, heaven);
  const rejects: string[] = [];
  for (let a = 0; a < MAX_ATTEMPTS; a++) {
    const rng = makeRng(attemptSeed(seed >>> 0, heaven, floor, a));
    const lr = layoutFloor(rng, n);
    if (!lr.ok) {
      rejects.push(lr.reason);
      continue;
    }
    const ar = assignFloor(rng, lr.layout, pool, heaven);
    if (!ar.ok) {
      rejects.push(ar.reason);
      continue;
    }
    let s: StampedFloor;
    try {
      s = stampFloor(lr.layout, ar.assignment, 'floor', `rogue-${heaven}-${floor}-${seed >>> 0}`);
    } catch (e) {
      rejects.push(`stamp: ${e instanceof Error ? e.message : String(e)}`);
      continue;
    }
    if (s.errors.length > 0) {
      rejects.push(`validate: ${s.errors[0]}`);
      continue;
    }
    return { def: s.def, floor: floorRecord(heaven, floor, seed >>> 0, a + 1, false, lr.layout, ar.assignment, s), map: s.map, rejects };
  }
  const fb = fallbackLayout(pool, heaven);
  const s = stampFloor(fb.layout, fb.assignment, 'floor', `rogue-${heaven}-${floor}-${seed >>> 0}`);
  if (s.errors.length > 0) throw new Error(`the fallback floor doesn't validate: ${s.errors[0]}`);
  return { def: s.def, floor: floorRecord(heaven, floor, seed >>> 0, MAX_ATTEMPTS, true, fb.layout, fb.assignment, s), map: s.map, rejects };
}
