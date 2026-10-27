/**
 * The authored Gatekeeper on screen (rogue bosses.md §3.2, §3.5 Client): the Toll's ring rolling over the
 * floors it actually hurts on, the Call's chain through the Seal, the Watchers and the gold threads of
 * those that see you, and the crosshair eye. Everything is drawn from the host's accepted state (the
 * ring's impact tick, part records, the held player); nothing here decides a hit.
 */
import * as THREE from 'three';
import { BOSS_PART } from '../data/enemies';
import { FLAG_PART_OPENING, FLAG_PART_SEAL, RING_HEIGHT, RING_SPEED, RING_START, ringFloor, ringRadius, WATCHER_GAZE, WATCHER_HEIGHT } from '../data/gatekeeper';
import { PLAYER_EYE, PLAYER_RADIUS, TICK_HZ } from '../sim/constants';
import type { GameMap } from '../sim/map';
import { lineOfSight } from '../sim/los';
import { Ribbon } from '../render/vfx';
import type { InterpolatedEnemies } from './snapshots';

/** Ring segments: about 2.3° each, so a 70 m ring's chords stay under 3 m. */
export const RING_SEGMENTS = 160;
/** The faint wisps rise this high over the damaging 0.5 m band. */
const WISP_HEIGHT = 2;
const MAX_EYES = 8;

export type SightState = 'full' | 'half' | 'none';

/** A part as drawn: its interpolated center and kind. */
export interface PartView { slot: number; x: number; y: number; z: number; seal: boolean; opening: boolean }

/** The parts in the interpolated enemies. */
export function partsOf(ents: InterpolatedEnemies, enemyZ: ArrayLike<number>): PartView[] {
  const out: PartView[] = [];
  for (let i = 0; i < ents.count; i++) {
    if (ents.type[i] !== BOSS_PART) continue;
    out.push({ slot: ents.slot[i], x: ents.x[i], y: ents.y[i], z: enemyZ[i] + WATCHER_HEIGHT / 2, seal: (ents.flags[i] & FLAG_PART_SEAL) !== 0, opening: (ents.flags[i] & FLAG_PART_OPENING) !== 0 });
  }
  return out;
}

/**
 * The crosshair eye (§3.5): `full` while his eye sees yours, `half` while only an open Watcher within
 * 24 m does, `none` when hidden. The same geometry line of sight the host judges with.
 */
export function sightState(map: GameMap, x: number, y: number, eyeZ: number, boss: readonly [number, number, number] | null, eyes: readonly PartView[]): SightState {
  if (boss && lineOfSight(map, x, y, eyeZ, boss[0], boss[1], boss[2])) return 'full';
  for (const e of eyes) if (!e.seal && !e.opening && Math.hypot(e.x - x, e.y - y) <= WATCHER_GAZE && lineOfSight(map, e.x, e.y, e.z, x, y, eyeZ)) return 'half';
  return 'none';
}

/** Whether the crosshair eye is shown: from Judgment's c 22 pre-warning through the c 28 deadline, and while Watchers are open. */
export function sightWindow(c: number, eyesOpen: boolean): boolean {
  return eyesOpen || (c >= 22 * TICK_HZ && c <= 28 * TICK_HZ);
}

/**
 * Seconds until the Toll's front (or its birth disk) first touches a body at horizontal distance `d`,
 * at fractional tick `tick`; Infinity once it has passed or with no ring. The whoosh and the bots'
 * jump read this from the announced impact tick, so a lip contact is forecast before the ring is born.
 */
export function ringContactIn(impact: number, tick: number, d: number, radius = PLAYER_RADIUS): number {
  if (impact <= 0) return Infinity;
  const reach = Math.max(0, d - radius);
  if (tick < impact) return (impact - tick) / TICK_HZ + Math.max(0, reach - RING_START) / RING_SPEED;
  const r = ringRadius(impact, tick);
  if (r < 0 || r > d + radius) return Infinity;
  return Math.max(0, reach - r) / RING_SPEED;
}

/**
 * The ring band's floor height at each of `RING_SEGMENTS + 1` angles, or NaN where the ring doesn't
 * travel (walls, the dais, the +2 m gallery, plinth tops): the same affected-height predicate as the host.
 */
