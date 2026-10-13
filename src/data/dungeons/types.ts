import type { DecorId } from '../decor';

export interface WaveDef {
  /** Exact pre-rounding XP allocation: Blessed, Chorister, Cherub, commander. */
  xp?: [number, number, number, number];
  blessed: number;
  choristers: number;
  cherubs: number;
  /** Authored count at four players; absent in historical fixtures. */
  dominions?: number;
  /** Generated waves replace their first commander; fixed fixtures opt in explicitly. */
  commander?: 'cantor' | 'carrier';
  /**
   * A few enemies of one type placed only on their own points, from 5 s after the wave starts
   * (M12 follow-up §4.2). `count` is for 4 players; `at` holds [col, row] floor cells in the arena.
   */
  squad?: { type: 'cherubs' | 'choristers'; count: number; at: Array<[number, number]> };
}

/** Room kinds (rogue game.md §4.1): the loop dispatches on the kind, never on an empty wave list. */
export type RoomKind = 'breach' | 'pardoner' | 'confessional' | 'combat' | 'boss';
export type Focus = 'horde' | 'ranged' | 'flyers' | 'elite' | 'hazard' | 'ground';
export type RoomShape = '1x1' | '2x1' | '1x2' | '2x2';
/** [col, row] of a map cell. */
export type Cell = [number, number];
export type Quad = [Cell, Cell, Cell, Cell];
export interface Rect {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * One door leaf of a room (rogue game.md §3.4): its own `D` cells (4 on generated floors; a fixture's
 * door may have 3), toward room `to` (-1: outside every room).
 */
export interface RoomLeaf {
  socket: number;
  to: number;
  cells: Cell[];
}

/** The entry cells of one used socket (rogue game.md §3.4): 4 cells across it, 3 cells inward; one per player index. */
export interface RoomEntry {
  socket: number;
  cells: Quad;
}

/** A room of a dungeon (rogue game.md §14.2): one rect, its own leaves and entry cells. */
export interface RoomDef {
  id: string;
  name: string;
  kind: RoomKind;
  /** Inclusive cell bounds. */
  rect: Rect;
  /** Socket ascending. */
  leaves: RoomLeaf[];
  /** One per used socket, socket ascending. */
  entry: RoomEntry[];
  /** Counts at 4 players; empty for non-combat rooms and the boss. */
  waves: WaveDef[];
  /** Equal to `kind === 'boss'`. */
  boss: boolean;
  /** Absent in fixtures. */
  shape?: RoomShape;
  band?: 1 | 2 | 3;
  focus?: Focus;
  secondary?: Focus;
  templateId?: string;
  /** 0–3 rotations clockwise, 4–7 mirrored then rotated (rogue game.md §3.3 step 12). */
  orientation?: number;
  /** Stamped, inactive until R2. */
  hazards?: Array<{ rect: Rect; hazard: string }>;
  points?: {
    reward?: Cell;
    pedestals?: Cell[];
    advocate?: Cell;
    addSpawns?: { gate: Cell[]; field: Cell[] };
    watchers?: Cell[];
  };
  /** Preferred spawn indices (spawn affinity), used in R2. */
  chorister?: number[];
  dominion?: number[];
  /** Type restrictions on reading-order room x markers, applied before distance/affinity. */
  spawnTags?: Array<{ index: number; only: Array<'chorister' | 'dominion'> }>;
}

/**
 * The Heavenly Gate (M10 gate, rogue game.md §14.2): a wall face drawn as the gate of Heaven, on a
 * continuous wall plane facing outward `facing`, symmetric about the line u = `uCenter`. For W and E
 * the plane is x = `plane` and u runs along y; for N and S the plane is y = `plane` and u runs along x.
 * The outside cells with u0 ≤ u < u1 are drawn by the gate instead of the terrain. Drawn only.
 */
export interface GateDef {
  facing: 'N' | 'E' | 'S' | 'W';
  plane: number;
  u0: number;
  u1: number;
  uCenter: number;
}

export interface DungeonDef {
  id: string;
  name: string;
  /** Height layer, one string per row (§8.1). */
  heights: string[];
  /** Marker layer, one string per row (§8.1). */
  markers: string[];
  rooms: RoomDef[];
  /** Marker characters of decorations and their IDs (§8.1). */
  decor?: Record<string, DecorId>;
  /** The Heavenly Gate, if the level has one (M10 gate §3). */
  gate?: GateDef;
  /** Cells where an open edge may form (rogue game.md §3.5), one string per row of '0'/'1'; absent: unrestricted. */
  viewMask?: string[];
}

// ---------------------------------------------------------------- fixtures

/** An arena of a fixed (fixture) dungeon, its source format; `adaptFixture` turns it into a room. */
export interface ArenaDef {
  id: string;
  name: string;
  /** Inclusive cell bounds. */
  rect: Rect;
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

/** A fixed dungeon's gate: always on a west-facing plane x = `x`, rows `y0` to `y1` − 1. */
export interface FixtureGateDef {
  x: number;
  yCenter: number;
  y0: number;
  y1: number;
}

/** A fixed dungeon (the development fixtures), in its source format. */
export interface FixtureDef {
  id: string;
  name: string;
  heights: string[];
  markers: string[];
  arenas: ArenaDef[];
  decor?: Record<string, DecorId>;
  gate?: FixtureGateDef;
}
