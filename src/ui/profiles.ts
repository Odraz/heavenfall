/**
 * One current profile, managed from title Settings under the gameplay lock. The Profile screen shows
 * progress first and the save tools second; Import is a separate view at the same panel size, and
 * every confirmation appears in a reserved message line, so the panel never grows or moves (audit
 * batch 2, A3).
 */
import { button, el, PORTRAITS } from './menus';
import { exportCode, importCode, MAX_CODE_BYTES } from '../profile/codec';
import { absolutionForXp, createProfile, importProfile, levelForXp, type Profile } from '../profile/model';
import { roman } from '../data/edicts';
import { ProfileSession } from '../profile/storage';
import { CLASS_IDS, CLASSES, type ClassId } from '../data/classes';
import { hasCatalog } from '../data/talents';
import { abilityDef, learnedError, pointsFor } from '../sim/build';
import { spriteUrl } from '../render/atlas';
import { talentPanel } from './talents';
import { ITEMS } from '../data/items';
import { ITEM_ART } from '../client/itemArt';
import { xpProgress } from '../client/hudModel';
import { relicPanel } from './relics';
import { relicDormancy } from '../sim/relicUse';
import { resolveKit } from '../sim/build';
import { activeCombo, RELICS, type RelicId } from '../data/relics';

/** How long a destructive button waits for its confirming second press. */
const CONFIRM_MS = 10000;

export function profilesScreen(session: ProfileSession, onBack: () => void, onChanged: () => void): HTMLElement {
  const screen = el('div', 'screen menu'); el('h2', 'screen-title', screen, 'Profile');
  const panel = el('div', 'panel profile-panel', screen);
  let busy = false;
  const action = async (message: HTMLElement, fn: () => Promise<void>): Promise<void> => {
    if (busy) return; busy = true;
    try { await fn(); } catch (error) { message.textContent = error instanceof Error ? error.message : String(error); }
    finally { busy = false; }
  };

  // Progress view: who you are, each class's level, then the save code tools.
  const main = el('div', 'profile-view', panel);
  const stats = el('div', 'profile-stats', main);
  const classes = el('div', 'profile-classes', main);
  el('div', 'section-label', main, 'Save code');
  el('p', 'profile-note', main, 'Copy your code to back up your progress or move it to another browser.');
  const tools = el('div', 'buttons', main);
  const message = el('div', 'message', main);
  const footer = el('div', 'buttons profile-footer', main);

  // Import view, swapped in at the same panel size.
  const importView = el('div', 'profile-view', panel);
  importView.hidden = true;
  el('p', 'profile-note', importView, 'Paste a save code. It replaces your current progress and carried items, so copy your own code first.');
  const code = el('textarea', 'text-input', importView); code.maxLength = MAX_CODE_BYTES;
  code.setAttribute('aria-label', 'Import code'); code.spellcheck = false;
  const importMessage = el('div', 'message', importView);
  const importButtons = el('div', 'buttons profile-footer', importView);

  const refresh = (): void => {
    stats.replaceChildren();
    if (session.recovery) el('span', '', stats, 'Saved progress needs recovery');
    else {
      el('span', '', stats, session.profile.name);
      const wins = el('span', '', stats); el('b', '', wins, String(session.profile.stats.wins)); wins.append(' victories');
      const runs = el('span', '', stats); el('b', '', runs, String(session.profile.stats.runs)); runs.append(' runs');
    }
    classes.replaceChildren();
    for (const id of CLASS_IDS) {
      const xp = xpProgress(session.profile.characters[id].xp);
      const row = el('div', 'profile-class', classes);
      const portrait = el('div', 'profile-portrait', row);
      const img = el('img', '', portrait); img.src = PORTRAITS[id]; img.alt = '';
      const meta = el('div', 'profile-class-meta', row);
      el('div', 'profile-class-name', meta, CLASSES[id].name);
      el('div', 'profile-class-level', meta, `Level ${xp.level} · ${xp.max ? 'Max' : `${xp.into} / ${xp.span}`}`);
      el('i', '', el('div', 'profile-xp', meta)).style.width = `${xp.percent}%`;
    }
  };
  refresh();
  if (session.recovery) message.textContent = `${session.recovery.message}. Copy original data before importing or clearing.`;

  const copy = button(session.recovery ? 'Copy original data' : 'Copy code', tools, () => void action(message, async () => {
    await navigator.clipboard.writeText(session.recovery ? JSON.stringify(session.recovery.raw) : await exportCode(session.profile));
    message.textContent = 'Save code copied';
  }), 'small');
  const showImport = (open: boolean): void => {
    main.hidden = open; importView.hidden = !open;
    importMessage.textContent = ''; replacement = null;
  };
  button('Import code', tools, () => showImport(true), 'small');

  let clearUntil = 0;
  const clear = button('Clear progress', footer, () => void action(message, async () => {
    if (performance.now() > clearUntil) {
      clearUntil = performance.now() + CONFIRM_MS; clear.textContent = 'Confirm clear';
      message.textContent = 'This clears all progress and carried items. Copy your code first to keep them.'; return;
    }
    if (!session.replace(createProfile(session.profile.name))) throw new Error('Cannot clear this profile');
    clearUntil = 0; clear.textContent = 'Clear progress'; onChanged(); refresh(); copy.textContent = 'Copy code'; message.textContent = 'Profile cleared';
  }), 'small secondary');
  button('Back', footer, onBack, 'small secondary');

  let replacement: { code: string; expires: number } | null = null;
  button('Import', importButtons, () => void action(importMessage, async () => {
    const parsed = await importCode(code.value);
    if (!replacement || replacement.code !== code.value || performance.now() > replacement.expires) {
      replacement = { code: code.value, expires: performance.now() + CONFIRM_MS };
      importMessage.textContent = 'Press Import again to replace your progress and carried items. Copy your code first to keep them.'; return;
    }
    if (!session.replace(importProfile(parsed, []).profile)) throw new Error('Cannot save imported profile');
    code.value = ''; onChanged(); refresh(); copy.textContent = 'Copy code';
    showImport(false); message.textContent = 'Profile imported';
  }), 'small');
  button('Back', importButtons, () => showImport(false), 'small secondary');
  return screen;
}

