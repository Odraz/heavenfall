import { describe, expect, it, vi } from 'vitest';
import { BLESSED, CHERUB, CHORISTER, GATEKEEPER, ST_WINDUP } from '../data/enemies';
import { WEAPONS } from '../data/weapons';
import { PROJ_ORB } from './sim';
import { aimAt, enemyAt, makeSim, put, room } from './testutil/sims';

describe('damage pipeline (M9 §3.6)', () => {
  it('1: Bound doubles damage on a rooted enemy, and the killer gets the credit; Kiss is gone', () => {
    const sim = makeSim(room(20, 10), ['betrayer', 'binder']);
    const a = enemyAt(sim, CHORISTER, 10.5, 5.5);
    sim.damageEnemy(a, 10, 1);
    expect(sim.eHp[a]).toBe(50);
    sim.root(a, 6);
    sim.damageEnemy(a, 15, 1);
    expect(sim.eHp[a]).toBe(20);
    sim.damageEnemy(a, 10, 1); // 20 ≥ 20
    expect(sim.eAlive[a]).toBe(0);
    expect('mark' in sim || 'markSlot' in sim).toBe(false);
    expect(sim.players[1].kills).toBe(1);
    expect(sim.players[0].kills).toBe(0);
  });

  it('2: Brimstone Hide takes 40% off for the Fallen', () => {
    const sim = makeSim(room(20, 10), ['fallen', 'heretic']);
    sim.damagePlayer(sim.players[0], 100);
    expect(sim.players[0].hp).toBe(340);
    sim.damagePlayer(sim.players[1], 100);
    expect(sim.players[1].hp).toBe(50);
  });

  it('3: invulnerability makes it 0, before the shield is touched', () => {
    const sim = makeSim(room(20, 10), ['heretic']);
    const p = sim.players[0];
    sim.giveShield(p, 150, 8);
    p.devGod = true;
    sim.damagePlayer(p, 500);
    expect(p.shield).toBe(150);
    expect(p.hp).toBe(150);
  });

  it('4: the shield absorbs first, the remainder goes to HP', () => {
    const sim = makeSim(room(20, 10), ['fallen']);
    const p = sim.players[0];
    sim.giveShield(p, 10, 8);
    sim.damagePlayer(p, 50); // 30 after Brimstone Hide: 10 to the shield, 20 to HP
    expect(p.shield).toBe(0);
    expect(p.hp).toBe(380);
  });

  it('5: death at 0 HP', () => {
    const sim = makeSim(room(20, 10), ['heretic', 'binder']);
    const p = sim.players[0];
    sim.damagePlayer(p, 150);
    expect(p.dead).toBe(true);
    expect(sim.events.some((e) => e.event.type === 'playerDied' && e.event.playerId === 0)).toBe(true);
    // Dead players aren't hit, healed or shielded.
    sim.heal(p, 50);
    sim.giveShield(p, 150, 8);
    expect(p.hp).toBe(0);
    expect(p.shield).toBe(0);
  });

  it('healing is capped at max HP', () => {
    const sim = makeSim(room(20, 10), ['heretic']);
    const p = sim.players[0];
    p.hp = 100;
    sim.heal(p, 80);
    expect(p.hp).toBe(150);
  });

  it('a new shield replaces an existing one', () => {
    const sim = makeSim(room(20, 10), ['binder']);
    const p = sim.players[0];
    sim.giveShield(p, 150, 8);
    sim.damagePlayer(p, 100);
    expect(p.shield).toBe(50);
    sim.giveShield(p, 150, 8);
    expect(p.shield).toBe(150);
  });

  it('a shield expires after its duration', () => {
    const sim = makeSim(room(20, 10), ['binder']);
    const p = sim.players[0];
    sim.giveShield(p, 150, 8);
    for (let i = 0; i < 239; i++) sim.step();
    expect(p.shield).toBe(150);
    sim.step();
    expect(p.shield).toBe(0);
  });

  it('singleplayer regenerates 1.5% of max HP per second after 8 s without damage', () => {
    const sim = makeSim(room(20, 10), ['fallen'], { singleplayer: true });
    const p = sim.players[0];
    sim.step();
    sim.damagePlayer(p, 100 / 0.6); // 100 after Brimstone Hide
    expect(p.hp).toBeCloseTo(300);
    for (let i = 0; i < 239; i++) sim.step();
    expect(p.hp).toBeCloseTo(300);
    for (let i = 0; i < 31; i++) sim.step();
    // 1 s of regeneration: 6 HP.
    expect(p.hp).toBeCloseTo(306, 0);
    const multi = makeSim(room(20, 10), ['fallen', 'binder']);
    multi.damagePlayer(multi.players[0], 100);
    for (let i = 0; i < 300; i++) multi.step();
    expect(multi.players[0].hp).toBe(340);
  });
});

