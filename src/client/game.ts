import { CARRIER_SWOOP, hymnalReduction } from '../data/commanders';
import { CommanderProjection } from './commanders';
import { CommanderView } from './commanderView';
import { DamageNumbers, loadDamageNumbersSetting } from './damageNumbers';
import { HitArcs, arcAngle, hurtShake } from './hitArcs';
import { WatchmanProjection } from './watchmen';
import { BELL_FORWARD, ROD_BELL_FORWARD, WatchmanView } from './watchmanView';
import { WATCHMAN_MUZZLE_Z, type WatchmanAim } from '../data/watchman';
import { RewardShafts, rewardPickupIds, rewardSpot } from './rewardShaft';
import { rewardLabel } from '../gen/rewards';
/** The in-game client: input or bot, local movement, snapshots, interpolation, rendering and feedback. */
import { CLASSES, type ClassId } from '../data/classes';
import { DECOR, decorSprite } from '../data/decor';
import * as THREE from 'three';
import { BOSS_PART, CANTOR, CARRIER, isCommander, CHORISTER, DOMINION, ENEMIES, GATEKEEPER, LAUNCH_HEIGHT, ST_FALLING, ST_WINDUP, WATCHMAN } from '../data/enemies';
import { DOMINION_RADIUS } from '../data/dominion';
import { DominionProjection } from './dominion';
import { DominionView } from './dominionView';
import { HazardView } from './hazards';
import { SpawnProjection } from './spawns';
import { SpawnView } from './spawnView';
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
  SHOTGUN_CLOSE_DAMAGE,
  SHOTGUN_KNOCKBACK_RANGE,
  SHROUD_BURST_RADIUS,
  type AttackSlot,
} from '../data/weapons';
import { debugState } from '../debug';
import type { CtrlMessage, GameEvent, LobbyPlayer } from '../net/messages';
import type { NetStats } from '../net/netStats';
import type { LinkQuality } from '../net/linkQuality';
import { ALLY_NONE, encodeInput, FLAG_HURT, FLAG_ROOTED, FLAG_SILENCED, FLAG_STUNNED, FLAG_TAUNTED, PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN, type Snapshot } from '../net/protocol';
import type { Transport } from '../net/transport';
import type { Params } from '../params';
import { aimDir, BURST_HEAVY, burstAngle, rayCylinder, rayEnemy } from '../sim/combat';
import { shotSpread } from '../sim/shotSpread';
import { PREDICTION_MAX_MS, PredictedDeaths, revealTick } from './predictedDeaths';
import { ENEMY_SLOTS, PLAYER_EYE, PLAYER_HEIGHT, PROJECTILE_SLOTS, TICK_DT, TICK_MS } from '../sim/constants';
import { raycastTerrain } from '../sim/los';
import { applyLeaves, leafOpen, overVoid, type GameMap } from '../sim/map';
import { distToCylinder, groundHeight } from '../sim/movement';
import { BOSS_CAST_JUDGMENT, GLOBE_BLAST, GLOBE_SHOT_BLAST, PROJ_ARROW, PROJ_CENSER, PROJ_GLOBE, PROJECTILE_RANGE } from '../sim/sim';
import { OwnCensers, type CenserBreak, type CenserWorld } from './ownCensers';
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
import { latchBits, latchClear, latchFired, latchPress, newFireLatch } from '../sim/fireLatch';
import { Flinches, HIT_FLINCH, KILL_FLINCH, KillConfirmations, OwnDamage, PredictedKills, predictHit, predictPellets, predictSilverBullet, type PelletTarget, type Predicted } from './killPredict';
import { BurstPops, MassKills } from './massKill';
import { dominionShake, massKillShake, Shake, SHAKE_BLASPHEMY, SHAKE_LANDING, SHAKE_SHROUD, SHROUD_SHAKE_RANGE } from './shake';
import { LIGHTMAP_TEXELS } from '../render/lightmap';
import { Bot, type BotBoss, type BotEnemy } from './bot';
import { corpseFrame, EnemyAnimator, spriteDirection, type Corpse } from './enemyAnim';
import { FpsCounter } from './fps';
import type { HostSession } from './hostSession';
import { Hud } from './hud';
import { Input, MOUSE_SENSITIVITY } from './input';
import { WADE_LAUNCH_MS, wadeCount, Wading } from './wading';
import { ARC_SEGMENTS, arcPoint, StarAim, starLanding, walkableCells, type Landing, type StarAlly } from './fallingStarAim';
import { HEAL_FADE_MS, HEAL_VIGNETTE, HURT_FADE_MS, hurtVignette, LowHp, SHIELD_EDGE, SHIELD_FADE_MS, SHIELD_GONE_FLASH, SHIELD_UP_FLASH } from './lowHp';
import { audio, sfx, type LoopHandle } from '../audio/audio';
import { SOUL_HEIGHT, SOUL_RADIUS } from '../sim/souls';
import { pickAllyTarget } from './allyTarget';
import { GameSounds } from './sounds';
import { ViewBob } from './bob';
import { SoulView } from './soulView';
import { LocalPlayer, MAX_FRAME_DT, wasdDirection } from './localPlayer';
import { PartyFrames } from './partyFrames';
import { PlayerAnimator } from './playerAnim';
import { SnapshotBuffer, type InterpolatedEnemies } from './snapshots';
import { RunEvents } from '../net/runEvents';
import type { Floor } from '../gen/generate';
import { ClientRooms, roomMessage } from './rooms';
import { PickupView } from './pickups';
import { PropView } from './props';
import { propDefs } from '../data/props';
import { FEATHER_SPEED, ITEMS } from '../data/items';
import { MapView, type MapPlayer } from './mapView';
import { ShopView } from './shop';
import type { InventoryState } from '../net/messages';
import { ItemView } from './itemView';
import { FeatherTrails } from './featherTrail';
import type { VictoryState } from '../sim/victory';
import { levelForXp } from '../profile/model';
import { TalentClient } from './talentClient';
import { riteOverlay, talentPanel, type RiteOverlay, type TalentPanel } from '../ui/talents';
import { ALT_ABILITIES, BINDER, GATEBREAKER, RAIN, hasCatalog } from '../data/talents';
import { aimedWalk, rainPoint } from '../sim/talentGeometry';
/** Alternatives whose `abilityUsed` the base class key must not draw or sound (R5). */
const ALT_SFX_KEYS = new Set(['castOut', 'gatebreaker', 'rainOfFire', 'breadOfAngels', 'trialByFire', 'cloudOfWitnesses', 'well', 'ring', 'boundary']);
import { ADVOCATE_REACH } from '../sim/sim';
import type { RiteOffer } from '../net/messages';
import { advocateSprite } from './advocate';
import { RelicView } from './relicView';
import { RelicHud } from './relicHud';
import { RouteView } from './routeView';
import { advocateHub, relicOfferOverlay, relicPanel, type RelicOfferOverlay, type RelicPanel } from '../ui/relics';
import { relicDormancy } from '../sim/relicUse';
import { resolveKit } from '../sim/build';
import { SOURCE_BELL_FIRST, SOURCE_CHEST } from '../sim/route';
import { KEY } from '../data/pickups';
import type { RelicOfferState, RouteState } from '../net/messages';
import type { RelicId } from '../data/relics';
import { STREAK_NAMES } from '../sim/streaks';
import { sentenceLabel } from '../data/edicts';
import { GatekeeperView, partsOf, sightState, sightWindow, ringContactIn, type PartView } from './gatekeeperView';
import { BOSS_CAST_CALL, BOSS_CAST_TOLL, BOSS_CAST_VOLLEY, BOSS_FLAG_DEFERRED, BOSS_FLAG_WATCHERS, BOSS_PHASE_INVULNERABLE, FLAG_PART_OPENING, FLAG_PART_SEAL } from '../data/gatekeeper';

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
/** Its gust of air leaves this far below the eye (M12 follow-up §2.4). */
const GUST_BELOW_EYE = 0.25;
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
  bot?: boolean;
}

export interface GameOptions {
  root: HTMLElement;
  map: GameMap;
  floor: Floor | null;
  runId: string;
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
  /** Resolved dev start room; multiplayer always waits for the host's placement. */
  startRoom?: number;
  /** Singleplayer pauses the simulation while the Pause overlay is open (§3); multiplayer shows party frames. */
  singleplayer: boolean;
  /** Payload bytes over PeerJS, in multiplayer (§2.5). */
  net: NetStats | null;
  /** A client's round trip to the host and its route (F3); null on the host and in single player. */
  link?: LinkQuality | null;
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
  private maxHp: number;
  /** The bargain's cut from max HP, drawn dark at the HP bar's end (game.md §9.6). */
  private hpCut = 0;
  private readonly scene: GameScene;
  private readonly canvas: HTMLCanvasElement;
  private readonly input: Input;
  private readonly player: LocalPlayer;
  private readonly overlay: DebugOverlay;
  private readonly hud: Hud;
  private readonly rooms: ClientRooms;
  private readonly mapView: MapView;
  private readonly shop: ShopView;
  private readonly itemView: ItemView;
  /** R6: relic areas, projectiles and rings, and the HUD's relic strip and streak banner. */
  private readonly relicView: RelicView;
  private readonly relicHud: RelicHud;
  private readonly featherTrails = new FeatherTrails();
  private readonly shopHint = document.createElement('div');
  private inventory: InventoryState | null = null;
  private nextRequestId = 1;
  private victory: VictoryState | null = null;
  private readonly victoryHint = document.createElement('div');
  private readonly pause: PauseOverlay;
  /** Talents (R4): every player's kit, the Betrayer's areas, and the open Rite or Talents view. */
  private readonly talents: TalentClient;
  /** From the floor checkpoint; until then nothing is treated as a free-points development run. */
  private progressionEnabled = true;
  private overlayView: { kind: 'rite'; view: RiteOverlay; offerId: number } | { kind: 'talents'; view: TalentPanel }
    | { kind: 'relicOffer'; view: RelicOfferOverlay; offerId: number } | { kind: 'relics'; view: RelicPanel } | { kind: 'advocate'; view: { el: HTMLElement; setMessage(text: string): void } } | null = null;
  /** R6: the key, the chest and the Bells; the own pending relic offers. */
  private readonly routeView: RouteView;
  private relicOffers: RelicOfferState[] = [];
  private readonly ritePip = document.createElement('div');
  private readonly party: PartyFrames | null;
  private paused = false;
  /** performance.now() when the Pause overlay opened. */
  private pausedAt = 0;
  /** Whether pointer lock was held at the previous `pointerlockchange`. */
  private wasLocked = false;
  private readonly fps = new FpsCounter();
  private readonly snaps: SnapshotBuffer;
  private readonly runEvents: RunEvents;
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
  /** A room is sealed (the host refuses loadout changes then, rogue game.md §9.6). */
  private sealed = false;
  private qPresses = 0;
  private ePresses = 0;
  private itemPresses = [0, 0];
  /** The mouse buttons as the input's `fire` bits (M9 §10). */
  private fire = 0;
  /** The attack the held buttons pick locally this frame (M9 §2.1). */
  private attack: AttackSlot = ATTACK_NONE;
  /** Cosmetic fire timer, shared by both attacks and run locally at 30 Hz (M9 §2.2). */
  private fireTimer = 0;
  /** Mouse press counters sent to the host, and the presses waiting for their shot (click latching). */
  private leftPresses = 0;
  private rightPresses = 0;
  private readonly latch = newFireLatch();
  /** Ticks of the cosmetic fire timer so far: the latch's clock. */
  private fireTick = 0;
  /** The shots the cosmetic fire timer fired, sent to the host, and the latest one's button (client-timed shots). */
  private shots = 0;
  private shotButton: 0 | 1 = 0;
  /** The latest shot's aim and view, which every input repeats (netcode stage 4). */
  private readonly shotAim = { yaw: 0, pitch: 0, tick: -1, gap: 0, frac: 0 };
  /** The view's yaw and pitch last frame, for the weapon's sway (M11 §3.2). */
  private swayYaw = 0;
  private swayPitch = 0;
  /** The local player's own censers, flown here from the click (netcode stage 4). */
  private readonly ownCensers = new OwnCensers();
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
  private readonly pickups: PickupView;
  private readonly props: PropView;
  private readonly commanders: CommanderProjection;
  private readonly watchmen: WatchmanProjection;
  private readonly watchmanView: WatchmanView;
  /** The Gatekeeper's ring, parts, chain and threads (rogue bosses.md §3.5 Client). */
  private readonly gatekeeperView: GatekeeperView;
  /** The Toll impacts seen in snapshot headers, newest last (at most two rings roll at once). */
  private tollImpacts: number[] = [];
  /** The ring impact whose whoosh already played. */
  private whooshed = 0;
  /** The crosshair eye's last test (every 100 ms) and result. */
  private sightAt = -Infinity;
  private sight: 'full' | 'half' | 'none' = 'none';
  /** The cycle whose Judgment pre-warning played. */
  private prewarned = Number.NaN;
  private readonly commanderView: CommanderView;
  private readonly damageNumbers: DamageNumbers;
  private readonly hitArcs: HitArcs;
  private readonly rewardShafts: RewardShafts;
  private readonly dominion: DominionProjection;
  private readonly dominionView = new DominionView();
  private readonly hazards: HazardView;
  private readonly spawnWarnings: SpawnProjection;
  private readonly spawnView = new SpawnView();
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
  /** The host's cooldown has started for the last local E press: from then on it rules (close-quarters refunds shorten it). */
  private eAcked = true;
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
  /** Each leaf's state its door was last drawn in (room by room, leaf by leaf): 1 closed, 0 open, -1 before the first snapshot. */
  private leafDrawn: Int8Array;
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
  /** The share of predicted kills the host confirmed (F3, the lag test). */
  private readonly confirmations = new KillConfirmations();
  /** The damage this screen's shots dealt that the snapshots don't show yet (netcode stage 3). */
  private readonly ownDamage = new OwnDamage();
  /** Enemies the local player's screen predicted it killed: they die at once and stay hidden (netcode stage 2). */
  private readonly deaths = new PredictedDeaths();
  /** Predicted kills that reappeared because the host's snapshots kept them alive (F3, the lag test). */
  private revealedKills = 0;
  /** The host's reports of the local player's other kills, slot and incarnation pairs, to play next frame (netcode stage 4). */
  private readonly reportedKills: number[] = [];
  /** Reported kills that died at once instead of after the render delay (the lag test). */
  private reportedEarly = 0;
  private readonly flinches = new Flinches();
  private readonly shake = new Shake();
  private wasLeaping = false;
  /** Falling Star aimed anywhere (M12 §5.2): the hold, the walkable cells (once per map), this frame's preview, the ally leapt to. */
  private readonly starAim = new StarAim();
  /** Gatebreaker's key is still held since its charge started. */
  private chargeHeld = false;
  private walkable: Uint8Array | null = null;
  private starPreview: Landing | null = null;
  /** An aimed cast's preview while its key is held (R5: Rain of Fire, the Well, the Boundary): feet, radius, validity and an optional line. */
  private aimPreview: { at: [number, number, number]; radius: number; valid: boolean; line?: [[number, number, number], [number, number, number]] } | null = null;
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
    this.scene = new GameScene(this.canvas, this.map, o.textures.terrain, o.textures.fx.glow, o.floor);
    this.pickups = new PickupView(this.map, o.runId, o.textures.fx.glow, o.atlas);
    this.scene.scene.add(this.pickups.group);
    this.props = new PropView(this.map, o.runId, propDefs(o.floor), this.scene.terrain.lightmap, o.atlas);
    this.scene.scene.add(this.props.billboards.mesh);
    this.dominion = new DominionProjection(o.runId);
    this.commanders = new CommanderProjection(o.runId);
    this.watchmen = new WatchmanProjection(o.runId);
    this.commanderView = new CommanderView(o.textures.fx.beam, o.textures.fx.glow);
    this.scene.scene.add(this.commanderView.group);
    this.watchmanView = new WatchmanView(o.textures.fx.beam, !o.enemyAnims[WATCHMAN], o.params.dev);
    this.scene.scene.add(this.watchmanView.group);
    this.gatekeeperView = new GatekeeperView(o.textures.fx.beam);
    this.scene.scene.add(this.gatekeeperView.group);
    this.rewardShafts = new RewardShafts(o.textures.fx.beam);
    this.scene.scene.add(this.rewardShafts.group);
    this.spawnWarnings = new SpawnProjection(o.runId, this.map);
    this.scene.scene.add(this.spawnView.group);
    this.scene.scene.add(this.dominionView.group);
    this.hazards = new HazardView(this.map, o.textures.terrain.refiner); this.scene.scene.add(this.hazards.group);
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
    this.damageNumbers = new DamageNumbers(this.hud.root);
    this.hitArcs = new HitArcs(this.hud.root);
    this.hud.onChatSend = (text) => o.onChat?.(text);
    this.hud.setHp(this.maxHp, 0, this.maxHp);
    this.hud.setRemaining(null);
    this.hud.setDeath(null);
    this.rooms = new ClientRooms(this.map, o.runId);
    this.mapView = new MapView(this.hud.root, this.rooms, o.floor, this.localId);
    this.shop = new ShopView(this.map, o.floor); this.scene.scene.add(this.shop.group);
    this.itemView = new ItemView(this.map);
    this.scene.scene.add(this.itemView.group);
    this.relicView = new RelicView(this.map, this.vfx);
    this.scene.scene.add(this.relicView.group);
    this.relicHud = new RelicHud(this.hud.root);
    this.routeView = new RouteView(this.map, o.textures.fx.beam);
    this.scene.scene.add(this.routeView.group);
    this.shopHint.className = 'shop-hint'; this.hud.root.append(this.shopHint);
    this.victoryHint.className = 'victory-hint'; this.hud.root.append(this.victoryHint);
    this.party = o.singleplayer ? null : new PartyFrames(this.hud.leftColumn, this.hud.ownFrame);
    this.sounds = new GameSounds(this.map, this.localId, (id) => this.classOf(id), (id, slot) => {
      const ab = this.talents?.ability(id, slot);
      return ab && ALT_SFX_KEYS.has(ab) ? ab : undefined;
    });
    this.hud.onReady = () => this.sounds.abilityReady();
    this.overlay = new DebugOverlay(o.root, this.params.dev);
    this.pause = new PauseOverlay(o.root, () => this.resume(), () => this.leave());
    this.talents = new TalentClient({
      vfx: this.vfx, glow: o.textures.fx.glow, localId: this.localId,
      classOf: (id) => this.classOf(id), pose: (id) => this.playerPose(id),
      later: (id, run) => this.later(id, run),
      map: this.map, tick: () => this.snaps.estimatedTick(performance.now()),
      incense: this.incense, cloudBase: (x, y, z) => this.cloudBase(x, y, z),
    });
    this.scene.scene.add(this.talents.group);
    if (o.floor) this.scene.scene.add(advocateSprite(this.map, o.floor.confessional));
    this.ritePip.className = 'rite-pip'; this.ritePip.hidden = true; this.hud.root.append(this.ritePip);

