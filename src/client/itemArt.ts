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
/** R6 relic icons and the route objects (art-prompts B5, B8), cut out by scripts/cutout.py. */
export const RELIC_ART: Record<string, string> = {
  usher: new URL('../../assets/items/relic-usher.png', import.meta.url).href,
  thurible: new URL('../../assets/items/relic-thurible.png', import.meta.url).href,
  link: new URL('../../assets/items/relic-link.png', import.meta.url).href,
  tile: new URL('../../assets/items/relic-tile.png', import.meta.url).href,
  qseal: new URL('../../assets/items/relic-qseal.png', import.meta.url).href,
  eseal: new URL('../../assets/items/relic-eseal.png', import.meta.url).href,
  comb: new URL('../../assets/items/relic-comb.png', import.meta.url).href,
  wheel: new URL('../../assets/items/relic-wheel.png', import.meta.url).href,
  unbroken: new URL('../../assets/items/relic-unbroken.png', import.meta.url).href,
  mercy: new URL('../../assets/items/relic-mercy.png', import.meta.url).href,
  armageddon: new URL('../../assets/items/relic-armageddon.png', import.meta.url).href,
  sentence3: new URL('../../assets/items/relic-sentence3.png', import.meta.url).href,
};
export const KEY_ART = new URL('../../assets/items/shared-key.png', import.meta.url).href;
export const CHEST_ART = new URL('../../assets/items/reliquary-chest.png', import.meta.url).href;
export const CHEST_OPEN_ART = new URL('../../assets/items/reliquary-chest-open.png', import.meta.url).href;
export const BELL_ART = new URL('../../assets/items/judgment-bell.png', import.meta.url).href;
export const SUNDIAL_ART = new URL('../../assets/items/sundial.png', import.meta.url).href;
