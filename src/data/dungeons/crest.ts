/** Authored Courtyard geometry; a short dev wave followed by its 1200-at-four crest. */
import courtyard from '../rooms/1/pg-c-2x2-horde-flyers-01';
import { ROOM_DECOR } from '../../gen/stamp';
import type { DungeonDef } from './types';
const width = courtyard.heights[0].length + 2;
const heights = [...Array.from({ length: 6 }, () => '#'.repeat(width)), ...courtyard.heights.map((r) => `#${r}#`), '#'.repeat(width)].map((r) => r.split(''));
const markers = [...Array.from({ length: 6 }, () => '.'.repeat(width)), ...courtyard.markers.map((r) => `.${r}.`), '.'.repeat(width)].map((r) => r.split(''));
for (let y = 1; y <= 4; y++) for (let x = 11; x <= 20; x++) heights[y][x] = '8';
const doors: Array<[number, number]> = [[13, 5], [14, 5], [15, 5], [16, 5]];
for (const [x, y] of doors) { heights[y][x] = '8'; markers[y][x] = 'D'; }
for (let x = 13; x <= 16; x++) markers[2][x] = 'S';
export const crestLab: DungeonDef = { id: 'crest', name: 'Crest transport encounter', heights: heights.map((r) => r.join('')), markers: markers.map((r) => r.join('')), decor: ROOM_DECOR,
  rooms: [{ id: courtyard.id, name: courtyard.name, kind: 'combat', boss: false, shape: '2x2', band: 2, focus: 'horde',
    rect: { x0: 1, y0: 6, x1: width - 2, y1: heights.length - 2 }, leaves: [{ socket: 0, to: -1, cells: doors }],
    entry: [{ socket: 0, cells: [[13, 9], [14, 9], [15, 9], [16, 9]] }], templateId: courtyard.id,
    waves: [{ blessed: 20, choristers: 0, cherubs: 0 }, { blessed: 1200, choristers: 0, cherubs: 0 }] }],
};
