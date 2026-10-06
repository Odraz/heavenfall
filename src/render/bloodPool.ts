/**
 * Field of Blood's pool and glare (M9 §5.1): a glowing blood-red liquid drawn by a shader on the floor
 * cells of the field, with the field's exact edge as a line, and red light rising from it as an open
 * cylinder. No image needed. Positions are simulation coordinates (z up).
 */
import * as THREE from 'three';
import { FIELD_RADIUS, FIELD_TIME, fieldCells } from '../sim/field';
import type { GameMap } from '../sim/map';

/** The pool sits this far above each cell's floor. */
export const POOL_LIFT = 0.03;
const LIFT = POOL_LIFT;
/** It spreads over 0.4 s and fades and shrinks over its last 0.5 s. */
const SPREAD_S = 0.4;
const FADE_S = 0.5;
/** The glare: 2.5 m tall, 35% opacity at the bottom, flickering ±15%. */
const GLARE_HEIGHT = 2.5;

const poolVertex = /* glsl */ `
varying vec2 vP;
void main() {
  // Simulation x, y are three.js x, z.
  vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const poolFragment = /* glsl */ `
uniform vec2 uCenter;
uniform float uTime;
uniform float uScale;
uniform float uAlpha;
uniform float uSeed;
varying vec2 vP;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7)) + uSeed) * 43758.5453);
}

float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}

