/**
 * Atmosphere (M10 §7): light shafts through the sunlit arcades, and clouds and distant spires on
 * painted cards beyond the open edges. Decoration only: two instanced meshes, everything animated in
 * the vertex shaders from one shared time uniform.
 */
import * as THREE from 'three';
import { K_DOOR, K_FLOOR } from '../sim/heights';
import type { GameMap } from '../sim/map';
import { inOpening, OPENING, type Arches } from './arches';
import { FOG_GLSL } from './fog';
import { SKY_FOG_GLSL, skyUniforms } from './sky';
import { SUN_DIR_X, SUN_DIR_Y } from './sun';
import { SUN } from './lightmap';

/** At most this many light shafts (M10 §7.1 allows 24; cut to 12 for the performance gate, §2.3). */
export const MAX_SHAFTS = 12;
const SHAFT_WIDTH = 2;
const SHAFT_OPACITY = 0.25;
/** A shaft fades out as the camera comes closer than this. */
const SHAFT_FADE = 8;
/**
 * The cloud banks behind the Heavenly Gate (M10 gate §3): their centers along the center line's
 * offsets, this far west of the gate's plane, this high above the arena's floor, this wide; they drift
 * GATE_BANK_DRIFT m along y over GATE_BANK_PERIOD s.
 */
const GATE_BANKS = [-21, -13, -5, 5, 13, 21];
const GATE_BANK_BEHIND = 26;
const GATE_BANK_Z = 4;
const GATE_BANK_SIZE = 24;
const GATE_BANK_DRIFT = 3;
const GATE_BANK_PERIOD = 90;
/**
 * Heaven's light behind the gate (M10 gate §3): a quad this far west of the plane, its extent, tint and
 * opacity. Off: cut for the performance gate (M10 gate §4, decisions), the first of its cuts.
 */
const RADIANCE = false;
const RADIANCE_BEHIND = 8;
const RADIANCE_HALF = 20;
const RADIANCE_Z: [number, number] = [-4, 44];
const RADIANCE_TINT = new THREE.Color(1.0, 0.88, 0.6);
const RADIANCE_OPACITY = 0.7;
/** A card fades out as the camera comes closer than this, and is collapsed beyond the fog's end. */
const CARD_FADE = 10;
const CARD_CULL = 150;

/** A light shaft: from the apex of a bay's opening along the sun's direction down to the floor. */
export interface Shaft {
  /** The apex, in map coordinates (x, y, z). */
  top: [number, number, number];
  /** Where it reaches the floor. */
  bottom: [number, number, number];
  /** The bay it shines through (index into arches.bays). */
  bay: number;
}

/** A card: a cloud (faces the camera, drifts) or a spire (turns about its vertical axis only). */
export interface Card {
  kind: 'sea' | 'bank' | 'wisp' | 'spire';
  /** The card's center, in map coordinates. */
  x: number;
  y: number;
  z: number;
  /** Width and height (cards are square: the painting keeps its proportions). */
  size: number;
  /** Which of the sheet's 8 paintings (0-3 clouds, 4-7 spires), and mirrored left to right. */
  cell: number;
  mirror: boolean;
  /** Drift back and forth along (dx, dy): amplitude in meters, period in seconds, phase. */
  drift: number;
  dx: number;
  dy: number;
  period: number;
  phase: number;
}

/** A small seeded random generator (mulberry32), so every client places the same cards. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** The light shafts (M10 §7.1): one through each sunlit bay, at most MAX_SHAFTS, spread evenly. */
export function placeShafts(arches: Arches): Shaft[] {
  const apex = OPENING[OPENING.length >> 1];
  const sunlit = arches.bays.map((b, i) => ({ b, i })).filter(({ b }) => -b.nx * SUN_DIR_X - b.ny * SUN_DIR_Y > 1e-6);
  const pick = sunlit.length <= MAX_SHAFTS ? sunlit : Array.from({ length: MAX_SHAFTS }, (_, k) => sunlit[Math.floor((k * sunlit.length) / MAX_SHAFTS)]);
  return pick.map(({ b, i }) => {
    const along = b.a0 + apex[0];
    const top: [number, number, number] = b.ny !== 0 ? [along, b.plane, b.base + apex[1]] : [b.plane, along, b.base + apex[1]];
    // Into the level, away from the sun, down to the bay's floor.
    const t = apex[1] / SUN.z;
    const bottom: [number, number, number] = [top[0] - SUN.x * t, top[1] - SUN.y * t, b.base];
    return { top, bottom, bay: i };
  });
}

