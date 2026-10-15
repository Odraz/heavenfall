import { describe, expect, it } from 'vitest';
import { PROP_HEIGHT, propDefs, type PropDef } from '../data/props';
import { COIN, DROPPED_ITEM_LIFETIME, GOLD_HALO, HEAL_MOTE, ITEM_FIRST, itemDrop } from '../data/pickups';
import type { ClassId } from '../data/classes';
import { PEARLY_POOL_R1, poolTemplate } from '../data/rooms/1';
import { BLESSED, CHORISTER } from '../data/enemies';
import { ATTACK_PRIMARY, ATTACK_SECONDARY } from '../data/weapons';
import { generateFloor } from '../gen';
import { PHASE_CLEARED } from '../net/protocol';
import { Props } from './props';
import { Simulation } from './sim';
import { HaloLedger } from './economy';
import { dungeonOf } from './testutil/maps';
import { put, room } from './testutil/sims';

const prop = (id: number, family: PropDef['family'], x: number, y = 5.5, marked = false): PropDef => ({ id, room: 0, family, x, y, marked, variant: 0 });
function make(defs: PropDef[], classes: ClassId[] = ['betrayer'], heights = room(30, 12)) {
  const dungeon = dungeonOf(heights);
  dungeon.rooms = [{ id: 'props', name: 'Props', kind: 'combat', shape: '1x1', band: 1,
    rect: { x0: 1, y0: 1, x1: heights[0].length - 2, y1: heights.length - 2 }, leaves: [],
    entry: [{ socket: 0, cells: [[1, 1], [2, 1], [3, 1], [1, 2]] }], waves: [{ blessed: 1, choristers: 0, cherubs: 0 }], boss: false }];
  const sim = new Simulation({ dungeon, props: defs, players: classes.map((classId, id) => ({ id, name: `P${id}`, classId })), seed: 1, noWaves: true });
  sim.rooms[0].phase = PHASE_CLEARED;
  for (const p of sim.players) put(sim, p, 2.5, 5.5);
  sim.random = () => 0.5;
  return sim;
}
function aim(sim: Simulation, id: number) {
  const q = sim.props.get(id)!, p = sim.players[0];
  p.yaw = Math.atan2(q.y - p.y, q.x - p.x);
  p.pitch = Math.atan2(q.z + PROP_HEIGHT[q.family] / 2 - (p.z + 1.6), Math.hypot(q.x - p.x, q.y - p.y));
}

it('recharges effect props at fifteen seconds, never loot or repeated shots during depletion', () => {
  const sim = make([prop(1, 'blessing', 4.5), prop(2, 'blast', 15.5), prop(3, 'loot', 25.5)]);
  sim.players[0].hp = 20;
  for (const id of [1, 2, 3]) expect(sim.props.break(id, 0)).toBe(true);
  expect(sim.players[0].hp).toBe(50);
  for (let i = 0; i < 449; i++) sim.step();
  expect(sim.props.break(1, 449)).toBe(false);
  expect(sim.props.checkpoint().propRecharges).toEqual([{ id: 1, readyTick: 450 }, { id: 2, readyTick: 450 }]);
  sim.step();
  expect(sim.props.checkpoint().brokenProps).toEqual([3]);
  expect(sim.events.filter((m) => m.event.type === 'propReady')).toHaveLength(2);
  expect(sim.props.break(1, sim.tick)).toBe(true); expect(sim.players[0].hp).toBe(80);
  expect(sim.props.break(2, sim.tick)).toBe(true); expect(sim.props.get(2)!.blastTick).toBe(456);
  expect(sim.props.break(3, sim.tick)).toBe(false);
});

