/** The Dominion's slam and flying leap (rogue rooms.md §6): accepted deadlines and the host's behavior. */
import {
  DOMINION_CAST_CAP,
  DOMINION_COOLDOWN_TICKS,
  DOMINION_ENEMY_DAMAGE,
  DOMINION_HEIGHT_TOLERANCE,
  DOMINION_LAUNCH_SECONDS,
  DOMINION_LAUNCH_SPEED,
  DOMINION_LAUNCH_VZ,
  DOMINION_LEAP_CHARGE_TICKS,
  DOMINION_LEAP_COOLDOWN_TICKS,
  DOMINION_LEAP_LEAD_SECONDS,
  DOMINION_LEAP_MAX_RANGE,
  DOMINION_LEAP_MIN_RANGE,
  DOMINION_PLAYER_DAMAGE,
  DOMINION_RADIUS,
  DOMINION_REACH,
  DOMINION_RECOVERY_TICKS,
  DOMINION_TELL_TICKS,
  copyDominionCast,
  dominionFalloff,
  dominionLeapPosition,
  type DominionCast,
  type DominionLeap,
  type DominionPhase,
} from '../data/dominion';
import { DOMINION, ENEMIES, GATEKEEPER, ST_ATTACKING, ST_WINDUP } from '../data/enemies';
import { ENEMY_SLOTS, PLAYER_HEIGHT, ROOM_NONE, TICK_DT } from './constants';
import { dominionLeapClear } from './dominionLeap';
import { lineOfSight } from './los';
import { groundHeight } from './movement';
import type { Simulation } from './sim';

/** What the simulation reports about a Dominion each tick. */
interface CastState {
  incarnation: number;
  room: number;
  grounded: boolean;
  stunned: boolean;
  silenced: boolean;
  inRange: boolean;
  leap?: DominionLeap;
}

/** Host-only accepted deadlines; control refreshes cannot reschedule a canceled slam. */
export class Dominions {
  readonly active = new Map<number, DominionCast>();
  readonly recoveryUntil = new Float64Array(ENEMY_SLOTS);
  readonly readyAt = new Float64Array(ENEMY_SLOTS);
  readonly leapReadyAt = new Float64Array(ENEMY_SLOTS);
  private nextId = 1;
  /** Casts refused because a cast ID or deadline would overflow 32 bits. */
  exhausted = 0;

  constructor(private readonly emit: (phase: DominionPhase, cast: DominionCast) => void) {}

  /** Winding up or recovering: the Dominion stands still. */
  holding(slot: number, tick: number): boolean {
    return this.active.has(slot) || tick < this.recoveryUntil[slot];
  }

  reset(slot: number): void {
    this.active.delete(slot);
    this.recoveryUntil[slot] = 0;
    this.readyAt[slot] = 0;
    this.leapReadyAt[slot] = 0;
  }

  cancel(slot: number, tick: number): boolean {
    const cast = this.active.get(slot);
    if (!cast) return false;
    this.end(cast, tick, 'cancel');
    return true;
  }

  private end(cast: DominionCast, tick: number, phase: 'strike' | 'cancel'): void {
    this.active.delete(cast.slot);
    this.recoveryUntil[cast.slot] = tick + DOMINION_RECOVERY_TICKS;
    this.readyAt[cast.slot] = tick + DOMINION_COOLDOWN_TICKS;
    if (cast.leap) this.leapReadyAt[cast.slot] = tick + DOMINION_LEAP_COOLDOWN_TICKS;
    this.emit(phase, copyDominionCast(cast));
  }

