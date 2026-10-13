# R2 report: pressure and pickups

**Status: implementing** (2026-10-13). Brief: [r02.md](r02.md). R2.1–R2.3 and R2.5 are implemented and verified. R2.4 authority and client components are implemented; scoped Dominion checks pass, broader four-client verification remains unresolved. R2.6–R2.7 implementation remains. Gate B and human feel acceptance are pending. Local branch `rogue`; nothing pushed, merged or published.

## Authorization and Git facts

- Tomas accepted R1 at `de0f8ae724ea25765c446dc45c0ee70ebf94a4fe` ("R01 looks good") and requested a Gate clipping fix, a commit, then independent R02 implementation overnight.
- Gate repair / R2 start SHA: `767b351a039f3d7a7010ce7893d4812ebf0782a9`.
- Local `main` remains `fa9e3f5765cd09d5a315db6342107ff70ad159e8`, the base recorded in R0/R1. Cached `origin/main` is `c5d74e456f9932953d432eaa7e679f427ec8d937`; no fetch, push, main merge or ref replacement was performed.
- R2.1 code end SHA: `36d24131b40de6399ae37cd4e42f395fd31c9629` (authoritative pickups, halo ledger and bounded snapshots). The following documentation commit only records that identity.
- R2.2 code end SHA: `42271ee3a73bf300aa8d11e6437dca429150e484` (authoritative props, delayed blasts and late-entry checkpoints).
- R2.3 code end SHA: `5755024eda5b404c29f8651256e5abc2d8e51740` (all 51 S1 runtime takes, bounded loader and cosmetic shuffle bags).
- R2.4 authority/wire component end SHA: `65e4384861ddb038c8d38d755fe573316c8c18b8`. Client component and its verification limitations are recorded below.
- R2.4 client/bot/encounter component end SHA: `78cc0b0f74f0e4b6c6f51088da1a1a3a1a939f02`. Five final scoped browser/audio checks and 860 unit tests passed; four-client failures remain explicitly unresolved.
- Protocol version **4**, rules version **4** after R2.5 (R2.4 used 4/3; R2.1–R2.3 used 3/2). Floor layout/pool/pinned hash remain the R1 fixture until R2.6 introduces the full pool. Restart the dev server after a commit so every participant uses the same artifact fingerprint.

## R2.1: pickups, halo ledger and bounded snapshots

The sealed generated room gets its fixed shape/band halo budget spread over the complete scaled spawn list using exact integer arithmetic. Accepted damage deaths, including world deaths, settle that victim once. Direct removal/dev K/recovery/trickle do not award loot. Ordinary Chorister/Cherub deaths roll capped motes. The Dominion's elite reservations and drops will join this path in R2.4; no elite exists in the current R1 pool.

Coins attract living collectors in the owning room within 4 m, motes injured collectors within 2 m. Terrain LOS and 3D accepted feet reach apply, motion uses the existing collision helper, and collection rechecks reach at 0.8 m. Coins/gold credit every connected human, including a dead teammate; bots can collect without gaining a wallet. A mote heals only its collector by 8% maximum HP. Drops fade after 600 ticks; the last 90 blink. Motes at full HP wait. Items have no fade: the R2 fixture can use Balm for 40 HP on touch with a one-second cooldown; R3 owns the remaining effects and inventory, and their labeled pickups stay.

The pickup pool keeps 32 structural slots reserved, permits at most 128 ordinary entities and 32 pending mote/item drops, and uses run-monotonic u32 IDs. Overflow coins merge only within 3 m in the same room with LOS, never above 99 halos, keeping the earliest deadline. Otherwise they are forfeited with a diagnostic; there is no direct-wallet shortcut. Pending motes preserve their original expiry. Exact fade-tick drops reap expired entries before capacity/merge checks. Exhausted IDs refuse creation instead of wrapping.

