# The Binder: talent trees and new abilities

**Purpose:** the Binder's three talent trees and its three new abilities for the roguelite. [game.md](game.md) §0 fixes precedence: its rules win over this catalog, [classes.md](../classes.md) supplies class identity/design intent, and [lore.md](../lore.md) supplies lore. Core §9.3–§9.4's explicit composition rules supersede the older one-effect wording. All numbers are initial values.

**Status:** completed design baseline (2026-10-11), reviewed through solo/co-op scenarios. Numbers remain playtest baselines; the scenario notes are reasoning, not measured balance.

---

## 1. Requirements (from game.md)

**Structure (game.md §9.3–§9.4)**
- **3 trees**, each a playstyle domain (e.g. ranged, melee, area, damage over time, slowing, hazards, traps, or a combination). One tree deepens the Binder's verb, **control**; the other two bend it. Each must be fun in a pure swarm of Blessed and playable solo.
- **7 nodes per tree**, 1 point each, one rank:

  | Tier | Nodes | Opens with distinct strictly lower-tier nodes in the tree (core §9.3) |
  |---|---|---|
  | 1 | 2 | 0 points |
  | 2 | 2 | 1 point |
  | 3 | 2: exactly **one ability node** and one other | 3 points |
  | 4 | 1 capstone | 5 points |

- **One capstone per player** (taking one, learned or as a Rite, locks the other two). The Pearly Gates allows **9 points** (one capstone build of 6 plus 3, or a spread) plus up to **4 Rites** per run; later heavens at most 14 points.
- **Each tree's ability node** teaches one new ability for **Q or E**, replacing a named base ability (Chains of Tartarus or Discord) when assigned. LMB and RMB are never replaced; no new keys.

**What a node may do (game.md §9.3)**
- Change a **visible count or shape** (+1 chain target, a wider Scourge arc with a visibly wider swing); **replace** an attack's or ability's effect with a different visible one (Chains pulling into a line instead of a pile); or **add one visible effect** to an attack or ability that has only one.
- **Never:** an invisible percentage, a hidden or conditional rider, a "press when ready" buff, a stat node, a multi-rank node.
- Augments declare a **Delivery** channel (count, trajectory, placement or footprint of an existing effect) or a **Payload** channel (adds/replaces one emitted effect). One active augment per channel and resolved named input is allowed; different channels compose in Delivery-then-Payload order, with at most two visible effects. Same-channel alternatives exclude; an ability unlock occupies neither channel. A Rite may substitute for a learned augment only in its own channel, never a capstone/another Rite/explicit exclusion. Passive/movement nodes have no implicit channel exclusions. Explicit target sets below define alternative-ability inheritance; no other node silently inherits. Every six-point capstone path and nine-point extension obeys these rules and the two kill-discharge-node limit.
- Applying a state (game.md §4.11), or one more visible effect on enemies in a state, counts as the node's one visible effect.

**The class's rules (classes.md)**
- **Every direct Chain Gun/Scourge hit slows** (Fetters), including their delivered pierce/arc/line: the slow is the class's weapon trait, not a node's reward. Secondary chain-shard and globe-interception damage has only its authored payload and does not inherit a hidden Fetters rider. Chains moves enemies; the Scourge only hits them.
- **Bound** enemies take double damage and aren't knocked back; keep both for any new binding.
- Its weakness stays: it must stand in the crowd to kill fast and has no escape ability; no node gives it a dash or leap. A new E may replace Discord with something else, but not with an escape.
- No taunt. Silence belongs to Discord (a Discord alternative may silence; nothing else does).
- Don't propose again: Chain Gun hits stacking into a root; Chains pulling an ally; Discord making enemies fight each other; Shackle (a secondary rooting one enemy).
- **Bots play the base kit** (game.md §12.4): no tree may be needed for a bot to work.

**Enemy states (game.md §4.11): the bridge to relics and teammates**
- The Binder's base kit **applies** `bound` (Chains of Tartarus, 2.5 s), `slowed` (Fetters: every Chain Gun and Scourge hit, 1 s) and `silenced` (Discord, and only Discord's alternatives may silence); it **reads** bound enemies take double damage and aren't knocked back (the trait every class reads).
- **Each tree** has at least one node that makes an attack or ability **apply a state the base kit doesn't**: `airborne` or `pooled` (an area it leaves); never `taunted` or `censed`.
- **The class** has at least **two nodes that read a state another class's base kit applies**: `taunted`, `airborne` (the Fallen), `censed` (the Heretic), `pooled` (the Betrayer's Field of Blood) (e.g. "kills of `censed` enemies by the slug burst into a 2 m ring").
- Fill the `States` column (`applies slowed`, `reads bound`); a relic or a teammate's kit can then be named that pays off on it.

