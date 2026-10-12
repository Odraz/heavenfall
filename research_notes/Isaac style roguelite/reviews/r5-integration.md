# Revision 5: Pearly Gates specification integration

**Date:** 2026-10-11. **Current baseline:** [docs/rogue/README.md](../../../docs/rogue/README.md). This is an independent repair pass over the substantial revision-4 specification, not a claim to have newly authored its existing 84 talents or dungeon systems.

The intended slice remains one generated Pearly Gates dungeon with four classes and every scoped progression, reward, encounter and lifecycle system. Heaven is orderly rather than evil; the damned climb to stop Judgment; angels die in feathers and gold sparks; the Gatekeeper's first trumpet remains silent. No additional heaven, regular enemy, combat button or item catalog was added to solve the review findings.

## Why the Isaac adaptation now survives a completed account

The important defect was mechanical, not a shortage of catalog entries. A legal nine-point Fallen with all seven Burning Sand nodes plus Red Iron/Unbowed had **no eligible starting Rite**. Its persistent augments blocked alternative lower nodes; the other branches could not open their gates. After collecting the relics, the run's promised build rewards became coins.

Revision 5 allows an augment Rite to temporarily substitute for one learned augment in its implicit attack/ability group. Its card shows the new effect, sacrificed effect and any dependent effects losing their setup. Learned ownership, spent points and legal gates survive, while only the resolved active effect executes. A second Rite, capstone or explicit exclusion cannot be displaced. Source predicates use the candidate's actual resulting kit, and actual run end restores the retained learned effect.

This supports distinct attempts with the same persistent character. A fire Fallen can slow arrivals and trample them instead of making Q fire, or launch shotgun survivors and damage their landings instead of leaving kill-fire. The other catalogs contain equally explicit alternatives:

| Starting veteran | One run plan | Another run plan | Cost that stays visible |
|---|---|---|---|
| Fallen firewalker | Weight of Sin → Underfoot | Heave → As We Fell | Q fire circle or shotgun kill-fire is surrendered |
| Heretic pyre-walker | Long Chain → Walk in the Smoke | Wall of Fire | LMB furrow or Communion's launch escape is surrendered |
| Binder warden | Whirl → Ring of the Giants | Voice of the Pit → Where They Fall | Ranged Whip/Boundary positioning or E's saved interrupt timing changes |
| Betrayer field keeper | Glancing Silver → Judas Coin | Recoil → One of Them → Way Back | Endpoint bind and Field/capstone benefits give way to aim or planned escape |

These are possible sequences when the fixed offers contain the cards, not scripted drops. Each catalog §6.1 traces the exact nine learned nodes and subsequent lower-tier gates. The build reviewer also gave a bounded manual existence argument for an initial effect-changing solo Rite in every legal initial allocation. This does not promise four useful Rites after earlier temporary choices occupy groups, equal strength between variants or indefinite novelty from a finite pool.

The surrounding loop retains its costs: dive into pressure for fading resources, read the next encounter/reward, choose a key/relic detour or the Sundial, consider a Bell, adapt at the Confessional, then face the Gatekeeper's movement/aim/rescue test. Victory closes skipped fights, Bells and unpaid bargains. A fast route cannot reclaim all the forgone rewards while invulnerable.

## Review rounds

Three requested specialist agents read the relevant lore, horde research, playtest records and existing reviews, with separate editing ownership:

- [Core systems](r5-core.md): generator, economy, eligibility, gates, protocol, persistence, recovery and lifecycle.
- [Rooms and encounters](r5-encounters.md): all templates, transformed geometry, safe spawning, Dominion and Gatekeeper timing/fairness.
- [Builds and rewards](r5-builds-rewards.md): all four class catalogs, every node/alternative, items, relics, combinations and exhausted-account play.

The first repair pass was followed by repeated mental runs and independent cross-reviews of the changed contracts. The coordinator reread the final changes and traced the interactions across files. Later rounds found further problems rather than simply accepting the first reports: deferred cooldown laundering, paid versus free fallback, unavailable ally metadata, outgoing shaped areas, countdown menu timing and local ring-contact advice were repaired too.

Primary developer sources were reread for [the revision-5 design research](../r5-design-research.md): McMillen on Isaac, Blizzard on talent foundations, 2K on action-skill alternatives, Valve on constrained replayable encounters, and Fatshark on readable enemy jobs and individual rescue answers. Evidence and our design inferences are separated there. Historical research and prototype results remain history, with current rules defined by the core and catalogs.

## Other repairs integrated

