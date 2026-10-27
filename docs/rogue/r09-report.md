# R9 report: slice acceptance and merge preparation

**Status: in progress** (stage 1). Brief: [r09.md](r09.md). Start: `rogue` at `ce59df2`.

## Stage 1: completeness census and drift decisions

- `src/content.census.test.ts` asserts the §15.1 quantities from the data modules: 20 combat templates passing `validateTemplate` (focus, bands, spawn points), the four specials and the fallback floor, the nine enemy types, all seven states producible by the four base kits, 8 items (≥ 2 applying a state via `stateAvailable`), 12 relics and 6 combos each replacing a different relic b, 4 deeds with one deed relic each, Edicts 1–5, 84 talent nodes with 12 alternatives, 7 per tree and a state node in every tree. All rows held; nothing was missing.
- `src/devSwitches.test.ts`: every development switch makes the page disposable or parses only with `dev=1`; a disposable page never enables progression. **Found:** `god=1` and `lag`/`jitter`/`loss` did not mark the page disposable. `god` was already ignored by a progression host, and the lag switches only shape a guest's transport, so no save was ever corrupted, but the rule now covers them (`disposableRun` and `runProgression` in `src/params.ts`, used by `src/main.ts`).
- B6: bosses.md now states the built 0.6 × 1.2 m Seal cylinder. B7: the Choir Loft lamp move is kept (default). Both recorded in [implementation-decisions.md](implementation-decisions.md).
