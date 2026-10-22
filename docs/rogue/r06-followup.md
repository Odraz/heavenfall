# R06 play-feedback iteration — 2026-10-22

Status: **implemented and verified, awaiting-human-play**. Decisions A–D approved 2026-10-22. Based on `160e014` on `rogue`; stages 1–2 in `b2679ec`, stage 3 in the commit after it. Source: your R06 solo playtest remarks (2026-10-22). This iteration fixes what the playtest found; it does not advance R07.

## 1. Talent screen

**Diagnosis.** Nodes show icon + name, so the trees look busy. The tooltip text comes from `nodeDetail` (`src/ui/talents.ts:19`), which appends rule-engine jargon to every rule: `<input> · Delivery (shape): one of each per input.`, `Needs airborne enemies to do anything.`, `Kill-triggered: at most two in a build.` The input names are hardcoded to the Betrayer's weapons, so the Fallen's shotgun talents say "Revolver".

The Q/E ability bug: the shared `.button:hover` rule swaps in the hover border image, which paints over the 2 px gold border of `.talent-ability`. A click redraws the panel, the new button sits under the pointer and is "hovered" at once, so the gold only appears after the pointer leaves.

**Changes.**
- **Icon-only nodes**, like WoW and Borderlands: a square icon tile per node, same grid and fixed panel size. States stay readable without text: learned has a gold frame and full color; open has a plain frame; locked is greyed out; a Rite has a sky frame. The tree name stays above each column; the domain line moves into the tree name's tooltip.
- **Tooltip** = name, then the one-line rule. Extra lines only when they apply: why the node is locked right now (naming the blocking node, e.g. "Can't combine with *Heave*: both change what the shotgun does to survivors"), Rite, dormant or suppressed. No channel, "Needs …" or kill-trigger boilerplate.
- **Remove the per-tree Reset buttons**; keep Reset all in the footer.
- **Q/E choice fix**: the chosen ability keeps its gold frame while hovered; hover only brightens. A click updates the buttons in place instead of rebuilding them, so the gold moves to the clicked ability at once, with a short press flash.
- **Plain-language pass over all 84 talent rules and the alternative abilities**: say what happens, with the number that matters. Examples:
  - *Kindling*: "Your button kills leave the floor burning." → "Enemies you kill with your weapon or abilities set the floor under them burning for 3 s."
  - *Fire and Brimstone*: "The shotgun kindles its close kills instead of shoving survivors." → "Shotgun kills within 6 m set the floor under them burning. Survivors are no longer pushed back."
  - *Behind His Back*: "Taunted enemies cost the Silver Bullet half, as bound ones do." → "The Silver Bullet loses only half as much damage passing through taunted enemies."

**Mutually exclusive talents inside one tree.** The rule "one Delivery and one Payload per input" blocks three same-tree pairs. Same-tree nodes will always combine; the rule stays only between trees (where it now names the conflicting node). How each pair combines:

| Class · tree | Pair | Together |
|---|---|---|
| Betrayer · A | Glancing Silver + Behind His Back (both Silver Bullet) | Independent already: the bullet glances once and loses half on taunted enemies. |
| Heretic · C | The Altar + Scapegoat (both censer clouds) | The middle cloud is the Altar's worn cloud and follows the nearest player at the impact; the two small side clouds stay where the censer broke. |
| Binder · B | Whirl + The Long Flail (both Scourge) | The full-circle swing reaches 4 m. |

