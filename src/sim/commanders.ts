/** The Cantor and the Stray-Carrier, the commanders of the Choristers and Cherubs (rogue rooms.md §6.1–§6.3). */
import { BLESSED, CANTOR, CARRIER, ENEMIES, ST_ATTACKING, ST_WINDUP } from '../data/enemies';
import {
  CANTOR_AIM_SPEED,
  CANTOR_BEAM,
  CANTOR_BEAM_FORCE,
  CANTOR_BEAM_TURN_SPEED,
  CANTOR_COOLDOWN,
  CANTOR_RECOVERY,
  CANTOR_TELL,
  CARRIER_COOLDOWN,
  CARRIER_DAMAGE,
  CARRIER_DAMAGE_INTERVAL,
  CARRIER_FLIGHT_HEIGHT,
  CARRIER_FLY_THROUGH,
  CARRIER_GRAB_RADIUS,
  CARRIER_MIN_FLIGHT,
  CARRIER_MIN_HOLD,
  CARRIER_PARTY_HOLD,
  CARRIER_RECOVERY,
  CARRIER_SWOOP,
  CARRIER_TELL,
  COMMANDER_RECORD_CAP,
  turnToward,
  type CarrierCheck,
  type CommanderCast,
} from '../data/commanders';
import { ENEMY_SLOTS, PLAYER_HEIGHT, PLAYER_RADIUS } from './constants';
import { circleOverlapsCell } from './movement';
import { lineOfSight, raycastTerrain } from './los';
import type { GameMap } from './map';
import type { Simulation, SimPlayer } from './sim';
import { HURT_MELEE, HURT_RANGED } from '../net/protocol';

/** The Cantor targets visible players within this range; the Carrier within CARRIER_SIGHT. */
const CANTOR_SIGHT = 25;
const CARRIER_SIGHT = 20;
/** The beam leaves the book this far in front of the Cantor, 2 m up, and reaches up to 30 m. */
const BEAM_FORWARD = 0.6;
const BEAM_HEIGHT = 2;
const BEAM_LENGTH = 30;
/** The beam's pitch is limited to ±35°. */
const BEAM_MAX_PITCH = 35 * Math.PI / 180;
/** An idle Cantor turns toward the nearest player at this speed (rad/s). */
const CANTOR_IDLE_TURN = Math.PI / 2;
/** A beam pulse every 10 ticks: 10 damage to players, 20 to the crowd (rooms.md §6.2). */
const BEAM_PULSE_TICKS = 10;
const BEAM_PLAYER_DAMAGE = 10;
const BEAM_ENEMY_DAMAGE = 20;
/** The Carrier waits 3 s after spawning before its first rush. */
const CARRIER_FIRST_DELAY = 90;
/** Rush and carry stop at this share of the Carrier's HP in accepted damage (rooms.md §6.3). */
const RESCUE_SHARE = 0.2;
/** A rush is considered only on one tick in this many, staggered by slot. */
const RUSH_CHECK_TICKS = 15;
/** The drop: a crowd of at least 3 Blessed in one 4 m square, within 7 m (solo) or 10 m of the victim. */
const CROWD_SQUARE = 4;
const CROWD_MIN = 3;
const DROP_RANGE_SOLO = 7;
const DROP_RANGE = 10;
/** The carry climbs to 6 m above the ground over 0.5 s, then moves at 6 m/s. */
const CARRY_HEIGHT = 6;
const CARRY_CLIMB_TICKS = 15;
const CARRY_SPEED = 6 / 30;
/** The carry ends within this distance of its destination, once CARRIER_MIN_HOLD has passed. */
const DROP_REACH = 0.5;
/** A cast is refused when its deadline could pass the 32-bit tick limit. */
const CAST_HEADROOM = 300;

