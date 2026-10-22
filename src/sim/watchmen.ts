/** The Watchman (rogue rooms.md §6.4): picks the nearest visible player, aims 1 s, then an instant traced shot. Host only. */
import { ST_ATTACKING, ST_FALLING, ST_IDLE, ST_WINDUP } from '../data/enemies';
import {
  WATCHMAN_AIM_TICKS,
  WATCHMAN_DAMAGE,
  WATCHMAN_FIRED_TICKS,
  WATCHMAN_MUZZLE_Z,
  WATCHMAN_RANGE,
  WATCHMAN_REACH,
  WATCHMAN_RECORD_CAP,
  WATCHMAN_RELOAD_TICKS,
  type WatchmanAim,
} from '../data/watchman';
import { ENEMY_SLOTS, PLAYER_HEIGHT, TICK_DT } from './constants';
import { lineOfSight, raycastTerrain } from './los';
import type { Simulation, SimPlayer } from './sim';
import { HURT_RANGED } from '../net/protocol';

export class Watchmen {
  /** Aiming Watchmen and those that fired in the last 0.5 s, by slot. */
  readonly records = new Map<number, WatchmanAim>();
  /** A wrapping shot counter per slot, reset when a Watchman spawns. */
  private readonly shots = new Uint8Array(ENEMY_SLOTS);

  constructor(private readonly sim: Simulation) {}

  /** Detached records valid at this tick: a fired record expires 0.5 s after its shot even if its Watchman skipped a tick. */
  checkpoint(): WatchmanAim[] {
    const tick = this.sim.tick, out: WatchmanAim[] = [];
    for (const [slot, a] of this.records) {
      if (a.phase === 'fired' && tick - a.fireTick >= WATCHMAN_FIRED_TICKS) { this.records.delete(slot); continue; }
      if (a.phase === 'aim' && a.fireTick <= tick) continue;
      if (out.length < WATCHMAN_RECORD_CAP) out.push({ ...a });
    }
    return out;
  }

  spawn(slot: number): void {
    this.shots[slot] = 0;
    this.records.delete(slot);
  }

  /** Death or cleanup: an aim ends with no shot. */
  remove(slot: number): void {
    this.records.delete(slot);
  }

  aiming(slot: number): boolean {
    return this.records.get(slot)?.phase === 'aim';
  }

  /** Whether `p` can be aimed at: living, targetable, allowed (One of Them, leash) and in the Watchman's room. */
  private eligible(slot: number, p: SimPlayer | undefined): p is SimPlayer {
    const sim = this.sim;
    return sim.livingTargetable(p) && sim.enemyMayTarget(slot, p) && (sim.eRoom[slot] < 0 || sim.roomAt(p.x, p.y) === sim.eRoom[slot]);
  }

  private muzzleZ(slot: number): number {
    return this.sim.eZ[slot] + WATCHMAN_MUZZLE_Z;
  }

  /** Muzzle to body center, in meters, when visible within 20 m; -1 otherwise. */
  private sight(slot: number, p: SimPlayer): number {
    const sim = this.sim, z = this.muzzleZ(slot), cz = p.z + PLAYER_HEIGHT / 2;
    const d = Math.hypot(p.x - sim.eX[slot], p.y - sim.eY[slot], cz - z);
    return d <= WATCHMAN_RANGE && lineOfSight(sim.map, sim.eX[slot], sim.eY[slot], z, p.x, p.y, cz) ? d : -1;
  }

  /**
   * Ordinary retargeting: an aim keeps its locked target while that target stays eligible, and a
   * Watchman with a visible target keeps it between aims. Returns false to let the caller pick the
   * movement target; an aim whose target became ineligible is canceled first.
   */
  retarget(slot: number): boolean {
    const sim = this.sim, p = sim.eTarget[slot] >= 0 ? sim.slots[sim.eTarget[slot]] : undefined;
    const valid = this.eligible(slot, p);
    if (this.aiming(slot)) {
      if (valid) return true;
      this.cancel(slot);
    } else if (valid && sim.eLos[slot] === 1 && sim.tick >= sim.eTauntUntil[slot]) return true;
    // The caller picks a new movement target; the next sight check decides what it can see.
    sim.eLos[slot] = 0;
    return false;
  }

  /**
   * The line-of-sight check, twice a second: between aims, target the nearest eligible player it can
   * see within 20 m (lowest index on ties), or the Fallen while taunted. With none, it walks toward
   * its movement target.
   */
  look(slot: number): void {
    const sim = this.sim;
    if (this.aiming(slot)) return;
    if (sim.tick < sim.eTauntUntil[slot]) {
      const f = sim.players.find((p) => p.classId === 'fallen');
      if (f && this.eligible(slot, f)) {
        sim.eTarget[slot] = f.index;
        sim.eLos[slot] = this.sight(slot, f) >= 0 ? 1 : 0;
        return;
      }
    }
    let best: SimPlayer | undefined, bestD = Infinity;
    for (let i = 0; i < sim.slots.length; i++) {
      const p = sim.slots[i];
      if (!this.eligible(slot, p)) continue;
      const d = this.sight(slot, p);
      if (d >= 0 && d < bestD) { bestD = d; best = p; }
    }
    if (best) { sim.eTarget[slot] = best.index; sim.eLos[slot] = 1; }
    else sim.eLos[slot] = 0;
  }

