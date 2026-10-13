# R01/R02 playtest follow-up — 2026-10-13

Status: implementation and automated verification complete; awaiting human play. Based on `ad23bf2` on `rogue`; the cleanup and pickup follow-up are committed together at Tomas's request. No push, merge or deployment.

## Input and assessment

Source: Tomas's `game-sp-session-2026-10-13.txt`, followed by the explicit request to analyze R01/R02, process the notes, clean the repository and implement the changes. The document is feedback, not an instruction to start later milestones or accept Gate B.

R01's generator, room lifecycle and run identity remain the foundation. R02's host authority, bounded pickup pool, exact halo budget, delayed prop blasts, Dominion casts and shared dry navigation are retained. The gaps were in presentation integration and movement:

- Props, Dominion and fire still used coded placeholders despite supplied art. Asset receipt had been documented, but did not translate into runtime integration.
- Only Choristers/Dominions used dry routes. Blessed walking through fire was the written design; this feedback deliberately changes it.
- Nearby-target steering bypassed the field's ledge/corner rules. Enemies also lacked the bot's retained cell-centre waypoint, so diagonal stair pursuit could oscillate.
- The Open Terrace, Skywalk and Courtyard of Clouds had marble ledges reachable by a jump from nearby high ground, without a walking route. The original validator only compared adjacent-cell height steps, missing jumps across intervening lower cells.
- Ordinary room rewards paid in three-halo chunks, limiting the number of visible reward moments. Their tiny, low-floating visuals compounded this.
- Separate `rogue` asset trees and duplicate downloaded originals added clutter without a runtime boundary. Source code already followed the original `sim`, `client`, `render`, `data` layout, so no directory-wide code refactor was needed.

The requested `origin/master` comparison could not run because that ref is absent. The available remote default is `origin/main`; the relevant diff against that cached ref and the current implementations were inspected. This is a scoped playtest diagnosis, not a claim of an independent exhaustive audit of every R01/R02 line.

## Implemented

| Note | Change |
|---|---|
| Ground enemies die blindly in fire | Blessed join the existing at-most-four dry fields. Target selection, recovery and steering agree on dry reachability. Knockback/pulls/separation still work; cached escape routing allows climbing a half-metre channel lip. No per-enemy path search. |
| Raised safe spots | Steering checks legal steps and retains cell-centre waypoints. Twelve short hedge-end stairs across three flyer templates connect those perches. Decorative fountain/statue plinths remain inaccessible. |
| Props look unrelated and have labels | Original six prop images run through `scripts/cutout.py` into the shared world atlas. Removed generated labels and fallback atlas. |
| Bigger decorations | Prop attack/sprite heights are 1.5/2.2/2 m (loot/lamp/chalice); other decorations are 25% taller. Props still do not block movement; attack radius stays 0.5 m. |
| Reusable candle/chalice | Host-owned 450-tick recharge, reliable ready event and FloorSync deadlines. Depleted bodies stay visible and cannot retrigger; green chalice liquid fills, the lamp extinguishes, and active props pulse. Healing now has green effects. Loot amphorae remain single-use with more shards. |
| Dominion quality | Added a rigged armored mace-and-folded-wing model using the existing Blender helpers/materials and generated 140 atlas frames. Five rendered directions mirror to eight. Removed the labeled canvas model. |
| Scarce/invisible drops | Ordinary death rewards become one-halo coins: three times as many drops for the same room income. Ranged mote chance rises from 20% to 35%, retaining encounter caps. Original halo/mote sprites float higher, bob visibly and have a pooled soft glow. |
| Missing fire texture | Prepared `tex-refiner-channel.png` into the normal runtime JPG texture pipeline; the floor samples it beneath pooled flames and dims after combat. |
| Repository clutter | Art sources move to `assets/art-src`, references to `assets/art-src/reference`, audio to `assets/audio-src/sfx`. Runtime files use `sprites`/`textures` as before. Tools, ignore rules and current asset records follow the new paths. |

Original downloads were moved into ignored `tmp/asset-originals-2026-10-13/{props,dominion}` after automatic approval review rejected irreversible deletion. They remain recoverable there and in Git history. All 150 relocated asset files match the original Git/LFS content hashes. The 14 previously untracked JFIF files at the art-source root were preserved. Rejected audio takes remain in the ignored local `assets/audio-src/sfx/rejected` archive. No new dependency or benchmark was introduced.

Protocol/rules after the pickup follow-up are **6/7**. The same seed `317434499` keeps its published room selections; repaired geometry changes its full-pool hash to `ad5d1609` (R1 pool: `a36a72b9`). Historical reports retain their checkpoint hashes.

## Additional pickup feedback — 2026-10-13

Tomas reported that enemy drops were still scarce and the halo glow was too bright and flickering. Consumable rewards previously rolled only on Dominion kills at 25%; ordinary wave Blessed now roll at 2%, Choristers/Cherubs at 12%, and Dominions at 50%. Cleanup, non-wave adds, leashed enemies and boss bodies cannot generate these item rolls. One-halo currency frequency, exact room income, heal chances/caps and the bounded world pool are preserved. Seven item effects/storage are still R03 fixtures; this follow-up increases their drops without pretending the effects already work.

Currency no longer has an additive glow. Normal alpha blending without depth writes removes hard cutout shimmer and shared-anchor depth fighting; small stable draw offsets separate stacked rewards. Bob amplitude drops from 0.18 to 0.08 m and slows down. Final-three-second blinking becomes a continuous shrink, with host expiry unchanged. Healing motes retain a smaller 0.16-opacity glow offset from their sprite plane.

