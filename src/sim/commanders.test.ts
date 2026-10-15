import { describe, expect, it } from 'vitest';
import { BLESSED, CANTOR, CARRIER, CHERUB, CHORISTER, DOMINION, ENEMIES } from '../data/enemies';
import { CANTOR_TELL, CANTOR_BEAM, CANTOR_COOLDOWN, CANTOR_BEAM_TURN_SPEED, CARRIER_MIN_HOLD, CARRIER_SWOOP, CARRIER_FLY_THROUGH, CARRIER_TRACK_TICKS, hymnalReduction, turnToward, validCommanderCasts } from '../data/commanders';
import { newRunIdentity } from '../net/version';
import { DUNGEONS } from '../data/dungeons';
import { Simulation } from './sim';
import { carryPathClear, beamSegment } from './commanders';
import { dungeonOf } from './testutil/maps';
import { INPUT_DEFAULTS, put, room, aimAt } from './testutil/sims';
import type { ClassId } from '../data/classes';
import { PHASE_CLEARED, SnapshotAssembler, decodeSnapshot } from '../net/protocol';
import { arenaDungeon, sealAt } from './testutil/arenas';

function fixture(type = CANTOR, party = 1, classId: ClassId = 'betrayer', diagnostics = false) {
  const dungeon = dungeonOf(room(48, 32));
  dungeon.rooms = [{ id: 'families', name: 'Families', kind: 'combat', shape: '1x1', band: 2,
    rect: { x0: 1, y0: 1, x1: 48, y1: 32 }, entry: [{ socket: 0, cells: [[1, 1], [2, 1], [3, 1], [4, 1]] }], leaves: [],
    waves: [{ blessed: 32, choristers: 1, cherubs: 0, dominions: 1, commander: 'cantor' }], boss: false }];
  const sim = new Simulation({ dungeon, noWaves: true, seed: 1, diagnostics, players: Array.from({ length: party }, (_, id) => ({ id, name: `P${id}`, classId })) });
  sim.rooms[0].phase = PHASE_CLEARED;
  sim.players.forEach((p, i) => put(sim, p, 20.5 + i * 3, 10.5)); sim.refreshFields();
  const slot = sim.placeEnemy(type, 10, 10, 0);
  return { sim, slot, p: sim.players[0], c: sim.commanders.active.get(slot)! };
}
function advance(sim: Simulation, slot: number, ticks: number) { for (let i = 0; i < ticks; i++) { sim.tick++; sim.commanders.update(slot); } }
function crowd(sim: Simulation, x = 25, y = 9, count = 8) { for (let i = 0; i < count; i++) sim.placeEnemy(BLESSED, x + i % 2, y + Math.floor(i / 2) % 2, 0); }
function grab(party = 1, classId: ClassId = 'betrayer') {
  const f = fixture(CARRIER, party, classId); crowd(f.sim); f.sim.commanders.readyAt[f.slot] = 0;
  f.sim.commanders.update(f.slot); expect(f.c.phase).toBe('active');
  for (let i = 0; i < CARRIER_SWOOP && f.c.phase === 'active'; i++) advance(f.sim, f.slot, 1);
  expect(f.c.phase).toBe('carry'); return f;
}

