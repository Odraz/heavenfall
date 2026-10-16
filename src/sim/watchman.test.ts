import { describe, expect, it } from 'vitest';
import type { ClassId } from '../data/classes';
import { BLESSED, ENEMIES, WATCHMAN } from '../data/enemies';
import type { Focus } from '../data/dungeons/types';
import { WATCHMAN_AIM_TICKS, WATCHMAN_FIRED_TICKS, WATCHMAN_RELOAD_TICKS, validWatchmanAims } from '../data/watchman';
import { PHASE_CLEARED, PHASE_COMBAT, decodeSnapshot } from '../net/protocol';
import { PLAYER_HEIGHT } from './constants';
import { HALO_WEIGHT } from './economy';
import { itemDropChance, moteDropChance } from './rewards';
import { Simulation } from './sim';
import { arenaDungeon, sealAt } from './testutil/arenas';
import { dungeonOf } from './testutil/maps';
import { put, room } from './testutil/sims';

function watchArena(party: number, focus: Focus, watchmen = 10, blessed = 0) {
  const dungeon = arenaDungeon([{ blessed, choristers: 0, cherubs: 0, watchmen }]);
  dungeon.rooms[0].shape = '1x1'; dungeon.rooms[0].band = 2; dungeon.rooms[0].focus = focus;
  const sim = new Simulation({ dungeon, players: Array.from({ length: party }, (_, id) => ({ id, name: `P${id}`, classId: 'fallen' as const })), seed: 1, god: true });
  sealAt(sim);
  return sim;
}
const living = (sim: Simulation) => Array.from(sim.active.subarray(0, sim.activeCount)).filter((s) => sim.eType[s] === WATCHMAN);

describe('Watchman composition (rooms.md §6.4)', () => {
  it('has the specified body and stats', () => {
    expect(ENEMIES[WATCHMAN]).toEqual({ hp: 80, radius: 0.35, height: 1.8, speed: 3.5, flying: false, draw: 1.15 });
  });
  for (const [party, focus, cap] of [[1, 'horde', 2], [1, 'ranged', 3], [4, 'horde', 5], [4, 'ranged', 7]] as const) {
    it(`caps living Watchmen at ${cap} for ${party} player(s) in a ${focus} room and keeps the wave open while they wait`, () => {
      const sim = watchArena(party, focus);
      const total = Math.ceil(10 * (party === 1 ? 0.4 : 1) - 1e-9);
      expect(sim.watchmanCap(0)).toBe(cap);
      expect(sim.rooms[0].waveTotals[0]).toBe(total);
      // A squad: none in the first 5 s, then one every 0.5 s up to the cap.
      for (let i = 0; i < 140; i++) sim.step();
      expect(living(sim)).toHaveLength(0);
      for (let i = 0; i < 300; i++) sim.step();
      expect(living(sim)).toHaveLength(Math.min(cap, total));
      expect(sim.rooms[0].watch?.left).toBe(total - Math.min(cap, total));
      expect(sim.rooms[0].waveFullySpawned[0]).toBe(total <= cap);
      // A kill lets the next queued one in; the room can't clear while any wait.
      for (const s of living(sim)) sim.removeEnemy(s);
      expect(sim.rooms[0].phase).toBe(PHASE_COMBAT);
      sim.step();
      expect(sim.rooms[0].phase).toBe(PHASE_COMBAT);
      for (let i = 0; i < 300; i++) sim.step();
      const rest = total - Math.min(cap, total);
      expect(living(sim)).toHaveLength(Math.min(cap, rest));
      expect(sim.rooms[0].watch?.left ?? 0).toBe(rest - Math.min(cap, rest));
      expect(sim.rooms[0].waveFullySpawned[0]).toBe(rest <= cap);
      expect(sim.enemiesRemaining()).toBe(rest - Math.min(cap, rest) + living(sim).length);
    });
  }
  it('counts queued Watchmen in the enemies remaining and pays their XP share', () => {
    const sim = watchArena(4, 'horde', 4, 0);
    expect(sim.enemiesRemaining()).toBe(4);
    for (let i = 0; i < 400; i++) sim.step();
    const [s] = living(sim);
    expect(sim.rewards.eXp[s]).toBe(3);
  });
});