describe('status effects (§5.6)', () => {
  it('slow multiplies speed by 0.7 and re-applying refreshes it without stacking', () => {
    const sim = makeSim(room(40, 10), ['binder']);
    put(sim, sim.players[0], 38.5, 5.5);
    const a = enemyAt(sim, BLESSED, 3.5, 5.5);
    sim.step();
    const x0 = sim.eX[a];
    sim.slow(a, 1);
    sim.step();
    expect(sim.eX[a] - x0).toBeCloseTo((4 * 0.7) / 30, 6);
    sim.slow(a, 1); // refresh
    const x1 = sim.eX[a];
    sim.step();
    expect(sim.eX[a] - x1).toBeCloseTo((4 * 0.7) / 30, 6);
    expect(sim.eSlowUntil[a]).toBe(sim.tick - 1 + 30);
  });

  it("a rooted enemy can't move but can attack", () => {
    const sim = makeSim(room(20, 10), ['binder']);
    const p = sim.players[0];
    put(sim, p, 10.5, 5.5);
    const a = enemyAt(sim, BLESSED, 11.5, 5.5);
    sim.root(a, 5);
    for (let i = 0; i < 16; i++) sim.step();
    expect(sim.eX[a]).toBe(11.5);
    // 5 damage 0.5 s after entering range.
    expect(p.hp).toBe(195);
    for (let i = 0; i < 30; i++) sim.step();
    expect(p.hp).toBe(190);
  });

  it('silence cancels a wind-up, and a cast due during silence starts when it ends', () => {
    const sim = makeSim(room(30, 10), ['binder']);
    const p = sim.players[0];
    put(sim, p, 5.5, 5.5);
    const a = enemyAt(sim, CHORISTER, 15.5, 5.5);
    sim.eLos[a] = 1;
    sim.step();
    expect(sim.eCast[a]).toBe(1);
    expect(sim.eState[a]).toBe(ST_WINDUP);
    for (let i = 0; i < 10; i++) sim.step();
    sim.silence(a, 1);
    expect(sim.eCast[a]).toBe(0);
    const silenceEnd = sim.eSilenceUntil[a];
    while (sim.tick < silenceEnd - 1) {
      sim.step();
      expect(sim.eCast[a]).toBe(0);
    }
    sim.step();
    expect(sim.eCast[a]).toBe(1);
    expect(sim.eCastT[a]).toBe(0);
    // The wind-up starts from 0: the orb comes 1.0 s later.
    for (let i = 0; i < 29; i++) sim.step();
    expect(sim.projectiles.length).toBe(0);
    sim.step();
    expect(sim.projectiles.length).toBe(1);
    expect(sim.pKind[sim.projectiles[0]]).toBe(PROJ_ORB);
  });

  it('the Gatekeeper is immune to slow, root, pull and knockback, but can be silenced', () => {
    const sim = makeSim(room(30, 20), ['binder']);
    const g = enemyAt(sim, GATEKEEPER, 15.5, 10.5);
    sim.slow(g, 5);
    sim.root(g, 5);
    sim.pull(g, 5, 5, 0);
    sim.knockback(g, 1, 0, 4);
    sim.step();
    expect(sim.eSlowUntil[g]).toBe(0);
    expect(sim.eRootUntil[g]).toBe(0);
    expect(sim.ePullStart[g]).toBe(-1);
    expect(sim.eKbUntil[g]).toBe(0);
    expect([sim.eX[g], sim.eY[g]]).toEqual([15.5, 10.5]);
    sim.silence(g, 4);
    expect(sim.eSilenceUntil[g]).toBeGreaterThan(sim.tick);
  });

  it('knockback pushes over 0.2 s with collision, and ground enemies can fall off ledges', () => {
    const sim = makeSim(['##########', '#88800000#', '#88800000#', '#88800000#', '##########'], ['binder']);
    put(sim, sim.players[0], 8.5, 2.5);
    const a = enemyAt(sim, BLESSED, 2.5, 2.5, 2);
    sim.root(a, 10);
    sim.knockback(a, 1, 0, 4);
    sim.step();
    for (let i = 0; i < 30; i++) sim.step();
    expect(sim.eX[a]).toBeCloseTo(6.5, 5);
    expect(sim.eZ[a]).toBe(0);
  });
});

