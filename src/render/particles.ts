/**
 * Particles: a pool of at most 4 000 billboards; when it's full, a new one replaces the oldest (§11.1).
 * Burst sprites and torn pieces (M12 §4.2) have their own ring of 512, so feathers never overwrite them.
 */
import { burstSpriteAlpha, burstSpriteHeight, SPRITE_CAP, SPRITE_MS } from '../client/burstDeaths';
import type { SpriteFrame } from './atlas';
import { NO_GLOW, type Billboards, type Glow } from './billboards';

export const MAX_PARTICLES = 4000;
export const MAX_PIECES = 512;
/** Torn pieces fall at this rate, without drag, and last this long (M12 §4.2.1). */
export const PIECE_GRAVITY = 12;
export const PIECE_LIFE = 2.5;

const P_FEATHER = 0;
const P_SPARK = 1;
const P_EMBER = 2;
/** A green-tinted ember rising at a steady speed: the heal column (M8 §3.1). */
const P_HEAL = 3;
const HEAL_GLOW: Glow = { r: 0.36, g: 1, b: 0.42, a: 0.7 };
/** The heal column's embers rise from the feet to this height. */
const HEAL_COLUMN_TOP = 2.2;
const HEAL_COLUMN_TIME = 0.8;
/** An ember drifting up from a soul, or bursting up from a revive (M8 §3.1, §4.1). */
const P_RISE = 4;
/** A gold-tinted ember rising from a censer's incense cloud (M9 §5.1). */
const P_INCENSE = 6;
const INCENSE_GLOW: Glow = { r: 1, g: 0.72, b: 0.28, a: 0.7 };
/** A red-tinted ember rising from a Field of Blood (M9 §5.1). */
const P_BLOOD = 5;
const BLOOD_GLOW: Glow = { r: 1, g: 0.16, b: 0.1, a: 0.75 };
/** Rising embers reach this height above the pool. */
const BLOOD_RISE = 3;
/** A burst's spark, hotter than the gold world (M12 §4.2). */
const P_HOT_SPARK = 7;
const HOT_SPARK_GLOW: Glow = { r: 1, g: 0.62, b: 0.2, a: 0.45 };
/** A burst's feathers and sparks (M12 §4.2). */
const BURST_FEATHER_LIFE = 1.4;
const BURST_FEATHER_SIZE = 0.32;
const BURST_SPARK_LIFE = 0.6;
const BURST_SPARK_SIZE = 0.22;
/** The burst sprite's glow, so the baked light doesn't dull it. */
const BURST_GLOW: Glow = { r: 1, g: 0.95, b: 0.8, a: 0.25 };
const Q_BURST = 0;
const Q_PIECE = 1;

/** The 4 rotations of a tumbling sprite: r0 … r3, r1 turned 90° clockwise. */
export type Rotations = readonly [SpriteFrame, SpriteFrame, SpriteFrame, SpriteFrame];

/** The floor height under a point for a piece to land on; −∞ where there's none (a wall, outside, the void). */
export type FloorAt = (x: number, y: number) => number;

