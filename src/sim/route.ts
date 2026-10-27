/**
 * The floor's route objects (rogue game.md §6.5): St Peter's key and the Reliquary chest. The key lies
 * in a narrow gold beam at the center of the key room's reward square once that room clears; a living
 * human within 1 m takes it, and a holder who dies, leaves or disconnects drops it at their feet. The
 * chest descends at the Reliquary's reward square on its clear; the key holder opens it with F within
 * 2.5 m, using the key up, and then each human who fought the Reliquary's seal opens their own relic
 * offer there (or a Rite once their collection is complete), taking one card or passing.
 */
import { KEY } from '../data/pickups';
import type { WaveDef } from '../data/dungeons/types';
import type { BellState, RouteState } from '../net/messages';
import { PHASE_CLEARED, PHASE_COMBAT } from '../net/protocol';
import { PLAYER_EYE, ROOM_NONE, TICK_HZ } from './constants';
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

/** Pilgrim's Return (§5.5): the channel's length, and how far the player may drift during it. */
export const RETURN_TICKS = Math.round(1.5 * TICK_HZ);
const RETURN_DRIFT = 0.3;

/** The Sundial goes dark at 14:00 of run time in the Pearly Gates (§6.8). */
export const SUNDIAL_TICKS = 14 * 60 * TICK_HZ;
/** A Bell hangs 3 m above the center of its room's reward square (§4.12). */
export const BELL_HEIGHT = 3;
/** The Judgment wave: this share of the room's budget in its last wave's mix, plus two elites at four players (three under Host). */
const BELL_SHARE = 0.4;
const BELL_ELITES = 2;
const ELITE_XP = 60;

/**
 * The Bell's one Judgment wave (§4.12): 40% of the room's whole TP budget, using only its last wave's
 * mix and ignoring its own elites, plus two external Dominions (counts at four players, scaled as any
 * wave). Its XP ledger is that 40% plus 60 per elite: 0.4 × budget + 120.
 */
