/**
 * Pilgrim's Feather's trail: while a player's boost lasts, a pale feather drops behind them for every
 * 0.35 m they move, so a hastened ally reads at a glance and standing still leaves nothing.
 */
export const TRAIL_SPACING = 0.35;

type Pose = { x: number; y: number; z: number; dead?: boolean };

export class FeatherTrails {
  private readonly trails = new Map<number, { until: number; x: number; y: number; carry: number }>();

  /** A use starts or refreshes the trail until `until` (ms, the same clock as `step`). */
  start(id: number, until: number, at: Pose): void {
    this.trails.set(id, { until, x: at.x, y: at.y, carry: 0 });
  }

  stop(id: number): void {
    this.trails.delete(id);
  }

  get size(): number {
    return this.trails.size;
  }

  /** The points where feathers drop this frame, along each trail's path since the last frame. */
  step(now: number, pose: (id: number) => Pose | undefined): Array<[number, number, number]> {
    const out: Array<[number, number, number]> = [];
    for (const [id, t] of this.trails) {
      const p = pose(id);
      if (!p || p.dead || now >= t.until) { this.trails.delete(id); continue; }
      const dx = p.x - t.x;
      const dy = p.y - t.y;
      const moved = Math.hypot(dx, dy);
      // A teleport or respawn jump leaves no line of feathers.
      if (moved > 3) { t.x = p.x; t.y = p.y; t.carry = 0; continue; }
      let d = TRAIL_SPACING - t.carry;
      while (d <= moved) {
        out.push([t.x + (dx * d) / moved, t.y + (dy * d) / moved, p.z]);
        d += TRAIL_SPACING;
      }
      t.carry = moved - (d - TRAIL_SPACING);
      t.x = p.x;
      t.y = p.y;
    }
    return out;
  }
}
