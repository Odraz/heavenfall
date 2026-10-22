/** Client-side snapshot store and interpolation (§9.4). */
import { ENEMY_SLOTS, PROJECTILE_SLOTS, TICK_HZ } from '../sim/constants';
import { decodeSnapshot, SnapshotAssembler, type Snapshot } from '../net/protocol';

interface Stored {
  snap: Snapshot;
  /** performance.now() when it became complete. */
  arrival: number;
  /** Index into the snapshot's enemy arrays per slot, or -1. */
  slotIndex: Int16Array;
  /** Index into the snapshot's projectile arrays per slot, or -1. */
  projIndex: Int16Array;
}

const KEEP = 12;

/**
 * The snapshot clock (netcode stage, 2026-10-22). Each complete snapshot gives a sample of
 * `tick - now × 30 / 1000`; the clock follows their running average instead of jumping to each one,
 * so a late or early snapshot no longer moves the drawn world backwards or forwards. The clock never
 * runs backwards: it corrects by at most CLOCK_SLEW of its own rate.
 */
/** Weight of a new sample in the clock's average. */
const CLOCK_GAIN = 0.1;
/** The clock speeds up or slows down by at most this fraction to catch its average. */
const CLOCK_SLEW = 0.1;
/** Ticks: an error this large (a stall, a resumed pause) is taken at once rather than slewed. */
const CLOCK_SNAP = 10;
/** Weight of a new sample in the jitter average. */
const JITTER_GAIN = 0.1;
/** Extra render delay per tick of average jitter, beyond the first JITTER_FREE ticks, up to EXTRA_DELAY_MAX. */
const JITTER_DELAY = 2;
const JITTER_FREE = 0.25;
const EXTRA_DELAY_MAX = 3;

/** What the screen shows: the snapshot tick at or before the render tick, the gap to the next, and how far between. */
export interface View {
  tick: number;
  gap: number;
  frac: number;
}

export interface InterpolatedEnemies {
  count: number;
  slot: Uint16Array;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
  incarnation: Uint32Array;
  type: Uint8Array;
  state: Uint8Array;
  flags: Uint8Array;
}

export interface InterpolatedProjectiles {
  count: number;
  slot: Uint16Array;
  kind: Uint8Array;
  x: Float32Array;
  y: Float32Array;
  z: Float32Array;
}

export interface InterpolatedPlayer {
  id: number;
  x: number;
  y: number;
  z: number;
  yaw: number;
  dead: boolean;
  /** The ally this player heals with Sacrament, 255 for none (M9 §2.5). */
  beam: number;
}

export class SnapshotBuffer {
  private readonly assembler = new SnapshotAssembler();
  private readonly ring: Stored[] = [];
  /** Living enemies per tick, for the last 90 complete snapshots. */
  readonly enemyCountsByTick = new Map<number, number>();
  /** Called with each complete snapshot and the one before it. */
  onComplete: (s: Snapshot, prev: Snapshot | null) => void = () => {};

  readonly out: InterpolatedEnemies = {
    count: 0,
    slot: new Uint16Array(ENEMY_SLOTS),
    x: new Float32Array(ENEMY_SLOTS),
    y: new Float32Array(ENEMY_SLOTS),
    z: new Float32Array(ENEMY_SLOTS),
    incarnation: new Uint32Array(ENEMY_SLOTS),
    type: new Uint8Array(ENEMY_SLOTS),
    state: new Uint8Array(ENEMY_SLOTS),
    flags: new Uint8Array(ENEMY_SLOTS),
  };

  readonly projOut: InterpolatedProjectiles = {
    count: 0,
    slot: new Uint16Array(PROJECTILE_SLOTS),
    kind: new Uint8Array(PROJECTILE_SLOTS),
    x: new Float32Array(PROJECTILE_SLOTS),
    y: new Float32Array(PROJECTILE_SLOTS),
    z: new Float32Array(PROJECTILE_SLOTS),
  };

  readonly playersOut: InterpolatedPlayer[] = [];

  constructor(
    /** The least render delay in ticks: 1.5 on the host, 4.5 on remote clients. */
    readonly baseDelayTicks: number,
    private runId: string,
  ) { this.reset(runId); }

