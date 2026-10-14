import { expect, it } from 'vitest';
import { CommanderProjection } from './commanders';
import { LocalPlayer } from './localPlayer';
import type { CommanderCast } from '../data/commanders';
import { validCommanderCasts } from '../data/commanders';
import type { FloorSync } from '../net/messages';
import { loadMap } from '../sim/map';
import { dungeonOf } from '../sim/testutil/maps';
import { room } from '../sim/testutil/sims';
import { Bot, type BotView } from './bot';
import { CARRIER, BLESSED } from '../data/enemies';

const cast: CommanderCast = { slot: 1, incarnation: 3, castId: 9, room: 0, kind: 'carry', phase: 'tell', startTick: 100, phaseTick: 100, endTick: 130,
  targetId: 0, yaw: 0, pitch: 0, x: 5, y: 10, z: 4, targetX: 20, targetY: 10, targetZ: 0, dropX: 23, dropY: 10 };
const sync = (tick: number, revision: number, casts = [cast]): FloorSync => ({ type: 'floorSync', runId: 'run', tick, revision, rooms: [], commanderCasts: casts });

it('interpolates wrapped facing between snapshots without extrapolating or blending new incarnations', () => {
  const p = new CommanderProjection('run');
  p.sync(sync(110, 1, [{ ...cast, yaw: Math.PI - .1, pitch: 0 }]));
  p.sync(sync(113, 2, [{ ...cast, yaw: -Math.PI + .1, pitch: .3 }]));
  expect(Math.abs(p.sample(1, 114.5)!.yaw)).toBeCloseTo(Math.PI);
  expect(p.sample(1, 114.5)!.pitch).toBeCloseTo(.15);
  expect(p.sample(1, 200)!.pitch).toBeCloseTo(.3);
  expect(p.active.get(1)!.pitch).toBe(.3);
  p.sync(sync(114, 3, [{ ...cast, incarnation: 4, yaw: 0 }]));
  expect(p.sample(1, 114)!.yaw).toBe(0);
  p.sync(sync(115, 4, [])); expect(p.sample(1, 115)).toBeUndefined();
});

it('rejoin and snapshot replacement cannot rewind a family cast or cross runs', () => {
  const p = new CommanderProjection('run'); expect(p.sync(sync(110, 3))).toBe(true);
  expect(p.active.get(1)).toEqual(cast);
  const checkpoint = sync(111, 3); p.sync(checkpoint); checkpoint.commanderCasts![0] = { ...cast, targetX: 99 };
  expect(p.active.get(1)?.targetX).toBe(20);
  expect(p.sync(sync(109, 4))).toBe(false);
  expect(p.sync({ ...sync(112, 4), runId: 'other' })).toBe(false);
  expect(p.sync(sync(112, 2))).toBe(false);
  expect(p.sync(sync(113, 4, []))).toBe(true); expect(p.active.size).toBe(0);
  expect(p.sync(sync(110, 3))).toBe(false);
});

it('rejects invalid family records before admitting a revision', () => {
  for (const change of [{ yaw: NaN }, { targetId: 4 }, { incarnation: 0 }, { phaseTick: 111 }, { room: 32 }, { targetX: -1 }, { kind: 'unknown' }]) {
    const bad = { ...cast, ...change } as CommanderCast;
    expect(validCommanderCasts([bad], 110)).toBe(false);
    expect(new CommanderProjection('run').sync(sync(110, 4, [bad]))).toBe(false);
  }
  expect(validCommanderCasts([cast, { ...cast, slot: 2, castId: 10 }], 110)).toBe(false);
});

it('carried local movement ignores walking/jumping while look and escape abilities still work', () => {
  const map = loadMap(dungeonOf(room(32, 32))), p = new LocalPlayer(10, 10, 6, 9);
  p.carried = true; p.update(map, 0.05, 1, 0, true); expect([p.body.x, p.body.y, p.body.z]).toEqual([10, 10, 6]);
  p.look(0.5, 0.2); expect(p.yaw).toBe(0.5);
  p.startDash(1, 0); p.update(map, 0.05, 0, 0, false); expect(p.body.x).toBeGreaterThan(10); expect(p.carried).toBe(false);
  p.carried = true; p.startLeap(20, 20, 0); expect(p.carried).toBe(false);
  p.carried = true; p.teleport(5, 5, 4); expect(p.carried).toBe(false);
});

function view(): BotView {
  return { map: loadMap(dungeonOf(room(48, 32))), body: { x: 20, y: 10, z: 0, vz: 0, grounded: true, radius: 0.35, flying: false },
    dead: false, activeRoom: 0, activePhase: 1, clearedMask: 0, hostPlayer: null, qReady: false, eReady: false, blockedLastFrame: false, entryIndex: 0,
    souls: [], classId: 'betrayer', teammates: [], enemies: [], commanderCasts: [] };
}
it('bots prioritize a visible Carrier holding a player over nearer minions', () => {
  const v = view(); v.commanderCasts = [{ ...cast, phase: 'carry' }];
  v.enemies = [{ slot: 2, type: BLESSED, x: 22, y: 10, z: 0 }, { slot: 1, type: CARRIER, x: 20, y: 20, z: 4 }];
  const output = new Bot(v.map).update(0, v);
  expect(output.yaw).toBeCloseTo(Math.PI / 2); expect(output.fire).not.toBe(0);
});
