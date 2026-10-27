# R1 technical review of docs/rogue/game.md

Lens: implementability, internal consistency, correctness of numbers, technical risk. Reviewed against `m12` at 066bce6. Nothing in the repo was changed.

**Prototype scripts** (session scratchpad `C:\Users\TPouzar\AppData\Local\Temp\claude\C--Users-TPouzar-source-repos-meatgrinder\b69314e7-47de-4360-803e-c74873aa497d\scratchpad\`):

| File | What it does |
|---|---|
| `gen.mjs` | §3.3 steps 1–10 written literally (imports the repo's `mulberry32` from `src/sim/rng.ts`), with an optional variant object; also the §3.5 cone rule (`faces`) and an ASCII printer. |
| `run.mjs` | `node run.mjs '<variant json>' <heaven> <seeds> [show]`: success rates, reject reasons, distributions, examples. |
| `sample.mjs` | 10 disjoint blocks of 1 000 seeds: does each pass the §3.3 unit-test target? |
| `a1check.mjs`, `a1faces.mjs`, `a1seed.mjs` | Appendix A.1: replays its placement, checks its outer faces, generates its seed. Also checks the tree property. |
| `stamp.ts` → `stamp.bundle.mjs` | Stamps a generated floor into a real `DungeonDef` (§3.1 pitch, §3.4 sockets, leaves and vestibules, flat placeholder templates at 2.0 m) and runs the repo's `loadMap`, `validateLevel`, `FlowField` and `bakeLightmap` on it. Bundle with `npx rolldown <stamp.ts> --file <stamp.bundle.mjs> --format esm` from the repo root. |
| `views.mjs`, `gatecheck.mjs`, `bands.mjs` | How many rooms have a view, whether the boss's gate wall is an outer face, 1×1 rooms per band. |

**Assumptions I had to make** (the spec doesn't say; see finding 14): `r` (§3.1) is the attempt RNG's first draw, `rng.int(2)`. Out-of-grid neighbors count as free. Step 2.4 is read literally: when the 2×2 is no longer allowed, `u < 0.20` falls through to the 2×1 test. Seeds are `imul(i + 1, 0x9E3779B1)` for i = 0…9 999.

---

## Part 1. Generator prototype results (heaven 1, 10 000 seeds)

### 1.1 Success rate

| Rule set | within 1 attempt | 5 | **20** | 200 | mean attempts | worst 1 000-seed block (≥ 99% within 20?) |
|---|---|---|---|---|---|---|
| **§3.3 as written** | 19.78% | 69.03% | **98.89%** | 100.00% | 4.85 | 98.7% (**3 of 10 blocks fail**) |
| coin flip 0.5 → **0.45** (step 2.2) | 27.69% | 80.42% | **99.86%** | 100.00% | 3.58 | 99.7% (all pass) |
| coin flip 0.40 | 33.68% | 87.84% | 99.95% | 100.00% | 2.91 | – |
| step 2.4 bands 0.30 / 0.40 / 0.50 | 24.03% | 75.55% | 99.67% | 100.00% | 4.09 | 99.3% (all pass) |
| step 2.4 bands exclusive (no fall-through) | 20.76% | 70.35% | 99.31% | 100.00% | 4.62 | – |

**The spec misses its own target** (≥ 99% of 1 000 seeds within 20 attempts): 98.89% overall, and whether the unit test passes depends on which 1 000 seeds it uses (blocks range 98.7–99.3%). The fallback floor was never needed within 200 attempts.

**Smallest change that meets it with margin: step 2.2's coin flip from 0.5 to 0.45** (one number; 99.86%, every 1 000-seed block ≥ 99.7%). The distributions below barely move with it (boss `dist` 4 in 59% instead of 54%; same room, shape and leaf counts). The knob the spec names (step 2.4) also reaches the target (bands 0.30 / 0.40 / 0.50: 99.67%) but with less margin, and it changes the shape mix (87% of floors get two 2×1/1×2 instead of 76%).

### 1.2 Reject reasons (literal rules; the first failing step counts; 48 469 attempts in all)

| Reason | Count | Share of all attempts |
|---|---|---|
| Fewer than `C` rooms (the queue emptied: coin flips and the neighbor rule) | 25 668 | 53.0% |
| No Confessional/boss candidate (step 5) | 6 488 | 13.4% |
| No 2×2 combat room (step 3) | 5 581 | 11.5% |
| No Pardoner (step 7) | 598 | 1.2% |
| No Reliquary (step 6) | 134 | 0.3% |
| No key room (step 9) | 0 | 0% |

With coin 0.45: too few rooms 13 469, Confessional/boss 6 320, no 2×2 5 437, Pardoner 469, Reliquary 120 (25 815 rejects in 35 815 attempts).

### 1.3 Distributions of accepted floors (literal rules)

- **Room count** `N`: 12 in 5 099 floors, 13 in 4 901. The small skew comes from drawing `r` per attempt (13-room attempts fail more often).
- **Shapes** (all floors, boss excluded): 1×1 87 915, 2×2 10 000 (exactly 1 per floor), 2×1 11 568, 1×2 5 418. Horizontal rooms are twice as common as vertical ones, because 2×1 owns both the 0.20–0.30 band and the fall-through and 1×2 only 0.30–0.40 (finding 14).
- **2×1 + 1×2 per floor:** 0 in 5.9%, 1 in 18.3%, 2 in 75.8%. **Required counts are achievable and always met:** exactly one 2×2 combat room in 100% of accepted floors (step 3 enforces it; it can't become a special room, since those are 1×1 or 2×1), at most two 2×1/1×2 in 100%.
- **Boss `dist`:** 4: 54.0%, 5: 27.8%, 6: 10.4%, 7: 4.5%, 8: 2.3%, 9–10: 1.1%. Always ≥ 4 as claimed.
- **Reliquary `dist`:** 3: 62.6%, 4: 27.7%, 5: 7.1%, 6–9: 2.6%. Shape 1×1 90.3%, 2×1 7.0%, 1×2 2.7%.
- **Pardoner `dist`:** 2: 30.2%, 3: 42.3%, 4: 20.4%, 5: 5.1%, 6–9: 2.0%.
- **Leaves** (not the Breach, not the boss; the Confessional stops being one once the boss attaches): 2: 7.9%, 3: 32.7%, 4: 42.2%, 5: 15.8%, 6–7: 1.4%.
- **Tree property holds:** across 3 000 floors, 0 pairs of 4-adjacent slots of different rooms lack a door.
- **1×1 combat rooms per band per floor:** band 1 up to 4, band 2 up to 5, **band 3 up to 7**. With ≥ 5 band-3 templates (§15.1), about 8% of floors fall back past the band filter (step 11). That's allowed, just worth knowing.

### 1.4 Three example floors (literal rules)

Legend: `BR` Breach, `BS` boss, `CF` Confessional, `RQ` Reliquary, `PD` Pardoner, `Kn` key room n, `nn` combat room n; `==`/`||` join slots of one room, `--`/`|` are doors.

Seed `0x9E3779B1`, accepted at attempt 7, `N` = 12:
```
 .   .   .   .   .   .   .
RQ==RQ   .   .   .   .   .
    |
 .  05   .  01   .   .   .
    |       |
06--03==03--BR--02--K4--PD
    ||  ||          |
 .  03==03   .   .  CF   .
    |               |
 .  07   .   .  BS==BS   .
                ||  ||
 .   .   .   .  BS==BS   .
```
Outer faces (§3.5): 1 N; 4 N; 6 W; 7 S, W; PD N, E; RQ N, W (left slot), N (right slot); boss E (both slots), S (both slots). Spot check: room 2's north face is *not* outer, because room 1 at (3, 2) is one slot out and one across, inside the 90° wedge. That's correct by the rule.

Seed `0x3C6EF362`, attempt 0, `N` = 13:
```
 .   .   .  07--10   .   .
            |
 .   .  03==03   .   .  RQ
            |           |
 .   .   .  01--04==04--K8
            |
 .   .   .  BR   .   .   .
            |
 .   .  02==02--05--CF   .
        ||  ||      |
 .   .  02==02   .  BS==BS
        |           ||  ||
 .   .  PD   .   .  BS==BS
```

Seed `0xDAA66D13`, attempt 2, `N` = 13:
```
 .  K7   .   .   .  BS==BS
    |               ||  ||
 .  04--01==01   .  BS==BS
        ||  ||          |
 .   .  01==01   .   .  CF
            |           |
 .   .   .  BR--02--05==05
            |           |
 .   .  03==03   .   .  09
        |               |
 .   .  PD   .   .   .  10
                        |
 .   .   .   .   .   .  RQ
```

### 1.5 The §3.5 cone rule, measured

- 21.5% of all room faces are outer. **41% of rooms have no outer face at all, and the Breach has one in only 4.5% of floors** (it sits at the center by construction). The first room of every run almost never has a view (finding 31).
- Stamped floors without a `viewMask` (today's 150 m facing rule only): 234–379 open-edge cells per floor, and only 5–9 of them aren't next to a cone-outer face (corner cells). So the cone rule and `computeHeights` nearly agree. The mask costs few views and is still needed: it stops arcades on template wall stubs joined to the band, which the facing rule alone would allow (`heights.ts` candidate rule).
- Terrain draws the backs of walls toward void (`terrain.ts`: "a cliff below the level, or the back of a wall"). So a diagonal view onto another room's outside wall wouldn't show through it. The wedge is a taste choice, not a correctness need.

### 1.6 Appendix A.1 against the rules

- **Not generatable as drawn.** The Breach's children come out as written (R1 N, R2 E at anchor (4, 3), R3 S; `a1check.mjs` confirms R2's anchor). Then R1 is processed and its **north exit comes before its west exit**. R5's 2×2 anchors containing n = (3, 1) are tried in row-major order (2, 0), (3, 0), (2, 1), (3, 1), and **(2, 0) fits first** (all its neighbors are free at that moment, since R4 doesn't exist yet). So R5 would sit at x 2–3, not 3–4. Then R4 at (2, 2) would have two occupied neighbors (R5's (2, 1) and R1) and be skipped. R10 and the boss as drawn can't follow.
- **Numbering:** in placement order R1's N child is placed before its W child, so the drawn R5 is room 4 and R4 is room 5. That matters for "ties: the lowest room index".
- **The seed:** the prototype's `0x5EED0001` (attempt 0, under my `r` assumption) is a different floor: a 2×2 at (4, 3), two 1×2, the Confessional at (6, 1) (`dist` 4), the boss at (4, 0) (`dist` 5), the Reliquary at (0, 3). The spec's "seed `0x5EED0001`, attempt 0 accepted" will mislead an implementer who writes a test from it.
- **The rest checks out** given the drawn layout. The R10 boss attachment is valid. R11 can't attach a boss, though the reason is incomplete: (5, 0)'s footprint touches R5 *and* (4, 2)/(5, 2) footprints overlap R2/R5. R10 wins the tie by index anyway. The Reliquary candidates are only R11 and the Pardoner candidates R7 and R8, as stated. The bands, budgets (sum 4 835 TP), XP 5 735, halos 147 and the **crop 256 × 220** are all correct. All the outer and not-outer face claims match the cone rule (`a1faces.mjs`).
- A.2 step 11 says the trumpet appears "west of R10": the boss's door is on R10's **north** edge (b = (1, 1), L = (1, 2)).

### 1.7 Stamping a floor into the real loader (`stamp.ts`, 4 floors)

| Measure | Result |
|---|---|
| Map sizes after crop | 220 × 220 to 256 × 256 (always ≤ `MAX_MAP_SIZE` 256) |
| `loadMap` (warm) | 76–155 ms on flat placeholder floors (real templates add wall candidates to `computeHeights`' O(n²) facing loop) |
| `validateLevel` | 7–25 ms |
| `bakeLightmap` | 125–165 ms (flat floors) |
| Ground flow field, all leaves open | 1.83–2.51 ms each |
| Ground flow field, the 2×2 sealed | 0.38–0.44 ms each; 0 cells reached outside its rect ± 1 (the leaves-in-the-band seal works) |
| `validateLevel` errors, every floor | `arena n: only k x cells in its rect` for every non-combat room; `S cell inside its rect` ×4 for the Breach (finding 1) |

Leaves in the band, each owned by one room, passed the loader's "D cell in exactly one arena" rule and the seal check. Vestibule floors become their own zones in `computeHeights`, which is harmless.

### 1.8 Later heavens (informational; deferred content, but §3.1 states the formula)

| Heaven | `N` | within 20 | within 200 | mean attempts |
|---|---|---|---|---|
| 4 | 15–16 | 89.70% | 100% | 9.5 |
| 6 | 17–18 | 66.00% | 100% | 18.7 |
| 9 | 20 | 24.85% | **94.15%** | 66.0 |

At heaven 9 the second 2×2 is placed in only about 27% of floors (2 390 2×2 rooms over 1 883 floors), and step 3 rejects only when *no* 2×2 is placed (finding 13).

---

## Part 2. Findings

### Blocker

**1. blocker, §14.2 / §3.3 step 14: `validateLevel` rejects every generated floor; "every other rule stands" is false.**
Every room must be an `ArenaDef` to own its leaves (loader rule, `map.ts:132-143`). But `validate.ts` requires, for **every** arena:
- at least 6 `x` cells (`validate.ts`, "only … x cells"), while §4.7 rule 4 gives non-combat rooms none;
- **exactly 4** entry cells, while §14.2 says "4 per used socket" (a 3-door room has 12);
- no `S` cell inside its rect, while the S cells are in the Breach;
- "the B cell is outside the boss arena", checked against `map.arenas[length − 1]`. The boss happens to be last in placement order, but the spec says "boss allowed on any one room".

Stamped floors fail at step 14 on every attempt (§1.7). After 200 attempts the fallback floor would always be used.
**Fix:** in §14.2, replace "every other rule stands" with the explicit list:
- (a) ≥ 6 `x` cells only for rooms with `waves.length > 0` (and §4.7 rule 4's 8/12/16 in the pool test);
- (b) `entryCells` becomes `entry: Array<{ socket: number; cells: [4 cells] }>`, one per used socket; each cell is a non-door floor cell inside the rect;
- (c) the 4 `S` cells are inside the Breach's rect and in no other;
- (d) exactly one room has `boss: true`, and `B` is inside *that* room's rect;
- (e) non-combat rooms are exempt from the `x` rule but still sealed.

Also change `sim.ts:967-987`, which must skip rooms without waves (they go `idle → cleared` on visit).

### Major

**2. major, §3.3 / §14.9: the success target fails as written.** 98.89% within 20 attempts; 3 of 10 1 000-seed blocks fail (§1.1). The spec's remedy ("tune step 2.4") is the weaker knob.
**Fix:** step 2.2 `rng.next() < 0.45` (99.86%; every block ≥ 99.7%). Reword the last sentence of §3.3: "tune the coin flip (2.2) first, then the shape bands (2.4)". Pin the test seeds: `seed = imul(i + 1, 0x9E3779B1) >>> 0`, i = 0…999.

**3. major, Appendix A.1: the example floor can't come out of the rules, and its seed claim is false** (§1.6). R5's first fitting anchor is (2, 0); R4/R5 are numbered against placement order.
**Fix:** no small anchor-order tweak produces the drawn layout (the drawn anchor (3, 0) is the second of four), so **regenerate A.1 from the reference implementation** (once finding 2 and finding 14's choices are fixed) and replace "Seed `0x5EED0001`, attempt 0" with the seed it actually came from; then redo A.1's table, A.2's route and the A.1-based numbers in §6.7. Swap the R4/R5 labels to placement order. Fix "west of R10" to "north of R10" (A.2 step 11). Name R11's real blockers (§1.6).

**4. major, §2.2 / §9.8 / §14.7 / §9.6: no message carries a loadout to the host, and mid-run changes aren't covered.** `start` is H→C (`messages.ts`), yet "Start (host): enabled when … every human's loadout is legal" and "the loadout travels in `start`/`enterGame`". The host has nothing to check. §14.7 resolves the modifier object "at `go`", but the Advocate (§9.6) changes talents, Q/E and relics mid-run. The host must re-check them, re-resolve the modifiers, and others must learn the new Q/E ids (VFX, party frames).
**Fix:** add `loadout { profileId, classId, xp, talents[], q, e, relics[2], owned[], inventory[2], runId? }` C→H, sent in the Lobby on every change and with `enterGame` (`runId` = the profile's `run.runId`, for rejoin). The host broadcasts `loadouts { [playerId]: { level, q, e, relics } }`. Add `advocate { talents, q, e, relics }` C→H, which the host checks with the same §9.8 function, using level = level(xp at start + runXp). On success it re-resolves that player's modifiers and broadcasts; otherwise it replies `advocateRejected`. Q/E cooldowns carry over on a swap, so a swap can't reset them.

**5. major, §12.1 / §14.3: the event list is incomplete and has ordering races.** These state changes have no message: wallet balance (individual spending), run inventory, item used (VFX, other players' wards and pools), relic offer → pick → confirmed, key holder change, chest opened, per-player pedestal sold, the active room's entry socket (needed for teleport placement and the bot's countdown goal, `bot.ts` `entryIndex`), map revealed, prop broken, Confessional heal used, level-up. `floorSync`'s timing is unspecified. Today a joiner gets `start`, loads for seconds, then `ready` → `go`, so events sent in between would hit a client that has no floor yet. Doors: §14.3 says "doors derive from each owning room's phase", but phases come on `ctrl` while the active phase comes in the `snap` header, on two independent channels.
**Fix:**
- (a) **Derive every leaf state from the snapshot header only:** a leaf is closed iff its owner is `activeRoom` and `activePhase == combat`. One room in combat at a time makes that complete. `roomState` events then carry only knowledge and cleared state.
- (b) Send `floorSync` right after `go`, on `ctrl`, before any other event to that client. The host queues per-player events from `go` on, and reliable ordering does the rest.
- (c) Add to §14.3: `wallet {value}`, `inventory {slots}`, `itemUsed {playerId, item, x, y, z, yaw}`, `relicOffer {relics}` (H→one), `claimRelic {relic}` (C→H), `relicClaimed {playerId, relic}`, `key {holder | x, y}`, `chest {state}`, `pedestal {index, soldTo}` (H→one), `map {revealed}`, `propBroken {id}`, `roomState { room, phase, knowledge, entrySocket }`.
- (d) Drop "pickups" from §12.1's reliable list and from `floorSync`: the snapshot carries them (§14.3). Keep them in one place.

**6. major, §2.4 / §12.2 / §13.4 / §13.5: rejoin and crash rules lose or duplicate state.**
- (a) §13.4 says at `enterGame` the client sets `run = { runId, heaven, carried: inventory }` with `inventory` emptied. On a **rejoin** (A.3 step 4) the inventory is already empty, so `carried` is overwritten with `[empty, empty]`. A later *Host left* then "restores" nothing.
- (b) **XP base:** "XP saved = XP at `start` + runXp". The client doesn't store XP-at-start, and the run record has no `runXp`. If the host restores `runXp` on rejoin and the client uses its saved (already checkpointed) XP as the base, XP is double-counted. If the client keeps a stale base, XP is lost.
- (c) The run record (§12.2) lacks: `claimed` (else a rejoiner can claim a second relic from the same chest), pedestals sold (else a reload restocks the Pardoner for that player), Confessional heal used (else a reload gives a free full heal), stats and `bestStreak`.
- (d) The wallet rule contradicts itself. "Starts at the halos credited so far … minus what that profile spent" includes credits made while they were away, but A.3 restores the record's 61, which doesn't.
- (e) At the boss's death the inventory is saved but `run` stays set until the exit. A crash or *Host left* after the boss then runs "`inventory = run.carried`" or "resolve as defeat". Both overwrite the post-boss inventory that §11.5 promised to keep.

**Fix:**
- (a) At `enterGame` with `profile.run?.runId === start.runId`, don't touch `run`.
- (b) Make the save rule `xp = profile.run.xpBase + runXp`: the client writes `xpBase` into `run` at the first `start` of that run. The host's run record keeps `runXp`, so a rejoin continues the same counter.
- (c) Run record = `{ wallet, inventory, offer, claimed, pedestalsSold, confessionalHealed, runXp, stats }`.
- (d) Wallet on rejoin = the record's wallet; the formula is for first-time joiners only.
- (e) At the boss's death save `inventory = run inventory` and set `run = null`. From then on, save the inventory after every purchase or use, since nothing post-boss is at risk.

**7. major, §13.1: the profile lock doesn't hold, and the save order is impossible as written.**
A 5 s `setInterval` heartbeat is throttled in background tabs: at least 1 s, and after 5 minutes hidden, once a minute under Chrome's intensive throttling (single player has no WebRTC to exempt it). So a backgrounded game tab's lock goes stale and a second tab can open the same profile, and last writer wins. A reload of the same tab sees its own lock for up to 10 s and shows `Open in another tab` (A.3 step 4's reload). "Writes the new JSON, then moves the old one to `.bak`": the old one is gone once overwritten.
**Fix:** use the Web Locks API: `navigator.locks.request('heavenfall.profile.<n>', { ifAvailable: true }, …)`, holding the lock with a never-resolving promise. It's released automatically on close, crash or reload (Chrome 69, Firefox 96, Safari 15.4). Keep the timestamp key only as a fallback where `navigator.locks` is missing. Save order: read current → write it to `.bak` → write the new JSON to the main key.

**8. major, §9.1 / §4.4 / §4.6: "a room is worth its budget in XP whatever the party size" is false with per-type round-up, and solo elites aren't scaled.** `scaleCount` rounds up per type (`sim.ts`), so `elites: 1` per wave stays 1 solo. A.2's R11 (460 TP, 2 elites from waves 2–3) solo gives 136 TP of fodder → 340 XP, plus 2 × 60 / 0.4 = 300 XP, plus 100 = **740, not the stated +560**. Solo, the elites are 120 of 256 TP = **47%**, above §4.5's "elites ≤ 40%" (validated only at 4 players, §4.7 rule 7).
**Fix:** per-kill XP = `TP[type] × n4[type] ÷ nP[type]` (counts at 4 players and after scaling, per wave, fixed at the seal), so a room pays exactly its budget. Apply §4.5's elite cap at P = 1 as well, or scale elite HP by `mult(P)` and say so in rooms.md.

**9. major, §3.1 / §4.4: "horde rooms hold 1 000+ enemies" isn't what the budgets give.** A 2×2 at band 2 is 1 200 TP over 5 waves: about 1 150 enemies *in total* at 4 players (≈ 460 solo). The director caps a new wave at "more than the largest wave alive" (`sim.ts:1016-1021`), so the **peak alive is ≈ 2 × 0.27 × 1 200 ≈ 650**. Today's peak is 980 (Cloister). The brief calls very large masses non-negotiable.
**Fix:** either 2×2 base **2 000 TP** (still ~67 s of killing at 30/s, inside 120–180 s) with a last-wave share ≥ 0.27, or change the §3.1 sentence to "about 650 alive at the peak, about 1 150 per room". The playtest should decide. The first keeps the premise.

**10. major, §9.3 / §9.9: the exclusion rule can make capstones unreachable and allows only one passive per class.** "Two nodes with the same `Modifies` exclude each other, across all three trees". `passive` and `movement` are `Modifies` values, so all passive nodes of a class are mutually exclusive. A tree needs 5 of its 6 lower nodes for the capstone, so two exclusive pairs inside one tree (or one pair plus one excluded by another tree's pick) make it unreachable. Nothing checks for it.
**Fix:** exclusion applies only to `LMB`, `RMB`, `Q:<id>`, `E:<id>`; `passive` and `movement` don't exclude. Add a talent-data unit test: per class and tree, the capstone is reachable with exactly 6 points from an empty build, and a legal 9-point build exists for every capstone.

**11. major, §6.6 vs §6.7 / A.2 step 9: the economy example breaks the Pardoner rule.** §6.6 says each player may buy each pedestal once and the 4 pedestals hold 4 distinct items. §6.7 and A.2 both buy **two Frost flasks** (40 + 40). The "≈ 135 income, buy 3 of 4" tuning rests on that example.
**Fix:** either allow buying a pedestal up to the item's stack cap (then say so in §6.6, and "Sold" appears at the cap), or rewrite the examples with a third distinct item (e.g. Chart 30 + Frost 40 + Holy water 25 + a 40-halo item = 135).

**12. major, §11.1 / §14.2: the Gate on a generated 2×2 has three unhandled facts.**
- (a) `gateLayout` (`gate.ts:104-140`) puts its corner posts at `yCenter − y0 − 0.5` = 25.5 m, "in the corner cells". On a 68 m wall they'd stand mid-wall with 8 m of plain wall each side.
- (b) Only an x-plane (west wall) is supported. `facing` needs the layout, terrain skip and tracer hit boxes rotated.
- (c) The gate is see-through (railings) and its spires reach F + 50 m. In **12.2%** of floors the wall opposite the entry isn't an outer face (`gatecheck.mjs`), so the gate becomes a view where §3.5 forbids one.

**Fix:** the boss template insets the gate wall to exactly 50 interior cells + 2 corner cells (walls 9 m deep at each end of that side), so the M10 geometry applies unchanged. Implement `facing` as a 90° transform of the layout. In §3.3 step 5, add to the candidate test "and `B`'s two faces opposite `b` are outer (§3.5)". This costs little success rate, since candidates are already rare.

**13. major, §3.1: the room-count formula for heavens 4–9 doesn't fit a 7 × 7 grid.** Within 20 attempts: heaven 4 89.7%, 6 66.0%, 9 24.9% (94% within 200). The second 2×2 appears in about 27% of heaven-9 floors, and step 3 rejects only "no 2×2". "No code limit changes" holds only for heavens 1–3.
**Fix:** mark the formula *MVP only* (heaven 1: 12–13). Before heaven 4, either cap `N` at 15 or grow the grid to 9 × 9 (`4 + 36·9 = 328` cells → `MAX_MAP_SIZE` 384; positions stay under u16's 1 024 m; the lightmap is 1 312 px). Change step 3 to "fewer 2×2 combat rooms than the heaven requires".

### Minor

**14. minor, §3.1 / §3.3: rules an implementer has to guess.**
- (a) Where `r` comes from: per attempt biases `N` toward 12 (5 099 vs 4 901). Fix: `r = fmix32(seed ^ 0x52) & 1`, once per seed.
- (b) Step 2.4's fall-through: once the 2×2 is placed, 2×1 gets 30% and 1×2 10%, so horizontal rooms are 2.1× as common. Fix: say "bands are exclusive: `u < 0.20` → 2×2 if allowed, else 1×1; `0.20 ≤ u < 0.30` → 2×1 …", or keep the literal rule and state the bias.
- (c) Out-of-grid neighbors count as free.
- (d) `rng.next/int/pick` don't exist (`mulberry32` returns a bare function). Say "wrap it as `{ next: f, int: n => Math.floor(f() * n), pick }`".
- (e) "Integer arithmetic only" contradicts the float RNG and weights. Reword to "no `Math.random`, no transcendental functions; IEEE double `+ − × ÷` and `Math.floor` are allowed", since those are identical in Node and browsers.

**15. minor, §3.3 step 12 / §3.4 / §4.7: orientation and sockets under rotation are undefined.** "`rng.int(8)` … limited to the 4": draw how? `Shape` has no `'1x2'`, so step 11's "by shape" needs `1x2 → '2x1'`. 1×2 socket numbering isn't listed.
**Fix:** "orientation = `allowed[rng.int(allowed.length)]` over the canonical list (rot 0, 90, 180, 270, then mirrored), where `allowed` keeps those mapping the template's long axis onto the room's". Socket numbers are the template's: a placed room's socket k is `orient(k)` by the D4 action on the clockwise list. The template filter uses `shape === '1x2' ? '2x1' : shape`.

**16. minor, §3.4: door sockets aren't on the 4 m art grid.** Offsets 14–17 put leaves at world x = 36·sx + 18…21, which straddles two 4 m segments. So every door blanks two window/pilaster segments (`looks.ts:204`, "a segment cut by a door is plain"), 8 m of plain wall per doorway. A centered aligned span doesn't exist on a 32-cell interior.
**Fix:** accept it and say so, or use offsets 12–15 / 48–51 (centered within 2 m; aligned).

**17. minor, §4.7 rule 3: it forces the room's base floor to 2.0 m without saying so.** "Every group of floor cells not at socket height is covered by an obstacles rect", so a room whose main floor is at 0 m must tag its whole floor as an obstacle.
**Fix:** state "a template's base floor is at socket height (index `8`); obstacles are the cells above or below it". Note that walls and zone tops then start 2 m higher (wall ≥ 2 + 8 m).

**18. minor, §4.7 rule 8 / §3.3 step 13: prop counts and the marked reliquary.** "Counting sockets at chance 1 (the expected count Σ chance must be in range)" says two different things. If every loot socket in the map reliquary room rolls empty, there is no Chart drop on the floor.
**Fix:** "Σ chance over the family's sockets is in range". In step 13: "in the map reliquary room, the first loot socket is always filled and becomes the marked reliquary".

**19. minor, §6.4 / §6.6: two host rolls are "deterministic" but unspecified.** The clear reward is "from `fmix32(seed ^ roomIndex)`", with no mapping to 50/30/20 and no item draw. The Pardoner stock is "rolled from the floor seed" with no method. Clients need the stock to draw pedestals, and `floorSync` doesn't carry it.
**Fix:** `u = fmix32(seed ^ imul(roomIndex + 1, 0x27D4EB2F)) / 2^32`; < 0.5 nothing, < 0.8 gold, else item `weightedPick(mulberry32(that hash))`. The stock is 4 weighted picks without replacement from `mulberry32(fmix32(seed ^ 0x9A4D0E5))`, computed in `generateFloor` and stored in `Floor`.

**20. minor, §0 / §4.4 / §4.8 / §11.2: `mult(P)` with fractional `P` needs code changes the spec calls "today's".** `partyMultiplier`/`scaleCount` index `MULT10` by integer party size (`sim.ts:114-135`). The Director's `singleplayer` flag (solo breath) is a boolean from the menu, which says nothing about 1 human + bots. The trickle uses `P` but nothing is sealed.
**Fix:** `mult(P) = lerp` as written, `scaleCount(n, P) = ceil(n × mult(P) − 1e-9)`; the solo breath applies iff humans = 1 and bots = 0. Trickle and its XP use `P` at the moment it spawns.

**21. minor, §4.3 step 5: the 15 m far-spawn rarely works in a 1×1.** In 32 × 32 m, four players at the quarter points leave no point farther than 11.3 m from all of them. One player in the center leaves only the corner regions past 15 m (~31% of the area). The M12 fallback (8 m, then any; `sim.ts:1288-1293`) handles it, so this isn't broken, but 1×1 waves will mostly arrive at 8 m.
**Fix:** state it, or set `SPAWN_FAR_DIST` per shape (1×1: 10 m).

**22. minor, §14.1: the load budget is tight and `loadMap` repeats.** `validateLevel` needs a `GameMap`, so step 14 includes `loadMap`: 76–155 ms warm on *flat* stamped floors, where `computeHeights`' facing loop is O(candidates²). Then each peer loads the map again (main thread, worker).
**Fix:** `generateFloor` returns the `GameMap` it validated, and callers reuse it on that thread. `computeHeights` applies `viewMask` *before* the facing loop (fewer candidates). Budget: "generation + stamping + loadMap + validateLevel ≤ 300 ms".

**23. minor, §14.3: snapshot size with pickups.** At the caps, 27 + 4×32 + 1 500×8 + 400×9 = 15 755 B already. Adding 160 pickups × 7 = 1 120 B gives 16 875 B > `MAX_SNAPSHOT_BYTES` 16 000, so 2 parts, both needed (`SnapshotAssembler`), which doubles the loss sensitivity. Only the bench (1 500 Blessed) gets there under the new budgets (finding 9), but it is the perf gate. The header also needs a pickup count, and `encodeSnapshot`'s part ranges must include pickups. A merged coin's value (2, 3…) isn't representable in `kind`.
**Fix:** pickups go only in part 0 (the bench's enemies spill into part 1). Header +2 B (`pickupCount` u16). Merged coins keep kind "gold" at ≥ 5, else "coin": the value is the host's business.

**24. minor, §14.4 / §4.8: leashing must cover every displacement path.** "A step into a cell whose `roomOf` differs is refused (movement and steering)". Trickle enemies are also moved by separation (`separate`/`tryDisplace`), Fallen knockback, Binder pull, Falling Star launch and Discord's gust.
**Fix:** list them: the check goes in `tryDisplace` and every launch or knockback landing; a refused displacement clamps to the last legal cell.

**25. minor, §4.9: props have no collision or hit volume.** "Broken by any player hit" needs a ray target, as globes have (`sim.ts:1867-1925`). Whether props block players or enemies isn't said. 1 000 Blessed against solid vases is a separation and perf question.
**Fix:** props are non-solid for movement (enemies and players pass through), with hit cylinders of radius 0.5 m and height = sprite height for rays and areas, tested like globes.

**26. minor, §12.2 / §13.3: duplicate profile ids.** Importing your own code into a second slot (or a friend importing yours) gives two slots, or two party members, the same `id`. Run records are keyed by it, and the slot lock doesn't see it.
**Fix:** on import, if any slot already holds that `id`, give the imported copy a new id (tell the player). The host refuses a `loadout` whose `profileId` is already in the run (`Profile already in this game`).

**27. minor, §11.5 / §11.6: defeat is still possible after the boss dies.** Blast props hurt players (15 HP) and `checkDefeat` still runs. A party at low HP could "lose" a won run while shopping.
**Fix:** after the boss's death, players are invulnerable and `checkDefeat` is off.

**28. minor, §13.5: the room-clear save can miss the clear's XP.** `stats` (with `runXp`) comes once per second (m12-followup-2 §2.1), so a save triggered by the clear event may lack the +100 and the last kills.
**Fix:** `roomState` for `cleared` carries `runXp` per player, and the client saves from that.

**29. minor, §12.1 / main.ts / worker.ts: where the seed is drawn.** Today the MP seed is drawn in `maybeGo()` (`worker.ts:229`) after everyone loaded, and never sent. The host's own main thread loads from `dungeonId` alone (`main.ts:80`, `:380`).
**Fix:** `Lobby.start()` draws `{seed, runId}`, `start` and the joiner's `start` (from `enterGame`) carry them, and the sim's own RNG seed stays a separate value. The worker can generate at `start` time while the clients load.

**30. minor, Appendix A: number slips.**
- A.3 step 7 says Jana has "5 200 XP" at the Confessional, but she missed a 500 XP room (Results: +6 200). She has 4 700 (still level 3).
- A.3 starts Tomas with "Frost ×1, Holy water ×1", but A.2 ended "inventory saved (empty: all used)", and A.3 uses A.2's 7 300 XP, so no run happened in between.
- A.2 step 5 has a thrown Venom flask landing "at his feet"; §7.3 says thrown items go along the aim.
- A.2 R3 is "≈ 90 Blessed + 12 Cherubs": Cherubs are 48 of 138 TP = 35%, above flyers' 15–30%.
- §6.7 "about 45 loot props per floor" is the *minimum* of §4.7 rule 8's range for A.1's rooms (44–88; midpoint ≈ 66).
- §14.3 says "at most 21 rooms"; `N ≤ 20` boss included.

**31. minor, §3.5 (design consequence): the Breach almost never has a view.** It has an outer face in 4.5% of floors, and 41% of all rooms have none (§1.5). The playtesters praised the views. The open sky stays, so this is about arcades only.
**Fix:** none needed for correctness. If wanted, let the Breach template carry painted sky windows (not openings), or allow open edges on faces whose cone is empty within 2 slots instead of the whole grid. Re-measure if so.

**32. minor, §5 / §4.3 / §12.4: smaller undefined terms.**
- The key's pickup radius ("touching"): say 1 m, as for items.
- Which `P` the trickle uses: see 20.
- Where the bot learns the first entrant's socket: see 5(c), `entrySocket`.
- The bot's display name with no profile: `name=` param, else `Bot <class>`.
- The 1 300-damage Judgment interrupt: does it scale with the new boss table or the old `bossMultiplier`? Say which in bosses.md.
- §4.9's "nothing at 80%" for non-combat loot props: give the remaining 20% split (e.g. coin 15, mote 5, no items).
- An illegal loadout falls back to the base kit (§9.8): say whether the carried inventory still enters the run (suggest: yes, if its items pass the item check on their own).

---

## Claims checked and found true

- Slot math (§3.1): interior `[36s + 4, 36s + 35]`, bands `[36k, 36k + 3]`, 256 total, crop formula, 2×1 = 68 m, alignment to 4.
- Sockets at 14–17 / 50–53, clockwise numbering for 1×1, 2×1 and 2×2.
- Leaves in the band, each owned by one room, satisfy the loader and the seal check (§1.7).
- §9.2's XP table (all nine values), A.2's XP and wallet arithmetic (except R11, finding 8), §6.7's 147 / 110 / 14 / 11 / 135.
- `mult(3.5)` = 0.9, boss ×0.905, aiming targets 7.
- Enemy types 7 ≤ 16, `eArena` sufficient, positions and the lightmap within limits.
- The director is reusable per room as is (`new Director(waves, cap, solo)`).
- Flow-field clamping is needed and enough: 1.8–2.5 ms whole-map vs 0.4 ms in the sealed 2×2.
- The lightmap, relief and arches need no changes beyond the `viewMask` (lightmap 125–165 ms on 13-room floors).
- Generation needs nothing non-deterministic: the repo's `mulberry32` plus floor and multiply are IEEE-exact in Node and browsers.
