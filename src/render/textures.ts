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
import shaftUrl from '../../assets/textures/fx-lightshaft.png';
import atmosphereUrl from '../../assets/textures/fx-atmosphere.png';
import gateLeavesUrl from '../../assets/textures/gate-leaves.webp';
import gateRailingUrl from '../../assets/textures/gate-railing.webp';
import gatePostTopUrl from '../../assets/textures/gate-post-top.webp';
import gateShaftUrl from '../../assets/textures/gate-post-shaft.jpg';
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
  /** The light shaft (M10 §7.1). */
  shaft: THREE.Texture;
  /** The clouds' and the spires' paintings, one sheet (M10 §7.2, §7.3). */
  atmosphere: THREE.Texture;
  /** The Heavenly Gate's array (M10 gate §2), in the order of the G_ layers in gate.ts; null on maps without a gate. */
  gate: THREE.DataArrayTexture | null;
}

/** The gate array's layers are this size (M10 gate §2). */
export const GATE_LAYER_W = 1280;
export const GATE_LAYER_H = 2276;

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

/** Loads the textures of a game; the gate array only for a map with a gate (M10 gate §2). */
export async function loadGameTextures(withGate: boolean): Promise<GameTextures> {
  const layers = [floorUrl, floorPlainUrl, medallionUrl, riserUrl, wallUrl, windowUrl, pilasterUrl, corniceUrl, arcadeLowerUrl, arcadeUpperUrl];
  // Nothing in the gate wraps: the shafts repeat by geometry.
  const gateLayers = [gateLeavesUrl, gateRailingUrl, gatePostTopUrl, gateShaftUrl];
  const [array, gate, [door, sky, shaft, atmosphere, ring, beam, chain, glow, smoke]] = await Promise.all([
    loadTextureArray(layers, 1024),
    withGate ? loadTextureArray(gateLayers, GATE_LAYER_W, GATE_LAYER_H, THREE.ClampToEdgeWrapping) : Promise.resolve(null),
    Promise.all([doorUrl, skyUrl, shaftUrl, atmosphereUrl, ringUrl, beamUrl, chainUrl, glowUrl, smokeUrl].map(load)),
  ]);
  prepareSkyTexture(sky);
  for (const t of [shaft, atmosphere]) {
    t.wrapS = THREE.ClampToEdgeWrapping;
    t.wrapT = THREE.ClampToEdgeWrapping;
  }
  return { terrain: { array, door, sky, shaft, atmosphere, gate }, fx: { ring, beam, chain, glow, smoke } };
}
