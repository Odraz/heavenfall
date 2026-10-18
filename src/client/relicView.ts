/**
 * Relic effects on every client (rogue items-relics.md §2.2–§2.3), from the host's accepted records: the
 * slowing floor areas in the item areas' Field of Blood language (Usher's violet ash with a red edge,
 * the First Plea's burning rune, the Comb's six violet teeth across the lane), projectiles flying their
 * accepted line (embers, the gold wheel, the Counterseal's stamp, Harrow's broad wheel) and one-wave
 * rings and bursts. Positions are simulation coordinates (z up); three.js y is up.
 */
import * as THREE from 'three';
import { RELIC } from '../data/relics';
import type { RelicAreaState, RelicShotState } from '../net/messages';
import { itemAreaCells } from '../sim/consumables';
import { combCells } from '../sim/relics';
import type { GameMap } from '../sim/map';
import type { Vfx } from '../render/vfx';
import { AREA_LIFT, areaAlpha, areaScale } from '../render/itemArea';
import { RELIC_ART } from './itemArt';
import { spriteUrl } from '../render/atlas';

/** Each effect's color: rings, bursts, area edges and projectile glows. */
export const RELIC_COLORS: Record<string, number> = {
  usher: 0xd84a4a, thurible: 0xff8a30, link: 0xf3ead2, tile: 0xff7a2a, qseal: 0xb27cff, eseal: 0xfff0c8, comb: 0xc9a6ff, wheel: 0xffd27a,
  unbroken: 0xf8f4e8, mercy: 0x6fb6ff, armageddon: 0xffd27a, sentence3: 0xe8c060,
  expulsion: 0xf8f4e8, abandoned: 0xd08a40, chorus: 0xffe08a, appeal: 0xe8c060, reversal: 0xb27cff, harrow: 0xffd27a,
};

const vertex = /* glsl */ `
varying vec2 vP;
void main() {
  vP = position.xz;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const fragment = /* glsl */ `
uniform vec2 uCenter;
uniform vec2 uHeading;
uniform float uShape;
uniform float uRadius;
uniform float uLength;
uniform float uWidth;
uniform float uScale;
uniform float uAlpha;
uniform float uTime;
uniform float uRune;
uniform vec3 uEdge;
varying vec2 vP;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// Matte violet ash, as Ash of Stillness, with pale flakes drifting inward.
vec3 ash(float t, vec2 d) {
  vec3 c = mix(vec3(0.24, 0.13, 0.36), vec3(0.50, 0.36, 0.72), smoothstep(0.1, 1.0, t));
  c *= 0.85 + 0.3 * hash(floor(vP * 14.0));
  vec2 q = (vP + normalize(d + 1e-4) * uTime * 0.8) / 0.35;
  float h = hash(floor(q));
  float speck = (1.0 - smoothstep(0.12, 0.2, length(fract(q) - 0.3 - 0.4 * vec2(h, fract(h * 13.1))))) * step(0.6, h);
  return mix(c, vec3(0.92, 0.86, 1.0), speck);
}

