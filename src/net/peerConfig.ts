/** PeerJS options shared by hosts and clients (§2.1, §9.1). */
import type { PeerOptions } from 'peerjs';

/**
 * The public PeerJS cloud signaling server (PeerJS's default) and Google's public STUN server.
 * PeerJS's default ICE list also has a TURN relay, which is out of scope (§14), so it's replaced.
 */
export const PEER_OPTIONS: Partial<PeerOptions> = {
  debug: 0,
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },
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
