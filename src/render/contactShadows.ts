/**
 * Contact shadows (M10 §5.4): a soft dark ellipse on the floor under every character, from fx-glow, in
 * one instanced geometry drawn in two passes so overlapping shadows don't stack. The first pass writes
 * no color, only the framebuffer's alpha: the minimum of 1 − darkness over the shadows covering a pixel
 * (everything opaque leaves alpha at 1). The second multiplies the color by that alpha and resets it to
 * 1, so the first shadow drawn at a pixel darkens it by the darkest one there and the others do nothing.
 */
import * as THREE from 'three';
import { FOG_GLSL } from './fog';

export const MAX_SHADOWS = 4096;
/** At most this much darker at the center (M10 §5.4). */
export const SHADOW_DARKNESS = 0.3;
/** Raised above the floor, with a polygon offset too. */
const LIFT = 0.02;

const vertexShader = /* glsl */ `
  attribute vec4 iShadow;
  attribute float iDarkness;
  varying vec2 vUv;
  varying float vDark;
  varying float vFogDepth;
  void main() {
    // iShadow: x, floor height, y (three.js order), and the radius.
    vec3 p = iShadow.xyz + vec3(position.x * iShadow.w, 0.0, position.y * iShadow.w);
    vUv = uv;
    vDark = iDarkness;
    vec4 mv = viewMatrix * vec4(p, 1.0);
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  uniform float fogNear;
  uniform float fogFar;
  ${FOG_GLSL}
  varying vec2 vUv;
  varying float vDark;
  varying float vFogDepth;
  void main() {
    // fx-glow's falloff, made fuller (its square root), so the shadow reads out to its edge.
    float a = sqrt(texture2D(map, vUv).a) * vDark * (1.0 - heavenFog(vFogDepth));
    if (a < 0.004) discard;
    gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0 - a);
  }`;

export class ContactShadows {
  /** Both passes, to add to the scene. */
  readonly meshes: THREE.Mesh[];
  private readonly inst: THREE.InstancedBufferAttribute;
  private readonly dark: THREE.InstancedBufferAttribute;
  private readonly geo: THREE.InstancedBufferGeometry;
  private n = 0;

  constructor(glow: THREE.Texture) {
    const geo = new THREE.InstancedBufferGeometry();
    // A unit quad lying flat: x and y in [-1, 1], mapped to three.x and three.z.
    geo.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 1, -1, 0, 1, 1, 0, -1, 1, 0], 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1], 2));
    geo.setIndex([0, 2, 1, 0, 3, 2]);
    this.inst = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SHADOWS * 4), 4);
    this.dark = new THREE.InstancedBufferAttribute(new Float32Array(MAX_SHADOWS), 1);
    this.inst.setUsage(THREE.DynamicDrawUsage);
    this.dark.setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iShadow', this.inst);
    geo.setAttribute('iDarkness', this.dark);
    geo.instanceCount = 0;
    this.geo = geo;
    const common = {
      uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), map: { value: glow } },
      vertexShader,
      fragmentShader,
      fog: true,
      defines: { FOG_SCENERY: '' },
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -4,
      blending: THREE.CustomBlending,
    };
    // Pass 1: color unchanged; alpha = min(alpha, 1 − darkness).
    const first = new THREE.ShaderMaterial({
      ...common,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.OneFactor,
      blendEquationAlpha: THREE.MinEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.OneFactor,
    });
    // Pass 2: color × alpha, alpha back to 1.
    const second = new THREE.ShaderMaterial({
      ...common,
      blendEquation: THREE.AddEquation,
      blendSrc: THREE.ZeroFactor,
      blendDst: THREE.DstAlphaFactor,
      blendEquationAlpha: THREE.AddEquation,
      blendSrcAlpha: THREE.OneFactor,
      blendDstAlpha: THREE.ZeroFactor,
    });
    // The second pass only needs to cover the quad: its blending reads the alpha the first pass wrote
    // (1 outside the shadows), so no texture or fog.
    second.fragmentShader = 'void main() { gl_FragColor = vec4(0.0, 0.0, 0.0, 1.0); }';
    this.meshes = [first, second].map((m, k) => {
      const mesh = new THREE.Mesh(geo, m);
      mesh.frustumCulled = false;
      // Right after the opaque scene and before other effects, one after the other.
      mesh.renderOrder = -2 + k;
      return mesh;
    });
  }

  begin(): void {
    this.n = 0;
  }

  /** A shadow under (x, y), on the floor at `floorZ`, `radius` across half its width, `darkness` 0–1. */
  add(x: number, y: number, floorZ: number, radius: number, darkness = SHADOW_DARKNESS): void {
    if (this.n >= MAX_SHADOWS) return;
    const i = this.n++;
    const a = this.inst.array as Float32Array;
    a[i * 4] = x;
    a[i * 4 + 1] = floorZ + LIFT;
    a[i * 4 + 2] = y;
    a[i * 4 + 3] = radius;
    (this.dark.array as Float32Array)[i] = darkness;
  }

  end(): void {
    this.geo.instanceCount = this.n;
    for (const a of [this.inst, this.dark]) {
      a.clearUpdateRanges();
      a.addUpdateRange(0, this.n * a.itemSize);
      a.needsUpdate = true;
    }
  }
}
