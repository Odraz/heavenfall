/**
 * The Heavenly Gate (M10 gate): the boss arena's west wall drawn as the gate of Heaven. Golden gate
 * leaves and gilded railings in the wall's plane, white-and-gold gateposts and railing posts behind it,
 * with crowns and spires, built the hybrid way like the arches: simple geometry carrying painted faces.
 * Drawn only; the simulation's wall is unchanged. Built once from `map.gate`, deterministically.
 */
import type { GameMap } from '../sim/map';
import type { ArchBuilder, ArchLight } from './arches';
import { CROWN_BASE_PX, CROWN_TOP_ROW, CROWN_WIDE, POST_TOP_H, POST_TOP_W, SHAFT_REPEAT, SPIRE_COLS } from './gate.gen';
import { TILE } from './looks';

/** The gate array's layers (M10 gate §2). */
export const G_LEAVES = 0;
export const G_RAILING = 1;
export const G_POST_TOP = 2;
export const G_SHAFT = 3;

/** The plinth's height: all ironwork stands on it. */
export const PLINTH = 0.3;
/** The leaves: half their width (each side of the center line) and their arched top, above F. */
export const LEAF_HALF = 9;
export const LEAF_TOP = 32;
/** The gateposts: their axes' distance from the center line and from the plane, their shaft. */
const GATEPOST_D = 10.5;
const GATEPOST_SIZE = 3;
/** Every shaft runs from this far below F, so it doesn't end in mid-air seen through the railing. */
const SHAFT_FOOT = -4;
const GATEPOST_TOP = 28;
/** The gateposts' spires end this high above F. */
const SPIRE_TIP = 50;
/** The railing posts' crowns and spires are the gatepost's at one third of its size. */
const RAIL_SCALE = 1 / 3;
const RAIL_SPIRE = 6.4;
const CORNER_POST_TOP = 12;
/** A middle post rises this far above the higher railing top beside it. */
const MIDDLE_POST_ABOVE = 0.5;
/** The arc of the railing's top (M10 gate §1): an ellipse through 10.67 m at d = 25 and 26 m at d = 12. */
const ARC_A = 29.06;
const ARC_B = 26.88;
/** The railing's columns, so its top follows the arc and its faces carry the shadow line. */
const RAIL_COLUMN = 0.25;
/** The railing image's bands (fractions of its height from the bottom) and their fixed heights. */
const RAIL_BOTTOM_V = 0.15;
const RAIL_TOP_V = 0.75;
const RAIL_BOTTOM_H = 1.6;
const RAIL_TOP_H = 2.67;
/** The spires' cards are this many times the painted width at the crown's scale. */
const SPIRE_WIDEN = 2;
/** The tracers' boxes for the spires, across. */
const SPIRE_HIT = 1.8;

/** The top of the railing above F at a distance d from the center line. */
export function arc(d: number): number {
  const t = d / ARC_B;
  return ARC_A * Math.sqrt(Math.max(0, 1 - t * t));
}

/** A post: a square shaft behind the plane, a crown box on it and two crossed spire cards. */
export interface GatePost {
  /** Its axis. */
  x: number;
  y: number;
  /** The shaft's width, and its foot and top (absolute). */
  size: number;
  foot: number;
  top: number;
  /** The crown: its box's width, its height, and the width of its painted sides. */
  crownBox: number;
  crownH: number;
  crownW: number;
  /** The spire cards: from the crown's top to `tip`, `spireW` wide; `hitW` for the tracers. */
  tip: number;
  spireW: number;
  hitW: number;
  /** The shaft's texture repeats every `repeat` meters. */
  repeat: number;
}

/** A railing panel, between dIn and dOut from the center line, on side −1 (north) or +1 (south). */
export interface GatePanel {
  side: -1 | 1;
  dIn: number;
  dOut: number;
}

