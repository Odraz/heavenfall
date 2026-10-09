import { describe, expect, it } from 'vitest';
import type { ClassId } from '../data/classes';
import { GridBuilder } from '../data/dungeons/build';
import type { DungeonDef } from '../data/dungeons/types';
import { BLESSED, CHERUB, GATEKEEPER, ST_ATTACKING, ST_WINDUP } from '../data/enemies';
import { decodeSnapshot } from '../net/protocol';
import { BOSS_CAST_JUDGMENT, BOSS_CAST_NONE, BOSS_CAST_VOLLEY, bossMultiplier, partyMultiplier, PHASE_COMBAT, PROJ_GLOBE, Simulation, type SimPlayer } from './sim';
import { sealNow } from './testutil/sims';

// A lobby (x 1–4) open to a boss arena (x 6–30). The Gatekeeper's dais is 3 m high around B (25, 10).
// A wall at x 15–16, y 13–18 hides the arena's south-west corner from the boss.
function dungeon(): DungeonDef {
  const g = new GridBuilder(32, 22);
  g.fillRect(1, 1, 4, 4, 0);
  g.marker(1, 1, 'S').marker(2, 1, 'S').marker(1, 2, 'S').marker(2, 2, 'S');
  g.fillRect(5, 2, 5, 3, 0);
  g.fillRect(6, 1, 30, 20, 0);
  g.fillRect(23, 8, 27, 12, 3);
  g.marker(25, 10, 'B');
  g.pillar(15, 13, 16, 18);
  for (const [x, y] of [[7, 1], [7, 20], [12, 1], [12, 20], [20, 1], [20, 20]] as const) g.marker(x, y, 'x');
  const grids = g.build();
  return {
    id: 'boss-test',
    name: 'Boss test',
    ...grids,
    arenas: [
      {
        id: 'gate',
        name: 'Gate',
        rect: { x0: 6, y0: 1, x1: 30, y1: 20 },
        doors: [],
        entryCells: [[7, 10], [7, 11], [8, 10], [8, 11]],
        waves: [{ blessed: 0, choristers: 0, cherubs: 0 }],
        boss: true,
      },
    ],
  };
}

const VISIBLE: [number, number] = [12.5, 4.5];
const HIDDEN: [number, number] = [12.5, 17.5];

function makeSim(classes: ClassId[] = ['binder']): Simulation {
  return new Simulation({
    dungeon: dungeon(),
    players: classes.map((classId, id) => ({ id, name: `P${id}`, classId })),
    seed: 1,
  });
}

function place(p: SimPlayer, [x, y]: [number, number]): void {
  p.x = x;
  p.y = y;
  p.z = 0;
}

/** Puts the players at the given spots and seals the boss arena (M8 §5). Returns the start tick. */
function startFight(sim: Simulation, spots: Array<[number, number]>): number {
  sim.players.forEach((p, i) => place(p, spots[i]));
  sim.step();
  sealNow(sim);
  // The arena start teleports nobody here (everyone is inside), so the spots hold.
  expect(sim.arenas[0].phase).toBe(PHASE_COMBAT);
  return sim.tick;
}

function runTo(sim: Simulation, tick: number): void {
  while (sim.tick < tick) sim.step();
}

const orbs = (sim: Simulation) => sim.projectiles.filter((s) => sim.pKind[s] === PROJ_GLOBE).length;
const castEvents = (sim: Simulation) => sim.events.flatMap((e) => (e.event.type === 'bossCast' ? [e.event.phase] : []));

