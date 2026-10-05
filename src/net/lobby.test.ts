import { describe, expect, it } from 'vitest';
import { GAME_ID_ALPHABET, normalizeGameId, randomGameId } from './gameId';
import { cleanChat, cleanName, LOAD_TIMEOUT_MS, Lobby } from './lobby';

const V = '0.1.0-abc1234';

function lobby(password = 'pw'): Lobby {
  return new Lobby({ dungeonId: 'pearly-gates', password, version: V, hostName: 'Host' });
}

describe('lobby', () => {
  it('gives the host id 0 and each client the lowest free id from 1 to 3', () => {
    const l = lobby();
    expect(l.join('B', 'pw', V)).toEqual({ ok: true, playerId: 1, inProgress: false });
    expect(l.join('C', 'pw', V)).toEqual({ ok: true, playerId: 2, inProgress: false });
    expect(l.join('D', 'pw', V)).toEqual({ ok: true, playerId: 3, inProgress: false });
    l.remove(2);
    expect(l.join('E', 'pw', V)).toEqual({ ok: true, playerId: 2, inProgress: false });
    const msg = l.lobbyMessage();
    expect(msg.players.map((p) => [p.id, p.name, p.isHost])).toEqual([
      [0, 'Host', true],
      [1, 'B', false],
      [2, 'E', false],
      [3, 'D', false],
    ]);
  });

  it('rejects a fifth player as full', () => {
    const l = lobby();
    for (const n of ['B', 'C', 'D']) l.join(n, 'pw', V);
    expect(l.join('E', 'pw', V)).toEqual({ ok: false, reason: 'full' });
  });

  it('rejects a wrong password, and accepts any client of an open game', () => {
    const l = lobby();
    expect(l.join('B', 'x', V)).toEqual({ ok: false, reason: 'bad_password' });
    expect(l.join('B', '', V)).toEqual({ ok: false, reason: 'bad_password' });
    expect(l.join('B', 'pw', V)).toEqual({ ok: true, playerId: 1, inProgress: false });
    expect(lobby('').join('B', '', V)).toEqual({ ok: true, playerId: 1, inProgress: false });
  });

  it('rejects a version mismatch before anything else', () => {
    const l = lobby();
    expect(l.join('B', 'x', '0.1.0-other')).toEqual({ ok: false, reason: 'version' });
    expect(l.join('B', 'pw', undefined)).toEqual({ ok: false, reason: 'version' });
  });

  it('rejects joining during Loading, but accepts it in the game, in progress (M8 §6.2)', () => {
    const l = lobby();
    l.pickClass(0, 'fallen');
    expect(l.start(0)).not.toBeNull();
    // Loading: in_progress, checked before the password.
    expect(l.join('B', 'x', V)).toEqual({ ok: false, reason: 'in_progress' });
    expect(l.join('B', 'pw', V)).toEqual({ ok: false, reason: 'in_progress' });
    l.ready(0);
    l.go();
    expect(l.join('B', 'x', V)).toEqual({ ok: false, reason: 'bad_password' });
    expect(l.join('B', 'pw', V)).toEqual({ ok: true, playerId: 1, inProgress: true });
    expect(l.join('C', 'pw', V)).toEqual({ ok: true, playerId: 2, inProgress: true });
    expect(l.join('D', 'pw', V)).toEqual({ ok: true, playerId: 3, inProgress: true });
    // Still full, and the version is checked first.
    expect(l.join('E', 'pw', V)).toEqual({ ok: false, reason: 'full' });
    expect(l.join('E', 'pw', 'old')).toEqual({ ok: false, reason: 'version' });
  });

  it('lets a joiner pick a free class, then enterGame → start → ready, while the game goes on', () => {
    const l = lobby();
    l.join('B', 'pw', V);
    l.pickClass(0, 'fallen');
    l.pickClass(1, 'heretic');
    l.start(0);
    l.ready(0);
    l.ready(1);
    expect(l.go()).toEqual([
      { id: 0, name: 'Host', classId: 'fallen' },
      { id: 1, name: 'B', classId: 'heretic' },
    ]);
    // Players in the game can't switch classes any more.
    expect(l.pickClass(1, 'binder')).toBe(false);
    l.join('C', 'pw', V);
    // No class yet: can't enter.
    expect(l.enterGame(2, 1000)).toBeNull();
    expect(l.pickClass(2, 'heretic')).toBe(false);
    expect(l.pickClass(2, 'betrayer')).toBe(true);
    expect(l.lobbyMessage().players.map((p) => [p.id, p.classId])).toEqual([
      [0, 'fallen'],
      [1, 'heretic'],
      [2, 'betrayer'],
    ]);
    const start = l.enterGame(2, 1000)!;
    expect(start).toEqual({
      type: 'start',
      dungeonId: 'pearly-gates',
      players: [
        { id: 0, name: 'Host', classId: 'fallen' },
        { id: 1, name: 'B', classId: 'heretic' },
        { id: 2, name: 'C', classId: 'betrayer' },
      ],
    });
    // Loading: no second start, no class change, and the heartbeat spares it.
    expect(l.enterGame(2, 1000)).toBeNull();
    expect(l.pickClass(2, 'binder')).toBe(false);
    expect(l.loadingIds()).toEqual([2]);
    expect(l.ready(1)).toBeNull();
    expect(l.ready(2)).toEqual({ id: 2, name: 'C', classId: 'betrayer' });
    expect(l.loadingIds()).toEqual([]);
    expect(l.ready(2)).toBeNull();
  });

  it('times out a joiner still loading 20 s after its own start', () => {
    const l = lobby();
    l.pickClass(0, 'fallen');
    l.start(0);
    l.ready(0);
    l.go();
    l.join('B', 'pw', V);
    l.pickClass(1, 'binder');
    l.enterGame(1, 5000);
    expect(l.loadTimedOut(5000 + LOAD_TIMEOUT_MS - 1)).toEqual([]);
    expect(l.loadTimedOut(5000 + LOAD_TIMEOUT_MS)).toEqual([1]);
  });

  it('lets each class be taken by only one player, and frees it when the player leaves', () => {
    const l = lobby();
    l.join('B', 'pw', V);
    expect(l.pickClass(0, 'fallen')).toBe(true);
    expect(l.pickClass(1, 'fallen')).toBe(false);
    expect(l.pickClass(1, 'heretic')).toBe(true);
    // Switching frees the old class.
    expect(l.pickClass(1, 'binder')).toBe(true);
    expect(l.pickClass(0, 'heretic')).toBe(true);
    expect(l.pickClass(1, 'nonsense')).toBe(false);
    expect(l.lobbyMessage().players.map((p) => p.classId)).toEqual(['heretic', 'binder']);
    l.remove(1);
    l.join('C', 'pw', V);
    expect(l.pickClass(1, 'binder')).toBe(true);
  });

  it('enables Start only when every connected player has picked a class', () => {
    const l = lobby();
    expect(l.canStart()).toBe(false);
    l.pickClass(0, 'fallen');
    expect(l.canStart()).toBe(true);
    l.join('B', 'pw', V);
    expect(l.canStart()).toBe(false);
    expect(l.start(0)).toBeNull();
    l.pickClass(1, 'betrayer');
    expect(l.canStart()).toBe(true);
  });

  it('sends start sorted by id, and go once every player still connected is ready', () => {
    const l = lobby();
    l.join('B', 'pw', V);
    l.join('C', 'pw', V);
    l.pickClass(2, 'binder');
    l.pickClass(0, 'fallen');
    l.pickClass(1, 'heretic');
    const start = l.start(1000)!;
    expect(start.players).toEqual([
      { id: 0, name: 'Host', classId: 'fallen' },
      { id: 1, name: 'B', classId: 'heretic' },
      { id: 2, name: 'C', classId: 'binder' },
    ]);
    expect(l.pickClass(1, 'betrayer')).toBe(false);
    l.ready(0);
    l.ready(2);
    expect(l.allReady()).toBe(false);
    // Player 1 leaves during Loading: removed, and the game starts without it (M8 §6.2).
    l.remove(1);
    expect(l.allReady()).toBe(true);
    expect(l.go().map((p) => p.id)).toEqual([0, 2]);
  });

  it('times out clients (not the host) still loading 20 s after start', () => {
    const l = lobby();
    l.join('B', 'pw', V);
    l.join('C', 'pw', V);
    l.pickClass(0, 'fallen');
    l.pickClass(1, 'heretic');
    l.pickClass(2, 'binder');
    l.start(1000);
    l.ready(1);
    expect(l.loadTimedOut(1000 + LOAD_TIMEOUT_MS - 1)).toEqual([]);
    expect(l.loadTimedOut(1000 + LOAD_TIMEOUT_MS)).toEqual([2]);
  });

  it('trims names to 16 characters', () => {
    expect(cleanName('  Bob  ')).toBe('Bob');
    expect(cleanName('abcdefghijklmnopqrstuvwxyz')).toBe('abcdefghijklmnop');
    expect(cleanName('   ')).toBe('Player');
    expect(cleanName(42)).toBe('Player');
  });
});

describe('chat', () => {
  it('trims, drops empty messages and cuts to 120 characters (M8 §7)', () => {
    expect(cleanChat('  hello  ')).toBe('hello');
    expect(cleanChat('   ')).toBeNull();
    expect(cleanChat('')).toBeNull();
    expect(cleanChat(42)).toBeNull();
    expect(cleanChat('x'.repeat(200))).toBe('x'.repeat(120));
    expect(cleanChat('<b>hi</b>')).toBe('<b>hi</b>');
  });
});

describe('game IDs', () => {
  it('are 6 characters from the alphabet, and the Join field normalizes to upper case', () => {
    let seed = 1;
    const random = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 50; i++) {
      const id = randomGameId(random);
      expect(id).toHaveLength(6);
      for (const ch of id) expect(GAME_ID_ALPHABET).toContain(ch);
    }
    expect(normalizeGameId(' ab c2d9 ')).toBe('ABC2D9');
  });
});
