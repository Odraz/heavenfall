/** The bot (`?bot=1`): replaces the local player's input in game (§2.5). */
import type { ClassId } from '../data/classes';
import { ENEMIES } from '../data/enemies';
import { FIRE_LEFT, FIRE_RIGHT, SCOURGE_HALF_ARC, SECONDARIES } from '../data/weapons';
import { aimDir, rayCylinder } from '../sim/combat';
import { PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN, PHASE_IDLE } from '../net/protocol';
import { PLAYER_EYE, PLAYER_HEIGHT, PLAYER_RADIUS } from '../sim/constants';
import { FlowField } from '../sim/flowfield';
import { lineOfSight, raycastTerrain } from '../sim/los';
import type { GameMap } from '../sim/map';
import { distToCylinder, type Body } from '../sim/movement';
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
  map: GameMap;
  body: Body;
  dead: boolean;
  enemies: BotEnemy[];
  arenaIndex: number;
  arenaPhase: number;
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
/** The Binder swings at 3 or more enemies in reach; the Betrayer fires a Silver Bullet down a line of more than 10. */
const SCOURGE_MIN = 3;
const BULLET_MIN = 10;
const BULLET_CHECK_MS = 250;

export class Bot {
  private targetSlot = -1;
  private lastLosCheck = -Infinity;
  private readonly field: FlowField;
  private fieldCell = -1;
  private lastFieldTime = -Infinity;
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

    o.pressQ = v.qReady;
    o.pressE = v.eReady;

    // Goal.
    let goal: { x: number; y: number } | null = null;
    if (v.arenaPhase === PHASE_COUNTDOWN) {
      // Every bot heads for its own entry cell in the arena counting down (M8 §6.4).
      const cell = v.map.arenas[v.arenaIndex]?.entryCells[v.entryIndex];
      if (cell) goal = { x: cell[0] + 0.5, y: cell[1] + 0.5 };
    } else if (v.hostPlayer) {
      if (Math.hypot(v.hostPlayer.x - ex, v.hostPlayer.y - ey) > FOLLOW_HOST_DIST) goal = v.hostPlayer;
    } else if (v.arenaPhase === PHASE_COMBAT) {
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
    } else {
      const next = v.arenaPhase === PHASE_IDLE ? v.arenaIndex : v.arenaPhase === PHASE_CLEARED ? v.arenaIndex + 1 : -1;
      const arena = v.map.arenas[next];
      if (arena) goal = { x: arena.entryCells[0][0] + 0.5, y: arena.entryCells[0][1] + 0.5 };
    }

    if (goal) this.steer(now, v, goal, o);
    o.jump = v.blockedLastFrame;
    return o;
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
        // More than 10 enemies' cylinders along the aim within 60 m, up to the terrain, checked 4 times per second.
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
    if (v.souls.length === 0) return null;
    for (const e of v.enemies) if (Math.hypot(e.x - ex, e.y - ey) <= REVIVE_SAFE) return null;
    let best: { x: number; y: number; z: number } | null = null;
    let bestD = REVIVE_RANGE;
    for (const s of v.souls) {
      const d = Math.hypot(s.x - ex, s.y - ey, s.z + SOUL_AIM_HEIGHT - ez);
      if (d > bestD || !lineOfSight(v.map, ex, ey, ez, s.x, s.y, s.z + SOUL_AIM_HEIGHT)) continue;
      best = s;
      bestD = d;
    }
    return best;
  }

  private findVisible(v: BotView, ex: number, ey: number, ez: number): BotEnemy | undefined {
    const list = v.enemies
      .map((e) => {
        const def = ENEMIES[e.type];
        return { e, d: distToCylinder(ex, ey, ez, e.x, e.y, e.z, def.radius, def.height) };
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
    if (cell !== this.fieldCell && now - this.lastFieldTime >= FIELD_INTERVAL) {
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
    if (Math.abs(c - fc) <= 1 && Math.abs(r - fr) <= 1) {
      // In the field's goal cell or next to it: straight at the goal.
      tx = this.fieldCell === cell ? goal.x : fc + 0.5;
      ty = this.fieldCell === cell ? goal.y : fr + 0.5;
    } else {
      const n = this.field.bestNeighbor(c, r);
      if (n < 0) return;
      tx = (n % map.w) + 0.5;
      ty = Math.floor(n / map.w) + 0.5;
    }
    const dx = tx - b.x;
    const dy = ty - b.y;
    const d = Math.hypot(dx, dy);
    if (d < ARRIVE_DIST) return;
    o.dirX = dx / d;
    o.dirY = dy / d;
  }
}