Snapshots append absolute wallet u32 to each player and feet z/incarnation to each enemy. Pickups are 9 B and all fit in part0 before assigning contiguous enemy/projectile ranges. Maximum 1500 enemies/400 projectiles/160 pickups fit in two <=16,000 B packets (26,458 B total with four players repeated). Decode rejects malformed lengths, caps, slots, repeated IDs and pickup kinds. Reassembly publishes complete ticks only; it holds at most four incomplete ticks for 500 ms, ignores identical duplicates and invalidates inconsistent duplicates, headers, players or ranges. Tombstones are also bounded. Run reset clears the assembly/interpolation state. Enemy interpolation never joins different incarnations in a reused slot.

Reliable metadata supplies value/expiry/owning-room information; late-entry FloorSync contains detached live drop records. Visible entities and removal follow complete snapshots; wallet changes are absolute host state. Pickup render uses bounded instancing and coded gold rings/green motes/item labels. Collection sounds currently use synthesized named fallbacks; shuffle bags/recording integration is R2.3.

### Changed files

New: `src/data/pickups.ts`, `src/sim/economy.ts`, `src/sim/economy.test.ts`, `src/sim/pickups.ts`, `src/sim/pickups.test.ts`, `src/client/pickups.ts`, `src/client/pickups.test.ts`, `e2e/rogue-pressure.spec.ts` and this report.

Updated: `src/sim/sim.ts`, `src/net/protocol.ts`, `src/net/protocol.test.ts`, `src/net/messages.ts`, `src/net/version.ts`, `src/net/buildFingerprint.test.ts`, `src/client/snapshots.ts`, `src/client/game.ts`, `src/client/hud.ts`, `src/client/sounds.ts`, `src/audio/sfx.ts`, `src/debug.ts`, `e2e/rogue-floor.spec.ts` and the R2 brief/status records. The generated-floor parity test also captures the corrected Gate with an independently positioned camera.

### Verification

| Exact command | Result |
|---|---|
| `npm test -- src/net/protocol.test.ts src/sim/pickups.test.ts src/sim/economy.test.ts src/client/snapshots.test.ts` | 32 passed. Subsequent coverage added reliable metadata recovery and exact fade-tick/ID-exhaustion cases. |
| Final `npm test` |**773 passed across 72 files**, exit 0, 47.87 s. One worker; unchanged 8-ms/tick assertion passed. Earlier complete run exposed the old protocol 2/rules 1 fingerprint assertion; it was deliberately updated to 3/2 and all later complete runs passed. |
| `npm run typecheck` |passed, exit 0 on the final game/tests and camera capture. |
| `npm run build -- --logLevel error` |passed, exit 0; browser commands also build production assets. |
| `npm run e2e -- e2e/rogue-pressure.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts --grep 'generated combat drops\|password\|second generated run\|two browser clients'` |**3 passed**, exit 0, 1.2 min: run restart, Node/browser floor parity and actual combat drop/collection/wallet. The grep did not select the multiplayer test (its title is `multiplayer`), so that suite ran separately below. |
| `npm run e2e -- e2e/multiplayer.spec.ts` |**1 passed**, exit 0, 1.8 min: four clients including late entry, chat, advancing matching snapshots, upload threshold and host departure. This is real PeerJS runtime evidence; maximum multipart entities are covered by unit tests, not claimed as this browser workload. |
| `npm run e2e -- e2e/rogue-pressure.spec.ts e2e/rogue-floor.spec.ts --grep 'generated combat drops\|two browser clients' --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-checks'` |**2 passed**, exit 0, 1.0 min; Gate and wallet screenshots captured and inspected. Gate railings now open onto sky/clouds without arcade walls intersecting the leaves. |
| `git diff --check` |passed. |
| Generator acceptance, full-floor traversal |Not rerun in R2.1: floor generation/pool unchanged. Required on the full R2 pool in R2.6. |
| Benchmarks / human play |Not run / not claimed. |

Browser execution used installed Chromium and public PeerJS outside the restricted process/network sandbox. Test bounds and loading deadlines remain unchanged.

## R2.2: authoritative props

Start SHA `762ed44`. Seed-selected `Floor.props` now supplies identical host/client definitions. IDs combine room and canonical socket index; three loot variants follow canonical loot ordinal, including skipped sockets. The R1 geometry and pinned hash are unchanged. Props have nonblocking 0.5-m cylinders and family heights 1/1.3/1.2 m. Every positive native player attack shares ray/area geometry, stopping/LOS and vertical reach; healing/control-only actions and hostile enemy contact cannot break them.

