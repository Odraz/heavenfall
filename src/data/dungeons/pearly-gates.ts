/**
 * The Pearly Gates (§8.3): a Lobby and 4 arenas in a snake. The top band runs east (Lobby, Arena 1,
 * Arena 2), the bottom band back west (Arena 3, the boss arena). The route climbs from 0 m to 4.5 m.
 */
import { GridBuilder } from './build';
import type { DungeonDef } from './types';

const g = new GridBuilder(127, 101);
type Cell = readonly [number, number];
const markAll = (ch: string, cells: readonly Cell[]) => cells.forEach(([x, y]) => g.marker(x, y, ch));
const doors = (x0: number, y0: number, x1: number, y1: number): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) out.push([x, y]);
  markAll('D', out);
  return out;
};

// ---------------------------------------------------------------- Lobby (x 2–15, y 15–28), 0 m
g.fillRect(2, 15, 15, 28, 0);
markAll('S', [[5, 18], [12, 18], [5, 25], [12, 25]]);
markAll('c', [[3, 16], [14, 16]]);
markAll('u', [[3, 27], [14, 27]]);
// Corridor to Arena 1.
g.fillRect(16, 20, 23, 23, 0);
markAll('u', [[17, 20], [21, 23]]);

// ---------------------------------------------------------------- Arena 1: Courtyard of Clouds (x 24–63, y 2–41)
// Blessed only. A central 2 m terrace with stairs on all 4 sides, and a 1 m ledge to teach jumping.
g.fillRect(24, 2, 63, 41, 0);
g.fillRect(38, 16, 49, 27, 2);
g.stairs(35, 20, 37, 23, 'E', 0.5, 0.5);
g.stairs(50, 20, 52, 23, 'W', 0.5, 0.5);
g.stairs(42, 13, 45, 15, 'S', 0.5, 0.5);
g.stairs(42, 28, 45, 30, 'N', 0.5, 0.5);
// The ledge: jump onto its north edge, or take the stairs on its east side.
g.fillRect(26, 33, 35, 39, 1);
g.stairs(36, 35, 36, 36, 'E', 0.5, 0.5);
markAll('x', [[26, 4], [44, 3], [61, 4], [61, 21], [61, 39], [44, 40], [28, 30], [43, 21]]);
markAll('u', [[38, 16], [49, 16], [38, 27], [49, 27]]);
markAll('t', [[28, 6], [58, 6], [58, 36], [30, 37], [44, 8]]);
const arena1Doors = doors(23, 20, 23, 23);
const arena1Exit = doors(64, 20, 64, 22);
// Corridor to Arena 2, climbing 3.5 m in 0.25 m steps.
g.fillRect(64, 20, 64, 22, 0);
g.stairs(65, 20, 78, 22, 'E', 0.25, 0.25);
g.fillRect(79, 20, 80, 22, 3.5);
markAll('t', [[68, 20], [76, 22]]);

// ---------------------------------------------------------------- Arena 2: The Cloudbridge (x 81–125, y 2–41)
// Adds Cherubs. A pit 3 m below the doors, crossed by 3 m walkways, with 4 staircases down into it.
g.fillRect(81, 2, 125, 41, 0.5);
g.fillRect(81, 20, 110, 22, 3.5);
g.fillRect(108, 20, 110, 41, 3.5);
g.fillRect(86, 32, 107, 34, 3.5);
g.stairs(88, 23, 90, 27, 'N', 1, 0.5);
g.stairs(100, 15, 102, 19, 'S', 1, 0.5);
g.stairs(111, 28, 115, 30, 'W', 1, 0.5);
g.stairs(81, 32, 85, 34, 'E', 1, 0.5);
// Support columns at the inner corners where routes turn beside the pit. Steering cuts diagonal
// corners (§7.3), and over a drop that walks off the edge; past a wall no diagonal step is allowed.
for (const [x, y] of [[107, 23], [107, 35], [91, 23], [103, 19], [111, 31]] as const) g.pillar(x, y, x, y);
markAll('x', [[84, 4], [122, 4], [122, 39], [84, 39], [100, 10], [95, 21], [109, 38], [100, 33]]);
markAll('h', [[84, 20], [92, 22], [100, 20], [106, 22], [110, 26], [108, 36], [96, 34]]);
const arena2Doors = doors(80, 20, 80, 22);
const arena2Exit = doors(108, 42, 110, 42);
// Corridor south to Arena 3.
g.fillRect(108, 42, 110, 50, 3.5);
g.fillRect(108, 51, 110, 51, 3.75);
g.fillRect(108, 52, 110, 53, 4);
markAll('c', [[108, 45], [110, 49]]);

