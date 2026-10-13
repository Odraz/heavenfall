/**
 * One seed's implemented output, pinned after validation (rogue game.md §14.9). Pinned seed i = 114,
 * Appendix A.1's 0x12EBAA83; its layout matches A.1's historical one room for room. A generator or pool
 * change that moves it is a RULES_VERSION bump.
 */
/** Rules 12 stamps the first commander family; the R1 geometry is unchanged (rules 11: 0de689be). */
export const PINNED_R1 = { seed: 0x12ebaa83, attempts: 1, n: 11, floorHash: '36998d2e' };
/** R2 full-pool output, repinned for commander families (rules 11: 81713798); geometry/selections unchanged. */
export const PINNED = { seed: 0x12ebaa83, attempts: 1, n: 11, floorHash: 'de6939ce' };
