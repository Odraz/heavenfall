/** The host simulation: pure TypeScript, no three.js or DOM (§2.2). */
import { CLASSES, type ClassId } from '../data/classes';
import type { DungeonDef } from '../data/dungeons/types';
import {
  BLESSED,
  CHERUB,
  CHERUB_CLIMB,
  CHERUB_HOVER,
  CHORISTER,
  ENEMIES,
  GATEKEEPER,
  ST_FALLING,
  ST_IDLE,
  ST_MOVING,
} from '../data/enemies';
import type { GameEvent } from '../net/messages';
import {
  encodeSnapshot,
  FLAG_HURT,
  PHASE_CLEARED,
  PHASE_COMBAT,
  PHASE_IDLE,
  type SnapshotEntities,
  type SnapshotHeader,
  type InputMsg,
  type SnapshotPlayer,
} from '../net/protocol';
import {
  ENEMY_SLOTS,
  MAX_LIVING_ENEMIES,
  PLAYER_HEIGHT,
  PLAYER_RADIUS,
  SLOT_REUSE_TICKS,
  TICK_DT,
  TICK_HZ,
  TICK_MS,
} from './constants';
import { FlowField, UNREACHABLE } from './flowfield';
import { lineOfSight } from './los';
import { insideRect, loadMap, setArenaDoors, type GameMap } from './map';
import { distToCylinder, groundHeight, moveHorizontal, stepBody, tryDisplace, type Body, type MoveResult } from './movement';
import { mulberry32 } from './rng';

/** Choristers in waves are skipped until milestone 3 (§16). */
export const CHORISTERS_ENABLED = false;

/** Party-size multipliers ×10 (§7.5), indexed by party size. */
const MULT10 = [0, 4, 6, 8, 10];

/** Scales one enemy count for the party size, rounding up (§7.5). */
export function scaleCount(count: number, partySize: number): number {
  const m = MULT10[Math.max(1, Math.min(4, partySize))];
  return Math.ceil((count * m) / 10);
}

export interface SimPlayerInit {
  id: number;
  name: string;
  classId: ClassId;
}

export interface SimOptions {
  dungeon: DungeonDef;
  /** Players at `go`; sorted by id internally. */
  players: SimPlayerInit[];
  seed: number;
  /** Every player is invulnerable (`god=1`). */
  god?: boolean;
  /** Benchmark mode (§2.5). */
  bench?: boolean;
  /** Arena waves are disabled (tests). */
  noWaves?: boolean;
}

export interface SimEvent {
  to: number | 'all';
  event: GameEvent;
}

export interface SimPlayer {
  id: number;
  index: number;
  name: string;
  classId: ClassId;
  speed: number;
  maxHp: number;
  hp: number;
  shield: number;
  dead: boolean;
  connected: boolean;
  invulnerable: boolean;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  fireHeld: boolean;
  qPresses: number;
  ePresses: number;
  allyTargetId: number;
  kills: number;
  cdQ: number;
  cdE: number;
  /** Highest accepted input sequence number, or -1. */
  lastSeq: number;
  /** Host time (ms) when the previous accepted input arrived, or the latest teleport. */
  lastAcceptMs: number;
  /** The host's latest teleport ID for this player. */
  teleportId: number;
  /** Speed check skipped until this host time (ms). */
  speedCheckSkipUntil: number;
}

interface SpawnBatch {
  counts: number[];
  spawned: number[];
  /** Wave index, or -1 for benchmark top-ups and summons. */
  wave: number;
}

interface ArenaState {
  phase: number;
  /** Index of the latest started wave, or -1. */
  wave: number;
  waveStartTick: number;
  queue: SpawnBatch[];
  /** Round-robin position over the spawn points. */
  rr: number;
  budgets: Float64Array;
  waveTotals: number[];
  waveAlive: number[];
  waveFullySpawned: boolean[];
  /** Living enemies belonging to this arena (not counting the Gatekeeper). */
  alive: number;
}

/** Enemy type order for spawning ties: Blessed, Choristers, Cherubs. */
const SPAWN_TYPES = [BLESSED, CHORISTER, CHERUB];
const SPAWN_ELIGIBLE_DIST = 8;
const BUDGET_PER_TICK = 50 / 30;
const BUDGET_MAX = 2;
const WAVE_NEXT_FRACTION = 0.2;
const WAVE_NEXT_TICKS = 20 * TICK_HZ;
const RETARGET_TICKS = TICK_HZ;
/** Line of sight is checked at most twice per second per enemy. */
const LOS_TICKS = TICK_HZ / 2;
const BLESSED_STOP = 1.0;
const CHERUB_RANGE = 25;
const CHERUB_STRAFE_SPEED = 2;
const CHERUB_STRAFE_SWITCH = 2;
const MAX_SEPARATION_NEIGHBORS = 8;

