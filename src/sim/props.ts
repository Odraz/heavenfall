/** Finite floor props, attack cylinders and stable delayed blast order (game.md §4.9). */
import { PROP_HEIGHT, PROP_RADIUS, PROP_RECHARGE_TICKS, type PropDef } from '../data/props';
import { rayCylinder } from './combat';
import { distToCylinder } from './movement';
import { lineOfSight } from './los';
import type { GameMap } from './map';

export interface Prop extends PropDef { z: number; broken: boolean; blastTick: number; readyTick: number; }
export class Props {
  readonly all: readonly Prop[];
  private readonly byId: Map<number, Prop>;
  readonly byRoom: readonly Prop[][];
  constructor(readonly map: GameMap, defs: readonly PropDef[], private broken: (p: Prop, origin: 'player' | 'world') => void) {
    if (defs.length > 2048 || new Set(defs.map((p) => p.id)).size !== defs.length) throw new Error('invalid prop pool');
    this.all = defs.map((p) => {
      const c = Math.floor(p.x), r = Math.floor(p.y), i = r * map.w + c;
      if (!Number.isInteger(p.id) || p.id <= 0 || p.id > 0xffffffff || !Number.isInteger(p.variant) || p.variant < 0 || p.variant > 2 ||
        !Object.hasOwn(PROP_HEIGHT, p.family) || c < 0 || r < 0 || c >= map.w || r >= map.h || map.wall[i] || map.roomOf[i] !== p.room) throw new Error('invalid prop body');
      return { ...p, z: map.floor[i], broken: false, blastTick: -1, readyTick: -1 };
    }).sort((a, b) => a.id - b.id);
    this.byId = new Map(this.all.map((p) => [p.id, p]));
    this.byRoom = map.rooms.map((_r, i) => this.all.filter((p) => p.room === i));
  }
  get(id: number): Prop | undefined { return this.byId.get(id); }
  blocksSpawn(room: number, x: number, y: number, z: number, radius: number, height: number): boolean {
    return this.byRoom[room]?.some((p) => !p.broken && z < p.z + PROP_HEIGHT[p.family] && z + height > p.z && (p.x - x) ** 2 + (p.y - y) ** 2 < (PROP_RADIUS + radius) ** 2) ?? false;
  }
  break(id: number, tick: number, origin: 'player' | 'world' = 'player'): boolean {
    const p = this.byId.get(id);
    if (!p || p.broken || (origin === 'world' && p.family === 'blessing')) return false;
    p.broken = true;
    if (p.family !== 'loot') p.readyTick = tick + PROP_RECHARGE_TICKS;
    if (p.family === 'blast') p.blastTick = tick + 6;
    this.broken(p, origin);
    return true;
  }
  /** Rays use the same cylinder query as enemies; props never change movement collision. */
  ray(x: number, y: number, z: number, dx: number, dy: number, dz: number, stop: number, radius = 0): Array<{ prop: Prop; distance: number }> {
    const hits: Array<{ prop: Prop; distance: number }> = [];
    for (const p of this.all) {
      if (p.broken) continue;
      if (Math.abs(p.x - x) > stop + PROP_RADIUS + radius || Math.abs(p.y - y) > stop + PROP_RADIUS + radius) continue;
      const distance = rayCylinder(x, y, z, dx, dy, dz, p.x, p.y, p.z - radius, PROP_RADIUS + radius, PROP_HEIGHT[p.family] + 2 * radius);
      if (distance <= stop) hits.push({ prop: p, distance });
    }
    return hits.sort((a, b) => a.distance - b.distance || a.prop.id - b.prop.id);
  }
  inArea(p: Prop, x: number, y: number, z: number, radius: number): boolean {
    return distToCylinder(x, y, z, p.x, p.y, p.z, PROP_RADIUS, PROP_HEIGHT[p.family]) <= radius + 1e-9 &&
      lineOfSight(this.map, x, y, z, p.x, p.y, p.z + PROP_HEIGHT[p.family] / 2);
  }
  area(x: number, y: number, z: number, radius: number, tick: number, origin: 'player' | 'world' = 'player', accepts: (p: Prop) => boolean = () => true): void {
    for (const p of this.all) if (!p.broken && accepts(p) && this.inArea(p, x, y, z, radius)) this.break(p.id, tick, origin);
  }
  /** Mark terminal before callback: damage may break another lamp, but never explode it early. */
  update(tick: number, explode: (p: Prop) => void, recharge: (p: Prop) => void = () => {}): void {
    for (const p of this.all) if (p.blastTick >= 0 && tick >= p.blastTick) {
      p.blastTick = -1; explode(p);
    }
    for (const p of this.all) if (p.readyTick >= 0 && tick >= p.readyTick) {
      p.readyTick = -1; p.broken = false; recharge(p);
    }
  }
  checkpoint(): { brokenProps: number[]; propBlasts: Array<{ id: number; impactTick: number }>; propRecharges: Array<{ id: number; readyTick: number }> } {
    return { brokenProps: this.all.filter((p) => p.broken).map((p) => p.id),
      propBlasts: this.all.filter((p) => p.blastTick >= 0).map((p) => ({ id: p.id, impactTick: p.blastTick })),
      propRecharges: this.all.filter((p) => p.readyTick >= 0).map((p) => ({ id: p.id, readyTick: p.readyTick })) };
  }
}
