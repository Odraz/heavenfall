# Revision 4: independent specification review and integration

Reviewed 2026-10-11. This pass starts from the substantial revision-3 specification already present in the work in progress. It repairs that baseline; it does not claim to have introduced its existing Rites, trees, room pool or reward systems.

## Scope and method

The coordinator read the core specification, lore, original brief, research, review history and playtest records. Three requested specialist agents reviewed separate content sets, exchanged shared-contract findings, repaired their owned files and reread the results:

- [Combat and builds](r4-combat-builds.md): all four class catalogs, legal talent paths, alternative abilities, source attribution and solo/co-op usefulness.
- [Encounters](r4-encounters.md): all authored room templates, props, elite/hazard, Gatekeeper geometry, schedule, rescue and state transport.
- [Rewards and replay](r4-rewards.md): every item, relic, replacement combination, deed and collection-exhaustion path, with independent core integration review.

The coordinator owned changes to `game.md`, the entry index and acceptance checklist: generator exceptions, economy/offer transactions, movement composition, transport, persistent settlement, solo sustain, timing and audio scope. Repairs were followed by further adversarial walkthroughs and cross-file reconciliation. Late discoveries, including the two-player healing card, direct-effect tradeoff and semantic obstacle rectangles, were repaired instead of stopping after the first review.

This is manual source and specification review. No game code, frontend code, tests, builds, benchmark, generator execution or play session was changed or run. Existing prototype measurements retain their original scope and revision. No implementation correctness or observed enjoyment is asserted by these walkthroughs.

## Coordinator findings and decisions

| Failure or contradiction | Final contract | Why it matters |
|---|---|---|
| A ten-room seed could never meet the fixed eleven-room fallback's count. | `fallbackUsed` is the sole count exception; retain the original seed for stock, rewards and identity, including the required early Rite. | Failed generation has a complete recovery path without reward rerolls. |
| Cleared-room waiting inherited health regeneration. | No valley/countdown/corridor passive healing; exact solo normal-combat breath remains, and exact solo boss regeneration is explicitly defined. | Heal pickups, carried consumables and the health bargain retain a cost. |
| Catalog refresh rules conflicted with core active-self rejection. | Explicitly authorized refresh/replacement may succeed; other active-self attempts reject for free. Seal refresh requires actual missing shield. | A useful charge has one use event; a worthless refresh cannot consume it. |
| Pending offers could be accepted beyond four Rites. | Check capacity and eligibility atomically at acceptance; surplus source settles its fallback once. | Concurrent pages cannot overfill a build or multiply rewards. |
| An ability Rite could silently gray a powerful existing build. | Preview the replaced ability, dormant owned augments/capstone and remaining slot cooldown; ownership persists and Confessional reassignment can restore effects. | Run variation is an informed trade rather than an unexplained loss. |
| Several launches or movement envelopes could reserve duplicated landings. | One active launch per victim and one active player movement envelope; swept distinct-victim contacts; recoil displacement suppressed during movement/hold. | Damage and movement remain bounded and readable. |
| Merged spreading fire could refresh native button-kill entitlement. | Keep contributor expiry, source depth and slot separately under shared visible terrain. | A secondary spread cannot become an unlimited primary proc engine. |
| Reusable enemy slots could satisfy stale hit sets or delayed effects. | `(slot, incarnation)` entity identity throughout effects and transport. | A newly spawned angel cannot inherit an old victim's landing or kill credit. |
| Equal-revision event siblings looked like duplicates. | Apply one composite transaction or a reliable batch with end marker; advance revision after the batch and deduplicate visuals by event index. | A purchase cannot spend a wallet while dropping its inventory grant. |
| An ordinary snapshot revision could discard reliable progress it did not contain. | Only a full reliable-state checkpoint covers its corresponding state; simulation snapshots do not supersede unseen wallet/offer batches. | Reordering cannot erase a legitimate reward or restore spent state. |
| Elevated parts lacked transmitted collision height. | Every enemy record is 14 bytes, including body-base z and incarnation; part cylinders and actual elevations are explicit. | Aiming at a Seal/Watcher and reconnect presentation use the host's actual body. |
| Boss timing and active rescue state were incomplete on rejoin. | Full encounter/part sync; signed cycle origin; consumed events, deadlines, holds, tethers and budgets persist. | Rejoin cannot restart Judgment, manufacture a Seal or refill add healing. |
| Human players could occupy every authored spawn marker indefinitely. | After bounded queuing, find safely separated reachable dry floor, warn and revalidate; never force a spawn into a player. | A safe-placement rule does not become an indefinite encounter stall. |
| Host victory needed a clear-count baseline absent from admission. | Validate bounded `clears` on first admission and retain the current-heaven baseline; settle the absolute increment once. | Reconnect and duplicate victory messages cannot increment a win twice. |
| Legal maximum imported progression could overflow. | Saturate XP and persistent nonnegative counters at the safe-integer maximum; admission/loadout and settlement use the same formula. | The host can still validate and settle a bounded imported profile. |
| Personal bests mixed distinct Edicts and changing parties. | Exact Edict mask plus class/human/bot roster; a changed roster disqualifies only comparable time. | Rewards remain valid without presenting unlike runs as equal records. |
| Sundial/deed entitlement depended on a disconnected player replying to a menu. | Qualification belongs to admitted unclosed records; stored legal selection/fallback settles without an offline reply. | A transient connection loss does not invent a second qualification rule. |
| Literal no-obstacle thresholds rejected purpose rectangles spanning flat approach cells. | Prohibit physical walls/off-base geometry/features; semantic purpose rectangles themselves add no collision. | The room data and its geometry requirements agree. |
| Sample Results timings included safe post-win shopping inconsistently. | Clear time stops on boss death; session exit time is separate; sample reconnect excludes comparable personal best. | The paper walkthrough follows the same clock as the shipped rules. |
| Recorded frequent combat feedback was deferred despite explicit sound fatigue in playtests. | Recorded/layered frequent attacks, impacts, deaths and breakables are slice acceptance, with variants, bounded mixing and asset provenance. | One of the observed causes of boredom is addressed by the MVP itself. |

