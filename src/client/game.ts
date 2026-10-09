/** The in-game client: input or bot, local movement, snapshots, interpolation, rendering and feedback. */
import { CLASSES, type ClassId } from '../data/classes';
import { DECOR, decorSprite } from '../data/decor';
import * as THREE from 'three';
import { CHERUB, CHERUB_CLIMB, CHERUB_HOVER, CHORISTER, ENEMIES, GATEKEEPER, LAUNCH_HEIGHT, ST_WINDUP } from '../data/enemies';
import {
  ABILITIES,
  ATTACK_NONE,
  ATTACK_PRIMARY,
  ATTACK_SECONDARY,
  attackDef,
  BLASPHEMY_RADIUS,
  CHAINS_ANGLE,
  CHAINS_MAX,
  CHAINS_RANGE,
  chooseAttack,
  DISCORD_HALF_ANGLE,
  DISCORD_RANGE,
  FALLING_STAR_RADIUS,
  FIRE_RIGHT,
  FIRE_RIGHT_LAST,
  SCOURGE_HALF_ARC,
  SECONDARIES,
  SHADOWSTEP_TIME,
  SHOTGUN_KNOCKBACK_RANGE,
  SHROUD_BURST_RADIUS,
  type AttackSlot,
} from '../data/weapons';
import { debugState } from '../debug';
import type { CtrlMessage, GameEvent, LobbyPlayer } from '../net/messages';
import type { NetStats } from '../net/netStats';
import { ALLY_NONE, encodeInput, FLAG_HURT, FLAG_ROOTED, FLAG_SILENCED, FLAG_STUNNED, FLAG_TAUNTED, PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN, type Snapshot } from '../net/protocol';
import type { Transport } from '../net/transport';
import type { Params } from '../params';
import { aimDir, estimateSilverBullet, rayCylinder } from '../sim/combat';
import { ENEMY_SLOTS, PLAYER_EYE, PLAYER_HEIGHT, PROJECTILE_SLOTS, TICK_DT, TICK_MS } from '../sim/constants';
import { raycastTerrain } from '../sim/los';
import { arenaPhaseOf, doorsClosed, overVoid, setArenaDoors, type GameMap } from '../sim/map';
import { distToCylinder, groundHeight } from '../sim/movement';
import { BOSS_CAST_JUDGMENT, GLOBE_BLAST, GLOBE_SHOT_BLAST, PROJ_ARROW, PROJ_CENSER, PROJ_GLOBE } from '../sim/sim';
import type { EnemyAnimSet, PlayerAnimSet } from '../render/animAtlas';
import type { Atlas, SpriteFrame } from '../render/atlas';
import { Billboards, NO_GLOW, type Glow } from '../render/billboards';
import { ContactShadows } from '../render/contactShadows';
import { archStoneHit } from '../render/arches';
import { gateHit } from '../render/gate';
import { PLAYER_RADIUS } from '../sim/constants';
import { Particles, type Rotations } from '../render/particles';
import { GameScene } from '../render/scene';
import type { GameTextures } from '../render/textures';
import { Vfx } from '../render/vfx';
import { BloodPool, POOL_LIFT } from '../render/bloodPool';
import { IncenseClouds } from '../render/incense';
import { FIELD_FIRE_RATE, FIELD_TIME, inField, walkDestination } from '../sim/field';
import { DebugOverlay } from '../ui/debugOverlay';
import { PauseOverlay } from '../ui/pause';
import type { ResultsData } from '../ui/results';
import { BenchRunner } from './bench';
import { attackKick } from './fpWeapon';
import {
  shedsPieces,
  BLAST_GLOW_FROM,
  BLAST_GLOW_TO,
  BLAST_MS,
  BLAST_SIDE,
  BURST_RISE,
  BurstMemory,
  featherBudget,
  HEAVY,
  LIGHT,
  piecesFor,
  RecentBursts,
  ROTATED_SPRITES,
  towardCamera,
  uniform,
  type BurstInfo,
  type Tier,
} from './burstDeaths';
import { Flinches, HIT_FLINCH, KILL_FLINCH, PredictedKills, predictHit, predictPellets, predictSilverBullet, type PelletTarget, type Predicted } from './killPredict';
import { BurstPops, MassKills } from './massKill';
import { massKillShake, Shake, SHAKE_BLASPHEMY, SHAKE_LANDING, SHAKE_SHROUD, SHROUD_SHAKE_RANGE } from './shake';
import { LIGHTMAP_TEXELS } from '../render/lightmap';
import { Bot, type BotEnemy } from './bot';
import { corpseFrame, EnemyAnimator, spriteDirection, type Corpse } from './enemyAnim';
import { FpsCounter } from './fps';
import type { HostSession } from './hostSession';
import { Hud } from './hud';
import { Input, MOUSE_SENSITIVITY } from './input';
import { WADE_LAUNCH_MS, wadeCount, Wading } from './wading';
import { ARC_SEGMENTS, arcPoint, StarAim, starLanding, walkableCells, type Landing, type StarAlly } from './fallingStarAim';
import { HEAL_FADE_MS, HEAL_VIGNETTE, HURT_FADE_MS, hurtVignette, LowHp, SHIELD_EDGE, SHIELD_FADE_MS, SHIELD_GONE_FLASH, SHIELD_UP_FLASH } from './lowHp';
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
/** A move longer than this in one frame is a teleport: the weapon's sway resets (M11 §3.2, as the bob). */
const SWAY_TELEPORT = 2;
/** The gate view's camera (M10 gate §4): it looks at the middle of the boss arena's west wall, 10° up. */
const GATE_VIEW_X = 6;
const GATE_VIEW_Y = 75;
const GATE_VIEW_PITCH = (10 * Math.PI) / 180;
/** Contact shadows are this many times a body's radius (M10 §5.4). */
const SHADOW_SIZE = 1.4;
const PROJECTILE_SPRITES = ['proj-censer', 'proj-orb', 'proj-arrow'];
/** Cherub arrows are drawn at 0.55 m (M12 §6.3; were 0.3, and couldn't be seen to be dodged). */
// The globe is 1.3× the orb it replaced (M12 follow-up §1.3).
const PROJECTILE_SIZES = [0.4, 0.78, 0.55];
/** Cherub arrows glow a pale holy cyan, which nothing else in the world is, and trail 4 embers 0.25 m apart (M12 §6.3). */
const GLOW_ARROW: Glow = { r: 0.55, g: 0.9, b: 1, a: 0.6 };
/** Others' chains show when an enemy being pulled or bound is this close to the pile point (M12 follow-up §2.2): Chains' reach. */
const PILE_REACH = 22;
/** A globe is gold (M12 follow-up §1.3). */
const GLOW_GLOBE: Glow = { r: 1, g: 0.82, b: 0.4, a: 0.55 };
/** A globe's shatter (M12 follow-up §1.3): a soft gold flash and a thin ring out to the blast's reach. */
const GLOBE_FLASH = 0xffe08a;
const GLOBE_SPHERE = 0xffc24a;
/** Discord's wave (M12 follow-up §2.4): the old burst's grey, out to 30 m in 0.3 s. */
const DISCORD_GREY = 0x8a8f97;
const DISCORD_WAVE_MS = 300;
const GLOBE_CORE = 0xfff4d0;
const GLOBE_RING = 0xffd27a;
const ARROW_TRAIL_STEP = 0.25;
const ARROW_TRAIL_SIZES = [0.3, 0.24, 0.18, 0.12];
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
/** The slug's muzzle flash size (M9 §5.1); every attack's recoil is in attackKick (M11). */
const SLUG_FLASH = 1.3;
/**
 * The local player's own censer starts at the painted launcher's muzzle (the stage 2 playtest): the
 * simulation launches it from the eye, so it's drawn from the muzzle, the offset fading over this.
 * A censer appearing within CENSER_CLAIM_MS of a local censer shot, this near the player, is theirs.
 */
const CENSER_BLEND_MS = 250;
const CENSER_CLAIM_MS = 600;
const CENSER_CLAIM_DIST = 3;
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
/** Gold embers rising from each incense cloud per second (M9 §5.1). */
const INCENSE_EMBERS_PER_S = 4;
/** Falling Star's landing (M12 §5.2): a ring out to the reach and a glow, gold-orange. */
const LANDING_COLOR = 0xf08a24;
const LANDING_MS = 450;
/**
 * Shadowstep's streak (M12 §5.7): 1.0 m above the path, fading over 250 ms; a silver core over a dark band
 * 0.35 m wide (decisions.md: silver alone vanished against the pale marble and stone).
 */
const DASH_STREAK = 0xdfe6f0;
const DASH_STREAK_CORE = 0.14;
const DASH_SHADOW = 0x2e2a3a;
const DASH_STREAK_WIDTH = 0.35;
const DASH_STREAK_HEIGHT = 1;
const DASH_STREAK_MS = 250;
/** Falling Star's launched enemies fly an arc LAUNCH_HEIGHT high over 0.4 s (M9 §3.2). */
const LAUNCH_MS = 400;
/** At most this many corpses lie around; the oldest vanish first. */
const MAX_CORPSES = 1000;
const DEG = Math.PI / 180;

