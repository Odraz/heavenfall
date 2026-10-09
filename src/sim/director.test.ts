import { describe, expect, it } from 'vitest';
import type { WaveDef } from '../data/dungeons/types';
import { BLESSED } from '../data/enemies';
import { PHASE_CLEARED } from '../net/protocol';
import { Director, PEAK_TICKS, QUIET_TICKS, RELAX_LIMIT_TICKS, SOLO_RELAX_MIN_TICKS } from './director';
import { arenaSim, sealAt } from './testutil/arenas';
import { enemyAt, sealNow } from './testutil/sims';
import { localSnap } from './workerMessages';

const LIVING = [true, true, true, true];

/** A director of a 3-wave arena whose largest wave is 100, in build up of wave 0. */
function fresh(): Director {
  const d = new Director(3, 100);
  d.waveStarted(0);
  return d;
}

/** Steps a director `n` times with the same inputs; returns how many steps asked for the next wave. */
function run(d: Director, n: number, party: number, fullySpawned: boolean, alive: number, total = 100): number {
  let starts = 0;
  for (let i = 0; i < n; i++) if (d.step(party, fullySpawned, alive, total)) starts++;
  return starts;
}

describe('the director, phases (M12 §2.3)', () => {
  it('starts in build up, and stops once the last wave starts', () => {
    const d = fresh();
    expect(d.phase).toBe('build');
    d.waveStarted(1);
    expect(d.phase).toBe('build');
    d.waveStarted(2);
    expect(d.phase).toBe('done');
    expect(run(d, 1000, 0, true, 0)).toBe(0);
    // A death after the last wave started isn't a peak.
    d.died(0);
    expect(d.phase).toBe('done');
  });

  it('build up → peak at 70, only once the wave has fully spawned, also when 70 was reached before', () => {
    const d = fresh();
    expect(run(d, 30, 80, false, 90)).toBe(0);
    expect(d.phase).toBe('build');
    expect(run(d, 1, 69.9, true, 90)).toBe(0);
    expect(d.phase).toBe('build');
    expect(run(d, 1, 70, true, 90)).toBe(0);
    expect(d.phase).toBe('peak');
  });

  it('build up → the next wave at once when 30% or fewer are left, and that wins over the peak', () => {
    const d = fresh();
    expect(run(d, 1, 0, true, 31)).toBe(0);
    expect(d.step(0, true, 30, 100)).toBe(true);
    const both = fresh();
    expect(both.step(90, true, 30, 100)).toBe(true);
    expect(both.phase).toBe('build');
  });

  it('in single player, the 30% rule leads to a breath of at least 6 s before the next wave (M12 follow-up §3.1)', () => {
    const d = new Director(3, 100, true);
    d.waveStarted(0);
    expect(d.step(0, true, 30, 100)).toBe(false);
    expect(d.phase).toBe('relax');
    // Quiet all along, but no wave before 6 s.
    expect(run(d, SOLO_RELAX_MIN_TICKS - 1, 0, true, 30)).toBe(0);
    expect(d.step(0, true, 30, 100)).toBe(true);
    // Also after a peak: relax waits its 6 s.
    const p = new Director(3, 100, true);
    p.waveStarted(0);
    run(p, 1, 80, true, 90);
    expect(p.phase).toBe('peak');
    run(p, PEAK_TICKS, 0, true, 90);
    expect(p.phase).toBe('relax');
    expect(run(p, SOLO_RELAX_MIN_TICKS - 1, 0, true, 30)).toBe(0);
    expect(p.step(0, true, 30, 100)).toBe(true);
    expect(SOLO_RELAX_MIN_TICKS).toBe(180);
  });

  it('peak lasts 4 s with no wave, then relaxes', () => {
    const d = fresh();
    d.step(80, true, 90, 100);
    expect(d.phase).toBe('peak');
    expect(run(d, PEAK_TICKS - 1, 0, true, 0)).toBe(0);
    expect(d.phase).toBe('peak');
    expect(run(d, 1, 0, true, 0)).toBe(0);
    expect(d.phase).toBe('relax');
  });

  it('relax → the next wave after 2 s in a row below 25', () => {
    const d = fresh();
    d.died(0);
    run(d, PEAK_TICKS, 0, true, 90);
    expect(d.phase).toBe('relax');
    expect(run(d, QUIET_TICKS - 10, 20, true, 90)).toBe(0);
    // A tick at 25 restarts the count.
    expect(run(d, 1, 25, true, 90)).toBe(0);
    expect(run(d, QUIET_TICKS - 1, 24.9, true, 90)).toBe(0);
    expect(d.step(24.9, true, 90, 100)).toBe(true);
  });

  it('relax → the next wave after 10 s only while at most 30% of the latest wave is alive', () => {
    const d = fresh();
    d.died(0);
    run(d, PEAK_TICKS, 0, true, 90);
    // Intensity never falls below 25, and most of the wave is alive: no wave, however long.
    expect(run(d, RELAX_LIMIT_TICKS + 300, 50, true, 31)).toBe(0);
    expect(d.step(50, true, 30, 100)).toBe(true);
    const early = fresh();
    early.died(0);
    run(early, PEAK_TICKS, 0, true, 90);
    expect(run(early, RELAX_LIMIT_TICKS - 1, 50, true, 10)).toBe(0);
    expect(early.step(50, true, 10, 100)).toBe(true);
  });

  it("relax never starts a wave before the latest one has fully spawned (a death 1 s into a wave doesn't start the next early)", () => {
    const d = fresh();
    run(d, 30, 0, false, 20);
    d.died(1);
    expect(run(d, PEAK_TICKS + QUIET_TICKS + RELAX_LIMIT_TICKS, 0, false, 0)).toBe(0);
    expect(d.phase).toBe('relax');
    expect(d.step(0, true, 0, 100)).toBe(true);
  });

  it("a death is a peak, from build up or relax, and restarts a peak's 4 s", () => {
    const d = fresh();
    d.intensity[1] = 40;
    d.died(1);
    expect([d.phase, d.intensity[1]]).toEqual(['peak', 0]);
    run(d, PEAK_TICKS - 10, 0, true, 90);
    d.died(2);
    expect(run(d, PEAK_TICKS - 1, 0, true, 0)).toBe(0);
    expect(d.phase).toBe('peak');
    run(d, 1, 0, true, 0);
    expect(d.phase).toBe('relax');
    d.died(0);
    expect(d.phase).toBe('peak');
  });

  it('never starts a wave while more than the largest wave is alive', () => {
    const d = new Director(3, 100);
    d.waveStarted(0);
    d.died(0);
    run(d, PEAK_TICKS, 0, true, 0);
    expect(run(d, QUIET_TICKS + RELAX_LIMIT_TICKS, 0, true, 101, 400)).toBe(0);
    expect(d.phase).toBe('relax');
    expect(d.step(0, true, 100, 400)).toBe(true);
  });
});

