import * as THREE from 'three';
import { COMMANDER_RECORD_CAP, type CommanderCast } from '../data/commanders';
import type { GameMap } from '../sim/map';
import { beamSegment } from '../sim/commanders';
import { Ribbon } from '../render/vfx';

/** Reusable meshes: host yaw/pitch drive the ray; local geometry only clips its visible length. */
export class CommanderView {
  readonly group = new THREE.Group();
  private readonly ring = new THREE.RingGeometry(1.9, 2, 48);
  private readonly cloth = new THREE.PlaneGeometry(0.7, 1.1);
  private readonly wardGeometry = new THREE.CylinderGeometry(1.2, 1.2, 2.4, 24, 1, true, 0, Math.PI * 2 / 3);
  private readonly wardMaterial = new THREE.MeshBasicMaterial({ color: 0xffd56c, transparent: true, opacity: 0.28, depthWrite: false, side: THREE.DoubleSide });
  private readonly gold = new THREE.MeshBasicMaterial({ color: 0xffdf88, transparent: true, opacity: 0.72, depthWrite: false, side: THREE.DoubleSide });
  private readonly white = new THREE.MeshBasicMaterial({ color: 0xfffaf1, transparent: true, opacity: 0.85, depthWrite: false, side: THREE.DoubleSide });
  private readonly beamGold: THREE.MeshBasicMaterial;
  private readonly beamCore: THREE.MeshBasicMaterial;
  private readonly beamGlow: THREE.MeshBasicMaterial;
  private readonly flareMat: THREE.SpriteMaterial;
  private readonly knotMat: THREE.SpriteMaterial;
  private readonly pool;
  /**
   * The damaging beam reads at play distance (audit batch 3): a wide soft glow around the 1 m gold
   * body, a white-hot core, flares at the open book and where the beam stops, and a bright knot that
   * runs along it on every damage pulse. Hits use the enemies' existing hurt flash.
   */
  constructor(beamTexture: THREE.Texture, glowTexture: THREE.Texture | null = null) {
    // Share Sacrament's textured, camera-facing beam language, with gold rather than healing green.
    this.beamGold = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xffc547, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.beamCore = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xfffaf1, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.beamGlow = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xffb43c, transparent: true, opacity: 0.32, depthWrite: false, side: THREE.DoubleSide, fog: false });
    this.flareMat = new THREE.SpriteMaterial({ map: glowTexture, color: 0xffe9a0, transparent: true, depthWrite: false, fog: false });
    this.knotMat = new THREE.SpriteMaterial({ map: glowTexture, color: 0xfffaf1, transparent: true, depthWrite: false, fog: false });
    this.pool = Array.from({ length: COMMANDER_RECORD_CAP }, () => {
      const marker = new THREE.Mesh(this.cloth, this.white), ring = new THREE.Mesh(this.ring, this.gold);
      const ray = new Ribbon([[0, 0, 0], [0, 0, 1]], 1, this.beamGold, 3), core = new Ribbon([[0, 0, 0], [0, 0, 1]], 0.38, this.beamCore, 3);
      const glow = new Ribbon([[0, 0, 0], [0, 0, 1]], 2.6, this.beamGlow, 3);
      ray.mesh.name = 'cantor-beam'; core.mesh.name = 'cantor-beam-core'; glow.mesh.name = 'cantor-beam-glow';
      const origin = new THREE.Sprite(this.flareMat), impact = new THREE.Sprite(this.flareMat), knot = new THREE.Sprite(this.knotMat);
      origin.name = 'cantor-beam-origin'; impact.name = 'cantor-beam-impact'; knot.name = 'cantor-beam-knot';
      origin.scale.setScalar(2.4); impact.scale.setScalar(2.8); knot.scale.setScalar(1.5);
      ring.rotation.x = -Math.PI / 2;
      const ward = new THREE.Mesh(this.wardGeometry, this.wardMaterial); ward.name = 'cantor-frontal-ward';
      this.group.add(marker, ring, glow.mesh, ray.mesh, core.mesh, ward, origin, impact, knot); return { marker, ring, ray, core, glow, ward, origin, impact, knot };
    });
  }
  update(casts: readonly CommanderCast[], map: GameMap, tick: number, camera: THREE.Vector3): void {
    for (let i = 0; i < this.pool.length; i++) {
      const v = this.pool[i], c = casts[i]; v.ward.visible = v.marker.visible = v.ring.visible = v.ray.mesh.visible = v.core.mesh.visible = false;
      v.glow.mesh.visible = v.origin.visible = v.impact.visible = v.knot.visible = false;
      if (!c || c.phase === 'idle' || c.phase === 'recover') continue;
      if (c.kind === 'beam') {
        v.ward.visible = true; v.ward.position.set(c.x, c.z + 1.5, c.y);
        v.ward.rotation.y = Math.PI / 2 - c.yaw - Math.PI / 3;
        const b = beamSegment(map, c);
        const progress = Math.max(0, Math.min(1, (tick - c.phaseTick) / Math.max(1, c.endTick - c.phaseTick)));
        const points: Array<[number, number, number]> = [[b.x, b.y, b.z], [b.x + b.dx * b.length, b.y + b.dy * b.length, b.z + b.dz * b.length]];
        // Warning stays slender throughout. Only the accepted active phase snaps to the full
        // one-metre damage width and adds the bright core; client time never starts damage early.
        v.ray.width = c.phase === 'tell' ? 0.04 + 0.12 * progress : 1;
        v.ray.mesh.visible = b.length > 1e-6; v.ray.setPoints(points); v.ray.face(camera);
        if (c.phase === 'active') {
          // Each 10-tick damage pulse sends a bright knot from the book to the beam's end.
          const pulse = ((tick - c.phaseTick) % 10) / 10;
          v.core.width = 0.38 + 0.22 * (1 - pulse);
          v.core.mesh.visible = v.glow.mesh.visible = v.ray.mesh.visible; v.core.setPoints(points); v.core.face(camera);
          v.glow.setPoints(points); v.glow.face(camera);
          v.origin.visible = v.impact.visible = v.knot.visible = v.ray.mesh.visible;
          v.origin.position.set(b.x, b.z, b.y);
          v.impact.position.set(b.x + b.dx * b.length, b.z + b.dz * b.length, b.y + b.dy * b.length);
          v.knot.position.set(b.x + b.dx * b.length * pulse, b.z + b.dz * b.length * pulse, b.y + b.dy * b.length * pulse);
        }
      } else {
        if (c.phase === 'carry') {
          v.ring.visible = true; v.ring.position.set(c.dropX, map.floor[Math.floor(c.dropY) * map.w + Math.floor(c.dropX)] + 0.06, c.dropY);
        }
        if (c.phase === 'carry') { v.marker.visible = true; v.marker.position.set(c.x, c.z - 0.8, c.y); v.marker.scale.set(1.8, 2, 1); }
        else v.marker.scale.setScalar(1);
      }
    }
  }
  dispose(): void {
    this.group.removeFromParent();
    for (const v of this.pool) { v.ray.mesh.geometry.dispose(); v.core.mesh.geometry.dispose(); v.glow.mesh.geometry.dispose(); }
    this.beamGlow.dispose(); this.flareMat.dispose(); this.knotMat.dispose();
    this.ring.dispose(); this.cloth.dispose(); this.gold.dispose(); this.white.dispose(); this.beamGold.dispose(); this.beamCore.dispose();
    this.wardGeometry.dispose(); this.wardMaterial.dispose();
  }
}
