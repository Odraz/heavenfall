/** Exact room currency ledger; cleanup forfeits its share instead of paying it (game.md §6.1). */
import type { RoomShape } from '../data/dungeons/types';

const HALOS: Record<RoomShape, readonly number[]> = {
  '1x1': [0, 12, 15, 18], '2x1': [0, 18, 21, 24], '1x2': [0, 18, 21, 24], '2x2': [0, 0, 30, 33],
};
export const HALO_WEIGHT = [1, 10, 10] as const;
export function haloBudget(shape: RoomShape, band: number): number { return HALOS[shape][band] ?? 0; }
export function moteCap(shape?: RoomShape): number { return shape === '1x1' ? 4 : shape === '2x2' || !shape ? 8 : 6; }

export class HaloLedger {
  readonly reservedElites: number;
  readonly remainder: number;
  private numerator = 0;
  paid = 0;
  constructor(readonly budget: number, readonly weight: number, eliteCount = 0) {
    this.reservedElites = Math.min(eliteCount, Math.floor(budget / 6));
    this.remainder = budget - 6 * this.reservedElites;
  }
  /** One-halo coins make rewards three times as frequent without inflating the room budget. */
  death(weight: number): number {
    if (this.weight <= 0 || weight <= 0 || this.paid >= this.remainder) return 0;
    this.numerator += this.remainder * weight;
    const total = Math.min(this.remainder, Math.floor(this.numerator / this.weight));
    const coins = total - this.paid;
    this.paid = total;
    return coins;
  }
}
