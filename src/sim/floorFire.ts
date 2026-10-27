/**
 * Class floor fire (classes-fallen.md §3 "Hellfire", classes-heretic.md §3 "Burning ground"): 1 m floor
 * cells that burn until an end tick, per owner. A cell lit again keeps the later end and its first-lit
 * age; at the owner's cap the oldest first-lit cell goes out. Each contribution keeps its own end and
 * root, so a secondary refresh keeps a cell burning without extending a button's kill attribution.
 *
 * Contact uses actual feet: an enemy whose feet are on the burning cell's floor (a hovering Cherub is
 * not). The Fallen's fire pulses on its own per-enemy budget; the Heretic's shares the incense budget.
 * Fire never hurts players or props. Changes are published once per tick as `fire` events and every
 * still-burning cell is in floorSync, so a rejoining client draws the existing fire.
 */
import { ENEMIES, GATEKEEPER } from '../data/enemies';
import { isSolid, type GameMap } from './map';
import { lineOfSight } from './los';
import { TICK_HZ } from './constants';
import type { Root } from './talents';

/** One contribution to a burning cell: until `end`, credited through `root` when it isn't secondary. */
interface Contribution { end: number; root: Root | null }
export interface FireCell { cell: number; z: number; room: number; end: number; parts: Contribution[] }

/** The contact tolerance between an enemy's feet and the burning floor. */
export const FIRE_FEET = 0.3;

export class FloorFire {
  /** Burning cells by cell index, in first-lit order (the eviction order). */
  readonly cells = new Map<number, FireCell>();
  /** Cells whose end changed this tick, for the next `fire` event. */
  private readonly changed = new Map<number, number>();

  constructor(private readonly map: GameMap, readonly ownerId: number, readonly cap: number) {}

  /** Lights a floor cell until `end` (keeping a later end); a new cell over the cap puts out the oldest. */
  light(cell: number, end: number, now: number, root: Root | null = null): boolean {
    const map = this.map;
    if (cell < 0 || cell >= map.w * map.h || map.solid[cell] || !Number.isFinite(map.floor[cell]) || end <= now) return false;
    let c = this.cells.get(cell);
    if (!c) {
      if (this.cells.size >= this.cap) {
        const oldest = this.cells.keys().next().value!;
        this.cells.delete(oldest);
        this.changed.set(oldest, now);
      }
      c = { cell, z: map.floor[cell], room: map.roomOf[cell], end, parts: [] };
      this.cells.set(cell, c);
    }
    c.parts.push({ end, root });
    if (c.parts.length > 4) c.parts.sort((a, b) => b.end - a.end).length = 4;
    if (end > c.end || !this.changed.has(cell)) { c.end = Math.max(c.end, end); this.changed.set(cell, c.end); }
    return true;
  }

  /** Drops the cells and contributions that ended. */
  expire(now: number): void {
    for (const [cell, c] of this.cells) {
      if (c.end <= now) { this.cells.delete(cell); continue; }
      c.parts = c.parts.filter((p) => p.end > now);
    }
  }

  /** The burning cell under feet at (x, y, z), or undefined. */
  at(x: number, y: number, z: number): FireCell | undefined {
    const c = Math.floor(x), r = Math.floor(y);
    if (c < 0 || r < 0 || c >= this.map.w || r >= this.map.h) return undefined;
    const f = this.cells.get(r * this.map.w + c);
    return f && Math.abs(z - f.z) <= FIRE_FEET ? f : undefined;
  }

  /** The newest active primary root of a cell, if any (pulse provenance). */
  static root(c: FireCell): Root | null {
    let best: Contribution | null = null;
    for (const p of c.parts) if (p.root && (!best || p.end > best.end)) best = p;
    return best?.root ?? null;
  }

  /** The changes since the last call: cell indices and their end ticks (an end ≤ now puts it out). */
  flush(): { cells: number[]; ends: number[] } | null {
    if (!this.changed.size) return null;
    const cells = [...this.changed.keys()], ends = cells.map((c) => this.changed.get(c)!);
    this.changed.clear();
    return { cells, ends };
  }

  /** Puts everything out (room clear, owner gone). */
  clear(now: number): void {
    for (const cell of this.cells.keys()) this.changed.set(cell, now);
    this.cells.clear();
  }

  checkpoint(): { cells: number[]; ends: number[] } {
    const cells = [...this.cells.keys()];
    return { cells, ends: cells.map((c) => this.cells.get(c)!.end) };
  }
}

/**
 * The floor cells of a patch: cell centers within `r` of (cx, cy), on the room's floor within 1 m of
 * `cz`, not walls, in sight of the center a little above the floor. Floor-only: no wall or other-floor spread.
 */
export function patchCells(map: GameMap, cx: number, cy: number, cz: number, r: number, room: number): number[] {
  const out: number[] = [];
  for (let row = Math.floor(cy - r); row <= Math.floor(cy + r); row++) {
    for (let col = Math.floor(cx - r); col <= Math.floor(cx + r); col++) {
      if (isSolid(map, col, row)) continue;
      const cell = row * map.w + col, f = map.floor[cell];
      if (!Number.isFinite(f) || Math.abs(f - cz) > 1 || (room >= 0 && map.roomOf[cell] !== room)) continue;
      if (Math.hypot(col + 0.5 - cx, row + 0.5 - cy) > r) continue;
      if (!lineOfSight(map, cx, cy, cz + 0.4, col + 0.5, row + 0.5, f + 0.4)) continue;
      out.push(cell);
    }
  }
  return out;
}

/** A ring of cells: centers between r0 and r1 from the center, otherwise as `patchCells`. */
export function ringCells(map: GameMap, cx: number, cy: number, cz: number, r0: number, r1: number, room: number): number[] {
  return patchCells(map, cx, cy, cz, r1, room).filter((cell) => Math.hypot(cell % map.w + 0.5 - cx, Math.floor(cell / map.w) + 0.5 - cy) >= r0);
}

/** The 3 × 3 connected floor cells around a cell, on its room and floor level (The Burning Plain, The Sixth Circle). */
export function spreadCells(map: GameMap, cell: number): number[] {
  const c0 = cell % map.w, r0 = Math.floor(cell / map.w), z = map.floor[cell], room = map.roomOf[cell];
  const out: number[] = [];
  for (let r = r0 - 1; r <= r0 + 1; r++) for (let c = c0 - 1; c <= c0 + 1; c++) {
    if (isSolid(map, c, r)) continue;
    const k = r * map.w + c;
    if (map.roomOf[k] === room && Math.abs(map.floor[k] - z) <= 0.5) out.push(k);
  }
  return out;
}

/** Whether an enemy's feet can touch the floor fire: not the Gatekeeper, and a Cherub only when brought low. */
export function fireCanTouch(type: number): boolean {
  return type !== GATEKEEPER && !!ENEMIES[type];
}

export const fireTicks = (s: number): number => Math.round(s * TICK_HZ);
