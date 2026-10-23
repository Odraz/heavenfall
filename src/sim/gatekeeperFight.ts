/**
 * The authored Gatekeeper encounter (rogue bosses.md §3), host only: the fixed 28 s cycle anchored to the
 * seal, one cast slot (Volley, Toll, Called, Judgment), the 50% transition, the Toll's ring, the Call's
 * hold and Seal, the phase-2 Watchers and their tethers, the Host, and the completion gate that keeps a
 * fast build from skipping the encounter. Hits on players are resolved in each player's own view time
 * (the ring they saw, the Judgment they saw end), bounded by lag compensation's rewind, so a player who
 * jumped or hid on their screen is safe on the host too. Clients only present and predict this state.
 */
import {
  BOSS_CAST_CALL, BOSS_CAST_JUDGMENT, BOSS_CAST_TOLL, BOSS_CAST_VOLLEY, BOSS_FLAG_DEFERRED, BOSS_FLAG_WATCHERS,
  BOSS_MOTE_CAP, BOSS_PHASE_INVULNERABLE, bossFactor, C_CALL, C_CALL_DEADLINE, C_HOST, C_JUDGMENT, C_PHASE_ENTRY, C_TOLL_1,
  C_TOLL_1_DEADLINE, C_TOLL_2, C_TOLL_2_DEADLINE, C_VOLLEYS, C_WATCHERS, CALL_HEAL, CAST_TICKS, CYCLE_TICKS, cylinderClear,
  dragStep, DRAG_SPEED, EV_BEFORE_WATCHERS, EV_CALL, EV_HOST, EV_JUDGMENT, EV_TOLL_1, EV_TOLL_2, EV_VOLLEY,
  EV_WATCHERS, GATEKEEPER_HP, HOLD_LIFT, HOLD_TICKS, HOST, HOST_ARRIVAL_TICKS, JUDGMENT_BREAK, PHASE_THRESHOLD, RING_HEIGHT,
  RING_TICKS, ringCrosses, ringFloor, ringRadius, SEAL_HEIGHT, SEAL_HP_PER_HEAD, SEAL_WAVE, sealPoint, TETHER_TOTAL,
  TOLL_DAMAGE, TRANSITION_TICKS, WATCHER_ACCESS, WATCHER_GAZE, WATCHER_HEIGHT, WATCHER_HOVER, WATCHER_HP, WATCHER_OPENING,
  WATCHER_RADIUS, DRAG_STOP,
} from '../data/gatekeeper';
import { ST_ATTACKING, ST_IDLE, ST_WINDUP } from '../data/enemies';
import { HURT_RANGED, HURT_WORLD } from '../net/protocol';
import { PLAYER_EYE, PLAYER_HEIGHT, PLAYER_RADIUS, TICK_HZ } from './constants';
import { MAX_REWIND_TICKS, viewLag } from './lagComp';
import { lineOfSight } from './los';
import { groundHeight } from './movement';
import { partyMultiplier } from './party';
import type { Simulation, SimPlayer } from './sim';

const VOLLEY_ORBS = 8;
const VOLLEY_SPREAD = (25 * Math.PI) / 180;
const VOLLEY_DAMAGE = 15;
const VOLLEY_RADIUS = 0.3;
/** The Edict of Swift Hymns' projectile speed (game.md §2.5). */
const SWIFT_HYMNS = 1.3;
const GLOBE_SPEED = 6;
/** A ring is kept for its 7 s plus the rewind it is resolved over; a second may roll meanwhile. */
const RING_LIFE = RING_TICKS + MAX_REWIND_TICKS;
/** Snapshot projectile kind of a globe (sim.ts PROJ_GLOBE; not imported, sim.ts imports this module). */
const PROJ_GLOBE = 1;

export interface BossCast {
  kind: number;
  start: number;
  end: number;
  /** The Volley's or the Call's target player ID, −1 for none. */
  target: number;
}

/** A rolling Toll: its impact tick, the players it hit and the radius each player's screen had reached. */
interface Ring { id: number; impact: number; hit: number; seen: number[] }

/** A Call's hold (§3.5): the held player, its deadline, fixed feet height and the Seal it hangs on. */
export interface BossHold {
  playerId: number;
  start: number;
  until: number;
  z: number;
  seal: number;
  sealIncarnation: number;
  /** `sealScaleHeads`: the non-increasing living headcount the Seal's HP was scaled to. */
  heads: number;
  sealMax: number;
}

/** One Judgment's end (body and/or gaze), resolved per player when that player's screen reaches its tick. */
interface PendingJudgment { tick: number; body: boolean; eyes: Array<[number, number, number]>; done: number }