/** A rotation's drawn height relative to the 0° frame's, so a piece keeps its size as it turns. */
function heightRatio(r: Rotations, k: number): number {
  return (r[k].v1 - r[k].v0) / (r[0].v1 - r[0].v0);
}

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

  /** The ring of burst sprites and torn pieces (M12 §4.2). */
  private readonly qKind = new Uint8Array(MAX_PIECES);
  private readonly qSprite: Array<Rotations | null> = new Array(MAX_PIECES).fill(null);
  private readonly qX = new Float32Array(MAX_PIECES);
  private readonly qY = new Float32Array(MAX_PIECES);
  private readonly qZ = new Float32Array(MAX_PIECES);
  private readonly qVx = new Float32Array(MAX_PIECES);
  private readonly qVy = new Float32Array(MAX_PIECES);
  private readonly qVz = new Float32Array(MAX_PIECES);
  private readonly qAge = new Float32Array(MAX_PIECES);
  private readonly qLife = new Float32Array(MAX_PIECES);
  /** A piece's 0° frame's drawn height; a burst sprite's start height. */
  private readonly qSize = new Float32Array(MAX_PIECES);
  /** A burst sprite's end height. */
  private readonly qSize1 = new Float32Array(MAX_PIECES);
  /** The current rotation (0–3), the tumble's direction (±1), its pace and the time toward the next turn (s). */
  private readonly qRot = new Uint8Array(MAX_PIECES);
  private readonly qDir = new Int8Array(MAX_PIECES);
  private readonly qTurn = new Float32Array(MAX_PIECES);
  private readonly qTurnAcc = new Float32Array(MAX_PIECES);
  /** A half lies on its side when it lands; a landed piece rests on `qFloor`. */
  private readonly qHalf = new Uint8Array(MAX_PIECES);
  private readonly qLanded = new Uint8Array(MAX_PIECES);
  private readonly qFloor = new Float32Array(MAX_PIECES);
  private qNext = 0;
  private qCount = 0;

  constructor(
    private readonly frames: [SpriteFrame, SpriteFrame, SpriteFrame],
    private readonly floorAt: FloorAt = () => -Infinity,
    private readonly random: () => number = Math.random,
  ) {}

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

  private spawnQ(kind: number, sprite: Rotations, x: number, y: number, z: number, life: number, size: number): number {
    const i = this.qNext;
    this.qNext = (this.qNext + 1) % MAX_PIECES;
    if (this.qCount < MAX_PIECES) this.qCount++;
    this.qKind[i] = kind;
    this.qSprite[i] = sprite;
    this.qX[i] = x;
    this.qY[i] = y;
    this.qZ[i] = z;
    this.qVx[i] = 0;
    this.qVy[i] = 0;
    this.qVz[i] = 0;
    this.qAge[i] = 0;
    this.qLife[i] = life;
    this.qSize[i] = size;
    this.qRot[i] = Math.floor(this.random() * 4) % 4;
    this.qLanded[i] = 0;
    this.qHalf[i] = 0;
    return i;
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

  /**
   * A burst death's feathers and sparks (M12 §4.2), thrown along (dx, dy) and sideways along (px, py):
   * feathers `d × U(2, 5) + p × U(1, 3)`, sparks `d × U(3, 7) + p × U(1.5, 4)`.
   */
  burstFeathers(x: number, y: number, z: number, dx: number, dy: number, px: number, py: number, feathers: number, sparks: number): void {
    for (let i = 0; i < feathers; i++) {
      const a = 2 + 3 * Math.random();
      const b = 1 + 2 * Math.random();
      this.spawn(P_FEATHER, x, y, z, dx * a + px * b, dy * a + py * b, 2 + 2.5 * Math.random(), BURST_FEATHER_LIFE, BURST_FEATHER_SIZE);
    }
    for (let i = 0; i < sparks; i++) {
      const a = 3 + 4 * Math.random();
      const b = 1.5 + 2.5 * Math.random();
      this.spawn(P_HOT_SPARK, x, y, z, dx * a + px * b, dy * a + py * b, 2.5 + 3 * Math.random(), BURST_SPARK_LIFE, BURST_SPARK_SIZE);
    }
  }

  /** The burst sprite (M12 §4.2): a random one of its rotations centered at (x, y, z), growing from h0 to h1 m. */
  burstSprite(sprite: Rotations, x: number, y: number, z: number, h0: number, h1: number): void {
    const i = this.spawnQ(Q_BURST, sprite, x, y, z, SPRITE_MS / 1000, h0);
    this.qSize1[i] = h1;
  }

  /**
   * A torn piece (M12 §4.2.1) centered at (x, y, z), `size` m tall on its 0° frame, starting on a random
   * rotation and turning every `turnMs` in a random direction; a `half` lies on its side when it lands.
   */
  piece(sprite: Rotations, x: number, y: number, z: number, vx: number, vy: number, vz: number, size: number, turnMs: number, half: boolean): void {
    const i = this.spawnQ(Q_PIECE, sprite, x, y, z, PIECE_LIFE, size);
    this.qVx[i] = vx;
    this.qVy[i] = vy;
    this.qVz[i] = vz;
    this.qDir[i] = this.random() < 0.5 ? -1 : 1;
    this.qTurn[i] = turnMs / 1000;
    this.qTurnAcc[i] = 0;
    this.qHalf[i] = half ? 1 : 0;
  }

  /** An ember burst of 2 m radius, lasting 0.4 s: the Shroud burst (M9 §5.1; it was the censer explosion before M9 §2.8). */
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

  /** A green-tinted ember drifting along Sacrament's beam at (vx, vy, vz) for `life` seconds (M9 §5.1). */
  beamEmber(x: number, y: number, z: number, vx: number, vy: number, vz: number, life: number): void {
    this.spawn(P_HEAL, x, y, z, vx, vy, vz, life, 0.16);
  }

  /** One red ember rising from a Field of Blood at (x, y, z) to 3 m (M9 §5.1). */
  bloodEmber(x: number, y: number, z: number): void {
    const life = 1.2 + Math.random() * 0.6;
    this.spawn(P_BLOOD, x, y, z, 0, 0, BLOOD_RISE / life, life, 0.18);
  }

  /** A censer breaking (M9 §5.1): 8 embers within 0.5 m. */
  censerBreak(x: number, y: number, z: number): void {
    for (let i = 0; i < 8; i++) {
      const a = Math.random() * Math.PI * 2;
      const e = (Math.random() - 0.2) * 0.9;
      // Reaches about 0.5 m in its 0.35 s.
      const s = 1.3 + Math.random() * 0.4;
      this.spawn(P_EMBER, x, y, z, Math.cos(a) * Math.cos(e) * s, Math.sin(a) * Math.cos(e) * s, Math.sin(e) * s, 0.35, 0.25);
    }
  }

  /** One gold ember rising from an incense cloud at (x, y, z) to 2 m. */
  incenseEmber(x: number, y: number, z: number): void {
    const life = 1.2 + Math.random() * 0.5;
    this.spawn(P_INCENSE, x, y, z, 0, 0, 2 / life, life, 0.16);
  }

  /** The Shroud's burst (M9 §5.1): 24 embers bursting outward from (x, y, z). */
  shroudBurst(x: number, y: number, z: number): void {
    this.emberBurst(x, y, z);
  }

  /** One ember rising slowly from a soul (M8 §4.1). */
  soulEmber(x: number, y: number, z: number): void {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 0.35;
    this.spawn(P_RISE, x + Math.cos(a) * r, y + Math.sin(a) * r, z, 0, 0, 0.8 + Math.random() * 0.4, 1.2, 0.18);
  }

  /** The revive pillar's burst (M8 §3.1): 40 embers bursting upward. */
  reviveBurst(x: number, y: number, z: number): void {
    for (let i = 0; i < 40; i++) {
      const a = Math.random() * Math.PI * 2;
      const s = 0.5 + Math.random() * 1.5;
      this.spawn(P_RISE, x + Math.cos(a) * 0.3, y + Math.sin(a) * 0.3, z + Math.random() * 0.5, Math.cos(a) * s, Math.sin(a) * s, 3 + Math.random() * 4, 0.9, 0.25);
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
      } else if (k === P_SPARK || k === P_HOT_SPARK) {
        this.vz[i] -= 9 * dt;
      } else if (k === P_EMBER) {
        this.vx[i] *= Math.exp(-3 * dt);
        this.vy[i] *= Math.exp(-3 * dt);
        this.vz[i] *= Math.exp(-3 * dt);
      } else if (k === P_RISE) {
        this.vx[i] *= Math.exp(-3 * dt);
        this.vy[i] *= Math.exp(-3 * dt);
        this.vz[i] *= Math.exp(-1.2 * dt);
      }
      this.x[i] += this.vx[i] * dt;
      this.y[i] += this.vy[i] * dt;
      this.z[i] += this.vz[i] * dt;
    }
    for (let i = 0; i < this.qCount; i++) {
      if (this.qAge[i] >= this.qLife[i]) continue;
      this.qAge[i] += dt;
      if (this.qKind[i] === Q_PIECE && !this.qLanded[i]) this.fly(i, dt);
    }
  }

  /** A piece in flight (M12 §4.2.1): it falls without drag, tumbles, and lands on the floor under it. */
  private fly(i: number, dt: number): void {
    this.qVz[i] -= PIECE_GRAVITY * dt;
    this.qX[i] += this.qVx[i] * dt;
    this.qY[i] += this.qVy[i] * dt;
    this.qZ[i] += this.qVz[i] * dt;
    this.qTurnAcc[i] += dt;
    while (this.qTurnAcc[i] >= this.qTurn[i]) {
      this.qTurnAcc[i] -= this.qTurn[i];
      this.qRot[i] = (this.qRot[i] + this.qDir[i] + 4) % 4;
    }
    const floor = this.floorAt(this.qX[i], this.qY[i]);
    if (floor === -Infinity || this.qVz[i] > 0) return;
    const r = this.qSprite[i]!;
    if (this.qZ[i] - (this.qSize[i] * heightRatio(r, this.qRot[i])) / 2 > floor) return;
    // Landed: a half that is upright or upside down turns on to its side.
    if (this.qHalf[i] && this.qRot[i] % 2 === 0) this.qRot[i] = (this.qRot[i] + this.qDir[i] + 4) % 4;
    this.qLanded[i] = 1;
    this.qFloor[i] = floor;
  }

  /** Adds every live particle; (camX, camY) is the camera, for the burst sprites' size cap. */
  draw(b: Pick<Billboards, 'add'>, camX = 0, camY = 0): void {
    const n = this.count;
    for (let i = 0; i < n; i++) {
      if (this.age[i] >= this.life[i]) continue;
      // Shrink toward the end of life.
      const f = 1 - Math.max(0, (this.age[i] / this.life[i] - 0.6) / 0.4);
      const k = this.kind[i];
      if (k === P_HEAL) b.add(this.frames[P_EMBER], this.x[i], this.y[i], this.z[i], this.size[i] * f, true, 1, 1, 1, HEAL_GLOW);
      else if (k === P_INCENSE) b.add(this.frames[P_EMBER], this.x[i], this.y[i], this.z[i], this.size[i] * f, true, 1, 1, 1, INCENSE_GLOW);
      else if (k === P_BLOOD) b.add(this.frames[P_EMBER], this.x[i], this.y[i], this.z[i], this.size[i] * f, true, 1, 1, 1, BLOOD_GLOW);
      else if (k === P_RISE) b.add(this.frames[P_EMBER], this.x[i], this.y[i], this.z[i], this.size[i] * f, true, 1, 1, 1, NO_GLOW);
      else if (k === P_HOT_SPARK) b.add(this.frames[P_SPARK], this.x[i], this.y[i], this.z[i], this.size[i] * f, true, 1, 1, 1, HOT_SPARK_GLOW);
      else b.add(this.frames[k], this.x[i], this.y[i], this.z[i], this.size[i] * f, true, 1, 1, 1, NO_GLOW);
    }
    for (let i = 0; i < this.qCount; i++) {
      const age = this.qAge[i];
      if (age >= this.qLife[i]) continue;
      const r = this.qSprite[i]!;
      const rot = this.qRot[i];
      if (this.qKind[i] === Q_BURST) {
        // It doesn't shrink at the end: its size is the growth, capped near the camera (M12 §4.2).
        const t = age * 1000;
        const h = burstSpriteHeight(this.qSize[i], this.qSize1[i], t, Math.hypot(this.qX[i] - camX, this.qY[i] - camY));
        b.add(r[rot], this.qX[i], this.qY[i], this.qZ[i], h, true, 1, 1, 1, BURST_GLOW, burstSpriteAlpha(t));
        continue;
      }
      const f = 1 - Math.max(0, (age / this.qLife[i] - 0.6) / 0.4);
      // Capped near the camera like the burst sprite, so a point-blank burst doesn't fill the view.
      const cap = SPRITE_CAP * Math.hypot(this.qX[i] - camX, this.qY[i] - camY);
      const h = Math.min(this.qSize[i] * heightRatio(r, rot) * f, cap);
      // A landed piece rests on its bottom.
      const z = this.qLanded[i] ? this.qFloor[i] + h / 2 : this.qZ[i];
      b.add(r[rot], this.qX[i], this.qY[i], z, h, true);
    }
  }
}
