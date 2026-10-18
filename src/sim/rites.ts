/**
 * Rite offers (rogue game.md §9.10): a touched Rite page becomes one personal offer with fixed cards,
 * drawn from a stable per-offer generator, rechecked after every accepted build change and settled
 * once by a card or Pass. Rites live only in the host's run state; they vanish at the run's end.
 */
import { hasCatalog, MAX_RITES, RITE_FALLBACK_HALOS, talentNode, type EnemyState } from '../data/talents';
import { RITE_PAGE_HALOS } from '../data/pickups';
import { fmix32 } from '../gen/hash';
import type { RiteCard, RiteOffer } from '../net/messages';
import { PHASE_CLEARED, PHASE_COMBAT } from '../net/protocol';
import { ENEMIES, GATEKEEPER } from '../data/enemies';
import { checkRite, drawCards, eligibleRites, type SourceContext } from './build';
import { mulberry32 } from './rng';
import type { InteractionResult } from './shop';
import type { Simulation, SimPlayer } from './sim';

interface Offer { offerId: number; source: RiteOffer['source']; cards: string[] }

export class Rites {
  private nextOffer = 1;
  private nextOrdinal = 0;
  /** Each admitted profile's run-global admission ordinal, kept across reconnects (§9.10). */
  private readonly ordinals = new Map<string, number>();
  /** Pending offers by offer key (the profile), so a disconnected player keeps them for rejoin. */
  private readonly pending = new Map<string, Offer[]>();

  constructor(private readonly sim: Simulation) {}

  private playerKey(p: SimPlayer): number {
    let ordinal = this.ordinals.get(p.offerKey);
    if (ordinal === undefined) { ordinal = this.nextOrdinal++; this.ordinals.set(p.offerKey, ordinal); }
    return fmix32((this.sim.seed ^ Math.imul(ordinal + 1, 0x9e3779b1)) >>> 0);
  }

  /** What the party, the room and the player's carry can produce now (§9.9 "present source"). */
  context(p: SimPlayer): SourceContext {
    const sim = this.sim;
    const room = sim.roomAt(p.x, p.y);
    const areas = new Set<EnemyState>();
    for (const e of sim.items.records()) {
      if (e.room !== room || sim.tick < e.activatedTick || sim.tick >= e.endTick) continue;
      if (e.item === 'frost') areas.add('slowed');
      if (e.item === 'chain') areas.add('bound');
    }
    // R5 areas still supplying their states in this room: fire, the Well, frost, the Boundary, clouds.
    for (const a of sim.talents.areas.values()) {
      if (sim.roomAt(a.x, a.y) !== room || sim.tick >= a.endTick) continue;
      if (a.kind === 'well' || a.kind === 'frost' || a.kind === 'boundary' || a.kind === 'rain' || a.kind === 'furrow') areas.add('pooled');
      if (a.kind === 'frost') areas.add('slowed');
      if (a.kind === 'boundary') areas.add('bound');
      if (a.kind === 'cloud') areas.add('censed');
    }
    for (const f of sim.talents.fires.values()) if ([...f.cells.values()].some((c) => c.room === room)) areas.add('pooled');
    const hazard = sim.props.all.some((q) => q.family === 'blast') ||
      sim.map.rooms.some((_, i) => sim.rooms[i].phase !== PHASE_CLEARED && sim.hazards.hasRoom(i));
    // What the floor still holds: living enemies and the waves of rooms not yet cleared.
    let survivors = false, flyers = false;
    for (let k = 0; k < sim.activeCount; k++) {
      const t = sim.eType[sim.active[k]];
      if (t !== GATEKEEPER && !ENEMIES[t].flying && ENEMIES[t].hp > 60) survivors = true;
      if (ENEMIES[t].flying) flyers = true;
    }
    sim.map.rooms.forEach((r, i) => {
      if (sim.rooms[i].phase === PHASE_CLEARED) return;
      for (const w of r.waves) {
        if ((w.watchmen ?? 0) > 0 || (w.dominions ?? 0) > 0 || w.commander === 'cantor') survivors = true;
        if (w.cherubs > 0 || w.commander === 'carrier') flyers = true;
      }
      if (r.boss) flyers = true;
    });
    return {
      allies: sim.players.filter((o) => o !== p && sim.livingTargetable(o)).map((o) => ({ classId: o.classId, q: o.kit.q, e: o.kit.e, active: [...o.kit.active] })),
      items: p.inventory.flatMap((s) => (s ? [s.item] : [])),
      areas,
      hazard,
      survivors,
      flyers,
    };
  }

