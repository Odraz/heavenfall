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
  /** Benchmark camera (M10 §2.3): `turn` (default) or `arcade`, fixed looking north-east. */
  benchView: 'turn' | 'arcade';
  /**
   * A fixed camera for screenshots (M10 §11), with dev=1 or bench=1: `cam=x,y,z,yaw,pitch`, a point
   * in map meters (z: height above the map's zero; empty: eye height above the floor there) and angles in degrees.
   */
  cam: DevCamera | null;
}

export interface DevCamera {
  x: number;
  y: number;
  z: number | null;
  yaw: number;
  pitch: number;
}

function parseCam(v: string | null): DevCamera | null {
  if (!v) return null;
  const p = v.split(',');
  if (p.length !== 5) return null;
  const [x, y, yaw, pitch] = [p[0], p[1], p[3], p[4]].map(Number);
  const z = p[2] === '' ? null : Number(p[2]);
  if (![x, y, yaw, pitch].every(Number.isFinite) || (z !== null && !Number.isFinite(z))) return null;
  return { x, y, z, yaw: (yaw * Math.PI) / 180, pitch: (pitch * Math.PI) / 180 };
}

export function parseParams(search: string): Params {
  const q = new URLSearchParams(search);
  const bench = q.get('bench') === '1';
  const mapParam = q.get('map');
  const mapId = getDungeon(mapParam) ? (mapParam as string) : 'sandbox';
  if (bench) {
    const benchView = q.get('view') === 'arcade' ? 'arcade' : 'turn';
    return { dev: false, bench: true, bot: false, god: false, mapId, classId: 'betrayer', classParam: null, seed: null, join: null, autojoin: false, name: null, benchView, cam: parseCam(q.get('cam')) };
  }
  // Without dev=1 (or bench=1) the page opens the menus.
  const dev = q.get('dev') === '1';
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
    benchView: 'turn',
    cam: dev ? parseCam(q.get('cam')) : null,
  };
}
