# M10 follow-up: The Heavenly Gate

The end of the Pearly Gates should feel like the end of the climb. Players fight through three arenas, walk the last corridor and step into the boss arena. The arena's whole west side is gone: in its place stands **the gate of Heaven** from the title painting (`assets/art-src/ui-title-bg.png`):
- two colossal golden gate leaves, 18 m wide, whose arched top rises 32 m above the floor;
- two tall white-and-gold gateposts, each crowned with gold and topped with a spire 50 m high;
- gilded railings on either side whose tops sweep up from the arena's corners to the gateposts, so the whole gate reads as one great arch, with spired posts between their panels.

Behind it all are open sky, banks of cloud and a warm glow of light. Three reactions to aim for:
- *"Wow, it was worth fighting through the level."* The gate is the biggest and most detailed thing in the game. Players see it the moment they enter, and it's too tall to fit on screen without looking up.
- *"Now it gets serious."* The Gatekeeper stands on his dais right in front of the closed leaves, the gate's guard.
- *"We are really storming Heaven's gate."* The fight happens at the foot of the gate, with Heaven visible through its bars.

**A beacon on the way.** The spires, crowns and the top of the leaves rise above the walls. They show in the distance from Arena 1's terrace and the Lobby, so players see the gate looming long before they reach it. This is intended.

**What's built.** The arena's west wall is drawn as ironwork, built **the hybrid way, like the M10 arches**: simple geometry for the shapes (square post shafts, crown boxes, crossed cards for the spires) carrying painted faces for all the ornament. The gate leaves and railing panels are flat ironwork, cut out so the sky shows through; the posts are white and gold with gold crowns and spires. Four images (present), one texture array loaded only on maps with a gate, about 1 200 triangles and 3 draw calls.

**No simulation change.** The west wall stays a wall in the simulation: movement, shots, line of sight and Judgment's cover are unchanged. It's only drawn as open ironwork with the sky behind it. The posts stand behind the wall's face, never in the arena. Nothing changes in movement, enemies, classes or the protocol.

All numbers are **initial values**.

---

## 0. Instructions for the implementing agent

1. **Read this document first, then:**
   - [m10.md](m10.md): §2 (performance), §3.5 (cliffs), §5.2 (light), §5.3 (relief), §6 (arches: the cut-out mesh, alpha-to-coverage, the alpha pass, tracers) and §7.2 (cloud cards);
   - [bench.md](bench.md);
   - the *Heavenly Gate* section of [art-prompts.md](art-prompts.md).

   Where they disagree, this document wins. **Its budgets (§4) replace M10 §2.1's for the gate**; M10's budgets still apply to everything else. Everything else in M10 and the MVP still holds, including the definition of done.
2. **Implement the stages of §6 strictly in order.** For each stage:
   - typecheck, unit tests and end-to-end tests pass;
   - the stage's screenshots go in `screenshots/m10/` with the prefix `gate-`;
   - the performance gate of §4 passes;
   - the work is committed.

   Then start the next stage.
