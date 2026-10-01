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

export interface InterpolatedEnemies {
  count: number;
  slot: Uint16Array;
  x: Float32Array;
  y: Float32Array;
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
    /** Render delay in ticks: 1.5 on the host, 4.5 on remote clients. */
    readonly delayTicks: number,
  ) {}

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
    const part = decodeSnapshot(buf);
    if (!part) return;
    const snap = this.assembler.add(part);
    if (!snap) return;
    const slotIndex = new Int16Array(ENEMY_SLOTS).fill(-1);
    for (let i = 0; i < snap.enemyCount; i++) slotIndex[snap.enemySlot[i]] = i;
    const projIndex = new Int16Array(PROJECTILE_SLOTS).fill(-1);
    for (let i = 0; i < snap.projectileCount; i++) projIndex[snap.projSlot[i]] = i;
    const prev = this.newest;
    this.ring.push({ snap, arrival: now, slotIndex, projIndex });
    if (this.ring.length > KEEP) this.ring.shift();
    this.enemyCountsByTick.set(snap.tick, snap.enemyCount);
    if (this.enemyCountsByTick.size > 90) {
      const oldest = this.enemyCountsByTick.keys().next().value as number;
      this.enemyCountsByTick.delete(oldest);
    }
    this.onComplete(snap, prev);
  }

  /** The client's estimate of the current tick (§9.4). */
  estimatedTick(now: number): number {
    const n = this.ring[this.ring.length - 1];
    return n ? n.snap.tick + ((now - n.arrival) / 1000) * TICK_HZ : 0;
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
      });
    }
    return out;
  }
}
