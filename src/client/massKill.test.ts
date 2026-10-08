/** M12 stage 3: the sounds of the slaughter (M12 §4.3, §11.1). */
import { describe, expect, it } from 'vitest';
import { LIMITER, masterChain, playbackRate } from '../audio/audio';
import { BurstPops, MassKills, massKillSound } from './massKill';

describe('the limiter (M12 §4.3)', () => {
  it('sits between the master gain and the destination', () => {
    const edges: Array<[string, string]> = [];
    const param = () => ({ value: 0 });
    const node = (name: string) => ({ name, connect: (to: { name: string }) => edges.push([name, to.name]) });
    const ctx = {
      destination: { name: 'destination' },
      createGain: () => ({ ...node('master'), gain: param() }),
      createDynamicsCompressor: () => ({ ...node('limiter'), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param() }),
    };
    const master = masterChain(ctx as unknown as BaseAudioContext) as unknown as { name: string };
    expect(master.name).toBe('master');
    expect(edges).toEqual([
      ['master', 'limiter'],
      ['limiter', 'destination'],
    ]);
    expect(LIMITER).toEqual({ threshold: -12, knee: 6, ratio: 6, attack: 0.003, release: 0.15 });
  });

  it('a play with an explicit rate gets no random pitch', () => {
    expect(playbackRate(false, 1.5, () => 1)).toBe(1.5);
    expect(playbackRate(false, undefined, () => 1)).toBeCloseTo(1.05);
    expect(playbackRate(true, undefined, () => 1)).toBe(1);
  });
});

describe('burstPop (M12 §4.3)', () => {
  it('plays at most once per 40 ms', () => {
    const p = new BurstPops();
    expect([0, 10, 39, 40, 60, 80, 81].map((t) => p.play(t))).toEqual([true, false, false, true, false, true, false]);
  });
});

describe('mass kills (M12 §4.3)', () => {
  it('six burst deaths within 0.15 s trigger one, playing 0.1 s later', () => {
    const m = new MassKills();
    for (let i = 0; i < 5; i++) m.burst(i * 25, false, 1, 2);
    expect(m.update(1000)).toBeNull();
    m.burst(140, false, 3, 4);
    expect(m.update(239)).toBeNull();
    expect(m.update(240)).toMatchObject({ count: 6, mine: false, x: 3, y: 4 });
    expect(m.update(300)).toBeNull();
  });

  it("six spread over more than 0.15 s don't", () => {
    const m = new MassKills();
    for (let i = 0; i < 6; i++) m.burst(i * 40, false, 0, 0);
    expect(m.update(1000)).toBeNull();
  });

  it('more within 1.0 s of the trigger trigger nothing; after it, a new one can', () => {
    const m = new MassKills();
    for (let i = 0; i < 6; i++) m.burst(i, false, 0, 0);
    expect(m.update(200)).not.toBeNull();
    for (let i = 0; i < 6; i++) m.burst(500 + i, false, 0, 0);
    expect(m.update(1500)).toBeNull();
    for (let i = 0; i < 6; i++) m.burst(1100 + i, false, 0, 0);
    expect(m.update(1300)).not.toBeNull();
  });

  it('its count includes the bursts until it plays: a 30-burst ripple gives 30', () => {
    const m = new MassKills();
    // 30 bursts spread over 90 ms: the 6th triggers, and the rest arrive before it plays.
    for (let i = 0; i < 30; i++) m.burst(i * 3, false, 0, 0);
    expect(m.update(200)!.count).toBe(30);
  });

  it('is yours with at least 4 of your bursts in its window', () => {
    const three = new MassKills();
    for (let i = 0; i < 6; i++) three.burst(i, i < 3, 0, 0);
    expect(three.update(200)!.mine).toBe(false);
    const four = new MassKills();
    for (let i = 0; i < 6; i++) four.burst(i, i < 4, 0, 0);
    expect(four.update(200)!.mine).toBe(true);
  });

  it('gain and rate by count: bigger is louder and deeper', () => {
    expect(massKillSound(6)).toEqual({ gain: 0.7, rate: 1 });
    const c26 = massKillSound(26);
    expect(c26.gain).toBeCloseTo(1);
    expect(c26.rate).toBeCloseTo(0.8);
    expect(massKillSound(100).rate).toBeCloseTo(0.8);
    expect(massKillSound(100).gain).toBe(1);
  });
});