3. **Decisions.** Where this document is silent, choose the simplest option consistent with it, and add a line to `docs/decisions.md`: `M10 gate §<section> — <decision>`.
4. **Git.** Work on the branch you were given. Commit messages start with `M10.8.<stage>:`.
5. **Art.** All four images are in `assets/art-src/` as `.jfif`: `gate-leaves`, `gate-railing`, `gate-post-shaft` and `gate-post-top-2`. (The first post top, `gate-post-top`, has a ghost scene painted over its spire and isn't used.) **Look at them and at the title painting before stage 2**, and compare screenshots against the title painting at the end of stages 2 and 3.
6. **Human checkpoints.**
   - The benchmark needs an active, uncovered desktop. Ask for that before stage 1.
   - The final playtest (§8).
   - Stop and ask if an image fails its check in §2.

---

## 1. Layout

**Coordinates.** Map coordinates: x east, y south (rows), z up. A point (x, y) lies in cell (⌊x⌋, ⌊y⌋).

**The arena.**
- The boss arena (*The Gate*, floor cells x 6–65, y 50–99) has its floor at **F = 4.5 m**. Its zone top is 14 m.
- The Gatekeeper's dais covers x 9–17, y 71–79, at 7.5 m.
- The arena and the dais share the center line **y = 75**. The whole gate is symmetric about it.

**The cells along the west edge** (as `computeHeights` makes them today, and unchanged):
- The cells x = 5, y 49–98 are *Wall* at 14.5 m. So is the north wall, the row y = 49.
- (5, 99) and (5, 100) are open-edge corner cells of the south arcade, drawn solid to 14.5 m.
- (6, 100) and (7, 100) are solid arcade segments drawn to 15.5 m. The south arcade's bays start at x = 8.
- Cells x 0–4 are void.

**The gate's plane is x = 6**, the face of the west wall today. Everything painted stands in it. The posts stand behind it (x ≤ 6), inside the wall cells and the void beyond. So nothing of the gate reaches into the arena below its zone top, and the simulation's wall face and the drawn gate are the same plane.

| Part | Footprint (x, y) | Heights above F | Notes |
|---|---|---|---|
| **Plinth** | x 5–6, under the leaves and railing panels (y 50–56, 57–63, 66–84, 87–93, 94–100) | 0–0.3 m | A low stone step. **All ironwork stands on it**, from F + 0.3 |
| **Gate leaves** | plane x = 6, y 66–84 | 0.3 to 32 m | Layer *leaves*, as two halves split at y = 75, so a later spec can swing them open |
| **Gateposts** (2) | shaft x 3–6, y 63–66 and y 84–87 (axes (4.5, 64.5) and (4.5, 85.5)) | shaft −4 to 28 m | 3 × 3 m. Each front face is flush with the plane. The shaft runs below the floor so it doesn't end in mid-air when seen through the railing from above |
| **Gatepost tops** | centered on each axis | crown 28 to about 30.9 m (*measured*, §2), spire from the crown's top to 50 m | The crown on a box 4 × 4 m (it overhangs the shaft by 0.5 m on every side); the spire two crossed cards (§3) |
| **Railing panels** (4) | plane x = 6: y 50–56, 57–63, 87–93, 94–100 | 0.3 up to the **arc** | Layer *railing*, one copy per panel, its top following the arc |
| **Railing posts** (4) | shaft x 5–6, 1 × 1 m: y 49–50 and 100–101 (corner posts), y 56–57 and 93–94 (middle posts) | shaft −4 to 12 m (corner posts); to 0.5 m above the higher railing top beside it (middle posts: 22.08 m) | Flush with the plane. Each corner post stands in the corner cell, (5, 49) or (5, 100). At 12 m it rises 2 m above the north wall (10 m above F) and 1 m above the south arcade's segments (11 m) |
| **Railing post tops** | centered on each shaft | from the shaft's top | The gatepost's top at one third of its size: crown box 1.33 m, about 0.96 m tall; spire 6.4 m long |

**The arc.** The railing's top follows one curve on each side, rising from the corner to the gatepost as the human's sketch and the title painting show. So the railings, the gateposts and the leaves' own arched top read as one great arch.
- At a distance `d = |y − 75|` from the center line, the top is `arc(d) = 29.06 · √(1 − (d / 26.88)²)` m above F.
- That's the ellipse centered on the center line at floor level that passes through 10.67 m at the corners (`d` = 25) and 26 m at the gateposts (`d` = 12, 2 m under their crowns).
- Values: 10.67 m at d = 25, 20.55 at d = 19, 21.58 at d = 18, 26.0 at d = 12.
- The leaves (32 m at the center) rise above it.

**Why the gateposts' crowns start at 28 m:** the leaves' outer edges reach 27.5 m within 0.5 m of the posts (measured, §2), and the crown overhangs the leaves by 0.5 m. So the crown must start above them.

**What's behind the ironwork.** Nothing is in play beyond x = 6. Through the bars players see:
- the sky band (M10 §4);
- the cloud banks of §3;
- the radiance;
- looking down past the plinth, the open sky below the level, as over the arcades' balustrades.

It never shows another arena: there's none to the west.

## 2. Art and preparation

Claude prepares the four images by script, extending `scripts/cutout.py`, which writes the prepared files to `assets/textures/` and the measurements to **`src/render/gate.gen.ts`** (like `arch.gen.ts`).

**`gate-leaves`, `gate-railing`, `gate-post-top-2`** (cut-outs):
- Key out the green to transparency as for `tex-arcade` (M10 §6), including the green fringe on soft edges.
- Crop `gate-leaves` to the metal's columns (about 7–1 529 of 1 536), so no sky slit shows between the leaves and the gateposts.
- Measure `gate-post-top-2` (1 536 × 2 752), all values written to `gate.gen.ts`:
  - the crown's base band, about 1 005 px wide; the scale is the one at which the base band is 4 m;
  - the crown's widest row with its horn tips, about 1 336 px (about 5.3 m);
  - **the crown's top: the topmost row of the outer horn tips**, about row 2 027 (row 2 025 spans about columns 536–999, row 2 030 about 101–1 434); from there to the image bottom, about 2.89 m;
  - the columns of everything above the crown's top (the struts, the ring, the spire and the central leaf's tip), about 536–999, so about 1.84 m wide. The central leaf's tip, which rises above the horns, goes onto the spire cards with the struts; that's accepted.
