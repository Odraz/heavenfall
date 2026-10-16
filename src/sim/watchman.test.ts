import { describe, expect, it } from 'vitest';
import { ENEMIES, WATCHMAN } from '../data/enemies';
import type { Focus } from '../data/dungeons/types';
import { PHASE_COMBAT } from '../net/protocol';
import { Simulation } from './sim';
import { arenaDungeon, sealAt } from './testutil/arenas';

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
    expect(ENEMIES[WATCHMAN]).toEqual({ hp: 60, radius: 0.35, height: 1.8, speed: 3.5, flying: false, draw: 1.15 });
  });
  for (const [party, focus, cap] of [[1, 'horde', 2], [1, 'ranged', 3], [4, 'horde', 4], [4, 'ranged', 6]] as const) {
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
