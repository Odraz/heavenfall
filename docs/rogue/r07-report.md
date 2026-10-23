# R07 report: the authored Gatekeeper

Status: **awaiting-human-play**, 2026-10-23, on `rogue` from `4bfae4d`. Implemented under Tomas's "Implement R07" request ("fun, intense, engaging, challenging, fair with teamwork elements … smooth during multiplayer sessions") without a separate preparation pass, as R6 was; the contracts as built are in [r07.md](r07.md#as-implemented-2026-10-23) and the decisions in [implementation-decisions.md](implementation-decisions.md).

**Versions:** protocol 20 → **21**, rules 27 → **28**. Builds with different versions cannot join each other. No save schema change.

## What you can play

The Pearly Gates now end in the authored fight of [bosses.md](bosses.md) §3, replacing the inherited fixture:

- **The cycle.** Every 28 s from the seal: the Host pours through the Gate's bars (c 1), he **calls one of you** (c 4), **tolls** twice (c 8, c 15), the drone of **Judgment** starts quietly at c 22 and he casts it at c 25. Orb Volleys (1 s wind-up now) fill the gaps when he sees his target.
- **Judgment** kills whoever sees his eye at the end of the cast, through Brimstone Hide and shields; only invulnerability saves. Break it with Discord or 4.5% of his max HP during the cast: the cast bar's **red fill** is the damage toward the break. From c 22 a **crosshair eye** opens while he can see you.
- **The Toll:** a gold band fills round the dais foot, then a 0.5 m gold ring rolls over every floor up to the +1 m terrace at 9.5 m/s. **Jump it** (35 damage if your feet are on the floor), or stand on the +2 m gallery. A whoosh plays when it is a second away.
- **Called to the Gate:** a gold ring under the target, then they are lifted 1.5 m and dragged toward the dais for 6 s with a **padlock Seal** hanging on a chain of light 1.5 m in front of them (150 HP per living player). Everyone shoots the Seal; the held player can aim, fire and use non-movement abilities. Unbroken, he takes his due: **+10% of his HP**, the held player unharmed. Teammates' party frames show a gold rim and "… is called: shoot the seal!".
- **At 50%** he lifts the first trumpet (it stays silent): 1.5 s pale-grey invulnerable, a feather burst, every cast, hold and ring canceled, and the bar becomes **The Gatekeeper II**. From then on, at c 17, **3 + living players Watchers** open around the hall (grey for 2 s, then a gold eye with a red rim, 60 HP). At Judgment's end every eye within 24 m that sees you deals **half your max HP** if he doesn't see you himself, even when you broke his cast. Gold threads run from each eye that sees you. Each destroyed eye tears its share of **8% of his max HP** away along a red tether.
- **The completion gate:** he can't die before a Call and a phase-2 eye episode have resolved; his last hit waits at 1 HP with *Break the seals of Judgment* under the bar.
- **Victory** keeps R6's settlement: the line *The first trumpet is silent. Six to go.*, the Stair of light, post-win shopping and the bounded exit.

HP is 52 000 × f(P) at the seal: 15 600 solo, 22 100 with one human and one bot, 28 600 for two humans, 52 000 for four.

### Multiplayer smoothness

Snapshots reach other players only 10 times a second, so nothing in this fight follows them step by step:

- **The ring is drawn from its impact tick** at your screen's drawn time, and the host sweeps **each player against the ring their own screen showed**, so a jump you saw clear it clears it on the host too.
- **Judgment and the Watchers' gaze resolve in each player's own view time** (at most 0.4 s late): if you ducked behind a pillar as the cast ended on your screen, you are safe.
- **The held player's own screen predicts the drag** with the host's own collision sweep, caught up by the event's delay; the release lands exactly where the host has you.
- **The Seal is shot with lag compensation** like every enemy, and a volley's globes hurt one player at most once.
- The Seal, the Watchers and their flags are ordinary enemy records; everything else is 25 bytes of the snapshot header, so a client that joins or reconnects mid-fight sees the same state at once.

### Development shortcuts (runs without saved progression)

`http://localhost:5173/?dev=1&map=rogue&seed=317434499&room=10&class=<class>` starts in the Gatekeeper's room (seed 317434499: the boss is room **10**). Add `god=1` to watch without dying, `edicts=5` (the Edict of the Trumpet) to get the Watchers from the first cycle, `build=<name>` or `relics=a,b` as before.

