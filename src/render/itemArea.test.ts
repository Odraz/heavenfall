import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { ITEMS } from '../data/items';
import { makeSim, put, room } from '../sim/testutil/sims';
import { dungeonOf } from '../sim/testutil/maps';
import { FADE_TICKS, ItemArea, LOOKS, SPREAD_TICKS, areaAlpha, areaScale } from './itemArea';
import { ItemView } from '../client/itemView';

function landed(item: 'venom' | 'frost' | 'chain' | 'plume' | 'mirror', heights = room(40, 20)) {
  const dungeon = dungeonOf(heights);
  dungeon.rooms = [{ id: 'items', name: 'Items', kind: 'breach', rect: { x0: 1, y0: 1, x1: heights[0].length - 2, y1: heights.length - 2 },
    leaves: [], entry: [{ socket: 0, cells: [[2, 2], [3, 2], [4, 2], [5, 2]] }], waves: [], boss: false }];
  const sim = makeSim(heights, ['heretic'], { dungeon, noWaves: true, god: true });
  const p = sim.players[0]; put(sim, p, 10.5, 8.5); p.pitch = -Math.PI / 2;
  sim.items.use(p, item);
  for (let i = 0; i < 30 && sim.items.effects.some((e) => e.activatedTick < 0); i++) { sim.tick++; sim.items.update(); }
  return { sim, area: sim.items.effects[0] };
}
const quads = (area: ItemArea) => area.group.children.filter((c): c is THREE.Mesh => c instanceof THREE.Mesh && c.geometry.index !== null && !(c.geometry instanceof THREE.SphereGeometry))
  .reduce((n, m) => n + m.geometry.getAttribute('position').count / 4, 0);

describe('item areas drawn like the Field of Blood', () => {
  it('cover exactly the floor cells the host applies the area to', () => {
    for (const item of ['venom', 'frost', 'chain', 'plume'] as const) {
      const { sim, area } = landed(item);
      const view = new ItemArea(sim.map, item, area.x, area.y, area.z, area.room, area.activatedTick, area.endTick);
      expect(quads(view)).toBe(area.cells.size);
      view.dispose();
    }
  });
  it('stop at a wall like the host area, instead of a full disc', () => {
    const walled = room(40, 20).map((row, y) => y > 0 && y < 19 ? row.slice(0, 13) + '#' + row.slice(14) : row);
    const { sim, area } = landed('venom', walled);
    const view = new ItemArea(sim.map, 'venom', area.x, area.y, area.z, area.room, area.activatedTick, area.endTick);
    expect(quads(view)).toBe(area.cells.size);
    expect([...area.cells].every((i) => i % sim.map.w < 13)).toBe(true);
  });
  it('give each floor item its own look and the Mirror Ward a dome', () => {
    expect(new Set(Object.values(LOOKS)).size).toBe(4);
    expect(Object.keys(LOOKS).sort()).toEqual(Object.entries(ITEMS).filter(([, d]) => d.kind === 'thrown').map(([id]) => id).sort());
    const { sim, area } = landed('mirror');
    const view = new ItemArea(sim.map, 'mirror', area.x, area.y, area.z, area.room, area.activatedTick, area.endTick);
    expect(view.group.children.some((c) => c instanceof THREE.Mesh && c.geometry instanceof THREE.SphereGeometry)).toBe(true);
  });
  it('spread in 0.3 s, fade over the last 0.5 s and end on the host end tick', () => {
    expect(areaScale(100, 100, 280)).toBe(0);
    expect(areaScale(100 + SPREAD_TICKS / 2, 100, 280)).toBeCloseTo(0.5);
    expect(areaScale(150, 100, 280)).toBe(1);
    expect(areaAlpha(280 - FADE_TICKS, 280)).toBe(1);
    expect(areaAlpha(280 - FADE_TICKS / 3, 280)).toBeCloseTo(1 / 3);
    expect(areaAlpha(280, 280)).toBe(0);
    const { sim, area } = landed('frost');
    const view = new ItemArea(sim.map, 'frost', area.x, area.y, area.z, area.room, area.activatedTick, area.endTick);
    view.update(area.endTick - 1); expect(view.group.visible).toBe(true);
    view.update(area.endTick); expect(view.group.visible).toBe(false);
  });
  it('the view replaces a landed area on resync and frees it on removal', () => {
    const { sim } = landed('chain');
    const view = new ItemView(sim.map);
    view.sync(sim.items.records()); view.sync(sim.items.records());
    expect(view.group.children).toHaveLength(1);
    view.remove(sim.items.records()[0].id);
    expect(view.group.children).toHaveLength(0);
  });
});
