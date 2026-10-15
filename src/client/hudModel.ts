/** Pure HUD presentation rules, shared by the own frame, party frames and Profile (audit batch 2). */
import { levelForXp, xpForLevel } from '../profile/model';

export type HpTier = 'ok' | 'warn' | 'low';

/** Health color: green above half, amber down to a quarter, red below it. Healing is green everywhere. */
export function hpTier(hp: number, maxHp: number): HpTier {
  const share = maxHp > 0 ? Math.max(0, hp) / maxHp : 0;
  return share > 0.5 ? 'ok' : share >= 0.25 ? 'warn' : 'low';
}

export interface XpProgress {
  level: number;
  /** XP earned inside the current level, and the span of that level; both 0 at the cap. */
  into: number;
  span: number;
  /** 0–100; 100 at the cap. */
  percent: number;
  max: boolean;
}

export function xpProgress(xp: number): XpProgress {
  const level = levelForXp(xp);
  if (level >= 10) return { level, into: 0, span: 0, percent: 100, max: true };
  const lo = xpForLevel(level), span = xpForLevel(level + 1) - lo, into = Math.max(0, xp - lo);
  return { level, into, span, percent: Math.min(100, (100 * into) / span), max: false };
}
