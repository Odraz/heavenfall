/** M12 stage 4: every class clears a stack, on the host (M12 §5, §11.1). */
import { describe, expect, it } from 'vitest';
import { BLESSED, CHORISTER, GATEKEEPER, ST_IDLE } from '../data/enemies';
import { ATTACK_PRIMARY, ATTACK_SECONDARY, WEAPONS } from '../data/weapons';
import { decodeSnapshot, FLAG_STUNNED, type InputMsg } from '../net/protocol';
import type { Simulation, SimPlayer } from './sim';
import { enemyAt, makeSim, press, put, room } from './testutil/sims';

const eventsOf = <T extends string>(sim: Simulation, type: T) =>
  sim.events.flatMap((e) => (e.event.type === type ? [e.event as Extract<typeof e.event, { type: T }>] : []));

/** Each burst slot this far: [angle (0–359), tier (1 light, 2 heavy)]. */
function burstsBySlot(sim: Simulation): Map<number, [number, number]> {
  sim.flushBursts();
  const out = new Map<number, [number, number]>();
  for (const e of eventsOf(sim, 'bursts')) for (let i = 0; i < e.list.length; i += 3) out.set(e.list[i], [e.list[i + 1] % 360, e.list[i + 1] >= 360 ? 2 : 1]);
  return out;
}

/** Holds an enemy in place: stunned enemies don't steer (M12 §5.3). */
const hold = (sim: Simulation, s: number) => (sim.eStunUntil[s] = 1e9);

describe('the shotgun (M12 §5.1)', () => {
  it('20 per pellet within 6 m and 10 beyond, ±11°, 0.9 s', () => {
    expect(WEAPONS.fallen).toMatchObject({ interval: 0.9, damage: 10, pellets: 8 });
    expect(WEAPONS.fallen.spreadYaw).toBeCloseTo((11 * Math.PI) / 180, 12);
    for (const [dist, perPellet] of [
      [5, 20],
      [8, 10],
    ]) {
      const sim = makeSim(room(30, 11), ['fallen']);
      const p = sim.players[0];
      put(sim, p, 5.5, 5.5);
      p.z = -0.8;
      sim.random = () => 0.5;
      const c = enemyAt(sim, CHORISTER, 5.5 + dist + 0.45, 5.5);
      sim.eHp[c] = 1000;
      sim.fireWeapon(p, ATTACK_PRIMARY);
      expect(sim.eHp[c]).toBe(1000 - 8 * perPellet);
    }
  });

  it('a pellet kills a Blessed at 5 m but not at 8 m', () => {
    // One pellet: the others fly wide above it.
    for (const [dist, dies] of [
      [5, true],
      [8, false],
    ] as const) {
      const sim = makeSim(room(30, 11), ['fallen']);
      const p = sim.players[0];
      put(sim, p, 5.5, 5.5);
      p.z = -0.8;
      let n = 0;
      // The first pellet's yaw and pitch on the aim; every other pellet's pitch +4°.
      sim.random = () => (n++ < 2 ? 0.5 : 1);
      const b = enemyAt(sim, BLESSED, 5.5 + dist + 0.35, 5.5);
      sim.fireWeapon(p, ATTACK_PRIMARY);
      expect(!sim.eAlive[b]).toBe(dies);
    }
  });
});

