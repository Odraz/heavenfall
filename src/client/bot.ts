import type { CommanderCast } from '../data/commanders';
import type { WatchmanAim } from '../data/watchman';
import { beamSegment } from '../sim/commanders';
/** The bot (`?bot=1`): replaces the local player's input in game (§2.5). */
import type { ClassId } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { FIRE_LEFT, FIRE_RIGHT, SCOURGE_HALF_ARC, SECONDARIES, WEAPONS } from '../data/weapons';
import { aimDir, rayCylinder } from '../sim/combat';
import { PHASE_COMBAT, PHASE_COUNTDOWN } from '../net/protocol';
import { PLAYER_EYE, PLAYER_HEIGHT, PLAYER_RADIUS } from '../sim/constants';
import { FlowField, UNREACHABLE } from '../sim/flowfield';
import { lineOfSight, raycastTerrain } from '../sim/los';
import { roomCleared, type GameMap } from '../sim/map';
import { distToCylinder, tryDisplace, type Body } from '../sim/movement';
import { DOMINION_HEIGHT_TOLERANCE, DOMINION_RADIUS } from '../data/dominion';
import type { DominionRing } from './dominionView';
import { PITCH_LIMIT } from './localPlayer';

/** A living enemy as the client renders it (interpolated), with its derived height. */
export interface BotEnemy {
  slot: number;
  type: number;
  x: number;
  y: number;
  z: number;
}

export interface BotView {
  stair?: { x: number; y: number } | null;
  map: GameMap;
  body: Body;
  dead: boolean;
  enemies: BotEnemy[];
  /** Already filtered by accepted cast deadline, room and incarnation. */
  dominionRings?: readonly DominionRing[];
  commanderCasts?: readonly CommanderCast[];
  /** Live Watchman aim records (rogue rooms.md §6.4). */
  watchmanAims?: readonly WatchmanAim[];
  /** The snapshot's active room (255: none), its phase and the cleared rooms (rogue game.md §14.3). */
  activeRoom: number;
  activePhase: number;
  clearedMask: number;
  entrySocket?: number;
  /** Multiplayer bots follow humans; a solo autopilot explores. */
  followParty?: boolean;
  /** The host's player position for a client's bot in multiplayer; null for the host's bot. */
  hostPlayer: { x: number; y: number } | null;
  qReady: boolean;
  eReady: boolean;
  /** Horizontal movement was blocked in the previous frame. */
  blockedLastFrame: boolean;
  /** The local player's index: its entry cell in each arena. */
  entryIndex: number;
  /** Teammates' souls: their ground points (M8 §4.1). */
  souls: ReadonlyArray<{ x: number; y: number; z: number }>;
  humanSouls?: ReadonlyArray<{ x: number; y: number; z: number }>;
  classId: ClassId;
  /** Living teammates (not the bot), with their HP as a fraction of max HP, for Sacrament (M9 §8). */
  teammates: ReadonlyArray<{ x: number; y: number; z: number; hpFrac: number }>;
}

export interface BotOutput {
  /** null: keep the current aim. */
  yaw: number | null;
  pitch: number | null;
  dirX: number;
  dirY: number;
  /** The mouse buttons, as the input's `fire` bits (M9 §10). */
  fire: number;
  jump: boolean;
  pressQ: boolean;
  pressE: boolean;
}

const LOS_INTERVAL = 250;
const FIELD_INTERVAL = 500;
const FOLLOW_HOST_DIST = 6;
const ARRIVE_DIST = 0.2;
/** Reviving (M8 §6.4): a soul within 30 m in line of sight, while no enemy is within 6 m. */
const REVIVE_RANGE = 30;
const REVIVE_SAFE = 6;
/** The soul's center, above its ground point, once it floats. */
const SOUL_AIM_HEIGHT = 1.9;
/** Secondaries (M9 §8): the Fallen's slug beyond 20 m; the Heretic heals a teammate under 60% HP within 40 m. */
const SLUG_BEYOND = 20;
const HEAL_BELOW = 0.6;
const HEAL_RANGE = 40;
/** The Binder swings at 3 or more enemies in reach; the Betrayer fires a Silver Bullet down a line of more than 4. */
const SCOURGE_MIN = 3;
const BULLET_MIN = 4;
const BULLET_CHECK_MS = 250;

