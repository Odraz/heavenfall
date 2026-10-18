/**
 * The Relics view (rogue game.md §2.2, §8.4): the collection grid of twelve fixed cells (unowned dark
 * with `?`), the two equip slots, the selected relic's card and the six combos as far as discovered.
 * The Lobby saves the result to the profile; the Advocate sends it to the host. Fixed size: selecting
 * or equipping never moves the panel (UI stability).
 */
import { button, el } from './menus';
import { COMBOS, COMBO_IDS, RELICS, RELIC_IDS, activeCombo, relicEffect, type ComboId, type RelicId } from '../data/relics';
import { RELIC_ART } from '../client/itemArt';
import { attachTooltip } from './tooltip';

const RARITY_NAMES = { common: 'Common', rare: 'Rare', legendary: 'Legendary' } as const;

export interface RelicPanelOptions {
  title: string;
  /** The profile's relics; `pawned` are this run's bargained relics (equippable, saved only on victory). */
  owned: readonly string[];
  pawned?: readonly string[];
  equipped: [string | null, string | null];
  /** The dormancy note for a relic with the current kit and party, or null when its trigger can happen. */
  dormancy: (id: RelicId) => string | null;
  /** Read only: shows the loadout without changing it (outside the Lobby and the Confessional). */
  readOnly?: boolean;
  /** A line under the slots, e.g. where equipping is allowed. */
  note?: string;
  onApply: (equipped: [string | null, string | null]) => void;
  onClose: () => void;
}

export interface RelicPanel {
  el: HTMLElement;
  setMessage(text: string): void;
  setEquipped(equipped: [string | null, string | null], owned?: readonly string[], pawned?: readonly string[]): void;
}

/** One relic's card text: rarity, trigger, effect, numbers, the combo it belongs to and its flavor. */
export function relicCard(id: RelicId, parent: HTMLElement, note: string | null): void {
  const r = RELICS[id];
  el('div', `relic-card-rarity ${r.rarity}`, parent, `${RARITY_NAMES[r.rarity]} relic${r.source === 'chest' ? '' : ' · from a deed'}`);
  el('div', 'relic-card-name', parent, r.name);
  el('div', 'relic-card-trigger', parent, `${r.trigger}:`);
  el('div', 'relic-card-rule', parent, r.rule);
  el('div', 'relic-card-numbers', parent, r.numbers);
  if (note) el('div', 'relic-card-note', parent, note);
  el('div', 'relic-card-flavor', parent, r.flavor);
}

