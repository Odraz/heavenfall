# Pearly Gates vertical slice

**Design baseline: 2026-10-11, revision 9** (rules as revision 8; milestone order, verification policy and asset prompts rebuilt). This is the specification for one generated dungeon of Meatgrinder: a Doom-style 2.5D co-op horde shooter in which four of the damned climb Heaven to stop the Judgment. Heaven's first trumpet remains silent when the Gatekeeper falls. The tone, characters and visual language come from [lore.md](../lore.md).

The slice ships every system below in the Pearly Gates. It does not ship the other heavens, mini-boss encounters, host migration, offline mid-run resume or an online competitive leaderboard. Unlocking Heaven 2 records progress and shows `Coming later`; it cannot start an absent dungeon.

## Development readiness

**Start here:** the [revision-9 readiness review](readiness-review.md) says what was repaired, what you still need to decide and what each milestone must prove. [R0](r00.md) is done ([report](r00-report.md)). [R1](r01.md) is implemented and verified, **accepted** by Tomas on 2026-10-13: the [report](r01-report.md) records Gate A acceptance and the subsequent Gate clipping fix. R2 implementation is underway ([report](r02-report.md)); pickups and the bounded snapshot stage are verified. The [roadmap](implementation.md) builds the floor first (R1), then the fight in it (R2), then persistence (R3), then builds (R4), each ending in something you can play. The [workflow](development-workflow.md) has the copyable prompts. The [code map](code-map.md) gives the first concrete tasks; [asset coverage](asset-coverage.md) maps every art/audio need to a prompt, reuse or coded treatment.

Making assets: [asset-plan.md](asset-plan.md) says what to make when; [art-prompts.md](art-prompts.md) and [audio-prompts.md](audio-prompts.md) give each prompt with its attachments, file name and checks.

In the walkthroughs (game.md Appendix A, rooms.md §5) R0–R10 are **room numbers**, not milestones.

## Read the specification

