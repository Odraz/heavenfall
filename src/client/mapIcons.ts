/** Shared, shape-distinct code glyphs for the map and door frames (rogue game.md §5.2). */
import type { RoomDef } from '../data/dungeons/types';

// Coordinates in a 24 × 24 square. One compound Path2D per icon, cached on first draw.
export const ICON_PATHS = {
  // An arched doorway with an arrow walking in: where the run starts (audit batch 2).
  breach: 'M4 23L4 10Q4 2 12 2Q20 2 20 10L20 23M12 20L12 9M8 13L12 9L16 13',
  pardoner: 'M12 2A10 10 0 1 0 12 22A10 10 0 1 0 12 2M12 6A6 6 0 1 0 12 18A6 6 0 1 0 12 6M9 12L15 12',
  confessional: 'M2 12Q12 2 22 12Q12 22 2 12ZM12 8A4 4 0 1 0 12 16A4 4 0 1 0 12 8M5 8L3 3L9 6M15 6L21 3L19 8M8 3L8 21M16 3L16 21M2 12L22 12',
  reliquary: 'M3 10L21 10L21 21L3 21ZM3 10Q3 3 12 3Q21 3 21 10M9 10L9 21M15 10L15 21M10 12L14 12L14 16L10 16Z',
  boss: 'M2 10L10 10L20 4L20 20L10 14L2 14ZM7 14L7 20L13 20L13 15M11 6L11 10M15 4L15 8',
  key: 'M7 3A5 5 0 1 0 7 13A5 5 0 1 0 7 3M11 11L21 21L23 19M16 16L19 13',
  horde: 'M5 5A3 3 0 1 0 5 11A3 3 0 1 0 5 5M12 2A3 3 0 1 0 12 8A3 3 0 1 0 12 2M19 5A3 3 0 1 0 19 11A3 3 0 1 0 19 5M1 21L1 16Q5 11 9 16L9 21M9 21L9 13Q12 9 15 13L15 21M15 21L15 16Q19 11 23 16L23 21',
  // A drawn bow with its arrow: enemies that shoot (audit batch 2).
  ranged: 'M11 2Q23 12 11 22M11 2L4 12L11 22M4 12L23 12M19 8L23 12L19 16M4 12L1 9M4 12L1 15',
  flyers: 'M2 20Q2 4 22 3L18 8L11 11L18 10L14 15L8 16L12 16L8 21L2 20Z',
  elite: 'M12 1L15 8L23 9L17 14L19 23L12 18L5 23L7 14L1 9L9 8Z',
  hazard: 'M12 1Q17 8 14 12Q19 11 19 6Q26 20 12 23Q0 21 5 10Q6 15 9 15Q7 8 12 1Z',
  ground: 'M5 2L18 2L18 12L22 20L21 23L3 23L2 20L6 12ZM12 15L12 23',
  // R6: a cleared room's Bell of Judgment, until it is rung (rogue game.md §5.2).
  bell: 'M12 1L12 4M6 18Q6 6 12 4Q18 6 18 18ZM3 18L21 18M10 21A2 2 0 0 0 14 21',
} as const;
export type MapIcon = keyof typeof ICON_PATHS;
const paths = new Map<MapIcon, Path2D>();
export function roomIcon(room: RoomDef, reliquary = false): MapIcon {
  return reliquary ? 'reliquary' : room.kind === 'combat' ? room.focus ?? 'horde' : room.kind;
}

export function drawMapIcon(ctx: CanvasRenderingContext2D, icon: MapIcon, x: number, y: number, size: number, dark = false): void {
  let path = paths.get(icon);
  if (!path) { path = new Path2D(ICON_PATHS[icon]); paths.set(icon, path); }
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // Parchment and soot from the style.css tokens; a dark glyph on cleared (parchment) rooms.
  ctx.strokeStyle = dark ? '#e8dcc0' : '#1b1513'; ctx.lineWidth = 4;
  ctx.stroke(path);
  ctx.strokeStyle = dark ? '#2a211b' : '#fff8e8'; ctx.lineWidth = 1.8;
  ctx.stroke(path);
  ctx.restore();
}