No other same-tree conflicts exist (all 84 nodes checked). **Decided (A):** cross-tree conflicts stay (e.g. the Fallen's Heave vs Fire and Brimstone); the tooltip names the conflicting talent.

## 2. Relics

**Diagnosis.** A relic card stacks five differently styled lines (rarity, trigger with a colon, effect, a numbers line with `·` separators, flavor), so the condition and the result read as separate facts. Equipped relics can't be read during a run.

**Changes.**
- **One sentence per relic and combo**: "When …, …", with the numbers inside it, then `Cooldown 5 s` on its own line, then the flavor set apart in italics. Rarity becomes a small colored label above the name. Example, *Comb of the Host*: "When one attack hits 5 or more enemies, a 6 m comb lands across them and slows enemies in it by half for 4 s." · Cooldown 5 s.
- **In-run reading**: the hint window gets a *Relics* section under *Carried*: each equipped relic's name and sentence. With a combo active it shows the combo's sentence in place of the relic it replaces.

## 3. Shop

**Diagnosis.** Random drops already keep the two slots busy; one copy per pedestal at 100–180 halos makes the shop feel poor.

**Change.** Every pedestal sells without limit (each purchase still needs room in a stack or a free slot). Item prices halve: Balm **50**, Seal and Feather **60**, Ash **70**, Bitter Water and Chain Jar **80**, Mirror Ward and Plume **90**. The Chart stays at 120 and one per player. **Decided (B).**

## 4. The Fallen

**Diagnosis.** Up close the shotgun deals 8 × 20 = 160 per 0.9 s (≈178 DPS) against the Betrayer's revolver at ≈200 DPS from any range, so an elite (1 200–1 500 HP) takes 7–8 s of point-blank fire. The slug deals 60 per 0.85 s, about 17 slugs for a Carrier. *The Walls of Dis* rewards standing in the crowd with small numbers: Red Iron 10, Underfoot 20, Wrath of Dis 40 per 100 damage taken.

**Change (starting numbers for your next playtest)**: close-range pellet damage 20 → **25** (≈222 DPS up close; still one pellet per Blessed); slug 60 → **100**; Red Iron 10 → **25**; Underfoot 20 → **30**; Wrath of Dis triggers every **60** damage taken instead of 100. Other classes untouched. **Decided (C).**

## 5. Hitting what you see

**Diagnosis.** Shots test an invisible cylinder that ignores how big the sprite is drawn. The Carrier's cylinder is 0.4 m wide and 0.8 m tall, but its sprite is drawn **2.5×**, about 2 m tall, so most of what you see can't be hit. The Dominion (1.9×) and Cantor (1.4×) have the same gap.

**Change.** Each enemy type gets a **shot volume** matching its visible sprite (measured from the drawn silhouette); movement and crowding keep the current body size. The host, the client's hit markers and bots use the same volume. A test fires at the middle of each type's drawn sprite and must hit.

## 6. The Carrier

**Diagnosis.** It rushes the instant it decides: 0.2 s of aiming, then a 1 s committed flight with a 2.25 m grab radius. Nothing announces the lane.

**Change.** A **0.7 s tell** before each rush: the Carrier stops and flares, and a row of **gold arrow chevrons** appears on the floor along its lane (to you and 12 m beyond), tracking you while it lasts. At the end the lane **locks** (the chevrons flash), then it flies exactly along it. Stepping sideways out of the chevrons dodges it. Damage during the tell or flight still interrupts it. Together with §5, it should be readable, dodgeable and shootable. rooms.md §6.3 is updated to match.

## 7. Heretic visuals

Ploughshares' furrow is drawn as a plain opaque orange bar. It will use the same flames and embers as the Heretic's other burning floor, along the furrow's length and width.

## 8. Damage numbers

**Change.** Small numbers pop up over enemies you damage, rise and fade in 0.6 s. They come from the host's actual damage (never a guess), cover everything credited to you (weapon, abilities, talents, items, relics, your fire), and show only your own damage. Hits on one enemy within 0.15 s merge into one number; kills show the number larger. At most 24 on screen, oldest dropped. A Settings toggle (on by default). This adds a per-player damage message, so the protocol version goes up.

## 9. Running backwards while firing (horde rooms)

**Diagnosis.** Backpedalling is 0.8 × class speed. The Fallen backs away at 4.8 m/s: faster than the Blessed (4 m/s) **and the Choristers (3 m/s)**. Only Cherubs (7 m/s, flying) keep up, and horde rooms are at least 85% Blessed. So holding S + LMB outruns nearly everything, and what does reach you barely matters: a Chorister globe is 12 damage every 2.5 s, a Blessed strike 5 per second, against the Fallen's 400 HP. The only feedback for a hit is a 0.3 s red edge with no direction. The "going in pays" rule (halos and motes drop in the crowd and fade) is the only pull forward, and it is optional.

**Options.** Push makes retreating costly; pull makes standing in the crowd pay. All of them work per player or per enemy, so solo and co-op behave the same.

| # | Option | Kind | What you'd feel | Cost / risk |
|---|---|---|---|---|
| 1 | **Felt hits**: a directional hit arc on the screen edge toward the attacker, a hurt sound, a short view flinch; the arc stays longer for ranged hits | feedback | You know what hit you, from where, and how badly | Small; prerequisite for every other option |
| 2 | **Ranged that matters**: horde waves carry Choristers or Cherubs from wave 2; globe 12 → 25 damage | push | Ranged enemies pin you; ignoring them hurts | Tuning only; Choristers still can't follow a kiter, so it helps only with 3 or 4 |
| 3 | **Pincer arrivals**: from wave 2, a third of each horde wave enters from the spawn points ahead of where you are retreating, shown by the usual spawn warnings 2 s before | push | Running back becomes a route choice: read the warnings, pick a lane, or turn and break through | A new spawn rule (direction from each player's recent movement); readable and fair because it is telegraphed |
| 4 | **Frenzy**: Blessed that chase the same player for 6 s without reaching them flare red and speed up to 5.5 m/s until they strike or lose sight | push | Endless kiting visibly winds the crowd up; short repositioning stays free | Per-enemy rule, cheap; can feel harsh on the slow Fallen and Binder |
| 5 | **Close quarters charge abilities**: every kill within 5 m of you takes 0.25 s off your Q and E cooldowns (at most 2 s per second) | pull | Diving in means more Blasphemy, Falling Star, Chains: the AoE moments the game is about | A new universal rule; fits the premise "co-op AoE clears the horde" |
| 6 | **Slower backpedal**: factor 0.8 → 0.6 | push | Shooting while retreating loses ground; you must turn and run without shooting | One number; honest but not fun by itself |

**Recommendation:** **1 + 3 + 5**. Feedback first, so you can tell what is happening. Pincer arrivals stop the straight-line retreat with a telegraphed, dodgeable threat instead of a hidden penalty. Close-quarters ability charge rewards going in with more of the game's best moments. Keep 6 in reserve if kiting still wins after a playtest; 2 and 4 are tuning knobs for later.

**Decided (D):** 1 + 3 + 5, with 6 kept in reserve.

## What was built

Everything above is implemented as written, with these specifics:

- **Talents:** tiles are built once and updated in place (`src/ui/talents.ts`); a click flashes the tile. Lock reasons are worded by `lockReason`: missing lower talents, a named cross-tree conflict ("Can't combine with The Nail: both change the Silver Bullet."), capstone, kill-triggered limit, no points left. `augmentsConflict` in `src/sim/build.ts` is the one conflict rule (different trees only), used by learning, Rite displacement and Rite offers. 71 rules were reworded.
- **Relics:** `RelicDef.text`/`ComboDef.text` replace trigger/rule/numbers; a combo shows its second relic's cooldown. The hint window's *Relics* section appears while a relic is equipped.
- **Shop:** the per-player `sold` mask is removed from the simulation, run records and the inventory message; a retried request still never charges twice.
- **Shot volumes:** `EnemyDef.shot` (radius, base below the feet, top) per type, measured from each atlas's main pose; used by host hitscan, the Silver Bullet's stop point, the crosshair, censers and reflected shots, client hit markers and bots. The Carrier's is 1.25 m wide from 2.1 m below its feet point to 2.5 m above; the Dominion's 0.85 m, the Cantor's 0.7 m, the Cherub's 0.6 m.
- **Carrier:** `CARRIER_TELL` = 21 ticks; the old 0.2 s in-flight tracking is gone, since the tell now tracks. The chevrons (`src/client/commanderView.ts`) span the 2.25 m grab reach either side, march toward the target during the tell, flash on lock and show the rest of the lane during the flight.
- **Furrow:** Ploughshares' strip lights its floor cells in the class `FireView` (`src/client/furrow.ts`).
- **Damage numbers:** the host tallies each human's credited damage per enemy per tick and sends one `damage` event to that player only (at most 24 enemies, largest first). Numbers merge per enemy within 0.15 s, get a small fixed screen offset per enemy so a packed crowd stays legible, and kills are gold and larger. *Damage numbers* toggle in Settings; the Settings rows are 2 px closer and the label column wider, so the panel keeps its size.
- **Felt hits:** `damagePlayer` takes the source point and kind; each hurt human gets one `hurt` event per tick. A red arc on a ring around the crosshair points at the source through the camera's own transform (0.9 s, ranged 1.4 s); a flinch of 0.4–1.2° scales with the hit. The existing red edge, HP shake and hurt sound stay.
- **Pincer arrivals** (`src/sim/pincer.ts`): retreating means at least 2.5 m/s over the last second, away from the centroid of enemies within 12 m. In horde rooms (focus or secondary) from the second wave, up to a third of each wave's Blessed use the nearest spawn point 8–30 m ahead within ±45°, never within 8 m of a player. A point inside the usual 15 m gets a 2 s spawn warning first (the warning's duration is now a parameter); until then the Blessed is placed as usual.
- **Close-quarters charge:** each credited kill within 5 m refunds 0.25 s of Q and E cooldown from a 2 s-per-second budget. The client now lets the host's E cooldown rule once it has started for a press, so a refunded Falling Star or Shadowstep is usable at once.
- Protocol 15 → **16**, rules 26 → **27**. Docs updated: game.md (shop, same-tree rule), items-relics.md (prices), rooms.md §6.3 (tell, shot volume), the four class catalogs (a note on card wording and the Fallen's numbers).

## Verification

All on Windows with the D3D11 Playwright configuration. No benchmark was run (none requested).

- **Unit suite:** `npx vitest run --pool=threads --exclude '**/*perf.test.ts'`: **1,608 passed in 126 files** (final run). New coverage: same-tree compositions for every class and the three pairs in the sim, lock reasons and the rule-wording check, relic sentences and hints, unlimited purchases and prices, the Fallen's numbers, shot volumes against each atlas, the Carrier tell/lock/interrupt and its chevrons, furrow cells, damage and hurt events (per player, merged, capped; bots and world damage excluded), number merging and spread, hit-arc angles in camera space, pincer heading and point choice plus a horde-room integration test with its non-horde control, the close-quarters budget.
- **Timing checks, each run alone:** `npx vitest run --pool=threads --reporter=verbose src/sim/perf.test.ts`: **3.272 ms/tick**; the same for `src/sim/hazards.perf.test.ts`: **4.852 ms/tick**. Limits unchanged at 8 ms. One combined run during stage 1, with the game running in the browser pane, missed the ordinary limit; rerun alone it passed (3.314 ms). That combined run is not claimed as a pass.
- `npm run typecheck` and `npm run build`: passed. `git diff --check`: passed.
- **End-to-end:** `npx playwright test --config playwright.hardware.config.ts e2e/menus.spec.ts e2e/profiles.spec.ts e2e/singleplayer.spec.ts e2e/multiplayer.spec.ts e2e/commanders.spec.ts e2e/rogue-floor.spec.ts e2e/rogue-pressure.spec.ts e2e/talents.spec.ts e2e/classTalents.spec.ts e2e/dungeonChoices.spec.ts`: **41 of 42 passed** (20.3 min, including the 10-minute solo autopilot run and real PeerJS multiplayer). The failure was a real regression: the Damage numbers row made title Settings 11 px taller. After the spacing fix, `e2e/profiles.spec.ts e2e/menus.spec.ts`: **9/9 passed**. Two talents checks changed: the in-run overlay clicks use `dispatchEvent` (a probe confirmed a real `elementFromPoint` hits the button and the trees end above the footer), and the out-of-points check clicks a node not also blocked by a conflict.
- **Inspected:** the talent trees in the Lobby and in a run, a cross-tree lock tooltip, the Q/E gold frame while hovered and after a click, the Carrier's chevrons during a live tell, the furrow's flames, damage numbers over a crowd, a hit arc, and title Settings. Temporary screenshot specs were deleted afterwards.

Not established by these checks: whether the Fallen now feels strong enough, whether pincers and the ability charge make standing in the crowd more fun than backing away, and whether the Carrier now feels fair. Those are your play calls.

## Play this iteration

Run `npm run dev`.

1. **Talents** (Lobby → Talents, or T in a run): hover tiles for rules and lock reasons; learn The Altar + Scapegoat (Heretic) or Whirl + The Long Flail (Binder); pick a second Q/E ability and watch the gold frame move at once.
2. **Relics:** open the Relics view and read a card; equip two and press H in a run.
3. **Shop:** buy the same pedestal twice.
4. **Fallen and the Carrier:** `/?dev=1&map=carrier&class=fallen&seed=7`, walk into the arena; shoot the Carrier where it looks hittable, watch the chevrons and step out of them.
5. **Horde room:** play a normal run as the Fallen and back away in a horde room from its second wave: arrivals should cut you off, with a warning. Kill up close and watch Q/E come back faster. Watch the numbers, and the arcs when something hits you.
6. **Ploughshares:** `/?dev=1&map=rogue&class=heretic&build=pyre&seed=317434499&god=1`, throw a censer at the floor.

If backing away still wins, the reserve option is the slower backpedal (§9, option 6).

## Stages and verification

1. Talent screen (§1), then relics (§2) and shop (§3).
2. Fallen numbers (§4), shot volumes (§5), Carrier tell (§6), furrow look (§7).
3. Damage numbers (§8) and the chosen §9 options.

Each stage follows AGENTS.md: new or updated unit tests for the changed behavior (talent compositions, shop repeat purchase and prices, shot volumes per type, Carrier tell/lock timing, damage-number aggregation), then the complete unit suite (timing tests on their own), typecheck and production build. The menus, profiles, commanders, rogue-floor and multiplayer e2e suites run where their areas change. Rules version goes up (gameplay numbers change) and the protocol version too (damage numbers). No benchmark unless you ask; your play test decides the feel.
