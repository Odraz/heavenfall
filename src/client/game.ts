/** The in-game client: input or bot, local movement, snapshots, interpolation, rendering and feedback. */
import { CLASSES, type ClassId } from '../data/classes';
import { DECOR, decorSprite } from '../data/decor';
import * as THREE from 'three';
import { CHERUB, CHERUB_CLIMB, CHERUB_HOVER, ENEMIES, GATEKEEPER, ST_WINDUP } from '../data/enemies';
import { ABILITIES, ATTACK_NONE, ATTACK_SECONDARY, attackDef, BLASPHEMY_RADIUS, chooseAttack, SCOURGE_HALF_ARC, SECONDARIES, type AttackSlot } from '../data/weapons';
import { debugState } from '../debug';
import type { CtrlMessage, GameEvent, LobbyPlayer } from '../net/messages';
import type { NetStats } from '../net/netStats';
import { ALLY_NONE, encodeInput, FLAG_HURT, FLAG_ROOTED, FLAG_SILENCED, FLAG_TAUNTED, PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN, type Snapshot } from '../net/protocol';
import type { Transport } from '../net/transport';
import type { Params } from '../params';
import { aimDir, estimateSilverBullet, rayCylinder } from '../sim/combat';
import { ENEMY_SLOTS, PLAYER_EYE, PLAYER_HEIGHT, TICK_DT, TICK_MS } from '../sim/constants';
import { raycastTerrain } from '../sim/los';
import { arenaPhaseOf, doorsClosed, setArenaDoors, type GameMap } from '../sim/map';
import { distToCylinder, groundHeight } from '../sim/movement';
import { BOSS_CAST_JUDGMENT, PROJ_CENSER } from '../sim/sim';
import type { EnemyAnimSet, PlayerAnimSet } from '../render/animAtlas';
import type { Atlas, SpriteFrame } from '../render/atlas';
import { Billboards, NO_GLOW, type Glow } from '../render/billboards';
import { Particles } from '../render/particles';
import { GameScene } from '../render/scene';
import type { GameTextures } from '../render/textures';
import { Vfx } from '../render/vfx';
import { BloodPool } from '../render/bloodPool';
import { FIELD_FIRE_RATE, inField } from '../sim/field';
import { DebugOverlay } from '../ui/debugOverlay';
import { PauseOverlay } from '../ui/pause';
import type { ResultsData } from '../ui/results';
import { BenchRunner } from './bench';
import { Bot, type BotEnemy } from './bot';
import { corpseFrame, EnemyAnimator, spriteDirection, type Corpse } from './enemyAnim';
import { FpsCounter } from './fps';
import type { HostSession } from './hostSession';
import { Hud } from './hud';
import { Input, MOUSE_SENSITIVITY } from './input';
import { audio, type LoopHandle } from '../audio/audio';
import { SOUL_HEIGHT, SOUL_RADIUS } from '../sim/souls';
import { pickAllyTarget } from './allyTarget';
import { GameSounds } from './sounds';
import { ViewBob } from './bob';
import { SoulView } from './soulView';
import { LocalPlayer, MAX_FRAME_DT, wasdDirection } from './localPlayer';
import { PartyFrames } from './partyFrames';
import { PlayerAnimator } from './playerAnim';
import { SnapshotBuffer, type InterpolatedEnemies } from './snapshots';

const BENCH_TURN_RATE = 0.3;
const PROJECTILE_SPRITES = ['proj-censer', 'proj-orb', 'proj-arrow'];
const PROJECTILE_SIZES = [0.4, 0.6, 0.3];
const RESULT_OVERLAY_MS = 3000;
/**
 * A hurt enemy flashes white, fading out over ENEMY_FLASH_MS, and flashes again no sooner than
 * ENEMY_FLASH_GAP_MS later, so under constant fire its texture still shows most of the time.
 */
const ENEMY_FLASH_MS = 120;
const ENEMY_FLASH_GAP_MS = 250;
const ENEMY_FLASH_PEAK = 0.7;
const TRACER_MS = 70;
/** Tracers are 0.1 m wide; the slug's 0.15 m (M9 §5.1). */
const TRACER_WIDTH = 0.1;
const SLUG_TRACER_WIDTH = 0.15;
/** Recoil in % of the screen height, and the muzzle flash's size, for the heavy shots (M9 §5.1). */
const SLUG_RECOIL = 12;
const SLUG_FLASH = 1.3;
const SILVER_RECOIL = 14;
/** The Silver Bullet's tracer: an ember strip with a silver-white core, fading over 0.25 s. */
const SILVER_EMBER = 0xff7a3a;
const SILVER_CORE = 0xf2f4ff;
const SILVER_WIDTH = 0.3;
const SILVER_CORE_WIDTH = 0.1;
const SILVER_MS = 250;
/** Others' beams and Silver Bullets start this far in front of their body center, along their yaw. */
const OTHERS_MUZZLE = 0.5;
/** Sacrament's embers: 10 per second per beam, drifting toward the ally at 4 m/s. */
const BEAM_EMBERS_PER_S = 10;
const BEAM_EMBER_SPEED = 4;
/** The own beam starts at the first-person muzzle, this far in front of the camera. */
const OWN_BEAM_DEPTH = 0.6;
/** Own tracers turn blood red in a Field of Blood (M9 §5.1). */
const TRACER_COLOR = 0xffc04a;
const BLOOD_TRACER = 0xc81818;
/** Field of Blood's toss (M9 §5.1): 30 coins, 0.12 m, landing within 1.2 m of the center in an arc 1 m high over 0.3 s. */
const COINS = 30;
const COIN_SIZE = 0.12;
const COIN_SPREAD = 1.2;
const COIN_ARC = 1;
const COIN_MS = 300;
/** Red embers rise from the pool, 12 per second. */
const POOL_EMBERS_PER_S = 12;
/** Falling Star's launched enemies fly an arc 1 m high over 0.4 s (M9 §3.2). */
const LAUNCH_HEIGHT = 1;
const LAUNCH_MS = 400;
/** At most this many corpses lie around; the oldest vanish first. */
const MAX_CORPSES = 1000;

const GLOW_WINDUP: Glow = { r: 1, g: 0.78, b: 0.2, a: 0.5 };
const GLOW_ALLY: Glow = { r: 1, g: 0.8, b: 0.2, a: 0.55 };
/** Judgment: the glow sphere around the Gatekeeper grows from this radius to the next over the cast. */
const JUDGMENT_GLOW_R0 = 3;
const JUDGMENT_GLOW_R1 = 9;
/** The ally chevron's tip sits this high above the ally's feet, just over the head. */
const CHEVRON_HEIGHT = 2.15;
/** Martyr's Shroud's mote flies to its target in this long (M8 §3.1). */
const MOTE_MS = 250;
/** Souls (M8 §4.1): ember-tinted at 55% opacity, embers rising at 4 per second, markers within 60 m. */
const GLOW_SOUL: Glow = { r: 1, g: 0.48, b: 0.23, a: 0.65 };
const SOUL_OPACITY = 0.55;
const SOUL_EMBERS_PER_S = 4;
const SOUL_MARKER_RANGE = 60;
const SOUL_MARKER_HEIGHT = 2.2;
/** The revive hum plays while a shot hit a soul this recently, or the player's own progress rose. */
const HUM_HOLD_MS = 300;
/** The taunt `!` (M8 §3.1): 0.5 m tall, 0.3 m above the head; pops in, holds, then fades. */
const TAUNT_MARK_HEIGHT = 0.4;
const TAUNT_MARK_GAP = 0.3;
const TAUNT_POP_MS = 150;
const TAUNT_HOLD_MS = 600;
const TAUNT_FADE_MS = 300;

export interface RosterEntry {
  id: number;
  name: string;
  classId: ClassId;
}

