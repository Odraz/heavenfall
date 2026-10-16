# R04 follow-up report: the Watchman

Status: **awaiting-human-play**, 2026-10-16, on `rogue` from `61b9dc5`. Implemented under Tomas's "Implement R04 follow-up: the Watchman" request, from the [brief](r04-watchman.md) and [rooms.md §6.4](rooms.md#64-the-watchman). All four stages are done: stages 1–3 make the rules, the network record and the look; stage 4 replaces the placeholder with a modeled atlas. It does not advance R05 or claim Gate C. Fun and fairness of the shot are your call after playing.

**Later change (2026-10-16, after your first look):** slightly more Watchmen with more HP: 1 per 24 Blessed (1 per 10 in ranged rooms; was 30 / 12), alive cap 5 / 7 at four players (was 4 / 6; solo stays 2 / 3), 80 HP (was 60). Rules 23 → 24. The numbers below describe the current values.

**Versions:** protocol 12 → **13**, rules 22 → **23**. No save schema change. Builds with different versions cannot join each other.

## What you can play

- From the second wave of a generated room, a few Blessed are Watchmen: a Blessed with a gold brimmed helmet, a short blue plume and the Clarion, a long ivory gun with a gold trumpet bell above its head. About 1 per 24 Blessed, 1 per 10 in ranged rooms; none in the first wave, in Cherub waves, in the crest or at the boss.
- A Watchman walks with the crowd until it can see you within 20 m, stops, levels the Clarion and shows a thin gold thread to you for 1 s with a rising brass note. Then it fires: 12 damage if nothing solid is between you, otherwise a spark on the cover. It reloads for 1.5 s.
- A stun, Discord's silence, a launch, Chains' pull or its death cancels the aim with no shot. One of Them hides the Betrayer from it. 80 HP.
- At most 5 Watchmen alive per room (7 in ranged rooms) at four players, 2 (3) solo; the rest wait and keep their wave open.

## Play it

1. Fixture: `npm run dev`, then `/?dev=1&map=watchman&class=fallen&seed=7` (Choir Loft geometry with its four nave pillars). Enter the room and clear wave 1 (dev key K kills everything). In wave 2, stand in the open and watch a thread, then step behind a pillar during the next aim: the shot sparks on the pillar. Dev key J removes only the Blessed. Push in and kill a Watchman; a queued one replaces it (solo, wave 2 has 4 and the cap is 3).
2. Generated run: `/?dev=1&map=rogue&class=betrayer&seed=317434499&build=marksman`; play a pure-Blessed room and a ranged room normally.
3. What to judge (from the brief): do you now move to cover or push instead of backing away? Can you always see who is shooting you? Is 12 every 2.5 s with up to 5 (7) at once too much or too little? Do the Watchmen read as a different enemy among the Blessed?

Use a disposable profile for dev runs.

## Stages and commits

