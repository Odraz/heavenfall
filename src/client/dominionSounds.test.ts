import { describe, expect, it, vi, beforeEach } from 'vitest';
import { GameSounds } from './sounds';
import { dominionLab } from '../data/dungeons/dominion';
import { loadMap } from '../sim/map';
import type { DominionRing } from './dominionView';
const mocks = vi.hoisted(() => ({ sfx: vi.fn(), stop: vi.fn(), playing: vi.fn(() => true) }));
vi.mock('../audio/audio', () => ({ audio: () => null, setMusic: vi.fn(), sfx: mocks.sfx }));
const ring: DominionRing = { slot: 1, incarnation: 2, castId: 3, startTick: 100, impactTick: 145, room: 0, x: 7, y: 8, z: 2 };
beforeEach(() => { vi.clearAllMocks(); mocks.playing.mockReturnValue(true); mocks.sfx.mockReturnValue({ stop: mocks.stop, playing: mocks.playing }); });
describe('accepted Dominion sound lifetime', () => {
  it('uses only the remaining arrival warning, stops it on cancellation and never restarts an ended admitted cue', () => {
    const sounds = new GameSounds(loadMap(dominionLab), 0, () => 'fallen');
    const w = { id: 1, room: 0, x: 7, y: 8, z: 0, startTick: 100, readyTick: 130 };
    sounds.arrivals([w], 120); expect(mocks.sfx.mock.calls[0][6]).toEqual({ elapsed: 2 / 3, duration: 1 });
    mocks.playing.mockReturnValue(false); sounds.arrivals([w], 121); expect(mocks.sfx).toHaveBeenCalledTimes(1);
    sounds.arrivals([], 122); expect(mocks.stop).toHaveBeenCalledTimes(1);
    sounds.arrivals([w], 130); expect(mocks.sfx).toHaveBeenCalledTimes(1); sounds.dispose();
  });
  it('shares admitted finite fire voices, retries only ended playback and stops on room exit/disposal', () => {
    const sounds = new GameSounds(loadMap(dominionLab), 0, () => 'fallen');
    sounds.hazard({ x: 7, y: 8 }); sounds.hazard({ x: 8, y: 8 }); expect(mocks.sfx).toHaveBeenCalledTimes(1);
    expect(mocks.sfx.mock.calls[0]).toEqual(['refinerFire', { x: 7, y: 8 }, 0.55, 0, 0]);
    mocks.playing.mockReturnValue(false); sounds.hazard({ x: 8, y: 8 }); expect(mocks.sfx).toHaveBeenCalledTimes(2);
    sounds.hazard(null); expect(mocks.stop).toHaveBeenCalledTimes(1);
    sounds.hazard({ x: 8, y: 8 }); sounds.dispose(); expect(mocks.stop).toHaveBeenCalledTimes(2);
  });
  it('resumes only the remaining cast, never duplicates it, and stops on omission/disposal', () => {
    const sounds = new GameSounds(loadMap(dominionLab), 0, () => 'fallen');
    sounds.dominions([ring], 130); sounds.dominions([ring], 131);
    expect(mocks.sfx).toHaveBeenCalledTimes(1); expect(mocks.sfx.mock.calls[0][6]).toEqual({ elapsed: 1, duration: 1.5 });
    sounds.dominions([], 132); expect(mocks.stop).toHaveBeenCalledTimes(1);
    sounds.dominions([{ ...ring, castId: 4 }], 133); sounds.dispose(); expect(mocks.stop).toHaveBeenCalledTimes(2);
  });
  it('cancel stops the voice without slam, while accepted impact plays a positional cue', () => {
    const sounds = new GameSounds(loadMap(dominionLab), 0, () => 'fallen'); sounds.dominions([ring], 120);
    sounds.event({ type: 'dominionCast', phase: 'cancel', cast: ring, x: 7, y: 8, z: 2 }, () => undefined);
    expect(mocks.stop).toHaveBeenCalledTimes(1); expect(mocks.sfx).toHaveBeenCalledTimes(1);
    sounds.event({ type: 'dominionCast', phase: 'strike', cast: ring, x: 7, y: 8, z: 2 }, () => undefined);
    expect(mocks.sfx.mock.calls[1].slice(0, 2)).toEqual(['dominionSlam', { x: 7, y: 8 }]); sounds.dispose();
  });
});
