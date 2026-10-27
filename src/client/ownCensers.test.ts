import { describe, expect, it } from 'vitest';
import { BLESSED, CHORISTER } from '../data/enemies';
import { CENSER_SPEED } from '../data/weapons';
import { TICK_DT } from '../sim/constants';
import { mapOf } from '../sim/testutil/maps';
import { room } from '../sim/testutil/sims';
import { CENSER_BLEND_MS, CENSER_MATCH_MS, OwnCensers, type CenserBreak, type CenserWorld } from './ownCensers';

const map = mapOf(room(40, 10));
const EYE = 1.6;

function world(enemies: Array<[number, number, number]> = [], extra: Partial<CenserWorld> = {}): CenserWorld {
  return {
    map, enemyZ: enemies.map(() => 0), souls: [], props: [], broken: new Set(), passBlessed: false,
    enemies: { count: enemies.length, x: enemies.map((e) => e[0]), y: enemies.map((e) => e[1]), type: enemies.map((e) => e[2]) },
    ...extra,
  };
}

/** A censer thrown east, level, from (2.5, 5.5) at eye height; flown in 30 Hz frames until it ends. */
function fly(w: CenserWorld, own = new OwnCensers(), range = 25): { breaks: CenserBreak[]; frames: number } {
  own.throw(0, 2.5, 5.5, EYE, 1, 0, 0, range, 2.5, 5.5, EYE);
  const breaks: CenserBreak[] = [];
  let frames = 0;
  while (own.flying && frames < 200) breaks.push(...own.step(++frames * TICK_DT * 1000, TICK_DT, w));
  return { breaks, frames };
}

describe('the local Heretic\'s own censers (netcode stage 4)', () => {
  it('fly at the host\'s speed and break on the first drawn enemy they reach, on its near side', () => {
    const { breaks, frames } = fly(world([[14.5, 5.5, CHORISTER], [10.5, 5.5, BLESSED]]));
    expect(breaks).toHaveLength(1);
    expect(breaks[0].enemy).toBe(1);
    // The Blessed's 0.35 m shot cylinder, enlarged by the censer's 0.2 m radius.
    expect(breaks[0].x).toBeCloseTo(10.5 - 0.55, 5);
    expect(frames).toBe(Math.ceil((10.5 - 0.55 - 2.5) / (CENSER_SPEED * TICK_DT)));
  });

  it('fly through Blessed with the Long Chain', () => {
    const { breaks } = fly(world([[10.5, 5.5, BLESSED], [14.5, 5.5, CHORISTER]], { passBlessed: true }));
    expect(breaks.map((b) => b.enemy)).toEqual([1]);
  });

  it('break on a wall, a soul or a standing prop, and pass a broken one', () => {
    expect(fly(world()).breaks[0]).toMatchObject({ enemy: -1 });
    // A pillar wall across x = 21; past the level's border it vanishes without breaking (M10 §3.4).
    const pillar = mapOf(room(40, 10).map((row, r) => (r > 0 && r < 11 ? row.slice(0, 21) + '#' + row.slice(22) : row)));
    const wall = fly(world([], { map: pillar })).breaks[0];
    expect(wall).toMatchObject({ enemy: -1 });
    expect(wall.x).toBeCloseTo(21, 5);
    expect(fly(world(), new OwnCensers(), 60).breaks).toEqual([]);
    const soul = fly(world([[20.5, 5.5, BLESSED]], { souls: [{ x: 8.5, y: 5.5, base: 0 }] })).breaks[0];
    expect(soul).toMatchObject({ enemy: -1 });
    expect(soul.x).toBeCloseTo(8.5 - 0.7, 5);
    const prop = { id: 7, room: 0, family: 'loot' as const, x: 6.5, y: 5.5, variant: 0, marked: false };
    expect(fly(world([], { props: [prop] })).breaks[0].x).toBeCloseTo(6.5 - 0.7, 5);
    expect(fly(world([], { props: [prop], broken: new Set([7]) })).breaks[0].x).toBeCloseTo(2.5 + 25, 5);
  });

  it('break at the end of the range, and start drawn at the muzzle, the offset fading', () => {
    const own = new OwnCensers();
    own.throw(0, 2.5, 5.5, EYE, 1, 0, 0, 25, 2.5, 5.2, EYE - 0.3);
    const drawn: number[][] = [];
    own.drawn(0, (x, y, z) => drawn.push([x, y, z]));
    own.step(CENSER_BLEND_MS, CENSER_BLEND_MS / 1000, world());
    own.drawn(CENSER_BLEND_MS, (x, y, z) => drawn.push([x, y, z]));
    expect(drawn[0]).toEqual([2.5, 5.2, EYE - 0.3]);
    expect(drawn[1][1]).toBeCloseTo(5.5, 9);
    expect(drawn[1][0]).toBeCloseTo(2.5 + CENSER_SPEED * CENSER_BLEND_MS / 1000, 9);
  });

  it('match the host censers of this player by path, hide them while drawn, and count where they ended', () => {
    const own = new OwnCensers();
    // One thrown east, then one north; the first host censer seen is the second throw's (the first broke
    // point-blank between snapshots), matched by its path, not the order.
    own.throw(0, 2.5, 5.5, EYE, 1, 0, 0, 25, 2.5, 5.5, EYE);
    own.throw(100, 2.5, 5.5, EYE, 0, 1, 0, 25, 2.5, 5.5, EYE);
    expect(own.claim(41, 300, 2.5, 7.5, EYE)).toBe(true);
    expect(own.claim(40, 400, 6.5, 5.5, EYE)).toBe(true);
    // A third lies on no throw's path: it's drawn as the host's.
    expect(own.claim(42, 500, 6.5, 9.5, EYE)).toBe(false);
    expect([own.hides(40, 500), own.hides(41, 500), own.hides(42, 500)]).toEqual([true, true, false]);
    // The east one breaks on an enemy at 10.5 m; the host's was last seen 1.5 m short of it, on its path.
    const w = world([[10.5, 5.5, BLESSED]]);
    let t = 0;
    while (own.flying) own.step(t += 33, 0.033, w);
    expect(own.release(40, 8.5, 5.5, EYE, t)).toBe(true);
    // Released, it stays hidden while interpolation still draws it, then it's forgotten.
    expect(own.hides(40, t + 500)).toBe(true);
    expect(own.hides(40, t + 1500)).toBe(false);
    // The north one left the level without breaking; its host censer ended 1 m out, which agrees with nothing.
    expect(own.release(41, 2.5, 6.5, EYE, t)).toBe(true);
    expect(own.release(42, 4, 5.5, EYE, t)).toBe(false);
    expect([own.thrown, own.matched, own.agreed, own.unmatched]).toEqual([2, 2, 1, 1]);
  });

  it('match no throw older than the match window', () => {
    const own = new OwnCensers();
    own.throw(0, 2.5, 5.5, EYE, 1, 0, 0, 25, 2.5, 5.5, EYE);
    expect(own.claim(3, CENSER_MATCH_MS + 1, 6.5, 5.5, EYE)).toBe(false);
  });
});
