import { describe, expect, it } from 'vitest';
import { ALLY_NONE } from '../net/protocol';
import { room } from '../sim/testutil/sims';
import { mapOf } from '../sim/testutil/maps';
import { pickAllyTarget, type AllyCandidate } from './allyTarget';

const map = mapOf(room(60, 60));
const DEG = Math.PI / 180;
// The eye at (5, 30) at floor 0, aiming along +x and level with the allies' body centers.
const EX = 5;
const EY = 30;
const EZ = 0.9;

/** An ally 20 m away along +x, rotated by `deg` around the eye. */
function ally(id: number, deg: number, dist = 20): AllyCandidate {
  return { id, x: EX + Math.cos(deg * DEG) * dist, y: EY + Math.sin(deg * DEG) * dist, z: 0, dead: false };
}

function pick(candidates: AllyCandidate[], current = ALLY_NONE, range = 40) {
  return pickAllyTarget(map, EX, EY, EZ, 1, 0, 0, candidates, range, current);
}

describe('ally targeting (M8 §3.5)', () => {
  it('acquires the smallest angle up to 15°', () => {
    expect(pick([ally(1, 14), ally(2, 8)]).target).toBe(2);
    expect(pick([ally(1, 14)]).target).toBe(1);
    expect(pick([ally(1, 16)]).target).toBe(ALLY_NONE);
  });

  it('keeps the current target up to 25°', () => {
    expect(pick([ally(1, 24)], 1).target).toBe(1);
    expect(pick([ally(1, 26)], 1).target).toBe(ALLY_NONE);
    // Not the current target: 24° is too far to acquire.
    expect(pick([ally(1, 24)], 2).target).toBe(ALLY_NONE);
  });

  it('switches only to a candidate within 15° that is more than 5° better', () => {
    // Current at 20°, other at 14°: only 6° better, and within 15° → switch.
    expect(pick([ally(1, 20), ally(2, 14)], 1).target).toBe(2);
    // Current at 12°, other at 8°: only 4° better → keep.
    expect(pick([ally(1, 12), ally(2, -8)], 1).target).toBe(1);
    // Current at 24°, other at 16°: 8° better but outside 15° → keep.
    expect(pick([ally(1, 24), ally(2, 16)], 1).target).toBe(1);
  });

  it('acquires a new target when the current one is lost', () => {
    expect(pick([ally(1, 30), ally(2, 10)], 1).target).toBe(2);
    expect(pick([{ ...ally(1, 5), dead: true }, ally(2, 10)], 1).target).toBe(2);
  });

  it('reports an out-of-range candidate for the grey chevron', () => {
    const r = pick([ally(1, 5, 50)], ALLY_NONE, 30);
    expect(r.target).toBe(ALLY_NONE);
    expect(r.outOfRange).toBe(1);
    // Outside 15° there's no grey chevron either.
    expect(pick([ally(1, 20, 50)], ALLY_NONE, 30).outOfRange).toBe(ALLY_NONE);
    // With an ally target there's no grey chevron.
    expect(pick([ally(1, 5, 50), ally(2, 10)], ALLY_NONE, 30)).toEqual({ target: 2, outOfRange: ALLY_NONE });
  });

  it('requires line of sight', () => {
    const walled = room(60, 60);
    // A wall column at cell (15, 30), between the eye and the ally.
    walled[30] = '#' + '0'.repeat(14) + '#' + '0'.repeat(45) + '#';
    const m = mapOf(walled);
    const r = pickAllyTarget(m, EX, EY, EZ, 1, 0, 0, [ally(1, 0)], 40, ALLY_NONE);
    expect(r).toEqual({ target: ALLY_NONE, outOfRange: ALLY_NONE });
  });

  it("skips the dead, unless souls count: then by the soul's cylinder (M9 §2.5)", () => {
    // A soul risen 1 m: its center is 1.9 m up, 1 m above the aim at 20 m (2.9°).
    const soul = { ...ally(1, 0), z: 1, dead: true };
    expect(pick([soul]).target).toBe(ALLY_NONE);
    expect(pickAllyTarget(map, EX, EY, EZ, 1, 0, 0, [soul], 40, ALLY_NONE, true).target).toBe(1);
    // Within range of the soul's cylinder, not of a player's at its ground point.
    const near = { ...ally(1, 0, 40.45), z: 1, dead: true };
    expect(pickAllyTarget(map, EX, EY, EZ, 1, 0, 0, [near], 40, ALLY_NONE, true).target).toBe(1);
  });
});
