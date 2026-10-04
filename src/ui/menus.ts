/** The Title and Singleplayer Setup screens (§3). */
import { CLASS_IDS, CLASSES, type ClassId } from '../data/classes';
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

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, parent?: HTMLElement, text?: string): HTMLElementTagNameMap[K] {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (text !== undefined) e.textContent = text;
  parent?.appendChild(e);
  return e;
}

function button(label: string, parent: HTMLElement, onClick: () => void, extra = ''): HTMLButtonElement {
  const b = el('button', `button ${extra}`.trim(), parent, label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

export interface TitleActions {
  /** The message line, empty unless set by a return to Title; the next button press clears it. */
  message: string;
  onSingleplayer: (name: string) => void;
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
  const single = button('Singleplayer', buttons, () => {
    pressed();
    const name = validName(input.value);
    if (name) a.onSingleplayer(name);
  });
  // Multiplayer (Host Setup, Join, Lobby) arrives in milestone 7; until then the button stays disabled.
  const multi = button('Multiplayer', buttons, pressed);
  multi.disabled = true;
  multi.title = 'Coming soon';

  const update = (): void => {
    single.disabled = validName(input.value) === null;
  };
  input.addEventListener('input', () => {
    saveName(input.value);
    update();
  });
  update();
  el('div', 'version', screen, `v${__BUILD_VERSION__}`);
  queueMicrotask(() => input.focus());
  return screen;
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
    const c = CLASSES[id];
    const card = el('button', 'class-card', cards);
    card.type = 'button';
    card.dataset.classId = id;
    card.setAttribute('aria-pressed', 'false');
    const img = el('img', 'class-portrait', card);
    img.src = PORTRAITS[id];
    img.alt = '';
    el('div', 'class-name', card, c.name);
    el('div', 'class-role', card, `${c.role} · ${c.hp} HP`);
    el('div', 'class-desc', card, c.description);
    card.addEventListener('click', () => {
      picked = id;
      for (const [cid, e] of cardEls) e.setAttribute('aria-pressed', String(cid === id));
      start.disabled = false;
    });
    cardEls.set(id, card);
  }

  el('div', 'section-label', panel, 'Dungeon');
  const dungeons = el('div', 'dungeon-picker', panel);
  const dungeonId = MENU_DUNGEONS[0].id;
  for (const d of MENU_DUNGEONS) {
    const opt = el('button', 'dungeon-option', dungeons, d.name);
    opt.type = 'button';
    opt.setAttribute('aria-pressed', String(d.id === dungeonId));
  }

  const buttons = el('div', 'buttons', panel);
  button('Back', buttons, a.onBack, 'secondary');
  const start = button('Start', buttons, () => {
    if (picked) a.onStart(picked, dungeonId);
  });
  start.disabled = true;
  return screen;
}

/** The Loading screen: progress text only. */
export function loadingScreen(): { el: HTMLElement; set: (text: string) => void } {
  const screen = el('div', 'screen loading');
  const text = el('div', 'loading-text', screen);
  return { el: screen, set: (t) => (text.textContent = t) };
}