Accepted loot breaks use the combat/noncombat tables and weighted eight-item catalog. The marked amphora always drops one 6-halo gold pickup without a random draw. Lamps crack immediately and burst six ticks later, resolving due IDs in order: 60 enemy/15 player damage in 4 m, body-center LOS, each chain gets its own six ticks. A blast cannot break a chalice. World heavy kills award no player kill, emit owner -1 bursts and settle the ordinary victim ledger once. Chalices heal all living connected players in 6 m by 30 HP, once, with LOS.

Reliable terminal events and detached broken/pending-blast checkpoints keep late entry and run reset authoritative. Projection rejects malformed payloads without advancing its watermark. Required presentation includes three labeled ivory silhouettes, red-black lamps, gold chalices, shards, blast/heal rings, pending crack glow and the marked 90-tick glint/beam. B1 sources are received and preserved; inspected source images still have a solid green background and no runtime exports. Coded sprites remain the documented fallback; human visual acceptance is pending. The three prop sounds now have catalog-named synthesized cues; received MP3s are not yet runtime WAVs (R2.3).

New files: `src/data/props.ts`, `src/sim/props.ts`, `src/sim/props.test.ts`, `src/client/props.ts`, `src/client/props.test.ts`, `e2e/prop-fixtures.ts`. Updated: `src/gen/generate.ts`, `src/sim/worker.ts`, `src/sim/sim.ts`, `src/net/messages.ts`, `src/client/game.ts`, `src/client/sounds.ts`, `src/audio/sfx.ts`, `src/audio/recorded.test.ts`, `src/debug.ts`, the pressure and multiplayer browser suites, and these milestone/decision records.

| Exact command | Result |
|---|---|
| `npm test -- src/sim/props.test.ts src/client/props.test.ts` | 18 passed before the additional malformed-checkpoint regression. An initial assertion expected a 60-HP Chorister to survive a 70-damage Revolver; corrected the fixture expectation. |
| Final `npm test` | **796 passed across 74 files**, exit 0, 48.71 s; one worker, unchanged 8-ms/tick assertion passed. Includes 19 prop behavior/projection regressions and four new synthesized cue cases. |
| `npm run typecheck` | passed, exit 0. |
| `npm run build -- --logLevel error` | passed, exit 0. |
| `npm run e2e -- e2e/rogue-pressure.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts --grep 'shooting the marked\|generated combat drops\|multiplayer\|second generated run' --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-props'` | 4 passed, exit 0, 3.3 min: real mouse prop break/drop/wallet, combat pickup, generated-run reset, and four-client PeerJS including pre-join prop break restored for the late joiner. Final source rerun recorded below. |

Screenshots were captured and inspected; the central countdown overlays the marked amphora in the early-shot capture, so this is break/wallet runtime evidence, not completed art acceptance. Multiplayer keeps the original loading/network/upload deadlines; its human host remains idle in the Breach while shooting the vase and three bot followers exercise snapshots/chat/late entry/host departure. No benchmark, generator acceptance or human Gate B is claimed at this stage.

Final source rerun: the same exact four-test command above with output directory ending `r02-props-final`: **4 passed**, exit 0, 3.0 min (multiplayer 2.0 min, restart 21.7 s, combat pickup 27.6 s, marked amphora 8.7 s). Production build in that command passed. `git diff --check` passed.

## R2.3: recorded combat sound

Start SHA `42271ee3a73bf300aa8d11e6437dca429150e484`. All 17 S1 families now have three runtime takes (51 WAVs). The nine received prop keepers use the established cutting/normalizing pipeline; original MP3s and spare takes are unchanged. There was no provider request, paid generation or replacement of the previous accepted pilot cuts.

Each sound uses a cosmetic Fisher-Yates shuffle bag, every surviving take once per bag and no repeated boundary take. Only admitted playback advances the bag: rejected voices, inaudible positions, the 30-ms gap and the Recorded SFX toggle preserve it. Failed HTTP/fetch/body/decode or silent/nonfinite recordings leave the other takes available; a wholly failed family keeps its synth. Normalization is finite and capped at 4x. Existing 24 total / 4 per-sound voices, priorities, positional attenuation, pitch, limiter and mass-kill aggregation remain intact. Inherited-name filenames such as `constructor` are rejected.

