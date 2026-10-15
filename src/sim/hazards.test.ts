import { describe, expect, it } from 'vitest';
import { Hazards, DryNavigation } from './hazards';
import { FlowField, stepAllowed, UNREACHABLE } from './flowfield';
import { BLESSED, CHORISTER, CHERUB, DOMINION } from '../data/enemies';
import { HaloLedger } from './economy';
import { PHASE_CLEARED, PHASE_COMBAT } from '../net/protocol';
import { Simulation } from './sim';
import { dungeonOf } from './testutil/maps';
import { aimAt, put, room } from './testutil/sims';
import { loadMap } from './map';

function dungeon(heights = room(24, 24)) {
  const def = dungeonOf(heights);
  def.rooms = [{ id: 'fire', name: 'Fire', kind: 'combat', shape: '1x1', band: 2, focus: 'hazard',
    rect: { x0: 1, y0: 1, x1: heights[0].length - 2, y1: heights.length - 2 }, entry: [{ socket: 0, cells: [[1, 1], [2, 1], [3, 1], [4, 1]] }], leaves: [], boss: false,
    waves: [{ blessed: 1, choristers: 0, cherubs: 0 }], hazards: [{ rect: { x0: 10, y0: 1, x1: 11, y1: heights.length - 6 }, hazard: 'refiners-fire' }] }];
  return def;
}
function fixture() {
  const sim = new Simulation({ dungeon: dungeon(), noWaves: true, seed: 7, players: [{ id: 0, name: 'P', classId: 'betrayer' }] });
  sim.activeRoom = 0; sim.rooms[0].phase = PHASE_COMBAT; sim.rooms[0].alive = 1; // Keep the room active while testing isolated damage.
  put(sim, sim.players[0], 10.5, 8.5); sim.refreshFields(); return sim;
}

describe('accepted fire contact and world damage', () => {
  it('uses only active-room actual feet contact and excludes hover, airborne and wrong heights', () => {
    const map = loadMap(dungeon()), fire = new Hazards(map);
    expect(fire.contact(10.5, 8.5, 0, true)).toBe(false); fire.setRoom(0);
    expect(fire.contact(10.5, 8.5, 0, true)).toBe(true);
    for (const z of [0.051, 4, -0.051, NaN]) expect(fire.contact(10.5, 8.5, z, true)).toBe(false);
    expect(fire.contact(10.5, 8.5, 0, false)).toBe(false); expect(fire.contact(9.5, 8.5, 0, true)).toBe(false);
    fire.setRoom(255); expect(fire.contact(10.5, 8.5, 0, true)).toBe(false);
  });
  it('deals 7 player HP/s through the native shield/immunity path and stops on clear', () => {
    const sim = fixture(), p = sim.players[0]; p.hp = 150;
    for (let i = 0; i < 30; i++) sim.step(); expect(p.hp).toBeCloseTo(143);
    p.shield = 10; p.shieldUntil = sim.tick + 100; for (let i = 0; i < 30; i++) sim.step(); expect(p.shield).toBeCloseTo(3); expect(p.hp).toBeCloseTo(143);
    p.invulUntil = sim.tick + 100; sim.step(); expect(p.shield).toBeCloseTo(3);
    sim.rooms[0].phase = PHASE_CLEARED; for (let i = 0; i < 30; i++) sim.step(); expect(p.hp).toBeCloseTo(143); expect(sim.hazards.room).toBe(-1);
  });
  for (const type of [CHORISTER, DOMINION]) it(`deals 35 enemy HP/s to type ${type}, sets pooled, excludes hovering Cherubs and preserves Field of Blood membership`, () => {
    const sim = fixture(); put(sim, sim.players[0], 4.5, 8.5);
    const s = sim.placeEnemy(type, 10, 8, 0), flying = sim.placeEnemy(CHERUB, 10, 12, 0);
    sim.eZ[flying] = 4; sim.eGrounded[flying] = 0; sim.root(s, 100); sim.stun(flying, 100);
    sim.eHp[s] = 1000;
    for (let i = 0; i < 30; i++) sim.step(); expect(sim.eHp[s]).toBeCloseTo(930); // Native bound doubles damage.
    expect(sim.ePooled[s]).toBe(1); expect(sim.eHp[flying]).toBe(30); expect(sim.ePooled[flying]).toBe(0);
    sim.rooms[0].phase = PHASE_CLEARED; sim.fieldX = sim.eX[s]; sim.fieldY = sim.eY[s]; sim.fieldUntil = sim.tick + 10; sim.step();
    expect(sim.ePooled[s]).toBe(1); expect(sim.eHp[s]).toBeCloseTo(930);
  });
  it('settles an ordinary world death once with no player killer and no cleanup loot', () => {
    const sim = fixture(); put(sim, sim.players[0], 4.5, 8.5);
    sim.rewards.haloLedgers.set(0, new HaloLedger(3, 1));
    const s = sim.placeEnemy(BLESSED, 10, 8, 0); sim.stun(s, 100); sim.eHp[s] = 60.5;
    sim.eWave[s] = 0;
    sim.rooms[0].waveAlive[0] = 1;
    // A real Revolver setup leaves half an HP; the same tick's fire gets world provenance.
    aimAt(sim, sim.players[0], s); sim.players[0].fire = 1; sim.random = () => 0.5;
    sim.step(); expect(sim.eAlive[s]).toBe(0); expect(sim.ePooled[s]).toBe(0); expect(sim.players[0].kills).toBe(0);
    expect(sim.events.some((m) => m.event.type === 'bursts' && m.event.list[2] === -1)).toBe(true);
    expect(sim.rewards.haloLedgers.get(0)?.paid).toBe(3); expect(sim.pickups.live).toHaveLength(3);
    const count = sim.pickups.live.length; sim.step(); expect(sim.pickups.live).toHaveLength(count);
  });
});