describe('Lectern Cantor authority', () => {
  it('does no damage during the full warning and waits six seconds after a beam before warning again', () => {
    const { sim, slot, p, c } = fixture(); sim.root(slot, 30); sim.commanders.update(slot);
    for (let i = 0; i < 74; i++) sim.step();
    expect(c.phase).toBe('tell'); expect(p.hp).toBe(120);
    sim.step(); expect(c.phase).toBe('active'); expect(p.hp).toBe(110);
    for (let i = 0; i < 90; i++) sim.step();
    expect(c.phase).toBe('recover'); expect(p.hp).toBe(30);
    for (let i = 0; i < 179; i++) sim.step();
    expect(c.phase).toBe('idle'); expect(p.hp).toBe(30);
    sim.step(); expect(c.phase).toBe('tell'); expect(c.endTick - c.phaseTick).toBe(75);
  });
  it('lets a player strafe out after the beam lands without tracking them for its full damage', () => {
    const { sim, slot, p, c } = fixture(); put(sim, p, 34.5, 10.5); sim.root(slot, 20); sim.commanders.update(slot);
    for (let i = 0; i < 75; i++) sim.step();
    expect(p.hp).toBe(110);
    const hitY = p.y;
    for (let i = 0; i < 89; i++) { put(sim, p, p.x, hitY + (i + 1) * 6 / 30); sim.step(); }
    expect(c.phase).toBe('active'); expect(p.hp).toBeGreaterThanOrEqual(90);
  });
  it('has the specified body and selects the farthest visible player with stable ties', () => {
    const { sim, slot, c } = fixture(CANTOR, 3);
    expect(ENEMIES[CANTOR]).toMatchObject({ hp: 1200, height: 3, speed: 2.5 });
    put(sim, sim.players[2], 23.5, 10.5); sim.commanders.update(slot);
    expect(c.targetId).toBe(1); expect(c.endTick - c.startTick).toBe(75);
    expect(validCommanderCasts(sim.commanders.checkpoint(), sim.tick)).toBe(true);
  });
  it('applies frontal reduction before bound, uses area centers, and never reduces world damage', () => {
    const { sim, slot, p, c } = fixture(); c.yaw = 0; c.phase = 'tell';
    sim.damageEnemy(slot, 100, p.index); expect(sim.eHp[slot]).toBe(1180);
    sim.root(slot, 20); sim.damageEnemy(slot, 100, p.index); expect(sim.eHp[slot]).toBe(1140);
    sim.damageEnemy(slot, 100, p.index, 100, c.x, c.y); expect(sim.eHp[slot]).toBe(940);
    sim.damageEnemy(slot, 100, p.index, 100, c.x + 10, c.y, true); expect(sim.eHp[slot]).toBe(740);
    put(sim, p, c.x - 2, c.y); sim.damageEnemy(slot, 100, p.index); expect(sim.eHp[slot]).toBe(540);
    expect(hymnalReduction(0, 1, Math.sqrt(3), false)).toBe(0.2);
    expect(hymnalReduction(0, 0, 2, false)).toBe(1);
  });
  it('fires nine pulses for 90 total damage, kills minions as world deaths and leaves commanders immune', () => {
    const { sim, slot, p, c } = fixture();
    const minion = sim.placeEnemy(BLESSED, 15, 10, 0), commander = sim.placeEnemy(DOMINION, 17, 10, 0);
    sim.root(minion, 20); sim.root(commander, 20); sim.dominions.readyAt[commander] = 9999;
    sim.commanders.update(slot); sim.root(slot, 20);
    for (let i = 0; i < CANTOR_TELL + CANTOR_BEAM; i++) sim.step();
    expect(p.hp).toBe(30); expect(sim.eAlive[minion]).toBe(0); expect(p.kills).toBe(0);
    expect(sim.eHp[commander]).toBe(1500); expect(c.phase).toBe('recover');
    expect(sim.commanders.readyAt[slot]).toBe(sim.tick + CANTOR_COOLDOWN);
  });
  it('uses the accepted attacker for a melee hit with a separate knockback origin', () => {
    const { sim, slot, p, c } = fixture(); c.yaw = 0; c.phase = 'tell';
    sim.damageEnemy(slot, 100, p.index, 100, c.x - 0.5, c.y, false, false);
    expect(sim.eHp[slot]).toBe(1180);
  });
  for (const control of ['silence', 'stun', 'removeEnemy'] as const) it(`${control} ends a tell/beam without a hidden pulse`, () => {
    const { sim, slot, c } = fixture(); sim.commanders.update(slot); advance(sim, slot, CANTOR_TELL);
    expect(c.phase).toBe('active'); sim[control](slot, 10 as never);
    expect(sim.commanders.active.get(slot)?.phase).not.toBe('active');
    expect(sim.commanders.readyAt[slot]).toBe(CANTOR_TELL + CANTOR_COOLDOWN);
  });
  it('root does not cancel singing, target loss cancels tell but preserves an active beam direction', () => {
    const a = fixture(); a.sim.commanders.update(a.slot); a.p.dead = true; advance(a.sim, a.slot, 1); expect(a.c.phase).toBe('recover');
    const b = fixture(); b.sim.commanders.update(b.slot); b.sim.root(b.slot, 10); advance(b.sim, b.slot, CANTOR_TELL);
    b.p.dead = true; const x = b.c.targetX; b.p.x += 10; advance(b.sim, b.slot, 1);
    expect(b.c.phase).toBe('active'); expect(b.c.targetX).toBe(x);
  });
  it('caps yaw, pitch and beam distance and clips the beam at cover', () => {
    const { sim, slot, p, c } = fixture(); sim.commanders.update(slot); advance(sim, slot, CANTOR_TELL);
    const yaw = c.yaw; put(sim, p, 10.5, 30.5); p.z = 50; advance(sim, slot, 1);
    expect(c.yaw - yaw).toBeCloseTo(CANTOR_BEAM_TURN_SPEED / 30); expect(c.pitch).toBeLessThanOrEqual(35 * Math.PI / 180);
    c.yaw = 0; c.pitch = 0; sim.map.top[10 * sim.map.w + 15] = 10;
    expect(beamSegment(sim.map, c).length).toBeCloseTo(3.9);
    expect(turnToward(Math.PI - 0.01, -Math.PI + 0.1, 0.02)).toBeCloseTo(-Math.PI + 0.01);
  });
});

