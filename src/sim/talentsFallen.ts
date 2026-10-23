/**
 * The Fallen's talents on the host (classes-fallen.md §3–§4): the shotgun and slug with their Delivery
 * and Payload, Weight of Sin and Blasphemer's Ring, the hellfire floor, launches and their landings, and
 * the three alternatives (Gatebreaker, Rain of Fire, Cast Out). The base kit without nodes takes exactly
 * the base paths: the same pellets, random draws, damage, shove and events.
 */
import { BLESSED, ENEMIES, isBossBody } from '../data/enemies';
import { CAST_OUT, FALLEN, GATEBREAKER, RAIN } from '../data/talents';
import {
  KNOCKBACK_TIME, MOVEMENT_GRACE, SECONDARIES, SHOTGUN_CLOSE_DAMAGE, SHOTGUN_KNOCKBACK_DIST, SHOTGUN_KNOCKBACK_RANGE, WEAPONS,
} from '../data/weapons';
import { aimDir, rayCylinder } from './combat';
import { PLAYER_EYE, PLAYER_HEIGHT, PLAYER_RADIUS, TICK_HZ } from './constants';
import { patchCells, spreadCells, FloorFire } from './floorFire';
import type { Landing } from './launches';
import { lineOfSight, raycastTerrain } from './los';
import { distToCylinder } from './movement';
import type { Simulation, SimPlayer } from './sim';
import { reviveHit } from './souls';
import { rainPoint } from './talentGeometry';
import type { Root, Talents } from './talents';

export const F = {
  RED_IRON: 'fallen.a.1a', SIN: 'fallen.a.1b', RANKS: 'fallen.a.2a', UNBOWED: 'fallen.a.2b', UNDERFOOT: 'fallen.a.3b', WRATH: 'fallen.a.cap',
  TREAD: 'fallen.b.1a', KINDLE: 'fallen.b.1b', BRAND: 'fallen.b.2a', PYRE: 'fallen.b.2b', RING: 'fallen.b.3b', PLAIN: 'fallen.b.cap',
  HEAVE: 'fallen.c.1a', SON: 'fallen.c.1b', FELL: 'fallen.c.2a', WORM: 'fallen.c.2b', WINGS: 'fallen.c.3b', STARS: 'fallen.c.cap',
} as const;

const ticks = (s: number) => Math.round(s * TICK_HZ);
const PULSE = 15;

/** Gatebreaker's charge in progress on the host. */
interface Charge {
  start: number;
  /** Release requested (the second press); the charge ends no earlier than its minimum. */
  release: number;
  x: number; y: number; z: number;
  path: number;
  pts: number[];
  lane: Set<number>;
  side: Set<number>;
  root: Root;
  cast: number;
  launched: number[];
}

export class FallenTalents {
  private readonly charges = new Map<number, Charge>();
  private readonly rains: Array<{ owner: number; x: number; y: number; z: number; r: number; start: number; end: number; root: Root }> = [];
  /** Underfoot and Unbowed: the tick each enemy incarnation was last trampled or shoved. */
  private readonly trampled = new Map<number, number>();
  private readonly shoved = new Map<number, number>();
  /** Brimstone Tread: each Fallen's last accepted feet. */
  private readonly treadFrom = new Map<number, [number, number]>();
  /** Wrath of Dis: damage survived toward the next eruption, by player. */
  readonly wrath = new Map<number, number>();
  /** Pyre's carried flame: until tick, and the incarnation it belongs to. */
  private readonly carryUntil: Int32Array;
  private readonly carryInc: Uint32Array;
  /** The Fallen fire budget: the last tick each enemy took a Fallen fire pulse (classes-fallen.md "Hellfire"). */
  private readonly fireTick: Int32Array;
  /** A Third of the Stars: victims already crashed by each cast. */
  private readonly crashed = new Map<number, { tick: number; done: Set<number> }>();

  constructor(private readonly sim: Simulation, private readonly t: Talents, slots: number) {
    this.carryUntil = new Int32Array(slots);
    this.carryInc = new Uint32Array(slots);
    this.fireTick = new Int32Array(slots).fill(-PULSE);
  }

  private has(p: SimPlayer, id: string): boolean {
    return p.classId === 'fallen' && p.kit.active.has(id);
  }

  private fire(p: SimPlayer): FloorFire {
    return this.t.fireOf(p);
  }

  // ------------------------------------------------------------------ the shotgun and the slug

