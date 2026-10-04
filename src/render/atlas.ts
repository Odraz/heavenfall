/**
 * Sprites packed at load time into one 2048² canvas atlas (§11.1): the final PNG sprites cut
 * out by scripts/cutout.py (§11.2), and the SVG placeholders still waiting for theirs.
 */
import * as THREE from 'three';
import { DECOR_IDS, decorSprite } from '../data/decor';

const svgs = import.meta.glob('../../assets/sprites/*.svg', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;
const pngs = import.meta.glob('../../assets/sprites/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

const spriteName = (path: string) => path.replace(/^.*\//, '').replace(/\.(svg|png)$/, '');

/** Every sprite's image URL by name; a PNG replaces the SVG placeholder of the same name. */
const sources = new Map<string, { url: string; svg?: string }>();
for (const [path, svg] of Object.entries(svgs)) sources.set(spriteName(path), { url: `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`, svg });
for (const [path, url] of Object.entries(pngs)) sources.set(spriteName(path), { url });

/** Sprites drawn in the world as billboards; the rest (weapons, muzzle flash, icons) are HUD images. */
const BILLBOARD_SPRITES = new Set([
  'proj-censer', 'proj-orb', 'proj-arrow',
  'feather', 'spark', 'ember',
  'mark', 'chain-ring',
  ...DECOR_IDS.map(decorSprite),
]);

/** A sprite's image URL, for HUD images. */
export function spriteUrl(name: string): string {
  const source = sources.get(name);
  if (!source) throw new Error(`Unknown sprite ${name}`);
  return source.url;
}

export const ATLAS_SIZE = 2048;
const PAD = 4;
/** Rasterized height in pixels per SVG sprite; the default is 192. PNG sprites keep their own size. */
const RASTER_HEIGHT: Record<string, number> = { 'decor-angel-statue': 320, 'decor-fountain': 256, 'decor-candelabrum': 256 };
const DEFAULT_HEIGHT = 192;

export interface SpriteFrame {
  /** UV rectangle: bottom-left (u0, v0) to top-right (u1, v1). */
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  /** Width ÷ height. */
  aspect: number;
  /**
   * Where the billboard's position sits in the frame, as fractions of its width (from the left)
   * and height (from the bottom); the default is the bottom center. Set by animated frames,
   * which are cropped tightly around each pose.
   */
  anchorX?: number;
  anchorY?: number;
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

async function loadImage(url: string): Promise<HTMLImageElement> {
  const img = new Image();
  img.src = url;
  await img.decode();
  return img;
}

export async function buildAtlas(): Promise<Atlas> {
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_SIZE;
  canvas.height = ATLAS_SIZE;
  const ctx = canvas.getContext('2d')!;
  const loaded = await Promise.all(
    [...sources].filter(([name]) => BILLBOARD_SPRITES.has(name)).map(async ([name, source]) => ({ name, source, img: await loadImage(source.url) })),
  );
  const entries = loaded
    .map(({ name, source, img }) => {
      const size = source.svg ? svgSize(source.svg) : { w: img.naturalWidth, h: img.naturalHeight };
      const ph = source.svg ? (RASTER_HEIGHT[name] ?? DEFAULT_HEIGHT) : size.h;
      const pw = Math.round((ph * size.w) / size.h);
      return { name, img, pw, ph, aspect: size.w / size.h };
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
    ctx.drawImage(e.img, x, y, e.pw, e.ph);
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
