import { describe, expect, it } from 'vitest';
import { CHERUB, CHORISTER, GATEKEEPER } from '../data/enemies';
import { decodeSnapshot, FLAG_TAUNTED } from '../net/protocol';
import { aimAt, enemyAt, makeSim, press, put, room } from './testutil/sims';

const usedEvents = (sim: ReturnType<typeof makeSim>) => sim.events.filter((e) => e.event.type === 'abilityUsed').map((e) => e.event);

describe('Blasphemy (Fallen Q)', () => {
  it('makes every enemy within 12 m target the Fallen for 5 s, then cools down 12 s', () => {
    const sim = makeSim(room(60, 10), ['fallen', 'binder']);
    const [fallen, binder] = sim.players;
    put(sim, fallen, 20.5, 5.5);
    put(sim, binder, 34.5, 5.5);
    const near = enemyAt(sim, CHORISTER, 32, 5.5); // 11.1 m from the Fallen, next to the Binder
    const far = enemyAt(sim, CHORISTER, 33.5, 5.5); // 12.6 m away
    for (const s of [near, far]) sim.root(s, 20);
    expect(sim.eTarget[near]).toBe(1);
    press(fallen, 'Q');
    sim.step();
    expect(sim.eTarget[near]).toBe(0);
    expect(sim.eTarget[far]).toBe(1);
    expect(fallen.cdQ).toBe(12);
    expect(usedEvents(sim)).toContainEqual(expect.objectContaining({ playerId: 0, slot: 'Q', x: 20.5, y: 5.5 }));
    // The 1 s re-evaluation keeps the Fallen while the taunt lasts.
    for (let i = 0; i < 140; i++) sim.step();
    expect(sim.eTarget[near]).toBe(0);
    for (let i = 0; i < 40; i++) sim.step();
    expect(sim.eTarget[near]).toBe(1);
  });

  it('ends when the Fallen dies (targeting)', () => {
    const sim = makeSim(room(60, 10), ['fallen', 'binder']);
    const [fallen, binder] = sim.players;
    put(sim, fallen, 20.5, 5.5);
    put(sim, binder, 40.5, 5.5);
    const a = enemyAt(sim, CHORISTER, 31.5, 5.5);
    sim.root(a, 20);
    press(fallen, 'Q');
    sim.step();
    expect(sim.eTarget[a]).toBe(0);
    sim.damagePlayer(fallen, 10000);
    sim.step();
    expect(sim.eTarget[a]).toBe(1);
    expect(sim.eTauntUntil[a]).toBe(0);
  });

  it('sets the taunted flag while its override lasts, and clears it after (M8 §10)', () => {
    const sim = makeSim(room(60, 10), ['fallen', 'binder']);
    const [fallen, binder] = sim.players;
    put(sim, fallen, 20.5, 5.5);
    put(sim, binder, 40.5, 5.5);
    const a = enemyAt(sim, CHORISTER, 30.5, 5.5);
    sim.root(a, 20);
    const taunted = () => {
      const snap = decodeSnapshot(sim.encodeFor(0)[0])!;
      return (snap.enemyFlags[Array.from(snap.enemySlot).indexOf(a)] & FLAG_TAUNTED) !== 0;
    };
    sim.step();
    expect(taunted()).toBe(false);
    press(fallen, 'Q');
    sim.step();
    expect(taunted()).toBe(true);
    for (let i = 0; i < 148; i++) sim.step();
    expect(taunted()).toBe(true);
    for (let i = 0; i < 2; i++) sim.step();
    expect(taunted()).toBe(false);
    // The Fallen dying ends it at once.
    fallen.cdQ = 0;
    press(fallen, 'Q');
    sim.step();
    expect(taunted()).toBe(true);
    sim.damagePlayer(fallen, 10000);
    sim.step();
    expect(taunted()).toBe(false);
  });

  it('is ignored while on cooldown', () => {
    const sim = makeSim(room(30, 10), ['fallen']);
    sim.players[0].cdQ = 1;
    press(sim.players[0], 'Q');
    sim.step();
    expect(usedEvents(sim)).toEqual([]);
  });
});

