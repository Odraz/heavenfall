/** Entry: boots the UI and owns the top-level screen state machine. */
import './style.css';
import { CLASS_IDS, type ClassId } from './data/classes';
import { debugState, resetGameDebug, type Screen } from './debug';
import { getDungeon } from './data/dungeons/index';
import { parseParams } from './params';
import { loadMap } from './sim/map';
import { loadEnemyAnims, loadPlayerAnims } from './render/animAtlas';
import { buildAtlas } from './render/atlas';
import { loadGameTextures } from './render/textures';
import { Game, type RosterEntry } from './client/game';
import { HostSession } from './client/hostSession';
import { createHostNet } from './net/hostNet';
import type { CtrlMessage, LobbyPlayer } from './net/messages';
import type { NetStats } from './net/netStats';
import { joinGame, type PeerTransport } from './net/peerTransport';
import type { Transport } from './net/transport';
import { withoutJoin } from './net/invite';
import { loadingScreen, singleplayerSetupScreen, titleScreen, validName } from './ui/menus';
import { hostSetupScreen, joinScreen, lobbyScreen, multiplayerScreen } from './ui/multiplayer';
import { showResults } from './ui/results';
import { hideTooltip } from './ui/tooltip';
import { initAudio, setMusic, sfx } from './audio/audio';

const params = parseParams(window.location.search);
const root = document.getElementById('app')!;

/** The DOM screen currently shown over `#app`, if any. */
let screenEl: HTMLElement | null = null;

/** Screens with the calm track (M8 §9.2); the game sets its own music, and Results stays silent. */
const CALM_SCREENS: ReadonlySet<Screen> = new Set(['title', 'singleplayerSetup', 'multiplayer', 'hostSetup', 'join', 'lobby', 'loading']);

function show(screen: Screen, el: HTMLElement | null): void {
  hideTooltip();
  if (CALM_SCREENS.has(screen)) setMusic('calm');
  else if (screen === 'results') setMusic(null);
  screenEl?.remove();
  screenEl = el;
  if (el) document.body.appendChild(el);
  debugState.screen = screen;
}

/** The game ID of the invite link the page was opened with, until its Join screen opens (M8 §6.1). */
let inviteId = params.join;

