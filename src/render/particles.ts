/** Particles: a pool of at most 4 000 billboards; when it's full, a new one replaces the oldest (§11.1). */
import type { SpriteFrame } from './atlas';
import { NO_GLOW, type Billboards, type Glow } from './billboards';

export const MAX_PARTICLES = 4000;

const P_FEATHER = 0;
const P_SPARK = 1;
const P_EMBER = 2;
/** A green-tinted ember rising at a steady speed: the heal column (M8 §3.1). */
const P_HEAL = 3;
const HEAL_GLOW: Glow = { r: 0.36, g: 1, b: 0.42, a: 0.7 };
/** The heal column's embers rise from the feet to this height. */
const HEAL_COLUMN_TOP = 2.2;
const HEAL_COLUMN_TIME = 0.8;

export class Particles {
  private readonly kind = new Uint8Array(MAX_PARTICLES);
  private readonly x = new Float32Array(MAX_PARTICLES);
  private readonly y = new Float32Array(MAX_PARTICLES);
  private readonly z = new Float32Array(MAX_PARTICLES);
  private readonly vx = new Float32Array(MAX_PARTICLES);
  private readonly vy = new Float32Array(MAX_PARTICLES);
  private readonly vz = new Float32Array(MAX_PARTICLES);
  private readonly age = new Float32Array(MAX_PARTICLES);
  private readonly life = new Float32Array(MAX_PARTICLES);
  private readonly size = new Float32Array(MAX_PARTICLES);
  /** Ring buffer: slot `next` is the oldest once the pool is full. */
  private next = 0;
  private count = 0;

  constructor(private readonly frames: [SpriteFrame, SpriteFrame, SpriteFrame]) {}

  private spawn(kind: number, x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number, size: number): void {
    const i = this.next;
    this.next = (this.next + 1) % MAX_PARTICLES;
    if (this.count < MAX_PARTICLES) this.count++;
    this.kind[i] = kind;
    this.x[i] = x;
    this.y[i] = y;
    this.z[i] = z;
    this.vx[i] = vx;
    this.vy[i] = vy;
    this.vz[i] = vz;
    this.age[i] = 0;
    this.life[i] = life;
    this.size[i] = size;
  }

  /** Enemy death: 12 feathers and 8 gold sparks, lasting 0.8 s (§10). */
  featherBurst(x: number, y: number, z: number): void {
    for (let i = 0; i < 12; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.8 + Math.random() * 1.6;
      this.spawn(P_FEATHER, x, y, z, Math.cos(a) * s, Math.sin(a) * s, 1 + Math.random() * 2, 0.8, 0.28);
    }
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 3 + Math.random() * 3;
      this.spawn(P_SPARK, x, y, z, Math.cos(a) * s, Math.sin(a) * s, 2 + Math.random() * 3, 0.8, 0.22);
    }
  }

  /** Censer explosion: an ember burst of 2 m radius, lasting 0.4 s (§10, decisions.md). */
  emberBurst(x: number, y: number, z: number): void {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.3) * 0.8;
      // Reaches about 2 m in 0.4 s.
      const s = 4 + Math.random();
      this.spawn(P_EMBER, x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(a) * Math.cos(e) * s, Math.sin(e) * s, 0.4, 0.35);
    }
  }

  /** Heal column (M8 §3.1): 24 green-tinted embers rising from the feet at (x, y, z) to 2.2 m over 0.8 s. */
  healColumn(x: number, y: number, z: number): void {
    for (let i = 0; i < 24; i++) {
      const a = Math.random() * Math.PI * 2;
      const r = 0.15 + Math.random() * 0.3;
      const z0 = Math.random() * 0.5;
      // Each starts a little later and lower, so the column fills from the feet up.
      const life = HEAL_COLUMN_TIME * (0.7 + 0.3 * Math.random());
      this.spawn(P_HEAL, x + Math.cos(a) * r, y + Math.sin(a) * r, z + z0, 0, 0, (HEAL_COLUMN_TOP - z0) / life, life, 0.2);
    }
  }

  update(dt: number): void {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      if (this.age[i] >= this.life[i]) continue;
      this.age[i] += dt;
      const k = this.kind[i];
      if (k === P_FEATHER) {
        // Feathers drift: strong drag, slow fall.
        this.vx[i] *= Math.exp(-2 * dt);
        this.vy[i] *= Math.exp(-2 * dt);
        this.vz[i] = Math.max(-0.8, this.vz[i] - 4 * dt);
      } else if (k === P_SPARK) {
        this.vz[i] -= 9 * dt;
      } else if (k === P_EMBER) {
        this.vx[i] *= Math.exp(-3 * dt);
        this.vy[i] *= Math.exp(-3 * dt);
        this.vz[i] *= Math.exp(-3 * dt);
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
    }
  }

  draw(b: Billboards): void {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      if (this.age[i] >= this.life[i]) continue;
      // Shrink toward the end of life.
      const f = 1 - Math.max(0, (this.age[i] / this.life[i] - 0.6) / 0.4);
      const k = this.kind[i];
      if (k === P_HEAL) b.add(this.frames[P_EMBER], this.x[i], this.y[i], this.z[i], this.size[i] * f, true, 1, 1, 1, HEAL_GLOW);
      else b.add(this.frames[k], this.x[i], this.y[i], this.z[i], this.size[i] * f, true, 1, 1, 1, NO_GLOW);
    }
  }
}
