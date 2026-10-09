import { describe, expect, it } from 'vitest';
import { pearlyGates } from '../data/dungeons/pearly-gates';
import type { WaveDef } from '../data/dungeons/types';
import { BLESSED, CHERUB, CHORISTER } from '../data/enemies';
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
      // With Arena 1's Cherub squads (M12 follow-up §4.2).
      const expected = pearlyGates.arenas[0].waves.reduce((n, v) => n + scaleCount(v.blessed, players) + scaleCount(v.squad?.count ?? 0, players), 0);
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

describe('squads (M12 follow-up §4.2)', () => {
  /** Records the type, column, row and tick of every enemy placed from now on. */
  function logTypes(sim: Simulation): Array<{ type: number; c: number; r: number; tick: number }> {
    const log: Array<{ type: number; c: number; r: number; tick: number }> = [];
    const s = sim as unknown as { spawnAt: (slot: number, type: number, c: number, r: number, arena: number, wave: number) => void };
    const orig = s.spawnAt.bind(sim);
    s.spawnAt = (slot, type, c, r, arena, wave) => {
      log.push({ type, c, r, tick: sim.tick });
      orig(slot, type, c, r, arena, wave);
    };
    return log;
  }

  it("are Arena 1's Cherubs over the terrace and Arena 2's Choristers on the walkways, in waves 3 and 4", () => {
    const squads = pearlyGates.arenas.slice(0, 3).map((a) => a.waves.map((v) => (v.squad ? [v.squad.type, v.squad.count] : null)));
    expect(squads).toEqual([
      [null, null, ['cherubs', 6], ['cherubs', 10]],
      [null, null, ['choristers', 4], ['choristers', 6]],
      [null, null, null, null, null],
    ]);
    expect(pearlyGates.arenas[0].waves[2].squad!.at).toEqual([[40, 18], [47, 18], [40, 25], [47, 25]]);
    expect(pearlyGates.arenas[1].waves[2].squad!.at).toEqual([[88, 21], [104, 21], [109, 29], [98, 33]]);
  });

  const squadWave = (at: Array<[number, number]>): WaveDef => ({ blessed: 20, choristers: 0, cherubs: 0, squad: { type: 'cherubs', count: 10, at } });

  it('are placed only on their points, from 5 s after the wave starts, one per 0.5 s, and count in the wave', () => {
    const at: Array<[number, number]> = [[MIDDLE, 2], [MIDDLE, 8], [EAST, 5]];
    const sim = arenaSim([squadWave(at), w(20)], { god: true });
    const log = logTypes(sim);
    sealAt(sim);
    const t0 = sim.tick;
    const st = sim.arenas[0];
    expect(st.waveTotals[0]).toBe(30);
    expect(sim.enemiesRemaining()).toBe(50);
    for (let i = 0; i < 600 && !st.waveFullySpawned[0]; i++) sim.step();
    const squad = log.filter((e) => e.type === CHERUB);
    expect(squad).toHaveLength(10);
    // The Blessed are all placed in 10 s, but the wave isn't fully placed until its squad is.
    expect(log.filter((e) => e.type === BLESSED)).toHaveLength(20);
    expect(squad.every((e) => at.some(([c, r]) => c === e.c && r === e.r))).toBe(true);
    expect(squad.map((e) => e.tick - t0)).toEqual(Array.from({ length: 10 }, (_, k) => squad[0].tick - t0 + 15 * k));
    expect(squad[0].tick - t0).toBeGreaterThanOrEqual(150);
    expect(squad[0].tick - t0).toBeLessThanOrEqual(151);
    // Fully placed on the tick of its last placement, the Blessed's or the squad's.
    expect(sim.tick).toBe(Math.max(...log.map((e) => e.tick)));
  });

  it('a wave whose Blessed are all placed is fully placed only when its squad is', () => {
    // The squad's point is within 8 m of the party, so it waits while the Blessed arrive.
    const sim = arenaSim([{ blessed: 4, choristers: 0, cherubs: 0, squad: { type: 'choristers', count: 2, at: [[WEST, 5]] } }, w(20)], { god: true });
    const log = logTypes(sim);
    sealAt(sim);
    for (let i = 0; i < 330; i++) sim.step();
    expect(log.filter((e) => e.type === BLESSED)).toHaveLength(4);
    expect(sim.arenas[0].waveFullySpawned[0]).toBe(false);
    for (const p of sim.players) p.x = MIDDLE + 0.5;
    for (let i = 0; i < 20 && !sim.arenas[0].waveFullySpawned[0]; i++) sim.step();
    expect(log.filter((e) => e.type === CHORISTER).map((e) => e.tick)).toEqual([sim.tick - 15, sim.tick]);
  });

  it('never within 8 m of a player: they wait, and come once a point is clear', () => {
    const sim = arenaSim([squadWave([[MIDDLE, 5]]), w(20)], { god: true });
    const log = logTypes(sim);
    sealAt(sim, MIDDLE + 0.5, 5.5);
    for (let i = 0; i < 300; i++) sim.step();
    expect(log.filter((e) => e.type === CHERUB)).toHaveLength(0);
    expect(sim.arenas[0].waveFullySpawned[0]).toBe(false);
    for (const p of sim.players) p.x = 8.5;
    sim.step();
    expect(log.filter((e) => e.type === CHERUB)).toHaveLength(1);
  });

  it('are scaled for the party size', () => {
    const sim = arenaSim([squadWave([[EAST, 5]]), w(20)], { players: 1, god: true });
    sealAt(sim);
    expect(sim.arenas[0].waveTotals[0]).toBe(8 + 4);
  });
});
