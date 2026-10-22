import type { CommanderCast } from '../data/commanders';
import type { WatchmanAim } from '../data/watchman';
/** `ctrl` messages and game events (§9.2). */
import type { ClassId } from '../data/classes';
import type { PickupRecord } from '../data/pickups';
import type { PropFamily } from '../data/rooms/types';
import type { DominionCast, DominionPhase } from '../data/dominion';
import type { SpawnWarning } from '../data/spawns';
import type { RunIdentity } from './version';
import type { Profile } from '../profile/model';
import type { Admission, ProgressState } from '../profile/lifecycle';
import type { Inventory } from '../data/items';
import type { ItemId } from '../data/items';
import type { ItemEffect } from '../sim/consumables';
import type { VictoryState } from '../sim/victory';

/** The host's choice, carried by both welcome and lobby. Fixed maps are development fixtures. */
export interface LobbyState {
  heaven: 1;
  fixture: string | null;
  players: LobbyPlayer[];
  /** The host's Edicts for the next run (game.md §2.5); clients see them in the Lobby. */
  edicts?: number[];
}

/** One R1 run: no progression or Edicts yet (rogue r01.md, R1.3). */
export interface RunConfig extends RunIdentity {
  heaven: 1;
  floor: 1;
  /** The run's Edicts (§2.5), fixed at `start`; the Sentence is their count. */
  edicts: number[];
  progressionEnabled: boolean;
  fixture: string | null;
}

/** Shared room checkpoint, sent after go and before live events (rogue r01.md, R1.5). */
export interface RoomSync {
  phase: number;
  knowledge: number;
  entrySocket: number;
  refills: number;
}
export interface FloorSync {
  victory?: VictoryState | null;
  itemEffects?: ItemEffect[];
  progressionEnabled?: boolean;
  inventories?: InventoryState[];
  type: 'floorSync';
  runId: string;
  tick: number;
  revision: number;
  rooms: RoomSync[];
  pickups?: PickupRecord[];
  brokenProps?: number[];
  propBlasts?: Array<{ id: number; impactTick: number }>;
  propRecharges?: Array<{ id: number; readyTick: number }>;
  dominionCasts?: DominionCast[];
  commanderCasts?: CommanderCast[];
  watchmanAims?: WatchmanAim[];
  spawnWarnings?: SpawnWarning[];
  kits?: KitState[];
  talentAreas?: TalentArea[];
  /** Every class floor fire still burning (R5): per owner, cell indices and end ticks. */
  fires?: FireState[];
  /** R6: live relic areas and projectiles, each player's equipped relics and cooldowns, and streaks. */
  relicAreas?: RelicAreaState[];
  relicShots?: RelicShotState[];
  relicStates?: Array<Extract<GameEvent, { type: 'relicState' }>>;
  route?: RouteState;
  edicts?: number[];
}

/** A relic floor area (items-relics.md §2.2): Usher's circle, the First Plea's rune or the Comb's rectangle. */
export interface RelicAreaState {
  id: number; playerId: number; effect: string; shape: 'circle' | 'rect';
  x: number; y: number; z: number; radius: number;
  /** The rectangle's attack heading (its long axis lies across it), length and width. */
  hx: number; hy: number; length: number; width: number;
  startTick: number; endTick: number;
}
/** A relic projectile as accepted: from its origin along a fixed direction at a fixed speed until its end. */
export interface RelicShotState {
  id: number; playerId: number; effect: string;
  x: number; y: number; z: number; dx: number; dy: number; dz: number; speed: number; width: number; startTick: number; endTick: number;
}

/** One owner's burning floor cells (classes-fallen.md "Hellfire", classes-heretic.md "Burning ground"). */
export interface FireState { playerId: number; cells: number[]; ends: number[] }

export interface InventoryState {

