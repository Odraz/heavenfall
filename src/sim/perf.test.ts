import { describe, expect, it } from 'vitest';
import { sandbox } from '../data/dungeons/sandbox';
import { BLESSED } from '../data/enemies';
import { Simulation } from './sim';

describe.skipIf(!!process.env.CI)('simulation performance', () => {
  it('averages 8 ms or less per tick with 1 500 Blessed and 4 players (§13.1)', () => {
    const sim = new Simulation({
      dungeon: sandbox,
      players: [
        { id: 0, name: 'A', classId: 'fallen' },
        { id: 1, name: 'B', classId: 'heretic' },
        { id: 2, name: 'C', classId: 'binder' },
        { id: 3, name: 'D', classId: 'betrayer' },
      ],
      seed: 1,
      god: true,
      noWaves: true,
    });
    // The 4 players stand on the arena's entry cells.
    const arena = sim.map.arenas[0];
    for (const p of sim.players) {
      const [c, r] = arena.entryCells[p.index];
      p.x = c + 0.5;
      p.y = r + 0.5;
      p.z = sim.map.floor[r * sim.map.w + c];
    }
    // 1 500 Blessed on the spawn points at tick 0.
    const points = sim.map.arenaSpawnPoints[0];
    for (let i = 0; i < 1500; i++) {
      const [c, r] = points[i % points.length];
      expect(sim.placeEnemy(BLESSED, c, r, 0)).toBeGreaterThanOrEqual(0);
    }

    const ticks = 300;
    const t0 = performance.now();
    let bytes = 0;
    for (let i = 0; i < ticks; i++) {
      sim.step();
      for (const p of sim.players) for (const part of sim.encodeFor(p.id)) bytes += part.byteLength;
    }
    const avg = (performance.now() - t0) / ticks;
    console.log(`simulation: ${avg.toFixed(3)} ms per tick on average (${sim.living} Blessed, ${(bytes / ticks / 4).toFixed(0)} bytes per snapshot)`);
    expect(sim.living).toBe(1500);
    expect(avg).toBeLessThanOrEqual(8);
  });
});
