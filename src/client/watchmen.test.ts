import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BLESSED, WATCHMAN } from '../data/enemies';
import type { WatchmanAim } from '../data/watchman';
import { dominionLab } from '../data/dungeons/dominion';
import type { FloorSync } from '../net/messages';
import type { Snapshot } from '../net/protocol';
import { loadMap } from '../sim/map';
import { mapOf } from '../sim/testutil/maps';
import { room } from '../sim/testutil/sims';
import { Bot, type BotView } from './bot';
import { GameSounds } from './sounds';
import { WatchmanProjection } from './watchmen';
import { THREAD_WIDTH_END, THREAD_WIDTH_START, threadLine } from './watchmanView';

const mocks = vi.hoisted(() => ({ sfx: vi.fn(), stop: vi.fn(), playing: vi.fn(() => true) }));
vi.mock('../audio/audio', () => ({ audio: () => null, setMusic: vi.fn(), sfx: mocks.sfx }));
beforeEach(() => { vi.clearAllMocks(); mocks.playing.mockReturnValue(true); mocks.sfx.mockReturnValue({ stop: mocks.stop, playing: mocks.playing }); });

const RUN = '0123456789abcdef0011223344556677';
const aim: WatchmanAim = { slot: 4, incarnation: 9, targetId: 0, phase: 'aim', fireTick: 130, shot: 3, x: 0, y: 0, z: 0 };
/** A one-enemy snapshot holding a Watchman in slot 4, incarnation 9. */
function snap(tick: number, aims: WatchmanAim[], incarnation = 9): Snapshot {
  return { runId: RUN, tick, stateRevision: tick, watchmanAims: aims, totalWatchmanAims: aims.length, enemyCount: 1, totalEnemyCount: 1,
    enemySlot: Uint16Array.of(4), enemyIncarnation: Uint32Array.of(incarnation), enemyType: Uint8Array.of(WATCHMAN) } as unknown as Snapshot;
}

describe('Watchman projection', () => {
  it('restores a rejoined aim from its fire tick and draws only the remaining thread', () => {
    const w = new WatchmanProjection(RUN);
    const sync = { type: 'floorSync', runId: RUN, tick: 120, revision: 5, rooms: [], watchmanAims: [aim] } as FloorSync;
    expect(w.sync(sync)).toBe(true);
    const s = snap(120, [aim]);
    expect(w.live(s, 120)).toEqual([aim]);
    expect(w.live(s, 130)).toEqual([]);
    const map = mapOf(room(40, 20));
    const line = threadLine(map, 10.5, 10.5, 0, 20.5, 10.5, 0.8, aim.fireTick, 120)!;
    // Ten ticks of thirty left: two thirds of the way from 0.02 m to 0.05 m.
    expect(line.width).toBeCloseTo(THREAD_WIDTH_START + (THREAD_WIDTH_END - THREAD_WIDTH_START) * (20 / 30), 9);
    expect(line.to[0]).toBeCloseTo(20.5, 6);
  });
  it('stops the thread at cover', () => {
    const map = mapOf(room(40, 20).map((row, y) => y >= 8 && y <= 13 ? row.slice(0, 20) + '#' + row.slice(21) : row));
    const line = threadLine(map, 10.5, 10.5, 0, 30.5, 10.5, 0.8, 130, 110)!;
    expect(line.to[0]).toBeCloseTo(20, 6);
  });
  it('plays each shot counter once, a new incarnation afresh, and rejects stale or foreign records', () => {
    const w = new WatchmanProjection(RUN);
    expect(w.takeShots([aim])).toEqual([]);
    const fired: WatchmanAim = { ...aim, phase: 'fired', fireTick: 130, shot: 4, x: 20.5, y: 10.5, z: 0.8 };
    expect(w.takeShots([fired])).toEqual([fired]);
    expect(w.takeShots([fired])).toEqual([]);
    expect(w.takeShots([{ ...fired, shot: 5 }])).toHaveLength(1);
    expect(w.takeShots([{ ...fired, shot: 5, incarnation: 10 }])).toHaveLength(1);
    expect(w.sync(snap(125, [aim], 8))).toBe(false);
    expect(w.sync({ ...snap(125, [aim]), runId: 'f'.repeat(32) })).toBe(false);
    expect(w.sync(snap(125, [{ ...aim, fireTick: 125 }]))).toBe(false);
  });
});

describe('Watchman sounds', () => {
  it('plays the rising note for the remaining aim, once, and stops it when the aim is canceled', () => {
    const sounds = new GameSounds(loadMap(dominionLab), 0, () => 'fallen');
    sounds.watchmen([{ aim, at: { x: 7, y: 8 } }], 110);
    sounds.watchmen([{ aim, at: { x: 7, y: 8 } }], 111);
    expect(mocks.sfx).toHaveBeenCalledTimes(1);
    expect(mocks.sfx.mock.calls[0].slice(0, 2)).toEqual(['watchmanAim', { x: 7, y: 8 }]);
    expect(mocks.sfx.mock.calls[0][6]).toEqual({ elapsed: 10 / 30, duration: 1 });
    sounds.watchmen([], 112);
    expect(mocks.stop).toHaveBeenCalledTimes(1);
    sounds.watchmanShot({ x: 7, y: 8 });
    expect(mocks.sfx.mock.calls[1].slice(0, 2)).toEqual(['watchmanShot', { x: 7, y: 8 }]);
    sounds.dispose();
  });
});

describe('Watchman bots', () => {
  it('shoot the Watchman aiming at them before a nearer enemy, within their weapon range', () => {
    const map = mapOf(room(40, 20));
    const v: BotView = { map, body: { x: 5.5, y: 10.5, z: 0, vz: 0, grounded: true, flying: false, radius: 0.35 }, dead: false,
      enemies: [{ slot: 1, type: BLESSED, x: 9.5, y: 10.5, z: 0 }, { slot: 4, type: WATCHMAN, x: 20.5, y: 10.5, z: 0 }],
      activeRoom: 255, activePhase: 0, clearedMask: 0, hostPlayer: null, qReady: false, eReady: false, blockedLastFrame: false,
      entryIndex: 0, souls: [], classId: 'betrayer', teammates: [] };
    const plain = new Bot(map).update(0, v);
    expect(plain.yaw).toBeCloseTo(0, 1);
    const bot = new Bot(map);
    const aimed = bot.update(0, { ...v, enemies: [v.enemies[0], { ...v.enemies[1], y: 14.5 }], watchmanAims: [aim] });
    expect(aimed.yaw).toBeCloseTo(Math.atan2(4, 15), 1);
    // Aimed at someone else: the nearest enemy again.
    const other = new Bot(map).update(0, { ...v, enemies: [v.enemies[0], { ...v.enemies[1], y: 14.5 }], watchmanAims: [{ ...aim, targetId: 1 }] });
    expect(other.yaw).toBeCloseTo(0, 1);
  });
});