export class GatekeeperFight {
  active = false;
  room = -1;
  maxHp = 0;
  factor = 1;
  partySize = 1;
  addCap = 0;
  phase = 1;
  transitionUntil = 0;
  cycleStart = 0;
  /** EV_* bits consumed in the current cycle. */
  consumed = 0;
  cast: BossCast | null = null;
  /** Damage the body took during the Judgment cast in progress. */
  judgmentDamage = 0;
  /** The Call's living headcount captured at its cast start. */
  private callHeads = 0;
  private rings: Ring[] = [];
  private ringId = 0;
  private lastImpact = -Infinity;
  hold: BossHold | null = null;
  private lastCalled = -1;
  // The completion gate (§3.2.1): until both resolve, lethal body damage leaves 1 HP.
  callAttempted = false;
  callResolved = false;
  aimResolved = false;
  judgmentsResolved = 0;
  private replacementCall = false;
  // The Watchers' current episode.
  eyes: Array<{ slot: number; incarnation: number; opensAt: number }> = [];
  episode = 0;
  private episodeCount = 0;
  private episodeDamage = 0;
  private episodeDealt = 0;
  private episodeKills = 0;
  private watchersAnnounced = false;
  private pending: PendingJudgment[] = [];
  /** The tick of the latest scheduled Judgment resolution. */
  private judgedAt = -1;
  private motes = 0;
  private volleyId = 0;
  readonly volleyHits = new Map<number, number>();
  private trumpet = false;

  constructor(private readonly sim: Simulation) {}

  private get slot(): number { return this.sim.bossSlot; }
  private get tick(): number { return this.sim.tick; }
  /** Ticks into the current scheduled cycle. */
  get c(): number { return this.tick - this.cycleStart; }

  /** The seal (§3.4.1): P, f(P), the HP and the add cap are fixed now; the first cycle starts. */
  seal(room: number, partySize: number): number {
    const sim = this.sim;
    this.active = true;
    this.room = room;
    this.partySize = partySize;
    this.factor = bossFactor(partySize);
    this.maxHp = GATEKEEPER_HP * this.factor;
    this.addCap = Math.floor(250 * partyMultiplier(partySize) + 1e-9);
    this.phase = 1;
    this.transitionUntil = 0;
    this.cycleStart = this.tick;
    this.consumed = 0;
    this.cast = null;
    this.trumpet = sim.edicts.includes(5);
    // The seal wave: Choristers and Cherubs on the field points, away from the party.
    sim.queueBossAdds('seal', [0, Math.ceil(SEAL_WAVE.choristers * this.factor - 1e-9), Math.ceil(SEAL_WAVE.cherubs * this.factor - 1e-9)], 0);
    sim.emit('all', { type: 'bossPhase', phase: 1, line: 'Your appeal is denied.' });
    return this.maxHp;
  }

  /** The victory latch or the end of the fight: cancel everything without credit and release the held player safely. */
  end(): void {
    if (!this.active) return;
    this.cancelCast();
    this.release(false);
    this.closeEyes();
    this.rings.length = 0;
    this.pending.length = 0;
    this.volleyHits.clear();
    this.active = false;
  }

  holds(playerId: number): boolean {
    return this.hold?.playerId === playerId;
  }

  isPart(slot: number): boolean {
    return this.hold?.seal === slot || this.eyes.some((e) => e.slot === slot);
  }

  /** A part's damage is refused during its 2 s opening (pale grey). */
  partOpening(slot: number): boolean {
    const eye = this.eyes.find((e) => e.slot === slot);
    return !!eye && this.tick < eye.opensAt;
  }

  /** Whether the completion gate still defers a lethal body hit. */
  get gateClosed(): boolean {
    return !(this.callResolved && this.aimResolved);
  }

  // ---------------------------------------------------------------- body damage

  /** The share of an incoming body hit the Gatekeeper accepts: none while transitioning, clamped at 50% in phase 1 and at 1 HP while the gate is closed. */
  bodyAmount(amount: number): number {
    if (!this.active || this.slot < 0 || amount <= 0) return amount;
    if (this.tick < this.transitionUntil) return 0;
    const hp = this.sim.eHp[this.slot];
    const floor = this.phase === 1 ? this.maxHp * PHASE_THRESHOLD : this.gateClosed ? 1 : -Infinity;
    return Math.max(0, Math.min(amount, hp - floor));
  }

  /** After an accepted body hit: Judgment's break fill, and the 50% threshold. */
  bodyDamaged(amount: number, countsForBreak = true): void {
    if (!this.active || amount <= 0) return;
    if (countsForBreak && this.cast?.kind === BOSS_CAST_JUDGMENT) {
      this.judgmentDamage += amount;
      if (this.judgmentDamage >= JUDGMENT_BREAK * this.maxHp - 1e-9) this.breakJudgment();
    }
    if (this.phase === 1 && this.sim.eHp[this.slot] <= this.maxHp * PHASE_THRESHOLD + 1e-9) this.startTransition();
  }

  /** A Watcher tether (§3.5): its share goes to the body once, with the phase clamps but no break credit or procs. */
  private tether(share: number): void {
    const sim = this.sim, s = this.slot;
    if (s < 0) return;
    const amount = this.bodyAmount(share);
    if (amount <= 0) return;
    sim.bossTether(amount);
    if (sim.bossSlot >= 0) this.bodyDamaged(amount, false);
  }