/** Conservative swept footprint. Walls/leaves and room boundaries block even above their tops. */
export function carryPathClear(map: GameMap, room: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, dryEnd = false): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / 0.2));
  for (let n = 0; n <= steps; n++) {
    const f = n / steps;
    const x = ax + (bx - ax) * f;
    const y = ay + (by - ay) * f;
    const z = az + (bz - az) * f;
    for (let r = Math.floor(y - 1); r <= Math.floor(y + 1); r++) {
      for (let c = Math.floor(x - 1); c <= Math.floor(x + 1); c++) {
        if (!circleOverlapsCell(x, y, 1, c, r)) continue;
        const i = r * map.w + c;
        if (c < 0 || r < 0 || c >= map.w || r >= map.h || map.roomOf[i] !== room) return false;
        if (map.solid[i] || !Number.isFinite(map.floor[i]) || map.floor[i] > z + 0.01) return false;
        if (dryEnd && n === steps && map.hazard[i]) return false;
      }
    }
  }
  return true;
}

/** The Cantor's beam: from the book along its yaw and pitch, stopped by terrain (rooms.md §6.2). */
export function beamSegment(map: GameMap, cast: CommanderCast): { x: number; y: number; z: number; dx: number; dy: number; dz: number; length: number } {
  const x = cast.x + BEAM_FORWARD * Math.cos(cast.yaw);
  const y = cast.y + BEAM_FORWARD * Math.sin(cast.yaw);
  const z = cast.z + BEAM_HEIGHT;
  const dx = Math.cos(cast.yaw) * Math.cos(cast.pitch);
  const dy = Math.sin(cast.yaw) * Math.cos(cast.pitch);
  const dz = Math.sin(cast.pitch);
  const length = raycastTerrain(map, x, y, z, dx, dy, dz, BEAM_LENGTH);
  return { x, y, z, dx, dy, dz, length };
}

/** Distance between a beam segment and the victim's vertical body segment. */
export function beamHits(b: ReturnType<typeof beamSegment>, x: number, y: number, z: number, height: number, radius: number): boolean {
  const radius2 = (radius + 0.5) ** 2;
  const cuts = [0, b.length];
  if (Math.abs(b.dz) > 1e-9) {
    for (const capZ of [z, z + height]) {
      const t = (capZ - b.z) / b.dz;
      if (t > 0 && t < b.length) cuts.push(t);
    }
  }
  cuts.sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const lo = cuts[i];
    const hi = cuts[i + 1];
    const midZ = b.z + b.dz * (lo + hi) / 2;
    const cap = midZ < z ? z : midZ > z + height ? z + height : undefined;
    const dz = cap === undefined ? 0 : b.dz;
    const oz = cap === undefined ? 0 : b.z - cap;
    const denominator = b.dx ** 2 + b.dy ** 2 + dz ** 2;
    const closest = denominator > 1e-12 ? -((b.x - x) * b.dx + (b.y - y) * b.dy + oz * dz) / denominator : lo;
    const t = Math.max(lo, Math.min(hi, closest));
    if ((b.x + b.dx * t - x) ** 2 + (b.y + b.dy * t - y) ** 2 + (oz + dz * t) ** 2 <= radius2) return true;
  }
  return false;
}

/** One bounded record per family master. Simulation is the sole owner; clients only project it. */
export class Commanders {
  readonly active = new Map<number, CommanderCast>();
  readonly readyAt = new Float64Array(ENEMY_SLOTS);
  private readonly rescueDamage = new Float64Array(ENEMY_SLOTS);
  private readonly rescueThreshold = new Float64Array(ENEMY_SLOTS);
  private readonly origins = new Map<number, { x: number; y: number; z: number }>();
  private nextId = 1;
  /** Why each Carrier last did or didn't rush, for the dev overlay; recorded only with `dev=1`. */
  private readonly carrierChecks = new Map<number, CarrierCheck>();

  constructor(private readonly sim: Simulation) {}

  checkpoint(): CommanderCast[] {
    return [...this.active.values()].map((cast) => ({ ...cast }));
  }

  diagnostics(): CarrierCheck[] {
    return [...this.carrierChecks.values()].map((check) => ({
      ...check,
      phase: this.active.get(check.slot)!.phase,
      readyTick: this.readyAt[check.slot],
    }));
  }

  hasFamily(type: number, room: number): boolean {
    return [...this.active.values()].some((cast) => cast.room === room && (cast.kind === 'beam' ? CANTOR : CARRIER) === type);
  }

