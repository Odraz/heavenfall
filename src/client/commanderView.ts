import * as THREE from 'three';
import { COMMANDER_RECORD_CAP, type CommanderCast } from '../data/commanders';
import type { GameMap } from '../sim/map';
import { beamSegment } from '../sim/commanders';
import { Ribbon } from '../render/vfx';

/** Reusable meshes: host yaw/pitch drive the ray; local geometry only clips its visible length. */
export class CommanderView {
  readonly group = new THREE.Group();
  private readonly cylinder = new THREE.CylinderGeometry(1, 1, 1, 12);
  private readonly ring = new THREE.RingGeometry(1.9, 2, 48);
  private readonly cloth = new THREE.PlaneGeometry(0.7, 1.1);
  private readonly gold = new THREE.MeshBasicMaterial({ color: 0xffdf88, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  private readonly white = new THREE.MeshBasicMaterial({ color: 0xfffaf1, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  private readonly beamGold: THREE.MeshBasicMaterial;
  private readonly beamCore: THREE.MeshBasicMaterial;
  private readonly up = new THREE.Vector3(0, 1, 0);
  private readonly direction = new THREE.Vector3();
  private readonly pool;
  constructor(beamTexture: THREE.Texture) {
    // Share Sacrament's textured, camera-facing beam language, with gold rather than healing green.
    this.beamGold = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xffc547, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.beamCore = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xfffaf1, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.pool = Array.from({ length: COMMANDER_RECORD_CAP }, () => {
      const beam = new THREE.Mesh(this.cylinder, this.gold), marker = new THREE.Mesh(this.cloth, this.white), ring = new THREE.Mesh(this.ring, this.gold);
      const ray = new Ribbon([[0, 0, 0], [0, 0, 1]], 1, this.beamGold, 3), core = new Ribbon([[0, 0, 0], [0, 0, 1]], 0.22, this.beamCore, 3);
      ray.mesh.name = 'cantor-beam'; core.mesh.name = 'cantor-beam-core';
      ring.rotation.x = -Math.PI / 2;
      this.group.add(beam, marker, ring, ray.mesh, core.mesh); return { beam, marker, ring, ray, core };
    });
  }
  update(casts: readonly CommanderCast[], map: GameMap, tick: number, camera: THREE.Vector3): void {
    for (let i = 0; i < this.pool.length; i++) {
      const v = this.pool[i], c = casts[i]; v.beam.visible = v.marker.visible = v.ring.visible = v.ray.mesh.visible = v.core.mesh.visible = false;
      if (!c || c.phase === 'idle' || c.phase === 'recover') continue;
      if (c.kind === 'beam') {
        const b = beamSegment(map, c);
        const progress = Math.max(0, Math.min(1, (tick - c.phaseTick) / Math.max(1, c.endTick - c.phaseTick)));
        const points: Array<[number, number, number]> = [[b.x, b.y, b.z], [b.x + b.dx * b.length, b.y + b.dy * b.length, b.z + b.dz * b.length]];
        // Warning stays slender throughout. Only the accepted active phase snaps to the full
        // one-metre damage width and adds the bright core; client time never starts damage early.
        v.ray.width = c.phase === 'tell' ? 0.04 + 0.12 * progress : 1;
        v.ray.mesh.visible = b.length > 1e-6; v.ray.setPoints(points); v.ray.face(camera);
        if (c.phase === 'active') { v.core.mesh.visible = v.ray.mesh.visible; v.core.setPoints(points); v.core.face(camera); }
      } else {
        if (c.phase === 'tell' || c.phase === 'active') {
          const floor = map.floor[Math.floor(c.y) * map.w + Math.floor(c.x)];
          this.segment(v.beam, c.x, c.y, floor + 0.08, c.targetX, c.targetY, c.targetZ + 0.08, 0.07);
          v.marker.visible = true; v.marker.position.set(c.targetX, c.targetZ + 2.6, c.targetY); v.marker.rotation.y = -c.yaw;
        }
        if (c.phase !== 'tell') {
          v.ring.visible = true; v.ring.position.set(c.dropX, map.floor[Math.floor(c.dropY) * map.w + Math.floor(c.dropX)] + 0.06, c.dropY);
        }
        if (c.phase === 'carry') { v.marker.visible = true; v.marker.position.set(c.x, c.z - 0.8, c.y); v.marker.scale.set(1.8, 2, 1); }
        else v.marker.scale.setScalar(1);
      }
    }
  }
  private segment(mesh: THREE.Mesh, x: number, y: number, z: number, ex: number, ey: number, ez: number, radius: number): void {
    this.direction.set(ex - x, ez - z, ey - y); const length = this.direction.length();
    mesh.visible = length > 1e-6; mesh.position.set((x + ex) / 2, (z + ez) / 2, (y + ey) / 2);
    mesh.scale.set(radius, length, radius); if (length > 1e-6) mesh.quaternion.setFromUnitVectors(this.up, this.direction.normalize());
  }
  dispose(): void {
    this.group.removeFromParent();
    for (const v of this.pool) { v.ray.mesh.geometry.dispose(); v.core.mesh.geometry.dispose(); }
    this.cylinder.dispose(); this.ring.dispose(); this.cloth.dispose(); this.gold.dispose(); this.white.dispose(); this.beamGold.dispose(); this.beamCore.dispose();
  }
}
