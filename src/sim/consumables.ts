/** R03 item authority (rogue game.md §7). A flight owns its area reservation from acceptance to expiry. */
import { BALM_HEAL_FRACTION, CHAIN_BIND_SECONDS, FEATHER_SPEED, ITEMS, PLUME_DAMAGE, SEAL_SHIELD, VENOM_DAMAGE, storeItem, type ItemId } from '../data/items';
import { CLASSES } from '../data/classes';
import { ENEMIES, GATEKEEPER } from '../data/enemies';
import { aimDir, rayCylinder } from './combat';
import { distToCylinder } from './movement';
import { overVoid } from './map';
import { ENEMY_SLOTS, PLAYER_EYE, ROOM_NONE, STEP_UP, TICK_DT } from './constants';
import { lineOfSight, raycastTerrain } from './los';
import type { GameMap } from './map';
import type { Simulation, SimPlayer } from './sim';

/** The global cooldown between successful item uses, 1 s (§7.1). */
const ITEM_COOLDOWN_TICKS = 30;
/** A thrown item flies at 20 m/s for at most 1 s, so it lands within 20 m (§7.2). */
const THROW_SPEED = 20;
const THROW_RANGE = 20;
const THROW_FLIGHT_TICKS = 30;
/** One player owns at most this many item areas at once. */
const OWNER_AREA_CAP = 4;
/** A landing that can't reach its aimed point steps back along the ray in 5 cm steps. */
const LANDING_STEP = 0.05;
/** Bitter Water pulses every 0.5 s, at most once per enemy per pulse. */
const VENOM_PULSE_TICKS = 15;
/** A Mirror Ward's sphere is centred 1 m above its floor. */
const MIRROR_HEIGHT = 1;

export interface ItemEffect {
  id: number; owner: number; item: ItemId; room: number; startTick: number;
  sx: number; sy: number; sz: number; dx: number; dy: number; dz: number;
  bound: number; flightUntil: number; traveled: number;
  x: number; y: number; z: number; activatedTick: number; endTick: number;
}

/** An item effect with the floor cells its area covers and the enemies it has already bound or thrown. */
interface Area extends ItemEffect { cells: Set<number>; attempted: Set<number>; }

/** The walkable floor height at (x, y) inside the room, or null. */
export function itemFloor(map: GameMap, x: number, y: number, room: number): number | null {
  const c = Math.floor(x);
  const r = Math.floor(y);
  const i = r * map.w + c;
  if (c < 0 || r < 0 || c >= map.w || r >= map.h) return null;
  if (map.solid[i] || map.roomOf[i] !== room || overVoid(map, x, y) || !Number.isFinite(map.floor[i])) return null;
  return map.floor[i];
}

/**
 * The floor cells a landed item area covers: a flood from the landing cell over connected floor of its
 * room within the radius box, never up a terrace. The host's authority and the client's drawing share it.
 */
export function itemAreaCells(map: GameMap, x: number, y: number, room: number, radius: number): Set<number> {
  const start = Math.floor(y) * map.w + Math.floor(x);
  const cells = new Set([start]);
  const queue = [start];
  for (let q = 0; q < queue.length; q++) {
    for (const n of [queue[q] - 1, queue[q] + 1, queue[q] - map.w, queue[q] + map.w]) {
      const cx = n % map.w;
      const cy = Math.floor(n / map.w);
      if (cells.has(n) || itemFloor(map, cx + .5, cy + .5, room) === null) continue;
      if (Math.abs(map.floor[n] - map.floor[queue[q]]) > STEP_UP || Math.hypot(cx + .5 - x, cy + .5 - y) > radius + .71) continue;
      cells.add(n);
      queue.push(n);
    }
  }
  return cells;
}

function record(e: Area): ItemEffect {
  const { cells: _c, attempted: _a, ...effect } = e;
  return { ...effect };
}

export class Consumables {
  readonly effects: Area[] = [];
  /** 1 for enemies inside Ash of Stillness this tick. */
  readonly slowed = new Uint8Array(ENEMY_SLOTS);
  private readonly venomAt = new Int32Array(ENEMY_SLOTS).fill(-1000);
  private readonly venomLife = new Uint32Array(ENEMY_SLOTS);
  private nextId = 1;

  constructor(private readonly sim: Simulation) {}

  get flights(): number {
    return this.effects.filter((e) => e.activatedTick < 0).length;
  }

