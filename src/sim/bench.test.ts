import { describe, expect, it } from 'vitest';
import { GATEKEEPER } from '../data/enemies';
import { getDungeon } from '../data/dungeons/index';
import { PHASE_COMBAT, PHASE_IDLE } from '../net/protocol';
import { MAX_LIVING_ENEMIES } from './constants';
import { Simulation } from './sim';

describe('benchmark arena (M10 gate §4)', () => {
  it('starts the boss arena on the first tick and tops it up to 1 500 living enemies', () => {
    const dungeon = getDungeon('pearly-gates')!;
    const boss = dungeon.arenas.findIndex((a) => a.boss);
    const sim = new Simulation({ dungeon, players: [{ id: 0, name: 'Bench', classId: 'betrayer' }], seed: 1, benchArena: boss });
    const p = sim.players[0];
    const [ec, er] = dungeon.arenas[boss].entryCells[0];
    expect([Math.floor(p.x), Math.floor(p.y)]).toEqual([ec, er]);

    sim.step();
    expect(sim.arenas[boss].phase).toBe(PHASE_COMBAT);
    // The earlier arenas weren't cleared, and stay idle.
    for (let i = 0; i < boss; i++) expect(sim.arenas[i].phase).toBe(PHASE_IDLE);
    expect(sim.bossSlot).toBeGreaterThanOrEqual(0);
    expect(sim.eType[sim.bossSlot]).toBe(GATEKEEPER);
    expect([Math.floor(sim.eX[sim.bossSlot]), Math.floor(sim.eY[sim.bossSlot])]).toEqual(sim.map.boss);
    expect([Math.floor(p.x), Math.floor(p.y)]).toEqual([ec, er]);

    // The Gatekeeper counts toward the 1 500.
    let n = 0;
    for (let t = 0; t < 3000 && n < MAX_LIVING_ENEMIES; t++) {
      sim.step();
      n = sim.living + (sim.bossSlot >= 0 ? 1 : 0);
    }
    expect(n).toBe(MAX_LIVING_ENEMIES);
    expect(p.dead).toBe(false);
  });

  it('benches arena 0 by default', () => {
    const dungeon = getDungeon('pearly-gates')!;
    const sim = new Simulation({ dungeon, players: [{ id: 0, name: 'Bench', classId: 'betrayer' }], seed: 1, benchArena: 0 });
    sim.step();
    expect(sim.arenas[0].phase).toBe(PHASE_COMBAT);
    expect(sim.bossSlot).toBe(-1);
  });
});
