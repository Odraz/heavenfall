# Revision 5 research: keep the run capable of changing the player

Primary sources reread on **2026-10-11** for the independent revision-5 specification audit. This supplements [the earlier research](vertical_slice_research.md). It is rationale, not a competing rules document; [game.md](../../docs/rogue/game.md) and the content catalogs define implementation.

## Evidence and its limits

**Isaac's resources and items have different jobs.** McMillen's postmortem connects optional resource spending with dungeon structure, and random character-changing items with growth during an attempt. It also describes rare combination failures and runtime limitations. Random room order cannot substitute for a build that changes. The numerical limits chosen for Meatgrinder are our design decisions, not values established by this source. [Edmund McMillen, 2012 postmortem](https://www.gamedeveloper.com/business/postmortem-mcmillen-and-himsl-s-i-the-binding-of-isaac-i-).

**Talent choice should preserve a functional foundation.** Blizzard's design explanation supports class identity, clear dependencies and paths that leave basic capabilities available. It acknowledges that some choices are situational and that bad builds can exist. It does not establish balance for our four classes or justify making a random offer mechanically unusable. [Blizzard, Dragonflight talent design philosophy](https://news.blizzard.com/en-us/article/23797209/world-of-warcraft-dragonflight-talent-preview).

**Changing an attack can change the way a player approaches combat.** 2K's examples pair new Action Skills with existing passives and describe an augment that pulls targets toward a ranged character. They support understandable replacement effects and compatible supporting talents. They do not imply that every additional effect should stack with every previous effect. [2K, Designer's Cut skill trees](https://newsroom.2k.com/news/even-more-borderlandsr-3-skill-trees-revealed-ahead-of-designers-cut-launch-on-november-10).

**Variety needs constraints, anticipation and recovery.** Valve's presentation attributes replayable situations to combinations selected under designed constraints and to changing intensity. It discourages putting every dramatic possibility into every run. A wave, detour or warning is useful when it gives players time to anticipate a consequence; a longer empty delay is not itself a choice. [Mike Booth, Replayable Cooperative Game Design, 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf).

**A rescue needs a skilled individual answer.** Fatshark describes simple, readable enemy jobs, iterative co-op prototypes, and ways for an individual to survive special threats. Its ranged-enemy discussion also connects positioning and authored cover with tactical decisions. These principles support the Gatekeeper's solo Seal answer and deliberate ranged spawn positions. They are not evidence that our unimplemented encounters are fun. [Fatshark, Enemy Design and Prototyping, 2024](https://forums.fatsharkgames.com/t/darktide-101-enemy-design-and-prototyping-dev-blog/98452).

## Inferences applied to this dungeon

The strongest new audit result is a concrete counterexample to the existing replay promise: a legal nine-point solo Fallen with all seven Burning Sand nodes plus Red Iron and Unbowed had **zero eligible Rites**. Its learned attack augments excluded alternatives; its remaining branches could not acquire their first legal node. Collection exhaustion therefore converted the promised build decisions into coins.

The repair uses existing authored talents: a Rite may temporarily replace an implicitly conflicting **learned augment**, with the lost effect disclosed. Learned ownership and its legal point allocation survive; only one effect occupies the attack's augmentation slot. Explicit exclusions, conflicting Rites and the one-capstone limit remain binding. Usefulness is evaluated on the proposed effective kit, so a surrendered state source cannot license a dead reward. The exact legality, respec, lifetime and cooldown rules belong to core §9.10. This is our adaptation, not a feature attributed to Isaac, WoW or Borderlands.

A fire Fallen can consequently keep its starting kit, borrow a launch attack in place of its kill-fire, or slow a taunted crowd in place of its burning Q. The point is the surrendered benefit and changed position or target, rather than an extra percentage. Other classes retain their own variants through the same rule, without another item catalog or combat button.

The offer itself must remain a commitment. Fixed card identities prevent free Confessional edits from becoming unlimited rerolls; invalid cards can re-enable, and an explicit Pass preserves the player's preferred plan without a reward. Source-specific fallback prevents a paid bargain from becoming six halos for an irrelevant health price or a timed Sundial reward from being collected before its qualifying seal. These are our consistency repairs, not mechanics claimed from the reference games.

The route also needs a lasting cost. Racing the Sundial must forgo some fights and rewards. Allowing skipped fights after victory, while players are invulnerable, made that choice false. The repaired victory boundary permits safe settlement and collecting already-earned offers while closing all new encounters and unpaid bargains.

Authored room variety needs to reach the simulation. A ranged template that describes shooters on a distant loft but supplies only interchangeable spawn markers cannot guarantee its advertised approach. Explicit, transformed spawn preferences connect the encounter's written intention to its geometry; the safe-spawn fallback remains authoritative.

## What a useful run should let the player explain

These are mental-review questions and future observation questions, not results of game execution:

- After the first required fight, what changed about where the player stands or which tool they save?
- At a fork, what reward or encounter made a detour worth its time, and what would racing lose?
- At a Rite or relic pair, what useful effect was surrendered for the chosen plan?
- During a crowd peak, which target, prop or state setup changed the next action?
- At the Confessional, did the new allocation support the run's discoveries rather than merely restore a fixed optimal preset?
- After collection completion, can the same class pursue two plausible plans with different targeting, timing or safety costs?

Repeated buttons, automatic pickups and mandatory menu confirmations do not count as interesting choices. The specification's choice-rate and duration targets remain hypotheses to observe in a playable slice. No paper review can certify endless enjoyment or an executable without defects.
