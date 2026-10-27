/**
 * The Binder's talents on the host (classes-binder.md §3–§4): the Chain Gun and Scourge with their
 * Delivery, own bind sources (Chains, Ring of the Giants, The Boundary Chain, Where They Fall, The
 * Wind of Cocytus, The Procession, The Chain Holds), Brought Low, Sunk in the Lake, Fettered Hands,
 * Discord's payloads and the Well, frost and the boundary as pools.
 *
 * "Bound by you" is the Binder's own still-active source on that enemy, never the last writer of the
 * shared root: each own bind records its cast, ordinary end and six-second ceiling (cast start + 6 s);
 * transfers and Sunk in the Lake keep the original cast's ceiling and never restart it.
 */
import { CHERUB_CLIMB, ENEMIES, isBossBody } from '../data/enemies';
import { BINDER, BOUNDARY, RING, WELL } from '../data/talents';
import { CHAINS_ROOT, SCOURGE_HALF_ARC, SECONDARIES, WEAPONS } from '../data/weapons';
import type { TalentArea } from '../net/messages';
import { aimDir } from './combat';
import { PLAYER_EYE, PLAYER_HEIGHT, TICK_HZ } from './constants';
import { walkDestination } from './field';
import type { Landing } from './launches';
import { lineOfSight, raycastTerrain } from './los';
import { distToCylinder } from './movement';
import { PROJ_ARROW, PROJ_GLOBE, type Simulation, type SimPlayer } from './sim';
import { reviveHit } from './souls';
import { aimedWalk, boundaryEnds, segmentClosest } from './talentGeometry';
import type { Talents } from './talents';

export const B = {
  CAST_DOWN: 'binder.a.1a', HOLDS: 'binder.a.1b', FALL: 'binder.a.2a', BROUGHT: 'binder.a.2b', SUNK: 'binder.a.3b', TARTARUS: 'binder.a.cap',
  WHIRL: 'binder.b.1a', STRIDE: 'binder.b.1b', VOICE: 'binder.b.2a', FETTERED: 'binder.b.2b', FLAIL: 'binder.b.3b', SHATTER: 'binder.b.cap',
  BARBED: 'binder.c.1a', FROST: 'binder.c.1b', PROCESSION: 'binder.c.2a', WHIP: 'binder.c.2b', HYMN: 'binder.c.3b', WIND: 'binder.c.cap',
} as const;

const ticks = (s: number) => Math.round(s * TICK_HZ);

export class BinderTalents {
  private nextCast = 1;
  /** Own bind sources by enemy slot: the Binder's index, cast, incarnation, ordinary end, cast start and ceiling. */
  private readonly ownBy: Int8Array;
  private readonly ownCast: Int32Array;
  private readonly ownInc: Uint32Array;
  private readonly ownUntil: Int32Array;
  private readonly ownCeil: Int32Array;
  /** An own pull in progress (Chains, Ring, Procession): the cast that records its bind on arrival. */
  private readonly pullCast: Int32Array;
  private readonly pullStart: Int32Array;
  private readonly pullBy: Int8Array;
  /** The Wind of Cocytus: binds due when each cast's silence ends. */
  private readonly winds: Array<{ s: number; inc: number; tick: number; room: number; by: SimPlayer }> = [];
  /** Boundary Chain: enemies (by incarnation) each chain already bound. */
  private readonly crossed = new Map<number, Set<number>>();
  private readonly frostOrder: number[] = [];

  constructor(private readonly sim: Simulation, private readonly t: Talents, slots: number) {
    this.ownBy = new Int8Array(slots).fill(-1);
    this.ownCast = new Int32Array(slots);
    this.ownInc = new Uint32Array(slots);
    this.ownUntil = new Int32Array(slots);
    this.ownCeil = new Int32Array(slots);
    this.pullCast = new Int32Array(slots);
    this.pullStart = new Int32Array(slots);
    this.pullBy = new Int8Array(slots).fill(-1);
  }

  private has(p: SimPlayer, id: string): boolean {
    return p.classId === 'binder' && p.kit.active.has(id);
  }

  private newCast(): number {
    return this.nextCast++;
  }

  // ------------------------------------------------------------------ own bind sources