  /** Ends, strikes or starts this Dominion's cast for the tick. */
  update(slot: number, tick: number, state: CastState): void {
    const blocked = !state.grounded || state.stunned || state.silenced;
    const cast = this.active.get(slot);
    if (cast) {
      if (blocked || state.incarnation !== cast.incarnation || state.room !== cast.room) this.cancel(slot, tick);
      else if (tick >= cast.impactTick) this.end(cast, tick, 'strike');
      return;
    }
    const leap = tick >= this.leapReadyAt[slot] ? state.leap : undefined;
    if (blocked || (!state.inRange && !leap) || tick < this.readyAt[slot] || this.active.size >= DOMINION_CAST_CAP) return;
    if (this.nextId > 0xffffffff || tick + DOMINION_TELL_TICKS > 0xffffffff) {
      this.exhausted++;
      return;
    }
    const next: DominionCast = {
      slot, incarnation: state.incarnation, room: state.room, castId: this.nextId++, startTick: tick, impactTick: tick + DOMINION_TELL_TICKS,
    };
    if (leap) next.leap = { ...leap };
    this.active.set(slot, next);
    this.emit('start', copyDominionCast(next));
  }

  checkpoint(): DominionCast[] {
    return [...this.active.values()].sort((a, b) => a.slot - b.slot).map(copyDominionCast);
  }
}

/** A leap is considered only on one tick in this many, staggered by slot. */
const LEAP_CHECK_TICKS = 15;
/** A player's movement counts as recent, and may be led, for this long after its last input (ms). */
const LEAP_RECENT_MS = 250;
/** Lead fractions tried in order: a full second first, shorter when geometry or reach make it unsafe. */
const LEAP_LEAD_STEPS = [1, 0.75, 0.5, 0.25, 0];
/** A flying victim this close to its hover floor counts as grounded for the slam. */
const SLAM_HOVER_SLACK = 0.05;

/**
 * The host's Dominion behavior (rooms.md §6): when to wind up, the leap's landing, the flight and
 * what the slam hits. `Dominions` keeps the accepted deadlines; this decides and applies them.
 */
export class DominionBehavior {
  constructor(private readonly sim: Simulation) {}

