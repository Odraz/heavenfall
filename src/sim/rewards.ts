/**
 * What fights pay (rogue game.md §6, §9.1): halos, heal motes, item drops, XP, the clear reward and the
 * Chart. The simulation owns the enemies and calls in here when a room seals, an enemy spawns or dies,
 * a room clears, a loot prop breaks or a pickup is touched.
 */
import { ITEM_IDS } from '../data/items';
import { BLESSED, CHERUB, CHORISTER, GATEKEEPER, WATCHMAN, isCommander } from '../data/enemies';
import {
  CHART,
  COIN,
  DROPPED_ITEM_LIFETIME,
  GOLD_HALO,
  HEAL_MOTE,
  ITEM_FIRST,
  REWARD_GOLD_VALUE,
  RITE_PAGE,
  KEY,
  itemDrop,
  type PickupRecord,
} from '../data/pickups';
import { LOOT_ROLL } from '../data/props';
import { ENEMY_SLOTS } from './constants';
import { HaloLedger, HALO_WEIGHT, haloBudget, moteCap } from './economy';
import type { Prop } from './props';
import { scaleCount } from './party';
import type { Simulation, SimPlayer } from './sim';

/**
 * Every XP gain is multiplied by this (§9.1, 2026-10-16): the slice has one dungeon, so points come
 * half again as fast; a first full clear reaches about level 4–5.
 */
export const XP_GAIN = 1.5;
/** XP for clearing a combat room and for the Gatekeeper, paid to every connected human (§9.1). */
const ROOM_CLEAR_XP = 100;
const GATEKEEPER_XP = 1500;
/** A wave's XP by enemy group when its row doesn't list one: Blessed, Chorister, Cherub, commander, Watchman. */
const DEFAULT_GROUP_XP = [1, 6, 4, 60, 3];
/** A commander's gold halo is worth this much of the room budget (§6.1). */
const ELITE_GOLD_SHARE = 24;
/** Item drop chances by killer type (§6.3). */
const COMMANDER_ITEM_CHANCE = 0.5;
const BLESSED_ITEM_CHANCE = 0.02;
const RANGED_ITEM_CHANCE = 0.12;
/** A Chorister, Cherub or Watchman drops a heal mote this often (§6.2); commanders always drop two. */
const RANGED_MOTE_CHANCE = 0.35;
const COMMANDER_MOTES = 2;
/** A heal mote restores this share of max HP (§6.2). */
const MOTE_HEAL = 0.08;

/** An ordinary wave kill's item chance by type (§6.3): commanders 50%, Blessed 2%, ranged enemies (Watchmen too) 12%. */
export function itemDropChance(type: number): number {
  return isCommander(type) ? COMMANDER_ITEM_CHANCE : type === BLESSED ? BLESSED_ITEM_CHANCE : RANGED_ITEM_CHANCE;
}

/** A kill's heal-mote chance by type (§6.2): Choristers, Cherubs and Watchmen 35%; commanders drop theirs separately. */
export function moteDropChance(type: number): number {
  return type === CHORISTER || type === CHERUB || type === WATCHMAN ? RANGED_MOTE_CHANCE : 0;
}

export class Rewards {
  /** The Pardoner's Chart (§5.4): every room is known to the party. */
  chartRevealed = false;
  /** Halos collected this run; a human joining later starts with this wallet (§6.1). */
  halosCredited = 0;
  /** The XP each wave enemy pays on death, set when it spawns (§9.1). */
  readonly eXp = new Float64Array(ENEMY_SLOTS);
  /** 1 when this commander's death pays a gold halo out of its room's budget (§6.1). */
  readonly eGoldEntitled = new Uint8Array(ENEMY_SLOTS);
  /** The halo budget of each sealed combat room (§6.1). */
  readonly haloLedgers = new Map<number, HaloLedger>();
  /** Gold halos reserved for each wave's commanders, and how many of them have spawned, by room. */
  private readonly eliteGold = new Map<number, number[]>();
  private readonly elitePlaced = new Map<number, number[]>();
  /** Heal motes dropped per room, against its shape's cap (§6.2). */
  private readonly moteDrops = new Map<number, number>();
  /** The humans in each room when it sealed: who a Rite page from its clear pays (§6.4). */
  private readonly roomRecipients = new Map<number, Set<string>>();
  /** The humans each lying Rite page still owes, by pickup ID. */
  private readonly pageRecipients = new Map<number, Set<string>>();

  constructor(private readonly sim: Simulation) {}

