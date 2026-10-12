# R1 report: generated floor

**Status: implementing; R1.5 implemented and tested, awaiting-human-play; R1.6–R1.7 pending** (2026-10-12). Brief: [r01.md](r01.md). Branch `rogue` (as recorded in [r00-report.md](r00-report.md)); nothing pushed, merged or published. R1.5 adds the map/discovery checkpoint; the final protocol remains R1.6.

## Git facts

| Fact | Value |
|---|---|
| Start SHA | `ab87f87bb32f8bfce8b2a505e81d5b7a1e49269e` (*R0: prepare R1 (generated floor) against the code*) |
| R1.1 | `c3da916` *R1.1: rooms instead of arenas; fixtures unchanged* |
| R1.2 | `a21fab8` *R1.2: floor generator and R1 room pool*, then the commit adding this report (*R1.2: pinned generator results*) |
| R1.3 start SHA | `a52861602646537d5ca846ae54b02cd215c68397` (*R1.2: pinned generator results*) |
| R1.3 code SHA | `32a1747b34cb69579a3d4d41b60a985137c356c5` (*R1.3: play on a generated floor (doors open)*); followed by the checkpoint report commit |
| R1.3 testing follow-up SHA | `f4e6225141369049b45b2f226ae9b495141dee56` (*R1.3: test coverage and tested handoff policy*), based on `fce0591`; followed by the commit recording these test results |
| Main base checked at R1.3 | `fa9e3f5765cd09d5a315db6342107ff70ad159e8`, unchanged from R0 |
| R1.4 start SHA | `a0b22727d12feb36839552cffb3f1424a03dd36b` (*R1.3: record passing unit and browser checks*) |
| R1.4 parent | `fd6bb3b6b60fb6a7bfd67c9946839ff35598b465` (*art: import rogue sources and update prompt checklist*), committed independently during this stage; preserved |
| Main base checked at R1.4 | `fa9e3f5765cd09d5a315db6342107ff70ad159e8`, unchanged |
| R1.4 code SHA | `0d52171afc902b780b320722659199a14b00a3b7` (*R1.4: room lifecycle, trickle and leash*); followed by the checkpoint report/decisions commit |
| R1.5 start SHA | `05a125ddd51baf0226b108d8c85e9460a084b761` (*R1.4: record verified lifecycle checkpoint*) |
| Main base checked at R1.5 | `fa9e3f5765cd09d5a315db6342107ff70ad159e8`, unchanged |
| R1.5 code SHA | `d83cf8ffaf82548dd4c436906d8562ad8dd5d92d` (*R1.5: map, discovery and door sigils*); followed by the checkpoint report commit |
| End SHA | not yet: R1.6–R1.7 remain |

## What changed

### R1.1 Rooms instead of arenas

- Room records replace arenas everywhere (`src/data/dungeons/types.ts`). The fixed dungeons keep their arena source and pass through `adaptFixture` (`src/data/dungeons/fixture.ts`); `getDungeon` returns the adapted record.
- `GameMap`: `rooms`, `doorRoom`, `roomSpawnPoints`, `roomSquadPoints`, and the new `roomOf`, `hazard` and `viewMask` layers.
- The leaf rule `leafOpen`/`applyLeaves` (`src/sim/map.ts`) replaces `doorsClosed`/`arenaPhaseOf`/`setArenaDoors`. Host and client call it with the snapshot's `activeRoom`, `activePhase` and the new `clearedMask`.
- The interim snapshot header carries `clearedMask` (31 bytes). R1.6 replaces it with the 61-byte run-scoped header.
- `validateLevel(map, markers, mode)`:
  - `fixture` keeps the per-arena rules;
  - `floor` applies §14.2 (a)–(e);
  - `template` (added in R1.2) is the floor rules without the boss cardinality, for template fixtures.
- Zones follow rooms; `computeHeights` drops open-edge candidates outside the view mask before its facing loop.
- The simulation keeps the old fixture timings (60 s countdown, full heal) until R1.4. The sim, bot, music, HUD, debug state, renderer doors, floor looks and arches read rooms.
- The gate keeps its west facing; R1.3 adds the other three.

### R1.2 The generator and the R1 pool

