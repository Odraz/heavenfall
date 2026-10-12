# Builds, Loot and Run-Based Progression in Horde/Action Games (and what Meatgrinder can take from them)

Scope note: about 20 search/fetch calls. Wiki formula pages (RoR2, Vampire Survivors, Brotato) and named designer quotes (Diablo, Borderlands 2, Gunfire Reborn) came back well. Interviews where Supergiant, poncle or Hopoo explain their *progression* design mostly did not: the pages either don't exist in fetchable form or are paywalled. The Hades and Diablo fandom wikis returned HTTP 402. Every "Inferences" bullet is my reasoning, not a source claim. The Meatgrinder notes are in the Inferences bullets, marked **MG:**.

Meatgrinder constraints the notes are checked against: one visible effect per ability (no hidden riders); no "press the moment it's ready" buffs; every attack situational; 4 fixed classes with LMB/RMB plus Q/E; 1–4 players with bots; 1000+ enemies; about 3 arenas then a boss; about 8 minutes per run; currently no in-run progression or loot. Relics (pick 1 of 3 after each arena) are planned. Playtesters said "no choices", "not much to do", and wanted to pick up and break things.

---

## 1. In-run progression: choice frequency, pick-1-of-3 vs drops vs shops, synergies, stacking vs unique

### Takeaway
All the reference games put a decision in front of the player far more often than "once per arena". Vampire Survivors offers a 3-option (sometimes 4) level-up on a fast XP curve. Hades offers a 3-boon choice in most rooms. RoR2 sells a random item in a chest that costs gold, many times per stage. Brotato puts a reroll-and-lock shop between every wave. Meatgrinder's planned 3 relics per 8-minute run would be roughly an order of magnitude fewer decisions than any of them. Relics fit the "boss reward" slot. They cannot be the whole loop.

