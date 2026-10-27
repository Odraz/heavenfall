# Round 4: rewards, combinations and replay audit

Reviewed 2026-10-11. Scope: `docs/rogue/items-relics.md`, the core reward/offer/progression/lifecycle contracts, the four class source rules, boss geometry/immunities, lore, the brief, the horde-fun report, playtest records and preceding review records. Method: source reading, primary developer research, adversarial event walkthroughs and a second read of the edited catalog. No code, UI, tests, builds or gameplay execution were performed.

## Findings closed in the catalog

| Finding | Failure scenario | Resolution |
|---|---|---|
| Manual self reuse and pickup refresh lacked a consistent contract | Feather is refused despite the refresh rule; a full Seal consumes a pickup for duration only | Explicit manual Feather refresh; Seal must pass current-shield <50 for manual or pickup refresh; core §7.3 reconciliation sent to coordinator |
| Staggered overlapping poison pools could multiply damage despite the nonstacking promise | Four players land alternating pools between each other's pulses | One per-enemy half-second Bitter Water damage budget across all owners, retained on exit/re-entry, with newest covering source ownership |
| One-time control had no outcome for an immune first contact | Plume retries after a bind expires or re-entry unpredictably | First covered membership spends the per-instance attempt; immune/bound/already-airborne victims do not queue later launches |
| Elevated Gatekeeper could be pooled by its ground footprint | Tile/Appeal reads a lip pool through the dais | Follow actual boss body/area intersection and supporting-floor elevation; no through-floor pooling |
| Floor controls, burst spheres and homing targets used ambiguous height rules | Chorus fires below an airborne selection, or a floor ring affects distant air targets | Floor origin projection, connected-floor coverage, explicit 3D damage spheres and distinct combo spatial rules |
| Boss parts could be selected by relic targeting or counted for Comb | A passive chooses a mandatory aiming target or farms its destruction into procs | Autonomous selection and hit/kill-trigger exclusion; only accepted incidental damage with encounter area modifier |
| Counterseal had an unspecified projectile collision/endpoint | Implementers might add impact damage, homing or a second explosion | Accepted aimed 3D ray, body-transparent flight, terrain-shortened endpoint, one radius-three burst and no direct damage |
| Ordinary/combo cooldown identities were ambiguous | Swapping Wheel/Comb repeatedly manufactures a fresh Harrow activation | Combo uses b's ordinary relic-ID timer; changing mode removes outgoing persistent effects and never resets either timer |
| Allocation rejection contradicted successful-creation-only cooldown language | A failed entity-cap proc is retried every tick | Explicit cap-rejection exception starts normal internal cooldown; failed target/origin search remains free |
| Appeal's first thrown item could be interpreted as a deferred activation | A pool landing later gains an extra proc without another use | Read actual area membership after accepted use; placed area immediate, flight not yet landed, later self/instant use may stamp an existing area |
| Harrow's lane orientation and altitude were unclear | A wheel rolls across the comb's long side or hits flyers through floors | Recorded horizontal attack aim, perpendicular to comb's long axis, connected-floor travel and ground-target mask |
| Disconnected deed eligibility contradicted core victory recovery | The catalog rejects a deed that the host's admitted unclosed record has already settled | Catalog follows held offline settlement for known-profile rejoin; voluntary pre-win leave closes the record |
| Exhausted bargain fallback could sell six halos for permanent-run HP cost | Collection complete and no Rite slot/node still offers the bargain | Only a legal Rite with a free slot is an exhausted-collection bargain; otherwise absent; chest fallback remains once-only |

## Research and adaptation

Edmund McMillen describes fixed core reward rooms, optional risk rooms and items that modify shots or play in his original [Isaac gameplay design explanation](https://edmundmcmillen.blogspot.com/2011/09/binding-of-isaac-gameplay-explained.html?commentPage=2). The inference for this slice is to preserve recognizable goals while letting route costs, carried tools and run Rites change how the player approaches them. Random layout alone is insufficient; the guaranteed early Rite is a concrete useful adaptation.

Supergiant's [Long Winter update notes](https://www.supergiantgames.com/blog/hades-long-winter-update-patch-notes/) show continued revision of effects and role ownership, including consolidating slowing effects under Demeter. The inference here is to keep class-specific taunt/silence/incense ownership while permitting items and unrelated relics to read those states; importing every powerful effect into every class would erase meaningful composition.

These sources support design reasoning, not a mathematical guarantee of enjoyment. This spec deliberately adapts Isaac through constrained class kits, four real-time co-op inputs, authored replacement pairs and capped secondary effects; it does not copy unrestricted collectible accumulation.

## Paper replay results

The new player has a base kit, a guaranteed early run pick, pickup dives, two carry slots and a chest collection objective. Developed accounts gain useful-first chest choices while usable unowned IDs remain; dormant collection choices are honestly marked. After collection exhaustion the chest still offers run identity through a Rite, optional bells trade time/risk for Rites, and the bargain cannot charge HP for a worthless cap fallback. Six replacement pairs preserve specific lost benefits rather than a third passive, so unrelated pairs remain meaningful.

Four humans share XP/halo credits while the actual collector owns Quill/Mercy; one world item cannot produce four uses. Overlapping poison/slow and control do not secretly multiply. Stable offers, source provenance and shared combo timers prevent menu/reconnect rerolls and cooldown laundering. Accepted item flights keep their spent entitlement through death, while leaving/disconnect removes them under the core contract. Boss parts remain an aiming task, and ranged adds retain their bounded ordinary-mote budget.

The catalog's new §4.3 records the repeated walkthroughs used to check these closures. Core edits are coordinator-owned; the active-self refresh and exhaustion-bargain reconciliation were communicated rather than editing `game.md` concurrently.

## Material limits

The collection is finite, as is one dungeon with twenty combat templates. Twelve relics, six combos and four temporary nodes per run can create varied decisions without implying unlimited new content. Actual reward satisfaction, combo dominance, input diversity, fatigue and crest readability require observed play after implementation. The rule baseline permits trusted friends to carry idle/disconnected teammates; it does not prove individual deed effort or authenticate offline profiles. Future verification suggestions are recorded in the slice acceptance checklist, and need the user's authorization before executing tests.