describe('combat (§5.3, §5.4, §6)', () => {
  it('hitscan stops at its range', () => {
    const sim = makeSim(room(70, 5), ['betrayer']);
    const p = sim.players[0];
    put(sim, p, 1.5, 3.5);
    const near = enemyAt(sim, BLESSED, 1.5 + 59.5, 3.5);
    const far = enemyAt(sim, BLESSED, 1.5 + 61.5, 2.5);
    sim.root(near, 10);
    sim.root(far, 10);
    expect(sim.rayEnemies(p.x, p.y, 1.6, 1, 0, 0, 60, 3)).toEqual([near]);
    aimAt(sim, p, far);
    expect(sim.rayEnemies(p.x, p.y, 1.6, Math.cos(p.yaw), Math.sin(p.yaw), 0, 60, 3)).toEqual([]);
  });

  it('the Silver Revolver hits only the first enemy for 60 (M9 §2.3); the Chain Gun stops at the first', () => {
    const sim = makeSim(room(30, 5), ['betrayer', 'binder']);
    const [b, c] = sim.players;
    put(sim, b, 1.5, 3.5);
    put(sim, c, 1.5, 3.5);
    const line = [5, 8, 11].map((x) => enemyAt(sim, CHORISTER, x + 0.5, 3.5));
    aimAt(sim, b, line[0]);
    sim.fireWeapon(b);
    // 60 kills a Chorister in one shot; the ones behind are untouched.
    expect(line.map((s) => sim.eAlive[s])).toEqual([0, 1, 1]);
    expect(line.map((s) => sim.eHp[s]).slice(1)).toEqual([60, 60]);
    expect(b.kills).toBe(1);
    // The Chain Gun hits only the nearest one still alive.
    const sim2 = makeSim(room(30, 5), ['binder']);
    put(sim2, sim2.players[0], 1.5, 3.5);
    const row = [5, 8].map((x) => enemyAt(sim2, CHORISTER, x + 0.5, 3.5));
    aimAt(sim2, sim2.players[0], row[0]);
    sim2.players[0].pitch = 0; // the chain gun's spread is random; a flat shot at chest height
    sim2.random = () => 0.5;
    sim2.fireWeapon(sim2.players[0]);
    expect(sim2.eHp[row[0]]).toBe(48);
    expect(sim2.eHp[row[1]]).toBe(60);
    expect(sim2.eSlowUntil[row[0]]).toBeGreaterThan(sim2.tick);
  });

  it('hit tests respect the height of the cylinders', () => {
    const sim = makeSim(room(20, 5), ['betrayer']);
    const p = sim.players[0];
    put(sim, p, 1.5, 3.5);
    const a = enemyAt(sim, BLESSED, 10.5, 3.5);
    // Blessed are 1.6 m tall: a flat ray at eye height (1.6 m) passes just over... at 1.65 m it misses.
    expect(sim.rayEnemies(p.x, p.y, 1.65, 1, 0, 0, 60, 1)).toEqual([]);
    expect(sim.rayEnemies(p.x, p.y, 1.55, 1, 0, 0, 60, 1)).toEqual([a]);
    // A Cherub hovers 4 m up: missed by a flat shot, hit by one aimed up at it.
    const c = enemyAt(sim, CHERUB, 15.5, 3.5);
    sim.removeEnemy(a);
    expect(sim.rayEnemies(p.x, p.y, 1.6, 1, 0, 0, 60, 1)).toEqual([]);
    aimAt(sim, p, c);
    const [dx, dy, dz] = [Math.cos(p.pitch) * Math.cos(p.yaw), Math.cos(p.pitch) * Math.sin(p.yaw), Math.sin(p.pitch)];
    expect(sim.rayEnemies(p.x, p.y, 1.6, dx, dy, dz, 60, 1)).toEqual([c]);
  });

  it('hitscan is stopped by walls', () => {
    const sim = makeSim(['###########', '#0000#0000#', '#0000#0000#', '###########'], ['betrayer']);
    const a = enemyAt(sim, BLESSED, 8.5, 1.5);
    expect(sim.rayEnemies(1.5, 1.5, 1, 1, 0, 0, 60, 1)).toEqual([]);
    expect(sim.rayEnemies(6.5, 1.5, 1, 1, 0, 0, 60, 1)).toEqual([a]);
  });

  it('projectiles are swept, so fast ones still hit', () => {
    const sim = makeSim(room(30, 5), ['binder']);
    const p = sim.players[0];
    put(sim, p, 20.5, 3.5);
    p.devGod = false;
    // 300 m/s: 10 m per tick, and the player is only 0.8 m wide.
    sim.spawnProjectile(PROJ_ORB, 2.5, 3.5, 1, 1, 0, 0, 300, 0.3, 12, 60, -1);
    sim.step();
    sim.step();
    expect(sim.projectiles.length).toBe(0);
    expect(p.hp).toBe(188);
  });

  it('projectiles are removed after 60 m and outside the grid', () => {
    const sim = makeSim(room(80, 5), ['binder']);
    put(sim, sim.players[0], 2.5, 1.5);
    const orb = sim.spawnProjectile(PROJ_ORB, 5.5, 4.5, 1, 1, 0, 0, 12, 0.3, 12, 60, -1);
    for (let i = 0; i < 149; i++) sim.step();
    expect(sim.pAlive[orb]).toBe(1);
    sim.step(); // 150 ticks × 0.4 m = 60 m
    expect(sim.pAlive[orb]).toBe(0);
    const high = sim.spawnProjectile(PROJ_ORB, 40.5, 3.5, 15.9, 0, 0, 1, 12, 0.3, 12, 60, -1);
    sim.step();
    expect(sim.pAlive[high]).toBe(0);
    const outside = sim.spawnProjectile(PROJ_ORB, -3, 3.5, 20, -1, 0, 0, 12, 0.3, 12, 60, -1);
    sim.step();
    expect(sim.pAlive[outside]).toBe(0);
  });

  it('at most 400 projectiles: one more removes the oldest', () => {
    const sim = makeSim(room(30, 5), ['binder']);
    const first = sim.spawnProjectile(PROJ_ORB, 2.5, 2.5, 1, 1, 0, 0, 0, 0.3, 12, 60, -1);
    for (let i = 0; i < 399; i++) sim.spawnProjectile(PROJ_ORB, 2.5, 2.5, 1, 1, 0, 0, 0, 0.3, 12, 60, -1);
    expect(sim.projectiles.length).toBe(400);
    sim.spawnProjectile(PROJ_ORB, 2.5, 2.5, 1, 1, 0, 0, 0, 0.3, 12, 60, -1);
    expect(sim.projectiles.length).toBe(400);
    expect(sim.pAlive[first]).toBe(0);
  });

  it('a held Chain Gun fires on ticks 0, 3, 5, 8, 10, … (12 per second), carrying fractions over; a revolver every 9 ticks', () => {
    // The revolver fires every 0.3 s = 9 ticks (M9 §2.3, retuned after review).
    const sim = makeSim(room(30, 5), ['binder', 'betrayer']);
    const [binder, betrayer] = sim.players;
    const shots: Array<[number, number]> = [];
    const spy = vi.spyOn(sim, 'fireWeapon').mockImplementation((p) => {
      shots.push([p.index, sim.tick]);
    });
    sim.step();
    const t0 = sim.tick + 1;
    binder.fire = 1;
    betrayer.fire = 1;
    for (let i = 0; i < 22; i++) sim.step();
    expect(shots.filter((s) => s[0] === 0).map((s) => s[1] - t0)).toEqual([0, 3, 5, 8, 10, 13, 15, 18, 20]);
    expect(shots.filter((s) => s[0] === 1).map((s) => s[1] - t0)).toEqual([0, 9, 18]);
    spy.mockRestore();
  });

  /** Steps until no projectile is left (the censer broke) and returns that tick. */
  function untilBroken(sim: ReturnType<typeof makeSim>): number {
    while (sim.projectiles.length) sim.step();
    return sim.tick;
  }

  it('the censer breaks on the first enemy: 40 to it and nothing to the others (M9 §2.8)', () => {
    const sim = makeSim(room(30, 5), ['heretic']);
    const p = sim.players[0];
    put(sim, p, 2.5, 3.5);
    const a = enemyAt(sim, CHORISTER, 10.5, 3.5);
    // The break point is about 0.65 m in front of a's center; b is 1.5 m from it, far 2.9 m.
    const b = enemyAt(sim, CHORISTER, 12, 3.5);
    const far = enemyAt(sim, CHORISTER, 13.2, 3.5);
    // Rooted, so they hold still, and bound: they take double damage.
    for (const s of [a, b, far]) sim.root(s, 10);
    aimAt(sim, p, a);
    sim.fireWeapon(p);
    const t = untilBroken(sim);
    expect(t % 15).not.toBe(0);
    expect(sim.eAlive[a]).toBe(0);
    expect(sim.eHp[b]).toBe(60);
    expect(sim.clouds).toHaveLength(1);
    // The cloud's first pulse: 2.5, doubled while bound; far is outside its 2.5 m.
    while (sim.tick % 15 !== 0) sim.step();
    expect(sim.eHp[b]).toBe(55);
    expect(sim.eHp[far]).toBe(60);
  });

  it('a cloud hurts every enemy within 2.5 m for 2.5 every 15th tick, 8 times, then is gone, and sets the hurt flag', () => {
    const sim = makeSim(room(30, 5), ['heretic']);
    const p = sim.players[0];
    put(sim, p, 2.5, 3.5);
    // Choristers stand still while their target is in range (decisions.md §7.1); unrooted, so not bound.
    const a = enemyAt(sim, CHORISTER, 10.5, 3.5);
    const b = enemyAt(sim, CHORISTER, 11.5, 2.4);
    aimAt(sim, p, a);
    sim.fireWeapon(p);
    untilBroken(sim);
    expect(sim.eHp[a]).toBe(20);
    expect(sim.eHp[b]).toBe(60);
    let pulses = 0;
    for (let i = 0; i < 6 * 30; i++) {
      const before = sim.eHp[b];
      sim.step();
      if (sim.eHp[b] < before) {
        pulses++;
        expect(sim.tick % 15).toBe(0);
        expect(before - sim.eHp[b]).toBe(2.5);
        expect(sim.eHurtTick[b]).toBe(sim.tick);
      }
    }
    expect(pulses).toBe(8);
    expect(sim.eHp[b]).toBe(40);
    // a died to the cloud's 8th pulse, credited to the Heretic.
    expect(sim.eAlive[a]).toBe(0);
    expect(p.kills).toBe(1);
    expect(sim.clouds).toHaveLength(0);
  });

  it("clouds don't stack, and at most 6 exist: a seventh replaces the oldest", () => {
    const sim = makeSim(room(30, 5), ['heretic']);
    const p = sim.players[0];
    put(sim, p, 2.5, 3.5);
    const a = enemyAt(sim, CHORISTER, 10.5, 3.5);
    const b = enemyAt(sim, CHORISTER, 11.5, 2.4);
    sim.eHp[a] = 10000;
    aimAt(sim, p, a);
    // Two censers in the same flight: two clouds over b.
    sim.fireWeapon(p);
    sim.fireWeapon(p);
    untilBroken(sim);
    expect(sim.clouds).toHaveLength(2);
    while (sim.tick % 15 !== 0) sim.step();
    expect(sim.eHp[b]).toBe(57.5);
    for (let i = 0; i < 5; i++) sim.fireWeapon(p);
    untilBroken(sim);
    expect(sim.clouds).toHaveLength(6);
    expect(sim.clouds.every((c) => c.from === sim.tick)).toBe(false);
    const newest = sim.clouds[5].from;
    expect(sim.clouds[0].from).toBeLessThan(newest);
  });

  it('the censer breaks after flying 25 m, leaving its cloud there', () => {
    const sim = makeSim(room(60, 5), ['heretic']);
    const p = sim.players[0];
    put(sim, p, 2.5, 3.5);
    const at25 = enemyAt(sim, CHORISTER, 2.5 + 25 + 1.2, 2);
    sim.root(at25, 10);
    p.pitch = 0;
    sim.fireWeapon(p);
    untilBroken(sim);
    expect(sim.clouds).toHaveLength(1);
    expect(sim.clouds[0].x).toBeCloseTo(27.5, 5);
    expect(sim.eHp[at25]).toBe(60);
    while (sim.tick % 15 !== 0) sim.step();
    // A pulse, doubled while bound.
    expect(sim.eHp[at25]).toBe(55);
  });
});

