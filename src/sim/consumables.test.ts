import { describe, expect, it } from 'vitest';
import { BLESSED, CHERUB, GATEKEEPER } from '../data/enemies';
import { INPUT_DEFAULTS, enemyAt, makeSim, put, room } from './testutil/sims';
import { dungeonOf } from './testutil/maps';
import { PROJ_ARROW, PROJ_CENSER, PROJ_GLOBE, type SimPlayer } from './sim';
import type { InputMsg } from '../net/protocol';

function fixture(players = 1, geometry = room(40, 20)) {
  const dungeon = dungeonOf(geometry);
  dungeon.rooms = [{ id: 'items', name: 'Items', kind: 'breach', rect: { x0: 1, y0: 1, x1: geometry[0].length - 2, y1: geometry.length - 2 },
    leaves: [], entry: [{ socket: 0, cells: [[2, 2], [3, 2], [4, 2], [5, 2]] }], waves: [], boss: false }];
  const sim = makeSim(geometry, Array(players).fill('heretic'), { dungeon, noWaves: true, god: true });
  for (const p of sim.players) put(sim, p, 5.5, 5.5); return sim;
}
function input(p: SimPlayer, seq: number, one: number, two: number): InputMsg {
  return { ...INPUT_DEFAULTS, seq, x: p.x, y: p.y, z: p.z, yaw: p.yaw, pitch: p.pitch, fire: 0,
    qPresses: 0, ePresses: 0, item1Presses: one, item2Presses: two, allyTargetId: 255, lastTeleportId: p.teleportId };
}
const step = (sim: ReturnType<typeof fixture>, count: number) => { for (let i = 0; i < count; i++) sim.step(); };

