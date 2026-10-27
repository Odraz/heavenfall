/** The Results screen (§3): Victory or Defeat, run time and each player's numbers. */
import type { PlayerStats } from '../net/messages';
import { button, el } from './menus';
import { DEEDS, DEED_RELIC, RELICS, type DeedId, type RelicId } from '../data/relics';
import { sentenceFactor } from '../data/edicts';

export interface ResultsData {
  result: 'victory' | 'defeat';
  timeMs: number;
  unclaimed?: boolean;
  /** The run's Sentence (§2.5) and the streak crown's player id, or -1 (§10). */
  sentence?: number;
  crown?: number;
  /** Players still connected at the end, sorted by ID. */
  players: Array<PlayerStats & { name: string; me: boolean; id?: number }>;
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
  if (data.unclaimed) el('p', 'message', panel, 'Unclaimed choices expired at the exit.');
  if (data.sentence) el('div', 'run-time', panel, `Sentence ${data.sentence} · XP ×${sentenceFactor(data.sentence).toFixed(2)}`);
  const crowned = data.players.find((p) => p.id === data.crown);
  if (crowned) el('div', 'results-crown', panel, `Streak crown: ${crowned.name} · ${crowned.bestStreak ?? 0}`);
  const table = el('table', 'results-table', panel);
  const columns: Array<[string, (p: ResultsData['players'][number]) => string]> = [
    ['Kills', (p) => String(p.kills)],
    ['Damage', (p) => p.damage.toLocaleString('en-US')],
    ['Deaths', (p) => String(p.deaths)],
    ['Best streak', (p) => String(p.bestStreak ?? 0)],
    ['XP gained', p => String(p.runXp ?? 0)],
    ['Level', p => (p.levelBefore ?? 1) === (p.levelAfter ?? 1) ? String(p.levelAfter ?? 1) : `${p.levelBefore ?? 1} → ${p.levelAfter ?? 1}`],
  ];
  if (data.players.length > 1) columns.push(['Revive assists', (p) => String(p.reviveAssists)]);
  if (data.players.some((p) => p.rites?.length)) columns.push(['Rites', (p) => p.rites?.join(', ') || '—']);
  if (data.players.some((p) => p.relics?.length)) columns.push(['Relics', (p) => p.relics?.map((id) => RELICS[id as RelicId]?.name ?? id).join(', ') || '—']);
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
  // Deeds done: each names the relic it grants (§8.6).
  for (const p of data.players) for (const d of p.deeds ?? []) {
    const deed = DEEDS[d as DeedId];
    if (deed) el('div', 'results-deed', panel, `${p.me ? '' : `${p.name} · `}Deed: ${deed.name} — ${RELICS[DEED_RELIC[d as DeedId]].name} is yours`);
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
