/** The in-game client: input or bot, local movement, snapshots, interpolation, rendering and feedback. */
import { CLASSES, type ClassId } from '../data/classes';
import { DECOR, decorSprite } from '../data/decor';
import * as THREE from 'three';
import { BLESSED, CHERUB, CHERUB_CLIMB, CHERUB_HOVER, ENEMIES, GATEKEEPER, ST_WINDUP } from '../data/enemies';
import { ABILITIES, ALLY_TARGET_ANGLE, WEAPONS } from '../data/weapons';
import { debugState } from '../debug';
import type { CtrlMessage, GameEvent } from '../net/messages';
import { ALLY_NONE, encodeInput, FLAG_HURT, FLAG_MARKED, FLAG_ROOTED, FLAG_SILENCED, PHASE_CLEARED, PHASE_COMBAT, type Snapshot } from '../net/protocol';
import type { Transport } from '../net/transport';
import type { Params } from '../params';
import { aimDir, rayCylinder } from '../sim/combat';
import { ENEMY_SLOTS, PLAYER_EYE, PLAYER_HEIGHT, PLAYER_RADIUS, TICK_DT, TICK_MS } from '../sim/constants';
import { lineOfSight, raycastTerrain } from '../sim/los';
import { doorsClosedFor, setArenaDoors, type GameMap } from '../sim/map';
import { distToCylinder, groundHeight } from '../sim/movement';
import { BOSS_CAST_JUDGMENT, PROJ_CENSER } from '../sim/sim';
import type { AnimSet } from '../render/animAtlas';
import type { Atlas, SpriteFrame } from '../render/atlas';
import { Billboards, NO_GLOW, type Glow } from '../render/billboards';
import { Particles } from '../render/particles';
import { GameScene } from '../render/scene';
import { Vfx } from '../render/vfx';
import { DebugOverlay } from '../ui/debugOverlay';
import type { ResultsData } from '../ui/results';
import { BenchRunner } from './bench';
import { Bot, type BotEnemy } from './bot';
import { corpseFrame, EnemyAnimator, spriteDirection, type Corpse } from './enemyAnim';
import { FpsCounter } from './fps';
import type { HostSession } from './hostSession';
import { Hud } from './hud';
import { Input, MOUSE_SENSITIVITY } from './input';
import { LocalPlayer, wasdDirection } from './localPlayer';
import { SnapshotBuffer } from './snapshots';

const BENCH_TURN_RATE = 0.3;
const ENEMY_SPRITES = ['blessed', 'chorister', 'cherub', 'gatekeeper'];
const PROJECTILE_SPRITES = ['proj-censer', 'proj-orb', 'proj-arrow'];
const PROJECTILE_SIZES = [0.4, 0.6, 0.3];
const RESULT_OVERLAY_MS = 3000;
const ENEMY_FLASH_MS = 100;
const TRACER_MS = 70;
/** At most this many corpses lie around; the oldest vanish first. */
const MAX_CORPSES = 1000;

const GLOW_FLASH: Glow = { r: 1, g: 1, b: 1, a: 1 };
const GLOW_WINDUP: Glow = { r: 1, g: 0.78, b: 0.2, a: 0.5 };
const GLOW_MARKED: Glow = { r: 1, g: 0.12, b: 0.08, a: 0.45 };
const GLOW_ALLY: Glow = { r: 1, g: 0.8, b: 0.2, a: 0.55 };
/** Judgment: the glow sphere around the Gatekeeper grows from this radius to the next over the cast. */
const JUDGMENT_GLOW_R0 = 3;
const JUDGMENT_GLOW_R1 = 9;

export interface RosterEntry {
  id: number;
  name: string;
  classId: ClassId;
}

export interface GameOptions {
  root: HTMLElement;
  map: GameMap;
  atlas: Atlas;
  /** The Blessed's animated 8-direction sprites. */
  blessed: AnimSet;
  params: Params;
  transport: Transport;
  /** The host session when this player is the host (singleplayer included). */
  host: HostSession | null;
  localPlayerId: number;
  /** Players at `start`, sorted by id. */
  roster: RosterEntry[];
  /** Called 3 s after the result, when the Results screen should appear. */
  onResults: (data: ResultsData) => void;
}