// ---------------------------------------------------------------- Arena 3: Cloister of Hymns (x 76–125, y 54–93)
// Adds Choristers. A nave at 4 m with pillars to break line of sight, and 3 m galleries on both sides.
g.fillRect(76, 54, 125, 93, 4);
g.fillRect(76, 54, 81, 78, 7);
g.fillRect(120, 54, 125, 93, 7);
g.stairs(82, 58, 86, 60, 'W', 4.5, 0.5);
g.stairs(82, 72, 86, 74, 'W', 4.5, 0.5);
g.stairs(115, 60, 119, 62, 'E', 4.5, 0.5);
g.stairs(115, 84, 119, 86, 'E', 4.5, 0.5);
for (const x of [90, 98, 106, 112]) for (const y of [63, 73, 83]) g.pillar(x, y, x + 1, y + 1);
markAll('x', [[84, 56], [117, 56], [117, 92], [84, 92], [100, 92], [78, 56], [123, 56], [123, 92], [78, 70]]);
markAll('c', [[94, 58], [102, 58], [94, 90], [102, 90], [110, 78], [88, 68], [79, 64], [122, 75]]);
const arena3Doors = doors(108, 53, 110, 53);
const arena3Exit = doors(75, 85, 75, 88);
// Corridor west to the boss arena.
g.fillRect(70, 85, 75, 88, 4);
g.fillRect(70, 85, 70, 88, 4.25);
g.fillRect(66, 85, 69, 88, 4.5);
markAll('c', [[73, 85], [68, 88]]);

// ---------------------------------------------------------------- Arena 4: The Gate (x 6–65, y 50–99)
// Main floor 4.5 m, terraces at 6 m (north) and 7.5 m (south), the Gatekeeper's 7.5 m dais in the west,
// and 6 pillars for cover from Judgment.
g.fillRect(6, 50, 65, 99, 4.5);
g.fillRect(9, 71, 16, 78, 7.5);
g.marker(12, 74, 'B');
g.fillRect(28, 50, 58, 57, 6);
g.stairs(40, 58, 43, 59, 'N', 5, 0.5);
g.stairs(52, 58, 55, 59, 'N', 5, 0.5);
g.fillRect(28, 92, 58, 99, 7.5);
g.stairs(40, 87, 43, 91, 'S', 5, 0.5);
for (const x of [24, 34, 44]) for (const y of [64, 84]) g.pillar(x, y, x + 1, y + 1);
// Pedestals for the large decorations, 1.5 m above the floor.
const statues: Cell[] = [[22, 70], [22, 79], [52, 74]];
const fountains: Cell[] = [[40, 74], [56, 64], [56, 85]];
for (const [x, y] of [...statues, ...fountains]) g.fillRect(x, y, x, y, 6);
markAll('a', statues);
markAll('f', fountains);
markAll('x', [[60, 52], [60, 97], [22, 52], [22, 97], [36, 53], [36, 96], [8, 52], [8, 97]]);
const arena4Doors = doors(66, 85, 66, 88);

const grids = g.build();

export const pearlyGates: DungeonDef = {
  id: 'pearly-gates',
  name: 'The Pearly Gates',
  heights: grids.heights,
  markers: grids.markers,
  decor: { c: 'candelabrum', u: 'lily-urn', h: 'harp', t: 'cloud-tuft', a: 'angel-statue', f: 'fountain' },
  arenas: [
    {
      id: 'courtyard',
      name: 'Courtyard of Clouds',
      rect: { x0: 24, y0: 2, x1: 63, y1: 41 },
      doors: arena1Doors,
      exitDoors: arena1Exit,
      entryCells: [[25, 21], [25, 22], [26, 21], [26, 22]],
      waves: [
        { blessed: 150, choristers: 0, cherubs: 0 },
        { blessed: 250, choristers: 0, cherubs: 0 },
      ],
      boss: false,
    },
    {
      id: 'cloudbridge',
      name: 'The Cloudbridge',
      rect: { x0: 81, y0: 2, x1: 125, y1: 41 },
      doors: arena2Doors,
      exitDoors: arena2Exit,
      entryCells: [[81, 20], [81, 21], [81, 22], [82, 21]],
      waves: [
        { blessed: 250, choristers: 0, cherubs: 15 },
        { blessed: 350, choristers: 0, cherubs: 25 },
      ],
      boss: false,
    },
    {
      id: 'cloister',
      name: 'Cloister of Hymns',
      rect: { x0: 76, y0: 54, x1: 125, y1: 93 },
      doors: arena3Doors,
      exitDoors: arena3Exit,
      entryCells: [[108, 54], [109, 54], [110, 54], [109, 55]],
      waves: [
        { blessed: 300, choristers: 20, cherubs: 20 },
        { blessed: 450, choristers: 40, cherubs: 30 },
      ],
      boss: false,
    },
    {
      id: 'gate',
      name: 'The Gate',
      rect: { x0: 6, y0: 50, x1: 65, y1: 99 },
      doors: arena4Doors,
      entryCells: [[64, 86], [64, 87], [63, 86], [63, 87]],
      waves: [{ blessed: 0, choristers: 10, cherubs: 10 }],
      boss: true,
    },
  ],
};
