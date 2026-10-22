/**
 * Pincer arrivals (R06 follow-up §9 option 3): from a horde room's second wave, up to a third of each
 * wave's Blessed enter from a spawn point ahead of a player who is backing away from the crowd, so a
 * straight retreat runs into a telegraphed arrival instead of open floor. A point closer than the usual
 * far distance gets a 2 s spawn warning first. Host only; the same rule per player in solo and co-op.
 */
export const PINCER_SHARE = 1 / 3;
/** The first wave (0-based) with pincer arrivals: the second. */
export const PINCER_FROM_WAVE = 1;
/** A point counts as ahead between these distances (m), within this half-angle of the retreat. */
export const PINCER_MIN = 8;
export const PINCER_MAX = 30;
export const PINCER_HALF_ANGLE = Math.PI / 4;
/** Retreating: at least this speed (m/s) over the last second, away from the crowd within CROWD_RADIUS. */
export const RETREAT_SPEED = 2.5;
export const CROWD_RADIUS = 12;
/** The warning before a pincer arrival nearer than the far spawn distance. */
export const PINCER_WARNING_TICKS = 60;
/** Ticks of position history: one second. */
const HISTORY = 30;

export interface Retreat { x: number; y: number; hx: number; hy: number }

/** The unit heading of a retreat from `from` to `to` over a second, away from `crowd`, or null. */
export function retreatHeading(from: { x: number; y: number }, to: { x: number; y: number }, crowd: { x: number; y: number } | null, seconds = 1): [number, number] | null {
  const dx = to.x - from.x, dy = to.y - from.y, d = Math.hypot(dx, dy);
  if (d < RETREAT_SPEED * seconds) return null;
  const hx = dx / d, hy = dy / d;
  // Moving away from the crowd: the crowd is behind the movement.
  if (!crowd || (to.x - crowd.x) * hx + (to.y - crowd.y) * hy <= 0) return null;
  return [hx, hy];
}

/**
 * The spawn point a pincer uses, or -1: among the `usable` points, those 8–30 m ahead of a retreating
 * player within ±45° of the retreat; the nearest wins, so the arrival cuts the retreat off.
 */
export function pincerPoint(points: ReadonlyArray<readonly [number, number]>, usable: (i: number) => boolean, retreats: readonly Retreat[]): number {
  let best = -1, bestD = Infinity;
  const cos = Math.cos(PINCER_HALF_ANGLE);
  for (let i = 0; i < points.length; i++) {
    if (!usable(i)) continue;
    const x = points[i][0] + 0.5, y = points[i][1] + 0.5;
    for (const r of retreats) {
      const dx = x - r.x, dy = y - r.y, d = Math.hypot(dx, dy);
      if (d < PINCER_MIN || d > PINCER_MAX || (dx * r.hx + dy * r.hy) / d < cos) continue;
      if (d < bestD) { bestD = d; best = i; }
    }
  }
  return best;
}

/** Each player's last second of positions, sampled every tick. */
export class PositionHistory {
  private readonly trails = new Map<number, Array<{ x: number; y: number }>>();

  sample(players: ReadonlyArray<{ id: number; x: number; y: number }>): void {
    const seen = new Set<number>();
    for (const p of players) {
      seen.add(p.id);
      let t = this.trails.get(p.id);
      if (!t) { t = []; this.trails.set(p.id, t); }
      t.push({ x: p.x, y: p.y });
      if (t.length > HISTORY + 1) t.shift();
    }
    for (const id of this.trails.keys()) if (!seen.has(id)) this.trails.delete(id);
  }

  /** The position a second ago, once a full second is known. */
  secondAgo(id: number): { x: number; y: number } | null {
    const t = this.trails.get(id);
    return t && t.length > HISTORY ? t[0] : null;
  }
}