  spawn(slot: number): void {
    const sim = this.sim;
    const type = sim.eType[slot];
    if (type !== CANTOR && type !== CARRIER) return;
    if (this.nextId > 0xffffffff || this.active.size >= COMMANDER_RECORD_CAP) throw new Error('commander record capacity exhausted');
    const x = sim.eX[slot];
    const y = sim.eY[slot];
    const z = sim.eZ[slot];
    const p = sim.players.find((p) => sim.livingTargetable(p));
    this.active.set(slot, {
      kind: type === CANTOR ? 'beam' : 'carry', slot, incarnation: sim.eIncarnation[slot], room: sim.eRoom[slot], castId: this.nextId++,
      phase: 'idle', startTick: sim.tick, phaseTick: sim.tick, endTick: sim.tick, targetId: -1,
      x, y, z, yaw: p ? Math.atan2(p.y - y, p.x - x) : 0, pitch: 0,
      targetX: x, targetY: y, targetZ: z, dropX: x, dropY: y,
    });
    this.readyAt[slot] = sim.tick + (type === CARRIER ? CARRIER_FIRST_DELAY : 0);
    if (type === CARRIER && sim.diagnostics) {
      this.carrierChecks.set(slot, { slot, phase: 'idle', tick: sim.tick, targetId: -1, distance: 0, nearbyBlessed: 0, crowdCount: 0,
        reason: 'initial delay', readyTick: this.readyAt[slot] });
    }
    this.rescueThreshold[slot] = sim.eHp[slot] * RESCUE_SHARE;
  }

  carriedBy(id: number): CommanderCast | undefined {
    return [...this.active.values()].find((cast) => cast.kind === 'carry' && cast.phase === 'carry' && cast.targetId === id);
  }

  releasePlayer(id: number, correction = true): void {
    const cast = this.carriedBy(id);
    if (cast) this.cancel(cast.slot, correction);
  }

  /** Ends a tell, beam, rush or carry into recovery; a carried player is corrected to where they are. */
  cancel(slot: number, correction = true): void {
    const cast = this.active.get(slot);
    const sim = this.sim;
    if (!cast || cast.phase === 'idle' || cast.phase === 'recover') return;
    const carried = cast.phase === 'carry';
    const p = sim.players.find((p) => p.id === cast.targetId);
    cast.phase = 'recover';
    cast.phaseTick = sim.tick;
    cast.endTick = sim.tick + (cast.kind === 'beam' ? CANTOR_RECOVERY : CARRIER_RECOVERY);
    this.readyAt[slot] = sim.tick + (cast.kind === 'beam' ? CANTOR_COOLDOWN : CARRIER_COOLDOWN);
    this.origins.delete(slot);
    if (carried && p && correction) sim.teleport(p, p.x, p.y, p.z, undefined, false);
  }

  remove(slot: number): void {
    this.cancel(slot);
    this.active.delete(slot);
    this.origins.delete(slot);
    this.carrierChecks.delete(slot);
  }

  /** Rush and carry share one rule: a fifth of the Carrier's HP in accepted damage stops it (audit batch 4). */
  damaged(slot: number, amount: number): void {
    const cast = this.active.get(slot);
    if (!cast || amount <= 0 || cast.kind !== 'carry' || cast.phase !== 'tell' && cast.phase !== 'active' && cast.phase !== 'carry') return;
    this.rescueDamage[slot] += amount;
    if (this.rescueDamage[slot] >= this.rescueThreshold[slot] - 1e-6) this.cancel(slot);
  }

  /** Updates a Carrier's dev diagnostics, when they are recorded. */
  private note(slot: number, fields: Partial<CarrierCheck>): void {
    const check = this.carrierChecks.get(slot);
    if (check) Object.assign(check, fields);
  }

  private target(cast: CommanderCast): SimPlayer | undefined {
    const sim = this.sim;
    return sim.players.find((p) => p.id === cast.targetId && sim.livingTargetable(p) && sim.roomAt(p.x, p.y) === cast.room);
  }

