/**
 * Stamping (rogue game.md §3.3 step 14, §3.4, §3.5, §14.2): the oriented templates and the vestibules
 * into one cropped grid, the room records, the view mask and the gate, then `loadMap` and
 * `validateLevel(…, 'floor')`. Pure.
 */
import type { Cell, DungeonDef, GateDef, Quad, RoomDef, WaveDef } from '../data/dungeons/types';
import { validateLevel, type ValidateMode } from '../data/dungeons/validate';
import type { RoomTemplate, TemplateWave } from '../data/rooms/types';
import { loadMap, type GameMap } from '../sim/map';
import { orientTemplate, type Assignment, type OrientedTemplate } from './assign';
import { GRID, outerFace, type Layout } from './layout';
import { BAND, BASE_INDEX, DIR_DX, DIR_DY, entryCellsOf, SLOT, SOCKET_OFFSET, socketList, type Dir } from './transform';

/** The decor keys of the block notation (rooms.md §2.1). */
export const ROOM_DECOR = { c: 'candelabrum', u: 'lily-urn', h: 'harp', t: 'cloud-tuft', a: 'angel-statue', f: 'fountain' } as const;

/** Room budgets (TP at 4 players, rogue game.md §4.4): base by shape, factor by band. */
const BASE_TP: Record<string, number> = { '1x1': 400, '2x1': 700, '1x2': 700, '2x2': 2000 };
const BAND_FACTOR = [0, 0.85, 1.0, 1.15];
const TP = { blessed: 1, chorister: 6, cherub: 4 } as const;
const ELITE_TP = 60;

/** A wave's counts at 4 players (rogue game.md §4.6): `round(rest × mix ÷ TP)`, at least 1 where the mix is nonzero. */
export function waveCounts(w: TemplateWave, budget: number): WaveDef {
  const rest = w.share * budget - (w.elites ?? 0) * ELITE_TP;
  const n = (id: keyof typeof TP) => {
    const m = w.mix[id] ?? 0;
    return m > 0 ? Math.max(1, Math.round((rest * m) / TP[id])) : 0;
  };
  return { blessed: n('blessed'), choristers: n('chorister'), cherubs: n('cherub'), ...(w.elites ? { dominions: w.elites } : {}) };
}

export function roomBudget(shape: string, band: number): number {
  return BASE_TP[shape] * BAND_FACTOR[band];
}

export interface StampedFloor {
  def: DungeonDef;
  map: GameMap;
  /** The crop's top-left slot. */
  slotOrigin: [number, number];
  oriented: OrientedTemplate[];
  errors: string[];
}

