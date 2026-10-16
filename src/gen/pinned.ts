/**
 * One seed's implemented output, pinned after validation (rogue game.md §14.9). Pinned seed i = 114,
 * Appendix A.1's 0x12EBAA83; its layout matches A.1's historical one room for room. A generator or pool
 * change that moves it is a RULES_VERSION bump.
 */
/** Rules 12 stamps the first commander family; the R1 geometry is unchanged (rules 11: 0de689be). Rules 22 moves the Advocate's point onto the Confessional's north wall (rules 21: 4d45505c). Rules 23 converts Blessed into Watchmen in the wave data only (rules 22: 5f6dc51e). */
export const PINNED_R1 = { seed: 0x12ebaa83, attempts: 1, n: 11, floorHash: '33267d44' };
/** R2 full-pool output, repinned for commander families (rules 11: 81713798), the Advocate's point (rules 21: 74928d57) and the Watchmen's wave data (rules 22: 029559b5); geometry/selections unchanged. */
export const PINNED = { seed: 0x12ebaa83, attempts: 1, n: 11, floorHash: '16294200' };
