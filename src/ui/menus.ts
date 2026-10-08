/** The Title and Singleplayer Setup screens (§3), and helpers shared with the other screens. */
import { CLASS_IDS, CLASSES, type ClassId } from '../data/classes';
import { ABILITIES, SECONDARIES, WEAPONS } from '../data/weapons';
import { mouseGlyph } from './mouseGlyph';
import { spriteUrl } from '../render/atlas';
import { attachTooltip } from './tooltip';
import { settingsButton } from './volume';
import fallenPortrait from '../../assets/ui/portrait-fallen.png';
import hereticPortrait from '../../assets/ui/portrait-heretic.png';
import binderPortrait from '../../assets/ui/portrait-binder.png';
import betrayerPortrait from '../../assets/ui/portrait-betrayer.png';
import logoUrl from '../../assets/ui/ui-logo.png';

/** Each class's idle frame from the front, rendered from its 3D model (§11.2). */
const PORTRAITS: Record<ClassId, string> = { fallen: fallenPortrait, heretic: hereticPortrait, binder: binderPortrait, betrayer: betrayerPortrait };

const NAME_KEY = 'heavenfall.name';
export const NAME_MAX = 16;

/** The dungeons offered in the menus; the sandbox isn't selectable (§2.5). */
export const MENU_DUNGEONS: ReadonlyArray<{ id: string; name: string }> = [{ id: 'pearly-gates', name: 'The Pearly Gates' }];

/** The trimmed player name if it's valid (1–16 characters after trimming), otherwise null. */
export function validName(raw: string): string | null {
  const name = raw.trim();
  return name.length >= 1 && name.length <= NAME_MAX ? name : null;
}

function loadName(): string {
  try {
    return localStorage.getItem(NAME_KEY) ?? '';
  } catch {
    return '';
  }
}

function saveName(name: string): void {
  try {
    localStorage.setItem(NAME_KEY, name);
  } catch {
    // Storage may be unavailable; the name just isn't remembered.
  }
}

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

