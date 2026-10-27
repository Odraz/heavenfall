# R9 report: slice acceptance and merge preparation

**Status: awaiting-human-play**, 2026-10-27. Stages 1–4 implemented on `rogue` from `ce59df2` under Tomas's request "Wrap up the rogue development by implementing R09", with every brief default (your inputs 1–3 and 5 at their defaults; 4 and 6 wait for you). Stages 5 (your sessions), 6 (repairs) and 7 (acceptance, merge preparation) remain. Nothing was merged, pushed or deployed, and no benchmark was run.

**Versions:** protocol 21 → **22** (the `gatebreakerWall` event), rules 28 → **29** (assists, the Gatebreaker clamp). Profile schema 1, unchanged. Mismatched builds refuse to join, so everyone in a session must load this build.

## What changed for a player

- **Assists count what the spec always said** (B1). Your streak gains an assist when, in the last 1.5 s, you bound, slowed, launched, taunted or silenced the enemy that died, or it stood in your incense cloud, your item, relic or talent area or your own fire, or the killer stood in your Field of Blood. Before, only damage, Blasphemy and the Tile counted, so the Binder's and Heretic's setup rarely fed their streaks. Each human still counts a kill once; world fire credits nobody.
- **Gatebreaker turns are checked by the host** (B2). The charge may still turn 180°/s toward your view; a path turning faster (a modified client, or a desync) is turned back and ends at that point.
- **A charge into a wall makes a sound** (B4): a shoulder-into-a-door thud (synthesized; `gatebreakerWall` in audio-prompts.md S6 replaces it by file name).
- **`?evidence=1`** on a normal page (your profile saves as usual) writes one `EVIDENCE {…}` line per room and per run to the browser console, and Results gets a *Copy run evidence* button. Use it in every session below and send me the copied text.
- **`docs/rogue/fixtures/r09-collected.txt`**: a collected account to import (every class at level 10 with a full nine-point build, all 12 relics, all 4 deeds, one win so Edicts are unlocked).
- Development only: `?dev=1&map=rogue&room=10&bosshp=0.52` starts the Gatekeeper at 52%; `?bench=1&map=rogue` runs the benchmark in a generated room.

## Stages and commits

| Stage | Commit | What |
|---|---|---|
| 1 Census, guard | `c371ab6` | `src/content.census.test.ts`, `src/devSwitches.test.ts`, `disposableRun`/`runProgression`, B6 spec size, B7 kept |
| 2–3 Fixes and evidence | `6b76370` | B1 assists, B2 clamp, B4 wall event and cue, protocol 22 / rules 29; evidence log, `bosshp`, collected fixture, phase-2 census |
| 4 Benchmark workload | `c3674ab` | `bench=1&map=rogue` with `seed`/`room`/`view=gate`; BENCH adds `seed`, `genMs`, `mapBuildMs`, `loadMs`; `e2e/bench-rogue.spec.ts` |
| Report | the commit after `c3674ab` | This report, status lines (B13), decisions |

The brief asked for one commit per fix. B1 and the evidence hooks share `src/sim/sim.ts`, and the shell here can't stage parts of a file, so stages 2 and 3 are one commit. The full unit suite, typecheck and build ran on the final tree, not on each intermediate commit.

## Stage 1: census and guard

