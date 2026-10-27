/** Flow fields (§7.3), shared by the simulation and the bot. */
import { EPS, STEP_UP } from './constants';
import type { GameMap } from './map';
import type { Rect } from '../data/dungeons/types';

export const UNREACHABLE = 0x7fffffff;
export const COST_ORTHO = 10;
export const COST_DIAG = 14;

/** Neighbor offsets: 4 orthogonal first, then 4 diagonal. */
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

/** Adjacent steering must obey the same ledges and corner rules as the field. */
export function directStepAllowed(field: FlowField, c: number, r: number, tc: number, tr: number): boolean {
  const dx = tc - c, dy = tr - r;
  if (dx === 0 && dy === 0) return field.at(c, r) !== UNREACHABLE;
  const k = DX.findIndex((x, i) => x === dx && DY[i] === dy);
  return k >= 0 && stepAllowed(field.map, c, r, k, field.air, field.excluded);
}

/**
 * Whether a one-way step from cell `a` to the orthogonal neighbor at offset (dx, dy) is allowed.
 * Ground: the target is floor and at most 0.5 m higher; dropping is allowed. Air: any floor.
 */
function orthoAllowed(map: GameMap, ac: number, ar: number, dx: number, dy: number, air: boolean, excluded?: Uint8Array): boolean {
  const bc = ac + dx;
  const br = ar + dy;
  if (bc < 0 || br < 0 || bc >= map.w || br >= map.h) return false;
  const b = br * map.w + bc;
  if (map.solid[b] || excluded?.[b]) return false;
  if (air) return true;
  return map.floor[b] - map.floor[ar * map.w + ac] <= STEP_UP + EPS;
}

/** Whether a step from cell (ac, ar) to its neighbor k (0–7) is allowed (§7.3). */
export function stepAllowed(map: GameMap, ac: number, ar: number, k: number, air: boolean, excluded?: Uint8Array): boolean {
  const dx = DX[k];
  const dy = DY[k];
  if (k < 4) return orthoAllowed(map, ac, ar, dx, dy, air, excluded);
  return (
    orthoAllowed(map, ac, ar, dx, 0, air, excluded) &&
    orthoAllowed(map, ac, ar, 0, dy, air, excluded) &&
    orthoAllowed(map, ac, ar, dx, dy, air, excluded)
  );
}

export class FlowField {
  readonly dist: Int32Array;
  targetCell = -1;
  private readonly buckets: number[][];

  constructor(
    readonly map: GameMap,
    readonly air: boolean,
    readonly excluded?: Uint8Array,
  ) {
    this.dist = new Int32Array(map.w * map.h).fill(UNREACHABLE);
    this.buckets = Array.from({ length: COST_DIAG + 1 }, () => []);
  }

  /**
   * Dijkstra over 8 neighbors with a bucket queue, computed backward from the target cell
   * over one-way steps, so distances measure paths to it.
   */
  compute(tc: number, tr: number, clamp?: Rect): void {
    const { map, dist, air, buckets } = this;
    const w = map.w;
    dist.fill(UNREACHABLE);
    this.targetCell = -1;
    const inside = (c: number, r: number) => !clamp || (c >= clamp.x0 && c <= clamp.x1 && r >= clamp.y0 && r <= clamp.y1);
    if (tc < 0 || tr < 0 || tc >= w || tr >= map.h) return;
    if (!inside(tc, tr)) return;
    const t = tr * w + tc;
    if (map.solid[t] || this.excluded?.[t]) return;
    this.targetCell = t;
    const nb = buckets.length;
    for (const b of buckets) b.length = 0;
    dist[t] = 0;
    buckets[0].push(t);
    let pending = 1;
    for (let d = 0; pending > 0; d++) {
      const bucket = buckets[d % nb];
      // Entries pushed during this loop go to other buckets (costs are 10 and 14).
      for (let j = 0; j < bucket.length; j++) {
        const cell = bucket[j];
        pending--;
        if (dist[cell] !== d) continue;
        const bc = cell % w;
        const br = (cell - bc) / w;
        // Relax predecessors A of B = cell: A is a neighbor with an allowed step A → B.
        for (let k = 0; k < 8; k++) {
          const ac = bc + DX[k];
          const ar = br + DY[k];
          if (ac < 0 || ar < 0 || ac >= w || ar >= map.h) continue;
          if (!inside(ac, ar)) continue;
          const a = ar * w + ac;
          if (map.solid[a] || this.excluded?.[a]) continue;
          // The step from A to B has offset (-DX[k], -DY[k]), which is neighbor index opposite(k).
          if (!stepAllowed(map, ac, ar, OPPOSITE[k], air, this.excluded)) continue;
          const nd = d + (k < 4 ? COST_ORTHO : COST_DIAG);
          if (nd < dist[a]) {
            dist[a] = nd;
            buckets[nd % nb].push(a);
            pending++;
          }
        }
      }
      bucket.length = 0;
    }
  }

  /**
   * The neighbor of cell (c, r), reachable by an allowed step, with the lowest distance,
   * or -1 if none is reachable.
   */
  bestNeighbor(c: number, r: number): number {
    const { map, dist, air } = this;
    const w = map.w;
    let best = -1;
    let bestD = UNREACHABLE;
    for (let k = 0; k < 8; k++) {
      const nc = c + DX[k];
      const nr = r + DY[k];
      if (nc < 0 || nr < 0 || nc >= w || nr >= map.h) continue;
      const n = nr * w + nc;
      const d = dist[n];
      if (d >= bestD) continue;
      if (!stepAllowed(map, c, r, k, air, this.excluded)) continue;
      best = n;
      bestD = d;
    }
    return best;
  }

  at(c: number, r: number): number {
    if (c < 0 || r < 0 || c >= this.map.w || r >= this.map.h) return UNREACHABLE;
    return this.dist[r * this.map.w + c];
  }
}

/** OPPOSITE[k] is the neighbor index with offset (-DX[k], -DY[k]). */
const OPPOSITE = [1, 0, 3, 2, 7, 6, 5, 4];