| Stage | Commit | What |
|---|---|---|
| 1 Composition | `7842c95` | `WATCHMAN = 8` (60 HP, 0.35 × 1.8 m, 3.5 m/s, drawn 1.15×); `convertWatchmen` in stamping (TP and XP sums unchanged, XP's fifth entry); squad placement on unrestricted points with the alive cap and queue; halo weight 3, mote 35%; fixture `map=watchman`; rules 23; pinned hashes move in wave data only (undoing the conversion reproduces the old hashes). |
| 2 The shot | `68fc0cf` | `src/sim/watchmen.ts`: sight checks every 0.5 s, the locked 1 s aim, one terrain trace (30 m reach) at the fire tick, damage through `damagePlayer`, cancellation and target loss, taunt, One of Them (`talents.caster`), ranged item chance. |
| 3 Network, look, bots | `288cac7` | The 19-byte record (`src/net/watchmanCodec.ts`) in snapshots and `floorSync`, at most 8, checked against the live Watchman incarnation; protocol 13; the client projection with once-per-counter shots; thread, flash, tracer, spark; synthesized `watchmanAim`/`watchmanShot`; placeholder rod and dev label; bot priority; `e2e/watchman.spec.ts`. |
| 4 Art | this commit | `scripts/blender/watchman.py` (the Blessed's body and rig, helmet, plume, Clarion, IK hands) rendered to `assets/sprites/watchman/` (8 directions, 240 frames, 4096 × 3072); loaded only on maps with Watchmen; `cast` and `reload` frame timing in the animator; the placeholder rod and label only without the atlas. |

## Decisions made while implementing

- **A Chains pull cancels the aim.** rooms.md lists launch, stun, silence, death and cleanup. A pulled Watchman is not updated during the 0.3 s pull, so its planned fire tick would otherwise be wrong; canceling it gives the Binder the counter the brief already names ("Chains pulls a Watchman out of the crowd").
- **Bell waves:** there is no Bell encounter in the simulation yet, so nothing calls the conversion for one. `convertWatchmen` is exported from `src/gen/stamp.ts` for the Bell to use when it lands.
- **Animations:** the brief's aim, fire and reload are the atlas's `cast` (4 aim frames over 1 s, then 2 fire frames) and `reload` (4 frames over 0.8 s), matching the animator's existing cast contract.
- **Spark on cover** is shown when the host's end point is more than 0.75 m from the target as drawn; the host puts the end at the body center on a hit.
- **Sight and range** are measured from the muzzle (feet + 1.5 m) to the target's body center. Dev-placed Watchmen without a room skip the same-room rule.
- **One of Them** uses the general wading reach for a Watchman (player radius + 0.35 + 0.45 = 1.15 m), not the Blessed's 1.2 m.
- **Defaults left for play (brief):** Mirror Ward doesn't stop the shot; no screen-edge arrow.

## Checks

All on Windows. No benchmark was requested or run.

- `npm run typecheck`: passed after each stage.
- Complete unit suite, functional part: `npx vitest run --pool=threads --exclude '**/*perf.test.ts'`. Stage 1: 1,232 passed (112 files). Stage 2: 1,245 passed (112). Stage 3: 1,255 passed (113). Stage 4: **1,258 passed (113 files)**, 80 s.
- Timing checks alone, without competing workers: `npx vitest run --pool=threads --reporter=verbose src/sim/perf.test.ts src/sim/hazards.perf.test.ts`. Passed after every stage; final: normal simulation within the unchanged 8 ms limit, hazard simulation **4.730 ms/tick** (limit 8).
- `npm run build`: passed after every stage (inherited Vite configuration warnings remain).
- Stage 3 browser checks, production build, D3D11: `npx playwright test --config playwright.hardware.config.ts e2e/watchman.spec.ts` — 1/1 passed (32 s): in the fixture, a shot at a player in the open cost exactly one shot's damage (120 → 108 HP), and a shot whose aim the player escaped behind a pillar ended on the pillar and cost nothing. Then `npx playwright test --config playwright.hardware.config.ts e2e/multiplayer.spec.ts e2e/commanders.spec.ts e2e/rogue-floor.spec.ts` — **12/12 passed** (13.7 min), including real PeerJS late joins and the solo autopilot clearing the pinned generated floor (9.6 min).
- Stage 4 browser checks after rebuilding: `npx playwright test --config playwright.hardware.config.ts e2e/watchman.spec.ts e2e/commanders.spec.ts e2e/rogue-floor.spec.ts --grep-invert "solo autopilot"` — **11/11 passed** (3.1 min). The autopilot was not rerun for stage 4, which changes only sprites, animation timing and the placeholder.
- Visual check: the fixture in the dev server with the new atlas (helmeted Watchmen with upright Clarions, an aiming one, gold threads toward the player); Blender turnaround, `cast` and `reload` sheets in all directions. Not visually checked: a generated room, and four-player co-op.

New tests: `src/gen/watchmen.test.ts` (both rooms.md examples, thresholds, first wave/Cherub/crest exclusions, every generated wave's TP and XP), `src/sim/watchman.test.ts` (stats, the 2/3/4/6 caps with the queue holding the wave open, the shot, cover, reach, each cancellation, target death and room exit, shield, invulnerability, Fallen mitigation, nearest and tie, taunt, One of Them, drop constants, snapshot records while a pull skips the update), protocol round trip and rejections (ninth record, bad phase, expired aim, stale incarnation, non-Watchman slot), `src/client/watchmen.test.ts` (rejoin from `fireTick`, thread width and clipping, once-per-counter shots, the note stopping on cancel, bot priority, atlas loading and frame tables, animator timing), `e2e/watchman.spec.ts`.

## Not done / for your playtest

- **Recorded sounds:** `watchmanAim` and `watchmanShot` play the synthesized fallbacks. Choose recordings from the [audio prompts](audio-prompts.md#watchmanaim--the-watchman-aims--keep-1--r04-follow-up) when you want them.
- **Lag:** shots trace the host's accepted position; judge in co-op whether reaching cover at the last moment feels fair.
- **Look:** the Clarion's bell is about 1.9 m in front of the Watchman when levelled, and the thread starts there. Judge whether the Watchmen read among the Blessed at play distance.