  /**
   * The Brimstone Shotgun (M9 §3.1, M12 §5.1) with Through the Ranks (Delivery), then Heave or Fire and
   * Brimstone (Payload) in place of the survivor shove. Same spread draws per pellet as the base.
   */
  shotgun(p: SimPlayer): void {
    const sim = this.sim, w = WEAPONS.fallen;
    const root = this.t.root(p, 'LMB');
    const ranks = this.has(p, F.RANKS), heave = this.has(p, F.HEAVE), kindle = this.has(p, F.KINDLE);
    const ex = p.x, ey = p.y, ez = p.z + PLAYER_EYE, bodyZ = p.z + PLAYER_HEIGHT / 2;
    const souls = new Set<SimPlayer>(), hitSet = new Set<number>();
    const close = (s: number) => {
      const def = ENEMIES[sim.eType[s]];
      return distToCylinder(p.x, p.y, bodyZ, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) <= SHOTGUN_KNOCKBACK_RANGE;
    };
    const tracers: number[] = [];
    for (let i = 0; i < w.pellets; i++) {
      const yaw = p.yaw + sim.spreadDraw(p, i, 0) * w.spreadYaw;
      const pitch = p.pitch + sim.spreadDraw(p, i, 1) * w.spreadPitch;
      const [dx, dy, dz] = aimDir(yaw, pitch);
      const hits = sim.rayEnemies(ex, ey, ez, dx, dy, dz, w.range, ranks ? 2 : 1);
      let stop = raycastTerrain(sim.map, ex, ey, ez, dx, dy, dz, w.range);
      const struck: number[] = [];
      if (hits.length) {
        const first = hits[0], near = close(first);
        struck.push(first);
        stop = this.rayT(first, ex, ey, ez, dx, dy, dz);
        this.t.primary(root, first, near ? SHOTGUN_CLOSE_DAMAGE : w.damage, near ? Infinity : w.damage);
        // Through the Ranks: a close pellet that killed goes on into the next close enemy.
        if (ranks && near && !sim.eAlive[first] && hits.length > 1 && close(hits[1])) {
          const second = hits[1];
          struck.push(second);
          stop = this.rayT(second, ex, ey, ez, dx, dy, dz);
          tracers.push(ex + dx * this.rayT(first, ex, ey, ez, dx, dy, dz), ey + dy * this.rayT(first, ex, ey, ez, dx, dy, dz), ez + dz * this.rayT(first, ex, ey, ez, dx, dy, dz), ex + dx * stop, ey + dy * stop, ez + dz * stop);
          this.t.primary(root, second, SHOTGUN_CLOSE_DAMAGE, Infinity);
        }
      }
      sim.soulsOnRay(p, ex, ey, ez, dx, dy, dz, stop, souls);
      sim.globesOnRay(p, ex, ey, ez, dx, dy, dz, stop);
      sim.propsOnRay(ex, ey, ez, dx, dy, dz, stop);
      for (const s of struck) hitSet.add(s);
    }
    for (const o of souls) sim.addRevive(o, reviveHit(w.interval, false), p);
    if (tracers.length) this.t.fx(p, 'ranks', tracers);
    if (heave) {
      // Heave: each surviving enemy hit within 12 m flies 3 m away, once per shot (bound ones stay).
      const cast = this.t.launches.newCast(), launched: number[] = [];
      for (const s of hitSet) {
        if (!sim.eAlive[s]) continue;
        const def = ENEMIES[sim.eType[s]];
        if (distToCylinder(p.x, p.y, bodyZ, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) > FALLEN.heaveRange) continue;
        if (this.t.launches.launchFrom(s, p.x, p.y, FALLEN.heave, p, 'weapon', cast)) launched.push(s);
      }
      this.t.launched(p, launched);
    } else if (!kindle) {
      // The base shove: each survivor within 6 m, once per shot, except rooted ones (M9 §3.1).
      for (const s of hitSet) {
        if (!sim.eAlive[s] || sim.isRooted(s) || !close(s)) continue;
        sim.knockAway(s, p.x, p.y, SHOTGUN_KNOCKBACK_DIST, KNOCKBACK_TIME);
      }
    }
    this.t.finish(root);
  }

  private rayT(s: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
    const sim = this.sim, def = ENEMIES[sim.eType[s]];
    return rayCylinder(ox, oy, oz, dx, dy, dz, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height);
  }