  private sees(cast: CommanderCast, p: SimPlayer, range: number): boolean {
    const sim = this.sim;
    const near = sim.livingTargetable(p) && sim.roomAt(p.x, p.y) === cast.room && Math.hypot(p.x - cast.x, p.y - cast.y) <= range;
    if (!near) return false;
    const eye = cast.z + ENEMIES[sim.eType[cast.slot]].height / 2;
    return lineOfSight(sim.map, cast.x, cast.y, eye, p.x, p.y, p.z + PLAYER_HEIGHT / 2);
  }

  private start(cast: CommanderCast, p: SimPlayer, duration: number): void {
    const sim = this.sim;
    if (this.nextId > 0xffffffff || sim.tick + CAST_HEADROOM > 0xffffffff) return;
    cast.castId = this.nextId++;
    cast.startTick = cast.phaseTick = sim.tick;
    cast.endTick = sim.tick + duration;
    sim.eCast[cast.slot] = 0;
    sim.eCastT[cast.slot] = 0;
    cast.phase = 'tell';
    cast.targetId = p.id;
    cast.targetX = p.x;
    cast.targetY = p.y;
    cast.targetZ = p.z;
  }

  /** Returns whether this commander owns its movement this tick. */
  update(slot: number): boolean {
    const cast = this.active.get(slot);
    const sim = this.sim;
    if (!cast) return false;
    cast.x = sim.eX[slot];
    cast.y = sim.eY[slot];
    cast.z = sim.eZ[slot];
    if (sim.roomAt(cast.x, cast.y) !== cast.room) {
      this.cancel(slot);
      return false;
    }
    const blocked = sim.isStunned(slot) || sim.tick < sim.eSilenceUntil[slot] || !sim.eGrounded[slot] ||
      cast.kind === 'carry' && (sim.isRooted(slot) || sim.tick < sim.eTauntUntil[slot]);
    if (blocked) {
      this.note(slot, { reason: 'controlled', tick: sim.tick });
      this.cancel(slot);
      return false;
    }
    if (cast.phase === 'recover' && sim.tick >= cast.endTick) cast.phase = 'idle';
    if (cast.kind === 'beam') return this.cantor(cast);
    return this.carrier(cast);
  }

  /** The Cantor (rooms.md §6.2): a tell on the farthest visible player, then a beam that turns slowly. */
  private cantor(cast: CommanderCast): boolean {
    const sim = this.sim;
    const slot = cast.slot;
    const taunted = sim.tick < sim.eTauntUntil[slot];
    if (taunted) {
      const fallen = sim.players.find((p) => p.classId === 'fallen' && sim.livingTargetable(p) && sim.roomAt(p.x, p.y) === cast.room);
      if (fallen) cast.targetId = fallen.id;
    }
    if (cast.phase === 'idle' && sim.tick >= this.readyAt[slot]) {
      const targets = sim.players.filter((p) => this.sees(cast, p, CANTOR_SIGHT) && (!taunted || p.classId === 'fallen'));
      targets.sort((a, b) => Math.hypot(b.x - cast.x, b.y - cast.y) - Math.hypot(a.x - cast.x, a.y - cast.y) || a.index - b.index);
      if (targets[0]) this.start(cast, targets[0], CANTOR_TELL);
    }
    const p = this.target(cast);
    if (cast.phase === 'tell' && !p) {
      this.cancel(slot);
      return true;
    }
    if (p && cast.phase !== 'idle') {
      cast.targetX = p.x;
      cast.targetY = p.y;
      cast.targetZ = p.z;
    }
    if (cast.phase === 'idle') {
      const inRoom = sim.players.filter((p) => sim.livingTargetable(p) && sim.roomAt(p.x, p.y) === cast.room);
      const nearest = inRoom.sort((a, b) => Math.hypot(a.x - cast.x, a.y - cast.y) - Math.hypot(b.x - cast.x, b.y - cast.y))[0];
      if (nearest) {
        cast.targetX = nearest.x;
        cast.targetY = nearest.y;
        cast.targetZ = nearest.z;
      }
    }
    const beaming = cast.phase === 'active' || cast.phase === 'recover';
    const turn = (beaming ? CANTOR_BEAM_TURN_SPEED : cast.phase === 'tell' ? CANTOR_AIM_SPEED : CANTOR_IDLE_TURN) / 30;
    cast.yaw = turnToward(cast.yaw, Math.atan2(cast.targetY - cast.y, cast.targetX - cast.x), turn);
    const rise = cast.targetZ + PLAYER_HEIGHT / 2 - cast.z - BEAM_HEIGHT;
    const run = Math.max(0.01, Math.hypot(cast.targetX - cast.x, cast.targetY - cast.y) - BEAM_FORWARD);
    const pitch = Math.max(-BEAM_MAX_PITCH, Math.min(BEAM_MAX_PITCH, Math.atan2(rise, run)));
    cast.pitch += Math.max(-turn, Math.min(turn, pitch - cast.pitch));
    if (cast.phase === 'tell' && sim.tick >= cast.endTick) {
      cast.phase = 'active';
      cast.phaseTick = sim.tick;
      cast.endTick = sim.tick + CANTOR_BEAM;
    }
    if (cast.phase === 'active' && sim.tick >= cast.endTick) this.cancel(slot);
    const hold = cast.phase !== 'idle' || sim.players.some((p) => this.sees(cast, p, CANTOR_SIGHT));
    if (hold) sim.eState[slot] = cast.phase === 'tell' ? ST_WINDUP : ST_ATTACKING;
    return hold;
  }

