/** M12 stage 3: burst deaths on the host (M12 §4.1, §11.1). */
import { describe, expect, it } from 'vitest';
import { BLESSED, CHORISTER, GATEKEEPER } from '../data/enemies';
import { ATTACK_PRIMARY, ATTACK_SECONDARY } from '../data/weapons';
import { burstAngle, burstTier } from './combat';
import type { Simulation } from './sim';
import { aimAt, enemyAt, makeSim, put, room } from './testutil/sims';

/** The `bursts` events so far, each as [slot, angle, playerId] triples. */
function bursts(sim: Simulation): Array<Array<[number, number, number]>> {
  sim.flushBursts();
  return sim.events.flatMap((e) => {
    if (e.event.type !== 'bursts') return [];
    const l = e.event.list;
    const out: Array<[number, number, number]> = [];
    for (let i = 0; i < l.length; i += 3) out.push([l[i], l[i + 1], l[i + 2]]);
    return [out];
  });
}

/** Each burst slot's tier: 1 light, 2 heavy. */
function tiers(sim: Simulation): Map<number, number> {
  return new Map(bursts(sim).flat().map(([s, a]) => [s, a >= 360 ? 2 : 1]));
}

describe('burst tiers (M12 §4.1)', () => {
  it('light at 2× max HP, heavy at 4×', () => {
    expect(burstTier(39, 20)).toBe(0);
    expect(burstTier(40, 20)).toBe(1);
    expect(burstTier(79, 20)).toBe(1);
    expect(burstTier(80, 20)).toBe(2);
    expect(burstTier(Infinity, 20)).toBe(2);
  });

  it('a revolver kill bursts light', () => {
    const sim = makeSim(room(30, 5), ['betrayer']);
    const p = sim.players[0];
    put(sim, p, 2.5, 2.5);
    const s = enemyAt(sim, BLESSED, 10.5, 2.5);
    aimAt(sim, p, s);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eAlive[s]).toBe(0);
    expect(tiers(sim).get(s)).toBe(1);
  });

  it("one Chain Gun kill doesn't burst", () => {
    const sim = makeSim(room(30, 5), ['binder']);
    const p = sim.players[0];
    put(sim, p, 2.5, 2.5);
    const s = enemyAt(sim, BLESSED, 6.5, 2.5);
    sim.eHp[s] = 12;
    aimAt(sim, p, s);
    sim.fireWeapon(p, ATTACK_PRIMARY);
    expect(sim.eAlive[s]).toBe(0);
    expect(bursts(sim)).toEqual([]);
  });

  it('a shotgun kill bursts heavy within 6 m and not beyond', () => {
    const near = makeSim(room(30, 5), ['fallen']);
    const p = near.players[0];
    put(near, p, 2.5, 2.5);
    const a = enemyAt(near, BLESSED, 4.5, 2.5);
    aimAt(near, p, a);
    near.fireWeapon(p, ATTACK_PRIMARY);
    expect(near.eAlive[a]).toBe(0);
    expect(tiers(near).get(a)).toBe(2);

    const far = makeSim(room(30, 5), ['fallen']);
    const q = far.players[0];
    put(far, q, 2.5, 2.5);
    const b = enemyAt(far, BLESSED, 11.5, 2.5);
    aimAt(far, q, b);
    for (let i = 0; i < 20 && far.eAlive[b]; i++) far.fireWeapon(q, ATTACK_PRIMARY);
    expect(far.eAlive[b]).toBe(0);
    expect(bursts(far)).toEqual([]);
  });

  it('a Scourge kill always bursts heavy', () => {
    const sim = makeSim(room(30, 5), ['binder']);
    const p = sim.players[0];
    put(sim, p, 2.5, 2.5);
    const s = enemyAt(sim, BLESSED, 4.0, 2.5);
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(sim.eAlive[s]).toBe(0);
    expect(tiers(sim).get(s)).toBe(2);
  });

  it('a Silver Bullet through 10 Blessed: force 200 down to 20, the first 7 heavy, the 8th and 9th light, the 10th normal', () => {
    const sim = makeSim(room(80, 4), ['betrayer']);
    const p = sim.players[0];
    const slots = Array.from({ length: 10 }, (_, i) => enemyAt(sim, BLESSED, 5.5 + i, 2.5));
    put(sim, p, 1.5, 2.5);
    p.z = -0.8;
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(slots.every((s) => !sim.eAlive[s])).toBe(true);
    const t = tiers(sim);
    expect(slots.map((s) => t.get(s) ?? 0)).toEqual([2, 2, 2, 2, 2, 2, 2, 1, 1, 0]);
  });

  it('a bound Blessed killed by a 20-dmg hit bursts light', () => {
    const sim = makeSim(room(30, 5), ['binder']);
    const s = enemyAt(sim, BLESSED, 6.5, 2.5);
    sim.root(s, 10);
    sim.damageEnemy(s, 20, 0);
    expect(tiers(sim).get(s)).toBe(1);
  });

  it('a Shroud burst kill is heavy, blasted from the shield', () => {
    const sim = makeSim(room(30, 10), ['heretic', 'fallen']);
    const [h, ally] = sim.players;
    put(sim, h, 2.5, 2.5);
    put(sim, ally, 10.5, 5.5);
    const s = enemyAt(sim, BLESSED, 10.5, 7.5);
    sim.giveShield(ally, 10, 8, h);
    sim.damagePlayer(ally, 100);
    expect(sim.eAlive[s]).toBe(0);
    const [[slot, angle, id]] = bursts(sim)[0];
    expect([slot, angle, id]).toEqual([s, 90 + 360, h.id]);
  });

  it('a Chorister needs 120 force in its death tick', () => {
    const sim = makeSim(room(30, 5), ['fallen']);
    const a = enemyAt(sim, CHORISTER, 6.5, 2.5);
    sim.damageEnemy(a, 30, 0, 60);
    sim.damageEnemy(a, 30, 0, 59);
    expect(sim.eAlive[a]).toBe(0);
    expect(bursts(sim)).toEqual([]);

    const b = enemyAt(sim, CHORISTER, 8.5, 2.5);
    sim.damageEnemy(b, 30, 0, 60);
    sim.damageEnemy(b, 30, 0, 60);
    expect(tiers(sim).get(b)).toBe(1);
  });

  it('force from an earlier tick does not count', () => {
    const sim = makeSim(room(30, 5), ['fallen']);
    const s = enemyAt(sim, CHORISTER, 6.5, 2.5);
    sim.damageEnemy(s, 59, 0, 1000);
    sim.step();
    sim.damageEnemy(s, 1, 0);
    expect(sim.eAlive[s]).toBe(0);
    expect(bursts(sim)).toEqual([]);
  });

  it('no burst for the Gatekeeper or for kills without credit', () => {
    const sim = makeSim(room(30, 10), ['fallen']);
    const s = enemyAt(sim, BLESSED, 6.5, 2.5);
    sim.damageEnemy(s, 100, -1, Infinity);
    expect(sim.eAlive[s]).toBe(0);
    const g = enemyAt(sim, GATEKEEPER, 15.5, 5.5);
    sim.damageEnemy(g, 1e9, 0, Infinity);
    expect(sim.eAlive[g]).toBe(0);
    expect(bursts(sim)).toEqual([]);
  });
});

