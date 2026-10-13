/** Refiner's Fire: one accepted active-room mask and a bounded shared dry escape cache. */
import type { Rect } from '../data/dungeons/types';
import { PLAYER_SLOTS, TICK_HZ } from './constants';
import { COST_DIAG, COST_ORTHO, FlowField, stepAllowed, UNREACHABLE } from './flowfield';
import type { GameMap } from './map';

export const FIRE_PLAYER_DAMAGE = 7 / TICK_HZ;
export const FIRE_ENEMY_DAMAGE = 35 / TICK_HZ;
export const GROUND_CONTACT_EPSILON = 0.05;
const DX = [1, -1, 0, 0, 1, 1, -1, -1], DY = [0, 0, 1, -1, 1, -1, 1, -1], OPPOSITE = [1, 0, 3, 2, 7, 6, 5, 4];

export class Hazards {
  readonly active: Uint8Array;
  room = -1;
  private readonly cells = new Map<number, number[]>();
  constructor(readonly map: GameMap) {
    this.active = new Uint8Array(map.w * map.h);
    for (let i = 0; i < map.hazard.length; i++) if (map.hazard[i] && map.roomOf[i] !== 255) {
      const room = map.roomOf[i], list = this.cells.get(room) ?? []; list.push(i); this.cells.set(room, list);
    }
  }
  setRoom(room: number): boolean {
    if (!this.cells.has(room)) room = -1;
    if (room === this.room) return false;
    this.room = room; this.active.fill(0);
    for (const i of this.cells.get(room) ?? []) this.active[i] = 1;
    return true;
  }
  cell(x: number, y: number): number {
    const c = Math.floor(x), r = Math.floor(y);
    return c >= 0 && r >= 0 && c < this.map.w && r < this.map.h ? r * this.map.w + c : -1;
  }
  contact(x: number, y: number, z: number, grounded: boolean): boolean {
    if (this.room < 0) return false;
    const i = this.cell(x, y);
    return grounded && i >= 0 && !!this.active[i] && Math.abs(z - this.map.floor[i]) <= GROUND_CONTACT_EPSILON;
  }
}

interface Escape { distance: Int32Array; anchor: Int32Array; next: Int32Array }
export class DryNavigation {
  readonly fields: Array<FlowField | undefined> = [];
  room = -1;
  /** Diagnostics: one build per active room, never one search per enemy. */
  builds = 0;
  private escape: Escape | null = null;
  private clamp: Rect | undefined;
  constructor(readonly map: GameMap, readonly excluded: Uint8Array) {}
  setRoom(room: number): boolean {
    if (room === this.room) return false;
    this.room = room; this.fields.length = 0; this.escape = null; this.clamp = undefined;
    if (room >= 0) {
      const r = this.map.rooms[room].rect;
      this.clamp = { x0: Math.max(0, r.x0 - 4), y0: Math.max(0, r.y0 - 4), x1: Math.min(this.map.w - 1, r.x1 + 4), y1: Math.min(this.map.h - 1, r.y1 + 4) };
      this.escape = this.buildEscape(this.clamp); this.builds++;
    }
    return true;
  }
  release(slot: number): void {
    if (slot >= 0 && slot < this.fields.length) this.fields[slot] = undefined;
    while (this.fields.length && !this.fields[this.fields.length - 1]) this.fields.pop();
  }
  project(cell: number): number {
    if (cell < 0 || cell >= this.excluded.length || this.map.solid[cell]) return -1;
    return this.excluded[cell] ? this.escape?.anchor[cell] ?? -1 : cell;
  }
  escapeStep(cell: number): number { return this.escape?.next[cell] ?? -1; }
  compute(slot: number, c: number, r: number): FlowField | undefined {
    if (slot < 0 || slot >= PLAYER_SLOTS || this.room < 0) return undefined;
    const field = this.fields[slot] ?? (this.fields[slot] = new FlowField(this.map, false, this.excluded));
    const target = c >= 0 && r >= 0 && c < this.map.w && r < this.map.h ? this.project(r * this.map.w + c) : -1;
    field.compute(target < 0 ? -1 : target % this.map.w, target < 0 ? -1 : Math.floor(target / this.map.w), this.clamp);
    return field;
  }
  /** Reverse legal ground edges from every dry seed; path cost, then row-major anchor break ties. */
  private buildEscape(clamp: Rect): Escape {
    const map = this.map, w = map.w, n = w * map.h;
    const distance = new Int32Array(n).fill(UNREACHABLE), anchor = new Int32Array(n).fill(-1), next = new Int32Array(n).fill(-1);
    const buckets: Array<Array<[number, number]>> = Array.from({ length: COST_DIAG + 1 }, () => []);
    let pending = 0;
    const inside = (c: number, r: number) => c >= clamp.x0 && c <= clamp.x1 && r >= clamp.y0 && r <= clamp.y1;
    for (let r = clamp.y0; r <= clamp.y1; r++) for (let c = clamp.x0; c <= clamp.x1; c++) {
      const i = r * w + c;
      if (map.solid[i] || this.excluded[i]) continue;
      distance[i] = 0; anchor[i] = i; buckets[0].push([i, i]); pending++;
    }
    for (let d = 0; pending > 0; d++) {
      const bucket = buckets[d % buckets.length];
      for (let j = 0; j < bucket.length; j++) {
        const [b, owner] = bucket[j]; pending--;
        if (distance[b] !== d || anchor[b] !== owner) continue;
        const bc = b % w, br = Math.floor(b / w);
        for (let k = 0; k < 8; k++) {
          const ac = bc + DX[k], ar = br + DY[k]; if (!inside(ac, ar)) continue;
          const a = ar * w + ac;
          if (map.solid[a] || !stepAllowed(map, ac, ar, OPPOSITE[k], false)) continue;
          const nd = d + (k < 4 ? COST_ORTHO : COST_DIAG);
          if (nd > distance[a] || nd === distance[a] && owner >= anchor[a]) continue;
          distance[a] = nd; anchor[a] = owner; next[a] = b; buckets[nd % buckets.length].push([a, owner]); pending++;
        }
      }
      bucket.length = 0;
    }
    return { distance, anchor, next };
  }
}
