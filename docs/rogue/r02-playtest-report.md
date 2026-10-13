# R01/R02 playtest follow-up — 2026-10-13

Status: awaiting human play (Gate B remains open). Cleanup and pickup fixes are committed together as `d96c388` on `rogue`, based on `ad23bf2`; the latest pressure follow-up below builds on `d96c388`. No push, merge or deployment.

## Latest pressure feedback — 2026-10-13

Tomas still found little reason to enter the crowd: very few halos appeared despite each Blessed wearing one, effect props were oversized, and the larger enemy rarely accompanied its minions. He requested riskier candles and more frequent Dominions, clarified that the smaller chalice must remain purely healing, and chose design proposals before implementation for the other two masters.

The previous consumable-rate increase did not solve halo scarcity. The room's 12–33-halo budget and 1/10/10 payout weights were the constraint, and extra elite reservations could consume most of it. Budgets are now 48–132 (fourfold), weights 1/3/3, and reserved elite gold costs at most a quarter of each room's budget. Party sizes still receive equal total room income; cleanup still forfeits rewards, and pool/merge/expiry limits are unchanged. A representative wave of 200 Blessed, 10 Choristers and 8 authored elites now pays 31 ordinary halos through its Blessed kills at both solo and four-human scaling; the longest initial/within-wave dry streak is at most six Blessed kills in that test. This is a fixture measurement, not a promise for every generated room.

Every stamped combat wave gets one baseline Dominion outside the authored minion TP budget. Elite-focused waves retain their extra authored Dominions, while the first wave and the crest now have a commander too. First commander placement is prioritized when allowed; safe distance, the two-alive cap, HP scaling, retained queues and all-clear accounting remain authoritative. Minions are not removed to pay for this leader, so the 1,200-Blessed four-player band-2 crest remains intact. Boss summons and legacy fixed maps are unchanged. Seed 317434499 retains its geometry/selections; full-pool hash is `c2f93477`, R1-pool hash `906aa90b`, protocol/rules 6/8.

Lamp/chalice heights are 1.1/1 m, half their previous size, shared by rendering and hit cylinders. Candle damage was already 15 to players; it is now 40 before defenses within the same 4 m, after the same six-tick delay. Enemy damage remains 60. Walls, room ownership, shields, Fallen mitigation and God mode still apply. Chalices retain their 30 HP heal and fifteen-second recharge, with no harmful tradeoff.

**Incentive limit:** R02 still has no working shop or durable inventory. More visible halos improve pickup opportunities, but their spending payoff is R03 work; this cannot honestly be called a fully validated reason to enter the crowd yet. The new economy invalidates old shop affordability examples, and the new commanders need exact XP entitlements when R03 is prepared.

**New master proposals — not implemented or accepted:**

- **Cantor, master of Choristers:** a conspicuous ground conductor recruits a bounded nearby group of Choristers into a shared, clearly telegraphed volley toward the player's marked position. The aim locks before firing, so a sideways push/flank breaks the firing line. Interrupting or killing the Cantor breaks coordination; ordinary Choristers remain threats. A proposed reward for keeping it alive is baiting that commanded volley through Blessed or a candle, with friendly damage restricted to the clearly marked command attack. Do not add an ambient damage/HP aura that merely makes the same retreat take longer.
- **Seraph, master of Cherubs:** a larger airborne marshal marks one visible dive lane and sends a bounded group of Cherubs through it after a windup. Step across the lane, rather than retreat along it; committed divers briefly land and become vulnerable to ground control. Baiting a dive into a candle or Dominion slam gives a reason to postpone killing the master. The Seraph exposes itself after issuing a command. No invisible attacks from above/behind, continuous homing dive, or unbounded extra spawns.
- Both designs need readable silhouette/tell assets, explicit command membership and cancellation, cap/LOS/room rules, interruption tests and a playtest before joining the roster. Implement one at a time. They are distinct tactical proposals, not renamed Dominion reskins.
- When implemented, each family should use the same per-wave commander slot: Dominion for a Blessed-led wave, Cantor for a Chorister-led wave, Seraph for a Cherub-led wave. Keep a shared active-master cap and choose by the authored wave focus. This gives each family an identifiable leader while bounding overlapping command patterns; it does not authorize adding all three masters to every wave.

Verification for this latest pressure pass:

- `npm test`: **946 passed, 89 files**, exit 0, 79.44 seconds with the existing single-worker configuration and unchanged performance thresholds. The first run exposed one old ranged-weight fixture and two new fixtures that accidentally cleared their no-wave rooms; those test setups were corrected, then the complete suite passed. Log: `tmp/r02-pressure-unit.log`.
- `npm run typecheck`: passed, including the new no-God candle browser regression.
- `npm run build`: passed. Log: `tmp/r02-pressure-build.log`.
- `npm run test:gen`: passed, exit 0, 79.74 seconds; all 1,000 floors valid, 997 within 20 attempts, zero fallbacks, maximum 25 attempts. Log: `tmp/r02-pressure-generator.log`.
- `npx playwright test --config playwright.hardware.config.ts e2e/rogue-pressure.spec.ts e2e/r02-checkpoint.spec.ts e2e/crest.spec.ts e2e/dominion.spec.ts e2e/rogue-floor.spec.ts e2e/pickup-expiry.spec.ts`: **37 passed, 1 failed**, 17.7 minutes. Passing checks include the actual generated crest with its commander and unchanged minion/deadline bounds, Dominion bait/cancel, real two/four-client sessions, all 20 room/class links with an opening Dominion, pickup late join/shared collection, fresh run identity, full generated-floor traversal, smaller props/recharge and exactly 40 candle damage with God mode off. The traversal uses the existing dev cleanup input; it proves floor lifecycle, not human combat feel. Log: `tmp/r02-pressure-e2e.log`.
- The expiry fixture failed its zero-wallet assertion because a new commander legitimately killed minions while the player waited outside the marked gold's attraction range. The marked pickup itself was still live. The fixture now clears combat through the existing reward-free dev input before creating the pickup; the original lifetime and zero-credit assertions are retained. `npx playwright test --config playwright.hardware.config.ts e2e/pickup-expiry.spec.ts`: **1 passed**, exit 0, 1.3 minutes (`tmp/r02-pressure-expiry-e2e.log`). Both unobstructed captures show a readable ring without the old white glare; continuous visibility/shrink remains covered by view-unit assertions. All 38 selected browser scenarios have passing evidence across these two runs.
- Inspected active lamp/chalice and no-God damage screenshots: the smaller bodies render and are targetable; the damage capture shows 80/120 HP. Captures from the main run are preserved in `tmp/r02-pressure-captures/`. Earlier sections below retain their historical results. No benchmark was run; automated results do not accept Gate B.
- Final `npm run typecheck`, `npm run build` and `git diff --check` passed after the fixture correction. No automated check remains blocked. Use `npm run dev` and seed `317434499`, room 3 or 4, with `god=0` to judge crowd rewards, commander pressure and candle risk; the shop payoff remains R03 work.

## Earlier input and assessment

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
