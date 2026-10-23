# Netcode stage report: smooth co-op shooting

Status: **implemented, awaiting the human multiplayer session**, 2026-10-22, on `rogue` from `fd437e4`; stage 2 (below) from `f7f477d`; stage 3 (2026-10-23) from `bff1ece`; stage 4 (2026-10-23) from `9c7aeda`. Done before R07 at Tomas's request ("multiplayer is the highest priority"), after the audit of the same day. Tomas delegated every networking decision.

**Versions:** protocol 16 → 17 → 18 → 19 → **20** (the input message grew from 49 to 57, 59, then 73 bytes; stage 3 grew each snapshot enemy from 14 to 16 bytes and each player from 40 to 41; stage 4 each projectile from 9 to 10), rules unchanged at 27. Builds with different versions cannot join each other, so **everyone must load the same build** for the session.

## Stage 4: the Heretic's censer, and every other kill, at once

The audit before the friends' session (2026-10-23) rated the netcode 8/10 and found three things left.

### What was still wrong

1. **The Heretic's censer lagged.** Its Censer Launcher is a projectile, so nothing predicted it: the thrower saw its own censer only when a snapshot carried it, a round trip and the render delay after the click (about 0.3 s, 6 m of flight, at a 100 ms ping). It also flew on the host against the enemies' present positions, not where the thrower saw them.
2. **Kills that weren't shots came late.** Q and E, fire, incense, censers, talents and relics: the host's snapshot dropped the enemy and its death waited for the render delay (about 0.15 s more) on top of the round trip.
3. **A shot whose own input was late lost its aim.** The host fired a client-timed shot with the aim of the input that first counted it. If that input was lost or late (on a real line a retransmitted input arrives after a newer one, which wins), the next input counted the shot with its own newer aim. The lag test's Betrayer had 5–7 predicted kills reappear in some runs.

### What changed, as players feel it

| # | Change | Effect in play |
|---|---|---|
| 1 | **Your censer flies on your screen from the click.** The screen throws its own from the eye along the aim at the host's speed and range, the painted muzzle offset fading as before. It breaks on the first enemy, soul, standing prop or wall it meets as this screen draws them, with its burst, sound, hit marker and flinch at once. The snapshots name each projectile's owner (1 byte); the host's censer of yours is matched to your throw by its path and isn't drawn, and its vanishing plays nothing. | The Heretic's weapon responds like the guns. |
| 2 | **The host flies your censer where you saw the enemies.** Each tick of a player's censer meets the enemies where its thrower's screen drew them, by the thrower's view lag at the throw (the enemy history of stage 1). | Your censer breaks on the host where it broke on your screen. |
| 3 | **Your other kills die when the host's report arrives.** The host's damage event to each player now lists every kill credited to them that tick (slot and incarnation), past the 24-number limit and a client-timed shot's own kills too. The screen plays each at once where it's drawn, like a predicted kill, skipping the ones it predicted; a burst's ripple still delays it once. Teammates' kills keep the render delay, so they stay in time with their drawn shots. Bots get the event too, so the lag test's bot guests measure it. | Blasphemy, Falling Star, fire and incense kills pop about 0.15 s sooner. |
| 4 | **Every input repeats the latest shot's aim and view** (14 bytes). The host fires a shot with them, whichever input counted it. | A late or lost input no longer moves your shot. |

### Evidence

**The lag test** ([e2e/lag.spec.ts](../../e2e/lag.spec.ts)), now with a Heretic guest. It also requires at least 80% of each guest's kills, of any kind, to have died on its screen at once (predicted, or on the host's report), and for the Heretic at most 10% of its own host censers unmatched to a throw and at least 80% of the matched ones ending where its screen's broke. The host's kills are read before the guest's, with a second for their reports to arrive: one Blasphemy can kill dozens between two reads. Two runs during the stage, then the regression run (below):

| Guest | Kills at once (of all its kills) | Predicted kills that reappeared | Heretic's censers |
|---|---|---|---|
| Betrayer | 80 of 80 · 102 of 119\* | 0 · 1 | |
| Fallen | 140 of 141 · 91 of 122\* | 0 · 1 | |
| Binder | 120 of 133 · 124 of 124 | 1 · 1 | |
| Heretic | 116 of 116 · 109 of 114 | | 37 thrown, 28 matched, 27 agreed · 39, 29, 26 |