describe('enemy attacks (§7.1)', () => {
  it('Cherubs strafe and cast arrows: 0.5 s wind-up, next cast 1.3 s after firing', () => {
    const sim = makeSim(room(30, 20), ['fallen']);
    const p = sim.players[0];
    put(sim, p, 5.5, 10.5);
    const c = enemyAt(sim, CHERUB, 20.5, 10.5, 4);
    sim.eLos[c] = 1;
    const fired: number[] = [];
    let last = 0;
    let maxSideways = 0;
    for (let i = 0; i < 120; i++) {
      sim.step();
      maxSideways = Math.max(maxSideways, Math.abs(sim.eY[c] - 10.5));
      if (sim.projectiles.length > last) fired.push(sim.tick);
      last = sim.projectiles.length;
    }
    expect(fired.length).toBeGreaterThanOrEqual(2);
    expect(fired[1] - fired[0]).toBe(39 + 15);
    // It strafes sideways at 2 m/s, switching direction every 2 s.
    expect(maxSideways).toBeGreaterThan(3.5);
  });

  it('Blessed melee resets when the target leaves range', () => {
    const sim = makeSim(room(20, 10), ['binder']);
    const p = sim.players[0];
    put(sim, p, 10.5, 5.5);
    const a = enemyAt(sim, BLESSED, 11.5, 5.5);
    sim.root(a, 10);
    for (let i = 0; i < 10; i++) sim.step();
    put(sim, p, 15.5, 5.5);
    sim.step();
    put(sim, p, 10.5, 5.5);
    for (let i = 0; i < 14; i++) sim.step();
    expect(p.hp).toBe(200);
    sim.step();
    expect(p.hp).toBe(195);
  });
});