/** An open 40 × 20 combat room with a wall pillar at x 20, y 8–13; Watchman rooted at (10.5, 10.5), 19 m from (28.5, 4.5). */
function shot(classIds: ClassId[] = ['betrayer'], at: Array<[number, number]> = [[28.5, 4.5]]) {
  const heights = room(40, 20).map((row, y) => y >= 8 && y <= 13 ? row.slice(0, 20) + '#' + row.slice(21) : row);
  const dungeon = dungeonOf(heights);
  dungeon.rooms = [{ id: 'w', name: 'W', kind: 'combat', shape: '1x1', band: 2, rect: { x0: 1, y0: 1, x1: 40, y1: 20 },
    entry: [{ socket: 0, cells: [[1, 1], [2, 1], [3, 1], [4, 1]] }], leaves: [], waves: [{ blessed: 1, choristers: 0, cherubs: 0 }], boss: false }];
  const sim = new Simulation({ dungeon, noWaves: true, seed: 1, players: classIds.map((classId, id) => ({ id, name: `P${id}`, classId })) });
  sim.rooms[0].phase = PHASE_CLEARED;
  sim.players.forEach((p, i) => put(sim, p, ...(at[i] ?? at[0])));
  sim.refreshFields();
  const slot = sim.placeEnemy(WATCHMAN, 10, 10, 0);
  sim.root(slot, 60);
  return { sim, slot, p: sim.players[0] };
}
/** Steps until the Watchman starts an aim; returns its record. */
function aim(sim: Simulation, slot: number) {
  for (let i = 0; i < 60; i++) {
    sim.step();
    const r = sim.watchmen.records.get(slot);
    if (r?.phase === 'aim') return r;
  }
  throw new Error('no aim');
}
const steps = (sim: Simulation, n: number) => { for (let i = 0; i < n; i++) sim.step(); };

