# Implementation decisions

The register of decisions made while implementing the rogue slice, each beside the spec clause it touches. The AI adds a row whenever implementation settles something the spec leaves open, or changes how a clause is carried out; a change to a rule itself also updates its owning clause in [game.md](game.md) or the catalog. **Your approval** names who approved it and when; `routine` marks an implementation choice the workflow lets the AI make on its own ([development-workflow.md](development-workflow.md), step 3).

Started in R0 (2026-10-12) on branch `rogue`.

| Date | Milestone | Clause | Decision | Reason | Your approval |
|---|---|---|---|---|---|
| 2026-10-12 | R0 | [implementation.md](implementation.md) *Branch and delivery model* | Before `rogue` was created, the `sfx-samples` branch (the recorded S1 combat sounds, their tooling and [audio-prompts.md](audio-prompts.md)) was merged into local `main` (`fa9e3f5`). `rogue` starts from that `main`. | Branching from the old `main` would have left the recorded sounds and their prompt doc out of the rogue line. | You, 2026-10-12 ("Merge into main") |
| 2026-10-12 | R0 | [r00.md](r00.md) *Baseline allowlist* | The baseline also commits `docs/lore.md` (*Others at the Gates*: the Pardoner and the Advocate) and `research_notes/What makes horde shooters fun/` (the research behind the report). `fus-ro-dah.gif` was committed separately on `sfx-samples` as the reference for Discord's gust. | Both are spec inputs the README and lore links rely on; nothing uncommitted is left behind. | routine |
| 2026-10-12 | R0 | [audio-prompts.md](audio-prompts.md) *Choosing and mixing providers* | Replaced takes (`sfx/rejected/`), the rejected ElevenLabs trial's session records (`sfx/sessions/`) and its rollback plan (`reports/audio/`) stay on disk but are git-ignored. The 25 takes rejected before that (Suno v1 of five families) remain tracked; new rejections stay local. | Local history only; about 9 MB of audio nobody plays. Accepted takes and their sidecars stay tracked. | routine |
