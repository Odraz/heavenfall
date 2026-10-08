/** M12 stage 4: Shadowstep's first-person slash (M12 §5.7). */
import { describe, expect, it } from 'vitest';
import manifest from '../../assets/sprites/weapon-betrayer/weapon.json';
import { SLASH_DROP, SLASH_MS, slashGunDrop, slashPose, slashTip, SMEAR_FADE_MS, SMEAR_LENGTH, SMEAR_WIDTH, smearOutline, type SlashDagger } from './fpWeapon';

const dagger = manifest.slash as SlashDagger;

describe("Shadowstep's slash (M12 §5.7)", () => {
  it('sweeps the fist from right to left over 200 ms by smoothstep, turning from +25° to −15°, fading in over 30 ms and out over 40', () => {
    expect(slashPose(0)).toMatchObject({ x: 40, y: 22, angle: 25, opacity: 0 });
    const mid = slashPose(100)!;
    expect(mid.x).toBeCloseTo(0, 9);
    expect(mid.y).toBeCloseTo(14, 9);
    expect(mid.angle).toBeCloseTo(5, 9);
    expect(mid.opacity).toBe(1);
    expect(slashPose(15)!.opacity).toBeCloseTo(0.5, 9);
    expect(slashPose(180)!.opacity).toBeCloseTo(0.5, 9);
    expect(slashPose(SLASH_MS)).toBeNull();
    expect(slashPose(-1)).toBeNull();
  });

  it("keeps the blade's tip on a 16:9 screen at its start, middle and end", () => {
    for (const t of [0, 100, SLASH_MS - 1]) {
      const [x, y] = slashTip(dagger, slashPose(t)!);
      expect(Math.abs(x)).toBeLessThan(88.9);
      expect(Math.abs(y)).toBeLessThan(50);
    }
  });

  it('drops the revolver 30 vh over 60 ms, and raises it back over 120 ms after the slash', () => {
    expect(slashGunDrop(-1)).toBe(0);
    expect(slashGunDrop(30)).toBeCloseTo(15, 9);
    expect(slashGunDrop(60)).toBe(SLASH_DROP);
    expect(slashGunDrop(199)).toBe(SLASH_DROP);
    expect(slashGunDrop(SLASH_MS + 60)).toBeCloseTo(15, 9);
    expect(slashGunDrop(SLASH_MS + 120)).toBe(0);
  });

  it("the smear follows the tip's path, at most 40 vh of it, 2.5 vh wide at the tip, fading over 80 ms after the slash", () => {
    const s = smearOutline(dagger, 150)!;
    expect(s.opacity).toBe(1);
    const n = s.points.length / 2;
    const left = s.points.slice(0, n);
    const right = s.points.slice(n).reverse();
    const tip = slashTip(dagger, slashPose(150)!);
    expect(Math.hypot(left[0][0] - right[0][0], left[0][1] - right[0][1])).toBeCloseTo(SMEAR_WIDTH, 6);
    // The middle of the first pair is the tip; the outline tapers to nothing within 40 vh of path.
    expect((left[0][0] + right[0][0]) / 2).toBeCloseTo(tip[0], 6);
    let length = 0;
    for (let i = 1; i < n; i++) length += Math.hypot((left[i][0] + right[i][0] - left[i - 1][0] - right[i - 1][0]) / 2, (left[i][1] + right[i][1] - left[i - 1][1] - right[i - 1][1]) / 2);
    expect(length).toBeLessThanOrEqual(SMEAR_LENGTH + 2);
    expect(length).toBeGreaterThan(SMEAR_LENGTH - 5);
    expect(smearOutline(dagger, SLASH_MS + SMEAR_FADE_MS / 2)!.opacity).toBeCloseTo(0.5, 9);
    expect(smearOutline(dagger, SLASH_MS + SMEAR_FADE_MS)).toBeNull();
  });
});
