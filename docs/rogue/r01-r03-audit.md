# R01–R03 audit

Read-only review of branch `rogue` at `3680857` (2026-10-15), requested by Tomas after R01–R03 were implemented by another model. Nothing in the code was changed. Each finding says what is wrong, where, why it matters and what I would do. **Your call** marks the ones where I need a decision before fixing.

## Summary

The foundation is sound. The generator, room lifecycle, run identity, protocol bounds, profile saving and reconnect logic are careful and heavily tested (about 1,100 unit tests plus browser checks). I found no reason to rebuild any of it.

The "feels different" comes from four other places:

1. **Numbers that changed one at a time and were never rebalanced together.** Halo income, item drops, prices and rewards each moved in a different playtest round. Together they no longer make a coherent economy (B1), and one leftover rule fills the pickup pool with items (A1).
2. **UI built outside the existing look.** The new HUD and menu parts use different fonts and colors from the rest of the game, and two menus break your "panels never move or resize" rule (A2, A3, C1–C3).
3. **Specs that contradict each other and the code.** Each follow-up added a note on top instead of updating the owning section, so the same rule now has two or three versions (D1–D4).
4. **Code written denser than the rest of the project.** It's harder to read and review, and `sim.ts` grew by 1,200 lines instead of new modules taking the new behavior (E1–E4).

Suggested order: fix A1–A3 and the docs first (no design questions), then decide B1–B4 with a playtest, then restyle the UI (C), then the behavior-neutral code cleanup (E), all before R04 starts adding talents on top.

## A. Bugs

### A1. World items never expire and fill the pickup pool (high)

- **What:** consumable pickups (kinds 3–10) have no expiry (`src/sim/pickups.ts:39`) and count against the 128-slot ordinary pickup cap (`fits`, same file). When your two stacks are full, items stay on the floor until the run ends (game.md §7.3, October 14 rule).
- **Scale:** on four generated floors (seeds 317434499, 0x12ebaa83, 12345, 987654), the waves at four players hold about 3,800–4,100 Blessed, 70–90 Choristers/Cherubs and 28–31 commanders. With the drop chances in `enemyDrops` (`src/sim/sim.ts:2320`: Blessed 2%, ranged 12%, commanders 50%) that's **about 100–108 item drops per floor**, plus clear rewards. Solo has fewer enemies, but still dozens.
- **Effect:** once uncollected items fill the pool, new coins can only merge into a coin within 3 m, otherwise they're forfeited. Heal motes go to a 32-entry waiting queue, then get discarded. Late in a floor, halo income and healing silently disappear, mostly in co-op, which is exactly where the crest is.
- **Fix:** give world items an expiry like coins (e.g. 60 s), or remove uncollected items from a room once it's cleared and the party leaves. Lowering the drop rates (B1) also helps, but doesn't fix the underlying leak.

### A2. Settings makes the title panel grow and move (medium, your UI rule)

Measured at 1280×720: the title panel is 380×377 px. Opening Settings makes it 380×418 and shifts it 21 px up. The old CSS comment said *"Settings replaces the panel's contents, at the panel's size"*. Commit `83481d2` replaced it with *"grows to contain every control"* (`src/style.css`, `.panel.settings-open`). **Fix:** fixed panel size, with the extra controls scrolling inside it or the Settings rows tightened to fit.

### A3. The Profile panel grows when a message appears (medium, your UI rule)

Pressing **Clear** on the Profile screen grows the panel from 561 to 617 px and moves it 22 px up, because the confirmation text is inserted into an empty line. **Import** does the same. The button text also changes from `Clear` to `Confirm clear`. **Fix:** reserve the message line's height, and keep button widths stable.

### A4. Stray-Carrier code and spec disagree (medium, **your call**)

Commit `83481d2` ("Fix Carrier flight, damage…") changed the numbers without updating rooms.md §6.3 or r03-followup.md:

| Rule | Spec (rooms.md §6.3, r03-followup) | Code (`src/data/commanders.ts`, `src/sim/commanders.ts`) |
|---|---|---|
| Carry damage | 2 every 0.5 s | **10 every 0.5 s** (20/s; a full 3.5 s carry deals ~70 before mitigation, over half the Betrayer's 120 HP) |
| Solo carry limit | 2.5 s | **3 s** (`CARRIER_MIN_HOLD = 90`) |
| Earliest release at destination | after 1 s | **after 3 s** (same constant used for both) |
| Rush aim | locked at rush start | tracks for 0.2 s, then locks |
| Damage during the rush | not listed as an interrupt | **any damage at all cancels it** (`damaged()`) |

The last row means one bullet stops every rush. Against a party that shoots it, the Carrier would rarely complete one. If you asked for this in chat, the spec just needs updating. If not, it's a behavior change nobody signed off. Tell me which numbers are right and I'll make the code and doc agree.

### A5. Developer text shown to players (low)

On level-up the HUD shows *"Unspent points (talents arrive in R04)"* (`src/client/game.ts:967`). Milestone names don't belong in the game. Hide the notice until R04 adds a way to spend points (see B4).

### A6. Items can't be used while carried (low, **your call**)

`Consumables.use` refuses while a Carrier holds you (`src/sim/consumables.ts:46`). Spec §6.3 says the victim keeps aiming, shooting and using non-movement abilities. A Balm or Seal while carried seems like exactly the kind of decision you'd want. Either allow non-movement items, or write the exception into the spec.

## B. Design contradictions

### B1. The economy no longer adds up (high, **your call**)

Each change made sense on its own; together they cancel each other out:

- R02 quadrupled room halo budgets to 48–132 per room, about 516 halos on the pinned floor.
- R02 added item drops from ordinary Blessed (2%), which gives the ~100 free items per four-player floor from A1.
- R03 quadrupled shop prices to 100–180 halos per item and 120 for the Chart.
- Clear-reward gold, commander gold and the Rite fixture stayed at **6 halos**.

What this does to the choices the slice is built around:

- **Shop:** with items raining from the crowd and only two slots to hold them, buying one for 100–180 halos is rarely worth it.
- **Door previews (Gate A's "is choosing a route a decision?"):** a door's reward is nothing (30%), a 6-halo gold halo (25%), an item (20%, but items already rain) or a Rite page that pays 6 halos until R04. 6 halos is about 5–12% of one room's income. The preview icons promise something the reward doesn't deliver.
- **Diving into the crowd (Gate B):** coins do make that worthwhile, but there's little to spend them on that drops don't give you anyway.

My suggestion, to check in a playtest:

- Make items rare and special: drop them only from commanders and ranged enemies, or from Blessed at about 0.2%.
- Scale gold halo rewards with the budget, e.g. ×4 = 24.
- Keep prices where they are, then read the actual halos per floor from a real run before tuning further.

### B2. You can no longer bait the Dominion into its own horde (medium, **your call**)

The October 13 follow-up changed both slams to zero enemy damage: they only throw enemies (`r02-playtest-report.md`, "Dominion pacing and leap follow-up"). The playtest report says this was your request. But the README ("the Dominion's telegraphed mace can be baited into its own horde"), r02.md's playable outcome and the Gate B question ("did you bait a slam into the crowd?") still describe the old rule. The only remaining payoff is throwing enemies into fire or near a candle.

- If displacement-only is what you want, I'll update those docs and the Gate B question.
- If you liked the bait moment, a small friendly damage value (e.g. 40, enough to kill Blessed) brings it back without making slams a free crowd-clear.

### B3. Pressure has stacked up (medium, check in playtest)

Each item below was requested separately. Nobody has looked at their sum:

- Commanders ramp by wave (0/1/2/3…), about 28–31 per four-player floor.
- The Dominion: 80-damage slam with a launch, a leap that aims one second ahead of your movement, and melee between casts.
- Backward running is 20% slower.
- The Carrier rushes and deals 20/s while carrying (A4).
- The Cantor's beam: 90 damage for a full beam.

The premise ([core fun](../m12.md), playtest 2) was hordes plus co-op AoE, with elites as spice. In the next playtest, check whether rooms feel like clearing hordes or like dodging commanders while the horde waits. If the second, lower the ramp (e.g. 0/1/1/2) before tuning individual numbers.

### B4. Placeholders shown as features (low, **your call**)

These appear in player-facing UI before the systems behind them exist:

- Character levels, the XP bar and the unspent-point notice (talents arrive in R04).
- "No relics collected" on the class screen (relics arrive in R06).
- Rite pages that pay 6 halos.

Players read them as broken or pointless. I'd hide the relic line, keep the XP bar (progress is real and saved) and drop the unspent-point notice until R04.

## C. Why the new UI looks different

### C1. New HUD and menu parts ignore the design tokens (medium)

`src/style.css` defines the game's look in `:root`: `--display-font` (Cinzel), `--soot`, `--gold`, `--ivory` and `--brimstone`. Every R01–R03 addition bypasses them. Computed styles in the running game:

| Element | Font | Text color | Background |
|---|---|---|---|
| HP text, enemies remaining, countdown (older) | Cinzel | ivory `#f7f0dc` | — |
| XP bar (new) | Georgia 12px | `#fff2ce` | — |
| Halo wallet (new) | Georgia 26px | `#ffe3a0` | purple-black `#19151b` |
| Room message (new) | Segoe UI | `#ffd27a` | purple-black `#19151b` |
| Class level, carried items (new) | Georgia | `#e4c277` | `#18141b` |

That's three fonts and two background families on one screen. `#19151b` has a purple tint the old brown-black panels (`rgba(14, 10, 8)` / `--soot`) don't have. **Fix:** move every new rule onto the tokens and reuse the existing panel/frame classes.

### C2. New HUD parts are plain next to the painted ones (medium)

- The ornate gold-framed HP bar sits beside a thin unframed XP strip.
- The wallet draws its halo as a CSS ellipse, although the game has `gold-halo` art.
- Empty item slots are blank dark squares with no sign of what they're for.

Following your HUD readability rule, they should get the same frame and plate treatment as the ability slots. I'd treat this as one small UI pass, with screenshots at 1280×720 and 1920×1080.

### C3. New CSS is appended as one-line rules (low)

The R1.5–R03 rules are about 50 single-line declarations at the end of `style.css`, and some override earlier sections with a later selector (`.boss, .countdown-line { top: 62px; }`). The older sections are multi-line and grouped by feature. That makes the next change risky. Fold them into the sections they belong to as part of C1.

## D. Documentation

### D1. Statuses and rules contradict each other (medium)

- game.md line 7 says the Cantor and Carrier are "accepted design, not implemented"; rooms.md §6.1 says they're implemented.
- README and r02.md still sell baiting the Dominion into its horde (B2).
- r02.md's fixture limits say items are used on touch; game.md §7.3 now forbids that. Game.md line 1006 still mentions "manual/automatic use".
- rooms.md §6.3 gives the carry speed as 3.5 m/s in its table and 6 m/s in its step list (the code uses 6).
- r03.md and r03-report.md each start with a banner saying a later file supersedes them. A reader has to piece the current rules together from three documents.

**Fix:** update each rule in its owning section (game.md, rooms.md, items-relics.md), and turn the historical banners into a single "superseded" line.

### D2. The last behavior commit isn't documented (medium)

`83481d2` changed Carrier damage, flight and interrupts (A4) and Settings layout (A2), but has no report entry and no spec update. Every later reader will trust the spec.

### D3. The decision register stopped being a register (low)

`implementation-decisions.md` was meant to be a table, one row per decision with your approval. After R1.6 the rows stop. Later decisions are long prose paragraphs inserted above the table, newest first, dense with protocol/rules version numbers. One row from 2026-10-12, the Choir Loft lamp move, is still "Pending your review". **Fix:** convert the paragraphs back into short rows, and get your answer on the Choir Loft row.

### D4. Reports bury what you need (low)

r02-report.md, r02-playtest-report.md, r03-report.md and r03-followup.md are mostly command logs and test counts, with the player-facing changes spread through them. I'd start each report with three short lists (what changed for the player, what to try, what's still open) and move the logs to the end.

### D5. Item IDs don't match item names (low)

`venom` is Bitter Water and `frost` is Ash of Stillness (`src/data/items.ts`). The fixture `r03-venom-frost.txt` is described as "Water + Ash". The IDs are save data now, so keep them, but use the item names in docs and test titles.

## E. Code health

None of these change behavior. They make the next milestones safer to build.

### E1. `sim.ts` absorbed most of the new behavior (medium)

`src/sim/sim.ts` grew from 3,189 to 4,413 lines. Commanders, consumables, pickups and props got their own modules, but these stayed inside the main simulation class:

- Dominion leap targeting and flight (`dominionLeapTarget`, `updateDominionFlight`, `dominionPhase`).
- Enemy rewards and XP (`enemyDrops`, `settleEnemyXp`, `awardXp`).
- Clear rewards and the Chart.
- The shop/Stair interaction (`interact`).

`src/sim/dominion.ts` is only 45 lines. R04's talents will need to hook into exactly these paths. **Fix:** move them into `dominion.ts` and a new `rewards.ts`/`shop` module before R04.

### E2. Magic numbers in authority code (low)

- Pickup kinds `13` (Chart) and `15` (Rite page) are written as bare numbers in `sim.ts`, although named constants exist for the others.
- Shop source IDs encode the pedestals as 0–3, the Chart as 4 and the Stair copies as 5–8 inline.
- The exit timers in `victory.ts` (3600/900/90/1800 ticks) and the multiplayer carry limit (`105`) are unnamed.

### E3. Test diagnostics live in the simulation (low)

`Commanders` keeps a `CarrierCheck` record with text reasons ("crowd too small", "swoop path blocked"), updated every half-second per Carrier. It's labeled "local host diagnostics only", but it's test scaffolding inside the authoritative simulation. Move it behind the dev flag or into the tests.

### E4. Denser style than the rest of the project (low)

| Modules | Average line length | Lines over 200 characters |
|---|---|---|
| Older (`combat.ts`, `director.ts`, `hud.ts`) | 35–45 characters | none |
| R03 (`commanders.ts`, `consumables.ts`, `profile/model.ts`) | 60–74 characters | some |

The R03 modules also often put several statements on one line and use single-letter names across long functions. The older code cites spec sections in comments (`M12 §4.1`); much of the new code doesn't. New code should follow the older style.

### E5. Three-slot profile code kept for saves that barely existed (low, **your call**)

`src/profile/storage.ts` still scans three profile slots so it can migrate "legacy" saves. Those came from the three-slot screen that existed for about a day during R03 stage 2. If you don't have saves you care about in slots 2–3, this can go back to one key.

### E6. Every pickup on the floor goes to every player, every snapshot (low)

`prepareSnapshot` sends all live pickups, including items lying in rooms nobody is in. It fits the packet budget today, but A1 makes the pool larger. Sending only pickups in the recipient's current room (late entry already gets them through `FloorSync`) would remove that cost.

## What this audit did not cover

- **R01 generator internals:** you accepted R01. I relied on its tests and the 1,000-floor check.
- **Line-by-line review:** I didn't review the networking/protocol code, bots, audio or art pipeline line by line.
- **Feel and balance:** I read the code and docs, measured enemy counts on four floors, and inspected the title, Settings, Profile, class selection and in-game HUD in a dev build at 1280×720. I didn't playtest, and no benchmark was run.
- **Test suite:** I didn't run it, since nothing changed.

## Your feel notes

Add what feels off here, one line each ("when X happens, it feels Y"). I'll map each note to a finding above or add a new one.

- Profile screen looks off, awkward.
- In Lobby screen, Carried items part seems weird, especially when empty
- Some map room icons are weird non-understandable (ranged, entry room), some are fine though (hazrad, horde, flying)
- Letters under the room icons seem unnecessary
- UI of usable items (inventory) looks weirdly duplicated above Q/E actions. I would like to try circular buttons to distuingush them from abilites.
- All items overall feel weak and unclear what they do. Instead of poping up text when I pick them up, I would like to see hint in hint window explaining what items I carry do
- EXP bar feels of. It is not framed, colors looks ugly
- HALO counter in top left corner also looks off
- It is weird tham some decorations are indestructable and some are not, it is hard to tell which are which.
- I would like to increase rate of dropping items from destructable decorations
. HP bar should be green I guess since every healing thing is green. Maybe it could go orange and red when almost empty.
- Visual effects of Dominion, Carrier and Cantor need some touch up. Currently, it is hard to tell that Dominion is chargin. I think the effect needs some verticaliy like the Betrayer's pool of blood or I dont know. Beam of Cantor could feel more powerfull.
- I would bring back Dominion and Cantor hurting enemies. The Dominion slam could hurt and throwback more the closer you stay to him.
- When reward arrives after clearing room I usually never notice, it needs more visual and audio telling. Probably some noticable beam from the sky.
- It still feels like enemies drop too little halos.

## How the notes map to findings

| Your note | Finding | Batch |
|---|---|---|
| Profile screen looks off | A3 (panel jumps) + C1–C2 (look) | 1 (jump), 2 (look) |
| Carried items in the lobby look weird, especially empty | C1–C2, B4 | 2 |
| XP bar unframed, ugly colors | C1–C2 | 2 |
| Halo counter looks off | C1–C2 | 2 |
| Item slots look duplicated above Q/E; try circular buttons | C2, new: distinct item-slot shape | 2 |
| HP bar should be green, then orange and red when low | New: HP color states match the green healing language | 2 |
| Map room icons unclear (ranged, entry room) | New: map icon readability | 2 |
| Letters under room icons unnecessary | New: remove map letters | 2 |
| Reward after a clear goes unnoticed; beam from the sky | New: reward arrival beam and sound; also B1 | 3 |
| Can't tell breakable decorations from scenery | New: one consistent breakable tell | 3 |
| Items feel weak and unclear; explain carried items in the hint window | New: carried-item hints; also item strength (Bitter Water does 10/s, half a Blessed) | 3 (hints), 4 (strength) |
| Dominion charge hard to read, needs verticality; Cantor beam should feel stronger | New: commander effect pass. The Cantor already damages enemies (20 per pulse), so its friendly damage is currently invisible | 3 |
| Bring back Dominion and Cantor hurting enemies; stronger effect closer to the Dominion | B2 answered: friendly slam damage and throw scaled by distance (full at its feet, fading to the 6 m edge) | 4 |
| More item drops from breakables | B1: move item drops from the crowd to breakables | 4 |
| Enemies still drop too few halos | B1: rebalance income, prices and drops together | 4 |

Batches: **1** bugs and doc sync; **2** UI pass with mockups first; **3** readability; **4** combat and economy tuning, then a playtest; **5** behavior-neutral code cleanup before R04. Still open without a note: A4 (Carrier numbers), B3 (pressure stack), E (code).

## Batch 1 results

2026-10-15, uncommitted on `rogue` (base `3680857`). Rules version 17 → 18, so builds before and after this batch can't join each other. Protocol stays 11.

| Finding | Change | Files |
|---|---|---|
| A1 | A random item drop (enemy death or broken amphora) fades after 60 s with the same shrink as coins. Clear-reward items still stay until the run ends. | `src/data/pickups.ts`, `src/sim/pickups.ts`, `src/sim/sim.ts` |
| A2 | Settings puts Profile and Back on one bottom row, so it fits the title panel. Measured at 1280×720: 380×377 px before and after opening Settings (was 380×418, moved 21 px). | `src/ui/volume.ts`, `src/style.css` |
| A3 | The Profile message line is always two lines tall; the Import confirmation is shorter. The panel stays 617 px through every message (was 561 → 617). The import box no longer has a resize handle. | `src/ui/profiles.ts`, `src/style.css` |
| A5 | Level-up shows only `Level N`. | `src/client/game.ts` |
| D1 | game.md (commander status, item fade, "manual/automatic use"), README (Dominion bait), r02.md (on-touch items, Gate B question), rooms.md §6.3 (carry speed; a note listing where the code differs, for A4). | `docs/rogue/` |
| D2 | `83481d2` and this batch recorded in r03-followup.md *Later changes*; one row in implementation-decisions.md. | `docs/rogue/` |

**New tests:**
- An enemy item drop gets the 60 s lifetime and disappears exactly at it.
- The pickup pool recovers coin capacity after 128 uncollected item drops fade (the A1 failure).
- Item drops from broken amphorae fade too.
- The browser profile check asserts that the title panel keeps its box when Settings opens, and the Profile panel keeps its box after an import error and after Clear.

**Checks:**

- `npm run typecheck`: passed.
- `npm test -- --pool=threads --exclude '**/*perf.test.ts'`: **1,122 passed in 98 files** (73 s).
- `npx vitest run --pool=threads src/sim/perf.test.ts src/sim/hazards.perf.test.ts`, run alone: **2/2 passed**, with the unchanged 8 ms/tick limits (hazard stress 4.6 ms/tick).
- `npm run build`: passed.
- `npx playwright test --config playwright.hardware.config.ts e2e/menus.spec.ts e2e/profiles.spec.ts e2e/pickup-expiry.spec.ts e2e/rogue-pressure.spec.ts e2e/r03-art.spec.ts e2e/rogue-floor.spec.ts --grep-invert 'solo autopilot'`: **19 passed, 1 failed** (7.2 min). This included the new panel checks, pickup expiry, prop drops and wallet collection.
- The failure is not caused by this batch: *both carried keys respect refused use…* waits for a **Practice (disposable)** button that no longer exists (see A7).
- After removing Practice (A7), reran typecheck, the unit suite (**1,122 passed**), both timing checks alone (**2/2**, hazard stress 4.6 ms/tick) and the build. Then `npx playwright test --config playwright.hardware.config.ts e2e/profiles.spec.ts e2e/menus.spec.ts`: **9/9 passed** (1.0 min), including the rewritten carried-keys check.
- The full-floor solo autopilot wasn't rerun, because the route and exit code didn't change.
- No benchmark was run.

### A7. Practice mode has no button, and its test fails (found during batch 1, **your call**)

Commit `41d66a7` (October 14 play feedback) removed the `Practice (disposable)` button. The practice code in `src/main.ts` (`toSingleplayerSetup(…, practice)`) is still there, but nothing can reach it. The docs still describe it:

- r03-followup.md says "Practice remains available after choosing a class".
- The r03-report.md play instructions tell you to use it.

`e2e/profiles.spec.ts` *both carried keys…* still clicks the button and times out. r03-followup.md reports that test as passing, which can't be true for this code. Two ways to fix it:

- **Restore it:** add the button after a class is chosen, as the follow-up describes.
- **Remove it:** delete the practice path, and rewrite the test to use an imported disposable profile.

**Decided 2026-10-15: remove.** `src/main.ts` no longer has a practice parameter. The test now starts a normal run from an imported disposable profile and checks that the durable stake holds the imported stacks. r03-followup.md and r03-report.md no longer describe Practice.

Not changed: the Carrier numbers (A4) wait for your decision; rooms.md now says where the code differs.