  /** Resolves every Dominion after ordinary movement; a slam's displacement can cancel other casts. */
  update(): void {
    const sim = this.sim;
    const tick = sim.tick;
    const slots: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) if (sim.eType[sim.active[k]] === DOMINION) slots.push(sim.active[k]);
    for (const s of slots) {
      // A prior slam may trigger an owned Shroud burst that kills this caster.
      if (!sim.eAlive[s] || sim.eSpawnTick[s] === tick) continue;
      const ownFlight = sim.dominions.active.get(s)?.leap !== undefined;
      const silenced = tick < sim.eSilenceUntil[s];
      const mayLeap = tick % LEAP_CHECK_TICKS === s % LEAP_CHECK_TICKS && !sim.dominions.holding(s, tick) &&
        tick >= sim.dominions.readyAt[s] && tick >= sim.dominions.leapReadyAt[s] &&
        !sim.isRooted(s) && !sim.isStunned(s) && !silenced && sim.eGrounded[s];
      const leap = mayLeap ? this.leapTarget(s) : undefined;
      sim.dominions.update(s, tick, {
        incarnation: sim.eIncarnation[s],
        room: sim.roomAt(sim.eX[s], sim.eY[s]),
        grounded: sim.eGrounded[s] === 1 || ownFlight,
        stunned: sim.isStunned(s),
        silenced,
        inRange: this.inRange(s),
        leap,
      });
      if (!sim.eAlive[s]) continue;
      if (sim.dominions.holding(s, tick)) {
        sim.eMeleeNext[s] = -1;
        sim.eState[s] = sim.dominions.active.has(s) ? ST_WINDUP : ST_ATTACKING;
      } else if (!sim.isStunned(s) && sim.eGrounded[s]) sim.updateMelee(s);
      else sim.eMeleeNext[s] = -1;
    }
  }

  /** Its target is within slam reach: same room, horizontally within 5 m, feet within 1.5 m, in sight. */
  private inRange(slot: number): boolean {
    const sim = this.sim;
    const p = sim.slots[sim.eTarget[slot]];
    const room = sim.roomAt(sim.eX[slot], sim.eY[slot]);
    if (room === ROOM_NONE || !sim.livingTargetable(p) || sim.roomAt(p.x, p.y) !== room) return false;
    return Math.hypot(p.x - sim.eX[slot], p.y - sim.eY[slot]) <= DOMINION_REACH &&
      Math.abs(p.z - sim.eZ[slot]) <= DOMINION_HEIGHT_TOLERANCE &&
      lineOfSight(sim.map, sim.eX[slot], sim.eY[slot], sim.eyeZ(slot), p.x, p.y, p.z + PLAYER_HEIGHT / 2);
  }

  /**
   * The flying slam's landing (rooms.md §6): a random player 16–48 m away in the same room, led by
   * up to 1 s of recent ordinary movement, on a dry footprint with a clear arc.
   */
  leapTarget(slot: number): DominionLeap | undefined {
    const sim = this.sim;
    const ex = sim.eX[slot];
    const ey = sim.eY[slot];
    const room = sim.roomAt(ex, ey);
    const choices: DominionLeap[] = [];
    for (const p of sim.players) {
      if (!sim.livingTargetable(p) || sim.roomAt(p.x, p.y) !== room) continue;
      const distance = Math.hypot(p.x - ex, p.y - ey);
      if (distance < DOMINION_LEAP_MIN_RANGE || distance > DOMINION_LEAP_MAX_RANGE) continue;
      // Stale movement, teleports and forced movement create no lead.
      const recent = sim.nowMs >= p.lastAcceptMs && sim.nowMs - p.lastAcceptMs <= LEAP_RECENT_MS &&
        sim.nowMs >= p.speedCheckSkipUntil && sim.nowMs >= p.launchUntilMs;
      for (const fraction of LEAP_LEAD_STEPS) {
        const lead = recent ? DOMINION_LEAP_LEAD_SECONDS * fraction : 0;
        const x = p.x + p.moveVx * lead;
        const y = p.y + p.moveVy * lead;
        const reach = Math.hypot(x - ex, y - ey);
        if (reach < DOMINION_LEAP_MIN_RANGE || reach > DOMINION_LEAP_MAX_RANGE || sim.roomAt(x, y) !== room) continue;
        const z = groundHeight(sim.map, x, y, ENEMIES[DOMINION].radius, Infinity, false, true);
        if (!Number.isFinite(z)) continue;
        const leap: DominionLeap = {
          fromX: Math.fround(ex), fromY: Math.fround(ey), fromZ: Math.fround(sim.eZ[slot]),
          x: Math.fround(x), y: Math.fround(y), z: Math.fround(z),
        };
        if (dominionLeapClear(sim.map, room, leap)) {
          choices.push(leap);
          break;
        }
        if (!recent || p.moveVx === 0 && p.moveVy === 0) break;
      }
    }
    return choices.length ? choices[Math.floor(sim.random() * choices.length)] : undefined;
  }

  /**
   * Moves a leaping Dominion along its locked arc: 0.5 s standing charge, then the flight to the
   * landing at the original deadline. Returns whether the leap owns its movement this tick.
   */
  flight(slot: number): boolean {
    const sim = this.sim;
    const tick = sim.tick;
    const cast = sim.dominions.active.get(slot);
    const leap = cast?.leap;
    if (!cast || !leap) return false;
    const flightStart = cast.startTick + DOMINION_LEAP_CHARGE_TICKS;
    const controlled = sim.isRooted(slot) || sim.isStunned(slot) || tick < sim.eSilenceUntil[slot];
    const displaced = sim.roomAt(sim.eX[slot], sim.eY[slot]) !== cast.room || tick < flightStart && !sim.eGrounded[slot];
    if (controlled || displaced) {
      sim.dominions.cancel(slot, tick);
      return false;
    }
    if (tick < flightStart) {
      sim.eState[slot] = ST_WINDUP;
      return true;
    }
    const duration = DOMINION_TELL_TICKS - DOMINION_LEAP_CHARGE_TICKS;
    const from = Math.max(0, (tick - 1 - flightStart) / duration);
    const to = Math.min(1, (tick - flightStart) / duration);
    if (!dominionLeapClear(sim.map, cast.room, leap, from, to)) {
      sim.dominions.cancel(slot, tick);
      return false;
    }
    const [x, y, z] = dominionLeapPosition(leap, to);
    sim.eVz[slot] = to < 1 ? (z - sim.eZ[slot]) / TICK_DT : 0;
    sim.eX[slot] = x;
    sim.eY[slot] = y;
    sim.eZ[slot] = to < 1 ? z : leap.z;
    sim.eGrounded[slot] = to >= 1 ? 1 : 0;
    sim.eState[slot] = ST_WINDUP;
    return true;
  }

  /**
   * Broadcasts a cast's phase; at the strike, hits everything grounded within the 6 m ring, feet
   * within 1.5 m and in sight (rooms.md §6). Damage and launch fade from its feet to the edge.
   */
  castPhase(phase: DominionPhase, cast: DominionCast): void {
    const sim = this.sim;
    const s = cast.slot;
    const x = cast.leap?.x ?? sim.eX[s];
    const y = cast.leap?.y ?? sim.eY[s];
    const z = cast.leap?.z ?? sim.eZ[s];
    sim.emit('all', { type: 'dominionCast', phase, cast: { ...cast }, x, y, z });
    if (phase !== 'strike') return;
    const eligible = (vx: number, vy: number, vz: number, height: number) =>
      sim.roomAt(vx, vy) === cast.room &&
      Math.hypot(vx - x, vy - y) <= DOMINION_RADIUS + 1e-9 &&
      Math.abs(vz - z) <= DOMINION_HEIGHT_TOLERANCE + 1e-9 &&
      lineOfSight(sim.map, x, y, z + ENEMIES[DOMINION].height / 2, vx, vy, vz + height / 2);
    const victims: number[] = [];
    for (let k = 0; k < sim.activeCount; k++) {
      const q = sim.active[k];
      const type = sim.eType[q];
      const def = ENEMIES[type];
      if (q === s || type === GATEKEEPER || !sim.eGrounded[q]) continue;
      if (def.flying) {
        const floor = groundHeight(sim.map, sim.eX[q], sim.eY[q], def.radius, Infinity, false, true);
        if (Math.abs(sim.eZ[q] - floor) > SLAM_HOVER_SLACK) continue;
      }
      if (eligible(sim.eX[q], sim.eY[q], sim.eZ[q], def.height)) victims.push(q);
    }
    for (const q of victims) {
      const distance = Math.hypot(sim.eX[q] - x, sim.eY[q] - y);
      // A world hit: no player credit, but a kill still pays its coins (game.md §6.1).
      sim.damageEnemy(q, Math.round(dominionFalloff(DOMINION_ENEMY_DAMAGE, distance)), -1, undefined, x, y, true);
      if (!sim.eAlive[q]) continue;
      sim.dominions.cancel(q, sim.tick);
      sim.commanders.cancel(q);
      sim.ePullStart[q] = -1;
      sim.knockAway(q, x, y, dominionFalloff(DOMINION_LAUNCH_SPEED, distance) * DOMINION_LAUNCH_SECONDS, DOMINION_LAUNCH_SECONDS);
      sim.eVz[q] = DOMINION_LAUNCH_VZ;
      sim.eGrounded[q] = 0;
      sim.eMeleeNext[q] = -1;
      sim.eCast[q] = 0;
      sim.eCastT[q] = 0;
    }
    for (const p of sim.players) {
      if (!sim.livingTargetable(p) || !eligible(p.x, p.y, p.z, PLAYER_HEIGHT)) continue;
      const immune = sim.isInvulnerable(p);
      const dx = p.x - x;
      const dy = p.y - y;
      const distance = Math.hypot(dx, dy);
      sim.damagePlayer(p, Math.round(dominionFalloff(DOMINION_PLAYER_DAMAGE, distance)));
      if (immune || p.dead) continue;
      // Reuse the acknowledged host correction: stale pre-impact positions cannot undo the launch.
      const speed = dominionFalloff(DOMINION_LAUNCH_SPEED, distance);
      const launch = distance > 1e-9
        ? { dx: dx / distance * speed, dy: dy / distance * speed }
        : { dx: Math.cos(p.yaw) * speed, dy: Math.sin(p.yaw) * speed };
      p.dash = null;
      p.landingTick = -1;
      sim.teleport(p, p.x, p.y, p.z, launch);
    }
  }
}
