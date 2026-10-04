import { describe, expect, it } from 'vitest';
import { BLESSED } from '../data/enemies';
import { decodeSnapshot } from '../net/protocol';
import { enemyAt, makeSim, put, room } from './testutil/sims';
import { Simulation } from './sim';
import { dungeonOf } from './testutil/maps';

describe('disconnects', () => {
  it('removes a player who leaves: enemies retarget at once and snapshots drop the player', () => {
    const sim = makeSim(room(20, 5), ['fallen', 'heretic']);
    const [a, b] = sim.players;
    put(sim, a, 2.5, 2.5);
    put(sim, b, 17.5, 2.5);
    // Next to the Heretic, far from the Fallen even with Sinful.
    const slot = enemyAt(sim, BLESSED, 16.5, 2.5);
    expect(sim.eTarget[slot]).toBe(b.index);
    sim.disconnect(b.id);
    sim.step();
    expect(sim.eTarget[slot]).toBe(a.index);
    const snap = decodeSnapshot(sim.encodeFor(a.id)[0])!;
    expect(snap.players.map((p) => p.id)).toEqual([a.id]);
    expect(sim.result).toBeNull();
  });

  it('is a defeat when every player still connected is dead', () => {
    const sim = makeSim(room(10, 5), ['fallen', 'heretic']);
    const [a, b] = sim.players;
    sim.damagePlayer(a, 10000);
    sim.step();
    expect(sim.result).toBeNull();
    sim.disconnect(b.id);
    expect(sim.result).toBe('defeat');
    // gameOver lists the players still connected.
    const over = sim.events.find((e) => e.event.type === 'gameOver')!.event;
    expect(over.type === 'gameOver' && Object.keys(over.kills)).toEqual(['0']);
  });

  it('keeps the index of a player dropped during Loading, and leaves it out of the party size', () => {
    const sim = new Simulation({
      dungeon: dungeonOf(room(10, 5)),
      players: [
        { id: 0, name: 'A', classId: 'fallen' },
        { id: 1, name: 'B', classId: 'heretic', connected: false },
        { id: 2, name: 'C', classId: 'binder' },
      ],
      seed: 1,
    });
    expect(sim.partySize).toBe(2);
    expect(sim.players.map((p) => [p.id, p.index, p.connected])).toEqual([
      [0, 0, true],
      [1, 1, false],
      [2, 2, true],
    ]);
    const snap = decodeSnapshot(sim.encodeFor(0)[0])!;
    expect(snap.players.map((p) => p.id)).toEqual([0, 2]);
  });
});
