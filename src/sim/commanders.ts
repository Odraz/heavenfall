import { BLESSED, CANTOR, CARRIER, ENEMIES, ST_ATTACKING, ST_WINDUP } from '../data/enemies';
import { CANTOR_AIM_SPEED, CANTOR_BEAM_TURN_SPEED, CANTOR_BEAM, CANTOR_COOLDOWN, CANTOR_RECOVERY, CANTOR_TELL, CARRIER_COOLDOWN, CARRIER_MARK, CARRIER_RECOVERY, CARRIER_SWOOP, COMMANDER_RECORD_CAP, turnToward, type CommanderCast } from '../data/commanders';
import { ENEMY_SLOTS, PLAYER_HEIGHT, PLAYER_RADIUS } from './constants';
import { circleOverlapsCell } from './movement';
import { lineOfSight, raycastTerrain } from './los';
import type { GameMap } from './map';
import type { Simulation, SimPlayer } from './sim';
import type { CarrierCheck } from '../data/commanders';

/** Conservative swept footprint. Walls/leaves and room boundaries block even above their tops. */
export function carryPathClear(map: GameMap, room: number, ax: number, ay: number, az: number, bx: number, by: number, bz: number, dryEnd = false): boolean {
  const steps = Math.max(1, Math.ceil(Math.hypot(bx - ax, by - ay, bz - az) / 0.2));
  for (let n = 0; n <= steps; n++) {
    const f = n / steps, x = ax + (bx - ax) * f, y = ay + (by - ay) * f, z = az + (bz - az) * f;
    for (let r = Math.floor(y - 1); r <= Math.floor(y + 1); r++) for (let c = Math.floor(x - 1); c <= Math.floor(x + 1); c++) {
      if (!circleOverlapsCell(x, y, 1, c, r)) continue;
      const i = r * map.w + c;
      if (c < 0 || r < 0 || c >= map.w || r >= map.h || map.roomOf[i] !== room || map.solid[i] || !Number.isFinite(map.floor[i]) || map.floor[i] > z + 0.01 || dryEnd && n === steps && map.hazard[i]) return false;
    }
  }
  return true;
}

export function beamSegment(map: GameMap, c: CommanderCast): { x: number; y: number; z: number; dx: number; dy: number; dz: number; length: number } {
  const x = c.x + 0.6 * Math.cos(c.yaw), y = c.y + 0.6 * Math.sin(c.yaw), z = c.z + 2;
  const dx = Math.cos(c.yaw) * Math.cos(c.pitch), dy = Math.sin(c.yaw) * Math.cos(c.pitch), dz = Math.sin(c.pitch);
  const length = raycastTerrain(map, x, y, z, dx, dy, dz, 30);
  return { x, y, z, dx, dy, dz, length };
}

