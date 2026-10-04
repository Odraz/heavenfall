/** Terrain and effect textures (§11.1, §11.2), made from generated images by scripts/cutout.py. */
import * as THREE from 'three';
import floorUrl from '../../assets/textures/tex-floor.png';
import riserUrl from '../../assets/textures/tex-riser.png';
import wallUrl from '../../assets/textures/tex-wall.png';
import doorUrl from '../../assets/textures/tex-door.png';
import ringUrl from '../../assets/textures/fx-ring.png';
import beamUrl from '../../assets/textures/fx-beam.png';
import chainUrl from '../../assets/textures/fx-chain.png';
import glowUrl from '../../assets/textures/fx-glow.png';
import smokeUrl from '../../assets/textures/fx-smoke.png';

/** Each covers 4 × 4 m and repeats, aligned to world coordinates. */
export interface TerrainTextures {
  /** Floor tops. */
  floor: THREE.Texture;
  /** The vertical sides of stairs, ledges and terraces. */
  riser: THREE.Texture;
  /** Wall columns. */
  wall: THREE.Texture;
  /** Closed doors. */
  door: THREE.Texture;
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
  const [floor, riser, wall, door, ring, beam, chain, glow, smoke] = await Promise.all(
    [floorUrl, riserUrl, wallUrl, doorUrl, ringUrl, beamUrl, chainUrl, glowUrl, smokeUrl].map(load),
  );
  return { terrain: { floor, riser, wall, door }, fx: { ring, beam, chain, glow, smoke } };
}
