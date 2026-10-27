/**
 * Slots, sockets and the 8 orientations (rogue game.md §3.1, §3.3 step 12, §3.4, §14.2). Pure: only
 * integer arithmetic.
 */
import type { Cell, Rect, RoomShape } from '../data/dungeons/types';
import type { TemplateShape } from '../data/rooms/types';

/** Slot pitch: a 4-cell wall band, then 32 interior cells. */
export const SLOT = 36;
export const BAND = 4;
/** Sockets sit at these offsets along a slot's edge (rogue game.md §3.4). */
export const SOCKET_OFFSET = 12;
export const SOCKET_WIDTH = 4;
/** A threshold strip reaches this deep into the room. */
export const STRIP_DEPTH = 6;
/** Entry cells are this many cells in from the socket. */
export const ENTRY_DEPTH = 3;
/** The base floor's height index (2.0 m), every socket's and strip's. */
export const BASE_INDEX = 8;

/** N, E, S, W. */
export type Dir = 0 | 1 | 2 | 3;
export const DIR_DX = [0, 1, 0, -1] as const;
export const DIR_DY = [-1, 0, 1, 0] as const;

/** The 8 orientations: 0–3 clockwise quarter-turns, 4–7 mirrored (x flipped) first. */
export const ORIENTATIONS = [0, 1, 2, 3, 4, 5, 6, 7] as const;

/** A room shape's size in slots. */
export function slotDims(shape: RoomShape | TemplateShape): [number, number] {
  switch (shape) {
    case '1x1':
      return [1, 1];
    case '2x1':
      return [2, 1];
    case '1x2':
      return [1, 2];
    default:
      return [2, 2];
  }
}

export function shapeOf(fw: number, fh: number): RoomShape {
  if (fw === 1 && fh === 1) return '1x1';
  if (fw === 2 && fh === 1) return '2x1';
  if (fw === 1 && fh === 2) return '1x2';
  return '2x2';
}

/** A room shape's interior in cells: 32, 68 per side. */
export function interiorSize(shape: RoomShape | TemplateShape): [number, number] {
  const [fw, fh] = slotDims(shape);
  return [SLOT * fw - BAND, SLOT * fh - BAND];
}

/** A socket: the footprint slot it's on and its side. */
export interface SocketRef {
  sx: number;
  sy: number;
  dir: Dir;
}

/**
 * The sockets of a shape in their numbering (rogue game.md §3.4): clockwise from the top-left, the north
 * side's slots left to right, the east side's top to bottom, the south side's right to left, the west
 * side's bottom to top.
 */
export function socketList(shape: RoomShape | TemplateShape): SocketRef[] {
  const [fw, fh] = slotDims(shape);
  const out: SocketRef[] = [];
  for (let sx = 0; sx < fw; sx++) out.push({ sx, sy: 0, dir: 0 });
  for (let sy = 0; sy < fh; sy++) out.push({ sx: fw - 1, sy, dir: 1 });
  for (let sx = fw - 1; sx >= 0; sx--) out.push({ sx, sy: fh - 1, dir: 2 });
  for (let sy = fh - 1; sy >= 0; sy--) out.push({ sx: 0, sy, dir: 3 });
  return out;
}

export function socketIndex(shape: RoomShape | TemplateShape, ref: SocketRef): number {
  const i = socketList(shape).findIndex((s) => s.sx === ref.sx && s.sy === ref.sy && s.dir === ref.dir);
  if (i < 0) throw new Error(`no socket ${ref.sx},${ref.sy},${ref.dir} on ${shape}`);
  return i;
}

/** The shape a placed shape becomes under orientation `o` (a quarter-turn swaps the sides). */
export function orientedShape(o: number, shape: RoomShape | TemplateShape): RoomShape {
  const [fw, fh] = slotDims(shape);
  return (o & 1) === 1 ? shapeOf(fh, fw) : shapeOf(fw, fh);
}

/**
 * Socket `s` of `shape` under orientation `o` (rogue game.md §3.4): its side and footprint slot are
 * mirrored, then turned; the result is numbered on the oriented shape. Physical offsets don't move.
 */
export function mapSocket(o: number, shape: RoomShape | TemplateShape, s: number): number {
  let [fw, fh] = slotDims(shape);
  let { sx, sy, dir } = socketList(shape)[s];
  if (o >= 4) {
    sx = fw - 1 - sx;
    if (dir === 1) dir = 3;
    else if (dir === 3) dir = 1;
  }
  for (let k = 0; k < (o & 3); k++) {
    [sx, sy] = [fh - 1 - sy, sx];
    [fw, fh] = [fh, fw];
    dir = ((dir + 1) & 3) as Dir;
  }
  return socketIndex(shapeOf(fw, fh), { sx, sy, dir });
}

