/**
 * The host's talent effects (rogue game.md §9.3, §14.11; classes-betrayer.md): one resolved kit per
 * player, root actions with their shared hit sets and once-per-root kill bundles, and the Betrayer's
 * alternatives, traps and passives. The simulation calls in here from its weapon, ability, movement
 * and tick paths; base kits without nodes take exactly the paths they took before.
 *
 * Provenance (§14.11): every native shot, cut and return is a root `{owner, actionId, input, depth 0}`.
 * Sparks, frost, clay rings, coins and dagger touches are depth 1: they deal or apply what their row
 * says and never start another bundle. A root dispatches each active kill-discharge node once, at its
 * first tick with kills.
 */
import { ENEMIES, GATEKEEPER, CHERUB, CHORISTER, BLESSED, WATCHMAN, isBossBody } from '../data/enemies';
import { DEV_BUILDS, JUDAS, TALENT, WAY_BACK, WIRE } from '../data/talents';
import { SECONDARIES, WEAPONS, MOVEMENT_GRACE, SHADOWSTEP_CUT_DAMAGE, SHADOWSTEP_CUT_REACH } from '../data/weapons';
import type { KitState, TalentArea, TalentFxKind } from '../net/messages';
import { levelForXp } from '../profile/model';
import { learnedError, resolveKit, runBuildError, type LearnedBuild, type RunBuild } from './build';
import { aimDir, rayCylinder, silverBulletHits } from './combat';
import { GRAVITY, PLAYER_EYE, PLAYER_HEIGHT, PLAYER_RADIUS, TICK_HZ } from './constants';
import { FIELD_RADIUS } from './field';
import { lineOfSight, raycastTerrainHit } from './los';
import { distToCylinder } from './movement';
import type { Simulation, SimPlayer } from './sim';
import { reviveHit } from './souls';
import { coinHeight, glance, judasCoinSpot, pathLength, pathPoint, raySphere, segmentClosest, thrownFieldCenter, wayBackPath, wireEnds } from './talentGeometry';
import { BASE_ABILITIES, FALLEN, HERETIC } from '../data/talents';
import { ENEMY_SLOTS } from './constants';
import { FloorFire } from './floorFire';
import { Launches, type Landing } from './launches';
import { FallenTalents } from './talentsFallen';
import { HereticTalents } from './talentsHeretic';
import { BinderTalents } from './talentsBinder';
import type { FireState } from '../net/messages';

const ticks = (s: number) => Math.round(s * TICK_HZ);
/** Kill-discharge nodes in their fixed dispatch order. */
const JUDECCA = 'betrayer.a.1b', HAND = 'betrayer.a.cap', BLOOD = 'betrayer.c.2a', VESSEL = 'betrayer.c.2b';
const GLANCE = 'betrayer.a.1a', HALT = 'betrayer.a.2a', BEHIND = 'betrayer.a.3b';
const RECOIL = 'betrayer.b.1b', KNIFE = 'betrayer.b.2a', ONE_OF_THEM = 'betrayer.b.2b', SHEEP = 'betrayer.b.3b', SICARIUS = 'betrayer.b.cap';
const NAIL = 'betrayer.c.1a', THROWN = 'betrayer.c.1b', KNOWN = 'betrayer.c.3b', POTTER = 'betrayer.c.cap';
export const KNOWN_GROUND = KNOWN;
export const THROUGH_THE_THRONG = 'betrayer.b.1a';
export const INFORMER = 'betrayer.a.2b';

interface Victim { s: number; inc: number; x: number; y: number; z: number; room: number; slowed: boolean; bound: boolean }
/** One native action (§14.11): its owner, input, shared hit set and the deaths it caused this tick. */
export interface Root {
  owner: SimPlayer;
  id: number;
  input: 'LMB' | 'RMB' | 'Q' | 'E';
  /** The cast's accepted yaw and the owner's feet when it began (the Comb's heading, items-relics.md §2.2). */
  yaw: number; ox: number; oy: number;
  /** A native movement leg (a dash, a return, a charge): its hit-count window spans the leg. */
  leg?: boolean;
  hit: Set<number>;
  victims: Victim[];
  dispatched: boolean;
}
interface ShotState { budget: number; pass: number; bounces: number }
interface Return { root: Root; pts: number[]; length: number; startTick: number; done: number; reach: number; sheep: boolean; cut: Set<number> }

export class Talents {
  private nextAction = 1;
  private nextArea = 1;
  readonly areas = new Map<number, TalentArea>();
  /** Per-area enemy keys already bound by it (Silver Wire: once per enemy per wire). */
  private readonly wireBound = new Map<number, Set<number>>();
  private readonly returns = new Map<number, Return>();
  /** Potter's Field: enemies bound by the current cast. */
  private readonly potterBound = new Set<number>();
  /** A Thousand Years: tick each enemy was last cut, and each player's previous accepted feet. */
  private readonly sicariusCut = new Map<number, number>();
  private readonly lastFeet = new Map<number, [number, number, number]>();
  readonly hidden = new Set<number>();
  /** R5 shared systems: launches with their landings, and each owner's class floor fire. */
  readonly launches: Launches;
  readonly fires = new Map<number, FloorFire>();
  readonly fallen: FallenTalents;
  readonly heretic: HereticTalents;
  readonly binder: BinderTalents;
  /** Set while a root's native hit resolves, so a death knows it was a primary kill (Bread of Angels). */
  private primaryHit = false;

