import { ITEMS, storeItem, type Inventory, type ItemId } from '../data/items';

export interface ShopBuyer { wallet: number; inventory: Inventory; sold: number }
export interface InteractionResult { accepted: boolean; reason: string }
export const CHART_PRICE = 120;
/** Geometry/alive/run scope is checked by the simulation before this atomic transaction. */
export function buyItem(buyer: ShopBuyer, stock: readonly ItemId[], index: number): InteractionResult {
  if (!Number.isInteger(index) || index < 0 || index >= stock.length) return { accepted: false, reason: 'Unknown pedestal' };
  if (buyer.sold & (1 << index)) return { accepted: false, reason: 'Sold' };
  const item = stock[index], price = ITEMS[item].price;
  if (buyer.wallet < price) return { accepted: false, reason: 'Not enough halos' };
  if (!storeItem(buyer.inventory, item)) return { accepted: false, reason: 'Inventory full' };
  buyer.wallet -= price; buyer.sold |= 1 << index;
  return { accepted: true, reason: `Bought ${ITEMS[item].name}` };
}