/**
 * The clouds and spires (M10 §7.2, §7.3), placed deterministically beyond the open edges, never over
 * a floor cell at their full size and drift, the spires outside the grid and 25 m apart. Ordered far
 * to near from the level's center, so a near card is drawn over a far one.
 */
export function placeCards(map: GameMap): Card[] {
  const { w, h } = map;
  const hz = map.heights;
  const rand = rng(hash(map.id));
  const range = (a: number, b: number) => a + (b - a) * rand();
  let lowest = Infinity;
  for (let i = 0; i < w * h; i++) if (!map.wall[i]) lowest = Math.min(lowest, map.floor[i]);
  // Open-edge points: each bay's center on its face, with its outward direction and base.
  const edges = hz.bays.map((b) => {
    const xs = b.cells.map(([c]) => c + 0.5);
    const ys = b.cells.map(([, r]) => r + 0.5);
    return { x: xs.reduce((s, v) => s + v, 0) / 4, y: ys.reduce((s, v) => s + v, 0) / 4, ox: b.ox, oy: b.oy, base: b.base };
  });
  const cards: Card[] = [];
  if (edges.length === 0) return cards;
  /** Whether a circle of radius rad around (x, y) touches a floor cell. */
  const overFloor = (x: number, y: number, rad: number): boolean => {
    for (let r = Math.max(0, Math.floor(y - rad)); r <= Math.min(h - 1, Math.floor(y + rad)); r++) {
      for (let c = Math.max(0, Math.floor(x - rad)); c <= Math.min(w - 1, Math.floor(x + rad)); c++) {
        const k = hz.kind[r * w + c];
        if (k !== K_FLOOR && k !== K_DOOR) continue;
        const dx = Math.max(c - x, 0, x - (c + 1));
        const dy = Math.max(r - y, 0, y - (r + 1));
        if (dx * dx + dy * dy < rad * rad) return true;
      }
    }
    return false;
  };
  const place = (kind: Card['kind'], count: number, dist: [number, number], size: [number, number], zOf: (base: number, size: number) => number, drifts: boolean) => {
    for (let n = 0, tries = 0; n < count && tries < count * 50; tries++) {
      const e = edges[Math.floor(rand() * edges.length)];
      const d = range(dist[0], dist[1]);
      const side = range(-12, 12);
      const s = range(size[0], size[1]);
      const x = e.x + e.ox * d - e.oy * side;
      const y = e.y + e.oy * d + e.ox * side;
      const drift = drifts ? range(1, 5) : 0;
      const outside = x < -s || y < -s || x > w + s || y > h + s;
      if (kind === 'spire') {
        if (x >= 0 && y >= 0 && x <= w && y <= h) continue;
        if (cards.some((o) => o.kind === 'spire' && Math.hypot(o.x - x, o.y - y) < 25)) continue;
      }
      if (!outside && overFloor(x, y, s / 2 + drift)) continue;
      cards.push({
        kind, x, y, z: zOf(e.base, s), size: s,
        cell: kind === 'spire' ? 4 + Math.floor(rand() * 4) : kind === 'wisp' ? 3 : Math.floor(rand() * 3),
        mirror: rand() < 0.5,
        drift, dx: -e.oy, dy: e.ox, period: range(60, 120), phase: range(0, Math.PI * 2),
      });
      n++;
    }
  };
  // The cloud sea below the level, banks the arches frame, wisps close by, then the spires.
  // The counts are the spec's minimums, and no wisps: cut in its order (wisps, banks, spires) to pass the
  // performance gate (M10 §2.3, decisions).
  place('sea', 30, [10, 120], [15, 40], () => lowest - range(10, 40), true);
  place('bank', 10, [40, 120], [20, 50], (base) => base + range(-10, 10), true);
  place('wisp', 0, [3, 15], [4, 10], (base) => base + range(-5, 3), true);
  // Spires: feet 20-30 m below the lowest floor, 30-80 m tall (square cards: the painted structure is
  // about 0.4 of the card's width).
  place('spire', 6, [60, 120], [30, 80], (_base, s) => lowest - range(20, 30) + s / 2, false);
  // Banks of cloud behind the Heavenly Gate (M10 gate §3), after the others and without the seeded
  // random, so every other card stays where it is.
  const gate = map.gate;
  if (gate) {
    const F = map.floor[gate.yCenter * w + gate.x];
    GATE_BANKS.forEach((d, k) => {
      cards.push({
        kind: 'bank', x: gate.x - GATE_BANK_BEHIND, y: gate.yCenter + d, z: F + GATE_BANK_Z, size: GATE_BANK_SIZE,
        cell: k % 3, mirror: k % 2 === 1,
        drift: GATE_BANK_DRIFT, dx: 0, dy: 1, period: GATE_BANK_PERIOD, phase: k,
      });
    });
  }
  const cx = w / 2;
  const cy = h / 2;
  cards.sort((a, b) => Math.hypot(b.x - cx, b.y - cy) - Math.hypot(a.x - cx, a.y - cy));
  return cards;
}

