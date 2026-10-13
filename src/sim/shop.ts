import { ITEMS, storeItem, type Inventory, type ItemId } from '../data/items';
import type { GameMap } from './map';
import { overVoid } from './map';

export interface ShopBuyer { wallet: number; inventory: Inventory; sold: number }
export interface InteractionResult { accepted: boolean; reason: string }
export const CHART_PRICE = 120;
export interface ShopPoint { x: number; y: number; z: number }
/** Shared placement for the Stair and its four personal copies of existing stock. */
export function stairPoints(map: GameMap, room: number): ShopPoint[] {
  const rect = map.rooms[room].rect, x = (rect.x0 + rect.x1 + 1) / 2, y = (rect.y0 + rect.y1 + 1) / 2;
  const used = new Set<number>(), result: ShopPoint[] = [];
  for (const [dx, dy] of [[0, 0], [-4, -4], [4, -4], [-4, 4], [4, 4]]) {
    let best = -1, distance = Infinity;
    for (let r = rect.y0; r <= rect.y1; r++) for (let c = rect.x0; c <= rect.x1; c++) {
      const i = r * map.w + c, d = (c + .5 - x - dx) ** 2 + (r + .5 - y - dy) ** 2;
      if (!used.has(i) && map.roomOf[i] === room && !map.solid[i] && !overVoid(map, c + .5, r + .5) && d < distance) { best = i; distance = d; }
    }
    if (best < 0) throw new Error('Boss room has no legal Stair floor');
    used.add(best); result.push({ x: best % map.w + .5, y: Math.floor(best / map.w) + .5, z: map.floor[best] });
  }
  return result;
}
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
