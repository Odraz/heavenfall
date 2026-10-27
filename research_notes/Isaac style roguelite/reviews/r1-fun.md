# Review 1: fun, replayability, fidelity to the brief

Reviewer lens: fun, replayability and fidelity to [brief.md](../../../docs/rogue/brief.md). Spec under review: [game.md](../../../docs/rogue/game.md). The review plays three players in my head: **N**, a new solo player on runs 1–3; **V**, a veteran on run 15 with all 12 relics at level 10; **P**, a party of four humans at mixed levels.

## Findings

### 1. Blocker: the kit never changes during a run (§1.2, §8.1, §9.5, §6.4)

**Problem.** The build is set in the Lobby and changes only at the Confessional, right before the boss. For about 20 of A.2's 26 minutes no reward changes how a player kills: claimed relics and new points both wait for the Confessional. Mid-run changes are temporary or automatic: halos, motes, about 6.5 items per floor (9 clears × 20% + ~10 elites × 25% + 45 props × 5%: one per ~4 min, not "~30 s"), banners. The report's "my kit changed" every 30–60 s happens once per run.
- **V, run 15:** same 9 nodes and combo as run 14; the Reliquary pays 50 halos; XP does nothing; all 20 templates seen. Research §6's Immortal Redneck failure.
- **N, run 1:** base kit for 22 minutes; level 2 at minute ~8 only lights a pip.

**Fix: Borrowed Rites**, a run-only talent node that reuses the 84 authored nodes, so no new content is needed.
- A Rite offers the player a pick of 2 of their own class's nodes. Allowed: not learned, not a capstone, no conflict through `Modifies` (§9.3) with a learned node or another Rite. Tier gates and the heaven cap are ignored.
- It applies at once and lasts until the run ends. At most 4 per player per run. An ability-node Rite goes straight into its slot (Q or E), replacing what is there for the run.
- **Sources:**
  - The clear-reward roll (§6.4) becomes 40% nothing, 25% gold halo, 15% item, 20% Rite.
  - When the player owns every relic, the Reliquary chest offers a Rite pick instead of 50 halos.
  - Findings 3 and 4 add more sources.
- **Expected rate:** about 3 per floor.
- Host-checked like loadouts (§9.8); bots get none; the modifier layer (§14.7) just appends node ids.

