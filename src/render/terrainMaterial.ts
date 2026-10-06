/**
 * The terrain's shader (M10 §5.1): the texture array's layer chosen per vertex, times the vertex
 * colors, fogged as scenery into the sky's color in the view direction (M10 §4.2); a cliff's foot
 * fades into that same color (M10 §3.5). Doors use the same shader with their own texture.
 */
import * as THREE from 'three';
import { FOG_GLSL } from './fog';
import { SKY_FOG_GLSL, skyUniforms } from './sky';

const VERTEX = /* glsl */ `
  attribute float layer;
  attribute float fade;
  varying vec2 vUv;
  varying vec3 vColor;
  flat varying float vLayer;
  varying float vFade;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vUv = uv;
    vColor = color;
    vLayer = layer;
    vFade = fade;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    vec4 mv = viewMatrix * world;
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const FRAGMENT = /* glsl */ `
  #ifdef SINGLE
    uniform sampler2D map;
  #else
    uniform sampler2DArray terrainTex;
  #endif
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  ${FOG_GLSL}
  ${SKY_FOG_GLSL}
  varying vec2 vUv;
  varying vec3 vColor;
  flat varying float vLayer;
  varying float vFade;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    #ifdef SINGLE
      vec3 c = texture(map, vUv).rgb;
    #else
      vec3 c = texture(terrainTex, vec3(vUv, vLayer)).rgb;
    #endif
    c *= vColor;
    vec3 sky = skyFogColor(normalize(vWorld - cameraPosition));
    c = mix(c, sky, max(vFade, heavenFog(vFogDepth)));
    gl_FragColor = vec4(c, 1.0);
    #include <colorspace_fragment>
  }`;

/** The terrain's material over a texture array, or over one texture (`single`, the doors). */
export function makeTerrainMaterial(tex: THREE.DataArrayTexture | THREE.Texture, sky: THREE.Texture): THREE.ShaderMaterial {
  const single = !(tex as THREE.DataArrayTexture).isDataArrayTexture;
  return new THREE.ShaderMaterial({
    vertexColors: true,
    fog: true,
    defines: { FOG_SCENERY: '', ...(single ? { SINGLE: '' } : {}) },
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...skyUniforms(sky),
      ...(single ? { map: { value: tex } } : { terrainTex: { value: tex } }),
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
}
