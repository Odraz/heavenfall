/**
 * Templates, orientations and props for a layout (rogue game.md §3.3 steps 11–13), and the oriented
 * template geometry every later step reads. Pure.
 */
import type { Cell, GateDef, Rect, RoomShape } from '../data/dungeons/types';
import type { RoomTemplate, TemplateShape } from '../data/rooms/types';
import type { Rng } from './hash';
import type { Layout } from './layout';
import {
  BASE_INDEX,
  cell,
  longAxisOk,
  mapSocket,
  ORIENTATIONS,
  orientedShape,
  orientedSize,
  point,
  rect,
  rewardRect,
  socketList,
  stripCells,
  vec,
} from './transform';

/** A template under one orientation, in the oriented room's interior coordinates. */
export interface OrientedTemplate {
  template: RoomTemplate;
  o: number;
  shape: RoomShape;
  w: number;
  h: number;
  heights: string[];
  markers: string[];
  /** In canonical (template) order. */
  props: Array<{ at: Cell; family: RoomTemplate['props'][number]['family']; chance: number }>;
  hazards: Array<{ rect: Rect; hazard: string }>;
  obstacles: Array<{ rect: Rect; purpose: string }>;
  rewardSpot: Cell;
  chorister: Rect[];
  dominion: Rect[];
  spawnTags: Array<{ at: Cell; only: Array<'chorister' | 'dominion'> }>;
  points: {
    pedestals?: Cell[];
    advocate?: Cell;
    boss?: Cell;
    watchers?: Cell[];
    addSpawns?: { gate: Cell[]; field: Cell[] };
  };
  /** Boss only: the gate plane in the oriented interior's continuous coordinates. */
  gate?: GateDef;
  /** Boss only: its entry socket on the oriented shape. */
  entrySocket?: number;
}

const cache = new WeakMap<RoomTemplate, OrientedTemplate[]>();

/** The template under orientation `o` (cached; templates are immutable content). */
export function orientTemplate(t: RoomTemplate, o: number): OrientedTemplate {
  let list = cache.get(t);
  if (!list) {
    list = [];
    cache.set(t, list);
  }
  if (list[o]) return list[o];
  const W = t.heights[0].length;
  const H = t.heights.length;
  const [w, h] = orientedSize(o, W, H);
  const hg = Array.from({ length: h }, () => new Array<string>(w));
  const mk = Array.from({ length: h }, () => new Array<string>(w));
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const [nx, ny] = cell(o, W, H, [x, y]);
      hg[ny][nx] = t.heights[y][x];
      mk[ny][nx] = t.markers[y][x];
    }
  }
  const c = (p: readonly [number, number]) => cell(o, W, H, p);
  const ot: OrientedTemplate = {
    template: t,
    o,
    shape: orientedShape(o, t.shape),
    w,
    h,
    heights: hg.map((r) => r.join('')),
    markers: mk.map((r) => r.join('')),
    props: t.props.map((p) => ({ at: c(p.at), family: p.family, chance: p.chance })),
    hazards: t.hazards.map((z) => ({ rect: rect(o, W, H, z.rect), hazard: z.hazard })),
    obstacles: t.obstacles.map((z) => ({ rect: rect(o, W, H, z.rect), purpose: z.purpose })),
    rewardSpot: rewardRect(o, W, H, t.rewardSpot),
    chorister: (t.spawnAffinity?.chorister ?? []).map((z) => rect(o, W, H, z)),
    dominion: (t.spawnAffinity?.dominion ?? []).map((z) => rect(o, W, H, z)),
    spawnTags: (t.spawnTags ?? []).map((tag) => ({ at: c(tag.at), only: [...tag.only] })),
    points: {},
  };
  const pt = t.points;
  if (pt?.pedestals) ot.points.pedestals = pt.pedestals.map(c);
  if (pt?.advocate) ot.points.advocate = c(pt.advocate);
  if (pt?.boss) ot.points.boss = c(pt.boss);
  if (pt?.watchers) ot.points.watchers = pt.watchers.map(c);
  if (pt?.addSpawns) ot.points.addSpawns = { gate: pt.addSpawns.gate.map(c), field: pt.addSpawns.field.map(c) };
  if (t.gate) ot.gate = orientGate(t.gate, o, W, H);
  if (t.entrySocket !== undefined) ot.entrySocket = mapSocket(o, t.shape, t.entrySocket);
  list[o] = ot;
  return ot;
}

