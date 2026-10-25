# The look: technical specification

**Status: planned**, drafted 2026-10-25 for after R9. Shared rules for milestones [V1](v1.md)–[V5](v5.md). Each milestone brief is prepared against the code that exists when it starts (the [rogue workflow](../rogue/development-workflow.md) loop); where a brief and this file disagree, the newer human decision wins and both are updated.

This file is Claude's reference. Tomas follows [guide.md](guide.md); the decisions in [README.md](README.md#decisions) feed into it.

## 1. Goal

Make a screenshot of the game read as the same world as the right half of `assets/art-src/reference/look-compare.webp` (`look-concept-arena.png`), and as the concept pack made in V1 (`look-concept-<view>.png`):

- **Architecture with real depth.** Pointed arcades on clustered columns with carved capitals, recessed bays, tracery windows, vaulted ceilings over corridors and aisles, molded doorways, worn marble and gold. Today the walls are flat painted boxes.
- **Light with range.** Warm sun and cool shade, visible light shafts and dust, bright highlights that bloom, a warm color grade, and lava that lights its surroundings.
- **Detailed characters.** Armor, cloth and props modeled, not assembled from primitives, rendered in the inked cel style at a higher resolution.
- **Effects with body.** Lava that flows and burns with flames and embers; sparks, dust and debris on hits; muzzle flashes that light the room.
- **A finished HUD** matching the concept: portrait, HP and shield bars, weapon panel with ammo.

