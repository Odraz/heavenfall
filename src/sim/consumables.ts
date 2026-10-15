/** R03 item authority. A flight owns its area reservation from acceptance to expiry. */
import { BALM_HEAL_FRACTION, CHAIN_BIND_SECONDS, FEATHER_SPEED, ITEMS, PLUME_DAMAGE, SEAL_SHIELD, VENOM_DAMAGE, storeItem, type ItemId } from '../data/items';
import { CLASSES } from '../data/classes';
import { ENEMIES, GATEKEEPER } from '../data/enemies';
import { aimDir, rayCylinder } from './combat';
import { distToCylinder } from './movement';
import { overVoid } from './map';
import { ENEMY_SLOTS, PLAYER_EYE, STEP_UP, TICK_DT } from './constants';
import { lineOfSight, raycastTerrain } from './los';
import type { Simulation, SimPlayer } from './sim';

export interface ItemEffect {
  id: number; owner: number; item: ItemId; room: number; startTick: number;
  sx: number; sy: number; sz: number; dx: number; dy: number; dz: number;
  bound: number; flightUntil: number; traveled: number;
  x: number; y: number; z: number; activatedTick: number; endTick: number;
}
interface Area extends ItemEffect { cells: Set<number>; attempted: Set<number>; }
export class Consumables {
  readonly effects: Area[] = [];
  readonly slowed = new Uint8Array(ENEMY_SLOTS);
  private readonly venomAt = new Int32Array(ENEMY_SLOTS).fill(-1000);
  private readonly venomLife = new Uint32Array(ENEMY_SLOTS);
  private nextId = 1;
  constructor(private readonly sim: Simulation) {}
  get flights(): number { return this.effects.filter(e => e.activatedTick < 0).length; }
  records(): ItemEffect[] { return this.effects.map(({ cells: _c, attempted: _a, ...record }) => ({ ...record })); }
  active(p: SimPlayer, item: ItemId): boolean {
    return item === 'balm' ? p.hp >= p.maxHp : item === 'seal' ? p.shield >= SEAL_SHIELD : item === 'feather'
      ? p.featherUntil > this.sim.tick : this.effects.some(e => e.owner === p.id && e.item === item);
  }
  pickup(p: SimPlayer, item: ItemId): boolean {
    if (p.bot || p.dead || !p.connected) return false;
    // Contact never spends a consumable. Keep full-inventory drops in the world so the
    // player can choose when to use a charge and come back for it.
    return storeItem(p.inventory, item);
  }
  manual(p: SimPlayer, slot: 0 | 1): void {
    const stack = p.inventory[slot];
    if (!stack || !this.use(p, stack.item)) return;
    if (--stack.count === 0) p.inventory[slot] = null;
    this.sim.publishInventory(p);
  }
  use(p: SimPlayer, item: ItemId): boolean {
    const sim = this.sim, tick = sim.tick, def = ITEMS[item];
    if (p.bot || p.dead || !p.connected || sim.commanders.carriedBy(p.id) || sim.result || tick < p.itemReadyTick || this.nextId > 0xffffffff) return false;
    const actionId = this.nextId;
    let effect: Area | undefined;
    if (item === 'balm') {
      if (p.hp >= p.maxHp) return false;
      sim.heal(p, p.maxHp * BALM_HEAL_FRACTION);
    } else if (item === 'seal') {
      if (p.shield >= SEAL_SHIELD) return false;
      sim.giveShield(p, SEAL_SHIELD, def.duration / 30); p.sealUntil = tick + def.duration;
    } else if (item === 'feather') {
      p.featherUntil = tick + def.duration; p.speed = CLASSES[p.classId].speed + FEATHER_SPEED;
    } else {
      const room = sim.pickups.roomAt(p.x, p.y), ground = this.floor(p.x, p.y, room);
      if (room === 255 || ground === null || this.nextId > 0xffffffff) return false;
      const previous = this.effects.find(e => e.owner === p.id && e.item === item);
      if (!previous && this.effects.filter(e => e.owner === p.id).length >= 4) return false;
      if (def.kind === 'thrown' && !sim.itemProjectileCapacity(previous?.activatedTick === -1)) return false;
      const [dx, dy, dz] = aimDir(p.yaw, p.pitch), sz = p.z + PLAYER_EYE;
      const bound = def.kind === 'thrown' ? Math.min(raycastTerrain(sim.map, p.x, p.y, sz, dx, dy, dz, 20), this.roomBound(p.x, p.y, dx, dy, 20, room)) : 0;
      effect = { id: actionId, owner: p.id, item, room, startTick: tick,
        sx: p.x, sy: p.y, sz, dx, dy, dz, bound, flightUntil: tick + 30, traveled: 0,
        x: p.x, y: p.y, z: ground, activatedTick: -1, endTick: -1, cells: new Set(), attempted: new Set() };
      // The starting projection guarantees a bounded backward fallback even over a void.
      if (!this.landing(effect, bound)) return false;
      if (previous) this.remove(previous, 'replacement');
      this.effects.push(effect);
      if (def.kind === 'placed') this.land(effect, 0);
    }
    this.nextId++; p.itemReadyTick = tick + 30;
    const first = !p.itemsTried.includes(item); if (first) p.itemsTried.push(item);
    sim.itemEvent({ type: 'itemUsed', actionId, playerId: p.id, item, first, instance: effect ? this.record(effect) : null, x: p.x, y: p.y, z: p.z });
    sim.publishInventory(p); return true;
  }
  private record(e: Area): ItemEffect { const { cells: _c, attempted: _a, ...record } = e; return { ...record }; }
  clearOwner(id: number): void { for (const e of [...this.effects]) if (e.owner === id) this.remove(e, 'disconnect'); }
  clearCombat(room: number): void { for (const e of [...this.effects]) if (e.room === room && e.item !== 'mirror') this.remove(e, 'clear'); }
  clearAll(): void { for (const e of [...this.effects]) this.remove(e, 'clear'); }
  private remove(e: Area, reason: string): void {
    this.effects.splice(this.effects.indexOf(e), 1);
    this.sim.itemEvent({ type: 'itemEffectEnded', instanceId: e.id, reason });
  }
  private floor(x: number, y: number, room: number): number | null {
    const map = this.sim.map, c = Math.floor(x), r = Math.floor(y), i = r * map.w + c;
    return c < 0 || r < 0 || c >= map.w || r >= map.h || map.solid[i] || map.roomOf[i] !== room || overVoid(map, x, y) || !Number.isFinite(map.floor[i]) ? null : map.floor[i];
  }
  /** Exact grid crossings along the immutable ray, clipped inside the owning room. */
  roomBound(x: number, y: number, dx: number, dy: number, limit: number, room: number): number {
    let c = Math.floor(x), r = Math.floor(y), traveled = 0;
    while (traveled < limit) {
      const tx = dx > 0 ? (c + 1 - x) / dx : dx < 0 ? (c - x) / dx : Infinity;
      const ty = dy > 0 ? (r + 1 - y) / dy : dy < 0 ? (r - y) / dy : Infinity;
      const next = Math.min(tx, ty); if (next >= limit) break;
      if (tx <= ty) c += Math.sign(dx); if (ty <= tx) r += Math.sign(dy);
      if (this.sim.pickups.roomAt(c + .5, r + .5) !== room) return Math.max(0, next - .01);
      traveled = next;
    }
    return limit;
  }
  private landing(e: Area, distance: number): { x: number; y: number; z: number } | null {
    for (let d = distance; d >= 0; d = Math.max(0, d - .05)) {
      const x = e.sx + e.dx * d, y = e.sy + e.dy * d, z = this.floor(x, y, e.room);
      if (z !== null && z <= e.sz + e.dz * d + .01) return { x, y, z };
      if (d === 0) break;
    }
    return null;
  }
  private land(e: Area, distance: number): void {
    const point = this.landing(e, distance)!; Object.assign(e, point);
    e.traveled = distance; e.activatedTick = this.sim.tick; e.endTick = e.activatedTick + ITEMS[e.item].duration;
    // Flood only the small radius box. An inaccessible terrace never inherits a floor area.
    const map = this.sim.map, start = Math.floor(e.y) * map.w + Math.floor(e.x), queue = [start]; e.cells.add(start);
    for (let q = 0; q < queue.length; q++) for (const n of [queue[q] - 1, queue[q] + 1, queue[q] - map.w, queue[q] + map.w]) {
      const x = n % map.w, y = Math.floor(n / map.w);
      if (e.cells.has(n) || this.floor(x + .5, y + .5, e.room) === null || Math.abs(map.floor[n] - map.floor[queue[q]]) > STEP_UP ||
        Math.hypot(x + .5 - e.x, y + .5 - e.y) > ITEMS[e.item].radius + .71) continue;
      e.cells.add(n); queue.push(n);
    }
    this.sim.itemEvent({ type: 'itemEffectActivated', effect: this.record(e) });
    this.affect(true);
  }
  update(): void {
    const sim = this.sim; this.slowed.fill(0);
    for (const e of [...this.effects]) {
      if (e.activatedTick >= 0) { if (sim.tick >= e.endTick) this.remove(e, 'expiry'); continue; }
      const from = e.traveled, end = Math.min(e.bound, from + 20 * TICK_DT);
      let hit = end;
      for (let k = 0; k < sim.activeCount; k++) {
        const s = sim.active[k], def = ENEMIES[sim.eType[s]];
        const t = rayCylinder(e.sx + e.dx * from, e.sy + e.dy * from, e.sz + e.dz * from, e.dx, e.dy, e.dz,
          sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height);
        if (t >= 0 && from + t <= hit) hit = from + t;
      }
      e.traveled = hit;
      if (hit < end || end >= e.bound || sim.tick >= e.flightUntil) this.land(e, hit);
    }
    this.affect(true);
  }
  /** Refresh snapshot membership after movement/hazards without repeating controls or pulses. */
  membership(): void { this.affect(false); }
  private covers(e: Area, s: number): boolean {
    const sim = this.sim, map = sim.map, def = ENEMIES[sim.eType[s]], x = sim.eX[s], y = sim.eY[s], z = sim.eZ[s];
    if (sim.pickups.roomAt(x, y) !== e.room) return false;
    if (e.item === 'mirror') return distToCylinder(e.x, e.y, e.z + 1, x, y, z, def.radius, def.height) <= ITEMS.mirror.radius && lineOfSight(map, e.x, e.y, e.z + 1, x, y, z + def.height / 2);
    const cell = Math.floor(y) * map.w + Math.floor(x);
    return (!def.flying || sim.eGrounded[s] === 1 && Math.abs(z - map.floor[cell]) < .05) &&
      Math.abs(z - e.z) <= 1 && e.cells.has(cell) && Math.hypot(x - e.x, y - e.y) <= ITEMS[e.item].radius &&
      lineOfSight(map, e.x, e.y, e.z + .1, x, y, z + .1);
  }
  private affect(apply: boolean): void {
    const sim = this.sim, areas = this.effects.filter(e => e.activatedTick >= 0 && sim.tick < e.endTick);
    if (!areas.length) return;
    const hits: Array<{ s: number; area: Area }> = [], throws: Array<{ s: number; area: Area }> = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k]; let venom: Area | undefined;
      for (const e of areas) {
        if (!this.covers(e, s)) continue;
        sim.ePooled[s] = 1;
        if (e.item === 'frost' && sim.eType[s] !== GATEKEEPER) this.slowed[s] = 1;
        if (!apply) continue;
        if (e.item === 'venom' && (!venom || e.activatedTick > venom.activatedTick || e.activatedTick === venom.activatedTick && (e.owner < venom.owner || e.owner === venom.owner && e.id < venom.id))) venom = e;
        if ((e.item === 'chain' || e.item === 'plume') && !e.attempted.has(sim.eIncarnation[s])) {
          e.attempted.add(sim.eIncarnation[s]);
          if (e.item === 'chain') sim.root(s, CHAIN_BIND_SECONDS); else if (sim.itemLaunch(s, e.x, e.y)) throws.push({ s, area: e });
        }
      }
      if (venom && (sim.tick - venom.activatedTick) % 15 === 0 && (this.venomLife[s] !== sim.eIncarnation[s] || sim.tick - this.venomAt[s] >= 15)) {
        this.venomLife[s] = sim.eIncarnation[s]; this.venomAt[s] = sim.tick; hits.push({ s, area: venom });
      }
    }
    // Damage after the scan: a kill compacts the active list.
    for (const { s, area } of hits) sim.damageEnemy(s, VENOM_DAMAGE, sim.playerById(area.owner)?.index ?? -1, VENOM_DAMAGE, area.x, area.y);
    for (const { s, area } of throws) if (sim.eAlive[s]) sim.damageEnemy(s, PLUME_DAMAGE, sim.playerById(area.owner)?.index ?? -1, PLUME_DAMAGE, area.x, area.y);
  }
  reflection(x: number, y: number, z: number, dx: number, dy: number, dz: number, max: number): { distance: number; area: ItemEffect } | null {
    let result: { distance: number; area: ItemEffect } | null = null;
    for (const e of this.effects) {
      if (e.item !== 'mirror' || e.activatedTick < 0 || this.sim.tick >= e.endTick) continue;
      const ox = x - e.x, oy = y - e.y, oz = z - e.z - 1, b = ox * dx + oy * dy + oz * dz, c = ox * ox + oy * oy + oz * oz - ITEMS.mirror.radius ** 2;
      const disc = b * b - c; if (disc < 0) continue;
      const distance = c <= 0 ? 0 : -b - Math.sqrt(disc);
      if (distance < 0 || distance > max || result && (distance > result.distance || distance === result.distance && e.id > result.area.id)) continue;
      const px = x + dx * distance, py = y + dy * distance, pz = z + dz * distance;
      if (this.sim.pickups.roomAt(px, py) !== e.room || !lineOfSight(this.sim.map, e.x, e.y, e.z + 1, px, py, pz)) continue;
      result = { distance, area: e };
    }
    return result;
  }
}
