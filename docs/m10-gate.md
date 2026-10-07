# M10 follow-up: The Heavenly Gate

The end of the Pearly Gates should feel like the end of the climb. Players fight through three arenas, walk the last corridor and step into the boss arena. The arena's whole west side is gone: in its place stands **the gate of Heaven** from the title painting (`assets/art-src/ui-title-bg.png`):
- two colossal golden gate leaves, 18 m wide, whose arched top rises 32 m above the floor;
- two tall white-and-gold gateposts, each crowned with gold and topped with a slender spire about 50 m high;
- gilded railings on either side whose tops sweep up from the arena's corners to the gateposts, so the whole gate reads as one great arch, each run with its own spired posts.

Behind it all are open sky, banks of cloud at its foot and a warm glow of light. Three reactions to aim for:
- *"Wow, it was worth fighting through the level."* The gate is the biggest and most detailed thing in the game. Players see it the moment they enter, and it's too tall to fit on screen without looking up.
- *"Now it gets serious."* The Gatekeeper stands on his dais right in front of the closed leaves, the gate's guard.
- *"We are really storming Heaven's gate."* The fight happens at the foot of the gate, with Heaven visible through its bars.

**What's built.** The arena's west wall is drawn as ironwork, built **the hybrid way, like the M10 arches**: real, simple geometry for the shapes (square post shafts, crown boxes, crossed cards for the spires), carrying painted faces for all the ornament: the gate leaves and the railing panels (flat ironwork, cut out so the sky shows through), the posts' white-and-gold shafts, and their gold crowns and spires. Four new images, a few hundred triangles and 3 draw calls, all in view only in the boss arena.

**One simulation change:** the two gateposts stand 2 m forward of the wall line, so their footprints become wall cells (§1). Everything else is drawn only. **The west wall stays a wall in the simulation** (movement, shots and line of sight are unchanged); it's just drawn as open ironwork with the sky behind it. Nothing changes in movement, enemies, classes or the protocol.

All numbers are **initial values**.

---

## 0. Instructions for the implementing agent

1. **Read this document, [m10.md](m10.md) (§2, §5.2, §6, §7.2 above all), [bench.md](bench.md) and the *Heavenly Gate* section of [art-prompts.md](art-prompts.md) first.** Where they disagree, this document wins. Everything else in M10 and the MVP still holds, including the definition of done.
2. **Implement the stages of §6 strictly in order.** For each stage, typecheck, unit tests and end-to-end tests must pass, the stage's screenshots must go in `screenshots/m10/` with the prefix `gate-`, the performance gate of §4 must pass, and the work must be committed. Then start the next stage.
3. **Decisions.** Where this document is silent, choose the simplest option consistent with it and add a line to `docs/decisions.md`: `M10 gate §<section> — <decision>`.
4. **Git.** Work on the branch you were given. Commit messages start with `M10.8.<stage>:`.
5. **Human checkpoints.** Stage 2 needs `gate-leaves`, `gate-railing`, `gate-post-shaft` and `gate-post-top-2` in `assets/art-src/` (all present as `.jfif`; prompts in art-prompts.md). If they aren't there, stop and ask. **Look at the images and the title painting before stage 2**, and compare screenshots against the title painting at the end of stages 2 and 3. The benchmark needs an active, uncovered desktop. Ask for that before stage 1.

---

## 1. Layout

Map coordinates: x east, y south (rows), z up. The boss arena (*The Gate*, x 6–65, y 50–99) has its floor at **F = 4.5 m**. The Gatekeeper's dais covers x 9–17, y 71–79 at 7.5 m. The arena's west wall is the column of wall cells x = 5, so its face stands in the plane **x = 6**. The arena and the dais share the center line **y = 75**. The whole gate is symmetric about it.

**The ironwork plane is x = 6**, where the wall's face is today, so everything painted stands exactly where the simulation's wall is.