/** Stamps a layout with its assignment; `errors` is empty when the floor validates. */
export function stampFloor(layout: Layout, a: Assignment, mode: ValidateMode = 'floor', id = 'rogue'): StampedFloor {
  const rooms = layout.rooms;
  let sxMin = GRID;
  let syMin = GRID;
  let sxMax = -1;
  let syMax = -1;
  for (const r of rooms) {
    for (const [x, y] of r.slots) {
      sxMin = Math.min(sxMin, x);
      syMin = Math.min(syMin, y);
      sxMax = Math.max(sxMax, x);
      syMax = Math.max(syMax, y);
    }
  }
  const W = SLOT * (sxMax - sxMin + 1) + BAND;
  const H = SLOT * (syMax - syMin + 1) + BAND;
  const hg = Array.from({ length: H }, () => new Array<string>(W).fill('#'));
  const mk = Array.from({ length: H }, () => new Array<string>(W).fill('.'));
  const vm = Array.from({ length: H }, () => new Array<string>(W).fill('0'));
  /** A slot's interior origin in map cells. */
  const slotX = (sx: number) => SLOT * (sx - sxMin) + BAND;
  const slotY = (sy: number) => SLOT * (sy - syMin) + BAND;

  const oriented = rooms.map((_, i) => orientTemplate(a.templates[i], a.orientations[i]));
  const origins: Cell[] = rooms.map((r) => [slotX(r.slots[0][0]), slotY(r.slots[0][1])]);
  oriented.forEach((ot, i) => {
    const [ox, oy] = origins[i];
    for (let y = 0; y < ot.h; y++) {
      for (let x = 0; x < ot.w; x++) {
        hg[oy + y][ox + x] = ot.heights[y][x];
        mk[oy + y][ox + x] = ot.markers[y][x];
      }
    }
  });

  // Vestibules (rogue game.md §3.4): near leaf, two floor cells, far leaf, across each door's band.
  const leaves: Array<RoomDef['leaves']> = rooms.map(() => []);
  rooms.forEach((r, i) => {
    for (const door of r.doors) {
      if (door.to < i) continue;
      const far = rooms[door.to];
      const ref = socketList(r.shape)[door.socket];
      const [sx, sy] = [r.slots[0][0] + ref.sx, r.slots[0][1] + ref.sy];
      const d = ref.dir;
      // The band's first cell beside this room's interior, stepping outward.
      const across: Array<Cell[]> = [[], [], [], []];
      for (let k = 0; k < 4; k++) {
        for (let j = 0; j < 4; j++) {
          let x: number;
          let y: number;
          if (d === 0 || d === 2) {
            x = slotX(sx) + SOCKET_OFFSET + j;
            y = d === 0 ? slotY(sy) - 1 - k : slotY(sy) + SLOT - BAND + k;
          } else {
            y = slotY(sy) + SOCKET_OFFSET + j;
            x = d === 3 ? slotX(sx) - 1 - k : slotX(sx) + SLOT - BAND + k;
          }
          across[k].push([x, y]);
        }
      }
      for (const [x, y] of [...across[0], ...across[1], ...across[2], ...across[3]]) hg[y][x] = String(BASE_INDEX);
      for (const [x, y] of [...across[0], ...across[3]]) mk[y][x] = 'D';
      const farSocket = far.doors.find((q) => q.to === i)!.socket;
      leaves[i].push({ socket: door.socket, to: door.to, cells: across[0] });
      leaves[door.to].push({ socket: farSocket, to: i, cells: across[3] });
    }
  });
  for (const l of leaves) l.sort((p, q) => p.socket - q.socket);

  // The view mask (rogue game.md §3.5): the band cells beside an outer face.
  const occupied = (x: number, y: number) => rooms.some((r) => r.slots.some(([a2, b2]) => a2 === x && b2 === y));
  const inRoom = (r: Layout['rooms'][number], x: number, y: number) => r.slots.some(([a2, b2]) => a2 === x && b2 === y);
  for (const r of rooms) {
    for (const [sx, sy] of r.slots) {
      for (let dd = 0; dd < 4; dd++) {
        const d = dd as Dir;
        if (inRoom(r, sx + DIR_DX[d], sy + DIR_DY[d]) || !outerFace(occupied, sx, sy, d)) continue;
        // The face's span, and the room's inner band beside it when the next slot's face is outer too.
        const spans: Array<[number, number]> = [[0, SLOT - BAND - 1]];
        const side: [number, number] = d === 0 || d === 2 ? [1, 0] : [0, 1];
        const nx = sx + side[0];
        const ny = sy + side[1];
        if (inRoom(r, nx, ny) && !inRoom(r, nx + DIR_DX[d], ny + DIR_DY[d]) && outerFace(occupied, nx, ny, d)) spans.push([SLOT - BAND, SLOT - 1]);
        for (const [u0, u1] of spans) {
          for (let u = u0; u <= u1; u++) {
            for (let k = 0; k < BAND; k++) {
              const x = d === 0 || d === 2 ? slotX(sx) + u : d === 3 ? slotX(sx) - 1 - k : slotX(sx) + SLOT - BAND + k;
              const y = d === 1 || d === 3 ? slotY(sy) + u : d === 0 ? slotY(sy) - 1 - k : slotY(sy) + SLOT - BAND + k;
              vm[y][x] = '1';
            }
          }
        }
      }
    }
  }

  // Room records.
  const markers = mk.map((row) => row.join(''));
  let gate: GateDef | undefined;
  const defs: RoomDef[] = rooms.map((r, i) => {
    const ot = oriented[i];
    const t: RoomTemplate = ot.template;
    const [ox, oy] = origins[i];
    const w = (c: Cell): Cell => [c[0] + ox, c[1] + oy];
    const rect = { x0: ox, y0: oy, x1: ox + ot.w - 1, y1: oy + ot.h - 1 };
    const def: RoomDef = {
      id: `${i}-${t.id}`,
      name: t.name,
      kind: r.kind,
      rect,
      leaves: leaves[i],
      entry: r.doors.map((d) => ({ socket: d.socket, cells: entryCellsOf(r.shape, d.socket).map(w) as Quad })),
      // Keep authored minions; ramp commanders 0, 1, 2, ... before ordinary party scaling.
      waves: r.kind === 'combat' ? t.waves.map((wv, index) => {
        const counts = waveCounts(wv, roomBudget(r.shape, r.band!));
        const rest = wv.share * roomBudget(r.shape, r.band!) - (wv.elites ?? 0) * ELITE_TP;
        const xp: WaveDef['xp'] = [rest * (wv.mix.blessed ?? 0), rest * (wv.mix.chorister ?? 0), rest * (wv.mix.cherub ?? 0), index * ELITE_TP];
        return { ...counts, xp, dominions: index, ...(wv.mix.chorister ? { commander: 'cantor' as const } : wv.mix.cherub ? { commander: 'carrier' as const } : {}) };
      }) : [],
      boss: r.kind === 'boss',
      shape: r.shape,
      templateId: t.id,
      orientation: ot.o,
      points: { reward: w(ot.rewardSpot) },
    };
    if (r.band) def.band = r.band;
    if (t.focus) def.focus = t.focus;
    if (t.secondary) def.secondary = t.secondary;
    if (ot.hazards.length) def.hazards = ot.hazards.map((z) => ({ hazard: z.hazard, rect: { x0: z.rect.x0 + ox, y0: z.rect.y0 + oy, x1: z.rect.x1 + ox, y1: z.rect.y1 + oy } }));
    if (ot.points.pedestals) def.points!.pedestals = ot.points.pedestals.map(w);
    if (ot.points.advocate) def.points!.advocate = w(ot.points.advocate);
    if (ot.points.watchers) def.points!.watchers = ot.points.watchers.map(w);
    if (ot.points.addSpawns) def.points!.addSpawns = { gate: ot.points.addSpawns.gate.map(w), field: ot.points.addSpawns.field.map(w) };
    if (ot.chorister.length || ot.dominion.length || ot.spawnTags.length) {
      // Preferred spawn indices: the room's x cells in reading order inside an affinity rect.
      const xs: Cell[] = [];
      for (let y = rect.y0; y <= rect.y1; y++) for (let x = rect.x0; x <= rect.x1; x++) if (markers[y][x] === 'x') xs.push([x, y]);
      for (const type of ['chorister', 'dominion'] as const) if (ot[type].length) def[type] = xs.flatMap(([x, y], k) => (ot[type].some((z) => x - ox >= z.x0 && x - ox <= z.x1 && y - oy >= z.y0 && y - oy <= z.y1) ? [k] : []));
      if (ot.spawnTags.length) def.spawnTags = ot.spawnTags.map((tag) => ({ index: xs.findIndex(([x, y]) => x === tag.at[0] + ox && y === tag.at[1] + oy), only: [...tag.only] }));
    }
    if (ot.gate) {
      const g = ot.gate;
      const ew = g.facing === 'W' || g.facing === 'E';
      gate = { facing: g.facing, plane: g.plane + (ew ? ox : oy), u0: g.u0 + (ew ? oy : ox), u1: g.u1 + (ew ? oy : ox), uCenter: g.uCenter + (ew ? oy : ox) };
    }
    return def;
  });

  const def: DungeonDef = {
    id,
    name: 'The Pearly Gates',
    heights: hg.map((row) => row.join('')),
    markers,
    rooms: defs,
    decor: { ...ROOM_DECOR },
    viewMask: vm.map((row) => row.join('')),
  };
  if (gate) def.gate = gate;
  const map = loadMap(def);
  const errors = validateLevel(map, markers, mode);
  return { def, map, slotOrigin: [sxMin, syMin], oriented, errors };
}