describe('Falling Star (M12 §5.2)', () => {
  it('is accepted without an ally: cooldown 10 s, invulnerable until it lands 15 ticks later; abilityUsed at the Fallen', () => {
    const sim = makeSim(room(40, 20), ['fallen']);
    const f = sim.players[0];
    put(sim, f, 5.5, 10.5);
    press(f, 'E');
    sim.step();
    const t0 = sim.tick;
    expect(f.cdE).toBe(10);
    expect(eventsOf(sim, 'abilityUsed')).toContainEqual(expect.objectContaining({ slot: 'E', x: 5.5, y: 10.5, targets: [] }));
    for (let i = 0; i < 14; i++) {
      sim.damagePlayer(f, 100);
      sim.step();
    }
    expect(f.hp).toBe(400);
    expect(eventsOf(sim, 'starLanded')).toEqual([]);
    sim.step();
    expect(sim.tick).toBe(t0 + 15);
    expect(eventsOf(sim, 'starLanded')).toHaveLength(1);
    sim.damagePlayer(f, 100);
    expect(f.hp).toBe(340);
  });

  it('names the ally it went to in targets, when valid', () => {
    const sim = makeSim(room(40, 20), ['fallen', 'binder']);
    const [f, b] = sim.players;
    put(sim, b, 20.5, 10.5);
    press(f, 'E', b.id);
    sim.step();
    expect(eventsOf(sim, 'abilityUsed')).toContainEqual(expect.objectContaining({ slot: 'E', targets: [b.id] }));
  });

  it('is accepted when the cooldown has 0.25 s or less remaining', () => {
    const sim = makeSim(room(30, 10), ['fallen']);
    const f = sim.players[0];
    f.cdE = 0.25 + 1 / 30;
    press(f, 'E');
    sim.step();
    expect(f.cdE).toBeCloseTo(10, 6);
    const sim2 = makeSim(room(30, 10), ['fallen']);
    sim2.players[0].cdE = 0.3 + 1 / 30;
    press(sim2.players[0], 'E');
    sim2.step();
    expect(sim2.players[0].cdE).toBeCloseTo(0.3, 6);
  });

  it('lands on the floor under the latest position: 40 within 3.5 m, 10 out to 6 m, bound 80 and 20; knockback within 6 m', () => {
    const sim = makeSim(room(40, 20), ['fallen']);
    const f = sim.players[0];
    put(sim, f, 5.5, 10.5);
    press(f, 'E');
    sim.step();
    // The client leaps; the host sees the reported position, here a late one still mid-arc.
    put(sim, f, 20.5, 10.5);
    f.z = 2.5;
    // Choristers (60 HP, radius 0.45): cylinders 3 m, 5 m and 7 m from the landing point.
    const at = (d: number, side: number) => enemyAt(sim, CHORISTER, 20.5 + (d + 0.45) * side, 10.5);
    const crater = at(3, 1);
    const reach = at(5, -1);
    const beyond = enemyAt(sim, CHORISTER, 20.5, 10.5 + 7.45);
    const boundCrater = enemyAt(sim, CHORISTER, 20.5, 10.5 + 3.45);
    const boundReach = enemyAt(sim, CHORISTER, 20.5, 10.5 - 5.45);
    for (const s of [crater, reach, beyond, boundCrater, boundReach]) hold(sim, s);
    for (let i = 0; i < 14; i++) sim.step();
    sim.root(boundCrater, 10);
    sim.root(boundReach, 10);
    sim.events.length = 0;
    sim.step();
    expect([sim.eHp[crater], sim.eHp[reach], sim.eHp[beyond], sim.eHp[boundReach]]).toEqual([20, 50, 60, 40]);
    expect(sim.eAlive[boundCrater]).toBe(0);
    const landed = eventsOf(sim, 'starLanded')[0];
    expect(landed).toMatchObject({ x: 20.5, y: 10.5, z: 0 });
    // Rooted enemies hold their piles.
    expect(landed.launched.sort()).toEqual([crater, reach].sort());
    expect(sim.eKbUntil[crater]).toBe(sim.tick + 12);
  });

  it('a crater kill bursts heavy, away from the landing point; a kill out in the reach is a normal death', () => {
    const sim = makeSim(room(40, 20), ['fallen']);
    const f = sim.players[0];
    put(sim, f, 20.5, 10.5);
    const crater = enemyAt(sim, BLESSED, 20.5, 12.5);
    const reach = enemyAt(sim, BLESSED, 25.5, 10.5);
    sim.eHp[reach] = 10;
    for (const s of [crater, reach]) hold(sim, s);
    press(f, 'E');
    for (let i = 0; i < 16; i++) sim.step();
    expect([sim.eAlive[crater], sim.eAlive[reach]]).toEqual([0, 0]);
    const b = burstsBySlot(sim);
    expect(b.get(crater)).toEqual([90, 2]);
    expect(b.has(reach)).toBe(false);
  });
});