  // ---------------------------------------------------------------- the tick

  /** One host tick of the encounter, from the Gatekeeper's update. Order follows §3.7's host processing order. */
  update(): void {
    if (!this.active || this.slot < 0) return;
    const sim = this.sim, tick = this.tick;
    if (this.transitionUntil > 0 && tick >= this.transitionUntil) this.endTransition();
    if (tick < this.transitionUntil) { sim.eState[this.slot] = ST_IDLE; return; }
    this.updateHold();
    this.updateEyes();
    this.schedule();
    this.updateCast();
    this.updateRings();
    this.updatePending();
    if (this.c >= CYCLE_TICKS) this.endCycle();
  }

  private silenced(): boolean {
    return this.tick < this.sim.eSilenceUntil[this.slot];
  }

  private living(): SimPlayer[] {
    return this.sim.players.filter((p) => this.sim.livingTargetable(p));
  }

  private due(bit: number, at: number, deadline = at): 'wait' | 'now' | 'missed' | 'done' {
    if (this.consumed & bit) return 'done';
    const c = this.c;
    if (c < at) return 'wait';
    if (c > deadline) { this.consumed |= bit; return 'missed'; }
    return 'now';
  }

  /** Scheduled events (§3.2.1). Judgment cancels any wind-up; the others need a free cast slot. */
  private schedule(): void {
    const sim = this.sim;
    if (this.due(EV_HOST, C_HOST) === 'now') {
      this.consumed |= EV_HOST;
      sim.queueBossAdds('host', [Math.ceil(HOST.blessed * this.factor - 1e-9), 0, Math.ceil(HOST.cherubs * this.factor - 1e-9)], HOST_ARRIVAL_TICKS);
      sim.emit('all', { type: 'hostDescend' });
    }
    if ((this.phase === 2 || this.trumpet) && this.due(EV_WATCHERS, C_WATCHERS) === 'now') { this.consumed |= EV_WATCHERS; this.openEyes(); }
    if (this.due(EV_JUDGMENT, C_JUDGMENT) === 'now') {
      this.consumed |= EV_JUDGMENT;
      this.cancelCast();
      // Silenced at c 25: suppressed for this cycle; the Watchers still judge at c 28.
      if (!this.silenced()) {
        this.startCast(BOSS_CAST_JUDGMENT, -1);
        this.judgmentDamage = 0;
      }
    }
    if (this.cast || this.silenced()) {
      // Silence consumes the events whose deadline passes while it holds them.
      for (const [bit, at, deadline] of [[EV_CALL, C_CALL, C_CALL_DEADLINE], [EV_TOLL_1, C_TOLL_1, C_TOLL_1_DEADLINE], [EV_TOLL_2, C_TOLL_2, C_TOLL_2_DEADLINE]] as const) {
        if (this.due(bit, at, deadline) === 'missed' && bit === EV_CALL) this.callSkipped();
      }
      this.volleyAttempts(false);
      return;
    }
    if (this.replacementCall) {
      this.replacementCall = false;
      this.consumed |= EV_CALL;
      this.startCall();
      return;
    }
    const call = this.due(EV_CALL, C_CALL, C_CALL_DEADLINE);
    if (call === 'missed') this.callSkipped();
    if (call === 'now') { this.consumed |= EV_CALL; this.startCall(); if (this.cast) return; }
    for (const [bit, at, deadline] of [[EV_TOLL_1, C_TOLL_1, C_TOLL_1_DEADLINE], [EV_TOLL_2, C_TOLL_2, C_TOLL_2_DEADLINE]] as const) {
      if (this.due(bit, at, deadline) !== 'now') continue;
      // A delayed second Toll impacts no sooner than one ring's life after the previous impact.
      if (this.tick + CAST_TICKS[BOSS_CAST_TOLL] < this.lastImpact + RING_TICKS) continue;
      this.consumed |= bit;
      this.startCast(BOSS_CAST_TOLL, -1);
      sim.emit('all', { type: 'bossCast', phase: 'start', cast: BOSS_CAST_TOLL, impactTick: this.cast!.end });
      return;
    }
    this.volleyAttempts(true);
  }

  private volleyAttempts(free: boolean): void {
    const sim = this.sim, s = this.slot;
    for (let i = 0; i < C_VOLLEYS.length; i++) {
      const bit = EV_VOLLEY(i);
      if (this.due(bit, C_VOLLEYS[i]) !== 'now') continue;
      this.consumed |= bit;
      if (!free || this.cast) continue;
      if (sim.eTarget[s] >= 0 && sim.eLos[s]) {
        this.startCast(BOSS_CAST_VOLLEY, sim.slots[sim.eTarget[s]]?.id ?? -1);
        sim.emit('all', { type: 'bossCast', phase: 'start', cast: BOSS_CAST_VOLLEY });
      }
    }
  }