export interface GateLayout {
  /** The plane of the gate (the wall's face), the center line and the skipped rows. */
  x: number;
  yc: number;
  y0: number;
  y1: number;
  /** The boss arena's floor. */
  F: number;
  posts: GatePost[];
  panels: GatePanel[];
  /** The plinth's runs along y (under the leaves and the panels). */
  plinth: Array<[number, number]>;
}

/** The crown's scale: meters per pixel of gate-post-top-2, where the base band spans the 4 m box. */
const CROWN_SCALE = 4 / CROWN_BASE_PX;

/** The gate's layout, or null for a map without one. */
export function gateLayout(map: GameMap): GateLayout | null {
  const g = map.gate;
  if (!g) return null;
  const F = map.floor[g.yCenter * map.w + g.x];
  const crownH = (POST_TOP_H - CROWN_TOP_ROW) * CROWN_SCALE;
  const crownW = (CROWN_WIDE[1] - CROWN_WIDE[0]) * CROWN_SCALE;
  const spireW = SPIRE_WIDEN * (SPIRE_COLS[1] - SPIRE_COLS[0]) * CROWN_SCALE;
  const posts: GatePost[] = [];
  for (const side of [-1, 1]) {
    posts.push({
      x: g.x - GATEPOST_SIZE / 2, y: g.yCenter + side * GATEPOST_D, size: GATEPOST_SIZE,
      foot: F + SHAFT_FOOT, top: F + GATEPOST_TOP,
      crownBox: 4, crownH, crownW,
      tip: F + SPIRE_TIP, spireW, hitW: SPIRE_HIT, repeat: SHAFT_REPEAT,
    });
    const rail = (d: number, top: number): GatePost => {
      const crownTop = top + crownH * RAIL_SCALE;
      return {
        x: g.x - 0.5, y: g.yCenter + side * d, size: 1, foot: F + SHAFT_FOOT, top,
        crownBox: 4 * RAIL_SCALE, crownH: crownH * RAIL_SCALE, crownW: crownW * RAIL_SCALE,
        tip: crownTop + RAIL_SPIRE, spireW: spireW * RAIL_SCALE, hitW: SPIRE_HIT * RAIL_SCALE, repeat: SHAFT_REPEAT * RAIL_SCALE,
      };
    };
    // The corner posts in the corner cells, and the middle posts between the panels.
    const corner = g.yCenter - g.y0 - 0.5;
    posts.push(rail(corner, F + CORNER_POST_TOP));
    posts.push(rail(18.5, F + Math.max(arc(18), arc(19)) + MIDDLE_POST_ABOVE));
  }
  const panels: GatePanel[] = [];
  for (const side of [-1, 1] as const) {
    panels.push({ side, dIn: 12, dOut: 18 }, { side, dIn: 19, dOut: 25 });
  }
  const plinth: Array<[number, number]> = [[g.yCenter - LEAF_HALF, g.yCenter + LEAF_HALF]];
  for (const p of panels) plinth.push(p.side < 0 ? [g.yCenter - p.dOut, g.yCenter - p.dIn] : [g.yCenter + p.dIn, g.yCenter + p.dOut]);
  plinth.sort((a, b) => a[0] - b[0]);
  return { x: g.x, yc: g.yCenter, y0: g.y0, y1: g.y1, F, posts, panels, plinth };
}

/** The cells the terrain and the relief skip (M10 gate §3): west of the plane, along the gate. */
export function gateSkip(map: GameMap): ((c: number, r: number) => boolean) | null {
  const g = map.gate;
  if (!g) return null;
  return (c, r) => c < g.x && r >= g.y0 && r < g.y1;
}

/** A shadow line for faces turned to the sun, evaluated 1 cm inside the face (cached per point). */
function sunLine(light: ArchLight, nx: number, ny: number, foot: number, top: number, mid: [number, number]): ((x: number, y: number) => number) | null {
  if (!light.facesSun(nx, ny)) return null;
  const cache = new Map<string, number>();
  return (x, y) => {
    const key = `${x.toFixed(4)},${y.toFixed(4)}`;
    let z = cache.get(key);
    if (z === undefined) {
      const ix = x + Math.sign(mid[0] - x) * 0.01;
      const iy = y + Math.sign(mid[1] - y) * 0.01;
      z = light.shadowZ(ix, iy, nx, ny, foot, top);
      cache.set(key, z);
    }
    return z;
  };
}