  records(): ItemEffect[] {
    return this.effects.map(record);
  }

  /** Whether the item's effect is already running for this player (it would be refused or replaced). */
  active(p: SimPlayer, item: ItemId): boolean {
    if (item === 'balm') return p.hp >= p.maxHp;
    if (item === 'seal') return p.shield >= SEAL_SHIELD;
    if (item === 'feather') return p.featherUntil > this.sim.tick;
    return this.effects.some((e) => e.owner === p.id && e.item === item);
  }

  pickup(p: SimPlayer, item: ItemId): boolean {
    if (p.bot || p.dead || !p.connected) return false;
    // Contact never spends a consumable. Keep full-inventory drops in the world so the
    // player can choose when to use a charge and come back for it.
    return storeItem(p.inventory, item);
  }

  /** Keys 1 and 2 (§7.1): one charge from the slot when the use succeeds. */
  manual(p: SimPlayer, slot: 0 | 1): void {
    const stack = p.inventory[slot];
    if (!stack || !this.use(p, stack.item)) return;
    if (--stack.count === 0) p.inventory[slot] = null;
    this.sim.publishInventory(p);
  }

  /** One item use; refused uses spend nothing (§7.3). The carried player can't use items (rooms.md §6.3). */
  use(p: SimPlayer, item: ItemId): boolean {
    const sim = this.sim;
    const tick = sim.tick;
    const def = ITEMS[item];
    if (p.bot || p.dead || !p.connected || sim.commanders.carriedBy(p.id) || sim.result) return false;
    if (tick < p.itemReadyTick || this.nextId > 0xffffffff) return false;
    const actionId = this.nextId;
    let effect: Area | undefined;
    if (item === 'balm') {
      if (p.hp >= p.maxHp) return false;
      sim.heal(p, p.maxHp * BALM_HEAL_FRACTION);
    } else if (item === 'seal') {
      if (p.shield >= SEAL_SHIELD) return false;
      sim.giveShield(p, SEAL_SHIELD, def.duration / 30);
      p.sealUntil = tick + def.duration;
    } else if (item === 'feather') {
      p.featherUntil = tick + def.duration;
      p.speed = CLASSES[p.classId].speed + FEATHER_SPEED;
    } else {
      effect = this.launch(p, item, actionId);
      if (!effect) return false;
    }
    this.nextId++;
    p.itemReadyTick = tick + ITEM_COOLDOWN_TICKS;
    const first = !p.itemsTried.includes(item);
    if (first) p.itemsTried.push(item);
    sim.emit('all', { type: 'itemUsed', actionId, playerId: p.id, item, first, instance: effect ? record(effect) : null, x: p.x, y: p.y, z: p.z });
    sim.publishInventory(p);
    return true;
  }

  /** Places or throws an area item; a second use of the same item replaces the first. */
  private launch(p: SimPlayer, item: ItemId, actionId: number): Area | undefined {
    const sim = this.sim;
    const tick = sim.tick;
    const def = ITEMS[item];
    const room = sim.pickups.roomAt(p.x, p.y);
    const ground = this.floor(p.x, p.y, room);
    if (room === ROOM_NONE || ground === null || this.nextId > 0xffffffff) return;
    const previous = this.effects.find((e) => e.owner === p.id && e.item === item);
    if (!previous && this.effects.filter((e) => e.owner === p.id).length >= OWNER_AREA_CAP) return;
    if (def.kind === 'thrown' && !sim.itemProjectileCapacity(previous?.activatedTick === -1)) return;
    const [dx, dy, dz] = aimDir(p.yaw, p.pitch);
    const sz = p.z + PLAYER_EYE;
    const bound = def.kind === 'thrown'
      ? Math.min(raycastTerrain(sim.map, p.x, p.y, sz, dx, dy, dz, THROW_RANGE), this.roomBound(p.x, p.y, dx, dy, THROW_RANGE, room))
      : 0;
    const effect: Area = {
      id: actionId, owner: p.id, item, room, startTick: tick,
      sx: p.x, sy: p.y, sz, dx, dy, dz, bound, flightUntil: tick + THROW_FLIGHT_TICKS, traveled: 0,
      x: p.x, y: p.y, z: ground, activatedTick: -1, endTick: -1, cells: new Set(), attempted: new Set(),
    };
    // The starting projection guarantees a bounded backward fallback even over a void.
    if (!this.landing(effect, bound)) return;
    if (previous) this.remove(previous, 'replacement');
    this.effects.push(effect);
    if (def.kind === 'placed') this.land(effect, 0);
    return effect;
  }

