/**
 * Billboards that rotate only around the vertical axis, all drawn with one InstancedMesh for the
 * atlas material, refilled every frame (§11.1). Status effects are per-instance colors: a multiply
 * tint and a glow mixed over it.
 */
import * as THREE from 'three';
import type { SpriteFrame } from './atlas';
import { LIT, lum, SHADE } from './lightmap';

/** A billboard flying more than this above the floor under it takes full light (M10 §5.4). */
const FLY_ABOVE = 1;

/** A lightmap of full light, until setLight gives the level's. */
const WHITE = new THREE.DataTexture(new Uint8Array([255, 255, 255, 255]), 1, 1);
WHITE.needsUpdate = true;

/** The ground height at a point, for the flying test. */
export type GroundAt = (x: number, y: number) => number;

export const MAX_BILLBOARDS = 8192;

/**
 * Near fade: a billboard closer to the camera than NEAR_FADE_START (horizontally, at its anchor)
 * dissolves in a dither pattern, down to NEAR_FADE_MIN of its pixels at NEAR_FADE_END and closer,
 * so an enemy pressed against the camera doesn't fill the view.
 */
export const NEAR_FADE_START = 0.8;
export const NEAR_FADE_END = 0.4;
export const NEAR_FADE_MIN = 0.3;

const vertexShader = /* glsl */ `
  attribute vec3 iPos;
  attribute vec4 iSize;
  attribute vec4 iUv;
  attribute vec4 iTint;
  attribute vec4 iGlow;
  attribute float iFly;
  uniform vec3 uRight;
  uniform sampler2D lightmap;
  uniform vec2 mapSize;
  varying vec2 vUv;
  varying vec3 vLight;
  varying vec3 vTint;
  varying vec4 vGlow;
  varying float vVisible;
  #include <fog_pars_vertex>
  void main() {
    // iTint.a: the instance's opacity, drawn as a dither like the near fade.
    #ifdef NEAR_FADE
      float fade = clamp((distance(iPos.xz, cameraPosition.xz) - NEAR_FADE_END) / (NEAR_FADE_START - NEAR_FADE_END), 0.0, 1.0);
      vVisible = mix(NEAR_FADE_MIN, 1.0, fade) * iTint.a;
    #else
      vVisible = iTint.a;
    #endif
    // iSize: width, height, and the anchor point within the quad (fractions from the bottom left).
    vec3 p = iPos + uRight * ((position.x + 0.5 - iSize.z) * iSize.x) + vec3(0.0, (position.y - iSize.w) * iSize.y, 0.0);
    vUv = mix(iUv.xy, iUv.zw, uv);
    // The baked light at the anchor (M10 §5.4): brightness 0.85 + 0.15 L, the floor's hue at half
    // strength. A flyer (iFly) takes full light. Mirrors lightTint() in lightmap.ts.
    float L = iFly > 0.5 ? 1.0 : textureLod(lightmap, iPos.xz / mapSize, 0.0).a;
    vec3 hue = mix(SHADE_C, LIT_C, L) / mix(SHADE_LUM, LIT_LUM, L);
    vLight = (0.85 + 0.15 * L) * (1.0 + 0.5 * (hue - 1.0));
    vTint = iTint.rgb;
    vGlow = iGlow;
    vec4 mvPosition = viewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mvPosition;
    #include <fog_vertex>
  }
`;

