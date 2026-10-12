import { afterEach, expect, it, vi } from 'vitest';
import type { MainToWorker, WorkerToMain } from './workerMessages';

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
