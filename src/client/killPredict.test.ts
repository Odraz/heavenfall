/** M12 stage 3: your kills, at once (M12 §4.4, §11.1); from the enemies' HP since netcode stage 3. */
import { describe, expect, it } from 'vitest';
import { BLESSED, CHERUB, CHORISTER, GATEKEEPER, WATCHMAN } from '../data/enemies';
import { SECONDARIES, SHOTGUN_CLOSE_DAMAGE, WEAPONS } from '../data/weapons';
import { CONFIRM_MS, Flinches, HIT_FLINCH, KILL_FLINCH, KillConfirmations, ladderRate, MAX_FLINCHES, OWN_DAMAGE_MS, OwnDamage, PredictedKills, predictHit, predictPellets, predictSilverBullet, SHOTGUN_FAR_DAMAGE, type BulletTarget, type PelletTarget } from './killPredict';

const target = (i: number, type: number, hp: number, o: Partial<PelletTarget> = {}): PelletTarget => ({ i, t: 1 + i, type, hp, factor: 1, close: false, ...o });

describe('predicted kills (M12 §4.4, netcode stage 3)', () => {
  it('a revolver hit on a full Blessed predicts a burst; on a hurt Watchman a kill', () => {
    expect(predictHit(BLESSED, 20, WEAPONS.betrayer.damage)).toBe(2);
    expect(predictHit(WATCHMAN, 80, WEAPONS.betrayer.damage)).toBe(0);
    expect(predictHit(WATCHMAN, 20, WEAPONS.betrayer.damage)).toBe(1);
  });

  it('a Chain Gun bullet kills a Blessed another bullet already hurt', () => {
    expect(predictHit(BLESSED, 20, WEAPONS.binder.damage)).toBe(0);
    expect(predictHit(BLESSED, 8, WEAPONS.binder.damage)).toBe(1);
  });

  it('the kill takes the HP left; a burst needs 2× the max HP, or a Scourge or a close shotgun pellet', () => {
    expect(predictHit(BLESSED, 20, 20)).toBe(1);
    expect(predictHit(BLESSED, 20, 19)).toBe(0);
    expect(predictHit(BLESSED, 5, 20)).toBe(1);
    expect(predictHit(BLESSED, 20, SECONDARIES.binder.damage, 1, true)).toBe(2);
  });

  it('the factor doubles on a rooted enemy and cuts to 0.2 through a hymnal', () => {
    expect(predictHit(BLESSED, 20, 10)).toBe(0);
    expect(predictHit(BLESSED, 20, 10, 2)).toBe(1);
    expect(predictHit(BLESSED, 20, 20, 2)).toBe(2);
    expect(predictHit(CHORISTER, 60, 100, 0.2)).toBe(0);
  });

  it('never the Gatekeeper, nor an enemy the host has dead (no HP)', () => {
    expect(predictHit(GATEKEEPER, 1, 1e9, 1, true)).toBe(0);
    expect(predictHit(BLESSED, 0, 60)).toBe(0);
    expect(predictHit(CHORISTER, 60, 59)).toBe(0);
    expect(predictHit(CHORISTER, 60, 60)).toBe(1);
  });

  it('a pellet within 6 m predicts a burst; beyond 6 m one pellet hurts, and two kill (M12 §5.1)', () => {
    expect(SHOTGUN_CLOSE_DAMAGE).toBe(25);
    expect(SHOTGUN_FAR_DAMAGE).toBe(10);
    const near = [target(0, BLESSED, 20, { close: true })], far = [target(0, BLESSED, 20)];
    expect(predictPellets([near], SHOTGUN_FAR_DAMAGE, 1, 'shotgun', SHOTGUN_CLOSE_DAMAGE)[0][0]).toMatchObject({ result: 2, dealt: 20 });
    expect(predictPellets([far], SHOTGUN_FAR_DAMAGE, 1, 'shotgun', SHOTGUN_CLOSE_DAMAGE)[0][0]).toMatchObject({ result: 0, dealt: 10 });
    const two = predictPellets([far, far], SHOTGUN_FAR_DAMAGE, 1, 'shotgun', SHOTGUN_CLOSE_DAMAGE);
    expect(two.map((hits) => hits.map((h) => [h.result, h.dealt]))).toEqual([[[0, 10]], [[1, 10]]]);
  });

  it('three far pellets on a Cherub: the third kills it, and later pellets pass it', () => {
    const line = [target(0, CHERUB, 30), target(1, BLESSED, 20)];
    const shot = predictPellets(Array(5).fill(line), SHOTGUN_FAR_DAMAGE, 1, 'shotgun', SHOTGUN_CLOSE_DAMAGE);
    expect(shot.map((hits) => hits.map((h) => [h.target.i, h.result]))).toEqual([[[0, 0]], [[0, 0]], [[0, 1]], [[1, 0]], [[1, 1]]]);
  });

  it('within one shot, pellets pass an enemy an earlier pellet killed: 8 pellets into a packed column predict 8 kills', () => {
    const column = Array.from({ length: 10 }, (_, i) => target(i, BLESSED, 20, { close: true }));
    const shot = predictPellets(Array(8).fill(column), SHOTGUN_FAR_DAMAGE, 1, 'shotgun', SHOTGUN_CLOSE_DAMAGE);
    expect(shot.map((hits) => hits.map((h) => [h.target.i, h.result]))).toEqual(Array.from({ length: 8 }, (_, k) => [[k, 2]]));
  });

  it('Barbed Rounds: one Chain Gun bullet hurts the first two, whether or not the first dies', () => {
    const line = [target(0, BLESSED, 8), target(1, BLESSED, 20), target(2, BLESSED, 20)];
    const [hits] = predictPellets([line], WEAPONS.binder.damage, 2, 'other');
    expect(hits.map((h) => [h.target.i, h.result, h.dealt])).toEqual([[0, 1, 8], [1, 0, 12]]);
  });

  it('a Silver Bullet through 10 Blessed predicts 10 kills, the first 9 as bursts (carried 200 down to 40), not the 10th (20)', () => {
    const line: BulletTarget[] = Array.from({ length: 10 }, () => ({ type: BLESSED, hp: 20, factor: 1, rooted: false, half: false }));
    const r = predictSilverBullet(line, SECONDARIES.betrayer.damage);
    expect(r.stopped).toBe(true);
    expect(r.hits.map((h) => h.result)).toEqual([2, 2, 2, 2, 2, 2, 2, 2, 2, 1]);
  });

  it('a Silver Bullet reaches further through hurt enemies, and a bound one costs half', () => {
    const at = (hp: number, rooted = false): BulletTarget => ({ type: CHORISTER, hp, factor: rooted ? 2 : 1, rooted, half: false });
    const r = predictSilverBullet([at(10), at(10), at(60, true), at(60), at(60)], SECONDARIES.betrayer.damage);
    // It carries 200, 190, 180 (the bound one costs 30), 150 and 90: a burst while 120 or more reaches each.
    expect(r.hits.map((h) => [h.result, h.dealt])).toEqual([[2, 10], [2, 10], [2, 60], [2, 60], [1, 60]]);
    expect(r.stopped).toBe(false);
    const short = predictSilverBullet([at(60), at(60), at(60), at(60)], SECONDARIES.betrayer.damage);
    expect(short.hits.map((h) => [h.result, h.dealt])).toEqual([[2, 60], [2, 60], [1, 60], [0, 20]]);
    expect(short.stopped).toBe(true);
  });
});

