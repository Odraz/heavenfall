# R0 report: preserve and prepare

**Status: awaiting your review** (2026-10-12). Documentation only: no game code, tests, assets or protocol changed. Brief: [r00.md](r00.md).

## Git facts

| Fact | Value |
|---|---|
| Integration branch | `rogue`, created 2026-10-12 from local `main` |
| Base (`main` at branch time) | `fa9e3f5765cd09d5a315db6342107ff70ad159e8`: *Merge sfx-samples: recorded S1 sound effects and their tooling*. Local only, not pushed. |
| `origin/main` | `c5d74e456f9932953d432eaa7e679f427ec8d937` (*Merge m12: playtest 4 fixes*); `main` is ahead of it by the `sfx-samples` merge. No `origin/master`. |
| Prior playable checkpoint | `fa9e3f5`: M12 with the playtest-4 fixes and the recorded S1 combat sounds (F8 compares them with the synthesized cues). It stays the reference build on `main` until the slice is accepted. |
| Baseline commit | `e46dd8fb4b454109c91975f3e3d796c0ceba308`: *R0: preserve the rogue specification (revision 9)* |
| Records commit | `2d0be8d87c4392d12a3ff3aa06414daca8634525`: *R0: execution records (report, decision register, asset manifest)* |
| R1 preparation commit | the commit that adds this line together with the prepared [r01.md](r01.md) (a commit can't contain its own hash) |

## What the baseline commit contains (72 files, all additions except one)

- `docs/rogue/`: all 29 spec files except [audio-prompts.md](audio-prompts.md), which was already tracked from the `sfx-samples` merge.
- `research_notes/Isaac style roguelite/`: 30 research and review files plus 5 images.
- `research_notes/What makes horde shooters fun/`: 5 research files.
- `reports/What makes horde shooters fun.md`.
- `docs/meshy-guide.md`, preserved as it was.
- `docs/lore.md` (modified): the *Others at the Gates* section, with the Pardoner and the Advocate.

The allowlist went beyond the brief's original list in two places, both recorded in [implementation-decisions.md](implementation-decisions.md): `docs/lore.md` and the horde-shooter research folder. Nothing was left uncommitted. Local history that is git-ignored (`sfx/rejected/`, `sfx/sessions/`, `reports/audio/`) and `.tmp/` were not committed.

## What was inspected

- **Git state.** Before branching, the working tree held exactly the allowlist. After the baseline commit it was clean.
- **Links.** Every relative link in `docs/rogue/*.md` resolves; none were broken.
- **Code against [code-map.md](code-map.md).** A full read-only pass over the dungeon data, map loader, `validateLevel`, the arena loop, director, flow fields, protocol, session flow, HUD, boss and tests. The spec's code references still point at the right lines: `sim.ts:114-135` (`MULT10`), `sim.ts:967-987` (the countdown and its wave-list skip), `sim.ts:1109` (full heal on clear), `sim.ts:951` (`checkVictory`), `main.ts:80` and `worker.ts:104` (`getDungeon`). New facts R1 depends on are written into [r01.md](r01.md):
  - there is no protocol version constant and no run identity anywhere;
  - the worker draws the multiplayer sim seed at `go` and never sends it;
  - `hello` has no bot flag;
  - single-player regeneration also runs outside fights;
  - no minimap exists and M is unbound.
- **Tests.** On `fa9e3f5`, whose code is identical to the baseline, `npm run typecheck` and `npm test` both passed (2026-10-12). Documentation commits need no further checks (r00.md *Completion*). No e2e, build or benchmark ran.

## Decisions R0 records

Owners as code-map.md asks; R1 creates the constants.

| What | Owner and rule |
|---|---|
| Save schema | `schema` in the profile record (R3). Only save migrations bump it; a documentation revision never does. |
| Protocol version | `PROTOCOL_VERSION` in `src/net/version.ts` (R1). Starts at 2; the inherited wire format counts as 1. Any change to the input, snapshot or control layout bumps it. |
| Rules version | `RULES_VERSION` in `src/net/version.ts` (R1). Bumped when simulation or generation behaviour changes for the same inputs, including any change to the room pool's order or content. |
| Content identity | The build fingerprint (R1, `vite.config.ts`): a hash over every file under `src/` (room pool and catalogs included), plus the package version, short SHA and both versions above. Two dirty builds at the same commit therefore differ. |
| Stable IDs | Room template IDs as in [rooms.md](rooms.md). Enemy IDs from `src/data/enemies.ts`. Sound IDs from [audio-prompts.md](audio-prompts.md). Talent node IDs from the class catalogs (R4). Item and relic IDs from [items-relics.md](items-relics.md) (R3, R6). |
| Module ownership | `src/gen/`: the generator, pure. `src/data/rooms/1/`: the Pearly Gates pool. `src/sim/`: host authority. `src/net/`: wire formats and versions. `src/client/` and `src/ui/`: presentation. One implementer owns the shared contracts (implementation.md). |
| Old fixture | The fixed `pearly-gates` and `sandbox` dungeons stay reachable through `?dev=1&map=…` and pass through an adapter to room records; defined in r01.md. |
| Asset aliases | [asset-coverage.md](asset-coverage.md) is the single source/event alias table; [asset-manifest.md](asset-manifest.md) tracks files and statuses. |
| Verification | As [development-workflow.md](development-workflow.md): `npm test` every stage, new tests for pure logic, typecheck and build every code commit, e2e when the session or network flow changes, the benchmark only when you ask. |

## Execution records created

- [implementation-decisions.md](implementation-decisions.md): the register, with three R0 rows.
- [asset-manifest.md](asset-manifest.md): 246 rows covering new art, reused art, the 17 S1 families, S2–S9 sounds, reused or optional audio, and coded treatments. 14 S1 combat families are `integrated-review`, 3 prop families `received`, 25 reused art groups `reuse-review`, everything else `requested`.

## Documentation discrepancies found (not fixed in R0)

Each has an owner; none blocks R1.

| Finding | Owner |
|---|---|
| [asset-plan.md](asset-plan.md) still says nothing has been generated and that the SFX runtime path is decided in R2. 51 Suno takes and 42 runtime WAVs (`assets/sfx/<id>-NN.wav`) already exist. | R2 preparation |
| The 51 Suno S1 takes have no provenance sidecars (prompt, date, hash, plan). The manifest uses the first commit date. | R2: record what can be recovered, or mark it unknown |
| The asset plan's first request and the S1 checklist name `.wav` sources; every installed source is `.mp3` (allowed elsewhere in audio-prompts.md). | R2 preparation |
| [readiness-review.md](readiness-review.md)'s *Current audio workflow* paragraph says new SFX use ElevenLabs. [audio-prompts.md](audio-prompts.md) says the ElevenLabs trial was rejected and Suno is installed, with either provider allowed for future keepers. audio-prompts.md is current. | R2 preparation |
| B4 (Confessional grille and wood) is "required" in art-prompts.md but "optional" in the asset plan's R1 row and in r01.md. The fallback (existing wall texture) makes optional workable for R1. | R4 (the Advocate's room) |
| Five chaingun pilot artifacts in `assets/audio-src/sfx/cut/` are tracked but not mentioned in any doc. | R2 |

## What R1 starts with

[r01.md](r01.md) is **prepared**. Its first stage is **R1.1, the pure generator and the R1 pool**:
- `src/gen/`: hashing, D4 transforms, layout steps 1–10, assignment steps 11–13, stamping step 14, the attempt loop and the fallback floor;
- `src/data/rooms/notation.ts` and the 14 pool modules in `src/data/rooms/1/`;
- the room-record map types;
- the split `validateLevel`;
- the generator and pool tests.

The old fixed dungeon keeps loading unchanged.

**Your inputs for R1** are listed in r01.md *Your inputs*: three small product defaults to confirm or change. Meanwhile, the remaining R2 pilots can start: the Dominion design and the tall amphora. The Chain Gun pilot is already done (three takes in the game since 2026-10-12, awaiting your listening approval).
