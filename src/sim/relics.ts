/**
 * The host's relic effects (rogue items-relics.md §2, game.md §8). Each human equips two relics; a
 * matched pair turns relic b's effect into its combo. Triggers are queued as immutable events while the
 * tick resolves (a native or direct-item kill with the victim's states sampled before the killing
 * damage, a native attack's fifth distinct victim, a world halo or mote pickup, a successful item use, a
 * streak tier) and evaluated once at the tick's end, in stable relic order, at most one activation per
 * relic per tick, each behind its per-relic cooldown (retained through death, reconnect and re-equip).
 *
 * Effects are secondary: their damage credits the owner (kills, XP, drops) but never starts another
 * relic or talent proc. Rings are one wave. Persistent areas count with the owner's item areas against
 * four; relic projectiles are at most four per owner. Death, leaving and unequipping remove the owner's
 * outgoing relic effects; a cleared room removes those in it.
 */
import { ENEMIES, GATEKEEPER } from '../data/enemies';
import { activeCombo, effectName, RELIC, RELIC_IDS, RELICS, relicEffect, type ComboId, type RelicId } from '../data/relics';
import type { ItemId } from '../data/items';
import type { FloorSync, RelicAreaState, RelicShotState } from '../net/messages';
import { aimDir, rayCylinder } from './combat';
import { PLAYER_EYE, PLAYER_HEIGHT, ROOM_NONE, STEP_UP, TICK_DT, TICK_HZ } from './constants';
import { itemAreaCells, itemFloor } from './consumables';
import { lineOfSight, raycastTerrain } from './los';
import type { Root } from './talents';
import type { GameMap } from './map';
import type { Simulation, SimPlayer } from './sim';

const ticks = (s: number) => Math.round(s * TICK_HZ);
type Effect = RelicId | ComboId;

/** The victim states sampled immediately before the killing damage (§2.4 rule 1). */
export interface VictimStates { taunted: boolean; censed: boolean; bound: boolean; pooled: boolean; slowed: boolean; airborne: boolean }

type RelicEvent =
  | { kind: 'kill'; owner: SimPlayer; input: Root['input'] | 'item'; x: number; y: number; z: number; room: number; states: VictimStates }
  | { kind: 'hits5'; owner: SimPlayer; x: number; y: number; z: number; room: number; hx: number; hy: number }
  | { kind: 'halo' | 'mote'; owner: SimPlayer }
  | { kind: 'item'; owner: SimPlayer; item: ItemId; yaw: number; pitch: number }
  | { kind: 'tier'; owner: SimPlayer };

interface Area extends RelicAreaState { owner: number; room: number; cells: Set<number> }
interface Shot extends Omit<RelicShotState, 'startTick'> {
  startTick: number;
  owner: number; room: number; traveled: number; range: number; damage: number;
  /** One target (embers, the Wheel); `pierce` hits each enemy in its band once (Harrow); `burst` flies to its end and bursts (Counterseal). */
  mode: 'single' | 'pierce' | 'burst';
  cap: number; hit: Set<number>; radius: number;
}
/** A native root's hit-count window for the Comb (§2.2 "Comb's attack"). */
interface Window { tick: number; hits: Set<number>; x: number; y: number; z: number; room: number; hx: number; hy: number; done: boolean }

/** Ticks a movement leg's window stays open after its first positive hit (Shadowstep, the Way Back, Gatebreaker). */
const LEG_WINDOW = ticks(1.5);

export class Relics {
  private nextId = 1;
  readonly areas: Area[] = [];
  readonly shots: Shot[] = [];
  private readonly queue: RelicEvent[] = [];
  private readonly windows = new WeakMap<Root, Window>();

  constructor(private readonly sim: Simulation) {}

  // ------------------------------------------------------------------ loadout

  /** The two equipped relics' effects in slot order: their own, or the combo replacing b. */
  effects(p: SimPlayer): Array<{ relic: RelicId; effect: Effect }> {
    const out: Array<{ relic: RelicId; effect: Effect }> = [];
    for (const id of p.relics) if (id) out.push({ relic: id as RelicId, effect: relicEffect(id as RelicId, p.relics) });
    return out;
  }

  /** Equips a pair (validated by the caller); outgoing effects end, cooldowns stay (§2.3, §2.4 rule 7). */
  equip(p: SimPlayer, relics: [string | null, string | null]): void {
    const before = new Set(this.effects(p).map((e) => e.effect));
    p.relics = [relics[0], relics[1]];
    const after = new Set(this.effects(p).map((e) => e.effect));
    for (const effect of before) if (!after.has(effect)) this.removeEffect(p.id, effect, 'unequipped');
    this.publish(p, 'all');
  }

