/** R06 follow-up §9 option 3: pincer arrivals ahead of a player retreating from the crowd. */
import { describe, expect, it } from 'vitest';
import { GridBuilder } from '../data/dungeons/build';
import type { DungeonDef } from '../data/dungeons/types';
import { BLESSED } from '../data/enemies';
import { PINCER_MAX, PINCER_MIN, PINCER_WARNING_TICKS, pincerPoint, retreatHeading } from './pincer';
import { Simulation } from './sim';
import { sealAt } from './testutil/arenas';

describe('retreat and pincer point', () => {
  it('needs 2.5 m/s over a second, away from the crowd', () => {
    expect(retreatHeading({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: -2, y: 0 })).toEqual([1, 0]);
    expect(retreatHeading({ x: 0, y: 0 }, { x: 2, y: 0 }, { x: -2, y: 0 })).toBeNull();
    // Charging into the crowd is not a retreat; nor is moving with no crowd near.
    expect(retreatHeading({ x: 0, y: 0 }, { x: 3, y: 0 }, { x: 8, y: 0 })).toBeNull();
    expect(retreatHeading({ x: 0, y: 0 }, { x: 3, y: 0 }, null)).toBeNull();
  });
  it('picks the nearest usable point 8–30 m ahead within ±45°', () => {
    const points: Array<[number, number]> = [[5, 0], [12, 0], [20, 0], [12, 14], [-15, 0], [40, 0]];
    const r = [{ x: 0.5, y: 0.5, hx: 1, hy: 0 }];
    expect(pincerPoint(points, () => true, r)).toBe(1);
    expect(pincerPoint(points, (i) => i !== 1, r)).toBe(2);
    expect(pincerPoint(points, () => true, [])).toBe(-1);
    expect([PINCER_MIN, PINCER_MAX]).toEqual([8, 30]);
  });
});

/** A 64 × 20 room, spawn points in columns 4, 20, 36 and 52 at rows 4, 10 and 16. */
function fixture(focus: 'horde' | 'ranged') {
  const g = new GridBuilder(64, 20); g.fillRect(1, 1, 62, 18, 0);
  for (const [c, r] of [[30, 10], [31, 10], [30, 11], [31, 11]]) g.marker(c, r, 'S');
  for (const c of [4, 20, 36, 52]) for (const r of [4, 10, 16]) g.marker(c, r, 'x');
  const dungeon: DungeonDef = { id: 'pincer-test', name: 'Pincer', ...g.build(), rooms: [{ id: 'nave', name: 'Nave', kind: 'combat', boss: false, shape: '2x1', band: 2, focus,
    rect: { x0: 1, y0: 1, x1: 62, y1: 18 }, leaves: [], entry: [{ socket: 0, cells: [[30, 10], [31, 10], [30, 11], [31, 11]] }],
    waves: [{ blessed: 20, choristers: 0, cherubs: 0 }, { blessed: 150, choristers: 0, cherubs: 0 }] }] };
  const sim = new Simulation({ dungeon, players: [{ id: 0, name: 'P', classId: 'fallen' }], god: true, seed: 1 });
  sealAt(sim, 38.5, 10.5); sim.killAll(); sim.rooms[0].queue.length = 0;
  const p = sim.players[0];
  for (let i = 0; i < 6; i++) sim.placeEnemy(BLESSED, 32 + (i % 3), 9 + Math.floor(i / 3), 0);
  const placed: Array<{ c: number; tick: number; px: number }> = [], warnings: Array<{ x: number; tick: number }> = [];
  const s = sim as unknown as { spawnAt: (slot: number, type: number, c: number, r: number, room: number, wave: number) => void; startWave: (room: number, wave: number) => void };
  const original = s.spawnAt.bind(sim);
  s.spawnAt = (slot, type, c, r, room, wave) => { placed.push({ c, tick: sim.tick, px: p.x }); original(slot, type, c, r, room, wave); };
  s.startWave(0, 1);
  // Backing away east at 3 m/s for two seconds, then holding still.
  for (let i = 0; i < 150; i++) {
    if (i < 60) p.x += 3 / 30;
    sim.step();
    for (const e of sim.events) if (e.event.type === 'spawnWarning' && e.event.phase === 'start') warnings.push({ x: e.event.warning.x, tick: sim.tick });
    sim.events.length = 0;
  }
  return { placed, warnings, p };
}

describe('pincer arrivals in a horde room', () => {
  it('place Blessed ahead of the retreat, inside the usual 15 m, only after a 2 s warning there', () => {
    const { placed, warnings, p } = fixture('horde');
    const ahead = placed.filter((e) => e.c === 52 && Math.abs(52.5 - e.px) < 15);
    expect(ahead.length).toBeGreaterThan(0);
    const warned = warnings.find((w) => w.x === 52.5)!;
    expect(warned).toBeDefined();
    expect(ahead[0].tick - warned.tick).toBeGreaterThanOrEqual(PINCER_WARNING_TICKS - 1);
    expect(p.x).toBeCloseTo(44.5, 5);
    // At most a third of the wave's Blessed.
    expect(placed.filter((e) => e.c === 52).length).toBeLessThanOrEqual(50);
  });
  it('never happen outside horde rooms', () => {
    const { placed } = fixture('ranged');
    expect(placed.filter((e) => e.c === 52 && Math.abs(52.5 - e.px) < 15)).toEqual([]);
    expect(placed.length).toBeGreaterThan(10);
  });
});
