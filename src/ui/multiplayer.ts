/** The Multiplayer, Host Setup, Join and Lobby screens (§3). */
import { CLASS_IDS, CLASSES, type ClassId } from '../data/classes';
import { GAME_ID_LENGTH, normalizeGameId } from '../net/gameId';
import { inviteLink } from '../net/invite';
import { CHAT_MAX, PASSWORD_MAX } from '../net/lobby';
import type { LobbyPlayer } from '../net/messages';
import { button, classCard, dungeonPicker, el, MENU_DUNGEONS } from './menus';

function textField(parent: HTMLElement, label: string, name: string, maxLength: number): HTMLInputElement {
  const field = el('label', 'field', parent);
  el('span', 'field-label', field, label);
  const input = el('input', 'text-input', field);
  input.name = name;
  input.maxLength = maxLength;
  input.autocomplete = 'off';
  input.spellcheck = false;
  return input;
}

export interface MultiplayerActions {
  onHost: () => void;
  onJoin: () => void;
  onBack: () => void;
}

export function multiplayerScreen(a: MultiplayerActions): HTMLElement {
  const screen = el('div', 'screen menu multiplayer-screen');
  el('h2', 'screen-title', screen, 'Multiplayer');
  const panel = el('div', 'panel', screen);
  const buttons = el('div', 'buttons buttons-column', panel);
  button('Host game', buttons, a.onHost);
  button('Join game', buttons, a.onJoin);
  button('Back', buttons, a.onBack, 'secondary');
  return screen;
}

/** A form screen's busy state and inline error (§3). */
export interface FormScreen {
  el: HTMLElement;
  /** Shows progress text while busy (buttons other than `Back` are disabled), or the error. */
  setStatus: (text: string, busy: boolean) => void;
}

export interface HostSetupActions {
  onCreate: (password: string, dungeonId: string) => void;
  onBack: () => void;
}

export function hostSetupScreen(a: HostSetupActions): FormScreen {
  const screen = el('div', 'screen menu form-screen');
  el('h2', 'screen-title', screen, 'Host game');
  const panel = el('div', 'panel', screen);
  const password = textField(panel, 'Password', 'password', PASSWORD_MAX);
  el('div', 'field-hint', panel, 'Leave empty for an open game.');
  const dungeonId = dungeonPicker(panel);
  const status = el('div', 'message', panel);
  const buttons = el('div', 'buttons', panel);
  button('Back', buttons, a.onBack, 'secondary');
  const create = button('Create', buttons, () => a.onCreate(password.value, dungeonId));
  queueMicrotask(() => password.focus());
  return {
    el: screen,
    setStatus: (text, busy) => {
      status.textContent = text;
      status.classList.toggle('error', !busy && text !== '');
      create.disabled = busy;
      password.disabled = busy;
    },
  };
}

export interface JoinActions {
  onJoin: (gameId: string, password: string) => void;
  onBack: () => void;
}

/** The Join screen; an invite link fills in the game ID and focuses the password (M8 §6.1). */
export function joinScreen(a: JoinActions, prefillId: string | null = null): FormScreen {
  const screen = el('div', 'screen menu form-screen');
  el('h2', 'screen-title', screen, 'Join game');
  const panel = el('div', 'panel', screen);
  const gameId = textField(panel, 'Game ID', 'gameId', GAME_ID_LENGTH);
  gameId.classList.add('game-id-input');
  if (prefillId) gameId.value = prefillId;
  const password = textField(panel, 'Password', 'password', PASSWORD_MAX);
  const status = el('div', 'message', panel);
  const buttons = el('div', 'buttons', panel);
  button('Back', buttons, a.onBack, 'secondary');
  let busy = false;
  const join = button('Join', buttons, () => {
    if (!join.disabled) a.onJoin(normalizeGameId(gameId.value), password.value);
  });
  const update = (): void => {
    join.disabled = busy || normalizeGameId(gameId.value).length !== GAME_ID_LENGTH;
  };
  // Case-insensitive: the field shows the ID normalized to upper case (§3).
  gameId.addEventListener('input', () => {
    const at = gameId.selectionStart;
    gameId.value = normalizeGameId(gameId.value);
    if (at !== null) gameId.setSelectionRange(Math.min(at, gameId.value.length), Math.min(at, gameId.value.length));
    update();
  });
  for (const input of [gameId, password]) {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') join.click();
    });
  }
  update();
  queueMicrotask(() => (prefillId ? password : gameId).focus());
  return {
    el: screen,
    setStatus: (text, b) => {
      busy = b;
      status.textContent = text;
      status.classList.toggle('error', !b && text !== '');
      gameId.disabled = b;
      password.disabled = b;
      update();
    },
  };
}

export interface LobbyActions {
  /** The game ID, shown large; null hides it (a client before the game). */
  gameId: string | null;
  /** The host gets `Copy invite link` and `Start`. */
  isHost: boolean;
  /** The in-progress Lobby (M8 §6.2): no `Start`, and `Enter game` once a free class is picked. */
  inProgress: boolean;
  playerId: number;
  onPick: (classId: ClassId) => void;
  onStart: () => void;
  onEnterGame: () => void;
  onChat: (text: string) => void;
  onLeave: () => void;
}

export interface LobbyView {
  el: HTMLElement;
  update: (lobby: { dungeonId: string; players: LobbyPlayer[] }) => void;
  /** Shows the chat log (M8 §7): `Name: text` per message, oldest first. */
  setChat: (lines: ReadonlyArray<{ name: string; text: string }>) => void;
  /** Presses `Enter game` if it's enabled (bot auto-join, M8 §6.4). */
  pressEnterGame: () => void;
}