void main() {
  vec2 d = vP - uCenter;
  float dist = length(d);
  float ang = atan(d.y, d.x);
  // The puddle's edge wobbles between 5.6 m and 6 m along smooth noise seeded by the center.
  float w = 0.5 + 0.5 * (0.5 * sin(3.0 * ang + uSeed) + 0.3 * sin(5.0 * ang + uSeed * 1.7) + 0.2 * sin(8.0 * ang + uSeed * 2.3));
  float edge = (5.6 + 0.4 * w) * uScale;
  vec4 pool = vec4(0.0);
  if (dist <= edge) {
    float t = dist / max(edge, 1e-3);
    vec3 c = mix(vec3(0.290, 0.024, 0.024), vec3(0.690, 0.094, 0.094), smoothstep(0.25, 1.0, t));
    // A thin bright rim.
    c = mix(c, vec3(1.0, 0.227, 0.165), smoothstep(edge - 0.18, edge - 0.04, dist));
    // Gloss: two layers of slowly scrolling noise make highlight streaks.
    float n1 = noise(vP * vec2(0.9, 2.2) + vec2(uTime * 0.18, uTime * 0.05));
    float n2 = noise(vP * vec2(2.1, 0.8) - vec2(uTime * 0.07, uTime * 0.15));
    float streak = smoothstep(0.55, 0.9, n1 * n2 * 1.9);
    // Gentle ripples spreading from the center every 1.5 s.
    float phase = fract(uTime / 1.5);
    float ripple = exp(-pow((dist - phase * edge) / 0.3, 2.0)) * (1.0 - phase);
    c += vec3(1.0, 0.5, 0.45) * (streak * 0.3 + ripple * 0.22);
    pool = vec4(c, 0.85);
  }
  // The field's exact edge: a line 0.15 m wide at 6 m, at 50% opacity, over the pool.
  float line = (1.0 - smoothstep(0.065, 0.085, abs(dist - 6.0 * uScale))) * 0.5;
  float a = line + pool.a * (1.0 - line);
  if (a * uAlpha < 0.01) discard;
  vec3 rgb = (vec3(1.0, 0.227, 0.165) * line + pool.rgb * pool.a * (1.0 - line)) / a;
  gl_FragColor = vec4(rgb, a * uAlpha);
}
`;

const glareVertex = /* glsl */ `
varying float vH;
void main() {
  vH = uv.y;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const glareFragment = /* glsl */ `
uniform float uAlpha;
varying float vH;
void main() {
  gl_FragColor = vec4(1.0, 0.227, 0.165, 0.35 * (1.0 - vH) * uAlpha);
}
`;

export class BloodPool {
  readonly group = new THREE.Group();
  private readonly pool: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  private readonly glare: THREE.Mesh<THREE.CylinderGeometry, THREE.ShaderMaterial>;
  /** The floor cells it covers, for the embers rising from it. */
  readonly cells: Array<[number, number]>;

  constructor(
    map: GameMap,
    readonly x: number,
    readonly y: number,
    readonly z: number,
    /** performance.now() when it appeared. */
    readonly start: number,
  ) {
    this.cells = fieldCells(map, x, y, z);
    const pos: number[] = [];
    const index: number[] = [];
    for (const [c, r] of this.cells) {
      const h = map.floor[r * map.w + c] + LIFT;
      const k = pos.length / 3;
      pos.push(c, h, r, c + 1, h, r, c + 1, h, r + 1, c, h, r + 1);
      index.push(k, k + 2, k + 1, k, k + 3, k + 2);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(index);
    this.pool = new THREE.Mesh(
      geo,
      new THREE.ShaderMaterial({
        vertexShader: poolVertex,
        fragmentShader: poolFragment,
        uniforms: {
          uCenter: { value: new THREE.Vector2(x, y) },
          uTime: { value: 0 },
          uScale: { value: 0 },
          uAlpha: { value: 1 },
          // Seeded by the center, so each pool has its own shape.
          uSeed: { value: this.seed },
        },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.pool.frustumCulled = false;
    this.glare = new THREE.Mesh(
      new THREE.CylinderGeometry(FIELD_RADIUS, FIELD_RADIUS, GLARE_HEIGHT, 48, 1, true),
      new THREE.ShaderMaterial({
        vertexShader: glareVertex,
        fragmentShader: glareFragment,
        uniforms: { uAlpha: { value: 0 } },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
    this.glare.position.set(x, z + GLARE_HEIGHT / 2, y);
    this.group.add(this.pool, this.glare);
  }

  /** Seconds since it appeared. */
  age(now: number): number {
    return (now - this.start) / 1000;
  }

  /** Seeded by the center, so each pool has its own shape (the shader's `uSeed`). */
  private get seed(): number {
    return ((this.x * 12.9898 + this.y * 78.233) % 6.283) + 1;
  }

  /** The puddle's edge radius at full size in the direction `ang`, as the shader draws it (5.6–6 m). */
  edge(ang: number): number {
    const s = this.seed;
    const w = 0.5 + 0.5 * (0.5 * Math.sin(3 * ang + s) + 0.3 * Math.sin(5 * ang + s * 1.7) + 0.2 * Math.sin(8 * ang + s * 2.3));
    return 5.6 + 0.4 * w;
  }

  /**
   * A random point on the pool as drawn now (on its cells, inside its wobbling edge), with its cell's
   * floor plus the pool's lift; null if a few tries miss (the pool is still small).
   */
  randomPoint(now: number, map: GameMap): [number, number, number] | null {
    const scale = this.scale(now);
    for (let i = 0; i < 8 && this.cells.length; i++) {
      const [c, r] = this.cells[Math.floor(Math.random() * this.cells.length)];
      const px = c + Math.random();
      const py = r + Math.random();
      if (Math.hypot(px - this.x, py - this.y) <= this.edge(Math.atan2(py - this.y, px - this.x)) * scale) return [px, py, map.floor[r * map.w + c] + LIFT];
    }
    return null;
  }

  /** The pool's current size, 0–1: growing over 0.4 s, shrinking over the last 0.5 s. */
  scale(now: number): number {
    const t = this.age(now);
    return Math.max(0, Math.min(1, t / SPREAD_S) * Math.min(1, (FIELD_TIME - t) / FADE_S));
  }

  /** Grows over 0.4 s, fades and shrinks over the last 0.5 s; returns false once it's gone. */
  update(now: number): boolean {
    const t = this.age(now);
    if (t >= FIELD_TIME) return false;
    const grow = Math.min(1, t / SPREAD_S);
    const fade = Math.min(1, (FIELD_TIME - t) / FADE_S);
    const scale = grow * fade;
    const u = this.pool.material.uniforms;
    u.uTime.value = t;
    u.uScale.value = scale;
    u.uAlpha.value = fade;
    this.glare.scale.set(Math.max(1e-3, scale), 1, Math.max(1e-3, scale));
    // A slow flicker of ±15%.
    const flicker = 1 + 0.15 * Math.sin(t * 5.3) * Math.sin(t * 2.1 + 1);
    this.glare.material.uniforms.uAlpha.value = fade * grow * flicker;
    return true;
  }

  dispose(): void {
    this.group.removeFromParent();
    this.pool.geometry.dispose();
    this.pool.material.dispose();
    this.glare.geometry.dispose();
    this.glare.material.dispose();
  }
}
