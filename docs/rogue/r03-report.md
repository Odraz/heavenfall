# R03 report: durable run and consumables

**October 14 play-feedback follow-up:** [current iteration and verification](r03-followup.md) supersedes the profile-slot UI, automatic pickup use, raw source-art integration and commander behavior described below. Earlier stage results remain historical evidence.


Status: **awaiting-human-play**, 2026-10-14. Start SHA: `a7e002c` on `rogue`. Tomas's “Implement R03” authorizes this milestone; Gate B human acceptance remains unclaimed. Existing edits to `docs/music-prompts.md`, `docs/rogue/audio-prompts.md` and the untracked `assets/music/arena-4.mp3` are outside this work.

## Stage 1 — profile foundation

Implemented as a reviewable backend foundation: strict schema 1, per-class XP/levels, inventory catalog/serialization, bounded MG1 raw-DEFLATE import/export, previous-good backup recovery, mandatory stake-write support and exclusive Web Locks. Unknown content is repaired; malformed/future saves are rejected before writes. No earlier profile format has shipped, so there is no invented schema-0 migration. Debug gameplay will use memory clones before any stake write. Profile menus and gameplay wiring belong to stage 2; no normal run is enabled yet.

Changed files: `src/data/items.ts`, `src/data/pickups.ts`, `src/profile/model.ts`, `src/profile/codec.ts`, `src/profile/storage.ts`, `src/profile/profile.test.ts`, the obsolete weight assertion in `src/sim/props.test.ts`, and this report/brief. Ash/Plume weights now match 14/8. Prices in the unused catalog are provisional at four times the old prices pending economy verification.

Validation: `npm test -- --pool=threads` passed **1,045 tests in 94 files** in 68.75 s, with the configured one worker and unchanged timing limits. Two earlier default-fork `npm test` runs stalled after the first file and were interrupted; that file exposed the old 12/10 assertion, which was corrected. `npm run typecheck` and `npm run build` passed. No browser session/loading behavior changed in this foundation stage, so browser integration checks are deferred to stage 2.

Stage-1 commit: `58e08dc`.

## Stage 2 — admission, recovery and XP

Implemented: three locked profile slots with import/export/delete; normal versus disposable practice admission; durable stake rejection before placement; retained profile/class/token and life state; absolute XP and terminal settlement; a sixteen-run host settlement cache; exact pre-rounding generated wave XP (including actual commander groups); developer-command refusal in progression-enabled simulation. Gameplay still has the temporary immediate boss ending until stage 5. The explicit Practice button clones the selected profile's carried inventory in memory and suppresses every progression write.

Host/worker, lobby, transport, main entry and profile lifecycle modules carry the contract. The generated floor's new XP metadata changes pinned hashes to `4d45505c` (R1 pool) and `74928d57` (full pool), without changing geometry or spawn counts. Protocol/rules: 10/13. No talents, relic awards, deeds or best-time achievements are granted.

Checks: `npm test -- --pool=threads` passed **1,058 tests in 96 files**, 71.27 s. `npm run typecheck` and `npm run build` passed. `npx playwright test --config playwright.hardware.config.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/multiplayer.spec.ts` passed all **6 checks** (1.5 min); after final profile/menu hardening, `npx playwright test --config playwright.hardware.config.ts e2e/profiles.spec.ts e2e/menus.spec.ts` passed all **5 checks** (38.4 s). These exercised actual browser storage/Web Locks and real PeerJS host/guest reconnect, plus the inherited four-client snapshots. One earlier sandboxed browser run passed its four assertions but stalled during shutdown and was interrupted; the successful complete runs used process escalation. Initial unit failures were stale hash/version expectations, corrected with the intentional content/handshake changes.

The browser tests use fresh isolated contexts and generated disposable exports. No user profile was read or modified during testing. Human fight/feel acceptance, asset acceptance and benchmarks remain unclaimed.

Stage-2 commit: `fb67379`.

## Stage 3 — rewards, inventory and personal shop

Implemented deterministic four-item stock and clear rewards, the guaranteed route Rite (explicit six-halo fixture), personal stacks/sold bits, scoped replay-safe purchases, Chart acquisition from the marked prop or party pedestal, and shared reward glyphs on doors/maps. Runtime item/shop/page images use the supplied source art; cutout/visual acceptance remains with Tomas. Prices are provisionally four times the old catalog, with a controlled pinned-floor test collecting the full room budgets through world deaths and contacts. The pinned combat-room budgets are 48/72/120/60/72/72/72, totaling **516 halos** collected by that fixture. Chart + Balm + Ash cost 360, leaving 156 under its ideal collection assumptions. This checks accounting, not realistic human collection rates or final balance.

