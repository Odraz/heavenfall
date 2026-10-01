/** URL parameters for dev and test tools (§2.5). */
import { isClassId, type ClassId } from './data/classes';
import { getDungeon } from './data/dungeons/index';

export interface Params {
  dev: boolean;
  bench: boolean;
  bot: boolean;
  god: boolean;
  mapId: string;
  classId: ClassId;
  /** Unsigned 32-bit seed, or null for a random one. */
  seed: number | null;
}

export function parseParams(search: string): Params {
  const q = new URLSearchParams(search);
  const bench = q.get('bench') === '1';
  if (bench) {
    return { dev: false, bench: true, bot: false, god: false, mapId: 'sandbox', classId: 'betrayer', seed: null };
  }
  // Until milestone 5, opening the page without dev=1 behaves as if dev=1 were set.
  const dev = true;
  const mapParam = q.get('map');
  const mapId = getDungeon(mapParam) ? (mapParam as string) : 'sandbox';
  const classParam = q.get('class');
  const classId: ClassId = isClassId(classParam) ? classParam : 'fallen';
  const seedParam = q.get('seed');
  let seed: number | null = null;
  if (dev && seedParam !== null && /^\d+$/.test(seedParam)) seed = Number(BigInt(seedParam) % 4294967296n);
  return { dev, bench, bot: q.get('bot') === '1', god: q.get('god') === '1', mapId, classId, seed };
}
