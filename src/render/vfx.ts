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
/** Sacrament's beam (M9 §5.1): the existing heal green, 0.15 m wide. */
export const HEAL_GREEN = 0x5ee65e;
const LIVE_BEAM_WIDTH = 0.15;
/** The Scourge's arc (M9 §5.1). */
const SCOURGE_ARC_RADIUS = 3;
const SCOURGE_ARC_HALF = Math.PI / 3;
const SCOURGE_ARC_HEIGHT = 1.2;
const SCOURGE_ARC_SEGMENTS = 16;
const SCOURGE_SWEEP_MS = 120;
const SCOURGE_FADE_MS = 150;
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
/**
 * A 1 × 1 m strip standing on its bottom edge, with the beam texture running up it: scaled to a
 * vertical beam's width and height, and turned around the vertical axis to face the camera.
 */
const columnGeo = new THREE.PlaneGeometry(1, 1);
columnGeo.rotateZ(Math.PI / 2);
columnGeo.translate(0, 0.5, 0);

/** Line segments drawn as strips that face the camera, the texture repeating along each one. */
class Ribbon {
  readonly mesh: THREE.Mesh;
  /** Segment endpoints in three.js coordinates, two per segment. */
  private readonly ends: THREE.Vector3[];
  private readonly pos: THREE.BufferAttribute;
  private readonly d = new THREE.Vector3();
  private readonly side = new THREE.Vector3();
  private readonly toCam = new THREE.Vector3();

  private readonly uv: THREE.BufferAttribute;

