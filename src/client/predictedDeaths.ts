/**
 * Predicted deaths (netcode stage 2, 2026-10-22): an enemy the shooter's own screen predicts it killed
 * dies there at once, instead of walking on until the host's snapshots drop it a round trip and the
 * render delay later. It stays hidden while the snapshots catch up. If a snapshot from well after the
 * shot reached the host still shows it alive, the prediction was wrong and it reappears. Cosmetic and
 * local. Pure: no DOM or three.js.
 */
import type { InterpolatedEnemies } from './snapshots';

/** Ticks after the shot should have reached the host before a surviving enemy reappears. */
export const REVEAL_MARGIN_TICKS = 6;
/** Round trip assumed while the connection hasn't measured one yet, ms. */
export const UNKNOWN_RTT_MS = 300;
/** A prediction the snapshots neither confirm nor refute is dropped after this long, ms. */
export const PREDICTION_MAX_MS = 2000;
/** A confirmed death stays hidden this long, while the interpolated snapshots still draw it, ms. */
export const CONFIRMED_HIDE_MS = 1000;

interface Hidden {
  incarnation: number;
  /** The first snapshot tick that must show the death; one at or after it showing the enemy reveals it. */
  revealTick: number;
  /** When it was predicted, or confirmed. */
  at: number;
  confirmed: boolean;
}

/**
 * The snapshot tick by which the host has resolved a shot fired now: the client's tick estimate trails
 * the host by half a round trip and the input takes the other half, plus a margin for jitter and the
 * host's fire timer. `rttMs` is null before the connection measured one.
 */
export function revealTick(estimatedTick: number, rttMs: number | null, tickMs: number): number {
  return estimatedTick + (rttMs ?? UNKNOWN_RTT_MS) / tickMs + REVEAL_MARGIN_TICKS;
}

export class PredictedDeaths {
  private readonly hidden = new Map<number, Hidden>();

  /**
   * A predicted kill of the enemy drawn in `slot` with `incarnation`. Returns false if it's already
   * hidden (its death already played).
   */
  add(slot: number, incarnation: number, revealAt: number, now: number): boolean {
    if (this.hides(slot, incarnation)) return false;
    this.hidden.set(slot, { incarnation, revealTick: revealAt, at: now, confirmed: false });
    return true;
  }

  /** Whether the enemy in `slot` with `incarnation` is hidden as predicted dead. */
  hides(slot: number, incarnation: number): boolean {
    return this.hidden.get(slot)?.incarnation === incarnation;
  }

  /**
   * The host confirmed the death of `slot`'s `incarnation` (its snapshots dropped it). Returns true if
   * its death already played here, so it mustn't play again; it stays hidden while it's still drawn.
   */
  confirm(slot: number, incarnation: number, now: number): boolean {
    const h = this.hidden.get(slot);
    if (h?.incarnation !== incarnation) return false;
    h.confirmed = true;
    h.at = now;
    return true;
  }

  /**
   * A complete snapshot of `tick`: a prediction it still shows alive at or past its reveal tick was
   * wrong, and the enemy reappears. `incarnationIn(slot)` is the snapshot's incarnation in a slot, or −1.
   * Returns the slots that reappeared.
   */
  settle(tick: number, incarnationIn: (slot: number) => number, now: number): number[] {
    const revealed: number[] = [];
    for (const [slot, h] of this.hidden) {
      if (h.confirmed) {
        if (now - h.at >= CONFIRMED_HIDE_MS) this.hidden.delete(slot);
      } else if (incarnationIn(slot) !== h.incarnation) {
        // The slot is empty or holds another enemy: it died here without a confirmation passing by.
        h.confirmed = true;
        h.at = now;
      } else if (tick >= h.revealTick || now - h.at >= PREDICTION_MAX_MS) {
        this.hidden.delete(slot);
        revealed.push(slot);
      }
    }
    return revealed;
  }

  /** Removes the hidden enemies from the interpolated list, in place, keeping the others' order. */
  filter(ents: InterpolatedEnemies): void {
    if (!this.hidden.size) return;
    let k = 0;
    for (let i = 0; i < ents.count; i++) {
      if (this.hides(ents.slot[i], ents.incarnation[i])) continue;
      if (k !== i) {
        ents.slot[k] = ents.slot[i];
        ents.x[k] = ents.x[i];
        ents.y[k] = ents.y[i];
        ents.z[k] = ents.z[i];
        ents.incarnation[k] = ents.incarnation[i];
        ents.type[k] = ents.type[i];
        ents.state[k] = ents.state[i];
        ents.flags[k] = ents.flags[i];
      }
      k++;
    }
    ents.count = k;
  }

  get size(): number {
    return this.hidden.size;
  }
}