export function relicPanel(o: RelicPanelOptions): RelicPanel {
  const root = el('div', 'talent-overlay');
  const panel = el('div', 'panel relic-panel', root);
  const head = el('div', 'talent-head', panel);
  el('h2', 'talent-title', head, o.title);
  const body = el('div', 'relic-body', panel);
  const grid = el('div', 'relic-grid', body);
  const side = el('div', 'relic-side', body);
  const slotsRow = el('div', 'relic-equip', side);
  const card = el('div', 'relic-card', side);
  const combos = el('div', 'relic-combos', panel);
  const message = el('div', 'message talent-message', panel);
  const footer = el('div', 'buttons talent-footer', panel);
  let owned = [...o.owned], pawned = [...(o.pawned ?? [])];
  let accepted: [string | null, string | null] = [o.equipped[0], o.equipped[1]];
  let draft: [string | null, string | null] = [...accepted];
  let selected: RelicId | null = (draft[0] ?? draft[1]) as RelicId | null;
  const has = (id: string) => owned.includes(id) || pawned.includes(id);

  const equip = (slot: 0 | 1): void => {
    if (o.readOnly) return;
    if (draft[slot] && (!selected || draft[slot] === selected)) { draft[slot] = null; draw(); return; }
    if (!selected || !has(selected)) { message.textContent = 'Pick an owned relic first'; return; }
    const other = slot === 0 ? 1 : 0;
    if (draft[other] === selected) draft[other] = null;
    draft[slot] = selected;
    message.textContent = '';
    draw();
  };

  const draw = (): void => {
    grid.replaceChildren();
    for (const id of RELIC_IDS) {
      const mine = has(id), r = RELICS[id];
      const b = button('', grid, () => { selected = id; message.textContent = ''; draw(); }, `relic-cell ${r.rarity}${mine ? '' : ' unowned'}${selected === id ? ' selected' : ''}${draft.includes(id) ? ' equipped' : ''}`);
      b.dataset.relic = id;
      if (mine) { const img = el('img', 'relic-cell-icon', b); img.src = RELIC_ART[id]; img.alt = ''; }
      else el('span', 'relic-cell-unknown', b, '?');
      el('span', 'relic-cell-name', b, mine ? r.name : r.source === 'chest' ? 'In the Reliquary' : 'From a deed');
      if (pawned.includes(id)) el('span', 'relic-cell-tag', b, 'Pawned');
    }
    slotsRow.replaceChildren();
    ([0, 1] as const).forEach((slot) => {
      const id = draft[slot] as RelicId | null;
      const b = button('', slotsRow, () => equip(slot), `relic-equip-slot${id ? '' : ' empty'}${o.readOnly ? ' view' : ''}`);
      b.dataset.slot = String(slot);
      if (id) {
        const img = el('img', 'relic-cell-icon', b); img.src = RELIC_ART[id]; img.alt = '';
        const effect = relicEffect(id, draft);
        el('span', 'relic-cell-name', b, effect === id ? RELICS[id].name : `${RELICS[id].name} → ${COMBOS[effect as ComboId].name}`);
      } else el('span', 'relic-cell-name', b, `Slot ${slot + 1} · empty`);
    });
    const combo = activeCombo(draft);
    el('div', 'relic-equip-combo', slotsRow, combo ? `Combo: ${combo.name}` : '');
    card.replaceChildren();
    if (selected && has(selected)) relicCard(selected, card, o.dormancy(selected));
    else if (selected) {
      el('div', 'relic-card-name', card, 'Not found yet');
      el('div', 'relic-card-rule', card, RELICS[selected].source === 'chest' ? 'Open the Reliquary with the key, or take the Advocate’s bargain.' : 'Earned by a deed in a won run.');
    } else el('div', 'relic-card-rule', card, o.note ?? 'Pick a relic, then a slot.');
    combos.replaceChildren();
    el('div', 'section-label', combos, 'Combos: a matched pair replaces one effect');
    for (const id of COMBO_IDS) {
      const c = COMBOS[id], a = has(c.a), b = has(c.b);
      const row = el('div', `relic-combo-row${a && b ? '' : ' undiscovered'}${combo?.id === id ? ' active' : ''}`, combos);
      if (a && b) {
        el('span', 'relic-combo-name', row, c.name);
        el('span', 'relic-combo-rule', row, `${RELICS[c.a].name} + ${RELICS[c.b].name}: ${c.rule} Gives up ${c.lost}.`);
        attachTooltip(row, c.name, `${c.numbers}. ${c.flavor}`);
      } else if (a || b) el('span', 'relic-combo-rule', row, `Combo: ??? (${RELICS[a ? c.a : c.b].name} with a relic you haven't found)`);
      else el('span', 'relic-combo-rule', row, 'Combo: ???');
    }
    if (apply) apply.disabled = draft[0] === accepted[0] && draft[1] === accepted[1];
  };

  let apply: HTMLButtonElement | null = null;
  if (o.note) message.textContent = o.note;
  button(o.readOnly ? 'Close (Esc)' : 'Close', footer, o.onClose, 'small secondary');
  if (!o.readOnly) apply = button('Apply', footer, () => { message.textContent = 'Sending…'; o.onApply([draft[0], draft[1]]); }, 'small');
  draw();
  return {
    el: root,
    setMessage: (text) => { message.textContent = text; },
    setEquipped: (equipped, own, pawn) => {
      if (own) owned = [...own];
      if (pawn) pawned = [...pawn];
      accepted = [equipped[0], equipped[1]]; draft = [...accepted]; draw();
    },
  };
}