Named Dominion step/tell/slam, fire ignition and fire/incense ambient synth definitions are ready for their R2.4/R2.5 consumers. Pickup/chalice/prop consumers are already connected. Their optional recordings remain missing; S1 human listening acceptance also remains pending. Decoding or a source file on disk does not grant that acceptance.

Changed: `src/audio/recorded.ts`, `src/audio/recorded.test.ts`, `src/audio/audio.ts`, `src/audio/sfx.ts`, new `src/audio/audio.test.ts`, new `e2e/recorded-sound.spec.ts`, nine `assets/sfx/{porcelainBreak,blastLampCrack,blastLampBurst}-01..03.wav`, and milestone/asset/decision records.

| Exact command | Result |
|---|---|
| `python -I scripts/sfx_cut.py porcelainBreak blastLampCrack blastLampBurst` | Nine mono 48-kHz 16-bit runtime WAVs produced, originals preserved. Initial restricted execution could not launch ffmpeg; the authorized escalation succeeded. |
| `python -I -` (inline WAV-header/content and LFS-source SHA-256 audit) | 51 nonempty mono 48-kHz 16-bit WAVs, all <=1 s; nine original MP3 hashes match committed LFS OIDs. |
| `npm test -- src/audio/recorded.test.ts src/audio/audio.test.ts` | 11 passed. An initial typecheck rejected the test harness's private-field intersection; corrected only its cast. |
| Final `npm test` | **809 passed across 75 files**, exit 0, 52.32 s; one worker, unchanged 8-ms/tick check passed. |
| `npm run typecheck` | passed, exit 0 on final source and browser fixture. |
| `npm run build -- --logLevel error` | passed, exit 0; browser command also built production. |
| `npm run e2e -- e2e/recorded-sound.spec.ts e2e/rogue-pressure.spec.ts --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-audio-final'` | **4 passed**, exit 0, 1.0 min. Native WebAudio observation counted 51 decoded WAVs, real primary recording playback and F8 synth/toggle persistence; an injected three-file corrupt amphora family decoded the other 48 and played the real synth break cue. Existing combat pickup/marked break/wallet checks passed. |

The first browser run passed 3/4 but missed the toggle test's instantaneous mouse click during the Revolver cooldown. The fixture now holds real fire until playback, without changing game code or timing limits; the final four-test run passed. No multiplayer/network code changed in this stage, and no benchmark or human hearing approval is claimed.

## R2.4 authority/wire checkpoint (historical component)

Start SHA `5755024eda5b404c29f8651256e5abc2d8e51740`. This component checkpoint implements Dominion type 4 (1500 HP, radius 0.45, body 3.2, speed 3.5), scaled elite group HP, the two-alive queue cap and the complete host cast/slam/drop path. It is **not** a playable completed R2.4 stage: the runtime pool still has no elite template, and the ring, atlas fallback, sounds and bot consumers are not wired yet.

Host tells use monotonic u32 cast IDs and 45-tick impact deadlines. The accepted feet position follows movement/displacement; tell and 30-tick recovery hold ordinary steering. Strike/cancel both set the next tell >=90 ticks later. Stun, silence, accepted Falling Star launch and removal cancel once; bound alone permits the slam. Height/LOS checks admit exposed +1m daises, block tall walls and exclude hovering/airborne enemies and elite/boss targets. The slam deals 200 to eligible nonelite ground enemies and 40 to players, using existing shield/invulnerability rules. World heavy deaths retain owner -1 and settle ordinary loot once. If Shroud kills another collected caster during a simultaneous strike, that dead actor cannot restart a cast.

At seal, reserve gold in wave/spawn order from H; queued placement does not redirect a consumed/forfeited reservation. Each legitimate ordinary-wave elite death drops its entitled gold, up to two motes within the room's remaining 4/6/8 quota and a 25% weighted item roll. Native cleanup/removal grants no loot. Fodder still places when the two-elite cap blocks another Dominion, and the unfinished elite keeps its wave queued. Historical zero-elite wave records stay byte-identical in the stamped R1 map.

