/** R2 world pickup projection. Only complete snapshots create/remove visible entities. */
import * as THREE from 'three';
import { GOLD_HALO, HEAL_MOTE, PICKUP_CAP, PICKUP_KIND_COUNT, type PickupRecord } from '../data/pickups';
import type { FloorSync } from '../net/messages';
import type { Snapshot } from '../net/protocol';
import type { GameMap } from '../sim/map';
import type { Atlas } from '../render/atlas';
import { ITEM_IDS } from '../data/items';
import { ITEM_ART, PAGE_ART, CHART_ART } from './itemArt';

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
  private readonly glows: THREE.InstancedMesh;
  private readonly glowColor = new THREE.Color();
  constructor(readonly map: GameMap, runId: string, glow: THREE.Texture, private readonly atlas: Atlas) {
    this.model = new PickupProjection(runId);
    this.glows = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 1.1), new THREE.MeshBasicMaterial({ map: glow,
      transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), PICKUP_CAP);
    this.glows.count = 0; this.glows.frustumCulled = false; this.glows.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.group.add(this.glows);
    for (const kind of [...Array.from({ length: 11 }, (_, i) => i), 13, 15]) {
      let geometry: THREE.BufferGeometry;
      let material: THREE.MeshBasicMaterial;
      if (kind <= HEAL_MOTE) {
        const frame = atlas.frames[kind === HEAL_MOTE ? 'heal-mote' : 'gold-halo'];
        const height = kind === GOLD_HALO ? 0.85 : 0.65;
        geometry = new THREE.PlaneGeometry(height * frame.aspect, height);
        const uv = geometry.getAttribute('uv');
        for (let i = 0; i < uv.count; i++) uv.setXY(i, frame.u0 + uv.getX(i) * (frame.u1 - frame.u0), frame.v0 + uv.getY(i) * (frame.v1 - frame.v0));
        // Soft alpha avoids sparkling cutout edges. Overlapping rewards must not fight over depth.
        material = new THREE.MeshBasicMaterial({ map: atlas.texture, alphaTest: 0.02, transparent: true,
          depthWrite: false, color: kind === 0 ? 0xc5b987 : kind === GOLD_HALO ? 0xdfc584 : 0xffffff });
      } else {
        const texture = new THREE.TextureLoader().load(kind === 15 ? PAGE_ART : kind === 13 ? CHART_ART : ITEM_ART[ITEM_IDS[kind - 3]]); texture.colorSpace = THREE.SRGBColorSpace;
        geometry = new THREE.PlaneGeometry(0.8, 0.8);
        material = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide });
      }
      const mesh = new THREE.InstancedMesh(geometry, material, PICKUP_CAP);
      mesh.count = 0; mesh.frustumCulled = false; mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.meshes.set(kind, mesh); this.group.add(mesh);
    }
  }
  update(s: Snapshot | null, camera: THREE.Camera, tick: number): void {
    for (const kind of this.meshes.keys()) this.counts.set(kind, 0);
    let glowCount = 0;
    if (s) {
      this.model.snapshot(s);
      for (let i = 0; i < s.pickupCount; i++) {
        const kind = s.pickupKind[i], id = s.pickupId[i], mesh = this.meshes.get(kind);
        if (!mesh) continue;
        const expiry = this.model.records.get(id)?.pickup.expiresTick ?? -1;
        const x = s.pickupX[i], y = s.pickupY[i], c = Math.floor(x), r = Math.floor(y);
        if (c < 0 || r < 0 || c >= this.map.w || r >= this.map.h) continue;
        // A steady, gentle shrink signals expiry without strobing during the final three seconds.
        const scale = expiry < 0 ? 1 : 0.65 + 0.35 * Math.min(1, Math.max(0, (expiry - tick) / 90));
        this.pose.scale.setScalar(scale);
        this.pose.position.set(x, this.map.floor[r * this.map.w + c] + 0.85 + 0.08 * Math.sin(tick / 18 + id), y);
        // Small stable offsets separate the several rewards an elite can leave at one anchor.
        this.pose.position.x += 0.16 * Math.cos(id * 2.399963);
        this.pose.position.z += 0.16 * Math.sin(id * 2.399963);
        this.pose.quaternion.copy(camera.quaternion); this.pose.updateMatrix();
        const index = this.counts.get(kind)!; mesh.setMatrixAt(index, this.pose.matrix); this.counts.set(kind, index + 1);
        if (kind === HEAL_MOTE) {
          // Keep the healing glow in front of its sprite, never coplanar with it.
          this.pose.translateZ(0.02); this.pose.updateMatrix();
          this.glows.setMatrixAt(glowCount, this.pose.matrix);
          this.glowColor.setHex(0x44ff88);
          this.glows.setColorAt(glowCount++, this.glowColor);
        }
      }
    }
    for (const [kind, mesh] of this.meshes) { mesh.count = this.counts.get(kind)!; mesh.instanceMatrix.needsUpdate = true; }
    this.glows.count = glowCount; this.glows.instanceMatrix.needsUpdate = true;
    if (this.glows.instanceColor) this.glows.instanceColor.needsUpdate = true;
  }
  dispose(): void {
    for (const mesh of this.meshes.values()) {
      mesh.geometry.dispose(); const material = mesh.material as THREE.MeshBasicMaterial;
      if (material.map !== this.atlas.texture) material.map?.dispose(); material.dispose();
    }
    this.group.clear();
    this.glows.geometry.dispose(); (this.glows.material as THREE.Material).dispose(); this.glows.dispose();
  }
}
