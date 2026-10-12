import { describe, expect, it } from 'vitest';
import { haloBudget, HaloLedger, moteCap } from './economy';

describe('R2 exact halo ledger', () => {
  it('pays the same full room budget for each party size without losing the last coin', () => {
    for (const factor of [0.4, 0.5, 0.6, 0.7, 0.8, 1]) {
      const weights = [...Array(Math.ceil(333 * factor)).fill(1), ...Array(Math.ceil(11 * factor)).fill(10)];
      for (const order of [weights, [...weights].reverse()]) {
        const ledger = new HaloLedger(33, order.reduce((n, w) => n + w, 0));
        expect(order.reduce((n, w) => n + ledger.death(w) * 3, 0)).toBe(33);
        expect(ledger.death(10)).toBe(0); expect(ledger.paid).toBe(33);
      }
    }
  });
  it('reserves elite gold separately and cleanup cannot pay an unpaid share', () => {
    const ledger = new HaloLedger(18, 100, 2);
    expect(ledger.reservedElites).toBe(2); expect(ledger.remainder).toBe(6);
    for (let i = 0; i < 50; i++) ledger.death(1);
    expect(ledger.paid).toBe(3); // remaining 50 victims removed by cleanup: no calls and no coins.
    expect(new HaloLedger(12, 0, 10).reservedElites).toBe(2);
    expect(new HaloLedger(12, 0).death(1)).toBe(0);
  });
  it('uses the authored shape/band income and encounter mote bounds', () => {
    expect([1, 2, 3].map((b) => haloBudget('1x1', b))).toEqual([12, 15, 18]);
    expect([1, 2, 3].map((b) => haloBudget('1x2', b))).toEqual([18, 21, 24]);
    expect([2, 3].map((b) => haloBudget('2x2', b))).toEqual([30, 33]);
    expect(['1x1', '2x1', '2x2'].map((s) => moteCap(s as '1x1' | '2x1' | '2x2'))).toEqual([4, 6, 8]);
  });
});
