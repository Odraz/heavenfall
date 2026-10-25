# Development-readiness review, revision 9

Reviewed and repaired 2026-10-11 by Claude, on top of revision 8. Scope: the whole `docs/rogue/` folder, against the current code, the repository's tests and scripts, the existing asset prompt files ([art-prompts.md](../art-prompts.md), [music-prompts.md](../music-prompts.md), [meshy-guide.md](../look/meshy.md)) and the developer's standing instructions. Only documentation changed. The revision-8 originals are preserved in the session scratchpad until the R0 baseline commit; the [revision-8 review's](#revision-8-history) material findings are summarized at the end.

## Verdict

- **The rules are usable as they are.** [game.md](game.md) and the five catalogs are unusually complete and internally consistent: generation, room lifecycle, economy, items, relics, 84 talents, the boss, persistence and co-op all have exact numbers and edge cases. This review changed **no rule, number or content quantity**.
- **The production layer wasn't ready, and now is.** The milestone order, the verification policy and the art/audio prompt packs had problems that would have hurt in the first weeks (below). They're repaired.
- **You can start R0 with an AI agent now.** R0 is a one-session documentation milestone (branch, baseline commit, records, preparing R1). R1–R9 are planned; each gets a short preparation pass against the code that exists by then, which is built into the workflow.

## What was wrong and what changed

| # | Problem | Consequence | Repair |
|---|---|---|---|
| 1 | **Milestone order front-loaded invisible work.** Old R1 was entirely network/provenance contracts on the old fixed dungeon; old R2 was the generator, all 20 rooms, the elite, the hazard, props and pickups in one milestone. | Two large milestones before the first playtest of anything the playtests asked for; against your "core fun first" priority. | Each contract now arrives with its first consumer: R1 generated floor, R2 pressure and pickups, R3 persistence and items, R4 provenance plus the first talents. Every milestone ends playable; three fun gates (A, B, C). [implementation.md](implementation.md). |
| 2 | **"Never run, create or modify tests"** was written into every brief and prompt. | Contradicts your standing instruction (the AI decides test scope). The repository has ~30 vitest suites; R1 changes the arena code they cover, so they would break and stay broken, and the generator/profile/resolver logic would ship untested. | The AI decides: `npm test` every stage, new tests where logic is pure (generator, transforms, pool, profile codec, resolver, ledgers), e2e when the session flow changes. |
| 3 | **Performance gates inside R1/R2/R4/R7.** | Contradicts your M12 instruction: benchmark only when you ask, after you've played. | Benchmarks on request; workloads kept runnable; full evidence in R9. |
| 4 | **Art prompts didn't say what to attach.** One generic "attach a current approved scene" line for 140 prompts; no per-image aspect ratio (a boilerplate "1:1 unless specified" even contradicted the grille's 3:2); no file checklist; no "check before saving". | You couldn't tell what to attach to which prompt (your complaint). | Rewritten in your original format: checklist, per-image **Attach**, ratio, file name, paste-ready prompt, **Check**. [art-prompts.md](art-prompts.md). |
| 5 | **Green objects on a green-screen background** (heal mote, Balm, Bitter Water). | Impossible to key out cleanly. | Those three use magenta (#FF00FF). |
| 6 | **"Transparent background if supported"** and a new style sentence. | Gemini can't make transparency; the new style didn't match the existing art. New Q/E icons (green cutouts) wouldn't match the eight existing icons (full charcoal background with ember vignette). | The existing style sentences word for word; new ability icons use the existing ability-icon prompt unchanged. |
| 7 | **The Dominion's references broke the model pipeline.** The turnaround included wings and the mace; the design image was flat grey; `concept-4.jfif` (the mace soldier your original file reserved for this enemy) wasn't attached. | Meshy/Blender rigging fails on wings and held weapons ([Meshy guide](../look/meshy.md) §2). | Design (inked, green, attaches `concept-4.jfif`) → turnaround without wings or mace → separate wings and mace sheets. |
| 8 | **The "silent trumpet" was an inked sprite**, but bosses.md has the Gatekeeper lift it at 50%. | A sprite can't be held by the rendered boss model. | Two model references: the trumpet and the raised pose. |
| 9 | **The Pardoner stands in his stall** (rooms.md) but had no art and no lore. | A missing character in a required room. | A figure prompt and a one-line lore proposal (decision 3 below). |
| 10 | **72 talent prompts were "distilled from a gameplay motif"** (e.g. "fills then a red-iron shockwave"). | Abstract scenes, not icons; inconsistent results. | A symbol table on the existing icon template; clearly optional. |
| 11 | **No flame texture**, though the hazard and many talents are fire. Two effect prompts duplicated existing `ember.png`/`fx-smoke.png`. | Every fire effect would have fallen back to a glow. | `fx-flames.png` added; the duplicates dropped. |
| 12 | **Audio prompts assumed Suno could control length and style.** No explanation of keeping sounds consistent, no cutting workflow, durations written as if exported exactly. | Inconsistent sounds from many sessions; unclear what to do with 2-second takes. | One sound palette, one house sentence, pilot comparison, Claude's identical finishing chain; a cutting section (what Claude can and can't fix). [audio-prompts.md](audio-prompts.md). |
| 13 | **Missing sound events:** the fire channels' seal flare, the item throw (separate from its landing), fire areas going out, two relic cues the mapping referenced without prompts, the chalice heal. | Silent or misattributed events. | `refinerIgnite`, `item-throw`, `fireOut`, `relic-rune`, `relic-chorus`, `chaliceHeal` added. |
| 14 | **Voice lines contradicted bosses.md** ("The Gate remains closed." vs *"Your appeal is denied."*), and "Stand before Judgment." would have spoken over the Judgment warning. | A wrong line; a voice masking a required cue. | The catalog's lines; voices optional and recommended to skip for the slice. |
| 15 | **Seven optional music prompts** for tracks that already exist and nobody criticized. | Effort with no gameplay value. | Removed; the existing music stays. |
| 16 | **Frequent enemy sounds weren't counted as frequent** (`meleeHit`, `orbFired`, `arrowFired`, `goldPickup`). | The same fatigue playtest 5 complained about. | Asked for with 3 takes. |
| 17 | Small things: the review prompt diffed against `origin/master` (doesn't exist); the branch was `codex/rogue-pearly`; walkthrough room numbers R0–R10 read like milestone names; R0 was a heavy procedure for one documentation commit. | Confusion for an implementing agent. | `origin/main`; branch `rogue`; room numbers labeled; R0 rewritten as a short concrete checklist. |

## Do the milestones make sense now?

Yes. Reading order = build order = play order:

| | You play | Why here |
|---|---|---|
| R1 | a new floor every run, doors, map | the brief's core idea, and Gate A: is a route a decision? |
| R2 | breakables, coins in the crowd, the Dominion, fire, crest, recorded sounds | everything playtest 5 asked for in combat, and Gate B, the main fun gate; **first build worth showing your friends** |
| R3 | profiles, the shop, eight items | runs start to matter |
| R4 | the Betrayer's full trees, Rites, Confessional | Gate C: do builds change how you play? Before writing 63 more nodes |
| R5–R7 | all classes; relics/route choices; the real boss | content on proven systems |
| R8–R9 | polish and acceptance | |

The slice is still large: 84 nodes, 12 alternatives, 12 relics, 6 combos, reconnect, recovery and durable admission. R1, R2, R3 and R6 are several sessions each. The order doesn't promise a date; it makes sure you can judge the fun after R1 and R2 instead of after R6.

## Are all the art and audio prompts there?

Yes, every required asset has a prompt, a reused file or a coded treatment, mapped to its game event in [asset-coverage.md](asset-coverage.md):

- **Art:** 6 model references, 57 required images, 78 optional icons. Map icons, door sigils, rings, lanes, telegraphs and state looks are code.
- **Audio:** 17 required families × 3 takes = 51 keepers; 84 further new events and 26 recommended re-recordings with synthesized fallbacks; 14 optional voice lines.

**Current audio workflow (updated 2026-10-12):** use ElevenLabs Sound Effects with per-ID duration, looping and influence controls, four variations per generation, and native WAV downloads. Consistency comes from the shared material palette, authored prompts, pilot comparisons and category finishing rules. The old Suno-only prompting restrictions and external downloader no longer apply. Claude imports explicit files by ID, preserving original bytes and provenance sidecars; you approve by ear. The cutter handles all 17 S1 families and archives replaced runtime files; 14 combat families are integrated, while the three prop events, remaining events, loops and optional ElevenLabs TTS voices require connection at their milestone. [audio-prompts.md](audio-prompts.md).

## Decisions (answered 2026-10-11)

1. **Two visible effects per action: kept.** Talents may make abilities slightly more complicated (game.md §9.3, decision 31); base kits keep one visible effect.
2. **Duplicate talent name: fixed with a descriptive name.** `betrayer.c.1b` is now *Thrown Silver* (Field of Blood's silver thrown where you aim); the Binder keeps *Cast Down*. Talent names should describe the mechanic in the lore's terms rather than be purely poetic.
3. **The Pardoner's line: adopted** in [lore.md](../lore.md), with the Advocate's.
4. **Legacy Suno plan: Pro**, recorded for the existing audio provenance. New SFX/speech use ElevenLabs; record its actual plan at generation time rather than inheriting the Suno plan.

## Remaining risks (owned by milestones)

| Owner | Must be shown before claiming it works |
|---|---|
| R1 | 99% of 1 000 pinned seeds generate within 20 attempts with the real pool and orientation rules (the 99.71% figure is from the revision-2 prototype); sealed rooms never see into each other; load ≤3 s. |
| R2 | The crest reaches 1 000 alive and stays responsive; the dry-ground fields stay cheap; pressure creates decisions (Gate B). |
| R3 | No duplicated or lost charges, XP or items across death, leave, reconnect and host exit. |
| R4–R5 | Two viable plans per class; the resolver keeps every catalog row legal; Rites change play (Gate C). |
| R6 | Combos and the bargain are real tradeoffs, not automatic picks. |
| R7 | Each fresh class can win solo; the Heretic Saint's solo fight (paper estimate 5 min) is the largest balance risk. |
| R9 | Four-human crest, full runs, the benchmark on the full workload, and whether you want another run once the collection is complete. |

## Revision-8 history

Revision 8 (Codex, earlier the same day) repaired the specification itself: a 49-byte run-scoped input with held/targeted ability requests, run identity in every packet, bounded snapshot assembly and catch-up queues, raw-byte control framing with a pre-parse size limit, a durable stake/admission handshake, a dirty-build fingerprint, bounded source retention, lower-tier-only talent gates, the boss's headcount timing, and the first asset coverage map. Those rule repairs stand; revision 9 moved where they're built, not what they are. The research and earlier review rounds are in [research_notes/](../../research_notes/Isaac%20style%20roguelite/).
