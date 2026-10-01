/** Entry: boots the UI and owns the top-level screen state machine. */
import './style.css';
import { debugState } from './debug';
import { getDungeon } from './data/dungeons/index';
import { parseParams } from './params';
import { loadMap } from './sim/map';
import { Game } from './client/game';

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

async function boot(): Promise<void> {
  debugState.screen = 'loading';
  setLoading('Building the map…');
  const map = loadMap(getDungeon(params.mapId)!);
  await new Promise((r) => setTimeout(r, 0));
  const game = new Game(root, map, params);
  setLoading(null);
  debugState.screen = 'inGame';
  game.start();
}

void boot();
