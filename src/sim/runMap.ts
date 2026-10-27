/** Loading's map step, shared by the worker and clients (rogue r01.md, R1.3). */
import { getDungeon } from '../data/dungeons';
import { PEARLY_POOL } from '../data/rooms/1';
import { generateFloor } from '../gen';
import type { RunConfig } from '../net/messages';
import { loadMap } from './map';

export function loadRunMap(run: Pick<RunConfig, 'heaven' | 'floor' | 'seed' | 'fixture'>) {
  if (run.fixture === null) return generateFloor(run.seed, run.heaven, run.floor, PEARLY_POOL);
  const def = getDungeon(run.fixture);
  if (!def) throw new Error(`Unknown dungeon fixture ${run.fixture}`);
  return { def, map: loadMap(def), floor: null };
}