describe('Stray-Carrier authority', () => {
  it('interrupts a rush at the rescue threshold, counted fresh for each rush', () => {
    const { sim, slot, p, c } = fixture(CARRIER); sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    const threshold = sim.eHp[slot] * 0.2;
    sim.damageEnemy(slot, 0, p.index); sim.damageEnemy(slot, threshold - 1, p.index); expect(c.phase).toBe('active');
    sim.damageEnemy(slot, 1, p.index); expect(c.phase).toBe('recover');
    expect(sim.commanders.readyAt[slot]).toBe(sim.tick + 240);
    advance(sim, slot, CARRIER_SWOOP); expect(sim.commanders.carriedBy(p.id)).toBeUndefined();
  });
  it('one shot no longer stops a rush, but the rescue threshold does', () => {
    const { sim, slot, p, c } = fixture(CARRIER); sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    aimAt(sim, p, slot); p.fire = 1; sim.step();
    expect(p.shots).toBe(1); expect(sim.eHp[slot]).toBe(940); expect(c.phase).not.toBe('recover');
    const { sim: other, slot: rusher, p: q, c: cast } = fixture(CARRIER); other.commanders.readyAt[rusher] = 0; other.commanders.update(rusher);
    other.damageEnemy(rusher, other.eHp[rusher] * 0.2, q.index); expect(cast.phase).toBe('recover');
    advance(other, rusher, CARRIER_SWOOP); expect(other.commanders.carriedBy(q.id)).toBeUndefined();
  });
  it('damage taken during a rush does not count toward the carry rescue that follows', () => {
    const { sim, slot, p, c } = fixture(CARRIER); sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    sim.damageEnemy(slot, sim.eHp[slot] * 0.2 - 1, p.index);
    for (let i = 0; i < CARRIER_SWOOP && c.phase === 'active'; i++) advance(sim, slot, 1);
    expect(c.phase).toBe('carry');
    sim.damageEnemy(slot, 1, p.index); expect(c.phase).toBe('carry');
  });
  for (const classId of ['fallen', 'heretic', 'binder', 'betrayer'] as const) it(`blocks attacks, abilities and items for a carried ${classId} without spending resources`, () => {
    const { sim, p, c } = grab(1, classId);
    p.inventory = [{ item: 'feather', count: 3 }, { item: 'seal', count: 2 }];
    p.fire = 3; p.pendingQ = p.pendingE = true; p.pendingItems = [true, true];
    sim.step();
    expect(c.phase).toBe('carry'); expect([p.shots, p.shots2, p.cdQ, p.cdE, p.itemReadyTick]).toEqual([0, 0, 0, 0, 0]);
    expect(p.pendingItems).toEqual([false, false]); expect(p.pendingQ || p.pendingE).toBe(false);
    expect(p.inventory).toEqual([{ item: 'feather', count: 3 }, { item: 'seal', count: 2 }]);
    expect(p.dash).toBeNull(); expect(p.landingTick).toBe(-1);
  });
  it('consumes carried press counters without replaying them on release, then accepts fresh presses', () => {
    const { sim, slot, p } = grab(); p.lastSeq = 0;
    p.inventory = [{ item: 'feather', count: 2 }, { item: 'seal', count: 2 }];
    const input = (seq: number, counter: number) => ({ ...INPUT_DEFAULTS, seq, x: p.x, y: p.y, z: p.z,
      yaw: 0, pitch: 0, fire: 0, qPresses: counter, ePresses: counter,
      item1Presses: counter, item2Presses: counter, allyTargetId: 255, lastTeleportId: p.teleportId });
    sim.applyInput(p.id, input(1, 1), 1000); sim.step();
    expect([p.qPresses, p.ePresses, ...p.itemPresses]).toEqual([1, 1, 1, 1]);
    sim.commanders.cancel(slot);
    sim.applyInput(p.id, input(2, 1), 1033); sim.step();
    expect([p.cdQ, p.cdE, p.itemReadyTick]).toEqual([0, 0, 0]); expect(p.inventory[0]?.count).toBe(2);
    sim.applyInput(p.id, input(3, 2), 1066); sim.step();
    expect(p.cdQ).toBeGreaterThan(0); expect(p.cdE).toBeGreaterThan(0);
    expect(p.itemReadyTick).toBeGreaterThan(sim.tick); expect(p.inventory[0]?.count).toBe(1);
    p.fire = 1; sim.step(); expect(p.shots).toBe(1);
  });
  it('cancels queued attacks and unfinished movement attacks at the instant of capture', () => {
    const { sim, slot, p, c } = fixture(CARRIER); sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    p.fire = 3; p.pendingQ = p.pendingE = true; p.pendingItems = [true, true]; p.landingTick = 100;
    p.dash = { pressSeq: 1, pts: [p.x, p.y, p.z], done: 1, acceptTick: -1, full: false, cut: new Set() };
    for (let i = 0; i < CARRIER_SWOOP && c.phase === 'active'; i++) advance(sim, slot, 1);
    expect(c.phase).toBe('carry'); expect(p.fire).toBe(0); expect(p.pendingQ || p.pendingE).toBe(false);
    expect(p.pendingItems).toEqual([false, false]); expect(p.dash).toBeNull(); expect(p.landingTick).toBe(-1);
  });
  it('rejects every consumable while grabbed even through direct use', () => {
    const { sim, p } = grab(); p.hp = 20;
    for (const item of ['balm', 'seal', 'feather', 'venom', 'frost', 'chain', 'mirror', 'plume'] as const) {
      p.inventory = [{ item, count: 2 }, null];
      expect(sim.items.use(p, item), item).toBe(false); sim.items.manual(p, 0);
      expect(p.inventory[0]?.count).toBe(2); expect(p.itemReadyTick).toBe(0);
    }
    expect(p.hp).toBe(20); expect(sim.items.effects).toHaveLength(0);
    expect(sim.events.some(e => e.event.type === 'itemUsed')).toBe(false);
  });
  it('rushes a visible player even beside a teammate and with no nearby crowd', () => {
    const { sim, slot, c } = fixture(CARRIER, 2); sim.commanders.readyAt[slot] = 0;
    sim.commanders.update(slot); expect(c.phase).toBe('active'); expect(c.targetId).toBe(0);
    advance(sim, slot, 30); expect(c.phase).toBe('carry');
    sim.removeEnemy(slot); expect(sim.commanders.diagnostics()).toEqual([]);
  });
  it('records Carrier decision reasons only for the dev overlay (audit E3)', () => {
    const quiet = fixture(CARRIER);
    quiet.sim.commanders.readyAt[quiet.slot] = 0;
    quiet.sim.commanders.update(quiet.slot);
    expect(quiet.c.phase).toBe('active');
    expect(quiet.sim.commanders.diagnostics()).toEqual([]);
    const dev = fixture(CARRIER, 1, 'betrayer', true);
    expect(dev.sim.commanders.diagnostics()).toEqual([expect.objectContaining({ slot: dev.slot, phase: 'idle', reason: 'initial delay' })]);
    dev.sim.commanders.readyAt[dev.slot] = 0;
    dev.sim.commanders.update(dev.slot);
    expect(dev.c.phase).toBe('active');
    expect(dev.sim.commanders.diagnostics()).toEqual([expect.objectContaining({ slot: dev.slot, phase: 'active', targetId: 0, reason: 'rushing' })]);
  });
  it('requires range and line of sight, and refuses unsafe drop footprints', () => {
    const { sim, slot, p, c } = fixture(CARRIER); sim.commanders.readyAt[slot] = 0;
    put(sim, p, 40.5, 10.5); sim.commanders.update(slot); expect(c.phase).toBe('idle');
    put(sim, p, 20.5, 10.5); crowd(sim);
    sim.map.solid[10 * sim.map.w + 15] = 1; sim.map.top[10 * sim.map.w + 15] = 20;
    sim.commanders.update(slot); expect(c.phase).toBe('idle');
    sim.map.hazard.fill(1); expect(sim.commanders.dropPoint(c, p)).toBeUndefined();
    expect(carryPathClear(sim.map, 0, 10, 10, 6, 20, 10, 6)).toBe(false);
  });
  it('deals 20 damage per second during carry, then stops when rescued', () => {
    const { sim, slot, p, c } = grab(); const hp = p.hp;
    advance(sim, slot, 14); expect(p.hp).toBe(hp);
    advance(sim, slot, 1); expect(p.hp).toBe(hp - 10);
    advance(sim, slot, 15); expect(p.hp).toBe(hp - 20);
    sim.commanders.cancel(slot); advance(sim, slot, 20);
    expect(c.phase).toBe('recover'); expect(p.hp).toBe(hp - 20);
  });
  it('keeps Fallen armor effective against the stronger carry damage', () => {
    const { sim, slot, p } = grab(); p.classId = 'fallen'; const hp = p.hp;
    advance(sim, slot, 30); expect(p.hp).toBeCloseTo(hp - 12);
  });
  it('releases a victim killed by carry damage without waiting for the minimum hold', () => {
    const { sim, slot, p, c } = grab(); p.hp = 9;
    advance(sim, slot, 15);
    expect(p.dead).toBe(true); expect(c.phase).toBe('recover'); expect(sim.commanders.carriedBy(p.id)).toBeUndefined();
  });
  it('closed-book recovery exposes the Cantor to full frontal damage', () => {
    const { sim, slot, p, c } = fixture(); c.yaw = 0; c.phase = 'active';
    sim.damageEnemy(slot, 100, p.index); expect(sim.eHp[slot]).toBe(1180);
    c.phase = 'recover'; sim.damageEnemy(slot, 100, p.index); expect(sim.eHp[slot]).toBe(1080);
  });
  it('waits three seconds initially and shoots ordinary arrows between marks', () => {
    const { sim, slot, c } = fixture(CARRIER); crowd(sim);
    expect(sim.commanders.readyAt[slot]).toBe(90);
    for (let i = 0; i < 32; i++) sim.step();
    expect(c.phase).toBe('idle'); expect(sim.projectiles.length).toBeGreaterThan(0);
  });
  it('approaches from arrow range into carry range instead of strafing forever in solo', () => {
    const { sim, slot, p, c } = fixture(CARRIER);
    put(sim, p, 35.5, 10.5); crowd(sim, 38, 9, 20); sim.refreshFields();
    let marked = false;
    // Stay alive without invulnerability, so this exercises a real eligible grab.
    p.hp = p.maxHp = 10000;
    for (let i = 0; i < 300; i++) {
      sim.step();
      if (c.phase === 'active') marked = true;
      if (c.phase === 'carry') {
        expect(marked).toBe(true); expect(sim.eX[slot]).toBeGreaterThan(15); return;
      }
    }
    throw new Error('Carrier stayed at arrow range instead of grabbing the solo target');
  });
  it('rushes without a mark and misses a sidestep without dealing grab damage', () => {
    const { sim, slot, p, c } = fixture(CARRIER); crowd(sim); sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    advance(sim, slot, CARRIER_TRACK_TICKS); const x = c.targetX; p.y += 4;
    advance(sim, slot, CARRIER_SWOOP - CARRIER_TRACK_TICKS); expect(c.targetX).toBe(x); expect(c.phase).toBe('recover'); expect(p.hp).toBe(120);
    expect(sim.eX[slot]).toBeGreaterThanOrEqual(x + Math.cos(c.yaw) * CARRIER_FLY_THROUGH);
    expect(sim.eZ[slot]).toBeGreaterThanOrEqual(6);
    expect(sim.commanders.readyAt[slot]).toBe(sim.tick + 240);
  });
  it('grabs a modest sidestep while passing the player, before the flight ends', () => {
    const { sim, slot, p, c } = fixture(CARRIER); sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    p.y += 2;
    for (let i = 0; i < CARRIER_SWOOP && c.phase === 'active'; i++) advance(sim, slot, 1);
    expect(c.phase).toBe('carry'); expect(sim.tick).toBeLessThan(CARRIER_SWOOP);
    expect(p.hp).toBe(120);
  });
  it('grabs a player who crosses the flight before its old endpoint check', () => {
    const { sim, slot, p, c } = fixture(CARRIER); sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    put(sim, p, 15, 10);
    advance(sim, slot, 10);
    expect(c.phase).toBe('carry'); expect(sim.tick).toBeLessThan(CARRIER_SWOOP);
  });
  it('dives past an invulnerable player and curves back up to flight height through full simulation ticks', () => {
    const { sim, slot, p, c } = fixture(CARRIER); p.invulUntil = 9999;
    sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    const startZ = sim.eZ[slot], heights: number[] = [];
    for (let i = 0; i < CARRIER_SWOOP; i++) { sim.step(); heights.push(sim.eZ[slot]); }
    const low = Math.min(...heights), bottom = heights.indexOf(low);
    expect(low).toBeLessThan(startZ - 1); expect(low).toBeGreaterThanOrEqual(2);
    expect(bottom).toBeGreaterThan(0); expect(bottom).toBeLessThan(heights.length - 1);
    expect(heights.at(-1)).toBeGreaterThanOrEqual(6);
    expect(c.phase).toBe('recover'); expect(sim.eX[slot]).toBeGreaterThan(p.x + 11); expect(p.hp).toBe(120);
    for (let i = 0; i < 10; i++) sim.step();
    expect(sim.eZ[slot]).toBeGreaterThanOrEqual(6);
  });
  it('stops a missed flight before a newly closed wall', () => {
    const { sim, slot, p, c } = fixture(CARRIER); sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    advance(sim, slot, CARRIER_TRACK_TICKS); p.y += 4;
    for (let y = 1; y < 32; y++) sim.map.solid[y * sim.map.w + 23] = 1;
    advance(sim, slot, CARRIER_SWOOP - CARRIER_TRACK_TICKS);
    expect(c.phase).toBe('recover'); expect(sim.eX[slot]).toBeLessThanOrEqual(22);
    const x = sim.eX[slot]; advance(sim, slot, 30);
    expect(sim.eX[slot]).toBe(x); expect(sim.eZ[slot]).toBeGreaterThanOrEqual(6);
    expect(p.hp).toBe(120);
  });
  for (const distance of [3, 10, 19]) for (const speed of [6, 9, 11]) it(`catches straight retreat at ${speed} m/s from ${distance} m during full ticks`, () => {
    const { sim, slot, p, c } = fixture(CARRIER); put(sim, p, 10 + distance, 10);
    sim.refreshFields(); sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    for (let i = 0; i < CARRIER_SWOOP && c.phase === 'active'; i++) { p.x += speed / 30; sim.step(); }
    expect(c.phase).toBe('carry'); expect(p.dead).toBe(false);
  });
  for (const party of [1, 2]) it(`holds above a nearby horde for three seconds with periodic damage (party ${party})`, () => {
    const { sim, slot, p, c } = fixture(CARRIER, party); crowd(sim, p.x, p.y);
    sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    for (let i = 0; i < CARRIER_SWOOP && c.phase === 'active'; i++) advance(sim, slot, 1);
    expect(c.phase).toBe('carry'); const hp = p.hp, id = p.teleportId;
    advance(sim, slot, CARRIER_MIN_HOLD - 1);
    expect(c.phase).toBe('carry'); expect(p.z).toBeCloseTo(6);
    expect(Math.hypot(p.x - c.dropX, p.y - c.dropY)).toBeLessThan(0.5);
    expect(p.hp).toBe(hp - 50); expect(p.teleportId).toBe(id);
    advance(sim, slot, 1);
    expect(c.phase).toBe('recover'); expect(p.hp).toBe(hp - 60); expect(p.teleportId).toBe(id + 1);
  });
  it('owns the carried body and ignores movement and fire input while retaining aim', () => {
    const { sim, slot, p } = grab(); advance(sim, slot, 15); expect(p.z).toBeCloseTo(6);
    const pos = [p.x, p.y, p.z]; sim.applyInput(p.id, { ...INPUT_DEFAULTS, seq: 1, x: 40, y: 30, z: 99, yaw: 1, pitch: 0.2, fire: 1, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: p.teleportId }, 1000);
    expect([p.x, p.y, p.z]).toEqual(pos); expect(p.fire).toBe(0); expect(p.yaw).toBe(1);
    const before = p.x; advance(sim, slot, 1); expect(p.x - before).toBeLessThanOrEqual(6 / 30 + 1e-6);
  });
  it('climbs to six metres above ground when it grabs a jumping victim', () => {
    const { sim, slot, p, c } = fixture(CARRIER); p.z = 1; crowd(sim);
    sim.commanders.readyAt[slot] = 0; sim.commanders.update(slot);
    advance(sim, slot, 30); expect(c.phase).toBe('carry');
    advance(sim, slot, 15); expect(p.z).toBeCloseTo(6);
  });
  it('releases after accepted rescue damage, once, using a newer acknowledged correction', () => {
    const { sim, slot, p, c } = grab(2); const id = p.teleportId;
    sim.damageEnemy(slot, 199, 1); expect(c.phase).toBe('carry');
    sim.damageEnemy(slot, 1, 1); expect(c.phase).toBe('recover'); expect(p.teleportId).toBe(id + 1);
    sim.commanders.cancel(slot); expect(p.teleportId).toBe(id + 1);
    const before = p.x; sim.applyInput(p.id, { ...INPUT_DEFAULTS, seq: 2, x: 0, y: 0, z: 0, yaw: 0, pitch: 0, fire: 0, qPresses: 0, ePresses: 0, allyTargetId: 255, lastTeleportId: id }, 2000); expect(p.x).toBe(before);
  });
  for (const control of ['root', 'silence', 'stun', 'pull', 'removeEnemy'] as const) it(`${control} releases in place`, () => {
    const { sim, slot, p } = grab(); const pos = [p.x, p.y, p.z];
    if (control === 'pull') sim.pull(slot, 12, 12, 0); else if (control === 'removeEnemy') sim.removeEnemy(slot); else sim[control](slot, 5);
    expect(sim.commanders.carriedBy(p.id)).toBeUndefined(); expect([p.x, p.y, p.z]).toEqual(pos);
  });
  it('releases on disconnect, invulnerability, target death and authoritative teleport', () => {
    for (const reason of ['disconnect', 'invulnerable', 'death', 'teleport']) {
      const { sim, slot, p } = grab();
      if (reason === 'disconnect') p.connected = false;
      else if (reason === 'invulnerable') p.invulUntil = 9999;
      else if (reason === 'death') p.dead = true;
      else if (reason === 'teleport') sim.teleport(p, 5, 5, 0);
      advance(sim, slot, 1); expect(sim.commanders.carriedBy(p.id), reason).toBeUndefined();
    }
  });
  it('ends at the solo time limit and refuses a newly obstructed path', () => {
    const a = grab(); advance(a.sim, a.slot, CARRIER_MIN_HOLD); expect(a.c.phase).toBe('recover');
    const b = grab(); b.sim.map.solid[Math.floor(b.p.y) * b.sim.map.w + Math.floor(b.p.x)] = 1; advance(b.sim, b.slot, 1); expect(b.c.phase).toBe('recover');
  });
  it('round-trips host records and carry corrections through complete snapshots', () => {
    const { sim, slot, p } = grab(); advance(sim, slot, 12);
    const assembler = new SnapshotAssembler(); assembler.reset(sim.runId);
    let complete = null;
    for (const buffer of sim.encodeFor(p.id)) { const part = decodeSnapshot(buffer, sim.runId); expect(part).not.toBeNull(); complete = assembler.add(part!); }
    expect(complete?.commanderCasts?.[0]).toMatchObject({ kind: 'carry', phase: 'carry', targetId: p.id });
    expect(complete?.players[0]).toMatchObject({ carrySlot: slot, teleportId: p.teleportId, z: expect.closeTo(p.z, 4) });
  });
  it('keeps family types distinct while excess family placement becomes a Dominion', () => {
    const { sim } = fixture(); const second = sim.placeEnemy(CANTOR, 14, 15, 0), carrier = sim.placeEnemy(CARRIER, 16, 15, 0);
    expect(sim.eType[second]).toBe(DOMINION); expect(sim.eType[carrier]).toBe(CARRIER);
    for (const type of [CHORISTER, CHERUB]) expect(ENEMIES[type].hp).toBeLessThan(ENEMIES[CARRIER].hp);
  });
});