/**
 * A vertical quad facing (nx, ny), centered at (cx, cy), `width` across, from z0 to z1, with u from u0
 * on its left to u1 on its right as seen from in front, and v from v0 to v1.
 */
function card(g: ArchBuilder, light: ArchLight, nx: number, ny: number, cx: number, cy: number, width: number, z0: number, z1: number, uv: [number, number, number, number], layer: number, foot: number, top: number): void {
  // Seen from in front, the left is (−ny, nx) in map coordinates (y runs south).
  const lx = -ny * (width / 2);
  const ly = nx * (width / 2);
  const [u0, v0, u1, v1] = uv;
  g.rgb = light.faceColor(nx, ny);
  g.shadowAt = sunLine(light, nx, ny, foot, top, [cx, cy]);
  g.quad(
    [[cx + lx, cy + ly, z0], [cx - lx, cy - ly, z0], [cx - lx, cy - ly, z1], [cx + lx, cy + ly, z1]],
    [[u0, v0], [u1, v0], [u1, v1], [u0, v1]],
    1,
    [nx, ny, 0],
    layer,
  );
}

const SIDES = [[1, 0], [-1, 0], [0, 1], [0, -1]] as const;

/**
 * The gate's mesh (M10 gate §3): the leaves and the railing panels in the plane, the posts' shafts,
 * crowns and spires behind it. One cut-out mesh over the gate array, double-sided.
 */
export function emitGate(g: ArchBuilder, L: GateLayout, light: ArchLight): void {
  g.isFloor = 0;
  const { x, yc, F } = L;
  const z0 = F + PLINTH;
  // The leaves: two halves split at the center line, u from y = yc + 9 (0) to yc − 9 (1).
  for (const [a, b, u0, u1] of [[yc + LEAF_HALF, yc, 0, 0.5], [yc, yc - LEAF_HALF, 0.5, 1]] as const) {
    card(g, light, 1, 0, x, (a + b) / 2, a - b, z0, F + LEAF_TOP, [u0, 0, u1, 1], G_LEAVES, z0, F + LEAF_TOP);
  }
  // The railing: 0.25 m columns whose top follows the arc; three bands of the image, the middle
  // one stretched. u from the panel's inner end, so the two sides mirror each other.
  for (const p of L.panels) {
    const n = Math.round((p.dOut - p.dIn) / RAIL_COLUMN);
    const width = p.dOut - p.dIn;
    for (let i = 0; i < n; i++) {
      const da = p.dIn + i * RAIL_COLUMN;
      const db = da + RAIL_COLUMN;
      const ya = yc + p.side * da;
      const yb = yc + p.side * db;
      const ua = (da - p.dIn) / width;
      const ub = (db - p.dIn) / width;
      const ta = F + arc(da);
      const tb = F + arc(db);
      const bands: Array<[number, number, number, number, number, number]> = [
        // z at a, z at b (bottom), z at a, z at b (top), v0, v1
        [z0, z0, z0 + RAIL_BOTTOM_H, z0 + RAIL_BOTTOM_H, 0, RAIL_BOTTOM_V],
        [z0 + RAIL_BOTTOM_H, z0 + RAIL_BOTTOM_H, ta - RAIL_TOP_H, tb - RAIL_TOP_H, RAIL_BOTTOM_V, RAIL_TOP_V],
        [ta - RAIL_TOP_H, tb - RAIL_TOP_H, ta, tb, RAIL_TOP_V, 1],
      ];
      g.rgb = light.faceColor(1, 0);
      g.shadowAt = sunLine(light, 1, 0, z0, Math.max(ta, tb), [x, (ya + yb) / 2]);
      for (const [ba, bb, ca, cb, v0, v1] of bands) {
        g.quad([[x, ya, ba], [x, yb, bb], [x, yb, cb], [x, ya, ca]], [[ua, v0], [ub, v0], [ub, v1], [ua, v1]], 1, [1, 0, 0], G_RAILING);
      }
    }
  }
  for (const post of L.posts) emitPost(g, post, light, yc);
  g.shadowAt = null;
}

