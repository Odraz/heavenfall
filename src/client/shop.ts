import * as THREE from 'three';
import { ITEMS } from '../data/items';
import type { Floor } from '../gen/generate';
import type { InventoryState } from '../net/messages';
import type { GameMap } from '../sim/map';
import { aimDir } from '../sim/combat';
import { lineOfSight } from '../sim/los';
import { CHART_PRICE, SOURCE_CHART, stairPoints, stockIndex } from '../sim/shop';
import type { VictoryState } from '../sim/victory';
import { ITEM_ART, CHART_ART } from './itemArt';
import { spriteUrl } from '../render/atlas';

/** The pedestal sprite's height; its cushion top is where the stock rests. */
const PEDESTAL_HEIGHT = 1;
/** Half the Pardoner sprite's width plus a margin: no raised cell may come this close. */
const PARDONER_CLEARANCE = 0.9;

/**
 * Where the Pardoner stands: on the room's base floor just beside the central plinth (rooms.md
 * `pg-s-pardoner-01`, the indulgence box he stands behind), never inside it. Tries each side of the
 * room's center at 3.2 m, the plinth's half-width plus his clearance; ties keep the first side.
 */
export function pardonerSpot(map: GameMap, room: number): { x: number; y: number; z: number } {
  const rect = map.rooms[room].rect, cx = (rect.x0 + rect.x1 + 1) / 2, cy = (rect.y0 + rect.y1 + 1) / 2;
  let base = Infinity;
  for (let r = rect.y0; r <= rect.y1; r++) for (let c = rect.x0; c <= rect.x1; c++) {
    const i = r * map.w + c;
    if (map.roomOf[i] === room && !map.solid[i] && Number.isFinite(map.floor[i])) base = Math.min(base, map.floor[i]);
  }
  const clear = (x: number, y: number): boolean => {
    for (let r = Math.floor(y - PARDONER_CLEARANCE); r <= Math.floor(y + PARDONER_CLEARANCE); r++) for (let c = Math.floor(x - PARDONER_CLEARANCE); c <= Math.floor(x + PARDONER_CLEARANCE); c++) {
      const i = r * map.w + c;
      if (c < 0 || r < 0 || c >= map.w || r >= map.h || map.roomOf[i] !== room || map.solid[i] || Math.abs(map.floor[i] - base) > 0.01) return false;
    }
    return true;
  };
  for (const [dx, dy] of [[0, 3.2], [0, -3.2], [3.2, 0], [-3.2, 0]]) if (clear(cx + dx, cy + dy)) return { x: cx + dx, y: cy + dy, z: base };
  return { x: cx, y: cy + 3.2, z: base };
}

export class ShopView {
  readonly group = new THREE.Group();
  private readonly cards: THREE.Sprite[] = [];
  readonly points: Array<{ x: number; y: number; z: number }> = [];
  private won = false;
  constructor(private readonly map: GameMap, private readonly floor: Floor | null) {
    if (!floor) return;
    const loader = new THREE.TextureLoader();
    const spot = pardonerSpot(map, floor.pardoner);
    const portrait = loader.load(new URL('../../assets/items/npc-pardoner.png', import.meta.url).href); portrait.colorSpace = THREE.SRGBColorSpace;
    const pardoner = new THREE.Sprite(new THREE.SpriteMaterial({ map: portrait, alphaTest: .05, depthWrite: false }));
    pardoner.position.set(spot.x, spot.z + 1.4, spot.y); pardoner.scale.set(1.6, 2.8, 1); this.group.add(pardoner);
    // The painted stall pedestal (unlit, like every billboard); a lit mesh rendered black here.
    const pedestalArt = loader.load(spriteUrl('shop-pedestal')); pedestalArt.colorSpace = THREE.SRGBColorSpace;
    const pedestalMaterial = new THREE.SpriteMaterial({ map: pedestalArt, alphaTest: .05, depthWrite: false });
    for (const [i, point] of (map.rooms[floor.pardoner].points?.pedestals ?? []).entries()) {
      const p = { x: point[0] + 0.5, y: point[1] + 0.5, z: map.floor[point[1] * map.w + point[0]] + 1 };
      this.points.push(p);
      const ground = p.z - 1, base = new THREE.Sprite(pedestalMaterial);
      base.position.set(p.x, ground + PEDESTAL_HEIGHT / 2, p.y); base.scale.set(PEDESTAL_HEIGHT * 223 / 384, PEDESTAL_HEIGHT, 1); base.name = 'shop-pedestal';
      this.group.add(base);
      const texture = loader.load(i === SOURCE_CHART ? CHART_ART : ITEM_ART[floor.stock[i]]);
      texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, alphaTest: .05, depthWrite: false }));
      // Resting on the cushion; the purchase point (p) stays where the host checks the aim.
      sprite.position.set(p.x, ground + PEDESTAL_HEIGHT + 0.3, p.y); sprite.scale.set(0.8, 0.8, 1); sprite.renderOrder = 1;
      this.group.add(sprite); this.cards.push(sprite);
    }
  }
  victory(state: VictoryState): void {
    if (this.won || !this.floor) return; this.won = true;
    const beam = new THREE.Mesh(new THREE.CylinderGeometry(2, 2, 20, 24, 1, true), new THREE.MeshBasicMaterial({ color: 0xffe7b0, transparent: true, opacity: .2, side: THREE.DoubleSide, depthWrite: false }));
    beam.position.set(state.x, state.z + 10, state.y); this.group.add(beam);
    for (const [i, p] of stairPoints(this.map, this.floor.boss).slice(1).entries()) {
      this.points.push({ ...p, z: p.z + 1 });
      const texture = new THREE.TextureLoader().load(ITEM_ART[this.floor.stock[i]]); texture.colorSpace = THREE.SRGBColorSpace;
      const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: texture, alphaTest: .05, depthWrite: false })); sprite.position.set(p.x, p.z + 1, p.y); sprite.scale.set(.8, .8, 1);
      this.group.add(sprite); this.cards.push(sprite);
    }
  }
  update(state: InventoryState): void {
    this.cards.forEach((c, i) => {
      c.visible = i === SOURCE_CHART ? !state.chart : (state.sold & (1 << stockIndex(i))) === 0;
    });
  }
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
    const stock = stockIndex(index);
    const sold = index === SOURCE_CHART ? state?.chart : !!((state?.sold ?? 0) & (1 << stock));
    if (sold) return 'Sold';
    if (index === SOURCE_CHART) return `Pardoner’s Chart · ${CHART_PRICE} halos · F within 2 m`;
    const item = ITEMS[this.floor.stock[stock]];
    const fresh = state && !state.itemsTried.includes(this.floor.stock[stock]) ? 'New · ' : '';
    return `${fresh}${item.name} · ${item.price} halos · ${item.rule} · F within 2 m`;
  }
  dispose(): void {
    this.group.traverse(object => {
      if (object instanceof THREE.Mesh) { object.geometry.dispose(); (object.material as THREE.Material).dispose(); }
      if (object instanceof THREE.Sprite) { object.material.map?.dispose(); object.material.dispose(); }
    }); this.group.clear();
  }
}