**Co-op setup (new):** the host opens `http://<host>:5173/?dev=1&menu=1&map=rogue&seed=317434499&room=10`, hosts through Multiplayer, and friends join normally (`/?dev=1&menu=1`, or the invite link). Every client starts at the boss room's entry; the run is disposable.

## Stages and commits

| Stage | Commit | What |
|---|---|---|
| 1–3 Host encounter | `06aa316` | `src/data/gatekeeper.ts` (cycle, numbers, ring, drag, Seal geometry), `src/sim/gatekeeperFight.ts` (schedule, cast slot, transition, Toll, Call/Seal/hold, Watchers/tethers, Host, completion gate, view-time resolution, volley ledger, mote cap); `BOSS_PART`; protocol 21 |
| 4–5 Client, bots, setups | `b90b029` | `src/client/gatekeeperView.ts` (ring, parts, chain, threads, crosshair eye), held prediction in `LocalPlayer`, HUD bar/labels/cues, sounds, bot rules, dev co-op `seed`/`room`, `e2e/gatekeeper.spec.ts` |
| Polish, docs | final commit | Parts excluded from every crowd rule and target pick, report and briefs |

## Changed files

- Content and rules: new `src/data/gatekeeper.ts`; `src/data/enemies.ts` (`BOSS_PART`, `isBossBody`, 52 000 HP).
- Simulation: new `src/sim/gatekeeperFight.ts`; `src/sim/sim.ts`, `src/sim/rewards.ts`, `src/sim/lateShots.ts`, `src/sim/worker.ts`, `src/sim/workerMessages.ts`, `src/sim/talents.ts`, `src/sim/talentsBinder.ts`, `src/sim/talentsFallen.ts`, `src/sim/talentsHeretic.ts`, `src/sim/relics.ts`, `src/sim/consumables.ts`, `src/sim/launches.ts`.
- Network: `src/net/protocol.ts`, `src/net/messages.ts`, `src/net/version.ts`, `src/net/lobby.ts`.
- Client and UI: new `src/client/gatekeeperView.ts`; `src/client/game.ts`, `src/client/localPlayer.ts`, `src/client/hud.ts`, `src/client/partyFrames.ts`, `src/client/bot.ts`, `src/client/sounds.ts`, `src/client/rooms.ts`, `src/client/enemyAnim.ts`, `src/client/killPredict.ts`, `src/client/hostSession.ts`, `src/audio/sfx.ts`, `src/debug.ts`, `src/main.ts`, `src/style.css`.
- Tests: new `src/sim/gatekeeper.test.ts` (rewritten, 20), `src/client/gatekeeperView.test.ts` (8), `e2e/gatekeeper.spec.ts` (3); updated `src/sim/deeds.test.ts`, `victory.test.ts`, `workerSync.test.ts`, `bench.test.ts`, `attacks.test.ts`, `combat.test.ts`, `testutil/sims.ts`, `src/net/protocol.test.ts`, `buildFingerprint.test.ts`, `lobby.test.ts`, `src/client/enemyAnim.test.ts`, `rooms.test.ts`, `e2e/rogue-floor.spec.ts`.
- Docs: [r07.md](r07.md), this report, [implementation-decisions.md](implementation-decisions.md), [asset-manifest.md](asset-manifest.md), [README.md](README.md), [implementation.md](implementation.md).

## Checks

