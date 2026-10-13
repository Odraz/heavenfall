import { describe, expect, it } from 'vitest';
import { PEARLY_POOL_R1, PEARLY_POOL } from '../data/rooms/1';
import { BLESSED } from '../data/enemies';
import { generateFloor } from '../gen';
import { PINNED_R1 as PINNED } from '../gen/pinned';
import { PINNED as PINNED_R2 } from '../gen/pinned';
import { PHASE_COMBAT, PHASE_COUNTDOWN, PHASE_IDLE } from '../net/protocol';
import { Simulation } from '../sim/sim';
import { TICK_DT, TICK_HZ, TICK_MS } from '../sim/constants';
import { applyLeaves } from '../sim/map';
import { mapOf } from '../sim/testutil/maps';
import { room } from '../sim/testutil/sims';
import { Bot, type BotView } from './bot';
import { LocalPlayer } from './localPlayer';

function view(): BotView {
  const { map } = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL_R1);
  const [c, r] = map.spawns[0];
  applyLeaves(map, { activeRoom: 255, activePhase: PHASE_IDLE, clearedMask: 1 });
  return {
    map, body: { x: c + 0.5, y: r + 0.5, z: 0, vz: 0, grounded: true, flying: false, radius: 0.35 },
    dead: false, enemies: [], activeRoom: 255, activePhase: PHASE_IDLE, clearedMask: 1,
    hostPlayer: null, qReady: false, eReady: false, blockedLastFrame: false, entryIndex: 0,
    souls: [], classId: 'fallen', teammates: [],
  };
}
function destination(bot: Bot, v: BotView): { x: number; y: number } | null {
  return (bot as unknown as { nextEntry(v: BotView): { x: number; y: number } | null }).nextEntry(v);
}

