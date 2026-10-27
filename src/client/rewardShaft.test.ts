import { describe, expect, it } from 'vitest';
import { PINNED } from '../gen/pinned';
import { loadRunMap } from '../sim/runMap';
import { COIN, GOLD_HALO } from '../data/pickups';
import type { PickupRecord } from '../data/pickups';
import { pillarOpacity, rewardKind, rewardPickupIds, rewardSpot } from './rewardShaft';

describe('reward shafts', () => {
  const { map, floor } = loadRunMap({ heaven: 1, floor: 1, seed: PINNED.seed, fixture: null });
  const rewarded = floor!.rewards.map((r, room) => ({ r, room })).filter(({ r, room }) => r.kind !== 'nothing' && map.rooms[room].kind === 'combat');

  it('the pinned floor has rewarded combat rooms with reward spots', () => {
    expect(rewarded.length).toBeGreaterThan(0);
    for (const { room } of rewarded) expect(rewardSpot(map, room)).not.toBeNull();
  });

  it('recognizes exactly the reward kind created on the reward spot', () => {
    const records: PickupRecord[] = [];
    let id = 1;
    const expected = new Set<number>();
    for (const { r, room } of rewarded) {
      const spot = rewardSpot(map, room)!, kind = rewardKind(r)!;
      expected.add(id);
      records.push({ id: id++, kind, room, x: spot.x, y: spot.y, value: 6, expiresTick: -1 });
      // The same kind dropped elsewhere in the room (an enemy item, a commander's gold halo).
      records.push({ id: id++, kind, room, x: spot.x + 2, y: spot.y, value: 6, expiresTick: -1 });
      // A coin that happens to land on the spot.
      records.push({ id: id++, kind: COIN, room, x: spot.x, y: spot.y, value: 1, expiresTick: 600 });
    }
    expect(rewardPickupIds(records, floor!, map)).toEqual(expected);
  });

  it('ignores rooms without a reward and maps reward kinds to pickup kinds', () => {
    const empty = floor!.rewards.findIndex((r, room) => r.kind === 'nothing' && rewardSpot(map, room));
    if (empty >= 0) {
      const spot = rewardSpot(map, empty)!;
      expect(rewardPickupIds([{ id: 1, kind: GOLD_HALO, room: empty, x: spot.x, y: spot.y, value: 6, expiresTick: -1 }], floor!, map).size).toBe(0);
    }
    expect(rewardKind({ kind: 'gold' })).toBe(GOLD_HALO);
    expect(rewardKind({ kind: 'nothing' })).toBeNull();
  });

  it('pulses the waiting pillar without ever fading it out', () => {
    for (let t = 0; t < 1600; t += 50) {
      expect(pillarOpacity(t)).toBeGreaterThanOrEqual(0.6);
      expect(pillarOpacity(t)).toBeLessThanOrEqual(1);
    }
  });
});
