import { afterEach, expect, it, vi } from 'vitest';
import type { MainToWorker, WorkerToMain } from './workerMessages';
import { decodeSnapshot, encodeInput, type InputMsg } from '../net/protocol';
import { INPUT_DEFAULTS } from './testutil/sims';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('sends go then a checkpoint before snapshots/events for every starter and a late joiner', async () => {
  vi.useFakeTimers(); vi.resetModules();
  const messages: WorkerToMain[] = [];
  const ctx = { postMessage: (m: WorkerToMain) => messages.push(m), onmessage: (_e: MessageEvent<MainToWorker>) => {} };
  vi.stubGlobal('self', ctx);
  await import('./worker');
  const send = (data: MainToWorker) => ctx.onmessage({ data } as MessageEvent<MainToWorker>);
  try {
    send({ t: 'host', heaven: 1, fixture: null, password: '', name: 'Host', god: true, bot: false });
    send({ t: 'ctrl', playerId: 0, msg: { type: 'pickClass', classId: 'fallen' } });
    send({ t: 'connCtrl', conn: 1, msg: { type: 'hello', name: 'Guest', password: '', version: __BUILD_VERSION__, bot: false } });
    send({ t: 'connCtrl', conn: 1, msg: { type: 'pickClass', classId: 'binder' } });
    send({ t: 'startGame' });
    const start = messages.find((m) => m.t === 'ctrl' && m.msg.type === 'start');
    expect(start).toBeDefined();
    messages.length = 0;
    send({ t: 'ctrl', playerId: 0, msg: { type: 'ready' } });
    send({ t: 'connCtrl', conn: 1, msg: { type: 'ready' } });
    expect(messages[0]).toMatchObject({ t: 'ctrl', to: 'all', msg: { type: 'go' } });
    for (const id of [0, 1]) expect(messages[id + 1]).toMatchObject({ t: 'ctrl', to: id, msg: { type: 'floorSync', tick: 0 } });
    const checkpoints = messages.filter((m) => m.t === 'ctrl' && m.msg.type === 'floorSync');
    expect(checkpoints[0].t === 'ctrl' && checkpoints[0].msg).toEqual(checkpoints[1].t === 'ctrl' && checkpoints[1].msg);
    send({ t: 'connCtrl', conn: 2, msg: { type: 'hello', name: 'Late', password: '', version: __BUILD_VERSION__, bot: false } });
    send({ t: 'connCtrl', conn: 2, msg: { type: 'pickClass', classId: 'heretic' } });
    send({ t: 'connCtrl', conn: 2, msg: { type: 'enterGame' } });
    messages.length = 0;
    send({ t: 'connCtrl', conn: 2, msg: { type: 'ready' } });
    expect(messages[0]).toMatchObject({ t: 'ctrl', to: 2, msg: { type: 'go' } });
    expect(messages[1]).toMatchObject({ t: 'ctrl', to: 2, msg: { type: 'floorSync', tick: 1 } });
    vi.advanceTimersByTime(35);
    const teleport = messages.findIndex((m) => m.t === 'ctrl' && m.to === 2 && m.msg.type === 'event' && m.msg.event.type === 'teleport');
    expect(teleport).toBeGreaterThan(1);
    expect(messages[1].t === 'ctrl' && messages[1].msg.type === 'floorSync' && messages[1].msg.runId).toBe(
      start?.t === 'ctrl' && start.msg.type === 'start' && start.msg.runId);
  } finally { send({ t: 'stop' }); }
});

