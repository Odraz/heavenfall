# The Binding of Isaac's structure and its first-person / 3D adaptations (input for the Meatgrinder roguelite spec)

Scope: Isaac Rebirth / Afterbirth+ / Repentance floor generation, rooms, map, economy, items and replayability, plus what FPS and 3D roguelites that borrowed the structure learned. Every "Inference" line maps a mechanism to Meatgrinder (co-op FPS, 1–4 players with bots, hordes of 1 000+, 2.5D billboard renderer, "never see into another arena" zone rule, browser P2P host-authoritative).

Source-quality note: the most exact numbers come from the community wiki (bindingofisaacrebirth.wiki.gg), whose generation pseudo-code is reverse-engineered from the game, and from Boris the Brave's write-up, which describes the **original Flash Isaac** with a section on Rebirth/Afterbirth+ changes. Where they differ, both are listed. Several game pages (Giant Bomb, StrategyWiki, Twinfinite, Co-Optimus reviews) returned HTTP 403 and could only be used through search snippets.

## 1. Floor generation: the algorithm, room counts, big rooms, special-room placement, retries

### Takeaway
Isaac grows a loop-free tree of 1×1 cells breadth-first from a centre start cell (50% skip chance per neighbour, and a cell may not be added if it would touch more than one filled cell), rejects and regenerates the whole floor if the room count is wrong or the boss would touch the start, then hands out the dead ends, sorted farthest-first, to special rooms in a fixed priority order (boss, super secret, shop, treasure, ...), and finally places the secret room in the empty cell with the most room neighbours. Rebirth adds big rooms (2×1, 2×2, L, narrow) that may create loops.

### Cited Findings
**Grid and growth (original Flash Isaac, per Boris the Brave)**
- Floors are generated on a 9×8 grid; cells are numbered so the units digit is x and the tens digit is y, so neighbours are ±1 and ±10; cells with x = 0 are never used, so code needs no bounds checks; top-left is 01, bottom-right 79. — [Boris the Brave, Dungeon Generation in Binding of Isaac](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Room target (Flash): `random(2) + 5 + level * 2.6`, so levels start at 7 or 8 rooms and grow by 2 or 3 per level. — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Growth: start room at cell 35 on a queue; for each dequeued cell check the 4 cardinal neighbours and skip a neighbour if (a) it is occupied, (b) it already has more than one filled neighbour, (c) the room target is reached, or (d) a 50% coin flip says skip; otherwise place a room and enqueue it. A cell that adds no room is a dead end and goes on the end-rooms list. On maps with more than 16 rooms the start room is periodically re-enqueued to encourage growth. The two-neighbour rule keeps corridors apart, so the layout has no loops. — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Validation / retry: the floor plan must hit the exact room count and the boss room must not be adjacent to the start room; if either fails, the whole process restarts from scratch. — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Doors: adjacent rooms always connect through a door at the centre of the shared edge, and every (1×1) room can be entered from all four directions. — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)

