# Round 4: combat builds and class composition

Reviewed 2026-10-11. Scope: the four `docs/rogue/classes-*.md` specifications, their 84 nodes and 12 alternative abilities, `docs/classes.md`, `docs/lore.md`, combat/offer contracts in `game.md`, and the existing horde-fun and integration research. This is a manual specification audit and imagined play review. No game code or tests were modified, created or executed. No numerical result below is an observed playtest measurement.

## Repairs made

| Defect | Resolution |
|---|---|
| Wormwood described five damage hits despite only one slug victim receiving damage. | Only positive native hits count; surrounding launches supply states for later attacks, not a hit-count trigger. Secondary As We Fell kills cannot fire state-kill relics. |
| Gatebreaker's outer band could hit an approaching central victim for 10 before its 40-damage lane, consuming its once-per-charge hit. | Central swept lane resolves first; side-band projections stay on already traversed segments, with terminal caps resolved at stopping. Its visual furrow is explicitly cosmetic. |
| Gatebreaker compared itself with a Falling Star that could pass through solid walls. | Both respect accepted geometry; Falling Star's advantage is its valid arc/reachable landing, not wall traversal. |
| Fire and Brimstone added fire to the shotgun's existing damage and shove. | It explicitly replaces survivor shove with secondary kill-fire. Weight of Sin remains a separate Q modification: taunt + slow rather than taunt + stun. Both can coexist without adding three effects to one attack. |
| Merged fire refreshes could prolong an expired primary source and let passive spread re-enter primary proc chains. | Fallen and Heretic cells preserve original source expiry/depth/slot. A lit cell's later secondary contribution never extends primary button attribution. Root adopted the same canonical contract. |
| Grounding could be ignored by effects filtering only the enemy's original flying type. | Actual floor contact determines floor damage/pool membership, including Brought Low flyers. Native ground-only launch restrictions remain distinct. |
| Cunning Folk's numbers constrained the recipient, but not the mote; distant motes could qualify. | Mote-to-Saint, recipient-to-Saint and mote-to-recipient distances are all bounded at 8 m, with same-room LOS and a living connected Saint. |
| In Both Kinds was filtered only in solo, despite also doing nothing with just one other player. | Rite requires at least two other living allies. Learned ownership can remain dormant when an ally dies/leaves. |
| Multiple Communion revivals could stack several Lazarus blasts onto the same enemy. | Rings draw at every revived soul but their damage merges per cast. Revival and pickup IDs settle once; an aura delivering a mote to somebody else is not the Saint's pickup. |
| Bread's short card promised a mote for every nearby kill. | Card now states the bounded six-mote eligible harvest. Boss/secondary exclusions remain explicit in the ability contract. |
| Pitch's refresh, source precedence and proc lineage were incomplete. | Only qualifying state + actual owned-area contact refreshes a mark; no self-refresh, one global mark per enemy, secondary outside-area pulses, actual area attribution takes precedence. |
| Procession could reserve a not-yet-bound native target as an extra, cause conflicting pulls, or reset an extra on later Boundary crossing. | Reserve native/acquired/extra IDs before deterministic acquisition. Extras use pre-pull bearing and accepted destination, share the original remaining expiry, and consume one lifetime 40-extra budget per cast. |
| Brought Low could re-drop a grounded enemy or lift it when one of several own bind sources expired. | Aggregate qualifying own sources; grounding ends only after all expire. Use canonical actual z/incarnation snapshots and source expiry, never an invented flags bit. |
| The Well promised a guaranteed stationary knot while its own numbers allow unslowed Blessed to walk out at 1 m/s. | Scenario now requires an inward chase, slow or explicit bind; placement and follow-up control remain decisions. |
| Judas Coin did not specify how revolver piercing survives a split. | Branches inherit unspent passes and incoming pitch; a spent pre-coin pass never resets. Halt + a coin before targets may hit at most six distinct enemies, with one conditional pass per branch. |
| Coin play claimed the attack timer forces the player to stop moving. | Timer blocks simultaneous attacks; aiming divides attention while ordinary movement remains available. |
| Sicarius contact used body-to-body wording while its balance argument assumed a much narrower reach. | Exact 0.3 m center-path radius, swept accepted motion, actual vertical contact and per-enemy cooldown. Ideal density estimate is 0.6 × 9 = 5.4 new kills/s, not 10. Nearby survivors still have a 1.2 m melee reach. |
| One of Them could hide a player near a body on another elevation and accidentally override a boss part's target claim. | Exact horizontal wading distance plus vertical overlap; ordinary ranged enemies only, no boss-part/claim immunity. |
| Recoil could add a second movement envelope or escape a Called Seal's Held state. | Its shot still fires but displacement is suppressed during another envelope or Held. Root/encounter reviewers aligned the movement override. |
| Sparks could select an immune boss/part and waste their nearest candidate; silver trap coins could be mistaken for loot entities. | Exclude boss/parts before spark selection; Blood Money markers use their bounded class pool and cannot be picked up for money/inventory. |

## Gate and loadout proof, by manual enumeration

