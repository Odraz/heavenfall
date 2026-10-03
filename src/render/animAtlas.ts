/**
 * Animated 8-direction sprites rendered from a 3D model (scripts/blender/blessed.py): one PNG
 * atlas and a manifest of frames per animation and direction. Only the Blessed have one.
 */
import * as THREE from 'three';
import blessedUrl from '../../assets/sprites/blessed/atlas.png';
import blessedManifest from '../../assets/sprites/blessed/atlas.json';
import type { SpriteFrame } from './atlas';

export const ANIM_NAMES = ['idle', 'walk', 'attack', 'pain', 'death'] as const;
export type AnimName = (typeof ANIM_NAMES)[number];

export interface AnimFrame extends SpriteFrame {
  /** Billboard height in meters. */
  height: number;
}

export interface AnimSet {
  texture: THREE.Texture;
  /** Frames by animation, then direction (0–7), then frame index. */
  anims: Record<AnimName, AnimFrame[][]>;
}

interface Manifest {
  pxPerMeter: number;
  width: number;
  height: number;
  /** [x, y from top, w, h, ground x from left, ground y from bottom] in pixels. */
  anims: Record<string, number[][][]>;
}

function framesOf(m: Manifest): Record<AnimName, AnimFrame[][]> {
  const out = {} as Record<AnimName, AnimFrame[][]>;
  for (const name of ANIM_NAMES) {
    const dirs = m.anims[name];
    if (dirs?.length !== 8) throw new Error(`Animation ${name} needs 8 directions`);
    out[name] = dirs.map((frames) =>
      frames.map(([x, y, w, h, gx, gy]) => ({
        u0: x / m.width,
        u1: (x + w) / m.width,
        // The image is flipped vertically on upload: its top row is v = 1.
        v0: 1 - (y + h) / m.height,
        v1: 1 - y / m.height,
        aspect: w / h,
        anchorX: gx / w,
        anchorY: gy / h,
        height: h / m.pxPerMeter,
      })),
    );
  }
  return out;
}

export async function loadBlessedAnims(): Promise<AnimSet> {
  const img = new Image();
  img.src = blessedUrl;
  await img.decode();
  const texture = new THREE.Texture(img);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return { texture, anims: framesOf(blessedManifest as Manifest) };
}