describe('the director, intensity (M12 §2.3)', () => {
  it('adds 15 for losing 10% of max HP and 1 per kill close by, clamped to 0–100', () => {
    const d = fresh();
    d.hurt(0, 20, 200);
    expect(d.intensity[0]).toBeCloseTo(15, 9);
    d.killNear(0);
    expect(d.intensity[0]).toBeCloseTo(16, 9);
    d.hurt(0, 500, 200);
    expect(d.intensity[0]).toBe(100);
    for (let i = 0; i < 400; i++) d.decay(0);
    expect(d.intensity[0]).toBe(0);
  });

  it('decays 20 per second', () => {
    const d = fresh();
    d.intensity[2] = 50;
    for (let i = 0; i < 30; i++) d.decay(2);
    expect(d.intensity[2]).toBeCloseTo(30, 9);
  });

  it("the party's intensity is the highest living player's", () => {
    const d = fresh();
    d.intensity.set([10, 60, 30, 0]);
    expect(d.party(LIVING)).toBe(60);
    expect(d.party([true, false, true, true])).toBe(30);
  });
});

const w = (blessed: number): WaveDef => ({ blessed, choristers: 0, cherubs: 0 });

describe('the director in the simulation (M12 §2.3)', () => {
  it('runs from the seal, with wave 1 in build up and every intensity 0, and its cap is the largest scaled wave', () => {
    const sim = arenaSim([w(50), { blessed: 70, choristers: 5, cherubs: 6 }, w(30)], { players: 2 });
    sealAt(sim);
    const d = sim.arenas[0].director!;
    expect(d).not.toBeNull();
    expect([d.phase, sim.arenas[0].wave]).toEqual(['build', 0]);
    expect([...d.intensity]).toEqual([0, 0, 0, 0]);
    // At 2 players: ceil(70 × 0.6) + ceil(5 × 0.6) + ceil(6 × 0.6) = 42 + 3 + 4.
    expect(d.cap).toBe(49);
  });

  it('a hit adds 150 × (shield absorbed + HP lost) ÷ max HP; a lethal hit counts HP down to 0, then the death zeroes it', () => {
    const sim = arenaSim([w(50), w(50)]);
    sealAt(sim);
    const d = sim.arenas[0].director!;
    const p = sim.players[0];
    sim.damagePlayer(p, p.maxHp * 0.1);
    expect(d.intensity[0]).toBeCloseTo(15, 9);
    sim.giveShield(p, 20, 5);
    sim.damagePlayer(p, 30);
    // 20 absorbed + 10 HP.
    expect(d.intensity[0]).toBeCloseTo(15 + (150 * 30) / p.maxHp, 9);
    sim.damagePlayer(p, 10_000);
    expect(p.dead).toBe(true);
    expect(d.intensity[0]).toBe(0);
    expect(d.phase).toBe('peak');
  });

  it('adds 1 per enemy removed within 5 m horizontally, whoever killed it, not at 6 m; K counts, the victory sweep not', () => {
    const sim = arenaSim([w(50), w(50)]);
    sealAt(sim, 12.5, 5.5);
    const d = sim.arenas[0].director!;
    const near = enemyAt(sim, BLESSED, 12.5 + 4.9, 5.5);
    const far = enemyAt(sim, BLESSED, 12.5 - 6, 5.5);
    sim.removeEnemy(far);
    expect(d.intensity[0]).toBe(0);
    sim.removeEnemy(near);
    expect([...d.intensity]).toEqual([1, 1, 1, 1]);
    const killed = enemyAt(sim, BLESSED, 13.5, 5.5);
    sim.damageEnemy(killed, 100, 2);
    expect(d.intensity[0]).toBe(2);
    enemyAt(sim, BLESSED, 13.5, 5.5);
    enemyAt(sim, BLESSED, 13.5, 6.5);
    sim.killAll();
    expect(d.intensity[0]).toBe(4);
    const swept = enemyAt(sim, BLESSED, 13.5, 5.5);
    sim.removeEnemy(swept, true);
    expect(d.intensity[0]).toBe(4);
  });

  it('decays 20 per second only when not engaged: no living enemy within 8 m and no hit in the last 30 ticks', () => {
    const sim = arenaSim([w(50), w(50)], { players: 1 });
    sealAt(sim);
    const d = sim.arenas[0].director!;
    const p = sim.players[0];
    // Wave enemies come from the east column, over 22 m away; a rooted enemy 8.5 m away doesn't engage.
    const out = enemyAt(sim, BLESSED, 8.5 + 8.5, 5.5);
    sim.root(out, 100);
    d.intensity[0] = 50;
    for (let i = 0; i < 30; i++) sim.step();
    expect(d.intensity[0]).toBeCloseTo(30, 6);
    // One within 8 m engages.
    const inside = enemyAt(sim, BLESSED, 8.5 + 7.5, 5.5);
    sim.root(inside, 100);
    for (let i = 0; i < 30; i++) sim.step();
    expect(d.intensity[0]).toBeCloseTo(30, 6);
    sim.removeEnemy(inside);
    // A hit engages for 30 ticks.
    sim.damagePlayer(p, 1);
    const after = d.intensity[0];
    for (let i = 0; i < 29; i++) sim.step();
    expect(d.intensity[0]).toBeCloseTo(after, 6);
    sim.step();
    expect(d.intensity[0]).toBeCloseTo(after - 20 / 30, 6);
  });

  it("a revive doesn't make a player engaged", () => {
    const sim = arenaSim([w(50), w(50)], { players: 2 });
    sealAt(sim);
    const d = sim.arenas[0].director!;
    const p = sim.players[1];
    for (let i = 0; i < 40; i++) sim.step();
    sim.damagePlayer(p, 10_000);
    for (let i = 0; i < 40; i++) sim.step();
    sim['revivePlayer'](p);
    d.intensity[1] = 10;
    sim.step();
    expect(d.intensity[1]).toBeCloseTo(10 - 20 / 30, 6);
  });

  it('starts the next wave at once when the arena has fully spawned a wave and 30% or fewer are left, and stops after the last', () => {
    const sim = arenaSim([w(30), w(20), w(10)], { god: true });
    sealAt(sim);
    const st = sim.arenas[0];
    while (!st.waveFullySpawned[0]) sim.step();
    expect(st.wave).toBe(0);
    while (st.alive > 9) sim.removeEnemy(sim.active[0]);
    sim.step();
    expect(st.wave).toBe(1);
    while (!st.waveFullySpawned[1]) sim.step();
    sim.killAll();
    sim.step();
    expect([st.wave, st.director!.phase]).toEqual([2, 'done']);
    while (!st.waveFullySpawned[2]) sim.step();
    sim.killAll();
    sim.step();
    expect(st.phase).toBe(PHASE_CLEARED);
  });

  it('a player death is a peak, but not after the last wave started', () => {
    const sim = arenaSim([w(30), w(20)], { players: 3 });
    sealAt(sim);
    const st = sim.arenas[0];
    sim.damagePlayer(sim.players[1], 10_000);
    expect(st.director!.phase).toBe('peak');
    // The others can't be hurt while the wave arrives.
    sim.players[0].devGod = true;
    sim.players[2].devGod = true;
    while (!st.waveFullySpawned[0]) sim.step();
    sim.killAll();
    // The peak lasted its 4 s and relax had its 2 s of quiet: the last wave starts.
    sim.step();
    expect([st.wave, st.director!.phase]).toEqual([1, 'done']);
    sim.players[2].devGod = false;
    sim.damagePlayer(sim.players[2], 10_000);
    expect(sim.players[2].dead).toBe(true);
    expect(st.director!.phase).toBe('done');
  });

  it('is absent in single-wave arenas, the boss arena and with noWaves', () => {
    const single = arenaSim([w(30)]);
    sealAt(single);
    expect(single.arenas[0].director).toBeNull();
    expect(single.directorInfo()).toBeNull();
    const boss = arenaSim([w(30), w(30)], { boss: true });
    sealAt(boss);
    expect(boss.arenas[0].director).toBeNull();
    // With noWaves an arena clears as soon as it seals, as before.
    const none = arenaSim([w(30), w(30)], { noWaves: true });
    none.players[0].x = 8.5;
    none.players[0].y = 5.5;
    none.step();
    sealNow(none);
    expect(none.arenas[0].phase).toBe(PHASE_CLEARED);
    expect(none.arenas[0].director).toBeNull();
    expect(none.activeCount).toBe(0);
  });

  it("the local player's snap message carries the director", () => {
    const sim = arenaSim([w(30), w(20)], { players: 1 });
    expect(localSnap(sim, 0, [], 1)).toEqual({ t: 'snap', to: 0, bufs: [], simMs: 1, director: null });
    sealAt(sim);
    for (let i = 0; i < 30; i++) sim.step();
    const m = localSnap(sim, 0, [], 1);
    expect(m.t === 'snap' && m.director).toEqual({ phase: 'build', phaseTime: 31 / 30, intensity: 0, wave: 0, alive: sim.arenas[0].alive, waveTotal: 12 });
  });
});