export class Game {
  private readonly o: GameOptions;
  private readonly map: GameMap;
  private readonly params: Params;
  private readonly localId: number;
  private readonly classId: ClassId;
  private readonly maxHp: number;
  private readonly scene: GameScene;
  private readonly canvas: HTMLCanvasElement;
  private readonly input: Input;
  private readonly player: LocalPlayer;
  private readonly overlay: DebugOverlay;
  private readonly hud: Hud;
  private readonly fps = new FpsCounter();
  private readonly snaps: SnapshotBuffer;
  private readonly billboards: Billboards;
  /** The Blessed and their corpses, drawn from their own atlas. */
  private readonly blessedBillboards: Billboards;
  private readonly animator = new EnemyAnimator();
  private readonly corpses: Corpse[] = [];
  private readonly particles: Particles;
  private readonly vfx = new Vfx();
  /** The large growing glow on the Gatekeeper while it casts Judgment (§7.4). */
  private readonly judgmentGlow: THREE.Mesh<THREE.SphereGeometry, THREE.MeshBasicMaterial>;
  private readonly frames: Record<string, SpriteFrame>;
  private readonly enemyFrames: Array<SpriteFrame | undefined>;
  private readonly bot: Bot | null;
  private readonly bench: BenchRunner | null;
  private lastFrame = 0;
  private raf = 0;
  private inputAcc = 0;
  private seq = 0;
  private lastTeleportId = 0;
  private dead = false;
  private qPresses = 0;
  private ePresses = 0;
  private fireHeld = false;
  /** Cosmetic fire timer, run locally at 30 Hz (§6). */
  private fireTimer = 0;
  private fireAcc = 0;
  /** Local timer for movement abilities (§9.3): performance.now() when it's ready again. */
  private localEReadyAt = 0;
  private allyTargetId = ALLY_NONE;
  private doorState: boolean[];
  /** Smoothed Cherub heights per slot (§9.4). */
  private readonly cherubZ = new Float32Array(ENEMY_SLOTS);
  /** Frame number when each slot's Cherub height was last updated. */
  private readonly cherubFrame = new Uint32Array(ENEMY_SLOTS);
  private frameNo = 1;
  private readonly zScratch = new Float32Array(ENEMY_SLOTS);
  /** performance.now() until which each enemy flashes white. */
  private readonly flashUntil = new Float64Array(ENEMY_SLOTS);
  private readonly botEnemies: BotEnemy[] = [];
  /** Delayed bursts, played when the render time reaches them. */
  private readonly pendingBursts: Array<{ at: number; censer: boolean; x: number; y: number; z: number }> = [];
  private readonly afterimages: Array<{ start: number; x: number; y: number; z: number; sprite: string }> = [];
  /** The Gatekeeper's cast and its progress (0–1) in the newest snapshot. */
  private bossCast = 0;
  private bossCastProgress = 0;
  private resultAt = -1;
  private resultData: ResultsData | null = null;
  private resultsShown = false;
  private disposed = false;

  constructor(o: GameOptions) {
    this.o = o;
    this.map = o.map;
    this.params = o.params;
    this.localId = o.localPlayerId;
    const me = o.roster.find((r) => r.id === this.localId)!;
    const index = o.roster.indexOf(me);
    this.classId = me.classId;
    this.maxHp = CLASSES[me.classId].hp;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    o.root.appendChild(this.canvas);
    this.scene = new GameScene(this.canvas, this.map);
    this.billboards = new Billboards(o.atlas.texture);
    this.scene.scene.add(this.billboards.mesh);
    this.blessedBillboards = new Billboards(o.blessed.texture, true);
    this.scene.scene.add(this.blessedBillboards.mesh);
    this.scene.scene.add(this.vfx.group);
    this.judgmentGlow = new THREE.Mesh(
      new THREE.SphereGeometry(1, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }),
    );
    this.judgmentGlow.visible = false;
    this.scene.scene.add(this.judgmentGlow);
    this.frames = o.atlas.frames;
    this.enemyFrames = ENEMY_SPRITES.map((n) => o.atlas.frames[n]);
    this.particles = new Particles([o.atlas.frames.feather, o.atlas.frames.spark, o.atlas.frames.ember]);
    this.hud = new Hud(o.root, this.classId);
    this.hud.setHp(this.maxHp, 0, this.maxHp);
    this.hud.setRemaining(null);
    this.hud.setDeath(null);
    this.overlay = new DebugOverlay(o.root);

    this.input = new Input(this.canvas);
    this.input.pointerLockAllowed = !this.params.bot && !this.params.bench;
    this.input.onKey = (code) => this.onKey(code);

    const [sc, sr] = this.params.bench ? this.map.arenas[0].entryCells[0] : this.map.spawns[index];
    this.player = new LocalPlayer(sc + 0.5, sr + 0.5, this.map.floor[sr * this.map.w + sc], CLASSES[me.classId].speed);
    this.doorState = this.map.arenas.map(() => false);

    this.snaps = new SnapshotBuffer(o.host ? 1.5 : 4.5);
    this.snaps.onComplete = (s, prev) => this.onSnapshot(s, prev);
    o.transport.onSnapshot = (buf) => this.snaps.addPart(buf, performance.now());
    o.transport.onCtrl = (msg) => this.onCtrl(msg);

    this.bot = this.params.bot ? new Bot(this.map) : null;
    this.bench = this.params.bench && o.host ? new BenchRunner(o.root, o.host, () => this.scene.rendererString()) : null;