### Cited Findings
- **Vampire Survivors XP curve (wiki).** Level 1→2 needs 5 XP. Each later level up to 20 needs 10 more than the previous one (15, 25, 35...). Level 20 needs an extra 600 XP and level 40 an extra 2,400 XP, each offset by a temporary +100% Growth. From 21–40 the increment is +13 per level, and from 41 it is +16. — [VS Wiki: Level up](https://vampire.survivors.wiki/w/Level_up); [VS Wiki: Growth](https://vampire.survivors.wiki/w/Growth)
- **VS choice format.** Usually 3 options per level-up, sometimes 4 (Luck-dependent). Reroll, Skip and Banish exist only if bought as meta PowerUps. New items stop being offered once the inventory holds 6 different weapons or passives. — [VS Wiki: Level up](https://vampire.survivors.wiki/w/Level_up)
- **Community claims about VS's curve conflict:** one user says it is quadratic (8n²), a Steam reply says linear. The wiki's table (constant increment, i.e. quadratic cumulative total) is the most authoritative of the three. — [itch.io post](https://itch.io/post/10422513); [Steam discussion](https://steamcommunity.com/app/1794680/discussions/0/3717188244455231479/?ctp=3)
- **Hades boons.** "Throughout a run, the Olympians offer Boons; each offer gives the player a choice of three persistent boosts or effects for that run." Boons are themed per god, e.g. Zeus = lightning damage, Poseidon = push-back waves. So the god identity tells the player what *kind* of effect they are choosing before they read the card. — [Wikipedia: Hades](https://en.wikipedia.org/wiki/Hades_(video_game))
- **Kasavin, as reported second-hand by AFK Gaming from an Inside Gaming interview:** Dota 2 was a "big reference point", with item choices compared to the boon system. Not verified against the original video. — [AFK Gaming](https://afkgaming.com/dota2/news/6052-hades-dev-shares-how-dota-2-influenced-their-game)
- **Critic/fan counterpoint on Hades:** a Backloggd user argues Hades "drowns the player in choice" and that boons are mostly flat numeric bonuses rather than items that change how attacks work, contrasting it with Binding of Isaac. This is opinion, but it is directly relevant to MG's "one visible effect" rule. — [Backloggd](https://backloggd.com/u/elisemarie/)
- **RoR2 items.** Enemies drop currency, which opens chests placed on each level, and chests give random items. Chest items have no per-item limit, so copies of the same item stack. — [Wikipedia: Risk of Rain 2](https://en.wikipedia.org/wiki/Risk_of_Rain_2)
- **RoR2 chest price** scales with difficulty: `moneyCost = baseCost × coeff^1.25`, recalculated when each stage starts. A Small Chest is $25 in stage 1 singleplayer. Gold from kills is `2 × coeff × monsterValue × rewardMultiplier`, so income and prices rise together. — [RoR2 Wiki: Difficulty](https://riskofrain2.wiki.gg/wiki/Difficulty)
- **Paul Morse (Hopoo), as relayed via Kotaku/PC Gamer:** levels are hand-crafted, with loot types and unlockables curated but placed randomly, which "felt a lot better than having something truly random." — [Kotaku](https://kotaku.com/risk-of-rain-2-developers-discuss-the-games-shift-to-3d-1821553824)
- **Duncan Drummond (Hopoo), same source:** one reason for moving RoR2 to 3D was to show collected items on the player's character, which was hard to do in 2D. — [Kotaku](https://kotaku.com/risk-of-rain-2-developers-discuss-the-games-shift-to-3d-1821553824)
- **Brotato shop (fan wiki):**
  - Rerolls are uncapped but each costs more than the last within one shop, and the cost resets to a rising base each wave.
  - Any number of items can be locked across rerolls and waves.
  - Item tiers are gated by wave: Tier 2 from wave 2, Tier 3 from wave 4, Tier 4 from wave 8.
  - One currency ("materials") gives both XP and gold, so leveling and buying come from the same pickup.
  - Characters bend the rules, e.g. Mutant needs 66% less XP but pays 50% more in the shop.
  - [Brotato Wiki: Shop](https://brotato.wiki.spellsandguns.com/Shop); [Brotato Wiki: Materials](https://brotato.wiki.spellsandguns.com/Materials)
- **Brotato criticism (player review):** escalating reroll costs can burn about 1,000 materials without finding the needed item. — [mssv.net review](https://mssv.net/2023/08/29/brotato/)
- **Deep Rock Galactic: Survivor** layers several systems:
  - Level-up choices during a stage, plus a shop after each stage.
  - Weapon Overclocks at weapon levels 6, 12 and 18. These are trade-off mods: some change the damage type, some swap reload speed for fire rate, and some "may ruin synergies in your build".
  - Overclocking a weapon is unlocked by ranking it to 12, but only takes effect from the next run.
  - Players complain this makes them pour level-ups into a weapon that has no overclocks yet.
  - [Prima Games](https://primagames.com/gaming/how-to-get-and-use-overclock-weapons-in-deep-rock-galactic-survivor); [Steam discussion](https://steamcommunity.com/app/2321470/discussions/0/6292161380806029016)
- **Gunfire Reborn devs (Duoyi Q&A):** "We wanted players to have access to different weapons, scrolls and talents, so that they will be able to experience various builds through adventures." They name Borderlands and Enter the Gungeon as the inspiration for going roguelike. — [Game Wisdom interview](https://game-wisdom.com/guest/gunfire-reborn-interview)
- **Roboquest (publisher copy):** randomly generated biomes, "pick-up upgrades along the way", bosses, and persistent basecamp upgrades. A reviewer describes the Borderlands-derived core as "big guns, and wildly varying numbers of damage and stat increases" (critic). — [Starbreeze](https://www.starbreeze.com/news/starbreeze-entertainment-to-publish-roboquest-by-ryseup-studios-get-ready-to-kick-some-metal-ass/); [TechRaptor review](https://techraptor.net/gaming/reviews/roboquest-review-rust-belt)

### Inferences
- The reference games use three distinct reward channels at once:
  - (a) a **frequent, small, low-stakes channel**: VS level-ups, RoR2 white-item chests, Brotato shop items.
  - (b) a **less frequent, high-identity channel**: Hades god boons, DRG:S overclocks, RoR2 red/boss items.
  - (c) **found weapons** that replace the kit: Gunfire Reborn, Roboquest.

  Meatgrinder's relic plan covers only (b).
- **Stacking vs unique:** RoR2's no-cap stacking makes every pickup matter, even a duplicate. Uniques (Hades boons, DRG:S overclocks) carry identity. A hybrid is common: stackable commons plus unique rares.
- **Pick-1-of-3 vs random drop.** Pick-1-of-3 gives agency. A random chest drop gives surprise and costs no menu time, which matters in real-time co-op where a menu leaves teammates exposed. RoR2's random chests (plus the separate "printers/3D printers" and "Scrappers", not verified this pass) let players feel lucky without stopping play.
- **MG: frequency.** In an 8-minute run, aim for a meaningful "thing happened to my kit" event every ~30–60 s. That works out to roughly 8–15 in-run power events per run, not 3.
- **MG: suggested split.**
  - (1) **Kill-fed micro-upgrades** that drop from enemies and stack. Each must be a *visible* modifier of one attack, e.g. "+1 pellet on shotgun", "chain jumps +1 target", "censer radius +15%". These are additive, so they need no menu.
  - (2) **Relics** (pick 1 of 3) after each arena: a single big visible change to one attack, which is what is already planned.
  - (3) **Optionally, a found weapon that swaps LMB** (see §3).
- **MG: tension with "one visible effect per ability".** Stacking numbers (+% damage) are invisible. Restrict stackables to *countable, visible* quantities: pellets, chain targets, pierce count, projectile size, slam radius, number of bound enemies. Each copy then produces a visible change. RoR2's stacking items (e.g. more missiles, a bigger explosion radius) show this can work.
- **MG: tension with "no menus in combat" in co-op.** VS pauses the game for level-ups; MG cannot pause for 4 players. Options:
  - Auto-applied pickups for the frequent channel.
  - A short between-arena break for relics.
  - A Hades-style "walk into the god-colored reward to choose", which keeps it diegetic.
- **MG: god-theming lesson from Hades.** If relics are grouped by a few visible "sources" (e.g. a Fire / Chain / Blood relic family, each with its own colour and VFX), players can predict what a choice will do, and pairs across families can produce Hades-style "duo" synergies.

### Gaps
- No primary Supergiant source found on how many boon offers Hades gives per run or on its boon-rarity odds. The Hades fandom wiki returned HTTP 402.
- No primary measurement of VS level-up timing in seconds. The "level-up every ~30 s early" figure in the brief could not be verified; it depends on gem values and spawn density.
- No primary Hopoo statement on why items stack uncapped.
- Halls of Torment's level-up/shop mechanics: searches returned unrelated results.
- Roboquest developer interview (ActuGaming, French): only the studio-background portion was retrieved.

---

## 2. Power curve: making players feel stronger while enemies scale; the end-of-run power fantasy

### Takeaway
RoR2 shows the clearest published model. Difficulty is a function of real time, stage count and player count, and it drives enemy level, spawn budget *and* prices. The player's power comes from items, so the player is racing a clock. VS-likes (per critics) get the power fantasy from an "absurd power curve": by the end, the screen is full of the player's own effects. Diablo's design is literally "just one more monster".

### Cited Findings
- **RoR2 difficulty coefficient:**
  - `playerFactor = 1 + 0.3 × (players − 1)`
  - `timeFactor = 0.0506 × difficultyValue × players^0.2` (Drizzle 1, Rainstorm 2, Monsoon 3)
  - `stageFactor = 1.15^stagesCompleted`
  - `coeff = (playerFactor + minutes × timeFactor) × stageFactor`

  Each new stage multiplies coeff by 1.15. — [RoR2 Wiki: Difficulty](https://riskofrain2.wiki.gg/wiki/Difficulty)
- **RoR2 enemy level and elites:**
  - `enemyLevel = 1 + (coeff − playerFactor)/0.33`. Each level adds +30% HP and +20% damage.
  - Teleporter bosses get HP × `(1 + coeff/2.5) × livingPlayers`.
  - The spawn Director gets credits that grow linearly with coeff. Elites cost 6× (Blazing/Overloading/Glacial) or 36× (Malachite/Celestine) a normal monster's credits.
  - The Director skips groups too cheap for its budget, "which makes weak enemies rarer over time".
  - The difficulty bar labels run from Easy → … → "I SEE YOU" → "I'M COMING FOR YOU" → "HAHAHAHA", roughly one label per +1 coeff.
  - [RoR2 Wiki: Difficulty](https://riskofrain2.wiki.gg/wiki/Difficulty)
- **RoR2 core wager (critic):** lingering to open chests makes monsters stronger, while each added item makes the player stronger too. — [GameGeeker review](https://gamegeeker.com/games/2-632360/review?market=DE)
- **VS (critics):**
  - Nintendo World Report calls it "my favorite slot machine", citing "overwhelmingly flashy effects, absurd power curve, and snappy pace of upgrading". — [NWR review](https://www.nintendoworldreport.com/review/64583/vampire-survivors-switch-review)
  - Edge says poncle "wielded the game's reward loops with generosity, providing players with dopamine bumps" and compares it to idle games and slot machines. — [Edge via Zinio](https://www.ziniounlimited.com/publications/edge/2923/issues/664324/articles)
- **Galante background (Wikipedia):** before VS he worked in the gambling industry and used his knowledge of flashy slot-machine graphics as part of the game's appeal. — [Wikipedia: Vampire Survivors](https://en.wikipedia.org/wiki/Vampire_Survivors)
- **Galante on the hit's success:** he said he has "no idea" why it is so good. This is a designer statement, notable because there is no grand theory behind it. — [TheGamer](https://www.thegamer.com/vampire-survivors-creator-success-i-have-no-idea/)
- **Runs are capped at 30 minutes** in VS, which reviewers link to the "just one more try" impulse. — [Screenwise](https://screenwiseapp.com/media/vampire-survivors-game)
- **Hades Pact of Punishment** can raise enemy attack, health or counts, and change boss fights (e.g. Theseus in a machine-gun chariot). Higher Pact levels unlock rare rewards and cosmetics. — [Wikipedia: Hades](https://en.wikipedia.org/wiki/Hades_(video_game))

### Inferences
- The scaling and the power curve must *diverge visibly*. Players should feel they are outpacing the enemies (power fantasy) for most of a run, then be caught at the boss or a timer spike (tension). RoR2's Director also makes trash rarer over time and replaces it with elites, so "more enemies" turns into "harder enemies".
- **MG: 8-minute arc.** Meatgrinder already has the horde size (1000+) that VS-likes need for the end-of-run screen-filling feeling. What it lacks is the *player's* half: the end-of-run kit should look and sound different from the start (more pellets, bigger slams, more chains). A useful target: arena 3 trash dies faster than arena 1 trash did, even though arena 3 sends more of it.
- **MG: time pressure without a timer UI.** RoR2's "linger to farm vs leave" can map to "kill the optional loot-carrying elite / smash the chest cluster vs push to the exit while the horde spawn rate climbs". This creates choices and gives the "not much to do" crowd things to do.
- **MG: co-op scaling lesson.** RoR2 scales enemy HP by living players, and prices by player count, so more players does not trivialise the game. MG's bots already fill the party, so scaling should probably key on *human* count or be flat.

### Gaps
- No primary Hopoo/poncle statement on intended power-curve shape (e.g. "player should outscale by X").
- No data on VS enemy-count growth per minute.

---

## 3. Loot: Borderlands gun generation, Diablo loot explosion, pinatas/goblins/chests/breakables, pickup feel

### Takeaway
Loot works through (a) a visible value code (rarity colour), (b) an audio cue that something good dropped, (c) distinct "families" (manufacturers) whose look predicts how the gun plays, and (d) a slot-machine cadence: many small pulls, an occasional jackpot. The Diablo creators describe it openly as a slot machine. The Borderlands art team designed guns to "look the way they're gonna play".

### Cited Findings
- **David Brevik (Diablo):** "we were basically making a slot machine where every time that you killed a monster, you were pulling that lever"; "we liked the addictive feeling of just one more monster, just one more piece of loot"; "sometimes you have this hope of getting something great." — [Kotaku](https://kotaku.com/why-video-game-loot-is-so-addictive-according-to-the-c-1846695147)
- **Erich Schaefer (Diablo):** on the rare-drop sound, "Something cool has dropped. I've gotta scour for it." On identify scrolls, "That was our way of giving you two slot machine pulls." — [Kotaku](https://kotaku.com/why-video-game-loot-is-so-addictive-according-to-the-c-1846695147)
- **Rarity colours.**
  - Brevik took the colour-coding idea from Angband.
  - Diablo 1: white/blue/gold. Diablo 2: grey (inferior), white, blue (1–2 affixes), yellow (3–4 affixes), orange/gold (unique), green (set). WoW later reused the scheme.
  - Brevik: "Blue, as we all know, is the international color for magic." Schaefer: gold for uniques because "it looked more important."
  - [Game Informer](https://gameinformer.com/2019/05/18/the-surprising-origins-of-loot-rarity-colors); [Kotaku](https://kotaku.com/why-video-game-loot-is-so-addictive-according-to-the-c-1846695147); [GameSpot](https://gamespot.com/articles/how-color-coded-loot-conquered-gaming/1100-6473027/)
- **Borderlands 2 (Gearbox, Killscreen interview):**
  - Randy Varnell: "we're not only designing ten, twenty, fifty guns, but they're procedurally built"; "there are millions and millions of combinations, so you're gonna find your favorite guns"; "We don't try to make every gun loved by every player."
  - Kevin Duc: "We've got eight different manufacturers"; the brief was to "make the weapons look like the way they're gonna play". Playtesters form attachments to guns "in an hour or two hours".
  - On elements, Duc says "you're gonna see green numbers flying out, or purple numbers flying out", and "With electricity, blue—those visual cues are letting the players know exactly what's going on."
  - Torgue became the explosives brand because its guns "shoot gyro-jets, which are little rocket-propelled explosives".
  - [Killscreen](https://www.killscreen.com/interview-gearbox-software-explains-their-love-guns-and-borderlands-2/)
- **Manufacturer behaviours (BL2, secondary):** Bandit = bigger magazines; Jakobs = high damage, old-west styling; Torgue = explosive rounds; Vladof = fire rate; Tediore = disposable, thrown on reload; Dahl = burst fire. — [The Firearm Blog](https://www.thefirearmblog.com/blog/2012/11/15/the-fictional-but-honest-gun-industry-of-borderlands-2)
- **Gun-count claims vary by source:** Borderlands 1 is cited at ~1 million (Killscreen) or 16–17 million variants. Gearbox claims 30+ billion for Borderlands 4, with "licensed parts" letting one manufacturer's part appear on another's gun. — [Wikipedia: Borderlands](https://en.wikipedia.org/wiki/Borderlands_(video_game)); [Gfinity](https://www.gfinityesports.com/article/borderlands-4-will-have-30-billion-guns-and-i-wish-i-was-making-this-up); [Mein-MMO](https://mein-mmo.de/en/borderlands-4-offers-30-billion-weapons-developers-explain-why,1519888)
- **Diablo 3 Loot 2.0** (patch 2.0.1, Feb 2014) moved from quantity to quality:
  - Legendaries became rarer but more effective. Lead designer Kevin Martens said legendaries were meant to be the best items but mathematically weren't.
  - "Smart Drop" biases drops to the finder's class main stat, raising the chance that a drop is an upgrade.
  - (The secondary source spells the name "Marens".)
  - [Game-Wisdom](https://game-wisdom.com/critical/loot-2-0-and-diablos-fourth-revival); [Shacknews](https://www.shacknews.com/article/83266/diablo-3-patch-201-deploys-with-loot-20); [DiabloWiki](https://di.diablowiki.net/Loot_2.0)
- **D3 Treasure Goblin.** It drops treasure "like a pinata as soon as you start hitting it" and opens a portal to escape if not killed fast. Killing it drops gold, gems and sometimes magic items. It was a later addition. The sound team gave it pitched-up giggles to make it distinct from other bipedal monsters. — [BlizzardWatch](https://blizzardwatch.com/2021/02/01/diablo-immortal-treasure-goblins); [Ubergizmo](https://ubergizmo.com/2015/12/world-of-warcraft-legion-treasure-goblin); [Icy Veins](https://icy-veins.com/forums/topic/21374-developer-insights-behind-the-goblin-giggle)

### Inferences
- **Pickup satisfaction stack** from these sources:
  - A colour that encodes value before the player reads anything.
  - A distinct drop sound per tier ("Something cool has dropped").
  - A family/brand silhouette that predicts behaviour.
  - Coloured damage numbers or VFX that confirm the effect.
- Magnetism and loot beams are standard practice but were not sourced in this pass; see Gaps.
- The goblin is the purest "loot pinata": a timed, fleeing, readable target that turns a horde fight into a priority decision ("drop everything and chase"). It adds a *choice* without adding a new threat, which fits MG's scope-discipline rule better than a new enemy type with an attack.
- Loot 2.0's lesson is relevant: too many useless drops kills excitement. Fewer, more meaningful, class-relevant drops beat a flood of chaff. MG has 4 fixed classes, so every drop should be usable by the player who picks it up, like Smart Drop.
- **MG: a Borderlands-lite "manufacturer" layer without procedural stat soup.** Each class keeps its signature gun. Found loot is a **gun mod from one of ~4 "makers"**, each with ONE visible behaviour:
  - "Torgue-like": the LMB shots explode on impact.
  - "Vladof-like": faster fire, smaller hits.
  - "Jakobs-like": slower, harder, pierces.
  - "Tediore-like": the RMB/reload throws something.

  That is one visible effect per mod. Rarity (white/blue/purple/gold) would control *magnitude*, never add hidden riders. This answers the playtesters' Borderlands wish while respecting "one visible effect".
- **MG: "pick up and break stuff".**
  - Breakable arena props (crates, coffins, shrines) that spill pickups.
  - A goblin-equivalent (a fleeing "Hoarder" that sheds gibs/coins when hit and escapes after ~10–15 s).
  - Elites that burst into a loot fountain.

  None of these need new attack patterns.
- **MG: tension.** Procedural stat rolls (+7% crit, +3% fire rate) violate the "one visible effect" rule and are mostly invisible in a 1000-enemy horde. Avoid them; use discrete, countable modifiers.
- **MG: co-op loot.** Diablo 3's Smart Drop and RoR2's shared-world chests suggest either per-player instanced drops (no fighting over loot) or clearly shared chests with a "whoever opens" rule. Not verified which RoR2 uses beyond "chests drop random items".

### Gaps
- No primary source found on loot beams (Borderlands), pickup magnetism radius, or pickup sound-design practice beyond Schaefer's quote.
- No primary Blizzard source naming who designed the treasure goblin, or its drop tables.
- No Diablo 4 / Path of Exile specific sources gathered (monster density, skill-gem synergies). Searches were not run for budget reasons.

---

## 4. Roguelite FPS specifically: found weapons, class + item combos, elites with modifiers, teleporter/boss events, shrines and risk-reward

### Takeaway
RoR2 builds each stage around a single "teleporter event" (activate → survive a boss plus a larger wave until charged). Elites are bought from the same spawn budget at 6× or 36× the cost of a normal monster. Gunfire Reborn explicitly combines found weapons, scrolls and talents so each run is a different build. Hades offers risk-reward through Pact settings and (unsourced here) Chaos gates.

### Cited Findings
- **RoR2 teleporter loop:** find and activate the teleporter, survive a larger wave plus a boss until it is fully charged, then advance. Currency converts to XP before teleporting. — [Wikipedia: Risk of Rain 2](https://en.wikipedia.org/wiki/Risk_of_Rain_2)
- **RoR2 elites:** Blazing/Overloading/Glacial cost 6× a normal monster's spawn credits; Malachite/Celestine cost 36×. As credits grow with coeff, elites become more common. — [RoR2 Wiki: Difficulty](https://riskofrain2.wiki.gg/wiki/Difficulty)
- **RoR2 Lunar items:** Lunar Coins persist between runs and buy items from a special vendor (who also lets players pick the next stage) or open Lunar Pods. — [Wikipedia: Risk of Rain 2](https://en.wikipedia.org/wiki/Risk_of_Rain_2)
- **Gunfire Reborn:** "different weapons, scrolls and talents" so players "experience various builds"; "Every time you start an adventure, you'll have a whole new experience." — [Game Wisdom](https://game-wisdom.com/guest/gunfire-reborn-interview)
- **Roboquest:** "pick-up upgrades along the way and blast the powerful big bad bosses"; persistent basecamp upgrades "to customize your playstyle and dive further on each subsequent run" (publisher copy). — [Starbreeze](https://www.starbreeze.com/news/starbreeze-entertainment-to-publish-roboquest-by-ryseup-studios-get-ready-to-kick-some-metal-ass/)
- **DRG:S overclocks** are deliberate trade-offs (swap reload speed for fire rate, change damage type) and can "ruin synergies". — [Prima Games](https://primagames.com/gaming/how-to-get-and-use-overclock-weapons-in-deep-rock-galactic-survivor)

### Inferences
- **The teleporter event is the template for "the arena-clear moment".** The player chooses when to start it, it creates a climax, and it hands over a reward. MG's arenas could end with an "activate the altar → survive the surge → boss/elite → relic choice" beat, so the player owns the timing.
- **Shrines as optional gambles fit MG's "choices" gap without new enemies:**
  - A "Shrine of the Mountain"-style altar: more elites this arena for a better relic.
  - A "Chaos gate"-style altar: pay HP now for a stronger reward later.
  - A "Shrine of Chance"-style altar: pay coins to gamble on a pickup.

  These mechanics are commonly described but were not sourced this pass (see Gaps).
- **MG: elites as loot carriers.** RoR2's elites are budgeted, colour-coded variants. MG could make elites the main source of mod drops (Borderlands "pinata" style). Killing an elite inside the horde then becomes the priority target, which also serves the "every attack situational" rule: Silver Bullet for a lined-up elite, Binder to bind it, Fallen taunt to pull it out of the crowd.
- **MG: elite modifiers.** One visible trait each, colour-coded (fire trail, shield, splits on death). This matches MG's rule and RoR2's practice. Scope discipline says to confirm with the user before adding these.
- **MG: found weapons.** Gunfire Reborn and Roboquest let players swap whole guns. This conflicts with MG's "distinct classes with distinctive guns". The compromise is mods/attachments on the class gun (§3) rather than replacement guns, or class-restricted alternate guns (e.g. Fallen finds a different shotgun variant).

### Gaps
- No sourced specifics on RoR2's Shrine of the Mountain (boss doubling, extra item), Shrine of Chance odds, or Hades' Chaos gates (HP cost, curse-then-blessing). Wikipedia pages did not cover them and the Hades fandom wiki was paywalled (HTTP 402).
- No developer statements from RyseUp (Roboquest) on weapon or run design.

---

## 5. Meta progression across runs: how much a small co-op game needs, and the risks

### Takeaway
Every reference game has some meta layer: Hades' House upgrades and Pact, RoR2's Lunar Coins and unlocks, VS's PowerUps (Reroll/Skip/Banish are themselves meta purchases), DRG:S weapon ranks unlocking overclocks, and Roboquest's basecamp. The documented risk is delayed or misaligned unlocks that make in-run choices feel bad (DRG:S complaint). Hades turns meta progression into a difficulty-for-rewards dial and an optional God Mode.

### Cited Findings
- **Hades meta layer:** the House is the between-run hub. Some currency is lost on death, while other currency buys permanent upgrades, unlocks or weapon improvements. The Pact raises difficulty for rare rewards, cosmetics and NPC subplots. God Mode makes the player stronger after each failed run. — [Wikipedia: Hades](https://en.wikipedia.org/wiki/Hades_(video_game))
- **Kasavin on what carries across runs:** "there is in fact, something that you carry forward, which is your knowledge of the mechanics in the game"; bosses "remember, you start keeping a tally of who won this time". — [Game Developer](https://www.gamedeveloper.com/design/roguelikes-and-narrative-design-with-i-hades-i-creative-director-greg-kasavin)
- **Kasavin on "unnecessary" content:** "the things that are unnecessary in a game I think are the things that, paradoxically, can make a game very special" — "then one of them is gonna work on you!" — [Game Developer](https://www.gamedeveloper.com/design/roguelikes-and-narrative-design-with-i-hades-i-creative-director-greg-kasavin)
- **Kasavin on difficulty walls:** "we try to build systems into our games that mitigate those kinds of moments". — [Game Developer](https://www.gamedeveloper.com/design/roguelikes-and-narrative-design-with-i-hades-i-creative-director-greg-kasavin)
- **Supergiant chose early access** to refine gameplay with feedback, and found that *Pyre* players rarely replayed to see its branches. That fed the decision to build narrative into repeated runs. — [Wikipedia: Hades](https://en.wikipedia.org/wiki/Hades_(video_game))
- **VS:** Reroll, Skip and Banish only appear if bought as PowerUps (meta). — [VS Wiki: Level up](https://vampire.survivors.wiki/w/Level_up)
- **DRG:S:** overclocking unlocks at weapon rank 12 but only applies from the next run. Players complain this wastes level-ups, and a suggested fix is to grant the overclock choice immediately. — [Steam discussion](https://steamcommunity.com/app/2321470/discussions/0/6292161380806029016); [Prima Games](https://primagames.com/gaming/how-to-get-and-use-overclock-weapons-in-deep-rock-galactic-survivor)
- **RoR2:** Lunar Coins persist between runs. — [Wikipedia: Risk of Rain 2](https://en.wikipedia.org/wiki/Risk_of_Rain_2)

### Inferences
- **MG: minimum viable meta.**
  - (1) **Unlock new relics/mods into the pool** by playing. This is variety, not power, so co-op groups at different meta levels stay balanced.
  - (2) **A Heat/Pact-style difficulty dial** with cosmetic rewards. Cheap to build, and it gives skilled groups a goal.
  - (3) **Cosmetics** (class skins/halos), already planned as M13 halos.
- **Avoid permanent stat power in co-op:** a new friend joining a veteran's lobby would be underpowered or overpowered. This is my inference; no source was found on co-op-specific meta risks.
- **MG: unlock-immediacy lesson from DRG:S.** If something unlocks mid-run, let it affect *this* run or at least show it at the Results screen. Delayed payoff reads as wasted effort.
- **MG: Kasavin's "unnecessary things" point** supports small flavour pickups (gibs to kick, props to smash, silly loot names) even if they barely affect balance. This directly answers the playtesters' "wanted to break stuff".

### Gaps
- No source quantifying how much meta progression small co-op indies ship, or data on retention effects.
- No Hopoo statement on the role of unlocks in RoR2.

---

## 6. Short sessions: packing decisions into 8–20 minute runs

### Takeaway
The reference games keep decision density high by making most decisions small, fast and in-flow: walk into a reward, open a chest, a short level-up card. Big decisions are reserved for natural breaks: the shop between waves, the boss reward, the next-room door choice. VS caps runs at 30 minutes, Brotato uses short waves with a shop after each, and RoR2 uses stages that each end in a teleporter climax.

### Cited Findings
- **VS** runs are capped at 30 minutes; reviewers link this to the "just one more try" impulse. — [Screenwise](https://screenwiseapp.com/media/vampire-survivors-game)
- **VS level-up costs start tiny** (5 XP, then 15, 25...), so the first several choices come almost immediately. — [VS Wiki: Level up](https://vampire.survivors.wiki/w/Level_up)
- **Brotato** puts a shop after every wave, item tiers unlock by wave (2/4/8), and gold doubles as XP. — [Brotato Wiki: Shop](https://brotato.wiki.spellsandguns.com/Shop)
- **DRG:S:** level-ups during a stage plus a shop after each stage. — [PCInvasion via search](https://www.pcinvasion.com/?p=420264); [Prima Games](https://primagames.com/gaming/how-to-get-and-use-overclock-weapons-in-deep-rock-galactic-survivor)
- **RoR2:** each stage ends in a player-triggered teleporter event, with gold-bought chests scattered across the stage. — [Wikipedia: Risk of Rain 2](https://en.wikipedia.org/wiki/Risk_of_Rain_2)
- **Hades:** a 3-choice boon offer, themed by god, appears throughout a run. — [Wikipedia: Hades](https://en.wikipedia.org/wiki/Hades_(video_game))

### Inferences
- **Decision tiers that fit an 8-minute, 4-arena run (my proposal):**
  - **Every 10–30 s (in-flow, no menu):** pickups from kills, elites and breakables that visibly modify one attack; chasing a pinata enemy or not.
  - **Every 1–2 min (light choice):** optional shrines/altars/chests that cost coins or HP or raise risk.
  - **Every arena (~2 min):** the relic pick-1-of-3 in the post-arena breather; optionally a choice of next arena by its displayed reward, like Hades doors or RoR2's Lunar vendor picking the next stage.
  - **End of run:** a Results screen showing the build ("you ended with 9-pellet shotgun + Torgue mod"). This was not sourced; it is a common way to make the build legible and shareable.
- **MG: front-load the first choices** like VS's 5/15/25 XP curve. The first upgrade should land within ~30 s of arena 1 so the "no choices" impression never forms.
- **MG: co-op pause problem.** Short in-flow pickups are better than pausing menus. Relic choices can happen in the between-arena breather (which MG has) with a short timer so bots and humans don't stall.

### Gaps
- No designer source specifically on decision density per minute.
- Not verified: Hades room count per run or average run length; Brotato wave duration.

---

## 7. What designers say about why these systems work (designer statements vs critic opinion)

### Takeaway
The clearest designer explanations are the Diablo creators': "a slot machine… pulling that lever", "just one more monster", "two slot machine pulls". Gearbox's is that guns should "look the way they're gonna play", with parts built to combine into millions of favourites. Gunfire Reborn's devs say varied weapons, scrolls and talents make every run a new build. Kasavin speaks to knowledge carried forward and to "unnecessary" things that make games special. Galante says he does not know why VS works; the slot-machine framing for VS comes from critics plus his gambling-industry background.

### Cited Findings
- **Designer statements:**
  - Brevik and Schaefer on slot-machine loot, hope, drop sounds, identify scrolls and rarity colours — [Kotaku](https://kotaku.com/why-video-game-loot-is-so-addictive-according-to-the-c-1846695147)
  - Varnell and Duc (Gearbox) on procedural parts, manufacturers whose look predicts behaviour, and colour-coded element feedback — [Killscreen](https://www.killscreen.com/interview-gearbox-software-explains-their-love-guns-and-borderlands-2/)
  - Kasavin on carried-forward knowledge, boss memory, and "unnecessary" content — [Game Developer](https://www.gamedeveloper.com/design/roguelikes-and-narrative-design-with-i-hades-i-creative-director-greg-kasavin)
  - Kasavin (second-hand) on Dota 2 items as a boon reference — [AFK Gaming](https://afkgaming.com/dota2/news/6052-hades-dev-shares-how-dota-2-influenced-their-game)
  - Morse (Hopoo) on curated-but-randomly-placed loot feeling "a lot better than… truly random"; Drummond on showing items on characters — [Kotaku](https://kotaku.com/risk-of-rain-2-developers-discuss-the-games-shift-to-3d-1821553824)
  - Hopoo on 3D offering "much deeper design spaces" — [Wikipedia: Risk of Rain 2](https://en.wikipedia.org/wiki/Risk_of_Rain_2)
  - Duoyi (Gunfire Reborn) on builds from weapons, scrolls and talents — [Game Wisdom](https://game-wisdom.com/guest/gunfire-reborn-interview)
  - Galante: "no idea" why it is successful — [TheGamer](https://www.thegamer.com/vampire-survivors-creator-success-i-have-no-idea/)
  - Kevin Martens (D3 lead designer) on legendaries not being mathematically best before Loot 2.0 — [Game-Wisdom](https://game-wisdom.com/critical/loot-2-0-and-diablos-fourth-revival)
- **Critic/fan opinion:**
  - Edge's "dopamine bumps" and NWR's "favorite slot machine… absurd power curve" on VS — [NWR](https://www.nintendoworldreport.com/review/64583/vampire-survivors-switch-review); [Edge](https://www.ziniounlimited.com/publications/edge/2923/issues/664324/articles)
  - Backloggd: Hades boons are "mostly flat numeric bonuses" — [Backloggd](https://backloggd.com/u/elisemarie/)
  - GameGeeker: RoR2's linger-vs-leave wager — [GameGeeker](https://gamegeeker.com/games/2-632360/review?market=DE)
  - Brotato reroll-cost frustration — [mssv.net](https://mssv.net/2023/08/29/brotato/)

### Inferences
- **The common psychological mechanism** across designer quotes is **variable-ratio reward with readable signals.**
  - Many small "pulls" (every kill or chest could matter).
  - Instantly readable value (colour, sound).
  - Occasional jackpots that visibly transform play.
- **The "build" layer adds agency on top:** players combine pulls into a plan (Hades gods, Gunfire's weapon + scroll + talent).
- **MG: ethics/scope note.** The slot-machine framing is from the designers themselves. MG has no monetisation, so the risk is only design-side: too many pulls of junk (Loot 2.0's lesson) or invisible stat rewards. Keep each pull visible, countable and class-relevant.
- **MG: the developer's intuition that "relics alone won't save the game" is consistent with every source here.** Each successful game combines a frequent reward channel, an identity-defining choice channel, and an event/risk structure. Relics are only the second.

### Gaps
- No GDC talk transcripts were retrieved for:
  - Brevik's 2016 Diablo postmortem ([GDC Vault](https://gdcvault.com/play/1023469/contactUs)).
  - Supergiant's Hades talks.
  - Any Hopoo or poncle talk.

  Game Maker's Toolkit analyses were not fetched.
- No Path of Exile or Diablo 4 designer quotes on skill synergies or monster density were gathered in this pass.
