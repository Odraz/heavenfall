/** Entry: boots the UI and owns the top-level screen state machine. */
import './style.css';
import { CLASS_IDS, type ClassId } from './data/classes';
import { debugState, resetGameDebug, type Screen } from './debug';
import { floorHash } from './gen';
import { newRunIdentity } from './net/version';
import { RunEvents } from './net/runEvents';
import { parseParams } from './params';
import { loadRunMap } from './sim/runMap';
import { loadEnemyAnims, loadPlayerAnims } from './render/animAtlas';
import { hasWatchmen } from './data/watchman';
import { buildAtlas } from './render/atlas';
import { loadGameTextures } from './render/textures';
import { Game, type RosterEntry } from './client/game';
import { HostSession } from './client/hostSession';
import { createHostNet } from './net/hostNet';
import type { CtrlMessage, LobbyPlayer, LobbyState, RunConfig } from './net/messages';
import type { NetStats } from './net/netStats';
import { joinGame, type PeerTransport } from './net/peerTransport';
import type { Transport } from './net/transport';
import { withoutJoin } from './net/invite';
import { button, singleplayerSetupScreen, titleScreen, validName } from './ui/menus';
import { loadingScreen } from './ui/loading';
import { hostSetupScreen, joinScreen, lobbyScreen, multiplayerScreen, type LobbyView } from './ui/multiplayer';
import { showResults, type ResultsData, type ResultsView } from './ui/results';
import { hideTooltip } from './ui/tooltip';
import { initAudio, setMusic, sfx } from './audio/audio';
import { profileLoadout, profilesScreen, saveCodeButton } from './ui/profiles';
import { ProfileSession, openCurrentProfile, readProfile } from './profile/storage';
import { abandonAttempt, applyProgress, stakeProfile, type ProgressState } from './profile/lifecycle';

const params = parseParams(window.location.search);
const root = document.getElementById('app')!;
let profileSession: ProfileSession | null = null;
let lastProgress: ProgressState | null = null;
let requestedPersistence = false;
let saveNotice: HTMLElement | null = null;
function saveAccepted(profile: ProfileSession['profile']): void {
  if (!profileSession) return;
  if (profileSession.save(profile)) { saveNotice?.remove(); saveNotice = null; return; }
  if (saveNotice) return;
  saveNotice = document.createElement('div'); saveNotice.className = 'save-notice'; saveNotice.setAttribute('role', 'alert');
  saveNotice.textContent = `${profileSession.message} Press Esc to access export or retry.`;
  saveCodeButton(saveNotice, () => profileSession!.profile);
  button('Retry save', saveNotice, () => saveAccepted(profileSession!.profile)); document.body.appendChild(saveNotice);
}
const disposable = params.dev || params.benchArena >= 0 || params.bot;