  playerId: number; inventory: Inventory; wallet: number; chart: boolean;
  /** R6: owned and pawned relics, max HP after the bargain, and whether the bargain is still open. */
  ownedRelics?: string[]; pawnedRelics?: string[]; maxHp?: number; bargainOpen?: boolean;
  nextRequestId: number; itemReadyTick: number; xp: number; runXp: number;
  featherUntil: number; sealUntil: number; itemsTried: ItemId[];
}

/** One player's resolved kit (rogue game.md §9.3, §14.7), sent to everyone on every accepted change. */
export interface KitState {
  playerId: number; q: string; e: string;
  learned: string[]; rites: string[]; active: string[]; dormant: string[];
  /** Learned augment, then the Rite suppressing it. */
  suppressed: Array<[string, string]>;
}
/** A Rite card as the host checked it now (§9.10): the reason when it is temporarily illegal. */
export interface RiteCard { id: string; ok: boolean; reason: string; surrenders: string | null; replaces: string | null; dormant: string[] }
/** A pending Rite offer: fixed card ids, rechecked after every accepted build change. */
export interface RiteOffer {
  offerId: number; source: 'clear' | 'bell' | 'chest' | 'bargain' | 'sundial' | 'dev'; cards: RiteCard[];
  /** The Sundial's selected card (it applies at a qualifying boss seal) and whether it is a pending halo fallback. */
  selected?: string | null; fallback?: boolean;
  /** The bargain's HP price, 0 for free offers. */
  price?: number;
}
/** A personal relic offer (game.md §6.5, §9.6): two unowned chest relics, each with its dormancy note now. */
export interface RelicOfferState { offerId: number; source: 'chest' | 'bargain'; price: number; cards: Array<{ id: string; note: string | null }> }
/** The floor's shared route state (§6.5): the key's holder, whether it opened the chest, and the chest. */
export interface RouteState {
  keyHolder: number; keyUsed: boolean;
  chest: { x: number; y: number; z: number; room: number; open: boolean } | null;
  /** The two Bells of Judgment (§4.12): hidden until their room clears, then available, pending (rung, in countdown) or spent. */
  bells: BellState[];
  /** The Sundial (§6.8): lit until `sundialTick` (run ticks) or the boss seal, then qualified or missed. */
  sundial: 'lit' | 'qualified' | 'missed'; sundialTick: number;
}
export interface BellState { room: number; x: number; y: number; z: number; state: 'hidden' | 'available' | 'pending' | 'spent' }
/** Talent effects for every client's VFX, bounded per root action. `pts` are x, y, z triples (pairs of them for arcs). */
export type TalentFxKind = 'frost' | 'spark' | 'clay' | 'nail' | 'sheep' | 'recoil' | 'split' | 'potter' | 'sicarius' | 'knownGround'
  | 'ranks' | 'kindle' | 'brand' | 'wormwood' | 'fireRing' | 'charge' | 'shove' | 'underfoot' | 'redIron' | 'wrath' | 'land' | 'crash'
  | 'exorcism' | 'fork' | 'lazarus' | 'harvest' | 'irons' | 'stake' | 'rally' | 'resurrect'
  | 'holds' | 'fall' | 'shatter' | 'voice' | 'hymn' | 'wind' | 'procession' | 'ring' | 'whirl' | 'whip' | 'tartarus' | 'castDown';
/**
 * A talent area: R4's coin, wire, trap and shadow; R5's Rain of Fire circle (x1 = radius), the Well
 * (x1 = radius), the Boundary Chain (x..z to x1..z1), a frost patch (x1 = radius), a Heretic cloud
 * (x1 = radius, y1 = wearer id or -1, z1 = 1 with Pillar of Cloud) or furrow (x..z to x1..z1), and Bread
 * of Angels' harvest ring (x1 = motes left).
 */
export interface TalentArea {
  id: number; kind: 'coin' | 'wire' | 'trap' | 'shadow' | 'rain' | 'well' | 'boundary' | 'frost' | 'cloud' | 'furrow' | 'bread'; playerId: number;
  x: number; y: number; z: number; x1: number; y1: number; z1: number; startTick: number; endTick: number;
}

