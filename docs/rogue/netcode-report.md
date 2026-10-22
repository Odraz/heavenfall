# Netcode stage report: smooth co-op shooting

Status: **implemented, awaiting the human multiplayer session**, 2026-10-22, on `rogue` from `fd437e4`. Done before R07 at Tomas's request ("multiplayer is the highest priority"), after the audit of the same day. Tomas delegated every networking decision.

**Versions:** protocol 16 → **17** (the input message grew from 49 to 57 bytes), rules unchanged at 27. Builds with different versions cannot join each other, so **everyone must load the same build** for the session.

## Why

At the pre-rogue multiplayer playtest ([2026-10-09-mp.md](../playtests/2026-10-09-mp.md)) friends found shots laggy and unimpactful. The audit found that the host resolved every shot against where enemies are *now*, while a friend's screen shows them a round trip plus 150 ms in the past. The friend saw a hit marker and a kill marker, and the enemy lived. A quick click could also vanish, the drawn world stuttered with network jitter, and a slow upload could queue up to a second of snapshots.

## What changed, as players feel it

| # | Change | Effect in play |
|---|---|---|
| 1 | **Lag compensation.** The host keeps the last 0.5 s of enemy positions. Each input says which snapshots the player's screen was drawing; while the host resolves that player's attack, it moves the enemies back to where that screen showed them, at most 0.4 s back. Any knockback the attack causes is kept when they return. All weapon attacks go through it: hitscan, the Silver Bullet, the Scourge and the censer's launch. | What you hit on your screen is what the host hits. |
| 2 | **Click latching.** Inputs carry running mouse-press counters, like Q/E. A press counts as held until its attack fires or 0.3 s pass, on the host and in the shooter's own cosmetic fire timer alike. | A tap of the revolver, shotgun, slug or Silver Bullet always fires, even if press and release arrive together or the host's fire timer is a moment behind. A held button fires exactly as before. |
| 3 | **Smoothed snapshot clock.** The client's sense of the host's tick follows the running average of snapshot arrivals and corrects itself by at most 10% of its speed, so it never runs backwards. A jittery connection adds up to 100 ms of render delay (3 ticks), so movement stays smooth instead of freezing and jumping. | Enemies and teammates no longer stutter on a shaky connection. |
| 4 | **Smaller send queue.** The host skips a snapshot for a client whose channel would then hold more than 24 KB, down from 64 KB: about one and a half full-crowd snapshots instead of six. | A weak upload gives fewer, fresh snapshots instead of lag that builds up to a second. |
| 5 | **Connection readout (F3).** Ping (round trip measured on `ctrl`) and route (`direct`, or `relay` through the TURN server), view delay, jitter and **kill markers confirmed** (the share of your predicted kills the host agreed with). On the host, one line per friend: `P1 ping 45 ms (direct)`. | During the session you can tell whether a complaint is the connection, and whose. |
| 6 | **Simulated bad connection** for testing: `lag=`, `jitter=`, `loss=` URL parameters on a joining client (e.g. `?lag=160&jitter=25&loss=2`). | We can reproduce a friend's connection on one machine. |

Unchanged: 30 Hz simulation, 10 Hz remote snapshots, the 150 ms base render delay, host authority over damage, client-side movement, the 437 KB/s upload limit, the heartbeat and timeouts.

## Evidence

**A simulation experiment (not kept as a test).** A Betrayer aimed each shot at where an enemy stood a set time earlier, against four spread-out enemies of each type at 12–22 m, 1,500 ticks per run:

| Aim age | Blessed, without → with | Chorister | Cherub |
|---|---|---|---|
| 200 ms | 34% → 99% | 97% → 99% | 83% → 99% |
| 300 ms | 21% → 99% | 86% → 99% | 70% → 99% |
| 400 ms | 16% → 98% | 88% → 98% | 15% → 100% |

A friend with a 100 ms ping aims about 300 ms behind the host (ping, render delay and input wait).

**The browser test** ([e2e/lag.spec.ts](../../e2e/lag.spec.ts)): a bot Betrayer joins over real PeerJS with 160 ms of lag, ±25 ms jitter and 2% loss, and fights the crest crowd for about 30 s. Result: ping 174 ms (direct), view delay 157 ms, jitter 13 ms, **69 of 72 kill markers confirmed**, the host's F3 line `P1 ping 175 ms (direct)`. With lag compensation switched off for comparison, the same test confirmed 75 of 78. The bot fights point-blank in a crowd charging straight at it, where old aims still land. The test proves the whole path works under lag, and the experiment above proves the compensation.