Protocol 4 keeps offsets 0–64 and appends total/local cast counts at 65/66: 67-byte header. All <=3 cast records reserve 19 bytes each in part0 before distributing entity ranges. Each record contains slot u16, incarnation/castId/start/impact u32 and room u8. At 1500 enemies/400 projectiles/160 pickups/four players/three casts, two <=16,000-byte packets total **26,519 B**. Decode/assembly validate count bounds, unique IDs/slots, 45-tick active deadlines and matching complete-snapshot Dominion incarnation/windup state, including when the caster is in part1. Invalid cast attachment never advances the complete watermark. Reliable start/strike/cancel records and detached FloorSync active records carry the same identities/deadlines.

`src/client/dominion.ts` is a pure projection with checkpoint, complete snapshot and reliable state validation; ring centers are matched accepted snapshot feet. It is not attached to `Game` yet. Its `event()` return currently describes a projection mutation: when connecting sound cues, keep reliable cue admission/deduplication independent of snapshot state so a snapshot arriving before its reliable start/strike does not silence the cue. Add that arrival-order regression during the client part.

New: `src/data/dominion.ts`, `src/sim/dominion.ts`, `src/sim/dominion.test.ts`, `src/client/dominion.ts`, `src/client/dominion.test.ts`. Updated: enemy/wave definitions, `src/gen/stamp.ts`, simulation, messages/protocol/version/fingerprint tests, protocol tests and milestone records. Reference `assets/art-src/reference/rogue/dominion-design.png` was inspected: broad ivory/gold armor, folded white wings, dark bronze face and flanged gold mace; sources remain received, no runtime atlas or human visual approval exists.

| Exact command | Result |
|---|---|
| `npm test -- src/sim/dominion.test.ts src/sim/waves.test.ts` | 33 passed before later wire and simultaneous-Shroud/landing regressions. |
| `npm test -- src/net/protocol.test.ts src/sim/dominion.test.ts src/client/dominion.test.ts src/client/snapshots.test.ts src/net/buildFingerprint.test.ts` | 51 passed before the final native landing/snapshot regressions. An initial malformed-state assertion exposed that active cast metadata should match windup state; decode/assembly now enforce that relation. |
| Final `npm test` | **839 passed across 77 files**, exit 0, 53.55 s. One worker, unchanged 8-ms/tick check passed. |
| `npm run typecheck` | passed, exit 0. |
| `npm run build -- --logLevel error` | passed, exit 0. |

Next work within R2.4: wire `Game` to the projection/ring and accepted start/strike/cancel feedback, add tall labeled mace-bearing fallback animation, cancelable tell playback and positional steps, bot ring escape, type-eligible affinity/tag integration and a scoped reproducible dev elite encounter. Test active-cast late entry, cancellation and crowd bait in browsers before calling R2.4 complete or starting R2.5. Full pool adoption remains R2.6; preserve the existing fixed dungeon and source art. The browser session checks here use the unchanged R1 pool, so they do not establish active-elite visual/readability acceptance.

Browser verification: `npm run e2e -- e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts --grep 'multiplayer\|second generated run' --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion-core'` finished **1 passed / 1 failed**, exit 1, 1.5 min. Run reset passed (24.7 s); after successful late entry, the late client returned to Title with `Host left the game` during the three-second chat check, while the other clients remained in-game and had that chat message; no console/page errors were reported. The cause is not established by that output. With no code or threshold change, `npm run e2e -- e2e/multiplayer.spec.ts --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion-core-mp-retry'` then **passed**, exit 0, 2.7 min, including late prop catch-up, chat, 30 advancing consistent snapshot samples, original upload bound and host departure. Both production builds passed. Keep the initial intermittent failure visible; this is not a claim that active Dominion late entry was tested. `git diff --check` passed.

## R2.4 client/bot/encounter checkpoint

