import { expect, it } from 'vitest';
import { Simulation } from './sim';
import { GridBuilder } from '../data/dungeons/build';
import type { DungeonDef } from '../data/dungeons/types';
import { sealAt } from './testutil/arenas';
import { MAX_LIVING_ENEMIES } from './constants';

function fixture(total: number) {
  const g = new GridBuilder(64, 64); g.fillRect(1, 1, 62, 62, 0);
  for (const [c, r] of [[30, 30], [31, 30], [30, 31], [31, 31]]) g.marker(c, r, 'S');
  for (const c of [3, 18, 45, 60]) for (const r of [3, 18, 45, 60]) g.marker(c, r, 'x');
  const dungeon: DungeonDef = { id: 'crest-test', name: 'Crest', ...g.build(), rooms: [{ id: 'crest', name: 'Crest', kind: 'combat', boss: false, shape: '2x2', band: 2,
    rect: { x0: 1, y0: 1, x1: 62, y1: 62 }, leaves: [], entry: [{ socket: 0, cells: [[30, 30], [31, 30], [30, 31], [31, 31]] }],
    waves: [{ blessed: 500, choristers: 0, cherubs: 0 }, { blessed: total, choristers: 0, cherubs: 0 }] }] };
  const sim = new Simulation({ dungeon, players: ['fallen', 'heretic', 'binder', 'betrayer'].map((classId, id) => ({ classId: classId as 'fallen', id, name: `P${id}` })), god: true, seed: 1 });
  sealAt(sim, 30.5, 30.5); sim.killAll(); sim.rooms[0].queue.length = 0;
  const placements: number[] = [], points: string[] = [];
  const s = sim as unknown as { spawnAt: (slot: number, type: number, c: number, r: number, room: number, wave: number) => void; startWave: (room: number, wave: number) => void };
  const original = s.spawnAt.bind(sim);
  s.spawnAt = (slot, type, c, r, room, wave) => { placements.push(sim.tick); points.push(`${c}:${r}`); original(slot, type, c, r, room, wave); };
  s.startWave(0, 1); return { sim, placements, points };
}
it('places a pure Blessed crest over six seconds at no more than 20 per second per point, without hidden refills', () => {
  const { sim, placements, points } = fixture(1200); const start = sim.tick;
  expect(sim.rooms[0].director!.cap).toBe(1350); expect(sim.rooms[0].paceRate).toBeCloseTo(1200 / 180);
  for (let i = 0; i < 179; i++) sim.step();
  expect(sim.rooms[0].waveFullySpawned[1]).toBe(false); sim.step();
  expect(sim.rooms[0].waveFullySpawned[1]).toBe(true); expect(placements).toHaveLength(1200);
  expect(sim.activeCount).toBe(1200); expect(Math.max(...placements) - start).toBe(180);
  for (let t = start; t <= start + 180; t++) {
    const counts = new Map<string, number>();
    placements.forEach((tick, i) => { if (tick > t && tick <= t + 30) counts.set(points[i], (counts.get(points[i]) ?? 0) + 1); });
    expect(Math.max(0, ...counts.values())).toBeLessThanOrEqual(20);
  }
  for (let i = 0; i < 30; i++) sim.step(); expect(placements).toHaveLength(1200);
});
it('preserves the global living cap and keeps excess crest placements queued', () => {
  const { sim } = fixture(2000);
  expect(sim.rooms[0].director!.cap).toBe(MAX_LIVING_ENEMIES);
  for (let i = 0; i < 210; i++) sim.step();
  expect(sim.activeCount).toBe(MAX_LIVING_ENEMIES);
  expect(sim.rooms[0].waveFullySpawned[1]).toBe(false); expect(sim.rooms[0].queue).toHaveLength(1);
});
