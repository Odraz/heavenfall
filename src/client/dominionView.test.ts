import { expect, it } from 'vitest';
import * as THREE from 'three';
import { DominionView, WALL_MAX_HEIGHT, dominionWall } from './dominionView';

it('the golden wall rises and brightens as the tell fills, staying within its bounds', () => {
  let last = dominionWall(0);
  expect(last.height).toBeGreaterThan(0);
  for (let p = 0.1; p <= 1.0001; p += 0.1) {
    const w = dominionWall(p);
    expect(w.height).toBeGreaterThan(last.height);
    expect(w.opacity).toBeGreaterThan(last.opacity);
    last = w;
  }
  expect(dominionWall(1).height).toBeCloseTo(WALL_MAX_HEIGHT);
  expect(dominionWall(5)).toEqual(dominionWall(1));
  expect(dominionWall(1).opacity).toBeLessThanOrEqual(1);
});

it('draws the wall at the accepted ring, scaled by the cast deadline', () => {
  const view = new DominionView();
  const cast = { slot: 1, incarnation: 1, castId: 1, room: 0, startTick: 100, impactTick: 145, x: 10, y: 20, z: 2 } as Parameters<DominionView['update']>[0][number];
  view.update([cast], 145);
  const wall = view.group.getObjectByName('dominion-wall') as THREE.Mesh;
  expect(wall.parent!.visible).toBe(true);
  expect(wall.parent!.position.x).toBe(10); expect(wall.parent!.position.z).toBe(20);
  expect(wall.scale.y).toBeCloseTo(WALL_MAX_HEIGHT);
  view.update([], 146);
  expect(wall.parent!.visible).toBe(false);
  view.dispose();
});
