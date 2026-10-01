/** Entry: boots the UI and owns the top-level screen state machine. */
import './style.css';
import { debugState } from './debug';
import { getDungeon } from './data/dungeons/index';
import { parseParams } from './params';
import { loadMap } from './sim/map';
import { buildAtlas } from './render/atlas';
import { Game, type RosterEntry } from './client/game';
import { HostSession } from './client/hostSession';
import { showResults } from './ui/results';

const params = parseParams(window.location.search);
const root = document.getElementById('app')!;

function setLoading(text: string | null): void {
  let el = document.getElementById('loading');
  if (text === null) {
    el?.remove();
    return;
  }
  if (!el) {
    el = document.createElement('div');
    el.id = 'loading';
    el.className = 'screen loading';
    document.body.appendChild(el);
  }
  el.textContent = text;
}

/** Singleplayer with the menus skipped (`dev=1`, and until milestone 5 every page load) or the benchmark. */
async function bootSingleplayer(): Promise<void> {
  // The worker starts when the page loads with dev=1 or bench=1 (§2.2).
  const host = new HostSession(0);
  debugState.screen = 'loading';
  setLoading('Building the map…');
  const dungeon = getDungeon(params.mapId)!;
  const map = loadMap(dungeon);
  setLoading('Drawing the sprites…');
  const atlas = await buildAtlas();
  const roster: RosterEntry[] = [{ id: 0, name: 'Dev', classId: params.classId }];
  const seed = params.seed ?? (Math.random() * 2 ** 32) >>> 0;
  const game = new Game({
    root,
    map,
    atlas,
    params,
    transport: host.local,
    host,
    localPlayerId: 0,
    roster,
    onResults: (data) => {
      // The session ends at Results (§3). Until milestone 5, Back to title reloads the page.
      game.dispose();
      host.stop();
      debugState.screen = 'results';
      showResults(data, () => window.location.reload());
    },
  });
  host.start(dungeon.id, roster, seed, params.god, params.bench, true);
  setLoading(null);
  debugState.screen = 'inGame';
  game.start();
}

void bootSingleplayer();
