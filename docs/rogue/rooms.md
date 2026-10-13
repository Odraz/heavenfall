# The Pearly Gates: rooms, enemies, hazard and props

**Purpose:** the room pool the floor generator draws from for the Pearly Gates, plus the heaven's new enemy, its hazard, its props and its fallback floor. Filled in by the content designer; the rules come from [game.md](game.md) §3–§4 and §6, which win over this file. All numbers are initial values.

**2026-10-13 pressure follow-up:** every stamped ordinary combat wave now adds one Dominion commander outside the authored TP mix, including the opening and crest. The grids/wave notation below remain the authored composition; explicit `elites` add to that commander. Existing party HP scaling, safe placement and two-alive cap apply. Candles/chalices now stand 1.1/1.0 m tall; candle player damage is 40 before defenses, while the chalice remains purely healing. Current economy and evidence are in [game.md](game.md) §6.1 and [r02-playtest-report.md](r02-playtest-report.md).

**Status:** complete authored pool; operational contracts revised 2026-10-11. Geometry measurements remain historical design data, not rerun tests. Contains: the notation (§2.1), 20 combat and 4 special templates with grids (§3–§4), the fallback floor (§5), the Dominion (§6), Refiner's Fire (§7), the props (§8), the checks (§9) and the playtest-in-head notes (§10).

---

## 1. Requirements (from game.md)

**The heaven's look** ([heavens.md](../heavens.md)): ivory, gold and sky blue at golden hour; marble; nice views. Every floor looks like this whatever its layout.

**Geometry (game.md §3.1, §3.4, §4.7)**
- Interiors: 1×1 **32 × 32 m**, 2×1 **68 × 32 m** (authored two slots wide; the generator rotates it for 1×2), 2×2 **68 × 68 m**. One cell = 1 m; floor heights 0–8.75 m in 0.25 m steps.
- **The base floor is at socket height 2.0 m** (height `8`). Obstacles are the cells above or below it (pits down to 0 m, terraces up to 8.75 m), so walls and zone tops start 2 m higher.
- **Sockets** on every slot edge: 4 cells at offsets **12–15** along the slot's edge (a 68-cell side has two: 12–15 and 48–51; aligned with the 4 m window/pilaster segments). Every template keeps **every** socket and its **threshold strip** (4 wide, 6 deep inward) flat at 2.0 m and free of walls, markers, hazards and props. Boss template: only its `entrySocket`. The entry cells (4 across the socket, 3 cells in) are used for seal teleports, respawns and Pilgrim's Return.
- Templates may be rotated and mirrored (up to 8 orientations; a 2×1 keeps its long axis) unless `fixedOrientation`; exclude orientations that obstruct the fixed physical strips (§2.2).
- No roofs; the sky is over every room. Views (arcades) form only on the floor's outer faces, decided by the generator (game.md §3.5); a template doesn't place views. **The Breach** may paint sky windows on its walls (a texture, no opening): it has an outer face in only 15% of floors.
- Enemies step up 0.5 m per cell and drop any height; players jump 1.0 m (no jump-only perches).
- A **1 m ledge redirects walking enemies toward its stair; it does not grant melee immunity**. The inherited Blessed strike reaches 1.2 m horizontally while feet differ by less than 1.5 m, so a Blessed below an edge can still hit a player standing at that edge. Hop farther inward or keep moving; the Dominion's longer 4.5 m ring can reach still farther onto a low dais. These are temporary route choices, never protected firing perches.

