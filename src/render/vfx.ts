/**
 * Ability VFX and tracers built in code from simple geometry, textured with the effect textures
 * (§10, §11.1): ground rings, camera-facing beams and chains, glow and smoke sprites, and spheres.
 * Positions are simulation coordinates (z up).
 */
import * as THREE from 'three';
import type { EffectTextures } from './textures';

/** The ring texture's bright line, as a fraction of the texture's half-width. */
const RING_RADIUS = 0.71;
/** Meters of beam per repeat of its texture. */
const BEAM_TILE = 3;
/** Smoke puffs in the Discord burst's ring. */
const SMOKE_PUFFS = 12;
/** A mote's trail: this many sprites, each lagging the one before by this fraction of the flight. */
const MOTE_TRAIL = 4;
const MOTE_TRAIL_LAG = 0.08;

interface Effect {
  obj: THREE.Object3D;
  material: THREE.Material & { opacity: number };
  start: number;
  duration: number;
  /** Called every frame with progress 0..1. */
  update: (f: number) => void;
  /** Beams and chains turn to the camera every frame; their geometry is their own. */
  ribbon?: Ribbon;
}

/** A flat 2 × 2 m square on the ground, so its scale is its half-size. */
const groundGeo = new THREE.PlaneGeometry(2, 2);
groundGeo.rotateX(-Math.PI / 2);
const sphereGeo = new THREE.SphereGeometry(1, 20, 12);

/** Line segments drawn as strips that face the camera, the texture repeating along each one. */
class Ribbon {
  readonly mesh: THREE.Mesh;
  /** Segment endpoints in three.js coordinates, two per segment. */
  private readonly ends: THREE.Vector3[];
  private readonly pos: THREE.BufferAttribute;
  private readonly d = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly toCam = new THREE.Vector3();

  constructor(
    points: Array<[number, number, number]>,
    private readonly width: number,
    material: THREE.Material,
    tileLength: number,
  ) {
    this.ends = points.map(([x, y, z]) => new THREE.Vector3(x, z, y));
    const n = this.ends.length / 2;
    const uv = new Float32Array(n * 8);
    const index: number[] = [];
    for (let i = 0; i < n; i++) {
      const u = this.ends[i * 2].distanceTo(this.ends[i * 2 + 1]) / tileLength;
      uv.set([0, 0, u, 0, u, 1, 0, 1], i * 8);
      index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    }
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(n * 12), 3);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(index);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
  }

  /** Turns each strip around its own line toward the camera. */
  face(camera: THREE.Vector3): void {
    const p = this.pos.array as Float32Array;
    for (let i = 0; i < this.ends.length / 2; i++) {
      const a = this.ends[i * 2];
      const b = this.ends[i * 2 + 1];
      this.d.subVectors(b, a);
      this.toCam.addVectors(a, b).multiplyScalar(0.5).sub(camera).negate();
      this.side.crossVectors(this.d, this.toCam);
      const len = this.side.length();
      if (len > 1e-6) this.side.multiplyScalar(this.width / 2 / len);
      p.set([a.x - this.side.x, a.y - this.side.y, a.z - this.side.z, b.x - this.side.x, b.y - this.side.y, b.z - this.side.z], i * 12);
      p.set([b.x + this.side.x, b.y + this.side.y, b.z + this.side.z, a.x + this.side.x, a.y + this.side.y, a.z + this.side.z], i * 12 + 6);
    }
    this.pos.needsUpdate = true;
  }
}

export class Vfx {
  readonly group = new THREE.Group();
  private readonly effects: Effect[] = [];

  constructor(private readonly tex: EffectTextures) {}

