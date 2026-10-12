# Doom-lineage combat: mechanisms that turn "hold the trigger and back away" into constant decisions

Scope note: these are research notes for Meatgrinder (browser 2.5D billboard co-op Doom-style FPS, 1000+ enemy hordes, 4 classes with LMB/RMB plus Q/E cooldowns, infinite ammo, ~8 minute arena runs ending in a boss). Playtest complaint: "only running around shooting, holding the mouse button", "no choices". Each section ends with Meatgrinder mappings under Inferences. Source labels: **[Designer]** = statement by a developer of the game; **[Critic]** = journalist/reviewer/analyst; **[Fan]** = wiki/forum/player. Research was capped at roughly 20 tool calls, so some primary sources (GDC video, Noclip documentary, GMTK video) were known to exist but could not be transcribed; see Gaps.

## 1. Doom (2016) and Doom Eternal: push-forward combat, the resource loop, combat chess, weak points, roster roles, forced weapon switching

### Takeaway
id's core move is to put every survival resource (health, ammo, armor) *inside the enemies*, so the only way to recover is to close distance and engage; Eternal then adds enemy "chess pieces" with specific counters and low ammo caps so that no single weapon (and no single input) solves a fight. Designers explicitly frame the goal as prioritisation and thinking; the main criticism is that the result can feel prescriptive.

