import { describe, expect, it, vi } from 'vitest';
import { AudioEngine } from './audio';
import { ShuffleBag } from './recorded';
import type { SfxName } from './sfx';

/** Exercise actual admission/playback with injected decoded buffers and WebAudio nodes. */
function playback() {
  const started: Array<{ buffer: unknown; gain: number }> = [];
  const synth = { id: 'synth' }, buffers = [{ id: 'take0' }, { id: 'take1' }, { id: 'take2' }];
  const bag = new ShuffleBag(3, () => 0.99);
  const voices: Array<{ name: SfxName; priority: number; ended: boolean; src: { stop(): void } }> = [];
  const ctx = { currentTime: 1,
    createGain: () => ({ gain: { value: 1 }, connect() {} }),
    createStereoPanner: () => ({ pan: { value: 0 }, connect() {} }),
    createBufferSource: () => {
      const source = { buffer: null as unknown, playbackRate: { value: 1 }, onended: null, stop: vi.fn(),
        connect(node: { gain: { value: number } }) { source.start = () => { started.push({ buffer: source.buffer, gain: node.gain.value }); }; }, start() {} };
      return source;
    },
  };
  const engine = Object.assign(Object.create(AudioEngine.prototype) as Record<string, unknown>, {
    ctx, sfxBus: {}, recordedOn: true, lx: 0, ly: 0, lyaw: 0, voices, lastStart: new Map(),
    buffers: new Map([['porcelainBreak', synth], ['shotgun', synth]]),
    takes: new Map([['porcelainBreak', { bufs: buffers, gains: [1, 2, 3], bag }]]),
  }) as unknown as AudioEngine;
  return { engine, bag, ctx, voices, started, synth, buffers };
}

describe('recorded playback admission', () => {
  it('does not advance the bag for inaudible, gap-limited or priority-rejected voices', () => {
    const h = playback();
    h.engine.play('porcelainBreak', { x: 40, y: 0 });
    h.engine.play('porcelainBreak', null, 0);
    expect(h.bag.peek()).toBe(0); expect(h.started).toHaveLength(0);
    h.engine.play('porcelainBreak');
    h.engine.play('porcelainBreak'); // Same clock: rejected by the unchanged 30-ms gap.
    expect(h.started).toEqual([{ buffer: h.buffers[0], gain: 1 }]); expect(h.bag.peek()).toBe(1);
    h.ctx.currentTime++;
    h.voices.splice(0);
    for (let i = 0; i < 24; i++) h.voices.push({ name: 'shotgun', priority: 4, ended: false, src: { stop() {} } });
    h.engine.play('porcelainBreak');
    expect(h.started).toHaveLength(1); expect(h.bag.peek()).toBe(1); expect(h.voices).toHaveLength(24);
    h.voices[0].priority = 1;
    h.engine.play('porcelainBreak');
    expect(h.started[1]).toEqual({ buffer: h.buffers[1], gain: 2 }); expect(h.voices).toHaveLength(24);
  });

  it('plays synthesized when disabled or missing a family and keeps the bag for re-enable', () => {
    const h = playback();
    h.engine.setRecorded(false); h.engine.play('porcelainBreak');
    expect(h.started[0].buffer).toBe(h.synth); expect(h.bag.peek()).toBe(0);
    h.ctx.currentTime++;
    h.engine.setRecorded(true); h.engine.play('porcelainBreak');
    h.engine.play('shotgun');
    expect(h.started[1].buffer).toBe(h.buffers[0]); expect(h.started[2].buffer).toBe(h.synth);
  });

  it('retains per-sound limits and positional attenuation for recorded takes', () => {
    const h = playback();
    for (let i = 0; i < 10; i++) { h.engine.play('porcelainBreak', { x: 21, y: 0 }); h.ctx.currentTime += 0.1; }
    expect(h.voices).toHaveLength(4);
    expect(h.started.map((v) => v.gain)).toEqual([0.5, 1, 1.5, 0.5, 1, 1.5, 0.5, 1, 1.5, 0.5]);
  });
});