  /** The snapshot clock: its average offset `tick - now × 30 / 1000`, NaN before the first sample. */
  private offset = NaN;
  /** The clock's tick at `clockAt` (performance.now()). */
  private clockTick = 0;
  private clockAt = 0;
  /** Average absolute deviation of the samples from the offset, in ticks. */
  jitterTicks = 0;
  /** The extra render delay the jitter asks for, in ticks; it moves slowly. */
  private extraDelay = 0;
  /** What the screen showed at the latest `interpolate`, for lag compensation. */
  readonly view: View = { tick: -1, gap: 0, frac: 0 };

  /** Render delay in ticks: the base delay plus what the measured jitter asks for. */
  get delayTicks(): number {
    return this.baseDelayTicks + this.extraDelay;
  }

  /** A new run may restart ticks at zero; none of the old interpolation state survives. */
  reset(runId: string): void {
    this.runId = runId;
    this.assembler.reset(runId);
    this.ring.length = 0;
    this.enemyCountsByTick.clear();
    this.out.count = this.projOut.count = 0;
    this.playersOut.length = 0;
    this.offset = NaN;
    this.jitterTicks = this.extraDelay = 0;
    this.view.tick = -1;
  }

  get newest(): Snapshot | null {
    return this.ring.length ? this.ring[this.ring.length - 1].snap : null;
  }

  get newestArrival(): number {
    return this.ring.length ? this.ring[this.ring.length - 1].arrival : 0;
  }

  /** Whether an enemy slot is present in the newest complete snapshot. */
  hasEnemy(slot: number): boolean {
    return this.ring.length > 0 && this.ring[this.ring.length - 1].slotIndex[slot] >= 0;
  }

  addPart(buf: ArrayBuffer, now: number): void {
    const part = decodeSnapshot(buf, this.runId);
    if (!part) return;
    const snap = this.assembler.add(part, now);
    if (!snap) return;
    const slotIndex = new Int16Array(ENEMY_SLOTS).fill(-1);
    for (let i = 0; i < snap.enemyCount; i++) slotIndex[snap.enemySlot[i]] = i;
    const projIndex = new Int16Array(PROJECTILE_SLOTS).fill(-1);
    for (let i = 0; i < snap.projectileCount; i++) projIndex[snap.projSlot[i]] = i;
    const prev = this.newest;
    this.sample(snap.tick, now);
    this.ring.push({ snap, arrival: now, slotIndex, projIndex });
    if (this.ring.length > KEEP) this.ring.shift();
    this.enemyCountsByTick.set(snap.tick, snap.enemyCount);
    if (this.enemyCountsByTick.size > 90) {
      const oldest = this.enemyCountsByTick.keys().next().value as number;
      this.enemyCountsByTick.delete(oldest);
    }
    this.onComplete(snap, prev);
  }

  /** Moves every arrival time later by `ms`, so time spent with the simulation paused doesn't count. */
  shiftArrivals(ms: number): void {
    for (const r of this.ring) r.arrival += ms;
    const ticks = (ms / 1000) * TICK_HZ;
    this.offset -= ticks;
    this.clockTick -= ticks;
  }

  /** A complete snapshot of `tick` became available at `now`: a sample for the clock and the jitter. */
  private sample(tick: number, now: number): void {
    const s = tick - (now / 1000) * TICK_HZ;
    if (Number.isNaN(this.offset) || Math.abs(s - this.offset) > CLOCK_SNAP) {
      this.offset = s;
      this.clockTick = tick;
      this.clockAt = now;
      return;
    }
    const err = s - this.offset;
    this.jitterTicks += (Math.abs(err) - this.jitterTicks) * JITTER_GAIN;
    this.offset += err * CLOCK_GAIN;
    const want = Math.min(EXTRA_DELAY_MAX, Math.max(0, (this.jitterTicks - JITTER_FREE) * JITTER_DELAY));
    this.extraDelay += (want - this.extraDelay) * JITTER_GAIN;
  }