  private startCast(kind: number, target: number): void {
    this.cast = { kind, start: this.tick, end: this.tick + CAST_TICKS[kind], target };
    if (kind === BOSS_CAST_JUDGMENT) this.sim.emit('all', { type: 'bossCast', phase: 'start', cast: BOSS_CAST_JUDGMENT });
  }

  /** Ends a wind-up without its effect. A canceled Call resolves its episode for the completion gate. */
  private cancelCast(): void {
    const c = this.cast;
    if (!c) return;
    this.cast = null;
    if (c.kind === BOSS_CAST_CALL) { this.callResolved = true; this.sim.emit('all', { type: 'bossCast', phase: 'interrupted', cast: BOSS_CAST_CALL }); }
    else if (c.kind === BOSS_CAST_TOLL) this.sim.emit('all', { type: 'bossCast', phase: 'interrupted', cast: BOSS_CAST_TOLL });
  }

  private updateCast(): void {
    const sim = this.sim, s = this.slot, c = this.cast;
    sim.eState[s] = ST_IDLE;
    if (!c) return;
    if (this.silenced()) {
      if (c.kind === BOSS_CAST_JUDGMENT) this.breakJudgment();
      else this.cancelCast();
      return;
    }
    if (c.kind === BOSS_CAST_CALL) {
      const target = sim.playerById(c.target);
      if (!sim.livingTargetable(target)) { this.cancelCast(); return; }
      this.callHeads = Math.max(1, Math.min(this.callHeads, this.living().length));
    }
    if (this.tick < c.end) { sim.eState[s] = ST_WINDUP; return; }
    this.cast = null;
    sim.eState[s] = ST_ATTACKING;
    if (c.kind === BOSS_CAST_VOLLEY) this.fireVolley(c.target);
    else if (c.kind === BOSS_CAST_TOLL) {
      this.rings.push({ id: ++this.ringId, impact: this.tick, hit: 0, seen: [-2, -2, -2, -2] });
      this.lastImpact = this.tick;
      sim.emit('all', { type: 'bossCast', phase: 'completed', cast: BOSS_CAST_TOLL, impactTick: this.tick });
    } else if (c.kind === BOSS_CAST_CALL) this.startHold(c.target);
    else if (c.kind === BOSS_CAST_JUDGMENT) this.judge(true);
  }

  // ---------------------------------------------------------------- the Orb Volley

  private fireVolley(targetId: number): void {
    const sim = this.sim, s = this.slot, p = sim.playerById(targetId);
    if (!sim.livingTargetable(p)) return;
    const ox = sim.eX[s], oy = sim.eY[s], oz = sim.eyeZ(s);
    const dx = p.x - ox, dy = p.y - oy, dz = p.z + PLAYER_HEIGHT / 2 - oz, len = Math.hypot(dx, dy, dz);
    if (len < 1e-9) return;
    const id = ++this.volleyId;
    this.volleyHits.set(id, 0);
    const speed = GLOBE_SPEED * (sim.edicts.includes(3) ? SWIFT_HYMNS : 1);
    for (let i = 0; i < VOLLEY_ORBS; i++) {
      const a = -VOLLEY_SPREAD + (2 * VOLLEY_SPREAD * i) / (VOLLEY_ORBS - 1);
      const ca = Math.cos(a), sa = Math.sin(a);
      const slot = sim.spawnProjectile(PROJ_GLOBE, ox, oy, oz, (dx * ca - dy * sa) / len, (dx * sa + dy * ca) / len, dz / len, speed, VOLLEY_RADIUS, VOLLEY_DAMAGE, 60, -1);
      if (slot >= 0) sim.pVolley[slot] = id;
    }
    sim.emit('all', { type: 'bossCast', phase: 'completed', cast: BOSS_CAST_VOLLEY });
  }

  /** A volley's globe may hurt a player at most once across all its globes (§3.5 Volley safety). */
  volleyMayHit(volley: number, p: SimPlayer): boolean {
    if (volley <= 0) return true;
    const mask = this.volleyHits.get(volley);
    if (mask === undefined) return true;
    if (mask & (1 << p.index)) return false;
    this.volleyHits.set(volley, mask | (1 << p.index));
    return true;
  }

  // ---------------------------------------------------------------- Judgment

  /** Discord's silence or the break threshold during the cast: his part ends now; the Watchers still judge at c 28. */
  private breakJudgment(): void {
    if (this.cast?.kind !== BOSS_CAST_JUDGMENT) return;
    this.cast = null;
    this.sim.emit('all', { type: 'bossCast', phase: 'interrupted', cast: BOSS_CAST_JUDGMENT });
  }

