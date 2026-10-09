import { describe, expect, it } from 'vitest';
import { BLESSED, GATEKEEPER } from '../data/enemies';
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

  it('benchBurst: every 0.5 s, 40 damage credited to player 0 bursts the 20 Blessed nearest a point 8 m ahead of it (M12 §10)', () => {
    const dungeon = getDungeon('sandbox')!;
    const sim = new Simulation({ dungeon, players: [{ id: 0, name: 'Bench', classId: 'betrayer' }], seed: 1, benchArena: 0, benchBurst: true });
    const p = sim.players[0];
    for (let t = 0; t < 600 && sim.living < 200; t++) sim.step();
    sim.events.length = 0;
    // Steps to just before the next 0.5 s mark.
    while ((sim.tick + 1) % 15 !== 0) sim.step();
    const ax = p.x + Math.cos(p.yaw) * 8;
    const ay = p.y + Math.sin(p.yaw) * 8;
    const kills = p.kills;
    sim.step();
    const bursts = sim.events.flatMap((e) => (e.event.type === 'bursts' ? [e.event.list] : []));
    expect(bursts.length).toBe(1);
    expect(p.kills - kills).toBe(20);
    const slots = bursts[0].filter((_, i) => i % 3 === 0);
    expect(slots.length).toBe(20);
    expect(slots.every((s) => sim.eType[s] === BLESSED)).toBe(true);
    // Light bursts (force 40 = 2 × 20), all credited to player 0.
    expect(bursts[0].filter((_, i) => i % 3 === 1).every((a) => a < 360)).toBe(true);
    expect(bursts[0].filter((_, i) => i % 3 === 2).every((id) => id === 0)).toBe(true);
    // The Blessed left alive are no nearer the point than those that burst (1 m of margin: they moved
    // during the tick).
    const far = Math.max(...slots.map((s) => Math.hypot(sim.eX[s] - ax, sim.eY[s] - ay)));
    for (let k = 0; k < sim.activeCount; k++) {
      const s = sim.active[k];
      if (sim.eType[s] === BLESSED) expect(Math.hypot(sim.eX[s] - ax, sim.eY[s] - ay)).toBeGreaterThan(far - 1);
    }
  });
});
