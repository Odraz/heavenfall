# Revision 7: integration review and implementation readiness

Completed 2026-10-11. Scope: the existing one-dungeon Pearly Gates specification in `docs/rogue`, its lore constraints, horde-shooter research and four playtest reports. Earlier completed-review labels were treated as claims to challenge. No game code, frontend code or tests were changed; no tests, validators, builds, game sessions or benchmarks were executed.

## Review method and authority

Three specialist agents read and repaired separate catalogs: [class/build review](r7-builds.md), [encounter review](r7-encounters.md) and [item/reward review](r7-rewards.md). Each completed repeated adversarial reasoning rounds. They independently reread integrated rules and challenged another domain; moving attacks, item replication, retained sources and settlement produced additional fixes. The coordinator read core rules, lore, research and playtests, integrated shared contracts, then updated acceptance coverage and implementation order. Final class/encounter cross-review found no further known blocking contradiction.

[game.md](../../../docs/rogue/game.md) is the system authority; catalogs supply concrete authored geometry/numbers. [README.md](../../../docs/rogue/README.md) is the entry point. Historical reviews and the original brief remain history, not competing runtime contracts. [Current research](../r7-design-research.md) labels primary-source observations separately from our design inferences.

The starting spec was copied into a temporary baseline so the final changes could be inspected even though the spec/research folders are untracked. No commit was made. The review is not a claim of an `origin/master` code diff: that ref is absent, and the requested work was specification editing.

## Repairs that change a player's actual experience

| Defect or misleading promise | Adopted rule |
|---|---|
| Bread of Angels advertised a harvest before a mass clearance, but spacing permitted one mote from an instantaneous multikill. | Up to six distinct eligible deaths can admit six motes together, within world/pending capacity. Quota is atomic; rejected resolved corpses cannot be replayed. Collection and loss of Shroud remain the cost. |
| A prepared return or steered charge inherited an irrelevant cast-facing direction. | Way Back captures its return path; Gatebreaker captures its first positive-hit segment. One swept leg accumulates distinct native hits once on the original root. Comb preserves the first hit point; Harrow follows the resulting lane. |
| A native censer's impact victim plus four first-pulse victims had two plausible hit-count interpretations. | Impact plus the first native cloud/furrow pulse group shares one distinct-victim window. Threshold dispatch is once; later pulses never accumulate another hit-count attack. |
| Some combo prose promised listeners which cannot accept an allied launch; Fetters could silently attach to secondary damage. | Source/owner predicates govern listeners. Allied launch can feed Binder's eligible landing reader or later direct state reads; it cannot manufacture Fallen own-launch events. Fetters covers its authored direct weapon/Delivery hits. |
| Free chest relic offers could retain an unresolved exit hold with no explicit terminal refusal. | Pass closes that source, releases reservations and grants nothing. Esc keeps the exact offer. Claim/Pass share scoped offer identity and accepted ownership/range/life/phase rules. |
| Deeds were advertised as goals for runs 10–30 despite earlier legal completion. | They are finite repeat-run challenges and can award together on a qualifying second victory. Continued replay depends on decisions, not a false unlock-grind promise. |
| A changed slot's present metadata could erase a surviving accepted native source's usefulness. | Current kit and actual retained source metadata are distinct. Only unexpired sources permitted by authored cleanup retain original native slot credit/setup; consumed hit-count windows and secondary sources cannot qualify. |

Compatible Delivery/Payload composition remains. The two-visible-effect rule governs the native action and its augment channels; separately authored passive reactions have their own visible cues, quotas and provenance. There is no new third Payload or bypass of the two active kill-discharge limit. Frost now has one bounded eight-origin bundle. Red Iron requires a surviving accepted melee victim; invulnerability and lethal contact cannot manufacture a new spark.

## Geometry, networking and durable state

| Boundary defect | Adopted rule |
|---|---|
| Treating rewardSpot's rectangle origin as a point displaced mirrored/rotated reward squares, including the central boss square. | Transform all four occupied corners of the 4×4 square, take the new minimum and derive its continuous center. Physical threshold/wall coordinates retain their separate transform. |
| Bell use could be accepted from an incorrect ground/horizontal anchor. | Accepted eye must be within 2.5 m in 3D with LOS to the actual lower rim at the reward square center and supporting floor +3 m. |
| Bots avoided the moving Toll ring but could miss its initial birth disk; a ground ring could damage beneath an invisible terrace. | Predict announced impact and body contact during the tell; jump with the authored lead. The visible band follows affected floor/stair surfaces. Dominion also uses actual body-center LOS on a low dais. |
| An attached incense wearer could teleport its source into another arena. | Detach at the last valid point in the emitting room on death, disconnect, teleport or room exit; preserve original expiry, slot provenance and quota. |
| Item use replicated yaw despite full 3D throws. | Accepted events carry root/instance, room, 3D origin/aim, static bound and deadline. Host landing publishes actual anchor/activation/expiry; ended events remove canceled/replaced effects. Recovery carries reservations and current accepted state. |
| Newest-area and simultaneous-input outcomes depended on implementation accident. | Area activation is placement/landing, not flight start; ties use owner then instance ID. Manual slots resolve 1 then 2 before automatic pickup contacts, without queued rejected presses; storage uses the lowest matching nonfull slot then lowest empty. |
| Reviving souls before applying a general victory heal could grant 80% HP. | Capture alive/soul groups at victory latch. Existing souls receive exactly 50%; only already-living connected humans receive the separate 30% heal, subject to Penance. |
| Offline boss XP, debug state and stale post-victory events had inconsistent persistence boundaries. | Offline records can receive qualified settlement but no boss XP. Immutable progression-disabled admission uses a disposable clone before any stake/save write; normal runs cannot enable inherited simulation-changing debug. New normal admission clears obsolete settlement context; settled events identify class and progression mode. |
| Peers received assignments without sufficient Rite/learned/suppression metadata. | Public accepted kits include those IDs and revisions. Clients can resolve the actual movement/shape kit while the host retains state/contact/target authority. |

