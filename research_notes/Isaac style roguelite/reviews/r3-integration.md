# Revision 3: integration review

Date: 2026-10-11. Deliverable: [Pearly Gates specification](../../../docs/rogue/README.md). Method: specialist-agent reviews, coordinator cross-reading and paper run/state-transition walkthroughs. No implementation, tests, builds or play sessions were performed in this pass.

## Review rounds

| Round | Main question | Resolution |
|---|---|---|
| Content completion | Can all four classes and every required encounter/reward be implemented from a rule? | Completed Heretic and reviewed all 84 nodes/12 alternatives; authored eight consumables, twelve relics and six combinations; completed room/boss contracts and their solo/co-op scenarios. |
| Cross-system review | Do individual systems disagree about provenance, scaling, ownership or run lifetime? | Fixed ability unlock exclusions, lower-tier gates, legal solo builds, item/landing bundles, delayed source slots, XP/halo budgets, Bell mixture, grounded boss reach, phase/cycle recovery and secondary-proc limits. |
| Lifecycle and replay review | Does the run still work with exhausted unlocks, full pools, retries, reloads and victory? | Guaranteed early compulsory Rite, useful-first relic card, stable offers/reservations, atomic bargain/decline, reserved thrown landing, full transient-state sync, explicit death cleanup and recovery before new admission. |

## Material defects closed

- Rites could license permanent talents that became illegal at run end. Learned-only gates and atomic final-allocation validation now prevent that dependency.
- Alternative ability nodes could exclude the augment they were meant to unlock. Unlocks no longer occupy the augmentation group.
- Kill/landing chains could loop or grant an item's launch a Q/E capstone. Immutable source records, one capped landing bundle and the secondary-proc boundary define the result. Two fire-spread capstones retain a narrow area-refresh-only exception.
- Binder offers could contain two dormant slot-kill relics. Compatible-first drawing now checks actual damage provenance and marks collection-only choices honestly.
- A post-victory reconnect could start a new attempt and empty secured inventory. Resume/settled/new admission and cumulative settlement now preserve it.
- Boss-death saving could remove active Rites before the player finished the floor. Save the persistent projection while retaining run overlays until actual end.
- A different-run start could silently discard an undelivered old victory. Matching cached settlement lookup now precedes abandoned-attempt resolution; stale packets from older admitted contexts cannot rewrite the new run.
- Throwing charged an item before its future area capacity existed. Accepted flights now reserve that entitlement; death does not erase the spent flight, while disconnect/leave removes it.
- A queued talent mote could exceed its six-drop harvest quota. World or pending admission now consumes quota and starts expiry once.
- Boss cycles, phase overkill, reserved parts, solo holds and long-range Watchers had ambiguous outcomes. The fixed cycle, threshold clamp, reachable local targets and explicit victory latch close those branches. The first trumpet never sounds.
- Paper walkthroughs still used placeholder items, abstract combinations and obsolete boss plates. They now use catalog items, the Reversal combination, current rescue mechanics and the guaranteed early Rite.

## Replayability design conclusion

The report's safe-ring problem is addressed through resource retrieval, target priority, authored geometry and decisions with costs. Isaac contributes generated routes, changing run builds and risky reward sources. WoW/Borderlands contribute class identity and alternative abilities with readable dependencies. These are adaptations grounded in [developer research](../vertical_slice_research.md), not claims that another game's success proves this game's fun.

The slice now contains a coherent complete rule baseline and explicit deferred scope. Actual balance, readability, performance, repeated-run enjoyment and executable correctness still require the evidence in [slice-acceptance.md](../../../docs/rogue/slice-acceptance.md). No empirical guarantee is asserted by this paper review.
