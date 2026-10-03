/**
 * Billboards that rotate only around the vertical axis, all drawn with one InstancedMesh for the
 * atlas material, refilled every frame (§11.1). Status effects are per-instance colors: a multiply
 * tint and a glow mixed over it.
 */
import * as THREE from 'three';
import type { SpriteFrame } from './atlas';

export const MAX_BILLBOARDS = 8192;

const vertexShader = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iSize;
  attribute vec4 iUv;
  attribute vec3 iTint;
  attribute vec4 iGlow;
  uniform vec3 uRight;
  varying vec2 vUv;
  varying vec3 vTint;
  varying vec4 vGlow;
  #include <fog_pars_vertex>
  void main() {
    // iSize: width, height, and the anchor point within the quad (fractions from the bottom left).
    vec3 p = iPos + uRight * ((position.x + 0.5 - iSize.z) * iSize.x) + vec3(0.0, (position.y - iSize.w) * iSize.y, 0.0);
    vUv = mix(iUv.xy, iUv.zw, uv);
    vTint = iTint;
    vGlow = iGlow;
    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec3 vTint;
  varying vec4 vGlow;
  #include <fog_pars_fragment>
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < 0.5) discard;
    gl_FragColor = vec4(mix(c.rgb * vTint, vGlow.rgb, vGlow.a), 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

/** A color with an amount, for the glow. */
export interface Glow {
  r: number;
  g: number;
  b: number;
  a: number;
}

export const NO_GLOW: Glow = { r: 1, g: 1, b: 1, a: 0 };

export class Billboards {
  readonly mesh: THREE.InstancedMesh;
  private readonly pos: THREE.InstancedBufferAttribute;
  private readonly size: THREE.InstancedBufferAttribute;
  private readonly uv: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
  private readonly glow: THREE.InstancedBufferAttribute;
  private readonly material: THREE.ShaderMaterial;
  private n = 0;

  constructor(texture: THREE.Texture) {
    const geo = new THREE.BufferGeometry();
    // A unit quad: x in [-0.5, 0.5], y in [0, 1].
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    const mk = (itemSize: number) => {
      const a = new THREE.InstancedBufferAttribute(new Float32Array(MAX_BILLBOARDS * itemSize), itemSize);
      a.setUsage(THREE.DynamicDrawUsage);
      return a;
    };
    this.pos = mk(3);
    this.size = mk(4);
    this.uv = mk(4);
    this.tint = mk(3);
    this.glow = mk(4);
    geo.setAttribute('iPos', this.pos);
    geo.setAttribute('iSize', this.size);
    geo.setAttribute('iUv', this.uv);
    geo.setAttribute('iTint', this.tint);
    geo.setAttribute('iGlow', this.glow);
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, uRight: { value: new THREE.Vector3(1, 0, 0) } }]),
      vertexShader,
      fragmentShader,
      fog: true,
    });
    this.material.uniforms.map.value = texture;
    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX_BILLBOARDS);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  begin(): void {
    this.n = 0;
  }

  /**
   * Adds a billboard. (x, y, z) are simulation coordinates: the feet, or the center if `centered`.
   * `height` is the billboard height in meters; the width follows the sprite's aspect ratio. A frame
   * with an anchor puts that point at the position instead (`centered` still centers it vertically).
   * The color is multiplied by (tr, tg, tb), then mixed toward `glow` by its amount.
   */
  add(f: SpriteFrame, x: number, y: number, z: number, height: number, centered: boolean, tr = 1, tg = 1, tb = 1, glow: Glow = NO_GLOW): void {
    if (this.n >= MAX_BILLBOARDS) return;
    const i = this.n++;
    const p = this.pos.array as Float32Array;
    p[i * 3] = x;
    p[i * 3 + 1] = z;
    p[i * 3 + 2] = y;
    const s = this.size.array as Float32Array;
    s[i * 4] = height * f.aspect;
    s[i * 4 + 1] = height;
    s[i * 4 + 2] = f.anchorX ?? 0.5;
    s[i * 4 + 3] = centered ? 0.5 : (f.anchorY ?? 0);
    const u = this.uv.array as Float32Array;
    u[i * 4] = f.u0;
    u[i * 4 + 1] = f.v0;
    u[i * 4 + 2] = f.u1;
    u[i * 4 + 3] = f.v1;
    const t = this.tint.array as Float32Array;
    t[i * 3] = tr;
    t[i * 3 + 1] = tg;
    t[i * 3 + 2] = tb;
    const g = this.glow.array as Float32Array;
    g[i * 4] = glow.r;
    g[i * 4 + 1] = glow.g;
    g[i * 4 + 2] = glow.b;
    g[i * 4 + 3] = glow.a;
  }

  /** Uploads this frame's billboards; `camera` gives the shared horizontal right vector. */
  end(camera: THREE.Camera): void {
    const n = this.n;
    this.mesh.count = n;
    for (const a of [this.pos, this.size, this.uv, this.tint, this.glow]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, n * a.itemSize);
      a.needsUpdate = true;
    }
    const right = this.material.uniforms.uRight.value as THREE.Vector3;
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    right.y = 0;
    if (right.lengthSq() < 1e-8) right.set(1, 0, 0);
    right.normalize();
  }

  get count(): number {
    return this.n;
  }
}
