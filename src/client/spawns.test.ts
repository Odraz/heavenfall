import { expect, it } from 'vitest';
import { SpawnProjection } from './spawns';
import type { FloorSync, GameEvent } from '../net/messages';
import type { SpawnWarning } from '../data/spawns';
const w: SpawnWarning = { id: 1, room: 0, x: 4, y: 5, z: 0, startTick: 100, readyTick: 130 };
const event = (phase: 'start' | 'cancel', warning = w): Extract<GameEvent, { type: 'spawnWarning' }> => ({ type: 'spawnWarning', phase, warning: { ...warning } });
const sync = (revision = 2): FloorSync => ({ type: 'floorSync', runId: 'run', tick: 120, revision, rooms: [], spawnWarnings: [{ ...w }] });
it('catches up to the original deadline and refuses replay, malformed or foreign checkpoints atomically', () => {
  const p = new SpawnProjection('run'); expect(p.sync(sync())).toBe(true);
  expect(p.live(120)).toEqual([w]); expect(p.event(event('start'), 100, 3)).toBe(false);
  expect(p.sync({ ...sync(99), runId: 'other' })).toBe(false);
  expect(p.sync({ ...sync(99), spawnWarnings: [{ ...w, readyTick: 131 }] })).toBe(false);
  expect(p.sync({ ...sync(99), spawnWarnings: [w, w] })).toBe(false);
  expect(p.sync({ ...sync(99), tick: NaN })).toBe(false);
  expect(p.sync({ ...sync(99), spawnWarnings: [null] } as unknown as FloorSync)).toBe(false);
  expect(p.revision).toBe(2); expect(p.live(130)).toEqual([]);
  expect(p.event(event('start'), 100, 4)).toBe(false);
});
it('cancels only an immutable known identity, does not consume invalid revisions and resets with a new run', () => {
  const p = new SpawnProjection('run'); expect(p.event(event('start'), 100, 1)).toBe(true);
  expect(p.event(event('cancel', { ...w, x: 99 }), 101, 99)).toBe(false);
  expect(p.event(event('cancel'), 101, 2)).toBe(true);
  expect(p.event(event('cancel'), 102, 3)).toBe(false);
  expect(p.event(event('start', { ...w, id: 2, startTick: 105, readyTick: 135 }), 105, 3)).toBe(true);
  expect(p.sync(sync())).toBe(false);
  expect(new SpawnProjection('new').event(event('start'), 100, 1)).toBe(true);
});