  constructor(private readonly sim: Simulation) {
    this.launches = new Launches(sim, ENEMY_SLOTS);
    this.fallen = new FallenTalents(sim, this, ENEMY_SLOTS);
    this.heretic = new HereticTalents(sim, this, ENEMY_SLOTS);
    this.binder = new BinderTalents(sim, this, ENEMY_SLOTS);
  }

  /** A player's floor fire: the Fallen's holds 600 burning cells, the Heretic's 400. */
  fireOf(p: SimPlayer): FloorFire {
    let f = this.fires.get(p.id);
    if (!f) { f = new FloorFire(this.sim.map, p.id, p.classId === 'heretic' ? HERETIC.fireCap : FALLEN.fireCap); this.fires.set(p.id, f); }
    return f;
  }

  /** Tells everyone which enemies were launched: they fly the arc and don't hold a wading player. */
  launched(p: SimPlayer, slots: number[]): void {
    if (slots.length) this.sim.emit('all', { type: 'launched', playerId: p.id, slots: [...slots] });
  }

  /** Whether an enemy stands in a Heretic's incense (`censed`, game.md §4.11). */
  censed(s: number): boolean {
    return this.heretic.censed(s);
  }

  // ------------------------------------------------------------------ builds

  /** The build a player enters with: its profile character's learned build if legal, else the base kit. */
  initialBuild(p: SimPlayer, learned: LearnedBuild | undefined, devBuild?: string): RunBuild {
    const [q, e] = BASE_ABILITIES[p.classId];
    const dev = devBuild ? DEV_BUILDS[devBuild] : undefined;
    if (dev && !p.bot && (!dev.classId || dev.classId === p.classId) && !this.sim.progressionEnabled) {
      const b = { talents: [...dev.talents], q: dev.q ?? q, e: dev.e ?? e };
      if (!learnedError(p.classId, b, null)) return { ...b, rites: [...(dev.rites ?? [])] };
    }
    if (!learned || p.bot || learnedError(p.classId, learned, levelForXp(p.xpBase))) return { talents: [], rites: [], q, e };
    return { talents: [...learned.talents], rites: [], q: learned.q, e: learned.e };
  }

  /** Applies an accepted build and tells everyone (§14.7). Outgoing alternatives are settled first. */
  setBuild(p: SimPlayer, build: RunBuild, announce = true): void {
    const old = p.kit;
    if (old && old.e === 'wayBack' && build.e !== 'wayBack') this.endShadow(p, 'reassigned');
    if (old && old.q === 'judasCoin' && build.q !== 'judasCoin') this.endArea(this.areaOf(p.id, 'coin'), 'reassigned');
    if (old && old.e === 'silverWire' && build.e !== 'silverWire') this.endArea(this.areaOf(p.id, 'wire'), 'reassigned');
    if (old && old.e === 'gatebreaker' && build.e !== 'gatebreaker') this.fallen.playerGone(p);
    p.build = { talents: [...build.talents], rites: [...build.rites], q: build.q, e: build.e };
    p.kit = resolveKit(p.classId, p.build);
    // Outgoing augments lose their contributions (§9.10): Blood Money's coins, a hidden silhouette.
    if (!p.kit.active.has(BLOOD)) for (const a of [...this.areas.values()]) if (a.kind === 'trap' && a.playerId === p.id) this.endArea(a, 'reassigned');
    if (!p.kit.active.has(ONE_OF_THEM)) this.setHidden(p, false);
    if (announce) this.sim.emit('all', { type: 'kit', kit: this.kitState(p) });
  }

  kitState(p: SimPlayer): KitState {
    const k = p.kit;
    return { playerId: p.id, q: k.q, e: k.e, learned: [...p.build.talents], rites: [...p.build.rites], active: [...k.active], dormant: [...k.dormant], suppressed: [...k.suppressed] };
  }

  has(p: SimPlayer, id: string): boolean {
    return p.kit.active.has(id);
  }

  /** A whole loadout from the Advocate or a dev build (§9.5, §9.8): validated as one transaction. */
  edit(p: SimPlayer, talents: string[], q: string, e: string, freePoints: boolean): string | null {
    const build: RunBuild = { talents, rites: p.build.rites, q, e };
    const error = runBuildError(p.classId, build, freePoints ? null : levelForXp(p.xpBase + Math.floor(p.runXp)));
    if (error) return error;
    // Swapping E settles a cooldown that starts on ending (§9.4); a swap never resets a cooldown.
    this.setBuild(p, build);
    return null;
  }

  // ------------------------------------------------------------------ roots and kill bundles

  /** A native action; `leg` marks a movement leg (a dash, a return, a charge) whose hit window spans the leg. */
  root(owner: SimPlayer, input: Root['input'], leg = false, ox = owner.x, oy = owner.y): Root {
    return { owner, id: this.nextAction++, input, yaw: owner.yaw, ox, oy, leg, hit: new Set(), victims: [], dispatched: false };
  }

  slowed(s: number): boolean {
    return this.sim.tick < this.sim.eSlowUntil[s] || this.sim.items.slowed[s] === 1;
  }