**Rites (game.md §9.10): every node is also a run-only pick**
- A node is offered as a Rite only with its lower-tier gate, exclusions, current ability and usefulness conditions satisfied (game.md §9.10). Its card explains one visible rule; conditional readers require a producible state source. Learned-only gates never borrow temporary Rite points.
- **Source closure:** use game.md §9.9 and items-relics.md §2.1.1's finite producibility closure after resolving channels and substitutions. Seed only effective native kit, actually available carried items, active same-room areas and usable same-room hazards; admit a triggered emitter only when its trigger is reachable from those seeds. An equipped but untriggerable relic, an absent ally, a surrendered payload or an unseeded cycle cannot qualify a state reader. `own` predicates require the owner's producible source, not an ally's flag. Timed/source prerequisites are checked when offering/taking, then ordinary loss of a source makes the held effect dormant without erasing ownership.
- **Temporary substitution:** a Rite augment may suppress one conflicting learned augment in the same Delivery/Payload channel of its implicit named-input group; explicit exclusions, another Rite and capstones are never displaced. Suppressed ownership remains for gates, but only effective nodes produce effects, metadata or passive dispatch. Evaluate usefulness after suppression; show the sacrificed effect and any effects losing their sole state source. Table annotations explaining same-input/same-channel conflicts are implicit-group documentation, not extra `Excludes` prerequisites. No point refund or cooldown/source refresh is granted; the learned effect returns at the run's end.
- An augment of Q or E is offered only while that ability is assigned, so **each tree has at least 2 tier-1/tier-2 nodes on `LMB`, `RMB` or `passive`** to support early offers. These still obey gates, exclusions and state-source usefulness checks.
- An ability node taken as a Rite goes straight into its slot (Q or E) with the replaced ability's remaining cooldown; it must be playable without any of its tree's other nodes.
- Rite choices and valid Confessional loadout edits may commit during a valley or an encounter countdown, with the same living-player, range and room checks. At the actual combat seal, close overlays and reject later commits without discarding their pending offers. This does not widen the valley rules for items, regeneration or teleporting.
- Bots never get Rites; nothing here may be needed for a bot.

**Quantities:** 21 nodes, 3 new abilities, 3 capstones.

## 2. The base kit (ids for `Modifies`)

| Slot | id | Name |
|---|---|---|
| LMB | `LMB` | Chain Gun |
| RMB | `RMB` | Scourge |
| Q | `Q:chains` | Chains of Tartarus |
| E | `E:discord` | Discord |
| Passive | `passive` | Fetters |

Current values: [classes.md](../classes.md) *The Binder*.

New ability ids taught by the trees (§4): `E:well` (The Well of the Giants), `Q:ring` (Ring of the Giants), `Q:boundary` (The Boundary Chain).

Base values the numbers below are grounded in (`src/data/weapons.ts`, `src/sim/sim.ts`): Chain Gun 12 dmg, 12 shots/s, ±2°, 40 m, one enemy per bullet; Scourge 25 dmg to every enemy within 3 m and ±60° of the aim, 0.8 s; Chains of Tartarus: enemies within 20 m and 30° of the aim, in sight, pulled over 0.3 s to a point walked up to 5 m ahead, bound 2.5 s, cooldown 8 s; Discord: 30 m, ±35° of the yaw, any height, in sight, silence 4 s, cooldown 12 s; Fetters: slowed to 0.7× for 1 s. The Binder has 240 HP and 6 m/s. A Blessed has 20 HP, walks 4 m/s (2.8 slowed) and strikes for 5 every 1 s within 1.2 m; a Chorister 60 HP, a Cherub 30 HP hovering 4 m up; wading slows a player to 0.55 with 3+ enemies pressing.

## 3. The trees

| Tree | Name | Domain | Identity (one line) | Its ability node | Capstone |
|---|---|---|---|---|---|
| A | **Keeper of the Well** | control: piles, holds, bind chains (deepens the verb) | "I drag the whole room into one pile wherever I want it, and it stays there until the party has eaten it." | `binder.a.3a` The Well of the Giants (E, replaces Discord) | All of Tartarus: Chains pulls from all around |
| B | **Breaker of Giants** | melee brawler and survival (bends control into close combat) | "I wade into the swarm, spin the chain and walk out of the crowd that should have held me." | `binder.b.3a` Ring of the Giants (Q, replaces Chains) | The Chains Shatter: bound kills burst |
| C | **Warden of the Boundary** | ranged lines, traps and kiting (bends control into range) | "I hold the horde in lines far from me: frost on their road, a chain across their path, bullets through two at a time." | `binder.c.3a` The Boundary Chain (Q, replaces Chains) | The Wind of Cocytus: Discord's silence ends in chains |

*Keeper of the Well:* in Dante's Hell the giants stand in a well around the frozen lake of Cocytus. The Binder kept that well for ten thousand years.
*Breaker of Giants:* the giants of the ninth circle were chained because they could not be held any other way. The Binder fought them hand to hand to chain them.
*Warden of the Boundary:* the Binder's charge was a line the damned must not cross on their way to the Earth. It held that line from the edge of the ice.

**Notes for all three tables.** Ability-unlock nodes never occupy augment exclusion groups (§9.3). Every bind is game.md §4.11's `bound`: rooted, double damage once, no ordinary knockback, immune Gatekeeper. Chains/Ring targets count as bound during their accepted 0.3 s pull, then remain bound for 2.5 s after that pull's accepted completion, preserving the base simulation's timing. The source's ordinary expiry is therefore `acceptedPullEnd + 2.5 s`, while its six-second ceiling remains `originatingCastStart + 6 s`; recording a pull completion never starts a new cast. The pull may deliberately reposition an existing bound target without shortening any independent surviving bind. Instant in-place/Boundary/Wind binds use their stated duration from actual acquisition. "Bound by you" means your own still-active source token, not the last writer of a shared `eRootUntil`. Overlapping bind actions and refreshes cannot steal another source's assist or six-second limit; the slice still permits only one player of each class. Same-room LOS, floor-surface clipping, source lifetimes and canonical movement validation come from game.md. Button damage and proc damage use §14.11's root-action provenance; secondary shard kills never initiate another damaging chain.

**Composition data (game.md §9.3).** All nodes of Kind `augment` appear exactly once here. Passive/capstone rules do not consume either channel; they still obey source predicates, effect rules and discharge limits.

| Channel | Node IDs |
|---|---|
| Delivery | `binder.a.1a`, `binder.b.1a`, `binder.b.3b`, `binder.c.1a`, `binder.c.2b` |
| Payload | `binder.b.2a`, `binder.c.3b` |

