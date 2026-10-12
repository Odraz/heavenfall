import { describe, expect, it } from 'vitest';
import { floorHash } from '../gen';
import { PINNED } from '../gen/pinned';
import { PHASE_CLEARED, PHASE_COUNTDOWN } from '../net/protocol';
import { loadRunMap } from './runMap';
import { ROOM_NONE, Simulation } from './sim';

const generated = { heaven: 1, floor: 1, seed: PINNED.seed, fixture: null } as const;
const players = [{ id: 0, name: 'Host', classId: 'fallen', bot: false }] as const;

describe('generated-floor loading and simulation (rogue R1.3)', () => {
  it('reuses the validated map with every leaf open and no encounters, even after entering each room', () => {
    const { def, map, floor } = loadRunMap(generated);
    expect(floorHash(def)).toBe(PINNED.floorHash);
    expect(floor?.n).toBe(PINNED.n);
    const sim = new Simulation({ dungeon: def, map, players: [...players], seed: 7, walkOnly: true });
    expect(sim.map).toBe(map);
    expect(sim.clearedMask()).toBe((1 << PINNED.n) - 1);
    expect(sim.rooms.every((r) => r.phase === PHASE_CLEARED)).toBe(true);
    for (const room of map.rooms) {
      const [c, r] = room.entry[0].cells[0];
      Object.assign(sim.players[0], { x: c + 0.5, y: r + 0.5, z: map.floor[r * map.w + c] });
      for (let tick = 0; tick < 160; tick++) sim.step(); // Longer than the inherited all-in countdown.
      expect(sim.activeRoom).toBe(ROOM_NONE);
      expect(sim.living).toBe(0);
      expect(sim.result).toBeNull();
      for (const leaf of room.leaves) for (const [x, y] of leaf.cells) {
        expect(map.solid[y * map.w + x]).toBe(0);
        expect(map.top[y * map.w + x]).toBe(map.floor[y * map.w + x]);
      }
    }
    const joiner = sim.addPlayer({ id: 1, name: 'Bot', classId: 'binder', bot: true })!;
    expect(joiner.bot).toBe(true);
    expect(joiner.dead).toBe(false);
    expect([joiner.x, joiner.y, joiner.z]).toEqual([sim.players[0].x, sim.players[0].y, sim.players[0].z]);
  });

  it('honors an explicit room=0 and clamps an oversized room to the boss entry', () => {
    for (const requested of [0, 31]) {
      const { def, map } = loadRunMap(generated);
      const sim = new Simulation({ dungeon: def, map, players: [...players], seed: 7, walkOnly: true, startRoom: requested });
      const [c, r] = map.rooms[Math.min(requested, map.rooms.length - 1)].entry[0].cells[0];
      expect([sim.players[0].x, sim.players[0].y, sim.players[0].z]).toEqual([c + 0.5, r + 0.5, map.floor[r * map.w + c]]);
    }
  });

  it('default generated starts use Breach spawns and simulation state is fresh on a new load', () => {
    const a = loadRunMap(generated);
    const sim = new Simulation({ dungeon: a.def, map: a.map, players: [...players], seed: 7, walkOnly: true });
    const [c, r] = a.map.spawns[0];
    expect([sim.players[0].x, sim.players[0].y]).toEqual([c + 0.5, r + 0.5]);
    sim.rooms[0].phase = PHASE_COUNTDOWN;
    sim.map.solid[r * sim.map.w + c] = 1;
    const b = loadRunMap(generated);
    expect(b.map).not.toBe(a.map);
    expect(b.map.solid[r * b.map.w + c]).toBe(0);
    expect(floorHash(b.def)).toBe(PINNED.floorHash);
  });

  it('fixed fixtures retain encounters, and unknown fixtures fail loading', () => {
    const { def, map, floor } = loadRunMap({ ...generated, fixture: 'pearly-gates' });
    expect(floor).toBeNull();
    expect(map.id).toBe('pearly-gates');
    const sim = new Simulation({ dungeon: def, map, players: [...players], seed: 7 });
    const [c, r] = map.rooms[0].entry[0].cells[0];
    Object.assign(sim.players[0], { x: c + 0.5, y: r + 0.5, z: map.floor[r * map.w + c] });
    sim.step();
    expect(sim.activePhase).toBe(PHASE_COUNTDOWN);
    expect(() => loadRunMap({ ...generated, fixture: 'missing' })).toThrow('Unknown dungeon fixture missing');
  });
});
