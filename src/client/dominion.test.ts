import { describe, expect, it } from 'vitest';
import { DominionProjection } from './dominion';
import type { FloorSync, GameEvent } from '../net/messages';
import type { Snapshot } from '../net/protocol';
import type { DominionCast } from '../data/dominion';

const cast: DominionCast = { slot: 2, incarnation: 10, castId: 3, room: 0, startTick: 100, impactTick: 145 };
const checkpoint = (revision = 4): FloorSync => ({ type: 'floorSync', runId: 'run', tick: 120, revision, rooms: [], dominionCasts: [{ ...cast }] });
const snapshot = (incarnation = 10): Snapshot => ({ runId: 'run', tick: 120, stateRevision: 4, totalDominionCasts: 1, dominionCasts: [{ ...cast }], enemyCount: 1, totalEnemyCount: 1,
  enemySlot: new Uint16Array([2]), enemyIncarnation: new Uint32Array([incarnation]), enemyType: new Uint8Array([4]), enemyState: new Uint8Array([2]),
  enemyX: new Float32Array([7]), enemyY: new Float32Array([8]), enemyZ: new Float32Array([1]) } as Snapshot);
const event = (phase: 'start' | 'strike' | 'cancel'): Extract<GameEvent, { type: 'dominionCast' }> => ({ type: 'dominionCast', phase, cast: { ...cast }, x: 7, y: 8, z: 1 });

describe('Dominion accepted projection', () => {
  it('admits each reliable cue once when its complete snapshot already applied the transition', () => {
    const p = new DominionProjection('run'); p.snapshot({ ...snapshot(), tick: 110 });
    expect(p.event(event('start'), 110, 99)).toBe(false); // Start emission must match its immutable cast start.
    expect(p.event(event('start'), 100, 4)).toBe(true);
    expect(p.event(event('start'), 100, 5)).toBe(false);
    expect(p.snapshot({ ...snapshot(), tick: 145, stateRevision: 6, dominionCasts: [], totalDominionCasts: 0 })).toBe(true);
    expect(p.event(event('strike'), 145, 6)).toBe(true);
    expect(p.event(event('strike'), 145, 7)).toBe(false);
    expect(p.active.size).toBe(0);
  });
  it('keeps snapshot-before-cancel cues and rejects altered cast identities without consuming revision', () => {
    const p = new DominionProjection('run'); p.snapshot(snapshot());
    p.snapshot({ ...snapshot(), tick: 125, stateRevision: 5, dominionCasts: [], totalDominionCasts: 0 });
    expect(p.event({ ...event('cancel'), cast: { ...cast, room: 1 } }, 125, 99)).toBe(false);
    expect(p.event(event('cancel'), 125, 5)).toBe(true);
    expect(p.event(event('cancel'), 125, 6)).toBe(false);
    expect(p.active.size).toBe(0);
  });
  it('catches up at the remaining deadline, follows accepted feet and never attaches to a reused slot', () => {
    const p = new DominionProjection('run'); expect(p.sync(checkpoint())).toBe(true);
    expect(p.rings(snapshot(), 120)[0]).toMatchObject({ x: 7, y: 8, z: 1, startTick: 100, impactTick: 145 });
    const moving = snapshot(); moving.enemyX[0] = 9; expect(p.rings(moving, 130)[0].x).toBe(9);
    expect(p.rings(snapshot(11), 130)).toEqual([]); expect(p.rings(snapshot(), 145)).toEqual([]);
    expect(p.event(event('start'), 100, 3)).toBe(false);
    expect(p.event(event('strike'), 145, 5)).toBe(true); expect(p.event(event('strike'), 145, 5)).toBe(false);
    expect(p.rings(snapshot(), 140)).toEqual([]); expect(p.sync(checkpoint())).toBe(false);
  });
  it('accepts only complete same-run matching snapshots, clears omitted casts and rejects malformed checkpoints atomically', () => {
    const p = new DominionProjection('run'); expect(p.snapshot(snapshot())).toBe(true);
    expect(p.snapshot({ ...snapshot(), runId: 'other', stateRevision: 99 })).toBe(false);
    expect(p.snapshot({ ...snapshot(), enemyCount: 0, stateRevision: 99 })).toBe(false);
    expect(p.snapshot(snapshot(11))).toBe(false);
    expect(p.sync({ ...checkpoint(99), dominionCasts: [null] } as unknown as FloorSync)).toBe(false);
    expect(p.sync({ ...checkpoint(99), dominionCasts: [{ ...cast, impactTick: 146 }] })).toBe(false);
    expect(p.active.size).toBe(1);
    expect(p.snapshot({ ...snapshot(), tick: 145, stateRevision: 5, dominionCasts: [], totalDominionCasts: 0 })).toBe(true);
    expect(p.active.size).toBe(0); expect(p.event(event('start'), 100, 4)).toBe(false);
  });
  it('cancels once, isolates terminal identities and does not consume invalid future revisions', () => {
    const p = new DominionProjection('run'); p.sync(checkpoint());
    expect(p.event({ ...event('strike'), x: NaN }, 145, 99)).toBe(false);
    expect(p.event(event('strike'), 130, 99)).toBe(false);
    expect(p.event(event('cancel'), 125, 5)).toBe(true); expect(p.event(event('cancel'), 126, 6)).toBe(false);
    const newer = { ...event('start'), cast: { ...cast, incarnation: 11, castId: 4, startTick: 140, impactTick: 185 } };
    expect(p.event(newer, 140, 7)).toBe(true);
    expect(p.event(event('cancel'), 141, 8)).toBe(false);
    expect(p.active.get(2)?.castId).toBe(4);
    expect(p.event({ ...newer, phase: 'cancel' }, 150, 8)).toBe(true);
  });
});