describe('Falling Star (Fallen E)', () => {
  it('does nothing without an ally target, and starts no cooldown', () => {
    const sim = makeSim(room(30, 10), ['fallen', 'binder']);
    press(sim.players[0], 'E');
    sim.step();
    expect(sim.players[0].cdE).toBe(0);
    expect(usedEvents(sim)).toEqual([]);
  });

  it('with an ally: cooldown, 0.4 s invulnerability, then 40 damage and a 4 m knockback within 5 m', () => {
    const sim = makeSim(room(40, 20), ['fallen', 'binder']);
    const [fallen, binder] = sim.players;
    put(sim, fallen, 5.5, 10.5);
    put(sim, binder, 20.5, 10.5);
    const near = enemyAt(sim, CHORISTER, 23.5, 10.5);
    const far = enemyAt(sim, CHORISTER, 30.5, 10.5);
    for (const s of [near, far]) sim.root(s, 20);
    press(fallen, 'E', binder.id);
    sim.step();
    expect(fallen.cdE).toBe(15);
    expect(usedEvents(sim)).toContainEqual(expect.objectContaining({ slot: 'E', x: 20.5, y: 10.5, targets: [1] }));
    // Invulnerable during the leap.
    sim.damagePlayer(fallen, 100);
    expect(fallen.hp).toBe(400);
    // The client leaps; the host only sees the reported position.
    put(sim, fallen, 20.5, 10.5);
    for (let i = 0; i < 11; i++) sim.step();
    expect(sim.eHp[near]).toBe(60);
    // Unbound for the landing, so its damage isn't doubled (M8 §8); they stand still while casting.
    for (const s of [near, far]) sim.eRootUntil[s] = 0;
    sim.step();
    expect(sim.eHp[near]).toBe(20);
    expect(sim.eHp[far]).toBe(60);
    // Knocked back 4 m away from the landing point (rooted again so it doesn't walk; it walked one
    // tick's step, 0.1 m, while unrooted).
    sim.root(near, 20);
    for (let i = 0; i < 8; i++) sim.step();
    expect(Math.abs(sim.eX[near] - 27.5)).toBeLessThanOrEqual(0.1 + 1e-6);
  });

  it('is accepted when the cooldown has 0.25 s or less remaining', () => {
    const sim = makeSim(room(30, 10), ['fallen', 'binder']);
    const [fallen, binder] = sim.players;
    fallen.cdE = 0.25 + 1 / 30;
    press(fallen, 'E', binder.id);
    sim.step(); // the cooldown drops to 0.25 before the press is resolved
    expect(fallen.cdE).toBeCloseTo(15, 6);
    const sim2 = makeSim(room(30, 10), ['fallen', 'binder']);
    sim2.players[0].cdE = 0.3 + 1 / 30;
    press(sim2.players[0], 'E', 1);
    sim2.step();
    expect(sim2.players[0].cdE).toBeCloseTo(0.3, 6);
  });
});

describe('Unholy Communion (Heretic Q)', () => {
  it('heals every living player within 15 m, including self, capped at max HP', () => {
    const sim = makeSim(room(40, 10), ['heretic', 'binder', 'betrayer', 'fallen']);
    const [heretic, near, far, dead] = sim.players;
    put(sim, heretic, 5.5, 5.5);
    put(sim, near, 15.5, 5.5);
    put(sim, far, 25.5, 5.5);
    put(sim, dead, 6.5, 5.5);
    heretic.hp = 100;
    near.hp = 50;
    far.hp = 50;
    sim.damagePlayer(dead, 10000);
    press(heretic, 'Q');
    sim.step();
    expect(heretic.hp).toBe(150);
    expect(near.hp).toBe(130);
    expect(far.hp).toBe(50);
    expect(dead.hp).toBe(0);
    expect(heretic.cdQ).toBe(4);
  });

  it('lists every player it healed in abilityUsed.targets, including those at full HP (M8 §10)', () => {
    const sim = makeSim(room(40, 10), ['heretic', 'binder', 'betrayer', 'fallen']);
    const [heretic, full, far, dead] = sim.players;
    put(sim, heretic, 5.5, 5.5);
    put(sim, full, 15.5, 5.5);
    put(sim, far, 25.5, 5.5);
    put(sim, dead, 6.5, 5.5);
    sim.damagePlayer(dead, 10000);
    expect(full.hp).toBe(full.maxHp);
    press(heretic, 'Q');
    sim.step();
    expect(usedEvents(sim)).toContainEqual(expect.objectContaining({ slot: 'Q', targets: [0, 1] }));
  });
});

describe("Martyr's Shroud (Heretic E)", () => {
  it('shields the ally target, or self without one, for 150 over 8 s', () => {
    const sim = makeSim(room(30, 10), ['heretic', 'binder']);
    const [heretic, binder] = sim.players;
    press(heretic, 'E', binder.id);
    sim.step();
    expect(binder.shield).toBe(150);
    expect(heretic.shield).toBe(0);
    expect(usedEvents(sim)).toContainEqual(expect.objectContaining({ slot: 'E', targets: [1] }));
    heretic.cdE = 0;
    press(heretic, 'E');
    sim.step();
    expect(heretic.shield).toBe(150);
  });

  it('falls back to self when the sent ally is no longer alive', () => {
    const sim = makeSim(room(30, 10), ['heretic', 'binder']);
    const [heretic, binder] = sim.players;
    sim.damagePlayer(binder, 10000);
    press(heretic, 'E', binder.id);
    sim.step();
    expect(heretic.shield).toBe(150);
    expect(binder.shield).toBe(0);
  });
});

