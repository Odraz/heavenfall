import { describe, expect, it, vi } from 'vitest';
import { fmix32 } from '../gen/hash';
import { newRunIdentity } from './version';

describe('run identity (rogue R1.3)', () => {
  it('draws a 128-bit lowercase hex identity and two independent unsigned seeds from crypto', () => {
    const spy = vi.spyOn(crypto, 'getRandomValues').mockImplementation((array) => {
      (array as Uint32Array).set([0, 0x01234567, 0x89abcdef, 0xffffffff, 23, 47]);
      return array;
    });
    try {
      expect(newRunIdentity()).toEqual({ runId: '00000000' + '01234567' + '89abcdef' + 'ffffffff', seed: 23, simSeed: 47 });
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy.mock.calls[0][0]).toBeInstanceOf(Uint32Array);
    } finally {
      spy.mockRestore();
    }
  });

  it('an explicit dev seed, including zero, fixes both RNG seeds without reusing the run id', () => {
    for (const seed of [0, 1, 0x12ebaa83, 0xffffffff]) {
      const a = newRunIdentity(seed);
      const b = newRunIdentity(seed);
      expect(a.seed).toBe(seed);
      expect(a.simSeed).toBe(fmix32((seed ^ 0x53494d) >>> 0));
      expect([b.seed, b.simSeed]).toEqual([a.seed, a.simSeed]);
      expect(a.runId).toMatch(/^[0-9a-f]{32}$/);
      expect(b.runId).not.toBe(a.runId);
    }
  });
});
