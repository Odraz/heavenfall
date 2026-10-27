# R08 report: feedback and presentation

Status: **awaiting-human-play**, 2026-10-25, on `rogue` from `35b97e5`. Implemented under Tomas's "Implement the prepared docs/rogue/r08.md with its defaults" request; the contracts as built are in [r08.md](r08.md#as-implemented-2026-10-25) and the decisions in [implementation-decisions.md](implementation-decisions.md).

**Versions:** protocol 21, rules 28 and the save schema are unchanged. No new recordings were needed or requested up front.

## What you can play and hear

- **Every required event has its own sound.** Buying (a coin drop with a gold ping) and being refused (a dull wooden knock, never a success sound), the Chart, a Rite page opening and a Rite taken, the key, the Reliquary opening, a relic claimed, the bargain, a level, Pilgrim's Return leaving and arriving, each item used or landing, enemies bound, flung, landing and set on fire, fire going out, each alternative ability's cast, the Gatekeeper's fall, the incense cloud nearby and the Confessional's air. Before, these were silent or borrowed another event's sound.
- **Warnings survive the crest.** The Dominion's wind-up, the Watchman's aim, the Cantor's and Carrier's tells and the Gatekeeper's Judgment, Toll, Call and Volley warnings now outrank every other sound, so gunfire can no longer take their voice. State and relic sounds play at most four times a second each.
- **The boss art.** The Watchers and the Seal are your paintings; an open eye wears a red ring (shoot it), an opening one is grey with its lids shut. At half health the Gatekeeper raises the first trumpet for the 1.5 s transition.
- **Rooms.** The Pardoner stands behind his alms box; the Confessional's walls are dark wood panels and the grille hangs without its painted stone; class fire and the Refiner's Fire use the painted flames.
- **Text.** A Rite page says Pass spends it; the empty Carried line explains the two item slots on 1 and 2. The H window keeps your 2026-10-16 layout (see *Decisions*).
- **Recordings drop in by name.** Each synthesized sound is named by its audio-prompts.md ID; a file `assets/sfx/<id>-01.wav` replaces it with no code change.

## Stages and commits

| Stage | Commit | What |
|---|---|---|
| Preparation | `a97dd96` | Prepared brief, B6 receipt |
| 1 Names | `38b7c1d` | Cue names = prompt IDs |
| 2 Cues | `12e1d2a` | `cueMap.ts`, 43 new cues, `PRIO_WARNING`, limiter, loops, census counter, e2e cue checks |
| 3 Text | `4e845d0` | Pass, bargain share, carry line, item-rule test |
| 4–5 Art, manifest, census | `1de4302` | B6, trumpet, flames, stall box, grille, wood walls, manifest test, presentation/census spec |

## Decisions