function talentsLabel(profile: Profile, id: ClassId): string {
  const c = profile.characters[id], free = pointsFor(levelForXp(c.xp)) - c.talents.length;
  return free > 0 ? `Talents · ${free} to learn` : 'Talents';
}

/** The class card's Q and E show the assigned abilities, alternatives included (§9.4). */
function showAssigned(card: HTMLElement, id: ClassId, profile: Profile): void {
  const cells = card.querySelectorAll<HTMLElement>('.class-ability');
  (['Q', 'E'] as const).forEach((slot, i) => {
    const cell = cells[i];
    if (!cell) return;
    const def = abilityDef(id, slot, slot === 'Q' ? profile.characters[id].q : profile.characters[id].e);
    const img = cell.querySelector('img'), name = cell.querySelector('.class-ability-name');
    if (img) img.src = spriteUrl(def.icon);
    if (name) name.textContent = def.name;
  });
}

/** Learning and respec in the Lobby (§9.5): the whole result is saved once it passes the learned check. */
function openLobbyTalents(session: ProfileSession, id: ClassId, saved: () => void): void {
  const c = session.profile.characters[id];
  const close = (): void => { view.el.remove(); };
  const view = talentPanel({
    classId: id, build: { talents: c.talents, q: c.q, e: c.e }, rites: [], level: levelForXp(c.xp), title: `${CLASSES[id].name} · Talents`,
    onApply: (b) => {
      if (session.profile.run) { view.setMessage('Finish or recover the staked run first'); return; }
      const error = learnedError(id, b, levelForXp(session.profile.characters[id].xp));
      if (error) { view.setMessage(error); return; }
      const next = structuredClone(session.profile);
      Object.assign(next.characters[id], { talents: [...b.talents], q: b.q, e: b.e });
      if (!session.save(next, true)) { view.setMessage(session.message); return; }
      view.setBuild(b, []); view.setMessage('Saved'); saved();
    },
    onClose: close,
  });
  document.body.appendChild(view.el);
}

/** The class card's level line: Absolution past level 10, the best streak and the best Sentence won (§2.5, §9.2, §10). */
function classRecord(profile: Profile, id: ClassId): string {
  const c = profile.characters[id], level = levelForXp(c.xp), rank = absolutionForXp(c.xp);
  const parts = [`Level ${level}${rank > 0 ? ` · Absolution ${roman(rank)}` : ''}`];
  if (c.bestStreak > 0) parts.push(`streak ${c.bestStreak}`);
  if ((c.bestSentence[1] ?? 0) > 0) parts.push(`Sentence ${c.bestSentence[1]}`);
  return parts.join(' · ');
}

/** Equipping in the Lobby (§2.2, §8.1): any owned relic on either slot, saved for that character. */
function openLobbyRelics(session: ProfileSession, id: ClassId, saved: () => void): void {
  const c = session.profile.characters[id];
  const kit = resolveKit(id, { talents: c.talents, rites: [], q: c.q, e: c.e });
  const items = session.profile.inventory.flatMap((s) => (s ? [s.item] : []));
  const close = (): void => { view.el.remove(); };
  const view = relicPanel({
    title: `${CLASSES[id].name} · Relics`, owned: session.profile.relics, equipped: [c.relics[0], c.relics[1]],
    dormancy: (relic: RelicId) => relicDormancy(relic, kit, { allies: [], items, areas: new Set(), hazard: true }),
    note: 'Equip two relics. In a run, change them only with the Advocate in the Confessional.',
    onApply: (equipped) => {
      if (session.profile.run) { view.setMessage('Finish or recover the staked run first'); return; }
      if (equipped.some((r) => r && !session.profile.relics.includes(r)) || (equipped[0] && equipped[0] === equipped[1])) { view.setMessage('Equip owned relics, each once'); return; }
      const next = structuredClone(session.profile);
      next.characters[id].relics = [equipped[0], equipped[1]];
      if (!session.save(next, true)) { view.setMessage(session.message); return; }
      view.setEquipped(equipped); view.setMessage('Saved'); saved();
    },
    onClose: close,
  });
  document.body.appendChild(view.el);
}

