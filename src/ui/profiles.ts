/** One current profile, managed from title Settings under the gameplay lock. */
import { button, el } from './menus';
import { exportCode, importCode, MAX_CODE_BYTES } from '../profile/codec';
import { createProfile, importProfile, levelForXp, type Profile } from '../profile/model';
import { ProfileSession } from '../profile/storage';
import { CLASS_IDS } from '../data/classes';
import { ITEMS } from '../data/items';
import { ITEM_ART } from '../client/itemArt';

export function profilesScreen(session: ProfileSession, onBack: () => void, onChanged: () => void): HTMLElement {
  const screen = el('div', 'screen menu'); el('h2', 'screen-title', screen, 'Profile');
  const panel = el('div', 'panel profile-panel', screen);
  const summary = el('p', '', panel), message = el('div', 'message', panel);
  const refresh = (): void => { summary.textContent = session.recovery ? 'Saved progress needs recovery' : `${session.profile.name} · ${session.profile.stats.wins} victories · ${session.profile.relics.length}/12 relics`; };
  refresh();
  if (session.recovery) message.textContent = `${session.recovery.message}. Copy original data before importing or clearing.`;
  let busy = false;
  const action = async (fn: () => Promise<void>): Promise<void> => {
    if (busy) return; busy = true;
    try { await fn(); } catch (error) { message.textContent = error instanceof Error ? error.message : String(error); }
    finally { busy = false; }
  };
  const copy = button(session.recovery ? 'Copy original data' : 'Copy code', panel, () => void action(async () => {
    await navigator.clipboard.writeText(session.recovery ? JSON.stringify(session.recovery.raw) : await exportCode(session.profile)); message.textContent = 'Save data copied';
  }));
  const form = el('label', 'field', panel); el('span', 'field-label', form, 'Import code');
  const code = el('textarea', 'text-input', form); code.maxLength = MAX_CODE_BYTES;
  code.setAttribute('aria-label', 'Import code'); code.spellcheck = false;
  let replacement: { code: string; expires: number } | null = null;
  button('Import', panel, () => void action(async () => {
    const parsed = await importCode(code.value);
    if (!replacement || replacement.code !== code.value || performance.now() > replacement.expires) {
      replacement = { code: code.value, expires: performance.now() + 10000 };
      message.textContent = 'Press Import again to replace your progress and carried items. Copy your code first to keep them.'; return;
    }
    if (!session.replace(importProfile(parsed, []).profile)) throw new Error('Cannot save imported profile');
    replacement = null; code.value = ''; onChanged(); refresh(); copy.textContent = 'Copy code'; message.textContent = 'Profile imported';
  }));
  let clearUntil = 0;
  const clear = button('Clear', panel, () => void action(async () => {
    if (performance.now() > clearUntil) {
      clearUntil = performance.now() + 10000; clear.textContent = 'Confirm clear';
      message.textContent = 'This clears all current progress and carried items. Copy your code first to keep them.'; return;
    }
    if (!session.replace(createProfile(session.profile.name))) throw new Error('Cannot clear this profile');
    clearUntil = 0; clear.textContent = 'Clear'; onChanged(); refresh(); copy.textContent = 'Copy code'; message.textContent = 'Profile cleared';
  }), 'secondary');
  button('Back', panel, onBack, 'secondary');
  return screen;
}

/** Emergency export stays available if an accepted checkpoint cannot reach storage. */
export function saveCodeButton(parent: HTMLElement, profile: () => Profile): void {
  button('Copy save code', parent, () => { void exportCode(profile()).then(code => navigator.clipboard.writeText(code)).catch(error => { el('p', 'message', parent, String(error)); }); });
}

export function profileLoadout(parent: HTMLElement, session: ProfileSession, changed: () => void = () => {}): void {
  for (const id of CLASS_IDS) {
    const card = parent.querySelector<HTMLElement>(`.class-card[data-class-id="${id}"]`);
    if (card) { const level = el('div', 'class-level', undefined, `Level ${levelForXp(session.profile.characters[id].xp)}`); card.insertBefore(level, card.querySelector('.class-role')); }
  }
  const container = parent.querySelector('.panel') ?? parent;
  const panel = el('div', 'profile-loadout');
  const cards = container.querySelector('.class-cards');
  if (cards) cards.after(panel); else container.append(panel);
  const draw = (): void => {
    panel.replaceChildren(); el('div', 'section-label', panel, 'Carried items');
    const stacks = el('div', 'loadout-items', panel);
    session.profile.inventory.forEach((stack, slot) => {
      const row = el('div', 'loadout-item', stacks);
      if (stack) { const icon = el('img', '', row); icon.src = ITEM_ART[stack.item]; icon.alt = ''; }
      el('span', '', row, stack ? `${ITEMS[stack.item].name} ×${stack.count}` : 'Empty');
      if (stack && !session.profile.run) button(`Discard item ${slot + 1}`, row, () => {
        const next = structuredClone(session.profile); next.inventory[slot] = null;
        if (session.save(next, true)) { changed(); draw(); } else el('p', 'message', panel, session.message);
      }, 'secondary');
    });
    el('div', 'loadout-relics', panel, session.profile.relics.length ? `Relics collected: ${session.profile.relics.length}` : 'No relics collected');
  }; draw();
}
