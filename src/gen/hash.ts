/** Seeds and the generator's random stream (rogue game.md §3.2). Pure: integer and IEEE double arithmetic only. */
import { mulberry32 } from '../sim/rng';

/** murmur3's 32-bit finalizer. */
export function fmix32(h: number): number {
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Attempt `a`'s seed: fmix32(seed ^ imul(heaven, 0x9E3779B1) ^ imul(floor, 0x85EBCA77) ^ imul(a, 0xC2B2AE3D)). */
export function attemptSeed(seed: number, heaven: number, floor: number, a: number): number {
  return fmix32((seed ^ Math.imul(heaven, 0x9e3779b1) ^ Math.imul(floor, 0x85ebca77) ^ Math.imul(a, 0xc2b2ae3d)) >>> 0);
}

export interface Rng {
  /** [0, 1). */
  next(): number;
  /** An integer in [0, n). */
  int(n: number): number;
  pick<T>(list: readonly T[]): T;
  /** Walks the list in its order, subtracting weights from next() × total; one draw. */
  weighted<T>(list: readonly T[], weight: (t: T) => number): T;
}

export function makeRng(s: number): Rng {
  const f = mulberry32(s);
  const rng: Rng = {
    next: f,
    int: (n) => Math.floor(f() * n),
    pick: (list) => list[rng.int(list.length)],
    weighted: (list, weight) => {
      let total = 0;
      for (const t of list) total += weight(t);
      let u = f() * total;
      for (const t of list) {
        u -= weight(t);
        if (u < 0) return t;
      }
      return list[list.length - 1];
    },
  };
  return rng;
}