describe('R03 consumable transactions', () => {
  it('assigns one unique action ID to every successful self or area use, never a rejected use', () => {
    const sim = fixture(), p = sim.players[0];
    expect(sim.items.use(p, 'balm')).toBe(false); expect(sim.items.use(p, 'feather')).toBe(true);
    p.itemReadyTick = 0; expect(sim.items.use(p, 'mirror')).toBe(true);
    const uses = sim.events.map(e => e.event).filter(e => e.type === 'itemUsed');
    expect(uses.map(e => e.actionId)).toEqual([1, 2]); expect(uses[1].instance?.id).toBe(2);
  });
  it('baselines, wraps and consumes edges once; refused slot 1 leaves slot 2 available before contacts', () => {
    const sim = fixture(), p = sim.players[0]; p.inventory = [{ item: 'balm', count: 3 }, { item: 'feather', count: 3 }];
    sim.applyInput(0, input(p, 0, 255, 255), 0); sim.step(); expect(p.inventory[1]?.count).toBe(3);
    sim.applyInput(0, input(p, 1, 0, 0), 33); sim.step();
    expect(p.inventory[0]?.count).toBe(3); expect(p.inventory[1]?.count).toBe(2); expect(p.featherUntil).toBe(sim.tick + 240);
    p.hp = 30; sim.applyInput(0, input(p, 2, 1, 1), 66); sim.step(); step(sim, 30);
    expect(p.hp).toBe(30); expect(p.inventory[0]?.count).toBe(3); // no queued retry
    sim.applyInput(0, input(p, 3, 2, 2), 1100); sim.step();
    expect(p.hp).toBe(70); expect(p.inventory[0]?.count).toBe(2); expect(p.inventory[1]?.count).toBe(2);
    sim.applyInput(0, input(p, 4, 1, 1), 1133); step(sim, 31); expect(p.hp).toBe(70); // stale reverse edge
    sim.applyInput(0, input(p, 5, 2, 2), 2200); sim.step(); expect(p.hp).toBe(70); // stale history cannot rearm an old counter
  });
  it('stores useful contacts on cooldown, leaves full stacks, and rejects all bot consumption', () => {
    const sim = fixture(), p = sim.players[0]; p.hp = 20;
    expect(sim.items.pickup(p, 'balm')).toBe(true); expect(p.hp).toBe(60);
    expect(sim.items.pickup(p, 'seal')).toBe(true); expect(p.shield).toBe(0); expect(p.inventory[0]?.item).toBe('seal');
    p.inventory = [{ item: 'balm', count: 3 }, { item: 'seal', count: 2 }]; expect(sim.items.pickup(p, 'feather')).toBe(false);
    p.bot = true; p.itemReadyTick = 0; expect(sim.items.use(p, 'balm')).toBe(false);
  });
  it('shares one shield without replacement/depletion bursts, and Feather refreshes without stacking', () => {
    const sim = fixture(), p = sim.players[0]; p.god = false;
    sim.giveShield(p, 150, 8, p); expect(sim.items.use(p, 'seal')).toBe(false);
    p.shield = 49; expect(sim.items.use(p, 'seal')).toBe(true); expect(p.shieldCaster).toBeNull();
    sim.damagePlayer(p, 60); expect(p.hp).toBe(140); expect(sim.events.some(e => e.event.type === 'shroudBurst')).toBe(false);
    p.itemReadyTick = 0; sim.items.use(p, 'feather'); const speed = p.speed;
    step(sim, 30); sim.items.use(p, 'feather'); expect(p.speed).toBe(speed); expect(p.featherUntil).toBe(sim.tick + 240);
    sim.damagePlayer(p, 10000); expect(p.featherUntil).toBe(0);
  });
  it('stores valley areas, reserves four owner slots, replaces same-type and rejects a fifth without charge', () => {
    const sim = fixture(), p = sim.players[0]; expect(sim.items.pickup(p, 'venom')).toBe(true); expect(sim.items.effects).toHaveLength(0);
    for (const item of ['venom', 'frost', 'chain', 'mirror'] as const) { p.itemReadyTick = 0; expect(sim.items.use(p, item)).toBe(true); }
    p.itemReadyTick = 0; expect(sim.items.use(p, 'plume')).toBe(false); expect(p.itemReadyTick).toBe(0);
    const original = sim.items.effects.find(e => e.item === 'venom')!.id;
    expect(sim.items.use(p, 'venom')).toBe(true); expect(sim.items.effects).toHaveLength(4);
    expect(sim.items.effects.some(e => e.id === original)).toBe(false);
  });
  it('reserves hostile projectile capacity and refuses a throw before charging at the player cap', () => {
    const sim = fixture(), p = sim.players[0];
    for (let i = 0; i < 336; i++) expect(sim.spawnProjectile(PROJ_CENSER, 20, 10, 2, 1, 0, 0, 1, .1, 1, 20, 0)).toBeGreaterThanOrEqual(0);
    expect(sim.items.use(p, 'venom')).toBe(false); expect(p.itemReadyTick).toBe(0);
    for (let i = 0; i < 64; i++) expect(sim.spawnProjectile(PROJ_ARROW, 20, 10, 2, 1, 0, 0, 1, .1, 1, 20, -1)).toBeGreaterThanOrEqual(0);
    expect(sim.projectiles).toHaveLength(400);
  });
});

