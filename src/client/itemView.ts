import * as THREE from 'three';
import { ITEMS } from '../data/items';
import type { ItemEffect } from '../sim/consumables';

const COLORS = { balm: 0x65df85, seal: 0x7bbdff, feather: 0xf2eedb, mirror: 0xc3eaff, venom: 0x68cd55, frost: 0xb78bdf, chain: 0xe98456, plume: 0xf5efcf };
/** Cosmetic interpolation of accepted effects; no collision, charges or lifetime decisions. */
export class ItemView {
  readonly group = new THREE.Group();
  private readonly live = new Map<number, { state: ItemEffect; mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> }>();
  sync(effects: ItemEffect[]): void { for (const id of this.live.keys()) this.remove(id); for (const e of effects) this.state(e); }
  state(effect: ItemEffect): void {
    const old = this.live.get(effect.id);
    if (old && old.state.activatedTick === effect.activatedTick) { old.state = { ...effect }; return; }
    this.remove(effect.id);
    const flight = effect.activatedTick < 0, ward = effect.item === 'mirror', radius = ITEMS[effect.item].radius;
    const geometry = flight ? new THREE.OctahedronGeometry(.16) : ward ? new THREE.SphereGeometry(radius, 24, 12) : new THREE.RingGeometry(radius - .12, radius, 64);
    const material = new THREE.MeshBasicMaterial({ color: COLORS[effect.item], transparent: true, opacity: flight ? 1 : ward ? .25 : .65, wireframe: ward, side: THREE.DoubleSide, depthWrite: false });
    const mesh = new THREE.Mesh(geometry, material); if (!flight && !ward) mesh.rotation.x = -Math.PI / 2;
    this.group.add(mesh); this.live.set(effect.id, { state: { ...effect }, mesh });
  }
  update(tick: number): void {
    for (const { state: e, mesh } of this.live.values()) {
      if (e.activatedTick < 0) {
        const distance = Math.min(e.bound, Math.max(0, (tick - e.startTick) / 30) * 20);
        mesh.position.set(e.sx + e.dx * distance, e.sz + e.dz * distance, e.sy + e.dy * distance);
      } else {
        mesh.position.set(e.x, e.z + (e.item === 'mirror' ? 1 : .06), e.y);
        mesh.visible = tick < e.endTick; mesh.material.opacity = (e.item === 'mirror' ? .25 : .65) * Math.min(1, Math.max(0, (e.endTick - tick) / 30));
      }
    }
  }
  remove(id: number): void {
    const entry = this.live.get(id); if (!entry) return;
    entry.mesh.removeFromParent(); entry.mesh.geometry.dispose(); entry.mesh.material.dispose(); this.live.delete(id);
  }
  dispose(): void { for (const id of this.live.keys()) this.remove(id); }
}
