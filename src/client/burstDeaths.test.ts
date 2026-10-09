/** M12 stage 3: burst deaths on the client (M12 §4.2, §4.2.1, §11.1). */
import { describe, expect, it } from 'vitest';
import { BLESSED, CHERUB, CHORISTER, GATEKEEPER } from '../data/enemies';
import type { SpriteFrame } from '../render/atlas';
import { MAX_PIECES, Particles, PIECE_GRAVITY, type Rotations } from '../render/particles';
import {
  BurstMemory,
  burstSpriteAlpha,
  burstSpriteHeight,
  featherBudget,
  shedsPieces,
  piecesFor,
  rippleDelays,
  towardCamera,
} from './burstDeaths';
import shredHeights from '../../assets/art-src/shred-blessed.json';

describe('the burst memory (M12 §4.2)', () => {
  it('remembers each slot of a `bursts` event for 1 s, its tier from the angle', () => {
    const m = new BurstMemory();
    m.remember([5, 90, 0, 7, 360 + 45, 1], 1000, () => 0);
    expect(m.peek(5, 1500)).toMatchObject({ angle: 90, heavy: false, playerId: 0 });
    expect(m.peek(7, 1999)).toMatchObject({ angle: 45, heavy: true, playerId: 1 });
    // Expired at 1 s: an unknown slot plays a normal death.
    expect(m.take(7, 2000)).toBeNull();
  });

  it('a remembered slot is taken once, as its death plays; an unknown slot gives nothing', () => {
    const m = new BurstMemory();
    m.remember([5, 90, 0], 0, () => 0);
    expect(m.take(5, 100)).not.toBeNull();
    expect(m.take(5, 100)).toBeNull();
    expect(m.take(6, 100)).toBeNull();
  });

  it('a slot reappearing as a new enemy is forgotten', () => {
    const m = new BurstMemory();
    m.remember([5, 90, 0], 0, () => 0);
    m.forget(5);
    expect(m.take(5, 10)).toBeNull();
  });

  it('the ripple: 0 to 90 ms by distance from each burst’s own player; 0 when all are equal', () => {
    expect(rippleDelays([2, 4, 6])).toEqual([0, 45, 90]);
    expect(rippleDelays([3, 3, 3])).toEqual([0, 0, 0]);
    expect(rippleDelays([5])).toEqual([0]);
    const m = new BurstMemory();
    const dist: Record<number, number> = { 1: 10, 2: 20, 3: 1, 4: 50 };
    // Slots 1 and 2 are player 0's, 3 and 4 player 1's: each ripples on its own.
    m.remember([1, 0, 0, 2, 0, 0, 3, 0, 1, 4, 0, 1], 0, (s) => dist[s]);
    expect([1, 2, 3, 4].map((s) => m.peek(s, 0)!.ripple)).toEqual([0, 90, 0, 90]);
  });
});

describe('the torn pieces under load (decisions.md, M12 §10)', () => {
  it('every burst sheds its pieces up to 8 bursts in 0.5 s; beyond, 1 in 4, and 1 in 8 above 24', () => {
    expect([0, 0.5, 0.999].every((r) => shedsPieces(8, r))).toBe(true);
    expect([shedsPieces(9, 0.24), shedsPieces(9, 0.25)]).toEqual([true, false]);
    expect([shedsPieces(25, 0.124), shedsPieces(25, 0.125)]).toEqual([true, false]);
  });
});