export class Bot {
  private targetSlot = -1;
  private lastLosCheck = -Infinity;
  private readonly field: FlowField;
  private fieldCell = -1;
  private lastFieldTime = -Infinity;
  private lastRescueTime = -Infinity;
  private rescueGoal: { x: number; y: number } | null = null;
  private waypointCell = -1;
  private waypointGoal = -1;
  private readonly out: BotOutput = { yaw: null, pitch: null, dirX: 0, dirY: 0, fire: 0, jump: false, pressQ: false, pressE: false };
  /** The Betrayer's last line check and its result. */
  private lastLineCheck = -Infinity;
  private lineFull = false;

  constructor(map: GameMap) {
    this.field = new FlowField(map, false);
  }

  update(now: number, v: BotView): BotOutput {
    const o = this.out;
    o.yaw = null;
    o.pitch = null;
    o.dirX = 0;
    o.dirY = 0;
    o.fire = 0;
    o.jump = false;
    o.pressQ = false;
    o.pressE = false;
    if (v.dead) return o;

    const b = v.body;
    const ex = b.x;
    const ey = b.y;
    const ez = b.z + PLAYER_EYE;

    // Aim: the nearest living enemy in line of sight, checked at most 4 times per second.
    let target = this.targetSlot >= 0 ? v.enemies.find((e) => e.slot === this.targetSlot) : undefined;
    if (now - this.lastLosCheck >= LOS_INTERVAL) {
      this.lastLosCheck = now;
      target = this.findVisible(v, ex, ey, ez);
      this.targetSlot = target ? target.slot : -1;
    } else if (!target) {
      this.targetSlot = -1;
    }
    // Reviving comes first when no enemy is close: aim at the soul's center and fire (M8 §6.4).
    const soul = this.soulToRevive(v, ex, ey, ez);
    if (soul) {
      const dx = soul.x - ex;
      const dy = soul.y - ey;
      const dz = soul.z + SOUL_AIM_HEIGHT - ez;
      this.aim(o, dx, dy, dz);
      o.fire = FIRE_LEFT;
    } else {
      // The Heretic heals a hurt teammate when no enemy is close (M9 §8).
      const hurt = v.classId === 'heretic' && !this.enemyNear(v, ex, ey) ? this.teammateToHeal(v, ex, ey, ez) : null;
      if (hurt) {
        this.aim(o, hurt.x - ex, hurt.y - ey, hurt.z + PLAYER_HEIGHT / 2 - ez);
        o.fire = FIRE_RIGHT;
      } else if (target) {
        const def = ENEMIES[target.type];
        const yaw = this.aim(o, target.x - ex, target.y - ey, target.z + def.height / 2 - ez);
        o.fire = this.secondaryPays(now, v, target, ex, ey, ez, yaw, o.pitch ?? 0) ? FIRE_RIGHT : FIRE_LEFT;
      }
    }

    const threatened = v.enemies.length > 0 || (v.dominionRings?.length ?? 0) > 0;
    o.pressQ = v.qReady && threatened;
    o.pressE = v.eReady && threatened;

    // Goal.
    let goal: { x: number; y: number } | null = null;
    if (v.stair) {
      if (Math.hypot(v.stair.x - ex, v.stair.y - ey) > .5) goal = v.stair;
    } else if (v.activePhase === PHASE_COUNTDOWN) {
      // Every bot heads for its own entry cell in the room counting down (M8 §6.4).
      const room = v.map.rooms[v.activeRoom];
      const at = v.hostPlayer ?? b;
      const entry = room?.entry.find((e) => e.socket === v.entrySocket) ?? room?.entry.reduce((best, e) => {
        const distance = (cells: typeof e.cells) => {
          const x = cells.reduce((sum, cell) => sum + cell[0] + 0.5, 0) / 4;
          const y = cells.reduce((sum, cell) => sum + cell[1] + 0.5, 0) / 4;
          return (at.x - x) ** 2 + (at.y - y) ** 2;
        };
        return distance(e.cells) < distance(best.cells) ? e : best;
      });
      const cell = entry?.cells[v.entryIndex];
      if (cell) goal = { x: cell[0] + 0.5, y: cell[1] + 0.5 };
    } else if (v.hostPlayer) {
      if (Math.hypot(v.hostPlayer.x - ex, v.hostPlayer.y - ey) > FOLLOW_HOST_DIST) goal = v.hostPlayer;
    } else if (v.followParty && (v.humanSouls ?? v.souls).length > 0) {
      const souls = v.humanSouls ?? v.souls;
      const retained = this.rescueGoal && souls.some((s) => s.x === this.rescueGoal!.x && s.y === this.rescueGoal!.y);
      if (now - this.lastRescueTime >= FIELD_INTERVAL || (this.rescueGoal && !retained)) {
        this.rescueGoal = [...souls].sort((a, b) => (a.x - ex) ** 2 + (a.y - ey) ** 2 - (b.x - ex) ** 2 - (b.y - ey) ** 2)
          .find((s) => {
            this.field.compute(Math.floor(s.x), Math.floor(s.y));
            return this.field.at(Math.floor(ex), Math.floor(ey)) !== UNREACHABLE;
          }) ?? null;
        this.lastRescueTime = now;
        this.fieldCell = this.rescueGoal ? this.field.targetCell : -1;
        this.lastFieldTime = now;
      }
      goal = this.rescueGoal;
    } else if (v.activePhase === PHASE_COMBAT) {
      if (!target) {
        let best = Infinity;
        for (const e of v.enemies) {
          const d = Math.hypot(e.x - ex, e.y - ey, e.z + ENEMIES[e.type].height / 2 - ez);
          if (d < best) {
            best = d;
            goal = e;
          }
        }
      }
    } else if (!v.followParty) {
      goal = this.nextEntry(v);
    }

    if (goal) this.steer(now, v, goal, o);
    this.escapeDominion(v, o);
    this.escapeCommander(v, o);
    o.jump = v.blockedLastFrame;
    return o;
  }

