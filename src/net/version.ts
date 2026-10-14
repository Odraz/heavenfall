/** Run identity (rogue game.md §2.2): drawn before Loading, reused by every participant. */
import { fmix32 } from '../gen/hash';

export const PROTOCOL_VERSION = 11;
export const RULES_VERSION = 15;

export interface RunIdentity {
  runId: string;
  seed: number;
  simSeed: number;
}

/** Dev seeds also fix simulation randomness; normal runs draw the two seeds independently. */
export function newRunIdentity(seed?: number): RunIdentity {
  const words = crypto.getRandomValues(new Uint32Array(6));
  return {
    runId: [...words.subarray(0, 4)].map((w) => w.toString(16).padStart(8, '0')).join(''),
    seed: seed === undefined ? words[4] : seed >>> 0,
    simSeed: seed === undefined ? words[5] : fmix32((seed ^ 0x53494d) >>> 0),
  };
}
