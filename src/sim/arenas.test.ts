import { describe, expect, it } from 'vitest';
import type { ArenaDef, WaveDef } from '../data/dungeons/types';
import { BLESSED, CHERUB } from '../data/enemies';
import { decodeSnapshot, PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN, PHASE_IDLE } from '../net/protocol';
import { MAX_LIVING_ENEMIES } from './constants';
import { scaleCount, Simulation, SPAWN_RATE } from './sim';
import { dungeonOf } from './testutil/maps';
import { sealNow } from './testutil/sims';

// Start room (x 1–4) | door x 5 | arena 0 (x 6–12) | door x 13, corridor x 14, door x 15 | arena 1 (x 16–22).
const HEIGHTS = [
  '########################',
  '#0000000000000000000000#',
  '#0000000000000000000000#',
  '#0000#0000000###0000000#',
  '#0000#0000000###0000000#',
  '########################',
];
const MARKERS = [
  '........................',
  '.SS..D....x.xD.D....x.x.',
  '.SS..D......xD.D......x.',
  '..........x..........x..',
  '........................',
  '........................',
];

function arenas(waves0: WaveDef[], waves1: WaveDef[] = [{ blessed: 4, choristers: 0, cherubs: 0 }]): ArenaDef[] {
  return [
    {
      id: 'a0',
      name: 'A0',
      rect: { x0: 6, y0: 1, x1: 12, y1: 4 },
      doors: [[5, 1], [5, 2], [13, 1], [13, 2]],
      entryCells: [[6, 1], [6, 2], [7, 1], [7, 2]],
      waves: waves0,
      boss: false,
    },
    {
      id: 'a1',
      name: 'A1',
      rect: { x0: 16, y0: 1, x1: 22, y1: 4 },
      doors: [[15, 1], [15, 2]],
      entryCells: [[16, 1], [16, 2], [17, 1], [17, 2]],
      waves: waves1,
      boss: false,
    },
  ];
}

function makeSim(waves0: WaveDef[], players = 4, opts: { markers?: string[]; heights?: string[] } = {}): Simulation {
  return new Simulation({
    dungeon: dungeonOf(opts.heights ?? HEIGHTS, { markers: opts.markers ?? MARKERS, arenas: arenas(waves0) }),
    players: Array.from({ length: players }, (_, id) => ({ id, name: `P${id}`, classId: (['fallen', 'heretic', 'binder', 'betrayer'] as const)[id] })),
    seed: 1,
    god: true,
  });
}

/** Moves player 0 into arena 0, which starts its countdown, then seals it (M8 §5). */
function enterArena0(sim: Simulation): void {
  const p = sim.players[0];
  p.x = 9.5;
  p.y = 2.5;
  sim.step();
  sealNow(sim);
}

const wave = (blessed: number, cherubs = 0): WaveDef => ({ blessed, choristers: 0, cherubs });

