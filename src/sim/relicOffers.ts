/**
 * Personal relic offers (rogue game.md §6.5, §8.3, §9.6; items-relics.md §2.1): the Reliquary chest's
 * free offer and the Advocate's paid bargain. Each offer shows two unowned chest relics (one if only one
 * is left), drawn once from a stable per-offer generator and never rerolled: card 1 weighted 60/30/10
 * among relics presently usable by the kit and party (all unowned ones if none is), card 2 from the
 * rest. Shown ids are reserved against the player's other pending offer until it settles. With no
 * unowned chest relic left the chest offers a Rite instead; if the only unowned ids are reserved by the
 * other offer, nothing is drawn and the player is asked to finish that offer first.
 */
import { fmix32 } from '../gen/hash';
import { CHEST_RELICS, RARITY_WEIGHT, RELICS, type RelicId } from '../data/relics';
import type { RelicOfferState } from '../net/messages';
import { relicDormancy } from './relicUse';
import { mulberry32 } from './rng';
import type { InteractionResult } from './shop';
import type { Simulation, SimPlayer } from './sim';

export interface RelicOffer { offerId: number; source: 'chest' | 'bargain'; cards: RelicId[] }

/** Weighted draw of one id; `random` in [0, 1). */
function weighted(ids: readonly RelicId[], random: () => number): RelicId {
  const total = ids.reduce((n, id) => n + RARITY_WEIGHT[RELICS[id].rarity], 0);
  let roll = random() * total;
  for (const id of ids) { roll -= RARITY_WEIGHT[RELICS[id].rarity]; if (roll < 0) return id; }
  return ids[ids.length - 1];
}

/** The two cards (§2.1): card 1 from the usable ids if any, card 2 from the remaining ids. */
export function drawRelics(unowned: readonly RelicId[], usable: ReadonlySet<RelicId>, random: () => number): RelicId[] {
  if (!unowned.length) return [];
  const pool1 = unowned.filter((id) => usable.has(id));
  const first = weighted(pool1.length ? pool1 : unowned, random);
  const rest = unowned.filter((id) => id !== first);
  return rest.length ? [first, weighted(rest, random)] : [first];
}

export class RelicOffers {
  /** Pending offers by offer key (the profile), kept through reconnect. */
  private readonly pending = new Map<string, RelicOffer[]>();

  constructor(private readonly sim: Simulation) {}

  offers(p: SimPlayer): RelicOffer[] {
    return this.pending.get(p.offerKey) ?? [];
  }

  /** Chest ids this player neither owns, has pawned, nor holds on another pending offer. */
  private available(p: SimPlayer, except?: RelicOffer): { free: RelicId[]; unowned: RelicId[] } {
    const owned = new Set([...p.ownedRelics, ...p.pawnedRelics]);
    const unowned = CHEST_RELICS.filter((id) => !owned.has(id));
    const reserved = new Set(this.offers(p).filter((o) => o !== except).flatMap((o) => o.cards));
    return { free: unowned.filter((id) => !reserved.has(id)), unowned };
  }

  /**
   * Creates a relic offer. Returns `exhausted` when no chest relic is left unowned (the caller's Rite
   * fallback), `reserved` when the only unowned ids wait on another offer, or the new offer.
   */
  create(p: SimPlayer, source: RelicOffer['source']): RelicOffer | 'exhausted' | 'reserved' {
    const { free, unowned } = this.available(p);
    if (!unowned.length) return 'exhausted';
    if (!free.length) return 'reserved';
    const kit = p.kit, ctx = this.sim.rites.context(p);
    const usable = new Set(free.filter((id) => relicDormancy(id, kit, ctx) === null));
    const offerId = this.sim.rites.newOfferId();
    const cards = drawRelics(free, usable, mulberry32(fmix32((this.sim.seed ^ offerId ^ this.sim.rites.playerKey(p) ^ 0x5e1ec7) >>> 0)));
    const offer: RelicOffer = { offerId, source, cards };
    const list = this.offers(p);
    list.push(offer);
    this.pending.set(p.offerKey, list);
    return offer;
  }

  find(p: SimPlayer, offerId: number): RelicOffer | undefined {
    return this.offers(p).find((o) => o.offerId === offerId);
  }

  /** Settles an offer: its reservations are released. */
  settle(p: SimPlayer, offer: RelicOffer): void {
    const list = this.offers(p), i = list.indexOf(offer);
    if (i >= 0) list.splice(i, 1);
    if (!list.length) this.pending.delete(p.offerKey);
  }

  /** The player's pending relic offers, each card with its dormancy note now; `open` asks the client to show that one. */
  publish(p: SimPlayer, open = 0): void {
    const kit = p.kit, ctx = this.sim.rites.context(p);
    const offers: RelicOfferState[] = this.offers(p).map((o) => ({
      offerId: o.offerId, source: o.source, price: o.source === 'bargain' ? this.sim.bargain.price(p) : 0,
      cards: o.cards.map((id) => ({ id, note: relicDormancy(id, kit, ctx) })),
    }));
    this.sim.emit(p.id, { type: 'relicOffers', playerId: p.id, offers, open });
  }

  /** A chest card taken or passed (§6.5): ownership is saved at once; Pass settles with nothing. */
  chooseChest(p: SimPlayer, offer: RelicOffer, choice: string): InteractionResult {
    if (choice === 'pass') { this.settle(p, offer); this.sim.route.chestSettled(p); this.publish(p); return { accepted: true, reason: 'Passed: the chest stays closed to you this run' }; }
    if (!offer.cards.includes(choice as RelicId)) return { accepted: false, reason: 'Not on this offer' };
    const id = choice as RelicId;
    this.settle(p, offer);
    if (!p.ownedRelics.includes(id)) p.ownedRelics.push(id);
    if (!p.claimedRelics.includes(id)) p.claimedRelics.push(id);
    this.sim.route.chestSettled(p);
    this.publish(p);
    this.sim.relics.publish(p);
    this.sim.publishInventory(p);
    return { accepted: true, reason: `${RELICS[id].name} is yours · equip it with the Advocate` };
  }

  /** Victory closes every unaccepted bargain (§9.6); chest offers stay claimable. */
  closeBargains(): void {
    for (const [key, list] of this.pending) {
      const kept = list.filter((o) => o.source !== 'bargain');
      if (kept.length) this.pending.set(key, kept); else this.pending.delete(key);
    }
  }

  hasChest(p: SimPlayer): boolean {
    return this.offers(p).some((o) => o.source === 'chest');
  }
}