**Room count (Rebirth / Repentance, per the wiki pseudo-code)**
- Standard floor: `NumberOfRooms = 3.33 × FloorDepth + 5..6`, max 20. XL (Curse of the Labyrinth) floor: `1.8 × (that)`, max 45. The Void: 50–59. Hard mode: +2 or +3. Curse of the Lost: +4. In the pseudo-code Lost is an `elseif` after Labyrinth, so they do not stack; the Void check in the pseudo-code appears inverted relative to the text. — [Isaac wiki, Level Generation](https://bindingofisaacrebirth.wiki.gg/wiki/Level_Generation)
- Minimum dead ends: base 5; +1 on every floor except the first; +1 on XL floors (text) or with Labyrinth (pseudo-code); +2 on The Void; +1 with Voodoo Head (Repentance) plus one more for its extra Curse Room. — [Isaac wiki, Level Generation](https://bindingofisaacrebirth.wiki.gg/wiki/Level_Generation)
- Dead ends are sorted by distance from the start, farthest first, and special rooms take them in that order; if dead ends run out, no more special rooms generate. Dequeuing a dead end resizes it, so most dead ends end up 1×1. — [Isaac wiki, Level Generation](https://bindingofisaacrebirth.wiki.gg/wiki/Level_Generation)

**Big rooms (Rebirth / Afterbirth+)**
- The generator checks all exits of a room (up to 8 on a 2×2) instead of only 4 cardinal directions. Large rooms are tried at random; the neighbour rule is applied only to the cell at the door, but the rest of the footprint must be empty. Large rooms can therefore create loops, and two large rooms can sit side by side. If a large room does not fit, another candidate is tried. After a large room is placed it is removed from the pool with 95% probability (so more than one per floor is rare). — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- The full DLC set has 11 large-room shapes: 2×2, 2×1, L-shaped and narrow corridors, in various rotations. — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Large boss rooms replace the single boss cell; the replacement must not touch any extra rooms; if it fails, all endpoints at maximum distance are tried before giving up. Some room layouts are only chosen when the floor plan shows that no doors are needed on a side. — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Room shapes the game uses: normal, double, quadruple, L-shaped triple, narrow hallways, tiny rooms ("closets" in Afterbirth+: small, rare dead ends with a unique arrangement). — [Isaac wiki, Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms)

**Special-room order and conditions (Rebirth → Repentance)** — all from [Isaac wiki, Level Generation](https://bindingofisaacrebirth.wiki.gg/wiki/Level_Generation) unless noted
1. Boss Room: guaranteed (two back-to-back on XL floors). Flash: the last item on the end-rooms list, so one of the farthest rooms ([Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)).
2. Super Secret Room: guaranteed. It is the second room type placed, so it takes the dead end with the second-most rooms to walk through (boss takes the most, shop the third-most); it connects to exactly one non-special room; likely near the boss or shop. — [Isaac wiki, Secret Room](https://bindingofisaacrebirth.wiki.gg/wiki/Secret_Room)
3. Shop: guaranteed in chapters 1–3 (later only with specific items).
4. Treasure Room: guaranteed in chapters 1–3; two on XL floors.
5. Planetarium (Repentance): 1% base in chapters 1–3, raised by skipping Treasure Rooms.
6. Dice or Sacrifice Room: 1/7 base; a second 1/4 roll gives 5/14 (~36%) if total health ≥ heart containers. A Sacrifice result becomes a Dice Room at 1/50 base (~22% with 2+ keys).
7. Library: 1/20.
8. Curse Room: 1/7 before Repentance, 1/4 in Repentance.
9. Mini-Boss Room: 1/4 (1/2 on the first floor via a second 1/3 roll).
10. Challenge Room: guaranteed if total health ≥ heart containers; not on floor 1; 50% on floor 2, where it is a Boss Challenge Room.
11. Arcade / Vault: guaranteed with 5+ coins on the second floor of a chapter; becomes a Vault at 1/10 (40% with 2+ keys).
12. Bedroom (Clean/Dirty): 1/50 base (~22% at low health); chapters 1–3 only.
13. Secret Room: guaranteed (extra with Fragmented Card / Luna).
14. Ultra Secret Room (Repentance): guaranteed.
- Sacrifice Room, Flash-era framing: ~1 in 7, or ~1 in 3 at full health. — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Devil/Angel rooms are not part of the floor plan; their door appears in the Boss Room after the boss dies. — [Isaac wiki, Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms); [Isaac wiki, Devil Room](https://bindingofisaacrebirth.wiki.gg/wiki/Devil_Room)

**Secret Room placement**
- Flash: random search for an empty cell touching at least 3 rooms and no end rooms; after 300 failed attempts the criteria loosen, after 600 they loosen further, so it always succeeds; secret rooms tend to sit at intersections. — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Rebirth+: each candidate cell gets weight 10–14, −3 if it has only 2 neighbours, −6 if only 1; the highest weight wins; never next to the Boss Room, the Super Secret Room, another Secret Room (or the start room on The Chest / Dark Room). — [Isaac wiki, Level Generation](https://bindingofisaacrebirth.wiki.gg/wiki/Level_Generation)
- Result: usually adjacent to 3 or 4 rooms (equally likely), very rarely 1. Entrances are never blocked by rocks/gaps; adjacent rooms always have a clear walkable path to the middle of that wall; entrances are never in front of obstacles, spikes or enemy spawn spots. — [Isaac wiki, Secret Room](https://bindingofisaacrebirth.wiki.gg/wiki/Secret_Room)

**Curse of the Labyrinth (XL)**
- Normal rooms +80% (cap 45); special rooms placed only in the 6 farthest end rooms; rooms drawn from easy, medium and hard pools; extra normal rooms added with secret-room-like logic; special rooms duplicated; two boss rooms can be adjacent. — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)

### Inferences
- Room count per Repentance formula (assuming the result is floored): depth 1 → 8–9, depth 2 → 11–12, depth 3 → 14–15, depth 4 → 18–19, depth 5+ → 20 (cap). The brief's suggested `min(20, rand(0..1) + 5 + floor(stage×10/3))` gives 8–9, 11–12, 15–16, 18–19, 21→20, i.e. the same curve within ±1. For Meatgrinder, each Isaac "room" is a full horde arena (minutes, not seconds), so the count should be far lower: a curve like `min(12, 5 + stage + rand(0..1))` with a cap is a better fit than Isaac's 20 (a run would otherwise take hours). The spec must state the number explicitly.
- Use the Flash algorithm almost verbatim: a small grid (9×8 is plenty for ≤ 15 cells), start cell in the centre, BFS with the 50% skip, the "≤ 1 filled neighbour" rule, a hard target count, and full regeneration on failure (with a seeded RNG so "regenerate" is deterministic for P2P: the host sends only the seed, every client builds the same floor). The no-loop tree is a feature for Meatgrinder: one route in/out of every branch keeps backtracking short and the "only the outer faces may have windows" rule easy to compute (outer faces = cell edges with no neighbour).
- The brief's room rules map directly: Boss = farthest dead end and never adjacent to the start (Isaac's retry rule) and single entry (dead end ⇒ exactly one door); treasure = a dead end, locked, "not close to the lobby" (add a minimum BFS distance, e.g. ≥ 3, and retry if impossible); leveling-up room "close to the boss" is a new rule Isaac lacks: pick the dead end or corridor cell with the smallest path distance to the boss excluding the boss's own neighbour if the boss must stay single-entry. The minimum dead-end count must equal the number of dead-end special rooms (Isaac: base 5), and the generator must retry until it has them.
- Big rooms (2×1, 2×2, L) as the brief's "horde rooms": place them as Isaac does (random attempt, door-cell-only neighbour check, rest of footprint empty, 95% removal from the pool after use so a floor gets ~1). The creature shapes in reference images 2–3 are effectively a rarity-tagged big-room shape pool.
- Isaac's door-at-centre-of-shared-edge rule is ideal for the zone rule: every connection is a single doorway in a known spot, so a door can be a closed portal (opaque door or a short dog-leg vestibule) that guarantees no line of sight between arenas.

### Gaps
- The Rebirth/Repentance grid size was not confirmed by any fetched source. Modding docs are commonly said to use a 13-wide grid (13×13, start index 84), but no source in this session confirmed it; StrategyWiki's Repentance "Level generation" page returned 403.
- The exact Repentance growth loop (whether the 50% skip and neighbour rule are unchanged) is not given on the wiki page; Boris's Rebirth notes are from the Afterbirth+ era and say nothing about Repentance.
- Red Rooms (Repentance) need 4 connections and spawn within 6 rooms of the centre ([Isaac wiki, Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms)); the full placement code was not found.

## 2. Rooms: authoring, weights, difficulty tiers, door locking, door art

### Takeaway
Every Isaac room is a hand-authored layout (obstacles + enemy spawns) stored per floor in STB room files, with a weight (spawn frequency) and a difficulty value; the generator picks layouts whose shape and door sides fit the cell, from a difficulty band that rises within a chapter. Doors close on entry and open when all enemies die; special rooms are announced from outside by distinct door art, and some doors cost a key, coins, bombs or health.

### Cited Findings
- Rooms come from pools labelled easy, medium, hard; stage 1 of a chapter draws from easy+medium, stage 2 from medium+hard. The Basement alone has 174 normal rooms; alternative chapters use a somewhat different set. — [Boris the Brave](https://www.boristhebrave.com/2020/09/12/dungeon-generation-in-binding-of-isaac/)
- Rebirth+ difficulty bands: normal floor 1 → difficulty 1–5, floor 2 → 5–10; hard floor 1 (Repentance) 1–10 (1 and 10 rarer); hard floor 2 (Repentance) 5–15; Chapters 5–6 count as floor 2 in Repentance; The Void 5–10 (+20 in Repentance). — [Isaac wiki, Level Generation](https://bindingofisaacrebirth.wiki.gg/wiki/Level_Generation)
- Room files are .stb files per floor, editable with the community tool Basement Renovator; each room has size/shape, type, weight ("how often it is spawned") and difficulty ("used to control floor difficulty"). — [Basement Renovator on GitHub](https://github.com/Basement-Renovator/basement-renovator)
- Special rooms also have weighted layout variants, e.g. Secret Room layout ID 0 (weight 1): 1 Shopkeeper, 2 Fire Places, 1 item; ID 37 (Repentance, weight 0.5); fractional weights such as 0.1 / 0.5 appear for rarer layouts. — [Isaac wiki, Secret Room](https://bindingofisaacrebirth.wiki.gg/wiki/Secret_Room)
- Doors: "Isaac cannot leave a Room with enemies until they are all killed or until a door is opened with an explosion." Mini-boss rooms are barred and cannot be exploded open. Anti-softlock: doors may auto-open if remaining enemies are unreachable (not with a boss or mini-boss present). Challenge rooms: three waves after taking the contents; Boss Challenge: two waves of bosses. — [Isaac wiki, Doors](https://bindingofisaacrebirth.wiki.gg/wiki/Doors)
- Door art / cost per room type: Boss = boss door; Treasure = treasure door, locked (1 key) from Basement 2 on; Shop = needs a key (Repentance: floor-1 shop free); Arcade = 1 coin; Library = key; Vault and Dice = 2 keys; Bedroom = double-boarded, 2 bombs; Curse = spiked door that damages on entry and exit; Sacrifice = bloody door (Repentance); Challenge = barred (enter only at full health); Secret / Super Secret = hidden, must be bombed; Mini-boss = looks like a normal door. — [Isaac wiki, Doors](https://bindingofisaacrebirth.wiki.gg/wiki/Doors); [Isaac wiki, Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms)
- Boss room contents: boss, then a boss-pool item, hearts and a trapdoor to the next floor. Treasure Room: one treasure-pool item (small chance of two, very small of none). — [Isaac wiki, Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms)
- McMillen's design principle for room variation: roughly "ten percent of the time" an enemy is a bit bigger and tougher but gives a bit more reward. — [Game Developer, Raw Meat: Game Design Tips from Edmund McMillen](https://gamedeveloper.com/design/raw-meat-game-design-tips-from-team-meat-s-edmund-mcmillen)
- Enter the Gungeon's developers concluded hand-designed rooms made the game "more fun and more fair", playing each room over and over before arranging floors by rules; the first stage alone has nearly 300 rooms and a room is never reused within a level. — [Game Developer Q&A, via search snippet](https://gamedeveloper.com/design/q-a-the-guns-and-dungeons-of-i-enter-the-gungeon-i-); [Boris the Brave, Dungeon Generation in Enter the Gungeon](https://www.boristhebrave.com/2019/07/28/dungeon-generation-in-enter-the-gungeon)

### Inferences
- Meatgrinder rooms should be authored data, not generated geometry: each layout = shape (which grid cells), door sockets (which edges may have doors; unused sockets become solid wall), obstacles/cover, spawn points, a "fight focus" tag (horde / projectile / flyer / ground / elite / hazard, per the brief), a weight and a difficulty 1–10. Pick by (shape fits cell, door sides match, heaven matches, difficulty in band). Isaac's two-band scheme (floor 1 easy+medium, floor 2 medium+hard) maps to "first half of a heaven's floors vs second half".
- Pool size target: Isaac has 174 normal layouts for one floor theme and Gungeon ~300 per stage; those rooms last ~20–60 s. Meatgrinder rooms last minutes and are far costlier to author (3D, lightmaps), so even 8–12 combat layouts per heaven per shape class, never repeated within a floor, gives meaningful variety; the spec should set a floor such as "no layout twice per floor".
- Door art is the cheapest "recognisable before entry" signal and works in first person: a distinct door frame/colour/icon per room type (boss door, locked treasure door with keyhole, merchant door). The boss door is the brief's "recognisable before entry".
- Keep Isaac's door lock: doors close when the wave starts and open when the room's wave budget is dead; add Isaac's anti-softlock (auto-open if the remaining enemies are unreachable / stuck for N seconds) because a 1 000-enemy horde will produce stragglers stuck on geometry.
- "Cleared rooms stay cleared; a few basic enemies respawn on backtrack and cannot leave" (brief) has no Isaac equivalent (Isaac cleared rooms stay empty); it must be a new explicit rule.

### Gaps
- Total number of room layouts in Repentance was not found in a citable source.
- The exact per-room enemy-placement format (entity IDs, spawn grid) and Isaac's interior room size (commonly 13×7 tiles for a 1×1) were not confirmed by a fetched source.

## 3. Minimap and knowledge: what the map shows, mapping items, curses

### Takeaway
The Isaac map reveals rooms as you visit them and shows neighbours you have seen through doors; three items split full knowledge into layout (Treasure Map), special-room icons (Compass) and secrets (Blue Map), which together equal The Mind. Curses toggle knowledge per floor (Lost removes the map, Darkness limits vision, Labyrinth doubles the floor).

### Cited Findings
- The Compass reveals location and type of all special rooms except Secret and Super Secret (Arcade, Boss Challenge, Boss, Challenge, Bedrooms, Curse, Dice, Library, Mini-Boss, Planetarium, Sacrifice, Shop, Treasure, Vault). — [Isaac wiki, The Compass](https://bindingofisaacrebirth.wiki.gg/wiki/The_Compass)
- Treasure Map shows the layout of each floor but does not identify special rooms or reveal Secret/Super Secret Rooms; the boss room can usually be found as the room farthest from the start. — [Isaac wiki, Treasure Map](https://bindingofisaacrebirth.wiki.gg/wiki/Treasure_Map)
- Blue Map: "Reveals the locations of Secret Rooms and Super Secret Rooms on the map" (not Ultra Secret in Repentance). Compass + Treasure Map + Blue Map = whole floor, identical to The Mind. — [Isaac wiki, Blue Map](https://bindingofisaacrebirth.wiki.gg/wiki/Blue_Map)
- Other reveals of secret rooms: Book of Secrets, Crystal Ball, The Mind, Spelunker Hat, XIX The Sun, XXI The World; X-Ray Vision opens all entrances; Dog Tooth howls near them; YO LISTEN! hovers over them. — [Isaac wiki, Secret Room](https://bindingofisaacrebirth.wiki.gg/wiki/Secret_Room)
- Mini-boss rooms show their icon only on entry or with The Compass. — [Isaac wiki, Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms)
- Curses (one floor each): Darkness (lit only by Isaac's aura), Labyrinth (XL floor, two bosses and two treasure rooms; first floor of a chapter only), Lost (removes the map, +4 rooms; mapping items do not counteract it), Unknown (hides health), Maze (rooms can swap), Blind (items show as "?"). Chance of a cursed floor grows with progress: Normal 1/80 on a new save → 1/30 after Mom → 1/10 → 1/5 after Isaac; Hard 1/10 → 1/5 → 1/3; each of the 6 curses then has 1/6. — [Isaac wiki, Curses](https://bindingofisaacrebirth.wiki.gg/wiki/Curses)
- Immortal Redneck (FPS): a minimap reveals the layout one room at a time as it is explored, with icons for treasure, skill scrolls and the stairs to the next floor. — [search snippet of reviews, e.g. Nintendo Life](https://www.nintendolife.com/reviews/switch-eshop/immortal_redneck)
- Ziggurat (FPS): challenge rooms are marked by a red spike-platform icon and danger rooms by a yellow spike-plate icon on the map. — [search snippet, cheatcc guide](https://www.cheatcc.com/?p=81955)
- Paranautical Activity (FPS): special rooms have distinctive coloured doors and are marked on the map when found. — [search snippet, Giant Bomb wiki](https://giantbomb.com/wiki/Games/Paranautical_Activity)

### Inferences
- The brief's map rules equal Isaac's default map: three states per cell, "unknown" (not drawn), "discovered" (seen through a door of a visited room: outline, plus its type icon only if its door art is visible, which matches Isaac where adjacent special rooms are identifiable), and "cleared". The brief's single "map item reveals the whole map" collapses Treasure Map + Compass into one item; keep the split as a later option (a cheaper "layout only" and a pricier "icons" version are two shop goods instead of one).
- In first person the map is the only way to understand the floor; it should be a toggled full-screen overlay plus a small corner minimap (Immortal Redneck and Ziggurat both use icons on a revealed-as-you-go minimap). Menu-stability rule: the overlay should be a separate view, not a panel that resizes the HUD.
- Secret rooms: Isaac's "bomb the middle of a wall" works because walls are short and the door spot is fixed; in an FPS this maps to a cracked/marked wall section at the door socket of an empty cell that touches ≥ 3 rooms, opened by an explosive barrel/ability. This is optional scope; Meatgrinder's brief does not ask for secrets.
- Curses are a cheap per-floor variety lever (Darkness = lower fog distance, Lost = no map) that need no new content; flag as later scope.

### Gaps
- The wiki's Minimap page returned 404; the exact default rule for which adjacent rooms are drawn and when their icons show is from common knowledge, not a fetched source.

## 4. Economy: coins, keys, bombs, shop prices, devil/angel deals, donation machines

### Takeaway
Isaac runs three small currencies off one random table: each normal room clear rolls 22% nothing / 15% coin / 15% heart / 20% key / 15% bomb / 8% card-pill-trinket / 5% chest; keys open locked rooms and chests, bombs open secrets, coins buy 15-cent items and 3–5-cent consumables. Devil deals are the risk channel: items cost 1–2 heart containers, the door shows after the boss with a small base chance raised by taking no damage.

### Cited Findings
- Room-clear reward roll (luck 0): <0.22 nothing (22%); 0.22–0.30 tarot card, pill or trinket (8%, ~2.66% each); 0.30–0.45 coin (15%); 0.45–0.60 heart (15%); 0.60–0.80 key (20%); 0.80–0.95 bomb (15%); >0.95 chest (5%). Luck (0–10) adds `RandomFloat() × luck × 0.1` to the roll, shifting results toward chests. Hard mode turns hearts into nothing 66% of the time (33% in Repentance per wiki). — [Isaac wiki, Room Clear Awards](https://bindingofisaacrebirth.wiki.gg/wiki/Room_Clear_Awards)
- Shop prices: red heart 3¢; soul heart, bomb, key, battery, pill, card 5¢ each; grab bag 7¢ (Repentance+); items 15¢ (some actives 10¢ in Repentance); sale tag halves any price. — [Isaac wiki, Shop](https://bindingofisaacrebirth.wiki.gg/wiki/Shop)
- Shop size grows with cumulative donations to the Donation Machine: level 0 (0¢) 0–1 pickups + 1–2 items; level 1 (20¢) 1–2 pickups; level 2 (100¢) 2–3; level 3 (200¢) 3–4; level 4 (600¢) 4–5 pickups, each with 1–2 items. Restock machines (Repentance) refill bought goods, each restock raising the price up to 99¢. — [Isaac wiki, Shop](https://bindingofisaacrebirth.wiki.gg/wiki/Shop)
- Shops need a key (except floor 1 in Repentance); Treasure Rooms need a key from Basement 2 on; Arcade costs 1 coin; Vault/Dice 2 keys; Bedroom 2 bombs. — [Isaac wiki, Shop](https://bindingofisaacrebirth.wiki.gg/wiki/Shop); [Isaac wiki, Doors](https://bindingofisaacrebirth.wiki.gg/wiki/Doors)
- Arcade spawns on even floors only if the previous floor was finished with 5+ coins (a reward for saving). — [Isaac wiki, Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms)
- Devil/Angel door after the boss: base 1%; eligible from chapter 1 floor 2 to chapter 4. Big modifiers: no red-heart damage vs the boss +35%; no red-heart damage all floor +99%; blew up a beggar +35%; Pentagram +10%; Black Candle +15%. Multiplier ×0.5 if a devil door was seen two floors ago, ×0.25 if less. Only red-heart damage lowers the chance. — [Isaac wiki, Devil Room](https://bindingofisaacrebirth.wiki.gg/wiki/Devil_Room)
- Devil prices: 1 or 2 red heart containers, roughly by item power; 3 soul hearts if no red containers. Taking any deal removes Angel Room chances for the rest of the run; in Repentance, skipping the first devil offer guarantees the next offer is an Angel Room. — [Isaac wiki, Devil Room](https://bindingofisaacrebirth.wiki.gg/wiki/Devil_Room)
- Sacrifice Room: payment is self-damage on central spikes for a chance of a reward; Curse Room door damages on entry and exit. — [Isaac wiki, Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms)
- Original-game framing: keys, bombs, coins and hearts are randomly distributed and not required for progression, though they add structure. — [Game Developer, Postmortem: McMillen and Himsl's The Binding of Isaac](https://gamedeveloper.com/business/postmortem-mcmillen-and-himsl-s-i-the-binding-of-isaac-i-)
- Isaac co-op: "All players share resources (coins, bombs, and keys), but each have their own hearts and items." — [Isaac wiki, Co-op](https://bindingofisaacrebirth.wiki.gg/wiki/Co-op)
- Ziggurat 2: coins buy weapons, perks or health in the shop; deeper floors pay more coins; shrines trade a sacrifice for stats or a weapon with a chance of punishment; optional challenge rooms pay better rewards. — [Milkstone, Road to Ziggurat 2 – Dungeons](https://www.milkstonestudios.com/?p=4429)

### Inferences
- Expected yield per Isaac floor (computed from the table, no luck, ~10 normal rooms): ~1.5 coin drops, ~2 keys, ~1.5 bombs, ~1.5 hearts, ~0.5 chests, ~0.8 consumables, plus floor pickups. So keys are deliberately scarce (about 2 per floor against 1–2 locked doors and chests): every key is a decision.
- Meatgrinder mapping: halos = coins (shared party pool, as Isaac co-op shares coins/keys/bombs); the treasure key = Isaac's key, but there is one per floor and it is held by one player (brief) rather than pooled. A deterministic per-room clear reward roll (one table, rolled once per cleared room by the host, a few % "chest") is the cheapest way to add the brief's "frequent small pickups" channel on top of per-enemy halo drops. With 1 000 enemies per room, per-enemy drop chances must be tiny (or capped per room) so the room total stays in the Isaac-like range of a few pickups.
- Price anchors: Isaac's ratio is consumable 5 : item 15, i.e. an item costs ~3 consumables and ~1 floor's worth of coins. Use the same ratio for merchant consumables vs a relic-grade purchase.
- Risk channel: the Devil deal (pay max HP for power; door odds rise if the party took no damage) is the template for the brief's risk/reward events; in co-op it should be per player (Isaac co-op keeps hearts per player).
- The 5-coin arcade rule and the donation machine are good "reasons to save currency across floors" if the halo pool persists.

### Gaps
- No source gave the average number of coins actually collected per floor (enemy drops, pennies vs nickels vs dimes, floor pickups).
- Bomb uses beyond secret rooms (tinted rocks, bomb chests) were not covered by a fetched page.

## 5. Items: active vs passive, pools, quality, synergies, consumables, unlocks

### Takeaway
Isaac's item system is a weighted-pool lottery: each room type has its own pool, items seen are removed from pools for the run, and almost every item visibly changes Isaac or his tears and stacks with others. Synergy and "broken runs" are a deliberate consequence of ~70% of items stacking; testing could not cover the combinations, and the game embraced it. Unlocks grow the pool over hundreds of runs (637 achievements, 700+ items, 34 characters in Repentance).

### Cited Findings
- Pools: Treasure (largest; default for unlisted rooms), Shop, Boss (passives only), Secret ("game-breaking potential"), Devil (demonic items), Angel (defensive holy items), Library (books, active), Curse, Golden Chest, Red Chest, Beggar (food/drug/coin items, no quality 3–4), plus Repentance pools (Planetarium, Ultra Secret, Crane Game, ...). — [Isaac wiki, Item Pool](https://bindingofisaacrebirth.wiki.gg/wiki/Item_Pool)
- Weights: nearly every item has weight 1; Repentance set many to 0.1–0.5 in specific pools. Seeing an item lowers its weight in that pool: 50% for beggars/curse/shop (pre-Repentance), 40% for chests, 10% for Library; fully removed on sight for Treasure, Devil, Angel, Boss, Secret (and Shop in Repentance). Touching an item removes it from all pools. Exhausted pool → fall back to the Treasure pool → if that is empty, only "Breakfast". — [Isaac wiki, Item Pool](https://bindingofisaacrebirth.wiki.gg/wiki/Item_Pool)
- Quality: a hidden 0–4 value on every item (Repentance), defined in `items_metadata.xml`; used by e.g. Sacred Orb (rerolls Q0 and Q1, 33% chance to reroll Q2), Tainted Lost (20% reroll of Q ≤ 2), NO! (rerolls Q0). — [Isaac wiki, Item Quality](https://bindingofisaacrebirth.wiki.gg/wiki/Item_Quality)
- Boss item per player in co-op: "When a boss dies, the item pedestal spawns one item per player"; all player damage to bosses −20% in co-op. — [Isaac wiki, Co-op](https://bindingofisaacrebirth.wiki.gg/wiki/Co-op)
- Original design: launched with 100 items and 5 characters; ~70% of items stack and every item affects Isaac in some way; items were designed so the character shows "physical growth"; Zelda-style mystery where players "weren't sure what things did until you experimented". Testing could not cover the combinations of stacking items, so day-one buyers did much of the testing. — [Game Developer, Postmortem](https://gamedeveloper.com/business/postmortem-mcmillen-and-himsl-s-i-the-binding-of-isaac-i-)
- Each floor contains at least one item and each boss grants one stat-raising item (original). — [Game Developer, Postmortem](https://gamedeveloper.com/business/postmortem-mcmillen-and-himsl-s-i-the-binding-of-isaac-i-)
- Scale today: Repentance added 234 achievements for 637 total (641 with Repentance+); 34 playable characters (each with a Tainted version); 700+ items (one fan count: 721 collectibles and 188 trinkets). — [Isaac wiki, Repentance](https://bindingofisaacrebirth.wiki.gg/wiki/Repentance); [search snippet, Tainted Characters](https://bindingofisaacrebirth.wiki.gg/wiki/Tainted_Characters); item count figures from search snippets of store listing / fan site, approximate.
- A retrospective credits Isaac's longevity mainly to "gamebreaking synergies" between its mountain of items. — search snippet whose exact article could not be confirmed; nearest candidates [Kill Screen, The Binding of Isaac: A Postmortem](https://www.killscreen.com/binding-issac-postmortem/) or [Vice, 10 years after release](https://vice.com/en/article/10-years-after-release-edmund-mcmillen-cant-stop-working-on-binding-of-isaac)
- Consumables: tarot cards, pills and trinkets share an 8% slice of the room-clear roll; Secret Rooms can hold pickups/shopkeepers; Library holds books, cards, runes, trinkets. — [Isaac wiki, Room Clear Awards](https://bindingofisaacrebirth.wiki.gg/wiki/Room_Clear_Awards); [Isaac wiki, Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms)
- Hades shows the reward of each next chamber on its door (god emblem for a boon, Centaur Heart, Pom of Power, Charon's Obol, Daedalus Hammer), and gold vs blue laurels distinguish run-only from persistent rewards. — [Inverse, Hades symbol guide](https://www.inverse.com/gaming/hades-symbol-meaning-guide-hera-dionysus-apollo-ares-aphrodite)

### Inferences
- Pools per room type with remove-on-sight is the single most portable rule: a treasure pool of relics, a merchant pool of consumables, a boss pool; never show the same relic twice in a run; fallback item when empty. It costs nothing at runtime and makes runs differ.
- Isaac's synergy philosophy is "every pickup is visible and stacks", which matches Meatgrinder's "one visible effect per ability" rule: relics should each change one visible thing about the gun/ability (projectile count, size, element, trail, on-kill effect), so two equipped relics combine by construction. Avoid stat-only relics (Isaac's least memorable items are pure stat ups; this is an inference, not a cited claim).
- Two relic slots (brief) is far below Isaac's unbounded stacking; synergy density then depends on relics being designed in pairs/families. Quality tiers (Q0–Q4 hidden) map onto the brief's rarity letters (C/UC/R/E/L) and can weight pools per floor depth.
- "One item per player" on boss kill (Isaac co-op) is the cleanest co-op loot rule and avoids loot fights; the brief's account-bound treasure relic should likewise be per player.
- Hades-style door previews could show the room's fight focus (horde/flyers/hazard) on the door art, giving a route choice in a tree map without a new system.

### Gaps
- No primary McMillen statement on how synergies are deliberately designed (vs emergent) was found; the 2011 postmortem implies emergent.
- Number of items per quality tier and active-vs-passive counts not found.

## 6. Replayability drivers and run length

### Takeaway
McMillen made replayability Isaac's single "core" and cut everything else around it; drivers are random floors and items, harder content unlocked by progress instead of difficulty settings, unlocks per character, and a run short enough to retry (the Boss Rush deadline of 20 minutes to Mom shows the intended pace of a fast run).

### Cited Findings
- McMillen: the core of Isaac was "replayability"; chip everything else away until it is prominent; goal of a unique experience every time; he wanted the game to surprise even him. — [Game Developer, Raw Meat](https://gamedeveloper.com/design/raw-meat-game-design-tips-from-team-meat-s-edmund-mcmillen)
- Instead of difficulty settings, Isaac adds harder content as the player progresses and rewards skilled play with more items; beating Mom unlocks a new chapter, beating that unlocks characters and items, and finishing it with each character unlocks more; players felt the game was "writing itself as they played". Development: a week-long game jam, then about three months part-time. — [Game Developer, Postmortem](https://gamedeveloper.com/business/postmortem-mcmillen-and-himsl-s-i-the-binding-of-isaac-i-)
- Chapter structure: Chapter 1 (Basement / Cellar / Burning Basement), 2 (Caves / Catacombs / Flooded Caves), 3 (Depths / Necropolis / Dank Depths), 4 (Womb / Utero / Scarred Womb), each with an alternate path (Downpour/Dross, Mines/Ashpit, Mausoleum/Gehenna, Corpse) in Repentance; then Cathedral/Sheol, Chest/Dark Room, Void/Home. Each chapter has environments (stage types) that keep a similar feel with slightly different themes, enemies, bosses and difficulty. — [Isaac wiki, Chapters](https://bindingofisaacrebirth.wiki.gg/wiki/Chapters)
- Pace targets built into rules: Boss Rush opens if Mom is killed within 20 minutes (25 for Mausoleum Mom); the ??? / Hush entrance opens if Mom's Heart / It Lives is beaten within 30 minutes. — [Isaac wiki, Rooms](https://bindingofisaacrebirth.wiki.gg/wiki/Rooms)
- Curse frequency rises with unlock progress (1/80 → 1/5 on Normal), so the game gets stranger as the player gets better. — [Isaac wiki, Curses](https://bindingofisaacrebirth.wiki.gg/wiki/Curses)
- Immortal Redneck counter-example: a reviewer argued the first floor is essentially identical to the next six, with the same enemies, room layouts and items throughout; another said redoing floor 1 gets repetitive, eased by procedural structure and unlockable medallions. — [Cubed3 review](https://cubed3.com/review/4039/1/immortal-redneck-pc.html); [Push Square review](https://www.pushsquare.com/reviews/ps4/immortal_redneck) (via search snippets)

### Inferences
- Meatgrinder already has the "chapter with stage-type variants" idea: each heaven = a chapter with fixed art and enemy roster (brief: Pearly Gates always gold/ivory/marble). Isaac's stage types suggest a cheap variant per heaven later (same tileset, swapped lighting/hazard).
- Immortal Redneck's complaint is the warning: if every floor of a heaven uses the same room pool and enemies, floors blur. Per-floor room pools or difficulty bands (Isaac's easy/medium vs medium/hard) and a new enemy per heaven (already in heavens.md) are the mitigations.
- Run length: Isaac's fast run to Mom (~8 floors) is ≤ 20 minutes for a good player; a typical first-clear is longer (no citable number found). For Meatgrinder, decide a target run length first and derive rooms per floor from it (e.g. 30–45 min run ⇒ rooms × average room time).
- Unlock-gated content (new relics unlocked by achievements entering the pool) is Isaac's long-tail driver and fits the brief's account-bound relics.

### Gaps
- No citable average run length (e.g. "30–45 minutes to Mom") was found; only the 20/30-minute timed-door thresholds.
- No primary source on seeded runs/challenges as replay drivers was fetched (they exist in-game; not verified here).

## 7. First-person / 3D adaptations: room sizes, transitions, minimaps, sightlines, backtracking, co-op

### Takeaway
FPS adaptations keep Isaac's "hand-made rooms, random arrangement, doors lock until clear" and add corridors or tunnels between rooms; their lessons are about room size (too small = AoE death traps, too big = empty and slow), verticality, a revealed-as-you-go minimap with icons, and repetition. In co-op, the most-copied rules are: shared currency, per-player items/health, ghost/downed players revived at the boss, and party-wide transitions (ready-up portals); the door problem (what if one player is outside when the room locks) has no standard answer and is a known soft-lock source.

### Cited Findings
**Ziggurat 1 and 2 (Milkstone)**
- Ziggurat 1: rooms laid out randomly across a level with small corridors connecting them; on entry, monsters spawn in waves and doors lock until all are dead. — [Giant Bomb (search snippet)](https://www.giantbomb.com/games/3030-47308/)
- Ziggurat 2 dev diary: in Z1 small rooms felt cramped and became death traps when AoE enemies spawned; large rooms felt too open, wasted space and slowed the pace. Z2 gave small rooms more space, shrank big rooms and added layouts; added ledge grabbing, jump pads (usable by enemies) and doors at different height levels (generator redesigned for this). Trap rooms are smaller and quicker to cross. Each floor requires finding its key and killing the floor guardian to advance. Shrine rooms now have one shrine instead of three. — [Milkstone, Road to Ziggurat 2 – Dungeons](https://www.milkstonestudios.com/?p=4429)
- Reviewers say Z2's rooms are more compact to keep the action "in your face" despite more verticality. — [Xbox Tavern review (search snippet)](https://www.xboxtavern.com/ziggurat-ii-review/)

**Paranautical Activity (Code Avarice, 2014)**
- Floors are a descending series, each made of separate rooms on a grid, procedurally generated from preset room layouts; special rooms have distinctive coloured doors and are marked on the map when found; on first entry the player is locked in, enemies appear, doors open when all are dead. Described as Doom/Quake action plus Isaac/Spelunky randomness. — [Giant Bomb wiki (search snippet)](https://giantbomb.com/wiki/Games/Paranautical_Activity)

**Immortal Redneck (Crema)**
- Developer devlog: procedural layouts but individually designed rooms; ordinary combat rooms are ~85–90% of the map; skill rooms (optional, hard, good reward: no-damage, time trial, survive until chest unlocks), bullseye aim rooms, rare gift rooms (blue), floor-connection rooms, a mid-boss and final boss per pyramid. — [Immortal Redneck devlog on itch.io](https://itch.io/post/4173)
- Pyramid shape: bottom floor largest but easiest; minimap reveals one room at a time with icons for treasure, scrolls and stairs. — [Cubed3 review (search snippet)](https://cubed3.com/review/4039/1/immortal-redneck-pc.html); [Nintendo Life review (search snippet)](https://www.nintendolife.com/reviews/switch-eshop/immortal_redneck)

**Gunfire Reborn (Duoyi, 4-player co-op)**
- Early access: rooms of set shapes placed randomly each run, a boss every 5 stages; each level ends when everything is killed, opening a portal to the next level; every cleared stage gives a chest with an upgrade; vendors in alcoves upgrade weapons; NPCs before the boss room. — [search snippets: Buried Treasure](https://buried-treasure.org/2020/06/gunfire-reborn/), [AnandTech forum](https://forums.anandtech.com/threads/gunfire-reborn-fps-rogue-like-early-access.2583548/latest)
- Team mode uses a ready-up before entering the next stage (Sept 2020 patch added cancelling "ready"); a downed teammate is revived automatically when the team enters the next stage after a boss. — [Gunfire Reborn patch notes 9-25-2020 (devtrackers)](https://devtrackers.gg/gunfire-reborn/p/139b64a3-update-notes-9-25-2020); [Steam discussion](https://steamcommunity.com/app/1217060/discussions/0/5446521858555522030)

**Roboquest (RyseUp, 2-player co-op)**
- A combat stretch, then a safe room where the player chooses a route, then a combat stretch and the end door; survival rooms hold the door until a bar depletes. — [Roboquest wiki, Levels](https://roboquest.wiki.gg/wiki/Levels)

**Enter the Gungeon (top-down, but the best-documented hand-room generator)**
- Each stage has a few authored "flow" graphs (Hollow 4, Gungeon Proper 8), each built around a feature (a big loop, a multi-way fork, passing through the shop); node types normal/hub/reward/shop/boss/entrance/connector; secret rooms at dead ends (1/5 chance to attach anywhere, 90% chance to appear); rooms placed by aligning predefined exits, up to 3 backtracking retries; corridors 4–30 units (50 in the Mines). Boss room kept a reasonable distance from start; enemy rooms spaced with breather/shop/hub rooms; most chests at the end of one-way loops. — [Boris the Brave, Dungeon Generation in Enter the Gungeon](https://www.boristhebrave.com/2019/07/28/dungeon-generation-in-enter-the-gungeon)
- Co-op: separate health; a dead player becomes a ghost who cannot collect, fight or buy; revived by a Revival Chest, by defeating any boss, or a Friendship Cookie, all to full health; "Doors may only be opened if both players press against the door simultaneously". — [Enter the Gungeon wiki, Co-op](https://enterthegungeon.wiki.gg/wiki/Co-op)

**Isaac co-op**
- Up to 4 (Afterbirth local; Repentance+ online). Shared coins, bombs, keys; own hearts and items; one boss item per player; boss damage −20%; dead players become ghosts and are reborn after the floor's boss with half a heart; game over when all die. — [Isaac wiki, Co-op](https://bindingofisaacrebirth.wiki.gg/wiki/Co-op)

**Dead Cells (hybrid hand-made tiles + procedural)**
- Fixed hand-designed frame (world map, level links, key locations) per seed; hand-made tiles with a specific purpose (treasure, merchant, combat), each belonging to one biome; per-biome concept graph (entrance and exit first, then special rooms, then combat/exploration tiles; controls length, special-tile count, labyrinth share, tiles between entrance and nearest exit); random tile per node, retried until it fits the node's entrance constraints. Monster budget: e.g. 250 combat tiles at 1 monster per 5 tiles = 50 monsters; dangerous monsters count as 10 tiles. Pacing built around "dramatic peaks and relaxing breaks" (AI Director-inspired). — [Sébastien Bénard, The Level Design of Dead Cells](https://deepnight.net/tutorial/the-level-design-of-dead-cells-a-hybrid-approach/)

**Deep Rock Galactic and Warframe (3D stitching)**
- DRG: a seed defines the cave; caves are "pearls on a string": hand-crafted rooms joined by generated narrow winding tunnels; deeper networks are harder. — [Ghost Ship devlog (devtrackers repost)](https://devtrackers.gg/deep-rock-galactic/p/8cd5ca9c-below-decks-at-ghost-ship-cave-generation-in-deep-rock-galactic)
- Warframe: each tileset has at least 30 room-like tiles of varying sizes joined at connection points; 25 tilesets. — [Warframe wiki, Tileset](https://wiki.warframe.com/w/Tileset) (fan wiki). GDC 2013 "Space Ninjas with Machineguns": usual level-design tricks fail on generated maps, so a tactical map tracking the group's distance to the objective scales enemy count and strength toward the end. — [MCV/UK on Daniel Brewer's talk (search snippet)](https://mcvuk.com/?p=85652)

**Ember Knights (4-player co-op)**
- Hand-crafted rooms assembled procedurally; difficulty scales with player count; fallen players take a ghost form that still matters to progression. — [Co-Optimus (search snippet)](https://www.co-optimus.com/game/8115/pc/ember-knights.html)

**The co-op door problem**
- Liz England's "Door Problem" frames it directly: stop one player until both are in the same room, or teleport the one left behind? Must all players see the door open at the same time? — [Liz England, The Door Problem](https://lizengland.com/blog/wp-json/wp/v2/posts/997)
- A developer exchange reports a teleported player soft-locked: the room they were pulled out of was the only way forward and its combat lock then barred re-entry. — [itch.io post](https://itch.io/post/6513097)

### Inferences
- **Room size in FPS.** Ziggurat's lesson (small = AoE death trap, big = empty and slow) means Isaac's "1×1 cell" must be sized to the horde: Meatgrinder's existing arenas are ~40–60 m across (the boss arena spans floor cells x 6–65, y 50–99 in docs/m10-gate.md). A 1×1 cell around 30×20 m with 2×1 / 2×2 / L horde rooms at 60×20 / 60×40 m keeps the grid readable and gives the 1 000-enemy rooms the space they need; small special rooms (lobby, merchant, leveling) can use a sub-cell footprint inside a 1×1 cell. This must be validated in playtest, not taken from any source.
- **Transitions and the zone rule.** Every FPS adaptation inserts something between rooms (Ziggurat's short corridors, DRG's tunnels, Gungeon's connector rooms). For Meatgrinder, a short bent vestibule (door, 90° turn, door) inside each door socket is the cheapest guarantee that no arena is visible from another, and it doubles as the place where the room's lock/door art lives. Windows only on cell edges with no neighbour, as the brief's red lines show.
- **Minimap.** Use Immortal Redneck / Ziggurat style: corner minimap revealed per room plus icons; doors coloured by room type (Paranautical Activity) so the world and the map share one code.
- **Backtracking.** Isaac's tree (no loops) and dead-end specials mean backtracking is common; in FPS it is slower, so keep floors small (≤ ~12 cells) and consider a "teleport to a cleared room from the map" convenience once the floor's key rooms are found (inference, not from a source).
- **Co-op room lock (recommended rule set).** (1) Combat starts and doors lock only when every living human is inside the room's footprint (bots teleport in at lock time; they never block). (2) If a human stays outside for N s after the first player enters, the room starts anyway and the straggler is teleported to the vestibule inside the door, never into the open arena, and never out of a locked room (avoids the itch.io soft-lock). (3) Downed/dead players: Isaac/Gungeon rule, ghost until the room or floor boss is cleared, then revived. (4) Floor exit (boss portal) uses Gunfire Reborn's ready-up: all living humans stand in the portal. (5) Currency shared (Isaac co-op), relic drops one per player (Isaac boss rule). All of this is host-authoritative state: lock/unlock and teleports are host events broadcast to clients.
- **Horde-scale budget.** Dead Cells' monster budget (1 per N tiles, dangerous enemies cost 10) and Warframe's distance-to-objective scaling are the two cited ways to set room difficulty procedurally; for Meatgrinder, a per-room wave budget derived from the room's difficulty value and cell count (big rooms = horde budget, small rooms = elite/projectile budget) matches the brief's "rooms focus on a style of fight".
- **Repetition.** Immortal Redneck's criticism says per-floor room pools must differ, and Gungeon's rule "a room is never reused within a level" should be adopted.

### Gaps
- No source found for Witchfire, Wizard of Legend or Ravenswatch level structure; no developer source on how Ziggurat or Paranautical Activity prevent seeing into other rooms (they appear to rely on closed doors and corridors).
- Gunfire Reborn's exact portal rule (must all players stand in it vs a vote) was not confirmed; only the ready-up patch note.
- Roboquest's and Ember Knights' co-op door rules (lock out a straggler vs teleport) were not found.
- Hades GDC talks on room-chain design were not fetched; only door-symbol guides.
