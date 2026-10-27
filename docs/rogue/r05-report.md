# R05 report: all four class catalogs

Status: **awaiting-human-play**, 2026-10-18, on `rogue` from `ba9dc5d`. Implemented under Tomas's "I have provided art of remaining talents for R05. Process them and Implement R05" request. The brief was still marked *planned* and Gate C (your R4 verdict) is not closed; both are recorded in [implementation-decisions.md](implementation-decisions.md). The contracts as built and the 84-row coverage map are in [r05.md](r05.md#as-implemented-2026-10-18).

**Versions:** protocol 13 → **14**, rules 24 → **25**. Builds with different versions cannot join each other. No save schema change: a profile character still saves `talents`, `q`, `e`, and every class's saved build is now checked against its own catalog.

## What you can play

Every class has its three trees (21 nodes), three alternative abilities and three capstones on the same resolver as the Betrayer. Learning and respec work as in R4 (the Lobby's **Talents** button on each class card, or the Advocate in the Confessional); a Rite page now opens an offer for every class instead of paying 24 halos.

### Quick builds (development runs only)

`http://localhost:5173/?dev=1&map=rogue&class=<class>&seed=317434499&god=1&build=<name>`. Dev key **B** cycles the builds of your class (and `base`), **R** opens a Rite offer, **T** opens the Talents view with free points, **G** god mode, **K** kills everything.

| Class | `build=` | Plan |
|---|---|---|
| Fallen | `anvil` | The Walls of Dis capstone (Red Iron, Weight of Sin, Unbowed, Gatebreaker, Underfoot, Wrath of Dis) + Heave, As We Fell, Wormwood. E = **Gatebreaker**. |
| Fallen | `firewalker` | All seven Burning Sand nodes + Red Iron, Unbowed. E = **Rain of Fire**. |
| Fallen | `thrower` | The War in Heaven capstone + Red Iron, Unbowed, Brimstone Tread. Q = **Cast Out** (no taunt). |
| Fallen | `fallenSpread` | 3 + 3 + 3 on the base kit. |
| Heretic | `physician` | Forbidden Physic capstone + Kindling, Pitch, Walk in the Smoke. E = **Bread of Angels**. |
| Heretic | `pyre` | The Burning Tombs capstone + Cunning Folk, Exorcism, Lazarus. E = **Trial by Fire**. |
| Heretic | `martyr` | Martyrdom capstone + Kindling, Cunning Folk, Lazarus. Q = **Cloud of Witnesses**. |
| Heretic | `hereticSpread` | 3 + 3 + 3 on the base kit (In Both Kinds needs two allies to fork). |
| Binder | `keeper` | Keeper of the Well capstone + Whirl, Iron Stride, Fettered Hands. E = **the Well**. |
| Binder | `breaker` | Breaker of Giants capstone + Barbed Rounds, Frost, Procession. Q = **Ring of the Giants**. |
| Binder | `warden` | Warden of the Boundary capstone + Iron Stride, Fettered Hands, Chain Holds. Q = **the Boundary Chain**. |
| Binder | `binderSpread` | 3 + 3 + 3 on the base kit. |

The Betrayer's `marksman`, `saboteur`, `sicarius`, `spread` and `bank` are unchanged.

### How the new abilities are used

- **Gatebreaker (E):** hold E to charge at 15 m/s, steering with the mouse (at most 180°/s); release to stop (0.3–1.2 s). The 1 m lane bursts, the band beside it is flung into the air. You can fire while charging.
- **Rain of Fire (E):** hold E to see the 5 m ring (red where it can't go), release to call the fire; it lands 0.5 s later for 6 s.
- **Cast Out (Q):** wings throw the 90° cone in front of you 6 m away.
- **Bread of Angels (E):** for 6 s, kills within 8 m drop heal motes, at most six; a green ring follows you.
- **Trial by Fire (E):** for 4 s the floor burns 1.5 m around where you walk.
- **Cloud of Witnesses (Q):** a 5 m incense cloud on the ally you aim at (40 m), or on you, for 6 s.
- **The Well of the Giants (E):** a pit where you aim (3–20 m) drags ground enemies within 7 m toward it for 5 s.
- **Ring of the Giants (Q):** everything within 7 m is dragged into a bound ring 2.5 m around you.
- **The Boundary Chain (Q):** a 12 m red-hot chain across your aim (4–20 m) binds each ground enemy that steps on it, for 8 s.

## Stages and commits

| Stage | Commit | What |
|---|---|---|
| 1 Catalogs and resolver | `6f0e061` | 63 nodes, 9 alternatives, tree names, numbers, quick builds per class; Son of the Morning's mixed Q/E targets; the producibility closure and the new Rite needs; assigned-ability capstones; Rite context with allies' talents, survivors and flyers. Art: 54 talent icons and 9 ability icons at 128 px. |
| 2 Shared systems and the Fallen | `59002e0` | Launches with landing records; per-owner floor fire; the Fallen's 21 nodes and Gatebreaker, Rain of Fire, Cast Out; client charge, aim ring, drawn fire, wading rules, launched arcs. Protocol 14, rules 25. |
| 3 The Heretic Saint | `745a969` | Clouds move into the Heretic module (radius, wearer, root, published areas); the 21 nodes and Bread of Angels, Trial by Fire, Cloud of Witnesses; incense drawn from the host's areas. |
| 4 The Binder | `66a3839` | Own bind sources with ceilings; the 21 nodes and the Well, Ring of the Giants, the Boundary Chain; Chain Gun and Scourge as roots; R5 areas in the Rite context. |
| 5 Presentation, e2e, docs | this commit | Wrath of Dis fill on the HP bar, the debug hook's fire/area counts, `e2e/classTalents.spec.ts`, docs. |

## Changed files

- Content and resolver: `src/data/talents.ts`, `src/sim/build.ts`, `src/sim/rites.ts`.
- Simulation: new `src/sim/floorFire.ts`, `src/sim/launches.ts`, `src/sim/talentsFallen.ts`, `src/sim/talentsHeretic.ts`, `src/sim/talentsBinder.ts`; hooks in `src/sim/talents.ts`, `src/sim/sim.ts`, `src/sim/pickups.ts`, `src/sim/rewards.ts`, `src/sim/talentGeometry.ts`.
- Network: `src/net/messages.ts` (`fire`, `launched`, `meter` events, R5 area kinds and effect kinds, `floorSync.fires`), `src/net/version.ts`.
- Client: new `src/client/fireView.ts`; `src/client/talentClient.ts`, `src/client/game.ts`, `src/client/localPlayer.ts`, `src/client/wading.ts`, `src/client/sounds.ts`, `src/client/hud.ts`, `src/render/vfx.ts`, `src/render/incense.ts`, `src/debug.ts`, `src/style.css`.
- Assets: `assets/sprites/talent-{fallen,heretic,binder}-*.png` (54), `assets/sprites/icon-{gatebreaker,rain-of-fire,cast-out,bread-of-angels,trial-by-fire,cloud-of-witnesses,well-of-giants,ring-of-giants,boundary-chain}.png`; sources `assets/art-src/talent-*.jfif` (54, `alent-fallen-c-2a.jfif` renamed).
- Tests: new `src/sim/buildClasses.test.ts`, `src/sim/talentsFallen.test.ts`, `src/sim/talentsHeretic.test.ts`, `src/sim/talentsBinder.test.ts`, `e2e/classTalents.spec.ts`; additions to `src/client/wading.test.ts`, `src/ui/talentIcons.test.ts`; updated `src/sim/build.test.ts`, `src/sim/shop.test.ts`, `src/sim/talents.test.ts`, `src/net/buildFingerprint.test.ts`.
- Docs: [r05.md](r05.md), this report, [implementation-decisions.md](implementation-decisions.md), [asset-manifest.md](asset-manifest.md), [game.md](game.md) §6.4 and the held/targeted transport note, [development-workflow.md](development-workflow.md).

## Checks

All on Windows. No benchmark was requested or run.

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | passed at every stage |
| Unit suite without timing tests: `npx vitest run --pool=threads --exclude '**/*perf.test.ts'` | stage 1: 1,420 passed (114 files); stage 2: 1,446 (115); stage 3: 1,468 (116); stage 4 and final: **1,491 passed (117 files)** |
| Timing tests alone: `npx vitest run --pool=threads --reporter=verbose src/sim/perf.test.ts src/sim/hazards.perf.test.ts` | **2/2 passed**: normal simulation within the unchanged 8 ms limit; hazard simulation **4.876 ms/tick** (limit 8; R04 follow-up measured 4.730) |
| `npm run build` | passed at every stage (inherited Vite configuration warnings remain) |
| `npx playwright test --config playwright.hardware.config.ts e2e/classTalents.spec.ts e2e/talents.spec.ts` | **7/7 passed** (41 s): each new class's quick build shows its alternative icons; the Fallen's 21 tree icons and three tree names; Blasphemer's Ring fire reaches the client and goes out; Cloud of Witnesses' cloud area and the Boundary Chain area arrive; Rite offers for the Heretic (Pass) and the Binder (Take, shown as held in T); the four R4 talent flows unchanged |
| `npx playwright test --config playwright.hardware.config.ts e2e/classTalents.spec.ts e2e/talents.spec.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/singleplayer.spec.ts e2e/controls.spec.ts e2e/weapon.spec.ts e2e/watchman.spec.ts e2e/commanders.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts` | **39/39 passed** (16.3 min), including four-client multiplayer, PeerJS late joins, profile reconnect, the singleplayer smoke for all four classes and the solo autopilot clearing the pinned generated floor to the boss (9.7 min). Run on the stage-4 code plus stage 5's HUD/debug changes; the final client edit (Gatebreaker's self-ended charge also sends its release) was rebuilt and checked with the two talent specs again: **7/7 passed** |

New unit coverage: every one of the 63 rows is legal learned and effective from its smallest opening, and a valid Rite with its gate held in a full party (`buildClasses.test.ts`); composition tables, kill-discharge lists, quick builds, Rite filters for own fire/incense/launch, pitch, irons, two allies, flyers, assigned capstones; the Whirl-for-Whip substitution that opens Ring of the Giants (classes-binder.md §6.1). In the simulation: every node's effect (`talentsFallen.test.ts` 26, `talentsHeretic.test.ts` 22, `talentsBinder.test.ts` 22), fire cap, pulse and sync, own bind sources; the base shotgun, censer clouds and Chains keep their existing tests green.

Inspected in the in-app browser (dev server): the Fallen firewalker's Rain of Fire icon in E, Blasphemer's Ring and Rain of Fire fire on the marble (after switching the flames from additive to normal blending, which had washed out white), the Heretic martyr's Cloud of Witnesses with pillar puffs, the Binder keeper's Well 20 m ahead; no console errors. The pane cannot fire weapons without pointer lock, so censers, shotgun payloads and the Gatebreaker charge on screen rely on unit tests and need your play.

## Limitations and open items

- **Your play is the R5 verdict**, and Gate C (R4) is still open. Nothing here claims a build is fun or balanced; the catalogs' own tuning notes (A Third of the Stars' crash radius, All of Tartarus with a Field, the Wind's 4 s delay) are untouched.
- **Presentation is coded:** flames per burning cell, floor rings for the Rain circle, Well, frost, Bread and cloud reach, a red-hot bar for the Boundary, beams and rings for the node effects, a red-iron Wrath fill on the HP bar. No body glow for Wrath, no orbiting Bread sparks, no wing art for Cast Out. Sounds for the alternatives are synthesized stand-ins (S6/S8 recordings outstanding). The 63 icons are integrated and await your in-game approval.
- **Deviations recorded in the decisions log:** no new reliable aimed-cast request (Gatebreaker's release is the next press; the Well and Boundary cast on the press without a hold preview); Bread harvests root kills only (not direct item kills); the Binder's kill bundles run on its own roots only; class fire never touches the Gatekeeper; the Gatebreaker turn limit is enforced by the client only.
- **Unobserved combinations:** four-player mixed parties with several talent-heavy kits at once, and the talent-heavy tick cost, are not measured. Bots still play the base kit.

## Play this checkpoint

`npm run dev`, then the quick builds above (or a fresh normal profile for progression).

1. **Fallen, `anvil` then `firewalker`:** charge through a crowd with Gatebreaker and let Underfoot and Wrath work while you stand in it; then rain fire on the approach and Blasphemy the crowd through it. Which one would you take into the next room, and why?
2. **Heretic, `physician` then `martyr`:** pop Bread before a big clear and collect the motes; then wear Cloud of Witnesses (or put it on a teammate) and see whether the moving incense changes where you stand.
3. **Binder, `keeper` then `warden`:** open the Well on the chase and Chains the knot; then lay the Boundary across a door and fire down the bound line. Did you miss Discord's silence?
4. **A Rite on a fresh character of each class:** take the page after the first fight and say whether the card changed your next room.
5. **Mixed party (if you can):** a Fallen's launches with a Binder's Where They Fall, a Heretic's clouds over the Fallen's fire with Pyre.

Tell me for each class which two builds you'd pick between and why, and whether one option makes another irrelevant.