1. [Core rules, economy, progression and authoritative contracts](game.md). This is the system authority, including the two paper walkthroughs in Appendix A.
2. [Room catalog, Dominion elite, Refiner's Fire and fallback floor](rooms.md), then [Gatekeeper encounter](bosses.md).
3. [Consumables, relics, combinations and deeds](items-relics.md).
4. Talent trees: [Fallen](classes-fallen.md), [Heretic Saint](classes-heretic.md), [Binder](classes-binder.md), [Betrayer](classes-betrayer.md).
5. [Review coverage and implementation acceptance](slice-acceptance.md). This separates resolved design rules from evidence that requires a playable build.

[brief.md](brief.md) preserves the original proposal. Where it differs, game.md §16 records the adopted decisions. Existing class identities in [classes.md](../classes.md) and lore remain constraints, while game.md §9.3–§9.4 explicitly revises the original one-visible-effect wording for upgraded/new abilities. Current core rules and catalog rows supersede older research suggestions and historical prototype notes. A paper estimate is never a current performance or balance measurement.

## What changes each run

The player starts with a class and persistent build, two relic slots and up to two carried item stacks. A 10–11-room floor combines authored encounters without repeating a template. Fight and reward previews make route choices informed. The first mandatory combat room offers a Rite: one class talent that changes this attempt and disappears at its end. Later pages, two optional Bell encounters and the Sundial can provide more, capped at four. Compatible talents now compose: one changes an attack's delivery or shape, another changes its payload. A ricocheting Silver Bullet can pin the crowd at its final stop; a wider Way Back return can launch enemies instead of cutting them. Named alternative abilities have explicit upgrade contracts. A Rite can temporarily replace a learned augment in the same channel, keeping the compatible other channel. Its card names the surrendered effect. Offers retain their original cards through respec, and a player may pass to keep the current plan.

Combat makes space and timing valuable. Ranged enemies and the Dominion supply bounded healing drops worth reaching through the crowd. Breakables create small opportunities; the Dominion's telegraphed mace can be baited into its own horde. Seven visible enemy states connect class attacks, terrain, items and relics. The 2×2 crest preserves the mass-kill spectacle while keeping attacks, effects and spawning bounded. Frequent recorded combat sounds are required for the slice, addressing the playtest's fatigue complaint. Waiting in corridors cannot regenerate health.

Between fights, the party chooses detours, shops, a key/relic route or a race to the boss before 14:00. The Confessional provides a safe build revision and a visible health-cost bargain. Taking the bargain risks survival and its pawned reward; refusing preserves health. The Gatekeeper tests movement, aim and rescue with a solo escape and bot rules. Victory secures carried purchases, unlocks progression and settles each entitlement once. Safe backtracking can collect earned rewards and shop, but cannot start skipped fights, ring Bells or accept an unpaid bargain; racing keeps its opportunity cost.

Persistent talents supply bounded power; Rites supply run variation. At most two active kill-discharge talent nodes can contribute their bounded bundles to one root action; secondary damage cannot recurse. Offers require a genuinely producible state source, so dormant effects cannot qualify one another in a circle. The Betrayer's Way Back replaces Shadowstep on E, keeping Field of Blood on Q; Judas Coin remains a deliberate trade for Field. Relic combinations replace an effect and sacrifice a benefit, so discovering a combination does not make it automatically best. Once collections are full, exhausted relic sources offer legal Rites, while routes, item stock, four classes, alternative abilities, deeds, speed and five Edicts remain reasons to experiment. No class, item, combo or mandatory purchase is required to win with a fresh profile.

## Completed content

Implementation planning: [milestones and branch workflow](implementation.md), [human/AI development workflow and copyable prompts](development-workflow.md), [milestone brief/report template](milestone-template.md), [asset plan](asset-plan.md), [art prompts](art-prompts.md) and [audio prompts](audio-prompts.md). The prepared entry is [r00.md](r00.md); later planned briefs run through [r09.md](r09.md) and get prepared against current code before execution. These production documents organize the existing slice; optional artwork, music and voice acting add no gameplay requirements. Rogue becomes the main game after acceptance, with the old fixed dungeon retained as a development fixture.

| Content | Slice |
|---|---|
| Classes | 4 existing base kits, 12 trees, 84 talent nodes, 12 alternative Q/E abilities, 12 capstones |
| Rooms | 20 combat templates, 4 special templates including the boss, one fixed fallback floor |
| Enemies and terrain | Existing Blessed/Chorister/Cherub, Dominion elite, Refiner's Fire, breakable/loot/blast props |
| Items | 8 consumables with complete prices, weights, targeting, stacking and rejection rules |
| Relics | 12 relics: 8 chest and 4 deed; 6 named replacement combinations |
| Progression | XP/levels, learned points, run Rites, collection, 4 deeds, 5 Edicts and Sentence |
| Dungeon systems | Door previews, map/Chart, key/chest, personal shop stock, Bells, Sundial, teleport, Confessional/bargain |
| Full run lifecycle | Solo/co-op/bots, loading, death/revive, reconnect, profile import/export, victory inventory, bounded exit and idempotent settlement |
| Combat audio | Recorded/layered frequent weapons, impacts, deaths and breakables; bounded mix and distinct warning cues |

## Research and review history

The [horde-shooter report](../../reports/What%20makes%20horde%20shooters%20fun.md) supplies the problem: a satisfying trigger can still become routine if movement, rewards and builds offer no meaningful choices. [Verified developer research](../../research_notes/Isaac%20style%20roguelite/vertical_slice_research.md) explains the Isaac, WoW and Borderlands adaptations and labels design inferences. [Revision-7 research](../../research_notes/Isaac%20style%20roguelite/r7-design-research.md) connects run discovery, class identity, pacing and balance observation to primary developer sources. [Revision-7 integration and readiness](../../research_notes/Isaac%20style%20roguelite/reviews/r7-integration.md) records this pass's three specialist reviews, repeated repairs and independent cross-review. [Revision-6 research](../../research_notes/Isaac%20style%20roguelite/r6-design-research.md) and [integration](../../research_notes/Isaac%20style%20roguelite/reviews/r6-integration.md), [revision 3](../../research_notes/Isaac%20style%20roguelite/reviews/r3-integration.md), [revision 4](../../research_notes/Isaac%20style%20roguelite/reviews/r4-integration.md) and [revision 5](../../research_notes/Isaac%20style%20roguelite/reviews/r5-integration.md) preserve earlier history.

This is an implementation-ready design baseline, not proof of limitless replayability or a bug-free executable. The remaining work is implementation and observation of balance, readability, pacing and performance using [slice-acceptance.md](slice-acceptance.md). No game code or tests were changed or run during the specification passes.
