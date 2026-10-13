/** Labeled coded fallback until the received Dominion reference has a runtime model/atlas. */
import * as THREE from 'three';
import type { AnimFrame, EnemyAnimSet } from './animAtlas';

const W = 160, H = 240, COLS = 8;
const counts = { idle: 1, walk: 8, cast: 8, pain: 3, death: 8 };
export function dominionAtlas(): EnemyAnimSet {
  const rows = Object.values(counts).reduce((a, b) => a + b, 0);
  const width = W * COLS, height = H * rows;
  const canvas = document.createElement('canvas'); canvas.width = width / 2; canvas.height = height / 2;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(0.5, 0.5);
  const anims: Record<string, AnimFrame[][]> = {}; let row = 0;
  for (const [name, count] of Object.entries(counts)) {
    anims[name] = Array.from({ length: 8 }, () => []);
    for (let f = 0; f < count; f++, row++) for (let d = 0; d < 8; d++) {
      const x = d * W, y = row * H;
      ctx.save(); ctx.translate(x + 80, y + 225);
      const stride = name === 'walk' ? Math.sin(f * Math.PI / 4) * 9 : 0;
      const fall = name === 'death' ? f / 7 : 0;
      ctx.translate(0, -stride * 0.2); ctx.rotate(fall * Math.PI / 2);
      const side = Math.max(0.45, Math.abs(Math.cos(d * Math.PI / 4)));
      ctx.lineWidth = 3; ctx.strokeStyle = '#31281e';
      // Folded ivory wings, broad armor and dark bronze face.
      ctx.fillStyle = '#ddd5b8';
      for (const s of [-1, 1]) { ctx.beginPath(); ctx.moveTo(s * 20 * side, -169); ctx.lineTo(s * 53 * side, -130); ctx.lineTo(s * 39 * side, -60); ctx.lineTo(s * 13 * side, -100); ctx.closePath(); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = name === 'pain' ? '#d6a265' : '#f2ead1';
      ctx.fillRect(-25 * side, -157, 50 * side, 102); ctx.strokeRect(-25 * side, -157, 50 * side, 102);
      ctx.fillStyle = '#c89c37'; ctx.fillRect(-26 * side, -157, 52 * side, 11); ctx.fillRect(-26 * side, -65, 52 * side, 10);
      ctx.fillStyle = '#eee4c8';
      for (const s of [-1, 1]) { ctx.fillRect(s * 14 * side - 8, -54 + s * stride, 16, 54 - s * stride); ctx.strokeRect(s * 14 * side - 8, -54 + s * stride, 16, 54 - s * stride); }
      ctx.fillStyle = '#6d4b29'; ctx.beginPath(); ctx.ellipse(0, -181, 18 * side, 23, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#e5bf51'; ctx.fillRect(-19 * side, -205, 38 * side, 9);
      // Mace raises through six tell poses; release lowers without inventing damage.
      const raise = name === 'cast' ? (f < 6 ? f / 5 : (7 - f) / 2) : 0.1;
      ctx.save(); ctx.translate(26 * side, -139); ctx.rotate(-0.65 + raise * 1.8);
      ctx.fillStyle = '#bd9132'; ctx.fillRect(-4, -82, 8, 104); ctx.strokeRect(-4, -82, 8, 104);
      ctx.beginPath(); ctx.moveTo(-17, -94); ctx.lineTo(0, -112); ctx.lineTo(17, -94); ctx.lineTo(14, -67); ctx.lineTo(-14, -67); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.restore(); ctx.restore();
      ctx.fillStyle = '#251c12'; ctx.fillRect(x + 20, y, 120, 16);
      ctx.fillStyle = '#ffe6a0'; ctx.font = 'bold 14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('DOMINION', x + 80, y + 13);
      anims[name][d].push({ u0: x / width, u1: (x + W) / width, v0: 1 - (y + H) / height, v1: 1 - y / height,
        height: 4.1, aspect: W / H, anchorX: 0.5, anchorY: 15 / H });
    }
  }
  const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; texture.anisotropy = 4;
  return { texture, anims };
}
