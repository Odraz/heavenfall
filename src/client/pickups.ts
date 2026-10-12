/** R2 world pickup projection. Only complete snapshots create/remove visible entities. */
import * as THREE from 'three';
import { GOLD_HALO, HEAL_MOTE, PICKUP_CAP, PICKUP_KIND_COUNT, PICKUP_NAMES, type PickupRecord } from '../data/pickups';
import type { FloorSync } from '../net/messages';
import type { Snapshot } from '../net/protocol';
import type { GameMap } from '../sim/map';

export class PickupProjection {
  readonly records = new Map<number, { pickup: PickupRecord; tick: number }>();
  private revision = -1;
  constructor(readonly runId: string) {}
  private valid(p: PickupRecord): boolean {
    return !!p && Number.isInteger(p.id) && p.id > 0 && p.id <= 0xffffffff && Number.isInteger(p.kind) && p.kind >= 0 && p.kind < PICKUP_KIND_COUNT &&
      Number.isInteger(p.room) && p.room >= 0 && p.room < 32 && Number.isFinite(p.x) && Number.isFinite(p.y) &&
      Number.isInteger(p.expiresTick) && p.expiresTick >= -1 && Number.isInteger(p.value) && p.value >= 0 && p.value <= 99;
  }
  sync(s: FloorSync): boolean {
    const list = s.pickups ?? [];
    if (s.runId !== this.runId || s.revision < this.revision || list.length > PICKUP_CAP || list.some((p) => !this.valid(p)) || new Set(list.map((p) => p.id)).size !== list.length) return false;
    this.records.clear(); this.revision = s.revision;
    for (const p of list) this.records.set(p.id, { pickup: { ...p }, tick: s.tick });
    return true;
  }
  state(p: PickupRecord, tick: number, revision: number): void {
    if (!this.valid(p) || revision <= this.revision || (!this.records.has(p.id) && this.records.size >= PICKUP_CAP)) return;
    this.records.set(p.id, { pickup: { ...p }, tick }); this.revision = revision;
  }
  snapshot(s: Snapshot): void {
    const present = new Set(s.pickupId);
    for (const [id, entry] of this.records) if (s.tick >= entry.tick && !present.has(id)) this.records.delete(id);
  }
}

export class PickupView {
  readonly group = new THREE.Group();
  readonly model: PickupProjection;
  private readonly meshes = new Map<number, THREE.InstancedMesh>();
  private readonly pose = new THREE.Object3D();
  private readonly counts = new Map<number, number>();
  constructor(readonly map: GameMap, runId: string) {
    this.model = new PickupProjection(runId);
    for (let kind = 0; kind <= 10; kind++) {
      let geometry: THREE.BufferGeometry;
      let material: THREE.MeshBasicMaterial;
      if (kind <= GOLD_HALO) {
        geometry = new THREE.TorusGeometry(kind === GOLD_HALO ? 0.32 : 0.23, 0.05, 4, 16);
        material = new THREE.MeshBasicMaterial({ color: kind === GOLD_HALO ? 0xffcc33 : 0xe6d89b });
      } else if (kind === HEAL_MOTE) {
        geometry = new THREE.OctahedronGeometry(0.16);
        material = new THREE.MeshBasicMaterial({ color: 0x77ff99 });
      } else {
        const canvas = document.createElement('canvas'); canvas.width = 384; canvas.height = 128;
        const ctx = canvas.getContext('2d')!;
        ctx.fillStyle = '#211b25'; ctx.fillRect(0, 0, 384, 128);
        ctx.strokeStyle = '#d8ae57'; ctx.lineWidth = 5; ctx.strokeRect(3, 3, 378, 122);
        ctx.fillStyle = '#f8edd0'; ctx.font = '24px serif'; ctx.textAlign = 'center';
        ctx.fillText(PICKUP_NAMES[kind], 192, 48);
        ctx.font = '20px sans-serif'; ctx.fillText(kind === 3 ? '40 HP on touch' : 'Effect arrives in R3', 192, 89);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace;
        geometry = new THREE.PlaneGeometry(1.8, 0.6);
        material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      }
      const mesh = new THREE.InstancedMesh(geometry, material, PICKUP_CAP);
      mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes.set(kind, mesh); this.group.add(mesh);
    }
  }
  update(s: Snapshot | null, camera: THREE.Camera, tick: number): void {
    for (const kind of this.meshes.keys()) this.counts.set(kind, 0);
    if (s) {
      this.model.snapshot(s);
      for (let i = 0; i < s.pickupCount; i++) {
        const kind = s.pickupKind[i], id = s.pickupId[i], mesh = this.meshes.get(kind);
        if (!mesh) continue;
        const expiry = this.model.records.get(id)?.pickup.expiresTick ?? -1;
        if (expiry >= 0 && expiry - tick <= 90 && Math.floor(tick / 5) % 2 === 0) continue;
        const x = s.pickupX[i], y = s.pickupY[i], c = Math.floor(x), r = Math.floor(y);
        if (c < 0 || r < 0 || c >= this.map.w || r >= this.map.h) continue;
        this.pose.position.set(x, this.map.floor[r * this.map.w + c] + 0.45 + 0.06 * Math.sin(tick / 8 + id), y);
        this.pose.quaternion.copy(camera.quaternion); this.pose.updateMatrix();
        const index = this.counts.get(kind)!; mesh.setMatrixAt(index, this.pose.matrix); this.counts.set(kind, index + 1);
      }
    }
    for (const [kind, mesh] of this.meshes) { mesh.count = this.counts.get(kind)!; mesh.instanceMatrix.needsUpdate = true; }
  }
  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose(); const material = mesh.material as THREE.MeshBasicMaterial;
      material.map?.dispose(); material.dispose();
    }
    this.group.clear();
  }
}
