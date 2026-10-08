/** M12 stage 3: screen shake (M12 §4.5, §11.1). */
import { describe, expect, it } from 'vitest';
import { envelope, massKillShake, Shake, SHAKE_BLASPHEMY, SHAKE_CAP, SHAKE_LANDING, SHAKE_SHROUD } from './shake';

/** Noise that always picks +1, so each axis shows its full amplitude. */
const full = () => 1;

describe('screen shake (M12 §4.5)', () => {
  it('the amplitudes and decays', () => {
    expect(SHAKE_LANDING).toEqual({ amp: 1.6, decay: 350, dip: 1.2 });
    expect(SHAKE_SHROUD).toEqual({ amp: 0.7, decay: 200, dip: 0 });
    expect(SHAKE_BLASPHEMY).toEqual({ amp: 0.5, decay: 200, dip: 0 });
    expect(massKillShake(6).amp).toBeCloseTo(0.5);
    expect(massKillShake(16).amp).toBeCloseTo(0.7);
    expect(massKillShake(60).amp).toBe(1);
    expect(massKillShake(6).decay).toBe(180);
  });

  it('the squared envelope', () => {
    expect(envelope(1.6, 350, 0)).toBeCloseTo(1.6);
    expect(envelope(1.6, 350, 175)).toBeCloseTo(0.4);
    expect(envelope(1.6, 350, 350)).toBe(0);
  });

  it('starts from the center, then yaw and pitch reach the envelope, roll 0.6× of it; the landing also dips the pitch down', () => {
    const s = new Shake(() => true, full);
    s.add(0, SHAKE_BLASPHEMY);
    expect(s.sample(0)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    const e = envelope(0.5, 200, 30);
    const o = s.sample(30);
    expect([o.yaw, o.pitch, o.roll].map((v) => +v.toFixed(6))).toEqual([e, e, 0.6 * e].map((v) => +v.toFixed(6)));
    const l = new Shake(() => true, full);
    l.add(0, SHAKE_LANDING);
    // At the start the noise is at the center, so only the dip shows.
    expect(l.sample(0).pitch).toBeCloseTo(-1.2);
    expect(l.sample(180).pitch).toBeCloseTo(envelope(1.6, 350, 180) - envelope(1.2, 350, 180));
  });

  it('overlapping shakes add, capped at 2.0°', () => {
    const s = new Shake(() => true, full);
    s.add(0, SHAKE_SHROUD);
    s.add(0, SHAKE_BLASPHEMY);
    s.sample(0);
    expect(s.sample(30).yaw).toBeCloseTo(envelope(0.7, 200, 30) + envelope(0.5, 200, 30));
    // With the landing too, they would add to 2.2° at 30 ms.
    const c = new Shake(() => true, full);
    for (const sh of [SHAKE_SHROUD, SHAKE_BLASPHEMY, SHAKE_LANDING]) c.add(0, sh);
    c.sample(0);
    expect(c.sample(30).yaw).toBeCloseTo(SHAKE_CAP);
  });

  it('noise in −1…1 with new targets every 30 ms, interpolated between them', () => {
    const values = [0, 1, -1, 0.5];
    let i = 0;
    const s = new Shake(() => true, () => (values[i++ % 4] + 1) / 2);
    s.add(0, { amp: 1, decay: 1e9, dip: 0 });
    // Step 0: each axis from the center toward its target (yaw 0, pitch 1, roll −1).
    expect(s.sample(0).pitch).toBeCloseTo(0);
    expect(s.sample(15).pitch).toBeCloseTo(0.5);
    // Step 1 starts where step 0 was heading: pitch from 1 toward its new target, 0.
    expect(s.sample(30).pitch).toBeCloseTo(1);
    expect(s.sample(45).pitch).toBeCloseTo(0.5);
  });

  it('ends after its decay', () => {
    const s = new Shake(() => true, full);
    s.add(0, SHAKE_SHROUD);
    expect(s.sample(200)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
  });

  it('nothing when the setting is off, read when each shake starts', () => {
    let on = false;
    const s = new Shake(() => on, full);
    s.add(0, SHAKE_LANDING);
    expect(s.sample(0)).toEqual({ yaw: 0, pitch: 0, roll: 0 });
    on = true;
    s.add(10, SHAKE_BLASPHEMY);
    expect(s.sample(10).yaw).toBeGreaterThan(0);
  });
});
