/**
 * Lag compensation (netcode stage, 2026-10-22): a shooter aims at the enemies its screen draws, which
 * are interpolated between two snapshots a round trip and the render delay in the past. The host keeps
 * every living enemy's accepted position for the last few ticks and, while it resolves one player's
 * attack, moves the enemies back to where that player saw them. Pure: no DOM or three.js.
 */
import { ENEMY_SLOTS } from './constants';

/** Ticks of history kept: 0.5 s at 30 Hz. */
export const HISTORY_TICKS = 15;
/** The furthest back an attack is resolved: 0.4 s, which covers a 250 ms round trip plus the render delay. */
export const MAX_REWIND_TICKS = 12;

/** What a player's screen showed when it sent an input: snapshot `tick`, the next one `gap` ticks later, `frac` of the way. */
export interface ViewTick {
  tick: number;
  /** Ticks to the next snapshot, 0 when the newest was held (no interpolation). */
  gap: number;
  /** 0..1 between `tick` and `tick + gap`. */
  frac: number;
}

export const NO_VIEW: ViewTick = { tick: -1, gap: 0, frac: 0 };

/**
 * How many ticks `view` is behind `tick` (the newest state the host has), 0 to MAX_REWIND_TICKS; 0 for
 * no view. Dodge compensation moves enemy projectiles back by this much per player.
 */
export function viewLag(view: ViewTick, tick: number): number {
  if (view.tick < 0) return 0;
  return Math.max(0, Math.min(MAX_REWIND_TICKS, tick - (view.tick + view.gap * view.frac)));
}

/** The view of the (fractional) snapshot time `t`: what a screen drawing `t` would send. */
export function viewAt(t: number): ViewTick {
  const tick = Math.floor(t);
  return { tick, gap: 1, frac: t - tick };
}

/** The enemies' accepted positions per tick, indexed by slot, with the tick each was written at. */
export class EnemyHistory {
  private readonly x: Float64Array[] = [];
  private readonly y: Float64Array[] = [];
  private readonly z: Float64Array[] = [];
  /** The tick each slot's entry was recorded at; an entry is valid only for its ring tick. */
  private readonly stamp: Int32Array[] = [];
  /** The newest recorded tick, or -1. */
  newest = -1;
  /** Slots moved by `rewind`, their rewound positions and their positions before it. */
  private readonly moved: number[] = [];
  private readonly saved: number[] = [];

  constructor(slots = ENEMY_SLOTS) {
    for (let i = 0; i < HISTORY_TICKS; i++) {
      this.x.push(new Float64Array(slots));
      this.y.push(new Float64Array(slots));
      this.z.push(new Float64Array(slots));
      this.stamp.push(new Int32Array(slots).fill(-1));
    }
  }

  /** Records the living enemies' positions at the end of `tick`: what that tick's snapshot carries. */
  record(tick: number, active: ArrayLike<number>, count: number, ex: ArrayLike<number>, ey: ArrayLike<number>, ez: ArrayLike<number>): void {
    const r = tick % HISTORY_TICKS;
    const x = this.x[r], y = this.y[r], z = this.z[r], st = this.stamp[r];
    for (let k = 0; k < count; k++) {
      const s = active[k];
      x[s] = ex[s]; y[s] = ey[s]; z[s] = ez[s]; st[s] = tick;
    }
    this.newest = tick;
  }

  /** Forgets everything (a new floor, a fixture reset). */
  clear(): void {
    for (const st of this.stamp) st.fill(-1);
    this.newest = -1;
  }

  private has(slot: number, tick: number): boolean {
    return tick >= 0 && tick <= this.newest && tick > this.newest - HISTORY_TICKS && this.stamp[tick % HISTORY_TICKS][slot] === tick;
  }

  /**
   * Where `slot` was drawn for `view`, into `out`; false if it wasn't recorded then (it spawned later).
   * The view is clamped to the history and to MAX_REWIND_TICKS before the newest tick. Within those
   * bounds it interpolates between the same two snapshot ticks the client did; otherwise between the
   * two recorded ticks around the clamped time.
   */
  positionAt(slot: number, view: ViewTick, out: [number, number, number]): boolean {
    if (this.newest < 0 || view.tick < 0) return false;
    const oldest = this.newest - MAX_REWIND_TICKS;
    let a: number, b: number, f: number;
    if (view.tick >= oldest && view.tick + view.gap <= this.newest) {
      a = view.tick; b = view.tick + view.gap; f = view.gap > 0 ? view.frac : 0;
    } else {
      const t = Math.max(oldest, Math.min(this.newest, view.tick + view.gap * view.frac));
      a = Math.floor(t); b = Math.min(this.newest, a + 1); f = b > a ? t - a : 0;
    }
    if (!this.has(slot, a)) return false;
    const ra = a % HISTORY_TICKS;
    let x = this.x[ra][slot], y = this.y[ra][slot], z = this.z[ra][slot];
    if (f > 0 && b !== a && this.has(slot, b)) {
      const rb = b % HISTORY_TICKS;
      x += (this.x[rb][slot] - x) * f; y += (this.y[rb][slot] - y) * f; z += (this.z[rb][slot] - z) * f;
    }
    out[0] = x; out[1] = y; out[2] = z;
    return true;
  }

  /**
   * Moves every living enemy to where `view` drew it, remembering where each was. Enemies with no
   * record then stay put. Call `restore` after resolving the attack. Returns how many moved.
   */
  rewind(view: ViewTick, active: ArrayLike<number>, count: number, ex: Float64Array, ey: Float64Array, ez: Float64Array): number {
    this.moved.length = 0;
    this.saved.length = 0;
    if (view.tick < 0) return 0;
    const at: [number, number, number] = [0, 0, 0];
    for (let k = 0; k < count; k++) {
      const s = active[k];
      if (!this.positionAt(s, view, at)) continue;
      if (at[0] === ex[s] && at[1] === ey[s] && at[2] === ez[s]) continue;
      this.moved.push(s);
      this.saved.push(ex[s], ey[s], ez[s], at[0], at[1], at[2]);
      ex[s] = at[0]; ey[s] = at[1]; ez[s] = at[2];
    }
    return this.moved.length;
  }

  /**
   * Puts every rewound enemy back where it was, keeping any displacement the attack itself caused
   * (a pull, a knockback applied at once).
   */
  restore(ex: Float64Array, ey: Float64Array, ez: Float64Array): void {
    for (let i = 0; i < this.moved.length; i++) {
      const s = this.moved[i], o = i * 6;
      ex[s] = this.saved[o] + (ex[s] - this.saved[o + 3]);
      ey[s] = this.saved[o + 1] + (ey[s] - this.saved[o + 4]);
      ez[s] = this.saved[o + 2] + (ez[s] - this.saved[o + 5]);
    }
    this.moved.length = 0;
    this.saved.length = 0;
  }
}
