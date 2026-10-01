/** Client-side snapshot store and interpolation (§9.4). */
import { ENEMY_SLOTS, TICK_HZ } from '../sim/constants';
import { decodeSnapshot, SnapshotAssembler, type Snapshot } from '../net/protocol';

interface Stored {
  snap: Snapshot;
  /** performance.now() when it became complete. */
  arrival: number;
  /** Index into the snapshot's enemy arrays per slot, or -1. */
  slotIndex: Int16Array;
}

const KEEP = 12;

export interface InterpolatedEnemies {
  count: number;
  slot: Uint16Array;
  x: Float32Array;
  y: Float32Array;
  type: Uint8Array;
  state: Uint8Array;
  flags: Uint8Array;
}

export class SnapshotBuffer {
  private readonly assembler = new SnapshotAssembler();
  private readonly ring: Stored[] = [];
  /** Living enemies per tick, for the last 90 complete snapshots. */
  readonly enemyCountsByTick = new Map<number, number>();
  /** Called with each complete snapshot. */
  onComplete: (s: Snapshot) => void = () => {};

  readonly out: InterpolatedEnemies = {
    count: 0,
    slot: new Uint16Array(ENEMY_SLOTS),
    x: new Float32Array(ENEMY_SLOTS),
    y: new Float32Array(ENEMY_SLOTS),
    type: new Uint8Array(ENEMY_SLOTS),
    state: new Uint8Array(ENEMY_SLOTS),
    flags: new Uint8Array(ENEMY_SLOTS),
  };

  constructor(
    /** Render delay in ticks: 1.5 on the host, 4.5 on remote clients. */
    readonly delayTicks: number,
  ) {}

  get newest(): Snapshot | null {
    return this.ring.length ? this.ring[this.ring.length - 1].snap : null;
  }

  get newestArrival(): number {
    return this.ring.length ? this.ring[this.ring.length - 1].arrival : 0;
  }

  addPart(buf: ArrayBuffer, now: number): void {
    const part = decodeSnapshot(buf);
    if (!part) return;
    const snap = this.assembler.add(part);
    if (!snap) return;
    const slotIndex = new Int16Array(ENEMY_SLOTS).fill(-1);
    for (let i = 0; i < snap.enemyCount; i++) slotIndex[snap.enemySlot[i]] = i;
    this.ring.push({ snap, arrival: now, slotIndex });
    if (this.ring.length > KEEP) this.ring.shift();
    this.enemyCountsByTick.set(snap.tick, snap.enemyCount);
    if (this.enemyCountsByTick.size > 90) {
      const oldest = this.enemyCountsByTick.keys().next().value as number;
      this.enemyCountsByTick.delete(oldest);
    }
    this.onComplete(snap);
  }

  /** The client's estimate of the current tick (§9.4). */
  estimatedTick(now: number): number {
    const n = this.ring[this.ring.length - 1];
    return n ? n.snap.tick + ((now - n.arrival) / 1000) * TICK_HZ : 0;
  }

  /**
   * Interpolates enemies at the render tick (estimate minus the delay): the enemies of the snapshot
   * at or before it, moved toward the next snapshot where they're still present. No extrapolation.
   */
  interpolate(now: number): InterpolatedEnemies {
    const out = this.out;
    out.count = 0;
    if (this.ring.length === 0) return out;
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
    let f = 0;
    if (B) f = Math.max(0, Math.min(1, (renderTick - A.snap.tick) / (B.snap.tick - A.snap.tick)));
    const a = A.snap;
    for (let i = 0; i < a.enemyCount; i++) {
      const slot = a.enemySlot[i];
      let x = a.enemyX[i];
      let y = a.enemyY[i];
      let state = a.enemyState[i];
      let flags = a.enemyFlags[i];
      if (B) {
        const j = B.slotIndex[slot];
        if (j >= 0) {
          x += (B.snap.enemyX[j] - x) * f;
          y += (B.snap.enemyY[j] - y) * f;
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
      out.type[k] = a.enemyType[i];
      out.state[k] = state;
      out.flags[k] = flags;
    }
    return out;
  }
}
