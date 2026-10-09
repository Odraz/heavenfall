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
/**
 * The spawn ray (M12 §2.4, changed at the human's request from a glow sprite): a soft golden ray of
 * light 3.2 m wide (at the floor) and 9 m tall standing on the point's floor, drawn by `rayShader`,
 * dropping in from above over 150 ms when the point starts flaring, holding for 1 s after its last
 * flare (so it stays steady while the point keeps spawning, even at a solo wave's pace of one enemy
 * per point every 0.6–0.7 s), then fading over 0.8 s.
 */
const SPAWN_GOLD = 0xffd27a;
const SPAWN_RAY_BODY = 0xffb43a;
const SPAWN_RAY_CORE = 0xfff0c8;
const SPAWN_RAY_WIDTH = 3.2;
const SPAWN_RAY_HEIGHT = 9;
const SPAWN_RAY_DROP_MS = 150;
const SPAWN_RAY_HOLD_MS = 1000;
const SPAWN_GLOW_FADE_MS = 800;
const SPAWN_RING_RADIUS = 1.6;
/** A flare draws a ground ring at most this often per point. */
const SPAWN_RING_GAP_MS = 400;
/**
 * Falling Star's preview (M12 §5.2): the arc 0.12 m wide at 80% opacity, and the landing's rings on the
 * floor, the crater (3.5 m) at 0.8 and the reach (6 m) at 0.4, gold-orange when valid, red when not.
 */
const STAR_VALID = 0xf08a24;
const STAR_INVALID = 0xd02020;
const STAR_ARC_WIDTH = 0.12;
const STAR_ARC_OPACITY = 0.8;
const STAR_RINGS: ReadonlyArray<readonly [number, number]> = [
  [3.5, 0.8],
  [6, 0.4],
];
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
  /** Called when it ends, for what the effect owns besides `material` (its own geometry, a second material). */
  dispose?: () => void;
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
/** A 1 × 1 m upright quad hanging from its top edge (uv y = 1 at the top): the spawn ray, scaled down from the sky. */
const shaftGeo = new THREE.PlaneGeometry(1, 1);
shaftGeo.translate(0, -0.5, 0);

/**
 * The spawn ray's look (M12 §2.4): no texture, so its edges are soft at any size. Across, solid in the
 * middle third, falling off smoothly to 0 at the edges, with a brighter core; a cone, narrower up in the sky; it fades into
 * the sky over its upper 45% and softly at the floor; faint streaks of light drift down it; and it
 * fades out as the camera comes within 6 m of it, so standing in one never blinds.
 */
const rayShader = {
  vertexShader: /* glsl */ `
    varying vec2 vUv;
    varying float vNear;
    void main() {
      vUv = uv;
      vNear = smoothstep(2.0, 6.0, distance(cameraPosition.xz, modelMatrix[3].xz));
      gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 body;
    uniform vec3 core;
    uniform float opacity;
    uniform float time;
    uniform float seed;
    varying vec2 vUv;
    varying float vNear;
    void main() {
      float v = vUv.y;
      float x = abs(vUv.x * 2.0 - 1.0) / mix(1.0, 0.65, v);
      if (x >= 1.0) discard;
      float glow = 1.0 - smoothstep(0.3, 1.0, x);
      float hot = exp(-x * x * 14.0);
      float fade = (1.0 - smoothstep(0.55, 1.0, v)) * smoothstep(0.0, 0.06, v);
      float streaks = 0.85 + 0.15 * sin(vUv.x * 23.0 + seed) * sin(v * 9.0 + time * 2.4 + seed);
      float a = min(1.0, 0.75 * glow + 0.3 * hot) * fade * streaks * opacity * vNear;
      gl_FragColor = vec4(mix(body, core, min(1.0, hot * 1.3)), a);
      #include <colorspace_fragment>
    }`,
};

