/** The Pardoner's stall and the Stair's copies of its stock (rogue game.md §6.6, §11.6). */
import { ITEMS, storeItem, type Inventory, type ItemId } from '../data/items';
import { aimDir } from './combat';
import { PLAYER_EYE } from './constants';
import { lineOfSight } from './los';
import type { GameMap } from './map';
import { overVoid } from './map';
import type { Simulation, SimPlayer } from './sim';

export interface ShopBuyer { wallet: number; inventory: Inventory; sold: number }
export interface InteractionResult { accepted: boolean; reason: string }
export const CHART_PRICE = 120;
/**
 * Interaction source IDs on the wire (rogue game.md §6.6, §11.6): the Pardoner's item pedestals are
 * 0–3 and its map pedestal 4; after the boss, the Stair's personal copies of pedestals 0–3 are 5–8.
 */
export const SOURCE_CHART = 4;
export const SOURCE_STAIR_FIRST = 5;
export const SOURCE_STAIR_LAST = 8;
/** Buying needs the pedestal within this reach and the aim within this cosine of it (§6.6). */
const BUY_REACH = 2;
const BUY_AIM = 0.8;

/** The stock index an item pedestal or its Stair copy sells. */
export function stockIndex(sourceId: number): number {
  return sourceId < SOURCE_STAIR_FIRST ? sourceId : sourceId - SOURCE_STAIR_FIRST;
}

export interface ShopPoint { x: number; y: number; z: number }

/** The Stair at the boss room's center, then its four personal stock copies 4 m out on the diagonals. */
const STAIR_OFFSETS = [[0, 0], [-4, -4], [4, -4], [-4, 4], [4, 4]];

/** Shared placement for the Stair and its four personal copies of existing stock: the nearest free legal floor cells. */
export function stairPoints(map: GameMap, room: number): ShopPoint[] {
  const rect = map.rooms[room].rect;
  const x = (rect.x0 + rect.x1 + 1) / 2;
  const y = (rect.y0 + rect.y1 + 1) / 2;
  const used = new Set<number>();
  const result: ShopPoint[] = [];
  for (const [dx, dy] of STAIR_OFFSETS) {
    let best = -1;
    let distance = Infinity;
    for (let r = rect.y0; r <= rect.y1; r++) {
      for (let c = rect.x0; c <= rect.x1; c++) {
        const i = r * map.w + c;
        const d = (c + .5 - x - dx) ** 2 + (r + .5 - y - dy) ** 2;
        const legal = !used.has(i) && map.roomOf[i] === room && !map.solid[i] && !overVoid(map, c + .5, r + .5);
        if (legal && d < distance) {
          best = i;
          distance = d;
        }
      }
    }
    if (best < 0) throw new Error('Boss room has no legal Stair floor');
    used.add(best);
    result.push({ x: best % map.w + .5, y: Math.floor(best / map.w) + .5, z: map.floor[best] });
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
  buyer.wallet -= price;
  buyer.sold |= 1 << index;
  return { accepted: true, reason: `Bought ${ITEMS[item].name}` };
}

interface SourcePoint { x: number; y: number; z: number; room: number }

/** Where a source's purchase point stands now, or null when the source isn't there. */
function sourcePoint(sim: Simulation, sourceId: number): SourcePoint | null {
  const floor = sim.floor;
  if (!floor) return null;
  if (sourceId < SOURCE_STAIR_FIRST) {
    const point = sim.map.rooms[floor.pardoner].points?.pedestals?.[sourceId];
    if (!point) return null;
    const z = sim.map.floor[point[1] * sim.map.w + point[0]] + 1;
    return { x: point[0] + 0.5, y: point[1] + 0.5, z, room: floor.pardoner };
  }
  if (!sim.won || sourceId > SOURCE_STAIR_LAST) return null;
  const stair = stairPoints(sim.map, floor.boss)[stockIndex(sourceId) + 1];
  return stair ? { x: stair.x, y: stair.y, z: stair.z + 1, room: floor.boss } : null;
}

/**
 * One shop interaction (§6.6). Reach, room, sight and aim are checked again here at commit, rather
 * than trusting the card the client saw.
 */
export function interactShop(sim: Simulation, p: SimPlayer, sourceId: number): InteractionResult {
  const at = Number.isInteger(sourceId) ? sourcePoint(sim, sourceId) : null;
  if (!at || !p.connected || p.dead || sim.result) return { accepted: false, reason: 'Unavailable' };
  const dx = at.x - p.x;
  const dy = at.y - p.y;
  const dz = at.z - p.z - PLAYER_EYE;
  const d = Math.hypot(dx, dy, dz);
  const aim = aimDir(p.yaw, p.pitch);
  const aimed = d <= 0.01 || (dx * aim[0] + dy * aim[1] + dz * aim[2]) / d >= BUY_AIM;
  if (d > BUY_REACH || sim.pickups.roomAt(p.x, p.y) !== at.room || !lineOfSight(sim.map, p.x, p.y, p.z + PLAYER_EYE, at.x, at.y, at.z) || !aimed) {
    return { accepted: false, reason: 'Look at a pedestal within 2 m' };
  }
  if (sourceId !== SOURCE_CHART) return buyItem(p, sim.floor!.stock, stockIndex(sourceId));
  if (sim.rewards.chartRevealed) return { accepted: false, reason: 'Chart already revealed' };
  if (p.wallet < CHART_PRICE) return { accepted: false, reason: 'Not enough halos' };
  p.wallet -= CHART_PRICE;
  sim.rewards.revealChart();
  return { accepted: true, reason: 'Pardoner’s Chart revealed the floor' };
}