| Part | Footprint (x, y) | Heights above F | Notes |
|---|---|---|---|
| **Gate leaves** | plane x = 6, y 66–84 | 0 to 32 m at the center | Layer *leaves* (18 × 32 m, 9:16), as two halves split at y = 75, so a later spec can swing them open |
| **Gateposts** (2) | shaft x 5–8, y 63–66 and y 84–87 | shaft 0–24 m | 3 × 3 m, standing 2 m forward of the wall line |
| **Gatepost tops** | centered on each shaft | crown from 24 m (about 2.8 m tall, *measured*), spire above it to 50 m | The crown is a box 4 × 4 m (0.5 m wider than the shaft on every side), the spire two crossed cards (§3) |
| **Railing panels** (4) | plane x = 6: y 50–56, 57–63, 87–93, 94–100 | 0 up to the **arc** | Layer *railing* (6 m wide), one copy per panel, its top following the arc (below). Panels on the south side are mirrored left to right, so the railing is symmetric |
| **Railing posts** (4) | shaft x 5–6, 1 × 1 m: y 49–50, 56–57, 93–94, 100–101 | shaft to 0.5 m above the higher railing top beside it (the corner posts about 11.2 m, the middle posts about 19.8 m) | Flush with the ironwork at the front, standing back into the wall cells. The corner posts (y 49–50 and 100–101) close the railing against the north wall and the south arcade |
| **Railing post tops** | centered on each shaft | from the shaft's top | The gatepost's top at one third of its size: crown box 1.33 m, spire 7.7 m long |

**The arc.** The railing's top follows one curve on each side, rising from the corner to the gatepost as the human's sketch and the title painting show, so the railings, the gateposts and the leaves' own arched top read as one great arch. Above F, at a distance `d = |y − 75|` from the center line, the top is `arc(d) = 25.56 · √(1 − (d / 27.51)²)` m: the ellipse centered on the center line at floor level that passes through 10.67 m at the corners (`d` = 25, the panel's own height, so the outer end is the panel unstretched) and 23 m at the gateposts (`d` = 12, just under their crowns at 24 m). The leaves (32 m at the center) rise above it.
| **Plinth** | the wall cells x = 5, y 50–99, except under the gateposts | 0–0.3 m | A low stone step under the ironwork, `tex-riser` on top and its front face. The gate's lowest line, so the bars don't stand on nothing |

**The map change** (`src/data/dungeons/pearly-gates.ts`): after the boss arena's floor is filled, the cells x 6–7 at y 63–65 and y 84–86 become wall (the gateposts' parts in front of the wall line). They join the west wall, so `computeHeights` classifies them as *Wall*. Nothing else in the map changes. No marker, stair, pillar, decoration or spawn is in those cells. They add a little cover beside the dais. The M10 test *Judgment cover is unchanged* still passes, because it compares two height rules on the same map.

**What's behind the ironwork.** Nothing is in play beyond x = 6: cells x 0–4 are void and x = 5 is wall. Through the bars players see the sky band (M10 §4), the cloud banks of §3 and the radiance. It never shows another arena (M10 §1): there is none to the west.

## 2. Art and preparation

The human generates four images (prompts in art-prompts.md), all 9:16:
- **`gate-leaves`**: the two closed gate leaves, their arched top rising to the top edge at the center, with the gaps between the bars in flat green.
- **`gate-railing`**: one railing panel, with the gaps in flat green.
- **`gate-post-shaft`**: one face of a post's shaft, filling the frame, whose top continues into its bottom (it repeats up the shaft).
- **`gate-post-top-2`**: one post's gold crown, gold struts rising from it to a ring, and the spire above, centered, on flat green. (The first version, `gate-post-top`, has a ghost scene painted over its spire and isn't used.)

