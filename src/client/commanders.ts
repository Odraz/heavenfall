import { validCommanderCasts, type CommanderCast } from '../data/commanders';
import { CANTOR, CARRIER } from '../data/enemies';
import type { FloorSync } from '../net/messages';
import type { Snapshot } from '../net/protocol';

/** Full authoritative replacement, ordered by tick/revision and isolated by run/incarnation. */
export class CommanderProjection {
  readonly active = new Map<number, CommanderCast>();
  private tick = -1;
  private revision = -1;
  private previous = new Map<number, CommanderCast>();
  private previousTick = -1;
  constructor(private readonly runId: string) {}
  sync(s: FloorSync | Snapshot): boolean {
    const revision = 'revision' in s ? s.revision : s.stateRevision, casts = s.commanderCasts ?? [];
    if (s.runId !== this.runId || s.tick < this.tick || revision < this.revision || !Number.isInteger(revision) || revision > 0xffffffff || !validCommanderCasts(casts, s.tick)) return false;
    if ('enemyCount' in s && (s.enemyCount !== s.totalEnemyCount || casts.length !== (s.totalCommanderCasts ?? 0) || casts.some((c) => {
      const i = s.enemySlot.indexOf(c.slot);
      return i < 0 || s.enemyIncarnation[i] !== c.incarnation || s.enemyType[i] !== (c.kind === 'beam' ? CANTOR : CARRIER);
    }))) return false;
    if (s.tick > this.tick) { this.previous = new Map(this.active); this.previousTick = this.tick; }
    this.tick = s.tick; this.revision = revision; this.active.clear();
    for (const c of casts) this.active.set(c.slot, { ...c });
    return true;
  }
  /** Render angles between accepted samples, with a bounded three-tick presentation delay.
   * Never extrapolate damage phases or interpolate a reused enemy slot. */
  sample(slot: number, tick: number): CommanderCast | undefined {
    const c = this.active.get(slot), p = this.previous.get(slot);
    if (!c || !p || p.incarnation !== c.incarnation || p.castId !== c.castId || this.tick <= this.previousTick) return c;
    const f = Math.max(0, Math.min(1, (tick - 3 - this.previousTick) / (this.tick - this.previousTick)));
    const yaw = p.yaw + Math.atan2(Math.sin(c.yaw - p.yaw), Math.cos(c.yaw - p.yaw)) * f;
    return { ...c, yaw: Math.atan2(Math.sin(yaw), Math.cos(yaw)), pitch: p.pitch + (c.pitch - p.pitch) * f,
      x: p.x + (c.x - p.x) * f, y: p.y + (c.y - p.y) * f, z: p.z + (c.z - p.z) * f };
  }
  live(s: Snapshot | null, tick: number): CommanderCast[] {
    if (!s) return [];
    return [...this.active.values()].filter((c) => {
      const i = s.enemySlot.indexOf(c.slot);
      return i >= 0 && s.enemyIncarnation[i] === c.incarnation && tick >= c.phaseTick && (c.phase === 'idle' || tick < c.endTick);
    }).map(c => this.sample(c.slot, tick)!);
  }
}
