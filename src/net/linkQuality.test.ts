import { describe, expect, it } from 'vitest';
import { LinkQuality, routeOf } from './linkQuality';

describe('link quality', () => {
  it('averages the round trips of pongs and ignores timestamps from the future', () => {
    const q = new LinkQuality();
    expect(q.text()).toBe('ping –');
    q.pong(1000, 1100);
    expect(q.rttMs).toBe(100);
    q.pong(2000, 2200);
    expect(q.rttMs).toBe(125);
    q.pong(5000, 4000);
    expect(q.rttMs).toBe(125);
    q.route = 'relay';
    expect(q.text()).toBe('ping 125 ms (relay)');
  });

  it('reads the selected candidate pair: relay when either end is a TURN relay', () => {
    const report = (local: string, remote: string) => new Map<string, Record<string, unknown>>([
      ['T', { type: 'transport', selectedCandidatePairId: 'P' }],
      ['P', { type: 'candidate-pair', localCandidateId: 'L', remoteCandidateId: 'R', state: 'succeeded', nominated: true }],
      ['X', { type: 'candidate-pair', localCandidateId: 'L2', remoteCandidateId: 'R', state: 'failed' }],
      ['L', { type: 'local-candidate', candidateType: local }],
      ['L2', { type: 'local-candidate', candidateType: 'relay' }],
      ['R', { type: 'remote-candidate', candidateType: remote }],
    ]);
    expect(routeOf(report('host', 'srflx'))).toBe('direct');
    expect(routeOf(report('relay', 'host'))).toBe('relay');
    expect(routeOf(report('srflx', 'relay'))).toBe('relay');
    // Without a transport entry the nominated, succeeded pair counts; with none, nothing is known.
    const noTransport = report('host', 'host'); noTransport.delete('T');
    expect(routeOf(noTransport)).toBe('direct');
    expect(routeOf(new Map())).toBeNull();
  });
});
