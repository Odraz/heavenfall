/** Terrain textures generated in code with canvas (§11.1). */
import * as THREE from 'three';

function canvasTexture(size: number, draw: (ctx: CanvasRenderingContext2D) => void): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/** Deterministic noise so the textures look the same on every load. */
function noise(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Ivory stone tiles: 2 × 2 tiles, covering 2 × 2 m. */
export function stoneTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (ctx) => {
    const rnd = noise(7);
    ctx.fillStyle = '#d9cfb8';
    ctx.fillRect(0, 0, 256, 256);
    for (let ty = 0; ty < 2; ty++) {
      for (let tx = 0; tx < 2; tx++) {
        const l = 88 + rnd() * 6;
        ctx.fillStyle = `hsl(44, 38%, ${l}%)`;
        ctx.fillRect(tx * 128 + 3, ty * 128 + 3, 122, 122);
        for (let i = 0; i < 60; i++) {
          ctx.fillStyle = `hsla(40, 30%, ${70 + rnd() * 25}%, 0.25)`;
          ctx.fillRect(tx * 128 + 4 + rnd() * 116, ty * 128 + 4 + rnd() * 116, 2 + rnd() * 8, 2 + rnd() * 8);
        }
        // A faint gold inlay line near the tile edge.
        ctx.strokeStyle = 'rgba(214, 170, 60, 0.35)';
        ctx.lineWidth = 2;
        ctx.strokeRect(tx * 128 + 12, ty * 128 + 12, 104, 104);
      }
    }
  });
}

/** Pale gold brick: covers 2 m wide × 2 m tall. */
export function brickTexture(): THREE.CanvasTexture {
  return canvasTexture(256, (ctx) => {
    const rnd = noise(11);
    ctx.fillStyle = '#c9b48a';
    ctx.fillRect(0, 0, 256, 256);
    const rows = 8;
    const bh = 256 / rows;
    for (let row = 0; row < rows; row++) {
      const offset = row % 2 === 0 ? 0 : 32;
      for (let x = -64; x < 256; x += 64) {
        const l = 80 + rnd() * 8;
        ctx.fillStyle = `hsl(42, 45%, ${l}%)`;
        ctx.fillRect(x + offset + 2, row * bh + 2, 60, bh - 4);
      }
    }
  });
}
