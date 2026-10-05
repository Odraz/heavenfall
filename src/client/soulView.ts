/**
 * Where each dead player's soul floats on this client (M8 §4.1): it rises from the ground point (the
 * dead player's feet in snapshots) over 1.5 s from when the client first sees them dead, with a
 * gentle bob. A player first seen already dead (a joiner, or this client joining) starts floating.
 */
import { SOUL_BOB, SOUL_BOB_PERIOD, soulRise, SOUL_RISE_TIME } from '../sim/souls';

export class SoulView {
  /** performance.now() when each player was first seen dead, minus the rise if they started floating. */
  private readonly since = new Map<number, number>();
  private known = new Set<number>();

  /** Updates from a snapshot's players. */
  update(players: ReadonlyArray<{ id: number; dead: boolean }>, now: number): void {
    const seen = new Set<number>();
    for (const p of players) {
      seen.add(p.id);
      if (!p.dead) this.since.delete(p.id);
      else if (!this.since.has(p.id)) this.since.set(p.id, this.known.has(p.id) ? now : now - SOUL_RISE_TIME * 1000);
    }
    for (const id of [...this.since.keys()]) if (!seen.has(id)) this.since.delete(id);
    this.known = seen;
  }

  /** How far the soul's base is above its ground point, without the bob (the hit cylinder's). */
  rise(id: number, now: number): number {
    const t = this.since.get(id);
    return t === undefined ? 0 : soulRise((now - t) / 1000);
  }

  /** The soul's drawn base above its ground point: the rise plus the bob once it floats. */
  drawnRise(id: number, now: number): number {
    const t = this.since.get(id);
    if (t === undefined) return 0;
    const s = (now - t) / 1000;
    const settled = Math.min(1, Math.max(0, (s - SOUL_RISE_TIME) / 0.5));
    return soulRise(s) + settled * SOUL_BOB * Math.sin((2 * Math.PI * s) / SOUL_BOB_PERIOD);
  }

  /** Seconds since this client saw the player die, or -1 while alive. */
  age(id: number, now: number): number {
    const t = this.since.get(id);
    return t === undefined ? -1 : (now - t) / 1000;
  }
}
