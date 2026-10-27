import * as THREE from 'three';
import { SPAWN_WARNING_CAP, type SpawnWarning } from '../data/spawns';

/** Bounded accepted ground beams; catch-up uses the remaining one-second deadline. */
export class SpawnView {
  readonly group = new THREE.Group();
  private readonly beam = new THREE.CylinderGeometry(0.18, 0.45, 3, 8, 1, true);
  private readonly disk = new THREE.CircleGeometry(0.7, 24);
  private readonly material = new THREE.MeshBasicMaterial({ color: 0xffedaa, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });
  private readonly tells = Array.from({ length: SPAWN_WARNING_CAP }, () => {
    const g = new THREE.Group(), b = new THREE.Mesh(this.beam, this.material), d = new THREE.Mesh(this.disk, this.material);
    b.position.y = 1.5; d.rotation.x = -Math.PI / 2; g.add(b, d); g.visible = false; this.group.add(g); return { g, d };
  });
  update(warnings: readonly SpawnWarning[], tick: number): void {
    for (let i = 0; i < this.tells.length; i++) {
      const { g, d } = this.tells[i], w = warnings[i]; g.visible = !!w;
      if (!w) continue;
      g.position.set(w.x, w.z + 0.05, w.y);
      d.scale.setScalar(Math.max(0.05, Math.min(1, (tick - w.startTick) / (w.readyTick - w.startTick))));
    }
  }
  dispose(): void { this.group.removeFromParent(); this.beam.dispose(); this.disk.dispose(); this.material.dispose(); }
}