describe('the feather budget and the burst sprite (M12 §4.2)', () => {
  it('× 1 up to 8 bursts in the last 0.5 s, × 0.5 from 9, × 0.25 above 24, halved again beyond 20 m', () => {
    expect(featherBudget(30, 14, 8, 5)).toEqual({ feathers: 30, sparks: 14 });
    expect(featherBudget(30, 14, 9, 5)).toEqual({ feathers: 15, sparks: 7 });
    expect(featherBudget(30, 14, 24, 5)).toEqual({ feathers: 15, sparks: 7 });
    expect(featherBudget(30, 14, 25, 5)).toEqual({ feathers: 8, sparks: 4 });
    expect(featherBudget(30, 14, 8, 21)).toEqual({ feathers: 15, sparks: 7 });
    // The minimums: 4 feathers, 2 sparks.
    expect(featherBudget(16, 6, 25, 21)).toEqual({ feathers: 4, sparks: 2 });
  });

  it('the sprite grows over 220 ms (cubic ease-out), its height capped at 0.38 × its distance to the camera', () => {
    expect(burstSpriteHeight(1.2, 1.9, 0, 10)).toBeCloseTo(1.2);
    expect(burstSpriteHeight(1.2, 1.9, 110, 10)).toBeCloseTo(1.2 + 0.7 * (1 - 0.5 ** 3));
    expect(burstSpriteHeight(1.2, 1.9, 220, 10)).toBeCloseTo(1.9);
    expect(burstSpriteHeight(1.2, 1.9, 220, 2)).toBeCloseTo(0.76);
  });

  it('the sprite is opaque until 110 ms, then dithered out by 220 ms', () => {
    expect(burstSpriteAlpha(110)).toBe(1);
    expect(burstSpriteAlpha(165)).toBeCloseTo(0.5);
    expect(burstSpriteAlpha(220)).toBe(0);
  });

  it('a burst moves 0.6 m toward the camera, but stays 1 m in front of it', () => {
    expect(towardCamera(10)).toBe(0.6);
    expect(towardCamera(1.3)).toBeCloseTo(0.3);
    expect(towardCamera(0.8)).toBe(0);
  });
});

describe('torn pieces (M12 §4.2.1)', () => {
  it('a Blessed tears into its upper and lower halves and its sword, a Cherub into a wing and a wing tip; a Chorister into none', () => {
    const blessed = piecesFor(BLESSED);
    expect(blessed.map((p) => [p.sprite, p.size])).toEqual([
      ['shred-blessed-upper', shredHeights.upper.heightM],
      ['shred-blessed-lower', shredHeights.lower.heightM],
      ['shred-blessed-sword', shredHeights.sword.heightM],
    ]);
    // The halves start 0.2 m above and below the body center and fly to opposite sides.
    expect(blessed.map((p) => [p.dz, p.sideSign, p.turnMs])).toEqual([
      [0.2, 1, 120],
      [-0.2, -1, 120],
      [0, 0, 60],
    ]);
    expect(piecesFor(CHERUB).map((p) => [p.sprite, p.size, p.turnMs])).toEqual([
      ['shred-wing', 0.55, 80],
      ['shred-wingtip', 0.35, 80],
    ]);
    expect(piecesFor(CHORISTER)).toEqual([]);
    expect(piecesFor(GATEKEEPER)).toEqual([]);
  });
});

/** Four frames of a piece: r0 and r2 are 100 px tall, r1 and r3 60 px, in a 1000 px atlas. */
function rotations(): Rotations {
  const f = (h: number): SpriteFrame => ({ u0: 0, u1: 0.1, v0: 0, v1: h / 1000, aspect: 1 });
  return [f(100), f(60), f(100), f(60)];
}

/** Records what Particles draws. */
function recorder() {
  const adds: Array<{ f: SpriteFrame; x: number; y: number; z: number; h: number }> = [];
  return { adds, add: (f: SpriteFrame, x: number, y: number, z: number, h: number) => void adds.push({ f, x, y, z, h }) };
}

/** A random source that returns the given values in turn, then 0.5. */
function seq(...v: number[]): () => number {
  let i = 0;
  return () => (i < v.length ? v[i++] : 0.5);
}