describe('burst angles and the event (M12 §4.1)', () => {
  it('from the credited player to the enemy, in whole degrees', () => {
    const sim = makeSim(room(30, 10), ['fallen']);
    put(sim, sim.players[0], 2.5, 2.5);
    const s = enemyAt(sim, BLESSED, 5.5, 5.5);
    sim.damageEnemy(s, 100, 0, 40);
    expect(bursts(sim)).toEqual([[[s, 45, 0]]]);
  });

  it("falls back to the slot's angle when the two points coincide", () => {
    expect(burstAngle(3, 3, 3, 3, 0)).toBe(0);
    expect(burstAngle(3, 3, 3, 3, 3)).toBe(68);
    expect(burstAngle(3, 3, 3, 3, 17)).toBe(23);
    expect(burstAngle(0, 0, 0, -1, 0)).toBe(270);
  });

  it('one `bursts` event per tick with bursts, none without', () => {
    const sim = makeSim(room(30, 10), ['fallen']);
    put(sim, sim.players[0], 2.5, 2.5);
    const a = enemyAt(sim, BLESSED, 6.5, 2.5);
    const b = enemyAt(sim, BLESSED, 6.5, 6.5);
    sim.damageEnemy(a, 100, 0, 40);
    sim.damageEnemy(b, 100, 0, 80);
    sim.step();
    sim.step();
    const events = sim.events.filter((e) => e.event.type === 'bursts');
    expect(events.length).toBe(1);
    expect(events[0].to).toBe('all');
    expect(bursts(sim)[0].map(([s, ang]) => [s, ang >= 360])).toEqual([
      [a, false],
      [b, true],
    ]);
  });
});
