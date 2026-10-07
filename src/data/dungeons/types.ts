import type { DecorId } from '../decor';

export interface WaveDef {
  blessed: number;
  choristers: number;
  cherubs: number;
}

export interface ArenaDef {
  id: string;
  name: string;
  /** Inclusive cell bounds. */
  rect: { x0: number; y0: number; x1: number; y1: number };
  /** [col, row] of the D cells of the door the arena is entered by. */
  doors: Array<[number, number]>;
  /** [col, row] of the D cells of the door the arena is left by, toward the next arena (none in the boss arena). */
  exitDoors?: Array<[number, number]>;
  /** One floor cell per player index. */
  entryCells: Array<[number, number]>;
  /** Values for 4 players (§7.5). */
  waves: WaveDef[];
  boss: boolean;
}

/**
 * The Heavenly Gate (M10 gate): a wall face drawn as the gate of Heaven, in the plane x = `x`, symmetric
 * about the row line y = `yCenter`; the cells west of the plane from row `y0` to `y1` − 1 are drawn
 * by the gate instead of the terrain. Drawn only.
 */
export interface GateDef {
  x: number;
  yCenter: number;
  y0: number;
  y1: number;
}

export interface DungeonDef {
  id: string;
  name: string;
  /** Height layer, one string per row (§8.1). */
  heights: string[];
  /** Marker layer, one string per row (§8.1). */
  markers: string[];
  arenas: ArenaDef[];
  /** Marker characters of decorations and their IDs (§8.1). */
  decor?: Record<string, DecorId>;
  /** The Heavenly Gate, if the level has one (M10 gate §3). */
  gate?: GateDef;
}