describe('own damage waiting for the host (netcode stage 3)', () => {
  it('adds up per enemy incarnation until a snapshot shows its shot resolved', () => {
    const d = new OwnDamage();
    d.add(10, 4, 7, 10, 0);
    d.add(11, 4, 7, 10, 10);
    d.add(11, 5, 1, 12, 10);
    expect(d.pending(4, 7)).toBe(20);
    expect(d.pending(4, 8)).toBe(0);
    d.settle(10, 50);
    expect(d.pending(4, 7)).toBe(10);
    d.settle(11, 60);
    expect([d.pending(4, 7), d.pending(5, 1), d.count]).toEqual([0, 0, 0]);
  });

  it('counts across the counter wrapping at 256, and a resolved counter behind a shot keeps it', () => {
    const d = new OwnDamage();
    d.add(255, 1, 1, 5, 0);
    d.add(0, 1, 1, 6, 0);
    d.add(1, 1, 1, 7, 0);
    d.settle(254, 1);
    expect(d.pending(1, 1)).toBe(18);
    d.settle(0, 2);
    expect(d.pending(1, 1)).toBe(7);
  });

  it('forgets a shot the host never resolves after OWN_DAMAGE_MS; zero damage is not kept', () => {
    const d = new OwnDamage();
    d.add(3, 1, 1, 0, 0);
    expect(d.count).toBe(0);
    d.add(3, 1, 1, 9, 0);
    d.settle(2, OWN_DAMAGE_MS);
    expect(d.pending(1, 1)).toBe(9);
    d.settle(2, OWN_DAMAGE_MS + 1);
    expect(d.pending(1, 1)).toBe(0);
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

describe('kill marker confirmations (netcode stage)', () => {
  it('confirms a predicted kill whose enemy leaves the snapshots, and misses one still there after 1.5 s', () => {
    const c = new KillConfirmations();
    const present = new Set([1, 2]);
    c.add(1, 0);
    c.add(2, 0);
    c.add(2, 100);
    expect(c.predicted).toBe(2);
    present.delete(1);
    c.update(200, (s) => present.has(s));
    expect([c.confirmed, c.missed]).toEqual([1, 0]);
    c.update(100 + CONFIRM_MS, (s) => present.has(s));
    expect(c.missed).toBe(0);
    c.update(101 + CONFIRM_MS, (s) => present.has(s));
    expect([c.confirmed, c.missed]).toEqual([1, 1]);
  });
});
