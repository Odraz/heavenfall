/** URL parameters for dev and test tools (§2.5). */
import { isClassId, type ClassId } from './data/classes';
import { getDungeon } from './data/dungeons/index';
import { parseJoinId } from './net/invite';

export interface Params {
  dev: boolean;
  /**
   * The benchmark's arena (M10 gate §4), or -1 when not benchmarking: the boss arena in the gate
   * view, arena 0 otherwise (and in the gate view on a map with no boss arena).
   */
  benchArena: number;
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
  /**
   * Benchmark camera: `turn` (default), `arcade` fixed looking north-east (M10 §2.3), or `gate`, in
   * the boss arena, fixed looking at the gate (M10 gate §4).
   */
  benchView: BenchView;
  /** The benchmark's HUD fires the class's primary attack every interval (M11 §5, `hudfire=1`). */
  benchHudFire: boolean;
  /** The benchmark's host bursts 20 Blessed ahead of player 0 every 0.5 s (M12 §10, `burst=1`). */
  benchBurst: boolean;
  /**
   * A fixed camera for screenshots (M10 §11), with dev=1 or bench=1: `cam=x,y,z,yaw,pitch`, a point
   * in map meters (z: height above the map's zero; empty: eye height above the floor there) and angles in degrees.
   */
  cam: DevCamera | null;
}

export type BenchView = 'turn' | 'arcade' | 'gate';

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
    const view = q.get('view');
    const benchView: BenchView = view === 'arcade' || view === 'gate' ? view : 'turn';
    const boss = benchView === 'gate' ? getDungeon(mapId)!.arenas.findIndex((a) => a.boss) : -1;
    const benchArena = Math.max(0, boss);
    // The class the benchmark plays: the `class` parameter (M11 §5), the Betrayer by default.
    const cls = q.get('class');
    const classId: ClassId = isClassId(cls) ? cls : 'betrayer';
    const benchHudFire = q.get('hudfire') === '1';
    const benchBurst = q.get('burst') === '1';
    return { dev: false, benchArena, bot: false, god: false, mapId, classId, classParam: null, seed: null, join: null, autojoin: false, name: null, benchView, benchHudFire, benchBurst, cam: parseCam(q.get('cam')) };
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
    benchArena: -1,
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
    benchHudFire: false,
    benchBurst: false,
    cam: dev ? parseCam(q.get('cam')) : null,
  };
}
