import { validCommanderCasts, type CommanderCast } from '../data/commanders';
import { CANTOR, CARRIER } from '../data/enemies';
import type { FloorSync } from '../net/messages';
import type { Snapshot } from '../net/protocol';

/** Full authoritative replacement, ordered by tick/revision and isolated by run/incarnation. */
export class CommanderProjection {
  readonly active = new Map<number, CommanderCast>();
  private tick = -1;
  private revision = -1;
  constructor(private readonly runId: string) {}
  sync(s: FloorSync | Snapshot): boolean {
    const revision = 'revision' in s ? s.revision : s.stateRevision, casts = s.commanderCasts ?? [];
    if (s.runId !== this.runId || s.tick < this.tick || revision < this.revision || !Number.isInteger(revision) || revision > 0xffffffff || !validCommanderCasts(casts, s.tick)) return false;
    if ('enemyCount' in s && (s.enemyCount !== s.totalEnemyCount || casts.length !== (s.totalCommanderCasts ?? 0) || casts.some((c) => {
      const i = s.enemySlot.indexOf(c.slot);
      return i < 0 || s.enemyIncarnation[i] !== c.incarnation || s.enemyType[i] !== (c.kind === 'beam' ? CANTOR : CARRIER);
    }))) return false;
    this.tick = s.tick; this.revision = revision; this.active.clear();
    for (const c of casts) this.active.set(c.slot, { ...c });
    return true;
  }
  live(s: Snapshot | null, tick: number): CommanderCast[] {
    if (!s) return [];
    return [...this.active.values()].filter((c) => {
      const i = s.enemySlot.indexOf(c.slot);
      return i >= 0 && s.enemyIncarnation[i] === c.incarnation && tick >= c.phaseTick && (c.phase === 'idle' || tick < c.endTick);
    });
  }
}
