import { SPAWN_WARNING_CAP, SPAWN_WARNING_TICKS, type SpawnWarning } from '../data/spawns';
import type { FloorSync, GameEvent } from '../net/messages';
import type { GameMap } from '../sim/map';
export class SpawnProjection {
  readonly active = new Map<number, SpawnWarning>();
  revision = -1;
  checkpointRevision = -1;
  private greatestId = 0;
  constructor(readonly runId: string, private readonly map?: Pick<GameMap, 'w' | 'h' | 'roomOf' | 'floor'>) {}
  private valid(w: SpawnWarning, tick: number): boolean {
    return !!w && [tick, w.id, w.startTick, w.readyTick].every(u32) && w.id > 0 &&
      Number.isInteger(w.room) && w.room >= 0 && w.room < 32 && [w.x, w.y, w.z].every(Number.isFinite) && w.x >= 0 && w.y >= 0 && w.x < 256 && w.y < 256 &&
      w.readyTick - w.startTick === SPAWN_WARNING_TICKS && w.startTick <= tick && (!this.map || w.x < this.map.w && w.y < this.map.h &&
        this.map.roomOf[Math.floor(w.y) * this.map.w + Math.floor(w.x)] === w.room && this.map.floor[Math.floor(w.y) * this.map.w + Math.floor(w.x)] === w.z);
  }
  sync(s: FloorSync): boolean {
    const list = s.spawnWarnings ?? [];
    if (s.runId !== this.runId || s.revision < this.revision || !u32(s.revision) || !u32(s.tick) || !Array.isArray(list) || list.length > SPAWN_WARNING_CAP ||
      list.some((w) => !this.valid(w, s.tick) || s.tick >= w.readyTick || this.active.has(w.id) && !same(this.active.get(w.id)!, w)) || new Set(list.map((w) => w.id)).size !== list.length) return false;
    this.revision = this.checkpointRevision = s.revision; this.active.clear(); for (const w of list) { this.active.set(w.id, { ...w }); this.greatestId = Math.max(this.greatestId, w.id); } return true;
  }
  event(e: Extract<GameEvent, { type: 'spawnWarning' }>, tick: number, revision: number): boolean {
    if (revision <= this.revision || !u32(revision) || !this.valid(e.warning, tick) || !['start', 'cancel'].includes(e.phase)) return false;
    if (e.phase === 'start') {
      if (tick !== e.warning.startTick || this.active.size >= SPAWN_WARNING_CAP || e.warning.id <= this.greatestId) return false;
      this.greatestId = e.warning.id;
      this.active.set(e.warning.id, { ...e.warning });
    } else { const w = this.active.get(e.warning.id); if (!w || !same(w, e.warning)) return false; this.active.delete(e.warning.id); }
    this.revision = revision; return true;
  }
  live(tick: number): SpawnWarning[] {
    for (const [id, w] of this.active) if (tick >= w.readyTick) this.active.delete(id);
    return [...this.active.values()].filter((w) => tick >= w.startTick);
  }
}
const u32 = (n: number) => Number.isInteger(n) && n >= 0 && n <= 0xffffffff;
const same = (a: SpawnWarning, b: SpawnWarning) => a.id === b.id && a.room === b.room && a.x === b.x && a.y === b.y && a.z === b.z && a.startTick === b.startTick && a.readyTick === b.readyTick;