/** The class card's relic line: the equipped pair and the combo they make, if any. */
function relicsLabel(profile: Profile, id: ClassId): string {
  const r = profile.characters[id].relics, combo = activeCombo(r);
  const names = r.filter(Boolean).map((x) => RELICS[x as RelicId].name);
  return combo ? `Relics · ${combo.name}` : names.length ? `Relics · ${names.length}` : profile.relics.length ? 'Relics · none equipped' : 'Relics';
}

/** Emergency export stays available if an accepted checkpoint cannot reach storage. */
export function saveCodeButton(parent: HTMLElement, profile: () => Profile): void {
  button('Copy save code', parent, () => { void exportCode(profile()).then(code => navigator.clipboard.writeText(code)).catch(error => { el('p', 'message', parent, String(error)); }); });
}

/**
 * The class cards' levels and the carried items (audit batch 2): the same round slots as in game,
 * each item's one-line rule, and the risk stated plainly. Relics stay hidden until they exist (R6).
 */
export function profileLoadout(parent: HTMLElement, session: ProfileSession, changed: () => void = () => {}): void {
  for (const id of CLASS_IDS) {
    const card = parent.querySelector<HTMLElement>(`.class-card[data-class-id="${id}"]`);
    if (!card) continue;
    const level = el('div', 'class-level', undefined, classRecord(session.profile, id)); card.insertBefore(level, card.querySelector('.class-role'));
    showAssigned(card, id, session.profile);
    // One row of card buttons, so every card keeps its rows aligned (UI stability).
    const actions = el('div', 'class-actions', card);
    if (hasCatalog(id)) {
      // A button can't hold a button: a focusable role=button inside the class card.
      const open = el('div', 'button small class-talents', actions, talentsLabel(session.profile, id));
      open.setAttribute('role', 'button'); open.tabIndex = 0;
      // A card click picks the class; the Talents button opens the trees without picking.
      open.addEventListener('click', (e) => { e.stopPropagation(); openLobbyTalents(session, id, () => { open.textContent = talentsLabel(session.profile, id); showAssigned(card, id, session.profile); changed(); }); });
    }
    const relics = el('div', 'button small class-relics', actions, relicsLabel(session.profile, id));
    relics.setAttribute('role', 'button'); relics.tabIndex = 0;
    relics.addEventListener('click', (e) => { e.stopPropagation(); openLobbyRelics(session, id, () => { relics.textContent = relicsLabel(session.profile, id); changed(); }); });
  }
  const container = parent.querySelector('.panel') ?? parent;
  const panel = el('div', 'profile-loadout');
  const cards = container.querySelector('.class-cards');
  if (cards) cards.after(panel); else container.append(panel);
  const draw = (): void => {
    panel.replaceChildren(); el('div', 'section-label', panel, 'Carried into your next run');
    const stacks = el('div', 'loadout-items', panel);
    session.profile.inventory.forEach((stack, slot) => {
      const row = el('div', 'loadout-item', stacks);
      const round = el('div', `item-slot${stack ? '' : ' empty'}`, row);
      const text = el('div', 'loadout-text', row);
      if (stack) {
        const icon = el('img', 'item-icon', round); icon.src = ITEM_ART[stack.item]; icon.alt = '';
        el('div', 'item-count', round, String(stack.count));
        el('div', 'loadout-name', text, `${ITEMS[stack.item].name} ×${stack.count}`);
        el('div', 'loadout-rule', text, ITEMS[stack.item].rule);
      } else {
        el('div', 'loadout-name empty', text, 'Empty slot');
        el('div', 'loadout-rule', text, 'Buy from the Pardoner or pick up in a run.');
      }
      if (stack && !session.profile.run) {
        const discard = button('Discard', row, () => {
          const next = structuredClone(session.profile); next.inventory[slot] = null;
          if (session.save(next, true)) { changed(); draw(); } else risk.textContent = session.message;
        }, 'loadout-discard');
        discard.setAttribute('aria-label', `Discard item ${slot + 1}`);
      }
    });
    const risk = el('div', 'loadout-risk', panel, 'Carried items are lost if you die before the Gatekeeper falls.');
  };
  draw();
}