  /** The owner's relic state: equipped pair, active combo and each slot's cooldown end tick. */
  publish(p: SimPlayer, to: number | 'all' = p.id): void {
    const combo = activeCombo(p.relics);
    this.sim.emit(to, { type: 'relicState', playerId: p.id, relics: [p.relics[0], p.relics[1]], combo: combo?.id ?? null,
      ready: p.relics.map((id) => (id ? p.relicCd[id] ?? 0 : 0)) as [number, number] });
  }

  // ------------------------------------------------------------------ triggers

  /** A credited native or direct-item kill by a living human (from `damageEnemy`). */
  killed(owner: SimPlayer, input: Root['input'] | 'item', slot: number, states: VictimStates): void {
    if (!this.live(owner)) return;
    const sim = this.sim;
    this.queue.push({ kind: 'kill', owner, input, x: sim.eX[slot], y: sim.eY[slot], z: sim.eZ[slot], room: sim.roomAt(sim.eX[slot], sim.eY[slot]), states });
  }

  /** A native positive hit of a root (from `Talents.primary`): five distinct victims in its window is one event. */
  nativeHit(root: Root, s: number): void {
    const sim = this.sim, owner = root.owner;
    if (!owner.relics.includes('comb') || !this.live(owner)) return;
    let w = this.windows.get(root);
    if (!w) {
      // The first positive hit's point; a movement leg's heading is its path so far, else the cast's aim.
      let hx = Math.cos(root.yaw), hy = Math.sin(root.yaw);
      if (root.leg) {
        const dx = sim.eX[s] - root.ox, dy = sim.eY[s] - root.oy, d = Math.hypot(dx, dy);
        if (d > 1e-6) { hx = dx / d; hy = dy / d; }
      }
      w = { tick: sim.tick, hits: new Set(), x: sim.eX[s], y: sim.eY[s], z: sim.eZ[s], room: sim.roomAt(sim.eX[s], sim.eY[s]), hx, hy, done: false };
      this.windows.set(root, w);
    }
    if (w.done || sim.tick - w.tick > (root.leg ? LEG_WINDOW : 0)) return;
    w.hits.add(sim.eIncarnation[s]);
    if (w.hits.size < 5) return;
    w.done = true;
    this.queue.push({ kind: 'hits5', owner, x: w.x, y: w.y, z: w.z, room: w.room, hx: w.hx, hy: w.hy });
  }

  /** A world halo or gold halo, or a heal mote, collected by this human (never a bot's pickup). */
  pickup(owner: SimPlayer, kind: 'halo' | 'mote'): void {
    if (this.live(owner)) this.queue.push({ kind, owner });
  }

  /** A successful item use, with the host's accepted aim at that moment. */
  itemUsed(owner: SimPlayer, item: ItemId): void {
    if (this.live(owner)) this.queue.push({ kind: 'item', owner, item, yaw: owner.yaw, pitch: owner.pitch });
  }

  /** A streak tier crossed by a native or direct-item kill. */
  streakTier(owner: SimPlayer): void {
    if (this.live(owner)) this.queue.push({ kind: 'tier', owner });
  }

  private live(p: SimPlayer): boolean {
    return !p.bot && p.connected && !p.dead && !this.sim.won && (p.relics[0] !== null || p.relics[1] !== null);
  }

  // ------------------------------------------------------------------ per tick

  /** Moves relic projectiles and expires areas; then their slow and pool membership. */
  update(): void {
    const sim = this.sim;
    for (const a of [...this.areas]) if (sim.tick >= a.endTick) this.removeArea(a, 'expired');
    for (const s of [...this.shots]) this.moveShot(s);
  }