  /** A native (depth 0) hit of a root: records the victim with its pre-fatal state when it dies. */
  primary(root: Root, s: number, amount: number, force: number, fromX = NaN, fromY = NaN, area?: boolean): void {
    const sim = this.sim;
    if (!sim.eAlive[s]) return;
    const v: Victim = { s, inc: sim.eIncarnation[s], x: sim.eX[s], y: sim.eY[s], z: sim.eZ[s], room: sim.roomAt(sim.eX[s], sim.eY[s]), slowed: this.slowed(s), bound: sim.isRooted(s) };
    if (amount > 0) sim.relics.nativeHit(root, s);
    this.primaryHit = true;
    sim.hitCtx = root.input;
    sim.damageEnemy(s, amount, root.owner.index, force, fromX, fromY, false, area);
    sim.hitCtx = null;
    this.primaryHit = false;
    if (!sim.eAlive[s]) root.victims.push(v);
  }

  /** The root's kill bundle (§9.3): once, at its first tick with kills, after native damage. */
  finish(root: Root): void {
    const p = root.owner, victims = root.victims.slice(0, TALENT.victims);
    root.victims.length = 0;
    if (root.dispatched || !victims.length || !p.connected) return;
    root.dispatched = true;
    if (this.has(p, JUDECCA)) this.judecca(p, victims);
    if (this.has(p, HAND) && (root.input === 'LMB' || root.input === 'RMB')) this.sparks(p, victims);
    if (this.has(p, BLOOD) && root.input === 'LMB') for (const v of victims) this.addTrap(p, v);
    if (this.has(p, VESSEL)) this.clay(p, victims.filter((v) => v.bound));
    if (this.has(p, 'fallen.b.1b') && root.input === 'LMB') this.fallen.kindleBundle(p, victims);
    if (this.has(p, 'heretic.b.1b')) this.heretic.kindleBundle(p, victims);
    if (p.classId === 'binder' && (root.input === 'LMB' || root.input === 'RMB')) this.binder.bundle(p, victims);
  }

