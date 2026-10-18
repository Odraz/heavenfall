# Meatgrinder the roguelite: core rules

The rules of the whole game after the rebuild described in [brief.md](brief.md): a Doom-style 2.5D co-op horde shooter whose levels are generated like The Binding of Isaac's, with persistent characters, talents, relics and consumables. This document is the backbone: it fixes the systems, numbers and formats. Content (rooms, enemies, items, relics, talents, bosses) is defined by the files listed in §0, which must obey it. Rogue milestone briefs (`r00.md` through `r09.md`) turn it into implementation stages; older `m<n>.md` files describe the inherited build.

**Current baseline: revision 9 (2026-10-11)** reorders the milestones so each contract arrives with its first consumer, sets the verification policy (automated tests where the AI judges them useful; benchmarks on request after playtests) and rebuilds the art/audio prompt packs; it changes no rules, numbers or content quantities ([readiness-review.md](readiness-review.md)). **Revision 8 (2026-10-11):** [Development-readiness review](readiness-review.md) records repaired planning/runtime-boundary contradictions, current-code mappings and remaining playable evidence. Revision 8 aligns the milestone order, defines run-scoped held/targeted input and bounded synchronization, closes the persistent-admission handshake, and reconciles asset coverage. It changes no talent, item, relic or room quantities. Earlier revision reviews below are historical evidence, not reviews of these new clauses.