**Enemy event eligibility.** Trickle kills/hits never dispatch enemy-triggered talent/relic/combo discharges or advance kill meters. Ordinary native attacks, their direct shape/state rules and defensive passives still work. Watchers/Seals never supply kill-listener or hit-count events; authored incidental damage uses the boss-part area modifier. Ordinary boss summons permit their explicitly bounded ordinary combat procs, combat streak credit and Armageddon eligibility, but never Bread/extra passive mote harvest or item/halo/XP rewards. Boss parts and trickle never build deed streaks. World damage supplies the core death entitlement and recent setup assist only, never a fabricated player/button kill. Area-only propagation keeps its explicit core exception.

**Kill-discharge data.** `binder.a.1b` The Chain Holds, `binder.b.cap` The Chains Shatter and `binder.c.1b` Frost of Cocytus are this class's kill-triggered talent discharge nodes. At most **two** are effective in one build, counting learned nodes, Rites and capstones together. A listener still counts when its read state or target is temporarily absent; only actual named-input dormancy or suppression removes its active count. Use real remaining source/phase predicates for offers, not this limit as a dynamic target counter. Each root collects an active node once at that root's **first eligible resolving tick**, bundling all qualifying deaths of that root/tick after native damage; the row's origin/victim caps apply. Later native pulses retain the dispatch flag and cannot re-dispatch that node. Never collect separately per pellet, branch or fatal victim. Eligibility and ordinary damage happen before the secondary bundle; secondary kills cannot seed another bundle. Eligibility still uses per-victim pre-fatal state; the flag and any cooldown remain through death/reassignment/reconnect and the root's delayed lifetime. The Burning Plain/The Sixth Circle's existing area-only propagation exception, native ability damage, Bread's bounded harvest, landing effects, motes and revival listeners are outside this kill-discharge category. There is no banked third proc or retroactive state qualification.

### 3.1 Tree A: Keeper of the Well

| id | Tier | Name | Kind | Modifies | Rule (one line) | Numbers | Visible effect | States (applies / reads) | Requires | Excludes |
|---|---|---|---|---|---|---|---|---|---|---|
| `binder.a.1a` | 1 | Cast Down | augment | `Q:chains` | Chains of Tartarus drops its pile where your crosshair meets the floor, up to 15 m away, instead of 5 m ahead. | Pile point: the crosshair ray's first floor or wall hit, brought down to the floor, then walked from your feet along the horizontal aim as today (a wall, a closed door or a step over 0.5 m stops it); at least 1.5 m, at most 15 m (aimed above the horizon: 15 m). Cone, 20 m range, 0.3 s pull, 2.5 s bind and 8 s cooldown unchanged. | The red-hot chains come down on the spot under the crosshair, not in front of the Binder. | applies `bound` (as base); places it in someone's `censed` cloud, Field of Blood or hazard | — | — (compatible with `binder.a.cap`: destination versus passive target coverage) |
| `binder.a.1b` | 1 | The Chain Holds | passive | `passive` | A primary kill of your bound target passes its remaining chain to another enemy. | Nearest eligible unbound target within4m/LOS/same room, ties entityID; flyers qualify. Only if at least0.3s remain in your source. Transfer arrives next tick and keeps original action/ordinary expiry/six-second ceiling; no refresh. At most40 transfers per root kill action, each target selected once. Secondary kills and Procession's extra acquisition cannot start another transfer. | A hot chain arcs from the burst body to its next target and closes. | reads/applies `bound` | — | — |
| `binder.a.2a` | 2 | Where They Fall | passive | `passive` | Directly launched enemies landing near you are chained. | Within20m/LOS/same room at landing, bind2s once per enemy per launch source. Native class/direct item launches qualify; relic/combo launches do not create another landing proc. Bound targets cannot be relaunched. One primary landing bundle invokes each applicable effective owned effect once: controls first, then damage. Dormant or suppressed ownership never dispatches. This bind is depth1, never a new attack/landing event; direct item origin has no Q/E slot. | Chains close as each eligible body lands. | reads `airborne`; applies `bound` | present direct airborne source for a Rite | — |
| `binder.a.2b` | 2 | Brought Low | passive | `passive` | Flyers you bind are dragged down to the floor and stay there while bound. | A flyer with your active bind drops to its valid same-room floor over 0.3 s, stays while your bind remains, then climbs to its normal hover at 6 m/s. Overlapping own bind sources use one grounding state: it cannot climb until no qualifying own bind remains, and a refresh never restarts its drop from hover height. Actual host height changes, so grounded flyers can take floor effects and Scourge hits. The canonical 14-byte enemy snapshot includes actual feet z and incarnation; floorSync includes grounding/source expiry. Do not invent a free flags bit or infer grounded height from terrain alone. | Cherubs crash into the pile with wings chained. | reads own `bound` | floor has eligible flyers and a present own flyer-capable bind source for a Rite | — |
| `binder.a.3a` | 3 | The Well of the Giants | ability | `E:well` | Teaches The Well of the Giants (E, replaces Discord): a pit that drags every ground enemy within 7 m toward it for 5 s. | §4 | §4 | applies `pooled` | — | — |
| `binder.a.3b` | 3 | Sunk in the Lake | passive | `passive` | Your bind stays anchored in a pool, up to 6 s from its original cast. | Each originating bind action records its start, ordinary expiry and `start + 6 s` extension ceiling. While an active own source is pooled, its end is max(ordinary expiry, ceiling); leaving all pools restores max(now, ordinary expiry). Never revive an expired source or shorten its ordinary bind. A Boundary crossing after its cast's ceiling therefore gets its normal 2.5 s only. Later distinct casts can bind again, but refreshes/leaps of the same action keep the original ceiling. Any of your binds; never shorten another caster's source. | Chains run into the floor and stay lit until the pool or ceiling ends. | reads `pooled` | a present pooled source for a Rite | — |
| `binder.a.cap` | 4 | All of Tartarus | capstone | `passive` | Your Chains of Tartarus reaches every direction at once. | While Chains is assigned: 360° rather than ±30°, 20 m range, LOS, any height; cooldown 12 s rather than 8. Pull/bind unchanged. Cast Down may supply its 15 m destination; the capstone supplies target coverage, so neither replaces the other. | Chains lash out in every direction and drag the visible room into one pile. | applies `bound` | assigned `Q:chains` to offer as a Rite | — |