export type GameEvent =
  | { type: 'kit'; kit: KitState }
  /** A relic area appeared or ended (R6). */
  | { type: 'relicArea'; area: RelicAreaState; end: boolean }
  /** A relic projectile left, or ended at (x, y, z). */
  | { type: 'relicShot'; shot: RelicShotState; end: boolean; x: number; y: number; z: number }
  /** A one-wave relic ring or burst, or Mercy's Wax closing (`slots`: the enemies it touched). */
  | { type: 'relicFx'; playerId: number; effect: string; kind: 'ring' | 'burst' | 'shield'; x: number; y: number; z: number; radius: number; slots: number[] }
  /** A player's equipped relics, active combo and each slot's cooldown end tick. */
  | { type: 'relicState'; playerId: number; relics: [string | null, string | null]; combo: string | null; ready: [number, number] }
  /** A kill streak crossed a tier (0–4), at most once per player per tick (game.md §10). */
  | { type: 'streak'; playerId: number; count: number; tier: number }
  | { type: 'streakEnd'; playerId: number; count: number }
  | { type: 'talentFx'; playerId: number; kind: TalentFxKind; pts: number[]; slots: number[] }
  /** A branch, glance or pass-through segment of a shot beyond its first line. */
  | { type: 'tracer'; playerId: number; silver: boolean; x: number; y: number; z: number; ex: number; ey: number; ez: number }
  /** A Judas Coin, Silver Wire, Blood Money coin or Way Back shadow appeared, or ended (`end`). */
  | { type: 'talentArea'; area: TalentArea; end: boolean; reason: string }
  /** Floor fire changed this tick: cells lit or refreshed until `ends`, or put out (an end at or before now). */
  | { type: 'fire'; playerId: number; cells: number[]; ends: number[] }
  /** Enemies launched (drawn in Falling Star's arc; they don't hold a wading player while in the air). */
  | { type: 'launched'; playerId: number; slots: number[] }
  /** An owner-only meter: Wrath of Dis's fill toward its eruption. */
  | { type: 'meter'; playerId: number; kind: 'wrath'; value: number; max: number }
  /** The Way Back's accepted return (to everyone): the path's ends and its duration. */
  | { type: 'wayBack'; playerId: number; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number; ms: number }
  /** Recoil's accepted envelope, to its owner: horizontal velocity in m/s for 0.15 s. */
  | { type: 'recoil'; playerId: number; vx: number; vy: number }
  /** One of Them hides or shows a player (everyone sees the silhouette). */
  | { type: 'hidden'; playerId: number; hidden: boolean }
  | { type: 'riteOffers'; playerId: number; offers: RiteOffer[]; rites: number }
  | { type: 'relicOffers'; playerId: number; offers: RelicOfferState[]; open: number }
  | { type: 'route'; state: RouteState }
  /** Pilgrim's Return (§5.5): a channel started (until `endTick`), was canceled, or arrived. */
  | { type: 'pilgrim'; playerId: number; phase: 'start' | 'cancel' | 'arrive'; room: number; endTick: number }
  /** The bargain was paid: that player's max HP for the rest of the run, and the cut. */
  | { type: 'bargain'; playerId: number; maxHp: number; cut: number }
  | { type: 'victoryState'; state: VictoryState }
  | { type: 'itemUsed'; actionId: number; playerId: number; item: ItemId; first: boolean; instance: ItemEffect | null; x: number; y: number; z: number }
  | { type: 'itemEffectActivated'; effect: ItemEffect }
  | { type: 'itemEffectEnded'; instanceId: number; reason: string }
  | { type: 'itemReflected'; playerId: number; projectile: number; x: number; y: number; z: number }
  | { type: 'inventory'; state: InventoryState }
  | { type: 'interactionResult'; requestId: number; accepted: boolean; reason: string }
  | { type: 'spawnWarning'; phase: 'start' | 'cancel'; warning: SpawnWarning }
  | { type: 'crest'; room: number; wave: number; total: number }
  | { type: 'dominionCast'; phase: DominionPhase; cast: DominionCast; x: number; y: number; z: number }
  | { type: 'propBroken'; id: number; family: PropFamily; x: number; y: number; z: number; marked: boolean; impactTick: number; readyTick: number; targets: number[] }
  | { type: 'propReady'; id: number; x: number; y: number; z: number }
  | { type: 'propBlast'; id: number; x: number; y: number; z: number }
  | { type: 'pickupState'; pickup: PickupRecord }
  | { type: 'pickupCollected'; id: number; kind: number; playerId: number; x: number; y: number; z: number }
  /**
   * `targets`: the player IDs the ability affected (M8 §10): every player Communion healed, including
   * at full HP; the player Martyr's Shroud shielded; the Falling Star ally. Empty for the others.
   */
  | { type: 'abilityUsed'; playerId: number; slot: 'Q' | 'E'; x: number; y: number; z: number; targets: number[]; /** Thrown Silver: the coins fly 0.5 s before the Field starts. */ thrown?: boolean }
  | { type: 'teleport'; teleportId: number; x: number; y: number; z: number; /** Horizontal launch velocity, m/s. */ launch?: { dx: number; dy: number }; carry?: boolean }
  | { type: 'playerDied'; playerId: number }
  | { type: 'playerRespawned'; playerId: number }
  /** Revived by the party at the soul's ground point (M8 §4.2). */
  | { type: 'playerRevived'; playerId: number }
  /** A Silver Bullet (M9 §2.4): from the eye to where the ray stopped. */
  | { type: 'silverBullet'; playerId: number; x: number; y: number; z: number; ex: number; ey: number; ez: number }
  /** Falling Star landed (M9 §3.2): the enemy slots it knocked back, which fly an arc on every client. */
  | { type: 'starLanded'; playerId: number; x: number; y: number; z: number; launched: number[] }
  /** Martyr's Shroud burst (M9 §3.3), where the shielded player stood. */
  | { type: 'shroudBurst'; playerId: number; x: number; y: number; z: number }
  /** Burst deaths this tick (M12 §4.1): `[slot, angle, playerId, …]`, the angle in degrees, + 360 if heavy. */
  | { type: 'bursts'; list: number[] }
  /**
   * Damage numbers (R06 follow-up §8), to the credited player only: this tick's accepted damage per enemy,
   * `DAMAGE_STRIDE` numbers each: slot, x, y, z (above the drawn head), amount, 1 if it killed.
   */
  | { type: 'damage'; hits: number[] }
  /** Felt hits (R06 follow-up §9 option 1), to the hurt player only: `HURT_STRIDE` numbers each: source x, y, amount, kind. */
  | { type: 'hurt'; hits: number[] }
  /** Shadowstep cut through its path (M12 §5.7): the path's first and last points. */
  | { type: 'dashCut'; playerId: number; x0: number; y0: number; z0: number; x1: number; y1: number; z1: number }
  /** A globe shattered (M12 follow-up §1.3): `by` is the player who shot it down, or −1 when it broke on its own. */
  | { type: 'globeShatter'; x: number; y: number; z: number; by: number }
  | { type: 'roomState'; room: number; phase: number; knowledge: number; entrySocket: number }
  | { type: 'bossCast'; phase: 'start' | 'interrupted' | 'completed' }
  /** `stats`: the players still connected at the end, by ID. */
  | { type: 'gameOver'; result: 'victory' | 'defeat'; timeMs: number; unclaimed?: boolean; stats: Record<number, PlayerStats>;
      /** The run's Sentence, and the streak crown: the human with the best streak (ties: the earlier to reach it), or -1. */
      sentence?: number; crown?: number };