  /** A room seals: record who fought in it and, for a combat room, fix its halo budget. */
  roomSealed(ai: number): void {
    const sim = this.sim;
    const humans = sim.players.filter((p) => p.connected && !p.bot);
    this.roomRecipients.set(ai, new Set(humans.map((p) => p.offerKey)));
    const room = sim.map.rooms[ai];
    if (room.kind !== 'combat' || !room.shape || !room.band) return;
    const party = sim.rooms[ai].partySize;
    const weight = room.waves.reduce((sum, w) => sum +
      HALO_WEIGHT[BLESSED] * scaleCount(w.blessed, party) +
      HALO_WEIGHT[CHORISTER] * scaleCount(w.choristers, party) +
      HALO_WEIGHT[CHERUB] * scaleCount(w.cherubs, party) +
      HALO_WEIGHT[WATCHMAN] * scaleCount(w.watchmen ?? 0, party), 0);
    const counts = room.waves.map((w) => scaleCount(w.dominions ?? 0, party));
    const budget = haloBudget(room.shape, room.band);
    // More commanders must not take the crowd's reward budget: reserve at most one quarter.
    const commanders = counts.reduce((sum, n) => sum + n, 0);
    const ledger = new HaloLedger(budget, weight, Math.min(commanders, Math.floor(budget / ELITE_GOLD_SHARE)));
    this.haloLedgers.set(ai, ledger);
    let gold = ledger.reservedElites;
    this.eliteGold.set(ai, counts.map((n) => {
      const granted = Math.min(gold, n);
      gold -= granted;
      return granted;
    }));
    this.elitePlaced.set(ai, counts.map(() => 0));
  }

  /** An enemy spawns: its XP share of the wave and, for a commander, whether it carries gold. */
  enemySpawned(slot: number, type: number, room: number, wave: number): void {
    this.eGoldEntitled[slot] = 0;
    this.eXp[slot] = 0;
    if (wave < 0) return;
    const row = this.sim.map.rooms[room].waves[wave];
    const party = this.sim.rooms[room].partySize;
    const group = isCommander(type) ? 3 : type === WATCHMAN ? 4 : type;
    const counts = [row.blessed, row.choristers, row.cherubs, row.dominions ?? 0, row.watchmen ?? 0];
    const count = scaleCount(counts[group] ?? 0, party);
    if (count > 0) this.eXp[slot] = (row.xp?.[group] ?? counts[group] * DEFAULT_GROUP_XP[group]) / count;
    if (!isCommander(type)) return;
    const placed = this.elitePlaced.get(room);
    if (placed) this.eGoldEntitled[slot] = placed[wave]++ < (this.eliteGold.get(room)?.[wave] ?? 0) ? 1 : 0;
  }

  /** An enemy died of accepted damage: its XP and drops. Recovery and dev removal never come here. */
  enemyKilled(slot: number): void {
    this.settleXp(slot);
    this.enemyDrops(slot);
  }

  /** Pays an enemy's XP once, also when recovery removes an unreachable one (§9.1). */
  settleXp(slot: number): void {
    const sim = this.sim;
    if (sim.eType[slot] === GATEKEEPER) this.awardXp(GATEKEEPER_XP);
    else if (this.eXp[slot] > 0) {
      this.awardXp(this.eXp[slot]);
      this.eXp[slot] = 0;
    } else if (sim.leashed[slot] && sim.eType[slot] === BLESSED) this.awardXp(1);
  }

  private enemyDrops(slot: number): void {
    const sim = this.sim;
    const room = sim.eRoom[slot];
    const type = sim.eType[slot];
    if (!sim.map.rooms[room]?.shape || type === GATEKEEPER || sim.leashed[slot]) return;
    const x = sim.eX[slot];
    const y = sim.eY[slot];
    if (sim.eWave[slot] >= 0) {
      const coins = this.haloLedgers.get(room)?.death(HALO_WEIGHT[type] ?? 0) ?? 0;
      for (let i = 0; i < coins; i++) sim.pickups.drop(COIN, room, x, y, sim.tick, 1);
      if (isCommander(type)) {
        if (this.eGoldEntitled[slot]) sim.pickups.drop(GOLD_HALO, room, x, y, sim.tick);
        this.eGoldEntitled[slot] = 0;
        for (let i = 0; i < COMMANDER_MOTES; i++) this.dropMote(room, x, y);
      }
      // Reward ordinary wave kills too; cleanup, leashed enemies and boss adds never roll items.
      if (sim.random() < itemDropChance(type)) this.dropItem(room, x, y);
    }
    // Only the types that can drop a mote draw a random number for it, as before.
    const mote = moteDropChance(type);
    if (mote > 0 && sim.random() < mote) this.dropMote(room, x, y);
  }

  /** A random item drop fades after DROPPED_ITEM_LIFETIME (audit A1); clear rewards don't. */
  private dropItem(room: number, x: number, y: number): void {
    const sim = this.sim;
    sim.pickups.drop(itemDrop(sim.random), room, x, y, sim.tick, 0, DROPPED_ITEM_LIFETIME);
  }

  private dropMote(room: number, x: number, y: number): void {
    const count = this.moteDrops.get(room) ?? 0;
    if (count >= moteCap(this.sim.map.rooms[room]?.shape)) return;
    this.moteDrops.set(room, count + 1);
    this.sim.pickups.drop(HEAL_MOTE, room, x, y, this.sim.tick);
  }

