/**
 * The Advocate behind the Confessional's grille (rogue game.md §9.6): the B4 grille painting, cut to its
 * frame and grille (scripts/cutout.py CROPS), mounted flat on the wall beside the template's `advocate`
 * point, facing the room. F within 2.5 m of the point opens the Talents view.
 */
import * as THREE from 'three';
import type { GameMap } from '../sim/map';
import { RELIEF } from '../render/relief';

const WIDTH = 2.2;
/** The B4 panel export is 640 × 550 (scripts/cutout.py CROPS). */
const HEIGHT = WIDTH * 550 / 640;
/** The painting's center above the floor. */
const CENTER_Z = 1.6;
/** In front of the wall's pilaster strips, so none of them cuts through the painting. */
const OFFSET = RELIEF + 0.02;

/** Where the grille hangs: the center of the wall face beside the point, and the room-facing normal. */
export interface AdvocateMount {
  x: number;
  y: number;
  z: number;
  nx: number;
  ny: number;
}

/** The wall face the Advocate's point stands against (the rooms validator keeps exactly one), or null. */
export function advocateMount(map: GameMap, room: number): AdvocateMount | null {
  const point = map.rooms[room]?.points?.advocate;
  if (!point) return null;
  const [c, r] = point;
  for (const [dx, dy] of [[0, -1], [1, 0], [0, 1], [-1, 0]] as const) {
    const wc = c + dx, wr = r + dy;
    if (wc < 0 || wr < 0 || wc >= map.w || wr >= map.h || !map.wall[wr * map.w + wc]) continue;
    return { x: c + 0.5 + dx * (0.5 - OFFSET), y: r + 0.5 + dy * (0.5 - OFFSET), z: map.floor[r * map.w + c] + CENTER_Z, nx: -dx, ny: -dy };
  }
  return null;
}

export function advocateSprite(map: GameMap, room: number): THREE.Object3D {
  const group = new THREE.Group();
  const mount = advocateMount(map, room);
  if (!mount) return group;
  const texture = new THREE.TextureLoader().load(new URL('../../assets/items/confessional-grille.png', import.meta.url).href);
  texture.colorSpace = THREE.SRGBColorSpace;
  const grille = new THREE.Mesh(new THREE.PlaneGeometry(WIDTH, HEIGHT), new THREE.MeshBasicMaterial({ map: texture }));
  // three.js: x = x, y = z, z = y. The plane faces +z; turn it to the room.
  grille.position.set(mount.x, mount.z, mount.y);
  grille.rotation.y = Math.atan2(mount.nx, mount.ny);
  grille.name = 'advocate';
  group.add(grille);
  return group;
}
