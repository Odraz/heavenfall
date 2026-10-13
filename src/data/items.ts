/** Consumable catalog; array order is the stable pickup/input wire order. */
export const ITEM_IDS = ['balm', 'seal', 'feather', 'mirror', 'venom', 'frost', 'chain', 'plume'] as const;
export type ItemId = typeof ITEM_IDS[number];
export interface ItemDef {
  name: string; kind: 'instant' | 'self' | 'placed' | 'thrown'; cap: number;
  price: number; weight: number; duration: number; radius: number; rule: string;
}
export const ITEMS: Record<ItemId, ItemDef> = {
  balm: { name: 'Balm of the Rejected', kind: 'instant', cap: 3, price: 100, weight: 20, duration: 0, radius: 0, rule: 'Heal yourself for 40 HP.' },
  seal: { name: 'Wax Seal of Sanctuary', kind: 'self', cap: 2, price: 120, weight: 12, duration: 240, radius: 0, rule: 'Replace a weaker shield with 50 shield for 8 seconds.' },
  feather: { name: "Pilgrim’s Feather", kind: 'self', cap: 3, price: 120, weight: 14, duration: 240, radius: 0, rule: 'Move 2 m/s faster for 8 seconds.' },
  mirror: { name: 'Mirror Ward', kind: 'placed', cap: 2, price: 180, weight: 8, duration: 180, radius: 4, rule: 'Return hostile projectiles inside a 4 m dome.' },
  venom: { name: 'Bitter Water', kind: 'thrown', cap: 3, price: 160, weight: 14, duration: 180, radius: 5, rule: 'Poison a 5 m pool: 5 damage every half second.' },
  frost: { name: 'Ash of Stillness', kind: 'thrown', cap: 3, price: 140, weight: 14, duration: 180, radius: 6, rule: 'Halve enemy movement inside a 6 m circle.' },
  chain: { name: 'Chain Vial', kind: 'placed', cap: 2, price: 160, weight: 10, duration: 180, radius: 5, rule: 'Bind each enemy once for 1 second in a 5 m circle.' },
  plume: { name: 'Plume of Expulsion', kind: 'thrown', cap: 2, price: 180, weight: 8, duration: 180, radius: 5, rule: 'Launch each unbound enemy once in a 5 m circle.' },
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
