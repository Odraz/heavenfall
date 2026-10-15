/** Three reusable ground tells; every radius/phase comes from an accepted cast deadline. */
import * as THREE from 'three';
import { DOMINION_CAST_CAP, DOMINION_RADIUS, type DominionCast } from '../data/dominion';

/** The tallest the warning wall grows, just before impact (audit batch 3). */
export const WALL_MAX_HEIGHT = 3;

/**
 * The rising golden wall at the ring's edge (audit batch 3): low and faint when the tell starts, tall
 * and bright just before impact, so the danger's edge shows above a crowd. Gold is Heaven's color
 * for every hurting spell; danger rises from the ground, rewards come down from the sky.
 */
export function dominionWall(progress: number): { height: number; opacity: number } {
  const p = Math.max(0, Math.min(1, progress));
  return { height: 0.25 + (WALL_MAX_HEIGHT - 0.25) * p ** 1.3, opacity: 0.4 + 0.5 * p };
}

/** A 1 × 32 alpha ramp, opaque at the floor and gone at the top; no canvas, so it builds in tests too. */
function fadeUp(): THREE.DataTexture {
  const data = new Uint8Array(32 * 4);
  for (let i = 0; i < 32; i++) data.fill(Math.round(255 * (1 - i / 31) ** 1.6), i * 4, i * 4 + 4);
  const texture = new THREE.DataTexture(data, 1, 32);
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return texture;
}

export type DominionRing = DominionCast & { x: number; y: number; z: number };
export class DominionView {
  readonly group = new THREE.Group();
  private readonly rim = new THREE.RingGeometry(DOMINION_RADIUS - 0.09, DOMINION_RADIUS, 64);
  private readonly disk = new THREE.CircleGeometry(DOMINION_RADIUS, 64);
  private readonly wall = new THREE.CylinderGeometry(DOMINION_RADIUS, DOMINION_RADIUS, 1, 64, 1, true).translate(0, 0.5, 0);
  private readonly edge = new THREE.RingGeometry(DOMINION_RADIUS - 0.05, DOMINION_RADIUS + 0.05, 64);
  private readonly fade = fadeUp();
  private readonly rimMat = new THREE.MeshBasicMaterial({ color: 0xffda65, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  private readonly fillMat = new THREE.MeshBasicMaterial({ color: 0xf5a52c, transparent: true, opacity: 0.23, depthWrite: false, side: THREE.DoubleSide });
  private readonly tells = Array.from({ length: DOMINION_CAST_CAP }, () => {
    const g = new THREE.Group(), rim = new THREE.Mesh(this.rim, this.rimMat), fill = new THREE.Mesh(this.disk, this.fillMat);
    const wallMat = new THREE.MeshBasicMaterial({ color: 0xffd36a, alphaMap: this.fade, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const wall = new THREE.Mesh(this.wall, wallMat), edge = new THREE.Mesh(this.edge, edgeMat);
    wall.name = 'dominion-wall';
    rim.rotation.x = fill.rotation.x = edge.rotation.x = -Math.PI / 2; g.add(rim, fill, wall, edge); this.group.add(g);
    g.visible = false; return { g, fill, wall, wallMat, edge, edgeMat };
  });
  update(rings: readonly DominionRing[], tick: number): void {
    for (let i = 0; i < this.tells.length; i++) {
      const { g, fill, wall, wallMat, edge, edgeMat } = this.tells[i], c = rings[i]; g.visible = !!c;
      if (!c) continue;
      g.position.set(c.x, c.z + 0.055, c.y);
      const progress = Math.max(0.01, Math.min(1, (tick - c.startTick) / (c.impactTick - c.startTick)));
      fill.scale.setScalar(progress);
      const w = dominionWall(progress);
      wall.scale.y = w.height; wallMat.opacity = w.opacity;
      edge.position.y = w.height; edgeMat.opacity = Math.min(1, w.opacity + 0.1);
    }
  }
  dispose(): void {
    this.group.removeFromParent(); this.rim.dispose(); this.disk.dispose(); this.wall.dispose(); this.edge.dispose(); this.fade.dispose();
    this.rimMat.dispose(); this.fillMat.dispose();
    for (const t of this.tells) { t.wallMat.dispose(); t.edgeMat.dispose(); }
  }
}
