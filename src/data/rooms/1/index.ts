/**
 * The R1 room pool of the Pearly Gates (rogue r01.md): the 10 combat templates that need no Dominion
 * and no Refiner's Fire, then the 4 specials. Pool order is what the weighted picks iterate; changing
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

/** A template of the pool by id. */
export function poolTemplate(pool: readonly RoomTemplate[], id: string): RoomTemplate {
  const t = pool.find((p) => p.id === id);
  if (!t) throw new Error(`no template '${id}' in the pool`);
  return t;
}
