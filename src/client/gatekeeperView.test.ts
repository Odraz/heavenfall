/** The Gatekeeper's client side (rogue bosses.md §3.5 Client, §3.7): forecasts, the drawn ring, the crosshair eye, the held drag and bots. */
import { describe, expect, it } from 'vitest';
import { BOSS_PART, GATEKEEPER } from '../data/enemies';
import { DRAG_SPEED, dragStep, HOLD_LIFT, RING_SPEED, RING_START, ringRadius } from '../data/gatekeeper';
import { PEARLY_POOL } from '../data/rooms/1';
import { generateFloor } from '../gen';
import { PINNED } from '../gen/pinned';
import { PHASE_COMBAT } from '../net/protocol';
import { PLAYER_EYE, PLAYER_RADIUS, TICK_DT, TICK_HZ } from '../sim/constants';
import { lineOfSight } from '../sim/los';
import { Bot, type BotView } from './bot';
import { ringContactIn, ringHeights, RING_SEGMENTS, sightState, sightWindow, type PartView } from './gatekeeperView';
import { LocalPlayer } from './localPlayer';

const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
const map = g.map;
const room = map.rooms[g.floor.boss];
const [rc, rr] = room.points!.reward!;
const base = map.floor[(rr + 1) * map.w + rc + 1];
const [bc, br] = map.boss!;
const boss = { x: bc + 0.5, y: br + 0.5, z: map.floor[br * map.w + bc] };
const bossEye: [number, number, number] = [boss.x, boss.y, boss.z + 5];

/** Open base-floor cells of the boss room matching `pred`. */
function cells(pred: (x: number, y: number) => boolean): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  for (let r = room.rect.y0 + 1; r <= room.rect.y1 - 1; r++) for (let c = room.rect.x0 + 1; c <= room.rect.x1 - 1; c++) {
    const i = r * map.w + c;
    if (!map.solid[i] && map.floor[i] === base && pred(c + 0.5, r + 0.5)) out.push([c + 0.5, r + 0.5]);
  }
  return out;
}

describe('the Toll on screen', () => {
  it('forecasts the front from the announced impact, during the tell and after the birth', () => {
    const impact = 1000;
    // 10 m out: 1 s of tell, then (10 − 0.4 − 3.5) / 9.5 s of rolling.
    expect(ringContactIn(impact, impact - 30, 10)).toBeCloseTo(1 + (10 - PLAYER_RADIUS - RING_START) / RING_SPEED, 9);
    expect(ringContactIn(impact, impact + 15, 10)).toBeCloseTo((10 - PLAYER_RADIUS - ringRadius(impact, impact + 15)) / RING_SPEED, 9);
    // Inside the birth disk: contact at impact; once past: never again.
    expect(ringContactIn(impact, impact - 6, 2)).toBeCloseTo(0.2, 9);
    expect(ringContactIn(impact, impact + 60, 10)).toBe(Infinity);
    expect(ringContactIn(0, impact, 10)).toBe(Infinity);
  });

  it('draws the band only on floors it hurts: the base floor and the +1 m terrace, not the gallery, dais or walls', () => {
    const h = ringHeights(map, boss.x, boss.y, 30, base, new Float64Array(RING_SEGMENTS + 1));
    const drawn = [...h].filter((v) => !Number.isNaN(v));
    expect(drawn.length).toBeGreaterThan(RING_SEGMENTS / 3);
    for (const v of drawn) expect(v).toBeLessThanOrEqual(base + 1 + 1e-6);
    // At some radius it climbs the +1 m terrace and is drawn on it.
    const terrace = Array.from({ length: 50 }, (_, k) => [...ringHeights(map, boss.x, boss.y, 15 + k, base, new Float64Array(RING_SEGMENTS + 1))]);
    expect(terrace.some((hs) => hs.some((v) => Math.abs(v - (base + 1)) < 1e-6))).toBe(true);
    // Somewhere on that circle the ring meets the +2 m gallery or a wall and isn't drawn.
    expect(drawn.length).toBeLessThan(RING_SEGMENTS + 1);
    const dais = ringHeights(map, boss.x, boss.y, 1, base, new Float64Array(RING_SEGMENTS + 1));
    expect([...dais].every(Number.isNaN)).toBe(true);
  });
});

describe('the crosshair eye', () => {
  it('is full where he sees you, half where only an open eye within 24 m does, none when hidden', () => {
    const [vx, vy] = cells((x, y) => lineOfSight(map, x, y, base + PLAYER_EYE, ...bossEye))[0];
    expect(sightState(map, vx, vy, base + PLAYER_EYE, bossEye, [])).toBe('full');
    const [hx, hy] = cells((x, y) => !lineOfSight(map, x, y, base + PLAYER_EYE, ...bossEye))[0];
    expect(sightState(map, hx, hy, base + PLAYER_EYE, bossEye, [])).toBe('none');
    const eye = (opening: boolean): PartView => ({ slot: 1, x: hx + 3, y: hy, z: base + 6, seal: false, opening });
    if (lineOfSight(map, hx + 3, hy, base + 6, hx, hy, base + PLAYER_EYE)) {
      expect(sightState(map, hx, hy, base + PLAYER_EYE, bossEye, [eye(false)])).toBe('half');
      expect(sightState(map, hx, hy, base + PLAYER_EYE, bossEye, [eye(true)])).toBe('none');
    }
    const far: PartView = { slot: 2, x: hx + 30, y: hy, z: base + 6, seal: false, opening: false };
    expect(sightState(map, hx, hy, base + PLAYER_EYE, bossEye, [far])).toBe('none');
  });

  it('shows from the c 22 pre-warning through the c 28 deadline, and while eyes are open', () => {
    expect([21.9, 22, 25, 28, 28.1].map((c) => sightWindow(c * TICK_HZ, false))).toEqual([false, true, true, true, false]);
    expect(sightWindow(5 * TICK_HZ, true)).toBe(true);
  });
});