Start SHA `e547409`. Game now owns the accepted cast projection and three pooled ground rings; centers match complete-snapshot feet/incarnations, fill and mace raise use the original impact deadline. Snapshot-before-reliable ordering admits each terminal cue once without restarting projection. FloorSync restores only the remaining tell. Accepted cancel/omission/disposal stops its real voice; accepted strike plays the positional slam and ring flash without inventing victims. The tell resumes the buffer at its elapsed offset, uses the existing 24/4 voice caps and fades on cancel. Positional steps track incarnation and distance. Recorded S1 bags, priorities, limiter and sample toggle remain intact.

The received A1 references still have no runtime model/atlas approval. A tall labeled coded ivory/bronze figure with folded wings and a gold mace supplies eight directions, walking, six raise/two release poses, pain and death. Its body reads about 3.4 m, with mace above it. It loads only when authored waves contain Dominions. This is fallback presentation, not delivered/accepted model art. S2 Dominion recordings remain missing; named synths are connected. Spawn rays widen 1.5x for a Dominion. The empty fixture minimap is hidden so it cannot cover encounter feedback.

Bots retain aim/fire/abilities while taking a collision-checked escape from same-room/same-height live rings; probes are bounded at sixteen short paths. Both Chorister and Dominion affinities survive all eight template orientations. Marker tags filter type eligibility before distance and affinity, including ordinary points borrowed by squads/trickles; blocked elite points do not stall fodder. The runtime R1 pool/hash is preserved. The authored Lampstands template is present for the scoped `map=dominion` lab, whose short explicit waves are a dev fixture, not the final generated-room composition. Full pool adoption stays R2.6.

`dev=1&menu=1` enables actual menus/PeerJS with the labeled dev fixture. `readyHold=1` additionally exposes a one-shot prepared-client ready callback for deadline catch-up testing; it sends the normal ready message, never fabricates simulation/snapshot/cast state, and preserves the ordinary 20-second loading deadline. The callback clears on send/disposal/new round. Normal menus and auto-dev behavior retain their defaults.

| Exact command | Result |
|---|---|
| `npm test -- src/client/dominion.test.ts src/audio/audio.test.ts src/data/dungeons/validate.test.ts src/params.test.ts src/sim/dominion.test.ts` | Initial dev fixture validation rejected four S cells inside its combat rect. Corrected the fixture to a legal outside chamber/door/entry. Subsequent run: 51 passed. |
| `npm test -- src/client/dominionBot.test.ts src/client/dominionSounds.test.ts src/gen/spawnAffinity.test.ts src/sim/dominion.test.ts` | 38 passed before final immutable start/actual-room assertions. |
| Final `npm test` | **860 passed / 80 files**, exit 0, 59.33 s; one worker, unchanged 8-ms/tick assertion passed. Earlier complete run also passed (52.64 s). |
| `npm run typecheck`; `npm run build -- --logLevel error`; `git diff --check` | All passed on final source. |
| `npm run e2e -- e2e/dominion.spec.ts --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion'` | 2 passed / 1 failed: native crowd bait/world heavy deaths with zero player kills and Q cancellation passed; late readiness waited for encounter arrival and exceeded its fixture's 15 s wait. |
| Same command, output `r02-dominion-final` | **3 passed**, exit 0, 1.2 min after moving encounter arrival before late prepare; original game loading/network bounds unchanged. This was the two-client late-entry fixture. |
| `npm run e2e -- e2e/dominion.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts --grep 'Dominion\|Blasphemy\|PeerJS\|multiplayer\|second generated run\|two browser clients' --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion-verified'` | 5 passed / 1 failed, 6.0 min: scoped cast tests, generated reset and Node/browser/Gate parity passed. Four-client full-floor test lost clients 2/3 during snapshot sample 20/30; no console/page errors. |
| `npm run e2e -- e2e/dominion.spec.ts e2e/multiplayer.spec.ts --grep 'tells are visible\|multiplayer' --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion-confirm'` | 1 passed / 1 failed, 1.7 min: readable ring/coded mace capture; full-floor late client reported Connection failed before Lobby. |
| `npm run e2e -- e2e/multiplayer.spec.ts --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion-multiplayer-repeat'` | Failed, 2.5 min: all clients returned to Host left during sample 20/30. |
| Same command, output `r02-dominion-lazy-atlas` | Failed, 2.5 min after avoiding unused Dominion atlas allocation: Host left during sample 20/30. No attribution of the earlier failure to that allocation. |
| `$env:HEAVENFALL_E2E_SMALL = '1'; npm run e2e -- e2e/multiplayer.spec.ts --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion-multiplayer-small'` | Failed, 56.8 s: late client Connection failed before Lobby. Optional small-view experiment was reverted; the original suite/config is unchanged. |
| `npm run e2e -- e2e/dominion.spec.ts --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion-four-client'` | 2 passed / 1 failed, 3.9 min: four-client variant exceeded 180 s overall. |
| `npm run e2e -- e2e/dominion.spec.ts --grep 'four real' --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion-four-serial'` | Failed, 1.4 min: after two separately admitted clients, final client did not prepare within unchanged 20 s. |
| `npm run e2e -- e2e/dominion.spec.ts --grep 'PeerJS' --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion-catchup-final'` | 1 passed / 1 failed, 2.4 min: two-client accepted same start/impact/incarnation, zero replayed starts, 30 advancing consistent samples, upload <=437 KB/s and host exit; four-client variant failed another admission at 30 s despite the established loading-throttle fixture. |