  /**
   * Called after separation built the spatial hashes. No full-enemy scan per beam pulse.
   * Crowd kills burst away from the book, so the beam visibly hurts the horde (audit batch 4).
   */
  pulse(): void {
    const sim = this.sim;
    for (const cast of this.active.values()) {
      cast.x = sim.eX[cast.slot];
      cast.y = sim.eY[cast.slot];
      cast.z = sim.eZ[cast.slot];
      if (cast.kind !== 'beam' || cast.phase !== 'active' || (sim.tick - cast.phaseTick) % BEAM_PULSE_TICKS !== 0) continue;
      const b = beamSegment(sim.map, cast);
      const visible = (x: number, y: number, z: number, h: number) => lineOfSight(sim.map, b.x, b.y, b.z, x, y, z + h / 2);
      for (const p of sim.players) {
        if (!sim.livingTargetable(p) || sim.roomAt(p.x, p.y) !== cast.room) continue;
        if (beamHits(b, p.x, p.y, p.z, PLAYER_HEIGHT, PLAYER_RADIUS) && visible(p.x, p.y, p.z, PLAYER_HEIGHT)) sim.damagePlayer(p, BEAM_PLAYER_DAMAGE, { x: cast.x, y: cast.y, kind: HURT_RANGED });
      }
      for (const slot of sim.commanderBeamCandidates(b)) {
        // Only the crowd (Blessed, Choristers and Cherubs) takes beam damage.
        if (!sim.eAlive[slot] || sim.eType[slot] > 2 || sim.roomAt(sim.eX[slot], sim.eY[slot]) !== cast.room) continue;
        const def = ENEMIES[sim.eType[slot]];
        const x = sim.eX[slot];
        const y = sim.eY[slot];
        const z = sim.eZ[slot];
        if (beamHits(b, x, y, z, def.height, def.radius) && visible(x, y, z, def.height)) {
          sim.damageEnemy(slot, BEAM_ENEMY_DAMAGE, -1, CANTOR_BEAM_FORCE, b.x, b.y, true);
        }
      }
    }
  }