  /** Sixteen short collision probes: bounded local escape takes precedence over a normal goal. */
  private escapeDominion(v: BotView, o: BotOutput): void {
    const room = v.map.roomOf[Math.floor(v.body.y) * v.map.w + Math.floor(v.body.x)];
    const rings = (v.dominionRings ?? []).filter((c) => c.room === room && Math.abs(c.z - v.body.z) <= DOMINION_HEIGHT_TOLERANCE);
    if (!rings.some((c) => Math.hypot(c.x - v.body.x, c.y - v.body.y) < DOMINION_RADIUS + v.body.radius)) return;
    const clearance = (x: number, y: number) => Math.min(...rings.map((c) => Math.hypot(c.x - x, c.y - y)));
    let best = clearance(v.body.x, v.body.y), dx = 0, dy = 0;
    for (let k = 0; k < 16; k++) {
      const x = Math.cos(k * Math.PI / 8), y = Math.sin(k * Math.PI / 8), probe = { ...v.body };
      // Walk every substep, so an endpoint beyond a wall cannot masquerade as an escape.
      let legal = true;
      for (let n = 0; n < 5; n++) if (!tryDisplace(v.map, probe, x * 0.2, y * 0.2)) { legal = false; break; }
      if (!legal) continue;
      const score = clearance(probe.x, probe.y);
      if (score > best + 1e-6) { best = score; dx = x; dy = y; }
    }
    o.dirX = dx; o.dirY = dy;
  }