`C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4` above is `C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4`. Captures/failed diagnostic artifacts remain there. Browser execution used installed Chromium/public PeerJS outside the restricted process/network sandbox. Process inspection observed substantial memory compression and stalled/low-FPS browser work; the failure cause remains **unproven**. Do not count broader four-client verification as passed or silently relax loading, heartbeat, snapshot, upload or simulation limits. No unrelated apps were stopped and no benchmark ran. The active-cast two-client path is established; larger-session reliability remains a final-checkpoint limitation to resolve/retest while continuing the independent remaining feature work.

Final source browser/audio command: `npm run e2e -- e2e/dominion.spec.ts e2e/recorded-sound.spec.ts --grep-invert 'four real' --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-dominion-client-checkpoint'`: **5 passed**, exit 0, 2.3 min (bait 22.8 s, cancel 23.6 s, accepted late deadline/30 snapshots/host exit 1.2 min, recorded toggle 7.6 s, corrupt-family synth 8.1 s). Production build passed. Tell/ring/fallback captures were inspected. Human readability/feel and larger-session verification remain pending.

## R2.5: Refiner's Fire and dry navigation

Start SHA `769befedba11b1346f7117ff71e8753677f34b82`. One active-room mask applies 7/30 player and 35/30 enemy HP per tick at actual grounded feet contact (0.05 m tolerance). Player damage keeps native mitigation/shield/immunity; hovering Cherubs and airborne feet do not contact. World deaths settle the existing ordinary ledger once without a player killer. Host `ePooled` combines active fire contact and native Field of Blood membership; no new wire flag is invented. Fire stops on clear/result.

Ordinary ground fields retain their old rules. Avoiding types use at most four additional fields with active fire cells excluded, at the existing cadence/clamp. A single cached reverse-ground routing per active room supplies nearest reachable dry anchors (path cost, row-major ties) and escape steps after accepted displacement. No search runs per enemy. Ordinary steering refuses entry into fire; accepted pushes/pulls/knockbacks keep their paths. Casting avoiders escape fire without resetting cast deadlines, then resume their hold on dry ground; root and stun still forbid movement. Caches/fields release when inactive or no avoider remains. Unreachable dry anchors stop and use existing cleanup/recovery.

Three pooled meshes render coded red-orange moving tongues/ground glow and a fixed narrow gold lip along the authored sunk channel boundary. Accepted complete room state drives activation/dim; the accepted seal tick supplies a one-second flare, and late catch-up cannot replay a fresh seal. A room-local nearest sound source scans at four Hz; finite admitted ambient samples share the existing 24/4 voice limits and fade on exit/pause/disposal. Named ignition/fire synths are connected; B10 runtime textures/flames and S8 recordings remain missing/unapproved, with received sources preserved. `map=refiner` uses authored Gridiron geometry and a short explicit dev wave including Choristers for dry-navigation coverage, not final full-pool composition.

