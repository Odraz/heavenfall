/** PNG sprites (cut out by scripts/cutout.py, §11.2) packed at load time into one 2048² canvas atlas (§11.1). */
import * as THREE from 'three';
import { DECOR_IDS, decorSprite } from '../data/decor';

const pngs = import.meta.glob('../../assets/sprites/*.png', { query: '?url', import: 'default', eager: true }) as Record<string, string>;

/** Every sprite's image URL by name. */
const sources = new Map(Object.entries(pngs).map(([path, url]) => [path.replace(/^.*\//, '').replace(/\.png$/, ''), url]));

/** Sprites drawn in the world as billboards; the rest (weapons, muzzle flash, icons) are HUD images. */
const BILLBOARD_SPRITES = new Set([
  'proj-censer', 'proj-orb', 'proj-arrow',
  'feather', 'spark', 'ember',
  'coin', 'chain-ring', 'taunt',
  ...DECOR_IDS.map(decorSprite),
]);

/** A sprite's image URL, for HUD images. */
export function spriteUrl(name: string): string {
  const url = sources.get(name);
  if (!url) throw new Error(`Unknown sprite ${name}`);
  return url;
}

export const ATLAS_SIZE = 2048;
const PAD = 4;

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
    [...sources].filter(([name]) => BILLBOARD_SPRITES.has(name)).map(async ([name, url]) => ({ name, img: await loadImage(url) })),
  );
  const entries = loaded
    .map(({ name, img }) => {
      const pw = img.naturalWidth;
      const ph = img.naturalHeight;
      return { name, img, pw, ph, aspect: pw / ph };
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