  /** After hazards and item areas: every ground enemy on a live relic area is slowed and pooled. */
  membership(): void {
    const sim = this.sim;
    if (!this.areas.length) return;
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      for (const a of this.areas) {
        if (!this.covers(a, s)) continue;
        sim.ePooled[s] = 1;
        sim.slow(s, 2 / TICK_HZ);
      }
    }
  }

  /** Evaluates this tick's events: per owner, relics in stable id order, the first event each can use. */
  flush(): void {
    if (!this.queue.length) return;
    const events = this.queue.splice(0);
    const owners = [...new Set(events.map((e) => e.owner))].sort((a, b) => a.id - b.id);
    for (const p of owners) {
      if (!this.live(p)) continue;
      const mine = events.filter((e) => e.owner === p);
      const slots = this.effects(p).sort((a, b) => RELIC_IDS.indexOf(a.relic) - RELIC_IDS.indexOf(b.relic));
      for (const { relic, effect } of slots) {
        if (this.sim.tick < (p.relicCd[relic] ?? 0)) continue;
        for (const e of mine) {
          const result = this.activate(p, effect, e);
          if (result === 'skip') continue;
          // Created, or refused at the entity cap (which also starts the cooldown, §2.4 rule 5).
          p.relicCd[relic] = this.sim.tick + ticks(RELICS[relic].cooldown);
          this.publish(p);
          break;
        }
      }
    }
  }

  /** One effect's attempt on one event: `skip` when the event doesn't fit or nothing is there to affect. */
  private activate(p: SimPlayer, effect: Effect, e: RelicEvent): 'done' | 'capped' | 'skip' {
    const kill = e.kind === 'kill' ? e : null;
    switch (effect) {
      case 'usher': return kill?.states.taunted ? this.floorArea(p, effect, kill, 'circle', RELIC.usherRadius) : 'skip';
      case 'qseal': return kill?.input === 'Q' ? this.floorArea(p, effect, kill, 'circle', RELIC.runeRadius) : 'skip';
      case 'comb': return e.kind === 'hits5' ? this.floorArea(p, effect, e, 'rect', 0, e.hx, e.hy) : 'skip';
      case 'thurible': return kill?.states.censed ? this.seek(p, effect, kill, RELIC.emberRange, RELIC.emberDamage, RELIC.emberSpeed, RELIC.emberLife, () => true) : 'skip';
      case 'wheel': return kill?.states.slowed ? this.seek(p, effect, kill, RELIC.wheelRange, RELIC.wheelDamage, RELIC.wheelSpeed, RELIC.wheelLife, () => true) : 'skip';
      case 'link': return kill?.states.bound ? this.launchRing(p, effect, kill, RELIC.launchRing) : 'skip';
      case 'eseal': return kill?.input === 'E' ? this.launchRing(p, effect, kill, RELIC.launchRing) : 'skip';
      case 'tile': return kill?.states.pooled ? this.bindRing(p, effect, kill) : 'skip';
      case 'unbroken': return e.kind === 'halo' ? this.launchRing(p, effect, this.feet(p), RELIC.quillRadius) : 'skip';
      case 'mercy': return e.kind === 'mote' ? this.wax(p) : 'skip';
      case 'armageddon': return e.kind === 'tier' ? this.burst(p, effect, p.x, p.y, p.z + PLAYER_HEIGHT / 2, this.sim.roomAt(p.x, p.y), RELIC.choral.radius, RELIC.choral.damage, RELIC.choral.cap) : 'skip';
      case 'sentence3': return e.kind === 'item' ? this.counterseal(p, e.yaw, e.pitch) : 'skip';
      case 'expulsion': return e.kind === 'halo' ? this.expulsion(p) : 'skip';
      case 'abandoned': return e.kind === 'mote' ? this.abandoned(p) : 'skip';
      case 'chorus': return e.kind === 'tier' ? this.chorus(p) : 'skip';
      case 'appeal': return e.kind === 'item' ? this.appeal(p) : 'skip';
      case 'reversal': return kill?.input === 'E' ? this.reversal(p, kill) : 'skip';
      case 'harrow': return kill?.states.slowed ? this.harrow(p) : 'skip';
    }
  }

  // ------------------------------------------------------------------ geometry

  private feet(p: SimPlayer): { x: number; y: number; z: number; room: number } {
    return { x: p.x, y: p.y, z: p.z, room: this.sim.roomAt(p.x, p.y) };
  }

  /**
   * The legal floor below a point in its room (§2.2 "Geometry"): its own cell, else the nearest legal
   * cell within 2 m (ties in row-major order), else null.
   */
  floorOrigin(x: number, y: number, room: number): { x: number; y: number; z: number } | null {
    const map = this.sim.map;
    if (room === ROOM_NONE) return null;
    const own = itemFloor(map, x, y, room);
    if (own !== null) return { x, y, z: own };
    let best: { x: number; y: number; z: number } | null = null, bestD = Infinity;
    for (let r = Math.floor(y - 2); r <= Math.floor(y + 2); r++) for (let c = Math.floor(x - 2); c <= Math.floor(x + 2); c++) {
      const z = itemFloor(map, c + 0.5, r + 0.5, room);
      const d = Math.hypot(c + 0.5 - x, r + 0.5 - y);
      if (z === null || d > 2 || d >= bestD) continue;
      best = { x: c + 0.5, y: r + 0.5, z }; bestD = d;
    }
    return best;
  }

  /** A ground enemy whose feet stand within 1 m of a floor height, in that room (floor effects, §1.1). */
  private grounded(s: number, z: number, room: number): boolean {
    const sim = this.sim, def = ENEMIES[sim.eType[s]];
    if (sim.eType[s] === GATEKEEPER || sim.roomAt(sim.eX[s], sim.eY[s]) !== room) return false;
    if (def.flying && sim.eGrounded[s] !== 1) return false;
    return Math.abs(sim.eZ[s] - z) <= 1;
  }

  /** Up to `cap` eligible enemies nearest a floor origin, horizontally within `r`, in sight; ties by slot. */
  private nearest(x: number, y: number, z: number, room: number, r: number, cap: number, ok: (s: number) => boolean): number[] {
    const sim = this.sim, found: Array<{ s: number; d: number }> = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (!this.grounded(s, z, room) || !ok(s)) continue;
      const d = Math.hypot(sim.eX[s] - x, sim.eY[s] - y);
      if (d > r || !lineOfSight(sim.map, x, y, z + 0.5, sim.eX[s], sim.eY[s], sim.eZ[s] + 0.5)) continue;
      found.push({ s, d });
    }
    found.sort((a, b) => a.d - b.d || a.s - b.s);
    return found.slice(0, cap).map((f) => f.s);
  }

  /** Living enemies whose body center lies within `r` of a 3D point, in sight, nearest first; flyers too. */
  private volume(x: number, y: number, z: number, room: number, r: number, cap: number, ok: (s: number) => boolean = () => true): number[] {
    const sim = this.sim, found: Array<{ s: number; d: number }> = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k], def = ENEMIES[sim.eType[s]];
      if (sim.roomAt(sim.eX[s], sim.eY[s]) !== room || !ok(s)) continue;
      const cz = sim.eZ[s] + def.height / 2, d = Math.hypot(sim.eX[s] - x, sim.eY[s] - y, cz - z);
      if (d > r || !lineOfSight(sim.map, x, y, z, sim.eX[s], sim.eY[s], cz)) continue;
      found.push({ s, d });
    }
    found.sort((a, b) => a.d - b.d || a.s - b.s);
    return found.slice(0, cap).map((f) => f.s);
  }

  private areaCount(owner: number): number {
    return this.areas.filter((a) => a.owner === owner).length + this.sim.items.effects.filter((e) => e.owner === owner).length;
  }

  // ------------------------------------------------------------------ effects

  /** Usher's circle, the First Plea's rune or the Comb: slows and pools ground enemies on it for 4 s. */
  private floorArea(p: SimPlayer, effect: Effect, at: { x: number; y: number; z: number; room: number }, shape: 'circle' | 'rect', radius: number, hx = 1, hy = 0): 'done' | 'capped' | 'skip' {
    const sim = this.sim, o = this.floorOrigin(at.x, at.y, at.room);
    if (!o) return 'skip';
    // A new rune or comb of the same effect replaces the owner's old one, reusing its entitlement.
    const old = this.areas.find((a) => a.owner === p.id && a.effect === effect);
    if (!old && this.areaCount(p.id) >= RELIC.areaCap) return 'capped';
    if (old) this.removeArea(old, 'replaced');
    const cells = shape === 'circle' ? itemAreaCells(sim.map, o.x, o.y, at.room, radius) : this.rectCells(o.x, o.y, o.z, at.room, hx, hy);
    const a: Area = { id: this.nextId++, playerId: p.id, effect, shape, x: o.x, y: o.y, z: o.z, radius, hx, hy,
      length: RELIC.comb.length, width: RELIC.comb.width, startTick: sim.tick, endTick: sim.tick + ticks(RELIC.areaSeconds),
      owner: p.id, room: at.room, cells };
    this.areas.push(a);
    sim.emit('all', { type: 'relicArea', area: this.areaState(a), end: false });
    return 'done';
  }

  private rectCells(x: number, y: number, z: number, room: number, hx: number, hy: number): Set<number> {
    return combCells(this.sim.map, x, y, z, room, hx, hy);
  }

  /** Whether a relic floor area holds an enemy: a ground body on its cells, inside its shape. */
  private covers(a: Area, s: number): boolean {
    const sim = this.sim;
    if (sim.tick >= a.endTick || !this.grounded(s, a.z, a.room)) return false;
    const x = sim.eX[s], y = sim.eY[s];
    if (!a.cells.has(Math.floor(y) * sim.map.w + Math.floor(x))) return false;
    if (a.shape === 'circle') return Math.hypot(x - a.x, y - a.y) <= a.radius;
    const dx = x - a.x, dy = y - a.y;
    return Math.abs(dx * -a.hy + dy * a.hx) <= a.length / 2 && Math.abs(dx * a.hx + dy * a.hy) <= a.width / 2;
  }

  /** Last Link, the Last Plea and the Quill: launch the 24 nearest unbound, grounded survivors 2 m outward. */
  private launchRing(p: SimPlayer, effect: Effect, at: { x: number; y: number; z: number; room: number }, radius: number): 'done' | 'skip' {
    const sim = this.sim, o = this.floorOrigin(at.x, at.y, at.room);
    if (!o) return 'skip';
    const launches = sim.talents.launches;
    const targets = this.nearest(o.x, o.y, o.z, at.room, radius, RELIC.stateRingTargets, (s) => !sim.isRooted(s) && !launches.airborne(s) && sim.eGrounded[s] === 1);
    if (!targets.length) return 'skip';
    // A relic launch never dispatches the landing bundle (§2.4 rule 3).
    const cast = launches.newCast(), launched = targets.filter((s) => launches.launchFrom(s, o.x, o.y, RELIC.launchDistance, p, 'other', cast));
    if (!launched.length) return 'skip';
    sim.talents.launched(p, launched);
    this.fx(p, effect, 'ring', o.x, o.y, o.z, radius, launched);
    return 'done';
  }

  /** Petitioner's Tile: binds the 24 nearest survivors within 2.5 m for 0.5 s. */
  private bindRing(p: SimPlayer, effect: Effect, at: { x: number; y: number; z: number; room: number }): 'done' | 'skip' {
    const sim = this.sim, o = this.floorOrigin(at.x, at.y, at.room);
    if (!o) return 'skip';
    const targets = this.nearest(o.x, o.y, o.z, at.room, RELIC.tileRadius, RELIC.stateRingTargets, () => true);
    if (!targets.length) return 'skip';
    for (const s of targets) { sim.root(s, RELIC.tileBind); sim.streaks.touch(s, p.index); }
    this.fx(p, effect, 'ring', o.x, o.y, o.z, RELIC.tileRadius, targets);
    return 'done';
  }

  /** A one-target projectile toward the nearest enemy within range of the death point, in sight. */
  private seek(p: SimPlayer, effect: Effect, at: { x: number; y: number; z: number; room: number }, range: number, damage: number, speed: number, life: number, ok: (s: number) => boolean): 'done' | 'capped' | 'skip' {
    const z = at.z + 0.9;
    const target = this.volume(at.x, at.y, z, at.room, range, 1, ok)[0];
    if (target === undefined) return 'skip';
    return this.shoot(p, effect, at.x, at.y, z, at.room, target, damage, speed, life);
  }

  private shoot(p: SimPlayer, effect: Effect, x: number, y: number, z: number, room: number, target: number, damage: number, speed: number, life: number): 'done' | 'capped' {
    const sim = this.sim;
    if (this.shots.filter((s) => s.owner === p.id).length >= RELIC.shotCap) return 'capped';
    const tz = sim.eZ[target] + ENEMIES[sim.eType[target]].height / 2;
    const dx = sim.eX[target] - x, dy = sim.eY[target] - y, dz = tz - z, d = Math.hypot(dx, dy, dz) || 1;
    this.addShot({ playerId: p.id, effect, x, y, z, dx: dx / d, dy: dy / d, dz: dz / d, speed, width: 0.3, endTick: sim.tick + ticks(life),
      owner: p.id, room, traveled: 0, range: speed * life, damage, mode: 'single', cap: 1, hit: new Set(), radius: 0 });
    return 'done';
  }

  private addShot(s: Omit<Shot, 'id' | 'startTick'>): void {
    const shot = { ...s, id: this.nextId++, startTick: this.sim.tick } as Shot;
    this.shots.push(shot);
    this.sim.emit('all', { type: 'relicShot', shot: this.shotState(shot), end: false, x: shot.x, y: shot.y, z: shot.z });
  }

  /** Mercy's Wax: 20 shield for 4 s in the one shield channel, refused over a shield of 20 or more. */
  private wax(p: SimPlayer): 'done' | 'skip' {
    if (p.shield >= RELIC.waxShield) return 'skip';
    this.sim.giveShield(p, RELIC.waxShield, RELIC.waxSeconds);
    this.fx(p, 'mercy', 'shield', p.x, p.y, p.z, 1, []);
    return 'done';
  }

  /** A damage burst: the nearest `cap` enemies' body centers within `radius` of a 3D point, in sight. */
  private burst(p: SimPlayer, effect: Effect, x: number, y: number, z: number, room: number, radius: number, damage: number, cap: number, onlyIn?: (s: number) => boolean): 'done' | 'skip' {
    if (room === ROOM_NONE) return 'skip';
    const targets = this.volume(x, y, z, room, radius, cap, onlyIn);
    if (!targets.length) return 'skip';
    this.fx(p, effect, 'burst', x, y, z, radius, targets);
    for (const s of targets) this.sim.relicDamage(s, damage, p, x, y);
    return 'done';
  }

  /** The Counterseal: a stamp along the accepted aim to a wall-limited endpoint ≤ 20 m, bursting there. */
  private counterseal(p: SimPlayer, yaw: number, pitch: number): 'done' | 'capped' | 'skip' {
    const sim = this.sim, room = sim.roomAt(p.x, p.y);
    if (room === ROOM_NONE) return 'skip';
    if (this.shots.filter((s) => s.owner === p.id).length >= RELIC.shotCap) return 'capped';
    const [dx, dy, dz] = aimDir(yaw, pitch);
    const x = p.x, y = p.y, z = p.z + PLAYER_EYE, c = RELIC.counterseal;
    const range = Math.max(0, Math.min(raycastTerrain(sim.map, x, y, z, dx, dy, dz, c.range), sim.items.roomBound(x, y, dx, dy, c.range, room)) - 0.01);
    this.addShot({ playerId: p.id, effect: 'sentence3', x, y, z, dx, dy, dz, speed: c.speed, width: 0.5, endTick: sim.tick + Math.ceil(ticks(range / c.speed)) + 1,
      owner: p.id, room, traveled: 0, range, damage: c.damage, mode: 'burst', cap: c.cap, hit: new Set(), radius: c.radius });
    return 'done';
  }

  /** Order of Expulsion: the nearest taunted ground enemy within 20 m in sight gets the Quill's ring. */
  private expulsion(p: SimPlayer): 'done' | 'skip' {
    const sim = this.sim, room = sim.roomAt(p.x, p.y);
    const target = this.volume(p.x, p.y, p.z + PLAYER_EYE, room, RELIC.expulsionRange, 1,
      (s) => sim.eTauntUntil[s] > sim.tick && !ENEMIES[sim.eType[s]].flying && sim.eType[s] !== GATEKEEPER)[0];
    if (target === undefined) return 'skip';
    return this.launchRing(p, 'expulsion', { x: sim.eX[target], y: sim.eY[target], z: sim.eZ[target], room }, RELIC.launchRing);
  }

  /** Abandoned Mercy: an ember into the nearest censed enemy within 20 m in sight, instead of the Wax. */
  private abandoned(p: SimPlayer): 'done' | 'capped' | 'skip' {
    const sim = this.sim, a = RELIC.abandoned, room = sim.roomAt(p.x, p.y), z = p.z + PLAYER_EYE;
    const target = this.volume(p.x, p.y, z, room, a.range, 1, (s) => sim.talents.censed(s))[0];
    if (target === undefined) return 'skip';
    return this.shoot(p, 'abandoned', p.x, p.y, z, room, target, a.damage, a.speed, a.life);
  }

  /** Broken Chorus: the burst at the nearest airborne enemy within 20 m in sight, instead of around you. */
  private chorus(p: SimPlayer): 'done' | 'skip' {
    const sim = this.sim, c = RELIC.chorus, room = sim.roomAt(p.x, p.y);
    const target = this.volume(p.x, p.y, p.z + PLAYER_EYE, room, c.range, 1, (s) => sim.talents.launches.airborne(s))[0];
    if (target === undefined) return 'skip';
    return this.burst(p, 'chorus', sim.eX[target], sim.eY[target], sim.eZ[target] + ENEMIES[sim.eType[target]].height / 2, room, c.radius, c.damage, c.cap);
  }

  /** Appeal in the Marble: 20 damage to the nearest 16 inside the owner's newest landed item area. */
  private appeal(p: SimPlayer): 'done' | 'skip' {
    const sim = this.sim, room = sim.roomAt(p.x, p.y), c = RELIC.appeal;
    const landed = sim.items.effects.filter((e) => e.owner === p.id && e.activatedTick >= 0 && sim.tick < e.endTick && e.room === room &&
      Math.hypot(e.x - p.x, e.y - p.y) <= c.range).sort((a, b) => b.activatedTick - a.activatedTick || a.id - b.id)[0];
    if (!landed) return 'skip';
    const inside = (s: number) => sim.items.holds(landed, s);
    const targets = this.volume(landed.x, landed.y, landed.z + 1, room, 64, c.cap, inside);
    if (!targets.length) return 'skip';
    this.fx(p, 'appeal', 'burst', landed.x, landed.y, landed.z, 5, targets);
    for (const s of targets) sim.relicDamage(s, c.damage, p, landed.x, landed.y);
    return 'done';
  }

  /** Reversal of Judgment: an E kill launches the 24 nearest on the owner's live First Plea rune, ≤ 20 m away. */
  private reversal(p: SimPlayer, kill: { x: number; y: number; room: number }): 'done' | 'skip' {
    const rune = this.areas.find((a) => a.owner === p.id && a.effect === 'qseal' && a.room === kill.room && Math.hypot(a.x - kill.x, a.y - kill.y) <= RELIC.reversal.range);
    if (!rune) return 'skip';
    return this.launchRing(p, 'reversal', { x: rune.x, y: rune.y, z: rune.z, room: rune.room }, RELIC.reversal.radius);
  }

  /** Harrow of the Host: a 2 m wheel from the owner's live comb along its recorded lane, 12 to each of 12. */
  private harrow(p: SimPlayer): 'done' | 'capped' | 'skip' {
    const comb = this.areas.find((a) => a.owner === p.id && a.effect === 'comb');
    if (!comb) return 'skip';
    if (this.shots.filter((s) => s.owner === p.id).length >= RELIC.shotCap) return 'capped';
    const h = RELIC.harrow, sim = this.sim;
    const z = comb.z + 0.5, range = Math.min(h.range, raycastTerrain(sim.map, comb.x, comb.y, z, comb.hx, comb.hy, 0, h.range), sim.items.roomBound(comb.x, comb.y, comb.hx, comb.hy, h.range, comb.room));
    this.addShot({ playerId: p.id, effect: 'harrow', x: comb.x, y: comb.y, z, dx: comb.hx, dy: comb.hy, dz: 0, speed: h.speed, width: h.width, endTick: sim.tick + Math.ceil(ticks(range / h.speed)) + 1,
      owner: p.id, room: comb.room, traveled: 0, range, damage: h.damage, mode: 'pierce', cap: h.cap, hit: new Set(), radius: 0 });
    return 'done';
  }

  // ------------------------------------------------------------------ projectiles

  private moveShot(s: Shot): void {
    const sim = this.sim, owner = sim.playerById(s.owner);
    if (!owner || !owner.connected || owner.dead) { this.removeShot(s, 'gone'); return; }
    const step = Math.min(s.speed * TICK_DT, s.range - s.traveled);
    const ox = s.x + s.dx * s.traveled, oy = s.y + s.dy * s.traveled, oz = s.z + s.dz * s.traveled;
    if (s.mode === 'burst') {
      s.traveled += step;
      if (s.traveled >= s.range - 1e-6 || sim.tick >= s.endTick) {
        const ex = s.x + s.dx * s.traveled, ey = s.y + s.dy * s.traveled, ez = s.z + s.dz * s.traveled;
        this.removeShot(s, 'burst');
        this.burst(owner, 'sentence3', ex, ey, ez, s.room, s.radius, s.damage, s.cap);
      }
      return;
    }
    if (s.mode === 'single') {
      // The first living enemy on this tick's segment takes the hit; walls and the room's edge end it.
      const wall = Math.min(raycastTerrain(sim.map, ox, oy, oz, s.dx, s.dy, s.dz, step), sim.items.roomBound(ox, oy, s.dx, s.dy, step, s.room));
      let best = -1, bestT = wall;
      for (let k = 0; k < sim.activeCount; k++) {
        const e = sim.active[k], def = ENEMIES[sim.eType[e]];
        const t = rayCylinder(ox, oy, oz, s.dx, s.dy, s.dz, sim.eX[e], sim.eY[e], sim.eZ[e], def.radius + 0.15, def.height);
        if (t >= 0 && t <= bestT) { bestT = t; best = e; }
      }
      s.traveled += bestT;
      if (best >= 0) { this.removeShot(s, 'hit'); sim.relicDamage(best, s.damage, owner, ox, oy); return; }
      if (wall < step - 1e-6 || s.traveled >= s.range - 1e-6 || sim.tick >= s.endTick) this.removeShot(s, 'expired');
      return;
    }
    // Harrow: every ground enemy whose center is within the band of this tick's segment, once each.
    const ex = ox + s.dx * step, ey = oy + s.dy * step, half = s.width / 2;
    const victims: number[] = [];
    for (let k = 0; k < sim.activeCount && s.hit.size + victims.length < s.cap; k++) {
      const e = sim.active[k];
      if (s.hit.has(sim.eIncarnation[e]) || !this.grounded(e, s.z - 0.5, s.room)) continue;
      const px = sim.eX[e] - ox, py = sim.eY[e] - oy, along = px * s.dx + py * s.dy;
      if (along < -half || along > step + half) continue;
      if (Math.abs(px * -s.dy + py * s.dx) > half + ENEMIES[sim.eType[e]].radius) continue;
      s.hit.add(sim.eIncarnation[e]); victims.push(e);
    }
    s.traveled += step;
    for (const e of victims) sim.relicDamage(e, s.damage, owner, ex, ey);
    if (s.traveled >= s.range - 1e-6 || s.hit.size >= s.cap || sim.tick >= s.endTick) this.removeShot(s, 'expired');
  }

  // ------------------------------------------------------------------ lifetime

  private fx(p: SimPlayer, effect: Effect, kind: 'ring' | 'burst' | 'shield', x: number, y: number, z: number, radius: number, slots: number[]): void {
    this.sim.emit('all', { type: 'relicFx', playerId: p.id, effect, kind, x, y, z, radius, slots: [...slots] });
  }

  private areaState(a: Area): RelicAreaState {
    const { owner: _o, room: _r, cells: _c, ...state } = a;
    return { ...state };
  }

  private shotState(s: Shot): RelicShotState {
    return { id: s.id, playerId: s.playerId, effect: s.effect, x: s.x, y: s.y, z: s.z, dx: s.dx, dy: s.dy, dz: s.dz, speed: s.speed, width: s.width, startTick: s.startTick, endTick: s.endTick };
  }

  private removeArea(a: Area, reason: string): void {
    const i = this.areas.indexOf(a);
    if (i < 0) return;
    this.areas.splice(i, 1);
    this.sim.emit('all', { type: 'relicArea', area: this.areaState(a), end: true });
    void reason;
  }

  private removeShot(s: Shot, reason: string): void {
    const i = this.shots.indexOf(s);
    if (i < 0) return;
    this.shots.splice(i, 1);
    const x = s.x + s.dx * s.traveled, y = s.y + s.dy * s.traveled, z = s.z + s.dz * s.traveled;
    this.sim.emit('all', { type: 'relicShot', shot: this.shotState(s), end: true, x, y, z });
    void reason;
  }

  private removeEffect(owner: number, effect: Effect, reason: string): void {
    for (const a of [...this.areas]) if (a.owner === owner && a.effect === effect) this.removeArea(a, reason);
    for (const s of [...this.shots]) if (s.owner === owner && s.effect === effect) this.removeShot(s, reason);
  }

  /** Death or leaving removes the owner's outgoing relic areas and projectiles; cooldowns stay. */
  ownerGone(owner: number): void {
    for (const a of [...this.areas]) if (a.owner === owner) this.removeArea(a, 'gone');
    for (const s of [...this.shots]) if (s.owner === owner) this.removeShot(s, 'gone');
  }

  /** A cleared room ends the relic effects in it. */
  roomCleared(room: number): void {
    for (const a of [...this.areas]) if (a.room === room) this.removeArea(a, 'cleared');
    for (const s of [...this.shots]) if (s.room === room) this.removeShot(s, 'cleared');
  }

  clearAll(): void {
    for (const a of [...this.areas]) this.removeArea(a, 'cleared');
    for (const s of [...this.shots]) this.removeShot(s, 'cleared');
    this.queue.length = 0;
  }

  /** The floorSync fields: live areas and projectiles, and every human's relics and cooldowns. */
  sync(players: readonly SimPlayer[]): Pick<FloorSync, 'relicAreas' | 'relicShots' | 'relicStates'> {
    return {
      relicAreas: this.areas.map((a) => this.areaState(a)),
      relicShots: this.shots.map((s) => this.shotState(s)),
      relicStates: players.filter((p) => !p.bot).map((p) => ({ type: 'relicState' as const, playerId: p.id, relics: [p.relics[0], p.relics[1]] as [string | null, string | null],
        combo: activeCombo(p.relics)?.id ?? null, ready: p.relics.map((id) => (id ? p.relicCd[id] ?? 0 : 0)) as [number, number] })),
    };
  }
}

export { effectName };

/** The Comb's cells: floor cells whose centers lie in the 6 × 2 m rectangle, long axis across the heading. Host and client share it. */
export function combCells(map: GameMap, x: number, y: number, z: number, room: number, hx: number, hy: number): Set<number> {
  const out = new Set<number>();
  const ax = -hy, ay = hx, half = RELIC.comb.length / 2 + 0.5;
  for (let r = Math.floor(y - half); r <= Math.floor(y + half); r++) for (let c = Math.floor(x - half); c <= Math.floor(x + half); c++) {
    const f = itemFloor(map, c + 0.5, r + 0.5, room);
    if (f === null || Math.abs(f - z) > STEP_UP + 0.01) continue;
    const dx = c + 0.5 - x, dy = r + 0.5 - y;
    if (Math.abs(dx * ax + dy * ay) <= RELIC.comb.length / 2 + 0.5 && Math.abs(dx * hx + dy * hy) <= RELIC.comb.width / 2 + 0.5) out.add(r * map.w + c);
  }
  return out;
}
