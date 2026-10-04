/** Terrain textures (§11.1, §11.2), made from generated images by scripts/cutout.py. */
import * as THREE from 'three';
import floorUrl from '../../assets/textures/tex-floor.png';
import riserUrl from '../../assets/textures/tex-riser.png';
import wallUrl from '../../assets/textures/tex-wall.png';
import doorUrl from '../../assets/textures/tex-door.png';

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

async function load(url: string): Promise<THREE.Texture> {
  const tex = await new THREE.TextureLoader().loadAsync(url);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export async function loadTerrainTextures(): Promise<TerrainTextures> {
  const [floor, riser, wall, door] = await Promise.all([floorUrl, riserUrl, wallUrl, doorUrl].map(load));
  return { floor, riser, wall, door };
}