| Area | Closed contradiction or failure |
|---|---|
| Reward identity | Original Rite cards remain fixed through free respec/reassignment. Disabled cards may re-enable; they cannot redraw or manufacture fallback. Explicit Pass closes an unwanted free choice without reward. |
| Source conditions | Own launch/incense/bind and assigned-slot predicates are precise. Dead/disconnected allies' uncast kits cannot license cards. Suppressed augment-shaped areas are removed selectively, preserving unrelated sources and timers. The coordinator's final table read also removed Cast Down's stale annotation claiming it shared the passive All of Tartarus capstone's augmentation group; their destination/coverage effects are compatible. |
| Paid/timed fallback | Free earned pages/chest fallback, health-priced bargains and strictly qualifying Sundial settlement have distinct rules. Invalidating original Sundial cards does not create money. |
| Ability assignment | Settle outgoing armed-action cancellation/end cooldown before carrying its remaining deadline. Way Back/Gatebreaker cannot transfer an apparent zero to a ready replacement. |
| Co-op menus | Valid Rite/relic/bargain/Advocate commits may finish during a countdown, with the existing life/range/room checks and bounded hold. Actual seal closes/rejects them. Valley-only teleport, Bell admission, item routing and recovery remain distinct. |
| Dungeon geometry | Logical socket orientation is separate from fixed physical doorway offsets. Filter transformed thresholds and all related safety distances before selection; do not carve through authored content. Identity/transpose preserve rectangular options. |
| Generator/validation/dispatch | Reliquary appears once in the combat candidate set; key comes from another fight. Ordinary combat, sanctuary, boss and single-template fixture validation have explicit separate scopes. Runtime dispatch uses room kind: the boss starts its own encounter despite its intentionally empty ordinary wave list, and cannot auto-clear on a visit. |
| Ranged encounters | Typed transformed spawn preferences survive stamping as stable marker IDs, while safe fallback remains mandatory. Authored choir cover now controls likely enemy placement. |
| Dominion | Incarnation/cast IDs and host start/impact ticks synchronize the tell, strike and cancellation without replaying on a reused slot. Lampstands' prose matches the 4.5 m strike radius. |
| Gatekeeper | Consistent 70 m Toll sweep, body-contact bot jump prediction and local lip timing; Volley cap includes native shatter damage; Judgment indicator includes pre-warning. Seal keeps its low-water headcount through tell/hold/rejoin, preventing repeated HP shrink. |
| Entitlements/rejoin | Separate encounter seal recipient sets distinguish earned pages/chest rights from connected XP/halos. Known resume retains life, HP, progress and deadlines without new healing/immunity. Human host ownership defines bot-only termination. |
| Pickup/inventory | Same-room LOS/support-height collection; earliest fade retained when coins merge; queued mote deadline retained; vertical throws terminate within one second. Every accepted post-win inventory mutation checkpoints safely. |
| Victory/exit | No new encounter or unpaid bargain after boss death. Earned untouched page/chest rights count for the bounded exit hold; no duplicate victory settlement or indefinite AFK exit. |
| Pacing/hints | Shortest fresh route may pay only 940 XP before the Advocate; universal learned-point claims were removed. H describes the effective kit and new controls. Decision target is per human, excluding automatic events and passive following. |
| Evidence | The revision-2 topology success rates and exact old seed layout are historical, not current full-content validation. Ascent terminology and adopted-decision summaries match the lore/current baseline. |

## Final manual coverage

The reviews traced fresh solo base kits, completed solo allocations, exhausted collections, mixed-level parties, one human with bots, shortest/full-clear routes, Bell cancellation, source replacement and later reassignment, death/revive, known reconnect, first admission around a seal, phase transitions, interrupted rescue/aim episodes, simultaneous victory/damage, pending choices and post-win persistence. The repaired shared contracts were reread after these changes. No further definite blocking contradiction was identified in those reviewed paths, and every concrete finding raised during this pass was resolved in the specification.

The complete current spec starts at [README.md](../../../docs/rogue/README.md); [slice-acceptance.md](../../../docs/rogue/slice-acceptance.md) maps the scenarios and future implementation observations. Its baseline includes 20 combat templates, four specials, fallback, Dominion, Refiner's Fire, complete Gatekeeper, 84 talents/12 alternatives, eight consumables, twelve relics/six combinations, deeds, Edicts and full run lifecycle.

**Evidence boundary:** no game/frontend code, tests, builds, benchmarks, generator validation scripts or play sessions were changed or run. This is a reviewed implementation specification. Geometry in the executable, transport/storage behavior, relative balance, sound/readability, browser performance and sustained fun still need playable evidence. A paper review cannot honestly certify an executable without bugs or unlimited replay enjoyment.