`Kind`: `augment`, `ability`, `passive`, `capstone`. `Modifies`: `LMB`, `RMB`, `Q:<abilityId>`, `E:<abilityId>`, `passive`, `movement`. `States`: what the node applies or reads (game.md §4.11), else empty. `Requires`: extra prerequisites; a predicate explicitly labelled for a Rite filters that offer only and does not invalidate persistent ownership when an ability is unassigned. `Excludes`: only extra exclusions beyond sharing the same resolved named input **and channel**. `Targets` may be an explicit set of Q/E ability IDs; a node occupies its one declared channel only for the currently assigned matching ability. Delivery/Payload below are catalog data, not a freeform guess by implementation.

**Tree A's pair:** none. A Cast Down Rite does not permanently lock this capstone. The six-point path is `a.1a → a.1b → a.2b → a.3a → a.3b → a.cap`; a party with airborne sources may replace `a.2b` with `a.2a`. **Payoffs:** The Chain Holds passes a bounded remaining bind into the crowd; the Well's knot is pooled; the Fallen's outer launch ring lands bound with Where They Fall. Cast Down places the pile into an existing cloud, Field or hazard. Sources keep separate lifetimes; a Field does not make any bind exceed its cast's six-second ceiling.

### 3.2 Tree B: Breaker of Giants

| id | Tier | Name | Kind | Modifies | Rule (one line) | Numbers | Visible effect | States (applies / reads) | Requires | Excludes |
|---|---|---|---|---|---|---|---|---|---|---|
| `binder.b.1a` | 1 | Whirl | augment | `RMB` | The Scourge swings all the way around you, 1.2 s between swings. | 360° (was ±60°), 3 m, 25 dmg, slows 1 s as every Binder hit; 1.2 s between swings (was 0.8). Area per second about 2× the base swing (28 m² per 1.2 s against 9.4 m² per 0.8 s). | The chain spins a full circle around the Binder, a ring of sparks at 3 m. | applies `slowed` (as base) | — | — (same `Modifies` as `binder.b.3b`) |
| `binder.b.1b` | 1 | Iron Stride | passive | `movement` | Slowed enemies no longer hold you back when you wade through them. | Any `slowed` enemy, whoever supplied the slow, is omitted from wading; others still count. Speed stays 6 m/s, no dash or invulnerability; enemies still strike. Host resolves states and clients predict from synchronized flags. | Full stride through a violet-tinted crowd after a swing. | reads `slowed` | — | — |
| `binder.b.2a` | 2 | Voice of the Pit | augment | `E:discord` | Discord's shout also throws the close front ranks 4 m back. | Within 10 m, ±35° cone, LOS: ground enemies launched 4 m over 0.4 s, `airborne`; flyers shoved 4 m without a landing event. Bound enemies/Gatekeeper stay. Silence (30 m, 4 s) and cooldown 12 s unchanged. The gust follows the floor/wall movement contract. | The ground crowd arcs back; flyers slide away on the gust. | applies `airborne` to ground enemies | — | — |
| `binder.b.2b` | 2 | Fettered Hands | passive | `passive` | Enemies you bound can't strike in melee. | A Blessed (or any melee enemy) bound by you skips its blows until the bind ends; its melee timer restarts at 0.25 s when freed. Casters still cast (only Discord silences). | Bound enemies strain at their chains with their arms pinned instead of swinging. | reads `bound` | — | — |
| `binder.b.3a` | 3 | Ring of the Giants | ability | `Q:ring` | Teaches Ring of the Giants (Q, replaces Chains of Tartarus): every enemy within 7 m is dragged into a ring 2.5 m around you and bound. | §4 | §4 | applies `bound` | — | — |
| `binder.b.3b` | 3 | The Long Flail | augment | `RMB` | The Scourge's chain reaches 4 m instead of 3 m, in the same arc. | 4 m (was 3), ±60°, 25 dmg, 0.8 s. Out of a Blessed's 1.2 m strike by 2.8 m. Area per second about 1.8× the base. | A visibly longer chain, its tip cracking 4 m out. | applies `slowed` (as base) | — | — (same `Modifies` as `binder.b.1a`) |
| `binder.b.cap` | 4 | The Chains Shatter | capstone | `passive` | Your primary bound kills shatter their chains around them. | Secondary20-damage/radius2m ring per primary bound victim, whoever supplied bind, max60 rings per root action in kill order. Merge damage: each other victim takes at most one shard hit from the action, ×2 if currently bound. LOS/same room; shard kills never start another proc/transfer. Visuals may batch, damage remains exact under these caps. | Red-hot fragments spray from the gold-spark deaths. | reads `bound` | — | — |