  /**
   * Where a carry takes its victim (rooms.md §6.3): the 4 m square with the most Blessed near the
   * victim, row-major ties, then the nearest dry footprint to its centroid with a clear carry path.
   */
  dropPoint(cast: CommanderCast, p: SimPlayer): { x: number; y: number } | undefined {
    const sim = this.sim;
    const rect = sim.map.rooms[cast.room].rect;
    const squares = new Map<number, { count: number; x: number; y: number }>();
    const cols = Math.ceil((rect.x1 - rect.x0 + 1) / CROWD_SQUARE);
    const range = sim.solo ? DROP_RANGE_SOLO : DROP_RANGE;
    let nearbyBlessed = 0;
    let crowdCount = 0;
    for (let k = 0; k < sim.activeCount; k++) {
      const q = sim.active[k];
      if (sim.eType[q] !== BLESSED || !sim.eGrounded[q] || sim.roomAt(sim.eX[q], sim.eY[q]) !== cast.room) continue;
      if (Math.hypot(sim.eX[q] - p.x, sim.eY[q] - p.y) > range) continue;
      const key = Math.floor((sim.eY[q] - rect.y0) / CROWD_SQUARE) * cols + Math.floor((sim.eX[q] - rect.x0) / CROWD_SQUARE);
      const square = squares.get(key) ?? { count: 0, x: 0, y: 0 };
      square.count++;
      square.x += sim.eX[q];
      square.y += sim.eY[q];
      squares.set(key, square);
      nearbyBlessed++;
      crowdCount = Math.max(crowdCount, square.count);
    }
    this.note(cast.slot, { tick: sim.tick, targetId: p.id, distance: Math.hypot(p.x - cast.x, p.y - cast.y), nearbyBlessed, crowdCount,
      reason: 'crowd too small' });
    const crowds = [...squares.entries()].filter(([, square]) => square.count >= CROWD_MIN);
    const winner = crowds.sort((a, b) => b[1].count - a[1].count || a[0] - b[0])[0];
    if (!winner) return;
    this.note(cast.slot, { reason: 'drop path blocked' });
    const crowd = winner[1];
    const cx = crowd.x / crowd.count;
    const cy = crowd.y / crowd.count;
    const cells: Array<{ x: number; y: number; d: number }> = [];
    for (let r = Math.max(rect.y0, Math.floor(cy) - 4); r <= Math.min(rect.y1, Math.floor(cy) + 4); r++) {
      for (let col = Math.max(rect.x0, Math.floor(cx) - 4); col <= Math.min(rect.x1, Math.floor(cx) + 4); col++) {
        const x = col + 0.5;
        const y = r + 0.5;
        const i = r * sim.map.w + col;
        if (Math.hypot(x - p.x, y - p.y) > range || sim.map.hazard[i] || sim.map.solid[i] || !Number.isFinite(sim.map.floor[i])) continue;
        cells.push({ x, y, d: (x - cx) ** 2 + (y - cy) ** 2 });
      }
    }
    cells.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    for (const cell of cells) {
      const ground = sim.map.floor[Math.floor(cell.y) * sim.map.w + Math.floor(cell.x)];
      const height = Math.max(p.z, ground) + CARRY_HEIGHT;
      const lift = carryPathClear(sim.map, cast.room, p.x, p.y, p.z, p.x, p.y, height);
      const across = lift && carryPathClear(sim.map, cast.room, p.x, p.y, height, cell.x, cell.y, height);
      if (across && carryPathClear(sim.map, cast.room, cell.x, cell.y, height, cell.x, cell.y, ground, true)) {
        this.note(cast.slot, { reason: 'ready' });
        return { x: cell.x, y: cell.y };
      }
    }
  }

  /** The Stray-Carrier (rooms.md §6.3): rush a visible player, lift them and carry them toward the crowd. */
  private carrier(cast: CommanderCast): boolean {
    const sim = this.sim;
    const slot = cast.slot;
    if (cast.phase === 'idle' && sim.tick >= this.readyAt[slot] && sim.tick % RUSH_CHECK_TICKS === slot % RUSH_CHECK_TICKS) this.tryRush(cast);
    if (cast.phase === 'idle') return false;
    if (cast.phase === 'recover') {
      // A wall can shorten the fly-through, but must not leave a missed dive parked at head height.
      const ground = sim.map.floor[Math.floor(cast.y) * sim.map.w + Math.floor(cast.x)];
      const z = Math.max(cast.z, Math.min(cast.z + 6 / 30, ground + CARRIER_FLIGHT_HEIGHT));
      if (carryPathClear(sim.map, cast.room, cast.x, cast.y, cast.z, cast.x, cast.y, z)) sim.eZ[slot] = z;
      sim.eState[slot] = ST_ATTACKING;
      return true;
    }
    const p = this.target(cast);
    if (!p || cast.phase === 'carry' && sim.isInvulnerable(p)) {
      this.cancel(slot);
      return true;
    }
    if (cast.phase === 'tell') this.tell(cast, p);
    else if (cast.phase === 'active') this.rush(cast, p);
    else if (cast.phase === 'carry') this.carry(cast, p);
    return true;
  }

