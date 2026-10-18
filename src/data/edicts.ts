/**
 * The five Edicts and the Sentence (rogue game.md §2.5): optional rules a host who has cleared the
 * heaven may turn on in the Lobby. The Sentence is how many are on; every XP gain of the run is
 * multiplied by 1 + 0.15 × Sentence. Halos, items and relics don't change. Stable ids 1–5.
 */
export interface EdictDef { id: number; name: string; rule: string }

export const EDICTS: readonly EdictDef[] = [
  { id: 1, name: 'Edict of the Host', rule: 'Every wave with a commander brings one more; a Bell brings three.' },
  { id: 2, name: 'Edict of Penance', rule: 'No clear heal: the living don’t heal 30% when a room clears.' },
  { id: 3, name: 'Edict of Swift Hymns', rule: 'Choristers’ globes and the Gatekeeper’s orbs fly 30% faster.' },
  { id: 4, name: 'Edict of Poverty', rule: 'Coins and gold halos on the floor fade after 10 s instead of 20 s.' },
  { id: 5, name: 'Edict of the Trumpet', rule: 'The Gatekeeper calls its first Judgment at the start of the fight.' },
];

export const EDICT_IDS: readonly number[] = EDICTS.map((e) => e.id);

/** The run's Edicts as a validated, sorted, distinct list. */
export function cleanEdicts(v: unknown): number[] {
  if (!Array.isArray(v)) return [];
  return [...new Set(v.filter((e): e is number => Number.isInteger(e) && EDICT_IDS.includes(e)))].sort((a, b) => a - b);
}

/** Every XP gain is multiplied by this under a Sentence (§2.5): Sentence 3 = ×1.45. */
export const sentenceFactor = (sentence: number): number => 1 + 0.15 * sentence;

/** `Sentence 3 · XP ×1.45`, or null without a Sentence. */
export function sentenceLabel(sentence: number): string | null {
  return sentence > 0 ? `Sentence ${sentence} · XP ×${sentenceFactor(sentence).toFixed(2)}` : null;
}

/** Whether a host profile may set Edicts for a heaven (§2.5): it has cleared it once, or the run saves nothing. */
export function edictsUnlocked(clears: number, progressionEnabled: boolean): boolean {
  return !progressionEnabled || clears >= 1;
}

const ROMAN: Array<[number, string]> = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
/** An Absolution rank as a roman numeral; above 3 999 a decimal (§9.2). */
export function roman(n: number): string {
  if (n > 3999) return String(n);
  let out = '';
  for (const [v, s] of ROMAN) while (n >= v) { out += s; n -= v; }
  return out;
}
