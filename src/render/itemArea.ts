/**
 * Item areas drawn in the Field of Blood's language (bloodPool.ts): a filled surface on the exact floor
 * cells the host's area covers, the area's exact edge as a line, a spread when it lands and a fade at
 * its end. Each item has one look of its own: Bitter Water is a bubbling green pool, Ash a matte violet
 * disc whose flakes drift inward, the Chain Jar a scorched circle ringed by red-hot chain links, the
 * Plume a gold circle of feather vanes pushing outward. The Mirror Ward is a glass dome instead. No
 * rising glare: that stays the Field of Blood's. Positions are simulation coordinates (z up).
 */
import * as THREE from 'three';
import { ITEMS, type ItemId } from '../data/items';
import { itemAreaCells } from '../sim/consumables';
import type { GameMap } from '../sim/map';

/** The surface sits this far above each cell's floor, under the Field of Blood (0.03 m). */
export const AREA_LIFT = 0.025;
/** An area spreads over 0.3 s and fades over its last 0.5 s, in ticks. */
export const SPREAD_TICKS = 9;
export const FADE_TICKS = 15;
/** The Mirror Ward's sphere is centred 1 m above its floor (consumables.ts). */
const MIRROR_HEIGHT = 1;

/** The shader's look per floor item. */
export const LOOKS: Partial<Record<ItemId, number>> = { venom: 0, frost: 1, chain: 2, plume: 3 };
/** Each item's edge line color (the area's exact edge). */
export const EDGE_COLORS: Record<ItemId, number> = {
  balm: 0x65df85, seal: 0x7bbdff, feather: 0xf2eedb, mirror: 0xd8f0ff, venom: 0x8cff5a, frost: 0xc9a6ff, chain: 0xff7a2a, plume: 0xffc040,
};

/** Size 0–1 at `tick`: growing over 0.3 s after landing, shrinking with the fade over the last 0.5 s. */
export function areaScale(tick: number, activated: number, end: number): number {
  return Math.max(0, Math.min(1, (tick - activated) / SPREAD_TICKS) * Math.min(1, (end - tick) / FADE_TICKS));
}
/** Opacity 0–1 at `tick`: full until the last 0.5 s. */
export function areaAlpha(tick: number, end: number): number {
  return Math.max(0, Math.min(1, (end - tick) / FADE_TICKS));
}

const floorVertex = /* glsl */ `
varying vec2 vP;
void main() {
  // Simulation x, y are three.js x, z.
  vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const floorFragment = /* glsl */ `
uniform vec2 uCenter;
uniform float uRadius;
uniform float uTime;
uniform float uScale;
uniform float uAlpha;
uniform float uSeed;
uniform float uLook;
uniform vec3 uEdge;
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

// Bitter Water: deep green liquid, gloss streaks, and bubbles that swell and pop.
vec4 water(float t, float dist) {
  vec3 c = mix(vec3(0.04, 0.20, 0.05), vec3(0.20, 0.62, 0.14), smoothstep(0.2, 1.0, t));
  float n1 = noise(vP * vec2(0.9, 2.2) + vec2(uTime * 0.18, uTime * 0.05));
  float n2 = noise(vP * vec2(2.1, 0.8) - vec2(uTime * 0.07, uTime * 0.15));
  c += vec3(0.55, 1.0, 0.45) * smoothstep(0.55, 0.9, n1 * n2 * 1.9) * 0.3;
  // One bubble per 0.9 m cell for about half the cells, each on its own 1.6 s cycle.
  vec2 cell = floor(vP / 0.9);
  float h = hash(cell);
  vec2 center = (cell + 0.25 + 0.5 * vec2(h, fract(h * 7.3))) * 0.9;
  float phase = fract(uTime / 1.6 + h);
  float r = 0.06 + 0.2 * phase;
  float ring = (1.0 - smoothstep(0.02, 0.05, abs(length(vP - center) - r))) * step(0.45, h) * (1.0 - phase * phase);
  c = mix(c, vec3(0.7, 1.0, 0.55), ring * 0.8);
  return vec4(c, 0.82);
}

// Ash of Stillness: matte grainy violet, small pale flakes drifting toward the center. No gloss.
vec4 ash(float t, vec2 d) {
  vec3 c = mix(vec3(0.22, 0.13, 0.33), vec3(0.50, 0.37, 0.70), smoothstep(0.1, 1.0, t));
  c *= 0.85 + 0.3 * hash(floor(vP * 14.0));
  // Sampling further out as time passes moves the flakes inward, 0.8 m/s.
  vec2 q = (vP + normalize(d + 1e-4) * uTime * 0.8) / 0.35;
  vec2 cell = floor(q);
  float h = hash(cell);
  float speck = (1.0 - smoothstep(0.12, 0.2, length(fract(q) - 0.3 - 0.4 * vec2(h, fract(h * 13.1))))) * step(0.55, h);
  c = mix(c, vec3(0.90, 0.86, 1.0), speck);
  return vec4(c, 0.78);
}

