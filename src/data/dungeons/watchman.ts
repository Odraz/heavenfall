/** Authored Choir Loft geometry (four nave pillars) with Blessed waves that bring Watchmen from wave 2 (rooms.md §6.4). */
import choirLoft from '../rooms/1/pg-c-1x1-ranged-01';
import { ROOM_DECOR } from '../../gen/stamp';
import type { DungeonDef, Quad } from './types';
const hg = [...Array.from({ length: 6 }, () => '#'.repeat(34)), ...choirLoft.heights.map((r) => `#${r}#`), '#'.repeat(34)].map((r) => r.split(''));
const markers = [...Array.from({ length: 6 }, () => '.'.repeat(34)), ...choirLoft.markers.map((r) => `.${r}.`), '.'.repeat(34)].map((r) => r.split(''));
for (let y = 1; y <= 4; y++) for (let x = 11; x <= 20; x++) hg[y][x] = '8';
const doors: Array<[number, number]> = [[13, 5], [14, 5], [15, 5], [16, 5]];
for (const [x, y] of doors) { hg[y][x] = '8'; markers[y][x] = 'D'; }
for (let x = 13; x <= 16; x++) markers[2][x] = 'S';
const entry: Quad = [[13, 9], [14, 9], [15, 9], [16, 9]];
export const watchmanLab: DungeonDef = {
  id: 'watchman', name: 'The Watchman encounter', heights: hg.map((r) => r.join('')), markers: markers.map((r) => r.join('')), decor: ROOM_DECOR,
  rooms: [{ id: choirLoft.id, name: choirLoft.name, kind: 'combat', rect: { x0: 1, y0: 6, x1: 32, y1: 37 },
    leaves: [{ socket: 0, to: -1, cells: doors }], entry: [{ socket: 0, cells: entry }], boss: false, shape: '1x1', band: 2, focus: 'ranged', templateId: choirLoft.id,
    // More Watchmen than the ranged cap (6, solo 3), so a kill lets the next queued one in.
    waves: [{ blessed: 30, choristers: 0, cherubs: 0 }, { blessed: 40, choristers: 0, cherubs: 0, watchmen: 10 }, { blessed: 60, choristers: 0, cherubs: 0, watchmen: 12 }] }],
};