The target is a stylized, inked look of AA quality, not photorealism and not the painting pixel for pixel. Success is judged by Tomas on fixed screenshot views placed beside the concepts ([§9](#9-acceptance-views)) and in play.

## 2. What does not change

- **Gameplay and protocol.** Simulation, collision, heights (`map.top`, `solid`), line of sight, damage, timing, the network protocol and saves. Everything in V1–V5 is client-side drawing and loading. No protocol or save version changes.
- **The M10 visibility guarantees** ([m10.md](../m10.md) §1, §3): zones never see each other except through doors; drawn-only scenery stands only where nothing in play can be behind or under it, as relief at most `RELIEF` = 0.12 m in front of a wall face, as a recess behind it, or at or above the zone top. Every new piece of architecture obeys them, and the existing tests (M10 §8.1) stay green.
- **Characters stay billboard sprites** rendered offline from 3D models into atlases, so 1 500 enemies cost the same however detailed a model is. Same animation names, frame counts, direction counts and anchor rules, so the game code that plays them doesn't change.
- **Readability rules** ([art-prompts.md](../art-prompts.md#telling-enemies-apart), [rogue art-prompts](../rogue/art-prompts.md#telling-things-apart), M10 §1): white and gold enemies with dark outlines stand out against everything; state colors stay fixed (bound: red-hot chains; slowed: violet; taunted: trembling red; censed: rusty gold); green only for healing, blue only for shields; floors mid-to-light and low in contrast. A grade, glow, texture or fog that makes an enemy, projectile, hazard edge or state hard to read is wrong.
- **First-person weapons** (painted, M11) stay; only their light tint follows the new grade.
- **Determinism.** Every client builds the same world from the level data, as `looks.ts` does today. No randomness without the floor seed.

## 3. Rules that replace M10's

M10 §1 forbade post-processing and real-time lights to stay cheap. This overhaul pays for them first ([§4](#4-paying-for-it)), then allows them within budgets:

| M10 rule | From V1 |
|---|---|
| No post-processing | **One post chain** on Medium and High: the scene into a half-float target, a bloom mip chain, and **one** composite pass (exposure, tone mapping, color grade, vignette, grain). No SSAO, SSR, depth of field or motion blur. Low draws straight to the screen as today. |
| No real-time lights | **At most 4 dynamic glow lights** (point lights, no shadows), evaluated per pixel only in the scenery shaders and per vertex for billboards. Static light (sun, sky, lava, braziers, windows) stays baked. |
| Geometry only where an edge shows | **Modeled architecture kit** ([V2](v2.md)), merged per zone, with two levels of detail. The visibility guarantees of §2 still bound where it may stand. |
| Bake, don't compute | **Unchanged.** Sun, shadow, ambient occlusion and static glow are computed once per level (and once per kit piece in Blender). |
| No large transparent areas | **Unchanged.** Arcades are modeled or alpha-tested, never blended. |
| Ink outlines painted into textures | **Baked**: crease and cavity lines are baked into each kit piece's occlusion map in Blender; silhouette outlines of columns, ribs and arches are inverted hulls at LOD0. No screen-space outline pass. |

New visibility rule, **deep aisles** (decision D2): behind a *Wall* run that faces void, the drawing may open an arcade into an aisle that lies entirely over void and wall cells of no other zone, with a closed back wall. Nothing in play can be there, so it hides nothing. The simulation's wall face is unchanged: a shot into an opening stops at that face, and the client draws its impact as a faint gold ripple on the opening's plane (the aisle's "ward"), never as an impact on stone behind it. The aisle and its ward ripple must be checked by a test that every aisle cell is void or wall of no other zone and that no aisle geometry lies in front of the wall face.

## 4. Paying for it

The cheapest frame is the one that draws less. The overhaul first removes cost the game doesn't need, then spends part of it on detail. In order of saving:

1. **Portal culling by zone** (V1 stage 3). The terrain is one merged mesh today, so every wall of the floor is drawn every frame. Because zones see each other only through doors (§2), the scenery is split into one chunk per zone (and per door frame), and each frame draws the camera's zone plus the zones whose doors' rectangles are visible through the chain of open doors (a recursive portal test against the frustum, a few rectangles per frame). A unit test proves it conservative: for sampled eye positions in every zone, every scenery triangle a ray from the eye can reach belongs to a drawn chunk.
2. **Compressed textures** (V1 stage 2). Sprite atlases alone are about 560 MB of GPU memory as RGBA8 with mipmaps today (Blessed 83 MB, Gatekeeper 80 MB). KTX2 with Basis UASTC transcodes to BC7 on the reference GPU at 1 byte per pixel, a quarter; ETC1S (smaller download, lower quality) is allowed for large soft images such as the sky and clouds. Every compressed asset keeps a PNG/JPEG fallback, used when the browser lacks a compressed format. The saving pays for higher sprite resolution (V3) and 2 048 px surfaces (V2).
3. **Merge and batch.** Kit pieces are merged per zone chunk into one mesh per material family, all surfaces in one texture array (as `textureArray.ts`), so a zone costs about two draw calls whatever it contains. Instancing only where merging would cost too much memory (repeated identical columns in a large hall).
4. **Two levels of detail per kit piece.** LOD1 has about a third of LOD0's triangles and no outline hull. Low always uses LOD1; Medium and High switch per chunk by distance.
5. **Bake everything static.** Kit pieces carry Blender-baked occlusion and ink lines in a texture; the level build bakes sun visibility into vertex colors (reusing the wall faces' shadow lines from `lightmap.ts`) and static glow (lava, braziers, windows) into a colored lightmap.
6. **Cheap post.** Bloom starts at half resolution (quarter on Medium) and works down a mip chain; the composite is one full-screen triangle with one lookup table. The scene target is resolved once.
7. **Bounded effects.** Particles are GPU-instanced, one draw call per blend mode, animated in the vertex shader from one time uniform, as today's `particles.ts` caps them (`MAX_PARTICLES` = 4 000).

## 5. Budgets

**Baseline:** the R9-accepted build, recorded in V1 stage 1 on the reference laptop (Intel Iris Xe, 1 920 × 1 080, Chromium; [bench.md](../bench.md)) with the M10 method: the gate views with 1 500 enemies, uncapped frame time (median of 3), capped FPS and 1%-low, draw calls, triangles and texture MB from `renderStats()`, plus first-load download size, level build time and the time from Start to control.

Limits at the end of V5, on the worst gate view, per quality tier:

| Measure | Low | Medium | High |
|---|---|---|---|
| Capped FPS on the reference laptop | ≥ 58 | ≥ 58 | ≥ 58 on the High reference machine (D5); on the laptop the game may choose Medium |
| Uncapped frame time | ≤ baseline | ≤ baseline + 20% | ≤ baseline + 45% |
| Draw calls | ≤ baseline + 12 | ≤ baseline + 24 | ≤ baseline + 24 |
| Visible triangles | ≤ 300 000 | ≤ 600 000 | ≤ 600 000 |
| GPU texture memory | ≤ 60% of baseline | ≤ baseline | ≤ baseline |
| First-load download | ≤ baseline + 25%, all tiers (one set of files) |||
| Level build | ≤ baseline + 400 ms |||
| Start to control | ≤ baseline + 2 s |||
| Per-frame JavaScript | ≤ +0.5 ms (portal culling, light list, particle writes) |||
| Simulation | unchanged: average ≤ 8 ms per tick (MVP §13.1) |||

Allocation of the frame-time increase, so one milestone can't spend the rest: post chain 15% (High) / 8% (Medium); architecture 15% / 7% after culling's saving; characters 0% (same sprite cost); effects and lights 10% / 5%; HUD 0%; reserve 5%. Each milestone brief restates its share.

`renderStats()` assumes RGBA8; V1 stage 2 makes it count each texture's real bytes per pixel (compressed formats included).

### Measuring

- **Every stage, automatically:** unit tests for placement, culling and determinism, plus an end-to-end **render budget test** that loads fixed seeds and views and asserts draw calls, triangles, texture MB and level build time against the limits above. Counts are deterministic, so this runs with the normal suites.
- **Frame time only on request.** `npm run bench` is run only when Tomas asks, after playing the build (project rule). Each milestone names the recommended moments. Builds are compared back to back (the laptop drifts 5–10% between sessions), never two benchmarks at once.
- **If a measured run misses its budget,** a miss within the run's spread is rerun first. Then cut in this order, recording each cut in the milestone report: grain and vignette → heat shimmer → bloom levels and resolution → dynamic light count → particle counts → outline hulls → LOD switch distance → deep aisles become recessed bays → surfaces 2 048 → 1 024 px → MSAA → FXAA. Never cut readability, culling or compression.

## 6. Quality tiers

One setting, **Graphics: Low / Medium / High**, in the existing Settings view (`src/ui/volume.ts`, beside the sliders), stored per browser. Default Medium. If the frame time in the first combat room averages over 15 ms for 10 s, the pause menu shows a one-time suggestion to try Low; the game never switches tiers by itself during a fight.

| | Low | Medium | High |
|---|---|---|---|
| Render path | straight to the screen | half-float target | half-float target |
| Pixel ratio cap | 1.0 | 1.25 | 1.5 (today's) |
| Anti-aliasing | MSAA from the canvas | MSAA 2× | MSAA 4× |
| Tone mapping and grade | baked into the lightmap's tint only | yes | yes |
| Bloom | none | quarter resolution, 3 levels | half resolution, 5 levels |
| Vignette, grain | none | vignette | both |
| Kit detail | LOD1 | LOD0 near, LOD1 far | LOD0 near, LOD1 far |
| Outline hulls | none | LOD0 only | LOD0 only |
| Surface textures | 1 024 px | 2 048 px | 2 048 px |
| Dynamic lights | 0 | 2 | 4 |
| Particles | 50% of each effect's count | 75% | 100% |
| Heat shimmer over lava | none | none | yes |

**Fairness:** tiers change detail, never what is visible or hidden in play. Every level of detail obeys §2; no tier adds fog, glow or darkness that hides an enemy. Co-op players on different tiers see the same play space.

## 7. Pipelines and files

| Kind | Made with | Source (Tomas saves) | Built by Claude | Runtime |
|---|---|---|---|---|
| Concept views | Gemini, from Claude's screenshots | `assets/art-src/reference/look-*.png` | | never shipped |
| Surface textures | Gemini | `assets/art-src/look/tex-*.png` | seamless, resized, a height-derived normal map, KTX2 (`scripts/tex_prep.py`) | `assets/textures/look/*.ktx2` |
| Kit references | Gemini (model sheets) | `assets/art-src/reference/kit-*.png` | modeled in Blender by script (`scripts/blender/kit/*.py`): high poly → baked normal, occlusion and ink → LOD0/LOD1 | `assets/kit/*.glb` (meshopt-compressed) |
| Ornaments | Gemini → Meshy (static) | `assets/art-src/models/orn-*/model.glb` | decimated, baked, joined to the kit | inside `assets/kit/*.glb` |
| Characters | Gemini → Meshy (rigged) | `assets/art-src/models/<id>/` ([meshy.md](meshy.md) §6) | textured cel material, ink hull, 8 directions × frames (`scripts/blender/meshy_char.py` + `common.py`) | `assets/sprites/<id>/atlas.ktx2` + `atlas.json` |
| Flipbooks | Blender simulation by Claude | | `scripts/blender/fx/*.py` | `assets/textures/look/fx-*.ktx2` |
| HUD frames | Gemini | `assets/art-src/look/hud-*.png` | cut out, sliced | `assets/ui/` |

Tools: Blender 5.2 (installed, headless as today); KTX-Software `toktx` or `basisu` and `@gltf-transform/cli` (Claude asks before installing; dev-only); three's `KTX2Loader` and `MeshoptDecoder` from `three/examples/jsm` (the Basis transcoder files copied into `public/`). Provenance goes into [asset-manifest.md](../rogue/asset-manifest.md) as for every asset. Git LFS already stores images and models (`.gitattributes`); `.ktx2` and `.glb` are added if missing.

## 8. Code map

| Area | Today | Changed by |
|---|---|---|
| `src/render/scene.ts` | one renderer, one scene, `render()` straight to the canvas | V1: tier, render target, post chain, culling hook |
| new `src/render/post.ts` | | V1: HDR target, bloom, composite, LUT |
| new `src/render/quality.ts` | | V1: the tier table above as data |
| new `src/render/portals.ts` | | V1: zone chunks, door portals, visible set |
| `src/render/textures.ts`, `atlas.ts`, `animAtlas.ts`, `textureArray.ts` | PNG/JPEG loads | V1: KTX2 with fallback |
| `src/render/terrain.ts`, `looks.ts`, `relief.ts`, `arches.ts`, `gate.ts` | painted walls, relief strips, cut-out arcades | V2: kit placement replaces painted bays; floors stay heightfield |
| `src/render/terrainMaterial.ts`, `lightmap.ts` | one layer per vertex, luminance lightmap | V1: colored lightmap, glow sources; V2: normal maps, one directional sun term, dynamic lights |
| `src/render/billboards.ts`, `contactShadows.ts` | lightmap tint per vertex | V1: HDR-aware tint, contact shadows in the target's alpha; V4: dynamic lights per vertex |
| `src/render/particles.ts`, `vfx.ts`, `atmosphere.ts`, `incense.ts`, `src/client/fireView.ts`, `hazards.ts` | | V4 |
| `src/client/hud.ts`, `partyFrames.ts`, `src/ui/` | | V5 |
| `scripts/blender/common.py` and character scripts | primitive models | V3: `meshy_char.py` imports Meshy models; the primitive scripts stay until each character is replaced |
| `scripts/views.mjs`, `views.json`, `scripts/bench.mjs` | M10 views on the fixed map | V1: rogue look views, tier flag |

## 9. Acceptance views

V1 stage 1 adds a `look` group to `scripts/views.json` and captures each view without the HUD as `screenshots/look/<build>-<view>.png`. Views (rogue floors at fixed seeds; exact seeds chosen in V1 stage 1):

| View | Shows | Concept |
|---|---|---|
| `arena` | the room and angle of the Sacrilege shot, swarm present | `look-concept-arena.png` (exists) |
| `corridor` | a corridor between two rooms, looking along it | `look-concept-corridor.png` |
| `terrace` | an open edge: arcade, balustrade, sky and clouds | `look-concept-terrace.png` |
| `refiner` | the Refiner's Court with its lava channels | `look-concept-refiner.png` |
| `gate` | the boss arena before the Gatekeeper | `look-concept-gate.png` |
| `swarm-far` | 1 500 enemies at 40 m, the readability check | none (readability only) |

Each milestone report shows before/after pairs of these views next to their concept at the same size. Tomas's verdict on them, and in play, is the acceptance.

## 10. Verification

As every stage of the project ([AGENTS.md](../../AGENTS.md)): new tests for changed behavior; `npm test`, `npm run typecheck` and `npm run build` every stage; the end-to-end suites when loading, sessions or player-facing behavior change (every V stage touches loading or presentation, so the render budget test and the loading tests run every stage). Reports state exact commands and results and separate passed, blocked and unrun checks. Automated checks never replace Tomas's look and feel acceptance.

Tests worth having throughout: kit placement determinism (same input, identical buffers); the §2 geometry rules for every placed piece and aisle; portal culling conservativeness; LUT readability (each state color and the enemy palette through the grade stays within ΔE 6 of its intended color, and the luminance contrast of an ivory enemy against the graded floor and sky stays at least today's); KTX2 fallback when the format is missing; atlas JSON compatibility of re-rendered characters (same animation names, frame counts, directions).