describe('Chains of Tartarus (Binder Q)', () => {
  it('pulls enemies in a 30° cone within 20 m to 5 m ahead over 0.3 s, then roots them for 1.5 s; cooldown 8 s', () => {
    const sim = makeSim(room(40, 20), ['binder']);
    const p = sim.players[0];
    put(sim, p, 5.5, 10.5);
    const inCone = enemyAt(sim, CHORISTER, 20.5, 13.5); // ~11° off the aim
    const outside = enemyAt(sim, CHORISTER, 12.5, 18.5); // ~49° off
    const tooFar = enemyAt(sim, CHORISTER, 27.5, 10.5); // 21.5 m
    const flyer = enemyAt(sim, CHERUB, 15.5, 10.5, 4);
    const boss = enemyAt(sim, GATEKEEPER, 18.5, 10.5);
    expect(sim.chainsTargets(p).sort()).toEqual([inCone, flyer].sort());
    press(p, 'Q');
    sim.step();
    expect(usedEvents(sim)).toContainEqual(expect.objectContaining({ slot: 'Q', x: 10.5, y: 10.5, z: 0 }));
    for (let i = 0; i < 9; i++) sim.step();
    expect([sim.eX[inCone], sim.eY[inCone], sim.eZ[inCone]]).toEqual([10.5, 10.5, 0]);
    // Flyers keep their hover height.
    expect(sim.eZ[flyer]).toBe(4);
    expect(sim.eRootUntil[inCone]).toBe(sim.tick + 45);
    expect(sim.eX[boss]).toBe(18.5);
    expect(sim.ePullStart[outside]).toBe(-1);
    expect(sim.ePullStart[tooFar]).toBe(-1);
    expect(p.cdQ).toBeCloseTo(8 - 9 / 30, 6);
  });

  it('stops the destination before a wall', () => {
    const sim = makeSim(['##########', '#000000#0#', '#000000#0#', '##########'], ['binder']);
    const p = sim.players[0];
    put(sim, p, 2.5, 1.5);
    // The wall starts at x = 7: steps of 0.25 m from 2.5 reach 6.75 at most.
    expect(sim.chainsDestination(p)).toEqual([6.75, 1.5]);
  });

  it('stops the destination at a cliff, but drops down are allowed', () => {
    const sim = makeSim(['##########', '#00048888#', '#00048888#', '##########'], ['binder']);
    const p = sim.players[0];
    put(sim, p, 1.5, 1.5);
    // x 4 is 1 m up: blocked; the destination is the last point before it.
    expect(sim.chainsDestination(p)).toEqual([3.75, 1.5]);
    put(sim, p, 8.5, 1.5, Math.PI);
    p.z = 2;
    // Walking west from the 2 m plateau drops down freely, up to 5 m.
    const [x, y] = sim.chainsDestination(p);
    expect(x).toBeCloseTo(3.5, 6);
    expect(y).toBeCloseTo(1.5, 6);
  });

  it('ignores enemies behind walls', () => {
    const sim = makeSim(['############', '#000000#000#', '#000000#000#', '#000000#000#', '############'], ['binder']);
    const p = sim.players[0];
    put(sim, p, 2.5, 2.5);
    const hidden = enemyAt(sim, CHORISTER, 9.5, 2.5);
    const seen = enemyAt(sim, CHORISTER, 5.5, 2.5);
    expect(sim.chainsTargets(p)).toEqual([seen]);
    expect(hidden).toBeGreaterThanOrEqual(0);
  });
});

