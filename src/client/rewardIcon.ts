import type { ClearReward } from '../gen/rewards';
const paths = {
  gold: 'M4 9A8 4 0 1 0 20 9A8 4 0 1 0 4 9M4 9L4 15A8 4 0 0 0 20 15L20 9M8 10L8 16M16 10L16 16',
  rite: 'M6 6L17 6L17 21L6 21ZM9 10L14 10M9 14L13 14M11 6Q8 3 12 1Q11 4 15 5',
  item: 'M9 2L15 2L15 6L18 10L18 20Q12 23 6 20L6 10L9 6ZM6 13L18 13M9 2L9 5L15 5',
  nothing: 'M5 12L19 12',
};
const cached = new Map<string, Path2D>();
/** Shared reward plate vocabulary, independent of room-combat glyphs. */
export function drawRewardIcon(ctx: CanvasRenderingContext2D, reward: ClearReward, x: number, y: number, size: number): void {
  ctx.save(); ctx.translate(x, y); ctx.fillStyle = '#211b25'; ctx.strokeStyle = '#e4c277'; ctx.lineWidth = 2;
  ctx.fillRect(-size / 2, -size / 2, size, size); ctx.strokeRect(-size / 2, -size / 2, size, size);
  const key = reward.kind;
  let path = cached.get(key); if (!path) { path = new Path2D(paths[key]); cached.set(key, path); }
  ctx.translate(-size * .42, -size * .42); ctx.scale(size * .84 / 24, size * .84 / 24);
  ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.strokeStyle = '#ffe0a0'; ctx.stroke(path);
  ctx.restore();
}
