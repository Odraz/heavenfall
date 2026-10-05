/** PeerJS options shared by hosts and clients (§2.1, §9.1). */
import type { PeerOptions } from 'peerjs';

/**
 * The Metered TURN relay (§9.1), for players whose networks can't connect directly. Browsers need
 * these credentials to use it, so they are public by nature.
 */
const RELAY = { username: 'fc00000f6016e940755ed2cf', credential: 'UFBj23I5aG8oop37' };

/**
 * The public PeerJS cloud signaling server (PeerJS's default), Google's public STUN server, and the
 * Metered relay over UDP, TCP and TLS on port 443 (which passes most firewalls). PeerJS's default
 * ICE list has its own relay, which no longer works, so it's replaced.
 */
export const PEER_OPTIONS: Partial<PeerOptions> = {
  debug: 0,
  config: {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      {
        urls: ['turn:global.relay.metered.ca:80', 'turn:global.relay.metered.ca:80?transport=tcp', 'turns:global.relay.metered.ca:443?transport=tcp'],
        ...RELAY,
      },
    ],
  },
};

/** Both sides send `ping` on `ctrl` this often (§9.1). */
export const PING_MS = 1000;
/** A peer that sends nothing on either channel for this long is disconnected (§9.1). */
export const PEER_TIMEOUT_MS = 5000;
/**
 * A heartbeat check this late after the previous one means the checking side's main thread was
 * blocked (loading, compiling shaders); it can't have heard anything meanwhile, so it doesn't count
 * that time as the other side's silence.
 */
export const STALL_MS = 2 * PING_MS;
/** A client loading the game allows the host this long a silence: the host may be loading too (§3). */
export const LOADING_PEER_TIMEOUT_MS = 25000;
/** The host skips a snapshot part for a client whose `snap` channel has more than this buffered (§9.1). */
export const SNAP_BUFFER_LIMIT = 64000;
/** How long a closing side waits for its last messages to go out before closing the connection. */
export const FLUSH_MS = 1000;