  /** Fire and Brimstone's kill bundle: each ground enemy the shotgun killed within 6 m lights its cell 3 s, at most 8. */
  kindleBundle(p: SimPlayer, victims: ReadonlyArray<{ x: number; y: number; z: number }>): void {
    const sim = this.sim, fire = this.fire(p), pts: number[] = [];
    let n = 0;
    for (const v of victims) {
      if (n >= FALLEN.kindleMax) break;
      if (Math.hypot(v.x - p.x, v.y - p.y) > SHOTGUN_KNOCKBACK_RANGE + 0.5) continue;
      const cell = Math.floor(v.y) * sim.map.w + Math.floor(v.x);
      if (Math.abs(sim.map.floor[cell] - v.z) > 0.5) continue;
      if (fire.light(cell, sim.tick + ticks(FALLEN.kindleTime), sim.tick)) { n++; pts.push(v.x, v.y, v.z); }
    }
    this.t.fx(p, 'kindle', pts);
  }

  /**
   * The Brimstone Slug with Brand or Wormwood at its stop point: the struck enemy's feet, or the floor
   * at the wall or floor it hit; nothing when it flies its whole 50 m.
   */
  slug(p: SimPlayer): void {
    const sim = this.sim, w = SECONDARIES.fallen;
    const root = this.t.root(p, 'RMB');
    const ex = p.x, ey = p.y, ez = p.z + PLAYER_EYE;
    const [dx, dy, dz] = aimDir(p.yaw, p.pitch);
    const hits = sim.rayEnemies(ex, ey, ez, dx, dy, dz, w.range, 1);
    const terrain = raycastTerrain(sim.map, ex, ey, ez, dx, dy, dz, w.range);
    let stop = terrain, at: [number, number, number] | null = null;
    if (hits.length) {
      const s = hits[0];
      stop = this.rayT(s, ex, ey, ez, dx, dy, dz);
      at = [sim.eX[s], sim.eY[s], sim.eZ[s]];
    } else if (terrain < w.range - 1e-6) {
      const back = Math.max(0, terrain - 0.05);
      const px = ex + dx * back, py = ey + dy * back, c = Math.floor(px), r = Math.floor(py);
      const f = sim.map.floor[r * sim.map.w + c];
      if (Number.isFinite(f) && !sim.map.solid[r * sim.map.w + c]) at = [px, py, f];
    }
    const souls = new Set<SimPlayer>();
    sim.soulsOnRay(p, ex, ey, ez, dx, dy, dz, stop, souls);
    sim.globesOnRay(p, ex, ey, ez, dx, dy, dz, stop);
    sim.propsOnRay(ex, ey, ez, dx, dy, dz, stop);
    for (const s of hits) this.t.primary(root, s, w.damage, w.damage);
    for (const o of souls) sim.addRevive(o, reviveHit(w.interval, false), p);
    if (at && this.has(p, F.BRAND)) {
      const room = sim.roomAt(at[0], at[1]), end = sim.tick + ticks(FALLEN.brandTime);
      const fire = this.fire(p);
      for (const cell of patchCells(sim.map, at[0], at[1], sim.map.floor[Math.floor(at[1]) * sim.map.w + Math.floor(at[0])], FALLEN.brandRadius, room)) fire.light(cell, end, sim.tick, root);
      this.t.fx(p, 'brand', at);
    }
    if (at && this.has(p, F.WORM)) {
      const cast = this.t.launches.newCast(), launched: number[] = [], room = sim.roomAt(at[0], at[1]);
      const targets: number[] = [];
      for (let k = 0; k < sim.activeCount; k++) {
        const s = sim.active[k];
        if (ENEMIES[sim.eType[s]].flying || Math.hypot(sim.eX[s] - at[0], sim.eY[s] - at[1]) > FALLEN.wormRadius + ENEMIES[sim.eType[s]].radius) continue;
        if (Math.abs(sim.eZ[s] - at[2]) > 1.5 || sim.roomAt(sim.eX[s], sim.eY[s]) !== room) continue;
        if (!lineOfSight(sim.map, at[0], at[1], at[2] + 0.5, sim.eX[s], sim.eY[s], sim.eZ[s] + 0.5)) continue;
        targets.push(s);
      }
      for (const s of targets) if (this.t.launches.launchFrom(s, at[0], at[1], FALLEN.worm, p, 'weapon', cast)) launched.push(s);
      this.t.fx(p, 'wormwood', at);
      this.t.launched(p, launched);
    }
    this.t.finish(root);
  }

  // ------------------------------------------------------------------ Q: Blasphemy's payloads and Cast Out

