/**
 * The floor layout on the 7 × 7 slot grid (rogue game.md §3.3 steps 1–10): Isaac's breadth-first growth
 * with big rooms, the Confessional and the boss, the Reliquary, the Pardoner, the marked rooms and the
 * bands. Pure; RNG draws happen only where the spec says `rng`, in its order.
 */
import type { RoomKind, RoomShape } from '../data/dungeons/types';
import type { Rng } from './hash';
import { DIR_DX, DIR_DY, socketIndex, slotDims, type Dir } from './transform';

export const GRID = 7;
/** Isaac's coin flip: an exit is skipped when rng.next() is below this (step 2.2). */
const SKIP_EXIT = 0.45;
/** Step 2.4's exclusive shape bands. */
const BAND_2X2 = 0.3;
const BAND_2X1 = 0.4;
const BAND_1X2 = 0.5;
/** Heavens 1–3: one 2×2 combat room, at most two 2×1/1×2 (rogue game.md §3.1). */
const MAX_2X2 = 1;
const MAX_RECT = 2;

export interface LayoutRoom {
  kind: RoomKind;
  shape: RoomShape;
  /** Footprint slots in row-major order; the first is the anchor (top-left). */
  slots: Array<[number, number]>;
  /** The room it grew from, -1 for the Breach. */
  parent: number;
  /** Doors from the Breach. */
  dist: number;
  /** Combat rooms only. */
  band?: 1 | 2 | 3;
  /** Socket ascending. */
  doors: Array<{ socket: number; to: number }>;
}

export interface Layout {
  n: number;
  rooms: LayoutRoom[];
  confessional: number;
  boss: number;
  reliquary: number;
  pardoner: number;
  keyRoom: number;
  mapRoom: number;
  bells: [number, number];
}

export type LayoutResult = { ok: true; layout: Layout } | { ok: false; reason: string };

/** The footprint of `shape` anchored at (ax, ay), row-major. */
export function footprint(shape: RoomShape, ax: number, ay: number): Array<[number, number]> {
  const [fw, fh] = slotDims(shape);
  const out: Array<[number, number]> = [];
  for (let y = 0; y < fh; y++) for (let x = 0; x < fw; x++) out.push([ax + x, ay + y]);
  return out;
}

const inGrid = (x: number, y: number) => x >= 0 && y >= 0 && x < GRID && y < GRID;

/** The direction from slot a to its 4-neighbor b. */
export function dirTo(a: readonly [number, number], b: readonly [number, number]): Dir {
  for (let d = 0; d < 4; d++) if (a[0] + DIR_DX[d] === b[0] && a[1] + DIR_DY[d] === b[1]) return d as Dir;
  throw new Error(`slots ${a} and ${b} aren't neighbors`);
}

/** Room `r`'s socket on the edge from its slot `s` to the neighboring slot `n`. */
export function socketOn(room: Pick<LayoutRoom, 'shape' | 'slots'>, s: readonly [number, number], n: readonly [number, number]): number {
  const [ax, ay] = room.slots[0];
  return socketIndex(room.shape, { sx: s[0] - ax, sy: s[1] - ay, dir: dirTo(s, n) });
}

/** Adds the door between child room `ci` (its slot `n`) and parent room `pi` (its slot `c`) to both rooms. */
export function connect(rooms: LayoutRoom[], ci: number, n: readonly [number, number], pi: number, c: readonly [number, number]): void {
  rooms[ci].doors.push({ socket: socketOn(rooms[ci], n, c), to: pi });
  rooms[pi].doors.push({ socket: socketOn(rooms[pi], c, n), to: ci });
  for (const i of [ci, pi]) rooms[i].doors.sort((a, b) => a.socket - b.socket);
}

/**
 * Whether the face of slot (cx, cy) toward `d` is outer (rogue game.md §3.5): no slot in its 90° view
 * cone is occupied.
 */
export function outerFace(occupied: (x: number, y: number) => boolean, cx: number, cy: number, d: Dir): boolean {
  const fx = DIR_DX[d];
  const fy = DIR_DY[d];
  for (let y = 0; y < GRID; y++) {
    for (let x = 0; x < GRID; x++) {
      const forward = (x - cx) * fx + (y - cy) * fy;
      if (forward <= 0) continue;
      const lateral = Math.abs((x - cx) * fy - (y - cy) * fx);
      if (lateral <= forward && occupied(x, y)) return false;
    }
  }
  return true;
}