const GLOW_WINDUP: Glow = { r: 1, g: 0.78, b: 0.2, a: 0.5 };
/** Stunned by Blasphemy (M12 §5.3): tinted red, trembling sideways 0.04 m at 12 Hz. */
const GLOW_STUNNED: Glow = { r: 1, g: 0.25, b: 0.1, a: 0.35 };
const STUN_TREMBLE = 0.04;
const STUN_TREMBLE_HZ = 12;
/** Blasphemy's shockwave (M12 §5.3): a ground ring out to its radius over 300 ms. */
const BLASPHEMY_RING = 0xff5a1e;
const BLASPHEMY_RING_MS = 300;
const GLOW_ALLY: Glow = { r: 1, g: 0.8, b: 0.2, a: 0.08 };
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
/** A chevron over a soul sits this many CSS pixels above the soul marker's anchor: over the 42 px marker. */
const CHEVRON_ABOVE_SOUL_MARKER = 46;
/** The revive hum plays while a shot hit a soul this recently, or the player's own progress rose. */
const HUM_HOLD_MS = 300;
/** The taunt `!` (M8 §3.1): 0.4 m tall, 0.3 m above the head; pops in, holds, then fades. */
const TAUNT_MARK_HEIGHT = 0.4;
const TAUNT_MARK_GAP = 0.3;
const TAUNT_POP_MS = 150;
const TAUNT_HOLD_MS = 600;
const TAUNT_FADE_MS = 300;

/** A death or censer break waiting for the render time (M12 §4.2). */
interface PendingDeath {
  at: number;
  censer: boolean;
  /** The enemy's slot, type and body center; −1 for a censer. */
  slot: number;
  type: number;
  x: number;
  y: number;
  z: number;
  /** The floor under it, its feet (a Cherub's hover height) and its facing, for the corpse or the blast. */
  ground: number;
  feet: number;
  facing: number;
  /** The ripple's delay was added. */
  rippled: boolean;
}

/** A body blasted back before it bursts (M12 §4.2): its start, its offset at the end, lift and swell. */
interface Blast {
  start: number;
  type: number;
  x: number;
  y: number;
  feet: number;
  facing: number;
  ex: number;
  ey: number;
  lift: number;
  swell: number;
}

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