describe('R1.4 bots', () => {
  it('keeps ready combat abilities while walking an empty frontier instead of repeatedly launching away from the route', () => {
    const v = view(); v.qReady = v.eReady = true; const bot = new Bot(v.map);
    expect(bot.update(0, v)).toMatchObject({ pressQ: false, pressE: false });
    v.enemies = [{ slot: 0, type: BLESSED, x: v.body.x + 3, y: v.body.y, z: v.body.z }];
    expect(bot.update(300, v)).toMatchObject({ pressQ: true, pressE: true });
  });
  it('replans a retained waypoint after accepted displacement instead of walking back toward a stale cell', () => {
    const v = view(); v.map = mapOf(room(40, 20)); Object.assign(v.body, { x: 8.5, y: 10.5, z: 0 });
    v.hostPlayer = { x: 30.5, y: 10.5 }; const bot = new Bot(v.map);
    expect(bot.update(0, v).dirX).toBeGreaterThan(0);
    v.body.x = 20.5; expect(bot.update(50, v).dirX).toBeGreaterThan(0);
  });
  it.each([['R1', PEARLY_POOL_R1, PINNED], ['R2', PEARLY_POOL, PINNED_R2]] as const)('walks the pinned %s floor through real collision and room seals to victory', (_, pool, pin) => {
    const generated = generateFloor(pin.seed, 1, 1, pool);
    const sim = new Simulation({ dungeon: generated.def, map: generated.map, players: [{ id: 0, name: 'Pilot', classId: 'fallen' }], seed: 1, god: true });
    const p = sim.players[0], local = new LocalPlayer(p.x, p.y, p.z, p.speed), bot = new Bot(sim.map);
    const v = { ...view(), map: sim.map, body: local.body };
    let progress = '', lastProgress = 0;
    for (let tick = 0; tick < 20 * 60 * TICK_HZ && !sim.result; tick++) {
      v.activeRoom = sim.activeRoom; v.activePhase = sim.activePhase; v.clearedMask = sim.clearedMask();
      v.entrySocket = sim.rooms[sim.activeRoom]?.entrySocket;
      v.blockedLastFrame = local.moveResult.blocked;
      v.enemies = [...sim.active.slice(0, sim.activeCount)].map((s) => ({ slot: s, type: sim.eType[s], x: sim.eX[s], y: sim.eY[s], z: sim.eZ[s] }));
      const o = bot.update(tick * TICK_MS, v);
      local.update(sim.map, TICK_DT, o.dirX, o.dirY, o.jump);
      Object.assign(p, { x: local.body.x, y: local.body.y, z: local.body.z });
      sim.step();
      for (const { event } of sim.events) if (event.type === 'teleport') local.teleport(event.x, event.y, event.z);
      sim.events.length = 0;
      if (sim.activePhase === PHASE_COMBAT && tick % 15 === 0) sim.killAll();
      const state = `${sim.activeRoom}/${sim.activePhase}/${sim.clearedMask()}/${sim.directorInfo()?.wave}`;
      if (state !== progress) { progress = state; lastProgress = tick; }
      if (tick - lastProgress > 90 * TICK_HZ) {
        throw new Error(`Stalled ${state} at ${p.x},${p.y},${p.z}; goal ${JSON.stringify(destination(bot, v))}`);
      }
    }
    expect(sim.result).toBe('victory');
  });

  it('explores the nearest frontier, uses the entry toward a cleared neighbour, and breaks ties by room index', () => {
    const v = view(), bot = new Bot(v.map);
    const neighbours = v.map.rooms[0].leaves.map((l) => l.to).sort((a, b) => a - b);
    const room = v.map.rooms[neighbours[0]], socket = room.leaves.find((l) => l.to === 0)!.socket;
    const [x, y] = room.entry.find((e) => e.socket === socket)!.cells[0];
    expect(destination(bot, v)).toEqual({ x: x + 0.5, y: y + 0.5 });
    expect(bot.update(0, v).dirX ** 2 + bot.update(0, v).dirY ** 2).toBeCloseTo(1);
  });

  it('chooses the boss only after all other frontier rooms are cleared', () => {
    const v = view(), bot = new Bot(v.map);
    const boss = v.map.rooms.findIndex((r) => r.kind === 'boss');
    v.clearedMask = ((1 << v.map.rooms.length) - 1) & ~(1 << boss);
    applyLeaves(v.map, { activeRoom: 255, activePhase: PHASE_IDLE, clearedMask: v.clearedMask });
    const [x, y] = v.map.rooms[boss].entry[0].cells[0];
    expect(destination(bot, v)).toEqual({ x: x + 0.5, y: y + 0.5 });
  });

  it('heads to the selected socket during countdown and follows a living human otherwise', () => {
    const v = view(), bot = new Bot(v.map);
    const roomIndex = v.map.rooms.findIndex((r) => r.entry.length > 1 && r.kind === 'combat');
    const room = v.map.rooms[roomIndex], entry = room.entry[1], [x, y] = entry.cells[0];
    Object.assign(v.body, { x: x + 0.5, y: y + 0.5, z: v.map.floor[y * v.map.w + x] });
    Object.assign(v, { activeRoom: roomIndex, activePhase: PHASE_COUNTDOWN, entrySocket: entry.socket });
    expect(bot.update(0, v)).toMatchObject({ dirX: 0, dirY: 0 });
    const [hx, hy] = room.entry[0].cells[0];
    Object.assign(v, { activePhase: PHASE_IDLE, hostPlayer: { x: hx + 0.5, y: hy + 0.5 } });
    const o = bot.update(1000, v);
    expect(o.dirX ** 2 + o.dirY ** 2).toBeCloseTo(1);
  });

  it('walks toward a reachable soul when all humans are down and stays idle when there are none', () => {
    const v = view();
    v.map = mapOf(room(20, 20));
    Object.assign(v.body, { x: 10.5, y: 10.5, z: 0 });
    const bot = new Bot(v.map);
    const human = { x: v.body.x + 8, y: v.body.y, z: 0 };
    Object.assign(v, { followParty: true, souls: [{ x: v.body.x - 2, y: v.body.y, z: 0 }, human], humanSouls: [human],
      enemies: [{ slot: 0, type: BLESSED, x: v.body.x + 1, y: v.body.y, z: 0 }] });
    const rescue = bot.update(0, v);
    expect(rescue.dirX).toBeGreaterThan(0);
    expect(rescue.fire).toBe(1); expect(rescue.yaw).toBe(0); expect(rescue.pitch).toBeGreaterThan(0);
    v.souls = [];
    v.humanSouls = [];
    v.enemies = [];
    expect(bot.update(1000, v)).toMatchObject({ dirX: 0, dirY: 0 });
    v.activePhase = PHASE_COMBAT;
    v.dead = true;
    expect(bot.update(2000, v)).toMatchObject({ dirX: 0, dirY: 0, fire: 0 });
  });
});