/** `onRejected` lets a solo start leave Loading with the reason; a refused run would otherwise never start. */
function profileMessage(msg: CtrlMessage, transport: Transport, onRejected?: (reason: string) => void): boolean {
  if (msg.type === 'admission') {
    const admission = msg.admission;
    try {
      if (admission.progressionEnabled) {
        if (!profileSession) throw new Error('Select a persistent profile first');
        const next = stakeProfile(profileSession.profile, admission);
        if (admission.kind === 'new' && !profileSession.save(next, true)) throw new Error(profileSession.message);
      } else if (profileSession?.profile.run) throw new Error('Recover the normal attempt before starting a disposable run');
      transport.sendCtrl({ type: 'admissionReady', runId: admission.runId, admissionId: admission.admissionId });
    } catch (error) {
      transport.sendCtrl({ type: 'admissionRejected', runId: admission.runId, admissionId: admission.admissionId, reason: String(error) });
      if (onRejected) onRejected(error instanceof Error ? error.message : String(error));
      else if (screenEl) { const p = document.createElement('p'); p.textContent = String(error); screenEl.appendChild(p); }
    }
    return true;
  }
  if (msg.type === 'progress') {
    if (!lastProgress || lastProgress.runId !== msg.state.runId || msg.state.revision > lastProgress.revision) lastProgress = msg.state;
    if (profileSession) {
      const next = applyProgress(profileSession.profile, msg.state);
      if (next) saveAccepted(next);
      if (next && msg.state.outcome && msg.state.outcome !== 'admissionAborted' && !requestedPersistence) {
        requestedPersistence = true; void navigator.storage?.persist?.().catch(() => {});
      }
    }
    return true;
  }
  return false;
}
function localExit(outcome: 'leave' | 'hostLeft'): void {
  if (!profileSession?.profile.run || !lastProgress || lastProgress.runId !== profileSession.profile.run.runId) return;
  const next = applyProgress(profileSession.profile, { ...lastProgress, revision: 0xfffffffe, outcome });
  if (next) saveAccepted(next);
}

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
  let profileName = profileSession?.profile.name;
  try { profileName ??= disposable ? undefined : readProfile(localStorage).profile?.name; } catch { /* Storage errors are shown on entry. */ }
  let opening = false;
  const enter = (name: string, next: () => void, recovery = false): void => {
    if (opening) return;
    if (disposable) { next(); return; }
    opening = true;
    void (async () => {
      try {
        if (!profileSession) profileSession = await openCurrentProfile(name, localStorage, recovery);
        else if (profileSession.profile.name !== name && !profileSession.save({ ...profileSession.profile, name }, true)) throw new Error(profileSession.message);
        next();
      } catch (error) { toTitle(error instanceof Error ? error.message : String(error)); }
      finally { opening = false; }
    })();
  };
  show(
    'title',
    titleScreen({
      profileName,
      onProfile: disposable ? undefined : name => enter(name, () => show('title', profilesScreen(profileSession!, () => { if (profileSession?.recovery) { profileSession.close(); profileSession = null; } toTitle(); }, () => { lastProgress = null; })), true),
      message,
      joinId: inviteId,
      onJoinInvite: (name) => enter(name, () => toJoin(name, inviteId)),
      onSingleplayer: (name) => enter(name, () => toSingleplayerSetup(name)),
      onMultiplayer: (name) => enter(name, () => toMultiplayer(name)),
    }),
  );
}

function toSingleplayerSetup(name: string): void {
  const view = singleplayerSetupScreen({
      onStart: (classId, dungeonId) => void startSingleplayer(name, classId, dungeonId, null),
      onBack: () => toTitle(),
    });
  if (profileSession) profileLoadout(view, profileSession);
  show('singleplayerSetup', view);
}

/**
 * Builds the map and loads the sprite atlases and textures a game needs (§3 Loading). Only other
 * players are drawn as billboards, so the local class's atlas isn't needed; in multiplayer every other
 * class's is loaded, since a player may join with any free class during the game (M8 §6.2).
 */
async function loadGameAssets(run: RunConfig, roster: RosterEntry[], localId: number, multiplayer: boolean, progress: (text: string) => void) {
  progress(run.fixture === null ? 'Building the Pearly Gates…' : 'Building the map…');
  // Give Loading a frame before synchronous generation; hidden tabs must still finish loading.
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
    setTimeout(resolve, 100);
  });
  const t0 = performance.now();
  const { def, map, floor } = loadRunMap(run);
  Object.assign(debugState, {
    seed: run.seed, simSeed: run.simSeed, runId: run.runId,
    attempts: floor?.attempts ?? 0, fallbackUsed: floor?.fallbackUsed ?? false,
    genMs: floor ? performance.now() - t0 : 0, floorHash: floor ? floorHash(def) : null,
  });
  progress('Drawing the sprites…');
  const localClass = roster.find((r) => r.id === localId)?.classId;
  const others = multiplayer ? CLASS_IDS.filter((c) => c !== localClass) : roster.filter((r) => r.id !== localId).map((r) => r.classId);
  const [atlas, textures, enemyAnims, players] = await Promise.all([buildAtlas(), loadGameTextures(map.gate !== null), loadEnemyAnims(map.rooms.some((r) => r.waves.some((w) => (w.dominions ?? 0) > 0)), map.rooms.some((r) => r.waves.some((w) => w.commander === 'cantor')), map.rooms.some((r) => r.waves.some((w) => w.commander === 'carrier')), hasWatchmen(map.rooms)), loadPlayerAnims(others)]);
  return { map, floor, runId: run.runId, atlas, textures, enemyAnims, players };
}

