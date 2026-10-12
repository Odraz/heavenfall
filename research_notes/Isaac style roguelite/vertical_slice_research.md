# Vertical-slice research: replayable decisions with bounded complexity

Research checked **2026-10-11**. This is evidence and design inference, not another source of game rules. The shipped specification is [docs/rogue/game.md](../../docs/rogue/game.md), with its content catalogs. Historical sources are used for design principles; their 2012/2020/2022 feature sets are not presented as current product specifications.

## Verified developer/official evidence

**Isaac: randomized resources should change the adventure.** In his own postmortem, Edmund McMillen describes adapting Zelda's dungeon structure into real-time roguelike play: randomized keys, coins and health add decisions; randomized items provide visible character growth; progress opens harder content and more characters/items. He also describes item-combination bugs and browser-runtime performance as serious failures. These support visible run changes and explicit combination rules, rather than a promise that random maps alone will make replay compelling. [McMillen's 2012 postmortem](https://www.gamedeveloper.com/business/postmortem-mcmillen-and-himsl-s-i-the-binding-of-isaac-i-).

**Isaac: design around a replayability core.** A contemporary interview records McMillen wanting a different experience each play and choices that could surprise him. The principle is to judge every system against the chosen core. It does not specify an optimum item count, reward interval, run duration or guarantee of endless fun. [Interview with McMillen, February 2012](https://www.gamedeveloper.com/design/raw-meat-game-design-tips-from-team-meat-s-edmund-mcmillen).

**WoW: agency needs safe paths, preserved class foundations and readable dependencies.** Blizzard's Dragonflight talent explanation identifies player agency, meaningful leveling rewards and class/spec identity as goals. It emphasizes retaining foundational abilities, representing dependencies clearly and allowing intuitive reasonable paths rather than trapping players in a maze of choices. Utility and role power are separated so utility does not always lose to raw damage. It acknowledges that bad choices remain possible. This is developer rationale for the 2022 redesign, not proof that every tree is balanced. [Blizzard's talent design philosophy](https://news.blizzard.com/en-us/article/23797209/world-of-warcraft-dragonflight-talent-preview).

**Borderlands: new abilities should alter a playstyle and mix with an existing kit.** 2K describes Designer's Cut skill trees combining new Action Skills with existing passives. Its examples include replacing a piloted mech with an autonomous one, rewarding ignition, and an augment that pulls targets to change a ranged character's behavior. This supports alternative verbs/geometry with compatibility and opportunity costs, not simply piling on passive damage. [2K's October 2020 skill-tree announcement](https://newsroom.2k.com/news/even-more-borderlandsr-3-skill-trees-revealed-ahead-of-designers-cut-launch-on-november-10).

The repository's [horde-fun research](../../reports/What%20makes%20horde%20shooters%20fun.md) already connects pickup placement, danger, pacing and cooperation to developer sources. It supplies a working hypothesis: holding the safe ring became optimal because valuable decisions were missing. Its proposed reward intervals and individual tuning numbers remain hypotheses, not experimentally established thresholds.

## Design inferences applied to this MVP

1. **Random layout is necessary but insufficient.** Four classes, authored room encounters, shop subsets and route previews supply distinct decisions. Run Rites change the kit during play, with a guaranteed core-route offer so a bad reward roll cannot remove the vertical slice's central experience. Three branches of persistent talents alone would become a fixed best loadout after collection.
2. **Combinatorial breadth must stay legible at 1,000 enemies.** Shared visible states bridge class kits, items and relics. Twelve relics and two slots have 66 possible unordered pairs, of which six are named transformations. These are arithmetic possibilities, not 66 equally viable builds. Actual depth is whether the target, position, timing and cost change what the player does.
3. **A combo trades an existing effect.** Two effects stay two: a collector-centered escape becomes remote taunted-crowd control; a small shield becomes a censed-target finisher; a homing wheel becomes a lane projectile. This creates setup-dependent choices without an unbounded proc engine.
4. **Mystery should invite experimentation, not conceal correctness.** World drops demonstrate an item during combat; full-HP healing and empty-room throws are preserved for later. First-use descriptions explain consequences. Collection may hide an undiscovered combo name; the active rule, dormant trigger and sacrificed effect must be explicit once usable.
5. **Sidegrades need an honest comparison.** An empty relic slot is weaker than a small added effect. We explicitly call that bounded progress, and compare sidegrades between occupied-slot options. Rarity is discovery weight, not a mathematical power multiplier. Similarly, skill points still provide persistent power even with a cap; mixed parties need shared XP, readable choices and optional Edicts rather than a false parity claim.
6. **Risk/reward must survive veterans.** A map, health loss bargain, room detour, bell wave or area-focused item loadout retains a lost benefit even when every relic is owned. Exhausted chest pools yield a Rite, so the Reliquary remains a run decision. Deeds provide specific goals with eligibility frozen at start and rewards committed only on victory.
7. **Bounded surprises are better than undefined recursion.** Delayed Q/E source attribution, shields, reflections, death snapshots and once-per-instance state application are specified. A later direct attack can exploit a relic-created state; a proc cannot recursively create itself. This preserves memorable crowd setup without inheriting Isaac's unrestricted stacking bug surface.

## Four styles to keep different after unlock exhaustion

| Class | Route/build intention | A second intention | What changes the decision |
|---|---|---|---|
| Fallen | Stand in the held crowd, Usher + Quill and ordinary pickup escape | Remote Expulsion control, damaging Q/E alternatives and Reversal | Lost taunt, planned sequence, emergency item versus speed run |
| Heretic | Censer control with Thurible + ordinary Mercy shield | Abandoned Mercy offense, burning paths, damaging Q seal | Personal safety versus finishing, healing kit versus area damage |
| Binder | Reliable slow/hold, ordinary Comb + Wheel | Harrow lane, bound-kill Link with a pickup/streak option | Target geometry, crowd already bound versus loose arrivals, ranged-room silence |
| Betrayer | Field of Blood pooled kills + Tile, standard damaging Shadowstep | Prepared return on E or area-item Appeal | Rallying party versus mobile cut, direct self-item burst versus planned pool |

These are **mental scenarios**, not playtest results. A design-complete vertical slice should show multiple plausible actions; measured dominance, responsiveness and repeated-run enjoyment remain empirical questions. An authored single dungeon cannot honestly guarantee infinite unique experiences or a bug-free implementation.

## Observation questions for the developer's later playtests

No tests or game sessions were executed during this specification pass.

- Does a veteran still change the planned route after seeing reward/encounter previews?
- Does a Rite change position, targeting or ability timing, rather than only kill speed?
- Can a player state both the benefit and the lost benefit of their named combo?
- Do ward purchases correlate with projectile rooms, and do area-item builds reward planned placement?
- Do a fresh player and veteran both make useful decisions in the same party, even though progress supplies some extra power?
- Do cooldown icons, states and proc visuals stay readable during the 1,000-enemy crest, with boss warnings audible?
- After the last relic unlock, do speed, no-death, streak and Sentence goals produce meaningfully different routes/builds?