- `src/gen/` (pure: no DOM, three.js, `Math.random` or transcendental functions):
  - `hash.ts`: `fmix32`, the attempt seed and the RNG wrapper;
  - `transform.ts`: the 8 orientations, sockets, strips and entry cells;
  - `layout.ts`: steps 1–10;
  - `assign.ts`: steps 11–13 with the fixed-threshold orientation check, and the gate's continuous transform;
  - `stamp.ts`: step 14: vestibules, room records, the view mask from §3.5's cones, the gate, wave counts by §4.6;
  - `generate.ts`, `fallback.ts`, `fixture.ts` (template fixtures for rule 9), `index.ts` (`floorHash`, `pinnedSeed`), `pinned.ts`.
- `src/data/rooms/`:
  - `notation.ts` expands rooms.md's block notation;
  - `1/<id>.ts` holds the 14 R1 templates, their `room` blocks copied verbatim by script from rooms.md;
  - `1/index.ts` exports `PEARLY_POOL_R1` in pool order;
  - `validate.ts` checks rules 1–8 and 10.
- `npm run test:gen` (`vitest.gen.config.ts`, `src/gen/floors.gen.ts`) runs the 1 000 pinned seeds.
- At the R1.2 checkpoint nothing in the game used the generator; R1.3 below connects it.

### R1.3 Load a generated floor

- Singleplayer and Host Setup select a generated Pearly Gates floor. `src/sim/runMap.ts` shares the map-loading step between the worker and every client: generated runs call `generateFloor(seed, heaven, floor, PEARLY_POOL_R1)` and reuse its validated `GameMap`; fixtures still use `getDungeon`/`loadMap`. No generator, pool or pinned-output data changed.
- `Lobby.start()` draws a cryptographic 128-bit lowercase hex `runId` and independent u32 `seed`/`simSeed` before Loading. The worker uses the retained identity at `go`, with its simulation RNG seeded by `simSeed`; a late joiner's `start` carries the same identity. A subsequent Start draws a new one. Singleplayer uses the same identity helper. An explicit dev seed sets `simSeed = fmix32(seed ^ 0x53494d)`.
- `hello.bot` reaches lobby admission and the simulation player record, including late joiners. The worker infers its initial solo flag from a single human with no bots; fractional party scaling and dynamic solo/sustain rules remain R1.4.
- `welcome`/`lobby` carry `heaven` and `fixture`. `start` carries `runId`, `heaven: 1`, `floor: 1`, the two seeds, `edicts: 0`, `progressionEnabled: false`, `fixture` and each player's `bot` flag. Internal worker starts carry the same run fields and `startRoom`, replacing the fixed dungeon/seed/singleplayer envelope. The temporary fixture-only Lobby constructor was removed in the testing follow-up once its inherited test callers were updated; no legacy dungeon field is sent on the wire.
- Generated runs use the temporary `walkOnly` option: every room is marked cleared so the existing header/leaf rule opens both leaves of every vestibule, and room starts are suppressed. There are no waves, boss fight, clear rewards or victory on a generated floor in this stage. The fixed fixtures retain their fights. R1.4 replaces this temporary cleared mask with the real room lifecycle; knowledge/visited state arrives in R1.5.
- The Gate keeps its authored W-facing layout and UVs, with a shared continuous-coordinate frame in `src/sim/gate.ts` rotating emission, plinth, normals, light queries, ray/post hitboxes, terrain/relief skips and the cloud banks/radiance for N/E/S. Floor height comes from the adjacent interior cell, including E/S planes beyond their final cell. Authoritative wall collision already follows the stamped map geometry.
- Music selection is by generated room shape (2×2 Arena 1, 2×1/1×2 Arena 2, 1×1 Arena 3, boss Boss, specials Calm); fixtures keep their previous mapping. The walk-through stays on Calm until encounters arrive.
- Loading shows `Building the Pearly Gates…`. F3 shows seed, attempts, fallback use and generation time. `window.__heavenfall` also exposes `simSeed`, `runId` and `floorHash`; `activeRoom` and `clearedMask` already existed at R1.1. The new fields reset on returning to the menus.
- Dev URLs support `map=rogue`, `seed=N` and `room=N`. Room selection is clamped after generation and places each player on the selected room's first entry, including an explicit `room=0`; without it, players use the Breach's normal spawns. `map=pearly-gates`/`map=sandbox` and fixture `arena=N` remain available. `bench=1` always resolves a fixed fixture.

**Changed files at R1.3** (20 source files; the report and decision register follow in the documentation commit):