/**
 * A canonical gate plane under orientation `o` (rogue game.md §14.2): its segment endpoints and center
 * are continuous points (mirror (W−x, y), clockwise (H−y, x)); its facing follows the outward normal.
 */
export function orientGate(g: GateDef, o: number, W: number, H: number): GateDef {
  const along = g.facing === 'W' || g.facing === 'E';
  const at = (u: number): [number, number] => (along ? [g.plane, u] : [u, g.plane]);
  const n0: [number, number] = g.facing === 'W' ? [-1, 0] : g.facing === 'E' ? [1, 0] : g.facing === 'N' ? [0, -1] : [0, 1];
  const a = point(o, W, H, at(g.u0));
  const b = point(o, W, H, at(g.u1));
  const m = point(o, W, H, at(g.uCenter));
  const [nx, ny] = vec(o, n0);
  const facing = nx < 0 ? 'W' : nx > 0 ? 'E' : ny < 0 ? 'N' : 'S';
  const ew = facing === 'W' || facing === 'E';
  return {
    facing,
    plane: ew ? a[0] : a[1],
    u0: Math.min(ew ? a[1] : a[0], ew ? b[1] : b[0]),
    u1: Math.max(ew ? a[1] : a[0], ew ? b[1] : b[0]),
    uCenter: ew ? m[1] : m[0],
  };
}

/** The physical sockets an oriented template must keep clear: all of its shape's, or the boss's entry. */
export function keptSockets(ot: OrientedTemplate): number[] {
  if (ot.template.kind === 'boss') return [ot.entrySocket!];
  return socketList(ot.shape).map((_, s) => s);
}

/** Spawn markers keep at least this far from every physical strip cell (rogue game.md §4.7 rule 4). */
export const SPAWN_STRIP_DIST = 6;
/** Blast props (sanctuary lamps) keep at least this far horizontally (rooms.md §8). */
export const BLAST_STRIP_DIST = 4;

/**
 * Why an oriented template obstructs its fixed physical thresholds (rogue game.md §3.4), or null when
 * it's valid: every kept strip flat at socket height with no marker, hazard or prop; spawn markers 6 m
 * and blast props 4 m from every strip cell; the reward square outside the strips.
 */
export function orientationProblem(ot: OrientedTemplate): string | null {
  const strip = new Set<number>();
  const stripList: Cell[] = [];
  for (const s of keptSockets(ot)) {
    for (const [x, y] of stripCells(ot.shape, s)) {
      if (!strip.has(y * ot.w + x)) stripList.push([x, y]);
      strip.add(y * ot.w + x);
    }
  }
  const inHazard = (x: number, y: number) => ot.hazards.some((z) => x >= z.rect.x0 && x <= z.rect.x1 && y >= z.rect.y0 && y <= z.rect.y1);
  for (const [x, y] of stripList) {
    if (ot.heights[y][x] !== String(BASE_INDEX)) return `strip cell (${x}, ${y}) isn't base floor`;
    if (ot.markers[y][x] !== '.') return `strip cell (${x}, ${y}) has a marker`;
    if (inHazard(x, y)) return `strip cell (${x}, ${y}) is a hazard`;
  }
  const near = (x: number, y: number, d: number) => stripList.some(([sx, sy]) => (sx - x) * (sx - x) + (sy - y) * (sy - y) < d * d - 1e-9);
  for (const p of ot.props) {
    if (strip.has(p.at[1] * ot.w + p.at[0])) return `prop at (${p.at[0]}, ${p.at[1]}) is in a strip`;
    if (p.family === 'blast' && near(p.at[0], p.at[1], BLAST_STRIP_DIST)) return `blast prop at (${p.at[0]}, ${p.at[1]}) is within ${BLAST_STRIP_DIST} m of a strip`;
  }
  if (ot.template.kind === 'combat') {
    for (let y = 0; y < ot.h; y++) {
      for (let x = 0; x < ot.w; x++) {
        if (ot.markers[y][x] === 'x' && near(x, y, SPAWN_STRIP_DIST)) return `spawn point (${x}, ${y}) is within ${SPAWN_STRIP_DIST} m of a strip`;
      }
    }
  }
  const [rx, ry] = ot.rewardSpot;
  for (let y = ry; y < ry + 4; y++) for (let x = rx; x < rx + 4; x++) if (strip.has(y * ot.w + x)) return 'the reward square overlaps a strip';
  return null;
}

