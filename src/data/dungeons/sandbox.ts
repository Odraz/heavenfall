/** Sandbox: a small dev-only test map (§8.4). */
import { GridBuilder } from './build';
import type { DungeonDef } from './types';

const g = new GridBuilder(48, 48);

// Start room with the 4 player spawns, and the corridor to the arena door.
g.fillRect(2, 2, 11, 11, 0);
g.marker(4, 4, 'S').marker(9, 4, 'S').marker(4, 9, 'S').marker(9, 9, 'S');
g.fillRect(12, 6, 15, 8, 0);
g.marker(15, 6, 'D').marker(15, 7, 'D').marker(15, 8, 'D');

// The arena.
g.fillRect(16, 2, 45, 45, 0);
// A 2 m terrace with stairs on its west side.
g.fillRect(32, 10, 39, 17, 2);
g.stairs(29, 13, 31, 14, 'E', 0.5, 0.5);
// A 1 m ledge: its north edge can be jumped onto, and stairs on its east side lead up too.
g.fillRect(18, 34, 25, 41, 1);
g.stairs(26, 37, 26, 38, 'E', 0.5, 0.5);
// Pillars.
g.pillar(24, 20, 25, 21);
g.pillar(38, 28, 39, 29);
// 8 enemy spawn points.
for (const [x, y] of [
  [30, 3], [44, 3], [44, 24], [44, 44], [30, 44], [17, 44], [28, 24], [38, 22],
] as const) {
  g.marker(x, y, 'x');
}

const grids = g.build();

export const sandbox: DungeonDef = {
  id: 'sandbox',
  name: 'Sandbox',
  heights: grids.heights,
  markers: grids.markers,
  arenas: [
    {
      id: 'sandbox-arena',
      name: 'Sandbox Arena',
      rect: { x0: 16, y0: 2, x1: 45, y1: 45 },
      doors: [[15, 6], [15, 7], [15, 8]],
      entryCells: [[17, 6], [17, 8], [18, 7], [17, 7]],
      waves: [{ blessed: 1000, choristers: 20, cherubs: 20 }],
      boss: false,
    },
  ],
};
