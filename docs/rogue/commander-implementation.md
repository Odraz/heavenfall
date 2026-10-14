# Cantor and Carrier implementation

**October 14 R03 follow-up supersedes the acquisition and defense rules in this historical report.** Carrier now rushes any nearby visible target without a mark/isolation/crowd prerequisite, deals 2 damage per half-second while carried, and selects a safe crowd drop on grab. Cantor only blocks front damage while warning/singing; its ward and beam interpolate accepted angles. See [R03 follow-up](r03-followup.md) and rooms.md §6 for current rules.



Implemented from `rooms.md` §§6.1–6.3 and the reference art in commit `77fd9cf`.



The first commander in a generated Chorister or Cherub wave now becomes its family master. Additional commanders and duplicate living family masters become Dominions. All three families use the existing commander cap, party scaling, wave ledger, spawn warnings and reward entitlements.



The Lectern Cantor has an authoritative frontal hymnal defense and a geometry-clipped turning beam. Following play feedback, the harmless warning lasts 2.5 s, growing from a 0.04 m to a 0.16 m gold line before snapping to the 1 m damaging beam with a bright core. It shares the Sacrament beam texture and camera-facing ribbon rendering. Active yaw and pitch track at 10 degrees/s; warning tracking is 30 degrees/s. Recovery lasts 2 s and the next warning waits until 6 s after the beam ends. Beam damage and its 3 s duration are unchanged. The Stray-Carrier closes inside its 20 m grab range instead of stopping at the 25 m arrow range. It retains Cherub arrows, selects separated players near a qualifying Blessed crowd, locks a safe swoop and drop destination, and carries the victim using acknowledged host position corrections. Controls, rescue damage, movement abilities, target loss and cleanup release or cancel the corresponding attack. Bots flank the Cantor, avoid both tells and prioritize rescuing carried allies.



Both enemies use atlases built with the existing Blender toon pipeline, palette and rigs. The Cantor has a bronze hinged hymnal, candle crown, cope and exposed silk back; the Carrier has closed eyes, elongated arms and a trailing shroud. Cantor renders all eight views; Carrier uses the Cherub/Dominion convention of five rendered views plus three mirrored views. Source scripts are `scripts/blender/cantor.py` and `scripts/blender/carrier.py`; preview turnarounds are in `assets/art-src/`. The generated atlases are included under `assets/sprites/`. Phase audio uses the existing procedural SFX engine; no external recordings were generated.



Snapshots carry bounded family records with run, revision, incarnation, phase deadlines and accepted orientation. Carry snapshots include the victim's correction ID. Late entry restores the remaining phase rather than restarting it. Protocol version is 9 and rules version is 12; generated-floor hash changes reflect the added wave commander metadata. Transport compression includes the new record section. Only commander atlases used by a map are decoded.



## Play checks



Run `npm run dev` and open:



- `/?dev=1&map=cantor&class=fallen&seed=7`

- `/?dev=1&map=carrier&class=fallen&seed=7`



These use the authored Two Lampstands geometry with short family waves. Enter the arena to start. Developer **G** toggles invulnerability; turn it off to permit a Carrier grab. `god=1` makes invulnerability permanent and deliberately prevents grabs. Cantor can be checked with `god=1`.



For the Carrier, being across the room is not enough: in solo it needs eight living grounded Blessed in one 4 × 4 m room-grid square within 7 m of the player, plus a clear flight path. For a deliberate trigger check, stand in the open just inside the entrance without shooting and let the crowd gather. In the seed-7 simulation, normal-health Fallen players at seven open positions were grabbed roughly 14–17 seconds after entry. Standing close against a pylon can block the required 1 m carry clearance.



Carrier retains the exact authored crowd rule. In a developer session, F3 now shows the last authoritative acquisition decision, the largest nearby square count out of eight, nearby Blessed count, target distance and cooldown. The same local-host information is available as `window.__heavenfall.carrierChecks`, including a decision tick. No diagnostic data is added to remote snapshots. Normal running can keep the crowd too scattered to trigger a swoop; the reported live session still needs this decision data to distinguish crowd rejection from a blocked path.

Human acceptance remains open for silhouette readability in crowds, beam brightness and choir balance, the Carrier's dodge/rescue timing, and solo encounter feel. Automated checks do not establish those judgments.



## Validation



- `npm test -- --reporter=dot`: 93 files, 1,027 tests passed. Timing tests ran with the configured single worker: 4.994 ms/tick for hazard navigation and 3.294 ms/tick for the 1,500-Blessed case, both below the unchanged 8 ms limit. An earlier full run exceeded the hazard timing limit; the isolated timing rerun and this complete rerun passed.

- `npm run typecheck`: passed.

- `npm run build`: passed.

- Before the latest Cantor tuning and Carrier diagnostics: `npx playwright test e2e/commanders.spec.ts e2e/dominion.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts e2e/renderer.spec.ts --grep 'Cantor|Carrier|cantor:|carrier:|multiplayer|four real PeerJS|solo autopilot|native production WebGL'`: **7 passed, 1 failed**. Both family solo checks, both real PeerJS late-join checks, four-client Dominion synchronization, native WebGL snapshots, and the full generated-floor autopilot/boss victory passed. The general multiplayer scenario failed when its fourth client exceeded the existing loading deadline (the client displayed `Loading took too long`); this is an unresolved loading failure, not a passing check. The browser used SwiftShader software rendering. No deadlines were relaxed.

- The latest focused checks cover harmless warning timing, cooldown, sideways escape after a far-range beam hit, actual warning/active ribbon widths, and Carrier rejection diagnostics. Native fixture regressions use the URL seed's derived simulation seed. Browser/E2E revalidation after these changes was not run: live localhost browser access was blocked by admin policy. The earlier browser results above do not validate the latest visual tuning.



No benchmarks were run. Existing Vite native-config migration warnings remain outside this change.
