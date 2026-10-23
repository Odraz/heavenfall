/** The authored Gatekeeper (rogue bosses.md §3) on the pinned floor's Gate room: schedule, moves, parts and gates. */
import { describe, expect, it } from 'vitest';
import type { ClassId } from '../data/classes';
import { BOSS_PART, GATEKEEPER } from '../data/enemies';
import {
  BOSS_CAST_CALL, BOSS_CAST_JUDGMENT, BOSS_CAST_TOLL, BOSS_CAST_VOLLEY, BOSS_FLAG_DEFERRED, BOSS_PHASE_INVULNERABLE, bossFactor,
  C_CALL, C_JUDGMENT, C_TOLL_1, C_TOLL_2, C_VOLLEYS, C_WATCHERS, CYCLE_TICKS, HOLD_TICKS, RING_SPEED, RING_START, TOLL_DAMAGE,
  WATCHER_GAZE,
} from '../data/gatekeeper';
import { PEARLY_POOL } from '../data/rooms/1';
import { generateFloor } from '../gen';
import { PINNED } from '../gen/pinned';
import type { GameEvent } from '../net/messages';
import { decodeSnapshot } from '../net/protocol';
import { PLAYER_EYE, TICK_HZ } from './constants';
import { lineOfSight } from './los';
import { PROJ_GLOBE, Simulation, type SimPlayer } from './sim';
import { openBossGate, sealNow } from './testutil/sims';

const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
const BOSS = g.floor.boss;

function fight(classes: ClassId[] = ['binder'], opts: { edicts?: number[]; bots?: number[] } = {}): Simulation {
  const sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 7, startRoom: BOSS, edicts: opts.edicts,
    players: classes.map((classId, id) => ({ id, name: `P${id}`, classId, bot: opts.bots?.includes(id) })) });
  sim.step();
  sealNow(sim, BOSS);
  expect(sim.bossSlot).toBeGreaterThanOrEqual(0);
  return sim;
}

const base = (sim: Simulation) => { const [c, r] = sim.map.rooms[BOSS].points!.reward!; return sim.map.floor[(r + 1) * sim.map.w + c + 1]; };
const eye = (sim: Simulation): [number, number, number] => [sim.eX[sim.bossSlot], sim.eY[sim.bossSlot], sim.eyeZ(sim.bossSlot)];

/** Base-floor cells of the boss room matching `pred`, nearest the room's center first. */
function cells(sim: Simulation, pred: (x: number, y: number, z: number) => boolean): Array<[number, number, number]> {
  const { rect } = sim.map.rooms[BOSS], b = base(sim), out: Array<[number, number, number, number]> = [];
  const cx = (rect.x0 + rect.x1) / 2, cy = (rect.y0 + rect.y1) / 2;
  for (let r = rect.y0 + 2; r <= rect.y1 - 2; r++) for (let c = rect.x0 + 2; c <= rect.x1 - 2; c++) {
    const i = r * sim.map.w + c;
    if (sim.map.solid[i] || sim.map.floor[i] !== b) continue;
    // A whole 3×3 block of base floor, so a 0.4 m body fits with no ledge.
    let flat = true;
    for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const j = (r + dr) * sim.map.w + c + dc; if (sim.map.solid[j] || sim.map.floor[j] !== b) flat = false; }
    if (flat && pred(c + 0.5, r + 0.5, b)) out.push([c + 0.5, r + 0.5, b, Math.hypot(c - cx, r - cy)]);
  }
  return out.sort((a, b2) => a[3] - b2[3]).map(([x, y, z]) => [x, y, z]);
}
const seen = (sim: Simulation) => (x: number, y: number, z: number) => lineOfSight(sim.map, x, y, z + PLAYER_EYE, ...eye(sim));
const hidden = (sim: Simulation) => (x: number, y: number, z: number) => !seen(sim)(x, y, z);

function put(p: SimPlayer, [x, y, z]: [number, number, number]): void { p.x = x; p.y = y; p.z = z; }