Claude prepares them by script, extending `scripts/cutout.py`:
- **Key out the green to transparency** as for `tex-arcade` (M10 §6), including the green fringe on soft edges.
- **The gate array:** resize the three cut-out images to 1 280 × 2 276 and pack them into one three-layer texture array: layer 0 *leaves*, layer 1 *railing*, layer 2 *post top*. Make it mipmapped and sRGB like the terrain array (`textureArray.ts`, generalized to non-square layers). Ship them as WebP with alpha.
- **The shaft** is opaque: resized to 1 024 × 1 024, it's one more layer of the terrain array, *L_POST* (no new texture or draw call). Ship it as JPEG.
- **Measure `gate-post-top-2`** (1 536 × 2 752): the crown's base band (about 1 005 px wide), the crown's full painted width with its leaf tips (about 1 270 px), the crown's top (row about 2 040, the top of the gold leaves) and the width of everything above it, the spire with its struts (columns about 550–986). At the scale where the base band is 4 m: the crown is about 5.1 m wide and 2.8 m tall, and the spire's part about 1.7 m wide. Write them to a generated source file.
- **Check:** each image is symmetric left to right; the leaves' outer edges are vertical; the shaft's top and bottom match within a few pixels; the gaps are clearly transparent; no green is left inside the metal or stone.

## 3. Building it

All of this goes in a new `src/render/gate.ts`. It's built once at level build from a `gate` field in the dungeon definition (`{ x: 6, yCenter: 75, y0: 49, y1: 101 }`; the sandbox has none), deterministically, and drawn only.

**What the terrain no longer draws.** The terrain skips every top, face, cornice, crown, pilaster strip and window of the wall cells x 0–5 at y 50–99, and of the new gatepost cells. The gate draws that space instead. The north wall and the south arcade end at the corner posts, which cover their ends.

