/** URL parameters for dev and test tools (§2.5). */
import { isClassId, type ClassId } from './data/classes';
import { getDungeon } from './data/dungeons/index';
import { parseJoinId } from './net/invite';

export interface Params {
  dev: boolean;
  bench: boolean;
  bot: boolean;
  god: boolean;
  mapId: string;
  classId: ClassId;
  /** The `class` parameter if it names a class, otherwise null (bot auto-join, M8 §6.4). */
  classParam: ClassId | null;
  /** Unsigned 32-bit seed, or null for a random one. */
  seed: number | null;
  /** The game ID of an invite link (M8 §6.1), or null if absent or invalid. */
  join: string | null;
  /** Bot auto-join (M8 §6.4): `bot=1&autojoin=1` with a valid `join`. */
  autojoin: boolean;
  /** The `name` parameter, for bot auto-join; null if absent. */
  name: string | null;
}

export function parseParams(search: string): Params {
  const q = new URLSearchParams(search);
  const bench = q.get('bench') === '1';
  if (bench) {
    return { dev: false, bench: true, bot: false, god: false, mapId: 'sandbox', classId: 'betrayer', classParam: null, seed: null, join: null, autojoin: false, name: null };
  }
  // Without dev=1 (or bench=1) the page opens the menus.
  const dev = q.get('dev') === '1';
  const mapParam = q.get('map');
  const mapId = getDungeon(mapParam) ? (mapParam as string) : 'sandbox';
  const classParam = q.get('class');
  const classId: ClassId = isClassId(classParam) ? classParam : 'fallen';
  const seedParam = q.get('seed');
  let seed: number | null = null;
  if (dev && seedParam !== null && /^\d+$/.test(seedParam)) seed = Number(BigInt(seedParam) % 4294967296n);
  const bot = q.get('bot') === '1';
  const join = parseJoinId(q.get('join'));
  return {
    dev,
    bench,
    bot,
    god: q.get('god') === '1',
    mapId,
    classId,
    classParam: isClassId(classParam) ? classParam : null,
    seed,
    join,
    autojoin: bot && !dev && join !== null && q.get('autojoin') === '1',
    name: q.get('name'),
  };
}
