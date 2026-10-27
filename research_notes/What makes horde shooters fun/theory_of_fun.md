# Theory of fun: frameworks that explain why shooters and horde games are fun, and why they get boring

Context: Meatgrinder (browser 2.5D Doom-style co-op FPS, 1000+ enemy hordes, 4 classes x 2 attacks + 2 cooldown abilities, infinite ammo, ~8 min runs, 3 arenas + boss). Playtest 4 complaint: "only running around shooting, holding the mouse button", "no choices", "not much to do". The developer keeps the premise (Doom shooter, distinct classes, abilities, passives, distinctive guns).

Source note: the MDA paper, Valve's Left 4 Dead GDC 2009 decks (Booth) and Valve's playtesting deck (Ambinder) were downloaded as PDFs and read in full text. Most other items come from interviews, articles and secondary summaries, and are marked as such where it matters.

## Key question 1: What do the core frameworks say, and what does each suggest for Meatgrinder?

### Takeaway
Every major framework points the same way. Fun comes from (a) decisions that matter, (b) a pattern the player is still learning, (c) challenge that rises with skill, and (d) feeling competent, free to choose, and connected to others. A shooter where the best play is "hold LMB and keep moving" fails (a) and (b) inside a few minutes, however good the feel is. Meatgrinder's playtest complaints ("no choices", "holding the mouse button") are a textbook case of mastered patterns plus missing decisions. They are not a problem of feel.

### Cited Findings