describe('defeat (§5.7)', () => {
  it('is a defeat when all connected players are dead at the same time', () => {
    const sim = makeSim(room(20, 10), ['heretic', 'binder']);
    sim.damagePlayer(sim.players[0], 1000);
    sim.step();
    expect(sim.result).toBeNull();
    sim.damagePlayer(sim.players[1], 1000);
    sim.step();
    expect(sim.result).toBe('defeat');
    const over = sim.events.find((e) => e.event.type === 'gameOver');
    expect(over?.event).toMatchObject({ type: 'gameOver', result: 'defeat', kills: { 0: 0, 1: 0 } });
    // The simulation stops.
    const t = sim.tick;
    sim.step();
    expect(sim.tick).toBe(t);
  });

  it('god mode keeps players alive', () => {
    const sim = makeSim(room(20, 10), ['heretic'], { god: true });
    sim.damagePlayer(sim.players[0], 1000);
    expect(sim.players[0].dead).toBe(false);
  });
});

describe('balance (M8 §8)', () => {
  it('Bound doubles damage on rooted enemies', () => {
    const sim = makeSim(room(30, 5), ['binder']);
    const a = enemyAt(sim, CHORISTER, 10.5, 3.5);
    sim.damageEnemy(a, 5, -1);
    expect(sim.eHp[a]).toBe(55);
    sim.root(a, 5);
    sim.damageEnemy(a, 5, -1);
    expect(sim.eHp[a]).toBe(45);
  });

  it('Bound includes the 0.3 s pull', () => {
    const sim = makeSim(room(30, 5), ['binder']);
    const a = enemyAt(sim, CHORISTER, 10.5, 3.5);
    sim.pull(a, 12.5, 3.5, 0);
    sim.damageEnemy(a, 5, -1);
    expect(sim.eHp[a]).toBe(50);
  });

  it('the Gatekeeper is never bound', () => {
    const sim = makeSim(room(30, 5), ['binder']);
    const g = enemyAt(sim, GATEKEEPER, 15.5, 3.5);
    sim.root(g, 5);
    sim.damageEnemy(g, 100, -1);
    expect(sim.eHp[g]).toBe(29000 - 100);
  });

  it('the shotgun fires 8 pellets of 12 every 0.8 s', () => {
    expect(WEAPONS.fallen).toMatchObject({ pellets: 8, damage: 12, interval: 0.8 });
  });
});