  /** Whether enemy `s` is bound by Binder `p`'s own still-active source (any Binder when `p` is omitted). */
  ownBound(s: number, p?: SimPlayer): boolean {
    const sim = this.sim;
    // An own pull in progress counts as bound (Chains' targets are bound during their 0.3 s pull).
    if (sim.ePullStart[s] >= 0 && this.pullBy[s] >= 0) return !p || this.pullBy[s] === p.index;
    return this.ownBy[s] >= 0 && this.ownInc[s] === sim.eIncarnation[s] && (!p || this.ownBy[s] === p.index) && sim.tick < this.ownUntil[s];
  }

  /** The Binder whose own source binds `s` now, or undefined. */
  private binderOf(s: number): SimPlayer | undefined {
    if (!this.ownBound(s)) return undefined;
    const by = this.sim.ePullStart[s] >= 0 && this.pullBy[s] >= 0 ? this.pullBy[s] : this.ownBy[s];
    return this.sim.slots[by];
  }

  /** An own instant bind: roots for `seconds` and records the source (cast, start and six-second ceiling). */
  bind(p: SimPlayer, s: number, seconds: number, cast: number, start = this.sim.tick): void {
    const sim = this.sim;
    if (!sim.eAlive[s] || isBossBody(sim.eType[s])) return;
    sim.root(s, seconds, p.index);
    this.record(p, s, sim.tick + ticks(seconds), cast, start);
  }

  private record(p: SimPlayer, s: number, until: number, cast: number, start: number): void {
    const sim = this.sim;
    // A shorter own bind never cuts a longer one short.
    if (this.ownInc[s] === sim.eIncarnation[s] && this.ownBy[s] === p.index && this.ownUntil[s] > until) return;
    this.ownBy[s] = p.index; this.ownCast[s] = cast; this.ownInc[s] = sim.eIncarnation[s];
    this.ownUntil[s] = until; this.ownCeil[s] = start + ticks(BINDER.ceiling);
  }

  /** An own pull starts (Chains, Ring, Procession): its bind is recorded when the pull completes. */
  pulled(p: SimPlayer, s: number, cast: number): void {
    this.pullCast[s] = cast; this.pullStart[s] = this.sim.tick; this.pullBy[s] = p.index;
    this.sim.streaks.touch(s, p.index);
  }

  /** A pull completed (the base roots for 2.5 s): an own pull records its source from now. */
  pullDone(s: number): void {
    const sim = this.sim, by = this.pullBy[s];
    if (by < 0) return;
    this.pullBy[s] = -1;
    const p = sim.slots[by];
    if (p) { this.record(p, s, sim.tick + ticks(CHAINS_ROOT), this.pullCast[s], this.pullStart[s]); sim.streaks.touch(s, by); }
  }

  // ------------------------------------------------------------------ the Chain Gun and the Scourge

  /** The Chain Gun with Barbed Rounds: a bullet that hits goes on into the next enemy (2 at most); every hit slows. */
  chainGun(p: SimPlayer): void {
    const sim = this.sim, w = WEAPONS.binder, root = this.t.root(p, 'LMB');
    const ex = p.x, ey = p.y, ez = p.z + PLAYER_EYE;
    const yaw = w.spreadYaw > 0 ? p.yaw + sim.spreadDraw(p, 0, 0) * w.spreadYaw : p.yaw;
    const pitch = w.spreadPitch > 0 ? p.pitch + sim.spreadDraw(p, 0, 1) * w.spreadPitch : p.pitch;
    const [dx, dy, dz] = aimDir(yaw, pitch);
    const max = this.has(p, B.BARBED) ? 2 : w.maxHits;
    const hits = sim.rayEnemies(ex, ey, ez, dx, dy, dz, w.range, max);
    let stop = raycastTerrain(sim.map, ex, ey, ez, dx, dy, dz, w.range);
    if (hits.length >= max) stop = this.t.rayTo(hits[hits.length - 1], ex, ey, ez, dx, dy, dz);
    const souls = new Set<SimPlayer>();
    sim.soulsOnRay(p, ex, ey, ez, dx, dy, dz, stop, souls);
    sim.globesOnRay(p, ex, ey, ez, dx, dy, dz, stop);
    sim.propsOnRay(ex, ey, ez, dx, dy, dz, stop);
    for (const s of hits) {
      this.t.primary(root, s, w.damage, w.damage);
      if (w.slow > 0 && sim.eAlive[s]) sim.slow(s, w.slow, p.index);
    }
    for (const o of souls) sim.addRevive(o, reviveHit(w.interval, false), p);
    this.t.finish(root);
  }

