import { XP_GAIN } from './rewards';
import { describe, expect, it } from 'vitest';
import { VictoryExit } from './victory';
import { generateFloor } from '../gen';
import { PINNED } from '../gen/pinned';
import { PEARLY_POOL } from '../data/rooms/1';
import { Simulation } from './sim';
import { openBossGate, sealNow } from './testutil/sims';
import { stairPoints } from './shop';
import { PHASE_CLEARED, PHASE_IDLE } from '../net/protocol';
import { createProfile } from '../profile/model';
import { RunRecords } from '../net/runRecords';
import { applyProgress, stakeProfile } from '../profile/lifecycle';

const human = (x = 0, bot = false) => ({ x, y: 0, z: 0, connected: true, dead: false, bot });
describe('bounded victory exit', () => {
  it('requires three continuous seconds from all humans; bots and disconnected records do not block', () => {
    const e = new VictoryExit(0, 5000, { x: 0, y: 0, z: 0 }), a = human(), b = human(10);
    expect(e.update(0, [a, b, human(20, true)], false)).toBe(false);
    e.update(20, [a, { ...b, connected: false }], false);
    expect(e.update(109, [a], false)).toBe(false); expect(e.update(110, [a], false)).toBe(true);
    expect(e.state.clearTimeMs).toBe(5000);
  });
  it('uses first-entry 30 seconds even after leaving the beam', () => {
    const e = new VictoryExit(0, 1, { x: 0, y: 0, z: 0 }); e.update(10, [human(), human(20)], false);
    expect(e.update(909, [human(20)], false)).toBe(false); expect(e.update(910, [human(20)], false)).toBe(true);
  });
  it('holds an earned choice for at most sixty total seconds and reports it at exit', () => {
    const e = new VictoryExit(0, 1, { x: 0, y: 0, z: 0 }); e.update(0, [human()], true);
    for (let tick = 90; tick < 1890; tick++) expect(e.update(tick, [human()], true)).toBe(false);
    expect(e.state.holdTicks).toBe(1800); expect(e.update(1890, [human()], true)).toBe(true); expect(e.unclaimed).toBe(true);
  });
  it('closes at the hard 120-second deadline without entry, regardless of pending choices', () => {
    const e = new VictoryExit(0, 1, { x: 0, y: 0, z: 0 });
    expect(e.update(3599, [human(20)], true)).toBe(false); expect(e.update(3600, [human(20)], true)).toBe(true); expect(e.unclaimed).toBe(true);
  });
});

function bossFixture() {
  const g = generateFloor(PINNED.seed, 1, 1, PEARLY_POOL);
  const profiles = [0, 1, 2, 3].map(i => createProfile(`P${i}`, String(i + 1).repeat(32), 1));
  const classes = ['fallen', 'heretic', 'binder', 'betrayer'] as const;
  const sim = new Simulation({ dungeon: g.def, floor: g.floor, seed: 1, startRoom: g.floor.boss, progressionEnabled: true,
    players: profiles.map((profile, id) => ({ id, name: profile.name, classId: classes[id], profile })) });
  sim.step(); sealNow(sim, g.floor.boss); expect(sim.bossSlot).toBeGreaterThanOrEqual(0); return { sim, g, profiles, classes };
}
it('latches victory once, resolves living/soul groups, preserves skipped fights, and makes post-win damage harmless', () => {
  const { sim, g } = bossFixture(); const [living, soul, absentSoul, absentLiving] = sim.players;
  living.hp = 100; soul.dead = true; soul.hp = 0; absentSoul.dead = true; absentSoul.hp = 0; absentLiving.hp = 17;
  sim.removePlayer(2, true); sim.removePlayer(3, true);
  const skipped = g.floor.rooms.findIndex(r => r.kind === 'combat'); sim.rooms[skipped].phase = PHASE_IDLE;
  openBossGate(sim); sim.damageEnemy(sim.bossSlot, 100000, living.index); sim.step();
  expect(sim.won).toBe(true); expect(sim.result).toBeNull(); expect(sim.admissionClosed).toBe(true);
  expect(living.hp).toBe(220); expect(soul.hp).toBe(75); expect(absentSoul.hp).toBe(120); expect(absentLiving.hp).toBe(17);
  expect([living.runXp, soul.runXp, absentSoul.runXp, absentLiving.runXp]).toEqual([1500 * XP_GAIN, 1500 * XP_GAIN, 0, 0]);
  sim.damagePlayer(living, 100000); expect(living.hp).toBe(220);
  const [x, y] = g.def.rooms[skipped].entry[0].cells[0]; Object.assign(living, { x: x + .5, y: y + .5, z: sim.map.floor[y * sim.map.w + x] });
  sim.step(); expect(sim.rooms[skipped].phase).toBe(PHASE_IDLE); expect(sim.rooms[g.floor.boss].phase).toBe(PHASE_CLEARED);
  expect(sim.activeCount).toBe(0); expect(living.runXp).toBe(1500 * XP_GAIN);
  const resumed = sim.addPlayer({ id: 2, name: 'Resume', classId: 'binder' })!; expect(resumed.dead).toBe(false); expect(resumed.hp).toBe(120);
});

it('secures disconnected inventory and accepts a post-win purchase revision without another clear or XP award', () => {
  const { sim, g, profiles, classes } = bossFixture(), records = new RunRecords(sim.runId, true);
  let saved = profiles.map((profile, id) => stakeProfile(profile, records.reserve(id, classes[id], profile, true)));
  for (const r of records.records.values()) records.commit(r);
  sim.players[0].inventory = [null, { item: 'balm', count: 2 }]; sim.players[0].wallet = 500;
  sim.players[1].inventory[0] = { item: 'seal', count: 1 }; sim.removePlayer(1, true);
  openBossGate(sim); sim.damageEnemy(sim.bossSlot, 100000, 0); sim.step();
  for (const r of records.records.values()) {
    const p = sim.playerById(r.playerId) ?? sim.retainedPlayers.get(r.playerId)!.player;
    r.inventory = structuredClone(p.inventory); r.runXp = p.runXp;
    saved[r.playerId] = applyProgress(saved[r.playerId], records.settle(r, 'victory'))!;
  }
  expect(saved[1].inventory[0]).toEqual({ item: 'seal', count: 1 }); expect(saved[1].characters.heretic.xp).toBe(0); expect(saved[1].stats.wins).toBe(1);
  const p = sim.players[0], at = stairPoints(sim.map, g.floor.boss)[1];
  Object.assign(p, { x: at.x, y: at.y + 1, z: at.z, yaw: -Math.PI / 2, pitch: Math.atan2(-.6, 1) });
  const before = p.wallet; sim.interact(0, 1, 5); expect(p.wallet).toBeLessThan(before); const wallet = p.wallet; sim.interact(0, 1, 5); expect(p.wallet).toBe(wallet);
  const r = records.byPlayer(0)!; r.inventory = structuredClone(p.inventory); const revision = records.state(r);
  saved[0] = applyProgress(saved[0], revision)!; expect(applyProgress(saved[0], revision)).toBeNull();
  expect(saved[0].stats.wins).toBe(1); expect(saved[0].heavens.clears[1]).toBe(1); expect(saved[0].characters.fallen.xp).toBe(1500 * XP_GAIN);
  expect(saved[0].inventory).toEqual(p.inventory); expect(saved[0].run).toBeNull();
});
