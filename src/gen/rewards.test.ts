import { expect, it } from 'vitest';
import { clearRewards, shopStock } from './rewards';
import { fallbackLayout } from './fallback';
import { ITEMS } from '../data/items';
import { PEARLY_POOL } from '../data/rooms/1';

it('pins the mandatory first-route Rite and four distinct deterministic weighted offers', () => {
  const { layout } = fallbackLayout(PEARLY_POOL, 1);
  const rewards = clearRewards(317434499, layout);
  const route: number[] = [];
  for (let i = layout.confessional; i > 0; i = layout.rooms[i].parent) route.unshift(i);
  expect(rewards[route.find(i => layout.rooms[i].kind === 'combat')!]).toEqual({ kind: 'rite' });
  expect(clearRewards(317434499, layout)).toEqual(rewards);
  const stock = shopStock(317434499); expect(new Set(stock).size).toBe(4);
  expect(shopStock(317434499)).toEqual(stock); expect(stock.every(id => ITEMS[id].price > 0)).toBe(true);
});
