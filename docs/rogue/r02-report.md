# R2 report: pressure and pickups

**Status: implementing** (2026-10-13). Brief: [r02.md](r02.md). R2.1 is implemented and verified; R2.2–R2.7 remain. Gate B and human feel acceptance are pending. Local branch `rogue`; nothing pushed, merged or published.

## Authorization and Git facts

- Tomas accepted R1 at `de0f8ae724ea25765c446dc45c0ee70ebf94a4fe` ("R01 looks good") and requested a Gate clipping fix, a commit, then independent R02 implementation overnight.
- Gate repair / R2 start SHA: `767b351a039f3d7a7010ce7893d4812ebf0782a9`.
- Local `main` remains `fa9e3f5765cd09d5a315db6342107ff70ad159e8`, the base recorded in R0/R1. Cached `origin/main` is `c5d74e456f9932953d432eaa7e679f427ec8d937`; no fetch, push, main merge or ref replacement was performed.
- R2.1 code end SHA: recorded below after the verified implementation commit.
- Protocol version **3**, rules version **2**. Floor layout/pool/pinned hash remain the R1 fixture until R2.6 introduces the full pool. Restart the dev server after a commit so every participant uses the same artifact fingerprint.

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

## Current fixture limits and next stage

Props, Dominion, fire damage/dry navigation, six-second crest, remaining 10 templates and recorded shuffle bags are still unfinished. This checkpoint must not be labeled the completed R2 milestone. Gold halos can be represented/collected but the marked prop and elite sources arrive in the next stages. No shop, profile, durable money, XP, inventory or build mechanics have been added.

R2.2 begins with the existing `Floor.props` seed-selected sockets in `src/gen/generate.ts`/`assign.ts`/`fallback.ts`. Keep canonical socket identity and loot variant through orientation, rather than rerolling in simulation. The prepared brief defaults to stamping a runtime prop record into RoomDef; an equivalent explicit Floor-derived SimOptions record is a routine implementation choice if it preserves those identities and avoids unnecessary pinned geometry changes. Ensure worker host startup and client Game receive the same selected records. Connect all player attack paths and blasts to the shared prop queries; no enemy walking break and no movement collision. Test and commit this stage before R2.3.

For a quick R2.1 check: run `npm run dev`, open a generated room with `?dev=1&map=rogue&seed=317434499&room=1&class=betrayer&god=1`, shoot the room's enemies and collect halos before they fade. Watch the wallet and motes; move onto a mote at full HP and confirm it waits. These dev/god runs do not establish balance or human Gate B acceptance.

## Overnight continuation

Automation `r02-overnight-implementation` is an active 30-minute follow-up on this chat. It resumes the first unfinished R2 stage, preserves this branch and reports actual checks/commits here. It stops at awaiting-human-play, a user stop, or 08:00 on 2026-10-13 Europe/Prague and pauses/removes itself. It does not authorize R3, pushing, merging, publishing or benchmarks. It must keep missing assets and human acceptance separate from automated evidence.
