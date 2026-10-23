/**
 * The Heretic Saint's talents on the host (classes-heretic.md §3–§4): incense clouds with their shapes
 * (The Altar, Scapegoat, Cloud of Witnesses, Pillar of Cloud), Ploughshares' furrow and the Saint's
 * burning ground, Communion's and the Shroud's payloads, Sacrament's fork, motes (Cunning Folk, Lazarus,
 * Bread of Angels, Resurrection of the Body) and Trial by Fire.
 *
 * One pulse (§3 shared rules): incense, the Saint's fire, the furrow and Pitch share the existing
 * per-enemy incense budget, 5 every 0.5 s. Incense keeps its own cadence (each cloud pulses on its
 * creation tick and every 15 ticks); fire, furrows and Pitch pulse an enemy as soon as its budget allows.
 * Every cloud and furrow is a root of the button that made it, so Kindling collects its kills once.
 */
import { BLESSED, ENEMIES, isBossBody } from '../data/enemies';
import { HEAL_MOTE } from '../data/pickups';
import { BREAD, HERETIC, TRIAL, WITNESSES } from '../data/talents';
import { CLOUD_DAMAGE, CLOUD_MAX, CLOUD_PULSE_TICKS, CLOUD_RADIUS, CLOUD_TIME, SECONDARIES } from '../data/weapons';
import type { PickupRecord } from '../data/pickups';
import type { TalentArea } from '../net/messages';
import { ALLY_NONE } from '../net/protocol';
import { PLAYER_HEIGHT, TICK_HZ } from './constants';
import { walkDestination } from './field';
import { FIRE_FEET, FloorFire, patchCells, ringCells, spreadCells } from './floorFire';
import { lineOfSight } from './los';
import { distToCylinder } from './movement';
import type { Collector } from './pickups';
import type { Simulation, SimPlayer } from './sim';
import { segmentClosest } from './talentGeometry';
import type { Root, Talents } from './talents';

export const H = {
  CUNNING: 'heretic.a.1a', EXORCISM: 'heretic.a.1b', BOTH_KINDS: 'heretic.a.2a', LAZARUS: 'heretic.a.2b', LONG_CHAIN: 'heretic.a.3b', RESURRECTION: 'heretic.a.cap',
  PLOUGH: 'heretic.b.1a', KINDLING: 'heretic.b.1b', PITCH: 'heretic.b.2a', WALL: 'heretic.b.2b', IRONS: 'heretic.b.3b', SIXTH: 'heretic.b.cap',
  STAKE: 'heretic.c.1a', SMOKE: 'heretic.c.1b', ALTAR: 'heretic.c.2a', SCAPEGOAT: 'heretic.c.2b', COMMON: 'heretic.c.3b', PILLAR: 'heretic.c.cap',
} as const;

const ticks = (s: number) => Math.round(s * TICK_HZ);

/**
 * An incense cloud or a burning furrow (§3 "Your clouds"). The base fields are the M9 cloud; the
 * optional ones default to a plain 3 m censer cloud.
 */
export interface HereticCloud {
  x: number; y: number; z: number;
  owner: SimPlayer;
  from: number;
  until: number;
  id?: number;
  radius?: number;
  /** Followed while worn (The Altar, Cloud of Witnesses); null once detached. */
  wearer?: SimPlayer | null;
  wearerRoom?: number;
  wearerTeleport?: number;
  /** A furrow (Ploughshares): fire along x..x1, y..y1, no incense. */
  furrow?: boolean;
  x1?: number; y1?: number;
  /** Cloud of Witnesses' Q cloud (one per caster). */
  witness?: boolean;
  /** An attached LMB cloud (The Altar: one per wearer per Heretic). */
  altar?: boolean;
  root?: Root | null;
  area?: number;
}

interface Bread { owner: SimPlayer; until: number; left: number; area: number }
interface Trial { owner: SimPlayer; until: number; x: number; y: number; room: number; root: Root }
interface Rally { players: Set<number>; until: number }

export class HereticTalents {
  private nextCloud = 1;
  /** Each censer projectile's root (its hit and its cloud are one LMB action). */
  private readonly censerRoots = new Map<number, Root>();
  /** Pitch's ember marks: until tick, and the incarnation and owner they belong to. */
  private readonly pitchUntil: Int32Array;
  private readonly pitchInc: Uint32Array;
  private readonly breads = new Map<number, Bread>();
  private readonly trials = new Map<number, Trial>();
  private readonly rallies: Rally[] = [];
  /** Lazarus: each Heretic's last mote-pickup blast tick, and enemies already hit by a revival cast. */
  private readonly lazarusAt = new Map<number, number>();
  private readonly revivalHit = new Map<number, { tick: number; done: Set<number> }>();

