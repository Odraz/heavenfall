import * as THREE from 'three';
import { ITEMS } from '../data/items';
import type { Floor } from '../gen/generate';
import type { InventoryState } from '../net/messages';
import type { GameMap } from '../sim/map';
import { aimDir } from '../sim/combat';
import { lineOfSight } from '../sim/los';
import { CHART_PRICE } from '../sim/shop';
import { ITEM_ART, CHART_ART } from './itemArt';

export class ShopView {
  readonly group = new THREE.Group();
  private readonly cards: THREE.Sprite[] = [];
  readonly points: Array<{ x: number; y: number; z: number }> = [];
  constructor(private readonly map: GameMap, private readonly floor: Floor | null) {
    if (!floor) return;
    const loader = new THREE.TextureLoader();
    const room = map.rooms[floor.pardoner], x = (room.rect.x0 + room.rect.x1 + 1) / 2, y = (room.rect.y0 + room.rect.y1 + 1) / 2;
    const portrait = loader.load(new URL('../../assets/art-src/npc-pardoner.png', import.meta.url).href); portrait.colorSpace = THREE.SRGBColorSpace;
    const pardoner = new THREE.Sprite(new THREE.SpriteMaterial({ map: portrait }));
    pardoner.position.set(x, map.floor[Math.floor(y + 2) * map.w + Math.floor(x)] + 1.4, y + 2); pardoner.scale.set(1.6, 2.8, 1); this.group.add(pardoner);
    for (const [i, point] of (map.rooms[floor.pardoner].points?.pedestals ?? []).entries()) {
      const p = { x: point[0] + 0.5, y: point[1] + 0.5, z: map.floor[point[1] * map.w + point[0]] + 1 };
      this.points.push(p);
      const base = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.55, 0.65, 8), new THREE.MeshStandardMaterial({ color: 0xa28c67 }));
      base.position.set(p.x, p.z - 0.65, p.y); this.group.add(base);
      const texture = loader.load(i === 4 ? CHART_ART : ITEM_ART[floor.stock[i]]); texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture }));
      sprite.position.set(p.x, p.z, p.y); sprite.scale.set(0.8, 0.8, 1); this.group.add(sprite); this.cards.push(sprite);
    }
  }
  update(state: InventoryState): void { this.cards.forEach((c, i) => { c.visible = i === 4 ? !state.chart : (state.sold & (1 << i)) === 0; }); }
  target(p: { x: number; y: number; z: number }, yaw: number, pitch: number, reach = 4): number {
    const aim = aimDir(yaw, pitch); let best = -1, distance = reach;
    this.points.forEach((point, i) => {
      const dx = point.x - p.x, dy = point.y - p.y, dz = point.z - p.z - 1.6, d = Math.hypot(dx, dy, dz);
      if (d > distance || d > 0.01 && (dx * aim[0] + dy * aim[1] + dz * aim[2]) / d < 0.8 || !lineOfSight(this.map, p.x, p.y, p.z + 1.6, point.x, point.y, point.z)) return;
      best = i; distance = d;
    });
    return best;
  }
  label(index: number, state: InventoryState | null): string {
    if (!this.floor || index < 0) return '';
    const sold = index === 4 ? state?.chart : !!((state?.sold ?? 0) & (1 << index));
    if (sold) return 'Sold';
    if (index === 4) return `Pardoner’s Chart · ${CHART_PRICE} halos · F within 2 m`;
    const item = ITEMS[this.floor.stock[index]];
    return `${item.name} · ${item.price} halos · ${item.rule} · F within 2 m`;
  }
  dispose(): void {
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
      if (object instanceof THREE.Sprite) { object.material.map?.dispose(); object.material.dispose(); }
    }); this.group.clear();
  }
}