describe('Blasphemy stuns (M12 §5.3)', () => {
  function taunted() {
    const sim = makeSim(room(40, 20), ['fallen']);
    const f = sim.players[0];
    put(sim, f, 20.5, 10.5);
    return { sim, f };
  }

  it('stuns every taunted enemy but the Gatekeeper for 1 s; FLAG_STUNNED is set exactly while stunned, the state idle', () => {
    const { sim, f } = taunted();
    const near = enemyAt(sim, BLESSED, 25.5, 10.5);
    const far = enemyAt(sim, BLESSED, 35.5, 10.5);
    const boss = enemyAt(sim, GATEKEEPER, 20.5, 16.5);
    press(f, 'Q');
    sim.step();
    const t0 = sim.tick;
    expect(sim.eStunUntil[near]).toBe(t0 + 30);
    expect(sim.eStunUntil[far]).toBe(0);
    expect(sim.eStunUntil[boss]).toBe(0);
    const flags = (slot: number) => {
      const s = decodeSnapshot(sim.encodeFor(0)[0])!;
      for (let i = 0; i < s.enemyCount; i++) if (s.enemySlot[i] === slot) return s.enemyFlags[i];
      return -1;
    };
    // The stun began on the tick it was set: the snapshot of that tick already has the flag.
    expect(flags(near) & FLAG_STUNNED).toBe(FLAG_STUNNED);
    expect(flags(far) & FLAG_STUNNED).toBe(0);
    const x0 = sim.eX[near];
    for (let i = 0; i < 29; i++) {
      sim.step();
      expect(flags(near) & FLAG_STUNNED).toBe(FLAG_STUNNED);
      expect(sim.eState[near]).toBe(ST_IDLE);
    }
    // It doesn't steer while stunned.
    expect(sim.eX[near]).toBe(x0);
    sim.step();
    expect(flags(near) & FLAG_STUNNED).toBe(0);
  });

  it("a stunned Blessed in range doesn't strike; its first strike afterwards needs 8 ticks in range", () => {
    const { sim, f } = taunted();
    const b = enemyAt(sim, BLESSED, 21.5, 10.5);
    // It strikes once (the 8th tick in range), then Blasphemy stuns it.
    for (let i = 0; i < 8; i++) sim.step();
    expect(f.hp).toBe(397);
    press(f, 'Q');
    sim.step();
    const until = sim.eStunUntil[b];
    while (sim.tick < until - 1) sim.step();
    expect(f.hp).toBe(397);
    expect(sim.eMeleeNext[b]).toBe(-1);
    // From the first tick not stunned, the strike lands on the 8th.
    for (let i = 0; i < 7; i++) sim.step();
    expect(f.hp).toBe(397);
    sim.step();
    expect(sim.tick).toBe(until + 7);
    expect(f.hp).toBe(394);
  });

  it("cancels a Chorister's wind-up; it casts nothing while stunned; knockback still moves it", () => {
    const { sim, f } = taunted();
    const c = enemyAt(sim, CHORISTER, 28.5, 10.5);
    sim.eLos[c] = 1;
    for (let i = 0; i < 40 && !sim.eCast[c]; i++) sim.step();
    expect(sim.eCast[c]).toBe(1);
    press(f, 'Q');
    sim.step();
    expect(sim.eCast[c]).toBe(0);
    sim.knockback(c, 1, 0, 2);
    for (let i = 0; i < 28; i++) {
      sim.step();
      expect(sim.eCast[c]).toBe(0);
    }
    expect(sim.eX[c]).toBeCloseTo(30.5, 5);
    expect(sim.projectiles).toHaveLength(0);
  });
});

