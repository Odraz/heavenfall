import { describe, expect, it } from 'vitest';
import { PINNED } from '../gen/pinned';
import { PHASE_CLEARED, PHASE_COUNTDOWN, PHASE_IDLE, decodeSnapshot } from '../net/protocol';
import { loadRunMap } from './runMap';
import { Simulation } from './sim';

function make(bots = [false]) {
  const { def, map } = loadRunMap({ heaven: 1, floor: 1, seed: PINNED.seed, fixture: null });
  return new Simulation({ dungeon: def, map, seed: 1, god: true,
    players: bots.map((bot, id) => ({ id, name: `P${id}`, classId: 'binder', bot })) });
}
function put(sim: Simulation, player: number, room: number) {
  const [c, r] = sim.map.rooms[room].entry[0].cells[player];
  Object.assign(sim.slots[player]!, { x: c + 0.5, y: r + 0.5, z: sim.map.floor[r * sim.map.w + c] });
}

describe('R1.5 party discovery', () => {
  it('starts with the Breach visited and exactly its vestibule neighbours discovered', () => {
    const sim = make(), neighbours = sim.map.rooms[0].leaves.map((l) => l.to);
    expect(sim.rooms[0]).toMatchObject({ knowledge: 2, phase: PHASE_CLEARED });
    sim.rooms.slice(1).forEach((r, i) => expect(r.knowledge).toBe(neighbours.includes(i + 1) ? 1 : 0));
    expect(sim.stateRevision).toBe(neighbours.length);
  });

  it('visits/reveals once even when a scout cannot start a second encounter; cancelled rooms stay visited', () => {
    const sim = make([false, false, false]);
    const combat = sim.map.rooms.flatMap((r, i) => r.kind === 'combat' ? [i] : []);
    sim.events.length = 0; put(sim, 0, combat[0]); sim.step();
    expect(sim.rooms[combat[0]].phase).toBe(PHASE_COUNTDOWN);
    const header = decodeSnapshot(sim.encodeFor(0)[0])!;
    expect(header.hold).toBe(0x80 | 8 | 3);
    put(sim, 1, combat[1]); sim.step();
    expect(sim.rooms[combat[1]]).toMatchObject({ knowledge: 2, phase: PHASE_IDLE });
    for (const l of sim.map.rooms[combat[1]].leaves) expect(sim.rooms[l.to].knowledge).toBeGreaterThanOrEqual(1);
    const revision = sim.stateRevision; sim.events.length = 0; sim.step();
    expect(sim.stateRevision).toBe(revision);
    expect(sim.events.filter((e) => e.event.type === 'roomState')).toEqual([]);
    put(sim, 0, 0); for (let i = 0; i < 90; i++) sim.step();
    expect(sim.rooms[combat[0]]).toMatchObject({ knowledge: 2, phase: PHASE_IDLE });
  });

  it('bots, souls and disconnected humans cannot discover rooms', () => {
    const sim = make([false, true, false]);
    const room = sim.rooms.findIndex((r) => r.knowledge === 0);
    sim.slots[0]!.dead = true; sim.slots[2]!.connected = false;
    for (let id = 0; id < 3; id++) put(sim, id, room);
    sim.step(); expect(sim.rooms[room].knowledge).toBe(0);
  });

  it('a joiner receives all room records including selected entry, refills, phases and current tick/revision', () => {
    const sim = make();
    const room = sim.map.rooms.findIndex((r) => r.kind === 'combat');
    put(sim, 0, room); sim.step();
    sim.rooms[room].refills = 1;
    sim.addPlayer({ id: 1, name: 'Late', classId: 'fallen' });
    const sync = sim.floorSync('test-run');
    expect(sync).toMatchObject({ type: 'floorSync', runId: 'test-run', tick: sim.tick, revision: sim.stateRevision });
    expect(sync.rooms).toEqual(sim.rooms.map(({ phase, knowledge, entrySocket, refills }) => ({ phase, knowledge, entrySocket, refills })));
    expect(new TextEncoder().encode(JSON.stringify(sync)).length).toBeLessThan(1024);
    sim.rooms[room].refills = 0;
    expect(sync.rooms[room].refills).toBe(1);
  });
});