export function judgmentWave(waves: readonly WaveDef[], host = false): WaveDef {
  const groups = (w: WaveDef) => [w.xp?.[0] ?? w.blessed, w.xp?.[1] ?? w.choristers * 6, w.xp?.[2] ?? w.cherubs * 4, 0, w.xp?.[4] ?? (w.watchmen ?? 0) * 3];
  const budget = waves.reduce((n, w) => n + groups(w).reduce((a, b) => a + b, 0), 0);
  const last = waves[waves.length - 1];
  const mix = groups(last), mixTp = mix.reduce((a, b) => a + b, 0) || 1;
  const k = (BELL_SHARE * budget) / mixTp, elites = BELL_ELITES + (host ? 1 : 0);
  return {
    blessed: Math.round(last.blessed * k), choristers: Math.round(last.choristers * k), cherubs: Math.round(last.cherubs * k),
    watchmen: Math.round((last.watchmen ?? 0) * k), dominions: elites,
    xp: [mix[0] * k, mix[1] * k, mix[2] * k, ELITE_XP * elites, mix[4] * k],
  };
}

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
  /** The Bells of Judgment (§4.12): one per bell room, hidden until its ordinary clear. */
  readonly bells: BellState[] = [];
  /** The rung Bell's room while its countdown or wave runs, and its room's authored waves to restore. */
  private bellRoom = ROOM_NONE;
  private bellWaves: WaveDef[] | null = null;
  /** The Sundial (§6.8): lit until 14:00 or the boss seal; `qualified` when the boss sealed strictly before 14:00. */
  sundial: 'lit' | 'qualified' | 'missed' = 'lit';

  constructor(private readonly sim: Simulation) {}

  /** Once the simulation has its map and floor: the Bells' places, and the Sundial lit on a generated floor. */
  init(): void {
    const sim = this.sim, floor = sim.floor;
    if (!floor) { this.sundial = 'missed'; return; }
    for (const room of floor.bells) {
      if (room < 0) continue;
      const point = sim.map.rooms[room]?.points?.reward;
      if (!point) continue;
      const c = point[0] + 2, rr = point[1] + 2, z = sim.map.floor[Math.floor(rr) * sim.map.w + Math.floor(c)];
      this.bells.push({ room, x: c, y: rr, z: (Number.isFinite(z) ? z : 0) + BELL_HEIGHT, state: 'hidden' });
    }
  }

  state(): RouteState {
    return { keyHolder: this.keyHolder, keyUsed: this.keyUsed, chest: this.chest ? { ...this.chest } : null, bells: this.bells.map((b) => ({ ...b })),
      sundial: this.sundial, sundialTick: SUNDIAL_TICKS };
  }

  private publish(): void {
    this.sim.emit('all', { type: 'route', state: this.state() });
  }

  /** A combat room cleared: the key appears in the key room, the chest in the Reliquary, a Bell in a bell room. */
  roomCleared(ai: number): void {
    const floor = this.sim.floor;
    if (!floor) return;
    const bell = this.bells.find((b) => b.room === ai);
    if (bell?.state === 'hidden') { bell.state = 'available'; this.publish(); }
    if (ai === floor.keyRoom && !this.keyDropped) {
      const at = squareCenter(this.sim, ai);
      if (at && this.sim.pickups.drop(KEY, ai, at.x, at.y, this.sim.tick)) { this.keyDropped = true; this.publish(); }
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

  // ------------------------------------------------------------------ the Bells of Judgment (§4.12)

  /** F at a Bell: a living human within 2.5 m of its rim, in a valley, before victory; its countdown starts. */
  ringBell(p: SimPlayer, room: number): InteractionResult {
    const sim = this.sim, bell = this.bells.find((b) => b.room === room);
    if (!bell || bell.state !== 'available' || !this.inReach(p, bell, 0)) return { accepted: false, reason: 'Look at a Bell within 2.5 m' };
    if (sim.won) return { accepted: false, reason: 'The Bell is silent after the Gatekeeper fell' };
    if (sim.activeRoom !== ROOM_NONE) return { accepted: false, reason: 'Ring it when no fight is on' };
    bell.state = 'pending';
    this.bellRoom = room;
    sim.ringBell(room);
    this.publish();
    return { accepted: true, reason: 'The Bell tolls: one Judgment wave comes' };
  }

  /** The rung room's waves while its Bell fight runs (startRoom swaps them in); null otherwise. */
  bellFight(ai: number): boolean {
    return this.bellRoom === ai;
  }

  /** The Bell's countdown sealed: the Bell is spent, its room fights the one Judgment wave. */
  bellSealed(ai: number): void {
    const bell = this.bells.find((b) => b.room === ai);
    if (!bell) return;
    bell.state = 'spent';
    const room = this.sim.map.rooms[ai];
    this.bellWaves = room.waves;
    room.waves = [judgmentWave(this.bellWaves, this.sim.edicts.includes(1))];
    this.publish();
  }

  /** The Bell's countdown was abandoned before sealing: it can be rung again. */
  bellCanceled(ai: number): boolean {
    if (this.bellRoom !== ai) return false;
    const bell = this.bells.find((b) => b.room === ai);
    if (bell?.state === 'pending') bell.state = 'available';
    this.bellRoom = ROOM_NONE;
    this.publish();
    return true;
  }

  /** The Judgment wave is cleared: the room's own waves come back; its Rite pages are the caller's. */
  bellCleared(ai: number): void {
    if (this.bellWaves) this.sim.map.rooms[ai].waves = this.bellWaves;
    this.bellWaves = null;
    this.bellRoom = ROOM_NONE;
  }

  // ------------------------------------------------------------------ Pilgrim's Return (§5.5)

  /** Rooms a player may return to: cleared rooms (non-combat rooms once visited, the boss room after victory), not their own. */
  returnable(p: SimPlayer, room: number): boolean {
    const sim = this.sim, def = sim.map.rooms[room];
    if (!def || room === sim.roomAt(p.x, p.y) || sim.rooms[room].phase !== PHASE_CLEARED) return false;
    return !def.boss || sim.won;
  }

  /** LMB on a cleared room with M held (§5.5): a living player in a valley starts the 1.5 s channel. */
  startReturn(p: SimPlayer, room: number): InteractionResult {
    const sim = this.sim;
    if (p.bot || !p.connected || p.dead || sim.result) return { accepted: false, reason: 'Unavailable' };
    if (!sim.floor) return { accepted: false, reason: 'No map in the fixture' };
    if (sim.activeRoom !== ROOM_NONE) return { accepted: false, reason: 'No return while a fight is on' };
    if (!Number.isInteger(room) || !this.returnable(p, room)) return { accepted: false, reason: 'Choose another cleared room' };
    if (sim.commanders.carriedBy(p.id)) return { accepted: false, reason: 'Unavailable' };
    p.pilgrim = { room, startTick: sim.tick, x: p.x, y: p.y };
    sim.emit('all', { type: 'pilgrim', playerId: p.id, phase: 'start', room, endTick: sim.tick + RETURN_TICKS });
    return { accepted: true, reason: `Returning to ${sim.map.rooms[room].name}…` };
  }

  /** Cancels a channel (release of M, a move, damage, a countdown anywhere, death). */
  cancelReturn(p: SimPlayer, reason: string): void {
    if (!p.pilgrim) return;
    const room = p.pilgrim.room;
    p.pilgrim = null;
    this.sim.emit('all', { type: 'pilgrim', playerId: p.id, phase: 'cancel', room, endTick: this.sim.tick });
    if (p.connected) this.sim.emit(p.id, { type: 'interactionResult', requestId: 0, accepted: false, reason });
  }

  /** Each tick: channels break or arrive on the target's lowest-numbered socket, the player's own cell. */
  updateReturns(): void {
    const sim = this.sim;
    for (const p of sim.players) {
      const c = p.pilgrim;
      if (!c) continue;
      if (!p.connected || p.dead) { this.cancelReturn(p, 'Return broken'); continue; }
      if (sim.activeRoom !== ROOM_NONE) { this.cancelReturn(p, 'Return broken: a fight began'); continue; }
      if (!p.mapHeld) { this.cancelReturn(p, 'Return canceled'); continue; }
      if (Math.hypot(p.x - c.x, p.y - c.y) > RETURN_DRIFT) { this.cancelReturn(p, 'Return broken: you moved'); continue; }
      if (p.lastHurtTick > c.startTick) { this.cancelReturn(p, 'Return broken: you were hurt'); continue; }
      if (!this.returnable(p, c.room)) { this.cancelReturn(p, 'Return broken'); continue; }
      if (sim.tick - c.startTick < RETURN_TICKS) continue;
      const def = sim.map.rooms[c.room];
      const entry = [...def.entry].sort((a, b) => a.socket - b.socket)[0];
      const [cx, cy] = entry.cells[p.index] ?? entry.cells[0];
      p.pilgrim = null;
      sim.teleport(p, cx + 0.5, cy + 0.5, sim.map.floor[cy * sim.map.w + cx]);
      sim.emit('all', { type: 'pilgrim', playerId: p.id, phase: 'arrive', room: c.room, endTick: sim.tick });
    }
  }

  // ------------------------------------------------------------------ the Sundial (§6.8)

  /** Each tick: at 14:00 a still-lit Sundial goes dark and its pending offers disappear. */
  update(): void {
    if (this.sundial === 'lit' && this.sim.tick >= SUNDIAL_TICKS) {
      this.sundial = 'missed';
      this.sim.rites.resolveSundial(false, this.records());
      this.publish();
    }
  }

  /** The boss room sealed: strictly before 14:00 it qualifies every admitted record (§6.8, §8.6). */
  bossSealed(): void {
    if (this.sundial !== 'lit') return;
    const qualified = this.sim.tick < SUNDIAL_TICKS;
    this.sundial = qualified ? 'qualified' : 'missed';
    for (const p of this.records()) if (qualified && !p.bot) p.sundialQualified = true;
    this.sim.rites.resolveSundial(qualified, this.records());
    this.publish();
  }

  private records(): SimPlayer[] {
    return [...this.sim.players, ...[...this.sim.retainedPlayers.values()].map((r) => r.player)];
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
