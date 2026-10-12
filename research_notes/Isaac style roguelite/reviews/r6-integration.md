# Revision 6: integrated specification review

Reviewed 2026-10-11. Scope: the full Pearly Gates vertical-slice specification in `docs/rogue`, constrained by `docs/lore.md`, established class design, the horde-fun report and the recorded playtests. The original brief is preserved as input; current core rules and catalogs are authoritative.

The user's requested `origin/master` diff was attempted after fetching the repository's actual remote. That ref does not exist; the remote default is `origin/main`. The rogue specification is untracked work in progress, so a tracked Git diff contains none of it. The review therefore used the complete specification and a saved revision-5 file baseline for manual comparison. It did not invent master-relative findings.

## Review process

Three agents worked independently on disjoint catalogs while the coordinator reviewed the core:

- [Talent/class review](r6-talents.md): all four class trees, alternatives, legal paths, source predicates and replayable composition.
- [Encounter review](r6-encounters.md): room generation/geometry, spawning, hazard navigation, Gatekeeper movement/aim/rescue and event ordering.
- [Reward review](r6-rewards.md): items, relics, authored pairs, exhausted collections, ownership/provenance and persistent lifecycle.

The first round identified and repaired concrete gaps. The coordinator integrated shared contracts before the second round. All three agents then reread the combined rules and other catalogs, challenged their own earlier conclusions and reported additional repairs. The coordinator reconciled the worked multiplayer example, decision history, research and acceptance coverage against that integrated result. Neither previous review claims nor historical topology measurements were treated as proof.

No tests, new test files, executable validators, game sessions or benchmarks were run. Game implementation and frontend/UI code were not changed. Text searches, source reads, arithmetic reasoning and mental runs are the evidence for this specification review.

## Claude's five remarks

| Remark | Relevance in revision 5 | Final rule |
|---|---|---|
| One talent per attack is too strict; new abilities cannot be improved | Still relevant. Rite substitution varied one occupied group but did not compose compatible changes. Ability unlocks were exempt in theory, while alternative shaping was largely unspecified. | One Delivery plus one Payload per named input, channel-specific exclusions and substitutions, explicit alternative target sets/numbers and authored passive improvements. All twelve alternatives have a useful supported path. Core §9; class channel tables/scenarios. |
| Cross-class Rites can be dead without their provider | Partly repaired already, but raw output-state metadata could count dormant effects or unsupported provenance. | Finite typed source closure and proposed-kit revalidation: effective living kits, usable items and actual active sources seed it; triggered output needs reachable setup. No unseeded cycle, phantom teammate, future hazard or wrong-origin landing source. Core §9.9, §14.7; items §2.1.1. |
| One shot can set off every kill-triggered talent | Still relevant. Per-node victim limits and nonrecursive damage did not cap the number of active listeners. | At most two active kill-discharge talents per effective build. Each collects one capped bundle at the root's first eligible tick. Setup absence/cooldown does not release its slot. Catalog lists participating IDs; native/resource/finite propagation exceptions are explicit. Core §9.3, §14.11. |
| Room kill credit, special-only spawns and fire-aware pathfinding are missing | Kill rewards and avoidance had partial prose; core provenance, typed marker schema and full additional field budget were incomplete. | World death rewards separated from player killer credit; `spawnTags` only for Chorister/Dominion, filtering before affinity/fallback and unrestricted capacity minima; at most four additional dry-ground fields with cached escape/anchor rules. Core §4.7, §14.5, §14.11; rooms catalog. |
| Two Betrayer alternatives replace Field, losing party boss cadence | Still relevant. Coin and Way Back occupied Q and advised restoring Field before the boss. | Way Back replaces Shadowstep on E; Wire also occupies E. Only the optional Coin Q gives up Field. Weapon aim solves every mandatory boss target with either choice; no forced respec. Class/relic metadata and core A.3 now agree. |

## Additional gaps repaired

