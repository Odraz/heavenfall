/** Three profile slots; all mutations require the same exclusive lock used during gameplay. */
import { button, el } from './menus';
import { exportCode, exportFilename, importCode, MAX_CODE_BYTES } from '../profile/codec';
import { createProfile, importProfile, levelForXp, type Profile } from '../profile/model';
import { lockProfile, PROFILE_SLOTS, profileKey, ProfileSession, readProfile, writeProfile, type ProfileSlot, type SaveStorage } from '../profile/storage';
import { CLASS_IDS } from '../data/classes';
import { ITEMS } from '../data/items';

function download(text: string, name: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain' }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function profilesScreen(onContinue: (session: ProfileSession) => void): HTMLElement {
  const screen = el('div', 'screen menu'); el('h2', 'screen-title', screen, 'Profiles');
  const panel = el('div', 'panel', screen), message = el('div', 'message', panel);
  let storage: SaveStorage;
  try { storage = localStorage; } catch { message.textContent = 'Browser storage is unavailable'; return screen; }
  const cards = el('div', 'class-cards', panel);
  let busy = false;
  const action = async (fn: () => Promise<void>): Promise<void> => {
    if (busy) return; busy = true;
    try { await fn(); } catch (error) { message.textContent = error instanceof Error ? error.message : String(error); }
    finally { busy = false; }
  };
  const refresh = (): void => {
    cards.replaceChildren();
    for (const slot of PROFILE_SLOTS) {
      const read = readProfile(storage, slot), card = el('div', 'profile-card', cards);
      el('h3', '', card, `Slot ${slot}: ${read.profile?.name ?? (read.corrupt ? 'Needs recovery' : 'Empty')}`);
      if (read.message) el('p', '', card, read.message);
      if (read.profile) {
        el('p', '', card, CLASS_IDS.map(c => `${c}: ${levelForXp(read.profile!.characters[c].xp)}`).join(' · '));
        el('p', '', card, `${read.profile.relics.length}/12 relics · ${read.profile.stats.wins} victories`);
      }
      const name = !read.profile && !read.corrupt ? el('input', 'text-input', card) : null;
      if (name) { name.placeholder = 'Profile name'; name.maxLength = 16; name.setAttribute('aria-label', `Slot ${slot} name`); }
      const open = button(read.profile ? 'Continue' : 'New', card, () => void action(async () => {
        const lock = await lockProfile(slot); let transferred = false;
        try {
          const latest = readProfile(storage, slot);
          if (latest.corrupt) throw new Error(latest.message);
          const p = latest.profile ?? createProfile(name?.value ?? '');
          if (!latest.profile && !writeProfile(storage, slot, p)) throw new Error('Cannot save this profile');
          transferred = true; onContinue(new ProfileSession(slot, p, storage, lock));
        } finally { if (!transferred) lock.release(); }
      }));
      open.disabled = read.corrupt;
      if (read.profile) {
        button('Copy code', card, () => void action(async () => { await navigator.clipboard.writeText(await exportCode(read.profile!)); message.textContent = 'Save code copied'; }));
        button('Download', card, () => void action(async () => download(await exportCode(read.profile!), exportFilename(read.profile!))));
      } else if (read.corrupt) button('Export recovery data', card, () => download(JSON.stringify(read.raw), `meatgrinder-slot-${slot}-recovery.txt`));
      if (read.profile || read.corrupt) {
        let armedUntil = 0;
        const del = button('Delete', card, () => {
          if (performance.now() > armedUntil) { armedUntil = performance.now() + 3000; del.textContent = 'Press again to delete'; return; }
          void action(async () => {
            const lock = await lockProfile(slot);
            try { storage.removeItem(profileKey(slot)); storage.removeItem(`${profileKey(slot)}.bak`); refresh(); }
            finally { lock.release(); }
          });
        });
      }
    }
  };
  refresh();
  const form = el('div', 'field', panel); el('label', 'field-label', form, 'Import code');
  const code = el('textarea', 'text-input', form); code.maxLength = MAX_CODE_BYTES; code.setAttribute('aria-label', 'Import code');
  const choice = el('select', 'text-input', form); choice.setAttribute('aria-label', 'Import slot');
  for (const slot of PROFILE_SLOTS) { const opt = el('option', '', choice, `Slot ${slot}`); opt.value = String(slot); }
  let replacement: { slot: ProfileSlot; code: string; expires: number } | null = null;
  const load = async (): Promise<void> => {
    const parsed = await importCode(code.value), slot = Number(choice.value) as ProfileSlot;
    const current = readProfile(storage, slot);
    if (current.raw.some(Boolean) && (!replacement || replacement.slot !== slot || replacement.code !== code.value || performance.now() > replacement.expires)) {
      replacement = { slot, code: code.value, expires: performance.now() + 10000 }; message.textContent = 'Press Import again within 10 seconds to replace this slot'; return;
    }
    const lock = await lockProfile(slot);
    try {
      const ids = PROFILE_SLOTS.filter(s => s !== slot).map(s => readProfile(storage, s).profile?.id).filter((x): x is string => !!x);
      const imported = importProfile(parsed, ids);
      if (!writeProfile(storage, slot, imported.profile)) throw new Error('Cannot save imported profile');
      message.textContent = imported.copied ? 'Imported as a copy' : 'Profile imported'; replacement = null; refresh();
    } finally { lock.release(); }
  };
  button('Import', form, () => void action(load));
  const file = el('input', '', form); file.type = 'file'; file.accept = '.txt'; file.setAttribute('aria-label', 'Load save file');
  file.addEventListener('change', () => void action(async () => {
    const input = file.files?.[0]; if (!input) return;
    if (input.size > MAX_CODE_BYTES) throw new Error('Save code exceeds 64 KiB'); code.value = await input.text(); await load();
  }));
  return screen;
}
export function saveCodeButton(parent: HTMLElement, profile: () => Profile): void {
  button('Copy save code', parent, () => { void exportCode(profile()).then(code => navigator.clipboard.writeText(code)).catch(error => { el('p', 'message', parent, String(error)); }); });
}
/** Lobby-only inventory editing under the already-held profile lock. */
export function profileLoadout(parent: HTMLElement, session: ProfileSession, changed: () => void = () => {}): void {
  const panel = el('div', 'profile-loadout', parent.querySelector('.panel') ?? parent);
  const draw = (): void => {
    panel.replaceChildren();
    el('div', '', panel, CLASS_IDS.map(id => `${id}: level ${levelForXp(session.profile.characters[id].xp)}`).join(' · '));
    session.profile.inventory.forEach((stack, slot) => {
      const row = el('span', '', panel, ` ${slot + 1}: ${stack ? `${ITEMS[stack.item].name} ×${stack.count}` : 'empty'} `);
      if (stack && !session.profile.run) button(`Discard slot ${slot + 1}`, row, () => {
        const next = structuredClone(session.profile); next.inventory[slot] = null;
        if (session.save(next, true)) { changed(); draw(); } else el('p', 'message', panel, session.message);
      }, 'secondary');
    });
  }; draw();
}