describe('bounded dry fields and shared nearest-dry routing', () => {
  for (const type of [CHORISTER, DOMINION]) it(`escapes a displacement into fire while type ${type} is casting, without restarting its deadline`, () => {
    const sim = fixture(); put(sim, sim.players[0], 8.5, 8.5);
    const s = sim.placeEnemy(type, 10, 8, 0); sim.refreshFields(); sim.step();
    const cast = sim.dominions.active.get(s);
    for (let i = 0; i < 19; i++) sim.step();
    expect(sim.eX[s]).toBeLessThan(10); expect(sim.ePooled[s]).toBe(0);
    if (type === DOMINION) expect(sim.dominions.active.get(s)?.impactTick).toBe(cast!.impactTick);
    else expect(sim.eCast[s]).toBe(1);
  });
  for (const control of ['root', 'stun'] as const) it(`keeps ${control} movement authority when an avoider stands in fire`, () => {
    const sim = fixture(); put(sim, sim.players[0], 8.5, 8.5); const s = sim.placeEnemy(DOMINION, 10, 8, 0);
    sim[control](s, 100); for (let i = 0; i < 20; i++) sim.step();
    expect(sim.eX[s]).toBe(10.5); expect(sim.ePooled[s]).toBe(1);
  });
  it('routes the shared dry field through a bridge and rejects corner cutting', () => {
    const map = loadMap(dungeon()), fire = new Hazards(map); fire.setRoom(0);
    const normal = new FlowField(map, false); normal.compute(16, 8);
    const nav = new DryNavigation(map, fire.active); nav.setRoom(0); const dry = nav.compute(0, 16, 8)!;
    expect(normal.at(5, 8)).toBeLessThan(dry.at(5, 8)); expect(dry.at(10, 8)).toBe(UNREACHABLE);
    expect(stepAllowed(map, 9, 8, 0, false, fire.active)).toBe(false);
    expect(stepAllowed(map, 9, 8, 4, false, fire.active)).toBe(false);
  });
  it('projects fire targets by legal distance then row-major anchor and escapes instead of rerunning searches', () => {
    const map = loadMap(dungeon()), fire = new Hazards(map); fire.setRoom(0); const nav = new DryNavigation(map, fire.active); nav.setRoom(0);
    const cell = 8 * map.w + 10; expect(nav.project(cell)).toBe(8 * map.w + 9); expect(nav.escapeStep(cell)).toBe(8 * map.w + 9);
    expect(nav.compute(0, 10, 8)!.targetCell).toBe(8 * map.w + 9);
    const field = nav.fields[0]; for (let i = 0; i < 100; i++) { nav.setRoom(0); nav.compute(0, 10, 8); nav.escapeStep(cell); }
    expect(nav.builds).toBe(1); expect(nav.fields[0]).toBe(field);
    for (let slot = 1; slot < 9; slot++) nav.compute(slot, 16, 8); expect(nav.fields.filter(Boolean)).toHaveLength(4);
    nav.setRoom(-1); expect(nav.fields).toHaveLength(0); expect(nav.escapeStep(cell)).toBe(-1);
  });
  it('stops with no legal dry escape/anchor', () => {
    const def = dungeon(room(16, 16)); def.rooms[0].hazards = [{ hazard: 'refiners-fire', rect: def.rooms[0].rect }];
    const map = loadMap(def), fire = new Hazards(map); fire.setRoom(0); const nav = new DryNavigation(map, fire.active); nav.setRoom(0);
    expect(nav.project(8 * map.w + 10)).toBe(-1); expect(nav.compute(0, 10, 8)!.targetCell).toBe(-1);
    expect(nav.escapeStep(8 * map.w + 10)).toBe(-1);
  });
  it('routes legal one-way drops but refuses an unsteppable dry rim around a fire pit', () => {
    for (const raisedFire of [true, false]) {
      const hg = room(16, 16).map((r) => r.split(''));
      for (let y = 1; y <= 16; y++) for (let x = 1; x <= 16; x++) hg[y][x] = raisedFire ? '0' : '8';
      for (let y = 8; y <= 9; y++) for (let x = 10; x <= 11; x++) hg[y][x] = raisedFire ? '8' : '0';
      const def = dungeon(hg.map((r) => r.join(''))); def.rooms[0].hazards = [{ hazard: 'refiners-fire', rect: { x0: 10, y0: 8, x1: 11, y1: 9 } }];
      const map = loadMap(def), fire = new Hazards(map); fire.setRoom(0); const nav = new DryNavigation(map, fire.active); nav.setRoom(0);
      expect(nav.project(8 * map.w + 10)).toBe(raisedFire ? 7 * map.w + 10 : -1);
      const ordinary = new FlowField(map, false); ordinary.compute(10, 8);
      if (raisedFire) expect(ordinary.at(10, 7)).toBe(UNREACHABLE);
    }
  });
  it('displaced avoiders follow their cached escape while native ordinary steering never enters fire', () => {
    const sim = fixture(); put(sim, sim.players[0], 17.5, 8.5);
    const s = sim.placeEnemy(DOMINION, 5, 8, 0); sim.refreshFields();
    for (let i = 0; i < 30; i++) sim.step(); expect(sim.eX[s]).toBeLessThan(10); expect(sim.ePooled[s]).toBe(0);
    sim.eX[s] = 10.5; sim.eY[s] = 8.5; sim.eZ[s] = 0; sim.eGrounded[s] = 1;
    for (let i = 0; i < 30; i++) sim.step(); expect(sim.eX[s]).toBeLessThan(10); expect(sim.ePooled[s]).toBe(0); expect(sim.dryNavigation.builds).toBe(1);
    sim.removeEnemy(s); sim.step(); expect(sim.dryNavigation.fields).toHaveLength(0); expect(sim.dryNavigation.room).toBe(-1);
  });
  it('routes Blessed around fire and lets a pushed Blessed climb out of a half-metre channel', () => {
    const sim = fixture(); put(sim, sim.players[0], 17.5, 8.5);
    for (let r = 1; r <= 20; r++) for (const c of [10, 11]) sim.map.floor[r * sim.map.w + c] = -0.5;
    const s = sim.placeEnemy(BLESSED, 5, 8, 0); sim.eHp[s] = 1000; sim.refreshFields();
    for (let i = 0; i < 100; i++) { sim.step(); expect(sim.ePooled[s]).toBe(0); }
    expect(sim.dryNavigation.builds).toBe(1);
    sim.eX[s] = 10.5; sim.eY[s] = 8.5; sim.eZ[s] = -0.5; sim.eGrounded[s] = 1;
    for (let i = 0; i < 20; i++) sim.step();
    expect(sim.eX[s]).toBeLessThan(10); expect(sim.eZ[s]).toBe(0); expect(sim.ePooled[s]).toBe(0);
    expect(sim.eHp[s]).toBeLessThan(1000); expect(sim.dryNavigation.builds).toBe(1);
  });
});
