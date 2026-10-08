/** The Results screen (§3): Victory or Defeat, run time and each player's numbers. */
import type { PlayerStats } from '../net/messages';
import { button, el } from './menus';

export interface ResultsData {
  result: 'victory' | 'defeat';
  timeMs: number;
  /** Players still connected at the end, sorted by ID. */
  players: Array<PlayerStats & { name: string; me: boolean }>;
}

export interface ResultsActions {
  /** `Back to title` in singleplayer, `Leave` in multiplayer. */
  onLeave: () => void;
  /** Multiplayer: `Back to lobby`, back to the same Lobby with the same players. */
  onBackToLobby?: () => void;
}

export interface ResultsView {
  el: HTMLElement;
  /** The host left: `Back to lobby` is disabled and a message says why. */
  hostLeft: () => void;
}

function formatTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Builds the Results screen. Revive assists are left out when the game had one player. */
export function showResults(data: ResultsData, a: ResultsActions): ResultsView {
  const screen = el('div', 'screen results');
  el('h1', '', screen, data.result === 'victory' ? 'Victory' : 'Defeat');
  // On the panel, so everything stays readable over the painting.
  const panel = el('div', 'panel', screen);
  el('div', 'run-time', panel, `Run time ${formatTime(data.timeMs)}`);
  const table = el('table', 'results-table', panel);
  const columns: Array<[string, (p: ResultsData['players'][number]) => string]> = [
    ['Kills', (p) => String(p.kills)],
    ['Damage', (p) => p.damage.toLocaleString('en-US')],
    ['Deaths', (p) => String(p.deaths)],
  ];
  if (data.players.length > 1) columns.push(['Revive assists', (p) => String(p.reviveAssists)]);
  const head = table.createTHead().insertRow();
  head.appendChild(document.createElement('th'));
  for (const [label] of columns) el('th', '', head, label);
  const body = table.createTBody();
  for (const p of data.players) {
    const tr = body.insertRow();
    tr.classList.toggle('me', p.me);
    tr.insertCell().textContent = p.name;
    for (const [, value] of columns) tr.insertCell().textContent = value(p);
  }
  const message = el('div', 'message', panel);
  const buttons = el('div', 'buttons', screen);
  button(a.onBackToLobby ? 'Leave' : 'Back to title', buttons, a.onLeave, a.onBackToLobby ? 'secondary' : undefined);
  const lobby = a.onBackToLobby ? button('Back to lobby', buttons, a.onBackToLobby) : null;
  return {
    el: screen,
    hostLeft: () => {
      if (lobby) lobby.disabled = true;
      message.textContent = 'The host left the game.';
    },
  };
}