**Painted ironwork**: one cut-out mesh using the gate's texture array. It uses alpha-to-coverage and the mip-level alpha boost of the arcades (M10 §6), so thin bars stay visible from across the arena, and has its own alpha-restore pass like `paintedAlpha`. It's double-sided. **2 draw calls.**
- **Leaves:** layer 0 in the plane x = 6, facing +x, as two quads (y 66–75 and 75–84), from F to F + 32.
- **Railing:** layer 1 in the same plane, from F up to the arc, in **0.25 m columns** (quads whose top edge is the arc at each column's ends). The south panels' u runs backward (mirrored). The image is split into three bands that keep their own size: the bottom rail and scroll band (the bottom 15% of the image, 1.6 m), and the top band, finials and heart scrolls (the top 25%, 2.67 m), which follows the arc. The plain bars between them (the middle 60%) stretch to fill the rest. A vertical stretch keeps the bars vertical, so the top band climbs the arc in steps no one can see, and the finials stay upright.

**Solid parts**: opaque, in the terrain mesh (no new draw call), with the terrain's layers, and lit as in M10 §5.2.
- **Post shafts:** boxes. Every face shows *L_POST*, u across the face, repeating every 5.33 m up a gatepost (16/9 of its 3 m width) and every 1.78 m up a railing post, so the pattern is never stretched. A roof at the shaft's top in `tex-riser`, hidden by the crown.

**Post tops** (in the painted cut-out mesh, layer *post top*):
- **Crown:** the four sides of a box 4 × 4 m (1.33 m for railing posts) around the shaft's top, from the shaft's top up the crown's measured height. Each side shows the crown's part of the image (its full width, from the bottom of the crown to the top of its tallest ornament), so its gold silhouette is cut out against the sky. Double-sided, so the inner sides show through the gaps.
- **Spire:** two vertical cards crossing on the post's axis (one in the x–z plane, one in the y–z plane), from the crown's top edge to the tip at F + 50 (railing posts: 7.7 m above their crown). Each shows the image above the crown's top (the gold struts, the ring and the spire), stretched to that height and drawn at **2 times its painted width** (about 3.4 m for a gatepost, so the struts land on the crown and the spire is about 1.8 m wide at its ring), so the spires are as stout as the title painting's rather than needles. In each card the struts meet the middle of a crown side. Seen from any side, the crossed cards make a slender spire with the painted silhouette, as foliage cards do.
- **Plinth:** as in §1.

**Clouds at its foot**: the title painting's gate stands in clouds. Add **6 bank cards** (M10 §7.2) to the clouds' mesh, so there's no new draw call. Their centers sit at x −6, −12, −18, −8, −14, −20 and y 57, 63, 69, 81, 87, 93 (in pairs). They're 20–28 m wide (deterministic, from the cards' seeded random), with their bottoms at F − 8. So, seen through the ironwork, banks of cloud reach about halfway up the railing behind it. They drift like the other banks.

**Radiance**: light glowing behind the gate. One quad in the plane x = −2, facing +x, 40 m wide (y 55–95) and from F − 4 to F + 44. It uses `fx-glow` tinted warm gold (1.0, 0.88, 0.6) at opacity 0.7, with normal alpha blending like the other effects (decisions §11.1), no depth write and the sprites' haze. It's drawn **after the sky**, because the sky is drawn last (M10 §6). Through the bars it reads as Heaven's light, and above the gate as a golden glow, as in the title painting. **1 draw call.** It's the first thing cut if the performance gate fails (§4).

**Light** (M10 §5.2). Every face gets the direction shading of its normal (`faceColor`). The ironwork faces east with the sun in the north-east, so it's sunlit. Faces turned to the sun get a baked shadow line (1 m columns for the ironwork, as for the bays), using `shadowZ` with the gateposts and railing posts added to the blockers. So the north gatepost shades a strip of the leaves beside it. The posts are also added to the floor lightmap's blockers, alongside `archesBlock`. The ironwork itself casts no shadows: its shadows would fall west, outside the level.

**Haze:** the same as all scenery (the M10 fog curve, 30% at 40 m).

**Tracers.** A shot's tracer ends where it meets the gate (the client test beside `archStoneHit`, M10 §6.1). Below the wall's simulation height the simulation already stops shots at x = 6. Above it, the tracer ends at the leaves' and the railing's quads (treated as solid within their rectangles), at the shafts and crowns (boxes) and at the spires (boxes as wide as their cards). Above all of them, shots fly on into the sky.

**Nothing of the gate blocks play.** In front of the wall line it occupies only the new gatepost cells.

## 4. Performance

**Budgets** (on top of M10's final build, 7491068):

| Item | Budget |
|---|---|
| Draw calls | **+3** (ironwork, its alpha pass, radiance), only when the gate is in view |
| Triangles | **at most +2 000** |
| GPU texture memory | **at most +55 MB** (the gate array: 3 × 1 280 × 2 276 × 4 bytes, mipmapped, about 47 MB; the shaft's terrain layer about 6 MB) |
| Download | **at most +5 MB** |
| Per-frame JavaScript | **nothing new** |
| Level build time | **at most +50 ms** |

**A fourth benchmark view: `--view gate`.** The benchmark runs as today, but in the **boss arena** instead of the first arena:
- The player starts at its entry cells.
- The arena enters combat at once, with the Gatekeeper on the dais as in a normal start, and is topped up to 1 500 Blessed.
- The camera is fixed at eye level, looking from the entry toward (6, 75) and pitched up 10°.

This is the gate's worst view: the most ironwork, sky and glow on screen. Stage 1 adds it to `bench.mjs`, `params.ts` and the simulation's bench start.

**The gate** (after each stage, recorded in `bench.md`) is measured **back to back** against the M10 final build, alternating single uncapped runs, two each, as in bench.md's *M10 final*:
- `pearly-gates` and `pearly-gates --view arcade`: uncapped frame time at most **+2%**. The gate is far away or hidden there.
- `pearly-gates --view gate`: uncapped frame time at most **+5%** against the same view on the stage-1 build (no gate yet).
- Capped: at least 58 FPS on average in all four, with no frame over 20 ms more often than on the stage-1 build.
- The budgets above, checked with `renderer.info`.
- **If it fails**, cut in this order and record the cuts:
  1. the radiance;
  2. the gate array at 1 024 × 1 821;
  3. the cloud banks at the gate's foot.

  Never cut the posts, the spires or the ironwork.

## 5. Tests

| Test | Checks |
|---|---|
| Map | In `pearly-gates`, the cells x 6–7 at y 63–65 and 84–86 are walls. Every other cell of the boss arena is unchanged: floor heights, markers and the dais |
| Heights | The M10 wall-height and *Judgment cover is unchanged* tests pass as they are |
| Gate geometry | Building it twice gives identical geometry. Every vertex lies within x −2 to 8.5, y 48.5–101.5. No part lies more than 1 cm inside a floor cell's column below that cell's zone top. The leaves and panels are symmetric about y = 75. The railing's top is within 1 cm of `arc` at every column edge, 10.67 m at the corners and 23 m at the gateposts |
| Terrain | No terrain face, crown, strip or window lies in x 0–6, y 50–100, or on a gatepost cell |
| Tracers | A shot from the arena's center at the leaves 20 m above the floor ends at x = 6. One at a gatepost's spire ends within 0.5 m of its axis. One 40 m above the leaves flies on |
| Light | A point on the leaves 0.5 m south of the north gatepost, 2 m up, is in shadow. A point on the leaves' center line, 2 m up, is lit |
| Clouds | The 6 new banks are in the clouds' card list, all with x < 0, and placing the cards twice gives the same result |
| End-to-end | Unchanged, all pass. The game loads `pearly-gates` with no console errors or warnings |

## 6. Stages

1. **Benchmark view.** `--view gate`, and its numbers on this build with no gate yet (the gate view's baseline), alongside back-to-back runs of `pearly-gates` and the arcade view. A screenshot of the view.
2. **The gate.** Prepare the images (§2), make the map change (§1), and build the ironwork, posts, spires, plinth, light, terrain skipping and tracers (§3). *Art:* `gate-leaves`, `gate-railing`, `gate-post-shaft`, `gate-post-top-2`.
3. **Clouds, radiance and the final check.** The cloud banks and the radiance (§3), the gate of §4, and the screenshots of §8.

## 7. Out of scope

- The gate opening when the Gatekeeper dies. That's a natural next step, with its own spec; the leaves are already split in two for it.
- Any animation or sound for the gate.
- A cinematic camera or intro.
- Changes to the Gatekeeper, its dais, its attacks or the other arenas.
- A gate in the sandbox or other levels.
- A different haze for the gate.
- Real-time lights or shadows, or 3D models.
- The cathedral-style gate images (`assets/art-src/reference/cathedral-gate-*`), kept for later level design.

## 8. Acceptance criteria

- [ ] The tests of §5 pass, and typecheck, unit and end-to-end tests pass.
- [ ] `bench.md` has the gate view's baseline and a row after stages 2 and 3, each meeting §4.
- [ ] Screenshots `screenshots/m10/gate-*.png`, before (stage 1) and after:
  - from the boss arena's entry door, looking at the gate;
  - from mid-arena (36, 80, pitch 22°);
  - from the dais's foot, looking up (20, 75, pitch 35°);
  - from the north-west corner (8, 52), along the railing;
  - from Arena 3, looking west over its wall (whatever shows);
  - in a fight (`views-progress.mjs`): the Gatekeeper on the dais in front of the leaves.
- [ ] Compared side by side with the title painting: the same gate (golden arched leaves, white spired posts, gilded railings, sky and light behind).
- [ ] Decisions recorded in `decisions.md`.
- [ ] **Human checkpoint:** the human plays into the boss arena and judges the three reactions of the introduction. Changes from that playtest are review fixes on this spec.