**R02 commander families (2026-10-13, implemented in R03, human feel acceptance open):** the Lectern Cantor leads Chorister waves and the Stray-Carrier leads Cherub waves, beside the Dominion for the rest (§4.6, [rooms.md §6.1–§6.3](rooms.md#61-the-commander-families)).

**R04 follow-up: the Watchman (2026-10-16, implemented, awaiting-human-play, [report](r04-watchman-report.md)):** an armed Blessed with an instant, line-of-sight shot after a visible 1 s aim. Wave stamping converts Blessed into Watchmen from the second wave on (§4.4, §4.6, [rooms.md §6.4](rooms.md#64-the-watchman), [brief](r04-watchman.md)).

**R02 playtest movement override (2026-10-13):** ordinary movement directly backward relative to aim runs at 80% of class speed; backward diagonals interpolate toward full sideways speed. Forward/sideways speed is unchanged. The penalty multiplies wading and applies during ordinary jumps, but not Shadowstep, Falling Star or forced launches. The host speed allowance uses the same directional factor. Dominion flying slams lead recent ordinary motion by up to 1 s before locking a safe destination; see [rooms.md §6](rooms.md#6-the-new-elite) and [the follow-up evidence](r02-playtest-report.md).

All numbers are **initial values** unless stated otherwise. Where this document deviates from the brief, it says so and why (summary in §16.1). **Revision 7 (2026-10-11)** repairs timed harvest, directional/area event identity, relic refusal, class and encounter interactions, effective-kit synchronization, developer-run isolation and implementation dependencies. [Revision-7 integration](../../research_notes/Isaac%20style%20roguelite/reviews/r7-integration.md) records the independent review and adversarial follow-up rounds. Revision 6's compatible composition and bounded provenance remain the foundation. The [slice acceptance checklist](slice-acceptance.md) separates specified behavior from implementation/playtest evidence. Historical prototype measurements below are evidence from revision 2, not measurements of this revision.

**Revision 2** (2026-10-11) applies the round-1 reviews ([r1-fun.md](../../research_notes/Isaac%20style%20roguelite/reviews/r1-fun.md), [r1-tech.md](../../research_notes/Isaac%20style%20roguelite/reviews/r1-tech.md)) and the coordinator's [r1-decisions.md](../../research_notes/Isaac%20style%20roguelite/reviews/r1-decisions.md): Rites (run-only talent picks), the enemy-state vocabulary, the Advocate's bargain, the Bell of Judgment, door reward previews, the Sundial (time bonus), Pilgrim's Return (teleport), Edicts, deed relics, Absolution, the multiplayer countdown rules, streak assists, a 10–11-room Pearly Gates, the 1 000-enemy crest, and every correctness fix of the tech review. Appendix A retains historical generated layouts; revision 3's walkthrough rules and catalog examples supersede their old content draws.

Research it relies on: [isaac_and_adaptations.md](../../research_notes/Isaac%20style%20roguelite/isaac_and_adaptations.md), [builds_items_persistence.md](../../research_notes/Isaac%20style%20roguelite/builds_items_persistence.md), [rooms_encounters_hazards.md](../../research_notes/Isaac%20style%20roguelite/rooms_encounters_hazards.md), [coop_bosses.md](../../research_notes/Isaac%20style%20roguelite/coop_bosses.md), [codebase_audit.md](../../research_notes/Isaac%20style%20roguelite/codebase_audit.md) and [What makes horde shooters fun.md](../../reports/What%20makes%20horde%20shooters%20fun.md) (below: *the report*).

---

## 0. How to use this document

- **Completed content files** (their formats are fixed here and repeated there):
  - [classes-fallen.md](classes-fallen.md), [classes-heretic.md](classes-heretic.md), [classes-binder.md](classes-binder.md), [classes-betrayer.md](classes-betrayer.md): talent trees and new abilities (§9).
  - [items-relics.md](items-relics.md): consumables (§7) and relics with combos (§8).
  - [rooms.md](rooms.md): the Pearly Gates room pool, the new enemy, the hazard and the props (§3, §4, §4.9–§4.10).
  - [bosses.md](bosses.md): the Pearly Gates boss and the mini-boss framework (§11).
- **Precedence:** this document wins over the content files; [classes.md](../classes.md)'s class identities and design rules and [lore.md](../lore.md) still hold, with §9.3–§9.4's explicit composition/alternative contracts superseding the original one-visible-effect wording for upgraded/new abilities. Everything in the shipped game that this document doesn't change stays as it is (M8, M9, M12 and [m12-followup-2.md](../m12-followup-2.md)).
- **Terms.**
  - **Run:** one attempt at one heaven, from the Lobby's Start to Results.
  - **Floor:** the generated map of a run. In the MVP a heaven has exactly one floor, so run = floor.
  - **Slot:** one cell of the 7 × 7 layout grid (§3.1). **Room:** 1, 2 or 4 slots. **Cell:** one 1 m map cell, as today.
  - **Human / bot:** a bot is a client started with `?bot=1` (today's dev bot); everyone else is human. A client tells the host it's a bot in `hello` (`bot: true`).
  - **Effective party size** `P` = connected in-game humans + 0.5 × connected in-game bots, at least 1. **Party multiplier** `mult(P)` = linear interpolation through (1, 0.4), (2, 0.6), (3, 0.8), (4, 1.0): the existing table (MVP §7.5), now fed with `P`. Bots count half because they fight well but play no mechanics, items or talents (§12.4). Code change: `partyMultiplier`/`scaleCount` take a fractional `P` (`sim.ts:114-135` index `MULT10` by an integer today); `scaleCount(n, P) = ceil(n × mult(P) − 1e-9)`.
  - **Solo:** exactly 1 human and 0 bots. Only then does the director's solo breath apply (M12 follow-up §3.1); today's boolean from the menu is replaced by this test. A run always has a **human host**; bot tabs only join that host and cannot start/retain a bot-only run. If the human host leaves or its process disappears, §12.2 ends the attempt even if bots remain alive.
  - **TP (threat points):** an enemy's cost in room budgets (§4.4).
  - **Enemy state:** one of the seven visible conditions of §4.11 (`bound`, `slowed`, `airborne`, `taunted`, `censed`, `silenced`, `pooled`) that attacks, abilities, items and hazards apply and that relics and talents read.
  - **Rite:** a talent node of the player's own class held for one run only (§9.10).
  - **Valley:** any moment when no room is in countdown or combat.
  - **Run clock:** host simulation ticks from the first playable frame, including countdowns, combat, travel and multiplayer overlays. A true solo Pause or offer overlay freezes simulation and this clock; multiplayer overlays freeze neither. Loading and reconnect loading do not reset it. The Sundial and Results use this one clock. Compare best times only within the same uninterrupted class/bot roster, exact Edict selection and rules version (§13.2); there is no online leaderboard in the slice.

---

## 1. Pillars and the reward rhythm

### 1.1 Pillars

Each is a rule every system below must serve. A system that serves none of them is cut.

| # | Pillar | Rule | Finding it comes from |
|---|---|---|---|
| 1 | **A decision every minute, feedback every half-minute** | At any moment the player has a choice that isn't "hold LMB": which pickup to dive for, which door next, ring the bell or not, which Rite, what to buy, what to learn. Initial playtest hypothesis: **at least 15 deliberate choices per human per 10 minutes** (§14.10), counting tactical/route tradeoffs rather than automatic confirmations or passive following. | The report: "decisions are missing"; Meier's "interesting decisions"; three relics per run was a tenth of the genre's rate. |
| 2 | **Going in pays** | Halos and heal motes drop inside the horde and fade; item drops wait for a valid use or inventory slot. The clear no longer heals to full. The safe ring earns less than the crowd. | The report: health never came from enemies; Doom's push-forward combat. |
| 3 | **Peaks and valleys** | Locked room fights paced by the director; cleared rooms, shops and the Confessional are the valleys, and each valley has something to do in it (break props, shop, learn, route). | Left 4 Dead's build-up/peak/relax; the report's 23-second cycles with nothing in the quiet. |
| 4 | **Need each other, survive alone** | Shared halos, one key per party, rescue and revive moments; every mechanic has a solo rule and a bot rule. | Left 4 Dead's "be the hero"; Fatshark's clutch rule; Destiny strikes vs raids. |
| 5 | **Visible consequences** | Every item, relic, talent and combo shows what it does; no invisible +X%. A native input plus its Delivery/Payload composition obeys §9.3's two-effect limit; separately authored passive reactions obey their own visible cues and bounds. | classes.md, explicitly revised by §9.3–§9.4; Isaac's visible items; Ghostcrawler on +5%/+10% talents. |
| 6 | **Bounded progress, new combinations across runs** | Persistent talents and relics add real power up to the heaven's cap; fresh characters retain a complete base kit. Random Rites, route rewards, consumables and optional risk change a run's build; Edicts challenge developed characters. A cap bounds veteran power; it does not make a level-1 and level-10 character equally strong. | Isaac's unlocks and build discovery, with the brief's persistent talent progression; level-sync is an analogy for the cap, not a parity guarantee. |
| 7 | **Every floor new, every room authored** | Layouts are generated; rooms are hand-made templates never repeated within a floor; each room has one fight focus (two at most). | Isaac, Enter the Gungeon (hand-made rooms "more fun and more fair"); Immortal Redneck's repetition warning. |

### 1.2 The reward rhythm

Feedback (sensations) and decisions are separate rows: pillar 1 is judged on the decision rows.

| Every | The moment | Kind | From |
|---|---|---|---|
| **~30 s** | 3-halo coins and heal motes drop in the crowd and fade; enemies light up in states (bound, slowed, airborne…); a streak tier banner; a level-up chord. | feedback | §4.11, §6.1, §6.2, §10 |
| **~1 min** | Dive for a mote or a coin, or hold the ring; set off a blast censer in the crowd; use an item (2 slots); stack a state for a relic's trigger. | decision | §4.9, §7, §8.1 |
| **~2 min** | A room clears: XP jumps, the clear reward lands (nothing, a gold halo, an item or a **Rite pick**), the next doors show their fight sigil **and their reward**, so the party picks its next fight; in a bell room, ring the bell (a harder wave for a Rite) or walk on. | decision | §3.4, §4.3, §4.12, §6.4, §9.10 |
| **~6 min** | Spend halos at the Pardoner (2 slots, 4 goods: what to carry); find the key and open the Reliquary (a relic choice); find or buy the Chart; teleport back or press on. | decision | §5.4, §5.5, §6.5, §6.6 |
| **Per floor (~20 min)** | Full clear or race the Sundial (a Rite at 14:00); at the Confessional, learn and respec, take or refuse the Advocate's bargain (a second relic for 30% of max HP); beat the boss. | decision | §6.8, §9.6, §11 |
| **Per session** | Level-ups and new talents, a new relic and combo to try, a deed done (a relic of its own), the next heaven unlocked, Edicts to raise the Sentence, whether to carry items into the next run at the risk of losing them. | decision | §2.4, §2.5, §8, §9, §13 |

About **3 Rites** per player per run (§9.10) are the "my kit changed" moments; the Confessional is the build's checkpoint.

### 1.3 Combat sound is part of the slice

The playtest report specifically identifies repetitive synthesized weapon sounds as a source of fatigue. The slice therefore includes recorded/layered replacements for the four primaries, damaging secondaries, impact/burst/mass-kill sounds and pottery breaks. The catalog's sound names are event identities, not a requirement to ship an oscillator placeholder. Each frequently repeated event has at least **three audibly distinct takes**, chosen from a shuffle bag without an immediate repeat; cosmetic audio randomness never consumes generation, combat or offer RNG. Chain Gun receives this treatment before the remaining weapons because it repeats twelve times per second. No extra ability or reward system is needed.

Keep the existing bounded mixer, weapon priority, mass-kill aggregation, limiter, volume settings and accessible visual cues. Boss/elite wind-ups must remain audible through the crest; a mass death emits one aggregated sound rather than one voice per victim. Every shipped recording has source/license provenance and permitted distribution recorded with the asset; choose a supported decoded format/fallback before play rather than stalling combat on a failed decode. Missing samples may use a development fallback, but that fallback does not meet slice acceptance. Additional music, voice acting and sprite replacement remain deferred. Acceptance is the player's ability to identify the important cue and tolerate a complete run, not merely the presence of audio files.

### 1.4 Learn the current kit and the floor's verbs

Retain the existing on-demand **H hints** and ability descriptions, resolving them from the **effective assigned abilities and active augments** after every accepted change. A Rite substitution or alternative must not leave a hint teaching the surrendered effect. Each combat input describes its present verb and a useful situation in one short line; dormant/suppressed effects stay identified in build cards rather than appearing as active instructions. Ready-ability hints remain available without a mandatory tutorial overlay.

The general hint panel includes `1 / 2: use carried items`, `F: the looked-at shop/chest/bell/Advocate; with no object, reopen a pending Rite`, `hold M: inspect known rooms; click a cleared room and stay still to return; release M to cancel/resume aiming`, and `Esc: close a choice without spending it; Pass refuses that Rite for this run`. It explains the shared key, individual two-slot item carry and the bargain's visible maximum-HP loss on their interaction cards. A new profile may see a dismissible Breach hint pointing to its required-route Rite preview and these controls; it does not freeze multiplayer or demand acknowledgment. First-use item cards (§7.3) supplement the hints. This addresses the playtests' missed controls and unread Lobby instructions while leaving the player in control of learning.

---

## 2. Session flow

### 2.1 Screens

```
Title / Main ──► Singleplayer ─────────────► Lobby (solo) ──► Loading ──► Floor ──► Results ──► Lobby
                          └──► Multiplayer ──► Host Setup ──► Lobby ─────────┘
                                          └──► Join ───────► Lobby
```

| Screen | Contents | Actions |
|---|---|---|
| **Title** | Logo, tagline, settings (volumes, screen shake) | `Play` |
| **Profile** | One current browser profile, opened only through title Settings. | `Copy code`, `Import code` with explicit replacement confirmation, `Clear` with confirmation, `Back`. No slots, downloads or file uploads. |
| **Main** | Editable `Player name` | `Singleplayer`, `Multiplayer`, `Settings`. Profile creation/opening happens on entry, without a separate first-launch screen. |
| **Host Setup / Join** | As today (M8 §6) | As today |
| **Lobby** | One view (§2.2), used in single player too | Everyone: pick a character, open `Talents`, `Relics`; host: pick the heaven, open `Edicts` (§2.5), `Start`; `Leave` |
| **Loading** | The loading card, as today; plus `Building the Pearly Gates…` | — |
| **Floor** | The game (§3–§12) | Pause: `Resume`, `Leave run` |
| **Results** | Victory/Defeat, run time, the Sentence and its XP factor (§2.5), the table (kills, damage, deaths, revive assists, best streak, Rites taken, XP gained, levels `4 → 6`, relics claimed, deeds done), the streak crown (§10) | `Back to lobby`, `Leave` (solo: `Back to title`). Show one level when unchanged; an arrow only for an actual level change. |

The title name field edits the current profile name on entry; multiplayer uses that name. In-game Settings never exposes Profile. Class levels sit in each class card above HP; carried items and collection summary sit below class selection and above dungeon selection.

### 2.2 The Lobby and the loadout

The Lobby is one fixed-size view; `Talents` and `Relics` each **replace it with their own full view** with `Back` (menu panels never resize). Party slots and character cards keep their rows aligned.

- **Party:** 4 slots (name, class, level, "host" or "bot" tag), as today. Each class once per party (today's rule). A player's character is their profile's character of that class (§13.2).
- **My character card:** class portrait, `Level 4 · 3 / 3 points` (spent / available), the Absolution rank if any (§9.2), equipped relics (2 icons, the combo badge if active), Q and E as assigned, the inventory (2 slots with counts; `Discard` per slot).
- **Talents view:** the three trees side by side, all nodes always drawn in fixed positions, Q/E assignment row under them (§9).
- **Relics view:** the collection grid (12 fixed cells in the MVP, unowned shown dark with `?`), the 2 equip slots, the combo list (§8.4).
- **Heaven picker (host):** the list of the nine heavens; enabled are those the **host** has unlocked (§12.3). Clients see the host's choice. MVP: only the Pearly Gates exists; heaven 2 shows `Coming later`.
- **Loadouts travel to the host:** each client sends `loadout` (§14.3) on joining the Lobby and after every change; the host checks it (§9.8) and broadcasts `loadouts` (level, Q, E, relics per player) for the party frames.
- **Start (host):** enabled when every human has picked a class and is back from Results and the host holds a legal `loadout` from every human (§9.8). Solo uses the same loadout validation. `Lobby.start()` draws two random u32s, `seed` and `simSeed`, and a random **128-bit lowercase hex `runId`** using the browser's cryptographic random source. The run id is a session identity, not the floor seed and not a collision-prone u32.

### 2.3 Runs, death and leaving

- **Start:** the host sends `start { heaven, floor: 1, seed, simSeed, runId, edicts, players, progressionEnabled }` (§12.1); a joiner's `start` (answering `enterGame`) carries the same. Normal admission moves each player's inventory into the run; disposable developer admission clones it (§13.4).
- **In the floor:** death is today's soul and revive (M8 §4). A room clear respawns the dead (§4.3). The boss room is revivable. **Defeat:** every connected player (bots included) dead at once, as today.
- **Victory:** the boss dies (the heaven's unlock and rewards are saved at that moment, §11.5); from then on nobody can be hurt and defeat is off; the run ends at the exit (§11.6).
- **Leave run** (Pause): that player's run ends as a defeat for them, or as a **Victory if the boss is already dead**; in multiplayer the party plays on.
- **Disconnects and the host leaving:** §12.2.

### 2.4 What is kept and lost

"After the boss" means the boss has died; from that moment the run counts as won for everything below (§11.5).

| | Victory | Defeat | Leave run | Host left (client) | Tab closed / crash |
|---|---|---|---|---|---|
| XP and levels | kept | kept | kept | kept | kept up to the last checkpoint (§13.5) |
| Talent allocation, Q/E assignment | kept | kept | kept | kept | kept |
| Rites (§9.10) | gone at the run's end, always | gone | gone | gone | gone |
| Relics claimed from the chest | kept | kept | kept | kept | kept (saved on claim) |
| The Advocate's pawned relic (§9.6) | kept (saved at the boss's death) | **lost** | lost; kept after the boss | lost; kept after the boss | lost; kept after the boss |
| Deeds and deed relics (§8.6) | checked and saved at the boss's death | — | after the boss: as Victory | after the boss: as Victory | after the boss: as Victory |
| Halos | lost: halos are run currency | lost | lost | lost | lost |
| Inventory | the run's inventory (saved at the boss's death and after every later purchase or use) | **emptied** | **emptied**; after the boss: as Victory | restored to what was carried in; after the boss: as Victory | emptied, unless the player rejoins the same run (§12.2); after the boss: as Victory |
| Heaven unlocked | yes | no | after the boss: yes | after the boss: yes | after the boss: yes |

**Why the inventory is the stake:** XP and relics are progress a player shouldn't lose to one bad room (every run has value), but a roguelite needs something at risk. Carried items are small (at most 2 stacks of 3), visible and chosen: "use it now or risk it" is a decision, and it stops hoarding. The Advocate's bargain (§9.6) adds a second, optional stake: a relic held in pawn until the boss dies.

### 2.5 Edicts and the Sentence

Hades' Pact of Punishment: an optional way to make a heaven hard again, for veterans and for parties whose talents and relics outgrew the base tuning (§9.7).

- **Unlock:** a heaven's Edicts are available once the **host's** profile has cleared that heaven at least once (`clears[h] ≥ 1`).
- **Choice:** in the Lobby the host toggles any of the 5 Edicts in the `Edicts` view (its own full view with `Back`); clients see them on the party panel. They travel in `start` and can't change during a run.
- **The Sentence** = the number of Edicts on (0–5). **Reward:** every XP gain of the run × (1 + 0.15 × Sentence) (Sentence 3 = ×1.45), shown on the HUD under the XP bar as `Sentence 3 · XP ×1.45` and on Results. Halos, items and relics don't change.
- **Record:** the profile keeps the best Sentence won per heaven per class (shown on the character card); a win at Sentence 3 or more is a deed (§8.6).

| # | Edict | The one rule |
|---|---|---|
| 1 | **Edict of the Host** | Each wave authored with elites adds one pre-scaling elite (+60 TP); compute the augmented group before party scaling, with alive cap 3. Rounding may keep solo headcount unchanged while increasing HP. No elite enters a pure-fodder crest. |
| 2 | **Edict of Penance** | No clear heal: the living don't heal 30% on a clear (the dead still respawn at 50%). |
| 3 | **Edict of Swift Hymns** | Choristers' globes and the boss's projectiles fly 30% faster. |
| 4 | **Edict of Poverty** | Coins and gold halos on the floor fade after 10 s instead of 20 s. |
| 5 | **Edict of the Trumpet** | The boss uses its phase-2 move from the start of the fight. |

---

## 3. Floor generation

### 3.1 The grid

- **Slot grid:** 7 × 7 slots, `(sx, sy)` with `sy = 0` at the top. **Slot pitch 36 cells:** a 4-cell wall band, then 32 interior cells. Slot `(sx, sy)`'s interior is cells `x ∈ [36·sx + 4, 36·sx + 35]`, `y ∈ [36·sy + 4, 36·sy + 35]`; bands are at `[36·k, 36·k + 3]` for k = 0..7. The full grid is `4 + 36·7 = 256` cells per side: exactly the `MAX_MAP_SIZE` limit, so **no code limit changes**.
- **Interior sizes:** 1×1 room **32 × 32 m**; 2×1 room (2 slots wide) **68 × 32 m** (the band between its slots is room floor); 1×2 **32 × 68 m**; 2×2 **68 × 68 m**. Arena 1 today is 40 × 40 m with 900 enemies; a 2×2 has 2.9 times its area, room for the **crest of at least 1 000 enemies alive at once** at 4 players (§4.6) with spawn points over 15 m from the party (audit §10.1 item 10).
- **Alignment:** slot origins and sizes are multiples of 4, so walls get full window/pilaster bands and full arcade bays (audit §1.6).
- **Crop:** the built `DungeonDef` covers only the bounding box of used slots plus their bands: width `36·(sxMax − sxMin + 1) + 4`, same for height. Cell coordinates shift by `(36·sxMin, 36·syMin)`.
- **Room shapes:** 1×1, 2×1, 1×2, 2×2 only. **No L-shapes in the MVP:** an arena is one rectangle everywhere in the code (zones, seal check, spawn filter, countdown test, floor looks; audit §1.6), and L-rooms would need a mask arena. Deferred (§15.2).
- **Rooms per floor** (all kinds, boss included): `N = 9 + h + r`, `h` the heaven number, **`r = fmix32(seed ^ 0x52) & 1`, drawn once per seed** (not per attempt, which would bias `N` toward the count that fails less). **The Pearly Gates: 10 or 11 rooms**, of which 4 are reserved rooms (Breach, Pardoner, Confessional, boss); the other 6 or 7 are normal fights (the Reliquary included), in addition to the boss fight. Isaac's room counts are 8–20, but a Meatgrinder room lasts 1–2.5 minutes, so the count is set for a **run of about 20 minutes** (Appendix A.2: 20:05 solo with a full clear and both bells; A.3: 17:08 for a party that skips two rooms). **The formula is fixed for the MVP (heaven 1) only:** on a 7 × 7 grid it fails often from heaven 4 (r1-tech §1.8: 90% within 20 attempts at 15–16 rooms, 25% at 20); heavens 4–9 need the grid change of §15.2 first.
- **Big rooms per floor (heavens 1–3):** exactly one 2×2 combat room and at most two 2×1/1×2. The boss room is an extra 2×2. (Later heavens: §15.2.)

### 3.2 Determinism

- The generator is a **pure function** `generateFloor(seed, heaven, floor, pool) → { def: DungeonDef, floor: Floor, map: GameMap }`, in `src/gen/` with no DOM, no three.js, no `Math.random`, no iteration over `Map`/`Set` keyed by objects, no transcendental functions (`Math.sin`, `Math.pow`, …). IEEE double `+ − × ÷`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.min`, `Math.max`, `Math.abs`, `Math.imul` and `>>> 0` are allowed: they give identical results in Node and every browser. Peers exchange only `{heaven, floor, seed}`; the build-version handshake pins the generator and the room pool (audit §4).
- **Attempt seed:** `s(a) = fmix32(seed ^ imul(heaven, 0x9E3779B1) ^ imul(floor, 0x85EBCA77) ^ imul(a, 0xC2B2AE3D))` for attempt `a = 0, 1, …`, with murmur3's `fmix32`. Each attempt runs a fresh `mulberry32(s(a))` (`sim/rng.ts`; it returns a bare function `f`), wrapped as `rng = { next: f, int: n => Math.floor(f() * n), pick: list => list[rng.int(list.length)] }`; weighted pick: walk the list in its order, subtracting weights from `rng.next() × total`.
- **Canonical orders** (everything iterates these, so every peer agrees): rooms in placement order (the Breach is room 0, the boss is last); a room's footprint slots in row-major order; directions N, E, S, W; template lists in pool order.
- **Other seeded rolls** (each from its own hash of the floor seed, so they don't depend on the attempt): the clear rewards (§6.4) and the Pardoner's stock (§6.6). The sim RNG gets a separate seed drawn by the host and drives combat/drop rolls. Player offers use isolated stable streams (§9.10, §8.3); opening menus cannot change the next combat drop.

### 3.3 The algorithm

For attempt `a` = 0 … 199 (each with its own `rng`, §3.2). **RNG draws happen only where a step says `rng`**, in the order written, so every implementation draws the same sequence. Slots outside the 7 × 7 grid count as free neighbors.

1. **Start.** `N` from §3.1. Core target `C = N − 1` (all but the boss). Place the **Breach** (1×1) at slot (3, 3). Queue = [Breach].
2. **Grow (Isaac's breadth-first rule, with big rooms).** While the queue isn't empty and fewer than `C` rooms are placed: take the queue's first room `R`; for each of its **exits** in canonical order (each footprint slot `c`, each direction `d`, where `n = c + d` is outside `R`'s footprint), stop if `C` rooms are placed, else:
   1. skip if `n` is outside the grid or occupied (no draw);
   2. skip if `rng.next() < 0.45` (Isaac's coin flip; one draw);
   3. skip if `n` has more than one occupied 4-neighbor (Isaac's neighbor rule; the one is `c`; no draw);
   4. **choose the shape** (one draw; the bands are exclusive): `u = rng.next()`; `u < 0.30` → 2×2 if one is still allowed (§3.1), else 1×1; `0.30 ≤ u < 0.40` → 2×1 if a 2×1/1×2 is still allowed, else 1×1; `0.40 ≤ u < 0.50` → 1×2 if allowed, else 1×1; `u ≥ 0.50` → 1×1;
   5. **fit a big shape** (no draw): try its anchors (top-left slots) whose footprint contains `n`, in row-major order of the anchor; an anchor fits if the footprint is inside the grid, all its slots are free, and **every 4-neighbor of every footprint slot, outside the footprint, is free except `c`** (the only edge to another room is `(n, c)`). The first fitting anchor wins (only then does it count against the allowance); if none fits, place a 1×1 at `n` instead;
   6. place the room as a child of `R` (the door is on the slot edge `(n, c)`) and append it to the queue.
3. **Reject** the attempt if fewer than `C` rooms were placed, or fewer 2×2 combat rooms than the heaven requires (heavens 1–3: 1).
4. **Graph facts.** The rooms form a tree (step 2.5 and the neighbor rule allow no adjacency without a door). `dist(R)` = number of doors from the Breach. A **leaf** is a room other than the Breach with exactly one door.
5. **The Confessional and the boss** (no draw). Candidates: 1×1 leaves `L` with `dist(L) ≥ 3` where a 2×2 boss footprint `B` can attach. `B`'s anchors are tried in row-major order among those whose footprint has a slot `b` 4-adjacent to `L`; an anchor fits if `B` is in the grid, its slots are free, every 4-neighbor of `B` outside `B` is free except `L`, and **`B`'s two faces on the side opposite `b`'s door (the gate wall, §11.1) are outer faces (§3.5)**, counting `B` as placed. The first fitting anchor is `L`'s `B`. Pick the candidate with the **largest `dist`** (ties: the lowest room index). `L` becomes the **Confessional**, `B` the **boss room** (the last room index), its only door the edge `(b, L)`. No candidate → reject. So the boss is far from the Breach (`dist ≥ 4`), has a single entry, its only neighbor is the Confessional ("close to the boss" = **adjacent**: every route to the boss passes through it), and the see-through Gate always stands on an outer wall.
6. **The Reliquary** (treasure room): `rng.pick` among leaves other than the Confessional, in room order, of shape 1×1 or 2×1/1×2, with `dist ≥ 3` (**minimum graph distance 3 from the Breach**: at least two other rooms between). None → reject.
7. **The Pardoner** (merchant): `rng.pick` among 1×1 leaves other than the Confessional and the Reliquary, in room order, with `dist ≥ 2`. None → reject.
8. **Normal combat rooms:** every core room other than the Breach, Pardoner and Confessional; the appended boss is also excluded. This candidate set **includes the Reliquary exactly once** (a combat room with a chest), as well as ordinary combat rooms. Assign `kind: 'combat'` to this set before marked-room selection; do not put the already-assigned non-combat kinds back into it.
9. **Marked rooms**, three picks in this order, each over rooms in room order:
   1. **key room:** `rng.pick` among normal combat rooms **other than the Reliquary**, with `dist ≥ 2`. None → reject; the party must bring the key from another fight rather than obtain it beside its own locked chest;
   2. **map reliquary room:** `rng.pick` among that same normal-combat set, already including the Reliquary once (§5.4);
   3. **bell rooms:** two `rng.pick`s without replacement among normal combat rooms that are neither the key room nor 2×2 (§4.12). Fewer than 2 candidates → reject (never happened in 10 000 seeds).
10. **Bands** (no draw): each combat room's difficulty band is `min(3, dist)`; **a 2×2 combat room's is `max(2, min(3, dist))`**, so the crest (§4.6) is never at band 1.
11. **Templates** (§4.7): pick for each room in room order: combat rooms (the Reliquary included) by `(heaven, kind 'combat', shape, band, not used on this floor)`, where a 1×2 room filters on shape `'2x1'`, by weighted pick on `weight`; the Breach, Pardoner, Confessional and boss from their kinds (weighted pick). Each candidate must have at least one valid orientation for that placed shape; a boss candidate additionally needs an orientation mapping its logical entry socket onto the actual boss door. Orientation validity follows §3.4's fixed physical threshold rule. If no template fits a combat room, drop the band filter, retaining the room's actual budget band. If still none, reject the attempt as an invalid content assignment; never repeat a combat template. A valid published pool must cover every possible shape count **and both rectangular orientations** without repeats. The authored fallback has fixed distinct assignments (§3.3 after step 15).
12. **Orientation:** the canonical list is rotations 0°, 90°, 180°, 270° clockwise, then the same four mirrored (x flipped before rotating). Transform authored cells/points/rectangles geometrically about the interior rectangle: mirror `(x,y) → (W−1−x,y)`, then clockwise rotation `(x,y) → (H−1−y,x)`, exchanging dimensions each quarter-turn. A combat, Breach, Pardoner or Confessional template gets `allowed[rng.int(allowed.length)]`, where `allowed` keeps only orientations mapping its long axis onto the room's **and satisfying every canonical physical threshold** (§3.4); `fixedOrientation` restricts it to valid identity (no draw). Do not assume eight square-room orientations are all valid. The boss takes the first valid orientation in the canonical list mapping its **logical** `entrySocket` onto its actual door (no draw). Socket identity follows the discrete side/footprint-slot action of §3.4; a transformed socket's off-center authored cell coordinates never relocate the physical doorway. No allowed orientation → reject, never carve through transformed gameplay geometry. **`rewardSpot` is an area origin, not a lone point:** transform all four corners of its inclusive 4×4 rectangle `[rx, ry]..[rx+3, ry+3]` by the cell transform, then store the transformed minimum x/y as its top-left. Derive any continuous center only afterward as `(rx′+2, ry′+2)`. Transforming the original top-left alone and re-expanding right/down shifts the square under rotation/mirror and is invalid.
13. **Props:** each prop socket of each template, in room order then template order, is filled if `rng.next() < chance`; in the map reliquary room the first `loot` socket is filled without a draw and becomes the marked reliquary (§5.4).
14. **Stamp and validate:** stamp the templates and vestibules into one grid (§3.4), build the `DungeonDef` and the `GameMap` (§14.2), run `validateLevel` with the rule changes of §14.2. Any error → reject.
15. **Accept.** The caller reuses the returned `GameMap` (§14.1).

After 200 rejected attempts, the heaven's **fallback floor** is used: a fixed hand-written layout in the pool (rooms.md) with fixed distinct templates, subject to the same implementation validation as generated floors. Its canonical count is **11**, including when the seed requested 10; this is the sole exception to `N`, explicitly reported as `fallbackUsed`. Clear rewards and shop stock still use the original floor seed, including the first mandatory Rite override; fallback never forces the example's illustrative reward or stock draws. The future generator acceptance check requires that **at least 99% of 1 000 seeds** succeed within 20 attempts, with the seeds pinned as `seed = imul(i + 1, 0x9E3779B1) >>> 0`, i = 0…999. §14.9's 99.71% measures the **historical revision-2 topology prototype**, not the current full pool/orientation rules; current success rates remain unmeasured. If a pool or rule change breaks the target, diagnose content/orientation rejection before tuning the coin flip (2.2), then the shape bands (2.4).

### 3.4 Doors and vestibules

- **Sockets.** Every slot edge has one socket: the 4 interior cells at offsets **12–15** along that slot edge (for a 2-slot side, offsets 12–15 and 48–51). Offset 12 puts the socket at world `36·s + 16`, a multiple of 4, so a doorway takes exactly one 4 m window/pilaster segment (`looks.ts:204`: a segment cut by a door is plain), 1.5 m off the slot's center. A 1×1 has 4 sockets, a 2×1 6, a 2×2 8, numbered clockwise from the top-left (1×1: N, E, S, W; 2×1: N-left, N-right, E, S-right, S-left, W; 1×2: the 2×1's list rotated 90°, i.e. N, E-top, E-bottom, S, W-bottom, W-top; 2×2: N-left, N-right, E-top, E-bottom, S-right, S-left, W-bottom, W-top). Unused sockets are wall.
- **Logical orientation versus physical doorway:** rotate/mirror socket **side and footprint-slot labels**, then look up the destination's canonical offsets above. For a square 1×1, a clockwise quarter-turn adds 1 modulo 4; for a 2×2 it adds 2 modulo 8. Horizontal mirror maps 1×1 N/S to themselves and swaps E/W; for 2×2 it swaps 0↔1, 2↔7, 3↔6, 4↔5. Rectangular side/slot mapping is explicit: 2×1 clockwise maps N-left→E-top, N-right→E-bottom, E→S, S-right→W-bottom, S-left→W-top, W→N. Apply the same side/slot transform for further turns/mirrors. Geometrically mirroring offsets 12–15 yields 16–19; these are **not** another doorway. After transforming authored content, validate the fixed canonical threshold cells at 12–15/48–51 (all potential sockets for non-boss templates, only the mapped entry for the boss). They must already be flat at `8`, with no physical obstacle, hazard, marker or prop. **Recheck every physical-strip-dependent content rule in the transformed geometry**, including spawn-marker ≥6 m separation, blast-prop ≥4 m separation and reward/hazard exclusions; a canonical measurement does not prove the rotated one. Stamp leaves/entry cells there without moving or flattening obstructive content. This filtering consumes no RNG draw. The fallback obeys it too; its Processional at 90° has all six canonical strips on clear base floor and retains the stated safety distances.
- **Threshold strip:** inward from each socket, 4 cells wide and 6 deep. Templates keep every strip flat at **socket height 2.0 m** (height character `8`), and free of walls, markers, hazards and props (§4.7). So any template fits any position, and a player standing in a doorway sees a calm foothold first.
- **Guaranteed rectangular fit:** identity preserves an authored 2×1's canonical strips. Horizontal mirror followed by 270° clockwise is the transpose `(x,y) → (y,x)`, which turns it into a 1×2 while preserving canonical offsets and strip distances. Thus the orientation filter has a geometry-preserving vertical option for every valid non-fixed rectangle; other rotations remain optional valid variants, not assumed doorway symmetries.
- **Entry cells** (per used socket): the 4 cells across the socket, 3 cells inward from it (inside the strip). Seal teleports (§4.3), respawns, rejoins in combat and Pilgrim's Return (§5.5) use them.
- **Vestibule:** the 4-cell band between two connected rooms, at the socket's 4 rows (or columns), is a short passage: **cell 1 is the near room's door leaf, cells 2–3 are vestibule floor at 2.0 m, cell 4 is the far room's door leaf.** The rest of the band is wall. Each leaf is 4 `D` cells, owned by its own room (listed in that room's `doors`), so **each `D` cell still belongs to exactly one room** (the loader's rule, audit §1.6).
- **Leaf state:** a room's leaf is **open iff the room is not in combat and either the room or the room on the leaf's other side is cleared** (§4.2; non-combat rooms are cleared on first visit, the Breach from the start). So the passage between two rooms is shut whenever either is fighting, an uncleared room can be entered only from a cleared one, and **nobody can run through an uncleared room** to the next one before its seal (that would skip fights and break the Sundial, §6.8). Every peer derives every leaf from the snapshot header alone (`activeRoom`, `activePhase`, `clearedMask`, §14.3), so doors never disagree with the room states.
- **Sightlines:** the zone rule (M10 §3.1: with all doors closed, no line from one zone reaches another) holds by construction (interior walls are taller than every zone next to them). With doors open, a player may see a neighboring room through a vestibule, as the Lobby's door shows Arena 1 today. That's allowed because open leaves happen only between rooms not in combat, which hold at most a leashed trickle (§4.8); hordes are only ever behind closed leaves.
- **Accepted height envelope:** the sealed-zone visibility check includes the highest supporting floor plus accepted jump/leap apex and the Called-to-the-Gate held lift, as well as visible enemy/part elevations. Do not size a wall from standing eye height alone; a legal launch/hold cannot reveal another room over its closed boundaries. The established zone wall-top calculation remains responsible for this envelope; local decoration does not silently become cross-room cover.
- **Door art:** each leaf's frame carries the sigil of **the room it opens into** (§5.2): the boss leaf is a tall gold gate leaf with a trumpet; the Reliquary's is white-gold with a chest; the Pardoner's has a halo coin; the Confessional's is dark wood with a grille; combat rooms show their focus sigil.
- **Reward plate** (Hades' door preview): under a combat room's sigil, while that room is not cleared, a small plate shows **its pre-rolled clear reward** (§6.4): an empty frame (nothing), a gold halo, the item's own icon, or a Rite (a burning page). The Reliquary's plate shows its roll beside the chest. The key and the bells are not previewed. The world and the map (§5.2) use the same signs.

### 3.5 Windows: views only on outermost faces

- A **face** is one side of one slot of a room, on the room's boundary.
- **Outer face:** the face of slot `(cx, cy)` toward direction `d` is outer iff **no slot in its view cone is occupied** by any room. The view cone toward E is every slot `(x, y)` with `x > cx` and `|y − cy| ≤ x − cx` (a 90° wedge widening by one slot per slot out); the other directions are the same rotated. This matches every red line in brief image 1 (a straight-out ray alone would allow diagonal views onto other rooms' outer walls).
- **Open edges** (arcade views) are allowed only in the wall band cells next to an outer face. Every other wall stays solid. The generator emits a `viewMask` (§14.2); `computeHeights` applies it **before** its facing loop (fewer candidates, §14.1), and its 150 m facing rule still runs. The mask is still needed although the facing rule nearly agrees (r1-tech §1.5): it stops arcades on template wall stubs joined to the band.
- **Measured** (prototype, 10 000 Pearly Gates floors): 61% of rooms have at least one outer face; **the Breach has one in only 15%** (it sits at the grid's center). The open sky stays over every room. The Breach template may therefore paint sky windows on its walls (a texture, no opening, so the zone rule holds); no other template may.
- Cloud cards and spires (atmosphere) are placed only outside the cropped bounding box, beyond outer faces.

### 3.6 Roofs: none in the MVP

Every room is open to the painted sky. The sim, line of sight, Cherub flight and the baked floor light are one heightfield with no ceilings (audit §2.5); a roof would need a ceiling layer in LOS, the lightmap and shadow lines. The sky over every room is one of the things the playtesters praised. Cosmetic beams above the zone top are deferred (§15.2).

---

## 4. Rooms

### 4.1 Room kinds

| Kind | Name in game | Shape | Fight | Notes |
|---|---|---|---|---|
| Start | **the Breach** | 1×1 | no | The 4 `S` spawn cells; up to 4 doors; vases to break. |
| Merchant | **the Pardoner's stall** | 1×1 leaf | no | 4 item pedestals + 1 map pedestal (§6.6). |
| Leveling | **the Confessional** | 1×1, exactly 2 doors | no | **The Advocate** (§9.6); heals each player to full on their first entry per floor. |
| Treasure | **the Reliquary** | 1×1 or 2×1 leaf | yes | A normal fight; on clear, the locked reliquary chest descends in a beam (§6.5). |
| Combat | (by focus, §4.5) | any | yes | One key room, one map reliquary room and two bell rooms among them (§3.3, §4.12). |
| Boss | (per heaven) | 2×2 leaf | yes | Entered only from the Confessional (§11). |

**Dispatch by room kind, never by an empty wave list:** only `breach`, `pardoner` and `confessional` are non-combat rooms, **cleared on first visit** without sealing or spawning. Their playable floor may be smaller than the slot (the template walls it in, 16–24 m across), as the brief asks. `combat` (including the Reliquary) seals and runs its nonempty ordinary waves through the director. `boss` seals and starts its authored boss encounter (§11, bosses.md) despite `waves: []`; it clears only when the boss's death latches victory. Replace the existing arena loop's wave-list skip (`sim.ts:967-987`) with this kind-based dispatch. An empty ordinary-combat wave list is invalid content, never a shortcut to clearing a fight.

### 4.2 Room states

Each room has a **phase** (host-authoritative) and **map knowledge** (party-wide):

| | Values | Meaning |
|---|---|---|
| Phase | `idle → countdown → combat → cleared` | Ordinary combat and boss rooms; only Breach/Pardoner/Confessional go `idle → cleared` on first visit. A countdown can fall back to `idle` (§4.3). A rung bell room goes `cleared → countdown → combat → cleared` once more (§4.12). Boss clear requires its victory latch (§11.5). |
| Knowledge | `undiscovered → discovered → visited` | Visited: a human's feet have been inside its rect. Discovered: a neighbor of a visited room (its doors were seen), or revealed by the map (§5.4). Knowledge never goes back. |

**At most one room is in countdown or combat at a time** (performance: one horde, one director, one set of flow fields; and it keeps the party together).

### 4.3 The fight: locking, stragglers, bots and the dead

Replaces M8 §5's arena countdown. `H` below = living connected humans.

1. **Countdown starts** when a living human's feet are inside an idle combat room's rect and no room is in countdown or combat (or when a bell is rung, §4.12), **only before victory/defeat has latched**. Timer **20 s**. Its leaves follow §3.4; nothing spawns. (If another room is active, nothing happens; the HUD says `Another room is sealing`.)
2. **It ticks only while the party is there:** the timer runs only while at least **⌈H ÷ 2⌉** humans have their feet inside the rect or its vestibules. Otherwise it holds and the HUD shows `Waiting for the party (1/4)` (inside / `H`). Solo: 1 of 1, so nothing changes.
3. **It holds for noncombat errands:** it also holds while any living human stands in the Pardoner's rect or has an overlay open (Advocate view, relic offer, Rite pick, Pause, §2.1). Rite/relic choices, bargains and Advocate transactions may commit during the countdown under their ordinary living-player, range and room checks (§9.10); actual sealing closes/rejects them. Merely standing in the Confessional does not hold the adjacent boss countdown; an open Advocate view does. These holds add up to at most **45 s per room**; elapsed held simulation time counts once regardless of how many players are shopping. Cancellation does not replenish this allowance. The HUD shows `Waiting for Jana (shopping)`.
4. **Everyone in:** when every living connected human's feet are inside the rect and none stands in a vestibule, the timer drops to the smaller of its value and **3 s** (rule 3 still holds it). Bots never hold it up.
5. **Cancel:** if no living human is inside the rect for 3 s in a row, the room goes back to `idle` (it stays visited). A scout can peek. If `H = 0`, the timer never advances and the same cancellation applies; universal statements in rule 4 do not count an empty human party as everyone inside. A pending bell returns to `cleared` with its bell available (§4.12). Bots prioritize reviving a human; if every connected player is dead, defeat ends the attempt.
6. **Seal at 0:** the room enters combat. Its leaves close. Every living player (bots included) whose feet are outside the rect, or in a vestibule, is teleported to the **entry cells** (§3.4) of the socket the first entrant came through (`entrySocket`, one cell per player index). Souls outside it are moved there too. Every open overlay closes (what it offered stays: §6.5, §9.10). A Pilgrim's Return channel breaks (§5.5). `P` and `mult(P)` are fixed here (as M8 §6.3). Record this **encounter's recipient profile ids**: all admitted, unclosed humans at this seal, including temporarily disconnected records. The ordinary fight and optional Bell have separate recipient sets. Subsequent joins get shared connected XP/halo credits but no retroactive clear/Bell/chest entitlement; reconnect retains its prior entitlement. Rules 2–3 mean the teleport now moves only a minority who chose to stay out.
7. **Ordinary combat/Bell waves:** the room's waves (§4.6) through the existing director (M12 §2.3); the boss uses its authored encounter instead. Its living cap is the largest scaled wave **plus the allowed 30% carry-over of the preceding wave**, bounded by the global 1 500-enemy cap; never just the largest wave, which would prevent the specified overlap. Waves prefer spawn points farther than **`SPAWN_FAR_DIST`** from every living player: **10 m in a 1×1**, **15 m in 2×1 and 2×2 rooms**, then M12's 8 m fallback. Never use a point within 3 m of a living player. If none is safe, keep the spawn queued and warn at the farthest reachable point; place only after it is safe. After **2 s** of all authored markers being proximity-blocked, search the room's precomputed dry ground-reachable floor cells outside threshold strips/reward spots/hazards, choosing the point with greatest minimum living-player distance (ties row-major). Require at least 3 m, warn there for **1 s**, and revalidate before placement; no unsafe point forces a spawn. Prefer authored markers again when available. This fallback replaces a queued placement, never adds an enemy or reward entitlement, and applies to boss adds and trickles as well. A visible arrival is not allowed to hit on its placement tick. Queued spawns still count as unfinished waves, and all-clear waits for them. A wave normally arrives over 10 s (the crest over 6 s, §4.6); safety and entity caps may extend that time.
8. **Ordinary/Bell cleared:** every wave fully spawned and nothing alive. Leaves open; **every connected living player heals 30% of max HP** (not under the Edict of Penance, §2.5); **the dead respawn on the entry cells at 50% HP**; the clear reward appears (§6.4); XP for the clear is given (§9.1); in a bell room the bell appears (§4.12). The host also resolves a retained disconnected dead human's life state to alive at 50% at this actual clear; that record does not receive an absent living-player heal. Bell clears use the same dead-state recovery, without the living heal. The boss never clears through empty ordinary waves and receives only its separate victory settlement (§11.5).
9. **Anti-softlock:** every 5 s the host checks enemies with no reachable living target inside the sealed room. After 10 s continuously unreachable, relocate that enemy to the farthest safe reachable spawn with a 1 s beam, keeping HP, states, queued-wave accounting and reward entitlement. Only if no legal floor point exists for another 10 s, remove it without kill/proc/streak credit and settle its unused room XP entitlement (§9.1); this is a generation defect reported in diagnostics. After the last wave is fully placed, each of at most 10 remaining enemies that individually has neither moved 1 m nor taken damage for 20 s is handled the same way. One moving enemy cannot protect other stuck enemies. Queues blocked only by proximity get no XP until placed and killed or the same unreachable-floor recovery applies.
10. **First-time joiners** during combat enter as a soul on the entry cells (M8 §6.2). A known-profile resume restores its retained life state under §12.2; reconnect is not another first-time admission or a free resurrection.

**Why no full heal on clear (deviation from today's `sim.ts:1109`):** a full heal every 2 minutes makes HP worthless between rooms, which would kill the heal items, the Pardoner and the "going in pays" motes. **The replacement sustain:** the Heretic (unchanged), the 30% clear heal, heal motes from ranged and elite kills and urns (§6.2), the solo breath during relax (M12 §2.5, kept; solo as defined in §0), small heal items (§7), and a full heal at the Confessional before the boss.

**Exact passive sustain:** true solo ordinary sealed combat retains the follow-up breath: 8% of effective max HP per second after 2 s without damage, only while its director is in relax, with at least 6 s before the next wave. There is **no passive regeneration in idle, countdown or cleared rooms or vestibules**; waiting in a corridor cannot replace a heal purchase or risky mote. True solo boss combat retains the separate baseline 1.5% of effective max HP per second after 8 s without damage. Accepted damage to HP or shield restarts the appropriate timer; death never regenerates. Other party compositions have neither passive channel. Effective max HP includes the bargain. Active explicit healing abilities/items remain available under their own rules.

### 4.4 Threat budget

- **TP per enemy:** Blessed 1, Watchman 3 (rooms.md §6.4), Cherub 4, Chorister 6, each Pearly Gates commander 60 (the Dominion, the Lectern Cantor and the Stray-Carrier, rooms.md §6); no other new enemy in this slice.
- **Room budget** (TP at 4 players) = `base(shape) × band factor × heaven factor`:

  | Shape | base | Waves | Target clear time (any party size) |
  |---|---|---|---|
  | 1×1 | 400 | 3 | 60–90 s |
  | 2×1 / 1×2 | 700 | 4 | 90–120 s |
  | 2×2 | **2 000** | 5, the last is the **crest** (§4.6) | 120–180 s |

  Band factor: band 1 **0.85**, band 2 **1.0**, band 3 **1.15** (a 2×2 is never band 1, §3.3 step 10). Heaven factor: the Pearly Gates 1.0 (later heavens set theirs).
- **Party scaling:** each type's count per wave is computed at 4 players (`n4`), then scaled: `nP = scaleCount(n4, P)` (§0). **Elites** scale the same way, and each elite's HP is multiplied by `n4 × mult(P) ÷ nP` (solo: one elite at 40% HP where a party of four meets one at 100%). Composition shares refer to the **unscaled authored TP ledger**, not rounded headcounts or HP of different enemy types. Rounded solo counts can differ slightly in actual TP; XP uses the exact ledger of §9.1. Elite alive caps apply to every wave, including bells; reserve queued elite placements until below the cap (2 base, 3 under Edict of the Host).
- **Why these numbers:** a 4-player party kills about 30 Blessed per second when it does its jobs (classes.md: 5–9 each, well above on stacked crowds). A 1×1's 400 TP is about 15 s of killing inside three director cycles: 60–90 s. A 2×2's 2 000 TP is about 67 s of killing plus four build-ups and the crest: 2:00–2:30. Solo faces 40% (160 / 280 / 800 TP) at 5–9 kills per second, with the solo breath: the 2×2 takes 2:15–3:00 solo.

### 4.5 Fight focus (archetypes)

A combat template has one **focus** and at most one **secondary** focus. Blessed (the fodder) don't count as a focus; they're in every room.

| Focus | Shapes | Composition (share of the room's TP) | Geometry it needs (obstacle purposes, §4.7) |
|---|---|---|---|
| **horde** | 2×1, 2×2 | Blessed ≥ 85% | Open floor (canyon); at least 2 `kite` and 1 `choke`; at least 1 `high` with 2+ stairs. |
| **ranged** | 1×1, 2×1 | Choristers 15–30% | At least 4 `cover` blocking lines from the Choristers' spawn side; at least 1 `high`. |
| **flyers** | 1×1, 2×1 | Cherubs 15–30% | Few tall blockers (at most 2 `cover`); low walls (1–2 m) are fine. |
| **elite** | 1×1, 2×1 | 1 elite per wave from wave 2, at most 2 alive; elites ≤ 40% | At least 2 `kite`; the elite's spawn points visible from the room's middle. |
| **hazard** | any | Blessed ≥ 70% | Hazard cells 10–25% of the walkable floor, with `lure` obstacles at their edges. |
| **ground** | any | ground heavies ≥ 20% | Reserved for heavens with a ground heavy; not in the Pearly Gates. |

- **Watchmen** (rooms.md §6.4) are converted from Blessed at stamping and count **with the Blessed** for composition shares, focus checks and the palette rule below; they are fodder with a gun, not a focus type.
- **Secondary focus:** adds that focus's enemies at half its share range (e.g. ranged secondary: Choristers 7–15%), or for hazard: hazard cells 5–15%.
- **Allowed pairs** (primary + secondary, either way round): horde + flyers, horde + hazard, horde + elite (2×2 only), ranged + hazard, flyers + hazard. **Not allowed:** ranged + flyers (two sources of long-range fire is too much to read), elite + hazard in heavens 1–2. A room never has more than 2 non-fodder enemy types (Level Design Book's palette rule).
- **2×2 rooms** have a horde or hazard focus (the shapes column), and every 2×2 ends in the crest.

### 4.6 Waves inside a room

**October 13 R02 Dominion pacing revision:** generated combat waves now use **0, 1, 2, 3, ... Dominions before party scaling**, determined by zero-based wave index. This replaces the earlier baseline-plus-authored elite counts, including in elite-focused rooms and the crest. The first wave has none; authored minions remain unchanged. Preserve existing group HP scaling, safe placement, the two-alive cap and retained queues; later queued commanders must spawn before their wave finishes. Templates/TP focus validators describe authored minions before this runtime commander ramp. XP preparation must count the actual final commander group at 60 unscaled TP each. **Commander families (accepted 2026-10-13, not implemented):** a wave whose authored mix includes Choristers gets a Lectern Cantor as its first commander, one with Cherubs a Stray-Carrier; every other commander, the crest's, Bell elites and Edict-of-the-Host elites are Dominions. At most one Cantor and one Carrier are alive per room, under the shared commander cap; an excess family master is placed as a Dominion (rooms.md §6.1). Boss summons and legacy fixed encounters retain their explicit compositions. The current leap, melee and nonlethal enemy displacement rules are in rooms.md §6.

- A template lists its waves: `{ share, mix, elites }` (§4.7). `share` is the wave's fraction of the room budget (shares sum to 1). `elites` is a count at 4 players; its TP comes off the wave's share first. The rest is split by `mix` (fractions summing to 1) into whole enemies: `count = round(rest × mix[type] ÷ TP[type])`, at least 1 where the fraction isn't 0. Record each type's **exact assigned TP before rounding** for XP (§9.1). An Edict-added elite is an extra 60 TP at 4 players, outside the normal composition ledger; it does not replace fodder or enter a fodder-only crest. A Bell's two elites are also extra TP outside its 40% base mix.
- **Default shares** (templates may override, except the crest's): 3 waves 0.25 / 0.35 / 0.40; 4 waves 0.15 / 0.25 / 0.28 / 0.32; **2×2: 0.07 / 0.08 / 0.10 / 0.15 / 0.60**. Wave 1 is fodder only (the party reads the room); the focus type enters from wave 2; the last wave is the room's peak.
- **The crest** (every 2×2's last wave): share **≥ 0.60**, **Blessed only** (flyers, Choristers and elites come in waves 2–4), arrives over **6 s** instead of 10 s, and its spawn points place up to **20 enemies per second each** instead of `SPAWN_RATE` 10 (a new constant). 2×2 templates need **at least 24 spawn points** (§4.7 rule 4), so even with half of them within 15 m of the party, 12 × 20 = 240 per second carries the crest's 200 per second.
- **The peak, 4 players, band 2:** the crest starts by the director's normal rule, when at most 30% of wave 4 (300 TP) is alive. Its 1 200 Blessed arriving over 6 s would leave 1 020 alive if the party killed 30 per second and no carry-over remained. This is a **modelled crest target**, not a guaranteed observed population: stronger builds, fewer safe spawn points and cap delays change the peak. Acceptance requires a controlled four-human base-kit reference encounter to reach **at least 1 000 alive** while remaining responsive; actual play may kill faster and should be rewarded for it. Do not suppress kills, make enemies invulnerable or add surprise refill enemies to force the number. Band-3 crest budget is 1 380 Blessed; all queued placement is bounded by the 1 500 global cap. Solo band-2 crest is 480 Blessed. These values need measuring in the implemented build (the benchmark runs when the human asks, after playing).
- **Watchmen (R04 follow-up):** after the counts above, every ordinary wave from the second on converts `W = floor(B ÷ 24)` of its `B` Blessed (at 4 players) into Watchmen at 3 Blessed each, `floor(B ÷ 10)` in a template with a ranged focus or secondary (2026-10-16 playtest; was 30 and 12). None in the first wave, a wave with Cherubs, the crest, trickles or the boss encounter; a Bell wave converts its last-wave mix the same way. Their exact TP comes out of the Blessed's exact share for XP. They scale with `scaleCount`, arrive as a squad and have their own alive cap (rooms.md §6.4).
- The director, its phases and thresholds are unchanged (M12 §2.3); it now runs per sealed room instead of per arena (`new Director(waves, cap, solo)`).

### 4.7 Room template format

Templates are TS modules in `src/data/rooms/<heaven>/<id>.ts`, authored at canonical orientation (2×1 = two slots wide). Coordinates are template cells, `(0, 0)` the top-left interior cell; rects are inclusive.

```ts
type Shape = '1x1' | '2x1' | '2x2';
type Focus = 'horde' | 'ranged' | 'flyers' | 'elite' | 'hazard' | 'ground';
type Purpose = 'cover' | 'kite' | 'high' | 'choke' | 'jump' | 'spawn' | 'lure';
interface Rect { x0: number; y0: number; x1: number; y1: number }

interface RoomTemplate {
  id: string;                    // 'pg-c-1x1-ranged-01'; unique in the pool
  heaven: number;                // 1 = the Pearly Gates
  kind: 'combat' | 'breach' | 'pardoner' | 'confessional' | 'boss';
  shape: Shape;                  // breach/pardoner/confessional '1x1', boss '2x2'
  focus?: Focus;                 // combat only
  secondary?: Focus;             // combat only, an allowed pair (§4.5)
  bands: [number, number];       // inclusive, within 1..3; combat only
  weight: number;                // > 0; default 1
  fixedOrientation?: boolean;    // default false
  entrySocket?: number;          // boss only: its one socket (§3.4 numbering)
  heights: string[];             // 32×32, 68×32 or 68×68; '#' wall, '0'..'z' floor index (0.25 m steps)
  markers: string[];             // same size; '.', 'x' spawn point, 'S' (breach only, exactly 4), decor keys
  obstacles: { rect: Rect; purpose: Purpose; note?: string }[];
  hazards: { rect: Rect; hazard: string }[];          // hazard ids from rooms.md
  props: { at: [number, number]; family: 'loot' | 'blast' | 'blessing'; chance: number }[];
  rewardSpot: [number, number];  // top-left of a flat 4×4 floor area (clear reward, key, chest)
  waves: { share: number; mix: Partial<Record<EnemyId, number>>; elites?: number }[];  // combat only
  spawnAffinity?: Partial<Record<'chorister' | 'dominion', Rect[]>>; // preferred existing x markers
  spawnTags?: { at: [number, number]; only: ('chorister' | 'dominion')[] }[]; // restrict existing x markers
  points?: { advocate?: [number, number]; pedestals?: [number, number][]; boss?: [number, number];
             watchers?: [number, number][];
             addSpawns?: { gate: [number, number][]; field: [number, number][] } };
  gate?: GateDef;                // boss only, in template coordinates (§14.2)
}
```

**Validation** (production content validation; a template failing any rule is rejected; the whole pool is checked by unit tests):

1. Grid sizes match the shape; floor heights 0–8.75 m. **A template's base floor is at socket height** (index `8`, 2.0 m); obstacles are the cells above or below it, so walls and zone tops start 2 m higher (wall top ≥ 2 + 8 m).
2. Every socket's 4 cells and threshold strip are floor at index `8` (2.0 m) with no marker, physical obstacle, hazard or prop (boss: only `entrySocket`; its other sockets may be wall). An `obstacles` purpose rectangle may include flat approach/strip cells; the rectangle labels authored geometry and creates no collision by itself. No wall or off-base floor inside it may occupy the usable threshold.
3. **Every obstacle has a purpose:** every 4-connected group of wall cells inside the interior, and every group of floor cells not at socket height, is covered by at least one `obstacles` rect. Untagged geometry fails. Exempt: wall connected to the room's outer wall that only closes the playable floor in (a non-combat room's 16–24 m floor, the boss template's gate-side insets, §11.1).
4. **`kind: 'combat'`:** at least **8 / 12 / 24 unrestricted** spawn points (1×1 / 2×1 / 2×2; the 2×2's crest needs 24, §4.6), each at least 6 m from every threshold strip, reachable by ground enemies. Optional `spawnTags` refer to distinct existing `x` cells and contain one or both of `chorister` and `dominion`; only those types may use that marker. Restricted markers are additional to the unrestricted minimum, never extra enemy entitlements. Transform tag coordinates with the template. Breach/Pardoner/Confessional: **zero** enemy spawn markers. **`kind: 'boss'` is a separate encounter:** the Gate has its explicitly authored **20 add markers** (eight gate, twelve field) and twelve Watcher anchors, checked for its sole canonical entry's clearance, reachable safe add geometry and shootable part geometry. Its encounter-specific marker groups are separate from ordinary `spawnTags`; it has no ordinary five-wave crest and is neither a zero-marker non-combat room nor a 24-marker ordinary 2×2 fight.
5. Hazard cells: inside the focus limits (§4.5), never in a strip or the reward spot.
6. `rewardSpot`: 4×4 flat floor, no hazard, outside the strips.
7. **Ordinary combat waves only:** shares sum to 1 (±0.001), each `mix` sums to 1, elite TP fits its wave's share, composition meets its focus (§4.5) at band 2, and a 2×2's last wave is a crest (share ≥ 0.60, Blessed only). Breach/Pardoner/Confessional/boss have empty ordinary wave lists; the boss's authored encounter replaces this check.
8. **Ordinary combat prop counts only:** per 1×1, loot 4–8, blast 1–3, blessing 0–1 (×1.5 for 2×1, ×2 for 2×2, rounded down), measured as the expected count: **`Σ chance` over the family's sockets is in range**. Every combat template has at least one `loot` socket (the marked reliquary may land there, §3.3 step 13). Special kinds use their expressly authored prop lists, including zero; all props still obey geometry/safety rules.
9. **Geometry validation:** check every accepted orientation against `validateLevel`'s geometric invariants (enemy reach = player reach, no jump-only safe perches, sealed with leaves closed). A template fixture connects the template's legal entry to a Breach; a Breach template supplies its own four `S` cells rather than adding a duplicate Breach. A boss fixture uses its sole entry and §14.2(d)'s static-body-dais exemption while keeping add/part access strict. The **template-fixture scope** omits full-floor cardinality requirements (exactly one boss, all special kinds, N/graph/marked-room counts); full stamped-floor validation reinstates all of them. Do not reject an ordinary template fixture merely because it intentionally contains no boss, or waive sealed geometry in a complete floor.
10. `spawnAffinity` keys are only `chorister` and `dominion`. Their regions contain at least one existing `x` marker permitted for that type; they never create another marker or enemy. Transform their rectangles with the template. First filter markers by `spawnTags`, then prefer safe markers matching that type's affinity before other safe permitted authored markers, choosing among equivalent points with the combat RNG. If matching markers are unsafe, use other safe permitted markers and then §4.3's bounded floor fallback. A Blessed/Cherub never borrows a restricted marker; fallback cells are untagged dry reachable floor, not forbidden marked cells. Affinity never blocks a wave indefinitely. These preferences make a ranged room's cover/spawn-side relationship an actual rule rather than scenery prose.

### 4.8 Trickle in cleared rooms

The brief's "a few basic enemies who cannot leave the room" when backtracking.

- **When:** a living human's feet enter a cleared combat room in which no human stood during the last 10 s, and the room has **refills left** (3 per room per floor).
- **What:** after 3 s, if a living human is still inside, `min(12, 4 + 2 × P)` Blessed (6 solo, 12 at 4) at spawn points no living player's eye can see (line of sight to the point's center at 1 m); if all are visible, the farthest from the party. One refill is spent. (A player passing through, or arriving by Pilgrim's Return and walking on, spends nothing.)
- **Leashed:** each trickle enemy has a home room and can't step onto a cell outside its rect (`roomOf` layer, §14.4); its flow field is clamped to the room (§14.5). It targets players inside the room only and stands idle otherwise.
- **Gone:** trickle enemies with no living player in their room for 10 s fade out without credit.
- **Rewards:** 1 XP per Blessed; each has a 5% chance of a coin (3 halos); no motes or items. Trickle enemies do not trigger enemy-hit/kill relic/combo/talent discharges, advance talent kill meters, extend competitive streaks or satisfy deeds. Ordinary native attacks, direct attack shape/state application and defensive passives still function; a trickle death cannot seed another kill-area/trap or recharge a carried discharge meter. Its later actual world coin remains a normal pickup under pickup-trigger rules. Their finite refill counters persist across rejoin. Doors never close for a trickle. Its size uses `floor(min(12, 4 + 2 × P))` at placement; XP is the actual count, not a room budget. A refill cannot activate while any sealed combat is active elsewhere.
- Not in non-combat rooms or the boss room, and none after the boss's death.

### 4.9 Props

Three families, one silhouette and color each, constant across heavens (the heaven changes only the art). rooms.md sets each heaven's props within these rules.

| Family | Looks | Broken by | Effect |
|---|---|---|---|
| **Loot** (vase, urn) | white/ivory | any player hit or blast | Drops: 70% nothing, 10% a coin (3 halos, §6.1), 10% a heal mote, 10% an item (§7.3). In non-combat rooms: 80% nothing, 10% a coin, 5% a mote, 5% an item ([audit](r01-r03-audit.md) batch 4). |
| **Blast** (censer, reliquary of oil) | saturated red, a black stripe | any player hit or blast | After 0.2 s: 60 dmg to enemies and 40 to players within 4 m, with ordinary mitigation/shields/LOS; chains to other blast props in range. |
| **Blessing** (chalice, shrine) | gold | any player hit | One visible area effect for players within 6 m (rooms.md picks one per heaven, e.g. a heal pulse of 30 HP). |

- **Recharge (2026-10-13 playtest):** lamps and chalices deplete for 15 seconds of host simulation time, then reactivate. Their bodies remain visible and cannot be activated during depletion; the chalice fills with green liquid and heals with a green pulse, while the lamp extinguishes. Loot amphorae remain one-use. `propBroken` carries the absolute ready tick, FloorSync retains pending deadlines, and `propReady` confirms activation. Rejoining never restarts the timer. Bodies are 1.5 m (loot), 1.1 m (lamp) and 1 m (chalice), with the existing 0.5 m attack radius. The pressure follow-up halves both effect props' height; the chalice remains purely healing, as Tomas clarified.
- **Body:** props don't block movement (players and enemies pass through, so 1 000 Blessed never pile on a vase). For rays and areas each prop is a vertical cylinder of radius 0.5 m and its sprite's height, tested like the Gatekeeper's globes (`sim.ts:1867-1925`).
- Enemies never break props by walking; only player attacks and blasts do (or 1 000 Blessed would pop everything).
- A broken prop stays broken for the floor; unbroken props in cleared rooms remain (a reason to come back).
- **The marked reliquary** (one per floor, §3.3 step 13): a loot prop with a visible gold cross mark; it drops the floor's map (§5.4), or a gold halo (6, for everyone, §6.1) if the map is already revealed.

### 4.10 Hazards

Floor hazards (the brief's lava, ice, slime, goo) are cells of a template's `hazards` zones (the `hazard` layer, §14.2). rooms.md defines each heaven's hazard within these rules (Isaac and Hades: hazards are tools against enemies):

1. **Asymmetry:** a hazard deals at least **5×** more to enemies than to players (per second, or per entry). It never kills a player at full HP in under 4 s and never one-shots.
2. **All ground enemies avoid active hazards**, including Blessed, using the shared dry-ground fields of §14.5. Knockback, pulls, launches and separation may still push them in; they follow the cached nearest-dry escape route afterward. This is an additional bounded navigation pass, not a cosmetic steering flag.
3. **Telegraph:** a timed hazard glows and sounds **2 s** before it acts; a permanent one has one constant animated cue (not baked into the lightmap).
4. **Color and motion per effect, the same in every heaven:** damage red-orange, slow violet, poison green, slippery pale blue, electric white-yellow; always with a motion or shape cue, never color alone.
5. **On only in combat:** a room's hazards act only while it's in combat; in a cleared room they dim and stop, so backtracking is safe.
6. Hazard cells are applied per cell (a lookup in movement), never by per-enemy collision, so 1 000 enemies stay cheap. Player movement effects (slow, slide) run in the client's `LocalPlayer`, as wading does.
7. **States:** an enemy on an active hazard cell is `pooled` (§4.11); a slowing hazard also makes it `slowed`.

### 4.11 Enemy states (the shared vocabulary)

The bridge between kits, relics, talents, items and hazards (r1-fun finding 2): a **small fixed set of visible states** that attacks *apply* and that relics and talent nodes may *trigger on* or *read*. A state has no hidden numbers: its only mechanical effect is the one in the table, and every state has one look.

| State | Applied by (base kits and world) | What it does | Look |
|---|---|---|---|
| `bound` | Chains of Tartarus: during its 0.3 s pull and for 2.5 s after accepted pull completion | Rooted; takes double damage; rejects unrelated knockback (the source's own pull still resolves). | Red-hot chains on it (today's). |
| `slowed` | Direct Chain Gun/Scourge hits and their authored Delivery paths (Fetters, 1 s); slow hazards | Moves slower (Fetters' factor, as today); secondary shards/reflects do not inherit an undeclared slow. | A violet tint with a frost-mote trail. |
| `airborne` | Falling Star's launch (0.4 s arc) | In the launch arc; can't attack. | The arc and a ground shadow (today's). |
| `taunted` | Blasphemy only (5 s) | Targets the Fallen (as today). | Trembling red (today's). |
| `censed` | standing in a Heretic incense cloud | Takes the cloud's pulses (as today). | The cloud itself. |
| `silenced` | Discord only (4 s) | Can't cast or fire (as today). | Today's silence mark. |
| `pooled` | standing in a placed or thrown item's area, in a Field of Blood (within 6 m of its center), or on an active hazard cell | Nothing by itself. | The area itself. |

**Who may apply what:**

- `taunted` only Blasphemy, `silenced` only Discord and Discord's own alternatives (classes.md's rules); `censed` only the Heretic's clouds. Everything may **read** them.
- Talent nodes may apply `bound`, `slowed`, `airborne` and `pooled` (through an area they create).
- Items and relics may apply `slowed`, `airborne`, `pooled`, and `bound` for **at most 1 s** (bound doubles damage, so a relic must not hand it out long).
- A state applied again refreshes its duration; states never stack.
- **The boss:** the Gatekeeper can be `taunted`, `silenced`, `censed` and `pooled`, never `bound`, `slowed` or `airborne` (it doesn't move). bosses.md says the same for later bosses and boss parts.

**What may read a state** (relics §8.1, talents §9.3): "a kill of an enemy that is X", "X enemies take one more visible effect from this attack", "this attack applies X". Streak assists also count states (§10).

**Network:** the host keeps the states; clients only draw them. `bound` (`FLAG_ROOTED`), `slowed`, `silenced` and `taunted` already travel in each enemy's `flags` byte (`protocol.ts:78-86`); `airborne` uses the free bit 64 if the launch arc isn't already carried; `censed` and `pooled` aren't sent (their area is what players see).

Accepted body-base height and spawn incarnation travel in the revision-4 enemy record (§14.12). Launch/grounding effect records use server start/end ticks and that incarnation; late receipt never starts a fresh full-duration launch or binds an effect to a new occupant of the slot. Reuse of a flags bit for a boss-part-specific meaning is permitted only where that part cannot carry its ordinary meaning (bosses.md §3.5).

### 4.12 The Bell of Judgment

Left 4 Dead's car alarm, as one rule: **ring a cleared room's bell, fight one harder wave, every human gets a Rite.**

- **Where:** the 2 bell rooms of the floor (§3.3 step 9: normal combat rooms, not 2×2, not the key room). After a bell room's clear, a gold bell hangs over its reward spot (3 m up). The map shows a small bell on the room's icon from then on (§5.2).
- **Ringing:** a living human presses **F within 2.5 m** of the bell during a valley (no room in countdown or combat), **before victory has latched**. Measure §6.1's 3D accepted-eye distance and line of sight to its visible lower rim at `(rewardSpot.x + 2, rewardSpot.y + 2, supporting floor + 3 m)`, the horizontal center of the 4×4 reward square, not to the point beneath it. Bots never ring. Acceptance marks it `pending` and starts the countdown using the original fight's retained entry socket; **only sealing consumes it** (`spent`). Cancelling before sealing restores `available`, without loot, XP or a Rite. It can be completed once per floor. During a bell fight the room's cleared bit is temporarily unset, so §3.4 closes both sides of its passages correctly; restore it on clear.
- **The wave:** ringing starts the countdown and sealing starts **one Judgment wave**: 40% of the room budget using **only its last wave's `mix`**, ignoring the original `elites` field, plus **2 external elites** at 4 players (3 under Host), scaled as §4.4. Arrives over 10 s subject to safe placement/alive caps. Elites are allowed in hazard Bell rooms as the optional one-wave exception, not in normal elite+hazard templates.
- **Reward:** when the wave is cleared, the room counts as cleared again: the dead respawn as on a clear (§4.3 rule 8), but the living don't heal and there is no clear XP or clear reward; **each unclosed human in this Bell's seal recipient set** gets one Rite entitlement (§9.10) on the reward spot, including a retained temporarily disconnected record; at the 4-Rite cap it settles 6 personal halos instead. No new joiner receives an already-sealed Bell's page. The wave's kills give XP as usual (§9.1: the wave is worth its TP, 0.4 × budget + 120), drop motes and items as usual, and drop **no halos** (the room's `H` is spent).
- **Bell room plates:** the bell isn't previewed on the door (§3.4); a player learns where bells hang by clearing.

---

## 5. The map

### 5.1 Minimap and full map

- **Minimap:** always on, **top-right**, a fixed 200 × 200 px plate. **1 slot = 28 px**, so the whole 7 × 7 grid (196 px) always fits: it never scrolls, pans or resizes. Below it, in a fixed column: halos, the key icon (if the party has the key: the holder's name), the Sundial while it is lit (§6.8), and *enemies remaining* (moved from the top-right, shown only in combat).
- **Full map:** **hold M** to show it, release to hide (like Tab's score sheet). While it is shown the player can still move, but the mouse moves a **map cursor** instead of the view and LMB/RMB don't fire (LMB on a room starts Pilgrim's Return, §5.5). A centered 588 × 588 px plate (1 slot = 84 px) dimming the view by 40%, with a fixed legend column on its right and player names. Windows under 784 px tall scale the plate down so its frame stays clear of the experience bar (1280 × 720: 524 px); the cursor follows the scaled plate. Not shown while chat is open or on Pause. The HUD's HP, ability and inventory slots stay visible and on top.
- **Why both:** the minimap answers "where am I" in a fight; the full map is for route decisions in the valleys.

### 5.2 What each state shows

| State | Fill | Outline | Icon |
|---|---|---|---|
| Undiscovered | not drawn | — | — |
| Discovered | none (the dark plate) | 2 px ivory at 50% | the room's icon or focus sigil at 60% |
| Visited, not cleared (a cancelled countdown) | grey `#6b6b6b` | 2 px ivory | icon at 100% |
| In countdown / combat | red `#b03a2e`, pulsing at 1 Hz | 2 px ivory | icon at 100% |
| Cleared | ivory `#e8dcc0` at 80% | 2 px ivory | icon at 100%, dark |
| The room you're in | — | 3 px gold `#ffd27a` | — |

- **Reward plate:** a discovered, uncleared combat room shows its pre-rolled clear reward (§6.4) as a small glyph at its top-left (empty frame, gold halo, the item's icon, a burning page for a Rite), the same sign as on its door (§3.4). A cleared bell room shows a bell there until it is rung.

- **Doors:** a connected pair of rooms is drawn with a 6 px gap and a short connector across it (the vestibule), so the tree reads at a glance. A discovered room's connector shows only toward known rooms.
- **Players:** dots in class colors (your own an arrow pointing your way); on the minimap only your own arrow and teammates' dots.
- **Icons** (white glyphs with a dark outline; 16 px on the minimap, 40 px on the full map; every icon differs in shape, not only color):

  | Room | Icon |
  |---|---|
  | Breach | a broken chain |
  | Pardoner | a halo coin |
  | Confessional | a horned eye behind a grille |
  | Reliquary | a chest: gold and closed, grey and open once opened |
  | Boss | a trumpet |
  | Key room, after clear while the key lies there | a key |
  | Combat focus sigils | horde: three heads; ranged: an orb; flyers: a wing; elite: a star; hazard: a flame; ground: a hoof. A secondary focus adds its sigil small, bottom-right. |

### 5.3 How rooms are discovered

- When any human first enters a room (visited), **all rooms sharing a vestibule with it become discovered** for the whole party: every door of a room is visible from inside it, and the door frames carry the next room's sigil (§3.4). So the map always shows the doors the party has seen and what kind of fight lies behind each: the route choice.
- Knowledge is party-wide and host-authoritative (events, §14.3).

### 5.4 The map item

- **The Chart** (one per floor) reveals every room as discovered, with its icon or sigil. It comes from (a) the **marked reliquary** prop in one combat room, or (b) the **Pardoner's map pedestal** (120 halos in R03 tuning, bought once for the whole party: when one player buys it, the pedestal is gone for everyone).
- It isn't an inventory item: it applies at once, party-wide.

### 5.5 Pilgrim's Return (teleport)

Backtracking was a quarter of the run's time (r1-fun finding 5). The rule: **from the full map, click a cleared room to stand in it after 1.5 s.**

- **Targets:** any cleared room (non-combat rooms count once visited; the boss room only after the boss's death), not the room the player is in.
- **When:** only during a valley (no room in countdown or combat) and only for a living player. Own player only; it never moves anyone else.
- **Channel:** LMB on the target while M is held starts a **1.5 s** channel (a gold ring closing on the player, a rising chime others hear). It breaks if the player takes damage, moves, releases M, or a countdown starts anywhere.
- **Arrival:** on the target room's entry cells of its lowest-numbered used socket (§3.4), the player's index picking the cell. The host checks the conditions and moves the one position; the client sees it as a correction (`teleport` C→H, `teleported` H→all, §14.3).
- Bots never use it (they follow the host's player, §12.4); the key travels with its holder.

---

## 6. Economy

### 6.1 Halos (currency)

- **What:** angels drop **coins** worth **1** (silver-gold ring); loot-prop coins are worth **3**, and **gold halos** are worth **6** from a commander or **24** as a clear reward (larger). One-halo enemy coins create more reward moments within the same room budget (October 13 playtest follow-up). Each player has their own **wallet**, starting each run at 0. Halos don't carry over between runs (run currency, like Isaac's coins).
- **Pickup:** a coin within **4 m** of a living player flies to the nearest one at 14 m/s and is collected at 0.8 m. **Every pickup credits its value to every connected human's wallet** (the brief's "goes to everybody's pockets"). Bots collect too, and their pickups credit the humans.
- **Fade:** a coin on the floor disappears **20 s** after dropping (10 s under the Edict of Poverty), gently shrinking for its last 3 s without blinking. Currency has no additive glow. Uncollected means lost. This is the "going in pays" rule: halos drop in the crowd and wait only so long.
- **World pickup reach:** automatic pickup/attraction requires a living eligible collector in the pickup's owning room, 3D distance from accepted feet to its supporting-floor point within that pickup's listed range, and unobstructed geometry line of sight. Attraction follows collision-safe motion and rechecks ownership/range before collection; a wall, closed leaf or another terrace cannot pull a coin/mote through terrain or consume a pickup below the player's floor. If the chosen collector becomes invalid, attraction stops/reselects; it never reserves the reward forever. Hovering draw height is cosmetic. Bots qualify only for coins/motes. Key/Chart/item/page contacts use the same rule at their own stated touch range; F interactions instead use the accepted eye and the object's visible interaction anchor, with their stated range and line of sight. A Bell's hanging anchor is reachable from a grounded player's eye.
- **The room budget `H`** (halos per player, fixed for the room whatever the party size; multiples of 3):

  | Shape | band 1 | band 2 | band 3 |
  |---|---|---|---|
  | 1×1 | 72 | 90 | 108 |
  | 2×1 / 1×2 | 108 | 126 | 144 |
  | 2×2 | — | 180 | 198 |

- **Drop rule** (host, at seal, from the scaled spawn list): reserve `min(eliteCount, floor(H/24))` gold-halo entitlements for elites in wave then spawn-index order. At most one quarter of the budget belongs to elites, so their new per-wave presence cannot drain the crowd's rewards. Other elites drop no coin. The remainder `R = H − 6 × reservedCount` is spread over the non-elite enemies by weight (**Blessed 1, Chorister 3, Cherub 3, Watchman 3**): each reward-eligible death (including world kills, §14.11) adds `R × w ÷ W` to a fixed-point/rational room accumulator (`W` = total non-elite weight) and drops a 1-halo coin each time it crosses an integer. Track paid amount and cap at `R` so floating-point drift cannot overpay or lose the final coin. Uncredited cleanup forfeits that enemy's coin entitlement; a bell's wave drops none. The halo budget never grows for Edict-added elites.
- **Why Blessed still drop:** diving into the crowd must pay (pillar 2). October 13 pressure feedback quadruples room budgets and reduces the ranged weight from ten to three: Blessed kills now distribute substantially more visible rewards, while a ranged kill still pays more. Party sizes retain equal total room income. [Audit](r01-r03-audit.md) batch 4 raised the budgets by half again (about 735 halos on an average floor, from 491) because the crowd still paid too rarely, most visibly at four players; prices stayed. R03 must re-evaluate shop prices against this new income; older 105–125-halo examples are historical and no longer current tuning.
- **Why a budget instead of a per-kill chance:** with "everybody's pockets" and enemies scaling ×0.4 → ×1.0 with party size, per-kill drops would give each player of a 4-party 2.5 times the solo income. A fixed per-room budget, credited to everyone, gives **every player the same income per room at any party size**, so prices can be fixed.

### 6.2 Heal motes

- A green mote heals **8% of max HP** to the player who collects it (individual, not shared). It flies to the nearest living player **below full HP** within 2 m; players at full HP don't attract it, so it waits for a teammate. Fades after 20 s.
- **Drops:** each elite 2; each Chorister, Cherub and Watchman 35%; loot props 10%; per combat encounter at most **4 / 6 / 8** motes (1×1 / 2×1 / 2×2) from ordinary kills. A Bell is a separate encounter with the room-size cap, consumed once; reconnect/relocate never resets it. Boss ranged adds may roll the same 35% chance but have a **single 8-mote cap for the entire fight**, not per summon/cycle/phase. Boss adds never drop items or feed talent/relic-generated mote harvest; body and parts drop nothing. Talent-generated motes have independent explicit per-cast caps (§14.11).
- It's small next to Communion (120 HP to everyone nearby), so the Heretic stays the healer (the report's conclusion).

### 6.3 Items from kills

- Each ordinary wave Blessed kill has a **2%** chance, Chorister/Cherub/Watchman **12%**, and each commander (Dominion, Lectern Cantor, Stray-Carrier) **50%** to drop one item pickup (§7.3), drawn by the items' drop weights. Only accepted damage deaths roll; cleanup, leashed enemies, boss bodies/parts/adds and non-wave enemies do not. These October 13 playtest rates increase reward frequency; the existing pickup/pending caps remain authoritative, and currency budgets and mote caps are unchanged.

### 6.4 The clear reward and its preview

- **The raw roll** (per combat room, fixed by the floor seed, so doors can preview it): `u = fmix32(seed ^ imul(roomIndex + 1, 0x27D4EB2F)) / 2^32`. **`u < 0.30` nothing; `< 0.55` a gold halo (24); `< 0.75` an item pickup**, the item `weightedPick` over the items' drop weights with `mulberry32(that same hash)`; **else a Rite** (§9.10). Since R04 a Rite page becomes its toucher's own Rite offer (§9.10); since R05 every class has its trees, so every human gets an offer (until then a class without trees received 24 halos, audit batch 4). Historical raw-roll measurement over 200 000 rooms: 29.9 / 25.0 / 20.0 / 25.1%. **Early build-choice guarantee:** the **first combat room** on the unique Breach→Confessional route always pays a Rite; override its raw result if necessary. This consumes no RNG draw and is stored in `Floor`; all previews show the final result, visible from the Breach. Other rooms keep their raw rewards. A fresh player following that preview gets a kit choice after the first fight. Offers may still convert to halos when a developed build has no eligible node (§9.10).
- **On the clear** it appears on the room's reward spot, announced by a white-gold shaft from the sky, a handbell cue and a line naming the reward under "Room cleared"; a pulsing pillar marks it until it is collected ([audit](r01-r03-audit.md) batch 3). A gold halo and an item are single pickups (the item goes to the first human who touches it, §7.3); **a Rite is one per unclosed human in the ordinary encounter's seal recipient set** (§4.3): touching their page entitlement creates their own offer (bots and subsequent first-time joiners get none). A disconnected recipient retains it for rejoin, without an automatic choice.
- **The preview:** the roll shows on the room's door plates and on the map before the room is cleared (§3.4, §5.2). So the party knows what each fight pays and can skip the empty frames (the Sundial, §6.8).
- The key room and the Reliquary get their roll **too**, beside the key or the chest.

### 6.5 The key and the Reliquary

- **The key** (the Reliquary key; St Peter's in the Pearly Gates): one per floor. On the key room's clear it appears on the reward spot in a narrow gold beam. **A human within 1 m of it takes it**; the holder is shown on every party frame and under the minimap. Bots can't take it.
- **If the holder dies/leaves/disconnects,** drop the key on the nearest player-reachable, dry floor cell in their owning room, using their last accepted feet point as origin (ties: row-major cell). A lifted/dragged or airborne holder must not drop it onto a decorative plinth, void or beyond a door. If that room has no legal point, use the active room's safe entry cell. Any living human can take it; it never fades.
- **The Reliquary** is a normal fight. On its clear, the **reliquary chest** descends at the reward spot in a **white beam with a pale blue core**, 6 m wide and 30 m tall (the enemy spawn rays are gold and soft; this one is hard-edged and stays until the chest is opened). The chest shows a keyhole.
- **Opening:** the key holder within 2.5 m of the chest presses **F**. The key is used up; the chest opens.
- **Claiming:** each unclosed human in the Reliquary fight's seal recipient set (§4.3) then presses F at the open chest to see **their own offer: 2 chest relics they don't own** (rarity weights §8.2; deed relics are never offered, §8.6) and picks one (an overlay; it pauses the sim in single player only). The pick is saved to the profile at once. A player who owns every chest relic gets **a Rite offer** instead (§9.10). **Pass** terminally refuses a free chest relic offer, releases that source's reserved ids and settles its entitlement without a relic, Rite or halos; it no longer holds the exit. Pass uses the same living-player, open-chest range and valley/countdown checks as claiming. Closing with Esc keeps the offer: F at the chest reopens it until the run ends; at the end an unclaimed offer is lost. Bots don't claim; later first-time joins cannot claim that already-sealed chest. A chest-fallback Rite uses §9.10's separate `passRite` action; the paid bargain uses decline.
- **Why one relic per player:** Isaac's co-op rule (one boss item per player) avoids loot fights; relics are account-bound, so sharing one makes no sense.

### 6.6 The Pardoner

- **Stock:** 4 item pedestals and the map pedestal (120 halos; gone once the map is revealed by any means). The 4 items are 4 weighted picks without replacement (drop weights) from `mulberry32(fmix32(seed ^ 0x9A4D0E5))`, computed in `generateFloor` and stored in `Floor`, so every client draws the same pedestals.
- **Per-player stock:** every player may buy each item pedestal **once** (one item, not a stack); a bought pedestal shows `Sold` to that player only. So no one takes another's goods.
- **Buying:** look at a pedestal within 4 m to see its card (name, one-line rule, price, `New` if the player has never used it); press F within 2 m to buy. The host checks the wallet and the inventory (§7.1: a free slot or a stack of the same item below its cap); otherwise `Not enough halos` / `Inventory full`.
- **Prices:** R03 provisionally retunes items-relics.md to **100–180 halos**, following the fourfold room-budget increase. The earlier **105–125-halo** income example is historical; a rushed partial clear pays less and pickup performance matters. A player usually buys 2–3 of the 4, and the 2 inventory slots mean choosing what to carry. The catalog's ids/prices govern the worked examples, which are illustrative rather than seeded stock measurements.
- **After the boss** each player's unbought pedestals also stand beside the Stair of light (§11.6), so carrying items into the next run doesn't need a walk back.

### 6.7 Worked example: one Pearly Gates floor, one player's wallet

Appendix A.1's floor (seed `0x12EBAA83`, 7 combat rooms) at any party size:

| Source | Halos |
|---|---|
| Room budgets: R1 12, R2 18, R3 30, R4 15, R6 18, R7 18, Reliquary 18 | 129 max |
| Collected, about 75% of it (some coins fade in the crowd) | ≈ 96 |
| Clear rewards: this seed rolls no gold halo (on average 7 × 25% × 6 ≈ 10) | 0 |
| Loot props: about 55 on the floor, about 40 broken × 10% × 3 | ≈ 12 |
| **Income** | **≈ 108** (average floor ≈ 118) |
| Spent (A.2): Balm of the Rejected 25, then at the Stair Ash of Stillness 35 and Pilgrim's Feather 30 (three distinct pedestals; prices are examples; the Ash of Stillness came free from a clear reward) | 90 |

With the Chart bought (30), the player affords two items. Halos left at the exit are lost.

### 6.8 The Sundial of Mercy (time bonus)

Isaac's timed doors, as one rule: **seal the boss room before 14:00 of run time and every human gets a Rite for the fight.**

- **The clock** is the run time shown on Results: from the first frame in the floor. The HUD shows a sundial under the minimap with the time left while it is lit; it goes dark at **14:00** (the Pearly Gates; later heavens set theirs).
- **The pick happens before combat:** while the sundial is lit, the Advocate's view shows each human a **Sundial Rite** offer (2 nodes, §9.10), usable in a valley or during a countdown before the actual seal. The chosen node shows as pending and does not satisfy gates or apply effects yet. Revalidate it after each build change; an invalid selected node becomes unselected in the **same fixed-card offer**, with its disabled reason visible, never a replacement draw. A stale node is never applied at seal. Expiry removes the pending offer with no charge.
- **It applies at the seal:** if the boss room seals strictly before 14:00, each legal pending Sundial Rite becomes active (counts against the 4-Rite cap). Six personal halos settle instead only for a stored **initial no-node/cap fallback** (§9.10), or a previously created Sundial offer whose owner has since reached the cap. Later build edits that disable the original cards do not create a fallback: an invalid selected card becomes unselected in the same offer and gives neither a node nor halos. A player who never selected a pending legal node receives no automatic node in combat. Seal-time entitlements use **all admitted, unclosed human records**, including temporarily disconnected ones; a stored selected legal node/fallback is settled in that record without requiring an offline menu reply. Record `sundialQualified` for those records regardless of selection/cap/fallback/connectivity, for the Mercy deed; its separate prior-win/present-at-start requirements still apply (§8.6). Racing should not forfeit the deed merely because the player already built four Rites. Voluntary pre-win leave closes eligibility. At or after 14:00 pending offers disappear and qualification is false.
- **The time** comes from Appendix A.2 (solo, A.1's floor): a full clear with both bells seals the boss at 16:00; without the bells at about 14:00 (the strict deadline is missed); skipping one empty-frame room (R7) as well, at about 12:20. In A.3 a party of three skips 2 rooms and a bell and seals at 13:20. The Sundial is the reward for reading the door plates and skipping; the bells are the reward for staying.

---

## 7. Items (consumables)

### 7.1 Inventory

- **2 slots** per player; each holds one item type, **stack cap 3** (an item row may set a lower cap).
- **Keys 1 and 2** use the top item of slot 1 or 2. A global **1 s** cooldown between item uses.
- **Deterministic routing:** storing/purchasing a charge chooses the lowest-index same-type stack below its catalog cap, otherwise the lowest-index empty slot. Two stacks of the same type are legal. If both manual press counters advance in one accepted tick, try slot 1 then slot 2, before that player's item-pickup storage. A successful first use starts the global cooldown and refuses the second; a rejected first spends nothing and leaves a legal second possible. Consume observed press edges even when refused; never queue the rejected use for a later cooldown or turn a counter jump into many uses.
- **HUD:** two slots of the ability slots' size and frame, above Q and E at the bottom-right, each with the item's icon, its count and the key label; an empty slot shows its frame only. Like the ability slots, they're never covered by art (UI rule).
- **Discard:** only in the Lobby (`Discard` on the character card). Items can't be given to others.
- The inventory persists between runs (§13.4).

### 7.2 Kinds

| Kind | Use | Examples |
|---|---|---|
| `self` | an effect on the user for its duration | speed |
| `instant` | an immediate effect on the user | a small heal |
| `placed` | put down at the user's feet | a reflect ward |
| `thrown` | thrown along the aim, lands at up to 20 m or at the first wall or enemy | a venom flask's pool |

**Durations:** `self` effects **8 s**, `placed`/`thrown` areas **6 s** (an item row may set its own within 4–10 s).

### 7.3 Item pickups (store now, choose when to use)

October 14 play feedback replaces automatic item activation. A random item drop (an enemy death or a broken amphora) fades after **60 s** like currency (§6.1), so uncollected items can't fill the pickup pool ([audit](r01-r03-audit.md) A1). Earned items (a clear reward, a purchase) remain until the run ends. A living connected human touching it within 1 m stores one charge in the lowest matching non-full stack, otherwise the lowest empty slot. If neither fits it remains on the floor. Contact never heals, shields, refreshes, throws, places an effect, starts cooldown, or marks the item tried. This applies in combat and valleys alike; bots never collect items.

Keys 1/2 deliberately spend charges. Successful uses share the 1 s cooldown. Refused uses spend nothing. Catalog refresh/replacement rules, area limits and the single shield channel remain. A first successful use marks it tried. The hint window (H) always describes the carried stacks; a newly stored, untried item type makes its slot pulse three times instead of showing text over the fight ([audit](r01-r03-audit.md) batch 3).

**Why:** choosing when and where to spend a limited charge is the player's decision. Full inventory is readable and revisitable, rather than silently turning a valuable pickup into an unwanted effect.

### 7.4 Rules every item obeys

1. **One visible effect.** No hidden riders.
2. **Healing and shielding stay separate**, and **items don't replace the Heretic:** a heal item heals the user only, at most **40% of their max HP**; a shield item shields the user only, at most **100** (two thirds of Martyr's Shroud's 150). Audit batch 4 raised both from 40 HP and 50 because items felt weak; the Balm now out-heals one Communion (120) only on the Fallen (160). No item heals or shields others; no item revives.
3. **No fire-rate items** (Field of Blood's job), **no taunt** (Blasphemy's), no silence (Discord's).
4. **States** (§4.11): an item may apply `slowed`, `airborne`, `bound` for at most 2.5 s (audit batch 4; was 1 s), and its area makes enemies in it `pooled`; never `taunted`, `silenced` or `censed`.
5. **Prefer placed and thrown items** (they reward *where* as well as *when*); at most a third of a heaven's items are `self`.
6. An area item that affects players affects every player in it; one that affects enemies affects every enemy in it.
7. Numbers fit their advertised encounter: offensive/control items must matter against 300 Blessed. The one anti-projectile item is deliberately situational in ranged and boss rooms; its card and door focus let the player plan for it. Do not add a second unrelated effect just to make every item universal.

### 7.5 Item row format

`| id | Name | Kind | Rule (one line) | Numbers | Duration | Stack cap | Price | Drop weight | States applied | Visible effect | Sound |`

**The MVP needs 8 items** (items-relics.md): at most 2 sustain (one heal, one shield), at least 4 placed or thrown, at least 1 aimed at ranged enemies (e.g. a reflect ward), at least 1 for mobility, at least 2 that apply a state other than `pooled` (so items feed state relics, §8.1).

---

## 8. Relics

### 8.1 Rules

- **Account-bound:** a relic, once claimed, belongs to the profile and can be equipped by any of its four characters.
- **2 slots per character.** Equip and swap **only in the Lobby and at the Confessional** (§9.6).
- **Sources:** the Reliquary chest (§6.5, one per player per floor), the Advocate's bargain (§9.6, a second one in pawn) and deeds (§8.6). Never a relic already owned.
- **Every relic is class-agnostic** and has **one trigger**, from this list only:
  1. **a kill of an enemy in a state** (§4.11): "kill a `bound` enemy", "kill an `airborne` enemy";
  2. **one attack hitting 5 or more enemies** (one shot, one swing, one landing, one cloud's first pulse);
  3. **a kill by your LMB, RMB, Q or E** (the result, never the use: Borderlands 3's anointments made players fire skills at nothing, and "on use" would be a press-when-ready buff);
  4. **a visible event:** a burst death (M12 §4), a streak tier (§10), a pickup (halo, mote, item), being hit, reviving or being revived, a room's seal or clear, breaking a prop, using an item.
  Never on using an ability, never on a hidden condition (an HP threshold not shown on screen), never a bare stat (+X% damage).
- **Its effect is one visible thing:** something appears (a ring, an orb, a pool, a feather burst, a projectile), a pickup behaves visibly differently, or **a visible area applies a state** (`slowed`, `airborne`, `pooled`, `bound` at most 1 s; §4.11). It obeys §7.4 rules 2–3 (no healing others above item limits, no fire rate, no taunt, no silence).
- **Synergy comes from states.** A relic that reads a state pays off on whoever applies it: a Betrayer's "kill a `bound` enemy" relic fires on the Binder's pile; a Fallen's "kill an `airborne` enemy" relic grows with a talent that launches more. A relic triggered by "a kill by your E" changes with whichever E the player assigns. That is how relics, abilities and attacks combo (the brief).
- Relics add **bounded power compared with an empty slot**. Selecting two effects and selecting a replacement combo are build tradeoffs, not a claim of parity with an unequipped newcomer (§9.7). Class-agnostic means no class restriction; a trigger can be dormant in a specific kit (e.g. a healing Q cannot earn Q kills). Its card shows `Dormant with current abilities` before equipping, and other relics remain usable in that base kit.

### 8.2 Rarity

| Rarity | MVP count (chest + deed) | Offer weight per eligible relic | Card border |
|---|---|---|---|
| Common | 6 (4 + 2) | 60 | ivory |
| Rare | 4 (3 + 1) | 30 | blue |
| Legendary | 2 (1 + 1) | 10 | gold |

### 8.3 What a run offers

The chest offers each player 2 distinct unowned **chest relics** (1 if only one is left; a Rite if none). The first card is a weighted pick among unowned relics whose trigger is currently usable by the equipped kit/party; if none is usable, draw from all unowned and label the dormant trigger. Draw the second weighted card from remaining unowned ids, allowing cross-character collection. Compatibility predicates and native Q/E damage metadata are in items-relics.md §2.1.1. Use the isolated offer-id/player stream of §9.10; opening or respec never rerolls a relic offer. Exclude owned/pawned ids and ids reserved by another pending offer. Taking/declining that other offer releases its reservations without duplicating ownership. If all unowned ids are reserved, show `Finish your other offer first`; do not misreport collection exhaustion or award a free Rite. Advocate uses the same rules. The eight chest relics require exactly eight distinct successful claims: eight chest-only clears, or as few as four won floors when every chest and surviving bargain is claimed. Failed pawns and skipped claims extend that count. Deeds provide four more; this is a finite collection, not a promise of endless new unlocks.

### 8.4 Combos

- **Authored pairs** (Hades' Duo Boons), not emergent stacking. Every relic in the MVP belongs to **exactly one combo** (12 relics → 6 combos); each deed relic pairs with a chest relic, so a deed also opens a combo.
- **A combo replaces one effect:** when both relics of a pair are equipped, the combo's named effect **replaces relic b's effect** (relic a keeps its own; the combo row names b). So the pair still shows two effects, one of them the combo: a **sidegrade**, never a third effect on top. Whether a combo beats two separate relics depends on the build, which is the decision. The combo shows as a badge with its name next to the relic icons on the HUD and the character card.
- **Why authored:** two slots and 12 relics give 66 pairs; authoring 6 keeps each balanced and readable, and lets every combo have a name players talk about.
- **Discovery:** owning one relic of a pair shows `Combo: ??? (with a relic you haven't found)` in the Relics view; owning both shows the combo's name and rule.
- Relics don't stack with copies (there are none) and only one combo can be active (2 slots).

### 8.5 Row formats

Relic: `| id | Name | Rarity | Source | Trigger | Rule (one line) | Numbers | Visible effect | States (reads / applies) | Combo | Flavor |`

- `Source`: `chest` or `deed:<deed id>` (§8.6). `Trigger`: one of §8.1's four kinds, written out ("kill a `bound` enemy", "an attack hits 5+", "a kill by your Q", "a mote pickup").

Combo: `| id | Name | Relics (a + b) | Replaces (b's effect) | Rule (one line) | Numbers | Visible effect | Flavor |`

**The MVP needs 12 relics (8 chest, 4 deed) and 6 combos** (items-relics.md); at least 6 of the 12 trigger on or apply a state, and for each class at least one relic reads a state that class's base kit applies (the Fallen `airborne` or `taunted`, the Heretic `censed`, the Binder `bound`, `slowed` or `silenced`, the Betrayer `pooled`).

### 8.6 Deeds and deed relics

Repeat-run challenge goals: 4 of the 12 relics are **not in the chest**; each is **granted by a deed** the first time any character of the profile does it. The deed is checked at the boss's death and the relic saved then, shown on Results (`Deed: Unbroken — <relic> is yours`). These are finite goals, not a promised 10–30-run unlock schedule: a qualifying second victory can satisfy all four. Continued replay must come from changing routes, kits, timing and optional risks rather than delaying these rewards artificially.

| Deed id | Name | The deed (in a won run) | Relic rarity |
|---|---|---|---|
| `unbroken` | Unbroken | Win without dying. | Common |
| `mercy` | Mercy of the Sundial | Win after qualifying at a boss seal before 14:00 (§6.8), including the cap/no-node halo fallback. | Common |
| `armageddon` | Armageddon | Reach a 200 streak (§10). | Rare |
| `sentence3` | Under Sentence | Win at Sentence 3 or more (§2.5). | Legendary |

- **Deeds count only for a profile present at run start that had already won that heaven**, recorded as `presentAtStart` and `clearsBeforeRun` on admission, never recomputed after victory increments clears. Reconnection preserves that qualification; first-time mid-run joins earn normal progress but no deed. Unbroken counts the individual's deaths this run; Mercy uses the boss-seal `sundialQualified` flag; Armageddon uses that individual's qualifying best streak; Under Sentence uses the immutable run Sentence. A debug/god-mode run grants no progression or deed.
- The profile stores the deeds done (`deeds`, §13.2). Deeds are per profile, like relics.

---

## 9. XP, levels and talents

### 9.1 XP

- **Sources:**
  - **Kills:** at seal, assign each wave/type a fixed XP ledger equal to its **exact pre-rounding TP allocation** (§4.6). Each of its `nP` scaled enemies earns `ledger / nP` XP on credited death, independent of the rounded 4-player count. Thus all credited kills of the authored waves pay exactly the room budget at every party size. Example: a wave allocates 100 TP to Blessed and 60 to one elite; solo 40 Blessed earn 2.5 each and the elite earns 60, total 160. An Edict's extra elite ledger is 60 × its unscaled count, divided equally among its scaled count, before the Sentence multiplier; a Bell adds `0.4 × budget + 120` (180 elite XP under Host). Uncredited anti-softlock removals settle the entity's unspent ledger once, with no kill, streak, drop or proc. Boss adds and boss parts have no ledger and give **no XP**; trickle kills give 1 per Blessed. Replaced/relocated entities retain their ledger entitlement and cannot pay twice.
  - **Room clear:** 100 XP per combat room (not again after a bell's wave).
  - **Boss kill:** 1 500 XP.
  - **Edicts:** every XP gain × (1 + 0.15 × Sentence) (§2.5).
  - **Slice multiplier (2026-10-16):** every XP gain above is paid × **1.5** (`XP_GAIN`), before rounding. The slice has one dungeon, so talent points must come sooner (Tomas, R04 request). The ledgers, the curve and the rules below keep their base numbers; only the payout is scaled.
- **Shared:** every connected human in the run gets **every** XP gain in full, alive or dead. No kill-stealing, no class lagging behind. A human who is disconnected misses the gains made while away (their run record's `runXp` waits, §12.2).
- **No XP for healing (deviation from the brief):** the brief rewards "killing enemies or healing" so the healer doesn't lag; full sharing already gives the Heretic the same XP as everyone, and healing XP on top would favor the Heretic solo and could be farmed by taking damage on purpose.
- The host keeps each player's run XP as a float and sends `floor(runXp)` as the cumulative whole-number total in `stats`, `roomState` and settlement (§14.3). Apply the Sentence multiplier before accumulation, then floor only the cumulative value; never round per kill. A repeated event cannot add XP again (§13.5).

### 9.2 Levels

- `XPtotal(L) = 1500·(L − 1) + 500·(L − 1)·(L − 2)`: the XP to reach level L from 0.

  | Level | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 |
  |---|---|---|---|---|---|---|---|---|---|
  | Total XP | 1 500 | 4 000 | 7 500 | 12 000 | 17 500 | 24 000 | 31 500 | 40 000 | 49 500 |

- **Pace (with the ×1.5 slice multiplier: ≈ 9 750–12 000 XP, level 4–5 after a first full clear, level 10 in about 4–5 won runs):** a typical full Pearly Gates clear pays **6 500–8 000 base XP** (Appendix A.2: 7 577 with both bells; its 7 combat rooms ≈ 4 700 TP + 700 for clears + 1 500 for the boss). That walkthrough reaches level 3 before the Confessional and level 4 at the boss; this is **not a minimum for every generated floor or route**. A legal shortest route can contain just band-1 and band-2 1×1 fights: `340+100+400+100 = 940 XP` before the Confessional, then `+1 500 = 2 440 XP` on victory (level 2). It trades learned points/halo income and optional rewards for time, while its guaranteed early Rite and possible Sundial still change the run kit. Bosses remain completable by the base kit without learning a point. At the modelled full-clear income, **level 10 takes about 7 won runs** (≈ 2.5 hours; about 9 runs counting defeats, about 5 at Sentence 3), and all four characters about 30; repeated short routes take more runs. Revision 1's curve (coefficient 250) maxed a character in 5 runs, too soon for the content (r1-fun finding 6); Rites now give the early runs their in-run growth.
- **Talent points = level − 1.** MVP max level **10** (9 points); XP beyond it is kept and counts when later heavens raise the cap.
- **Absolution** (cosmetic): past level 10, every 10 000 XP gives one Absolution rank, shown as a small roman numeral on the character card and the party slot (`Absolution III`). Above rank 3,999 use a decimal rank instead of an unbounded Roman string. Nothing else.
- Levels are **per character** (per class): each of a profile's four characters levels separately (§13.2).
- **HUD:** a thin XP bar under the HP bar (its full width = the current level's span), the level number at its left end, and an unspent-point pip at its right end while points wait to be learned. A level-up plays a short chord and shows `Level 3` in the streak banner's place for 1.5 s (a streak tier wins if both happen at once).

### 9.3 Trees

Each class has **three trees**, each a playstyle (a domain, as in Darktide's patch 13 or Borderlands): e.g. ranged, melee, area, damage over time, slowing, hazards, traps, or a combination. One tree deepens the class's existing verb; the other two bend it. Every tree must be fun in a pure swarm and playable solo.

The **two visible effects** limit below governs the native input and its Delivery/Payload composition. An explicitly authored passive/capstone reaction, such as a landing bundle, revive reaction or kill discharge, is a separate visibly cued event governed by its own target, quota, cooldown and provenance contract. It neither occupies another Payload channel nor adds an undeclared native rider. All applicable reactions still obey §14.11's dispatch ordering and recursion boundary; separate dispatch is never permission to bypass the two active kill-discharge-node cap.

| Tier | Nodes | Opens when the tree has lower-tier points |
|---|---|---|
| 1 | 2 | 0 points spent in it |
| 2 | 2 | 1 point |
| 3 | 2: **one ability node** (§9.4) and one other | 3 points |
| 4 | 1 **capstone** | 5 points |

- **Acyclic gates:** learned and Rite tier gates both count only distinct strictly lower-tier nodes in that tree: tier 2 needs one tier-1 node; tier 3 needs three tier-1/2 nodes; tier 4 needs five tier-1/2/3 nodes. A node never counts itself or a higher-tier dependent node. Learned gates use learned nodes alone; combined Rite gates use learned plus held Rites as §9.5 specifies.
- **Every node costs 1 point and has one rank.** A tree contains 7 authored nodes; a legal capstone path uses 6 (5 lower nodes, then the capstone). Excluded alternatives mean filling all 7 is not always legal. Rites count for Rite tier gates, while learned-only gates remain valid without them (§9.5).
- **One capstone per player.** Taking a capstone (learned or as a Rite) locks the other two trees' capstones.
- **Budget:** the Pearly Gates allows 9 points (§9.7): one capstone build (6) plus 3 legal active nodes, or a spread (e.g. 3 + 3 + 3) with no capstone. A run adds up to 4 Rites on top. Later heavens raise the cap to at most **14**, still well short of 21 (all three trees), so a player can never fill everything.
- **What a node may do** (Pillar 5): change a **visible count or shape** (+1 pellet, +1 chain target, a wider cone with a visibly larger effect), **replace** an attack's or ability's effect with a different visible one (Diablo 3's runes), or **add one visible effect** to an attack or ability that has only one; **applying a state** (§4.11) or doing one visible thing more to enemies in a state counts as that one effect. **Never** an invisible percentage, a hidden or conditional rider, a "press when ready" buff, a second taunt, a silence outside Discord's alternatives, or healing and shielding in one effect.
- **State nodes** (the bridge to relics and teammates, §4.11): **each tree has at least one node that makes an attack or ability apply a state its class's base kit doesn't apply** (e.g. a Betrayer node "Silver Bullet leaves the enemies it passes through `slowed` 1 s"), and **each class has at least two nodes that read a state another class's base kit applies** (e.g. "Scourge swings bounce `airborne` enemies 2 m higher").
- **Compatible composition:** each resolved `LMB`, `RMB`, `Q:<id>` or `E:<id>` has two augmentation channels: **Delivery** changes its existing count, path, footprint or geometry; **Payload** adds or replaces one emitted effect. At most one active node occupies each channel; same-channel nodes conflict across trees, while Delivery + Payload may compose when their catalog contract specifies how. Geometry shapes the existing effect instead of creating a third rider; the composed action shows at most two visible effects, including its native effects. Catalogs explicitly classify every Kind `augment` and any capstone whose `Modifies` is a named input, and name their supported ability ids. An authored passive capstone keeps its explicit compatibility rather than acquiring a channel merely because it observes/modifies an ability's event. An ability-unlock node occupies neither channel; an alternative inherits only expressly supported upgrades with authored numbers. Different named alternatives do not share effects merely because both use Q/E. Passive/movement nodes have no implicit channel exclusion but retain explicit exclusions and discharge limits below.
- **Tradeoffs and legal paths:** a Rite augment may temporarily replace one learned augment in the **same channel** under §9.10, never its compatible other channel. Explicit exclusions, held Rites and capstones cannot be displaced. Learned channel conflicts are checked against intersecting declared target sets even while those named abilities are unassigned; dormant ownership cannot bypass exclusions. Each tree retains a legal 6-point capstone path and a legal 9-point extension; at most one pair of non-capstone nodes within a tree may explicitly exclude each other, and no lower node excludes its own capstone. Shape/payload compatibility, source predicates and the kill-discharge cap are part of effective-build legality. Unit tests check this legality for every catalog row (implementation.md, *Verification*).
- **Kill-discharge cap per build:** at most **two active talent nodes** may emit damage, control or a new area/trap in response to kills, across learned nodes, Rites and capstones. Each class catalog lists the exact participating ids. Count every equipped, unsuppressed listener even if its required state/source is presently absent, it has no target or its cooldown is running; only an authored named-input assignment/suppression removes that listener from the active count. A teammate later creating its setup cannot silently enable a third discharge. Native attack geometry, native ability damage, finite bonus-mote harvest and the strictly area-only propagation exception (§14.11) are separate bounded mechanisms. A dormant named-ability node does not consume a channel until assigned; assignment/Rite acceptance must reject a proposed kit with a third active kill discharge. A shot may admit each of its two active discharge nodes **once per root action**, carrying its catalog's bounded victim/origin bundle rather than one independent proc per corpse. Relic/combo slots retain their own bounds and secondary effects cannot recurse (§14.11). Cards disclose a discharge-cap conflict before spending a point or accepting a Rite.

### 9.4 Abilities from talents

- Each tree's tier-3 **ability node** teaches a **new ability** that replaces one base ability: it names its slot (Q or E) and the base ability it's an alternative to. Three trees → three new abilities per class; with the base Q and E, a class has up to five abilities, of which **two are equipped** (Q and E).
- **Four combat buttons stay:** LMB, RMB, Q, E. Talents never add a key and never replace LMB or RMB in the MVP (it would break the carefully paired primary/secondary split).
- **Assignment:** in the Talents view, the Q/E row offers for each slot the base ability and every learned or Rite ability of that slot. Learning and respec happen in the Lobby and at the Confessional only; **reassigning Q/E alone works anywhere in a run outside combat** (the `T` view, same learned talents, refused while a room is sealed or when dead). An ability taken as a Rite is assigned at once (§9.10).
- **Reading the build:** `T` opens the same Talents view anywhere in a run: learned nodes, Rites, Q/E and every tooltip, with no Reset. Out of combat and alive it can reassign Q/E and Apply; in combat or dead it only reads. Singleplayer waits while it is open, as for Pause; `T` or `Esc` closes it.
- **Cooldowns carry over on a swap:** first settle the outgoing armed/ongoing action using its authored cancellation/end rule, **then** compute the remaining slot cooldown carried to the new ability (at least 0, keeping any longer accepted deadline). A Way Back shadow or Gatebreaker charge whose cooldown starts on ending cannot be canceled after copying an apparent zero into its replacement. No reassignment rearms an expired marker/root action. Previously emitted native areas retain their original provenance/lifetime where the catalog permits; the outgoing augment cleanup of §9.10 remains separate. A swap cannot reset a cooldown.
- Nodes that augment an ability work only while that ability is assigned (shown greyed otherwise).
- A new ability follows classes.md's rules: it rewards timing, it's better than the ability it replaces in some situation and worse in another, it has one clear primary verb and at most two authored visible effects under §9.3, with no hidden riders. Taunting stays with Blasphemy only: a Fallen who swaps Blasphemy out has no taunt that run.

### 9.5 Learning, respec

- **New points are learned only at the Confessional or in the Lobby.** In the dungeon, a level-up shows `Level 3 — learn it at the Confessional` and an unspent-point pip by the XP bar. (The brief says "learnt at the leveling-up room"; the Lobby can learn too, because a player who died before the Confessional would otherwise start the next run with points they can't use until halfway through it.)
- **Respec is free** in the Lobby and at the Confessional: `Reset tree` per tree, `Reset all`. Edit a draft locally; send the **whole resulting allocation and assignments** as one transaction. The host validates the final state, never an invalid intermediate removal. Removing an ability node resets its slot to the base ability unless the same id is still held as a Rite; removing prerequisites must remove dependent learned nodes in the draft. The trip to the Confessional is the price.
- **Rites and respec:** a node held as a Rite can't be learned in that run (it's already active). The **learned allocation must meet its own gates without borrowing Rite points**; then combined ownership must meet Rite gates, prerequisites, explicit exclusions and one-capstone legality, with only §9.10's learned-augment substitution exempt from implicit same-channel exclusion. Held distinct learned/Rite nodes count for gates even when their effects are dormant or temporarily replaced; no node counts twice. Rites may open higher-tier Rite offers, but cannot license a permanent node that becomes illegal when they vanish. A respec that would break an existing Rite's gate or prerequisite is refused (`Your Rite <name> needs <n> lower <tree> talents`); the editor lets a draft step break it (a tree reset) so the points can be placed again, and only Apply needs the whole loadout legal; Rites themselves can't be reset. A legal Confessional edit may change the learned augment underneath a Rite; its effect remains suppressed in that channel until run end. Show this dependency and lost active effect before committing a reset.

### 9.6 The Confessional and the Advocate

- **The Advocate:** *Hell's counsel in the appeal of the damned. It speaks through the grille of a confessional.* (The devil's advocate was the Church office that argued against a saint's canonization.) It stands behind the grille, which hangs on the wall beside the template's `advocate` point.
- **F within 2.5 m** opens the Advocate's view for a living player during a valley or countdown: the Talents and Relics views of the Lobby (learn, respec, assign Q/E, equip relics), plus the **bargain** card and, while the Sundial is lit, the **Sundial Rite** offer (§6.8). In single player it pauses the sim. Several players can use it at once. Each change is sent as `advocate` (§14.3), checked by the host like a loadout (§9.8) and refused while a room is in combat. Accepted changes re-resolve that player's modifiers.
- **Sanctuary:** each player is healed to full on their first entry per floor (the host records it in the run record, so a reload doesn't heal again). No enemies ever enter (no spawns, no trickle; the boss room behind it is its only other neighbor).
- **The Advocate's bargain** (Isaac's devil deal; once per human per floor): *"A second relic, for a part of you. You will have it back if you win."*
  - **Offer:** 2 unowned chest relics (§8.3; 1 if only one is left), or a Rite if the collection is truly exhausted. Viewing costs nothing. If remaining ids are reserved by the chest, finish that offer first. If exhausted and no legal Rite/slot is available, no bargain is offered; do not sell 6 fallback halos for 30% HP.
  - **Commit/decline:** accepting an offered relic or legal Rite is atomic: validate, set `bargainTaken`, debit the HP price, grant the pawn/active Rite, release reservations and resolve once. **Accept only before boss victory**; boss death closes/releases every unaccepted bargain, including one viewed earlier. Invulnerable post-win shopping cannot buy another pawn or a Rite without surviving its HP cost. Decline closes this floor's bargain with no price or reward, releases reservations and cannot reopen to reroll. Esc only closes the view, preserving its offer while acceptance remains possible.
  - **Price:** **−30% max HP until the run ends** (rounded down), shown as a dark segment at the HP bar's right end. Current HP is capped at the new max; the Confessional heal fills only to it. No refund.
  - **Pawn:** a bargained relic can be equipped at once, but is saved to the profile **only at the boss's death** (§2.4). A defeat or leaving before it loses it; it can be offered again in a later run.
  - **Why it's a real choice:** the price lands on the boss fight, where Judgment kills at full HP anyway but Orb Volleys and adds don't (the Betrayer goes from 120 to 84 HP); the reward is permanent. A cautious new player refuses, a veteran with a Heretic takes it.
  - Bots are never offered it.

### 9.7 Persistent power and mixed parties

- **Each heaven caps the usable talent points:** the Pearly Gates **9**; later heavens `min(14, 8 + h)`. A character with more points than the cap must leave the excess unspent for that heaven (the Lobby blocks Start with `Too many points for <heaven>: remove n`). In the MVP the cap equals the max (9), so it never triggers. Rites don't count against it.
- **Why:** the cap limits cumulative progression, while channel choices, two kill discharges and one capstone preserve build tradeoffs. Veterans still have more tools and damage than fresh characters; **do not advertise level parity**. Base encounters must be completable by each fresh base kit. Edicts are voluntary veteran challenges; the host shows the party's levels and chosen Sentence before Start (§2.2).
- **No lift-up for newcomers** in the MVP: a level-1 character in a level-10 party plays with 0 points, gains the same XP and levels fast (early levels are cheap). Room scaling counts heads, not levels. Rites help the newcomer most: their offers come from a full tree.
- **Roguelite tension** stays because power inside a run comes from the run: Rites, halos, items, the relic choice, the bargain, the new points learned at the Confessional, and the carried inventory at stake.

### 9.8 The legality check (host)

When a `loadout` arrives (Lobby, `enterGame`) and on every `advocate` change, the host checks: level matches XP (§9.2; mid-run: XP = `min(Number.MAX_SAFE_INTEGER, xpBase + floor(runXp))` from the record); points spent ≤ level − 1 and ≤ the heaven cap; **learned-only gates** met and combined ownership gates/prerequisites/explicit exclusions met, with at most one active Delivery and one active Payload per resolved named input after legal Rite substitution, and at most two active kill-discharge talents (§9.5, §9.10); no duplicate node ids; one capstone at most; assigned Q/E are base, learned or Rite abilities of that slot; equipped relic ids distinct and owned (or pawned this run) and known; inventory exactly two slots, ids known, integer counts 1..cap. Empty slots are null, not zero-count items. Mid-run currency, XP, inventory, ownership and Rites come from the host record; a reconnecting client's save cannot overwrite them.

- **An illegal Lobby loadout** is replaced by the class's base kit with no relics, and the player sees `Your save didn't pass the check; playing the base kit`. The carried inventory still enters the run if its items pass the item check on their own. This also covers corrupted or edited saves (§13.6).
- **An illegal `advocate` change** is refused (`advocateRejected`, the player's view snaps back); nothing else changes.
- **A loadout whose profile id belongs to another active connection** is refused (`Profile already in this game`). The same connection may update its Lobby loadout; a known disconnected profile may rejoin its accepted run record (§12.2). A voluntarily closed record may not reopen that run.

### 9.9 Talent node format

`| id | Tier | Name | Kind | Modifies | Rule (one line) | Numbers | Visible effect | States (applies / reads) | Requires | Excludes |`

- `id`: `<class>.<tree letter>.<tier><a|b>`, e.g. `fallen.a.2b`; capstones `<class>.<tree>.cap`.
- `Kind`: `augment` (changes an attack or ability), `ability` (tier 3, teaches a new ability), `passive` (a class-wide visible rule), `capstone`.
- `Modifies`: `LMB`, `RMB`, `Q:<abilityId>`, `E:<abilityId>`, `passive`, `movement`, or an explicitly enumerated named-input target set. Resolve each supported target by its actual assignment; channel membership comes from the catalog's channel table.
- `States`: e.g. `applies slowed` or `reads bound`; empty if none.
- `Requires`: implied by the tier gate; name a node only for an extra prerequisite. `Excludes`: computed from resolved named input, **channel** and Kind (§9.3); list only extra exclusions. Each catalog's channel table names Delivery/Payload and supported ability ids for every input-modifying augment/capstone; its kill-discharge list identifies nodes counted by the effective-build cap. Multi-ability `Modifies` entries enumerate target ids rather than silently applying to every ability in the slot.
- **Rite-only usefulness predicates:** `for a Rite` means an offer filter, not a prerequisite for persistent ownership. A `present source` is a **living connected human or active bot able to act**, through its assigned kit, active learned/Rite modifier, producible equipped effect or usable carried item, or an active same-room accepted source (area, projectile, shield or hazard) that actually supplies the named state. Use the **finite producibility closure** in items-relics.md §2.1.1: seed effective native abilities/attacks, usable inventory and actual remaining accepted sources; admit a conditional talent/relic/combo's emitted state only after its trigger has a reachable setup in that closure. Repeat over the finite effect catalog until no source is added. Two dormant effects cannot license one another without an initial source. Preserve ownership/slot/depth restrictions: a secondary kill is not a native Q/E kill, and another owner's source is not an own source. A dead/disconnected ally's uncast kit, an unassigned alternative, unequipped owned relic, unaccepted offer or merely future hazard does not qualify; an already-emitted source may qualify only for its remaining authored lifetime. `Own source` additionally requires that owner. Ally-only cards require another living connected human/active bot permitted by the row. Snapshot eligibility when offering, revalidate on acceptance; changing sources may make an owned node dormant but never erase it. Extra named-node prerequisites and tier gates remain allocation requirements.

New ability format: a section per ability with Slot, Replaces, Rule, Numbers, Cooldown, Visible effect, Sound, When it's better than the base ability, When it's worse, Pure-swarm use, Co-op use, Host/client split (movement abilities run on the client first, as today).

**The MVP needs** per class: 3 trees × 7 nodes = 21 nodes, of which 3 new abilities and 3 capstones (84 nodes and 12 abilities in all).

### 9.10 Rites

The in-run build change (r1-fun finding 1): **a Rite is one of your own class's talent nodes, held until the run ends.** It reuses the 84 authored nodes; no new content.

- **An offer** shows 2 cards: 2 distinct nodes drawn uniformly from the player's **eligible** nodes: own class; not learned and not already a Rite; its tier gate met by distinct learned/Rite ownership in its tree; no explicit exclusion or conflict with an existing Rite/capstone; a capstone only if no capstone is held; an augment only while the ability it modifies is assigned; its `Requires` met. A same-channel conflict with one learned augment alone may use the substitution rule below; a compatible other channel remains active. The proposed effective build must obey the two kill-discharge limit. Resolve the proposed effective kit first, including that surrendered effect, then evaluate the candidate's actual usefulness/source predicate; it cannot qualify using a source it would remove. Use a stable offer RNG `mulberry32(fmix32(simSeed ^ offerId ^ playerOfferKey))`, not the combat/drop stream; `playerOfferKey = fmix32(simSeed ^ imul(admissionOrdinal + 1, 0x9E3779B1))`; the host assigns a run-global increasing admission ordinal once, retains it across reconnects, and never reuses it for a new profile. Offer ids are run-global increasing u32s assigned in room/player order, retained in the run record. One eligible node → 1 card; none → the source-specific fallback below (six halos once for a free earned source). Reopening does not redraw. Tier gates count **lower-tier** nodes only: tier 2 needs 1 tier-1; tier 3 needs 3 nodes in tiers 1–2; tier 4 needs 5 in tiers 1–3. A node cannot count itself or a higher-tier dependent node toward its gate.
- **Temporary augment substitution:** an **augment Rite** may occupy the same resolved named-input **channel** as one **learned augment**, suppressing that learned effect for the rest of this run. The learned node stays owned, spent and valid for gates; no refund or persistent deletion occurs. Never suppress a capstone, another Rite or an explicit exclusion, and never hold two Rites in the same resolved named-input channel. Ability/passive/movement/capstone Rites cannot use this exception. Cards name both the new effect and the surrendered learned effect. Resolve at most one Delivery plus one Payload per named input, even after legal Confessional edits. The compatible channel shapes the new effect according to its catalog contract. Accepting this trade removes **only the outgoing augment's** area contributors/delayed emissions and recomputes source metadata; it does not undo accepted damage, remove unrelated base-ability sources or delete another owner's merged contribution. A native area whose shape/effect the outgoing augment replaced belongs to that outgoing contribution: for example, Ploughshares removes the retained Altar/Scapegoat censer cloud, while direct censer hits and unrelated Witnesses/Kindling sources remain. Retain stored per-node meters/cooldowns; reconnect or reassignment cannot reset them. Run end removes the overlay and restores the learned effect. This preserves real run choices for a veteran whose persistent kit already occupies all combat inputs, rather than converting every reward to six halos.
- **Picking** applies the node at once (the host re-resolves that player's modifiers, §14.7, and broadcasts it). Recheck eligibility and the four-Rite cap in that same transaction; two pending offers cannot reserve a fifth active node. An older **free earned** clear/Bell/chest-fallback source resolved after the cap was reached settles its six-halo fallback once and closes without applying a node. A paid bargain at cap/with an invalid card is refused with **no HP charge, node or halo reward**; it may be declined, never converted into a purchase of six halos. Sundial selection remains pending and settles only at its qualifying seal (§6.8). An **ability Rite goes straight into its slot** (Q or E), replacing what is there for now (cooldown carried over, §9.4); the player can reassign at the Confessional. A Rite counts as a point for tier gates and for "one capstone", never against the level's points or the heaven cap.
- **Replacement preview:** an ability card names the currently assigned ability it replaces, every owned augment/capstone/state reader that becomes dormant, and the slot's remaining cooldown; a substitution card names the learned effect it suppresses and any dependent source readers losing their setup. Dormant nodes remain owned and count for their legal gates; no points or Rites are refunded or erased. Later loss of a source may make an already-held Rite dormant, as ability assignment already can; usefulness is checked when taking it, not an ownership prerequisite that traps subsequent legal build edits. Reassigning an earlier ability at the Confessional can restore its dependent effects. Pending cards refresh this comparison after accepted loadout changes without rerolling their identities.
- **At most 4 Rites per player per run.** Further **free earned** sources give a gold halo (6) into that player's wallet instead; paid bargains and timed Sundial use the conditions immediately below.
- **Fallbacks follow the source's condition:** initial no-node/cap and later-cap resolution credit six halos only for a **free already-earned** clear/Bell/chest source. An exhausted-collection **bargain** is absent initially if no legal Rite/slot exists; a later cap/invalid-card acceptance spends/grants nothing and permits terminal decline. A **Sundial** no-node/cap state is a pending fallback entitlement, with **no immediate wallet credit at the Advocate**; it pays once only if the boss seal qualifies strictly before 14:00, otherwise expires. Universal offer-generation/four-Rite wording never bypasses a paid price predicate or the Sundial's clock.
- **They vanish at the run's end** (any end). The Results table lists them. Bots get none.
- **Pass:** a free clear/Bell/chest-fallback Rite offer has an explicit `Pass` action: settle that source without a node or halos, keeping the current effects. It cannot reopen/reroll. Esc still only closes the view and retains the offer. Six-halo fallback is paid only for genuine no-node/cap exhaustion, never for choosing to pass. The bargain uses its existing terminal decline; an unselected Sundial offer gives no automatic node. A veteran may refuse a visible trade without being forced into a worse kit or permanently retaining an exit-blocking offer.
- **Sources** (earned after clears or by the stated timed/paid condition; choices commit in valleys or countdowns, never during sealed combat):

  | Source | When | Per run (expected) |
  |---|---|---|
  | Clear reward | first required-route combat room guaranteed; other rooms 25%, previewed (§6.4) | ≈ 2.25–2.5 (6–7 rooms) |
  | The Bell of Judgment | after its wave (§4.12) | 0–2 |
  | The Sundial | the boss sealed before 14:00 (§6.8) | 0–1 |
  | The chest or the bargain | only when no chest relic is left to offer (§6.5, §9.6) | veterans: 1–2 |

  A full clear with both bells offers roughly 4.25–4.5 before the 4-Rite cap (A.2's particular raw rewards still give 3). A rushed run gets its early choice plus the Sundial if qualified; skipped room/Bell sources remain a real cost.
- **Offers wait:** a Rite page on a reward spot stays for each eligible human who hasn't touched it until the run ends. Touching it during a valley or countdown takes the offer into the player's hand (a page icon by the XP bar) and opens the overlay; closing it (Esc, or a seal) keeps it, and **F with nothing to interact with** reopens the oldest pending offer during either noncombat period. Rites, relic claims, bargains and Advocate loadout changes may commit in a **valley or countdown**, under the same living-player, range, room and source checks; a queued click received after the actual seal is rejected without losing the offer. Countdown is still distinct from valley for Bell ringing, teleport, item pickup routing and regeneration. **Sampled card ids stay fixed for that offer.** Revalidate each after accepted build/source changes: an illegal card stays visible disabled with the reason, and re-enables if the same card becomes legal again. Never replace cards or restart the RNG when free respec/assignment changes eligibility. If every original free-offer card becomes temporarily illegal, restore a compatible kit or `Pass`; this pays no new fallback. Genuine no-eligible-node fallback is resolved at initial **free earned** offer creation, and reaching the cap later settles six halos once on that free source's resolution; bargain/Sundial use their source conditions above. A free page touched at the cap converts once without opening a choice. Offers are source-entitlements, not one new offer per touch.
- **Content rule** (classes-*.md): every node must work when legally offered as a Rite: it takes effect mid-run, names any specific prerequisite, and explains its effect on a card in one line. Nodes modifying an unassigned ability are never offered; a newly learned alternative can make its augments available. Solo-only offers omit nodes whose sole effect requires another living player or a soul and has no explicit solo fallback. Tier-3 and capstone nodes still need their gates; all 84 nodes do **not** become eligible on a fresh character's first room.

---

## 10. Streaks (the competition)

- **Kill streaks follow [m12-followup-2.md](../m12-followup-2.md) §3**, with assists added: a credited kill within 1.0 s of your last extends your streak; tiers 10 Sacrilege, 25 Desecration, 50 Massacre, 100 Apocalypse, 200 Armageddon; the banner, the sound, others' tiers in the chat line; `bestStreak` on the score sheet (Tab) and Results. That spec isn't implemented yet; the roguelite builds on it.
- **Assists** (r1-fun finding 8): a kill also counts, for your streak, as one of your kills if in the **last 1.5 s** you damaged that enemy, **applied a state to it** (`bound`, `slowed`, `airborne`, `taunted`, `silenced`; §4.11), had it `censed` in your cloud or `pooled` in your area or Field of Blood, or the killer stood in your Field of Blood. Each human counts a kill once (as killer or as assist). The 1.0 s window between your counted kills stays. So a Binder whose pile the Betrayer shreds keeps a streak, and competing means feeding each other's kills.
- **Cost:** the host keeps, per enemy, the last tick each player touched it (4 × u32, 24 KB at 1 500 enemies); a kill checks 4 numbers.
- **Competition:** Results names the **streak crown**, the human with the highest best streak of the run (ties: the earlier to reach it). The profile records each character's best streak ever and shows it on the character card.
- **No mechanical reward for streaks**, except as a relic trigger (§8.1) and the Armageddon deed (§8.6): the competition is for glory, so it never pulls a player away from the team's job.
- Talents and relics never lengthen the 1.0 s or 1.5 s windows.

- **Streak/deed bodies:** ordinary combat enemies and normal boss summons count for combat streaks and the Armageddon deed. Boss summons still have no XP/halo/item ledger and cannot feed bonus-mote harvest. Boss body/parts and trickle enemies do not build a streak or Armageddon; world/secondary deaths may supply ordinary recent assists but never a derived streak-tier proc (§14.11).

---

## 11. Bosses

### 11.1 The room

- The boss room is a 2×2 (68 × 68 m) leaf whose only door leads from the Confessional (§3.3), **recognizable before entry**: its leaf in the Confessional is the boss gate (§3.4), and it becomes discovered on the map with the trumpet icon when the Confessional is visited.
- It seals like a combat room (§4.3: 20 s, 3 s when everyone's in, the multiplayer holds). The boss template sets the arena and the boss's position (`points.boss`); the Pearly Gates' Gate (`GateDef`) stands on the **gate wall**, the side opposite the entry, which the generator guarantees is an outer face on both slots (§3.3 step 5; the Gate's railings are see-through and its spires reach F + 50 m, so it must never face another room).
- **The gate wall's geometry:** the boss template walls in 9 cells at each end of the gate side, so the Gate stands on a straight 50-cell face with a post cell at each end, exactly M10's geometry (`gateLayout` puts its corner posts at `yCenter − y0 − 0.5`; on the full 68 m wall they would stand mid-wall).
- `GateDef` gains a `facing` (N, E, S, W), implemented as a 90° transform of today's x-plane layout (layout, terrain skip and tracer hit boxes).

### 11.2 Structure

- **2 phases** in heavens 1–3 (threshold 50%), **3** from heaven 4 (66%, 33%). At each threshold the boss is invulnerable for **1.5 s** with a full-arena signal (a shockwave ring or a feather burst), so burst damage can't skip a phase. Each phase adds **one** new move or rule (the Edict of the Trumpet brings phase 2's from the start, §2.5).
- **Target fight length:** 3:00 ± 0:30 for the four-human reference party, one of each class with base kits and no Rites. Solo is **class dependent**: the analytical model is about 1:28 Betrayer, 3:20 Fallen/Binder and 5:03 Heretic; mistakes extend it. Body HP is **52 000 at four players**; each Watcher episode routes a total 8% of sealed max HP into it, divided between eyes. This rewards precision without per-class HP rules. Use a 4:30–5:30 solo Heretic tuning range with reachable targets and safe firing positions; if observed fights exceed it, adjust downtime/tether reward before arbitrary damage buffs. These are design estimates, not validated times. Fast builds still experience the defined aiming/teamwork episode once (bosses.md).
- **HP scaling by `P`:** the boss's HP (at 4 players) × linear interpolation through **(1, 0.30), (2, 0.55), (3, 0.78), (4, 1.0)**, fixed at the seal (`P` = 3.5 gives 0.89). **Boss damage to players never scales.**
  - **Why these numbers (revision 2's check):** single-target damage per second from classes.md: the Fallen's slug 71, the Heretic's censer 71 plus cloud pulses ≈ 81, the Binder's Chain Gun ≈ 100 (initial guess), the Betrayer's revolver 200: about 450 for four, and Field of Blood (×2 fire rate, 8 s of every 30 s) makes it ≈ 570. One player averages ≈ 113, a fifth of the party, not a quarter. Equal fight times would need HP ∝ damage (0.20 solo); the targets above allow solo 1.17–1.33 × the 4-player time, which gives about **0.25 solo, 0.50 at 2, 0.75 at 3**. Today's playtested solo value is 0.30 (m12 follow-up), so the table keeps 0.30 solo and sits between the model and `mult(P)` for 2–3 players. Revision 1's 0.38 solo would make an average solo fight ≈ 1.9 × the party's (about 5:40). Playtest decides; the Betrayer solo is about twice as fast as the Heretic solo whatever the table.
- **Adds:** at most **floor(250 × mult(P))** adds alive; no XP, halos or items. Ranged-add sustain is limited to eight kill-motes across the whole fight (§6.2). Boss parts use eight reserved slots outside this add cap but **inside the global 1 500**: up to seven Watchers and one Seal; summons cannot suppress mandatory aiming targets. Stop or reduce adds during a damage window as specified in bosses.md.
- **Telegraph language** (every boss): wind-up tiers **1.0 s** single-target, **1.5 s** area, **2–3 s** arena-wide; "about to hit" is a ground decal filling gold, flashing white at impact; "vulnerable now" is **red** (Hell's color) on the boss or its parts; "can't be damaged" is pale grey. Each move has its own wind-up sound.
- **States on bosses:** §4.11 (the Gatekeeper: `taunted`, `silenced`, `censed`, `pooled` only).

### 11.3 What every boss must test

1. **Movement:** at least one move answered by jumping, dodging, stopping or hiding (one family per move; e.g. a ring to jump that every class clears with a plain jump).
2. **Aiming:** at least one phase or move with targets to shoot that aren't the body: orbs, horns, heads. Watcher count = **3 + connected living humans and bots**, captured when that episode opens (4 solo, 7 with four living players); later deaths do not create replacements. Low HP each (an aiming test, not a damage race); area damage deals half to them, so precise attacks (the slug, the revolver, the Silver Bullet) shine without being required.
3. **Teamwork:** at least one mechanic where helping each other is the best answer (a rescue from a grab, standing on plates together, an order to follow) that **works solo and with bots**: each mechanic states its **solo rule** (one player can do it alone, e.g. self-escape a grab in 4 s, plates needed = living players), its **bot rule** (what a bot does: shoot the lit target, stand on a plate, free a grabbed teammate first), and its **fail cost** (never a wipe: the boss heals 10%, or an elite wave comes).
4. **One identity rule** players can say in a sentence (heavens.md: "hide", "kill both within 10 s").
5. **Class-neutral:** no class is required; a taunt may draw the boss (Blasphemy) but the fight works without one.

### 11.4 Mini-bosses

Framework only; **none in the MVP** (the elite carries the "elite" focus). Later: a mini-boss is a combat template with focus `elite` whose last wave is one unique enemy type (counted against the 16-type limit, §14.6) with the boss rules of §11.2–§11.3 at reduced size (1 phase, 60–90 s, HP scaled the same way).

### 11.5 Defeat of the boss

The first accepted death of the body latches victory once. Boss processing order is accepted incoming enemy damage/part deaths, threshold or boss death, participant removals/releases, scheduled casts/spawns, player hits, then all-dead defeat (bosses.md §3.7). Thus a lethal body hit accepted in the same tick as the last participant's otherwise fatal hostile hit wins first, cancels that hostile hit and revives existing souls below. A dead participant cannot submit a fresh action, and projectiles cannot award victory in a later tick after defeat has committed. A hostile hit accepted during the later player-hit step settles shield absorption, HP overflow and any resulting soul, then resolves its already-cast native damage-break burst and resulting part/tether/body deaths synchronously, before all-dead defeat. A resulting threshold or victory latches immediately; victory revives souls and cancels remaining hostile hits rather than undoing that accepted hit. This is prior-cast damage, not a dead participant submitting a fresh action. Check invulnerability before any shield/HP depletion, including forced Judgment depletion, so an ignored hit cannot manufacture a Shroud burst. One depleted shield id emits at most one native break; secondary-proc and root limits still apply. Once latched, discard further hostile damage, cancel casts/holds/projectiles/pending summons, and apply the following settlement:

- every remaining enemy bursts without credit; capture alive/soul groups at the victory latch, after any just-resolved hostile damage transaction. Every member of that soul group, including retained disconnected souls, becomes alive at exactly 50% HP; only connected players already living at that latch heal 30%, unless the Edict of Penance disables it. The revived group never receives that additional heal. An absent living record gets no heal; reconnect restores that resolved life state;
- **from now on nobody takes damage and `checkDefeat` is off** (blast props still burst, harmlessly), so a won run can't be lost while shopping;
- connected eligible humans get 1 500 XP, with the Sentence multiplier. **The next heaven unlocks** and the heaven clear count rises once for every eligible unclosed human record (alive, dead or temporarily disconnected); pawned relics and deeds are included in the same victory settlement. First-time admission closed at the boss seal (§12.2). Each connected client assigns absolute XP, ownership and `inventory` = run inventory, `run = null`, then saves as one settlement (§13.5). Disconnected records can receive that settlement on rejoin; no client can write another browser's storage.
- the boss room counts as cleared; its leaf opens.
- **The combat boundary is final:** no idle room or available Bell can start a new countdown after victory. Skipped ordinary fights remain uncleared and grant no XP, clear reward, key/chest or Bell entitlement; merely entering one does not clear it. Already-earned pickups and source entitlements remain claimable until exit, and already-visited cleared rooms remain connected for backtracking. The Stair shop supplies missed merchant access. Racing cannot turn skipped risky fights into free invulnerable farming after the boss.

### 11.6 The exit

- **The Stair of light** rises at the boss room's center: a white-gold beam 4 m wide. Beside it stand **each player's unbought Pardoner pedestals** (only theirs, at their prices; the Pardoner itself keeps them too), so the last halos can buy items to carry into the next run without a walk back.
- **Ascending:** Victory Results follow when **all living connected humans** stand within 2 m of the beam for 3 s, or 30 s after the first human entered it. Both conditions respect the same unclaimed-choice hold: while a connected human has an eligible earned chest/page entitlement or pending Rite offer, including a page not yet touched, hold for at most **60 s total**, show `A choice is waiting`, and allow returning to it. Missing a key from a skipped fight does not create a new hold or post-win encounter; only already-earned reachable chest access counts. After that allowance the exit can resolve and explicitly reports the unclaimed choice; no promise that an AFK choice waits forever. A hard **120 s after boss death** closes the run even if nobody ever enters the beam, with the same notice for pending choices. Bots and disconnected records never block the exit. The recorded **clear time ends at boss death**, while Results may separately show total session time through the exit; post-win shopping does not spoil the Sundial or best clear time.
- Until then the party may walk or teleport back: claim relics, buy items, break props. Rooms don't refill (no trickle after the boss's death).
- Bots walk into the light; they don't count.
- **Deferred:** Isaac's chain, an option at the Stair to ascend straight into the next heaven within the same run (keeping halos, items and Rites), so later runs become multi-heaven ascents (§15.2).

---

## 12. Multiplayer

### 12.1 Sharing the floor

- `start` carries `{ heaven, floor, seed, simSeed, runId, edicts, players, progressionEnabled }`; every peer generates the same floor (§3.2). `seed` and `simSeed` are u32s; `runId` is the 128-bit hex session id (§2.2). A joiner's `start` carries the same values, so the worker can generate the floor while the clients load.
- **Host state, sent as reliable `ctrl` events** (§14.3): per-room knowledge and cleared state, the key, the chest, each player's pedestal stock (only that player's), the map, broken props, wallets, inventories, offers (relic, Rite, bargain), the bells. All of it once, right after `go`, in `floorSync`. **Pickups and leaf states are not events:** pickups travel in the snapshot and leaves derive from its header (§3.4, §14.3).

### 12.2 Joining, leaving, the host leaving

- **Joining mid-run is allowed** before the boss room seals: in normal combat as a soul on the entry cells; otherwise next to the living player with the lowest ID. A **first-time** joiner's wallet starts at the halos credited so far this run. Their XP starts at admission, not retroactively. At the boss seal first-time admissions close until the Lobby; known disconnected records may rejoin. A new arrival cannot collect a nearly-dead boss's progress or disrupt a fixed aiming count. Class slots remain reserved for disconnected profiles until the run ends; the player must rejoin the same class and use the host's accepted loadout.
- **The run record:** the host keeps, by profile ID, `{ classId, progressionEnabled, xpBase, clearsBeforeRun, presentAtStart, admittedTick, playerOfferKey, wallet, inventory, persistentLoadout, effectiveLoadout, relicOffer, claimed, pawned, pedestalsSold, confessionalHealed, rites, riteOffers, sourceEntitlements, sundialRite, sundialQualified, bargainTaken, runXp, itemsTried, lifeState, hp, soulProgress, lastAcceptedFeet, cooldowns, stats, lastStateRevision, settlement }` through the run. Room records retain the ordinary/Bell encounter seal recipient sets. Admission validates `xpBase`/ownership once, never on reconnect. A later first-time join gets only subsequent source entitlements; a newcomer after the Reliquary sealed gets no chest offer. After exit, retain final settlements for the **last 16 completed runs until the host tab closes**. Deliver a matching cached settlement before any new admission; new runs cannot overwrite unresolved old victories. Recovery beyond that cache or after a host crash is unsupported.
- **Rejoining the same run** (same profile ID and `runId`): the host restores the record as it is, including the **wallet as saved** (credits made while they were away are not added; r1-tech finding 6d), and `runXp` continues the same counter. The client doesn't touch its `run` save (§13.4). Their key, if any, was dropped (§6.5). Restore the retained alive/dead state and HP at actual removal, not first-time join placement: a living resume gets exactly retained HP with no new spawn shield/invulnerability, while a dead resume remains a soul with retained progress decayed by ordinary elapsed-host-time rules. No passive regeneration acts on an absent body. An actual room clear or victory may have resolved that retained soul under §4.3/§11.5; reopening a connection cannot. Expired buffs/areas remain expired/removed and cooldown deadlines keep advancing. Combat placement uses the active room's safe entry cell; in a valley use the retained accepted floor point if legal, otherwise the nearest legal dry floor in that cleared room, then the lowest-id connected human's safe entry. Do not return a reconnecting body beyond a closed door, into a hold, into a decorative plinth or into another participant's movement envelope.
- **A human leaving voluntarily** commits their own loss settlement before disconnect; their record is closed and cannot rejoin that run. **A connection timeout after 5 s** removes their body/soul and drops the key but retains a reconnectable record; do not commit a personal loss merely because a network link dropped. Room scaling remains fixed until the next seal. A temporarily disconnected profile receives no intervening kill XP or halo credits; a victory settlement is recorded for every admitted, unclosed record (including pending chest claims and pawn promotion) and delivered on a known-profile rejoin. Unclaimed choices are not selected automatically. A client missing a final settlement keeps its last acknowledged save; offline clients cannot be written by the host.
- **The host leaving** ends the run for everyone (`Host left the game`, as today); clients resolve it as *Host left* (§2.4).

### 12.3 Uneven progress

- The **host's** unlocked heavens and Edicts decide what the party may play. A client who hasn't unlocked that heaven may still play it, and beating it unlocks the next for them too.
- Each human plays their own character (level, talents within the heaven's cap, relics, inventory). **Connected** humans receive each shared XP/halo credit in full; an offline record receives no intervening credits (§12.2). Chest/clear/Bell offers belong only to their respective encounter-seal recipient sets (§4.3), retained across known reconnect; a later first-time join has no retroactive chest/page. Each may consider its own eligible pre-victory bargain (§9.6), and Sundial uses its seal entitlement (§6.8).

### 12.4 Bots

Bots stay simple:

- **They play the base kit** of their class: no talents, no Rites, no relics, no items, no inventory. They never read or write a profile (a bot tab shares the human's localStorage, §13.1). Display name: the `name=` URL parameter, else `Bot <class>`.
- **They follow and fight** as today: in a countdown their goal is the active room's entry cells of its `entrySocket`; otherwise they follow the host's living player, or the lowest-id living human if the host is down. When all humans are down they prioritize the nearest reachable human soul before ordinary enemies; boss rescue/telegraph avoidance still apply. They revive souls and walk into the exit light. Their base ability decisions must respect boss rules; a bot Binder reserves Discord for Judgment rather than silencing random fodder immediately before it.
- They collect halos and motes by walking over them (halos credit the humans). They never take the key, item pickups, relics or Rite pages, never interact (F: no shopping, no bells, no teleport).
- In boss mechanics they follow the boss's bot rule (§11.3).
- They count as 0.5 in `P` (§0).

### 12.5 Shared vs individual

| Shared by the party | Individual |
|---|---|
| Halo credits (each into every wallet), the map, the key (one holder), room states, bells, the Sundial, XP gains (each gets all), Edicts | Wallet spending, heal motes, item pickups, the inventory, relic offers, Rite offers, the bargain, Pardoner stock, talents, the Confessional heal |

---

## 13. Persistence

### 13.1 Profiles

- **One current profile per browser.** The save is `heavenfall.profile.1` and its `.bak`. Slots 2 and 3 from R03 stage 2's short-lived three-slot screen are no longer read, moved or deleted ([audit](r01-r03-audit.md) E5). Slot selection is not exposed. The current save retains its existing Web Lock and previous-good backup. Every read and write is wrapped in try/catch. A normal new run additionally requires the durable stake handshake in §13.4; a failed admission save cannot leave the old carried items usable in storage while play begins. **Save order:** validate the current main save → back it up only if valid → write the new validated JSON to main. Never copy corrupt main over a good backup. On read, use valid main first, else valid backup with `Recovered previous save`; if both fail preserve both strings and allow original-data copy/recovery in Profile. Only explicit confirmed import/clear may replace them, after archiving both strings under the current key plus `.recovery`. A newer-schema main is likewise never automatically replaced. A quota/security error leaves the last good save intact, shows `Progress is in memory; export before closing`, and allows an export of the current accepted profile. A host reward acknowledgment and successful local persistence are separate facts.
- **One tab per profile, with the Web Locks API:** a tab using profile `n` holds `navigator.locks.request('heavenfall.profile.<n>', { ifAvailable: true }, …)` until it leaves that profile; the browser releases it on close/crash/reload. If unavailable, show `Open in another tab`. Delete/import-overwrite require the same exclusive lock. The slice supports secure-context browsers with Web Locks; if the API is missing, refuse persistent-profile writes and explain that a supported browser is required. **No timestamp-heartbeat fallback**: background throttling and non-atomic localStorage cannot safely enforce ownership. `?bot=1` tabs never lock, read or write a profile.
- After the first finished run, the page calls `navigator.storage.persist()` once (Firefox asks; Chrome and Safari decide silently).

### 13.2 What is saved

```ts
interface Profile {
  schema: 1;                       // save format version
  id: string;                      // random 128-bit hex, made at New
  name: string;                    // 1–16 characters
  created: number; updated: number;          // ms since epoch
  characters: Record<ClassId, {
    xp: number;                    // whole number; the level and Absolution are derived (§9.2)
    talents: string[];             // learned node ids
    q: string; e: string;          // assigned ability ids
    relics: [string | null, string | null];  // equipped
    bestStreak: number;
    bestSentence: Record<number, number>;    // heaven → best Sentence won (§2.5)
  }>;
  relics: string[];                // owned relic ids (claim order), deed relics included
  deeds: string[];                 // deed ids done (§8.6)
  inventory: ({ item: string; count: number } | null)[];   // length 2
  heavens: { unlocked: number[]; clears: Record<number, number>;
             bestTime: Record<string, { ticks: number; rulesVersion: string }>;
             lastEdicts: Record<number, number[]> };       // the host's last Edict choice per heaven
  run: null | { runId: string; admissionId: number; admissionCommitted: boolean;
                heaven: number; classId: ClassId;
                carried: ({ item: string; count: number } | null)[];
                xpBase: number };  // the character's XP at this run's first start (§13.5)
  lastSettlement: null | { runId: string; classId: ClassId; revision: number; outcome: 'victory' | 'defeat' | 'leave' | 'hostLeft' | 'admissionAborted' };
  codex: { itemsTried: string[] };
  stats: { runs: number; wins: number };
}
```

**One character per class** per profile (levels and talents are per class; relics, deeds, inventory, heavens and halos-free progress are per profile). Rites, the wallet and the run inventory are never saved: they live in the host's run record (§12.2).

`bestTime` keys are `<heaven>:<classId>:<humans>:<bots>:<edictMask>:<roster>`; `edictMask` uses bit `id-1` for each selected Edict, so equally numbered Sentences with different rules never overwrite each other. `roster` is the canonical sorted list of `<classId>-h` / `<classId>-b` entries at the first playable frame. Compare only the same key and rules version, using boss-death run-clock ticks. Any join, leave or timeout before boss death makes this run ineligible to update `bestTime`, while ordinary rewards and Results remain valid; never reconstruct a roster from the final headcount. `stats.runs` increments once when a new admission becomes playable after the durable handshake, never when merely reserved or aborted; `stats.wins`/`clears` increment once at victory settlement, never again at exit/reconnect. Developer runs with progression disabled do not change these records. This is a personal record, not a parity claim between different levels/builds.

### 13.3 Export and import

- **Code:** `MG1.` + base64url(deflate-raw(UTF-8 JSON)) + `.` + CRC32 of the base64url part as 8 lowercase hex digits. The prefix is the code format version. About 1–2 KB.
- **Export:** `Copy code` in title Settings → Profile only. No file upload/download or results export button. A failed accepted checkpoint retains emergency export/retry access so memory progress cannot be lost silently.
- **Import:** reject input over **64 KiB**, then check prefix/CRC, decode and inflate with a hard **256 KiB expanded UTF-8 limit**, parse, migrate and validate before writing. Validate exact record shapes, finite safe-integer non-negative XP/counters, 128-bit hex ids, bounded array lengths, unique known ids, heaven range and two inventory slots; treat imported text as data. Reject malformed/future versions without changing either key. Imported `run` is resolved as an abandoned attempt before use (inventory stays empty, checkpoint XP kept); a save code cannot resume a live host run. Confirm replacing the current profile, with its good previous save backed up. Imported live attempts are abandoned and settlement context cleared. Displayed names are text, never markup.
- A checksum catches truncated pastes, not cheating; the host's legality check (§9.8) is the only enforcement. The host also refuses a second `loadout` with an id already in the run (a friend importing your code).

### 13.4 The inventory across runs

**Developer runs are disposable:** `progressionEnabled = false` is immutable for the whole attempt. Admission clones the legal profile/loadout/inventory into an in-memory run record without changing stored `run`, inventory, stats, Codex, XP, learned allocation, relic ownership or records. Every progression/checkpoint/settlement/profile write from that attempt is suppressed, including losses and post-win shopping. Developer allocation and claims affect only that disposable record; return restores the original profile. Do not enter such an attempt while a normal attempt is unresolved: recover or settle the normal attempt first. This exception precedes the ordinary admission/settlement rules below, so inspecting a debug run cannot consume carried items or create an abandoned persistent run.

Classify admission and read the immutable progression flag before any client profile/stake write, including reconnect when local `profile.run` is null. `start`, `admission`, `floorSync` and cached settlements all carry it. A normal attempt cannot enable the inherited developer G/god toggle or another simulation-changing debug command; those commands are accepted only in an attempt started with progression disabled. Disabling god mode does not enable progression in that attempt.

**Durable stake handshake:** before normal new admission can create a live body/soul or consume/use inventory, the host validates and reserves one admission with `{runId, admissionId, progressionEnabled}`. The client holds its profile lock, validates and successfully writes the existing atomic `run`/empty-inventory stake, then sends `admissionReady {admissionId}` in that run scope. The host accepts that token once before `go`/playable placement. A write failure sends `admissionRejected {admissionId, reason}` and leaves the stored carry available outside the run; offer export/retry or a separately admitted disposable developer run, never silently start a persistent attempt. Pending admissions use the loading timeout; rejection/timeout before playable admission releases the reservation and resolves any written stake with an absolute aborted-admission settlement restoring its carried inventory, without XP/win/clear grants and with `outcome: 'admissionAborted'`, `admissionCommitted: false`. `admissionId` is a monotonic run-scoped host u32 bound to that profile, never a transferable token. The initial atomic stake stores this id and `admissionCommitted: false`. A repeated pending reservation returns the same id and `admissionKind: 'new'`: if the matching local stake already exists, acknowledge it without moving inventory again. The host reports `admissionCommitted: true` in its `go`/admission acknowledgment, resume, floorSync and final settlement once that admission is playable. Apply the first such true state atomically with the saturating `stats.runs` increment of §13.5 and the saved flag; retries cannot increment again. A settlement can supply the first committed state before clearing `run`; an aborted settlement cannot. Once playable admission commits, ordinary run loss/recovery applies. Retry/rejoin checks the retained token/record, rather than charging a second stake. An acknowledgment proves host acceptance separately from local disk persistence. Resume/settled/disposable admissions do not perform this new-run stake handshake.

- **At `start`/`enterGame`:** host sends `admissionKind: 'new' | 'resume' | 'settled'`. A known active record is `resume`; an already won/closed record is `settled`, even if local `profile.run` is null after victory. Neither moves carried inventory or writes a fresh attempt; apply cumulative host state/settlement first. Only a normal `new` admission resolves an abandoned unmatched run, atomically clears `lastSettlement`, saves `{ runId, admissionId, admissionCommitted: false, heaven, classId, carried: inventory, xpBase }`, empties stored inventory and moves charges into the run. Clearing that prior context prevents a delayed post-win packet from being applied through the previous run's settlement id. On connecting with unresolved `profile.run`, request its settlement before accepting another run; if no host record/cache exists, resolve abandoned defeat. Rejoining a post-win floor restores safe inventory and never puts it at risk again.
- **At the boss's death:** `inventory = the run's inventory` and **`run = null`** (§11.5). From then on save after **every accepted inventory mutation**, including purchase, use and storage of a free pickup, since nothing post-boss is at risk. A stored free drop must survive tab close just like a purchased charge.
- **On admission aborted before play:** restore `run.carried`, clear `run`, record its absolute `admissionAborted` settlement; no attempt/XP/win/clear increment. If recovery cannot determine whether a written stake ever became playable, use the existing unmatched-attempt defeat rule, not a locally inferred refund.
- **On defeat or Leave run** before the boss's death: `inventory` stays empty, `run = null`.
- **On Host left** before the boss's death: `inventory = run.carried`, `run = null`.
- **A tab closed mid-run** leaves `run` set. Before starting a different `runId`, request the old run's settlement from the live host/completed-run cache; only an unresolved unmatched attempt becomes defeat (inventory stays empty, XP stays at its last checkpoint). Rejoining the same `runId` restores the run record from the host (§12.2).

### 13.5 When it saves

- After each room clear, the chest claim, each level-up, the boss's death, **each accepted post-boss inventory mutation or first-use Codex change**, the run's end; after each change in the Lobby and at the Advocate (talents, Q/E, relics; not Rites); after export/import. A free pickup stored after victory is an inventory mutation; an automatic use/refresh that adds a first-use entry checkpoints that entry even when it spends no carried charge.
- **XP saved** = the run record's `min(Number.MAX_SAFE_INTEGER, xpBase + floor(runXp))`, assigned as an absolute cumulative total, including the boss reward before victory settlement. Persistent nonnegative counters likewise saturate at `Number.MAX_SAFE_INTEGER` instead of overflowing from a legal imported value; validate bounds before arithmetic and write only safe integers. Never add the same received total repeatedly and never switch to additive XP merely because `profile.run` has become null. All settlement events carry `runId`, monotonic revision and the absolute XP total. Apply each revision at most once; `lastSettlement` and the profile change are written together. Older `stats` or clear packets cannot overwrite a newer settlement.
- Revisions are ordered **within a run id**, never across runs. Accept settlement only for the current unresolved `profile.run` or the known same-run `lastSettlement` during post-win updates. A later new admission closes that prior event context; ignore delayed old snapshots/settlements. The host's completed-run cache resolves an unresolved attempt before new admission, not arbitrary historical awards on demand.
- **Persistent versus effective loadout:** learned nodes and owned equipment are saved; Rite nodes, temporary learned-augment suppression, Rite-only assignments and pawned equipment are run overlays. Persist Q/E only if learned/base, else retain its prior persistent assignment (or base if no longer learned). Pawn equipment replaces the run slot without replacing its saved owned slot; victory promotes ownership and may commit the slot, loss removes only the overlay. **At boss death save legal persistent state but retain effective Rites/substitutions until actual exit/run end.** At that end remove Rites/suppression and restore legal Q/E/modifiers and every retained learned effect. Learned-only gates (§9.5) ensure the end never erases valid newly learned points.

### 13.6 Versions and migration

- `schema` is an integer. Loading runs a forward-only chain `migrate[n]: (v n) → (v n+1)` up to the current version; migrations are never deleted. Every migration keeps a past-version fixture in the unit tests.
- A save with a **newer** `schema` than the build is refused: `This save is from a newer version of the game`. Nothing is overwritten.
- If content changes make a save illegal (a removed node, more points spent than the level allows after a curve change), the load **resets that character's talents** (keeping XP) and drops unknown relic, deed and item ids, with one message on the Profiles screen.

---

## 14. Technical architecture notes

For the implementer; grounded in [codebase_audit.md](../../research_notes/Isaac%20style%20roguelite/codebase_audit.md).

### 14.1 Where generation runs

- `generateFloor` (§3) runs on every peer: in the host's worker and in each client's main thread, from `{heaven, floor, seed}` (replacing `getDungeon(id)` in `main.ts:80` and `worker.ts:104`). Its output is the `DungeonDef`, the `Floor` record (rooms, graph, templates and orientations, props, special and marked rooms, the Pardoner's stock, the reward rolls) and the **`GameMap` it validated**, which the caller reuses on that thread (step 14 already ran `loadMap`; r1-tech measured 76–155 ms for it).
- The worker can generate at `start` time, while the clients load (§12.1).
- **Load budget** on the dev laptop: generation + stamping + `loadMap` + `validateLevel` **≤ 300 ms**; map build on the client (lightmap, terrain, meshes) **≤ 1.2 s** for an 11-room floor (the prototype stamping measured the lightmap at 125–165 ms for 13 flat rooms); the whole Loading screen **≤ 3 s** typical. The 20 s load timeout stays. `computeHeights` applies `viewMask` before its O(candidates²) facing loop.

### 14.2 Map data changes

- **`ArenaDef` → room records:** retain the template's explicit **`kind`** for encounter dispatch (§4.1); one rect per room (no L-shapes); `doors` = the room's own leaf cells; `exitDoors` removed; **`entry: Array<{ socket: number; cells: [4 cells] }>`**, one per used socket (§3.4), replacing `entryCells`; `boss` allowed on any one room and consistent with `kind: 'boss'`.
- **`validateLevel` changes, all of them** (stamped floors fail today on every attempt, r1-tech finding 1); every rule not listed stays:
  - (a) "at least 6 `x` cells" applies only to `kind: 'combat'` (the pool check's §4.7 rule 4 asks 8 / 12 / 24 and requires nonempty valid waves); Breach/Pardoner/Confessional have none and are still checked for being sealed with doors closed. The boss instead validates its twenty authored add markers and twelve aiming anchors under §4.7 rule 4; empty ordinary waves never erase its encounter spawns or require a crest;
  - (b) "exactly 4 entry cells" becomes: each `entry[k]` has 4 cells, each a non-door floor cell inside the room's rect, and `entry` has one item per used socket;
  - (c) the 4 `S` cells are inside the Breach's rect and in no other room's ("no `S` inside an arena rect" goes);
  - (d) "only the last arena can be the boss" becomes "exactly one room has `boss: true`". Its one body marker/`points.boss` is **inside that room**, on the authored elevated dais; remove the old `B outside boss arena` rule. The static body dais is exempt from ordinary ground-spawn reach checks, while add spawns, entries and mandatory aiming targets retain the stated access rules. The dais cannot become a jump-only player safe perch;
  - (e) the gate's cells lie on the boss room's gate wall (§11.1).
- **`viewMask`** (cells where open edges may form, §3.5), **`hazard`** (`Uint8Array`, a hazard id per cell, from template zones), **`roomOf`** (`Uint8Array`, a room index per cell, 255 for vestibules, bands and void) are new per-cell layers built by the generator.
- **`GateDef`** gains a `facing` (N, E, S, W). Its wall-plane and row-line values are **continuous boundary coordinates**, distinct from integer cell indices: canonical segment endpoints `(0,8)` and `(0,60)`, center `(0,34)` with outward normal W. Transform these with mirror `(x,y) → (W−x,y)` and clockwise rotation `(x,y) → (H−y,x)`, then translate to the stamped map; transform the normal to get facing and reconstruct the plane and half-open interval `u0 ≤ u < u1` from the endpoints. A mirrored 68 m west boundary is at x=68, not x=67; its center stays y=34. Template cell indices still use §3.3's `W−1−x`/`H−1−y` rules. Gate rendering, terrain omission, posts, collision/hit boxes and light sampling share this transform. Sample supporting floor/light from the adjacent **interior** cell, never by indexing an east/south boundary coordinate outside the map. This preserves the 50-cell face and its two post cells in every facing (§11.1; rooms/bosses catalogs).
- Boss room records retain transformed `addSpawns: { gate: Point[], field: Point[] }` and `bossPartSpawns: { watcher: Point[] }`. Partition the canonical template's 20 spawn markers into eight gate and twelve field points **before orientation**, and rotate/mirror the resulting groups and Watcher anchors with the template. Never infer gate-side groups from world x after rotation. The Pardoner has four item points followed by the fifth Chart point.
- Room runtime data retain each existing marker's permitted types from `spawnTags`, plus the Chorister/Dominion **preferred spawn marker IDs**, computed from its canonical `spawnAffinity` rectangles, then carried with the transformed/translated existing markers into the director. The generator stores these stable marker-ID lists in `Floor`/room records; they are seeded static content, not another network state channel. Type-safe placement filters restrictions before preferences and ordinary safe fallback (§4.7 rules 4, 10); restricted points never count toward the unrestricted capacity.
- `MAX_MAP_SIZE` 256 and the u16 positions are unchanged (§3.1). The A.1 floor crops to 220 × 256.

### 14.3 Room state, messages and the snapshot

- The linear assumptions (audit §3.6, §10.1 item 1) go: the countdown no longer needs earlier arenas cleared (`sim.ts:976`); joining places by the active room; the bot, music and HUD read the active room. The loop dispatches by explicit `kind` (§4.1), so a boss with empty ordinary waves still seals/runs its encounter and never auto-clears as a sanctuary.
- **Snapshot header:** every part carries protocol schema, the 16-byte `runId`, tick, reliable state revision, part index/count and total entity counts. Validate the run before allocating assembly state or advancing its tick watermark. `arenaIndex`/`arenaPhase` become `activeRoom` (u8, 255 = none) and `activePhase` (u8), plus the countdown as today, plus **`clearedMask`** (u32, bit `i` = room `i` cleared; ≤ 20 rooms) and **`pickupCount`** (u16). **Every leaf state derives from the header alone** (§3.4), so doors can't race between channels.
- **Pickups** (coins, gold halos, motes, items, Rite pages, Chart, key, chest and bells) are at most **160**, **9 B each with u32 identity**, reserved in snapshot part 0 before splitting enemy/projectile ranges. Critical reservation, overflow, per-human entitlement and multipart reassembly are defined in §14.12. Coins merged above value 3 draw the gold-halo kind; exact value is host-owned and supplied in their interaction card. Projectile bytes must be included in every packet-size estimate.
- **Props** are known to clients from the seed; breaks travel as events.
- **Input** gains the 16-byte admitted `runId`, two u8 press counters for items 1/2 and one flags byte: bit 0 `mapHeld`, bit 1 `qHeld`, bit 2 `eHeld`, other bits reserved zero. `INPUT_BYTES` grows from the inherited 30 to **49** (30 +16 +2 +1). Reject another run before updating sequence/counter history; local transport uses the same envelope. Validate exact byte length, finite floats, legal flags and accepted position/speed before interactions. Counters follow the existing wrapping Q/E semantics; one input cannot replay 255 uses. Held flags describe accepted key state; they are not additional cast edges.

  **Held and targeted ability transport:** Gatebreaker starts from one accepted E edge and uses `eHeld` to end the charge after its minimum duration; lost release still ends at its authored maximum. Preview/release abilities, including Falling Star and Rain of Fire, use reliable `castAbility {slot, abilityId, inputSeq, pressCounter, target: {kind: 'floor', point: [x,y,z]} | {kind: 'ally', playerId}}`; `cancelAbilityAim {slot, abilityId}` cancels only a preview, never refunds an accepted action. For preview/release abilities, increment the slot's cast/press counter on confirmed release, not on starting a potentially long preview; the request references that release input frame. For an immediate ally/point selection, increment on its confirmed cast. Gatebreaker and other immediate native abilities still increment on press. These use the mutating request envelope and current loadout version. Keep at most the last 16 accepted input frames and one pending target request per slot for at most 15 host ticks. Resolve only against its matching accepted frame, assigned ability, one unconsumed press edge, life/cooldown and the catalog range/room/LOS/target predicate. Missing/expired/mismatched input refuses without charge; it cannot borrow a later aim or cast after a swap. For a targeted assigned ability, its binary press edge alone does not cast: the validated reliable request consumes that same edge once. Repeated request/input cannot create another root; a refused edge is consumed and is not queued for a future cooldown. Single-press abilities retain binary edge handling. Clients predict only the catalog-authorized preview/movement and reconcile to accepted action/start/geometry/deadline records. Force-close preview on death, disconnect, hold, seal or assignment change; an already accepted action follows its own cancellation contract. R4 establishes this wire contract, migrates the existing targeted base consumers without changing how they play, and enables the Betrayer's alternatives; R5 enables the rest. **As built (R5, 2026-10-18):** no new request was needed yet. Gatebreaker's release is the next E press; Rain of Fire reuses Falling Star's client hold and its release press is cast at the host's current aim; the Well, the Boundary Chain and Cloud of Witnesses resolve on the press from the host's aim and ally target, refusing without cooldown ([implementation-decisions.md](implementation-decisions.md)).
- **Reliable `ctrl` messages** (new; each interaction is checked by the host for distance, room, phase and wallet, and answered by the events below):

  | Direction | Message | When |
  |---|---|---|
  | C→H | `loadout { profileId, classId, xp, clears, talents[], q, e, relics[2], owned[], deeds[], inventory[2], runId? }` | joining the Lobby, every Lobby change, with `enterGame` (`runId` = the profile's `run.runId`, for a rejoin); `clears` is the bounded profile heaven-clear map |
  | C→H | `advocate { talents[], q, e, relics[2] }` | an Advocate change (§9.6) |
  | C→H | `buy { pedestal }`, `openChest`, `claimRelic { offer, relic }`, `passRelic { offer }`, `bargain { choice }`, `pickRite { offer, node }`, `passRite { offer }`, `ringBell`, `teleport { room }` | the interactions of §4.12, §5.5, §6.5, §6.6, §9.6, §9.10 |
  | H→all | `loadouts { [playerId]: { level, talents[], rites[], suppressed[], q, e, relics[2], maxHp, loadoutRevision } }` | after every accepted loadout, Advocate change, Rite or bargain; accepted learned/Rite ids and suppressed learned ids resolve the effective kit for local movement/hints and other players' effect geometry |
  | H→all | `roomState { room, phase, knowledge, entrySocket, runXp? }` | every phase or knowledge change; `runXp` (every player's) on `cleared` |
  | H→all | `key { holder \| x, y }`, `chest { state }`, `map { revealed }`, `propBroken { id }`, `bell { room, state }` | each change |
  | H→all | `itemUsed { playerId, item, actionId, instanceId, owningRoom, acceptedTick, origin: [x,y,z], aim: [dx,dy,dz], flightBound?, flightDeadlineTick? }`, `relicClaimed { playerId, relic }`, `riteTaken { playerId, node }`, `teleported { playerId, x, y }`, `exitTimer { endsAtTick }` | each event (effects on other screens) |
  | H→one | `wallet { value }`, `inventory { slots }`, `pedestal { index, sold }`, `relicOffer { offer, relics }`, `riteOffer { offer, nodes, source }`, `bargainOffer { offer, relics \| rite }`, `advocateRejected { reason }` | that player's own state |
  | H→one | `floorSync { rooms[], key, chest, map, propsBroken[], bells[], wallet, inventory, pedestals, offers, loadouts }` | **right after `go`, before any other event to that client**; the host queues that player's events from `go` on, and reliable ordering does the rest |

  Pickups are not in `floorSync` (the snapshot carries them).

  **Item effect replication:** `itemUsed` carries the successful use's accepted root/instance/owning-room identity, normalized 3D aim and cast tick. For a thrown tool, its static `flightBound` is the first terrain/room/path limit, not a promised final landing: a moving enemy may intercept it sooner. H→all `itemLanded {actionId, instanceId, owningRoom, anchor: [x,y,z], activatedTick, endsAtTick}` supplies the actual host-resolved floor projection and converts the reserved flight entitlement into the area. A placed area emits that same activation record at placement; a self/instant tool creates no area. H→all `itemEffectEnded {instanceId, owningRoom, reason}` closes an active flight/area on replacement, clear, expiry, disconnect or other authored cancellation. These messages carry the ordinary run/tick/revision/event identity and never emit another use/charge/Codex/relic trigger. Clients draw/interpolate accepted flight data and correct to the authoritative landing; they do not decide interception or floor fallback. Counterseal's separate endpoint uses its body-ignoring, static terrain/room-clipped projection captured from the accepted use; it does not borrow an eventual enemy-intercepted landing.
- **Protocol envelope:** all mutating reliable `ctrl` requests carry `{runId, requestId, expectedRevision}`; accepted/rejected replies carry `{runId, requestId, stateRevision, result, reason?}`. `expectedRevision` is the scoped version map of §14.11, not the last world/snapshot revision. Outside a run, Lobby `loadout` uses `runId: null` and that connection's Lobby loadout revision in the map; active-run interactions require the exact admitted run id. Binary input has its separate run-scoped format and sequence/press-counter handling above; it does not use reliable request IDs. Cache bounded replies for retries; revisions and stale-state handling follow §14.11–§14.12. Request ids are strictly increasing u32 per admitted human/run (separate Lobby connection scope), without wrapping; a resume receives the next id. Events include `runId`, host tick and state revision; the tables above show payloads, not the full envelope. Clients render effects only once per event/request identity.
- **Additional reliable messages:** C→H `declineOffer {offerId}`, `overlayState {kind, open}`, `teleportCancel`, `recoverRun {profileId, oldRunId}`, targeted `castAbility`/`cancelAbilityAim` above, and `admissionReady {admissionId}` / `admissionRejected {admissionId, reason}`; H→one `recoveredRun {oldRunId, found, settlement?}`, `admission {runId, admissionId, admissionKind, admissionCommitted, progressionEnabled, acceptedLoadout, xpBase}`, `settlement {classId, admissionId, admissionCommitted, progressionEnabled, absoluteXp, persistentLoadout, inventory, ownership, deeds, clears, itemsTried, outcome}` and `interactionAck` with the envelope above. Recovery is authenticated only by this casual game's admitted profile identity, never a web account. An unresolved old run is recovered or explicitly marked absent before new admission. `overlayState` is host-validated and consumes the shared bounded hold allowance; teleport cancellation closes its host channel immediately. Offer decline is terminal only where that source permits it (bargain); `passRelic {offer}` terminally closes a free chest relic offer under §6.5's claim checks, while `passRite` closes an earned free Rite source without a reward. Esc is a view close, not a reroll or claim. Dominion wind-ups/cancellations use bounded reliable cast records from rooms.md §6, keyed by enemy incarnation and cast id with host start/impact ticks; receipt never restarts a full-duration tell.
- **Admission progress metadata:** validate `loadout.clears` as at most nine heaven keys 1–9 with finite nonnegative safe-integer values. At first admission capture `clearsBeforeRun = clears[heaven] ?? 0`; a known reconnect never replaces it with the browser's newer save. Victory's absolute current-heaven clear count is `min(Number.MAX_SAFE_INTEGER, clearsBeforeRun + 1)`; apply that entry without overwriting unrelated heaven counters. This supplies prior-win deed qualification for clients as well as the host. Personal records use the first-playable roster/Edict mask and a latched `rosterChanged` flag, carried in run state and recovery rather than inferred at settlement.
- **Modifiers on change:** an accepted `advocate`, `pickRite` or `bargain` re-resolves that player's modifier object (§14.7) on the host before the next tick.

### 14.4 Leashing

Trickle enemies have a home room; any displacement into a cell whose `roomOf` differs is refused and clamps to the last legal cell. The check lives in every path that moves an enemy: movement and steering, separation (`separate`/`tryDisplace`), the Fallen's knockback, the Binder's pull, Falling Star's launch landing and Discord's gust. Cheaper than per-room fields (audit §3.8).

### 14.5 Flow fields

The whole-map Dijkstra (audit §3.2) is the trap of an open floor. Fields are computed **only for players inside a room that has living enemies**, and the flood is **clamped to that room's rect plus its vestibules** (cells outside are treated as walls for that field). No field is computed while no enemy is alive anywhere; air fields only while flyers are alive. In a sealed room this matches today's 0.1–0.2 ms per field (r1-tech measured 0.38–0.44 ms in a sealed 2×2 against 1.8–2.5 ms whole-map).

**Hazard avoidance costs another bounded pass:** while an active hazard room contains a living ground enemy, maintain at most **four additional dry-ground fields**, one per living connected target slot (humans and bots included). Use the ordinary ground reach/step rules with active damaging hazard cells excluded; a target standing on fire projects to its nearest reachable dry anchor in the target's ground component (distance, then row-major ties). Reuse the existing rebuild cadence and target-cell invalidation, rather than rerunning a search per enemy or every tick. A displaced avoiding enemy already inside fire follows a cached nearest-dry escape map before its target field; no dry escape/anchor means stop and let §4.3's unreachable-target recovery handle the defect. Blessed, Choristers and Dominions share these dry fields; Cherubs keep air fields. Deactivate/release dry fields when hazards stop or no avoiding enemy remains. Performance acceptance accounts for these additional fields; historical ordinary-field timings do not include them. Player-created fire exclusion follows the hazard catalog's avoidance rule and bounded invalidation cadence, rather than silently adding an unbudgeted field per fire source.

### 14.6 Limits

- **Enemy types:** 16 (4-bit type in the snapshot). The Pearly Gates uses nine types: Blessed, Chorister, Cherub, the Dominion (4), Gatekeeper body (3), generic boss part (5: eyes and Seal), the Lectern Cantor (6), the Stray-Carrier (7) and the Watchman (8). No other new enemy is included.
- **Global caps:** 1 500 living enemies including boss parts and 400 projectiles, with hostile reservation and owned area caps of §14.12. Crest population is a reference target, not an upper bound calculated from an assumed kill rate (§4.6).
- One room in countdown or combat at a time (§4.2), so one director and one horde.
- Per-enemy streak-assist ticks (§10): 4 × u32 per slot.

### 14.7 Modifier layer

Talents, Rites and relics need a per-player modifier object (audit §5), resolved on the host from the legal loadout (§9.8) at `go` and **again after every accepted `advocate`, `pickRite` or `bargain`**. Ownership = learned ∪ Rites for gates; **effects = active nodes for the assigned kit after Rite suppression**, with at most one Delivery and one Payload per resolved named input, plus at most two active kill-discharge talents (§9.3, §9.10). Resolve the catalog's explicit shaping order before payload emission; supported alternatives have their own authored targets/numbers. Keep dormant ownership separate from executable effects and applied-state metadata. Source facts retain owner, origin/depth/input slot, target kind, floor/volumetric reach and landing-listener entitlement: merely knowing `airborne` exists cannot license a direct-launch-only listener from a relic launch. Use §9.9/items-relics.md §2.1.1's finite producibility closure for source/compatibility metadata; an unseeded chain of conditional effects cannot count as a present source. Recompute usefulness after accepted kit/item changes, actual source expiry and participant life/connectivity changes, without redrawing fixed offers. A temporarily absent source does not erase ownership or require respec; its state reader simply has no qualifying target. `useQ`/`useE`/`fireWeapon`/`damagePlayer` and the client's movement abilities read this resolved object. Abilities are keyed by ability id (not class), so Q/E can hold learned and Rite abilities; the client learns every player's Q/E from `loadouts` (§14.3). H hints, HUD tooltips and replacement previews read the same effective object. Relic triggers that read states (§8.1) read the host's per-enemy state flags (§4.11).

**Retained native source usefulness:** resolve current-kit metadata separately from actually retained accepted-action metadata. An unexpired same-room native source at depth 0 may still supply its original owner/input-slot damage or state after legal reassignment, but only if the authored cleanup/lifetime permits that exact source to remain. Thus a currently nondamaging Q/E does not erase an older accepted damaging source's slot credit, while a suppressed/removed contributor, expired source or secondary/reflected projectile supplies none. A pending native hit-count source qualifies only while its remaining authored window can still reach the distinct-hit threshold and that window is unconsumed; later sustained pulses cannot supply a new five-hit window. Offer usefulness may read those actual remaining sources without promising another cast, renewed lifetime or permanent slot compatibility. Tooltips distinguish a dormant current assignment from a pending retained source; recompute on source resolution/expiry without changing fixed card IDs.

### 14.8 Run lifecycle

The boss's death no longer ends the simulation (`checkVictory`, `sim.ts:951`): it triggers §11.5; the exit (§11.6) or defeat sends `gameOver` with the run results (XP, levels, Rites, relics claimed and pawned, deeds, the Sentence, best streaks, the crown). The MVP has one floor per run, so one `Simulation` per run.

### 14.9 Tests the generator needs, and the prototype's results

- **Generator tests (written in R1):** 1 000 pinned seeds per heaven (`imul(i + 1, 0x9E3779B1) >>> 0`, i = 0…999): ≥ 99% within 20 attempts; every floor passes `validateLevel` (§14.2) and a coarse zone-leak check; every rule of §3.3 holds (counts, distances, distinct key/Reliquary, single boss entry, fixed physical thresholds under permitted D4 orientations, the gate wall outer, leaves, bands, marked rooms, no template repeated). Appendix A.1's `0x12EBAA83` floor is a **historical revision-2 layout illustration**, not a current exact-output/attempt-0 fixture: content/orientation/marked-room validation may change assignments and successful attempts. The current same seed must give byte-identical `DungeonDef` JSON in Node and browser; pin its implemented output only after validation. Pool validation (§4.7), including both rectangle directions and fallback thresholds, and talent data (§9.3) remain future work. No checks were executed for this review.
- **Historically measured** with the revision-2 version of §3.3 steps 1–10 (the repo's `mulberry32`; before this revision's distinct-key restriction and orientation/content validation; steps 11–14 were outside the measured prototype), heaven 1, **10 000 seeds**. These are preserved research results, not validation of today's expanded pool or generation attempts:

  | Rule set | within 1 attempt | 5 | **20** | 200 | mean attempts | worst 1 000-seed block (≥ 99% within 20?) |
  |---|---|---|---|---|---|---|
  | **Revision-2 layout prototype** (coin 0.45, exclusive bands 0.30 / 0.40 / 0.50, gate rule, `N` 10–11; steps 1–10 only) | 26.81% | 78.26% | **99.71%** | **100.00%** | 3.83 | **99.5%** (all 10 pass) |
  | the same with revision 1's bands 0.20 / 0.30 / 0.40 | 22.12% | 70.22% | 99.17% | 100.00% | 4.67 | 98.5% (2 fail) |
  | the same without the gate rule (bands 0.20…) | 22.89% | 71.96% | 99.29% | 100.00% | 4.49 | 98.8% |
  | coin 0.40, bands 0.30… (more margin, not taken) | 29.16% | 81.06% | 99.82% | 100.00% | 3.57 | 99.6% |

  The coordinator's coin flip 0.45 (verified at 99.86% for revision 1's 12–13 rooms) is kept; with 10–11 rooms and the gate rule it needs the wider shape bands to pass the target with margin. The fallback floor was never needed within 200 attempts.
- **Rejects** (28 339 in 38 339 attempts; the first failing step counts): too few rooms 10 166 (26.5% of attempts), no Confessional/boss candidate 11 964 (31.2%; the gate rule adds about 1 point), no 2×2 3 956 (10.3%), no Pardoner 1 202 (3.1%), no Reliquary 1 051 (2.7%), no key room or bells 0.
- **Accepted floors:** `N` 10 in 49.1%, 11 in 50.9% (6 or 7 combat rooms). 2×1 + 1×2 per floor: 0 in 29.5%, 1 in 39.5%, 2 in 31.1%, horizontal and vertical now equally common (5 305 / 4 857). Boss `dist` 4: 71.2%, 5: 20.6%, 6–8: 8.2%. Reliquary `dist` 3: 77.8%, 4: 18.8%, 5–7: 3.4%; 1×1 in 89.2%. Pardoner `dist` 2: 49.2%, 3: 37.7%, 4–7: 13.1%. Leaves 2–5 (3 in 53%). The 2×2 combat room is band 2 in 91.1%, band 3 in 8.9%. Gate wall facing N / E / S / W: 27 / 25 / 24 / 24%. Rooms with an outer face 61.0%; the Breach 14.8%.

### 14.10 Implementation order and fun gates

Use [implementation.md](implementation.md)'s R0–R9 sequence (revision 9). Each contract arrives with its first consumer, so every milestone ends playable:

1. **R0:** preserve the baseline; record code gaps, version ownership and asset consumers; prepare R1.
2. **R1:** the generator, stamping, room kinds and lifecycle, doors, trickle, discovery and the map, using existing enemies and a 10-template pool; run identity, the room snapshot header and the build fingerprint.
3. **R2:** props, halos and motes with pickups in the snapshot, the Dominion, Refiner's Fire and dry-ground fields, the crest and safe spawning, the remaining templates, the recorded combat sound families (§1.3).
4. **R3:** profiles, durable admission, XP/levels, recovery and absolute settlement, the Pardoner, inventory, the eight consumables, clear rewards and their previews. Persistence precedes every permanent reward.
5. **R4–R5:** action/source/incarnation provenance, held/targeted ability requests and bounded secondary dispatch, then one complete pilot class (Betrayer, all three trees), the Confessional, the legal resolver and fixed-card Rites; then the other classes on the same contract. The full slice still requires all 84 nodes and 12 alternatives.
6. **R6:** key/chest/Pass, relics and combos, the pawn bargain, the Chart from the marked amphora, Pilgrim's Return, Bells, the Sundial, deeds/Edicts/Sentence/Absolution, streak assists and the crown.
7. **R7:** the authored Gatekeeper, parts and rescue, terminal settlement, safe shopping and the exit. **R8:** remaining feedback and assets. **R9:** full-content evidence, human acceptance and a separately requested merge.

**Fun gates:** Gate A in R1 (route choice), Gate B in R2 (pressure), Gate C in R4 (builds). A gate pauses content expansion until the human is satisfied; it doesn't cut scope.

**Performance:** design for the bounds above throughout; keep the benchmark workload runnable as features land; run it when the human asks, after playing, and collect the complete workload in R9 ([slice-acceptance.md](slice-acceptance.md)). A measured blocker is resolved before more content is built on it. Never claim a measurement that didn't run.

**Initial playtest hypothesis** (r1-fun finding 12): **≥15 deliberate choices per human per 10 minutes**. Count decisions with an intelligible tactical/resource/route tradeoff: a target or firing-position change in response to a threat, a pickup dive, a timed item use, a Rite/build choice or Pass, a purchase, an optional Bell decision, an actual fork or a bargain. Do not count repeated attacks at one target, automatic pickup confirmations, passive following or another player's decision as that human's choice. Review each player's experience, including the party member following the route leader; do not meet the number by adding compulsory menus or automatic clicks. The target and counting rubric require observed play rather than a claim that the authored reward count already proves the rate.

### 14.11 Authoritative interactions and combat composition

These contracts apply to every content table. Numbers attached to an individual effect live in its content file; no implicit damage multiplier or hidden proc is introduced here.

**Scoped versions:** the reliable ordering `stateRevision` is separate from a player's `loadoutRevision`, `inventoryRevision` and each offer's `offerRevision`. Loadout versions advance on accepted allocation/assignment/equipment/Rite changes; inventory versions advance on accepted charge/storage changes; offer versions advance on its pending selection, reservation or terminal change. Automatic XP/wallet credits, current source availability and another player's action never advance those compare-and-set versions. Those facts are instead validated from latest host state.

**Planar headings and area activation:** capture an immutable `castPlanarHeading` from the normalized horizontal projection of the accepted aim; if its length is ≤1e−6, use the unit heading of the accepted cast yaw. Stationary impacts/delayed clouds use that heading. A native swept movement leg instead captures its own immutable `planarHeading`: straight Shadowstep/Way Back uses the accepted path direction when that damage leg begins; steered Gatebreaker uses the accepted segment direction at its first positively damaged eligible victim. A zero-length horizontal path falls back to the cast heading. Store the leg's distinct-hit order, first positive hit point and heading without creating another action/proc root: `actionId`, cooldowns and used-discharge flags remain shared. Comb's native movement `hits 5+` condition accumulates distinct positive hits across that one accepted swept leg and dispatches its threshold once. A native censer shot counts its direct impact plus its first native cloud/furrow pulse group as one hit-count window on the same root, deduplicating victim incarnations and preserving the first positive hit point; later pulses never contribute, and an impact that already reached five cannot dispatch again. Derived lanes/rows use the qualifying attack/leg's stored heading, never the owner's later camera direction. Persist these records with delayed/movement sources and relevant effect events/`floorSync`; they add no input button or client-authoritative target. An item area receives `activatedTick` only on successful placement or thrown landing. Where a catalog selects the newest covering/landed area, compare greatest `activatedTick`, then lowest owner id, then lowest instance id. A flight reservation has no membership or activation tick until landing.

- **Transactions:** each reliable interaction request includes `{ runId, requestId, expectedRevision }`, with scoped `expectedRevision: { loadout?: number, inventory?: number, offer?: { id: number, version: number } }`. The host binds it to the connection's accepted player/profile and checks only the versions that request can overwrite: Lobby/Advocate and targeted ability requests need loadout; purchase needs inventory; Rite/bargain selection needs loadout plus offer; relic claim, `passRelic`, terminal bargain decline or `passRite` needs offer. The payload's offer id and scoped offer id must match a pending source owned by that accepted human; a passed/claimed/declined source can never resolve again. Shared key/chest/Bell/pickup claims, overlay state, admission acknowledgments, recovery and teleport use an empty version map and their latest source/phase/life predicates. Require the relevant keys, reject unknown ones, and still validate current wallet, source usefulness, entitlement, room, range and accepted position in the same atomic transaction. A stale relevant version returns current scoped state and a reason without spending; an unrelated XP/halo event cannot starve a valid request. Accepted changes advance their scoped versions and the reliable ordering revision. A repeated request id returns its original result; it never spends or rewards again. Clients show an accepted purchase/claim only after acknowledgment. Simultaneous world-pickup contenders resolve by host tick, pickup distance, then player id; other key/chest/shop/prop requests use host tick then player id; atomic claim marks the source before dispatching effects. Client-supplied inventory, XP, target coordinates and chosen rewards never bypass host validation.
- **Interaction priority:** F chooses the nearest valid looked-at world interaction within that object's range; ties use object id. Chest/key/bell/pedestal/Advocate actions take priority over reopening an offer in hand. A page opens on touch during a valley or countdown; offer/Advocate commits share that noncombat window (§9.10). Dead players cannot buy, pick up, ring, teleport or edit a loadout. Self-harm, damage and death interrupt teleport channels. A request received after sealing preserves its offer and is rejected; it is never a mid-combat respec.
- **Menu holds and teleport:** add reliable `overlayState { kind, open }` (only known offer/Advocate/Pause overlays are accepted; forced seal closes host overlay state). Extend input with `mapHeld` and the two item press counters. `teleport { room }` begins a host-timed 1.5 s channel, not an immediate position change; `teleportCancel`, movement above 0.05 m, damage, `mapHeld = false` or a countdown cancels it. Arrival uses the validated entry cell and a new teleport correction id; ignore pre-correction input positions until acknowledged. A request cannot teleport to undiscovered/uncleared rooms or through an active fight. The marker/overlay themselves need no client-authoritative gameplay state.
- **State sources:** keep source tokens `(player, action, expiry)` for timed states and area membership for `censed`/`pooled`. Same-state overlap does not multiply damage or speed effects; `bound` gives exactly ×2, and slow uses the strongest active factor. Removing one source cannot clear another's state. Refresh replaces that source's expiry, never shortens a longer independent source. Area membership stops on exit/despawn/death, with streak-assist history retained 1.5 s. Enemy slot reuse clears all source/assist history. Silence cancels an interruptible enemy cast; a queued cast waits for expiry rather than immediately refiring. Boss exceptions live in bosses.md. Ground hazards have world ownership: they cannot manufacture a player-owned area assist simply because a player walked near the kill.
- **Launch and movement composition:** an enemy can hold one accepted launch at a time. Further hits resolve their damage normally but cannot restart, extend or add a second displacement/landing record before it ends. One launch has one terminal landing; a later independent launch is permitted after that landing. Existing bound targets reject launch. A player likewise has at most one accepted movement ability envelope; a new movement ability during charge/dash/leap/return movement is refused without cooldown, and weapon recoil displacement is suppressed while that envelope is active (the shot still fires). Holds forbid movement abilities in either Q or E. Contact cuts/charges use swept accepted segments, clipped by terrain and room boundaries, with distinct-victim hit sets; endpoint-only checks must not miss victims at high speed. Ground-only areas test actual feet/floor contact: a Cherub grounded by an explicit talent can be affected, but an ordinary flying one cannot merely because its x/y overlaps a pool.
- **Damage provenance:** every action has `{ owner, actionId, origin, inputSlot, depth }`. One trigger event counts **distinct enemies actually hit for positive damage**; shotgun pellets, chain links and a cloud's first pulse do not count the same body twice. A sustained native cloud/furrow keeps its launch action id; only its first authored pulse group contributes to `hits 5+`, combined with any native direct impact of that same shot and deduplicated across both. Retain the first positive hit point and a consumed threshold flag; later cloud/furrow pulses cannot re-emit that hit-count event. Direct weapon/ability/item damage has depth 0; a relic/combo, delayed on-kill talent discharge or reflected projectile is secondary with depth ≥1. Secondary kills may receive ordinary kill/XP entitlement, but cannot start another relic/combo/talent damage, kill, hit-count or derived streak-tier proc. Native delayed damage of the equipped ability (including Rain of Fire, Trial by Fire, Cloud of Witnesses and a damage-broken base Shroud) retains the original inputSlot and depth 0. A direct shape augmentation is part of that root; a separately emitted passive discharge is secondary. A primary native/direct-item launch emits one landing event. Dispatch applicable landing passives once per owner/node with their source/position predicates, in owner/node id order, control before damage; every resulting discharge is depth 1 and may not emit another landing event. Item launch has no Q/E or ability-capstone entitlement. Relic/combo-origin launch does not dispatch landing passives. Independent later direct attacks may read relic-created states normally. Direct item state kills can trigger a state relic; reflections cannot acquire Q/E attribution. Only direct native damage of the named input equipped when that action was accepted earns a `Q/E kill` trigger; a surviving accepted source retains that original slot after legal reassignment. A shield's visible break has its originating caster/ability provenance, never its victim's Q/E. Base weapon multi-hit/area shapes remain part of their root attack, not proc chains.
- **World and environmental kill credit:** Refiner's Fire and other damaging world hazards use `{owner: null, origin: 'world', inputSlot: null, depth: 1}`. Their eligible combat deaths settle the victim's ordinary XP and type-specific coin/mote/item quota once; a world kill is not anti-softlock cleanup. No human gets fabricated killer/weapon/Q/E credit or an owner-kill talent/relic proc. Recent accepted player damage/owned state setup may still earn the ordinary 1.5 s streak assist, but world/secondary kills cannot dispatch derived streak-tier procs. A player-initiated blast prop and its chain inherit the initiating player/action, with prop origin, null input slot and depth 1; they earn that owner's ordinary kill tally while retaining the secondary-proc boundary. Enemy damage, world hazards and proximity alone never invent a player source token. Trickle and boss-add reward exceptions continue to apply. Catalogs use this same distinction between a credited **death entitlement** and a credited **player kill**.
- **Globe shoot-down:** shooting a hostile Chorister/Orb Volley globe emits its authored 40-damage, 3 m enemy-only blast with geometry line of sight, using `{owner: shooter, actionId: shootingRoot.actionId, origin: 'globe', inputSlot: null, depth: 1}`. Several shattered globes share their shooting root rather than manufacturing new direct attacks. Legitimate kills receive ordinary owner kill/drop credit, but the blasts cannot dispatch talent/relic/combo damage, kill, hit-count, derived streak-tier or Q/E procs. Boss-part area reduction still applies. Hostile terrain/range/player-impact shatter retains its hostile behavior and Volley hit ledger; a reflected globe has no hostile shoot-down/shatter behavior.
- **Trigger order and root dispatch:** collect a root action's native damage for the current tick, sample states immediately **before each fatal hit**, and credit each death once. Collect eligible requests in owner/relic/node id order, with victims in that action's accepted hit order (ties entity incarnation); apply control then damage secondary effects after collection. Each of at most two active kill-discharge talents (§9.3) admits **one bundle at that root's first eligible resolving tick**, including that tick's qualifying victims within its catalog origin/target cap. Later native pulses of the same cloud/area cannot dispatch that node again. Retain per-root used-node flags through the root's full native/delayed lifetime; a carried root cannot earn fresh discharges after reassignment/rejoin. Catalog meters may advance on their qualifying kills, but a cap/cooldown-blocked discharge is discarded, never banked for another tick/root. An effect cannot retroactively change the state used for its own trigger. Each trigger follows its catalog cooldown and target cap; internal cooldowns survive death, revive, swapping out/back and reconnect, and reset only on a new run. A respec must not reset stored talent discharge meters/cooldowns; initialize a first-time meter at zero. Relic/combo triggers aggregate the root's qualifying victims for each resolving tick into at most one activation per relic/tick, subject to its existing cooldown/target cap. A later native pulse may activate after that cooldown; secondary damage never does. Talent kill discharges retain their stronger once-per-root limit. Native shape/payload composition happens before this dispatch; it never creates another root action solely to bypass the cap.
- **Area-only propagation exception:** The Burning Plain/The Sixth Circle may read a credited combat death once per entity, including secondary fire deaths, to add/refresh burning cells. Propagation itself deals no immediate damage and creates no heal, loot or new proc event. Its next normal pulse remains secondary and obeys the owner's 600/400-cell cap and per-enemy pulse budget. This finite terrain propagation is not permission for recursive damage discharges. Bonus-mote harvest spends its quota when admitted either to the world list or to the bounded pending queue; queued motes expire 20 s from admission, not from later placement.
- **Merged fire and revival identity:** merging a visible burning cell does not merge its contributors' expiry, depth or input-slot provenance. A secondary spread cannot extend a native depth-0 source; after that source expires, remaining spread pulses stay secondary. Each soul may resolve revive once; a multi-soul Communion keeps one parent action, with revival listeners once per resolved soul and explicit class caps. One mote ID can be claimed once. Host entity identity includes a spawn incarnation, so slot reuse cannot satisfy an old action's distinct-hit set, landing, delayed effect or death entitlement; source records never use a reusable slot alone.
- **Areas and rays:** unless a row explicitly says otherwise, a radial effect uses 3D body-center distance plus unobstructed line of sight to the target, and affects only entities in its owning room. A floor pool tests the enemy's feet on reachable connected floor cells and **does not hit flyers or an elevated boss through the floor**; targetable airborne centers need an explicit volumetric effect. Rays and thrown projectiles stop at solid terrain/closed door leaves **and the owning-room boundary**, including an open doorway. Clip a throw to its first such intersection and resolve its landing at the last valid owning-room floor point; never fly into a neighboring room and jump backward on landing. A thrown pool's landing must be reachable floor, outside wall/door/hazard-invalid cells; clamp to the last legal ground point, else reject without charge. Prop blast chains process each prop once in id order. No area hits through another arena's walls.
- **Sustain:** check accepted invulnerability before shield/HP changes. Native damage-break effects and their part/tether/body consequences resolve synchronously after that accepted hit's HP/life changes and before all-dead defeat (§11.5), once per depleted shield id. The shield channel does not stack. A larger compatible new shield may replace it; equal/smaller application is rejected without consuming an item, except an ability row explicitly authorizes a different shield behavior. Expiry, manual replacement, respec and despawn never count as damage-break bursts. Motes require missing HP. Items/relics cannot create a shield/heal feedback loop, and talent-generated motes retain their stated source caps independently of the ordinary enemy-drop cap. Revive resolves at most once per soul, before a room-clear respawn; death clears active self consumables, shields and persistent relic effects, while accepted item flights continue on their accepted trajectory to their reserved landing and owned item areas expire normally; disconnect/leave removes those item areas/flights, while spent inventory remains spent. Rites/equipment persist through death. All-dead defeat commits before an uncast revive can save the run.

### 14.12 Entity budgets, synchronization and recovery

- **Entity budgets:** 1 500 enemies includes counted boss parts; 400 projectiles is global. Reserve **64 hostile projectiles**, so player shots cannot suppress required boss/Chorister attacks; a reflected shot reuses its existing entity and retains its original hostile-budget allocation until expiry, while collision allegiance/provenance change independently. It consumes no new friendly/relic projectile slot; boss parts use eight reserved slots outside the boss-add cap but inside the global enemy cap; ordinary adds/pending batches respect their own cap. Item/relic persistent areas plus **accepted thrown-flight area reservations** are at most **4 per human, 16 party-wide**, and persistent relic projectiles **4 per human** inside the global projectile cap. Base class clouds/chains retain their own existing bounded pools. Replacing a same-type owned area does not create a fifth. Reserve a thrown item's future area and projectile slot before charging it, so another proc cannot steal its landing entitlement. A manual item rejected at cap consumes nothing; autonomous procs may skip their visible effect at cap and still start their catalog cooldown. Expiry cleanup never generates a proc. Exact visuals may be pooled/merged, never exact hit detection or authoritative rewards.
- **Pickup capacity:** 160 pickups includes a **32-entry reservation for key, chest, Chart, bells and shared Rite pages**. Nonstructural coins/motes/items use at most 128 slots; reserve structural sources first when floor content spawns. An essential pickup is never discarded for a coin. Overflow motes/items remain in a bounded pending queue of at most 32, processed on the next freed slot; if full, discard the newest nonessential drop. Motes keep their original 20 s deadline even while queued. Coins first merge into a coin within 3 m in the same owning room with geometry line of sight, bounded to 99 halos per entity; the merged entity retains the **earliest constituent fade deadline**, never refreshes old money's lifetime. Else forfeit that overflow coin and record it in diagnostics. Never turn a pickup cap into a direct-wallet reward that bypasses risky collection. Each per-human page entitlement settles once even when its world page serves several humans.
- **Identity and snapshots:** pickup ids are monotonic **u32 per run**, not reusable u16 slots; each snapshot pickup is **9 B** (`id u32, x u16, y u16, kind u8`). Its vertical draw position derives from the ground height; hovering animation is cosmetic. `kind` uniquely identifies all eight items, coin/gold/mote, page, Chart, key, chest and bell. Each enemy record is **14 B**: the existing `slot u16, x u16, y u16, type/state u8, flags u8`, then **`z u16` in 1/64 m body-base/feet height and `incarnation u32`**, monotonic per run at spawn. Normal grounded z equals its actual supporting floor; grounded/falling/climbing Cherubs and lifted boss parts use their accepted simulated height. Derive a body's center from z and that type's explicit dimensions; a Watcher centered floor+6 m encodes base=center−half its body height. Effects and hit sets identify `(slot, incarnation)`, never slot alone. Reserve pickup bytes in part 0 before assigning enemy/projectile ranges; projectiles count in packet estimates. At worst the run-scoped header (including boss additions and repeated part metadata) plus 128 player bytes, **21 000 enemy bytes**, 3 600 projectile bytes and 1 440 pickup bytes (over 26 KB) **needs multipart transport** under the existing 16 000 B ceiling. Reassemble a complete tick before applying it; partial ticks must not open doors or remove pickups. Never claim a 13 KB bound that omits projectiles or actual height/identity. Large reliable broken-prop/room state deltas may be batched but carry one monotonic revision.
- **Bounded assembly and catch-up:** a snapshot has at most four parts, each at most 16,000 B; its full encoded tick is at most 64 KiB. Retain at most four incomplete ticks per admitted run for at most 500 ms of local receipt time, evicting the oldest; duplicate identical parts are ignored, inconsistent header/count/range siblings invalidate that tick. Check total enemy/projectile/pickup limits before allocating arrays. Lost parts leave the newest complete state visible until a later complete tick; they never become partial authoritative state. Clear assembler, prediction, press-edge and event context on a new run. Reliable `floorSync` uses at most sixteen 16-KiB chunks (256 KiB total UTF-8), explicit checkpoint/batch identity, chunk count and one terminal marker; apply only a complete validated checkpoint. While it is assembled, buffer at most 256 subsequent reliable messages /256 KiB for at most 5 s. A size limit, missing chunk or overflow abandons that catch-up and requests a fresh checkpoint at most once per second; after the existing 20 s loading timeout close with a recoverable connection error. Do not truncate required state, silently drop a wallet/offer sibling or build an unlimited queue. Live outgoing/incoming application control queues have the same per-connection 256-message /256-KiB cap. Coalesce superseded unsent volatile snapshots to at most two complete ticks; never coalesce/drop acknowledged transactional siblings. An overflowing reliable queue closes with a recoverable error and resumes through a fresh checkpoint. Floor-sync chunks are streamed through that bounded queue, not enqueued as an unlimited history. R2 preparation (when pickups enter the snapshot) budgets the complete slice's maximum wire payload, including planned catalogs; R3/R4/R5/R7 confirm their added fields before publishing consumers. If the required compact representation cannot fit, revise and version the bound before implementation, never silently truncate.
- **Sync boundary:** the host retains full authoritative records, including admission token/committed state; the client receives only its own private profile/offer/inventory/entitlement state, current connected public loadouts and the live shared encounter/effect projection. Host-only historical victim sets/dispatch bookkeeping are not duplicated onto peers; clients never replay them to decide damage or rewards. `floorSync` includes `runId`, immutable `progressionEnabled`, rules/content version, state revision, server tick/run clock, own admission id/committed state, room discovery and phase, ordinary/Bell seal recipient sets, pending bell state, refill counters, exit deadline, accepted persistent/effective loadout and Rite suppression, player alive/soul/HP/progress and immunity deadlines, scoped loadout/inventory/offer versions and next request id, active item/relic/class area/source/attachment/expiry and membership records, each accepted item flight's instance/root/owning-room identity, immutable 3D origin/aim and static wall/room/path bound, at-most-one-second flight deadline, current accepted position and reserved area entitlement, and each landed area's activation tick/anchor/expiry, grounding/launch/landing records, **active Dominion cast records with enemy incarnation, cast id, start/impact ticks and terminal state** (rooms.md §6), class meters and live presentation of native action/source IDs, immutable cast/damage-leg headings, first positive hit points and consumed hit-count windows, delayed effects (including Wind binds), Q/E and proc cooldowns, self-buff expiry, cumulative XP, all own fixed-card offers/entitlements, sold pedestals and current settlement. Per-root kill-discharge flags and distinct victim incarnations stay host-owned through their delayed lifetimes. During the boss floorSync also includes the complete encounter/part state in bosses.md §3.5: cycle origin, consumed schedule bits and deadlines, completion gates, active Call/Toll/Judgment, holds, Watchers/tethers, queues and remaining mote budget. Rejoin never starts a fresh boss cycle or rescue episode. Cache the newest snapshot while applying it. Events at or below its revision are discarded; newer events queue and apply afterward. Every own-state message includes its revision. A reliable event and an unordered snapshot are not intrinsically ordered. A disconnected record cannot reroll offers, refresh the Confessional, change class, reset charges, life state or restore carried inventory on rejoin.
- **Revision batches:** one transaction may emit wallet, inventory, ownership and visual messages at the same revision. Apply these as one reliable batch with an explicit end marker, or a single composite message; advance the client's applied revision only after the complete batch. Equal-revision sibling payloads are not duplicates. Deduplicate visual events by `(runId, revision, eventIndex)` and retries by request ID. A simulation snapshot is not a full reliable-state checkpoint: its revision cannot cause a newer wallet/offer/broken-prop batch to be dropped unless a complete `floorSync` already supplied that state. Reconnect snapshots/events older than an enemy's current incarnation must not attach an effect to a reused slot.
- **Version and trust:** the build handshake pins generator, content catalog and protocol schema together with an artifact/content fingerprint, not only the current package-version/Git-short-SHA string. Two dirty or differently configured builds at the same commit must be rejected before generation or a profile stake. R1 records the exact fingerprint producer and schema, rules and content-version fields; save schema remains an independent migration version. Local save/profile checks validate shape and legality; they do **not authenticate offline XP or ownership** and cannot prevent edited save codes. The slice is trusted-friend co-op with no ranked economy, PvP or competitive leaderboard. Host-authored run events are the authority after admission. A rejected/unknown request never crashes the sim or changes the record. C→H reliable controls use application-owned UTF-8 JSON bytes in a raw `ArrayBuffer` over the reliable PeerJS channel configured with `serialization: 'raw'` (host/local adapters use the same codec). Check the **16 KiB byte length before UTF-8 decode/JSON.parse**, then validate exact message shape and bounded fields. PeerJS's inherited pre-parsed object callback does not satisfy that pre-parse bound; do not accept both old object and new raw wire formats under the same protocol version. H→C full-state chunks use the bounded framing above. C→H has a per-connection budget of **16 mutating requests/s, burst 32**; binary combat input retains its separate existing cadence. Keep the last **256 request results per human/run** plus a request-id high-water mark in the retained run record. A cached retry returns the prior result; an evicted/older id is refused as `Request too old`, never executed again. Resume/floorSync supplies the next request id and scoped loadout/inventory/offer versions. The completed-run cache preserves settlement deduplication, not unlimited control history. Outgoing full-state batches obey the explicit chunk/queue bounds above. Rate-limit and validate hello/recovery before worker forwarding as well as admitted controls; malformed/over-limit input cannot grow a reply queue without bound. At most 32 distinct human profiles may be admitted in one run, four connected slots at once; voluntary departures do not reset the distinct-admission cap. Cache only final settlements for completed runs, not their full effect/control histories. Attempts started for debug/god inspection declare immutable `progressionEnabled = false` before admission and retain it in every settlement; normal attempts cannot enable simulation-changing debug commands (§13.4).
- **Retained source cleanup:** a native root, victim-incarnation set, dispatch flags and heading/hit window remain only while an accepted flight/area/movement/launch/landing/delayed listener can still refer to that root. Release the record after its final terminal resolution; expiry/cleanup creates no proc. Meter/cooldown state is bounded by the finite node/relic IDs; effect/source/attachment records follow their owning pools and authored lifetimes. Disconnect/clear/suppression removes the appropriate contributors, never leaves an unbounded history. Monotonic run-scoped action/entity/offer counters never silently wrap/reuse an identity; exhaustion refuses creation with a diagnostic and ends the attempt safely if a required encounter cannot continue.
- **Recovery boundaries:** a victory settlement is immutable once accepted. Subsequent post-win purchases/free-pickup storage/uses/earned claims update inventory/ownership/Codex with higher revisions without incrementing wins, clears, deeds or boss XP again; no new encounter or bargain can be admitted after victory. A host exit after victory leaves that victory intact. A pre-victory host exit restores only carried inventory, preserving checkpoint XP and permanent chest claims; pawn/Rites expire. Store failure retains the in-memory accepted profile for export. Mid-run solo resume and host migration are **outside the slice**; a crashed host cannot be reconstructed from a client's profile.

---

## 15. MVP boundary

### 15.1 In

- **One heaven, the Pearly Gates**, playable end to end in single player and multiplayer (1–4, bots filling), with persistence: profiles, export/import codes, characters per class.
- Generated floors (§3) of 10–11 rooms, all room kinds (§4.1), the leaf rule, the trickle, props, the map with reward plates, Pilgrim's Return, halos, motes, items, the Pardoner, the key and the Reliquary, relics and combos, deeds, enemy states, the Bell of Judgment, the Sundial, XP, levels to 10, Absolution, three trees per class, Rites, the Confessional and the Advocate's bargain, Edicts, streaks with assists and the crown, the reworked Gatekeeper, the exit with its timer.
- Recorded/layered frequent combat sounds, distinct variants, licensed assets and bounded mixing (§1.3).

**Content quantities:**

| Content | MVP | File |
|---|---|---|
| Combat room templates | **20**: 1×1 ×12, 2×1 ×5, 2×2 ×3 (each 2×2 horde- or hazard-focused, ends in a crest, ≥ 24 spawn points); at least 5 horde, 4 ranged, 3 flyers, 3 elite, 3 hazard (a template counts for its focus and secondary); at least 4 with a secondary; 1×1 band coverage: ≥ 5 include band 1, ≥ 6 band 2, ≥ 5 band 3 (a floor has at most 4–5 1×1 rooms per band, so no fallback past the band filter) | rooms.md |
| Special room templates | 4: Breach, Pardoner's stall, Confessional, the Gate (boss, gate wall inset to 50 cells); plus 1 fallback floor (A.1's layout) | rooms.md |
| Enemy types | the existing Blessed, Chorister and Cherub + **the Watchman** + **3 commanders** (Dominion, Lectern Cantor, Stray-Carrier) + Gatekeeper body and generic boss part; no other new enemy | rooms.md |
| Hazard types | 1 | rooms.md |
| Prop types | 3 families + the marked reliquary; the bell (one model, §4.12) | rooms.md |
| Enemy states | 7, with the looks of §4.11 (2 new: the `slowed` tint if not shown today, the `airborne` flag bit) | game.md, rooms.md |
| Items | 8, at least 2 applying a state | items-relics.md |
| Relics / combos | 12 (8 chest + 4 deed) / 6, each combo replacing relic b's effect | items-relics.md |
| Deeds / Edicts | 4 / 5 (both fixed in this document, §8.6, §2.5) | game.md |
| Talents | 4 classes × 3 trees × 7 nodes = 84, incl. 12 new abilities; each tree with a state node; every node works as a Rite | classes-*.md |
| Bosses / mini-bosses | 1 (the Gatekeeper reworked) / 0 | bosses.md |

### 15.2 Deferred

- Heavens 2–9 (their looks, features, enemies, bosses; heavens.md), more than one floor per heaven, the heaven factor and talent caps beyond the Pearly Gates.
- **Bigger floors for later heavens** ("the size of the map can increase with level"): the 7 × 7 grid fits about 11–13 rooms reliably (r1-tech §1.8). Before heaven 4, either cap `N` at 15 or grow the grid to **9 × 9** (`4 + 36·9 = 328` cells → `MAX_MAP_SIZE` 384; positions stay under u16's 1 024 m; the lightmap grows to 1 312 px), and require 2 2×2 combat rooms (step 3 already counts "fewer than required"). Re-measure the success rate then.
- **Isaac's chain:** after a heaven's boss, an option at the Stair to ascend straight into the next heaven within the same run, carrying halos, items and Rites (§11.6), so later runs become multi-heaven ascents. Needs the `Simulation` to load a second floor (§14.8).
- L-shaped rooms (mask arenas), roofs, secret rooms, curses, room loops.
- Mini-bosses, boss pools and champion variants, a second boss per heaven.
- Host-side bots added from the Lobby (bots stay dev-style tabs), bot talents and items.
- Ultimates (M13), Meshy sprites, music per room type beyond combat/boss, additional voice acting. Frequent recorded combat SFX are required by §1.3, rather than deferred with cosmetic art.
- A donation box or other halo sinks, item trading, negative items, more Edicts and deeds.
- Talents replacing the class's LMB/RMB weapons, stat nodes, multi-rank nodes. Authored augmentation of their shapes/payloads remains in the slice (§9.3).

---

## 16. Adopted design decisions

The following are **adopted slice decisions**, retained to explain deviations from the original brief. Their stated defaults are implementation rules, not pending approvals. Revisions 3–7 close content and lifecycle decisions; changing them is a future design revision. Initial balance values remain adjustable through observed play.

1. **Is the treasure room's door locked too, or only the chest?** The brief says both "treasure room (locked…)" and "the treasure chest is locked … unlocked by the player who holds the key". *Default: only the chest; the door is the white-gold Reliquary leaf, open like any other.*
2. **Losing the inventory on defeat.** *Default: yes, the carried and found items are lost; XP and chest relics are kept (a pawned relic is lost too).*
3. **No XP for healing** (shared XP instead). *Default: as specified (§9.1).*
4. **Learning new points in the Lobby too**, not only at the Confessional. *Default: yes (§9.5).*
5. **Clients play the host's heavens even if they haven't unlocked them, and unlock the next on a win.** *Default: yes (§12.3).*
6. **A second new enemy for the Pearly Gates** beyond the elite. *Decision: none in this slice; the Gatekeeper's Call supplies the rescue mechanic without adding a second regular special. A future enemy is a scope expansion.* **Superseded 2026-10-13:** Tomas expanded the scope with two family commanders, the Lectern Cantor and the Stray-Carrier (rooms.md §6.1–§6.3); the Carrier is a regular rescue moment.
7. **Should the boss also give a relic?** *Default: no; relics come from the chest, the Advocate's bargain and deeds.*
8. **The talent content volume** (84 nodes, 12 abilities) is the MVP's biggest job. *Default: all of it in the MVP; first build one complete pilot class, then the remaining classes (§14.10). Rites supply early run growth and unlock later choices through legal gates.*
9. **Bots as tabs** (today's dev bot) rather than "Add bot" in the Lobby. *Default: tabs in the MVP.*
10. **Profile per browser.** *October 14 decision: one current profile, code import/export in title Settings.*
11. **Halo sharing:** "everybody's pockets" is kept literally, with a fixed budget per room (§6.1). *Default: as specified, now with 3-halo coins and ranged enemies weighted 10.*
12. **Run length.** One floor per heaven (the coordinator's decision) of 10–11 rooms, about 20 minutes, with Pilgrim's Return. *Default: as specified; Isaac's multi-heaven chain is deferred (§15.2).*
13. **Names.** "Rite" for the run-only node; "Sentence" for the Edict count (not "Judgment", which is the Gatekeeper's move); "Absolution" for the cosmetic rank; "the Sundial of Mercy"; "Pilgrim's Return". *Default: as named.*
14. **What Edicts pay.** XP × (1 + 0.15 × Sentence), the best Sentence recorded, and a deed at 3. *Default: as specified; more halos would loosen the Pardoner's choice, more Rites would undo the Edicts.*
15. **Deed relics are granted by the deed** (the decision's "unlocked by deeds instead of the chest pool"), not added to the chest pool, and **deeds count from a profile's second win of the heaven**. *Default: as specified (§8.6).*
16. **The bargain's price:** −30% max HP for the rest of the run, the relic pawned until the boss dies. *Default: as specified; if playtests show everyone takes it, −40%.*
17. **The Sundial:** 14:00 for the Pearly Gates (from A.2), its Rite picked at the Advocate and applied at the seal. *Default: as specified; retune from playtest run times.*
18. **The bell is rung with F** (not by shooting it), so a stray shot can't start a wave. *Default: F.*
19. **The level curve is slower:** level 10 at 49 500 XP, about 7 won runs (revision 1: 31 500, about 5). *Default: as specified.*
20. **The boss HP table** changed to (1, 0.30), (2, 0.55), (3, 0.78), (4, 1.0) from a damage model (§11.2); revision 1 had 0.38 solo. *Default: as specified; the playtest decides.*
21. **No running through uncleared rooms** (the leaf rule, §3.4). *Default: as specified.*
22. **All consumable pickups go into inventory** and never auto-use or refresh (§7.3). *October 14 play-feedback decision.*
23. **The coin flip 0.45 is kept** as decided, but the target also needed wider shape bands (0.30 / 0.40 / 0.50) once floors shrank to 10–11 rooms and the gate rule was added (§14.9). *Default: as specified.*
24. **Pilgrim's Return is blocked while any room counts down**, even one holding for the party. *Decision: as specified; cancelling a scout countdown restores the valley. A future change must preserve host-timed channels and same-frame seal ordering.*
25. **The crest:** a 2×2 room's last wave is 60% of its budget, Blessed only, normally arriving in 6 s. *Decision: at least 1 000 alive is a reference base-kit acceptance target, not a reason to suppress skilled kills. Actual peak/performance are measured in the implemented build (§4.6).*
26. **No corridor healing exploit:** passive solo recovery is confined to ordinary combat relax and the separate inherited boss channel (§4.3); clear healing and Confessional entry remain explicit rewards.
27. **Recorded frequent combat sounds ship with the slice:** the reported fatigue is part of the fun problem, so §1.3 is an acceptance requirement. Additional visual art and voice work remain deferred.
28. **Veteran Rites may substitute one learned augment:** ownership/gates remain, one effect per resolved named-input channel executes with a compatible other channel, no capstone/explicit-exclusion/Rite bypass, and learned effects return at run end (§9.10).
29. **Offer cards stay fixed:** respec cannot redraw; disabled original cards may re-enable. Free Pass is terminal without halos, and paid/timed fallbacks retain their distinct conditions (§6.8, §9.10).
30. **Risk ends at victory; choice commits end at each combat seal:** no new post-win fight, Bell or bargain; already-earned claims and shopping remain. Choice/Advocate transactions may finish during a bounded countdown, while valley-only Bell/teleport/item-routing rules remain distinct (§4.3, §9.10, §11.5).
31. **Compatible talent composition** (confirmed by the developer 2026-10-11: talents may make abilities slightly more complicated; base kits keep one visible effect): one Delivery and one Payload per resolved named input, explicit target inheritance for alternative abilities, same-channel Rite substitution and at most two visible effects. This replaces the revision-5 one-augment rule (§9.3).
32. **Two active kill-discharge talents per build:** each admits one bounded bundle per native root; conditional setup does not release its budget. Relics retain their own cooldown/tick bounds. This prevents one piercing shot from discharging every owned kill node (§9.3, §14.11).
33. **The Way Back occupies E:** it trades immediate Shadowstep for a prepared return and retains Field on Q. Judas Coin is the one deliberate Field replacement; the boss requires no forced respec (classes-betrayer.md).
34. **World kills settle death rewards without a fabricated player killer:** recent real player setup may assist, while world/prop secondary deaths cannot start derived procs. Spawn restrictions belong only to Chorister/Dominion, and dry-ground navigation has an explicit additional field budget (§4.7, §14.5, §14.11).
35. **Source eligibility uses typed producibility:** no unseeded conditional loop, phantom ally, future hazard or wrong-origin launch can license a new offer (§9.9; items-relics.md §2.1.1).
36. **Interaction versions cover overwritten state:** current wallet/source/phase checks remain atomic, but unrelated host revisions cannot starve claims. Request results have a bounded cache and retained high-water mark (§14.3, §14.11–§14.12).
37. **A payoff must admit its advertised event:** Bread permits a bounded simultaneous harvest; Frost dispatches one bounded origin bundle; only accepted surviving Red Iron contact emits its reaction. Exact source/provenance rules govern cross-class setup (class host contracts).
38. **Geometry and event identity survive delay:** reward rectangles transform as rectangles; headings belong to the accepted attack/damage leg; item areas activate on placement/landing and publish authoritative 3D lifecycle records (§3.3, §14.3, §14.11–§14.12).
39. **A free chest offer may be passed:** terminal refusal releases reservations and grants nothing; Esc preserves fixed cards. Finite collections/deeds have no promised number of runs before completion (§6.5, §8.6).
40. **Developer attempts are disposable from admission:** immutable disabled progression precedes any stake/save write; normal attempts cannot enable simulation-changing debug. Victory distinguishes existing souls from already-living players, and settlement carries class identity after saved run state is cleared (§11.5, §13.4, §14.3).
41. **Current-kit dormancy does not rewrite an accepted source:** only actual unexpired sources permitted to survive authored cleanup retain native slot/setup eligibility; no removed contribution, consumed first-pulse window or secondary effect grants another action/lifetime (§14.7).
42. **One milestone order, contracts with their first consumer (revision 9):** the generated floor first (R1), then pressure and pickups (R2), durable storage before permanent grants (R3), provenance with the first talents and all three pilot trees before R5 expansion (R4). Three fun gates; benchmarks when the human asks after playing (§14.10).
43. **All combat wire data is run-scoped:** held input and validated target requests share one accepted press/action; complete snapshot parts cannot enter a different run. Raw control bytes and catch-up queues have explicit bounds (§14.3, §14.12).
44. **Persistent admission follows a durable stake:** the client must save the locked profile's run/inventory boundary before the host permits playable admission; failure never silently consumes or duplicates stored carry (§13.4).

### 16.1 Where this spec deviates from the brief

| Brief | This spec | Why |
|---|---|---|
| Halos per enemy drop chance, into everyone's pockets | Everyone's pockets, but a fixed halo budget per room | Per-kill drops would give a 4-party 2.5× the solo income per player (§6.1). |
| Enemies drop items (used right away if not active) | Wave Blessed drop at 2%, ranged at 12%, elites at 50%; loot props and clear rewards also supply items; placed and thrown pickups wait in the inventory during a valley | October 13 feedback requested more frequent enemy rewards. Low ordinary rates and the bounded pickup pool contain crowd drops; an offensive item used in an empty room teaches nothing (§6.3, §7.3). |
| "Items remain from the last session" | Carried items are lost on defeat or Leave run | The run's one stake besides the pawn (§2.4). |
| The treasure room is locked | Only the chest is locked; the door is open | One key, one lock reads clearly (§16 decision 1). |
| Treasure holds account-bound relics | Relics also from the Advocate's bargain (pawned) and from deeds | A second relic needs a risk (§9.6); four finite deed goals may all resolve on a qualifying second win (§8.6). |
| The build is locked in the dungeon (changed only at the leveling room) | Rites add run-only nodes from clears, bells and the Sundial | Without them the kit didn't change for 20 minutes of a run (r1-fun finding 1; §9.10). |
| Hazards: lava, ice, slime, goo… | 1 hazard type per heaven in the MVP | Scope; the rules support all of them (§4.10). |
| Map size and room count grow with the level | One heaven in the MVP (10–11 rooms); growth needs a 9 × 9 grid | The 7 × 7 grid fails from about 15 rooms (§3.1, §15.2). |
| Compete in combos (fast consecutive kills) | Streaks also count assists (states, clouds, the Field) | Otherwise the crown always went to the Fallen or the Betrayer (§10). |
| (Today) a room clear heals to full | 30% on clear, a full heal at the Confessional | Heal items, the Pardoner and motes would be worthless (§4.3). |
| XP from killing or healing | Killing (and clears and the boss), shared in full | Sharing already equalizes the healer; healing XP could be farmed (§9.1). |
| Talent points learned at the leveling room | At the Confessional or in the Lobby | A player who died early could otherwise not use their points next run (§9.5). |
| Roofs can exist or partly exist | No roofs in the MVP | The sim and lighting are one heightfield (§3.6). |
| Room shapes like the creature images (L-shapes) | 1×1, 2×1, 1×2, 2×2 | Arenas are single rectangles everywhere in the code (§3.1). |
| The leveling room close to the boss | The boss's only neighbor | The strongest form of "close": every route to the boss passes it. |

---

## Appendix A. Walkthroughs

### A.1 The example floor (generated)

**October 14 note:** these walkthroughs are historical design scenarios. Their profile-slot and automatic-item-use examples are superseded by §§2, 7.3 and 13.1.

Seed **`0x12EBAA83`** (pinned test seed i = 114), the Pearly Gates, **attempt 0 accepted**, `r = 1`, so `N` = 11. This is the historical layout prototype's output for §3.3 steps 1–10 (gen2.mjs, r1 review scratchpad); it is also the fallback floor's layout (rooms.md §5). Legend (here R0–R10 are **room numbers**, not milestones): `BR` the Breach (R0), `PD` the Pardoner (R5), `RQ` the Reliquary (R8), `CF` the Confessional (R9), `BS` the boss (R10), `Rn` combat room n; `===`/`||` join one room's slots, `---`/`|` are doors.

```
sx:  0     1     2     3     4     5     6
0   .     .    BS ===BS     .     .     .
                ||    ||
1   .     .    BS ===BS ---CF ---R6     .
                                  |
2   .     .     .     .     .    R3 ===R3
                                  ||    ||
3   .     .     .    BR ---R1 ---R3 ===R3
                      |           |
4   .    RQ ---R4 ---R2     .    R7     .
                      ||
5   .     .     .    R2     .     .     .
                      |
6   .     .     .    PD     .     .     .
```

Doors (placement order): R0–R1 (E), R0–R2 (S), R1–R3, R2–R4, R2–R5, R3–R6, R3–R7, R4–R8, R6–R9, R9–R10.

| Room | Kind | Shape, slots | dist | Band | Focus (example template) | Budget (TP at 4) | `H` | Clear reward (roll `u`) |
|---|---|---|---|---|---|---|---|---|
| R0 | Breach | 1×1 (3,3) | 0 | — | — | — | — | — |
| R1 | combat | 1×1 (4,3) | 1 | 1 | flyers | 340 | 12 | **Rite** (0.771) |
| R2 | combat, **bell** | 1×2 (3,4)–(3,5) | 1 | 1 | horde + hazard | 595 | 18 | nothing (0.167) |
| R3 | combat (the crest) | 2×2 (5,2)–(6,3) | 2 | 2 | horde + flyers | 2 000 | 30 | nothing (0.249) |
| R4 | combat, **key room** | 1×1 (2,4) | 2 | 2 | ranged | 400 | 15 | item (0.578) |
| R5 | Pardoner | 1×1 leaf (3,6) | 2 | — | — | — | — | — |
| R6 | combat, **bell** | 1×1 (5,1) | 3 | 3 | elite | 460 | 18 | nothing (0.199) |
| R7 | combat, **map reliquary** | 1×1 leaf (5,4) | 3 | 3 | hazard | 460 | 18 | nothing (0.021) |
| R8 | **Reliquary** | 1×1 leaf (1,4) | 3 | 3 | ranged + hazard | 460 | 18 | item (0.739) |
| R9 | **Confessional** | 1×1 (4,1), 2 doors | 4 | — | — | — | — | — |
| R10 | boss (the Gate) | 2×2 (2,0)–(3,1) | 5 | — | — | — | — | — |

- **Historical layout trace** (not current full-pool validation): the Breach's north and west exits failed their draws. Leaves before the boss: R5 (d2), R7 (d3), R8 (d3), R9 (d4). **Confessional:** R9 is the only candidate at `dist` 4; its boss anchor (2, 0) touches it through (3, 1), and the gate wall, the boss's west side ((2, 0)W, (2, 1)W), is outer. The boss's door is its E-bottom socket. **Reliquary** candidates R7, R8 → R8. **Pardoner** candidates R5, R7 → R5. **Key room** candidates R3, R4, R6, R7 → R4. **Map reliquary** candidates R1–R4, R6–R8 → R7. **Bells** candidates R1, R2, R6, R7 → R2, R6. The 2×2 R3 has `dist` 2, band 2 (it would be band 2 at `dist` 1 too).
- **Totals:** combat XP before the boss 4 715 TP + 7 × 100 = **5 415** per player; with both bells' waves (238 + 120, 184 + 120) 6 077. Halos: **129** max per player. Rolls: 1 Rite, 2 items, 4 nothing, no gold halo (a poor floor for halos, §6.7).
- **Crop:** slots x 1–6, y 0–6 → a **220 × 256-cell** map.
- **Outer faces (§3.5):** R3's east faces ((6,2)E, (6,3)E); R5's south; R6's north; R8's west; the boss's (2,0)N, (2,0)W, (3,0)N, (2,1)W. **None** for R0, R1, R2, R4, R7, R9 (6 of 11 rooms, the Breach among them: it paints sky windows, §3.5). Not outer, for example: R7's south (R5 is 2 out and 2 across, inside the wedge), R6's east (R3's (6,2) is 1 out, 1 across), R9's north (the boss's (3,0)).

### A.2 A single-player run

Tomas, new profile, the Fallen (400 HP). `P` = 1, `mult` 0.4, boss ×0.30. No Edicts (none unlocked yet). Items use the completed catalog; times, stock/relic draws and combat outcomes are illustrative design scenarios, not executed playtests.

1. **0:00 Lobby → floor.** Title → Profiles: slot 1 `New`, `Tomas`. Main → Singleplayer → Lobby: the Fallen (level 1, 0 points, no relics, empty inventory). The client sends `loadout`; `Start`: `start { heaven 1, seed 0x12EBAA83, edicts [] … }`; the client saves `run { runId, heaven 1, classId fallen, carried [∅, ∅], xpBase 0 }`. Loading 2.2 s.
2. **The Breach (R0).** Two doors: east a wing (R1, flyers) over a **burning page** (a Rite); south three heads and a flame (R2, horde + hazard) over an empty frame. Breaks 6 vases: one coin (3).
3. **0:20 R1 (flyers, band 1).** Steps in: countdown 20 s → he's in → 3 s → sealed 0:28. 136 TP solo over 3 waves; 60 s. Clear at 1:28: +440 XP (440); 30% HP back. Coins: 4 of 3; he gets 3 (wallet 12). The page: two eligible Fallen nodes, both tier 1 (no points yet); he picks Brimstone Tread (**Rite 1**; the overlay pauses the sim), gaining a fire trail. R3's door shows heads and a wing over an empty frame.
4. **1:40 back to R2 (horde + hazard, 1×2, band 1).** 238 TP solo, 95 s, luring Blessed over the hazard strip. +695 (1 135). Wallet 27. Reward: nothing. **A gold bell** hangs over the reward spot. R4's door (west) shows an orb over a Bitter Water icon; the Pardoner's (south) a coin.
5. **3:35 he rings the bell** (F): countdown 3 s, one Judgment wave: 95 TP of fodder and 1 elite at 80% HP (2 at 4 players: `nP` = 1, HP × 2 × 0.4 ÷ 1). 45 s; the elite drops 2 motes. +358 (1 493). No halos (the room's 18 are spent). A page: **Rite 2**, Fire and Brimstone; his shotgun kills now leave burning cells.
6. **4:40 the Pardoner (R5).** Pedestals: Chain Jar 40, Balm of the Rejected 25, Ash of Stillness 35, Pilgrim's Feather 30, the Chart 30. He buys Balm of the Rejected (slot 1). Wallet 2.
7. **5:00 R4 (ranged, the key room, band 2).** 160 TP solo, 70 s. **Level 2** early in the fight (`Level 2 — learn it at the Confessional`). Clear 6:23: +500 (1 993). The key rises in a gold beam; he takes it. The reward is a **Bitter Water**: a thrown item in a valley, so it goes into slot 2 instead of splashing an empty room (§7.3; A.4). Wallet 14.
8. **6:30 R8, the Reliquary (ranged + hazard, band 3).** 184 TP solo, 80 s; +560 (2 553). Wallet 29. The chest descends in the white beam; F opens it (the key is used up); his offer: a Common and a Rare chest relic; he takes Comb of the Host (saved at once). The reward, an Ash of Stillness (thrown, valley), can't go in: both slots hold other items, so it stays on the floor (it waits; items don't fade).
9. **8:15 Pilgrim's Return** (hold M, click R1, 1.5 s): he stands in R1 and walks on into R3 at once (no trickle: he left within 3 s).
10. **8:31 R3, the flood (horde + flyers, 2×2, band 2).** 800 TP solo: waves of 56, 64, 80 and 120 TP, then the **crest: 480 Blessed in 6 s**. He throws the Bitter Water into the crest's lane and uses Falling Stars into the pooled crowd. 150 s. Clear 11:01: +2 100 (4 653): **level 3**. Wallet 50. Doors: north a star (R6, elite), south a flame (R7, hazard), both over empty frames.
11. **11:01 R7 (hazard, band 3, the map reliquary).** 80 s, +560 (5 213); wallet 65. He breaks the gold-crossed urn: **the Chart**: the Confessional and the trumpet appear west of R6. The sundial under the minimap shows 2:20 left.
12. **12:40 R6 (elite, band 3).** 80 s: one elite per wave from wave 2, each at 40% HP; each drops a gold halo (6) and 2 motes. +560 (5 773); wallet 83. **14:00: the sundial goes dark** during the fight. A second bell: he rings it (14:20), 45 s, +304 (6 077), **Rite 3**, Pyre; survivors leaving his fire carry its pulse briefly.
13. **15:25 Pilgrim's Return to the Reliquary:** the Ash of Stillness he left there goes into the slot the Bitter Water freed. Pilgrim's Return to R6 and into the Confessional (15:55). Wallet 83, nothing to buy it with: both slots are full.
14. **The Confessional (R9).** Healed to full (first entry). At the Advocate (the sim pauses): level 3 → learns Red Iron and Weight of Sin (tree A's two tier-1 nodes, independently legal; his Rites count toward tree B's additional Rite gates, never toward spending learned points); equips Comb of the Host. The **bargain** offers 2 chest relics for 30% of his max HP (400 → 280); he refuses. No Sundial offer (dark). The overlay closes at the same 15:55 simulation time; the next five seconds are walking and the seal countdown.
15. **16:00 the boss seals** after the 3 s countdown. The Gatekeeper at ×0.30 HP. He hides from every Judgment, uses the Ash of Stillness on a summon and the Balm of the Rejected after an Orb Volley. ~3:45. **19:45 the boss dies:** +1 500 (7 577): **level 4**. Heaven 2 unlocks (`Coming later`, selection disabled in this slice). Nobody can be hurt now; the client saves `inventory` (both slots used up: empty) and `run = null`.
16. **The Stair.** His unbought pedestals stand beside it (Chain Jar 40, Ash of Stillness 35, Pilgrim's Feather 30); he buys the Ash of Stillness and the Pilgrim's Feather to carry. Wallet 18 (lost at the exit). 20:02 he stands in the light, 3 s: **Victory Results at 20:05; clear time 19:45**.
17. **Results:** Victory, clear time 19:45 (session 20:05), Sentence 0, about 1 750 kills, XP +7 577, level 1 → 4, Rites 3, relic: Comb of the Host, best streak 52 (Massacre). No deed: Unbroken counts from his second win (§8.6). **Lobby:** he learns Unbowed as his third point; the Ash of Stillness and the Pilgrim's Feather wait in his slots.

Illustrative session total 20:05 includes combat, traversal and post-win interactions; the comparable clear time stops at 19:45 boss death. The run clock freezes during true solo overlays; time spent choosing in those menus is wall time and must not be added to the timed result. Without the bells the boss seal would have come at about 14:00 (too late for the strict deadline), and skipping R7 too at about 12:20, inside the Sundial.

### A.3 A three-player run with a bot

Tomas (host, the Fallen, level 4, 7 577 XP, 3 points, Comb of the Host equipped; carrying the Ash of Stillness and a Pilgrim's Feather), Marek (the Betrayer, level 8, 33 000 XP, 7 points (Sicarius's six-point cutting capstone path plus Judecca), Petitioner's Tile and Seal of the Last Plea equipped (an unrelated pair): Field of Blood supplies pooled setup in Q and The Way Back supplies damaging returns in E; owns 6 of the 8 chest relics, with only Comb of the Host and Wheel of Review unowned), Jana (new profile, the Heretic, level 1), and one bot tab (the Binder, base kit). `P` = 3.5, `mult` 0.9, boss ×0.89. Seed **`0x7AD4EF28`** (pinned seed i = 935, attempt 0, `N` = 11):

```
sx:  0     1     2     3     4     5     6
0   .     .    R3 ===R3 ---R5 ---PD     .
                ||    ||
1   .     .    R3 ===R3     .     .     .
                      |
2   .     .     .    R1     .     .     .
                      |
3  BS ===BS     .    BR ---R2     .     .
    ||    ||                ||
4  BS ===BS ---CF     .    R2     .     .
                |           |
5   .     .    R7 ---R4 ===R4     .     .
                      |
6   .     .     .    RQ     .     .     .
```

R1 1×1 band 1 (340, bell, nothing); R2 1×2 band 1 (595, **guaranteed early Rite**); R3 2×2 band 2 (2 000, item); R4 2×1 band 2 (700, **key**, nothing); R5 1×1 band 3 (460, bell, item); RQ the Reliquary, band 3 (460, also the map reliquary, **Rite**); R7 1×1 band 3 (460, nothing); the Pardoner behind R5 (`dist` 4); the Confessional R9 between R7 and the boss (gate wall west). **The boss path (R2, R4, R7) skips the flood, R5 and the Pardoner.**

1. **Lobby.** Marek and Jana join by invite link; the bot autojoins. Each client sends `loadout`; the host's check passes (Marek: 7 points ≤ level 8 − 1 and ≤ 9). Tomas has won the Pearly Gates once, so Edicts are open: at Marek's request he turns on the **Edict of Poverty** (coins fade after 10 s): Sentence 1, XP ×1.15. `Start`; each client saves its `run` (Tomas: carried Ash of Stillness, `xpBase` 7 577).
2. **0:00 the Breach.** North a wing over an empty frame (R1), east three heads over a burning page (R2). Marek picks the early Rite and horde fight; the boss's position is still undiscovered.
3. **R2 (horde, 1×2).** Marek enters first: countdown 20 s, but **`Waiting for the party (1/3)`**: it ticks only with 2 of 3 inside. Tomas follows (ticks), Jana leaves the vases and steps in (everyone in → 3 s); the bot is with the host. Sealed 0:25. 95 s. Jana's clouds sit on the crowd Tomas taunts: her **streak counts the kills of enemies her cloud covered** (assists), Desecration at 25. Clear 2:00: +799 XP each (695 × 1.15). Coins credit all three wallets; with the 10 s fade they get 12 of 18 (wallet 15 with a vase coin). The guaranteed early page gives each human **Rite 1**.
4. **R4 (elite, 2×1, the key room).** Sealed 2:10, 105 s. Three elites (one per wave from wave 2, at most 2 alive), three gold halos. +920 (1 719): Jana **level 2**. Wallet 33. The key rises; Marek takes it. Doors: RQ (south, the chest over a burning page), R7 (west, an empty frame).
5. **RQ, the Reliquary.** Sealed 4:05. Marek, with the key, is swarmed and dies: the key drops on nearby reachable room floor. Jana (Sacrament) and the bot revive him; Tomas takes the key during a lull. 80 s; +644 (2 363); wallet 45. The chest descends; the **page** lies beside it (each human gets their own Rite offer: **Rite 2** for all three). Tomas breaks the gold-crossed urn: **the Chart**: R3 with an item plate, R5 with an item plate, the Pardoner, the Confessional and the trumpet. Tomas opens the chest: offers 2 of his 7 unowned chest relics, Jana 2 of 8, Marek 2 of his last 2. They claim their choices before leaving: Tomas Petitioner's Tile, Jana Broken Thurible, Marek Comb of the Host; only Wheel of Review remains unowned for Marek.
6. **6:00 the route.** Marek: R7, then the boss by 9:00 for the Sundial. Jana wants the Pardoner (behind the flood and R5). Tomas wants the flood's XP. They agree: R7, pick the Sundial Rites at the Advocate, then the flood, then back.
7. **R7 (ranged, band 3).** Sealed 6:25, 80 s; +644 (3 007); wallet 57.
8. **7:50 Jana's tab reloads.** The host keeps her run record (wallet 57, empty inventory, Rites 1–2, her claimed relic, `runXp` 3 007). Her profile still holds `run` with the same `runId`, so on `enterGame` nothing is overwritten; she's back at Tomas's feet at 8:20 with the same wallet and two Rites. No XP was made while she was away.
9. **8:00 the Confessional.** Healed to full on entry (Jana at 8:20 on her first resumed entry, recorded per player). At the Advocate, the **Sundial Rite** offer: each picks a node (pending until the seal). Jana learns her 1 point. Marek takes the **bargain**: only one chest relic is left, a Legendary; 120 → 84 max HP; the relic is pawned and equipped at once. Marek equips his newly claimed Comb of the Host and pawned Wheel of Review, exchanging Tile/Last Plea for Harrow of the Host: a planned slowed crowd lane instead of bind setup and E-death launch.
10. **9:05 the flood.** Pilgrim's Return to the Breach (not into R1: it isn't cleared). R1 (sealed 9:15, 60 s, +506 (3 513), bell appears; they skip it and its ordinary coins have already faded, adding no halos). **R3** (sealed 10:30): waves of 126 / 144 / 180 / 270 TP at `mult` 0.9, then the **crest: 1 080 Blessed in 6 s**. Tomas taunts and Falling Stars into the middle, Jana's clouds hold the crowd, Marek lines up Silver Bullets through it, the bot chains a pile; the modeled crowd may approach 1 050 alive; actual peak depends on kills and safe placement (§4.6). Tomas throws his Ash of Stillness into a reachable lane to slow the crowd, dies once in the crest and is revived. 140 s; +2 415 (5 928). They collect all 30 crest-room halos (wallet 87). The reward, a Pilgrim's Feather (self), goes to Jana, who touches it first: used at once.
11. **12:50 the decision again.** R5 and the Pardoner would take about 2:20: past 14:00. They skip them. Pilgrim's Return to the Confessional. Tomas is now **level 5** (13 505) and learns the point at the Advocate; the boss countdown holds while his overlay is open (≤ 45 s). Jana is level 3 and learns hers.
12. **13:20 the boss seals**, before 14:00: the three Sundial Rites become **Rite 3** for each. The Gatekeeper has 46 280 HP at ×0.89; the aiming phase spawns 3 + 3 + 1 = 7 targets; Called Seals can be rescued by a teammate or the bot, while Watchers open within the humans' weapon reach. Marek plays at 84 HP behind cover. ~3:10 in this illustrative successful party run. **16:30 the boss dies:** nobody can be hurt; +1 725 each (7 653 for the run); heaven 2 unlocks for all three; Marek's pawned Legendary is saved; **deed `mercy`** (won after the timed Sundial qualification) for Tomas and Marek, who had won the Pearly Gates before; Jana's first win counts no deed.
13. **The Stair.** Nobody visited the Pardoner, but each one's pedestals stand by the light: Jana buys Balm of the Rejected and the Ash of Stillness (wallet 87 → 27), Tomas an Ash of Stillness (→ 52), Marek a Pilgrim's Feather (→ 57). Tomas steps into the light at 16:45: the **30 s timer** starts; everyone is in by 17:05: **Victory, 17:08**.
14. **Results:** Victory, clear time 16:30 (session 17:08), Sentence 1 (XP ×1.15); XP +7 653 each: Tomas 4 → 5 (15 230), Jana 1 → 4 (7 653), Marek 8 → 9 (40 653); Rites 3 each; relics claimed; Marek's Legendary out of pawn; the `mercy` deed relics; **the crown to Jana** (best streak 131, Apocalypse, mostly assists from her clouds in the crest). Jana's reload keeps the ordinary outcome but makes this run ineligible for a comparable personal best time (§13.2). The bot presses `Back to lobby` after 2 s; all profiles saved.

### A.4 Gaps found by the walkthroughs and fixed in the rules above

Revision 2 (paper walkthroughs on historical generated layouts; no game execution implied):

- A player could run through an uncleared room before its countdown sealed it and reach the next, skipping fights (and the Sundial would pay for it): **an uncleared room's leaves open only toward a cleared room** (§3.4).
- Clear rewards always land in a valley, so a thrown or placed item reward was "used at once" into an empty room: **placed and thrown pickups go to the inventory during a valley** (§7.3).
- A teleport arrival or a walk through a cleared room spent a trickle refill on nobody: **the trickle spawns only if a human is still inside after 3 s** (§4.8).
- The Sundial's Rite would have been a menu at the boss's seal (combat): **it is picked at the Advocate and applies at the seal** (§6.8).
- A newcomer carried through a first win collected deed relics (Jana would have earned two): **deeds count from a profile's second win of that heaven** (§8.6).
- The bargain with one chest relic left had no rule: **it offers 1** (§9.6).
- A disconnected player's XP while away was unspecified (and A.3 of revision 1 missed it in one place): **gains go to connected humans only; the run record's `runXp` waits** (§9.1, §12.2).
- The boss countdown while a teammate learns a point at the Advocate: covered by the menu hold, capped at 45 s per room (§4.3).
- The exit with one player shopping: bounded choice holds and a 120 s absolute deadline (§11.6) end it; the pedestals by the Stair remove the walk back (§6.6).
- The full map's mouse use for Pilgrim's Return conflicted with firing and aiming: **while M is held the mouse moves a map cursor and nothing fires** (§5.1).

Kept from revision 1 (still true):

- A scout stepping into a room would force a fight: the countdown **cancels** after 3 s with no human inside (§4.3).
- A party split across branches: one active room at a time, and the seal **teleports everyone and every soul** in (§4.3), now only the minority who stayed out (the countdown waits for half the party).
- An instant heal picked up at full HP would be wasted: "active" includes **"would change nothing now"** (§7.3).
- A key holder dying in a sealed room: the key **drops on reachable room floor nearest the soul** and anyone takes it (§6.5).
- Bot tabs share the human's localStorage: bots **never touch profiles**, and a profile lock stops two tabs on one profile (§13.1, now with Web Locks).
- Boss summons could be farmed for XP: **boss adds give no XP or halos** (§9.1, §11.2).
- Three items bought for two slots: the Pardoner refuses (`Inventory full`), so what to carry is part of the choice (§6.6).