The specialist reports contain the catalog-specific repairs: poison overlap, combo cooldown laundering, dormant targets, unsafe lamp positions, hazard escape, impossible rescue aim, permanent boss protection, direct-effect substitutions and legal class dependencies.

## Replayability interpretation

The adaptation keeps Isaac's recognizable run destinations and meaningful resource decisions, while class trees supply WoW/Borderlands-style identity. The existing guaranteed early Rite is retained because a fixed learned build plus random rooms would not reliably change an attempt. Further Rites are limited, gates remain readable and alternatives sacrifice a current ability. Relic pairs replace an effect rather than creating a third automatic upgrade. Optional bells, route previews, shop stock, carry limits, speed qualification and the health bargain create concrete time/safety/build costs.

The independent research supports these design principles, not particular balance numbers. See [verified primary research](../vertical_slice_research.md) and the rewards agent's source interpretation. A constrained real-time co-op slice intentionally does not reproduce unrestricted Isaac collectible accumulation. Cross-class states create cooperative setups while ownership, source depth, hit caps and entity budgets bound the combination surface.

Veterans retain route/build decisions after the twelve-relic collection is complete: legal Rite fallbacks, optional risk, alternative abilities, item plans and Edict/record goals. An exhausted bargain cannot charge health for a worthless halo fallback. A finite dungeon still has finite authored content; the objective is repeated meaningful choices, not an unsupported promise of infinite distinct experiences.

## Lore reconciliation

The four heroes retain their documented origins and roles: Fallen/Binder are fallen angels; Heretic/Betrayer are damned humans. Healing, binding, betrayal and stolen heavenly judgment remain the language of their mechanics. Heaven stays orderly and certain, angels burst into feathers/gold sparks, and player-made fire is distinct from hostile Refiner's Fire. The Gatekeeper's ceremonial Toll is an encounter cue; it does not sound the first apocalypse trumpet. Victory leaves that trumpet silent. Later heavens are recorded as unavailable rather than accidentally accessible unfinished content.

## Closure and material limits

The specialist rereads and coordinator integration found no remaining substantive blocker in the reviewed contracts. The review covered fresh solo kits, capstone paths, pure swarms, ranged rooms, bots/mixed progress, collection exhaustion, simultaneous offers, hold during movement, phase burst, repeated interrupts, airborne/floor interactions, reconnect and same-tick victory/death. Each case now has a declared authority and outcome.

The handoff is [the specification index](../../../docs/rogue/README.md), [core rules](../../../docs/rogue/game.md), the content catalogs and [acceptance checklist](../../../docs/rogue/slice-acceptance.md). Full implementation is still required. Solo Heretic boss duration, relative build strength, crest capacity/readability, sound fatigue, performance and repeat-run enjoyment require authorized observation in a playable build. These are explicitly recorded tuning and implementation questions, not missing required system contracts. A paper audit cannot certify a bug-free executable or guarantee fun.