/** A new enemy within this many meters (horizontally) of a spawn point flares it (M12 §2.4). */
const SPAWN_GLOW_REACH = 2;

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
  /** Contact shadows under the characters (M10 §5.4). */
  private readonly shadows: ContactShadows;
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
  /** The view's yaw and pitch last frame, for the weapon's sway (M11 §3.2). */
  private swayYaw = 0;
  private swayPitch = 0;
  /** The local player's censer shots waiting for their projectile, and the censers claimed as theirs, by slot. */
  private readonly censerShots: Array<{ at: number; from: [number, number, number] }> = [];
  private readonly ownCensers = new Map<number, { at: number; dx: number; dy: number; dz: number }>();
  /** Projectile slots drawn this frame and the last. */
  private projSeen = new Set<number>();
  private projPrev = new Set<number>();
  /** Whether Sacrament's beam leaves the local player's muzzle this frame (M11 §3.9). */
  private ownBeamOn = false;
  /** When the benchmark's HUD fires next (M11 §5). */
  private benchFireAt = 0;
  /** Each player's primary and secondary attacks, unwrapped from the snapshots' counters (M9 §10). */
  private readonly shotCounts = new Map<number, { raw: number; raw2: number; n: number; n2: number }>();
  /** The Field of Blood on screen (M9 §5.1), its coins in flight, and whether the local player stands in it. */
  private pool: BloodPool | null = null;
  private readonly coins: Array<{ from: [number, number, number]; to: [number, number, number]; start: number }> = [];
  private inFieldNow = false;
  /** The censers' incense clouds (M9 §2.8), drawn where each censer vanished. */
  private readonly incense: IncenseClouds;
  /** When each enemy slot's Falling Star launch arc starts (M9 §3.2). */
  private readonly launchAt = new Float64Array(ENEMY_SLOTS).fill(-Infinity);
  /** Wading (M12 §3.1): launched enemies don't press until then (ms), and the applied speed factor. */
  private readonly wadeLaunchedUntil = new Float64Array(ENEMY_SLOTS).fill(-Infinity);
  private readonly wading = new Wading();
  /** Low HP (M12 §6.2), from the newest snapshot's own HP. */
  private readonly lowHp = new LowHp();
  private ownHp = 0;
  /** Each projectile slot's drawn position last frame and the frame it was drawn, for the arrows' trails (M12 §6.3). */
  private readonly projLast = new Float32Array(PROJECTILE_SLOTS * 3);
  private readonly projLastFrame = new Uint32Array(PROJECTILE_SLOTS);
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
  /** Scratch: the slots of the previous snapshot, for the spawn glow (M12 §2.4). */
  private readonly prevSlots = new Uint8Array(ENEMY_SLOTS);
  private readonly flashGlow: Glow = { r: 1, g: 1, b: 1, a: 0 };
  /** performance.now() when each enemy was seen taunted, or -1 while it isn't (M8 §3.1). */
  private readonly tauntAt = new Float64Array(ENEMY_SLOTS).fill(-1);
  private readonly botEnemies: BotEnemy[] = [];
  /**
   * Deaths and censer breaks waiting for the render time. An enemy's death carries its slot and its
   * corpse, created when the death plays unless the slot bursts instead (M12 §4.2).
   */
  private readonly pendingBursts: PendingDeath[] = [];
  /** Burst deaths (M12 §4.2): the host's `bursts` by slot, the bodies being blasted back, the lately played. */
  private readonly burstMemory = new BurstMemory();
  private readonly blasts: Blast[] = [];
  private readonly recentBursts = new RecentBursts();
  private readonly massKills = new MassKills();
  private readonly pops = new BurstPops();
  /** Each enemy slot's position in the newest snapshot that had it, for the ripple's distances. */
  private readonly lastEnemyX = new Float32Array(ENEMY_SLOTS);
  private readonly lastEnemyY = new Float32Array(ENEMY_SLOTS);
  /** The burst and the torn pieces in their 4 rotations. */
  private readonly rotations: Record<string, Rotations>;
  /** Your kills, at once (M12 §4.4), and the screen shake (§4.5). */
  private readonly predicted = new PredictedKills();
  private readonly flinches = new Flinches();
  private readonly shake = new Shake();
  private wasLeaping = false;
  /** Falling Star aimed anywhere (M12 §5.2): the hold, the walkable cells (once per map), this frame's preview, the ally leapt to. */
  private readonly starAim = new StarAim();
  private walkable: Uint8Array | null = null;
  private starPreview: Landing | null = null;
  private leapAlly = ALLY_NONE;
  /** Shadowstep (M12 §5.7): when the local slash began, and where the dash started. */
  private slashAt = -Infinity;
  private dashFrom: [number, number, number] | null = null;
  private wasDashing = false;
  private readonly flinchGlow: Glow = { r: 1, g: 1, b: 1, a: 0 };
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
    this.scene = new GameScene(this.canvas, this.map, o.textures.terrain, o.textures.fx.glow);
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
    // The characters sit in the baked light (M10 §5.4).
    const lightmap = this.scene.terrain.lightmap;
    for (const b of [this.billboards, ...this.enemyBillboards.values(), ...this.playerBillboards.values()]) b.setLight(lightmap, this.map.w, this.map.h, this.floorAt);
    this.shadows = new ContactShadows(o.textures.fx.glow);
    for (const m of this.shadows.meshes) this.scene.scene.add(m);
    this.vfx = new Vfx(o.textures.fx);
    this.incense = new IncenseClouds(o.textures.fx.smoke);
    this.scene.scene.add(this.incense.group);
    this.scene.scene.add(this.vfx.group);
    this.judgmentGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: o.textures.fx.glow, color: 0xfff0b0, transparent: true, depthWrite: false, fog: false }),
    );
    this.judgmentGlow.visible = false;
    this.scene.scene.add(this.judgmentGlow);
    this.frames = o.atlas.frames;
    this.particles = new Particles([o.atlas.frames.feather, o.atlas.frames.spark, o.atlas.frames.ember], this.pieceFloor);
    this.rotations = Object.fromEntries(ROTATED_SPRITES.map((n) => [n, [0, 1, 2, 3].map((r) => o.atlas.frames[`${n}-r${r}`]) as unknown as Rotations]));
    this.hud = new Hud(o.root, this.classId, !o.singleplayer);
    this.hud.onChatSend = (text) => o.onChat?.(text);
    this.hud.setHp(this.maxHp, 0, this.maxHp);
    this.hud.setRemaining(null);
    this.hud.setDeath(null);
    this.party = o.singleplayer ? null : new PartyFrames(this.hud.leftColumn, this.hud.ownFrame);
    this.sounds = new GameSounds(this.map, this.localId, (id) => this.classOf(id));
    this.hud.onReady = () => this.sounds.abilityReady();
    this.overlay = new DebugOverlay(o.root, this.params.dev);
    this.pause = new PauseOverlay(o.root, () => this.resume(), () => this.leave());

    this.input = new Input(this.canvas);
    this.input.pointerLockAllowed = !this.params.bot && this.params.benchArena < 0;
    this.input.onKey = (code) => this.onKey(code);
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('visibilitychange', this.onVisibility);

    const [sc, sr] = this.params.benchArena >= 0 ? this.map.arenas[this.params.benchArena].entryCells[0] : this.params.startArena > 0 ? this.map.arenas[this.params.startArena].entryCells[index] : this.map.spawns[index];
    this.player = new LocalPlayer(sc + 0.5, sr + 0.5, this.map.floor[sr * this.map.w + sc], CLASSES[me.classId].speed);
    this.doorPhase = this.map.arenas.map(() => -1);

    this.snaps = new SnapshotBuffer(o.host ? 1.5 : 4.5);
    this.snaps.onComplete = (s, prev) => this.onSnapshot(s, prev);
    o.transport.onSnapshot = (buf) => this.snaps.addPart(buf, performance.now());

    this.bot = this.params.bot ? new Bot(this.map) : null;
    if (this.params.dev) window.__heavenfallTeleport = (x, y) => this.player.teleport(x, y, this.map.floor[Math.floor(y) * this.map.w + Math.floor(x)]);
    this.bench = this.params.benchArena >= 0 && o.host ? new BenchRunner(o.root, o.host, () => this.scene.rendererString(), () => this.scene.renderStats()) : null;

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
    if (this.over || this.params.benchArena >= 0) return;
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
    // Dev key J removes only the Blessed, leaving the casters in view (M12 follow-up screenshots).
    else if (code === 'KeyJ' && this.params.dev && this.o.host) this.o.host.killAll(true);
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
      // Your Blasphemy shakes the screen on its press (M12 §4.5).
      if (this.classId === 'fallen' && this.displayedCooldown('Q', now) <= 0) this.shake.add(now, SHAKE_BLASPHEMY);
      // Your Chains come down at once (M12 follow-up §2.2).
      if (this.classId === 'binder' && this.displayedCooldown('Q', now) <= 0) this.ownChains(now);
      return;
    }
    const def = ABILITIES[this.classId].E;
    // The Heretic and the Binder count every E key-down; the Fallen and the Betrayer only the leaps and
    // dashes they execute (M12 §5.2).
    if (!def.movement) {
      this.ePresses = (this.ePresses + 1) & 0xff;
      return;
    }
    const ready = this.displayedCooldown('E', now) <= 0;
    const p = this.player;
    if (this.classId === 'fallen') {
      // Falling Star: held to aim, released to leap (M12 §5.2). The bot leaps at once, only to an ally target.
      if (!this.bot) {
        this.starAim.keyDown(ready, !this.dead);
        return;
      }
      const ally = ready ? this.snaps.playersOut.find((q) => q.id === this.allyTargetId) : undefined;
      if (ally) this.leap(now, ally.x, ally.y, ally.z, ally.id);
      return;
    }
    if (!ready) return;
    // Shadowstep: the movement direction (WASD relative to yaw), forward if not moving.
    let dir: [number, number] | null = this.botDir;
    if (!this.bot) {
      const axes = this.input.moveAxes();
      dir = axes.forward !== 0 || axes.right !== 0 ? wasdDirection(p.yaw, axes.forward, axes.right) : null;
    }
    const [dx, dy] = dir ?? [Math.cos(p.yaw), Math.sin(p.yaw)];
    p.startDash(dx, dy);
    this.ePresses = (this.ePresses + 1) & 0xff;
    this.localEReadyAt = now + def.cooldown * 1000;
    // The dagger cuts across the view for the dash's 200 ms (M12 §5.7).
    this.slashAt = now;
    debugState.slashAt = now;
    this.hud.slash(now);
    this.dashFrom = [p.body.x, p.body.y, p.body.z];
  }

  /** Falling Star's leap to a landing point (feet) starts: counted for the host, cooling down locally (M12 §5.2). */
  private leap(now: number, x: number, y: number, z: number, ally: number): void {
    this.player.startLeap(x, y, z);
    this.leapAlly = ally;
    this.ePresses = (this.ePresses + 1) & 0xff;
    this.localEReadyAt = now + ABILITIES.fallen.E.cooldown * 1000;
  }

  /**
   * The local Fallen's aim this frame (M12 §5.2): the preview while E is held, the leap on its release
   * if the landing is valid. The ally target is the snapped ally while aiming, the one leapt to while
   * leaping. Returns the fire bits, without the right button after a cancel until it's let go.
   */
  private updateStarAim(now: number, fire: number): number {
    const p = this.player;
    const step = this.starAim.frame(this.input.isDown('KeyE'), this.input.rightHeld, this.input.releases);
    let landing: Landing | null = null;
    if (this.starAim.aiming || step === 'release') {
      this.walkable ??= walkableCells(this.map);
      landing = starLanding(this.map, this.walkable, p.body.x, p.body.y, p.body.z, p.yaw, p.pitch, this.starAllies());
    }
    if (step === 'release' && landing?.valid) this.leap(now, landing.x, landing.y, landing.z, landing.ally >= 0 ? landing.ally : ALLY_NONE);
    this.starPreview = this.starAim.aiming ? landing : null;
    this.allyTargetId = this.starPreview && this.starPreview.ally >= 0 ? this.starPreview.ally : p.leaping ? this.leapAlly : ALLY_NONE;
    return this.starAim.rightBlocked ? fire & ~(FIRE_RIGHT | FIRE_RIGHT_LAST) : fire;
  }

  /** The teammates a leap can snap to: their interpolated feet. */
  private starAllies(): StarAlly[] {
    return this.snaps.playersOut.filter((q) => q.id !== this.localId).map((q) => ({ id: q.id, x: q.x, y: q.y, z: q.z, dead: q.dead }));
  }

  /** Falling Star's preview: its arc from the feet and its rings, gold-orange when valid, red when not. */
  private drawStarPreview(): void {
    const l = this.starPreview;
    const b = this.player.body;
    const pts = l ? Array.from({ length: ARC_SEGMENTS + 1 }, (_, i) => arcPoint(b.x, b.y, b.z, l.x, l.y, l.z, i / ARC_SEGMENTS)) : null;
    this.vfx.setStarPreview(pts, l ? [l.x, l.y, l.z] : null, l?.valid ?? false, this.scene.camera.position);
  }

  /** Falling Star's landing (M12 §5.2): the ring out to the 6 m reach and the glow, where it lands. */
  private landingFx(now: number, x: number, y: number, z: number): void {
    this.vfx.ring(now, x, y, z, LANDING_COLOR, 0.5, FALLING_STAR_RADIUS, LANDING_MS);
    this.vfx.glow(now, x, y, z + 0.5, LANDING_COLOR, 1, 2.5, LANDING_MS);
  }

  /** Shadowstep's silver streak along a dash (M12 §5.7), 1 m above its path, with the dagger's cut. */
  private dashStreak(now: number, x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): void {
    const pts: Array<[number, number, number]> = [[x0, y0, z0 + DASH_STREAK_HEIGHT], [x1, y1, z1 + DASH_STREAK_HEIGHT]];
    this.vfx.beam(now, pts, DASH_SHADOW, DASH_STREAK_WIDTH, DASH_STREAK_MS);
    this.vfx.beam(now, pts, DASH_STREAK, DASH_STREAK_CORE, DASH_STREAK_MS);
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
    if (this.paused || this.over || this.params.benchArena >= 0 || this.disposed) return;
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
        // Others' landings show after the render delay; the own one showed when its leap ended (M12 §5.2).
        if (e.playerId !== this.localId) this.pendingFx.push({ at: now + this.snaps.delayTicks * TICK_MS, run: (t) => this.landingFx(t, e.x, e.y, e.z) });
        // Launched enemies fly their arc after the render delay, like other effects (M9 §3.2).
        for (const s of e.launched) {
          this.launchAt[s] = now + this.snaps.delayTicks * TICK_MS;
          // They don't hold a wading player for 0.4 s from the event's arrival (M12 §3.1).
          this.wadeLaunchedUntil[s] = now + WADE_LAUNCH_MS;
        }
        break;
      case 'shroudBurst':
        // A blue ring expanding from 1 m to the burst's 3.5 m over 0.3 s (M12 §5.4), and 24 embers bursting outward (M9 §5.1).
        this.vfx.ring(now, e.x, e.y, e.z, 0x4aa3e8, 1, SHROUD_BURST_RADIUS, 300);
        this.particles.shroudBurst(e.x, e.y, e.z + PLAYER_HEIGHT / 2);
        // It shakes the screen of a player within 6 m, after the render delay (M12 §4.5).
        this.pendingFx.push({
          at: now + this.snaps.delayTicks * TICK_MS,
          run: (t) => {
            const b = this.player.body;
            if (!this.dead && Math.hypot(e.x - b.x, e.y - b.y) <= SHROUD_SHAKE_RANGE) this.shake.add(t, SHAKE_SHROUD);
          },
        });
        break;
      case 'bursts':
        this.burstMemory.remember(e.list, now, (slot, id) => this.distToPlayer(slot, id));
        break;
      case 'dashCut':
        // Others' Shadowstep streaks after the render delay; the own one was drawn when its dash ended (M12 §5.7).
        if (e.playerId !== this.localId) this.pendingFx.push({ at: now + this.snaps.delayTicks * TICK_MS, run: (t) => this.dashStreak(t, e.x0, e.y0, e.z0, e.x1, e.y1, e.z1) });
        break;
      case 'globeShatter':
        // After the render delay, where the globe is drawn breaking (M12 follow-up §1.3).
        this.pendingFx.push({ at: now + this.snaps.delayTicks * TICK_MS, run: (t) => this.globeFx(t, e.x, e.y, e.z, e.by >= 0) });
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

  /**
   * Another Binder's chains over its pile (M12 follow-up §2.2), when an enemy is being pulled or bound
   * within Chains' reach of the pile point.
   */
  private pileChains(now: number, x: number, y: number, z: number, playerId: number): void {
    const ents = this.snaps.out;
    for (let i = 0; i < ents.count; i++) {
      if (!(ents.flags[i] & FLAG_ROOTED)) continue;
      if ((ents.x[i] - x) ** 2 + (ents.y[i] - y) ** 2 > PILE_REACH * PILE_REACH) continue;
      this.chainsDown(now, x, y, z, playerId);
      return;
    }
  }

  private chainsDown(now: number, x: number, y: number, z: number, playerId: number): void {
    this.vfx.chainCone(now, x, y, z, playerId);
    debugState.chainsAt = now;
  }

  /**
   * The own Chains of Tartarus on its key press (M12 follow-up §2.2): when it's ready and an enemy other
   * than the Gatekeeper is within 20 m and 30° of the aim, the chains come down at once onto the pile
   * point, found as the host does. Line of sight isn't checked: a guess the host's pull confirms.
   */
  private ownChains(now: number): void {
    const b = this.player.body;
    const [px, py] = walkDestination(this.map, b.x, b.y, this.player.yaw, CHAINS_MAX);
    const ents = this.snaps.out;
    const ex = b.x;
    const ey = b.y;
    const ez = b.z + PLAYER_EYE;
    const [ax, ay, az] = aimDir(this.player.yaw, this.player.pitch);
    const cosMax = Math.cos(CHAINS_ANGLE);
    for (let i = 0; i < ents.count; i++) {
      if (ents.type[i] === GATEKEEPER) continue;
      const def = ENEMIES[ents.type[i]];
      const dx = ents.x[i] - ex;
      const dy = ents.y[i] - ey;
      const dz = this.zScratch[i] + def.height / 2 - ez;
      const len = Math.hypot(dx, dy, dz);
      if (len - def.radius > CHAINS_RANGE) continue;
      if (len > 1e-9 && (dx * ax + dy * ay + dz * az) / len < cosMax) continue;
      this.chainsDown(now, px, py, this.map.floor[Math.floor(py) * this.map.w + Math.floor(px)], this.localId);
      return;
    }
  }

  /**
   * A globe shatters (M12 follow-up §1.3): a golden sphere bursting out to its blast's reach around a hot
   * core, a flash, a ring on the floor and glass shards; 1.5 m on players, and shot down, brighter and
   * out to its 3 m on enemies.
   */
  private globeFx(now: number, x: number, y: number, z: number, shotDown: boolean): void {
    const reach = shotDown ? GLOBE_SHOT_BLAST : GLOBE_BLAST;
    // Faint when it bursts around the camera (a globe hitting you), so it doesn't flood the view.
    const b = this.player.body;
    const inside = Math.hypot(x - b.x, y - b.y, z - (b.z + PLAYER_EYE)) < reach + 0.3 ? 0.25 : 1;
    this.vfx.burstSphere(now, x, y, z, GLOBE_SPHERE, 0.2, reach, shotDown ? 420 : 320, (shotDown ? 0.55 : 0.45) * inside);
    this.vfx.burstSphere(now, x, y, z, GLOBE_CORE, 0.1, reach * 0.45, shotDown ? 200 : 160, 0.9 * inside);
    this.vfx.glow(now, x, y, z, GLOBE_FLASH, 0.3, shotDown ? 1.8 : 1.0, shotDown ? 260 : 180, 0, shotDown ? 0.75 : 0.5);
    const floor = this.floorAt(x, y);
    if (floor > -Infinity && z - floor < 4) this.vfx.ring(now, x, y, floor, GLOBE_RING, 0.3, shotDown ? GLOBE_SHOT_BLAST : GLOBE_BLAST, shotDown ? 350 : 250);
    this.particles.globeShards(x, y, z, shotDown ? 24 : 10);
    debugState.globes.shattered++;
    if (shotDown) debugState.globes.shotDown++;
    debugState.globes.at = now;
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
      case 'fallen:Q': // taunt sphere, growing to Blasphemy's radius (M8 §3.1), and its shockwave (M12 §5.3)
        this.vfx.sphere(now, e.x, e.y, e.z + PLAYER_HEIGHT / 2, 0xe0301e, 1, BLASPHEMY_RADIUS, 400, 0.45);
        this.vfx.ring(now, e.x, e.y, e.z, BLASPHEMY_RING, 0.5, BLASPHEMY_RADIUS, BLASPHEMY_RING_MS);
        break;
      case 'heretic:Q': {
        // Heal ring, and a heal column on every player it healed, even at full HP (M8 §3.1).
        this.vfx.ring(now, e.x, e.y, e.z, 0x5ee65e, 0.5, 15, 700);
        for (const id of e.targets) {
          const t = this.playerPose(id);
          if (t) this.particles.healColumn(t.x, t.y, t.z);
          if (id === this.localId) this.hud.vignette('green', HEAL_VIGNETTE, now, HEAL_FADE_MS);
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
      case 'binder:Q':
        // Red-hot chains come down onto the pile point as the cast begins (M12 follow-up §2.2), in place of
        // the old chain lines across the cone: the own ones came on the key press; others' after the
        // render delay, when something is being pulled.
        if (e.playerId !== this.localId) this.pendingFx.push({ at: now + this.snaps.delayTicks * TICK_MS, run: (t) => this.pileChains(t, e.x, e.y, e.z, e.playerId) });
        break;
      case 'binder:E':
        // Discord's shout (M12 follow-up §2.4): a grey wave fanning out over its cone on the floor.
        if (user) this.vfx.shoutCone(now, e.x, e.y, e.z, user.yaw, DISCORD_HALF_ANGLE, DISCORD_RANGE, DISCORD_GREY, DISCORD_WAVE_MS);
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
      const tx = e.x + Math.cos(a) * r;
      const ty = e.y + Math.sin(a) * r;
      // Each lands on the pool's surface: its cell's floor plus the pool's lift.
      this.coins.push({ from, to: [tx, ty, this.map.floor[Math.floor(ty) * this.map.w + Math.floor(tx)] + POOL_LIFT], start: now });
    }
  }

  /**
   * The height an incense cloud's puff floats above at (x, y) (M9 §5.1): the floor under it, unless the
   * censer broke more than 2 m above that floor (on a Cherub), where the puffs float around the break.
   */
  private cloudBase(x: number, y: number, breakZ: number): number {
    const g = groundHeight(this.map, x, y, 0.1, Infinity, false, true);
    const floor = g === -Infinity ? breakZ : g;
    return breakZ - floor > 2 ? breakZ - 0.6 : floor;
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
    if (p && Math.random() < POOL_EMBERS_PER_S * dt) {
      const at = p.randomPoint(now, this.map);
      if (at) this.particles.bloodEmber(at[0], at[1], at[2]);
    }
    const b = this.player.body;
    const inside = !!p && !this.dead && inField(p.x, p.y, b.x, b.y);
    if (inside && !this.inFieldNow) this.sounds.fieldEntered();
    this.inFieldNow = inside;
    this.hud.setInField(inside, now);
    this.hud.setFieldBuff(inside && p ? Math.max(0, 1 - p.age(now) / FIELD_TIME) : null);
    // Teammates in it, from their interpolated positions, get the badge on their party frames.
    if (this.party) {
      const ids = new Set<number>();
      if (p) for (const q of this.snaps.playersOut) if (q.id !== this.localId && !q.dead && inField(p.x, p.y, q.x, q.y)) ids.add(q.id);
      this.party.setInField(ids);
    }
  }

  private onGameOver(e: Extract<GameEvent, { type: 'gameOver' }>, now: number): void {
    if (this.over) return;
    this.resultAt = now;
    debugState.gameResult = e.result;
    this.resultData = {
      result: e.result,
      timeMs: e.timeMs,
      players: Object.entries(e.stats)
        .map(([id, stats]) => ({ id: Number(id), stats }))
        .sort((a, b) => a.id - b.id)
        .map(({ id, stats }) => ({ ...stats, name: this.roster.find((r) => r.id === id)?.name ?? `Player ${id}`, me: id === this.localId })),
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
      this.ownHp = me.hp;
      // The steady blue edge while the own shield is up (M12 §6.1).
      this.hud.setShieldEdge(me.shield > 0 && !me.dead ? SHIELD_EDGE : 0);
      if (was) {
        const lost = was.hp + was.shield - (me.hp + me.shield);
        if (lost > 0 && !me.dead) {
          this.hud.vignette('red', hurtVignette(lost, this.maxHp), now, HURT_FADE_MS);
          this.hud.shakeHp(now);
        } else if (me.hp > was.hp && !was.dead && !beamed) this.hud.vignette('green', HEAL_VIGNETTE, now, HEAL_FADE_MS);
        // The shield going up flashes the fading blue at 0.6, its going 0.7 (M12 §6.1).
        if (me.shield > 0 && me.shield > was.shield) this.hud.vignette('blue', SHIELD_UP_FLASH, now, SHIELD_FADE_MS);
        else if (was.shield > 0 && me.shield === 0) this.hud.vignette('blue', SHIELD_GONE_FLASH, now, SHIELD_FADE_MS);
        // A kill the local player predicted already showed its marker (M12 §4.4).
        if (me.kills > was.kills && !this.predicted.holdsMarker(now)) {
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
        const ground = g === -Infinity ? 0 : g;
        // A Cherub falls from its hover height to the ground while it dies (§11.1).
        const feet = ground + (type === CHERUB ? CHERUB_HOVER : 0);
        this.pendingBursts.push({
          at: now + delay,
          censer: false,
          slot,
          type,
          x: prev.enemyX[i],
          y: prev.enemyY[i],
          z: feet + def.height / 2,
          ground,
          feet,
          facing: this.animator.facing[slot],
          rippled: false,
        });
      }
      const alive = new Set(s.projSlot.subarray(0, s.projectileCount));
      for (let i = 0; i < prev.projectileCount; i++) {
        if (prev.projKind[i] !== PROJ_CENSER || alive.has(prev.projSlot[i])) continue;
        // A censer that vanished over the void didn't break (M10 §3.4).
        if (overVoid(this.map, prev.projX[i], prev.projY[i])) continue;
        this.pendingBursts.push({ at: now + delay, censer: true, slot: -1, type: -1, x: prev.projX[i], y: prev.projY[i], z: prev.projZ[i], ground: 0, feet: 0, facing: 0, rippled: false });
      }
    }
    if (prev) this.spawnGlows(s, prev, now + this.snaps.delayTicks * TICK_MS);
    // Where each enemy was last seen, and burst slots reused by new enemies forgotten (M12 §4.2).
    if (prev) for (let i = 0; i < prev.enemyCount; i++) this.prevSlots[prev.enemySlot[i]] = 1;
    for (let i = 0; i < s.enemyCount; i++) {
      const slot = s.enemySlot[i];
      this.lastEnemyX[slot] = s.enemyX[i];
      this.lastEnemyY[slot] = s.enemyY[i];
      if (prev && !this.prevSlots[slot]) this.burstMemory.forget(slot);
    }
    if (prev) for (let i = 0; i < prev.enemyCount; i++) this.prevSlots[prev.enemySlot[i]] = 0;
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

  /**
   * The spawn glow (M12 §2.4): an enemy slot that wasn't in the previous snapshot, within 2 m
   * horizontally of a spawn or squad point of the snapshot's arena, flares that point when it appears on
   * screen (`at`, after the render delay). Gatekeeper summons glow the same way.
   */
  private spawnGlows(s: Snapshot, prev: Snapshot, at: number): void {
    // Squad points flare too (M12 follow-up §4.2).
    const points = this.map.arenaSpawnPoints[s.arenaIndex]?.concat(this.map.arenaSquadPoints[s.arenaIndex]);
    if (!points?.length) return;
    for (let i = 0; i < prev.enemyCount; i++) this.prevSlots[prev.enemySlot[i]] = 1;
    const flared = new Set<number>();
    for (let i = 0; i < s.enemyCount; i++) {
      if (this.prevSlots[s.enemySlot[i]]) continue;
      let best = -1;
      let bestD2 = SPAWN_GLOW_REACH * SPAWN_GLOW_REACH;
      for (let k = 0; k < points.length; k++) {
        const dx = points[k][0] + 0.5 - s.enemyX[i];
        const dy = points[k][1] + 0.5 - s.enemyY[i];
        const d2 = dx * dx + dy * dy;
        if (d2 <= bestD2) {
          bestD2 = d2;
          best = k;
        }
      }
      if (best >= 0) flared.add(best);
    }
    for (let i = 0; i < prev.enemyCount; i++) this.prevSlots[prev.enemySlot[i]] = 0;
    for (const k of flared) {
      const [c, r] = points[k];
      const z = this.map.floor[r * this.map.w + c];
      this.pendingFx.push({ at, run: (t) => this.vfx.flareSpawn(t, c + 0.5, r + 0.5, z) });
    }
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
   * sight; and the out-of-range ally for the grey chevron. Only the Fallen and the Heretic Saint use one;
   * the Heretic's can be a soul, for Sacrament (M9 §2.5).
   */
  private computeAllyTarget(now: number): void {
    const range = ABILITIES[this.classId].E.allyRange;
    // The Fallen's own player snaps its leap to an ally instead (M12 §5.2); its bot keeps the cone.
    if (this.classId === 'fallen' && !this.bot) {
      this.allyOutOfRange = ALLY_NONE;
      return;
    }
    if (range <= 0 || this.dead) {
      this.allyTargetId = ALLY_NONE;
      this.allyOutOfRange = ALLY_NONE;
      return;
    }
    const p = this.player;
    const [ax, ay, az] = aimDir(p.yaw, p.pitch);
    const souls = this.classId === 'heretic';
    const others = this.snaps.playersOut
      .filter((q) => q.id !== this.localId)
      .map((q) => (q.dead ? { ...q, z: q.z + this.souls.rise(q.id, now) } : q));
    const r = pickAllyTarget(this.map, p.body.x, p.body.y, p.body.z + PLAYER_EYE, ax, ay, az, others, range, this.allyTargetId, souls);
    this.allyTargetId = r.target;
    this.allyOutOfRange = r.outOfRange;
  }

  /**
   * The gold chevron over the ally target, or the grey one over an ally out of range (M8 §3.5). Over a
   * soul it sits just above the soul's marker.
   */
  private placeChevron(now: number): void {
    const id = this.allyTargetId !== ALLY_NONE ? this.allyTargetId : this.allyOutOfRange;
    const q = id === ALLY_NONE ? undefined : this.snaps.playersOut.find((o) => o.id === id);
    let at: [number, number] | null = null;
    if (q?.dead) {
      at = this.project(q.x, q.y, q.z + this.souls.drawnRise(q.id, now) + SOUL_MARKER_HEIGHT);
      if (at) at = [at[0], at[1] - CHEVRON_ABOVE_SOUL_MARKER];
    } else if (q) at = this.project(q.x, q.y, q.z + CHEVRON_HEIGHT);
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

  /** The first-person weapon's shot for an attack: recoil, tilt (M11 §3.2) and muzzle flash. */
  private hudShot(now: number, slot: AttackSlot): void {
    const w = attackDef(this.classId, slot);
    const { deg, alternate, recoil } = attackKick(this.classId, slot);
    const slug = slot === ATTACK_SECONDARY && w.kind === 'hitscan';
    this.hud.shot(now, w.interval * 1000, deg, alternate, recoil, slug ? SLUG_FLASH : 1);
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
        const hits = this.scourgeHits(ents, enemyZ);
        if (hits.length) {
          this.hud.hit(now);
          this.sounds.hit();
        }
        // Every Scourge kill bursts; each hit flinches away from the Binder (M12 §4.4).
        for (const i of hits) {
          const r = predictHit(ents.type[i], w.damage, (ents.flags[i] & FLAG_ROOTED) !== 0, true);
          this.predictedHit(now, ents.slot[i], ents.x[i] - p.body.x, ents.y[i] - p.body.y, r);
        }
        return;
      }
      case 'censer': {
        this.hudShot(now, slot);
        this.sounds.ownShot(this.classId, secondary);
        const [msx, msy] = this.hud.muzzlePoint(now);
        this.censerShots.push({ at: now, from: this.unproject(msx, msy, OWN_BEAM_DEPTH) });
        return;
      }
    }
    this.hudShot(now, slot);
    this.sounds.ownShot(this.classId, secondary);
    // Tracers start at the painted weapon's muzzle, as drawn this frame (the stage 2 playtest).
    const [msx, msy] = this.hud.muzzlePoint(now);
    const [mx, my, mz] = this.unproject(msx, msy, OWN_BEAM_DEPTH);
    const pts: Array<[number, number, number]> = [];
    let hit = false;
    const shotgun = this.classId === 'fallen' && slot === ATTACK_PRIMARY;
    const chainGun = this.classId === 'binder' && slot === ATTACK_PRIMARY;
    // Each pellet's ray and the enemies along it, nearest first; the shotgun's within 6 m of the
    // Fallen's body center deal 20 and burst what they kill (M12 §5.1, §4.1).
    const rays = Array.from({ length: w.pellets }, () => {
      const yaw = p.yaw + (Math.random() * 2 - 1) * w.spreadYaw;
      const pitch = p.pitch + (Math.random() * 2 - 1) * w.spreadPitch;
      const [dx, dy, dz] = aimDir(yaw, pitch);
      const stop = raycastTerrain(this.map, ex, ey, ez, dx, dy, dz, w.range);
      const ts: PelletTarget[] = [];
      for (let i = 0; i < ents.count; i++) {
        const def = ENEMIES[ents.type[i]];
        const t = rayCylinder(ex, ey, ez, dx, dy, dz, ents.x[i], ents.y[i], enemyZ[i], def.radius, def.height);
        if (t > stop) continue;
        const close = shotgun && distToCylinder(ex, ey, p.body.z + PLAYER_HEIGHT / 2, ents.x[i], ents.y[i], enemyZ[i], def.radius, def.height) <= SHOTGUN_KNOCKBACK_RANGE;
        ts.push({ i, t, type: ents.type[i], rooted: (ents.flags[i] & FLAG_ROOTED) !== 0, close });
      }
      ts.sort((a, b) => a.t - b.t);
      return { dx, dy, dz, stop, ts };
    });
    // Enemies an earlier pellet of this shot is predicted to kill: later pellets pass them, as on the host.
    const predicted = w.kind === 'silverBullet' ? null : predictPellets(rays.map((r) => r.ts), w.damage, w.maxHits, shotgun ? 'shotgun' : chainGun ? 'chainGun' : 'other');
    rays.forEach(({ dx, dy, dz, stop, ts }, k) => {
      // A shot that meets a wall ends on its drawn surface: a relief's front, or a window's glass (M10 §5.3).
      let end = stop < w.range ? this.scene.terrain.relief.adjust(ex, ey, ez, dx, dy, dz, stop) : stop;
      // A shot crossing an arch's painted stone flies on in the simulation; its tracer ends there (M10 §6.1).
      end = Math.min(end, archStoneHit(this.scene.terrain.arches, ex, ey, ez, dx, dy, dz, stop));
      // And at the Heavenly Gate, which the simulation sees as a wall (M10 gate §3).
      const gate = this.scene.terrain.gate;
      if (gate) end = Math.min(end, gateHit(gate.layout, ex, ey, ez, dx, dy, dz, stop));
      if (ts.length > 0) {
        hit = true;
        if (!predicted) {
          // An estimate (M9 §5.1): every enemy at its type's full HP, doubled for the rooted flag.
          const line = ts.map(({ type, rooted }) => ({ type, rooted }));
          const r = estimateSilverBullet(line, w.damage);
          if (r.stopped) end = ts[r.reached - 1].t;
          predictSilverBullet(line.slice(0, r.reached), r.carried).forEach((res, n) => this.predictedHit(now, ents.slot[ts[n].i], dx, dy, res));
        } else {
          const hits = predicted[k];
          if (hits.length >= w.maxHits) end = hits[hits.length - 1].target.t;
          for (const h of hits) this.predictedHit(now, ents.slot[h.target.i], dx, dy, h.result);
        }
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
    });
    if (w.kind === 'silverBullet') this.silverTracer(now, pts[0], pts[1], this.inFieldNow ? BLOOD_TRACER : SILVER_EMBER);
    else this.vfx.beam(now, pts, this.inFieldNow ? BLOOD_TRACER : TRACER_COLOR, secondary ? SLUG_TRACER_WIDTH : TRACER_WIDTH, TRACER_MS);
    if (hit) {
      this.hud.hit(now);
      this.sounds.hit();
    }
  }

  /**
   * The interpolated enemies a local Scourge swing would hit, as on the host: every one within 3 m and
   * the 120° arc (M12 §5.5).
   */
  private scourgeHits(ents: InterpolatedEnemies, enemyZ: Float32Array): number[] {
    const p = this.player;
    const w = SECONDARIES.binder;
    const cz = p.body.z + PLAYER_HEIGHT / 2;
    const cosMax = Math.cos(SCOURGE_HALF_ARC);
    const hits: Array<{ i: number; d: number }> = [];
    for (let i = 0; i < ents.count; i++) {
      const def = ENEMIES[ents.type[i]];
      const d = distToCylinder(p.body.x, p.body.y, cz, ents.x[i], ents.y[i], enemyZ[i], def.radius, def.height);
      if (d > w.range) continue;
      const hx = ents.x[i] - p.body.x;
      const hy = ents.y[i] - p.body.y;
      const len = Math.hypot(hx, hy);
      if (len < 1e-9 || (hx * Math.cos(p.yaw) + hy * Math.sin(p.yaw)) / len >= cosMax - 1e-9) hits.push({ i, d });
    }
    hits.sort((a, b) => a.d - b.d);
    return hits.slice(0, w.maxHits).map((h) => h.i);
  }

  /**
   * A predicted hit of the local player's on an enemy slot, along the horizontal (dx, dy) (M12 §4.4):
   * it flinches, and a predicted kill plays the kill marker (or the burst marker) and `killTick` now.
   */
  private predictedHit(now: number, slot: number, dx: number, dy: number, r: Predicted): void {
    this.flinches.add(slot, now, dx, dy, r ? KILL_FLINCH : HIT_FLINCH);
    if (!r) return;
    this.sounds.kill(this.predicted.kill(now));
    if (r === 2) this.hud.burst(now);
    else this.hud.kill(now);
  }

  /** An enemy slot's distance from a player, for the ripple: the local one's own position, others' interpolated. */
  private distToPlayer(slot: number, playerId: number): number {
    const q = playerId === this.localId ? this.player.body : this.snaps.playersOut.find((o) => o.id === playerId);
    return q ? Math.hypot(this.lastEnemyX[slot] - q.x, this.lastEnemyY[slot] - q.y) : 0;
  }

  /** The floor a torn piece lands on (M12 §4.2.1): none over a wall, outside the map or over the void. */
  private readonly pieceFloor = (x: number, y: number): number => (overVoid(this.map, x, y) ? -Infinity : this.floorAt(x, y));

  /**
   * An enemy's death plays (M12 §4.2): a burst death if the host burst its slot, otherwise the normal
   * death with its feathers, chirp and corpse.
   */
  private playDeath(b: PendingDeath, now: number): void {
    const info = this.burstMemory.take(b.slot, now);
    if (info && this.o.enemyAnims[b.type]?.anims.pain) {
      this.startBurstDeath(b, info, now);
      return;
    }
    this.particles.featherBurst(b.x, b.y, b.z);
    this.sounds.enemyDeath(b.type, b);
    if (this.o.enemyAnims[b.type]?.anims.death) {
      const fallFrom = b.type === CHERUB ? b.feet : undefined;
      this.corpses.push({ start: now, x: b.x, y: b.y, z: b.ground, facing: b.facing, type: b.type, fallFrom });
      if (this.corpses.length > MAX_CORPSES) this.corpses.shift();
    }
  }

  /** A burst death's first 80 ms: the body blasted back along the angle, turning white-gold; then it bursts. */
  private startBurstDeath(b: PendingDeath, info: BurstInfo, now: number): void {
    const tier = info.heavy ? HEAVY : LIGHT;
    const a = info.angle * DEG;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    // The camera's right, horizontally: yaw + 90°.
    const yaw = this.player.yaw;
    const side = (Math.random() < 0.5 ? -1 : 1) * BLAST_SIDE;
    const rx = -Math.sin(yaw) * side;
    const ry = Math.cos(yaw) * side;
    // A Cherub stays at its hover height and flies level.
    const lift = b.type === CHERUB ? 0 : tier.lift;
    const blast: Blast = { start: now, type: b.type, x: b.x, y: b.y, feet: b.feet, facing: b.facing, ex: dx * tier.blast + rx, ey: dy * tier.blast + ry, lift, swell: tier.swell };
    this.blasts.push(blast);
    const mine = info.playerId === this.localId;
    const half = ENEMIES[b.type].height / 2;
    this.pendingFx.push({ at: now + BLAST_MS, run: (t) => this.burst(t, b.type, b.x + blast.ex, b.y + blast.ey, b.feet + half + lift, dx, dy, tier, mine) });
  }

  /**
   * The burst (M12 §4.2 step 2) at the end of the blast, moved toward the camera and up: the burst
   * sprite, the torn pieces, feathers and sparks within the budget, and `burstPop`.
   */
  private burst(now: number, type: number, x: number, y: number, z: number, dx: number, dy: number, tier: Tier, mine: boolean): void {
    const cam = this.scene.camera.position;
    const tx = cam.x - x;
    const ty = cam.z - y;
    const camDist = Math.hypot(tx, ty);
    if (camDist > 1e-6) {
      const k = towardCamera(camDist) / camDist;
      x += tx * k;
      y += ty * k;
    }
    z += BURST_RISE;
    // p: perpendicular to the angle, a random one of the two.
    const ps = Math.random() < 0.5 ? -1 : 1;
    const px = -dy * ps;
    const py = dx * ps;
    this.particles.burstSprite(this.rotations['fx-burst'], x, y, z, tier.sprite0, tier.sprite1);
    this.recentBursts.add(now);
    const n = this.recentBursts.count(now);
    // Beyond 8 bursts in 0.5 s, only the budget's share of them shed pieces (decisions.md, M12 §10).
    if (shedsPieces(n, Math.random())) {
      for (const piece of piecesFor(type)) {
        const along = uniform(piece.along) * tier.pieceSpeed;
        const sideways = uniform(piece.side) * tier.pieceSpeed * (piece.sideSign || (Math.random() < 0.5 ? -1 : 1));
        const vz = uniform(piece.vz) * tier.pieceSpeed;
        this.particles.piece(this.rotations[piece.sprite], x, y, z + piece.dz, dx * along + px * sideways, dy * along + py * sideways, vz, piece.size, piece.turnMs, piece.half);
      }
    }
    const budget = featherBudget(tier.feathers, tier.sparks, n, Math.hypot(x - cam.x, y - cam.z));
    this.particles.burstFeathers(x, y, z, dx, dy, px, py, budget.feathers, budget.sparks);
    if (this.pops.play(now)) this.sounds.burstPop({ x, y }, mine);
    this.massKills.burst(now, mine, x, y);
    if (tier === HEAVY) debugState.bursts.heavy++;
    else debugState.bursts.light++;
  }

  /**
   * Sacrament's beams (M9 §5.1), every frame: the own one from the first-person muzzle while the
   * secondary heals the local ally target; others' from their snapshot `beam`, starting 0.5 m in front
   * of their body center. Embers drift along each toward the ally, or the soul being revived. Returns
   * the players beamed.
   */
  private drawHealBeams(now: number, dt: number): Set<number> {
    const beams: Array<[[number, number, number], [number, number, number]]> = [];
    const beamed = new Set<number>();
    const bodyOf = (id: number): [number, number, number] | null => {
      if (id === this.localId) return this.dead ? null : [this.player.body.x, this.player.body.y, this.player.body.z + PLAYER_HEIGHT / 2];
      const q = this.snaps.playersOut.find((o) => o.id === id);
      if (!q) return null;
      return q.dead ? [q.x, q.y, q.z + this.souls.drawnRise(q.id, now) + SOUL_HEIGHT / 2] : [q.x, q.y, q.z + PLAYER_HEIGHT / 2];
    };
    this.ownBeamOn = false;
    if (this.classId === 'heretic' && this.attack === ATTACK_SECONDARY && !this.dead) {
      const to = bodyOf(this.allyTargetId);
      if (to) {
        this.ownBeamOn = true;
        const [sx, sy] = this.hud.muzzlePoint(now);
        beams.push([this.unproject(sx, sy, OWN_BEAM_DEPTH), to]);
        beamed.add(this.allyTargetId);
        // On a soul, the revive hum plays for as long as the beam, as while shots hit it (M8 §9.1).
        if (this.snaps.playersOut.some((q) => q.id === this.allyTargetId && q.dead)) {
          this.soulHitAt = now;
          this.soulHitId = this.allyTargetId;
        }
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
    this.computeAllyTarget(now);
    this.party?.setAllyTarget(this.allyTargetId);

    let mx = 0;
    let my = 0;
    let wantJump = false;
    let fire = 0;
    this.starPreview = null;
    if (this.over || this.paused || this.dead || this.bot || this.bench) {
      this.starAim.reset();
      if (this.classId === 'fallen' && !this.bot) this.allyTargetId = this.player.leaping ? this.leapAlly : ALLY_NONE;
    }
    if (this.over || this.paused) {
      // The result overlay or Pause: the game keeps rendering without input.
    } else if (this.bench) {
      // The arcade view (M10 §2.3) looks north-east across Arena 1's north arcade, without turning;
      // the gate view (M10 gate §4) looks at the middle of the gate, 10° up.
      if (this.params.benchView === 'arcade') p.yaw = -Math.PI / 4;
      else if (this.params.benchView === 'gate') p.yaw = Math.atan2(GATE_VIEW_Y - p.body.y, GATE_VIEW_X - p.body.x);
      else p.yaw += BENCH_TURN_RATE * dt;
      p.pitch = this.params.benchView === 'gate' ? GATE_VIEW_PITCH : 0;
      // M11 §5: the HUD alone fires the primary attack every interval (no simulation, tracers or sound).
      if (this.params.benchHudFire && now >= this.benchFireAt) {
        this.hudShot(now, ATTACK_PRIMARY);
        this.benchFireAt = Math.max(this.benchFireAt + attackDef(this.classId, ATTACK_PRIMARY).interval * 1000, now - 100);
      }
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
      if (this.classId === 'fallen') fire = this.updateStarAim(now, fire);
    } else {
      // Dead: the camera can only rotate.
      const { dx, dy } = this.input.takeMouse();
      p.look(dx * MOUSE_SENSITIVITY, -dy * MOUSE_SENSITIVITY);
    }
    this.input.jumpQueued = false;
    this.fire = this.dead || this.over ? 0 : fire;
    // Neither attack fires during Shadowstep's slash; held buttons resume afterwards (M12 §5.7).
    if (now - this.slashAt < SHADOWSTEP_TIME * 1000) this.fire = 0;
    const bx = p.body.x;
    const by = p.body.y;
    // Wading (M12 §3.1): the ground enemies of the newest snapshot pressing against the player slow
    // it. Counted every frame, in the benchmark too, which doesn't move the player.
    const newest = this.snaps.newest;
    const pressing = newest && !this.dead ? wadeCount(this.map, p.body.x, p.body.y, p.body.z, newest, this.wadeLaunchedUntil, now) : 0;
    p.wade = this.wading.update(pressing, Math.min(dt, MAX_FRAME_DT));
    debugState.wade.count = pressing;
    debugState.wade.factor = p.wade;
    if (!this.dead && !this.bench && !this.over) p.update(this.map, dt, mx, my, wantJump);
    const moved = Math.hypot(p.body.x - bx, p.body.y - by);
    this.bob.update(Math.min(dt, MAX_FRAME_DT), moved, p.speed, p.body.grounded && !p.leaping, this.dead);
    this.hud.setBob(this.bob.weaponX, this.bob.weaponY);
    // The weapon lags behind the view's turning (M11 §3.2), reset on a teleport like the bob.
    const ft = Math.min(dt, MAX_FRAME_DT);
    const turn = (a: number, b: number) => ((((a - b) * 180) / Math.PI + 540) % 360) - 180;
    const yawRate = ft > 0 ? turn(p.yaw, this.swayYaw) / ft : 0;
    const pitchRate = ft > 0 ? turn(p.pitch, this.swayPitch) / ft : 0;
    this.hud.sway.update(ft, yawRate, pitchRate, this.dead, moved > SWAY_TELEPORT);
    this.swayYaw = p.yaw;
    this.swayPitch = p.pitch;
    // The weapon dims in shade like the characters (M11 §3.5); under a fixed screenshot camera, in its light.
    const lc = this.params.cam;
    this.hud.setLight(lc ? this.lightAt(lc.x, lc.y) : this.lightAt(p.body.x, p.body.y), ft);

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

    // Particles move before this frame's new ones spawn, so each is first drawn at age 0 (a burst
    // sprite lives only 220 ms).
    this.particles.update(dt);
    // Deaths and censer breaks whose time has come.
    this.burstMemory.expire(now);
    for (let i = this.pendingBursts.length - 1; i >= 0; i--) {
      const b = this.pendingBursts[i];
      if (now < b.at) continue;
      if (b.censer) {
        // The censer breaks (M9 §5.1): a small burst, and its incense cloud where it broke.
        this.particles.censerBreak(b.x, b.y, b.z);
        this.vfx.glow(now, b.x, b.y, b.z, 0xf08a24, 0.15, 0.6, 250);
        this.sounds.censerBreak(b);
        this.incense.add(now, b.x, b.y, (x, y) => this.cloudBase(x, y, b.z));
      } else {
        // A burst's ripple delays it once (M12 §4.2).
        const ripple = this.burstMemory.peek(b.slot, now)?.ripple ?? 0;
        if (ripple > 0 && !b.rippled) {
          b.rippled = true;
          b.at += ripple;
          if (now < b.at) continue;
        }
        this.playDeath(b, now);
      }
      this.pendingBursts.splice(i, 1);
    }
    const mass = this.massKills.update(now);
    if (mass) {
      this.sounds.massKill(mass);
      debugState.bursts.massKills++;
      if (mass.mine) this.shake.add(now, massKillShake(mass.count));
    }
    this.flinches.expire(now);
    for (let i = this.pendingFx.length - 1; i >= 0; i--) {
      if (now < this.pendingFx[i].at) continue;
      const fx = this.pendingFx[i];
      this.pendingFx.splice(i, 1);
      fx.run(now);
    }
    this.updateField(now, Math.min(dt, MAX_FRAME_DT));
    // Gold embers rise from the incense clouds, 4 per second each.
    if (this.incense.count && Math.random() < INCENSE_EMBERS_PER_S * this.incense.count * Math.min(dt, MAX_FRAME_DT)) {
      const at = this.incense.randomPoint();
      if (at) this.particles.incenseEmber(at[0], at[1], at[2]);
    }
    // Before the effects update, so the new ones are placed and faced on their first frame.
    // Your Falling Star lands as the leap ends: its ring and glow, its sound and the shake (M12 §5.2, §4.5).
    if (this.wasLeaping && !p.leaping) {
      this.shake.add(now, SHAKE_LANDING);
      this.landingFx(now, p.body.x, p.body.y, p.body.z);
      this.sounds.ownLanding();
    }
    this.wasLeaping = p.leaping;
    // Your Shadowstep's streak, from where it started to where it ended, as the dash ends (M12 §5.7).
    if (this.wasDashing && !p.dashing && this.dashFrom) {
      this.dashStreak(now, ...this.dashFrom, p.body.x, p.body.y, p.body.z);
      this.sounds.ownDaggerCut();
      debugState.streakAt = now;
      this.dashFrom = null;
    }
    this.wasDashing = p.dashing;
    this.vfx.update(now, this.scene.camera.position);
    this.incense.update(now, this.scene.camera.position);

    const b = p.body;
    audio()?.setListener(b.x, b.y, p.yaw);
    // The bob only lowers the drawn view; aiming and input use the unbobbed eye (M8 §3.4). While dead,
    // the camera rises with the soul: 1.6 m above its base (M8 §4.3). The shake offsets the view only (M12 §4.5).
    const sh = this.shake.sample(now);
    const vyaw = p.yaw + sh.yaw * DEG;
    const vpitch = p.pitch + sh.pitch * DEG;
    if (this.dead) this.scene.setView(b.x, b.y, this.ownGround, vyaw, vpitch, PLAYER_EYE + this.souls.rise(this.localId, now), sh.roll * DEG);
    else this.scene.setView(b.x, b.y, b.z, vyaw, vpitch, PLAYER_EYE - this.bob.eyeDrop, sh.roll * DEG);
    const cam = this.params.cam;
    if (cam) {
      const ci = Math.floor(cam.y) * this.map.w + Math.floor(cam.x);
      this.scene.setView(cam.x, cam.y, cam.z ?? (this.map.floor[ci] ?? 0) + PLAYER_EYE, cam.yaw, cam.pitch, 0);
    }
    this.drawStarPreview();
    this.drawBillboards(now, ents, enemyZ);
    const beamed = this.drawHealBeams(now, Math.min(dt, MAX_FRAME_DT));
    this.hud.setHealing(this.ownBeamOn, now);
    this.hud.setBeamed(beamed.has(this.localId));
    this.party?.setBeamed(beamed);
    this.scene.render();
    this.placeChevron(now);
    this.placeSoulMarkers(now);
    this.updateReviveHum(now);

    // Low HP (M12 §6.2): the heartbeat and the crimson edge.
    if (this.lowHp.update(now, this.seenSelf && !this.dead && !this.over, this.ownHp, this.maxHp)) this.sounds.heartbeat();
    this.hud.setLowEdge(this.lowHp.edge(now));
    this.hud.setCooldowns(this.displayedCooldown('Q', simNow), ABILITIES[this.classId].Q.cooldown, this.displayedCooldown('E', simNow), ABILITIES[this.classId].E.cooldown);
    this.hud.update(now);
    debugState.fps = this.fps.frame(now);
    debugState.simMs = this.o.host ? this.o.host.simMs(now) : 0;
    debugState.director = this.o.host?.director ?? null;
    debugState.netInKBps = this.o.net ? this.o.net.inKBps(now) : 0;
    debugState.netOutKBps = this.o.net ? this.o.net.outKBps(now) : 0;
    if (this.params.dev) {
      Object.assign(debugState.self, { x: b.x, y: b.y, z: b.z, yaw: p.yaw, pitch: p.pitch });
      let near = 0;
      let sx = 0;
      let sy = 0;
      for (let i = 0; i < ents.count; i++) {
        if ((ents.x[i] - b.x) ** 2 + (ents.y[i] - b.y) ** 2 > 64) continue;
        near++;
        sx += ents.x[i] - b.x;
        sy += ents.y[i] - b.y;
      }
      debugState.near = near;
      debugState.nearYaw = Math.atan2(sy, sx);
      let best = 30 * 30;
      debugState.casterAim = null;
      for (let i = 0; i < ents.count; i++) {
        if (ents.type[i] !== CHORISTER) continue;
        const dx = ents.x[i] - b.x;
        const dy = ents.y[i] - b.y;
        const d2 = dx * dx + dy * dy;
        if (d2 > best) continue;
        best = d2;
        const dz = enemyZ[i] + ENEMIES[CHORISTER].height / 2 - (b.z + PLAYER_EYE);
        debugState.casterAim = { yaw: Math.atan2(dy, dx), pitch: Math.atan2(dz, Math.sqrt(d2)) };
      }
      // Set by updateStarAim during this frame (the reset above it would narrow it to null).
      const l = this.starPreview as Landing | null;
      debugState.star = l ? { x: l.x, y: l.y, z: l.z, valid: l.valid, ally: l.ally } : null;
    }
    this.overlay.position.x = b.x;
    this.overlay.position.y = b.y;
    this.overlay.position.z = b.z;
    this.overlay.position.yaw = p.yaw;
    this.overlay.update(now);
    this.bench?.onFrame(now, dt);
  };

  private readonly glowScratch: Glow = { r: 1, g: 1, b: 1, a: 0 };

  /** The baked lightmap's L (0–1) at a point (M10 §5.4), nearest texel; 1 off the map. */
  private lightAt(x: number, y: number): number {
    const img = this.scene.terrain.lightmap.image as { data: Uint8Array; width: number; height: number };
    const tx = Math.floor(x * LIGHTMAP_TEXELS);
    const ty = Math.floor(y * LIGHTMAP_TEXELS);
    if (tx < 0 || ty < 0 || tx >= img.width || ty >= img.height) return 1;
    return img.data[(ty * img.width + tx) * 4 + 3] / 255;
  }

  /** The floor height of the cell at a point (−∞ over walls and outside the grid). */
  private readonly floorAt = (x: number, y: number): number => {
    const c = Math.floor(x);
    const r = Math.floor(y);
    if (c < 0 || r < 0 || c >= this.map.w || r >= this.map.h || this.map.wall[r * this.map.w + c]) return -Infinity;
    return this.map.floor[r * this.map.w + c];
  };

  private drawBillboards(now: number, ents: { count: number; slot: Uint16Array; x: Float32Array; y: Float32Array; type: Uint8Array; state: Uint8Array; flags: Uint8Array }, enemyZ: Float32Array): void {
    const bb = this.billboards;
    bb.begin();
    const shadows = this.shadows;
    shadows.begin();
    if (!this.dead) shadows.add(this.player.body.x, this.player.body.y, this.floorAt(this.player.body.x, this.player.body.y), PLAYER_RADIUS * SHADOW_SIZE);
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
      const stunned = (ents.flags[i] & FLAG_STUNNED) !== 0;
      this.animator.setStunned(slot, stunned, now);
      const pick = this.animator.pick(slot, now, this.bossCast);
      const f = set.anims[pick.anim][spriteDirection(this.animator.facing[slot], eye.x - x, eye.y - y)][pick.frame];
      const height = f.height * ENEMIES[type].draw;
      const target = this.enemyBillboards.get(type)!;
      const def = ENEMIES[type];
      const flags = ents.flags[i];
      // Launched by a Falling Star: the billboard flies an arc, peaking 1 m up halfway (M9 §3.2). A
      // flying Cherub is knocked back level, so nothing rises above the headroom (M10 §3.1).
      const lu = def.flying ? 1 : (now - this.launchAt[slot]) / LAUNCH_MS;
      let z = enemyZ[i] + (lu >= 0 && lu < 1 ? 4 * LAUNCH_HEIGHT * lu * (1 - lu) : 0);
      // A local hit's flinch (M12 §4.4): pushed along the shot and the camera's right, squashed, glowing.
      let fx = ents.x[i];
      let fy = ents.y[i];
      let wide = 1;
      let tall = 1;
      const fl = this.flinches.at(slot, now);
      if (fl) {
        fx += fl.dx - Math.sin(this.player.yaw) * fl.right;
        fy += fl.dy + Math.cos(this.player.yaw) * fl.right;
        z += fl.dz;
        wide = fl.wide;
        tall = fl.tall;
      }
      // Stunned: it trembles along the camera's right (M12 §5.3).
      if (stunned) {
        const off = STUN_TREMBLE * Math.sin(2 * Math.PI * STUN_TREMBLE_HZ * (now / 1000) + slot);
        fx -= Math.sin(this.player.yaw) * off;
        fy += Math.cos(this.player.yaw) * off;
      }
      // Status (§10): the local flinch, the hurt flash, the stun's red (M12 §5.3), Judgment, the wind-up's
      // gold glow, in that order; the silenced grey tint.
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
      if (fl && fl.glow > 0) {
        const g = this.flinchGlow;
        g.r = fl.kind.r;
        g.g = fl.kind.g;
        g.b = fl.kind.b;
        g.a = fl.glow;
        glow = g;
      } else if (flashT < ENEMY_FLASH_MS) {
        this.flashGlow.a = ENEMY_FLASH_PEAK * (1 - flashT / ENEMY_FLASH_MS);
        glow = this.flashGlow;
      } else if (stunned) glow = GLOW_STUNNED;
      else if (judgment) glow = judgment;
      else if (ents.state[i] === ST_WINDUP) glow = GLOW_WINDUP;
      const grey = (flags & FLAG_SILENCED) !== 0;
      target.add(f, fx, fy, z, height * tall, false, grey ? 0.55 : 1, grey ? 0.55 : 1, grey ? 0.6 : 1, glow, 1, wide);
      // Contact shadows only under the players and the Gatekeeper, not the swarm: cut for the
      // performance gate (M10 §2.3 cut 3, decisions).
      if (type === GATEKEEPER) shadows.add(x, y, this.floorAt(x, y), def.radius * SHADOW_SIZE);
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
      this.enemyBillboards.get(c.type)!.add(af, c.x, c.y, c.z - cf.sink, af.height * ENEMIES[c.type].draw, false);
    }
    if (gone) this.corpses.splice(0, gone);
    this.drawBlasts(now, eye);
    const proj = this.snaps.projOut;
    const seen = this.projSeen;
    seen.clear();
    while (this.censerShots.length && now - this.censerShots[0].at > CENSER_CLAIM_MS) this.censerShots.shift();
    for (let i = 0; i < proj.count; i++) {
      const k = proj.kind[i];
      const slot = proj.slot[i];
      seen.add(slot);
      let x = proj.x[i];
      let y = proj.y[i];
      let z = proj.z[i];
      if (k === PROJ_CENSER) {
        let own = this.ownCensers.get(slot);
        // A censer new this frame, near the player, just after a local censer shot: the local player's.
        if (!own && !this.projPrev.has(slot) && this.censerShots.length && Math.hypot(x - this.player.body.x, y - this.player.body.y) < CENSER_CLAIM_DIST) {
          const shot = this.censerShots.shift()!;
          own = { at: now, dx: shot.from[0] - x, dy: shot.from[1] - y, dz: shot.from[2] - z };
          this.ownCensers.set(slot, own);
        }
        if (own) {
          const f = Math.max(0, 1 - (now - own.at) / CENSER_BLEND_MS);
          x += own.dx * f;
          y += own.dy * f;
          z += own.dz * f;
        }
      }
      if (k !== PROJ_ARROW) {
        bb.add(this.frames[PROJECTILE_SPRITES[k]], x, y, z, PROJECTILE_SIZES[k], true, 1, 1, 1, k === PROJ_GLOBE ? GLOW_GLOBE : NO_GLOW);
        continue;
      }
      // A Cherub arrow (M12 §6.3): glowing cyan, its embers trailing behind it along its flight, from
      // where it was drawn last frame.
      bb.add(this.frames[PROJECTILE_SPRITES[k]], x, y, z, PROJECTILE_SIZES[k], true, 1, 1, 1, GLOW_ARROW);
      const o = slot * 3;
      const last = this.projLastFrame[slot] === this.frameNo - 1;
      const dx = x - this.projLast[o];
      const dy = y - this.projLast[o + 1];
      const dz = z - this.projLast[o + 2];
      const len = Math.hypot(dx, dy, dz);
      this.projLast[o] = x;
      this.projLast[o + 1] = y;
      this.projLast[o + 2] = z;
      this.projLastFrame[slot] = this.frameNo;
      if (!last || len < 1e-6) continue;
      ARROW_TRAIL_SIZES.forEach((size, i) => {
        const back = (ARROW_TRAIL_STEP * (i + 1)) / len;
        bb.add(this.frames.ember, x - dx * back, y - dy * back, z - dz * back, size, true, 1, 1, 1, GLOW_ARROW);
      });
    }
    for (const slot of this.ownCensers.keys()) if (!seen.has(slot)) this.ownCensers.delete(slot);
    this.projSeen = this.projPrev;
    this.projPrev = seen;
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
      shadows.add(q.x, q.y, this.floorAt(q.x, q.y), PLAYER_RADIUS * SHADOW_SIZE);
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
    this.particles.draw(bb, this.scene.camera.position.x, this.scene.camera.position.z);
    bb.end(this.scene.camera);
    shadows.end();
    for (const b of this.enemyBillboards.values()) b.end(this.scene.camera);
    for (const b of this.playerBillboards.values()) b.end(this.scene.camera);
  }

  private readonly blastGlow: Glow = { r: 1, g: 0.78, b: 0.32, a: 0 };

  /**
   * Bodies being blasted back (M12 §4.2 step 1): the first pain frame, flying along the angle and
   * sideways, lifted and swelling with an ease-out, turning white-gold, for 80 ms.
   */
  private drawBlasts(now: number, eye: { x: number; y: number }): void {
    for (let i = this.blasts.length - 1; i >= 0; i--) {
      const b = this.blasts[i];
      const u = (now - b.start) / BLAST_MS;
      if (u >= 1) {
        this.blasts.splice(i, 1);
        continue;
      }
      const set = this.o.enemyAnims[b.type];
      if (!set || u < 0) continue;
      const e = 1 - (1 - u) * (1 - u);
      const x = b.x + b.ex * e;
      const y = b.y + b.ey * e;
      const f = set.anims.pain[spriteDirection(b.facing, eye.x - x, eye.y - y)][0];
      this.blastGlow.a = BLAST_GLOW_FROM + (BLAST_GLOW_TO - BLAST_GLOW_FROM) * u;
      const s = 1 + (b.swell - 1) * e;
      this.enemyBillboards.get(b.type)!.add(f, x, y, b.feet + b.lift * e, f.height * s * ENEMIES[b.type].draw, false, 1, 1, 1, this.blastGlow, 1, s);
    }
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
    window.__heavenfallTeleport = undefined;
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
    this.incense.dispose();
    this.hum?.stop();
    this.hud.dispose();
    this.bench?.dispose();
    this.scene.dispose();
    this.o.root.replaceChildren();
  }
}
