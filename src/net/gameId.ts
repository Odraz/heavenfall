/** Game IDs and PeerJS peer IDs (§9.1). */

export const GAME_ID_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
export const GAME_ID_LENGTH = 6;
/** Attempts at registering a game ID before giving up (§9.1). */
export const REGISTER_ATTEMPTS = 5;

/** A random game ID: 6 characters from the alphabet. */
export function randomGameId(random: () => number = Math.random): string {
  let id = '';
  for (let i = 0; i < GAME_ID_LENGTH; i++) id += GAME_ID_ALPHABET[Math.floor(random() * GAME_ID_ALPHABET.length)];
  return id;
}

/** The Join field's value, normalized to upper case with spaces removed. */
export function normalizeGameId(raw: string): string {
  return raw.replace(/\s+/g, '').toUpperCase();
}

/** The PeerJS peer ID the host registers for a game ID. */
export function hostPeerId(gameId: string): string {
  return `heavenfall-${gameId}`;
}
