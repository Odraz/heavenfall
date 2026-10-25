# Rogue implementation roadmap

Revision 9, 2026-10-11. The development sequence for the one-dungeon Pearly Gates slice. [game.md](game.md), its catalogs and [slice-acceptance.md](slice-acceptance.md) remain the gameplay authority; this file decides **order**, not rules.

**R9 prepared, 2026-10-25:** the acceptance milestone is ready to implement: a content census, the review against `main` with four known fixes (assists, the Gatebreaker's turn limit, the intermittent lag test, the wall-stop sound), evidence tools, the first rogue benchmark workload, then your sessions; see [r09.md](r09.md).

**R8 checkpoint, 2026-10-25:** every required event has its own cue and boss/elite warnings outrank gunfire, awaiting your listening; see the [R08 report](r08-report.md).

**R7 checkpoint, 2026-10-23:** the authored Gatekeeper replaces the inherited fixture: its cycle, Judgment, the Toll, Called to the Gate, the 50% transition and the Watchers, with bots, co-op setups and view-time resolution for multiplayer, awaiting your play; see the [R07 report](r07-report.md) for the per-class and co-op checklist.

**R6 checkpoint, 2026-10-18:** relics and combos, the key and the Reliquary, the bargain, the Bells, the Sundial, Pilgrim's Return, deeds, Edicts and streaks are implemented and verified, awaiting your play; see the [R06 report](r06-report.md) for the routes and tradeoffs to compare.

**R4 checkpoint, 2026-10-16:** the Betrayer's three trees, Rites and the Advocate are implemented and verified, awaiting your Gate C play; see the [R04 report](r04-report.md) for quick builds and the two plans.

**R3 checkpoint, 2026-10-14:** all five stages are implemented and verified, awaiting human play. See [R03 report](r03-report.md) for commits, exact checks, disposable item saves, the inherited-boss limitation and remaining art/balance acceptance. Tomas explicitly authorized R03; this does not mark Gate B accepted.

## The order in one sentence

Make the floor first, then make the fight in it worth playing, then make the run worth keeping, then make builds, then everything that builds on builds, then the boss, then polish. Each milestone ends in something you can play and judge.

Revision 8 put a whole milestone of invisible network/provenance contracts (old R1) before any generated floor, and one oversized milestone (old R2) for the generator, all twenty rooms, the elite, the hazard, props and pickups together. That delayed the first answer to the only question the playtests raised, *"is it fun now?"*, by two large milestones. Revision 9 keeps every feature and contract but moves each to the milestone that first **uses** it:

- run-scoped packet identity, the build fingerprint and the room snapshot header arrive with the generated floor (R1), because that's the first thing that breaks without them;
- pickups, multipart pickups and the pickup budget arrive with halos and motes (R2);
- action/source provenance, spawn incarnations, targeted ability requests and bounded secondary dispatch arrive with the first talents (R4), which are their first consumers (*"a kill by your Q"*, delayed returns, Rain of Fire's aimed release).

## Branch and delivery model

One integration branch, **`rogue`**, created from refreshed `main` (the repository's default; there is no `master`). `main` stays the accepted playable build until the slice is accepted. Commit small reviewable pieces; a milestone ends with a playable checkpoint, a short report and your decision about its feel. Tag accepted checkpoints `rogue-r<N>` and never move a tag. Pushing the branch backs it up; it doesn't merge or deploy.

One AI implementer owns the shared contracts (simulation, protocol, profile). If you ask for parallel agents, give them separate content/asset tasks only after the schema those tasks fill is stable.

Product decision (confirmed): rogue becomes the main game; the fixed dungeon stays as a development fixture. Development fixtures and incomplete pools are labeled and can't count as slice acceptance.

## Milestones

| Milestone | You can play | Core work | Your checkpoint · assets |
|---|---|---|---|
| **R0** Preserve and prepare ([brief](r00.md)) | The current build, on the `rogue` branch | Baseline commit of the spec; code/asset inventory; the decision register; prepare R1 | Read the R1 brief. Start the Chain Gun audio pilot and the Dominion design. |
| **R1** Generated floor ([brief](r01.md)) | A new Pearly Gates layout every run: walk, seal, fight, clear and backtrack through 10–11 rooms with the minimap and full map | Pure generator (grid, Isaac growth, specials, D4 orientation, fallback floor); stamping and validation; room kinds/phases; doors and vestibules; countdown/seal/stragglers/bots/dead; clear and trickle; discovery and the map; the boss room with the Gate facing; run identity, build fingerprint and room header in the protocol. **Representative pool:** the 10 combat templates that need no Dominion or fire (every shape; enough for any legal floor without repeats), using existing enemies; the 4 special rooms as shells | **Gate A (light):** does a new floor feel new; do doors and the map give route choices? Confessional wood/grille. Room seal/clear sounds. |
| **R2** Pressure and pickups ([brief](r02.md)) | Fights where position matters: break vases, dive for coins and motes, bait the Dominion's mace, fight around the fire, survive the crest; recorded weapon sounds | Props (loot/blast/blessing, marked amphora look); halos with the room ledger; heal motes; the Dominion; Refiner's Fire with dry-ground fields; crest and safe-spawn fallback; pickups in the snapshot; the remaining 10 templates (all 20); the 17 recorded combat families | **Gate B (main):** name a moment you changed position or target, baited a slam or crossed the crowd for a pickup. Art B1, B2 (halo, mote), B10; Dominion model; audio S1–S3. |
| **R3** Durable run and items ([brief](r03.md)) | Profiles that keep XP, levels and items between runs; the Pardoner's shop; eight items; door plates showing what each fight pays | Profiles, export/import, migration; XP/levels HUD; durable admission and absolute settlement; reconnect to a retained run; wallet and inventory; the Pardoner (stock, pedestals, the Chart); clear rewards and their previews; all eight items with throws/landing/areas | "Are charges, purchases and progress kept or lost exactly when expected?" Art B3, B7; audio S4. |
| **R4** First build loop ([brief](r04.md)) | The Betrayer with all three trees: learn, respec, take a Rite after the first fight, trade one effect for another | Action/source provenance, incarnations, bounded secondary dispatch, targeted/held ability requests; the modifier/effective-kit resolver; legality; Delivery/Payload; Rites with fixed cards, Pass, substitution; the Confessional's learn/respec; current-kit hints; three Betrayer alternatives | **Gate C:** did a Rite change how you fought the next room, and what did you give up? Art B4 (Advocate), B9 (Betrayer's three), rite page; audio S5 states, S6 Betrayer. |
| **R5** All four classes ([brief](r05.md)) | Every class with three trees, its alternatives and capstones | The remaining 63 nodes and 9 alternatives on the R4 pipeline | "For each class, can you say why you'd pick either of two builds?" Art B9 (other nine); audio S6, S8 ability loops. |
| **R6** Complete dungeon choices ([brief](r06.md)) | The whole route loop: key and Reliquary, relics and combos, the bargain, Bells, the Sundial, teleport, deeds, Edicts, streaks | Key/chest/claim/Pass; 12 relics, 6 combos; pawn bargain; Bells; Sundial; marked amphora's Chart; Pilgrim's Return; deeds, Edicts, Sentence, Absolution; streak assists and crown | "Is the benefit worth what you give up?" Art B5, B8; audio S5 rewards/relics. |
| **R7** The Gatekeeper ([brief](r07.md)) | The authored boss fight and the ending | Schedule, 50% transition, Toll, Call, Watchers, Seal, solo/bot rescue, victory settlement, the Stair and post-win shopping | Fresh solo with each class, and human co-op. Art A2, B6; audio S7. |
| **R8** Feedback and presentation ([brief](r08.md)) | Everything readable and every required sound recorded | Reconcile cues, hints and cards; remaining recordings; optional S9 re-recordings; asset manifest and provenance | "Which cue is unclear, which sound gets tiring?" Optional art B11. |
| **R9** Acceptance and merge ([brief](r09.md)) | The complete slice | Evidence from [slice-acceptance.md](slice-acceptance.md); defects and tuning; merge preparation | Full runs, four-human crest, your final decision and a separate merge instruction. |

**R2 commander follow-up (accepted 2026-10-13, before R3).** The Lectern Cantor, then the Stray-Carrier ([rooms.md §6.1–§6.3](rooms.md#61-the-commander-families)), one at a time, each tested and played before the next. Art A3 and A4; until their sprites exist, labeled coded fallbacks as for the Dominion. R3's XP preparation counts the final commander group.

**Dependencies.** R1 needs only R0. R2 needs R1's room lifecycle. R3 needs R1 (runs) and R2 (pickups). R4 needs R3 (persistence: learned talents are saved). R5 needs R4. R6 needs R2 (elite/hazard for Bells), R3 (durable transactions) and R5 (Rites for exhausted collections). R7 needs R6 (settlement, deeds, pawns). Until R7, the boss room uses the inherited Gatekeeper as a labeled fixture; until R4, Rite rewards show their page but pay 6 halos (labeled).

**What's public between milestones.** R2 is the first build worth showing friends for playtest 6 (new floors, pressure, breakables, recorded sounds); R3 adds keeping progress. That's the earliest point to test the playtest-5 complaints with the people who made them.

## Each milestone: prepare, implement, play

Use [development-workflow.md](development-workflow.md) for the copyable prompts. The AI keeps one brief per milestone (`r00.md` … `r09.md`); before implementing, it **prepares** the next brief against the code that actually exists (exact files, data, messages, stages), you review the outcome and exclusions, then it implements in small commits and hands you a play checklist. Later briefs stay plans until their preparation pass; their existence isn't readiness.

Begin each stage by reading the current code and the exact spec clauses. Keep host state, client presentation and immutable content data separate. Follow existing module patterns; no wholesale renderer or networking rewrite; don't silently weaken a bound.

## Verification

- **Every delivered stage or milestone must be tested** (your project instruction, confirmed 2026-10-12; see [AGENTS.md](../../AGENTS.md)), with meaningful coverage for changed behavior and results explained in plain words. The repository already has a vitest suite (`npm test`); it runs at every stage, and the AI updates tests that a deliberate change makes obsolete. New tests go where logic is pure and easy to get subtly wrong: the generator (determinism, the 99%-in-20-attempts target over the 1 000 pinned seeds, every §3.3 rule), D4 transforms, room-pool validation, the profile codec/migration/import limits, the talent legality and effective-kit resolver, and the halo/XP ledgers. The Playwright suite (`npm run e2e`) runs when a stage changes the session/network flow. Keep performance limits intact and run timing-sensitive tests without competing workers; report blocked or unrun checks explicitly.
- **Typecheck and build** (`npm run typecheck`, `npm run build`) at every commit.
- **Benchmarks only when you ask, after you've playtested** (your standing instruction from M12). Stages keep performance in mind (bounded pools, clamped flow fields, one active room) and keep the bench workloads runnable; [slice-acceptance.md](slice-acceptance.md) lists the targets for R9. The laptop drifts 5–10% between sessions, so compare builds back to back.
- **Your play** is the fun verdict. Reports separate what was tested, what was measured, what was only inspected and what you observed.

## Asset production alongside coding

[asset-plan.md](asset-plan.md) lists what to make when; [art-prompts.md](art-prompts.md) and [audio-prompts.md](audio-prompts.md) hold the prompts, with checklists, attachments and checks. Make the pilot of each family, let the AI test it in the game, then the rest. The first request is in [r00.md](r00.md).

## Find out whether it's fun early

Three gates, each a real question with your answer recorded:

- **Gate A (R1):** a new floor, doors that show what's behind them, and a map. Is choosing a route a decision?
- **Gate B (R2):** pressure. Can you name a moment you changed position or target because of a threat, a pickup or a prop? If not, fix pressure, geometry, timing or readability before R3.
- **Gate C (R4):** builds. Did a Rite change your next fight, and can you name what you gave up? If not, fix offers and costs before writing 63 more nodes.

The slice still ships every specified feature; a gate pauses expansion, it never cuts scope by itself. Paper numbers stay provisional. The biggest known balance risk is the Heretic Saint's long solo boss fight (R7).
