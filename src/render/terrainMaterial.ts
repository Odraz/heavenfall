/**
 * The terrain's shader (M10 §5.1): the texture array's layer chosen per vertex, times the vertex
 * colors, fogged as scenery into the sky's color in the view direction (M10 §4.2); a cliff's foot
 * fades into that same color (M10 §3.5). Floors take the baked lightmap; vertical faces their baked
 * direction shading (in the vertex colors) and, below their shadow line, the floor's shadow (M10 §5.2).
 * Doors use the same shader with their own texture.
 */
import * as THREE from 'three';
import { FOG_GLSL } from './fog';
import { LIGHT_GAIN, LIT, SHADE } from './lightmap';
import { SKY_FOG_GLSL, skyUniforms } from './sky';

const VERTEX = /* glsl */ `
  ${SKY_FOG_GLSL}
  varying vec3 vSkyFog;
  attribute float layer;
  attribute float fade;
  attribute float shadowZ;
  attribute float floorTop;
  varying float vShadowZ;
  varying float vFloor;
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
    vShadowZ = shadowZ;
    vFloor = floorTop;
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    // The sky's color behind this point, which the scenery fogs into (M10 §4.2): it changes slowly
    // with the direction, so it's found per vertex and interpolated.
    vSkyFog = skyFogColor(normalize(world.xyz - cameraPosition));
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
  uniform sampler2D lightmap;
  uniform vec2 mapSize;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  ${FOG_GLSL}
  varying vec3 vSkyFog;
  varying vec2 vUv;
  varying vec3 vColor;
  flat varying float vLayer;
  varying float vFade;
  varying vec3 vWorld;
  varying float vFogDepth;
  varying float vShadowZ;
  varying float vFloor;
  const vec3 SHADOW_TINT = vec3(SHADOW_R, SHADOW_G, SHADOW_B);
  void main() {
    float alpha = 1.0;
    #ifdef SINGLE
      vec3 c = texture(map, vUv).rgb;
    #elif defined(CUTOUT)
      // The arches' painted faces (M10 §6): alpha to coverage. Smaller mip levels average thin shapes
      // away, so alpha is scaled up with the level sampled (25% per level) and sharpened by its
      // screen-space rate of change, so the balusters stay whole at distance.
      vec2 size = vec2(textureSize(terrainTex, 0).xy);
      vec2 ddx = dFdx(vUv * size);
      vec2 ddy = dFdy(vUv * size);
      float lod = max(0.0, 0.5 * log2(max(dot(ddx, ddx), dot(ddy, ddy))));
      // v stays half a texel (at the level sampled) inside the layer: the arcade's two layers meet at
      // 4 m, and filtering across the repeat would blend in the layer's opposite edge as a dark line.
      float halfTexel = 0.5 * exp2(lod) / size.y;
      vec4 t4 = texture(terrainTex, vec3(vUv.x, clamp(vUv.y, halfTexel, 1.0 - halfTexel), vLayer));
      alpha = t4.a * (1.0 + 0.25 * lod);
      alpha = clamp((alpha - 0.5) / max(fwidth(alpha), 1e-4) + 0.5, 0.0, 1.0);
      if (alpha < 0.01) discard;
      vec3 c = t4.rgb;
    #else
      vec3 c = texture(terrainTex, vec3(vUv, vLayer)).rgb;
    #endif
    c *= vColor;
    if (vFloor > 0.5) {
      // Floors: the lightmap, by world position (three.x = x, three.z = y).
      c *= texture(lightmap, vWorld.xz / mapSize).rgb * LIGHT_GAIN_V;
    } else {
      // A sun-facing face's shadow line, with a soft edge 0.2 m tall.
      c *= mix(vec3(1.0), SHADOW_TINT, 1.0 - smoothstep(vShadowZ - 0.2, vShadowZ, vWorld.y));
    }
    c = mix(c, vSkyFog, max(vFade, heavenFog(vFogDepth)));
    gl_FragColor = vec4(c, alpha);
    #include <colorspace_fragment>
  }`;

/** The terrain's material over a texture array, or over one texture (`single`, the doors). */
export function makeTerrainMaterial(tex: THREE.DataArrayTexture | THREE.Texture, sky: THREE.Texture, lightmap: THREE.Texture, mapW: number, mapH: number, cutout = false): THREE.ShaderMaterial {
  const single = !(tex as THREE.DataArrayTexture).isDataArrayTexture;
  return new THREE.ShaderMaterial({
    // The painted faces: double-sided, cut out with alpha to coverage (the renderer has MSAA).
    ...(cutout ? { side: THREE.DoubleSide, alphaToCoverage: true } : {}),
    vertexColors: true,
    fog: true,
    defines: {
      FOG_SCENERY: '',
      ...(single ? { SINGLE: '' } : {}),
      ...(cutout ? { CUTOUT: '' } : {}),
      LIGHT_GAIN_V: LIGHT_GAIN.toFixed(4),
      // A shadowed face takes the floor's shadow: the shadow color relative to the lit one.
      SHADOW_R: (SHADE[0] / LIT[0]).toFixed(4),
      SHADOW_G: (SHADE[1] / LIT[1]).toFixed(4),
      SHADOW_B: (SHADE[2] / LIT[2]).toFixed(4),
    },
    uniforms: {
      ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),
      ...skyUniforms(sky),
      lightmap: { value: lightmap },
      mapSize: { value: new THREE.Vector2(mapW, mapH) },
      ...(single ? { map: { value: tex } } : { terrainTex: { value: tex } }),
    },
    vertexShader: VERTEX,
    fragmentShader: FRAGMENT,
  });
}