/** Steps to `tick` with the adds, projectiles and the Call kept away, and players optionally invulnerable. */
function runTo(sim: Simulation, tick: number, opts: { god?: boolean; adds?: boolean; calls?: boolean } = {}): void {
  while (sim.tick < tick) {
    for (const p of sim.players) p.devGod = opts.god ?? true;
    sim.step();
    if (!opts.adds) {
      sim.rooms[BOSS].queue.length = 0;
      for (let k = sim.activeCount - 1; k >= 0; k--) { const s = sim.active[k]; if (sim.eType[s] !== GATEKEEPER && sim.eType[s] !== BOSS_PART) sim.removeEnemy(s, true); }
      sim.clearHostileProjectiles();
    }
    if (!opts.calls && sim.boss.hold) sim.boss.release(false);
  }
  for (const p of sim.players) p.devGod = false;
}
const start = (sim: Simulation) => sim.boss.cycleStart;
function events<T extends GameEvent['type']>(sim: Simulation, type: T): Array<Extract<GameEvent, { type: T }>> {
  return sim.events.flatMap((e) => (e.event.type === type ? [e.event as Extract<GameEvent, { type: T }>] : []));
}

describe('the Gatekeeper: scaling (bosses.md §3.4.1)', () => {
  it('interpolates f(P) and fixes HP, the add cap and the break at the seal', () => {
    expect([1, 1.5, 2, 2.5, 3, 3.5, 4].map((p) => +bossFactor(p).toFixed(4))).toEqual([0.3, 0.425, 0.55, 0.665, 0.78, 0.89, 1]);
    expect(52000 * bossFactor(3.5)).toBeCloseTo(46280, 6);
    const solo = fight();
    expect(solo.eHp[solo.bossSlot]).toBeCloseTo(15600, 6);
    expect(solo.boss.addCap).toBe(100);
    const assisted = fight(['binder', 'fallen'], { bots: [1] });
    expect(assisted.bossMaxHp).toBeCloseTo(22100, 6);
    expect(assisted.boss.addCap).toBe(125);
  });

  it('queues the seal wave on the field points and the Host on the gate points, scaled by f(P)', () => {
    const sim = fight();
    const def = sim.map.rooms[BOSS], markers = sim.map.roomSpawnPoints[BOSS];
    const index = (cells: Array<[number, number]>) => new Set(cells.map(([c, r]) => markers.findIndex(([x, y]) => x === c && y === r)));
    const seal = sim.rooms[BOSS].queue.find((b) => b.boss === 'seal')!;
    expect(seal.counts).toEqual([0, 2, 2, 0]);
    expect([...seal.only!]).toEqual([...index(def.points!.addSpawns!.field)]);
    while (sim.tick < start(sim) + 31) sim.step();
    const host = sim.rooms[BOSS].queue.find((b) => b.boss === 'host')!;
    expect(host.counts).toEqual([36, 0, 2, 0]);
    expect([...host.only!]).toEqual([...index(def.points!.addSpawns!.gate)]);
    // Arriving over 6 s: about a fifth of it after the first 1.2 s.
    const blessedOnGate = () => { let n = 0; for (let k = 0; k < sim.activeCount; k++) { const s = sim.active[k]; if (sim.eType[s] === 0) n++; } return n; };
    for (const p of sim.players) p.devGod = true;
    while (sim.tick < start(sim) + 30 + 36) sim.step();
    expect(blessedOnGate()).toBeGreaterThan(0);
    expect(blessedOnGate()).toBeLessThanOrEqual(10);
  });
});

describe('the rewards of the adds (bosses.md §3.4)', () => {
  it('boss adds drop at most eight heal motes in the whole fight', () => {
    const sim = fight();
    expect(Array.from({ length: 12 }, () => sim.boss.takeMote()).filter(Boolean)).toHaveLength(8);
  });
});

