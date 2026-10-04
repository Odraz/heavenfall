/**
 * Animated 8-direction sprites rendered from 3D models (scripts/blender/): one PNG atlas and a
 * manifest of frames per animation and direction for each character (§11.2).
 */
import * as THREE from 'three';
import blessedUrl from '../../assets/sprites/blessed/atlas.png';
import blessedManifest from '../../assets/sprites/blessed/atlas.json';
import choristerUrl from '../../assets/sprites/chorister/atlas.png';
import choristerManifest from '../../assets/sprites/chorister/atlas.json';
import cherubUrl from '../../assets/sprites/cherub/atlas.png';
import cherubManifest from '../../assets/sprites/cherub/atlas.json';
import gatekeeperUrl from '../../assets/sprites/gatekeeper/atlas.png';
import gatekeeperManifest from '../../assets/sprites/gatekeeper/atlas.json';
import fallenUrl from '../../assets/sprites/fallen/atlas.png';
import fallenManifest from '../../assets/sprites/fallen/atlas.json';
import hereticUrl from '../../assets/sprites/heretic/atlas.png';
import hereticManifest from '../../assets/sprites/heretic/atlas.json';
import binderUrl from '../../assets/sprites/binder/atlas.png';
import binderManifest from '../../assets/sprites/binder/atlas.json';
import betrayerUrl from '../../assets/sprites/betrayer/atlas.png';
import betrayerManifest from '../../assets/sprites/betrayer/atlas.json';
import type { ClassId } from '../data/classes';
import { BLESSED, CHERUB, CHORISTER, GATEKEEPER } from '../data/enemies';
import type { SpriteFrame } from './atlas';

export const ANIM_NAMES = ['idle', 'walk', 'attack', 'pain', 'death'] as const;
export type AnimName = (typeof ANIM_NAMES)[number];
export const CHORISTER_ANIM_NAMES = ['idle', 'walk', 'cast', 'pain', 'death'] as const;
export const CHERUB_ANIM_NAMES = ['fly', 'cast', 'pain', 'death'] as const;
export const GATEKEEPER_ANIM_NAMES = ['idle', 'volley', 'judgment', 'death'] as const;
export const PLAYER_ANIM_NAMES = ['idle', 'walk'] as const;
export type PlayerAnimName = (typeof PLAYER_ANIM_NAMES)[number];

export interface AnimFrame extends SpriteFrame {
  /** Billboard height in meters. */
  height: number;
}

export interface AnimSet<N extends string = AnimName> {
  texture: THREE.Texture;
  /** Frames by animation, then direction (0–7), then frame index. */
  anims: Record<N, AnimFrame[][]>;
}

export type PlayerAnimSet = AnimSet<PlayerAnimName>;

interface Manifest {
  pxPerMeter: number;
  width: number;
  height: number;
  /** [x, y from top, w, h, ground x from left, ground y from bottom] in pixels. */
  anims: Record<string, number[][][]>;
}

/** The same frame flipped left to right: the character seen from the mirrored direction. */
function mirrored(f: AnimFrame): AnimFrame {
  return { ...f, u0: f.u1, u1: f.u0, anchorX: 1 - (f.anchorX ?? 0.5) };
}

function framesOf<N extends string>(m: Manifest, names: readonly N[]): Record<N, AnimFrame[][]> {
  const out = {} as Record<N, AnimFrame[][]>;
  for (const name of names) {
    const dirs = m.anims[name];
    if (dirs?.length !== 8 && dirs?.length !== 5) throw new Error(`Animation ${name} needs 8 or 5 directions`);
    const frames8: AnimFrame[][] = dirs.map((frames) =>
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
    // An atlas rendered from 5 directions (front to back on one side) draws the other 3 as
    // mirror images (§11.1): direction 8 − d mirrors d.
    for (let d = frames8.length; d < 8; d++) frames8.push(frames8[8 - d].map(mirrored));
    out[name] = frames8;
  }
  return out;
}

async function loadAnimSet<N extends string>(url: string, manifest: Manifest, names: readonly N[]): Promise<AnimSet<N>> {
  const img = new Image();
  img.src = url;
  await img.decode();
  const texture = new THREE.Texture(img);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return { texture, anims: framesOf(manifest, names) };
}

/** An enemy's animations by name; which ones it has depends on its type (§11.2). */
export type EnemyAnimSet = AnimSet<string>;

/** The atlases of every enemy type that has one, by type. */
export async function loadEnemyAnims(): Promise<Partial<Record<number, EnemyAnimSet>>> {
  const [blessed, chorister, cherub, gatekeeper] = await Promise.all([
    loadAnimSet(blessedUrl, blessedManifest as Manifest, ANIM_NAMES),
    loadAnimSet(choristerUrl, choristerManifest as Manifest, CHORISTER_ANIM_NAMES),
    loadAnimSet(cherubUrl, cherubManifest as Manifest, CHERUB_ANIM_NAMES),
    loadAnimSet(gatekeeperUrl, gatekeeperManifest as Manifest, GATEKEEPER_ANIM_NAMES),
  ]);
  return { [BLESSED]: blessed, [CHORISTER]: chorister, [CHERUB]: cherub, [GATEKEEPER]: gatekeeper };
}

const PLAYER_ATLASES: Record<ClassId, { url: string; manifest: Manifest }> = {
  fallen: { url: fallenUrl, manifest: fallenManifest as Manifest },
  heretic: { url: hereticUrl, manifest: hereticManifest as Manifest },
  binder: { url: binderUrl, manifest: binderManifest as Manifest },
  betrayer: { url: betrayerUrl, manifest: betrayerManifest as Manifest },
};

/** The atlases of the given classes, each loaded once. */
export async function loadPlayerAnims(classIds: Iterable<ClassId>): Promise<Partial<Record<ClassId, PlayerAnimSet>>> {
  const ids = [...new Set(classIds)];
  const sets = await Promise.all(ids.map((id) => loadAnimSet(PLAYER_ATLASES[id].url, PLAYER_ATLASES[id].manifest, PLAYER_ANIM_NAMES)));
  return Object.fromEntries(ids.map((id, i) => [id, sets[i]]));
}