**Traffic** (measured during the audit, unchanged by this stage): at a full 1,500-enemy crowd each friend receives about 82 KB/s of snapshots plus 5 KB/s of events, so the host uploads about 2.1 Mbit/s for three friends.

## Checks

| Command | Result |
|---|---|
| `npx tsc --noEmit -p .` | clean |
| `npx vitest run` | **132 files, 1,638 tests passed** |
| `npx vitest run src/sim/perf.test.ts src/sim/hazards.perf.test.ts src/sim/bench.test.ts --no-file-parallelism` | 5/5 passed, thresholds unchanged |
| `npm run build` | built |
| `npx playwright test --config playwright.hardware.config.ts e2e/lag.spec.ts` | 1/1 passed (above) |
| E2E regression set (below) | see [Regression run](#regression-run) |

New tests: [lagComp.test.ts](../../src/sim/lagComp.test.ts) (history, clamping, rewind and restore, and a strafing Blessed that is hit only with the view), [fireLatch.test.ts](../../src/sim/fireLatch.test.ts) (press and release in one tick, a click before the timer is ready, expiry, held fire unchanged, a right click during a held left, joining and death), the snapshot clock in [snapshots.test.ts](../../src/client/snapshots.test.ts) (steady rate, never backwards, jitter delay, stalls and pauses, the recorded view), [lagSim.test.ts](../../src/net/lagSim.test.ts), [linkQuality.test.ts](../../src/net/linkQuality.test.ts), the kill-marker confirmations in [killPredict.test.ts](../../src/client/killPredict.test.ts), and the new input fields in [protocol.test.ts](../../src/net/protocol.test.ts).

### Regression run

`npx playwright test --config playwright.hardware.config.ts e2e/lag.spec.ts e2e/crest-network.spec.ts e2e/multiplayer.spec.ts e2e/dominion.spec.ts e2e/commanders.spec.ts e2e/dungeonChoices.spec.ts e2e/classTalents.spec.ts e2e/talents.spec.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/singleplayer.spec.ts e2e/controls.spec.ts e2e/weapon.spec.ts e2e/watchman.spec.ts e2e/rogue-floor.spec.ts`

Result: **53/53 passed** (22.5 min), including four-client multiplayer with late joins and chat, compressed crest snapshots at the upload limit, the Dominion and commander PeerJS late entries, the four classes' singleplayer smoke, weapons and controls, and the solo autopilot clearing the pinned floor. The lag test passed again inside the run: ping 172 ms, 81 of 82 kill markers confirmed.

## Not done, and why

- **The `snap` channel stays reliable-unordered.** True unreliable delivery would need patching PeerJS, and a full-crowd snapshot is two messages of about a dozen packets each: dropping a whole message for one lost packet would lose far more snapshots on a lossy line than retransmission costs. The smaller send queue (4) addresses the lag this could cause.
- **Q/E abilities are not lag-compensated.** Targeted abilities (Chains, Discord, Kiss and the like) resolve at the host's present. They act on areas or allies, where 0.3 s matters much less than for a single bullet. Revisit if the session says otherwise.
- **The snapshot rate stays 10 Hz.** Raising it would roughly double the host's upload at full crowds. With lag compensation the remaining delay only affects how soon you *see* a death pop, not whether it happens; kill markers and hit flinches were already instant.
- **Kill markers can still disagree** when another player kills your target first, or when damage you didn't predict (a shield, a relic) changes the outcome. F3's confirmation share measures how often.

## For the session

- **Everyone loads the same build** (protocol 17).
- **The host is whoever has the best upload**, ideally wired, with no streaming or screen sharing while playing. Full crowds need about 2.1 Mbit/s of upload for three friends.
- **Press F3 as host:** each friend's ping and route. `relay` means their network forced the TURN relay. Check the Metered account's monthly quota beforehand: about 300 MB per relayed player per hour.
- **Ask a friend to press F3** if shooting feels off: a *kill markers confirmed* share below about 90% means something other than lag is disagreeing, which is worth a note in the playtest log.
