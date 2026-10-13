/** Scoped encounter fixture: authored Lampstands geometry, short waves for cast checks. */
import { lampstands } from '../rooms/1/pg-c-1x1-elite-01';
import { ROOM_DECOR } from '../../gen/stamp';
import type { DungeonDef, Quad } from './types';

const hg = [...Array.from({ length: 6 }, () => '#'.repeat(34)), ...lampstands.heights.map((r) => `#${r}#`), '#'.repeat(34)].map((r) => r.split(''));
const markers = [...Array.from({ length: 6 }, () => '.'.repeat(34)), ...lampstands.markers.map((r) => `.${r}.`), '.'.repeat(34)].map((r) => r.split(''));
for (let y = 1; y <= 4; y++) for (let x = 11; x <= 20; x++) hg[y][x] = '8';
const doors: Array<[number, number]> = [[13, 5], [14, 5], [15, 5], [16, 5]];
for (const [x, y] of doors) { hg[y][x] = '8'; markers[y][x] = 'D'; }
for (let x = 13; x <= 16; x++) markers[2][x] = 'S';
const entry: Quad = [[13, 9], [14, 9], [15, 9], [16, 9]];
export const dominionLab: DungeonDef = {
  id: 'dominion', name: 'The Dominion encounter', heights: hg.map((r) => r.join('')), markers: markers.map((r) => r.join('')), decor: ROOM_DECOR,
  rooms: [{ id: lampstands.id, name: lampstands.name, kind: 'combat', rect: { x0: 1, y0: 6, x1: 32, y1: 37 },
    leaves: [{ socket: 0, to: -1, cells: doors }], entry: [{ socket: 0, cells: entry }], boss: false, shape: '1x1', band: 2, focus: 'elite', templateId: lampstands.id,
    waves: [{ blessed: 60, choristers: 0, cherubs: 0, dominions: 1 }, { blessed: 80, choristers: 0, cherubs: 0, dominions: 1 }] }],
};
