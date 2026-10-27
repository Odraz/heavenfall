# R06 report: complete dungeon choices

Status: **awaiting-human-play**, 2026-10-18, on `rogue` from `10546b3`. Implemented under Tomas's "Continue with R06 implementation" request, without a separate preparation pass; Gates B and C are still open (recorded in [implementation-decisions.md](implementation-decisions.md)). The contracts as built and the relic coverage map are in [r06.md](r06.md#as-implemented-2026-10-18).

**Versions:** protocol 14 → **15**, rules 25 → **26**. Builds with different versions cannot join each other. No save schema change: schema 1 already held relics, deeds, equipped relics, best streak, best Sentence and the last Edicts; R6 now fills them.

## What you can play

A run now has the whole route loop:

- **Relics.** Two equipped per character, set on each class card's **Relics** button in the Lobby or with the Advocate in a run. They show beside the ability box with their cooldown swept over the icon; a matched pair shows its combo's name. Twelve relics, six combos, each with one visible effect (floor circles, runes and combs in violet ash, launch rings, embers, wheels, the Counterseal's stamp, choral bursts).
- **The key and the Reliquary.** The key room drops St Peter's key in a gold beam when it clears; walk over it (the holder is named under the minimap; a holder who dies drops it). The Reliquary's chest stands in a white beam after its fight; the key holder opens it with F, then everyone who fought there takes one of two relics they don't own, or passes. A complete collection gets a Rite instead.
- **The Advocate** (F at the grille): Talents, Relics, **the bargain** (a second relic for 30% of your max HP, kept only if you win; the lost HP shows dark at the end of your HP bar) and, while it burns, **the Sundial's Rite**. The Confessional heals you to full the first time you enter.
- **Two Bells of Judgment** hang over their rooms after those rooms clear. F under one rings it: the room counts down and seals again for one harder wave with two extra Dominions, no halos, and then a Rite page for everyone who fought it. Walk out before the seal to call it off.
- **The Sundial** burns under the minimap until 14:00. Pick a Rite from it at the Advocate; it becomes yours only if the Gatekeeper's doors seal before it goes dark.
- **Pilgrim's Return.** Hold M, click a cleared room and stand still for 1.5 s. Moving, being hurt, letting go of M or any countdown breaks it.
- **Kill streaks** with assists: a tier banner at 10, 25, 50, 100 and 200, the best streak on Results and the streak crown for the best of the party.
- **Edicts and the Sentence.** Once you've won the Pearly Gates, the **Edicts** button above Start (solo) or in the Lobby (host) turns on up to five rules; each adds 15% to every XP gain.
- **Deeds.** Win again without dying, before the Sundial, with a 200 streak or at Sentence 3: each grants its deed relic once.

### Development shortcuts (runs without saved progression)

`http://localhost:5173/?dev=1&map=rogue&seed=317434499&god=1&class=<class>`, plus:

| Parameter | Effect |
|---|---|
| `relics=usher,unbroken` | own and equip these two (any pair; a combo pair shows its combo) |
| `edicts=1,2,3` | the run's Edicts (Sentence 3) |
| `room=N` | start in room N (others cleared). On seed 317434499: key room **4**, Reliquary **8**, Confessional **9**, bells **6** and **2**, Pardoner **5**. Dev key **K** removes the enemies; a room started this way clears normally, so its key, chest or Bell appears |
| `build=<name>` | the R4/R5 quick builds |

Good relic pairs to try in a dev run: Fallen `relics=usher,unbroken` (Order of Expulsion) or `usher,eseal`; Heretic `relics=thurible,mercy` (Abandoned Mercy) or `thurible,tile`; Binder `relics=link,armageddon` (Broken Chorus) or `comb,wheel` (Harrow); Betrayer `relics=tile,sentence3` (Appeal) or `qseal,eseal`.

### Collected-account fixtures (disposable saves)

Import one into a disposable browser profile (Settings → Profile → Import code), never over your real save:

- [r06-collected.txt](fixtures/r06-collected.txt): all eight chest relics, one win (Edicts unlocked, deeds possible), every class at level 4 with a state pair equipped. The chest offers a Rite instead; the bargain offers a Rite for HP.
- [r06-veteran.txt](fixtures/r06-veteran.txt): all twelve relics and four deeds, four wins, every class at level 6 with a combo pair equipped (Expulsion, Abandoned Mercy, Broken Chorus, Appeal).

Both were generated through `createProfile`/`exportCode` and round-trip validated with `importCode`.

## Stages and commits

| Stage | Commit | What |
|---|---|---|
| 1 Relics, combos, streaks | `a01fe2e` | The catalog; trigger context in `damageEnemy`; the Comb's hit window; tick-end evaluation, cooldowns, caps; all 18 effects; kill streaks with assists; relic HUD, streak banner, client relic view, Lobby Relics view; art cut out; protocol 15, rules 26 |
| 2 Key, chest, offers, Advocate | `acecbbf` | The key and its drop; the chest and its beam; personal relic offers with reservations, Pass and the Rite fallback; saved claims; the Advocate's view; the bargain and pawns; the sanctuary heal |
| 3 Bells and the Sundial | `a01321a` | Ringing, the countdown and cancel, the Judgment wave, its pages; the Sundial's lit clock, Select offer and seal resolution; the bargain's HP segment; the Bell's toll |
| 4 Pilgrim's Return | `0b7f3f0` | The channel, its breaks and arrival; map click |
| 5 Deeds, Edicts, records | `f6be30f` | Five Edicts in the Lobby and the solo setup, the Sentence's XP, the four deeds at boss death, Absolution, best streak and Sentence records, the crown and Results |
| 6 Polish, e2e, docs | this commit | Bargain decline refresh fix, a claim chime, debug hooks, map legend, hint panel stacking, card text, compact Relics view, `e2e/dungeonChoices.spec.ts`, fixtures, docs |

## Changed files

- Content: new `src/data/relics.ts`, `src/data/edicts.ts`; `src/data/pickups.ts` (KEY), `src/data/classes.ts`.
- Simulation: new `src/sim/relics.ts`, `src/sim/streaks.ts`, `src/sim/relicOffers.ts`, `src/sim/relicUse.ts`, `src/sim/route.ts`, `src/sim/bargain.ts`; `src/sim/sim.ts`, `src/sim/talents.ts`, `src/sim/talentsFallen.ts`, `src/sim/consumables.ts`, `src/sim/rewards.ts`, `src/sim/rites.ts`, `src/sim/pickups.ts`, `src/sim/build.ts`, `src/sim/worker.ts`, `src/sim/workerMessages.ts`.
- Network and saves: `src/net/messages.ts`, `src/net/version.ts`, `src/net/lobby.ts`, `src/net/runRecords.ts`, `src/profile/lifecycle.ts`, `src/profile/model.ts`.
- Client and UI: new `src/client/relicView.ts`, `src/client/relicHud.ts`, `src/client/routeView.ts`, `src/ui/relics.ts`, `src/ui/edicts.ts`; `src/client/game.ts`, `src/client/hud.ts`, `src/client/mapView.ts`, `src/client/mapIcons.ts`, `src/client/pickups.ts`, `src/client/input.ts`, `src/client/rooms.ts`, `src/client/sounds.ts`, `src/client/itemArt.ts`, `src/client/hostSession.ts`, `src/ui/profiles.ts`, `src/ui/results.ts`, `src/ui/talents.ts`, `src/main.ts`, `src/params.ts`, `src/debug.ts`, `src/audio/sfx.ts`, `src/style.css`.
- Art: `assets/items/relic-*.png` (12, 256 px), `shared-key.png`, `sundial.png` (256 px), `reliquary-chest.png`, `reliquary-chest-open.png`, `judgment-bell.png` (512 px), cut by `scripts/cutout.py` from the B5/B8 sources received on 2026-10-14.
- Tests: new `src/sim/relics.test.ts` (33), `src/sim/route.test.ts` (26), `src/sim/deeds.test.ts` (11), `e2e/dungeonChoices.spec.ts` (5); updated `src/net/buildFingerprint.test.ts`, `src/net/lobby.test.ts`, `src/sim/workerSync.test.ts`, `src/client/rooms.test.ts`, `src/style.test.ts`, `e2e/rogue-floor.spec.ts` (the Confessional's line), `e2e/profiles.spec.ts` (the Relics buttons).
- Docs: [r06.md](r06.md), this report, [implementation-decisions.md](implementation-decisions.md), [asset-manifest.md](asset-manifest.md), [README.md](README.md), [implementation.md](implementation.md), [development-workflow.md](development-workflow.md), fixtures.

## Checks

All on Windows. No benchmark was requested or run.

| Check | Result |
|---|---|
| `npm run typecheck` (`tsc --noEmit`) | passed at every stage |
| Unit suite without timing tests: `npx vitest run --pool=threads --exclude '**/*perf.test.ts'` | stage 1: 1,531 passed (118 files); stage 2: 1,547 (119); stage 3: 1,555; stage 4: 1,558; stage 5 and final: **1,569 passed (120 files)** |
| Timing tests alone: `npx vitest run --pool=threads --reporter=verbose src/sim/perf.test.ts src/sim/hazards.perf.test.ts` | **2/2 passed** within the unchanged 8 ms limit; hazard simulation **4.833 ms/tick** (R05: 4.876) |
| `npm run build` | passed at every stage (inherited Vite configuration warnings remain) |
| `npx playwright test --config playwright.hardware.config.ts e2e/dungeonChoices.spec.ts` | **5/5 passed**: the combo on the HUD; the Advocate's view, Relics view (12 cells, unequip, Apply ends the combo) and the bargain (two cards, Decline closes it); the key dropped at the key room's clear, taken, its holder under the minimap, the Sundial burning; a Bell available after its clear and rung into its countdown; Sentence 3 under the XP bar; Pilgrim's Return from the map into the Breach |
| E2E regression set (command below) | **43/44 passed** (18.4 min) on the stage-6 build, including four-client multiplayer, PeerJS late joins, profile reconnect, the singleplayer smoke for all four classes, the R4/R5 talent flows and the solo autopilot clearing the pinned floor to the boss (10.4 min). The one failure was R03's assertion that the Lobby shows no relics "until they exist (R6)"; it now expects the four Relics buttons. Rerun after that and the last client edits: `e2e/profiles.spec.ts` with `e2e/dungeonChoices.spec.ts`, **13/13 passed** |

The regression set: `npx playwright test --config playwright.hardware.config.ts e2e/dungeonChoices.spec.ts e2e/classTalents.spec.ts e2e/talents.spec.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/singleplayer.spec.ts e2e/controls.spec.ts e2e/weapon.spec.ts e2e/watchman.spec.ts e2e/commanders.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts`.

**Found and fixed during verification:** declining the bargain didn't refresh the player's state, so the Advocate's card still offered it (now covered by a unit test); the hint panel sat under the relic strip at 720 px; the class card's records and Relics label wrapped to three lines; the Relics view was taller than a 720 px window.

**Inspected in the production client** (Playwright screenshots at 1280 × 720, and the in-app browser on the dev server): the relic strip and combo name; Usher's violet ash under a crowd with the bot fighting (it reached a 50 streak); the Relics view; the bargain's cards; the Reliquary chest in its beam with its F line; the key in its gold beam and its glyph on the map; the Bell hanging over its room; the Edicts view and row; the Singleplayer cards with Absolution. No console errors. The in-app browser pane was hidden for much of the session, which stalls the game's loading screen, so most screenshots came from Playwright.

**Test-tool note:** in the e2e spec, three overlay buttons are clicked by dispatching the click: Playwright's actionability check reports a different element under them inside the game's fixed overlays, while a real browser's hit test (checked with `elementFromPoint`) finds the button. The R5 specs only click buttons high on their panels.

## Limitations and open items

- **Your play is the R6 verdict.** Nothing here claims a relic, combo or Edict is balanced or fun. The catalog's numbers are untouched.
- **Comb of the Host** fires on wide native hits: Falling Star's landing, a censer's direct hit plus its first cloud pulse, the Silver Bullet's line, a Scourge swing or Gatebreaker's charge. The Fallen's shotgun counts as one attack, but its pellets mostly hit the same front enemy, so it rarely reaches five; in the autopilot run (no leaps) it never did.
- **Assists** count damage, Blasphemy's taunt and the Tile's bind; Chains, incense and pools don't attribute assists yet (recorded for R8).
- **The Edict of the Trumpet** brings the inherited Gatekeeper's first Judgment to 3 s until R7's authored phase move. Deed and ending evidence still runs on the inherited boss fixture.
- **Presentation is coded or synthesized:** relic sounds, the Bell's toll and the streak chord are synthesized stand-ins (S5 recordings outstanding); no combo emblems (optional); the Sundial is a HUD icon only, not a Confessional prop; the key holder is named under the minimap, not on party frames. The 17 cut-out images await your in-game approval.
- **Unobserved:** four humans with relics at once, Bells in co-op, a real deed on a second victory, and the tick cost of many relic effects at the crest are not measured.

## Play this checkpoint

`npm run dev`, then a disposable profile (or a fixture above) for normal runs; the dev shortcuts for quick looks.

1. **Rush versus detour.** On one run head straight for the Gatekeeper and pick the Sundial's Rite at the Advocate; on another clear the key room and the Reliquary and ring a Bell. Was the relic and the Bell's Rite worth losing the Sundial, and did you know which you were choosing from the door plates and the map?
2. **Bargain versus refusal.** At the Confessional take the bargain on one character and decline it on another. With 30% less HP, did the Gatekeeper fight change how you played; would you take it again on the same class?
3. **A pair versus its combo.** Play `usher,eseal` then `usher,unbroken` on the Fallen (or `comb,wheel` then `comb,link` on the Binder). Name the benefit the combo gave up, and whether the combo or the plain pair felt better.
4. **A collected account.** Import [r06-collected.txt](fixtures/r06-collected.txt): open the Reliquary (a Rite instead), check the bargain's Rite for HP, and turn on two Edicts. Did the run still offer choices worth making?
5. **Streaks and Pilgrim's Return.** Chase a 50 streak through a crest, then use the map to return to the Pardoner after the Reliquary. Was the return worth the 1.5 s of standing still?

Tell me which choice you'd make differently next time, and any option that makes another one pointless.
