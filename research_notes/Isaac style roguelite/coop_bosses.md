# Co-op boss design for action games and FPS (input for Meatgrinder boss specs)

Context read first: [docs/rogue/brief.md](../../docs/rogue/brief.md) (bosses: distinctive, multi-move, test movement, aiming and teamwork) and [docs/heavens.md](../../docs/heavens.md) (Gatekeeper: Judgment hits everyone who can see it; Twin Wardens: kill both within 10 s; Grace: three heads in any order; Collector: armor from nearby kills; Serene: "Be still"; Grand Inquisitor: burn him in a Tomb; Lamb: shoot horns to shrink a grove; Recording Angel: beams where players stood 5 s ago; Seraph: wingbeats and a freezing gaze).

Source-quality note: the developer-primary material found is thin (Bungie interviews via press, the Fatshark bot dev blog, Housemarque interviews). Most numbers come from community wikis (Deep Rock Galactic, Hades, Doom, Isaac, Destiny) and are marked as such. No GDC talk transcripts on boss design could be fetched (the GMTK Cuphead transcript returned 403; the PC Gamer Marauder interview and Bethesda "Designing Demons" page had no readable body).

## 1. Boss structure: phases, HP thresholds, escalation, enrage, fight length

### Takeaway
Bosses in the reference games are built as 2–3 HP-threshold phases (50%, or 66%/33%), with each threshold adding or changing an attack, summoning adds, or making the boss briefly invulnerable. Co-op shooter bosses (Deep Rock Galactic's Hiveguard, Doom's Icon of Sin) instead use a repeating cycle: break defences, then a short damage window, then reset. No reliable source gives fight-length targets; the one figure found is a rough 5–10 minute first-clear consensus from a podcast.