describe('the cycle (bosses.md §3.2.1)', () => {
  it('runs the Call at c 4, the Tolls at c 8 and c 15 and Judgment at c 25, resolving at c 28', () => {
    const sim = fight(['binder', 'betrayer']);
    const s0 = start(sim);
    // A Volley winding up from its c 3 attempt may hold the slot for its last tick.
    runTo(sim, s0 + C_CALL + 2);
    expect(sim.bossCast).toBe(BOSS_CAST_CALL);
    runTo(sim, s0 + C_TOLL_1);
    expect(sim.bossCast).toBe(BOSS_CAST_TOLL);
    runTo(sim, s0 + C_TOLL_2);
    expect(sim.bossCast).toBe(BOSS_CAST_TOLL);
    runTo(sim, s0 + C_JUDGMENT);
    expect(sim.bossCast).toBe(BOSS_CAST_JUDGMENT);
    runTo(sim, s0 + CYCLE_TICKS);
    expect(start(sim)).toBe(s0 + CYCLE_TICKS);
    expect(sim.boss.judgmentsResolved).toBe(1);
  });

  it('winds a Volley up for 1 s at its c 3 attempt when he sees his target; a busy attempt is skipped', () => {
    const sim = fight();
    put(sim.players[0], cells(sim, seen(sim))[0]);
    sim.retarget(sim.bossSlot);
    runTo(sim, start(sim) + C_VOLLEYS[0]);
    sim.eLos[sim.bossSlot] = 1;
    runTo(sim, start(sim) + C_VOLLEYS[0] + 1);
    expect(sim.bossCast).toBe(BOSS_CAST_VOLLEY);
    runTo(sim, start(sim) + C_VOLLEYS[0] + 30, { adds: true });
    expect(sim.projectiles.filter((s) => sim.pKind[s] === PROJ_GLOBE).length).toBe(8);
  });

  it('a volley hurts one player at most once, however many of its globes hit', () => {
    const sim = fight();
    const p = sim.players[0];
    put(p, cells(sim, seen(sim))[0]);
    const s = sim.bossSlot;
    sim.eTarget[s] = 0; sim.eLos[s] = 1;
    runTo(sim, start(sim) + C_VOLLEYS[0] + 31, { adds: true });
    const globes = sim.projectiles.filter((g2) => sim.pKind[g2] === PROJ_GLOBE);
    expect(globes.length).toBe(8);
    // Every globe at the player's body: one 15-damage hit.
    for (const g2 of globes) { sim.pX[g2] = p.x - 0.5; sim.pY[g2] = p.y; sim.pZ[g2] = p.z + 1; }
    const hp = p.hp;
    sim.step();
    expect(hp - p.hp).toBe(15);
  });
});

describe('Judgment (bosses.md §3.3.3)', () => {
  it('kills whoever sees him through Brimstone Hide and a shield, spares the hidden and the invulnerable', () => {
    const sim = fight(['fallen', 'heretic', 'binder', 'betrayer']);
    const [fallen, shielded, hiddenP, invul] = sim.players;
    runTo(sim, start(sim) + C_JUDGMENT + 80);
    const vis = cells(sim, seen(sim)), hid = cells(sim, hidden(sim));
    put(fallen, vis[0]); put(shielded, vis[1]); put(hiddenP, hid[0]); put(invul, vis[2]);
    shielded.shield = 60; shielded.shieldUntil = sim.tick + 300;
    invul.invulUntil = sim.tick + 30;
    runTo(sim, start(sim) + CYCLE_TICKS + 1, { god: false });
    expect([fallen.dead, shielded.dead, hiddenP.dead, invul.dead]).toEqual([true, true, false, false]);
    expect(invul.hp).toBe(invul.maxHp);
    expect(events(sim, 'judged').map((e) => e.playerId).sort()).toEqual([0, 1]);
  });

  it('breaks at 4.5% of max HP during the cast, and on Discord silence', () => {
    for (const how of ['damage', 'silence'] as const) {
      const sim = fight();
      runTo(sim, start(sim) + C_JUDGMENT + 10);
      expect(sim.bossCast).toBe(BOSS_CAST_JUDGMENT);
      const brk = 0.045 * sim.bossMaxHp;
      if (how === 'damage') {
        sim.damageEnemy(sim.bossSlot, brk - 1, 0);
        expect(sim.bossCast).toBe(BOSS_CAST_JUDGMENT);
        expect(decodeSnapshot(sim.encodeFor(0)[0])!.bossBreak).toBeGreaterThan(250);
        sim.damageEnemy(sim.bossSlot, 1, 0);
      } else { sim.silence(sim.bossSlot, 4); sim.step(); }
      expect(sim.bossCast).not.toBe(BOSS_CAST_JUDGMENT);
      // A broken cast costs nothing: the visible player survives c 28, and the schedule holds.
      put(sim.players[0], cells(sim, seen(sim))[0]);
      const s0 = start(sim);
      runTo(sim, s0 + CYCLE_TICKS + 1, { god: false });
      expect(sim.players[0].dead).toBe(false);
      expect(start(sim)).toBe(s0 + CYCLE_TICKS);
    }
  });

  it('judges a lagging player where their own screen saw it end (view-time resolution)', () => {
    const sim = fight();
    const p = sim.players[0];
    runTo(sim, start(sim) + C_JUDGMENT + 85);
    put(p, cells(sim, seen(sim))[0]);
    const end = start(sim) + CYCLE_TICKS;
    // The player's screen draws 8 ticks behind the host: at the host's c 28 it hasn't seen the end yet.
    const lag = 8;
    while (sim.tick < end + 4) { p.view = { tick: sim.tick - lag, gap: 0, frac: 0 }; sim.step(); }
    expect(p.dead).toBe(false);
    // It ducks behind cover before its screen reaches the end: spared.
    put(p, cells(sim, hidden(sim))[0]);
    while (sim.tick < end + lag + 2) { p.view = { tick: sim.tick - lag, gap: 0, frac: 0 }; sim.step(); }
    expect(p.dead).toBe(false);
  });
});