  constructor(private readonly sim: Simulation, private readonly t: Talents, slots: number) {
    this.pitchUntil = new Int32Array(slots);
    this.pitchInc = new Uint32Array(slots);
  }

  private has(p: SimPlayer, id: string): boolean {
    return p.classId === 'heretic' && p.kit.active.has(id);
  }

  private fire(p: SimPlayer): FloorFire {
    return this.t.fireOf(p);
  }

  // ------------------------------------------------------------------ clouds

  /** Whether a cloud's incense reaches an enemy: its sphere, and with Pillar of Cloud an 8 m column in sight. */
  covers(c: HereticCloud, s: number): boolean {
    const sim = this.sim, def = ENEMIES[sim.eType[s]], r = c.radius ?? CLOUD_RADIUS;
    if (distToCylinder(c.x, c.y, c.z, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) <= r) return true;
    if (!this.has(c.owner, H.PILLAR)) return false;
    const floor = sim.map.floor[Math.floor(c.y) * sim.map.w + Math.floor(c.x)];
    const base = Number.isFinite(floor) ? Math.min(floor, c.z) : c.z;
    if (Math.hypot(sim.eX[s] - c.x, sim.eY[s] - c.y) - def.radius > r) return false;
    if (sim.eZ[s] > base + HERETIC.pillar || sim.eZ[s] + def.height < base) return false;
    return lineOfSight(sim.map, c.x, c.y, c.z, sim.eX[s], sim.eY[s], sim.eZ[s] + def.height / 2);
  }

  /** `censed`: inside a live incense cloud, of `owner` when given (game.md §4.11). */
  censed(s: number, owner?: SimPlayer): boolean {
    const sim = this.sim;
    for (const c of sim.clouds) {
      if (c.furrow || sim.tick < c.from || sim.tick >= c.until || (owner && c.owner !== owner)) continue;
      if (this.covers(c, s)) return true;
    }
    return false;
  }

  /** On a furrow's burning strip (feet on its floor). */
  private onFurrow(c: HereticCloud, s: number): boolean {
    const sim = this.sim;
    if (!c.furrow || sim.tick < c.from || sim.tick >= c.until) return false;
    const reach = HERETIC.furrowWidth / 2 + ENEMIES[sim.eType[s]].radius;
    if (segmentClosest(sim.eX[s], sim.eY[s], c.x, c.y, c.x1!, c.y1!).d2 > reach * reach) return false;
    const floor = sim.map.floor[Math.floor(sim.eY[s]) * sim.map.w + Math.floor(sim.eX[s])];
    return Math.abs(sim.eZ[s] - floor) <= FIRE_FEET;
  }

  /** Adds a cloud or furrow: at most 6 per Heretic, the oldest by creation tick (then id) going out. */
  addCloud(c: HereticCloud): HereticCloud {
    const sim = this.sim;
    c.id = this.nextCloud++;
    const own = sim.clouds.filter((o) => o.owner === c.owner);
    if (own.length >= CLOUD_MAX) {
      const oldest = own.reduce((a, b) => (b.from < a.from || (b.from === a.from && (b.id ?? 0) < (a.id ?? 0)) ? b : a));
      this.removeCloud(oldest, 'oldest');
    }
    sim.clouds.push(c);
    c.area = this.t.addArea(this.areaOf(c)).id;
    return c;
  }

  private areaOf(c: HereticCloud): Omit<TalentArea, 'id'> {
    return c.furrow
      ? { kind: 'furrow', playerId: c.owner.id, x: c.x, y: c.y, z: c.z, x1: c.x1!, y1: c.y1!, z1: c.z, startTick: c.from, endTick: c.until }
      : { kind: 'cloud', playerId: c.owner.id, x: c.x, y: c.y, z: c.z, x1: c.radius ?? CLOUD_RADIUS, y1: c.wearer ? c.wearer.id : -1, z1: this.has(c.owner, H.PILLAR) ? 1 : 0, startTick: c.from, endTick: c.until };
  }

  private removeCloud(c: HereticCloud, reason: string): void {
    const sim = this.sim, i = sim.clouds.indexOf(c);
    if (i >= 0) sim.clouds.splice(i, 1);
    if (c.area !== undefined) this.t.endArea(this.t.areas.get(c.area), reason);
  }

  /** A censer projectile's root, made when it's thrown. */
  censerThrown(slot: number, p: SimPlayer): void {
    this.censerRoots.set(slot, this.t.root(p, 'LMB'));
  }

  takeRoot(slot: number): Root | undefined {
    const r = this.censerRoots.get(slot);
    this.censerRoots.delete(slot);
    return r;
  }

  /** The Long Chain: a censer of this player's flies through Blessed. */
  passesBlessed(owner: SimPlayer | undefined, type: number): boolean {
    return !!owner && type === BLESSED && this.has(owner, H.LONG_CHAIN);
  }

