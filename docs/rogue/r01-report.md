# R1 report: generated floor

**Status: implementing, paused after R1.2 at your request** (2026-10-12). Brief: [r01.md](r01.md). Branch `rogue` (as recorded in [r00-report.md](r00-report.md)); nothing pushed, merged or published.

## Git facts

| Fact | Value |
|---|---|
| Start SHA | `ab87f87bb32f8bfce8b2a505e81d5b7a1e49269e` (*R0: prepare R1 (generated floor) against the code*) |
| R1.1 | `c3da916` *R1.1: rooms instead of arenas; fixtures unchanged* |
| R1.2 | `a21fab8` *R1.2: floor generator and R1 room pool*, then the commit adding this report (*R1.2: pinned generator results*) |
| End SHA | not yet: R1.3–R1.7 remain |

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
- Nothing in the game uses the generator yet; R1.3 connects it.

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

## Open items

- R1.3–R1.7 not started (awaiting your approval to continue).
- Allowed orientations are mostly identity and the transpose (0 and 7). The 1.5 m off-centre socket offsets mean a quarter-turn or a plain mirror moves the physical doorway off the authored strip, as rogue game.md §3.4 anticipates. The Breach and the Gate allow all 8.