describe('R2.2 seeded prop bodies', () => {
  it('keeps canonical socket identity and loot variants through generated orientations and unfilled sockets', () => {
    for (const seed of [1, 2, 3, 317434499]) {
      const g = generateFloor(seed, 1, 1, PEARLY_POOL_R1), defs = propDefs(g.floor);
      const sim = new Simulation({ dungeon: g.def, map: g.map, props: defs, seed: 1, players: [{ id: 0, name: 'P', classId: 'fallen' }] });
      expect(new Set(defs.map((d) => d.id)).size).toBe(defs.length);
      expect(sim.props.all).toHaveLength(g.floor.props.length);
      g.floor.props.forEach((p, i) => {
        const template = poolTemplate(PEARLY_POOL_R1, g.floor.rooms[p.room].templateId);
        expect(defs[i].id).toBe((p.room + 1) * 65536 + p.index);
        expect(defs[i].variant).toBe(template.props.slice(0, p.index).filter((q) => q.family === 'loot').length % 3);
        expect([defs[i].x, defs[i].y]).toEqual([p.at[0] + 0.5, p.at[1] + 0.5]);
      });
      expect(defs.filter((d) => d.marked)).toHaveLength(1);
    }
    expect(propDefs(null)).toEqual([]);
  });
  it('does not alter movement collision or break when enemies pass through', () => {
    const sim = make([prop(1, 'loot', 8.5)]), i = 5 * sim.map.w + 8;
    expect(sim.map.solid[i]).toBe(0);
    const s = sim.placeEnemy(BLESSED, 8, 5, 0);
    sim.step(); expect(sim.eAlive[s]).toBe(1); expect(sim.props.get(1)!.broken).toBe(false);
    const before = sim.map.solid.slice(); sim.props.break(1, sim.tick); expect(sim.map.solid).toEqual(before);
  });
  it('uses exact ray cylinders, including a downward ray onto their top, and skips broken bodies', () => {
    const sim = make([prop(1, 'loot', 8.5)]);
    expect(sim.props.ray(2.5, 5.5, 0.5, 1, 0, 0, 10)[0].distance).toBe(5.5);
    expect(sim.props.ray(2.5, 5.5, 1.6, 1, 0, 0, 10)).toEqual([]);
    expect(sim.props.ray(8.5, 5.5, 2, 0, 0, -1, 10)[0].distance).toBe(0.5);
    sim.props.break(1, 0); expect(sim.props.ray(2.5, 5.5, 0.5, 1, 0, 0, 10)).toEqual([]);
  });
});

describe('native damage against props', () => {
  for (const classId of ['fallen', 'heretic', 'binder', 'betrayer'] as const) {
    it(`${classId} primary breaks an aimed prop exactly once`, () => {
      const sim = make([prop(1, 'loot', 7.5)], [classId]); aim(sim, 1);
      sim.fireWeapon(sim.players[0], ATTACK_PRIMARY);
      for (let i = 0; i < 15; i++) sim.step();
      expect(sim.props.get(1)!.broken).toBe(true);
      expect(sim.events.filter((e) => e.event.type === 'propBroken')).toHaveLength(1);
    });
  }
  it('ray damage stops at terrain and before props beyond the final nonpierced enemy', () => {
    const heights = room(30, 12).map((r, i) => i > 0 && i < 13 ? r.slice(0, 6) + '#' + r.slice(7) : r);
    const wall = make([prop(1, 'loot', 7.5)], ['betrayer'], heights); aim(wall, 1); wall.fireWeapon(wall.players[0]);
    expect(wall.props.get(1)!.broken).toBe(false);
    const enemy = make([prop(1, 'loot', 9.5)]); const s = enemy.placeEnemy(CHORISTER, 5, 5, 0); aim(enemy, 1); enemy.fireWeapon(enemy.players[0]);
    expect(enemy.eAlive[s]).toBe(0); expect(enemy.props.get(1)!.broken).toBe(false);
  });
  it('piercing and Scourge hit only props reached by the ray or forward arc', () => {
    const bullet = make([prop(1, 'loot', 6.5), prop(2, 'loot', 12.5)]); aim(bullet, 1); bullet.silverBullet(bullet.players[0]);
    // A downward ray that hits the first vase reaches the floor before the second.
    expect(bullet.props.get(1)!.broken).toBe(true); expect(bullet.props.get(2)!.broken).toBe(false);
    const arc = make([prop(1, 'loot', 4.5), prop(2, 'loot', 1.5)], ['binder']); arc.scourge(arc.players[0]);
    expect(arc.props.get(1)!.broken).toBe(true); expect(arc.props.get(2)!.broken).toBe(false);
  });
  it('incense pulses, Falling Star, a Shroud burst and accepted dash segments hit prop cylinders', () => {
    const cloud = make([prop(1, 'loot', 5.5)], ['heretic']); cloud.clouds.push({ x: 5, y: 5.5, z: 0.5, owner: cloud.players[0], from: 1, until: 30 }); cloud.step();
    expect(cloud.props.get(1)!.broken).toBe(true);
    const star = make([prop(1, 'loot', 5.5)], ['fallen']); const f = star.players[0]; put(star, f, 5.5, 5.5); f.landingTick = 1; star.step();
    expect(star.props.get(1)!.broken).toBe(true);
    const shroud = make([prop(1, 'loot', 3.5)], ['heretic']); const h = shroud.players[0]; shroud.giveShield(h, 1, 8, h); shroud.damagePlayer(h, 2);
    expect(shroud.props.get(1)!.broken).toBe(true);
    const dash = make([prop(1, 'loot', 5.5)]); const p = dash.players[0];
    p.dash = { pressSeq: 0, pts: [2.5, 5.5, 0, 8.5, 5.5, 0], done: 1, acceptTick: 0, full: true, cut: new Set() }; dash.step();
    expect(dash.props.get(1)!.broken).toBe(true);
  });
  it('areas cannot hit through walls or vertically distant floors and heal/control-only attacks leave props intact', () => {
    const sim = make([prop(1, 'loot', 5.5)]);
    sim.props.area(5.5, 5.5, 10, 4, 0); expect(sim.props.get(1)!.broken).toBe(false);
    const i = 5 * sim.map.w + 4; sim.map.solid[i] = 1; sim.map.top[i] = 16;
    sim.props.area(2.5, 5.5, 0.9, 4, 0); expect(sim.props.get(1)!.broken).toBe(false);
    const healing = make([prop(1, 'blessing', 3.5)], ['heretic']); aim(healing, 1); healing.fireWeapon(healing.players[0], ATTACK_SECONDARY);
    expect(healing.props.get(1)!.broken).toBe(false);
  });
});