describe('the Gatekeeper (§7.4)', () => {
  it('is placed on B when the boss arena starts, with HP scaled for the party', () => {
    const sim = makeSim(['binder', 'betrayer']);
    startFight(sim, [VISIBLE, [13.5, 4.5]]);
    const b = sim.bossSlot;
    expect(b).toBeGreaterThanOrEqual(0);
    expect(sim.eType[b]).toBe(GATEKEEPER);
    expect([sim.eX[b], sim.eY[b], sim.eZ[b]]).toEqual([25.5, 10.5, 3]);
    // 29 000 HP at 4 players (M9 §4), scaled for 2.
    expect(sim.eHp[b]).toBe(29000 * 0.6);
    // It isn't counted among the living enemies or the enemies remaining.
    expect(sim.living).toBe(0);
    expect(sim.enemiesRemaining()).toBe(0);
  });

  it('targets only players it can see, nearest first, with Sinful', () => {
    const sim = makeSim(['binder', 'fallen']);
    startFight(sim, [HIDDEN, VISIBLE]);
    expect(sim.eTarget[sim.bossSlot]).toBe(1);

    // Both visible: the Fallen counts at half distance, so it wins even when farther.
    const sim2 = makeSim(['binder', 'fallen']);
    startFight(sim2, [[20.5, 4.5], [8.5, 4.5]]);
    expect(sim2.eTarget[sim2.bossSlot]).toBe(1);
  });

  it('keeps its target while nobody is visible, and takes the nearest player if it has none', () => {
    const sim = makeSim(['binder', 'heretic']);
    startFight(sim, [HIDDEN, [14.5, 19.5]]);
    // Nobody visible from the start: the nearest living player.
    const b = sim.bossSlot;
    expect(sim.eTarget[b]).toBe(1);
    place(sim.players[1], [13.5, 18.5]);
    runTo(sim, sim.tick + 30);
    expect(sim.eTarget[b]).toBe(1);
  });

  it('fires the first Volley at 2 s after a 0.5 s wind-up, then every 4 s', () => {
    const sim = makeSim();
    const t0 = startFight(sim, [VISIBLE]);
    sim.players[0].god = true;
    runTo(sim, t0 + 59);
    expect(sim.bossCast).toBe(BOSS_CAST_NONE);
    sim.step();
    expect(sim.bossCast).toBe(BOSS_CAST_VOLLEY);
    expect(sim.eState[sim.bossSlot]).toBe(ST_WINDUP);
    runTo(sim, t0 + 74);
    expect(orbs(sim)).toBe(0);
    sim.step();
    expect(orbs(sim)).toBe(8);
    expect(sim.eState[sim.bossSlot]).toBe(ST_ATTACKING);
    // Globes at 6 m/s, like a Chorister's (M12 follow-up §1.3).
    const g = sim.projectiles[0];
    const before = sim.pTraveled[g];
    sim.step();
    expect(sim.pTraveled[g] - before).toBeCloseTo(6 / 30, 9);
    // The next one is due 4 s after firing.
    expect(sim.volleyDue).toBe(t0 + 75 + 120);
  });

  it('spreads the Volley evenly from −25° to +25° around the aim at the target', () => {
    const sim = makeSim();
    const t0 = startFight(sim, [VISIBLE]);
    sim.players[0].god = true;
    runTo(sim, t0 + 75);
    const b = sim.bossSlot;
    const p = sim.players[0];
    const aim = Math.atan2(p.y - sim.eY[b], p.x - sim.eX[b]);
    const angles = sim.projectiles
      .map((s) => {
        let d = Math.atan2(sim.pY[s] - sim.eY[b], sim.pX[s] - sim.eX[b]) - aim;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        return (d * 180) / Math.PI;
      })
      .sort((a, c) => a - c);
    const want = Array.from({ length: 8 }, (_, i) => -25 + (50 * i) / 7);
    angles.forEach((a, i) => expect(a).toBeCloseTo(want[i], 3));
  });

  it("waits with a Volley while its target isn't in line of sight", () => {
    const sim = makeSim();
    const t0 = startFight(sim, [HIDDEN]);
    sim.players[0].god = true;
    runTo(sim, t0 + 120);
    expect(sim.bossCast).toBe(BOSS_CAST_NONE);
    expect(orbs(sim)).toBe(0);
    // Step into view: the Volley starts once line of sight is checked again (at most 0.5 s).
    place(sim.players[0], VISIBLE);
    runTo(sim, t0 + 136);
    expect(sim.bossCast).toBe(BOSS_CAST_VOLLEY);
  });

  it('casts Judgment at 20 s, damaging only players whose eye sees its eye', () => {
    const sim = makeSim(['binder', 'betrayer', 'fallen']);
    const t0 = startFight(sim, [VISIBLE, HIDDEN, [9.5, 4.5]]);
    // Keep the Volleys from hurting anyone before Judgment.
    for (const p of sim.players) p.devGod = true;
    runTo(sim, t0 + 599);
    for (const p of sim.players) p.devGod = false;
    sim.events.length = 0;
    sim.step();
    // A Volley may still be in its wind-up; Judgment waits for it to fire.
    while (sim.bossCast !== BOSS_CAST_JUDGMENT) sim.step();
    const start = sim.tick;
    expect(castEvents(sim)).toContain('start');
    expect(sim.eState[sim.bossSlot]).toBe(ST_WINDUP);
    const before = sim.players.map((p) => p.hp + p.shield);
    // Volley orbs could hit during the cast; only Judgment's damage is checked here.
    sim.projectiles.length = 0;
    sim.volleyDue = Infinity;
    runTo(sim, start + 89);
    expect(sim.bossCast).toBe(BOSS_CAST_JUDGMENT);
    sim.step();
    expect(castEvents(sim)).toContain('completed');
    expect(sim.bossCast).toBe(BOSS_CAST_NONE);
    const [binder, betrayer, fallen] = sim.players;
    expect(binder.dead).toBe(true);
    expect(betrayer.dead).toBe(false);
    expect(betrayer.hp + betrayer.shield).toBe(before[1]);
    // Brimstone Hide: the Fallen survives at full HP with 40% left.
    expect(fallen.dead).toBe(false);
    expect(fallen.hp).toBeCloseTo(400 * 0.4, 6);
    expect(sim.judgmentDue).toBe(start + 90 + 750);
  });

  it('is interrupted by Discord, and the next Judgment is due 25 s later', () => {
    const sim = makeSim(['binder']);
    const t0 = startFight(sim, [VISIBLE]);
    sim.players[0].god = true;
    sim.judgmentDue = t0 + 10;
    sim.volleyDue = Infinity;
    runTo(sim, t0 + 10);
    expect(sim.bossCast).toBe(BOSS_CAST_JUDGMENT);
    sim.events.length = 0;
    sim.silence(sim.bossSlot, 4);
    sim.step();
    expect(sim.bossCast).toBe(BOSS_CAST_NONE);
    expect(castEvents(sim)).toEqual(['interrupted']);
    expect(sim.judgmentDue).toBe(sim.tick + 750);
  });

  it('is interrupted by taking 1 300 damage (scaled; solo × 0.3, M12 follow-up §3.3) during the cast (M9 §4)', () => {
    const sim = makeSim(['binder']);
    const t0 = startFight(sim, [VISIBLE]);
    sim.players[0].god = true;
    sim.judgmentDue = t0 + 10;
    sim.volleyDue = Infinity;
    runTo(sim, t0 + 10);
    const b = sim.bossSlot;
    // One player: the threshold is 1 300 × 0.3 = 390; 389 isn't enough, 1 more is.
    sim.damageEnemy(b, 389, 0);
    expect(sim.bossCast).toBe(BOSS_CAST_JUDGMENT);
    sim.events.length = 0;
    sim.damageEnemy(b, 1, 0);
    expect(sim.bossCast).toBe(BOSS_CAST_NONE);
    expect(castEvents(sim)).toEqual(['interrupted']);
  });

  it('has 0.3 of its HP solo, and the party multiplier with more players (M12 follow-up §3.3)', () => {
    expect(bossMultiplier(1)).toBe(0.3);
    for (const n of [2, 3, 4]) expect(bossMultiplier(n)).toBe(partyMultiplier(n));
  });

  it('starts a cast that was due during silence when the silence ends', () => {
    const sim = makeSim(['binder']);
    const t0 = startFight(sim, [VISIBLE]);
    sim.players[0].god = true;
    sim.silence(sim.bossSlot, 4);
    runTo(sim, t0 + 119);
    expect(sim.bossCast).toBe(BOSS_CAST_NONE);
    expect(orbs(sim)).toBe(0);
    runTo(sim, t0 + 121);
    expect(sim.bossCast).toBe(BOSS_CAST_VOLLEY);
  });

  it('summons 150 Blessed and 10 Cherubs (scaled) at 30 s and every 30 s, even while silenced', () => {
    const sim = makeSim(['binder', 'betrayer', 'heretic', 'fallen']);
    const t0 = startFight(sim, [VISIBLE, [13.5, 4.5], [12.5, 5.5], [13.5, 5.5]]);
    for (const p of sim.players) p.god = true;
    sim.volleyDue = Infinity;
    sim.judgmentDue = Infinity;
    runTo(sim, t0 + 899);
    expect(sim.arenas[0].queue.length).toBe(0);
    expect(sim.living).toBe(0);
    sim.silence(sim.bossSlot, 4);
    sim.step();
    const total = (t: number) => sim.arenas[0].queue.reduce((n, q) => n + q.counts[t], 0) + countType(sim, t);
    expect(total(0)).toBe(150);
    expect(total(2)).toBe(10);
    runTo(sim, t0 + 1800);
    expect(sim.summonDue).toBe(t0 + 2700);
  });

  it('dying is a victory: the other enemies burst without kill credit', () => {
    const sim = makeSim(['binder']);
    startFight(sim, [VISIBLE]);
    sim.players[0].god = true;
    const a = sim.placeEnemy(BLESSED, 10, 10, 0);
    const c = sim.placeEnemy(CHERUB, 11, 10, 0);
    sim.damageEnemy(sim.bossSlot, 1e9, 0);
    sim.step();
    expect(sim.result).toBe('victory');
    expect(sim.eAlive[a]).toBe(0);
    expect(sim.eAlive[c]).toBe(0);
    // Only the Gatekeeper counts as a kill.
    expect(sim.players[0].kills).toBe(1);
    expect(sim.events.some((e) => e.event.type === 'gameOver' && e.event.result === 'victory')).toBe(true);
  });

  it('dev key K kills it too, which is a victory', () => {
    const sim = makeSim(['binder']);
    startFight(sim, [VISIBLE]);
    sim.killAll();
    sim.step();
    expect(sim.result).toBe('victory');
    expect(sim.players[0].kills).toBe(0);
  });

  it('sends its HP and casts in the snapshot header, and zeros outside the fight', () => {
    const sim = makeSim(['binder']);
    sim.step();
    let snap = decodeSnapshot(sim.encodeFor(0)[0])!;
    expect([snap.bossHp, snap.bossMaxHp, snap.bossCast]).toEqual([0, 0, 0]);
    const t0 = startFight(sim, [VISIBLE]);
    sim.players[0].god = true;
    sim.judgmentDue = t0 + 10;
    sim.volleyDue = Infinity;
    runTo(sim, t0 + 10 + 45);
    snap = decodeSnapshot(sim.encodeFor(0)[0])!;
    expect(snap.bossHp).toBe(8700);
    expect(snap.bossMaxHp).toBe(8700);
    expect(snap.bossCast).toBe(BOSS_CAST_JUDGMENT);
    expect(snap.bossCastProgress).toBe(128);
  });
});

function countType(sim: Simulation, type: number): number {
  let n = 0;
  for (let k = 0; k < sim.activeCount; k++) if (sim.eType[sim.active[k]] === type) n++;
  return n;
}
