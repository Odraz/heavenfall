import { describe, expect, it } from 'vitest';
import { ATTACK_PRIMARY, ATTACK_SECONDARY } from '../data/weapons';
import { altLevel, attackTilt, cylinderBlur, glowLevel, hammerAngle, HealFade, layerOpacities, recoilTilt, Sway, Tilt, transformPoint, WeaponLight } from './fpWeapon';

describe('recoil tilt (M11 §3.2)', () => {
  it('is T at the shot, T/4 at D/2 and 0 from D, with D = min(interval, 250 ms)', () => {
    // The shotgun: 0.8 s, so D = 250 ms.
    expect(recoilTilt(4, 0, 800)).toBe(4);
    expect(recoilTilt(4, 125, 800)).toBeCloseTo(1);
    expect(recoilTilt(4, 250, 800)).toBe(0);
    expect(recoilTilt(4, 400, 800)).toBe(0);
    // The Chain Gun: 1/12 s.
    const cg = 1000 / 12;
    expect(recoilTilt(0.8, cg / 2, cg)).toBeCloseTo(0.2);
    expect(recoilTilt(0.8, cg, cg)).toBe(0);
    // The revolver in a Field of Blood: 0.15 s.
    expect(recoilTilt(6, 75, 150)).toBeCloseTo(1.5);
    expect(recoilTilt(6, 150, 150)).toBe(0);
  });

  it('is 0 before any shot', () => {
    expect(recoilTilt(4, -Infinity, 800)).toBe(0);
    expect(recoilTilt(4, Infinity, 800)).toBe(0);
  });

  it("takes the table's values, and the Chain Gun's sign alternates", () => {
    expect(attackTilt('fallen', ATTACK_PRIMARY).deg).toBe(4);
    expect(attackTilt('fallen', ATTACK_SECONDARY).deg).toBe(6);
    expect(attackTilt('heretic', ATTACK_PRIMARY).deg).toBe(5);
    expect(attackTilt('betrayer', ATTACK_PRIMARY).deg).toBe(6);
    expect(attackTilt('betrayer', ATTACK_SECONDARY).deg).toBe(9);
    const cg = attackTilt('binder', ATTACK_PRIMARY);
    expect(cg).toEqual({ deg: 0.8, alternate: true });
    const t = new Tilt();
    const signs = [0, 1, 2, 3].map(() => {
      t.shot(cg.deg, cg.alternate);
      return t.T;
    });
    expect(signs).toEqual([0.8, -0.8, 0.8, -0.8]);
    t.shot(6, false);
    expect(t.T).toBe(6);
  });
});

describe('the muzzle transform (M11 §3.2)', () => {
  it('leaves the muzzle in place with no tilt and no offsets', () => {
    expect(transformPoint([300, 1300], [800, 2100], 0, 0, 0)).toEqual([300, 1300]);
  });

  it('turns clockwise: 100 px left of the pivot at 90° lands 100 px above it', () => {
    const [x, y] = transformPoint([700, 2000], [800, 2000], 90, 0, 0);
    expect(x).toBeCloseTo(800);
    expect(y).toBeCloseTo(1900);
  });

  it('lifts a muzzle up and to the left of the pivot for a positive tilt', () => {
    expect(transformPoint([300, 1300], [800, 2100], 5, 0, 0)[1]).toBeLessThan(1300);
  });

  it('adds the offsets as given', () => {
    const [x, y] = transformPoint([300, 1300], [800, 2100], 0, 12, -7);
    expect(x).toBe(312);
    expect(y).toBe(1293);
  });
});

describe('sway (M11 §3.2)', () => {
  it('lags behind the turn: right gives negative x, up gives positive y', () => {
    const s = new Sway();
    for (let i = 0; i < 100; i++) s.update(1 / 60, 100, 100, false, false);
    expect(s.x).toBeCloseTo(-0.6);
    expect(s.y).toBeCloseTo(0.4);
  });

  it('clamps at its limits', () => {
    const s = new Sway();
    for (let i = 0; i < 100; i++) s.update(1 / 60, -10000, -10000, false, false);
    expect(s.x).toBeCloseTo(2);
    expect(s.y).toBeCloseTo(-1.5);
  });

  it('eases to 63% of a step in 0.08 s', () => {
    const s = new Sway();
    s.update(0.08, 100, 0, false, false);
    expect(s.x / -0.6).toBeCloseTo(1 - Math.exp(-1));
  });

  it('is 0 after a teleport and while dead', () => {
    const s = new Sway();
    s.update(1, 100, 100, false, false);
    s.update(1 / 60, 100, 100, false, true);
    expect([s.x, s.y]).toEqual([0, 0]);
    s.update(1, 100, 100, true, false);
    expect([s.x, s.y]).toEqual([0, 0]);
  });
});

describe('glow (M11 §3.3)', () => {
  it('breathes within 0.2–0.5 while idle', () => {
    for (let t = 0; t < 2400; t += 50) {
      const g = glowLevel(t, Infinity);
      expect(g).toBeGreaterThanOrEqual(0.2 - 1e-9);
      expect(g).toBeLessThanOrEqual(0.5 + 1e-9);
    }
  });

  it('is 1 at a shot and the idle value from 300 ms', () => {
    expect(glowLevel(1000, 0)).toBe(1);
    expect(glowLevel(1000, 300)).toBe(glowLevel(1000, Infinity));
  });
});