Boss summons explicitly contribute ordinary combat streak/Armageddon credit while never supplying XP/halo/item or bonus-harvest farms. Boss parts and cleared trickle retain their exclusions. Prop movement passability does not remove attack-query cylinders. Enemy parts, projectiles, pickups, areas, queued entitlements and snapshots stay bounded; no repair raises the declared global caps.

## Playing the repaired specification in our heads

| Mental run / event sequence | Resulting choice or failure boundary |
|---|---|
| Fresh solo, each class | The compulsory first fight provides a legal early Rite. Four temporary picks can reach a three-lower-node alternative, but cannot alone pay a six-point capstone. The boss has solo answers without mandatory shop stock or unlocked talents. |
| Fully learned/collected profile | Same-channel Rite substitution gives a real temporary change while preserving legal ownership. The compatible channel remains. Pass keeps a preferred build; exhausted relic sources do not require an absent account unlock. Four desirable later picks are not guaranteed. |
| Bread then six-kill clearance | Six valid admissions can create the harvest immediately; collecting it requires position and risks losing the base shield/burst. Boss/secondary/world deaths cannot farm the bonus. |
| Marker placed north; return west while camera faces south | Positive cuts across the one westward leg may qualify Comb once at the retained first-hit point. Scattered Sheep's launch replacement has no cut damage and cannot qualify that hit-count event. |
| Impact kills one; native first pulse damages four different enemies | One five-victim window qualifies; the dead impact position remains usable. Later ticks do not reset it, though eligible native kill relics retain their own cooldown rules. |
| Long Water throw then quick Ward placement | Ward is newest until Water actually lands. Appeal on the throw does not trigger again at landing; a later use can read the newest eligible landed area. Rejoin cannot invent a fresh flight or quota. |
| Three humans and a bot; four humans; player missing at victory | Bots contribute the defined frozen encounter scaling and rescue behavior, no profile/rewards. Disconnected records retain declared settlement rights without away-time XP/halos. Victory life groups prevent double healing. |
| Cast source, legal slot edit, source later resolves | Only actually surviving accepted metadata counts. Removed augment contributions are gone; remaining base/native sources retain their authored root/slot/expiry. Fixed offers may disable/re-enable without redraw. |
| Threshold/body death, fatal hit, native shield break or exit shopping | Declared host order decides the latch. A prior-cast native break can resolve before defeat; no dead participant submits a new action. Post-win claims/shopping remain bounded and durable; skipped fights, Bells and unpaid bargains stay unavailable. |

The specialist records contain additional paper arithmetic, twelve legal capstone paths, nine-point extensions, all four fresh Rite sequences, geometry cases and claim/recovery races. These are reasoned scenarios, not exhaustive enumeration of all seeds, allocations or concurrent packet schedules.

## Readiness decision and evidence still needed

**Ready to implement as a specification baseline, with no known blocking design contradiction remaining from these rounds.** Content remains one Pearly Gates dungeon: twenty combat templates, four special templates, four classes, eighty-four nodes, twelve alternatives, eight items, twelve relics, six combinations, four deeds and five Edicts. Later heavens, mini-bosses, host migration and offline mid-run resume remain deferred. Lore and base class boundaries were preserved.

Implementation order now respects actual dependencies: enemy/hazard support before dependent templates/Bells; authoritative identities, effects, budgets and transport before consumers; durable profiles/settlement before persistent grants; source/modifier resolution before claimable Rites and exhausted-source fallbacks; complete Gatekeeper and lifecycle before final acceptance. A partial implementation must label its supported subset rather than publish an authored template it cannot execute.

The highest remaining risks require observed implementation evidence:

1. **Pacing and repeat play:** the modeled solo Saint boss can last about five minutes. Decide from play whether it stays engaging; do not mistake its arithmetic for a measurement. Observe late-run fatigue and voluntary choices on already-collected accounts.
2. **Choice quality:** confirm at least two viable approaches per class, costly tradeoffs for routes/combos, useful items during actual pressure, and acceptable fixed-offer/respec/inventory friction. Counts of legal combinations or button presses are not fun evidence.
3. **Readability and accessibility:** actual crest cues, reward interaction, rotated terrain, Toll/elite visibility, solo rescue and bot response must match the authored contracts.
4. **Performance and lifecycle:** measure the complete current rooms, hazards and effects on the stated hardware and confirm actual transport/save behavior. Historical prototype numbers do not cover the expanded slice.

[slice-acceptance.md](../../../docs/rogue/slice-acceptance.md) records the future suggested observations and reviewed boundary cases. This review cannot prove every possible defect absent, implementation correctness, balance or unlimited enjoyment. It provides concrete rules and traced decisions instead of claiming those outcomes without a playable build.