  /**
   * A censer broke (after its direct hit): Irons in the Fire pins a pooled survivor; then the LMB Payload
   * makes its area: Ploughshares' furrow, Scapegoat's three clouds, The Altar's worn cloud (with Scapegoat,
   * the middle one), or the base 3 m cloud. (dx, dy) is the censer's horizontal heading at release.
   */
  censerBroke(p: SimPlayer, x: number, y: number, z: number, direct: number, dx: number, dy: number, root: Root): void {
    const sim = this.sim;
    if (direct >= 0 && sim.eAlive[direct] && this.has(p, H.IRONS) && sim.ePooled[direct] && !ENEMIES[sim.eType[direct]].flying && !isBossBody(sim.eType[direct])) {
      sim.root(direct, HERETIC.ironsBind);
      this.t.fx(p, 'irons', [sim.eX[direct], sim.eY[direct], sim.eZ[direct]]);
    }
    const until = sim.tick + ticks(CLOUD_TIME), h = Math.hypot(dx, dy);
    const ux = h > 1e-9 ? dx / h : Math.cos(p.yaw), uy = h > 1e-9 ? dy / h : Math.sin(p.yaw);
    if (this.has(p, H.PLOUGH)) {
      // A 6 m furrow along the heading, centered on the impact; walls and steps clip each half.
      const yaw = Math.atan2(uy, ux), floor = this.floorUnder(x, y, z);
      const [ax, ay] = walkDestination(sim.map, x, y, yaw, HERETIC.furrowLength / 2);
      const [bx, by] = walkDestination(sim.map, x, y, yaw + Math.PI, HERETIC.furrowLength / 2);
      this.addCloud({ x: bx, y: by, z: floor, x1: ax, y1: ay, owner: p, from: sim.tick, until, furrow: true, root });
      return;
    }
    // The Altar and Scapegoat combine (one tree, R06 follow-up §1): the middle cloud is worn, the sides stay.
    const scapegoat = this.has(p, H.SCAPEGOAT);
    let wearer: SimPlayer | undefined;
    const room = sim.roomAt(x, y);
    if (this.has(p, H.ALTAR)) {
      let best = Infinity;
      for (const o of sim.players) {
        if (!sim.livingTargetable(o) || sim.roomAt(o.x, o.y) !== room) continue;
        const d = distToCylinder(x, y, z, o.x, o.y, o.z, 0.4, PLAYER_HEIGHT);
        if (d <= HERETIC.altarReach && d < best) { best = d; wearer = o; }
      }
    }
    if (wearer) {
      for (const c of [...sim.clouds]) if (c.altar && c.owner === p && c.wearer === wearer) this.removeCloud(c, 'replaced');
      this.addCloud({ x: wearer.x, y: wearer.y, z: wearer.z + 0.9, owner: p, from: sim.tick, until, root, altar: true,
        wearer, wearerRoom: room, wearerTeleport: wearer.teleportId });
    } else {
      this.addCloud({ x, y, z, owner: p, from: sim.tick, until, ...(scapegoat ? { radius: HERETIC.scapegoatRadius } : {}), root });
    }
    if (!scapegoat) return;
    const yaw = Math.atan2(uy, ux);
    for (const side of [1, -1]) {
      const [sx, sy] = walkDestination(sim.map, x, y, yaw + side * Math.PI / 2, HERETIC.scapegoatSide);
      // A blocked side's cloud is omitted, never stacked at the center.
      if (Math.hypot(sx - x, sy - y) < HERETIC.scapegoatSide - 0.3) continue;
      this.addCloud({ x: sx, y: sy, z, owner: p, from: sim.tick, until, radius: HERETIC.scapegoatRadius, root });
    }
  }

  private floorUnder(x: number, y: number, z: number): number {
    const f = this.sim.map.floor[Math.floor(y) * this.sim.map.w + Math.floor(x)];
    return Number.isFinite(f) && f <= z + 0.5 ? f : z;
  }

