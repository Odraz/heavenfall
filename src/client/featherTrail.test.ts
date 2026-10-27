import { describe, expect, it } from 'vitest';
import { FeatherTrails, TRAIL_SPACING } from './featherTrail';

describe('Pilgrim’s Feather trail', () => {
  it('drops one feather per 0.35 m moved, carrying the remainder between frames', () => {
    const trails = new FeatherTrails(); trails.start(1, 1000, { x: 0, y: 0, z: 0 });
    let pos = { x: 0, y: 0, z: 2 };
    const drops: Array<[number, number, number]> = [];
    for (let i = 1; i <= 10; i++) { pos = { x: i * 0.1, y: 0, z: 2 }; drops.push(...trails.step(i, () => pos)); }
    expect(drops.map(([x]) => x)).toEqual([1, 2].map((k) => expect.closeTo(k * TRAIL_SPACING, 6)));
    expect(drops.every(([, y, z]) => y === 0 && z === 2)).toBe(true);
  });
  it('leaves nothing while standing still or across a teleport', () => {
    const trails = new FeatherTrails(); trails.start(1, 1000, { x: 0, y: 0, z: 0 });
    expect(trails.step(1, () => ({ x: 0, y: 0, z: 0 }))).toEqual([]);
    expect(trails.step(2, () => ({ x: 20, y: 0, z: 0 }))).toEqual([]);
    expect(trails.step(3, () => ({ x: 20.4, y: 0, z: 0 }))).toHaveLength(1);
  });
  it('ends when the boost runs out, the player dies or leaves', () => {
    const trails = new FeatherTrails();
    trails.start(1, 100, { x: 0, y: 0, z: 0 }); trails.start(2, 1000, { x: 0, y: 0, z: 0 }); trails.start(3, 1000, { x: 0, y: 0, z: 0 });
    trails.step(100, (id) => id === 2 ? { x: 0, y: 0, z: 0, dead: true } : id === 3 ? undefined : { x: 1, y: 0, z: 0 });
    expect(trails.size).toBe(0);
  });
  it('a reuse refreshes the end instead of adding a second trail', () => {
    const trails = new FeatherTrails();
    trails.start(1, 100, { x: 0, y: 0, z: 0 }); trails.start(1, 500, { x: 0, y: 0, z: 0 });
    expect(trails.size).toBe(1);
    expect(trails.step(200, () => ({ x: 1, y: 0, z: 0 }))).toHaveLength(2);
  });
});
