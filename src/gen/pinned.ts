/**
 * One seed's implemented output, pinned after validation (rogue game.md §14.9). Pinned seed i = 114,
 * Appendix A.1's 0x12EBAA83; its layout matches A.1's historical one room for room. A generator or pool
 * change that moves it is a RULES_VERSION bump.
 */
/** Rules 8 adds a commander to each generated wave (rules 6 R1 hash: a36a72b9). */
export const PINNED_R1 = { seed: 0x12ebaa83, attempts: 1, n: 11, floorHash: '906aa90b' };
/** R2 full-pool output, repinned for commanders; geometry/selections retain the rules 6 repair. */
export const PINNED = { seed: 0x12ebaa83, attempts: 1, n: 11, floorHash: 'c2f93477' };
