/**
 * The floor's route objects (rogue game.md §6.5): St Peter's key and the Reliquary chest. The key lies
 * in a narrow gold beam at the center of the key room's reward square once that room clears; a living
 * human within 1 m takes it, and a holder who dies, leaves or disconnects drops it at their feet. The
 * chest descends at the Reliquary's reward square on its clear; the key holder opens it with F within
 * 2.5 m, using the key up, and then each human who fought the Reliquary's seal opens their own relic
 * offer there (or a Rite once their collection is complete), taking one card or passing.
 */
import { KEY } from '../data/pickups';
import type { BellState, RouteState } from '../net/messages';
import { PHASE_COMBAT } from '../net/protocol';
import { PLAYER_EYE } from './constants';
import { itemFloor } from './consumables';
import { lineOfSight } from './los';
import type { InteractionResult } from './shop';
import type { Simulation, SimPlayer } from './sim';

/** Interaction source ids on the wire, after the shop's 0–8 (shop.ts). */
export const SOURCE_CHEST = 20;
/** A Bell's source id is this plus its room index (§4.12). */
export const SOURCE_BELL_FIRST = 32;
/** F reach to the chest's lid and the Bell's rim (§6.5, §4.12). */
export const CHEST_REACH = 2.5;
/** The chest's lid, above its floor. */
export const CHEST_HEIGHT = 0.6;

export interface Spot { x: number; y: number; z: number; room: number }

/** The center of a room's 4 × 4 reward square on its floor, or the nearest legal floor within 2 m of it. */
export function squareCenter(sim: Simulation, room: number): Spot | null {
  const point = sim.map.rooms[room]?.points?.reward;
  if (!point) return null;
  const at = sim.relics.floorOrigin(point[0] + 2, point[1] + 2, room) ?? sim.relics.floorOrigin(point[0] + 0.5, point[1] + 0.5, room);
  return at ? { ...at, room } : null;
}

export class Route {
  /** The key's holder (player id), -1 while it lies on the floor or is gone; `keyUsed` once the chest opened. */
  keyHolder = -1;
  keyUsed = false;
  private keyDropped = false;
  chest: (Spot & { open: boolean }) | null = null;
  /** The humans in the Reliquary's seal, by offer key, and those whose chest entitlement has settled. */
  private readonly chestOwed = new Set<string>();
  /** The Bells of Judgment (§4.12), filled in by the Bell stage. */
  readonly bells: BellState[] = [];

  constructor(private readonly sim: Simulation) {}

  state(): RouteState {
    return { keyHolder: this.keyHolder, keyUsed: this.keyUsed, chest: this.chest ? { ...this.chest } : null, bells: this.bells.map((b) => ({ ...b })) };
  }

  private publish(): void {
    this.sim.emit('all', { type: 'route', state: this.state() });
  }

  /** A combat room cleared: the key appears in the key room, the chest in the Reliquary. */
  roomCleared(ai: number): void {
    const floor = this.sim.floor;
    if (!floor) return;
    if (ai === floor.keyRoom && !this.keyDropped) {
      const at = squareCenter(this.sim, ai);
      if (at && this.sim.pickups.drop(KEY, ai, at.x, at.y, this.sim.tick)) this.keyDropped = true;
    }
    if (ai === floor.reliquary && !this.chest) {
      const at = squareCenter(this.sim, ai);
      if (!at) return;
      this.chest = { ...at, open: false };
      for (const key of this.sim.rewards.recipients(ai)) this.chestOwed.add(key);
      this.publish();
    }
  }

  /** A human touched the key on the floor (bots never take it). */
  takeKey(p: SimPlayer): boolean {
    if (p.bot || p.dead || !p.connected || this.keyHolder >= 0 || this.keyUsed) return false;
    this.keyHolder = p.id;
    this.publish();
    return true;
  }