| Area | Files |
|---|---|
| Run identity and admission | `src/net/version.ts` (new), `src/net/messages.ts`, `src/net/lobby.ts`, `src/net/peerTransport.ts` |
| Worker/session and simulation | `src/client/hostSession.ts`, `src/sim/workerMessages.ts`, `src/sim/worker.ts`, `src/sim/runMap.ts` (new), `src/sim/sim.ts` |
| Gate facing | `src/sim/gate.ts` (new), `src/render/gate.ts`, `src/render/atmosphere.ts` |
| Loading, menus and debug | `src/main.ts`, `src/params.ts`, `src/debug.ts`, `src/ui/debugOverlay.ts`, `src/ui/menus.ts`, `src/ui/multiplayer.ts`, `src/client/game.ts` |
| Room music | `src/client/sounds.ts` |

### R1.4 The room lifecycle

- Generated floors now start with the Breach cleared and other rooms idle. `walkOnly` is removed. Pardoner/Confessional rooms clear on their first human visit; ordinary combat and the empty-wave boss dispatch by kind. Room starts no longer require lower-index rooms to be cleared. Content validation rejects ordinary combat with no waves in both floor and fixture modes.
- Countdown: 20 seconds, held below half the living human quorum; vestibules count toward that quorum. Everyone inside shortens it to 3 seconds. Three seconds without a human in the room, or no living humans, cancels it and retains visited state. The nearest used entry centroid selects the socket, with lower-socket ties. Only one encounter counts down or fights.
- Sealing teleports outsiders and souls to their own cell of the selected entry, using the existing correction/acknowledgement path. `P` is connected humans plus 0.5 per bot, at least 1, frozen at seal. Counts interpolate through the original integer multipliers. The director cap includes the previous wave's 30% carry-over and stays within 1,500. The inherited single-wave sandbox and benchmark retain their pacing exceptions.
- Placement prefers markers beyond 10 m in a generated 1×1 and 15 m otherwise, then the inherited 8 m preference. The final marker fallback requires more than 3 m from every living player; otherwise its queue stays unfinished. Squads use the same minimum. The global cap includes the Gatekeeper. The crest's 10-second arrival/rate and lack of warned floor fallback remain R1 fixtures; R2 owns their replacements.
- Ordinary clear heals each living connected player by 30% of max HP, capped at max, and respawns souls at 50% HP on the selected entry. Passive recovery is inferred from the current roster: true solo ordinary combat relax only, or the inherited solo boss baseline. Idle/countdown/cleared rooms and vestibules have none.
- Cleared combat revisits can spend at most three refills: after ten human-free seconds, a returning human must stay three seconds; placement uses `floor(min(12, 4 + 2P))` Blessed. Hidden safe markers take priority, otherwise the farthest safe marker. Passing through, bots alone, another active encounter, or victory spends nothing. A refill waits for enough capacity for the whole batch. Enemies target only living players in their home room and fade after ten seconds without a living player there, without kill credit.
- Typed-array `home`/`leashed` records apply the same home-cell check to ordinary movement, separation, knockback/launch and Chains' interpolated pull. Discord remains its inherited silence plus client visual gust; it introduces no authoritative displacement path to bypass that check.
- Ground fields rebuild only for living players in rooms with enemies; the flood is clamped to the room rect plus four cells. Air fields rebuild only with flyers. Explicit dev/test refresh still supports roomless geometry fixtures. No generator, template, pool or pinned output changed.
- Every five seconds, sealed-room enemies with no reachable living target accumulate unreachable time. After ten seconds, recovery selects the farthest safe reachable authored marker, retaining HP/state/accounting. Ten further seconds without a legal marker removes the enemy without credit and logs the defect. After the last wave is fully placed, individually motionless/unhurt survivors (at most ten total) receive the same handling. Recovery is instant; its beam belongs to R2.
- First-time combat joiners arrive as souls on the selected entry; other joiners arrive beside the lowest-id living player. Lobby roster metadata now retains `bot` for human-follow/rescue choices. Solo `?bot=1` drives a human slot for the specified autopilot acceptance run; multiplayer bot admissions still count as half players and never start encounters themselves.
- Bots use the selected countdown entry, follow the host human or lowest-id living human, and prioritize reachable human souls when all humans are down. Solo autopilot uses BFS through open cleared-room connections to the nearest frontier, ties by index, reaching the boss after other available rooms. Rescue searches retain the existing half-second cadence.
- `roomState` replaces `arenaStarted`/`arenaCleared` now, with the existing seal/clear text and sounds and a small entry-socket cache for bots. Full discovery propagation, client room model, map/sigils, late-join `floorSync` and revision/run scoping remain R1.5/R1.6. The snapshot's shared header/leaf rule continues to control all doors.
- Dev `room=N` clears every other generated room and places players on N's entry; fixture `arena=N` still clears only earlier rooms.

