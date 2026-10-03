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
  /** [col, row] of D cells. */
  doors: Array<[number, number]>;
  /** One floor cell per player index. */
  entryCells: Array<[number, number]>;
  /** Values for 4 players (§7.5). */
  waves: WaveDef[];
  boss: boolean;
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
}
