/** Three reusable ground tells; every radius/phase comes from an accepted cast deadline. */
import * as THREE from 'three';
import { DOMINION_CAST_CAP, DOMINION_RADIUS, type DominionCast } from '../data/dominion';

export type DominionRing = DominionCast & { x: number; y: number; z: number };
export class DominionView {
  readonly group = new THREE.Group();
  private readonly rim = new THREE.RingGeometry(DOMINION_RADIUS - 0.09, DOMINION_RADIUS, 64);
  private readonly disk = new THREE.CircleGeometry(DOMINION_RADIUS, 64);
  private readonly rimMat = new THREE.MeshBasicMaterial({ color: 0xffda65, transparent: true, opacity: 0.9, depthWrite: false, side: THREE.DoubleSide });
  private readonly fillMat = new THREE.MeshBasicMaterial({ color: 0xf5a52c, transparent: true, opacity: 0.23, depthWrite: false, side: THREE.DoubleSide });
  private readonly tells = Array.from({ length: DOMINION_CAST_CAP }, () => {
    const g = new THREE.Group(), rim = new THREE.Mesh(this.rim, this.rimMat), fill = new THREE.Mesh(this.disk, this.fillMat);
    rim.rotation.x = fill.rotation.x = -Math.PI / 2; g.add(rim, fill); this.group.add(g);
    g.visible = false; return { g, fill };
  });
  update(rings: readonly DominionRing[], tick: number): void {
    for (let i = 0; i < this.tells.length; i++) {
      const { g, fill } = this.tells[i], c = rings[i]; g.visible = !!c;
      if (!c) continue;
      g.position.set(c.x, c.z + 0.055, c.y);
      const progress = Math.max(0.01, Math.min(1, (tick - c.startTick) / (c.impactTick - c.startTick)));
      fill.scale.setScalar(progress);
    }
  }
  dispose(): void { this.group.removeFromParent(); this.rim.dispose(); this.disk.dispose(); this.rimMat.dispose(); this.fillMat.dispose(); }
}