const shaftVertex = /* glsl */ `
  ${SKY_FOG_GLSL}
  varying vec3 vSkyFog;
  attribute vec3 iTop;
  attribute vec3 iBottom;
  attribute float iPhase;
  uniform float time;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vec3 axis = iBottom - iTop;
    vec3 mid = (iTop + iBottom) * 0.5;
    // Turned about its own axis to face the camera.
    vec3 side = normalize(cross(axis, cameraPosition - mid));
    vec3 p = mix(iTop, iBottom, 1.0 - position.y) + side * position.x * ${SHAFT_WIDTH.toFixed(1)};
    // Fades out as the camera comes closer than ${SHAFT_FADE} m to its axis.
    vec3 toCam = cameraPosition - iTop;
    float s = clamp(dot(toCam, axis) / dot(axis, axis), 0.0, 1.0);
    float near = smoothstep(0.0, ${SHAFT_FADE.toFixed(1)}, distance(cameraPosition, iTop + axis * s));
    // Its brightness breathes ±10% over about 8 s.
    vAlpha = ${SHAFT_OPACITY.toFixed(2)} * near * (1.0 + 0.1 * sin(time * 0.785398 + iPhase));
    vUv = vec2(position.x + 0.5, position.y);
    vec4 world = vec4(p, 1.0);
    vWorld = world.xyz;
    vSkyFog = skyFogColor(normalize(world.xyz - cameraPosition));
    vec4 mv = viewMatrix * world;
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const cardVertex = /* glsl */ `
  ${SKY_FOG_GLSL}
  varying vec3 vSkyFog;
  attribute vec4 iCard;   // x, z, y (three.js order), size
  attribute vec4 iUv;     // u0, v0, u1, v1
  attribute vec4 iDrift;  // amplitude, period, phase, spire (1) or cloud (0)
  attribute vec2 iDir;    // drift direction (three.js x, z)
  uniform float time;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vec3 c = iCard.xyz;
    c.xz += iDir * iDrift.x * sin(6.2831853 * time / iDrift.y + iDrift.z);
    float size = iCard.w;
    vec3 right;
    vec3 up;
    if (iDrift.w > 0.5) {
      // A spire turns about its vertical axis only, so it stays upright seen from below.
      vec3 f = cameraPosition - c;
      right = normalize(vec3(f.z, 0.0, -f.x));
      up = vec3(0.0, 1.0, 0.0);
    } else {
      right = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]);
      up = vec3(viewMatrix[0][1], viewMatrix[1][1], viewMatrix[2][1]);
    }
    vec3 p = c + (right * position.x + up * position.y) * size;
    float nearest = max(0.0, distance(cameraPosition, c) - size * 0.5);
    vAlpha = smoothstep(0.0, ${CARD_FADE.toFixed(1)}, nearest);
    vUv = mix(iUv.xy, iUv.zw, position.xy + 0.5);
    vec4 world = vec4(p, 1.0);
    vWorld = world.xyz;
    vSkyFog = skyFogColor(normalize(world.xyz - cameraPosition));
    vec4 mv = viewMatrix * world;
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
    // Beyond the fog's end it would be invisible but still blended over its pixels: collapse it.
    if (nearest > ${CARD_CULL.toFixed(1)}) gl_Position = vec4(0.0);
  }`;

/** The radiance: the sprites' haze, into the single fog color. */
const radianceVertex = /* glsl */ `
  varying vec2 vUv;
  varying float vFogDepth;
  void main() {
    vUv = uv;
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    vFogDepth = -mv.z;
    gl_Position = projectionMatrix * mv;
  }`;

const radianceFragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 tint;
  uniform float opacity;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  ${FOG_GLSL}
  varying vec2 vUv;
  varying float vFogDepth;
  void main() {
    vec4 t = texture2D(map, vUv);
    float a = t.a * opacity;
    if (a < 0.003) discard;
    gl_FragColor = vec4(mix(t.rgb * tint, fogColor, heavenFog(vFogDepth)), a);
    #include <colorspace_fragment>
  }`;

