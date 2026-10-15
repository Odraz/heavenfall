/** Party-size scaling for enemy counts, HP and the Gatekeeper (rogue game.md §0). */
import type { WaveDef } from '../data/dungeons/types';

/** Linear party scaling, including half-player bots (rogue game.md §0). */
export function partyMultiplier(partySize: number): number {
  return (2 + 2 * Math.max(1, Math.min(4, partySize))) / 10;
}

/**
 * The Gatekeeper's HP and Judgment's interrupt multiplier: 0.3 for a solo game (M12 follow-up §3.3,
 * was 0.4), the party-size multiplier otherwise.
 */
export function bossMultiplier(partySize: number, solo = partySize === 1): number {
  return solo ? 0.3 : partyMultiplier(partySize);
}

/** A wave's enemies for the party size, each type and its squad (M12 follow-up §4.2) scaled. */
export function waveSize(w: WaveDef, partySize: number): number {
  return (
    scaleCount(w.blessed, partySize) +
    scaleCount(w.choristers, partySize) +
    scaleCount(w.cherubs, partySize) +
    scaleCount(w.dominions ?? 0, partySize) +
    (w.squad ? scaleCount(w.squad.count, partySize) : 0)
  );
}

/** Scales one enemy count for the party size, rounding up (§7.5). */
export function scaleCount(count: number, partySize: number): number {
  return Math.max(0, Math.ceil(count * partyMultiplier(partySize) - 1e-9));
}
