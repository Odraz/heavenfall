import { expect, it } from 'vitest';
import { PropProjection } from './props';
import type { FloorSync } from '../net/messages';

it('restores broken props and existing blast deadlines atomically without replaying pre-checkpoint effects', () => {
  const defs = [1, 2].map((id) => ({ id, room: 0, family: 'blast' as const, x: id, y: 2, marked: false, variant: 0 }));
  const model = new PropProjection('run', defs);
  const sync: FloorSync = { type: 'floorSync', runId: 'run', tick: 20, revision: 10, rooms: [], brokenProps: [1], propBlasts: [{ id: 1, impactTick: 25 }] };
  expect(model.sync(sync)).toBe(true); expect(model.blasts.get(1)).toBe(25);
  expect(model.sync({ ...sync, brokenProps: [2, 999] })).toBe(false); expect([...model.broken]).toEqual([1]);
  const broken = { type: 'propBroken' as const, id: 1, family: 'blast' as const, x: 1, y: 2, z: 0, marked: false, impactTick: 25, targets: [] };
  expect(model.event(broken, 10)).toBe(false);
  expect(model.event({ type: 'propBlast', id: 1, x: 1, y: 2, z: 0 }, 11)).toBe(true);
  expect(model.blasts.size).toBe(0); expect(model.event(broken, 12)).toBe(false);
  expect(model.blasts.size).toBe(0); expect(model.sync({ ...sync, revision: 11 })).toBe(false);
});

it('rejects malformed checkpoint siblings and event bodies without poisoning the last valid revision', () => {
  const model = new PropProjection('run', [{ id: 1, room: 0, family: 'loot', x: 1, y: 2, marked: false, variant: 0 }]);
  const sync: FloorSync = { type: 'floorSync', runId: 'run', tick: 0, revision: 1, rooms: [], brokenProps: [] };
  expect(model.sync(sync)).toBe(true);
  for (const patch of [{ brokenProps: 'bad' }, { propBlasts: [null] }, { revision: NaN }]) expect(model.sync({ ...sync, ...patch } as unknown as FloorSync)).toBe(false);
  const e = { type: 'propBroken' as const, id: 1, family: 'loot' as const, x: 1, y: 2, z: 0, marked: false, impactTick: -1, targets: [] };
  expect(model.event({ ...e, targets: [99] }, 99)).toBe(false);
  expect(model.event({ ...e, x: Infinity }, 99)).toBe(false);
  expect(model.event(e, 2)).toBe(true); expect([...model.broken]).toEqual([1]);
});
