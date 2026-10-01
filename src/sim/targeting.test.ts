import { describe, expect, it } from 'vitest';
import type { ClassId } from '../data/classes';
import { BLESSED, CHERUB } from '../data/enemies';
import { Simulation } from './sim';
import { dungeonOf } from './testutil/maps';

// An open room, 20 × 5 cells of floor.
const ROOM = ['######################', ...Array(5).fill('#' + '0'.repeat(20) + '#'), '######################'];

function simWith(classes: ClassId[], positions: Array<[number, number]>): Simulation {
  const sim = new Simulation({
    dungeon: dungeonOf(ROOM),
    players: classes.map((classId, id) => ({ id, name: `P${id}`, classId })),
    seed: 1,
  });
  sim.players.forEach((p, i) => {
    p.x = positions[i][0] + 0.5;
    p.y = positions[i][1] + 0.5;
  });
  sim.refreshFields();
  return sim;
}

describe('targeting', () => {
  it('the lowest flow-field distance wins', () => {
    const sim = simWith(['heretic', 'binder'], [[15, 3], [5, 3]]);
    const slot = sim.placeEnemy(BLESSED, 8, 3, -1);
    expect(sim.eTarget[slot]).toBe(1);
    const slot2 = sim.placeEnemy(BLESSED, 13, 3, -1);
    expect(sim.eTarget[slot2]).toBe(0);
  });

  it('Cherubs use the air field', () => {
    const sim = simWith(['heretic', 'binder'], [[15, 3], [5, 3]]);
    const slot = sim.placeEnemy(CHERUB, 12, 3, -1);
    expect(sim.eTarget[slot]).toBe(0);
  });

  it("Sinful halves the Fallen's distance", () => {
    // Enemy at x = 8: the Fallen is 10 cells away (counts as 5), the Binder 6 cells away.
    const sim = simWith(['fallen', 'binder'], [[18, 3], [2, 3]]);
    const slot = sim.placeEnemy(BLESSED, 8, 3, -1);
    expect(sim.eTarget[slot]).toBe(0);
    // Without Sinful, the Heretic Saint at the same spot loses.
    const sim2 = simWith(['heretic', 'binder'], [[18, 3], [2, 3]]);
    expect(sim2.eTarget[sim2.placeEnemy(BLESSED, 8, 3, -1)]).toBe(1);
  });

  it('retargets immediately when the target dies', () => {
    const sim = simWith(['heretic', 'binder'], [[15, 3], [5, 3]]);
    const slot = sim.placeEnemy(BLESSED, 8, 3, -1);
    expect(sim.eTarget[slot]).toBe(1);
    // Pick a tick where the staggered 1 s re-evaluation isn't due for this slot.
    while ((sim.tick + 1) % 30 === slot % 30) sim.step();
    sim.players[1].dead = true;
    sim.step();
    expect(sim.eTarget[slot]).toBe(0);
  });

  it('re-evaluates every 1 s, staggered by slot', () => {
    // Player 0 stands within 1 m of the enemy, so the enemy doesn't move.
    const sim = simWith(['heretic', 'binder'], [[10, 2], [1, 5]]);
    sim.players[0].y = 2.3;
    sim.refreshFields();
    const slot = sim.placeEnemy(BLESSED, 10, 1, -1);
    expect(sim.eTarget[slot]).toBe(0);
    // Player 1 walks into the enemy's own cell; the target changes only on the slot's tick.
    sim.players[1].x = 10.2;
    sim.players[1].y = 1.5;
    let changedAt = -1;
    for (let i = 0; i < 70 && changedAt < 0; i++) {
      sim.step();
      if (sim.eTarget[slot] !== 0) changedAt = sim.tick;
    }
    expect(sim.eTarget[slot]).toBe(1);
    expect(changedAt % 30).toBe(slot % 30);
  });

  it('an enemy with no reachable player stands still', () => {
    const map = ['#########', '#000#000#', '#000#000#', '#########'];
    const sim = new Simulation({
      dungeon: dungeonOf(map, { markers: ['.........', '.SS......', '.SS......', '.........'] }),
      players: [{ id: 0, name: 'A', classId: 'fallen' }],
      seed: 1,
    });
    sim.refreshFields();
    const slot = sim.placeEnemy(BLESSED, 6, 1, -1);
    expect(sim.eTarget[slot]).toBe(-1);
    sim.step();
    expect(sim.eX[slot]).toBe(6.5);
    expect(sim.eY[slot]).toBe(1.5);
  });
});
