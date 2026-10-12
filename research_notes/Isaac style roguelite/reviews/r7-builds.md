# Revision 7: independent class and build review

Reviewed 2026-10-11. Owned scope: the four `docs/rogue/classes-*.md` catalogs. Reviewed all 84 node rows, all 12 new abilities, the class/lore intent, current core composition/source/lifecycle rules, the horde report and playtests 1–4. This is a manual specification review: no test, validator, build, game, frontend change or implementation change was run or made.

The earlier checked boxes were treated as claims to challenge. This review does not certify that the game is fun, balanced or free of every possible bug.

## Round 1: make the promised actions produce their payoff

| Finding | Repair | Scenario checked by reasoning |
|---|---|---|
| Bread of Angels promised a harvest just before a crater/Silver Bullet, but its one-mote-per-0.75-second limiter allowed only one mote from any instantaneous multikill. | Removed spacing, retained six admitted motes per cast, one per distinct eligible native death, deterministic order, atomic world/pending admission and every boss/proc exclusion. A rejected resolved death cannot be replayed later. | Bread → six eligible native deaths within 8 m on one tick → six motes and zero remaining quota. Seven deaths still give six. At 150 max HP the six give at most 72 HP; they still must be collected. Secondary Lazarus/chain kills and boss summons give none. |
| Altar cloud provenance referenced a nonexistent secondary "Altar state proc." | Altar and Scapegoat remain native LMB-delivered clouds. Separately emitted Kindling/Pitch/Lazarus/spread remain secondary. | A direct Altar cloud can satisfy an LMB/state trigger under the common pulse contract; a later passive ember death cannot become an LMB kill. |
| Heretic/Betrayer combos claimed allied launches dispatch Fallen own-launch landing passives. | Named Binder Where They Fall and independent state-reading hits as valid cross-class uses. Fallen landing passives keep their explicit own-source restriction. | Allied Exorcism/Scattered Sheep → Binder landing bind if owned/eligible; no Fallen As We Fell/Broken Wings/crash callback. A Fallen's own launch still gets its authored bundle. |
| Attached clouds had no rule for a wearer teleporting/leaving their emitting room. | Detach at the last valid point in their owning room on teleport/room exit as well as death/disconnect. Preserve the remaining lifetime. | Saint casts Witnesses on an ally; ally teleports through Pilgrim's Return → old cloud stays in its accepted arena and never damages another room. |
| Frost of Cocytus was per-kill wording without a root origin cap, despite the common once-per-root bundle. | One first-eligible-tick bundle with at most eight valid floor origins in accepted kill order; stable refresh/eviction. | Scourge kills 40 → at most eight candidate origins and eight active patches. Nearby origins merge; secondary chain kills generate no frost. |
| Ring and Well promised safety or retention beyond their actual geometry. | Ring acknowledges clipped destinations/free later arrivals; Shadowstep crosses a chord, not a whole circle. Well needs slow/bind setup to promise a held cloud. | At a wall, a clipped Ring body may remain in melee reach; an immediate swing matters. An unslowed Blessed can leave a Well at 1 m/s, while a 2.8-m/s slowed Blessed cannot walk against its 3-m/s drag. |
| Catalog authority and boss-summon deed prose disagreed with core/lore and Armageddon. | Match core §0 and clarify ordinary summons count for combat streak/Armageddon while retaining no XP/halo/item/bonus-harvest entitlement. Parts/trickle never build deed streaks. | Native summon kills can contribute to the authored streak deed; no repeated summon economy or harvest appears. |

## Round 2: challenge the repaired rules at timing and source boundaries

| Finding | Repair | Boundary scenario |
|---|---|---|
| Red Iron did not distinguish paid melee contact from invulnerability or a lethal owner hit. | Only a surviving accepted melee hit removing HP/shield emits the 10-damage secondary spark; blocked hits/dead owners emit none. | Leap immunity absorbs a strike → no thorns; an accepted shield hit while alive → one spark; lethal HP hit → no new defensive proc. Native prior-cast Shroud breaking remains its separately authored exception. |
| Bind listeners needed a precise ordinary expiry during the 0.3-second pull. | Preserve current simulation timing: Chains/Ring bound protections apply during accepted pull; 2.5 seconds follow its accepted completion. The six-second extension ceiling stays anchored to the original cast. | Cast at 0, pull accepted complete at 0.3 → ordinary expiry 2.8, ceiling 6.0. A transfer/Procession/grounding refresh cannot turn that into a new cast or extend past its surviving source contract. |
| Burning-cell eviction and center-versus-feet language were ambiguous. | Actual floor contact selects damage/membership. Evict oldest first-lit tick then room row-major cell ID; refresh does not reset age; eviction drops that cell's contributors. | Grounded Cherub can burn; hovering Cherub and a body above the main-floor fire cannot. A secondary spread refresh does not prolong the expired native Brand/Rain/Wall source. |
| Known Ground could be offered for already spent inert hazard scenery. | Require a remaining applicable normal/Bell encounter or surviving blast prop; expressly exclude enemy/boss attacks. | Both hazard encounter and Bell consumed, all blast props broken → no Known Ground Rite merely because the map still contains old hazard cells. |
| "Every Binder hit" could silently add Fetters to new secondary shard/interception damage. | Scope inherited Fetters to direct Chain Gun/Scourge hits and their authored Delivery geometry. | Barbed bullet hits two → slow both; chain-shard/globe burst gets only its authored payload, no hidden slow or invented native event. |
| Core's universal two-visible-effect wording contradicted separately bounded authored passive reactions. | Coordinator clarified the native-plus-Delivery/Payload scope and the separate passive reaction contracts. | Exorcism/Communion retain their native two effects; Resurrection/Lazarus use explicit reaction provenance/quotas. A launch may have its authored landing bundle without inventing a third native Payload. |

