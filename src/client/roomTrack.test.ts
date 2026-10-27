import { describe, expect, it } from 'vitest';
import { PINNED } from '../gen/pinned';
import { loadRunMap } from '../sim/runMap';
import { MUSIC } from '../data/music';
import { roomTrack } from './roomTrack';

describe('room music', () => {
  it('small fights alternate Arena 3 and Arena 4; other shapes, the boss and quiet rooms keep theirs', () => {
    const { map } = loadRunMap({ heaven: 1, floor: 1, seed: PINNED.seed, fixture: null });
    map.rooms.forEach((room, i) => {
      const track = roomTrack(map, i);
      if (room.boss) expect(track).toBe('boss');
      else if (room.kind !== 'combat') expect(track).toBe('calm');
      else if (room.shape === '2x2') expect(track).toBe('arena-1');
      else if (room.shape === '1x1') expect(track).toBe(i % 2 ? 'arena-4' : 'arena-3');
      else expect(track).toBe('arena-2');
    });
  });
  it('Arena 4 plays on nearly every generated floor', () => {
    let floors = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const { map } = loadRunMap({ heaven: 1, floor: 1, seed, fixture: null });
      if (map.rooms.some((_, i) => roomTrack(map, i) === 'arena-4')) floors++;
    }
    expect(floors).toBeGreaterThanOrEqual(28);
  });
  it('Arena 4 is a listed looping track', () => {
    const def = MUSIC.find((t) => t.id === 'arena-4');
    expect(def?.loopStart).toBeGreaterThan(0); expect(def!.loopEnd!).toBeGreaterThan(def!.loopStart! + 45);
  });
});
