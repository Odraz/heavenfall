import type { ItemId } from '../data/items';
export const ITEM_ART: Record<ItemId, string> = {
  balm: new URL('../../assets/art-src/item-balm.png', import.meta.url).href,
  seal: new URL('../../assets/art-src/item-seal.png', import.meta.url).href,
  feather: new URL('../../assets/art-src/item-feather.png', import.meta.url).href,
  mirror: new URL('../../assets/art-src/item-mirror.png', import.meta.url).href,
  venom: new URL('../../assets/art-src/item-venom.png', import.meta.url).href,
  frost: new URL('../../assets/art-src/item-frost.png', import.meta.url).href,
  chain: new URL('../../assets/art-src/item-chain.png', import.meta.url).href,
  plume: new URL('../../assets/art-src/item-plume.jfif', import.meta.url).href,
};
export const CHART_ART = new URL('../../assets/art-src/chart-scroll.png', import.meta.url).href;
export const PAGE_ART = new URL('../../assets/art-src/rite-page.png', import.meta.url).href;
