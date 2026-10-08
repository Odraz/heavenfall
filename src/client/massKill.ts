/**
 * The sounds of the slaughter (M12 §4.3): `burstPop` at most every 40 ms, and mass kills: six burst
 * deaths within 0.15 s trigger one, which plays 0.1 s later so it counts the rest of the ripple; then
 * none for 1 s. Pure: the caller plays the sounds.
 */

/** `burstPop` plays at most this often; burst deaths in between are silent. */
export const BURST_POP_GAP_MS = 40;

export class BurstPops {
  private last = -Infinity;

  /** Whether a burst at `now` plays `burstPop`. */
  play(now: number): boolean {
    if (now - this.last < BURST_POP_GAP_MS) return false;
    this.last = now;
    return true;
  }
}

/** This many burst deaths within MASS_WINDOW_MS (counting the newest) trigger a mass kill. */
export const MASS_MIN = 6;
export const MASS_WINDOW_MS = 150;
/** It plays this long after the trigger. */
export const MASS_DELAY_MS = 100;
/** No new trigger for this long after one. */
export const MASS_LOCKOUT_MS = 1000;
/** It's the local player's if at least this many of its bursts were theirs. */
export const MASS_MINE = 4;

export interface MassKillPlay {
  /** Burst deaths from 0.15 s before the trigger until it played. */
  count: number;
  /** At least 4 of them were the local player's. */
  mine: boolean;
  /** Where the triggering burst was. */
  x: number;
  y: number;
  gain: number;
  rate: number;
}

/** The mass kill's gain and playback rate for a count (bigger is louder and deeper). */
export function massKillSound(count: number): { gain: number; rate: number } {
  return { gain: Math.min(1, 0.7 + 0.015 * (count - MASS_MIN)), rate: 1 - 0.01 * Math.min(count - MASS_MIN, 20) };
}

export class MassKills {
  private readonly bursts: Array<{ t: number; mine: boolean }> = [];
  private lastTrigger = -Infinity;
  private pending: { at: number; from: number; x: number; y: number } | null = null;

  /** A burst death played (at its burst), the local player's or not, at (x, y). */
  burst(now: number, mine: boolean, x: number, y: number): void {
    this.bursts.push({ t: now, mine });
    // Keep what a pending trigger's window or a new one could still count.
    const keep = Math.min(now - MASS_WINDOW_MS, this.pending ? this.pending.from : Infinity);
    while (this.bursts.length && this.bursts[0].t < keep) this.bursts.shift();
    if (this.pending || now - this.lastTrigger < MASS_LOCKOUT_MS) return;
    let n = 0;
    for (const b of this.bursts) if (b.t >= now - MASS_WINDOW_MS) n++;
    if (n < MASS_MIN) return;
    this.lastTrigger = now;
    this.pending = { at: now + MASS_DELAY_MS, from: now - MASS_WINDOW_MS, x, y };
  }

  /** The mass kill to play now, if its time has come. */
  update(now: number): MassKillPlay | null {
    const p = this.pending;
    if (!p || now < p.at) return null;
    this.pending = null;
    let count = 0;
    let mine = 0;
    for (const b of this.bursts) {
      if (b.t < p.from || b.t > now) continue;
      count++;
      if (b.mine) mine++;
    }
    return { count, mine: mine >= MASS_MINE, x: p.x, y: p.y, ...massKillSound(count) };
  }
}