All on Windows. No benchmark was requested or run.

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | passed at every stage |
| Unit suite without timing tests: `npx vitest run --pool=threads --exclude '**/*perf.test.ts'` | stage 1–3: 1,703 passed (136 files); stage 4–5: 1,723 (137); final: **1,724 passed (137 files)**, including the bot autopilot clearing the pinned floors through the new fight to victory |
| Timing tests alone: `npx vitest run --pool=threads --reporter=verbose src/sim/perf.test.ts src/sim/hazards.perf.test.ts` | **2/2 passed** within the unchanged 8 ms limit; hazard simulation **4.999 ms/tick** (R06: 4.833) |
| `npm run build` | passed at every stage (inherited Vite configuration warnings remain) |
| `npx playwright test --config playwright.hardware.config.ts e2e/gatekeeper.spec.ts` on the final build | **3/3 passed**: solo seal and HP, a Call holding you with the drag glided every frame (largest frame step under 0.15 m, 1.5–3.6 m in 1.2 s), the Seal 1.3 m ahead toward him, the Toll's label and ring, the crosshair eye at c 22, Judgment's label; co-op over real PeerJS: two-human HP on both screens, the held player's own screen glides, the partner's party frame shows the padlock rim and the Seal, both screens agree on the ring's impact tick; the Trumpet's four eyes in the first cycle |
| E2E regression set (command below) | **50/51 passed** (22.6 min). The one failure, `lag.spec.ts` (Fallen guest), ran while a unit run competed for the CPU; rerun alone: `e2e/lag.spec.ts` **4/4 passed** |

The regression set: `npx playwright test --config playwright.hardware.config.ts e2e/gatekeeper.spec.ts e2e/dungeonChoices.spec.ts e2e/classTalents.spec.ts e2e/talents.spec.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/singleplayer.spec.ts e2e/controls.spec.ts e2e/weapon.spec.ts e2e/watchman.spec.ts e2e/commanders.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts e2e/lag.spec.ts`. It ran on the stage 4–5 build; the polish commit changed only the simulation's crowd exclusions, covered by the unit suite and the final `gatekeeper.spec.ts` run.

**Found and fixed during verification:** an invulnerable player still got a *judged* event; a second Toll was pushed 0.4 s late; the boss cues reused Judgment's 54 px banner and were cut off at 640 px; the old *Inherited fight fixture* room line; the held player's own chain ran into the camera as a bright strip; the ring's additive gold washed out to white on the marble; co-op dev hosts ignored `room=`.

**Inspected in the production client** (Playwright screenshots at 1280 × 720 and 640 × 360): the Seal in front of the held player with the chain from his keys; the ring rolling across the court with the Host behind it; *The Gatekeeper takes his due*; an open Watcher and its gold thread; the cast labels and cues. No console errors.

## Limitations and open items

- **Your play is the R7 verdict.** Nothing here claims the fight is balanced, fun or readable over a full crowd; the numbers are bosses.md's. The fight-length table (§3.4.2) is still a paper estimate; **the Heretic Saint's solo duration has not been measured** in the encounter (see the checklist).
- **Art and sound are stand-ins:** the Watchers and the Seal are coded sprites (B6 outstanding), the Toll reuses his Judgment pose and the Call his Volley wind-up until the A2 poses are cut, and the ten new cues are synthesized (S7 outstanding). The first trumpet is not drawn; the transition is the feather burst and the `II`.
- **Both boss parts share one shot cylinder** (0.6 m × 1.2 m, the Watcher's), so the Seal is a slightly larger target than bosses.md's 0.5 × 1.0 m.
- **Bots** jump the ring, take Judgment cover from c 22, and shoot Seals and eyes that threaten them or a human; the Fallen bot does not yet leap to a held ally with Falling Star.
- **Unobserved:** four humans in the fight, a held player's drag over the terrace or gallery edges, the Watcher relocation on rotated Gates other than the pinned floor's, and the tick cost of a full Host with seven eyes at four players.

## Play this checkpoint

`npm run dev`, then a disposable profile for full runs, or the shortcuts above for quick fights.

1. **Fresh solo, each class.** `room=10` with `class=fallen`, `heretic`, `binder`, `betrayer` (no `god`). Note the clear time; for the **Heretic Saint** tell me if it runs past five minutes and where the time went (eyes out of censer reach, Calls, hiding).
2. **The first Judgment.** Did the pre-warning at c 22 give you time to reach cover, and did the crosshair eye tell you you were hidden?
3. **The Toll.** Did you see the ring coming and jump it, on your screen as the game counted it? Try it on the terrace and from the gallery.
4. **Called to the Gate, co-op.** With a friend (co-op setup above): when one of you is called, did the other notice and shoot the Seal in time? Which teammate action changed your decision?
5. **Phase 2.** Which eye did you shoot first, and did the threads make it clear which ones saw you?
6. **Where it gets repetitive.** Tell me the cycle you started to feel it repeat, and which warning was unclear.
