/**
 * Ability VFX and tracers built in code from simple geometry: rings, spheres and lines (§10, §11.1).
 * Positions are simulation coordinates (z up).
 */
import * as THREE from 'three';

interface Effect {
  obj: THREE.Object3D;
  material: THREE.Material & { opacity: number };
  start: number;
  duration: number;
  /** Called every frame with progress 0..1. */
  update: (f: number) => void;
}

const ringGeo = new THREE.RingGeometry(0.85, 1, 48);
ringGeo.rotateX(-Math.PI / 2);
const sphereGeo = new THREE.SphereGeometry(1, 20, 12);

export class Vfx {
  readonly group = new THREE.Group();
  private readonly effects: Effect[] = [];

  private add(obj: THREE.Object3D, material: THREE.Material & { opacity: number }, now: number, delay: number, duration: number, update: (f: number) => void): void {
    obj.visible = delay <= 0;
    this.group.add(obj);
    this.effects.push({ obj, material, start: now + delay, duration, update });
  }

  /** A flat ring on the ground at (x, y, z), growing from r0 to r1 and fading. */
  ring(now: number, x: number, y: number, z: number, color: number, r0: number, r1: number, duration: number, delay = 0): void {
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    const mesh = new THREE.Mesh(ringGeo, material);
    mesh.position.set(x, z + 0.05, y);
    this.add(mesh, material, now, delay, duration, (f) => {
      const r = r0 + (r1 - r0) * f;
      mesh.scale.set(r, 1, r);
      material.opacity = 0.85 * (1 - f);
    });
  }

  /** A translucent sphere at (x, y, z), from radius r0 to r1, fading. */
  sphere(now: number, x: number, y: number, z: number, color: number, r0: number, r1: number, duration: number, opacity = 0.45): void {
    // Both sides, so a bubble around the camera (a shield on yourself) is visible from inside.
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(sphereGeo, material);
    mesh.position.set(x, z, y);
    this.add(mesh, material, now, 0, duration, (f) => {
      const r = r0 + (r1 - r0) * f;
      mesh.scale.setScalar(r);
      material.opacity = opacity * (1 - f);
    });
  }

  /** Line segments between pairs of points, fading. */
  lines(now: number, points: Array<[number, number, number]>, color: number, duration: number): void {
    const pos = new Float32Array(points.length * 3);
    points.forEach(([x, y, z], i) => pos.set([x, z, y], i * 3));
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const material = new THREE.LineBasicMaterial({ color, transparent: true, depthWrite: false, fog: false });
    const seg = new THREE.LineSegments(geo, material);
    seg.frustumCulled = false;
    this.add(seg, material, now, 0, duration, (f) => {
      material.opacity = 1 - f;
    });
  }

  update(now: number): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      const f = (now - e.start) / e.duration;
      if (f < 0) continue;
      if (f >= 1) {
        this.group.remove(e.obj);
        e.material.dispose();
        if (e.obj instanceof THREE.LineSegments) e.obj.geometry.dispose();
        this.effects.splice(i, 1);
        continue;
      }
      e.obj.visible = true;
      e.update(f);
    }
  }
}