export function button(label: string, parent: HTMLElement, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = el('button', `button ${extra}`.trim(), parent, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export interface TitleActions {
  /** The message line, empty unless set by a return to Title; the next button press clears it. */
  message: string;
  /** The game ID of an invite link (M8 §6.1): Title offers `Join game <ID>`. */
  joinId: string | null;
  onJoinInvite: (name: string) => void;
  onSingleplayer: (name: string) => void;
  onMultiplayer: (name: string) => void;
}

export function titleScreen(a: TitleActions): HTMLElement {
  const screen = el('div', 'screen menu title-screen');
  const logo = el('div', 'title-logo', screen);
  const logoImg = el('img', '', el('h1', '', logo));
  logoImg.src = logoUrl;
  logoImg.alt = 'Heavenfall';
  el('div', 'tagline', logo, 'The damned storm Heaven');

  const panel = el('div', 'panel', screen);
  const label = el('label', 'field', panel);
  el('span', 'field-label', label, 'Player name');
  const input = el('input', 'text-input', label);
  input.name = 'playerName';
  input.maxLength = NAME_MAX;
  input.autocomplete = 'off';
  input.spellcheck = false;
  input.value = loadName();
  const message = el('div', 'message', panel, a.message);

  const buttons = el('div', 'buttons', panel);
  const pressed = (): void => {
    message.textContent = '';
  };
  // An invite link adds `Join game <ID>` above `Singleplayer`.
  const invite = a.joinId
    ? button(`Join game ${a.joinId}`, buttons, () => {
        pressed();
        const name = validName(input.value);
        if (name) a.onJoinInvite(name);
      })
    : null;
  const single = button('Singleplayer', buttons, () => {
    pressed();
    const name = validName(input.value);
    if (name) a.onSingleplayer(name);
  });
  const multi = button('Multiplayer', buttons, () => {
    pressed();
    const name = validName(input.value);
    if (name) a.onMultiplayer(name);
  });

  // Every button is disabled while the name is empty (§3).
  const update = (): void => {
    single.disabled = multi.disabled = validName(input.value) === null;
    if (invite) invite.disabled = single.disabled;
  };
  input.addEventListener('input', () => {
    saveName(input.value);
    update();
  });
  update();
  settingsButton(panel, buttons);
  el('div', 'version', screen, `v${__BUILD_VERSION__}`);
  queueMicrotask(() => input.focus());
  return screen;
}

/**
 * A class card (§3, M8 §2.1): portrait, name, role and HP, the passive, the two weapon lines and the
 * Q and E abilities. Hovering the passive, a weapon or an ability shows its tooltip.
 */
export function classCard(id: ClassId, parent: HTMLElement): HTMLButtonElement {
  const c = CLASSES[id];
  const card = el('button', 'class-card', parent);
  card.type = 'button';
  card.dataset.classId = id;
  card.setAttribute('aria-pressed', 'false');
  const img = el('img', 'class-portrait', card);
  img.src = PORTRAITS[id];
  img.alt = '';
  el('div', 'class-name', card, c.name);
  el('div', 'class-role', card, `${c.role} · ${c.hp} HP`);
  // The passive, on its own line under the role and HP.
  const passive = el('div', 'class-passive', card);
  passive.append('Passive: ');
  attachTooltip(el('span', 'class-item', passive, c.passive.name), c.passive.name, c.passive.description);
  // Two weapon lines (M9 §6.1): the primary, then the secondary, each after its mouse glyph.
  for (const [button, weapon] of [['left', WEAPONS[id]], ['right', SECONDARIES[id]]] as const) {
    const weaponLine = el('div', 'class-weapon', card);
    weaponLine.append(mouseGlyph(button));
    attachTooltip(el('span', 'class-item', weaponLine, weapon.name), weapon.name, weapon.description);
  }
  const row = el('div', 'class-abilities', card);
  for (const key of ['Q', 'E'] as const) {
    const a = ABILITIES[id][key];
    const cell = el('div', 'class-ability', row);
    const slot = el('div', 'class-ability-slot', cell);
    const icon = el('img', '', slot);
    icon.src = spriteUrl(a.icon);
    icon.alt = '';
    el('div', 'class-ability-key', cell, key);
    el('div', 'class-ability-name', cell, a.name);
    attachTooltip(slot, a.name, a.description);
  }
  return card;
}

/** The dungeon picker with its only entry preselected; returns that dungeon's id. */
export function dungeonPicker(panel: HTMLElement): string {
  el('div', 'section-label', panel, 'Dungeon');
  const dungeons = el('div', 'dungeon-picker', panel);
  const dungeonId = MENU_DUNGEONS[0].id;
  for (const d of MENU_DUNGEONS) {
    const opt = el('button', 'dungeon-option', dungeons, d.name);
    opt.type = 'button';
    opt.setAttribute('aria-pressed', String(d.id === dungeonId));
  }
  return dungeonId;
}

export interface SetupActions {
  onStart: (classId: ClassId, dungeonId: string) => void;
  onBack: () => void;
}

export function singleplayerSetupScreen(a: SetupActions): HTMLElement {
  const screen = el('div', 'screen menu setup-screen');
  el('h2', 'screen-title', screen, 'Singleplayer');

  const panel = el('div', 'panel', screen);
  el('div', 'section-label', panel, 'Choose your class');
  const cards = el('div', 'class-cards', panel);
  let picked: ClassId | null = null;
  const cardEls = new Map<ClassId, HTMLButtonElement>();
  for (const id of CLASS_IDS) {
    const card = classCard(id, cards);
    card.addEventListener('click', () => {
      picked = id;
      for (const [cid, e] of cardEls) e.setAttribute('aria-pressed', String(cid === id));
      start.disabled = false;
    });
    cardEls.set(id, card);
  }

  const dungeonId = dungeonPicker(panel);

  const buttons = el('div', 'buttons', panel);
  button('Back', buttons, a.onBack, 'secondary');
  const start = button('Start', buttons, () => {
    if (picked) a.onStart(picked, dungeonId);
  });
  start.disabled = true;
  return screen;
}
