/** SVG sprites rasterized at load time into one 2048² canvas atlas (§11.1). */
import * as THREE from 'three';

const sources = import.meta.glob('../../assets/sprites/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

export const ATLAS_SIZE = 2048;
const PAD = 4;
/** Rasterized height in pixels per sprite; the default is 192. */
const RASTER_HEIGHT: Record<string, number> = { gatekeeper: 512 };
const DEFAULT_HEIGHT = 192;

export interface SpriteFrame {
  /** UV rectangle: bottom-left (u0, v0) to top-right (u1, v1). */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Width ÷ height. */
  aspect: number;
}

export interface Atlas {
  texture: THREE.CanvasTexture;
  frames: Record<string, SpriteFrame>;
  canvas: HTMLCanvasElement;
}

function svgSize(svg: string): { w: number; h: number } {
  const root = /<svg\b[^>]*>/.exec(svg)?.[0] ?? '';
  const w = Number(/\bwidth="([\d.]+)"/.exec(root)?.[1]);
  const h = Number(/\bheight="([\d.]+)"/.exec(root)?.[1]);
  if (!(w > 0 && h > 0)) throw new Error('Sprite SVGs need explicit width and height attributes');
  return { w, h };
}

async function rasterize(svg: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  await img.decode();
  return img;
}

export async function buildAtlas(): Promise<Atlas> {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  const entries = Object.entries(sources)
    .map(([path, svg]) => {
      const name = path.replace(/^.*\//, '').replace(/\.svg$/, '');
      const size = svgSize(svg);
      const ph = RASTER_HEIGHT[name] ?? DEFAULT_HEIGHT;
      const pw = Math.round((ph * size.w) / size.h);
      return { name, svg, pw, ph, aspect: size.w / size.h };
    })
    .sort((a, b) => b.ph - a.ph || a.name.localeCompare(b.name));

  // Shelf packing.
  const frames: Record<string, SpriteFrame> = {};
  let x = PAD;
  let y = PAD;
  let shelf = 0;
  for (const e of entries) {
    if (x + e.pw + PAD > ATLAS_SIZE) {
      x = PAD;
      y += shelf + PAD;
      shelf = 0;
    }
    if (y + e.ph + PAD > ATLAS_SIZE) throw new Error('Sprite atlas is full');
    const img = await rasterize(e.svg);
    ctx.drawImage(img, x, y, e.pw, e.ph);
    frames[e.name] = {
      u0: x / ATLAS_SIZE,
      u1: (x + e.pw) / ATLAS_SIZE,
      // The texture is flipped vertically on upload: canvas row 0 is v = 1.
      v0: 1 - (y + e.ph) / ATLAS_SIZE,
      v1: 1 - y / ATLAS_SIZE,
      aspect: e.aspect,
    };
    x += e.pw + PAD;
    shelf = Math.max(shelf, e.ph);
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, frames, canvas };
}