  clearOwner(id: number): void {
    for (const e of [...this.effects]) if (e.owner === id) this.remove(e, 'disconnect');
  }

  /** A cleared room ends its item areas, except the Mirror Ward. */
  clearCombat(room: number): void {
    for (const e of [...this.effects]) if (e.room === room && e.item !== 'mirror') this.remove(e, 'clear');
  }

  clearAll(): void {
    for (const e of [...this.effects]) this.remove(e, 'clear');
  }

  private remove(e: Area, reason: string): void {
    this.effects.splice(this.effects.indexOf(e), 1);
    this.sim.emit('all', { type: 'itemEffectEnded', instanceId: e.id, reason });
  }

  /** The walkable floor height at (x, y) inside the room, or null. */
  private floor(x: number, y: number, room: number): number | null {
    return itemFloor(this.sim.map, x, y, room);
  }

  /** Exact grid crossings along the immutable ray, clipped inside the owning room. */
  roomBound(x: number, y: number, dx: number, dy: number, limit: number, room: number): number {
    let c = Math.floor(x);
    let r = Math.floor(y);
    let traveled = 0;
    while (traveled < limit) {
      const tx = dx > 0 ? (c + 1 - x) / dx : dx < 0 ? (c - x) / dx : Infinity;
      const ty = dy > 0 ? (r + 1 - y) / dy : dy < 0 ? (r - y) / dy : Infinity;
      const next = Math.min(tx, ty);
      if (next >= limit) break;
      // A corner crossing steps both ways.
      if (tx <= ty) c += Math.sign(dx);
      if (ty <= tx) r += Math.sign(dy);
      if (this.sim.pickups.roomAt(c + .5, r + .5) !== room) return Math.max(0, next - .01);
      traveled = next;
    }
    return limit;
  }

  /** The farthest floor point at or before `distance` along the ray that the ray reaches from above. */
  private landing(e: Area, distance: number): { x: number; y: number; z: number } | null {
    for (let d = distance; d >= 0; d = Math.max(0, d - LANDING_STEP)) {
      const x = e.sx + e.dx * d;
      const y = e.sy + e.dy * d;
      const z = this.floor(x, y, e.room);
      if (z !== null && z <= e.sz + e.dz * d + .01) return { x, y, z };
      if (d === 0) break;
    }
    return null;
  }

  private land(e: Area, distance: number): void {
    Object.assign(e, this.landing(e, distance)!);
    e.traveled = distance;
    e.activatedTick = this.sim.tick;
    e.endTick = e.activatedTick + ITEMS[e.item].duration;
    // Flood only the small radius box. An inaccessible terrace never inherits a floor area.
    e.cells = itemAreaCells(this.sim.map, e.x, e.y, e.room, ITEMS[e.item].radius);
    this.sim.emit('all', { type: 'itemEffectActivated', effect: record(e) });
    this.affect(true);
  }