Suffixes below refer to the row IDs in each class. Every listed path has at least three tier-1/2 nodes before either tier-3 node, and exactly five lower nodes before its capstone. The lower-node count is never borrowed from a Rite. Alternative assignments occupy only Q or E and do not occupy an augment exclusion group.

| Class/tree | Six-point path before capstone | Tier-1/2 nodes | Active nine-point extension |
|---|---|---:|---|
| Fallen A | `1a 1b 2b 3a 3b cap` | 3 | C `1a 2a 2b`; Gatebreaker + Blasphemy. |
| Fallen B | `1a 1b 2a 3a 3b cap` | 3 | B `2b`, A `1a 2b`; Rain + Blasphemy. |
| Fallen C | `1a 1b 2a 2b 3a cap` | 4 | A `1a 2b`, B `1a`; Falling Star + Cast Out. |
| Heretic A | `1a 1b 2b 3a 3b cap` | 3 | B `1b 2a`, C `1b`; Bread + Communion. |
| Heretic B | `1a 1b 2a 3a 3b cap` | 3 | A `1a 1b 2b`; Trial + Communion/Exorcism. Exorcism supplies Pitch. |
| Heretic C | `1a 1b 2a 3a 3b cap` | 3 | B `1b`, A `1a 2b`; Shroud/Stake + Witnesses. Kindling supplies pooled. |
| Binder A | `1a 1b 2b 3a 3b cap` | 3 | B `1a 1b 2b`; Chains + Well. |
| Binder B | `1a 1b 2a 2b 3a cap` | 4 | C `1a 1b 2a`; Ring + Discord/Voice. |
| Binder C | `1a 1b 2a 2b 3a cap` | 4 | B `1b 2b`, A `1b`; Boundary + Discord/Wind. |
| Betrayer A | `1b 2a 2b 3a 1a cap` | 4 | B `1a 2b 2a`; Judas Coin + Shadowstep/Long Knife. |
| Betrayer B | `1a 1b 2b 3a 2a cap` | 4 | A `1b 2a 2b`; Way Back + Shadowstep/Long Knife. |
| Betrayer C | `1a 2a 2b 3a 3b cap` | 3 | A `1b 2b`, B `1a`; Field + Wire. |

The four authored 3+3+3 spreads also retain legal lower-tier gates and one augment per named attack/ability. The Saint's forked-heal spread is a three-or-more-player build, not a two-player guarantee. A developed player's ability Rite may legitimately make an existing augment/capstone dormant: root added a preview of that cost, while preserving ownership, prerequisite legality and remaining cooldown. Returning to the Confessional restores assignments without refunding/resetting a Rite.

## Second pass: imagined adverse situations

- **Fresh solo with two Rites:** no unsupported state reader/fork is promised; tier-1 picks work on the assigned base kit and a same-tree pick may open only that tree's tier-2 Rite. Fire/slow gives a real lost-spacing tradeoff instead of pure power accumulation.
- **Late capstone with four Rites:** one capstone remains the limit; conflicting LMB/RMB/named-ability augments cannot coexist, temporary prerequisites cannot authorize learned nodes, and replacement warnings cover dormant old nodes. A build reset cannot refill damage meters/cooldowns.
- **Tightly held co-op pile:** the bound multiplier applies once; passives, merged shards/crashes and controlled target sets do not recursively generate damage. Grounded flyers use actual height. Procession and chain transfer keep original source lifetime and entity incarnation.
- **Coin plus frost plus bound crowd:** native ray victims are unique across branches/ricochets; conditional passes do not reset, and secondary spark kills produce no frost/coins/clay damage chain.
- **Held during charge/leap/return:** boss review cancels the preempted envelope/reserved landing without refund; recoil cannot escape Held, and ordinary attacks still provide the Seal rescue. New movement abilities cannot stack.
- **Death/rejoin/source expiry:** accepted source IDs, server expiry and entity incarnation restore areas/marks/landing records; late effects never hit a reused enemy slot. Ordinary floor effects and enemy states end on their own sources rather than last-writer flags.
- **Solo healer with no other survivor:** Resurrection has no self-revive or all-dead exception. Bread has finite admission quota, no boss-add/secondary harvest, and Lazarus cannot manufacture another heal loop. The mantle build knowingly gives up Communion's burst.

## Scope and remaining uncertainty

Class identity and lore remain intact: the Fallen intercepts without self-healing, the Saint separates heals/shields and remains an ally healer, the Binder controls without a dash, and the Betrayer has 120 HP without self-sustain. No new taunt or fire-rate source was added. Field of Blood is ritual red light; angel deaths remain feathers/gold sparks.

No further definite contradiction was found in this class pass after integrating the core and encounter corrections. This does not establish perfect balance or replayability. Observed play still needs to establish the value of Bread versus Shroud, Saint solo clear speed, the narrow Sicarius lane's risk, whether merged Falling Star crashes dominate crowd damage, and whether the Well/Field combination makes too much of a peak automatic. Those are explicit tuning questions, not missing combat rules. The actual implementation still requires its own authorized verification.
