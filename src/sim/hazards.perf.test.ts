import { describe, expect, it } from 'vitest';
import { BLESSED, CHORISTER } from '../data/enemies';
import { PHASE_COMBAT } from '../net/protocol';
import { Simulation } from './sim';
import { dungeonOf } from './testutil/maps';
import { room } from './testutil/sims';

describe.skipIf(!!process.env.CI)('hazard navigation performance', () => {
  it('retains the 8 ms/tick limit with 1500 living enemies, four dry fields and full snapshot encoding', () => {
    const dungeon = dungeonOf(room(68, 68));
    dungeon.rooms = [{ id: 'pressure', name: 'Pressure', kind: 'combat', shape: '2x2', band: 2,
      rect: { x0: 1, y0: 1, x1: 68, y1: 68 }, leaves: [], entry: [{ socket: 0, cells: [[36, 10], [36, 20], [36, 30], [36, 40]] }],
      waves: [{ blessed: 1000, choristers: 0, cherubs: 0 }], boss: false,
      hazards: [{ hazard: 'refiners-fire', rect: { x0: 34, y0: 1, x1: 37, y1: 60 } }] }];
    const sim = new Simulation({ dungeon, players: Array.from({ length: 4 }, (_, id) => ({ id, name: `P${id}`, classId: 'betrayer' as const })), seed: 1, god: true, noWaves: true });
    sim.activeRoom = 0; sim.rooms[0].phase = PHASE_COMBAT;
    for (const p of sim.players) { const [x, y] = dungeon.rooms[0].entry[0].cells[p.id]; p.x = x + 0.5; p.y = y + 0.5; p.z = 0; }
    for (let i = 0; i < 1500; i++) {
      const s = sim.placeEnemy(i < 1476 ? BLESSED : CHORISTER, 5 + (i % 7) * 9, 4 + (Math.floor(i / 7) % 7) * 9, 0);
      expect(s).toBeGreaterThanOrEqual(0); sim.eHp[s] = 1_000_000; // Hold the maximum workload through all measured ticks.
    }
    sim.refreshFields(); expect(sim.dryNavigation.fields.filter(Boolean)).toHaveLength(4);
    const start = performance.now();
    for (let tick = 0; tick < 300; tick++) { sim.step(); for (const p of sim.players) sim.encodeFor(p.id); }
    const average = (performance.now() - start) / 300;
    console.log(`hazard simulation: ${average.toFixed(3)} ms/tick, ${sim.dryNavigation.fields.filter(Boolean).length} dry fields`);
    expect(sim.activeCount).toBe(1500); expect(sim.dryNavigation.builds).toBe(1); expect(average).toBeLessThanOrEqual(8);
  });
});