  /** Whether it stands still: aiming, or holding a visible target within range between aims. */
  holds(slot: number): boolean {
    const sim = this.sim;
    if (this.aiming(slot)) return true;
    const t = sim.eTarget[slot], p = t >= 0 ? sim.slots[t] : undefined;
    if (!sim.eLos[slot] || !p) return false;
    return Math.hypot(p.x - sim.eX[slot], p.y - sim.eY[slot], p.z + PLAYER_HEIGHT / 2 - this.muzzleZ(slot)) <= WATCHMAN_RANGE;
  }

  /**
   * Once per tick after movement. `interrupted`: stunned or launched; `thrown` sets the falling state.
   * A launch, stun, silence or a pull (the caller) cancels an aim with no shot and starts the reload.
   */
  update(slot: number, interrupted: boolean, thrown: boolean): void {
    const sim = this.sim, tick = sim.tick;
    if (sim.eCastCd[slot] > 0) sim.eCastCd[slot] = Math.max(0, sim.eCastCd[slot] - TICK_DT);
    const r = this.records.get(slot);
    if (r?.phase === 'fired' && tick - r.fireTick >= WATCHMAN_FIRED_TICKS) this.records.delete(slot);
    const silenced = tick < sim.eSilenceUntil[slot];
    if (interrupted || silenced) {
      this.cancel(slot);
      if (interrupted) sim.eState[slot] = thrown ? ST_FALLING : ST_IDLE;
      return;
    }
    if (r?.phase === 'aim') {
      const p = sim.slots[sim.eTarget[slot]];
      if (!this.eligible(slot, p)) { this.cancel(slot); return; }
      if (tick >= r.fireTick) this.fire(slot, r, p);
      else sim.eState[slot] = ST_WINDUP;
      return;
    }
    if (sim.eCastCd[slot] > 1e-9) return;
    const t = sim.eTarget[slot], p = t >= 0 ? sim.slots[t] : undefined;
    // The target was picked at the last sight check; it must still be in sight now to start an aim.
    if (!sim.eLos[slot] || !this.eligible(slot, p) || this.sight(slot, p) < 0) return;
    this.records.set(slot, { slot, incarnation: sim.eIncarnation[slot], targetId: p.id, phase: 'aim', fireTick: tick + WATCHMAN_AIM_TICKS, shot: this.shots[slot], x: 0, y: 0, z: 0 });
    sim.eCast[slot] = 1;
    sim.eState[slot] = ST_WINDUP;
  }

  /** Ends an aim without a shot and starts the reload; a fired record keeps showing. */
  cancel(slot: number): void {
    if (!this.aiming(slot)) return;
    this.records.delete(slot);
    const sim = this.sim;
    sim.eCast[slot] = 0;
    sim.eCastT[slot] = 0;
    sim.eCastCd[slot] = WATCHMAN_RELOAD_TICKS * TICK_DT;
  }

  /** One terrain trace from the muzzle to the target's accepted body center, up to 30 m: 12 damage if clear. */
  private fire(slot: number, r: WatchmanAim, p: SimPlayer): void {
    const sim = this.sim;
    const ox = sim.eX[slot], oy = sim.eY[slot], oz = this.muzzleZ(slot), cz = p.z + PLAYER_HEIGHT / 2;
    let dx = p.x - ox, dy = p.y - oy, dz = cz - oz;
    const d = Math.hypot(dx, dy, dz);
    let end = 0;
    let hit = false;
    if (d > 1e-9) {
      dx /= d; dy /= d; dz /= d;
      const reach = Math.min(d, WATCHMAN_REACH);
      end = raycastTerrain(sim.map, ox, oy, oz, dx, dy, dz, reach);
      hit = end >= reach - 1e-9 && d <= WATCHMAN_REACH;
    } else hit = true;
    this.shots[slot] = (this.shots[slot] + 1) & 0xff;
    Object.assign(r, { phase: 'fired', fireTick: sim.tick, shot: this.shots[slot],
      x: hit ? p.x : ox + dx * end, y: hit ? p.y : oy + dy * end, z: hit ? cz : oz + dz * end });
    sim.eCast[slot] = 0;
    sim.eCastT[slot] = 0;
    sim.eCastCd[slot] = WATCHMAN_RELOAD_TICKS * TICK_DT;
    sim.eState[slot] = ST_ATTACKING;
    // An ordinary hostile hit: shields absorb it, invulnerability ignores it, Fallen mitigation applies.
    if (hit) sim.damagePlayer(p, WATCHMAN_DAMAGE, { x: sim.eX[slot], y: sim.eY[slot], kind: HURT_RANGED });
  }
}
