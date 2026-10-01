/** The in-game client: input or bot, local movement, snapshots, interpolation and rendering. */
import { CLASSES, type ClassId } from '../data/classes';
import { CHERUB, CHERUB_CLIMB, CHERUB_HOVER, ENEMIES } from '../data/enemies';
import { debugState } from '../debug';
import type { CtrlMessage, GameEvent } from '../net/messages';
import { ALLY_NONE, encodeInput, PHASE_CLEARED, PHASE_COMBAT, type Snapshot } from '../net/protocol';
import type { Transport } from '../net/transport';
import type { Params } from '../params';
import { ENEMY_SLOTS, TICK_DT } from '../sim/constants';
import { doorsClosedFor, setArenaDoors, type GameMap } from '../sim/map';
import { groundHeight } from '../sim/movement';
import type { Atlas, SpriteFrame } from '../render/atlas';
import { Billboards } from '../render/billboards';
import { GameScene } from '../render/scene';
import { DebugOverlay } from '../ui/debugOverlay';
import { BenchRunner } from './bench';
import { Bot, type BotEnemy } from './bot';
import { FpsCounter } from './fps';
import type { HostSession } from './hostSession';
import { Input, MOUSE_SENSITIVITY } from './input';
import { LocalPlayer, wasdDirection } from './localPlayer';
import { SnapshotBuffer } from './snapshots';

const BENCH_TURN_RATE = 0.3;
const ENEMY_SPRITES = ['blessed', 'chorister', 'cherub', 'gatekeeper'];

export interface RosterEntry {
  id: number;
  name: string;
  classId: ClassId;
}

export interface GameOptions {
  root: HTMLElement;
  map: GameMap;
  atlas: Atlas;
  params: Params;
  transport: Transport;
  /** The host session when this player is the host (singleplayer included). */
  host: HostSession | null;
  localPlayerId: number;
  /** Players at `start`, sorted by id. */
  roster: RosterEntry[];
}

export class Game {
  private readonly root: HTMLElement;
  private readonly map: GameMap;
  private readonly params: Params;
  private readonly transport: Transport;
  private readonly host: HostSession | null;
  private readonly localId: number;
  private readonly roster: RosterEntry[];
  private readonly scene: GameScene;
  private readonly input: Input;
  private readonly player: LocalPlayer;
  private readonly overlay: DebugOverlay;
  private readonly fps = new FpsCounter();
  private readonly snaps: SnapshotBuffer;
  private readonly billboards: Billboards;
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
  private doorState: boolean[];
  /** Smoothed Cherub heights per slot (§9.4). */
  private readonly cherubZ = new Float32Array(ENEMY_SLOTS);
  /** Frame number when each slot's Cherub height was last updated. */
  private readonly cherubFrame = new Uint32Array(ENEMY_SLOTS);
  private frameNo = 1;
  private readonly botEnemies: BotEnemy[] = [];

  constructor(o: GameOptions) {
    this.root = o.root;
    this.map = o.map;
    this.params = o.params;
    this.transport = o.transport;
    this.host = o.host;
    this.localId = o.localPlayerId;
    this.roster = o.roster;

    const canvas = document.createElement('canvas');
    canvas.className = 'game-canvas';
    this.root.appendChild(canvas);
    this.scene = new GameScene(canvas, this.map);
    this.billboards = new Billboards(o.atlas.texture);
    this.scene.scene.add(this.billboards.mesh);
    this.enemyFrames = ENEMY_SPRITES.map((n) => o.atlas.frames[n]);
    const crosshair = document.createElement('div');
    crosshair.className = 'crosshair';
    this.root.appendChild(crosshair);
    this.overlay = new DebugOverlay(this.root);

    this.input = new Input(canvas);
    this.input.pointerLockAllowed = !this.params.bot && !this.params.bench;
    this.input.onKey = (code) => this.onKey(code);

    const me = this.roster.find((r) => r.id === this.localId)!;
    const index = this.roster.indexOf(me);
    const cls = CLASSES[me.classId];
    const [sc, sr] = this.params.bench ? this.map.arenas[0].entryCells[0] : this.map.spawns[index];
    this.player = new LocalPlayer(sc + 0.5, sr + 0.5, this.map.floor[sr * this.map.w + sc], cls.speed);
    this.doorState = this.map.arenas.map(() => false);

    this.snaps = new SnapshotBuffer(this.host ? 1.5 : 4.5);
    this.snaps.onComplete = (s) => this.onSnapshot(s);
    this.transport.onSnapshot = (buf) => this.snaps.addPart(buf, performance.now());
    this.transport.onCtrl = (msg) => this.onCtrl(msg);

    this.bot = this.params.bot ? new Bot(this.map) : null;
    this.bench = this.params.bench && this.host ? new BenchRunner(this.root, this.host, () => this.scene.rendererString()) : null;

    debugState.players = this.roster.map((r) => ({ id: r.id, classId: r.classId, hp: CLASSES[r.classId].hp, dead: false, kills: 0 }));
  }

