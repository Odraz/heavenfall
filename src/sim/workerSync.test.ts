import { XP_GAIN } from './rewards';
import { afterEach, expect, it, vi } from 'vitest';
import type { MainToWorker, WorkerToMain } from './workerMessages';
import { decodeSnapshot, encodeInput, type InputMsg } from '../net/protocol';
import { INPUT_DEFAULTS } from './testutil/sims';

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

it('sends an uncommitted loading refund before rejection can close the guest transport', async () => {
  vi.useFakeTimers(); vi.resetModules();
  const { createProfile } = await import('../profile/model');
  const { stakeProfile, applyProgress } = await import('../profile/lifecycle');
  const messages: WorkerToMain[] = [];
  const ctx = { postMessage: (m: WorkerToMain) => messages.push(m), onmessage: (_e: MessageEvent<MainToWorker>) => {} };
  vi.stubGlobal('self', ctx); await import('./worker');
  const send = (data: MainToWorker) => ctx.onmessage({ data } as MessageEvent<MainToWorker>);
  const host = createProfile('Host', '1'.repeat(32), 1), guest = createProfile('Guest', '2'.repeat(32), 1);
  guest.inventory[0] = { item: 'feather', count: 2 };
  try {
    send({ t: 'host', heaven: 1, fixture: null, password: '', name: host.name, god: false, bot: false, profile: host, progressionEnabled: true });
    send({ t: 'ctrl', playerId: 0, msg: { type: 'pickClass', classId: 'fallen' } });
    send({ t: 'connCtrl', conn: 1, msg: { type: 'hello', name: guest.name, password: '', version: __BUILD_VERSION__, bot: false, profile: guest } });
    send({ t: 'connCtrl', conn: 1, msg: { type: 'pickClass', classId: 'heretic' } }); send({ t: 'startGame' });
    let saved = guest;
    for (const m of [...messages]) if (m.t === 'ctrl' && m.msg.type === 'admission') {
      if (m.to === 1) saved = stakeProfile(saved, m.msg.admission);
      else send({ t: 'ctrl', playerId: 0, msg: { type: 'admissionReady', runId: m.msg.admission.runId, admissionId: m.msg.admission.admissionId } });
    }
    send({ t: 'ctrl', playerId: 0, msg: { type: 'ready' } }); messages.length = 0;
    vi.advanceTimersByTime(21000);
    const refund = messages.findIndex(m => m.t === 'ctrl' && m.to === 1 && m.msg.type === 'progress' && m.msg.state.outcome === 'admissionAborted');
    const rejection = messages.findIndex(m => m.t === 'ctrl' && m.to === 1 && m.msg.type === 'reject');
    expect(refund).toBeGreaterThanOrEqual(0); expect(refund).toBeLessThan(rejection);
    const m = messages[refund];
    if (m.t !== 'ctrl' || m.msg.type !== 'progress') throw Error('Missing refund');
    saved = applyProgress(saved, m.msg.state)!;
    expect(saved.run).toBeNull(); expect(saved.inventory).toEqual(guest.inventory); expect(saved.stats.runs).toBe(0);
  } finally { send({ t: 'stop' }); }
});

it('publishes victory before exit, then saves post-win purchases in the same settlement', async () => {
  vi.useFakeTimers(); vi.resetModules();
  const { Simulation } = await import('./sim');
  const { createProfile } = await import('../profile/model');
  const { stakeProfile, applyProgress } = await import('../profile/lifecycle');
  const { sealNow } = await import('./testutil/sims');
  const { stairPoints } = await import('./shop');
  const { PINNED } = await import('../gen/pinned');
  let sim: InstanceType<typeof Simulation> | undefined;
  const step = Simulation.prototype.step;
  const capture = vi.spyOn(Simulation.prototype, 'step').mockImplementation(function(this: InstanceType<typeof Simulation>, now?: number) { sim = this; return step.call(this, now); });
  const messages: WorkerToMain[] = [];
  const ctx = { postMessage: (m: WorkerToMain) => messages.push(m), onmessage: (_e: MessageEvent<MainToWorker>) => {} };
  vi.stubGlobal('self', ctx); await import('./worker');
  const send = (data: MainToWorker) => ctx.onmessage({ data } as MessageEvent<MainToWorker>);
  const profile = createProfile('Victory fixture', 'a'.repeat(32), 1);
  let saved = profile;
  const apply = () => {
    for (const m of messages) if (m.t === 'ctrl' && m.msg.type === 'progress') saved = applyProgress(saved, m.msg.state) ?? saved;
    messages.length = 0;
  };
  try {
    send({ t: 'start', runId: 'b'.repeat(32), seed: PINNED.seed, simSeed: 1, heaven: 1, floor: 1, edicts: 0, fixture: null,
      progressionEnabled: true, players: [{ id: 0, name: profile.name, classId: 'fallen', profile }], god: false,
      benchArena: -1, benchBurst: false, localPlayerId: 0, startRoom: 999 });
    expect(sim).toBeUndefined();
    const m = messages.find(m => m.t === 'ctrl' && m.msg.type === 'admission');
    if (!m || m.t !== 'ctrl' || m.msg.type !== 'admission') throw Error('No admission');
    saved = stakeProfile(saved, m.msg.admission);
    send({ t: 'ctrl', playerId: 0, msg: { type: 'admissionReady', runId: m.msg.admission.runId, admissionId: m.msg.admission.admissionId } });
    expect(sim).toBeDefined(); const live = sim!; apply(); expect(saved.stats.runs).toBe(1);
    sealNow(live, live.floor!.boss);
    live.players[0].wallet = 500;
    live.damageEnemy(live.bossSlot, 100000, 0); vi.advanceTimersByTime(35); apply();
    expect(live.won).toBe(true); expect(live.result).toBeNull();
    expect(saved.run).toBeNull(); expect(saved.stats.wins).toBe(1); expect(saved.characters.fallen.xp).toBe(1500 * XP_GAIN);
    const p = live.players[0], at = stairPoints(live.map, live.floor!.boss)[1];
    Object.assign(p, { x: at.x, y: at.y + 1, z: at.z, yaw: -Math.PI / 2, pitch: Math.atan2(-.6, 1) });
    send({ t: 'ctrl', playerId: 0, msg: { type: 'interact', runId: live.runId, requestId: 1, sourceId: 5 } }); apply();
    expect(p.sold).toBe(1); expect(saved.inventory).toEqual(p.inventory); expect(saved.inventory[0]).not.toBeNull();
    const after = structuredClone(saved), wallet = p.wallet;
    send({ t: 'ctrl', playerId: 0, msg: { type: 'interact', runId: live.runId, requestId: 1, sourceId: 5 } }); apply();
    expect(p.wallet).toBe(wallet); expect(saved.stats).toEqual(after.stats); expect(saved.heavens.clears[1]).toBe(1);
    Object.assign(p, stairPoints(live.map, live.floor!.boss)[0]); vi.advanceTimersByTime(3200); apply();
    expect(live.result).toBe('victory'); expect(saved.stats.wins).toBe(1); expect(saved.inventory).toEqual(after.inventory);
  } finally { send({ t: 'stop' }); capture.mockRestore(); }
});

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
