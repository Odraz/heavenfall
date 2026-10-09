/** The globe (M12 follow-up §1.3): the Chorister's and the Orb Volley's projectile. */
import { describe, expect, it } from 'vitest';
import { BLESSED, CHORISTER } from '../data/enemies';
import { GLOBE_BLAST, GLOBE_SHOT_DAMAGE, GLOBE_SHOT_REACH, PROJ_GLOBE, segmentDistance, type Simulation } from './sim';
import { enemyAt, makeSim, put, room } from './testutil/sims';

const shatters = (sim: Simulation) => sim.events.flatMap((e) => (e.event.type === 'globeShatter' ? [e.event] : []));

/** Steps until the projectile is gone (at most 3 s). */
function untilGone(sim: Simulation, slot: number): void {
  for (let i = 0; i < 90 && sim.pAlive[slot]; i++) sim.step();
  expect(sim.pAlive[slot]).toBe(0);
}

/** A 20 × 12 room with an 8 m pillar on the cells (x, y) listed. */
function roomWith(pillars: Array<[number, number]>): string[] {
  const rows = room(20, 12).map((r) => [...r]);
  for (const [x, y] of pillars) rows[y][x] = '8';
  return rows.map((r) => r.join(''));
}

describe('the globe (M12 follow-up §1.3)', () => {
  it('a Chorister fires a globe at 8 m/s', () => {
    const sim = makeSim(room(30, 5), ['binder']);
    put(sim, sim.players[0], 2.5, 3.5);
    sim.players[0].devGod = true;
    enemyAt(sim, CHORISTER, 15.5, 3.5);
    for (let i = 0; i < 120 && sim.projectiles.length === 0; i++) sim.step();
    const g = sim.projectiles[0];
    expect(sim.pKind[g]).toBe(PROJ_GLOBE);
    const before = sim.pTraveled[g];
    sim.step();
    expect(sim.pTraveled[g] - before).toBeCloseTo(8 / 30, 9);
  });

  it('shatters on a player: its damage to them and to others within 1.5 m in its sight, not farther, not to enemies', () => {
    const sim = makeSim(room(20, 12), ['binder', 'binder', 'binder']);
    const [hit, near, far] = sim.players;
    put(sim, hit, 10.5, 5.5);
    // The globe breaks on hit's cylinder about x = 9.8: near is 0.9 m from it, far 2.0 m.
    put(sim, near, 10.5, 6.7);
    put(sim, far, 10.5, 7.8);
    const c = enemyAt(sim, CHORISTER, 10.5, 4.3);
    sim.root(c, 10);
    sim.silence(c, 10);
    const g = sim.spawnProjectile(PROJ_GLOBE, 2.5, 5.5, 0.9, 1, 0, 0, 8, 0.3, 12, 60, -1);
    sim.events.length = 0;
    untilGone(sim, g);
    expect([hit.hp, near.hp, far.hp]).toEqual([228, 228, 240]);
    expect(sim.eHp[c]).toBe(60);
    expect(shatters(sim)).toHaveLength(1);
    expect(shatters(sim)[0].by).toBe(-1);
  });

  it("cover protects: a globe breaking on a pillar hurts who's on its side, not who's behind it", () => {
    // The pillar's cells x 10, y 5: a globe flying +x along y 5.5 breaks on its face at x = 10.
    const sim = makeSim(roomWith([[10, 5]]), ['binder', 'binder']);
    const [side, behind] = sim.players;
    put(sim, side, 9.2, 6.8);
    put(sim, behind, 11.6, 5.5);
    const g = sim.spawnProjectile(PROJ_GLOBE, 2.5, 5.5, 1, 1, 0, 0, 8, 0.3, 15, 60, -1);
    untilGone(sim, g);
    expect(side.hp).toBe(225);
    expect(behind.hp).toBe(240);
    expect(shatters(sim)).toHaveLength(1);
  });

  it('shatters at the end of its range too', () => {
    const sim = makeSim(room(80, 5), ['binder']);
    put(sim, sim.players[0], 9.5, 4.2);
    // 6 m of range: it ends at x = 8.5, 0.8 m from the player's cylinder.
    const g = sim.spawnProjectile(PROJ_GLOBE, 2.5, 3.5, 1, 1, 0, 0, 8, 0.3, 12, 6, -1);
    untilGone(sim, g);
    expect(sim.players[0].hp).toBe(228);
    expect(shatters(sim)).toHaveLength(1);
  });

  it('a shot passing within 0.3 m shatters it and still hits the enemy behind; 40 to enemies within 1.5 m in its sight, credited; nothing to players', () => {
    // A pillar on cells (8, 6) and (9, 6) hides `hidden` from the globe.
    const sim = makeSim(roomWith([[8, 6], [9, 6]]), ['betrayer', 'binder']);
    const [shooter, ally] = sim.players;
    put(sim, shooter, 2.5, 5.5);
    put(sim, ally, 10.3, 6.2);
    const behind = enemyAt(sim, CHORISTER, 15.5, 5.5);
    const inBlast = enemyAt(sim, BLESSED, 8.5, 4.6);
    const outside = enemyAt(sim, BLESSED, 8.5, 3.6);
    const hidden = enemyAt(sim, BLESSED, 8.5, 7.0);
    // The revolver's ray runs along y = 5.5 at the eye's 1.6 m; the globe is 0.25 m off it.
    const g = sim.spawnProjectile(PROJ_GLOBE, 8.5, 5.75, 1.6, -1, 0, 0, 0, 0.3, 12, 60, -1);
    sim.events.length = 0;
    sim.fireWeapon(shooter);
    expect(sim.pAlive[g]).toBe(0);
    expect(sim.eAlive[behind]).toBe(0);
    expect(sim.eAlive[inBlast]).toBe(0);
    expect(sim.eHp[outside]).toBe(20);
    expect(sim.eHp[hidden]).toBe(20);
    expect(ally.hp).toBe(240);
    expect(shooter.kills).toBe(2);
    expect(shatters(sim)).toEqual([{ type: 'globeShatter', x: 8.5, y: 5.75, z: 1.6, by: shooter.id }]);
    expect(GLOBE_SHOT_DAMAGE).toBe(40);
    expect(GLOBE_BLAST).toBe(1.5);
  });

  it('a shot 0.4 m away misses it', () => {
    const sim = makeSim(room(20, 12), ['betrayer']);
    put(sim, sim.players[0], 2.5, 5.5);
    const g = sim.spawnProjectile(PROJ_GLOBE, 8.5, 5.9, 1.6, -1, 0, 0, 0, 0.3, 12, 60, -1);
    sim.fireWeapon(sim.players[0]);
    expect(sim.pAlive[g]).toBe(1);
    expect(GLOBE_SHOT_REACH).toBe(0.3);
  });

  it('a shot hits the path it flew in the last 0.25 s, as others see it drawn, but not farther back', () => {
    for (const [behindBy, hits] of [[1.5, true], [2.5, false]] as const) {
      const sim = makeSim(room(30, 12), ['betrayer']);
      const p = sim.players[0];
      // The globe flies +x along y = 2.5 at 8 m/s; the revolver fires +y across its path.
      const g = sim.spawnProjectile(PROJ_GLOBE, 2.5, 2.5, 1.6, 1, 0, 0, 8, 0.3, 12, 60, -1);
      for (let i = 0; i < 30; i++) sim.step();
      put(sim, p, sim.pX[g] - behindBy, 1.5, Math.PI / 2);
      sim.fireWeapon(p);
      expect(sim.pAlive[g]).toBe(hits ? 0 : 1);
    }
  });

  it('a censer passing by shatters it and flies on', () => {
    const sim = makeSim(room(30, 5), ['heretic']);
    const p = sim.players[0];
    put(sim, p, 2.5, 3.5);
    const g = sim.spawnProjectile(PROJ_GLOBE, 8.5, 3.75, 1.6, -1, 0, 0, 0, 0.3, 12, 60, -1);
    sim.fireWeapon(p);
    for (let i = 0; i < 15 && sim.pAlive[g]; i++) sim.step();
    expect(sim.pAlive[g]).toBe(0);
    for (let i = 0; i < 60 && sim.clouds.length === 0; i++) sim.step();
    // It broke on the far wall, not at the globe.
    expect(sim.clouds[0].x).toBeGreaterThan(20);
    expect(shatters(sim).map((e) => e.by)).toEqual([p.id]);
  });

  it('segmentDistance', () => {
    expect(segmentDistance(0, 0, 0, 10, 0, 0, 5, 1, 0, 5, 3, 0)).toBeCloseTo(1, 9);
    expect(segmentDistance(0, 0, 0, 10, 0, 0, 12, 0, 0, 14, 0, 0)).toBeCloseTo(2, 9);
    expect(segmentDistance(0, 0, 0, 10, 0, 0, 3, -1, 2, 3, 1, 2)).toBeCloseTo(2, 9);
    expect(segmentDistance(0, 0, 0, 0, 0, 0, 3, 4, 0, 3, 4, 0)).toBeCloseTo(5, 9);
  });
});
