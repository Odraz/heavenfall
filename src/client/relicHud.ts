/**
 * The HUD's R6 additions: the two equipped relics beside the ability box, each with its cooldown swept
 * over its icon and the active combo's name under them (rogue game.md §8.1, items-relics.md §2.1), and
 * the kill-streak banner at the top center (game.md §10, m12-followup-2.md §3.2). Fixed positions: the
 * strip and the banner never move other HUD elements.
 */
import { COMBOS, RELICS, effectName, relicEffect, type ComboId, type RelicId } from '../data/relics';
import { KEY_ART, RELIC_ART, SUNDIAL_ART } from './itemArt';
import { STREAK_NAMES } from '../sim/streaks';

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  e.className = className;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

/** The banner pops in over 120 ms, holds 1.5 s and fades over 0.5 s. */
const BANNER_HOLD_MS = 1500;
const BANNER_FADE_MS = 500;

export class RelicHud {
  private readonly strip: HTMLDivElement;
  private readonly slots: Array<{ box: HTMLDivElement; icon: HTMLImageElement }>;
  private readonly combo: HTMLDivElement;
  private relics: [string | null, string | null] = [null, null];
  private ready: [number, number] = [0, 0];
  private readonly banner: HTMLDivElement;
  private readonly bannerName: HTMLDivElement;
  private readonly bannerSub: HTMLDivElement;
  private bannerAt = -Infinity;
  private readonly keyLine: HTMLDivElement;
  private readonly sundialLine: HTMLDivElement;
  private tierShown = false;

  constructor(root: HTMLElement) {
    this.strip = el('div', 'relic-strip', root);
    this.strip.hidden = true;
    this.slots = [0, 1].map(() => {
      const box = el('div', 'relic-slot empty', this.strip);
      const icon = el('img', 'relic-icon', box);
      icon.alt = ''; icon.hidden = true;
      return { box, icon };
    });
    this.combo = el('div', 'relic-combo', this.strip);
    this.keyLine = el('div', 'route-line key-line', root);
    this.keyLine.hidden = true;
    this.sundialLine = el('div', 'route-line sundial-line', root);
    this.sundialLine.hidden = true;
    this.banner = el('div', 'streak-banner', root);
    this.bannerName = el('div', 'streak-name', this.banner);
    this.bannerSub = el('div', 'streak-sub', this.banner);
    this.banner.hidden = true;
  }

  /** The equipped pair, the active combo and each slot's cooldown end tick, from the host. */
  setRelics(relics: [string | null, string | null], combo: string | null, ready: [number, number]): void {
    this.relics = [relics[0], relics[1]];
    this.ready = [ready[0], ready[1]];
    this.strip.hidden = !relics[0] && !relics[1];
    this.slots.forEach((s, i) => {
      const id = relics[i] as RelicId | null;
      s.box.classList.toggle('empty', !id);
      s.icon.hidden = !id;
      if (id) {
        s.icon.src = RELIC_ART[id];
        const effect = relicEffect(id, relics);
        s.box.title = effect === id ? `${RELICS[id].name}: ${RELICS[id].text}` : `${RELICS[id].name} → ${effectName(effect)}: ${COMBOS[effect as ComboId].text}`;
        s.box.setAttribute('aria-label', `Relic ${i + 1}: ${s.box.title}`);
      } else { s.box.title = 'No relic'; s.box.setAttribute('aria-label', `Relic ${i + 1}: empty`); }
    });
    this.combo.textContent = combo ? COMBOS[combo as ComboId]?.name ?? '' : '';
    this.combo.hidden = !combo;
  }

  /** Under the minimap: who carries St Peter's key (§6.5), or nothing while nobody does. */
  setKey(holder: string | null): void {
    this.keyLine.hidden = holder === null;
    this.keyLine.replaceChildren();
    if (holder === null) return;
    const img = el('img', 'route-icon', this.keyLine); img.src = KEY_ART; img.alt = '';
    el('span', '', this.keyLine, `Key · ${holder}`);
  }

  /** Under the minimap while the Sundial is lit (§6.8): the time left to seal the Gatekeeper; null hides it. */
  setSundial(seconds: number | null): void {
    this.sundialLine.hidden = seconds === null;
    if (seconds === null) return;
    const s = Math.max(0, Math.ceil(seconds));
    if (!this.sundialLine.firstChild) { const img = el('img', 'route-icon', this.sundialLine); img.src = SUNDIAL_ART; img.alt = ''; el('span', '', this.sundialLine); }
    this.sundialLine.lastChild!.textContent = `Sundial · ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  }

  /** The equipped pair as last published. */
  equipped(): [string | null, string | null] {
    return [this.relics[0], this.relics[1]];
  }

  /** Each slot's sweep at the estimated host tick: dark over the part of its cooldown still to run. */
  update(tick: number, now: number): void {
    this.slots.forEach((s, i) => {
      const id = this.relics[i] as RelicId | null;
      const left = id ? Math.max(0, this.ready[i] - tick) / (RELICS[id].cooldown * 30) : 0;
      s.box.classList.toggle('ready', left <= 0);
      s.box.style.setProperty('--relic-cooldown', `${Math.min(100, left * 100)}%`);
    });
    const t = now - this.bannerAt;
    if (t > BANNER_HOLD_MS + BANNER_FADE_MS) { this.banner.hidden = true; this.tierShown = false; }
    else this.banner.style.opacity = String(t <= BANNER_HOLD_MS ? 1 : 1 - (t - BANNER_HOLD_MS) / BANNER_FADE_MS);
  }

  /** Your streak crossed a tier: its name, gold, and the kill count under it. A newer tier replaces it. */
  streakTier(tier: number, count: number, now: number): void {
    this.bannerName.textContent = STREAK_NAMES[tier]?.toUpperCase() ?? '';
    this.bannerSub.textContent = `${count} kills`;
    this.bannerName.hidden = false;
    this.banner.hidden = false;
    this.banner.classList.remove('pop'); void this.banner.offsetWidth; this.banner.classList.add('pop');
    this.bannerAt = now; this.tierShown = true;
  }

  /** Your streak of 10 or more ended: `Streak 37`, small, unless a tier banner is still up. */
  streakEnd(count: number, now: number): void {
    if (this.tierShown && now - this.bannerAt <= BANNER_HOLD_MS + BANNER_FADE_MS) return;
    this.bannerName.hidden = true;
    this.bannerSub.textContent = `Streak ${count}`;
    this.banner.hidden = false;
    this.banner.classList.remove('pop');
    this.bannerAt = now; this.tierShown = false;
  }
}