it('rejects invalid and stale-run input before sequence/counter history and starts twice in the same worker without carry-over', async () => {
  vi.useFakeTimers(); vi.resetModules();
  const messages: WorkerToMain[] = [];
  const ctx = { postMessage: (m: WorkerToMain) => messages.push(m), onmessage: (_e: MessageEvent<MainToWorker>) => {} };
  vi.stubGlobal('self', ctx); await import('./worker');
  const send = (data: MainToWorker) => ctx.onmessage({ data } as MessageEvent<MainToWorker>);
  const start: Extract<MainToWorker, { t: 'start' }> = {
    t: 'start', runId: '1'.repeat(32), seed: 1, simSeed: 2, heaven: 1, floor: 1, edicts: 0, progressionEnabled: false,
    fixture: 'sandbox', players: [{ id: 0, name: 'Host', classId: 'fallen', bot: false }], god: true,
    benchArena: -1, benchBurst: false, localPlayerId: 0,
  };
  const latest = () => {
    const m = [...messages].reverse().find((m) => m.t === 'snap');
    if (!m || m.t !== 'snap') throw new Error('missing snapshot');
    return decodeSnapshot(m.bufs[0])!;
  };
  const input = (m: InputMsg) => send({ t: 'input', playerId: 0, buf: encodeInput(m) });
  try {
    send(start);
    const baseline = latest(); const p = baseline.players[0];
    const frame: InputMsg = { ...INPUT_DEFAULTS, runId: start.runId, seq: 1, x: p.x + 0.1, y: p.y, z: p.z,
      yaw: 1.5, pitch: 0, fire: 0, qPresses: 1, ePresses: 0, allyTargetId: 255, lastTeleportId: 0 };
    input({ ...frame, runId: 'f'.repeat(32), seq: 0xffffffff, qPresses: 99 });
    for (const offset of [4, 8, 12, 16, 20, 48, 24]) {
      const buf = encodeInput({ ...frame, seq: 900, qPresses: 99 });
      const v = new DataView(buf);
      if (offset < 24) v.setFloat32(offset, NaN, true); else v.setUint8(offset, 0x80);
      send({ t: 'input', playerId: 0, buf });
    }
    send({ t: 'input', playerId: 0, buf: new ArrayBuffer(30) });
    input(frame); vi.advanceTimersByTime(100);
    expect(latest().players[0].x).toBeCloseTo(frame.x, 5); expect(latest().players[0].yaw).toBe(1.5);
    const abilities = messages.filter((m) => m.t === 'ctrl' && m.msg.type === 'event' && m.msg.event.type === 'abilityUsed');
    expect(abilities).toHaveLength(1);
    expect(abilities[0]).toMatchObject({ msg: { runId: start.runId, tick: 2, revision: 1, event: { slot: 'Q' } } });
    send({ t: 'pause', paused: true });
    expect(vi.getTimerCount()).toBe(1);
    messages.length = 0;
    const next = { ...start, runId: '2'.repeat(32) };
    send(next);
    expect(vi.getTimerCount()).toBe(1);
    expect(latest()).toEqual({ ...baseline, runId: next.runId });
    expect(messages[1]).toMatchObject({ t: 'ctrl', msg: { type: 'floorSync', runId: next.runId, tick: 0, revision: 0 } });
    expect(messages.some((m) => m.t === 'ctrl' && m.msg.type === 'event')).toBe(false);
    // Old high sequences, teleports and presses cannot poison the restarted slot.
    input({ ...frame, seq: 0xffffffff, lastTeleportId: 65535 });
    input({ ...frame, runId: next.runId }); vi.advanceTimersByTime(100);
    expect(latest().players[0].yaw).toBe(1.5);
    expect(latest().tick).toBeGreaterThan(1); // Pause did not survive.
    expect(messages.filter((m) => m.t === 'ctrl' && m.msg.type === 'event' && m.msg.event.type === 'abilityUsed')).toHaveLength(1);
    expect(messages.filter((m) => m.t === 'ctrl' && m.msg.type === 'event').every((m) => m.t === 'ctrl' && m.msg.type === 'event' && m.msg.runId === next.runId)).toBe(true);
  } finally { send({ t: 'stop' }); }
  expect(vi.getTimerCount()).toBe(0);
});

it('reuses the worker after victory with fresh boss, entities, room state and event identity', async () => {
  vi.useFakeTimers(); vi.resetModules();
  const messages: WorkerToMain[] = [];
  const ctx = { postMessage: (m: WorkerToMain) => messages.push(m), onmessage: (_e: MessageEvent<MainToWorker>) => {} };
  vi.stubGlobal('self', ctx); await import('./worker');
  const send = (data: MainToWorker) => ctx.onmessage({ data } as MessageEvent<MainToWorker>);
  const start: Extract<MainToWorker, { t: 'start' }> = {
    t: 'start', runId: '3'.repeat(32), seed: 1, simSeed: 2, heaven: 1, floor: 1, edicts: 0, progressionEnabled: false,
    fixture: 'pearly-gates', startRoom: 3, players: [{ id: 0, name: 'Host', classId: 'fallen', bot: false }], god: true,
    benchArena: -1, benchBurst: false, localPlayerId: 0,
  };
  const latest = () => {
    const m = [...messages].reverse().find((m) => m.t === 'snap');
    if (!m || m.t !== 'snap') throw new Error('missing snapshot');
    return decodeSnapshot(m.bufs[0])!;
  };
  try {
    send(start); vi.advanceTimersByTime(3200);
    expect(latest().bossHp).toBeGreaterThan(0); expect(latest().enemyCount).toBeGreaterThan(0);
    send({ t: 'killAll' }); vi.advanceTimersByTime(35);
    const over = messages.find((m) => m.t === 'ctrl' && m.msg.type === 'event' && m.msg.event.type === 'gameOver');
    expect(over).toMatchObject({ msg: { runId: start.runId, event: { result: 'victory' } } });
    expect(vi.getTimerCount()).toBe(0);
    messages.length = 0;
    const next = { ...start, runId: '4'.repeat(32), fixture: 'sandbox', startRoom: undefined };
    send(next);
    expect(messages[0]).toMatchObject({ msg: { type: 'go' } });
    expect(messages[1]).toMatchObject({ msg: { type: 'floorSync', runId: next.runId, tick: 0, revision: 0,
      rooms: [{ phase: 0, knowledge: 0, refills: 3 }] } });
    expect(latest()).toMatchObject({ runId: next.runId, tick: 1, stateRevision: 0, activeRoom: 255,
      clearedMask: 0, enemyCount: 0, projectileCount: 0, bossHp: 0, bossMaxHp: 0,
      players: [{ hp: 400, kills: 0, cdQ: 0, cdE: 0, dead: false, shots: 0, shots2: 0 }] });
    vi.advanceTimersByTime(100);
    expect(latest().tick).toBeGreaterThan(1);
    expect(messages.some((m) => m.t === 'ctrl' && m.msg.type === 'event')).toBe(false);
  } finally { send({ t: 'stop' }); }
});
