/** Stable wire kinds (rogue game.md §§6, 7, 14.12). Never reorder. */
export const COIN = 0, GOLD_HALO = 1, HEAL_MOTE = 2;
export const ITEM_FIRST = 3, ITEM_LAST = 10, STRUCTURAL_FIRST = 11, PICKUP_KIND_COUNT = 16;
export const PICKUP_CAP = 160, ORDINARY_PICKUP_CAP = 128, PENDING_PICKUP_CAP = 32;
export const ITEM_IDS = ['balm', 'seal', 'feather', 'mirror', 'venom', 'frost', 'chain', 'plume'] as const;
export const ITEM_WEIGHTS = [20, 12, 14, 8, 14, 12, 10, 10] as const;
export const PICKUP_NAMES = ['Coin', 'Gold halo', 'Heal mote', 'Balm of the Rejected', 'Wax Seal of Sanctuary',
  "Pilgrim's Feather", 'Mirror Ward', 'Bitter Water', 'Ash of Stillness', 'Chain Vial', 'Plume of Expulsion',
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
  /** -1 for items/structural sources that do not fade. */
  expiresTick: number;
}
