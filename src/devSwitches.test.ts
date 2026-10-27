/**
 * R9 stage 1: no development URL switch reaches a normal save (rogue game.md §13, slice-acceptance.md
 * "debug never saves"). Each switch either makes the page disposable or parses only together with
 * `dev=1`, which itself is disposable; a disposable page never enables progression.
 */
import { describe, expect, it } from 'vitest';
import { disposableRun, parseParams, runProgression } from './params';

/** Switches that make a page disposable on their own. */
const DISPOSABLE = ['dev=1', 'bench=1', 'bot=1', 'god=1', 'lag=200', 'jitter=40', 'loss=5', 'bench=1&map=rogue&seed=317434499&room=3'];
/** Switches read only with dev=1: without it they parse to their neutral value. */
const DEV_ONLY: Array<[string, (p: ReturnType<typeof parseParams>) => unknown, unknown]> = [
  ['map=rogue&seed=7', (p) => p.seed, null],
  ['map=rogue&room=4', (p) => p.startRoom, null],
  ['map=pearly-gates&arena=2', (p) => p.startArena, 0],
  ['build=marksman', (p) => p.devBuild, null],
  ['relics=usher,link', (p) => p.devRelics, []],
  ['edicts=1,3', (p) => p.devEdicts, []],
  ['menu=1&readyHold=1', (p) => p.devMenu || p.readyHold, false],
  ['cam=1,2,,0,0', (p) => p.cam, null],
  ['map=rogue&bosshp=0.5', (p) => p.bossHp, null],
];

describe('development switches never reach a normal save', () => {
  it('a plain page with a profile on the generated floor records progression', () => {
    for (const q of ['', '?class=binder', '?evidence=1']) {
      const p = parseParams(q);
      expect(disposableRun(p), q).toBe(false);
      expect(runProgression(p, true, 'rogue'), q).toBe(true);
    }
  });
  it('a fixture or a page without a profile never records progression', () => {
    const p = parseParams('');
    expect(runProgression(p, true, 'pearly-gates')).toBe(false);
    expect(runProgression(p, false, 'rogue')).toBe(false);
  });
  it.each(DISPOSABLE)('%s makes the run disposable', (q) => {
    const p = parseParams(`?${q}`);
    expect(disposableRun(p)).toBe(true);
    expect(runProgression(p, true, 'rogue')).toBe(false);
  });
  it.each(DEV_ONLY)('%s is ignored without dev=1 and disposable with it', (q, read, neutral) => {
    expect(read(parseParams(`?${q}`))).toEqual(neutral);
    const dev = parseParams(`?dev=1&${q}`);
    expect(read(dev)).not.toEqual(neutral);
    expect(runProgression(dev, true, 'rogue')).toBe(false);
  });
});
