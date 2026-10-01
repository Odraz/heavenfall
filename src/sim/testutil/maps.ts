/** Small hand-written test maps for unit tests. */
import type { ArenaDef, DungeonDef } from '../../data/dungeons/types';
import { loadMap, type GameMap } from '../map';

/** A dungeon from height rows; S markers go on the first 4 floor cells in reading order unless given. */
export function dungeonOf(heights: string[], opts: { markers?: string[]; arenas?: ArenaDef[] } = {}): DungeonDef {
  let markers = opts.markers;
  if (!markers) {
    const cells = heights.map((r) => [...r].map(() => '.'));
    let s = 0;
    heights.forEach((row, r) =>
      [...row].forEach((ch, c) => {
        if (ch !== '#' && s < 4) {
          cells[r][c] = 'S';
          s++;
        }
      }),
    );
    markers = cells.map((r) => r.join(''));
  }
  return { id: 'test', name: 'Test', heights, markers, arenas: opts.arenas ?? [] };
}

export function mapOf(heights: string[], opts: { markers?: string[]; arenas?: ArenaDef[] } = {}): GameMap {
  return loadMap(dungeonOf(heights, opts));
}