- **Content census:** every §15.1 row held: 20 combat templates passing the focus, band and spawn-point rules; the four specials and the fallback floor; nine enemy types; all seven states producible by the four base kits; 8 items (Ash and the Chain Jar apply states); 12 relics, 6 combos each replacing a different relic b; 4 deeds with one deed relic each; Edicts 1–5; 84 talents, 12 alternatives, 7 per tree, a state node in every tree. **Nothing was missing.**
- **Dev-switch guard — defect found and fixed:** `god=1` and the simulated-connection switches (`lag`, `jitter`, `loss`) did not mark the page disposable. No save was ever at risk (a progression host already ignored `god`, and the lag switches only delay a guest's messages), but the rule "every dev switch is disposable" was not true. Both now are; `src/params.ts` holds the one rule `main.ts` uses, and the test checks every switch.
- B6: bosses.md now states the Seal's built 0.6 × 1.2 m cylinder (shared with the Watchers). B7: the Choir Loft lamp move is kept.

## Stage 2: fixes

| # | Result | Evidence |
|---|---|---|
| B1 assists | **Fixed** as game.md §10 states. The existing per-enemy record (a last-touch tick per player slot) already bounds it, so the brief's 2-slot variant wasn't needed. | `src/sim/streakAssists.test.ts`: bind, slow, silence, launch, censed and Field (enemy pooled in it, or the killer standing in it) each credit one assist; one human counted once however many ways; a slow 1.6 s old counts nothing; a sourceless state credits nobody |
| B2 Gatebreaker clamp | **Fixed.** The host turns its own heading toward each segment at ≤ 180°/s; a segment more than 6° (one tick) off is turned back, cut along, and ends the charge. Comparing segment to segment would have let 270°/s through under a one-tick tolerance. | `talentsFallen.test.ts`: 180°/s for 20 ticks keeps charging; 270°/s is cut by the third tick |
| B3 lag test | **Not fixed.** Still intermittent; narrowed down, cause not found. See below. | kill-report counters in the lag log |
| B4 wall event | **Fixed:** `gatebreakerWall` (player, position) when a charge that barely moved can't step 0.15 m further, including a charge meeting the wall at an angle (its last step slides and is clamped); one cue. | `talentsFallen.test.ts`: one event head-on, one at an angle, none for a charge released in the open; `cueMap.test.ts` has no event-less prompt left |

**B3 diagnosis.** On the hardware (D3D11) config that R7 and R8 used, the *Fallen guest* failed **5 times in 27 runs** in this session. Each time only 71–76% of its kills showed at once (needs 80%), at a normal 161–182 ms round trip. Its weapon kills were fine every time: 98–100% of kill markers confirmed. The failure is in its other kills (Falling Star, fire). To find which kills came late, the client now counts the kill reports it receives (`received`), those it had already predicted (`already hidden`) and those it no longer drew (`undrawn`), and the lag test logs them:

- In passing runs the guest received a report for every kill (e.g. 137 received for 134 kills), and none was ever undrawn.
- In the failing runs **33–42 of the guest's kills had no report on its screen** (e.g. 85 received for 118 kills, 128 for 170); some passing runs had a smaller gap (28 of 145). Nothing was missing from its weapon kills, so the gap is in its ability and fire kills.
- In five more runs where the host also counted the reports it sent, sent always equalled its kills, and the guest received all of them. None of those five showed the gap.

So, when it fails, a batch of the guest's ability kills reaches the host's kill count but not the guest's screen within the test's 1 s. Where they are lost (not sent, not delivered or not yet processed) was not found in the time available. The guest's events are reliable and ordered, the lag simulator never drops them, and no control message came near PeerJS's 16,300-byte JSON limit, which would drop it silently. The threshold stays. The counters stay in the lag log so the next failure shows the split.

**Also found:** a second flaky check in the same test. One run measured an RTT of 149 ms against its ≥ 150 ms lower bound (160 ms configured, ±25 ms jitter). Left unchanged, as a measurement margin for you to decide on.

**Corrected:** my first B3 runs used the default SwiftShader config, where the RTT doubled (350–465 ms) and every class failed. That pointed at the machine, but it was software rendering. The hardware config is how these sets are run.

**The review against `main` (stage 2's first bullet) was not done.** It covers `fa9e3f5..rogue`, about 105 commits in three areas, and needs its own reviewer. It is a follow-up; until it runs, no review findings are recorded here.

## Stage 3: evidence tools

- **Evidence log** (`src/sim/evidence.ts`, host only, read-only). A room record when a fought room clears (or when the next room seals first) has: room index, id, kind, template; seal and clear time and crest arrival on the simulation clock; peak living enemies; simulation ms average and maximum while sealed; deaths and revives; and each human's decisions since the previous record. Decisions are item uses, purchases, reward picks and passes, Rite picks and passes, Bell rings, bargains, and route choices made when two or more discovered rooms were open. Retried requests are counted once. The run record at Victory or Defeat has: floor seed, build fingerprint, roster (class, level, learned build with Rites, Q/E, bot), Edicts, Sundial, result, run clock, the host page's Loading and map-build ms, record and dropped counts, and per-human decision totals. At most 32 room records + 1 run record, each under 2 KB (tested). A run the host leaves keeps only its room records (the worker stops before it could write one).
- **`bosshp`** (`dev=1`, ignored by a progression run): above 50% phase 1 starts at that HP; at or below, the normal transition plays first.
- **Collected fixture:** `scripts/r09-collected.mjs` builds it with the game's own modules (deterministic: same file on every run); `profile.test.ts` imports it as a normal profile and checks the nine-point builds against the learned rules at level 10.
- **Phase-2 census** (`e2e/r08-presentation.spec.ts`, production build, Binder bot, `god=1`, seed 317434499, `bosshp=0.52`): the bot brought him to half in **51.6 s**; the trumpet transition played once; phase 2 lasted **≈ 88 s** to a victory. **No voice was refused** (`refused: {}`). Started in the whole fight: `chaingun` 714, `hitTick` 569, `blessedDeath` 171, `killTick` 158, `globeShatter` 39, `abilityReady` 33, `arrowFired` 21, `chains` 20, `discord` 14, `watcherBreak` 13, `tollTell`/`tollImpact`/`tollPersonalWhoosh`/`volleyWindup` 10 each, `burstPop`/`scourge` 9, `streakTier` 9, `callTell`/`sealBreak`/`judgmentPrewarn`/`hostDescend` 5, `watcherOpen` 4, `judgmentCharge` 4, `judgmentBlast` 3, `bossTransition` 1, `bossDefeat` 1. **Inspected** in its screenshots (1280 × 720, test output only): the trumpet frame shows *He lifts the first trumpet / It stays silent. The Watchers will open.* over the phase-II bar. **For your review:** the phase-2 Judgment banner (*JUDGMENT — HIDE FROM HIS SIGHT*) runs under the minimap at 1280 px.

## Stage 4: the rogue benchmark workload

`bench=1&map=rogue` benches a generated room: `seed` (default the pinned 317434499), `room` (default 3, its 2×2 crest room), `view=gate` its boss room (10). It fills to 1,500 Blessed as on the fixed maps. On the pinned seed the Refiner's Fire room is **1** (`pg-c-1x1-hazard-01`, four fire patches). `scripts/bench.mjs` gained `--seed` and `--room`. The BENCH line adds `seed`, `genMs` (generation, stamping and validation), `mapBuildMs` (the client's scene build and warm-up) and `loadMs` (this page's Loading up to that point). The three workloads, when you ask:

```bash
npm run bench -- --map rogue --room 3 --uncapped --runs 3 --cooldown 60
```

```bash
npm run bench -- --map rogue --room 1 --uncapped --runs 3 --cooldown 60
```

```bash
npm run bench -- --map rogue --view gate --uncapped --runs 3 --cooldown 60
```

plus one capped run each (the same commands without `--uncapped --runs 3 --cooldown 60`). **No benchmark was run.**

**Defect found and fixed:** the Gate workload never started. Since R7, 8 enemy slots stay reserved for the Gatekeeper's eyes and Seal, so his room tops out at 1,492, while the benchmark waited for exactly 1,500. This also broke the fixed-map `--view gate` benchmark since R7. The measurement now starts at 1,500 less that reserve while he fights (`benchFull` in `src/client/bench.ts`); `src/sim/bench.test.ts` checks that the crest room fills to 1,500 and the Gate to 1,492.

The smoke's software-rendered BENCH lines (not measurements; SwiftShader at 640 × 360) showed the fields working: generation 107–124 ms, client map build 4.9–5.6 s, Loading 6.2–7.0 s. Under SwiftShader the map build can't be judged against the 1.2 s budget; the real benchmark will show whether it is over.

## Checks

| Check | Result |
|---|---|
| `npx vitest run` (full unit suite, alone) | **1,836 passed** (145 files) on the stage 4 tree. The first run failed one test: the version pin in `buildFingerprint.test.ts`, updated for the deliberate protocol 22 / rules 29 |
| Timing tests alone: `npx vitest run src/sim/perf.test.ts src/sim/hazards.perf.test.ts --no-file-parallelism` | **2 passed** within the unchanged 8 ms: simulation 3.297 ms/tick, hazard simulation 4.989 ms/tick |
| `npm run typecheck`, `npm run build` | passed |
| E2E regression set on the hardware config: R8's 17 files + `crest-network`, `full-run`, `dominion`, `bench-rogue`, `r08-presentation` | **72/72 passed** (43.3 min), including all four lag guests (RTT 165–177 ms, 71/72–131/131 markers confirmed), the trumpet census and the three rogue workloads |
| `e2e/lag.spec.ts` *Fallen guest*, 5 in a row (the brief's B3 check) | **not met**: 4 passed, 1 failed (76% at once). 21 more diagnostic runs: 4 kills-at-once failures and 1 RTT lower-bound failure; see B3 |
| `e2e/r08-presentation.spec.ts` trumpet census | passed (also inside the set) |
| `e2e/bench-rogue.spec.ts` | the Gate workload **failed** first (never started: the R7 reserve), **passed** after the fix inside the set |

The command:

```bash
npx playwright test --config playwright.hardware.config.ts e2e/gatekeeper.spec.ts e2e/dungeonChoices.spec.ts e2e/classTalents.spec.ts e2e/talents.spec.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/singleplayer.spec.ts e2e/controls.spec.ts e2e/weapon.spec.ts e2e/watchman.spec.ts e2e/commanders.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts e2e/lag.spec.ts e2e/recorded-sound.spec.ts e2e/refiner.spec.ts e2e/r03-art.spec.ts e2e/crest-network.spec.ts e2e/full-run.spec.ts e2e/dominion.spec.ts e2e/bench-rogue.spec.ts e2e/r08-presentation.spec.ts
```

The kill-report counters (`src/client/game.ts`, `src/debug.ts`, `e2e/lag.spec.ts`) were added after that set ran; they only count, and typecheck and build passed after them.

**Not a benchmark:** inside the e2e set (1280 × 720, hardware, capped) the three rogue workloads ran at ~60 FPS. Simulation averaged 2.6 ms in the crest room, 3.8 ms in the fire room and 2.0 ms at the Gate, with one 76 ms tick at the Gate. Generation took ~102 ms, client map build 2.2–2.5 s, Loading 3.5–3.8 s. **Map build and Loading are likely over their 1.2 s and 3 s budgets**; the real benchmark will measure them.

## Evidence matrix

| Evidence (slice-acceptance.md) | Owner | Consumer | Build / setup | Result | Unresolved |
|---|---|---|---|---|---|
| Complete runs: each fresh class solo | R1–R7 | S1 | — | not observed | B8 |
| Complete runs: mixed-level co-op | R1–R7, netcode | S3 | — | not observed | B3 |
| Death, revive, reload, reconnect, host exit, victory settlement | R1, R3, R7 | S4; `e2e/multiplayer`, `profiles`, `full-run` | this build | see Checks; not human-observed | — |
| Build decisions: two plausible builds per class | R4, R5 | S1, S2 | — | not observed | — |
| Collected-account replay: 3 runs per class | R3–R6 | S2 with `r09-collected.txt` | fixture ready | not observed | — |
| Meaningful choice rate ≥ 15 per human per 10 min | all | evidence log + your explanation | `evidence=1` ready | not observed | — |
| Pacing 18–25 min, Sundial at 14:00 | R1, R6 | evidence log | `evidence=1` ready | not observed | — |
| Cooperation, solo escape, bot priorities | R7 | S3, S1 | — | not observed | B10 (bot) |
| Readability and sound fatigue | R2, R8 | S5, S6; censuses | this build | censuses: no voice refused, phase 1 (R8) and phase 2 (R9) | the Judgment banner at 1280 px |
| Horde reference: ≥ 1,000 alive with four humans | R2 | S5 | `evidence=1` peak | not observed | — |
| Performance and loading budgets | R2, R9 stage 4 | rogue benchmark, evidence log | workloads ready | **not measured** (no benchmark without your request); e2e hints that map build and Loading are over budget | B9 |
| Protocol and admission boundaries | R1, R3, R4 | unit tests, `e2e/multiplayer`, `lag` | this build | 72/72 e2e; `lag` Fallen intermittent (5 of 27) | B3 |
| Lifecycle correctness, no duplicate charge/XP/claim, debug never saves | R3, R6, R7 | unit tests, `devSwitches.test.ts`, S4 | this build | automated; debug guard complete | S4 |
| Required content and recordings | all | `content.census.test.ts`, manifest test | this build | census complete | asset verdicts |

## Gate verdicts (your sessions)

| Checkpoint | Verdict |
|---|---|
| R0, R2 (Gate B), R3, R4 (Gate C), R5, R6, netcode 1–4, R7, R8 | awaiting your sessions on this build |

## Your sessions (stage 5)

Start the build with `npm run build` then `npm run preview` (or `npm run dev`), and open the game with `?evidence=1` added to the address, e.g. `http://localhost:4173/?evidence=1`. Friends on the LAN: `npm run dev:lan`. Export your profile before importing the fixture.

1. **S1 Fresh solo, each class** (minimum): a new normal profile per class. Can it win? Did the first Rite change your next fight? Note the **Heretic Saint's boss time** (B8).
2. **S3 or S5 Four humans** (minimum): a crest in room 3 of a fresh run. Is the peak over 1,000 (the evidence log's `peakAlive`)? Does shooting feel immediate on real connections?
3. **S4 Lifecycle, 2 humans** (minimum): a death and revive, a reload, a reconnect mid-room and mid-boss, the host leaving, shopping after a win. Is anything duplicated or lost?
4. **S2 Collected account**: import `docs/rogue/fixtures/r09-collected.txt`, three runs per class (or the number you choose). Do you still change route, ability, Rite or item plan?
5. **S6 Listening**: which sound tires first; which threat reads late (the Watchers, the trumpet, the Judgment banner over the minimap)?

After each session, paste the *Copy run evidence* text with your feedback. Then ask for the benchmark if you want it measured.

## Open issues

- B3: the Fallen guest's lag test still fails about 1 run in 5: a batch of its ability kills has no report on its screen. Not fixed; the counters are in place. Also its RTT lower bound (≥ 150 ms) failed once at 149 ms.
- Load budgets: in the e2e runs the client map build (2.2–2.5 s) and Loading (3.5–3.8 s) look over their 1.2 s and 3 s budgets; the benchmark will tell.
- The stage 2 review against `main` was not done.
- The Judgment banner overlaps the minimap at 1280 px (presentation; for your S6 verdict or the look overhaul).
- B8 Heretic boss time, B9 tick cost at four players: need S1/S5 and the evidence log.
- Left as the brief planned: B10 (bot), B11 (Confessional wood, look overhaul), B12 (deferred).
- Asset verdicts still open, as listed in the brief.

## Merge plan (prepared, not executed)

After your explicit acceptance and the separate merge instruction: tag the current `main` as `main-pre-rogue` (`fa9e3f5`), then `git merge --no-ff rogue` into `main`. If `main` has moved by then, merge `main` into `rogue` first and replay the affected checks. No push.
