/** Stable wire kinds (rogue game.md §§6, 7, 14.12). Never reorder. */
export const COIN = 0, GOLD_HALO = 1, HEAL_MOTE = 2;
export const ITEM_FIRST = 3, ITEM_LAST = 10, STRUCTURAL_FIRST = 11, PICKUP_KIND_COUNT = 16;
/** The structural kinds R03 uses: the Chart (§5.4) and a clear reward's Rite page (§6.4). */
export const CHART = 13, RITE_PAGE = 15;
/** A gold halo from a commander, a coin from a loot prop (game.md §6.1). */
export const GOLD_HALO_VALUE = 6, PROP_COIN_VALUE = 3;
/**
 * A clear-reward gold halo and a Rite page's halos until R04 (audit batch 4: the door preview must
 * promise a reward worth a detour, about a quarter of one room's budget).
 */
export const REWARD_GOLD_VALUE = 24, RITE_PAGE_HALOS = 24;
export const PICKUP_CAP = 160, ORDINARY_PICKUP_CAP = 128, PENDING_PICKUP_CAP = 32;
/** Ticks before an uncollected coin, gold halo or heal mote fades (game.md §6.1). */
export const CURRENCY_LIFETIME = 600;
/**
 * Ticks before a random item drop (enemy death or broken amphora) fades. Without a fade, items left by
 * full inventories filled the 128-slot pool and later coins and motes were lost (audit A1). Earned
 * clear rewards keep no fade.
 */
export const DROPPED_ITEM_LIFETIME = 1800;
import { ITEM_IDS, ITEMS } from './items';
export { ITEM_IDS } from './items';
export const ITEM_WEIGHTS = ITEM_IDS.map(id => ITEMS[id].weight);
export const PICKUP_NAMES = ['Coin', 'Gold halo', 'Heal mote', 'Balm of the Rejected', 'Wax Seal of Sanctuary',
  "Pilgrim's Feather", 'Mirror Ward', 'Bitter Water', 'Ash of Stillness', 'Chain Jar', 'Plume of Expulsion',
  'Key', 'Reliquary', 'Chart', 'Bell', 'Rite page'] as const;

export function itemDrop(random: () => number): number {
  let roll = random() * 100;
  for (let i = 0; i < ITEM_WEIGHTS.length; i++) {
    roll -= ITEM_WEIGHTS[i];
    if (roll < 0) return ITEM_FIRST + i;
  }
  return ITEM_LAST;
}

/** Reliable metadata; volatile x/y in a complete snapshot drives the world projection. */
export interface PickupRecord {
  id: number;
  kind: number;
  room: number;
  x: number;
  y: number;
  value: number;
  /** -1 for clear rewards and structural sources that do not fade. */
  expiresTick: number;
}
