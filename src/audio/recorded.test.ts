import { describe, expect, it } from 'vitest';
import { groupTakes, loadRecordedTakes, MAX_RECORDED_GAIN, ShuffleBag, peakRms, TAKES } from './recorded';

describe('recorded sound effects', () => {
  it('groups takes by sound name in file order and skips files that name no sound', () => {
    const g = groupTakes({
      '../../assets/sfx/revolver-02.wav': 'r2',
      '../../assets/sfx/revolver-01.wav': 'r1',
      '../../assets/sfx/hitTick-01.wav': 'h1',
      '../../assets/sfx/porcelainBreak-01.wav': 'p1',
      '../../assets/sfx/unlistedSound-01.wav': 'x1',
      '../../assets/sfx/constructor-01.wav': 'bad',
      '../../assets/sfx/toString-01.wav': 'bad',
      '../../assets/sfx/revolver-001.wav': 'bad',
      '../../assets/sfx/revolver.wav': 'x',
    });
    expect([...g.entries()]).toEqual([
      ['hitTick', ['h1']],
      ['porcelainBreak', ['p1']],
      ['revolver', ['r1', 'r2']],
    ]);
  });

  it('matches hyphenated prompt IDs, so a recording replaces its cue by file name (R8)', () => {
    const g = groupTakes({ '../../assets/sfx/relic-rune-01.wav': 'a', '../../assets/sfx/relic-rune-02.wav': 'b', '../../assets/sfx/relicRune-01.wav': 'old' });
    expect([...g.entries()]).toEqual([['relic-rune', ['a', 'b']]]);
  });

  it('finds the S1 takes in assets/sfx', () => {
    const names = ['chaingun', 'shotgun', 'slug', 'censerLaunch', 'censerBreak', 'revolver', 'silverBullet', 'scourge', 'daggerCut', 'hitTick', 'killTick', 'burstPop', 'blessedDeath', 'massKill', 'porcelainBreak', 'blastLampCrack', 'blastLampBurst'] as const;
    expect(TAKES.size).toBe(17);
    for (const name of names) expect(TAKES.get(name)?.length).toBe(3);
  });

  it('plays every take once per bag, including the initial bag, with no boundary repeat', () => {
    for (const count of [2, 3, 7]) for (const random of [0, 0.49, 0.999]) {
      const bag = new ShuffleBag(count, () => random);
      let last = -1;
      for (let n = 0; n < 20; n++) {
        const takes = Array.from({ length: count }, () => {
          const take = bag.take(); expect(take).not.toBe(last); last = take; return take;
        });
        expect([...takes].sort((a, b) => a - b)).toEqual(Array.from({ length: count }, (_, i) => i));
      }
    }
  });

  it('does not consume a peek and permits the sole surviving take', () => {
    const bag = new ShuffleBag(3, () => 0.99);
    for (let i = 0; i < 10; i++) expect(bag.peek()).toBe(0);
    expect(bag.take()).toBe(0); expect(bag.peek()).toBe(1);
    const one = new ShuffleBag(1, () => { throw Error('no choice needs RNG'); });
    for (let i = 0; i < 10; i++) expect(one.take()).toBe(0);
    for (const count of [0, -1, 1.5, NaN, Infinity, 257]) expect(() => new ShuffleBag(count)).toThrow(RangeError);
  });

  it('measures the loudest 50 ms, not the average over the tail', () => {
    const rate = 1000;
    const s = new Float32Array(1000);
    for (let i = 0; i < 50; i++) s[i] = i % 2 ? 0.5 : -0.5;
    expect(peakRms(s, rate)).toBeCloseTo(0.5, 2);
    expect(peakRms(new Float32Array(10), rate)).toBe(0);
  });

  it('refuses nonfinite samples, empty buffers and invalid sample rates', () => {
    for (const value of [NaN, Infinity, -Infinity]) expect(peakRms(new Float32Array([0.5, value]), 48000)).toBe(0);
    for (const rate of [0, -1, NaN, Infinity]) expect(peakRms(new Float32Array([0.5]), rate)).toBe(0);
    expect(peakRms(new Float32Array(), 48000)).toBe(0);
  });

  it('retains good decoded takes around HTTP, fetch, body and decoder failures', async () => {
    const buffer = (level: number) => ({ sampleRate: 48000, getChannelData: () => new Float32Array(3000).fill(level) });
    let decoded = 0;
    const family = await loadRecordedTakes(['good', 'http', 'fetch', 'body', 'decode', 'quiet', 'silent', 'invalid', 'good'], buffer(0.5), {
      fetch: async (url) => {
        if (url === 'fetch') throw Error('offline');
        return { ok: url !== 'http', arrayBuffer: async () => {
          if (url === 'body') throw Error('truncated');
          return new Uint8Array([{ good: 1, decode: 2, quiet: 3, silent: 4, invalid: 5 }[url] ?? 0]).buffer;
        } };
      },
      decode: async (data) => {
        decoded++; const id = new Uint8Array(data)[0];
        if (id === 2) throw Error('bad codec');
        return buffer(id === 1 ? 0.25 : id === 3 ? 0.0001 : id === 5 ? NaN : 0);
      },
    });
    expect(decoded).toBe(6); expect(family.bufs).toHaveLength(3);
    expect(family.gains).toEqual([2, MAX_RECORDED_GAIN, 2]);
    expect(family.gains.every((v) => Number.isFinite(v) && v <= 4)).toBe(true);
  });

  it('leaves a whole failed family synthesized and skips invalid reference levels', async () => {
    const buffer = (value: number) => ({ sampleRate: 48000, getChannelData: () => new Float32Array(3000).fill(value) });
    const fail = { fetch: async () => { throw Error('offline'); }, decode: async () => buffer(0.5) };
    expect(await loadRecordedTakes(['a', 'b'], buffer(0.5), fail)).toEqual({ bufs: [], gains: [] });
    expect(await loadRecordedTakes(['a'], buffer(NaN), { ...fail, fetch: async () => { throw Error('must not load'); } })).toEqual({ bufs: [], gains: [] });
  });
});
