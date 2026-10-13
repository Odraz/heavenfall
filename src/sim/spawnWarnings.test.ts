import { expect, it } from 'vitest';
import { SpawnWarnings } from './spawnWarnings';
import { Simulation } from './sim';
import { arenaDungeon, sealAt } from './testutil/arenas';
import { CHORISTER, BLESSED, DOMINION } from '../data/enemies';
import type { PropDef } from '../data/props';
import type { SpawnWarning } from '../data/spawns';
import { PHASE_CLEARED } from '../net/protocol';

it('permits only after 30 ticks, cancels unsafe/stale points and uses a new identity on retry', () => {
  const events: Array<{ phase: string; w: SpawnWarning }> = [];
  const warnings = new SpawnWarnings((phase, w) => events.push({ phase, w }));
  expect(warnings.permit(0, 10.5, 5.5, 0, 100)).toBe(false);
  expect(warnings.permit(0, 10.5, 5.5, 0, 129)).toBe(false);
  expect(warnings.permit(0, 10.5, 5.5, 0, 130)).toBe(true);
  expect(events).toHaveLength(1); const checkpoint = warnings.checkpoint(120); checkpoint[0].x = 99;
  expect(warnings.checkpoint(120)[0].x).toBe(10.5);
  warnings.update(131, 0, () => false); expect(events[1].phase).toBe('cancel');
  expect(warnings.permit(0, 10.5, 5.5, 0, 132)).toBe(false); expect(events[2].w.id).toBe(2);
  warnings.update(163, 0, () => true); expect(warnings.checkpoint(140)).toEqual([]);
});
it('bounds checkpoint/identity capacity and cleans warnings on a room change', () => {
  const w = new SpawnWarnings(() => {});
  for (let i = 0; i < 70; i++) w.permit(0, i, 5, 0, 1);
  expect(w.checkpoint(1)).toHaveLength(64); expect(w.exhausted).toBe(6);
  w.update(2, 1, () => true); expect(w.checkpoint(2)).toEqual([]);
  (w as unknown as { nextId: number }).nextId = 0x100000000;
  expect(w.permit(1, 1, 1, 0, 2)).toBe(false);
});
it('places a pending squad through the same blocked-marker floor warning after its ordinary batch has gone', () => {
  const dungeon = arenaDungeon([{ blessed: 20, choristers: 0, cherubs: 0, squad: { type: 'choristers', count: 2, at: [[8, 5]] } }]);
  const sim = new Simulation({ dungeon, players: [{ id: 0, name: 'P', classId: 'binder' }], god: true, seed: 1 });
  sim.map.roomSpawnPoints[0] = [[8, 5]]; sealAt(sim, 8.5, 5.5); const seal = sim.tick;
  while (sim.tick < seal + 145) { sim.step(); sim.killAll(); }
  expect(sim.rooms[0].queue).toHaveLength(0); expect(sim.rooms[0].squad).not.toBeNull();
  while (sim.tick < seal + 241) sim.step();
  expect(sim.activeCount).toBe(1); expect(sim.eType[sim.active[0]]).toBe(CHORISTER);
  expect(sim.rooms[0].squad).toBeNull(); expect(sim.rooms[0].waveFullySpawned[0]).toBe(true);
});
function fixture(props: PropDef[] = []) {
  const dungeon = arenaDungeon([{ blessed: 20, choristers: 10, cherubs: 0 }]);
  const sim = new Simulation({ dungeon, players: [{ id: 0, name: 'P', classId: 'binder' }], props, god: true, seed: 1 });
  sim.map.roomSpawnPoints[0] = [[12, 5]];
  return sim;
}
it('warns close markers for every enemy type and cancels when the player enters the three-metre body clearance', () => {
  const sim = fixture(); sealAt(sim, 8.5, 5.5);
  while (!sim.floorSync('run').spawnWarnings?.length && sim.tick < 10) sim.step(); const start = sim.tick;
  expect(sim.activeCount).toBe(0); expect(sim.floorSync('run').spawnWarnings).toHaveLength(1);
  for (let i = 0; i < 29; i++) sim.step(); expect(sim.activeCount).toBe(0);
  sim.players[0].x = 11.5; sim.step();
  expect(sim.activeCount).toBe(0); expect(sim.floorSync('run').spawnWarnings?.every((w) => w.x !== 12.5)).toBe(true);
  sim.players[0].x = 8.5;
  for (let i = 0; i < 40; i++) sim.step();
  expect(sim.activeCount).toBeGreaterThan(0);
  expect([...sim.active.slice(0, sim.activeCount)].some((s) => sim.eType[s] === CHORISTER)).toBe(true);
  expect(sim.tick).toBeGreaterThan(start + 30);
});
it('excludes intact props, reward cells, threshold strips and hazard cells from fallback candidates', () => {
  const sim = fixture([{ id: 1, room: 0, family: 'loot', variant: 0, marked: false, x: 32.5, y: 10.5 }]);
  sim.map.roomSpawnPoints[0] = [[8, 5]]; sim.map.hazard[sim.map.w + 32] = 1;
  sim.map.rooms[0].points = { reward: [32, 9] };
  sealAt(sim, 8.5, 5.5); const seal = sim.tick;
  while (!sim.floorSync('run').spawnWarnings?.length && sim.tick < seal + 80) sim.step();
  const w = sim.floorSync('run').spawnWarnings![0]; expect(w).toBeDefined();
  expect(sim.map.hazard[Math.floor(w.y) * sim.map.w + Math.floor(w.x)]).toBe(0);
  expect(sim.props.blocksSpawn(0, w.x, w.y, w.z, 0.45, 3.2)).toBe(false);
  expect(Math.abs(w.x - 32.5) > 1 || Math.abs(w.y - 9.5) > 1).toBe(true);
});
it('revalidates every living teammate before arrival and never starts a Dominion tell on its placement tick', () => {
  const sim = fixture(); sealAt(sim, 8.5, 5.5);
  while (!sim.floorSync('run').spawnWarnings?.length && sim.tick < 10) sim.step();
  const w = sim.floorSync('run').spawnWarnings![0];
  const late = sim.addPlayer({ id: 1, name: 'Late', classId: 'fallen' })!;
  late.dead = false; late.hp = late.maxHp; late.x = w.x; late.y = w.y; late.z = w.z; sim.step();
  expect(sim.floorSync('run').spawnWarnings?.some((q) => q.id === w.id)).toBe(false); expect(sim.activeCount).toBe(0);
  const s = sim.placeEnemy(DOMINION, Math.floor(sim.players[0].x), Math.floor(sim.players[0].y), 0);
  (sim as unknown as { updateEnemies: () => void }).updateEnemies(); expect(sim.dominions.active.has(s)).toBe(false);
  sim.step(); expect(sim.dominions.active.get(s)?.startTick).toBe(sim.tick);
});
it('uses warned reachable room floor when all markers are unsafe, never a prop body or another room', () => {
  const sim = fixture(); sim.map.roomSpawnPoints[0] = [[8, 5]]; sealAt(sim, 8.5, 5.5);
  const sealed = sim.tick;
  while (!sim.floorSync('run').spawnWarnings?.length && sim.tick < sealed + 80) { expect(sim.activeCount).toBe(0); sim.step(); }
  expect(sim.tick - sealed).toBeGreaterThanOrEqual(60);
  const warnings = sim.floorSync('run').spawnWarnings!; expect(warnings).toHaveLength(1);
  const w = warnings[0]; expect(sim.map.roomOf[Math.floor(w.y) * sim.map.w + Math.floor(w.x)]).toBe(0);
  expect(Math.hypot(w.x - 8.5, w.y - 5.5)).toBeGreaterThan(3);
  for (let i = 0; i < 30; i++) sim.step(); expect(sim.activeCount).toBeGreaterThan(0);
  expect([...sim.active.slice(0, sim.activeCount)].some((s) => sim.eType[s] === BLESSED)).toBe(true);
  sim.rooms[0].phase = PHASE_CLEARED; sim.step(); expect(sim.floorSync('run').spawnWarnings).toEqual([]);
});