**MDA (Mechanics, Dynamics, Aesthetics): Hunicke, LeBlanc, Zubek, 2004**
- Mechanics are "the various actions, behaviors and control mechanisms afforded to the player". Dynamics are the run-time behavior that comes out of them. Aesthetics are the emotional responses. Designers work from mechanics toward aesthetics, while players feel the aesthetics first and only then notice dynamics and mechanics — [MDA paper](https://users.cs.northwestern.edu/~hunicke/MDA.pdf)
- The paper lists eight aesthetics ("kinds of fun"): Sensation, Fantasy, Narrative, Challenge, Fellowship, Discovery, Expression, Submission. It profiles Quake as "Challenge, Sensation, Competition, Fantasy" — [MDA paper](https://users.cs.northwestern.edu/~hunicke/MDA.pdf)
- On shooters specifically: their mechanics ("weapons, ammunition and spawn points") "sometimes produce things like camping and sniping". In other words, emergent dominant behaviours come from the mechanics — [MDA paper](https://users.cs.northwestern.edu/~hunicke/MDA.pdf)
- Dynamics create aesthetics. "Challenge is created by things like time pressure and opponent play". Fellowship comes from shared information or win conditions that are harder to reach alone. Dramatic tension comes from "a rising tension, a release, and a denouement" — [MDA paper](https://users.cs.northwestern.edu/~hunicke/MDA.pdf)
- Monopoly example: when the feedback loop runs away with the game, "Dramatic tension and agency are lost" and only one player stays invested — [MDA paper](https://users.cs.northwestern.edu/~hunicke/MDA.pdf)

**Self-Determination Theory / PENS: Ryan, Rigby, Przybylski, 2006**
- "The Motivational Pull of Video Games: A Self-Determination Theory Approach" (Motivation and Emotion, DOI 10.1007/s11031-006-9051-8) ran four studies. In-game autonomy and competence predicted enjoyment, preference and short-term well-being changes. Both were linked to intuitive controls and to presence/immersion. In the online-multiplayer study, autonomy, competence and relatedness each independently predicted enjoyment and future play — [Ewha abstract](https://pure.ewha.ac.kr/en/publications/the-motivational-pull-of-video-games-a-self-determination-theory-/); [University of Rochester copy](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf); [ScienceDaily summary](https://www.sciencedaily.com/releases/2006/12/061226134706.htm)
- This paper is the basis of the PENS (Player Experience of Need Satisfaction) model and measure, which assumes successful games strongly satisfy autonomy, competence and relatedness — [selfdeterminationtheory.org PENS](https://selfdeterminationtheory.org/player-experience-of-needs-satisfaction-pens/)
- Note: sources disagree on the page numbers (344–360 vs 347–363). Use the DOI — [Rochester copy](https://www.rochester.edu/warner/lida/wp-content/uploads/2022/11/02bfe513dd59366750000000.pdf)

**Flow: Csikszentmihalyi; Jenova Chen, "Flow in Games"**
- Flow needs challenge balanced against ability. Too much challenge makes players anxious. Too little makes them lose interest and leave. Chen treats the "Flow Zone" as different for each player — [Chen, Flow in Games (CACM/ACM paper PDF)](https://khoury.northeastern.edu/~lieber/courses/csu670/f08/materials/p31-chen-flow-in-games.pdf); [jenovachen.com thesis statement](https://www.jenovachen.com/flowingames/missionstatement.htm)
- Chen argues for "active" difficulty adjustment, where the player controls the difficulty through in-game choices, over hidden adjustment, because flow requires a feeling of control. In flOw, players dove between layers and chose which creatures to eat. Many skipped a hard monster, went back to grow, and then returned to fight it — [Wikipedia: Flow (video game)](https://en.wikipedia.org/wiki/Flow_(video_game)); [Joystiq/Engadget interview](https://www.engadget.com/2006-09-18-joystiq-qanda-jenova-chen.html)

**Sid Meier: "a game is a series of interesting decisions"**
- Meier first stated this at GDC 1989 and revisited it in a GDC 2012 talk, "Interesting Decisions". That talk covered how to present decisions and how to give enough feedback on their results — [GDC 2012 announcement](https://www.gdconf.com/news/gdc_2012_adds_meier_inafune_le); [Game Developer video post](https://gamedeveloper.com/design/video-sid-meier-explores-interesting-decisions-in-gameplay)
- Soren Johnson's summary of Meier's lessons: "Choice is only interesting when it is both impactful and informed." Players must understand consequences before choosing. Johnson criticises RPGs that make you pick a class before you understand combat. Players must "always be the star". Too many upgrades overwhelm them. Changes should be "double it or cut it by half", because small tweaks give no usable feedback — [Game Developer: Sid Meier's key design lessons (Soren Johnson, 2009)](https://www.gamedeveloper.com/pc/analysis-sid-meier-s-key-design-lessons)
- A secondary source says Meier describes an interesting choice as one where no option clearly dominates and the options are similarly appealing. His memoir adds that a good decision leaves you wondering what the other choice would have done. These are second-hand — [Chemeketa reader: Sid Meier on Decisions](https://computerscience.chemeketa.edu/cis125greader/Choice/BossBattle.html); [Brikman review of Sid Meier's Memoir](https://www.ybrikman.com/blog/2026/06/18/sid-meier-memoir/)

**Raph Koster: A Theory of Fun (2005)**
- Fun is the brain learning patterns. Through "chunking" and "grokking", the brain automates mastered patterns into routine. Once a pattern is automated it stops being a challenge, so a game that does not present its patterns in new ways becomes boring. Koster also says games that are too easy (nothing to learn) and too hard (no visible pattern) are both boring — [Game Studies wiki summary](https://game-studies.fandom.com/wiki/A_Theory_of_Fun_for_Game_Design?oldid=4071); [Shortform summary](https://www.shortform.com/summary/a-theory-of-fun-for-game-design-summary-raph-koster); [Obsidian reader notes](https://publish.obsidian.md/aidanhelfant/Literature+Notes/Readwise/%F0%9F%93%9ABooks/Theory+of+Fun+for+Game+Design)
- Koster holds that every game is destined to become boring once mastered. Other players (multiplayer) supply richer patterns than AI does. Note: this is from secondary summaries. The book itself was not consulted, and Ian Bogost and others criticise its focus on fun — [Game Studies wiki](https://game-studies.fandom.com/wiki/A_Theory_of_Fun_for_Game_Design?oldid=4074); [raphkoster.com essay](https://raphkoster.com/gaming/geekfun.shtml)

**Quantic Foundry Gamer Motivation Model**
- The model has 12 motivations in 6 clusters. The Action cluster is Destruction ("chaos, mayhem, guns, and explosives"; examples Call of Duty, Battlefield, Halo, Destiny 2) and Excitement (fast-paced, intense, surprising, adrenaline). Low Action scorers prefer calm, pausable games — [Gamer Motivation Model Reference (PDF)](https://quanticfoundry.com/wp-content/uploads/2019/04/Gamer-Motivation-Model-Reference.pdf); [Updated reference (PDF)](https://quanticfoundry.com/wp-content/uploads/2019/03/Gamer-Motivation-Model-Reference-Updated.pdf)
- The other clusters are Mastery (Challenge, Strategy), Achievement (Completion, Power), Social (Community, Competition), Immersion (Fantasy, Story) and Creativity (Design, Discovery). The sample is over 1.25 million gamers in older documents and over 1.75 million in a 2026 paper. The example games change between versions — [Gamer Motivation Model Reference (PDF)](https://quanticfoundry.com/wp-content/uploads/2019/04/Gamer-Motivation-Model-Reference.pdf); [GDC 2020 slides](https://quanticfoundry.com/wp-content/uploads/2020/08/GDC-2020-Slides-Player-Segments-Quantic-Foundry.pdf). (The main model page returned HTTP 403. The cluster list is from the reference PDF and search summaries.)

**Bungie: "30 seconds of fun" (Jaime Griesemer)**
- Griesemer says the line is usually misquoted to mean the opposite of what he meant. The documentary cut the second half, which was about varying the 30 seconds across environments, weapons, vehicles and enemy combinations, so that no 30 seconds of Halo plays the same way twice — [Engadget: Half-Minute Halo interview (2011)](https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html)
- Nested loops: a ~3-second loop sits inside a ~30-second loop (AI decisions such as where to stand, when to shoot, when to dodge a grenade), which sits inside a ~3-minute loop (mission design: reinforcements, retreats, encounter tactics) — [Engadget interview](https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html)
- Halo pushes back at the player with resistance that matches how hard the player pushes, and enemies back off when the player retreats to recover — [Engadget interview](https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html)
- The fuller documentary quote: if the core 30 seconds doesn't work, graphics and weapon effects won't save the game (a user-page transcription, so secondary) — [Halopedia user page](https://www.halopedia.org/User:Samuele_pagani)

**Schell's lenses and Swink's Game Feel (used as supporting lenses)**
- Schell's *Art of Game Design* contains about 100 "lenses", which are sets of questions. Lens #2 is Surprise, #3 is Fun, and the Lens of the Toy asks whether the core is fun to play with before goals are added — [CIRCA summary of Schell](https://circa.cs.ualberta.ca/index.php/CIRCA:The_Art_of_Game_Design_-_Jesse_Schell); [Ryan, Costello, Stapleton 2012, Lens of the Toy](https://meaningfulplay.msu.edu/proceedings2012/abstract.php?paperid=6)
- Swink defines game feel as "real-time control of virtual objects in a simulated space, with interactions emphasised by polish". Without polish the game works the same but is "less perceptually convincing and therefore less appealing" — [Designing Game Feel: A Survey (arXiv)](https://arxiv.org/pdf/2011.09201); [Liz England review](https://lizengland.com/blog/review-game-feel-by-steve-swink/)

### Inferences

**What MDA suggests for Meatgrinder.** The playtest is reporting at the aesthetic layer ("boring"), but the cause sits in the dynamics. The dominant dynamic is "kite in a circle, hold LMB". MDA's own shooter example (mechanics produce camping and sniping) is the warning that dominant behaviours come from mechanics. Infinite ammo + hold-to-fire + enemies that slow you in crowds + all-sides spawning probably produce one dominant dynamic: keep moving, keep firing. Name the target aesthetics explicitly, probably Challenge, Sensation, Fellowship and Fantasy (Quake's profile plus Fellowship for co-op). For each one, ask which current dynamic produces it. Fellowship and Challenge likely have no strong dynamic yet.

**What SDT/PENS suggests.** Competence is probably being met: tuned feel, burst deaths, crowd clearing. Autonomy ("no choices") and relatedness (co-op that is parallel play) are the likely gaps. Autonomy in PENS means meaningful choice of how to play: which tool, which route, which target. It does not mean more content. Relatedness needs players to matter to each other (see Key question 4).

**What flow suggests.** If friends never felt threatened (no deaths, no near-misses), challenge sat below skill, which leads to boredom. Chen's "active DDA" fits a co-op horde game well: let players opt into risk, for example by fighting an elite for a reward, pushing into a crowd for a bigger burst, or picking a harder arena path, instead of tuning difficulty invisibly.

**What Sid Meier suggests.** Count decisions per minute. If the answer to "what should I press now?" is always "LMB", there are zero interesting decisions. LMB vs RMB and the two cooldowns only become decisions if each is clearly better in different, readable situations, and if players understand that before they need it ("informed"). This matches the developer's own rule, "LMB/RMB attacks each situational". Meier's "double it or cut it by half" argues for bold changes between playtests over 5–10% tweaks.

**What Koster suggests.** An 8-minute run of the same enemy pattern is mastered in about 1–2 minutes. After that the brain has chunked "circle and shoot" and wants a new pattern. Each arena should add a pattern to learn (an enemy, a hazard, a rule), and the boss should break the learned pattern.

**What Quantic Foundry suggests.** Meatgrinder serves Destruction (gore, hordes, burst deaths) and some Excitement. "Fun guns like Borderlands" maps mostly to Destruction (more ways to blow things up) and to Achievement/Power (growing stronger). The current game has little Mastery-Strategy (choices) and little Power progression inside a run. The friends' Borderlands remark is a hint that Power/Strategy motivations are unmet. It does not literally mean "add loot".

**What "30 seconds of fun" suggests.** Meatgrinder may have a working 3-second loop (shoot, splatter) but a weak 30-second loop (no enemy that makes you change what you're doing) and a weak 3-minute loop (arenas that don't change the encounter shape). Halo's fix was varying the context of the same core loop: enemy combinations, terrain, objectives. That is cheaper than new guns.

### Gaps
- The full PENS questionnaire items (Przybylski, Rigby, Ryan 2010) were not retrieved. Their exact wording is not confirmed here.
- Sid Meier's GDC 2012 talk transcript was not accessible. The "no dominant option" criterion is second-hand.
- Koster's book and Chen's full thesis were not read directly, only summaries and an interview.
- Quantic Foundry's main model page returned HTTP 403. The PDFs were used instead.

## Key question 2: Why do shooters become boring, and how have games fixed it?

### Takeaway
Shooters get boring when one strategy dominates and players fall into it: one gun, one movement pattern, one safe spot. Players optimise the fun out unless the design makes the optimal play also the varied, risky, interesting play. Doom 2016 and Doom Eternal are the clearest fixes for a Doom-like. They tie resources to aggressive, varied actions and design enemies that counter the dominant tool.

### Cited Findings
- Soren Johnson's line, widely attributed to him: "Given the opportunity, players will optimize the fun out of a game." The original publication was not confirmed — [TheGamer](https://www.thegamer.com/players-optimize-fun-out-of-games); [itch.io post quoting Johnson](https://itch.io/post/740415)
- Johnson's "Water Finds a Crack" column: players find and keep using any loophole, and once they know an exploit they can't ignore it. Civ III examples are forest "lumberjacking" and infinite city sprawl. Players knew they were breaking the game but couldn't stop. Civ IV fixed sprawl with per-city maintenance that rises with city count — [Designer Notes: GD Column 17, Water Finds a Crack](https://www.designer-notes.com/?p=369)
- TheGamer pairs Johnson's line with Meier: designers must "protect the player from themselves" — [TheGamer](https://www.thegamer.com/players-optimize-fun-out-of-games)
- Doom Eternal (Hugo Martin, creative director): in Doom 2016 most encounters could be beaten with the super shotgun. "If one weapon is unbalanced, that takes away from everything else." Weapons were reworked to reward switching ("flick-switching"), though the team says it doesn't want to force every weapon — [Shacknews: Hell Razer, The Making of Doom Eternal (pp. 4, 8)](https://www.shacknews.com/article/116635/hell-razer-the-making-of-doom-eternal?page=4); [p. 8](https://shacknews.com/article/116635/hell-razer-the-making-of-doom-eternal?page=8)
- Martin: "When you're thinking, you're engaged; when you're not thinking, you're bored." Demons are framed as chess pieces, and the player should consider which weapon to use at all times. Quote as reported in coverage of Martin's previews. Which of the two pages carries it was not confirmed by full fetch — [Bethesda.net: Inside DOOM's brutally fast campaign](https://bethesda.net/en-AU/news/inside-doom's-brutally-fast-single-player-campaign); [Shacknews](https://www.shacknews.com/article/116635/hell-razer-the-making-of-doom-eternal?page=4)
- Doom Eternal's resource loop: chainsaw for ammo, glory kill for health, flame belch for armor ("aggressive resource management"). The player's question becomes which resource this demon should yield to kill the next one faster — [Game Developer: The aggressive resource management of Doom Eternal](https://gamedeveloper.com/design/the-aggressive-resource-management-of-i-doom-eternal-i-); [Bethesda.net](https://bethesda.net/en-AU/news/inside-doom's-brutally-fast-single-player-campaign)
- Counter-enemies: the Carcass's shields block paths and glory kills, and fighting it up close makes the rocket launcher self-damaging, which pushes players to other weapons — [CogConnected](https://cogconnected.com/feature/12-things-love-doom-eternal/); [PCGamesN demons video](https://www.pcgamesn.com/doom-eternal/demons-video)
- Doom 2016 "push-forward combat": the design discourages hiding in cover or resting to heal. Health comes from killing (glory kills), and AI flanks so cover only works for a second. Critics frame this as intent. No developer quote saying so was found — [Louder Sound review](https://loudersound.com/features/doom-review-ps4); [Doom 2016 Wikipedia mirror](https://kaweah.freedombox.rocks/kiwix/wikipedia_en_all_maxi_2023-10/Doom_4); [Bloody Disgusting retrospective](https://bloody-disgusting.com/video-games/3951214/a-decade-of-ripping-and-tearing-how-doom-2016-revived-the-series/)
- Left 4 Dead built enemies to break specific dominant behaviours. The Hunter exists to "outrun and kill stragglers and lone wolf players". The Smoker pulls apart tightly grouped teams. The Boomer breaks the rule of "shoot everything that moves", forcing players to think before firing. The Witch does the same with higher contrast. Boss Infected "break Survivor team out of their familiar pattern of behavior" — [Booth, Replayable Cooperative Game Design: Left 4 Dead (GDC 2009)](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- Special Infected were added because they bring "variation to the homogeneity/predictability of battling the horde" — [Booth GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- L4D's "grabby" common infected stop Survivors when they hit, which makes even one infected dangerous and enforces sticking together without heavy-handed rules — [Booth GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)

### Inferences
- **"Holding the mouse button" is a dominant strategy.** Infinite ammo removes the only reason classic Doom players switched weapons. Doom Eternal's lesson is not "add ammo". It is to make each tool the best answer to a specific, readable enemy or situation, and to make the reward for using it visible. For Meatgrinder: each class's RMB and two cooldowns should each have at least one enemy or situation where they are clearly the right answer (counter design, as with the Carcass).
- **Kiting is probably the Meatgrinder equivalent of cover-camping.** If circling the arena perimeter is safe and good enough, players will do it and get bored ("water finds a crack"). Doom 2016's answer was to make the reward (health, resources) sit in the dangerous place. A horde-game analogue is to drop resources such as health or cooldown refunds from kills inside the crowd or from elites, so diving in is rewarded. Several sources describe Doom's design as discouraging "safe" play; none of them covers kiting in horde games directly.
- **Low skill ceiling.** If a top player and a new player both hold LMB and circle, the skill ceiling is flat. Skill expression in Doom Eternal comes from weapon-switch combos, resource routing and target priority. Meatgrinder's equivalents could be ability combos across classes, timing a burst into a dense crowd, and target priority on elites.
- **No stakes.** If the team never fails an arena, nothing is at risk. L4D's incapacitation and rescue mechanic makes risk visible and shared (see Key question 4).

### Gaps
- I found no primary source specifically on kiting as a dominant strategy in horde shooters (Vampire Survivors-like, Serious Sam, Killing Floor). The inference above is by analogy.
- The original Soren Johnson publication of "optimize the fun out" was not located.
- No primary id Software developer quote confirms that glory kills were designed specifically against cover-camping. That framing comes from reviewers.

## Key question 3: Pacing and variety: intensity curves, rest/peak, novelty rate, set pieces

### Takeaway
Constant combat is tiring and long lulls are boring. Peaks and valleys are what make a session memorable. Left 4 Dead encodes this in an explicit algorithm (Build Up, Sustain Peak, Peak Fade, Relax at 30–45 s). Half-Life 2 introduces each new element in a controlled setting, lets the player practise it, then escalates it. An 8-minute Meatgrinder run at uniform high intensity will feel flat even if every second is busy.

### Cited Findings
- Valve's L4D pacing was inspired by Counter-Strike's "spiky" rhythm: "Constant, unchanging combat is fatiguing", "Long periods of inactivity are boring", and unpredictable peaks and valleys create "a powerfully compelling and replayable experience" — [Booth, The AI Systems of Left 4 Dead (2009)](https://cdn.fastly.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)
- Adaptive Dramatic Pacing algorithm: estimate each Survivor's "emotional intensity" and track the maximum across all four. If it is too high, remove major threats for a while. Otherwise create an interesting population of threats — [Booth AI Systems](https://cdn.fastly.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)
- Intensity rises in proportion to damage taken, on incapacitation, on being pulled or pushed off a ledge, and when nearby infected die (inversely proportional to distance). It decays toward zero over time, but does not decay while infected are actively engaging the survivor — [Booth AI Systems](https://cdn.fastly.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)
- The phases: **Build Up** spawns the full threat population until intensity crosses the peak threshold. **Sustain Peak** holds it for 3–5 s after the peak. **Peak Fade** switches to minimal population and waits for a natural break. **Relax** keeps minimal threats for 30–45 s, or until survivors travel far enough, then Build Up resumes. During Relax there are no wanderers until the team is "calm", no mobs and no new specials. Boss encounters are not affected by adaptive pacing, because they are "intended to change up the pacing anyhow" — [Booth AI Systems](https://cdn.fastly.steamstatic.com/apps/valve/2009/ai_systems_of_l4d_mike_booth.pdf)
- "Dramatic Anticipation": set up moments where event X implies an interesting event Y after a short delay, because "anticipation of imminent reward/punishment is very powerful". Examples: Boomer bile (mob incoming, with music and a screen effect), Tank music and distant footsteps, Witch sobbing, crescendo events starting with a shrieking crowd in the distance, car alarms — [Booth, Replayable Cooperative Game Design](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- "Structured Unpredictability": "Low probability + High drama = Memorable". Designers should resist wanting every moment experienced every run. Set up many possible moments, knowing few will happen in any one run — [Booth GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- Valve's GDC 2011 biofeedback experiments: an L4D2 Director variant that adjusted spawns and pickups based on estimated arousal was rated twice as enjoyable in post-playtest surveys (reported figure, small internal study) — [Shacknews: Valve details biofeedback experiments](https://www.shacknews.com/article/79056/valve-details-experiments-with-biofeedback); [GDC Vault free Valve biofeedback talk](https://gdconf.com/news/gdc_vault_adds_free_valve_biof)
- Halo's 3 s / 30 s / 3 min nested loops, and varying the same core across enemies, vehicles and terrain — [Engadget Griesemer interview](https://www.engadget.com/2011-07-14-half-minute-halo-an-interview-with-jaime-griesemer.html)
- Half-Life 2 level design: each level between loads "has a theme or a purpose", introduces the entities it will use and gives the player time to get familiar with them. Example: Point Insertion introduces Combine soldiers and scanners. Ravenholm opens with a gentle Gravity Gun intro (playing with Dog), then uses it in combat so players learn what it can and can't affect — [Valve Developer Wiki: Half-Life 2 level design](https://developer.valvesoftware.com/wiki/Half-Life_2_level_design)
- The late twist: the Gravity Gun gets a dark-energy upgrade in the penultimate level and works on organic targets (commentary, not Valve's stated intent) — [WhatCulture](https://whatculture.com/gaming/10-awesome-video-game-mechanics-introduced-way-too-late)
- "Sectional" design: HL2 levels alternate shooter, exposition, transitional and puzzle sections so the player's activity keeps changing (critic analysis) — [Game Developer: sectional game design](https://www.gamedeveloper.com/design/the-moments-that-define-us-or-a-look-at-sectional-game-design-)
- Intensity-curve design is discussed in [Game Developer: Using intensity to drive player engagement](https://www.gamedeveloper.com/design/using-intensity-to-drive-player-engagement). Not read in full.

### Inferences
- **An 8-minute run needs about 4–6 peaks with real valleys between them.** Using L4D's numbers (3–5 s sustained peak, 30–45 s relax), an 8-minute run could hold roughly 5–7 build/peak/relax cycles. Currently, spawning from all sides at all times is closer to "constant, unchanging combat", which Booth calls fatiguing. Relax periods also give players time to talk, look at the arena, and notice what they're about to face (anticipation).
- **Anticipation is cheap and missing.** Audio stings and distant roars before a big wave, a visible gate opening, an elite's arrival cue. These turn "more enemies" into an event. L4D got much of its drama from the 3–10 seconds before the threat arrived.
- **Novelty rate.** With 3 arenas + boss in ~8 min, a natural structure is introduce, develop, twist, test: arena 1 introduces the base horde and one elite, arena 2 adds a new enemy or rule and mixes it with the first, arena 3 puts a twist on both (e.g. a hazard or a "don't shoot everything" enemy), and the boss breaks the learned pattern. That gives a new pattern roughly every 2 minutes, which fits Koster's boredom-on-mastery model.
- **"Don't shoot everything" enemies are the cheapest way to add decisions to hold-to-fire.** The Boomer and the Witch exist for exactly this reason, and they directly answer "only holding the mouse button". Example ideas: an exploder that should be killed at range, or an enemy that is harmless unless shot. (This clashes with the scope-discipline memory: confirm with the user before adding enemies.)
- **Structured unpredictability across runs.** Rare elites, rare arena events, varied wave mixes. Not every run should contain every set piece.

### Gaps
- No primary Valve document states "introduce, develop, twist" as a formal rule. It is a synthesis of HL2 examples. (Nintendo's "kishōtenketsu" level structure is often cited for this idea but was not researched here.)
- No authoritative "new mechanic every N minutes" figure from a studio was found. Any specific interval is an inference.
- The Game Developer intensity article was not read in full.

## Key question 4: Social fun in co-op: shared moments, interdependence, communication

### Takeaway
Co-op becomes social fun when players need each other: one player's danger is another's chance to be the hero, and the game produces shared stories. Left 4 Dead's playbook is to require cooperation through enemy design (pinning and incapacitating attacks), helplessness, scarce shared resources, and automatic voice callouts, without artificial leashes. If four Meatgrinder players could each solo their side of the arena, the co-op is parallel play and relatedness (SDT) is not being met.

### Cited Findings
- L4D strategy: "Ensure cooperation is the only winning strategy", "Treat entire Survivor team as 'the player'", "Penalize non-cooperative behavior harshly" (abandoning the team means death), but "Avoid artificial/arbitrary enforcement". Players rebel against invisible leashes, teleporting stragglers and out-of-bounds damage — [Booth, Replayable Cooperative Game Design (GDC 2009)](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- The horde is "Obviously too many enemies for one Survivor to handle alone", and this enforces cooperation implicitly because it fits genre expectations — [Booth GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- Incapacitating attacks make players fear separation and "Give players near the incapacitated victim the opportunity to be the hero and save them". "Players really enjoy helping each other" — [Booth GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- Helplessness: a player in a clearly helpless, dependent state demands cooperation, and it's "Obvious that you will likely be in a similar situation soon". Limited required resources with minimal sharing UI encourage cooperation — [Booth GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- Automatic vocalizations improve situational awareness ("Behind you!", "Hunter's got Zoey!", "Witch!", "Here they come!", "Grenade!"), communicate short-term goals, and build "a baseline of camaraderie" ("Thanks for that", "Don't worry I got ya") — [Booth GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- Combinations of randomized events generate memorable stories — [Booth GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- MDA: Fellowship is encouraged by sharing information across team members or by win conditions "more difficult to achieve alone" — [MDA paper](https://users.cs.northwestern.edu/~hunicke/MDA.pdf)
- SDT: in the multiplayer study, relatedness independently predicted enjoyment and future play — [Ewha abstract](https://pure.ewha.ac.kr/en/publications/the-motivational-pull-of-video-games-a-self-determination-theory-/)
- Koster: other players are a richer source of patterns than AI, which is why multiplayer games last longer (secondary summary) — [Game Studies wiki](https://game-studies.fandom.com/wiki/A_Theory_of_Fun_for_Game_Design?oldid=4074)

### Inferences
- **Interdependence test for Meatgrinder.** Would the run go about as well if each player played alone in a corner? If yes, co-op adds nothing. Possible levers, all inside the existing premise: a "caught in the crowd" state where a teammate's AoE frees you (Meatgrinder already slows players in crowds, so this could escalate into a pin that needs a rescue); class abilities that combo across players (one groups enemies, another bursts them); elites that need two angles; a downed-and-revive mechanic. Note that slowing in crowds is a solo punishment today. L4D's lesson is to turn such punishments into rescue opportunities.
- **Communication without voice chat.** Automatic callouts ("Elite left!", "I'm caught!", "Ultimate ready") plus a ping are cheap in a browser game and directly address shared moments. They also add character, which supports Fantasy.
- **Shared stories need low-probability, high-drama events**, such as a last-second rescue or a rare elite. The run-end score sheet and kill streaks (already specced in the latest commit) support comparison and story ("you saved me 4 times").
- **Avoid leashes.** Don't force grouping with invisible walls or damage. Use enemy design that makes straggling dangerous (like the Hunter).

### Gaps
- No sources were collected on Deep Rock Galactic, Vermintide or Helldivers 2 co-op design (pings, friendly fire as social comedy). These are probably covered by another researcher.
- No quantitative data was found on how much callouts or pings increase perceived fun.

## Key question 5: Fantasy, theme, feedback and atmosphere

### Takeaway
A strong player fantasy tells players which behaviour the game wants. Doom's "Slayer" fantasy is matched by mechanics that reward aggression. Sensory polish (Swink) makes the same mechanics feel more convincing, but every source agrees polish can't rescue a core loop without decisions. Meatgrinder has invested in feel. The remaining fantasy work is making the mechanics demand the fantasy's behaviour, and giving each class a fantasy that implies distinct choices.

### Cited Findings
- MDA lists Fantasy ("game as make-believe") and Sensation ("game as sense-pleasure") as distinct aesthetics. Quake's profile includes both — [MDA paper](https://users.cs.northwestern.edu/~hunicke/MDA.pdf)
- Doom 2016's push-forward combat makes the fantasy mechanical: standing still gets you killed, and moving forward keeps you alive (review framing) — [Gamegeeker review](https://gamegeeker.com/games/doom-379720/review?country=US); [Louder Sound](https://loudersound.com/features/doom-review-ps4)
- Doom Eternal: glory kills give a temporary speed boost that can be chained, which turns the power fantasy into a movement loop (pre-release preview) — [Bethesda.net](https://bethesda.net/en-AU/news/inside-doom's-brutally-fast-single-player-campaign)
- Swink: polish (animation, sound and effects in harmony with input-driven motion) makes interactions "perceptually convincing". The functionality is unchanged without it, but the game is less appealing — [Designing Game Feel survey](https://arxiv.org/pdf/2011.09201); [Liz England review](https://lizengland.com/blog/review-game-feel-by-steve-swink/)
- SDT 2006: competence and autonomy were associated with intuitive controls and presence/immersion — [Ewha abstract](https://pure.ewha.ac.kr/en/publications/the-motivational-pull-of-video-games-a-self-determination-theory-/)
- Griesemer: graphics and weapon effects can't save a game whose core 30 seconds doesn't work (secondary transcription) — [Halopedia user page](https://www.halopedia.org/User:Samuele_pagani)
- L4D uses the survival-horror genre's well-known "rules" (good guys stick together, jerks abandon the group and die) so that players already understand the cooperation fantasy — [Booth GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ReplayableCooperativeGameDesign_Left4Dead.pdf)
- Sid Meier: research and theme work because players already know the basics, and "the player shouldn't have to read the same books the designer has read". Players must always be the star — [Game Developer: Meier lessons](https://www.gamedeveloper.com/pc/analysis-sid-meier-s-key-design-lessons)
- Quantic Foundry's Immersion cluster (Fantasy, Story) is separate from Action. Destruction scorers value guns, explosions, gore and destructible environments — [QF reference PDF](https://quanticfoundry.com/wp-content/uploads/2019/04/Gamer-Motivation-Model-Reference.pdf)

### Inferences
- **The fantasy should prescribe the decision.** If a class's fantasy is "the one who pins the horde" or "the one who dives in", its kit and the enemies should make that behaviour the right call in certain moments. Then choosing to act in character is a decision, not decoration. The friends' "Borderlands guns" remark is likely about distinctive, memorable weapon identities (Sensation + Fantasy + Destruction). The developer's planned "distinctive guns" fit here, as long as each gun changes what the player does, not only how it looks.
- **Use genre rules.** Doom players already know "keep moving, aggression is rewarded, big demons are threats". Make elites and specials read instantly by silhouette and sound (this matches the HUD-readability memory) so that the player's decision ("that's the one I must kill first") follows from the theme.
- **Polish multiplies; it doesn't create.** Further feel tuning on the current loop is likely to have diminishing returns until decisions exist.

### Gaps
- No primary id Software statement on the Doom Slayer power fantasy and its design intent was retrieved, only reviews and previews.
- No research was found quantifying how much audio-visual atmosphere contributes to perceived fun separately from mechanics.

## Key question 6: Prototyping and playtesting for fun: how studios find the fun and diagnose boredom

### Takeaway
Valve's model is to treat designs as hypotheses and playtests as experiments, to aim tests at fun (not balance or bug-finding), and to trust what players do over what they say. Supercell shows the cultural side: kill projects that don't hit the bar and celebrate what was learned. For a small team the most useful tools are silent observation, short structured surveys with forced choices, a few logged stats, and one design question per playtest.

### Cited Findings
- Valve: "Goal is a fun game. Game designs are hypotheses. Playtests are experiments. Evaluate designs off playtest results. Repeat." The playtesting goal is "Fun. Not bug testing. Not game balancing. DEFINITELY not focus testing." — [Ambinder, Valve's Approach to Playtesting (GDC 2009)](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ValvesApproachToPlaytesting.pdf)
- Valve philosophy: "Get data early, get data often. Iterate constantly." "We don't know what's best (players do)." Playtesting continues after ship (stats, forums, fan feedback) — [Ambinder GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ValvesApproachToPlaytesting.pdf)
- Direct observation: "Importance of what people do--not what they say". Have a design goal for each test. Observers' presence can bias results, and a salient event can slant interpretation. "Nothing beats direct gameplay observation" — [Ambinder GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ValvesApproachToPlaytesting.pdf)
- Think-aloud gives a real-time view of motivations and works for "why" questions, but it distorts play. In Q&A, "People don't know why they do what they do", group biases apply (anchoring, social pressure), and questions can be leading. Valve's order is survey first, then individual Q&A, then group Q&A — [Ambinder GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ValvesApproachToPlaytesting.pdf)
- Surveys: standardized, forced-choice questions reduce bias and reveal preference. Valve's examples are per-enemy challenge ratings on a 1–7 scale and rank-ordering 12 weapons from most to least liked. The downside is lost nuance — [Ambinder GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ValvesApproachToPlaytesting.pdf)
- Stats: deaths, level times, friendly fire, death heatmaps (TF2 Dustbowl). The caveats are that "Averages hide extreme examples" and that you can see "illusory" patterns. Design experiments compare two or more conditions to test a hypothesis — [Ambinder GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ValvesApproachToPlaytesting.pdf)
- The valence/arousal model (Lang 1995) separates bored or fatigued (low arousal, negative) from excited or angry (high arousal) — [Ambinder GDC 2009](https://cdn.fastly.steamstatic.com/apps/valve/2009/GDC2009_ValvesApproachToPlaytesting.pdf)
- HL2: Valve's Doug Lombardi described "Playtesting, playtesting, playtesting" and simple "orange map" layouts for pathing and playtesting from the start — [Shacknews: Half-Life 2 interview (2004)](https://www.shacknews.com/article/28100/half-life-2-interview)
- Supercell: during Clash Royale's development and launch it cancelled nine other projects, some far along. Smash Land was popular internally but killed for missing company goals. CEO Ilkka Paananen says the company celebrates the learning, not the failure itself — [PocketGamer.biz: 5 lessons from Paananen's BAFTA lecture](https://www.pocketgamer.biz/feature/63901/5-lessons-from-ilkka-paananens-bafta-games-lecture/); [GamesBeat: How Supercell kills its darlings](https://gamesbeat.com/?p=130961)
- Supercell recently shut down Squad Busters about two years after release ("we were wrong") — [Game World Observer](https://gameworldobserver.com/2025/10/30/we-were-wrong-supercell-to-shut-down-squad-busters-two-years-after-games-release)
- Meier's "double it or cut it by half": make big changes to get clear feedback — [Game Developer: Meier lessons](https://www.gamedeveloper.com/pc/analysis-sid-meier-s-key-design-lessons)
- Schell's lenses are question sets used to examine a design from one angle (e.g. Surprise, Fun, Toy) — [CIRCA](https://circa.cs.ualberta.ca/index.php/CIRCA:The_Art_of_Game_Design_-_Jesse_Schell)

### Inferences

**Post-playtest diagnostic checklist (derived from the frameworks above; applies to any Meatgrinder build)**

*Observe silently (what players do, not what they say). Per player, note the following:*
1. **Input monotony:** what share of the time is LMB held? How often is RMB used, and are cooldowns used as soon as they're ready (no decision) or saved for a moment (a decision)?
2. **Dominant pattern:** does movement collapse into one pattern (perimeter circling, backpedalling)? How many minutes in does it appear? (Koster: mastery leads to boredom.)
3. **Near-misses:** count moments where a player nearly died or the team nearly lost. Zero means challenge is below skill (flow).
4. **Spontaneous speech:** count unprompted callouts, laughs, swears and "did you see that". Silence in the second half of the run is a strong boredom signal (relatedness, Fellowship).
5. **Help events:** how often did one player's action save or enable another? Zero means parallel play.
6. **Lean-back moments:** when do players lean back, look away or chat about other things? Note the arena and minute.

*Ask (survey first, alone, before group discussion, per Valve). Use forced choice where possible:*
7. Rank the 4 classes, and separately each class's LMB, RMB and abilities, from most to least liked. (Forced ranking surfaces dead tools.)
8. Rate each enemy type 1–7 for challenge and 1–7 for "made me change what I was doing".
9. "Name one moment from the run you'd tell a friend about." No answer means no peaks or stories (Booth: low probability + high drama = memorable).
10. "When did you last make a choice that you weren't sure was right?" (Meier: informed, impactful choices.)
11. "Was there ever a moment you needed a teammate?" (SDT relatedness; L4D interdependence.)
12. "At what point did it start feeling the same?" Ask for a minute or arena (novelty rate).
13. PENS-style 1–7 ratings of three statements: "I felt competent", "I had freedom to play my way", "I felt connected to my teammates". (The wording is a paraphrase of SDT constructs, not the validated PENS items.)

*Log (cheap stats):*
14. Per-run timeline of kills/sec and damage taken/sec, to see whether there are peaks and valleys or a flat line (L4D intensity model).
15. Ability use and per-weapon damage share per class. If one input deals more than about 80% of damage, it is dominant (Doom super shotgun problem). The threshold is a heuristic, not a sourced figure.
16. Death and damage positions per arena (heatmap). Look for a single safe kiting lane.
17. Distance between players over time, to tell whether they play together or apart.

*Design-review questions (MDA, Meier, Griesemer):*
18. For each target aesthetic (Challenge, Sensation, Fellowship, Fantasy), which dynamic produces it now? Which has none?
19. What is the dominant strategy, and which enemy, situation or reward makes it wrong at least sometimes?
20. Does each arena add one new pattern, and does the boss break the learned pattern?
21. Where are the valleys? Is there an anticipation cue before each peak?
22. Is the reward (health, cooldown, score) in the risky place or in the safe place?
23. Does each class's fantasy imply a decision that differs from the other classes?

*Process:*
- One hypothesis per playtest (e.g. "a 'don't-shoot' enemy will cut LMB-hold time and add callouts"). Change it boldly (double it or cut it by half), then measure items 1, 4, 9 and 15 again.
- Use a crude grey-box prototype for a new decision mechanic before art (Valve's orange maps). Drop features that don't move the boredom signals (Supercell).
- Playtest before benchmarking, as the developer already does.

### Gaps
- No primary source was found for Supercell's prototype-stage playtest method or for the phrase "find the fun". The Supercell findings are about killing projects after soft launch.
- Ambinder's GDC 2011 biofeedback talk was not read in full. The "twice as enjoyable" figure is reported by press.
- The validated PENS item wording was not retrieved. Item 13 is a paraphrase and should not be presented as the official PENS scale.
