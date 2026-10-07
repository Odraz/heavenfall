/**
 * The fog curve with its near haze (M10 §4.2). It replaces three.js's linear fog for every fogged
 * material: the amount rises from 0 at FOG_NEAR to its value at FOG_KNEE, then on to 100% at
 * FOG_FAR, linearly in each part. Scenery (materials with the FOG_SCENERY define) fogs to 30% at the
 * knee, sprites and effects to half that, so enemies stand out from the haze.
 */
import * as THREE from 'three';

export const FOG_NEAR = 10;
export const FOG_KNEE = 40;
export const FOG_FAR = 150;
export const FOG_AT_KNEE_SCENERY = 0.3;
export const FOG_AT_KNEE_SPRITES = 0.15;

/** The fog amount 0–1 at a view depth in meters. */
export function fogAmount(depth: number, scenery: boolean): number {
  const knee = scenery ? FOG_AT_KNEE_SCENERY : FOG_AT_KNEE_SPRITES;
  if (depth < FOG_KNEE) return knee * Math.min(Math.max((depth - FOG_NEAR) / (FOG_KNEE - FOG_NEAR), 0), 1);
  return knee + (1 - knee) * Math.min((depth - FOG_KNEE) / (FOG_FAR - FOG_KNEE), 1);
}

const f = (v: number): string => v.toFixed(4);

/** GLSL for `fogAmount`, as `float heavenFog(float depth)`; needs `fogNear` and `fogFar` declared. */
export const FOG_GLSL = /* glsl */ `
  float heavenFog(float depth) {
    #ifdef FOG_SCENERY
      float knee = ${f(FOG_AT_KNEE_SCENERY)};
    #else
      float knee = ${f(FOG_AT_KNEE_SPRITES)};
    #endif
    return depth < ${f(FOG_KNEE)}
      ? knee * clamp((depth - fogNear) / (${f(FOG_KNEE)} - fogNear), 0.0, 1.0)
      : mix(knee, 1.0, clamp((depth - ${f(FOG_KNEE)}) / (fogFar - ${f(FOG_KNEE)}), 0.0, 1.0));
  }`;

let installed = false;

/** Replaces three.js's fog shader chunks with the curve, once, before any material compiles. */
export function installFogCurve(): void {
  if (installed) return;
  installed = true;
  THREE.ShaderChunk.fog_pars_fragment = /* glsl */ `
    #ifdef USE_FOG
      uniform vec3 fogColor;
      varying float vFogDepth;
      uniform float fogNear;
      uniform float fogFar;
      ${FOG_GLSL}
    #endif`;
  THREE.ShaderChunk.fog_fragment = /* glsl */ `
    #ifdef USE_FOG
      gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, heavenFog(vFogDepth));
    #endif`;
}
