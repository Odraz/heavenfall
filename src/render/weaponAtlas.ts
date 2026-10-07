/**
 * The painted first-person weapons (M11 §2), one set of layers per class, cut from the paintings by
 * scripts/cutout_weapons.py into assets/sprites/weapon-<class>/ with their manifest (weapon.json).
 * Only the local class's images are ever fetched, when the HUD shows them.
 */
import type { ClassId } from '../data/classes';
import type { AltKind } from '../client/fpWeapon';
import binderSwingUrl from '../../assets/sprites/weapon-binder/atlas.png';
import binderSwingManifest from '../../assets/sprites/weapon-binder/atlas.json';

/** A box in view pixels from the frame's top left. */
export interface ViewBox {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface WeaponManifest {
  viewH: 2160;
  /** The frame's left edge from the view's center column, its top row, its size; in view pixels. */
  left: number;
  top: number;
  w: number;
  h: number;
  /** In view pixels: x from the view's center column, y from the view's top row. */
  muzzle: [number, number];
  pivot: [number, number];
  /** The barrel's direction after placement, a unit vector pointing out of the muzzle. */
  axis: [number, number];
  glow: boolean;
  alt?: { kind: AltKind; glow: boolean };
  /** The hammer layer's box in the frame and its hinge, in view pixels from the frame's top left. */
  hammer?: ViewBox & { hinge: [number, number]; fall: number };
  /** The blurred cylinder's box in the frame. */
  cylinder?: ViewBox;
  /** The green censer's box in the frame (the Heretic). */
  heal?: ViewBox;
  /**
   * The Scourge (the Binder): the fist's size, its center and its forearm's direction in its image; the
   * chain's frames (stacked top to bottom in one image) and their box in the view (left from the center
   * column); and in each frame where the fist goes (x from the center column, y, and the forearm's angle).
   */
  swing?: {
    fist: { w: number; h: number; center: [number, number]; angle: number };
    chain: { frames: number; left: number; top: number; w: number; h: number };
    hands: Array<[number, number, number]>;
  };
}

/** The layer images a class has; the manifest says which. */
export type WeaponLayer = 'idle' | 'idle-glow' | 'alt' | 'alt-glow' | 'hammer' | 'cylinder' | 'censer-green' | 'censer-green-glow' | 'fist' | 'chain' | 'chain-glow';

export interface WeaponArt {
  manifest: WeaponManifest;
  url: (layer: WeaponLayer) => string;
}

const urls = import.meta.glob('../../assets/sprites/weapon-*/*.webp', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const manifests = import.meta.glob('../../assets/sprites/weapon-*/weapon.json', { import: 'default', eager: true }) as Record<string, WeaponManifest>;

export function weaponArt(classId: ClassId): WeaponArt {
  const dir = `../../assets/sprites/weapon-${classId}/`;
  const manifest = manifests[`${dir}weapon.json`];
  if (!manifest) throw new Error(`No weapon manifest for ${classId}`);
  return {
    manifest,
    url: (layer) => {
      const u = urls[`${dir}${layer}.webp`];
      if (!u) throw new Error(`No ${layer} layer for ${classId}'s weapon`);
      return u;
    },
  };
}

/**
 * The Binder's Scourge swing frames from the M9 Blender atlas (M9 §5.1), until M11 stage 3 replaces
 * them: each the bottom half of the view, 600 px tall, stored at 1/`scale` resolution.
 */
export interface SwingAtlas {
  url: string;
  width: number;
  height: number;
  frameH: number;
  swing: { scale: number; frameW: number; centerX: number; frames: number[][] };
}

export const BINDER_SWING: SwingAtlas = { url: binderSwingUrl, ...(binderSwingManifest as Omit<SwingAtlas, 'url'>) };
