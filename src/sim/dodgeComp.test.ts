/**
 * Dodge compensation (netcode stage 2): enemy globes and arrows hit each player where that player's
 * screen drew them, a round trip plus the render delay behind the host.
 */
import { describe, expect, it } from 'vitest';
import { PROJ_ARROW, PROJ_GLOBE, type SimPlayer, type Simulation } from './sim';
import { lateStretch, stretchHit } from './lateShots';
import { makeSim, put, room } from './testutil/sims';

/** Every player's screen is `lag` ticks behind the host for the next step. */
function stepWithLag(sim: Simulation, lag: number): void {
  for (const p of sim.players) p.view = { tick: sim.tick - lag, gap: 0, frac: 0 };
  sim.step();
}

/** Steps with the given lag until `p` loses HP (at most 3 s); returns the tick it happened, or -1. */
function tickHurt(sim: Simulation, p: SimPlayer, lag: number): number {
  const hp = p.hp;
  for (let i = 0; i < 90; i++) {
    stepWithLag(sim, lag);
    if (p.hp < hp) return sim.tick;
  }
  return -1;
}

const shattered = (sim: Simulation) => sim.events.some((e) => e.event.type === 'globeShatter');

/** 0.3 s: a 100 ms ping, the render delay and the wait for the next input. */
const LAG = 9;

describe('dodge compensation (netcode stage 2)', () => {
  it('a player standing in a globe’s path is hit when their screen shows the hit, not before', () => {
    const times = [0, LAG].map((lag) => {
      const sim = makeSim(room(30, 5), ['binder']);
      put(sim, sim.players[0], 12.5, 3.5);
      sim.spawnProjectile(PROJ_GLOBE, 2.5, 3.5, 0.9, 1, 0, 0, 6, 0.3, 12, 60, -1);
      const tick = tickHurt(sim, sim.players[0], lag);
      expect(sim.players[0].hp).toBe(228);
      return tick;
    });
    expect(times[0]).toBeGreaterThan(0);
    expect(times[1] - times[0]).toBe(LAG);
  });

  it('a lagging player who steps out of the path their screen shows is not hit, though the globe already passed them on the host', () => {
    for (const [lag, hurt] of [[0, true], [LAG, false]] as const) {
      const sim = makeSim(room(30, 5), ['binder']);
      const p = sim.players[0];
      put(sim, p, 12.5, 3.5);
      const g = sim.spawnProjectile(PROJ_GLOBE, 2.5, 3.5, 0.9, 1, 0, 0, 6, 0.3, 12, 60, -1);
      // On the host the globe reaches the far side of the player; their screen still draws it 1.8 m short.
      while (sim.pAlive[g] && sim.pX[g] < 13.3 && p.hp === 240) stepWithLag(sim, lag);
      put(sim, p, 12.5, 1.5);
      for (let i = 0; i < 120 && (sim.pAlive[g] || sim.lateShots.length); i++) stepWithLag(sim, lag);
      expect(p.hp).toBe(hurt ? 228 : 240);
      expect(sim.lateShots).toHaveLength(0);
    }
  });

  it('a globe that broke on the wall still hits the lagging player standing in front of it, once', () => {
    const sim = makeSim(room(20, 5), ['binder']);
    const p = sim.players[0];
    // The wall's face is at x = 21: the player's cylinder ends 0.6 m short of it.
    put(sim, p, 20.0, 3.5);
    const g = sim.spawnProjectile(PROJ_GLOBE, 10.5, 3.5, 0.9, 1, 0, 0, 6, 0.3, 12, 60, -1);
    // With the screen 1.8 m behind, the globe reaches the wall on the host before the player is hit.
    while (sim.pAlive[g]) stepWithLag(sim, LAG);
    expect(shattered(sim)).toBe(true);
    expect(p.hp).toBe(240);
    expect(sim.lateShots).toHaveLength(1);
    for (let i = 0; i < 20; i++) stepWithLag(sim, LAG);
    // The direct hit only, not the shatter on top of it.
    expect(p.hp).toBe(228);
    expect(sim.lateShots).toHaveLength(0);
  });

  it('the shatter at the wall waits until the lagging player’s screen draws it', () => {
    for (const lag of [0, LAG]) {
      const sim = makeSim(room(20, 5), ['binder']);
      const p = sim.players[0];
      // Beside the path, within 1.5 m of where the globe breaks on the wall at x = 21.
      put(sim, p, 20.0, 2.3);
      const g = sim.spawnProjectile(PROJ_GLOBE, 10.5, 3.5, 0.9, 1, 0, 0, 6, 0.3, 12, 60, -1);
      while (sim.pAlive[g]) stepWithLag(sim, lag);
      const broke = sim.tick;
      expect(p.hp).toBe(lag ? 240 : 228);
      const hurt = lag ? tickHurt(sim, p, lag) : broke;
      expect(p.hp).toBe(228);
      // The break is drawn between `lag − 1` and `lag` ticks later, depending on where in its last tick it hit.
      expect(hurt - broke).toBeGreaterThanOrEqual(lag ? lag - 1 : 0);
      expect(hurt - broke).toBeLessThanOrEqual(lag);
    }
  });

  it('an arrow that hit the wall still hits the lagging player in front of it', () => {
    const sim = makeSim(room(20, 5), ['binder']);
    const p = sim.players[0];
    put(sim, p, 20.2, 3.5);
    const a = sim.spawnProjectile(PROJ_ARROW, 8.5, 3.5, 0.9, 1, 0, 0, 18, 0.15, 8, 60, -1);
    while (sim.pAlive[a]) stepWithLag(sim, LAG);
    expect(p.hp).toBe(240);
    for (let i = 0; i < 20; i++) stepWithLag(sim, LAG);
    expect(p.hp).toBe(232);
  });

  it('each player is judged by their own screen', () => {
    const sim = makeSim(room(30, 5), ['binder', 'binder']);
    const [host, friend] = sim.players;
    put(sim, host, 12.5, 3.5);
    put(sim, friend, 12.5, 3.5);
    const g = sim.spawnProjectile(PROJ_ARROW, 2.5, 3.5, 0.9, 1, 0, 0, 18, 0.15, 8, 60, -1);
    // The host draws 1.5 ticks behind, the friend 9: the host meets it first and takes the arrow.
    for (let i = 0; i < 30 && sim.pAlive[g]; i++) {
      host.view = { tick: sim.tick - 1, gap: 1, frac: 0.5 };
      friend.view = { tick: sim.tick - LAG, gap: 0, frac: 0 };
      sim.step();
    }
    expect([host.hp, friend.hp]).toEqual([232, 240]);
  });

  it('a lagging shooter hits a globe where their screen drew it', () => {
    // As in the globe tests: 8 m/s, a revolver shot across its path 3 m behind it, out of the 0.25 s trail.
    for (const [lag, hits] of [[0, false], [LAG, true]] as const) {
      const sim = makeSim(room(30, 12), ['betrayer']);
      const p = sim.players[0];
      const g = sim.spawnProjectile(PROJ_GLOBE, 2.5, 2.5, 1.6, 1, 0, 0, 8, 0.3, 12, 60, -1);
      for (let i = 0; i < 30; i++) sim.step();
      put(sim, p, sim.pX[g] - 3.0, 1.5, Math.PI / 2);
      p.view = { tick: sim.tick - 1 - lag, gap: 0, frac: 0 };
      sim.fireWeapon(p);
      expect(sim.pAlive[g]).toBe(hits ? 0 : 1);
    }
  });
});