describe('the Toll (bosses.md §3.3.1)', () => {
  it('hits a grounded player once as its front passes, and misses one whose feet are 0.5 m up', () => {
    for (const jumping of [false, true]) {
      const sim = fight();
      const p = sim.players[0];
      const [x, y, z] = cells(sim, () => true)[0];
      runTo(sim, start(sim) + C_TOLL_1 + 45);
      expect(sim.boss.tollTick()).toBe(sim.tick);
      put(p, [x, y, z]);
      const d = Math.hypot(x - sim.eX[sim.bossSlot], y - sim.eY[sim.bossSlot]);
      const arrive = sim.tick + Math.ceil((d - 0.4 - RING_START) / RING_SPEED * TICK_HZ);
      while (sim.tick < arrive + 8) { if (jumping) p.z = z + 0.6; else p.z = z; sim.step(); }
      expect(p.maxHp - p.hp).toBe(jumping ? 0 : TOLL_DAMAGE);
    }
  });

  it('passes under the +2 m gallery and a held player', () => {
    const sim = fight(['binder', 'betrayer']);
    const b = base(sim);
    const gallery = (() => {
      const { rect } = sim.map.rooms[BOSS];
      for (let r = rect.y0; r <= rect.y1; r++) for (let c = rect.x0; c <= rect.x1; c++) {
        const i = r * sim.map.w + c;
        if (!sim.map.solid[i] && Math.abs(sim.map.floor[i] - (b + 2)) < 1e-6 && !sim.map.solid[i + 1] && sim.map.floor[i + 1] === sim.map.floor[i]) return [c + 0.9, r + 0.5, sim.map.floor[i]] as [number, number, number];
      }
      throw new Error('no gallery');
    })();
    runTo(sim, start(sim) + C_TOLL_1 + 45);
    put(sim.players[0], gallery);
    while (sim.tick < start(sim) + C_TOLL_1 + 45 + 7 * TICK_HZ) sim.step();
    expect(sim.players[0].hp).toBe(sim.players[0].maxHp);
  });
});