/** The template shape a placed room of `shape` takes (a 1×2 room uses a 2×1 template). */
export function templateShapeFor(shape: RoomShape): TemplateShape {
  return shape === '1x2' ? '2x1' : shape;
}

/**
 * The valid orientations of template `t` for a room placed as `placed`, in canonical order: the long
 * axis on the room's, every kept physical threshold clear; `fixedOrientation` keeps identity only.
 */
export function allowedOrientations(t: RoomTemplate, placed: RoomShape): number[] {
  const list = t.fixedOrientation ? [0] : ORIENTATIONS;
  return list.filter((o) => longAxisOk(o, t.shape, placed) && orientedShape(o, t.shape) === placed && orientationProblem(orientTemplate(t, o)) === null);
}

/** The boss's orientation: the first valid one mapping its entry socket onto the actual door. */
export function bossOrientation(t: RoomTemplate, door: number): number {
  for (const o of allowedOrientations(t, '2x2')) if (orientTemplate(t, o).entrySocket === door) return o;
  return -1;
}

export interface Assignment {
  templates: RoomTemplate[];
  orientations: number[];
  /** One per prop socket of each room's template, in room then template order. */
  props: Array<{ room: number; index: number; filled: boolean; marked: boolean }>;
}

export type AssignResult = { ok: true; assignment: Assignment } | { ok: false; reason: string };

/** Steps 11–13. */
export function assignFloor(rng: Rng, layout: Layout, pool: readonly RoomTemplate[], heaven: number): AssignResult {
  const templates: RoomTemplate[] = [];
  const used = new Set<string>();
  // 11. Templates, room by room.
  for (let i = 0; i < layout.rooms.length; i++) {
    const room = layout.rooms[i];
    let cands: RoomTemplate[];
    if (room.kind === 'combat') {
      const shape = templateShapeFor(room.shape);
      const base = pool.filter((t) => t.heaven === heaven && t.kind === 'combat' && t.shape === shape && !used.has(t.id) && allowedOrientations(t, room.shape).length > 0);
      cands = base.filter((t) => room.band! >= t.bands[0] && room.band! <= t.bands[1]);
      if (cands.length === 0) cands = base;
    } else if (room.kind === 'boss') {
      const door = room.doors[0].socket;
      cands = pool.filter((t) => t.heaven === heaven && t.kind === 'boss' && t.shape === '2x2' && bossOrientation(t, door) >= 0);
    } else {
      cands = pool.filter((t) => t.heaven === heaven && t.kind === room.kind && t.shape === room.shape && allowedOrientations(t, room.shape).length > 0);
    }
    if (cands.length === 0) return { ok: false, reason: `no template for ${room.kind} ${room.shape}` };
    const t = rng.weighted(cands, (c) => c.weight);
    if (t.kind === 'combat') used.add(t.id);
    templates.push(t);
  }
  // 12. Orientations.
  const orientations: number[] = [];
  for (let i = 0; i < layout.rooms.length; i++) {
    const room = layout.rooms[i];
    const t = templates[i];
    if (room.kind === 'boss') orientations.push(bossOrientation(t, room.doors[0].socket));
    else {
      const allowed = allowedOrientations(t, room.shape);
      orientations.push(allowed[rng.int(allowed.length)]);
    }
  }
  // 13. Props: one draw per socket, except the map room's first loot socket, the marked reliquary.
  const props: Assignment['props'] = [];
  for (let i = 0; i < layout.rooms.length; i++) {
    const t = templates[i];
    const firstLoot = i === layout.mapRoom ? t.props.findIndex((p) => p.family === 'loot') : -1;
    t.props.forEach((p, index) => {
      if (index === firstLoot) props.push({ room: i, index, filled: true, marked: true });
      else props.push({ room: i, index, filled: rng.next() < p.chance, marked: false });
    });
  }
  return { ok: true, assignment: { templates, orientations, props } };
}
