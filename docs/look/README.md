# The look: from prototype to finished game

**Status: planned**, drafted 2026-10-25, to start after R9 is accepted and merged. **Start here.**

The game plays the way it should; now it should look like it. Your concept (`assets/art-src/reference/look-compare.webp`) puts today's game on the left and the target on the right: the same room, enemies and moment, with modeled architecture, detailed characters, warm cinematic light and lava that burns. This folder is the plan to get there in five milestones, V1–V5, each ending in something you can play.

## What to expect

**Realistic:** a stylized, inked game of AA quality that reads as the same world as your concept: carved arcades and columns, vaulted corridors, armored enemies with engraved trim, warm light with glow, burning lava. **Not realistic:** the painting pixel for pixel. A concept is painted once from one angle; the game draws 1 500 enemies 60 times a second from anywhere, in a browser, on a laptop. Where they differ, readability and smooth play win.

## What you'll get

| Milestone | What changes on screen |
|---|---|
| [V1 Foundations and light](v1.md) | Warm sun and cool shade, glowing highlights, a color grade matched to your concept, darker corners. A Graphics setting (Low / Medium / High). Under it, the game draws less, so the rest has room. |
| [V2 Architecture](v2.md) | Modeled walls of recessed arches between clustered columns with carved gold capitals, tracery windows, molded doorways, open arcades with balustrades, arches closed by locked iron gates with an aisle glimpsed beyond, vaulted corridors, worn marble floors with gold inlays. |
| [V3 Characters](v3.md) | All twelve characters remade from detailed 3D models, sharper, in the same inked style, with the same silhouettes, colors and weapons. |
| [V4 Effects](v4.md) | Flowing lava with flames and embers, muzzle flashes that light the room, sparks, dust and debris, glowing abilities. |
| [V5 Props and finish](v5.md) | Decorations as 3D objects, props rendered from models, a final performance pass and your acceptance. Today's HUD stays (D7). |

V3 can run alongside V2 once V1 is done. Each milestone follows the rogue loop: Claude prepares the brief against the current code, you review it, Claude implements in stages with tests, you play and accept.

## What stays the same

Gameplay, rules, maps, networking, saves and the HUD (D7): every change is in how the game is drawn. Every wall is where it was and every shot hits what it hit before. Enemies stay readable by their colors and silhouettes, and state colors (violet slowed, red-hot bound, rusty gold censed) stay fixed. Characters stay flat sprites rendered from 3D models, which is why detail doesn't cost speed. The painted first-person weapons stay.

## Keeping it fast

You asked for the least possible cost in performance. The plan pays before it spends:

1. **Draw only what can be seen.** Rooms never see each other except through doors (the rule from M10), so the game draws only your room and what's visible through open doors. Today it draws the whole floor every frame.
2. **Compress the textures.** The character images alone take about 560 MB of graphics memory today; compressed, they take a quarter, which pays for sharper characters and surfaces.
3. **Bake the light.** Sunlight, shadows and the lava's glow are computed once when a level loads, not every frame.
4. **Merge and simplify.** All the architecture of a room is drawn in about two batches, with a simpler version for far away and for Low.
5. **Cheap glow.** One combined image pass at reduced resolution; at most four short-lived moving lights (muzzle flashes, explosions).

Each milestone has a hard budget in [spec.md](spec.md#5-budgets): **on Low, the game must end at least as fast as today**; Medium and High may cost more within fixed limits, and every setting must hold 58+ FPS with 1 500 enemies on the laptop (D5). If a measurement misses, Claude cuts extras in a fixed order, never readability. Benchmarks run only when you ask, as now.

## Decisions

Answered by Tomas on 2026-10-25 (guide step 0.2). Every brief and the spec follow these answers.

| | Decision | Answer |
|---|---|---|
| D1 | The target | Your concept (`look-compare.webp`; the target half at full resolution in `look-compare-full.jpeg`) and the four views you'll make from it in V1 |
| D2 | **Gated aisles**, not deep aisles. No aisle branches off a room and nothing new can be entered. The walls get richer art than flat boundaries: varied bays (tracery windows, blind arcades, empty niches) and, here and there, an arch closed by a locked wrought-iron gate with a short aisle glimpsed behind it, as on the left of your concept. The gate stands on the wall's line, so a shot hits the gate exactly where it hit the wall before | **Pilot first**: built in one room in V2 (stage 4); you decide after seeing it whether gated arches go everywhere they fit, only as shallow gated recesses, or nowhere |
| D3 | **Vaults** over corridors and gated aisles (combat rooms stay open to the sky) | Yes |
| D4 | **Character identity**: every character keeps its silhouette, colors and weapon; only the detail rises. The concept's mace-and-shield knights are not adopted for the Blessed (the mace stays the Dominion's) | Keep identities |
| D5 | **Machines** | The laptop (Intel Iris Xe) only: Medium must hold 58+ FPS with 1 500 enemies on it, and High too, or the game recommends Medium there |
| D6 | **Tools budget** | Meshy Pro month by month while V2–V5 need it |
| D7 | **HUD** | Keep today's HUD. V5 has no HUD redesign and no HUD frame images |

## Files in this folder

| File | For | What's in it |
|---|---|---|
| [guide.md](guide.md) | **you** | Step-by-step: what to make, when, where to save it, what to tell Claude |
| [prompts.md](prompts.md) | you | Every Gemini prompt: concept views, textures, kit sheets, ornaments, characters, props |
| [meshy.md](meshy.md) | you | How to turn the images into 3D models in Meshy (moved here from `docs/meshy-guide.md` and extended) |
| [spec.md](spec.md) | Claude (and you, if curious) | The technical rules, budgets, quality settings and pipelines every milestone follows |
| [v1.md](v1.md) … [v5.md](v5.md) | Claude, you review | Each milestone's outcome, stages, tests, your inputs, play checklist and start prompts |
| `v1-report.md` … | both | Written during each milestone: what changed, checks, screenshots, your feedback |

## Where files go

| Kind | You save in | Example |
|---|---|---|
| Concept views, kit sheets, character designs and sheets, ornament and prop sheets | `assets/art-src/reference/` | `look-concept-corridor.png`, `kit-wall-bay.png`, `blessed-meshy.png` |
| Textures | `assets/art-src/look/` | `tex-ashlar.png`, `tex-marble-floor.png` |
| Meshy downloads | `assets/art-src/models/<id>/` | `assets/art-src/models/blessed/rigged.glb` |

Use the exact names from [prompts.md](prompts.md). Never overwrite a file Claude has approved; a new try gets `-02`. Claude keeps the provenance in the [asset manifest](../rogue/asset-manifest.md) as for every asset.

## Related documents

[m10.md](../m10.md) (the rules about what may be drawn where, which this plan keeps), [bench.md](../bench.md) (how performance is measured), the [rogue art prompts](../rogue/art-prompts.md) (the earlier character sheets reused in V3), [development-workflow.md](../rogue/development-workflow.md) (the milestone loop).
