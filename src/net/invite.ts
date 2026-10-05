/** Invite links (M8 §6.1): the page URL with the game ID in `?join=`. */
import { GAME_ID_ALPHABET, GAME_ID_LENGTH, normalizeGameId } from './gameId';

/** `<page URL without query or hash>?join=<game ID>`. It never contains the password. */
export function inviteLink(pageUrl: string, gameId: string): string {
  const base = pageUrl.replace(/[?#].*$/, '');
  return `${base}?join=${gameId}`;
}

/** The game ID in a `join` value, normalized, or null if it isn't 6 characters from the alphabet. */
export function parseJoinId(raw: string | null): string | null {
  if (raw === null) return null;
  const id = normalizeGameId(raw);
  if (id.length !== GAME_ID_LENGTH) return null;
  for (const ch of id) if (!GAME_ID_ALPHABET.includes(ch)) return null;
  return id;
}

/** The page's URL with `join` removed, for `history.replaceState` once the Join screen opens. */
export function withoutJoin(href: string): string {
  const url = new URL(href);
  url.searchParams.delete('join');
  return url.toString();
}
