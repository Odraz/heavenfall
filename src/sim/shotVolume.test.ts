/** R06 follow-up §5: every enemy's shot volume matches its drawn sprite, so a shot at what you see hits. */
import { describe, expect, it } from 'vitest';
import { BLESSED, CANTOR, CARRIER, CHERUB, CHORISTER, DOMINION, ENEMIES, WATCHMAN } from '../data/enemies';
import { rayEnemy } from './combat';
import blessed from '../../assets/sprites/blessed/atlas.json';
import chorister from '../../assets/sprites/chorister/atlas.json';
import cherub from '../../assets/sprites/cherub/atlas.json';
import dominion from '../../assets/sprites/dominion/atlas.json';
import cantor from '../../assets/sprites/cantor/atlas.json';
import carrier from '../../assets/sprites/carrier/atlas.json';
import watchman from '../../assets/sprites/watchman/atlas.json';

interface Manifest { pxPerMeter: number; anims: Record<string, number[][][]> }
const ATLASES: Array<[string, number, Manifest, string]> = [
  ['Blessed', BLESSED, blessed, 'walk'], ['Chorister', CHORISTER, chorister, 'walk'], ['Cherub', CHERUB, cherub, 'fly'],
  ['Dominion', DOMINION, dominion, 'walk'], ['Cantor', CANTOR, cantor, 'idle'], ['Carrier', CARRIER, carrier, 'fly'], ['Watchman', WATCHMAN, watchman, 'walk'],
];
const median = (v: number[]): number => { const s = [...v].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

/** The main pose's median drawn width, height and bottom (relative to the feet), in meters. */
function drawn(m: Manifest, anim: string, draw: number): { width: number; height: number; bottom: number } {
  const frames = m.anims[anim].flat();
  return {
    width: median(frames.map((f) => f[2] / m.pxPerMeter * draw)),
    height: median(frames.map((f) => f[3] / m.pxPerMeter * draw)),
    bottom: median(frames.map((f) => -f[5] / m.pxPerMeter * draw)),
  };
}

describe('shot volumes', () => {
  it.each(ATLASES)('the %s volume covers its drawn sprite and is never smaller than its body', (_, type, manifest, anim) => {
    const def = ENEMIES[type], d = drawn(manifest, anim, def.draw);
    expect(def.shot.radius).toBeGreaterThanOrEqual(def.radius);
    expect(def.shot.radius).toBeGreaterThanOrEqual(0.35 * d.width - 0.05);
    expect(def.shot.radius).toBeLessThanOrEqual(0.5 * d.width);
    expect(def.shot.top - (d.bottom + d.height)).toBeLessThanOrEqual(0.1);
    expect(def.shot.top - (d.bottom + d.height)).toBeGreaterThanOrEqual(-0.2);
    // Feet sunk a few centimeters into the floor don't count; a real overhang (the Carrier's talons) does.
    expect(Math.abs(def.shot.base - (d.bottom < -0.5 ? d.bottom : 0))).toBeLessThanOrEqual(0.1);
    // A level shot from 20 m at the middle of the drawn sprite, a little off its center line, hits.
    const mid = d.bottom + d.height / 2, side = def.shot.radius * 0.8;
    expect(rayEnemy(-20, side, 10 + mid, 1, 0, 0, type, 0, 0, 10)).toBeLessThan(Infinity);
  });

  it("hits the Carrier's hanging talons, which its old 0.8 m body above the feet missed", () => {
    expect(rayEnemy(-20, 0.9, 10 - 1.5, 1, 0, 0, CARRIER, 0, 0, 10)).toBeCloseTo(20 - Math.sqrt(1.25 ** 2 - 0.9 ** 2), 5);
    expect(rayEnemy(-20, 0, 10 + 2.6, 1, 0, 0, CARRIER, 0, 0, 10)).toBe(Infinity);
  });
});