describe('late stretches', () => {
  it('without lag, the stretch is this tick’s flight up to where it stopped', () => {
    expect(lateStretch(0, 5, 0, 0.2, 0.2)).toEqual([0, 0.2]);
    expect(lateStretch(0, 5, 0, 0.6, 0.3)).toEqual([0, 0.3]);
  });

  it('a screen behind sees an earlier stretch, never before the spawn, never past where it stopped', () => {
    expect(lateStretch(0.1, 5, 0, 0.6, 0.3)).toEqual([-0.1, 0.3]);
    expect(lateStretch(1.8, 1.7, 0, 0.2, 0.2)).toEqual([-1.7, -1.6]);
    // Spawned 1 m ago: a screen 1.8 m behind hasn't drawn it yet.
    expect(lateStretch(1.8, 1.0, 0, 0.2, 0.2)).toBeNull();
  });

  it('meets a cylinder only within the stretch', () => {
    // A cylinder of radius 0.5 around x = 1: met at x = 0.5.
    expect(stretchHit(0, 0, 1, 1, 0, 0, 0, 1, 1, 0, 0, 0.5, 2)).toBeCloseTo(0.5, 9);
    expect(stretchHit(0, 0, 1, 1, 0, 0, 0, 0.4, 1, 0, 0, 0.5, 2)).toBe(Infinity);
    // Behind the reference point.
    expect(stretchHit(2, 0, 1, 1, 0, 0, -2, -1, 1, 0, 0, 0.5, 2)).toBeCloseTo(-1.5, 9);
  });
});
