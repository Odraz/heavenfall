# Revision 4: encounter and room audit

Scope: every authored template and encounter contract in `docs/rogue/rooms.md` and `bosses.md`, compared with `game.md`, the class contracts, the brief, lore and horde-fun research. This was a manual specification review and adversarial walkthrough. No game code, frontend code or tests were changed or run. Historical template measurements are retained as historical data; this report does not certify fresh geometry validation or measured fun.

## Corrected findings

| Finding | Correction | Player consequence |
|---|---|---|
| Twelve sanctuary-lamp sockets violated the authored 4 m separation from threshold strips. | Relocated only their feature markers; retained geometry, prop counts, chances and wave budgets. Added an explicit distance acceptance criterion. | A calm entry cannot contain an unexpectedly adjacent blast lamp. |
| Every block-point feature has even cell coordinates, so amphora cell parity always chose the same skin. | Canonical loot-socket index modulo 3, preserved through rotation/mirroring. | Authored vase variety now exists and remains deterministic. |
| Hall of Dominions promised two elites from wave 2, while its authored waves each contain one. | Narrative now describes one per wave and possible two-elite carry-over. | The encounter's advertised pacing matches its actual threat ledger. |
| Fixed fallback has 11 rooms, contradicting a failed seed requesting 10. | Explicit emergency-count exception, original seed retained for rewards, stock and run identity; core synchronized by the coordinator. | Recovery does not silently change reward seed or require a nonexistent tenth-room layout. |
| Hazard avoiders cannot chase a target standing in fire; their step refusal could also prevent leaving fire after a pull. | Closest reachable dry chase anchor with real-target aim/range, and temporary hazard traversal on shortest escape; avoidance alone never triggers unreachable recovery. | Lures remain useful, without stranded elites or false teleports. |
| “Cherubs never touch fire” conflicts with Brought Low's real grounding. | Grounded Cherubs explicitly take active fire and pooled membership, and qualify for the Dominion's ground slam while its height condition is met. | Grounding a flyer has the promised environmental interactions. |
| Dominion slam lacked geometry LOS, a grounded-flyer rule and a bounded post-cancellation cadence. | Shared radius/feet-height/LOS check; visible ring follows accepted position; cancellation removes it and imposes recovery/cooldown. | Cover remains cover and control cannot cause a hidden immediate slam. |
| Held players were allowed Q unconditionally, despite movement alternatives on Q, and attack recoil could escape the hold. | Reject movement abilities in either slot without spending resources; ordinary shot resolves while its recoil displacement is suppressed. | The rescue mechanic has one rule across legal builds. |
| An incoming hold could run concurrently with an already accepted leap/dash/return and later replay its reserved landing. | Hold preempts movement and its landing, retains spent costs and original invulnerability expiry, validates floor projection and never snaps an airborne target downward. | No doubled movement, delayed landing burst or stale teleport after rescue. |
| Seal fallback directly above the owner needs 90-degree aim, beyond the inherited 85-degree pitch limit. | Clear horizontal/angled candidates with full body/shot-path validation; if content provides none, harmless release and diagnostic. | Every valid hold is answerable with an ordinary aimed shot. |
| All Calls suppressed through their deadline could leave a 1-HP boss permanently protected by its completion gate. | Valid suppression/deadline skip resolves that episode. | Skilled interruptions cannot make victory impossible. |
| A threshold-canceled first Call both counted as resolved and was unconditionally repeated. | Replacement only when transition preceded the first scheduled Call attempt. | Strong phase damage does not invent a second obligatory Call. |
| c11–15 was called harmless quiet while the first ring could still cross distant players and delayed holds/adds remained active. | Defined a nominal damage opportunity and its actual remaining threats. | The DPS model and player expectations do not assume nonexistent safety. |
| Snapshot enemy records lacked actual altitude and incarnation; Watcher opening also referenced an unsent spawn timestamp. | Core adopted 14-byte enemy records; parts specify actual cylinders/base heights, opening uses a part-specific bit, boss timing/hold metadata and revisioned rejoin state are explicit. | Elevated aiming targets and reconnect presentation match authoritative collision. |
| Early c17 transition can produce a negative cycle start. | Signed i32 boss cycle start; unsigned future deadlines remain separate. | Early burst cannot wrap the cycle clock or delay Judgment for an enormous interval. |
| Solo boss regen was inherited implicitly while the limited mote model appeared to be the entire sustain. | Explicit 1.5% effective max HP/s after eight seconds without accepted damage, exact solo only; no valley regen or director breath in the boss. | Slow solo Heretic has a legal baseline sustain path, while waiting outside fights does not erase resource choices. |
| Blanket “Falling Star rescue deals 20 to the Seal” ignored its actual vertical body/LOS. | Rescue leap clears the Host and hits the Seal at half area damage only if its real volume reaches it. | Teamwork advice respects the geometry rather than promising an unavailable hit. |
| Generic prop-break wording could let chained blasts pop a blessing chalice. | Blessing remains player-hit only; loot/blast families follow their explicit blast rules. | Deliberate heals cannot be unintentionally consumed by a neighboring lamp chain. |
| Field of the Host tower-purpose rectangles span flat threshold cells, while the literal core rule prohibited any obstacle there. | Coordinator clarified physical wall/off-base geometry prohibition; semantic purpose rectangles may cover a flat approach. Owned notation checks agree. | Correct stairs/strips pass without inventing a wall or splitting one tower into fictitious obstacles. |
| Fire's exact crossing slogans contradicted zero damage while airborne and different contact times under control effects. | Channel survival numbers are explicitly the base continuously grounded crossing model; actual per-tick feet contact wins. | Launching across a channel or slowing a train uses the same visible rule rather than a hidden guaranteed kill. |