    this.input = new Input(this.canvas);
    this.input.pointerLockAllowed = !this.params.bot && this.params.benchArena < 0;
    this.input.onKey = (code) => this.onKey(code);
    // Hold M and click a cleared room to return there (rogue game.md §5.5).
    this.input.onMapClick = () => this.mapClick();
    this.mapView.onClick = () => { if (!document.pointerLockElement) this.mapClick(); };
    document.addEventListener('pointerlockchange', this.onPointerLockChange);
    document.addEventListener('visibilitychange', this.onVisibility);

    const [sc, sr] = this.params.benchArena >= 0 ? this.map.rooms[this.params.benchArena].entry[0].cells[0] : o.startRoom !== undefined ? this.map.rooms[o.startRoom].entry[0].cells[index] : this.map.spawns[index];
    this.player = new LocalPlayer(sc + 0.5, sr + 0.5, this.map.floor[sr * this.map.w + sc], CLASSES[me.classId].speed);
    this.leafDrawn = new Int8Array(this.map.rooms.reduce((n, a) => n + a.leaves.length, 0)).fill(-1);

    this.runEvents = new RunEvents(o.runId);
    this.snaps = new SnapshotBuffer(o.host ? 1.5 : 4.5, o.runId);
    this.snaps.onComplete = (s, prev) => this.onSnapshot(s, prev);
    o.transport.onSnapshot = (buf) => this.snaps.addPart(buf, performance.now());

    this.bot = this.params.bot ? new Bot(this.map) : null;
    // The published pose follows at once; otherwise it shows the old place until the next frame draws.
    if (this.params.dev) window.__heavenfallTeleport = (x, y) => {
      const z = this.map.floor[Math.floor(y) * this.map.w + Math.floor(x)];
      this.player.teleport(x, y, z);
      Object.assign(debugState.self, { x, y, z });
    };
    // Dev: turn the view (e2e screenshots of what a player sees, e.g. facing the Gatekeeper).
    if (this.params.dev) window.__heavenfallLook = (yaw, pitch = 0) => { this.player.yaw = yaw; this.player.pitch = pitch; };
    this.bench = this.params.benchArena >= 0 && o.host ? new BenchRunner(o.root, o.host, () => this.scene.rendererString(), () => this.scene.renderStats()) : null;