- **The H window was not extended.** The prepared brief proposed control lines and attack-augment lines in H. Implementation found your 2026-10-16 commit `4c0a774`, which removed exactly those lines, so they were reverted and the decision recorded. The controls stay taught by the crosshair line, the map legend and the cards.
- Brief defaults kept: no up-front sound requests; alternatives get one-shot cues, no loops; no Breach first-run hint; the heartbeat stays the low-HP cue. Bread of Angels' cast keeps the Chalice's heal; `gatebreakerWall` has no host event yet.
- The Pardoner's alms box sits **on the room's 1.5 m plinth** (pg-s-pardoner-01's "indulgence box on its plinth"), not beside him: the first placement, 0.6 m in front of him, hid it at his feet in every view.
- The open Watcher's red rim is drawn **on top** of the art as a ring on its round frame; drawn behind, the opaque frame hid it.

## Cue census (measured, not listened to)

`e2e/r08-presentation.spec.ts`, production build, the Binder bot (chain gun, the most frequent sound) with `god=1` on seed 317434499. *Voices started* counts what the mixer actually played; nothing was refused a voice in either fight (`refused: {}`), so **no warning lost its voice**.

| Per minute | Crest (room 3, 40.6 s of the crest itself) | Gatekeeper (room 10, 240 s, phase 1) | Recorded? |
|---|---|---|---|
| `chaingun` | 325 | 344 | yes (S1) |
| `hitTick` | 275 | 267 | yes |
| `blessedDeath` | 177 | 65 | yes |
| `dominionStep` | **155** | — | synth |
| `goldPickup` | **98** | — | synth |
| `killTick` | 92 | 69 | yes |
| `burstPop` / `scourge` | 49 / 49 | 6 / 6 | yes |
| `abilityReady` | **40** | 14 | synth |
| `chains` / `discord` | 28 / 18 | 9 / 6 | synth |
| `dominionTell` | 22 | — | synth (warning) |
| `massKill` | 19 | 0.8 | yes |
| `cherubWindup` / `arrowFired` | — | 11 / 10 | synth |
| Gatekeeper cues (`tollTell`, `tollImpact`, `tollPersonalWhoosh`, `callTell`, `sealBreak`, `hostDescend`, `judgment*`, `volley*`) | — | 1.5–3.8 each | synth |

**What it suggests for your listening:** the synthesized sounds heard most are the Dominion's footsteps (155 a minute in a crest), the halo pickup (98) and the ability-ready chime (40). If one of them is the sound that tires you, those are the first recordings to ask for, ahead of the ones the brief guessed (`meleeHit`, `orbFired`, `arrowFired`, about 10 a minute here). In 240 s the Binder bot did not bring the Gatekeeper to half health, so phase 2, the Watchers' cues and the trumpet transition are **not** in the census.

## Changed files

- Audio and cues: `src/audio/sfx.ts` (renames, 43 cues, `PRIO_WARNING`), `src/audio/audio.ts` (started/refused counters), new `src/client/cueMap.ts`, `src/client/sounds.ts`, `src/client/game.ts`, `src/render/incense.ts` (`nearest`), `src/debug.ts` (`cues`, `voices`, `boss.eyesAt`).
- Text: `src/ui/talents.ts`, `src/ui/relics.ts`, `src/client/hud.ts`.
- Art: `scripts/cutout.py` (B6, `pardoner-box`, `fx-flames`, `tex-confessional-wood`, `PATCH_FROM`, `CROPS`), `scripts/blender/gatekeeper.py` (trumpet, `pose_trumpet`), `assets/sprites/gatekeeper/atlas.*`, new `assets/items/{watcher-open,watcher-closed,judgment-seal,pardoner-box}.png`, `assets/textures/{fx-flames.png,tex-confessional-wood.jpg}`, `assets/items/confessional-grille.png`, `assets/art-src/{watcher-open,watcher-closed,judgment-seal}.png`; `src/client/gatekeeperView.ts`, `src/client/enemyAnim.ts`, `src/render/animAtlas.ts`, `src/client/fireView.ts`, `src/client/hazards.ts`, `src/client/talentClient.ts`, `src/client/shop.ts`, `src/client/advocate.ts`, `src/render/looks.ts` (`L_CONFESSIONAL`), `src/render/terrain.ts`, `src/render/scene.ts`, `src/render/textures.ts`.
- Tests: new `src/client/cueMap.test.ts` (7), `src/assets.manifest.test.ts` (3), `e2e/r08-presentation.spec.ts` (2); updated `src/audio/audio.test.ts`, `src/audio/recorded.test.ts`, `src/sim/shop.test.ts`, `src/client/enemyAnim.test.ts`, `src/render/looks.test.ts`, `e2e/dungeonChoices.spec.ts` (key, Bell and shop cues), `e2e/talents.spec.ts`.
- Docs: [r08.md](r08.md), this report, [asset-coverage.md](asset-coverage.md), [asset-manifest.md](asset-manifest.md), [audio-prompts.md](audio-prompts.md), [art-prompts.md](art-prompts.md), [implementation-decisions.md](implementation-decisions.md), [README.md](README.md), [development-workflow.md](development-workflow.md).

## Checks

All on Windows. No benchmark was requested or run.

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | passed at every stage |
| Unit suite without timing tests: `npx vitest run --pool=threads --exclude '**/*perf.test.ts'` | stage 1: 1,725 passed (137 files); stage 2: 1,775 (138); stage 3: 1,776 (138); final: **1,781 passed (139 files)** |
| Timing tests alone: `npx vitest run --pool=threads --reporter=verbose src/sim/perf.test.ts src/sim/hazards.perf.test.ts` | **2/2 passed** within the unchanged 8 ms limit; hazard simulation **4.603 ms/tick** (R07: 4.999) |
| `npm run build` | passed at every stage (inherited Vite configuration warnings remain) |
| Targeted e2e during the stages | `dungeonChoices` + `recorded-sound` **8/8** (stage 2); `talents` + `classTalents` **7/7** (stage 3); `gatekeeper` + `rogue-floor` + `r03-art` + `refiner` **11/11** (stage 4) |
| `npx playwright test --config playwright.hardware.config.ts e2e/r08-presentation.spec.ts` | art close-ups **passed** (final build); census **passed**: no voice refused in the crest or the Gatekeeper fight. Its first version waited for the trumpet transition and **timed out** (the bot never reached half health in 5 min); that step was removed (see *Limitations*) |
| E2E regression set (the R07 set plus `recorded-sound`, `refiner`, `r03-art`) on the stage 4–5 build | **56/57 passed** (23.4 min). The one failure, `lag.spec.ts` *Fallen guest*, saw 76% of its kills at once against the 80% threshold; rerun alone, `e2e/lag.spec.ts` **4/4 passed**. R8 changed no netcode; R07 recorded the same test failing once in the full set. Treat it as intermittent, not fixed |

The regression command: `npx playwright test --config playwright.hardware.config.ts e2e/gatekeeper.spec.ts e2e/dungeonChoices.spec.ts e2e/classTalents.spec.ts e2e/talents.spec.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/singleplayer.spec.ts e2e/controls.spec.ts e2e/weapon.spec.ts e2e/watchman.spec.ts e2e/commanders.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts e2e/lag.spec.ts e2e/recorded-sound.spec.ts e2e/refiner.spec.ts e2e/r03-art.spec.ts`.

**Found and fixed during verification:** the Betrayer's three alternatives also played the base ability's cue (the alternative check knew only nine of the twelve); the Watcher's red rim was hidden behind its opaque frame; the alms box stood at the Pardoner's feet; the census missed the mixer when it started after the game; the audio test fixture lacked the new counters.

**Inspected in the production client** (Playwright screenshots, 1280 × 720): the Pardoner from four sides with the box on the plinth; the cropped grille on the Confessional's wood walls; an open Watcher up close with its red ring, and two more at range; the Watchers opening grey. The trumpet frame was inspected only as the Blender render (all five directions), not in the game.

## Limitations and open items

- **Your listening is the R8 verdict.** Nothing here claims a sound is pleasant or tolerable; the census only measures how often each one plays. All 43 new cues are synthesized stand-ins in the existing palette.
- **The trumpet moment was not seen in the game.** The bot can't bring him to half health in a test's time and there's no dev shortcut for boss HP; the frame is rendered, unit-tested to show through the transition and checked in Blender only.
- **Phase 2 is not in the census** (Watchers' open/break cues, the transition, the defeat).
- `gatebreakerWall` has no host event, so a Gatebreaker charge stopped by a wall makes no sound of its own.
- The Confessional wood stretches about 1.8× vertically on the tallest wall bands; the grille is still the received painting (eyes included), not a separate Advocate.
- Optional, unchanged: S8 loops for the alternatives, S9 re-recordings, S10 voices, B11 icons.

## Asset requests

**Required: none.** Conditional on your listening, at most 20 files (Suno's monthly download cap): from the census, the likeliest are `dominionStep` (2 takes), `goldPickup` (3) and `abilityReady` (1), then the S7 Gatekeeper set. Name the sound that tires you and I'll write the exact request.

## Play this checkpoint

`npm run dev`, a disposable profile, *Recorded SFX* on (F8 compares with the synthesized set).

1. **A full run, any class, solo.** Which sound first gets irritating, and at what point?
2. **The Pardoner** (`?dev=1&map=rogue&seed=317434499&room=<pardoner>` or reach him): buy something, then try with too few halos. The refusal must never sound like the purchase.
3. **Key, chest, Bell, bargain, a Rite taken and passed:** can you tell each by ear, eyes off it?
4. **A crest** (`room=3`): can you still hear the Dominion's wind-up and a Watchman's aim through the gunfire?
5. **The Gatekeeper** (`room=10&edicts=5` for Watchers at once): do the eyes read as targets (red ring) or as closed and grey; is the Seal clearly the thing to shoot? Fight him to half health and tell me whether the raised trumpet reads as the 50% moment.
6. **The Confessional and the stall:** does the grille sit right on the wood, and does the box on the plinth read as his stall?