describe('arenas', () => {
  it('seal after the countdown, and doors close', () => {
    const sim = makeSim([wave(10)]);
    sim.step();
    expect(sim.arenas[0].phase).toBe(PHASE_IDLE);
    expect(sim.arenaStatus()).toEqual({ arenaIndex: 0, arenaPhase: PHASE_IDLE });
    expect(sim.map.solid[1 * sim.map.w + 5]).toBe(0);
    enterArena0(sim);
    expect(sim.arenas[0].phase).toBe(PHASE_COMBAT);
    expect(sim.arenaStatus()).toEqual({ arenaIndex: 0, arenaPhase: PHASE_COMBAT });
    for (const [c, r] of sim.map.arenas[0].doors) expect(sim.map.solid[r * sim.map.w + c]).toBe(1);
    // Arena 1's doors stay open.
    expect(sim.map.solid[1 * sim.map.w + 15]).toBe(0);
    expect(sim.events.some((e) => e.event.type === 'arenaStarted' && e.event.arenaIndex === 0)).toBe(true);
  });

  it("dead players don't start an arena", () => {
    const sim = makeSim([wave(10)]);
    sim.players[0].dead = true;
    enterArena0(sim);
    expect(sim.arenas[0].phase).toBe(PHASE_IDLE);
  });

  it('teleports stragglers, and players on door cells, to their entry cells', () => {
    const sim = makeSim([wave(10)]);
    // Player 1 stands on a door cell; players 2 and 3 are still in the start room.
    sim.players[1].x = 5.5;
    sim.players[1].y = 1.5;
    enterArena0(sim);
    const teleports = sim.events.filter((e) => e.event.type === 'teleport');
    expect(teleports.map((e) => e.to).sort()).toEqual([1, 2, 3]);
    for (const p of sim.players.slice(1)) {
      const [c, r] = sim.map.arenas[0].entryCells[p.index];
      expect([p.x, p.y]).toEqual([c + 0.5, r + 0.5]);
      expect(p.teleportId).toBe(1);
    }
    // Player 0 was inside: not teleported.
    expect(sim.players[0].teleportId).toBe(0);
    // An input sent before the client saw the teleport is ignored.
    const p2 = sim.players[2];
    sim.applyInput(2, { seq: 1, x: 2.5, y: 2.5, z: 0, yaw: 0, pitch: 0, fireHeld: false, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 }, sim.nowMs);
    expect(p2.x).toBe(7.5);
    sim.applyInput(2, { seq: 2, x: 7.6, y: 1.5, z: 0, yaw: 0, pitch: 0, fireHeld: false, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: 1 }, sim.nowMs + 33);
    expect(p2.x).toBeCloseTo(7.6);
  });

  it('starts the next wave when at most 20% of the previous one is alive', () => {
    const sim = makeSim([wave(10), wave(5)]);
    enterArena0(sim);
    const st = sim.arenas[0];
    while (!st.waveFullySpawned[0]) sim.step();
    expect(st.wave).toBe(0);
    const kill = (n: number) => {
      for (let i = 0; i < n; i++) sim.removeEnemy(sim.active[0]);
    };
    kill(7); // 3 of 10 alive: 30%
    sim.step();
    expect(st.wave).toBe(0);
    kill(1); // 2 of 10 alive: 20%
    sim.step();
    expect(st.wave).toBe(1);
  });

  it('starts the next wave 20 s after the previous one started', () => {
    const sim = makeSim([wave(10), wave(5)]);
    enterArena0(sim);
    const start = sim.tick;
    const st = sim.arenas[0];
    while (sim.tick < start + 599) sim.step();
    expect(st.wave).toBe(0);
    sim.step();
    expect(st.wave).toBe(1);
    expect(sim.tick - start).toBe(600);
  });

  it('spawns at most SPAWN_RATE enemies per second from one spawn point', () => {
    // Only one x cell.
    const markers = ['........................', '.SS..D....x..D.D....x.x.', '.SS..D.......D.D......x.', '.....................x..', '........................', '........................'];
    const sim = makeSim([wave(500)], 4, { markers });
    enterArena0(sim);
    const spawnedAfter = (ticks: number) => {
      for (let i = 0; i < ticks; i++) sim.step();
      return sim.living;
    };
    // The budget was full (2) when combat started, so the first tick placed at most 2 + 1.
    const first = sim.living;
    expect(first).toBeLessThanOrEqual(3);
    const perTick: number[] = [];
    let prev = first;
    for (let i = 0; i < 90; i++) {
      sim.step();
      perTick.push(sim.living - prev);
      prev = sim.living;
    }
    expect(Math.max(...perTick)).toBeLessThanOrEqual(Math.ceil(SPAWN_RATE / 30));
    // A busy spawn point sustains exactly SPAWN_RATE per second.
    expect(perTick.slice(30, 60).reduce((a, b) => a + b, 0)).toBe(SPAWN_RATE);
    expect(perTick.slice(60, 90).reduce((a, b) => a + b, 0)).toBe(SPAWN_RATE);
    expect(spawnedAfter(0)).toBe(prev);
  });

  it('interleaves types in proportion to their counts, ties going to Blessed', () => {
    const sim = makeSim([wave(6, 3)]);
    enterArena0(sim);
    for (let i = 0; i < 5; i++) sim.step();
    // Fresh slots are used in placement order.
    const order = Array.from({ length: 9 }, (_, s) => (sim.eType[s] === BLESSED ? 'B' : sim.eType[s] === CHERUB ? 'C' : '?')).join('');
    expect(order).toBe('BCBBCBBCB');

    const tie = makeSim([wave(2, 2)]);
    enterArena0(tie);
    for (let i = 0; i < 5; i++) tie.step();
    const tieOrder = Array.from({ length: 4 }, (_, s) => (tie.eType[s] === BLESSED ? 'B' : 'C')).join('');
    expect(tieOrder).toBe('BCBC');
  });

  it('caps living enemies at 1 500', () => {
    const sim = makeSim([wave(200)]);
    // Fill up to 1 495 outside any arena.
    for (let i = 0; i < 1495; i++) sim.placeEnemy(BLESSED, 1 + (i % 4), 1 + (Math.floor(i / 4) % 4), -1);
    enterArena0(sim);
    for (let i = 0; i < 10; i++) sim.step();
    expect(sim.living).toBe(MAX_LIVING_ENEMIES);
    expect(sim.arenas[0].alive).toBe(5);
    expect(sim.arenas[0].queue.length).toBe(1);
    // Freeing room lets placement continue.
    sim.removeEnemy(sim.active[0]);
    sim.step();
    expect(sim.living).toBe(MAX_LIVING_ENEMIES);
    expect(sim.arenas[0].alive).toBe(6);
  });

  it('clears when every wave has spawned and none are alive: doors open and the dead respawn', () => {
    const sim = makeSim([wave(4), wave(2)]);
    enterArena0(sim);
    const dead = sim.players[3];
    dead.dead = true;
    dead.hp = 0;
    for (let i = 0; i < 3; i++) sim.step();
    sim.killAll();
    sim.step(); // wave 2 starts
    expect(sim.arenas[0].wave).toBe(1);
    for (let i = 0; i < 3; i++) sim.step();
    expect(sim.arenas[0].phase).toBe(PHASE_COMBAT);
    sim.events.length = 0;
    sim.killAll();
    sim.step();
    expect(sim.arenas[0].phase).toBe(PHASE_CLEARED);
    expect(sim.arenaStatus()).toEqual({ arenaIndex: 0, arenaPhase: PHASE_CLEARED });
    for (const [c, r] of sim.map.arenas[0].doors) expect(sim.map.solid[r * sim.map.w + c]).toBe(0);
    expect(sim.events.some((e) => e.event.type === 'arenaCleared')).toBe(true);
    expect(dead.dead).toBe(false);
    expect(dead.hp).toBe(dead.maxHp);
    const [c, r] = sim.map.arenas[0].entryCells[dead.index];
    expect([dead.x, dead.y]).toEqual([c + 0.5, r + 0.5]);
    expect(sim.events.some((e) => e.event.type === 'playerRespawned' && e.event.playerId === dead.id)).toBe(true);
    expect(sim.events.some((e) => e.event.type === 'teleport' && e.to === dead.id)).toBe(true);
  });

  it('arenaIndex is the highest-index arena that has left idle', () => {
    const sim = makeSim([wave(1)]);
    enterArena0(sim);
    for (let i = 0; i < 3; i++) sim.step();
    sim.killAll();
    sim.step();
    expect(sim.arenaStatus()).toEqual({ arenaIndex: 0, arenaPhase: PHASE_CLEARED });
    const p = sim.players[0];
    p.x = 18.5;
    p.y = 2.5;
    sim.step();
    // The countdown counts as having left idle (M8 §5).
    expect(sim.arenaStatus()).toEqual({ arenaIndex: 1, arenaPhase: PHASE_COUNTDOWN });
    sealNow(sim, 1);
    expect(sim.arenaStatus()).toEqual({ arenaIndex: 1, arenaPhase: PHASE_COMBAT });
  });

  it('counts enemies remaining: living plus not yet spawned', () => {
    const sim = makeSim([wave(10), wave(5)]);
    enterArena0(sim);
    expect(sim.enemiesRemaining()).toBe(15);
    for (let i = 0; i < 5; i++) sim.step();
    sim.removeEnemy(sim.active[0]);
    expect(sim.enemiesRemaining()).toBe(14);
  });
});

