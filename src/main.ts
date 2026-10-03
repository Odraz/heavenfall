/** Entry: boots the UI and owns the top-level screen state machine. */
import './style.css';
import type { ClassId } from './data/classes';
import { debugState, resetGameDebug, type Screen } from './debug';
import { getDungeon } from './data/dungeons/index';
import { parseParams } from './params';
import { loadMap } from './sim/map';
import { loadBlessedAnims } from './render/animAtlas';
import { buildAtlas } from './render/atlas';
import { Game, type RosterEntry } from './client/game';
import { HostSession } from './client/hostSession';
import { loadingScreen, singleplayerSetupScreen, titleScreen } from './ui/menus';
import { showResults } from './ui/results';

const params = parseParams(window.location.search);
const root = document.getElementById('app')!;

/** The DOM screen currently shown over `#app`, if any. */
let screenEl: HTMLElement | null = null;

function show(screen: Screen, el: HTMLElement | null): void {
  screenEl?.remove();
  screenEl = el;
  if (el) document.body.appendChild(el);
  debugState.screen = screen;
}

/** Title (§3). `message` is the message line, cleared by the next button press. */
function toTitle(message = ''): void {
  resetGameDebug();
  show('title', titleScreen({ message, onSingleplayer: (name) => toSingleplayerSetup(name) }));
}

function toSingleplayerSetup(name: string): void {
  show(
    'singleplayerSetup',
    singleplayerSetupScreen({
      onStart: (classId, dungeonId) => void startSingleplayer(name, classId, dungeonId, null),
      onBack: () => toTitle(),
    }),
  );
}

/**
 * A singleplayer game: from Singleplayer Setup's `Start`, or straight from the page load with `dev=1`
 * or `bench=1`. Loading builds the map and sprite atlas, then enters the game (§3).
 */
async function startSingleplayer(name: string, classId: ClassId, dungeonId: string, seed: number | null): Promise<void> {
  // The worker starts when the player clicks Start, or the page loads with dev=1 or bench=1 (§2.2).
  const host = new HostSession(0);
  const loading = loadingScreen();
  show('loading', loading.el);
  loading.set('Building the map…');
  const dungeon = getDungeon(dungeonId)!;
  const map = loadMap(dungeon);
  loading.set('Drawing the sprites…');
  const [atlas, blessed] = await Promise.all([buildAtlas(), loadBlessedAnims()]);
  const roster: RosterEntry[] = [{ id: 0, name, classId }];
  // The session ends at Results or on leaving: the worker is terminated (§2.2).
  const end = (): void => {
    game.dispose();
    host.stop();
  };
  const game = new Game({
    root,
    map,
    atlas,
    blessed,
    params,
    transport: host.local,
    host,
    localPlayerId: 0,
    roster,
    singleplayer: true,
    onResults: (data) => {
      end();
      show('results', showResults(data, () => toTitle()));
    },
    onLeave: () => {
      end();
      toTitle();
    },
  });
  host.start(dungeon.id, roster, seed ?? (Math.random() * 2 ** 32) >>> 0, params.god, params.bench, true);
  show('inGame', null);
  game.start();
}

if (params.bench || params.dev) void startSingleplayer('Dev', params.classId, params.mapId, params.seed);
else toTitle();
