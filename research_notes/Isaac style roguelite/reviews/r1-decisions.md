# Round 1 decisions (coordinator)

Decisions on the findings of r1-fun.md and r1-tech.md, to be applied to docs/rogue/game.md and the content-file headers. Where a finding isn't listed here, apply the reviewer's fix if it's a correctness fix; use judgment (and say so in §16) if it's a design change.

## From r1-fun.md

1. **In-run build change (blocker): accept "Borrowed Rites"** (or a better name in the lore's voice): run-only picks of your own class's not-yet-learned talent nodes, 1 of 2 offered, max 4 per run, obeying tier gates and exclusions as if learned; they count against neither the level's points nor the heaven cap (they are the run's power). Rites come from clear rewards and risk/reward events, never as a menu the party must stop for in combat. They vanish at the run's end. Bots get none.
2. **Relic × class synergy (blocker): accept the enemy-state vocabulary.** Define a small fixed set of visible enemy states (e.g. bound, slowed, airborne, censed, silenced, burning/pooled — pick the final list, each with one look) that class attacks, abilities, talents, items and hazards *apply*, and that relics and talent nodes may *trigger on* or *read*. This is the designable bridge between relics and kits. Also accept: a combo **replaces** one of its relics' effects (so a combo pair is a sidegrade, not strictly better).
3. **Risk/reward (major): accept both**: the Advocate's bargain at the Confessional (a devil deal; tune it so it's a real choice) and the Bell of Judgment (re-seal a cleared room for a harder elite wave and a better reward). Keep each to one clear rule.
4. **Route choice (major): accept** pre-rolled clear rewards shown on each combat room's door sigil (Hades-style), and accept a time bonus (a Rite for every human if the boss room is sealed within a target time; set the time from the walkthrough).
5. **Run length (major): keep one floor per heaven** (the brief: each dungeon = one heaven; the boss unlocks the next), but **shrink the Pearly Gates to 10–11 rooms** and **add teleport to cleared rooms from the full map** (1.5 s channel, not in combat, not while the party has a room counting down). Add as *deferred* the Isaac chain: after a heaven's boss, an option to ascend straight into the next heaven within the same run (carrying halos, items, Rites), so later runs become multi-heaven descents.
6. **Long-term replayability (major): accept** Edicts (Hades heat; 5 toggles in the MVP, each one visible rule, unlocked after the first clear, affecting reward and shown on Results), **accept** deed-unlocked relics (4 of the 12 unlocked by deeds instead of the chest pool), accept a small cosmetic rank for XP past the cap.
7. **MP countdown (major): accept** (ticks only while ≥ half the living humans are inside; pauses while anyone is in the Pardoner, the Confessional or a menu, max 45 s total pause per room).
8. **Streak assists (minor): accept**, using the enemy-state vocabulary (applying a state to an enemy that dies within 1.5 s extends your streak).
9. Minors: apply the dead-time and post-boss fixes and the deviation-table additions. On halo coins from Blessed: the lead's judgment — keep "going in pays" (diving into the crowd must pay), but make it worth chasing (lumpier values or fewer, bigger coins).

## From r1-tech.md

Apply every correctness fix. Specifically:
- Use coin flip **0.45** (verified 99.86%), and define exactly when `r` is drawn.
- Enumerate every `validateLevel` rule change needed so generated floors pass (non-combat rooms without spawns, entry cells per socket, start cells, the boss check), not "every other rule stands".
- **Regenerate Appendix A.1** from a real seed using the prototype generator in the scratchpad (update the prototype to the revised rules first), so the example floor is actually what the rules produce.
- Add the missing messages (loadout to the host, Advocate changes mid-run, and the others listed), with the modifier layer recomputed on loadout change.
- Fix rejoin/run-record state (carried inventory, XP base, claimed relic, pedestals sold, Confessional heal).
- Profile lock via the Web Locks API; fix the `.bak` order.
- Make room XP constant across party sizes (compute XP from the room budget, not from rounded counts) and keep the elite cap at small party sizes.
- **Very large masses are non-negotiable:** a 4-player 2×2 horde room must peak at ≥ 1 000 alive (today's best is 980); adjust budgets/waves/overlap and state the peak.
- Fix the exclusion rule (passives, reachable capstones), the economy example, and note later heavens' grid growth as deferred with the code change it needs.
