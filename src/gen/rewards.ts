import { ITEM_IDS, ITEMS, type ItemId } from '../data/items';
import { REWARD_GOLD_VALUE, RITE_PAGE_HALOS } from '../data/pickups';
import { fmix32, makeRng } from './hash';
import type { Layout } from './layout';

export type ClearReward = { kind: 'nothing' | 'gold' | 'rite' } | { kind: 'item'; item: ItemId };
export function clearRewards(seed: number, layout: Layout): ClearReward[] {
  const rewards = layout.rooms.map((room, i): ClearReward => {
    if (room.kind !== 'combat') return { kind: 'nothing' };
    const hash = fmix32(seed ^ Math.imul(i + 1, 0x27d4eb2f)), roll = hash / 4294967296;
    return roll < 0.30 ? { kind: 'nothing' } : roll < 0.55 ? { kind: 'gold' } : roll < 0.75
      ? { kind: 'item', item: makeRng(hash).weighted(ITEM_IDS, id => ITEMS[id].weight) } : { kind: 'rite' };
  });
  const route: number[] = [];
  for (let i = layout.confessional; i > 0; i = layout.rooms[i].parent) route.unshift(i);
  const first = route.find(i => layout.rooms[i].kind === 'combat');
  if (first !== undefined) rewards[first] = { kind: 'rite' };
  return rewards;
}
export function shopStock(seed: number): ItemId[] {
  const rng = makeRng(fmix32(seed ^ 0x09a4d0e5)), pool = [...ITEM_IDS], result: ItemId[] = [];
  while (result.length < 4) {
    const id = rng.weighted(pool, item => ITEMS[item].weight); result.push(id); pool.splice(pool.indexOf(id), 1);
  }
  return result;
}
export const rewardLabel = (reward: ClearReward): string => reward.kind === 'item' ? ITEMS[reward.item].name
  : reward.kind === 'gold' ? `${REWARD_GOLD_VALUE} halos` : reward.kind === 'rite' ? `Rite page · ${RITE_PAGE_HALOS} halos` : 'No clear reward';