  /** The holder died, left or disconnected: the key falls on the nearest legal dry floor of their room. */
  playerGone(p: SimPlayer): void {
    if (this.keyHolder !== p.id) return;
    this.keyHolder = -1;
    const sim = this.sim;
    let room = sim.roomAt(p.x, p.y);
    let at = room >= 0 && room < sim.map.rooms.length ? sim.relics.floorOrigin(p.x, p.y, room) : null;
    if (at && sim.hazards.active[Math.floor(at.y) * sim.map.w + Math.floor(at.x)]) at = null;
    if (!at) {
      // No legal point there: the active room's (else the key room's) safe entry cell.
      room = sim.activeRoom !== 255 ? sim.activeRoom : sim.floor?.keyRoom ?? 0;
      const [c, r] = sim.map.rooms[room].entry[0].cells[0];
      const z = itemFloor(sim.map, c + 0.5, r + 0.5, room);
      at = { x: c + 0.5, y: r + 0.5, z: z ?? 0 };
    }
    sim.pickups.drop(KEY, room, at.x, at.y, sim.tick);
    this.publish();
  }

  /** Whether a player's eye reaches a point within `reach`, in sight and in its room. */
  inReach(p: SimPlayer, at: Spot, height: number, reach = CHEST_REACH): boolean {
    const sim = this.sim, ex = p.x, ey = p.y, ez = p.z + PLAYER_EYE, z = at.z + height;
    return sim.roomAt(p.x, p.y) === at.room && Math.hypot(at.x - ex, at.y - ey, z - ez) <= reach && lineOfSight(sim.map, ex, ey, ez, at.x, at.y, z);
  }

  /** F at the chest (§6.5): the key holder opens it; then each owed human opens their own offer. */
  interactChest(p: SimPlayer): InteractionResult {
    const sim = this.sim, chest = this.chest;
    if (!chest || !this.inReach(p, chest, CHEST_HEIGHT)) return { accepted: false, reason: 'Look at the Reliquary within 2.5 m' };
    if (sim.activePhase === PHASE_COMBAT) return { accepted: false, reason: 'Not while the doors are sealed' };
    if (!chest.open) {
      if (this.keyHolder !== p.id) return { accepted: false, reason: this.keyHolder >= 0 ? 'The key holder opens the Reliquary' : 'The Reliquary needs the key' };
      chest.open = true; this.keyUsed = true; this.keyHolder = -1;
      this.publish();
    }
    const offer = sim.relicOffers.offers(p).find((o) => o.source === 'chest');
    if (offer) { sim.relicOffers.publish(p, offer.offerId); return { accepted: true, reason: 'Choose a relic' }; }
    if (!this.chestOwed.has(p.offerKey)) return { accepted: true, reason: chest.open ? 'The Reliquary has nothing more for you' : 'The Reliquary is open' };
    const made = sim.relicOffers.create(p, 'chest');
    if (made === 'reserved') return { accepted: false, reason: 'Finish your other offer first' };
    if (made === 'exhausted') {
      // A complete chest collection: the chest offers a Rite instead (§9.10), settling this entitlement.
      this.chestOwed.delete(p.offerKey);
      sim.rites.grant(p, 'chest');
      return { accepted: true, reason: 'Every chest relic is yours · a Rite instead' };
    }
    sim.relicOffers.publish(p, made.offerId);
    return { accepted: true, reason: 'Choose a relic' };
  }

  /** The player's chest offer settled (taken or passed): no longer owed, no longer holding the exit. */
  chestSettled(p: SimPlayer): void {
    this.chestOwed.delete(p.offerKey);
  }

  /** Whether a connected human still has an earned, reachable chest entitlement: the exit waits (§11.6). */
  choicesPending(): boolean {
    const sim = this.sim;
    if (!this.chest) return false;
    const reachable = this.chest.open || this.keyHolder >= 0 || sim.pickups.live.some((q) => q.kind === KEY);
    return reachable && sim.players.some((p) => p.connected && !p.bot && (this.chestOwed.has(p.offerKey) || sim.relicOffers.hasChest(p)));
  }
}