/** Steps 1–10 for one attempt. `n` is the floor's room count (boss included). */
export function layoutFloor(rng: Rng, n: number): LayoutResult {
  const occ = new Int8Array(GRID * GRID).fill(-1);
  const occupied = (x: number, y: number) => inGrid(x, y) && occ[y * GRID + x] >= 0;
  const rooms: LayoutRoom[] = [];
  const place = (shape: RoomShape, ax: number, ay: number, parent: number): number => {
    const i = rooms.length;
    const slots = footprint(shape, ax, ay);
    rooms.push({ kind: 'combat', shape, slots, parent, dist: parent < 0 ? 0 : rooms[parent].dist + 1, doors: [] });
    for (const [x, y] of slots) occ[y * GRID + x] = i;
    return i;
  };
  /** Every 4-neighbor of the footprint outside it is free, except `allowed`. */
  const isolated = (slots: Array<[number, number]>, allowed: readonly [number, number]): boolean => {
    for (const [x, y] of slots) {
      for (let d = 0; d < 4; d++) {
        const nx = x + DIR_DX[d];
        const ny = y + DIR_DY[d];
        if (slots.some(([a, b]) => a === nx && b === ny)) continue;
        if (nx === allowed[0] && ny === allowed[1]) continue;
        if (occupied(nx, ny)) return false;
      }
    }
    return true;
  };
  const fits = (slots: Array<[number, number]>) => slots.every(([x, y]) => inGrid(x, y) && !occupied(x, y));

  // 1. Start.
  const C = n - 1;
  place('1x1', 3, 3, -1);
  rooms[0].kind = 'breach';
  const queue = [0];
  let big2 = 0;
  let rects = 0;

  // 2. Grow.
  grow: while (queue.length > 0 && rooms.length < C) {
    const ri = queue.shift()!;
    const R = rooms[ri];
    for (const c of R.slots) {
      for (let d = 0; d < 4; d++) {
        const nx = c[0] + DIR_DX[d];
        const ny = c[1] + DIR_DY[d];
        if (R.slots.some(([x, y]) => x === nx && y === ny)) continue;
        if (rooms.length >= C) break grow;
        // 2.1
        if (!inGrid(nx, ny) || occupied(nx, ny)) continue;
        // 2.2
        if (rng.next() < SKIP_EXIT) continue;
        // 2.3
        let neighbors = 0;
        for (let k = 0; k < 4; k++) if (occupied(nx + DIR_DX[k], ny + DIR_DY[k])) neighbors++;
        if (neighbors > 1) continue;
        // 2.4
        const u = rng.next();
        let shape: RoomShape = '1x1';
        if (u < BAND_2X2) shape = big2 < MAX_2X2 ? '2x2' : '1x1';
        else if (u < BAND_2X1) shape = rects < MAX_RECT ? '2x1' : '1x1';
        else if (u < BAND_1X2) shape = rects < MAX_RECT ? '1x2' : '1x1';
        // 2.5
        let anchor: [number, number] = [nx, ny];
        if (shape !== '1x1') {
          const [fw, fh] = slotDims(shape);
          let found: [number, number] | null = null;
          for (let ay = ny - fh + 1; ay <= ny && !found; ay++) {
            for (let ax = nx - fw + 1; ax <= nx && !found; ax++) {
              const slots = footprint(shape, ax, ay);
              if (fits(slots) && isolated(slots, c)) found = [ax, ay];
            }
          }
          if (found) {
            anchor = found;
            if (shape === '2x2') big2++;
            else rects++;
          } else shape = '1x1';
        }
        // 2.6
        const ci = place(shape, anchor[0], anchor[1], ri);
        connect(rooms, ci, [nx, ny], ri, c);
        queue.push(ci);
      }
    }
  }

  // 3. Reject.
  if (rooms.length < C) return { ok: false, reason: 'too few rooms' };
  if (big2 < MAX_2X2) return { ok: false, reason: 'no 2x2' };

  // 4. Graph facts: a leaf is a room other than the Breach with exactly one door.
  const isLeaf = (i: number) => i > 0 && rooms[i].doors.length === 1;

  // 5. The Confessional and the boss.
  let best = -1;
  let bestAnchor: [number, number] = [0, 0];
  let bestB: [number, number] = [0, 0];
  for (let li = 0; li < rooms.length; li++) {
    const L = rooms[li];
    if (!isLeaf(li) || L.shape !== '1x1' || L.dist < 3) continue;
    const [lx, ly] = L.slots[0];
    let anchor: [number, number] | null = null;
    let bSlot: [number, number] = [0, 0];
    for (let ay = ly - 2; ay <= ly + 1 && !anchor; ay++) {
      for (let ax = lx - 2; ax <= lx + 1 && !anchor; ax++) {
        const slots = footprint('2x2', ax, ay);
        const b = slots.find(([x, y]) => Math.abs(x - lx) + Math.abs(y - ly) === 1);
        if (!b || !fits(slots) || !isolated(slots, [lx, ly])) continue;
        // The gate wall, the side opposite b's door, is outer on both slots, counting B as placed.
        const back = ((dirTo(b, [lx, ly]) + 2) & 3) as Dir;
        const withB = (x: number, y: number) => occupied(x, y) || slots.some(([a, c]) => a === x && c === y);
        const face = slots.filter(([x, y]) => !slots.some(([a, c]) => a === x + DIR_DX[back] && c === y + DIR_DY[back]));
        if (!face.every(([x, y]) => outerFace(withB, x, y, back))) continue;
        anchor = [ax, ay];
        bSlot = b;
      }
    }
    if (!anchor) continue;
    if (best < 0 || L.dist > rooms[best].dist) {
      best = li;
      bestAnchor = anchor;
      bestB = bSlot;
    }
  }
  if (best < 0) return { ok: false, reason: 'no confessional/boss' };
  const confessional = best;
  rooms[confessional].kind = 'confessional';
  const boss = place('2x2', bestAnchor[0], bestAnchor[1], confessional);
  rooms[boss].kind = 'boss';
  connect(rooms, boss, bestB, confessional, rooms[confessional].slots[0]);

  // 6. The Reliquary.
  const core = (i: number) => i !== boss;
  const reliquaryCands: number[] = [];
  for (let i = 0; i < rooms.length; i++) {
    if (core(i) && i !== confessional && isLeaf(i) && rooms[i].shape !== '2x2' && rooms[i].dist >= 3) reliquaryCands.push(i);
  }
  if (reliquaryCands.length === 0) return { ok: false, reason: 'no reliquary' };
  const reliquary = rng.pick(reliquaryCands);

  // 7. The Pardoner.
  const pardonerCands: number[] = [];
  for (let i = 0; i < rooms.length; i++) {
    if (core(i) && i !== confessional && i !== reliquary && isLeaf(i) && rooms[i].shape === '1x1' && rooms[i].dist >= 2) pardonerCands.push(i);
  }
  if (pardonerCands.length === 0) return { ok: false, reason: 'no pardoner' };
  const pardoner = rng.pick(pardonerCands);
  rooms[pardoner].kind = 'pardoner';

  // 8. Normal combat rooms: every core room but the Breach, the Pardoner and the Confessional.
  const combat: number[] = [];
  for (let i = 1; i < rooms.length; i++) if (core(i) && i !== pardoner && i !== confessional) combat.push(i);
  for (const i of combat) rooms[i].kind = 'combat';

  // 9. Marked rooms.
  const keyCands = combat.filter((i) => i !== reliquary && rooms[i].dist >= 2);
  if (keyCands.length === 0) return { ok: false, reason: 'no key room' };
  const keyRoom = rng.pick(keyCands);
  const mapRoom = rng.pick(combat);
  const bellCands = combat.filter((i) => i !== keyRoom && rooms[i].shape !== '2x2');
  if (bellCands.length < 2) return { ok: false, reason: 'no bells' };
  const bell0 = rng.pick(bellCands);
  const bell1 = rng.pick(bellCands.filter((i) => i !== bell0));

  // 10. Bands.
  for (const i of combat) {
    const d = Math.min(3, rooms[i].dist);
    rooms[i].band = (rooms[i].shape === '2x2' ? Math.max(2, d) : d) as 1 | 2 | 3;
  }

  return { ok: true, layout: { n: rooms.length, rooms, confessional, boss, reliquary, pardoner, keyRoom, mapRoom, bells: [bell0, bell1] } };
}
