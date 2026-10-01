import { describe, expect, it } from 'vitest';
import { sandbox } from '../data/dungeons/sandbox';
import { BLESSED, ENEMIES } from '../data/enemies';
import { Simulation } from './sim';

describe('separation', () => {
  it("pushes from the crowd behind don't make enemies faster than they walk", () => {
    const sim = new Simulation({ dungeon: sandbox, players: [{ id: 0, name: 'A', classId: 'fallen' }], seed: 1, god: true, noWaves: true });
    const p = sim.players[0];
    p.x = 44.5;
    p.y = 44.5;
    sim.refreshFields();
    // 300 Blessed packed into the arena's north-west corner, all chasing the player.
    for (let i = 0; i < 300; i++) sim.placeEnemy(BLESSED, 17 + (i % 6), 3 + (Math.floor(i / 6) % 6), -1);
    const slots = Array.from(sim.active.slice(0, sim.activeCount));
    const step = ENEMIES[BLESSED].speed / 30;
    let prev = slots.map((s) => [sim.eX[s], sim.eY[s]]);
    let maxStep = 0;
    for (let t = 0; t < 90; t++) {
      sim.step();
      const now = slots.map((s) => [sim.eX[s], sim.eY[s]]);
      now.forEach(([x, y], i) => (maxStep = Math.max(maxStep, Math.hypot(x - prev[i][0], y - prev[i][1]))));
      prev = now;
    }
    expect(maxStep).toBeLessThanOrEqual(step + 1e-9);
  });

  it('still pushes overlapping enemies apart', () => {
    const sim = new Simulation({ dungeon: sandbox, players: [{ id: 0, name: 'A', classId: 'fallen' }], seed: 1, god: true, noWaves: true });
    // The player is in the start room; with the door open the enemies walk off, so check right away.
    sim.refreshFields();
    const a = sim.placeEnemy(BLESSED, 30, 30, -1);
    const b = sim.placeEnemy(BLESSED, 30, 30, -1);
    sim.step();
    expect(Math.hypot(sim.eX[a] - sim.eX[b], sim.eY[a] - sim.eY[b])).toBeGreaterThan(0.1);
  });
});