describe('the Watchman shot (rooms.md §6.4)', () => {
  it('aims for 1 s at the nearest visible player, then deals 12 on the fire tick with a clear line', () => {
    const { sim, slot, p } = shot();
    const r = aim(sim, slot);
    expect(r.targetId).toBe(p.id);
    expect(r.fireTick - sim.tick).toBe(WATCHMAN_AIM_TICKS);
    expect(validWatchmanAims(sim.watchmen.checkpoint(), sim.tick)).toBe(true);
    steps(sim, WATCHMAN_AIM_TICKS - 1);
    expect(p.hp).toBe(120);
    sim.step();
    expect(p.hp).toBe(108);
    const fired = sim.watchmen.records.get(slot)!;
    expect(fired).toMatchObject({ phase: 'fired', fireTick: sim.tick, shot: 1, x: p.x, y: p.y, z: p.z + PLAYER_HEIGHT / 2 });
    expect(sim.eCastCd[slot]).toBeCloseTo(1.5, 9);
    // The record shows for 0.5 s, then the 1.5 s reload ends and the next aim starts: one shot per 2.5 s.
    steps(sim, WATCHMAN_FIRED_TICKS);
    expect(sim.watchmen.records.has(slot)).toBe(false);
    const next = aim(sim, slot);
    expect(next.fireTick - fired.fireTick).toBe(WATCHMAN_RELOAD_TICKS + WATCHMAN_AIM_TICKS);
    expect(next.shot).toBe(1);
  });
  it('keeps its aim when the target steps behind a pillar and sparks on the pillar instead', () => {
    const { sim, slot, p } = shot();
    aim(sim, slot);
    steps(sim, 10);
    put(sim, p, 22.5, 10.5);
    steps(sim, 10);
    expect(sim.watchmen.aiming(slot)).toBe(true);
    steps(sim, WATCHMAN_AIM_TICKS - 20);
    expect(p.hp).toBe(120);
    const r = sim.watchmen.records.get(slot)!;
    expect(r.phase).toBe('fired');
    expect(r.x).toBeCloseTo(20, 6);
    expect(r.y).toBeCloseTo(10.5, 6);
  });
  it('falls short beyond its 30 m reach', () => {
    const { sim, slot, p } = shot();
    aim(sim, slot);
    put(sim, p, 40.5, 1.5);
    steps(sim, WATCHMAN_AIM_TICKS);
    const r = sim.watchmen.records.get(slot)!;
    expect(r.phase).toBe('fired');
    expect(p.hp).toBe(120);
    expect(Math.hypot(r.x - 10.5, r.y - 10.5, r.z - 1.5)).toBeCloseTo(30, 6);
  });
  it('walks toward a target it cannot see instead of aiming', () => {
    const { sim, slot, p } = shot(['betrayer'], [[30.5, 10.5]]);
    sim.eRootUntil[slot] = 0;
    put(sim, p, 30.5, 10.5); // Behind the pillar from (10.5, 10.5): no aim.
    steps(sim, 20);
    expect(sim.watchmen.aiming(slot)).toBe(false);
    expect(Math.hypot(sim.eX[slot] - 10.5, sim.eY[slot] - 10.5)).toBeGreaterThan(0.5);
  });
  for (const [name, act] of [
    ['a stun', (sim: Simulation, s: number) => sim.stun(s, 1)],
    ['a silence', (sim: Simulation, s: number) => sim.silence(s, 1)],
    ['a launch', (sim: Simulation, s: number) => { sim.knockback(s, 1, 0, 3, 0.4); sim.eVz[s] = 4; sim.eGrounded[s] = 0; }],
    ['a pull', (sim: Simulation, s: number) => sim.pull(s, 12.5, 10.5, 0)],
  ] as const) it(`cancels the aim on ${name} with no shot and starts the reload`, () => {
    const { sim, slot, p } = shot();
    aim(sim, slot);
    steps(sim, 15);
    act(sim, slot);
    sim.step();
    expect(sim.watchmen.records.has(slot)).toBe(false);
    expect(sim.eCastCd[slot]).toBeGreaterThan(1.4);
    steps(sim, 30);
    expect(p.hp).toBe(120);
  });
  it('cancels the aim with no shot when it dies, or its target dies or leaves the room', () => {
    const a = shot();
    aim(a.sim, a.slot);
    a.sim.damageEnemy(a.slot, 80, a.p.index);
    expect(a.sim.eAlive[a.slot]).toBe(0);
    expect(a.sim.watchmen.records.size).toBe(0);
    const b = shot(['betrayer', 'heretic'], [[28.5, 4.5], [30.5, 15.5]]);
    aim(b.sim, b.slot);
    b.sim.damagePlayer(b.p, 1000);
    b.sim.step();
    expect(b.sim.watchmen.aiming(b.slot)).toBe(false);
    steps(b.sim, 30);
    expect(b.sim.players[1].hp).toBe(b.sim.players[1].maxHp);
    const c = shot();
    aim(c.sim, c.slot);
    put(c.sim, c.p, 42.5, 10.5); // Outside the room rect (in the wall border's beyond).
    c.p.x = 45; c.sim.step();
    expect(c.sim.watchmen.aiming(c.slot)).toBe(false);
  });
  it('lets a shield absorb the shot, invulnerability ignore it and the Fallen take 60%', () => {
    const a = shot();
    a.p.shield = 20; a.p.shieldUntil = 1e9;
    aim(a.sim, a.slot); steps(a.sim, WATCHMAN_AIM_TICKS);
    expect([a.p.hp, a.p.shield]).toEqual([120, 8]);
    const b = shot();
    aim(b.sim, b.slot); b.p.invulUntil = b.sim.tick + 100; steps(b.sim, WATCHMAN_AIM_TICKS);
    expect(b.p.hp).toBe(120);
    expect(b.sim.watchmen.records.get(b.slot)?.phase).toBe('fired');
    const c = shot(['fallen']);
    aim(c.sim, c.slot); steps(c.sim, WATCHMAN_AIM_TICKS);
    expect(c.p.hp).toBeCloseTo(c.p.maxHp - 7.2, 9);
  });
  it('picks the nearest visible player with ties to the lowest index, and the Fallen while taunted', () => {
    const near = shot(['betrayer', 'heretic', 'fallen'], [[25.5, 10.5], [18.5, 4.5], [18.5, 16.5]]);
    // P1 and P2 are equally near; P0 is farther.
    expect(aim(near.sim, near.slot).targetId).toBe(1);
    const t = shot(['betrayer', 'fallen'], [[14.5, 10.5], [10.5, 18.5]]);
    t.sim.eTauntUntil[t.slot] = t.sim.tick + 300;
    expect(aim(t.sim, t.slot).targetId).toBe(1);
  });
  it('drops a hidden Betrayer: One of Them cancels the aim and no shot follows', () => {
    const { sim, slot, p } = shot();
    aim(sim, slot);
    expect(sim.talents.caster(slot)).toBe(true);
    sim.talents.hidden.add(p.id);
    sim.step();
    expect(sim.watchmen.aiming(slot)).toBe(false);
    steps(sim, 60);
    expect(p.hp).toBe(120);
    expect(sim.watchmen.records.has(slot)).toBe(false);
  });
  it('pays as an ordinary ranged enemy: halo weight 3, mote 35%, item 12%', () => {
    expect(HALO_WEIGHT[WATCHMAN]).toBe(3);
    expect(moteDropChance(WATCHMAN)).toBe(0.35);
    expect(itemDropChance(WATCHMAN)).toBe(0.12);
    expect([moteDropChance(BLESSED), itemDropChance(BLESSED)]).toEqual([0, 0.02]);
  });
});

describe('Watchman records in snapshots', () => {
  it('encodes the aim and the fired record for 0.5 s, even while a pull skips its update', () => {
    const { sim, slot } = shot();
    aim(sim, slot);
    const decoded = () => decodeSnapshot(sim.encodeFor(0)[0])!;
    expect(decoded().watchmanAims).toEqual([expect.objectContaining({ slot, phase: 'aim' })]);
    steps(sim, WATCHMAN_AIM_TICKS);
    expect(decoded().watchmanAims![0]).toMatchObject({ phase: 'fired', shot: 1 });
    sim.pull(slot, 12.5, 10.5, 0);
    for (let i = 0; i < 20; i++) { sim.step(); expect(() => sim.encodeFor(0)).not.toThrow(); }
    expect(decoded().watchmanAims).toEqual([]);
    expect(sim.floorSync('0'.repeat(32)).watchmanAims).toEqual([]);
  });
});
