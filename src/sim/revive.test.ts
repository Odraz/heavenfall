import { describe, expect, it } from 'vitest';
import { BLESSED, CHORISTER } from '../data/enemies';
import { WEAPONS } from '../data/weapons';
import { decodeSnapshot } from '../net/protocol';
import { enemyAt, makeSim, press, put, room } from './testutil/sims';
import { REVIVE_DECAY, SOUL_RISE, SOUL_RISE_TIME } from './souls';

const RISE_TICKS = SOUL_RISE_TIME * 30;

/** A room where the shooter's eye is 2.1 m up: it stands on a 0.5 m step at the west end. */
function stepRoom(): string[] {
  const r = room(40, 10);
  for (let y = 1; y <= 10; y++) r[y] = '#' + '2'.repeat(4) + '0'.repeat(36) + '#';
  return r;
}

describe('souls and reviving (M8 §4)', () => {
  it('a soul rises to 1.0 m above its ground point over 1.5 s', () => {
    const sim = makeSim(room(20, 5), ['binder', 'heretic']);
    const dead = sim.players[1];
    put(sim, dead, 10.5, 3.5);
    sim.damagePlayer(dead, 10000);
    expect(sim.soulBase(dead)).toBe(0);
    for (let i = 0; i < RISE_TICKS / 2; i++) sim.step();
    expect(sim.soulBase(dead)).toBeGreaterThan(SOUL_RISE / 2);
    expect(sim.soulBase(dead)).toBeLessThan(SOUL_RISE);
    for (let i = 0; i < RISE_TICKS; i++) sim.step();
    expect(sim.soulBase(dead)).toBe(SOUL_RISE);
  });

  it('a shot at 2.1 m passes over a Blessed under the soul and hits the soul; it counts interval ÷ 3', () => {
    // The revolver has no spread, so the shot is exactly level.
    const sim = makeSim(stepRoom(), ['betrayer', 'heretic']);
    const [shooter, dead] = sim.players;
    put(sim, shooter, 2.5, 5.5);
    put(sim, dead, 20.5, 5.5);
    sim.damagePlayer(dead, 10000);
    for (let i = 0; i < RISE_TICKS; i++) sim.step();
    const blessed = enemyAt(sim, BLESSED, 20.5, 5.5);
    sim.root(blessed, 10);
    shooter.yaw = 0;
    shooter.pitch = 0;
    sim.fireWeapon(shooter);
    expect(sim.eHp[blessed]).toBe(20);
    expect(dead.revive).toBeCloseTo(WEAPONS.betrayer.interval / 3, 9);
  });

  it("a shot through a soul counts one hit and doesn't stop: it hits the enemy behind", () => {
    const sim = makeSim(room(40, 10), ['betrayer', 'binder']);
    const [shooter, dead] = sim.players;
    put(sim, shooter, 2.5, 5.5);
    put(sim, dead, 10.5, 5.5);
    sim.damagePlayer(dead, 10000);
    // Just fallen: the soul's cylinder is still on the ground, across the eye line.
    const behind = enemyAt(sim, CHORISTER, 20.5, 5.5);
    sim.root(behind, 10);
    sim.eRootUntil[behind] = 0;
    shooter.yaw = 0;
    shooter.pitch = 0;
    sim.fireWeapon(shooter);
    expect(dead.revive).toBeCloseTo(WEAPONS.betrayer.interval / 3, 9);
    // The revolver's 40 damage (M9 §2.3) reaches the Chorister behind the soul.
    expect(sim.eHp[behind]).toBe(20);
  });

  it("all of a shotgun's pellets count one hit", () => {
    const sim = makeSim(room(20, 10), ['fallen', 'binder']);
    const [fallen, dead] = sim.players;
    put(sim, fallen, 2.5, 5.5);
    put(sim, dead, 5.5, 5.5);
    sim.damagePlayer(dead, 10000);
    fallen.yaw = 0;
    fallen.pitch = 0;
    sim.fireWeapon(fallen);
    expect(dead.revive).toBeCloseTo(WEAPONS.fallen.interval / 3, 9);
  });

  it('the Heretic adds double, by a censer exploding on the soul', () => {
    const sim = makeSim(room(30, 10), ['heretic', 'binder']);
    const [heretic, dead] = sim.players;
    put(sim, heretic, 2.5, 5.5);
    put(sim, dead, 10.5, 5.5);
    sim.damagePlayer(dead, 10000);
    heretic.yaw = 0;
    heretic.pitch = 0;
    sim.fireWeapon(heretic);
    const before = dead.revive;
    for (let i = 0; i < 15; i++) sim.step();
    expect(sim.projectiles.length).toBe(0);
    // 2 × 1.0 s ÷ 3, less the decay over the flight.
    expect(dead.revive).toBeGreaterThan(before + (2 / 3) * 0.95);
    expect(dead.revive).toBeLessThanOrEqual(2 / 3);
  });

  it('a censer exploding within 2.5 m of a soul counts one hit on it', () => {
    const sim = makeSim(room(30, 10), ['binder', 'heretic', 'fallen']);
    const [, heretic, dead] = sim.players;
    put(sim, heretic, 2.5, 5.5);
    put(sim, dead, 10.5, 7.5);
    sim.damagePlayer(dead, 10000);
    const a = enemyAt(sim, CHORISTER, 10.5, 5.5);
    sim.root(a, 10);
    heretic.yaw = 0;
    heretic.pitch = 0;
    sim.fireWeapon(heretic);
    for (let i = 0; i < 15; i++) sim.step();
    expect(dead.revive).toBeGreaterThan(0.6);
  });

  it("the censer's incense cloud doesn't revive (M9 §2.8): after the break, progress only decays", () => {
    const sim = makeSim(room(30, 10), ['binder', 'heretic', 'fallen']);
    const [, heretic, dead] = sim.players;
    put(sim, heretic, 2.5, 5.5);
    put(sim, dead, 10.5, 7.5);
    sim.damagePlayer(dead, 10000);
    const a = enemyAt(sim, CHORISTER, 10.5, 5.5);
    sim.root(a, 10);
    heretic.yaw = 0;
    heretic.pitch = 0;
    sim.fireWeapon(heretic);
    while (sim.projectiles.length) sim.step();
    expect(sim.clouds).toHaveLength(1);
    let last = dead.revive;
    for (let i = 0; i < 4 * 30; i++) {
      sim.step();
      expect(dead.revive).toBeLessThanOrEqual(last);
      last = dead.revive;
    }
  });

  it('Unholy Communion adds 0.25 to souls within 15 m and nothing outside', () => {
    const sim = makeSim(room(40, 10), ['heretic', 'binder', 'fallen']);
    const [heretic, near, far] = sim.players;
    put(sim, heretic, 5.5, 5.5);
    put(sim, near, 15.5, 5.5);
    put(sim, far, 30.5, 5.5);
    sim.damagePlayer(near, 10000);
    sim.damagePlayer(far, 10000);
    press(heretic, 'Q');
    sim.step();
    expect(near.revive).toBeCloseTo(0.25 - REVIVE_DECAY / 30, 9);
    expect(far.revive).toBe(0);
    // Souls aren't healed: no target, no HP.
    expect(near.hp).toBe(0);
  });

  it('decays by 0.1 per second down to 0', () => {
    const sim = makeSim(room(20, 5), ['binder', 'heretic']);
    const dead = sim.players[1];
    sim.damagePlayer(dead, 10000);
    dead.revive = 0.3;
    for (let i = 0; i < 30; i++) sim.step();
    expect(dead.revive).toBeCloseTo(0.2, 9);
    for (let i = 0; i < 90; i++) sim.step();
    expect(dead.revive).toBe(0);
  });

  it('at 1 the player rises on the ground point with 50% HP, invulnerable for 2 s', () => {
    const sim = makeSim(room(20, 5), ['binder', 'heretic']);
    const dead = sim.players[1];
    put(sim, dead, 10.5, 3.5);
    sim.damagePlayer(dead, 10000);
    for (let i = 0; i < RISE_TICKS; i++) sim.step();
    sim.addRevive(dead, 1);
    expect(dead.dead).toBe(false);
    expect(dead.hp).toBe(75);
    expect(dead.revive).toBe(0);
    expect(sim.events).toContainEqual({ to: 'all', event: { type: 'playerRevived', playerId: 1 } });
    expect(sim.events).toContainEqual({ to: 1, event: expect.objectContaining({ type: 'teleport', x: 10.5, y: 3.5, z: 0 }) });
    sim.damagePlayer(dead, 50);
    expect(dead.hp).toBe(75);
    for (let i = 0; i < 61; i++) sim.step();
    sim.damagePlayer(dead, 50);
    expect(dead.hp).toBe(25);
  });

  it("a dead player can't shoot (so can't revive their own soul), and progress is in snapshots", () => {
    const sim = makeSim(room(20, 5), ['binder', 'heretic']);
    const [binder, heretic] = sim.players;
    sim.damagePlayer(binder, 10000);
    sim.applyInput(0, { seq: 1, x: binder.x, y: binder.y, z: 0, yaw: 0, pitch: 0, fire: 1, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 }, 0);
    sim.step();
    expect(binder.shots).toBe(0);
    binder.revive = 0.5;
    const snap = decodeSnapshot(sim.encodeFor(1)[0])!;
    expect(snap.players.find((p) => p.id === 0)!.revive).toBe(Math.round(0.5 * 255));
    expect(snap.players.find((p) => p.id === heretic.id)!.revive).toBe(0);
  });
});