  private escapeCommander(v: BotView, o: BotOutput): void {
    const room = v.map.roomOf[Math.floor(v.body.y) * v.map.w + Math.floor(v.body.x)];
    const casts = (v.commanderCasts ?? []).filter((c) => c.room === room && (c.kind === 'beam' || c.targetId === v.entryIndex && (c.phase === 'tell' || c.phase === 'active')));
    if (!casts.length) return;
    const score = (x: number, y: number) => {
      let value = 0;
      for (const c of casts) {
        if (c.kind === 'beam') {
          const dx = x - c.x, dy = y - c.y, d = Math.max(0.01, Math.hypot(dx, dy));
          // Prefer a flank, and clear the visible beam perpendicularly or use cover.
          value -= 2 * (dx * Math.cos(c.yaw) + dy * Math.sin(c.yaw)) / d;
          if (c.phase === 'tell' || c.phase === 'active') {
            const b = beamSegment(v.map, c), along = Math.max(0, Math.min(b.length, (x - b.x) * b.dx + (y - b.y) * b.dy));
            value += Math.min(3, Math.hypot(x - b.x - b.dx * along, y - b.y - b.dy * along)) * 4;
            if (!lineOfSight(v.map, b.x, b.y, b.z, x, y, v.body.z + PLAYER_HEIGHT / 2)) value += 8;
          }
        } else {
          const dx = c.targetX - c.x, dy = c.targetY - c.y, length = Math.max(0.01, Math.hypot(dx, dy));
          value += 4 * Math.abs((x - c.x) * dy - (y - c.y) * dx) / length;
          if (v.teammates.length) value -= Math.min(...v.teammates.map((p) => Math.hypot(x - p.x, y - p.y))) * 0.5;
        }
      }
      return value;
    };
    let best = score(v.body.x, v.body.y);
    for (let k = 0; k < 16; k++) {
      const dx = Math.cos(k * Math.PI / 8), dy = Math.sin(k * Math.PI / 8), probe = { ...v.body };
      let legal = true;
      for (let n = 0; n < 5; n++) if (!tryDisplace(v.map, probe, dx * 0.2, dy * 0.2)) { legal = false; break; }
      if (!legal) continue;
      const next = score(probe.x, probe.y);
      if (next > best + 1e-6) { best = next; o.dirX = dx; o.dirY = dy; }
    }
  }

  /** BFS through cleared rooms; closest frontier first, then room index. */
  private nextEntry(v: BotView): { x: number; y: number } | null {
    const map = v.map;
    if (!map.rooms.some((r) => r.kind === 'breach')) {
      const room = map.rooms.find((_, i) => !roomCleared(v.clearedMask, i));
      const cell = room?.entry[0].cells[v.entryIndex];
      return cell ? { x: cell[0] + 0.5, y: cell[1] + 0.5 } : null;
    }
    const c = Math.floor(v.body.x), r = Math.floor(v.body.y);
    let start = map.roomOf[r * map.w + c];
    if (start === 255) {
      let best = Infinity;
      for (let i = 0; i < map.rooms.length; i++) {
        if (!roomCleared(v.clearedMask, i)) continue;
        for (const e of map.rooms[i].entry) {
          const [x, y] = e.cells[v.entryIndex];
          const d = (v.body.x - x - 0.5) ** 2 + (v.body.y - y - 0.5) ** 2;
          if (d < best) { best = d; start = i; }
        }
      }
    }
    if (start === 255 || !roomCleared(v.clearedMask, start)) return null;
    const distance = new Int16Array(map.rooms.length).fill(-1);
    const queue = [start];
    distance[start] = 0;
    const candidates: Array<{ room: number; from: number; distance: number }> = [];
    for (let k = 0; k < queue.length; k++) {
      const from = queue[k];
      for (const leaf of map.rooms[from].leaves) {
        const to = leaf.to;
        if (to < 0 || distance[to] >= 0) continue;
        if (roomCleared(v.clearedMask, to)) { distance[to] = distance[from] + 1; queue.push(to); }
        else candidates.push({ room: to, from, distance: distance[from] + 1 });
      }
    }
    candidates.sort((a, b) => Number(map.rooms[a.room].kind === 'boss') - Number(map.rooms[b.room].kind === 'boss') || a.distance - b.distance || a.room - b.room);
    const next = candidates[0];
    if (!next) return null;
    const room = map.rooms[next.room];
    const socket = room.leaves.find((l) => l.to === next.from)?.socket;
    const entry = room.entry.find((e) => e.socket === socket) ?? room.entry[0];
    const [x, y] = entry.cells[v.entryIndex];
    return { x: x + 0.5, y: y + 0.5 };
  }