/** Title (§3). `message` is the message line, cleared by the next button press. */
function toTitle(message = ''): void {
  resetGameDebug();
  show(
    'title',
    titleScreen({
      message,
      joinId: inviteId,
      onJoinInvite: (name) => toJoin(name, inviteId),
      onSingleplayer: (name) => toSingleplayerSetup(name),
      onMultiplayer: (name) => toMultiplayer(name),
    }),
  );
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

/** Builds the map and loads the sprite atlases and textures a game needs (§3 Loading). */
async function loadGameAssets(dungeonId: string, roster: RosterEntry[], localId: number, progress: (text: string) => void) {
  progress('Building the map…');
  const map = loadMap(getDungeon(dungeonId)!);
  progress('Drawing the sprites…');
  // Only other players are drawn as billboards, so the local class's atlas isn't needed.
  const others = roster.filter((r) => r.id !== localId).map((r) => r.classId);
  const [atlas, textures, enemyAnims, players] = await Promise.all([buildAtlas(), loadGameTextures(), loadEnemyAnims(), loadPlayerAnims(others)]);
  return { map, atlas, textures, enemyAnims, players };
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
  const roster: RosterEntry[] = [{ id: 0, name, classId }];
  const assets = await loadGameAssets(dungeonId, roster, 0, loading.set);
  // The session ends at Results or on leaving: the worker is terminated (§2.2).
  const end = (): void => {
    game.dispose();
    host.stop();
  };
  const game = new Game({
    root,
    ...assets,
    params,
    transport: host.local,
    host,
    localPlayerId: 0,
    roster,
    singleplayer: true,
    net: null,
    onResults: (data) => {
      end();
      show('results', showResults(data, () => toTitle()));
    },
    onLeave: () => {
      end();
      toTitle();
    },
  });
  host.local.onCtrl = (msg) => game.handleCtrl(msg);
  await game.prepare();
  host.start(dungeonId, roster, seed ?? (Math.random() * 2 ** 32) >>> 0, params.god, params.bench, true);
  show('inGame', null);
  game.start();
}

// ------------------------------------------------------------------ multiplayer (§3, §9)

function toMultiplayer(name: string): void {
  show(
    'multiplayer',
    multiplayerScreen({
      onHost: () => toHostSetup(name),
      onJoin: () => toJoin(name),
      onBack: () => toTitle(),
    }),
  );
}

function toHostSetup(name: string): void {
  let left = false;
  let creating = false;
  const view = hostSetupScreen({
    onCreate: (password, dungeonId) => {
      if (creating) return;
      creating = true;
      view.setStatus('Creating the game…', true);
      // The worker starts when the host clicks Create (§2.2).
      const host = new HostSession(0);
      createHostNet(() => left).then(
        (net) => {
          host.hostLobby(net, dungeonId, password, name, params.god);
          enterLobby({ transport: host.local, playerId: 0, host, client: null, gameId: net.gameId, net: net.stats }, null);
        },
        (e: unknown) => {
          host.stop();
          creating = false;
          if (!left) view.setStatus(e instanceof Error ? e.message : String(e), false);
        },
      );
    },
    onBack: () => {
      left = true;
      toMultiplayer(name);
    },
  });
  show('hostSetup', view.el);
}

/**
 * The Join screen. `prefillId` comes from an invite link (M8 §6.1); `auto` is bot auto-join (M8 §6.4),
 * which joins at once with an empty password and picks a class in the Lobby.
 */
function toJoin(name: string, prefillId: string | null = null, auto = false): void {
  let left = false;
  let joining = false;
  const onJoin = (gameId: string, password: string): void => {
    if (joining) return;
    joining = true;
    view.setStatus('Connecting…', true);
    joinGame(gameId, name, password, () => left).then(
      (j) => enterLobby({ transport: j.transport, playerId: j.playerId, host: null, client: j.transport, gameId: null, net: j.transport.stats }, j.lobby, auto),
      (e: unknown) => {
        joining = false;
        if (!left) view.setStatus(e instanceof Error ? e.message : String(e), false);
      },
    );
  };
  const view = joinScreen(
    {
      onJoin,
      onBack: () => {
        left = true;
        toMultiplayer(name);
      },
    },
    prefillId,
  );
  show('join', view.el);
  // The link is used up: returning to Title doesn't offer it again.
  if (prefillId && inviteId) {
    inviteId = null;
    history.replaceState(history.state, '', withoutJoin(window.location.href));
  }
  if (auto && prefillId) onJoin(prefillId, '');
}

/**
 * Bot auto-join's class (M8 §6.4): the `class` parameter if free, otherwise the first free class in
 * the order fallen, heretic, binder, betrayer; null if every class is taken.
 */
function autoClass(players: LobbyPlayer[]): ClassId | null {
  const taken = new Set(players.map((p) => p.classId));
  if (params.classParam && !taken.has(params.classParam)) return params.classParam;
  return CLASS_IDS.find((id) => !taken.has(id)) ?? null;
}

interface Session {
  transport: Transport;
  playerId: number;
  /** The host's session, on the host. */
  host: HostSession | null;
  /** The connection to the host, on a client. */
  client: PeerTransport | null;
  /** Shown in the Lobby for the host only. */
  gameId: string | null;
  net: NetStats | null;
}

/**
 * A multiplayer session from the Lobby on: class picks, then `start` → Loading → `ready` → `go` →
 * In Game → Results (§3). The host and its clients run the same flow; only their transports differ.
 */
function enterLobby(s: Session, initial: { dungeonId: string; players: LobbyPlayer[] } | null, auto = false): void {
  let game: Game | null = null;
  let loading = false;
  let go = false;
  /** `gameOver` arrived: the host closing its connections is expected from now on (§9.4). */
  let over = false;
  let ended = false;

  /** Ends the session and returns to Title. The host leaving sends `leave` to every client. */
  const end = (message: string, left: boolean): void => {
    if (ended) return;
    ended = true;
    if (left) s.transport.sendCtrl({ type: 'leave' });
    game?.dispose();
    s.host?.stop(left);
    s.client?.close();
    toTitle(message);
  };

  const lobby = lobbyScreen({
    gameId: s.gameId,
    playerId: s.playerId,
    onPick: (classId) => s.transport.sendCtrl({ type: 'pickClass', classId }),
    onStart: () => s.host?.startGame(),
    onLeave: () => end('', true),
  });
  show('lobby', lobby.el);
  /**
   * Shows a lobby state. Bot auto-join picks a class while it has none: the host ignores a taken
   * class, and every accepted pick sends a new lobby state, so a lost race picks again.
   */
  const updateLobby = (state: { dungeonId: string; players: LobbyPlayer[] }): void => {
    lobby.update(state);
    if (!auto || state.players.find((p) => p.id === s.playerId)?.classId) return;
    const classId = autoClass(state.players);
    if (classId) s.transport.sendCtrl({ type: 'pickClass', classId });
  };
  if (initial) updateLobby(initial);

  const enterGame = (): void => {
    if (!game || ended) return;
    show('inGame', null);
    game.start();
  };

  const load = async (msg: Extract<CtrlMessage, { type: 'start' }>): Promise<void> => {
    const view = loadingScreen();
    show('loading', view.el);
    const roster: RosterEntry[] = msg.players;
    const assets = await loadGameAssets(msg.dungeonId, roster, s.playerId, view.set);
    if (ended) return;
    const g = new Game({
      root,
      ...assets,
      params,
      transport: s.transport,
      host: s.host,
      localPlayerId: s.playerId,
      roster,
      singleplayer: false,
      net: s.net,
      onResults: (data) => {
        // The session ends at Results: the host closes all connections (§3).
        ended = true;
        g.dispose();
        s.host?.stop(false);
        s.client?.close();
        show('results', showResults(data, () => toTitle()));
      },
      onLeave: () => end('', true),
    });
    game = g;
    await g.prepare();
    if (ended) return;
    view.set('Waiting for the other players…');
    s.transport.sendCtrl({ type: 'ready' });
    if (go) enterGame();
  };

  s.transport.onCtrl = (msg) => {
    if (ended) return;
    switch (msg.type) {
      case 'lobby':
        if (!loading) updateLobby(msg);
        break;
      case 'start':
        if (loading) break;
        loading = true;
        if (s.client) s.client.loading = true;
        void load(msg);
        break;
      case 'go':
        go = true;
        if (s.client) s.client.loading = false;
        enterGame();
        break;
      case 'reject':
        if (msg.reason === 'load_timeout') end('Loading took too long', false);
        break;
      case 'event':
        if (msg.event.type === 'gameOver') over = true;
        game?.handleCtrl(msg);
        break;
    }
  };
  if (s.client) {
    s.client.onHostLeft = () => {
      if (!over) end('Host left the game', false);
    };
  }
}

// Audio starts on the first user gesture; with dev=1 or bench=1 at load, where it may stay
// suspended until a gesture (M8 §9.1).
if (params.bench || params.dev) initAudio();
for (const type of ['pointerdown', 'keydown'] as const) document.addEventListener(type, () => initAudio(), { capture: true });
// UI sounds: a button under the pointer, and a click.
let hovered: Element | null = null;
document.addEventListener('pointerover', (e) => {
  const b = (e.target as Element | null)?.closest?.('button:not(:disabled)') ?? null;
  if (b && b !== hovered) sfx('buttonHover');
  hovered = b;
});
document.addEventListener('click', (e) => {
  if ((e.target as Element | null)?.closest?.('button:not(:disabled)')) sfx('buttonClick');
});

if (params.bench || params.dev) void startSingleplayer('Dev', params.classId, params.mapId, params.seed);
// Bot auto-join skips the Title and Join screens (M8 §6.4).
else if (params.autojoin) toJoin(validName(params.name ?? '') ?? 'Bot', params.join, true);
else toTitle();