Current verification: `npm test` passed **941 tests in 89 files** (105.91 s, one worker, unchanged timing limits); `npm run typecheck` and `npm run build` passed. The first sandboxed unit invocation was interrupted after stalling; the permitted full run is the passing evidence. An unnecessary worker-thread retry was canceled after the completed full result became available; it is not counted as another passing suite. Logs: `tmp/halo-unit.log`, `tmp/halo-typecheck.log`, `tmp/halo-build.log`. No benchmark was run.

- `npx playwright test --config playwright.hardware.config.ts e2e/rogue-pressure.spec.ts e2e/r02-checkpoint.spec.ts`: **25 passed**, exit 0, 3.8 minutes. Covers all room/class checkpoint links, actual damage drops and wallet collection, prop recharge, and real PeerJS late entry restoring a live pickup before shared collection and a clean next run. Log: `tmp/halo-e2e.log`.
- `npx playwright test --config playwright.hardware.config.ts e2e/pickup-expiry.spec.ts`: **1 passed**, exit 0, 30.1 seconds. Shoots a real marked prop outside attraction range, captures the view before and during the final three seconds, and confirms expiry without wallet credit at the original deadline. Inspected both captures in `test-results/pickup-expiry-uncollected--2c068-hrough-the-quiet-expiry-cue-chromium/`: the initial ring is readable without the previous surrounding white glare; approaching enemies occlude the late capture, so it is not visual proof of the shrink. Frame-by-frame view-unit assertions cover continuous visibility and shrink through that interval. Log: `tmp/halo-expiry-e2e.log`.
- `npm run typecheck` also passed after adding the browser lifetime regression; `git diff --cached --check` passed before commit. Human play/feel acceptance remains open; no blocked check is represented as passed.

R03 readiness is recorded in [r03.md](r03.md): all eight item sources and stall sources exist; Plume/pedestal receipt is corrected in the manifest. Runtime export, code-specific preparation, the Ash/Plume weight mismatch and explicit Gate B acceptance remain outstanding. R03 implementation was not started.

## Verification

| Command | Result |
|---|---|
| `npm test` | 936 passed, 89 files; single worker, existing performance limits unchanged. |
| `npm run typecheck` | Passed. |
| `npm run build` | Passed after correcting the channel runtime extension to the pipeline's JPG output. |
| `npx playwright test --config playwright.hardware.config.ts` | 55 passed, exit 0, 26.3 minutes, one worker, D3D11, with permitted PeerJS network access. Includes fixed and generated full traversals, real two/four-client sessions, recharge, fire, pickups, recorded audio, all class/room links and class smoke/weapon checks. |
| `npm run test:gen` | Passed, exit 0, 112.25 seconds: all 1,000 floors valid, 997 within 20 attempts (99.7%), zero fallbacks, maximum 25 attempts, mean 3.882. |
| `git diff --check` | Passed. All 197 concrete/grouped asset-manifest references resolve. |

New regressions exercise repeated prop activation and the exact boundary tick, one-use loot, partial recharge restoration, malformed/stale prop messages, bounded Blessed avoidance and channel escape, stair pursuit, and combat-platform ground access. Browser coverage uses real input to shoot, deplete and reactivate both effect props. The first complete unit run found seven obsolete expectations for deliberate geometry/protocol/draw-scale/coin changes; those were updated after confirming the new values. No timing threshold was relaxed.

The first scoped browser command, `npx playwright test --config playwright.hardware.config.ts e2e/rogue-pressure.spec.ts e2e/refiner.spec.ts e2e/dominion.spec.ts e2e/r02-checkpoint.spec.ts`, recorded 27 passes and four failures: three real PeerJS checks hit `ERR_NETWORK_ACCESS_DENIED` inside the sandbox, and the lamp repeat-shot fixture let enemies obstruct its firing lane. The subsequent full run passed with permitted network access. The shooting helper retains its pointer position between shots and targets the enlarged body; the repeat-shot check moves close to the lamp before firing. This changes test input, not damage, recharge deadlines or assertion limits.

Art QA inspected the exported prop/mote sprites, the Dominion model preview and browser captures. The healing mote required a magenta key rather than the pipeline's default green key; a pixel check confirms retained green pixels and transparent background. The Dominion atlas was generated with `blender -b --factory-startup -P scripts/blender/dominion.py -- sprites assets/sprites/dominion`. The project’s shared renderer, atlas loader and material palette remain in use.

Local verification logs are `tmp/followup-build.log`, `tmp/followup-full-e2e.log` and `tmp/followup-generator.log`; browser captures are in `test-results/`. No required automated check remains blocked. The full browser run used the established Windows hardware configuration; the software-renderer suite was not rerun.

## Play next

Run `npm run dev`. Use the existing seed `317434499`: room 3 for the Courtyard, room 4 for Dominion, room 1 for fire and room 6 for ranged/fire. Shoot a chalice/lamp, wait fifteen seconds and reuse it; push Blessed into a channel; jump onto a hedge and watch their approach. Compare pickup readability during a crowd fight, and the Dominion's silhouette and mace tell.

R02 remains awaiting human play. The frequency of coins, repeatable healing/explosions and all-ground hazard avoidance change combat pacing; their feel still needs Tomas's acceptance. R03 inventory/shop/progression and final four-human crest acceptance remain outside this follow-up.