\* Before the read order was fixed: in that Fallen run a Blasphemy fell between the two reads. Eight more Fallen runs with temporary diagnostics showed every kill the host credited reaching the screen's report (126 of 126, 109 of 109, 145 of 145, 149 of 149 and so on) and 0–2 predicted kills reappearing. One run in about ten had 18 reappear; it didn't recur and isn't explained.

Of the Heretic's 37 censers, 9 never appeared in a snapshot: at point-blank in the crowd the host's broke within the 3 ticks between two snapshots. Nothing shows wrong on screen (the local censer broke, the host's was never drawn); it's why the matching uses the path and not the order of the throws.

**Unit tests:** [censerFlight.test.ts](../../src/sim/censerFlight.test.ts) flies the host's censer and the screen's against the same moving Blessed: one crossing the line is hit on both where the thrower saw it cross, at view lags of 3, 6 and 9 ticks, and missed by the host without the thrower's view; one walking at the Heretic breaks on both within 0.4 m at lags 0, 6 and 12, the host's more than 0.8 m short without the view. [ownCensers.test.ts](../../src/client/ownCensers.test.ts) covers the screen's flight (speed, the first enemy's near side, the Long Chain, a wall, a soul, a standing and a broken prop, the range, the border, the muzzle offset) and the matching (by path, the window, hiding while drawn, agreement). Also: the kill list past the numbers' limit and a bot's event in [damageNumbers.test.ts](../../src/sim/damageNumbers.test.ts), a client-timed shot's kill in the list without its number in [shotAgreement.test.ts](../../src/sim/shotAgreement.test.ts), a shot whose input was lost firing with the repeated aim (and not without it) in [clientShots.test.ts](../../src/sim/clientShots.test.ts), and the new input and projectile bytes in [protocol.test.ts](../../src/net/protocol.test.ts).

### Not done, and why