  /** Blasphemer's Ring: every cell within 4 m of the Fallen burns 5 s (its taunt unchanged). */
  blasphemerRing(p: SimPlayer, root: Root): void {
    const sim = this.sim, cell = Math.floor(p.y) * sim.map.w + Math.floor(p.x);
    const fire = this.fire(p), end = sim.tick + ticks(FALLEN.ringTime);
    for (const c of patchCells(sim.map, p.x, p.y, sim.map.floor[cell], FALLEN.ringRadius, sim.roomAt(p.x, p.y))) fire.light(c, end, sim.tick, root);
    this.t.fx(p, 'fireRing', [p.x, p.y, p.z]);
  }

  /** Cast Out (§4): 10 to every enemy within 10 m and ±45° (±60° with Son of the Morning), thrown 6 m away. */
  castOut(p: SimPlayer): void {
    const sim = this.sim;
    if (p.cdQ > 1e-6) return;
    const root = this.t.root(p, 'Q'), cast = this.t.launches.newCast();
    const ex = p.x, ey = p.y, ez = p.z + PLAYER_EYE, ax = Math.cos(p.yaw), ay = Math.sin(p.yaw);
    const cosMax = Math.cos(this.has(p, F.SON) ? CAST_OUT.wideHalf : CAST_OUT.half);
    const targets: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k], def = ENEMIES[sim.eType[s]];
      if (distToCylinder(ex, ey, ez, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) > CAST_OUT.range) continue;
      const bx = sim.eX[s] - ex, by = sim.eY[s] - ey, len = Math.hypot(bx, by);
      if (len > 1e-9 && (bx * ax + by * ay) / len < cosMax - 1e-9) continue;
      if (!lineOfSight(sim.map, ex, ey, ez, sim.eX[s], sim.eY[s], sim.eZ[s] + def.height / 2)) continue;
      targets.push(s);
    }
    const launched: number[] = [];
    for (const s of targets) {
      this.t.primary(root, s, CAST_OUT.damage, CAST_OUT.damage, p.x, p.y);
      if (!sim.eAlive[s] || isBossBody(sim.eType[s])) continue;
      if (this.t.launches.launchFrom(s, p.x, p.y, CAST_OUT.throw, p, 'qe', cast)) launched.push(s);
    }
    this.t.finish(root);
    p.cdQ = CAST_OUT.cooldown;
    sim.emit('all', { type: 'abilityUsed', playerId: p.id, slot: 'Q', x: p.x, y: p.y, z: p.z, targets: launched });
    this.t.launched(p, launched);
  }

  // ------------------------------------------------------------------ E: Gatebreaker and Rain of Fire

  /** E for Gatebreaker (press starts, the next press releases) and Rain of Fire; false lets Falling Star run. */
  useE(p: SimPlayer): boolean {
    const sim = this.sim;
    if (p.kit.e === 'gatebreaker') {
      const c = this.charges.get(p.id);
      if (c) { c.release = Math.max(sim.tick, c.start + ticks(GATEBREAKER.minTime)); return true; }
      if (p.cdE > MOVEMENT_GRACE + 1e-6) return true;
      sim.commanders.releasePlayer(p.id, false);
      this.charges.set(p.id, { start: sim.tick, release: Infinity, x: p.x, y: p.y, z: p.z, path: 0, pts: [p.x, p.y, p.z], lane: new Set(), side: new Set(),
        root: this.t.root(p, 'E', true), cast: this.t.launches.newCast(), launched: [] });
      // Blocked until the charge ends; its 10 s cooldown starts then (§4).
      p.cdE = GATEBREAKER.maxTime + GATEBREAKER.cooldown;
      p.speedCheckSkipUntil = sim.nowMs + (GATEBREAKER.maxTime + 0.6) * 1000;
      sim.emit('all', { type: 'abilityUsed', playerId: p.id, slot: 'E', x: p.x, y: p.y, z: p.z, targets: [] });
      return true;
    }
    if (p.kit.e === 'rainOfFire') {
      if (p.cdE > 1e-6) return true;
      const [dx, dy, dz] = aimDir(p.yaw, p.pitch);
      const at = rainPoint(sim.map, p.x, p.y, p.z, dx, dy, dz, RAIN.range);
      // An invalid release spends nothing.
      if (!at.valid) return true;
      const r = this.has(p, F.SON) ? RAIN.wide : RAIN.radius, start = sim.tick + ticks(RAIN.delay), end = start + ticks(RAIN.life);
      this.rains.push({ owner: p.id, x: at.x, y: at.y, z: at.z, r, start, end, root: this.t.root(p, 'E') });
      this.t.addArea({ kind: 'rain', playerId: p.id, x: at.x, y: at.y, z: at.z, x1: r, y1: 0, z1: 0, startTick: start, endTick: end });
      p.cdE = RAIN.cooldown;
      sim.emit('all', { type: 'abilityUsed', playerId: p.id, slot: 'E', x: at.x, y: at.y, z: at.z, targets: [] });
      return true;
    }
    return false;
  }

  /** Whether a Fallen is charging (its own accepted movement is the charge's path). */
  charging(p: SimPlayer): boolean {
    return this.charges.has(p.id);
  }

  private updateCharge(p: SimPlayer, c: Charge): void {
    const sim = this.sim;
    const end = p.dead || !p.connected || sim.tick >= c.release || sim.tick - c.start >= ticks(GATEBREAKER.maxTime) + 4;
    let x1 = p.x, y1 = p.y;
    const seg = Math.hypot(x1 - c.x, y1 - c.y);
    // A teleport is not a charge: it cuts nothing and ends the charge.
    if (seg > 12) { this.endCharge(p, c, false); return; }
    const left = GATEBREAKER.maxPath - c.path;
    if (seg > left) { x1 = c.x + (x1 - c.x) * (left / seg); y1 = c.y + (y1 - c.y) * (left / seg); }
    if (seg > 1e-6 && left > 0) this.cut(p, c, c.x, c.y, c.z, x1, y1, p.z, false);
    c.path += Math.min(seg, Math.max(0, left));
    c.x = p.x; c.y = p.y; c.z = p.z;
    if (seg > 0.05) c.pts.push(p.x, p.y, p.z);
    if (end) this.endCharge(p, c, true);
  }

  /**
   * One charge segment: the central 1 m lane takes 40 (head-on bursts); the side band out to 2.5 m
   * (3.5 m with Son of the Morning) takes 10 and is flung 4 m sideways. Each enemy once per charge; the
   * side band tests only what the travelled segment has passed (`terminal` resolves the end cap).
   */
  private cut(p: SimPlayer, c: Charge, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, terminal: boolean): void {
    const sim = this.sim, dx = x1 - x0, dy = y1 - y0, l2 = dx * dx + dy * dy, len = Math.sqrt(l2);
    const ux = len > 1e-9 ? dx / len : Math.cos(p.yaw), uy = len > 1e-9 ? dy / len : Math.sin(p.yaw);
    const side = this.has(p, F.SON) ? GATEBREAKER.sideWide : GATEBREAKER.side;
    const lane: number[] = [], band: Array<[number, number]> = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (c.lane.has(s) || c.side.has(s)) continue;
      const def = ENEMIES[sim.eType[s]];
      if (Math.abs(sim.eZ[s] - (z0 + z1) / 2) > 2 && !def.flying) continue;
      if (def.flying && sim.eZ[s] > Math.max(z0, z1) + PLAYER_HEIGHT) continue;
      const raw = l2 > 1e-12 ? ((sim.eX[s] - x0) * dx + (sim.eY[s] - y0) * dy) / l2 : 0;
      const t = Math.max(0, Math.min(1, raw));
      const d = Math.hypot(x0 + dx * t - sim.eX[s], y0 + dy * t - sim.eY[s]);
      if (d <= GATEBREAKER.lane + def.radius) { lane.push(s); continue; }
      if (d <= side + def.radius && (terminal || raw <= 1) && raw >= 0) band.push([s, ux * (sim.eY[s] - y0) - uy * (sim.eX[s] - x0) >= 0 ? 1 : -1]);
    }
    for (const s of lane) { c.lane.add(s); this.t.primary(c.root, s, GATEBREAKER.damage, Infinity, sim.eX[s] - ux, sim.eY[s] - uy); }
    for (const [s, sign] of band) {
      c.side.add(s);
      this.t.primary(c.root, s, GATEBREAKER.sideDamage, GATEBREAKER.sideDamage, sim.eX[s] + uy * sign, sim.eY[s] - ux * sign);
      if (sim.eAlive[s] && !isBossBody(sim.eType[s]) && this.t.launches.launch(s, -uy * sign, ux * sign, GATEBREAKER.fling, p, 'qe', c.cast)) c.launched.push(s);
    }
    this.t.finish(c.root);
  }

  private endCharge(p: SimPlayer, c: Charge, accepted: boolean): void {
    this.charges.delete(p.id);
    if (accepted) this.cut(p, c, c.x, c.y, c.z, c.x + Math.cos(p.yaw) * 0.01, c.y + Math.sin(p.yaw) * 0.01, c.z, true);
    this.t.finish(c.root);
    // The cooldown starts when the accepted charge ends; a reassignment keeps it (§4).
    p.cdE = GATEBREAKER.cooldown;
    this.t.fx(p, 'charge', c.pts);
    this.t.launched(p, c.launched);
  }

  /** Reassignment, death or room change: a charge in progress ends where it is. */
  playerGone(p: SimPlayer): void {
    const c = this.charges.get(p.id);
    if (c) this.endCharge(p, c, false);
    this.treadFrom.delete(p.id);
    if (p.dead) this.wrath.delete(p.id);
  }

  // ------------------------------------------------------------------ per tick

  update(): void {
    const sim = this.sim;
    for (const p of sim.players) {
      if (p.classId !== 'fallen') continue;
      const c = this.charges.get(p.id);
      if (c) this.updateCharge(p, c);
      if (p.dead || !p.connected || sim.commanders.carriedBy(p.id)) { this.treadFrom.delete(p.id); continue; }
      if (this.has(p, F.TREAD)) this.tread(p); else this.treadFrom.delete(p.id);
      if (this.has(p, F.UNBOWED)) this.unbowed(p);
      if (this.has(p, F.UNDERFOOT)) this.underfoot(p);
    }
    for (let i = this.rains.length - 1; i >= 0; i--) {
      const r = this.rains[i];
      if (sim.tick < r.start) continue;
      this.rains.splice(i, 1);
      const owner = sim.playerById(r.owner);
      if (!owner) continue;
      const fire = this.fire(owner);
      for (const cell of patchCells(sim.map, r.x, r.y, r.z, r.r, sim.roomAt(r.x, r.y))) fire.light(cell, r.end, sim.tick, r.root);
    }
    if (this.trampled.size > 4096) for (const [k, at] of this.trampled) if (sim.tick - at > TICK_HZ) this.trampled.delete(k);
    if (this.shoved.size > 4096) for (const [k, at] of this.shoved) if (sim.tick - at > TICK_HZ) this.shoved.delete(k);
    for (const [cast, c] of this.crashed) if (sim.tick - c.tick > TICK_HZ * 2) this.crashed.delete(cast);
  }

  /**
   * Brimstone Tread: each cell the Fallen steps onto on the ground burns 3 s (secondary). Standing still
   * lights nothing new; the cells crossed since the last tick are lit along the way, so a run leaves no gaps.
   */
  private tread(p: SimPlayer): void {
    const sim = this.sim, map = sim.map, cell = Math.floor(p.y) * map.w + Math.floor(p.x);
    const from = this.treadFrom.get(p.id);
    this.treadFrom.set(p.id, [p.x, p.y]);
    if (Math.abs(p.z - map.floor[cell]) >= 0.3) return;
    const [fx, fy] = from ?? [p.x, p.y];
    const start = Math.floor(fy) * map.w + Math.floor(fx);
    if (from && start === cell) return;
    const fire = this.fire(p), end = sim.tick + ticks(FALLEN.treadTime);
    const len = Math.hypot(p.x - fx, p.y - fy);
    if (!from || len > 3) { fire.light(cell, end, sim.tick); return; }
    const steps = Math.max(1, Math.ceil(len / 0.25));
    let last = start;
    for (let i = 1; i <= steps; i++) {
      const k = Math.floor(fy + (p.y - fy) * (i / steps)) * map.w + Math.floor(fx + (p.x - fx) * (i / steps));
      if (k === last) continue;
      last = k;
      if (Math.abs(map.floor[k] - p.z) < 0.6) fire.light(k, end, sim.tick);
    }
  }

  /** Unbowed: unbound ground enemies pressing ahead are shoved 1 m aside, at most every 0.5 s each. */
  private unbowed(p: SimPlayer): void {
    const sim = this.sim, speed = Math.hypot(p.moveVx, p.moveVy);
    if (speed < 0.5) return;
    const mx = p.moveVx / speed, my = p.moveVy / speed, cosMax = Math.cos(FALLEN.shoveCone);
    const pts: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k], def = ENEMIES[sim.eType[s]];
      if (def.flying || isBossBody(sim.eType[s]) || sim.isRooted(s) || Math.abs(sim.eZ[s] - p.z) > 1.5) continue;
      const bx = sim.eX[s] - p.x, by = sim.eY[s] - p.y, d = Math.hypot(bx, by);
      if (d > PLAYER_RADIUS + def.radius + 0.45 || d < 1e-6 || (bx * mx + by * my) / d < cosMax) continue;
      const key = sim.eIncarnation[s], at = this.shoved.get(key);
      if (at !== undefined && sim.tick - at < ticks(FALLEN.shoveEvery)) continue;
      this.shoved.set(key, sim.tick);
      const side = mx * by - my * bx >= 0 ? 1 : -1;
      sim.knockback(s, -my * side, mx * side, FALLEN.shove, FALLEN.shoveTime);
      pts.push(sim.eX[s], sim.eY[s], sim.eZ[s]);
    }
    this.t.fx(p, 'shove', pts);
  }

  /** Underfoot: slowed ground enemies pressing on the Fallen take 20, at most once per second each. */
  private underfoot(p: SimPlayer): void {
    const sim = this.sim, hits: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k], def = ENEMIES[sim.eType[s]];
      if (def.flying || isBossBody(sim.eType[s]) || !this.t.slowed(s) || Math.abs(sim.eZ[s] - p.z) > 1.5) continue;
      const reach = sim.eType[s] === BLESSED ? 1.2 : PLAYER_RADIUS + def.radius + 0.45;
      if (Math.hypot(sim.eX[s] - p.x, sim.eY[s] - p.y) > reach) continue;
      const key = sim.eIncarnation[s], at = this.trampled.get(key);
      if (at !== undefined && sim.tick - at < ticks(FALLEN.underfootEvery)) continue;
      this.trampled.set(key, sim.tick);
      hits.push(s);
    }
    const pts: number[] = [];
    for (const s of hits) { pts.push(sim.eX[s], sim.eY[s], sim.eZ[s]); sim.damageEnemy(s, FALLEN.underfoot, p.index, Infinity, p.x, p.y); }
    this.t.fx(p, 'underfoot', pts);
  }

  // ------------------------------------------------------------------ fire pulses, Pyre and the Burning Plain

  /** Censed (by any Heretic's incense) or carrying Pyre's flame: the reasons a Pyre owner's fire reaches an enemy off the floor. */
  private pyreBurns(s: number): boolean {
    const sim = this.sim;
    return this.t.censed(s) || (this.carryUntil[s] > sim.tick && this.carryInc[s] === sim.eIncarnation[s]);
  }

  /** The Fallen's fire pulse: 5 every 0.5 s on its own budget, `pooled` while on the burning floor. */
  pools(): void {
    const sim = this.sim;
    for (const p of sim.players) {
      if (p.classId !== 'fallen') continue;
      const fire = this.t.fires.get(p.id);
      const pyre = this.has(p, F.PYRE);
      if (!fire?.cells.size && !pyre) continue;
      const hits: number[] = [];
      for (let k = 0; k < sim.activeCount; k++) {
        const s = sim.active[k];
        if (isBossBody(sim.eType[s])) continue;
        const inFire = !!fire?.at(sim.eX[s], sim.eY[s], sim.eZ[s]);
        if (inFire) {
          sim.ePooled[s] = 1;
          if (pyre) { this.carryUntil[s] = sim.tick + ticks(FALLEN.pyreCarry); this.carryInc[s] = sim.eIncarnation[s]; }
        }
        if (!inFire && !(pyre && this.pyreBurns(s))) continue;
        if (sim.tick - this.fireTick[s] < PULSE) continue;
        this.fireTick[s] = sim.tick;
        hits.push(s);
      }
      const source = p.connected ? p.index : -1;
      for (const s of hits) if (sim.eAlive[s]) sim.damageEnemy(s, FALLEN.fireDamage, source, FALLEN.fireDamage, sim.eX[s], sim.eY[s]);
    }
  }

  /** A credited death (before removal): The Burning Plain spreads from deaths in the owner's fire or Pyre. */
  died(s: number, source: number): void {
    const sim = this.sim;
    if (source < 0) return;
    for (const p of sim.players) {
      if (!this.has(p, F.PLAIN)) continue;
      const fire = this.t.fires.get(p.id);
      const inFire = !!fire?.at(sim.eX[s], sim.eY[s], sim.eZ[s]);
      if (!inFire && !(this.has(p, F.PYRE) && this.pyreBurns(s))) continue;
      const cell = Math.floor(sim.eY[s]) * sim.map.w + Math.floor(sim.eX[s]);
      if (!Number.isFinite(sim.map.floor[cell]) || sim.map.solid[cell]) continue;
      const f = this.fire(p), end = sim.tick + ticks(FALLEN.plainTime);
      for (const c of spreadCells(sim.map, cell)) f.light(c, end, sim.tick);
    }
    this.carryUntil[s] = 0;
    this.fireTick[s] = -PULSE;
  }

  // ------------------------------------------------------------------ the hide

  /** Red Iron: an accepted melee hit the Fallen survives sparks 10 back into the striker. */
  meleeStruck(p: SimPlayer, s: number): void {
    const sim = this.sim;
    if (!this.has(p, F.RED_IRON) || p.dead || !sim.eAlive[s]) return;
    this.t.fx(p, 'redIron', [p.x, p.y, p.z + 1, sim.eX[s], sim.eY[s], sim.eZ[s] + 0.9]);
    sim.damageEnemy(s, FALLEN.redIron, p.index, FALLEN.redIron, p.x, p.y);
  }

  /** Wrath of Dis: HP and shield removed after the Hide fill the ring; crossing 100 erupts once. */
  hurt(p: SimPlayer, removed: number): void {
    const sim = this.sim;
    if (!this.has(p, F.WRATH)) return;
    if (p.dead) { this.wrath.set(p.id, 0); sim.emit(p.id, { type: 'meter', playerId: p.id, kind: 'wrath', value: 0, max: FALLEN.wrathEvery }); return; }
    let v = (this.wrath.get(p.id) ?? 0) + removed;
    if (v >= FALLEN.wrathEvery) {
      v %= FALLEN.wrathEvery;
      const room = sim.roomAt(p.x, p.y), cz = p.z + PLAYER_HEIGHT / 2, targets: number[] = [];
      for (let k = 0; k < sim.activeCount; k++) {
        const s = sim.active[k], def = ENEMIES[sim.eType[s]];
        if (distToCylinder(p.x, p.y, cz, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) > FALLEN.wrathRadius) continue;
        if (sim.roomAt(sim.eX[s], sim.eY[s]) !== room || !lineOfSight(sim.map, p.x, p.y, cz, sim.eX[s], sim.eY[s], sim.eZ[s] + def.height / 2)) continue;
        targets.push(s);
      }
      for (const s of targets) sim.damageEnemy(s, FALLEN.wrathDamage, p.index, Infinity, p.x, p.y);
      this.t.fx(p, 'wrath', [p.x, p.y, p.z]);
    }
    this.wrath.set(p.id, v);
    sim.emit(p.id, { type: 'meter', playerId: p.id, kind: 'wrath', value: Math.round(v), max: FALLEN.wrathEvery });
  }

  // ------------------------------------------------------------------ landings

  /** Controls of a landing (before any landing damage): Broken Wings binds what its owner launched. */
  landControl(l: Landing): void {
    const p = l.owner;
    if (!p || l.kind === 'other' || !this.has(p, F.WINGS) || !this.t.launches.alive(l)) return;
    this.sim.root(l.slot, FALLEN.wingsBind);
  }

  /** Damage of a landing: As We Fell's 20 to the body its owner launched. */
  landDamage(l: Landing): void {
    const p = l.owner;
    if (!p || l.kind === 'other' || !this.has(p, F.FELL) || !this.t.launches.alive(l)) return;
    this.sim.damageEnemy(l.slot, FALLEN.landDamage, p.connected ? p.index : -1, Infinity, l.x, l.y);
  }

  /** A Third of the Stars: a Q/E launch crashes 1.2 m around its landing point; each victim once per cast. */
  landCrash(l: Landing): number[] {
    const sim = this.sim, p = l.owner;
    if (!p || l.kind !== 'qe' || !this.has(p, F.STARS)) return [];
    let entry = this.crashed.get(l.cast);
    if (!entry) { entry = { tick: sim.tick, done: new Set() }; this.crashed.set(l.cast, entry); }
    const done = entry.done;
    const targets: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (s === l.slot || done.has(sim.eIncarnation[s]) || isBossBody(sim.eType[s])) continue;
      const def = ENEMIES[sim.eType[s]];
      if (Math.hypot(sim.eX[s] - l.x, sim.eY[s] - l.y) > FALLEN.crash + def.radius || Math.abs(sim.eZ[s] - l.z) > 1.5) continue;
      if (sim.roomAt(sim.eX[s], sim.eY[s]) !== l.room) continue;
      done.add(sim.eIncarnation[s]);
      targets.push(s);
    }
    for (const s of targets) sim.damageEnemy(s, FALLEN.crashDamage, p.connected ? p.index : -1, Infinity, l.x, l.y);
    return [l.x, l.y, l.z];
  }

  roomCleared(): void {
    this.rains.length = 0;
    this.crashed.clear();
    this.carryUntil.fill(0);
  }
}
