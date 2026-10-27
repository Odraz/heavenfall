/**
 * How a connection is doing (netcode stage, 2026-10-22): the round trip measured by `ping`/`pong`
 * timestamps on `ctrl`, and whether WebRTC found a direct path or goes through the TURN relay.
 */

/** Weight of a new round-trip sample in the average. */
const RTT_GAIN = 0.25;

export type LinkRoute = 'direct' | 'relay';

export class LinkQuality {
  /** Average round trip, ms; null before the first `pong`. */
  rttMs: number | null = null;
  route: LinkRoute | null = null;

  /** A `pong` echoing the `t` its `ping` carried arrived at `now`. */
  pong(t: number, now = performance.now()): void {
    if (!Number.isFinite(t) || t > now) return;
    const rtt = now - t;
    this.rttMs = this.rttMs === null ? rtt : this.rttMs + (rtt - this.rttMs) * RTT_GAIN;
  }

  /** Looks up the route of a peer connection's selected candidate pair; failures keep the old value. */
  async probe(pc: RTCPeerConnection | null | undefined): Promise<void> {
    if (!pc) return;
    try {
      this.route = routeOf(await pc.getStats()) ?? this.route;
    } catch {
      // A closed connection has no stats.
    }
  }

  /** `ping 45 ms (direct)`, for the F3 overlay. */
  text(): string {
    return `ping ${this.rttMs === null ? '–' : `${Math.round(this.rttMs)} ms`}${this.route ? ` (${this.route})` : ''}`;
  }
}

/** The selected candidate pair's route in a stats report: relay if either end is a TURN relay candidate. */
export function routeOf(stats: RTCStatsReport | Map<string, Record<string, unknown>>): LinkRoute | null {
  const all = stats as Map<string, Record<string, unknown>>;
  let pair: Record<string, unknown> | undefined;
  for (const s of all.values()) {
    if (s.type === 'transport' && typeof s.selectedCandidatePairId === 'string') pair = all.get(s.selectedCandidatePairId);
  }
  if (!pair) for (const s of all.values()) if (s.type === 'candidate-pair' && s.state === 'succeeded' && s.nominated) { pair = s; break; }
  if (!pair) return null;
  const local = all.get(pair.localCandidateId as string), remote = all.get(pair.remoteCandidateId as string);
  if (!local || !remote) return null;
  return local.candidateType === 'relay' || remote.candidateType === 'relay' ? 'relay' : 'direct';
}