  /** The scheduled Judgment resolves (c 28): his gaze if the cast completed, the open eyes' in any case. */
  private judge(body: boolean): void {
    const sim = this.sim;
    const eyes: Array<[number, number, number]> = [];
    for (const e of this.eyes) if (sim.eAlive[e.slot] && sim.eIncarnation[e.slot] === e.incarnation && this.tick >= e.opensAt) eyes.push([sim.eX[e.slot], sim.eY[e.slot], sim.eZ[e.slot] + WATCHER_HEIGHT / 2]);
    if (body) sim.emit('all', { type: 'bossCast', phase: 'completed', cast: BOSS_CAST_JUDGMENT });
    if (body || eyes.length) this.pending.push({ tick: this.tick, body, eyes, done: 0 });
    this.judgedAt = this.tick;
    this.judgmentsResolved++;
  }

  /** Each living player is judged when their own screen has reached the Judgment's tick, at most a rewind late. */
  private updatePending(): void {
    const sim = this.sim, s = this.slot;
    for (let i = this.pending.length - 1; i >= 0; i--) {
      const j = this.pending[i];
      for (const p of sim.players) {
        if (j.done & (1 << p.index)) continue;
        if (!p.connected || p.dead) { j.done |= 1 << p.index; continue; }
        if (this.tick - viewLag(p.view, this.tick) < j.tick && this.tick < j.tick + MAX_REWIND_TICKS) continue;
        j.done |= 1 << p.index;
        const ez = p.z + PLAYER_EYE;
        if (j.body && s >= 0 && lineOfSight(sim.map, p.x, p.y, ez, sim.eX[s], sim.eY[s], sim.eyeZ(s))) {
          if (sim.damagePlayer(p, 0, { x: sim.eX[s], y: sim.eY[s], kind: HURT_WORLD }, true) > 0) sim.emit('all', { type: 'judged', playerId: p.id, by: 'gatekeeper' });
        } else {
          const eye = j.eyes.find(([x, y, z]) => Math.hypot(x - p.x, y - p.y) <= WATCHER_GAZE && lineOfSight(sim.map, x, y, z, p.x, p.y, ez));
          if (!eye) continue;
          if (sim.damagePlayer(p, 0.5 * p.maxHp, { x: eye[0], y: eye[1], kind: HURT_RANGED }) > 0) sim.emit('all', { type: 'judged', playerId: p.id, by: 'watcher' });
        }
      }
      if (j.done === 0b1111 || this.tick >= j.tick + MAX_REWIND_TICKS) this.pending.splice(i, 1);
    }
  }

  // ---------------------------------------------------------------- the Toll

  /** The room's base floor: the flat reward square's. */
  private baseFloor(): number {
    const sim = this.sim, room = sim.map.rooms[this.room];
    const at = room?.points?.reward;
    if (at) return sim.map.floor[(at[1] + 1) * sim.map.w + at[0] + 1];
    const [c, r] = room.entry[0].cells[0];
    return sim.map.floor[r * sim.map.w + c];
  }

  /** Sweeps each player against the front their screen drew this tick (dodge compensation); once per ring. */
  private updateRings(): void {
    const sim = this.sim, s = this.slot;
    const base = this.baseFloor(), ox = sim.eX[s], oy = sim.eY[s];
    for (let i = this.rings.length - 1; i >= 0; i--) {
      const ring = this.rings[i];
      if (this.tick - ring.impact > RING_LIFE) { this.rings.splice(i, 1); continue; }
      for (const p of sim.players) {
        if (!sim.livingTargetable(p) || ring.hit & (1 << p.index)) continue;
        const seen = this.tick - viewLag(p.view, this.tick);
        const r1 = ringRadius(ring.impact, seen);
        const r0 = ring.seen[p.index];
        ring.seen[p.index] = r1;
        if (r1 < 0 || this.holds(p.id)) continue;
        if (!ringCrosses(r0 === -2 ? -1 : r0, r1, Math.hypot(p.x - ox, p.y - oy), PLAYER_RADIUS)) continue;
        const floor = groundHeight(sim.map, p.x, p.y, PLAYER_RADIUS, p.z + 0.01, false, false);
        if (!ringFloor(floor, base) || p.z - floor >= RING_HEIGHT) continue;
        ring.hit |= 1 << p.index;
        sim.damagePlayer(p, TOLL_DAMAGE, { x: ox, y: oy, kind: HURT_WORLD });
      }
    }
  }

  /** The active ring's impact tick for the snapshot, or the announced impact during the Toll's tell; 0 for none. */
  tollTick(): number {
    if (this.cast?.kind === BOSS_CAST_TOLL) return this.cast.end;
    const ring = this.rings[this.rings.length - 1];
    return ring && this.tick - ring.impact <= RING_TICKS ? ring.impact : 0;
  }

  // ---------------------------------------------------------------- Called to the Gate

