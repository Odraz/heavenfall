# Codebase audit for the Isaac-style roguelite redesign

Date: 2026-10-10, branch `m12` at 066bce6. Input: [docs/rogue/brief.md](../../docs/rogue/brief.md).
Scope: what the redesign can reuse, what must change, hard technical limits. Read-only audit; no code was changed.

**Sources of numbers.** "Doc" = recorded in `docs/` (bench.md, decisions.md, specs). "Measured" = timed by this audit with a throwaway script (in the session scratchpad, not the repo) that bundled the real `src/` modules with rolldown and ran them in Node 22 on the dev laptop: single cold runs, so treat them as ±30% (the laptop drifts, see memory *Benchmark drift*). "Guess" = my inference, not verified.

The synthetic maps used for the measurements are Isaac-like grids built with the real `GridBuilder`: `cols × rows` room slots of `slot` cells sharing 1-cell walls, `n` rooms joined in a random tree with 3-cell doors in the shared walls, each room an arena with 6 `x` cells, a pillar and a 1 m terrace with stairs, the start slot a Lobby with the 4 `S` cells. Both such maps passed `validateLevel` with 0 errors and showed 0 line-of-sight leaks between zones (see §1.6).

---

## 0. Summary (TL;DR)

- **Everything level-dependent is already computed at runtime, deterministically, from the two ASCII grids.** Wall heights, zones, open edges (the "views"), lightmap, shadow lines, relief, arches, the clouds and spires: all of it is built when the map loads, on the host and on every client, from `DungeonDef` alone. The `*.gen.ts` files are image measurements (sky colors, the arch outline, the window outline, the gate's pixel sizes). They aren't per level. **Nothing has to move from build time to runtime.**
- **A generated map just has to produce a valid `DungeonDef`** (two string grids plus arena records). `GridBuilder` already is a stamping API. A prefab-room stamper on a grid of slots is a small job. Measured: 20–40 generated rooms at 255 × 171 cells build their full terrain in **0.33–0.89 s** in Node, and `validateLevel` takes **36 ms**.
- **The zone rule ("never see into another arena") comes from `computeHeights` by construction:** a wall gets taller than every zone next to it, and open edges facing another zone become walls. On a generated grid with shared 1-cell walls the coarse LOS check found 0 leaks. Views survive only on faces that look out at void with no other zone in front of them within 150 m, which matches Tomas's "only the outermost walls" by itself.
- **The hard part isn't the geometry. It's the arena lifecycle, which assumes a linear dungeon:** arenas are entered in index order (`sim.ts:976`). Clients derive every door from one `arenaIndex` + `arenaPhase` in the snapshot (`map.ts:194`, `game.ts:1136`). Each door belongs to exactly one arena. There's one boss, and the boss ending the game is the only victory. All of this must become a per-room state machine with a per-room phase array in the snapshot.
- **Hard caps:** `MAX_MAP_SIZE` 256 cells per side (`constants.ts:13`, `map.ts:71`). `eArena` is an `Int8Array`, so at most 127 arenas (`sim.ts:516`). `arenaIndex` is a u8 in the snapshot (`protocol.ts:182`). Positions are u16 at 1/64 m, so at most 1 024 m (`protocol.ts:70`). Floor heights run 0–8.75 m in 0.25 m steps (36 characters). There are no ceilings, roofs, bridges or overlapping floors anywhere: sim, LOS and lightmap are all one heightfield.
- **Performance trap found:** flow fields are whole-map Dijkstra, 2 per living player, recomputed every 0.25 s (`sim.ts:1150`). In a sealed room they cost 0.0–0.2 ms. With doors open across a 40-room map, 3.5 ms each, which pushed the measured tick from about 2.7 to about 5.4 ms with 1 500 Blessed. Backtracking with open doors needs room-limited fields.
- **Classes and abilities are hand-coded** (`switch (p.classId)` in `useQ`/`useE`, `sim.ts:2074–2185`; module constants in `data/weapons.ts`). Names, cooldowns and icons are data. Talents, relics and items need a per-player modifier layer first.
- **Nothing exists for pickups, drops, breakables, hazard floors, currency, XP, inventory, a minimap or a save profile.** localStorage holds only the name, volumes, screen shake and the last loading card.
- **Netcode shares the map by `dungeonId` only**, since the maps are bundled code (`messages.ts` `start`, `main.ts:80`). A generated map can be shared by seed + floor number: the generator must be pure and seeded (`mulberry32` in `sim/rng.ts`), and the build version handshake already pins the generator version.

---

## 1. Map / dungeon format

### 1.1 How a dungeon is defined

- `DungeonDef` (`src/data/dungeons/types.ts:42-54`): `id`, `name`, `heights: string[]`, `markers: string[]` (one character per **1 m cell**), `arenas: ArenaDef[]`, optional `decor` (marker character → `DecorId`) and optional `gate` (the Heavenly Gate wall).
- **Height layer** (MVP §8.1, `map.ts` `heightIndex`): `#` is a wall; `0–9a–z` is floor at index × 0.25 m (`HEIGHT_STEP`, `constants.ts:12`), so **0 to 8.75 m**. A cell has no other property: no material, hazard or friction.
- **Marker layer:** `.` nothing, `S` player spawn (exactly 4, `map.ts:121`, `:130`), `D` door cell, `x` enemy spawn point, `B` Gatekeeper (at most 1). Any other character is a decor key. Reserved characters: `.SDxB` (`map.ts:55`). **One marker per cell**, so a cell can't be both a spawn point and a decoration.
- `ArenaDef` (`types.ts:14-28`): `rect` (inclusive cell bounds), `doors` (the D cells it's entered by), optional `exitDoors` (toward the next arena), `entryCells` (exactly 4, one per player index), `waves: WaveDef[]` (values for 4 players), `boss: boolean`. `WaveDef` (`types.ts:3-12`) holds `blessed`/`choristers`/`cherubs` counts plus an optional `squad` placed only on its own cells.
- **Zones** (M10 §3.1; `heights.ts:104-129`): each arena's floor cells inside its `rect` are one zone, door cells belong to their arena's zone, and every other floor area (the Lobby, corridors) gets its own zone by 4-connected flood. Arenas are zones `0..arenas.length-1`.
- **Wall heights per cell** are computed, not authored (`computeHeights`, `heights.ts:97`):
  - `HEADROOM` = 5.3 m (`heights.ts:24`; the Cherub's top + 0.5 m).
  - Zone top = the zone's highest floor + `HEADROOM`.
  - A wall = the highest zone top next to it + `CROWN` 0.5 m, and at least `WALL_MIN` 8 m above its floors (`heights.ts:149-153`).
  - Then evened out per straight run, per pillar group and per arcade run (`heights.ts:303-366`).
  - Cell kinds: floor, wall, pillar (a wall group not touching the border), open edge, void (a wall with no floor neighbor: not drawn, LOS passes), door (`heights.ts:12-17`, `:155-188`).
  - Cap: `WALL_TOP` 16 m (`constants.ts:11`), enforced by validation.
- **Open edges** ("views" onto the sky, drawn as arcades with balustrades; `heights.ts:190-243`):
  - Candidates are wall cells next to floor of exactly one zone.
  - Two candidates of different zones that face each other within `FACING_RANGE` 150 m (`heights.ts:42`) both become walls.
  - Bays are 4-cell segments aligned to the world's 4 m grid (`BAY_CELLS`, `heights.ts:44`).
  - In the sim an open edge is a parapet 1.4 m above its bay's base (`PARAPET`, `heights.ts:40`).
- **Doors** (`map.ts:170-195`):
  - `setArenaDoors` flips the `solid` and `top` cells.
  - `doorsClosed(phase)`: the entry door is closed only in combat; the exit door is closed until the arena is cleared.
  - Each D cell must be in **exactly one** arena's `doors`/`exitDoors` (`map.ts:132-143`).
- **Decor** (`src/data/decor.ts`): 6 IDs, drawn only as billboards from the world atlas; the sim ignores them (MVP §8.1). Large ones (angel statue, fountain) must stand on unreachable pedestals.
- **Spawn points:** the `x` cells inside an arena's rect (`map.ts:146-148`). Squad points come from `WaveDef.squad.at`.
- **Builder:** `GridBuilder` (`build.ts:14`): `fillRect`, `pillar`, `stairs` (up to 0.5 m per step), `marker`, `build()`. Pearly Gates is about 110 lines of these calls on a 127 × 101 grid (`pearly-gates.ts:8-117`).

### 1.2 The "never see into another arena" rule

- The rule (M10 §3.1): with all doors closed, no straight line from one zone's space (floor up to its zone top) reaches another zone's space. Walls taller than every neighboring zone top guarantee it. The only leak path is open edges, and the facing-pairs rule closes those (M10 §3.3).
- It's verified by a unit test, not at runtime: `heights.test.ts:197-217` samples every 2 cells at the floor and at the zone top and tests all pairs. That's O(N²) and offline.
- **What changes for the redesign:** nothing structural. A generated layout inherits the rule from `computeHeights`.
  - Interior walls between adjacent rooms touch two zones, so they're never open edges.
  - In concave corners of the layout, open edges facing another room within 150 m are closed automatically.
  - "Windows only on the outermost faces" (brief image 1) is mostly what the rule already gives.
  - **Guess:** a stricter, explicit rule ("open edges only on the layout's outer boundary faces") would be safer than trusting the 150 m heuristic per seed. The M10 spec itself says "the unit test is the judge" (M10 §3.3).
- The painted "windows" (`L_WINDOW` band and the glass recesses in `relief.ts`) are **not openings**, just texture plus recessed geometry. Only arcades show the outside.

### 1.3 How it's built into geometry

- `loadMap` (`map.ts:65`) parses the grids and calls `computeHeights` (`map.ts:162`). It runs **3 times per client session**: on the main thread (`main.ts:80`), in the host worker (`sim.ts:649`) and in each client's own main thread. It's deterministic ("the same way on the host and every client", `heights.ts:3-4`).
- `buildTerrain` (`terrain.ts:143`): **one merged mesh for the whole level** (floors, risers, walls, cliffs, relief, arch stone), plus one cut-out mesh for the arcades' painted faces, one alpha-restore pass, an optional gate mesh, and one small mesh per arena for each closed door set, hidden until closed (`terrain.ts:323-349`).
  - No per-room meshes and no culling below the whole-level bounding sphere. The whole level is drawn every frame (guess: fine up to roughly 150 k triangles).
- Other per-level work, all at load time, all deterministic:
  - Floor looks (runners, medallions at arena centers; `looks.ts:88`).
  - Window and pilaster segments on the world's 4 m grid (`looks.ts:204`).
  - Relief (`relief.ts:101`) and arches (`arches.ts:89`).
  - Atmosphere cards seeded by `hash(map.id)` (`atmosphere.ts:114-118`).

### 1.4 What `validate.ts` checks (offline, in unit tests)

`validateLevel` (`validate.ts:43`), MVP §8.1:
- Enemy reach (0.5 m step) equals player reach (1.0 m jump), so there are no jump-only perches (`:50-56`).
- Every arena:
  - its entry cells and `x` cells are enemy-reachable;
  - it has at least 6 `x` cells and exactly 4 distinct, non-door entry cells inside its rect;
  - its rect overlaps no other arena's, and no `S` cell is inside it;
  - it's **sealed**: with doors closed, no floor cell in the rect touches floor outside it (`:61-100`).
- Every `x` cell is in some arena (`:102-104`).
- The grid's border is all wall (`:106-113`).
- Boss: a `B` cell exists exactly when there's a boss arena, and **only the last arena can be the boss**. `B` is unreachable and inside the boss rect, and the Gatekeeper's footprint is flat floor (`:115-135`).
- No wall is above `WALL_TOP` (`:138-140`).
- Large decor isn't player-reachable (`:143-145`).

Measured: 29 ms on the Pearly Gates and 36 ms on a 40-room generated map. **Cheap enough to run on every generated floor at load**, with a reroll on failure.

### 1.5 Current sizes and counts

| Thing | Value | Source |
|---|---|---|
| Cell | 1 m × 1 m; floor heights in 0.25 m steps, 0–8.75 m | MVP §8.1, `constants.ts:12` |
| Pearly Gates grid | 127 × 101 cells, 4 arenas + Lobby + 3 corridors | `pearly-gates.ts:8` |
| Arena 1 (Courtyard of Clouds) | rect x 24–63, y 2–41 = **40 × 40 m** (1 600 cells); a 2 m terrace 12 × 12 with 4 stairs; a 1 m ledge; 8 `x` cells | `pearly-gates.ts:27-46` |
| Arena 1 waves (4 players) | Blessed 150 · 200 · 250 · 300, plus Cherub squads 6 and 10 in waves 3–4 = **916**. Solo ×0.4 (rounded up) ≈ 367 | `pearly-gates.ts:135-141`, `sim.ts:114`, `:135` |
| Arena 2 / 3 / boss | 45 × 40 m: 1 160 + squads · 50 × 40 m: 1 905 · 60 × 50 m: 20 + Gatekeeper + summons of 150 Blessed and 10 Cherubs every 30 s | `pearly-gates.ts`, M12 §2.1 |
| Peak alive | at most the largest wave + the leftovers of the previous one: **980** in the Cloister at 4 players | M12 §10 |
| Sandbox | 48 × 48, one 30 × 44 arena, one wave of 1 000 / 20 / 20 | `sandbox.ts` |
| Party scaling | ×0.4 / 0.6 / 0.8 / 1.0 for 1–4 players; boss HP ×0.3 solo | `sim.ts:114-138` |

### 1.6 How hard is runtime generation from prefab rooms on a grid?

**Easy for the data and geometry. Medium-hard for the rules that assume a line of arenas.**

- **Stamping:** a prefab room can be a small height + marker grid, or a `GridBuilder` script, with door sockets at fixed offsets. The generator copies it into a big `GridBuilder` at slot (sx, sy) and emits an `ArenaDef` per room.
  - 1×1, 2×1, 1×2 and 2×2 rooms are rect arenas.
  - **L-shaped rooms break `rect`:** an arena is one axis-aligned rectangle (`insideRect`, `map.ts:213`), used by zone assignment, the seal check, the spawn-point filter, the countdown "everyone inside" test and floor looks. An L needs a list of rects, or a cell mask per arena.
- **Size cap:** at most 256 cells per side (`MAX_MAP_SIZE`).
  - A full Isaac 13 × 9 slot grid fits only with **19-cell slots** (13 × 19 + 1 = 248), i.e. 1×1 rooms of about 17 × 17 m inside and 2×2 rooms of about 36 × 36 m (Arena 1 is 40 × 40).
  - With 28-cell slots, about 9 × 6 slots fit (255 × 171).
  - Raising the cap is a constant plus the loader check. The next real limits are u16 positions at 1/64 m (1 024 m) and the lightmap texture: 4 texels/m × 1 024 m = 4 096 px, the usual WebGL texture-size limit.
  - **Guess:** crop the bounding box to the slots actually used; a floor of 10–20 rooms rarely spans the whole 13 × 9 grid.
- **Shared 1-cell walls work.**
  - A door in the shared wall must be owned by exactly one arena (the loader's rule), but the lifecycle needs it closed when **either** neighbor is in combat. That's new.
  - The generated test maps (doors owned by the child room) passed `validateLevel` and the coarse zone-leak check: Pearly Gates 435 k pairs, 0 leaks, 0.2 s; 19-room grid 1.75 M pairs, 0 leaks, 0.6 s (sampling every 4 cells instead of the test's 2).
- **Art alignment** (inference from the code):
  - Window/pilaster bands alternate per 4 m wall segment aligned to the world grid. A segment cut by a corner or door is plain (`looks.ts:204`).
  - Arcade bays are 4 cells aligned to the world grid (`heights.ts:266-268`).
  - So **room dimensions and slot origins on multiples of 4** keep the walls decorated and the views full; otherwise more plain wall shows.
- **Gate:** `GateDef` is hand-placed and its layout has fixed sizes (posts at ±25 m around `yCenter`), so it needs a straight wall face about 52 m long (`gate.ts:104-140`). Only a large boss room can carry it.
- **Lobby, shop and level-up rooms:** a non-arena floor area is a zone and needs no `ArenaDef`. The exactly-4-`S` rule (`map.ts:130`) fits a single start room.

---

## 2. Rendering costs of a generated map

### 2.1 Precomputation today

- `scripts/cutout.py` writes `sky.gen.ts` (sky size and colors), `arch.gen.ts` (the arch opening polygon), `window.gen.ts` (the glass outline) and `gate.gen.ts` (gate pixel measurements), plus the prepared textures. These depend on the **art**, not the level.
- A new heaven's look means a new texture set and maybe a new `*.gen.ts`. A new map means nothing offline.
- `scripts/blender/*.py` render the character atlases, again per art.
- There's **no offline lightmap and no per-level asset.** The lightmap is "computed once when the level is built" (`lightmap.ts:1-5`, `bakeLightmap` `:92`), at 4 texels/m (`LIGHTMAP_TEXELS`, `lightmap.ts:12`) for floors only, plus per-vertex `shadowZ` lines on sun-facing walls.

### 2.2 Build-time numbers

| Map | loadMap + heights | bakeLightmap | buildTerrain (all, incl. lightmap) | Triangles (terrain + painted) | Source |
|---|---|---|---|---|---|
| Pearly Gates 127 × 101 | 34 ms | 69 ms | 143 ms; 160–350 ms per run in the test runner | ~51 k in view in the bench | Doc: decisions.md:174, :204; bench.md |
| Pearly Gates | 43–48 ms | 188–205 ms | 335–384 ms | 42 052 | Measured (cold, laptop slower that session) |
| Grid 9 × 6, slot 28, 20 rooms (255 × 171) | 80–97 ms | 254–283 ms | 493–580 ms | 74 440 | Measured |
| Grid 13 × 9, slot 19, 25 rooms (250 × 174) | 25 ms | 120 ms | 332 ms | 53 276 | Measured |
| Grid 9 × 6, slot 28, 40 rooms | 26 ms | 495 ms | 887 ms | 146 476 | Measured |

- Budgets that held: M10 allowed +300 ms of level build (`m10.md` §2.1) and the gate +50 ms.
- Costs scale with floor area (lightmap texels × shadow rays) and wall-face length (shadow-line bisection per sun-facing vertex).
- **So a floor of 15–25 rooms builds in about 0.3–0.6 s, and 40 rooms in about 0.9 s,** on the main thread. Loading also packs the atlas, loads textures and warms up shaders (`GameScene.warmUp`, `scene.ts:95`), and is undocumented in total.
- **Guess:** a 1–2 s Loading screen per floor is realistic. If a stutter matters, the lightmap and terrain arrays could be built in a worker (they're pure TS apart from the final `BufferGeometry`).

### 2.3 Draw calls and textures

- Bench (bench.md, M10/M12 final rows): **11–12 draw calls** for the scene (terrain 1, painted arches 1, alpha pass 1, sky 1, clouds/spires 1, shafts 1, contact shadows 2, billboards per atlas, …); 31 with the burst bench; **~51 k triangles**; **345–408 MB** estimated GPU texture memory.
- The terrain texture array is 10 layers of 1 024² (≈39 MB with mipmaps; `textures.ts:78`, `looks.ts:10-19`). The gate array is 4 layers of 1 280 × 2 276 (+62 MB, loaded only on maps with a gate). Sky 2 701 × 1 344.
- A generated map adds **no draw calls** (one merged terrain mesh) but adds triangles linearly with rooms. Each arena's closed door columns are separate meshes, visible only while closed (`terrain.ts:349`); with many rooms they'd better be merged (guess).
- **Per-heaven looks** (the brief's "level 1 always golden, ivory, marble") are a texture-array swap at load. The L_ layer layout in `looks.ts` is shared, so a heaven needs the same 10 looks plus its sky. **Guess:** load only the current heaven's set, since GPU memory is already near 400 MB.
- Frame-time costs measured in the arcade view (bench.md M10): contact shadows 0.21 ms, painted arches 0.17 ms, clouds/spires/shafts 0.10 ms. At most 12 light shafts (`atmosphere.ts:16`).

### 2.4 Can rooms be built once per run at load?

Yes. Everything is a pure function of the `DungeonDef`.

- Build per **floor** (one map per heaven level), not per room: the sim, the flow fields, the lightmap and the merged mesh all assume one `GameMap`.
- Moving between floors means a new `Simulation` and a new `Game`/`GameScene`, i.e. a Loading screen, the way the game starts today (`main.ts:96-121`).
- Rebuilding geometry per room at runtime would fight the merged-mesh design and isn't needed.

### 2.5 Roofs (brief: "roofs can exist or not, or partially")

**Nothing supports them.**
- MVP §14 lists ceilings, bridges and overlapping floors as out of scope.
- The sim is a pure heightfield: `top[]` per cell for LOS, `floor[]` for movement.
- Sun shadows are rays against `top[]`.
- M10's rule: scenery not in the sim may stand only where nothing in play is behind it.
- A roof needs:
  - a new "ceiling" layer in LOS (Cherubs hover at 4 m and arrows fly over walls);
  - a lightmap and shadow-line blocker;
  - a sky-occlusion check for the open edges;
  - and it must stay above the zone top (5.3 m over the highest floor).

**High risk:** I'd keep roofs cosmetic only (cornice-level beams above the zone top, like the crowns) or out of scope.

---

## 3. Simulation

### 3.1 Tick and worker

- 30 Hz fixed tick, at most 5 ticks per loop, the backlog discarded (`constants.ts:1-5`, `worker.ts:88-101`).
- The host sim runs in a dedicated Web Worker (`worker.ts`) that also owns the multiplayer lobby (`worker.ts:117-247`).
- The local player gets snapshots every tick, remote clients every 3rd (10 Hz, `worker.ts:18`).
- The main thread (`HostSession`, `hostSession.ts`) only relays.

### 3.2 Flow fields

- `FlowField` (`flowfield.ts:39`): Dijkstra with a bucket queue over the **whole map** (`dist.fill` over w·h, `flowfield.ts:59`), 8 neighbors, no corner cutting, ground steps up to 0.5 m and drops allowed; the air field ignores heights.
- **One ground and one air field per living player**, recomputed every 0.25 s on staggered ticks, and invalidated when doors change (`sim.ts:1145-1172`, `:843-844`). Enemies follow `bestNeighbor` toward their target's field (`sim.ts:2805-2833`).
- Cost scales with the area the flood can reach. Closed doors are solid, so in a sealed arena the flood stops at its walls. Measured per ground field:
  - Pearly Gates 2.0 ms with doors open, 0.2 ms in one sealed arena;
  - 20-room grid 1.7–1.9 ms / 0.1 ms;
  - 40-room grid **3.5 ms** / 0.1 ms.
- **The trap:** with doors open across a big map, 4 players × 2 fields every 7.5 ticks ≈ 1.07 field computes per tick ≈ 3.7 ms per tick on 40 rooms. Measured tick with 1 500 Blessed in room 0 while its doors were open (countdown state):
  - Pearly Gates 2.65 ms;
  - 20 rooms 3.6 ms;
  - 40 rooms 5.4 ms.

  The MVP target is ≤ 8 ms (`perf.test.ts`); the bench sim runs 1.7–4.5 ms (bench.md).
  - Fix options: compute fields only while enemies exist, clamp the flood to the player's room (+ neighbors), or skip air fields with no Cherubs. Guess: easy.
- The separation spatial hash also clears a w·h array twice per tick (`sim.ts:2987-2996`). Cheap, but it grows with map area.

### 3.3 LOS and heights

- `raycastTerrain`/`lineOfSight` (`los.ts:17`, `:75`): a DDA over `map.top` (walls at their computed heights, closed doors, void = −∞). Shared by hitscan, enemy LOS (casters every 0.5 s), the Gatekeeper's Judgment and the client's tracers.
- Heights are computed once per load (§1.1). Doors change only `solid`/`top`.

### 3.4 Enemy cap and performance

- `MAX_LIVING_ENEMIES` 1 500, `ENEMY_SLOTS` 4 096, `PROJECTILE_SLOTS` 1 024, at most 400 projectiles alive, slots reused after 1 s (`constants.ts:21-25`, `sim.ts:323`).
- Bench (docs/bench.md):
  - 59.5–59.96 FPS capped;
  - uncapped frame 7.3–7.9 ms at 1 500 enemies (Iris Xe);
  - sim 1.7–2.4 ms per tick uncapped, 3.5–4.5 ms capped (lower clocks);
  - the M12 burst bench +4.7–5.0% frame time over budget (bench.md, last table).
- Unit test: the sandbox with 1 500 Blessed and 4 players, ≤ 8 ms per tick average (`perf.test.ts`). Measured this session: about 2.3–2.65 ms.
- Snapshot size at the cap: about 15.7 KB, under the 16 000 B part size (MVP §9.4).

### 3.5 The director

- `Director` (`director.ts:52`): pure, host-only, **one per combat arena**, made when the arena seals (`sim.ts:1016-1021`).
- It decides only **when** the next wave starts:
  - phases build → peak → relax, from per-player intensity (damage taken, kills within 5 m, decay when not engaged);
  - thresholds 70 / 25, 30% "few left", peak 4 s, relax ≤ 10 s, a solo breath of at least 6 s (`director.ts:25-48`);
  - a cap: no wave while more than the largest wave is alive.
- `isCombatArena` = not the boss, more than 1 wave, not bench (`sim.ts:1031`).
- **Reusable as is per room.** It already takes `waves` and `cap` and nothing map-specific. Room-type pacing (horde rooms vs. elite rooms) can be wave tables plus director constants per room.

### 3.6 Arena lock and unlock today

- **Idle → countdown** (`sim.ts:967-987`): a living player inside an idle arena's rect, with **every earlier arena cleared** (`sim.ts:976`), starts a **60 s countdown**, cut to 5 s when every living player is inside and off the doors (`sim.ts:421-422`).
- **→ combat** (`startArena`, `sim.ts:1000`): doors close, stragglers are teleported to entry cells, the director is created, wave 0 is queued, the boss is placed if `boss`.
- **→ cleared** (`checkArenaClears`, `sim.ts:1098`): all waves started, the queue empty and nothing alive. Doors open, **the living heal to full and the dead respawn** at the entry cells (`sim.ts:1109-1118`). This full heal would undercut heal items and shops; the spec should decide whether to keep it.
- The boss arena never clears. Killing the Gatekeeper ends the **game** with victory (`checkVictory`, `sim.ts:951`).
- **Order is baked in at several points:**
  - the countdown needs every lower-index arena cleared;
  - the snapshot sends one `arenaIndex` (the highest non-idle) and one `arenaPhase` (`sim.ts:702-707`);
  - clients derive every door state from those two (`arenaPhaseOf`, `map.ts:194`; `game.ts:1136-1145`);
  - the bot heads for "the next arena" (MVP §2.5);
  - the music picks a track by arena index (`sounds.ts:237-238`);
  - joining mid-game places by `arenaStatus` (`sim.ts:855-881`).

  **All of this must change** for a non-linear room graph: a per-room phase array in the snapshot (2 bits × N rooms; 40 rooms = 10 bytes), doors keyed by room pair, and the countdown/seal per room.
- Backtracking spawns ("a few basic enemies who cannot leave the room") have no support yet (see §3.8).

### 3.7 How the boss is defined

- The Gatekeeper is enemy type 3 (`enemies.ts`): 29 000 HP, radius 2, height 6, speed 0. It's placed on the map's single `B` cell when the boss arena seals (`placeBoss`, `sim.ts:1065`).
- Behavior is hand-coded in `updateBoss` (`sim.ts:2664-2708`) with module constants (`sim.ts:383-418`): Orb Volley every 4 s (8 orbs), Judgment every 25 s (3 s cast, interrupted by Discord or 1 300 damage), summons every 30 s.
- The boss state lives in scalar fields of `Simulation` (`bossSlot`, `bossCast`, `volleyDue`, …), so **one boss per sim**.
- The snapshot header carries `bossHp`/`bossMaxHp`/`bossCast`/`bossCastProgress` (`protocol.ts` `SnapshotHeader`).
- New bosses need: a boss behavior module (per type, its own state), more cast IDs, and probably a generic "boss parts" entity list for the brief's "blobs to destroy".

### 3.8 How enemies are tied to arenas

- `eArena[slot]` (`Int8Array`, `sim.ts:516`) is only bookkeeping: the arena's alive counts and wave counts (`sim.ts:1418-1426`, `:1441-1446`).
- **Nothing in movement keeps an enemy in its room** except closed doors: enemies spawn only on the arena's `x` cells while it's in combat, and the doors stay closed until nothing is alive.
- Targeting picks the player with the lowest flow-field distance (`retarget`, `sim.ts:2513`), so an enemy in an open room paths anywhere in the map.
- For backtracking enemies that stay in their room, the options are an enemy-only blocking mask on door cells (movement and flow fields), or per-room fields. Guess: the mask is the cheaper option.

### 3.9 Determinism

- `mulberry32` (`rng.ts`) seeds all sim randomness. The seed is per game, random in multiplayer (`worker.ts:229`), or `?seed=` with dev=1.
- The sim is **not lockstep**: clients never run it. Everything visual that must match across clients (heights, looks, atmosphere cards via `hash(map.id)`) is deterministic from the map data.

---

## 4. Netcode

- **Topology:** a PeerJS star, 1 host + up to 3 clients (MVP §9.1). Two DataConnections per client:
  - `ctrl`: reliable JSON for lobby and game events;
  - `snap`: unordered, raw ArrayBuffers for input and snapshots.
  - The host skips snapshot parts to a connection with more than 64 KB buffered (`peerConfig.ts:41`, `hostNet.ts:175`).
- **Input** (`protocol.ts:5-56`): 30 bytes at 30 Hz: `seq`, position, yaw/pitch, `fire` (3 bits), `qPresses`/`ePresses` as wrapping counters, `allyTargetId`, `lastTeleportId`. Movement is client-authoritative with a host speed check and floor check (MVP §9.3).
- **Snapshots** (`protocol.ts:63-70`, `encodeSnapshot` `:155`):
  - header 27 B (tick, part, arenaIndex u8, arenaPhase u8, countdown, enemiesRemaining, boss fields, counts);
  - player 32 B each;
  - enemy 8 B (slot, x/y u16 at 1/64 m, type:4 | state:4, flags);
  - projectile 9 B;
  - parts of at most 16 000 B, reassembled by `SnapshotAssembler` (`protocol.ts:374`).
  - Enemy z isn't sent; clients derive it from the heightfield.
  - The type is 4 bits, so **at most 16 enemy types**. Today 4 are used.
- **Events** (`messages.ts:4-31`): JSON over `ctrl`, e.g. `abilityUsed`, `teleport`, `bursts`, `arenaStarted`/`arenaCleared`, `bossCast`, `gameOver` with stats.
- **Upload target:** at most 437 KB/s with 3 clients (MVP §12).
- **Map sharing:** only the `dungeonId` string travels, in `lobby` and `start` (`messages.ts:57-62`). Every peer runs `loadMap(getDungeon(id))` on bundled code (`main.ts:80`, `worker.ts:104`). `hello` carries `version` and must equal `__BUILD_VERSION__` (package version + git hash, `vite.config.ts`), so all peers run identical code.
- **Joining mid-game:** supported (M8 §6.2).
  - A client joining during a game waits in the in-progress Lobby, sends `enterGame`, gets `start`, loads, `ready` → `go`.
  - `sim.addPlayer` places them by the current arena's state: in combat as a soul on an entry cell, otherwise on the lowest-ID living player (`sim.ts:855-881`).
  - Loading timeout 20 s (`lobby.ts`).
- **Host authority:** enemies, projectiles, damage, abilities, cooldowns, arena state. Movement abilities run on the client first, and the host accepts within 0.25 s of ready (MVP §9.3).
- **What sharing a generated map needs:**
  - Put `{ heaven, floor, seed }` in `start` (and in `lobby` for display).
  - Make the generator a **pure function** of (seed, heaven, floor, room pool) using `mulberry32`, with no `Math.random`, no iteration order of `Map`/`Set` keyed by objects, and no float accumulation that could differ. Node and browsers agree on IEEE doubles, so pure integer and grid logic is safe.
  - The build-version check already pins the generator and room-pool version.
  - Late joiners regenerate from the same seed. The per-room state (cleared, discovered, chest opened, shop stock) must be sent once on join and then as events, because snapshots carry only one arena index today.
  - Guess: a full grid would be about 2 × 43 k characters of JSON. A seed is cleaner and needs no protocol change for size.

---

## 5. Players, classes, abilities

- **Data** (partly data-driven):
  - `CLASSES` (`classes.ts:26-85`): name, role, HP, speed, passive text, hints.
  - `WEAPONS`/`SECONDARIES` (`weapons.ts`): a `WeaponDef` with kind, interval, pellets, damage, spread, range, maxHits, slow.
  - `ABILITIES` (`weapons.ts`, after the attacks): name, description, cooldown, movement flag, allyRange, icon.
  - Many tuning constants are module-level `export const` (`BLASPHEMY_RADIUS`, `CHAINS_*`, `CLOUD_*`, …).
- **Behavior is hard-coded:**
  - `useQ`/`useE` switch on `p.classId` (`sim.ts:2074-2185`), with cooldowns read from `ABILITIES[p.classId]` (`sim.ts:2076`).
  - Attack resolution is `fireWeapon` by `kind`, with special cases (the Fallen's close-range shotgun and knockback, `sim.ts:1783-1848`).
  - Passives are inline: Brimstone Hide ×0.6 in `damagePlayer` (`sim.ts:1531`); Sinful halves the Fallen's targeting distance (`sim.ts:2535`); the Heretic's double revive (`souls.ts` `reviveHit`); the Binder's slow is `slow: 1` in the weapon data.
  - The only rate hook is `fireRate(p)` for the Field of Blood (`sim.ts:1757`).
  - `SimPlayer` (`sim.ts:171-271`) has `speed`, `maxHp` and cooldowns; no stat, modifier or buff list.
- **Movement abilities** run on the client (`game.ts` `pressAbility`, `fallingStarAim.ts`, the Shadowstep in `localPlayer`), so a talent that changes them must change both sides.
- **Effort for the redesign** (guess):
  - **Relics and talents that change numbers** (cooldown −20%, +damage, bigger radius): medium. Introduce a per-player `Stats`/modifier object that `useQ`/`useE`/`fireWeapon`/`damagePlayer` read instead of the constants; HUD tooltips must read it too.
  - **New abilities:** each is a new case plus VFX (`vfx.ts`), sounds and an event. One ability is about the size of a M9/M12 stage.
  - **Swappable ability slots** ("talents introduce new abilities … assigned here"): `ABILITIES` is keyed by class with fixed Q/E. It needs to be keyed by ability ID, with per-player loadouts sent in `start`.
  - **Consumables** (heal, speed, shield, reflect, venom): `heal`, `giveShield`, `slow`, `root`, `stun`, `silence` and `knockback` exist as sim helpers (`sim.ts:1602-1700`). They need an inventory on `SimPlayer`, new input counters, a HUD slot and events.
- The class design rules (classes.md:7-14) constrain all of this: one visible effect per ability, no "press when ready" buffs, healing and shielding kept separate.
- **HUD slots** (`hud.ts:357-380`): exactly two, built from `ABILITIES[classId].Q/.E`, each with an icon, cooldown ring, seconds text and key label; the own frame, a Field of Blood buff icon and the party frames. Adding 2 inventory slots is DOM work in the same style. The memory rules apply (HUD slots never hidden by art; menus that don't move).
- **Keys in use:**
  - WASD, Space (jump), mouse LMB/RMB (`input.ts:76-77`, `:111-125`);
  - Q, E, H (hints), Enter (chat), Escape (pause), F3 (overlay) (`game.ts:566-585`);
  - dev only: K, J, G;
  - **Tab** is reserved by the not-yet-implemented M12 follow-up 2 for the score sheet (docs/m12-followup-2.md §2.2).
  - Free: **1, 2** (inventory), **F** (interact), **M** (map; or Tab, if the score sheet moves), R, C, Z, X, V, Shift, Ctrl, mouse wheel, mouse buttons 4/5.
  - Input carries the mouse buttons in 3 of 8 bits, so new press counters mean `INPUT_BYTES` grows (`protocol.ts:5`); fine, since versions must match.

---

## 6. Pickups, drops, breakables, projectiles, hazards

- **Pickups/drops:** none. There's no currency, item entity, XP or loot.
  - The only "collect" mechanic is souls: a dead player's soul, revived by shooting it (`sim/souls.ts`).
  - The Field of Blood's coins are cosmetic (`game.ts:170-174`).
- **Breakables:** none.
  - Decor is drawn only, ignored by the sim (`decor.ts:1`). "Large" decor sits on pedestals so nobody walks through it.
  - The closest thing is the Chorister's **globe**: a slow projectile players can shoot down. A shot passing near it shatters it (`sim.ts:1867-1925`, M12 follow-up §1.3). The "shoot an object, it reacts" code path (ray tests against non-enemy entities) can be reused for breakable props.
- **Projectiles:** a pooled SoA (struct of arrays) of at most 400 alive (`sim.ts:315-324`, `spawnProjectile` `:2330`, `updateProjectile` `:2370`). Kinds: censer (player), globe (Chorister and Orb Volley), arrow (Cherub), swept against enemies, souls, players and terrain.
  - Censers that reach their range over a **void** cell vanish without a cloud (`sim.ts:2441`, M10 §3.4).
  - Incense clouds are a separate short list (at most 6; `updateClouds`). They're the existing model for a damaging area: a pulse every 0.5 s within a radius.
- **Hazard floors:** none. A floor cell has only a height. Movement (`movement.ts`) has no friction or slipperiness; enemy speed is `speedOf(slot)` with a slow factor.
  - Lava, ice, venom and goo need a new per-cell property layer (markers are one per cell and already used): a third grid or a hazard rect list, read by `LocalPlayer` movement (client-authoritative) and by the sim for enemies and damage.
  - Painted floor looks per hazard mean new texture-array layers.
- **Status effects** that exist on enemies: slow (×0.7), root, stun, silence, taunt, knockback, pull (`sim.ts:1617-1700`; flags in the snapshot, `protocol.ts:75-85`). On players: only shield and invulnerability. A venom DoT on enemies is a new timer (the incense pulse is the pattern).

---

## 7. UI and persistence

- **Screens** (`main.ts`, `debug.ts` `Screen`):
  - title → singleplayerSetup | multiplayer → hostSetup | join → lobby → loading → inGame → results;
  - Pause is an overlay (`ui/pause.ts`) with Settings.
  - DOM over the canvas, built with the `el()`/`button()` helpers (`menus.ts:45-60`).
- **Class select:** class cards (`menus.ts:132`); unique classes in multiplayer, enforced by the lobby (`lobby.ts`).
- **Dungeon picker:** `MENU_DUNGEONS` has only the Pearly Gates, preselected (`menus.ts:21`, `:168-178`). The host picks the dungeon; clients see its name.
- **Results** (`ui/results.ts`): victory/defeat, run time, Kills / Damage / Deaths / Revive assists; Back to lobby in multiplayer.
- **Lobby flow:** `Lobby` (`net/lobby.ts`) with phases lobby → loading → game, in-progress joining, a 20 s load timeout, chat.
- **Persistence** (localStorage, all small):
  - `heavenfall.name` (`menus.ts:17`);
  - `heavenfall.volume.{master,music,sfx}` (`audio/volume.ts:9`);
  - `heavenfall.screenShake` (`shake.ts:23`);
  - `heavenfall.lastCard` (`loading.ts:54`).

  **No save or profile system** for characters, relics or progress, and no export/import. The brief's "save a character, or load it from a file/hash" is new work: localStorage JSON plus an export/import of a base64 string or a file download is easy. Guess: version the format from day one.
- **Settings:** the Master/Music/SFX sliders and a Screen shake toggle, on Title and in Pause (`ui/volume.ts`).
- **Minimap:** none exists.

---

## 8. Audio

- **SFX:** 53 named synth definitions in `SFX` (`audio/sfx.ts:30`), each a parameter set of up to 6 parts (`synth.ts:38-42`), rendered once into an `AudioBuffer` at startup, one per task (`audio.ts:79-89`).
- Playback: `sfx(name, pos, gain, when, priority, rate)` with voice stealing by priority, 24 voices, 4 per sound, ±5% pitch, distance falloff 2–40 m (`audio.ts:13-25`, `:259`).
- **Replacing a synth sound with a sample is designed for:** "Each is a named entry, so a file can replace one later without touching its callers" (`sfx.ts:1-3`). Callers use `SfxName` only, and the engine keeps `buffers: Map<SfxName, AudioBuffer>`.
  - Swapping in a sample means `fetch` + `decodeAudioData` into that map. `MusicPlayer` already does this for the MP3 tracks (`music.ts:7-9`, `:85-87`).
  - Guess: half a day for the mechanism, plus sourcing the sounds. Playtest 5 called the synth SFX annoying.
- **Music:** 7 MP3 tracks (`assets/music`, 23 MB) with loop points (`data/music.ts`), picked per arena index (`sounds.ts:237`). Generated floors need tracks picked by room type instead.

---

## 9. Tests and dev tools

- **Unit tests:** Vitest, `src/**/*.test.ts` (51 files; `vite.config.ts` `test.include`), small hand-written maps plus the shipped ones.
  - Relevant to the redesign: `validate.test.ts` (validation on every shipped map), `heights.test.ts` (zone visibility `:197`, gameplay unchanged inside zones `:220`, Judgment cover `:242`), `lightmap.test.ts`, `arenas.test.ts`, `waves.test.ts`, `director.test.ts`, `perf.test.ts` (≤ 8 ms per tick, skipped on CI), `protocol.test.ts`, `lobby.test.ts`.
  - `src/sim/testutil/` has map, arena and sim helpers.
  - **For a generator:** run `validateLevel` plus a (coarser) zone-leak check over many seeds per room pool in the unit tests.
- **E2E:** Playwright Chromium (`playwright.config.ts`: `testDir: 'e2e'`, the build served on 4173), 7 specs: singleplayer smoke per class, the full solo run (presses K per arena), menus, multiplayer with 4 contexts on the real PeerJS server, controls, painted weapon, levels (Pearly Gates loads every texture).
  - They read `window.__heavenfall` and fail on console errors.
  - The full-run and bot logic assume linear arenas.
- **Dev hooks** (`params.ts`, MVP §2.5):
  - `?dev=1&map=&class=&seed=`;
  - `god=1`;
  - `bot=1` (also `autojoin`, `join`, `name`);
  - `arena=N` (start in arena N with the earlier ones cleared; `params.ts:93-95`, `sim.ts:675-679`);
  - `bench=1` with `view=turn|arcade|gate`, `burst=1`, `hudfire=1`, `class=`;
  - `cam=x,y,z,yaw,pitch`;
  - dev keys G (god), K (kill all), J (kill Blessed);
  - F3 overlay (FPS, sim ms, enemies, net KB/s, director line);
  - `window.__heavenfall` (`debug.ts`) and `window.__heavenfallTeleport(x, y)` with dev=1 (`game.ts:541`).
- **Benchmark harness:**
  - `npm run bench` (`scripts/bench.mjs`: headed Chromium 1920 × 1080, `--uncapped`, `--map`, `--view`, `--runs`, `--cooldown`, `--class`, `--hud-fire`, `--burst`);
  - `scripts/bench-gate.sh` and `scripts/bench-ab.sh` (A/B back to back).
  - The bench tops the first arena (or the boss arena) up to exactly 1 500 Blessed (`sim.ts:1185-1195`).
  - Screenshots: `scripts/views.mjs` with `views.json`.
  - Memory rules: no bench gates inside stages; free port 4173 before e2e.

---

## 10. Risks, cheap reuse paths, numbers

### 10.1 Biggest risks

1. **Linear-arena assumptions everywhere** (§3.6). The countdown needs earlier arenas cleared; one `arenaIndex`/`arenaPhase` in the snapshot; doors derived from it on clients; one owner per door; only the last arena can be the boss; the boss kill ends the game; the bot, music, join placement, the full-run e2e and the HUD's "enemies remaining" all read the current arena. **This is the core refactor.** Plan it as its own stage, with a per-room state array in the snapshot (or events plus a join sync).
2. **Per-floor transitions.** Today a `Simulation` is one dungeon for the whole session, and victory = the boss died. Moving to the next floor needs a new map, a new sim and a new Loading screen for all peers, while carrying player state (HP, items, XP, relics). Nothing carries state today: a new `Simulation` builds fresh players from `SimPlayerInit` (`sim.ts:140-145`).
3. **Flow-field cost on big open maps** (§3.2): several ms per tick with open doors on 40 rooms. Limit the fields to occupied rooms.
4. **Map size caps:** 256 cells per side; 127 arenas (`Int8Array`); u8 `arenaIndex`; 16 enemy types (4-bit type). A 13 × 9 Isaac grid fits only with small (19-cell) slots. Raising the cap is easy up to 1 024 m (u16 positions, a 4 096-texel lightmap).
5. **L-shaped rooms:** an arena is one `rect` throughout (zones, seal check, spawn filter, countdown, floor looks). It needs multi-rect or mask arenas.
6. **Roofs and overhangs:** unsupported by the heightfield sim, LOS and baked light (§2.5). Keep them out or cosmetic.
7. **Zone-rule regressions per seed:** the facing heuristic (150 m) is checked offline only. Mitigate with an "outer faces only" rule for open edges and a coarse runtime leak check (0.2–0.6 s measured) in debug and tests.
8. **Load time per floor:** 0.3–0.9 s of terrain build measured, plus textures and shaders. Acceptable, but on the main thread. Each new heaven adds texture memory (already 345–408 MB GPU).
9. **Hard-coded class logic:** talents and relics need a modifier layer threaded through `useQ`/`useE`/`fireWeapon`/`damagePlayer` and the client-run movement abilities. There's a risk of violating the "one visible effect, no hidden riders" rule.
10. **Small rooms vs. the horde premise:**
    - The spawn rules want points more than 15 m (else 8 m) from every player (`sim.ts:328-330`); a 17 × 17 m room has few or none.
    - At 4 players a wave of 300 needs space; Arena 1 holds 916 enemies over 4 waves in 1 600 m².
    - So **horde rooms must be 2×2-size (about 36–40 m)**, and 1×1 rooms suit elites, ranged enemies and hazards.
11. **The full heal on clear** (`sim.ts:1109`) collides with heal items, shops and HP as a resource.
12. **Per-room music, minimap and room-type visuals** are all new client work with no existing base.

### 10.2 Cheapest reuse paths

- **Generator output = `DungeonDef`.** Stamp prefab rooms with `GridBuilder` into slots and emit an `ArenaDef` per room. `loadMap`, `computeHeights`, the lightmap, terrain, relief, arches, atmosphere and `validateLevel` work unchanged. Measured: valid on the first try for synthetic grids.
- **Sharing:** seed + heaven + floor in the `start` message. The `version` handshake already pins the generator.
- **Room fights:** keep `WaveDef` (+ squads), the director and spawn pacing per room. Per-room-type tuning is data: wave tables, director thresholds, spawn-point layouts in the prefab.
- **Room locking:** keep `setArenaDoors`/`doorsClosed` and the door meshes. Generalize to "a door is closed if either adjacent room is in combat".
- **Area effects:** incense clouds as the template for hazard pools and venom. The globe shoot-down as the template for breakable props. The heal/shield/slow/root/stun/silence helpers for consumables.
- **Sample SFX:** fill `AudioEngine.buffers` from files by `SfxName`.
- **Persistence:** localStorage JSON (there's already the try/catch pattern in `loading.ts:71-87`).
- **The bot and e2e:** the bot's flow-field navigation is reusable; only goal picking is arena-index based.

### 10.3 Concrete numbers

| Item | Value | Source |
|---|---|---|
| Cell | 1 m; floors 0–8.75 m in 0.25 m steps; walls computed, 8 m minimum above their floor, cap 16 m | MVP §8.1, `heights.ts:33`, `constants.ts:11` |
| HEADROOM / CROWN / PARAPET | 5.3 m / 0.5 m / 1.4 m | `heights.ts:24-40` |
| Map limit | 256 × 256 cells; positions up to 1 024 m (u16 at 1/64 m) | `constants.ts:13`, `protocol.ts:70` |
| Pearly Gates | 127 × 101; arenas 40 × 40, 45 × 40, 50 × 40, 60 × 50 m | `pearly-gates.ts` |
| Arena 1 enemies | 916 over 4 waves at 4 players (≈367 solo) | `pearly-gates.ts:135-141` |
| Peak alive | 980 (Cloister, 4 players); global cap 1 500; 4 096 enemy slots; 400 projectiles alive | M12 §10, `constants.ts` |
| Spawning | 10 per s per point; waves arrive over 10 s; points more than 15 m (else 8 m) from players | `sim.ts:328-337` |
| Tick | 30 Hz; snapshots 30 Hz local, 10 Hz remote | `constants.ts:1`, `worker.ts:18` |
| Input | 30 B per input at 30 Hz | `protocol.ts:5` |
| Snapshot | header 27 B, player 32 B, enemy 8 B, projectile 9 B; parts of at most 16 000 B; about 15.7 KB at 1 500 enemies | `protocol.ts:63-68`, MVP §9.4 |
| Upload budget | at most 437 KB/s with 3 clients | MVP §12 |
| Bench | about 59.9 FPS capped; uncapped frame 7.3–7.9 ms; sim 1.7–4.5 ms per tick; 11–12 draw calls; about 51 k triangles; 345–408 MB textures | bench.md |
| Level build (Pearly Gates) | heights 34 ms, lightmap 69 ms, terrain 143 ms (doc); whole build 160–350 ms (doc); 335–384 ms (measured, cold) | decisions.md:174, :204 |
| Level build (generated) | 0.33 s (25 rooms, 19-cell slots), 0.49–0.58 s (20 rooms, 28-cell slots), 0.89 s (40 rooms) | Measured |
| validateLevel | 29 ms (Pearly Gates), 36 ms (40 rooms) | Measured |
| Flow field (ground, one) | 0.0–0.2 ms in a sealed room; 1.7–3.5 ms with doors open on 20–40 rooms | Measured |
| Sim tick, 1 500 Blessed, doors open | 2.65 ms (Pearly Gates) → 3.6 ms (20 rooms) → 5.4 ms (40 rooms) | Measured |
| Load timeout | 20 s per client | `lobby.ts` |
