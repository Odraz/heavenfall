# R03 report: durable run and consumables

Status: implementing, 2026-10-13. Start SHA: `a7e002c` on `rogue`. Tomas's “Implement R03” authorizes this milestone; Gate B human acceptance remains unclaimed. Existing edits to `docs/music-prompts.md`, `docs/rogue/audio-prompts.md` and the untracked `assets/music/arena-4.mp3` are outside this work.

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

Implemented deterministic four-item stock and clear rewards, the guaranteed route Rite (explicit six-halo fixture), personal stacks/sold bits, scoped replay-safe purchases, Chart acquisition from the marked prop or party pedestal, and shared reward glyphs on doors/maps. Runtime item/shop/page images use the supplied source art; cutout/visual acceptance remains with Tomas. Prices are provisionally four times the old catalog, with a controlled pinned-floor test collecting the full room budgets through world deaths and contacts. This checks accounting, not realistic human collection rates or final balance.

Checks: `npm test -- --pool=threads` passed **1,063 tests in 98 files**, 72.76 s; `npm run typecheck` and `npm run build` passed. Initial failures were obsolete R02 pickup/shop expectations and canvas/texture mocks. The room-record byte budget remains 1,024 bytes independently of the newly added bounded inventory section. `npx playwright test --config playwright.hardware.config.ts e2e/rogue-floor.spec.ts e2e/profiles.spec.ts` has passed its first eight checks at this commit; the ninth full-floor autopilot check is still running and is not claimed as passed here. A final browser pass will include the last Chart/NPC additions before milestone handoff.

Stage-3 commit: `4599aae`. That browser run subsequently finished **9/9 passed**, 10.0 min, including the full generated-floor autopilot route.

## Stage 4 — all eight consumables

Implemented manual u8 press edges, ordered slot use, shared cooldown, pickup routing, single-channel Seal, Feather speed, accepted/reserved 3D flights and actual landings, room/floor geometry, per-incarnation controls and non-stacking poison pulses. Mirror reflection mutates the original projectile, retains its hostile-budget reservation, respects remaining travel distance and has no globe splash/proc behavior. Item areas survive death, disconnect cancels them, and offensive instances end on clear. Reliable effects restore their original identity/activation/deadline; clients interpolate them. Runtime visuals use colored area outlines/dome, flight markers and the supplied source icons; existing synthesized sounds provide the cues.

Checks: final `npm test -- --pool=threads` passed **1,080 tests in 99 files**, 71.25 s, independently of browser workers. `npm run typecheck` and `npm run build` passed. `npx playwright test --config playwright.hardware.config.ts e2e/profiles.spec.ts e2e/rogue-floor.spec.ts --grep-invert 'solo autopilot'` passed **9/9**, 1.6 min, including real transport retention of a spent Feather and an untouched practice profile. The focused unit test first exposed a fixture enemy intercepting a downward throw at tick 1; the pulse test now separates collision from its stationary area assertion. A later unit rerun was interrupted to avoid overlap with the browser worker, then completed in isolation. A stale-counter regression verifies that a rejected backwards counter cannot rearm an already-used counter.
