/**
 * Launches and landings (classes-fallen.md §3 "Launch", game.md §4.11 `airborne`). To launch an enemy is
 * to knock it back over Falling Star's 0.4 s, drawn as its arc; the host moves it along the ground like
 * any knockback, so its hit cylinder stays where shots are aimed. Only ground enemies land; Cherubs are
 * knocked back and never land; bound enemies and the Gatekeeper are never launched.
 *
 * Each ground launch keeps a landing record with its owner and kind. At its landing tick one bundle runs
 * the owned landing passives: controls first (Broken Wings, Where They Fall), then damage (As We Fell),
 * then A Third of the Stars' crash, merged per cast. A body that died in flight still crashes at its last
 * accepted point but is never read again by slot (its incarnation is checked).
 */
import { ENEMIES, isBossBody } from '../data/enemies';
import { TICK_HZ } from './constants';
import type { Simulation, SimPlayer } from './sim';

/** Who launched: a native Q/E, a native weapon, a direct owned item, or anything else (relics, combos). */
export type LaunchKind = 'qe' | 'weapon' | 'item' | 'other';
export const LAUNCH_SECONDS = 0.4;
const LAUNCH_TICKS = Math.round(LAUNCH_SECONDS * TICK_HZ);

export interface Landing {
  slot: number;
  incarnation: number;
  owner: SimPlayer | null;
  kind: LaunchKind;
  /** The launching action; crash damage is merged per cast. */
  cast: number;
  tick: number;
  x: number; y: number; z: number; room: number;
}

export class Launches {
  /** Pending landings, in launch order. */
  readonly pending: Landing[] = [];
  /** Tick each slot's current launch ends (the `airborne` window). */
  readonly airborneUntil: Int32Array;
  private nextCast = 1;

  constructor(private readonly sim: Simulation, slots: number) {
    this.airborneUntil = new Int32Array(slots);
  }

  newCast(): number {
    return this.nextCast++;
  }

  airborne(s: number): boolean {
    return this.sim.tick < this.airborneUntil[s];
  }

  /**
   * Launches enemy `s` `dist` m along (dx, dy). Returns false for a bound enemy or the Gatekeeper. A
   * ground enemy gets a landing record; a flyer is only knocked back.
   */
  launch(s: number, dx: number, dy: number, dist: number, owner: SimPlayer | null, kind: LaunchKind, cast: number): boolean {
    const sim = this.sim;
    if (!sim.eAlive[s] || isBossBody(sim.eType[s]) || sim.isRooted(s) || Math.hypot(dx, dy) < 1e-9) return false;
    sim.knockback(s, dx, dy, dist, LAUNCH_SECONDS);
    sim.commanders.cancel(s); sim.watchmen.cancel(s); sim.dominions.cancel(s, sim.tick);
    // A flyer is knocked back and never lands.
    if (ENEMIES[sim.eType[s]].flying) return true;
    sim.eCast[s] = 0; sim.eCastT[s] = 0;
    this.airborneUntil[s] = sim.tick + LAUNCH_TICKS;
    // A new launch of the same body replaces its pending landing.
    for (let i = this.pending.length - 1; i >= 0; i--) if (this.pending[i].slot === s && this.pending[i].incarnation === sim.eIncarnation[s]) this.pending.splice(i, 1);
    this.pending.push({ slot: s, incarnation: sim.eIncarnation[s], owner, kind, cast, tick: sim.tick + LAUNCH_TICKS,
      x: sim.eX[s], y: sim.eY[s], z: sim.eZ[s], room: sim.roomAt(sim.eX[s], sim.eY[s]) });
    return true;
  }

  /** Launches away from a point (cx, cy); a body exactly there goes along a fixed angle from its slot. */
  launchFrom(s: number, cx: number, cy: number, dist: number, owner: SimPlayer | null, kind: LaunchKind, cast: number): boolean {
    let dx = this.sim.eX[s] - cx, dy = this.sim.eY[s] - cy;
    if (Math.hypot(dx, dy) < 1e-6) { const a = (s % 16) * (Math.PI / 8); dx = Math.cos(a); dy = Math.sin(a); }
    return this.launch(s, dx, dy, dist, owner, kind, cast);
  }

  /** Follows each body in flight and returns the landings due this tick, in launch order. */
  due(): Landing[] {
    const sim = this.sim, out: Landing[] = [];
    for (let i = 0; i < this.pending.length;) {
      const l = this.pending[i];
      const alive = sim.eAlive[l.slot] === 1 && sim.eIncarnation[l.slot] === l.incarnation;
      if (alive) { l.x = sim.eX[l.slot]; l.y = sim.eY[l.slot]; l.z = sim.eZ[l.slot]; l.room = sim.roomAt(l.x, l.y); }
      if (sim.tick >= l.tick) { out.push(l); this.pending.splice(i, 1); } else i++;
    }
    return out;
  }

  /** Whether a landing's body is still the same living enemy. */
  alive(l: Landing): boolean {
    return this.sim.eAlive[l.slot] === 1 && this.sim.eIncarnation[l.slot] === l.incarnation;
  }

  clear(): void {
    this.pending.length = 0;
    this.airborneUntil.fill(0);
  }
}