  /**
   * A Rite page touched (§6.4, §9.10): a class without a catalog yet (R5) gets the page's halos; a full
   * hand or no eligible node settles the six-halo fallback once; otherwise one offer opens.
   */
  grant(p: SimPlayer, source: RiteOffer['source']): void {
    const sim = this.sim;
    if (!hasCatalog(p.classId)) { p.wallet += RITE_PAGE_HALOS; sim.publishInventory(p); return; }
    const eligible = p.build.rites.length >= MAX_RITES ? [] : eligibleRites(p.classId, p.build, this.context(p));
    if (!eligible.length) {
      p.wallet += RITE_FALLBACK_HALOS;
      sim.publishInventory(p);
      sim.emit(p.id, { type: 'interactionResult', requestId: 0, accepted: true, reason: `No Rite to learn · ${RITE_FALLBACK_HALOS} halos` });
      return;
    }
    const offerId = this.nextOffer++;
    const cards = drawCards(eligible, mulberry32(fmix32((sim.seed ^ offerId ^ this.playerKey(p)) >>> 0)));
    const list = this.pending.get(p.offerKey) ?? [];
    list.push({ offerId, source, cards });
    this.pending.set(p.offerKey, list);
    this.publish(p, offerId);
  }

  /** The player's pending offers with each card rechecked now; `open` asks the client to show that one. */
  publish(p: SimPlayer, open = 0): void {
    const ctx = this.context(p);
    const offers: RiteOffer[] = (this.pending.get(p.offerKey) ?? []).map((o) => ({
      offerId: o.offerId, source: o.source,
      cards: o.cards.map((id): RiteCard => {
        const r = checkRite(p.classId, p.build, ctx, id);
        return r.ok ? { id, ok: true, reason: '', surrenders: r.surrenders, replaces: r.replaces, dormant: r.dormant }
          : { id, ok: false, reason: r.reason, surrenders: null, replaces: null, dormant: [] };
      }),
    }));
    this.sim.emit(p.id, { type: 'riteOffers', playerId: p.id, offers, rites: open });
  }

  /** Take a card or Pass (§9.10): in a valley or countdown, alive, rechecked in the same transaction. */
  choose(p: SimPlayer, offerId: number, choice: string): InteractionResult {
    const sim = this.sim;
    const list = this.pending.get(p.offerKey) ?? [];
    const offer = list.find((o) => o.offerId === offerId);
    if (!offer) return { accepted: false, reason: 'That offer is settled' };
    if (!p.connected || p.dead || sim.result) return { accepted: false, reason: 'Unavailable' };
    // A click arriving after the seal is refused without losing the offer.
    if (sim.activePhase === PHASE_COMBAT) return { accepted: false, reason: 'Choose after the fight' };
    const settle = () => { list.splice(list.indexOf(offer), 1); if (!list.length) this.pending.delete(p.offerKey); };
    if (choice === 'pass') { settle(); this.publish(p); return { accepted: true, reason: 'Passed: your kit stays as it is' }; }
    if (!offer.cards.includes(choice)) return { accepted: false, reason: 'Not on this offer' };
    // A free earned source resolved at the cap settles its fallback once (§9.10).
    if (p.build.rites.length >= MAX_RITES) {
      settle(); p.wallet += RITE_FALLBACK_HALOS; sim.publishInventory(p); this.publish(p);
      return { accepted: true, reason: `Four Rites already · ${RITE_FALLBACK_HALOS} halos` };
    }
    const r = checkRite(p.classId, p.build, this.context(p), choice);
    if (!r.ok) return { accepted: false, reason: r.reason };
    settle();
    sim.talents.setBuild(p, r.build);
    this.publish(p);
    return { accepted: true, reason: `Rite: ${talentNode(choice)!.name}` };
  }

  /** Dev key R: a Rite offer at once, as if a page was touched (never with saved progression). */
  dev(p: SimPlayer): void {
    if (this.sim.progressionEnabled || p.bot) return;
    this.grant(p, 'dev');
  }

  hasPending(p: SimPlayer): boolean {
    return (this.pending.get(p.offerKey)?.length ?? 0) > 0;
  }

  /** Whether a connected human still holds an unsettled offer: the exit waits for it (§11.6). */
  anyPending(): boolean {
    return this.sim.players.some((p) => p.connected && !p.bot && this.hasPending(p));
  }
}