// Chain Jar: a scorched circle with a rim of red-hot chain links lying along the edge.
vec4 chain(float t, float dist, float ang, float R) {
  vec3 c = mix(vec3(0.10, 0.04, 0.03), vec3(0.28, 0.08, 0.04), smoothstep(0.5, 1.0, t));
  float a = 0.5;
  // Links along the arc, 1 m each, alternating flat (an oval ring) and edge-on (a short bar).
  float s = ang * R;
  float y = dist - (R - 0.4);
  float k = floor(s / 1.0);
  float x = s - (k + 0.5) * 1.0;
  float link;
  if (mod(k, 2.0) < 1.0) {
    float e = length(vec2(x / 0.52, y / 0.26));
    link = 1.0 - smoothstep(0.22, 0.36, abs(e - 1.0));
  } else {
    link = (1.0 - smoothstep(0.06, 0.1, abs(y))) * (1.0 - smoothstep(0.5, 0.58, abs(x)));
  }
  float pulse = 0.75 + 0.25 * sin(uTime * 4.0 + k * 0.7);
  vec3 hot = mix(vec3(0.85, 0.16, 0.05), vec3(1.0, 0.78, 0.32), pulse * (1.0 - smoothstep(0.0, 0.2, abs(y))));
  // Heat glows inward from the rim.
  c += vec3(0.6, 0.12, 0.02) * smoothstep(R - 1.4, R - 0.3, dist) * 0.5 * pulse;
  c = mix(c, hot, link);
  return vec4(c, max(a, link));
}

// Plume of Expulsion: gold with amber feather vanes radiating out and pushing outward. Gold, not
// ivory: the floors are ivory marble.
vec4 plume(float t, float dist, float ang) {
  float spoke = abs(fract(ang / 6.2832 * 20.0 + 0.04 * sin(dist * 2.0)) - 0.5);
  float quill = 1.0 - smoothstep(0.015, 0.035, spoke);
  float barbs = smoothstep(0.5, 0.15, spoke) * (0.5 + 0.5 * sin((dist * 6.0 - uTime * 4.0) + spoke * 20.0));
  vec3 c = mix(vec3(0.93, 0.70, 0.25), vec3(0.62, 0.36, 0.08), barbs);
  c = mix(c, vec3(1.0, 0.94, 0.62), quill);
  float a = 0.35 + 0.35 * barbs * smoothstep(0.1, 0.4, t) + 0.45 * quill * smoothstep(0.15, 0.3, t);
  return vec4(c, a);
}

void main() {
  vec2 d = vP - uCenter;
  float dist = length(d);
  float ang = atan(d.y, d.x);
  float R = uRadius * uScale;
  // The surface's edge wobbles between 93% and 100% of the radius; the line marks the exact radius.
  float w = 0.5 + 0.5 * (0.5 * sin(3.0 * ang + uSeed) + 0.3 * sin(5.0 * ang + uSeed * 1.7) + 0.2 * sin(8.0 * ang + uSeed * 2.3));
  float edge = R * (0.93 + 0.07 * w);
  vec4 fill = vec4(0.0);
  // A negative look (the Mirror Ward) draws only the edge line.
  if (uLook >= 0.0 && dist <= edge) {
    float t = dist / max(edge, 1e-3);
    if (uLook < 0.5) fill = water(t, dist);
    else if (uLook < 1.5) fill = ash(t, d);
    else if (uLook < 2.5) fill = chain(t, dist, ang, R);
    else fill = plume(t, dist, ang);
  }
  float line = (1.0 - smoothstep(0.065, 0.085, abs(dist - R))) * 0.6;
  float a = line + fill.a * (1.0 - line);
  if (a * uAlpha < 0.01) discard;
  vec3 rgb = (uEdge * line + fill.rgb * fill.a * (1.0 - line)) / a;
  gl_FragColor = vec4(rgb, a * uAlpha);
}
`;

const domeVertex = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
varying float vH;
void main() {
  vec4 world = modelMatrix * vec4(position, 1.0);
  vH = world.y;
  vN = normalize(mat3(modelMatrix) * normal);
  vV = normalize(cameraPosition - world.xyz);
  gl_Position = projectionMatrix * viewMatrix * world;
}
`;