describe('accepted flights and area geometry', () => {
  it('bounds a vertical throw at 30 ticks, starts duration at landing, and reconnect sync keeps immutable identity', () => {
    const sim = fixture(), p = sim.players[0]; p.pitch = Math.PI / 2;
    expect(sim.items.use(p, 'venom')).toBe(true); const accepted = sim.items.records()[0];
    step(sim, 29); expect(sim.items.records()[0].activatedTick).toBe(-1);
    sim.step(); const landed = sim.items.records()[0];
    expect(landed).toMatchObject({ id: accepted.id, dx: accepted.dx, dy: accepted.dy, dz: 1, startTick: 0, activatedTick: 30, endTick: 210 });
    expect(landed.x).toBeCloseTo(p.x); expect(landed.z).toBe(0);
    expect(sim.floorSync(sim.runId).itemEffects).toEqual(sim.items.records());
    step(sim, 180); expect(sim.items.effects).toHaveLength(0);
  });
  it('lands early on moving-enemy interception, and validates floor before charge', () => {
    const sim = fixture(), p = sim.players[0]; sim.items.use(p, 'venom'); step(sim, 3);
    const target = enemyAt(sim, BLESSED, 8.5, 5.5); sim.eHp[target] = 1000; sim.eRootUntil[target] = 1000;
    step(sim, 5); expect(sim.items.records()[0].activatedTick).toBeLessThan(9); expect(sim.eHp[target]).toBeLessThan(1000);
    p.itemReadyTick = 0; put(sim, p, .5, .5); expect(sim.items.use(p, 'chain')).toBe(false); expect(p.itemReadyTick).toBe(0);
  });
  it('clips an open owning-room edge and never reaches a second room', () => {
    const sim = fixture(), p = sim.players[0];
    for (let y = 1; y <= 20; y++) for (let x = 10; x <= 40; x++) sim.map.roomOf[y * sim.map.w + x] = 1;
    sim.items.use(p, 'frost'); step(sim, 30); const e = sim.items.records()[0];
    expect(e.x).toBeCloseTo(9.99); expect(e.room).toBe(0);
    const target = enemyAt(sim, BLESSED, 10.5, 5.5); sim.items.update(); expect(sim.items.slowed[target]).toBe(0);
  });
  it('keeps accepted areas/flights through death; disconnect cancels all and clear cancels offensive instances', () => {
    const sim = fixture(2), p = sim.players[0]; p.god = false; sim.items.use(p, 'venom'); sim.damagePlayer(p, 10000);
    step(sim, 30); expect(sim.items.effects[0].activatedTick).toBeGreaterThanOrEqual(0);
    sim.items.clearCombat(0); expect(sim.items.effects).toHaveLength(0);
    const q = sim.players[1]; sim.items.use(q, 'mirror'); sim.removePlayer(q.id, true); expect(sim.items.effects).toHaveLength(0);
  });
  it('does not affect flyers, other terraces or enemies behind walls', () => {
    const sim = fixture(1, ['#############', '#000000#0000#', '#000000#0000#', '#000000#0000#', '#000000#0000#', '#000000#0000#', '#000000#0000#', '#############']);
    const p = sim.players[0]; put(sim, p, 5.5, 4.5); sim.items.use(p, 'chain');
    const flyer = enemyAt(sim, CHERUB, 4.5, 4.5), wall = enemyAt(sim, BLESSED, 8.5, 4.5), high = enemyAt(sim, BLESSED, 4.5, 5.5, 3);
    sim.items.update(); expect([flyer, wall, high].map(s => sim.isRooted(s))).toEqual([false, false, false]);
    sim.eZ[flyer] = 0; sim.eGrounded[flyer] = 1; sim.items.update(); expect(sim.isRooted(flyer)).toBe(true);
  });
});