## Lamp changes, manually calculated

Coordinates are 2 m block coordinates `(bx, by)`; distances use top-left feature-cell centers to the nearest threshold-strip cell center. D4 transforms preserve those distances. These are direct arithmetic readings of the specification, not executed pool checks.

| Template | Old → new blocks | New minimum distance |
|---|---|---|
| Colonnade | (5,4) → (8,5) | sqrt(26), about 5.10 m |
| Burning Aisle | (4,8) → (5,8) | sqrt(26), about 5.10 m |
| Open Terrace | (7,3) → (9,4); (8,12) → (9,11) | sqrt(18), about 4.24 m; 5 m |
| Ziggurat | (9,2) → (10,2) | 5 m |
| Refining Moat | (6,3) → (4,3); (9,12) → (10,12) | sqrt(17), about 4.12 m; sqrt(29), about 5.39 m |
| Gridiron | (5,3) → (4,3) | sqrt(17), about 4.12 m |
| Kilns | (5,1) → (4,1) | 4 m |
| Processional | (5,3) → (4,3); (26,12) → (28,12) | sqrt(17), about 4.12 m; sqrt(29), about 5.39 m |
| Hall of Dominions | (5,4) → (4,4) | 5 m |

## Second-pass walkthroughs

1. **Fresh solo, all four classes:** room geometry remains class-neutral; the ordinary hazard and elite can be answered by movement. Each base gun can break a 150-HP own Seal and hit a local 60-HP Watcher; no required class, build or consumable. Slow Heretic boss model remains a tuning priority with explicit sustain.
2. **One human plus three bots:** boss HP uses P=2.5 at the seal; parts count actual living heads and shrink on losses. Bots can aim their own/ally Seal and prioritize cover. No F interaction is required from a bot.
3. **Bargain with Swift Hymns/Trumpet:** player max HP and Watcher gaze use the bargain's effective value; one globe per volley prevents a point-blank eight-globe death; eyes are available from the first cycle and provide the same precision reward.
4. **Burst before first Call:** 50% threshold cancels old events, moves to c17 after its tell, schedules one replacement Call only if the first was never attempted, opens local eyes, then reaches the scheduled gaze. No unsigned underflow or permanent 1-HP latch.
5. **Repeated Discords:** scheduled casts can be suppressed, but cycle/gaze deadlines do not advance and suppressed Calls resolve completion. Watchers still judge after a broken/suppressed body cast.
6. **Hold during leap, at a wall or on a terrace:** active displacement and landing are canceled, feet/Seal altitude are preserved and sent, collision is swept, an aimable Seal point is selected, release returns to legal floor. Recoil cannot secretly move the owner.
7. **Brought Low into fire or a mace:** actual grounded presence, vertical tolerance and geometry LOS determine eligibility. Taking off removes floor-area membership; ordinary flying Cherubs stay immune to floor hazards.
8. **Fire camping:** avoiders chase dry boundary anchors and still attack their real target. Being unable to step onto the player's hazard cell does not falsely classify them as lost enemies.
9. **Spread party covering markers:** coordinator strengthened core placement with a bounded move from markers to safely warned free floor. Boss Host/field preference falls back under that shared rule; no extra enemies or forced close-range attacks appear.
10. **Bell return/cancellation:** one optional wave, its own bounded encounter mote ledger, no refreshed props or second room halo budget. Cancel before seal spends nothing; original unclaimed clear offers remain.
11. **Last survivor/departure:** sealed body HP remains fixed, parts shrink appropriately, a departing held owner is safely released with no heal, rejoin is a soul with stable accepted state. No required simultaneous four-player action remains.
12. **Boss death on fatal-hit tick:** incoming body damage resolves before hostile player hits; first death latches victory, clears attacks/summons, releases holds and settles XP/save once. Returning for choices cannot create new trickles or defeat.

No remaining substantive encounter contradiction was found in this second pass. This is a statement about the reviewed contracts, not proof of a bugless implementation or universally fun balance. Outstanding implementation acceptance is already explicit in the source: all-orientation geometry/reach, actual four-human crest capacity, low-end browser/network performance, observed solo Heretic duration, bot response and whether the spatial/precision/risk choices are fun in human play.