Checks: `npm test -- --pool=threads` passed **1,063 tests in 98 files**, 72.76 s; `npm run typecheck` and `npm run build` passed. Initial failures were obsolete R02 pickup/shop expectations and canvas/texture mocks. The room-record byte budget remains 1,024 bytes independently of the newly added bounded inventory section. `npx playwright test --config playwright.hardware.config.ts e2e/rogue-floor.spec.ts e2e/profiles.spec.ts` has passed its first eight checks at this commit; the ninth full-floor autopilot check is still running and is not claimed as passed here. A final browser pass will include the last Chart/NPC additions before milestone handoff.

Stage-3 commit: `4599aae`. That browser run subsequently finished **9/9 passed**, 10.0 min, including the full generated-floor autopilot route.

## Stage 4 — all eight consumables

Implemented manual u8 press edges, ordered slot use, shared cooldown, pickup routing, single-channel Seal, Feather speed, accepted/reserved 3D flights and actual landings, room/floor geometry, per-incarnation controls and non-stacking poison pulses. Mirror reflection mutates the original projectile, retains its hostile-budget reservation, respects remaining travel distance and has no globe splash/proc behavior. Item areas survive death, disconnect cancels them, and offensive instances end on clear. Reliable effects restore their original identity/activation/deadline; clients interpolate them. Runtime visuals use colored area outlines/dome, flight markers and the supplied source icons; existing synthesized sounds provide the cues.

Checks: final `npm test -- --pool=threads` passed **1,080 tests in 99 files**, 71.25 s, independently of browser workers. `npm run typecheck` and `npm run build` passed. `npx playwright test --config playwright.hardware.config.ts e2e/profiles.spec.ts e2e/rogue-floor.spec.ts --grep-invert 'solo autopilot'` passed **9/9**, 1.6 min, including real transport retention of a spent Feather and an untouched practice profile. The focused unit test first exposed a fixture enemy intercepting a downward throw at tick 1; the pulse test now separates collision from its stationary area assertion. A later unit rerun was interrupted to avoid overlap with the browser worker, then completed in isolation. A stale-counter regression verifies that a rejected backwards counter cannot rearm an already-used counter.

Stage-4 commit: `93e579d` (includes the final known-item type guard).

## Stage 5 — secured victory and bounded exit

Boss death now secures one victory and carried inventory for every committed unclosed record, including disconnected records. The simulation resolves souls, heals connected living players, removes remaining combat threats and refuses new encounters/admissions. Resuming an admitted post-win record remains allowed. Four personal copies of unbought shop stock appear beside the Stair; purchases retain the same sold bits and update the existing saved settlement. Clear time stops at boss death.

The Stair closes after all connected living humans remain in its two-metre radius for three seconds, thirty seconds after first entry, or the hard 120-second limit. An eligible unclaimed Rite page holds an otherwise due exit for at most sixty total seconds and is reported if left behind. Bots/disconnected records cannot block exit. R04/R06 will add earned chest/Rite-offer entitlements to this predicate; R03 does not pretend those claims already exist.

The lobby shows character levels and allows discarding carried stacks. Item cards mark untried items; level-up has a short cue and unspent-point notice. Results show earned XP and before/after levels. Accepted save failures display an export/retry notice while preserving current memory. Every accepted item use has a run-scoped action ID; refused uses allocate none. Reflection sound is batched at 250 ms.

Final network audit found two lifecycle edges and corrected them: only a reliable host `leave` now settles host exit; an ordinary channel close/heartbeat timeout leaves the unresolved stake available for reconnect. The loading-timeout refund is emitted before the rejection that closes the guest transport. The worker regression checks refund ordering, and the browser reconnect check additionally closes the real guest RTC channels while its tab remains alive.

Changed areas: `src/sim/{victory,shop,consumables,sim,worker}.ts`, corresponding regression tests and `workerSync.test.ts`; `src/net/{messages,version,peerTransport,buildFingerprint.test}.ts`; `src/client/{bot,game,hud,shop,sounds}.ts`; `src/main.ts`, `src/ui/{profiles,results}.ts`, `src/style.css`; profile/floor browser checks and the R03 documentation/manifest. Protocol/rules are **11/14**, with unchanged generated geometry/hashes.