### Cited Findings
**Push-forward combat (Doom 2016)**
- [Designer] GDC 2018 talk "Embracing Push Forward Combat in DOOM" by Kurt Loudy and Jake Campbell (id Software). It frames push-forward combat as a rejection of common shooter mechanics such as regenerating health, reloading and taking cover; the player must get what they need by engaging enemies, with a focus on "brutality, aggression and speed". — [GDC Vault](https://gdcvault.com/play/1024940/Embracing-Push-Forward-Combat-in); [GDC news](https://gdconf.com/news/see-doom-devs-break-push-forward-combat-design-gdc-2018); [Game Developer video post](https://www.gamedeveloper.com/design/video-the-combat-design-of-i-doom-i-)
- [Critic/analysis of the GDC AI talk] Push-forward combat "is built around four pillars": speed of player and demons, individuality of demons, distinctiveness of each weapon, and keeping the player powerful even when outnumbered. — [Game Developer: Cyber Demons, the AI of DOOM 2016](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-)
- [Designer, as reported] Demon accuracy is deliberately reduced the faster the player moves ("Demon accuracy is intentionally reduced the faster the player moves to make you harder to hit"); higher difficulties compensate less. Enemies will not shoot explosive barrels next to the player. — [Game Developer](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-)
- [Designer, as reported] Attack token system: "DOOM uses a combat system that requires that demons ask to attack the player." Each attack type (melee, ranged, charged) has a limited token pool, varied by difficulty; demons can steal tokens so the ones in front of the player are never idle. — [Game Developer](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-)
- [Designer, as reported] 16 AI archetypes with distinct behaviour: Pinkies charge to ram, Imps keep distance and throw fireballs; ranged enemies use an "exposed cover" system to find open spots with sight lines. — [Game Developer](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-)
- [Designer, as reported] Weapon distinctiveness is implemented as distinct enemy reactions: sustained damage escalates pain reactions (twitch -> falter -> stagger that enables a glory kill); Imps stop moving when hit by the assault rifle; zombies stagger quickly from the shotgun. — [Game Developer](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-)

**Resource loop**
- [Designer, as reported] Glory kills make the player invincible during the execution, and AI cannot start a new attack until it finishes; kills drop health, bigger demons drop more; chainsaw kills give ammo; "other ammo drops stay fairly consistent to encourage using the full arsenal". — [Game Developer](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-)
- [Fan wiki] Glory kills become available when a monster is staggered by a critical amount of damage (it flashes blue/orange); in campaign, glory kills increase health dropped, and make the weakest monsters drop health when they otherwise would not. Invulnerability covers the start of most glory kills but not the full animation and recovery. — [DoomWiki: Glory kill](https://doomwiki.org/wiki/Glory_kill)
- [Critic] Steven Lumpkin (did not work on the game): "Glory Kills restore health, Chainsaw Kills restore ammo"; "Ammo is still limited (chainsaw requires fuel)"; bosses break the loop because "there are no minions to glory kill"; chainsawing big enemies is "high risk, high reward"; consumables (grenades) felt weak and went unused. — [Game Developer: Design Notes DOOM 2016](https://www.gamedeveloper.com/design/design-notes-doom-2016-)
- [Designer] Hugo Martin (creative director, Eternal) at E3 2019: fewer health packs and ammo pickups, item distribution "tuned and tightened", to make players think more about resources; getting ammo from the chainsaw is "far more engaging" than picking it off the floor. — [Engadget](https://www.engadget.com/2019-06-14-doom-eternal-hands-on-e3-2019.html); [Windows Central](https://windowscentral.com/doom-eternal-preview)
- [Designer] Martin to Game Informer: using the chainsaw "was so much more satisfying than just overfilling the levels with resources everywhere so you're tripping over them"; arenas still have pickups, but not enough to clear a whole fight. — [Game Informer](https://gameinformer.com/preview/2019/06/13/id-talks-mod-support-integrating-more-traversal-and-the-controversial-neon-ui)
- [Critic, preview] Flame Belch sets demons on fire so they "bleed armor"; mainly a tool for spilling armor before finishing them. — [Engadget](https://www.engadget.com/2019-06-14-doom-eternal-hands-on-e3-2019.html); [GameRevolution](https://www.gamerevolution.com/preview/628924-doom-eternal-preview)
- [Designer] Martin, responding to the "prescriptive routine" criticism (glory kill/blood punch for health, chainsaw for ammo, belch for armor): "To say that it is overly prescriptive is not accurate, because all of these things are skillshot opportunities." — surfaced by search alongside [PC Gamer: Marauder is good, actually](https://www.pcgamer.com/uk/doom-eternals-director-says-the-marauder-is-good-actually/); page body could not be retrieved to confirm exact source (see Gaps).

**Combat chess, prioritisation, roster roles**
- [Designer] Martin (Shacknews "Hell Razer"): "If you're not prioritizing anything on the battlefield and just killing whatever's in front of you, that sucks." / "You know you've got an encounter dialed in right when the player is running by certain enemies to kill another one." / "We add those risk-reward elements to chess pieces to make even better gameplay." / "Many AI have now been tuned to no longer allow you to rush up to them." / "We don't want to force people to use every single weapon." / "If one weapon is unbalanced, that takes away from everything else." — [Shacknews p.4](https://www.shacknews.com/article/116635/hell-razer-the-making-of-doom-eternal?page=4)
- [Designer] Marty Stratton: the Arch-vile was changed to *spawn* demons instead of resurrecting dead ones (a priority target that multiplies the board). — [Shacknews p.4](https://www.shacknews.com/article/116635/hell-razer-the-making-of-doom-eternal?page=4)
- [Designer] Martin: "We want combat puzzles that are worth your time to solve and master." / "Be aggressive, manage your resources, be mindful of the guns you use." / "Anybody can make a hard game." / "A hero is only as strong as the adversary they have to overcome." — [Shacknews p.8](https://www.shacknews.com/article/116635/hell-razer-the-making-of-doom-eternal?page=8)
- [Designer, as reported] In the Noclip documentary Martin calls enemies "chess pieces" and argues that when you're thinking you're engaged and when you're not you're bored; even high-health "bullet sponge" enemies are a useful chess piece because their toughness shapes the fight. — reported via search summary of [PCGamesN demons video](https://www.pcgamesn.com/doom-eternal/demons-video) and [PC Gamer demon breakdown](https://www.pcgamer.com/heres-a-breakdown-of-the-new-demons-in-doom-eternal/) (not verified verbatim).
- [Fan wiki] Eternal's codex groups enemies as ambient / fodder / heavy / super heavy. Fodder (Imp, Zombie, Soldier, Lost Soul, Mecha Zombie, Maykr Drone) keeps respawning so the heavies always have support and the player always has resource piñatas; super heavies include Arch-vile, Baron, Doom Hunter, Marauder, Tyrant. Some demons (e.g. Carcass shields) are built to counter specific weapons. — [DoomWiki template](https://doomwiki.org/wiki/Template:Doom_Eternal_monsters); [NamuWiki](https://en.namu.wiki/w/%EB%91%A0%20%EC%9D%B4%ED%84%B0%EB%84%90/%EB%AA%AC%EC%8A%A4%ED%84%B0) (fan-maintained, machine-translated; treat tiers as approximate)
- [Designer, headline paraphrase] Martin said Eternal's destructible-demon (weak point) system had such an impact that 2016's Doom became "hard to play" for him. — [PC Gamer](https://www.pcgamer.com/hugo-martin-doom-eternals-destructible-demon-system-makes-such-an-impact-2016s-doom-is-now-hard-to-play/) (body not retrievable)

**Ammo caps and forced switching: defence and criticism**
- [Critic, analytical review] In 2016 "It was far too easy to converge to a 'workhorse' weapon that dealt with literally everything"; in Eternal "The ammo caps and enemy weakpoint system makes weapon switching mandatory"; "The notion of a main weapon really doesn't work cleanly with Eternal". Because ammo is infinitely renewable via chainsaw, only a *low cap* creates pressure. 4 ammo types shared across pairs of weapons. — [Critical Points](https://critpoints.net/2020/06/07/doom-eternal-reviews-ft-s-g-s)
- [Critic] Same author: "TARGETING WEAKPOINTS IS AN OPTION, NOT A NECESSITY"; weak points are "not the most efficient way to kill an enemy usually, just a way of reducing their threat to you"; "Each enemy can deal with you at multiple ranges, and it is up to your skill to decide who to deal with" ("some of the finest enemy prioritization ever"). Chainsaw fuel pips: low-fuel chainsaw on fodder is the reload; the game wants you to "save fodder for ammo and focus on heavies". — [Critical Points](https://critpoints.net/2020/06/07/doom-eternal-reviews-ft-s-g-s)
- [Fan] Steam players: low ammo makes switching "practically a necessity, which feels clunky"; ammo "artificially low", forcing constant chainsaw; weak points and abilities conflict with free weapon choice. — [Steam thread](https://steamcommunity.com/app/782330/discussions/0/3881596897256675092)
- [Critic, design blog] Low ammo caps put more pressure on chainsaw kills and the "very important" ammo counts were harder to read than in 2016. — [Adam Atomic: Design of Doom Eternal](https://blog.adamatomic.com/post/613311014289768448/design-of-doom-eternal)

### Inferences
- The decisive mechanism is not any single verb but the *coupling*: resource = enemy, enemy type = preferred counter, and the cap/cooldown stops one counter from being enough. Remove the coupling and players settle on a "workhorse" input, which is exactly Meatgrinder's playtest complaint.
- Martin's encounter-tuning test ("the player is running by certain enemies to kill another one") is a cheap, observable playtest metric Meatgrinder can adopt directly: watch whether players ever ignore the nearest Blessed to go kill a Cherub/Chorister.
- **Meatgrinder mapping: resources inside enemies.** Meatgrinder has no ammo, so the levers are health and cooldowns. Option: Blessed killed at close range (or by a class's "finisher" input) drop small health/cooldown-refund motes; ranged kills drop nothing. This turns the 1000-Blessed mass from a threat-to-retreat-from into a resource field to wade into. Keep it one visible effect (a mote you pick up), consistent with the "simple abilities" rule.
- **Meatgrinder mapping: stagger -> finisher window.** A Blessed or Chorister that takes a burst (e.g. Fallen shotgun point-blank, Betrayer Silver Bullet) could flash and become "executable" by melee/ability for a bonus drop. Glory-kill invulnerability is risky in co-op with hordes; a short i-frame on the finisher hit only (not an animation lock) is the safer analogue.
- **Meatgrinder mapping: attack tokens.** With 1000+ enemies, a token cap on how many Blessed may actually strike a player at once (and how many Cherubs may fire in a volley) is how "player power even when outnumbered" stays true; tokens per player in co-op. It also makes "dive in" survivable, which is the precondition for any push-forward incentive.
- **Meatgrinder mapping: roster roles.** Blessed = fodder (resource piñatas, never the reason you die alone); Cherubs and Choristers = heavies (priority targets); the boss = super heavy. Each class's LMB/RMB should be clearly better against one tier (e.g. Betrayer's piercing shot excels at sniping Cherubs through a crowd; Fallen's shotgun/slam excels at fodder), which matches the existing "LMB/RMB each situational" rule.
- **Meatgrinder mapping: weak points as threat reduction, not DPS.** E.g. shooting a Chorister's globe in flight pops it, or hitting a Cherub's bow arm interrupts its volley. Framed like Eternal: optional, reduces the threat, readable.
- Caution from the criticism: Eternal's loop was called prescriptive and clunky. Meatgrinder's classes already differ, so rely on enemy-counter pairing and positive incentives (drops) rather than hard ammo starvation.

### Gaps
- The GDC 2018 talk video, the Noclip Doom Eternal documentary and GMTK's "The 4 P's of DOOM's Amazing Combat" (S6E7, 2020-04-08, [TVDB listing](https://thetvdb.com/series/game-makers-toolkit/episodes/7677488)) were not transcribed; what the four P's stand for was not confirmed.
- "Combat chess" as a verbatim Martin phrase was not confirmed; "chess pieces" is reported second-hand.
- The exact source of Martin's "skillshot opportunities" quote was not confirmed (PC Gamer page body blocked).
- No official numbers found for glory kill health amounts, chainsaw fuel costs per enemy tier, or ammo caps.
- Doom 2016 reportedly scales drops when the player is low on health; no reliable source found, so not claimed.

## 2. Ultrakill, Serious Sam, and other Doom-lineage games (Painkiller, Boltgun, Dusk, Prodeus, Turbo Overkill, Roboquest)

### Takeaway
Ultrakill pushes Doom's "resource in the enemy" idea to its limit (health comes from blood sprayed at close range and from parries) and adds a style meter that scores variety and risk; Serious Sam makes huge hordes work by mixing simple enemy types whose combinations, telegraphed largely by sound, demand different responses. Designer-sourced material on the smaller titles is thin.

### Cited Findings
**Ultrakill**
- [Designer] Hakita: Devil May Cry is "probably the most important" influence, aiming for "What if DMC was an FPS?"; argues DOOM shares much of its design philosophy with character action games. A ricochet revolver was redesigned so ricochets reward skill rather than floor-shooting. — [Into the Blue Sky interview (2020)](https://intothebluesky.com/2020/12/19/interview-with-arsi-hakita-patala/)
- [Designer] Hakita: "The AI is kept purposefully simple to make the enemies predictable and easy to keep track of." / "The main challenge is creating enemies that actually pose a threat to the player." / "Going fast is fun". Article notes movement lets the player easily outmanoeuvre enemies, which larger enemy counts per encounter counteract. — [80.lv](https://80.lv/articles/ultrakill-devs-on-the-game-s-mechanics-npc-ai-and-early-access-experience/)
- [Fan wiki] The player heals by absorbing enemy blood via close-range combat or by parrying enemy attacks; style meter rewards "advanced and flashy moves", aerial manoeuvring and quick weapon swapping; parries earn style bonuses; end-of-level grade combines style, time and kills; weapons have primary and alternate fire and interact with each other. — [Wikipedia: Ultrakill](https://en.wikipedia.org/wiki/Ultrakill)
- [Critic] The style meter is fed by chaining kills, headshots, multi-kills in one shot and trick shots. — [Film Stories](https://filmstories.co.uk/gaming/ultrakill-improvisational-and-impulsive/)

**Serious Sam**
- [Critic] Giant Bomb on The First Encounter: most monsters are "extremely manageable" individually, but the player is almost never pitted against just one type; situational awareness, driven largely by sound design, and circle-strafing are the keys. — [Giant Bomb review](https://giantbomb.com/reviews/serious-sam-the-first-encounter-review)
- [Critic] Serious Sam 3's final level has 1,700+ enemies, 500+ of them Kleer skeletons; for SS4, designer Dravor Tomicic said "we'll try to pump up all the best characteristics of the previous games to the extreme" with the "biggest number of enemies and largest maps". — [TechRaptor](https://Techraptor.net/gaming/news/serious-sam-4-aims-to-take-series-to-extreme)
- [Critic] Beheaded Kamikazes are creatures with one goal (blow Sam up) and show Croteam's knack for turning laughable designs into real threats. — [DreadXP](https://dreadxp.com/?p=31834)
- [Critic] GameSpot: Croteam throws "a ridiculous number of enemies at you at all times" and has the tech to do it. — [GameSpot SS4 review](https://gamespot.com/reviews/serious-sam-4-review-the-fourth-encounter/1900-6417573/)

**Boltgun and others**
- [Critic] GameSpot on Boltgun: no regenerating health; scattered health/armor/ammo pickups mean running around searching can pull you out of the action; the reviewer notes Doom's glory kills/chainsaw solved this and calls the old-school approach archaic. — [GameSpot Boltgun review](https://Gamespot.Com/videos/warhammer-40000-boltgun-video-review/2300-6461438/)
- [Designer, as reported] An Auroch Digital developer described Boltgun's appeal as a "conveyor belt of abilities": pop one enemy, close on another with the chainsword, charge something else. — reported via search of [MCV: When We Made Boltgun](https://mcvuk.com/business-news/when-we-made-warhammer-40000-boltgun/) (not verified verbatim)
- [Critic] Prodeus: a simple weapon set with small twists on each weapon. — [Dread Central](https://www.dreadcentral.com/reviews/490000/prodeus-review-this-shooters-the-crimson-king/)

### Inferences
- Ultrakill's blood healing is the most direct anti-backpedal mechanism in the genre: retreating is mechanically equivalent to not healing. It also explains why Hakita keeps AI simple and predictable: if health requires being close, threats must be readable at close range.
- Serious Sam's lesson for 1000+ hordes is that individual enemies can be trivial if (a) their *combinations* force different responses and (b) each type announces itself by sound before it is visible (the headless Kamikaze scream is the textbook example; widely known but not sourced here).
- **Meatgrinder mapping: proximity healing.** A Heretic Saint passive or a run-wide rule where kills within a short radius heal a little would make the horde the health bar. Pairs well with the Fallen's slam and Binder's chains (melee range by design) and gives Betrayer/Saint a reason to dash in briefly.
- **Meatgrinder mapping: style/score as decision pressure.** The recent "score sheet and kill streaks" spec could reward variety (alternating LMB/RMB/Q/E kills, multi-kills with Silver Bullet pierce, kills on priority targets) rather than raw kill count, which otherwise rewards exactly the "hold LMB" behaviour. Keep it a scoreboard, not a stat buff, to respect the "no press-on-ready buffs" rule.
- **Meatgrinder mapping: parry.** A parry-to-heal is a strong Ultrakill idea but adds a new verb; if considered, a narrow version (e.g. Fallen's taunt or Betrayer's dash reflecting a Chorister globe) fits better than a universal parry. Confirm scope before adding.
- **Meatgrinder mapping: Serious Sam audio telegraph.** Every non-fodder enemy (Cherub draw, Chorister lob) should have a distinct, directional audio cue, so players make priority decisions about off-screen threats in a billboard engine where visual reading of crowds is limited.
- Boltgun's critic note is a warning: if health only comes from fixed pickups, players disengage to fetch them. Drops from kills keep players near the fight.

### Gaps
- No designer statement found on the *intent* of Ultrakill's blood healing radius, hard damage, or style meter; numbers (heal radius, style thresholds) not found.
- A Croteam (Damjan Mravunac) quote that enemy design "starts with its function" surfaced in search but its source (reportedly an Autodesk interview) was not retrieved; not verified.
- Painkiller (souls as health), Dusk, Turbo Overkill, Roboquest: no designer-sourced combat design material found within the tool budget. Dusk and Prodeus ammo philosophy: nothing found.

## 3. Enemy design for hordes: mixed threats, priority targets, enemy-as-puzzle, telegraphing and dodgeable projectiles

### Takeaway
The horde is not the puzzle; the *mix* is. Fodder fills space and feeds resources, while a few distinct heavies each pose a different question (range, area denial, shields, spawning) and the player's skill is choosing whom to deal with next. Readability (simple, predictable AI; distinct animations and sounds) is what makes the choice possible.

### Cited Findings
- [Designer] Martin: not prioritising "sucks"; a tuned encounter makes players run past enemies to kill another; heavies tuned so you cannot just rush up to them. — [Shacknews p.4](https://www.shacknews.com/article/116635/hell-razer-the-making-of-doom-eternal?page=4)
- [Designer] Stratton: Arch-vile changed to spawn demons, creating an obvious priority target. — [Shacknews p.4](https://www.shacknews.com/article/116635/hell-razer-the-making-of-doom-eternal?page=4)
- [Fan wiki] Eternal fodder is constantly re-summoned to keep two to four heavy/super-heavy "pieces" on the field supported. — [NamuWiki](https://en.namu.wiki/w/%EB%91%A0%20%EC%9D%B4%ED%84%B0%EB%84%90/%EB%AA%AC%EC%8A%A4%ED%84%B0) (fan, approximate)
- [Designer, as reported] Doom 2016: 16 archetypes with unique behaviours; Pinkies charge, Imps keep distance; ranged demons seek exposed positions with sight lines; a faction system lets demons infight. — [Game Developer](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-)
- [Critic] Eternal: "Each enemy can deal with you at multiple ranges, and it is up to your skill to decide who to deal with." — [Critical Points](https://critpoints.net/2020/06/07/doom-eternal-reviews-ft-s-g-s)
- [Designer] Hakita: AI "purposefully simple to make the enemies predictable and easy to keep track of"; the challenge is making enemies that are still a threat. — [80.lv](https://80.lv/articles/ultrakill-devs-on-the-game-s-mechanics-npc-ai-and-early-access-experience/)
- [Critic] Serious Sam: individual monsters "extremely manageable"; difficulty comes from mixed types; sound-driven situational awareness is key. — [Giant Bomb](https://giantbomb.com/reviews/serious-sam-the-first-encounter-review)
- [Fan wiki] Doom 2016 stagger state is telegraphed by the enemy flashing blue/orange. — [DoomWiki](https://doomwiki.org/wiki/Glory_kill)

### Inferences
- A useful taxonomy for Meatgrinder's roster (from the cited examples): **rusher/fodder** (Blessed; mass, resource source), **ranged harasser** (Cherub; forces line-of-sight decisions), **area denial/lobber** (Chorister; forces repositioning), **spawner/multiplier** (Arch-vile analogue; obvious kill-first), **armoured/shielded** (Carcass/Marauder analogue; requires a specific counter). Meatgrinder currently has the first three. The research supports the user's scope rule: tune the existing three into a sharper triangle before adding types.
- **Meatgrinder mapping: make heavies worth the detour.** If a Cherub or Chorister drops a larger resource than a Blessed (bigger heal mote or a cooldown refund for the killer), the "run past fodder to kill the heavy" behaviour Martin describes becomes rewarded, not just survival-motivated.
- **Meatgrinder mapping: few heavies, always present.** Eternal keeps 2-4 heavies alive with fodder support. For an 8-minute run, keeping a small, refilled number of Cherubs/Choristers per arena (rather than a fixed initial wave) maintains a constant priority question.
- **Meatgrinder mapping: dodgeable threats.** Chorister globes and Cherub arrows should be slow enough to sidestep and clearly telegraphed (wind-up pose + sound); Doom's accuracy-falls-with-speed rule shows moving should be *rewarded*, but Meatgrinder's problem is backpedalling, so dodge directions should favour lateral/forward motion (e.g. lobbed globes landing behind a retreating player, arrows leading a backpedaller).
- **Meatgrinder mapping: class-specific answers.** Binder's bind could be the "shield breaker"/interrupt for heavies; Betrayer's piercing shot the answer to a Cherub line behind fodder; Heretic Saint's incense the area to fight inside; Fallen's taunt the tool that pulls fodder off a teammate. Each class then has a different priority list in the same fight, which is a co-op decision generator.

### Gaps
- No formal source found for "enemy as puzzle" frameworks beyond Martin's "combat puzzles" and "chess pieces" statements.
- No numeric guidance found on projectile speeds/telegraph durations in Doom-lineage games.

## 4. Movement as a verb: dashes, double jump, slides, verticality, jump pads, pickups in danger

### Takeaway
In the Doom lineage, movement is both defence and the route to resources: enemies are tuned to miss fast-moving players, arenas are built for vertical traversal, and fast movement is balanced by increasing enemy counts and placing what the player needs inside the fight.

### Cited Findings
- [Designer, as reported] Doom 2016: demon accuracy intentionally reduced the faster the player moves; the article compares the pace to Pac-Man with the player about 10 times faster than usual shooter movement. — [Game Developer](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-)
- [Critic] Doom 2016 arenas required "mastering different verticalities and using the environment to my advantage"; movement "very fluid, quick, and easy". — [Game Developer: Design Notes](https://www.gamedeveloper.com/design/design-notes-doom-2016-)
- [Critic, preview] Doom Eternal adds wall-climbing, dashes and horizontal bars to swing from; the Super Shotgun's Meat Hook works as a grapple in combat and traversal. — [Game Informer](https://gameinformer.com/preview/2019/06/13/id-talks-mod-support-integrating-more-traversal-and-the-controversial-neon-ui)
- [Designer] Hakita: "Going fast is fun"; levels linear to keep pace; movement lets players outmanoeuvre enemies, countered by larger enemy counts. — [80.lv](https://80.lv/articles/ultrakill-devs-on-the-game-s-mechanics-npc-ai-and-early-access-experience/)
- [Fan wiki] Ultrakill's style meter rewards aerial manoeuvring. — [Wikipedia](https://en.wikipedia.org/wiki/Ultrakill)

### Inferences
- Movement alone does not create choices; "circle-strafe and hold fire" is the degenerate Serious Sam strategy ([Giant Bomb](https://giantbomb.com/reviews/serious-sam-the-first-encounter-review)). Movement becomes a decision when there is a *destination*: a resource, a priority target, a safe zone that moves.
- **Meatgrinder mapping: movement abilities as offence.** Fallen's leap slam and Betrayer's dash already exist; making them the fastest way *into* a crowd (with a reward on landing, e.g. slam kills drop heal motes) rather than an escape keeps them aligned with push-forward. Binder chains could pull the Binder toward a bound heavy (Meat Hook analogue) — would be a new behaviour, confirm scope.
- **Meatgrinder mapping: moving safe zones.** Heretic Saint's incense clouds are a natural "go here" destination; if incense also boosts something visible (e.g. healing only inside), the team must fight where the clouds are rather than kite.
- **Meatgrinder mapping: arena features.** In 2.5D billboard arenas, verticality is limited; jump pads or raised platforms that give sight lines to Cherubs/Choristers, plus pickups placed in the densest zones, are the cheapest way to make positioning a choice. Keep this for the levels milestone.

### Gaps
- No designer source found on jump-pad or pickup placement philosophy specifically; Eternal "monkey bar" and arena design rationale from id not retrieved.
- No reliable source found for bunny-hop design intent in modern Doom-likes.

## 5. Infinite vs limited ammo: designer views on the tradeoff; is infinite ammo part of the "hold the button" boredom?

### Takeaway
Doom-lineage designers use limited ammo less for scarcity than for *steering*: Eternal's renewable-but-capped ammo exists to stop one weapon from solving everything. Infinite ammo by itself is not boring, but infinite ammo plus no other constraint on the primary attack removes the reason to switch, which reproduces Doom 2016's "workhorse weapon" problem.

### Cited Findings
- [Designer] Martin: fewer pickups, distribution "tuned and tightened" so players think about resources. — [Engadget](https://www.engadget.com/2019-06-14-doom-eternal-hands-on-e3-2019.html)
- [Designer] Martin: overfilling levels with pickups so "you're tripping over them" was less satisfying than chainsaw resupply. — [Game Informer](https://gameinformer.com/preview/2019/06/13/id-talks-mod-support-integrating-more-traversal-and-the-controversial-neon-ui)
- [Designer, as reported] Doom 2016 kept non-chainsaw ammo drops consistent "to encourage using the full arsenal". — [Game Developer](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-)
- [Critic] With infinitely renewable ammo, only a low cap creates pressure; Eternal's caps force weapon variety; 2016 converged on a workhorse weapon. — [Critical Points](https://critpoints.net/2020/06/07/doom-eternal-reviews-ft-s-g-s)
- [Fan] Counter-view: players complained of having to keep thinking about ammo when they'd rather just blast; others replied you can always take what you need via chainsaw. — [Steam thread](https://steamcommunity.com/app/782330/discussions/0/3414306773858504801); [Steam thread](https://steamcommunity.com/app/782330/discussions/0/3881596897256675092)
- [Critic] Overwatch analysis: infinite ammo keeps players in the fight longer but gives up strategic depth that ammo management could provide. — [GosuGamers](https://www.gosugamers.net/overwatch/features/38916-infinite-ammo-depth-spam-and-everything-in-between)
- [Critic] Boltgun: scattered pickups pull players out of action. — [GameSpot](https://Gamespot.Com/videos/warhammer-40000-boltgun-video-review/2300-6461438/)

### Inferences
- Meatgrinder's design (infinite ammo, LMB with no limiting resource) has no Eternal-style cap, so the cooldown abilities are the only forced variety, and they are off most of the time. The playtest "holding the mouse button" is the predicted result.
- **Meatgrinder mapping: constrain the primary without ammo.** Options that keep "infinite ammo" as a premise: (a) per-attack heat or a short magazine that refills instantly when you switch to the other attack (switching *is* the reload; turns LMB/RMB alternation into a rhythm); (b) the primary's damage falls off with range so backpedalling reduces output; (c) RMB is the counter to a specific enemy behaviour, so holding LMB leaves that threat unanswered. Option (b)/(c) respect the "one visible effect" rule better than a heat bar. These are inferences, not sourced designs.
- **Meatgrinder mapping: cooldown refunds as the "chainsaw".** Eternal's insight is renewable resource gated by an action against a specific enemy tier. Meatgrinder equivalent: killing a heavy (or a Blessed with a specific attack) shaves time off Q/E. That makes abilities available more often for players who engage, and gives a reason to pick targets.
- Watch the criticism: hard ammo starvation was felt as clunky and prescriptive. Prefer bonuses for engagement over penalties for not engaging.

### Gaps
- No designer interviews found from Dusk (David Szymanski / New Blood), Prodeus (Bounding Box) or Roboquest on infinite vs limited ammo.
- No sourced example of a Doom-like using "switch to reload" or range falloff specifically to fight trigger-holding.

## 6. Health/armor pickups in arenas and drops from kills: how they drive aggression

### Takeaway
Drops from kills (especially close-range or execution kills) are the genre's main aggression engine: when you are hurt, the fix is in the enemy in front of you, not behind you. Fixed arena pickups exist but are tuned to be insufficient, so the player cannot camp them.

### Cited Findings
- [Designer] Push-forward combat rejects regenerating health and cover; the player gathers what they need by engaging. — [GDC news](https://gdconf.com/news/see-doom-devs-break-push-forward-combat-design-gdc-2018); [GDC Vault](https://gdcvault.com/play/1024940/Embracing-Push-Forward-Combat-in)
- [Designer, as reported] Glory kills drop health, bigger demons drop more, with invulnerability during the kill. — [Game Developer](https://www.gamedeveloper.com/design/cyber-demons-the-ai-of-doom-2016-)
- [Fan wiki] Glory kills raise health drops and make the weakest monsters drop health they otherwise wouldn't; stagger is telegraphed by a flash. — [DoomWiki](https://doomwiki.org/wiki/Glory_kill)
- [Designer] Eternal arenas still have pickups, but not enough to get through a fight; resupply comes from enemies. — [Game Informer](https://gameinformer.com/preview/2019/06/13/id-talks-mod-support-integrating-more-traversal-and-the-controversial-neon-ui)
- [Critic, preview] Flame Belch makes burning demons "bleed armor". — [Engadget](https://www.engadget.com/2019-06-14-doom-eternal-hands-on-e3-2019.html)
- [Fan wiki] Ultrakill heals from blood at close range and from parries. — [Wikipedia](https://en.wikipedia.org/wiki/Ultrakill)
- [Critic] Boss fights break the glory-kill health loop when there are no minions. — [Game Developer: Design Notes](https://www.gamedeveloper.com/design/design-notes-doom-2016-)

### Inferences
- Three layered sources of sustain, each tied to a different decision: execution/close kill (health) -> commit to a target; chainsaw (ammo) -> spend a limited resource on fodder; flame belch (armor) -> use a cooldown before a fight. The common element is that each requires approaching or acting on enemies.
- **Meatgrinder mapping: kill drops tied to how you kill.** Example scheme: close-range or ability kills drop a heal mote; heavy kills drop a bigger one; ranged LMB kills on fodder drop nothing. This directly penalises the "back away and hold LMB" pattern without a hard rule.
- **Meatgrinder mapping: co-op twist.** Motes could be shared (anyone can pick them up), so the Fallen tanking in the crowd creates heals that pull teammates forward, and the Heretic Saint's healing role becomes amplifying or redistributing rather than the only sustain. Keep Saint's identity distinct; confirm scope.
- **Meatgrinder mapping: boss fights.** Doom's lesson that bosses break the loop: the Meatgrinder boss should spawn Blessed adds (Arch-vile style) so the sustain loop continues during the boss.
- **Meatgrinder mapping: armor analogue.** If wanted, a temporary overshield from one specific action (e.g. Fallen's taunt hitting N enemies) mirrors Flame Belch, but this would be a press-on-ready buff only if it triggers automatically; keep it tied to hitting enemies. Lower priority than health drops.

### Gaps
- No numbers found for drop amounts, drop rates, or pickup counts per arena in Doom 2016/Eternal.
- No designer source found on whether Doom scales drops by player health (commonly believed, unverified).
