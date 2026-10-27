/**
 * The Pearly Gates pools: full R2 content and the historical R1 regression pool. Pool order is what
 * the weighted picks iterate; changing
 * it changes floors for a seed (a RULES_VERSION bump).
 */
import type { RoomTemplate } from '../types';
import breach from './pg-s-breach-01';
import confessional from './pg-s-confessional-01';
import gate from './pg-b-gate-01';
import flyers1 from './pg-c-1x1-flyers-01';
import flyers2 from './pg-c-1x1-flyers-02';
import flyers3 from './pg-c-1x1-flyers-03';
import ranged1 from './pg-c-1x1-ranged-01';
import ranged2 from './pg-c-1x1-ranged-02';
import ranged3 from './pg-c-1x1-ranged-03';
import horde2x1 from './pg-c-2x1-horde-01';
import ranged2x1 from './pg-c-2x1-ranged-01';
import flyers2x1 from './pg-c-2x1-flyers-01';
import courtyard from './pg-c-2x2-horde-flyers-01';
import pardoner from './pg-s-pardoner-01';
import rangedHazard from './pg-c-1x1-ranged-hazard-01';
import hazardFlyers from './pg-c-1x1-hazard-flyers-01';
import { lampstands } from './pg-c-1x1-elite-01';
import elite2 from './pg-c-1x1-elite-02';
import { trials } from './pg-c-1x1-hazard-01';
import hazard2 from './pg-c-1x1-hazard-02';
import processional from './pg-c-2x1-horde-hazard-01';
import dominions from './pg-c-2x1-elite-01';
import host from './pg-c-2x2-horde-elite-01';
import refiners from './pg-c-2x2-hazard-horde-01';

export const PEARLY_POOL_R1: readonly RoomTemplate[] = [
  ranged1,
  ranged2,
  ranged3,
  flyers1,
  flyers2,
  flyers3,
  horde2x1,
  ranged2x1,
  flyers2x1,
  courtyard,
  breach,
  pardoner,
  confessional,
  gate,
];

/** Full R2 pool: 20 combat grids plus the four special rooms; historical R1 stays immutable. */
export const PEARLY_POOL: readonly RoomTemplate[] = [
  ranged1, ranged2, ranged3, rangedHazard, flyers1, flyers2, flyers3, hazardFlyers,
  lampstands, elite2, trials, hazard2, horde2x1, processional, ranged2x1, flyers2x1, dominions,
  courtyard, host, refiners, breach, pardoner, confessional, gate,
];

/** A template of the pool by id. */
export function poolTemplate(pool: readonly RoomTemplate[], id: string): RoomTemplate {
  const t = pool.find((p) => p.id === id);
  if (!t) throw new Error(`no template '${id}' in the pool`);
  return t;
}