export function ringHeights(map: GameMap, cx: number, cy: number, r: number, base: number, out: Float64Array): Float64Array {
  for (let k = 0; k <= RING_SEGMENTS; k++) {
    const a = (k / RING_SEGMENTS) * Math.PI * 2;
    const x = cx + Math.cos(a) * r, y = cy + Math.sin(a) * r;
    const c = Math.floor(x), row = Math.floor(y);
    if (c < 0 || row < 0 || c >= map.w || row >= map.h) { out[k] = NaN; continue; }
    const i = row * map.w + c, f = map.floor[i];
    out[k] = map.solid[i] || !ringFloor(f, base) ? NaN : f;
  }
  return out;
}

/** One band mesh: quads between consecutive affected angles, `height` tall, collapsed where the ring doesn't travel. */
class Band {
  readonly mesh: THREE.Mesh;
  private readonly pos: THREE.BufferAttribute;
  readonly material: THREE.MeshBasicMaterial;
  /** `additive`: the faint wisps glow; the damaging band is drawn solid so it reads on white marble. */
  constructor(color: number, private readonly height: number, additive: boolean) {
    const geo = new THREE.BufferGeometry();
    this.pos = new THREE.BufferAttribute(new Float32Array(RING_SEGMENTS * 18), 3);
    geo.setAttribute('position', this.pos);
    this.material = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, fog: false });
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.frustumCulled = false;
    this.mesh.visible = false;
  }

  set(cx: number, cy: number, r: number, heights: Float64Array, opacity: number): void {
    const p = this.pos.array as Float32Array;
    for (let k = 0; k < RING_SEGMENTS; k++) {
      const h0 = heights[k], h1 = heights[k + 1], o = k * 18;
      if (Number.isNaN(h0) || Number.isNaN(h1) || Math.abs(h0 - h1) > 0.6) { p.fill(0, o, o + 18); continue; }
      const a0 = (k / RING_SEGMENTS) * Math.PI * 2, a1 = ((k + 1) / RING_SEGMENTS) * Math.PI * 2;
      const x0 = cx + Math.cos(a0) * r, y0 = cy + Math.sin(a0) * r, x1 = cx + Math.cos(a1) * r, y1 = cy + Math.sin(a1) * r;
      // three.js: (x, height, y).
      p.set([x0, h0, y0, x1, h1, y1, x1, h1 + this.height, y1, x0, h0, y0, x1, h1 + this.height, y1, x0, h0 + this.height, y0], o);
    }
    this.pos.needsUpdate = true;
    this.material.opacity = opacity;
    this.mesh.visible = opacity > 0.001;
  }

  hide(): void { this.mesh.visible = false; }
  dispose(): void { this.mesh.geometry.dispose(); this.material.dispose(); }
}

const WATCHER_OPEN_ART = new URL('../../assets/items/watcher-open.png', import.meta.url).href;
const WATCHER_CLOSED_ART = new URL('../../assets/items/watcher-closed.png', import.meta.url).href;
const SEAL_ART = new URL('../../assets/items/judgment-seal.png', import.meta.url).href;
const ART_SIZE = 256;

/**
 * A part's texture: the coded drawing at once (it stays if the art fails to load), replaced by the B6
 * art (rogue art-prompts.md) with its coded rim on top when the image arrives.
 */
function partTexture(coded: (g: CanvasRenderingContext2D) => void, art: string, rim: ((g: CanvasRenderingContext2D) => void) | null, grey: boolean): THREE.Texture {
  const c = document.createElement('canvas');
  c.width = c.height = ART_SIZE;
  const g = c.getContext('2d')!;
  g.save(); g.scale(ART_SIZE / 128, ART_SIZE / 128); coded(g); g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const img = new Image();
  img.onload = () => {
    g.clearRect(0, 0, ART_SIZE, ART_SIZE);
    if (grey) g.filter = 'grayscale(1) brightness(0.8)';
    g.drawImage(img, 0, 0, ART_SIZE, ART_SIZE);
    g.filter = 'none';
    rim?.(g);
    t.needsUpdate = true;
  };
  img.src = art;
  return t;
}

