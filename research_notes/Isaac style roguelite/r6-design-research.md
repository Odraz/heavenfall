# Revision 6: build composition, agency and replayability

Research checked 2026-10-11. The sources below are developer-authored talks/postmortems, official developer writing or firsthand interviews. Their observations support design directions; the numerical caps, room timing and acceptance thresholds are Meatgrinder design decisions, not findings proven by those sources. No game sessions, tests or benchmarks were run for this revision.

## Isaac: combine effects while retaining resource decisions

McMillen describes Isaac's Zelda-derived resource structure, randomized growth and extensive item stacking. His postmortem also records rare interaction defects and performance problems. The useful adaptation is composable effects with explicit event ownership and bounded lifetimes. [McMillen's Isaac postmortem, 2012](https://www.gamedeveloper.com/business/postmortem-mcmillen-and-himsl-s-i-the-binding-of-isaac-i-).

**Design inference for this slice:** revision 5's substitution rule changed which single augment was active, but could not make a banking bullet also pin its terminal crowd. Revision 6 allows one Delivery and one Payload per named input, preserving two visible effects, shared victim sets and authored target/shape contracts. Persistent points choose a foundation; random Rites alter that foundation or a compatible channel for this attempt. New alternatives inherit explicitly supported improvements rather than becoming isolated buttons.

Random resource allocation is retained through item stock, clear rewards and the optional key/chest route. The first required-route Rite prevents a bad roll from postponing every build decision to the boss. Bells, the timed Sundial and the health-cost bargain compete for time and survival. Already-collected profiles still encounter temporary picks instead of relying on new account unlocks forever.

## Rewards should preserve decisions during combat

In his later interview, McMillen criticizes designs in which accumulated automatic power removes the player's remaining agency. That is a designer's judgment, not evidence that every automatic-damage game is unenjoyable. [The Examined Game's interview transcript](https://www.theexaminedgame.com/why-you-shouldnt-give-players-what-they-want-edmund-mcmillen-the-binding-of-isaac-mewgenics/).

**Design inference:** a spectacular piercing kill should create an opportunity rather than silently discharge every acquired effect and erase all threats. The slice allows two active kill-discharge talents, each with a capped once-per-root bundle. Native attacks retain their horde-clearing role; relic-created states remain available to a later deliberate attack. Secondary discharges cannot create another proc chain. The player still chooses which line to shoot, where to stand, when to commit a dash, which enemy to prioritize and whether to spend a carried item.

A higher choice count is not proof of better play. The existing fifteen-deliberate-choices-per-ten-minutes hypothesis excludes automatic confirmations and one route leader's decision credited to every follower. A full-clear reward route and a Sundial route must both have a reason to exist; adding mandatory menus would not solve the recorded safe-ring boredom.

## Borderlands: tree identities can combine through shared damage semantics

Gearbox's Nick Thurston explains how shared damage sources connect an Action Skill to gear/tree effects, and how focused trees can support hybrids and gameplay-altering loops. He also describes balance as iterative adjustment rather than a single correct numerical answer. [Gearbox interview, August 2025](https://press-start.com.au/features/2025/08/14/borderlands-4-interview/).

**Design inference:** Meatgrinder uses explicit native input-slot provenance and seven visible states as its shared semantics. A widened Way Back can use the same authored cut-or-launch Payload as Shadowstep because its catalog states that compatibility. Judas Coin branches retain the parent's range, damage/pierce budget and once-per-body hit set; they do not manufacture three boss hits. A source closure must establish a real setup before offering a conditional talent: two dormant effects cannot falsely promise to start each other.

The Betrayer's melee return now occupies E, keeping its party cadence in Q. Choosing Coin in Q still gives up Field deliberately. This preserves a build's identity against the boss while leaving a meaningful optional tradeoff. Healing remains the Saint's role, taunt belongs to Blasphemy and silence to Discord's family.

## Horde pacing and cooperation need readable answers

Valve's talk links replayability to constrained unpredictability, tactical disruptions, anticipation and alternating intensity. Its cooperation model values rescue moments. [Michael Booth's original GDC talk, 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf).

Fatshark's developer blog emphasizes clear specialist cues, target prioritization, individual counterplay and recovery windows after disruptive attacks. [Darktide enemy-design blog, 2024](https://forums.fatsharkgames.com/t/darktide-101-enemy-design-and-prototyping-dev-blog/98452).

**Design inference:** keep the Gatekeeper's learnable movement/aim/rescue tests, and let floor geometry, risk, class composition and temporary builds vary around them. A Dominion can be baited into fodder; ranged threats and motes give the player a reason to leave the ring. Explicit world-kill rewards make a successful lure pay without inventing a player-fired on-kill chain. Fire-avoiding enemies require budgeted dry navigation; their behavior cannot be promised while its extra pathfinding cost is ignored. Recorded frequent combat audio and distinct boss/elite cues remain slice requirements.

The comparison is an adaptation: the slice still gathers stragglers after a visible bounded countdown and fixes the boss schedule for learning. It does not claim to reproduce Valve's continuous-level or director rules unchanged.

## Lore and implementation boundaries

The four heroes remain condemned people/angels with the origins in `docs/lore.md`. Angels break into feathers and gold light; Field of Blood is red ritual light, not literal blood. The first trumpet is silenced at victory. Relics, Rites, the Advocate, the Sentence and Gatekeeper continue the appeal/Judgment vocabulary.

Revision 6 changes rules and catalogs within the one-dungeon scope: 84 nodes, 12 alternatives, 20 combat templates, one elite, one hazard, eight items, twelve relics and six authored pairs remain. Additional heavens, enemies, weapons, indefinite dungeon chains and online competitive systems are not smuggled into readiness requirements.

The resulting specification has concrete composition and lifecycle contracts. Fun, dominant builds, accessibility in the crest, current generator acceptance, expanded geometry and frame budgets require implementation and observation. A finite dungeon and paper review cannot demonstrate infinite experiences or zero possible defects. The [integration record](reviews/r6-integration.md) and [slice acceptance](../../docs/rogue/slice-acceptance.md) keep that distinction explicit.
