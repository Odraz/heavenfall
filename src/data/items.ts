/** Consumable catalog; array order is the stable pickup/input wire order. */
export const ITEM_IDS = ['balm', 'seal', 'feather', 'mirror', 'venom', 'frost', 'chain', 'plume'] as const;
export type ItemId = typeof ITEM_IDS[number];
export interface ItemDef {
  name: string; kind: 'instant' | 'self' | 'placed' | 'thrown'; cap: number;
  price: number; weight: number; duration: number; radius: number; rule: string;
}
/**
 * Effect strengths (audit batch 4: items felt weak). Balm heals a share of max HP so it matters for
 * every class; a Seal absorbs a full Dominion slam; Water kills a Blessed in one second; Plume kills
 * the Blessed it throws. Prices halved in the R06 follow-up (§3), when the pedestals stopped selling out.
 */
export const BALM_HEAL_FRACTION = 0.4, SEAL_SHIELD = 100, FEATHER_SPEED = 2, VENOM_DAMAGE = 10;
export const CHAIN_BIND_SECONDS = 2.5, PLUME_DAMAGE = 20, PLUME_THROW = 5, PLUME_LIFT = 8;
export const ITEMS: Record<ItemId, ItemDef> = {
  balm: { name: 'Balm of the Rejected', kind: 'instant', cap: 3, price: 50, weight: 20, duration: 0, radius: 0, rule: 'Heal yourself for 40% of your max HP.' },
  seal: { name: 'Wax Seal of Sanctuary', kind: 'self', cap: 2, price: 60, weight: 12, duration: 240, radius: 0, rule: 'Replace a weaker shield with 100 shield for 8 seconds.' },
  feather: { name: "Pilgrim’s Feather", kind: 'self', cap: 3, price: 60, weight: 14, duration: 360, radius: 0, rule: 'Move 2 m/s faster for 12 seconds.' },
  mirror: { name: 'Mirror Ward', kind: 'placed', cap: 2, price: 90, weight: 8, duration: 240, radius: 5, rule: 'Return hostile projectiles inside a 5 m dome for 8 seconds.' },
  venom: { name: 'Bitter Water', kind: 'thrown', cap: 3, price: 80, weight: 14, duration: 180, radius: 5, rule: 'Poison a 5 m pool: 10 damage every half second.' },
  frost: { name: 'Ash of Stillness', kind: 'thrown', cap: 3, price: 70, weight: 14, duration: 300, radius: 6, rule: 'Halve enemy movement inside a 6 m circle for 10 seconds.' },
  chain: { name: 'Chain Jar', kind: 'thrown', cap: 2, price: 80, weight: 10, duration: 180, radius: 5, rule: 'Bind each enemy once for 2.5 seconds in a 5 m circle.' },
  plume: { name: 'Plume of Expulsion', kind: 'thrown', cap: 2, price: 90, weight: 8, duration: 180, radius: 5, rule: 'Throw each unbound enemy once out of a 5 m circle for 20 damage.' },
};
export type ItemStack = { item: ItemId; count: number };
export type Inventory = [ItemStack | null, ItemStack | null];
export const emptyInventory = (): Inventory => [null, null];
export const copyInventory = (slots: Inventory): Inventory => slots.map(s => s && { ...s }) as Inventory;
export const isItemId = (id: unknown): id is ItemId => typeof id === 'string' && (ITEM_IDS as readonly string[]).includes(id);
/** Matching stacks first, then empty slots; the two same-type stacks are independent. */
export function storeItem(slots: Inventory, item: ItemId): boolean {
  const match = slots.find(s => s?.item === item && s.count < ITEMS[item].cap);
  if (match) { match.count++; return true; }
  const free = slots.indexOf(null);
  if (free < 0) return false;
  slots[free] = { item, count: 1 };
  return true;
}