  /**
   * Incense pulses (M9 §2.8, M12 §5.4): each cloud pulses on its creation tick and every 15 ticks after,
   * 5 to each enemy its incense reaches that incense hasn't hurt in the last 15 ticks, credited to the
   * newest pulsing cloud's root. Worn clouds follow their wearer first.
   */
  updateClouds(): void {
    const sim = this.sim;
    for (const c of [...sim.clouds]) if (sim.tick >= c.until) this.removeCloud(c, 'expired');
    for (const c of sim.clouds) if (c.wearer) this.follow(c);
    const pulsing = sim.clouds.filter((c) => !c.furrow && sim.tick >= c.from && (sim.tick - c.from) % CLOUD_PULSE_TICKS === 0);
    if (pulsing.length === 0) return;
    for (const c of pulsing) if (c.owner.connected) sim.props.area(c.x, c.y, c.z, c.radius ?? CLOUD_RADIUS, sim.tick);
    const hits: Array<[number, HereticCloud]> = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (sim.tick - sim.eIncenseTick[s] < CLOUD_PULSE_TICKS) continue;
      for (let i = pulsing.length - 1; i >= 0; i--) {
        if (!this.covers(pulsing[i], s)) continue;
        hits.push([s, pulsing[i]]);
        sim.eIncenseTick[s] = sim.tick;
        break;
      }
    }
    // Applied after the scan: a kill removes the enemy from the active list.
    for (const [s, c] of hits) this.pulse(s, c.owner, c.root ?? null, c.x, c.y);
    for (const c of pulsing) if (c.root) this.t.finish(c.root);
  }

  private pulse(s: number, owner: SimPlayer, root: Root | null, x: number, y: number): void {
    const sim = this.sim;
    if (!sim.eAlive[s]) return;
    if (root && owner.connected) this.t.primary(root, s, CLOUD_DAMAGE, CLOUD_DAMAGE, x, y);
    else sim.damageEnemy(s, CLOUD_DAMAGE, owner.connected ? owner.index : -1, CLOUD_DAMAGE, x, y);
  }

  /** A worn cloud follows its wearer's feet; death, leaving, a teleport or another room detaches it there. */
  private follow(c: HereticCloud): void {
    const sim = this.sim, w = c.wearer!;
    if (w.dead || !w.connected || sim.roomAt(w.x, w.y) !== c.wearerRoom || w.teleportId !== c.wearerTeleport) {
      c.wearer = null;
      const area = c.area !== undefined ? this.t.areas.get(c.area) : undefined;
      if (area) { area.x = c.x; area.y = c.y; area.z = c.z; area.y1 = -1; sim.emit('all', { type: 'talentArea', area: { ...area }, end: false, reason: 'detached' }); }
      return;
    }
    c.x = w.x; c.y = w.y; c.z = w.z + 0.9;
    const area = c.area !== undefined ? this.t.areas.get(c.area) : undefined;
    if (area) { area.x = c.x; area.y = c.y; area.z = c.z; }
  }

  // ------------------------------------------------------------------ Q: Communion's payloads and Cloud of Witnesses

  /**
   * After Communion's heal (the base): Exorcism throws the crowd within 5 m 4 m away; Wall of Fire rings
   * the Saint with fire; Resurrection of the Body raises the souls in reach and rallies motes to the healed.
   * Returns true when Resurrection handled the souls (the base 0.25 progress is replaced).
   */
  communion(p: SimPlayer, healed: number[]): boolean {
    const sim = this.sim;
    if (this.has(p, H.EXORCISM)) {
      const cast = this.t.launches.newCast(), launched: number[] = [], cz = p.z + PLAYER_HEIGHT / 2, targets: number[] = [];
      for (let k = 0; k < sim.activeCount; k++) {
        const s = sim.active[k], def = ENEMIES[sim.eType[s]];
        if (def.flying || isBossBody(sim.eType[s])) continue;
        if (distToCylinder(p.x, p.y, cz, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) > HERETIC.exorcismRadius) continue;
        targets.push(s);
      }
      for (const s of targets) if (this.t.launches.launchFrom(s, p.x, p.y, HERETIC.exorcism, p, 'qe', cast)) launched.push(s);
      this.t.fx(p, 'exorcism', [p.x, p.y, p.z]);
      this.t.launched(p, launched);
    }
    if (this.has(p, H.WALL)) {
      const root = this.t.root(p, 'Q'), fire = this.fire(p), end = sim.tick + ticks(HERETIC.wallTime);
      const floor = this.floorUnder(p.x, p.y, p.z);
      for (const cell of ringCells(sim.map, p.x, p.y, floor, HERETIC.wallRadius - HERETIC.wallWidth / 2, HERETIC.wallRadius + HERETIC.wallWidth / 2, sim.roomAt(p.x, p.y))) fire.light(cell, end, sim.tick, root);
      this.t.fx(p, 'fireRing', [p.x, p.y, p.z]);
    }
    if (!this.has(p, H.RESURRECTION) || p.kit.q !== 'communion') return false;
    const raised: number[] = [];
    for (const o of sim.players) {
      if (o === p || !o.dead || !o.connected) continue;
      if (distToCylinder(p.x, p.y, p.z + PLAYER_HEIGHT / 2, o.x, o.y, sim.soulBase(o), 0.5, 1.6) > 15) continue;
      sim.addRevive(o, Infinity, p);
      if (!o.dead) raised.push(o.x, o.y, o.z);
    }
    this.rallies.push({ players: new Set([...healed, p.id]), until: sim.tick + ticks(HERETIC.rallyTime) });
    this.t.fx(p, 'resurrect', raised);
    return true;
  }

  /** Cloud of Witnesses (§4): a 5 m incense cloud on the aimed ally (40 m, in sight) or the Saint, for 6 s. */
  witnesses(p: SimPlayer): void {
    const sim = this.sim;
    if (p.cdQ > 1e-6) return;
    const ally = p.allyTargetId === ALLY_NONE ? undefined : sim.playerById(p.allyTargetId);
    const valid = ally && ally !== p && sim.livingTargetable(ally) && sim.roomAt(ally.x, ally.y) === sim.roomAt(p.x, p.y) &&
      Math.hypot(ally.x - p.x, ally.y - p.y, ally.z - p.z) <= WITNESSES.range &&
      lineOfSight(sim.map, p.x, p.y, p.z + 1.6, ally.x, ally.y, ally.z + PLAYER_HEIGHT / 2);
    const wearer = valid ? ally! : p;
    for (const c of [...sim.clouds]) if (c.witness && c.owner === p) this.removeCloud(c, 'replaced');
    this.addCloud({ x: wearer.x, y: wearer.y, z: wearer.z + 0.9, owner: p, from: sim.tick, until: sim.tick + ticks(WITNESSES.life), radius: WITNESSES.radius,
      wearer, wearerRoom: sim.roomAt(wearer.x, wearer.y), wearerTeleport: wearer.teleportId, witness: true, root: this.t.root(p, 'Q') });
    p.cdQ = WITNESSES.cooldown;
    sim.emit('all', { type: 'abilityUsed', playerId: p.id, slot: 'Q', x: wearer.x, y: wearer.y, z: wearer.z, targets: [wearer.id] });
  }

  // ------------------------------------------------------------------ E: the Shroud's payload, Bread of Angels, Trial by Fire

  /** The Stake: a broken Shroud binds surviving ground enemies within 3.5 m of the wearer for 1.5 s, instead of its burst. */
  stake(caster: SimPlayer, x: number, y: number, z: number): boolean {
    const sim = this.sim;
    if (!this.has(caster, H.STAKE)) return false;
    const cz = z + PLAYER_HEIGHT / 2, room = sim.roomAt(x, y), bound: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k], def = ENEMIES[sim.eType[s]];
      if (def.flying || isBossBody(sim.eType[s])) continue;
      if (distToCylinder(x, y, cz, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) > HERETIC.stakeRadius) continue;
      if (sim.roomAt(sim.eX[s], sim.eY[s]) !== room || !lineOfSight(sim.map, x, y, cz, sim.eX[s], sim.eY[s], sim.eZ[s] + def.height / 2)) continue;
      bound.push(s);
    }
    for (const s of bound) sim.root(s, HERETIC.stakeBind);
    this.t.fx(caster, 'stake', [x, y, z], bound);
    return true;
  }

  /** E for Bread of Angels and Trial by Fire; false lets Martyr's Shroud run. */
  useE(p: SimPlayer): boolean {
    const sim = this.sim;
    if (p.kit.e === 'breadOfAngels') {
      if (p.cdE > 1e-6) return true;
      this.endBread(p.id);
      const area = this.t.addArea({ kind: 'bread', playerId: p.id, x: p.x, y: p.y, z: p.z, x1: BREAD.radius, y1: BREAD.motes, z1: 0, startTick: sim.tick, endTick: sim.tick + ticks(BREAD.life) });
      this.breads.set(p.id, { owner: p, until: sim.tick + ticks(BREAD.life), left: BREAD.motes, area: area.id });
      p.cdE = BREAD.cooldown;
      sim.emit('all', { type: 'abilityUsed', playerId: p.id, slot: 'E', x: p.x, y: p.y, z: p.z, targets: [] });
      return true;
    }
    if (p.kit.e === 'trialByFire') {
      if (p.cdE > 1e-6) return true;
      const root = this.t.root(p, 'E');
      this.trials.set(p.id, { owner: p, until: sim.tick + ticks(TRIAL.life), x: p.x, y: p.y, room: sim.roomAt(p.x, p.y), root });
      this.paint(p, root, p.x, p.y, p.x, p.y);
      p.cdE = TRIAL.cooldown;
      sim.emit('all', { type: 'abilityUsed', playerId: p.id, slot: 'E', x: p.x, y: p.y, z: p.z, targets: [] });
      return true;
    }
    return false;
  }

  private endBread(id: number): void {
    const b = this.breads.get(id);
    if (!b) return;
    this.breads.delete(id);
    this.t.endArea(this.t.areas.get(b.area), 'ended');
  }

  /** Trial by Fire: walkable cells within 1.5 m of a grounded segment burn until 4 s after painting. */
  private paint(p: SimPlayer, root: Root, x0: number, y0: number, x1: number, y1: number): void {
    const sim = this.sim, fire = this.fire(p), end = sim.tick + ticks(TRIAL.burn), room = sim.roomAt(x1, y1);
    const len = Math.hypot(x1 - x0, y1 - y0), steps = Math.max(1, Math.ceil(len / 0.75));
    const floor = this.floorUnder(x1, y1, p.z);
    const seen = new Set<number>();
    for (let i = 0; i <= steps; i++) {
      const x = x0 + (x1 - x0) * (i / steps), y = y0 + (y1 - y0) * (i / steps);
      for (const cell of patchCells(sim.map, x, y, floor, TRIAL.radius, room)) {
        if (seen.has(cell)) continue;
        seen.add(cell);
        fire.light(cell, end, sim.tick, root);
      }
    }
  }

  // ------------------------------------------------------------------ RMB: In Both Kinds

  /** In Both Kinds: Sacrament's heal forks to the nearest other living ally within 10 m of the healed one, never the Saint. */
  fork(p: SimPlayer, ally: SimPlayer): void {
    const sim = this.sim;
    if (!this.has(p, H.BOTH_KINDS) || ally.dead) return;
    const room = sim.roomAt(ally.x, ally.y);
    let second: SimPlayer | undefined, best = Infinity;
    for (const o of sim.players) {
      if (o === p || o === ally || !sim.livingTargetable(o) || sim.roomAt(o.x, o.y) !== room) continue;
      const d = Math.hypot(o.x - ally.x, o.y - ally.y, o.z - ally.z);
      if (d > HERETIC.forkRange || d > best || (d === best && second && o.id > second.id)) continue;
      if (!lineOfSight(sim.map, ally.x, ally.y, ally.z + 1.2, o.x, o.y, o.z + 1.2)) continue;
      best = d; second = o;
    }
    if (!second) return;
    sim.heal(second, SECONDARIES.heretic.damage);
    this.t.fx(p, 'fork', [ally.x, ally.y, ally.z + 1.2, second.x, second.y, second.z + 1.2], [second.id]);
  }

  // ------------------------------------------------------------------ motes and revivals

  /**
   * Where a heal mote flies, if a talent steers it (§3 Cunning Folk, Resurrection's rally): to the most
   * hurt eligible player (lowest HP share, then player id). Undefined leaves ordinary attraction.
   */
  moteTarget(m: PickupRecord, collectors: readonly Collector[]): Collector | undefined {
    const sim = this.sim;
    if (m.kind !== HEAL_MOTE) return undefined;
    const z = sim.pickups.floor(m.x, m.y);
    const pick = (ok: (c: Collector) => boolean): Collector | undefined => {
      let best: Collector | undefined;
      for (const c of collectors) {
        if (c.dead || !c.connected || c.hp >= c.maxHp || sim.pickups.roomAt(c.x, c.y) !== m.room || !ok(c)) continue;
        if (!lineOfSight(sim.map, m.x, m.y, z + 0.2, c.x, c.y, c.z + 0.5)) continue;
        if (!best || c.hp / c.maxHp < best.hp / best.maxHp || (c.hp / c.maxHp === best.hp / best.maxHp && c.id < best.id)) best = c;
      }
      return best;
    };
    for (const r of this.rallies) {
      if (sim.tick >= r.until) continue;
      const t = pick((c) => r.players.has(c.id) && Math.hypot(c.x - m.x, c.y - m.y) <= HERETIC.rallyRadius);
      if (t) return t;
    }
    for (const h of sim.players) {
      if (!this.has(h, H.CUNNING) || h.dead || !h.connected || Math.hypot(h.x - m.x, h.y - m.y) > HERETIC.cunning || sim.roomAt(h.x, h.y) !== m.room) continue;
      const t = pick((c) => Math.hypot(c.x - h.x, c.y - h.y) <= HERETIC.cunning && Math.hypot(c.x - m.x, c.y - m.y) <= HERETIC.cunning);
      if (t) return t;
    }
    return undefined;
  }

  /** Lazarus: a heal mote the Saint itself collects bursts 20 within 2 m, at most once per 0.5 s. */
  motePicked(p: SimPlayer): void {
    const sim = this.sim;
    if (!this.has(p, H.LAZARUS)) return;
    const at = this.lazarusAt.get(p.id);
    if (at !== undefined && sim.tick - at < ticks(HERETIC.lazarusEvery)) return;
    this.lazarusAt.set(p.id, sim.tick);
    this.blast(p, p.x, p.y, p.z, HERETIC.lazarusMoteRadius, HERETIC.lazarusMote, null);
    this.t.fx(p, 'lazarus', [p.x, p.y, p.z, HERETIC.lazarusMoteRadius]);
  }

  /** Lazarus: a revival the Saint completes bursts 50 within 3.5 m of the risen ally; one cast hits an enemy once. */
  revived(by: SimPlayer, ally: SimPlayer): void {
    const sim = this.sim;
    if (!this.has(by, H.LAZARUS)) return;
    let r = this.revivalHit.get(by.id);
    if (!r || r.tick !== sim.tick) { r = { tick: sim.tick, done: new Set() }; this.revivalHit.set(by.id, r); }
    this.blast(by, ally.x, ally.y, ally.z, HERETIC.lazarusReviveRadius, HERETIC.lazarusRevive, r.done);
    this.t.fx(by, 'lazarus', [ally.x, ally.y, ally.z, HERETIC.lazarusReviveRadius]);
  }

  private blast(p: SimPlayer, x: number, y: number, z: number, radius: number, damage: number, done: Set<number> | null): void {
    const sim = this.sim, cz = z + PLAYER_HEIGHT / 2, room = sim.roomAt(x, y), targets: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k], def = ENEMIES[sim.eType[s]];
      if (done?.has(sim.eIncarnation[s])) continue;
      if (distToCylinder(x, y, cz, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) > radius) continue;
      if (sim.roomAt(sim.eX[s], sim.eY[s]) !== room || !lineOfSight(sim.map, x, y, cz, sim.eX[s], sim.eY[s], sim.eZ[s] + def.height / 2)) continue;
      done?.add(sim.eIncarnation[s]);
      targets.push(s);
    }
    for (const s of targets) sim.damageEnemy(s, damage, p.index, Infinity, x, y);
  }

  // ------------------------------------------------------------------ kills

  /** Kindling: at a root's first kill tick, up to 60 directly killed ground victims light their cell for 3 s. */
  kindleBundle(p: SimPlayer, victims: ReadonlyArray<{ x: number; y: number; z: number }>): void {
    const sim = this.sim, fire = this.fire(p), end = sim.tick + ticks(HERETIC.kindleTime), pts: number[] = [];
    for (const v of victims.slice(0, HERETIC.kindleMax)) {
      const cell = Math.floor(v.y) * sim.map.w + Math.floor(v.x);
      if (Math.abs(sim.map.floor[cell] - v.z) > 0.5) continue;
      if (fire.light(cell, end, sim.tick)) pts.push(v.x, v.y, v.z);
    }
    this.t.fx(p, 'kindle', pts);
  }

  /**
   * A death, before removal: Bread of Angels harvests a distinct primary kill near its caster (one mote
   * per death, six per cast); The Sixth Circle spreads from credited deaths on the owner's fire or furrow.
   */
  died(s: number, source: number, primary: boolean): void {
    const sim = this.sim;
    // Boss summons (wave -1 while the Gatekeeper lives) and the boss itself supply no harvest.
    if (primary && source >= 0 && !isBossBody(sim.eType[s]) && !(sim.bossSlot >= 0 && sim.eWave[s] === -1)) this.harvest(s);
    if (source < 0) return;
    for (const p of sim.players) {
      if (!this.has(p, H.SIXTH)) continue;
      if (!this.onOwnFire(p, s)) continue;
      const cell = Math.floor(sim.eY[s]) * sim.map.w + Math.floor(sim.eX[s]);
      if (!Number.isFinite(sim.map.floor[cell]) || sim.map.solid[cell]) continue;
      const fire = this.fire(p), end = sim.tick + ticks(HERETIC.circleTime);
      for (const c of spreadCells(sim.map, cell)) fire.light(c, end, sim.tick);
    }
  }

  private onOwnFire(p: SimPlayer, s: number): boolean {
    const sim = this.sim;
    if (this.t.fires.get(p.id)?.at(sim.eX[s], sim.eY[s], sim.eZ[s])) return true;
    return sim.clouds.some((c) => c.owner === p && this.onFurrow(c, s));
  }

  private harvest(s: number): void {
    const sim = this.sim;
    let best: Bread | undefined;
    for (const b of this.breads.values()) {
      const p = b.owner;
      if (b.left <= 0 || p.dead || !p.connected || sim.tick >= b.until) continue;
      if (Math.hypot(sim.eX[s] - p.x, sim.eY[s] - p.y) > BREAD.radius || sim.roomAt(sim.eX[s], sim.eY[s]) !== sim.roomAt(p.x, p.y)) continue;
      if (!lineOfSight(sim.map, p.x, p.y, p.z + 1.6, sim.eX[s], sim.eY[s], sim.eZ[s] + 0.8)) continue;
      if (!best || b.until < best.until || (b.until === best.until && p.id < best.owner.id)) best = b;
    }
    if (!best) return;
    const room = sim.roomAt(sim.eX[s], sim.eY[s]), queued = sim.pickups.pending.length;
    const drop = sim.pickups.drop(HEAL_MOTE, room, sim.eX[s], sim.eY[s], sim.tick, 0, ticks(BREAD.moteLife));
    // A full rejected queue consumes neither the quota nor the death's entitlement.
    if (!drop && sim.pickups.pending.length === queued) return;
    best.left--;
    const area = this.t.areas.get(best.area);
    if (area) { area.y1 = best.left; sim.emit('all', { type: 'talentArea', area: { ...area }, end: false, reason: 'harvest' }); }
    this.t.fx(best.owner, 'harvest', [sim.eX[s], sim.eY[s], sim.eZ[s]]);
  }

  // ------------------------------------------------------------------ per tick

  update(): void {
    const sim = this.sim;
    for (const [id, b] of [...this.breads]) if (sim.tick >= b.until || b.owner.dead || !b.owner.connected) this.endBread(id);
    for (const [id, tr] of [...this.trials]) {
      const p = tr.owner;
      if (sim.tick >= tr.until || p.dead || !p.connected) { this.trials.delete(id); continue; }
      const len = Math.hypot(p.x - tr.x, p.y - tr.y);
      // A teleport or another room cancels the painting instead of drawing a cross-map stripe.
      if (len > 8 || sim.roomAt(p.x, p.y) !== tr.room) { this.trials.delete(id); continue; }
      const floor = sim.map.floor[Math.floor(p.y) * sim.map.w + Math.floor(p.x)];
      // Jumping paints nothing until landing.
      if (Math.abs(p.z - floor) < 0.3) this.paint(p, tr.root, tr.x, tr.y, p.x, p.y);
      tr.x = p.x; tr.y = p.y;
      this.t.finish(tr.root);
    }
    for (let i = this.rallies.length - 1; i >= 0; i--) if (sim.tick >= this.rallies[i].until) this.rallies.splice(i, 1);
    for (const [id, r] of this.revivalHit) if (sim.tick - r.tick > 2) this.revivalHit.delete(id);
  }

  /**
   * After movement and hazards: the Saint's fire and furrows mark `pooled` and pulse on the shared
   * budget; Pitch marks and pulses; The Common Cause slows pooled enemies in its owner's incense.
   */
  pools(): void {
    const sim = this.sim;
    for (const p of sim.players) {
      if (p.classId !== 'heretic') continue;
      const fire = this.t.fires.get(p.id), furrows = sim.clouds.filter((c) => c.owner === p && c.furrow && sim.tick >= c.from);
      const pitch = this.has(p, H.PITCH), common = this.has(p, H.COMMON);
      if (!fire?.cells.size && !furrows.length && !pitch && !common) continue;
      const hits: Array<[number, Root | null]> = [];
      for (let k = 0; k < sim.activeCount; k++) {
        const s = sim.active[k];
        if (isBossBody(sim.eType[s])) continue;
        const cell = fire?.at(sim.eX[s], sim.eY[s], sim.eZ[s]);
        const furrow = cell ? undefined : furrows.find((c) => this.onFurrow(c, s));
        const onFire = !!cell || !!furrow;
        if (onFire) sim.ePooled[s] = 1;
        if (pitch && (this.t.slowed(s) || sim.isRooted(s) || this.t.launches.airborne(s)) && (onFire || this.censed(s, p))) {
          this.pitchUntil[s] = sim.tick + ticks(HERETIC.pitch); this.pitchInc[s] = sim.eIncarnation[s];
        }
        const marked = pitch && this.pitchUntil[s] > sim.tick && this.pitchInc[s] === sim.eIncarnation[s];
        if (!onFire && !(marked && !this.censed(s))) continue;
        if (sim.tick - sim.eIncenseTick[s] < CLOUD_PULSE_TICKS) continue;
        sim.eIncenseTick[s] = sim.tick;
        hits.push([s, cell ? FloorFire.root(cell) : furrow?.root ?? null]);
      }
      const roots = new Set<Root>();
      for (const [s, root] of hits) { this.pulse(s, p, root, sim.eX[s], sim.eY[s]); if (root) roots.add(root); }
      for (const r of roots) this.t.finish(r);
      if (common) {
        for (let k = 0; k < sim.activeCount; k++) {
          const s = sim.active[k];
          if (ENEMIES[sim.eType[s]].flying || isBossBody(sim.eType[s]) || !sim.ePooled[s] || !this.censed(s, p)) continue;
          sim.slow(s, HERETIC.commonSlow);
        }
      }
    }
  }

  playerGone(p: SimPlayer): void {
    this.endBread(p.id);
    this.trials.delete(p.id);
  }

  roomCleared(): void {
    this.trials.clear();
    for (const id of [...this.breads.keys()]) this.endBread(id);
    this.rallies.length = 0;
    this.pitchUntil.fill(0);
  }
}