describe('Called to the Gate (bosses.md §3.3)', () => {
  it('holds a target, scales its Seal to the living, frees it when the Seal breaks', () => {
    const sim = fight(['binder', 'betrayer', 'heretic']);
    runTo(sim, start(sim) + C_CALL + 31, { calls: true });
    const h = sim.boss.hold!;
    expect(h).toBeTruthy();
    expect(sim.eType[h.seal]).toBe(BOSS_PART);
    expect(sim.eHp[h.seal]).toBe(450);
    const held = sim.playerById(h.playerId)!;
    const x0 = held.x, y0 = held.y;
    // A teammate dies: the Seal shrinks to the new low-water headcount.
    const other = sim.players.find((p) => p.id !== h.playerId)!;
    sim.damagePlayer(other, 1e6);
    sim.step();
    expect(sim.eHp[h.seal]).toBeCloseTo(300, 6);
    // Dragged toward him at 2.5 m/s.
    expect(Math.hypot(held.x - x0, held.y - y0)).toBeGreaterThan(0.05);
    const snap = decodeSnapshot(sim.encodeFor(0)[0])!;
    expect(snap.heldPlayer).toBe(h.playerId);
    expect(snap.enemyFlags[[...snap.enemySlot].indexOf(h.seal)] & 128).toBe(128);
    sim.damageEnemy(h.seal, 1000, 0);
    expect(sim.boss.hold).toBeNull();
    expect(sim.boss.callResolved).toBe(true);
    expect(events(sim, 'sealBroken')).toHaveLength(1);
    expect(sim.players[0].kills).toBe(0);
  });

  it('heals him 10% of max HP when the hold runs out, harmlessly for the held player', () => {
    const sim = fight();
    runTo(sim, start(sim) + C_CALL + 31, { calls: true });
    const s = sim.bossSlot;
    sim.damageEnemy(s, 3000, 0);
    const hp = sim.eHp[s];
    const p = sim.players[0], before = p.hp;
    runTo(sim, sim.boss.hold!.until + 1, { calls: true, god: false });
    expect(sim.eHp[s]).toBeCloseTo(hp + 0.1 * sim.bossMaxHp, 6);
    expect(p.hp).toBe(before);
    expect(sim.boss.hold).toBeNull();
  });

  it('refuses movement while held but takes aim and fire', () => {
    const sim = fight(['betrayer']);
    runTo(sim, start(sim) + C_CALL + 31, { calls: true });
    const p = sim.players[0], x = p.x;
    sim.applyInput(0, { ...input(p, 1), x: x + 3 }, sim.nowMs + 33);
    expect(p.x).toBe(x);
    expect(p.yaw).toBe(1.25);
    expect(p.fire).toBe(1);
  });

  it('a taunted Gatekeeper calls the Fallen', () => {
    const sim = fight(['binder', 'fallen', 'betrayer']);
    runTo(sim, start(sim) + C_CALL - 1);
    sim.eTauntUntil[sim.bossSlot] = sim.tick + 60;
    runTo(sim, start(sim) + C_CALL + 1, { calls: true });
    expect(sim.boss.cast?.target).toBe(1);
  });
});

