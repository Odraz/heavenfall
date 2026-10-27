/**
 * Clear-reward marks for the map and the door signs (rogue game.md §5.2): the reward's own art, the
 * halo sprite, the item's icon or the Rite page, without a box. No reward shows no mark; the old
 * boxed glyphs read as letters at map size (audit batch 2).
 */
import type { ClearReward } from '../gen/rewards';
import { spriteUrl } from '../render/atlas';
import { ITEM_ART, PAGE_ART } from './itemArt';

const images = new Map<string, HTMLImageElement>();
let loading: Promise<void> | null = null;

function artUrl(reward: ClearReward): string | null {
  return reward.kind === 'gold' ? spriteUrl('gold-halo') : reward.kind === 'item' ? ITEM_ART[reward.item] : reward.kind === 'rite' ? PAGE_ART : null;
}

/** Resolves once every reward image has loaded or failed; a missing image is simply not drawn. */
export function loadRewardArt(): Promise<void> {
  if (loading) return loading;
  // Node tests have no Image; their canvases get no reward marks.
  if (typeof Image === 'undefined') return (loading = Promise.resolve());
  const urls = [spriteUrl('gold-halo'), PAGE_ART, ...Object.values(ITEM_ART)];
  loading = Promise.all(urls.map((url) => new Promise<void>((resolve) => {
    const img = new Image();
    img.onload = img.onerror = () => resolve();
    img.src = url;
    images.set(url, img);
  }))).then(() => undefined);
  return loading;
}

/** Draws the reward's art centered on (x, y), `size` pixels square, with a soft shadow for light rooms. */
export function drawRewardIcon(ctx: CanvasRenderingContext2D, reward: ClearReward, x: number, y: number, size: number): void {
  const url = artUrl(reward);
  const img = url ? images.get(url) : undefined;
  if (!img?.complete || !img.naturalWidth) return;
  ctx.save();
  ctx.shadowColor = '#000';
  ctx.shadowBlur = size / 6;
  ctx.drawImage(img, x - size / 2, y - size / 2, size, size);
  ctx.restore();
}
