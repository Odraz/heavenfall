/** The room template format (rogue game.md §4.7, rooms.md §2): authored at canonical orientation. */
import type { Focus, GateDef, Rect, RoomKind } from '../dungeons/types';

/** A 1×2 room uses a '2x1' template, rotated. */
export type TemplateShape = '1x1' | '2x1' | '2x2';
export type Purpose = 'cover' | 'kite' | 'high' | 'choke' | 'jump' | 'spawn' | 'lure';
export type PropFamily = 'loot' | 'blast' | 'blessing';
/** Enemy ids in a wave's mix; the elite (`dominion`) is counted by `elites`. */
export type MixId = 'blessed' | 'chorister' | 'cherub';

export interface TemplateWave {
  share: number;
  mix: Partial<Record<MixId, number>>;
  /** Authored extra elites; stamping adds one baseline commander outside this TP mix. */
  elites?: number;
}

export interface RoomTemplate {
  /** 'pg-c-1x1-ranged-01'; unique in the pool. */
  id: string;
  /** The room's display name. */
  name: string;
  /** 1 = the Pearly Gates. */
  heaven: number;
  kind: RoomKind;
  /** breach/pardoner/confessional '1x1', boss '2x2'. */
  shape: TemplateShape;
  focus?: Focus;
  secondary?: Focus;
  /** Inclusive, within 1..3; [1, 3] for non-combat kinds, never used as a filter for them. */
  bands: [number, number];
  /** > 0. */
  weight: number;
  fixedOrientation?: boolean;
  /** Boss only: its one socket (rogue game.md §3.4 numbering). */
  entrySocket?: number;
  /** 32×32, 68×32 or 68×68; '#' wall, '0'..'z' floor index (0.25 m steps). */
  heights: string[];
  /** Same size; '.', 'x' spawn point, 'S' (breach only, exactly 4), 'B' (boss), decor keys. */
  markers: string[];
  obstacles: Array<{ rect: Rect; purpose: Purpose; note?: string }>;
  hazards: Array<{ rect: Rect; hazard: string }>;
  /** In canonical row-major block order: the first `loot` is the marked reliquary's socket. */
  props: Array<{ at: [number, number]; family: PropFamily; chance: number }>;
  /** Top-left cell of a flat 4×4 floor area (clear reward, key, chest). */
  rewardSpot: [number, number];
  /** Combat only. */
  waves: TemplateWave[];
  /** Preferred existing x markers per type (rooms.md §2.3). */
  spawnAffinity?: Partial<Record<'chorister' | 'dominion', Rect[]>>;
  /** Restrictions on existing x markers; none in this pool. */
  spawnTags?: Array<{ at: [number, number]; only: Array<'chorister' | 'dominion'> }>;
  points?: {
    advocate?: [number, number];
    pedestals?: Array<[number, number]>;
    boss?: [number, number];
    watchers?: Array<[number, number]>;
    addSpawns?: { gate: Array<[number, number]>; field: Array<[number, number]> };
  };
  /** Boss only, in continuous template coordinates (rogue game.md §14.2). */
  gate?: GateDef;
}

/** The interior of a template shape in cells. */
export function templateSize(shape: TemplateShape): [number, number] {
  return shape === '1x1' ? [32, 32] : shape === '2x1' ? [68, 32] : [68, 68];
}