function emitPost(g: ArchBuilder, p: GatePost, light: ArchLight, yc: number): void {
  const h = p.size / 2;
  const crownTop = p.top + p.crownH;
  // The shaft: segments one repeat tall, each v 0–1, the top one cropped. Its top is under the crown.
  for (const [nx, ny] of SIDES) {
    for (let z = p.foot; z < p.top - 1e-3; z += p.repeat) {
      const z1 = Math.min(p.top, z + p.repeat);
      card(g, light, nx, ny, p.x + nx * h, p.y + ny * h, p.size, z, z1, [0, 0, 1, (z1 - z) / p.repeat], G_SHAFT, p.foot, p.top);
    }
  }
  // The crown: on the four sides of its box, each side's painting as wide as the crown's widest row.
  const cv = (POST_TOP_H - CROWN_TOP_ROW) / POST_TOP_H;
  for (const [nx, ny] of SIDES) {
    const b = p.crownBox / 2;
    card(g, light, nx, ny, p.x + nx * b, p.y + ny * b, p.crownW, p.top, crownTop, [CROWN_WIDE[0] / POST_TOP_W, 0, CROWN_WIDE[1] / POST_TOP_W, cv], G_POST_TOP, p.top, crownTop);
  }
  // The spire: two cards crossing on the axis, the painting above the crown's top stretched to the tip.
  // The y–z card faces the arena, the x–z card the center line.
  const uv: [number, number, number, number] = [SPIRE_COLS[0] / POST_TOP_W, cv, SPIRE_COLS[1] / POST_TOP_W, 1];
  card(g, light, 1, 0, p.x, p.y, p.spireW, crownTop, p.tip, uv, G_POST_TOP, crownTop, p.tip);
  const toCenter = p.y < yc ? 1 : -1;
  card(g, light, 0, toCenter, p.x, p.y, p.spireW, crownTop, p.tip, uv, G_POST_TOP, crownTop, p.tip);
}

/** What the plinth is emitted into: the terrain's builder. */
export interface PlinthBuilder extends ArchBuilder {
  side(
    x0: number, y0: number, x1: number, y1: number, z0: number, z1: number,
    u0: number, u1: number, v0: number, v1: number,
    normal: [number, number, number], shade: number, layer: number,
    face: { foot: number; top: number }, fade0?: number, fade1?: number,
  ): void;
}

/**
 * The plinth (terrain mesh, M10 gate §3): a low stone step under the leaves and the panels, its top at
 * F + 0.3, its front in the plane, its outer face a cliff down to the cliff bottom (fading out like the
 * open edges' cliffs). In 1 m pieces, so its front and top follow the shadow line.
 */
