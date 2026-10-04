/**
 * First-person weapon atlases rendered from 3D models (scripts/blender/weapons.py), one per class
 * (§11.2): an idle frame and 4 fire frames, each the bottom half of the view from the eye, 600 px
 * tall, with its muzzle point. Only the local class's image is ever fetched, when the HUD shows it.
 */
import type { ClassId } from '../data/classes';
import fallenUrl from '../../assets/sprites/weapon-fallen/atlas.png';
import fallenManifest from '../../assets/sprites/weapon-fallen/atlas.json';
import hereticUrl from '../../assets/sprites/weapon-heretic/atlas.png';
import hereticManifest from '../../assets/sprites/weapon-heretic/atlas.json';
import binderUrl from '../../assets/sprites/weapon-binder/atlas.png';
import binderManifest from '../../assets/sprites/weapon-binder/atlas.json';
import betrayerUrl from '../../assets/sprites/weapon-betrayer/atlas.png';
import betrayerManifest from '../../assets/sprites/weapon-betrayer/atlas.json';

export interface WeaponManifest {
  width: number;
  height: number;
  frameW: number;
  /** The frame height: half the screen height. */
  frameH: number;
  /** The column of the screen's vertical center line, from the frame's left edge (may be negative). */
  centerX: number;
  /** [x, y from top, muzzle x from left, muzzle y from top] in pixels. */
  idle: number[][];
  fire: number[][];
}

export interface WeaponAtlas {
  url: string;
  manifest: WeaponManifest;
}

const ATLASES: Record<ClassId, WeaponAtlas> = {
  fallen: { url: fallenUrl, manifest: fallenManifest as WeaponManifest },
  heretic: { url: hereticUrl, manifest: hereticManifest as WeaponManifest },
  binder: { url: binderUrl, manifest: binderManifest as WeaponManifest },
  betrayer: { url: betrayerUrl, manifest: betrayerManifest as WeaponManifest },
};

export function weaponAtlas(classId: ClassId): WeaponAtlas {
  return ATLASES[classId];
}

/** The fire animation lasts the shorter of the time between shots and this (§11.1). */
export const FIRE_ANIM_MAX_MS = 300;

/**
 * The fire frame (0–3) to show `sinceShot` ms after a shot, for a weapon firing every
 * `intervalMs`, or -1 for the idle frame once the 4 frames have played.
 */
export function fireFrame(sinceShot: number, intervalMs: number, frames = 4): number {
  const duration = Math.min(intervalMs, FIRE_ANIM_MAX_MS);
  if (!(sinceShot >= 0) || sinceShot >= duration) return -1;
  return Math.min(frames - 1, Math.floor((sinceShot / duration) * frames));
}