**Tree B's pair:** `b.1a` and `b.3b` (both `RMB`): spin in the crowd, or reach from its edge. The capstone path is `b.1a`, `b.1b`, `b.2a`, `b.2b`, `b.3a`, `b.cap` (or with `b.3b` instead of `b.1a`). **Survival for solo:** Whirl clears all around, Iron Stride walks out of what it slowed, Voice of the Pit throws the front back, Ring of the Giants puts everything within 7 m out of reach for 2.5 s. None of them moves the Binder faster than 6 m/s. **Payoffs:** an "attack hits 5+" relic fires on nearly every Whirl in a crowd; Voice of the Pit feeds "kill an `airborne` enemy" relics and Where They Fall (`binder.a.2a`); Fettered Hands lets the Fallen land in a pile and the Heretic stand by it unharmed; The Chains Shatter turns every bound kill the Binder makes into a small blast for a "burst death" relic.

### 3.3 Tree C: Warden of the Boundary

| id | Tier | Name | Kind | Modifies | Rule (one line) | Numbers | Visible effect | States (applies / reads) | Requires | Excludes |
|---|---|---|---|---|---|---|---|---|---|---|
| `binder.c.1a` | 1 | Barbed Rounds | augment | `LMB` | Each Chain Gun bullet goes on through the first enemy it hits into the next one. | Up to 2 enemies per bullet (was 1), 12 dmg and the 1 s slow to each, within the 40 m range. In a crowd about 12 Blessed/s instead of 6. | The tracer punches through and sparks on a second body. | applies `slowed` (as base) | — | — |
| `binder.c.1b` | 1 | Frost of Cocytus | passive | `passive` | Your primary kills leave up to eight patches of slowing frost. | At the root's first eligible kill tick, up to 8 primary victims in accepted kill order with a valid same-room floor below them emit radius-2 m frost for 4 s; secondary shard/interception kills do not seed frost. Ground-contact enemies on it are `slowed` (Fetters' 0.7×, refreshed each tick) and `pooled`; hovering flyers and players unaffected. At most 8 patches per Binder; evict oldest creation tick then area ID. An origin within 1.5 m of an existing patch's center refreshes the nearest patch (ties area ID) instead of adding one. A multikill dispatches this one bounded origin bundle, never one independent proc per corpse. | Violet frost discs on the floor with drifting frost motes (slow's color, game.md §4.10). | applies `pooled`, `slowed` | — | — |
| `binder.c.2a` | 2 | The Procession | passive | `passive` | An enemy caught by your chain follows the procession into a line. | For Chains, Ring and Boundary bind actions, on the first bind acquire an additional unbound ground enemy within 3 m directly behind the target along its pre-pull caster-to-target bearing (±15°, LOS; zero bearing uses cast yaw), and pull it to 1 m behind that target's accepted destination over 0.3 s. First reserve the native target IDs in the acquisition batch; extras exclude those, all previously acquired IDs and other reserved extras. Resolve primary targets by ID, nearest eligible extra then ID. Bind it for the originating source's remaining time, capped 2.5 s; at most one extra per primary target and 40 extras over the whole action, including all eight seconds of a Boundary. Record an extra as acquired by that cast, so a later crossing cannot reset its bind. Extra procession targets never acquire extras or Chain Holds leaps until a later independent action. This reshapes the control action, never moves the Binder. | A second chain draws the next angel into a short bound file behind the first. | applies `bound` | — | — |
| `binder.c.2b` | 2 | The Whip | augment | `RMB` | The Scourge lashes a straight line 7 m long in front of you instead of a 3 m arc. | Every enemy whose cylinder is within 0.75 m of the segment from your body center 7 m along the horizontal aim, at the heights the Scourge reaches; 25 dmg, 0.8 s. 10.5 m² against the arc's 9.4 m²: the same area, a different shape. | The chain cracks straight out along the floor, a 7 m streak of sparks. | applies `slowed` (as base) | — | — |
| `binder.c.3a` | 3 | The Boundary Chain | ability | `Q:boundary` | Teaches The Boundary Chain: an 8 s floor chain binds each crossing enemy for 2.5 s. | §4 | §4 | applies `bound`, `pooled` | — | — |
| `binder.c.3b` | 3 | Shattered Hymn | augment | `E:discord` | Discord's shout also breaks enemy projectiles in its cone. | Globes/arrows/volley orbs within30m, ±35°, LOS. Arrows vanish; globes/orbs make the native shot-down enemy-only40-damage/radius3m burst, credited to Binder with secondary interception provenance, no E kill/hit-count/recursive proc. This is distinct from the hostile impact's1.5m player blast. Silence/cooldown12s unchanged. | Orbs and arrows pop ahead of the gust. | — | — | — |
| `binder.c.cap` | 4 | The Wind of Cocytus | capstone | `passive` | Discord's freezing wind chains enemies after their silence ends. | Each ground/flying enemy affected by your Discord is bound in place for 2.5 s when that cast's 4 s silence expires, if still alive and in the same room. Brought Low may ground flyers. Silence remains, so the boss interruption remains; the Gatekeeper is never bound. If another silence overlaps, this cast's delayed bind still uses its own 4 s end. At most one bind per enemy per cast. | The silence's frost winds tighten into red-hot chains after four seconds. | reads `silenced`; applies `bound` | assigned `E:discord` to offer as a Rite | — |

**Tree C's pair:** none. Shattered Hymn remains legal with the capstone; Voice of the Pit excludes Shattered Hymn as the two Discord augments across trees. Six-point path: `c.1a → c.1b → c.2a → c.2b → c.3a → c.cap`, or `c.3b` for `c.2b`. The Procession works with base Chains or the Boundary alternative, so the capstone no longer forces an inactive Q augment. The Wind retains the boss interruption but its swarm bind is delayed four seconds: predict the coming peak rather than pressing it as a panic root. Frost, Boundary and the Well feed Sunk in the Lake; Barbed Rounds through bound files kill a Blessed per bullet.

