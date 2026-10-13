# R03 report: durable run and consumables

Status: implementing, 2026-10-13. Start SHA: `a7e002c` on `rogue`. Tomas's “Implement R03” authorizes this milestone; Gate B human acceptance remains unclaimed. Existing edits to `docs/music-prompts.md`, `docs/rogue/audio-prompts.md` and the untracked `assets/music/arena-4.mp3` are outside this work.

## Stage 1 — profile foundation

Implemented as a reviewable backend foundation: strict schema 1, per-class XP/levels, inventory catalog/serialization, bounded MG1 raw-DEFLATE import/export, previous-good backup recovery, mandatory stake-write support and exclusive Web Locks. Unknown content is repaired; malformed/future saves are rejected before writes. No earlier profile format has shipped, so there is no invented schema-0 migration. Debug gameplay will use memory clones before any stake write. Profile menus and gameplay wiring belong to stage 2; no normal run is enabled yet.

Changed files: `src/data/items.ts`, `src/data/pickups.ts`, `src/profile/model.ts`, `src/profile/codec.ts`, `src/profile/storage.ts`, `src/profile/profile.test.ts`, the obsolete weight assertion in `src/sim/props.test.ts`, and this report/brief. Ash/Plume weights now match 14/8. Prices in the unused catalog are provisional at four times the old prices pending economy verification.

Validation: `npm test -- --pool=threads` passed **1,045 tests in 94 files** in 68.75 s, with the configured one worker and unchanged timing limits. Two earlier default-fork `npm test` runs stalled after the first file and were interrupted; that file exposed the old 12/10 assertion, which was corrected. `npm run typecheck` and `npm run build` passed. No browser session/loading behavior changed in this foundation stage, so browser integration checks are deferred to stage 2.

Checks and completion SHAs will be recorded when each stage is verified. No human play, transport/storage observation, benchmark or asset acceptance is claimed.