/** One player's numbers on Results. */
export interface PlayerStats {
  runXp?: number; levelBefore?: number; levelAfter?: number;
  /** The run's Rites by name; they vanish with the run (§9.10). */
  rites?: string[];
  kills: number;
  /** Damage dealt to enemies, rounded. */
  damage: number;
  deaths: number;
  /** Revives the player helped with. */
  reviveAssists: number;
  /** The best kill streak of the run and the kills counted as assists (game.md §10). */
  bestStreak?: number;
  assists?: number;
  /** Deeds done in this won run (§8.6) and relics claimed or pawned, by id. */
  deeds?: string[];
  relics?: string[];
}

export interface LobbyPlayer {
  id: number;
  name: string;
  classId: ClassId | null;
  bot?: boolean;
  isHost: boolean;
  /** Still on Results after a game; the host's `Start` waits for them. */
  inResults: boolean;
}

export type RejectReason = 'bad_password' | 'full' | 'in_progress' | 'version' | 'load_timeout';

export type CtrlMessage =
  | { type: 'interact'; runId: string; requestId: number; sourceId: number }
  /** Take a Rite card or Pass (§9.10). */
  | { type: 'rite'; runId: string; requestId: number; offerId: number; choice: string | 'pass' }
  /** Take a relic card, or Pass (the chest) / decline (the bargain). */
  | { type: 'relicChoice'; runId: string; requestId: number; offerId: number; choice: string | 'pass' }
  /** Equip two relics at the Advocate (§9.6). */
  | { type: 'relics'; runId: string; requestId: number; relics: [string | null, string | null] }
  /** Pilgrim's Return: start to a cleared room, or cancel with -1 (§5.5). */
  | { type: 'pilgrimReturn'; runId: string; requestId: number; room: number }
  /** Open the Advocate's bargain or the Sundial's Rite offer. */
  | { type: 'advocateOffer'; runId: string; requestId: number; offer: 'bargain' | 'sundial' }
  /** A whole learned allocation and Q/E assignment from the Advocate's view (§9.5, §9.6). */
  | { type: 'advocate'; runId: string; requestId: number; talents: string[]; q: string; e: string }
  | FloorSync
  | { type: 'hello'; name: string; password: string; version: string; bot: boolean; profile?: Profile }
  | { type: 'loadout'; profile: Profile }
  | { type: 'admission'; admission: Admission }
  | { type: 'admissionReady'; runId: string; admissionId: number }
  | { type: 'admissionRejected'; runId: string; admissionId: number; reason: string }
  | { type: 'progress'; state: ProgressState }
  | { type: 'recover'; runId: string; profileId: string }
  | { type: 'recovery'; runId: string; state: ProgressState | null }
  /** `inProgress`: the game is running, so the client waits in the in-progress Lobby (M8 §6.2). */
  | { type: 'welcome'; playerId: number; lobby: LobbyState; inProgress: boolean }
  | { type: 'reject'; reason: RejectReason }
  | { type: 'pickClass'; classId: ClassId }
  /** The host sets the next run's Edicts in the Lobby (§2.5). */
  | { type: 'edicts'; edicts: number[] }
  /** Sent on every change, during the game too (M8 §6.2). */
  | ({ type: 'lobby' } & LobbyState)
  | ({ type: 'start'; players: Array<{ id: number; name: string; classId: ClassId; bot: boolean }> } & RunConfig)
  | { type: 'ready' }
  /** From the in-progress Lobby: the client enters the game (M8 §6.2). */
  | { type: 'enterGame' }
  /** From Results: the player is back in the Lobby. */
  | { type: 'backToLobby' }
  /** C→H with `text` only; H→all with the sender's `playerId` too (M8 §7). */
  | { type: 'chat'; text: string; playerId?: number }
  | { type: 'go' }
  | { type: 'event'; runId: string; tick: number; revision: number; event: GameEvent }
  /** `t`: the sender's performance.now(), echoed by a `pong` to measure the round trip. */
  | { type: 'ping'; t?: number }
  | { type: 'pong'; t: number }
  | { type: 'leave' };