  constructor(
    points: Array<[number, number, number]>,
    private readonly width: number,
    material: THREE.Material,
    private readonly tileLength: number,
  ) {
    this.ends = points.map(([x, y, z]) => new THREE.Vector3(x, z, y));
    const n = this.ends.length / 2;
    const index: number[] = [];
    for (let i = 0; i < n; i++) index.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(n * 12), 3);
    this.uv = new THREE.BufferAttribute(new Float32Array(n * 8), 2);
    geo.setAttribute('position', this.pos);
    geo.setAttribute('uv', this.uv);
    geo.setIndex(index);
    this.setUv();
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.frustumCulled = false;
  }

  private setUv(): void {
    const uv = this.uv.array as Float32Array;
    for (let i = 0; i < this.ends.length / 2; i++) {
      const u = this.ends[i * 2].distanceTo(this.ends[i * 2 + 1]) / this.tileLength;
      uv.set([0, 0, u, 0, u, 1, 0, 1], i * 8);
    }
    this.uv.needsUpdate = true;
  }

  /** Moves the segments' ends (the same number of points as at construction). */
  setPoints(points: ReadonlyArray<readonly [number, number, number]>): void {
    points.forEach(([x, y, z], i) => this.ends[i].set(x, z, y));
    this.setUv();
  }

  /** Draws only the first `n` segments. */
  showSegments(n: number): void {
    this.mesh.geometry.setDrawRange(0, n * 6);
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
  /** Soul tethers (M8 §4.1), reused frame to frame. */
  private readonly tethers: THREE.Mesh[] = [];
  private readonly tetherMaterial: THREE.MeshBasicMaterial;
  /** Vertical beams turn to the camera every frame. */
  private readonly columns = new Set<THREE.Mesh>();
  /** Sacrament's beams (M9 §5.1), reused frame to frame. */
  private readonly liveBeams: Ribbon[] = [];
  private readonly liveBeamMaterial: THREE.MeshBasicMaterial;

  constructor(private readonly tex: EffectTextures) {
    this.tetherMaterial = this.material(tex.beam, 0xff7a3a);
    this.tetherMaterial.opacity = 0.55;
    this.liveBeamMaterial = this.material(tex.beam, HEAL_GREEN);
  }

  /**
   * Sacrament's beams (M9 §5.1): green, 0.15 m wide, from each healer to its ally, while healing.
   * Each entry is [from, to]; beams not listed are hidden.
   */
  setLiveBeams(list: ReadonlyArray<readonly [readonly [number, number, number], readonly [number, number, number]]>, camera: THREE.Vector3): void {
    while (this.liveBeams.length < list.length) {
      const r = new Ribbon([[0, 0, 0], [0, 0, 1]], LIVE_BEAM_WIDTH, this.liveBeamMaterial, BEAM_TILE);
      this.liveBeams.push(r);
      this.group.add(r.mesh);
    }
    this.liveBeams.forEach((r, i) => {
      const b = list[i];
      r.mesh.visible = !!b;
      if (!b) return;
      r.setPoints(b);
      r.face(camera);
    });
  }

  /**
   * The Scourge's chain arc (M9 §5.1): the chain texture along a 120° arc of 3 m radius at 1.2 m above
   * the feet (x, y, z), centered on `yaw`, swept from left to right over 0.12 s, then fading over 0.15 s.
   */
  scourgeArc(now: number, x: number, y: number, z: number, yaw: number): void {
    const pts: Array<[number, number, number]> = [];
    const h = z + SCOURGE_ARC_HEIGHT;
    // Left is yaw − 90° (wasdDirection), so the sweep runs from yaw − 60° to yaw + 60°.
    for (let i = 0; i < SCOURGE_ARC_SEGMENTS; i++) {
      for (const k of [i, i + 1]) {
        const a = yaw - SCOURGE_ARC_HALF + (2 * SCOURGE_ARC_HALF * k) / SCOURGE_ARC_SEGMENTS;
        pts.push([x + Math.cos(a) * SCOURGE_ARC_RADIUS, y + Math.sin(a) * SCOURGE_ARC_RADIUS, h]);
      }
    }
    const img = this.tex.chain.image as { width: number; height: number };
    const width = 0.3;
    const ribbon = new Ribbon(pts, width, this.material(this.tex.chain, 0xffffff), (width * img.width) / img.height);
    const material = ribbon.mesh.material as THREE.MeshBasicMaterial;
    const total = SCOURGE_SWEEP_MS + SCOURGE_FADE_MS;
    const update = (f: number): void => {
      const t = f * total;
      ribbon.showSegments(Math.max(1, Math.ceil(Math.min(1, t / SCOURGE_SWEEP_MS) * SCOURGE_ARC_SEGMENTS)));
      material.opacity = t < SCOURGE_SWEEP_MS ? 1 : 1 - (t - SCOURGE_SWEEP_MS) / SCOURGE_FADE_MS;
    };
    this.add({ obj: ribbon.mesh, material, duration: total, update, ribbon }, now, 0);
  }

  /** A vertical beam mesh, `width` wide, from z up by `height` (three.js placement is set here). */
  private column(material: THREE.Material, x: number, y: number, z: number, width: number, height: number): THREE.Mesh {
    const mesh = new THREE.Mesh(columnGeo, material);
    mesh.position.set(x, z, y);
    mesh.scale.set(width, Math.max(1e-3, height), 1);
    mesh.frustumCulled = false;
    this.columns.add(mesh);
    return mesh;
  }

  /** The faint ember tethers from each soul's ground point up to its base: [x, y, ground z, base z]. */
  setTethers(list: ReadonlyArray<[number, number, number, number]>): void {
    while (this.tethers.length < list.length) {
      const m = this.column(this.tetherMaterial, 0, 0, 0, 0.1, 1);
      this.tethers.push(m);
      this.group.add(m);
    }
    this.tethers.forEach((m, i) => {
      const t = list[i];
      m.visible = !!t && t[3] - t[2] > 0.02;
      if (!t) return;
      m.position.set(t[0], t[2], t[1]);
      m.scale.set(0.1, Math.max(1e-3, t[3] - t[2]), 1);
    });
  }

  /** The revive pillar (M8 §3.1): an ember beam 1.2 m wide and 8 m tall where the player rises, fading over 1 s. */
  pillar(now: number, x: number, y: number, z: number): void {
    const material = this.material(this.tex.beam, 0xff7a3a);
    const mesh = this.column(material, x, y, z, 1.2, 8);
    this.add({ obj: mesh, material, duration: 1000, update: (f) => (material.opacity = 1 - f) }, now, 0);
  }

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

  /** Beams of light between pairs of points (tracers), `width` meters wide, fading. */
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
    for (const c of this.columns) c.rotation.y = Math.atan2(camera.x - c.position.x, camera.z - c.position.z);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      const f = (now - e.start) / e.duration;
      if (f < 0) continue;
      if (f >= 1) {
        this.columns.delete(e.obj as THREE.Mesh);
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