  /** Moves thrown flasks, lands them on the first enemy, wall or bound, expires areas and applies them. */
  update(): void {
    const sim = this.sim;
    this.slowed.fill(0);
    for (const e of [...this.effects]) {
      if (e.activatedTick >= 0) {
        if (sim.tick >= e.endTick) this.remove(e, 'expiry');
        continue;
      }
      const from = e.traveled;
      const end = Math.min(e.bound, from + THROW_SPEED * TICK_DT);
      let hit = end;
      for (let k = 0; k < sim.activeCount; k++) {
        const s = sim.active[k];
        const def = ENEMIES[sim.eType[s]];
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
  membership(): void {
    this.affect(false);
  }

  /** Whether an area holds an enemy: the Mirror's sphere in sight, or a grounded body on the area's cells. */
  private covers(e: Area, s: number): boolean {
    const sim = this.sim;
    const map = sim.map;
    const def = ENEMIES[sim.eType[s]];
    const x = sim.eX[s];
    const y = sim.eY[s];
    const z = sim.eZ[s];
    if (sim.pickups.roomAt(x, y) !== e.room) return false;
    if (e.item === 'mirror') {
      return distToCylinder(e.x, e.y, e.z + MIRROR_HEIGHT, x, y, z, def.radius, def.height) <= ITEMS.mirror.radius &&
        lineOfSight(map, e.x, e.y, e.z + MIRROR_HEIGHT, x, y, z + def.height / 2);
    }
    const cell = Math.floor(y) * map.w + Math.floor(x);
    const grounded = !def.flying || sim.eGrounded[s] === 1 && Math.abs(z - map.floor[cell]) < .05;
    return grounded && Math.abs(z - e.z) <= 1 && e.cells.has(cell) && Math.hypot(x - e.x, y - e.y) <= ITEMS[e.item].radius &&
      lineOfSight(map, e.x, e.y, e.z + .1, x, y, z + .1);
  }

  /** Marks `pooled` and Ash's slow; with `apply`, also Bitter Water pulses and Chain/Plume's one-time control. */
  private affect(apply: boolean): void {
    const sim = this.sim;
    const areas = this.effects.filter((e) => e.activatedTick >= 0 && sim.tick < e.endTick);
    if (!areas.length) return;
    const hits: Array<{ s: number; area: Area }> = [];
    const throws: Array<{ s: number; area: Area }> = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      // Overlapping Bitter Water: only the newest pool pulses (ties by owner, then ID).
      let venom: Area | undefined;
      for (const e of areas) {
        if (!this.covers(e, s)) continue;
        sim.ePooled[s] = 1;
        if (e.item === 'frost' && sim.eType[s] !== GATEKEEPER) this.slowed[s] = 1;
        if (!apply) continue;
        if (e.item === 'venom' && (!venom || newerPool(e, venom))) venom = e;
        if ((e.item === 'chain' || e.item === 'plume') && !e.attempted.has(sim.eIncarnation[s])) {
          e.attempted.add(sim.eIncarnation[s]);
          if (e.item === 'chain') sim.root(s, CHAIN_BIND_SECONDS);
          else if (sim.itemLaunch(s, e.x, e.y)) throws.push({ s, area: e });
        }
      }
      if (!venom || (sim.tick - venom.activatedTick) % VENOM_PULSE_TICKS !== 0) continue;
      if (this.venomLife[s] !== sim.eIncarnation[s] || sim.tick - this.venomAt[s] >= VENOM_PULSE_TICKS) {
        this.venomLife[s] = sim.eIncarnation[s];
        this.venomAt[s] = sim.tick;
        hits.push({ s, area: venom });
      }
    }
    // Damage after the scan: a kill compacts the active list.
    for (const { s, area } of hits) sim.damageEnemy(s, VENOM_DAMAGE, sim.playerById(area.owner)?.index ?? -1, VENOM_DAMAGE, area.x, area.y);
    for (const { s, area } of throws) {
      if (sim.eAlive[s]) sim.damageEnemy(s, PLUME_DAMAGE, sim.playerById(area.owner)?.index ?? -1, PLUME_DAMAGE, area.x, area.y);
    }
  }

  /** The nearest Mirror Ward sphere a projectile ray enters within `max`, in sight of the ward. */
  reflection(x: number, y: number, z: number, dx: number, dy: number, dz: number, max: number): { distance: number; area: ItemEffect } | null {
    let result: { distance: number; area: ItemEffect } | null = null;
    for (const e of this.effects) {
      if (e.item !== 'mirror' || e.activatedTick < 0 || this.sim.tick >= e.endTick) continue;
      const ox = x - e.x;
      const oy = y - e.y;
      const oz = z - e.z - MIRROR_HEIGHT;
      const b = ox * dx + oy * dy + oz * dz;
      const c = ox * ox + oy * oy + oz * oz - ITEMS.mirror.radius ** 2;
      const disc = b * b - c;
      if (disc < 0) continue;
      const distance = c <= 0 ? 0 : -b - Math.sqrt(disc);
      if (distance < 0 || distance > max) continue;
      if (result && (distance > result.distance || distance === result.distance && e.id > result.area.id)) continue;
      const px = x + dx * distance;
      const py = y + dy * distance;
      const pz = z + dz * distance;
      if (this.sim.pickups.roomAt(px, py) !== e.room || !lineOfSight(this.sim.map, e.x, e.y, e.z + MIRROR_HEIGHT, px, py, pz)) continue;
      result = { distance, area: e };
    }
    return result;
  }
}

/** Whether pool `a` takes precedence over `b`: newer first, then the lower owner, then the lower ID. */
function newerPool(a: Area, b: Area): boolean {
  if (a.activatedTick !== b.activatedTick) return a.activatedTick > b.activatedTick;
  return a.owner < b.owner || a.owner === b.owner && a.id < b.id;
}