const fragmentShader = /* glsl */ `
  uniform sampler2D map;
  varying vec2 vUv;
  varying vec3 vLight;
  varying vec3 vTint;
  varying vec4 vGlow;
  varying float vVisible;
  #include <fog_pars_fragment>
  // A 4 × 4 ordered-dither threshold per screen pixel, for the near fade.
  const float BAYER[16] = float[16](0.0, 8.0, 2.0, 10.0, 12.0, 4.0, 14.0, 6.0, 3.0, 11.0, 1.0, 9.0, 15.0, 7.0, 13.0, 5.0);
  void main() {
    vec4 c = texture2D(map, vUv);
    if (c.a < 0.5) discard;
    if (vVisible < 1.0) {
      ivec2 q = ivec2(mod(gl_FragCoord.xy, 4.0));
      if ((BAYER[q.x + q.y * 4] + 0.5) / 16.0 > vVisible) discard;
    }
    gl_FragColor = vec4(mix(c.rgb * vLight * vTint, vGlow.rgb, vGlow.a), 1.0);
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
  private readonly fly: THREE.InstancedBufferAttribute;
  private readonly material: THREE.ShaderMaterial;
  private ground: GroundAt = () => -Infinity;
  private n = 0;

  /** `nearFade` dissolves billboards close to the camera (see NEAR_FADE_START). */
  constructor(texture: THREE.Texture, nearFade = false) {
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
    this.tint = mk(4);
    this.glow = mk(4);
    this.fly = mk(1);
    geo.setAttribute('iFly', this.fly);
    geo.setAttribute('iPos', this.pos);
    geo.setAttribute('iSize', this.size);
    geo.setAttribute('iUv', this.uv);
    geo.setAttribute('iTint', this.tint);
    geo.setAttribute('iGlow', this.glow);
    this.material = new THREE.ShaderMaterial({
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, uRight: { value: new THREE.Vector3(1, 0, 0) }, lightmap: { value: WHITE }, mapSize: { value: new THREE.Vector2(1, 1) } }]),
      vertexShader,
      fragmentShader,
      fog: true,
      defines: {
        ...(nearFade ? { NEAR_FADE: '', NEAR_FADE_START: NEAR_FADE_START.toFixed(3), NEAR_FADE_END: NEAR_FADE_END.toFixed(3), NEAR_FADE_MIN: NEAR_FADE_MIN.toFixed(3) } : {}),
        LIT_C: `vec3(${LIT.map((v) => v.toFixed(4)).join(', ')})`,
        SHADE_C: `vec3(${SHADE.map((v) => v.toFixed(4)).join(', ')})`,
        LIT_LUM: lum(LIT).toFixed(4),
        SHADE_LUM: lum(SHADE).toFixed(4),
      },
    });
    this.material.uniforms.map.value = texture;
    this.mesh = new THREE.InstancedMesh(geo, this.material, MAX_BILLBOARDS);
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
  }

  /** The baked lightmap of a `mapW` × `mapH` map, and the ground height for the flying test (M10 §5.4). */
  setLight(lightmap: THREE.Texture, mapW: number, mapH: number, ground: GroundAt): void {
    this.material.uniforms.lightmap.value = lightmap;
    (this.material.uniforms.mapSize.value as THREE.Vector2).set(mapW, mapH);
    this.ground = ground;
  }

  begin(): void {
    this.n = 0;
  }

  /**
   * Adds a billboard. (x, y, z) are simulation coordinates: the feet, or the center if `centered`.
   * `height` is the billboard height in meters; the width follows the sprite's aspect ratio. A frame
   * with an anchor puts that point at the position instead (`centered` still centers it vertically).
   * The color is multiplied by (tr, tg, tb), then mixed toward `glow` by its amount. `alpha` below 1
   * dissolves it in a dither pattern, like the near fade.
   */
  add(f: SpriteFrame, x: number, y: number, z: number, height: number, centered: boolean, tr = 1, tg = 1, tb = 1, glow: Glow = NO_GLOW, alpha = 1): void {
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
    t[i * 4] = tr;
    t[i * 4 + 1] = tg;
    t[i * 4 + 2] = tb;
    t[i * 4 + 3] = alpha;
    // Flying more than 1 m above the floor under it (a Cherub, a projectile): full light.
    (this.fly.array as Float32Array)[i] = z - this.ground(x, y) > FLY_ABOVE ? 1 : 0;
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
    for (const a of [this.pos, this.size, this.uv, this.tint, this.glow, this.fly]) {
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