describe('Discord (Binder E)', () => {
  it('silences every enemy within 8 m of where the crosshair ray stops', () => {
    const sim = makeSim(room(50, 20), ['binder']);
    const p = sim.players[0];
    put(sim, p, 5.5, 10.5);
    const hit = enemyAt(sim, CHORISTER, 20.5, 10.5);
    const near = enemyAt(sim, CHORISTER, 25.5, 14.5);
    const far = enemyAt(sim, CHORISTER, 32.5, 10.5);
    for (const s of [hit, near, far]) sim.root(s, 20);
    aimAt(sim, p, hit);
    press(p, 'E');
    sim.step();
    expect(sim.eSilenceUntil[hit]).toBe(sim.tick + 120);
    expect(sim.eSilenceUntil[near]).toBe(sim.tick + 120);
    expect(sim.eSilenceUntil[far]).toBe(0);
    expect(p.cdE).toBe(12);
  });

  it('lands 40 m along the ray when it hits nothing, and still cools down', () => {
    const sim = makeSim(room(60, 10), ['binder']);
    const p = sim.players[0];
    put(sim, p, 2.5, 5.5);
    // Aim slightly up so the ray never meets the floor within 40 m.
    p.pitch = 0.01;
    press(p, 'E');
    sim.step();
    const e = usedEvents(sim)[0] as { x: number; y: number; z: number };
    expect(e.x).toBeCloseTo(2.5 + 40 * Math.cos(0.01), 5);
    expect(e.z).toBeCloseTo(1.6 + 40 * Math.sin(0.01), 5);
    expect(p.cdE).toBe(12);
  });
});

describe('Kiss of Betrayal (Betrayer Q)', () => {
  it('marks the crosshair target within 50 m for 6 s; a new mark replaces the old one', () => {
    const sim = makeSim(room(60, 10), ['betrayer']);
    const p = sim.players[0];
    put(sim, p, 2.5, 5.5);
    const a = enemyAt(sim, CHORISTER, 20.5, 5.5);
    const b = enemyAt(sim, CHORISTER, 30.5, 2.5);
    for (const s of [a, b]) sim.root(s, 20);
    aimAt(sim, p, a);
    press(p, 'Q');
    sim.step();
    expect(sim.markSlot).toBe(a);
    expect(sim.markUntil).toBe(sim.tick + 180);
    expect(p.cdQ).toBe(10);
    p.cdQ = 0;
    aimAt(sim, p, b);
    press(p, 'Q');
    sim.step();
    expect(sim.markSlot).toBe(b);
  });

  it('does nothing without a target, and starts no cooldown', () => {
    const sim = makeSim(room(80, 10), ['betrayer']);
    const p = sim.players[0];
    put(sim, p, 2.5, 5.5);
    const far = enemyAt(sim, CHORISTER, 60.5, 5.5); // beyond 50 m
    sim.root(far, 20);
    aimAt(sim, p, far);
    press(p, 'Q');
    sim.step();
    expect(sim.markSlot).toBe(-1);
    expect(p.cdQ).toBe(0);
  });
});

describe('Shadowstep (Betrayer E)', () => {
  it('is accepted within 0.25 s of ready: cooldown 6 s and 0.5 s of invulnerability', () => {
    const sim = makeSim(room(30, 10), ['betrayer', 'binder']);
    const p = sim.players[0];
    p.cdE = 0.2;
    press(p, 'E');
    sim.step();
    expect(p.cdE).toBeCloseTo(6, 6);
    expect(usedEvents(sim)).toContainEqual(expect.objectContaining({ playerId: 0, slot: 'E' }));
    // Invulnerable on the 15 ticks from the press (0.5 s).
    for (let i = 0; i < 15; i++) {
      sim.damagePlayer(p, 10);
      sim.step();
    }
    expect(p.hp).toBe(120);
    sim.damagePlayer(p, 10);
    expect(p.hp).toBe(110);
  });

  it('skips the speed check for 0.6 s', () => {
    const sim = makeSim(room(30, 10), ['betrayer']);
    const p = sim.players[0];
    put(sim, p, 2.5, 5.5);
    press(p, 'E');
    sim.step();
    const now = sim.nowMs;
    const input = { seq: 1, x: 10.5, y: 5.5, z: 0, yaw: 0, pitch: 0, fireHeld: false, qPresses: 0, ePresses: 1, allyTargetId: 255, lastTeleportId: 0 };
    p.lastAcceptMs = now;
    sim.applyInput(0, input, now + 100);
    expect(p.x).toBe(10.5);
  });
});

describe('ability presses from inputs', () => {
  it('treats any counter increase as one press and ignores presses while dead', () => {
    const sim = makeSim(room(30, 10), ['heretic', 'binder']);
    const p = sim.players[0];
    p.hp = 10;
    const base = { x: p.x, y: p.y, z: p.z, yaw: 0, pitch: 0, fireHeld: false, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 };
    sim.applyInput(0, { ...base, seq: 1, qPresses: 3 }, 0);
    sim.step();
    expect(p.hp).toBe(90);
    sim.damagePlayer(p, 1000);
    sim.applyInput(0, { ...base, seq: 2, qPresses: 4 }, 33);
    expect(p.pendingQ).toBe(false);
  });
});
