/** Terrain and effect textures (§11.1, §11.2), made from generated images by scripts/cutout.py. */
import * as THREE from 'three';
import floorUrl from '../../assets/textures/tex-floor.jpg';
import floorPlainUrl from '../../assets/textures/tex-floor-plain.jpg';
import medallionUrl from '../../assets/textures/tex-floor-medallion.jpg';
import riserUrl from '../../assets/textures/tex-riser.jpg';
import wallUrl from '../../assets/textures/tex-wall.jpg';
import windowUrl from '../../assets/textures/tex-wall-window.jpg';
import pilasterUrl from '../../assets/textures/tex-wall-pilaster.jpg';
import corniceUrl from '../../assets/textures/tex-cornice.jpg';
import arcadeLowerUrl from '../../assets/textures/arcade-lower.png';
import arcadeUpperUrl from '../../assets/textures/arcade-upper.png';
import doorUrl from '../../assets/textures/tex-door.jpg';
import ringUrl from '../../assets/textures/fx-ring.png';
import beamUrl from '../../assets/textures/fx-beam.png';
import chainUrl from '../../assets/textures/fx-chain.png';
import glowUrl from '../../assets/textures/fx-glow.png';
import smokeUrl from '../../assets/textures/fx-smoke.png';
import skyUrl from '../../assets/textures/sky-day.jpg';
import { prepareSkyTexture } from './sky';
import { loadTextureArray } from './textureArray';

export interface TerrainTextures {
  /**
   * The terrain's looks and the arcade's two layers, one texture array (M10 §5.1), in the order of the
   * L_ layers in looks.ts. Each tiling look covers 4 × 4 m.
   */
  array: THREE.DataArrayTexture;
  /** Closed doors. */
  door: THREE.Texture;
  /** The sky's horizon band (M10 §4.2). */
  sky: THREE.Texture;
}

/** Transparent where the generated image was black; white ones are tinted per effect. */
export interface EffectTextures {
  ring: THREE.Texture;
  /** A strip repeating left to right. */
  beam: THREE.Texture;
  /** A strip repeating left to right, in its own colors. */
  chain: THREE.Texture;
  glow: THREE.Texture;
  smoke: THREE.Texture;
}

export interface GameTextures {
  terrain: TerrainTextures;
  fx: EffectTextures;
}

async function load(url: string): Promise<THREE.Texture> {
  const tex = await new THREE.TextureLoader().loadAsync(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export async function loadGameTextures(): Promise<GameTextures> {
  const layers = [floorUrl, floorPlainUrl, medallionUrl, riserUrl, wallUrl, windowUrl, pilasterUrl, corniceUrl, arcadeLowerUrl, arcadeUpperUrl];
  const [array, [door, sky, ring, beam, chain, glow, smoke]] = await Promise.all([
    loadTextureArray(layers, 1024),
    Promise.all([doorUrl, skyUrl, ringUrl, beamUrl, chainUrl, glowUrl, smokeUrl].map(load)),
  ]);
  prepareSkyTexture(sky);
  return { terrain: { array, door, sky }, fx: { ring, beam, chain, glow, smoke } };
}