  /** Seconds between Scourge swings: 1.2 with Whirl (classes-binder.md `b.1a`), else the base 0.8. */
  scourgeInterval(p: SimPlayer): number {
    return this.has(p, B.WHIRL) ? BINDER.whirlInterval : SECONDARIES.binder.interval;
  }

  /**
   * The Scourge (M9 §2.6) and its Delivery: Whirl (360°, 3 m), The Long Flail (4 m, ±60°) or The Whip
   * (a 7 m line, 0.75 m either side). 25 to every enemy it reaches, slowing survivors; kills burst heavy.
   */
  scourge(p: SimPlayer): void {
    const sim = this.sim, w = SECONDARIES.binder, root = this.t.root(p, 'RMB');
    const cx = p.x, cy = p.y, cz = p.z + PLAYER_HEIGHT / 2, ax = Math.cos(p.yaw), ay = Math.sin(p.yaw);
    const whirl = this.has(p, B.WHIRL), whip = this.has(p, B.WHIP);
    const range = this.has(p, B.FLAIL) ? BINDER.flail : w.range, cosMax = Math.cos(SCOURGE_HALF_ARC);
    const inArc = (x: number, y: number): boolean => {
      if (whirl) return true;
      const dx = x - cx, dy = y - cy, length = Math.hypot(dx, dy);
      return length < 1e-9 || (dx * ax + dy * ay) / length >= cosMax - 1e-9;
    };
    if (whip) sim.props.area(cx + ax * BINDER.whipLength / 2, cy + ay * BINDER.whipLength / 2, cz, BINDER.whipLength / 2, sim.tick, 'player',
      (q) => segmentClosest(q.x, q.y, cx, cy, cx + ax * BINDER.whipLength, cy + ay * BINDER.whipLength).d2 <= 1);
    else sim.props.area(cx, cy, cz, range, sim.tick, 'player', (q) => inArc(q.x, q.y));
    const hit: Array<{ s: number; d: number }> = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k], def = ENEMIES[sim.eType[s]];
      if (whip) {
        const { d2, t } = segmentClosest(sim.eX[s], sim.eY[s], cx, cy, cx + ax * BINDER.whipLength, cy + ay * BINDER.whipLength);
        const reach = BINDER.whipHalf + def.radius;
        if (d2 > reach * reach || cz < sim.eZ[s] - w.range || cz > sim.eZ[s] + def.height + w.range) continue;
        hit.push({ s, d: t });
        continue;
      }
      const d = distToCylinder(cx, cy, cz, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height);
      if (d > range || !inArc(sim.eX[s], sim.eY[s])) continue;
      hit.push({ s, d });
    }
    hit.sort((a, b) => a.d - b.d);
    for (const { s } of hit) {
      this.t.primary(root, s, w.damage, Infinity);
      if (sim.eAlive[s]) sim.slow(s, w.slow, p.index);
    }
    if (whirl || whip) this.t.fx(p, whirl ? 'whirl' : 'whip', [cx, cy, p.z, ax, ay, 0]);
    this.t.finish(root);
  }

  // ------------------------------------------------------------------ Q: Chains' shapes, Ring and Boundary

  /** Chains' pile point: Cast Down drops it where the crosshair meets the floor, 1.5–15 m away. */
  chainsDestination(p: SimPlayer): [number, number] | null {
    if (!this.has(p, B.CAST_DOWN)) return null;
    const [x, y] = aimedWalk(this.sim.map, p.x, p.y, p.z, p.yaw, p.pitch, BINDER.castDownMin, BINDER.castDown);
    return [x, y];
  }

  /** All of Tartarus: Chains reaches every direction (cooldown 12 s). */
  allOfTartarus(p: SimPlayer): boolean {
    return this.has(p, B.TARTARUS) && p.kit.q === 'chains';
  }

  /** Chains of Tartarus cast: own pulls, and The Procession's extras into a file behind each target. */
  chained(p: SimPlayer, targets: number[], dx: number, dy: number, floorZ: number): void {
    const cast = this.newCast();
    for (const s of targets) this.pulled(p, s, cast);
    if (this.has(p, B.PROCESSION)) this.procession(p, targets.map((s) => [s, dx, dy, floorZ] as const), cast, targets);
  }

  /**
   * The Procession: for each primary target an unbound ground enemy within 3 m behind it (along the
   * caster-to-target bearing, ±15°, in sight) is pulled to 1 m behind the target's destination and
   * bound from there; at most one per target and 40 per action, never a reserved target twice.
   */
  private procession(p: SimPlayer, targets: ReadonlyArray<readonly [number, number, number, number]>, cast: number, reserved: number[]): void {
    const sim = this.sim, taken = new Set(reserved), pts: number[] = [];
    let n = 0;
    for (const [s, dx, dy, floorZ] of targets) {
      if (n >= BINDER.processionMax) break;
      let bx = sim.eX[s] - p.x, by = sim.eY[s] - p.y;
      const len = Math.hypot(bx, by);
      if (len < 1e-6) { bx = Math.cos(p.yaw); by = Math.sin(p.yaw); } else { bx /= len; by /= len; }
      let best = -1, bestD = Infinity;
      for (let k = 0; k < sim.activeCount; k++) {
        const o = sim.active[k];
        if (taken.has(o) || sim.isRooted(o) || ENEMIES[sim.eType[o]].flying || isBossBody(sim.eType[o])) continue;
        const ox = sim.eX[o] - sim.eX[s], oy = sim.eY[o] - sim.eY[s], d = Math.hypot(ox, oy);
        if (d > BINDER.processionBehind || d < 1e-6 || (ox * bx + oy * by) / d < Math.cos(BINDER.processionCone)) continue;
        if (!lineOfSight(sim.map, sim.eX[s], sim.eY[s], sim.eZ[s] + 0.8, sim.eX[o], sim.eY[o], sim.eZ[o] + 0.8)) continue;
        if (d < bestD || (d === bestD && o < best)) { best = o; bestD = d; }
      }
      if (best < 0) continue;
      taken.add(best);
      n++;
      const [tx, ty] = walkDestination(sim.map, dx, dy, Math.atan2(by, bx), BINDER.processionGap);
      sim.pull(best, tx, ty, floorZ);
      this.pulled(p, best, cast);
      pts.push(sim.eX[best], sim.eY[best], sim.eZ[best], tx, ty, floorZ);
    }
    this.t.fx(p, 'procession', pts);
  }

  /** Q for Ring of the Giants and The Boundary Chain; false lets Chains of Tartarus run. */
  useQ(p: SimPlayer): boolean {
    const sim = this.sim;
    if (p.kit.q === 'ring') {
      if (p.cdQ > 1e-6) return true;
      const cast = this.newCast(), cz = p.z + PLAYER_HEIGHT / 2, targets: number[] = [];
      for (let k = 0; k < sim.activeCount; k++) {
        const s = sim.active[k], def = ENEMIES[sim.eType[s]];
        if (isBossBody(sim.eType[s])) continue;
        if (distToCylinder(p.x, p.y, cz, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) > RING.radius) continue;
        if (!lineOfSight(sim.map, p.x, p.y, cz, sim.eX[s], sim.eY[s], sim.eZ[s] + def.height / 2)) continue;
        targets.push(s);
      }
      const dest: Array<readonly [number, number, number, number]> = [];
      for (const s of targets) {
        const bearing = Math.atan2(sim.eY[s] - p.y, sim.eX[s] - p.x);
        const [x, y, z] = walkDestination(sim.map, p.x, p.y, Math.hypot(sim.eX[s] - p.x, sim.eY[s] - p.y) < 1e-6 ? (s % 16) * Math.PI / 8 : bearing, RING.ring);
        sim.pull(s, x, y, z);
        this.pulled(p, s, cast);
        dest.push([s, x, y, z]);
      }
      if (this.has(p, B.PROCESSION)) this.procession(p, dest, cast, targets);
      p.cdQ = RING.cooldown;
      sim.emit('all', { type: 'abilityUsed', playerId: p.id, slot: 'Q', x: p.x, y: p.y, z: p.z, targets });
      return true;
    }
    if (p.kit.q === 'boundary') {
      if (p.cdQ > 1e-6) return true;
      const [cx, cy, cz] = aimedWalk(sim.map, p.x, p.y, p.z, p.yaw, p.pitch, BOUNDARY.min, BOUNDARY.max);
      if (!lineOfSight(sim.map, p.x, p.y, p.z + PLAYER_EYE, cx, cy, cz + 0.3)) return true;
      const [ax, ay, az, bx, by, bz] = boundaryEnds(sim.map, cx, cy, p.yaw, BOUNDARY.length);
      for (const a of [...this.t.areas.values()]) if (a.kind === 'boundary' && a.playerId === p.id) this.endArea(a, 'replaced');
      const area = this.t.addArea({ kind: 'boundary', playerId: p.id, x: ax, y: ay, z: az, x1: bx, y1: by, z1: bz, startTick: sim.tick, endTick: sim.tick + ticks(BOUNDARY.life) });
      this.crossed.set(area.id, new Set());
      p.cdQ = BOUNDARY.cooldown;
      sim.emit('all', { type: 'abilityUsed', playerId: p.id, slot: 'Q', x: cx, y: cy, z: cz, targets: [] });
      return true;
    }
    return false;
  }

  private endArea(a: TalentArea, reason: string): void {
    this.crossed.delete(a.id);
    const i = this.frostOrder.indexOf(a.id);
    if (i >= 0) this.frostOrder.splice(i, 1);
    this.t.endArea(a, reason);
  }

  // ------------------------------------------------------------------ E: Discord's payloads and the Well

  /** E for the Well of the Giants; false lets Discord run. */
  useE(p: SimPlayer): boolean {
    const sim = this.sim;
    if (p.kit.e !== 'well') return false;
    if (p.cdE > 1e-6) return true;
    const [x, y, z] = aimedWalk(sim.map, p.x, p.y, p.z, p.yaw, p.pitch, WELL.min, WELL.max);
    // An aim the eye can't see spends nothing.
    if (!lineOfSight(sim.map, p.x, p.y, p.z + PLAYER_EYE, x, y, z + 0.3)) return true;
    for (const a of [...this.t.areas.values()]) if (a.kind === 'well' && a.playerId === p.id) this.endArea(a, 'replaced');
    this.t.addArea({ kind: 'well', playerId: p.id, x, y, z, x1: WELL.radius, y1: 0, z1: 0, startTick: sim.tick, endTick: sim.tick + ticks(WELL.life) });
    p.cdE = WELL.cooldown;
    sim.emit('all', { type: 'abilityUsed', playerId: p.id, slot: 'E', x, y, z, targets: [] });
    return true;
  }

  /**
   * After Discord silenced `targets`: Voice of the Pit throws the close front ranks 4 m back (flyers
   * slide), Shattered Hymn breaks enemy projectiles in the cone, and The Wind of Cocytus schedules each
   * target's bind for when this cast's silence ends.
   */
  discord(p: SimPlayer, targets: number[], silence: number): void {
    const sim = this.sim, ex = p.x, ey = p.y, ez = p.z + PLAYER_EYE, ax = Math.cos(p.yaw), ay = Math.sin(p.yaw);
    if (this.has(p, B.VOICE)) {
      const cast = this.t.launches.newCast(), launched: number[] = [];
      for (const s of targets) {
        const def = ENEMIES[sim.eType[s]];
        if (isBossBody(sim.eType[s]) || sim.isRooted(s)) continue;
        if (distToCylinder(ex, ey, ez, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) > BINDER.voiceRange) continue;
        if (def.flying) sim.knockAway(s, p.x, p.y, BINDER.voice, 0.4);
        else if (this.t.launches.launchFrom(s, p.x, p.y, BINDER.voice, p, 'qe', cast)) launched.push(s);
      }
      this.t.launched(p, launched);
    }
    if (this.has(p, B.HYMN)) {
      const cosMax = Math.cos(35 * Math.PI / 180), broken: number[] = [];
      for (const g of [...sim.projectiles]) {
        const kind = sim.pKind[g];
        if ((kind !== PROJ_GLOBE && kind !== PROJ_ARROW) || sim.projectileOwner(g) >= 0) continue;
        const dx = sim.pX[g] - ex, dy = sim.pY[g] - ey, dz = sim.pZ[g] - ez, d = Math.hypot(dx, dy, dz), h = Math.hypot(dx, dy);
        if (d > 30 || (h > 1e-9 && (dx * ax + dy * ay) / h < cosMax - 1e-9)) continue;
        if (!lineOfSight(sim.map, ex, ey, ez, sim.pX[g], sim.pY[g], sim.pZ[g])) continue;
        broken.push(sim.pX[g], sim.pY[g], sim.pZ[g]);
        if (kind === PROJ_GLOBE) sim.shootDownGlobe(g, p); else sim.removeProjectile(g);
      }
      this.t.fx(p, 'hymn', broken);
    }
    if (this.has(p, B.WIND)) {
      for (const s of targets) if (!isBossBody(sim.eType[s])) this.winds.push({ s, inc: sim.eIncarnation[s], tick: sim.tick + ticks(silence), room: sim.roomAt(sim.eX[s], sim.eY[s]), by: p });
    }
  }

  // ------------------------------------------------------------------ kills

  /**
   * A Binder root's kill bundle (its first kill tick): The Chain Holds passes each own bind (0.3 s or
   * more left) to the nearest unbound enemy within 4 m; The Chains Shatter rings each bound victim for
   * 20, merged so another enemy takes one shard per action; Frost of Cocytus seeds up to eight frost patches.
   */
  bundle(p: SimPlayer, victims: ReadonlyArray<{ s: number; inc: number; x: number; y: number; z: number; room: number; bound: boolean }>): void {
    const sim = this.sim;
    if (this.has(p, B.HOLDS)) {
      const used = new Set<number>(), arcs: number[] = [];
      let n = 0;
      for (const v of victims) {
        if (n >= BINDER.holdsMax) break;
        if (this.ownInc[v.s] !== v.inc || this.ownBy[v.s] !== p.index) continue;
        const left = this.ownUntil[v.s] - sim.tick;
        if (left < ticks(BINDER.holdsMin)) continue;
        let best = -1, bestD = Infinity;
        for (let k = 0; k < sim.activeCount; k++) {
          const s = sim.active[k];
          if (used.has(s) || sim.isRooted(s) || isBossBody(sim.eType[s]) || sim.roomAt(sim.eX[s], sim.eY[s]) !== v.room) continue;
          const d = Math.hypot(sim.eX[s] - v.x, sim.eY[s] - v.y, sim.eZ[s] - v.z);
          if (d > BINDER.holdsRange || d > bestD || (d === bestD && s > best)) continue;
          if (!lineOfSight(sim.map, v.x, v.y, v.z + 0.8, sim.eX[s], sim.eY[s], sim.eZ[s] + ENEMIES[sim.eType[s]].height / 2)) continue;
          best = s; bestD = d;
        }
        if (best < 0) continue;
        used.add(best); n++;
        // The transfer keeps the original cast's end and ceiling: no refresh.
        sim.root(best, left / TICK_HZ, p.index);
        this.ownBy[best] = p.index; this.ownCast[best] = this.ownCast[v.s]; this.ownInc[best] = sim.eIncarnation[best];
        this.ownUntil[best] = this.ownUntil[v.s]; this.ownCeil[best] = this.ownCeil[v.s];
        arcs.push(v.x, v.y, v.z + 0.8, sim.eX[best], sim.eY[best], sim.eZ[best] + 0.8);
      }
      this.t.fx(p, 'holds', arcs);
    }
    if (this.has(p, B.SHATTER)) {
      const done = new Set<number>(), targets: Array<[number, number, number]> = [], pts: number[] = [];
      for (const v of victims.filter((x) => x.bound).slice(0, BINDER.shatterMax)) {
        pts.push(v.x, v.y, v.z);
        for (let k = 0; k < sim.activeCount; k++) {
          const s = sim.active[k], def = ENEMIES[sim.eType[s]];
          if (done.has(s) || distToCylinder(v.x, v.y, v.z + 0.8, sim.eX[s], sim.eY[s], sim.eZ[s], def.radius, def.height) > BINDER.shatterRadius) continue;
          if (sim.roomAt(sim.eX[s], sim.eY[s]) !== v.room || !lineOfSight(sim.map, v.x, v.y, v.z + 0.8, sim.eX[s], sim.eY[s], sim.eZ[s] + def.height / 2)) continue;
          done.add(s);
          targets.push([s, v.x, v.y]);
        }
      }
      for (const [s, x, y] of targets) sim.damageEnemy(s, BINDER.shatterDamage, p.index, Infinity, x, y);
      this.t.fx(p, 'shatter', pts);
    }
    if (this.has(p, B.FROST)) {
      let n = 0;
      for (const v of victims) {
        if (n >= BINDER.frostMax) break;
        const cell = Math.floor(v.y) * sim.map.w + Math.floor(v.x), floor = sim.map.floor[cell];
        if (!Number.isFinite(floor) || sim.map.solid[cell] || sim.map.roomOf[cell] !== v.room) continue;
        n++;
        this.frost(p, v.x, v.y, floor);
      }
    }
  }

  /** A frost patch: an origin within 1.5 m of a patch refreshes it; at most 8 per Binder, oldest out. */
  private frost(p: SimPlayer, x: number, y: number, z: number): void {
    const sim = this.sim, end = sim.tick + ticks(BINDER.frostTime);
    let near: TalentArea | undefined, nearD = Infinity;
    for (const a of this.t.areas.values()) {
      if (a.kind !== 'frost' || a.playerId !== p.id) continue;
      const d = Math.hypot(a.x - x, a.y - y);
      if (d <= BINDER.frostMerge && (d < nearD || (d === nearD && near && a.id < near.id))) { near = a; nearD = d; }
    }
    if (near) {
      near.endTick = end;
      sim.emit('all', { type: 'talentArea', area: { ...near }, end: false, reason: 'refresh' });
      return;
    }
    const own = this.frostOrder.filter((id) => this.t.areas.get(id)?.playerId === p.id);
    if (own.length >= BINDER.frostMax) { const old = this.t.areas.get(own[0]); if (old) this.endArea(old, 'oldest'); }
    const a = this.t.addArea({ kind: 'frost', playerId: p.id, x, y, z, x1: BINDER.frostRadius, y1: 0, z1: 0, startTick: sim.tick, endTick: end });
    this.frostOrder.push(a.id);
  }

  // ------------------------------------------------------------------ landings, melee and flyers

  /** Where They Fall: a direct launch landing within 20 m of the Binder is chained for 2 s. */
  landControl(l: Landing): void {
    const sim = this.sim;
    if (l.kind === 'other' || !this.t.launches.alive(l)) return;
    for (const p of sim.players) {
      if (!this.has(p, B.FALL) || p.dead || !p.connected) continue;
      if (Math.hypot(l.x - p.x, l.y - p.y, l.z - p.z) > BINDER.fallRange || sim.roomAt(p.x, p.y) !== l.room) continue;
      if (!lineOfSight(sim.map, p.x, p.y, p.z + PLAYER_EYE, l.x, l.y, l.z + 0.8)) continue;
      this.bind(p, l.slot, BINDER.fallBind, this.newCast());
      this.t.fx(p, 'fall', [l.x, l.y, l.z]);
      return;
    }
  }

  /** Fettered Hands: an enemy bound by a Binder with the node doesn't strike in melee. */
  fettered(s: number): boolean {
    const p = this.binderOf(s);
    return !!p && this.has(p, B.FETTERED);
  }

  /** Brought Low: the hover height a flyer keeps; on the floor while its Binder's own bind lasts. */
  grounded(s: number): boolean {
    const p = this.binderOf(s);
    return !!p && this.has(p, B.BROUGHT);
  }

  /** The vertical speed a flyer may change height at: 0.3 s down to the floor when brought low. */
  climbRate(s: number): number {
    return this.grounded(s) ? 4 / BINDER.broughtDrop : CHERUB_CLIMB;
  }

  // ------------------------------------------------------------------ per tick

  update(): void {
    const sim = this.sim;
    for (let i = this.winds.length - 1; i >= 0; i--) {
      const w = this.winds[i];
      if (sim.tick < w.tick) continue;
      this.winds.splice(i, 1);
      if (!sim.eAlive[w.s] || sim.eIncarnation[w.s] !== w.inc || sim.roomAt(sim.eX[w.s], sim.eY[w.s]) !== w.room) continue;
      this.bind(w.by, w.s, BINDER.windBind, this.newCast());
      this.t.fx(w.by, 'wind', [sim.eX[w.s], sim.eY[w.s], sim.eZ[w.s]]);
    }
  }

  /**
   * After movement and hazards: the Well drags and pools, frost slows and pools, the Boundary binds
   * crossings and pools its strip, then Sunk in the Lake holds own binds in any pool up to their ceiling.
   */
  pools(): void {
    const sim = this.sim;
    for (const a of [...this.t.areas.values()]) {
      if (sim.tick >= a.endTick) continue;
      if (a.kind === 'well') this.well(a);
      else if (a.kind === 'frost') this.frostTick(a);
      else if (a.kind === 'boundary') this.boundary(a);
    }
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (!sim.ePooled[s] || this.ownBy[s] < 0 || this.ownInc[s] !== sim.eIncarnation[s] || sim.tick >= this.ownUntil[s]) continue;
      const p = sim.slots[this.ownBy[s]];
      if (!p || !this.has(p, B.SUNK) || sim.tick >= this.ownCeil[s]) continue;
      // Held while pooled, never past the cast's six-second ceiling; leaving keeps what is left.
      const hold = Math.min(this.ownCeil[s], sim.tick + 2);
      if (hold > this.ownUntil[s]) { this.ownUntil[s] = hold; sim.eRootUntil[s] = Math.max(sim.eRootUntil[s], hold); }
    }
  }

  private feetOn(s: number, z: number, tolerance: number): boolean {
    return Math.abs(this.sim.eZ[s] - z) <= tolerance;
  }

  private well(a: TalentArea): void {
    const sim = this.sim, step = WELL.drag / TICK_HZ;
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k], def = ENEMIES[sim.eType[s]];
      if (def.flying && !this.grounded(s)) continue;
      if (isBossBody(sim.eType[s])) continue;
      const dx = a.x - sim.eX[s], dy = a.y - sim.eY[s], d = Math.hypot(dx, dy);
      if (d > a.x1 || !this.feetOn(s, a.z, 2)) continue;
      if (!lineOfSight(sim.map, a.x, a.y, a.z + 0.5, sim.eX[s], sim.eY[s], sim.eZ[s] + 0.5)) continue;
      if (this.feetOn(s, sim.map.floor[Math.floor(sim.eY[s]) * sim.map.w + Math.floor(sim.eX[s])], 0.3)) { sim.ePooled[s] = 1; sim.streaks.touchId(s, a.playerId); }
      if (def.flying || sim.isRooted(s) || d <= WELL.stop) continue;
      const m = Math.min(step, d - WELL.stop);
      sim.drift(s, (dx / d) * m, (dy / d) * m);
    }
  }

  private frostTick(a: TalentArea): void {
    const sim = this.sim;
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (isBossBody(sim.eType[s]) || Math.hypot(sim.eX[s] - a.x, sim.eY[s] - a.y) > a.x1 + ENEMIES[sim.eType[s]].radius) continue;
      if (!this.feetOn(s, a.z, 0.3)) continue;
      sim.ePooled[s] = 1;
      sim.slow(s, 2 / TICK_HZ, sim.playerById(a.playerId)?.index);
    }
  }

  private boundary(a: TalentArea): void {
    const sim = this.sim, done = this.crossed.get(a.id) ?? new Set<number>(), owner = sim.playerById(a.playerId);
    if (!owner) return;
    const bound: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k], def = ENEMIES[sim.eType[s]];
      if ((def.flying && !this.grounded(s)) || isBossBody(sim.eType[s])) continue;
      const { d2, t } = segmentClosest(sim.eX[s], sim.eY[s], a.x, a.y, a.x1, a.y1);
      const reach = def.radius + BOUNDARY.margin;
      if (d2 > reach * reach || !this.feetOn(s, a.z + (a.z1 - a.z) * t, BOUNDARY.feet)) continue;
      sim.ePooled[s] = 1;
      sim.streaks.touch(s, owner.index);
      const key = sim.eIncarnation[s];
      if (done.has(key)) continue;
      done.add(key);
      this.bind(owner, s, BOUNDARY.bind, a.id + 1_000_000, a.startTick);
      bound.push(s);
    }
    if (bound.length && this.has(owner, B.PROCESSION)) {
      this.procession(owner, bound.map((s) => [s, sim.eX[s], sim.eY[s], sim.eZ[s]] as const), a.id + 1_000_000, bound);
    }
    if (bound.length) this.t.fx(owner, 'fall', bound.flatMap((s) => [sim.eX[s], sim.eY[s], sim.eZ[s]]));
  }

  roomCleared(): void {
    this.winds.length = 0;
    this.crossed.clear();
    this.frostOrder.length = 0;
  }
}
