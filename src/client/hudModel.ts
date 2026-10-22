/** Pure HUD presentation rules, shared by the own frame, party frames and Profile (audit batch 2). */
import { levelForXp, xpForLevel } from '../profile/model';
import { ITEMS, type Inventory, type ItemId } from '../data/items';
import { RELICS, effectName, effectText, isRelicId, relicEffect, type RelicId } from '../data/relics';

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

export interface CarriedHint { slot: 1 | 2; item: ItemId; text: string }

/** The hint window's Carried lines (audit batch 3): key, name, count and the item's one-line rule. */
export function carriedHints(inventory: Inventory): CarriedHint[] {
  const lines: CarriedHint[] = [];
  inventory.forEach((stack, i) => {
    if (!stack) return;
    const rule = ITEMS[stack.item].rule;
    lines.push({ slot: (i + 1) as 1 | 2, item: stack.item, text: `${i + 1} · ${ITEMS[stack.item].name} ×${stack.count}: ${rule.charAt(0).toLowerCase()}${rule.slice(1)}` });
  });
  return lines;
}

export interface RelicHint { relic: RelicId; text: string }

/**
 * The hint window's Relics lines (R06 follow-up §2): each equipped relic's name and sentence with its
 * cooldown; with a combo, the replaced relic shows the combo's sentence instead.
 */
export function relicHints(equipped: readonly (string | null)[]): RelicHint[] {
  const lines: RelicHint[] = [];
  for (const id of equipped) {
    if (!isRelicId(id)) continue;
    const effect = relicEffect(id, equipped), { text, cooldown } = effectText(effect);
    const name = effect === id ? RELICS[id].name : `${RELICS[id].name} → ${effectName(effect)}`;
    lines.push({ relic: id, text: `${name}: ${text} Cooldown ${cooldown} s.` });
  }
  return lines;
}

/**
 * Slots whose item type just arrived and has never been used (audit batch 3): they pulse once so a
 * new item is noticed without text over the fight.
 */
export function newItemSlots(before: Inventory | null, after: Inventory, tried: readonly ItemId[]): number[] {
  const slots: number[] = [];
  after.forEach((stack, i) => {
    if (stack && stack.item !== before?.[i]?.item && !tried.includes(stack.item)) slots.push(i);
  });
  return slots;
}