/** The bound pile's chains (M12 follow-up §2.2). */
const CHAIN_CONE_COUNT = 6;
const CHAIN_CONE_TOP_R = 5;
const CHAIN_CONE_BOTTOM_R = 1.2;
const CHAIN_CONE_HEIGHT = 8;
const CHAIN_CONE_WIDTH = 0.22;
const CHAIN_CONE_MS = 1500;
const CHAIN_CONE_DROP_MS = 120;
const CHAIN_CONE_FADE_MS = 400;
const CHAIN_CONE_RING = 0xff5a1e;

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
  /**
   * The effects' materials, pooled by kind and texture when an effect ends, never disposed: disposing
   * the last material of a shader program deletes the program, and the next effect then compiled it
   * again, a frame of 100 ms or more (M12 §10, decisions.md).
   */
  private readonly pool = new Map<string, THREE.Material[]>();
  /** Soul tethers (M8 §4.1), reused frame to frame. */
  private readonly tethers: THREE.Mesh[] = [];
  private readonly tetherMaterial: THREE.MeshBasicMaterial;
  /** Vertical beams turn to the camera every frame. */
  private readonly columns = new Set<THREE.Mesh>();
  /** Sacrament's beams (M9 §5.1), reused frame to frame. */
  private readonly liveBeams: Ribbon[] = [];
  /** Each Binder's latest chain cone (M12 follow-up §2.2), so a new one replaces it. */
  private readonly chainCones = new Map<number, THREE.Object3D>();
  /** Spawn rays (M12 §2.4) by spawn point, reused; `since` is when the ray last appeared. */
  private readonly spawnRays = new Map<
    string,
    { mesh: THREE.Mesh; material: THREE.ShaderMaterial; since: number; flare: number; ring: number }
  >();
  private readonly liveBeamMaterial: THREE.MeshBasicMaterial;
  /** Falling Star's preview (M12 §5.2), made on first use and reused. */
  private starArc: Ribbon | null = null;
  private readonly starRings: Array<{ mesh: THREE.Mesh; material: THREE.MeshBasicMaterial }> = [];

  constructor(private readonly tex: EffectTextures) {
    this.tetherMaterial = this.material(tex.beam, 0xff7a3a);
    this.tetherMaterial.opacity = 0.55;
    this.liveBeamMaterial = this.material(tex.beam, HEAL_GREEN);
  }

  /**
   * Falling Star's preview (M12 §5.2): the arc through `points` (simulation coordinates, its 24
   * segments' ends in order) and the two rings on the floor at `landing`; null hides it.
   */
  setStarPreview(points: ReadonlyArray<readonly [number, number, number]> | null, landing: readonly [number, number, number] | null, valid: boolean, camera: THREE.Vector3): void {
    const show = !!points && !!landing;
    if (show && !this.starArc) {
      const pairs = Array.from({ length: (points.length - 1) * 2 }, () => [0, 0, 0] as [number, number, number]);
      this.starArc = new Ribbon(pairs, STAR_ARC_WIDTH, this.material(this.tex.beam, STAR_VALID), BEAM_TILE);
      (this.starArc.mesh.material as THREE.MeshBasicMaterial).opacity = STAR_ARC_OPACITY;
      this.group.add(this.starArc.mesh);
      for (const [, opacity] of STAR_RINGS) {
        const material = this.material(this.tex.ring, STAR_VALID);
        material.opacity = opacity;
        const mesh = new THREE.Mesh(groundGeo, material);
        this.group.add(mesh);
        this.starRings.push({ mesh, material });
      }
    }
    if (this.starArc) this.starArc.mesh.visible = show;
    for (const r of this.starRings) r.mesh.visible = show;
    if (!show || !this.starArc) return;
    const color = valid ? STAR_VALID : STAR_INVALID;
    const pairs: Array<readonly [number, number, number]> = [];
    for (let i = 0; i + 1 < points.length; i++) pairs.push(points[i], points[i + 1]);
    this.starArc.setPoints(pairs);
    this.starArc.face(camera);
    (this.starArc.mesh.material as THREE.MeshBasicMaterial).color.setHex(color);
    STAR_RINGS.forEach(([radius], i) => {
      const r = this.starRings[i];
      r.mesh.position.set(landing[0], landing[2] + 0.05, landing[1]);
      r.mesh.scale.set(radius / RING_RADIUS, 1, radius / RING_RADIUS);
      r.material.color.setHex(color);
    });
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

  /** A pooled two-sided, transparent basic material, textured with `map` (or none). */
  private material(map: THREE.Texture | null, color: number): THREE.MeshBasicMaterial {
    const key = `basic:${map?.uuid ?? ''}`;
    const m = (this.pool.get(key)?.pop() as THREE.MeshBasicMaterial | undefined) ?? new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false });
    m.userData.pool = key;
    m.color.setHex(color);
    m.opacity = 1;
    return m;
  }

  /** A pooled transparent sprite material, textured with `map`. */
  private spriteMaterial(map: THREE.Texture, color: number): THREE.SpriteMaterial {
    const key = `sprite:${map.uuid}`;
    const m = (this.pool.get(key)?.pop() as THREE.SpriteMaterial | undefined) ?? new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, fog: false });
    m.userData.pool = key;
    m.color.setHex(color);
    m.opacity = 1;
    m.rotation = 0;
    return m;
  }

  /** An ended effect's material goes back to its pool. */
  private release(m: THREE.Material): void {
    const key = m.userData.pool as string | undefined;
    if (!key) {
      m.dispose();
      return;
    }
    let list = this.pool.get(key);
    if (!list) this.pool.set(key, (list = []));
    list.push(m);
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

  /** A soft round glow facing the camera at (x, y, z), from radius r0 to r1, fading from `opacity` to 0. */
  glow(now: number, x: number, y: number, z: number, color: number, r0: number, r1: number, duration: number, delay = 0, opacity = 1): void {
    const material = this.spriteMaterial(this.tex.glow, color);
    const sprite = new THREE.Sprite(material);
    sprite.position.set(x, z, y);
    const update = (f: number): void => {
      sprite.scale.setScalar(2 * (r0 + (r1 - r0) * f));
      material.opacity = opacity * (1 - f);
    };
    this.add({ obj: sprite, material, duration, update }, now, delay);
  }

  /**
   * An explosion's sphere (M12 follow-up §1.3): it bursts out from r0 to r1 with a cubic ease-out, most of
   * its growth in the first third, and fades as (1 − f)², so it reads as a blast, not a bubble.
   */
  burstSphere(now: number, x: number, y: number, z: number, color: number, r0: number, r1: number, duration: number, opacity: number): void {
    const material = this.material(null, color);
    const mesh = new THREE.Mesh(sphereGeo, material);
    mesh.position.set(x, z, y);
    const update = (f: number): void => {
      mesh.scale.setScalar(r0 + (r1 - r0) * (1 - (1 - f) ** 3));
      material.opacity = opacity * (1 - f) ** 2;
    };
    this.add({ obj: mesh, material, duration, update }, now, 0);
  }

  /**
   * A shout's wave on the floor at (x, y, z) (Discord, M12 follow-up §2.4): a faint sector of `halfAngle`
   * either side of `yaw` (simulation radians), and a bright arc at its front, growing to `range` with a
   * cubic ease-out over `duration` and fading after it has spread.
   */
  shoutCone(now: number, x: number, y: number, z: number, yaw: number, halfAngle: number, range: number, color: number, duration: number): void {
    // Flat on the floor: a shape's local angle θ lies along simulation angle −θ.
    const start = -yaw - halfAngle;
    const fill = new THREE.Mesh(new THREE.CircleGeometry(1, 24, start, 2 * halfAngle), this.material(null, color));
    const front = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 32, 1, start, 2 * halfAngle), this.material(null, color));
    const group = new THREE.Group();
    for (const m of [fill, front]) {
      m.rotation.x = -Math.PI / 2;
      group.add(m);
    }
    group.position.set(x, z + 0.06, y);
    const fillMat = fill.material as THREE.MeshBasicMaterial;
    const frontMat = front.material as THREE.MeshBasicMaterial;
    const update = (f: number): void => {
      const r = 0.5 + (range - 0.5) * (1 - (1 - f) ** 3);
      fill.scale.setScalar(r);
      front.scale.setScalar(r);
      const fade = f < 0.5 ? 1 : 1 - (f - 0.5) / 0.5;
      fillMat.opacity = 0.18 * fade;
      frontMat.opacity = 0.6 * fade;
    };
    const ended = (): void => {
      fill.geometry.dispose();
      front.geometry.dispose();
      this.release(fillMat);
    };
    this.add({ obj: group, material: frontMat, duration, update, dispose: ended }, now, 0);
  }

  /** A translucent sphere at (x, y, z), from radius r0 to r1, fading from `opacity` to 0. */
  sphere(now: number, x: number, y: number, z: number, color: number, r0: number, r1: number, duration: number, opacity = 0.45, delay = 0): void {
    // Both sides, so a bubble around the camera (a shield on yourself) is visible from inside.
    const material = this.material(null, color);
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
    const material = this.spriteMaterial(this.tex.glow, color);
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
    const material = this.spriteMaterial(this.tex.smoke, color);
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

  /**
   * The bound pile's chains (M12 follow-up §2.2): 6 red-hot chains from a 5 m circle 8 m above the pile's
   * floor at (x, y, z) down to a 1.2 m circle on it, an inverted cone. They come down from the top over
   * 120 ms, hold while the pull drags the crowd in, and fade over the last 0.4 s of 1.5 s, with a red
   * ring where they land. A new cone
   * under the same `key` (the Binder) replaces the old one.
   */
  chainCone(now: number, x: number, y: number, z: number, key: number): void {
    const old = this.chainCones.get(key);
    if (old) for (const e of this.effects) if (e.obj === old) e.duration = 1e-6;
    const turn = Math.random() * Math.PI * 2;
    const tops: Array<[number, number, number]> = [];
    const bottoms: Array<[number, number, number]> = [];
    for (let i = 0; i < CHAIN_CONE_COUNT; i++) {
      const a = turn + (i * 2 * Math.PI) / CHAIN_CONE_COUNT;
      tops.push([x + Math.cos(a) * CHAIN_CONE_TOP_R, y + Math.sin(a) * CHAIN_CONE_TOP_R, z + CHAIN_CONE_HEIGHT]);
      bottoms.push([x + Math.cos(a) * CHAIN_CONE_BOTTOM_R, y + Math.sin(a) * CHAIN_CONE_BOTTOM_R, z]);
    }
    const pts = (drop: number): Array<[number, number, number]> =>
      tops.flatMap((t, i) => {
        const b = bottoms[i];
        return [t, [t[0] + (b[0] - t[0]) * drop, t[1] + (b[1] - t[1]) * drop, t[2] + (b[2] - t[2]) * drop] as [number, number, number]];
      });
    const img = this.tex.chain.image as { width: number; height: number };
    const ribbon = new Ribbon(pts(1e-3), CHAIN_CONE_WIDTH, this.material(this.tex.chain, 0xffffff), (CHAIN_CONE_WIDTH * img.width) / img.height);
    const material = ribbon.mesh.material as THREE.MeshBasicMaterial;
    const update = (f: number): void => {
      const t = f * CHAIN_CONE_MS;
      const drop = Math.min(1, t / CHAIN_CONE_DROP_MS);
      ribbon.setPoints(pts(Math.max(1e-3, 1 - (1 - drop) ** 3)));
      material.opacity = Math.min(1, (CHAIN_CONE_MS - t) / CHAIN_CONE_FADE_MS);
    };
    this.add({ obj: ribbon.mesh, material, duration: CHAIN_CONE_MS, update, ribbon }, now, 0);
    this.chainCones.set(key, ribbon.mesh);
    this.ring(now, x, y, z, CHAIN_CONE_RING, 0.5, 1.6, 300, CHAIN_CONE_DROP_MS);
  }

  private addRibbon(ribbon: Ribbon, now: number, duration: number): void {
    const material = ribbon.mesh.material as THREE.MeshBasicMaterial;
    this.add({ obj: ribbon.mesh, material, duration, update: (f) => (material.opacity = 1 - f), ribbon }, now, 0);
  }

  /**
   * A spawn point flares (M12 §2.4) as an enemy comes out of it: a golden ray of light comes down on
   * it from above, stays at full strength while enemies keep coming, and fades over 0.8 s after its
   * last flare; at most every 0.4 s a gold ground ring grows from it. (x, y, z) is the point's cell
   * center on its floor.
   */
  flareSpawn(now: number, x: number, y: number, z: number): void {
    const key = `${x},${y}`;
    let g = this.spawnRays.get(key);
    if (!g) {
      const material = new THREE.ShaderMaterial({
        ...rayShader,
        uniforms: {
          body: { value: new THREE.Color(SPAWN_RAY_BODY) },
          core: { value: new THREE.Color(SPAWN_RAY_CORE) },
          opacity: { value: 0 },
          time: { value: 0 },
          seed: { value: this.spawnRays.size * 2.39 },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(shaftGeo, material);
      mesh.position.set(x, z + SPAWN_RAY_HEIGHT, y);
      mesh.frustumCulled = false;
      this.columns.add(mesh);
      this.group.add(mesh);
      g = { mesh, material, since: now, flare: -Infinity, ring: -Infinity };
      this.spawnRays.set(key, g);
    }
    // A ray that had faded out comes down from the sky again.
    if (now - g.flare >= SPAWN_RAY_HOLD_MS + SPAWN_GLOW_FADE_MS) g.since = now;
    g.flare = now;
    if (now - g.ring >= SPAWN_RING_GAP_MS) {
      g.ring = now;
      this.ring(now, x, y, z, SPAWN_GOLD, 0.3, SPAWN_RING_RADIUS, SPAWN_RING_GAP_MS);
    }
  }

  /** `camera` is the camera's position in three.js coordinates. */
  update(now: number, camera: THREE.Vector3): void {
    for (const g of this.spawnRays.values()) {
      const f = 1 - (now - g.flare - SPAWN_RAY_HOLD_MS) / SPAWN_GLOW_FADE_MS;
      g.mesh.visible = f > 0;
      if (!g.mesh.visible) continue;
      const drop = Math.min(1, Math.max(0, (now - g.since) / SPAWN_RAY_DROP_MS));
      g.mesh.scale.set(SPAWN_RAY_WIDTH, SPAWN_RAY_HEIGHT * Math.max(1e-3, 1 - (1 - drop) ** 3), 1);
      g.material.uniforms.opacity.value = Math.min(1, f);
      g.material.uniforms.time.value = now / 1000;
    }
    for (const c of this.columns) c.rotation.y = Math.atan2(camera.x - c.position.x, camera.z - c.position.z);
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i];
      const f = (now - e.start) / e.duration;
      if (f < 0) continue;
      if (f >= 1) {
        this.columns.delete(e.obj as THREE.Mesh);
        this.group.remove(e.obj);
        this.release(e.material);
        e.ribbon?.mesh.geometry.dispose();
        e.dispose?.();
        this.effects.splice(i, 1);
        continue;
      }
      e.obj.visible = true;
      // Update first: a chain cone moves its ends as it comes down.
      e.update(f);
      e.ribbon?.face(camera);
    }
  }
}