- **The censer's incense cloud still comes from the host**, a round trip after the screen's break. Its burst and sound are at once; the cloud's shape depends on talents the host resolves.
- **Teammates' kills keep the render delay**, so a friend's kill lines up with the friend's drawn shot.
- **Damage numbers of a client-timed shot's side effects** (a proc or the close-quarters charge inside the shot) still don't show on the shooter's screen; only their kills were added to the report.
- **Unpredicted shot kills** (about 1 in 10 of the Binder's in the lag test) keep the snapshot path.

### Checks (stage 4)

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | clean |
| `npx vitest run` | **138 files, 1,702 tests passed** |
| `npx vitest run src/sim/perf.test.ts src/sim/hazards.perf.test.ts src/sim/bench.test.ts --no-file-parallelism` | 5/5 passed, thresholds unchanged |
| `npm run build` | built |
| `npx playwright test --config playwright.hardware.config.ts e2e/lag.spec.ts --workers=1` | first run 4/4 passed; second run 3 passed, the Fallen failed its kill share (91 of 122) before the read order was fixed |
| The stage 1 regression set (same 15 files) | **56/56 passed** (27.4 min), including four-client multiplayer, the compressed crest snapshots at the upload limit, the Dominion and commander late entries and the solo autopilot floor. Its lag tests: Betrayer 81 of 79 kills at once, Fallen 171 of 165, Binder 114 of 111, Heretic 129 of 123 with 34 of 38 censers matched and 31 agreed; 0–1 predicted kills reappeared each. (Above 100%: the guest is read a second after the host, and goes on killing.) |

## Stage 3: every weapon kill at once

An audit on 2026-10-23 found that stage 2's instant kills covered only part of the shooting. The shooter's screen didn't know any enemy's HP, so it predicted a kill only when **one hit killed an enemy at full HP**. Every other kill waited for the host: about a round trip plus the render delay, 0.3 s at a 100 ms ping. Stage 2's lag test used only the Betrayer, whose revolver one-shots the basic enemies, so it didn't show this.

### What was still wrong

1. **Most kills of three classes still came late.** The Binder's Chain Gun never predicted a kill: 12 damage can't kill a 20-HP Blessed from full HP. The Fallen's shotgun beyond 6 m never did either: each pellet was judged alone, so two 10-damage pellets didn't add up to a kill. A Watchman needed two revolver shots, so its kill wasn't predicted. Neither was any enemy that a teammate, fire or an earlier shot had hurt.
2. **Pellets were scattered twice.** The shooter's screen and the host each picked their own random spread. The Fallen's tracers and hit markers showed pellets the host never fired; the Binder's did too at range.
3. **Your damage numbers waited for the host.** They came in the host's `damage` event, a round trip after the shot.

### What changed, as players feel it

| # | Change | Effect in play |
|---|---|---|
| 1 | **Enemy HP in the snapshots.** Each enemy record carries its HP, rounded up. Each player record carries `shotsDone`: the counter up to which the host has fired (or dropped) that player's shots. | The shooter's screen knows how hurt every enemy is. |
| 2 | **Your own damage, until the host has it.** The screen remembers the damage each of its shots dealt. Until a snapshot's `shotsDone` covers the shot, that damage is subtracted from the snapshot's HP. Pellets of one shot add up, rooted enemies take double, and the Cantor's hymnal cuts damage from its front as on the host. The Silver Bullet uses the host's own line rule with the real HP. | Every weapon kill shows at once: the second Chain Gun bullet, two far pellets, a hurt Watchman, an enemy a friend already wounded. |
| 3 | **Shared pellet spread.** A client-timed shot's pellets scatter by the shooter's id and the shot's counter (`fmix32`), on both sides. Held-fire shots keep the simulation's random stream. | The tracers you see are the pellets the host fires. |
| 4 | **Your damage numbers at once.** Each predicted hit shows its number when you fire. The host leaves those hits out of your `damage` event, which keeps everything else: talent and relic procs, fire, incense. | Numbers pop on the shot, and none shows twice. |
| 5 | **Lag test for three classes.** `e2e/lag.spec.ts` runs a Betrayer, a Fallen and a Binder guest. It now also requires at least 80% of the guest's **weapon kills** (a host diagnostic that counts left- and right-button kills) to be ones the guest's screen showed at once. | Measures what friends feel, for the classes that were missed. |

**Traffic.** At a full 1,500-enemy crowd the raw snapshot grows by 3 KB (2 bytes per enemy). The transport compresses each record field as a column, and the HP of unhurt enemies repeats, so on the wire the increase is small; the compressed crest test still holds the upload limit (below).

### Evidence

**The lag test** ([e2e/lag.spec.ts](../../e2e/lag.spec.ts)): a bot guest over real PeerJS with 160 ms of lag, ±25 ms jitter and 2% loss, as in stage 2.

| Guest | Weapon kills shown at once | Predicted kills that reappeared | Kills in all (with Q/E) |
|---|---|---|---|
| Betrayer | **75 of 79** (95%) | 0 | 85 |
| Fallen | **62 of 62** (100%) | 0 | 119 |
| Binder | **123 of 125** (98%) | 0 | 125 |

Before this stage, by construction: none of the Binder's Chain Gun kills, none of the Fallen's kills beyond 6 m, and no kill of a hurt enemy could show at once. The first run of the new test, before the weapon-kill diagnostic, counted every kill: the Fallen guest showed 69 of 162. Its other kills came from its Q and E (Blasphemy, Falling Star), which aren't shots (below).

**Unit tests:** [shotAgreement.test.ts](../../src/sim/shotAgreement.test.ts) checks the host's hits against the shooter's prediction. For five shot counters, a client-timed shotgun shot into a crowd, some of it hurt, leaves exactly the HP the prediction computed; so do four Chain Gun bullets. The same shot lands identically under two simulation seeds, and a held-fire shot doesn't. It also covers `shotsDone` through firing, waiting, dropping and death; the damage event without a client-timed shot's hits and with a held-fire shot's; and the weapon-kill diagnostic. [killPredict.test.ts](../../src/client/killPredict.test.ts) covers HP-based kills and bursts, the factors, pellets that add up and pass a kill, Barbed Rounds, the Silver Bullet through hurt and bound enemies, and the damage ledger (resolve, wrap at 256, expiry). Also: the Silver Bullet test in [attacks.test.ts](../../src/sim/attacks.test.ts) (prediction from the snapshot's HP against hurt enemies), the HP lookup in [snapshots.test.ts](../../src/client/snapshots.test.ts), and HP and `shotsDone` in [protocol.test.ts](../../src/net/protocol.test.ts).

### Not done, and why