  /** Starts a tell at the nearest visible player whose swoop path is clear (R06 follow-up §6). */
  private tryRush(cast: CommanderCast): void {
    const sim = this.sim;
    const slot = cast.slot;
    const targets = sim.players.filter((p) => this.sees(cast, p, CARRIER_SIGHT) && !this.carriedBy(p.id));
    targets.sort((a, b) => Math.hypot(a.x - cast.x, a.y - cast.y) - Math.hypot(b.x - cast.x, b.y - cast.y) || a.index - b.index);
    const p = targets[0];
    this.note(slot, { tick: sim.tick, targetId: p?.id ?? -1, distance: p ? Math.hypot(p.x - cast.x, p.y - cast.y) : 0,
      nearbyBlessed: 0, crowdCount: 0, reason: p ? 'swoop path blocked' : 'no visible target in range' });
    if (!p || !carryPathClear(sim.map, cast.room, cast.x, cast.y, cast.z, p.x, p.y, p.z + 2)) return;
    this.start(cast, p, CARRIER_TELL);
    // A refused start (exhausted cast IDs) leaves the Carrier idle.
    if (cast.targetId !== p.id || cast.phaseTick !== sim.tick) return;
    cast.yaw = Math.atan2(p.y - cast.y, p.x - cast.x);
    this.rescueDamage[slot] = 0;
    this.note(slot, { reason: 'telling' });
  }

  /**
   * The tell: the Carrier holds still, facing its target, and the lane (to the target and on past it)
   * follows them. When it ends the lane locks where the target stands and the flight starts.
   */
  private tell(cast: CommanderCast, p: SimPlayer): void {
    const sim = this.sim;
    const slot = cast.slot;
    sim.eState[slot] = ST_WINDUP;
    cast.yaw = Math.atan2(p.y - cast.y, p.x - cast.x);
    cast.targetX = p.x;
    cast.targetY = p.y;
    cast.targetZ = p.z;
    if (sim.tick < cast.endTick) return;
    if (!carryPathClear(sim.map, cast.room, cast.x, cast.y, cast.z, p.x, p.y, p.z + 2)) {
      this.note(slot, { reason: 'swoop path blocked' });
      this.cancel(slot);
      return;
    }
    cast.phase = 'active';
    cast.phaseTick = sim.tick;
    cast.endTick = sim.tick + CARRIER_SWOOP;
    cast.dropX = p.x;
    cast.dropY = p.y;
    this.origins.set(slot, { x: cast.x, y: cast.y, z: cast.z });
    this.note(slot, { reason: 'rushing' });
  }