**Autopilot regression found and fixed:** the first browser floor run stalled while leaving a cleared room. The deterministic bot/local-movement/simulation regression reproduced a diagonal stair oscillation: selecting a new neighbour at the intermediate orthogonal cell turned the bot back before it finished crossing. Steering now finishes a cell-centre waypoint before choosing another. That regression traverses the entire pinned floor through real collision, countdowns, waves, clears and the boss to victory. The corrected browser autopilot run passed in 8.7 minutes; it cleared every ordinary combat room and reached boss victory.

**Changed files at R1.4:**

| Area | Files |
|---|---|
| Authority and fields | `src/sim/sim.ts`, `src/sim/flowfield.ts`, `src/sim/worker.ts`, `src/data/dungeons/validate.ts` |
| Events, roster and autopilot | `src/net/messages.ts`, `src/net/lobby.ts`, `src/main.ts`, `src/client/bot.ts`, `src/client/game.ts`, `src/client/sounds.ts` |
| Unit coverage | new `src/sim/roomLifecycle.test.ts`, new `src/client/bot.test.ts`; updated `src/sim/arenas.test.ts`, `combat.test.ts`, `director.test.ts`, `runMap.test.ts`, `waves.test.ts`, `testutil/arenas.ts`, `testutil/sims.ts` |
| Browser coverage | `e2e/rogue-floor.spec.ts`; `e2e/multiplayer.spec.ts` identifies its all-bot admission fixture and also renders D small for the chat deadline, restoring its original viewport afterward |
| Records | this report and `implementation-decisions.md` |

## Design change made (needs your review)

**The Choir Loft's two sanctuary lamps moved** (rooms.md §3.1 `pg-c-1x1-ranged-01`; row in [implementation-decisions.md](implementation-decisions.md)).

- **Problem.** Blocks (3,5) and (12,5) stood 2.2 m and 2.8 m from the side door strips. rooms.md §8 requires 4 m in every orientation, so the template had no valid orientation. That made the fallback floor impossible to build, and it left the R1 pool one 1×1 template short of a legal floor.
- **Repair.** The lamps are now at blocks (4,4) and (11,4): still beside the loft stairs, 5 m from every strip. Prop counts and every other cell are unchanged.
- **Effect in R1.** None you can see: props are inactive until R2.

## Checks run

| Check | Result |
|---|---|
| `npm test` before any change (`ab87f87`) | 619 passed, 1 failed: the timing test `perf.test.ts` (8.47 ms against an 8 ms limit) while the whole suite ran in parallel. Run alone it measures 3.2 ms per tick. It's load-sensitive and failed or passed run to run during this work; no code change explains it. |
| `npm test` at R1.1 | 623 passed (includes the new leaf-rule tests) |
| `npm test` at R1.2 | 686 passed |
| `npm run typecheck`, `npm run build` | passed at both commits |
| `npm run test:gen` at R1.2 | passed; numbers below |
| e2e, benchmark | not run: no session or network flow has changed yet (e2e is due at R1.3) |

**Initial R1.3 verification** (before you replaced the no-tests preference; the R1.1/R1.2 results above are historical, not rerun):

| Check | Result |
|---|---|
| `npm run typecheck` | passed on the final R1.3 source |
| `npm run build` | passed on the final R1.3 source |
| `git diff --check` | passed |
| Automated tests, generator suite and e2e | not run at the initial handoff, under your then-current no-tests instruction; superseded by the authorized testing follow-up below |
| Browser play, multiplayer runtime, Node/browser hash comparison | not performed; runtime and visual evidence remains outstanding |
| Benchmark | not run (not requested) |

Source inspection followed the run identity through start, ready/go, timeout removal and late admission; it also checked that the Gate's world/light/ray paths share the same frame. These are inspection results, not runtime measurements. The generator's 99.7% measurement and pinned hash below remain R1.2 evidence.

**Testing follow-up, 2026-10-12.** You replaced the general no-tests preference for this project: every delivered stage or milestone must be tested. [AGENTS.md](../../AGENTS.md), the workflow and the roadmap now record that policy. The first full run found two old lobby assertions that omitted `bot` and the inherited load-sensitive performance failure (11.84 ms/tick while competing with parallel test workers). The assertions now use the new start contract. Vitest runs one worker so the timing check gets an idle CPU; its 8 ms limit is unchanged.

