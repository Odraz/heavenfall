/** Dev-only arrival fixture: close markers, with legal dry floor for the blocked-marker fallback. */
import { GridBuilder } from './build';
import type { DungeonDef } from './types';
const g = new GridBuilder(21, 21);
g.fillRect(1, 2, 4, 9, 0); g.fillRect(5, 4, 5, 7, 0); g.fillRect(6, 1, 19, 19, 0);
for (const [x, y] of [[2, 4], [3, 4], [2, 5], [3, 5]]) g.marker(x, y, 'S');
for (let y = 4; y <= 7; y++) g.marker(5, y, 'D');
for (const x of [13, 14, 15]) for (const y of [5, 6]) g.marker(x, y, 'x');
export const arrivalLab: DungeonDef = { id: 'arrival', name: 'Spawn arrival encounter', ...g.build(), rooms: [{
  id: 'arrival', name: 'Spawn arrival', kind: 'combat', boss: false, shape: '1x1', band: 1, focus: 'ground',
  rect: { x0: 6, y0: 1, x1: 19, y1: 19 }, leaves: [{ socket: 0, to: -1, cells: [[5, 4], [5, 5], [5, 6], [5, 7]] }],
  entry: [{ socket: 0, cells: [[8, 4], [8, 5], [8, 6], [8, 7]] }], waves: [{ blessed: 4, choristers: 0, cherubs: 0 }],
}] };