describe('party-size scaling', () => {
  it('multiplies by 0.4, 0.6, 0.8 and 1.0, rounding up per type', () => {
    expect([1, 2, 3, 4].map((n) => scaleCount(200, n))).toEqual([80, 120, 160, 200]);
    expect([1, 2, 3, 4].map((n) => scaleCount(33, n))).toEqual([14, 20, 27, 33]);
    expect([1, 2, 3, 4].map((n) => scaleCount(1, n))).toEqual([1, 1, 1, 1]);
    expect([1, 2, 3, 4].map((n) => scaleCount(0, n))).toEqual([0, 0, 0, 0]);
  });

  it('applies to waves by the party size at the start', () => {
    const solo = makeSim([wave(25, 3)], 1);
    enterArena0(solo);
    // ceil(25 × 0.4) + ceil(3 × 0.4) = 10 + 2
    expect(solo.enemiesRemaining()).toBe(12);
    const duo = makeSim([wave(25, 3)], 2);
    enterArena0(duo);
    // ceil(25 × 0.6) + ceil(3 × 0.6) = 15 + 2
    expect(duo.enemiesRemaining()).toBe(17);
  });
});

describe('arena countdown (M8 §5)', () => {
  const put = (sim: Simulation, i: number, x: number, y: number) => {
    sim.players[i].x = x;
    sim.players[i].y = y;
  };

  it('starts when a living player enters, with 60 s, and nothing spawns or closes during it', () => {
    const sim = makeSim([wave(10)]);
    put(sim, 0, 9.5, 2.5);
    sim.step();
    expect(sim.arenaStatus()).toEqual({ arenaIndex: 0, arenaPhase: PHASE_COUNTDOWN });
    expect(sim.countdownLeft()).toBeCloseTo(60, 6);
    for (let i = 0; i < 60; i++) sim.step();
    expect(sim.activeCount).toBe(0);
    for (const [c, r] of sim.map.arenas[0].doors) expect(sim.map.solid[r * sim.map.w + c]).toBe(0);
    expect(sim.countdownLeft()).toBeCloseTo(58, 6);
    const snap = decodeSnapshot(sim.encodeFor(0)[0])!;
    expect(snap.arenaPhase).toBe(PHASE_COUNTDOWN);
    expect(snap.countdown).toBe(580);
  });

  it("doesn't start before every earlier arena is cleared", () => {
    const sim = makeSim([wave(10)]);
    put(sim, 0, 18.5, 2.5);
    sim.step();
    expect(sim.arenas[1].phase).toBe(PHASE_IDLE);
  });

  it('drops to 5 s once every living player is inside, never rises, and never restarts', () => {
    const sim = makeSim([wave(10)], 2);
    put(sim, 0, 9.5, 2.5);
    sim.step();
    for (let i = 0; i < 30; i++) sim.step();
    expect(sim.countdownLeft()).toBeCloseTo(59, 6);
    // Player 1 on a door cell doesn't count as inside.
    put(sim, 1, 5.5, 1.5);
    sim.step();
    expect(sim.countdownLeft()).toBeCloseTo(59 - 1 / 30, 6);
    put(sim, 1, 8.5, 1.5);
    sim.step();
    expect(sim.countdownLeft()).toBeCloseTo(5, 6);
    // Leaving again neither restarts it nor raises it.
    put(sim, 0, 2.5, 2.5);
    put(sim, 1, 2.5, 1.5);
    for (let i = 0; i < 30; i++) sim.step();
    expect(sim.arenaStatus()).toEqual({ arenaIndex: 0, arenaPhase: PHASE_COUNTDOWN });
    expect(sim.countdownLeft()).toBeCloseTo(4, 6);
  });

  it('a dead player needs not be inside; at 0 it seals, teleporting the others, and wave 1 starts', () => {
    const sim = makeSim([wave(10)], 3);
    put(sim, 0, 9.5, 2.5);
    sim.players[2].dead = true;
    sim.step();
    put(sim, 1, 8.5, 1.5);
    sim.step();
    expect(sim.countdownLeft()).toBeCloseTo(5, 6);
    // Player 1 walks back out before the seal.
    put(sim, 1, 2.5, 1.5);
    while (sim.arenas[0].phase === PHASE_COUNTDOWN) sim.step();
    expect(sim.arenas[0].phase).toBe(PHASE_COMBAT);
    const [c, r] = sim.map.arenas[0].entryCells[1];
    expect([sim.players[1].x, sim.players[1].y]).toEqual([c + 0.5, r + 0.5]);
    expect(sim.arenas[0].wave).toBe(0);
    expect(sim.events.some((e) => e.event.type === 'arenaStarted')).toBe(true);
  });
});

