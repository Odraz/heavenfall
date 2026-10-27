import { validWatchmanAims, type WatchmanAim } from '../data/watchman';
import { WATCHMAN } from '../data/enemies';
import type { FloorSync } from '../net/messages';
import type { Snapshot } from '../net/protocol';

/**
 * The host's Watchman aim records (rogue rooms.md §6.4): full replacement, ordered by tick/revision,
 * isolated by run and incarnation. `takeShots` reports each shot once, by its wrapping counter.
 */
export class WatchmanProjection {
  readonly active = new Map<number, WatchmanAim>();
  private tick = -1;
  private revision = -1;
  /** The last shot counter seen per slot, with the incarnation it belongs to. */
  private readonly seen = new Map<number, { incarnation: number; shot: number }>();
  constructor(private readonly runId: string) {}

  sync(s: FloorSync | Snapshot): boolean {
    const revision = 'revision' in s ? s.revision : s.stateRevision, aims = s.watchmanAims ?? [];
    if (s.runId !== this.runId || s.tick < this.tick || revision < this.revision || !Number.isInteger(revision) || revision > 0xffffffff || !validWatchmanAims(aims, s.tick)) return false;
    if ('enemyCount' in s && (s.enemyCount !== s.totalEnemyCount || aims.length !== (s.totalWatchmanAims ?? 0) || aims.some((a) => {
      const i = s.enemySlot.indexOf(a.slot);
      return i < 0 || s.enemyIncarnation[i] !== a.incarnation || s.enemyType[i] !== WATCHMAN;
    }))) return false;
    this.tick = s.tick; this.revision = revision; this.active.clear();
    for (const a of aims) this.active.set(a.slot, { ...a });
    return true;
  }

  /**
   * Records whose Watchman is still drawn: aims until their fire tick (a rejoin resumes the remaining
   * thread from `fireTick`), fired records for 0.5 s after it.
   */
  live(s: Snapshot | null, tick: number): WatchmanAim[] {
    if (!s) return [];
    return [...this.active.values()].filter((a) => {
      const i = s.enemySlot.indexOf(a.slot);
      return i >= 0 && s.enemyIncarnation[i] === a.incarnation && (a.phase === 'aim' ? tick < a.fireTick : tick - a.fireTick < 15);
    });
  }

  /**
   * The fired records whose shot counter hasn't been played yet; marks them played. A record first
   * seen while aiming only remembers its counter, so the following shot plays exactly once.
   */
  takeShots(aims: readonly WatchmanAim[]): WatchmanAim[] {
    const out: WatchmanAim[] = [];
    for (const a of aims) {
      const last = this.seen.get(a.slot);
      const known = last?.incarnation === a.incarnation;
      if (a.phase === 'fired' && (!known || last.shot !== a.shot)) out.push(a);
      this.seen.set(a.slot, { incarnation: a.incarnation, shot: a.shot });
    }
    return out;
  }
}
