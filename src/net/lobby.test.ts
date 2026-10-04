import { describe, expect, it } from 'vitest';
import { GAME_ID_ALPHABET, normalizeGameId, randomGameId } from './gameId';
import { cleanName, LOAD_TIMEOUT_MS, Lobby } from './lobby';

const V = '0.1.0-abc1234';

function lobby(password = 'pw'): Lobby {
  return new Lobby({ dungeonId: 'pearly-gates', password, version: V, hostName: 'Host' });
}

describe('lobby', () => {
  it('gives the host id 0 and each client the lowest free id from 1 to 3', () => {
    const l = lobby();
    expect(l.join('B', 'pw', V)).toEqual({ ok: true, playerId: 1 });
    expect(l.join('C', 'pw', V)).toEqual({ ok: true, playerId: 2 });
    expect(l.join('D', 'pw', V)).toEqual({ ok: true, playerId: 3 });
    l.remove(2);
    expect(l.join('E', 'pw', V)).toEqual({ ok: true, playerId: 2 });
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
    expect(l.join('B', 'pw', V)).toEqual({ ok: true, playerId: 1 });
    expect(lobby('').join('B', '', V)).toEqual({ ok: true, playerId: 1 });
  });

  it('rejects a version mismatch before anything else', () => {
    const l = lobby();
    expect(l.join('B', 'x', '0.1.0-other')).toEqual({ ok: false, reason: 'version' });
    expect(l.join('B', 'pw', undefined)).toEqual({ ok: false, reason: 'version' });
  });

  it('rejects joining once the game has started', () => {
    const l = lobby();
    l.pickClass(0, 'fallen');
    expect(l.start(0)).not.toBeNull();
    expect(l.join('B', 'pw', V)).toEqual({ ok: false, reason: 'in_progress' });
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
    // Player 1 leaves during Loading: dropped, and the game starts without it, keeping the indices.
    l.remove(1);
    expect(l.allReady()).toBe(true);
    expect(l.go().map((p) => [p.id, p.connected])).toEqual([
      [0, true],
      [1, false],
      [2, true],
    ]);
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