describe('joining in progress (M8 §6.2)', () => {
  const join = (sim: Simulation, id: number) => sim.addPlayer({ id, name: `P${id}`, classId: (['fallen', 'heretic', 'binder', 'betrayer'] as const)[id] })!;
  const teleportTo = (sim: Simulation, id: number) => sim.events.filter((e) => e.to === id && e.event.type === 'teleport').map((e) => e.event)[0];

  it('enters a fight as a soul on its entry cell, already floating, with progress 0', () => {
    const sim = makeSim([wave(10)], 1);
    enterArena0(sim);
    sim.events.length = 0;
    const p = join(sim, 2);
    expect(p.index).toBe(2);
    expect([p.dead, p.hp, p.revive]).toEqual([true, 0, 0]);
    const [c, r] = sim.map.arenas[0].entryCells[2];
    expect([p.x, p.y, p.z]).toEqual([c + 0.5, r + 0.5, 0]);
    expect(teleportTo(sim, 2)).toEqual({ type: 'teleport', teleportId: 1, x: c + 0.5, y: r + 0.5, z: 0 });
    expect(sim.soulBase(p)).toBeCloseTo(1, 6);
    // No death event: it never died.
    expect(sim.events.some((e) => e.event.type === 'playerDied')).toBe(false);
    sim.step();
    const snap = decodeSnapshot(sim.encodeFor(0)[0])!;
    expect(snap.players.map((q) => [q.id, q.dead])).toEqual([
      [0, false],
      [2, true],
    ]);
  });

  it('enters a countdown alive on its entry cell', () => {
    const sim = makeSim([wave(10)], 1);
    sim.players[0].x = 9.5;
    sim.players[0].y = 2.5;
    sim.step();
    const p = join(sim, 3);
    const [c, r] = sim.map.arenas[0].entryCells[3];
    expect([p.dead, p.x, p.y]).toEqual([false, c + 0.5, r + 0.5]);
  });

  it('otherwise enters alive on the living player with the lowest ID', () => {
    const sim = makeSim([wave(10)], 2);
    sim.players[0].dead = true;
    sim.players[1].x = 3.5;
    sim.players[1].y = 3.5;
    const p = join(sim, 3);
    expect([p.dead, p.x, p.y]).toEqual([false, 3.5, 3.5]);
  });

  it('with no living player, enters on its entry cell of the next arena', () => {
    const sim = makeSim([wave(1)], 1);
    enterArena0(sim);
    for (let i = 0; i < 90 && sim.arenas[0].phase !== PHASE_CLEARED; i++) {
      sim.step();
      sim.killAll();
    }
    expect(sim.arenas[0].phase).toBe(PHASE_CLEARED);
    sim.players[0].dead = true;
    const p = join(sim, 1);
    const [c, r] = sim.map.arenas[1].entryCells[1];
    expect([p.dead, p.x, p.y]).toEqual([false, c + 0.5, r + 0.5]);
  });

  it('a player who leaves is removed with their soul', () => {
    const sim = makeSim([wave(10)], 2);
    enterArena0(sim);
    const p = join(sim, 2);
    sim.removePlayer(2);
    expect(sim.players.map((q) => q.id)).toEqual([0, 1]);
    expect(sim.slots[2]).toBeUndefined();
    expect(p.connected).toBe(false);
    sim.step();
    expect(decodeSnapshot(sim.encodeFor(0)[0])!.players.map((q) => q.id)).toEqual([0, 1]);
    // The slot can be taken again; kills don't carry over.
    expect(join(sim, 2).kills).toBe(0);
  });
});

describe('party-size scaling at the seal (M8 §6.3)', () => {
  it('counts the players in the game at the seal, not at go', () => {
    const sim = makeSim([wave(25, 3)], 1);
    sim.addPlayer({ id: 1, name: 'B', classId: 'heretic' });
    enterArena0(sim);
    // Two players at the seal: ceil(25 × 0.6) + ceil(3 × 0.6) = 15 + 2.
    expect(sim.arenas[0].partySize).toBe(2);
    expect(sim.enemiesRemaining()).toBe(17);
  });

  it("isn't changed by a join or a leave after the seal", () => {
    const sim = makeSim([wave(25, 3), wave(25, 3)], 1);
    enterArena0(sim);
    sim.addPlayer({ id: 1, name: 'B', classId: 'heretic' });
    sim.addPlayer({ id: 2, name: 'C', classId: 'binder' });
    sim.removePlayer(0);
    expect(sim.arenas[0].partySize).toBe(1);
    // Both waves at 0.4: (10 + 2) × 2.
    expect(sim.enemiesRemaining()).toBe(24);
  });
});