### Cited Findings
- Hades, Theseus: at 50% HP he calls a random god's Olympian Aid, and the spell pattern depends on the god he picked. On Extreme Measures 3 his chariot breaks at 33% HP (4000) instead, he reverts to default attacks and becomes invulnerable briefly before phase 2 — [Hades Wiki (old revision)](https://hades.fandom.com/wiki/Theseus?oldid=9683); [Prima Games](https://primagames.com/gaming/hades-boss-guide-theseus-and-minotaur-asterius)
- Hades, Theseus and Asterius: kill order matters. If Asterius dies first, Theseus enrages (moves and attacks faster) and loses his Charge attack — [Hades Wiki](https://hades.fandom.com/wiki/Theseus?oldid=9683)
- Hades, Bone Hydra: at 66% HP it becomes immune and summons 3 skeletal heads at the arena edges; at 33% it summons 6; the main body can't be damaged until those heads die. Sources conflict (Villains Wiki says "four extra heads after each third"; Twinfinite describes a shield phase) — [Prima Games](https://primagames.com/gaming/hades-boss-guide-lernaean-bone-hydra); [Villains Wiki](https://villains.fandom.com/wiki/Bone_Hydra); [Twinfinite](https://twinfinite.net/guides/hades-beat-hydra-boss/)
- Hades Extreme Measures (the heat modifier) changes boss movesets. EM3 Asterius slams up to 3 times with a large shockwave on impact and gains a tracking axe spin after a brief windup — [Hades Wiki](https://hades.fandom.com/wiki/Theseus?oldid=9683)
- Deep Rock Galactic, Dreadnought Hiveguard, a repeating 3-stage cycle: (1) immune while Sentinel adds live; the Sentinels leave slowing goo pools when they die; (2) it exposes 3 glowing protrusions (2 on the legs, 1 on the back), gains ×1.4 movement speed, and its mortar becomes a 3-shot barrage; (3) it stops moving (it can still turn), and its shell opens so the main HP pool can be damaged. The shell closes after a time or a damage amount, and the cycle restarts — [DRG Wiki: Hiveguard](https://deeprockgalactic.wiki.gg/wiki/Glyphid_Dreadnought_Hiveguard); [Gamepur](https://www.gamepur.com/guides/how-to-defeat-the-dreadnought-hiveguard-in-deep-rock-galactic)
- The Hiveguard's damage window was described as "30 seconds or so" — [PC Gamer](https://www.pcgamer.com/uk/deep-rock-galactics-new-biome-update-makes-now-a-great-time-to-hit-the-mines)
- Doom Eternal, Icon of Sin, two phases. Phase 1 has 8 armor targets (both pectorals, both shoulders, both hands, the abdomen, the head); shooting a part already stripped of armor does nothing; the Icon moves faster and more aggressively as parts break, so the hands (which move most) should be taken early. Phase 2 moves to a second arena where the flesh is destroyed, and minion spawns become much more aggressive — [DoomWiki: Icon of Sin](https://www.doomwiki.org/wiki/Icon_of_Sin_(Doom_Eternal)); [Shacknews](https://www.shacknews.com/article/117086/icon-of-sin-boss-fight-doom-eternal)
- Furi has many phases, one per life square. Finishing a phase restores the player's HP to 100%; dying mid-fight resets the boss's current phase to 100%. Phases alternate between free-form fighting, bullet-hell segments and melee duels, and bosses change tactics over the fight — [buttonmusher review](https://buttonmusher.substack.com/p/furi-review-gameplay-perfected); [TheSixthAxis](https://www.thesixthaxis.com/?p=267101)
- GMTK on Cuphead: phases keep a fight fresh where "a million health points" would make it dull; they add surprise; players learn which attack sets belong to which phase (Ribby and Croak: flies and punches, then a slot-machine phase with three dodge minigames) — [GMTK via Amara listing](https://amara.org/v/C3BEq); [TheTVDB episode](https://thetvdb.com/series/game-makers-toolkit/episodes/6374015)
- Blood Prince Council (WoW): three princes share one HP bar, but only the empowered prince takes damage; the other two sit at 1 HP and can't be killed. Empowerment rotates (Wowhead's CN guide says every 45 s; Icy Veins says it follows a randomly moving orb) — [Engadget](https://www.engadget.com/2010-02-19-ready-check-blood-princes.html); [Icy Veins](https://icy-veins.com/wotlk-classic/blood-prince-council-encounter-guide-strategy-abilities-loot); [Wowhead](https://www.wowhead.com/wotlk/cn/guide/raids/icecrown-citadel/blood-prince-council-strategy)
- Twin Val'kyr (WoW): a shared HP pool. If the raid fails to break the shield and interrupt Twin's Pact, the twins heal 20% of max HP (Normal) or 50% (Heroic), which stops a mindless burn — [Engadget](https://www.engadget.com/2009-10-15-ready-check-twin-valkyr.html); [Warcraft Tavern](https://warcrafttavern.com/wotlk/guides/twin-valkyrs-strategy-guide-toc-25)
- Fight length: a boss-design podcast cites a rough consensus of 5–10 minutes for a first-time clear (not roguelite-specific). An indie dev planned a 3–5 minute boss and found that travel time stretched it — [HellHades Godforge podcast](https://hellhades.com/godforge/news/godforge-podcast-what-makes-great-boss-fights/); [itch.io post](https://itch.io/post/11973481)
- Short-session roguelites target runs of around 30 minutes or less — [Two Average Gamers](https://www.twoaveragegamers.com/best-roguelikes-short-sessions/)
- RoR2's teleporter event (the boss fight plus a charge) lasts 90 s on Drizzle/Rainstorm and 120 s on Monsoon, and difficulty rises every minute (one tier every 9/4.5/3 min by difficulty) — [RoR2 Wiki: Difficulty](https://riskofrain.wiki.gg/wiki/Difficulty)

### Inferences
- **Phase count:** 3 phases at 66%/33% (Hydra style) suits the Gatekeeper-tier bosses; heaven 1 could use 2 phases at 50% (Theseus style) as a gentler intro. Each threshold should add exactly one new move or one new rule. This fits the "one readable rule" design rule in heavens.md.
- **A brief invulnerability at each threshold** (Theseus at 33%) gives a clean 1–2 s beat to play the phase-change VFX and audio, and stops burst damage from skipping a phase. Recommended in Meatgrinder: about 1.5 s invulnerable, with a full-arena shockwave or a feather burst as the "new phase" signal.
- **Break-then-burn cycles** (the Hiveguard: kill the adds, break 3 weak points, then a timed damage window) map directly onto heavens.md bosses: the Lamb (shoot 7 horns, then it turns aggressive), the Collector (the armor breaks, then a window), Grace (the heads). The cycle gives a horde-FPS fight the "valleys and peaks" the brief says are missing.
- **The kill-order rule** (Asterius dying first enrages Theseus) is the exact pattern for Grace's heads ("each order plays differently"), and a cheap way to make one boss feel different across runs.
- **A shared HP pool with a punishment** (the Twin Val'kyr heal 20%/50% on a failed interrupt) is a softer alternative to the Twin Wardens' hard "revive after 10 s": the revived twin could return at 50% HP instead of full, so a failed sync costs time, not the run. This is better for solo and bots.
- **Furi-style HP restore on a phase clear** is too generous for a co-op roguelite, but a small heal pickup or a guaranteed item drop at each threshold gives the same "reset breath" and feeds the brief's item system.
- **Fight-length target (inference, unsourced for roguelites):** in Meatgrinder, about 2–3 minutes for the heaven 1–3 bosses, rising to 4–5 for heavens 7–9. These are below the 5–10 minute consensus because the run also contains many horde rooms, and RoR2's teleporter event is only 90–120 s. Specs should state target time-to-kill at a reference party DPS, then tune the HP to it.
- **Enrage timer:** none of the sources found use hard enrage timers in roguelites. RoR2's rising difficulty clock and Furi's phase reset show soft pressure instead. Meatgrinder: rather than a wipe timer, escalate add spawns after a target time (for example, +25% spawn rate per 30 s over the target), so slow solo players are pressured without a hard fail.

### Gaps
- No primary source (GDC talk, dev blog) giving fight-length targets for Isaac, Hades, Gungeon, Gunfire Reborn or RoR2 bosses. Isaac boss HP values by floor weren't retrieved.
- Destiny strike boss and Borderlands raid boss phase or HP data weren't found.
- Doom Eternal's Marauder design talk (Hugo Martin) couldn't be read in full; only secondary summaries are available (see section 3).

## 2. Telegraphs and readability

### Takeaway
The consistent rules: a visible wind-up animation or flash before the hit; a colour that means "vulnerable now"; positional audio for where projectiles spawn; high-contrast bright projectiles against a darker background; and a "no hiding behind geometry" rule only when the fight is about something else. Bullet hell in 3D (Returnal, Furi) leans on bright, glowing, high-contrast projectiles and a clear tell before patterns.

### Cited Findings
- Doom Eternal, Marauder: during the melee wind-up its eyes flash green, and it's briefly vulnerable. Its shield blocks most fire otherwise (splash damage still gets through), and it turns toward BFG shots, leaving its back open — [PC Gamer guide](https://pcgamer.com/how-to-kill-doom-eternal-marauder-tips-fight); [GameSpot guide](https://gamespot.com/articles/doom-eternal-marauder-boss-guide-how-to-kill-the-g/1100-6475129/); [DoomWiki: Marauder](https://www.doomwiki.org/wiki/Marauder)
- Hugo Martin (Doom Eternal director, via press): the Marauder is a "black belt" demon that plain run-and-gun won't beat. Its stagger lasts long enough for one shot with most weapons, but two if the player weapon-swaps — [Unwinnable](https://unwinnable.com/?p=100970); [PC Gamer interview](https://www.pcgamer.com/au/doom-eternals-director-says-the-marauder-is-good-actually) (body not retrievable; claims as summarised by search)
- Icon of Sin telegraph: when it raises its fists it will slam at the player's position, so dash away — [DoomWiki](https://www.doomwiki.org/wiki/Icon_of_Sin_(Doom_Eternal))
- Returnal (Housemarque): the guiding question was how much can be on screen and still be "readable at a glance". Enemies use deep-sea, bioluminescent, bright high-contrast neon against a darker background; the team set no hard cap on effects — [MCV: When We Made Returnal](https://mcvuk.com/business-news/when-we-made-returnal/)
- Returnal: players must read enemy animations to see attacks forming, since a roguelike has little room for failure (Mikael Haveri) — [Red Bull interview](https://www.redbull.com/in-en/returnal-housemarque-developer-interview)
- Returnal: 3D audio is used to pinpoint where an enemy or a bullet pattern just spawned — [Push Square interview](https://www.PushSquare.com/news/2021/02/interview_returnal_ps5_developer_housemarque_talks_story_replayability_and_value)
- Moving from 2D to 3D made the fast arcade action harder to keep readable, and Housemarque relied on simple, consistent design — [Game Developer](https://www.gamedeveloper.com/marketing/a-third-person-action-roguelike-bullet-hell-arcade-thriller-the-making-of-returnal)
- Furi: most bullets can be parried, dodged or shot down; bullet-hell phases are inspired by twin-stick shooters; later in a fight the boss brings out bigger attacks that hunt the player — [TheSixthAxis](https://www.thesixthaxis.com/?p=267101); [buttonmusher](https://buttonmusher.substack.com/p/furi-review-gameplay-perfected)
- Bungie raid principle (2014–16 era): the boss must be able to threaten you from any location, and you can't use geometry to avoid it — [Game Informer: Raiders of the Lost Art](https://gameinformer.com/b/features/archive/2016/08/22/raiders-of-the-lost-art-destinys-developers-explains-their-raid-development-process) (as summarised by search; not verified on the page)
- Darktide's Beast of Nurgle telegraphs its threat by slowing (its toxic sludge does no damage but slows heavily), then swallows players in melee range — [Prima Games](https://primagames.com/tips/how-to-defeat-the-beast-of-nurgle-in-warhammer-40k-darktide); [Pro Game Guides](https://progameguides.com/warhammer-40000-darktide/how-to-beat-the-beast-of-nurgle-in-warhammer-40k-darktide/)
- Hades and the Hiveguard telegraph a phase change: Theseus goes briefly invulnerable at the threshold; the Hiveguard roars before exposing its weak points — [Hades Wiki](https://hades.fandom.com/wiki/Theseus?oldid=9683); [Gamepur](https://www.gamepur.com/guides/how-to-defeat-the-dreadnought-hiveguard-in-deep-rock-galactic)

### Inferences
- **A colour language for Meatgrinder** (the angels are gold/ivory, the damned are dark): "about to hit" = a ground decal that fills over the wind-up (gold → white flash at impact); "vulnerable now" = one colour reserved for the whole game (the Marauder's green; for Meatgrinder, perhaps red, Hell's colour, a thematic match with "turning Heaven's light against it"); "unbreakable" = pale grey/white. Specs should name the exact colours once and reuse them for every boss.
- **Wind-up durations (inference; no sourced numbers found):** about 0.8–1.2 s for single-target slams, about 1.5–2 s for arena-wide attacks (heavens.md already uses 2 s for the Partitions and the Inquisitor's Verdict, and 3 s for "Be still"). Keep one table of wind-up tiers so every boss obeys them.
- **The Gatekeeper's Judgment is the Bungie rule inverted:** geometry is the answer. Keep the "line-of-sight attacks" family (Gatekeeper, Seraph's gaze) and the "geometry won't save you" family (Serene, Recording Angel) explicitly separated, so players learn which rule applies from the boss's tell.
- **Billboard readability:** in a 2.5D billboard renderer, projectiles should be bright additive sprites with a dark outline or halo, sized larger than gameplay hitboxes visually suggest less (Returnal-style high contrast). With 1 000+ enemies on screen, boss projectiles need a distinct shape (rings, orbs) that the horde's projectiles never use.
- **Positional audio for pattern spawns** (Returnal) is cheap in WebAudio (panner nodes) and directly fixes "where is it coming from" in a horde. Each boss move needs a unique wind-up sound; playtest 5 complained about synthesized SFX, so boss tells are a priority for real audio assets.
- **The Marauder's "swap for two shots" stagger** maps to Meatgrinder's LMB/RMB rule: a stagger window sized so one primary plus one secondary fits (e.g. 1.2 s) rewards using both attacks without adding a rider.

### Gaps
- No primary source with numeric dodge windows, wind-up times or i-frame durations (Returnal dash i-frames, Furi dash) was found.
- Ultrakill boss design (V2, Gabriel, Minos) wasn't researched; no sources retrieved.
- Jump-over shockwave design numbers (ring speed, height) weren't found in any source.

## 3. Aiming tests: weak points, destroyable orbs/adds, shields, moving targets

### Takeaway
The proven aiming tests are: multiple armour pieces that each must break (Icon of Sin: 8), glowing weak points exposed only in a stage (Hiveguard: 3), weak spots on the back so the team must flank while one player is chased (Beast of Nurgle, DRG Twins), and shields that block frontal fire (Marauder). Area damage is often deliberately weaker against weak points.

### Cited Findings
- Icon of Sin: 8 armour pieces; already-broken parts take no damage, so precise weapons (heavy cannon, ballista) are best; small moving parts (hands) should be broken first, before the boss speeds up — [DoomWiki](https://www.doomwiki.org/wiki/Icon_of_Sin_(Doom_Eternal)); [Pocket-lint](https://www.pocket-lint.com/games/news/bethesda/151787-how-to-beat-bosses-doom-eternal-tips-and-tricks-marauder-hunter-gladiator-khan-maykr-icon-of-sin)
- Icon of Sin: the BFG only hurts it if the main ball hits a weak spot not yet destroyed — [Shacknews](https://www.shacknews.com/article/117086/icon-of-sin-boss-fight-doom-eternal)
- DRG Hiveguard: its 3 protrusions have 50% resistance to area damage; the weak point has higher resistances than the body — [DRG Wiki: Hiveguard](https://deeprockgalactic.wiki.gg/wiki/Glyphid_Dreadnought_Hiveguard)
- DRG: area damage, damage over time and spray damage (Cryo Cannon, flamethrower) mostly don't get weak-point bonuses — [DRG Wiki: Enemies](https://deeprockgalactic.wiki.gg/wiki/Enemies)
- DRG Twins (Arbalest and Lacerator): the back under the shell is the weak point (×1); body and front-leg armour has 100 base HP and takes zero damage until broken; the lower jaw takes ×0.5 — [DRG Wiki: Arbalest](https://deeprockgalactic.wiki.gg/wiki/Glyphid_Dreadnought_Arbalest)
- Beast of Nurgle (Darktide): the weak spot is the glowing pustule on its back, not its face; the recommended play is that one player kites it while the rest shoot the back — [Prima Games](https://primagames.com/tips/how-to-defeat-the-beast-of-nurgle-in-warhammer-40k-darktide); [Pro Game Guides](https://progameguides.com/warhammer-40000-darktide/how-to-beat-the-beast-of-nurgle-in-warhammer-40k-darktide/)
- Marauder: its shield blocks frontal fire except splash damage; it turns to face BFG shots, exposing its back — [GameSpot](https://gamespot.com/articles/doom-eternal-marauder-boss-guide-how-to-kill-the-g/1100-6475129/)
- Twin Val'kyr: shields (Shield of Light/Darkness) must be broken by damage to interrupt the heal — [Engadget](https://www.engadget.com/2009-10-15-ready-check-twin-valkyr.html)
- Vault of Glass Oracles (Destiny): orbs that must be shot in the order they appeared, in waves of 3 rising to 7; out of order wipes the team — [Destinypedia: Templar](https://www.destinypedia.com/Templar); [Prima Games](https://primagames.com/?p=315356); [Grindout](https://grindout.com/destiny-2/guides/vault-of-glass)

### Inferences
- **"Blobs to destroy" from the brief = the Oracle/Hydra-head pattern:** a phase where the boss is immune and N orbs spawn around the arena; the boss resumes when all are dead. For Meatgrinder: N = 3 + party size (so solo gets 4, four players get 7, the same range as the Oracles' 3→7) and each orb has low HP so it's an aiming test, not a DPS check.
- **Weak points vs. AoE:** DRG's choice to deny AoE and DoT weak-point bonuses is exactly what Meatgrinder needs, because the classes' kits are AoE-heavy (censer clouds, Discord, shotgun). Weak points should reward the Betrayer's Silver Bullet (piercing, precise), while armour pieces with fixed HP let the Fallen's shotgun contribute. That gives each class a role without requiring one.
- **The back weak point + one kiter** (Beast of Nurgle) is a natural fit: the boss chases the taunting Fallen (Blasphemy) while the others shoot its back. Solo, the boss must turn periodically (e.g. every 4 s it spins 180° for an attack) so a lone player can still reach the weak point. Bots should be scripted to circle-strafe to the boss's back.
- **Armour pieces with an order effect** (break the hands first or the boss gets faster) maps onto the Lamb's seven horns: each horn broken shrinks the grove; the "smart order" is a mastery skill, not a requirement.
- **Shields:** the Vaultguard (heaven 4) already teaches "flank the shield". A boss shield should reuse that lesson rather than invent a new one.

### Gaps
- No numbers found for how much damage multiplier a weak point gives in Doom Eternal or Darktide.
- No source compared hitscan versus projectile weapons against moving weak points.

## 4. Teamwork mechanics and how they survive solo and bots

### Takeaway
The classic raid mechanics (simultaneous kills, ordered sequences, split groups, rescue grabs, kiting) all exist in the sources, but they're built for coordinated, voice-chatting groups. Bungie explicitly separates raids (assume communication) from strikes (assume no talking). Grab/rescue mechanics in Darktide are the most directly co-op-native. Bots in Vermintide are given priority rules ("is any player in need of aid"), but are deliberately kept weaker so the team still matters.

### Cited Findings
- **Ordered actions:** Vault of Glass Oracles: they spawn to chimes in a sequence, demo twice, then must be destroyed in spawn order; a wrong order marks the team for Negation and wipes it. Waves grow from 3 to 7 (sources disagree on whether positions are random) — [Destinypedia](https://www.destinypedia.com/Templar); [Grindout](https://grindout.com/destiny-2/guides/vault-of-glass); [Prima Games](https://primagames.com/?p=315356)
- **Ordered + simultaneous:** King's Fall Warpriest: the boss spawns only when all 3 plates are stood on at once; then a glyph sequence (often left-middle-right) must be stepped in order; a wrong plate gives "Initiate Rejection" and wipes the team; the last player in the sequence gets the Brand, the only way to damage the boss — [Pro Game Guides](https://progameguides.com/destiny/how-to-beat-warpriest-in-kings-fall-destiny-2-raid-guide/); [Gfinity](https://www.gfinityesports.com/article/destiny-2-kings-fall-warpriest-guide); [Destinypedia: King's Fall](https://www.destinypedia.com/King's_Fall)
- **Split mechanics:** Atheon's Timestream sent the 3 players farthest from Atheon to another time plane; they had to return through a portal quickly, while the other 3 opened the gate in the present, or the raid wiped. Players settled on fixed "Home/Away" roles; Bungie planned a hotfix so Atheon picked 3 random players instead, trading specialization for "everyone learns every role" — [Mein-MMO](https://mein-mmo.de/en/destiny-atheon-random-angry-fans-raid-design-in-focus,20446)
- **Raids vs. strikes:** Gavin Irby: raids have no matchmaking, so the design assumes players communicate; strikes must assume players aren't talking — [Game Informer](https://gameinformer.com/b/features/archive/2016/08/22/raiders-of-the-lost-art-destinys-developers-explains-their-raid-development-process); [Engadget](https://www.engadget.com/2014-08-02-destiny-endgame-raids-will-have-six-players-no-matchmaking.html)
- **Rescue (grab):** Darktide's Daemonhost: after it knocks a player down, it lifts them into the air and, after a few seconds, incapacitates them; if the team doesn't kill it in time, the player is removed from the fight and must be rescued later in the level; it then picks a second player — [Prima Games](https://primagames.com/tips/how-to-defeat-the-daemonhost-in-warhammer-40k-darktide); [Gamer Guides](https://www.gamerguides.com/warhammer-40000-darktide/guide/enemies/bosses)
- **Rescue (swallow):** Beast of Nurgle: a swallowed player steadily loses HP and gains corruption, and is captured if their HP runs out — [Pro Game Guides](https://progameguides.com/warhammer-40000-darktide/how-to-beat-the-beast-of-nurgle-in-warhammer-40k-darktide/)
- **Rescue (grab, counterplay):** Chaos Spawn grabs a player (giving corruption and healing itself); teammates stagger it with a grenade to make it drop the player (player tip, not official) — [Steam thread](https://steamcommunity.com/app/1361210/discussions/0/3812912347567577566); [GamerJournalist](https://gamerjournalist.com/how-to-beat-chaos-spawn-in-warhammer-40k-darktide/)
- **Rescue as a design pillar:** Darktide's own description: enemies like the Chaos Hound and Trapper punish strays, and "only your teammates can save you" once caught — [Co-Optimus](https://www.co-optimus.com/amparticle/16589/survive-the-horrors-of-space-in-warhammer-40-000-darktide.html)
- **Kiting/tank roles:** Dreadnoughts follow one player at a time, switching target at semi-regular intervals; the Chaos Spawn hones in on one player, who can act as bait — [DRG Wiki: Enemies](https://deeprockgalactic.wiki.gg/wiki/Enemies); [Gamer Guides](https://www.gamerguides.com/warhammer-40000-darktide/guide/enemies/bosses)
- **Damage-target rotation:** Blood Prince Council: only the empowered prince takes damage, and the empowerment moves around (every 45 s per Wowhead CN) — [Wowhead](https://www.wowhead.com/wotlk/cn/guide/raids/icecrown-citadel/blood-prince-council-strategy); [Engadget](https://www.engadget.com/2010-02-19-ready-check-blood-princes.html)
- **Interrupt/shield:** Twin Val'kyr: break the shield and interrupt Twin's Pact or the twins heal 20%/50% — [Engadget](https://www.engadget.com/2009-10-15-ready-check-twin-valkyr.html)
- **Bots (Vermintide 2 dev blog):** bots run the same code as players via virtual inputs, use simulated aiming to limit superhuman reactions, and teleport only when stuck. Which player they follow depends on whether a player needs aid, whether an event is active, and how many humans there are; with 3 humans and 1 bot the bot sticks to the largest group (except one wagon event, where it helps the loneliest player). Bots dodge out of time-based area-danger shapes; boss pathing was listed as future work; bots couldn't pick up some objective items (grimoires) — [Vermintide dev blog: How Bots Work](https://www.vermintide.com/news/2018/12/17/dev-blog-how-bots-work-in-vermintide-2)
- **Bot strength is deliberately capped:** Fatshark (2024, community manager) wants to polish bot pain points "without necessarily improving their combat capability"; a Steam commenter reports Fatshark said stronger bots would reduce motivation to team up (secondhand) — [devtrackers](https://devtrackers.gg/vermintide2/p/f6d2c429-bot-mod-update); [Steam thread](https://steamcommunity.com/app/552500/discussions/0/1697167803857106605)
- **Bot failures players report:** bots jump off ledges, chain-fail rescues (one bot falls, the next goes to help and also falls), and try to revive or heal while being hit by a dozen enemies — [Steam thread](https://steamcommunity.com/app/552500/discussions/0/1697167803857106605); [Reddit mirror](https://redlib.belloworld.it/r/DarkTide/comments/10bkf93/bots_should_be_servitors)
- **Solo clutch history:** Bungie said the Crota raid being mastered solo wasn't intended in that form — [Game Informer](https://gameinformer.com/b/features/archive/2016/08/22/raiders-of-the-lost-art-destinys-developers-explains-their-raid-development-process) (as summarised by search)
- **Destiny strike tuning:** Bungie found unintended damage scaling by fireteam size (bigger teams took more damage per enemy shot); the fix made strikes easier overall and normalized damage across group sizes, which made solo slightly harder — [CinemaBlend](https://cinemablend.com/games/Destiny-Suck-Less-Solo-Players-Soon-68554.html); [MP1st](https://mp1st.com/news/destinys-next-update-will-bring-changes-exotic-weapons-latest-strike-tweaks-explained)

### Inferences (a rubric for Meatgrinder: no voice chat assumed, solo must work, bots fill)
Treat Meatgrinder bosses as Destiny *strikes*, not raids: mechanics must be readable without callouts. For each mechanic, a spec should state its solo rule, its bot rule and its fail cost.

- **Simultaneous kill (Twin Wardens, "kill both within 10 s"):** in a 4-player party it splits the team naturally. Solo it's a pure DPS race between two far-apart targets, which is only fair if the window covers travel time. Recommended: the window = 10 s + travel time at walking speed between the twins (or put them 20–25 m apart, not at the opposite arena ends, when the party is 1). Fail cost: the revived twin comes back at 50% HP (Twin Val'kyr-style punishment), not full, so a solo player converges. Bots: assign bots to the twin with fewer humans near it (Vermintide's "largest group/loneliest player" rule). One skilled player clutches by bringing both twins low, then finishing them in quick succession (the Betrayer's piercing Silver Bullet through both if lined up is a satisfying, discoverable clutch).
- **Ordered sequence (Simon says, Oracles/Warpriest):** it works solo because one player can do the whole order. In co-op without voice, show the order on the targets themselves (numbered glows 1–N appearing with chimes), not on a remote display. Fail cost: never a wipe (Destiny wipes are raid-only); instead the boss heals a chunk or spawns an elite wave. Bots: they shoot the current lit target only, which is trivial to script.
- **Split (Atheon-style, players in two places):** it breaks solo outright. Only use a split if it scales: with 1 player, one location; 2+, two locations. Random selection (Atheon's fix) forces everyone to learn both roles.
- **Plates (stand on N at once):** solo needs N = 1; scale plates to party size (Warpriest uses 3 for 6 players). Bots can be scripted to stand on plates, which makes bots visibly useful.
- **Rescue grab (Daemonhost, Chaos Spawn, the Chaperone in heavens.md):** the most co-op-native mechanic. Solo rule: the grabbed player can free themselves (shoot the grabber or mash to break free, like the Chaperone's "the dragged player can still shoot"). Co-op: teammates free them faster (e.g. self-escape in 4 s, a teammate's 1 s of damage frees them). Bots must treat "teammate grabbed" as their top priority (Vermintide's "player needs aid" rule). The Fallen's leap and the Binder's chains are the natural rescuers, which gives those classes a heroic moment without requiring them.
- **Kite + damage (Dreadnought, Beast of Nurgle, Chaos Spawn):** the boss targets one player at a time and switches at intervals. With taunt in the game, Blasphemy should override the target choice (a clear Fallen job). Solo: the boss targets the only player, so it must have periodic recoveries/turns (see section 3).
- **Damage-target rotation (Blood Prince Council):** it works identically solo and in co-op and needs no communication: only the "lit" part takes damage. Good for Grace's heads (one head is "saying grace" and is invulnerable, rotating every 15–20 s).
- **Interrupt via shield break (Twin Val'kyr):** it works solo as a DPS check; scale the shield HP by party size.
- **Soak (players stand in a circle to split damage):** no source found; with bots it's scriptable but invisible to players. Avoid it, or make it a visible circle that needs "at least 1 player" (the "Verdict" in reverse).
- **Bot strength cap:** follow Fatshark: bots should do mechanics reliably (stand on plates, shoot lit targets, rescue) but deal below-human damage, so a human party is still the best experience while solo-plus-bots stays finishable.
- **Clutch rule:** no mechanic should *require* two humans in different places with no self-solvable fallback. A downed party member's mechanic duty passes to the nearest living player (e.g. the plates count needed = living players).

### Gaps
- No primary Bungie source found on how Destiny solo dungeons (Pit of Heresy, Prophecy etc.) scale raid-like mechanics for 1–3 players.
- No Darktide/Fatshark developer source on bot rescue logic for Daemonhost or Beast grabs (only player reports).
- No Helldivers 2 source on boss-tier enemy count per player (only forum claims that spawns don't scale).
- Soaking mechanics in co-op shooters: no sources found.

## 5. Scaling by player count

### Takeaway
Real games scale boss HP by far less than linearly: DRG's boss resistance rises from 0.2–0.75 solo to 0.8–1.7 at four players (roughly 2.3× to 4× across hazards), Monster Hunter's community-measured curve is about 1.0 / 1.63 / 2.0 / 2.34 for 1–4 players, and DRG also lowers enemy counts in solo. Numbers for Gungeon, RoR2 and Gunfire Reborn are community-only and conflicting.

### Cited Findings
- **Deep Rock Galactic, "Extra Large (Boss)" resistance** (effective HP multiplier) by Solo/2P/3P/4P: Hazard 1: 0.20/0.40/0.60/0.80; Hazard 2: 0.30/0.40/0.70/1.00; Hazard 3: 0.50/0.55/0.90/1.20; Hazard 4: 0.70/0.75/1.00/1.60; Hazard 5: 0.75/0.80/1.20/1.70 — [DRG Wiki: Difficulty Scaling](https://deeprockgalactic.wiki.gg/wiki/Difficulty_Scaling)
- **DRG, "Large" enemies** by Solo/2P/3P/4P: Hazard 1: 0.45/0.55/0.70/0.85 … Hazard 5: 1.20/1.20/1.40/1.50. Normal enemies don't scale by player count (0.7–1.2 by hazard only) — [DRG Wiki: Difficulty Scaling](https://deeprockgalactic.wiki.gg/wiki/Difficulty_Scaling)
- **DRG solo spawn count:** lower in solo (Hazard 1: count multiplier 0.15 solo vs. 0.25 for 2P), with "only a small increase … between Solo and 2 Player to compensate for the loss of Bosco" (the solo drone companion) — [DRG Wiki: Difficulty Scaling](https://deeprockgalactic.wiki.gg/wiki/Difficulty_Scaling)
- DRG scales by damage resistance, not by raising HP, and the wiki expresses this as effective HP; a Dreadnought's effective HP ranges from about 1 000 (lowest hazard, 1 player) to about 8 500 (highest, 4 players); the Hiveguard's base is 5 000 (boss scaling) — [DRG Wiki: Glyphid Dreadnought](https://deeprockgalactic.wiki.gg/wiki/Glyphid_Dreadnought); [DRG Wiki: Hiveguard](https://deeprockgalactic.wiki.gg/wiki/Glyphid_Dreadnought_Hiveguard)
- **Monster Hunter Wilds** (community observation): monster HP 100% solo, about 163% for 2, 200% for 3, 234% for 4 players — [Steam thread](https://steamcommunity.com/app/2246340/discussions/0/599646376816542965)
- **Monster Hunter World** (Fextralife wiki): about 150% HP for 2 players, about 220–260% for 3+; monster damage to players doesn't change; HP drops back if the party returns to 1 (Iceborne patch). Forum users dispute whether 3 and 4 differ — [Fextralife MHW: Multiplayer](https://monsterhunterworld.wiki.fextralife.com:443/Multiplayer); [Steam thread](https://steamcommunity.com/app/582010/discussions/0/1734338354735920182)
- **Gunfire Reborn:** conflicting community claims: about +50% enemy HP per extra player with damage unchanged (a guide), versus 7× at 4 players (an anonymous Q&A); a reviewer felt both boss HP and damage scale with team size — [earlyguides](https://earlyguides.com/gunfire-reborn/combat); [SuperCheats](https://www.supercheats.com/gunfire-reborn/questions/422940/what-is-the-enemy-hp); [Co-Optimus review](https://www.co-optimus.com/review/2458/gunfire-reborn-co-op-review.html)
- **Enter the Gungeon:** bosses have a DPS cap (the community wiki gives 65 damage for the Dragun; the Farewell to Arms update raised the caps); some weapons and single hits over 1 000 bypass it. A 2016 player claimed boss HP seemed balanced for co-op and made solo a slog — [Steam thread](https://steamcommunity.com/app/311690/discussions/0/1743346190274433318); [Steam thread](https://steamcommunity.com/app/311690/discussions/0/135512625250274001)
- **Risk of Rain 2:** player count feeds monster credits, interactable prices and teleporter drops separately; teleporter bosses get extra multiplayer HP (a mod setting reduces it) — [PlayerCountConfig mod](https://thunderstore.io/c/riskofrain2/p/TheBugReport/PlayerCountConfig/); [MultitudesDifficulty mod](https://thunderstore.io/package/6thmoon/MultitudesDifficulty/); [Fix_Playercount mod](https://thunderstore.io/package/Moffein/Fix_Playercount/)
- **Destiny strikes:** Bungie normalized enemy damage across fireteam sizes after finding larger teams took more damage per shot — [CinemaBlend](https://cinemablend.com/games/Destiny-Suck-Less-Solo-Players-Soon-68554.html)

### Inferences
- **Recommended Meatgrinder boss HP curve** (from DRG and Monster Hunter): HP × [1.0, 1.6, 2.1, 2.6] for 1/2/3/4 players (about 0.65 HP per extra player). This is sublinear because co-op adds revives, split attention and coordination losses. **Bots count as about 0.5 player** for HP scaling (Fatshark-style weaker bots), or scale by humans only and give bots fixed low DPS; the spec should pick one rule and state it.
- **Scale mechanic counts, not just HP:** orbs = 3 + party size; plates = party size; rescue grabs only when party ≥ 2 (solo: self-escape only). DRG shows count scaling (0.15 vs. 0.25) is as important as HP scaling.
- **Don't scale boss damage per player** (Monster Hunter World, Destiny's normalization): one-shot thresholds must feel the same solo and in co-op.
- **Mid-fight join/leave:** Monster Hunter rescales HP when players leave. Meatgrinder's host-authoritative sim should recompute the HP multiplier on the current-HP *fraction* when a player drops (keep the % constant), so a disconnect doesn't make the boss unkillable.
- **A DPS cap (Gungeon)** is a blunt way to stop build-stacked parties from skipping phases; Meatgrinder's threshold invulnerability (section 1) does the same job more readably.

### Gaps
- No primary-source (developer) numbers found for RoR2 teleporter boss HP per player, Gungeon co-op boss HP, Gunfire Reborn, Destiny or Diablo player scaling. Isaac doesn't need player scaling in the same way (co-op is local and limited), and no source was retrieved.
- Darktide/Vermintide boss HP by player count wasn't found.

## 6. Adds and hordes during boss fights

### Takeaway
The references use adds in three ways: as a gate (the boss is immune until the adds die: Hiveguard Sentinels, Hydra heads), as escalating pressure tied to the phase (Icon of Sin's phase 2 spawns get "much more aggressive"), and as a resource (Doom's arena refills BFG/Crucible charges among the adds). Adds that leave slowing goo on death (Sentinels) also shape movement.

### Cited Findings
- Hiveguard Sentinels: the boss is immune until all Sentinels die; dead Sentinels leave temporary slowing goo pools — [DRG Wiki: Hiveguard](https://deeprockgalactic.wiki.gg/wiki/Glyphid_Dreadnought_Hiveguard)
- Bone Hydra: at 66% it summons 3 skeletal heads and at 33% it summons 6; the main body is immune until they die — [Prima Games](https://primagames.com/gaming/hades-boss-guide-lernaean-bone-hydra)
- Icon of Sin: the arena is "chock full of enemies"; the Crucible and BFG (whose ammo and charges respawn in the arena, enough for 8 BFG shots across the fight) are vital; phase 2 spawns become much more aggressive, with more powerful minions — [Shacknews](https://www.shacknews.com/article/117086/icon-of-sin-boss-fight-doom-eternal); [DoomWiki](https://www.doomwiki.org/wiki/Icon_of_Sin_(Doom_Eternal))
- Hugo Martin: the Marauder "steers you into the fun zone" by forcing players to prioritise targets and clear the arena faster — [PC Gamer interview (summary via search)](https://www.pcgamer.com/au/doom-eternals-director-says-the-marauder-is-good-actually)
- Isaac's Boss Challenge Room spawns two waves of bosses (e.g. Basement: Monstro then Larry Jr.; Caves: Chub then Peep), pre-Repentance table — [Isaac Wiki: Challenge Room](https://bindingofisaacrebirth.wiki.gg/wiki/Challenge_Room)
- Theseus summons Olympian Aid (a god's attack pattern) at 50% — the "add" is an attack layer, not a body — [Hades Wiki](https://hades.fandom.com/wiki/Theseus?oldid=9683)

### Inferences
- **Keep the horde relevant without drowning the boss:** use a fixed budget. In the boss's damage window (break-then-burn), stop or halve horde spawns so players can focus; in the "gate" phase, the horde *is* the mechanic. This gives the fight peaks and valleys, which the brief says the game lacks.
- **The horde as a resource:** heavens.md's Collector already does this inversely (kills near it armour it). Add a positive version on other bosses: Blessed killed near the boss drop halos or a heal mote (Doom's respawning BFG/Crucible charges), so killing the horde is never wasted.
- **Fodder density cap during boss fights:** with 1 000+ enemies possible, boss fights should cap concurrent adds (e.g. 150–300) so the boss's telegraphs and projectiles stay readable (Returnal's "readable at a glance"). The spec should give an explicit cap.
- **Add types per phase:** phase 1 = melee swarm only (Blessed); phase 2 adds the heaven's new enemy (e.g. the Chaperone at the Twin Wardens, the Soother at the Serene). This teaches the heaven's lesson again in the boss fight and reuses existing enemies (cost).
- **The Gatekeeper's Judgment + horde:** hiding behind cover with a swarm coming is the core tension; the swarm should flow toward cover spots so hiding isn't free.

### Gaps
- No data on add counts or spawn rates during Doom Eternal, Darktide or DRG boss fights.
- No source discusses add caps for readability.

## 7. Movement tests: arenas, platforms, gaps, rising floors, breaking pillars

### Takeaway
The found sources give arena hazards (Hades Hydra's lava border, Icon of Sin's second arena, DRG Sentinel goo) and arena-change-by-phase, but little on jump-over shockwaves or breaking pillars. Movement tests are mostly asked for via slows (Beast of Nurgle's sludge), slams at the player's position (Icon of Sin), multiple shockwaves (EM3 Asterius) and tracking spins.

### Cited Findings
- Hades Hydra arena is surrounded by lava that burns the player — [Prima Games](https://primagames.com/gaming/hades-boss-guide-lernaean-bone-hydra)
- Icon of Sin: phase 2 moves to a second arena — [Shacknews](https://www.shacknews.com/article/117086/icon-of-sin-boss-fight-doom-eternal)
- EM3 Asterius: up to 3 slams with large shockwaves; a tracking axe spin after a windup — [Hades Wiki](https://hades.fandom.com/wiki/Theseus?oldid=9683)
- Icon of Sin raised fists → slam at the player's position; dash away — [DoomWiki](https://www.doomwiki.org/wiki/Icon_of_Sin_(Doom_Eternal))
- Beast of Nurgle's sludge doesn't damage but slows heavily, letting it close in — [Prima Games](https://primagames.com/tips/how-to-defeat-the-beast-of-nurgle-in-warhammer-40k-darktide)
- DRG Sentinels leave slowing goo when killed — [DRG Wiki: Hiveguard](https://deeprockgalactic.wiki.gg/wiki/Glyphid_Dreadnought_Hiveguard)
- Atheon's Timestream physically moves players to another plane and back via a portal — [Mein-MMO](https://mein-mmo.de/en/destiny-atheon-random-angry-fans-raid-design-in-focus,20446)

### Inferences
- **Jump-over shockwave:** an expanding ring on the floor (a bright decal plus a low billboard wall) that players must jump; ring height should be well under jump apex. In a 2.5D renderer this is cheap (a ring mesh scaled per frame). Each movement-test boss should use one of: jump (rings), dodge (Peacekeeper-style lines), stop ("Be still"), or hide (Judgment), not all at once. One test per boss is the minimum, two the target, matching the brief's "multiple moves".
- **Arena change per phase** (Icon of Sin's second arena) fits Meatgrinder's single-entry boss room if the change happens *inside* the room: phase 2 floor sinks or the edge erases (the Archive's Erasure), or cover pillars crack (the Gatekeeper's pillars break after N Judgments, so hiding spots shrink over the fight). Breaking pillars require real geometry changes; heavens.md flags floor changes as the biggest technical risk (flow fields, line of sight, terrain mesh). Prefer pillars whose collision is removed and replaced by a rubble decal, rather than reshaping the floor.
- **Slows as a movement test:** goo from killed adds (Sentinels) is a natural fit for heaven 1–3 hazards and reuses floor-zone tech (the Groves, the Still Water in heavens.md).
- **The Fallen's leap and the Betrayer's dash** should both be able to clear a shockwave ring; the Heretic Saint and the Binder need a jump that clears it, so the test stays class-neutral.

### Gaps
- No sources found on jump-over shockwave design (heights, speeds) or rising/sinking floors in shooters; Ultrakill and Returnal arena designs weren't retrieved.
- No source on breaking-cover mechanics in boss fights.

## 8. What makes a boss memorable and replayable in a roguelite

### Takeaway
Replayability in the references comes from pools (Isaac picks each floor's boss from a chapter pool, plus champion variants that change HP, damage and attack patterns), from random elements inside a fixed fight (Theseus's random god at 50%), from order choices (kill Asterius first or Theseus), and from escalation modifiers (Hades's Extreme Measures add new attacks). Memorability comes from one strong identity per boss and phases that surprise.

### Cited Findings
- Isaac: each floor's boss is picked from the pool for that chapter; from Chapter 2 on, many bosses can also appear "degraded" as normal enemies; after first beating Satan, bosses can spawn as champions with changed health, damage and attack pattern — [Isaac Wiki: Bosses](https://bindingofisaacrebirth.wiki.gg/wiki/Bosses); [Fandom mirror](https://bindingofisaacrebirth.fandom.com/wiki/Bosses)
- Isaac alternate floors have two possible boss sets; Boss Challenge Rooms pair a wave 1 and a wave 2 boss — [Isaac Wiki: Challenge Room](https://bindingofisaacrebirth.wiki.gg/wiki/Challenge_Room)
- Hades: Theseus's 50% spell depends on a randomly chosen god — [Hades Wiki](https://hades.fandom.com/wiki/Theseus?oldid=9683)
- Hades: the Extreme Measures heat modifier gives bosses new forms and attacks (EM3 Theseus: golden armour, a dangerous chariot; EM3 Asterius: shockwave triple slam and a new spin) — [Hades Wiki](https://hades.fandom.com/wiki/Theseus?oldid=9683)
- Hades: Megaera is fought repeatedly at the end of the first area, and she reacts in the hub to past fights (narrative repetition) — [Wikipedia: Megaera](https://en.wikipedia.org/wiki/Megaera_(Hades)); [GameSpot](https://gamespot.com/articles/hades-changes-what-it-means-to-be-a-roguelike/1100-6483420/)
- Hades bosses have variants that appear as players progress — [Prima Games](https://primagames.com/gaming/hades-boss-guide-lernaean-bone-hydra)
- Atheon's randomised Timestream (Bungie's hotfix) is a deliberate trade: randomness forces everyone to learn every role — [Mein-MMO](https://mein-mmo.de/en/destiny-atheon-random-angry-fans-raid-design-in-focus,20446)
- Vault of Glass Oracles: the order changes every encounter (by chime sequence) — [Destinypedia](https://www.destinypedia.com/Templar)
- Furi built the whole game around boss fights, focusing on "one precise thing", inspired by Super Punch-Out!! and God Hand; each boss has a unique fighting style — [Wikipedia: Furi](https://en.wikipedia.org/wiki/Furi); [The Game Bakers announcement](https://www.thegamebakers.com/?p=2462)

### Inferences
- **A boss pool per heaven:** heavens.md has one boss per heaven. Isaac's model suggests a pool of 2 bosses per heaven at most for the first pass, with the planned boss as the main and the second as an "alt"; given the art cost (heavens.md: "ten levels of art is a lot"), **champion variants** are the cheaper path: same sprite, tinted (Isaac-style), with one swapped move and different HP or damage.
- **Randomness inside a fight:** pick 1 of 3 phase-2 moves at random per run (Theseus's random god). Each boss spec should list a fixed core (its identity rule, e.g. the Gatekeeper's Judgment) and a randomised slot.
- **Order choices:** Grace's three heads (any order, each order plays differently) is the strongest replayability boss on the list; apply the same pattern to the Twin Wardens (which twin dies first changes the survivor's moveset, like Asterius/Theseus).
- **Heat-style escalation:** the brief plans account-bound relics and progression; a later "heat" system could add EM-style new attacks to bosses on repeat clears.
- **"Degraded" bosses as elites:** Isaac reuses bosses as normal enemies on later floors. Meatgrinder could reuse a heaven's boss as a mini-boss in a later heaven's elite-focused room (cheap content, and the brief already lists elite-focused rooms).
- **Memorability:** each boss should have one identity rule players can name in a sentence (heavens.md already does this well: "hide", "kill both within 10 s", "be still", "burn him in a Tomb", "don't retrace your steps"). The specs should protect that one rule and keep the supporting moves (slam, projectile ring, add summon) generic and reusable across bosses.

### Gaps
- No primary source (Supergiant, Edmund McMillen, Dodge Roll) on boss replayability design; Supergiant's boss design interviews weren't found (the DigiPen profile only names Eduardo Gorinstein as overseeing boss fights: [DigiPen](https://digipen.edu/showcase/news/eduardo-gorinstein-delivers-challenge-and-fun-hades)).
- Enter the Gungeon's boss pools per floor and Gunfire Reborn's boss variants weren't retrieved.
- No data on how often players re-fight each boss per run in these games.
