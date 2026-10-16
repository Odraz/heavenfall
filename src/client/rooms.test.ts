import { describe, expect, it } from 'vitest';
import { PINNED } from '../gen/pinned';
import { PHASE_CLEARED, PHASE_COMBAT, PHASE_COUNTDOWN, PHASE_IDLE } from '../net/protocol';
import { loadRunMap } from '../sim/runMap';
import { Simulation } from '../sim/sim';
import { ClientRooms, roomMessage } from './rooms';

function make() {
  const { def, map } = loadRunMap({ heaven: 1, floor: 1, seed: PINNED.seed, fixture: null });
  const sim = new Simulation({ dungeon: def, map, seed: 1, players: [{ id: 0, name: 'P', classId: 'fallen' }] });
  return { sim, model: new ClientRooms(map, 'run') };
}
describe('R1.5 client room projection', () => {
  it('does not replay room transitions at or before a reliable checkpoint revision', () => {
    const { sim, model } = make(); const sync = sim.floorSync('run'); model.sync(sync);
    const room = sim.map.rooms.findIndex((r) => r.kind === 'combat');
    const e = { type: 'roomState' as const, room, phase: PHASE_COMBAT, knowledge: 2, entrySocket: model.states[room].entrySocket };
    expect(model.event(e, sync.revision - 1)).toBe(false);
    expect(model.event(e, sync.revision)).toBe(false); expect(model.states[room].knowledge).toBe(sync.rooms[room].knowledge);
    expect(model.event(e, sync.revision + 1)).toBe(true); expect(model.states[room].knowledge).toBe(2);
  });
  it('applies a complete checkpoint and rejects wrong runs, incomplete/invalid siblings and older revisions atomically', () => {
    const { sim, model } = make(); const sync = sim.floorSync('run');
    expect(model.sync(sync)).toBe(true); const before = structuredClone(model.states);
    for (const bad of [
      { ...sync, runId: 'previous' }, { ...sync, rooms: sync.rooms.slice(1) }, { ...sync, revision: -1 },
      { ...sync, rooms: sync.rooms.map((s, i) => i === 1 ? { ...s, knowledge: 3 } : s) },
      { ...sync, rooms: sync.rooms.map((s, i) => i === 1 ? { ...s, entrySocket: 99 } : s) },
      { ...sync, rooms: sync.rooms.map((s, i) => i === 1 ? { ...s, refills: 4 } : s) },
    ]) { expect(model.sync(bad)).toBe(false); expect(model.states).toEqual(before); }
    expect(model.sync({ ...sync, revision: sync.revision + 1 })).toBe(true);
    expect(model.sync(sync)).toBe(false);
  });
  it('takes phase from snapshots, preserves newer phase across delayed catch-up, and never regresses knowledge', () => {
    const { sim, model } = make(); const sync = sim.floorSync('run'); model.sync(sync);
    const room = sim.map.rooms.findIndex((r) => r.kind === 'combat');
    model.snapshot({ tick: 10, activeRoom: room, activePhase: PHASE_COMBAT, clearedMask: 1 });
    expect(model.sync(sync)).toBe(true); expect(model.states[room].phase).toBe(PHASE_COMBAT);
    const e = { type: 'roomState' as const, room, phase: PHASE_COUNTDOWN, knowledge: 2, entrySocket: model.states[room].entrySocket };
    expect(model.event(e)).toBe(true); expect(model.states[room].phase).toBe(PHASE_COMBAT);
    expect(model.event(e)).toBe(false);
    model.event({ ...e, knowledge: 1 }); expect(model.states[room].knowledge).toBe(2);
    model.snapshot({ tick: 11, activeRoom: 255, activePhase: PHASE_IDLE, clearedMask: 1 | 1 << room });
    model.snapshot({ tick: 9, activeRoom: room, activePhase: PHASE_COUNTDOWN, clearedMask: 1 });
    expect(model.states[room].phase).toBe(PHASE_CLEARED);
    expect(model.event({ ...e, room: 999 })).toBe(false);
  });
  it('discovery events and replayed checkpoint states do not replay seal/clear feedback', () => {
    const { sim, model } = make(); sim.rooms[1].phase = PHASE_CLEARED;
    model.sync(sim.floorSync('run'));
    expect(model.event({ type: 'roomState', room: 1, phase: PHASE_CLEARED, knowledge: 2, entrySocket: sim.rooms[1].entrySocket })).toBe(false);
  });
  it('shows the competing-room hint only inside an idle ordinary combat room', () => {
    const { sim, model } = make(), room = sim.map.rooms.findIndex((r) => r.kind === 'combat');
    expect(roomMessage(model, room, room + 1, PHASE_COUNTDOWN)).toBe('Another room is sealing');
    expect(roomMessage(model, room, room, PHASE_COUNTDOWN)).toBeNull();
    expect(roomMessage(model, 0, room, PHASE_COMBAT)).toBeNull();
    expect(roomMessage(model, 255, room, PHASE_COMBAT)).toBeNull();
    expect(roomMessage(model, room, 255, PHASE_IDLE)).toBeNull();
  });
  it('identifies generated special-room fixtures at idle, countdown and combat, but not in corridors or fixed dungeons', () => {
    const { model } = make();
    for (const [kind, label] of [
      ['pardoner', 'The Pardoner · Personal stock · Aim and press F to buy'],
      ['confessional', 'The Confessional · Press F at the grille: the Advocate teaches and resets talents'],
      ['boss', 'The Gatekeeper · Inherited fight fixture (authored encounter arrives in R7)'],
    ] as const) {
      const room = model.map.rooms.findIndex((r) => r.kind === kind);
      for (const phase of [PHASE_IDLE, PHASE_COUNTDOWN, PHASE_COMBAT, PHASE_CLEARED]) {
        expect(roomMessage(model, room, room, phase)).toBe(label);
      }
    }
    expect(roomMessage(model, 255, 255, PHASE_IDLE)).toBeNull();
    const { map } = loadRunMap({ heaven: 1, floor: 1, seed: 1, fixture: 'pearly-gates' });
    const fixture = new ClientRooms(map, 'fixture');
    const boss = map.rooms.findIndex((r) => r.kind === 'boss');
    expect(roomMessage(fixture, boss, boss, PHASE_COMBAT)).toBeNull();
  });
});
