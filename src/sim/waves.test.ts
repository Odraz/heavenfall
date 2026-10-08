import { describe, expect, it } from 'vitest';
import { pearlyGates } from '../data/dungeons/pearly-gates';
import type { WaveDef } from '../data/dungeons/types';
import { PHASE_COMBAT } from '../net/protocol';
import { scaleCount, Simulation } from './sim';
import { arenaDungeon, arenaSim, EAST, MIDDLE, sealAt, WEST } from './testutil/arenas';
import { sealNow } from './testutil/sims';

const w = (blessed: number): WaveDef => ({ blessed, choristers: 0, cherubs: 0 });

/** Records the column, row and tick of every enemy placed from now on. */
function logPlacements(sim: Simulation): Array<[number, number, number]> {
  const log: Array<[number, number, number]> = [];
  const s = sim as unknown as { spawnAt: (slot: number, type: number, c: number, r: number, arena: number, wave: number) => void };
  const orig = s.spawnAt.bind(sim);
  s.spawnAt = (slot, type, c, r, arena, wave) => {
    log.push([c, r, sim.tick]);
    orig(slot, type, c, r, arena, wave);
  };
  return log;
}

const columns = (log: Array<[number, number, number]>) => new Set(log.map(([c]) => c));

describe('the waves (M12 §2.1)', () => {
  it("are the Pearly Gates' new waves", () => {
    const totals = pearlyGates.arenas.map((a) => a.waves.map((v) => [v.blessed, v.choristers, v.cherubs]));
    expect(totals.slice(0, 3)).toEqual([
      [[150, 0, 0], [200, 0, 0], [250, 0, 0], [300, 0, 0]],
      [[200, 0, 10], [250, 0, 15], [300, 0, 15], [350, 0, 20]],
      [[250, 10, 10], [300, 15, 15], [350, 15, 15], [400, 20, 15], [450, 20, 20]],
    ]);
    const sum = (ws: number[][]) => ws.flat().reduce((a, b) => a + b, 0);
    expect(totals.slice(0, 3).map(sum)).toEqual([900, 1160, 1905]);
  });

  it('are scaled per party size, per type, rounding up', () => {
    for (const players of [1, 2, 3, 4]) {
      const sim = new Simulation({
        dungeon: pearlyGates,
        players: Array.from({ length: players }, (_, id) => ({ id, name: `P${id}`, classId: 'binder' as const })),
        seed: 1,
        god: true,
      });
      const [c, r] = pearlyGates.arenas[0].entryCells[0];
      sim.players[0].x = c + 0.5;
      sim.players[0].y = r + 0.5;
      sim.players[0].z = sim.map.floor[r * sim.map.w + c];
      sim.step();
      sealNow(sim);
      expect(sim.arenas[0].phase).toBe(PHASE_COMBAT);
      const expected = pearlyGates.arenas[0].waves.reduce((n, v) => n + scaleCount(v.blessed, players), 0);
      expect(sim.enemiesRemaining()).toBe(expected);
    }
  });
});

describe('a wave arrives from all sides, over 10 s (M12 §2.2)', () => {
  it('is placed only on spawn points more than 15 m from every living player', () => {
    const sim = arenaSim([w(60), w(60)], { god: true });
    const log = logPlacements(sim);
    sealAt(sim, 8.5, 5.5);
    for (let i = 0; i < 90; i++) sim.step();
    expect(log.length).toBeGreaterThan(10);
    // The west column is within 8 m, the middle one within 15 m.
    expect(columns(log)).toEqual(new Set([EAST]));
  });

  it('falls back to the 8 m rule when no point is more than 15 m away, checked every tick', () => {
    const sim = arenaSim([w(60), w(60)], { god: true });
    const log = logPlacements(sim);
    sealAt(sim, 8.5, 5.5);
    for (let i = 0; i < 30; i++) sim.step();
    // The party moves to the middle: every point is within 15 m, and the middle column within 8 m.
    for (const p of sim.players) p.x = 19.5;
    log.length = 0;
    for (let i = 0; i < 60; i++) sim.step();
    expect(log.length).toBeGreaterThan(5);
    expect(columns(log)).toEqual(new Set([WEST, EAST]));
  });

  it('places a 250 wave at an even pace, fully at 10 s and not before, no point more than 10 per second', () => {
    const sim = arenaSim([w(250), w(250)], { god: true });
    const log = logPlacements(sim);
    sealAt(sim, 8.5, 5.5);
    const sealed = sim.tick;
    const st = sim.arenas[0];
    // The seal's own tick placed nothing yet (250/300 of a placement).
    expect(log.length).toBe(0);
    while (sim.tick < sealed + 298) sim.step();
    expect(st.waveFullySpawned[0]).toBe(false);
    sim.step();
    // 300 ticks of 250/300 placements, counting the seal's.
    expect(st.waveFullySpawned[0]).toBe(true);
    expect(sim.tick - sealed).toBe(299);
    expect(log.length).toBe(250);
    // Even: 25 per second, give or take one.
    for (let s = 0; s < 9; s++) {
      const n = log.filter(([, , t]) => t > sealed + s * 30 && t <= sealed + (s + 1) * 30).length;
      expect(Math.abs(n - 25)).toBeLessThanOrEqual(1);
    }
    // No point more than 10 in any second.
    for (let t = sealed - 30; t <= sim.tick; t++) {
      const perPoint = new Map<string, number>();
      for (const [c, r, at] of log) if (at > t && at <= t + 30) perPoint.set(`${c},${r}`, (perPoint.get(`${c},${r}`) ?? 0) + 1);
      expect(Math.max(0, ...perPoint.values())).toBeLessThanOrEqual(10);
    }
  });

  it('a single-wave arena, the boss arena and its summons keep the 8 m rule and the old rate', () => {
    for (const boss of [false, true]) {
      const sim = arenaSim([w(60)], { god: true, boss });
      const log = logPlacements(sim);
      sealAt(sim, 8.5, 5.5);
      // As fast as the 6 points allow, 10 per second each: all 60 within 1 s.
      for (let i = 0; i < 30; i++) sim.step();
      expect(log.length).toBe(60);
      expect(columns(log)).toEqual(new Set([MIDDLE, EAST]));
      if (boss) {
        sim.killAll();
        log.length = 0;
        sim.arenas[0].queue.push({ counts: [20, 0, 0], spawned: [0, 0, 0], wave: -1 });
        // Not paced either: all 20 within 1 s (at 10 per second from each of 6 points, 20 take 10 ticks).
        for (let i = 0; i < 10; i++) sim.step();
        expect(log.length).toBe(20);
        expect(columns(log)).toEqual(new Set([MIDDLE, EAST]));
      }
    }
  });

  it('the benchmark keeps the 8 m rule and the old rate', () => {
    const sim = new Simulation({ dungeon: arenaDungeon([w(60), w(60)]), players: [{ id: 0, name: 'B', classId: 'fallen' }], seed: 1, benchArena: 0 });
    const log = logPlacements(sim);
    for (let i = 0; i < 30; i++) sim.step();
    expect(sim.arenas[0].director).toBeNull();
    expect(log.length).toBe(60);
    expect(columns(log)).toEqual(new Set([MIDDLE, EAST]));
  });
});