describe('the held drag', () => {
  it("the held player's screen glides exactly along the host's tick-by-tick sweep", () => {
    const [x, y] = cells((cx, cy) => Math.hypot(cx - boss.x, cy - boss.y) > 15)[0];
    const host = { x, y, z: base + HOLD_LIFT, radius: PLAYER_RADIUS };
    for (let t = 0; t < 60; t++) dragStep(map, host, boss.x, boss.y, DRAG_SPEED / TICK_HZ);
    const local = new LocalPlayer(x, y, base, 6);
    local.hold(map, x, y, base + HOLD_LIFT, boss.x, boss.y, 0);
    // A 144 Hz screen: many small frames add up to the same sweep within millimetres.
    for (let f = 0; f < 288; f++) local.update(map, 1 / 144, 1, 0, true);
    expect(Math.hypot(local.body.x - host.x, local.body.y - host.y)).toBeLessThan(0.02);
    expect(local.body.z).toBe(base + HOLD_LIFT);
    // Movement abilities do nothing while held.
    local.startDash(1, 0);
    expect(local.dashing).toBe(false);
    // The event's delay is caught up at once.
    const late = new LocalPlayer(x, y, base, 6);
    late.hold(map, x, y, base + HOLD_LIFT, boss.x, boss.y, 0.2);
    expect(Math.hypot(late.body.x - x, late.body.y - y)).toBeCloseTo(0.5, 2);
    late.teleport(late.body.x, late.body.y, late.body.z);
    expect(late.held).toBeNull();
  });
});

describe('bots in the Gatekeeper fight (bosses.md §3.7)', () => {
  function botView(x: number, y: number): BotView {
    return {
      map, body: { x, y, z: base, vz: 0, grounded: true, flying: false, radius: PLAYER_RADIUS }, dead: false,
      enemies: [{ slot: 1, type: GATEKEEPER, x: boss.x, y: boss.y, z: boss.z }], activeRoom: g.floor.boss, activePhase: PHASE_COMBAT,
      clearedMask: 0, hostPlayer: null, qReady: false, eReady: false, blockedLastFrame: false, entryIndex: 0, souls: [],
      classId: 'betrayer', teammates: [],
      boss: { ...boss, eyeZ: boss.z + 5, tick: 0, cycleStart: 0, tollImpact: 0, base },
    };
  }

  it('jumps a grounded ring within 0.22 s of contact, not earlier', () => {
    const [x, y] = cells((cx, cy) => Math.abs(Math.hypot(cx - boss.x, cy - boss.y) - 12) < 0.5)[0];
    const v = botView(x, y), bot = new Bot(map);
    const d = Math.hypot(x - boss.x, y - boss.y);
    const contact = (d - PLAYER_RADIUS - RING_START) / RING_SPEED * TICK_HZ;
    v.boss = { ...v.boss!, tollImpact: 100, tick: 100 + contact - 0.3 * TICK_HZ };
    expect(bot.update(0, v).jump).toBe(false);
    v.boss = { ...v.boss, tick: 100 + contact - 0.2 * TICK_HZ };
    expect(bot.update(10, v).jump).toBe(true);
  });

  it('heads for a cell hidden from his eye at the c 22 pre-warning', () => {
    const [x, y] = cells((cx, cy) => lineOfSight(map, cx, cy, base + PLAYER_EYE, ...bossEye) && Math.hypot(cx - boss.x, cy - boss.y) > 12)[0];
    const v = botView(x, y), bot = new Bot(map);
    v.boss = { ...v.boss!, tick: 23 * TICK_HZ };
    const local = new LocalPlayer(x, y, base, 7);
    v.body = local.body;
    let hidden = false;
    for (let t = 0; t < 6 * TICK_HZ && !hidden; t++) {
      const o = bot.update(t * 33, v);
      local.update(map, TICK_DT, o.dirX, o.dirY, false);
      hidden = !lineOfSight(map, local.body.x, local.body.y, local.body.z + PLAYER_EYE, ...bossEye);
    }
    expect(hidden).toBe(true);
  });

  it('shoots a Seal before the crowd and skips a grey opening eye', () => {
    const [x, y] = cells((cx, cy) => Math.hypot(cx - boss.x, cy - boss.y) > 10)[0];
    const v = botView(x, y), bot = new Bot(map);
    v.enemies = [
      { slot: 2, type: BOSS_PART, x: x + 1.2, y, z: base + 1, opening: true },
      { slot: 3, type: 0, x: x + 2, y: y + 0.5, z: base },
      { slot: 4, type: BOSS_PART, x: x + 6, y, z: base + 2.6, seal: true },
    ];
    const o = bot.update(0, v);
    expect(o.fire).not.toBe(0);
    // Aimed at the Seal (6 m along +x), not the nearer Blessed or the grey eye.
    expect(Math.abs(o.yaw!)).toBeLessThan(0.05);
    expect(o.pitch!).toBeGreaterThan(0);
  });
});