describe('family wave placement', () => {
  for (const family of ['cantor', 'carrier'] as const) for (const party of [1, 4]) it(`${family} at party ${party} shares scaling, commander caps and the retained queue`, () => {
    const dungeon = arenaDungeon([{ blessed: 12, choristers: 0, cherubs: 0, dominions: 4, commander: family }]);
    dungeon.rooms[0].shape = '1x1'; dungeon.rooms[0].band = 1;
    const sim = new Simulation({ dungeon, players: Array.from({ length: party }, (_, id) => ({ id, name: `P${id}`, classId: 'fallen' as const })), seed: 1, god: true });
    sealAt(sim); for (let i = 0; i < 310; i++) sim.step();
    const type = family === 'cantor' ? CANTOR : CARRIER;
    const masters = Array.from(sim.active.subarray(0, sim.activeCount)).filter((s) => sim.eType[s] === type);
    expect(masters).toHaveLength(1);
    expect(sim.eHp[masters[0]]).toBe(ENEMIES[type].hp * (party === 1 ? 0.8 : 1));
    const elites = () => Array.from(sim.active.subarray(0, sim.activeCount)).filter((s) => sim.eType[s] === type || sim.eType[s] === DOMINION);
    expect(elites()).toHaveLength(2);
    expect(sim.rooms[0].queue.length).toBe(party === 4 ? 1 : 0);
    if (party === 4) {
      for (const slot of elites()) sim.removeEnemy(slot);
      for (let i = 0; i < 100; i++) sim.step();
      expect(elites()).toHaveLength(2); expect(elites().every((s) => sim.eType[s] === DOMINION)).toBe(true);
      expect(sim.rooms[0].queue).toHaveLength(0);
    }
  });
});

// Full ticks exercise ordinary flight, authored walls, crowd separation, and the carry state machine together.
it.each([[14.5, 9.5], [17.5, 28.5], [5.5, 20.5], [28.5, 20.5], [17.5, 34.5], [10.5, 15.5], [24.5, 15.5]])(
  'a native Carrier grabs a normal-health solo player at %s,%s after the crowd gathers', (x, y) => {
    const sim = new Simulation({ dungeon: DUNGEONS.carrier, seed: newRunIdentity(7).simSeed, players: [{ id: 0, classId: 'fallen', name: 'P' }] });
    const p = sim.players[0];
    put(sim, p, 14.5, 9.5); sim.refreshFields(); sim.step();
    put(sim, p, x, y); sim.refreshFields();
    let swooped = false;
    for (let i = 0; i < 600; i++) {
      sim.step();
      const c = [...sim.commanders.active.values()][0];
      if (c?.phase === 'active') swooped = true;
      if (c?.phase === 'carry') { expect(swooped).toBe(true); expect(p.dead).toBe(false); return; }
    }
    throw new Error('Carrier did not grab after the native crowd gathered');
  },
);
