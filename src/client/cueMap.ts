/**
 * Which sound each accepted game event plays (rogue asset-coverage.md, R8): one event, one cue family.
 * Pure data and a rate limiter, so the mapping is checked by tests and a new event type or talent
 * effect fails the typecheck until it is mapped or declared silent.
 */
import type { SfxName } from '../audio/sfx';
import type { ItemId } from '../data/items';
import type { GameEvent, TalentFxKind } from '../net/messages';

/**
 * Every game event's cue families, or why it is silent. `GameSounds` and `GameView` play them; this
 * table is the coverage map in code (asset-coverage.md's event table follows it).
 */
export const EVENT_CUES: Record<GameEvent['type'], readonly SfxName[] | string> = {
  abilityUsed: ['blasphemy', 'communion', 'shroud', 'chains', 'discord', 'fieldOfBlood', 'shadowstep', 'fallingStarLeap', 'castOut', 'gatebreakerStart', 'rainOfFireStart', 'trialByFireStart', 'cloudOfWitnessesStart', 'wellOfGiantsStart', 'ringOfGiants', 'boundaryChain', 'chaliceHeal'],
  bargain: ['bargainAccept'],
  bossCast: ['judgmentCharge', 'judgmentBlast', 'interrupted', 'tollTell', 'tollImpact'],
  bossPhase: ['bossTransition', 'bossDefeat'],
  bursts: ['burstPop', 'massKill'],
  called: ['callTell'],
  crest: ['crest'],
  damage: 'silent: hits sound from the own shot (hitTick) and the HP diff (hurt)',
  dashCut: ['daggerCut'],
  dominionCast: ['dominionSlam'],
  fire: ['state-fire'],
  gameOver: ['victory', 'defeat'],
  globeShatter: ['globeShatter'],
  hidden: 'silent: the eye mark shows it',
  hostDescend: ['hostDescend'],
  hurt: 'silent: the HP diff plays hurt once per snapshot',
  interactionResult: ['purchase', 'chartReveal', 'interactionReject'],
  inventory: ['relicClaim', 'levelUp'],
  itemEffectActivated: ['item-mirror-place', 'item-water-land', 'item-ash-land', 'item-chain-place', 'item-plume-land'],
  itemEffectEnded: 'silent: the area fades',
  itemReflected: ['item-mirror-return'],
  itemUsed: ['item-balm', 'item-seal', 'item-feather', 'item-throw'],
  judged: ['callReleased'],
  kit: ['riteTaken'],
  launched: ['state-launch'],
  meter: 'silent: the meter bar shows it',
  pickupCollected: ['goldPickup', 'motePickup', 'keyPickup'],
  pickupState: 'silent: state sync',
  pilgrim: ['teleportStart', 'teleportArrive'],
  playerDied: ['death'],
  playerRespawned: ['revive'],
  playerRevived: ['revive'],
  propBlast: ['blastLampBurst'],
  propBroken: ['porcelainBreak', 'blastLampCrack', 'chaliceHeal'],
  propReady: 'silent: the prop reappears',
  recoil: 'silent: the shot already sounded',
  relicArea: ['relic-rune'],
  relicFx: ['relic-stamp', 'relic-chorus', 'relicRing', 'shieldUp', 'state-bind'],
  relicOffers: 'silent: the chest or page that offers it sounded',
  relicShot: ['relic-stamp', 'relic-wheel', 'relic-ember'],
  relicState: 'silent: equipped relics and cooldowns sync',
  riteOffers: ['riteOffer'],
  roomState: ['doorsSeal', 'refinerIgnite', 'arenaCleared', 'rewardArrive'],
  route: ['chestOpen', 'judgmentBell'],
  sealBroken: ['sealBreak'],
  shroudBurst: ['shroudBurst'],
  silverBullet: ['silverBullet'],
  spawnWarning: ['spawnWarning'],
  starLanded: ['fallingStarLand'],
  streak: ['streakTier'],
  streakEnd: 'silent: the counter fades',
  talentArea: ['judasCoinSpin', 'judasCoinSplit', 'silverWirePlace', 'wayBackMarker', 'fireOut'],
  talentFx: ['state-bind', 'state-launch', 'state-land', 'state-fire', 'revive', 'motePickup', 'porcelainBreak'],
  teleport: 'silent: the move that caused it sounds (Pilgrim, Call, Carrier)',
  tracer: 'silent: the shot already sounded',
  victoryState: 'silent: the exit beam and line show it',
  watcherBreak: ['watcherBreak'],
  watchersOpen: ['watcherOpen'],
  wayBack: ['wayBackReturn'],
};

