import { describe, expect, it } from 'vitest';
import { Bot, type BotView } from './bot';
import { mapOf } from '../sim/testutil/maps';
import { room } from '../sim/testutil/sims';
import { BLESSED } from '../data/enemies';
import { PHASE_COMBAT } from '../net/protocol';
import type { DominionRing } from './dominionView';
const cast: DominionRing = { slot: 1, incarnation: 1, castId: 1, room: 0, x: 10, y: 10, z: 0, startTick: 0, impactTick: 45 };
function view(): BotView {
  const map = mapOf(room(24, 24)); map.roomOf.fill(0);
  return { map, body: { x: 12, y: 10, z: 0, vz: 0, grounded: true, flying: false, radius: 0.35 },
    enemies: [{ slot: 2, type: BLESSED, x: 16, y: 10, z: 0 }], dead: false, activeRoom: 0, activePhase: PHASE_COMBAT, clearedMask: 0,
    hostPlayer: null, qReady: true, eReady: false, blockedLastFrame: false, entryIndex: 0, souls: [], classId: 'fallen', teammates: [], dominionRings: [cast] };
}
describe('bot Dominion escape', () => {
  it('moves out while retaining real aim/fire/ability decisions; omission ends escape', () => {
    const v = view(), bot = new Bot(v.map), o = { ...bot.update(0, v) };
    expect(o.dirX).toBeCloseTo(1); expect(o.dirY).toBeCloseTo(0); expect(o.fire).toBe(1); expect(o.pressQ).toBe(true);
    v.dominionRings = []; expect(bot.update(30, v).dirX).toBe(0);
  });
  it('probes complete short paths around a wall and handles overlapping rings', () => {
    const v = view(); for (let y = 9; y <= 10; y++) v.map.solid[y * v.map.w + 13] = 1;
    v.dominionRings = [cast, { ...cast, slot: 3, castId: 2, x: 10, y: 11 }];
    const o = new Bot(v.map).update(0, v);
    expect(Math.abs(o.dirY)).toBeGreaterThan(0.5); expect(Math.hypot(o.dirX, o.dirY)).toBeCloseTo(1);
  });
  it('ignores other rooms, wrong feet height, outside rings and dead players', () => {
    for (const change of [{ room: 1 }, { z: 2 }, { x: 2 }]) { const v = view(); v.dominionRings = [{ ...cast, ...change }]; expect(new Bot(v.map).update(0, v).dirX).toBe(0); }
    const v = view(); v.dead = true; expect(new Bot(v.map).update(0, v).fire).toBe(0); expect(new Bot(v.map).update(0, v).dirX).toBe(0);
  });
});