/**
 * A singleplayer game: from Singleplayer Setup's `Start`, or straight from the page load with `dev=1`
 * or `bench=1`. Loading builds the map and sprite atlas, then enters the game (§3).
 */
async function startSingleplayer(name: string, classId: ClassId, dungeonId: string, seed: number | null): Promise<void> {
  if (!disposable && profileSession?.profile.run) {
    // No live solo host survives leaving/reloading its tab. Its unmatched stake is a loss.
    if (!profileSession.save(abandonAttempt(profileSession.profile), true)) { toTitle(profileSession.message); return; }
  }
  // The worker starts when the player clicks Start, or the page loads with dev=1 or bench=1 (§2.2).
  const host = new HostSession(0);
  const loading = loadingScreen();
  show('loading', loading.el);
  await loading.ready;
  const run: RunConfig = {
    ...newRunIdentity(seed ?? undefined), heaven: 1, floor: 1, edicts: 0, progressionEnabled: !disposable && !!profileSession && dungeonId === 'rogue',
    fixture: dungeonId === 'rogue' ? null : dungeonId,
  };
  // Solo autopilot drives the human slot; half-player bots are multiplayer admissions.
  const roster = [{ id: 0, name, classId, bot: false, profile: profileSession?.profile }];
  const assets = await loadGameAssets(run, roster, 0, false, loading.set);
  const requestedRoom = run.fixture === null ? params.startRoom : params.startArena > 0 ? params.startArena : null;
  const startRoom = requestedRoom === null ? undefined : Math.min(requestedRoom, assets.map.rooms.length - 1);
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
    startRoom,
    singleplayer: true,
    net: null,
    onResults: (data) => {
      end();
      const view = showResults(data, { onLeave: () => toTitle() });
      show('results', view.el);
    },
    onLeave: () => {
      localExit('leave');
      end();
      toTitle();
    },
  });
  host.local.onCtrl = (msg) => {
    if (profileMessage(msg, host.local, (reason) => { end(); toTitle(reason); })) return;
    if (msg.type === 'go') { show('inGame', null); game.start(); }
    game.handleCtrl(msg);
  };
  await game.prepare();
  host.start(run, roster, params.god, params.benchArena, params.benchBurst, startRoom, params.dev, params.devBuild ?? undefined, params.devRelics);
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
    fixtureId: params.devMenu ? params.mapId : undefined,
    onCreate: (password, dungeonId) => {
      if (creating) return;
      creating = true;
      view.setStatus('Creating the game…', true);
      // The worker starts when the host clicks Create (§2.2).
      const host = new HostSession(0);
      createHostNet(() => left).then(
        (net) => {
          host.hostLobby(net, dungeonId === 'rogue' ? null : dungeonId, password, name, params.god, params.bot, profileSession?.profile, !disposable && dungeonId === 'rogue', params.dev);
          enterLobby({ transport: host.local, playerId: 0, host, client: null, gameId: net.gameId, net: net.stats }, null, false);
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
    joinGame(gameId, name, password, () => left, params.bot, profileSession?.profile).then(
      (j) =>
        enterLobby(
          { transport: j.transport, playerId: j.playerId, host: null, client: j.transport, gameId, net: j.transport.stats },
          j.lobby,
          j.inProgress,
          auto,
        ),
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
  /** Shown in the Lobby for the host, and for clients in the in-progress Lobby. */
  gameId: string;
  net: NetStats | null;
}

/** The session keeps this many chat messages (M8 §7). */
const CHAT_LOG = 50;
/** Bot auto-join stays on Results this long before pressing `Back to lobby` (M8 §6.4). */
const BOT_RESULTS_MS = 2000;

/**
 * A multiplayer session from the Lobby on: class picks, then `start` → Loading → `ready` → `go` →
 * In Game → Results, and from Results `Back to lobby` for the next game (§3). The host and its clients
 * run the same flow; only their transports differ. A client joining a game in progress waits in the
 * in-progress Lobby until it presses `Enter game`, which gets it its own `start` (M8 §6.2).
 */
function enterLobby(s: Session, initial: LobbyState | null, inProgress: boolean, auto = false): void {
  let game: Game | null = null;
  /** Counts the games of this session: a load from an earlier one stops. */
  let round = 0;
  let activeEvents: RunEvents | null = null;
  let loading = false;
  let go = false;
  let ended = false;
  /** Results, while shown. */
  let results: ResultsView | null = null;
  /** The newest roster, for names and for the game's party frames (M8 §6.2). */
  let latest = initial;
  /** Bot auto-join pressed `Enter game`. */
  let entered = false;
  /** The chat log with the senders' names as they were when each message arrived (M8 §7). */
  const chat: Array<{ playerId: number; name: string; text: string }> = [];

  const disposeGame = (): void => {
    delete window.__heavenfallReady;
    game?.dispose();
    game = null;
    s.transport.onSnapshot = () => {};
  };

  /** Ends the session and returns to Title. The host leaving sends `leave` to every client. */
  const end = (message: string, left: boolean, settle = true): void => {
    if (ended) return;
    ended = true;
    if (settle) localExit(left ? 'leave' : 'hostLeft');
    if (left) s.transport.sendCtrl({ type: 'leave' });
    disposeGame();
    s.host?.stop(left);
    s.client?.close();
    toTitle(message);
  };

  /** The game is over for this player: the next `start` begins a new one. */
  const nextRound = (): void => {
    round++;
    loading = false;
    go = false;
    entered = false;
    if (s.client) s.client.loading = false;
    disposeGame();
  };

  let lobby: LobbyView;
  /** Shows the Lobby; after a game it starts with the session's chat and the newest roster. */
  const showLobby = (inProg: boolean): void => {
    inProgress = inProg;
    results = null;
    lobby = lobbyScreen({
      // The in-progress Lobby shows the game ID to clients too (M8 §6.2).
      gameId: s.host || inProg ? s.gameId : null,
      isHost: s.host !== null,
      inProgress: inProg,
      playerId: s.playerId,
      onPick: (classId) => s.transport.sendCtrl({ type: 'pickClass', classId }),
      onStart: () => s.host?.startGame(),
      onEnterGame: () => s.transport.sendCtrl({ type: 'enterGame' }),
      onChat: (text) => s.transport.sendCtrl({ type: 'chat', text }),
      onLeave: () => end('', true),
    });
    if (profileSession && !inProg) profileLoadout(lobby.el, profileSession, () => s.transport.sendCtrl({ type: 'loadout', profile: profileSession!.profile }));
    show('lobby', lobby.el);
    lobby.setChat(chat);
    if (latest) updateLobby(latest);
  };

  /**
   * A new roster. In the Lobby it's shown, and bot auto-join picks a class while it has none: the host
   * ignores a taken class, and every accepted pick sends a new lobby state, so a lost race picks again;
   * in the in-progress Lobby it then presses `Enter game` (M8 §6.4). In game, it names the players.
   */
  const updateLobby = (state: LobbyState): void => {
    latest = state;
    game?.setRoster(state.players);
    if (loading || results) return;
    lobby.update(state);
    if (!auto) return;
    if (state.players.find((p) => p.id === s.playerId)?.classId) {
      if (inProgress && !entered) {
        entered = true;
        lobby.pressEnterGame();
      }
      return;
    }
    const classId = autoClass(state.players);
    if (classId) s.transport.sendCtrl({ type: 'pickClass', classId });
  };
  showLobby(inProgress);

  const onChat = (playerId: number, text: string): void => {
    const name = latest?.players.find((p) => p.id === playerId)?.name ?? 'Player';
    chat.push({ playerId, name, text });
    if (chat.length > CHAT_LOG) chat.shift();
    debugState.chat = chat.map(({ playerId, text }) => ({ playerId, text }));
    lobby.setChat(chat);
    game?.chat(name, text);
  };

  const enterGame = (): void => {
    if (!game || ended) return;
    show('inGame', null);
    game.start();
  };

  /**
   * Results stay up until `Back to lobby`; the host keeps the session open meanwhile. Bot auto-join
   * presses it after `BOT_RESULTS_MS`, unless the host left (M8 §6.4).
   */
  const showGameResults = (data: ResultsData): void => {
    nextRound();
    const backToLobby = (): void => {
      s.transport.sendCtrl({ type: 'backToLobby' });
      if (profileSession) s.transport.sendCtrl({ type: 'loadout', profile: profileSession.profile });
      resetGameDebug();
      debugState.chat = chat.map(({ playerId, text }) => ({ playerId, text }));
      showLobby(false);
    };
    const view = showResults(data, { onLeave: () => (ended ? toTitle() : end('', true)), onBackToLobby: backToLobby });
    results = view;
    show('results', view.el);
    if (auto) setTimeout(() => results === view && !ended && backToLobby(), BOT_RESULTS_MS);
  };

  const load = async (msg: Extract<CtrlMessage, { type: 'start' }>): Promise<void> => {
    const r = round;
    const stale = (): boolean => ended || r !== round;
    const view = loadingScreen();
    show('loading', view.el);
    await view.ready;
    if (stale()) return;
    const roster: RosterEntry[] = msg.players;
    const assets = await loadGameAssets(msg, roster, s.playerId, true, view.set);
    if (stale()) return;
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
      onResults: showGameResults,
      onLeave: () => end('', true),
      onChat: (text) => s.transport.sendCtrl({ type: 'chat', text }),
    });
    game = g;
    if (latest) g.setRoster(latest.players);
    await g.prepare();
    if (stale()) return;
    view.set('Waiting for the other players…');
    let sentReady = false;
    const ready = (): void => {
      delete window.__heavenfallReady;
      if (sentReady || stale()) return;
      sentReady = true;
      s.transport.sendCtrl({ type: 'ready' });
      if (go) enterGame();
    };
    if (params.readyHold) window.__heavenfallReady = ready;
    else ready();
  };

  s.transport.onCtrl = (msg) => {
    if (ended) return;
    if (profileMessage(msg, s.transport)) return;
    switch (msg.type) {
      case 'recovery':
        if (profileSession?.profile.run?.runId === msg.runId) {
          if (msg.state) profileMessage({ type: 'progress', state: msg.state }, s.transport);
          else profileSession.save(abandonAttempt(profileSession.profile));
          s.transport.sendCtrl({ type: 'loadout', profile: profileSession.profile });
        }
        break;
      case 'lobby':
        updateLobby(msg);
        break;
      case 'start':
        if (loading) break;
        activeEvents = new RunEvents(msg.runId);
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
        if (msg.reason === 'load_timeout') end('Loading took too long', false, false);
        break;
      case 'chat':
        if (typeof msg.playerId === 'number' && typeof msg.text === 'string') onChat(msg.playerId, msg.text);
        break;
      case 'event':
        if (activeEvents && !activeEvents.accept(msg)) break;
        // A player still in the in-progress Lobby or loading into the game is in the Lobby for the
        // next one.
        if (msg.event.type === 'gameOver' && !go) {
          nextRound();
          showLobby(false);
          break;
        }
        // Events are about the game, so they wait until this player is in it.
        if (go) game?.handleCtrl(msg);
        break;
      case 'floorSync':
        if (go) game?.handleCtrl(msg);
        break;
    }
  };
  if (profileSession?.profile.run) s.transport.sendCtrl({ type: 'recover', runId: profileSession.profile.run.runId, profileId: profileSession.profile.id });
  if (s.client) {
    s.client.onHostLeft = (explicit) => {
      // On Results the numbers stay up, and `Leave` returns to Title.
      if (results) {
        ended = true;
        results.hostLeft();
      } else end(explicit ? 'Host left the game' : 'Connection lost; reconnect to recover the attempt', false, explicit);
    };
  }
}

// Audio starts on the first user gesture; with dev=1 or bench=1 at load, where it may stay
// suspended until a gesture (M8 §9.1).
if (params.benchArena >= 0 || params.dev) initAudio();
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

if (params.benchArena >= 0 || params.dev && !params.devMenu) void startSingleplayer('Dev', params.classId, params.mapId, params.seed);
// Bot auto-join skips the Title and Join screens (M8 §6.4).
else if (params.autojoin) toJoin(validName(params.name ?? '') ?? 'Bot', params.join, true);
else toTitle();