describe('prop effects and recovery', () => {
  it('small effect props have matching attack heights and blasts respect shields, mitigation, walls and range', () => {
    const sim = make([prop(1, 'blast', 10.5), prop(2, 'blessing', 20.5)], ['betrayer', 'fallen', 'heretic', 'binder']);
    expect(PROP_HEIGHT).toMatchObject({ blast: 1.1, blessing: 1 });
    expect(sim.props.ray(8.5, 5.5, 1.2, 1, 0, 0, 4)).toEqual([]);
    expect(sim.props.ray(8.5, 5.5, 0.55, 1, 0, 0, 4)[0].prop.id).toBe(1);
    const [shielded, fallen, behindWall, outside] = sim.players;
    put(sim, shielded, 10.5, 7.5); sim.giveShield(shielded, 50, 10);
    put(sim, fallen, 8.5, 5.5); put(sim, behindWall, 12.5, 5.5); put(sim, outside, 18.5, 5.5);
    sim.map.solid[5 * sim.map.w + 11] = 1; sim.map.top[5 * sim.map.w + 11] = 16;
    sim.props.break(1, sim.tick);
    for (let i = 0; i < 6; i++) sim.step();
    expect(shielded.shield).toBe(10); expect(shielded.hp).toBe(shielded.maxHp);
    expect(fallen.hp).toBe(fallen.maxHp - 24);
    expect(behindWall.hp).toBe(behindWall.maxHp); expect(outside.hp).toBe(outside.maxHp);
  });
  it('loot tables follow combat/noncombat thresholds and the eight item weights total 100', () => {
    // The item roll reuses the stubbed value: 0.9 lands on Chain Vial, 0.95 on Plume of Expulsion.
    for (const [combat, cases] of [[true, [[0.69, -1], [0.7, COIN], [0.8, HEAL_MOTE], [0.89, HEAL_MOTE], [0.9, ITEM_FIRST + 6]]],
      [false, [[0.79, -1], [0.8, COIN], [0.9, HEAL_MOTE], [0.94, HEAL_MOTE], [0.95, ITEM_FIRST + 7]]]] as const) {
      for (const [roll, kind] of cases) {
        const sim = make([prop(1, 'loot', 8.5)]); sim.map.rooms[0].kind = combat ? 'combat' : 'breach'; sim.random = () => roll;
        sim.props.break(1, 0); expect(sim.pickups.live.map((p) => p.kind)).toEqual(kind < 0 ? [] : [kind]);
        // Random item drops fade like currency (audit A1).
        if (kind >= ITEM_FIRST) expect(sim.pickups.live[0].expiresTick).toBe(sim.tick + DROPPED_ITEM_LIFETIME);
        sim.props.break(1, 0); expect(sim.events.filter((e) => e.event.type === 'propBroken')).toHaveLength(1);
      }
    }
    expect(Array.from({ length: 100 }, (_, i) => itemDrop(() => (i + 0.5) / 100)).reduce((n, k) => { n[k - ITEM_FIRST]++; return n; }, Array(8).fill(0))).toEqual([20, 12, 14, 8, 14, 14, 10, 8]);
  });
  it('marked amphora always drops a gold halo once, without consuming a random draw', () => {
    const sim = make([prop(1, 'loot', 8.5, 5.5, true)]); sim.random = () => { throw new Error('marked drop must not roll'); };
    expect(sim.props.break(1, 0)).toBe(true); expect(sim.props.break(1, 0)).toBe(false);
    expect(sim.pickups.live).toHaveLength(1); expect(sim.pickups.live[0]).toMatchObject({ kind: GOLD_HALO, value: 6 });
  });
  it('chains lamps after six ticks in stable ID order, ignores chalices, and world kills have no player credit', () => {
    const sim = make([prop(3, 'blast', 10.5), prop(1, 'blast', 6.5), prop(2, 'blessing', 7.5)], ['betrayer', 'heretic']);
    put(sim, sim.players[0], 6.5, 7.5); put(sim, sim.players[1], 28.5, 9.5);
    const s = sim.placeEnemy(BLESSED, 8, 5, 0); sim.eStunUntil[s] = 9999; sim.eWave[s] = 0; sim.haloLedgers.set(0, new HaloLedger(3, 1));
    sim.props.break(1, 0); const sync = sim.floorSync(sim.runId);
    expect(sync.brokenProps).toEqual([1]); expect(sync.propBlasts).toEqual([{ id: 1, impactTick: 6 }]);
    for (let i = 0; i < 5; i++) sim.step(); expect(sim.eAlive[s]).toBe(1);
    sim.step(); expect(sim.eAlive[s]).toBe(0); expect(sim.players[0].hp).toBe(sim.players[0].maxHp - 40);
    expect(sim.players[0].kills).toBe(0); expect(sim.pickups.live.some((p) => p.kind === COIN)).toBe(true);
    const bursts = sim.events.find((e) => e.event.type === 'bursts')!.event;
    expect(bursts.type === 'bursts' && bursts.list[2]).toBe(-1); expect(bursts.type === 'bursts' && bursts.list[1]).toBeGreaterThanOrEqual(360);
    expect(sim.props.get(3)!.blastTick).toBe(12); expect(sim.props.get(2)!.broken).toBe(false);
    for (let i = 0; i < 6; i++) sim.step();
    expect(sim.events.filter((e) => e.event.type === 'propBlast').map((e) => e.event.type === 'propBlast' && e.event.id)).toEqual([1, 3]);
    expect(sync.brokenProps).toEqual([1]); expect(sync.propBlasts).toEqual([{ id: 1, impactTick: 6 }]);
  });
  it('simultaneously due explosions are ID-ordered even if the seed input list is reversed', () => {
    const sim = make([prop(9, 'blast', 15.5), prop(2, 'blast', 10.5)]);
    sim.props.break(9, 0); sim.props.break(2, 0); for (let i = 0; i < 6; i++) sim.step();
    expect(sim.events.filter((e) => e.event.type === 'propBlast').map((e) => e.event.type === 'propBlast' && e.event.id)).toEqual([2, 9]);
  });
  it('chalice heals only living connected players within body reach/LOS, capped at max HP', () => {
    const sim = make([prop(1, 'blessing', 5.5)], ['betrayer', 'heretic', 'fallen']);
    const [a, b, c] = sim.players; a.hp = 100; b.hp = 40; put(sim, b, 4.5, 5.5); c.hp = 10; c.dead = true;
    expect(sim.props.break(1, 0, 'world')).toBe(false); expect(a.hp).toBe(100);
    sim.props.break(1, 0); expect(a.hp).toBe(120); expect(b.hp).toBe(70); expect(c.hp).toBe(10);
    expect(sim.floorSync(sim.runId).brokenProps).toEqual([1]);
  });
  it('validates the finite prop pool and duplicate IDs', () => {
    const sim = make([]); expect(() => new Props(sim.map, [prop(1, 'loot', 4.5), prop(1, 'blast', 5.5)], () => {})).toThrow('invalid prop pool');
    expect(() => new Props(sim.map, [prop(1, 'loot', -1)], () => {})).toThrow('invalid prop body');
  });
});