- New unit coverage: cryptographic identity and independent seeds, deterministic dev seeds including zero, identity retention through Loading/timeouts/late admission, fresh identity on the next round, generated-map reuse and fresh state, all open leaves/no encounters, default and overridden entry placement, fixture combat, unknown fixtures, dev-parameter boundaries, and rotated Gate floor sampling/geometry/light queries/plinth/leaf and post hits for W/N/E/S.
- Browser coverage: generated menu starts and fresh singleplayer rounds, matching host/client/late-join identities and floor hashes, two independent dev clients reproducing the pinned Node output and entry positions, F3 seed text, and the inherited fixed-fixture full run.

| Follow-up check | Result |
|---|---|
| Targeted R1.3 unit suites | 39 passed |
| `npm test` | **700 passed, 59 files**; performance threshold unchanged |
| `npm run typecheck` | passed |
| `npm run build` (through e2e) | passed |
| `npm run e2e -- e2e/menus.spec.ts e2e/rogue-floor.spec.ts e2e/multiplayer.spec.ts e2e/full-run.spec.ts` | **3 passed**: menus (12.9 s), pinned Node/browser floor and dev entry parity (24.3 s), full solo fixture run (3.6 min). Multiplayer was blocked before hosting by sandbox denial of the PeerJS WebSocket (`ERR_NETWORK_ACCESS_DENIED`). |
| `npm run e2e -- e2e/multiplayer.spec.ts` with network access | **passed** (3.7 min): four real browser clients, password/class checks, same run/seeds/hash, late admission, chat, advancing/matching snapshots, upload bound and host disconnect. All four selected browser checks have therefore passed. |
| `npm run test:gen`, benchmark | not rerun: generator/pool unchanged; benchmark not requested |

The follow-up changes `src/net/lobby.test.ts`, `src/params.test.ts`, `e2e/menus.spec.ts`, `e2e/multiplayer.spec.ts` and adds `src/net/version.test.ts`, `src/sim/runMap.test.ts`, `src/render/gateFacing.test.ts`, `e2e/rogue-floor.spec.ts`. Multiplayer now closes its owned browsers in `finally`; the blocked first run exposed that failed tests previously left them open and the runner hanging. Production changes are limited to removing the temporary Lobby constructor adapter and configuring serial unit execution. Guidance/report changes are `AGENTS.md`, `development-workflow.md`, `implementation.md`, this report and the decision register.

**Measured generator results** (1 000 pinned seeds `imul(i+1, 0x9E3779B1) >>> 0`, heaven 1, R1 pool, this laptop):

| Measure | Value |
|---|---|
| Within 20 attempts | **997 / 1 000 = 99.7%** (target ≥ 99%) |
| Fallback floor used | 0 |
| Most attempts | 25 |
| Mean attempts | 3.88 (the historical revision-2 prototype measured 3.83) |
| Mean generation time | 38 ms per floor, including stamping, `loadMap` and `validateLevel` (budget 300 ms) |
| Floors failing a §3.3 rule, `validateLevel`, the template rules or the coarse zone-leak check | 0 |
| Rejects by first failing step | too few rooms 982, no Confessional/boss 1 291, no 2×2 390, no Pardoner 123, no Reliquary 96. No attempt was rejected for content, orientation or validation. |

**Cross-check.** Seed `0x12EBAA83` (pinned i = 114) is accepted at attempt 0 with 11 rooms and reproduces Appendix A.1's historical layout room for room (slots, kinds, distances, bands, Pardoner, Confessional, boss and its west gate). It's pinned in `src/gen/pinned.ts` with `floorHash` `d12ff201`.

**Pool checks** (`npm test`):
- every template meets rules 1–8 and 10;
- every allowed orientation passes the template fixture's geometry validation (rule 9);
- negative cases prove the checks catch an untagged pillar, a broken composition, a lamp or marker on a threshold, and an unreachable spawn point;
- notation tests cover rooms.md §2.1's stair examples and each rejected error.

## R1.3 play checklist (historical walkthrough checkpoint)

Run `npm run dev`, then:

1. Start Singleplayer from the menu, leave and start again. Walk through every available door; expect no fights or countdowns at this checkpoint. F3 should show each run's seed.
2. Open `?dev=1&map=rogue&seed=317434499` (the inherited pinned seed `0x12EBAA83`). Compare `window.__heavenfall.floorHash` with R1.2's `d12ff201`; reopen the same URL to check a repeatable layout. Two browser clients passed this comparison against the Node-generated floor in the testing follow-up.
3. Add `&room=10` to inspect the pinned floor's boss room and Gate, and `&room=0` to check entry placement at the Breach. Try another seed to see a different layout/Gate facing.
4. Host a game from the menu and join another client (or a `?bot=1` tab). Compare `runId`, `seed`, `simSeed` and `floorHash` between clients. Leave and rejoin the running game with a free class; its run fields should match too.
5. Open `?dev=1&map=pearly-gates&arena=3` to check the inherited boss fixture, or `?dev=1&map=sandbox` for the arena fixture. Combat remains enabled there.

## Open items

- R1.6–R1.7 remain after the R1.5 checkpoint. Human play/feel acceptance is pending.
- Generated floors have encounters, countdowns, clear sustain, trickle, inherited boss victory, discovery, both maps and door sigils. Rewards, props, pickups, new enemies, fire and progression remain later milestones. The same countdown, fractional scaling, clear sustain and regeneration rules apply to fixed fixtures.
- Binary inputs, snapshots and events are not run-scoped yet; the protocol/header/fingerprint change remains R1.6. The `runId` introduced here is currently loading/admission metadata.
- Multiplayer runtime and Node/browser hash parity passed automated checks. Gate geometry/floor sampling/light queries/leaf and post hits passed for all four facings; its appearance across rotated floors and the floor's feel still need human play. No human feedback has been recorded for R1.3.
- Allowed orientations are mostly identity and the transpose (0 and 7). The 1.5 m off-centre socket offsets mean a quarter-turn or a plain mirror moves the physical doorway off the authored strip, as rogue game.md §3.4 anticipates. The Breach and the Gate allow all 8.

## R1.4 verification

| Check | Result |
|---|---|
| `npm test` on final source | **729 passed, 61 files**; one worker, existing timing threshold unchanged; final run after all browser workers exited |
| `npm run typecheck` | passed on final source |
| `npm run build` | passed on final source, also rebuilt through every e2e command |
| `git diff --check` | passed |
| `npm run e2e -- e2e/rogue-floor.spec.ts e2e/full-run.spec.ts e2e/menus.spec.ts` initial run | Fixed-fixture full run (4.4 min), menus (10.6 s), pinned Node/browser floor and dev-entry parity (22.9 s) passed. Generated autopilot failed on the stair oscillation above; corrected before handoff. The runner was interrupted after the recorded failure to end cleanup. |
| `npm run e2e -- e2e/rogue-floor.spec.ts e2e/full-run.spec.ts e2e/menus.spec.ts e2e/multiplayer.spec.ts` final-source combined run | **4 checks passed:** fixed full run (4.4 min), menus (14.7 s), pinned Node/browser parity and dev entry (18.5 s), generated solo autopilot through every combat room to boss victory (8.7 min). Multiplayer was blocked before hosting by `ERR_NETWORK_ACCESS_DENIED` on PeerJS. The runner was interrupted during cleanup after all five individual outcomes had been printed. |
| `npm run e2e -- e2e/multiplayer.spec.ts` with network access | First retry reached matchmaking/admission/late join but missed the existing 3-second chat deadline (45 s total). D was still at its original viewport while A/B/C were small. After applying the same small viewport to D during chat and restoring it afterward, **passed** (2.0 min; process exit 0): four clients, password/classes, matching run/seeds/hash, late admission, chat, advancing/matching snapshots, upload bound and host disconnect. The 3-second chat and other timing/upload limits are unchanged. All five selected browser checks have therefore passed. |
| `npm run test:gen`, benchmark | not run: generator/pool/pinned outputs unchanged; benchmark not requested |

The new unit suites cover human-only start, one active encounter, majority holds/vestibules/all-in/cancel, selected-entry soul and bot corrections, join rules, empty-wave boss dispatch, header-derived leaves, capped clear heal and respawn, half-player scaling, shape-specific safe spawning and unfinished queues, refill sizes/limits/delay/passing through, hidden placement, leash/pull/knockback/separation/fade, victory suppression, complete-batch capacity at the global cap, field bounds/lazy air rebuild, unreachable relocation/removal diagnostics, individual stuck-enemy recovery, boss-only sustain, frontier ordering, selected countdown entry, human follow/rescue and the full generated-floor movement regression. Existing tests retain idle-regeneration denial and solo relax sustain coverage.