export class Simulation {
  readonly map: GameMap;
  readonly players: SimPlayer[];
  readonly partySize: number;
  readonly bench: boolean;
  readonly noWaves: boolean;
  readonly random: () => number;
  /** Ticks simulated so far; the tick being simulated during step(). */
  tick = 0;
  /** Host time of the current tick, ms. */
  nowMs = 0;
  readonly events: SimEvent[] = [];
  readonly arenas: ArenaState[];

  // Enemies, structure of arrays indexed by slot.
  readonly eAlive = new Uint8Array(ENEMY_SLOTS);
  readonly eType = new Uint8Array(ENEMY_SLOTS);
  readonly eState = new Uint8Array(ENEMY_SLOTS);
  readonly eX = new Float64Array(ENEMY_SLOTS);
  readonly eY = new Float64Array(ENEMY_SLOTS);
  readonly eZ = new Float64Array(ENEMY_SLOTS);
  readonly eVz = new Float64Array(ENEMY_SLOTS);
  readonly eGrounded = new Uint8Array(ENEMY_SLOTS);
  readonly eHp = new Float64Array(ENEMY_SLOTS);
  readonly eTarget = new Int8Array(ENEMY_SLOTS);
  readonly eArena = new Int8Array(ENEMY_SLOTS);
  readonly eWave = new Int16Array(ENEMY_SLOTS);
  readonly eLos = new Uint8Array(ENEMY_SLOTS);
  readonly eStrafe = new Int8Array(ENEMY_SLOTS);
  readonly eStrafeT = new Float64Array(ENEMY_SLOTS);
  readonly eHurtTick = new Int32Array(ENEMY_SLOTS).fill(-1);
  readonly eFreedTick = new Int32Array(ENEMY_SLOTS);
  /** Dense list of living enemy slots. */
  readonly active = new Int32Array(ENEMY_SLOTS);
  activeCount = 0;
  private readonly activePos = new Int32Array(ENEMY_SLOTS).fill(-1);
  /** Living enemies, not counting the Gatekeeper. */
  living = 0;
  private readonly freeFifo = new Int32Array(ENEMY_SLOTS);
  private freeHead = 0;
  private freeCount = 0;
  private nextFresh = 0;

  readonly groundFields: FlowField[];
  readonly airFields: FlowField[];
  private readonly fieldValid: boolean[];

  // Separation spatial hashes (ground, air): counting sort of slots by cell.
  private readonly hashStart: [Int32Array, Int32Array];
  private readonly hashItems: [Int32Array, Int32Array];
  private readonly hashFill: Int32Array;

  private readonly body: Body = { x: 0, y: 0, z: 0, vz: 0, grounded: true, radius: 0, flying: false };
  private readonly moveResult: MoveResult = { blocked: false };

  // Snapshot scratch.
  private readonly ent: SnapshotEntities = {
    enemyCount: 0,
    enemySlot: new Uint16Array(ENEMY_SLOTS),
    enemyX: new Float32Array(ENEMY_SLOTS),
    enemyY: new Float32Array(ENEMY_SLOTS),
    enemyTypeState: new Uint8Array(ENEMY_SLOTS),
    enemyFlags: new Uint8Array(ENEMY_SLOTS),
    projectileCount: 0,
    projSlot: new Uint16Array(0),
    projKind: new Uint8Array(0),
    projX: new Float32Array(0),
    projY: new Float32Array(0),
    projZ: new Float32Array(0),
  };
  private readonly baseFlags = new Uint8Array(ENEMY_SLOTS);
  private preparedTick = -1;
  private readonly lastSentTick = new Map<number, number>();