  /** Aims along (dx, dy, dz); returns the yaw. */
  private aim(o: BotOutput, dx: number, dy: number, dz: number): number {
    const yaw = Math.atan2(dy, dx);
    o.yaw = yaw;
    o.pitch = Math.max(-PITCH_LIMIT, Math.min(PITCH_LIMIT, Math.atan2(dz, Math.hypot(dx, dy))));
    return yaw;
  }

  /** A living enemy within 6 m horizontally. */
  private enemyNear(v: BotView, ex: number, ey: number): boolean {
    return v.enemies.some((e) => Math.hypot(e.x - ex, e.y - ey) <= REVIVE_SAFE);
  }

  /** The living teammate under 60% HP with the lowest HP fraction, within 40 m and in line of sight. */
  private teammateToHeal(v: BotView, ex: number, ey: number, ez: number): { x: number; y: number; z: number } | null {
    let best: { x: number; y: number; z: number } | null = null;
    let bestFrac = HEAL_BELOW;
    for (const t of v.teammates) {
      if (t.hpFrac >= bestFrac) continue;
      if (distToCylinder(ex, ey, ez, t.x, t.y, t.z, PLAYER_RADIUS, PLAYER_HEIGHT) > HEAL_RANGE) continue;
      if (!lineOfSight(v.map, ex, ey, ez, t.x, t.y, t.z + PLAYER_HEIGHT / 2)) continue;
      best = t;
      bestFrac = t.hpFrac;
    }
    return best;
  }

  /** Whether the class's secondary is the better attack at its aim (M9 §8). */
  private secondaryPays(now: number, v: BotView, target: BotEnemy, ex: number, ey: number, ez: number, yaw: number, pitch: number): boolean {
    switch (v.classId) {
      case 'fallen': {
        const def = ENEMIES[target.type];
        return distToCylinder(ex, ey, ez, target.x, target.y, target.z, def.radius, def.height) > SLUG_BEYOND;
      }
      case 'binder': {
        // At least 3 enemies within the Scourge's 3 m of the body center and 60 degrees of the aim.
        const cz = v.body.z + PLAYER_HEIGHT / 2;
        const cosMax = Math.cos(SCOURGE_HALF_ARC);
        let n = 0;
        for (const e of v.enemies) {
          const def = ENEMIES[e.type];
          if (distToCylinder(v.body.x, v.body.y, cz, e.x, e.y, e.z, def.radius, def.height) > SECONDARIES.binder.range) continue;
          const hx = e.x - v.body.x;
          const hy = e.y - v.body.y;
          const len = Math.hypot(hx, hy);
          if (len > 1e-9 && (hx * Math.cos(yaw) + hy * Math.sin(yaw)) / len < cosMax - 1e-9) continue;
          if (++n >= SCOURGE_MIN) return true;
        }
        return false;
      }
      case 'betrayer': {
        // More than 4 enemies' cylinders along the aim within 60 m, up to the terrain, checked 4 times per second.
        if (now - this.lastLineCheck >= BULLET_CHECK_MS) {
          this.lastLineCheck = now;
          const [dx, dy, dz] = aimDir(yaw, pitch);
          const stop = raycastTerrain(v.map, ex, ey, ez, dx, dy, dz, SECONDARIES.betrayer.range);
          let n = 0;
          for (const e of v.enemies) {
            const def = ENEMIES[e.type];
            if (rayCylinder(ex, ey, ez, dx, dy, dz, e.x, e.y, e.z, def.radius, def.height) <= stop) n++;
          }
          this.lineFull = n > BULLET_MIN;
        }
        return this.lineFull;
      }
      default:
        return false;
    }
  }