const fragment = /* glsl */ `
  uniform sampler2D map;
  uniform vec3 tint;
  uniform float fogNear;
  uniform float fogFar;
  ${FOG_GLSL}
  varying vec3 vSkyFog;
  varying vec2 vUv;
  varying float vAlpha;
  varying vec3 vWorld;
  varying float vFogDepth;
  void main() {
    vec4 t = texture2D(map, vUv);
    float a = t.a * vAlpha;
    if (a < 0.003) discard;
    // Fogged into the sky behind it, so a far card melts into the painting.
    vec3 c = mix(t.rgb * tint, vSkyFog, heavenFog(vFogDepth));
    gl_FragColor = vec4(c, a);
    #include <colorspace_fragment>
  }`;

/** The atmosphere's meshes and their shared time. */
export class Atmosphere {
  readonly shafts: THREE.Mesh;
  readonly cards: THREE.Mesh;
  /** Heaven's light behind the gate (M10 gate §3); null on maps without a gate. */
  readonly radiance: THREE.Mesh | null;
  private readonly time = { value: 0 };

  constructor(map: GameMap, arches: Arches, shaftTex: THREE.Texture, sheet: THREE.Texture, sky: THREE.Texture, glow: THREE.Texture) {
    const material = (tex: THREE.Texture, vertexShader: string, tint: number) =>
      new THREE.ShaderMaterial({
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), ...skyUniforms(sky), map: { value: tex }, tint: { value: new THREE.Color(tint) }, time: this.time },
        vertexShader,
        fragmentShader: fragment,
        fog: true,
        defines: { FOG_SCENERY: '' },
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      });

    // Light shafts: a unit quad, x across (−0.5..0.5), y from the floor (0) to the apex (1).
    const shafts = placeShafts(arches);
    const sg = new THREE.InstancedBufferGeometry();
    sg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, 0, 0, 0.5, 0, 0, 0.5, 1, 0, -0.5, 1, 0], 3));
    sg.setIndex([0, 1, 2, 0, 2, 3]);
    const top: number[] = [];
    const bottom: number[] = [];
    const phase: number[] = [];
    shafts.forEach((s, k) => {
      top.push(s.top[0], s.top[2], s.top[1]);
      bottom.push(s.bottom[0], s.bottom[2], s.bottom[1]);
      phase.push(k * 1.7);
    });
    sg.setAttribute('iTop', new THREE.InstancedBufferAttribute(new Float32Array(top), 3));
    sg.setAttribute('iBottom', new THREE.InstancedBufferAttribute(new Float32Array(bottom), 3));
    sg.setAttribute('iPhase', new THREE.InstancedBufferAttribute(new Float32Array(phase), 1));
    sg.instanceCount = shafts.length;
    this.shafts = new THREE.Mesh(sg, material(shaftTex, shaftVertex, 0xffd98a));
    this.shafts.frustumCulled = false;
    // After the clouds, which are mostly farther away.
    this.shafts.renderOrder = 1;

    // Clouds and spires: a unit quad centered on the card.
    const cards = placeCards(map);
    const cg = new THREE.InstancedBufferGeometry();
    cg.setAttribute('position', new THREE.Float32BufferAttribute([-0.5, -0.5, 0, 0.5, -0.5, 0, 0.5, 0.5, 0, -0.5, 0.5, 0], 3));
    cg.setIndex([0, 1, 2, 0, 2, 3]);
    const card: number[] = [];
    const uv: number[] = [];
    const drift: number[] = [];
    const dir: number[] = [];
    for (const c of cards) {
      card.push(c.x, c.z, c.y, c.size);
      // The sheet: clouds' 2 × 2 on the left half, spires' on the right; v = 0 at the bottom.
      const half = c.cell >= 4 ? 0.5 : 0;
      const q = c.cell % 4;
      const u0 = half + (q % 2) * 0.25;
      const v0 = q < 2 ? 0.5 : 0;
      uv.push(c.mirror ? u0 + 0.25 : u0, v0, c.mirror ? u0 : u0 + 0.25, v0 + 0.5);
      drift.push(c.drift, c.period, c.phase, c.kind === 'spire' ? 1 : 0);
      dir.push(c.dx, c.dy);
    }
    cg.setAttribute('iCard', new THREE.InstancedBufferAttribute(new Float32Array(card), 4));
    cg.setAttribute('iUv', new THREE.InstancedBufferAttribute(new Float32Array(uv), 4));
    cg.setAttribute('iDrift', new THREE.InstancedBufferAttribute(new Float32Array(drift), 4));
    cg.setAttribute('iDir', new THREE.InstancedBufferAttribute(new Float32Array(dir), 2));
    cg.instanceCount = cards.length;
    this.cards = new THREE.Mesh(cg, material(sheet, cardVertex, 0xffffff));
    this.cards.frustumCulled = false;
    // Transparent, so after the whole opaque scene (the sky included): the clouds first, then the
    // radiance over them, then the arena's own effects, so the light never washes over an effect.
    this.cards.renderOrder = -2;
    this.radiance = null;
    const gate = map.gate;
    if (gate && RADIANCE) {
      // One quad facing the arena, fx-glow tinted warm gold, with normal alpha blending (decisions §11.1).
      const F = map.floor[gate.yCenter * map.w + gate.x];
      const geo = new THREE.PlaneGeometry(2 * RADIANCE_HALF, RADIANCE_Z[1] - RADIANCE_Z[0]);
      geo.rotateY(Math.PI / 2);
      const mat = new THREE.ShaderMaterial({
        uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), map: { value: glow }, tint: { value: RADIANCE_TINT }, opacity: { value: RADIANCE_OPACITY } },
        vertexShader: radianceVertex,
        fragmentShader: radianceFragment,
        fog: true,
        transparent: true,
        depthWrite: false,
      });
      const m = new THREE.Mesh(geo, mat);
      // three.js: x = x, y = z, z = y.
      m.position.set(gate.x - RADIANCE_BEHIND, F + (RADIANCE_Z[0] + RADIANCE_Z[1]) / 2, gate.yCenter);
      m.renderOrder = -1;
      this.radiance = m;
    }
  }

  /** The shared time uniform: the only per-frame work (M10 §2.1). */
  update(nowMs: number): void {
    this.time.value = (nowMs / 1000) % 100000;
  }
}

/** Whether a shaft starts inside its bay's opening (it shines through the arch). */
export function shaftThroughOpening(arches: Arches, s: Shaft): boolean {
  const b = arches.bays[s.bay];
  const along = b.ny !== 0 ? s.top[0] : s.top[1];
  return inOpening(along - b.a0, s.top[2] - b.base - 0.05);
}
