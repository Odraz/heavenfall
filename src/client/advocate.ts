/**
 * The Advocate behind the Confessional's grille (rogue game.md §9.6): the received grille painting
 * standing at the template's `advocate` point, facing the room. A coded stand-in until the B4 Advocate
 * art is accepted; F within 2.5 m opens the Talents view.
 */
import * as THREE from 'three';
import type { GameMap } from '../sim/map';

const WIDTH = 2.2;
const HEIGHT = WIDTH * 429 / 640;

export function advocateSprite(map: GameMap, room: number): THREE.Object3D {
  const group = new THREE.Group();
  const point = map.rooms[room]?.points?.advocate;
  if (!point) return group;
  const texture = new THREE.TextureLoader().load(new URL('../../assets/items/confessional-grille.png', import.meta.url).href);
  texture.colorSpace = THREE.SRGBColorSpace;
  const grille = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, depthWrite: true }));
  const x = point[0] + 0.5, y = point[1] + 0.5, z = map.floor[point[1] * map.w + point[0]];
  grille.position.set(x, z + 1.5, y);
  grille.scale.set(WIDTH, HEIGHT, 1);
  grille.name = 'advocate';
  group.add(grille);
  return group;
}