const SLOTS = 4;

export function lobbyScreen(a: LobbyActions): LobbyView {
  const screen = el('div', 'screen menu lobby-screen');
  el('h2', 'screen-title', screen, 'Lobby');
  const panel = el('div', 'panel', screen);

  if (a.gameId !== null) {
    const row = el('div', 'game-id-row', panel);
    const box = el('div', 'game-id-box', row);
    el('div', 'field-label', box, 'Game ID');
    el('div', 'game-id', box, a.gameId);
    if (a.isHost) {
      // The host copies an invite link; the ID stays shown large, for typing (M8 §6.1).
      const copy = button('Copy invite link', row, () => {
        const done = (text: string): void => {
          copy.textContent = text;
          setTimeout(() => (copy.textContent = 'Copy invite link'), 1500);
        };
        navigator.clipboard?.writeText(inviteLink(window.location.href, a.gameId!)).then(
          () => done('Copied'),
          () => done('Copy failed'),
        );
      });
      copy.classList.add('secondary');
      el('div', 'field-hint', panel, 'Send the invite link (and the password, if any) to your friends.');
    }
  }
  const dungeon = el('div', 'lobby-dungeon', panel);
  if (a.inProgress) el('div', 'field-hint', panel, 'The game is in progress. Pick a free class and enter.');

  el('div', 'section-label', panel, a.inProgress ? 'Players in the game' : 'Players');
  const slotList = el('div', 'lobby-slots', panel);
  const slots = Array.from({ length: SLOTS }, () => {
    const row = el('div', 'lobby-slot', slotList);
    const name = el('span', 'slot-name', row);
    const tag = el('span', 'slot-tag', row);
    const cls = el('span', 'slot-class', row);
    return { row, name, tag, cls };
  });

  // Chat (M8 §7): the last 50 messages and a field; Enter sends.
  const chat = el('div', 'lobby-chat', panel);
  const log = el('div', 'lobby-chat-log', chat);
  const field = el('input', 'text-input lobby-chat-input', chat);
  field.maxLength = CHAT_MAX;
  field.placeholder = 'Chat — Enter sends';
  field.setAttribute('aria-label', 'Chat');
  field.autocomplete = 'off';
  field.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const text = field.value.trim();
    field.value = '';
    if (text) a.onChat(text);
  });

  el('div', 'section-label', panel, 'Choose your class');
  const cards = el('div', 'class-cards', panel);
  const cardEls = new Map<ClassId, { card: HTMLButtonElement; taken: HTMLDivElement }>();
  for (const id of CLASS_IDS) {
    const card = classCard(id, cards);
    const taken = el('div', 'class-taken', card);
    card.addEventListener('click', () => a.onPick(id));
    cardEls.set(id, { card, taken });
  }

  const buttons = el('div', 'buttons', panel);
  button('Leave', buttons, a.onLeave, 'secondary');
  const start = a.isHost && !a.inProgress ? button('Start', buttons, a.onStart) : null;
  if (start) start.disabled = true;
  let entering = false;
  const enter = a.inProgress
    ? button('Enter game', buttons, () => {
        if (enter!.disabled) return;
        entering = true;
        enter!.disabled = true;
        a.onEnterGame();
      })
    : null;
  if (enter) enter.disabled = true;

  return {
    el: screen,
    update: (lobby) => {
      dungeon.textContent = MENU_DUNGEONS.find((d) => d.id === lobby.dungeonId)?.name ?? lobby.dungeonId;
      const byId = [...lobby.players].sort((p, q) => p.id - q.id);
      slots.forEach((s, i) => {
        const p = byId[i];
        s.row.classList.toggle('empty', !p);
        s.row.classList.toggle('me', p?.id === a.playerId);
        s.name.textContent = p ? p.name : 'Waiting for a player…';
        s.tag.textContent = p?.isHost ? 'host' : '';
        s.tag.hidden = !p?.isHost;
        s.cls.textContent = p ? (p.classId ? CLASSES[p.classId].name : 'Choosing a class…') : '';
      });
      // A class taken by another player is greyed out and shows who took it (§3).
      for (const [id, { card, taken }] of cardEls) {
        const owner = lobby.players.find((p) => p.classId === id);
        const mine = owner?.id === a.playerId;
        card.setAttribute('aria-pressed', String(mine));
        card.disabled = (!!owner && !mine) || entering;
        card.classList.toggle('taken', !!owner && !mine);
        taken.textContent = owner && !mine ? `Taken by ${owner.name}` : '';
      }
      // Start is enabled only when every connected player has picked a class (§3); Enter game once
      // this player has (M8 §6.2).
      if (start) start.disabled = !lobby.players.every((p) => p.classId);
      if (enter) enter.disabled = entering || !lobby.players.find((p) => p.id === a.playerId)?.classId;
    },
    pressEnterGame: () => enter?.click(),
    setChat: (lines) => {
      const atEnd = log.scrollTop + log.clientHeight >= log.scrollHeight - 4;
      log.replaceChildren(
        ...lines.map((l) => {
          const line = document.createElement('div');
          line.className = 'chat-line';
          // Plain text, never HTML (M8 §7).
          line.textContent = `${l.name}: ${l.text}`;
          return line;
        }),
      );
      if (atEnd) log.scrollTop = log.scrollHeight;
    },
  };
}