- **Ability kills still wait for the host.** Falling Star's landing, Blasphemy, Chains, Discord, Ring and the rest resolve on the host, so their kills show a round trip later. In the lag test about half the Fallen bot's kills were its Q and E. Predicting them means simulating each ability on the screen: a stage of its own if the session asks for it.
- **The Heretic's censer** flies as a host projectile against the host's present enemies, and its incense kills over time. Its kills still come from the snapshots.
- **Talent extras not modeled on the screen:** Through the Ranks' second close enemy, The Halt and the Lame's pass-through, and the Scourge's Whirl, Long Flail and Whip shapes. Their extra kills come from the snapshots. Talent and relic proc damage (sparks, clay, combos) also shows its numbers from the host event.

### Checks (stage 3)

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | clean |
| `npx vitest run` | **136 files, 1,690 tests passed** |
| `npx vitest run src/sim/perf.test.ts src/sim/hazards.perf.test.ts src/sim/bench.test.ts --no-file-parallelism` | 5/5 passed, thresholds unchanged |
| `npm run build` | built |
| `npx playwright test --config playwright.hardware.config.ts e2e/lag.spec.ts --workers=1` | **3/3 passed** (the table above) |
| The stage 1 regression set (same 15 files) plus `e2e/r02-checkpoint.spec.ts` | **56 passed, 20 failed** (28.6 min). All 15 files of the usual set passed, including four-client multiplayer, the compressed crest snapshots at the upload limit, the Dominion and commander late entries, and the solo autopilot floor (which stalled intermittently in stage 2). The 20 failures are r02-checkpoint's Gate B links, and they predate this stage: the test pins floor hash `029559b5`, while `src/gen/pinned.ts` has been `806a102c` since rules 23. Its PeerJS late-entry test passed. The lag tests in this run: Betrayer 79 of 84 weapon kills at once, Fallen 65 (of 64*), Binder 118 of 134; 1–2 predicted kills reappeared each. |

\* *Kill markers confirmed* counts a predicted kill whose enemy left the snapshots within 1.5 s. When the Fallen's Falling Star or Blasphemy finishes an enemy the shotgun was predicted to kill, the marker is confirmed but the kill isn't a weapon kill, so the share can pass 100%.

## Stage 2: the shot you saw is the shot the host fires

A second audit after the first stage found three remaining problems, one of which the first stage's own measure hid.

### What was still wrong

1. **The host often fired a different shot from the one the shooter saw.** The host fired on its own fire timer, aimed wherever the *newest* input pointed. Inputs go out 30 times a second, not every frame, so by the time the host fired, the shooter's aim had often moved on: to the next target after a kill, or along a fast Cherub. The first stage's *kill markers confirmed* counted any death within 1.5 s as confirmed, even when a later shot did it, so it read 95% while the shot itself agreed far less often. Hiding predicted kills (2, below) made this measurable: in the lag test **15–23 of about 80 predicted kills came back alive**.
2. **Kills didn't look instant.** The kill marker and sound were instant, but the enemy walked on until the host's snapshot dropped it: about 0.3 s at a 100 ms ping. This is the "shots don't feel impactful" complaint.
3. **Dodging was judged against the host's present.** A friend's screen draws globes and arrows a round trip plus the render delay behind the host. At a 100 ms ping a 6 m/s globe hit them while their screen still showed it 1.8 m away, and a globe that had passed them on the host could still not hit a friend who stepped out of its drawn path in time, or hit one who had. Shooting globes down had a fixed 0.25 s allowance, too short beyond about a 100 ms ping.

### What changed, as players feel it