describe('the Heretic (M12 §5.4)', () => {
  function cloudSim() {
    const sim = makeSim(room(30, 10), ['heretic']);
    const p = sim.players[0];
    put(sim, p, 2.5, 5.5);
    return { sim, p };
  }
  const cloud = (sim: Simulation, owner: SimPlayer, from: number) => sim.clouds.push({ x: 15.5, y: 5.5, z: 0, owner, from, until: from + 120 });

  it('censer 0.85 s', () => {
    expect(WEAPONS.heretic.interval).toBe(0.85);
  });

  it('an enemy in two clouds takes one pulse per 15 ticks', () => {
    const { sim, p } = cloudSim();
    const e = enemyAt(sim, CHORISTER, 15.5, 5.5);
    hold(sim, e);
    cloud(sim, p, sim.tick + 1);
    cloud(sim, p, sim.tick + 6);
    const hits: number[] = [];
    for (let i = 0; i < 60; i++) {
      const before = sim.eHp[e];
      sim.step();
      if (sim.eHp[e] < before) hits.push(sim.tick);
    }
    expect(hits.length).toBe(4);
    for (let i = 1; i < hits.length; i++) expect(hits[i] - hits[i - 1]).toBeGreaterThanOrEqual(15);
  });

  it('a Blessed staying in a cloud dies at 1.5 s (pulses at 0, 0.5, 1.0 and 1.5 s); bound, it takes 10 per pulse', () => {
    const { sim, p } = cloudSim();
    const b = enemyAt(sim, BLESSED, 15.5, 5.5);
    const c = enemyAt(sim, CHORISTER, 16.5, 5.5);
    hold(sim, b);
    hold(sim, c);
    sim.root(c, 10);
    const from = sim.tick + 1;
    cloud(sim, p, from);
    while (sim.tick < from + 44) sim.step();
    expect(sim.eAlive[b]).toBe(1);
    expect(sim.eHp[c]).toBe(60 - 30);
    sim.step();
    expect(sim.eAlive[b]).toBe(0);
    expect(p.kills).toBe(1);
  });

  it('the Shroud burst hits all of 20 Blessed within 3.5 m and none at 4 m, bursting them heavy away from its center', () => {
    const sim = makeSim(room(30, 30), ['heretic', 'binder']);
    const [h, b] = sim.players;
    put(sim, b, 15.5, 15.5);
    sim.giveShield(b, 150, 8, h);
    // Two rings of 10 (cylinders 1.65 m and 3.45 m away) and 4 whose cylinders are 4 m away.
    const ring = (n: number, d: number) => Array.from({ length: n }, (_, i) => enemyAt(sim, BLESSED, 15.5 + Math.cos((i / n) * 2 * Math.PI) * d, 15.5 + Math.sin((i / n) * 2 * Math.PI) * d));
    const inside = [...ring(10, 2), ...ring(10, 3.8)];
    const outside = ring(4, 4.35);
    sim.damagePlayer(b, 200);
    expect(inside.every((s) => !sim.eAlive[s])).toBe(true);
    expect(outside.every((s) => sim.eHp[s] === 20)).toBe(true);
    expect(h.kills).toBe(20);
    const bursts = burstsBySlot(sim);
    expect(bursts.get(inside[0])).toEqual([0, 2]);
    expect(bursts.get(inside[13])).toEqual([108, 2]);
  });
});

describe('the Scourge (M12 §5.5)', () => {
  it('hits all of 12 Blessed inside its arc, bursting each heavy', () => {
    const sim = makeSim(room(20, 20), ['binder']);
    const p = sim.players[0];
    put(sim, p, 10.5, 10.5, 0);
    const blessed = Array.from({ length: 12 }, (_, i) => {
      const a = ((i % 6) - 2.5) * 0.35;
      const d = i < 6 ? 1.2 : 2.4;
      return enemyAt(sim, BLESSED, 10.5 + Math.cos(a) * d, 10.5 + Math.sin(a) * d);
    });
    sim.fireWeapon(p, ATTACK_SECONDARY);
    expect(blessed.every((s) => !sim.eAlive[s])).toBe(true);
    const b = burstsBySlot(sim);
    expect(blessed.every((s) => b.get(s)?.[1] === 2)).toBe(true);
  });
});

