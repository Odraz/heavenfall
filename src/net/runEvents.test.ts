import { expect, it } from 'vitest';
import type { CtrlMessage } from './messages';
import { RunEvents } from './runEvents';

it('drops foreign/duplicate events without poisoning the reliable revision; another run starts fresh', () => {
  const id = '0'.repeat(32), next = '1'.repeat(32);
  const events = new RunEvents(id);
  const msg: Extract<CtrlMessage, { type: 'event' }> = {
    type: 'event', runId: id, tick: 7, revision: 3,
    event: { type: 'teleport', teleportId: 1, x: 4.5, y: 5.5, z: 0 },
  };
  expect(events.accept({ ...msg, runId: next, tick: 0xffffffff, revision: 0xffffffff })).toBe(false);
  for (const bad of [{ ...msg, tick: NaN }, { ...msg, tick: -1 }, { ...msg, revision: 1.5 }, { ...msg, revision: 0x1_0000_0000 }]) {
    expect(events.accept(bad)).toBe(false);
  }
  expect(events.accept(msg)).toBe(true);
  expect(events.accept(msg)).toBe(false);
  expect(events.accept({ ...msg, revision: 2 })).toBe(false);
  // A later snapshot must not make this reliable event stale: these are independent channels.
  expect(events.accept({ ...msg, revision: 4 })).toBe(true);
  const fresh = new RunEvents(next);
  expect(fresh.accept(msg)).toBe(false);
  expect(fresh.accept({ ...msg, runId: next, tick: 1, revision: 1 })).toBe(true);
});