  start(): void {
    this.lastFrame = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  private onKey(code: string): void {
    if (code === 'F3') this.overlay.toggle();
    else if (code === 'KeyK' && this.params.dev && this.host) this.host.killAll();
  }

  private onCtrl(msg: CtrlMessage): void {
    if (msg.type === 'event') this.onEvent(msg.event);
  }

  private onEvent(e: GameEvent): void {
    if (e.type === 'teleport') {
      this.player.teleport(e.x, e.y, e.z);
      this.lastTeleportId = e.teleportId;
    }
  }

  private onSnapshot(s: Snapshot): void {
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
    if (me) {
      if (me.dead && !this.dead) this.input.release();
      this.dead = me.dead;
    }
    debugState.lastSnapshotTick = s.tick;
    debugState.enemies = s.enemyCount;
    debugState.projectiles = s.projectileCount;
    debugState.arenaIndex = s.arenaIndex;
    debugState.arenaPhase = s.arenaPhase === PHASE_COMBAT ? 'combat' : s.arenaPhase === PHASE_CLEARED ? 'cleared' : 'idle';
    debugState.enemyCountsByTick = Object.fromEntries(this.snaps.enemyCountsByTick);
    debugState.players = s.players.map((p) => ({
      id: p.id,
      classId: this.roster.find((r) => r.id === p.id)?.classId ?? '',
      hp: p.hp,
      dead: p.dead,
      kills: p.kills,
    }));
    this.bench?.onSnapshot(s);
  }

  /** Displayed cooldown in seconds: the newest snapshot value minus the time since it arrived (§9.3). */
  private displayedCooldown(slot: 'Q' | 'E', now: number): number {
    const s = this.snaps.newest;
    const me = s?.players.find((p) => p.id === this.localId);
    if (!me) return 0;
    const ms = slot === 'Q' ? me.cdQ : me.cdE;
    return Math.max(0, ms - (now - this.snaps.newestArrival)) / 1000;
  }

  private readonly frame = (now: number): void => {
    this.raf = requestAnimationFrame(this.frame);
    const dt = Math.max(0, (now - this.lastFrame) / 1000);
    this.lastFrame = now;
    const p = this.player;

    // Enemies at the render time, and their derived heights.
    const ents = this.snaps.interpolate(now);
    const enemyZ = this.enemyHeights(ents, dt);

    let mx = 0;
    let my = 0;
    let wantJump = false;
    let fire = false;
    if (this.bench) {
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
      wantJump = out.jump;
      fire = out.fire;
      if (out.pressQ) this.qPresses = (this.qPresses + 1) & 0xff;
      if (out.pressE) this.ePresses = (this.ePresses + 1) & 0xff;
    } else if (!this.dead) {
      const { dx, dy } = this.input.takeMouse();
      p.look(dx * MOUSE_SENSITIVITY, -dy * MOUSE_SENSITIVITY);
      const axes = this.input.moveAxes();
      [mx, my] = wasdDirection(p.yaw, axes.forward, axes.right);
      wantJump = this.input.jumpQueued || this.input.isDown('Space');
      fire = this.input.fireHeld;
      this.qPresses = this.input.qPresses;
      this.ePresses = this.input.ePresses;
    } else {
      // Dead: the camera can only rotate.
      const { dx, dy } = this.input.takeMouse();
      p.look(dx * MOUSE_SENSITIVITY, -dy * MOUSE_SENSITIVITY);
    }
    this.input.jumpQueued = false;
    if (!this.dead && !this.bench) p.update(this.map, dt, mx, my, wantJump);

    // Input to the host at 30 Hz.
    this.inputAcc += dt;
    if (this.inputAcc >= TICK_DT) {
      this.inputAcc = Math.min(this.inputAcc - TICK_DT, TICK_DT);
      this.transport.sendInput(
        encodeInput({
          seq: ++this.seq,
          x: p.body.x,
          y: p.body.y,
          z: p.body.z,
          yaw: p.yaw,
          pitch: p.pitch,
          fireHeld: fire && !this.dead,
          qPresses: this.qPresses,
          ePresses: this.ePresses,
          allyTargetId: ALLY_NONE,
          lastTeleportId: this.lastTeleportId,
        }),
      );
    }

    const b = p.body;
    this.scene.setView(b.x, b.y, b.z, p.yaw, p.pitch);
    this.billboards.begin();
    for (let i = 0; i < ents.count; i++) {
      const f = this.enemyFrames[ents.type[i]];
      if (!f) continue;
      this.billboards.add(f, ents.x[i], ents.y[i], enemyZ[i], ENEMIES[ents.type[i]].height, false);
    }
    this.billboards.end(this.scene.camera);
    this.scene.render();

    debugState.fps = this.fps.frame(now);
    debugState.simMs = this.host ? this.host.simMs(now) : 0;
    this.overlay.position.x = b.x;
    this.overlay.position.y = b.y;
    this.overlay.position.z = b.z;
    this.overlay.position.yaw = p.yaw;
    this.overlay.update(now);
    this.bench?.onFrame(now, dt);
  };

  private zScratch = new Float32Array(ENEMY_SLOTS);

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
    cancelAnimationFrame(this.raf);
    this.input.dispose();
    this.overlay.dispose();
    this.bench?.dispose();
    this.scene.dispose();
    this.root.replaceChildren();
  }
}