/** The "vulnerable now" rim over an open eye's round frame: red, so the eye reads as a target. */
function redRim(g: CanvasRenderingContext2D): void {
  g.strokeStyle = 'rgba(216, 30, 30, 0.86)'; g.lineWidth = 9;
  g.beginPath(); g.arc(ART_SIZE / 2, ART_SIZE / 2, 74, 0, Math.PI * 2); g.stroke();
}

/** Coded fallbacks: a gold eye in a ring of feathers with the red "vulnerable" rim, grey while opening; a gold padlock. */
function codedEye(open: boolean): (g: CanvasRenderingContext2D) => void {
  return (g) => {
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.fillStyle = open ? '#fff3cf' : '#c9c9c9';
      g.beginPath(); g.ellipse(64 + Math.cos(a) * 46, 64 + Math.sin(a) * 46, 14, 6, a, 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = open ? '#d81e1e' : '#9a9a9a';
    g.beginPath(); g.arc(64, 64, 36, 0, Math.PI * 2); g.fill();
    g.fillStyle = open ? '#ffd24a' : '#e3e3e3';
    g.beginPath(); g.ellipse(64, 64, 30, open ? 22 : 4, 0, 0, Math.PI * 2); g.fill();
    if (open) {
      g.fillStyle = '#3a1d05'; g.beginPath(); g.arc(64, 64, 11, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#ffffff'; g.beginPath(); g.arc(58, 58, 4, 0, Math.PI * 2); g.fill();
    }
  };
}

function codedSeal(g: CanvasRenderingContext2D): void {
  g.lineWidth = 12; g.strokeStyle = '#ffd24a';
  g.beginPath(); g.arc(64, 50, 24, Math.PI, 0); g.stroke();
  g.fillStyle = '#d81e1e'; g.fillRect(24, 46, 80, 66);
  g.fillStyle = '#ffd24a'; g.fillRect(31, 53, 66, 52);
  g.fillStyle = '#3a1d05'; g.beginPath(); g.arc(64, 74, 8, 0, Math.PI * 2); g.fill(); g.fillRect(60, 76, 8, 18);
}

export interface GatekeeperFrame {
  map: GameMap;
  /** The fractional tick the screen draws (the interpolated snapshot time). */
  tick: number;
  boss: { x: number; y: number; z: number } | null;
  base: number;
  /** Toll impact ticks to draw: the newest from the header and the one before it. */
  rings: readonly number[];
  /** The Toll's tell (0–1) while it winds up, else null. */
  tollTell: number | null;
  parts: readonly PartView[];
  /** The held player's drawn body, or null. */
  held: { x: number; y: number; z: number } | null;
  /** The held player is this screen's own: the chain ends at the Seal rather than running into the camera. */
  heldLocal?: boolean;
  /** The local player's eye, or null while dead. */
  me: { x: number; y: number; z: number } | null;
  camera: THREE.Vector3;
}

export class GatekeeperView {
  readonly group = new THREE.Group();
  private readonly tell = new Band(0xe8a317, 0.12, false);
  private readonly bands = [new Band(0xe8a317, RING_HEIGHT, false), new Band(0xe8a317, RING_HEIGHT, false)];
  private readonly wisps = [new Band(0xffd36a, WISP_HEIGHT, true), new Band(0xffd36a, WISP_HEIGHT, true)];
  private readonly heights = new Float64Array(RING_SEGMENTS + 1);
  private readonly eyeOpen: THREE.SpriteMaterial;
  private readonly eyeGrey: THREE.SpriteMaterial;
  private readonly lock: THREE.SpriteMaterial;
  private readonly sprites: THREE.Sprite[] = [];
  private readonly chain: Ribbon;
  private readonly threads: Ribbon[] = [];

  constructor(beamTexture: THREE.Texture) {
    this.group.add(this.tell.mesh);
    for (const b of [...this.bands, ...this.wisps]) this.group.add(b.mesh);
    this.eyeOpen = new THREE.SpriteMaterial({ map: partTexture(codedEye(true), WATCHER_OPEN_ART, redRim, false), transparent: true, depthWrite: false, fog: false });
    this.eyeGrey = new THREE.SpriteMaterial({ map: partTexture(codedEye(false), WATCHER_CLOSED_ART, null, true), transparent: true, depthWrite: false, fog: false });
    this.lock = new THREE.SpriteMaterial({ map: partTexture(codedSeal, SEAL_ART, null, false), transparent: true, depthWrite: false, fog: false });
    for (let i = 0; i < MAX_EYES + 1; i++) { const s = new THREE.Sprite(this.eyeOpen); s.visible = false; this.sprites.push(s); this.group.add(s); }
    const chainMat = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xfff0b8, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false, depthTest: false });
    this.chain = new Ribbon([[0, 0, 0], [0, 0, 1], [0, 0, 1], [0, 0, 2]], 0.14, chainMat, 1);
    this.chain.mesh.renderOrder = 10;
    this.chain.mesh.visible = false;
    this.group.add(this.chain.mesh);
    for (let i = 0; i < MAX_EYES; i++) {
      const m = new THREE.MeshBasicMaterial({ map: beamTexture, color: 0xffd36a, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, fog: false });
      const r = new Ribbon([[0, 0, 0], [0, 0, 1]], 0.035, m, 2);
      r.mesh.visible = false;
      this.threads.push(r); this.group.add(r.mesh);
    }
  }

  update(f: GatekeeperFrame): void {
    const b = f.boss;
    this.tell.hide();
    for (const band of [...this.bands, ...this.wisps]) band.hide();
    if (b && f.tollTell !== null) {
      ringHeights(f.map, b.x, b.y, RING_START, f.base, this.heights);
      this.tell.set(b.x, b.y, RING_START, this.heights, 0.25 + 0.65 * f.tollTell);
    }
    if (b) {
      f.rings.slice(-2).forEach((impact, i) => {
        const r = ringRadius(impact, f.tick);
        if (r < 0) return;
        ringHeights(f.map, b.x, b.y, r, f.base, this.heights);
        const fade = Math.min(1, (70 - r) / 6);
        this.bands[i].set(b.x, b.y, r, this.heights, 0.85 * fade);
        this.wisps[i].set(b.x, b.y, r, this.heights, 0.08 * fade);
      });
    }
    // Parts: the eyes 1.4 m wide, the Seal 1.2 m.
    let n = 0, seal: PartView | null = null;
    for (const p of f.parts) {
      if (n >= this.sprites.length) break;
      const s = this.sprites[n++];
      s.material = p.seal ? this.lock : p.opening ? this.eyeGrey : this.eyeOpen;
      s.position.set(p.x, p.z, p.y);
      s.scale.setScalar(p.seal ? 1.2 : 1.4);
      s.visible = true;
      if (p.seal) seal = p;
    }
    for (let i = n; i < this.sprites.length; i++) this.sprites[i].visible = false;
    // The chain of light: from his raised keys through the Seal to the held player, drawn over everything.
    if (b && seal && f.held) {
      const hand: [number, number, number] = [b.x, b.y, b.z + 5.5];
      const s: [number, number, number] = [seal.x, seal.y, seal.z];
      this.chain.setPoints([hand, s, s, f.heldLocal ? s : [f.held.x, f.held.y, f.held.z + 1.2]]);
      this.chain.face(f.camera);
      this.chain.mesh.visible = true;
    } else this.chain.mesh.visible = false;
    // Gold threads from every open eye that sees you, within its 24 m gaze.
    let t = 0;
    if (f.me) {
      const ez = f.me.z + PLAYER_EYE;
      for (const p of f.parts) {
        if (p.seal || p.opening || t >= this.threads.length) continue;
        if (Math.hypot(p.x - f.me.x, p.y - f.me.y) > WATCHER_GAZE || !lineOfSight(f.map, p.x, p.y, p.z, f.me.x, f.me.y, ez)) continue;
        const r = this.threads[t++];
        r.setPoints([[p.x, p.y, p.z], [f.me.x, f.me.y, f.me.z + 0.9]]);
        r.face(f.camera);
        r.mesh.visible = true;
      }
    }
    for (let i = t; i < this.threads.length; i++) this.threads[i].mesh.visible = false;
  }

  dispose(): void {
    this.tell.dispose();
    for (const b of [...this.bands, ...this.wisps]) b.dispose();
    for (const m of [this.eyeOpen, this.eyeGrey, this.lock]) { m.map?.dispose(); m.dispose(); }
    this.chain.mesh.geometry.dispose();
    for (const r of this.threads) r.mesh.geometry.dispose();
  }
}