    debugState.players = o.roster.map((r) => ({ id: r.id, classId: r.classId, hp: CLASSES[r.classId].hp, dead: false, kills: 0, revive: 0, primaryShots: 0, secondaryShots: 0 }));
    debugState.wallet = 0; debugState.pickups = [];
    debugState.props = this.props.defs.map((p) => ({ id: p.id, room: p.room, family: p.family, x: p.x, y: p.y,
      z: this.map.floor[Math.floor(p.y) * this.map.w + Math.floor(p.x)], marked: p.marked }));
    debugState.brokenProps = [];
    debugState.propRecharges = [];
    debugState.dominion = { rendered: [], actors: [], casts: [], starts: 0, startedCastIds: [], strikes: 0, cancels: 0 };
    debugState.hazards = { activeRoom: -1, activeCells: 0 };
    debugState.spawnWarnings = []; debugState.crests = 0;
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
    if (code === 'F8') {
      // Recorded SFX on/off, to compare with the synthesized cues.
      const a = audio();
      if (a) {
        a.setRecorded(!a.recorded);
        this.hud.centerText(`Recorded SFX: ${a.recorded ? 'On' : 'Off'}`, 1200, performance.now());
      }
      return;
    }
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
    // Dev key I fills both item slots with the next pair, to try every item's effect.
    else if (code === 'KeyI' && this.params.dev && this.o.host) this.o.host.devItems();
    // Dev keys B (next quick build), R (a Rite offer now) and T (the Talents view anywhere, free points, while alive).
    else if (code === 'KeyB' && this.params.dev && this.o.host) this.o.host.devBuild();
    else if (code === 'KeyR' && this.params.dev && this.o.host) this.o.host.devRite();
    else if (code === 'KeyT' && this.params.dev && !this.dead) this.openTalents();
    else if (this.params.bot) return;
    // T: the own talents to read anywhere in the run, dead or alive (§9.4); out of combat and alive,
    // Q and E can be reassigned there too.
    else if (code === 'KeyT') this.openTalents(this.dead || this.sealed ? 'view' : 'slots');
    else if ((code === 'Digit1' || code === 'Digit2') && !this.dead && !this.player.carried) {
      const slot = code === 'Digit1' ? 0 : 1; this.itemPresses[slot] = (this.itemPresses[slot] + 1) & 255;
    }
    else if (code === 'KeyF' && !this.dead) {
      const sourceId = this.shop.target(this.player.body, this.player.yaw, this.player.pitch);
      const route = sourceId < 0 ? this.routeView.target(this.player.body) : null;
      if (sourceId >= 0) this.o.transport.sendCtrl({ type: 'interact', runId: this.o.runId, requestId: this.nextRequestId++, sourceId });
      else if (route) this.o.transport.sendCtrl({ type: 'interact', runId: this.o.runId, requestId: this.nextRequestId++, sourceId: route.kind === 'chest' ? SOURCE_CHEST : SOURCE_BELL_FIRST + route.room });
      // The Advocate within 2.5 m, else the oldest pending offer (rogue game.md §1.4, §9.6).
      else if (this.advocateInReach()) this.openAdvocate();
      else this.openPendingOffer();
    }
    else if (code === 'KeyQ') this.pressAbility('Q', performance.now());
    else if (code === 'KeyE') this.pressAbility('E', performance.now());
  }

  /** Discard predictions canceled by the host's grab correction. */
  private cancelCarriedActions(): void {
    this.fire = 0;
    latchClear(this.latch);
    this.starAim.reset(); this.starPreview = null; this.aimPreview = null; this.chargeHeld = false;
    this.wasLeaping = this.wasDashing = false;
    this.dashFrom = null;
  }

  /**
   * A press of Q or E: counted for the host (§9.3); movement abilities also run here at once when
   * their displayed cooldown is ready.
   */
  private pressAbility(slot: 'Q' | 'E', now: number): void {
    if (this.dead || this.over || this.player.carried) return;
    if (slot === 'Q') {
      this.qPresses = (this.qPresses + 1) & 0xff;
      // Your Blasphemy shakes the screen on its press (M12 §4.5).
      if (this.classId === 'fallen' && this.displayedCooldown('Q', now) <= 0) this.shake.add(now, SHAKE_BLASPHEMY);
      // Your Chains come down at once (M12 follow-up §2.2); Ring and the Boundary come from the host.
      if (this.classId === 'binder' && this.talents.ability(this.localId, 'Q') === 'chains' && this.displayedCooldown('Q', now) <= 0) this.ownChains(now);
      return;
    }
    const def = ABILITIES[this.classId].E;
    // The Way Back and the Silver Wire count every key-down; the host decides each press (R4).
    if (this.classId === 'betrayer' && this.talents.ability(this.localId, 'E') !== 'shadowstep') {
      this.ePresses = (this.ePresses + 1) & 0xff;
      return;
    }
    // The Heretic and the Binder count every E key-down; the Fallen and the Betrayer only the leaps and
    // dashes they execute (M12 §5.2).
    if (!def.movement) {
      this.ePresses = (this.ePresses + 1) & 0xff;
      // Your Discord's gust leaves at once, along your view (M12 follow-up §2.4).
      if (this.classId === 'binder' && this.talents.ability(this.localId, 'E') === 'discord' && this.displayedCooldown('E', now) <= 0) {
        const b = this.player.body;
        const [dx, dy, dz] = aimDir(this.player.yaw, this.player.pitch);
        this.vfx.gust(now, [b.x, b.y, b.z + PLAYER_EYE - GUST_BELOW_EYE], [dx, dy, dz], DISCORD_HALF_ANGLE, DISCORD_RANGE);
      }
      return;
    }
    const ready = this.displayedCooldown('E', now) <= 0;
    const p = this.player;
    const eAbility = this.talents.ability(this.localId, 'E');
    // Gatebreaker (classes-fallen.md §4): the press starts the charge at once; the release is the next press.
    if (this.classId === 'fallen' && eAbility === 'gatebreaker') {
      if (!ready || p.charging) return;
      p.startCharge();
      this.ePresses = (this.ePresses + 1) & 0xff;
      this.localEReadyAt = now + (GATEBREAKER.maxTime + GATEBREAKER.cooldown) * 1000;
      this.eAcked = false;
      this.chargeHeld = true;
      return;
    }
    // Rain of Fire: held to aim like Falling Star, counted for the host on release.
    if (this.classId === 'fallen' && eAbility === 'rainOfFire') {
      if (!this.bot) this.starAim.keyDown(this.displayedCooldown('E', now) <= 0, !this.dead);
      return;
    }
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
    this.eAcked = false;
    // The dagger cuts across the view for the dash's 200 ms (M12 §5.7), its sound with the slash.
    this.slashAt = now;
    debugState.slashAt = now;
    this.hud.slash(now);
    this.sounds.ownDaggerCut();
    this.dashFrom = [p.body.x, p.body.y, p.body.z];
  }

  /** Falling Star's leap to a landing point (feet) starts: counted for the host, cooling down locally (M12 §5.2). */
  private leap(now: number, x: number, y: number, z: number, ally: number): void {
    if (this.player.carried) return;
    this.player.startLeap(x, y, z);
    this.leapAlly = ally;
    this.ePresses = (this.ePresses + 1) & 0xff;
    this.localEReadyAt = now + ABILITIES.fallen.E.cooldown * 1000;
    this.eAcked = false;
  }

  /**
   * The local Fallen's aim this frame (M12 §5.2): the preview while E is held, the leap on its release
   * if the landing is valid. The ally target is the snapped ally while aiming, the one leapt to while
   * leaping. Returns the fire bits, without the right button after a cancel until it's let go.
   */
  private updateStarAim(now: number, fire: number): number {
    const p = this.player;
    if (p.carried) { this.starAim.reset(); this.starPreview = null; this.aimPreview = null; return 0; }
    const eAbility = this.talents.ability(this.localId, 'E');
    if (eAbility === 'gatebreaker') {
      this.starPreview = null;
      // Letting go of E releases the charge (the host gets the release as the next press).
      if (this.chargeHeld && !this.input.isDown('KeyE')) {
        this.chargeHeld = false;
        if (p.charging) { p.releaseCharge(); this.ePresses = (this.ePresses + 1) & 0xff; }
      }
      // A charge a wall or its 1.2 s ended also tells the host, so it stops cutting along walking steps.
      if (this.chargeHeld && !p.charging) { this.chargeHeld = false; this.ePresses = (this.ePresses + 1) & 0xff; }
      return fire;
    }
    if (eAbility === 'rainOfFire') {
      this.starPreview = null;
      const step = this.starAim.frame(this.input.isDown('KeyE'), this.input.rightHeld, this.input.releases);
      if (this.starAim.aiming || step === 'release') {
        const b = p.body, [dx, dy, dz] = aimDir(p.yaw, p.pitch);
        const at = rainPoint(this.map, b.x, b.y, b.z, dx, dy, dz, RAIN.range);
        const radius = this.talents.ownHas('fallen.c.1b') ? RAIN.wide : RAIN.radius;
        this.aimPreview = this.starAim.aiming ? { at: [at.x, at.y, at.z], radius, valid: at.valid } : null;
        if (step === 'release' && at.valid) this.ePresses = (this.ePresses + 1) & 0xff;
      } else this.aimPreview = null;
      return this.starAim.rightBlocked ? fire & ~(FIRE_RIGHT | FIRE_RIGHT_LAST) : fire;
    }
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

  /** An aimed cast's ring (and line) on the floor while its key is held. */
  private drawAimPreview(): void {
    const a = this.aimPreview;
    this.vfx.setAimPreview(a ? a.at : null, a?.radius ?? 0, a?.valid ?? false, this.scene.camera.position, a?.line);
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

  /**
   * A Scourge swing's shape: the base 3 m arc, The Long Flail's 4 m arc, Whirl's full circle or the
   * Whip's 7 m line (classes-binder.md `b.1a`, `b.3b`, `c.2b`).
   */
  private scourgeShape(now: number, playerId: number, x: number, y: number, z: number, yaw: number): void {
    const has = (id: string) => this.talents.kits.get(playerId)?.active.includes(id) ?? false;
    // Whirl with The Long Flail reaches 4 m all round (R06 follow-up §1).
    if (has('binder.b.1a')) { this.vfx.ring(now, x, y, z + 0.9, 0xff6a2a, 0.6, has('binder.b.3b') ? BINDER.flail : 3, 260); return; }
    if (has('binder.c.2b')) {
      const pts: Array<[number, number, number]> = [[x, y, z + 0.9], [x + Math.cos(yaw) * BINDER.whipLength, y + Math.sin(yaw) * BINDER.whipLength, z + 0.9]];
      this.vfx.beam(now, pts, 0xff6a2a, 0.12, 240); this.vfx.beam(now, pts, 0xfff0c0, 0.04, 240);
      return;
    }
    this.vfx.scourgeArc(now, x, y, z, yaw);
  }

  /** Pause opens when pointer lock is lost, before the result (§3). */
  private readonly onPointerLockChange = (): void => {
    const locked = this.input.pointerLocked;
    if (this.wasLocked && !locked && !this.overlayView) this.openPause();
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
      if (r) Object.assign(r, { name: p.name, classId: p.classId, bot: p.bot });
      else this.roster.push({ id: p.id, name: p.name, classId: p.classId, bot: p.bot });
    }
  }

  /** Runs another player's effect after the render delay; the own one at once. */
  private later(playerId: number, run: (now: number) => void): void {
    const now = performance.now();
    if (playerId === this.localId) run(now);
    else this.pendingFx.push({ at: now + this.snaps.delayTicks * TICK_MS, run });
  }

  /** A talent event's game-side effects: the own kit, offers, launched enemies, the hidden mark. */
  private talentEvent(e: GameEvent, now: number): void {
    if (e.type === 'kit' && e.kit.playerId === this.localId) {
      this.applyOwnKit();
      if (this.overlayView?.kind === 'talents') this.overlayView.view.setBuild({ talents: e.kit.learned, q: e.kit.q, e: e.kit.e }, e.kit.rites);
    }
    if (e.type === 'hidden' && e.playerId === this.localId) this.hud.setHidden(e.hidden);
    if (e.type === 'riteOffers') {
      const open = this.overlayView;
      if (open?.kind === 'rite') {
        const current = e.offers.find((o) => o.offerId === open.offerId);
        if (current) open.view.show(current, e.offers.length);
        else if (e.offers.length) this.openRite(e.offers[0]);
        else this.closeOverlay();
      } else if (e.rites > 0 && !this.dead && !open) {
        const offer = e.offers.find((o) => o.offerId === e.rites);
        if (offer) this.openRite(offer);
      }
    }
    if (e.type === 'meter' && e.playerId === this.localId && e.kind === 'wrath') this.hud.setWrath(e.value / e.max);
    if (e.type === 'launched') {
      // R5 launches fly Falling Star's arc after the render delay and don't hold a wading player.
      for (const s of e.slots) {
        this.launchAt[s] = now + (e.playerId === this.localId ? 0 : this.snaps.delayTicks * TICK_MS);
        this.wadeLaunchedUntil[s] = now + WADE_LAUNCH_MS;
      }
    }
    if (e.type === 'talentFx' && e.kind === 'sheep') {
      // Scattered Sheep's launches fly their arc after the render delay, like Falling Star's (M9 §3.2).
      for (const s of e.slots) {
        this.launchAt[s] = now + (e.playerId === this.localId ? 0 : this.snaps.delayTicks * TICK_MS);
        this.wadeLaunchedUntil[s] = now + WADE_LAUNCH_MS;
      }
    }
  }

  /** The HUD slots and Q/E hints from the own effective kit (rogue game.md §1.4). */
  private applyOwnKit(): void {
    const slot = (key: 'Q' | 'E') => {
      const def = this.talents.ownDef(this.classId, key), id = this.talents.ability(this.localId, key);
      return { name: def.name, icon: def.icon, hint: ALT_ABILITIES[id]?.hint ?? CLASSES[this.classId].hints.find((h) => h.key === key)?.text ?? null };
    };
    this.hud.setKit({ Q: slot('Q'), E: slot('E') });
    // Wrath of Dis shows its fill only while the capstone is effective; its value arrives as owner meters.
    if (!this.talents.ownHas('fallen.a.cap')) this.hud.setWrath(null);
    else if (this.wrathShown === null) this.hud.setWrath(0);
    this.wrathShown = this.talents.ownHas('fallen.a.cap') ? 0 : null;
  }

  private wrathShown: number | null = null;

  /** Within the Advocate's reach in the Confessional (rogue game.md §9.6). */
  private advocateInReach(): boolean {
    const room = this.o.floor?.confessional ?? -1, point = room >= 0 ? this.map.rooms[room]?.points?.advocate : undefined;
    const b = this.player.body;
    return !!point && this.rooms.roomAt(b.x, b.y) === room && Math.hypot(point[0] + 0.5 - b.x, point[1] + 0.5 - b.y) <= ADVOCATE_REACH;
  }

  /**
   * A choice view takes the mouse without opening Pause; in singleplayer the simulation waits, as for
   * Pause (§9.6). Multiplayer keeps running: a sealed door refuses a later commit, never the offer.
   */
  private openOverlay(el: HTMLElement): void {
    this.closeOverlay();
    this.input.release();
    this.input.enabled = false;
    this.o.root.appendChild(el);
    if (document.pointerLockElement) document.exitPointerLock();
    if (this.o.singleplayer && !this.paused) { this.o.host?.setPaused(true); this.pausedAt = performance.now(); }
    document.addEventListener('keydown', this.overlayKey, true);
  }

  private closeOverlay(): void {
    const open = this.overlayView;
    if (!open) return;
    this.overlayView = null;
    open.view.el.remove();
    document.removeEventListener('keydown', this.overlayKey, true);
    if (this.o.singleplayer && !this.paused) {
      this.o.host?.setPaused(false);
      const ms = performance.now() - this.pausedAt;
      this.localEReadyAt += ms;
      this.snaps.shiftArrivals(ms);
    }
    if (!this.over && !this.paused) {
      // The Esc that closed the view stopped in the capture phase, so it can't also reach the game.
      this.input.enabled = true;
      if (this.input.pointerLockAllowed) this.input.requestPointerLock();
    }
  }

  private readonly overlayKey = (e: KeyboardEvent): void => {
    // Esc closes the choice only: the same press must not reach the game and open Pause.
    // T closes the Talents view it opens.
    if (e.code === 'Escape' || (e.code === 'KeyT' && !e.repeat && this.overlayView?.kind === 'talents')) { e.preventDefault(); e.stopImmediatePropagation(); this.closeOverlay(); }
  };

  /** The host's route state: the chest and Bells drawn, the key holder named under the minimap. */
  private applyRoute(state: RouteState): void {
    // A Bell rung: its toll, heard by everyone (rogue game.md §4.12).
    for (const b of state.bells) if (b.state === 'pending' && this.routeView.state.bells.find((o) => o.room === b.room)?.state === 'available') sfx('bellToll', { x: b.x, y: b.y });
    this.routeView.set(state);
    debugState.route = { keyHolder: state.keyHolder, keyUsed: state.keyUsed, chest: state.chest ? { open: state.chest.open } : null, bells: state.bells.map((b) => b.state), sundial: state.sundial };
    this.mapView.setRoute(state, state.keyHolder < 0 && !state.keyUsed && [...this.pickups.model.records.values()].some((r) => r.pickup.kind === KEY && r.pickup.room === this.o.floor?.keyRoom));
    this.relicHud.setKey(state.keyHolder >= 0 ? this.roster.find((r) => r.id === state.keyHolder)?.name ?? `Player ${state.keyHolder}` : null);
  }

  /** LMB with the full map held: Pilgrim's Return to the cleared room under the cursor (§5.5). */
  private mapClick(): void {
    if (this.dead || this.over || this.paused || !this.o.floor || !this.mapView.open) return;
    const room = this.mapView.roomAtCursor();
    if (room >= 0) this.o.transport.sendCtrl({ type: 'pilgrimReturn', runId: this.o.runId, requestId: this.nextRequestId++, room });
  }

  /** Pilgrim's Return (§5.5): a gold ring closing on the channeling player over 1.5 s, a chime, the target outlined. */
  private pilgrimEvent(e: Extract<GameEvent, { type: 'pilgrim' }>, now: number): void {
    const at = e.playerId === this.localId ? this.player.body : this.playerPose(e.playerId);
    if (e.phase === 'start') {
      if (at) for (let i = 0; i < 3; i++) this.vfx.ring(now, at.x, at.y, at.z + 0.05, 0xffd27a, 2.2 - i * 0.6, 0.3, 1500 - i * 300, i * 300);
      sfx('chaliceHeal', at ? { x: at.x, y: at.y } : null, 0.6, 0, undefined, 0.8);
      if (e.playerId === this.localId) this.mapView.returnTarget = e.room;
    } else {
      if (e.playerId === this.localId) this.mapView.returnTarget = -1;
      if (e.phase === 'arrive' && at) { this.vfx.pillar(now, at.x, at.y, at.z); sfx('goldPickup', null, 0.6); }
    }
  }

  /** F with nothing to interact with: the oldest free Rite offer, else a waiting chest offer (§9.10). */
  private openPendingOffer(): void {
    const free = this.talents.offers.find((o) => o.source !== 'sundial' && o.source !== 'bargain');
    if (free) { this.openRite(free); return; }
    const chest = this.relicOffers.find((o) => o.source === 'chest');
    if (chest) this.openRelicOffer(chest);
  }

  /** The host published the own relic offers: refresh an open one, or open the one it asks for. */
  private relicOfferEvent(open: number): void {
    const view = this.overlayView;
    if (view?.kind === 'relicOffer') {
      const current = this.relicOffers.find((o) => o.offerId === view.offerId);
      if (current) view.view.show(current, this.relicOffers.length, this.maxHp + this.hpCut);
      else this.closeOverlay();
    } else if (open && !this.dead && (!view || view.kind === 'advocate')) {
      const offer = this.relicOffers.find((o) => o.offerId === open);
      if (offer) this.openRelicOffer(offer);
    }
  }

  private openRelicOffer(offer: RelicOfferState): void {
    if (this.over) return;
    const view = relicOfferOverlay({
      onTake: (offerId, id) => this.o.transport.sendCtrl({ type: 'relicChoice', runId: this.o.runId, requestId: this.nextRequestId++, offerId, choice: id }),
      onPass: (offerId) => this.o.transport.sendCtrl({ type: 'relicChoice', runId: this.o.runId, requestId: this.nextRequestId++, offerId, choice: 'pass' }),
      onClose: () => this.closeOverlay(),
    });
    this.openOverlay(view.el);
    this.overlayView = { kind: 'relicOffer', view, offerId: offer.offerId };
    view.show(offer, this.relicOffers.length, this.maxHp + this.hpCut);
  }

  /** The Advocate's view (§9.6): Talents, Relics, the bargain and the Sundial's Rite while it is lit. */
  private openAdvocate(): void {
    if (this.over) return;
    const sundialLeft = this.sundialLeft();
    const view = advocateHub({
      bargain: this.inventory?.bargainOpen ?? true,
      sundial: sundialLeft > 0 ? `Seal the Gatekeeper within ${Math.floor(sundialLeft / 60)}:${String(Math.floor(sundialLeft % 60)).padStart(2, '0')} for a Rite of your choice.` : null,
      onTalents: () => this.openTalents(),
      onRelics: () => this.openRelics(false),
      onBargain: () => this.o.transport.sendCtrl({ type: 'advocateOffer', runId: this.o.runId, requestId: this.nextRequestId++, offer: 'bargain' }),
      onSundial: () => this.o.transport.sendCtrl({ type: 'advocateOffer', runId: this.o.runId, requestId: this.nextRequestId++, offer: 'sundial' }),
      onClose: () => this.closeOverlay(),
    });
    this.openOverlay(view.el);
    this.overlayView = { kind: 'advocate', view };
  }

  /** Seconds the Sundial still burns, from the host's run clock (0 when dark) (§6.8). */
  private sundialLeft(): number {
    const r = this.routeView.state;
    return r.sundial === 'lit' ? Math.max(0, (r.sundialTick - this.snaps.estimatedTick(performance.now())) / 30) : 0;
  }

  /** The Relics view: at the Advocate (or anywhere in a development run) it equips; otherwise it reads. */
  private openRelics(readOnly: boolean): void {
    if (this.over) return;
    const inv = this.inventory, own = this.talents.own();
    const kit = resolveKit(this.classId, { talents: own?.learned ?? [], rites: own?.rites ?? [], q: this.talents.ability(this.localId, 'Q'), e: this.talents.ability(this.localId, 'E') });
    const view = relicPanel({
      title: readOnly ? 'Relics' : 'The Advocate · Relics',
      owned: inv?.ownedRelics ?? [], pawned: inv?.pawnedRelics ?? [], equipped: this.relicHud.equipped(),
      dormancy: (id: RelicId) => relicDormancy(id, kit, { allies: [], items: (inv?.inventory ?? []).flatMap((s) => (s ? [s.item] : [])), areas: new Set(), hazard: true }),
      readOnly, note: readOnly ? 'Equip relics with the Advocate in the Confessional.' : 'A pawned relic is yours only if the Gatekeeper falls.',
      onApply: (relics) => this.o.transport.sendCtrl({ type: 'relics', runId: this.o.runId, requestId: this.nextRequestId++, relics }),
      onClose: () => this.closeOverlay(),
    });
    this.openOverlay(view.el);
    this.overlayView = { kind: 'relics', view };
  }

  /** A pending Rite's cards (§9.10): Take, Pass, or Esc to keep it for later. */
  private openRite(offer: RiteOffer): void {
    if (this.over) return;
    const view = riteOverlay({
      classId: this.classId,
      onTake: (offerId, id) => this.o.transport.sendCtrl({ type: 'rite', runId: this.o.runId, requestId: this.nextRequestId++, offerId, choice: id }),
      onPass: (offerId) => this.o.transport.sendCtrl({ type: 'rite', runId: this.o.runId, requestId: this.nextRequestId++, offerId, choice: 'pass' }),
      onClose: () => this.closeOverlay(),
    });
    this.openOverlay(view.el);
    this.overlayView = { kind: 'rite', view, offerId: offer.offerId };
    view.show(offer, this.talents.offers.length);
  }

  /**
   * The Advocate's Talents view (§9.6); in a development run without saved progression, anywhere with
   * free points. T's view anywhere: `slots` reassigns Q and E out of combat, `view` only reads the
   * build (in combat or dead). The same trees in every mode.
   */
  private openTalents(mode: 'edit' | 'slots' | 'view' = 'edit'): void {
    if (this.over || !hasCatalog(this.classId)) return;
    const k = this.talents.own();
    const dev = !this.progressionEnabled;
    const view = talentPanel({
      classId: this.classId,
      build: { talents: k?.learned ?? [], q: this.talents.ability(this.localId, 'Q'), e: this.talents.ability(this.localId, 'E') },
      rites: k?.rites ?? [],
      level: dev ? null : levelForXp(this.inventory?.xp ?? 0),
      title: mode !== 'edit' ? 'Talents' : dev ? 'Talents · development' : 'The Advocate',
      readOnly: mode === 'view',
      slotsOnly: mode === 'slots',
      onApply: (b) => this.o.transport.sendCtrl({ type: 'advocate', runId: this.o.runId, requestId: this.nextRequestId++, talents: [...b.talents], q: b.q, e: b.e }),
      onClose: () => this.closeOverlay(),
    });
    this.openOverlay(view.el);
    this.overlayView = { kind: 'talents', view };
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
        runId: this.o.runId,
        seq: ++this.seq,
        x: p.body.x,
        y: p.body.y,
        z: p.body.z,
        yaw: p.yaw,
        pitch: p.pitch,
        fire: p.carried ? 0 : this.fire,
        qPresses: this.qPresses,
        ePresses: this.ePresses,
        allyTargetId: this.allyTargetId,
        lastTeleportId: this.lastTeleportId,
        item1Presses: this.itemPresses[0],
        item2Presses: this.itemPresses[1],
        mapHeld: this.input.mapHeld,
        qHeld: !p.carried && this.input.enabled && !this.input.typing && this.input.isDown('KeyQ'),
        eHeld: !p.carried && this.input.enabled && !this.input.typing && this.input.isDown('KeyE'),
        leftPresses: this.leftPresses,
        rightPresses: this.rightPresses,
        viewTick: this.snaps.view.tick,
        viewGap: this.snaps.view.gap,
        viewFrac: this.snaps.view.frac,
        shots: this.shots,
        shotButton: this.shotButton,
        shotYaw: this.shotAim.yaw,
        shotPitch: this.shotAim.pitch,
        shotViewTick: this.shotAim.tick,
        shotViewGap: this.shotAim.gap,
        shotViewFrac: this.shotAim.frac,
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
    if (msg.type === 'floorSync' && !this.disposed) {
      if (msg.victory) this.setVictory(msg.victory);
      if (msg.progressionEnabled !== undefined) this.progressionEnabled = msg.progressionEnabled;
      this.talents.sync(msg, performance.now());
      this.applyOwnKit();
      this.itemView.sync(msg.itemEffects ?? []);
      this.relicView.sync(msg.relicAreas ?? [], msg.relicShots ?? []);
      if (msg.route) this.applyRoute(msg.route);
      if (msg.edicts) { this.hud.setSentence(sentenceLabel(msg.edicts.length)); debugState.sentence = msg.edicts.length; }
      const relics = msg.relicStates?.find((r) => r.playerId === this.localId);
      if (relics) { this.relicHud.setRelics(relics.relics, relics.combo, relics.ready); this.hud.setRelicHints(relics.relics); debugState.relics = { equipped: [relics.relics[0], relics.relics[1]], combo: relics.combo }; }
      const inventory = msg.inventories?.find(p => p.playerId === this.localId);
      if (inventory) this.setInventory(inventory);
      this.dominion.sync(msg);
      this.commanders.sync(msg);
      this.watchmen.sync(msg);
      this.spawnWarnings.sync(msg);
      this.pickups.model.sync(msg);
      if (this.props.model.sync(msg)) {
        debugState.brokenProps = [...this.props.model.broken];
        debugState.propRecharges = [...this.props.model.recharges].map(([id, readyTick]) => ({ id, readyTick }));
      }
      if (this.rooms.sync(msg)) {
        debugState.floorSyncTick = this.rooms.syncTick;
        debugState.roomKnowledge = this.rooms.states.map((r) => r.knowledge);
      }
      return;
    }
    if (msg.type !== 'event' || this.disposed || !this.runEvents.accept(msg)) return;
    if (msg.event.type === 'roomState') {
      const transition = this.rooms.event(msg.event, msg.revision);
      debugState.roomKnowledge = this.rooms.states.map((r) => r.knowledge);
      if (!transition) return;
      if (msg.event.phase === PHASE_COMBAT) this.hazards.seal(msg.event.room, msg.tick);
    }
    if (msg.event.type === 'pickupState') this.pickups.model.state(msg.event.pickup, msg.tick, msg.revision);
    if (msg.event.type === 'spawnWarning' && !this.spawnWarnings.event(msg.event, msg.tick, msg.revision)) return;
    if (msg.event.type === 'dominionCast') {
      if (!this.dominion.event(msg.event, msg.tick, msg.revision)) return;
      const phase = msg.event.phase; debugState.dominion[phase === 'start' ? 'starts' : phase === 'strike' ? 'strikes' : 'cancels']++;
      if (phase === 'start') { debugState.dominion.startedCastIds.push(msg.event.cast.castId); if (debugState.dominion.startedCastIds.length > 6) debugState.dominion.startedCastIds.shift(); }
    }
    if (msg.event.type === 'propBroken' || msg.event.type === 'propBlast' || msg.event.type === 'propReady') {
      if (!this.props.model.event(msg.event, msg.revision)) return;
      debugState.brokenProps = [...this.props.model.broken];
      debugState.propRecharges = [...this.props.model.recharges].map(([id, readyTick]) => ({ id, readyTick }));
    }
    this.onEvent(msg.event, performance.now());
    this.sounds.event(msg.event, (id) => this.playerPose(id));
  }

  private setInventory(state: InventoryState): void {
    if (this.inventory && levelForXp(state.xp) > levelForXp(this.inventory.xp)) {
      // A new point is learned at the Confessional or in the Lobby (rogue game.md §9.5).
      const level = levelForXp(state.xp);
      this.hud.centerText(hasCatalog(this.classId) ? `Level ${level} — learn it at the Confessional` : `Level ${level}`, 3000, performance.now()); this.sounds.levelUp();
    }
    // A relic became yours (claimed, pawned or a deed's): a bright chime with its line.
    const had = (this.inventory?.ownedRelics?.length ?? 0) + (this.inventory?.pawnedRelics?.length ?? 0);
    if (this.inventory && (state.ownedRelics?.length ?? 0) + (state.pawnedRelics?.length ?? 0) > had) { sfx('goldPickup', null, 0.9, 0, undefined, 0.75); this.sounds.levelUp(); }
    this.inventory = state; this.nextRequestId = Math.max(this.nextRequestId, state.nextRequestId);
    if (state.maxHp !== undefined) { this.hpCut = Math.max(0, CLASSES[this.classId].hp - state.maxHp); this.maxHp = state.maxHp; }
    this.hud.setInventory(state); this.shop.update(state);
  }
  private setVictory(state: VictoryState): void {
    this.victory = { ...state }; this.shop.victory(state); if (this.inventory) this.shop.update(this.inventory);
    this.victoryHint.textContent = state.waiting ? 'A choice is waiting · Return to an earned Rite page' : 'Victory secured · Shop, then stand in the Stair for 3 seconds';
  }

  private onEvent(e: GameEvent, now: number): void {
    if (this.talents.event(e, now)) { this.talentEvent(e, now); return; }
    switch (e.type) {
      case 'victoryState': this.setVictory(e.state); break;
      case 'itemUsed':
        if (e.instance) this.itemView.state(e.instance);
        // Self items show what the abilities that do the same show: Sacrament's heal, Martyr's Shroud's bubble.
        if (e.item === 'balm') {
          this.particles.healColumn(e.x, e.y, e.z);
          if (e.playerId === this.localId) this.hud.vignette('green', HEAL_VIGNETTE, now, HEAL_FADE_MS);
          else this.party?.flash(e.playerId, 'green');
        }
        if (e.item === 'seal') {
          this.vfx.sphere(now, e.x, e.y, e.z + PLAYER_HEIGHT / 2, 0x4aa3e8, 1.3, 1.6, 900, 0.4);
          if (e.playerId !== this.localId) this.party?.flash(e.playerId, 'blue');
        }
        if (e.item === 'feather') {
          const at = this.playerPose(e.playerId);
          if (at) this.featherTrails.start(e.playerId, now + (ITEMS.feather.duration / 30) * 1000, at);
        }
        break;
      case 'itemEffectActivated': this.itemView.state(e.effect); break;
      case 'itemEffectEnded': this.itemView.remove(e.instanceId); break;
      case 'itemReflected': this.vfx.glow(now, e.x, e.y, e.z, 0xddeeff, .2, .5, 180); break;
      case 'relicArea': if (e.end) this.relicView.endArea(e.area.id); else this.relicView.area(e.area); break;
      case 'relicShot': if (e.end) this.relicView.endShot(e.shot.id, e, now); else this.relicView.shot(e.shot); break;
      case 'relicFx': this.relicView.fx(e, now); break;
      case 'relicState':
        if (e.playerId !== this.localId) break;
        this.relicHud.setRelics(e.relics, e.combo, e.ready);
        this.hud.setRelicHints(e.relics);
        debugState.relics = { equipped: [e.relics[0], e.relics[1]], combo: e.combo };
        if (this.overlayView?.kind === 'relics') this.overlayView.view.setEquipped(e.relics, this.inventory?.ownedRelics, this.inventory?.pawnedRelics);
        break;
      case 'route': this.applyRoute(e.state); break;
      case 'pilgrim': this.pilgrimEvent(e, now); break;
      case 'relicOffers':
        if (e.playerId !== this.localId) break;
        this.relicOffers = e.offers;
        debugState.relicOffers = e.offers.length;
        this.relicOfferEvent(e.open);
        break;
      case 'streak':
        if (e.playerId === this.localId) { this.relicHud.streakTier(e.tier, e.count, now); debugState.streak = { count: e.count, best: Math.max(debugState.streak.best, e.count) }; }
        else this.hud.addChat(this.roster.find((r) => r.id === e.playerId)?.name ?? `Player ${e.playerId}`, `${STREAK_NAMES[e.tier]} (${e.count})`, now);
        break;
      case 'streakEnd': if (e.playerId === this.localId) this.relicHud.streakEnd(e.count, now); break;
      case 'inventory':
        if (e.state.playerId === this.localId) this.setInventory(e.state);
        break;
      case 'interactionResult':
        this.hud.centerText(e.reason, 1800, now);
        if (this.overlayView) this.overlayView.view.setMessage(e.reason);
        break;
      case 'wayBack': {
        // The host's accepted return: the own body runs it at once, others' streak after the render delay.
        const ms = Math.max(1, e.ms);
        if (e.playerId === this.localId) {
          this.player.startMove(((e.x1 - e.x0) / ms) * 1000, ((e.y1 - e.y0) / ms) * 1000, ms / 1000);
          this.hud.slash(now);
          this.sounds.ownDaggerCut();
        }
        this.later(e.playerId, (t) => this.dashStreak(t, e.x0, e.y0, e.z0, e.x1, e.y1, e.z1));
        break;
      }
      case 'recoil':
        if (e.playerId === this.localId) this.player.startMove(e.vx, e.vy, 0.15);
        break;
      case 'crest':
        debugState.crests++;
        this.hud.centerText('The crest is coming', 2000, now);
        break;
      case 'dominionCast':
        if (e.phase === 'strike') {
          const b = this.player.body;
          const impactShake = dominionShake(Math.hypot(e.x - b.x, e.y - b.y, e.z - b.z));
          if (!this.dead && impactShake) this.shake.add(now, impactShake);
          this.vfx.ring(now, e.x, e.y, e.z, 0xffedaa, 0, DOMINION_RADIUS, 220);
          this.vfx.glow(now, e.x, e.y, e.z + 0.2, 0xffd066, 0.2, DOMINION_RADIUS, 250);
        }
        break;
      case 'propBroken':
        if (e.family === 'blessing') {
          this.vfx.ring(now, e.x, e.y, e.z, 0x55ff88, 0, 6, 450);
          this.vfx.glow(now, e.x, e.y, e.z + 1.8, 0x55ff88, 0.5, 2, 400);
          for (const id of e.targets) { const p = this.playerPose(id); if (p) this.particles.healColumn(p.x, p.y, p.z); }
        } else if (e.family === 'loot') {
          this.particles.globeShards(e.x, e.y, e.z + 0.75, 18);
          this.vfx.glow(now, e.x, e.y, e.z + 0.5, 0xffe4b5, 0.2, e.marked ? 1 : 0.5, 300);
          if (e.marked) this.vfx.beam(now, [[e.x, e.y, e.z], [e.x, e.y, e.z + 2]], 0xffda68, 0.25, 500);
        }
        break;
      case 'propBlast':
        this.vfx.ring(now, e.x, e.y, e.z, 0xf05a25, 0, 4, 250);
        this.vfx.smoke(now, e.x, e.y, e.z + 0.6, 0x28252b, 0.3, 1.5, 500);
        break;
      case 'teleport':
        if (((e.teleportId - this.lastTeleportId) & 0xffff) >= 0x8000 || e.teleportId === this.lastTeleportId) break;
        if (e.hold) this.player.hold(this.map, e.x, e.y, e.z, e.hold[0], e.hold[1], Math.max(0, this.snaps.estimatedTick(now) - e.hold[2]) / 30);
        else this.player.teleport(e.x, e.y, e.z, e.launch);
        this.player.carried = e.carry === true;
        if (this.player.carried) this.cancelCarriedActions();
        if (e.carry === false || e.hold === null) this.player.body.grounded = false;
        this.lastTeleportId = e.teleportId;
        break;
      case 'roomState':
        if (e.phase === PHASE_COMBAT) this.hud.centerText('The doors are sealed', 2000, now);
        else if (e.phase === PHASE_CLEARED && this.map.rooms[e.room].kind === 'combat') {
          // The clear reward comes down from the sky and is named under the clear (audit batch 3).
          const reward = this.o.floor?.rewards[e.room], spot = rewardSpot(this.map, e.room);
          const named = reward && reward.kind !== 'nothing' && spot;
          this.hud.centerText('Room cleared', named ? 3000 : 2000, now, named ? `Reward: ${rewardLabel(reward)}` : null);
          if (named) { this.rewardShafts.arrive(spot.x, spot.y, spot.z, now); this.sounds.rewardArrived(); }
        }
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
        if (e.cast === undefined || e.cast === BOSS_CAST_JUDGMENT) this.hud.judgmentEvent(e.phase, now);
        else if (e.cast === BOSS_CAST_TOLL && e.phase === 'start') this.hud.bossText('THE TOLL — jump the ring!', 1500, now);
        if (e.cast === BOSS_CAST_TOLL && e.impactTick && !this.tollImpacts.includes(e.impactTick)) this.tollImpacts = [...this.tollImpacts, e.impactTick].slice(-2);
        break;
      case 'bossPhase': this.bossPhaseEvent(e, now); break;
      case 'called': {
        const mine = e.playerId === this.localId, who = this.roster.find((r) => r.id === e.playerId)?.name ?? 'An ally';
        if (e.phase === 'tell') {
          const at = this.playerPose(e.playerId);
          if (at) this.vfx.ring(now, at.x, at.y, at.z + 0.05, 0xffd36a, 1.2, 0.3, 1000);
          this.hud.bossText(mine ? 'He calls you by name!' : `He calls ${who}!`, 1200, now);
        } else if (e.phase === 'held' && !mine) this.hud.bossText(`${who} is called: shoot the seal!`, 2000, now);
        break;
      }
      case 'sealBroken': {
        const at = this.playerPose(e.playerId);
        if (at) this.vfx.burstSphere(now, at.x, at.y, at.z + 1.6, 0xffd36a, 0.2, 1.4, 350, 0.7);
        if (e.playerId === this.localId) this.hud.bossText('Freed!', 1200, now);
        break;
      }
      case 'judged':
        if (e.by === 'seal') { this.hud.bossText('The Gatekeeper takes his due', 2200, now); this.hud.bossFlash('green'); }
        else if (e.by === 'watcher' && e.playerId === this.localId) this.hud.bossText('A Watcher saw you', 1500, now);
        break;
      case 'watchersOpen':
        if (e.first) this.hud.bossText('The Watchers open', 2500, now);
        break;
      case 'watcherBreak': {
        const boss = this.bossPoint();
        if (boss) this.vfx.beam(now, [[e.x, e.y, e.z], [boss.x, boss.y, boss.z + 4]], 0xff2a1a, 0.16, 450);
        this.vfx.glow(now, e.x, e.y, e.z, 0xffd36a, 0.3, 1.6, 300);
        this.hud.bossFlash('red');
        break;
      }
      case 'hostDescend':
        for (const [c, r] of this.map.rooms[this.snaps.newest?.activeRoom ?? -1]?.points?.addSpawns?.gate ?? []) {
          const z = this.map.floor[r * this.map.w + c];
          this.vfx.beam(now, [[c + 0.5, r + 0.5, z], [c + 0.5, r + 0.5, z + 9]], 0xffe08a, 0.6, 1400);
        }
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
      case 'damage':
        if (loadDamageNumbersSetting()) this.damageNumbers.add(e.hits, now);
        if (Array.isArray(e.kills)) {
          for (let k = 0; k + 1 < e.kills.length; k += 2) {
            if (Number.isInteger(e.kills[k]) && Number.isInteger(e.kills[k + 1])) this.reportedKills.push(e.kills[k], e.kills[k + 1]);
          }
        }
        break;
      case 'hurt': {
        // Felt hits (R06 follow-up §9): an arc toward the source, and a flinch scaled by the damage.
        const largest = this.hitArcs.add(e.hits, now, this.maxHp);
        if (largest > 0 && !this.dead) this.shake.add(now, hurtShake(largest, this.maxHp));
        break;
      }
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
    // Cast Down drops the pile at the crosshair's floor point; All of Tartarus reaches every direction.
    const [px, py] = this.talents.ownHas('binder.a.1a') ? aimedWalk(this.map, b.x, b.y, b.z, this.player.yaw, this.player.pitch, BINDER.castDownMin, BINDER.castDown) : walkDestination(this.map, b.x, b.y, this.player.yaw, CHAINS_MAX);
    const everyWay = this.talents.ownHas('binder.a.cap');
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
      if (!everyWay && len > 1e-9 && (dx * ax + dy * ay + dz * az) / len < cosMax) continue;
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

  /** The Gatekeeper fight for the bot, read from the newest header at the screen's drawn time. */
  private botBoss(): BotBoss | null {
    const s = this.snaps.newest, boss = this.bossPoint();
    if (!s || !boss) return null;
    const v = this.snaps.view, reward = this.map.rooms[s.activeRoom]?.points?.reward;
    const base = reward ? this.map.floor[(reward[1] + 1) * this.map.w + reward[0] + 1] : boss.z;
    return { x: boss.x, y: boss.y, z: boss.z, eyeZ: boss.z + 5, tick: v.tick + v.gap * v.frac, cycleStart: s.bossCycleStart, tollImpact: this.tollImpacts[this.tollImpacts.length - 1] ?? 0, base };
  }

  /** The Gatekeeper's body (feet) in the newest snapshot, or null outside the fight. */
  private bossPoint(): { x: number; y: number; z: number } | null {
    const s = this.snaps.newest;
    if (!s || s.bossMaxHp <= 0) return null;
    for (let i = 0; i < s.enemyCount; i++) if (s.enemyType[i] === GATEKEEPER) return { x: s.enemyX[i], y: s.enemyY[i], z: s.enemyZ[i] };
    return null;
  }

  /** The fight's phase lines: the seal, the silent trumpet at 50% (a feather burst), the victory. */
  private bossPhaseEvent(e: Extract<GameEvent, { type: 'bossPhase' }>, now: number): void {
    const boss = this.bossPoint();
    if (e.phase === 1) this.hud.centerText(e.line, 3000, now);
    else if (e.phase === 2) {
      this.hud.centerText('He lifts the first trumpet', 2500, now, 'It stays silent. The Watchers will open.');
      if (boss) {
        this.vfx.ring(now, boss.x, boss.y, boss.z, 0xffffff, 2, 45, 1600);
        this.vfx.burstSphere(now, boss.x, boss.y, boss.z + 6, 0xfff3cf, 1, 14, 1200, 0.5);
        for (let i = 0; i < 40; i++) this.particles.trailFeather(boss.x + (Math.random() - 0.5) * 30, boss.y + (Math.random() - 0.5) * 30, boss.z + 4 + Math.random() * 6);
      }
    } else this.hud.centerText(e.line, 4000, now);
  }

  /**
   * The local player's hold from the snapshot, when its reliable start or release was missed (a rejoin
   * during a hold): the drag is predicted from the snapshot's position, and a release lands where the host has it.
   */
  private syncHold(s: Snapshot): void {
    const me = s.players.find((p) => p.id === this.localId);
    const heldHere = s.heldPlayer === this.localId;
    this.hud.setCalled(heldHere && !this.dead ? 'You are called: shoot the seal!' : null);
    if (!me) return;
    const boss = this.bossPoint();
    const current = (((me.teleportId ?? 0) - this.lastTeleportId) & 0xffff) < 0x8000;
    if (heldHere && !this.player.held && boss && current) this.player.hold(this.map, me.x, me.y, me.z, boss.x, boss.y, 0);
    else if (!heldHere && this.player.held && current && (me.teleportId ?? 0) !== this.lastTeleportId) { this.player.teleport(me.x, me.y, me.z); this.player.body.grounded = false; }
  }

  /** The Toll's ring at the screen's drawn time, the parts, the chain, the threads, the crosshair eye and the ring's whoosh. */
  private drawGatekeeper(now: number, ents: InterpolatedEnemies, enemyZ: Float32Array): void {
    const s = this.snaps.newest;
    const boss = this.bossPoint();
    const v = this.snaps.view, tick = v.tick + v.gap * v.frac;
    const parts: PartView[] = boss ? partsOf(ents, enemyZ) : [];
    const room = s && s.activeRoom !== 255 ? this.map.rooms[s.activeRoom] : undefined;
    const reward = room?.points?.reward;
    const base = reward ? this.map.floor[(reward[1] + 1) * this.map.w + reward[0] + 1] : boss?.z ?? 0;
    const held = s && s.heldPlayer !== 255 ? (s.heldPlayer === this.localId ? this.player.body : this.playerPose(s.heldPlayer) ?? null) : null;
    const me = this.dead ? null : this.player.body;
    this.gatekeeperView.update({ map: this.map, tick, boss, base, rings: boss ? this.tollImpacts : [], tollTell: s?.bossCast === BOSS_CAST_TOLL ? s.bossCastProgress / 255 : null,
      parts, held, heldLocal: s?.heldPlayer === this.localId, me, camera: this.scene.camera.position });
    // The crosshair eye: every 100 ms from c 22 through c 28, and while Watchers are open.
    let sight: 'full' | 'half' | 'none' | null = null;
    if (s && boss && me && sightWindow(tick - s.bossCycleStart, (s.bossFlags & BOSS_FLAG_WATCHERS) !== 0)) {
      if (now - this.sightAt >= 100) {
        this.sightAt = now;
        this.sight = sightState(this.map, me.x, me.y, me.z + PLAYER_EYE, [boss.x, boss.y, boss.z + 5], parts);
      }
      sight = this.sight;
    }
    this.hud.setSight(sight);
    debugState.boss = s && boss ? { phase: s.bossPhase, cast: s.bossCast, cycle: tick - s.bossCycleStart, held: s.heldPlayer, heldLocal: !!this.player.held,
      eyes: parts.filter((p) => !p.seal).length, seals: parts.filter((p) => p.seal).length, sight: sight ?? 'off', rings: [...this.tollImpacts], hp: s.bossHp, maxHp: s.bossMaxHp, flags: s.bossFlags,
      at: [boss.x, boss.y, boss.z], seal: ((q) => q ? [q.x, q.y, q.z] as [number, number, number] : null)(parts.find((p) => p.seal)) } : null;
    // Judgment's pre-warning at c 22: six seconds to its impact, the drone starts quietly.
    if (s && boss && !this.dead) {
      const c = tick - s.bossCycleStart;
      if (c >= 22 * 30 && c < 25 * 30 && this.prewarned !== s.bossCycleStart) {
        this.prewarned = s.bossCycleStart;
        this.sounds.bossCue('judgmentPrewarn');
        this.hud.bossText('Judgment gathers — find cover', 2500, now);
      }
    }
    // A rising whoosh when the front is 1 s from you, forecast from the announced impact during the tell too.
    const impact = this.tollImpacts[this.tollImpacts.length - 1] ?? 0;
    if (boss && me && impact > 0 && impact !== this.whooshed && !this.player.held) {
      const d = Math.hypot(me.x - boss.x, me.y - boss.y);
      const floor = this.map.floor[Math.floor(me.y) * this.map.w + Math.floor(me.x)];
      if (floor <= base + 1 + 1e-6 && ringContactIn(impact, tick, d) <= 1) { this.whooshed = impact; this.sounds.bossCue('ringWhoosh'); }
    }
  }

  /**
   * The Watchmen (rogue rooms.md §6.4): threads toward each target's drawn body center while aiming,
   * the rising note, and per accepted shot one muzzle flash, tracer, crack and, on cover, a spark.
   */
  private drawWatchmen(now: number, ents: InterpolatedEnemies, enemyZ: Float32Array, tick: number): void {
    const aims = this.watchmen.live(this.snaps.newest, tick);
    const center = (id: number): [number, number, number] | undefined => {
      const q = id === this.localId && this.dead ? undefined : this.playerPose(id);
      return q ? [q.x, q.y, q.z + PLAYER_HEIGHT / 2] : undefined;
    };
    this.watchmanView.update(ents, enemyZ, aims, this.map, tick, this.scene.camera.position, center);
    const at = (a: WatchmanAim) => {
      for (let i = 0; i < ents.count; i++) if (ents.slot[i] === a.slot && ents.incarnation[i] === a.incarnation) return { x: ents.x[i], y: ents.y[i], z: enemyZ[i] };
      return undefined;
    };
    const voiced: Array<{ aim: WatchmanAim; at: { x: number; y: number } }> = [];
    for (const a of aims) { const p = at(a); if (p) voiced.push({ aim: a, at: p }); }
    this.sounds.watchmen(this.paused ? [] : voiced, tick);
    for (const a of this.watchmen.takeShots(aims)) {
      const p = at(a);
      if (!p) continue;
      const dx = a.x - p.x, dy = a.y - p.y, h = Math.hypot(dx, dy) || 1;
      const bell = Math.min(this.o.enemyAnims[WATCHMAN] ? BELL_FORWARD : ROD_BELL_FORWARD, h * 0.5);
      const muzzle: [number, number, number] = [p.x + dx / h * bell, p.y + dy / h * bell, p.z + WATCHMAN_MUZZLE_Z];
      this.vfx.sphere(now, muzzle[0], muzzle[1], muzzle[2], 0xffe7a0, 0.08, 0.35, 90, 0.8);
      this.vfx.beam(now, [muzzle, [a.x, a.y, a.z]], 0xfff1c0, 0.07, 140);
      this.sounds.watchmanShot(p);
      // The host's end point is the target's body center on a hit; anywhere else it struck cover.
      const t = center(a.targetId);
      if (!t || Math.hypot(t[0] - a.x, t[1] - a.y, t[2] - a.z) > 0.75) this.particles.shotSpark(a.x, a.y, a.z, -dx, -dy);
    }
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
    const ab = this.talents.ability(e.playerId, e.slot);
    // R4–R5 alternatives draw their own effects (talent areas and events); the base key never applies to them.
    const key = ALT_SFX_KEYS.has(ab) ? `alt:${ab}` : `${cls}:${e.slot}`;
    const user = this.playerPose(e.playerId);
    switch (key) {
      case 'alt:ring': // chains burst up from the 7 m circle and haul the crowd into the ring
        this.vfx.ring(now, e.x, e.y, e.z, 0xd8401c, 7, 2.5, 320);
        if (e.playerId !== this.localId) this.pendingFx.push({ at: now + this.snaps.delayTicks * TICK_MS, run: (t) => this.pileChains(t, e.x, e.y, e.z, e.playerId) });
        else this.pileChains(now, e.x, e.y, e.z, e.playerId);
        break;
      case 'alt:castOut': // two wings of shock sweeping forward over the 10 m cone
        if (user) this.vfx.gust(now, [user.x, user.y, user.z + 1.2], [Math.cos(user.yaw), Math.sin(user.yaw), 0], Math.PI / 4, 10);
        this.vfx.ring(now, e.x, e.y, e.z, 0xe0301e, 0.5, 10, 350);
        break;
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
        // Discord's shout (M12 follow-up §2.4): others' gust of air from their chest along their facing;
        // the own one left on the key press.
        if (!user) break;
        if (e.playerId !== this.localId) this.vfx.gust(now, [user.x, user.y, user.z + PLAYER_EYE - GUST_BELOW_EYE], [Math.cos(user.yaw), Math.sin(user.yaw), 0], DISCORD_HALF_ANGLE, DISCORD_RANGE);
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
    // Thrown Silver (classes-betrayer.md `c.1b`): the coins fly 0.5 s before the pool opens.
    const open = (t: number): void => {
      this.pool?.dispose();
      this.pool = new BloodPool(this.map, e.x, e.y, e.z, t);
      this.scene.scene.add(this.pool.group);
    };
    if (e.thrown) this.pendingFx.push({ at: now + 500, run: open });
    else open(now);
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
    this.closeOverlay();
    this.resultAt = now;
    debugState.gameResult = e.result;
    this.resultData = {
      result: e.result,
      timeMs: e.timeMs,
      unclaimed: e.unclaimed,
      sentence: e.sentence ?? 0,
      crown: e.crown ?? -1,
      players: Object.entries(e.stats)
        .map(([id, stats]) => ({ id: Number(id), stats }))
        .sort((a, b) => a.id - b.id)
        .map(({ id, stats }) => ({ ...stats, id, name: this.roster.find((r) => r.id === id)?.name ?? `Player ${id}`, me: id === this.localId })),
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
    this.rooms.snapshot(s);
    this.dominion.snapshot(s);
    this.commanders.sync(s);
    debugState.commanders = [...this.commanders.active.values()].map((c) => ({ ...c }));
    this.watchmen.sync(s);
    debugState.watchmen = [...this.watchmen.active.values()].map((a) => ({ ...a }));
    debugState.watchmanBodies = [];
    for (let i = 0; i < s.enemyCount; i++) if (s.enemyType[i] === WATCHMAN) debugState.watchmanBodies.push({ slot: s.enemySlot[i], incarnation: s.enemyIncarnation[i], x: s.enemyX[i], y: s.enemyY[i], z: s.enemyZ[i] });
    debugState.dominion.actors = [];
    for (let i = 0; i < s.enemyCount; i++) if (s.enemyType[i] === DOMINION) debugState.dominion.actors.push({ slot: s.enemySlot[i], incarnation: s.enemyIncarnation[i], x: s.enemyX[i], y: s.enemyY[i], z: s.enemyZ[i] });
    // Every leaf follows from the header's activeRoom, activePhase and clearedMask (rogue game.md §3.4).
    let changed = false;
    let k = 0;
    this.map.rooms.forEach((room, ri) => {
      room.leaves.forEach((leaf, li) => {
        const closed = leafOpen(ri, leaf, s.activeRoom, s.activePhase, s.clearedMask) ? 0 : 1;
        if (closed !== this.leafDrawn[k]) {
          this.leafDrawn[k] = closed;
          this.scene.setLeafClosed(ri, li, closed === 1);
          changed = true;
        }
        k++;
      });
    });
    if (changed) applyLeaves(this.map, s);
    this.souls.update(s.players, now);
    const me = s.players.find((p) => p.id === this.localId);
    const was = prev?.players.find((p) => p.id === this.localId);
    // The shots the host has fired or dropped are in this snapshot's HP now (netcode stage 3).
    if (me) this.ownDamage.settle(me.shotsDone, now);
    // Healed by a Sacrament beam: its heals neither flash nor chime (M9 §5.1).
    const beamed = s.players.some((p) => p.beam === this.localId) || !!prev?.players.some((p) => p.beam === this.localId);
    if (me) {
      const correction = me.teleportId ?? 0, forward = (correction - this.lastTeleportId) & 0xffff;
      if ((me.carrySlot ?? -1) >= 0 && forward < 0x8000) {
        this.player.teleport(me.x, me.y, me.z); this.player.carried = true; this.lastTeleportId = correction;
        this.cancelCarriedActions();
      } else if (this.player.carried && (me.carrySlot ?? -1) < 0 && forward < 0x8000) {
        this.player.teleport(me.x, me.y, me.z); this.player.body.grounded = false; this.lastTeleportId = correction;
      }
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
        const boss = this.map.rooms[s.activeRoom]?.boss;
        if (!this.dead) this.hud.setDeath(null);
        else if (this.joinedAsSoul) this.hud.setDeath('Your party must revive you to join the fight', null, true);
        else this.hud.setDeath('You have fallen — your party can revive you', boss ? null : 'or you rise when the room is cleared');
      }
      if (this.dead) {
        this.ownGround = me.z;
        const progress = me.revive / 255;
        // Being revived: the hum plays while the progress rises.
        if (progress > this.ownRevive + 1e-6) this.reviveRisingAt = now;
        this.ownRevive = progress;
        this.hud.setOwnRevive(progress);
      } else this.ownRevive = 0;
      this.hud.setHp(me.hp, me.shield, this.maxHp, this.hpCut);
      this.hud.setWallet(me.wallet);
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
        // Its death already played when this screen predicted the kill (netcode stage 2).
        if (this.deaths.confirm(slot, prev.enemyIncarnation[i], now)) {
          this.burstMemory.forget(slot);
          continue;
        }
        const type = prev.enemyType[i];
        const def = ENEMIES[type];
        const g = groundHeight(this.map, prev.enemyX[i], prev.enemyY[i], def.radius, Infinity, false, true);
        const ground = g === -Infinity ? 0 : g;
        // A Cherub falls from its hover height to the ground while it dies (§11.1).
        const feet = def.flying ? prev.enemyZ[i] : ground;
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
      // The local player's own censers new in this snapshot are matched to their local flights (netcode stage 4).
      const had = new Set(prev.projSlot.subarray(0, prev.projectileCount));
      for (let i = 0; i < s.projectileCount; i++) {
        if (s.projKind[i] === PROJ_CENSER && s.projOwner[i] === this.localId && !had.has(s.projSlot[i])) this.ownCensers.claim(s.projSlot[i], now, s.projX[i], s.projY[i], s.projZ[i]);
      }
      const alive = new Set(s.projSlot.subarray(0, s.projectileCount));
      for (let i = 0; i < prev.projectileCount; i++) {
        if (prev.projKind[i] !== PROJ_CENSER || alive.has(prev.projSlot[i])) continue;
        // The local player's own censer already broke here, at once (netcode stage 4).
        if (prev.projOwner[i] === this.localId && this.ownCensers.release(prev.projSlot[i], prev.projX[i], prev.projY[i], prev.projZ[i], now)) continue;
        // A censer that vanished over the void didn't break (M10 §3.4).
        if (overVoid(this.map, prev.projX[i], prev.projY[i])) continue;
        this.pendingBursts.push({ at: now + delay, censer: true, slot: -1, type: -1, x: prev.projX[i], y: prev.projY[i], z: prev.projZ[i], ground: 0, feet: 0, facing: 0, rippled: false });
      }
    }
    // A predicted kill the host's snapshots still show alive after the shot reached it reappears.
    for (const slot of this.deaths.settle(s.tick, (q) => this.snaps.incarnationOf(q), now)) {
      this.revealedKills++;
      // Its predicted corpse goes with it.
      for (let i = this.corpses.length - 1; i >= 0; i--) if (this.corpses[i].slot === slot && now - this.corpses[i].start < PREDICTION_MAX_MS) this.corpses.splice(i, 1);
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
              if (q) this.scourgeShape(t, p.id, q.x, q.y, q.z, q.yaw);
            },
          });
        }
      }
    }
    this.countShots(s);
    debugState.lastSnapshotTick = s.tick;
    debugState.enemies = s.enemyCount;
    debugState.projectiles = s.projectileCount;
    debugState.wallet = s.players.find((p) => p.id === this.localId)?.wallet ?? 0;
    debugState.pickups = Array.from(s.pickupId, (id, i) => ({ id, kind: s.pickupKind[i], x: s.pickupX[i], y: s.pickupY[i] }));
    debugState.activeRoom = s.activeRoom;
    debugState.activePhase = s.activePhase === PHASE_COMBAT ? 'combat' : s.activePhase === PHASE_COUNTDOWN ? 'countdown' : 'idle';
    this.sealed = s.activePhase === PHASE_COMBAT;
    debugState.clearedMask = s.clearedMask;
    debugState.countdown = s.activePhase === PHASE_COUNTDOWN ? s.countdown / 10 : 0;
    this.hud.setCountdown(s.activePhase === PHASE_COUNTDOWN ? s.countdown / 10 : null,
      s.hold & 0x80 ? `Waiting for the party (${(s.hold >> 3) & 7}/${s.hold & 7})` : null);
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
          return r ? [{ id: p.id, name: r.name, classId: r.classId, hp: p.hp, shield: p.shield, dead: p.dead, revive: p.revive / 255, held: s.heldPlayer === p.id }] : [];
        }),
    );
    this.hud.setRemaining(s.activePhase === PHASE_COMBAT ? s.enemiesRemaining : null);
    const castLabel = s.bossCast === BOSS_CAST_JUDGMENT ? 'Judgment' : s.bossCast === BOSS_CAST_TOLL ? 'The Toll' : s.bossCast === BOSS_CAST_CALL ? 'Called to the Gate' : s.bossCast === BOSS_CAST_VOLLEY ? 'Orb Volley' : '';
    this.hud.setBoss(s.bossHp, s.bossMaxHp, castLabel ? { label: castLabel, progress: s.bossCastProgress / 255, brk: s.bossCast === BOSS_CAST_JUDGMENT ? s.bossBreak / 255 : 0 } : null,
      { phase: s.bossPhase & 3, invulnerable: (s.bossPhase & BOSS_PHASE_INVULNERABLE) !== 0, deferred: (s.bossFlags & BOSS_FLAG_DEFERRED) !== 0 });
    if (s.tollTick > 0 && !this.tollImpacts.includes(s.tollTick)) this.tollImpacts = [...this.tollImpacts, s.tollTick].slice(-2);
    if (s.bossMaxHp <= 0) this.tollImpacts = [];
    this.syncHold(s);
    this.bossCast = s.bossCast;
    this.bossCastProgress = s.bossCastProgress / 255;
    this.bench?.onSnapshot(s);
    this.sounds.snapshot(s, prev, beamed);
  }

  /**
   * The spawn glow (M12 §2.4): an enemy slot that wasn't in the previous snapshot, within 2 m
   * horizontally of a spawn or squad point of the snapshot's active room, flares that point when it appears on
   * screen (`at`, after the render delay). Gatekeeper summons glow the same way.
   */
  private spawnGlows(s: Snapshot, prev: Snapshot, at: number): void {
    // Squad points flare too (M12 follow-up §4.2).
    const points = this.map.roomSpawnPoints[s.activeRoom]?.concat(this.map.roomSquadPoints[s.activeRoom]);
    if (!points?.length) return;
    for (let i = 0; i < prev.enemyCount; i++) this.prevSlots[prev.enemySlot[i]] = 1;
    const flared = new Map<number, number>();
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
      if (best >= 0) flared.set(best, Math.max(flared.get(best) ?? 1, isCommander(s.enemyType[i]) ? 1.5 : 1));
    }
    for (let i = 0; i < prev.enemyCount; i++) this.prevSlots[prev.enemySlot[i]] = 0;
    for (const [k, width] of flared) {
      const [c, r] = points[k];
      const z = this.map.floor[r * this.map.w + c];
      this.pendingFx.push({ at, run: (t) => this.vfx.flareSpawn(t, c + 0.5, r + 0.5, z, width) });
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
    if (slot === 'E' && ms > 0) this.eAcked = true;
    if (slot === 'E' && !this.eAcked && ABILITIES[this.classId].E.movement && (this.classId !== 'betrayer' || this.talents.ability(this.localId, 'E') === 'shadowstep')) cd = Math.max(cd, (this.localEReadyAt - now) / 1000);
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
   * hits an interpolated enemy. The Silver Bullet draws its predicted tracer, the Scourge its arc and
   * swing; Sacrament's beam is drawn every frame instead. `shot` is the shot's counter: its pellets
   * scatter as the host's do, and its predicted damage waits for the host under it (netcode stage 3).
   */
  private cosmeticShot(now: number, slot: AttackSlot, ents: InterpolatedEnemies, enemyZ: Float32Array, shot: number): void {
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
        this.scourgeShape(now, this.localId, p.body.x, p.body.y, p.body.z, p.yaw);
        const hits = this.scourgeHits(ents, enemyZ);
        if (hits.length) {
          this.hud.hit(now);
          this.sounds.hit();
        }
        // Every Scourge kill bursts; each hit flinches away from the Binder (M12 §4.4).
        for (const i of hits) {
          const hp = this.hpLeft(ents, i), factor = this.hitFactor(ents, i);
          if (hp <= 0) continue;
          const r = predictHit(ents.type[i], hp, w.damage, factor, true);
          this.predictedHit(now, ents, enemyZ, i, ents.x[i] - p.body.x, ents.y[i] - p.body.y, r, w.damage, shot, Math.min(w.damage * factor, hp));
        }
        return;
      }
      case 'censer': {
        this.hudShot(now, slot);
        this.sounds.ownShot(this.classId, secondary);
        // It leaves the painted launcher's muzzle (the stage 2 playtest) and flies from the eye, as on the host.
        const [msx, msy] = this.hud.muzzlePoint(now);
        const [mx, my, mz] = this.unproject(msx, msy, OWN_BEAM_DEPTH);
        const [dx, dy, dz] = aimDir(p.yaw, p.pitch);
        this.ownCensers.throw(now, ex, ey, ez, dx, dy, dz, Math.min(w.range, PROJECTILE_RANGE), mx, my, mz);
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
    // Barbed Rounds: a Chain Gun bullet goes on into a second enemy (classes-binder.md `c.1a`).
    const maxHits = this.classId === 'binder' && slot === ATTACK_PRIMARY && this.talents.ownHas('binder.c.1a') ? 2 : w.maxHits;
    // Each pellet's ray, scattered as the host scatters it, and the enemies along it, nearest first, that
    // the host still has alive; the shotgun's within 6 m of the Fallen's body center deal 20 and burst
    // what they kill (M12 §5.1, §4.1).
    const rays = Array.from({ length: w.pellets }, (_, k) => {
      const yaw = p.yaw + shotSpread(this.localId, shot, k, 0) * w.spreadYaw;
      const pitch = p.pitch + shotSpread(this.localId, shot, k, 1) * w.spreadPitch;
      const [dx, dy, dz] = aimDir(yaw, pitch);
      const stop = raycastTerrain(this.map, ex, ey, ez, dx, dy, dz, w.range);
      const ts: Array<PelletTarget & { rooted: boolean; taunted: boolean }> = [];
      for (let i = 0; i < ents.count; i++) {
        const def = ENEMIES[ents.type[i]];
        const t = rayEnemy(ex, ey, ez, dx, dy, dz, ents.type[i], ents.x[i], ents.y[i], enemyZ[i]);
        if (t > stop) continue;
        const hp = this.hpLeft(ents, i);
        if (hp <= 0) continue;
        const close = shotgun && distToCylinder(ex, ey, p.body.z + PLAYER_HEIGHT / 2, ents.x[i], ents.y[i], enemyZ[i], def.radius, def.height) <= SHOTGUN_KNOCKBACK_RANGE;
        ts.push({ i, t, type: ents.type[i], hp, factor: this.hitFactor(ents, i), close, rooted: (ents.flags[i] & FLAG_ROOTED) !== 0, taunted: (ents.flags[i] & FLAG_TAUNTED) !== 0 });
      }
      ts.sort((a, b) => a.t - b.t);
      return { dx, dy, dz, stop, ts };
    });
    // Enemies an earlier pellet of this shot is predicted to kill: later pellets pass them, as on the host.
    const predicted = w.kind === 'silverBullet' ? null : predictPellets(rays.map((r) => r.ts), w.damage, maxHits, shotgun ? 'shotgun' : 'other', SHOTGUN_CLOSE_DAMAGE);
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
          // The host's rule on the enemies' HP (netcode stage 3); Behind His Back halves a taunted one's cost.
          const behind = this.talents.ownHas('betrayer.a.3b');
          const r = predictSilverBullet(ts.map((t) => ({ type: t.type, hp: t.hp, factor: t.factor, rooted: t.rooted, half: behind && t.taunted })), w.damage);
          if (r.stopped) end = ts[r.hits.length - 1].t;
          r.hits.forEach((h, n) => this.predictedHit(now, ents, enemyZ, ts[n].i, dx, dy, h.result, w.damage, shot, h.dealt));
        } else {
          const hits = predicted[k];
          if (hits.length >= maxHits) end = hits[hits.length - 1].target.t;
          for (const h of hits) this.predictedHit(now, ents, enemyZ, h.target.i, dx, dy, h.result, shotgun && h.target.close ? SHOTGUN_CLOSE_DAMAGE : w.damage, shot, h.dealt);
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
   * The HP the host has left on the interpolated enemy `i`: the newest snapshot's, less what this
   * screen's unresolved shots dealt it (netcode stage 3). At most 0 when the host has it dead.
   */
  private hpLeft(ents: InterpolatedEnemies, i: number): number {
    const slot = ents.slot[i], incarnation = ents.incarnation[i];
    return this.snaps.hpOf(slot, incarnation) - this.ownDamage.pending(slot, incarnation);
  }

  /** The host's damage multiplier on the interpolated enemy `i`: ×2 rooted, a Cantor's hymnal toward the local player. */
  private hitFactor(ents: InterpolatedEnemies, i: number): number {
    let f = (ents.flags[i] & FLAG_ROOTED) !== 0 ? 2 : 1;
    const c = this.commanders.active.get(ents.slot[i]);
    if (c?.kind === 'beam' && (c.phase === 'tell' || c.phase === 'active') && c.incarnation === ents.incarnation[i]) {
      f *= hymnalReduction(c.yaw, this.player.body.x - ents.x[i], this.player.body.y - ents.y[i], false);
    }
    return f;
  }

  /**
   * A predicted hit of `damage` by the local player on the interpolated enemy `i`, along the horizontal
   * (dx, dy) (M12 §4.4): it flinches, and a predicted kill plays the kill marker (or the burst marker),
   * `killTick` and the enemy's death now, where it's drawn (netcode stage 2). The `dealt` damage waits
   * under the shot's counter until the host resolves it, and shows its damage number now (netcode stage 3).
   */
  private predictedHit(now: number, ents: InterpolatedEnemies, enemyZ: Float32Array, i: number, dx: number, dy: number, r: Predicted, damage: number, shot: number, dealt: number): void {
    const slot = ents.slot[i];
    // Already dead on this screen: a second shot in the same frame passes it.
    if (this.deaths.hides(slot, ents.incarnation[i])) return;
    this.ownDamage.add(shot, slot, ents.incarnation[i], dealt, now);
    if (dealt > 0 && loadDamageNumbersSetting()) {
      this.damageNumbers.add([slot, ents.x[i], ents.y[i], enemyZ[i] + ENEMIES[ents.type[i]].shot.top + 0.3, dealt, r ? 1 : 0], now);
    }
    this.flinches.add(slot, now, dx, dy, r ? KILL_FLINCH : HIT_FLINCH);
    if (!r) return;
    this.confirmations.add(slot, now);
    this.sounds.kill(this.predicted.kill(now));
    if (r === 2) this.hud.burst(now);
    else this.hud.kill(now);
    this.predictedDeath(now, ents, enemyZ, i, dx, dy, r === 2, damage);
  }

  /**
   * The enemy `i` the local player's screen predicted it killed dies at once, where it's drawn, and is
   * hidden until the snapshots confirm it (netcode stage 2). A predicted burst blasts it along the shot,
   * heavy when the damage reaches 4× its max HP; the host's own burst wins if it already arrived.
   */
  private predictedDeath(now: number, ents: InterpolatedEnemies, enemyZ: Float32Array, i: number, dx: number, dy: number, bursts: boolean, damage: number): void {
    const slot = ents.slot[i];
    const type = ents.type[i];
    const rtt = this.o.link ? this.o.link.rttMs : 0;
    if (!this.deaths.add(slot, ents.incarnation[i], revealTick(this.snaps.estimatedTick(now), rtt, TICK_MS), now)) return;
    // Killed on the host already, its death waiting for the render delay: it plays now instead.
    const pending = this.pendingBursts.findIndex((b) => !b.censer && b.slot === slot);
    if (pending >= 0) {
      this.pendingBursts.splice(pending, 1);
      this.deaths.confirm(slot, ents.incarnation[i], now);
    }
    const def = ENEMIES[type];
    const x = ents.x[i];
    const y = ents.y[i];
    if (bursts && !this.burstMemory.peek(slot, now)) {
      const heavy = ((ents.flags[i] & FLAG_ROOTED) !== 0 ? 2 : 1) * damage >= BURST_HEAVY * def.hp - 1e-9;
      const angle = burstAngle(x - dx, y - dy, x, y, slot);
      this.burstMemory.remember([slot, heavy ? angle + 360 : angle, this.localId], now, () => 0);
    }
    const g = groundHeight(this.map, x, y, def.radius, Infinity, false, true);
    const ground = g === -Infinity ? 0 : g;
    const feet = def.flying ? enemyZ[i] : ground;
    this.playDeath({ at: now, censer: false, slot, type, x, y, z: feet + def.height / 2, ground, feet, facing: this.animator.facing[slot], rippled: true }, now);
  }

  /**
   * The local player's kills the host reported (netcode stage 4): by an ability, fire, incense, a censer, a
   * talent or a relic, which this screen doesn't predict. Each dies now where this screen draws it, like
   * a predicted kill, instead of after the render delay. A burst's ripple still delays it once.
   */
  private playReportedKills(now: number, ents: InterpolatedEnemies): void {
    const kills = this.reportedKills;
    for (let k = 0; k + 1 < kills.length; k += 2) {
      const slot = kills[k], incarnation = kills[k + 1];
      if (slot < 0 || slot >= ENEMY_SLOTS || this.deaths.hides(slot, incarnation)) continue;
      const pending = this.pendingBursts.find((b) => !b.censer && b.slot === slot);
      let i = -1;
      for (let j = 0; j < ents.count; j++) if (ents.slot[j] === slot && ents.incarnation[j] === incarnation) { i = j; break; }
      if (i < 0) {
        // Not drawn now: its death, if the snapshots already dropped it, plays now.
        if (pending) pending.at = Math.min(pending.at, now);
        continue;
      }
      const rtt = this.o.link ? this.o.link.rttMs : 0;
      if (!this.deaths.add(slot, incarnation, revealTick(this.snaps.estimatedTick(now), rtt, TICK_MS), now)) continue;
      this.reportedEarly++;
      if (pending) {
        this.pendingBursts.splice(this.pendingBursts.indexOf(pending), 1);
        this.deaths.confirm(slot, incarnation, now);
      }
      const type = ents.type[i], def = ENEMIES[type], x = ents.x[i], y = ents.y[i];
      const g = groundHeight(this.map, x, y, def.radius, Infinity, false, true);
      const ground = g === -Infinity ? 0 : g;
      const feet = def.flying ? ents.z[i] : ground;
      this.pendingBursts.push({ at: now, censer: false, slot, type, x, y, z: feet + def.height / 2, ground, feet, facing: this.animator.facing[slot], rippled: false });
    }
    kills.length = 0;
  }

  /** The world the local player's own censers fly through this frame, as this screen draws it (netcode stage 4). */
  private censerWorld(ents: InterpolatedEnemies, enemyZ: Float32Array, now: number): CenserWorld {
    const souls: Array<{ x: number; y: number; base: number }> = [];
    for (const q of this.snaps.playersOut) if (q.id !== this.localId && q.dead) souls.push({ x: q.x, y: q.y, base: q.z + this.souls.rise(q.id, now) });
    return { map: this.map, enemies: ents, enemyZ, souls, props: this.props.defs, broken: this.props.model.broken, passBlessed: this.talents.ownHas('heretic.a.3b') };
  }

  /** A local censer broke (M9 §5.1): its small burst and sound now; on an enemy, the hit marker and a flinch. */
  private ownCenserBreak(now: number, b: CenserBreak, ents: InterpolatedEnemies): void {
    this.particles.censerBreak(b.x, b.y, b.z);
    this.vfx.glow(now, b.x, b.y, b.z, 0xf08a24, 0.15, 0.6, 250);
    this.sounds.censerBreak(b);
    if (b.enemy < 0) return;
    this.hud.hit(now);
    this.sounds.hit();
    this.flinches.add(ents.slot[b.enemy], now, ents.x[b.enemy] - this.player.body.x, ents.y[b.enemy] - this.player.body.y, HIT_FLINCH);
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
      const fallFrom = ENEMIES[b.type].flying ? b.feet : undefined;
      this.corpses.push({ start: now, x: b.x, y: b.y, z: b.ground, facing: b.facing, type: b.type, fallFrom, slot: b.slot });
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
    const lift = ENEMIES[b.type].flying ? 0 : tier.lift;
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
    // Render authoritative altitude as well as horizontal movement (leaps, throws and hovering).
    const ents = this.snaps.interpolate(simNow);
    this.playReportedKills(now, ents);
    this.deaths.filter(ents);
    const enemyZ = this.zScratch;
    enemyZ.set(ents.z.subarray(0, ents.count));
    this.frameNo++;
    this.computeAllyTarget(now);
    this.party?.setAllyTarget(this.allyTargetId);

    let mx = 0;
    let my = 0;
    let wantJump = false;
    let fire = 0;
    // Mouse presses this frame; only a living player's own input keeps them (click latching).
    const presses = this.input.takePresses();
    let pressesKept = false;
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
        e.seal = (ents.flags[i] & FLAG_PART_SEAL) !== 0 && e.type === BOSS_PART;
        e.opening = (ents.flags[i] & FLAG_PART_OPENING) !== 0 && e.type === BOSS_PART;
      }
      const s = this.snaps.newest;
      const out = this.bot.update(now, {
        stair: this.victory,
        map: this.map,
        body: p.body,
        dead: this.dead,
        enemies: be,
        commanderCasts: this.commanders.live(s, this.snaps.estimatedTick(simNow)),
        watchmanAims: this.watchmen.live(s, this.snaps.estimatedTick(simNow)),
        dominionRings: s ? this.dominion.rings(s, this.snaps.estimatedTick(simNow)) : [],
        activeRoom: s?.activeRoom ?? 255,
        activePhase: s?.activePhase ?? 0,
        clearedMask: s?.clearedMask ?? 0,
        entrySocket: this.rooms.states[s?.activeRoom ?? 255]?.entrySocket,
        followParty: !this.o.singleplayer,
        // Follow the host human, then the lowest-id living human (rogue game.md §12.4).
        hostPlayer: this.o.singleplayer ? null : (this.snaps.playersOut.find((q) => q.id === 0 && !q.dead && !this.roster.find((r) => r.id === q.id)?.bot) ?? this.snaps.playersOut.find((q) => !q.dead && !this.roster.find((r) => r.id === q.id)?.bot) ?? null),
        qReady: this.displayedCooldown('Q', now) <= 0,
        eReady: this.displayedCooldown('E', now) <= 0,
        blockedLastFrame: p.moveResult.blocked,
        entryIndex: this.entryIndex,
        souls: this.snaps.playersOut.filter((q) => q.dead && q.id !== this.localId),
        humanSouls: this.snaps.playersOut.filter((q) => q.dead && q.id !== this.localId && !this.roster.find((r) => r.id === q.id)?.bot),
        classId: this.classId,
        teammates: this.snaps.playersOut.flatMap((q) => {
          const cls = this.classOf(q.id);
          const rec = s?.players.find((r) => r.id === q.id);
          if (q.id === this.localId || q.dead || !cls || !rec) return [];
          return [{ x: q.x, y: q.y, z: q.z, hpFrac: rec.hp / CLASSES[cls].hp, human: !this.roster.find((r) => r.id === q.id)?.bot }];
        }),
        boss: this.botBoss(),
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
      if (this.input.mapHeld) this.mapView.moveCursor(dx, dy);
      else p.look(dx * MOUSE_SENSITIVITY, -dy * MOUSE_SENSITIVITY);
      const axes = this.input.moveAxes();
      [mx, my] = wasdDirection(p.yaw, axes.forward, axes.right);
      wantJump = this.input.jumpQueued || this.input.isDown('Space');
      fire = this.input.fireBits();
      // A right press while aiming Falling Star or Rain of Fire cancels the aim instead of firing.
      const aiming = this.starAim.aiming;
      if (this.classId === 'fallen') fire = this.updateStarAim(now, fire);
      if (this.classId === 'fallen' && (aiming || this.starAim.rightBlocked)) presses[1] = 0;
      pressesKept = true;
    } else {
      // Dead: the camera can only rotate.
      const { dx, dy } = this.input.takeMouse();
      if (this.input.mapHeld) this.mapView.moveCursor(dx, dy);
      else p.look(dx * MOUSE_SENSITIVITY, -dy * MOUSE_SENSITIVITY);
    }
    this.input.jumpQueued = false;
    this.fire = this.dead || this.over || p.carried || this.input.mapHeld ? 0 : fire;
    // Neither attack fires during Shadowstep's slash; held buttons resume afterwards (M12 §5.7).
    if (now - this.slashAt < SHADOWSTEP_TIME * 1000) this.fire = 0;
    if (pressesKept && !this.dead && !this.over && !p.carried && !this.input.mapHeld && now - this.slashAt >= SHADOWSTEP_TIME * 1000) {
      for (const b of [0, 1] as const) {
        if (!presses[b]) continue;
        if (b === 0) this.leftPresses = (this.leftPresses + presses[b]) & 0xff;
        else this.rightPresses = (this.rightPresses + presses[b]) & 0xff;
        latchPress(this.latch, b, this.fireTick);
      }
    } else if (this.dead || this.over || p.carried) latchClear(this.latch);
    const bx = p.body.x;
    const by = p.body.y;
    // Wading (M12 §3.1): the ground enemies of the newest snapshot pressing against the player slow
    // it. Counted every frame, in the benchmark too, which doesn't move the player.
    const newest = this.snaps.newest;
    // Wading talents (R4–R5) leave some enemies out: Unbowed counts only bound ones, Iron Stride skips slowed
    // ones, Walk in the Smoke skips all while in its owner's incense.
    const ignore = this.talents.wadeIgnore(p.body.x, p.body.y, p.body.z);
    const pressing = newest && !this.dead ? wadeCount(this.map, p.body.x, p.body.y, p.body.z, newest, this.wadeLaunchedUntil, now, ignore) : 0;
    // Through the Throng (classes-betrayer.md `b.1a`): the crowd doesn't slow you; Gatebreaker's charge ignores it too.
    p.wade = this.wading.update(this.talents.unslowed || p.charging ? 0 : pressing, Math.min(dt, MAX_FRAME_DT));
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
    let shotNow = false;
    while (this.fireAcc >= TICK_DT) {
      this.fireAcc -= TICK_DT;
      this.fireTick++;
      // A latched press fires like a held button, as on the host (click latching).
      const attack = chooseAttack(this.classId, this.fire | latchBits(this.latch, this.fireTick), this.allyTargetId !== ALLY_NONE);
      if (attack !== ATTACK_NONE && this.fireTimer <= 1e-6) {
        latchFired(this.latch, attack);
        // The host fires this shot with the aim and view of the input sent this frame (client-timed shots),
        // its pellets scattered by this counter (netcode stage 3).
        this.shots = (this.shots + 1) & 0xff;
        this.cosmeticShot(now, attack, ents, enemyZ, this.shots);
        this.shotButton = attack === ATTACK_SECONDARY ? 1 : 0;
        const view = this.snaps.view;
        Object.assign(this.shotAim, { yaw: p.yaw, pitch: p.pitch, tick: view.tick, gap: view.gap, frac: view.frac });
        shotNow = true;
        // Whirl swings every 1.2 s (classes-binder.md `b.1a`).
        this.fireTimer += this.classId === 'binder' && attack === ATTACK_SECONDARY && this.talents.ownHas('binder.b.1a') ? BINDER.whirlInterval : attackDef(this.classId, attack).interval;
      }
      this.fireTimer -= TICK_DT * this.localFireRate();
      if (attack === ATTACK_NONE && this.fireTimer < 0) this.fireTimer = 0;
    }

    // The local player's own censers fly on and break where they meet what this screen draws (netcode stage 4).
    for (const b of this.ownCensers.step(now, Math.min(dt, 0.25), this.censerWorld(ents, enemyZ, now))) this.ownCenserBreak(now, b, ents);

    // Input to the host at 30 Hz, and in every frame that fired a shot.
    this.inputAcc += dt;
    if (shotNow && !this.over) {
      this.inputAcc = 0;
      this.sendInput();
    } else if (this.inputAcc >= TICK_DT && !this.over) {
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
        // The cloud itself comes from the host's published area (R5: worn, triple, pillar clouds, furrows).
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
    this.drawAimPreview();
    this.drawBillboards(now, ents, enemyZ);
    this.pickups.update(this.snaps.newest, this.scene.camera, this.snaps.estimatedTick(now));
    const rewardIds = this.o.floor ? rewardPickupIds([...this.pickups.model.records.values()].map((r) => r.pickup), this.o.floor, this.map) : new Set<number>();
    // St Peter's key lies in its own narrow gold beam (§6.5).
    for (const r of this.pickups.model.records.values()) if (r.pickup.kind === KEY) rewardIds.add(r.pickup.id);
    this.rewardShafts.update(now, this.snaps.newest, rewardIds, (x, y) => this.map.floor[Math.floor(y) * this.map.w + Math.floor(x)], this.scene.camera.position);
    const itemTick = this.snaps.estimatedTick(simNow);
    this.itemView.update(itemTick);
    this.relicView.update(itemTick);
    debugState.relicAreas = this.relicView.areaEffects();
    debugState.relicShots = this.relicView.shotCount();
    this.relicHud.update(itemTick, now);
    const sundial = this.sundialLeft();
    this.relicHud.setSundial(this.o.floor && sundial > 0 ? sundial : null);
    for (const [x, y, z] of this.featherTrails.step(now, (id) => id === this.localId ? (this.dead ? undefined : this.player.body) : this.playerPose(id))) this.particles.trailFeather(x, y, z);
    this.player.speed = CLASSES[this.classId].speed + (!this.dead && itemTick < (this.inventory?.featherUntil ?? 0) ? FEATHER_SPEED : 0);
    this.hud.setItemCooldown(this.inventory ? Math.max(0, this.inventory.itemReadyTick - itemTick) / 30 : 0);
    this.props.update(this.scene.camera, this.snaps.estimatedTick(simNow));
    const dominionTick = this.snaps.estimatedTick(simNow);
    const dominionRings = this.snaps.newest ? this.dominion.rings(this.snaps.newest, dominionTick) : [];
    this.dominionView.update(dominionRings, dominionTick);
    const family = this.commanders.live(this.snaps.newest, dominionTick);
    this.commanderView.update(family, this.map, dominionTick, this.scene.camera.position);
    this.sounds.commanders(this.paused ? [] : family, dominionTick);
    this.drawWatchmen(now, ents, enemyZ, dominionTick);
    this.drawGatekeeper(now, ents, enemyZ);
    debugState.spawnWarnings = this.spawnWarnings.live(dominionTick);
    this.spawnView.update(debugState.spawnWarnings, dominionTick);
    this.sounds.arrivals(this.paused ? [] : debugState.spawnWarnings, dominionTick);
    this.sounds.dominions(this.paused ? [] : dominionRings, dominionTick);
    debugState.dominion.casts = dominionRings;
    const fireCells = this.hazards.update(this.snaps.newest, this.scene.camera, dominionTick, this.over);
    const fireRoom = fireCells > 0 ? this.snaps.newest!.activeRoom : -1;
    const fireOwnRoom = this.rooms.roomAt(p.body.x, p.body.y);
    this.sounds.hazard(fireOwnRoom === fireRoom && !this.paused ? this.hazards.nearest(fireRoom, p.body.x, p.body.y, now) : null);
    debugState.hazards = { activeRoom: fireRoom, activeCells: fireCells };
    const beamed = this.drawHealBeams(now, Math.min(dt, MAX_FRAME_DT));
    this.hud.setHealing(this.ownBeamOn, now);
    this.hud.setBeamed(beamed.has(this.localId));
    this.party?.setBeamed(beamed);
    this.scene.render();
    this.placeChevron(now);
    this.placeSoulMarkers(now);
    this.damageNumbers.update(now, (x, y, z) => this.project(x, y, z));
    this.hitArcs.update(now, (x, y) => {
      const v = this.projScratch.set(x, this.scene.camera.position.y, y).applyMatrix4(this.scene.camera.matrixWorldInverse);
      return arcAngle(v.x, v.z);
    });
    this.updateReviveHum(now);

    // Low HP (M12 §6.2): the heartbeat and the crimson edge.
    if (this.lowHp.update(now, this.seenSelf && !this.dead && !this.over, this.ownHp, this.maxHp)) this.sounds.heartbeat();
    this.hud.setLowEdge(this.lowHp.edge(now));
    this.hud.setCooldowns(this.displayedCooldown('Q', simNow), this.talents.ownDef(this.classId, 'Q').cooldown, this.displayedCooldown('E', simNow), this.talents.ownDef(this.classId, 'E').cooldown);
    this.talents.update(now, this.snaps.out, [...this.snaps.playersOut, { id: this.localId, x: p.body.x, y: p.body.y, z: p.body.z, dead: this.dead }], (x, y) => this.rooms.roomAt(x, y));
    const waiting = this.talents.offers.filter((o) => o.source !== 'sundial' && o.source !== 'bargain').length + this.relicOffers.filter((o) => o.source === 'chest').length;
    this.ritePip.hidden = !waiting || this.over;
    this.ritePip.textContent = `Choice waiting · F (${waiting})`;
    this.hud.update(now);
    this.mapView.open = this.input.mapHeld && !this.over && !this.paused && !this.hud.chatOpen;
    debugState.mapHeld = this.mapView.open;
    const ownRoom = this.rooms.roomAt(p.body.x, p.body.y);
    const snap = this.snaps.newest;
    this.hud.setRoomMessage(roomMessage(this.rooms, ownRoom, snap?.activeRoom ?? 255, snap?.activePhase ?? 0));
    const mapPlayers: MapPlayer[] = this.snaps.playersOut.flatMap((q) => {
      const r = this.roster.find((r) => r.id === q.id);
      return r && q.id !== this.localId ? [{ ...q, name: r.name, classId: r.classId }] : [];
    });
    mapPlayers.push({ id: this.localId, name: this.roster.find((r) => r.id === this.localId)!.name, classId: this.classId, x: p.body.x, y: p.body.y, yaw: p.yaw });
    this.mapView.update(now, mapPlayers, ownRoom);
    const shopTarget = this.shop.target(this.player.body, this.player.yaw, this.player.pitch);
    this.shopHint.textContent = this.dead || this.paused ? '' : shopTarget >= 0 ? this.shop.label(shopTarget, this.inventory)
      : this.routeView.label(this.routeView.target(this.player.body), this.localId) || (this.advocateInReach() ? 'The Advocate · F: talents, relics, the bargain' : '');
    this.routeView.update(this.scene.camera.position);
    debugState.fps = this.fps.frame(now);
    debugState.simMs = this.o.host ? this.o.host.simMs(now) : 0;
    debugState.director = this.o.host?.director ?? null;
    debugState.carrierChecks = this.o.host?.carrierChecks ?? [];
    debugState.weaponKills = this.o.host?.weaponKills ?? {};
    debugState.netInKBps = this.o.net ? this.o.net.inKBps(now) : 0;
    debugState.netOutKBps = this.o.net ? this.o.net.outKBps(now) : 0;
    const link = this.o.link ?? null;
    debugState.link = {
      rttMs: link?.rttMs ?? null,
      route: link?.route ?? null,
      delayMs: this.snaps.delayTicks * TICK_MS,
      jitterMs: this.snaps.jitterTicks * TICK_MS,
      lines: link ? [link.text()] : this.o.host?.linkLines() ?? [],
    };
    const c = this.confirmations;
    c.update(now, (slot) => this.snaps.hasEnemy(slot));
    debugState.killMarkers = { predicted: c.predicted, confirmed: c.confirmed, missed: c.missed, revealed: this.revealedKills, reported: this.reportedEarly };
    const oc = this.ownCensers;
    debugState.censers = { thrown: oc.thrown, matched: oc.matched, agreed: oc.agreed, unmatched: oc.unmatched };
    // Read-only own pose also supports the normal-menu multiplayer prop/catch-up fixture.
    Object.assign(debugState.self, { x: b.x, y: b.y, z: b.z, yaw: p.yaw, pitch: p.pitch });
    if (this.params.dev) {
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
    debugState.dominion.rendered.length = 0;
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
      if (type === DOMINION && ents.state[i] === ST_WINDUP && !stunned) {
        const cast = this.dominion.active.get(slot);
        if (cast && cast.incarnation === this.snaps.newest?.enemyIncarnation[this.snaps.newest.enemySlot.indexOf(slot)]) {
          pick.anim = 'cast'; pick.frame = Math.max(0, Math.min(5, Math.floor((this.snaps.estimatedTick(now) - cast.startTick) / (cast.impactTick - cast.startTick) * 6)));
        }
      }
      const commander = this.commanders.sample(slot, this.snaps.estimatedTick(now));
      if (commander && commander.incarnation === this.snaps.newest?.enemyIncarnation[this.snaps.newest.enemySlot.indexOf(slot)]) {
        if (type === CANTOR || commander.phase !== 'idle') this.animator.facing[slot] = commander.yaw;
        if (!stunned && commander.phase !== 'idle') {
          const age = Math.max(0, this.snaps.estimatedTick(now) - commander.phaseTick);
          if (type === CANTOR) {
            pick.anim = commander.phase === 'tell' ? 'cast' : commander.phase === 'active' ? 'sing' : 'close';
            pick.frame = commander.phase === 'tell' ? Math.min(7, Math.floor(age / Math.max(1, commander.endTick - commander.phaseTick) * 8)) : commander.phase === 'active' ? Math.floor(age / 8) % 4 : Math.min(3, Math.floor(age / Math.max(1, commander.endTick - commander.phaseTick) * 4));
          } else if (type === CARRIER) {
            pick.anim = commander.phase === 'tell' ? 'mark' : commander.phase === 'active' ? 'swoop' : commander.phase === 'carry' ? 'carry' : 'fly';
            pick.frame = commander.phase === 'tell' ? Math.min(5, Math.floor(age / 30 * 6)) : commander.phase === 'active' ? Math.min(3, Math.floor(age / CARRIER_SWOOP * 4)) : Math.floor(age / 5) % 6;
          }
        }
      }
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
      if (type === DOMINION || ents.state[i] === ST_FALLING) debugState.dominion.rendered.push({ slot, type, z, floor: this.floorAt(x, y) });
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
    for (let i = 0; i < proj.count; i++) {
      const k = proj.kind[i];
      const slot = proj.slot[i];
      seen.add(slot);
      let x = proj.x[i];
      let y = proj.y[i];
      let z = proj.z[i];
      // The local player's own censers are drawn from their local flight instead (netcode stage 4).
      if (k === PROJ_CENSER && proj.owner[i] === this.localId && this.ownCensers.hides(slot, now)) continue;
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
    this.ownCensers.drawn(now, (x, y, z) => bb.add(this.frames[PROJECTILE_SPRITES[PROJ_CENSER]], x, y, z, PROJECTILE_SIZES[PROJ_CENSER], true, 1, 1, 1, NO_GLOW));
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

  dispose(): void {
    this.disposed = true;
    window.__heavenfallTeleport = undefined;
    window.__heavenfallLook = undefined;
    cancelAnimationFrame(this.raf);
    document.removeEventListener('pointerlockchange', this.onPointerLockChange);
    document.removeEventListener('visibilitychange', this.onVisibility);
    if (document.pointerLockElement) document.exitPointerLock();
    this.input.dispose();
    this.overlay.dispose();
    this.pause.dispose();
    this.overlayView?.view.el.remove();
    this.overlayView = null;
    document.removeEventListener('keydown', this.overlayKey, true);
    this.talents.dispose();
    this.party?.dispose();
    this.sounds.dispose();
    this.pool?.dispose();
    this.incense.dispose();
    this.pickups.dispose();
    this.props.dispose();
    this.dominionView.dispose();
    this.commanderView.dispose();
    this.watchmanView.dispose();
    this.gatekeeperView.dispose();
    this.rewardShafts.dispose();
    this.spawnView.dispose();
    this.hazards.dispose();
    this.hum?.stop();
    this.hud.dispose();
    this.mapView.dispose();
    this.shop.dispose();
    this.itemView.dispose();
    this.relicView.dispose();
    this.routeView.dispose();
    this.bench?.dispose();
    this.scene.dispose();
    this.o.root.replaceChildren();
  }
}