N samples trees before spending points (Isaac's pill identification for talents); V gets a different build every run.

### 2. Blocker: relics can't combine with the class kit, though the brief asks for exactly that (§8.1, §8.4)

**Problem.** The brief wants "relics + abilities + primary/secondary attacks" to combo. game.md allows only class-agnostic event triggers and authored relic×relic pairs, so an "on a kill" relic behaves the same whatever the class, talents or Q/E. The six combos are the game's only synergies; V knows the best pair per class by run 12. Pairing is strictly better (a third effect on top of both), so A.3's Marek made a mistake. **It blocks content work:** items-relics.md and the class files are written to this rule; changing it after 84 nodes and 12 relics is a rewrite.

**Fix: make visible states the shared vocabulary.**
- **States** (each already visible or easy to show): `bound` (Chains), `slowed` (Fetters, frost), `airborne` (Falling Star, shotgun knockback), `censed` (inside an incense cloud), `silenced` (Discord), `pooled` (inside a placed or thrown item area).
- **Rule for relics:** a relic triggers on one of these:
  - a kill of an enemy in state X;
  - one attack hitting 5 or more enemies;
  - a kill by your LMB, RMB, Q or E. This means the result, never the use, so the anointment lesson holds.

  Or the relic applies a state.
- **Rule for talents:** every tree has at least one node that makes an attack apply a state the class doesn't otherwise apply (for example, a Betrayer node "Silver Bullet leaves the enemies it passes through `slowed` 1 s").
- **Rule for combos:** a combo **replaces** relic b's effect, not adds to it. Pairing then becomes a sidegrade, and the combo stays the named "third thing".

Synergy now comes from the build and the party:
- Talent × relic: a Binder relic "bound enemies killed burst into a 2 m feather ring" gets stronger with a node that binds more enemies.
- Ability × relic: a relic that triggers on kills by your E gets better with whichever E you assign.
- Teammates: a Betrayer's relic that fires on `bound` kills pays off on the Binder's pile.

### 3. Major: the risk/reward channel is missing (§1.2, §2.4)

**Problem.** The report's third channel (choosing a risk for a bigger reward) has no rule. The only stake, 2 carried stacks, is a penalty, not a choice; defeat keeps XP and relics. Nothing in a floor asks "do I gamble?".

**Fix: two cheap events built from existing systems.**
- **The Advocate's bargain** (Confessional, per human, once per floor). This is Isaac's devil deal, and it fits the devil's-advocate lore.
  - The Advocate offers a second relic pick (2 unowned relics) or, when all are owned, a Rite.
  - The price: −30% max HP until the run ends, shown as a dark segment on the HP bar. The Confessional heal fills only to the new max.
  - A bargained relic can be equipped at once but is **held in pawn**: it's saved to the profile only on Victory. Taking it means betting on the boss, and a defeat costs the relic.
- **The Bell of Judgment** (L4D's car alarm). On each floor, 2 cleared combat rooms, picked by the RNG at generation, show a gold bell on their reward spot after the clear.
  - Shooting the bell re-seals the room (the §4.3 rules) for one extra wave: 40% of the room's budget plus 2 elites at 4 players, scaled as usual.
  - Clearing that wave gives each human 1 item pickup, 1 gold halo and a Rite pick.
  - The bell is optional and lit only during the valley.

### 4. Major: clearing every room always wins, so route choice is empty (§1.2 "per floor", §5.2, §5.4)

**Problem.** Every room pays persistent XP, halos and items; nothing pays for speed. Full-clearing always wins, so "clear more or rush the boss" is no choice, door order barely matters (sigils show the fight, not the pay), and the Chart (30 halos) is useless to a party visiting every room.

**Fix (Hades' door preview plus Isaac's timed doors):**
- **Show the pre-rolled clear reward on the door leaf** next to the focus sigil: an empty frame, a halo, an item or a Rite. The roll is already deterministic from `fmix32(seed ^ roomIndex)`. The full map shows it too.
- **The Sundial of Mercy.** If the party seals the boss room within **15:00** of run time, every human gets a Rite at the seal. The HUD shows a sundial under the minimap until 15:00.

A full clear reaches the boss at ~22 min, so the bonus means skipping ~3 rooms, the empty-frame doors. N full-clears for XP; V races the clock and buys the Chart.

### 5. Major: one long floor with about 23% walking (§3.1, §0 "run = floor", §15.2 teleport deferred)

**Problem.**
- A.2: 13 min fights, 4 boss, ≈ 6 walking and backtracking, ≈ 3 shop and menus: a quarter of the run in cleared rooms; a Pardoner revisit is a 40 s walk.
- Isaac's rhythm is many short floors, each with a fresh map, shop and reward; here one map read, one shop and one Confessional per run.
- The brief's "level" is a heaven; nothing forbids several floors per heaven, and §3.2's seed already takes `floor`.

**Fix (decide before stage 1, because it changes N and §14.8):**
- **A run = 2 floors of the heaven.**
  - Floor 1: N = 8 (Breach, Pardoner, Reliquary, Confessional, 4 fights). Its exit is the floor's 2×2 horde room, generated as the leaf at the largest `dist`; its last wave adds 2 elites, and its clear raises the Stair of light.
  - Floor 2: N = 9 (Breach, Pardoner, Confessional, boss, 5 fights).
  - Halos, items, Rites and the bargain's HP cost carry from floor 1 to floor 2. The Chart is per floor.
  - ≈ 11–14 min per floor, the same total, but two Confessionals (N learns mid-run), two shops, two route reads, trees of depth ≤ 3.
  - Later heavens grow `N = 8 + ⌈h/2⌉` and 3 floors from heaven 4: "map size increases with level".
- **Pilgrim's Return (MVP either way).** Hold M, click a cleared room: after a 1.5 s channel (broken by damage) you stand on its first entry cells. Only while no room is in countdown or combat; own player only. Research §8's proposal; the host checks and moves one position.
- **Fallback if the developer keeps one floor:** N = `min(20, 9 + h + r)` (10–11 rooms, ≈ 20 min), plus Pilgrim's Return.

### 6. Major: nothing is new after run ~12, and the content gets easier (§9.2, §9.7, §8.3, §11.2)

**Problem.**
- Level 10 in ~5 runs, all 12 relics in ~12. On run 40 only the seed is new.
- §4.4 and the boss's 3:00 are tuned for **base kits**, and the MVP cap (9) equals the max level, so pillar 6's sync does nothing: V's party of 4 × 9 points plus combos melts content tuned for 0 points. From run 6 the game only gets easier.
- XP beyond level 10 gives nothing.

**Fix:**
- **Edicts (Hades' Pact).** After a heaven's first clear, the host may toggle up to 5 edicts in the Lobby, each one visible rule:
  1. elite waves get +1 elite;
  2. no clear heal;
  3. ranged enemies' projectiles 30% faster;
  4. halos fade after 10 s;
  5. the boss starts with its phase-2 move.

  **Judgment** = edicts on; the profile records the best per heaven per class. Numbers only, no content.
- **Deed relics.** 4 of the 12 relics (1 Rare, 1 Legendary, 2 Common) enter the offer pool only after a deed:
  - win at Judgment 3;
  - an Armageddon streak (200);
  - a win with no deaths;
  - a win under 20:00.

  Isaac's unlock goals for runs 10–30; with the bargain's extra picks, the collection doesn't end too early.
- **Absolution.** XP beyond the cap shows on the character card as an Absolution rank (one per 10 000 XP), cosmetic only.

### 7. Major (multiplayer): the fastest player picks the route and teleports the rest (§4.3 steps 1, 4)

**Problem.** Jana breaks vases, Tomas shops, Marek walks through a door; 20 s later Tomas is teleported out of the Pardoner with his card closed. The valley activities the playtesters asked for are the ones interrupted, one impatient player decides every door (killing §1.2's "the party picks its next fight"), and being teleported becomes routine.

**Fix:**
- The countdown **ticks only while at least ⌈living humans ÷ 2⌉ are inside the rect or its vestibules**. Otherwise it holds at its value, and the HUD shows `Waiting for the party (1/4)`.
- It also **holds while any human is in the Pardoner or the Confessional or has an overlay open**, for up to 45 s per countdown.
- Solo, nothing changes (1 of 1). The cancel rule and the 3 s rule stay. Teleporting at the seal stays, now only for the minority.

### 8. Minor: the streak crown goes to two classes and punishes support (§10)

**Problem.** Only credited kills count. Field of Blood, Chains, Communion and Sacrament earn none, and the Heretic kills ~1/s by design, so the crown always goes to the Fallen or the Betrayer, and a Heretic who heals for 1 s loses the streak: competition rewards ignoring the team (against pillar 4).

**Fix:** a kill also extends the streak of every human who did one of these to that enemy within the last 1.5 s:
- damaged it;
- bound, slowed, silenced or airborne-launched it;
- covered it with their incense cloud;
- or buffed the killer in their Field of Blood.

The window stays 1.0 s between credits. Competing then means feeding your teammates' kills.

### 9. Minor: 1-halo coins from Blessed are too small to chase (§6.1)

**Problem.** A 1×1 spreads 12 halos over ~300 enemies; nobody dives for one shared coin, so "going in pays" rests on motes, and the Martin test (run past Blessed to a Chorister) gets nothing from halos.

**Fix:**
- Blessed weight **0** in the drop rule. Weight 1 for Choristers and Cherubs, so each ranged kill is about 1 coin, dropped where it died: on the high ground, at the back.
- If a room has no non-Blessed enemies, Blessed get weight 1.
- The coin fade stays 20 s.

### 10. Minor: dead time and feel-bads after the boss (§11.6, §2.4, §13.4, §6.5)

**Problem.**
- A.3: three players wait 50 s in the light while Marek shops.
- An AFK teammate holds the exit forever; `Leave run` then empties the inventory the boss's death just saved (§13.4).
- An unclaimed relic offer is lost at the exit.

**Fix:**
- After the boss dies, each player's **unbought pedestals appear beside the Stair of light**.
- Once one human stands in the light, a **30 s exit timer** runs. When it ends, everyone ascends. It holds while any human has an unclaimed relic offer, and that human sees `Your relic waits in the Reliquary`.
- `Leave run` after the boss's death resolves as Victory for the leaver.

### 11. Minor: brief deviations missing from §16.1

**Problem.** Unlisted: (a) items drop only from elites, props and clears (brief: "enemies … drop … items"; justified at 1 000 enemies); (b) carried items lost on defeat (brief: "items remain"); (c) no relic×ability combos (finding 2); (d) the treasure door unlocked; (e) 1 hazard type of the brief's 4.

**Fix:** add rows (a)–(e) with reasons; (c) only if finding 2 is rejected.

### 12. Minor: the rhythm table promises decisions that are sensations (§1.2)

**Problem.** The "~30 s" row is magnetized halos, banners and auto-used items; only motes and blast props are choices. Pillar 1 would "pass" with players holding LMB all floor.

**Fix:** split it into "~30 s feedback" and "~1–2 min decisions" (mote dive, blast censer, item use, Rite, bell, door). Add a playtest metric to §14.10: **choices per 10 minutes** (item uses, Rites, bells, purchases, door forks), target ≥ 15.

## Brief fidelity at a glance

Honoured: everything in the brief's room, map, key, chest, inventory, prop, talent, persistence and boss lists, except what follows. Deviated and justified: the halo budget per room, no XP for healing, learning in the Lobby too, no roofs, no L-shapes, the 30% clear heal. Deviated or weak and not justified: relic×ability combos (finding 2); items from all enemies, the defeat loss and the hazard count, all unlisted (finding 11); the treasure's value once all relics are owned (findings 1 and 6).

## Things that are good and must be kept

- The fixed halo budget per room, credited to everyone (§6.1), and per-player relic offers and Pardoner stock: no loot fights.
- Use-on-pickup with "would change nothing now", the first-use card and `New` at the shop.
- Door sigils showing the next room's focus (§3.4), with the same signs on the map.
- The hazard rules (§4.10) and the obstacle purpose tags enforced by the validator (§4.7).
- The Confessional as the pre-boss valley.
- No relic triggers on ability use, no +X%, no fire rate on items.
- Shared XP and no healing XP.
- §11.3's solo rule, bot rule and fail cost for every boss mechanic; sublinear HP.
- The key drop rules; the trickle capped at 3 refills; streaks give glory only.
- The determinism rules (§3.2) and the one-active-room rule (§4.2).
