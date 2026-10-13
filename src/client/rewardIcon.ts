import type { ClearReward } from '../gen/rewards';
/** Shared reward plate vocabulary, independent of room-combat glyphs. */
export function drawRewardIcon(ctx: CanvasRenderingContext2D, reward: ClearReward, x: number, y: number, size: number): void {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#211b25'; ctx.strokeStyle = '#e4c277'; ctx.lineWidth = 2;
  ctx.fillRect(-size / 2, -size / 2, size, size); ctx.strokeRect(-size / 2, -size / 2, size, size);
  ctx.fillStyle = '#ffe0a0'; ctx.font = `bold ${size * .7}px serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillText(reward.kind === 'gold' ? '○' : reward.kind === 'rite' ? 'R' : reward.kind === 'item' ? '+' : '–', 0, 1);
  ctx.restore();
}
