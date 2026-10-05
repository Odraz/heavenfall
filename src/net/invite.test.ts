import { describe, expect, it } from 'vitest';
import { inviteLink, parseJoinId, withoutJoin } from './invite';

describe('invite link (M8 §6.1)', () => {
  it('builds ?join=<ID> from the page URL without its query and hash', () => {
    expect(inviteLink('https://odraz.github.io/heavenfall/', 'ABC234')).toBe('https://odraz.github.io/heavenfall/?join=ABC234');
    expect(inviteLink('https://x.io/game/index.html?bot=1&join=ZZZZZZ#top', 'ABC234')).toBe('https://x.io/game/index.html?join=ABC234');
    expect(inviteLink('http://localhost:5173/#frag', 'QWERTY')).toBe('http://localhost:5173/?join=QWERTY');
  });

  it('accepts valid IDs, normalized to upper case', () => {
    expect(parseJoinId('ABC234')).toBe('ABC234');
    expect(parseJoinId('abc234')).toBe('ABC234');
  });

  it('rejects invalid IDs', () => {
    expect(parseJoinId(null)).toBeNull();
    expect(parseJoinId('')).toBeNull();
    expect(parseJoinId('ABC23')).toBeNull();
    expect(parseJoinId('ABC2345')).toBeNull();
    // O, I, 0 and 1 aren't in the alphabet.
    expect(parseJoinId('ABCDE0')).toBeNull();
    expect(parseJoinId('ABCDEI')).toBeNull();
    expect(parseJoinId('ABC-23')).toBeNull();
  });

  it('removes join from the URL and keeps the rest', () => {
    expect(withoutJoin('http://localhost:5173/?join=ABC234')).toBe('http://localhost:5173/');
    expect(withoutJoin('http://localhost:5173/?bot=1&join=ABC234#x')).toBe('http://localhost:5173/?bot=1#x');
  });
});
