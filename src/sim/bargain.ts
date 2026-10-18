/**
 * The Advocate's bargain (rogue game.md §9.6): once per human per floor, a second relic for 30% of max
 * HP until the run ends. The offer is two unowned chest relics (one if only one is left), or a Rite once
 * the collection is complete; with neither a relic nor a legal Rite and a free Rite slot, no bargain is
 * offered. Viewing costs nothing. Accepting validates, charges the HP and grants the pawn (or the Rite)
 * in one transaction; declining closes the bargain for this floor. Victory closes every unaccepted
 * bargain. A pawned relic can be equipped at once and is saved to the profile only at the boss's death.
 */
import { CLASSES } from '../data/classes';
import { MAX_RITES } from '../data/talents';
import { RELICS, type RelicId } from '../data/relics';
import { PHASE_COMBAT } from '../net/protocol';
import type { RelicOffer } from './relicOffers';
import type { InteractionResult } from './shop';
import type { Simulation, SimPlayer } from './sim';

/** The price: this share of the class's max HP, rounded down, until the run ends. */
export const BARGAIN_SHARE = 0.3;

export class Bargain {
  /** Offer keys whose bargain is settled this floor (accepted or declined). */
  private readonly closed = new Set<string>();

  constructor(private readonly sim: Simulation) {}

  /** The HP price for this player's class. */
  price(p: SimPlayer): number {
    return Math.floor(CLASSES[p.classId].hp * BARGAIN_SHARE);
  }

  isClosed(p: SimPlayer): boolean {
    return this.closed.has(p.offerKey);
  }

  /** Whether the bargain can still be committed now: alive, at the Advocate, not sealed, before victory. */
  private refusal(p: SimPlayer): string | null {
    const sim = this.sim;
    if (!p.connected || p.dead || sim.result || p.bot) return 'Unavailable';
    if (sim.won) return 'The bargain closed when the Gatekeeper fell';
    if (sim.activePhase === PHASE_COMBAT) return 'Not while the doors are sealed';
    if (!sim.progressionEnabled ? false : !sim.advocateInReach(p)) return 'Speak to the Advocate in the Confessional';
    return null;
  }

  /** F at the Advocate's bargain card: shows the existing offer or draws it once (§9.6). */
  open(p: SimPlayer): InteractionResult {
    const sim = this.sim, why = this.refusal(p);
    if (why) return { accepted: false, reason: why };
    if (this.closed.has(p.offerKey)) return { accepted: false, reason: 'Your bargain for this floor is settled' };
    const relic = sim.relicOffers.offers(p).find((o) => o.source === 'bargain');
    if (relic) { sim.relicOffers.publish(p, relic.offerId); return { accepted: true, reason: 'The Advocate’s bargain' }; }
    const rite = sim.rites.offerOf(p, 'bargain');
    if (rite) { sim.rites.publish(p, rite); return { accepted: true, reason: 'The Advocate’s bargain' }; }
    const made = sim.relicOffers.create(p, 'bargain');
    if (made === 'reserved') return { accepted: false, reason: 'Finish your other offer first' };
    if (made === 'exhausted') {
      // Every chest relic owned: a legal Rite with a free slot, or no bargain at all (never halos for HP).
      const offerId = p.build.rites.length < MAX_RITES ? sim.rites.openPaid(p, 'bargain') : 0;
      return offerId ? { accepted: true, reason: 'The Advocate offers a Rite' } : { accepted: false, reason: 'The Advocate has nothing left to sell you' };
    }
    sim.relicOffers.publish(p, made.offerId);
    return { accepted: true, reason: 'The Advocate’s bargain' };
  }

  /** Charges the price once: max HP falls by 30% of the class's, current HP is capped at the new max. */
  private pay(p: SimPlayer): void {
    p.bargainCut = this.price(p);
    p.maxHp = CLASSES[p.classId].hp - p.bargainCut;
    p.hp = Math.min(p.hp, p.maxHp);
    this.closed.add(p.offerKey);
    this.sim.emit('all', { type: 'bargain', playerId: p.id, maxHp: p.maxHp, cut: p.bargainCut });
  }

  /** A relic card accepted (pawned) or the bargain declined (§9.6). */
  chooseRelic(p: SimPlayer, offer: RelicOffer, choice: string): InteractionResult {
    const sim = this.sim;
    if (choice === 'pass') {
      sim.relicOffers.settle(p, offer); this.closed.add(p.offerKey); sim.relicOffers.publish(p);
      return { accepted: true, reason: 'You refused the bargain' };
    }
    const why = this.refusal(p);
    if (why) return { accepted: false, reason: why };
    if (!offer.cards.includes(choice as RelicId)) return { accepted: false, reason: 'Not on this offer' };
    const id = choice as RelicId;
    sim.relicOffers.settle(p, offer);
    this.pay(p);
    if (!p.pawnedRelics.includes(id)) p.pawnedRelics.push(id);
    sim.relicOffers.publish(p);
    sim.relics.publish(p);
    sim.publishInventory(p);
    return { accepted: true, reason: `${RELICS[id].name} is pawned to you · equip it now; it is yours if you win` };
  }

  /** A Rite card accepted through the bargain: the HP price, then the node, checked by the caller first. */
  paidRite(p: SimPlayer): string | null {
    const why = this.refusal(p);
    if (why) return why;
    this.pay(p);
    return null;
  }

  /** A declined Rite bargain closes it too. */
  declined(p: SimPlayer): void {
    this.closed.add(p.offerKey);
  }

  /** Whether this player's bargain is still open (for the Advocate's card). */
  available(p: SimPlayer): boolean {
    return !this.closed.has(p.offerKey) && !this.sim.won;
  }
}
