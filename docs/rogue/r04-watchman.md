# R04 follow-up: the Watchman

**Status: prepared, 2026-10-16.** Design accepted by Tomas in conversation the same day. Not implemented. Implement it on `rogue` after the R04 code (`33abfa9` and later), as an R04 follow-up like [r03-followup.md](r03-followup.md). It does not advance R05 or claim Gate C. The mechanics live in [rooms.md §6.4](rooms.md#64-the-watchman) and [game.md](game.md) §4.4–§4.6 and §6.1–§6.3; this brief only orders the work.

## Why

With only Blessed in play, and especially in pure-Blessed rooms, standing and shooting or walking slowly backward is usually enough. The Blessed (4 m/s) are slower than every class, and the globes and arrows can be sidestepped in the open. Nothing punishes standing in the open. The Watchman is an armed Blessed that walks with the crowd, shows a 1 s gold aim thread and then hits instantly unless cover blocks the line. Each time, the party chooses between stepping behind a pillar and pushing through the crowd to kill it.

**Before:** in the Cloudbridge's last wave, the party backs away along the basin and shoots the 224 Blessed that follow. **After:** 7 of those are Watchmen (up to 4 alive at once). Their threads find whoever leads, so the party either uses the bridges and the basin walls as cover or the Fallen pushes in while the Betrayer picks the Watchmen out over the crowd.

## Playable outcome

- Watchmen appear in generated rooms from the second wave on, about 1 per 30 Blessed (1 per 12 in ranged rooms), never with Cherubs, in the crest, in trickles or at the boss.
- Each one walks to within 20 m with line of sight of the nearest player, aims for 1.0 s with a visible thread and a rising note, fires 12 damage if the line is clear, and reloads for 1.5 s.
- Cover, Discord, Blasphemy's stun, a launch and One of Them all answer it; killing it (60 HP) ends it.
- A dev fixture `/?dev=1&map=watchman` shows them in a room with pillars.

## Affected code (inspected at `33abfa9`)

| Concern | Where | Change |
|---|---|---|
| Type and stats | `src/data/enemies.ts` | `WATCHMAN = 8`; `{ hp: 60, radius: 0.35, height: 1.8, speed: 3.5, flying: false, draw: 1.15 }`. |
| Wave conversion | `src/gen/stamp.ts` (`waveCounts`, the `waves` map), `src/data/dungeons/types.ts` (`WaveDef`) | Add `watchmen` and its `xp` entry. The conversion runs after the rounded counts, from wave index 1, skipping Cherub waves; it subtracts `3 × W` from Blessed count and Blessed XP. Crest and boss are untouched. Generated-floor hashes and pinned floors (`src/gen/floors.gen.ts`, `pinned.ts`) change only in their wave data. |
| Spawning | `src/sim/sim.ts` (squads, `SPAWN_TYPES`), `src/sim/director.ts` | Squad placement like Choristers; the per-room alive cap `ceil(4 or 6 × mult(P))`, with a queue that keeps the wave unfinished until placed. Bell conversion uses the same function. |
| Behavior | `src/sim/sim.ts` (`CASTERS`, caster tick) | A caster entry `{ range: 20, windup: 1.0, recovery: 1.5, damage: 12 }` with an instant kind: target locked at aim start, one terrain trace (`los.ts`) at the fire tick, 30 m reach, spark end point. Cancellation and target-loss rules of rooms.md §6.4. |
| Rewards and talents | `src/sim/rewards.ts` (halo weight, mote and item chances), `src/sim/talents.ts` (`caster()` for One of Them), `src/client/talentClient.ts`, `src/client/wading.ts` | Treat the Watchman as an ordinary ranged enemy (weight 3, mote 35%, item 12%); it hides from One of Them; players wade through it like a Blessed. |
| Network | `src/net/protocol.ts`, `src/net/messages.ts` (`floorSync`), `src/net/version.ts` | The 19-byte aim record, at most 8 per snapshot, validated like the commander records. **Protocol 12 → 13, rules 22 → 23.** No save schema change. |
| Presentation | `src/client/game.ts`, `src/client/commanders.ts`/`commanderView.ts` pattern, `src/render/animAtlas.ts`, `src/client/enemyAnim.ts`, `src/client/sounds.ts` | The thread (reuse the Cantor's ray ribbon at 0.02–0.05 m), muzzle flash, tracer to the encoded end, spark on cover, the atlas and two sounds. Until the atlas exists: the Blessed atlas with a coded gold rod and a clear label in dev builds. |
| Bots | `src/client/bot.ts` | A bot that a Watchman aims at shoots that Watchman first when it is within the bot's range. |
| Dev fixture | `src/data/dungeons/index.ts` (`familyLab` pattern) | `map=watchman`: one room with four pillars, Blessed waves with Watchmen from wave 2. |

## Ordered stages

Each stage ends with the complete unit suite, `npm run typecheck` and `npm run build` (AGENTS.md). Timing-sensitive checks run without competing workers. No benchmark unless Tomas asks.

1. **Composition.** Type, stats, `WaveDef.watchmen`, conversion, XP ledger, alive cap and queue, Bell conversion, dev fixture. *Tests:* the two rooms.md examples (224 → 203 + 7; Choir Loft 112 → 85 + 9); `B < 30` gives none; wave 1, Cherub waves and the crest give none; each wave's TP and XP sum is unchanged; solo and four-player caps (2/3, 4/6); queued Watchmen keep the wave open. Commit.
2. **The shot.** Caster behavior, LOS trace, damage and mitigation, cancellation, target loss, taunt, One of Them, rewards, wading. *Tests:* a clear line deals 12 at the fire tick; a pillar between them at the fire tick deals nothing and records the blocker's end point; a target moving out of sight mid-aim still gets a shot into cover; stun, silence, launch and death cancel with no damage and start the reload; a shield absorbs; invulnerability ignores; a taunted Watchman targets the Fallen; a hidden Betrayer is dropped; the drop chances use the ranged constants. Commit.
3. **Network, presentation and bots.** Aim record, protocol/rules bump, thread, flash, tracer, spark, placeholder look, synthesized sounds as fallback, bot priority. *Tests:* encode/decode round trip and rejection of a ninth record, a bad phase or a stale incarnation; a rejoin mid-aim restores the remaining thread from `fireTick`; a repeated `shot` counter plays nothing twice; the bot picks the aiming Watchman. *E2E:* a new `e2e/watchman.spec.ts` on the production build: in the fixture the player in the open loses 12 HP after the thread, and behind a pillar loses nothing. Then rerun `e2e/multiplayer.spec.ts`, `e2e/commanders.spec.ts` and `e2e/rogue-floor.spec.ts`, because networking and room spawning change. Commit.
4. **Art and sound.** When the A5 images arrive ([art-prompts.md](art-prompts.md#a5-the-watchman)): `scripts/blender/watchman.py`, built from `blessed.py`'s body and rig with the helmet, plume and Clarion added, rendered to `assets/sprites/watchman/` (8 directions; idle, walk, aim, fire, reload, pain, death). Recorded sounds `watchmanAim` and `watchmanShot` when chosen ([audio-prompts.md](audio-prompts.md#watchmanaim--the-watchman-aims--keep-1--r04-follow-up)). *Tests:* the atlas loads only on maps that have Watchmen; the frame tables match the enemy states. Visual check in the fixture and a generated room. Commit.

Stages 1–3 make a complete playable feature with the placeholder look. Stage 4 can land later without changing the rules.

## Your inputs

- **Art:** make the three A5 images, the design first as the pilot ([art-prompts.md](art-prompts.md#a5-the-watchman)). Required for the finished look; the placeholder is a labeled Blessed with a gold rod.
- **Sounds:** `watchmanAim` (keep 1) and `watchmanShot` (keep 3, it repeats). Optional; synthesized cues are the fallback.
- **Defaults to confirm in play, not now:** Mirror Ward doesn't stop the shot (it isn't a projectile); there is no screen-edge arrow for an aim from off screen (the positional note and the thread must be enough). If off-screen shots feel unfair, a screen-edge arrow is the first fix to consider.

## Play checklist

1. Fixture: `npm run dev`, open `/?dev=1&map=watchman&class=fallen&seed=7`, enter the room. In wave 2, stand in the open and watch a thread, then step behind a pillar during the next aim: the shot should spark on the pillar. Push into the crowd and kill a Watchman; the next queued one should replace it.
2. Generated run: `/?dev=1&map=rogue&class=betrayer&seed=317434499&build=marksman`. In a pure-Blessed room (the Gridiron or the Kilns, if the floor has one) and a ranged room, play normally.
3. **What to judge:** do you now move to cover or push instead of backing away? Can you always see who is shooting you? Is 12 every 2.5 s with up to 4 (6 in ranged rooms) at once too much or too little? Do the Watchmen read as a different enemy among the Blessed?

Use a disposable profile for dev runs; never your normal progress.

## Completion and report

Done when stages 1–3 pass their checks and the rules in rooms.md §6.4 hold in the fixture and a generated room; stage 4 when the atlas and chosen sounds replace the placeholders. Write the results as `r04-watchman-report.md`: starting SHA, changed files, protocol/rules versions, the exact commands and their results, checks not run, and anything left for your playtest. Fun and fairness of the shot are your call after playing, not something the automated checks prove.