  /** Enemies other than the boss and its parts whose center is within `r` of a point, in that room, in sight. */
  private near(x: number, y: number, z: number, room: number, r: number, each: (s: number) => void, boss = false): void {
    const sim = this.sim;
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (!boss && isBossBody(sim.eType[s])) continue;
      const def = ENEMIES[sim.eType[s]];
      if (distToCylinder(x, y, z, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) > r) continue;
      if (sim.roomAt(sim.eX[s], sim.eY[s]) !== room) continue;
      if (!lineOfSight(sim.map, x, y, z, sim.eX[s], sim.eY[s], sim.eZ[s] + def.height / 2)) continue;
      each(s);
    }
  }

  fx(p: SimPlayer, kind: TalentFxKind, pts: number[], slots: number[] = []): void {
    if (pts.length || slots.length) this.sim.emit('all', { type: 'talentFx', playerId: p.id, kind, pts, slots });
  }

  private judecca(p: SimPlayer, victims: Victim[]): void {
    const pts: number[] = [];
    for (const v of victims) {
      pts.push(v.x, v.y, v.z);
      this.near(v.x, v.y, v.z + 0.9, v.room, TALENT.frostRadius, (s) => this.sim.slow(s, TALENT.slow, p.index));
    }
    this.fx(p, 'frost', pts);
  }

  private sparks(p: SimPlayer, victims: Victim[]): void {
    const sim = this.sim, sparked = new Set<number>(), arcs: number[] = [];
    for (const v of victims) {
      let best = -1, bestD = Infinity;
      this.near(v.x, v.y, v.z + 0.9, v.room, TALENT.sparkRange, (s) => {
        if (sparked.has(s)) return;
        const d = Math.hypot(sim.eX[s] - v.x, sim.eY[s] - v.y, sim.eZ[s] - v.z);
        if (d < bestD || (d === bestD && s < best)) { best = s; bestD = d; }
      });
      if (best < 0) continue;
      sparked.add(best);
      arcs.push(v.x, v.y, v.z + 0.9, sim.eX[best], sim.eY[best], sim.eZ[best] + ENEMIES[sim.eType[best]].height / 2);
    }
    for (const s of sparked) sim.damageEnemy(s, TALENT.sparkDamage, p.index, TALENT.sparkDamage);
    this.fx(p, 'spark', arcs);
  }

  private clay(p: SimPlayer, victims: Victim[]): void {
    if (!victims.length) return;
    const sim = this.sim, ringed = new Set<number>(), pts: number[] = [];
    const targets: Array<[number, number, number]> = [];
    for (const v of victims) {
      pts.push(v.x, v.y, v.z);
      this.near(v.x, v.y, v.z + 0.9, v.room, TALENT.vesselRadius, (s) => { if (!ringed.has(s)) { ringed.add(s); targets.push([s, v.x, v.y]); } }, true);
    }
    for (const [s, x, y] of targets) sim.damageEnemy(s, TALENT.vesselDamage, p.index, TALENT.vesselDamage, x, y);
    this.fx(p, 'clay', pts);
  }

  // ------------------------------------------------------------------ the revolver and the Silver Bullet

  /**
   * One Betrayer shot (classes-betrayer.md §3 shared rules): the native ray with its Delivery
   * (Glancing Silver, The Halt and the Lame, the Judas Coin split), then its Payload (The Nail, Recoil),
   * then the kill bundle. Without nodes or a coin this is exactly the base revolver and Silver Bullet.
   */
  shoot(p: SimPlayer, silver: boolean): void {
    const sim = this.sim, w = silver ? SECONDARIES.betrayer : WEAPONS.betrayer;
    const root = this.root(p, silver ? 'RMB' : 'LMB');
    const [dx, dy, dz] = aimDir(p.yaw, p.pitch);
    const souls = new Set<SimPlayer>(), ends: number[] = [];
    const state: ShotState = { budget: w.damage, pass: !silver && this.has(p, HALT) ? 1 : 0, bounces: silver && this.has(p, GLANCE) ? 1 : 0 };
    this.segment(root, p, p.x, p.y, p.z + PLAYER_EYE, dx, dy, dz, w.range, state, souls, ends, 0, silver);
    for (const o of souls) sim.addRevive(o, reviveHit(w.interval, false), p);
    if (silver && this.has(p, NAIL)) this.nail(p, root, ends);
    this.finish(root);
    if (silver && this.has(p, RECOIL)) this.recoil(p);
  }

  private segment(root: Root, p: SimPlayer, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number, range: number,
    st: ShotState, souls: Set<SimPlayer>, ends: number[], seg: number, silver: boolean): void {
    const sim = this.sim;
    const terrain = raycastTerrainHit(sim.map, ox, oy, oz, dx, dy, dz, range);
    const coin = this.areaOf(p.id, 'coin');
    let coinT = Infinity;
    if (coin) {
      coinT = raySphere(ox, oy, oz, dx, dy, dz, coin.x, coin.y, coinHeight(coin.z, (sim.tick - coin.startTick) / TICK_HZ), JUDAS.radius);
      if (coinT > terrain.t) coinT = Infinity;
    }
    const limit = Math.min(terrain.t, coinT);
    const line = sim.rayEnemies(ox, oy, oz, dx, dy, dz, limit, Infinity).filter((s) => !root.hit.has(s));
    let end = limit, stopped = false, passFrom = -1;
    if (silver) {
      const half = this.has(p, BEHIND);
      const r = silverBulletHits(line.map((s) => ({ s, hp: sim.eHp[s], rooted: sim.isRooted(s), boss: sim.eType[s] === GATEKEEPER, half: half && sim.eTauntUntil[s] > sim.tick })), st.budget);
      for (const h of r.hits) { root.hit.add(h.s); st.budget -= h.cost; }
      if (r.stopped) { stopped = true; st.budget = 0; end = this.rayT(r.hits[r.hits.length - 1].s, ox, oy, oz, dx, dy, dz); }
      for (const h of r.hits) this.primary(root, h.s, h.amount, h.carried);
    } else {
      for (const s of line) {
        root.hit.add(s);
        const wasSlowed = this.slowed(s);
        this.primary(root, s, WEAPONS.betrayer.damage, WEAPONS.betrayer.damage);
        if (!sim.eAlive[s] && wasSlowed && st.pass > 0) { st.pass--; if (passFrom < 0) passFrom = this.rayT(s, ox, oy, oz, dx, dy, dz); continue; }
        stopped = true;
        end = this.rayT(s, ox, oy, oz, dx, dy, dz);
        break;
      }
    }
    sim.soulsOnRay(p, ox, oy, oz, dx, dy, dz, end, souls);
    sim.globesOnRay(p, ox, oy, oz, dx, dy, dz, end);
    sim.propsOnRay(ox, oy, oz, dx, dy, dz, end);
    const ex = ox + dx * end, ey = oy + dy * end, ez = oz + dz * end;
    if (seg === 0 && silver) sim.emit('all', { type: 'silverBullet', playerId: p.id, x: ox, y: oy, z: oz, ex, ey, ez });
    else if (seg > 0) sim.emit('all', { type: 'tracer', playerId: p.id, silver, x: ox, y: oy, z: oz, ex, ey, ez });
    else if (passFrom >= 0) sim.emit('all', { type: 'tracer', playerId: p.id, silver, x: ox + dx * passFrom, y: oy + dy * passFrom, z: oz + dz * passFrom, ex, ey, ez });
    if (stopped) { ends.push(ex, ey, ez); return; }
    if (coinT < Infinity && coin) {
      // The coin splits the shot center, left and right in yaw, each with what the line still carries.
      this.endArea(coin, 'split');
      this.fx(p, 'split', [ex, ey, ez]);
      const yaw = Math.atan2(dy, dx), pitch = Math.asin(Math.max(-1, Math.min(1, dz)));
      for (const off of [0, -JUDAS.split, JUDAS.split]) {
        const [bx, by, bz] = aimDir(yaw + off, pitch);
        this.segment(root, p, ex, ey, ez, bx, by, bz, range - coinT, { ...st }, souls, ends, seg + 1, silver);
      }
      return;
    }
    if (terrain.t >= range - 1e-6) return;
    if (silver && st.bounces > 0) {
      const g = glance(sim.map, ox, oy, oz, dx, dy, dz, terrain.t);
      if (g) {
        st.bounces--;
        const back = 0.02;
        this.segment(root, p, ex - dx * back, ey - dy * back, ez - dz * back, g[0], g[1], g[2], range - terrain.t, st, souls, ends, seg + 1, silver);
        return;
      }
    }
    // The wall end, just in front of the face, so the Nail's sight test starts in the open.
    ends.push(ex - dx * 0.05, ey - dy * 0.05, ez - dz * 0.05);
  }

  /** Distance along a ray to where it enters an enemy's cylinder. */
  rayTo(s: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
    return this.rayT(s, ox, oy, oz, dx, dy, dz);
  }

  private rayT(s: number, ox: number, oy: number, oz: number, dx: number, dy: number, dz: number): number {
    const sim = this.sim, def = ENEMIES[sim.eType[s]];
    return rayCylinder(ox, oy, oz, dx, dy, dz, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height);
  }

  /** The Nail: at each terminal point, living ground survivors within 2 m in sight are bound 1 s, once per root. */
  private nail(p: SimPlayer, root: Root, ends: number[]): void {
    const sim = this.sim, bound = new Set<number>(), pts: number[] = [];
    for (let i = 0; i < ends.length; i += 3) {
      const [x, y, z] = [ends[i], ends[i + 1], ends[i + 2]];
      pts.push(x, y, z);
      this.near(x, y, z, sim.roomAt(x, y), TALENT.nailRadius, (s) => {
        if (bound.has(s) || ENEMIES[sim.eType[s]].flying) return;
        bound.add(s); sim.root(s, TALENT.bind, p.index);
      });
    }
    this.fx(p, 'nail', pts, [...bound]);
    void root;
  }

  /** Recoil: one finite envelope per accepted Silver Bullet, never during another or while held. */
  private recoil(p: SimPlayer): void {
    const sim = this.sim;
    if (p.dash || p.landingTick >= 0 || this.returns.has(p.id) || sim.commanders.carriedBy(p.id) || p.launchUntilMs === -1 || sim.nowMs < p.launchUntilMs || sim.nowMs < p.speedCheckSkipUntil) return;
    const speed = TALENT.recoilDistance / TALENT.recoilTime;
    const vx = -Math.cos(p.yaw) * speed, vy = -Math.sin(p.yaw) * speed;
    p.speedCheckSkipUntil = sim.nowMs + (TALENT.recoilTime + 0.35) * 1000;
    sim.emit(p.id, { type: 'recoil', playerId: p.id, vx, vy });
    this.fx(p, 'recoil', [p.x, p.y, p.z]);
  }

  // ------------------------------------------------------------------ Q and E

  /** Q for the Betrayer's alternatives and Thrown Silver; false lets the base Field of Blood run. */
  useQ(p: SimPlayer): boolean {
    const sim = this.sim;
    if (p.kit.q === 'judasCoin') {
      if (p.cdQ > 1e-6) return true;
      const spot = judasCoinSpot(sim.map, p.x, p.y, p.z, p.yaw);
      // No room for the sphere in front of the caster: refused without cooldown.
      if (!spot || sim.roomAt(spot[0], spot[1]) !== sim.roomAt(p.x, p.y) && sim.roomAt(spot[0], spot[1]) >= 0) return true;
      this.endArea(this.areaOf(p.id, 'coin'), 'replaced');
      this.addArea({ kind: 'coin', playerId: p.id, x: spot[0], y: spot[1], z: spot[2], x1: spot[0], y1: spot[1], z1: spot[2], startTick: sim.tick, endTick: sim.tick + ticks(JUDAS.life) });
      p.cdQ = JUDAS.cooldown;
      return true;
    }
    if (p.kit.q === 'field') this.potterBound.clear();
    if (p.kit.q === 'field' && this.has(p, THROWN)) {
      if (p.cdQ > 1e-6) return true;
      const [dx, dy, dz] = aimDir(p.yaw, p.pitch);
      [sim.fieldX, sim.fieldY, sim.fieldZ] = thrownFieldCenter(sim.map, p.x, p.y, p.z, dx, dy, dz);
      sim.fieldBy = p.index;
      sim.fieldStart = sim.tick + ticks(TALENT.thrownFlight);
      sim.fieldUntil = sim.fieldStart + ticks(8);
      p.cdQ = 30;
      sim.emit('all', { type: 'abilityUsed', playerId: p.id, slot: 'Q', x: sim.fieldX, y: sim.fieldY, z: sim.fieldZ, targets: [], thrown: true });
      return true;
    }
    return false;
  }

  /** E for the Way Back and the Silver Wire; false lets Shadowstep run. */
  useE(p: SimPlayer): boolean {
    const sim = this.sim;
    if (p.kit.e === 'silverWire') {
      if (p.cdE > 1e-6) return true;
      this.endArea(this.areaOf(p.id, 'wire'), 'replaced');
      const [x0, y0, z0, x1, y1, z1] = wireEnds(sim.map, p.x, p.y, p.yaw);
      const a = this.addArea({ kind: 'wire', playerId: p.id, x: x0, y: y0, z: z0, x1, y1, z1, startTick: sim.tick, endTick: sim.tick + ticks(WIRE.life) });
      this.wireBound.set(a.id, new Set());
      p.cdE = WIRE.cooldown;
      return true;
    }
    if (p.kit.e !== 'wayBack') return false;
    if (this.returns.has(p.id)) return true;
    const shadow = this.areaOf(p.id, 'shadow');
    if (!shadow) {
      if (p.cdE > MOVEMENT_GRACE + 1e-6) return true;
      this.addArea({ kind: 'shadow', playerId: p.id, x: p.x, y: p.y, z: p.z, x1: p.x, y1: p.y, z1: p.z, startTick: sim.tick, endTick: sim.tick + ticks(WAY_BACK.life) });
      return true;
    }
    // A failed or out-of-range press leaves the shadow and its timer (§4).
    if (sim.roomAt(shadow.x, shadow.y) !== sim.roomAt(p.x, p.y) || Math.hypot(shadow.x - p.x, shadow.y - p.y) > WAY_BACK.range) return true;
    sim.commanders.releasePlayer(p.id, false);
    const pts = wayBackPath(sim.map, p.x, p.y, p.z, shadow.x, shadow.y), length = pathLength(pts);
    const seconds = length / WAY_BACK.speed;
    p.invulUntil = Math.max(p.invulUntil, sim.tick + ticks(seconds + WAY_BACK.invulnAfter));
    p.speedCheckSkipUntil = sim.nowMs + (seconds + 0.6) * 1000;
    const sheep = this.has(p, SHEEP);
    this.returns.set(p.id, { root: this.root(p, 'E', true), pts, length, startTick: sim.tick, done: 0, reach: this.has(p, KNIFE) ? TALENT.longKnife : WAY_BACK.cut, sheep, cut: new Set() });
    const n = pts.length;
    sim.emit('all', { type: 'wayBack', playerId: p.id, x0: pts[0], y0: pts[1], z0: pts[2], x1: pts[n - 3], y1: pts[n - 2], z1: pts[n - 1], ms: seconds * 1000 });
    this.endShadow(p, 'return');
    return true;
  }

  /** Shadowstep's cut width: 0.5 m, 1.5 m with The Long Knife. */
  dashReach(p: SimPlayer): number {
    return this.has(p, KNIFE) ? TALENT.longKnife : SHADOWSTEP_CUT_REACH;
  }

  /**
   * A dash or return hit on one enemy: the native 40 cut, or Scattered Sheep's sideways launch with no
   * damage. (ux, uy) is the path's direction and (x0, y0) a point on it.
   */
  dashHit(p: SimPlayer, root: Root, s: number, ux: number, uy: number, x0: number, y0: number, launched: number[]): void {
    const sim = this.sim;
    if (!this.has(p, SHEEP)) {
      this.primary(root, s, SHADOWSTEP_CUT_DAMAGE, SHADOWSTEP_CUT_DAMAGE, sim.eX[s] - ux, sim.eY[s] - uy, false);
      return;
    }
    if (sim.isRooted(s) || isBossBody(sim.eType[s])) return;
    const side = ux * (sim.eY[s] - y0) - uy * (sim.eX[s] - x0) >= 0 ? 1 : -1;
    sim.knockback(s, -uy * side, ux * side, TALENT.sheepThrow, TALENT.airborne);
    if (!ENEMIES[sim.eType[s]].flying && sim.eGrounded[s]) { sim.eVz[s] = GRAVITY * TALENT.airborne / 2; sim.eGrounded[s] = 0; }
    sim.commanders.cancel(s); sim.dominions.cancel(s, sim.tick);
    launched.push(s);
  }

  /** Cuts (or launches) every enemy within `reach` of a path segment, once per action. */
  cutSegment(p: SimPlayer, root: Root, cut: Set<number>, reach: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const sim = this.sim, dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy);
    const ux = len > 1e-9 ? dx / len : 0, uy = len > 1e-9 ? dy / len : 0;
    const hit: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (cut.has(s)) continue;
      const def = ENEMIES[sim.eType[s]];
      const { t } = segmentClosest(sim.eX[s], sim.eY[s], x0, y0, x1, y1);
      const cz = z0 + (z1 - z0) * t + PLAYER_HEIGHT / 2;
      if (distToCylinder(x0 + dx * t, y0 + dy * t, cz, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) <= reach) hit.push(s);
    }
    const launched: number[] = [];
    for (const s of hit) { cut.add(s); this.dashHit(p, root, s, ux, uy, x0, y0, launched); }
    if (launched.length) this.fx(p, 'sheep', [], launched);
  }

  // ------------------------------------------------------------------ areas

  addArea(a: Omit<TalentArea, 'id'>): TalentArea {
    const area = { ...a, id: this.nextArea++ };
    this.areas.set(area.id, area);
    this.sim.emit('all', { type: 'talentArea', area: { ...area }, end: false, reason: '' });
    return area;
  }

  endArea(a: TalentArea | undefined, reason: string): void {
    if (!a || !this.areas.delete(a.id)) return;
    this.wireBound.delete(a.id);
    this.sim.emit('all', { type: 'talentArea', area: { ...a }, end: true, reason });
  }

  areaOf(playerId: number, kind: TalentArea['kind']): TalentArea | undefined {
    for (const a of this.areas.values()) if (a.playerId === playerId && a.kind === kind) return a;
    return undefined;
  }

  /** The Way Back's shadow ends: the 12 s cooldown starts now, keeping any longer deadline (§4). */
  private endShadow(p: SimPlayer, reason: string): void {
    const shadow = this.areaOf(p.id, 'shadow');
    if (!shadow) return;
    this.endArea(shadow, reason);
    p.cdE = Math.max(p.cdE, WAY_BACK.cooldown);
  }

  private addTrap(p: SimPlayer, v: Victim): void {
    const sim = this.sim;
    const traps = [...this.areas.values()].filter((a) => a.kind === 'trap');
    if (traps.length >= TALENT.coinMax) this.endArea(traps[0], 'oldest');
    const c = Math.floor(v.x), r = Math.floor(v.y), z = sim.map.floor[r * sim.map.w + c];
    if (!Number.isFinite(z) || sim.map.solid[r * sim.map.w + c]) return;
    this.addArea({ kind: 'trap', playerId: p.id, x: v.x, y: v.y, z, x1: v.x, y1: v.y, z1: z, startTick: sim.tick, endTick: sim.tick + ticks(TALENT.coinLife) });
  }

  /** A player died, left, teleported or the room cleared: markers end (§4 host/client split). */
  playerGone(p: SimPlayer): void {
    this.fallen.playerGone(p);
    this.heretic.playerGone(p);
    this.endShadow(p, 'gone');
    this.returns.delete(p.id);
    this.lastFeet.delete(p.id);
    this.setHidden(p, false);
  }

  roomCleared(): void {
    for (const a of [...this.areas.values()]) if (a.kind !== 'coin' && a.kind !== 'shadow') this.endArea(a, 'cleared');
    // Clear deletes outstanding combat effects (classes-fallen.md "Resolution and lifetime").
    for (const f of this.fires.values()) f.clear(this.sim.tick);
    this.flushFires();
    this.launches.clear();
    this.fallen.roomCleared();
    this.heretic.roomCleared();
    this.binder.roomCleared();
  }

  checkpoint(): TalentArea[] {
    return [...this.areas.values()].map((a) => ({ ...a }));
  }

  /** Every owner's still-burning cells, for floorSync. */
  fireCheckpoint(): FireState[] {
    return [...this.fires.values()].filter((f) => f.cells.size).map((f) => ({ playerId: f.ownerId, ...f.checkpoint() }));
  }

  private flushFires(): void {
    for (const f of this.fires.values()) {
      const c = f.flush();
      if (c) this.sim.emit('all', { type: 'fire', playerId: f.ownerId, ...c });
    }
  }

  /**
   * After movement and hazards (each tick): landings due (controls, then damage, then crashes), fire
   * pulses and their `pooled` membership, then the tick's fire changes for every client.
   */
  pools(): void {
    const sim = this.sim;
    for (const f of this.fires.values()) f.expire(sim.tick);
    const landed = this.launches.due();
    if (landed.length) this.landings(landed);
    this.fallen.pools();
    this.heretic.pools();
    this.binder.pools();
    this.flushFires();
  }

  private landings(landed: Landing[]): void {
    for (const l of landed) { this.fallen.landControl(l); this.binder.landControl(l); }
    for (const l of landed) this.fallen.landDamage(l);
    const crashes = new Map<SimPlayer, number[]>();
    for (const l of landed) {
      const pts = this.fallen.landCrash(l);
      if (pts.length && l.owner) crashes.set(l.owner, [...(crashes.get(l.owner) ?? []), ...pts]);
    }
    for (const [p, pts] of crashes) this.fx(p, 'crash', pts);
  }

  /** An enemy's death, before its removal; `source` is the credited player index or -1. */
  died(s: number, source: number): void {
    this.fallen.died(s, source);
    this.heretic.died(s, source, this.primaryHit);
  }

  // ------------------------------------------------------------------ per tick

  update(): void {
    const sim = this.sim;
    this.fallen.update();
    this.heretic.update();
    this.binder.update();
    for (const a of [...this.areas.values()]) {
      if (sim.tick < a.endTick) continue;
      const owner = sim.playerById(a.playerId);
      if (a.kind === 'shadow' && owner) this.endShadow(owner, 'faded');
      else this.endArea(a, 'expired');
    }
    for (const a of [...this.areas.values()]) {
      const owner = sim.playerById(a.playerId);
      if (!owner || !owner.connected) { if (owner) this.playerGone(owner); this.endArea(a, 'gone'); continue; }
      if (a.kind === 'wire') this.wire(a);
      else if (a.kind === 'trap') this.trap(a);
    }
    for (const [id, r] of [...this.returns]) this.updateReturn(id, r);
    for (const p of sim.players) {
      if (p.classId !== 'betrayer') continue;
      if (p.dead) { if (this.areaOf(p.id, 'shadow')) this.playerGone(p); continue; }
      if (this.has(p, POTTER) && p.kit.q === 'field') this.potter(p);
      if (this.has(p, SICARIUS)) this.sicarius(p); else this.lastFeet.delete(p.id);
      if (this.has(p, ONE_OF_THEM)) this.setHidden(p, sim.livingTargetable(p) && this.inCrowd(p));
    }
  }

  /** Ground enemies whose feet are near a height, excluding flyers and the Gatekeeper. */
  private ground(s: number): boolean {
    const sim = this.sim;
    return !isBossBody(sim.eType[s]) && !ENEMIES[sim.eType[s]].flying && sim.eGrounded[s] === 1;
  }

  private wire(a: TalentArea): void {
    const sim = this.sim, bound = this.wireBound.get(a.id) ?? new Set<number>();
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (!this.ground(s)) continue;
      const key = sim.eIncarnation[s];
      if (bound.has(key)) continue;
      const { d2, t } = segmentClosest(sim.eX[s], sim.eY[s], a.x, a.y, a.x1, a.y1);
      const reach = ENEMIES[sim.eType[s]].radius + WIRE.margin;
      if (d2 > reach * reach || Math.abs(sim.eZ[s] - (a.z + (a.z1 - a.z) * t - WIRE.height)) > WIRE.feet) continue;
      bound.add(key);
      sim.root(s, WIRE.bind, sim.playerById(a.playerId)?.index);
    }
  }

  private trap(a: TalentArea): void {
    const sim = this.sim;
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (!this.ground(s) || Math.abs(sim.eZ[s] - a.z) > 1) continue;
      if (Math.hypot(sim.eX[s] - a.x, sim.eY[s] - a.y) > TALENT.coinRadius + ENEMIES[sim.eType[s]].radius) continue;
      sim.root(s, TALENT.bind, sim.playerById(a.playerId)?.index);
      this.endArea(a, 'spent');
      return;
    }
  }

  private updateReturn(id: number, r: Return): void {
    const sim = this.sim, p = sim.playerById(id);
    if (!p || p.dead || !p.connected) { this.returns.delete(id); return; }
    const d = Math.min(r.length, ((sim.tick - r.startTick + 1) / TICK_HZ) * WAY_BACK.speed);
    const [x0, y0, z0] = pathPoint(r.pts, r.done), [x1, y1, z1] = pathPoint(r.pts, d);
    this.cutSegment(p, r.root, r.cut, r.reach, x0, y0, z0, x1, y1, z1);
    r.done = d;
    this.finish(r.root);
    if (d >= r.length - 1e-9) this.returns.delete(id);
  }

  private potter(p: SimPlayer): void {
    const sim = this.sim;
    if (sim.tick < sim.fieldStart || sim.tick >= sim.fieldUntil) return;
    const pts: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k], key = sim.eIncarnation[s];
      if (!this.ground(s) || this.potterBound.has(key) || Math.hypot(sim.eX[s] - sim.fieldX, sim.eY[s] - sim.fieldY) > FIELD_RADIUS) continue;
      this.potterBound.add(key);
      sim.root(s, TALENT.bind, p.index);
      pts.push(sim.eX[s], sim.eY[s], sim.eZ[s]);
    }
    this.fx(p, 'potter', pts);
  }

  /** A Thousand Years Among Them: the accepted center path since last tick, swept against enemy centers. */
  private sicarius(p: SimPlayer): void {
    const sim = this.sim;
    const last = this.lastFeet.get(p.id) ?? [p.x, p.y, p.z];
    this.lastFeet.set(p.id, [p.x, p.y, p.z]);
    if (!sim.livingTargetable(p)) return;
    const room = sim.roomAt(p.x, p.y), pts: number[] = [], hits: number[] = [];
    const r2 = TALENT.sicariusRadius * TALENT.sicariusRadius;
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (!this.ground(s) || Math.abs(sim.eZ[s] - p.z) > TALENT.sicariusFeet) continue;
      const key = sim.eIncarnation[s], at = this.sicariusCut.get(key);
      if (at !== undefined && sim.tick - at < TICK_HZ) continue;
      if (segmentClosest(sim.eX[s], sim.eY[s], last[0], last[1], p.x, p.y).d2 > r2) continue;
      if (sim.roomAt(sim.eX[s], sim.eY[s]) !== room || !lineOfSight(sim.map, p.x, p.y, p.z + PLAYER_EYE, sim.eX[s], sim.eY[s], sim.eZ[s] + 0.9)) continue;
      this.sicariusCut.set(key, sim.tick);
      hits.push(s);
    }
    for (const s of hits) { pts.push(sim.eX[s], sim.eY[s], sim.eZ[s]); sim.damageEnemy(s, TALENT.sicariusDamage, p.index, TALENT.sicariusDamage, p.x, p.y); }
    if (this.sicariusCut.size > 4096) for (const [key, at] of this.sicariusCut) if (sim.tick - at >= TICK_HZ) this.sicariusCut.delete(key);
    this.fx(p, 'sicarius', pts);
  }

  /** One of Them: a living ground enemy presses on the player within the wading radius, on its level (§3.2). */
  private inCrowd(p: SimPlayer): boolean {
    const sim = this.sim;
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (!this.ground(s) || Math.abs(sim.eZ[s] - p.z) > TALENT.oneOfThemFeet) continue;
      const reach = sim.eType[s] === BLESSED ? 1.2 : PLAYER_RADIUS + ENEMIES[sim.eType[s]].radius + 0.45;
      if (Math.hypot(sim.eX[s] - p.x, sim.eY[s] - p.y) <= reach) return true;
    }
    return false;
  }

  private setHidden(p: SimPlayer, hidden: boolean): void {
    if (this.hidden.has(p.id) === hidden) return;
    const sim = this.sim;
    if (hidden) this.hidden.add(p.id); else this.hidden.delete(p.id);
    sim.emit('all', { type: 'hidden', playerId: p.id, hidden });
    // Ordinary casters drop a hidden target at once; globes already flying keep flying.
    if (hidden) for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (sim.eTarget[s] === p.index && this.caster(s)) sim.retarget(s);
    }
  }

  /** Ordinary Choristers, Cherubs and Watchmen: the enemies One of Them hides from (a Watchman's aim is canceled). */
  caster(s: number): boolean {
    const t = this.sim.eType[s];
    return t === CHORISTER || t === CHERUB || t === WATCHMAN;
  }

  /** Known Ground (`c.3b`): authored hazard cells and blast props don't hurt this player. */
  ignoresWorld(p: SimPlayer): boolean {
    return this.has(p, KNOWN);
  }
}

