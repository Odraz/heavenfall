# R04 report: the first complete build loop

Status: **awaiting-human-play (Gate C)**, 2026-10-16, on `rogue` from `9bae8f8`. Tomas's "Implement R04" (2026-10-16) authorizes this milestone, with two additions: quick builds for development testing, and slightly faster XP. Nothing is committed yet; the existing edit to `docs/rogue/audio-prompts.md` is outside this work.

## What you can play

The Betrayer has all three trees (21 nodes), its three alternative abilities and three capstones on one resolver. A level-up says `Level N — learn it at the Confessional`. Points are learned and reset in the Lobby (the **Talents** button on the Betrayer's class card) or at the Advocate (F at the grille in the Confessional). The first required-route fight's page and every other Rite page open a two-card Rite offer: take one, Pass, or press Esc and reopen it later with F. A Rite can trade a learned effect for the run, and its card names what you give up. Rites vanish at the run's end; Results lists them. The other three classes keep their base kits until R5, and their Rite pages still pay 24 halos.

XP is paid × 1.5 (game.md §9.1), so a first full clear reaches about level 4–5 instead of 3–4.

### Quick builds for testing (development runs only)

Open `http://localhost:5173/?dev=1&map=rogue&class=betrayer&seed=317434499&god=1&build=<name>`:

| `build=` | Plan |
|---|---|
| `marksman` | **Plan 1, Long Watch marksman:** Judecca, Halt and the Lame, Informer, Judas Coin (Q), Glancing Silver, From Hand to Hand + Through the Throng, One of Them, Long Knife. Gives up Field of Blood for three aimed lines. |
| `saboteur` | **Plan 2, Akeldama saboteur:** Nail, Thrown Silver, Blood Money, Broken Vessel, Silver Wire (E), Potter's Field + Glancing Silver, Informer, Through the Throng. Gives up Shadowstep's escape for a held crowd. |
| `sicarius` | Sicarius blade-dancer: B6 with The Way Back (E) + Judecca, Halt, Informer. |
| `spread` | 3 + 3 + 3, no capstone, Field and Shadowstep kept. |
| `bank` | Glancing Silver + The Nail only (the Delivery + Payload composition). |
| `base` | The base kit. |

In a development run: **B** cycles these builds (and clears held Rites), **R** opens a Rite offer at once, **T** opens the Talents view anywhere with free points, **G** god mode, **K** kills everything. None of these work in a run that saves progression.

## Changed files

- Content and resolver: `src/data/talents.ts` (catalog, trees, alternatives, numbers, quick builds), `src/sim/build.ts` (learned/run legality, effective kit, substitution, dormancy, discharge cap, Rite checks, draw, respec draft), `src/sim/talentGeometry.ts` (Way Back path, Thrown Silver landing, coin spot, wire ends, glance).
- Simulation: `src/sim/talents.ts` (roots, kill bundles, all node effects, coins/wires/traps/shadows, One of Them, A Thousand Years), `src/sim/rites.ts` (offers, Pass, fallback, cap), hooks in `src/sim/sim.ts`, `src/sim/combat.ts` (half-cost targets), `src/sim/hazards.ts`, `src/sim/rewards.ts` (pages → offers, XP × 1.5), `src/sim/worker.ts`, `src/sim/workerMessages.ts`.
- Network and saving: `src/net/messages.ts` (kit, talent effects/areas, Way Back, Recoil, hidden, Rite offers; `rite`/`advocate` requests), `src/net/runRecords.ts`, `src/net/version.ts` (protocol 12, rules 21), `src/profile/model.ts` (keeps legal learned builds), `src/profile/lifecycle.ts` (saves Advocate edits).
- Client: `src/client/talentClient.ts`, `src/client/advocate.ts`, `src/client/game.ts`, `src/client/hud.ts`, `src/client/localPlayer.ts`, `src/client/sounds.ts`, `src/client/rooms.ts`, `src/client/hostSession.ts`, `src/ui/talents.ts`, `src/ui/profiles.ts`, `src/ui/results.ts`, `src/style.css`, `src/params.ts`, `src/main.ts`, `src/data/classes.ts` (hint lines).
- Assets: `assets/sprites/icon-judas-coin.png` (inner frame cropped), `icon-way-back.png`, `icon-silver-wire.png`, `assets/items/confessional-grille.png`.
- Tests: `src/sim/build.test.ts`, `src/sim/talents.test.ts`, `e2e/talents.spec.ts`, additions to `src/profile/profile.test.ts` and `lifecycle.test.ts`; updated XP, version and Confessional-label expectations.
- Docs: this report, [r04.md](r04.md), [game.md](game.md) §6.4/§9.1, [implementation-decisions.md](implementation-decisions.md), [asset-manifest.md](asset-manifest.md).

## Contracts as built

- **Saved versus temporary.** A profile character saves `talents`, `q`, `e`. A save that fails the learned check (unknown node, gate, points for its XP, channel conflict, third kill trigger, unowned ability) resets that character to its base kit and keeps its XP. Rites, suppression and offers live only in the host's run state.
- **Learned legality** uses learned nodes alone: points ≤ min(level − 1, 9), tier gates over distinct strictly lower-tier nodes, one capstone, one augment per channel on intersecting targets even while unassigned, at most two kill-discharge nodes, Q/E from base or owned abilities. **Run legality** adds Rites: their gates over the combined ownership, no two Rites in one channel, one capstone overall, the discharge cap on the effective kit. A respec that breaks a Rite's gate is refused (`A Rite needs this node`).
- **Effective kit.** Q/E augments of an unassigned ability and Potter's Field without Field are dormant; a Rite augment suppresses the learned augment in its own resolved channel only. The host broadcasts each player's kit; HUD icons, cooldowns, hints and Informer outlines come from it.
- **Rite offers.** Cards are drawn from `mulberry32(fmix32(simSeed ^ offerId ^ playerOfferKey))`, with run-global offer ids and admission ordinals kept across reconnects. Usefulness is checked on the proposed kit after substitution (Halt needs a producible slow, Broken Vessel a bind, Behind His Back a living ally with Blasphemy, Known Ground a remaining hazard or blast prop, Potter's Field an assigned Field). Cards stay fixed; each is rechecked after every accepted build change and shown disabled with its reason. Pass settles with nothing; a free page at the cap or with no eligible node pays 6 halos once. Commits are refused while a room is sealed and the offer is kept. A pending offer holds the exit like an unclaimed page.
- **Roots and kill bundles.** Each shot, dash, return and cast is a root with a shared hit set (coin branches and glances never hit one enemy twice). Each active kill-discharge node dispatches once, at the root's first tick with kills, over at most 60 primary victims with their pre-fatal state. Sparks, frost, clay rings, coins and dagger touches are secondary and start nothing.
- **Alternatives.** Judas Coin: a host coin 6 m ahead at eye height (refused without cooldown against a wall), sinking 0.5 m over 4 s; the first owned shot through it splits center/±15° with what it still carries. The Way Back: first E leaves a 5 s shadow; second E within 30 m in the same room returns at 40 m/s, invulnerable, cutting 1 m (1.5 m with Long Knife, launching with Scattered Sheep); the 12 s cooldown starts when the shadow ends and survives reassignment. Silver Wire: 15 m from the feet along the yaw (Field's walk), 6 s, binds each ground enemy once.

## Checks

| Check | Result |
|---|---|
| `npm run typecheck` | passed |
| `npm test -- --pool=threads` (one worker) | **1,217 passed in 110 files** after the expected version update; the run before it had the single stale protocol/rules expectation, then fixed |
| `npm run build` | passed |
| `npx playwright test --config playwright.hardware.config.ts e2e/talents.spec.ts` | **2/2 passed** (Lobby learning saved and entering the run; dev quick build, free Talents view, Esc without Pause, a Rite taken) |
| `npx playwright test --config playwright.hardware.config.ts e2e/talents.spec.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/singleplayer.spec.ts e2e/controls.spec.ts e2e/weapon.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts` | **26 passed, 1 failed** (13.3 min), including four-client multiplayer, profile reconnect and the full generated-floor autopilot to the boss (8.8 min). The failure, `controls.spec.ts` *native backward movement*, measures the Fallen walking at 8.6 m/s against its 5.7–6.3 window. It fails identically on the unmodified start commit `9bae8f8` (checked in a temporary worktree), so it predates R04; it is reported, not fixed here. |
| Benchmark | not run (only on your request after playing) |

New unit coverage: the catalog shape and every documented six- and nine-point path; points, gates, same-channel and discharge refusals; dormancy and suppression; Rite eligibility, source filtering, substitution, the cap, Behind His Back's ally rule, the stable draw; respec dependency removal and Rite-held abilities; every Betrayer node's effect in the simulation, including the base revolver staying unchanged; the Way Back's range rule and fade cooldown; Rite Take/Pass/sealed refusal/fallbacks; Advocate reach and whole-transaction refusal; quick builds never applying with saved progression; saved builds surviving and resetting by level; Advocate edits reaching the profile.

Inspected in the in-app browser: the HUD shows the assigned Judas Coin, Silver Wire and Way Back icons; hints list active talents and the alternative's Q/E line; the Talents view shows gates, the shared-channel lock and the kill-trigger cap; the Rite cards; the coin and the wire in the world. The browser pane was hidden during part of the session, so movement-based checks (the Way Back return on screen) rely on unit tests.

## Limitations and open items

- **Your play is the Gate C verdict.** Play the two plans below; nothing here claims they are fun or balanced.
- Presentation is coded: silver coin/glow, wire with posts, flat trap coins, a dark shadow column, frost/clay rings, spark arcs, the Informer's through-wall glows, a dark veil for One of Them. Sounds are synthesized stand-ins for the S5/S6 recordings. The three ability icons are integrated but await your approval (B9); the Advocate is the received grille painting (B4 still open).
- The other classes' 63 nodes and 9 alternatives are R5. The bargain is R6.
- A reliable aimed-hold cast request was not needed by any Betrayer node and moves to R5 (see decisions).

## Play this checkpoint

`npm run dev`, then use a fresh normal profile for progression, or the quick builds above for testing.

1. **Plan 1 (marksman), `build=marksman`:** toss the coin as a crowd closes (Q), shoot the Silver Bullet through it, bank a bullet off a wall. Watch frost slow the pursuers and sparks jump. What did giving up Field of Blood cost you?
2. **Plan 2 (saboteur), `build=saboteur`:** string the wire along the approach (E), throw the Field onto the crowd (Q, aim at the floor), fire down the bound row and watch it shatter. Did losing Shadowstep's escape matter?
3. **A Rite after the first fight (normal profile):** take the page after the first fight. Did the Rite change how you played the next room? With a learned Nail, a Recoil card should say it gives up The Nail.
4. **Respec at the Confessional:** F at the grille, reset a tree, assign Q/E, Apply. Reload the profile afterwards: the learned build is kept, Rites are gone.
5. **Esc and F:** close a Rite with Esc, then press F with nothing in front of you to reopen it; Pass closes it for good.

Tell me what you expected from a Rite, what changed in your next fight, and which benefit you gave up.