  /** A committed flight along the locked lane: backing away is caught, a sidestep out of the lane evades. */
  private rush(cast: CommanderCast, p: SimPlayer): void {
    const sim = this.sim;
    const slot = cast.slot;
    const origin = this.origins.get(slot)!;
    const f = Math.min(1, (sim.tick - cast.phaseTick) / CARRIER_SWOOP);
    const distance = Math.hypot(cast.targetX - origin.x, cast.targetY - origin.y);
    const length = Math.max(CARRIER_MIN_FLIGHT, distance + CARRIER_FLY_THROUGH);
    const travel = length * f;
    const x = origin.x + Math.cos(cast.yaw) * travel;
    const y = origin.y + Math.sin(cast.yaw) * travel;
    // Two parabolic wings meet with zero vertical slope at the grab point.
    const low = cast.targetZ + 2;
    const ground = sim.map.floor[Math.floor(y) * sim.map.w + Math.floor(x)];
    const high = Math.max(origin.z, cast.targetZ + CARRIER_FLIGHT_HEIGHT, Number.isFinite(ground) ? ground + CARRIER_FLIGHT_HEIGHT : 0);
    const z = travel <= distance
      ? low + (origin.z - low) * (1 - travel / Math.max(distance, 1e-9)) ** 2
      : low + (high - low) * ((travel - distance) / (length - distance)) ** 2;
    if (!carryPathClear(sim.map, cast.room, cast.x, cast.y, cast.z, x, y, z)) {
      this.cancel(slot);
      return;
    }
    sim.eX[slot] = x;
    sim.eY[slot] = y;
    sim.eZ[slot] = z;
    sim.eState[slot] = ST_ATTACKING;
    // Sweep the grab along this tick's flight, rather than checking only the final position.
    const dx = x - cast.x;
    const dy = y - cast.y;
    const t = Math.max(0, Math.min(1, ((p.x - cast.x) * dx + (p.y - cast.y) * dy) / Math.max(dx * dx + dy * dy, 1e-9)));
    const grabX = cast.x + dx * t;
    const grabY = cast.y + dy * t;
    const grabZ = cast.z + (z - cast.z) * t;
    const grabbable = !sim.isInvulnerable(p) && !this.carriedBy(p.id) && Math.hypot(p.x - grabX, p.y - grabY) <= CARRIER_GRAB_RADIUS &&
      Math.abs(p.z + 2 - grabZ) <= 2 && carryPathClear(sim.map, cast.room, grabX, grabY, grabZ, p.x, p.y, p.z + 2);
    if (!grabbable) {
      if (sim.tick >= cast.endTick) this.cancel(slot);
      return;
    }
    const drop = this.dropPoint(cast, p);
    cast.dropX = drop?.x ?? p.x;
    cast.dropY = drop?.y ?? p.y;
    cast.phase = 'carry';
    cast.phaseTick = sim.tick;
    cast.endTick = sim.tick + (sim.solo ? CARRIER_MIN_HOLD : CARRIER_PARTY_HOLD);
    this.rescueDamage[slot] = 0;
    this.origins.set(slot, { x: p.x, y: p.y, z: p.z });
    sim.cancelPlayerActions(p);
    sim.teleport(p, p.x, p.y, p.z, undefined, true);
  }

  /** Climbs to 6 m, then flies toward the drop, hurting the victim every 0.5 s. */
  private carry(cast: CommanderCast, p: SimPlayer): void {
    const sim = this.sim;
    const slot = cast.slot;
    const origin = this.origins.get(slot)!;
    const ground = sim.map.floor[Math.floor(p.y) * sim.map.w + Math.floor(p.x)];
    const climb = Math.min(1, (sim.tick - cast.phaseTick) / CARRY_CLIMB_TICKS);
    const z = climb < 1 ? origin.z + (ground + CARRY_HEIGHT - origin.z) * climb : Math.max(p.z, ground + CARRY_HEIGHT);
    const dx = cast.dropX - p.x;
    const dy = cast.dropY - p.y;
    const distance = Math.hypot(dx, dy);
    const step = climb < 1 ? 0 : Math.min(distance, CARRY_SPEED);
    const x = p.x + dx / Math.max(distance, 1e-9) * step;
    const y = p.y + dy / Math.max(distance, 1e-9) * step;
    if (!carryPathClear(sim.map, cast.room, p.x, p.y, p.z, x, y, z)) {
      this.cancel(slot);
      return;
    }
    p.x = x;
    p.y = y;
    p.z = z;
    p.moveVx = p.moveVy = 0;
    sim.eX[slot] = x;
    sim.eY[slot] = y;
    sim.eZ[slot] = z + PLAYER_HEIGHT;
    cast.yaw = Math.atan2(dy, dx);
    sim.eState[slot] = ST_ATTACKING;
    if ((sim.tick - cast.phaseTick) % CARRIER_DAMAGE_INTERVAL === 0) sim.damagePlayer(p, CARRIER_DAMAGE, { x: cast.x, y: cast.y, kind: HURT_MELEE });
    const arrived = climb === 1 && distance <= DROP_REACH && sim.tick - cast.phaseTick >= CARRIER_MIN_HOLD;
    if (p.dead || sim.tick >= cast.endTick || arrived) this.cancel(slot);
  }
}
