/** Accepted cast projection; rendering/bots share these deadlines and matched incarnations. */
import type { DominionCast } from '../data/dominion';
import { DOMINION, ST_WINDUP } from '../data/enemies';
import type { FloorSync, GameEvent } from '../net/messages';
import { validCasts, type Snapshot } from '../net/protocol';

export class DominionProjection {
  readonly active = new Map<number, DominionCast>();
  private revision = -1;
  private tick = -1;
  constructor(readonly runId: string) {}
  private replace(casts: readonly DominionCast[], tick: number, revision: number): boolean {
    if (!Number.isInteger(revision) || revision < 0 || revision > 0xffffffff || revision < this.revision || tick < this.tick || !validCasts(casts, tick)) return false;
    this.revision = revision; this.tick = tick; this.active.clear();
    for (const cast of casts) this.active.set(cast.slot, { ...cast });
    return true;
  }
  sync(s: FloorSync): boolean {
    if (s.runId !== this.runId) return false;
    return this.replace(s.dominionCasts ?? [], s.tick, s.revision);
  }
  snapshot(s: Snapshot): boolean {
    const casts = s.dominionCasts ?? [];
    if (s.runId !== this.runId || s.enemyCount !== s.totalEnemyCount || casts.length !== (s.totalDominionCasts ?? 0) || !validCasts(casts, s.tick) || casts.some((c) => {
      const i = s.enemySlot.indexOf(c.slot);
      return i < 0 || s.enemyType[i] !== DOMINION || s.enemyState[i] !== ST_WINDUP || s.enemyIncarnation[i] !== c.incarnation;
    })) return false;
    return this.replace(casts, s.tick, s.stateRevision);
  }
  event(e: Extract<GameEvent, { type: 'dominionCast' }>, tick: number, revision: number): boolean {
    if (!Number.isInteger(revision) || revision <= this.revision || revision > 0xffffffff || !Number.isInteger(tick) || tick < this.tick || tick < e.cast?.startTick ||
      ![e.x, e.y, e.z].every(Number.isFinite) || !validCasts([e.cast], e.cast?.startTick) || !['start', 'strike', 'cancel'].includes(e.phase)) return false;
    if (e.phase === 'start' && !validCasts([e.cast], tick)) return false;
    if (e.phase === 'strike' && tick < e.cast.impactTick) return false;
    const current = this.active.get(e.cast.slot);
    if (e.phase === 'start' && (!current && this.active.size >= 3 || current && current.castId >= e.cast.castId)) return false;
    if (e.phase !== 'start' && current && (current.castId !== e.cast.castId || current.incarnation !== e.cast.incarnation || current.room !== e.cast.room ||
      current.startTick !== e.cast.startTick || current.impactTick !== e.cast.impactTick)) return false;
    this.revision = revision; this.tick = tick;
    if (e.phase === 'start') { this.active.set(e.cast.slot, { ...e.cast }); return true; }
    if (!current) return false;
    this.active.delete(e.cast.slot); return true;
  }
  /** Centers always come from the same accepted snapshot as the enemy incarnation. */
  rings(s: Snapshot, tick: number): Array<DominionCast & { x: number; y: number; z: number }> {
    const rings: Array<DominionCast & { x: number; y: number; z: number }> = [];
    for (const c of this.active.values()) {
      const i = s.enemySlot.indexOf(c.slot);
      if (tick < c.startTick || tick >= c.impactTick || i < 0 || s.enemyType[i] !== DOMINION || s.enemyIncarnation[i] !== c.incarnation) continue;
      rings.push({ ...c, x: s.enemyX[i], y: s.enemyY[i], z: s.enemyZ[i] });
    }
    return rings;
  }
}
