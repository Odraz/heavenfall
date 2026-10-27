# Rooms, encounters, hazards, destructible props and procedural stitching (for an Isaac-style co-op horde FPS roguelite)

Context used for the inference lines (from the repo, not from web sources): Meatgrinder builds on a 4 m grid; today's arenas are about 40 × 40 m to 60 × 50 m (docs/mvp.md); every wall is 16 m tall, so from the middle of a 40 m arena the walls hide everything below about 36° (docs/m10.md); corridors are 3–4 m wide (docs/decisions.md §8.3); open edges are an arcade of 4 × 8 m painted cut-out bays that show the painted sky and cloud cards 60–120 m beyond the edge (docs/m10.md); spawn points place at most 10 enemies per second and a wave's queue is placed over 300 ticks (docs/decisions.md M12 §2.2); the target is 1 000+ enemies (docs/rogue/brief.md). The heaven level features (Partitions, Cloches, Weights, Still Water, Tombs, Groves, Erasure, Ice) and enemies (Chaperone, Multiplied, Vaultguard, Soother, Inquisitor, Peacekeeper, Eraser, Ophan) come from docs/heavens.md.

## 1. Arena encounter design in FPS (Doom, Halo, Left 4 Dead; Serious Sam, Ultrakill)

### Takeaway
The proven unit is a locked arena with a readable start, a middle of a few waves or beats and a clearly signalled end. Variety comes from changing the context of a short combat loop (enemy combination, space, hazards), not from making the loop longer. Pacing works best as spikes and valleys, as Valve showed with measured numbers in Left 4 Dead. Doom contributes the arena shapes (jungle gym or canyon) and the traversal toys, and puts resources inside the arena so players push forward instead of hiding.