  /** A loot prop broke (§4.9): the marked one holds the Chart, the rest roll the room's odds. */
  propLoot(p: Prop): void {
    const sim = this.sim;
    if (p.marked) {
      // Hand-authored fixtures have no Chart; their marked prop keeps the gold halo.
      sim.pickups.drop(sim.floor ? CHART : GOLD_HALO, p.room, p.x, p.y, sim.tick);
      return;
    }
    const odds = ['combat', 'boss'].includes(sim.map.rooms[p.room].kind) ? LOOT_ROLL.combat : LOOT_ROLL.other;
    const roll = sim.random();
    if (roll >= odds.nothing && roll < odds.coin) sim.pickups.drop(COIN, p.room, p.x, p.y, sim.tick);
    else if (roll >= odds.coin && roll < odds.mote) sim.pickups.drop(HEAL_MOTE, p.room, p.x, p.y, sim.tick);
    else if (roll >= odds.mote) this.dropItem(p.room, p.x, p.y);
  }

  /**
   * A player touched a pickup. Halos go to every connected human's wallet (§6.1); motes heal the
   * toucher (§6.2); items need a free slot (§7.3); a Rite page pays each human it owes once (§6.4).
   * Returns whether the pickup is used up.
   */
  collect(drop: PickupRecord, p: SimPlayer): boolean {
    const sim = this.sim;
    if (drop.kind === COIN || drop.kind === GOLD_HALO) {
      this.halosCredited += drop.value;
      for (const human of sim.players) if (human.connected && !human.bot) human.wallet += drop.value;
      // A world halo pickup is its human collector's relic event, never a bot's (items-relics.md §2.4 rule 9).
      if (!p.bot) sim.relics.pickup(p, 'halo');
    } else if (drop.kind === HEAL_MOTE) {
      p.hp = Math.min(p.maxHp, p.hp + p.maxHp * MOTE_HEAL);
      if (p.classId === 'heretic') sim.talents.heretic.motePicked(p);
      if (!p.bot) sim.relics.pickup(p, 'mote');
    }
    else if (drop.kind >= ITEM_FIRST && drop.kind < ITEM_FIRST + ITEM_IDS.length && !p.bot) {
      const item = ITEM_IDS[drop.kind - ITEM_FIRST];
      if (!sim.items.pickup(p, item)) return false;
      sim.publishInventory(p);
    } else if (drop.kind === CHART && !p.bot) {
      this.revealChart();
    } else if (drop.kind === KEY) {
      if (!sim.route.takeKey(p)) return false;
    } else if (drop.kind === RITE_PAGE && !p.bot) {
      const recipients = this.pageRecipients.get(drop.id);
      if (!recipients?.delete(p.offerKey)) return false;
      // The page becomes this player's own Rite offer (§9.10).
      sim.rites.grant(p, 'clear');
      // A page stays while it still owes other humans their personal share.
      if (recipients.size) return false;
      this.pageRecipients.delete(drop.id);
    } else return false;
    sim.emit('all', { type: 'pickupCollected', id: drop.id, kind: drop.kind, playerId: p.id, x: drop.x, y: drop.y, z: sim.pickups.floor(drop.x, drop.y) });
    return true;
  }

  /** XP goes to every connected human, summed with compensation so fractional shares don't drift. */
  awardXp(amount: number): void {
    amount *= XP_GAIN;
    for (const p of this.sim.players) {
      if (!p.connected || p.bot) continue;
      const adjusted = amount - p.xpCorrection;
      const sum = p.runXp + adjusted;
      p.xpCorrection = (sum - p.runXp) - adjusted;
      p.runXp = sum;
    }
  }

  /** A combat room cleared: its XP and its clear reward on the reward point (§6.4). */
  roomCleared(ai: number): void {
    this.awardXp(ROOM_CLEAR_XP);
    const sim = this.sim;
    const reward = sim.floor?.rewards[ai];
    const point = sim.map.rooms[ai].points?.reward;
    if (!reward || !point || reward.kind === 'nothing') return;
    const kind = reward.kind === 'gold' ? GOLD_HALO : reward.kind === 'item' ? ITEM_FIRST + ITEM_IDS.indexOf(reward.item) : RITE_PAGE;
    const value = reward.kind === 'gold' ? REWARD_GOLD_VALUE : 0;
    const drop = sim.pickups.drop(kind, ai, point[0] + 0.5, point[1] + 0.5, sim.tick, value);
    if (reward.kind === 'rite' && drop) this.pageRecipients.set(drop.id, new Set(this.roomRecipients.get(ai) ?? []));
  }

  /** The Chart (§5.4): every room becomes at least seen, for the whole party. */
  revealChart(): void {
    if (this.chartRevealed) return;
    this.chartRevealed = true;
    const sim = this.sim;
    sim.rooms.forEach((r, i) => {
      r.knowledge = Math.max(1, r.knowledge);
      sim.roomState(i);
    });
    for (const other of sim.players) sim.publishInventory(other);
  }

  /** The humans (offer keys) in a room's latest seal. */
  recipients(ai: number): ReadonlySet<string> {
    return this.roomRecipients.get(ai) ?? new Set();
  }

  /** Whether a lying Rite page still owes a connected human: the exit waits for it (§11.6). */
  pagesPending(): boolean {
    const humans = this.sim.players.filter((p) => p.connected && !p.bot);
    return [...this.pageRecipients.values()].some((owed) => humans.some((p) => owed.has(p.offerKey)));
  }
}