/**
 * A talent effect's cue by its payload (asset-coverage.md *Talent payloads*): binds, launches,
 * landings, fire, revives and motes. `null`: it adds to a native attack, whose own sound plays.
 */
export const TALENT_FX_CUE: Record<TalentFxKind, SfxName | null> = {
  frost: null, spark: null, clay: 'porcelainBreak', nail: 'state-bind', sheep: 'state-launch', recoil: null, split: null,
  potter: 'state-bind', sicarius: null, knownGround: null,
  ranks: null, kindle: 'state-fire', brand: 'state-fire', wormwood: null, fireRing: 'state-fire', charge: 'state-fire',
  shove: null, underfoot: 'state-fire', redIron: 'state-fire', wrath: 'state-fire', land: 'state-land', crash: 'state-land',
  exorcism: null, fork: null, lazarus: 'revive', harvest: 'motePickup', irons: 'state-bind', stake: 'state-bind', rally: null, resurrect: 'revive',
  holds: 'state-bind', fall: 'state-bind', shatter: null, voice: null, hymn: null, wind: null, procession: 'state-bind', ring: null,
  whirl: null, whip: null, tartarus: null, castDown: 'state-land',
};

/** A used item's cue: self items their own, thrown items the throw. The placed Mirror sounds when it is placed. */
export const ITEM_USE_CUE: Record<ItemId, SfxName | null> = {
  balm: 'item-balm', seal: 'item-seal', feather: 'item-feather', mirror: null,
  venom: 'item-throw', frost: 'item-throw', chain: 'item-throw', plume: 'item-throw',
};

/** An item area's cue when it lands or is placed (never a second use sound). */
export const ITEM_LAND_CUE: Record<ItemId, SfxName | null> = {
  balm: null, seal: null, feather: null, mirror: 'item-mirror-place',
  venom: 'item-water-land', frost: 'item-ash-land', chain: 'item-chain-place', plume: 'item-plume-land',
};

/**
 * The alternatives' cast cue (R4–R5). The Betrayer's three sound from their areas (coin, wire,
 * shadow) and the Way Back; Bread of Angels has no S6 start and keeps the Chalice's heal.
 */
export const ALT_START_CUE: Record<string, SfxName> = {
  castOut: 'castOut', gatebreaker: 'gatebreakerStart', rainOfFire: 'rainOfFireStart', breadOfAngels: 'chaliceHeal',
  trialByFire: 'trialByFireStart', cloudOfWitnesses: 'cloudOfWitnessesStart', well: 'wellOfGiantsStart', ring: 'ringOfGiants', boundary: 'boundaryChain',
};

/** State and relic cues: at most one per family per 250 ms (4 per second), however many enemies one action reaches. */
export const CUE_LIMIT_MS = 250;

/** Admits at most one play per cue family per `CUE_LIMIT_MS`. */
export class CueLimiter {
  private readonly last = new Map<SfxName, number>();
  admit(name: SfxName, nowMs: number): boolean {
    if (nowMs - (this.last.get(name) ?? -Infinity) < CUE_LIMIT_MS) return false;
    this.last.set(name, nowMs);
    return true;
  }
}

/** Families the limiter applies to. */
export const LIMITED_CUES: ReadonlySet<SfxName> = new Set<SfxName>([
  'state-bind', 'state-launch', 'state-land', 'state-fire', 'fireOut', 'item-mirror-return',
  'relic-rune', 'relic-ember', 'relic-wheel', 'relic-stamp', 'relic-chorus', 'relicRing', 'shieldUp',
]);

/** The interaction an own request was for, so its result plays the right cue. */
export type InteractKind = 'buy' | 'chart' | 'other';

/** An own interaction result's cue: a refusal never sounds like a success; chest and Bell sound from their state change. */
export function interactionCue(accepted: boolean, kind: InteractKind | undefined): SfxName | null {
  if (!accepted) return 'interactionReject';
  return kind === 'buy' ? 'purchase' : kind === 'chart' ? 'chartReveal' : null;
}