### Cited Findings
**Doom 2016 / Eternal**
- Doom 2016's "push forward combat" removes regenerating health, reloading and cover. The player gets resources from enemies instead: glory kills spray health, and chainsaw kills spray ammo. "Your best option in combat is usually to run towards enemies." — [Game Developer, Pushing push forward combat](https://www.gamedeveloper.com/game-platforms/pushing-push-forward-combat-with-gameplay); the talk is [Kurt Loudy & Jake Campbell, "Embracing Push Forward Combat in DOOM", GDC 2018](https://gdcvault.com/play/1024940/Embracing-Push-Forward-Combat-in)
- The GDC talk's own framing: the enemies are locked in a room with you, not the other way round — [GDC news, speaker Q&A](https://gdconf.com/news/speaker-qa-kurt-loudy-jake-campbell-break-combat-philosophy-doom)
- Doom Eternal keeps 2016's structure of corridors linking big wave-based arenas. Its arenas come in two kinds. **Jungle gyms** have distinct floors (solid planes making several separate levels of combat), so you can hop from skirmish to skirmish, and their extra obstacles make long-range enemy attacks less likely to land. **Canyons** are open with fewer divisions between elevations and feel more continuous — [Adam Atomic, Design of Doom Eternal](https://blog.adamatomic.com/post/613311014289768448/design-of-doom-eternal) (via search summary; direct fetch returned 403)
- Eternal's arenas have ammo, health and arcade upgrades deliberately placed around them, plus monkey bars, boost pads and teleporters for movement and tactical choice — [Adam Atomic](https://blog.adamatomic.com/post/613311014289768448/design-of-doom-eternal/amp); [TheOwlUC, "Perfecting the Action FPS Chess Game"](https://theowluc.com/story/doom-eternal-perfecting-the-action-fps-chess-game/)
- Marty Stratton (executive producer) said the team made Eternal's arenas and levels noticeably larger, for more room to move, and put enemies into the corridors between arenas to break up the arena-corridor-arena rhythm, which he admitted felt repetitive in 2016 — [GameStar (German)](https://www.gamestar.de/artikel/doom-eternal-verhindert-monotone-arena-level,3353561.html); [GameSpot](https://www.gamespot.com/articles/why-doom-eternal-incorporates-puzzle-platforming/1100-6473287/)
- Hugo Martin's framing: combat as fast chess, with an ideal piece (weapon) for each enemy piece; Eternal has twice as many demon types as 2016 — [TheOwlUC](https://theowluc.com/story/doom-eternal-perfecting-the-action-fps-chess-game/); [cogconnected](https://cogconnected.com/feature/12-things-love-doom-eternal/)
- Graybox arenas were treated like Lego sets, moved and recombined until the arrangement worked — [Shacknews, Hell Razer: The Making of Doom Eternal](https://shacknews.com/article/116635/hell-razer-the-making-of-doom-eternal?page=6)
- Classic Doom: the player moves at about 50 "scale mph", which supports large enemy counts and sprawling non-linear spaces, and most enemy attacks can be dodged by moving — [The Level Design Book, Combat](https://book.leveldesignbook.com/process/combat), citing JP LeBreton, *Coelacanth: Lessons from Doom*

**Halo (Jaime Griesemer, Bungie)**
- "30 seconds of fun" means playing a short loop in different environments, with different weapons, vehicles and enemies, and against different combinations of enemies, sometimes enemies fighting each other: "No 30 second stretch of Halo is ever repeated." Griesemer says most people use the phrase to mean the opposite — [Engadget, Half-Minute Halo interview, 2011](https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html)
- Two timescales: AI decides on a ~30 s scale (where to stand, when to shoot, when to dodge a grenade), and mission designers on a ~3 min scale (when to send reinforcements, when to retreat, encounter tactics) — [Engadget interview](https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html). Damian Isla: put "200 or 300 of these experiences back to back" and you have a game; one encounter is enter the space, plan an approach, execute it — [Game Developer, Bungie on eight years of Halo AI](https://gamedeveloper.com/game-platforms/in-depth-bungie-on-eight-years-of-i-halo-i-ai)
- Griesemer placed rocks on purpose so players had to fight certain encounters on foot. He criticized the 2026 remake for letting players smash the crates out of the way, which "wrecks the encounters": obstacles are encounter rules, not decoration — [Notebookcheck](https://www.notebookcheck.net/Former-Halo-CE-dev-talks-Halo-Campaign-Evolved-There-s-plenty-of-ways-to-improve-Halo-1-without-breaking-it.1148260.0.html)

**Left 4 Dead AI Director (primary source: Michael Booth, "The AI Systems of Left 4 Dead", Valve, 2009 slides)** — [PDF](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)
- Population tiers: Wanderers (high frequency, dazed commons), Mobs (medium frequency, a rush of **20–30** enraged commons), Special Infected (medium frequency, individual harassers), Bosses (low frequency, "force the Survivors to change their strategy"), Weapon caches (low), Scavenge items (medium).
- Mobs come at a randomized interval of **90–180 s** (Normal), at a randomized spot behind the team. Mob size grows from a minimum just after the previous mob to a maximum over time, to balance frequent successive mobs. Boomer vomit forces a mob and resets the timer.
- **75% of mobs come from behind**, because wanderers, specials and bosses are usually engaged ahead.
- Specials spawn at individually randomized intervals, in areas the team can't see, chosen by class: Boomers ahead (slow, can't chase), Smokers above the team.
- Bosses (Tank, Witch, Nothing) are shuffled and dealt every N units along the route ± random. No repeats in a row. Adaptive pacing does not affect them, because "boss encounters are intended to change up the pacing".
- Intensity per survivor rises with damage taken, incapacitation, being pushed off ledges, and nearby infected deaths (inversely proportional to distance). It decays toward zero, but not while infected are actively engaging.
- Phases: **Build Up** (full threat population until intensity crosses the peak threshold) → **Sustain Peak** (**3–5 s** more) → **Peak Fade** (minimal population; waits for a natural break in the action) → **Relax** (minimal population for **30–45 s**, or until the team has travelled far enough), then Build Up again. Relax means no wanderers until the team is calm, no mobs, no new specials.
- "Constant, unchanging combat is fatiguing; long periods of inactivity are boring." The algorithm changes frequency (pacing), not amplitude (difficulty).
- Static placement of enemies and loot "hinders replayability", because players memorize it and the game "degenerates into a race". Designers place many possible weapon caches and item groups and the Director chooses which exist ("structured unpredictability").

**Spawning placement in general**
- If reinforcements arrive while the player fights inside the arena, the player "may be overwhelmed and should have fought from the door instead". Splitting an arena into layers means no single position sees everything, so the player keeps moving. Predictable hidden information supports planning; unpredictable backspawns and ambushes cost tactics — [Andrew Yoder, The Door Problem of Combat Design](https://andrewyoderdesign.blog/2019/08/04/the-door-problem-of-combat-design/)
- Warframe (procedural tiles): if spawn locations aren't carefully controlled, a mission won't have proper pacing. Daniel Brewer's GDC 2013 AI talk used a tactical area map, a distance map and a player influence map — [MCV, Daniel Brewer on Warframe pacing](https://mcvuk.com/?p=85652); [inside-games.jp GDC 2013 coverage](https://www.inside-games.jp/article/2013/03/26/65013.html)

### Inferences
- Meatgrinder's rooms should be Doom-style lock-in arenas (doors close on entry, open on clear). The brief's "health never comes from enemies" finding argues for placing heal sources inside the arena (Doom's placed health; heavens.md's Cloches; prop drops), so the good health is in the fight, not at the door.
- Use the L4D numbers as the rhythm inside and between rooms: a room fight is the Build Up + Peak; the corridor or door transit plus the cleared-room trickle (section 8) is the Relax of 30–45 s. Never spawn a full new wave within ~3–5 s of the previous one peaking; wait for a natural break (Peak Fade) before the next wave's arrival.
- Spawn rule for hordes: most of a horde wave (L4D: 75%) arrives behind or beside the party, away from where the current ranged or elite threats are, and specials or elites appear where the party can't see them appear. Bosses or elite events skip the adaptive rule.
- Room shapes map directly onto Doom's two kinds. **Canyon** rooms (open, big, few divisions) are horde rooms, because 1 000 enemies need open flow and AoE lanes. **Jungle gym** rooms (terraces, separate levels, more obstacles) are ranged and flyer rooms, because obstacles blunt long-range fire. The 2.5D per-cell wall-height model can build both: terraces are raised floor cells, pillars are tall cells.
- Halo's lesson for a room pool: one room template is one "30 seconds of fun" context. Variety comes from recombining (template × enemy focus × hazard × heaven), not from more waves.

### Gaps
- No primary numbers found for Doom Eternal's wave composition (how many fodder per heavy, when Marauders or Tyrants are introduced) or for monkey-bar or jump-pad spacing; Adam Atomic's post could only be read via summary.
- Serious Sam's open arenas and Ultrakill's room design: no sources fetched (out of tool budget). The common claims (Serious Sam open fields with hundreds of enemies; Ultrakill's style-meter arenas) are unverified here.

## 2. Room fight length, wave counts and ramp within a room and across a floor

### Takeaway
No source gives authoritative per-room clear times for Hades, Gunfire Reborn or Roboquest. Reliable anchors are Halo's 30 s loop and 3 min encounter scale, L4D's 20–30-enemy mobs every 90–180 s with 30–45 s relax, and Hades' staggered "next cluster spawns as enemies die" model with at most about a second of respite. Roguelites put breather or shop rooms between fight rooms and save the hardest rooms for the stretch before the boss.

### Cited Findings
- Hades: the room is the basic unit: enter, fight waves, choose a reward, move on. Enemies don't fully spawn in waves but are staggered, spawning in clusters as enemies die, "at most, you receive a second of respite". Each region ends with a boss, preceded by a series of challenging rooms "chock-full of enemies" — [itch.io, core systems and loops in Hades](https://itch.io/blog/772262/blog-post-1-exploring-the-core-systems-and-loops-in-hades); [Scientific Gamer, Thoughts: Hades](https://scientificgamer.com/thoughts-hades/) (fan analyses, not Supergiant)
- Gunfire Reborn: domains split into segments, segments into rooms. The door locks behind you until every enemy is dead; a room is "several waves" and doesn't take long to clear. Some players dislike the wave-defense rooms, which can end a run — [Seasoned Gaming review](https://seasonedgaming.com/2020/06/06/review-gunfire-reborn-guns-grenades-and-game-overs); [Steam discussion](https://steamcommunity.com/app/1217060/discussions/0/3104637814600112107)
- Roboquest levels are combat stretches, safe rooms and survival rooms (fight waves until a bar at the top of the screen depletes and the door opens). Per level: 2–4 combat stretches, 0–2 survival rooms, 2–3 safe rooms (entry, mid, pre-boss), and secret rooms inside stretches. The page lists no survival-room durations — [Roboquest wiki, Levels](https://roboquest.wiki.gg/wiki/Levels)
- Enter the Gungeon: enemy rooms are spaced with breather, shop and hub rooms; the boss is always a reasonable distance from the start — [Boris the Brave, Dungeon Generation in Enter the Gungeon](https://www.boristhebrave.com/2019/07/28/dungeon-generation-in-enter-the-gungeon/)
- Isaac: normal rooms come in easy, medium and hard pools. Stage one draws easy and medium; stage two draws medium and hard; Curse of the Labyrinth draws from all three — [Boris the Brave, Dungeon Generation in Binding of Isaac](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Isaac room count per floor: `random(0..1) + 5 + floor(level × 2.6)`, so 7–8 rooms on level 1, growing by 2–3 per level; Labyrinth +80% (max 45) — [Boris the Brave, Isaac](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Halo: ~30 s combat loop, ~3 min encounter (reinforcements, retreats) — [Engadget](https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html)
- L4D: mob 20–30 commons every 90–180 s; mob size ramps from minimum to maximum over time; peak sustained 3–5 s; relax 30–45 s — [Booth 2009](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)
- The Level Design Book frames an encounter as beginning / middle / end. The middle decides how many waves and how long; the end must make it clear the battle is over — [Level Design Book, Encounter](https://book.leveldesignbook.com/process/combat/encounter)

### Inferences
- Target clear times for a 4-player party (proposal, not sourced): standard 1×1 room **45–75 s** (2–3 waves); 2×1 or L room **75–120 s** (3 waves); 2×2 horde room **120–180 s** (3–4 waves, the last a big crest); elite or challenge room **60–90 s**. This keeps one room within Halo's 3 min encounter ceiling, and a 10–14-room floor at about 15–20 min including transit, shop and level-up.
- Wave ramp inside a room: wave 1 is about 30% of the room's budget and only fodder (lets players survey: the foothold rule, section 4); wave 2 about 30% plus the room's focus threat; the last wave about 40% with the focus threat doubled or one elite. Use Hades-style overlap (the next wave starts when the living count drops below about 25% of the current wave, or after a timeout) so there are no dead seconds, but keep a hard ~3–5 s gap after a crest (L4D Sustain Peak).
- Ramp across a floor: pick room difficulty pools by distance from the lobby (Isaac's easy, medium and hard pools by stage → here by graph distance: near the lobby easy and medium, near the boss medium and hard). Insert a breather (shop, level-up, empty connector) at least every 3–4 fight rooms on the critical path (Gungeon).
- Use Isaac's growth formula shape for the nine heavens (e.g. 8 rooms on heaven 1 up to about 25 on heaven 9), since Meatgrinder rooms take 5–10× longer than Isaac's.
- Signal the end loudly (doors unlock, a sting, enemy creep and hazards fade; Isaac clears enemy creep when the room is done, section 5).

### Gaps
- No sourced per-room durations for Hades, Gunfire Reborn or Roboquest, and no wave counts for Roboquest survival rooms. The times above are design proposals.
- Gunfire Reborn and Roboquest room dimensions were not found.

## 3. Room archetypes with one focus, combining at most two, and enemy composition

### Takeaway
Encounter designers keep the enemy palette small: one type is a rest or tutorial, two types that interact is a "regular" encounter, three is complex and hard to read, four or more is a brawl. That backs the brief's "one focus, at most two". The L4D mix (masses of commons + periodic specials + rare bosses) is the template for "fodder + one harasser". Budgeting by threat cost (Dead Cells) keeps rooms of different sizes fair.

### Cited Findings
- Enemy palette size: **1 type** = tutorial or rest; **2 types** = a regular encounter where the two interact interestingly; **3** = complex, hard to read; **4** = a brawl (keep it readable as two factions 2v2); **5+** = chaotic, exciting briefly, but players focus on a small subset. "Generally, use only a few enemy types at once." — [Level Design Book, Encounter](https://book.leveldesignbook.com/process/combat/encounter)
- Personas: define player personas (runners, snipers, campers) and decide per encounter which strategies to support. Encourage under-used mechanics by restricting alternatives (ammo starvation, physics props, slow enemies) — [Level Design Book, Encounter](https://book.leveldesignbook.com/process/combat/encounter)
- L4D's layered population (wanderers high frequency, mobs medium, specials medium, bosses low); specials spawn where they suit their class (Boomers ahead, Smokers above) — [Booth 2009](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)
- Dead Cells monster density: count scales with total combat-tile length (example: 1 monster per 5 tiles). Some dangerous monsters **count as 10 tiles**; some are limited to one per tile or one per level; some can't share a platform with other monsters; some need open space — [Game Developer, Dead Cells hybrid level design (Sebastien Benard)](https://www.gamedeveloper.com/design/building-the-level-design-of-a-procedurally-generated-metroidvania-a-hybrid-approach-). The numbers are illustrative, not Dead Cells' actual values.
- Dead Cells tiles are built per purpose (treasure, merchant, combat) and per biome, and are never reused across biomes (the sewers are tight, which limits jumping and dodging) — [same article](https://www.gamedeveloper.com/design/building-the-level-design-of-a-procedurally-generated-metroidvania-a-hybrid-approach-)
- Warframe tile types include start, extraction, Arena, boss, hallway, Defense and Interception rooms; some tiles have moving containers, traps, parkour areas, zip lines and randomly placed explosives — [Warframe wiki, Tilesets](https://wiki.warframe.com/w/Tilesets)
- Halo's variety comes from "different combinations of enemies, sometimes enemies fighting each other" — [Engadget](https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html)
- Gungeon injects special rooms by rule (type, placement, probability, preconditions); connectors are enemyless rooms, often with a hazard — [Boris the Brave, Gungeon](https://www.boristhebrave.com/2019/07/28/dungeon-generation-in-enter-the-gungeon/)

### Inferences
- **Room = base swarm + at most one focus + at most one hazard.** "Two focuses" in the brief should mean focus + hazard, or two enemy focuses only in large rooms. Per the palette rule, a room never mixes more than 2 non-fodder enemy types; fodder (Blessed) doesn't count, as it is the L4D "commons" layer.
- Proposed archetypes (each a template tag; the spec can map sizes):
  - **Horde** (2×2 or 2×1, canyon): fodder only, 3–4 waves, large final crest; open floor, few chokepoints, the room's job is AoE and positioning.
  - **Ranged** (1×1 or L, jungle gym): fodder + one ranged type (today's Choristers) on high ground or behind pillars; LOS blockers mandatory (section 4).
  - **Flyers** (1×1 or 2×1, tall, roofless or high roof): fodder + Cherubs; open sky lines, few tall pillars, so flyers are visible against the painted sky.
  - **Ground brutes** (1×1, canyon): fewer, heavier ground enemies with charges (Peacekeeper-like); obstacles to bait charges into walls.
  - **Elite** (1×1 or L): one elite per wave with a fodder escort; the elite enters through a visible beam, never behind the party (Booth: bosses change strategy and aren't hidden).
  - **Hazard** (any size): fodder-only enemies + one hazard that also hurts enemies (section 5), so the room's skill is luring.
  - **Challenge / treasure** (1×1 or 2×1): the brief's treasure room; one optional extra threat for a bigger reward.
  - **Connector** (corridor or 1×1, enemyless or trickle): Gungeon-style, may carry a hazard and a prop cluster.
- Allowed combinations (proposal): Horde + Hazard, Horde + Flyers, Ranged + Hazard, Ranged + Ground, Elite + fodder only. Forbidden: Ranged + Flyers in the same wave (two sources of airborne or long-range fire is the "3 types, hard to read" case), and Elite + Hazard on heaven 1–2.
- **Budget by threat points (Dead Cells):** each room size has a point budget scaled by heaven and player count; a fodder enemy costs 1, a ranged or flyer 5–10, an elite 50–100 (proposal). Per-type caps (e.g. max 1 elite alive, max N ranged alive) and "needs open space" flags (Ophan, Peacekeeper) belong in the enemy definitions, not the room.
- Each heaven's new enemy (heavens.md) should get its own "focus" archetype in that heaven's pool and appear as a secondary focus in later heavens.

### Gaps
- Darktide and Vermintide horde + special + elite spawn ratios: not found in this pass (no Fatshark blog fetched).
- No sourced data on how Doom Eternal mixes fodder, heavies and super-heavies per wave.

## 4. Obstacles with purpose: cover, chokepoints, high ground, platforms, pillars, spawn closets, LOS blockers

### Takeaway
Obstacles are encounter rules. Halo placed rocks to force on-foot fights; Doom's jungle-gym obstacles blunt long-range fire. Layering the arena means no spot sees everything, so players move. Give players a foothold or vista to read the room before the fight. In co-op, avoid geometry that lets the party hold one chokepoint safely. For hordes, chokepoints should be a risk/reward option, not a safe spot.

### Cited Findings
- Footholds: let players survey the arena before combat, or they fight from the doorway and ignore the arena. Method 1: enemies visible and unaware from the entrance, reinforcements around a corner. Method 2: empty room, ambush triggered when the player crosses a midfield threshold, optionally baited with items in the middle ("ambushes get less effective after the first attempt"). Method 3: a vista with a one-way entrance (a short drop or an **airlock door that closes behind**), committing the player. If players ignore the vista, put resources there, smooth the route into it, or hide the arena entrance with a **U-turn layout** — [Level Design Book, Encounter](https://book.leveldesignbook.com/process/combat/encounter)
- Cover shows where it is safe and where it is risky, where to fight or recover, and depends on the game's weapons and mechanics. Design order: enemies → encounters → cover → balance — [Level Design Book, Combat](https://book.leveldesignbook.com/process/combat)
- Layered arenas mean "there is no longer a position that can see everything". Height differences can keep AI on an island if enemies can't climb more than a step. A commenter notes that continuous fire through a chokepoint is especially dangerous (degenerate) in co-op. One-way drops and closing doors deny agency; prefer loops and backtracking routes — [Yoder, Door Problem of Combat Design](https://andrewyoderdesign.blog/2019/08/04/the-door-problem-of-combat-design/)
- Jungle gyms (distinct floors, more obstacles) make long-range enemy attacks less likely to land; canyons are continuous — [Adam Atomic](https://blog.adamatomic.com/post/613311014289768448/design-of-doom-eternal)
- Doom Eternal arenas contain monkey bars, boost pads and teleporters for movement and tactical choice — [Adam Atomic](https://blog.adamatomic.com/post/613311014289768448/design-of-doom-eternal/amp)
- Griesemer's rocks forced on-foot combat; removing them "wrecks the encounters" — [Notebookcheck](https://www.notebookcheck.net/Former-Halo-CE-dev-talks-Halo-Campaign-Evolved-There-s-plenty-of-ways-to-improve-Halo-1-without-breaking-it.1148260.0.html)
- L4D spawns specials and wanderers only in areas not visible to any survivor, using a potentially-visible-area set from the nav mesh — [Booth 2009](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)
- Dead Cells biomes differ in tightness (sewers limit jumping and dodging; ramparts more linear) — [Game Developer, Dead Cells](https://www.gamedeveloper.com/design/building-the-level-design-of-a-procedurally-generated-metroidvania-a-hybrid-approach-)

### Inferences
- Every obstacle in a room template must carry a **purpose tag**, and the validator should reject untagged geometry: `cover` (blocks LOS from ranged spawn zones to the main floor), `kite` (a pillar or block the party can circle with a swarm trailing), `high` (a terrace 2–3 m up with 1–2 stair or jump access points; enemies reach it only by those), `choke` (a doorway-width gap of 4–8 m that funnels the swarm for AoE), `jump` (a launch pad or ledge for Falling Star or Shadowstep routes), `spawn` (a closet or beam point), `lure` (a hazard edge), `prop` (destructible cluster).
- **Chokepoints for hordes:** make them offensive tools (a 4–8 m gap the swarm pours through, worth a censer cloud or Discord), but never a dead-end the party can camp. Each choke has two sides open to the main floor, or spawns flank it (L4D: 75% from behind) so holding it gets punished within one wave.
- **Ranged rooms:** ranged spawn points sit on `high` cells; each must be reachable within ~8–12 m of cover from the main floor; pillars (1×1 or 2×2 cells at 16 m) break every straight line longer than ~20 m. This matches the MVP Cloister's "pillars that block line of sight to the Choristers".
- **Flyer rooms:** few tall blockers, a roofless or high ceiling, so Cherubs read against the sky; low walls (1–2 m) for ground fodder that flyers ignore.
- **Spawn closets in a 2.5D grid:** recessed alcoves in the outer or inner walls, or beam points on the floor (today's spawn rays). Each spawn point needs a "not visible from the party" check (L4D) for trickle and horde spawns. Elite spawns are visible and telegraphed instead.
- **Footholds:** each room template's door sockets open onto a 4–8 m threshold strip with no spawn points; wave 1 starts when the first player crosses about 25% into the room (LDB Method 2), or when all living players are inside (co-op door lock).
- **AI islands (Yoder):** high ground reachable only by stairs gives the party a breather the swarm must queue for; keep at least one per large room but make ranged and flyers the counter, so it's not safe forever.
- Jump pads and monkey-bar equivalents suit the heavens (cloud lifts, Falling Star launchers), but the 2.5D renderer and bots need nav links; keep 1–2 per room maximum (proposal).

### Gaps
- No numeric guidance found for cover spacing, chokepoint widths or high-ground heights in published FPS guidelines; the numbers above are proposals scaled from the existing 4 m grid and arena sizes.
- Valve's L4D level design talks (beyond Booth's AI deck) were not fetched; the 2009 "Replayable Cooperative Game Design" PDF did not text-extract.

## 5. Hazards: damaging floors, ice, slime, goo, fire, electric, spikes; strategy, readability, fairness

### Takeaway
The strongest pattern across Isaac and Hades: hazards hurt enemies more than players (Isaac spikes deal 1 heart to the player but 8 damage to enemies; red poop 16 to enemies), so the skill is luring and knockback. Telegraph state changes with a 2–3 s anticipation and consistent colors, mark dangerous surfaces with a constant animated cue, and clear enemy-made hazards when the room is done.

### Cited Findings
- **Isaac creep:** enemy creep damages Isaac but not other enemies; Isaac's creep damages walking enemies but not him. Red creep deals half a heart. Creep that will affect the player flickers rapidly. Flight or certain items nullify it. When all enemies in a room die, their creep "quickly disappears" — [Isaac wiki, Creep](https://bindingofisaacrebirth.wiki.gg/wiki/Creep); [Red Creep](https://bindingofisaacrebirth.wiki.gg/wiki/Red_Creep)
- **Isaac spikes:** 1 heart to the player, **8 damage to non-flying enemies**; flight or jumping avoids them; retractable spikes cycle on timers and are safe while retracted; pressure plates switch them off. Sacrifice-room spikes hurt even flyers — [Isaac wiki, Spikes](https://bindingofisaacrebirth.wiki.gg/wiki/Spikes)
- **Isaac red poop:** half-heart contact damage to the player, **16 to enemies**, drops nothing, reforms **3 s** after destruction — [Isaac wiki, Red poop](https://bindingofisaacrebirth.wiki.gg/wiki/Red_poop)
- **Hades:** Tartarus spike plates fire after a very short delay when an enemy or Zagreus steps on them, low damage to Zagreus, high to enemies. Pressure-plate dart traps exist, and players push or lure enemies onto spikes. Exploding objects damage groups, and projectile-shooting objects let you bait enemies into fire (fan wikis and analyses) — [Fextralife Hades Walkthrough](https://hades.wiki.fextralife.com/Walkthrough); [itch.io Hades analysis](https://itch.io/blog/772262/blog-post-1-exploring-the-core-systems-and-loops-in-hades)
- **Telegraphing (God of War Valkyries, via LDB):** anticipation windows of **about 2–3 s**; color-coded FX (yellow = parryable, red = must evade); consistent timing; at least one unblockable attack telegraphed well in advance — [Level Design Book, Encounter](https://book.leveldesignbook.com/process/combat/encounter)
- **Warframe** tiles carry traps and randomly placed explosives as tile features — [Warframe wiki, Tilesets](https://wiki.warframe.com/w/Tilesets)
- **Gungeon** connector rooms are enemyless but often have a hazard — [Boris the Brave, Gungeon](https://www.boristhebrave.com/2019/07/28/dungeon-generation-in-enter-the-gungeon/)
- **L4D** raises survivor intensity when players are pushed off ledges, and alarm hordes are triggered by environmental elements (car alarms, security doors) — [Booth 2009](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf); [TechRaptor, 10 years of L4D](https://techraptor.net/content/10-years-of-left-4-dead)
- Existing Meatgrinder heaven features already follow these rules: Partitions (2 s glow, 8 s up, every 20 s), Weights (hit players and enemies alike), Tombs (6 s fire after breaking), Inquisitor Verdict (ignites 2 s later), Still Water (slows everyone), Ice (everyone slides, knockback ×3) — docs/heavens.md

### Inferences
- **Rule 1, asymmetry:** every floor hazard deals ≥5× more damage to enemies than to players per second (Isaac 8 vs 1 heart; 16 vs half a heart), and fodder pathing does not avoid hazards (or avoids them only when idle), so luring works. Hazards never one-shot a player.
- **Rule 2, telegraph:** timed hazards (crushers, spike cycles, fire jets, Partitions) glow or sound **2 s** before activating (matching heavens.md's 2 s Verdict and Partitions); permanent damaging surfaces use one constant animated cue (Isaac's flicker) that is visible in the baked floor lightmap as an emissive decal, not baked shading.
- **Rule 3, color language per effect, constant across heavens:** e.g. damage = red-orange (lava, fire), slow = violet or blue goo, poison = green slime, slippery = pale blue ice sheen, electric = white-yellow arcs. Color + motion, not color alone (colorblind; see barrels, section 6).
- **Rule 4, enemy-made hazards end with the room** (Isaac); level hazards persist but turn off or freeze once cleared, so backtracking stays safe.
- **Proposed hazard set** (each a room-template layer on floor cells): Lava or holy fire (damage over time), Ice (heaven 9 already), Slowing goo or Still Water (heaven 5), Venom slime (DoT that lingers 2–3 s after leaving), Spike plates (Hades-style trigger, delay ~0.5 s, mostly anti-enemy), Crushers or Weights (heaven 4, on tracks, telegraphed), Fire bursts from Tombs (heaven 6, player-triggered). One hazard type per room (palette rule); hazard cells ≤ about 25% of walkable floor in horde rooms, so 1 000 enemies still flow (proposal).
- Knockback classes (the Fallen's leap, Discord, Ophan) gain value in hazard rooms; that's the "power from doing the class's job" rule.
- Hazards and horde performance: hazard damage should be applied per cell (a cell lookup on enemy movement), not per-entity collision, to stay cheap with 1 000+ enemies (engineering inference).

### Gaps
- No primary Supergiant sources on trap numbers; Hades facts above come from fan wikis.
- Darktide and Vermintide hazards, Diablo ground effects and Dead Cells traps: not researched in this pass.
- Doom Eternal hazard specifics (slime, lava, crushers in arenas) not sourced.

## 6. Destructible props: explosive barrels, buff shrines, loot pots; frequency, strength, drops, telegraphing

### Takeaway
Isaac's numbers are a ready template: common breakables (urns, mushrooms, skulls) drop nothing 68% of the time, small rewards often, rare items very rarely, and about 19% of the time a small punishment. One special "tinted" breakable per room, marked with an X, gives a guaranteed better reward. Explosive props work when red, near enemy groups, chainable, and readable by shape as well as color.

### Cited Findings
- **Isaac tinted rocks:** always marked with an "X" (sometimes slightly tinted); **only one per room**; found on every stage; each drops 1–2 rewards: soul heart 27%, 2 soul hearts 16.2%, soul heart + bomb 13.5%, soul heart + key 8.1%, key + bomb 3.6%, 2 bombs 2.7%, 2 keys 0.9%, locked chest 17.1%, chest 0.9%, Small Rock (unlockable) 10%. Super Special Rocks are harder to spot and also one per room — [Isaac wiki, Tinted Rock](https://bindingofisaacrebirth.wiki.gg/wiki/Tinted_Rock)
- **Isaac urns:** nothing 68%; 1 or 2 coins 4.84% each; Swallowed Penny 2.5%; Quarter 0.5%; 1 or 2 spiders (enemies) 9.67% each. **Mushrooms:** nothing 68%; pill 9.67%; Liberty Cap 2.5%; rare items 0.25–0.33%; poison gas (knockback, half a heart) 19.33%. **Skulls:** nothing 68%; card or rune 9.67%; black heart 2.5%; rare familiars 0.25%; a Host enemy 19.33%. Each type is biome-specific (urns in Basement and Cathedral, mushrooms in Caves, skulls in Depths) — [Isaac wiki, Tinted Rock page (obstacles section)](https://bindingofisaacrebirth.wiki.gg/wiki/Tinted_Rock)
- **Red barrels:** Bulletstorm's developers first tested green barrels; players ignored them, so they made them red so players "can quickly read the environment and act intuitively" — [GamesRadar, most explosive red barrels](https://gamesradar.com/most-explosive-red-barrels) (via search summary). Explosive barrels are often placed suspiciously close to enemy groups as a hint, are usually red or yellow, and some use a fuse (a jet of flame) before exploding — [Giant Bomb, Exploding Barrel](https://giantbomb.com/wiki/Concepts/Exploding_Barrel)
- Accessibility: a muted red barrel blended in for players with mild protanomaly; the fix was saturated red, higher-contrast bands and a skull or stripe symbol so it reads without color — [Nexus Mods, GRAVEN barrel mod](https://www.nexusmods.com/graven/mods/3)
- Doom barrels damage everything in their blast radius, including monsters, players and other barrels, so clusters chain — [Doom Wiki, Barrel](https://doomwiki.org/wiki/Barrel) (via search summary; direct fetch returned 403, so no exact HP or radius numbers here)
- Pitfalls: in one jam game, barrels killed the player's allies, which discouraged using them; barrels as the only mechanic get repetitive, so add fuses, triggered devices or chain-breaking barriers — [itch.io jam entry](https://itch.io/jam/doki-jam/rate/3800311); [TUM games lab, Gangbarrel](https://collab.dvb.bayern/spaces/TUMgameslab2425winter/pages/1082331872/Gangbarrel)
- Hades rooms feature exploding objects that damage groups of enemies — [itch.io Hades analysis](https://itch.io/blog/772262/blog-post-1-exploring-the-core-systems-and-loops-in-hades)
- L4D: designers place many possible item groups and the Director picks which exist, because static loot gets memorized — [Booth 2009](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)

### Inferences
- **Three prop families, one silhouette and color each, constant across heavens** (the heaven changes the art, not the code):
  1. **Blast prop** (red + a symbol, e.g. a cracked censer or reliquary): AoE damage when broken, chains to other blast props within its radius after ~0.2 s, damages enemies fully and players at reduced damage (bots never shoot one with an ally within its radius, per the jam lesson).
  2. **Blessing prop** (gold, a shrine or chalice): an AoE buff when broken (a brief heal pulse, speed or shield in a radius), one visible effect, so it obeys the "one visible effect per ability" rule.
  3. **Loot breakable** (white or ivory urn or vase; what playtest 5 asked for): Isaac odds: about 68% nothing, ~20–25% small (halo coins), ~5% an item (used at once per the brief), and optionally ~5–10% a small punishment (one Blessed pops out) for spice.
  4. Optional **marked breakable** (Isaac's X-rock): at most one per room, a distinct mark, a guaranteed item or a larger halo pile.
- Frequency (proposal): 1×1 room 4–8 loot breakables, 1–3 blast props, 0–1 blessing prop; 2×2 room double. Blast props sit next to enemy spawn zones or chokepoints (the Giant Bomb hint).
- Randomize which designer-placed prop sockets are filled per run (L4D structured unpredictability), so templates don't play the same twice.
- Props are billboards on cells; a broken prop leaves a decal; drops use the existing pickup system (halos fly to players). Don't let the swarm break props by walking (prop hits come from attacks), or 1 000 enemies will pop everything.
- heavens.md features (Cloches = heal props, Tombs = blast props) can be the per-heaven skin of these families.

### Gaps
- Exact Doom barrel numbers (HP, radius, damage) were not retrieved (403).
- No sourced data on buff-shrine frequency in shooters; the blessing-prop numbers are proposals.

## 7. Procedural stitching of hand-made rooms on a grid in 3D (doors, big rooms, sightlines, sky, art per biome)

### Takeaway
Every reference uses the same split: an abstract graph or grid decides which rooms connect, then hand-made templates with predefined exit sockets fill the nodes, with rerolls on mismatch. Isaac's version is the simplest and fits the brief exactly: a 9×8 cell grid, a door at the exact center of every shared edge, big rooms (2×2 has up to 8 exits) placed first. Sightlines between rooms in 3D can then be handled with closed doors or short airlock or U-turn vestibules, windows only on edges facing outside the layout, and walls taller than any eye position.

### Cited Findings
**Binding of Isaac** — [Boris the Brave, Dungeon Generation in Binding of Isaac](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Floor grid **9×8**; start at cell 35 (center). Breadth-first growth from a queue; a candidate neighbour is skipped if it is occupied, **already has more than one filled neighbour** (prevents blobs and loops), the room target is met, or a 50% roll fails. Cells that add no room become dead ends. Above 16 rooms the start is re-queued. Boss can't be adjacent to the start; otherwise regenerate.
- **Boss** = the last dead end (one of the farthest from the start). Shop, treasure and others go in random dead ends; a **secret room** goes in an empty cell adjacent to ≥3 rooms and no dead ends (criteria loosen after 300 and 600 attempts).
- **Doors:** adjacent rooms share a door (or a destructible wall) at the **exact center of the shared edge**; every room can be entered from all four directions.
- **Large rooms (Rebirth):** 11 shapes (2×2, 2×1, L, narrow corridors, rotations). Expansion loops over every exit of a room, **up to 8 on a 2×2**. Large rooms are tried first at random; only the entry cell gets the neighbour check, plus "remaining footprint empty". They can create loops (two large rooms side by side). After placement there's a **95% chance the shape is removed from the pool** (rarity). Large boss rooms replace the boss cell and may not be adjacent to extra rooms.
- Room templates are chosen considering which neighbours (doors) are needed; some templates only appear where no door is needed on a side. The Basement alone has **174** normal room templates.

**Enter the Gungeon** — [Boris the Brave, Gungeon](https://www.boristhebrave.com/2019/07/28/dungeon-generation-in-enter-the-gungeon/)
- Hand-authored **flow graphs** per stage (4 for the first stage, 8 for the second): a tree from the start plus extra edges for loops. Nodes store room type and required connections. Rooms can be replaced with chains of random length (later stages). Special rooms are **injected** with type, placement, probability and preconditions; secret rooms at dead ends (90% spawn chance, 1/5 chance to attach to any room).
- About **300** candidate rooms in stage 1; the generator avoids repeats. **Exits are predefined locations in each room's metadata.** Loops are laid out as composites; the closing connection is a small room or a corridor of **4–30 units**. Rerolls up to 3 times when stuck. Chests are mostly behind one-way loops or deep in the level; teleporters allow fast return.

**Dead Cells** — [Game Developer, Benard](https://www.gamedeveloper.com/design/building-the-level-design-of-a-procedurally-generated-metroidvania-a-hybrid-approach-)
- Fixed world layer; per-biome concept graph built in order: entrance and exit → special rooms → combat and exploration tiles. The graph constrains length, number of special tiles, labyrinthness, and the tile distance from entrance to nearest exit. For each node a random tile is picked from the biome pool and checked against the node (location, entrance count, type); retry until one fits. Tiles are biome-specific.

**Unexplored (cyclic generation)** — [Boris the Brave, Dungeon Generation in Unexplored](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/)
- 5×5 node grid; start, goal, and a large loop between them; one of **24** major cycle types sets pacing; locks, keys and one-way "valves" force progress order; hub cycles guard the exit with a challenge. The grid is doubled for corridor cells, then expanded 5× to tiles. Abstract stages (node and room types) run before tile conversion. About 5 000 rewrite rules in total.

**Warframe** — [Warframe wiki, Tilesets](https://wiki.warframe.com/w/Tilesets)
- A tileset has **at least 30 tiles** (rooms of various sizes) that connect into procedurally generated maps; tile types include start, extraction, arena, boss and hallway.

**Generic connectors in 3D**
- An academic method generates 3D levels by joining human-made geometry through connectors with pins, tested on a multiplayer shooter — [Universidade Lusófona, Procedural game level generation by joining geometry with hand-placed connectors](https://research.ulusofona.pt/en/publications/procedural-game-level-generation-by-joining-geometry-with-hand-pl/)
- L4D's Active Area Set: the Director creates and destroys population as the area around the team moves, which "allows for hundreds of enemies using a small set of reused entities" — [Booth 2009](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)

**Sightlines and commitment**
- An airlock door that closes behind the player, a short vertical drop, or a U-turn entrance hides the arena and commits the player — [Level Design Book, Encounter](https://book.leveldesignbook.com/process/combat/encounter)

### Inferences
- **Grid unit.** One map cell = one room unit. Proposal: **36 × 36 m interior (9 × 9 grid cells of 4 m) + 4 m shared wall band** = a 40 m pitch, so a 1×1 room is close to today's ~40 m arenas, a 2×1 is 76 × 36 m and a 2×2 is 76 × 76 m (horde scale for 1 000+ enemies). Door sockets at the center of each unit edge: a 1×1 has 4, a 2×1 has 6, an L (3 units) has 8, a 2×2 has 8 (Isaac). Each socket is an 8 m opening (2 grid cells), centered, so templates must keep the socket strips and their 4–8 m threshold free.
- **Generation:** use Isaac's grid algorithm (9×8, "no more than one filled neighbour" rule, big shapes first with a 95% rarity removal), then pick templates per node by `(shape, rotation, required sockets, archetype, heaven, difficulty pool)`. Unused sockets become solid wall (or a "no door needed" template variant). Rotations and mirrors multiply the pool; the spec must say whether templates may rotate (art like painted cornices may not care, but lighting bake does).
- **Special rooms per the brief:** boss = farthest dead end, with exactly one socket (Isaac boss rule + "not adjacent to start"); level-up = a dead end adjacent to the boss's neighbour (proposal); treasure = a dead end ≥3 steps from the lobby; shop = any other dead end. Optional Gungeon-style "loop" big rooms are fine because Isaac's big rooms already create loops.
- **Template pool size:** Isaac 174 per floor, Gungeon ~300, Warframe ≥30 per tileset. For an AI-built game, about **20–30 templates per size class shared across heavens, re-skinned per heaven, plus 3–5 heaven-specific ones (the level feature)** is the realistic floor (proposal). Dead Cells' "tiles are never reused across biomes" is a luxury; Meatgrinder can share geometry and keep art per heaven via textures, wall heights and sky.
- **No seeing into other rooms (the M10 zone rule):**
  1. **Shared inner walls are always full height (16 m)** and no floor cell (terrace, jump pad apex) lets an eye rise above ~12 m, so nobody sees over a wall into a roofless neighbour.
  2. **Doors:** during combat both door leaves are closed. Between rooms use a **4 m-deep vestibule (airlock)** inside the shared wall band with a door on each side; only one side is open at a time (the one you're approaching), so an open doorway shows a closed door, never the other room. Alternative: a dogleg or U-turn vestibule (LDB) if doors must stay open; a straight open doorway between two arenas violates the rule.
  3. **Windows (arcade bays) only on outer edges:** a unit edge is "outer" iff no room occupies any cell straight out from it to the grid boundary in that row or column (Tomas's red lines). Edges facing an empty cell that has rooms beyond it (concave pockets) get solid wall, because a window there would look across the gap into the far room's windows.
  4. **Cloud cards and spires** are placed outside the layout's bounding box (or convex hull), so they never sit inside a concave pocket.
- **Roofs:** a roof is per room (none, partial over a terrace or colonnade, full). Flyer rooms want open sky. Partial roofs cast into the baked floor lightmap per template; bake the lightmap per template and rotation offline (or at load), not per generated map, to keep loading fast (engineering inference).
- **Loading and performance:** only the current room (plus the vestibule) simulates enemies, like L4D's Active Area Set; neighbours are geometry only. Closed vestibules hide any streaming of the next room.
- **Art consistency per heaven:** the heaven fixes the textures, sky, cloud cards, prop skins, hazard type and level feature; templates vary only layout. That matches the brief ("always golden, ivory, marble, nice views").

### Gaps
- The exact interior size of an Isaac room (often cited as 13×7 tiles) and the door positions in L-shaped rooms were not confirmed by a fetched source.
- Diablo's tile dungeons, Ziggurat or Immortal Redneck, and Deep Rock Galactic cave generation were not researched (tool budget).
- No source found for how 3D roguelites (Gunfire Reborn, Roboquest) hide loading between rooms; the airlock proposal rests on the LDB airlock method and the L4D active-area idea.

## 8. Backtracking: cleared rooms, low-level respawns, keeping it from being dull

### Takeaway
L4D's wanderer rule fits the brief's trickle spawns: a small count per area, created only when the area enters the active set and never where any player can see, zeroed while the Director is in Relax. Loops, shortcuts and fast travel (Gungeon's teleporters) keep backtracking short. Enemy-made hazards clear when a room is done.

### Cited Findings
- L4D wanderers: stored as a count N per nav area, randomized at map start from route length and desired density. When an area enters the AAS, N infected are created; when it leaves, they're deleted and N grows back. **N is zeroed when the area becomes visible to any survivor, and when the Director is in Relax mode** — [Booth 2009](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)
- Gungeon: teleporters allow fast return to rooms; chests sit behind one-way loops or deep in the level — [Boris the Brave, Gungeon](https://www.boristhebrave.com/2019/07/28/dungeon-generation-in-enter-the-gungeon/)
- Unexplored uses one-way valves to reduce backtracking; two parallel arcs allow more layouts than a tree — [Boris the Brave, Unexplored](https://www.boristhebrave.com/2021/04/10/dungeon-generation-in-unexplored/)
- One-way paths deny agency; open backtracking routes or loops instead — [Yoder](https://andrewyoderdesign.blog/2019/08/04/the-door-problem-of-combat-design/)
- Isaac: enemy creep vanishes when the room is cleared; big rooms can create loops — [Isaac wiki, Creep](https://bindingofisaacrebirth.wiki.gg/wiki/Creep); [Boris the Brave, Isaac](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Static placement gets memorized and "degenerates into a race" — [Booth 2009](https://steamcdn-a.akamaihd.net/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)

### Inferences
- **Cleared-room trickle (brief):** on entering a cleared room, spawn `min(cap, k × players)` fodder (proposal: cap 12, k = 3) from spawn points not visible to any player, after a 2–4 s delay. They're leashed to the room (can't path through vestibules), give normal XP and drop odds, and don't re-trigger while a player stays in the room. Each room also has a total trickle budget per floor (e.g. 3 refills), so farming has a ceiling. Doors never lock for trickle.
- Keep backtracking short: the shop, level-up room and treasure room are dead ends by the Isaac rule, so backtracking is mostly from dead ends to the hub. Use loops from big rooms (2×1, 2×2 with 6–8 sockets) and give the full-map item (brief) a "teleport to any cleared room" option, or put a vestibule teleporter in the lobby, like Gungeon (proposal).
- Cleared rooms keep their level hazards off and broken props broken; unbroken props remain (a reason to revisit with a key or buff).
- Performance: cleared rooms out of the active set hold no entities, only their counters (L4D AAS).

### Gaps
- No sourced examples of games with "leashed" low-level respawns in cleared rooms (the brief's own idea); L4D wanderers are the closest analogue.
- No data on how often players backtrack in Isaac-style floors, or on acceptable backtrack distances.
