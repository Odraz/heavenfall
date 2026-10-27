/**
 * The Edicts (rogue game.md §2.5): one fixed row in the Lobby and the Singleplayer setup naming the
 * Sentence, and a full view of the five Edicts with Back. The host (or a solo player) toggles them once
 * the heaven is cleared; everyone else reads them. The row's size never changes (UI stability).
 */
import { button, el } from './menus';
import { EDICTS, sentenceFactor } from '../data/edicts';

export interface EdictsControl {
  el: HTMLElement;
  set(ids: readonly number[]): void;
}

export function edictsControl(o: { editable: boolean; unlocked: boolean; initial: readonly number[]; onChange: (ids: number[]) => void }): EdictsControl {
  const row = el('div', 'edicts-row');
  const text = el('div', 'edicts-text', row);
  const open = button('Edicts', row, () => show(), 'small secondary edicts-open');
  let ids = [...o.initial];
  const draw = (): void => {
    const names = EDICTS.filter((e) => ids.includes(e.id)).map((e) => e.name.replace('Edict of ', '').replace('the ', ''));
    text.textContent = ids.length
      ? `Sentence ${ids.length} · XP ×${sentenceFactor(ids.length).toFixed(2)} · ${names.join(', ')}`
      : o.unlocked ? 'No Edicts: the heaven as written' : 'Edicts open once you have cleared this heaven';
  };
  open.disabled = !o.unlocked && !ids.length;
  const show = (): void => {
    const root = el('div', 'talent-overlay');
    const panel = el('div', 'panel advocate-panel', root);
    el('h2', 'talent-title', panel, 'Edicts');
    const sub = el('div', 'rite-sub', panel);
    const list = el('div', 'advocate-list', panel);
    const buttons = el('div', 'buttons talent-footer', panel);
    const redraw = (): void => {
      sub.textContent = `Sentence ${ids.length}: every XP gain ×${sentenceFactor(ids.length).toFixed(2)}. Halos, items and relics don't change.${o.editable ? '' : ' The host chooses.'}`;
      list.replaceChildren();
      for (const e of EDICTS) {
        const on = ids.includes(e.id);
        const b = button('', list, () => {
          if (!o.editable || !o.unlocked) return;
          ids = on ? ids.filter((x) => x !== e.id) : [...ids, e.id].sort((a, c) => a - c);
          o.onChange([...ids]); redraw(); draw();
        }, `advocate-row edict${on ? ' on' : ''}`);
        b.dataset.edict = String(e.id);
        b.setAttribute('aria-pressed', String(on));
        el('span', 'advocate-row-name', b, `${on ? '✓ ' : ''}${e.name}`);
        el('span', 'advocate-row-line', b, e.rule);
        b.disabled = !o.editable || !o.unlocked;
      }
    };
    button('Back', buttons, () => root.remove(), 'small secondary');
    redraw();
    document.body.appendChild(root);
  };
  draw();
  return { el: row, set: (next) => { ids = [...next]; open.disabled = !o.unlocked && !ids.length; draw(); } };
}
