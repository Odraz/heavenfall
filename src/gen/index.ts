/** The floor generator (rogue game.md §3): pure, the same in Node and every browser. */
import type { DungeonDef } from '../data/dungeons/types';

export { generateFloor, roomCount, MAX_ATTEMPTS, type Floor, type GeneratedFloor } from './generate';
export { attemptSeed, fmix32, makeRng, type Rng } from './hash';

/** FNV-1a (32-bit) over `JSON.stringify(def)`: key insertion order, no typed arrays; 8 hex digits. */
export function floorHash(def: DungeonDef): string {
  const s = JSON.stringify(def);
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** The 1 000 pinned test seeds (rogue game.md §3.3): imul(i + 1, 0x9E3779B1) >>> 0. */
export function pinnedSeed(i: number): number {
  return Math.imul(i + 1, 0x9e3779b1) >>> 0;
}