void main() {
  vec2 d = vP - uCenter;
  float a = 0.0;
  vec3 c = vec3(0.0);
  float line = 0.0;
  if (uShape < 0.5) {
    float dist = length(d), R = uRadius * uScale;
    if (dist <= R) {
      c = ash(dist / max(R, 1e-3), d); a = 0.72;
      if (uRune > 0.5) {
        // The First Plea's rune: an inner burning circle and six spokes.
        float ang = atan(d.y, d.x);
        float ring = 1.0 - smoothstep(0.05, 0.1, abs(dist - R * 0.62));
        float spoke = (1.0 - smoothstep(0.03, 0.07, abs(fract(ang / 6.2832 * 6.0) - 0.5) * dist)) * step(R * 0.62, dist);
        float glow = max(ring, spoke) * (0.7 + 0.3 * sin(uTime * 5.0));
        c = mix(c, vec3(0.95, 0.62, 1.0), glow); a = max(a, glow);
      }
    }
    line = (1.0 - smoothstep(0.065, 0.085, abs(dist - R))) * 0.7;
  } else {
    // The Comb: long axis across the attack's heading, six teeth running along the heading.
    vec2 across = vec2(-uHeading.y, uHeading.x);
    float u = dot(d, across), v = dot(d, uHeading);
    float L = uLength * 0.5 * uScale, W = uWidth * 0.5;
    if (abs(u) <= L && abs(v) <= W) {
      c = ash(abs(u) / max(L, 1e-3), d); a = 0.6;
      float tooth = 1.0 - smoothstep(0.08, 0.16, abs(fract((u / max(L, 1e-3) * 0.5 + 0.5) * 6.0) - 0.5));
      c = mix(c, vec3(0.86, 0.72, 1.0), tooth); a = max(a, 0.6 + 0.3 * tooth);
    }
    float edge = max(abs(u) - L, abs(v) - W);
    line = (1.0 - smoothstep(0.0, 0.08, abs(edge))) * 0.7;
  }
  float alpha = line + a * (1.0 - line);
  if (alpha * uAlpha < 0.01) discard;
  vec3 rgb = (uEdge * line + c * a * (1.0 - line)) / max(alpha, 1e-3);
  gl_FragColor = vec4(rgb, alpha * uAlpha);
}
`;

function cellGeometry(map: GameMap, cells: Iterable<number>): THREE.BufferGeometry {
  const pos: number[] = [], index: number[] = [];
  for (const i of cells) {
    const c = i % map.w, r = Math.floor(i / map.w), h = map.floor[i] + AREA_LIFT + 0.002, k = pos.length / 3;
    pos.push(c, h, r, c + 1, h, r, c + 1, h, r + 1, c, h, r + 1);
    index.push(k, k + 2, k + 1, k, k + 3, k + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(index);
  return geo;
}

interface LiveArea { state: RelicAreaState; mesh: THREE.Mesh; material: THREE.ShaderMaterial; badge: THREE.Sprite | null }
interface LiveShot { state: RelicShotState; sprite: THREE.Sprite; spin: number }

export class RelicView {
  readonly group = new THREE.Group();
  private readonly areas = new Map<number, LiveArea>();
  private readonly shots = new Map<number, LiveShot>();
  private readonly textures = new Map<string, THREE.Texture>();
  private readonly loader = new THREE.TextureLoader();

  constructor(private readonly map: GameMap, private readonly vfx: Vfx) {}

  private texture(url: string): THREE.Texture {
    let t = this.textures.get(url);
    if (!t) { t = this.loader.load(url); t.colorSpace = THREE.SRGBColorSpace; this.textures.set(url, t); }
    return t;
  }

  sync(areas: readonly RelicAreaState[], shots: readonly RelicShotState[]): void {
    for (const id of [...this.areas.keys()]) this.endArea(id);
    for (const id of [...this.shots.keys()]) this.endShot(id);
    for (const a of areas) this.area(a);
    for (const s of shots) this.shot(s);
  }

  area(a: RelicAreaState): void {
    if (this.areas.has(a.id)) return;
    const room = this.map.roomOf[Math.floor(a.y) * this.map.w + Math.floor(a.x)];
    const cells = a.shape === 'circle' ? itemAreaCells(this.map, a.x, a.y, room, a.radius) : combCells(this.map, a.x, a.y, a.z, room, a.hx, a.hy);
    const edge = new THREE.Color(RELIC_COLORS[a.effect] ?? 0xc9a6ff);
    const material = new THREE.ShaderMaterial({
      vertexShader: vertex, fragmentShader: fragment, transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        uCenter: { value: new THREE.Vector2(a.x, a.y) }, uHeading: { value: new THREE.Vector2(a.hx, a.hy) },
        uShape: { value: a.shape === 'circle' ? 0 : 1 }, uRadius: { value: a.radius }, uLength: { value: a.length }, uWidth: { value: a.width },
        uScale: { value: 0 }, uAlpha: { value: 1 }, uTime: { value: 0 }, uRune: { value: a.effect === 'qseal' ? 1 : 0 },
        uEdge: { value: new THREE.Vector3(edge.r, edge.g, edge.b) },
      },
    });
    const mesh = new THREE.Mesh(cellGeometry(this.map, cells), material);
    mesh.frustumCulled = false;
    this.group.add(mesh);
    // Usher's red badge lies in its ash; the other areas show their pattern only.
    let badge: THREE.Sprite | null = null;
    if (a.effect === 'usher') {
      badge = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.texture(RELIC_ART.usher), depthWrite: false, alphaTest: 0.05 }));
      badge.scale.set(0.7, 0.7, 1); badge.position.set(a.x, a.z + 0.35, a.y);
      this.group.add(badge);
    }
    this.areas.set(a.id, { state: a, mesh, material, badge });
  }

  endArea(id: number): void {
    const live = this.areas.get(id);
    if (!live) return;
    this.areas.delete(id);
    live.mesh.removeFromParent(); live.mesh.geometry.dispose(); live.material.dispose();
    if (live.badge) { live.badge.removeFromParent(); live.badge.material.dispose(); }
  }

  shot(s: RelicShotState): void {
    if (this.shots.has(s.id)) return;
    const wheel = s.effect === 'wheel' || s.effect === 'harrow', stamp = s.effect === 'sentence3';
    const url = wheel ? RELIC_ART.wheel : stamp ? RELIC_ART.sentence3 : spriteUrl('ember');
    const material = new THREE.SpriteMaterial({ map: this.texture(url), depthWrite: false, alphaTest: 0.05, color: wheel || stamp ? 0xffffff : RELIC_COLORS[s.effect] ?? 0xffffff });
    const sprite = new THREE.Sprite(material);
    const size = s.effect === 'harrow' ? RELIC.harrow.width : wheel ? 0.8 : stamp ? 0.9 : 0.5;
    sprite.scale.set(size, size, 1);
    this.group.add(sprite);
    this.shots.set(s.id, { state: s, sprite, spin: wheel ? 1 : 0 });
  }

  /** A projectile ended where the host says: a glow there, and the Counterseal's black-gold burst. */
  endShot(id: number, at?: { x: number; y: number; z: number }, now = performance.now()): void {
    const live = this.shots.get(id);
    if (!live) return;
    this.shots.delete(id);
    live.sprite.removeFromParent(); live.sprite.material.dispose();
    if (at) this.vfx.glow(now, at.x, at.y, at.z, RELIC_COLORS[live.state.effect] ?? 0xffffff, 0.2, 0.8, 220);
  }

  /** A one-wave ring on the floor, or a burst sphere; Mercy's Wax closes blue around its collector. */
  fx(e: { effect: string; kind: 'ring' | 'burst' | 'shield'; x: number; y: number; z: number; radius: number }, now: number): void {
    const color = RELIC_COLORS[e.effect] ?? 0xffffff;
    if (e.kind === 'ring') {
      this.vfx.ring(now, e.x, e.y, e.z + 0.06, color, 0.3, e.radius, 420);
      this.vfx.glow(now, e.x, e.y, e.z + 0.4, color, 0.2, 1.2, 260, 0, 0.6);
    } else if (e.kind === 'burst') {
      this.vfx.burstSphere(now, e.x, e.y, e.z, color, 0.3, e.radius, 380, 0.45);
      this.vfx.ring(now, e.x, e.y, e.z, color, 0.5, e.radius, 380);
    } else this.vfx.sphere(now, e.x, e.y, e.z + 0.9, color, 0.9, 1.1, 600, 0.35);
  }

  /** At the estimated host tick: area spread/fade, projectiles along their accepted lines. */
  update(tick: number): void {
    for (const live of this.areas.values()) {
      const a = live.state, m = live.material.uniforms;
      m.uScale.value = areaScale(tick, a.startTick, a.endTick);
      m.uAlpha.value = areaAlpha(tick, a.endTick);
      m.uTime.value = Math.max(0, (tick - a.startTick) / 30);
      live.mesh.visible = tick < a.endTick;
      if (live.badge) live.badge.visible = live.mesh.visible;
    }
    for (const live of this.shots.values()) {
      const s = live.state, d = Math.max(0, Math.min((tick - s.startTick) / 30, (s.endTick - s.startTick) / 30)) * s.speed;
      live.sprite.position.set(s.x + s.dx * d, s.z + s.dz * d, s.y + s.dy * d);
      if (live.spin) live.sprite.material.rotation = -d * 2;
    }
  }

  dispose(): void {
    for (const id of [...this.areas.keys()]) this.endArea(id);
    for (const id of [...this.shots.keys()]) this.endShot(id);
    for (const t of this.textures.values()) t.dispose();
    this.group.removeFromParent();
  }
}
