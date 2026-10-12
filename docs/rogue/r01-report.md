# R1 report: generated floor

**Status: implementing; R1.3 implemented and tested, R1.4–R1.7 pending** (2026-10-12). Brief: [r01.md](r01.md). Branch `rogue` (as recorded in [r00-report.md](r00-report.md)); nothing pushed, merged or published. R1.3 is the doors-open walkthrough checkpoint, not the complete R1 lifecycle.

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
| End SHA | not yet: R1.4–R1.7 remain |

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

## R1.3 play checklist

Run `npm run dev`, then:

1. Start Singleplayer from the menu, leave and start again. Walk through every available door; expect no fights or countdowns at this checkpoint. F3 should show each run's seed.
2. Open `?dev=1&map=rogue&seed=317434499` (the inherited pinned seed `0x12EBAA83`). Compare `window.__heavenfall.floorHash` with R1.2's `d12ff201`; reopen the same URL to check a repeatable layout. Two browser clients passed this comparison against the Node-generated floor in the testing follow-up.
3. Add `&room=10` to inspect the pinned floor's boss room and Gate, and `&room=0` to check entry placement at the Breach. Try another seed to see a different layout/Gate facing.
4. Host a game from the menu and join another client (or a `?bot=1` tab). Compare `runId`, `seed`, `simSeed` and `floorHash` between clients. Leave and rejoin the running game with a free class; its run fields should match too.
5. Open `?dev=1&map=pearly-gates&arena=3` to check the inherited boss fixture, or `?dev=1&map=sandbox` for the arena fixture. Combat remains enabled there.

## Open items

- R1.4–R1.7 remain. R1.3 now has unit, typecheck/build and browser evidence; the no-tests preference and obsolete lobby assertions have been replaced in the follow-up.
- Generated floors currently have all rooms cleared solely to open the doors; no map/discovery, encounters, trickle, rewards or run completion yet. Leave through the Pause menu after walking. Fixture combat still uses the inherited timings/heals.
- Binary inputs, snapshots and events are not run-scoped yet; the protocol/header/fingerprint change remains R1.6. The `runId` introduced here is currently loading/admission metadata.
- Multiplayer runtime and Node/browser hash parity passed automated checks. Gate geometry/floor sampling/light queries/leaf and post hits passed for all four facings; its appearance across rotated floors and the floor's feel still need human play. No human feedback has been recorded for R1.3.
- Allowed orientations are mostly identity and the transpose (0 and 7). The 1.5 m off-centre socket offsets mean a quarter-turn or a plain mirror moves the physical doorway off the authored strip, as rogue game.md §3.4 anticipates. The Breach and the Gate allow all 8.
