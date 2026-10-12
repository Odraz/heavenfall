# Revision 7: discovery, class identity and repeat play

Research checked 2026-10-11. These are primary developer accounts. Their observations inform the design; Meatgrinder's timing, damage, capacity and decision targets remain its own hypotheses. No play session, test, validator, build or benchmark was run during this review.

## What to take from Isaac

McMillen's postmortem describes randomized optional resources, visible item-driven growth and progressive unlocks. It also records interaction defects and performance problems. [The Binding of Isaac postmortem, 2012](https://www.gamedeveloper.com/business/postmortem-mcmillen-and-himsl-s-i-the-binding-of-isaac-i-).

**Our design inference:** combine an authored class foundation with temporary discoveries and competing resource uses. The slice's first required fight supplies a Rite; compatible Delivery/Payload effects and alternative abilities change subsequent attacks. Two carried item stacks, key/chest detours, personal shop stock, Bells, the Sundial and a health-cost bargain make taking one benefit surrender another. Exhausted relic collections convert earned sources to legal Rites rather than ending run variation.

Keep discoveries legible and causal. A six-kill harvest must actually produce up to six motes; a prepared return's lane must follow its return path; a shaped shot must preserve its native root. Bounded nonrecursive discharges allow spectacular crowd clearing without turning every acquired effect into an automatic chain. These are explicit adaptation choices, not a claim to reproduce Isaac's entire catalog or number of floors.

## What to take from talent trees

Blizzard's Dragonflight talent preview emphasizes player agency, meaningful progression and preserving class foundations while offering choices. [Official talent design preview, 2022](https://news.blizzard.com/en-us/article/23797209/world-of-warcraft-dragonflight-talent-preview).

**Our design inference:** the four base identities survive the talent system. Healing belongs to the burned Saint, the Binder controls Heaven's chains, the Fallen's refusals become launch/impact/fire choices, and the Betrayer chooses lines, returns and party cadence. Nine learned points, one capstone and explicit channel conflicts force a plan. A Rite may trade a learned augment for a new temporary shape; it names the surrendered effect and dependent readers. An ability trade names the lost rescue, shield, escape or party buff. Ownership and legal gates remain stable when a source becomes dormant.

A reader is offered only when the proposed kit or an actual retained source can produce its setup. An expired area, uncast dead ally, secondary reflection or unseeded pair of conditional relics cannot promise a usable combo. This protects the discovery loop from cards that appear exciting but cannot work.

## Pressure, relief and cooperation

Valve's replayable co-op design talk connects constrained unpredictability, anticipation, tactical disruption and changing intensity with cooperation and rescue. [Michael Booth's GDC talk, 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf).

**Our design inference:** authored rooms and learnable boss attacks are varied by the generated route, crowd composition, geometry, temporary build and resource state. Ranged targets, healing-mote dives, a baitable Dominion slam and bounded environmental fire should interrupt safe circular kiting. Warnings must show the space that will actually hurt, including a Toll birth disk and affected low terraces. A bot cannot substitute for a missing solo solution; Judgment retains its explicit solo escape. Recorded frequent combat audio is part of addressing the existing fatigue evidence.

## Evidence rather than a promise of endless fun

Giovannetti's balance talk describes iterative card evaluation using metrics alongside player feedback, including variation by player skill. [Slay the Spire: Metrics Driven Design and Balance, GDC 2019](https://media.gdcvault.com/gdc2019/presentations/Giovannetti_Anthony_SlayTheSpire.pdf).

**Our design inference:** observe choices after collection completion, not only the reward of unlocking something. Compare viable builds/routes, record what was sacrificed and whether the player voluntarily wants another attempt. Forced randomness and menu confirmations do not establish agency. If a build or route is always preferred, investigate its opportunity cost rather than add entries merely to enlarge a combinations count.

The four deeds can qualify together on a second victory; eight chest relics are a finite collection. Long-term interest therefore depends on repeatable combat/build/resource decisions, four distinct classes and optional Edicts. A one-dungeon slice cannot promise infinite novelty. Saint boss duration, late-run fatigue, free-respec preparation, inventory friction, crest readability and current performance remain observation priorities.

The [integration report](reviews/r7-integration.md) records the repaired contracts and mental scenarios. The [acceptance document](../../docs/rogue/slice-acceptance.md) separates those specified rules from future implementation evidence. Lore remains the governing frame: ordered Heaven, an appeal against Judgment, feathers and gold light, red ritual light rather than literal blood, and the first trumpet silenced at victory.

