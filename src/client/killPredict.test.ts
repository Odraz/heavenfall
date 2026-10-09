/** M12 stage 3: your kills, at once (M12 §4.4, §11.1). */
import { describe, expect, it } from 'vitest';
import { BLESSED, CHORISTER, GATEKEEPER } from '../data/enemies';
import { SECONDARIES, SHOTGUN_CLOSE_DAMAGE, WEAPONS } from '../data/weapons';
import { estimateSilverBullet } from '../sim/combat';
import { Flinches, HIT_FLINCH, KILL_FLINCH, ladderRate, MAX_FLINCHES, PredictedKills, predictHit, predictPellets, predictSilverBullet, SHOTGUN_FAR_DAMAGE, type PelletTarget } from './killPredict';

describe('predicted kills (M12 §4.4)', () => {
  it('a revolver hit on a Blessed predicts a burst', () => {
    expect(predictHit(BLESSED, WEAPONS.betrayer.damage, false)).toBe(2);
  });

  it('a Chain Gun hit never predicts a kill', () => {
    expect(predictHit(BLESSED, WEAPONS.binder.damage, true, false, false)).toBe(0);
    expect(predictHit(BLESSED, 1000, false, false, false)).toBe(0);
  });

  it('a kill below 2× max HP is a plain kill; the Scourge and the close shotgun always burst', () => {
    expect(predictHit(BLESSED, 20, false)).toBe(1);
    expect(predictHit(BLESSED, 19, false)).toBe(0);
    expect(predictHit(BLESSED, SECONDARIES.binder.damage, false, true)).toBe(2);
  });

  it('a rooted Blessed doubles the damage', () => {
    expect(predictHit(BLESSED, 10, false)).toBe(0);
    expect(predictHit(BLESSED, 10, true)).toBe(1);
    expect(predictHit(BLESSED, 20, true)).toBe(2);
  });

  it('never the Gatekeeper; a Chorister needs its 60', () => {
    expect(predictHit(GATEKEEPER, 1e9, false, true)).toBe(0);
    expect(predictHit(CHORISTER, 59, false)).toBe(0);
    expect(predictHit(CHORISTER, 60, false)).toBe(1);
  });

  it('a pellet within 6 m predicts a burst; beyond 6 m it predicts nothing (M12 §5.1)', () => {
    const at = (close: boolean): PelletTarget[] => [{ i: 0, t: 5, type: BLESSED, rooted: false, close }];
    expect(SHOTGUN_CLOSE_DAMAGE).toBe(20);
    expect(SHOTGUN_FAR_DAMAGE).toBe(10);
    expect(predictPellets([at(true)], SHOTGUN_FAR_DAMAGE, 1, 'shotgun')[0][0].result).toBe(2);
    expect(predictPellets([at(false)], SHOTGUN_FAR_DAMAGE, 1, 'shotgun')[0][0].result).toBe(0);
  });

  it('within one shot, pellets pass an enemy an earlier pellet killed: 8 pellets into a packed column predict 8 kills', () => {
    const column: PelletTarget[] = Array.from({ length: 10 }, (_, i) => ({ i, t: 1 + 0.4 * i, type: BLESSED, rooted: false, close: true }));
    const shot = predictPellets(Array(8).fill(column), SHOTGUN_FAR_DAMAGE, 1, 'shotgun');
    expect(shot.map((hits) => hits.map((h) => [h.target.i, h.result]))).toEqual(Array.from({ length: 8 }, (_, k) => [[k, 2]]));
    // A Chain Gun never kills, so every bullet hits the first.
    const gun = predictPellets(Array(3).fill(column), WEAPONS.binder.damage, 1, 'chainGun');
    expect(gun.map((hits) => hits[0].target.i)).toEqual([0, 0, 0]);
  });

  it('a Silver Bullet through 10 Blessed predicts 10 kills, the first 9 as bursts (carried 200 down to 40), not the 10th (20)', () => {
    const line = Array.from({ length: 10 }, () => ({ type: BLESSED, rooted: false }));
    const est = estimateSilverBullet(line, SECONDARIES.betrayer.damage);
    expect(est.carried).toEqual([200, 180, 160, 140, 120, 100, 80, 60, 40, 20]);
    expect(predictSilverBullet(line, est.carried)).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 1]);
  });
});

describe('the kill marker and the pitch ladder (M12 §4.4)', () => {
  it('killTick climbs a semitone per predicted kill in the last 0.5 s, up to 7', () => {
    expect(ladderRate(0)).toBe(1);
    expect(ladderRate(7)).toBeCloseTo(2 ** (7 / 12));
    expect(ladderRate(12)).toBeCloseTo(2 ** (7 / 12));
    const k = new PredictedKills();
    expect(k.kill(0)).toBe(1);
    expect(k.kill(100)).toBeCloseTo(2 ** (1 / 12));
    expect(k.kill(200)).toBeCloseTo(2 ** (2 / 12));
    // 0.5 s after the first two, only the third is still counted.
    expect(k.kill(650)).toBeCloseTo(2 ** (1 / 12));
  });

  it("the snapshot's kill marker is skipped for 400 ms after a predicted kill", () => {
    const k = new PredictedKills();
    expect(k.holdsMarker(0)).toBe(false);
    k.kill(1000);
    expect(k.holdsMarker(1399)).toBe(true);
    expect(k.holdsMarker(1400)).toBe(false);
  });
});

describe('flinches (M12 §4.4)', () => {
  it('a hit pushes 0.15 m along the shot and squashes, held 50 ms, then eases back over 120 ms', () => {
    const f = new Flinches();
    f.add(3, 0, 2, 0, HIT_FLINCH);
    const p = f.at(3, 50)!;
    expect([p.dx, p.dy, p.right, p.dz, p.wide, p.tall, p.glow]).toEqual([0.15, 0, 0.05, 0, 1.1, 0.92, 0.4]);
    expect(f.at(3, 110)!.dx).toBeGreaterThan(0);
    expect(f.at(3, 110)!.dx).toBeLessThan(0.15);
    expect(f.at(3, 170)).toBeNull();
  });

  it('a kill pushes 0.3 m and lifts 0.12 m, held 60 ms, easing back over 140 ms', () => {
    const f = new Flinches();
    f.add(3, 0, 0, -1, KILL_FLINCH);
    const p = f.at(3, 60)!;
    expect([p.dx, p.dy, p.dz, p.wide, p.tall, p.glow]).toEqual([0, -0.3, 0.12, 1.15, 0.88, 0.6]);
    expect(f.at(3, 199)).not.toBeNull();
    expect(f.at(3, 200)).toBeNull();
  });

  it('at most 64: a new one on a full list replaces the oldest; a new hit on a flinching enemy restarts it', () => {
    const f = new Flinches();
    for (let s = 0; s < MAX_FLINCHES; s++) f.add(s, 0, 1, 0, HIT_FLINCH);
    f.add(100, 10, 1, 0, HIT_FLINCH);
    expect(f.count).toBe(MAX_FLINCHES);
    expect(f.at(0, 20)).toBeNull();
    expect(f.at(100, 20)).not.toBeNull();
    f.add(5, 100, 1, 0, KILL_FLINCH);
    expect(f.count).toBe(MAX_FLINCHES);
    expect(f.at(5, 250)!.kind).toBe(KILL_FLINCH);
  });
});