Final unit validation after the network fixes: `npm test -- --pool=threads` passed **1,091 tests in 100 files**, 71.85 s, with the configured single worker and no browser worker running. `npm run typecheck` and `npm run build` passed. The first full run had 1,088 passes and two failures: an outdated build-fingerprint expectation (corrected to 11/14), and the hazard stress test at 11.755 ms/tick against its unchanged 8 ms limit. The isolated `npx vitest run --pool=threads src/sim/hazards.perf.test.ts src/net/buildFingerprint.test.ts` then passed 3/3, followed by a successful 1,090-test full run (90.67 s), then the final 1,091-test run after the network corrections. No timing limit was changed. The initial production run, `npx playwright test --config playwright.hardware.config.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts`, finished with 12 passes and one failed setup assertion (11.6 min), including the 8.7-minute full-floor autopilot/exit. Its new save-failure check pressed an item before the first input baseline; the setup now waits for the playable state before the key edge. The final rerun, `npx playwright test --config playwright.hardware.config.ts e2e/profiles.spec.ts e2e/menus.spec.ts e2e/multiplayer.spec.ts e2e/rogue-floor.spec.ts --grep-invert 'solo autopilot'`, passed **12/12 in 2.8 min**, including accepted-memory export/retry, real RTC disconnect/reconnect, explicit host exit and two successive Stair endings. The earlier full-floor pass exercises the same unchanged solo route/exit code; the final changes concern network loss and loading timeout. Browser checks used the production build and Windows D3D11, in isolated disposable contexts. No check remains blocked.

Stage-5 implementation/end SHA: **`d0a717a`**. The following documentation-only commit records this SHA and final status; it changes no runtime behavior.

## Play this checkpoint

Run `npm run dev`, then open the printed local URL. Use a new disposable profile for normal progression observations. A normal admitted attempt stakes its carried items: death or voluntary pre-win leave loses them; an explicit pre-win host exit restores only the original carried stacks. An unexpected connection loss keeps the attempt unresolved so it can reconnect; if its host can no longer recover it, the next admission resolves it as a loss. XP already checkpointed remains. Victory secures the remaining inventory, and post-win purchases are saved immediately. Reloading a solo run cannot reconstruct its host and resolves its unmatched stake as a loss on the next admission.

For repeatable consumable checks, the four `fixtures/r03-*.txt` saves contain two full item stacks each, zero XP and no active attempt. Import one into an empty slot, or explicitly replace only another disposable fixture. Choose **Practice (disposable)** from the title: this clones its carry in memory and leaves its stored profile unchanged. Keys **1/2** use the two stacks; **F** buys an aimed pedestal within two metres; hold **M** for reward previews. Reimporting/restarting Practice restores the sample. Do not use an unresolved normal profile as debug scratch data.

Samples: [Balm + Feather](fixtures/r03-balm-feather.txt), [Seal + Mirror](fixtures/r03-seal-mirror.txt), [Water + Ash](fixtures/r03-venom-frost.txt), [Chain + Plume](fixtures/r03-chain-plume.txt). All four were generated through `createProfile`/`exportCode` and round-trip validated with `importCode`; no user save supplied their data.

1. With Balm/Feather, press 1 at full health: no charge. Press 2 twice quickly: only one Feather is spent. After a second, another press refreshes its duration without stacking speed.
2. With the other pairs, check Seal refusal above 50 shield; Mirror returning enemy projectiles; Water/Ash landing on the aimed floor; Chain rooting new arrivals once; Plume launching grounded enemies. Check walls, terraces and expiry; death preserves areas, disconnect removes them.
3. On two normal disposable profiles, spend a charge, close/rejoin the guest, and check the retained charge/HP/XP. Exit the host before victory: the guest gets only its original carried stacks back. A second tab must refuse the same profile lock.
4. Buy from the Pardoner, retry F, and try buying with full inventory or insufficient halos. Inspect the Chart and door/map reward glyphs. Rite pages are explicitly six-halo fixtures, once per eligible player.
5. For a quick disposable ending, open `/?dev=1&map=rogue&seed=317434499&room=999&class=fallen&god=1`, wait for the boss seal and press **K**. Inspect the Stair and stock copies, then stand in the beam. For actual persistence, finish a normal disposable run, buy after victory and reload/export the profile. The automated worker regression covers this settlement/purchase sequence; the full normal human fight remains to be observed.

## Remaining human acceptance and later milestones

- Human charge/feel, co-op and purchase-balance acceptance remain open. The controlled full-room currency fixture verifies ledger collection; it is not a measured human pickup rate. Prices remain provisional after R02's quadrupled budgets.
- Item, Chart, page and Pardoner source previews are integrated directly, with source backgrounds still visible. Cutouts, final stall art and visual acceptance remain open. Area outlines/dome/beam and synthesized cues are the current fallbacks; no new recordings or provenance claims were added.
- R04 owns learned talents, real Rite offers and action/proc routing; R06 owns relic/deed/chest/bargain claims. Their hooks are absolute profile checkpoints, scoped replay-safe interactions, action IDs and area incarnations, accepted damage provenance, and the pending-earned-choice exit predicate. No unimplemented reward is granted.
- R07 replaces the inherited boss fixture and extends its rewards; it must use the existing once-only victory settlement and post-win revisions. No authored Gatekeeper, Sundial/deed/best-time acceptance, offline reconstruction or host migration is claimed here.
- Benchmarks were not requested or run. Gate B and asset acceptance have not been inferred from automated checks.