## R1.4 play checklist

Run `npm run dev`, then open `http://localhost:5173/?dev=1&map=rogue&seed=317434499&class=fallen`.

1. Enter a combat room. Solo should shorten 20 seconds to 3, seal the room and spawn waves. Leave before sealing to cancel after three seconds; reenter for a fresh countdown.
2. Clear a room normally, or add `&god=1` and use K repeatedly while waves arrive. Expect 30% max-HP healing, open doors and a route choice. Waiting in the Breach/corridor/cleared room must not regenerate HP.
3. Leave a cleared combat room for at least ten seconds, then reenter and stay three seconds. A finite leashed Blessed trickle appears; walking straight through spends no refill. Pull/knock enemies toward a door and check they stay inside; leave them unattended for ten seconds to fade.
4. Reach the Confessional and boss. The sanctuary is still an empty shell; the boss still ends the run at death. To isolate one encounter, add `&room=N`; all other rooms start cleared. `&room=10&god=1` isolates the pinned boss.
5. Host/join with another human and a bot. A scout minority holds the countdown, everyone inside shortens it, and sealing gathers outsiders and souls. Joining sealed combat starts as a soul. Compare matching doors on both clients.
6. For the automatic traversal, add `&bot=1&god=1` and press K during fights. For the old fixed dungeon use `?dev=1&map=pearly-gates&class=fallen&bot=1&god=1`.

This checkpoint still needs human play/feel acceptance. It does not complete R1 or pass Gate A; map/discovery and the final run-scoped wire format remain R1.5/R1.6.

## R1.5 map and discovery

The host visits rooms only for connected living humans and reveals every vestibule neighbour. Knowledge stays party-wide and monotonic, including after cancelled countdowns and when a scout enters a second idle room during another encounter. The Breach starts visited and its neighbours discovered. Every discovery or phase event increments `stateRevision`.

Every starter receives `go`, then its detached `floorSync { runId, tick, revision, rooms }` before the first snapshot/event. A late joiner receives the same current room projection, including selected entries and remaining refills, before its placement event. The client validates the whole checkpoint before applying it and ignores another run, bad record counts/fields and older revisions. Geometry stays locally generated; phases use complete snapshots. Reliable room events update knowledge/entries and trigger seal/clear feedback only on a phase transition, so discovery and catch-up do not replay cues.

The 200 × 200 minimap uses 28-pixel slots; the M-held 588 × 588 map uses 84-pixel slots, a 40% dimmer, an icon legend and player names. Both show only known rooms, state fills/outlines, vestibule connectors, the current-room gold outline, a facing arrow and class-coloured teammates. M diverts mouse movement to the map cursor and releases/suppresses both attacks while WASD continues. Release, focus loss, chat and Pause hide it. Clicks remain inert until R6. Fixtures show `No map in the fixture`. The remaining-enemies counter sits below the minimap.

The renderer places one 1.2-m glyph quad above each generated leaf, facing its owner and naming the destination by kind/focus (plus a secondary focus). The same cached Path2D shapes serve both maps and the quads. All leaves share one canvas atlas/material and one mesh; their UVs select the destination glyph. The atlas and geometry are disposed with the scene. The HUD adds `Another room is sealing` and the host's `Waiting for the party (n/H)`; existing seal/clear cues remain.

Two routine choices are recorded in `implementation-decisions.md`: the waiting HUD consumes the specified hold byte now, appended to the inherited header (32 bytes, maximum current snapshot 15,768 bytes); R1.6 moves it to the final envelope. B4's supplied sources were visually inspected but fail the seamless/panel-only checks, so the Confessional keeps the specified existing-wall fallback. Sources are unchanged and their manifest entries remain received, not accepted.

**Changed files at R1.5:**

| Area | Files |
|---|---|
| Host discovery/checkpoints/quorum | `src/sim/sim.ts`, `src/sim/worker.ts`, `src/net/messages.ts`, `src/net/protocol.ts` |
| Room model and maps | new `src/client/rooms.ts`, `mapIcons.ts`, `mapView.ts`; `src/client/game.ts`, `input.ts`, `hud.ts`, `src/main.ts`, `src/debug.ts`, `src/style.css` |
| Door glyphs | new `src/render/doorSigils.ts`; `src/render/scene.ts` |
| Unit coverage | new `src/sim/roomDiscovery.test.ts`, `workerSync.test.ts`, `src/client/rooms.test.ts`, `input.test.ts`, `src/render/doorSigils.test.ts`; `src/net/protocol.test.ts` |
| Browser coverage | `e2e/rogue-floor.spec.ts`, `e2e/multiplayer.spec.ts` |
| Records | `r01.md`, this report, `implementation-decisions.md`, `asset-manifest.md` |