  /** The nearest teammate's soul within 30 m in line of sight, if no living enemy is within 6 m. */
  private soulToRevive(v: BotView, ex: number, ey: number, ez: number): { x: number; y: number; z: number } | null {
    const rescue = v.followParty && !v.hostPlayer;
    const souls = rescue ? v.humanSouls ?? v.souls : v.souls;
    if (souls.length === 0) return null;
    if (!rescue) for (const e of v.enemies) if (Math.hypot(e.x - ex, e.y - ey) <= REVIVE_SAFE) return null;
    let best: { x: number; y: number; z: number } | null = null;
    let bestD = REVIVE_RANGE;
    for (const s of souls) {
      const d = Math.hypot(s.x - ex, s.y - ey, s.z + SOUL_AIM_HEIGHT - ez);
      if (d > bestD || !lineOfSight(v.map, ex, ey, ez, s.x, s.y, s.z + SOUL_AIM_HEIGHT)) continue;
      best = s;
      bestD = d;
    }
    return best;
  }

  private findVisible(v: BotView, ex: number, ey: number, ez: number): BotEnemy | undefined {
    const range = WEAPONS[v.classId].range;
    const list = v.enemies
      .map((e) => {
        const def = ENEMIES[e.type];
        const d = distToCylinder(ex, ey, ez, e.x, e.y, e.z, def.radius, def.height);
        // A carrier holding a teammate first; then a Watchman aiming at this bot, within its weapon's range.
        const aiming = d <= range && v.watchmanAims?.some((a) => a.slot === e.slot && a.phase === 'aim' && a.targetId === v.entryIndex);
        return { e, d: (v.commanderCasts?.some((c) => c.slot === e.slot && c.phase === 'carry') ? -10000 : aiming ? -5000 : 0) + d };
      })
      .sort((a, b) => a.d - b.d);
    for (const { e } of list) {
      if (lineOfSight(v.map, ex, ey, ez, e.x, e.y, e.z + ENEMIES[e.type].height / 2)) return e;
    }
    return undefined;
  }

  /** Follows a ground flow field toward the goal's cell, steering like an enemy (§7.3). */
  private steer(now: number, v: BotView, goal: { x: number; y: number }, o: BotOutput): void {
    const map = v.map;
    const gc = Math.floor(goal.x);
    const gr = Math.floor(goal.y);
    const cell = gr * map.w + gc;
    if (now - this.lastFieldTime >= FIELD_INTERVAL) {
      this.field.compute(gc, gr);
      this.fieldCell = cell;
      this.lastFieldTime = now;
    }
    if (this.fieldCell < 0) return;
    const b = v.body;
    const c = Math.floor(b.x);
    const r = Math.floor(b.y);
    const fc = this.fieldCell % map.w;
    const fr = Math.floor(this.fieldCell / map.w);
    let tx: number;
    let ty: number;
    if (c === fc && r === fr) {
      // In the goal cell: straight to the requested point.
      tx = this.fieldCell === cell ? goal.x : fc + 0.5;
      ty = this.fieldCell === cell ? goal.y : fr + 0.5;
      this.waypointCell = -1;
    } else {
      const wx = (this.waypointCell % map.w) + 0.5;
      const wy = Math.floor(this.waypointCell / map.w) + 0.5;
      // Finish a diagonal through its centre before selecting the next cell. Replanning at the
      // intermediate orthogonal cell can turn back on a stair and oscillate forever.
      const waypointDistance = Math.hypot(wx - b.x, wy - b.y);
      if (this.waypointCell < 0 || this.waypointGoal !== this.fieldCell || this.field.dist[this.waypointCell] === UNREACHABLE || waypointDistance < ARRIVE_DIST || waypointDistance > 2) {
        this.waypointCell = this.field.bestNeighbor(c, r);
        this.waypointGoal = this.fieldCell;
      }
      if (this.waypointCell < 0) return;
      tx = (this.waypointCell % map.w) + 0.5;
      ty = Math.floor(this.waypointCell / map.w) + 0.5;
    }
    const dx = tx - b.x;
    const dy = ty - b.y;
    const d = Math.hypot(dx, dy);
    if (d < ARRIVE_DIST) return;
    o.dirX = dx / d;
    o.dirY = dy / d;
  }
}