describe('a torn piece in flight (M12 §4.2.1)', () => {
  it('tumbles through its 4 rotations at its pace, keeping its size across them', () => {
    const r = rotations();
    // Starts on r0 (0 × 4), turning +1 (0.9 ≥ 0.5).
    const p = new Particles([r[0], r[0], r[0]], () => -Infinity, seq(0, 0.9));
    p.piece(r, 0, 0, 100, 0, 0, 0, 0.8, 120, false);
    const seen: number[] = [];
    const heights: number[] = [];
    for (let k = 0; k < 4; k++) {
      const rec = recorder();
      p.draw(rec, 50, 0);
      seen.push(r.indexOf(rec.adds[0].f as never));
      heights.push(rec.adds[0].h);
      p.update(0.12);
    }
    expect(seen).toEqual([0, 1, 2, 3]);
    // r1 and r3 are drawn at 60/100 of the 0° frame's height, so the piece itself stays 0.8 m.
    expect(heights.map((h) => +h.toFixed(3))).toEqual([0.8, 0.48, 0.8, 0.48]);
  });

  it('falls at 12 m/s² without drag', () => {
    const r = rotations();
    const p = new Particles([r[0], r[0], r[0]], () => -Infinity, seq(0, 0.9));
    p.piece(r, 0, 0, 100, 3, 0, 5, 0.8, 1000, false);
    for (let i = 0; i < 10; i++) p.update(0.01);
    const rec = recorder();
    p.draw(rec, 50, 0);
    expect(rec.adds[0].x).toBeCloseTo(0.3, 6);
    // Semi-implicit Euler: within a few mm of the exact arc.
    expect(rec.adds[0].z).toBeCloseTo(100 + 5 * 0.1 - 0.5 * PIECE_GRAVITY * 0.01, 1);
  });

  it('lands on the floor under it resting on its bottom; a half lies on its side', () => {
    const r = rotations();
    // A half on r0, turning +1 every 10 s (it doesn't turn in flight).
    const p = new Particles([r[0], r[0], r[0]], () => 2, seq(0, 0.9));
    p.piece(r, 0, 0, 3, 0, 0, 0, 0.8, 10_000, true);
    for (let i = 0; i < 100; i++) p.update(0.01);
    const rec = recorder();
    p.draw(rec, 50, 0);
    // On its side (r1, 0.48 m tall), its bottom on the floor at 2.
    expect(r.indexOf(rec.adds[0].f as never)).toBe(1);
    expect(rec.adds[0].z - rec.adds[0].h / 2).toBeCloseTo(2, 6);
    // It stays there and stops turning.
    p.update(0.5);
    const again = recorder();
    p.draw(again, 50, 0);
    expect(again.adds[0].f).toBe(rec.adds[0].f);
    expect(again.adds[0].z).toBeCloseTo(rec.adds[0].z, 6);
  });

  it('a sword lands on the rotation it reached, resting on its bottom', () => {
    const r = rotations();
    const p = new Particles([r[0], r[0], r[0]], () => 0, seq(0, 0.9));
    p.piece(r, 0, 0, 1, 0, 0, 0, 0.8, 10_000, false);
    for (let i = 0; i < 100; i++) p.update(0.01);
    const rec = recorder();
    p.draw(rec, 50, 0);
    expect(r.indexOf(rec.adds[0].f as never)).toBe(0);
    expect(rec.adds[0].z - rec.adds[0].h / 2).toBeCloseTo(0, 6);
  });

  it('keeps falling where there is no floor (over the void)', () => {
    const r = rotations();
    const p = new Particles([r[0], r[0], r[0]], () => -Infinity, seq(0, 0.9));
    p.piece(r, 0, 0, 1, 0, 0, 0, 0.8, 10_000, true);
    for (let i = 0; i < 100; i++) p.update(0.01);
    const rec = recorder();
    p.draw(rec, 50, 0);
    expect(rec.adds[0].z).toBeLessThan(1 - 0.5 * PIECE_GRAVITY * 0.9);
  });

  it("isn't overwritten by feathers: pieces have their own ring", () => {
    const r = rotations();
    const feather: SpriteFrame = { u0: 0, u1: 0.1, v0: 0, v1: 0.1, aspect: 1 };
    const p = new Particles([feather, feather, feather], () => -Infinity);
    p.piece(r, 0, 0, 100, 0, 0, 0, 0.8, 120, false);
    // 4 000 particles' worth of feathers: the feather pool overwrites itself, not the piece.
    for (let i = 0; i < 300; i++) p.featherBurst(0, 0, 0);
    const rec = recorder();
    p.draw(rec, 50, 0);
    expect(rec.adds.filter((a) => a.f !== feather).length).toBe(1);
    expect(MAX_PIECES).toBe(512);
  });
});
