import * as THREE from 'three';
import type { ItemId } from '../data/items';
import type { ItemEffect } from '../sim/consumables';
import type { GameMap } from '../sim/map';
import { ItemArea } from '../render/itemArea';
import { ITEM_ART } from './itemArt';

/** A thrown jar in flight is its own icon, 0.45 m across, tumbling once every 0.4 s. */
const FLIGHT_SIZE = 0.45;
const FLIGHT_SPIN = (2 * Math.PI) / 0.4;
/** Flights move at the host's 20 m/s (consumables.ts). */
const THROW_SPEED = 20;

type Live = { state: ItemEffect; flight: THREE.Sprite | null; area: ItemArea | null };

/** Cosmetic interpolation of accepted effects; no collision, charges or lifetime decisions. */
export class ItemView {
  readonly group = new THREE.Group();
  private readonly live = new Map<number, Live>();
  private readonly flightMaterials = new Map<ItemId, THREE.SpriteMaterial>();

  constructor(private readonly map: GameMap) {}

  sync(effects: ItemEffect[]): void { for (const id of [...this.live.keys()]) this.remove(id); for (const e of effects) this.state(e); }
  state(effect: ItemEffect): void {
    const old = this.live.get(effect.id);
    if (old && old.state.activatedTick === effect.activatedTick) { old.state = { ...effect }; return; }
    this.remove(effect.id);
    const entry: Live = { state: { ...effect }, flight: null, area: null };
    if (effect.activatedTick < 0) {
      entry.flight = new THREE.Sprite(this.flightMaterial(effect.item));
      entry.flight.scale.setScalar(FLIGHT_SIZE);
      this.group.add(entry.flight);
    } else {
      entry.area = new ItemArea(this.map, effect.item, effect.x, effect.y, effect.z, effect.room, effect.activatedTick, effect.endTick);
      this.group.add(entry.area.group);
    }
    this.live.set(effect.id, entry);
  }
  update(tick: number): void {
    for (const { state: e, flight, area } of this.live.values()) {
      if (flight) {
        const t = Math.max(0, (tick - e.startTick) / 30);
        const distance = Math.min(e.bound, t * THROW_SPEED);
        flight.position.set(e.sx + e.dx * distance, e.sz + e.dz * distance, e.sy + e.dy * distance);
        flight.material.rotation = t * FLIGHT_SPIN;
      }
      area?.update(tick);
    }
  }
  remove(id: number): void {
    const entry = this.live.get(id); if (!entry) return;
    entry.flight?.removeFromParent(); entry.area?.dispose(); this.live.delete(id);
  }
  dispose(): void {
    for (const id of [...this.live.keys()]) this.remove(id);
    for (const m of this.flightMaterials.values()) { m.map?.dispose(); m.dispose(); }
    this.flightMaterials.clear();
  }

  /** One shared material per item, made on its first throw. */
  private flightMaterial(item: ItemId): THREE.SpriteMaterial {
    let material = this.flightMaterials.get(item);
    if (!material) {
      const texture = new THREE.TextureLoader().load(ITEM_ART[item]);
      texture.colorSpace = THREE.SRGBColorSpace;
      material = new THREE.SpriteMaterial({ map: texture, transparent: true, alphaTest: .05, depthWrite: false });
      this.flightMaterials.set(item, material);
    }
    return material;
  }
}