    debugState.players = o.roster.map((r) => ({ id: r.id, classId: r.classId, hp: CLASSES[r.classId].hp, dead: false, kills: 0 }));
  }

  start(): void {
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private get over(): boolean {
    return this.resultAt >= 0;
  }

  private onKey(code: string): void {
    if (code === 'F3') this.overlay.toggle();
    if (this.over || this.params.bench) return;
    // Dev keys work with the bot too: the full solo run test presses K (§13.2).
    if (code === 'KeyK' && this.params.dev && this.o.host) this.o.host.killAll();
    else if (code === 'KeyG' && this.params.dev && this.o.host) this.o.host.toggleGod();
    else if (this.params.bot) return;
    else if (code === 'KeyQ') this.pressAbility('Q', performance.now());
    else if (code === 'KeyE') this.pressAbility('E', performance.now());
  }

  /**
   * A press of Q or E: counted for the host (§9.3); movement abilities also run here at once when
   * their displayed cooldown is ready.
   */
  private pressAbility(slot: 'Q' | 'E', now: number): void {
    if (this.dead || this.over) return;
    if (slot === 'Q') {
      this.qPresses = (this.qPresses + 1) & 0xff;
      return;
    }
    this.ePresses = (this.ePresses + 1) & 0xff;
    const def = ABILITIES[this.classId].E;
    if (!def.movement || this.displayedCooldown('E', now) > 0) return;
    const p = this.player;
    if (this.classId === 'fallen') {
      // Falling Star: no ally target, nothing happens and there's no cooldown.
      const ally = this.snaps.playersOut.find((q) => q.id === this.allyTargetId);
      if (!ally) return;
      p.startLeap(ally.x, ally.y, ally.z);
    } else {
      // Shadowstep: the movement direction (WASD relative to yaw), forward if not moving.
      let dir: [number, number] | null = this.botDir;
      if (!this.bot) {
        const axes = this.input.moveAxes();
        dir = axes.forward !== 0 || axes.right !== 0 ? wasdDirection(p.yaw, axes.forward, axes.right) : null;
      }
      const [dx, dy] = dir ?? [Math.cos(p.yaw), Math.sin(p.yaw)];
      p.startDash(dx, dy);
    }
    this.localEReadyAt = now + def.cooldown * 1000;
  }

  /** The bot's movement direction this frame, for its Shadowstep. */
  private botDir: [number, number] | null = null;

  private onCtrl(msg: CtrlMessage): void {
    if (msg.type === 'event') this.onEvent(msg.event, performance.now());
  }

  private onEvent(e: GameEvent, now: number): void {
    switch (e.type) {
      case 'teleport':
        this.player.teleport(e.x, e.y, e.z);
        this.lastTeleportId = e.teleportId;
        break;
      case 'arenaStarted':
        this.hud.centerText('The doors are sealed', 2000, now);
        break;
      case 'arenaCleared':
        this.hud.centerText('Arena cleared', 2000, now);
        break;
      case 'abilityUsed':
        this.abilityVfx(e, now);
        break;
      case 'bossCast':
        this.hud.judgmentEvent(e.phase, now);
        break;
      case 'gameOver':
        this.onGameOver(e, now);
        break;
    }
  }

  private classOf(playerId: number): ClassId | undefined {
    return this.o.roster.find((r) => r.id === playerId)?.classId;
  }

  /** The position and yaw of a player: the local one from local movement, others interpolated. */
  private playerPose(playerId: number): { x: number; y: number; z: number; yaw: number } | undefined {
    if (playerId === this.localId) return { ...this.player.body, yaw: this.player.yaw };
    return this.snaps.playersOut.find((q) => q.id === playerId);
  }

  /** Ability VFX at the event position (§10). */
  private abilityVfx(e: Extract<GameEvent, { type: 'abilityUsed' }>, now: number): void {
    const cls = this.classOf(e.playerId);
    const key = `${cls}:${e.slot}`;
    const user = this.playerPose(e.playerId);
    switch (key) {
      case 'fallen:Q': // taunt ring
        this.vfx.ring(now, e.x, e.y, e.z, 0xe0301e, 0.5, 15, 600);
        break;
      case 'fallen:E': // landing shockwave, when the leap lands
        this.vfx.ring(now, e.x, e.y, e.z, 0xf08a24, 0.5, 5, 450, 400);
        this.vfx.ring(now, e.x, e.y, e.z, 0x1b1513, 0.3, 4, 450, 400);
        break;
      case 'heretic:Q': // heal ring
        this.vfx.ring(now, e.x, e.y, e.z, 0x5ee65e, 0.5, 15, 700);
        break;
      case 'heretic:E': // shield bubble on the target
        this.vfx.sphere(now, e.x, e.y, e.z + PLAYER_HEIGHT / 2, 0x4aa3e8, 1.3, 1.6, 900, 0.4);
        break;
      case 'binder:Q': {
        // Chain lines from the cone in front of the Binder to the destination.
        if (!user) break;
        const pts: Array<[number, number, number]> = [];
        for (let i = -3; i <= 3; i++) {
          const a = user.yaw + (i / 3) * (Math.PI / 6);
          const d = 6 + Math.abs(i) * 2;
          pts.push([e.x, e.y, e.z + 0.8], [user.x + Math.cos(a) * d, user.y + Math.sin(a) * d, e.z + 0.8]);
        }
        this.vfx.lines(now, pts, 0x9aa0a8, 500);
        break;
      }
      case 'binder:E': // grey burst
        this.vfx.sphere(now, e.x, e.y, e.z, 0x8a8f97, 0.5, 8, 600, 0.35);
        break;
      case 'betrayer:Q': {
        // Mark beam: from the Betrayer to the marked enemy, and a column of light on it.
        const pts: Array<[number, number, number]> = [[e.x, e.y, e.z], [e.x, e.y, e.z + 8]];
        if (user) pts.push([user.x, user.y, user.z + PLAYER_EYE - 0.2], [e.x, e.y, e.z + 1]);
        this.vfx.lines(now, pts, 0xe0301e, 600);
        break;
      }
      case 'betrayer:E': // afterimage trail
        for (let i = 0; i < 3; i++) this.afterimages.push({ start: now + i * 60, x: e.x, y: e.y, z: e.z, sprite: 'betrayer' });
        break;
    }
  }

  private onGameOver(e: Extract<GameEvent, { type: 'gameOver' }>, now: number): void {
    if (this.over) return;
    this.resultAt = now;
    debugState.gameResult = e.result;
    this.resultData = {
      result: e.result,
      timeMs: e.timeMs,
      kills: Object.entries(e.kills).map(([id, kills]) => ({ name: this.o.roster.find((r) => r.id === Number(id))?.name ?? `Player ${id}`, kills })),
    };
    this.hud.showResult(e.result === 'victory' ? 'Victory' : 'Defeat');
    // At the result, pointer lock is released and input stops.
    this.input.release();
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onSnapshot(s: Snapshot, prev: Snapshot | null): void {
    const now = performance.now();
    // Doors follow from arenaIndex and arenaPhase (§8.2).
    for (let ai = 0; ai < this.map.arenas.length; ai++) {
      const closed = doorsClosedFor(ai, s.arenaIndex, s.arenaPhase);
      if (closed !== this.doorState[ai]) {
        this.doorState[ai] = closed;
        setArenaDoors(this.map, ai, closed);
        this.scene.setDoorsClosed(ai, closed);
      }
    }
    const me = s.players.find((p) => p.id === this.localId);
    const was = prev?.players.find((p) => p.id === this.localId);
    if (me) {
      if (me.dead !== this.dead) {
        this.dead = me.dead;
        if (this.dead) this.input.release();
        this.canvas.classList.toggle('dead', this.dead);
        const boss = this.map.arenas[s.arenaIndex]?.boss;
        this.hud.setDeath(this.dead ? (boss ? 'You are dead — your party fights on' : 'You are dead — you respawn when this arena is cleared') : null);
      }
      this.hud.setHp(me.hp, me.shield, this.maxHp);
      if (was) {
        const lost = was.hp + was.shield - (me.hp + me.shield);
        if (lost > 0 && !me.dead) {
          this.hud.vignette('red', Math.min(0.8, Math.max(0.2, (lost / this.maxHp) * 3)), now);
          this.hud.shakeHp(now);
        } else if (me.hp > was.hp && !was.dead) this.hud.vignette('green', 0.3, now);
        if ((me.shield > 0 && me.shield > was.shield) || (was.shield > 0 && me.shield === 0)) this.hud.vignette('blue', 0.5, now);
        if (me.kills > was.kills) this.hud.kill(now);
      }
    }
    // Hurt flashes, and bursts for enemies and censers that disappeared.
    for (let i = 0; i < s.enemyCount; i++) {
      if (!(s.enemyFlags[i] & FLAG_HURT)) continue;
      this.flashUntil[s.enemySlot[i]] = now + ENEMY_FLASH_MS;
      if (s.enemyType[i] === BLESSED) this.animator.hurt(s.enemySlot[i], now);
    }
    if (prev) {
      const delay = this.snaps.delayTicks * TICK_MS;
      for (let i = 0; i < prev.enemyCount; i++) {
        const slot = prev.enemySlot[i];
        if (this.snaps.hasEnemy(slot)) continue;
        const type = prev.enemyType[i];
        const def = ENEMIES[type];
        const g = groundHeight(this.map, prev.enemyX[i], prev.enemyY[i], def.radius, Infinity, false, true);
        const z = (g === -Infinity ? 0 : g) + (type === CHERUB ? CHERUB_HOVER : 0) + def.height / 2;
        this.pendingBursts.push({ at: now + delay, censer: false, x: prev.enemyX[i], y: prev.enemyY[i], z });
        if (type === BLESSED) {
          this.corpses.push({ start: now + delay, x: prev.enemyX[i], y: prev.enemyY[i], z: g === -Infinity ? 0 : g, facing: this.animator.facing[slot] });
          if (this.corpses.length > MAX_CORPSES) this.corpses.shift();
        }
      }
      const alive = new Set(s.projSlot.subarray(0, s.projectileCount));
      for (let i = 0; i < prev.projectileCount; i++) {
        if (prev.projKind[i] !== PROJ_CENSER || alive.has(prev.projSlot[i])) continue;
        this.pendingBursts.push({ at: now + delay, censer: true, x: prev.projX[i], y: prev.projY[i], z: prev.projZ[i] });
      }
    }
    debugState.lastSnapshotTick = s.tick;
    debugState.enemies = s.enemyCount;
    debugState.projectiles = s.projectileCount;
    debugState.arenaIndex = s.arenaIndex;
    debugState.arenaPhase = s.arenaPhase === PHASE_COMBAT ? 'combat' : s.arenaPhase === PHASE_CLEARED ? 'cleared' : 'idle';
    debugState.enemyCountsByTick = Object.fromEntries(this.snaps.enemyCountsByTick);
    debugState.players = s.players.map((p) => ({
      id: p.id,
      classId: this.classOf(p.id) ?? '',
      hp: p.hp,
      dead: p.dead,
      kills: p.kills,
    }));
    this.hud.setRemaining(s.arenaPhase === PHASE_COMBAT ? s.enemiesRemaining : null);
    this.hud.setBoss(s.bossHp, s.bossMaxHp, s.bossCast === BOSS_CAST_JUDGMENT ? s.bossCastProgress / 255 : null);
    this.bossCast = s.bossCast;
    this.bossCastProgress = s.bossCastProgress / 255;
    this.bench?.onSnapshot(s);
  }

  /**
   * Displayed cooldown in seconds: the newest snapshot value minus the time since it arrived; for
   * movement abilities, the larger of that and the local timer (§9.3).
   */
  private displayedCooldown(slot: 'Q' | 'E', now: number): number {
    const s = this.snaps.newest;
    const me = s?.players.find((p) => p.id === this.localId);
    const ms = me ? (slot === 'Q' ? me.cdQ : me.cdE) : 0;
    // The frame timestamp can be slightly earlier than the snapshot's arrival time.
    let cd = Math.max(0, ms - Math.max(0, now - this.snaps.newestArrival)) / 1000;
    if (slot === 'E' && ABILITIES[this.classId].E.movement) cd = Math.max(cd, (this.localEReadyAt - now) / 1000);
    return Math.max(0, cd);
  }

  /**
   * Ally target (§5.3): the living ally with the smallest angle to the aim, at most 10°, within the
   * E ability's range and in line of sight. Only the Fallen and the Heretic Saint use one.
   */
  private computeAllyTarget(): number {
    const range = ABILITIES[this.classId].E.allyRange;
    if (range <= 0 || this.dead) return ALLY_NONE;
    const p = this.player;
    const ex = p.body.x;
    const ey = p.body.y;
    const ez = p.body.z + PLAYER_EYE;
    const [ax, ay, az] = aimDir(p.yaw, p.pitch);
    let best = ALLY_NONE;
    let bestAngle = ALLY_TARGET_ANGLE + 1e-9;
    for (const q of this.snaps.playersOut) {
      if (q.id === this.localId || q.dead) continue;
      const cz = q.z + PLAYER_HEIGHT / 2;
      if (distToCylinder(ex, ey, ez, q.x, q.y, q.z, PLAYER_RADIUS, PLAYER_HEIGHT) > range) continue;
      const dx = q.x - ex;
      const dy = q.y - ey;
      const dz = cz - ez;
      const len = Math.hypot(dx, dy, dz);
      if (len < 1e-6) continue;
      const angle = Math.acos(Math.max(-1, Math.min(1, (dx * ax + dy * ay + dz * az) / len)));
      if (angle > bestAngle) continue;
      if (!lineOfSight(this.map, ex, ey, ez, q.x, q.y, cz)) continue;
      best = q.id;
      bestAngle = angle;
    }
    return best;
  }

  /**
   * Cosmetic shot feedback (§10): muzzle flash and recoil; hitscan weapons also draw a tracer per pellet
   * to where the local ray stops, and show a hit marker when it hits an interpolated enemy.
   */
  private cosmeticShot(now: number, ents: { count: number; x: Float32Array; y: Float32Array; type: Uint8Array }, enemyZ: Float32Array): void {
    this.hud.shot(now);
    const w = WEAPONS[this.classId];
    if (!w.hitscan) return;
    const p = this.player;
    const ex = p.body.x;
    const ey = p.body.y;
    const ez = p.body.z + PLAYER_EYE;
    // The muzzle: a little forward, right and down from the eye.
    const [fx, fy] = [Math.cos(p.yaw), Math.sin(p.yaw)];
    const mx = ex + fx * 0.6 - fy * 0.15;
    const my = ey + fy * 0.6 + fx * 0.15;
    const mz = ez - 0.3;
    const pts: Array<[number, number, number]> = [];
    let hit = false;
    for (let k = 0; k < w.pellets; k++) {
      const yaw = p.yaw + (Math.random() * 2 - 1) * w.spreadYaw;
      const pitch = p.pitch + (Math.random() * 2 - 1) * w.spreadPitch;
      const [dx, dy, dz] = aimDir(yaw, pitch);
      const stop = raycastTerrain(this.map, ex, ey, ez, dx, dy, dz, w.range);
      const ts: number[] = [];
      for (let i = 0; i < ents.count; i++) {
        const def = ENEMIES[ents.type[i]];
        const t = rayCylinder(ex, ey, ez, dx, dy, dz, ents.x[i], ents.y[i], enemyZ[i], def.radius, def.height);
        if (t <= stop) ts.push(t);
      }
      ts.sort((a, b) => a - b);
      let end = stop;
      if (ts.length > 0) {
        hit = true;
        if (ts.length >= w.maxHits) end = ts[w.maxHits - 1];
      }
      pts.push([mx, my, mz], [ex + dx * end, ey + dy * end, ez + dz * end]);
    }
    this.vfx.lines(now, pts, 0xffd27a, TRACER_MS);
    if (hit) this.hud.hit(now);
  }

  private readonly frame = (now: number): void => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.max(0, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const p = this.player;

    if (this.over && !this.resultsShown && now - this.resultAt >= RESULT_OVERLAY_MS) {
      this.resultsShown = true;
      this.o.onResults(this.resultData!);
      return;
    }

    // Enemies at the render time, and their derived heights.
    const ents = this.snaps.interpolate(now);
    const enemyZ = this.enemyHeights(ents, dt);
    this.allyTargetId = this.computeAllyTarget();

    let mx = 0;
    let my = 0;
    let wantJump = false;
    let fire = false;
    if (this.over) {
      // The result overlay: the game keeps rendering without input.
    } else if (this.bench) {
      p.yaw += BENCH_TURN_RATE * dt;
      p.pitch = 0;
    } else if (this.bot) {
      const be = this.botEnemies;
      be.length = ents.count;
      for (let i = 0; i < ents.count; i++) {
        const e = be[i] ?? (be[i] = { slot: 0, type: 0, x: 0, y: 0, z: 0 });
        e.slot = ents.slot[i];
        e.type = ents.type[i];
        e.x = ents.x[i];
        e.y = ents.y[i];
        e.z = enemyZ[i];
      }
      const s = this.snaps.newest;
      const out = this.bot.update(now, {
        map: this.map,
        body: p.body,
        dead: this.dead,
        enemies: be,
        arenaIndex: s?.arenaIndex ?? 0,
        arenaPhase: s?.arenaPhase ?? 0,
        hostPlayer: null,
        qReady: this.displayedCooldown('Q', now) <= 0,
        eReady: this.displayedCooldown('E', now) <= 0,
        blockedLastFrame: p.moveResult.blocked,
      });
      if (out.yaw !== null) p.yaw = out.yaw;
      if (out.pitch !== null) p.pitch = out.pitch;
      mx = out.dirX;
      my = out.dirY;
      this.botDir = mx !== 0 || my !== 0 ? [mx, my] : null;
      wantJump = out.jump;
      fire = out.fire;
      if (out.pressQ) this.pressAbility('Q', now);
      if (out.pressE) this.pressAbility('E', now);
    } else if (!this.dead) {
      const { dx, dy } = this.input.takeMouse();
      p.look(dx * MOUSE_SENSITIVITY, -dy * MOUSE_SENSITIVITY);
      const axes = this.input.moveAxes();
      [mx, my] = wasdDirection(p.yaw, axes.forward, axes.right);
      wantJump = this.input.jumpQueued || this.input.isDown('Space');
      fire = this.input.fireHeld;
    } else {
      // Dead: the camera can only rotate.
      const { dx, dy } = this.input.takeMouse();
      p.look(dx * MOUSE_SENSITIVITY, -dy * MOUSE_SENSITIVITY);
    }
    this.input.jumpQueued = false;
    this.fireHeld = fire && !this.dead && !this.over;
    if (!this.dead && !this.bench && !this.over) p.update(this.map, dt, mx, my, wantJump);

    // The cosmetic fire timer, at 30 Hz like the host's.
    this.fireAcc = Math.min(this.fireAcc + dt, 5 * TICK_DT);
    while (this.fireAcc >= TICK_DT) {
      this.fireAcc -= TICK_DT;
      if (this.fireHeld && this.fireTimer <= 1e-6) {
        this.cosmeticShot(now, ents, enemyZ);
        this.fireTimer += WEAPONS[this.classId].interval;
      }
      this.fireTimer -= TICK_DT;
      if (!this.fireHeld && this.fireTimer < 0) this.fireTimer = 0;
    }

    // Input to the host at 30 Hz.
    this.inputAcc += dt;
    if (this.inputAcc >= TICK_DT && !this.over) {
      this.inputAcc = Math.min(this.inputAcc - TICK_DT, TICK_DT);
      this.o.transport.sendInput(
        encodeInput({
          seq: ++this.seq,
          x: p.body.x,
          y: p.body.y,
          z: p.body.z,
          yaw: p.yaw,
          pitch: p.pitch,
          fireHeld: this.fireHeld,
          qPresses: this.qPresses,
          ePresses: this.ePresses,
          allyTargetId: this.allyTargetId,
          lastTeleportId: this.lastTeleportId,
        }),
      );
    }

    // Bursts whose time has come.
    for (let i = this.pendingBursts.length - 1; i >= 0; i--) {
      const b = this.pendingBursts[i];
      if (now < b.at) continue;
      if (b.censer) this.particles.emberBurst(b.x, b.y, b.z);
      else this.particles.featherBurst(b.x, b.y, b.z);
      this.pendingBursts.splice(i, 1);
    }
    this.particles.update(dt);
    this.vfx.update(now);

    const b = p.body;
    this.scene.setView(b.x, b.y, b.z, p.yaw, p.pitch);
    this.drawBillboards(now, ents, enemyZ);
    this.scene.render();

    this.hud.setCooldowns(this.displayedCooldown('Q', now), ABILITIES[this.classId].Q.cooldown, this.displayedCooldown('E', now), ABILITIES[this.classId].E.cooldown);
    this.hud.update(now);
    debugState.fps = this.fps.frame(now);
    debugState.simMs = this.o.host ? this.o.host.simMs(now) : 0;
    this.overlay.position.x = b.x;
    this.overlay.position.y = b.y;
    this.overlay.position.z = b.z;
    this.overlay.position.yaw = p.yaw;
    this.overlay.update(now);
    this.bench?.onFrame(now, dt);
  };

  private readonly glowScratch: Glow = { r: 1, g: 1, b: 1, a: 0 };

  private drawBillboards(now: number, ents: { count: number; slot: Uint16Array; x: Float32Array; y: Float32Array; type: Uint8Array; state: Uint8Array; flags: Uint8Array }, enemyZ: Float32Array): void {
    const bb = this.billboards;
    const bbBlessed = this.blessedBillboards;
    bb.begin();
    bbBlessed.begin();
    const chain = this.frames['chain-ring'];
    const mark = this.frames.mark;
    const anims = this.o.blessed.anims;
    const eye = this.player.body;
    const dt = Math.min(0.1, (now - this.lastAnimAt) / 1000);
    this.lastAnimAt = now;
    this.animator.begin();
    this.judgmentGlow.visible = false;
    for (let i = 0; i < ents.count; i++) {
      const type = ents.type[i];
      let f = this.enemyFrames[type];
      let height = ENEMIES[type].height;
      let target = bb;
      if (type === BLESSED) {
        // Direction and frame of the animated sprite (§11.1).
        const slot = ents.slot[i];
        const x = ents.x[i];
        const y = ents.y[i];
        const t = this.nearestPlayer(x, y);
        this.animator.update(slot, x, y, ents.state[i], now, dt, t.x, t.y);
        const pick = this.animator.pick(slot, now);
        const af = anims[pick.anim][spriteDirection(this.animator.facing[slot], eye.x - x, eye.y - y)][pick.frame];
        f = af;
        height = af.height;
        target = bbBlessed;
      }
      if (!f) continue;
      const def = ENEMIES[type];
      const flags = ents.flags[i];
      const z = enemyZ[i];
      // Status (§10): hurt flash, wind-up gold glow, marked red glow, silenced grey tint.
      let glow = NO_GLOW;
      let judgment: Glow | null = null;
      if (type === GATEKEEPER && this.bossCast === BOSS_CAST_JUDGMENT) {
        const t = this.bossCastProgress;
        const g = this.glowScratch;
        g.r = 1;
        g.g = 0.95;
        g.b = 0.75;
        g.a = 0.25 + 0.6 * t;
        judgment = g;
        const r = JUDGMENT_GLOW_R0 + (JUDGMENT_GLOW_R1 - JUDGMENT_GLOW_R0) * t;
        this.judgmentGlow.visible = true;
        this.judgmentGlow.position.set(ents.x[i], enemyZ[i] + def.height / 2, ents.y[i]);
        this.judgmentGlow.scale.setScalar(r);
        this.judgmentGlow.material.opacity = 0.15 + 0.3 * t;
      }
      if (this.flashUntil[ents.slot[i]] > now) glow = GLOW_FLASH;
      else if (judgment) glow = judgment;
      else if (ents.state[i] === ST_WINDUP) glow = GLOW_WINDUP;
      else if (flags & FLAG_MARKED) glow = GLOW_MARKED;
      const grey = (flags & FLAG_SILENCED) !== 0;
      target.add(f, ents.x[i], ents.y[i], z, height, false, grey ? 0.55 : 1, grey ? 0.55 : 1, grey ? 0.6 : 1, glow);
      if (flags & FLAG_ROOTED) bb.add(chain, ents.x[i], ents.y[i], z + 0.25, Math.max(0.45, def.radius * 1.1), true);
      if (flags & FLAG_MARKED) bb.add(mark, ents.x[i], ents.y[i], z + def.height + 0.5, 0.6, true);
    }
    // Blessed corpses: the death animation, then lying still, then sinking into the floor.
    let gone = 0;
    for (const c of this.corpses) {
      const cf = corpseFrame(c, now);
      if (!cf) {
        if (now >= c.start) gone++;
        continue;
      }
      const af = anims.death[spriteDirection(c.facing, eye.x - c.x, eye.y - c.y)][cf.frame];
      bbBlessed.add(af, c.x, c.y, c.z - cf.sink, af.height, false);
    }
    // Corpses are in order of death, so the expired ones are at the front.
    if (gone) this.corpses.splice(0, gone);
    const proj = this.snaps.projOut;
    for (let i = 0; i < proj.count; i++) {
      const k = proj.kind[i];
      bb.add(this.frames[PROJECTILE_SPRITES[k]], proj.x[i], proj.y[i], proj.z[i], PROJECTILE_SIZES[k], true);
    }
    // Other players; the ally target is tinted gold (§10).
    for (const q of this.snaps.playersOut) {
      if (q.id === this.localId || q.dead) continue;
      const cls = this.classOf(q.id);
      if (!cls) continue;
      bb.add(this.frames[cls], q.x, q.y, q.z, PLAYER_HEIGHT, false, 1, 1, 1, q.id === this.allyTargetId ? GLOW_ALLY : NO_GLOW);
    }
    // Decorations (§8.1): drawn only.
    for (const d of this.map.decorations) {
      bb.add(this.frames[decorSprite(d.id)], d.c + 0.5, d.r + 0.5, this.map.floor[d.r * this.map.w + d.c], DECOR[d.id].height, false);
    }
    // Shadowstep afterimages fade out over 0.4 s.
    for (let i = this.afterimages.length - 1; i >= 0; i--) {
      const a = this.afterimages[i];
      const t = (now - a.start) / 400;
      if (t >= 1) {
        this.afterimages.splice(i, 1);
        continue;
      }
      if (t < 0 || a.sprite === undefined) continue;
      const g = this.glowScratch;
      g.r = 0.1;
      g.g = 0.05;
      g.b = 0.05;
      g.a = 0.4 + 0.5 * t;
      bb.add(this.frames[a.sprite], a.x, a.y, a.z, PLAYER_HEIGHT * (1 - 0.3 * t), false, 1, 1, 1, g);
    }
    this.particles.draw(bb);
    bb.end(this.scene.camera);
    bbBlessed.end(this.scene.camera);
  }

  private lastAnimAt = 0;
  private readonly nearestScratch = { x: 0, y: 0 };

  /** The nearest living player to a point, the local one included; enemies face it while attacking. */
  private nearestPlayer(x: number, y: number): { x: number; y: number } {
    const out = this.nearestScratch;
    const me = this.player.body;
    let best = this.dead ? Infinity : (me.x - x) ** 2 + (me.y - y) ** 2;
    out.x = me.x;
    out.y = me.y;
    for (const q of this.snaps.playersOut) {
      if (q.id === this.localId || q.dead) continue;
      const d = (q.x - x) ** 2 + (q.y - y) ** 2;
      if (d < best) {
        best = d;
        out.x = q.x;
        out.y = q.y;
      }
    }
    return out;
  }

  /** Enemy height isn't sent: ground height for ground enemies, ground height + 4 m (smoothed) for Cherubs (§9.4). */
  private enemyHeights(ents: { count: number; slot: Uint16Array; x: Float32Array; y: Float32Array; type: Uint8Array }, dt: number): Float32Array {
    const z = this.zScratch;
    for (let i = 0; i < ents.count; i++) {
      const type = ents.type[i];
      const r = ENEMIES[type].radius;
      const g = groundHeight(this.map, ents.x[i], ents.y[i], r, Infinity, false, true);
      const ground = g === -Infinity ? 0 : g;
      if (type === CHERUB) {
        const slot = ents.slot[i];
        const want = ground + CHERUB_HOVER;
        const cur = this.cherubZ[slot];
        const fresh = this.cherubFrame[slot] !== this.frameNo - 1;
        this.cherubFrame[slot] = this.frameNo;
        if (fresh) this.cherubZ[slot] = want;
        else {
          const max = CHERUB_CLIMB * Math.min(dt, 0.1);
          this.cherubZ[slot] = cur + Math.max(-max, Math.min(max, want - cur));
        }
        z[i] = this.cherubZ[slot];
      } else z[i] = ground;
    }
    this.frameNo++;
    return z;
  }

  dispose(): void {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    this.overlay.dispose();
    this.hud.dispose();
    this.bench?.dispose();
    this.scene.dispose();
    this.o.root.replaceChildren();
  }
}