describe('catalog area rules', () => {
  it('Water deals twelve pulses with shared per-incarnation 15-tick minimum and newest-area ownership', () => {
    const sim = fixture(2); for (const p of sim.players) p.pitch = -Math.PI / 2;
    const target = enemyAt(sim, BLESSED, 6.5, 5.5); sim.eHp[target] = 1000;
    sim.items.use(sim.players[0], 'venom');
    for (let tick = 1; tick <= 3; tick++) { sim.tick = tick; sim.items.update(); }
    const first = sim.items.records()[0];
    expect(first.activatedTick).toBe(3); expect(sim.eHp[target]).toBe(995);
    sim.tick = 5; sim.items.use(sim.players[1], 'venom'); sim.items.update();
    sim.tick = 8; sim.items.update(); sim.tick = 9; sim.items.update(); // newest landing cannot reset damage interval
    expect(sim.eHp[target]).toBe(995);
    for (let tick = 10; tick <= 191; tick++) { sim.tick = tick; sim.items.update(); }
    expect(sim.eHp[target]).toBeGreaterThanOrEqual(935); expect(sim.eHp[target]).toBeLessThanOrEqual(945);
    expect(sim.players[1].damage).toBeGreaterThan(0);
  });
  it('a single Water area emits exactly twelve non-lingering pulses', () => {
    const sim = fixture(), p = sim.players[0]; p.pitch = -Math.PI / 2;
    const target = enemyAt(sim, BLESSED, 6.5, 5.5); sim.eHp[target] = 1000;
    sim.items.use(p, 'venom');
    for (let tick = 1; tick <= 210; tick++) { sim.tick = tick; sim.items.update(); }
    expect(sim.eHp[target]).toBe(940); expect(sim.items.effects).toHaveLength(0);
  });
  it('Ash ends on exit and Vial attempts once per incarnation, without extending an older bind', () => {
    const sim = fixture(), p = sim.players[0]; p.pitch = -Math.PI / 2; sim.items.use(p, 'frost'); step(sim, 3);
    const s = enemyAt(sim, BLESSED, 6.5, 5.5); sim.items.update(); expect(sim.items.slowed[s]).toBe(1);
    sim.eX[s] = 20; sim.items.update(); expect(sim.items.slowed[s]).toBe(0);
    p.itemReadyTick = 0; sim.items.use(p, 'chain'); sim.eX[s] = 6.5; sim.items.update(); const end = sim.eRootUntil[s];
    sim.tick = end + 1; sim.items.update(); expect(sim.isRooted(s)).toBe(false);
    sim.eIncarnation[s]++; sim.items.update(); expect(sim.isRooted(s)).toBe(true);
    sim.eRootUntil[s] = sim.tick + 300; p.itemReadyTick = 0; sim.items.use(p, 'chain'); expect(sim.eRootUntil[s]).toBe(sim.tick + 300);
  });
  it('Plume skips bound/airborne/boss once, and launches an eligible body without damage', () => {
    const sim = fixture(), p = sim.players[0]; p.pitch = -Math.PI / 2;
    const bound = enemyAt(sim, BLESSED, 6, 5), free = enemyAt(sim, BLESSED, 6, 6), boss = enemyAt(sim, GATEKEEPER, 7, 5);
    sim.eRootUntil[bound] = 10; sim.items.use(p, 'plume'); step(sim, 3);
    expect(sim.eGrounded[free]).toBe(0); expect(sim.eHp[free]).toBe(20); expect(sim.eKbUntil[boss]).toBe(0);
    sim.tick = 11; sim.items.update(); expect(sim.eKbUntil[bound]).toBe(0);
  });
  it.each([PROJ_ARROW, PROJ_GLOBE])('reflects projectile %i once in place, preserving base damage and harmless allies/souls', kind => {
    const sim = fixture(2), p = sim.players[0]; put(sim, p, 12, 10); put(sim, sim.players[1], 9, 10);
    const enemy = enemyAt(sim, BLESSED, 3, 10); sim.eHp[enemy] = 1000; sim.eRootUntil[enemy] = 1000;
    sim.items.use(p, 'mirror'); const shot = sim.spawnProjectile(kind, 3, 10, 1, 1, 0, 0, 20, .15, 8, 30, -1);
    step(sim, 10); expect(sim.pReflected[shot]).toBe(1); expect(sim.projectiles).toHaveLength(1);
    step(sim, 10); expect(sim.eHp[enemy]).toBe(984); expect(sim.players[1].hp).toBe(150);
    expect(sim.events.filter(e => e.event.type === 'itemReflected')).toHaveLength(1);
    expect(sim.events.some(e => e.event.type === 'globeShatter')).toBe(false);
  });
  it('an already reflected shot expires harmlessly after its owner disconnects', () => {
    const sim = fixture(2), p = sim.players[0]; put(sim, p, 12, 10); put(sim, sim.players[1], 30, 10);
    const s = enemyAt(sim, BLESSED, 3, 10); sim.eHp[s] = 1000; sim.eRootUntil[s] = 1000;
    sim.items.use(p, 'mirror'); const shot = sim.spawnProjectile(PROJ_ARROW, 3, 10, 1, 1, 0, 0, 20, .15, 8, 30, -1);
    step(sim, 8); expect(sim.pReflected[shot]).toBe(1); sim.removePlayer(0, true); step(sim, 15); expect(sim.eHp[s]).toBe(1000);
  });
});