  private startCall(): void {
    const sim = this.sim, living = this.living();
    this.callAttempted = true;
    if (!living.length) { this.callResolved = true; return; }
    // A taunted Gatekeeper calls the Fallen; otherwise a random living player, not the one called last while another lives.
    const fallen = sim.players.find((p) => p.classId === 'fallen');
    let target: SimPlayer | undefined;
    if (this.tick < sim.eTauntUntil[this.slot] && sim.livingTargetable(fallen)) target = fallen;
    else {
      const pool = living.length > 1 ? living.filter((p) => p.id !== this.lastCalled) : living;
      target = pool[Math.floor(sim.random() * pool.length)];
    }
    this.lastCalled = target.id;
    this.callHeads = living.length;
    this.startCast(BOSS_CAST_CALL, target.id);
    sim.emit('all', { type: 'called', playerId: target.id, phase: 'tell', untilTick: this.cast!.end });
  }

  /** A Call that could not start by its deadline is consumed; it still resolves the first episode (no immortal 1 HP). */
  private callSkipped(): void {
    this.callAttempted = true;
    this.callResolved = true;
  }

  private startHold(targetId: number): void {
    const sim = this.sim, s = this.slot, p = sim.playerById(targetId);
    if (!sim.livingTargetable(p)) { this.callResolved = true; return; }
    sim.cancelPlayerActions(p);
    sim.commanders.releasePlayer(p.id, false);
    const floor = groundHeight(sim.map, p.x, p.y, PLAYER_RADIUS, p.z + 0.01, false, false);
    const z = Math.max(p.z, Number.isFinite(floor) ? floor : p.z) + HOLD_LIFT;
    const seal = sealPoint(sim.map, p.x, p.y, z, sim.eX[s], sim.eY[s]);
    if (!seal) { this.callResolved = true; return; }
    const heads = Math.max(1, Math.min(this.callHeads, this.living().length));
    const slot = sim.spawnBossPart(seal[0], seal[1], seal[2] - SEAL_HEIGHT / 2, SEAL_HP_PER_HEAD * heads, true);
    if (slot < 0) { this.callResolved = true; return; }
    this.hold = { playerId: p.id, start: this.tick, until: this.tick + HOLD_TICKS, z, seal: slot, sealIncarnation: sim.eIncarnation[slot], heads, sealMax: SEAL_HP_PER_HEAD * heads };
    p.z = z;
    sim.teleport(p, p.x, p.y, z, undefined, undefined, [sim.eX[s], sim.eY[s], this.tick]);
    sim.emit('all', { type: 'called', playerId: p.id, phase: 'held', untilTick: this.hold.until });
  }

  private updateHold(): void {
    const h = this.hold;
    if (!h) return;
    const sim = this.sim, s = this.slot, p = sim.playerById(h.playerId);
    if (!sim.livingTargetable(p)) { this.release(false); return; }
    // Seal rescaling (§3.5): only a newly lower living headcount shrinks it, never twice to the same low.
    const heads = Math.max(1, Math.min(h.heads, this.living().length));
    if (heads < h.heads && sim.eAlive[h.seal]) {
      sim.eHp[h.seal] *= heads / h.heads;
      h.sealMax *= heads / h.heads;
      h.heads = heads;
    }
    const body = { x: p.x, y: p.y, z: h.z, radius: PLAYER_RADIUS };
    const bx = sim.eX[s], by = sim.eY[s];
    if (Math.hypot(bx - body.x, by - body.y) > DRAG_STOP) dragStep(sim.map, body, bx, by, DRAG_SPEED / TICK_HZ);
    p.x = body.x; p.y = body.y; p.z = h.z;
    p.moveVx = p.moveVy = 0;
    const seal = sealPoint(sim.map, p.x, p.y, h.z, bx, by);
    if (!seal) { this.release(false); return; }
    sim.eX[h.seal] = seal[0]; sim.eY[h.seal] = seal[1]; sim.eZ[h.seal] = seal[2] - SEAL_HEIGHT / 2;
    if (this.tick >= h.until) {
      // Judged: the Seal slams shut and he takes his due.
      const heal = CALL_HEAL * this.maxHp;
      sim.eHp[s] = Math.min(this.maxHp, sim.eHp[s] + heal);
      sim.emit('all', { type: 'judged', playerId: p.id, by: 'seal', heal });
      this.release(false);
    }
  }

  /** Ends the hold any way: the Seal goes without credit and the player drops where they are, unhurt. */
  release(broken: boolean, by = -1): void {
    const h = this.hold;
    if (!h) return;
    const sim = this.sim;
    this.hold = null;
    this.callResolved = true;
    if (sim.eAlive[h.seal] && sim.eIncarnation[h.seal] === h.sealIncarnation) sim.removeEnemy(h.seal, true);
    const p = sim.playerById(h.playerId);
    if (p?.connected) {
      sim.teleport(p, p.x, p.y, p.z, undefined, false, null);
    }
    if (broken) sim.emit('all', { type: 'sealBroken', playerId: h.playerId, by });
    sim.emit('all', { type: 'called', playerId: h.playerId, phase: 'released', untilTick: this.tick });
  }

  // ---------------------------------------------------------------- the Watchers

