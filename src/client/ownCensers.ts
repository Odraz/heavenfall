/**
 * The local Heretic's own censers (netcode stage 4, 2026-10-23). The host's censer reaches this screen
 * only in a snapshot, a round trip and the render delay after the click: about 0.3 s and 6 m of flight at
 * a 100 ms ping. So the screen flies its own from the click, as the host flies it: straight from the eye
 * along the aim at CENSER_SPEED, up to the weapon's range, breaking on the first enemy, soul, prop or wall
 * it reaches. It meets the enemies where this screen draws them, which is where the host's censer meets
 * them too (its flight is compensated by the thrower's view lag). The host's own censer is matched to it
 * by owner and order and isn't drawn. Pure: no DOM or three.js.
 */
import { BLESSED, ENEMIES } from '../data/enemies';
import { PROP_HEIGHT, PROP_RADIUS, type PropDef } from '../data/props';
import { CENSER_RADIUS, CENSER_SPEED } from '../data/weapons';
import { rayCylinder } from '../sim/combat';
import { WALL_TOP } from '../sim/constants';
import { raycastTerrain } from '../sim/los';
import { overVoid, type GameMap } from '../sim/map';
import { SOUL_HEIGHT, SOUL_RADIUS } from '../sim/souls';

/** The painted launcher's muzzle offset fades over this, as the host's censer used to (the stage 2 playtest). */
export const CENSER_BLEND_MS = 250;
/** A host censer of this player's appearing within this long of a local one's throw is that one. */
export const CENSER_MATCH_MS = 1200;
/** A local censer is forgotten this long after it ended, matched or not. */
const FORGET_MS = 2000;
/** A matched host censer stays hidden this long after the snapshots dropped it, while interpolation still draws it. */
const HIDE_AFTER_MS = 1000;
/** A host censer belongs to a local throw whose path passes this close to where the snapshot first shows it. */
const MATCH_OFF = 1;
/** The host's censer agrees when its last snapshot place lies on the local one's path, this close behind its break. */
const AGREE_BEHIND = 3;
const AGREE_AHEAD = 0.75;

export interface CenserEnemies {
  count: number;
  x: ArrayLike<number>;
  y: ArrayLike<number>;
  type: ArrayLike<number>;
}

/** What a flying censer can meet this frame, as this screen draws it. */
export interface CenserWorld {
  map: GameMap;
  enemies: CenserEnemies;
  /** Each drawn enemy's feet height. */
  enemyZ: ArrayLike<number>;
  /** Teammates' souls: position and the soul's base height. */
  souls: ReadonlyArray<{ x: number; y: number; base: number }>;
  props: readonly PropDef[];
  /** Props broken now, by id. */
  broken: ReadonlySet<number>;
  /** The Long Chain: censers fly through Blessed. */
  passBlessed: boolean;
}

export interface CenserBreak {
  x: number;
  y: number;
  z: number;
  /** Index of the drawn enemy it broke on, or -1. */
  enemy: number;
}

interface Flight {
  at: number;
  x0: number; y0: number; z0: number;
  dx: number; dy: number; dz: number;
  range: number;
  /** The muzzle's offset from the eye when it was thrown. */
  mx: number; my: number; mz: number;
  traveled: number;
  /** When it broke or vanished, or -1 while it flies. */
  ended: number;
  /** Where it broke: traveled distance, or -1 if it vanished. */
  brokeAt: number;
  /** The host's censer slot matched to it, or -1. */
  host: number;
}

export class OwnCensers {
  private flights: Flight[] = [];
  /** Host censer slots matched to a local one; they aren't drawn and their vanishing plays nothing. */
  private readonly hostSlots = new Map<number, { flight: Flight; released: number }>();
  /**
   * Censers thrown, host censers matched, those whose end agreed with the local break, and host censers of
   * this player's that matched no throw, drawn as the host's (the lag test).
   */
  thrown = 0;
  matched = 0;
  unmatched = 0;
  agreed = 0;

  /** A censer thrown now from the eye (x, y, z) along the unit (dx, dy, dz); (mx, my, mz) is the muzzle. */
  throw(now: number, x: number, y: number, z: number, dx: number, dy: number, dz: number, range: number, mx: number, my: number, mz: number): void {
    this.thrown++;
    this.flights.push({ at: now, x0: x, y0: y, z0: z, dx, dy, dz, range, mx: mx - x, my: my - y, mz: mz - z, traveled: 0, ended: -1, brokeAt: -1, host: -1 });
  }