**R1.5 verification:**

| Check | Result |
|---|---|
| Targeted R1.5 unit suites plus protocol | 23 passed across 6 files |
| `npm test` on final source | **741 passed across 66 files**, one worker; timing threshold unchanged (44.99 s). Initial source also passed 740 tests before the atlas regression was added. |
| `npm run typecheck` | passed on final source and after the R1.5 code commit |
| `npm run build -- --logLevel error` | passed on final source and after the R1.5 code commit, also rebuilt through both browser commands |
| `git diff --check` | passed |
| `npm run e2e -- e2e/rogue-floor.spec.ts -g 'map shows Breach'` | Map/discovery and M input check passed (10.9 s). Restricted runner stalled during browser cleanup and was interrupted after the individual passing result. Visual inspection found the world crosshair still drawn over the map; it is now hidden while the map is open. |
| `npm run e2e -- e2e/rogue-floor.spec.ts e2e/full-run.spec.ts e2e/menus.spec.ts e2e/multiplayer.spec.ts` with network/process access, before sigil batching | **4 passed, 2 failed**, process exit 1 (19.4 min): fixed solo run (5.3 min), menus (11.8 s), map/input (28.0 s), generated autopilot through every combat room to boss victory (9.1 min). Multiplayer late admission and the second parity client timed out during loading. The retry after batching below passed. |
| Final browser retry with network/process access (exact command below) | **4 passed**, process exit 0 (2.6 min): menus (11.4 s), multiplayer (1.8 min), map/input (8.1 s), Node/browser parity and dev entry positions (20.2 s). Loading, chat, upload and other deadlines/limits unchanged. No remaining failed check. The two complete traversals above were not repeated after this renderer-only optimization; simulation, movement and lifecycle code were unchanged. |
| Generator suite, benchmarks | not run: generator/pool/pinned output unchanged; benchmarks not requested |

Final browser retry:

```sh
npm run e2e -- e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts e2e/menus.spec.ts -g 'multiplayer|pinned Node|map shows Breach|menus'
```

The added unit coverage exercises initial and propagated knowledge, repeated visits, minority scouts/competing rooms, bots/souls/disconnected players, cancel retention, hold-byte transport, immutable join checkpoints below 1 KiB, go/checkpoint/snapshot/event ordering in the real worker, atomic malformed-checkpoint rejection, delayed snapshots/checkpoints, transition-only feedback, idle-room hints, M movement/fire/focus behavior and every pinned-floor leaf's inward pose/destination icon. The renderer regression checks one atlas/draw, 1.2-m quads, inward triangle winding, destination UV selection and texture/geometry disposal. Browser checks add exact initial known-room content, M-held movement with stable aim and no primary/secondary shots, map hiding on release/Pause and matching starter/late-join knowledge.

## R1.5 play checklist

Run `npm run dev`, then open `http://localhost:5173/?dev=1&map=rogue&seed=317434499&class=fallen`.

1. In the Breach, check that only it and its immediate neighbours appear on the minimap. Compare the neighbour icons with the glyphs above the doors.
2. Hold M: inspect the full map/legend, move with WASD and move the cursor with the mouse. Neither mouse button should attack. Release M to resume mouse look; Escape hides the map and opens Pause.
3. Visit a combat room and cancel its countdown. It stays grey/visited; its neighbours remain discovered. Seal it and clear it to see the red pulse, ivory clear state and open route choices.
4. Host/join with humans. A minority scout should see `Waiting for the party (n/H)`; a scout in another idle combat room sees `Another room is sealing`. Joining later should show the party's known rooms immediately. Open chat while holding M and check the map hides.
5. Compare a different seed and the fixed `?dev=1&map=pearly-gates` fixture, whose map plate explicitly says it has no map. The Confessional's wall art is still a fallback; shops, rewards and map clicks remain inert fixtures.

Human play and Gate A acceptance are pending. This stage does not complete R1; R1.6 still owns run-scoped inputs, snapshots/events and the final build fingerprint.
