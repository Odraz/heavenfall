/**
 * The censer's incense clouds (M9 §2.8, §5.1): where a censer broke, 8 puffs of the smoke effect texture
 * tinted rusty gold drift slowly around the break point for 4 s, below eye height. A puff near the
 * camera fades out, so standing in a cloud never blinds a player. At most 4 clouds, like the host's.
 * Positions are simulation coordinates (z up).
 */
import * as THREE from 'three';
import { CLOUD_MAX, CLOUD_TIME } from '../data/weapons';

const PUFFS = 8;
const TINT = 0xb8862e;
const OPACITY = 0.35;
/** Puffs spread within this of the center, 1.4–2.0 m across, their centers 0.3–0.9 m above the base. */
const SPREAD = 2;
/** One turn around the center in this long. */
const TURN_S = 12;
const FADE_IN_S = 0.3;
const FADE_OUT_S = 1;
/** A puff fades out between these distances from the camera. */
const NEAR_FADE_FAR = 2;
const NEAR_FADE_NEAR = 0.5;

interface Puff {
  sprite: THREE.Sprite;
  material: THREE.SpriteMaterial;
  /** Angle and distance around the center, height above the base, size, spin rate. */
  a: number;
  r: number;
  h: number;
  spin: number;
}

interface Cloud {
  start: number;
  x: number;
  y: number;
  /** The height the puffs float above, per puff. */
  base: number[];
  puffs: Puff[];
}

export class IncenseClouds {
  readonly group = new THREE.Group();
  private readonly clouds: Cloud[] = [];
  private readonly scratch = new THREE.Vector3();

  constructor(private readonly texture: THREE.Texture) {}

  /**
   * A new cloud at (x, y); `baseAt(x, y)` gives the height a puff floats above there. A fifth cloud
   * replaces the oldest, as on the host.
   */
  add(now: number, x: number, y: number, baseAt: (x: number, y: number) => number): void {
    if (this.clouds.length >= CLOUD_MAX) this.remove(0);
    const puffs: Puff[] = [];
    const base: number[] = [];
    for (let i = 0; i < PUFFS; i++) {
      const material = new THREE.SpriteMaterial({ map: this.texture, color: TINT, transparent: true, depthWrite: false, fog: false, opacity: 0 });
      const sprite = new THREE.Sprite(material);
      const size = 1.4 + Math.random() * 0.6;
      sprite.scale.set(i % 2 ? -size : size, size, 1);
      const a = (i / PUFFS) * Math.PI * 2 + Math.random() * 0.6;
      const r = SPREAD * Math.sqrt(0.15 + 0.85 * Math.random());
      puffs.push({ sprite, material, a, r, h: 0.3 + Math.random() * 0.6, spin: (Math.random() - 0.5) * 0.6 });
      base.push(baseAt(x + Math.cos(a) * r, y + Math.sin(a) * r));
      this.group.add(sprite);
    }
    this.clouds.push({ start: now, x, y, base, puffs });
  }

  /** A random point inside a cloud, for its rising embers, or null with none. */
  randomPoint(): [number, number, number] | null {
    if (this.clouds.length === 0) return null;
    const c = this.clouds[Math.floor(Math.random() * this.clouds.length)];
    const p = Math.floor(Math.random() * c.puffs.length);
    const a = Math.random() * Math.PI * 2;
    const r = SPREAD * Math.sqrt(Math.random());
    return [c.x + Math.cos(a) * r, c.y + Math.sin(a) * r, c.base[p] + 0.2];
  }

  get count(): number {
    return this.clouds.length;
  }

  /** `camera` is the camera's position in three.js coordinates. */
  update(now: number, camera: THREE.Vector3): void {
    for (let i = this.clouds.length - 1; i >= 0; i--) {
      const c = this.clouds[i];
      const t = (now - c.start) / 1000;
      if (t >= CLOUD_TIME) {
        this.remove(i);
        continue;
      }
      const alpha = OPACITY * Math.min(1, t / FADE_IN_S) * Math.min(1, (CLOUD_TIME - t) / FADE_OUT_S);
      const turn = (t / TURN_S) * Math.PI * 2;
      c.puffs.forEach((p, k) => {
        const a = p.a + turn;
        const pos = this.scratch.set(c.x + Math.cos(a) * p.r, c.base[k] + p.h, c.y + Math.sin(a) * p.r);
        p.sprite.position.copy(pos);
        const near = Math.max(0, Math.min(1, (pos.distanceTo(camera) - NEAR_FADE_NEAR) / (NEAR_FADE_FAR - NEAR_FADE_NEAR)));
        p.material.opacity = alpha * near;
        p.material.rotation = p.a + p.spin * t;
      });
    }
  }

  private remove(i: number): void {
    for (const p of this.clouds[i].puffs) {
      this.group.remove(p.sprite);
      p.material.dispose();
    }
    this.clouds.splice(i, 1);
  }

  dispose(): void {
    while (this.clouds.length) this.remove(0);
    this.group.removeFromParent();
  }
}
