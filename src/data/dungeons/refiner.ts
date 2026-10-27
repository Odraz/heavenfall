/** Authored Gridiron geometry with a short explicit dev pressure wave. */
import { trials } from '../rooms/1/pg-c-1x1-hazard-01';
import { ROOM_DECOR } from '../../gen/stamp';
import type { DungeonDef, Quad } from './types';
const hg = [...Array.from({ length: 6 }, () => '#'.repeat(34)), ...trials.heights.map((r) => `#${r}#`), '#'.repeat(34)].map((r) => r.split(''));
const markers = [...Array.from({ length: 6 }, () => '.'.repeat(34)), ...trials.markers.map((r) => `.${r}.`), '.'.repeat(34)].map((r) => r.split(''));
for (let y = 1; y <= 4; y++) for (let x = 11; x <= 20; x++) hg[y][x] = '8';
const doors: Array<[number, number]> = [[13, 5], [14, 5], [15, 5], [16, 5]];
for (const [x, y] of doors) { hg[y][x] = '8'; markers[y][x] = 'D'; }
for (let x = 13; x <= 16; x++) markers[2][x] = 'S';
const entry: Quad = [[13, 9], [14, 9], [15, 9], [16, 9]];
export const refinerLab: DungeonDef = {
  id: 'refiner', name: "Refiner's Fire encounter", heights: hg.map((r) => r.join('')), markers: markers.map((r) => r.join('')), decor: ROOM_DECOR,
  rooms: [{ id: trials.id, name: trials.name, kind: 'combat', rect: { x0: 1, y0: 6, x1: 32, y1: 37 },
    leaves: [{ socket: 0, to: -1, cells: doors }], entry: [{ socket: 0, cells: entry }], boss: false, shape: '1x1', band: 2, focus: 'hazard', templateId: trials.id,
    hazards: trials.hazards.map((z) => ({ hazard: z.hazard, rect: { x0: z.rect.x0 + 1, y0: z.rect.y0 + 6, x1: z.rect.x1 + 1, y1: z.rect.y1 + 6 } })),
    waves: [{ blessed: 60, choristers: 4, cherubs: 0 }] }],
};
