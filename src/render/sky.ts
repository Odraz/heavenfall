/**
 * The painted sky (M10 §4.2): the horizon band of `sky-day` goes around the player twice, once as
 * painted over 180° and once mirrored over the other 180°, so its edges meet themselves with no
 * seam. Its left edge (the sun's rays) faces the sun. Above and below the band the color blends to
 * the zenith and the fog color; the band's top and bottom 10% fade into its averaged edge rows.
 */
import * as THREE from 'three';
import { SKY_BOTTOM_COLOR, SKY_HEIGHT, SKY_HORIZON_COLOR, SKY_HORIZON_ROW, SKY_TOP_COLOR, SKY_WIDTH, SKY_ZENITH_COLOR } from './sky.gen';
import { SUN_AZIMUTH } from './sun';

/** The clear color, and the fog color of sprites and effects: the horizon row, averaged. */
export const FOG_COLOR = SKY_HORIZON_COLOR;

/** Radians per pixel of the band, the same both ways, so nothing is squashed. */
const RAD_PER_PX = Math.PI / SKY_WIDTH;
/** Elevations of the band's top and bottom rows (about +58° and −31°). */
export const SKY_BAND_TOP = SKY_HORIZON_ROW * RAD_PER_PX;
export const SKY_BAND_BOTTOM = -(SKY_HEIGHT - SKY_HORIZON_ROW) * RAD_PER_PX;
/** Where the blends above and below the band end. */
const ZENITH_AT = (80 * Math.PI) / 180;
const FOG_AT = (-45 * Math.PI) / 180;

/** Sets a sky texture's sampling: mirrored around, clamped top and bottom (M10 §4.2). */
export function prepareSkyTexture(tex: THREE.Texture): void {
  tex.wrapS = THREE.MirroredRepeatWrapping;
  tex.wrapT = THREE.ClampToEdgeWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 1;
}

/**
 * GLSL: `vec3 skyColor(vec3 dir)` for a unit direction in three.js space, with `skyBand` and the
 * sky uniforms of `skyUniforms` declared. `bias` is a mip level bias (scenery fog samples a small mip).
 */
export const SKY_GLSL = /* glsl */ `
  uniform sampler2D skyBand;
  uniform vec3 skyTop;
  uniform vec3 skyBottom;
  uniform vec3 skyZenith;
  uniform vec3 skyFog;
  const float SKY_PI = 3.14159265;
  vec3 skyColor(vec3 dir) {
    float az = atan(dir.z, dir.x) - ${SUN_AZIMUTH.toFixed(6)};
    az = mod(az + SKY_PI, 2.0 * SKY_PI) - SKY_PI;
    // u in (-1, 1]: 0 faces the sun; the sampler mirrors negative u and the far side.
    float u = az / SKY_PI;
    float el = asin(clamp(dir.y, -1.0, 1.0));
    float v = (el - ${SKY_BAND_BOTTOM.toFixed(6)}) / ${(SKY_BAND_TOP - SKY_BAND_BOTTOM).toFixed(6)};
    // The jump of atan2 behind the viewer lands on the same texel, but would pick the smallest mip
    // there: take the gradient of u from a copy whose jump is elsewhere, whichever is smaller.
    float u2 = u < 0.0 ? u + 2.0 : u;
    vec2 dx = vec2(dFdx(u), dFdx(v));
    vec2 dy = vec2(dFdy(u), dFdy(v));
    float dx2 = dFdx(u2);
    float dy2 = dFdy(u2);
    if (abs(dx2) < abs(dx.x)) dx.x = dx2;
    if (abs(dy2) < abs(dy.x)) dy.x = dy2;
    vec3 band = textureGrad(skyBand, vec2(u, clamp(v, 0.0, 1.0)), dx, dy).rgb;
    // Soft top and bottom edges: the band's own top and bottom 10% fade into its averaged edge rows.
    band = mix(band, skyTop, smoothstep(0.9, 1.0, v));
    band = mix(band, skyBottom, 1.0 - smoothstep(0.0, 0.1, v));
    vec3 above = mix(skyTop, skyZenith, smoothstep(${SKY_BAND_TOP.toFixed(6)}, ${ZENITH_AT.toFixed(6)}, el));
    vec3 below = mix(skyBottom, skyFog, smoothstep(${SKY_BAND_BOTTOM.toFixed(6)}, ${FOG_AT.toFixed(6)}, el));
    return v > 1.0 ? above : v < 0.0 ? below : band;
  }`;

/** The uniforms `SKY_GLSL` reads. */
export function skyUniforms(band: THREE.Texture): Record<string, THREE.IUniform> {
  return {
    skyBand: { value: band },
    skyTop: { value: new THREE.Color(SKY_TOP_COLOR) },
    skyBottom: { value: new THREE.Color(SKY_BOTTOM_COLOR) },
    skyZenith: { value: new THREE.Color(SKY_ZENITH_COLOR) },
    skyFog: { value: new THREE.Color(FOG_COLOR) },
  };
}

/**
 * The sky dome: drawn at the far plane (it never hides anything), first or after the opaque scenery
 * (whose pixels the depth test then skips). M10 §2.2: drawing it first measured faster.
 */
export function makeSky(band: THREE.Texture, drawFirst: boolean): THREE.Mesh {
  const geo = new THREE.SphereGeometry(10, 32, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    depthFunc: THREE.LessEqualDepth,
    fog: false,
    uniforms: skyUniforms(band),
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        // On the far plane.
        gl_Position.z = gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      ${SKY_GLSL}
      varying vec3 vDir;
      void main() {
        gl_FragColor = vec4(skyColor(normalize(vDir)), 1.0);
        #include <colorspace_fragment>
      }`,
  });
  const sky = new THREE.Mesh(geo, mat);
  sky.renderOrder = drawFirst ? -1 : 1;
  sky.frustumCulled = false;
  return sky;
}
