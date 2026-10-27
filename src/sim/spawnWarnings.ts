import { SPAWN_WARNING_CAP, SPAWN_WARNING_TICKS, type SpawnWarning } from '../data/spawns';
interface Entry { warning: SpawnWarning; touched: number; readyUsed: boolean }
export class SpawnWarnings {
  private readonly points = new Map<string, Entry>();
  private nextId = 1;
  exhausted = 0;
  constructor(private readonly emit: (phase: 'start' | 'cancel', warning: SpawnWarning) => void) {}
  /** `ticks`: how long the warning shows before the point is ready (a pincer arrival's is longer). */
  permit(room: number, x: number, y: number, z: number, tick: number, firstReady?: () => void, context = 'spawn', ticks = SPAWN_WARNING_TICKS): boolean {
    const key = `${context}:${room}:${x}:${y}`;
    let e = this.points.get(key);
    if (!e) {
      if (this.points.size >= SPAWN_WARNING_CAP || this.nextId > 0xffffffff || tick + ticks > 0xffffffff) { this.exhausted++; return false; }
      e = { warning: { id: this.nextId++, room, x, y, z, startTick: tick, readyTick: tick + ticks }, touched: tick, readyUsed: false };
      this.points.set(key, e); this.emit('start', { ...e.warning });
    }
    e.touched = tick;
    if (tick < e.warning.readyTick) return false;
    if (!e.readyUsed) { e.readyUsed = true; firstReady?.(); }
    return true;
  }
  cancel(room: number, x: number, y: number, context = 'spawn'): void {
    const key = `${context}:${room}:${x}:${y}`, e = this.points.get(key);
    if (e) { this.points.delete(key); this.emit('cancel', { ...e.warning }); }
  }
  update(tick: number, room: number | ((room: number) => boolean), safe: (w: SpawnWarning) => boolean): void {
    for (const [key, e] of this.points) if (!(typeof room === 'number' ? e.warning.room === room : room(e.warning.room)) || !safe(e.warning) || tick - e.touched > SPAWN_WARNING_TICKS) {
      this.points.delete(key); this.emit('cancel', { ...e.warning });
    }
  }
  checkpoint(tick: number): SpawnWarning[] { return [...this.points.values()].filter((e) => tick < e.warning.readyTick).map((e) => ({ ...e.warning })); }
}
