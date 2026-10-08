/** A combat arena for the M12 tests: the director, waves and the breath. */
import { expect } from 'vitest';
import type { ClassId } from '../../data/classes';
import { GridBuilder } from '../../data/dungeons/build';
import type { DungeonDef, WaveDef } from '../../data/dungeons/types';
import { PHASE_COMBAT } from '../../net/protocol';
import { Simulation } from '../sim';
import { sealNow } from './sims';

// A lobby (x 1–4) open to a combat arena (x 6–32, y 1–10). Spawn points in three columns, rows 2, 5
// and 8: west (x 7), middle (x 19) and east (x 31).
export const WEST = 7;
export const MIDDLE = 19;
export const EAST = 31;

export function arenaDungeon(waves: WaveDef[], boss = false): DungeonDef {
  const g = new GridBuilder(34, 12);
  g.fillRect(1, 1, 4, 4, 0);
  g.marker(1, 1, 'S').marker(2, 1, 'S').marker(1, 2, 'S').marker(2, 2, 'S');
  g.fillRect(5, 2, 5, 3, 0);
  g.fillRect(6, 1, 32, 10, 0);
  for (const x of [WEST, MIDDLE, EAST]) for (const y of [2, 5, 8]) g.marker(x, y, 'x');
  const grids = g.build();
  return {
    id: 'director-test',
    name: 'Director test',
    ...grids,
    arenas: [{ id: 'a', name: 'A', rect: { x0: 6, y0: 1, x1: 32, y1: 10 }, doors: [], entryCells: [[8, 4], [8, 5], [8, 6], [9, 5]], waves, boss }],
  };
}

const CLASSES: ClassId[] = ['betrayer', 'heretic', 'binder', 'fallen'];

export function arenaSim(waves: WaveDef[], opts: { players?: number; god?: boolean; singleplayer?: boolean; noWaves?: boolean; boss?: boolean } = {}): Simulation {
  return new Simulation({
    dungeon: arenaDungeon(waves, opts.boss),
    players: Array.from({ length: opts.players ?? 4 }, (_, id) => ({ id, name: `P${id}`, classId: CLASSES[id] })),
    seed: 1,
    god: opts.god,
    singleplayer: opts.singleplayer,
    noWaves: opts.noWaves,
  });
}

/** Puts every player at (x, y) in the arena and seals it. */
export function sealAt(sim: Simulation, x = 8.5, y = 5.5): void {
  for (const p of sim.players) {
    p.x = x;
    p.y = y;
    p.z = 0;
  }
  sim.step();
  sealNow(sim);
  expect(sim.arenas[0].phase).toBe(PHASE_COMBAT);
}