describe('a breath in single player (M12 §2.5)', () => {
  const solo = () => {
    const sim = arenaSim([w(50), w(50)], { players: 1, singleplayer: true });
    sealAt(sim);
    const p = sim.players[0];
    p.hp = p.maxHp / 2;
    p.lastDamageTick = sim.tick - 300;
    return { sim, p, d: sim.arenas[0].director! };
  };

  it('regenerates 8% of max HP per second after 2 s without damage, only in relax (M12 follow-up §3.1)', () => {
    const { sim, p, d } = solo();
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.hp).toBe(p.maxHp / 2);
    d.died(1);
    expect(d.phase).toBe('peak');
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.hp).toBe(p.maxHp / 2);
    d.phase = 'relax';
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.hp).toBeCloseTo(p.maxHp * 0.58, 6);
    // Not within 2 s of damage.
    p.lastDamageTick = sim.tick - 30;
    const hp = p.hp;
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.hp).toBeCloseTo(hp + (p.maxHp * 0.08) / 30, 6);
  });

  it('a clear heals every living player to full, in single player and with 2 players (M12 follow-up §3.2)', () => {
    for (const players of [1, 2]) {
      const sim = arenaSim([w(5)], { players, singleplayer: players === 1 });
      sealAt(sim);
      for (const p of sim.players) p.hp = p.maxHp * 0.3;
      for (let i = 0; i < 400 && sim.arenas[0].phase !== PHASE_CLEARED; i++) {
        for (const s of sim.active.slice(0, sim.activeCount)) sim.damageEnemy(s, 1000, -1);
        sim.step();
      }
      expect(sim.arenas[0].phase).toBe(PHASE_CLEARED);
      for (const p of sim.players) expect(p.hp).toBe(p.maxHp);
    }
  });

  it('none after the last wave starts; as before once the arena is cleared', () => {
    const { sim, p, d } = solo();
    d.waveStarted(1);
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.hp).toBe(p.maxHp / 2);
    sim.arenas[0].phase = PHASE_CLEARED;
    p.lastDamageTick = sim.tick - 300;
    sim.step();
    expect(p.hp).toBeCloseTo(p.maxHp * (0.5 + 0.015 / 30), 6);
  });
});
