/**
 * One seed's implemented output, pinned after validation (rogue game.md §14.9). Pinned seed i = 114,
 * Appendix A.1's 0x12EBAA83; its layout matches A.1's historical one room for room. A generator or pool
 * change that moves it is a RULES_VERSION bump.
 */
/** Rules 6 adds walkable ends to the shared flyer-room hedges (historical R1 hash: d12ff201). */
export const PINNED_R1 = { seed: 0x12ebaa83, attempts: 1, n: 11, floorHash: 'a36a72b9' };
/** R2 full-pool output, deliberately repinned with the platform repairs at rules revision 6. */
export const PINNED = { seed: 0x12ebaa83, attempts: 1, n: 11, floorHash: 'ad5d1609' };