/** Distance between a beam segment and the victim's vertical body segment. */
export function beamHits(b: ReturnType<typeof beamSegment>, x: number, y: number, z: number, height: number, radius: number): boolean {
  const radius2 = (radius + 0.5) ** 2;
  const cuts = [0, b.length];
  if (Math.abs(b.dz) > 1e-9) for (const capZ of [z, z + height]) {
    const t = (capZ - b.z) / b.dz; if (t > 0 && t < b.length) cuts.push(t);
  }
  cuts.sort((a, b) => a - b);
  for (let i = 0; i < cuts.length - 1; i++) {
    const lo = cuts[i], hi = cuts[i + 1], midZ = b.z + b.dz * (lo + hi) / 2;
    const cap = midZ < z ? z : midZ > z + height ? z + height : undefined;
    const dz = cap === undefined ? 0 : b.dz, oz = cap === undefined ? 0 : b.z - cap;
    const denominator = b.dx ** 2 + b.dy ** 2 + dz ** 2;
    const t = Math.max(lo, Math.min(hi, denominator > 1e-12 ? -((b.x - x) * b.dx + (b.y - y) * b.dy + oz * dz) / denominator : lo));
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
  private readonly carrierChecks = new Map<number, CarrierCheck>();
  constructor(private readonly sim: Simulation) {}
  checkpoint(): CommanderCast[] { return [...this.active.values()].map((c) => ({ ...c })); }
  diagnostics(): CarrierCheck[] {
    return [...this.carrierChecks.values()].map((check) => ({ ...check, phase: this.active.get(check.slot)!.phase, readyTick: this.readyAt[check.slot] }));
  }
  hasFamily(type: number, room: number): boolean { return [...this.active.values()].some((c) => c.room === room && (c.kind === 'beam' ? CANTOR : CARRIER) === type); }
  spawn(slot: number): void {
    const s = this.sim, type = s.eType[slot];
    if (type !== CANTOR && type !== CARRIER) return;
    if (this.nextId > 0xffffffff || this.active.size >= COMMANDER_RECORD_CAP) throw new Error('commander record capacity exhausted');
    const p = s.players.find((p) => s.livingTargetable(p));
    this.active.set(slot, { kind: type === CANTOR ? 'beam' : 'carry', slot, incarnation: s.eIncarnation[slot], room: s.eRoom[slot], castId: this.nextId++,
      phase: 'idle', startTick: s.tick, phaseTick: s.tick, endTick: s.tick, targetId: -1,
      x: s.eX[slot], y: s.eY[slot], z: s.eZ[slot], yaw: p ? Math.atan2(p.y - s.eY[slot], p.x - s.eX[slot]) : 0, pitch: 0,
      targetX: s.eX[slot], targetY: s.eY[slot], targetZ: s.eZ[slot], dropX: s.eX[slot], dropY: s.eY[slot] });
    this.readyAt[slot] = s.tick + (type === CARRIER ? 90 : 0);
    if (type === CARRIER) this.carrierChecks.set(slot, { slot, phase: 'idle', tick: s.tick, targetId: -1, distance: 0, nearbyBlessed: 0, crowdCount: 0, reason: 'initial delay', readyTick: this.readyAt[slot] });
    this.rescueThreshold[slot] = s.eHp[slot] * 0.2;
  }
  carriedBy(id: number): CommanderCast | undefined { return [...this.active.values()].find((c) => c.kind === 'carry' && c.phase === 'carry' && c.targetId === id); }
  releasePlayer(id: number, correction = true): void { const c = this.carriedBy(id); if (c) this.cancel(c.slot, correction); }
  cancel(slot: number, correction = true): void {
    const c = this.active.get(slot), s = this.sim;
    if (!c || c.phase === 'idle' || c.phase === 'recover') return;
    const carried = c.phase === 'carry', p = s.players.find((p) => p.id === c.targetId);
    c.phase = 'recover'; c.phaseTick = s.tick; c.endTick = s.tick + (c.kind === 'beam' ? CANTOR_RECOVERY : CARRIER_RECOVERY);
    this.readyAt[slot] = s.tick + (c.kind === 'beam' ? CANTOR_COOLDOWN : CARRIER_COOLDOWN);
    this.origins.delete(slot);
    if (carried && p && correction) s.teleport(p, p.x, p.y, p.z, undefined, false);
  }
  remove(slot: number): void { this.cancel(slot); this.active.delete(slot); this.origins.delete(slot); this.carrierChecks.delete(slot); }
  damaged(slot: number, amount: number): void {
    if (this.active.get(slot)?.phase !== 'carry') return;
    this.rescueDamage[slot] += amount;
    if (this.rescueDamage[slot] >= this.rescueThreshold[slot] - 1e-6) this.cancel(slot);
  }
  private target(c: CommanderCast): SimPlayer | undefined {
    return this.sim.players.find((p) => p.id === c.targetId && this.sim.livingTargetable(p) && this.sim.roomAt(p.x, p.y) === c.room);
  }
  private sees(c: CommanderCast, p: SimPlayer, range: number): boolean {
    return this.sim.livingTargetable(p) && this.sim.roomAt(p.x, p.y) === c.room && Math.hypot(p.x - c.x, p.y - c.y) <= range &&
      lineOfSight(this.sim.map, c.x, c.y, c.z + ENEMIES[this.sim.eType[c.slot]].height / 2, p.x, p.y, p.z + PLAYER_HEIGHT / 2);
  }
  private start(c: CommanderCast, p: SimPlayer, duration: number): void {
    if (this.nextId > 0xffffffff || this.sim.tick + 300 > 0xffffffff) return;
    c.castId = this.nextId++; c.startTick = c.phaseTick = this.sim.tick; c.endTick = this.sim.tick + duration;
    this.sim.eCast[c.slot] = 0; this.sim.eCastT[c.slot] = 0;
    c.phase = 'tell'; c.targetId = p.id; c.targetX = p.x; c.targetY = p.y; c.targetZ = p.z;
  }
  /** Returns whether this commander owns its movement this tick. */
  update(slot: number): boolean {
    const c = this.active.get(slot), s = this.sim;
    if (!c) return false;
    c.x = s.eX[slot]; c.y = s.eY[slot]; c.z = s.eZ[slot];
    if (s.roomAt(c.x, c.y) !== c.room) { this.cancel(slot); return false; }
    const blocked = s.isStunned(slot) || s.tick < s.eSilenceUntil[slot] || !s.eGrounded[slot] ||
      c.kind === 'carry' && (s.isRooted(slot) || s.tick < s.eTauntUntil[slot]);
    if (blocked) {
      const check = this.carrierChecks.get(slot); if (check) { check.reason = 'controlled'; check.tick = s.tick; }
      this.cancel(slot); return false;
    }
    if (c.phase === 'recover' && s.tick >= c.endTick) c.phase = 'idle';
    if (c.kind === 'beam') return this.cantor(c);
    return this.carrier(c);
  }
  private cantor(c: CommanderCast): boolean {
    const s = this.sim, slot = c.slot;
    const taunted = s.tick < s.eTauntUntil[slot];
    if (taunted) { const p = s.players.find((p) => p.classId === 'fallen' && s.livingTargetable(p) && s.roomAt(p.x, p.y) === c.room); if (p) c.targetId = p.id; }
    if (c.phase === 'idle' && s.tick >= this.readyAt[slot]) {
      const targets = s.players.filter((p) => this.sees(c, p, 25) && (!taunted || p.classId === 'fallen'));
      targets.sort((a, b) => Math.hypot(b.x - c.x, b.y - c.y) - Math.hypot(a.x - c.x, a.y - c.y) || a.index - b.index);
      if (targets[0]) this.start(c, targets[0], CANTOR_TELL);
    }
    const p = this.target(c);
    if (c.phase === 'tell' && !p) { this.cancel(slot); return true; }
    if (p && c.phase !== 'idle') { c.targetX = p.x; c.targetY = p.y; c.targetZ = p.z; }
    if (c.phase === 'idle') {
      const nearest = s.players.filter((p) => s.livingTargetable(p) && s.roomAt(p.x, p.y) === c.room).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
      if (nearest) { c.targetX = nearest.x; c.targetY = nearest.y; c.targetZ = nearest.z; }
    }
    const turn = (c.phase === 'active' || c.phase === 'recover' ? CANTOR_BEAM_TURN_SPEED : c.phase === 'tell' ? CANTOR_AIM_SPEED : Math.PI / 2) / 30;
    c.yaw = turnToward(c.yaw, Math.atan2(c.targetY - c.y, c.targetX - c.x), turn);
    const pitch = Math.max(-35 * Math.PI / 180, Math.min(35 * Math.PI / 180, Math.atan2(c.targetZ + PLAYER_HEIGHT / 2 - c.z - 2, Math.max(0.01, Math.hypot(c.targetX - c.x, c.targetY - c.y) - 0.6))));
    c.pitch += Math.max(-turn, Math.min(turn, pitch - c.pitch));
    if (c.phase === 'tell' && s.tick >= c.endTick) { c.phase = 'active'; c.phaseTick = s.tick; c.endTick = s.tick + CANTOR_BEAM; }
    if (c.phase === 'active' && s.tick >= c.endTick) this.cancel(slot);
    const hold = c.phase !== 'idle' || s.players.some((p) => this.sees(c, p, 25));
    if (hold) s.eState[slot] = c.phase === 'tell' ? ST_WINDUP : ST_ATTACKING;
    return hold;
  }
  /** Called after separation built the spatial hashes. No full-enemy scan per beam pulse. */
  pulse(): void {
    const s = this.sim;
    for (const c of this.active.values()) {
      c.x = s.eX[c.slot]; c.y = s.eY[c.slot]; c.z = s.eZ[c.slot];
      if (c.kind !== 'beam' || c.phase !== 'active' || (s.tick - c.phaseTick) % 10 !== 0) continue;
      const b = beamSegment(s.map, c);
      const visible = (x: number, y: number, z: number, h: number) => lineOfSight(s.map, b.x, b.y, b.z, x, y, z + h / 2);
      for (const p of s.players) if (s.livingTargetable(p) && s.roomAt(p.x, p.y) === c.room && beamHits(b, p.x, p.y, p.z, PLAYER_HEIGHT, PLAYER_RADIUS) && visible(p.x, p.y, p.z, PLAYER_HEIGHT)) s.damagePlayer(p, 10);
      for (const slot of s.commanderBeamCandidates(b)) {
        if (!s.eAlive[slot] || s.eType[slot] > 2 || s.roomAt(s.eX[slot], s.eY[slot]) !== c.room) continue;
        const d = ENEMIES[s.eType[slot]];
        if (beamHits(b, s.eX[slot], s.eY[slot], s.eZ[slot], d.height, d.radius) && visible(s.eX[slot], s.eY[slot], s.eZ[slot], d.height)) s.damageEnemy(slot, 20, -1);
      }
    }
  }
  private strayDistance(p: SimPlayer): number {
    let distance = Infinity;
    for (const other of this.sim.players) if (other !== p && this.sim.livingTargetable(other)) distance = Math.min(distance, Math.hypot(p.x - other.x, p.y - other.y));
    return distance;
  }
  /** One enemy pass, row-major ties, then nearest dry footprint to the winning centroid. */
  dropPoint(c: CommanderCast, p: SimPlayer): { x: number; y: number } | undefined {
    const s = this.sim, rect = s.map.rooms[c.room].rect, squares = new Map<number, { count: number; x: number; y: number }>();
    const check = this.carrierChecks.get(c.slot);
    if (check) Object.assign(check, { tick: s.tick, targetId: p.id, distance: Math.hypot(p.x - c.x, p.y - c.y), nearbyBlessed: 0, crowdCount: 0, reason: 'crowd too small' });
    const cols = Math.ceil((rect.x1 - rect.x0 + 1) / 4), range = s.solo ? 7 : 10;
    for (let k = 0; k < s.activeCount; k++) {
      const q = s.active[k];
      if (s.eType[q] !== BLESSED || !s.eGrounded[q] || s.roomAt(s.eX[q], s.eY[q]) !== c.room || Math.hypot(s.eX[q] - p.x, s.eY[q] - p.y) > range) continue;
      const key = Math.floor((s.eY[q] - rect.y0) / 4) * cols + Math.floor((s.eX[q] - rect.x0) / 4);
      const v = squares.get(key) ?? { count: 0, x: 0, y: 0 }; v.count++; v.x += s.eX[q]; v.y += s.eY[q]; squares.set(key, v);
      if (check) { check.nearbyBlessed++; check.crowdCount = Math.max(check.crowdCount, v.count); }
    }
    const winner = [...squares.entries()].filter(([, v]) => v.count >= 8).sort((a, b) => b[1].count - a[1].count || a[0] - b[0])[0];
    if (!winner) return;
    if (check) check.reason = 'drop path blocked';
    const v = winner[1], cx = v.x / v.count, cy = v.y / v.count;
    const cells: Array<{ x: number; y: number; d: number }> = [];
    for (let r = Math.max(rect.y0, Math.floor(cy) - 4); r <= Math.min(rect.y1, Math.floor(cy) + 4); r++) for (let col = Math.max(rect.x0, Math.floor(cx) - 4); col <= Math.min(rect.x1, Math.floor(cx) + 4); col++) {
      const x = col + 0.5, y = r + 0.5, i = r * s.map.w + col;
      if (Math.hypot(x - p.x, y - p.y) > range || s.map.hazard[i] || s.map.solid[i] || !Number.isFinite(s.map.floor[i])) continue;
      cells.push({ x, y, d: (x - cx) ** 2 + (y - cy) ** 2 });
    }
    cells.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x);
    for (const q of cells) {
      const ground = s.map.floor[Math.floor(q.y) * s.map.w + Math.floor(q.x)], height = Math.max(p.z, ground) + 6;
      if (carryPathClear(s.map, c.room, p.x, p.y, p.z, p.x, p.y, height) && carryPathClear(s.map, c.room, p.x, p.y, height, q.x, q.y, height) && carryPathClear(s.map, c.room, q.x, q.y, height, q.x, q.y, ground, true)) {
        if (check) check.reason = 'ready';
        return { x: q.x, y: q.y };
      }
    }
  }
  private carrier(c: CommanderCast): boolean {
    const s = this.sim, slot = c.slot;
    const check = this.carrierChecks.get(slot)!;
    if (c.phase === 'idle' && s.tick >= this.readyAt[slot] && s.tick % 15 === slot % 15) {
      const strays = s.players.filter((p) => this.sees(c, p, 20) && this.strayDistance(p) >= 15 && !this.carriedBy(p.id));
      strays.sort((a, b) => { const ad = this.strayDistance(a), bd = this.strayDistance(b); return ad === bd ? a.index - b.index : bd - ad; });
      // Only one crowd scan per check. Diagnostics reuse the exact decision and count.
      if (!strays.length) {
        const nearest = s.players.filter((p) => s.livingTargetable(p) && s.roomAt(p.x, p.y) === c.room)
          .sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
        const distance = nearest ? Math.hypot(nearest.x - c.x, nearest.y - c.y) : 0;
        Object.assign(check, { tick: s.tick, targetId: nearest?.id ?? -1, distance, nearbyBlessed: 0, crowdCount: 0,
          reason: !nearest ? 'no target' : this.strayDistance(nearest) < 15 ? 'near teammate' : distance > 20 ? 'out of range' : this.carriedBy(nearest.id) ? 'already carried' : 'no line of sight' });
      }
      const p = strays[0], drop = p && this.dropPoint(c, p);
      if (p && drop) { this.start(c, p, CARRIER_MARK); c.dropX = drop.x; c.dropY = drop.y; }
    }
    if (c.phase === 'idle') return false;
    if (c.phase === 'recover') { s.eState[slot] = ST_ATTACKING; return true; }
    const p = this.target(c);
    if (!p || c.phase === 'carry' && s.isInvulnerable(p)) { this.cancel(slot); return true; }
    if (c.phase === 'tell') {
      c.targetX = p.x; c.targetY = p.y; c.targetZ = p.z;
      c.yaw = Math.atan2(p.y - c.y, p.x - c.x); s.eState[slot] = ST_WINDUP;
      if (s.tick >= c.endTick) {
        const drop = this.strayDistance(p) >= 15 && this.dropPoint(c, p);
        if (!drop) { if (this.strayDistance(p) < 15) check.reason = 'near teammate'; this.cancel(slot); return true; }
        if (!carryPathClear(s.map, c.room, c.x, c.y, c.z, p.x, p.y, p.z + 2)) { check.reason = 'swoop path blocked'; this.cancel(slot); return true; }
        c.dropX = drop.x; c.dropY = drop.y; c.phase = 'active'; c.phaseTick = s.tick; c.endTick = s.tick + CARRIER_SWOOP;
        this.origins.set(slot, { x: c.x, y: c.y, z: c.z });
      }
    } else if (c.phase === 'active') {
      const o = this.origins.get(slot)!, f = Math.min(1, (s.tick - c.phaseTick) / CARRIER_SWOOP);
      const x = o.x + (c.targetX - o.x) * f, y = o.y + (c.targetY - o.y) * f, z = o.z + (c.targetZ + 2 - o.z) * f;
      if (!carryPathClear(s.map, c.room, c.x, c.y, c.z, x, y, z)) { this.cancel(slot); return true; }
      s.eX[slot] = x; s.eY[slot] = y; s.eZ[slot] = z; s.eState[slot] = ST_ATTACKING;
      if (s.tick >= c.endTick) {
        if (s.isInvulnerable(p) || Math.hypot(p.x - c.targetX, p.y - c.targetY) > 1.5 || Math.abs(p.z - c.targetZ) > 2 || this.strayDistance(p) < 15) { this.cancel(slot); return true; }
        c.phase = 'carry'; c.phaseTick = s.tick; c.endTick = s.tick + (s.solo ? 75 : 105); this.rescueDamage[slot] = 0;
        this.origins.set(slot, { x: p.x, y: p.y, z: p.z });
        s.teleport(p, p.x, p.y, p.z, undefined, true);
      }
    } else if (c.phase === 'carry') {
      const o = this.origins.get(slot)!;
      const ground = s.map.floor[Math.floor(p.y) * s.map.w + Math.floor(p.x)];
      const climb = Math.min(1, (s.tick - c.phaseTick) / 15), z = climb < 1 ? o.z + (ground + 6 - o.z) * climb : Math.max(p.z, ground + 6);
      const dx = c.dropX - p.x, dy = c.dropY - p.y, distance = Math.hypot(dx, dy), step = climb < 1 ? 0 : Math.min(distance, 3.5 / 30);
      const x = p.x + dx / Math.max(distance, 1e-9) * step, y = p.y + dy / Math.max(distance, 1e-9) * step;
      if (!carryPathClear(s.map, c.room, p.x, p.y, p.z, x, y, z)) { this.cancel(slot); return true; }
      p.x = x; p.y = y; p.z = z; p.moveVx = p.moveVy = 0;
      s.eX[slot] = x; s.eY[slot] = y; s.eZ[slot] = z + PLAYER_HEIGHT; c.yaw = Math.atan2(dy, dx); s.eState[slot] = ST_ATTACKING;
      if (s.tick >= c.endTick || climb === 1 && distance <= 0.5) this.cancel(slot);
    }
    return true;
  }
}