  private openEyes(): void {
    const sim = this.sim, living = this.living();
    const anchors = sim.map.rooms[this.room]?.points?.watchers ?? [];
    if (!living.length || !anchors.length) { this.aimResolved = this.aimResolved || this.judgmentsResolved > 0; return; }
    this.closeEyes();
    this.episode++;
    this.episodeCount = 3 + living.length;
    this.episodeDamage = TETHER_TOTAL * this.maxHp;
    this.episodeDealt = 0;
    this.episodeKills = 0;
    // Access anchors: living humans, else living bots until a human revives.
    const humans = living.filter((p) => !p.bot);
    const access = humans.length ? humans : living;
    const used = new Set<number>();
    const picks: number[] = [];
    for (const p of living) {
      let best = -1, bestD = Infinity;
      anchors.forEach(([c, r], i) => {
        if (used.has(i)) return;
        const d = Math.hypot(c + 0.5 - p.x, r + 0.5 - p.y);
        if (d < bestD) { bestD = d; best = i; }
      });
      if (best >= 0) { used.add(best); picks.push(best); }
    }
    while (picks.length < this.episodeCount && used.size < anchors.length) {
      const free = anchors.map((_, i) => i).filter((i) => !used.has(i));
      const i = free[Math.floor(sim.random() * free.length)];
      used.add(i); picks.push(i);
    }
    const placed: Array<[number, number]> = [];
    for (const i of picks) {
      const at = this.eyePoint(anchors[i], access, placed);
      if (!at) continue;
      const slot = sim.spawnBossPart(at[0], at[1], at[2] - WATCHER_HEIGHT / 2, WATCHER_HP, false);
      if (slot < 0) continue;
      placed.push([at[0], at[1]]);
      this.eyes.push({ slot, incarnation: sim.eIncarnation[slot], opensAt: this.tick + WATCHER_OPENING });
    }
    this.episodeCount = Math.max(1, this.eyes.length);
    sim.emit('all', { type: 'watchersOpen', episode: this.episode, count: this.eyes.length, first: !this.watchersAnnounced });
    this.watchersAnnounced = true;
  }

  /**
   * An eye's hover point (§3.7): the marker if it's within 20 m and sight of an access player's eye,
   * else moved along the marker-to-player line to a clear point 8–20 m from that player, else the
   * nearest clear point at least 2 m from them. Never inside geometry; 2 m from other eyes.
   */
  private eyePoint([c, r]: [number, number], access: SimPlayer[], placed: Array<[number, number]>): [number, number, number] | null {
    const sim = this.sim, map = sim.map;
    const hover = (x: number, y: number): number | null => {
      const cc = Math.floor(x), rr = Math.floor(y);
      if (cc < 0 || rr < 0 || cc >= map.w || rr >= map.h || sim.roomAt(x, y) !== this.room) return null;
      const i = rr * map.w + cc;
      if (map.solid[i] || !Number.isFinite(map.floor[i])) return null;
      const z = map.floor[i] + WATCHER_HOVER;
      if (!cylinderClear(map, x, y, z - WATCHER_HEIGHT / 2, WATCHER_RADIUS)) return null;
      if (placed.some(([px, py]) => Math.hypot(px - x, py - y) < 2)) return null;
      return z;
    };
    const sees = (x: number, y: number, z: number, p: SimPlayer) => Math.hypot(x - p.x, y - p.y) <= WATCHER_ACCESS && lineOfSight(map, p.x, p.y, p.z + PLAYER_EYE, x, y, z);
    const mx = c + 0.5, my = r + 0.5, mz = hover(mx, my);
    if (mz !== null && access.some((p) => sees(mx, my, mz, p))) return [mx, my, mz];
    const near = [...access].sort((a, b) => Math.hypot(a.x - mx, a.y - my) - Math.hypot(b.x - mx, b.y - my))[0];
    if (!near) return null;
    const dx = mx - near.x, dy = my - near.y, len = Math.hypot(dx, dy) || 1;
    for (let d = WATCHER_ACCESS; d >= 8; d -= 0.5) {
      const x = near.x + dx / len * d, y = near.y + dy / len * d, z = hover(x, y);
      if (z !== null && sees(x, y, z, near)) return [x, y, z];
    }
    for (let d = 2; d <= WATCHER_ACCESS; d += 1) {
      for (let a = 0; a < 16; a++) {
        const x = near.x + Math.cos(a * Math.PI / 8) * d, y = near.y + Math.sin(a * Math.PI / 8) * d, z = hover(x, y);
        if (z !== null && sees(x, y, z, near)) return [x, y, z];
      }
    }
    return null;
  }

  private updateEyes(): void {
    const sim = this.sim;
    this.eyes = this.eyes.filter((e) => sim.eAlive[e.slot] && sim.eIncarnation[e.slot] === e.incarnation);
  }

