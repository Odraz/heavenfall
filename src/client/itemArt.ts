import type { ItemId } from '../data/items';
export const ITEM_ART: Record<ItemId, string> = {
  balm: new URL('../../assets/items/item-balm.png', import.meta.url).href,
  seal: new URL('../../assets/items/item-seal.png', import.meta.url).href,
  feather: new URL('../../assets/items/item-feather.png', import.meta.url).href,
  mirror: new URL('../../assets/items/item-mirror.png', import.meta.url).href,
  venom: new URL('../../assets/items/item-venom.png', import.meta.url).href,
  frost: new URL('../../assets/items/item-frost.png', import.meta.url).href,
  chain: new URL('../../assets/items/item-chain.png', import.meta.url).href,
  plume: new URL('../../assets/items/item-plume.png', import.meta.url).href,
};
export const CHART_ART = new URL('../../assets/items/chart-scroll.png', import.meta.url).href;
export const PAGE_ART = new URL('../../assets/items/rite-page.png', import.meta.url).href;