- Measure `gate-leaves`' outer-edge top within 0.5 m of each side (about 86% of the height, 27.5 m) and confirm it is below the gatepost crown (28 m). If not, stop and ask.

**`gate-post-shaft`** (opaque) **doesn't tile as generated**: its top rows are lighter than its bottom rows (about 19–30 levels, depending on how many rows are averaged), and the ornament breaks at the seam. Make it tile:
1. Remove the vertical brightness gradient. Scale each row so that its mean, smoothed over 64 rows, equals the image's mean.
2. Crop it to a whole number of repeats of the central ornament **only if** the autocorrelation of a central strip (the ornament's width) has a clear peak (≥ 0.5) at some period. Crop from one repeat's start. Otherwise keep the full height. (A first look found no peak above 0.21, so expect to keep it.)
3. Cross-fade the top and bottom 3% over the seam.
4. Write the shaft's **repeat height** to `gate.gen.ts`: 3 m × (its height / its width) after any crop, 5.33 m if uncropped. The layer is stored at 1 280 × 2 276 whatever the crop, so the repeat height keeps it undistorted on the post.
5. **Check:** stack it three times in a test image; no seam is visible. If one still shows, stop and ask.

**The gate array**: all four images resized to **1 280 × 2 276** and packed into one four-layer texture array:
- layer 0 *leaves*;
- layer 1 *railing*;
- layer 2 *post top*;
- layer 3 *shaft*.

Pack and load it like the terrain array: generalize `loadTextureArray` (`textureArray.ts`) to non-square layers and add a wrap parameter. The array is mipmapped, sRGB and **ClampToEdge**: nothing in the gate wraps, and the shaft repeats by geometry (§3). Ship the cut-outs as WebP with alpha and the shaft as JPEG.

**Loaded only on maps with a gate.** `loadGameTextures` gets the dungeon (or a `gate: boolean`) and loads the gate array only when the map has a `gate`. The sandbox and any map without one load nothing new.

**Checks:**
- Each image is symmetric left to right.
- The leaves' outer edges are vertical.
- The gaps are clearly transparent.
- No green is left inside the metal or stone.

## 3. Building it

**Data.** `DungeonDef` gets an optional `gate: { x: 6, yCenter: 75, y0: 49, y1: 101 }`, set in `pearly-gates.ts`. `loadMap` copies it to `GameMap.gate` (`null` elsewhere). A new `src/render/gate.ts` builds everything below from it once, at level build, deterministically. It's drawn only. `buildTerrain` calls it, the way it calls the arches; export `GeometryBuilder` from `terrain.ts`, or pass the builders in.

**Skipped cells.** The **skipped cells** are the cells with x ≤ 5 and y from 49 to 100 (the gate's `y0` to `y1 − 1`).
- **Terrain (`terrain.ts`).** The terrain draws nothing of a skipped cell: no top, no face (including the backs of walls and cliffs), no cornice. It also draws no face of another cell that looks into a skipped cell. For example, the west end face of the arcade segment (6, 100) above (5, 100) is covered by the corner post.
- **Relief (`relief.ts`).** `computeRelief` gets a `skip(c, r)` predicate:
  - A skipped cell has no crown, pilaster strip or window.
  - `hasCrown` is false for a face that looks into a skipped cell. That removes the crown on the west end face of the arcade segment (6, 100), which today overhangs past the map's edge.
  - In a crown's `end()`, a next cell that is skipped ends the crown there with a cap (`{ ext: 0, cap: true, outer: false }`), before the other cases.

  So the north wall's crown, which today stops 0.35 m short of the corner for the west wall's crown, and the south arcade's crown, which today runs on to x = 5.65, both end flush at x = 6 with a closed end.
- **The simulation is untouched.** Skipping is drawing only; `map.heights` and `map.wall` stay as they are.

**The gate's mesh**: one cut-out mesh using the gate array and `makeTerrainMaterial(…, cutout = true)`.
- It uses alpha-to-coverage and the arcades' mip-level alpha boost (M10 §6), so thin bars stay visible from across the arena.
- It has its own alpha-restore pass like `paintedAlpha` (render order 1000).
- It's double-sided. A face seen from behind uses the same texture and vertex color.
- **2 draw calls.** The plinth is the only part in the terrain mesh.

**Leaves:** layer 0 in the plane x = 6, as two quads (y 75–84 and 66–75), from F + 0.3 to F + 32.
- u runs from y = 84 (u = 0) to y = 66 (u = 1), so the image reads as painted when seen from the arena, looking west.
- The two quads take u 0–0.5 and 0.5–1.

**Railing:** layer 1 in the plane x = 6, from F + 0.3 up to `arc`, in **0.25 m columns** (quads whose top edge is `arc` at each column's ends).
- u runs from the panel's south end (u = 0) to its north end, so it reads correctly from the arena. The south panels' u runs backward (mirrored), so the railing is symmetric about y = 75.
- The image's v is split into three bands:
  - the bottom rail and scroll band, the image's bottom 15%: 1.6 m, from F + 0.3;
  - the top band (finials and heart scrolls), the top 25%: 2.67 m, ending at `arc`;
  - the middle 60%, which stretches to fill the rest.
- A vertical stretch keeps bars vertical, so the top band climbs the arc in small steps and the finials stay upright. Near the gateposts the middle band stretches up to about 3×. The arch of curved bars in it (26–45% from the image top) stretches with it; this is accepted (the human approved the mockup).

**Post shafts:** boxes with layer 3 on all four sides, u 0–1 across each face.
- Each face is split into segments one repeat tall: the shaft's repeat height from `gate.gen.ts` (5.33 m if the image is uncropped) on a gatepost, a third of it on a railing post. Each segment maps v 0–1, so the array needn't wrap; the top segment is cropped.
- The tops are hidden by the crowns, so nothing is built there.

**Crowns:** layer 2's crown part (the rows below the crown's top).
- It goes on the four sides of a box 4 × 4 m (1.33 m for railing posts), centered on the shaft, from the shaft's top up the crown's measured height.
- Each side's quad is **as wide as the crown's widest row** (about 5.3 m; 1.78 m on railing posts), centered on its side. At the scale where the base band spans the box, the horn tips overhang the box's corners, and the quads of neighboring sides cross there.

**Spires:** two vertical cards crossing on the post's axis, one in the x–z plane and one in the y–z plane.
- Each shows layer 2's part above the crown's top: the struts, the ring and the spire.
- Each runs from the crown's top to F + 50 (railing posts: 6.4 m above their crown's top), stretched to that height.
- Each is drawn at **2 times the painted width** at the crown's scale: about 3.7 m for a gatepost, about 1.23 m for a railing post. So the struts land on the crown, inside its 2 m half-width, and the spire is about 1.8 m wide at its ring, as stout as the title painting's.

**Plinth** (terrain mesh, `L_RISER`):
- its top at F + 0.3;
- its front face in the plane x = 6, from F to F + 0.3;
- its outer face (x = 5) as a cliff down to the cliff bottom, as an open edge's (M10 §3.5).

It runs only where §1's table says, not under any post.

**Light** (M10 §5.2). Every face gets the direction shading of its normal (`faceColor`) as its vertex color.
- **Shadow lines.** Faces turned to the sun (`facesSun`) get the baked shadow line from `faceShadowZ` (with `archShadow` as the extra blockers, as the terrain's walls do), evaluated at their vertices 1 cm inside the face.
  - This matters for the north railing: the north wall (14.5 m) shades the plane x = 6 wherever z < 14.5 − 0.99 · (y − 50). That's a triangle about 10 m tall at y = 50, reaching the floor near y = 60. Today the west wall's face shows that line, and the floor at its foot is in the same baked shadow.
  - The railing's 0.25 m columns carry the line. No shadow reaches the leaves (y ≥ 66), so two quads suffice there.
  - The gate itself adds no blockers. The crowns' 0.5 m overhang 28 m up is ignored.
- The posts and the ironwork are behind the arena (west of it), so they cast no shadow into it: the floor lightmap is unchanged.
- The cross cards' faces use the shading of their normals too.

**Haze:** the same as all scenery (the M10 fog curve, 30% at 40 m).

**Clouds behind the gate.** `placeCards` appends **6 bank cards** for a map with a gate, after all the existing placements and without drawing from the seeded random, so every existing card stays where it is. They go in the clouds' mesh, so there's no new draw call.

| | Value |
|---|---|
| Centers | x = −20; y = 54, 62, 70, 80, 88, 96 |
| Height | z = F + 4 (center), so each card's bottom is at F − 8 |
| Size | 24 m |
| Painting | `cell` k mod 3 (k = 0–5 in that order) |
| Mirror | `mirror` on odd k |
| Drift | 3 m along y (`dx` 0, `dy` 1), period 90 s, phase k radians |

Every card's full extent with its drift stays at x ≤ −5, so it's never over a floor cell (the existing test). It's at least 25 m from any point in the arena, so the cards' near fade never applies. The cards face the camera; seen along the railing, they swing only behind the ironwork. The final sort (far to near) includes them.

**Radiance:** light glowing behind the gate.
- One quad in the plane x = −2, facing +x, 40 m wide (y 55–95), from F − 4 to F + 44.
- `fx-glow`, tinted warm gold (1.0, 0.88, 0.6), at opacity 0.7.
- Normal alpha blending like the other effects (decisions §11.1), depth test on, no depth write, the sprites' haze.
- **Render order −1, with the cloud cards' mesh set to −2.** Both are transparent, so they draw after the whole opaque scene, including the sky (drawn last among the opaque, M10 §2.2). The clouds come first, then the radiance, then the arena's own effects (tracers, glows, incense: render order 0, no depth write). So the radiance never washes over an effect seen through the bars.

Through the bars it reads as Heaven's light, and above the gate as a golden glow. **1 draw call.** It's built only on maps with a gate.

**Tracers.** In `game.ts`, beside `archStoneHit`, a new `gateHit(gate, …)` ends a tracer at the gate. It shortens `end` the same way `archStoneHit` does.
- Below the wall's simulation height (14.5 m) the simulation already stops most shots at x = 6, but not at (5, 99), an open-edge corner whose simulation height is a 5.9 m parapet. So `gateHit` tests the whole gate from F + 0.3 up, at every height.
- The tracer ends:
  - at the plane x = 6 within the leaves' rectangle (y 66–84, up to F + 32) and each railing panel's (up to its `arc`), all treated as solid;
  - at the shafts and crowns, as boxes;
  - at the spires, as boxes 1.8 m wide (0.6 m for railing posts) from the crown's top to the tip.

  Above all of them, shots fly on into the sky.

## 4. Performance

**Budgets** (against M10's final build, 7491068; they replace M10 §2.1's for the gate):

| Item | Budget |
|---|---|
| Draw calls | **+3** on maps with a gate (gate mesh, its alpha pass, radiance), 0 elsewhere |
| Triangles | **at most +2 500** as `renderer.info` counts them (the gate mesh is about 1 100 triangles and the alpha pass draws it twice) |
| GPU texture memory | **at most +65 MB on maps with a gate** (4 × 1 280 × 2 276 × 4 bytes, mipmapped: about 62 MB), **0 elsewhere** |
| Download | **at most +5 MB** |
| Per-frame JavaScript | **nothing new** |
| Level build time | **at most +50 ms** |

**A fourth benchmark view: `--view gate`.** It runs the benchmark in the **boss arena** instead of the first arena. Stage 1 makes the bench's arena a parameter.
- **`params.ts`:** `view=gate` gives `benchView: 'gate'`.
- **`bench.mjs`:** needs no change; it already passes any `--view` through.
- **The bench arena.** It's the arena with `boss: true` for the gate view, and arena 0 otherwise, including the gate view on a map with no boss arena. It's passed to the worker:
  - `HostSession.start` and the worker's `start` message carry `benchArena: number` (−1 when not benchmarking) in place of `bench: boolean`;
  - the simulation option `bench` becomes `benchArena` the same way;
  - **every** use of the old flag becomes `benchArena >= 0`, not only the three lines below (also sim.ts ~614, ~798, ~834, ~857, ~2477, main.ts ~124 and game.ts ~338, ~352, ~374, ~440).
- **In the simulation** (`sim.ts`):
  - the player starts at the bench arena's first entry cell (today `arenas[0]`, line ~506);
  - the bench arena starts at once without waiting for earlier arenas to be cleared (the check at line ~754 is skipped for it);
  - the top-up applies to the bench arena (line ~915). It keeps 1 500 *living enemies*, the Gatekeeper and his summoned Cherubs included, which is also what `BenchRunner` waits for.

  The boss arena starts as normal, so `placeBoss` puts the Gatekeeper on the dais, and he fights normally: Volleys, Judgment and summons. The bench player can't die (as today). Waves stay off in the bench, as today.
- **In the client** (`game.ts`):
  - the local player starts at the same cell (line ~343);
  - in the gate view the camera doesn't turn: each frame, yaw = `atan2(75 − p.y, 6 − p.x)` and pitch = +10° (line ~1234).

**The gate** (after stages 2 and 3, recorded in `bench.md`) is measured **back to back**, alternating single uncapped runs, two each, as in bench.md's *M10 final*:
- `pearly-gates` and `pearly-gates --view arcade` against the M10 final build: uncapped frame time at most **+2%**. The gate is far away or hidden there, but its spires may show over the walls.
- `pearly-gates --view gate` against the stage-1 build (no gate): uncapped frame time at most **+5%**.
- Capped: at least 58 FPS on average in these three runs, with no more frames over 20 ms than the build it's compared with.
- The budgets above, checked with `renderer.info`.
- **Sandbox:** one capped run after stage 3 confirms that its draw calls, triangles and texture memory are exactly as before.
- **If it fails**, cut in this order and record the cuts:
  1. the radiance;
  2. the gate array at 1 024 × 1 821;
  3. the cloud banks behind the gate.

  Never cut the posts, the spires or the ironwork.

## 5. Tests

| Test | Checks |
|---|---|
| Map and heights | The Pearly Gates' cells, kinds and heights are exactly as before (no simulation change). All existing heights tests, including *Judgment cover is unchanged*, pass untouched |
| Gate geometry | Building it twice gives identical geometry. Every vertex lies within x −2 to 7.3, y 48.5–101.5. Nothing of the gate with x > 6.01 is below z = 14.5 (the zone top + 0.5 m). The leaves, panels, posts and plinth are symmetric about y = 75. The railing's top is within 1 cm of `arc` at every column edge: 10.67 m at y = 50 and y = 100, 26 m at the gateposts. The ironwork's bottom is at F + 0.3 |
| Terrain | In `pearly-gates`, no terrain triangle lies more than 1 cm inside the region x < 6, 49 < y < 101, except the plinth's (all its vertices at z ≤ F + 0.3 + 0.01, or on its cliff face at x = 5). The sandbox's terrain is unchanged |
| Relief | No crown, strip or window is on a skipped cell. The north wall's crown on its south face ends at x = 6 with a cap. So does the south arcade's crown on its north face |
| Light | Every gate face's vertex color is `faceColor` of its normal, times the shadow line where it faces the sun. A point on the north railing at (6, 52, F + 1) is in shadow; one on the leaves at (6, 75, F + 2) is lit. The floor lightmap is byte-for-byte the same as before |
| Tracers | `gateHit` from (35.5, 75, F + 1.6) with a range of 60 m (the Silver Revolver's): a shot at (6, 75, F + 20) ends at x = 6 (±0.01, at about 34.8 m). A shot at (4.5, 64.5, F + 40), a gatepost's spire, ends within 1.2 m of its axis (about 49.6 m). A shot at (6, 75, F + 40), above the leaves and between the spires, flies on to the full 60 m. A shot low at (6, 99.5, F + 3), over the corner parapet, ends at x = 6 |
| Clouds | The 6 new banks are in `placeCards`' result with exactly §3's values. With those 6 filtered out, the cards are identical (as a set) to the result without the gate. The existing atmosphere tests pass untouched |
| Textures | The gate array is loaded only for a map with a gate. The bench's texture memory for the sandbox is unchanged |
| Bench | `parseParams('?bench=1&map=pearly-gates&view=gate')` gives `benchView: 'gate'`. A simulation with `benchArena` = the boss arena starts it on the first tick with the player at its entry cell and the Gatekeeper on `B`, and tops it up to 1 500 living enemies. `view=gate` on the sandbox benches arena 0 |
| End-to-end | Unchanged; all pass. The game loads `pearly-gates` with no console errors or warnings |

Existing tests are expected to pass unchanged: the relief tests' thresholds hold (crowns about 161 → 160, more than 100 needed; windows 58 → 53, more than 50 needed). If one doesn't, update it and list the change in the stage's commit message.

## 6. Stages

1. **Benchmark view.** `--view gate` (§4), with its tests. Record its numbers on this build with no gate yet (the gate view's baseline), alongside back-to-back runs of `pearly-gates` and the arcade view against the M10 final build. Take a screenshot of the view.
2. **The gate.**
   - Prepare the images (§2).
   - Add the `gate` field, the skipped cells in terrain and relief, the plinth, the gate mesh (leaves, railing, shafts, crowns, spires), its light and the tracers (§3).
   - Load the textures only for maps with a gate.
   - Run the gate of §4 and take the screenshots of §8.
3. **Clouds, radiance and the final check.**
   - The cloud banks and the radiance (§3).
   - Run the gate of §4 and the sandbox check, and take the screenshots of §8.
   - **Readability:** in the gate view with the swarm, the Blessed and the Gatekeeper must read clearly against the gate. If they don't, lower the radiance's opacity (down to 0.4 at most) and record it. If that isn't enough, stop and ask.

## 7. Out of scope

- The gate opening when the Gatekeeper dies. That's a natural next step, with its own spec; the leaves are already split in two for it.
- Any animation or sound for the gate.
- A cinematic camera or intro.
- Changes to the Gatekeeper, its dais, its attacks or the other arenas.
- A gate in the sandbox or other levels. Later levels may reuse parts of it (posts, railings) for level design, but not the gate as a whole.
- Hiding the gate from earlier arenas.
- A different haze for the gate.
- Real-time lights or shadows, or 3D models.
- The cathedral-style gate images (`assets/art-src/reference/cathedral-gate-*`), kept for later level design.

## 8. Acceptance criteria

- [ ] The tests of §5 pass, and typecheck, unit and end-to-end tests pass.
- [ ] `bench.md` has the gate view's baseline and a row after stages 2 and 3, each meeting §4, plus the sandbox check.
- [ ] Screenshots `screenshots/m10/gate-<stage>-<view>.png`, from stage 1 (before) and stages 2 and 3 (after). The fixed cameras (`cam=x,y,z,yaw,pitch`, with z blank for eye height) go in `scripts/views.json`:

  | View | Camera | What it shows |
  |---|---|---|
  | entry | `64.5,86.5,,191,14` | from the boss arena's entry |
  | mid | `36,80,,186,22` | |
  | dais | `20,75,,180,35` | from the dais's foot, looking up |
  | corner | `8,52,,100,15` | along the railing from the north-west corner |
  | a1 | `44,21,,125,10` | the beacon from Arena 1's terrace |
  | lobby | `8.5,21.5,,93,15` | the beacon from the Lobby |
  | a3 | `100,75,,180,10` | from Arena 3, over its wall |
  | fight | `36,80,6.1,186,22`: a shot added to `views-progress.mjs`' `SHOTS` (arena 3, after 6 s), not to `views.json` | the Gatekeeper on the dais in front of the leaves |
  | swarm | the gate bench view | readability (stage 3) |
- [ ] Compared side by side with the title painting: the same gate (golden arched leaves, white spired posts, gilded railings rising to the gate, sky and light behind).
- [ ] Decisions recorded in `decisions.md`.
- [ ] **Human checkpoint:** the human plays into the boss arena and judges the three reactions of the introduction. Changes from that playtest are review fixes on this spec.