  private material(map: THREE.Texture, color: number): THREE.MeshBasicMaterial {
    return new THREE.MeshBasicMaterial({ map, color, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
  }

  private add(effect: Omit<Effect, 'start'>, now: number, delay: number): void {
    effect.obj.visible = delay <= 0;
    this.group.add(effect.obj);
    this.effects.push({ ...effect, start: now + delay });
  }

  /** A flat ring on the ground at (x, y, z), growing from r0 to r1 and fading. */
  ring(now: number, x: number, y: number, z: number, color: number, r0: number, r1: number, duration: number, delay = 0): void {
    const material = this.material(this.tex.ring, color);
    const mesh = new THREE.Mesh(groundGeo, material);
    mesh.position.set(x, z + 0.05, y);
    const update = (f: number): void => {
      const s = (r0 + (r1 - r0) * f) / RING_RADIUS;
      mesh.scale.set(s, 1, s);
      material.opacity = 1 - f;
    };
    this.add({ obj: mesh, material, duration, update }, now, delay);
  }

  /** A soft round glow facing the camera at (x, y, z), from radius r0 to r1, fading. */
  glow(now: number, x: number, y: number, z: number, color: number, r0: number, r1: number, duration: number, delay = 0): void {
    const material = new THREE.SpriteMaterial({ map: this.tex.glow, color, transparent: true, depthWrite: false, fog: false });
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, z, y);
    const update = (f: number): void => {
      sprite.scale.setScalar(2 * (r0 + (r1 - r0) * f));
      material.opacity = 1 - f;
    };
    this.add({ obj: sprite, material, duration, update }, now, delay);
  }

  /** A translucent sphere at (x, y, z), from radius r0 to r1, fading from `opacity` to 0. */
  sphere(now: number, x: number, y: number, z: number, color: number, r0: number, r1: number, duration: number, opacity = 0.45, delay = 0): void {
    // Both sides, so a bubble around the camera (a shield on yourself) is visible from inside.
    const material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, fog: false, side: THREE.DoubleSide });
    const mesh = new THREE.Mesh(sphereGeo, material);
    mesh.position.set(x, z, y);
    const update = (f: number): void => {
      mesh.scale.setScalar(r0 + (r1 - r0) * f);
      material.opacity = opacity * (1 - f);
    };
    this.add({ obj: mesh, material, duration, update }, now, delay);
  }

  /**
   * A mote (M8 §3.1): a glowing sprite `size` meters across with a short trail, flying from `from`
   * to `to` over `duration`.
   */
  mote(now: number, from: [number, number, number], to: [number, number, number], color: number, size: number, duration: number): void {
    const material = new THREE.SpriteMaterial({ map: this.tex.glow, color, transparent: true, depthWrite: false, fog: false });
    const group = new THREE.Group();
    // The head and its trail: each trail sprite lags behind and is smaller.
    const sprites = Array.from({ length: MOTE_TRAIL + 1 }, () => new THREE.Sprite(material));
    for (const sp of sprites) group.add(sp);
    const update = (f: number): void => {
      sprites.forEach((sp, i) => {
        const g = Math.max(0, f - i * MOTE_TRAIL_LAG);
        sp.position.set(from[0] + (to[0] - from[0]) * g, from[2] + (to[2] - from[2]) * g, from[1] + (to[1] - from[1]) * g);
        sp.scale.setScalar(size * (1 - i / (MOTE_TRAIL + 1)) * (i === 0 ? 1.6 : 1.2));
      });
    };
    this.add({ obj: group, material, duration, update }, now, 0);
  }

  /** A ring of smoke puffs facing the camera around (x, y, z), spreading from radius r0 to r1, turning and fading. */
  smoke(now: number, x: number, y: number, z: number, color: number, r0: number, r1: number, duration: number): void {
    const material = new THREE.SpriteMaterial({ map: this.tex.smoke, color, transparent: true, depthWrite: false, fog: false });
    const group = new THREE.Group();
    group.position.set(x, z, y);
    const puffs = Array.from({ length: SMOKE_PUFFS }, () => new THREE.Sprite(material));
    for (const p of puffs) group.add(p);
    const update = (f: number): void => {
      const r = r0 + (r1 - r0) * f;
      const size = 2 + 3 * f;
      puffs.forEach((p, i) => {
        const a = (i / SMOKE_PUFFS) * Math.PI * 2 + f;
        p.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
        // Every other puff mirrored, so they don't all look the same.
        p.scale.set(i % 2 ? -size : size, size, 1);
      });
      material.rotation = f * 1.5;
      material.opacity = 0.9 * (1 - f);
    };
    this.add({ obj: group, material, duration, update }, now, 0);
  }

  /** Beams of light between pairs of points (tracers, the mark beam), `width` meters wide, fading. */
  beam(now: number, points: Array<[number, number, number]>, color: number, width: number, duration: number): void {
    this.addRibbon(new Ribbon(points, width, this.material(this.tex.beam, color), BEAM_TILE), now, duration);
  }

  /** Red-hot chains between pairs of points, `width` meters wide, fading. */
  chain(now: number, points: Array<[number, number, number]>, width: number, duration: number): void {
    const img = this.tex.chain.image as { width: number; height: number };
    const tile = (width * img.width) / img.height;
    this.addRibbon(new Ribbon(points, width, this.material(this.tex.chain, 0xffffff), tile), now, duration);
  }

  private addRibbon(ribbon: Ribbon, now: number, duration: number): void {
    const material = ribbon.mesh.material as THREE.MeshBasicMaterial;
    this.add({ obj: ribbon.mesh, material, duration, update: (f) => (material.opacity = 1 - f), ribbon }, now, 0);
  }

  /** `camera` is the camera's position in three.js coordinates. */
  update(now: number, camera: THREE.Vector3): void {
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      const f = (now - e.start) / e.duration;
      if (f < 0) continue;
      if (f >= 1) {
        this.group.remove(e.obj);
        e.material.dispose();
        e.ribbon?.mesh.geometry.dispose();
        this.effects.splice(i, 1);
        continue;
      }
      e.obj.visible = true;
      e.ribbon?.face(camera);
      e.update(f);
    }
  }
}