## Final independent challenge: a moving attack's direction

The reward reviewer independently found that a stationary cast heading cannot describe a prepared return or a steered charge. The shared/reward contracts and the owned ability rows now agree: Way Back locks the accepted second-press feet-to-marker direction, while Gatebreaker locks the accepted segment of its first positive eligible hit. Both accumulate distinct positive native hits across one swept movement leg without creating another action root, resetting kill-discharge flags or restarting cooldowns. Stationary clouds retain their immutable cast heading and first-pulse hit-count rule.

Manually traced: place a Way Back marker while facing north, move east, turn south, then return west through five different Blessed. The return's Comb direction is west, not the north marker yaw or south camera yaw; five native cut hits can activate one hit-count effect. With Scattered Sheep replacing the cut, the same movement launches without positive native cut damage and cannot qualify that trigger. A Gatebreaker turns after its first positive hit; later segments count new native victims but do not rotate an already locked Comb heading or replay a victim. Rejected/blocked movement grants no additional root or invulnerability envelope.

## Legal builds and real changes of plan

All twelve trees have a six-point capstone allocation: three distinct tier-1/2 lower nodes before a tier-3 pick, five distinct lower nodes before the capstone. The shown nine-point extensions independently open each dip's learned-only gate. Rite ownership never licenses permanent allocations. One capstone, resolved Delivery/Payload conflicts, own-source restrictions and two active kill-discharge listeners remain in force.

| Class | Fresh four-Rite sequence, in order | Resulting decision |
|---|---|---|
| Fallen | B Brimstone Tread → Fire and Brimstone → Brand → Rain of Fire | The fourth pick changes E from instant movement/crater to a placed burning lane. Q still brings the crowd through it; escape and an immediate kill were surrendered. |
| Heretic | C The Stake → Walk in the Smoke → The Altar → Cloud of Witnesses | Shield breaks root instead of blast; incense becomes moving safe stride; the fourth pick trades Communion's immediate heal/revive contribution for a moving mantle. Sacrament remains ally-only. |
| Binder | C Barbed Rounds → Frost → Procession → Boundary | The fourth pick trades a remote gathered pile for a transverse fence. E still interrupts Judgment; the gun and delayed arrivals can cash the bound file. |
| Betrayer | A Judecca → Halt and the Lame → Informer → Judas Coin | Existing frost makes the pass useful, three lower nodes open Coin, and Q trades party cadence for an aimed split. A shared victim set prevents multiplying body hits. |

These are possible legal draws, not guaranteed RNG sequences. A fresh character cannot take a capstone with only four Rites and no learned points. Later veterans get substitutions, compatible shape/payload combinations and alternative abilities rather than unlimited passive accumulation.

The maximum examples remain intentionally different: Fallen anvil/firewalker/thrower; Heretic timed resource harvest/fire route/moving mantle; Binder pile/ring/fence; Betrayer aimed lines/prepared return/bound traps. The listed nine-node builds obey the two-discharge cap. In particular, Chain Holds + Frost + Chains Shatter is illegal; Judecca + Blood Money + Broken Vessel is illegal even while a listener temporarily lacks a target. Fire-only Saint builds do not qualify own-incense cards without another effective incense source. A Wormwood-only Fallen with Blasphemy/Rain cannot qualify the Q/E-launch crash capstone.

The new public `loadouts` metadata includes learned ids, Rite ids, suppressed learned ids and assigned Q/E. This is sufficient to resolve catalog geometry and owned movement exemptions; authoritative area/state/source snapshots still decide current contact, pulses, grounding and delayed landings. Rejoin does not reset harvest quota, used-node flags, cooldowns, pull age or bind ceilings.

## Primary research and design inference

In [Edmund McMillen's developer interview](https://www.gamegrin.com/articles/edmund-mcmillen-interview), he describes designing Repentance items around unexplored mechanical gaps, improving old items, and reducing both excessively broken runs and bad runs to create more clutch decisions. His explanation of Magic's influence emphasizes an expandable interaction system. The interview supports these design intentions; it is not a measured proof that a particular mechanic produces replayability.

**Inference for this slice:** useful state sources, explicit native shape/payload composition and authored opportunity costs create discovery with existing content. A forced dead card or a promised harvest that cannot pay out removes that discovery. Bounded payoffs preserve the thrill of a stacked crowd without allowing recursive damage/loot loops to erase the encounter.

## Implementation readiness and remaining evidence

The repaired catalogs specify source ownership, provenance, quotas, accepted geometry, cancellation/cooldown carryover and recovery for the reviewed cases. Shared changes were sent to the coordinator instead of independently editing `game.md`, rewards, rooms or boss content.

No known class/build blocker remains from these two rounds. The following are empirical risks, not settled balance claims: Fallen crash reach versus fire spread; Binder Whirl/Iron Stride and room-scale All of Tartarus; Saint's six-mote burst versus Shroud, attached-incense automatic coverage and slow boss damage; Betrayer movement dagger immunity from melee wind-ups, Coin aiming feel and the defensive cost of Wire. Observe fresh and maximum builds, with no bots in at least one co-op run, before declaring the boring-loop complaint resolved. Movement speed, held-button share, saved cooldowns, route changes, rescues and repeated-run build changes should supply the evidence.