describe('the transition and the Watchers (bosses.md §3.1.2, §3.3.2)', () => {
  it('clamps the crossing hit at 50%, is invulnerable 1.5 s, then opens 3 + living eyes at c 17', () => {
    const sim = fight(['binder', 'betrayer']);
    runTo(sim, start(sim) + C_CALL + 31, { calls: true });
    expect(sim.boss.hold).toBeTruthy();
    const s = sim.bossSlot;
    sim.damageEnemy(s, 1e7, 0);
    expect(sim.eHp[s]).toBeCloseTo(0.5 * sim.bossMaxHp, 6);
    expect(sim.boss.phase).toBe(2);
    expect(sim.boss.hold).toBeNull();
    sim.damageEnemy(s, 1000, 0);
    expect(sim.eHp[s]).toBeCloseTo(0.5 * sim.bossMaxHp, 6);
    expect(decodeSnapshot(sim.encodeFor(0)[0])!.bossPhase).toBe(2 | BOSS_PHASE_INVULNERABLE);
    runTo(sim, sim.boss.transitionUntil + 1);
    expect(sim.tick - start(sim)).toBe(C_WATCHERS + 1);
    expect(sim.boss.eyes).toHaveLength(5);
    // Grey for 2 s: refused.
    const e = sim.boss.eyes[0].slot;
    sim.damageEnemy(e, 100, 0);
    expect(sim.eAlive[e]).toBe(1);
  });

  it('gazes for half max HP only at players he does not see, even after a broken Judgment', () => {
    const sim = fight(['binder', 'betrayer']);
    openBossGate(sim);
    sim.boss.aimResolved = false;
    runTo(sim, start(sim) + C_WATCHERS + 61);
    expect(sim.boss.eyes.length).toBe(5);
    const eyes = sim.boss.eyes.map((e) => [sim.eX[e.slot], sim.eY[e.slot], sim.eZ[e.slot] + 0.6] as const);
    const gazed = (x: number, y: number, z: number) => eyes.some(([ex, ey, ez]) => Math.hypot(ex - x, ey - y) <= WATCHER_GAZE && lineOfSight(sim.map, ex, ey, ez, x, y, z + PLAYER_EYE));
    const target = cells(sim, (x, y, z) => hidden(sim)(x, y, z) && gazed(x, y, z))[0];
    const safe = cells(sim, (x, y, z) => hidden(sim)(x, y, z) && !gazed(x, y, z))[0];
    expect(target).toBeTruthy();
    runTo(sim, start(sim) + C_JUDGMENT + 5);
    sim.silence(sim.bossSlot, 1);
    sim.step();
    put(sim.players[0], target); if (safe) put(sim.players[1], safe);
    runTo(sim, start(sim) + CYCLE_TICKS + 1, { god: false });
    expect(sim.players[0].hp).toBeCloseTo(sim.players[0].maxHp * 0.5, 6);
    if (safe) expect(sim.players[1].hp).toBe(sim.players[1].maxHp);
    expect(sim.boss.eyes).toHaveLength(0);
  });

  it('routes exactly 8% of max HP through a destroyed pack, and the gate leaves 1 HP until it resolves', () => {
    const sim = fight(['binder']);
    sim.boss.phase = 2;
    sim.boss.callResolved = true;
    runTo(sim, start(sim) + C_WATCHERS + 61);
    const s = sim.bossSlot, eyes = sim.boss.eyes.map((e) => e.slot);
    expect(eyes).toHaveLength(4);
    // Every eye within 20 m and sight of the solo player at opening.
    const p = sim.players[0];
    for (const e of eyes) expect(Math.hypot(sim.eX[e] - p.x, sim.eY[e] - p.y)).toBeLessThanOrEqual(20 + 1e-6);
    const hp = sim.eHp[s];
    for (const e of eyes) sim.damageEnemy(e, 100, 0);
    expect(hp - sim.eHp[s]).toBeCloseTo(0.08 * sim.bossMaxHp, 6);
    // No Judgment resolved yet: the gate stays shut and a lethal hit leaves him at 1 HP.
    expect(sim.boss.aimResolved).toBe(false);
    sim.damageEnemy(s, 1e7, 0);
    expect(sim.eHp[s]).toBe(1);
    expect(decodeSnapshot(sim.encodeFor(0)[0])!.bossFlags & BOSS_FLAG_DEFERRED).toBe(BOSS_FLAG_DEFERRED);
    runTo(sim, start(sim) + CYCLE_TICKS + 1);
    expect(sim.boss.aimResolved).toBe(true);
    sim.damageEnemy(s, 10, 0);
    sim.step();
    expect(sim.won).toBe(true);
    expect(sim.activeCount).toBe(0);
  });
});

describe('the end (bosses.md §3.8)', () => {
  it('victory releases a held player and removes parts without credit', () => {
    const sim = fight(['binder', 'betrayer']);
    runTo(sim, start(sim) + C_CALL + 31, { calls: true });
    expect(sim.boss.hold).toBeTruthy();
    openBossGate(sim);
    sim.damageEnemy(sim.bossSlot, 1e7, 0);
    sim.step();
    expect(sim.won).toBe(true);
    expect(sim.boss.hold).toBeNull();
    expect(events(sim, 'bossPhase').some((e) => e.phase === 0 && e.line.includes('first trumpet is silent'))).toBe(true);
    expect(HOLD_TICKS).toBe(180);
  });
});

function input(p: SimPlayer, seq: number) {
  return {
    runId: '00000000000000000000000000000000', seq: (p.lastSeq < 0 ? 0 : p.lastSeq) + seq, x: p.x, y: p.y, z: p.z, yaw: 1.25, pitch: 0, fire: 1,
    qPresses: p.qPresses, ePresses: p.ePresses, allyTargetId: 255, lastTeleportId: p.teleportId, item1Presses: 0, item2Presses: 0,
    mapHeld: false, qHeld: false, eHeld: false, leftPresses: 0, rightPresses: 0, viewTick: -1, viewGap: 0, viewFrac: 0,
    shots: 0, shotButton: 255, shotYaw: 0, shotPitch: 0, shotViewTick: -1, shotViewGap: 0, shotViewFrac: 0,
  };
}