  /** Moves every flying censer `dt` seconds on; returns where censers broke this frame. */
  step(now: number, dt: number, w: CenserWorld): CenserBreak[] {
    const breaks: CenserBreak[] = [];
    const pr = CENSER_RADIUS;
    for (const f of this.flights) {
      if (f.ended >= 0) continue;
      const x = f.x0 + f.dx * f.traveled, y = f.y0 + f.dy * f.traveled, z = f.z0 + f.dz * f.traveled;
      const len = Math.min(CENSER_SPEED * dt, f.range - f.traveled);
      const terrainT = raycastTerrain(w.map, x, y, z, f.dx, f.dy, f.dz, len);
      let hitT = Infinity, hit = -1;
      const e = w.enemies;
      for (let i = 0; i < e.count; i++) {
        if (w.passBlessed && e.type[i] === BLESSED) continue;
        const shot = ENEMIES[e.type[i]].shot;
        const t = rayCylinder(x, y, z, f.dx, f.dy, f.dz, e.x[i], e.y[i], w.enemyZ[i] + shot.base - pr, shot.radius + pr, shot.top - shot.base + 2 * pr);
        if (t <= terrainT && t < hitT) { hitT = t; hit = i; }
      }
      let stopT = Math.min(len, terrainT, hitT);
      // Souls and props break it before an enemy behind them, as on the host.
      let other = Infinity;
      for (const s of w.souls) {
        const t = rayCylinder(x, y, z, f.dx, f.dy, f.dz, s.x, s.y, s.base - pr, SOUL_RADIUS + pr, SOUL_HEIGHT + 2 * pr);
        if (t <= terrainT) other = Math.min(other, t);
      }
      for (const p of w.props) {
        if (w.broken.has(p.id)) continue;
        if (Math.abs(p.x - x) > len + PROP_RADIUS + pr || Math.abs(p.y - y) > len + PROP_RADIUS + pr) continue;
        const pz = w.map.floor[Math.floor(p.y) * w.map.w + Math.floor(p.x)];
        const t = rayCylinder(x, y, z, f.dx, f.dy, f.dz, p.x, p.y, pz - pr, PROP_RADIUS + pr, PROP_HEIGHT[p.family] + 2 * pr);
        if (t <= stopT) other = Math.min(other, t);
      }
      if (other <= stopT && other < hitT) { stopT = other; hit = -1; hitT = Infinity; }
      if (hitT < Infinity || other === stopT || terrainT < len) {
        this.end(f, now, f.traveled + stopT);
        breaks.push({ x: x + f.dx * stopT, y: y + f.dy * stopT, z: z + f.dz * stopT, enemy: hit });
        continue;
      }
      f.traveled += len;
      const nx = f.x0 + f.dx * f.traveled, ny = f.y0 + f.dy * f.traveled, nz = f.z0 + f.dz * f.traveled;
      if (f.traveled >= f.range - 1e-9) {
        // Beyond an open edge it vanishes without breaking (M10 §3.4).
        if (overVoid(w.map, nx, ny)) this.end(f, now, -1);
        else { this.end(f, now, f.traveled); breaks.push({ x: nx, y: ny, z: nz, enemy: -1 }); }
      } else if (nx < 0 || ny < 0 || nx >= w.map.w || ny >= w.map.h || nz > WALL_TOP) this.end(f, now, -1);
    }
    this.flights = this.flights.filter((f) => f.ended < 0 || now - f.ended < FORGET_MS);
    return breaks;
  }

  private end(f: Flight, now: number, brokeAt: number): void {
    f.ended = now;
    f.brokeAt = brokeAt;
  }

  /** The flying censers' drawn places, the muzzle offset fading out. */
  drawn(now: number, out: (x: number, y: number, z: number) => void): void {
    for (const f of this.flights) {
      if (f.ended >= 0) continue;
      const k = Math.max(0, 1 - (now - f.at) / CENSER_BLEND_MS);
      out(f.x0 + f.dx * f.traveled + f.mx * k, f.y0 + f.dy * f.traveled + f.my * k, f.z0 + f.dz * f.traveled + f.mz * k);
    }
  }

  /**
   * A host censer of this player's in `slot`, new in a snapshot that arrived now at (x, y, z): matched to
   * the unmatched local censer thrown within CENSER_MATCH_MS whose path passes nearest, if one passes within
   * MATCH_OFF. A censer that broke at point-blank between two snapshots never shows, so the order of the
   * throws alone doesn't tell them apart. Returns whether it was matched.
   */
  claim(slot: number, now: number, x: number, y: number, z: number): boolean {
    const held = this.hostSlots.get(slot);
    if (held && held.released < 0) return true;
    this.hostSlots.delete(slot);
    let f: Flight | undefined, best = MATCH_OFF;
    for (const q of this.flights) {
      if (q.host >= 0 || now - q.at > CENSER_MATCH_MS) continue;
      const along = Math.max(0, (x - q.x0) * q.dx + (y - q.y0) * q.dy + (z - q.z0) * q.dz);
      const off = Math.hypot(x - (q.x0 + q.dx * along), y - (q.y0 + q.dy * along), z - (q.z0 + q.dz * along));
      if (off <= best) { best = off; f = q; }
    }
    if (!f) { this.unmatched++; return false; }
    f.host = slot;
    this.hostSlots.set(slot, { flight: f, released: -1 });
    this.matched++;
    return true;
  }

  /** Whether the host censer drawn in `slot` is a local one's, so it isn't drawn. */
  hides(slot: number, now: number): boolean {
    const h = this.hostSlots.get(slot);
    if (!h) return false;
    if (h.released < 0 || now - h.released < HIDE_AFTER_MS) return true;
    this.hostSlots.delete(slot);
    return false;
  }

  /**
   * The host's censer in `slot` vanished, last seen at (x, y, z). Returns true if it was matched: its
   * break already played here. Counts it agreed if that place lies on the local one's path just behind
   * where the local one broke.
   */
  release(slot: number, x: number, y: number, z: number, now: number): boolean {
    const h = this.hostSlots.get(slot);
    if (!h || h.released >= 0) return false;
    h.released = now;
    const f = h.flight;
    const along = (x - f.x0) * f.dx + (y - f.y0) * f.dy + (z - f.z0) * f.dz;
    const off = Math.hypot(x - (f.x0 + f.dx * along), y - (f.y0 + f.dy * along), z - (f.z0 + f.dz * along));
    if (f.brokeAt >= 0 && off <= 1 && along >= f.brokeAt - AGREE_BEHIND && along <= f.brokeAt + AGREE_AHEAD) this.agreed++;
    return true;
  }

  get flying(): number {
    return this.flights.filter((f) => f.ended < 0).length;
  }

  clear(): void {
    this.flights = [];
    this.hostSlots.clear();
  }
}