  /**
   * The client's estimate of the current tick (§9.4): the snapshot clock. It runs at the local clock's
   * rate, corrected toward the samples' average by at most CLOCK_SLEW, so it never runs backwards. A
   * `now` before the latest one is answered without moving the clock.
   */
  estimatedTick(now: number): number {
    if (Number.isNaN(this.offset)) return 0;
    const dt = ((now - this.clockAt) / 1000) * TICK_HZ;
    if (dt <= 0) return this.clockTick + dt;
    const target = (now / 1000) * TICK_HZ + this.offset;
    let next = this.clockTick + dt;
    const err = target - next;
    if (Math.abs(err) > CLOCK_SNAP) next = target;
    else next += Math.max(-CLOCK_SLEW * dt, Math.min(CLOCK_SLEW * dt, err));
    this.clockTick = next;
    this.clockAt = now;
    return next;
  }

  /** The snapshots around the render tick and the interpolation fraction between them. */
  private pair(now: number): { A: Stored; B: Stored | null; f: number } | null {
    if (this.ring.length === 0) return null;
    const renderTick = this.estimatedTick(now) - this.delayTicks;
    let ai = 0;
    for (let i = this.ring.length - 1; i >= 0; i--) {
      if (this.ring[i].snap.tick <= renderTick) {
        ai = i;
        break;
      }
    }
    const A = this.ring[ai];
    const B = ai + 1 < this.ring.length ? this.ring[ai + 1] : null;
    const f = B ? Math.max(0, Math.min(1, (renderTick - A.snap.tick) / (B.snap.tick - A.snap.tick))) : 0;
    return { A, B, f };
  }

  /**
   * Interpolates enemies, projectiles and players at the render tick (estimate minus the delay):
   * the entities of the snapshot at or before it, moved toward the next snapshot where they're still
   * present. No extrapolation.
   */
  interpolate(now: number): InterpolatedEnemies {
    const out = this.out;
    out.count = 0;
    this.projOut.count = 0;
    this.playersOut.length = 0;
    const pr = this.pair(now);
    if (!pr) return out;
    const { A, B, f } = pr;
    const a = A.snap;
    this.view.tick = a.tick;
    this.view.gap = B ? B.snap.tick - a.tick : 0;
    this.view.frac = B ? f : 0;
    for (let i = 0; i < a.enemyCount; i++) {
      const slot = a.enemySlot[i];
      let x = a.enemyX[i];
      let y = a.enemyY[i];
      let z = a.enemyZ[i];
      let state = a.enemyState[i];
      let flags = a.enemyFlags[i];
      if (B) {
        const j = B.slotIndex[slot];
        if (j >= 0 && B.snap.enemyIncarnation[j] === a.enemyIncarnation[i]) {
          x += (B.snap.enemyX[j] - x) * f;
          y += (B.snap.enemyY[j] - y) * f;
          z += (B.snap.enemyZ[j] - z) * f;
          if (f >= 0.5) {
            state = B.snap.enemyState[j];
            flags = B.snap.enemyFlags[j];
          }
        }
      }
      const k = out.count++;
      out.slot[k] = slot;
      out.x[k] = x;
      out.y[k] = y;
      out.z[k] = z;
      out.incarnation[k] = a.enemyIncarnation[i];
      out.type[k] = a.enemyType[i];
      out.state[k] = state;
      out.flags[k] = flags;
    }
    const po = this.projOut;
    for (let i = 0; i < a.projectileCount; i++) {
      const slot = a.projSlot[i];
      let x = a.projX[i];
      let y = a.projY[i];
      let z = a.projZ[i];
      if (B) {
        const j = B.projIndex[slot];
        if (j >= 0) {
          x += (B.snap.projX[j] - x) * f;
          y += (B.snap.projY[j] - y) * f;
          z += (B.snap.projZ[j] - z) * f;
        }
      }
      const k = po.count++;
      po.slot[k] = slot;
      po.kind[k] = a.projKind[i];
      po.x[k] = x;
      po.y[k] = y;
      po.z[k] = z;
    }
    for (const p of a.players) {
      const q = B?.snap.players.find((o) => o.id === p.id);
      this.playersOut.push({
        id: p.id,
        x: q ? p.x + (q.x - p.x) * f : p.x,
        y: q ? p.y + (q.y - p.y) * f : p.y,
        z: q ? p.z + (q.z - p.z) * f : p.z,
        yaw: p.yaw,
        dead: q && f >= 0.5 ? q.dead : p.dead,
        beam: q && f >= 0.5 ? q.beam : p.beam,
      });
    }
    return out;
  }
}