| Gap | Resolution |
|---|---|
| Applying an integer cell transform to continuous Gate wall coordinates shifted east/south geometry | Separate continuous boundary and discrete cell transforms; consistent segment, facing, terrain omission, hitboxes and inward floor/light sampling. Core §14.2; rooms/bosses. |
| An open doorway allowed a room-owned flight to leave its room and snap backward at landing | First owning-room intersection clips the flight; Counterseal/Harrow follow that ownership, and vestibule Counterseal emits nothing without invalidating the item use. Core §14.11; items. |
| A reflected globe could retain hostile shoot-down splash or consume the hostile reservation as a new friendly allocation | Remove hostile shatter; reverse incoming velocity for a zero-length return; reuse the projectile and retain its original hostile-budget allocation. Core §14.12; Mirror Ward. |
| Shooting down globes had a human killer but unspecified proc provenance; final-eye tether ordering could differ | Enemy-only shoot-down blasts retain the shooting root at secondary depth with null input slot. Settle a Watcher death and update the completion gate before its one tether; only subsequently accepted damage may finish the body. Core §14.11; bosses §3.5. |
| Rejecting any stale global revision could starve a valid purchase or personal claim amid shared rewards | Scoped loadout/inventory/offer versions with current atomic affordability/source/phase checks; unrelated host updates never act as CAS conflicts. Core §14.3, §14.11. |
| Reliable retries had an unbounded result cache or could execute again after eviction | 256 cached replies per human/run plus retained monotonic high-water; old evicted ids reject, resume receives next id, incoming controls have byte/rate bounds. Core §14.12. |
| A sustained native cloud's relic cadence conflicted with once-per-root wording | Relics aggregate per resolving tick under cooldown; later native pulses may activate. Talent kill discharges remain once per node/root. Core §14.11; items §2. |
| A lethal hostile hit could cause Shroud/Watcher tether victory after an implementation had already committed defeat | Accepted hit/life state, then synchronous prior-cast native break/tether consequences before all-dead. Invulnerability precedes shield depletion; one break per shield; victory revives the newly created soul. Core §11.5, §14.11; bosses §3.7. |
| Trickle deaths could advance talent meters or seed hidden fire/traps | Exclude enemy-triggered discharges/meters, keeping ordinary native shapes/states/defensive play. Actual later pickups keep their own permitted trigger. Core §4.8; class common rules. |
| A missing state could release a kill-listener budget, then an ally silently enabled a third listener | Count every equipped unsuppressed listener regardless of present setup/targets/cooldown; only named-input assignment/suppression changes active membership. Core §9.3. |
| New ability/native motion and passive capstones conflicted with generic augmentation wording | One primary verb, at most two native/composed effects; classify Kind augment and input-Modifies capstones explicitly, retaining authored passive-capstone compatibility. Core §9.3–§9.4. |
| Composed Coin branches could emit recoil per branch, nail a bounce or reuse a body | Shared root hit set and remaining budgets; one recoil envelope per root; terminal-only nail per at most three branches; no repeated bind ID. Betrayer catalog. |
| A near-wall Coin center could be placed behind its caster | Positive forward placement and sphere clearance required; otherwise refuse without cooldown. Betrayer catalog. |
| The entire hidden lip was credited with ideal eight-pellet output; a one-metre dais was claimed safe from melee | Explicit inherited cylinder, legal exposed-ray example and ideal-ceiling labeling; low dais offers routing advantage, not Blessed immunity. Rooms/bosses. |
| Chest collection timing and deferred LMB/RMB wording were inaccurate | Exactly eight distinct chest/pawn claims; four won double-claim floors or eight chest-only clears under stated assumptions. Defer weapon replacement, while the slice explicitly keeps attack augmentation. Core §8.3, §15.2. |
| The multiplayer example depended on Way Back Q and a now-dormant Reversal | Begin with Field Q/Way Back E and useful Tile/Last Plea; acquired Comb plus pawned Wheel creates Harrow at the Advocate. XP, inventory stakes and timed route remain the illustration. Core Appendix A.3. |

## Mental runs and implementation readiness

The agents and coordinator revisited fresh solo kits, six-/nine-point builds, alternative assignments, a completed collection, four temporary picks, fixed offers after source loss, multi-branch burst kills, delayed native pulses, state-source cycles, ground/flyer/boss eligibility, mixed-level humans/bots, Bell and Sundial choices, hostile reflection, restricted blocked markers, fire avoidance, rotated Gate planes, last-survivor damage-break victory, reconnect and post-win settlement. Reports record the concrete examples and predicates rather than claiming they were played.

The resulting revision retains the one-dungeon content boundary and the lore: four condemned heroes, bureaucratic Heaven, feather/gold deaths and the silent first trumpet. It adds build composition that changes the player's action while keeping explicit limits, meaningful timing/position/resource choices and solo answers. Legal gates, supported upgrades, source eligibility, action ownership, navigation costs, transport versions and terminal settlement have an implementable contract.

No known serious contradiction or missing design contract remained after the integrated follow-up review. This is a review conclusion, not proof of zero latent defects. The [acceptance checklist](../../../docs/rogue/slice-acceptance.md) specifies the remaining observed evidence: actual expanded/rotated geometry and generator outcomes, crest/frame budgets including dry fields, class/alternative boss duration, current-kit readability, choice rate, cooperation and repeated-run enjoyment. Initial numbers can change with that evidence; a paper estimate is never a completed benchmark.

The [revision-6 developer research](../r6-design-research.md) explains why visible composition, retained agency and readable pressure were chosen. More catalog entries alone are not the fun criterion. A collected player should voluntarily try a different route, delivery/payload combination, item timing or optional risk because the consequences differ. Unlimited replayability and a completely bugless specification cannot be certified by review; all identified issues in this pass have concrete repairs and the remaining uncertainty is named instead of hidden.