describe('Shadowstep cuts (M12 §5.7)', () => {
  const input = (seq: number, x: number, ePresses: number, y = 5.5): InputMsg => ({ seq, x, y, z: 0, yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses, allyTargetId: 255, lastTeleportId: 0 });

  /** A Betrayer at (2.5, 5.5) dashing along +x: the press input, then one input per tick 1.33 m on, `n` in all. */
  function dash(sim: Simulation, n = 8, path = (k: number) => 2.5 + 0.8 + 1.33 * k) {
    const p = sim.players[0];
    put(sim, p, 2.5, 5.5);
    sim.applyInput(0, input(1, 2.5, 0), sim.nowMs);
    sim.step();
    for (let k = 0; k < n; k++) {
      sim.applyInput(0, input(2 + k, path(k), 1), sim.nowMs + 33);
      sim.step();
    }
    // Past the window's 15 ticks.
    for (let i = 0; i < 15; i++) sim.step();
    return p;
  }

  it('cuts enemies within 0.5 m of the path for 40, once per dash, credited to the Betrayer, bursting light along the dash; dashCut carries its ends', () => {
    const sim = makeSim(room(40, 12), ['betrayer']);
    // Blessed whose centers are 0.8 m and 1.2 m off the path; a Chorister on it (60 HP: it survives the one cut).
    const hit = enemyAt(sim, BLESSED, 6.5, 6.3);
    const miss = enemyAt(sim, BLESSED, 8.5, 6.7);
    const tough = enemyAt(sim, CHORISTER, 7.5, 5.5);
    for (const s of [hit, miss, tough]) hold(sim, s);
    const p = dash(sim);
    expect(sim.eAlive[hit]).toBe(0);
    expect(sim.eHp[miss]).toBe(20);
    expect(sim.eHp[tough]).toBe(20);
    expect(p.kills).toBe(1);
    expect(burstsBySlot(sim).get(hit)).toEqual([0, 1]);
    const cuts = eventsOf(sim, 'dashCut');
    expect(cuts).toHaveLength(1);
    expect(cuts[0]).toMatchObject({ playerId: 0, x0: 2.5, y0: 5.5 });
    expect(cuts[0].x1).toBeCloseTo(2.5 + 0.8 + 1.33 * 7, 6);
  });

  it('counts the positions of inputs up to the press + 9, not later ones', () => {
    const sim = makeSim(room(40, 12), ['betrayer']);
    // The 10th input after the press would reach it; the window has closed.
    const late = enemyAt(sim, BLESSED, 2.5 + 0.8 + 1.33 * 10, 5.5);
    const last = enemyAt(sim, BLESSED, 2.5 + 0.8 + 1.33 * 9, 5.5);
    hold(sim, late);
    hold(sim, last);
    dash(sim, 12);
    expect(sim.eAlive[last]).toBe(0);
    expect(sim.eHp[late]).toBe(20);
    expect(eventsOf(sim, 'dashCut')[0].x1).toBeCloseTo(2.5 + 0.8 + 1.33 * 9, 6);
  });

  it('skips a segment longer than 12 m', () => {
    const sim = makeSim(room(40, 12), ['betrayer']);
    const along = enemyAt(sim, BLESSED, 10.5, 5.5);
    hold(sim, along);
    dash(sim, 3, (k) => (k < 2 ? 2.8 + 0.5 * k : 18.5));
    expect(sim.eHp[along]).toBe(20);
  });

  it("a press that isn't accepted cuts nothing and sends no dashCut", () => {
    const sim = makeSim(room(40, 12), ['betrayer']);
    const e = enemyAt(sim, BLESSED, 4.5, 5.5);
    hold(sim, e);
    sim.players[0].cdE = 3;
    const p = dash(sim, 4, (k) => 2.8 + 0.8 * k);
    expect(sim.eHp[e]).toBe(20);
    expect(eventsOf(sim, 'dashCut')).toEqual([]);
    expect(p.dash).toBeNull();
  });
});
