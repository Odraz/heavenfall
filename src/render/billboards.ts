/**
 * Billboards that rotate only around the vertical axis, all drawn with one InstancedMesh for the
 * atlas material, refilled every frame (§11.1).
 */
import * as THREE from 'three';
import type { SpriteFrame } from './atlas';

export const MAX_BILLBOARDS = 8192;

const vertexShader = /* glsl */ `
  attribute vec3 iPos;
  attribute vec3 iSize;
  attribute vec4 iUv;
  attribute vec4 iTint;
  uniform vec3 uRight;
  varying vec2 vUv;
  varying vec4 vTint;
  #include <fog_pars_vertex>
  void main() {
    vec3 p = iPos + uRight * (position.x * iSize.x) + vec3(0.0, (position.y - iSize.z) * iSize.y, 0.0);
    vUv = mix(iUv.xy, iUv.zw, uv);
    vTint = iTint;
    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec4 vTint;
  #include <fog_pars_fragment>
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < 0.5) discard;
    gl_FragColor = vec4(mix(c.rgb * vTint.rgb, vec3(1.0), vTint.a), 1.0);
    #include <colorspace_fragment>
    #include <fog_fragment>
  }
`;

export class Billboards {
  readonly mesh: THREE.InstancedMesh;
  private readonly pos: THREE.InstancedBufferAttribute;
  private readonly size: THREE.InstancedBufferAttribute;
  private readonly uv: THREE.InstancedBufferAttribute;
  private readonly tint: THREE.InstancedBufferAttribute;
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
    this.size = mk(3);
    this.uv = mk(4);
    this.tint = mk(4);
    geo.setAttribute('iPos', this.pos);
    geo.setAttribute('iSize', this.size);
    geo.setAttribute('iUv', this.uv);
    geo.setAttribute('iTint', this.tint);
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
   * `height` is the billboard height in meters; the width follows the sprite's aspect ratio.
   */
  add(f: SpriteFrame, x: number, y: number, z: number, height: number, centered: boolean, r = 1, g = 1, b = 1, flash = 0): void {
    if (this.n >= MAX_BILLBOARDS) return;
    const i = this.n++;
    const p = this.pos.array as Float32Array;
    p[i * 3] = x;
    p[i * 3 + 1] = z;
    p[i * 3 + 2] = y;
    const s = this.size.array as Float32Array;
    s[i * 3] = height * f.aspect;
    s[i * 3 + 1] = height;
    s[i * 3 + 2] = centered ? 0.5 : 0;
    const u = this.uv.array as Float32Array;
    u[i * 4] = f.u0;
    u[i * 4 + 1] = f.v0;
    u[i * 4 + 2] = f.u1;
    u[i * 4 + 3] = f.v1;
    const t = this.tint.array as Float32Array;
    t[i * 4] = r;
    t[i * 4 + 1] = g;
    t[i * 4 + 2] = b;
    t[i * 4 + 3] = flash;
  }

  /** Uploads this frame's billboards; `camera` gives the shared horizontal right vector. */
  end(camera: THREE.Camera): void {
    const n = this.n;
    this.mesh.count = n;
    for (const a of [this.pos, this.size, this.uv, this.tint]) {
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
