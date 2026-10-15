/** Bounded authoritative world drops (game.md §14.12); never pays directly on overflow. */
import { COIN, CURRENCY_LIFETIME, GOLD_HALO, GOLD_HALO_VALUE, PROP_COIN_VALUE, HEAL_MOTE, ORDINARY_PICKUP_CAP, PENDING_PICKUP_CAP, PICKUP_CAP, PICKUP_KIND_COUNT, STRUCTURAL_FIRST, type PickupRecord } from '../data/pickups';
import { TICK_DT } from './constants';
import { lineOfSight } from './los';
import type { GameMap } from './map';
import { moveHorizontal, type Body } from './movement';

export interface Collector { id: number; x: number; y: number; z: number; hp: number; maxHp: number; dead: boolean; connected: boolean; bot: boolean; }
export class Pickups {
  readonly live: PickupRecord[] = [];
  readonly pending: PickupRecord[] = [];
  private nextId = 1;
  forfeitedCoins = 0;
  discardedDrops = 0;
  exhausted = false;
  constructor(readonly map: GameMap, private changed: (p: PickupRecord) => void = () => {}) {}
  floor(x: number, y: number): number { return this.map.floor[Math.floor(y) * this.map.w + Math.floor(x)]; }
  roomAt(x: number, y: number): number {
    const c = Math.floor(x), r = Math.floor(y);
    return c >= 0 && r >= 0 && c < this.map.w && r < this.map.h ? this.map.roomOf[r * this.map.w + c] : 255;
  }
  private fits(p: PickupRecord): boolean {
    return this.live.length < PICKUP_CAP && (p.kind >= STRUCTURAL_FIRST || this.live.filter((q) => q.kind < STRUCTURAL_FIRST).length < ORDINARY_PICKUP_CAP);
  }
  private los(a: { x: number; y: number }, b: { x: number; y: number }): boolean {
    return lineOfSight(this.map, a.x, a.y, this.floor(a.x, a.y) + 0.1, b.x, b.y, this.floor(b.x, b.y) + 0.1);
  }
  /** `lifetime` is in ticks; -1 never fades. */
  drop(kind: number, room: number, x: number, y: number, tick: number, value = kind === GOLD_HALO ? GOLD_HALO_VALUE : kind === COIN ? PROP_COIN_VALUE : 0,
    lifetime = kind <= HEAL_MOTE ? CURRENCY_LIFETIME : -1): PickupRecord | null {
    if (!Number.isInteger(kind) || kind < 0 || kind >= PICKUP_KIND_COUNT || !Number.isFinite(x) || !Number.isFinite(y) ||
      !Number.isInteger(room) || room < 0 || room >= 32 || !Number.isInteger(value) || value < 0 || value > 99) return null;
    const c = Math.floor(x), r = Math.floor(y);
    if (c < 0 || r < 0 || c >= this.map.w || r >= this.map.h || this.map.solid[r * this.map.w + c] || this.roomAt(x, y) !== room) return null;
    if (this.nextId > 0xffffffff) { this.exhausted = true; return null; }
    // A death on the exact fade tick may free space before the ordinary pickup update runs.
    // Never merge new money into an already expired constituent or let expired pending drops steal capacity.
    for (const list of [this.live, this.pending]) for (let i = list.length - 1; i >= 0; i--) {
      if (list[i].expiresTick >= 0 && tick >= list[i].expiresTick) list.splice(i, 1);
    }
    const p: PickupRecord = { id: this.nextId++, kind, room, x, y, value, expiresTick: lifetime < 0 ? -1 : tick + lifetime };
    if (this.fits(p)) { this.live.push(p); this.changed(p); return p; }
    if (kind === COIN || kind === GOLD_HALO) {
      const coin = this.live.find((q) => (q.kind === COIN || q.kind === GOLD_HALO) && q.room === room && q.value + value <= 99 && Math.hypot(q.x - x, q.y - y) <= 3 && this.los(p, q));
      if (coin) { coin.value += value; coin.expiresTick = Math.min(coin.expiresTick, p.expiresTick); this.changed(coin); return coin; }
      this.forfeitedCoins += value;
    } else if (kind < STRUCTURAL_FIRST && this.pending.length < PENDING_PICKUP_CAP) this.pending.push(p);
    else this.discardedDrops++;
    return null;
  }
  /** Eligibility uses accepted feet and supporting floor; hovering sprite height never enters it. */
  eligible(p: PickupRecord, c: Collector, reach: number): boolean {
    if (c.dead || !c.connected || this.roomAt(c.x, c.y) !== p.room || (c.bot && p.kind > HEAL_MOTE) || (p.kind === HEAL_MOTE && c.hp >= c.maxHp)) return false;
    const z = this.floor(p.x, p.y);
    return Math.hypot(c.x - p.x, c.y - p.y, c.z - z) <= reach && lineOfSight(this.map, c.x, c.y, c.z + 0.1, p.x, p.y, z + 0.1);
  }
  update(tick: number, collectors: readonly Collector[], collect: (p: PickupRecord, c: Collector) => boolean): void {
    for (let i = 0; i < this.live.length;) {
      const p = this.live[i];
      if (p.expiresTick >= 0 && tick >= p.expiresTick) { this.live.splice(i, 1); continue; }
      const reach = p.kind === HEAL_MOTE ? 2 : p.kind <= GOLD_HALO ? 4 : 1;
      const candidates = collectors.filter((c) => this.eligible(p, c, reach)).sort((a, b) =>
        Math.hypot(a.x - p.x, a.y - p.y, a.z - this.floor(p.x, p.y)) - Math.hypot(b.x - p.x, b.y - p.y, b.z - this.floor(p.x, p.y)) || a.id - b.id);
      let consumed = false;
      for (const c of candidates) {
        if (p.kind <= HEAL_MOTE) {
          const dx = c.x - p.x, dy = c.y - p.y, distance = Math.hypot(dx, dy);
          if (distance > 0.8) {
            const b: Body = { x: p.x, y: p.y, z: this.floor(p.x, p.y), vz: 0, grounded: true, radius: 0.08, flying: false };
            const step = Math.min(distance, 14 * TICK_DT);
            moveHorizontal(this.map, b, dx / distance * step, dy / distance * step);
            if (this.roomAt(b.x, b.y) === p.room && this.los(p, b)) { p.x = b.x; p.y = b.y; }
          }
        }
        if (this.eligible(p, c, p.kind <= HEAL_MOTE ? 0.8 : 1) && collect(p, c)) { consumed = true; break; }
        // Attraction goes to the nearest eligible collector; no permanent reservation.
        if (p.kind <= HEAL_MOTE) break;
      }
      if (consumed) this.live.splice(i, 1); else i++;
    }
    for (let i = 0; i < this.pending.length;) {
      const p = this.pending[i];
      if (p.expiresTick >= 0 && tick >= p.expiresTick) { this.pending.splice(i, 1); continue; }
      if (!this.fits(p)) break;
      this.pending.splice(i, 1); this.live.push(p); this.changed(p);
    }
  }
}