export function emitPlinth(g: PlinthBuilder, L: GateLayout, light: ArchLight, inShadow: (x: number, y: number, z: number) => boolean, riser: number, wall: number, cliffBottom: number, cliffFade: number): void {
  const { x, F } = L;
  const top = F + PLINTH;
  g.isFloor = 0;
  for (const [ya, yb] of L.plinth) {
    for (let y = ya; y < yb - 1e-6; y++) {
      const y1 = Math.min(yb, y + 1);
      // The top: shaded like the floor beside it, in the shadow where its front edge is.
      g.rgb = [1, 1, 1];
      g.shadowAt = (_px, py) => (inShadow(x + 0.01, py + Math.sign(y + 0.5 - py) * 0.01, top + 0.01) ? top + 1 : -1e4);
      g.quad([[x - 1, y, top], [x, y, top], [x, y1, top], [x - 1, y1, top]], [[(x - 1) / TILE, y / TILE], [x / TILE, y / TILE], [x / TILE, y1 / TILE], [(x - 1) / TILE, y1 / TILE]], 0.95, [0, 0, 1], riser);
      // The front, in the plane.
      g.rgb = light.faceColor(1, 0);
      g.shadowAt = sunLine(light, 1, 0, F, top, [x, y + 0.5]);
      g.side(x, y1, x, y, F, top, y1 / TILE, y / TILE, F / TILE, top / TILE, [1, 0, 0], 1, riser, { foot: F, top });
      // The outer face: a cliff.
      g.rgb = light.faceColor(-1, 0);
      g.shadowAt = null;
      const s = 0.92;
      g.side(x - 1, y, x - 1, y1, cliffBottom, cliffBottom + cliffFade, y / TILE, y1 / TILE, cliffBottom / TILE, (cliffBottom + cliffFade) / TILE, [-1, 0, 0], s, wall, { foot: cliffBottom, top }, 1, 0);
      g.side(x - 1, y, x - 1, y1, cliffBottom + cliffFade, top, y / TILE, y1 / TILE, (cliffBottom + cliffFade) / TILE, top / TILE, [-1, 0, 0], s, wall, { foot: cliffBottom, top });
    }
  }
  g.shadowAt = null;
}

/** Where a ray enters an axis-aligned box, or Infinity. */
function boxHit(x: number, y: number, z: number, dx: number, dy: number, dz: number, maxT: number, b: [number, number, number, number, number, number]): number {
  let t0 = 0;
  let t1 = maxT;
  const o = [x, y, z];
  const d = [dx, dy, dz];
  for (let k = 0; k < 3; k++) {
    const lo = b[k * 2];
    const hi = b[k * 2 + 1];
    if (Math.abs(d[k]) < 1e-12) {
      if (o[k] < lo || o[k] > hi) return Infinity;
      continue;
    }
    let ta = (lo - o[k]) / d[k];
    let tb = (hi - o[k]) / d[k];
    if (ta > tb) [ta, tb] = [tb, ta];
    t0 = Math.max(t0, ta);
    t1 = Math.min(t1, tb);
    if (t0 > t1) return Infinity;
  }
  return t0 > 0 ? t0 : Infinity;
}

/**
 * Where a hitscan shot meets the gate (M10 gate §3), for its tracer: the plane within the leaves and
 * the panels (solid up to their tops), and the posts' shafts, crowns and spires as boxes, from F + 0.3
 * up. Returns the distance, or Infinity.
 */
export function gateHit(L: GateLayout, x: number, y: number, z: number, dx: number, dy: number, dz: number, maxT: number): number {
  let best = Infinity;
  const z0 = L.F + PLINTH;
  if (Math.abs(dx) > 1e-9) {
    const t = (L.x - x) / dx;
    if (t > 0 && t <= maxT) {
      const zz = z + dz * t;
      const d = Math.abs(y + dy * t - L.yc);
      if (zz >= z0) {
        if (d <= LEAF_HALF && zz <= L.F + LEAF_TOP) best = t;
        else if (L.panels.some((p) => d >= p.dIn && d <= p.dOut) && zz <= L.F + arc(d)) best = t;
      }
    }
  }
  for (const p of L.posts) {
    const h = p.size / 2;
    const b = p.crownBox / 2;
    const s = p.hitW / 2;
    const crownTop = p.top + p.crownH;
    const boxes: Array<[number, number, number, number, number, number]> = [
      [p.x - h, p.x + h, p.y - h, p.y + h, Math.max(p.foot, z0), p.top],
      [p.x - b, p.x + b, p.y - b, p.y + b, p.top, crownTop],
      [p.x - s, p.x + s, p.y - s, p.y + s, crownTop, p.tip],
    ];
    for (const box of boxes) best = Math.min(best, boxHit(x, y, z, dx, dy, dz, Math.min(maxT, best), box));
  }
  return best;
}
