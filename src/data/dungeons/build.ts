/** Builder helpers for writing dungeon grids (§8.1). */

/** The height-layer character for a height index 0–35. */
export function heightChar(index: number): string {
  if (!Number.isInteger(index) || index < 0 || index > 35) throw new Error(`Bad height index ${index}`);
  return index < 10 ? String(index) : String.fromCharCode(97 + index - 10);
}

/** The height-layer character for a height in meters (multiple of 0.25 m). */
export function h(meters: number): string {
  return heightChar(Math.round(meters / 0.25));
}

export class GridBuilder {
  readonly w: number;
  readonly hgt: number;
  private readonly heights: string[][];
  private readonly markers: string[][];

  /** A grid of `w` columns × `rows` rows, all walls with no markers. */
  constructor(w: number, rows: number) {
    this.w = w;
    this.hgt = rows;
    this.heights = Array.from({ length: rows }, () => Array<string>(w).fill('#'));
    this.markers = Array.from({ length: rows }, () => Array<string>(w).fill('.'));
  }

  /** Fills the inclusive rectangle with floor at `meters`. */
  fillRect(x0: number, y0: number, x1: number, y1: number, meters: number): this {
    return this.fillChar(x0, y0, x1, y1, h(meters));
  }

  /** Fills the inclusive rectangle with walls. */
  pillar(x0: number, y0: number, x1: number, y1: number): this {
    return this.fillChar(x0, y0, x1, y1, '#');
  }

  /**
   * A stair run over the inclusive rectangle. The first row or column in direction `dir`
   * is at `from` meters and each next one rises by `step` meters (at most 0.5).
   */
  stairs(x0: number, y0: number, x1: number, y1: number, dir: 'E' | 'W' | 'N' | 'S', from: number, step: number): this {
    for (let y = y0; y <= y1; y++) {
      for (let x = x0; x <= x1; x++) {
        let i: number;
        if (dir === 'E') i = x - x0;
        else if (dir === 'W') i = x1 - x;
        else if (dir === 'S') i = y - y0;
        else i = y1 - y;
        this.heights[y]![x] = h(from + i * step);
      }
    }
    return this;
  }

  /** Puts a marker character on a cell: `S`, `D`, `x`, `B` or a key of the dungeon's `decor` table. */
  marker(x: number, y: number, ch: string): this {
    this.markers[y]![x] = ch;
    return this;
  }

  heightAt(x: number, y: number): string {
    return this.heights[y]![x]!;
  }

  build(): { heights: string[]; markers: string[] } {
    return {
      heights: this.heights.map((r) => r.join('')),
      markers: this.markers.map((r) => r.join('')),
    };
  }

  private fillChar(x0: number, y0: number, x1: number, y1: number, ch: string): this {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) this.heights[y]![x] = ch;
    return this;
  }
}
