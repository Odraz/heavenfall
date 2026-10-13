/** Accepted cast projection; rendering/bots share these deadlines and matched incarnations. */
import { DOMINION_CAST_CAP, type DominionCast } from '../data/dominion';
import { DOMINION, ST_WINDUP } from '../data/enemies';
import type { FloorSync, GameEvent } from '../net/messages';
import { validCasts, type Snapshot } from '../net/protocol';

export class DominionProjection {
  readonly active = new Map<number, DominionCast>();
  private revision = -1;
  private tick = -1;
  private cueRevision = -1;
  private checkpointRevision = -1;
  private readonly known = new Map<number, { cast: DominionCast; phases: number }>();
  constructor(readonly runId: string) {}
  private replace(casts: readonly DominionCast[], tick: number, revision: number): boolean {
    if (!Number.isInteger(revision) || revision < 0 || revision > 0xffffffff || revision < this.revision || tick < this.tick || !validCasts(casts, tick) ||
      casts.some((c) => this.known.has(c.castId) && !sameCast(this.known.get(c.castId)!.cast, c))) return false;
    for (const c of this.active.values()) this.remember(c);
    this.revision = revision; this.tick = tick; this.active.clear();
    for (const cast of casts) { this.active.set(cast.slot, { ...cast }); this.remember(cast); }
    return true;
  }
  sync(s: FloorSync): boolean {
    if (s.runId !== this.runId) return false;
    if (!this.replace(s.dominionCasts ?? [], s.tick, s.revision)) return false;
    this.checkpointRevision = Math.max(this.checkpointRevision, s.revision);
    this.cueRevision = Math.max(this.cueRevision, s.revision);
    this.known.clear(); for (const c of this.active.values()) this.remember(c);
    return true;
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
    if (!Number.isInteger(revision) || revision <= this.cueRevision || revision <= this.checkpointRevision || revision > 0xffffffff || !Number.isInteger(tick) || tick < 0 || tick > 0xffffffff || tick < e.cast?.startTick || this.tick - tick > 15 ||
      ![e.x, e.y, e.z].every(Number.isFinite) || !validCasts([e.cast], e.cast?.startTick) || !['start', 'strike', 'cancel'].includes(e.phase)) return false;
    if (e.phase === 'start' && (tick !== e.cast.startTick || !validCasts([e.cast], tick))) return false;
    if (e.phase === 'strike' && tick < e.cast.impactTick) return false;
    const current = this.active.get(e.cast.slot), memory = this.known.get(e.cast.castId);
    const bit = e.phase === 'start' ? 1 : e.phase === 'strike' ? 2 : 4;
    if (memory && (!sameCast(memory.cast, e.cast) || memory.phases & bit || memory.phases & 6)) return false;
    if (e.phase === 'start') {
      if ((!current && this.active.size >= DOMINION_CAST_CAP) || current && !sameCast(current, e.cast) && current.castId >= e.cast.castId ||
        revision <= this.revision && (!current || !sameCast(current, e.cast)) || e.cast.impactTick <= this.tick) return false;
    } else if (!memory || current && !sameCast(current, e.cast)) return false;
    this.cueRevision = revision;
    this.remember(e.cast).phases |= bit;
    // A newer snapshot may already have applied this state. Its reliable cue still plays once.
    if (revision > this.revision && tick >= this.tick) {
      this.revision = revision; this.tick = tick;
      if (e.phase === 'start') this.active.set(e.cast.slot, { ...e.cast });
      else this.active.delete(e.cast.slot);
    }
    return true;
  }
  private remember(c: DominionCast): { cast: DominionCast; phases: number } {
    let entry = this.known.get(c.castId);
    if (!entry) { entry = { cast: { ...c }, phases: 0 }; this.known.set(c.castId, entry); }
    while (this.known.size > 2 * DOMINION_CAST_CAP) this.known.delete(this.known.keys().next().value!);
    return entry;
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
function sameCast(a: DominionCast, b: DominionCast): boolean {
  return a.slot === b.slot && a.incarnation === b.incarnation && a.castId === b.castId && a.room === b.room && a.startTick === b.startTick && a.impactTick === b.impactTick;
}