## 4. New abilities

### The Well of the Giants (E, replaces Discord)

*The giants of the ninth circle stand chained in a well around the frozen lake. The Binder opens that well wherever it stands.*

| Field | Value |
|---|---|
| Taught by | `binder.a.3a` |
| Rule | Opens a well on the floor where you aim; for 5 s it drags every ground enemy within 7 m toward its center. |
| Numbers | Center: the crosshair's floor point walked like Cast Down's (at least 3 m, at most 20 m). Radius 7 m (enemy center within 7 m horizontally, feet on the same connected floor within 2 m of the well's surface, LOS). Duration 5 s. Drag 3 m/s horizontally toward the center, added to the enemy's own walk (a Blessed walking straight out makes 1 m/s; a slowed one, 2.8 m/s, can't leave); the drag stops within 1 m of the center and never pushes through walls. Drag targets are Blessed, Choristers and the elite; not ordinary flyers or the Gatekeeper; bound enemies don't drift. Actual ground-contact occupants of that footprint are `pooled`, including Brought Low flyers while grounded. No damage. One well per Binder (a new one closes the old). |
| Cooldown | 14 s |
| Visible effect | A black pit 2 m wide ringed with iron opens; chains coil out across a 7 m disc and turn slowly inward; the crowd on it visibly slides toward the pit. The disc's edge is a dim iron-grey ring so everyone sees where it pulls. |
| Sound | A deep iron groan when it opens, then a low wind-and-chain drone for 5 s that cuts off when it closes. |
| Better than the base ability when | The swarm is all Blessed (a crest, a horde room): it gathers a stream for 5 s instead of silencing enemies that don't cast; solo, thrown between you and the crowd, it holds the stream back while you kill the front; with Chains of Tartarus right after, the whole knot becomes one bound pile. |
| Worse than the base ability when | Choristers or Cherubs are the threat (it silences nothing; flyers ignore it; Choristers in it keep casting); on the boss (no answer to Judgment, the Gatekeeper doesn't move); against a crowd already on you (it pulls them to a point, not off you). |
| In a pure swarm | Place the well where the chase crosses it; its drag gathers inward-moving enemies and holds slowed ones near its center. An unslowed Blessed walking outward can still escape at 1 m/s, so the well alone does not promise a stationary pile. Slow the front with the gun or cast Chains/All of Tartarus, then Sunk in the Lake anchors the bound knot until that source's ceiling or the pool ends. Later arrivals must actually cross its 7 m footprint. |
| In co-op | Slow or bind the knot, then the Heretic throws a censer into it; a held Blessed dies to incense in 1.5 s (0.5 s bound). Without that setup an unslowed enemy can leave the cloud. The Fallen lands in the pit; the Betrayer drops the Field of Blood beside it, and the party fires into the held crowd. "Kill a `pooled` enemy" relics have the actual well occupants as their setup. |
| Host/client split | Host validates same-room aim within20m, reachable floor/LOS and cooldown, clips center and sends accepted area ID/center/radius/start/end ticks. Host owns drag and pooled membership; clients draw from synchronized area data. floorSync restores a still-active well after rejoin. Invalid floor/aim spends nothing. No movement envelope is granted. |

### Ring of the Giants (Q, replaces Chains of Tartarus)

*In Dante's Hell the giants ring the well like towers on a wall. The Binder pulls the crowd into the same ring around itself.*

| Field | Value |
|---|---|
| Taught by | `binder.b.3a` |
| Rule | Chains burst from the floor around you and drag every enemy within 7 m into a ring 2.5 m from you, bound. |
| Numbers | Every enemy within 7 m of your body center (to its cylinder) and in sight of it, all around, ground and flying (flyers keep their hover unless Brought Low); not the Gatekeeper. Each one is pulled over 0.3 s to the point 2.5 m from you along its own bearing (walked from your feet like today's pile point, so a wall brings it closer), then bound 2.5 s. Enemies already nearer than 2.5 m are pushed out to it. No damage. 2.5 m is past a Blessed's 1.2 m strike and inside the Scourge's 3 m. |
| Cooldown | 10 s |
| Visible effect | Red-hot chains shoot up from a 7 m circle and haul everything into a tight ring of bound bodies around the Binder, with an empty floor between the ring and the Binder. |
| Sound | The Chains clank from every side at once, then one heavy lock. |
| Better than the base ability when | The swarm is on you or behind you: on open floor it places the acquired crowd outside your melee/wading reach for 2.5 s and inside the Scourge's double-damage reach. Walls can clip destinations closer and later arrivals remain free, so the preview and an immediate follow-up swing matter; solo, it's the Binder's close rescue tool. |
| Worse than the base ability when | The enemies are farther than 7 m (a Chorister on a ledge, a stream that hasn't arrived): Chains reaches 20 m; and it can't drop a pile where the party wants it, only around you. |
| In a pure swarm | One Ring then one Whirl (1.2 s, within the 2.5 s bind) kills every Blessed within 7 m: bound Blessed take 50 per swing. Without Whirl, three swings (2.4 s) turning around cover the ring; with The Long Flail, the swing reaches 1.5 m past the ring into the free crowd behind it. |
| In co-op | The Fallen leaps onto the Binder: the 3.5 m crater covers the unobstructed ring and its bound enemies take 80. The Heretic's 3 m cloud at the Binder's feet covers the ring. The Betrayer dashes through a chosen chord, cutting 80 into the bound enemies its straight path actually touches; Shadowstep cannot trace the whole circle. |
| Host/client split | Host validates the cast, records each accepted clipped destination and source/end ticks, and owns the pull/bind. Clients draw the rising chains from the accepted Q event and predict no enemy movement. Canonical entity snapshots and floorSync restore surviving pulls and bind sources after rejoin. |

### The Boundary Chain (Q, replaces Chains of Tartarus)

*The Binder's charge was a line the damned must not cross on their way to the Earth. It lays the same line across the floor of Heaven.*

| Field | Value |
|---|---|
| Taught by | `binder.c.3a` |
| Rule | Lays a red-hot chain across the floor, square to your aim, where you aim; for 8 s every ground enemy that steps on it is bound where it stands. |
| Numbers | Center: the crosshair's floor point walked like Cast Down's (at least 4 m, at most 20 m). Length 12 m, square to the horizontal aim, each half walked sideways from the center and stopped by a wall, a closed door or a step over 0.5 m. An enemy is on it when its center is within its radius + 0.5 m of the chain horizontally and its feet within 1 m of the chain's height: it's bound 2.5 s, once per enemy per chain. Enemies within that strip are `pooled`. Ground enemies only; not the Gatekeeper. Lasts 8 s; one chain per Binder (a new one removes the old). No damage. |
| Cooldown | 12 s |
| Visible effect | A glowing red-hot chain lies across the floor, staked at both ends, rattling and flaring each time it binds. Bound bodies line up along it like a fence. |
| Sound | A clank and a spike driven into stone; a short link-snap for each bind (at most 4 per second, so a crest doesn't drone). |
| Better than the base ability when | The horde comes from one side (a door, a choke, a crest flowing across a 2×2): it holds the stream for 8 s instead of one 2.5 s pile; when you kite, it goes between you and the chase at up to 20 m. Bound enemies hold their place, so the crowd behind presses up against them (separation) and stacks. |
| Worse than the base ability when | The crowd is already on you or comes from all sides; flyers and casters that stand still never step on it; it makes no pile, so the Fallen's crater and the Heretic's cloud get a line, not a heap. |
| In a pure swarm | A 12 m fence on the crest's path holds about the flow rate × 2.5 s at any time (at 40 Blessed/s, about 100 bound); Barbed Rounds along it kill a bound Blessed per bullet (24 against 20 HP). |
| In co-op | The Fallen lands on the fence (3.5 m of bound bodies take 80); the Heretic lays clouds along it; the Betrayer stands at one end and fires the Silver Bullet down its length. "Kill a `bound` enemy" and "kill a `pooled` enemy" relics both fire on it. |
| Host/client split | Host validates and clips the connected floor segment, records area ID/endpoints/source/start/end ticks, tests eligible ground enemies through the spatial grid and owns each once-per-chain bind. Clients draw the accepted segment and derive visible pooled coverage from its synchronized area; combat membership remains authoritative. Events plus floorSync restore an active chain and its acquired entity IDs after rejoin. |

## 5. Content checks (manual design review)

- [x] 21 nodes, three ability unlocks and three capstones. Ability unlocks occupy no augmentation exclusion group.
- [x] Only one in-tree pair: B Whirl/Long Flail, both RMB. Cross-tree RMB also conflicts with The Whip; Discord's Voice of the Pit/Shattered Hymn conflict. All of Tartarus/Wind are state/control passives and never exclude lower-tier nodes.
- [x] Every six-point path and nine-point build below meets learned-only lower-tier gates. Rites cannot permanently license a node after the run.
- [x] New states: A Well pooled, B Voice airborne, C frost/Boundary pooled. External readers: Where They Fall airborne, Sunk in the Lake pooled.
- [x] Each tree has at least two low-tier attack/passive candidates. Actual Rite offers filter absent read-state sources, inactive named abilities and floor-inapplicable flyer-only cards; own-source requirements remain explicit. Conditional candidates are not advertised as always useful.
- [x] No new taunt, self-heal, shield, dash or leap. Fettered Hands stops melee, never casting. Every weapon hit retains Fetters; replacing Discord with the Well costs silence.
- [x] Grounding, delayed roots, chain transfer, secondary shards and persistent fields have bounded IDs/lifetimes and respect walls/rooms. Short roots cannot replace longer roots; bind multiplies damage once.

## 6. Scenario review and handoff

These are reasoned combat scenarios, not executed tests or measured balance.

**Keeper, solo nine:** A `1a → 1b → 2b → 3a → 3b → cap`, B `1a → 1b → 2b`; Q Chains, E Well. Cast the Well 5–10 m ahead, put Cast Down's pile inside it, then All of Tartarus catches the visible enemies in all directions. Sunk in the Lake holds that cast's root until the pool closes or its six-second ceiling. Walk up and Whirl: bound Blessed take50, while Fettered Hands prevents melee strikes and Chain Holds passes the remaining source time into the shell. Brought Low lets the same swing hit bound Cherubs. The Well never silences; swapping back to Discord at the Confessional trades sustained pooling for the boss interruption. Without a capstone, the directional cone and ranged destination still produce a useful loop.

**Breaker, solo nine:** B `1a → 1b → 2a → 2b → 3a → cap`, C `1a → 1b → 2a`; Q Ring, E Discord/Voice. Ring moves the close crowd to2.5m and binds it; Whirl bursts the ring; bounded chain shards kill some of the outside rank. Barbed Rounds reaches ranged enemies, Frost makes the chase slow, and Procession adds short files to a Ring cast rather than buying an inactive Chains augment. Voice throws unbound ground enemies outward; Iron Stride ignores slowed wading but never melee damage. Against flyers the gun does the work; a later legal Brought Low Rite can ground those caught by Ring. The one-Binder roster rule never supplies a second party Binder for this setup. A damage burst does not recursively shatter its own kills.

**Warden, solo nine:** C `1a → 1b → 2a → 2b → 3a → cap`, B `1b → 2b`, A `1b`; Q Boundary, E Discord/Wind. Lay the transverse Boundary10m ahead, fire Barbed Rounds along the bound files, and use the Whip when the close front arrives. Frost slows incoming enemies, Iron Stride gives normal6m/s movement through slowed crowds, and Fettered Hands protects against bound strikers. Discord's initial silence remains; the Wind's bound payoff arrives four seconds later and therefore must be timed before the peak. It does not add a root to the stationary Gatekeeper. The class still interrupts Judgment, while the trap itself contributes nothing against airborne Watchers.

**Spread3+3+3:** A `1a → 1b → 2b`, B `1a → 1b → 2a`, C `1a → 1b → 2a`; base Q/E. No shared augment slot: long destination plus bound chain transfer/grounded flyers, Whirl/movement/Discord launch, piercing gun/frost/Procession. Every low-tier point has a source in this kit. No new ability or capstone is needed to change its swarm shape.

**Rites:** Whirl, Barbed Rounds, Frost and Chain Holds work immediately on the base kit. Where They Fall is offered only with a producible direct airborne source (a present Fallen, own Voice, item or applicable loadout); Brought Low only if the authored floor has eligible flyers and the Binder has an effective own flyer-capable bind. Sunk in the Lake needs a producible pool. Absent sources never produce a knowingly dead card. All of Tartarus and the Wind require their named base ability assigned when offered. Taking another ability Rite can make an old augment dormant; it does not delete that learned point or reset a cooldown.

**Geometry:** Ring's2.5m radius is past a Blessed's1.2m melee range only on unobstructed floor. A clipped ring can land enemies closer; preview draws the clipped destination. Boundary is an8s trap with a2.5s bind per enemy, not an8s root. Procession extra targets use the original bind action's expiry, never propagate another acquisition, and respect its target cap. If no valid destination exists, reject before cooldown.

**Provenance and caps:** no Binder equipped Q/E natively damages enemies. Shattered Hymn breaks projectiles; their enemy-only40/3m interception bursts are secondary damage credited to the Binder and never become E kills. Chain Holds uses source tokens and remaining time, not last-owner flags; a transferred target cannot restart the original ceiling. Shatter, procession and transfer caps select stable nearest candidates from spatial queries. Instant control targets can remain uncapped where native abilities require the room-scale pile; secondary damage work is bounded separately. The host synchronizes fields/source/endpoints/heights and reloads restore them from floorSync.

**Playtest priorities:** All of Tartarus plus Field could over-simplify a peak; measure duration and usable target count before changing range. The Wind's four-second delay must read clearly. Whirl/Iron Stride must let a skilled solo Binder escape slow crowds while mistakes still take damage. No tests were run or created in this spec pass.

### 6.1 Collected veteran: ring brawler or ranged fence

In the Warden nine-node build, the learned C Whip occupies RMB, B already holds Iron Stride/Fettered Hands, and Q Boundary/E Discord are assigned. A **Whirl Rite** substitutes for the Whip, surrendering the seven-meter line for a three-meter full circle. B then owns three lower nodes (Iron Stride, Fettered Hands, Whirl), making **Ring of the Giants** a legal next ability Rite. Ring replaces the Boundary trap; no base Chains augment is manufactured, and Discord/Wind still works. This turns a ranged fence keeper into a close ring brawler during the same run.

Alternatively, keep the Whip and take **Voice of the Pit** while Discord is assigned, then **Where They Fall**. A's learned Chain Holds already supplies the tier-1 gate; Voice is a direct ground launch source for the new landing bind. Throw the front back, chain its landing and shoot down the files, at the cost of spending E before a caster wind-up. Shattered Hymn remains an alternative to Voice rather than a second Discord augment. Neither path needs a second capstone, borrowed learned gate or reset bind ceiling.

In the Keeper build, Long Flail can substitute for learned Whirl immediately because B already owns three lower nodes, while Barbed Rounds/Frost give additional low-tier ranged choices. In the Breaker build, C's three learned lower nodes license a Boundary ability Rite, changing Ring into the fence and retaining the learned bound-kill capstone. Brought Low offers additionally require the Binder itself to produce a flyer-capable bind; an allied root or a ground-only Boundary alone is insufficient. These distinctions keep the solo kit useful while preserving silence/Well and close/ranged opportunity costs.

### 6.2 Composed and alternative kits

**Delivered shout:** Voice of the Pit and Shattered Hymn remain two alternative Discord Payloads: the player chooses launched front ranks or interception. Whirl/Long Flail/Whip are competing Delivery geometries for the same Scourge damage/slow; accepting another geometry as a Rite substitutes only that learned Delivery. No extra projectile burst or second melee attack is invented.

**Improved alternatives:** Ring and Boundary explicitly work with Procession, Chain Holds, Sunk in the Lake and Fettered Hands wherever their original source/ground predicates permit. The Well supplies pooled membership to Sunk in the Lake but cannot itself silence or acquire a bind. Brought Low needs an effective own flyer-capable root, not Boundary's ground-only chain. The Keeper build's Brought Low point is a deliberate floor-specialist node: it does nothing against pure Blessed; retain the base-kit Scourge/pile loop and show the dormant target condition rather than claiming all nine nodes fire in every encounter.

**Two-discharge limit:** a Keeper with Chain Holds can add Frost, but cannot also take Chains Shatter. A Breaker with Chains Shatter + Frost cannot add Chain Holds as a Rite. These offers are filtered before drawing; losing an area/target does not secretly authorize a third always-equipped kill listener.