  constructor(opts: SimOptions) {
    this.map = loadMap(opts.dungeon);
    this.bench = !!opts.bench;
    this.noWaves = !!opts.noWaves;
    this.random = mulberry32(opts.seed);
    const sorted = [...opts.players].sort((a, b) => a.id - b.id);
    this.partySize = Math.max(1, sorted.length);
    this.players = sorted.map((p, index) => {
      const cls = CLASSES[p.classId];
      const [c, r] = this.bench ? this.map.arenas[0].entryCells[0] : this.map.spawns[index];
      return {
        id: p.id,
        index,
        name: p.name,
        classId: p.classId,
        speed: cls.speed,
        maxHp: cls.hp,
        hp: cls.hp,
        shield: 0,
        dead: false,
        connected: true,
        invulnerable: !!opts.god || this.bench,
        x: c + 0.5,
        y: r + 0.5,
        z: this.map.floor[r * this.map.w + c],
        yaw: 0,
        pitch: 0,
        fireHeld: false,
        qPresses: 0,
        ePresses: 0,
        allyTargetId: 255,
        kills: 0,
        cdQ: 0,
        cdE: 0,
        lastSeq: -1,
        lastAcceptMs: 0,
        teleportId: 0,
        speedCheckSkipUntil: 0,
      };
    });
    this.arenas = this.map.arenas.map((a, i) => ({
      phase: PHASE_IDLE,
      wave: -1,
      waveStartTick: 0,
      queue: [],
      rr: 0,
      budgets: new Float64Array(this.map.arenaSpawnPoints[i].length),
      waveTotals: a.waves.map(() => 0),
      waveAlive: a.waves.map(() => 0),
      waveFullySpawned: a.waves.map(() => false),
      alive: 0,
    }));
    this.groundFields = this.players.map(() => new FlowField(this.map, false));
    this.airFields = this.players.map(() => new FlowField(this.map, true));
    this.fieldValid = this.players.map(() => false);
    const cells = this.map.w * this.map.h;
    this.hashStart = [new Int32Array(cells + 1), new Int32Array(cells + 1)];
    this.hashItems = [new Int32Array(ENEMY_SLOTS), new Int32Array(ENEMY_SLOTS)];
    this.hashFill = new Int32Array(cells);
    this.eFreedTick.fill(-SLOT_REUSE_TICKS);
  }

  /** Simulation time since the start, ms. */
  get timeMs(): number {
    return this.tick * TICK_MS;
  }

  playerById(id: number): SimPlayer | undefined {
    return this.players.find((p) => p.id === id);
  }

  /** Arena index and phase as sent in snapshots (§8.2). */
  arenaStatus(): { arenaIndex: number; arenaPhase: number } {
    for (let i = this.arenas.length - 1; i >= 0; i--) {
      if (this.arenas[i].phase !== PHASE_IDLE) return { arenaIndex: i, arenaPhase: this.arenas[i].phase };
    }
    return { arenaIndex: 0, arenaPhase: this.arenas.length ? this.arenas[0].phase : PHASE_IDLE };
  }

  // ------------------------------------------------------------------ input

