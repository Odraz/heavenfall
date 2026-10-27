/** R9 stage 3: the acceptance evidence log's records and bounds, and the `bosshp` start. */
import { describe, expect, it } from 'vitest';
import { PHASE_CLEARED } from '../net/protocol';
import { TICK_HZ } from './constants';
import { EVIDENCE_RECORD_BYTES, EVIDENCE_ROOM_CAP, EvidenceLog, type EvidenceRecord, type RoomEvidence, type RunEvidence } from './evidence';
import { arenaSim, sealAt } from './testutil/arenas';

const wave = { blessed: 12, choristers: 0, cherubs: 0 };

/** A sealed arena with the log attached; `ms` is the fed tick time. */
function logged(players = 2) {
  const sim = arenaSim([wave, wave], { players, god: true });
  const out: EvidenceRecord[] = [];
  const log = new EvidenceLog(sim, 'test-build', (r) => out.push(r));
  sim.evidence = log;
  const step = (ms = 2) => { sim.step(); log.observe(ms); sim.events.length = 0; };
  return { sim, out, log, step };
}

describe('the evidence log (R9 stage 3)', () => {
  it('writes one room record when the room clears, on the simulation clock', () => {
    const { sim, out, step } = logged();
    for (const p of sim.players) { p.x = 8.5; p.y = 5.5; p.z = 0; }
    sealAt(sim);
    sim.evidence!.observe(1);
    sim.events.length = 0;
    let peak = 0;
    for (let i = 0; i < 60 * TICK_HZ && sim.rooms[0].phase !== PHASE_CLEARED; i++) {
      step(i === 10 ? 7 : 2);
      peak = Math.max(peak, sim.rooms[0].alive);
      if (i % 15 === 14) sim.killAll();
    }
    expect(sim.rooms[0].phase).toBe(PHASE_CLEARED);
    const rooms = out.filter((r): r is RoomEvidence => r.record === 'room');
    expect(rooms).toHaveLength(1);
    const r = rooms[0];
    expect(r).toMatchObject({ room: 0, kind: 'combat', crestS: null, simMsMax: 7, deaths: 0, revives: 0 });
    expect(r.peakAlive).toBe(peak);
    expect(r.peakAlive).toBeGreaterThan(0);
    expect(r.clearedS!).toBeGreaterThan(r.sealedS);
    expect(r.simMsAvg).toBeGreaterThan(2);
    expect(r.simMsAvg).toBeLessThan(2.2);
    expect(JSON.stringify(r).length).toBeLessThanOrEqual(EVIDENCE_RECORD_BYTES);
  });

  it('counts each human decision once, never a bot\'s, and attributes it to the next room record', () => {
    const { sim, out, log } = logged(2);
    const [a, b] = sim.players;
    log.decision(a, 'purchase');
    log.decision(a, 'rite');
    log.decision(b, 'ritePass');
    b.bot = true;
    log.decision(b, 'item');
    sealAt(sim);
    log.observe(1);
    sim.killAll();
    for (let i = 0; i < 60 * TICK_HZ && sim.rooms[0].phase !== PHASE_CLEARED; i++) { sim.step(); log.observe(1); sim.events.length = 0; sim.killAll(); }
    const r = out.find((x): x is RoomEvidence => x.record === 'room')!;
    expect(r.decisions[a.id]).toMatchObject({ purchase: 1, rite: 1, item: 0 });
    expect(r.decisions[b.id]).toMatchObject({ ritePass: 1, item: 0 });
  });

  it('writes the run record at gameOver with the roster, seed and totals, under 2 KB', () => {
    const { sim, out, log } = logged(4);
    log.decision(sim.players[0], 'bell');
    sim.emit('all', { type: 'gameOver', result: 'defeat', timeMs: 1000, stats: {} } as never);
    log.observe(1);
    const run = out.find((x): x is RunEvidence => x.record === 'run')!;
    expect(run).toMatchObject({ seed: sim.seed, build: 'test-build', result: 'defeat', rooms: 0, roomsDropped: 0, loadMs: null, mapBuildMs: null });
    expect(run.roster.map((p) => p.classId)).toEqual(sim.players.map((p) => p.classId));
    expect(run.decisions[0].bell).toBe(1);
    expect(JSON.stringify(run).length).toBeLessThanOrEqual(EVIDENCE_RECORD_BYTES);
    // Nothing after the run record.
    log.decision(sim.players[0], 'bell');
    sim.emit('all', { type: 'gameOver', result: 'victory', timeMs: 1000, stats: {} } as never);
    log.observe(1);
    expect(out.filter((x) => x.record === 'run')).toHaveLength(1);
  });

  it('keeps at most 32 room records and counts the rest as dropped', () => {
    const { sim, out, log } = logged(1);
    for (let i = 0; i < EVIDENCE_ROOM_CAP + 3; i++) {
      sim.emit('all', { type: 'roomState', room: 0, phase: 1, knowledge: 2, entrySocket: 0 });
      sim.emit('all', { type: 'roomState', room: 0, phase: PHASE_CLEARED, knowledge: 2, entrySocket: 0 });
      log.observe(1);
      sim.events.length = 0;
    }
    sim.emit('all', { type: 'gameOver', result: 'victory', timeMs: 1000, stats: {} } as never);
    log.observe(1);
    expect(out.filter((x) => x.record === 'room')).toHaveLength(EVIDENCE_ROOM_CAP);
    expect(out.find((x): x is RunEvidence => x.record === 'run')).toMatchObject({ rooms: EVIDENCE_ROOM_CAP, roomsDropped: 3 });
  });

  it('counts a route choice for every connected human when a room is entered with two or more open', () => {
    const { sim, out, log } = logged(2);
    sim.emit('all', { type: 'roomState', room: 5, phase: 0, knowledge: 1, entrySocket: 0 });
    sim.emit('all', { type: 'roomState', room: 6, phase: 0, knowledge: 1, entrySocket: 0 });
    sim.emit('all', { type: 'roomState', room: 5, phase: 0, knowledge: 2, entrySocket: 0 });
    // Only one left open: entering it is no choice.
    sim.emit('all', { type: 'roomState', room: 6, phase: 0, knowledge: 2, entrySocket: 0 });
    sim.emit('all', { type: 'gameOver', result: 'victory', timeMs: 1000, stats: {} } as never);
    log.observe(1);
    const run = out.find((x): x is RunEvidence => x.record === 'run')!;
    expect(run.decisions[0].route).toBe(1);
    expect(run.decisions[1].route).toBe(1);
  });
});