/** The interior size after orientation `o`. */
export function orientedSize(o: number, w: number, h: number): [number, number] {
  return (o & 1) === 1 ? [h, w] : [w, h];
}

/** A template cell under orientation `o` of a `w` × `h` interior: mirror (w−1−x, y), then clockwise (h−1−y, x). */
export function cell(o: number, w: number, h: number, c: readonly [number, number]): Cell {
  let [x, y] = c;
  if (o >= 4) x = w - 1 - x;
  for (let k = 0; k < (o & 3); k++) {
    [x, y] = [h - 1 - y, x];
    [w, h] = [h, w];
  }
  return [x, y];
}

/** A continuous point under orientation `o`: mirror (w−x, y), then clockwise (h−y, x). */
export function point(o: number, w: number, h: number, p: readonly [number, number]): [number, number] {
  let [x, y] = p;
  if (o >= 4) x = w - x;
  for (let k = 0; k < (o & 3); k++) {
    [x, y] = [h - y, x];
    [w, h] = [h, w];
  }
  return [x, y];
}

/** A direction vector under orientation `o`. */
export function vec(o: number, d: readonly [number, number]): [number, number] {
  let [x, y] = d;
  if (o >= 4) x = -x;
  for (let k = 0; k < (o & 3); k++) [x, y] = [-y, x];
  return [x, y];
}

/** An inclusive cell rect under orientation `o`. */
export function rect(o: number, w: number, h: number, r: Rect): Rect {
  const a = cell(o, w, h, [r.x0, r.y0]);
  const b = cell(o, w, h, [r.x1, r.y1]);
  return { x0: Math.min(a[0], b[0]), y0: Math.min(a[1], b[1]), x1: Math.max(a[0], b[0]), y1: Math.max(a[1], b[1]) };
}

/**
 * The reward square under orientation `o` (rogue game.md §3.3 step 12): all four corners of its 4×4
 * rect are transformed and the new top-left is their minimum.
 */
export function rewardRect(o: number, w: number, h: number, r: readonly [number, number]): Cell {
  const [rx, ry] = r;
  let x0 = Infinity;
  let y0 = Infinity;
  for (const c of [[rx, ry], [rx + 3, ry], [rx, ry + 3], [rx + 3, ry + 3]] as const) {
    const [x, y] = cell(o, w, h, c);
    x0 = Math.min(x0, x);
    y0 = Math.min(y0, y);
  }
  return [x0, y0];
}

/** Whether `o` keeps a template's long axis on the placed room's (a 2×1 template placed 2×1 or 1×2). */
export function longAxisOk(o: number, template: TemplateShape, placed: RoomShape): boolean {
  if (template !== '2x1') return true;
  return placed === '2x1' ? (o & 1) === 0 : (o & 1) === 1;
}

/** The offset of a socket's first cell along its edge. */
function along(ref: SocketRef): number {
  return SLOT * (ref.dir === 0 || ref.dir === 2 ? ref.sx : ref.sy) + SOCKET_OFFSET;
}

/** The cells of a strip of `depth` rows inward from socket `s` of `shape`, in interior coordinates, socket cells first. */
function inward(shape: RoomShape | TemplateShape, s: number, depth0: number, depth1: number): Cell[] {
  const [w, h] = interiorSize(shape);
  const ref = socketList(shape)[s];
  const a = along(ref);
  const out: Cell[] = [];
  for (let d = depth0; d <= depth1; d++) {
    for (let i = 0; i < SOCKET_WIDTH; i++) {
      switch (ref.dir) {
        case 0:
          out.push([a + i, d]);
          break;
        case 1:
          out.push([w - 1 - d, a + i]);
          break;
        case 2:
          out.push([a + i, h - 1 - d]);
          break;
        default:
          out.push([d, a + i]);
      }
    }
  }
  return out;
}

/** The 4 cells of socket `s` on the interior's edge. */
export function socketCells(shape: RoomShape | TemplateShape, s: number): Cell[] {
  return inward(shape, s, 0, 0);
}

/** The 4 × 6 threshold strip of socket `s`. */
export function stripCells(shape: RoomShape | TemplateShape, s: number): Cell[] {
  return inward(shape, s, 0, STRIP_DEPTH - 1);
}

/** The 4 entry cells of socket `s`, 3 cells in, along the socket in increasing coordinate. */
export function entryCellsOf(shape: RoomShape | TemplateShape, s: number): Cell[] {
  return inward(shape, s, ENTRY_DEPTH, ENTRY_DEPTH);
}