export interface GameOptions {
  root: HTMLElement;
  map: GameMap;
  atlas: Atlas;
  textures: GameTextures;
  /** The animated 8-direction sprites of every enemy type that has an atlas, by type. */
  enemyAnims: Partial<Record<number, EnemyAnimSet>>;
  /** The animated sprites of every class another player in the roster plays. */
  players: Partial<Record<ClassId, PlayerAnimSet>>;
  params: Params;
  transport: Transport;
  /** The host session when this player is the host (singleplayer included). */
  host: HostSession | null;
  localPlayerId: number;
  /** Players at `start`, sorted by id; `setRoster` keeps it current (M8 §6.2). */
  roster: RosterEntry[];
  /** Singleplayer pauses the simulation while the Pause overlay is open (§3); multiplayer shows party frames. */
  singleplayer: boolean;
  /** Payload bytes over PeerJS, in multiplayer (§2.5). */
  net: NetStats | null;
  /** Called 3 s after the result, when the Results screen should appear. */
  onResults: (data: ResultsData) => void;
  /** Called when the player clicks `Leave game`, after `leave` was sent. */
  onLeave: () => void;
  /** Sends a chat message (M8 §7); absent in singleplayer, which has no chat. */
  onChat?: (text: string) => void;
}

export class Game {
  private readonly o: GameOptions;
  private readonly map: GameMap;
  private readonly params: Params;
  private readonly localId: number;
  /** The players' names and classes by id, kept current during the game (M8 §6.2). */
  private roster: RosterEntry[];
  private readonly classId: ClassId;
  private readonly maxHp: number;
  private readonly scene: GameScene;
  private readonly canvas: HTMLCanvasElement;
  private readonly input: Input;
  private readonly player: LocalPlayer;
  private readonly overlay: DebugOverlay;
  private readonly hud: Hud;
  private readonly pause: PauseOverlay;
  private readonly party: PartyFrames | null;
  private paused = false;
  /** performance.now() when the Pause overlay opened. */
  private pausedAt = 0;
  /** Whether pointer lock was held at the previous `pointerlockchange`. */
  private wasLocked = false;
  private readonly fps = new FpsCounter();
  private readonly snaps: SnapshotBuffer;
  private readonly billboards: Billboards;
  /** Enemies with an atlas and their corpses, one billboard mesh per type. */
  private readonly enemyBillboards = new Map<number, Billboards>();
  private readonly animator = new EnemyAnimator();
  private readonly corpses: Corpse[] = [];
  private readonly particles: Particles;
  private readonly vfx: Vfx;
  /** The large growing glow on the Gatekeeper while it casts Judgment (§7.4). */
  private readonly judgmentGlow: THREE.Sprite;
  private readonly glowCenter = new THREE.Vector3();
  private readonly glowToCam = new THREE.Vector3();
  private readonly frames: Record<string, SpriteFrame>;
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
  /** The mouse buttons as the input's `fire` bits (M9 §10). */
  private fire = 0;
  /** The attack the held buttons pick locally this frame (M9 §2.1). */
  private attack: AttackSlot = ATTACK_NONE;
  /** Cosmetic fire timer, shared by both attacks and run locally at 30 Hz (M9 §2.2). */
  private fireTimer = 0;
  /** Each player's primary and secondary attacks, unwrapped from the snapshots' counters (M9 §10). */
  private readonly shotCounts = new Map<number, { raw: number; raw2: number; n: number; n2: number }>();
  /** The Field of Blood on screen (M9 §5.1), its coins in flight, and whether the local player stands in it. */
  private pool: BloodPool | null = null;
  private readonly coins: Array<{ from: [number, number, number]; to: [number, number, number]; start: number }> = [];
  private inFieldNow = false;
  /** When each enemy slot's Falling Star launch arc starts (M9 §3.2). */
  private readonly launchAt = new Float64Array(ENEMY_SLOTS).fill(-Infinity);
  /** Others' attack effects waiting for the render delay (M9 §5.1). */
  private readonly pendingFx: Array<{ at: number; run: (now: number) => void }> = [];
  private fireAcc = 0;
  /** Local timer for movement abilities (§9.3): performance.now() when it's ready again. */
  private localEReadyAt = 0;
  private allyTargetId = ALLY_NONE;
  /** With no ally target, an ally in the aim but out of range, for the grey chevron. */
  private allyOutOfRange = ALLY_NONE;
  private readonly bob = new ViewBob();
  private readonly souls = new SoulView();
  /** The local player's index, its spawn and entry cells: its player ID (M8 §6.2). */
  private readonly entryIndex: number;
  /** Whether a snapshot has shown the local player yet; one that shows it dead means it joined as a soul. */
  private seenSelf = false;
  /** Joined the fight as a soul (M8 §4.5), until revived. */
  private joinedAsSoul = false;
  /** While dead: the soul's ground point (the feet in snapshots) and own revive progress. */
  private ownGround = 0;
  private ownRevive = 0;
  private reviveRisingAt = -Infinity;
  /** When a local shot last hit a soul, and whose (M8 §9.1, the revive hum). */
  private soulHitAt = -Infinity;
  private soulHitId = -1;
  private hum: LoopHandle | null = null;
  /** Each arena's phase its doors were last set for, or -1 before the first snapshot. */
  private doorPhase: number[];
  /** Smoothed Cherub heights per slot (§9.4). */
  private readonly cherubZ = new Float32Array(ENEMY_SLOTS);
  /** Frame number when each slot's Cherub height was last updated. */
  private readonly cherubFrame = new Uint32Array(ENEMY_SLOTS);
  private frameNo = 1;
  private readonly zScratch = new Float32Array(ENEMY_SLOTS);
  /** performance.now() when each enemy's last white flash started. */
  private readonly flashAt = new Float64Array(ENEMY_SLOTS).fill(-Infinity);
  private readonly flashGlow: Glow = { r: 1, g: 1, b: 1, a: 0 };
  /** performance.now() when each enemy was seen taunted, or -1 while it isn't (M8 §3.1). */
  private readonly tauntAt = new Float64Array(ENEMY_SLOTS).fill(-1);
  private readonly botEnemies: BotEnemy[] = [];
  /** Delayed bursts, played when the render time reaches them. */
  private readonly pendingBursts: Array<{ at: number; censer: boolean; type: number; x: number; y: number; z: number }> = [];
  private readonly sounds: GameSounds;
  /** Shadowstep afterimages: the Betrayer's idle frame where it started, facing its yaw then. */
  private readonly afterimages: Array<{ start: number; x: number; y: number; z: number; facing: number }> = [];
  private readonly playerBillboards = new Map<ClassId, Billboards>();
  private readonly playerAnimator = new PlayerAnimator();
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
    this.roster = o.roster.map((r) => ({ ...r }));
    const me = o.roster.find((r) => r.id === this.localId)!;
    const index = this.localId;
    this.entryIndex = index;
    this.classId = me.classId;
    this.maxHp = CLASSES[me.classId].hp;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'game-canvas';
    o.root.appendChild(this.canvas);
    this.scene = new GameScene(this.canvas, this.map, o.textures.terrain);
    this.billboards = new Billboards(o.atlas.texture);
    this.scene.scene.add(this.billboards.mesh);
    for (const [type, set] of Object.entries(o.enemyAnims)) {
      const b = new Billboards(set!.texture, true);
      this.enemyBillboards.set(Number(type), b);
      this.scene.scene.add(b.mesh);
    }
    for (const [cls, set] of Object.entries(o.players) as Array<[ClassId, PlayerAnimSet]>) {
      const b = new Billboards(set.texture, true);
      this.playerBillboards.set(cls, b);
      this.scene.scene.add(b.mesh);
    }
    this.vfx = new Vfx(o.textures.fx);
    this.scene.scene.add(this.vfx.group);
    this.judgmentGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: o.textures.fx.glow, color: 0xfff0b0, transparent: true, depthWrite: false, fog: false }),
    );
    this.judgmentGlow.visible = false;
    this.scene.scene.add(this.judgmentGlow);
    this.frames = o.atlas.frames;
    this.particles = new Particles([o.atlas.frames.feather, o.atlas.frames.spark, o.atlas.frames.ember]);
    this.hud = new Hud(o.root, this.classId, !o.singleplayer);
    this.hud.onChatSend = (text) => o.onChat?.(text);
    this.hud.setHp(this.maxHp, 0, this.maxHp);
    this.hud.setRemaining(null);
    this.hud.setDeath(null);
    this.party = o.singleplayer ? null : new PartyFrames(this.hud.root);
    this.sounds = new GameSounds(this.map, this.localId, (id) => this.classOf(id));
    this.hud.onReady = () => this.sounds.abilityReady();
    this.overlay = new DebugOverlay(o.root);
    this.pause = new PauseOverlay(o.root, () => this.resume(), () => this.leave());

    this.input = new Input(this.canvas);
    this.input.pointerLockAllowed = !this.params.bot && !this.params.bench;
    this.input.onKey = (code) => this.onKey(code);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('visibilitychange', this.onVisibility);

    const [sc, sr] = this.params.bench ? this.map.arenas[0].entryCells[0] : this.map.spawns[index];
    this.player = new LocalPlayer(sc + 0.5, sr + 0.5, this.map.floor[sr * this.map.w + sc], CLASSES[me.classId].speed);
    this.doorPhase = this.map.arenas.map(() => -1);

    this.snaps = new SnapshotBuffer(o.host ? 1.5 : 4.5);
    this.snaps.onComplete = (s, prev) => this.onSnapshot(s, prev);
    o.transport.onSnapshot = (buf) => this.snaps.addPart(buf, performance.now());

    this.bot = this.params.bot ? new Bot(this.map) : null;
    this.bench = this.params.bench && o.host ? new BenchRunner(o.root, o.host, () => this.scene.rendererString()) : null;

    debugState.players = o.roster.map((r) => ({ id: r.id, classId: r.classId, hp: CLASSES[r.classId].hp, dead: false, kills: 0, revive: 0, primaryShots: 0, secondaryShots: 0 }));
    this.sounds.renderDelay = (this.snaps.delayTicks * TICK_MS) / 1000;
  }

  /** Compiles shaders and uploads textures during Loading, so entering the game doesn't stall. */
  prepare(): Promise<void> {
    return this.scene.warmUp();
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
    if (code === 'Escape') {
      this.openPause();
      return;
    }
    // Enter opens the chat line (M8 §7), bot or not.
    if ((code === 'Enter' || code === 'NumpadEnter') && this.o.onChat) {
      this.openChat();
      return;
    }
    if (code === 'KeyH') {
      this.hud.toggleHints();
      return;
    }
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

  /** Pause opens when pointer lock is lost, before the result (§3). */
  private readonly onPointerLockChange = (): void => {
    const locked = this.input.pointerLocked;
    if (this.wasLocked && !locked) this.openPause();
    this.wasLocked = locked;
  };

  /**
   * Opens the Pause overlay: releases held input and pointer lock and, in singleplayer, pauses the
   * simulation. It can't open at or after the result, nor in the benchmark.
   */
  private openPause(): void {
    if (this.paused || this.over || this.params.bench || this.disposed) return;
    this.paused = true;
    this.pausedAt = performance.now();
    debugState.paused = true;
    this.pause.open = true;
    // Opening Pause closes the chat line and discards its text (M8 §7).
    this.closeChat();
    this.input.release();
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.o.singleplayer) this.o.host?.setPaused(true);
  }

  private closePause(): void {
    if (!this.paused) return;
    this.paused = false;
    debugState.paused = false;
    this.pause.open = false;
    if (this.o.singleplayer) {
      this.o.host?.setPaused(false);
      // The simulation stood still, so snapshot times and the local Shadowstep and Falling Star timer
      // (§9.3) do too.
      const ms = performance.now() - this.pausedAt;
      this.localEReadyAt += ms;
      this.snaps.shiftArrivals(ms);
    }
    if (!this.over) this.input.enabled = true;
  }

  /**
   * The chat line (M8 §7): while it's open every key types into it, so movement, fire and abilities
   * are released and ignored; pointer lock is kept. Enter sends and closes it.
   */
  private openChat(): void {
    if (this.hud.chatOpen) return;
    this.input.release();
    this.input.typing = true;
    this.hud.openChat(() => {
      this.input.typing = false;
    });
  }

  private closeChat(): void {
    this.hud.closeChat();
    this.input.typing = false;
  }

  /** A chat message from the host, shown above the chat line for 10 s (M8 §7). */
  chat(name: string, text: string): void {
    if (!this.disposed) this.hud.addChat(name, text, performance.now());
  }

  /** The players in the session from a `lobby` message: their names and classes (M8 §6.2). */
  setRoster(players: LobbyPlayer[]): void {
    for (const p of players) {
      if (!p.classId) continue;
      const r = this.roster.find((q) => q.id === p.id);
      if (r) Object.assign(r, { name: p.name, classId: p.classId });
      else this.roster.push({ id: p.id, name: p.name, classId: p.classId });
    }
  }

  /** `Resume`: closes the overlay and requests pointer lock; the click is the required user gesture. */
  private resume(): void {
    this.closePause();
    if (this.input.pointerLockAllowed) this.input.requestPointerLock();
  }

  /** `Leave game`: sends `leave` and returns to Title (§3). */
  private leave(): void {
    if (this.disposed) return;
    this.o.transport.sendCtrl({ type: 'leave' });
    this.o.onLeave();
  }

  private sendInput(): void {
    const p = this.player;
    this.o.transport.sendInput(
      encodeInput({
        seq: ++this.seq,
        x: p.body.x,
        y: p.body.y,
        z: p.body.z,
        yaw: p.yaw,
        pitch: p.pitch,
        fire: this.fire,
        qPresses: this.qPresses,
        ePresses: this.ePresses,
        allyTargetId: this.allyTargetId,
        lastTeleportId: this.lastTeleportId,
      }),
    );
  }

  /**
   * A hidden page draws no frames, so it sends no input either: held fire is released at once, or the
   * host would keep firing for a player who switched tabs (§4).
   */
  private readonly onVisibility = (): void => {
    if (!document.hidden || this.over || this.disposed || !this.fire) return;
    this.input.release();
    this.fire = 0;
    this.sendInput();
  };

  /** The bot's movement direction this frame, for its Shadowstep. */
  private botDir: [number, number] | null = null;

  /** A `ctrl` message from the host; the game handles its events (§9.2). */
  handleCtrl(msg: CtrlMessage): void {
    if (msg.type !== 'event' || this.disposed) return;
    this.onEvent(msg.event, performance.now());
    this.sounds.event(msg.event, (id) => this.playerPose(id));
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
      case 'playerRevived': {
        // The hellfire pillar where the player rises (M8 §3.1); the soul sinks back into the body.
        const at = e.playerId === this.localId ? this.player.body : this.snaps.playersOut.find((q) => q.id === e.playerId);
        if (at) {
          this.vfx.pillar(now, at.x, at.y, at.z);
          this.particles.reviveBurst(at.x, at.y, at.z);
        }
        if (e.playerId !== this.localId) this.party?.flash(e.playerId, 'ember');
        break;
      }
      case 'abilityUsed':
        this.abilityVfx(e, now);
        break;
      case 'bossCast':
        this.hud.judgmentEvent(e.phase, now);
        break;
      case 'starLanded':
        // Launched enemies fly their arc after the render delay, like other effects (M9 §3.2).
        for (const s of e.launched) this.launchAt[s] = now + this.snaps.delayTicks * TICK_MS;
        break;
      case 'shroudBurst':
        // A blue ring expanding from 1 m to 5 m over 0.3 s, and 24 embers bursting outward (M9 §5.1).
        this.vfx.ring(now, e.x, e.y, e.z, 0x4aa3e8, 1, 5, 300);
        this.particles.shroudBurst(e.x, e.y, e.z + PLAYER_HEIGHT / 2);
        break;
      case 'silverBullet':
        // Others' Silver Bullets after the render delay; the own one was drawn at once (M9 §5.1).
        if (e.playerId !== this.localId) {
          this.pendingFx.push({
            at: now + this.snaps.delayTicks * TICK_MS,
            run: (t) => {
              const from = this.othersMuzzle(e.playerId) ?? [e.x, e.y, e.z];
              this.silverTracer(t, from, [e.ex, e.ey, e.ez]);
            },
          });
        }
        break;
      case 'gameOver':
        this.onGameOver(e, now);
        break;
    }
  }

  private classOf(playerId: number): ClassId | undefined {
    return this.roster.find((r) => r.id === playerId)?.classId;
  }

  /** The position and yaw of a player: the local one from local movement, others interpolated. */
  private playerPose(playerId: number): { x: number; y: number; z: number; yaw: number } | undefined {
    if (playerId === this.localId) return { ...this.player.body, yaw: this.player.yaw };
    return this.snaps.playersOut.find((q) => q.id === playerId);
  }

  /** 0.5 m in front of another player's body center along its yaw, where its beams and bullets start. */
  private othersMuzzle(playerId: number): [number, number, number] | null {
    const q = this.snaps.playersOut.find((o) => o.id === playerId);
    if (!q) return null;
    return [q.x + Math.cos(q.yaw) * OTHERS_MUZZLE, q.y + Math.sin(q.yaw) * OTHERS_MUZZLE, q.z + PLAYER_HEIGHT / 2];
  }

  /** The Silver Bullet's tracer (M9 §5.1): ember, with a silver-white core drawn over it. */
  private silverTracer(now: number, from: readonly [number, number, number], to: readonly [number, number, number], ember = SILVER_EMBER): void {
    const pts: Array<[number, number, number]> = [[from[0], from[1], from[2]], [to[0], to[1], to[2]]];
    this.vfx.beam(now, pts, ember, SILVER_WIDTH, SILVER_MS);
    this.vfx.beam(now, pts, SILVER_CORE, SILVER_CORE_WIDTH, SILVER_MS);
  }

  /** Ability VFX at the event position (§10). */
  private abilityVfx(e: Extract<GameEvent, { type: 'abilityUsed' }>, now: number): void {
    const cls = this.classOf(e.playerId);
    const key = `${cls}:${e.slot}`;
    const user = this.playerPose(e.playerId);
    switch (key) {
      case 'fallen:Q': // taunt sphere, growing to Blasphemy's radius (M8 §3.1)
        this.vfx.sphere(now, e.x, e.y, e.z + PLAYER_HEIGHT / 2, 0xe0301e, 1, BLASPHEMY_RADIUS, 400, 0.3);
        break;
      case 'fallen:E': // landing shockwave, when the leap lands
        this.vfx.ring(now, e.x, e.y, e.z, 0xf08a24, 0.5, 5, 450, 400);
        this.vfx.glow(now, e.x, e.y, e.z + 0.5, 0xf08a24, 1, 2.5, 450, 400);
        break;
      case 'heretic:Q': {
        // Heal ring, and a heal column on every player it healed, even at full HP (M8 §3.1).
        this.vfx.ring(now, e.x, e.y, e.z, 0x5ee65e, 0.5, 15, 700);
        for (const id of e.targets) {
          const t = this.playerPose(id);
          if (t) this.particles.healColumn(t.x, t.y, t.z);
          if (id === this.localId) this.hud.vignette('green', 0.3, now);
          else this.party?.flash(id, 'green');
        }
        break;
      }
      case 'heretic:E': {
        // A mote flies from the Heretic to the target, then the shield bubble appears; self-cast
        // skips the mote (M8 §3.1).
        const target = e.targets[0];
        const self = target === e.playerId;
        if (!self && user) {
          const h = PLAYER_HEIGHT / 2;
          this.vfx.mote(now, [user.x, user.y, user.z + h], [e.x, e.y, e.z + h], 0xff7a3a, 0.4, MOTE_MS);
        }
        this.vfx.sphere(now, e.x, e.y, e.z + PLAYER_HEIGHT / 2, 0x4aa3e8, 1.3, 1.6, 900, 0.4, self ? 0 : MOTE_MS);
        if (target !== undefined && target !== this.localId) this.party?.flash(target, 'blue');
        break;
      }
      case 'binder:Q': {
        // Chain lines from the cone in front of the Binder to the destination.
        if (!user) break;
        const pts: Array<[number, number, number]> = [];
        for (let i = -3; i <= 3; i++) {
          const a = user.yaw + (i / 3) * (Math.PI / 6);
          const d = 6 + Math.abs(i) * 2;
          pts.push([e.x, e.y, e.z + 0.8], [user.x + Math.cos(a) * d, user.y + Math.sin(a) * d, e.z + 0.8]);
        }
        this.vfx.chain(now, pts, 0.3, 500);
        break;
      }
      case 'binder:E': // grey burst
        this.vfx.smoke(now, e.x, e.y, e.z, 0x8a8f97, 0.5, 8, 700);
        break;
      case 'betrayer:Q':
        this.startField(e, user, now);
        break;
      case 'betrayer:E': // afterimage trail
        for (let i = 0; i < 3; i++) this.afterimages.push({ start: now + i * 60, x: e.x, y: e.y, z: e.z, facing: user?.yaw ?? 0 });
        break;
    }
  }

  /**
   * Field of Blood (M9 §5.1): the pool and its glare at the event's center, replacing any old one, and
   * 30 coins tossed from 0.5 m in front of the Betrayer's body center.
   */
  private startField(e: Extract<GameEvent, { type: 'abilityUsed' }>, user: { x: number; y: number; z: number; yaw: number } | undefined, now: number): void {
    this.pool?.dispose();
    this.pool = new BloodPool(this.map, e.x, e.y, e.z, now);
    this.scene.scene.add(this.pool.group);
    const from: [number, number, number] = user
      ? [user.x + Math.cos(user.yaw) * OTHERS_MUZZLE, user.y + Math.sin(user.yaw) * OTHERS_MUZZLE, user.z + PLAYER_HEIGHT / 2]
      : [e.x, e.y, e.z + PLAYER_HEIGHT / 2];
    for (let i = 0; i < COINS; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = COIN_SPREAD * Math.sqrt(Math.random());
      this.coins.push({ from, to: [e.x + Math.cos(a) * r, e.y + Math.sin(a) * r, e.z + 0.05], start: now });
    }
  }

  /**
   * The pool's life, its embers and the local player standing in it (M9 §5.1): computed from the own
   * predicted position, so the feedback and the local fire timer change the moment they step in or out.
   */
  private updateField(now: number, dt: number): void {
    const pool = this.pool;
    if (pool && !pool.update(now)) {
      pool.dispose();
      this.pool = null;
    }
    const p = this.pool;
    if (p && p.cells.length && Math.random() < POOL_EMBERS_PER_S * dt) {
      const [c, r] = p.cells[Math.floor(Math.random() * p.cells.length)];
      const x = c + Math.random();
      const y = r + Math.random();
      if (Math.hypot(x - p.x, y - p.y) <= 5.6 * p.scale(now)) this.particles.bloodEmber(x, y, this.map.floor[r * this.map.w + c] + 0.05);
    }
    const b = this.player.body;
    const inside = !!p && !this.dead && inField(this.map, p.x, p.y, p.z, b.x, b.y);
    if (inside && !this.inFieldNow) this.sounds.fieldEntered();
    this.inFieldNow = inside;
    this.hud.setInField(inside, now);
  }

  private onGameOver(e: Extract<GameEvent, { type: 'gameOver' }>, now: number): void {
    if (this.over) return;
    this.resultAt = now;
    debugState.gameResult = e.result;
    this.resultData = {
      result: e.result,
      timeMs: e.timeMs,
      kills: Object.entries(e.kills).map(([id, kills]) => ({ name: this.roster.find((r) => r.id === Number(id))?.name ?? `Player ${id}`, kills })),
    };
    this.hud.showResult(e.result === 'victory' ? 'Victory' : 'Defeat');
    this.hud.closeHints();
    this.closeChat();
    this.closePause();
    // At the result, pointer lock is released and input stops.
    this.input.release();
    this.input.enabled = false;
    if (document.pointerLockElement) document.exitPointerLock();
  }

  private onSnapshot(s: Snapshot, prev: Snapshot | null): void {
    const now = performance.now();
    // Doors follow from arenaIndex and arenaPhase (§8.2).
    for (let ai = 0; ai < this.map.arenas.length; ai++) {
      const phase = arenaPhaseOf(ai, s.arenaIndex, s.arenaPhase);
      if (phase !== this.doorPhase[ai]) {
        this.doorPhase[ai] = phase;
        setArenaDoors(this.map, ai, phase);
        const closed = doorsClosed(phase);
        this.scene.setDoorsClosed(ai, closed.entry, closed.exit);
      }
    }
    this.souls.update(s.players, now);
    const me = s.players.find((p) => p.id === this.localId);
    const was = prev?.players.find((p) => p.id === this.localId);
    // Healed by a Sacrament beam: its heals neither flash nor chime (M9 §5.1).
    const beamed = s.players.some((p) => p.beam === this.localId) || !!prev?.players.some((p) => p.beam === this.localId);
    if (me) {
      // First seen already dead: joined during a fight, as a soul (M8 §6.2).
      if (!this.seenSelf && me.dead) this.joinedAsSoul = true;
      this.seenSelf = true;
      if (me.dead !== this.dead) {
        this.dead = me.dead;
        if (this.dead) this.input.release();
        else this.joinedAsSoul = false;
        // The dead player's screen (M8 §4.5): a soul that joined gets an ember vignette instead of the
        // grey; outside the boss arena, clearing it also brings back a player who fell.
        this.canvas.classList.toggle('dead', this.dead && !this.joinedAsSoul);
        const boss = this.map.arenas[s.arenaIndex]?.boss;
        if (!this.dead) this.hud.setDeath(null);
        else if (this.joinedAsSoul) this.hud.setDeath('Your party must revive you to join the fight', null, true);
        else this.hud.setDeath('You have fallen — your party can revive you', boss ? null : 'or you rise when the arena is cleared');
      }
      if (this.dead) {
        this.ownGround = me.z;
        const progress = me.revive / 255;
        // Being revived: the hum plays while the progress rises.
        if (progress > this.ownRevive + 1e-6) this.reviveRisingAt = now;
        this.ownRevive = progress;
        this.hud.setOwnRevive(progress);
      } else this.ownRevive = 0;
      this.hud.setHp(me.hp, me.shield, this.maxHp);
      if (was) {
        const lost = was.hp + was.shield - (me.hp + me.shield);
        if (lost > 0 && !me.dead) {
          this.hud.vignette('red', Math.min(0.8, Math.max(0.2, (lost / this.maxHp) * 3)), now);
          this.hud.shakeHp(now);
        } else if (me.hp > was.hp && !was.dead && !beamed) this.hud.vignette('green', 0.3, now);
        if ((me.shield > 0 && me.shield > was.shield) || (was.shield > 0 && me.shield === 0)) this.hud.vignette('blue', 0.5, now);
        if (me.kills > was.kills) {
          this.hud.kill(now);
          this.sounds.kill();
        }
      }
    }
    // Hurt flashes, and bursts for enemies and censers that disappeared.
    for (let i = 0; i < s.enemyCount; i++) {
      if (!(s.enemyFlags[i] & FLAG_HURT)) continue;
      if (now - this.flashAt[s.enemySlot[i]] >= ENEMY_FLASH_GAP_MS) this.flashAt[s.enemySlot[i]] = now;
      if (this.o.enemyAnims[s.enemyType[i]]?.anims.pain) this.animator.hurt(s.enemySlot[i], now);
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
        this.pendingBursts.push({ at: now + delay, censer: false, type, x: prev.enemyX[i], y: prev.enemyY[i], z });
        if (this.o.enemyAnims[type]?.anims.death) {
          const ground = g === -Infinity ? 0 : g;
          // A Cherub falls from its hover height to the ground while it dies (§11.1).
          const fallFrom = type === CHERUB ? ground + CHERUB_HOVER : undefined;
          this.corpses.push({ start: now + delay, x: prev.enemyX[i], y: prev.enemyY[i], z: ground, facing: this.animator.facing[slot], type, fallFrom });
          if (this.corpses.length > MAX_CORPSES) this.corpses.shift();
        }
      }
      const alive = new Set(s.projSlot.subarray(0, s.projectileCount));
      for (let i = 0; i < prev.projectileCount; i++) {
        if (prev.projKind[i] !== PROJ_CENSER || alive.has(prev.projSlot[i])) continue;
        this.pendingBursts.push({ at: now + delay, censer: true, type: -1, x: prev.projX[i], y: prev.projY[i], z: prev.projZ[i] });
      }
    }
    // Others' Scourge swings, after the render delay, spread over the time to the next snapshot (M9 §5.1).
    if (prev) {
      const delay = this.snaps.delayTicks * TICK_MS;
      const gap = (s.tick - prev.tick) * TICK_MS;
      for (const p of s.players) {
        if (p.id === this.localId || p.dead || this.classOf(p.id) !== 'binder') continue;
        const w = prev.players.find((q) => q.id === p.id);
        const n = w ? (p.shots2 - w.shots2) & 0xff : 0;
        for (let i = 0; i < n; i++) {
          this.pendingFx.push({
            at: now + delay + (i * gap) / n,
            run: (t) => {
              const q = this.snaps.playersOut.find((o) => o.id === p.id);
              if (q) this.vfx.scourgeArc(t, q.x, q.y, q.z, q.yaw);
            },
          });
        }
      }
    }
    this.countShots(s);
    debugState.lastSnapshotTick = s.tick;
    debugState.enemies = s.enemyCount;
    debugState.projectiles = s.projectileCount;
    debugState.arenaIndex = s.arenaIndex;
    debugState.arenaPhase = s.arenaPhase === PHASE_COMBAT ? 'combat' : s.arenaPhase === PHASE_CLEARED ? 'cleared' : s.arenaPhase === PHASE_COUNTDOWN ? 'countdown' : 'idle';
    debugState.countdown = s.arenaPhase === PHASE_COUNTDOWN ? s.countdown / 10 : 0;
    this.hud.setCountdown(s.arenaPhase === PHASE_COUNTDOWN ? s.countdown / 10 : null);
    debugState.enemyCountsByTick = Object.fromEntries(this.snaps.enemyCountsByTick);
    debugState.players = s.players.map((p) => ({
      id: p.id,
      classId: this.classOf(p.id) ?? '',
      hp: p.hp,
      dead: p.dead,
      kills: p.kills,
      revive: p.revive / 255,
      primaryShots: this.shotCounts.get(p.id)?.n ?? 0,
      secondaryShots: this.shotCounts.get(p.id)?.n2 ?? 0,
    }));
    this.party?.set(
      s.players
        .filter((p) => p.id !== this.localId)
        .flatMap((p) => {
          const r = this.roster.find((q) => q.id === p.id);
          return r ? [{ id: p.id, name: r.name, classId: r.classId, hp: p.hp, shield: p.shield, dead: p.dead, revive: p.revive / 255 }] : [];
        }),
    );
    this.hud.setRemaining(s.arenaPhase === PHASE_COMBAT ? s.enemiesRemaining : null);
    this.hud.setBoss(s.bossHp, s.bossMaxHp, s.bossCast === BOSS_CAST_JUDGMENT ? s.bossCastProgress / 255 : null);
    this.bossCast = s.bossCast;
    this.bossCastProgress = s.bossCastProgress / 255;
    this.bench?.onSnapshot(s);
    this.sounds.snapshot(s, prev, beamed);
  }

  /** Unwraps each player's `shots` and `shots2` counters into totals, for the debug object (M9 §10). */
  private countShots(s: Snapshot): void {
    for (const p of s.players) {
      const c = this.shotCounts.get(p.id);
      // A player first seen starts from the counters' own values.
      if (!c) this.shotCounts.set(p.id, { raw: p.shots, raw2: p.shots2, n: p.shots, n2: p.shots2 });
      else {
        c.n += (p.shots - c.raw) & 0xff;
        c.n2 += (p.shots2 - c.raw2) & 0xff;
        c.raw = p.shots;
        c.raw2 = p.shots2;
      }
    }
  }

  /** How fast the local fire timer counts down: 2 in a Field of Blood (M9 §2.2, §3.4). */
  private localFireRate(): number {
    return this.inFieldNow ? FIELD_FIRE_RATE : 1;
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
   * Ally target (M8 §3.5): acquired at 15°, kept at 25°, within the E ability's range and in line of
   * sight; and the out-of-range ally for the grey chevron. Only the Fallen and the Heretic Saint use one.
   */
  private computeAllyTarget(): void {
    const range = ABILITIES[this.classId].E.allyRange;
    if (range <= 0 || this.dead) {
      this.allyTargetId = ALLY_NONE;
      this.allyOutOfRange = ALLY_NONE;
      return;
    }
    const p = this.player;
    const [ax, ay, az] = aimDir(p.yaw, p.pitch);
    const others = this.snaps.playersOut.filter((q) => q.id !== this.localId);
    const r = pickAllyTarget(this.map, p.body.x, p.body.y, p.body.z + PLAYER_EYE, ax, ay, az, others, range, this.allyTargetId);
    this.allyTargetId = r.target;
    this.allyOutOfRange = r.outOfRange;
  }

  /** The gold chevron over the ally target, or the grey one over an ally out of range (M8 §3.5). */
  private placeChevron(): void {
    const id = this.allyTargetId !== ALLY_NONE ? this.allyTargetId : this.allyOutOfRange;
    const q = id === ALLY_NONE ? undefined : this.snaps.playersOut.find((o) => o.id === id);
    const at = q ? this.project(q.x, q.y, q.z + CHEVRON_HEIGHT) : null;
    if (!at) this.hud.setChevron(null);
    else this.hud.setChevron(id === this.allyTargetId ? 'gold' : 'grey', at[0], at[1]);
  }

  /**
   * Soul markers (M8 §4.1): shown to a living player for teammates' souls within 60 m in front of the
   * camera, 2.2 m above the soul's base, drawn over everything.
   */
  private placeSoulMarkers(now: number): void {
    const list: Array<{ id: number; classId: ClassId; x: number; y: number; progress: number }> = [];
    const newest = this.snaps.newest;
    if (!this.dead && newest) {
      const me = this.player.body;
      for (const q of this.snaps.playersOut) {
        if (q.id === this.localId || !q.dead) continue;
        const cls = this.classOf(q.id);
        if (!cls || Math.hypot(q.x - me.x, q.y - me.y) > SOUL_MARKER_RANGE) continue;
        const at = this.project(q.x, q.y, q.z + this.souls.drawnRise(q.id, now) + SOUL_MARKER_HEIGHT);
        if (!at) continue;
        const rec = newest.players.find((r) => r.id === q.id);
        list.push({ id: q.id, classId: cls, x: at[0], y: at[1], progress: (rec?.revive ?? 0) / 255 });
      }
    }
    this.hud.setSoulMarkers(list);
  }

  /** The revive hum (M8 §9.1): while a shot hits a soul or the player is being revived, rising in pitch with the progress. */
  private updateReviveHum(now: number): void {
    const a = audio();
    let progress = -1;
    if (this.dead && now - this.reviveRisingAt < HUM_HOLD_MS + 100) progress = this.ownRevive;
    else if (!this.dead && now - this.soulHitAt < HUM_HOLD_MS) {
      const rec = this.snaps.newest?.players.find((r) => r.id === this.soulHitId);
      if (rec?.dead) progress = rec.revive / 255;
    }
    if (progress < 0 || !a || this.over) {
      this.hum?.stop();
      this.hum = null;
      return;
    }
    this.hum ??= a.loop('reviveHum');
    this.hum.setRate(0.8 + 0.8 * progress);
  }

  private readonly projScratch = new THREE.Vector3();

  /** A world point (simulation coordinates) on screen in CSS pixels, or null if behind the camera. */
  private project(x: number, y: number, z: number): [number, number] | null {
    const v = this.projScratch.set(x, z, y).applyMatrix4(this.scene.camera.matrixWorldInverse);
    // The camera looks along its local -z.
    if (v.z > -this.scene.camera.near) return null;
    v.applyMatrix4(this.scene.camera.projectionMatrix);
    return [((v.x + 1) / 2) * window.innerWidth, ((1 - v.y) / 2) * window.innerHeight];
  }

  /**
   * Cosmetic attack feedback, local and immediate (§10, M9 §5.1): muzzle flash and recoil; hitscan
   * attacks also draw a tracer per pellet to where the local ray stops, and show a hit marker when it
   * hits an interpolated enemy. The Silver Bullet draws its estimated tracer, the Scourge its arc and
   * swing; Sacrament's beam is drawn every frame instead.
   */
  private cosmeticShot(now: number, slot: AttackSlot, ents: InterpolatedEnemies, enemyZ: Float32Array): void {
    const w = attackDef(this.classId, slot);
    const secondary = slot === ATTACK_SECONDARY;
    const p = this.player;
    const ex = p.body.x;
    const ey = p.body.y;
    const ez = p.body.z + PLAYER_EYE;
    switch (w.kind) {
      case 'sacrament': {
        // The chime plays at the healed ally (M9 §5.2).
        const ally = this.snaps.playersOut.find((q) => q.id === this.allyTargetId);
        this.sounds.ownShot(this.classId, true, ally ?? null);
        return;
      }
      case 'scourge': {
        this.hud.swing(now);
        this.sounds.ownShot(this.classId, true);
        this.vfx.scourgeArc(now, p.body.x, p.body.y, p.body.z, p.yaw);
        if (this.scourgeHits(ents, enemyZ)) {
          this.hud.hit(now);
          this.sounds.hit();
        }
        return;
      }
      case 'censer':
        this.hud.shot(now, w.interval * 1000);
        this.sounds.ownShot(this.classId, secondary);
        return;
    }
    const heavy = w.kind === 'silverBullet' ? SILVER_RECOIL : secondary ? SLUG_RECOIL : undefined;
    this.hud.shot(now, w.interval * 1000, heavy, secondary && w.kind === 'hitscan' ? SLUG_FLASH : 1);
    this.sounds.ownShot(this.classId, secondary);
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
      const ts: Array<{ t: number; i: number }> = [];
      for (let i = 0; i < ents.count; i++) {
        const def = ENEMIES[ents.type[i]];
        const t = rayCylinder(ex, ey, ez, dx, dy, dz, ents.x[i], ents.y[i], enemyZ[i], def.radius, def.height);
        if (t <= stop) ts.push({ t, i });
      }
      ts.sort((a, b) => a.t - b.t);
      let end = stop;
      if (ts.length > 0) {
        hit = true;
        if (w.kind === 'silverBullet') {
          // An estimate (M9 §5.1): every enemy at its type's full HP, doubled for the rooted flag.
          const r = estimateSilverBullet(
            ts.map(({ i }) => ({ type: ents.type[i], rooted: (ents.flags[i] & FLAG_ROOTED) !== 0 })),
            w.damage,
          );
          if (r.stopped) end = ts[r.reached - 1].t;
        } else if (ts.length >= w.maxHits) end = ts[w.maxHits - 1].t;
      }
      // A shot through a teammate's soul (for the revive hum).
      for (const q of this.snaps.playersOut) {
        if (q.id === this.localId || !q.dead) continue;
        if (rayCylinder(ex, ey, ez, dx, dy, dz, q.x, q.y, q.z + this.souls.rise(q.id, now), SOUL_RADIUS, SOUL_HEIGHT) <= end) {
          this.soulHitAt = now;
          this.soulHitId = q.id;
        }
      }
      pts.push([mx, my, mz], [ex + dx * end, ey + dy * end, ez + dz * end]);
    }
    if (w.kind === 'silverBullet') this.silverTracer(now, pts[0], pts[1], this.inFieldNow ? BLOOD_TRACER : SILVER_EMBER);
    else this.vfx.beam(now, pts, this.inFieldNow ? BLOOD_TRACER : TRACER_COLOR, secondary ? SLUG_TRACER_WIDTH : TRACER_WIDTH, TRACER_MS);
    if (hit) {
      this.hud.hit(now);
      this.sounds.hit();
    }
  }

  /** Whether a local Scourge swing would hit an interpolated enemy: within 3 m and the 120° arc (M9 §2.6). */
  private scourgeHits(ents: InterpolatedEnemies, enemyZ: Float32Array): boolean {
    const p = this.player;
    const w = SECONDARIES.binder;
    const cz = p.body.z + PLAYER_HEIGHT / 2;
    const cosMax = Math.cos(SCOURGE_HALF_ARC);
    for (let i = 0; i < ents.count; i++) {
      const def = ENEMIES[ents.type[i]];
      if (distToCylinder(p.body.x, p.body.y, cz, ents.x[i], ents.y[i], enemyZ[i], def.radius, def.height) > w.range) continue;
      const hx = ents.x[i] - p.body.x;
      const hy = ents.y[i] - p.body.y;
      const len = Math.hypot(hx, hy);
      if (len < 1e-9 || (hx * Math.cos(p.yaw) + hy * Math.sin(p.yaw)) / len >= cosMax - 1e-9) return true;
    }
    return false;
  }

  /**
   * Sacrament's beams (M9 §5.1), every frame: the own one from the first-person muzzle while the
   * secondary heals the local ally target; others' from their snapshot `beam`, starting 0.5 m in front
   * of their body center. Embers drift along each toward the ally. Returns the players beamed.
   */
  private drawHealBeams(now: number, dt: number): Set<number> {
    const beams: Array<[[number, number, number], [number, number, number]]> = [];
    const beamed = new Set<number>();
    const bodyOf = (id: number): [number, number, number] | null => {
      if (id === this.localId) return this.dead ? null : [this.player.body.x, this.player.body.y, this.player.body.z + PLAYER_HEIGHT / 2];
      const q = this.snaps.playersOut.find((o) => o.id === id);
      return q && !q.dead ? [q.x, q.y, q.z + PLAYER_HEIGHT / 2] : null;
    };
    if (this.classId === 'heretic' && this.attack === ATTACK_SECONDARY && !this.dead) {
      const to = bodyOf(this.allyTargetId);
      if (to) {
        const [sx, sy] = this.hud.muzzlePoint(now);
        beams.push([this.unproject(sx, sy, OWN_BEAM_DEPTH), to]);
        beamed.add(this.allyTargetId);
      }
    }
    for (const q of this.snaps.playersOut) {
      if (q.id === this.localId || q.dead || q.beam === ALLY_NONE) continue;
      const from = this.othersMuzzle(q.id);
      const to = bodyOf(q.beam);
      if (!from || !to) continue;
      beams.push([from, to]);
      beamed.add(q.beam);
    }
    this.vfx.setLiveBeams(beams, this.scene.camera.position);
    for (const [a, b] of beams) {
      if (Math.random() >= BEAM_EMBERS_PER_S * dt) continue;
      const d = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      if (d < 1e-3) continue;
      const v = BEAM_EMBER_SPEED / d;
      this.particles.beamEmber(a[0], a[1], a[2], (b[0] - a[0]) * v, (b[1] - a[1]) * v, (b[2] - a[2]) * v, d / BEAM_EMBER_SPEED);
    }
    return beamed;
  }

  /** The world point (simulation coordinates) `depth` meters in front of the camera under a screen point in CSS pixels. */
  private unproject(px: number, py: number, depth: number): [number, number, number] {
    const cam = this.scene.camera;
    const v = this.projScratch.set((px / window.innerWidth) * 2 - 1, 1 - (py / window.innerHeight) * 2, 0.5).unproject(cam).sub(cam.position).normalize();
    // `depth` along the view axis, not along the ray.
    const fwd = cam.getWorldDirection(this.fwdScratch);
    const s = depth / Math.max(0.1, v.dot(fwd));
    return [cam.position.x + v.x * s, cam.position.z + v.z * s, cam.position.y + v.y * s];
  }

  private readonly fwdScratch = new THREE.Vector3();

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

    // While singleplayer is paused, the simulation's clock stands still at the moment Pause opened.
    const simNow = this.paused && this.o.singleplayer ? this.pausedAt : now;
    // Enemies at the render time, and their derived heights.
    const ents = this.snaps.interpolate(simNow);
    const enemyZ = this.enemyHeights(ents, dt);
    this.computeAllyTarget();
    this.party?.setAllyTarget(this.allyTargetId);

    let mx = 0;
    let my = 0;
    let wantJump = false;
    let fire = 0;
    if (this.over || this.paused) {
      // The result overlay or Pause: the game keeps rendering without input.
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
        // A client's bot follows the host's player (§2.5).
        hostPlayer: this.o.host ? null : (this.snaps.playersOut.find((q) => q.id === 0) ?? null),
        qReady: this.displayedCooldown('Q', now) <= 0,
        eReady: this.displayedCooldown('E', now) <= 0,
        blockedLastFrame: p.moveResult.blocked,
        entryIndex: this.entryIndex,
        souls: this.snaps.playersOut.filter((q) => q.dead && q.id !== this.localId),
        classId: this.classId,
        teammates: this.snaps.playersOut.flatMap((q) => {
          const cls = this.classOf(q.id);
          const rec = s?.players.find((r) => r.id === q.id);
          if (q.id === this.localId || q.dead || !cls || !rec) return [];
          return [{ x: q.x, y: q.y, z: q.z, hpFrac: rec.hp / CLASSES[cls].hp }];
        }),
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
      fire = this.input.fireBits();
    } else {
      // Dead: the camera can only rotate.
      const { dx, dy } = this.input.takeMouse();
      p.look(dx * MOUSE_SENSITIVITY, -dy * MOUSE_SENSITIVITY);
    }
    this.input.jumpQueued = false;
    this.fire = this.dead || this.over ? 0 : fire;
    const bx = p.body.x;
    const by = p.body.y;
    if (!this.dead && !this.bench && !this.over) p.update(this.map, dt, mx, my, wantJump);
    this.bob.update(Math.min(dt, MAX_FRAME_DT), Math.hypot(p.body.x - bx, p.body.y - by), p.speed, p.body.grounded && !p.leaping, this.dead);
    this.hud.setBob(this.bob.weaponX, this.bob.weaponY);

    // The cosmetic fire timer, at 30 Hz like the host's, with the same choice of attack (M9 §2.1,
    // §2.2); Sacrament can fire while there's a local ally target.
    this.attack = chooseAttack(this.classId, this.fire, this.allyTargetId !== ALLY_NONE);
    this.fireAcc = Math.min(this.fireAcc + dt, 5 * TICK_DT);
    while (this.fireAcc >= TICK_DT) {
      this.fireAcc -= TICK_DT;
      if (this.attack !== ATTACK_NONE && this.fireTimer <= 1e-6) {
        this.cosmeticShot(now, this.attack, ents, enemyZ);
        this.fireTimer += attackDef(this.classId, this.attack).interval;
      }
      this.fireTimer -= TICK_DT * this.localFireRate();
      if (this.attack === ATTACK_NONE && this.fireTimer < 0) this.fireTimer = 0;
    }

    // Input to the host at 30 Hz.
    this.inputAcc += dt;
    if (this.inputAcc >= TICK_DT && !this.over) {
      this.inputAcc = Math.min(this.inputAcc - TICK_DT, TICK_DT);
      this.sendInput();
    }

    // Bursts whose time has come.
    for (let i = this.pendingBursts.length - 1; i >= 0; i--) {
      const b = this.pendingBursts[i];
      if (now < b.at) continue;
      if (b.censer) {
        this.particles.emberBurst(b.x, b.y, b.z);
        this.vfx.glow(now, b.x, b.y, b.z, 0xf08a24, 0.6, 2, 350);
        this.sounds.censerBurst(b);
      } else {
        this.particles.featherBurst(b.x, b.y, b.z);
        this.sounds.enemyDeath(b.type, b);
      }
      this.pendingBursts.splice(i, 1);
    }
    for (let i = this.pendingFx.length - 1; i >= 0; i--) {
      if (now < this.pendingFx[i].at) continue;
      const fx = this.pendingFx[i];
      this.pendingFx.splice(i, 1);
      fx.run(now);
    }
    this.updateField(now, Math.min(dt, MAX_FRAME_DT));
    this.particles.update(dt);
    this.vfx.update(now, this.scene.camera.position);

    const b = p.body;
    audio()?.setListener(b.x, b.y, p.yaw);
    // The bob only lowers the drawn view; aiming and input use the unbobbed eye (M8 §3.4). While dead,
    // the camera rises with the soul: 1.6 m above its base (M8 §4.3).
    if (this.dead) this.scene.setView(b.x, b.y, this.ownGround, p.yaw, p.pitch, PLAYER_EYE + this.souls.rise(this.localId, now));
    else this.scene.setView(b.x, b.y, b.z, p.yaw, p.pitch, PLAYER_EYE - this.bob.eyeDrop);
    this.drawBillboards(now, ents, enemyZ);
    const beamed = this.drawHealBeams(now, Math.min(dt, MAX_FRAME_DT));
    this.hud.setBeamed(beamed.has(this.localId));
    this.party?.setBeamed(beamed);
    this.scene.render();
    this.placeChevron();
    this.placeSoulMarkers(now);
    this.updateReviveHum(now);

    this.hud.setCooldowns(this.displayedCooldown('Q', simNow), ABILITIES[this.classId].Q.cooldown, this.displayedCooldown('E', simNow), ABILITIES[this.classId].E.cooldown);
    this.hud.update(now);
    debugState.fps = this.fps.frame(now);
    debugState.simMs = this.o.host ? this.o.host.simMs(now) : 0;
    debugState.netInKBps = this.o.net ? this.o.net.inKBps(now) : 0;
    debugState.netOutKBps = this.o.net ? this.o.net.outKBps(now) : 0;
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
    bb.begin();
    for (const b of this.enemyBillboards.values()) b.begin();
    for (const b of this.playerBillboards.values()) b.begin();
    const chain = this.frames['chain-ring'];
    const taunt = this.frames.taunt;
    const eye = this.player.body;
    const dt = Math.min(0.1, (now - this.lastAnimAt) / 1000);
    this.lastAnimAt = now;
    this.animator.begin();
    this.judgmentGlow.visible = false;
    for (let i = 0; i < ents.count; i++) {
      const type = ents.type[i];
      const set = this.o.enemyAnims[type];
      if (!set) continue;
      // Direction and frame of the animated sprite (§11.1).
      const slot = ents.slot[i];
      const x = ents.x[i];
      const y = ents.y[i];
      const t = this.nearestPlayer(x, y);
      this.animator.update(slot, x, y, ents.state[i], now, dt, t.x, t.y, type);
      const pick = this.animator.pick(slot, now, this.bossCast);
      const f = set.anims[pick.anim][spriteDirection(this.animator.facing[slot], eye.x - x, eye.y - y)][pick.frame];
      const height = f.height;
      const target = this.enemyBillboards.get(type)!;
      const def = ENEMIES[type];
      const flags = ents.flags[i];
      // Launched by a Falling Star: the billboard flies an arc, peaking 1 m up halfway (M9 §3.2).
      const lu = (now - this.launchAt[slot]) / LAUNCH_MS;
      const z = enemyZ[i] + (lu >= 0 && lu < 1 ? 4 * LAUNCH_HEIGHT * lu * (1 - lu) : 0);
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
        // In front of the Gatekeeper's billboard, toward the camera, so it glows over it.
        const c = this.glowCenter.set(ents.x[i], enemyZ[i] + def.height / 2, ents.y[i]);
        const toCam = this.glowToCam.subVectors(this.scene.camera.position, c).normalize();
        this.judgmentGlow.position.copy(c).addScaledVector(toCam, def.radius);
        this.judgmentGlow.scale.setScalar(2.4 * r);
        this.judgmentGlow.material.opacity = 0.25 + 0.5 * t;
      }
      const flashT = now - this.flashAt[ents.slot[i]];
      if (flashT < ENEMY_FLASH_MS) {
        this.flashGlow.a = ENEMY_FLASH_PEAK * (1 - flashT / ENEMY_FLASH_MS);
        glow = this.flashGlow;
      } else if (judgment) glow = judgment;
      else if (ents.state[i] === ST_WINDUP) glow = GLOW_WINDUP;
      const grey = (flags & FLAG_SILENCED) !== 0;
      target.add(f, ents.x[i], ents.y[i], z, height, false, grey ? 0.55 : 1, grey ? 0.55 : 1, grey ? 0.6 : 1, glow);
      if (flags & FLAG_ROOTED) bb.add(chain, ents.x[i], ents.y[i], z + 0.25, Math.max(0.45, def.radius * 1.1), true);
      // Taunted: the `!` pops in, holds and fades, then stays hidden for the rest of the taunt.
      if (flags & FLAG_TAUNTED) {
        if (this.tauntAt[slot] < 0) this.tauntAt[slot] = now;
        const t = now - this.tauntAt[slot];
        if (t < TAUNT_POP_MS + TAUNT_HOLD_MS + TAUNT_FADE_MS) {
          // Scale 0 → 1.2 → 1 over the pop, then opacity 1 → 0 over the fade.
          const pop = t / TAUNT_POP_MS;
          const scale = pop >= 1 ? 1 : pop < 2 / 3 ? 1.8 * pop : 1.2 - 0.6 * (pop - 2 / 3);
          const alpha = Math.min(1, 1 - (t - TAUNT_POP_MS - TAUNT_HOLD_MS) / TAUNT_FADE_MS);
          if (scale > 0.01) bb.add(taunt, ents.x[i], ents.y[i], z + def.height + TAUNT_MARK_GAP, TAUNT_MARK_HEIGHT * scale, false, 1, 1, 1, NO_GLOW, alpha);
        }
      } else this.tauntAt[slot] = -1;
    }
    // Corpses: the death animation, then lying still, then sinking into the floor (the
    // Gatekeeper's stays). They are in order of death, so the expired ones lead the list; a
    // corpse that stays stops the count, keeping it from being removed.
    let gone = 0;
    let leading = true;
    for (const c of this.corpses) {
      const cf = corpseFrame(c, now);
      if (!cf) {
        if (leading && now >= c.start) gone++;
        continue;
      }
      leading = false;
      const af = this.o.enemyAnims[c.type]!.anims.death[spriteDirection(c.facing, eye.x - c.x, eye.y - c.y)][cf.frame];
      this.enemyBillboards.get(c.type)!.add(af, c.x, c.y, c.z - cf.sink, af.height, false);
    }
    if (gone) this.corpses.splice(0, gone);
    const proj = this.snaps.projOut;
    for (let i = 0; i < proj.count; i++) {
      const k = proj.kind[i];
      bb.add(this.frames[PROJECTILE_SPRITES[k]], proj.x[i], proj.y[i], proj.z[i], PROJECTILE_SIZES[k], true);
    }
    // Other players, facing their yaw (§11.1); the ally target is tinted gold (§10).
    this.playerAnimator.begin();
    const tethers: Array<[number, number, number, number]> = [];
    for (const q of this.snaps.playersOut) {
      if (q.id === this.localId) continue;
      const cls = this.classOf(q.id);
      const set = cls && this.o.players[cls];
      const pb = cls && this.playerBillboards.get(cls);
      if (!set || !pb) continue;
      if (q.dead) {
        // The soul (M8 §4.1): the idle frame, ember-tinted at 55% opacity, floating over its ground
        // point with a tether down to it, and embers rising from it.
        const base = q.z + this.souls.drawnRise(q.id, now);
        const sf = set.anims.idle[spriteDirection(q.yaw, eye.x - q.x, eye.y - q.y)][0];
        pb.add(sf, q.x, q.y, base, sf.height, false, 1, 1, 1, GLOW_SOUL, SOUL_OPACITY);
        tethers.push([q.x, q.y, q.z, base]);
        if (Math.random() < SOUL_EMBERS_PER_S * dt) this.particles.soulEmber(q.x, q.y, base + 0.4 + Math.random() * 1.2);
        continue;
      }
      this.playerAnimator.update(q.id, q.x, q.y, dt);
      const pick = this.playerAnimator.pick(q.id);
      const pf = set.anims[pick.anim][spriteDirection(q.yaw, eye.x - q.x, eye.y - q.y)][pick.frame];
      pb.add(pf, q.x, q.y, q.z, pf.height, false, 1, 1, 1, q.id === this.allyTargetId ? GLOW_ALLY : NO_GLOW);
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
      const betrayer = this.o.players.betrayer;
      const ab = this.playerBillboards.get('betrayer');
      if (t < 0 || !betrayer || !ab) continue;
      const g = this.glowScratch;
      g.r = 0.1;
      g.g = 0.05;
      g.b = 0.05;
      g.a = 0.4 + 0.5 * t;
      const af = betrayer.anims.idle[spriteDirection(a.facing, eye.x - a.x, eye.y - a.y)][0];
      ab.add(af, a.x, a.y, a.z, af.height * (1 - 0.3 * t), false, 1, 1, 1, g);
    }
    // Field of Blood's coins in flight; each vanishes into the pool with a silver glint (M9 §5.1).
    for (let i = this.coins.length - 1; i >= 0; i--) {
      const c = this.coins[i];
      const u = (now - c.start) / COIN_MS;
      if (u >= 1) {
        this.vfx.glow(now, c.to[0], c.to[1], c.to[2] + 0.05, 0xe8eef8, 0.06, 0.2, 150);
        this.coins.splice(i, 1);
        continue;
      }
      const x = c.from[0] + (c.to[0] - c.from[0]) * u;
      const y = c.from[1] + (c.to[1] - c.from[1]) * u;
      const cz = c.from[2] + (c.to[2] - c.from[2]) * u + 4 * COIN_ARC * u * (1 - u);
      bb.add(this.frames.coin, x, y, cz, COIN_SIZE, true);
    }
    this.vfx.setTethers(tethers);
    this.particles.draw(bb);
    bb.end(this.scene.camera);
    for (const b of this.enemyBillboards.values()) b.end(this.scene.camera);
    for (const b of this.playerBillboards.values()) b.end(this.scene.camera);
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
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (document.pointerLockElement) document.exitPointerLock();
    this.input.dispose();
    this.overlay.dispose();
    this.pause.dispose();
    this.party?.dispose();
    this.sounds.dispose();
    this.pool?.dispose();
    this.hum?.stop();
    this.hud.dispose();
    this.bench?.dispose();
    this.scene.dispose();
    this.o.root.replaceChildren();
  }
}