describe('alt frames (M11 §3.4)', () => {
  it("the Heretic's empty launcher: the fresh censer fades in over 0.5–0.8 of the interval", () => {
    expect(altLevel('empty', 0, 1000)).toBe(1);
    expect(altLevel('empty', 499, 1000)).toBe(1);
    expect(altLevel('empty', 650, 1000)).toBeCloseTo(0.5);
    expect(altLevel('empty', 800, 1000)).toBeCloseTo(0);
    // In a Field of Blood.
    expect(altLevel('empty', 400, 500)).toBeCloseTo(0);
    // Sacrament never shoots.
    expect(altLevel('empty', Infinity, 1000)).toBe(0);
  });

  it("the Binder's spin: 1 for 150 ms, gone 100 ms later", () => {
    expect(altLevel('spin', 149, 83)).toBe(1);
    expect(altLevel('spin', 200, 83)).toBeCloseTo(0.5);
    expect(altLevel('spin', 250, 83)).toBe(0);
  });

  it("the Fallen's pump: a hard cut in at 0.3 and out at 0.6 of the interval", () => {
    expect(altLevel('pump', 290, 1000)).toBe(0);
    expect(altLevel('pump', 310, 1000)).toBe(1);
    expect(altLevel('pump', 590, 1000)).toBe(1);
    expect(altLevel('pump', 610, 1000)).toBe(0);
  });
});

describe('hammer and cylinder (M11 §3.8)', () => {
  it('the hammer is down to 45 ms, a quarter at 90 ms and cocked from 135 ms at 300 ms', () => {
    expect(hammerAngle(30, 0, 300)).toBe(30);
    expect(hammerAngle(30, 45, 300)).toBe(30);
    expect(hammerAngle(30, 90, 300)).toBeCloseTo(7.5);
    expect(hammerAngle(30, 135, 300)).toBe(0);
    expect(hammerAngle(30, 200, 300)).toBe(0);
    expect(hammerAngle(30, Infinity, 300)).toBe(0);
  });

  it('the cylinder blur rises, holds and falls over 45–135 ms at 300 ms', () => {
    expect(cylinderBlur(45, 300)).toBe(0);
    expect(cylinderBlur(55.5, 300)).toBeCloseTo(0.5);
    expect(cylinderBlur(66, 300)).toBeCloseTo(1);
    expect(cylinderBlur(105, 300)).toBe(1);
    expect(cylinderBlur(120, 300)).toBeCloseTo(0.5);
    expect(cylinderBlur(135, 300)).toBe(0);
  });

  it('halving the interval halves every time', () => {
    for (const t of [20, 45, 55.5, 66, 90, 105, 120, 135]) {
      expect(hammerAngle(30, t / 2, 150)).toBeCloseTo(hammerAngle(30, t, 300));
      expect(cylinderBlur(t / 2, 150)).toBeCloseTo(cylinderBlur(t, 300));
    }
  });
});

describe('the healing censer (M11 §3.9)', () => {
  it('rises over 150 ms and falls over 300 ms', () => {
    const h = new HealFade();
    h.set(true, 1000);
    expect(h.value(1075)).toBeCloseTo(0.5);
    expect(h.value(1150)).toBe(1);
    expect(h.value(5000)).toBe(1);
    h.set(false, 2000);
    expect(h.value(2150)).toBeCloseTo(0.5);
    expect(h.value(2300)).toBe(0);
  });

  it('a stop halfway through the rise falls from where it was', () => {
    const h = new HealFade();
    h.set(true, 0);
    h.set(false, 75);
    expect(h.value(75)).toBeCloseTo(0.5);
    expect(h.value(150)).toBeCloseTo(0.25);
    expect(h.value(225)).toBe(0);
  });

  it('the green censer shows h (1 − a), the orange glow g (1 − a)(1 − h)', () => {
    const o = layerOpacities(0.8, 0.25, 0.5);
    expect(o.censer).toBeCloseTo(0.375);
    expect(o.idleGlow).toBeCloseTo(0.8 * 0.75 * 0.5);
    expect(o.censerGlow).toBeCloseTo(0.8 * 0.5 * 0.75);
    expect(o.altGlow).toBeCloseTo(0.2);
  });
});

describe('light (M11 §3.5)', () => {
  it('is 1.0 in full light and 0.85 at L = 0', () => {
    const l = new WeaponLight();
    l.reset(1);
    expect(l.b).toBeCloseTo(1);
    l.reset(0);
    expect(l.b).toBeCloseTo(0.85);
  });

  it('eases with a 0.25 s time constant, and is not rewritten for changes under 0.005', () => {
    const l = new WeaponLight();
    l.reset(1);
    expect(l.update(0, 1)).toBeCloseTo(1);
    l.update(0.25, 0);
    expect((1 - l.b) / 0.15).toBeCloseTo(1 - Math.exp(-1));
    // Nearly there: the remaining steps are each under 0.005.
    const m = new WeaponLight();
    m.reset(1);
    m.update(0, 1);
    expect(m.update(1 / 60, 0.99)).toBeNull();
  });
});
