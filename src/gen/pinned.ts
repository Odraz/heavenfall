/**
 * One seed's implemented output, pinned after validation (rogue game.md §14.9). Pinned seed i = 114,
 * Appendix A.1's 0x12EBAA83; its layout matches A.1's historical one room for room. A generator or pool
 * change that moves it is a RULES_VERSION bump.
 */
export const PINNED_R1 = { seed: 0x12ebaa83, attempts: 1, n: 11, floorHash: 'd12ff201' };
/** R2 full-pool output, deliberately repinned at rules revision 5. */
export const PINNED = { seed: 0x12ebaa83, attempts: 1, n: 11, floorHash: '43dfb2f9' };