**Fights (game.md §4.4–§4.6, §4.11)**
- **Budgets** (TP at 4 players): 1×1 400, 2×1 700, **2×2 2 000** × band factor (band 1 0.85, 2 1.0, 3 1.15; a 2×2 is never band 1). TP: Blessed 1, Cherub 4, Chorister 6, the elite 60.
- **Waves:** 1×1 3, 2×1 4, 2×2 5. Default shares 0.25/0.35/0.40; 0.15/0.25/0.28/0.32; **2×2 0.07/0.08/0.10/0.15/0.60**. Wave 1 fodder only; the focus from wave 2.
- **The crest** (every 2×2's last wave): share ≥ 0.60, **Blessed only**, arrives in 6 s at up to 20 enemies per spawn point per second. At four players the base-kit encounter targets **≥ 1 000 alive** (1 200 Blessed at band 2). Design every 2×2 for that crowd: open floor, the crowd visible from a `high` spot, room to kite.
- **Target clear times:** 1×1 60–90 s, 2×1 90–120 s, 2×2 120–180 s, at any party size.
- **Focus** (game.md §4.5): horde (2×1, 2×2; Blessed ≥ 85%), ranged (Choristers 15–30%), flyers (Cherubs 15–30%), elite (1 per wave from wave 2, at most 2 alive, ≤ 40%), hazard (10–25% of the walkable floor). Secondary at half the range. Allowed pairs: horde + flyers, horde + hazard, horde + elite (2×2), ranged + hazard, flyers + hazard. Not ranged + flyers; not elite + hazard in the Pearly Gates. **2×2 templates are horde or hazard.**
- **Party scaling:** counts per type and wave scale with `mult(P)` and round up; **an elite's HP is multiplied by `n4 × mult(P) ÷ nP`** (solo: one elite at 40% HP where 4 players meet one at 100%). Room XP is the budget at any party size (game.md §9.1).
- **Obstacles have purposes:** `cover`, `kite`, `high`, `choke`, `jump`, `spawn`, `lure`. Every wall group and every floor group off socket height is tagged (exempt: walls that only close a non-combat room's floor in, and the boss's gate-side insets). Focus needs: horde ≥ 2 `kite`, ≥ 1 `choke`, ≥ 1 `high` with 2+ stairs; ranged ≥ 4 `cover`, ≥ 1 `high`; flyers ≤ 2 `cover`; elite ≥ 2 `kite`; hazard `lure` at hazard edges.
- **Spawn points:** at least **8 / 12 / 24 unrestricted** markers (1×1 / 2×1 / 2×2), each 6 m or more from every threshold strip. Additional existing markers may carry `spawnTags` permitting Choristers, Dominions, or both; those markers never count toward generic/crowd capacity. Waves place only on points farther than **10 m** (1×1) or **15 m** (2×1, 2×2) from every player, so spread them; a 2×2 needs at least 12 unrestricted points far from any one spot.
- **Reward spot:** one flat 4×4 area, no hazard, outside the strips. It holds the clear reward (nothing, a gold halo, an item or a Rite page), the key, the reliquary chest and, in bell rooms, the bell hanging 3 m above it (game.md §4.12). Keep 3 m of headroom.
- **Bells:** any 1×1 or 2×1 combat template can be a bell room; its Judgment wave uses the template's **last wave's `mix`** at 40% of the budget, plus 2 elites. So every 1×1/2×1 template's last-wave mix must read well with 2 elites added (also in hazard rooms).
- **Props per 1×1:** loot 4–8, blast 1–3, blessing 0–1 (×1.5 for 2×1, ×2 for 2×2), as `Σ chance` over each family's sockets; every combat template has at least one `loot` socket (the marked reliquary may land on the first).
- **Edicts** (game.md §2.5) touch rooms: the Edict of the Host adds 1 elite to every wave that has elites (up to 3 alive); the Edict of Swift Hymns makes Choristers' globes 30% faster. Templates must stay fair with both.

**Quantities (game.md §15.1)**
- **20 combat templates:** 1×1 ×12, 2×1 ×5, 2×2 ×3.
  - Focus coverage (a template counts for its focus and its secondary): horde ≥ 5, ranged ≥ 4, flyers ≥ 3, elite ≥ 3, hazard ≥ 3; at least 4 with a secondary.
  - 1×1 bands: at least 5 include band 1, 6 include band 2, 5 include band 3 (a floor has at most 4–5 1×1 rooms per band).
- **4 special templates:** the Breach, the Pardoner's stall, the Confessional, the Gate (boss, with [bosses.md](bosses.md)).
- **1 fallback floor** (§5).
- **Enemies:** Blessed, Choristers, Cherubs and **the Dominion elite**. No second new ordinary combat enemy is included in the slice.
- **1 hazard. 3 prop families + the marked reliquary + the bell.**

The existing Pearly Gates arenas (Courtyard of Clouds, the Cloudbridge, Cloister of Hymns, the Gate; MVP §8.3) are good first templates: re-cut them to the slot sizes.

## 2. The template format (game.md §4.7)

Templates are TS modules in `src/data/rooms/1/<id>.ts`. Template coordinates: `(0, 0)` is the top-left interior cell; rects are inclusive.

```ts
type Shape = '1x1' | '2x1' | '2x2';   // a 1×2 room uses a '2x1' template, rotated
type Focus = 'horde' | 'ranged' | 'flyers' | 'elite' | 'hazard' | 'ground';
type Purpose = 'cover' | 'kite' | 'high' | 'choke' | 'jump' | 'spawn' | 'lure';
interface Rect { x0: number; y0: number; x1: number; y1: number }

interface RoomTemplate {
  id: string;                    // 'pg-c-1x1-ranged-01'
  heaven: number;                // 1
  kind: 'combat' | 'breach' | 'pardoner' | 'confessional' | 'boss';
  shape: Shape;
  focus?: Focus;
  secondary?: Focus;
  bands: [number, number];
  weight: number;
  fixedOrientation?: boolean;
  spawnTags?: { at: [number, number]; only: ('chorister' | 'dominion')[] }[]; // restrictions on existing x points
  spawnAffinity?: Partial<Record<'chorister' | 'dominion', Rect[]>>; // existing x points preferred by that type
  entrySocket?: number;          // boss only
  heights: string[];             // '#' wall, '0'..'z' floor index; base floor '8'
  markers: string[];             // '.', 'x' spawn point, 'S' (breach, exactly 4), decor keys
  obstacles: { rect: Rect; purpose: Purpose; note?: string }[];
  hazards: { rect: Rect; hazard: string }[];
  props: { at: [number, number]; family: 'loot' | 'blast' | 'blessing'; chance: number }[];
  rewardSpot: [number, number];  // minimum cell x/y of the transformed flat 4×4 reward rectangle
  waves: { share: number; mix: Partial<Record<EnemyId, number>>; elites?: number }[];
  points?: { advocate?: [number, number]; pedestals?: [number, number][]; boss?: [number, number]; watchers?: [number, number][]; addSpawns?: { gate: [number, number][]; field: [number, number][] } };
  gate?: GateDef;                // boss only
}
```

The validation rules are game.md §4.7 (1–10); a template that fails any applicable rule must be rejected before it can enter the shipped pool. Ordinary wave, spawn-minimum and expected prop-count rules apply to `kind: 'combat'`; special kinds and the boss use their explicitly authored counts and encounter rules. Acceptance tests are future implementation work; none were run in this revision.

### 2.1 The block notation (how §3.1 and §4.1 write a template)

A 68 × 68 cell grid per room is too large to author by hand, so every template below is written on **2 m blocks**: a block is 2 × 2 cells. All room sizes are whole blocks (1×1 **16 × 16** blocks, 2×1 **34 × 16**, 2×2 **34 × 34**), the sockets fall on whole blocks (offsets 12–15 = blocks 6–7, offsets 48–51 = blocks 24–25) and every threshold strip is exactly 2 × 3 blocks. Block `(bx, by)` covers cells `x ∈ {2bx, 2bx+1}`, `y ∈ {2by, 2by+1}`; `(0, 0)` is the top-left (north-west) block. The expansion to the §2 `RoomTemplate` is mechanical; an implementing agent writes a small converter (`src/data/rooms/notation.ts`, used only to generate the modules or at import time) and the pool test validates its output.

Each template is one fenced block with the info string `room`:

```
id        pg-c-1x1-ranged-01          → RoomTemplate.id
name      The Choir Loft              → a comment / the room's display name
kind      combat                      → kind
shape     1x1                         → shape
focus     ranged                      → focus (combat only)
secondary hazard                      → secondary (optional)
bands     1 2                         → bands
weight    1                           → weight
entry     3                           → entrySocket (boss only)
grid                                  → then one line per block row: "<row> <heights> <features>"
 0 22222.::...22222 x..x........x..x
 ...
obstacles                             → then one line per obstacle: "  <purpose> <bx0>,<by0> <bx1>,<by1> <note>"
  high 0,0 4,5 west loft and its stair
props     loot 0.85 blast 0.75 blessing 0.5   → chance of every socket of that family
waves                                 → then one line per wave: "  <n> <share> <type> <fraction> ... [elites <k>]"
  1 0.25 blessed 1
walls     0,0 3,8                     → optional cell-level wall rects (cells, inclusive); only the boss's gate-side insets use it
```

**Heights layer** (one character per block; every cell of the block gets the same value unless it's a stair):

| Glyph | Floor | Height index | Use |
|---|---|---|---|
| `#` | wall | `#` | pillar, wall stub, fill (full height, computed by M10 §3.2) |
| `.` | 2.0 m | `8` | base floor (socket height) |
| `:` | 2.0 m | `8` | base floor inside a threshold strip; **exactly** the strip blocks of the shape carry `:` (boss: only the entry strip), so a strip error is visible in the grid |
| `~` | 1.5 m | `6` | a **Refiner's Fire** channel (§7): sunk 0.5 m, and every cell of the block is in the hazard layer |
| `-` | 1.0 m | `4` | a basin 1 m deep (players hop out anywhere; enemies only by stairs) |
| `=` | 0.0 m | `0` | a well 2 m deep (stairs only) |
| `1` `2` `3` `4` | 3.0 / 4.0 / 5.0 / 6.0 m | `c` / `g` / `k` / `o` | ledges and terraces 1–4 m above the base floor |
| `B` | 3.5 m | `e` | a **plinth or low wall** 1.5 m tall that nobody can climb (players reach 1.0 m); statues and fountains stand on it. Never next to `1` (a 0.5 m step would make it reachable) |
| `>` `<` `^` `v` | stair | — | a stair rising toward east / west / north / south |

**Stairs, exactly:** a *run* is a maximal line of blocks with the same stair glyph along its direction (a row for `>` `<`, a column for `^` `v`), one block wide across; each block row (or column) across a wider stair is its own run. The block just before the run (against the arrow) is its **low end**, the block just after it (along the arrow) its **high end**; both must be level glyphs (not `#` or a stair), with `A` = the low end's floor < `B` = the high end's floor. The run's cells along the arrow are numbered `i = 1 … k` (`k` = 2 × the run's length in blocks) from the low end, and **cell `i` is at `min(A + 0.5·i, B)`** (both cells across a block get the same value). So every step is 0.5 m (the last may be smaller), a run of `n` blocks climbs at most `n + 0.5` m, and the converter rejects a run with `B − A > 0.5 (k + 1)`. Examples: one block `^` from `.` to `1` gives cells 2.5, 3.0; two blocks from `.` to `2` give 2.5, 3.0, 3.5, 4.0; three blocks from `=` to `.` give 0.5 … 2.0 (the last cell 2.0).

**Features layer** (one character per block; a point feature sits on the block's **top-left cell** `(2bx, 2by)`):

| Glyph | Becomes |
|---|---|
| `.` | nothing |
| `x` | spawn point: `markers` `'x'` |
| `o` / `!` / `+` | a prop socket: `props.push({ at: [2bx, 2by], family: 'loot' / 'blast' / 'blessing', chance })` with the family's chance from the `props` line, in **row-major block order** (so the first `o` is the marked reliquary's socket, §3.3 step 13) |
| `R` | the reward spot: exactly four `R` in a 2 × 2 square; `rewardSpot` = the top-left cell of the square's top-left block (a 4 × 4-cell area) |
| `c` `u` `h` `t` `a` `f` | decor markers (`candelabrum`, `lily-urn`, `harp`, `cloud-tuft`, `angel-statue`, `fountain`; the decor table is the heaven's); `a` and `f` only on `B` blocks |
| `S` | Breach only: a player spawn cell (exactly 4) |
| `P` | Pardoner only: an item pedestal (exactly 4); append in canonical row-major order to `points.pedestals` |
| `M` | Pardoner only: exactly 1 map pedestal; append after the four `P` points as `points.pedestals[4]` |
| `A` | Confessional only: `points.advocate` |
| `K` | Boss only: `points.boss` and the `B` marker (the Gatekeeper's cell) |
| `w` | Boss only: append the point to `points.watchers` in canonical row-major order (12 for the Gate) |

**Other fields:**
- `obstacles`: each line becomes `{ rect: { x0: 2·bx0, y0: 2·by0, x1: 2·bx1 + 1, y1: 2·by1 + 1 }, purpose, note }` (block rects, inclusive, turned into cell rects).
- `hazards`: one `{ rect, hazard: 'refiners-fire' }` per maximal horizontal run of `~` blocks in a block row (2 cells tall). Nothing else writes the hazard layer.
- `props`: as the features layer above.
- `waves`: each line becomes `{ share, mix: { blessed, chorister, cherub }, elites }`; the elite's id is `dominion` (§6). Counts follow game.md §4.6 (`round(rest × mix ÷ TP)`, at least 1).
- `markers`: write x for enemy spawns, S for Breach starts, B for the K boss point, and the named decor keys in their engine format. All other features (props, reward square, P/M pedestals, A Advocate, w Watcher anchors) remain `.` in the marker grid; their semantic points live in the explicit arrays.
- `heaven: 1` always; `fixedOrientation` is never set in this pool. Omitted arrays default to `[]`, omitted prop-family chances to 0, and omitted optional `focus`, `secondary` and `points` fields remain undefined. Non-combat and boss templates omit `bands`; expand those to `[1, 3]` for schema completeness but never apply a combat band filter to them. Combat templates require their explicit band range.
- `spawnAffinity`: attach §2.3's declared rectangles to its five named ranged templates before transformation; omitted on other templates. Each affinity rectangle selects existing `x` markers only and uses the same inclusive-cell transform as an obstacle rectangle.
- `spawnTags`: optional canonical cell-coordinate annotations of existing `x` points, transformed alongside their stable marker IDs. Each `only` array is nonempty, duplicate-free and contains only `chorister` and/or `dominion`; one point has at most one tag. A tag restricts eligibility, while an affinity merely prefers an already eligible point. This pool currently authors no restricted points: every listed marker is unrestricted. Future extra marked choir/elite points must retain the ordinary unrestricted minimum and crest geometry.
- Boss only: partition the canonical `x` points into `points.addSpawns.gate` (cell x ≤5) and `points.addSpawns.field` (the other points) before transformation. Transform and stamp those arrays and `points.watchers` alongside geometry. These partitions never use world-coordinate x after rotation.

**The checks the pool test runs on the expanded template** (game.md §4.7 rules 1–10, plus this file's): canonical notation strips exactly `:`, physically clear; after transformation, recompute physical strips by fixed socket offsets and reject blocked orientations rather than geometrically treating the old `:` cells as new doors (a purpose rectangle may span a flat approach/strip without creating geometry there). Enemy reach equals player reach from the physical strips (no jump-only perches; `B` unreachable); ordinary combat has ≥ 8 / 12 / 24 unrestricted `x`, each ≥ 6 m (cell centers) from every physical strip cell and enemy-reachable, while the special/boss exceptions follow game.md §4.7 rule 4; every wall group and every floor group off 2.0 m (stairs, channels, basins, ledges, plinths) inside some obstacle rect; hazard share = `~` cells ÷ player-reachable floor cells; the reward square flat, dry and outside the strips; ordinary combat waves' composition at band 2 and props' `Σ chance` per family; the focus geometry (counts of purposes); each affinity rectangle contains a suitable existing spawn marker; large decor on unreachable cells. Strip/spawn/reward/prop checks all use actual fixed strips in each allowed orientation. Fixture versus full-floor checks follow game.md §4.7 rule 9, including the Breach's own four starts and the static boss-dais exemption. §9 preserves the previous revision's reported measurements. They were not rerun in this revision; the current checks below are implementation acceptance criteria.

**Spawn typing acceptance:** check each tag against its canonical existing `x` marker and preserve its restriction after every allowed transform. Count the 8 / 12 / 24 minimum and the 2×2 distant-marker capacity using **unrestricted** markers only. Affinity accepts only Chorister/Dominion keys, and each preferred region must contain a type-eligible marker. An invalid tag, a tag on an absent point, or a restricted point used for fodder is a content error; safe placement may use an untagged legal floor fallback, never erase the tag.

### 2.2 Generation and encounter contracts

These rules make the authored pool executable without guessing at edge cases; game.md remains authoritative for shared lifecycle and budgets.

1. **Stable identities and transforms.** Expand the block notation once in canonical orientation, assign stable indices to socket/prop/spawn/Watcher arrays, then geometrically transform all authored cell positions, inclusive rects (including spawn affinity), boss points and gate facing. Rotation transforms the full 68-cell interior, including its 4-cell inter-slot band; it never rotates each slot separately. Mirrors likewise operate on the expanded interior. **Socket identity transforms by side and footprint slot**, as game.md §3.4 defines; the physical socket offsets remain 12–15 / 48–51. A raw geometric flip maps 12–15 to 16–19, so the moved authored threshold is not the stamped doorway. Validate the fixed physical strips after transformation and exclude any orientation whose walls, off-base floor, markers, hazards or props obstruct them; never overwrite that content to carve a door. Non-boss templates retain every potential fixed strip; a boss retains only the logically mapped entry strip. Retain canonical prop order for selecting the marked amphora; do not select a different prop by re-sorting transformed coordinates. Draw only from the valid shape-compatible orientations; boss selection also matches its sole door and outward gate face. Each template's identity remains valid by its authored strips, and the fallback's Processional 90° has clear fixed strips (§5).
   **The reward anchor represents a rectangle, not an ordinary point.** Expand canonical `rewardSpot=(rx,ry)` into the inclusive occupied-cell rect `(rx,ry)–(rx+3,ry+3)`, transform all four corners with the integer cell formulas, and set the transformed `rewardSpot` to that rect's minimum x/y. Then validate that actual 4×4 rect and derive its continuous center `(rewardSpot.x+2,rewardSpot.y+2)`, adding the stamped room origin afterward. Directly transforming only the old top-left puts the new square three cells past a mirrored/rotated edge. For example the 68 m Gate's `(32,32)–(35,35)` mirrors to the same rect with center `(34,34)`; its old top-left alone becomes `(35,32)` and is not the new anchor. Derived Bell/Stair placements use the actual transformed square. Canonical pedestal offsets/identities still transform as their own cell points; do not recreate another player's stock by re-sorting them.
   **Gate coordinates are an exception to integer cell transforms.** `GateDef` describes a continuous wall plane and row lines, not occupied cell indices: expand its canonical endpoints `(0,8)`, `(0,60)` and center `(0,34)`, then mirror with `(W−x,y)` and rotate clockwise with `(H−y,x)`. Reconstruct its facing/plane and transverse half-open extent from those transformed points, and translate by the stamped room origin. Keep the integer `(W−1−x)` / `(H−1−y,x)` formulas for cell markers/rectangles. Thus a mirrored east-facing gate lies on local plane x=68, with center line y=34 and transverse extent `[8,60)`, never x=67/y=33. Transform the gate normal, terrain-skip region and decorative ray hitboxes with that same plane; sample its floor height from the adjacent **interior** cell, not from an E/S wall-plane index. The base floor there is 2 m. Cell insets still use the integer transform.
2. **Template exhaustion.** Shape and unique template IDs are hard constraints. Try unused templates in the actual band first; if that pool is empty, drop the band filter as game.md §3.3 permits while retaining the room's actual TP/difficulty band. If no unused template of that shape remains, reject the attempt. Never repeat a favorite or retune its budget to the fallback template's preferred band. The fixed fallback uses its explicit IDs and orientation table. A failed fallback validation is a content/load failure with a diagnostic, never an endless retry or a partially traversable run. Special rooms do not consume combat IDs.
3. **Composition and Edicts.** Build the base enemy counts from band-adjusted TP and waves, then add Host Edict's one Dominion to each elite-containing wave as **60 extra TP outside the base budget**, before party scaling. Never subtract it from fodder, add it to a fodder-only wave or add it to a crest. For a Bell, ignore the last wave's `elites` field: use only that wave's `mix` for 40% of the room budget, plus exactly two external Dominions (three under Host). This avoids adding the original elite twice. The normal alive Dominion cap is two, three under Host; excess queued Dominions still belong to their wave and must spawn before that wave is considered finished. Special-wave focus composition limits do not apply to Bell waves.
4. **Safe arrivals and scope of the crest.** Apply the core distance filters to all living players together, then its warning/placement fallback; checking a single worst spot is not evidence that a spread party leaves enough points. Never place inside a body, closed leaf, prop collision cylinder or unreachable cell. Pending counts remain pending until safely placed. A warning/grace rule may extend the nominal six-second crest delivery under a spread party or capacity pressure. The ≥1,000 simultaneous Blessed peak is a **base-kit reference target for four humans**, not a guarantee against arbitrary damage builds, hazard lures or every possible party formation. Players keep their earned crowd-clearing strength. Never silently add enemies, suppress their damage or grant invulnerability merely to force the counter above 1,000. Telemetry must distinguish intended total, delivered total, peak alive and arrival duration.
5. **Crest readability.** Announce the final wave with a distinctive directional choir swell and the room's normal visible spawn rays. Prior-wave specials keep their types but no new special enters the crest. On Refiner's Court, prefer dry corridor-mouth markers for crest placement; at most one quarter of authored points sit behind the fire. Player luring may still thin the crest: that is the room's reward for good positioning. The three big-room layouts provide a terrace/stair fight, a gatehouse/standards fight and a corridor/fire fight, rather than three differently decorated circular kites.
6. **Hazard navigation.** For Blessed, Choristers and Dominions compute a dry route whenever one exists; a pulled or airborne enemy landing in fire first exits by the shortest valid ground route, then resumes hazard avoidance. If the target stands on fire, path toward the reachable dry cell nearest that target (ties: row-major cell order within the stamped room), while aiming attacks and measuring range against the actual player. A dry chase anchor is a reachable target for recovery; merely refusing to stand in fire does not trigger relocation. An avoider already in fire may traverse hazard cells on its shortest escape route; the normal step refusal applies again on reaching dry ground. Hazards cannot partition reachable ground into disconnected dry islands. The extra cost is **at most four room-clamped dry ground fields**, one per occupied living-player target slot, created only while an avoiding enemy lives in a room with active hazard cells, alongside ordinary ground/air fields. Reuse the existing field-rebuild cadence and cached ground-to-dry escape routing; never run a full-map flood or an A* search per avoider. Discard these fields when their activation condition ends; a Bell may recreate them. Evaluate fire damage only while feet touch an active hazard cell; jumping over it and hovering Cherubs take none. Returning or ringing a Bell never revives broken loot props or restarts lamp/chalice recharge timers or resets the original encounter's consumed halo/mote/item entitlements. The Bell has its own single size-capped mote encounter and eligible elite item rolls under game.md §6.2; it never creates another normal halo budget. A new run creates fresh room state. Hazards activate anew only after that room reseals for its Bell.
7. **Bell lifecycle.** Poverty shortens coin/gold world pickup expiry to 10 s, including prop/elite drops; it changes no reward budget or XP. A ring request is accepted only from a living human near the bell during a valley **before boss victory**; duplicate requests are idempotent. Mark `pending` during its countdown. Canceling the countdown restores `available` and the cleared room; it consumes no reward or wave and may be rung again. Consume and remove the bell at the **seal**, then run exactly one Judgment wave. A wipe ends the run; a disconnect does not create another Bell. Clear once, respawn souls, give the individual Rite offers once, and preserve any original clear reward or chest not yet claimed. Enemy kills award their fixed per-wave XP ledger but no second normal halo budget; Bell elites do not bypass that rule with their usual gold-halo drop. Victory disables every remaining bell and rejects new countdowns or encounters; only already-earned sources, shopping and unbroken props remain available during the Stair valley.
8. **Cleanup and progress.** Finish requires no pending arrivals and no counted living enemies; decorations and boss parts never block a combat clear. If an enemy is unreachable or wedged, apply the core bounded recovery, including pending arrivals, rather than waiting for the last wave forever. Recovery relocation preserves HP, credit and seed sequence; final anti-softlock removal settles only the entity's unused room XP ledger once, with no kill/proc/streak/drop reward. A cleanup burst is never a new kill. Rite/relic/bargain/Advocate transactions may commit during a valley or countdown under the core's existing alive/range/room checks and bounded holds; close overlays and reject later commits at the actual seal, retaining their offers. This does not permit Bell/teleport acceptance during countdown. Teleport souls to the same dry entry cells as the party, and preserve per-room clear/reward flags across returns. Boss cleanup is governed by bosses.md §3.8, independent of room-wave completion.

**Replayability limit.** Twenty layouts and rotations provide a complete slice, not unlimited authored content. The slice's replayability comes from route/reward previews, different legal templates, Rites and relic/state interactions, optional Bells, the Advocate's price and selected Edicts. Do not inflate enemy HP every run or randomize the hazard's rule to disguise repetition. Future pool additions must offer a new spatial decision and retain the same telegraph language. Fight-duration and fun targets remain human playtest criteria.

### 2.3 Authored spawn affinity

The following optional `spawnAffinity.chorister` rectangles are **canonical cell coordinates, inclusive**; expansion attaches them to the corresponding template and transforms them with its geometry. They select existing `x` markers, create no new marker or enemy count, and every rectangle contains at least one authored ground-reachable dry spawn. This data makes the ranged layouts' choir side and cover decision executable.

| Template | `chorister` preference rectangles | Intended pressure |
|---|---|---|
| `pg-c-1x1-ranged-01` | `(0,0)–(9,7)`, `(22,0)–(31,7)` | The two raised Choir Lofts. |
| `pg-c-1x1-ranged-02` | `(0,0)–(7,7)`, `(24,0)–(31,7)`, `(0,24)–(7,31)`, `(24,24)–(31,31)` | The Colonnade's four corner balconies. |
| `pg-c-1x1-ranged-03` | `(0,20)–(31,31)` | South of the Rood Screen, firing through its gaps. |
| `pg-c-1x1-ranged-hazard-01` | `(22,24)–(31,31)` | The Burning Aisle's south-east choir terrace. |
| `pg-c-2x1-ranged-01` | `(0,0)–(9,9)`, `(58,0)–(67,9)`, `(0,18)–(9,31)`, `(58,18)–(67,31)` | The Cloister's four end galleries. |

For each queued Chorister, first apply `spawnTags` type eligibility, then the shared safety/reach/cap filters to the union of matching points; choose uniformly among eligible preferred points using simulation RNG. If none is currently eligible, immediately try the other type-eligible ordinary markers and then the core warned-floor fallback; a blocked preferred perch never stalls the wave. Untagged markers remain available to every ordinary enemy type; a tagged point cannot be borrowed by a Blessed or Cherub, including a crest, Bell mix or trickle. The same ordering applies to any future Dominion affinity. A warned floor fallback uses an untagged legal floor cell and creates no new persistent authored marker. Camping a loft can therefore force the choir onto the floor, rather than producing an invulnerable wave or enemies inside the camping player. Bell mix spawns reuse this affinity; their added Dominions use type-eligible ordinary-marker rules. Boss gate/field marker groups retain their separately authored encounter placement rules. This is a placement preference, never a change to counts, HP, rewards or required reach.

## 3. Combat templates

One row per template (the design); the grids below are the authored specification. Implementation expands them into TS modules.

| id | Shape | Focus | Secondary | Bands | Weight | Layout idea (one line) | Obstacles (purpose × count) | Spawn points | Props (loot / blast / blessing) | Hazard cells | Waves (shares; mix per wave) | Last wave + 2 elites (bell) reads? | Notes |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `pg-c-1x1-ranged-01` The Choir Loft | 1x1 | ranged | — | 1–2 | 1 | Two 2 m lofts flank one wall; four nave pillars hide the floor from them: pillar to pillar, then storm a loft. | high × 2, cover × 4 | 8 | 6 × 0.85 = 5.1 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 0 | 0.25: Ble 1; 0.35: Ble 0.7 Cho 0.3; 0.4: Ble 0.7 Cho 0.3 (band 2 counts: 100 · 98/7 · 112/8; room TP blessed 78%, chorister 22%) | yes: Choristers fire from the far side while two Dominions walk in through the cover; the pillars that hide you from the hymns are the posts you loop the Dominions round | Fallback R4 (key room). |
| `pg-c-1x1-ranged-02` The Colonnade | 1x1 | ranged | — | 2–3 | 1 | Five-pillar hall with a 1 m balcony in every corner: dance between pillars, hop up the balconies one by one. | high × 4, jump × 2, cover × 5 | 8 | 6 × 0.8 = 4.8 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 0 | 0.25: Ble 1; 0.35: Ble 0.75 Cho 0.25; 0.4: Ble 0.7 Cho 0.3 (band 2 counts: 100 · 105/6 · 112/8; room TP blessed 79%, chorister 21%) | yes: Choristers fire from the far side while two Dominions walk in through the cover; the pillars that hide you from the hymns are the posts you loop the Dominions round |  |
| `pg-c-1x1-ranged-03` The Rood Screen | 1x1 | ranged | — | 2–3 | 1 | A rood screen halves the room; the choir fires and the crowd pours only through its gaps; a 2 m pulpit watches both. | cover × 5, choke × 1, high × 1 | 8 | 6 × 0.85 = 5.1 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 0 | 0.25: Ble 1; 0.35: Ble 0.7 Cho 0.3; 0.4: Ble 0.7 Cho 0.3 (band 2 counts: 100 · 98/7 · 112/8; room TP blessed 78%, chorister 22%) | yes: Choristers fire from the far side while two Dominions walk in through the cover; the pillars that hide you from the hymns are the posts you loop the Dominions round |  |
| `pg-c-1x1-ranged-hazard-01` The Burning Aisle | 1x1 | ranged | hazard | 2–3 | 1 | A 4 m fire channel with two dry bridges: the fire stops the crowd, not the hymns from the 2 m terrace beyond it. | lure × 3, choke × 2, high × 1, cover × 5 | 8 | 6 × 0.85 = 5.1 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 96 (9.9%) | 0.25: Ble 1; 0.35: Ble 0.7 Cho 0.3; 0.4: Ble 0.7 Cho 0.3 (band 2 counts: 100 · 98/7 · 112/8; room TP blessed 78%, chorister 22%) | yes: Choristers fire from the far side while two Dominions walk in through the cover; the pillars that hide you from the hymns are the posts you loop the Dominions round | Fallback R8 (Reliquary). |
| `pg-c-1x1-flyers-01` The Open Terrace | 1x1 | flyers | — | 1–2 | 1 | Open sky terrace, no tall cover: low hedges the crowd walks round while the Cherubs fly over; a 1 m dais to shoot up from. | kite × 4, high × 1, jump × 1 | 8 | 6 × 0.8 = 4.8 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 0 | 0.25: Ble 1; 0.35: Ble 0.75 Cbr 0.25; 0.4: Ble 0.7 Cbr 0.3 (band 2 counts: 100 · 105/9 · 112/12; room TP blessed 79%, cherub 21%) | yes: Cherubs above, two Dominions on the ground; the low walls block neither, so it's pure movement | Fallback R1. |
| `pg-c-1x1-flyers-02` The Sunken Well | 1x1 | flyers | — | 2–3 | 1 | A 2 m well in the middle: over it the Cherubs fly at the rim's eye level; the crowd drops in and climbs out by four stairs at your feet. | kite × 1 | 8 | 6 × 0.8 = 4.8 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 0 | 0.25: Ble 1; 0.35: Ble 0.75 Cbr 0.25; 0.4: Ble 0.7 Cbr 0.3 (band 2 counts: 100 · 105/9 · 112/12; room TP blessed 79%, cherub 21%) | yes: Cherubs above, two Dominions on the ground; the low walls block neither, so it's pure movement |  |
| `pg-c-1x1-flyers-03` The Ziggurat | 1x1 | flyers | — | 1–3 | 1 | A two-tier ziggurat with pinwheel stairs: king of the hill, the summit sees everything and draws every Cherub. | high × 1, jump × 1 | 8 | 6 × 0.8 = 4.8 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 0 | 0.25: Ble 1; 0.35: Ble 0.75 Cbr 0.25; 0.4: Ble 0.7 Cbr 0.3 (band 2 counts: 100 · 105/9 · 112/12; room TP blessed 79%, cherub 21%) | yes: Cherubs above, two Dominions on the ground; the low walls block neither, so it's pure movement |  |
| `pg-c-1x1-hazard-flyers-01` The Refining Moat | 1x1 | hazard | flyers | 1–2 | 1 | An 8 m island in a 4 m fire moat with four bridges: safe from the crowd, not from the sky. | lure × 5, choke × 2 | 8 | 6 × 0.8 = 4.8 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 128 (12.7%) | 0.25: Ble 1; 0.35: Ble 0.85 Cbr 0.15; 0.4: Ble 0.85 Cbr 0.15 (band 2 counts: 100 · 119/5 · 136/6; room TP blessed 89%, cherub 11%) | yes: the Dominions avoid the fire, the crowd walks into it; lure the crowd across while the Dominions take the bridges (allowed in a bell wave, game.md §4.12) | Cherubs 11%. |
| `pg-c-1x1-elite-01` The Two Lampstands | 1x1 | elite | — | 2–3 | 1 | Two tall pylons in an open hall: a figure-of-eight to loop each Dominion into the crowd behind you. | kite × 2 | 8 | 6 × 0.8 = 4.8 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 0 | 0.25: Ble 1; 0.35: Ble 1 + 1 el; 0.4: Ble 1 + 1 el (band 2 counts: 100 · 80/1 · 100/1; room TP blessed 70%, dominion 30%) | yes: its waves already hold one Dominion; two at once with a crowd is the kite loops' full use | Fallback R6 (bell). |
| `pg-c-1x1-elite-02` The Fountain Court | 1x1 | elite | — | 1–3 | 1 | A see-over fountain plinth and four corner pillars: one tight loop, four wide ones, the mace always in view. | kite × 5 | 8 | 6 × 0.8 = 4.8 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 0 | 0.25: Ble 1; 0.35: Ble 1 + 1 el; 0.4: Ble 1 + 1 el (band 2 counts: 100 · 80/1 · 100/1; room TP blessed 70%, dominion 30%) | yes: its waves already hold one Dominion; two at once with a crowd is the kite loops' full use |  |
| `pg-c-1x1-hazard-01` The Gridiron | 1x1 | hazard | — | 1–3 | 1 | Two 2 m fire lines with one bridge each cut the room in three bands: hold the middle, the crowd crosses fire. | lure × 4, kite × 2 | 8 | 6 × 0.8 = 4.8 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 112 (11.2%) | 0.25: Ble 1; 0.35: Ble 1; 0.4: Ble 1 (band 2 counts: 100 · 140 · 160; room TP blessed 100%) | yes: the Dominions avoid the fire, the crowd walks into it; lure the crowd across while the Dominions take the bridges (allowed in a bell wave, game.md §4.12) |  |
| `pg-c-1x1-hazard-02` The Kilns | 1x1 | hazard | — | 2–3 | 1 | Four corner kilns: spawn points behind Ls of fire with a dry gap; where you stand decides who burns. | lure × 4, spawn × 1, high × 1 | 8 | 6 × 0.8 = 4.8 / 2 × 0.75 = 1.5 / 1 × 0.5 = 0.5 | 112 (10.9%) | 0.25: Ble 1; 0.35: Ble 1; 0.4: Ble 1 (band 2 counts: 100 · 140 · 160; room TP blessed 100%) | yes: the Dominions avoid the fire, the crowd walks into it; lure the crowd across while the Dominions take the bridges (allowed in a bell wave, game.md §4.12) | Fallback R7 (map reliquary). |
| `pg-c-2x1-horde-01` The Cloudbridge | 2x1 | horde | — | 1–3 | 1 | Arena 2 re-cut: a 1 m basin split by two bridges; hop in and out, the crowd only by stairs; bridges are chokes. | kite × 3, jump × 2, choke × 2, high × 2 | 13 | 8 × 1 = 8.0 / 3 × 0.8 = 2.4 / 1 × 0.5 = 0.5 | 0 | 0.15: Ble 1; 0.25: Ble 1; 0.28: Ble 1; 0.32: Ble 1 (band 2 counts: 105 · 175 · 196 · 224; room TP blessed 100%) | yes: a pure Blessed mass and two Dominions: bait both maces into it |  |
| `pg-c-2x1-horde-hazard-01` The Processional | 2x1 | horde | hazard | 1–3 | 1 | A nave between two aisles walled off by fire lines; bridges at the doors; a 2 m bier sees both aisles. | lure × 2, choke × 2, high × 1, kite × 2 | 14 | 8 × 1 = 8.0 / 3 × 0.8 = 2.4 / 1 × 0.5 = 0.5 | 208 (9.7%) | 0.15: Ble 1; 0.25: Ble 1; 0.28: Ble 1; 0.32: Ble 1 (band 2 counts: 105 · 175 · 196 · 224; room TP blessed 100%) | yes: a pure Blessed mass and two Dominions: bait both maces into it | Fallback R2 (1×2, bell). |
| `pg-c-2x1-ranged-01` The Cloister of Hymns | 2x1 | ranged | — | 2–3 | 1 | Arena 3 re-cut: four 2 m end galleries and eight nave pillars: take one end's galleries, then hold them. | high × 4, cover × 8 | 14 | 7 × 1 = 7.0 / 3 × 0.8 = 2.4 / 1 × 0.5 = 0.5 | 0 | 0.15: Ble 1; 0.25: Ble 0.75 Cho 0.25; 0.28: Ble 0.75 Cho 0.25; 0.32: Ble 0.7 Cho 0.3 (band 2 counts: 105 · 131/7 · 147/8 · 157/11; room TP blessed 78%, chorister 22%) | yes: Choristers fire from the far side while two Dominions walk in through the cover; the pillars that hide you from the hymns are the posts you loop the Dominions round |  |
| `pg-c-2x1-flyers-01` The Skywalk | 2x1 | flyers | — | 1–3 | 1 | A 2 m skywalk the length of the room over an open floor: see the crowd, face the sky, leave before it climbs. | high × 1, kite × 4 | 14 | 8 × 1 = 8.0 / 3 × 0.8 = 2.4 / 1 × 0.5 = 0.5 | 0 | 0.15: Ble 1; 0.25: Ble 0.75 Cbr 0.25; 0.28: Ble 0.75 Cbr 0.25; 0.32: Ble 0.7 Cbr 0.3 (band 2 counts: 105 · 131/11 · 147/12 · 157/17; room TP blessed 77%, cherub 23%) | yes: Cherubs above, two Dominions on the ground; the low walls block neither, so it's pure movement |  |
| `pg-c-2x1-elite-01` The Hall of Dominions | 2x1 | elite | — | 2–3 | 1 | Pylon, fountain, pylon in a row and two 1 m corner daises: slalom two Dominions through the posts. | kite × 3, jump × 2 | 14 | 8 × 1 = 8.0 / 3 × 0.8 = 2.4 / 1 × 0.5 = 0.5 | 0 | 0.15: Ble 1; 0.25: Ble 1 + 1 el; 0.28: Ble 1 + 1 el; 0.32: Ble 1 + 1 el (band 2 counts: 105 · 115/1 · 136/1 · 164/1; room TP blessed 74%, dominion 26%) | yes: its waves already hold one Dominion; two at once with a crowd is the kite loops' full use |  |
| `pg-c-2x2-horde-flyers-01` Courtyard of Clouds | 2x2 | horde | flyers | 2–3 | 1 | Arena 1 re-cut: a 16 m terrace with four stairs behind hedge gaps, four piers, a corner ledge; the crest from all walls. | high × 2, choke × 4, kite × 4, jump × 1 | 24 | 14 × 0.8 = 11.2 / 4 × 0.75 = 3.0 / 2 × 0.5 = 1.0 | 0 | 0.07: Ble 1; 0.08: Ble 0.75 Cbr 0.25; 0.1: Ble 0.75 Cbr 0.25; 0.15: Ble 0.75 Cbr 0.25; 0.6: Ble 1 (band 2 counts: 140 · 120/10 · 150/12 · 225/19 · 1200; room TP blessed 92%, cherub 8%) | — (never a bell room) | Fallback R3. |
| `pg-c-2x2-horde-elite-01` The Field of the Host | 2x2 | horde | elite | 2–3 | 1 | A parade ground: four gatehouses pour the crowd out, eight standards ring the middle, two reviewing towers. | choke × 4, spawn × 4, kite × 8, high × 2 | 28 | 14 × 0.8 = 11.2 / 4 × 0.75 = 3.0 / 2 × 0.5 = 1.0 | 0 | 0.07: Ble 1; 0.08: Ble 1 + 1 el; 0.1: Ble 1 + 1 el; 0.15: Ble 1 + 1 el; 0.6: Ble 1 (band 2 counts: 140 · 100/1 · 140/1 · 240/1 · 1200; room TP blessed 91%, dominion 9%) | — (never a bell room) |  |
| `pg-c-2x2-hazard-horde-01` The Refiner's Court | 2x2 | hazard | horde | 2–3 | 1 | Four fire Ls guard the corners, four dry corridors meet at a 2 m dais; the crest takes the corridors or burns. | lure × 4, kite × 4, choke × 2, high × 1 | 28 | 14 × 0.8 = 11.2 / 4 × 0.75 = 3.0 / 2 × 0.5 = 1.0 | 576 (12.6%) | 0.07: Ble 1; 0.08: Ble 1; 0.1: Ble 1; 0.15: Ble 1; 0.6: Ble 1 (band 2 counts: 140 · 160 · 200 · 300 · 1200; room TP blessed 100%) | — (never a bell room) |  |

*Columns:* props are `sockets × chance = Σ chance` per family (game.md §4.7 rule 8: 1×1 4–8 / 1–3 / 0–1, 2×1 6–12 / 1–4 / 0–1, 2×2 8–16 / 2–6 / 0–2); hazard cells are cells of Refiner's Fire and their share of the player-reachable floor; waves list `share: type fraction` (Ble Blessed, Cho Chorister, Cbr Cherub, `+ 1 el` one Dominion at 4 players) and the **band-2 counts at 4 players** (Blessed/Choristers or Cherubs/Dominions per wave). Counts and geometry columns are the previous designer's reported baseline values, reviewed as spec data here; they are not newly measured gameplay results.

**Coverage** (game.md §15.1; a template counts for its focus and its secondary):

| | Required | This pool |
|---|---|---|
| Shapes | 1×1 ×12, 2×1 ×5, 2×2 ×3 | 12 / 5 / 3 |
| horde | ≥ 5 | 5: Cloudbridge, Processional, Courtyard of Clouds, Field of the Host, Refiner's Court (secondary) |
| ranged | ≥ 4 | 5: Choir Loft, Colonnade, Rood Screen, Burning Aisle, Cloister of Hymns |
| flyers | ≥ 3 | 6: Open Terrace, Sunken Well, Ziggurat, Skywalk, Refining Moat (secondary), Courtyard of Clouds (secondary) |
| elite | ≥ 3 | 4: Two Lampstands, Fountain Court, Hall of Dominions, Field of the Host (secondary) |
| hazard | ≥ 3 | 6: Gridiron, Kilns, Refining Moat, Refiner's Court, Burning Aisle (secondary), Processional (secondary) |
| with a secondary | ≥ 4 | 6 (pairs: ranged + hazard, hazard + flyers, horde + hazard, horde + flyers, horde + elite, hazard + horde) |
| 1×1 band 1 / 2 / 3 | ≥ 5 / ≥ 6 / ≥ 5 | 6 / 12 / 9 |
| 2×1 band 1 / 2 / 3 | (a floor has at most 2) | 3 / 5 / 5 |
| 2×2 band 2 / 3 | (a floor has 1) | 3 / 3 |
| every 2×2 horde or hazard, ending in a crest | — | yes (last wave 0.60 Blessed only, 24–28 spawn points) |

Band 1's 1×1 rooms are the gentler ones (one loft room, two flyer rooms, the moat, the fountain court, the gridiron); the Rood Screen, the Colonnade, the Burning Aisle, the Lampstands and the Kilns wait for band 2.

### 3.1 Combat template grids

In the block notation of §2.1. Orientation: as authored (the generator rotates and mirrors, §3.3 step 12), north up. §9 records historical measurements; expanded/rotated current templates must meet §2.1 before shipping.

#### pg-c-1x1-ranged-01 · The Choir Loft

*1x1, ranged, bands 1–2.* Two 2 m lofts flank one wall, a stair at each outer end; four nave pillars hide the floor from them. The Choristers nest on the lofts: fight from pillar to pillar, then storm a loft up its stair (the Blessed come down the same stair) and turn its height on the rest of the hall.

```room
id        pg-c-1x1-ranged-01
name      The Choir Loft
kind      combat
shape     1x1
focus     ranged
bands     1 2
weight    1
grid
 0 22222.::...22222 x..x........x..x
 1 22222.::...22222 ..o..........o..
 2 22222.::...22222 ................
 3 22222......22222 x...c......c...x
 4 .^^..........^^. ....!......!....
 5 .^^..........^^. ................
 6 :::..........::: ................
 7 :::.##....##.::: .......+........
 8 ....##....##.... ................
 9 ................ o......RR......o
10 ................ ...u...RR...u...
11 ...#........#... ................
12 ...#........#... ................
13 ......::........ ................
14 ......::........ .....o....o.....
15 ......::........ x..............x
obstacles
  high   0,0 4,5 west loft (+2 m) and its stair: Choristers nest here; storm it or deny it
  high   11,0 15,5 east loft (+2 m) and its stair
  cover  4,7 5,8 nave pillar: hides the middle from the west loft
  cover  10,7 11,8 nave pillar: hides the middle from the east loft
  cover  3,11 3,12 south-west pillar: cover for the approach to the west stair
  cover  12,11 12,12 south-east pillar
props     loot 0.85 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.7 chorister 0.3
  3 0.40 blessed 0.7 chorister 0.3
```

#### pg-c-1x1-ranged-02 · The Colonnade

*1x1, ranged, bands 2–3.* A hypostyle hall: four 1 m corner balconies, each with one stair, around a grid of five pillars. Every corner can hold a Chorister; the party dances between the pillars and clears corners one by one, hopping straight up a balcony edge while the Blessed queue at its stair.

```room
id        pg-c-1x1-ranged-02
name      The Colonnade
kind      combat
shape     1x1
focus     ranged
bands     2 3
weight    1
grid
 0 1111..::....1111 x..c........c..x
 1 1111<.::...>1111 ................
 2 1111<.::...>1111 ..x..........x..
 3 1111........1111 ...o........o...
 4 ................ ...............o
 5 .....##..##..... .......+!.......
 6 :::..##..##..::: ................
 7 :::....##....::: ................
 8 .......##....... ................
 9 .....##..##..... o...............
10 .....##..##..... .......RR.......
11 ................ .......RR.!.....
12 1111........1111 ...o........o...
13 1111<.::...>1111 ..x..........x..
14 1111<.::...>1111 ................
15 1111..::....1111 x..c........c..x
obstacles
  high   0,0 4,3 north-west balcony (+1 m) and stair: a Chorister perch
  high   11,0 15,3 north-east balcony
  high   0,12 4,15 south-west balcony
  high   11,12 15,15 south-east balcony
  jump   0,0 3,3 players hop up any 1 m balcony edge; the Blessed queue for its one stair
  jump   12,12 15,15 the same for the opposite balcony
  cover  5,5 6,6 colonnade pillar (4 m) between a balcony and the hall
  cover  9,5 10,6 colonnade pillar (4 m) between a balcony and the hall
  cover  5,9 6,10 colonnade pillar (4 m) between a balcony and the hall
  cover  9,9 10,10 colonnade pillar (4 m) between a balcony and the hall
  cover  7,7 8,8 central pier: blocks the diagonals between balconies; also a kite post
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.75 chorister 0.25
  3 0.40 blessed 0.7 chorister 0.3
```

#### pg-c-1x1-ranged-03 · The Rood Screen

*1x1, ranged, bands 2–3.* A rood screen splits the room: the choir half behind it sees the nave only through two 4 m gaps and two 2 m slots. The Blessed pour through the gaps (chokes, a lamp at each); the Choristers fire only through them, so standing out of a gap line is cover, and a 2 m pulpit watches both gaps.

```room
id        pg-c-1x1-ranged-03
name      The Rood Screen
kind      combat
shape     1x1
focus     ranged
bands     2 3
weight    1
grid
 0 ......::........ x..............x
 1 .222..::........ ..o.............
 2 .222..::........ ................
 3 .222.......##... ................
 4 ..^............. o......+.......o
 5 ..^............. ................
 6 :::.....#....::: ................
 7 :::.....#....::: ................
 8 ................ .....c....c!....
 9 .###..####..###. ................
10 ................ ....!...........
11 ................ x......RR......x
12 ................ .......RR....o..
13 ......::........ ..o.............
14 ......::........ .........o......
15 ......::........ x..x.......x...x
obstacles
  cover  1,9 3,9 west screen wall
  cover  6,9 9,9 middle screen wall: the choir sees the nave only through the gaps
  cover  12,9 14,9 east screen wall
  choke  1,9 14,9 the screen: two 4 m gaps and two 2 m slots funnel the choir side into the nave
  cover  11,3 12,3 nave pillar
  cover  8,6 8,7 nave pillar: hides the north door from the east gap
  high   1,1 3,5 pulpit (+2 m) and its stair: watch both gaps from above
props     loot 0.85 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.7 chorister 0.3
  3 0.40 blessed 0.7 chorister 0.3
```

#### pg-c-1x1-ranged-hazard-01 · The Burning Aisle

*1x1, ranged + hazard, bands 2–3.* A 4 m fire channel crosses the room with a dry 4 m bridge at each side. The fire stops the crowd, not the hymns: Blessed from the far side burn crossing, while the Choristers on the far 2 m terrace fire straight across it. Hold behind the pillars, then cross a bridge (a choke with a lamp) to silence the terrace.

```room
id        pg-c-1x1-ranged-hazard-01
name      The Burning Aisle
kind      combat
shape     1x1
focus     ranged
secondary hazard
bands     2 3
weight    1
grid
 0 ......::........ x..............x
 1 ..##..::....##.. ................
 2 ......::........ .....o...o....o.
 3 ................ o..............x
 4 ....##....##.... .......RR.......
 5 ....##....##.... .......RR.......
 6 :::..........::: ................
 7 :::..........::: ................
 8 ................ .....!.....c....
 9 ~~~..~~~~~~..~~~ ................
10 ~~~..~~~~~~..~~~ ................
11 ................ ....c.......!...
12 ...#.......22222 x.......+...x...
13 ...#..::.>>22222 ................
14 ......::.>>22222 .o..............
15 ......::...22222 x..x.........o.x
obstacles
  lure   0,9 2,10 west fire channel (4 m): Blessed from the south burn crossing it
  lure   5,9 10,10 central fire channel between the two bridges
  lure   13,9 15,10 east fire channel
  choke  3,8 4,11 west bridge (4 m): the dry way across, a lamp at its mouth
  choke  11,8 12,11 east bridge (4 m)
  high   9,12 15,15 south-east choir terrace (+2 m) and its stair: the Choristers fire across the fire
  cover  2,1 3,1 north-west pillar
  cover  12,1 13,1 north-east pillar
  cover  4,4 5,5 pier (4 m): hides the reward spot side from the west bridge
  cover  10,4 11,5 pier (4 m): hides it from the terrace
  cover  3,12 3,13 south-west pillar: cover for crossing the west bridge
props     loot 0.85 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.7 chorister 0.3
  3 0.40 blessed 0.7 chorister 0.3
```

#### pg-c-1x1-flyers-01 · The Open Terrace

*1x1, flyers, bands 1–2.* An open sky terrace: no tall cover at all, four L-shaped 1.5 m marble hedges that the crowd must walk round while the Cherubs fly straight over, and a 1 m dais in the middle with two stairs. Stand on the dais to shoot up, hop off it when the crowd climbs.

```room
id        pg-c-1x1-flyers-01
name      The Open Terrace
kind      combat
shape     1x1
focus     flyers
bands     1 2
weight    1
grid
 0 ......::........ x..x...........x
 1 ......::........ ................
 2 ......::........ .o............o.
 3 ...>BB....BB<... ...............x
 4 ...B........B... ....t....!......
 5 ...B...vv...B... ................
 6 :::...1111...::: ......+.........
 7 :::...1111...::: .......RR.......
 8 ......1111...... .....o.RR.o.....
 9 ......1111...... ................
10 ...B...^^...B... ................
11 ...B........B... .........!.t....
12 ...>BB....BB<... x...............
13 ......::........ .o............o.
14 ......::........ ................
15 ......::........ x...........x..x
obstacles
  kite   3,3 5,5 north-west hedge (1.5 m marble): the crowd walks round it, the Cherubs fly over
  kite   10,3 12,5 north-east hedge
  kite   3,10 5,12 south-west hedge
  kite   10,10 12,12 south-east hedge
  high   6,5 9,10 central dais (+1 m), stairs north and south: the best view of the sky
  jump   6,6 9,9 players hop onto the dais from any side; the Blessed take its two stairs
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.75 cherub 0.25
  3 0.40 blessed 0.7 cherub 0.3
```

#### pg-c-1x1-flyers-02 · The Sunken Well

*1x1, flyers, bands 2–3.* A 2 m well fills the middle, a stair down each side. Over the well the Cherubs hover at the rim's eye level (their 4 m is measured from the well floor), so fight from the rim: the crowd takes the short way, drops into the well and climbs out only by the four stairs (chokes, a lamp at two of them) right at your feet. Going down is the trap: the crowd drops in after you from every side, and you too leave only by a stair.

```room
id        pg-c-1x1-flyers-02
name      The Sunken Well
kind      combat
shape     1x1
focus     flyers
bands     2 3
weight    1
grid
 0 ......::........ x..x........x..x
 1 ......::........ ................
 2 ......::........ .o............o.
 3 ................ ...c!......!....
 4 ....===^^===.... ................
 5 ....===^^===.... ................
 6 :::.========.::: .......RR.......
 7 :::.========.::: .......RR.......
 8 ....<<====>>.... ................
 9 ....<<====>>.... .......+........
10 ....===vv===.... ................
11 ....===vv===.... ................
12 ................ ....o......oc...
13 ......::........ .o............o.
14 ......::........ ................
15 ......::........ x..x........x..x
obstacles
  kite   3,3 12,12 the well (2 m deep, four stairs) and the rim around it: a loop to kite round, a pit to drop into
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.75 cherub 0.25
  3 0.40 blessed 0.7 cherub 0.3
```

#### pg-c-1x1-flyers-03 · The Ziggurat

*1x1, flyers, bands 1–3.* A two-tier ziggurat (1 m and 2 m) with pinwheel stairs. Its summit sees the whole room and the sky, so it is where the party wants to be and where the Cherubs gather; players climb the 1 m tier edges anywhere while the Blessed spiral round to the stairs. King of the hill.

```room
id        pg-c-1x1-flyers-03
name      The Ziggurat
kind      combat
shape     1x1
focus     flyers
bands     1 3
weight    1
grid
 0 ......::........ x..x........x..x
 1 ......::........ .t..............
 2 ......::........ ..........!.....
 3 .........vv..... ................
 4 ...>11111111.... ....o......o....
 5 ...>1111vv11.... ................
 6 :::.1>222211.::: ......+.........
 7 :::.1>222211.::: .......RR.......
 8 ....112222<1.... .......RR.......
 9 ....112222<1<... .o............o.
10 ....11^^1111<... ................
11 ....11111111.... ....o......o....
12 ....^^.......... ................
13 ......::........ ....!...........
14 ......::........ ..............t.
15 ......::........ x..x........x..x
obstacles
  high   3,3 12,12 the ziggurat: a 1 m tier and a 2 m summit, each reached by four stairs in a pinwheel
  jump   4,4 11,11 every tier edge is 1 m: players climb straight up, the Blessed spiral round to the stairs
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.75 cherub 0.25
  3 0.40 blessed 0.7 cherub 0.3
```

#### pg-c-1x1-hazard-flyers-01 · The Refining Moat

*1x1, hazard + flyers, bands 1–2.* An 8 m island inside a 4 m ring of fire with a dry bridge on each side. On the island the crowd reaches you only over four bridges (chokes) or burning; the Cherubs are the island's price. Outside, kiting round a corner post drags the train across the moat.

```room
id        pg-c-1x1-hazard-flyers-01
name      The Refining Moat
kind      combat
shape     1x1
focus     hazard
secondary flyers
bands     1 2
weight    1
grid
 0 ......::........ x..x......o....x
 1 ......::........ ................
 2 ..#...::.....#.. ................
 3 ................ ....!..........x
 4 ....~~~..~~~.... ................
 5 ....~~~..~~~.... o...............
 6 :::.~~....~~.::: ......o..+......
 7 :::..........::: .......RR.......
 8 ................ .......RR.......
 9 ....~~....~~.... .........o......
10 ....~~~..~~~.... ...............o
11 ....~~~..~~~.... ................
12 ................ x.........!.....
13 ..#...::.....#.. ................
14 ......::........ ................
15 ......::........ x....o......x..x
obstacles
  lure   4,4 11,11 the moat: a 4 m fire ring round an 8 m island, a 4 m bridge on each side
  choke  7,4 8,5 north bridge: the dry way onto the island
  choke  7,10 8,11 south bridge
  lure   2,2 2,2 corner post: kite round it and the train cuts the corner over the moat
  lure   13,2 13,2 corner post
  lure   2,13 2,13 corner post
  lure   13,13 13,13 corner post
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 0.85 cherub 0.15
  3 0.40 blessed 0.85 cherub 0.15
```

#### pg-c-1x1-elite-01 · The Two Lampstands

*1x1, elite, bands 2–3.* Two tall pylons, 2 x 8 m, stand in an open hall: a figure-of-eight to loop the Dominions round while the crowd follows. Every spawn point is in plain view of the middle, so each Dominion is seen the moment it lands; lead it into the crowd chasing you round a pylon and step out of the ring.

```room
id        pg-c-1x1-elite-01
name      The Two Lampstands
kind      combat
shape     1x1
focus     elite
bands     2 3
weight    1
grid
 0 ......::........ x..x........x..x
 1 ......::........ ................
 2 ......::........ o...............
 3 ................ ............!...
 4 ................ .......o.......o
 5 ................ ......c.........
 6 :::.#......#.::: ................
 7 :::.#......#.::: .......RR.......
 8 ....#......#.... .......RR.......
 9 ....#......#.... ................
10 ................ .........c......
11 ................ o.......o....+..
12 ................ ...!............
13 ......::........ ...............o
14 ......::........ ................
15 ......::........ x..x........x..x
obstacles
  kite   4,6 4,9 the west lampstand (a 2 x 8 m pylon): loop the Dominion round it
  kite   11,6 11,9 the east lampstand: with the west one, a figure of eight
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 1 elites 1
  3 0.40 blessed 1 elites 1
```

#### pg-c-1x1-elite-02 · The Fountain Court

*1x1, elite, bands 1–3.* A fountain on an 8 m, 1.5 m plinth in the middle and four corner pillars: a tight loop and four wide ones. You see over the fountain, and the Dominion's head and mace stand above it, so you always know which way round to run.

```room
id        pg-c-1x1-elite-02
name      The Fountain Court
kind      combat
shape     1x1
focus     elite
bands     1 3
weight    1
grid
 0 ......::........ o..x.......o.x..
 1 ......::........ ................
 2 ......::........ ................
 3 ...#........#... x..............x
 4 ................ ..........!.....
 5 ................ .....o..........
 6 :::...BBBB...::: ......a...RR....
 7 :::...BBBB...::: .......f..RR....
 8 ......BBBB...... .............+..
 9 ......BBBB...... .........a......
10 ................ ..........o.....
11 ................ .....!..........
12 ...#........#... x..............x
13 ......::........ ................
14 ......::........ ................
15 ......::........ ..x.o.......x..o
obstacles
  kite   6,6 9,9 the fountain (8 m, 1.5 m tall): a tight loop you can see over; the Dominion's mace shows above it
  kite   3,3 3,3 corner pillar: a wide loop
  kite   12,3 12,3 corner pillar
  kite   3,12 3,12 corner pillar
  kite   12,12 12,12 corner pillar
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 1 elites 1
  3 0.40 blessed 1 elites 1
```

#### pg-c-1x1-hazard-01 · The Gridiron

*1x1, hazard, bands 1–3.* Two 2 m fire lines cross the room, each with one 4 m bridge in front of a door, cutting it into three bands. Hold the middle band and every Blessed crosses a bridge or the fire, which leaves it singed (one hit from bursting); posts at the lines let a kiting player drag a train over them.

```room
id        pg-c-1x1-hazard-01
name      The Gridiron
kind      combat
shape     1x1
focus     hazard
bands     1 3
weight    1
grid
 0 ......::........ x..x........x..x
 1 ......::........ ..............o.
 2 ......::........ .o..............
 3 ..........#..... ....!...........
 4 ~~~~~~..~~~~~~~~ ................
 5 ................ ................
 6 :::..........::: .......RRo......
 7 :::#........#::: .......RR.......
 8 ...#........#... ................
 9 ................ .......o.....+..
10 ................ ................
11 ~~~~~~..~~~~~~~~ ................
12 .....#.......... ..........!.....
13 ......::........ ..............o.
14 ......::........ .o..............
15 ......::........ x..x........x..x
obstacles
  lure   0,4 15,4 north fire line (2 m) with a 4 m bridge in front of the north door
  lure   0,11 15,11 south fire line with its bridge
  lure   10,3 10,3 post at the north line: kite round it and the train crosses the fire
  lure   5,12 5,12 post at the south line
  kite   3,7 3,8 west pillar in the middle band
  kite   12,7 12,8 east pillar in the middle band
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 1
  3 0.40 blessed 1
```

#### pg-c-1x1-hazard-02 · The Kilns

*1x1, hazard, bands 2–3.* Each corner is a kiln: two spawn points behind an L of fire with a 4 m dry gap along the wall. Where the party stands decides whether a corner's crowd walks through the fire (and comes out singed, one hit from bursting) or round by the gap; the 2 m mound in the middle puts every direct line over fire, at the price of a crowd on both stairs.

```room
id        pg-c-1x1-hazard-02
name      The Kilns
kind      combat
shape     1x1
focus     hazard
bands     2 3
weight    1
grid
 0 ......::........ x............o.x
 1 ......::........ ....!...........
 2 ....~.::...~.... o.x..........x..
 3 ....~......~.... ................
 4 ~~~~~..vv..~~~~~ ................
 5 .......vv....... ................
 6 :::...2222...::: ......o..+......
 7 :::...2222...::: .......RR.......
 8 ......2222...... .......RR.......
 9 ......2222...... .........o......
10 .......^^....... ................
11 ~~~~~..^^..~~~~~ ................
12 ....~......~.... ................
13 ....~.::...~.... ..x..........x.o
14 ......::........ ..........!.....
15 ......::........ x.o............x
obstacles
  lure   0,2 4,4 north-west kiln: an L of fire round a spawn corner, a 4 m dry gap along the wall
  lure   11,2 15,4 north-east kiln: an L of fire round a spawn corner, a 4 m dry gap along the wall
  lure   0,11 4,13 south-west kiln: an L of fire round a spawn corner, a 4 m dry gap along the wall
  lure   11,11 15,13 south-east kiln: an L of fire round a spawn corner, a 4 m dry gap along the wall
  spawn  0,0 3,3 the north-west kiln mouth: two spawn points behind the fire
  high   6,4 9,11 the kiln mound (+2 m), stairs north and south: every corner's direct line crosses fire
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.25 blessed 1
  2 0.35 blessed 1
  3 0.40 blessed 1
```

#### pg-c-2x1-horde-01 · The Cloudbridge

*2x1, horde, bands 1–3.* Arena 2 re-cut: a 1 m basin fills the middle, split by two 4 m bridges. Players hop in and out of the basin anywhere; the Blessed drop in after them but climb out only by its four stairs, so diving through the basin sheds a train while the crowd crossing on the bridges packs into chokes. A 2 m terrace (two stairs) watches it all.

```room
id        pg-c-2x1-horde-01
name      The Cloudbridge
kind      combat
shape     2x1
focus     horde
bands     1 3
weight    1
grid
 0 11111.::................::........ x..x.......x........x........x....
 1 11111.::........##......::........ .o................................
 2 11111.::........##......::........ .......................o..........
 3 11111............................. .....................c...........x
 4 ...^^............................. .....c........!.............c.....
 5 .........-----..-^-..----......... ..................................
 6 :::......-----..---..----......::: ............o.....................
 7 :::......<----..---..--->......::: ..............RR.+................
 8 .........<----..---..--->......... ..............RR..................
 9 .........-----..---..----....vv... ........o!............o..........o
10 .........-----..-v-..----....vv... .........................x........
11 ..........................>>222222 x...................!.............
12 ..........................>>222222 .............c....................
13 ......::........##......::..222222 ..........o....................x..
14 ......::........##......::..222222 ..................................
15 ......::................::..222222 x..x.......x........x...........o.
obstacles
  kite   9,5 24,10 the basin, 1 m deep: players hop out anywhere, the Blessed only by its four stairs; dive in to shed a train
  jump   9,5 24,10 the basin's 1 m edges
  choke  14,5 15,10 west bridge (4 m) across the basin: the crowd crosses here, a lamp at each mouth
  choke  19,5 20,10 east bridge (4 m)
  kite   16,1 17,2 north pier (4 x 4 m) between the bridges
  kite   16,13 17,14 south pier
  high   26,9 33,15 south-east terrace (+2 m), stairs from the north and the west: the crest's view of the basin
  high   0,0 4,4 north-west ledge (+1 m) and its stair
  jump   0,0 4,3 the ledge's 1 m edge
props     loot 1.0 blast 0.8 blessing 0.5
waves
  1 0.15 blessed 1
  2 0.25 blessed 1
  3 0.28 blessed 1
  4 0.32 blessed 1
```

#### pg-c-2x1-horde-hazard-01 · The Processional

*2x1, horde + hazard, bands 1–3.* A long nave between two aisles, each aisle walled off by a 2 m fire line broken by **8 m dry bridges** at the doors. The aisles' crowds cross the fire or pack onto the bridges; the 2 m bier in mid-nave sees both aisles, and kiting round a nave pier brings a train back over the fire.

```room
id        pg-c-2x1-horde-hazard-01
name      The Processional
kind      combat
shape     2x1
focus     horde
secondary hazard
bands     1 3
weight    1
grid
 0 ......::................::........ x..x.......x.....x..x........x...x
 1 ......::................::........ ...............c..................
 2 ......::................::........ .o............................o...
 3 .................................. ....!.............................
 4 ~~~~~....~~~~~~~~~~~~~~....~~~~~~~ ..................................
 5 .................................. ...........!......................
 6 :::............2222............::: ............o...o.................
 7 :::.....##...>>2222<<...##.....::: ..................................
 8 ........##...>>2222<<...##........ ....RR............................
 9 ...............2222............... ....RR...........o...o......+.....
10 .................................. ..................................
11 ~~~~~....~~~~~~~~~~~~~~....~~~~~~~ ..................................
12 .................................. ............................!.....
13 ......::................::........ ..o.............................o.
14 ......::................::........ ..................c...............
15 ......::................::........ x..x.......x....x...x........x...x
obstacles
  lure   0,4 33,4 north fire line (2 m) along the nave, broken by two 8 m bridges at the north doors
  lure   0,11 33,11 south fire line with its two bridges
  choke  5,4 8,4 north-west bridge: the aisle crowd pours into the nave here
  choke  23,11 26,11 south-east bridge
  high   13,6 20,9 the bier (+2 m) in mid-nave, a stair at each end: see both aisles over the fire
  kite   8,7 9,8 west nave pier: loop the crowd round it and back over the fire
  kite   24,7 25,8 east nave pier
props     loot 1.0 blast 0.8 blessing 0.5
waves
  1 0.15 blessed 1
  2 0.25 blessed 1
  3 0.28 blessed 1
  4 0.32 blessed 1
```

#### pg-c-2x1-ranged-01 · The Cloister of Hymns

*2x1, ranged, bands 2–3.* Arena 3 re-cut: four 2 m galleries at the two ends, each with one stair, and a nave of eight pillars. Choristers take the galleries and fire down the nave; the party works from pillar to pillar toward one end, clears its two galleries, and then fights the far end from the height it just took.

```room
id        pg-c-2x1-ranged-01
name      The Cloister of Hymns
kind      combat
shape     2x1
focus     ranged
bands     2 3
weight    1
grid
 0 22222.::................::...22222 x..........x....x....x...........x
 1 22222.::................::...22222 ...x.................o........x...
 2 22222.::................::...22222 .................!................
 3 22222........................22222 .o..............................o.
 4 22222.....#...#....#...#.....22222 ..................................
 5 ...^^........................^^... ............c........c............
 6 :::^^........................^^::: ......!...........................
 7 :::............................::: ................RR................
 8 .................................. ........o.......RR................
 9 22222........................22222 .................+.........!......
10 22222<<....................>>22222 ............c........c............
11 22222<<...#...#....#...#...>>22222 .o..............................o.
12 22222........................22222 ..................................
13 22222.::................::...22222 ...x..........................x...
14 22222.::................::...22222 ............o.....................
15 22222.::................::...22222 x..........x.....x...x...........x
obstacles
  high   0,0 4,6 north-west gallery (+2 m) and stair
  high   0,9 6,15 south-west gallery and stair
  high   29,0 33,6 north-east gallery and stair
  high   27,9 33,15 south-east gallery and stair
  cover  10,4 10,4 nave pillar: breaks the galleries' lines down the nave
  cover  10,11 10,11 nave pillar: breaks the galleries' lines down the nave
  cover  14,4 14,4 nave pillar: breaks the galleries' lines down the nave
  cover  14,11 14,11 nave pillar: breaks the galleries' lines down the nave
  cover  19,4 19,4 nave pillar: breaks the galleries' lines down the nave
  cover  19,11 19,11 nave pillar: breaks the galleries' lines down the nave
  cover  23,4 23,4 nave pillar: breaks the galleries' lines down the nave
  cover  23,11 23,11 nave pillar: breaks the galleries' lines down the nave
props     loot 1.0 blast 0.8 blessing 0.5
waves
  1 0.15 blessed 1
  2 0.25 blessed 0.75 chorister 0.25
  3 0.28 blessed 0.75 chorister 0.25
  4 0.32 blessed 0.7 chorister 0.3
```

#### pg-c-2x1-flyers-01 · The Skywalk

*2x1, flyers, bands 1–3.* A 2 m skywalk runs the length of the room, stairs at both ends and in the middle, over an open floor with four low hedges. On the walk the party sees the whole crowd and shoots it from above, but stands against the open sky with the Cherubs; the Blessed climb three stairs, so the walk must be held or left in time.

```room
id        pg-c-2x1-flyers-01
name      The Skywalk
kind      combat
shape     2x1
focus     flyers
bands     1 3
weight    1
grid
 0 ......::................::........ x..x.......x........x........x...x
 1 ......::................::........ ............o.....................
 2 ......::................::........ .o................................
 3 ..........>BBB......BBB<.......... .................................x
 4 .................................. ...........t......................
 5 .................................. ..................................
 6 :::............................::: .............................!....
 7 :::.>>2222222222222222222222<<.::: ........o.......o...RR............
 8 ....>>2222222222222222222222<<.... ...........+........RR...o........
 9 ................^^................ ....!.............................
10 ................^^................ ...............................o..
11 .................................. x...............!.....t...........
12 ..........>BBB......BBB<.......... ..................................
13 ......::................::........ ................................o.
14 ......::................::........ .....................o............
15 ......::................::........ x..x.......x........x........x...x
obstacles
  high   4,7 29,10 the skywalk (+2 m, 4 m wide), a stair at each end and one in the middle: over the crowd, under the Cherubs
  kite   10,3 13,3 north-west hedge (1.5 m): the crowd goes round, the Cherubs over
  kite   20,3 23,3 north-east hedge
  kite   10,12 13,12 south-west hedge
  kite   20,12 23,12 south-east hedge
props     loot 1.0 blast 0.8 blessing 0.5
waves
  1 0.15 blessed 1
  2 0.25 blessed 0.75 cherub 0.25
  3 0.28 blessed 0.75 cherub 0.25
  4 0.32 blessed 0.7 cherub 0.3
```

#### pg-c-2x1-elite-01 · The Hall of Dominions

*2x1, elite, bands 2–3.* A long hall with three posts in a row (pylon, fountain, pylon) and a 1 m dais in two opposite corners. One Dominion enters in each of waves 2–4; carrying one forward may put two on the floor at once. Slalom them through the posts so their maces fall on the crowd behind you; hopping onto a dais sends the walking crowd toward its stair. A Blessed can still strike a player within 1.2 m of the edge, and the Dominion's 4.5 m ring reaches onto the low dais: take the brief route advantage and move.

```room
id        pg-c-2x1-elite-01
name      The Hall of Dominions
kind      combat
shape     2x1
focus     elite
bands     2 3
weight    1
grid
 0 ......::................::...11111 x..x.......x........x........x...x
 1 ......::................::...11111 ..................................
 2 ......::................::...11111 ............o...................o.
 3 .............................11111 ..x..................!............
 4 .............................11111 ....!.............................
 5 .............................^^... ..............o...................
 6 :::......#.....BBBB.....#......::: ...............a...........o......
 7 :::......#.....BBBB.....#......::: ............RR..f.................
 8 .........#.....BBBB.....#......... ............RR....................
 9 .........#.....BBBB.....#......... ......o...........a...............
10 ...vv............................. ...................o..............
11 11111............................. ............................x.....
12 11111............................. ............!.....................
13 11111.::................::........ .o...................o....+.......
14 11111.::................::........ ..................................
15 11111.::................::........ x..x.......x........x........x...x
obstacles
  kite   9,6 9,9 west pylon (2 x 8 m)
  kite   15,6 18,9 the fountain (8 m, 1.5 m tall), mid-hall: a loop you can see over
  kite   24,6 24,9 east pylon: three posts in a row, a slalom for a Dominion and its crowd
  jump   0,10 4,15 south-west dais (+1 m): hop up, the crowd takes the stair
  jump   29,0 33,5 north-east dais (+1 m)
props     loot 1.0 blast 0.8 blessing 0.5
waves
  1 0.15 blessed 1
  2 0.25 blessed 1 elites 1
  3 0.28 blessed 1 elites 1
  4 0.32 blessed 1 elites 1
```

#### pg-c-2x2-horde-flyers-01 · Courtyard of Clouds

*2x2, horde + flyers, bands 2–3.* Arena 1 re-cut to 68 m: a 16 m cloud terrace (+2 m) in the middle with a stair on every side, ringed by four low hedges that leave an 8 m gap before each stair, four piers in the outer court and a 1 m ledge in one corner. The crest pours in from 24 points round the walls; from the terrace the party sees all of it and shoots the Cherubs of waves 2–4, then holds the stair gaps (chokes) or drops off and kites round a pier.

```room
id        pg-c-2x2-horde-flyers-01
name      Courtyard of Clouds
kind      combat
shape     2x2
focus     horde
secondary flyers
bands     2 3
weight    1
grid
 0 ......::................::........ x..x.......x....x...x........x...x
 1 ......::................::........ .o..............................o.
 2 ......::................::........ ..................................
 3 .................................. x................................x
 4 .................................. ................o.................
 5 .................................. ..................................
 6 :::............................::: ..................................
 7 :::............................::: ..................................
 8 .................................. ............o.....................
 9 .................................. ................!.................
10 ......##..>BBBB....BBBB<..##...... ..................................
11 ......##..B.....vv.....B..##...... x................................x
12 ..........B.....vv.....B.......... .........................o........
13 ..........B..22222222..B.......... .............u......u.............
14 ..........B..22222222..B.......... ..............o....+..............
15 .............22222222............. ..................................
16 ...........>>22222222<<........... x...............RR......!....o...x
17 ...........>>22222222<<........... ....o....!......RR................
18 .............22222222............. ..................................
19 ..........B..22222222..B.......... ..............+....o..............
20 ..........B..22222222..B.......... x............u......u............x
21 ..........B.....^^.....B.......... ........o.........................
22 ......##..B.....^^.....B..##...... ..................................
23 ......##..>BBBB....BBBB<..##...... ..................................
24 :::............................::: .................!................
25 :::............................::: .....................o............
26 .................................. ..................................
27 ..............................vv.. ..................................
28 ............................111111 ..................................
29 ............................111111 x................o...........o...x
30 ............................111111 ..................................
31 ......::................::..111111 ..................................
32 ......::................::..111111 .o................................
33 ......::................::..111111 x..x.......x....x...x........x...x
obstacles
  high   11,11 22,22 the cloud terrace (+2 m, 16 m square), a stair on every side: the crest seen from above
  choke  10,10 14,14 north-west hedge (1.5 m): with its neighbours it leaves an 8 m gap before each stair, where the crowd packs
  choke  19,10 23,14 north-east hedge (1.5 m): with its neighbours it leaves an 8 m gap before each stair, where the crowd packs
  choke  10,19 14,23 south-west hedge (1.5 m): with its neighbours it leaves an 8 m gap before each stair, where the crowd packs
  choke  19,19 23,23 south-east hedge (1.5 m): with its neighbours it leaves an 8 m gap before each stair, where the crowd packs
  kite   6,10 7,11 a 4 m pier in the outer court: loop the crowd round it
  kite   26,10 27,11 a 4 m pier in the outer court: loop the crowd round it
  kite   6,22 7,23 a 4 m pier in the outer court: loop the crowd round it
  kite   26,22 27,23 a 4 m pier in the outer court: loop the crowd round it
  high   28,27 33,33 south-east ledge (+1 m) with one stair
  jump   28,28 33,33 the ledge's 1 m edge: hop up, the crowd queues at the stair
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.07 blessed 1
  2 0.08 blessed 0.75 cherub 0.25
  3 0.10 blessed 0.75 cherub 0.25
  4 0.15 blessed 0.75 cherub 0.25
  5 0.60 blessed 1
```

#### pg-c-2x2-horde-elite-01 · The Field of the Host

*2x2, horde + elite, bands 2–3.* A vast parade ground: four gatehouses in the middle of the walls pour the crowd out through 8 m gates, a ring of eight standards (pillars) circles the open middle, and two 2 m reviewing towers stand in opposite corners. A Dominion comes in each of waves 2–4: lead it through the standards into the gate crowds; then the crest of 1 200 floods out of the gates and the corners at once.

```room
id        pg-c-2x2-horde-elite-01
name      The Field of the Host
kind      combat
shape     2x2
focus     horde
secondary elite
bands     2 3
weight    1
grid
 0 ......::......#....#....::..222222 x..x.......x...x..x..x.......x...x
 1 ......::......#....#....::..222222 .............................o....
 2 ......::......#....#....::..222222 ................o.............c...
 3 ..............#....#......>>222222 x................................x
 4 ..............#....#......>>222222 ..................................
 5 .............................^^... ..................................
 6 :::..........................^^::: ......o.........!.................
 7 :::............................::: ..................................
 8 ................##................ ..................................
 9 ................##................ ................................o.
10 ..........##..........##.......... ..................................
11 ..........##..........##.......... x................................x
12 .................................. ....................o.............
13 .................................. ............o.....................
14 #####........................##### ..................................
15 .................................. x................................x
16 ........##..............##........ ..o..........+..RR.........!......
17 ........##..............##........ ......!.........RR..+..........o..
18 .................................. x................................x
19 #####........................##### ..................................
20 .................................. .....................o............
21 .................................. x............o...................x
22 ..........##..........##.......... .o................................
23 ..........##..........##.......... ..................................
24 :::.............##.............::: ..................................
25 :::.............##.............::: ..................................
26 .................................. ..................................
27 ...vv............................. .................!.........o......
28 ...vv............................. ..................................
29 222222<<......#....#.............. .................................x
30 222222<<......#....#.............. x.................................
31 222222::......#....#....::........ ..c..............o................
32 222222::......#....#....::........ ....o.............................
33 222222::......#....#....::........ x..x.......x...x..x..x........x..x
obstacles
  choke  14,0 19,4 north gatehouse: two wall stubs, an 8 m gate the crowd pours out of
  spawn  14,0 19,4 north gatehouse: two spawn points inside it
  choke  14,29 19,33 south gatehouse: two wall stubs, an 8 m gate the crowd pours out of
  spawn  14,29 19,33 south gatehouse: two spawn points inside it
  choke  0,14 4,19 west gatehouse: two wall stubs, an 8 m gate the crowd pours out of
  spawn  0,14 4,19 west gatehouse: two spawn points inside it
  choke  29,14 33,19 east gatehouse: two wall stubs, an 8 m gate the crowd pours out of
  spawn  29,14 33,19 east gatehouse: two spawn points inside it
  kite   16,8 17,9 a standard (4 m pillar) of the ring round the open middle
  kite   16,24 17,25 a standard (4 m pillar) of the ring round the open middle
  kite   8,16 9,17 a standard (4 m pillar) of the ring round the open middle
  kite   24,16 25,17 a standard (4 m pillar) of the ring round the open middle
  kite   10,10 11,11 a standard (4 m pillar) of the ring round the open middle
  kite   22,10 23,11 a standard (4 m pillar) of the ring round the open middle
  kite   10,22 11,23 a standard (4 m pillar) of the ring round the open middle
  kite   22,22 23,23 a standard (4 m pillar) of the ring round the open middle
  high   26,0 33,6 north-east reviewing tower (+2 m), two stairs
  high   0,27 7,33 south-west reviewing tower (+2 m), two stairs
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.07 blessed 1
  2 0.08 blessed 1 elites 1
  3 0.10 blessed 1 elites 1
  4 0.15 blessed 1 elites 1
  5 0.60 blessed 1
```

#### pg-c-2x2-hazard-horde-01 · The Refiner's Court

*2x2, hazard + horde, bands 2–3.* Four 4 m fire channels bent into L-shapes guard the corners, each round a corner pier; four dry 12 m corridors run from the middle of each wall to a 2 m dais in the centre. 24 of its 28 spawn points stand at the corridor mouths, so the crest of 1 200 comes down the dry corridors (chokes) and the fire burns only what the party drags through it; kiting round a corner pier drags a train through its L twice, and anything coming straight from a corner burns.

```room
id        pg-c-2x2-hazard-horde-01
name      The Refiner's Court
kind      combat
shape     2x2
focus     hazard
secondary horde
bands     2 3
weight    1
grid
 0 ......::................::........ x.............x.x..x.............x
 1 ......::................::........ .o..............................o.
 2 ......::................::........ ..................................
 3 .................................. ..............x.x..x..............
 4 ............~~......~~............ ..................................
 5 ............~~......~~............ .....o......................o.....
 6 :::.........~~......~~.........::: ..................................
 7 :::....##...~~......~~...##....::: ..................................
 8 .......##...~~......~~...##....... ................o.................
 9 ............~~......~~............ ..................................
10 ............~~......~~............ ..................................
11 ............~~......~~............ ...............!..................
12 ....~~~~~~~~~~......~~~~~~~~~~.... ..................................
13 ....~~~~~~~~~~..vv..~~~~~~~~~~.... ..................................
14 ................vv................ x..x..........................x..x
15 ...............2222............... ...............o..+...!...........
16 .............>>2222<<............. x..x............RR.......o....x..x
17 .............>>2222<<............. ........o.......RR................
18 ...............2222............... ...........!...+..o...............
19 ................^^................ x..x..........................x..x
20 ....~~~~~~~~~~..^^..~~~~~~~~~~.... ..................................
21 ....~~~~~~~~~~......~~~~~~~~~~.... ..................................
22 ............~~......~~............ ..................!...............
23 ............~~......~~............ ..................................
24 :::.........~~......~~.........::: ..................................
25 :::....##...~~......~~...##....::: .................o................
26 .......##...~~......~~...##....... ..................................
27 ............~~......~~............ ..................................
28 ............~~......~~............ .....o......................o.....
29 ............~~......~~............ ..................................
30 .................................. ..............x.x..x..............
31 ......::................::........ ..................................
32 ......::................::........ .o..............................o.
33 ......::................::........ x.............x.x..x.............x
obstacles
  lure   4,4 13,13 north-west fire L (4 m) round its corner pier: the corner's crowd burns crossing it
  lure   20,4 29,13 north-east fire L
  lure   4,20 13,29 south-west fire L
  lure   20,20 29,29 south-east fire L
  kite   7,7 8,8 corner pier inside its L: kite round it and the train crosses the fire twice
  kite   25,7 26,8 corner pier inside its L: kite round it and the train crosses the fire twice
  kite   7,25 8,26 corner pier inside its L: kite round it and the train crosses the fire twice
  kite   25,25 26,26 corner pier inside its L: kite round it and the train crosses the fire twice
  choke  14,4 19,13 north corridor (12 m, dry) between two Ls: the crest's main road to the middle
  choke  14,20 19,29 south corridor
  high   13,13 20,20 the refiner's dais (+2 m) where the four corridors meet, a stair to each
props     loot 0.8 blast 0.75 blessing 0.5
waves
  1 0.07 blessed 1
  2 0.08 blessed 1
  3 0.10 blessed 1
  4 0.15 blessed 1
  5 0.60 blessed 1
```

<!-- combat-grids-end -->

## 4. Special templates

| id | Kind | Layout idea | Playable area | Points | Props | Notes |
|---|---|---|---|---|---|---|
| `pg-s-breach-01` The Breach | breach | A 32 m marble court round a broken fountain on a 1.5 m basin; the four damned start at its corners; nothing tall, so every door and its sigil are seen at once | the full 32 × 32 m | 4 `S` (blocks (4,4), (11,4), (4,11), (11,11)) | vases (loot, non-combat drops: 85% nothing, 10% coin, 5% mote): 6 amphorae at chance 1.0 | up to 4 doors; may paint sky windows (`tex-wall-window` variants with sky glass; texture only) |
| `pg-s-pardoner-01` The Pardoner's Stall | pardoner | A 20 m hall of red velvet and gold walled in from the slot, a 4 m passage from each socket; the Pardoner stands behind the indulgence box on a 1.5 m plinth in the middle | 20 × 20 m (cells 6–25) | 5 `pedestals`: four `P` item points at the hall corners, then the `M` map point beside the box | none (a shop: nothing to break among the goods) | a leaf; the plinth carries the `f` (fountain) decor as a stand-in until a `pardoner` decor sprite exists |
| `pg-s-confessional-01` The Confessional | confessional | A 16 m dark chapel walled in from the slot: wood panelling, a grille across the north end with the Advocate behind it, candlelight; the darkest room of the heaven, so the boss gate leaf (tall, gold, a trumpet) shines in it | 16 × 16 m (cells 8–23) | `advocate` at block (7,5) | none (a valley to think in) | exactly 2 doors; one is the boss gate |
| `pg-b-gate-01` The Gate | boss | see bosses.md; the arena is Arena 4 re-cut: a 3 m dais (8 × 8 m, no stairs) 6 m from the Gate, six Judgment pillars in two rows, a 1 m terrace north, a 2 m terrace south, a statue and two fountains on 1.5 m pedestals | 68 × 68 m minus the insets | `boss` at block (5,17) = cell (10,34) (the Gatekeeper's 2 m body fits the dais, checked); 20 `x` for its adds (8 gate + 12 field), 12 `w` aiming anchors | none (bosses.md may add) | `entrySocket` 3 (E-bottom); `gate: { x: 0, yCenter: 34, y0: 8, y1: 60, facing: 'W' }` in template cells; **walls in cells x 0–3, y 0–8 and y 59–67** (the `walls` lines) so the Gate stands on the straight 50-cell face y 9–58 with post cells at y 8 and 59 (M10's geometry) |

### 4.1 Special template grids

Walls that only close a non-combat room's floor in, and the boss's gate-side insets, are exempt from obstacle tags (game.md §4.7 rule 3); the few plinths inside them are tagged anyway.

#### pg-s-breach-01 · The Breach

*1x1, breach.* A 32 m marble court with a broken fountain in the middle; the four damned stand at its corners. Up to four doors, every one a full threshold. Six amphorae to break on the way out (non-combat drops). Its walls may carry painted sky windows (texture only, game.md §3.5), since it rarely has an outer face.

```room
id        pg-s-breach-01
name      The Breach
kind      breach
shape     1x1
weight    1
grid
 0 ......::........ ................
 1 ......::........ .o............o.
 2 ......::........ ................
 3 ................ ...c........c...
 4 ................ ....S......S....
 5 ................ ................
 6 :::...BBBB...::: ......u.....o...
 7 :::...BBBB...::: .......f........
 8 ......BBBB...... ................
 9 ......BBBB...... ...o.....u......
10 ................ ................
11 ................ ....S......S....
12 ................ ...c......RRc...
13 ......::........ ..........RR....
14 ......::........ .o............o.
15 ......::........ ................
obstacles
  kite   6,6 9,9 the broken fountain on its 1.5 m basin: the landmark the four damned stand round (no fight here)
props     loot 1.0
```

#### pg-s-pardoner-01 · The Pardoner's Stall

*1x1, pardoner.* A 20 m hall walled in from the slot, a passage from every socket. Four `P` item pedestals in the hall corners and the `M` map pedestal (appended fifth) beside the Pardoner's plinth in the middle; candelabra and harps, gold and red velvet. A leaf in the generator; every canonical socket is kept, so any placed position fits using a valid orientation. Rotations/mirrors that move an enclosing wall over a fixed physical strip are excluded (§2.2).

```room
id        pg-s-pardoner-01
name      The Pardoner's Stall
kind      pardoner
shape     1x1
weight    1
grid
 0 ######::######## ................
 1 ######::######## ................
 2 ######::######## ................
 3 ###..........### ...c........c...
 4 ###..........### ....P......P....
 5 ###..........### .........M......
 6 :::..........::: ................
 7 :::....BB....::: .......f........
 8 ###....BB....### ....RR..........
 9 ###..........### ....RR....h.....
10 ###..........### ................
11 ###..........### ....P......P....
12 ###..........### ...c........c...
13 ######::######## ................
14 ######::######## ................
15 ######::######## ................
obstacles
  kite   7,7 8,8 the indulgence box on its plinth (1.5 m) the Pardoner stands behind: the room's landmark
```

#### pg-s-confessional-01 · The Confessional

*1x1, confessional.* A 16 m dark chapel walled in from the slot, passages from every socket: dark wood panelling, a confessional grille across the north end with the Advocate behind it (the `advocate` point), low candlelight. Exactly two of its sockets are used (one is the boss gate leaf); the others are wall, but the template keeps all four canonical strips so every two-door assignment fits with a valid orientation. A geometric orientation obstructing a fixed physical strip is excluded (§2.2).

```room
id        pg-s-confessional-01
name      The Confessional
kind      confessional
shape     1x1
weight    1
grid
 0 ######::######## ................
 1 ######::######## ................
 2 ######::######## ................
 3 ######..######## ................
 4 ####........#### ....c......c....
 5 ####........#### .......A........
 6 :::..........::: ................
 7 :::..........::: ................
 8 ####........#### ................
 9 ####........#### .......RR.......
10 ####........#### .......RR.......
11 ####........#### ....c......c....
12 ######..######## ................
13 ######::######## ................
14 ######::######## ................
15 ######::######## ................
```

#### pg-b-gate-01 · The Gate

*2x2, boss.* Arena 4 re-cut to 68 m (bosses.md owns the fight): the Gate on the west wall, inset 9 cells at each end so it stands on a straight 50-cell face; the 3 m dais 6 m from it, six Judgment pillars in two rows, a 1 m terrace north and a 2 m terrace south, a statue and two fountains. The one door is the east-bottom socket (3), opposite the Gate. `gate`: `{ x: 0, yCenter: 34, y0: 8, y1: 60, facing: "W" }` in template cells (the face is rows 9–58, the post cells rows 8 and 59). Its other sockets are wall in the stamped floor.

```room
id        pg-b-gate-01
name      The Gate
kind      boss
shape     2x2
weight    1
entry     3
grid
 0 ..............1111111111111111.... ..................x...............
 1 ..............1111111111111111.... ........x.....................x...
 2 ..............1111111111111111.... ..................................
 3 ..............1111111111111111.... .......w.........................x
 4 ....................^^............ ..................................
 5 .................................. .x............x..........x........
 6 .................................. ...................w..............
 7 .................................. ..................................
 8 .................................. .x.w..........................w...
 9 .................................. ..................................
10 ............#....#....#........... ..................................
11 .................................. .x................................
12 ..........................BB...... ..........................f.......
13 ..........................BB...... ........................w.........
14 .................................. .x................................
15 ...3333........................... ..................................
16 ...3333...B....................... ..........a.....RR................
17 ...3333...B....................... .....K......w...RR.............w..
18 ...3333........................... ..................................
19 .................................. .x................................
20 ..........................BB...... ..........................f.......
21 ..........................BB...... ........................w.........
22 .................................. .x................................
23 ............#....#....#........... ..................................
24 ...............................::: ..................................
25 ...............................::: .x.w..........................w...
26 .................................. ..................................
27 .................................. ...................w..............
28 ....................vv............ .x............x..........x........
29 ....................vv............ ..................................
30 ..............2222222222222222.... .......w.........................x
31 ..............2222222222222222.... ..................................
32 ..............2222222222222222.... ........x.....................x...
33 ..............2222222222222222.... ..................x...............
obstacles
  cover  3,15 6,18 the Gatekeeper's dais (3 m, no stairs): its foot hides a player from Judgment (the lip)
  cover  12,10 12,10 Judgment pillar (near north)
  cover  17,10 17,10 Judgment pillar (mid north)
  cover  22,10 22,10 Judgment pillar (far north)
  cover  12,23 12,23 Judgment pillar (near south)
  cover  17,23 17,23 Judgment pillar (mid south)
  cover  22,23 22,23 Judgment pillar (far south)
  jump   14,0 29,4 north terrace (+1 m): hop up anywhere, the Host takes the stair; the Toll's ring rolls over it
  high   14,28 29,33 the gallery (+2 m) and its stair: above the Toll's ring; its east half lies in the far pillars' shadows
  kite   10,16 10,17 statue plinth (1.5 m): no cover from Judgment
  kite   26,12 27,13 north fountain plinth (1.5 m)
  kite   26,20 27,21 south fountain plinth (1.5 m)
walls     0,0 3,8
walls     0,59 3,67
```

<!-- special-grids-end -->

## 5. The fallback floor

Used when 200 generation attempts fail (game.md §3.3; the historical revision-2 topology prototype never needed it in 10 000 measured seeds, before current orientation/content checks). It is the layout of game.md Appendix A.1 (seed `0x12EBAA83`), with a fixed template per room. This emergency floor always has **11 rooms**, including when the failed seed requested 10; it is the explicit fallback exception to `N`. The floor seed still identifies the run and rolls its rewards/stock; `0x12EBAA83` identifies the authored layout, not a replacement seed.

Room numbers R0–R10 below are rooms of this floor, not milestones.

| Room | Slots | Kind | Band | Template id |
|---|---|---|---|---|
| R0 | (3,3) | breach | — | `pg-s-breach-01` |
| R1 | (4,3) | combat | 1 | `pg-c-1x1-flyers-01` |
| R2 | (3,4)–(3,5) | combat (1×2), bell | 1 | `pg-c-2x1-horde-hazard-01` |
| R3 | (5,2)–(6,3) | combat (2×2) | 2 | `pg-c-2x2-horde-flyers-01` |
| R4 | (2,4) | combat, key room | 2 | `pg-c-1x1-ranged-01` |
| R5 | (3,6) | pardoner | — | `pg-s-pardoner-01` |
| R6 | (5,1) | combat, bell | 3 | `pg-c-1x1-elite-01` |
| R7 | (5,4) | combat, map reliquary | 3 | `pg-c-1x1-hazard-02` |
| R8 | (1,4) | Reliquary | 3 | `pg-c-1x1-ranged-hazard-01` |
| R9 | (4,1) | confessional | — | `pg-s-confessional-01` |
| R10 | (2,0)–(3,1) | boss (door from R9 on its E-bottom socket; gate wall west) | — | `pg-b-gate-01` |

- **Orientations** (fixed, no draw): every room takes the first valid orientation of §3.3 step 12's canonical list that its slot allows: identity for the 1×1 and 2×2 rooms, **90°** for R2 (the 1×2); the boss takes identity, which puts its `entrySocket` 3 (E-bottom) on the door from R9 and its gate on the west, as A.1 requires. R2's shifted physical north/south strips map back to old cells x 0–5 / 62–67, y 16–19, which are flat and feature-free; its other four strips map onto canonical strips. Identity and pure transpose (mirror-x then 270° clockwise) preserve fixed offsets and all distances for every canonical template, guaranteeing a valid shape orientation even when another rotation is excluded.
- **Focuses** match A.1's example column: R1 flyers, R2 horde + hazard, R3 horde + flyers, R4 ranged, R6 elite, R7 hazard, R8 ranged + hazard; no template repeats; every band fits its template's range.
- **Props:** the fallback fills every prop socket whose chance is ≥ 0.75 and none below (no draw); the map reliquary is R7's first `o`. Clear rewards and the Pardoner's stock still come from the seed (game.md §6.4, §6.6).

The 2026-10-13 playtest adds short stairs at the marble hedge ends in the Open Terrace, Skywalk and Courtyard of Clouds. Players could jump onto those ledges from a nearby dais; every such ledge now has a ground route as well. The distant fountain/statue plinths remain inaccessible.

## 6. The new elite

**Requirements:** one readable rule the party can name in a sentence; a **job** for the party (heavens.md's table: what does it make them do?) that differs from the Choristers' and Cherubs'; it reads in a crowd of a thousand by **silhouette and sound** (the report); it enters through a visible spawn ray, never behind the party unseen; every class can handle it, none needs it; it doesn't taunt or silence; at most 2 alive (3 under the Edict of the Host). Drops: a reserved gold halo (6) only while its ordinary room ledger grants one, up to 2 heal motes within the encounter cap, and a 25% item roll (game.md §6); Bell elites never grant halos, and recovery cleanup grants none. TP 60 initial; its HP scales with the party (§1). **States** (game.md §4.11): say which it can be put in (default: all seven) and whether it avoids hazards (it does by default). No new engine technology without saying what it is (heavens.md's cost list).

| id | Name | Role | HP (at 4 players) | Body (r × h) | Speed | TP | Rule (one readable rule) | Telegraph | The party's job | Counters per class | States it can be in | Drops | Silhouette and sound |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| `dominion` (type id 4) | **The Dominion** | elite | **1 500** (solo: one at 600, game.md §4.4) | **0.45 × 3.2 m** (the sim body stays under half a cell like the Chorister's, so it never sticks at corners; drawn 3.4 m tall, `draw` 1) | **3.5 m/s** (slower than the Blessed, so it trails its crowd) | 60 | **"Its mace strikes everything around it, angels too."** | When its target is within **3 m** (horizontally, feet within 1.5 m) it stops and raises the mace: a **1.5 s** area wind-up (game.md §11.2's tier), a gold ring decal of **4.5 m** radius filling from its feet outward, a rising brass swell. At impact the decal flashes white: **40 dmg** to every player within 4.5 m (feet within 1.5 m vertically) and **200 dmg** to every *non-elite ground* enemy in the same ring (Blessed and Choristers burst, heavy). Then **1.0 s** recovery in place; the next wind-up can start 3 s after the impact. It has no other attack. | **Bait its blow into the horde.** Let it walk into the crowd that is chasing you, step out of the ring during the 1.5 s, and its mace bursts 20–40 Blessed for you; stand under it and it hits you for 40. So the party decides each time: kill it now (it's loot and a threat) or keep it alive a little and use it. Choristers make the party hide, Cherubs make it look up; the Dominion makes it **move a crowd onto a mark**. | **Fallen:** Blasphemy taunts it (and its 1 s stun cancels a wind-up); the Fallen drags crowd and Dominion together, then leaps out as the ring fills: the mace and the crater on one pile. **Binder:** Chains of Tartarus binds it inside the crowd (bound: rooted, double damage, it still swings where it stands), Discord silences a wind-up that would catch a teammate; Scourge's slow keeps it behind its crowd. **Betrayer:** Shadowstep out of the ring (invulnerable), the revolver over the crowd's heads (it's twice their height), Silver Bullet through the line that leads to it. **Heretic:** Martyr's Shroud on the player it chases absorbs the mace hit; 40 damage only partially depletes a fresh 150-point shield. Its burst occurs only when accepted damage actually exhausts the remaining shield, never merely because the mace hit or the timer expired. Censers on the bound Dominion. Nobody needs it: kited at range it never hits anyone. | all seven: `bound` (rooted, double damage, still slams), `slowed`, `airborne` (the launch cancels a wind-up), `taunted`, `censed`, `silenced` (the slam is a cast: silence and Blasphemy's stun cancel it, as for every cast), `pooled`. It **avoids** Refiner's Fire (§7) in its pathing; knockback, pulls and launches can still put it in. | budget-reserved gold halo (6; none in a Bell), up to 2 heal motes within the encounter's remaining cap, 25% an item | **Silhouette:** twice a Blessed's height, broad-shouldered, wings folded down like a cloak (it doesn't fly), a flanged gold mace held upright so its head stands **above every crowd** (~4 m); a dark bronze face plate; a slow, heavy gait. Its spawn ray is the gold ray **1.5 × as wide** (client only). **Sound:** each footstep a deep timpani hit (positional, audible through the crowd at 25 m: you hear where it is), the wind-up a rising brass swell (1.5 s, ends at impact), the impact a thunderclap with a bell-less metal ring. |

**Rules around it** (so the row stays one readable rule):
- **Kills by its mace are world deaths:** `owner=null`, `origin=world`, `inputSlot=null`, `depth=1`. Settle the victim's existing XP and normal type-specific drop entitlement/quota once, including the room halo ledger, without assigning a player final blow. Only actual accepted player damage or owned-state applications in the last 1.5 s earn streak assists (game.md §10); no owner-kill talent/relic, Q/E kill or derived streak-tier proc fires from this world death. An assist cannot invent a killer. Elites never hit elites or boss parts/body. A Cherub actually grounded by Brought Low is an eligible non-elite ground target while its feet satisfy the slam height tolerance; normal hovering Cherubs are not.
- **Placement:** it places on any type-eligible `x`, including a Dominion-only or joint Chorister/Dominion tag; an exclusively Chorister point cannot receive it. Its arrival is signaled by the wide ray plus its first footstep; every elite-focus template requires its eligible elite points visible from the room's center (historical geometry reports in §9, not current executed checks).
- **At most 2 alive** (3 under the Edict of the Host); a wave's elite waits in the queue while the cap is full.
- **Slam geometry and cancellation:** the ring follows the Dominion's accepted feet position during its tell and strikes there once. Test the same **horizontal** 4.5 m radius, 1.5 m feet-height tolerance and geometry LOS for players and eligible ground enemies; walls and closed leaves block it. The LOS segment runs from the Dominion's accepted **body center** (feet +1.6 m) to the victim's accepted body center, following the shared area rule. Do not substitute feet-to-feet rays: those would incorrectly make the +1 m daises immune even though the mace reaches them. An intervening taller solid obstacle can still block the strike; the height tolerance never overrides geometry. A launch, stun, silence, death or cleanup cancels the filling ring immediately, with no strike or reward. A surviving canceled caster enters its 1 s recovery and cannot begin another wind-up until at least 3 s after cancellation (nor while still airborne/stunned/silenced); refreshing a control effect never queues a hidden slam. Being bound alone still permits the visible slam.
- **Bots:** shoot it like any enemy and move out of a filling gold ring (the same rule as the boss's decals).
- **Why these numbers:** 1 500 HP is about 3.5 s of a four-party's single-target fire (≈ 450 dmg/s, game.md §11.2), 8–12 s in practice with the horde around: long enough to be used, short enough to be killed. Solo at 600 HP: 3 s for the Betrayer's revolver, 8.5 s for the Fallen's slug. 40 dmg is a third of the Betrayer's 120 HP and under half of the bargained 84 (no one-shot). 4.5 m in 1.5 s: a player 1 m from it walks out even wading at 55% (the Fallen: 3.3 m/s).
- **Implementation additions:** this is more than a data-only enemy. It needs one enemy type (id 4 of 16), one cast (wind-up, ring check, the same ground decal as the boss telegraphs), one atlas (idle, walk, wind-up, strike, pain, death), 3 sounds. The ring check is one distance test per enemy per slam (at most 3 slams per 3 s), cheap at 1 500 enemies.
- **Cast synchronization:** each accepted wind-up has `(runId, roomId, enemySlot, incarnation, castId, startTick, impactTick, phase)`; `impactTick = startTick +45`, and the cast's center follows that enemy's accepted feet position from the same snapshot tick. Broadcast revisioned `dominionCast` start, strike and cancel records, and include all currently active records (at most three) in `floorSync` and snapshot control metadata. Rejoin draws the remaining tell from the authoritative ticks, never a fresh 1.5 s or an already-canceled decal. Slot reuse, cleanup and accepted cancellation remove the old record; a late record cannot attach to a new enemy incarnation. A repeated strike record plays no second hit or reward. The host alone performs the geometry/height/radius hit check; clients never submit a slam's victims. Bots avoid the same live ring using these accepted deadlines.

The Dominion is the only new ordinary combat enemy in this slice. The authored pool uses Blessed, Choristers, Cherubs and Dominions; no second new ordinary enemy is included.

## 7. The hazard

**Requirements (game.md §4.10):** at least 5× more to enemies than to players; never kills a full-HP player in under 4 s; Blessed, Choristers and elites avoid it but can be displaced into it; a 2 s telegraph if timed, one constant animated cue if permanent; the color language (damage red-orange, slow violet, poison green, slippery pale blue, electric white-yellow) with motion; on only while its room is in combat; applied per cell. **Enemies on it are `pooled`; a slowing hazard also makes them `slowed`** (game.md §4.11), which relics read. Fits the Pearly Gates (e.g. holy fire in gold braziers' channels, or sunlit glass that burns).

| id | Name | Effect on players | Effect on enemies (≥ 5×) | States applied | Telegraph | Color + motion | Enemy pathing | Notes |
|---|---|---|---|---|---|---|---|---|
| `refiners-fire` (hazard id 1) | **Refiner's Fire** | **7 dmg/s** while the feet are on an active cell (applied per tick, 7/30 per tick; no slow, no other effect). The lowest max HP in the game (the Betrayer under the bargain, 84) lasts **12 s** in it; never a one-shot. | **35 dmg/s** (5×) to every ground enemy on an active cell. A Blessed dies after 0.57 s in it: **a 2 m channel singes** in the base 4 m/s straight, continuously grounded crossing model (about 2.5 HP left), while **a 4 m channel kills** a Blessed remaining in contact through that crossing. These are spatial tuning estimates; slower/diagonal travel, tick boundaries and airborne displacement change actual contact time. A Chorister lasts 1.7 s, a Dominion 43 s (both avoid it). Ordinary Cherubs hover 4 m up and do not touch it; a Cherub actually grounded by Brought Low takes fire damage and `pooled` while its feet touch the active channel, then loses that membership on taking off. | `pooled` (game.md §4.11; it doesn't slow, so not `slowed`) | Permanent while the room is in combat, so no timer: **one constant animated cue**, the flames themselves. When the room seals, the coals in the channels flare up to full flame over 1 s with a roar (the same moment the doors close); on the clear they sink back to dull embers (no damage) and stay so. | **Damage red-orange:** tongues of flame licking along the channel, rising embers, a heat shimmer over it (drawn as animated sprites/a scrolling flame shader on the channel cells, not in the lightmap). The channel is sunk 0.5 m with a polished **gold rim** (the risers), so its edge reads by shape too, also in a crowd and colorblind. | **Blessed share the dry route with the other ground enemies** (their ground flow field ignores hazards). **Choristers and Dominions avoid it:** hazard cells are walls in their flow field (at most four additional hazard-free ground fields, one per living-player target slot, computed only while a ground enemy is alive in a room with active hazard cells, clamped to the room and using its cached escape routing and existing rebuild cadence as game.md §14.5) and their step check refuses a hazard cell; a knockback, pull, launch or gust can still put them in, and they then walk out by the shortest way. | **Origin** (lore voice): *"Gold is tried in the fire. The gates' gutters burn with the refiner's fire that tries every soul who comes to them"* (Malachi 3:2–3). **Kills by it use world provenance** (`owner=null`, `origin=world`, `inputSlot=null`, `depth=1`): settle the existing victim XP/type-specific drop entitlement and room quota once. Recent accepted player damage/owned-state applications retain their ordinary streak assist, so a shove or pull can help a streak, but no killer, button kill or damage/kill/derived-streak-tier proc is invented (the world-death contract of §6, game.md §10). **Template rules:** channels are always `~` blocks (sunk 0.5 m, 2 m wide to singe or 4 m wide to kill), never in a strip or the reward spot, and **never close a ring or cut the room without a bridge at least 4 m wide**, so the crowd always has a dry way too (the bridges are the room's chokes). In cleared rooms the embers are cosmetic, so backtracking and the trickle are safe. |

## 8. Props

**Requirements (game.md §4.9):** three families, one silhouette and color each: loot (white/ivory; drops 75% nothing, 10% a coin of 3 halos, 10% a mote, 5% an item; in non-combat rooms 85% / 10% / 5% mote / no item), blast (saturated red with a black stripe; 60 to enemies, 15 to players within 4 m after 0.2 s; chains), blessing (gold; one visible area effect for players within 6 m). Loot and blast props break only from player attacks or prop blasts; blessing props break only from player attacks, never a chained blast. **Props don't block movement**; for rays and areas each is a cylinder of radius 0.5 m and its sprite's height. Plus **the marked reliquary**: a loot prop with a gold cross mark that drops the floor's map (or a gold halo if the map is already revealed). Playtest 5 asked for vases to break: the loot family is the vases. Plus **the bell** (game.md §4.12): gold, hanging over the reward spot after a bell room's clear, rung with F.

| id | Family | Pearly Gates skin | Sprite height | Effect | Numbers | Drop table | Visual | Sound |
|---|---|---|---|---|---|---|---|---|
| `amphora` | loot | **An ivory amphora** with a thin gold rim and two small handles; three painted variants (tall, squat, with a lily relief) chosen by canonical loot-socket index modulo 3, retained through orientation | 1.5 m | Breaks into a drop | Cylinder 0.5 × 1.5 m; any player hit or blast breaks it | 75% nothing, 10% coin (3), 10% mote, 5% item (non-combat rooms: 85% / 10% / 5% mote / no item) | Bursts into ivory shards and a puff of gold dust; a coin or mote pops 0.5 m up from it | A short porcelain crack and the shards' tinkle; a coin adds its own chime |
| `sanctuary-lamp` | blast | **A sanctuary lamp:** a red glass lamp cup in a **black iron band**, on a short gold tripod, a small flame burning inside (the one moving thing on it, so it reads as "fire inside" from far) | 1.1 m | Depletes for 15 s and explodes after 0.2 s: 60 to enemies, 40 to players within 4 m; chains to other lamps in range | 60 / 40 dmg before defenses, 4 m, 0.2 s | — | The glass cracks white for the 0.2 s, then a red-orange fireball ring 0 → 4 m over 0.25 s with a black smoke puff; the bursts it causes are heavy (M12 §4.1) | A glass crack, then a deep *whoomp* (distinct from every weapon) |
| `chalice` | blessing | **A gold chalice** on a white marble stand, filled with green healing liquid and a soft green glow | 1.0 m | **A heal pulse: 30 HP to every living player within 6 m**, then refills over 15 s (heals only; no shield, no buff) | 30 HP, 6 m, instant | — | A green ring sweeping 0 → 6 m over 0.45 s on the floor; healed players show the green heal motes (M8: heals are green) | A clear rising chord (one chime, like Communion's but brighter) |
| `marked-amphora` | marked reliquary | The amphora with a **gold cross inlaid** on its belly and a slow gold glint running over it every 3 s (seen across the room) | 1.0 m | drops the map | As a loot prop | the Chart, or a gold halo (6) | The amphora's burst plus a gold column 2 m tall for 0.5 s; the Chart unrolls in the air and flies to the nearest human | The porcelain crack, then a short parchment rustle and a bright bell-less chime |
| `judgment-bell` | bell | **A gold bell** 1.2 m tall, its mouth 3 m above the reward square's continuous center `(rewardSpot.x +2, rewardSpot.y +2)`, hung from a gold chain that rises about 12 m into a faint vertical shaft of white light and fades into the sky (no ceiling to hang from); it sways slowly | 1.2 m (bell), chain to 15 m | starts the Judgment wave | F within **2.5 m in 3D from the accepted player eye to the visible lower rim**, at the square's supporting floor +3 m, with clear geometry LOS; the point beneath it is not the interaction anchor | — | Swings hard when rung, light pulses down the chain; then it fades out over 1 s (gone for the floor) | A deep bronze toll ringing out over 4 s (heard floor-wide, louder in the room), then the accepted wave-arrival choir cue |

- **Placement rules for the sockets** (all templates follow them): loot amphorae in corners, on galleries and terraces and at the ends of kite loops (a reason to take the long way round, and to come back after the clear); sanctuary lamps where the crowd packs: at stair feet, in chokes and bridge mouths, beside spawn points, and at least 4 m horizontally from every threshold-strip cell center (a lamp at the door would punish the entrance); chalices away from the spawn points, near the middle of the fight, so using one is a dive. Lamps within 4 m of each other are deliberate chains. Lamp strip distance is an explicit pool acceptance criterion in every orientation. Twelve unsafe sockets were relocated in this revision, preserving each template's prop counts and geometry.
- The amphora is also the Breach's vase (non-combat drops). Props don't block movement and enemies never break them (game.md §4.9); their attack-query cylinders remain active until broken.
- **Bell reach:** a grounded eye at floor +1.6 m differs from the lower rim by 1.4 m, so the 2.5 m eye-range admits about **2.07 m horizontal reach** (`sqrt(2.5² −1.4²)`). The prompt, accepted F request and cancellation/retry use that same visible anchor and range; no client grants a wider floor-distance interaction. The four-metre reward square leaves a legal standing/aiming approach beneath the rim on every authored height.

## 9. Content acceptance and historical measurements

The prior revision reported script-derived geometry and composition checks below. Those numbers are retained as historical design data; current boss markers and lifecycle contracts have changed. No executable checks were run in this specification pass. Shipping requires validating the expanded current pool in all orientations; the checkboxes describe acceptance criteria, not a fresh test result.

- [ ] Current expanded/rotated templates must pass game.md §4.7's validation (base floor at `8`, sockets at 12–15 / 48–51, 8 / 12 / 24 spawn points). The old revision reported 24 templates and 0 errors for: strips, reach (no jump-only perches; enemy reach = player reach), spawn counts and their ≥ 6 m from strips, obstacle coverage, hazard shares, reward squares, waves and composition at band 2, prop sums, focus geometry, large decor, the Gatekeeper's footprint.
- [x] The quantities and coverage of §1 are met (table under §3); every 2×2 is horde or hazard and ends in a crest.
- [ ] Every obstacle's purpose must be visible in play. Measured for the ranged rooms: share of the walkable floor hidden from at least half the spawn points (line of sight from 2 m over the point to 1 m over the floor): Choir Loft 41%, Colonnade 38%, Rood Screen 58%, Burning Aisle 40%, Cloister of Hymns 28%. Elite rooms: every `x` visible from the room's center at eye height (8/8, 8/8, 14/14).
- [ ] Every 2×2 must let the crest flow (base-kit target ≥ 1 000 alive at four players) and spawns more than 15 m from the party: from the worst floor spot, 20 (Courtyard), 24 (Field) and 22 (Refiner's Court) unrestricted spawn points are farther than 15 m (≥ 12 needed); the Refiner's Court keeps 24 of its 28 points at its dry corridor mouths so the fire doesn't thin the crest (§10). Tagged special-only points cannot supply this capacity; a spread party still requires the shared safe-arrival fallback.
- [ ] Every 1×1 targets 60–90 s at band 2 for both a solo player and a party of four (estimates in §10; playtest decides). From the worst spot in each 1×1, 5–6 of the 8 points are farther than 10 m.
- [x] Every 1×1/2×1 template's last wave plus 2 elites is a fair bell wave (column in §3): no template's last wave has more than one non-fodder type, so the bell wave never exceeds the two-type palette.

**Per-template measurements** (walkable cells; hazard share; spawn points; the fewest points eligible from any floor spot, > 10 m in a 1×1, > 15 m otherwise):

| Template | Walkable | Hazard | `x` | Eligible from the worst spot |
|---|---|---|---|---|
| `pg-c-1x1-ranged-01` | 976 | — | 8 | 5 |
| `pg-c-1x1-ranged-02` | 944 | — | 8 | 6 |
| `pg-c-1x1-ranged-03` | 968 | — | 8 | 5 |
| `pg-c-1x1-ranged-hazard-01` | 968 | 9.9% | 8 | 5 |
| `pg-c-1x1-flyers-01` | 944 | — | 8 | 6 |
| `pg-c-1x1-flyers-02` | 1024 | — | 8 | 6 |
| `pg-c-1x1-flyers-03` | 1024 | — | 8 | 6 |
| `pg-c-1x1-hazard-flyers-01` | 1008 | 12.7% | 8 | 6 |
| `pg-c-1x1-elite-01` | 992 | — | 8 | 6 |
| `pg-c-1x1-elite-02` | 944 | — | 8 | 6 |
| `pg-c-1x1-hazard-01` | 1000 | 11.2% | 8 | 6 |
| `pg-c-1x1-hazard-02` | 1024 | 10.9% | 8 | 6 |
| `pg-c-2x1-horde-01` | 2144 | — | 13 | 9 |
| `pg-c-2x1-horde-hazard-01` | 2144 | 9.7% | 14 | 11 |
| `pg-c-2x1-ranged-01` | 2144 | — | 14 | 11 |
| `pg-c-2x1-flyers-01` | 2112 | — | 14 | 10 |
| `pg-c-2x1-elite-01` | 2080 | — | 14 | 10 |
| `pg-c-2x2-horde-flyers-01` | 4416 | — | 24 | 20 |
| `pg-c-2x2-horde-elite-01` | 4336 | — | 28 | 24 |
| `pg-c-2x2-hazard-horde-01` | 4560 | 12.6% | 28 | 22 |
| `pg-s-breach-01` | 960 | — | 0 | — |
| `pg-s-pardoner-01` | 480 | — | 0 | — |
| `pg-s-confessional-01` | 384 | — | 0 | — |
| `pg-b-gate-01` | 4424 (historical geometry count) | — | 20 (12 field + 8 gate) | — |

## 10. Playtest-in-head notes

Historical estimate: five rooms walked in the head with a party of four (band 2 unless stated) and a solo player, with the classes' kill rates of M12 §5.8 (four players ≈ 30 Blessed/s doing their jobs, solo 5–9/s), the director of M12 §2.3 (a wave cycle ≈ 23 s at four, the solo breath ≥ 6 s) and game.md §4.6.

1. **The Choir Loft** (ranged 1×1; 100 · 98 + 7 Choristers · 112 + 8). *Four:* wave 1 meets the party at the nave pillars (≈ 15 s). Wave 2's Choristers land mostly on the lofts and open fire at 15–20 m; the Fallen and the Binder hold the floor behind the 4 m pillars while the Betrayer slugs Choristers over the crowd and the Heretic shrouds whoever climbs; the party storms the west loft up its stair (the Blessed come down it: a lamp at its foot). Wave 3 then spawns on the east loft and the south corners (the west points are inside 10 m): the two lofts duel across the 16–22 m gap, which the floor pillars don't block, so the party drops back down. ≈ 80 s. *Solo* (40 · 39 + 3 · 45 + 4): a Betrayer clears it in ≈ 70 s, a Heretic in ≈ 90 s (the lofts' Choristers need censers lobbed up). *Kept:* the loft duel is the room's point; the pillars hide 41% of the floor from most points.
2. **The Sunken Well** (flyers 1×1, band 3; 115 · 121 + 10 Cherubs · 129 + 14). The first draft said "drop into the well to shed the crowd", but Blessed drop any height, so they follow from every side and the party is trapped with them (players can't jump 2 m either). **Fixed** in the idea text: hold the rim; the crowd's shortest way crosses the well and comes up the four stairs at the party's feet (chokes for the shotgun, the Scourge and the two lamps), and Cherubs over the well hover at the rim's eye level, easy revolver and Chain Gun targets. *Four* ≈ 75 s, *solo* ≈ 80 s.
3. **The Processional** (horde + hazard 2×1, band 1, the fallback's bell room R2; 89 · 149 · 167 · 190 Blessed). With fire at 40 dmg/s, a Blessed crossing a 2 m line died exactly at its far edge (a knife-edge on tick timing), every aisle crowd died in the fire without a shot, and the room cleared in ≈ 55 s at four: too fast, and no AoE fun. **Fixed:** Refiner's Fire is 35 / 7 dmg/s, so **2 m channels singe** (out at 2.5 HP: any pellet, incense pulse or Scourge bursts it) and **4 m channels kill**; templates use 2 m lines where the fire should help and 4 m where it should stop (the moat, the Burning Aisle, the Refiner's Court). Now *four* ≈ 95 s (the bridges pack into chokes; the singed crowd bursts to anything), *solo* ≈ 95 s (game.md A.2's 95 s). Its bell wave (238 Blessed + 2 Dominions at four; solo one at 80% HP): the Dominions avoid the fire and take the bridges, so baiting their maces at a bridge mouth full of singed Blessed is the moment.
4. **The Field of the Host** (horde + elite 2×2; 140 · 100 + D · 140 + D · 240 + D · crest 1 200). *Four:* waves 1–4 take ≈ 100 s with the director's gaps; each Dominion is led through the ring of standards into a gate's crowd. The **crest**: the party stands among the standards, every one of the 28 points is 19–48 m away, 1 200 Blessed are placed in 6 s (28 × 20 per second of capacity against the 200 needed), first contact after ≈ 4.8 s, ≈ 30 kills before the 6 s mark: **≈ 1 170–1 260 alive**. Holding one gate mouth fails within seconds: three other gates and the corners flank it. ≈ 2:30 in all. *Solo* (56 · 40 + D at 600 HP · 56 + D · 96 + D · 480): ≈ 2:55, at the top of the 2×2 target. The **Refiner's Court** failed this check in its first draft: 20 of its 32 points stood behind the fire Ls, so about 60% of the crest's first half burned before the 6 s mark (≈ 830 alive). **Fixed:** 24 of its 28 points stand at the dry corridor mouths; ≈ 1 050–1 150 alive.
5. **The Two Lampstands** (elite 1×1, band 3, the fallback's bell room R6; 115 · 101 + D · 124 + D). The first draft's 4 × 12 m pylons hid two spawn points from the middle (a Dominion could land unseen). **Fixed:** 2 × 8 m pylons, all 8 points in view. *Four:* each Dominion (1 500 HP) lives 8–12 s, usually long enough for one or two maces into the crowd chasing the Fallen round a pylon; ≈ 75 s. *Solo* (46 · 41 + D at 600 HP · 50 + D): ≈ 80 s; the Fallen is the slow case (8.5 s of slugs per Dominion), with room to kite: the Dominion starts its tell within 3 m and hits the visible 4.5 m ring, so retreat beyond that ring. Under the Edict of the Host, its Bell takes only the final wave's Blessed mix: 460 ×0.40 =184 Blessed plus exactly three external Dominions at four players (two Bell elites plus one Edict elite). The template's original final-wave Dominion is not added again. Solo scaling gives 74 Blessed and two Dominions at 900 HP each: ceil(3 ×0.4)=2, with each elite carrying 1,500 ×(3 ×0.4)/2 HP. This is a demanding optional wave in 32 m; its 1.5-second mace tells and figure-of-eight routes give a concrete answer. Peak threat and duration still need observed play; no claim that this is proven the hardest or fair at every formation.

**Other fixes made while walking:** the Colonnade's and the Burning Aisle's 2 m pillars hid only 16% of the floor from the Choristers; they became 4 m piers (now 38% and 40%). Feature placements that fell in a strip (a vase in the Ziggurat, one in the Field of the Host) moved out. The Courtyard's corner-ledge stair pointed the wrong way (the converter rejects a stair that doesn't rise toward its high end, so every stair is checked).

**Does each room feel different?** The 1×1 rooms each ask one question: where the choir is (two lofts, four corners, behind a screen, across fire), where the sky is (an open terrace, an eye-level well, a summit), how to loop (pylons, a fountain), and where the fire is (lines, kilns, a moat). The 2×1s are a basin, an aisled nave, a galleried cloister, a skywalk and a slalom hall; the 2×2s a terrace behind stair gaps, a parade ground of gates, and fire corners with dry corridors. No two share a layout idea.

**Contracts settled by this revision:**
- Shared spawn markers serve all enemy types; ranged templates attach the explicit spawn affinity of §2.3 over those same points. Boss markers additionally have deterministic gate/field partitions and Watcher points. No new marker type is needed.
- Environmental and Dominion kills receive the core wave XP ledger and eligible drop/streak rules without assigning an invented human killer. Dry navigation and forced hazard entry/exit are specified in §2.2 and §7.
- Every off-base geometry cell must be covered by at least one obstacle rectangle; the coverage is per cell, not merely one rectangle touching the connected group. Decorative plinths retain their explicit tags.
- The crest is the measured reference encounter target described in §2.2; upgraded builds and intentional hazard lures can legitimately clear it below 1,000 alive.
- All templates retain a valid reward square; for the boss it places the Stair. Boss spawn markers and aiming points are explicit exceptions to non-combat-template marker rules.

### 10.1 Current manual run audit

These are specification walkthroughs, not executable tests or evidence of measured fun.

| Route or failure | Contract followed |
|---|---|
| Fresh solo, follow Rite preview then key/Reliquary | A new ability changes the next room; the key remains a party progression object; the normal chest choice is retained on death/return. No room or boss needs a specific class. |
| Speed route, skip empty-frame branches | Cleared neighbors permit forward movement; unopened rooms cannot be crossed before seal. Sundial eligibility is the core run clock; the boss phase2 aiming beat remains present despite a strong early build. |
| Full clear with both optional Bells | Each Bell is an additional wave, one Rite offer per human, no repeat clear heal/XP/halo budget. Canceling a Bell countdown wastes nothing; accepting its seal consumes it once. Broken loot props and original encounter quotas stay spent; lamp/chalice recharge deadlines continue unchanged; the one Bell encounter has its own bounded mote quota. |
| Host Edict in band1 Fountain Court | Original wave2 has 119 TP: 59 Blessed plus one 60 TP Dominion before rounding. The Edict adds an external 60 TP Dominion; it cannot produce negative fodder. Party scaling applies to the full elite group. |
| Four humans spread to every quadrant before crest | Single-position eligibility counts do not prove group eligibility. Safe warning/fallback may extend arrival; no point spawns inside a player and no fake minimum-alive counter suppresses damage. |
| A lure kills the crest in Refiner's Court | Environmental kills use the same reward ledger; smaller peak is earned strategy. Dry corridors still admit enough enemies for the reference base-kit horde. |
| Player leaves during countdown or combat | Countdown quorum uses current humans; combat budget stays sealed. A departing key carrier drops the party key. Existing queues and drops remain host-owned, without replaying rewards. |
| One final enemy or pending arrival cannot reach the survivors | Bounded host recovery preserves count/HP where relocated. Final recovery removal settles unused room XP once, without kill/proc/streak/drop credit; pending arrivals cannot make a room wait forever. |
| Players stand on every safe authored arrival marker | After two seconds the core searches dry reachable free floor, gives its one-second beam and revalidates distance/body clearance; it relocates a queued arrival, without adding enemies or rewarding non-arrivals. |
| A hazard avoider pursues someone standing in fire | Reachable dry chase anchor, real-player aim/range and shortest escape routing prevent a dead flow target or false recovery teleport. |
| Chorister-only, Dominion-only and joint tags beside a horde lane | Type filtering precedes preference/proximity; Blessed and Cherubs retain their unrestricted capacity and can never borrow a restricted marker. Current authored points remain untagged. |
| A Dominion kills a recently slowed Chorister in Refiner's Fire | One world death settles that victim's existing XP/drop ledger; recent player damage or owned-state assists can count, but no player final blow or kill/tier proc is fabricated. The later hazard tick cannot kill or pay the same incarnation twice. |
| Brought Low grounds a Cherub in a channel beside a Dominion | Actual feet contact determines fire/pooled membership and the mace's height/LOS eligibility; taking off restores ordinary floor immunity. |
| Hop onto a 1 m dais beside the chasing crowd | The crowd cannot step directly up a 1 m edge, but Blessed melee still reaches an edge-standing player; move inward beyond its horizontal strike range or continue to another route. The longer Dominion ring remains a threat. |
| A Dominion swings beside the +1 m Hall dais | Horizontal ring range and feet tolerance admit the target; body-center LOS clears the low ledge when exposed. Floor-to-floor LOS is not substituted to create immunity; a genuinely intervening tall obstacle still blocks the blow. |
| Stand 2.4 m horizontally from the point under a cleared-room Bell | With the normal +1.6 m eye, the lower rim is about 2.78 m away in 3D: no prompt/accepted ring yet. Move to about 2.07 m horizontal distance or closer and aim at the visible lower rim; its hanging height never makes F impossible. |
| Mirror the Ziggurat or the Gate's reward square | Transform the occupied 4×4 rect and retain its minimum x/y as rewardSpot. Ziggurat `(14,14)–(17,17)` remains that rect under x-mirror; raw `(17,14)` cannot anchor a new 17–20 square crossing its summit edge. Gate square 32–35 keeps continuous center `(34,34)`, instead of moving the Bell/Stair three metres. |
| Purpose rectangle spans a flat threshold beside the Field's tower | Semantic purpose coverage creates no physical obstacle; the threshold's actual cells remain flat, dry and empty. |
| Boss dies while players have pending rewards | Victory latches, damaging effects and trickles stop, shops appear beside the Stair and accepted claims settle once under core exit rules. |
| Rotated rectangular room or enclosed valley | Transform content and logical side/slot identity separately; accept only orientations whose fixed physical strips and associated spawn/prop distances remain legal. Pure transpose guarantees rectangular compatibility without carving new corridors. |
| Party takes the Choir Loft or camps its terrace spawn points | Choristers prefer the explicit raised-marker profile when safe; blocked preferred markers immediately fall back. Taking the high ground changes pressure rather than pausing a queued wave. |
| Rejoin while a Dominion's mace ring is filling | Incarnation/cast identity and accepted start/impact ticks reproduce the remaining tell; no invisible strike or reset warning. |
| Return to an unused Bell after boss death | No new countdown or reward encounter may start after victory. Earned claims, shops and props remain usable during the bounded Stair valley. |