  /** An eye destroyed by an accepted player attack: its tether sends its share to the body once (§3.5). */
  partKilled(slot: number, by: number): void {
    const sim = this.sim;
    if (this.hold?.seal === slot && sim.eIncarnation[slot] === this.hold.sealIncarnation) {
      const h = this.hold;
      this.hold = { ...h, seal: -1 };
      this.release(true, by);
      return;
    }
    const k = this.eyes.findIndex((e) => e.slot === slot && e.incarnation === sim.eIncarnation[slot]);
    if (k < 0) return;
    const x = sim.eX[slot], y = sim.eY[slot], z = sim.eZ[slot] + WATCHER_HEIGHT / 2;
    this.eyes.splice(k, 1);
    this.episodeKills++;
    if (this.eyes.length === 0 && this.judgmentsResolved > 0) this.aimResolved = true;
    const share = Math.min(this.episodeDamage / this.episodeCount, this.episodeDamage - this.episodeDealt);
    this.episodeDealt += share;
    sim.emit('all', { type: 'watcherBreak', episode: this.episode, x, y, z, by, damage: share });
    if (share > 0) this.tether(share);
  }

  /** Every open eye closes without credit. */
  private closeEyes(): void {
    const sim = this.sim;
    for (const e of this.eyes) if (sim.eAlive[e.slot] && sim.eIncarnation[e.slot] === e.incarnation) sim.removeEnemy(e.slot, true);
    this.eyes.length = 0;
  }

  // ---------------------------------------------------------------- cycle end and the transition

  private endCycle(): void {
    // c 28: a broken or suppressed body cast still lets the open eyes judge; it counts as resolved either way.
    if (this.cast?.kind === BOSS_CAST_JUDGMENT) this.cast = null;
    if (this.judgedAt !== this.tick) this.judge(false);
    if (this.consumed & EV_WATCHERS) this.aimResolved = true;
    this.closeEyes();
    this.cycleStart += CYCLE_TICKS;
    this.consumed = 0;
  }

  private startTransition(): void {
    const sim = this.sim;
    this.phase = 2;
    this.transitionUntil = this.tick + TRANSITION_TICKS;
    this.cancelCast();
    this.release(false);
    this.closeEyes();
    this.rings.length = 0;
    this.pending.length = 0;
    this.lastImpact = -Infinity;
    sim.clearHostileProjectiles();
    sim.discardBossAdds();
    sim.emit('all', { type: 'bossPhase', phase: 2, line: 'He lifts the first trumpet' });
  }

  private endTransition(): void {
    this.transitionUntil = 0;
    this.cycleStart = this.tick - C_PHASE_ENTRY;
    this.consumed = EV_BEFORE_WATCHERS;
    // An early transition before the first Call's scheduled attempt starts one now (1 s tell, hold ≤ 6 s).
    if (!this.callAttempted && !this.callResolved) this.replacementCall = true;
  }

  // ---------------------------------------------------------------- rewards and the snapshot

  /** Boss adds drop at most eight heal motes in the whole fight; relocation or reconnect never refills it. */
  takeMote(): boolean {
    if (this.motes >= BOSS_MOTE_CAP) return false;
    this.motes++;
    return true;
  }

  header(): { bossPhase: number; bossBreak: number; bossFlags: number; bossCycleStart: number; tollTick: number; heldPlayer: number; heldUntil: number; heldSince: number; callTarget: number; bossTransitionUntil: number } {
    const s = this.slot;
    if (!this.active || s < 0) return { bossPhase: 0, bossBreak: 0, bossFlags: 0, bossCycleStart: 0, tollTick: 0, heldPlayer: 255, heldUntil: 0, heldSince: 0, callTarget: 255, bossTransitionUntil: 0 };
    const inTransition = this.tick < this.transitionUntil;
    const brk = this.cast?.kind === BOSS_CAST_JUDGMENT ? Math.min(255, Math.round(this.judgmentDamage / (JUDGMENT_BREAK * this.maxHp) * 255)) : 0;
    const deferred = this.gateClosed && this.sim.eHp[s] <= 1.5;
    return {
      bossPhase: this.phase | (inTransition ? BOSS_PHASE_INVULNERABLE : 0),
      bossBreak: brk,
      bossFlags: (deferred ? BOSS_FLAG_DEFERRED : 0) | (this.eyes.length ? BOSS_FLAG_WATCHERS : 0),
      bossCycleStart: this.cycleStart,
      tollTick: this.tollTick(),
      heldPlayer: this.hold?.playerId ?? 255,
      heldUntil: this.hold?.until ?? 0,
      heldSince: this.hold?.start ?? 0,
      callTarget: this.cast?.kind === BOSS_CAST_CALL ? this.cast.target : 255,
      bossTransitionUntil: inTransition ? this.transitionUntil : 0,
    };
  }

  /** Cast progress 0–255 for the snapshot. */
  castProgress(): number {
    const c = this.cast;
    if (!c) return 0;
    return Math.min(255, Math.round((this.tick - c.start) / Math.max(1, c.end - c.start) * 255));
  }
}