const domeFragment = /* glsl */ `
uniform float uTime;
uniform float uAlpha;
uniform float uFloor;
varying vec3 vN;
varying vec3 vV;
varying float vH;
void main() {
  if (vH < uFloor) discard;
  // Glass: nearly clear facing you, silver toward its outline, with a slow shimmer rising.
  float rim = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.5);
  float shimmer = 0.5 + 0.5 * sin((vH - uFloor) * 3.0 - uTime * 2.0);
  float a = 0.05 + 0.55 * rim + 0.06 * shimmer;
  vec3 c = mix(vec3(0.70, 0.85, 1.0), vec3(1.0), rim);
  gl_FragColor = vec4(c, a * uAlpha);
}
`;

/** Seeded by the center, so each area has its own outline. */
function seedOf(x: number, y: number): number {
  return ((x * 12.9898 + y * 78.233) % 6.283) + 1;
}

/** One quad per covered cell, lifted above its own floor. */
function cellGeometry(map: GameMap, cells: Iterable<number>, lift: number): THREE.BufferGeometry {
  const pos: number[] = [];
  const index: number[] = [];
  for (const i of cells) {
    const c = i % map.w;
    const r = Math.floor(i / map.w);
    const h = map.floor[i] + lift;
    const k = pos.length / 3;
    pos.push(c, h, r, c + 1, h, r, c + 1, h, r + 1, c, h, r + 1);
    index.push(k, k + 2, k + 1, k, k + 3, k + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}

/** A landed item area: the floor surface, or for the Mirror Ward its dome and floor edge. */
export class ItemArea {
  readonly group = new THREE.Group();
  private readonly materials: THREE.ShaderMaterial[] = [];
  private readonly geometries: THREE.BufferGeometry[] = [];

  constructor(map: GameMap, readonly item: ItemId, x: number, y: number, z: number, room: number, readonly activated: number, readonly end: number) {
    const radius = ITEMS[item].radius;
    if (item === 'mirror') {
      // The sphere meets the floor in a circle of radius √(r² − h²).
      const dome = new THREE.SphereGeometry(radius, 48, 24);
      const material = new THREE.ShaderMaterial({
        vertexShader: domeVertex, fragmentShader: domeFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
        uniforms: { uTime: { value: 0 }, uAlpha: { value: 1 }, uFloor: { value: z + 0.02 } },
      });
      const mesh = new THREE.Mesh(dome, material);
      mesh.position.set(x, z + MIRROR_HEIGHT, y);
      this.group.add(mesh);
      this.materials.push(material); this.geometries.push(dome);
    }
    const look = LOOKS[item];
    const floorRadius = item === 'mirror' ? Math.sqrt(radius * radius - MIRROR_HEIGHT * MIRROR_HEIGHT) : radius;
    const geo = cellGeometry(map, itemAreaCells(map, x, y, room, floorRadius), AREA_LIFT);
    const edge = new THREE.Color(EDGE_COLORS[item]);
    const material = new THREE.ShaderMaterial({
      vertexShader: floorVertex, fragmentShader: floorFragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uCenter: { value: new THREE.Vector2(x, y) }, uRadius: { value: floorRadius }, uTime: { value: 0 }, uScale: { value: 0 },
        uAlpha: { value: 1 }, uSeed: { value: seedOf(x, y) },
        uLook: { value: look ?? -1 }, uEdge: { value: new THREE.Vector3(edge.r, edge.g, edge.b) },
      },
    });
    const mesh = new THREE.Mesh(geo, material);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    this.materials.push(material); this.geometries.push(geo);
  }

  /** Spread, fade and animate at the estimated `tick`; hidden once the area has ended. */
  update(tick: number): void {
    this.group.visible = tick < this.end;
    const scale = areaScale(tick, this.activated, this.end);
    const alpha = areaAlpha(tick, this.end);
    const time = Math.max(0, (tick - this.activated) / 30);
    for (const m of this.materials) {
      m.uniforms.uTime.value = time;
      m.uniforms.uAlpha.value = alpha;
      if (m.uniforms.uScale) m.uniforms.uScale.value = scale;
    }
    // The dome grows with the spread like the floor surfaces.
    if (this.item === 'mirror') this.group.children[0].scale.setScalar(Math.max(1e-3, scale));
  }

  dispose(): void {
    this.group.removeFromParent();
    for (const g of this.geometries) g.dispose();
    for (const m of this.materials) m.dispose();
  }
}