| # | Change | Effect in play |
|---|---|---|
| 1 | **Client-timed shots.** The shooter's screen counts the shots its fire timer fires and sends an input in the same frame, so that input carries the shot's aim and view. The host fires exactly those shots, each with the aim and view of the input that carried it, no faster than the weapon allows (a shot may come 2 ticks early, so jitter doesn't delay it; one that waited 0.3 s is dropped). The host no longer latches clicks itself: the screen's latch already turned each click into a shot it sends. | The host's shot is the one you saw: same moment, same aim, same enemies. |
| 2 | **Predicted kills die at once.** A kill your screen predicts plays its death or burst immediately, where you see the enemy, and hides it while the snapshots catch up. If a snapshot from after the host resolved the shot still shows it alive, it reappears (its corpse goes with it). | Kills land on the click, not a third of a second later. |
| 3 | **Dodge compensation.** Each player is hit by the stretch of an enemy projectile's flight their own screen drew this tick. A projectile that ends on a wall or at its range stays owed to the players whose screens haven't drawn its end yet: it can still hit them, and a globe's shatter catches them when their screen reaches it. | You're hit by globes and arrows when you see them hit, and a dodge that worked on your screen works. |
| 4 | **Globe shooting** allows the shooter's view delay on top of the 0.25 s. | Shooting a globe down works at any ping up to the 0.4 s limit. |
| 5 | **F3** adds *reappeared*: how many predicted kills came back alive. | The honest measure of shooting agreement during the session. |
| 6 | **Bot doorway fix.** A bot standing just past the doorway of a room that hasn't started walks on to that room's entry cell; it used to stop where it stood. | Found while chasing the autopilot stall below; bots that fill the party no longer freeze in a doorway. |

### Evidence

**The browser test** ([e2e/lag.spec.ts](../../e2e/lag.spec.ts)): the same bot Betrayer over real PeerJS with 160 ms of lag, ±25 ms jitter and 2% loss. It now also requires that at most 10% of predicted kills reappear.

| Build | Kill markers confirmed | Predicted kills that reappeared |
|---|---|---|
| Predicted deaths, host's own fire timer | 78/79 | **15** of 80 (19%) |
| Same, reveal wait raised to 1 s (diagnosis) | 60/72 | **23** of 72 |
| Client-timed shots | 78/79 | **2** of 80 (2.5%) |

The second row showed the disagreements were real rather than a reveal that came too early.

**Unit tests:** [clientShots.test.ts](../../src/sim/clientShots.test.ts) (a shot fires with the aim and view of its own input though a newer input turned away, with a no-view control; no shot without the screen's shot; the rate limit, early shots and stale ones; dead players; the Heretic's fallback; old-style held fire), [dodgeComp.test.ts](../../src/sim/dodgeComp.test.ts) (a standing player is hit exactly the lag later; a dodge on the friend's screen avoids a globe that already passed them on the host; a globe or arrow that broke on the wall still hits the player in front of it, once; the shatter waits for the friend's screen; each player judged by their own screen; a lagging shooter hits the globe they saw), [predictedDeaths.test.ts](../../src/client/predictedDeaths.test.ts) (hiding, one death per enemy, confirmation, the reveal tick, a reused slot, the 2 s limit), and the new input bytes in [protocol.test.ts](../../src/net/protocol.test.ts).

### Not done, and why

- **Area attacks with a tell** (Dominion slams, Watchman and commander strikes, boss casts) still resolve at the host's present. Their tells are drawn by the client's tick estimate, which is behind by half a round trip, not the render delay, so the gap is a third of the projectiles' one. Revisit if the session says otherwise.
- **Enemy melee** is unchanged: enemies stop when they reach you, so the lag only shifts the first hit, and the 0.25 s before it absorbs most of that.
- **Shotgun spread** is still rolled separately on each side, so the Fallen's far pellets can disagree. Close range, where every pellet kills, is unaffected.
- **The snapshot rate stays 10 Hz** (as in the first stage): with kills and dodges now judged by what each screen shows, more snapshots would mainly make others' movement fresher, at up to 1.5× the host's upload.

### Checks (stage 2)

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | clean |
| `npx vitest run` | **135 files, 1,669 tests passed** |
| `npx vitest run src/sim/perf.test.ts src/sim/hazards.perf.test.ts src/sim/bench.test.ts --no-file-parallelism` | 5/5 passed, thresholds unchanged |
| `npm run build` | built |
| The stage 1 regression set (same 15 files) on the final build | **53/53 passed** (23.1 min); its lag test: ping 175 ms, 77/77 confirmed, 1 reappeared |
| `e2e/lag.spec.ts`, separate runs during the stage | 4 more passes: 78/79 · 73/74 · 82/83 · 76/77 confirmed, 1–2 reappeared |

**An intermittent autopilot stall, not root-caused.** The solo autopilot test (`e2e/rogue-floor.spec.ts`, "solo autopilot clears the pinned generated floor") sometimes stood at room 3's entrance after clearing room 1: the room never started, and the test failed after 90 s without progress. It ran 31 times with this stage's code (some runs with temporary diagnostics, all since removed). Before the bot doorway fix it failed 3 of 6 runs. After the fix it failed 3 of 25, two of those back to back, then passed every run including the final regression set. The committed `f7f477d` build passed all 6 runs it was given. No page, console or worker error appeared in a failing run. A client-timed-shots switch-off run still failed, so it isn't that change, but the stage can't be cleared of it with this sample. It affects the solo test bot's floor run, not multiplayer: every multiplayer test passed each time. If it recurs, capture the host's own position for the player at the stall (the room starts only when the host counts the player inside it).

## Stage 1

### Why

At the pre-rogue multiplayer playtest ([2026-10-09-mp.md](../playtests/2026-10-09-mp.md)) friends found shots laggy and unimpactful. The audit found that the host resolved every shot against where enemies are *now*, while a friend's screen shows them a round trip plus 150 ms in the past. The friend saw a hit marker and a kill marker, and the enemy lived. A quick click could also vanish, the drawn world stuttered with network jitter, and a slow upload could queue up to a second of snapshots.

### What changed, as players feel it

| # | Change | Effect in play |
|---|---|---|
| 1 | **Lag compensation.** The host keeps the last 0.5 s of enemy positions. Each input says which snapshots the player's screen was drawing; while the host resolves that player's attack, it moves the enemies back to where that screen showed them, at most 0.4 s back. Any knockback the attack causes is kept when they return. All weapon attacks go through it: hitscan, the Silver Bullet, the Scourge and the censer's launch. | What you hit on your screen is what the host hits. |
| 2 | **Click latching.** Inputs carry running mouse-press counters, like Q/E. A press counts as held until its attack fires or 0.3 s pass, on the host and in the shooter's own cosmetic fire timer alike. | A tap of the revolver, shotgun, slug or Silver Bullet always fires, even if press and release arrive together or the host's fire timer is a moment behind. A held button fires exactly as before. |
| 3 | **Smoothed snapshot clock.** The client's sense of the host's tick follows the running average of snapshot arrivals and corrects itself by at most 10% of its speed, so it never runs backwards. A jittery connection adds up to 100 ms of render delay (3 ticks), so movement stays smooth instead of freezing and jumping. | Enemies and teammates no longer stutter on a shaky connection. |
| 4 | **Smaller send queue.** The host skips a snapshot for a client whose channel would then hold more than 24 KB, down from 64 KB: about one and a half full-crowd snapshots instead of six. | A weak upload gives fewer, fresh snapshots instead of lag that builds up to a second. |
| 5 | **Connection readout (F3).** Ping (round trip measured on `ctrl`) and route (`direct`, or `relay` through the TURN server), view delay, jitter and **kill markers confirmed** (the share of your predicted kills the host agreed with). On the host, one line per friend: `P1 ping 45 ms (direct)`. | During the session you can tell whether a complaint is the connection, and whose. |
| 6 | **Simulated bad connection** for testing: `lag=`, `jitter=`, `loss=` URL parameters on a joining client (e.g. `?lag=160&jitter=25&loss=2`). | We can reproduce a friend's connection on one machine. |

Unchanged: 30 Hz simulation, 10 Hz remote snapshots, the 150 ms base render delay, host authority over damage, client-side movement, the 437 KB/s upload limit, the heartbeat and timeouts.

### Evidence

**A simulation experiment (not kept as a test).** A Betrayer aimed each shot at where an enemy stood a set time earlier, against four spread-out enemies of each type at 12–22 m, 1,500 ticks per run:

| Aim age | Blessed, without → with | Chorister | Cherub |
|---|---|---|---|
| 200 ms | 34% → 99% | 97% → 99% | 83% → 99% |
| 300 ms | 21% → 99% | 86% → 99% | 70% → 99% |
| 400 ms | 16% → 98% | 88% → 98% | 15% → 100% |

A friend with a 100 ms ping aims about 300 ms behind the host (ping, render delay and input wait).

**The browser test** ([e2e/lag.spec.ts](../../e2e/lag.spec.ts)): a bot Betrayer joins over real PeerJS with 160 ms of lag, ±25 ms jitter and 2% loss, and fights the crest crowd for about 30 s. Result: ping 174 ms (direct), view delay 157 ms, jitter 13 ms, **69 of 72 kill markers confirmed**, the host's F3 line `P1 ping 175 ms (direct)`. With lag compensation switched off for comparison, the same test confirmed 75 of 78. The bot fights point-blank in a crowd charging straight at it, where old aims still land. The test proves the whole path works under lag, and the experiment above proves the compensation.

**Traffic** (measured during the audit, unchanged by this stage): at a full 1,500-enemy crowd each friend receives about 82 KB/s of snapshots plus 5 KB/s of events, so the host uploads about 2.1 Mbit/s for three friends.

### Checks

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | clean |
| `npx vitest run` | **132 files, 1,638 tests passed** |
| `npx vitest run src/sim/perf.test.ts src/sim/hazards.perf.test.ts src/sim/bench.test.ts --no-file-parallelism` | 5/5 passed, thresholds unchanged |
| `npm run build` | built |
| `npx playwright test --config playwright.hardware.config.ts e2e/lag.spec.ts` | 1/1 passed (above) |
| E2E regression set (below) | see [Regression run](#regression-run) |

New tests: [lagComp.test.ts](../../src/sim/lagComp.test.ts) (history, clamping, rewind and restore, and a strafing Blessed that is hit only with the view), [fireLatch.test.ts](../../src/sim/fireLatch.test.ts) (press and release in one tick, a click before the timer is ready, expiry, held fire unchanged, a right click during a held left, joining and death), the snapshot clock in [snapshots.test.ts](../../src/client/snapshots.test.ts) (steady rate, never backwards, jitter delay, stalls and pauses, the recorded view), [lagSim.test.ts](../../src/net/lagSim.test.ts), [linkQuality.test.ts](../../src/net/linkQuality.test.ts), the kill-marker confirmations in [killPredict.test.ts](../../src/client/killPredict.test.ts), and the new input fields in [protocol.test.ts](../../src/net/protocol.test.ts).

#### Regression run

`npx playwright test --config playwright.hardware.config.ts e2e/lag.spec.ts e2e/crest-network.spec.ts e2e/multiplayer.spec.ts e2e/dominion.spec.ts e2e/commanders.spec.ts e2e/dungeonChoices.spec.ts e2e/classTalents.spec.ts e2e/talents.spec.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/singleplayer.spec.ts e2e/controls.spec.ts e2e/weapon.spec.ts e2e/watchman.spec.ts e2e/rogue-floor.spec.ts`

Result: **53/53 passed** (22.5 min), including four-client multiplayer with late joins and chat, compressed crest snapshots at the upload limit, the Dominion and commander PeerJS late entries, the four classes' singleplayer smoke, weapons and controls, and the solo autopilot clearing the pinned floor. The lag test passed again inside the run: ping 172 ms, 81 of 82 kill markers confirmed.

### Not done, and why

- **The `snap` channel stays reliable-unordered.** True unreliable delivery would need patching PeerJS, and a full-crowd snapshot is two messages of about a dozen packets each: dropping a whole message for one lost packet would lose far more snapshots on a lossy line than retransmission costs. The smaller send queue (4) addresses the lag this could cause.
- **Q/E abilities are not lag-compensated.** Targeted abilities (Chains, Discord, Kiss and the like) resolve at the host's present. They act on areas or allies, where 0.3 s matters much less than for a single bullet. Revisit if the session says otherwise.
- **The snapshot rate stays 10 Hz.** Raising it would roughly double the host's upload at full crowds. With lag compensation the remaining delay only affects how soon you *see* a death pop, not whether it happens; kill markers and hit flinches were already instant.
- **Kill markers can still disagree** when another player kills your target first, or when damage you didn't predict (a shield, a relic) changes the outcome. F3's confirmation share measures how often.

## For the session

- **Everyone loads the same build** (protocol 20).
- **The host is whoever has the best upload**, ideally wired, with no streaming or screen sharing while playing. Full crowds need about 2.1 Mbit/s of upload for three friends.
- **Press F3 as host:** each friend's ping and route. `relay` means their network forced the TURN relay. Check the Metered account's monthly quota beforehand: about 300 MB per relayed player per hour.
- **Ask a friend to press F3** if shooting feels off. *Reappeared* is the number to watch: predicted kills the host didn't agree with. More than about one in ten of the confirmed count means something other than lag is disagreeing, which is worth a note in the playtest log, with the class and weapon.