| Exact command | Result |
|---|---|
| `npm test -- src/sim/hazards.test.ts src/sim/flowfield.test.ts` | Initial fixtures omitted `activeRoom`, then incorrectly assumed a sub-threshold fire hit must burst. Corrected accepted combat fixtures and used a real same-tick Revolver setup/world kill. A release regression also caught sparse undefined field slots; fixed release. Final 18 passed after one-way-drop and no-escape coverage. |
| `npm test -- src/sim/hazards.perf.test.ts src/sim/hazards.test.ts` | 11 passed; includes 1500 continuously living enemies, four dry fields, 300 measured ticks and full snapshot encoding under the unchanged <=8 ms/tick limit. Inflated test HP maintains the maximum workload; this is not a human crest observation or benchmark. |
| `npm test -- src/client/hazards.test.ts src/client/dominionSounds.test.ts src/audio/audio.test.ts` | 11 passed: accepted activation/dim/no fresh late flare, nearest-source cadence, finite capped ambient voice and lifetime. |
| `npm test -- src/sim/hazards.test.ts src/sim/hazards.perf.test.ts src/sim/dominion.test.ts src/client/hazards.test.ts` | 42 passed after casting-escape, root/stun and immutable impact regressions. |
| Final `npm test` | **880 passed / 83 files**, exit 0, 57.97 s. One worker; both original and additional dry-field <=8-ms assertions passed. Earlier complete runs: 870 and 876 passed before final additions. |
| `npm run typecheck`; `npm run build -- --logLevel error`; `git diff --check` | All passed on final source. |
| `npm run e2e -- e2e/refiner.spec.ts --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-refiner'` | 2 failed: gameplay assertions reached completion, but WebGL rejected GLSL reserved word `active`, so presentation was not passed. Renamed it; no threshold changes. |
| Same command, output `r02-refiner-final` | **2 passed**, 34.9 s; activation, native contact damage and actual autopilot clear/dim. Captures inspected. |
| `npm run e2e -- e2e/refiner.spec.ts e2e/dominion.spec.ts --grep-invert 'four real' --output 'C:/Users/TPouzar/.codex/visualizations/2026/10/12/01a13224-d270-7850-8085-84381d09a6f4/r02-fire-verified'` | **5 passed**, exit 0, 2.3 min on final gold-border/casting-escape code: fire damage and dry safety without God in the damage test, native clear/dim, Dominion bait/cancel and two-client original-deadline/30-snapshot/upload/host-exit regression. |

No benchmark or human Gate B is claimed. The earlier wider four-client failure remains open and was not converted into a pass by these scoped checks. R2.6 must adopt/validate the full pool and crest/warned spawning, then perform final traversal/multiplayer verification.

## Remaining fixture limits and next stage

Six-second crest and remaining templates are still unfinished; fire and Dominion components now exist but broader multiplayer verification is unresolved. This checkpoint must not be labeled the completed R2 milestone. Marked props supply gold halos; legitimate elite deaths use the R2.4 ledger entitlement. No shop, profile, durable money, XP, inventory or build mechanics have been added.

The next ordered implementation is R2.6's full pool, crest pacing and warned fallback spawning. Preserve the R2.4 four-client verification failure as an open checkpoint issue and resolve/retest it before final milestone handoff.

For a quick R2.1 check: run `npm run dev`, open a generated room with `?dev=1&map=rogue&seed=317434499&room=1&class=betrayer&god=1`, shoot the room's enemies and collect halos before they fade. Watch the wallet and motes; move onto a mote at full HP and confirm it waits. These dev/god runs do not establish balance or human Gate B acceptance.

## Overnight continuation

Automation `r02-overnight-implementation` is an active 30-minute follow-up on this chat. It resumes the first unfinished R2 stage, preserves this branch and reports actual checks/commits here. It stops at awaiting-human-play, a user stop, or 08:00 on 2026-10-13 Europe/Prague and pauses/removes itself. It does not authorize R3, pushing, merging, publishing or benchmarks. It must keep missing assets and human acceptance separate from automated evidence.