  /** Applies an input message from a player (§9.3). `nowMs` is the host time of arrival. */
  applyInput(playerId: number, m: InputMsg, nowMs: number): void {
    const p = this.playerById(playerId);
    if (!p || !p.connected) return;
    if (p.lastSeq >= 0 && m.seq <= p.lastSeq) return;
    // Inputs sent before the client saw the host's latest teleport are ignored.
    const behind = (p.teleportId - m.lastTeleportId) & 0xffff;
    if (behind !== 0 && behind < 0x8000) return;
    p.lastSeq = m.seq;
    p.yaw = m.yaw;
    p.pitch = m.pitch;
    if (p.dead) {
      p.lastAcceptMs = nowMs;
      return;
    }
    let x = m.x;
    let y = m.y;
    if (nowMs >= p.speedCheckSkipUntil) {
      const elapsed = Math.max(0, nowMs - p.lastAcceptMs) / 1000;
      const maxD = 1.2 * p.speed * elapsed + 0.5;
      const dx = x - p.x;
      const dy = y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > maxD) {
        x = p.x + (dx / d) * maxD;
        y = p.y + (dy / d) * maxD;
      }
    }
    let z = m.z;
    const g = groundHeight(this.map, x, y, PLAYER_RADIUS, Infinity, false, true);
    if (g !== -Infinity && z < g) z = g;
    p.x = x;
    p.y = y;
    p.z = z;
    p.lastAcceptMs = nowMs;
    p.fireHeld = m.fireHeld;
    p.allyTargetId = m.allyTargetId;
    // Ability presses take effect from milestone 3; the counters are tracked already.
    p.qPresses = m.qPresses;
    p.ePresses = m.ePresses;
  }

  /** Moves a player on the host and tells its client (§9.3). */
  teleport(p: SimPlayer, x: number, y: number, z: number): void {
    p.x = x;
    p.y = y;
    p.z = z;
    p.teleportId = (p.teleportId + 1) & 0xffff;
    p.lastAcceptMs = this.nowMs;
    this.events.push({ to: p.id, event: { type: 'teleport', teleportId: p.teleportId, x, y, z } });
  }

  // ------------------------------------------------------------------ tick

  /** Simulates one tick. `nowMs` is the host time used for input timing. */
  step(nowMs?: number): void {
    this.tick++;
    this.nowMs = nowMs ?? this.tick * TICK_MS;
    this.checkArenaStarts();
    this.updateFlowFields();
    this.updateSpawning();
    this.updateEnemies();
    this.separate(0);
    this.separate(1);
    this.checkArenaClears();
  }

  private livingTargetable(p: SimPlayer): boolean {
    return p.connected && !p.dead;
  }

  private checkArenaStarts(): void {
    this.map.arenas.forEach((a, ai) => {
      if (this.arenas[ai].phase !== PHASE_IDLE) return;
      if (this.players.some((p) => this.livingTargetable(p) && insideRect(a, p.x, p.y))) this.startArena(ai);
    });
  }

  private startArena(ai: number): void {
    const a = this.map.arenas[ai];
    const st = this.arenas[ai];
    st.phase = PHASE_COMBAT;
    setArenaDoors(this.map, ai, true);
    this.invalidateFields();
    this.events.push({ to: 'all', event: { type: 'arenaStarted', arenaIndex: ai } });
    for (const p of this.players) {
      if (!this.livingTargetable(p)) continue;
      const cell = Math.floor(p.y) * this.map.w + Math.floor(p.x);
      const onDoor = this.map.doorArena[cell] >= 0;
      if (!insideRect(a, p.x, p.y) || onDoor) {
        const [c, r] = a.entryCells[p.index];
        this.teleport(p, c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c]);
      }
    }
    if (!this.bench && !this.noWaves && a.waves.length > 0) this.startWave(ai, 0);
  }

  private startWave(ai: number, n: number): void {
    const st = this.arenas[ai];
    const w = this.map.arenas[ai].waves[n];
    const counts = [
      scaleCount(w.blessed, this.partySize),
      CHORISTERS_ENABLED ? scaleCount(w.choristers, this.partySize) : 0,
      scaleCount(w.cherubs, this.partySize),
    ];
    st.wave = n;
    st.waveStartTick = this.tick;
    st.waveTotals[n] = counts[0] + counts[1] + counts[2];
    st.waveAlive[n] = 0;
    st.waveFullySpawned[n] = st.waveTotals[n] === 0;
    if (st.waveTotals[n] > 0) st.queue.push({ counts, spawned: [0, 0, 0], wave: n });
  }

  private checkArenaClears(): void {
    this.map.arenas.forEach((a, ai) => {
      const st = this.arenas[ai];
      if (st.phase !== PHASE_COMBAT || a.boss || this.bench) return;
      const allWavesStarted = this.noWaves || st.wave >= a.waves.length - 1;
      if (!allWavesStarted || st.queue.length > 0 || st.alive > 0) return;
      st.phase = PHASE_CLEARED;
      setArenaDoors(this.map, ai, false);
      this.invalidateFields();
      this.events.push({ to: 'all', event: { type: 'arenaCleared', arenaIndex: ai } });
      for (const p of this.players) {
        if (!p.connected || !p.dead) continue;
        p.dead = false;
        p.hp = p.maxHp;
        p.shield = 0;
        const [c, r] = a.entryCells[p.index];
        this.events.push({ to: 'all', event: { type: 'playerRespawned', playerId: p.id } });
        this.teleport(p, c + 0.5, r + 0.5, this.map.floor[r * this.map.w + c]);
      }
    });
  }

  // ------------------------------------------------------------------ flow fields

  private invalidateFields(): void {
    this.fieldValid.fill(false);
  }

  /** One ground and one air field per living player, each recomputed every 0.25 s on staggered ticks. */
  private updateFlowFields(): void {
    for (const p of this.players) {
      if (!this.livingTargetable(p)) continue;
      const k = p.index * 2;
      const due = Math.floor((this.tick + k) / 7.5) !== Math.floor((this.tick + k - 1) / 7.5);
      if (!due && this.fieldValid[p.index]) continue;
      this.computeFields(p);
    }
  }

  /** Computes every living player's flow fields now. */
  refreshFields(): void {
    for (const p of this.players) if (this.livingTargetable(p)) this.computeFields(p);
  }

  private computeFields(p: SimPlayer): void {
    const c = Math.floor(p.x);
    const r = Math.floor(p.y);
    this.groundFields[p.index].compute(c, r);
    this.airFields[p.index].compute(c, r);
    this.fieldValid[p.index] = true;
  }

  // ------------------------------------------------------------------ spawning

  private updateSpawning(): void {
    this.arenas.forEach((st, ai) => {
      const b = st.budgets;
      for (let i = 0; i < b.length; i++) b[i] += BUDGET_PER_TICK;
      if (st.phase === PHASE_COMBAT) this.updateArenaSpawning(ai);
      // The cap applies to the budget carried into the next tick, so a busy point sustains 50 per second.
      for (let i = 0; i < b.length; i++) if (b[i] > BUDGET_MAX) b[i] = BUDGET_MAX;
    });
  }

  private updateArenaSpawning(ai: number): void {
    const st = this.arenas[ai];
    if (this.bench && ai === 0) {
      // Benchmark: keep exactly 1 500 Blessed alive instead of waves.
      const queued = st.queue.reduce((n, q) => n + q.counts[0] - q.spawned[0], 0);
      const need = MAX_LIVING_ENEMIES - this.living - queued;
      if (need > 0) st.queue.push({ counts: [need, 0, 0], spawned: [0, 0, 0], wave: -1 });
    }

    const waves = this.map.arenas[ai].waves;
    const n = st.wave;
    if (n >= 0 && n < waves.length - 1 && st.waveFullySpawned[n]) {
      const fewLeft = st.waveAlive[n] <= WAVE_NEXT_FRACTION * st.waveTotals[n] + 1e-9;
      if (fewLeft || this.tick - st.waveStartTick >= WAVE_NEXT_TICKS) this.startWave(ai, n + 1);
    }

    this.placeQueued(ai);
  }

  private placeQueued(ai: number): void {
    const st = this.arenas[ai];
    if (st.queue.length === 0) return;
    const points = this.map.arenaSpawnPoints[ai];
    const np = points.length;
    if (np === 0) return;
    const eligible = new Uint8Array(np);
    let any = false;
    for (let i = 0; i < np; i++) {
      const [c, r] = points[i];
      const px = c + 0.5;
      const py = r + 0.5;
      const pz = this.map.floor[r * this.map.w + c];
      let ok = true;
      for (const p of this.players) {
        if (!this.livingTargetable(p)) continue;
        if (distToCylinder(px, py, pz, p.x, p.y, p.z, PLAYER_RADIUS, PLAYER_HEIGHT) <= SPAWN_ELIGIBLE_DIST) {
          ok = false;
          break;
        }
      }
      eligible[i] = ok ? 1 : 0;
      if (ok) any = true;
    }
    if (!any) eligible.fill(1);

    while (st.queue.length > 0) {
      if (this.living >= MAX_LIVING_ENEMIES) return;
      let found = -1;
      for (let k = 0; k < np; k++) {
        const i = (st.rr + k) % np;
        if (eligible[i] && st.budgets[i] >= 1) {
          found = i;
          break;
        }
      }
      if (found < 0) return;
      const slot = this.allocSlot();
      if (slot < 0) return;
      const batch = st.queue[0];
      const type = this.takeNextType(batch);
      if (batch.spawned.every((s, t) => s >= batch.counts[t])) {
        st.queue.shift();
        if (batch.wave >= 0) st.waveFullySpawned[batch.wave] = true;
      }
      const [c, r] = points[found];
      this.spawnAt(slot, type, c, r, ai, batch.wave);
      st.budgets[found] -= 1;
      st.rr = (found + 1) % np;
    }
  }

  /** The type with the lowest (spawned + 0.5) / count among types with enemies left (§8.2). */
  private takeNextType(batch: SpawnBatch): number {
    let best = -1;
    let bestV = Infinity;
    for (let t = 0; t < 3; t++) {
      if (batch.spawned[t] >= batch.counts[t]) continue;
      const v = (batch.spawned[t] + 0.5) / batch.counts[t];
      if (v < bestV) {
        bestV = v;
        best = t;
      }
    }
    batch.spawned[best]++;
    return SPAWN_TYPES[best];
  }

  private allocSlot(): number {
    if (this.freeCount > 0) {
      const s = this.freeFifo[this.freeHead];
      if (this.eFreedTick[s] + SLOT_REUSE_TICKS <= this.tick) {
        this.freeHead = (this.freeHead + 1) % ENEMY_SLOTS;
        this.freeCount--;
        return s;
      }
    }
    if (this.nextFresh < ENEMY_SLOTS) return this.nextFresh++;
    return -1;
  }

  /** Places a new enemy on a cell (§2.3) and returns its slot, or -1 if no slot is free. */
  placeEnemy(type: number, c: number, r: number, arena: number): number {
    const slot = this.allocSlot();
    if (slot >= 0) this.spawnAt(slot, type, c, r, arena, -1);
    return slot;
  }

  private spawnAt(slot: number, type: number, c: number, r: number, arena: number, wave: number): void {
    const def = ENEMIES[type];
    this.eAlive[slot] = 1;
    this.eType[slot] = type;
    this.eState[slot] = ST_IDLE;
    this.eX[slot] = c + 0.5;
    this.eY[slot] = r + 0.5;
    this.eZ[slot] = this.map.floor[r * this.map.w + c] + (type === CHERUB ? CHERUB_HOVER : 0);
    this.eVz[slot] = 0;
    this.eGrounded[slot] = 1;
    this.eHp[slot] = def.hp;
    this.eArena[slot] = arena;
    this.eWave[slot] = wave;
    this.eLos[slot] = 0;
    this.eStrafe[slot] = 1;
    this.eStrafeT[slot] = 0;
    this.eHurtTick[slot] = -1;
    this.activePos[slot] = this.activeCount;
    this.active[this.activeCount++] = slot;
    if (type !== GATEKEEPER) this.living++;
    if (arena >= 0) {
      const st = this.arenas[arena];
      if (type !== GATEKEEPER) st.alive++;
      if (wave >= 0) st.waveAlive[wave]++;
    }
    this.retarget(slot);
  }

  /** Removes an enemy and frees its slot (reusable after 1 s). */
  removeEnemy(slot: number): void {
    if (!this.eAlive[slot]) return;
    this.eAlive[slot] = 0;
    const type = this.eType[slot];
    if (type !== GATEKEEPER) this.living--;
    const arena = this.eArena[slot];
    if (arena >= 0) {
      const st = this.arenas[arena];
      if (type !== GATEKEEPER) st.alive--;
      const wave = this.eWave[slot];
      if (wave >= 0) st.waveAlive[wave]--;
    }
    const pos = this.activePos[slot];
    const last = this.active[--this.activeCount];
    this.active[pos] = last;
    this.activePos[last] = pos;
    this.activePos[slot] = -1;
    this.eFreedTick[slot] = this.tick;
    this.freeFifo[(this.freeHead + this.freeCount) % ENEMY_SLOTS] = slot;
    this.freeCount++;
  }

  /** Dev key K: kills every living enemy, including the Gatekeeper, without kill credit. */
  killAll(): void {
    while (this.activeCount > 0) this.removeEnemy(this.active[this.activeCount - 1]);
  }

  /** Marks an enemy as hurt this tick (sets the per-recipient `hurt` flag). */
  markHurt(slot: number): void {
    this.eHurtTick[slot] = this.tick;
  }

  // ------------------------------------------------------------------ enemies

  /** Targets the living, connected player with the lowest flow-field distance; Sinful halves the Fallen's (§7.2). */
  retarget(slot: number): void {
    const air = this.eType[slot] === CHERUB;
    const c = Math.floor(this.eX[slot]);
    const r = Math.floor(this.eY[slot]);
    let best = -1;
    let bestD = Infinity;
    for (const p of this.players) {
      if (!this.livingTargetable(p) || !this.fieldValid[p.index]) continue;
      const field = air ? this.airFields[p.index] : this.groundFields[p.index];
      let d = field.at(c, r);
      if (d === UNREACHABLE) continue;
      if (p.classId === 'fallen') d *= 0.5;
      if (d < bestD) {
        bestD = d;
        best = p.index;
      }
    }
    this.eTarget[slot] = best;
  }

  private updateEnemies(): void {
    const tick = this.tick;
    for (let k = 0; k < this.activeCount; k++) {
      const slot = this.active[k];
      const t = this.eTarget[slot];
      const targetGone = t >= 0 && !this.livingTargetable(this.players[t]);
      if (targetGone || slot % RETARGET_TICKS === tick % RETARGET_TICKS) this.retarget(slot);
      const type = this.eType[slot];
      if (type === CHERUB) this.updateCherub(slot);
      else if (type !== GATEKEEPER) this.updateGround(slot);
    }
  }

  private loadBody(slot: number): Body {
    const b = this.body;
    const def = ENEMIES[this.eType[slot]];
    b.x = this.eX[slot];
    b.y = this.eY[slot];
    b.z = this.eZ[slot];
    b.vz = this.eVz[slot];
    b.grounded = this.eGrounded[slot] === 1;
    b.radius = def.radius;
    b.flying = def.flying;
    return b;
  }

  private storeBody(slot: number, b: Body): void {
    this.eX[slot] = b.x;
    this.eY[slot] = b.y;
    this.eZ[slot] = b.z;
    this.eVz[slot] = b.vz;
    this.eGrounded[slot] = b.grounded ? 1 : 0;
  }

  /**
   * Steering (§7.3): toward the center of the best neighbor cell, or directly toward the target when
   * in its cell or an adjacent one. Writes the horizontal direction and the distance available.
   */
  private steer(slot: number, field: FlowField, p: SimPlayer, out: { dx: number; dy: number; dist: number; direct: boolean }): boolean {
    const x = this.eX[slot];
    const y = this.eY[slot];
    const c = Math.floor(x);
    const r = Math.floor(y);
    const tc = Math.floor(p.x);
    const tr = Math.floor(p.y);
    let gx: number;
    let gy: number;
    if (Math.abs(c - tc) <= 1 && Math.abs(r - tr) <= 1) {
      gx = p.x;
      gy = p.y;
      out.direct = true;
    } else {
      const n = field.bestNeighbor(c, r);
      if (n < 0) return false;
      gx = (n % this.map.w) + 0.5;
      gy = Math.floor(n / this.map.w) + 0.5;
      out.direct = false;
    }
    const dx = gx - x;
    const dy = gy - y;
    const d = Math.hypot(dx, dy);
    if (d < 1e-9) return false;
    out.dx = dx / d;
    out.dy = dy / d;
    out.dist = d;
    return true;
  }

  private readonly steerOut = { dx: 0, dy: 0, dist: 0, direct: false };

  private updateGround(slot: number): void {
    const def = ENEMIES[this.eType[slot]];
    const b = this.loadBody(slot);
    const t = this.eTarget[slot];
    let mx = 0;
    let my = 0;
    if (t >= 0) {
      const p = this.players[t];
      const s = this.steerOut;
      if (this.steer(slot, this.groundFields[t], p, s)) {
        let step = def.speed * TICK_DT;
        if (s.direct) step = Math.min(step, s.dist - BLESSED_STOP);
        if (step > 0) {
          mx = s.dx * step;
          my = s.dy * step;
        }
      }
    }
    stepBody(this.map, b, mx, my, TICK_DT);
    this.storeBody(slot, b);
    this.eState[slot] = !b.grounded ? ST_FALLING : mx !== 0 || my !== 0 ? ST_MOVING : ST_IDLE;
  }

  private updateCherub(slot: number): void {
    const def = ENEMIES[CHERUB];
    const b = this.loadBody(slot);
    const t = this.eTarget[slot];
    let mx = 0;
    let my = 0;
    let strafing = false;
    if (t >= 0) {
      const p = this.players[t];
      const eyeZ = b.z + def.height / 2;
      if (slot % LOS_TICKS === this.tick % LOS_TICKS) {
        this.eLos[slot] = lineOfSight(this.map, b.x, b.y, eyeZ, p.x, p.y, p.z + PLAYER_HEIGHT / 2) ? 1 : 0;
      }
      const inRange = distToCylinder(b.x, b.y, eyeZ, p.x, p.y, p.z, PLAYER_RADIUS, PLAYER_HEIGHT) <= CHERUB_RANGE;
      if (this.eLos[slot] && inRange) {
        strafing = true;
        const base = Math.atan2(p.y - b.y, p.x - b.x);
        const a = base + (this.eStrafe[slot] * Math.PI) / 2;
        mx = Math.cos(a) * CHERUB_STRAFE_SPEED * TICK_DT;
        my = Math.sin(a) * CHERUB_STRAFE_SPEED * TICK_DT;
      } else {
        const s = this.steerOut;
        if (this.steer(slot, this.airFields[t], p, s)) {
          const step = s.direct ? Math.min(def.speed * TICK_DT, s.dist) : def.speed * TICK_DT;
          mx = s.dx * step;
          my = s.dy * step;
        }
      }
    }
    this.moveResult.blocked = false;
    moveHorizontal(this.map, b, mx, my, this.moveResult);
    if (strafing) {
      this.eStrafeT[slot] += TICK_DT;
      if (this.moveResult.blocked || this.eStrafeT[slot] >= CHERUB_STRAFE_SWITCH - 1e-9) {
        this.eStrafe[slot] = -this.eStrafe[slot];
        this.eStrafeT[slot] = 0;
      }
    }
    // Hover with the feet 4 m above the ground height, changing height at up to 6 m/s.
    const g = groundHeight(this.map, b.x, b.y, b.radius, Infinity, false, true);
    if (g !== -Infinity) {
      const want = g + CHERUB_HOVER;
      const maxDz = CHERUB_CLIMB * TICK_DT;
      b.z += Math.max(-maxDz, Math.min(maxDz, want - b.z));
    }
    this.storeBody(slot, b);
    this.eState[slot] = mx !== 0 || my !== 0 ? ST_MOVING : ST_IDLE;
  }

  /** Pushes overlapping enemies apart, half the overlap each, up to 8 neighbors (§7.3). */
  private separate(layer: 0 | 1): void {
    const { w, h } = this.map;
    const start = this.hashStart[layer];
    const items = this.hashItems[layer];
    const cells = w * h;
    start.fill(0);
    const isLayer = (slot: number) => {
      const t = this.eType[slot];
      return t !== GATEKEEPER && (t === CHERUB) === (layer === 1);
    };
    const cellOf = (slot: number) => {
      let c = Math.floor(this.eX[slot]);
      let r = Math.floor(this.eY[slot]);
      c = c < 0 ? 0 : c >= w ? w - 1 : c;
      r = r < 0 ? 0 : r >= h ? h - 1 : r;
      return r * w + c;
    };
    let n = 0;
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (!isLayer(s)) continue;
      start[cellOf(s) + 1]++;
      n++;
    }
    if (n < 2) return;
    for (let i = 0; i < cells; i++) start[i + 1] += start[i];
    const fill = this.hashFill;
    fill.set(start.subarray(0, cells));
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (!isLayer(s)) continue;
      items[fill[cellOf(s)]++] = s;
    }

    const b = this.body;
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      if (!isLayer(s)) continue;
      const def = ENEMIES[this.eType[s]];
      const x = this.eX[s];
      const y = this.eY[s];
      const z = this.eZ[s];
      const c0 = Math.floor(x);
      const r0 = Math.floor(y);
      let px = 0;
      let py = 0;
      let found = 0;
      for (let r = r0 - 1; r <= r0 + 1 && found < MAX_SEPARATION_NEIGHBORS; r++) {
        if (r < 0 || r >= h) continue;
        for (let c = c0 - 1; c <= c0 + 1 && found < MAX_SEPARATION_NEIGHBORS; c++) {
          if (c < 0 || c >= w) continue;
          const cell = r * w + c;
          for (let j = start[cell]; j < start[cell + 1]; j++) {
            const o = items[j];
            if (o === s) continue;
            const od = ENEMIES[this.eType[o]];
            const oz = this.eZ[o];
            if (z >= oz + od.height || oz >= z + def.height) continue;
            const dx = x - this.eX[o];
            const dy = y - this.eY[o];
            const min = def.radius + od.radius;
            const d2 = dx * dx + dy * dy;
            if (d2 >= min * min) continue;
            const d = Math.sqrt(d2);
            const push = (min - d) / 2;
            if (d > 1e-6) {
              px += (dx / d) * push;
              py += (dy / d) * push;
            } else {
              // Exactly on top of each other: push along a fixed angle from the slot numbers.
              const a = ((s * 7 + o * 13) % 16) * (Math.PI / 8);
              px += Math.cos(a) * push;
              py += Math.sin(a) * push;
            }
            if (++found >= MAX_SEPARATION_NEIGHBORS) break;
          }
        }
      }
      if (found === 0) continue;
      this.loadBody(s);
      if (tryDisplace(this.map, b, px, py)) {
        this.eX[s] = b.x;
        this.eY[s] = b.y;
      }
    }
  }

  // ------------------------------------------------------------------ snapshots

  /** Living enemies in the current arena plus its enemies not yet spawned (§8.2). */
  enemiesRemaining(): number {
    const { arenaIndex } = this.arenaStatus();
    const st = this.arenas[arenaIndex];
    if (!st) return 0;
    if (this.map.arenas[arenaIndex].boss) return st.alive;
    let n = st.alive;
    for (const q of st.queue) for (let t = 0; t < 3; t++) n += q.counts[t] - q.spawned[t];
    const waves = this.map.arenas[arenaIndex].waves;
    if (!this.noWaves && !this.bench) {
      for (let i = st.wave + 1; i < waves.length; i++) {
        const w = waves[i];
        n += scaleCount(w.blessed, this.partySize) + (CHORISTERS_ENABLED ? scaleCount(w.choristers, this.partySize) : 0) + scaleCount(w.cherubs, this.partySize);
      }
    }
    return n;
  }

  private prepareSnapshot(): void {
    if (this.preparedTick === this.tick) return;
    this.preparedTick = this.tick;
    const e = this.ent;
    e.enemyCount = this.activeCount;
    for (let k = 0; k < this.activeCount; k++) {
      const s = this.active[k];
      e.enemySlot[k] = s;
      e.enemyX[k] = this.eX[s];
      e.enemyY[k] = this.eY[s];
      e.enemyTypeState[k] = (this.eType[s] & 0x0f) | (this.eState[s] << 4);
      this.baseFlags[k] = 0;
    }
  }

  /** Encodes this tick's snapshot for one recipient (the `hurt` flag is per recipient). */
  encodeFor(recipientId: number): ArrayBuffer[] {
    this.prepareSnapshot();
    const e = this.ent;
    const since = this.lastSentTick.get(recipientId) ?? -1;
    for (let k = 0; k < e.enemyCount; k++) {
      const s = e.enemySlot[k];
      e.enemyFlags[k] = this.baseFlags[k] | (this.eHurtTick[s] > since ? FLAG_HURT : 0);
    }
    this.lastSentTick.set(recipientId, this.tick);
    const { arenaIndex, arenaPhase } = this.arenaStatus();
    const header: SnapshotHeader = {
      tick: this.tick,
      arenaIndex,
      arenaPhase,
      enemiesRemaining: this.enemiesRemaining(),
      bossHp: 0,
      bossMaxHp: 0,
      bossCast: 0,
      bossCastProgress: 0,
    };
    const players: SnapshotPlayer[] = [];
    for (const p of this.players) {
      if (!p.connected) continue;
      players.push({
        id: p.id,
        x: p.x,
        y: p.y,
        z: p.z,
        yaw: p.yaw,
        hp: p.hp,
        shield: p.shield,
        dead: p.dead,
        cdQ: p.cdQ * 1000,
        cdE: p.cdE * 1000,
        kills: p.kills,
      });
    }
    return encodeSnapshot(header, players, e);
  }
}

export { PHASE_CLEARED, PHASE_COMBAT, PHASE_IDLE };
