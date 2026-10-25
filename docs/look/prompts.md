# The look: image prompts

Every image the look overhaul needs, each with a ready-to-paste Gemini prompt, what to attach, the file name, the aspect ratio and what to check. The order you make them in, and when, is in [guide.md](guide.md). Images for Meshy go on through [meshy.md](meshy.md).

## How to use (Gemini)

The same routine as the [rogue art prompts](../rogue/art-prompts.md#how-to-use-gemini):

1. **Start a new chat for each image** and **attach exactly the listed files**, nothing more. Existing references are in `assets/art-src/reference/`, existing game art in `assets/art-src/`.
2. **Pilot first.** Each family has one pilot (marked *pilot*). Make it, save it, tell Claude, and wait until Claude has tried it in the game and you've seen it there. Then attach the **approved pilot** to every other prompt of that family (each prompt lists it). This is what keeps a family consistent.
3. **Aspect ratio:** each prompt ends with one. If the image comes out in another shape, reply *"Make it W:H"*.
4. **Resolution:** the largest Gemini offers (2 048 px for textures if available).
5. **One fix at a time.** If one detail is wrong, reply with only that fix (*"Same image, but the capitals are gold, not grey"*). Start over only if two or more things are wrong.
6. **Never** keep an image with text, letters, numbers, labels or watermarks in it.
7. **Save as PNG** with exactly the given name, in the folder the checklist gives. If Gemini downloads a JPEG, save it anyway under the name with `.jpg`; Claude converts it. Never overwrite an approved file: a replacement gets `-02`, `-03`.

## Checklist

**Folders:** `L`, `K` and `C` sheets go in `assets/art-src/reference/`; `T` and `H` in `assets/art-src/look/`; `O` and `P` sheets in `assets/art-src/reference/`, their Meshy models in `assets/art-src/models/<id>/`.

**L Concept views** (V1, for the color grade and as targets for everything after)
- [x] `look-concept-arena.png` (exists: the right half of your comparison)
- [ ] L1 `look-concept-corridor.png` · L2 `look-concept-terrace.png` · L3 `look-concept-refiner.png` · L4 `look-concept-gate.png` (after Claude saves the matching `look-today-*.png`)

**T Surface textures** (V2; T7 by V4)
- [ ] T1 `tex-marble-floor.png` (pilot) · T4 `tex-ashlar.png` (pilot)
- [ ] T2 `tex-marble-border.png` · T3 `tex-marble-medallion.png` · T5 `tex-limestone.png` · T6 `tex-gold-leaf.png` · T7 `tex-lava.png` · T8 `tex-vault.png` · T9 `tex-stained-glass.png` · T10 `tex-cliff-rock.png`

**K Kit reference sheets** (V2; Claude models from them)
- [ ] K1 `kit-wall-bay.png` (pilot) · K2 `kit-pillar.png` · K3 `kit-doorway.png` · K4 `kit-arcade.png` · K5 `kit-vault.png` · K6 `kit-profiles.png`

**O Ornaments and decorations for Meshy** (O1–O2 in V2, O3–O7 in V5)
- [ ] O1 `orn-capital.png` (pilot) · O2 `orn-boss.png`
- [ ] O3 `orn-angel-statue.png` · O4 `orn-candelabrum.png` · O5 `orn-lily-urn.png` · O6 `orn-harp.png` · O7 `orn-fountain.png`

**C Characters for Meshy** (V3, in this order; each needs its design, its Meshy sheet and its parts)
- [ ] C1 Blessed (pilot): `blessed-design.png`, `blessed-meshy.png`, `blessed-sword.png`
- [ ] C2 Watchman: `watchman-helmet.png` (the body is the Blessed's; `watchman-clarion.png` exists)
- [ ] C3 Chorister: `chorister-design.png`, `chorister-meshy.png`
- [ ] C4 Cherub: `cherub-design.png`, `cherub-meshy.png`, `cherub-wings.png`, `cherub-bow.png`
- [ ] C5 Dominion: none if Claude passes the existing `dominion-turnaround.png`; otherwise `dominion-meshy.png`
- [ ] C6 Lectern Cantor: `cantor-wings.png`; `cantor-meshy.png` only if the existing turnaround fails
- [ ] C7 Stray-Carrier: none if the existing sheets pass; otherwise `carrier-meshy.png`
- [ ] C8 Gatekeeper: `gatekeeper-design.png`, `gatekeeper-meshy.png`, `gatekeeper-wing.png` (`gatekeeper-trumpet.png` exists)
- [ ] C9–C12 Players: `<id>-design.png` and `<id>-meshy.png` for `fallen`, `heretic`, `binder`, `betrayer`; weapon sheets only if Claude finds the existing `weapon-*-sheet.png` unusable

**P Props for Meshy** (V5)
- [ ] P1 `prop-amphora-tall.png` (pilot) · P2 `prop-amphora-squat.png` · P3 `prop-amphora-lily.png` · P4 `prop-amphora-marked.png` · P5 `prop-sanctuary-lamp.png` · P6 `prop-blessing-chalice.png`

**H HUD frames** (V5)
- [ ] H1 `hud-portrait-frame.png` (pilot) · H2 `hud-bars-frame.png` · H3 `hud-weapon-panel.png`

**Totals:** 4 concept views, 10 textures, 6 kit sheets, 7 ornament sheets, about 20 character images, 6 prop sheets, 3 HUD frames.

---

## The style sentences

Every prompt contains its style sentence in full; they're listed here so you can see they're identical everywhere. Never edit one prompt's style sentence alone.

| Name | Used by | Text begins |
|---|---|---|
| **Inked** | character designs | *Art style: stylized 3D game art with a hand-inked graphic-novel finish …* (the existing sentence of every character front) |
| **Flat sheet** | Meshy sheets (C, O, P) | *Colors as a flat color reference for texturing: every surface in its own true color, evenly lit …* (the existing Meshy sentence) |
| **Kit sheet** | K | *Clean architectural model sheet: flat even colors, thin dark lines …* |
| **Surface** | T | *Hand-painted stylized texture matching the attached image …* (the existing texture sentence, with *Even, flat lighting*) |

---

## L Concept views

Claude saves a screenshot of today's game for each view (`look-today-<view>.png`, no HUD). You repaint it the way your arena concept was made. These become the targets every milestone is compared with, and the color grade is fitted from the before/after pairs, so **keep the layout exactly**.

All four use this prompt with the `<VIEW>` sentence of each. Attach, in this order: `look-today-<view>.png`, `look-today-arena.png`, `look-concept-arena.png`.

```text
The first attached image is a screenshot of our game. The second attached image is another screenshot of the same game, and the third is that second screenshot repainted as a high-end version of the game. Repaint the first image in exactly the way the second image became the third: the same art style, level of detail, lighting, color and atmosphere as the third image. Keep the first image's layout exactly: the camera, every wall, floor edge, step, door, pit and opening stays where it is, the same size. You may add depth the way the third image does: recessed pointed arches and clustered columns with carved gold capitals set into the wall faces, tracery windows, molded cornices and bases, worn marble floors with gold inlays, light shafts and dust in the air. Do not move walls, do not open new passages, do not add rooms. Characters and effects in the first image stay where they are, in the third image's level of detail. <VIEW> No HUD, no interface, no text, no letters, no numbers. Aspect ratio 16:9.
```

| ID | File | `<VIEW>` |
|---|---|---|
| L1 | `look-concept-corridor.png` | This is a corridor between two halls: above the top of the walls, a pointed rib vault closes over the corridor, pale stone ribs meeting at a carved gold keystone, lit warmly where sunlight falls through the door ahead. |
| L2 | `look-concept-terrace.png` | This is an open terrace at the edge of a floating cathedral: the open side is an arcade of pointed arches on slender columns above a carved stone balustrade, with the bright painted sky and sea of clouds seen through it. |
| L3 | `look-concept-refiner.png` | The sunk channels in the floor are rivers of molten lava with a cracked black crust, flames licking along their gold-rimmed edges and embers rising, casting a warm orange glow on the nearby floor, walls and figures. |
| L4 | `look-concept-gate.png` | This is the final hall before the Pearly Gates: taller and grander than the other halls, the architecture of a cathedral nave with deeper carving and more gold, the great pearl-and-gold gate glowing at the far end. |

**Check before saving:** the walls, doors and floor shapes are where they are in the screenshot (lay them side by side); no HUD or text; the same look as `look-concept-arena.png`. If Gemini moves a wall or opens a passage, reply *"Keep every wall exactly where it is in the first image."*

---

## T Surface textures

Each texture covers a 4 × 4 m area and repeats. On the new architecture the **shape comes from the 3D model**, so these show only the surface: stone grain, veining, wear, painted joints. Claude makes them seamless, derives the bump map and checks them in the game. Generate at 2 048 px. Attach to each: `look-concept-arena.png`, and once approved, the family pilot (T1 for floors, T4 for walls and stone).

#### T1 Marble floor — `tex-marble-floor.png` · 1:1 · pilot
```text
Seamless tileable game texture, viewed straight down, orthographic, filling the whole square: a polished ivory-white marble floor of exactly 2 × 2 large square tiles, separated by thin inlaid gold lines, soft grey and pale gold veining that wanders across the tiles, a slightly warmer tone in one tile than another, light wear and faint scuffs on the polish. Hand-painted stylized texture matching the floor in the attached image: painterly brush texture, low-to-medium contrast, crisp thin dark ink-like lines only along the gold joints. Even, flat lighting: no shadows, no highlights, no reflections, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```
**Check:** calm enough that a white enemy stands out on it; no reflections of windows or light painted in; four whole tiles.

#### T2 Marble border — `tex-marble-border.png` · 21:9
```text
Game texture, viewed straight down, orthographic: a long horizontal border band of a marble floor, seamless from left to right, filling the whole image: a central strip of warm grey-veined marble between two thin gold inlay lines, with a simple repeating motif of small gold lilies inlaid along its middle at even spacing. Hand-painted stylized texture matching the floor in the attached images: painterly brush texture, low contrast, thin dark ink-like lines along the gold inlay. Even, flat lighting: no shadows, no highlights, no perspective. The left edge continues the right edge. No text. Aspect ratio 21:9.
```
Attach also: `tex-marble-floor.png`. **Check:** the motif repeats evenly; the band is a different stone from T1 but matches it.

#### T3 Medallion — `tex-marble-medallion.png` · 1:1
```text
Game texture, viewed straight down, orthographic, filling the whole square: an ivory-white marble floor with one large circular medallion inlaid in the center, 85% of the width: concentric rings of gold and warm grey marble, a sunburst of 16 thin gold rays, and an eight-petal lily in the middle, with fine gold scrollwork, light wear on the gold. Outside the circle, plain marble matching the attached floor. Hand-painted stylized texture matching the attached images: painterly brush texture, low-to-medium contrast, thin dark ink-like lines on every gold line. Even, flat lighting: no shadows, no highlights, no perspective. No text. Aspect ratio 1:1.
```
Attach also: `tex-marble-floor.png`. **Check:** the corners are plain marble that continues into T1.

#### T4 Ashlar wall — `tex-ashlar.png` · 1:1 · pilot
```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: a wall of warm ivory sandstone blocks laid in staggered courses, eight courses of blocks, each block with slightly rounded worn edges, subtle color variation from cream to pale honey, faint weathering stains and a few small chips. Hand-painted stylized texture matching the stone walls in the attached image: painterly brush texture, crisp dark ink-like lines along the joints. Even, flat lighting: no shadows, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```
**Check:** no frieze, window or carving in it (those are 3D now); joints form a regular grid of courses.

#### T5 Limestone — `tex-limestone.png` · 1:1
```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: smooth carved pale ivory limestone, as on the surface of a column or a carved molding, a fine even grain, very subtle cream and grey mottling, faint tool marks and gentle weathering. No blocks, no joints, no carving, no pattern. Hand-painted stylized texture matching the columns in the attached images: painterly brush texture, low contrast. Even, flat lighting: no shadows, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```
Attach also: `tex-ashlar.png`. **Check:** almost plain; the same stone family as T4.

#### T6 Gold leaf — `tex-gold-leaf.png` · 1:1
```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: worn gold leaf over carved stone, as on the capitals and moldings of a cathedral, warm polished gold with soft variations from pale yellow gold to deep honey, small patches where the gold has worn thin, very fine burnish streaks. No pattern, no carving, no engraving. Hand-painted stylized texture matching the gold in the attached image: painterly brush texture. Even, flat lighting: no shadows, no shine spots, no reflections, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```
**Check:** no painted shine or reflections (the game adds light); not orange, not brown.

#### T7 Lava — `tex-lava.png` · 1:1
```text
Seamless tileable game texture, viewed straight down, orthographic, filling the whole square: a river of molten lava, glowing yellow-orange and white-hot in its flowing cracks, broken by drifting plates of cracked black crust with dark red edges, the flow direction from left to right. Hand-painted stylized texture matching the lava in the attached image: painterly brush texture, crisp dark ink-like edges on the crust plates. Even lighting, the glow coming only from the lava itself: no shadows, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```
Attach also: `tex-refiner-channel.png`. **Check:** about half crust, half molten; no flames (the game adds them).

#### T8 Vault — `tex-vault.png` · 1:1
```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: the curved stone web of a cathedral vault between its ribs, pale ivory plaster over stone, with a scattering of small faded gold stars painted on it, faint cracks and age stains. No ribs, no joints, no carving. Hand-painted stylized texture matching the architecture in the attached image: painterly brush texture, low contrast. Even, flat lighting: no shadows, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```
Attach also: `tex-limestone.png`. **Check:** the stars are sparse and faded, not a starry sky.

#### T9 Stained glass — `tex-stained-glass.png` · 9:16
```text
Game texture, viewed straight on, orthographic, filling the whole image: one tall pointed lancet window panel of stained glass, seen from inside a sunlit cathedral: pale gold, cream and soft sky-blue glass pieces in a simple pattern of lilies and rays rising toward the pointed top, held by thin dark lead lines, the glass glowing evenly with daylight from behind. No stone frame, no tracery, no figures, no faces. Hand-painted stylized texture matching the windows in the attached image: painterly brush texture, crisp dark lead lines. No shadows, no vignette, no perspective. No text. Aspect ratio 9:16.
```
**Check:** pale and light (it glows in the game); no red, green or violet glass (those colors mean states and healing).

#### T10 Cliff rock — `tex-cliff-rock.png` · 1:1
```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: the rough underside of a floating island of pale golden-grey rock, cracked into large angular faces with vertical streaks of weathering, a few small roots and pale moss in the cracks. Hand-painted stylized texture matching the attached image: painterly brush texture, crisp dark ink-like lines along the main cracks. Even, flat lighting: no shadows, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```
**Check:** lighter than the ashlar, so cliffs fade into the cloud sea.

---

## K Kit reference sheets

Claude builds the architecture in Blender from these; they're never shown in the game. Each shows one piece in several orthographic views. The sizes in the prompts are the game's grid: keep them in the image's proportions.

**Attach only `look-concept-arena.png`.** If Gemini draws a game scene instead of a sheet, start a new chat with no attachment at all. After the pilot is approved, also attach `kit-wall-bay.png` to the others.

All six use this template with the `<PIECE>` and `<VIEWS>` of each:

```text
This is not a game screenshot and not a scene: no characters, no HUD, no floor, no sky, no landscape. Only one piece of architecture, drawn as a model sheet for a 3D artist. <VIEWS>, side by side on a plain light grey background, at exactly the same scale, aligned, orthographic with no perspective. The piece: <PIECE> The architecture's style matches the attached image: warm ivory stone with gold leaf on the capitals and moldings, gothic pointed arches, crisp carved detail. Clean architectural model sheet: flat even colors, thin dark lines along every edge and carved line, no shading, no cast shadows, no highlights. Every view complete and uncropped. No text, no letters, no numbers, no measurements, no arrows. Aspect ratio 16:9.
```

| ID | File | `<VIEWS>` | `<PIECE>` |
|---|---|---|---|
| K1 *pilot* | `kit-wall-bay.png` | Three views: the front elevation on the left, a vertical cross-section through the middle in the center, and the plan seen from above on the right | one 4 m wide bay of a cathedral wall, 10 m tall. A pointed arch 3 m wide and 6.5 m high is recessed about 0.9 m into the wall, framed on each side by an engaged clustered half-column (three slender round shafts bundled together) with a carved foliage capital in gold at 5 m and a molded base. Inside the recess, a tall pointed window with simple stone tracery (two lancets and a quatrefoil above). Above the arch, a flat band of ivory stone, then a carved frieze and a projecting molded cornice at the top. A molded plinth runs along the foot of the wall. The columns stand no further forward than a hand's width from the wall face. |
| K2 | `kit-pillar.png` | Three views: the front elevation on the left, the side elevation in the center, and the plan seen from above on the right | one free-standing clustered pillar, 1 m square in plan and 10 m tall: four round shafts bundled around a square core, a carved foliage capital in gold at 7 m that stays within the 1 m square, a plain block above it to the top, and a molded square base 0.4 m tall. Nothing projects beyond the square plan. |
| K3 | `kit-doorway.png` | Two views: the front elevation on the left and the plan seen from above on the right | a grand pointed doorway 3 m wide and 4.5 m high in a thick wall, its jambs stepped back in three molded orders that recede into the wall, a pointed arch of the same molded orders above, and a carved tympanum above the opening with a gold lily in a circle. The wall around it is plain. |
| K4 | `kit-arcade.png` | Two views: the front elevation on the left and a vertical cross-section in the center, plus the plan seen from above on the right | one 4 m wide bay of an open arcade at the edge of a terrace, 8 m tall: a carved stone balustrade 1.4 m high with fat round balusters and a flat top rail across the bottom of the bay, two slender round columns with gold capitals rising from it, and a pointed arch between them, open to the sky, with a molded cornice on top. |
| K5 | `kit-vault.png` | Three views: a cross-section across the corridor on the left, the plan of the vault seen from below in the center, and a long section along the corridor on the right | one 4 m long bay of a rib vault over a corridor 4 m wide: the vault springs from the tops of the walls at 6 m and rises in a pointed curve to 9 m; two diagonal ribs and two cross ribs of molded stone meet at a round carved keystone boss with a gold lily; the curved webs between the ribs are plain plaster. |
| K6 | `kit-profiles.png` | Five cross-section profiles side by side, each a solid dark silhouette on the grey background, each with a matching small front view under it | the moldings of the walls: a base plinth 0.5 m tall, a string course 0.3 m, a frieze band 0.8 m with a simple leaf pattern on its front, a projecting cornice 1.5 m tall with dentils, and a balustrade rail 0.3 m. |

**Check before saving:** one piece only, nothing else; views that match each other (the section really is a cut through the front); no text or numbers. For K1, the half-columns hug the wall and the arch is clearly set back into it.

---

## O Ornaments and decorations for Meshy

Static models Meshy makes and Claude bakes into the architecture. Same model-sheet rules as the characters ([meshy.md](meshy.md) §2): flat colors, grey background, three views. Claude cuts each sheet into `orn-<id>-mv-front.png`, `-mv-side.png`, `-mv-back.png`.

All seven use this template with the attachments and `<OBJECT>` of each. After the pilot is approved, also attach `orn-capital.png`.

```text
Model sheet for 3D modeling of one object, copying the attached images where they show it: three full views side by side, from left to right: front, right side, back. All three at the same scale, standing on one shared baseline, orthographic with no perspective, evenly spaced with a wide gap between them, nothing overlapping. The object: <OBJECT> Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no hatching, no highlights, no rim light, no glow and no light direction at all; thin dark lines only where two colors or parts meet, no thick outer contour. Plain flat medium grey (#808080) background, no floor, no shadows, no text, no labels, no arrows, no extra objects. Aspect ratio 16:9.
```

| ID | File | Attach | `<OBJECT>` |
|---|---|---|---|
| O1 *pilot* | `orn-capital.png` | `look-concept-arena.png`, `kit-wall-bay.png` | a gothic column capital for three bundled shafts, as tall as it is wide: two rows of curling acanthus and lily leaves in gold leaf over ivory stone, a square molded abacus on top, a round astragal ring at the bottom. |
| O2 | `orn-boss.png` | `look-concept-arena.png`, `kit-vault.png` | a round keystone boss from a rib vault, seen as a thick carved disc: a gold lily in a ring of small carved leaves, with the stubs of four molded stone ribs leaving it at right angles. |
| O3 | `orn-angel-statue.png` | `decor-angel-statue.png`, `look-concept-arena.png` | the attached angel statue as a white marble sculpture 3 m tall on a square plinth, its wings folded behind it, its hands joined in prayer, gold leaf on the edges of the robe and the plinth's molding. |
| O4 | `orn-candelabrum.png` | `decor-candelabrum.png` | the attached candelabrum, 1.8 m tall, in polished gold: a tall shaft on a three-footed base, seven branches with white candles. The flames are left out. |
| O5 | `orn-lily-urn.png` | `decor-lily-urn.png` | the attached urn, 1.0 m tall, ivory marble with gold handles and rim, filled with white lilies. |
| O6 | `orn-harp.png` | `decor-harp.png` | the attached harp, 1.4 m tall, gold frame with a carved angel head at the top; the strings drawn as a flat pale panel between the frame instead of separate strings. |
| O7 | `orn-fountain.png` | `decor-fountain.png` | the attached fountain, 2 m tall, ivory marble basin and gold spout; the water left out, the basin's inside flat pale blue. |

**Check before saving:** three views of the same object; no light or shading painted on it (left and right sides the same color); no flames, water spray or glow.

---

## C Characters for Meshy

Three kinds of image per character, in this order: the **design** (the look, inked, on green), the **Meshy sheet** (flat colors, grey, A-pose, no weapon or wings) and the **parts** (each weapon or wing alone). Decision D4 applies: each character keeps its identity, silhouette, colors and weapon; only the detail rises.

### The designs

Attach: the character's existing front (named under each prompt) and `look-concept-arena.png`. **After the Blessed's design is approved, also attach `blessed-design.png` to every other design**, so the whole cast shares one level of detail.

#### C1 The Blessed — `blessed-design.png` · 9:16 · pilot
Attach: `blessed-front.jpg`, `look-concept-arena.png`, `concept-4.jfif`

Two changes on purpose: the robe becomes a **tabard that ends above the knee** (Meshy's rigging gives legs bones, not a long robe), and there is **no halo** (the game draws it).
```text
A redesign of the first attached character, the Blessed, a holy pilgrim-soldier of Heaven and the most common enemy, keeping his identity: a gaunt, bald old man with a short white beard and blind, pale white eyes, ivory cloth with sky-blue trim and polished gold, a straight longsword. Raise the detail and craftsmanship to the level of the soldiers in the second and third attached images: fitted white plate armor with engraved gold filigree edges over an ivory padded gambeson; layered white pauldrons with gold rims; a gold-trimmed ivory cowl draped over the shoulders; a sky-blue sash at the waist with a gold buckle; an ivory tabard with sky-blue borders and a small gold sunburst on the chest, split at the front, back and sides and reaching just above the knees, so the armored legs are fully visible: white greaves, gold-rimmed knee cops, steel sabatons; gold bracers. No halo, no helmet, no cape, no floor-length robe. He holds the longsword in the right hand, low and diagonally across the body, point down. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: ivory, white and polished gold with pastel sky-blue accents. Full body, front view facing the viewer, centered, the whole figure inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 9:16.
```
**Check:** the same face (bald, white beard, pale eyes); legs visible below the tabard from the knee down; no halo; the sword in the right hand. Generate again until you like it: everything after copies it.

#### C3 The Chorister — `chorister-design.png` · 9:16
Attach: `chorister-front.jpg`, `look-concept-arena.png`, `blessed-design.png`
```text
A redesign of the first attached character, the Chorister, a singing angel of Heaven's choir and the tallest walking enemy, keeping its identity: a narrow bell of floor-length brilliant white silk robes with broad gold bands, a high stiff collar, an open singing mouth, a glowing orb held in both hands in front of the chest; the brightest figure on the field. Raise the detail and craftsmanship to the level of the third attached image and the hooded figures holding glowing orbs in the second: layered silk robes with fine gold-embroidered hymn borders, a deep gold-lined hood resting back on the shoulders so the face shows, a gold-trimmed stole hanging to the knees, gold cuffs, a thin gold chain with a small sunburst at the chest. The robes reach the ground. No halo, no wings. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: brilliant white and polished gold with a pale gold glow in the orb. Full body, front view facing the viewer, centered, the whole figure inside the frame with the robe's hem on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 9:16.
```
**Check:** taller and narrower than the Blessed; whiter and brighter than any other character; the orb at the chest.

#### C4 The Cherub — `cherub-design.png` · 1:1
Attach: `cherub-front.jpg`, `look-concept-arena.png`, `blessed-design.png`
```text
A redesign of the first attached character, the Cherub, a small flying archer of Heaven, keeping its identity: a child-sized figure in polished gold armor, the warmest and darkest of Heaven's soldiers, an expressionless smooth gold mask, white wings spread wide to the sides, a gold bow. Raise the detail and craftsmanship to the level of the third attached image: engraved gold plate over a short white tunic, small layered pauldrons, a gold quiver of white-fletched arrows on the back, gold greaves on bare-footed legs, finely feathered wings with gold-edged primaries. No halo. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: polished gold, warm white wings and pale sky-blue accents. Full body, hovering, front view facing the viewer, centered, the whole figure and both wings inside the frame. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```
**Check:** wide and horizontal (wings); the mask has no features; gold, not ivory.

#### C8 The Gatekeeper — `gatekeeper-design.png` · 1:1
Attach: `gatekeeper-front.png`, `look-concept-gate.png` (or `look-concept-arena.png` if not made yet), `blessed-design.png`
```text
A redesign of the first attached character, the Gatekeeper, the colossal final boss guarding the Pearly Gates, keeping its identity: a towering armored angel of white marble and polished gold plate, monumental like a living cathedral statue, a faceless golden helm with a single glowing pale-gold eye in its center, six great white wings fanned symmetrically behind it with watchful golden eyes set into the feathers, a gold-trimmed marble tabard, standing perfectly symmetric. Raise the detail and craftsmanship to the level of the second and third attached images: marble plates with carved relief panels of lilies and rays, gold filigree along every edge, a tall gold-ribbed helm crest like a cathedral spire, layered gold faulds over the marble tabard, carved marble greaves, the feathers of each wing individually carved like stone. Its hands are empty. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: white marble, ivory and polished gold with pastel sky-blue accents. Full body, front view facing the viewer, centered, the whole figure and all wings inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```
**Check:** still reads as a statue come alive; one eye; six wings; symmetric.

#### C9–C12 The players

The same design prompt for each, with the `<IDENTITY>`, `<DETAIL>`, `<PALETTE>` and ratio of each. Attach: `<id>-front.png`, `look-concept-arena.png`, `blessed-design.png`.

```text
A redesign of the first attached character, <IDENTITY> Raise the detail and craftsmanship to the level of the third attached image and the second: <DETAIL> Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: <PALETTE>. Full body, front view facing the viewer, centered, the whole figure inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio <RATIO>.
```

| ID | File | `<IDENTITY>` | `<DETAIL>` | `<PALETTE>` | Ratio |
|---|---|---|---|---|---|
| C9 | `fallen-design.png` | the Fallen, a fallen angel turned demon knight, the party's tank, keeping its identity: a hulking figure much broader than a human in spiked charred-black plate armor with rust-red enamel plates and glowing molten-orange cracks, a closed horned helm with two ember-glowing eye slits, the burnt skeletal stumps of wings rising from the back, a heavy blackened-iron brimstone shotgun with glowing red runes held in both hands. | layered plates with hammered texture and riveted edges, chipped red enamel, a ragged soot-black tabard to the knees, heavy chain hanging from the belt, cracked gauntlets, the wing stumps with charred feathers still clinging to them. | soot black and charred iron with ember red and glowing brimstone-orange accents | 2:3 |
| C10 | `heretic-design.png` | the Heretic Saint, the party's healer, keeping its identity: a tall, gaunt figure in tattered soot-black monastic robes with ember-red trim, a rope belt hung with charred prayer beads, a deep hood leaving only a pale ash-grey jaw visible, a cracked blackened-iron halo with smoldering cracks floating above the head, a stubby censer launcher of blackened bronze with gothic filigree held in both hands. | layered robes scorched and torn at the hem, red trim embroidered with burnt scripture, iron clasps, a bronze reliquary on a chain at the chest, bandaged hands, the launcher's filigree and a glowing coal censer in its muzzle. The robes reach the ground. | soot black and charred iron with ember red and glowing brimstone-orange accents | 9:16 |
| C11 | `binder-design.png` | the Binder, a jailer of Hell, the party's support, keeping its identity: a stocky, broad, shorter figure in a ragged black hood over a faceless iron mask, an iron collar, heavy black chains with red-hot glowing links wrapped crosswise over the chest, padlocks, a six-barrel rotary chain gun of blackened iron with red-hot bands fed by a belt of chain links. | riveted iron plates over a thick leather jerkin, a jailer's ring of huge keys at the hip, scorched leather gauntlets, the chains wrapped tight against the body rather than hanging loose, the gun's barrels banded and engraved. | soot black and charred iron with ember red and glowing brimstone-orange accents | 2:3 |
| C12 | `betrayer-design.png` | the Betrayer, an assassin, the party's damage dealer, keeping its identity: a slim, agile figure in a narrow black hood that hides the face except for a smirking mouth, a long fitted black coat with tails split to the knees, a blood-red sash at the waist, a row of thirty small silver coins stitched down the coat's front, black leather gloves, an ornate long-barreled silver revolver held in the right hand pointing down. | fine tailoring with dark brocade panels, silver buttons and buckles, a thin bandolier with throwing knives, high leather boots with silver toe caps, the revolver's engraved cylinder and ivory grip. | soot black and charred iron with ember red, brimstone orange and cold silver | 9:16 |

**Check:** the same silhouette as the old front from across a room; Hell's palette, never Heaven's ivory.

The Dominion, Lectern Cantor, Stray-Carrier and Watchman already have detailed designs from R2–R4; they need no new design image.

### The Meshy sheets

One template for every character, with the `<NOTES>` of each. Attach **only** the character's design image. Start a new chat.

```text
Character model sheet for 3D modeling, copying the character in the attached image: three full-body views side by side, from left to right: front, right side profile, back. Copy the attached design exactly: same face, proportions, armor, clothing and colors in every view. <NOTES> Pose in every view: a neutral A-pose: standing straight, feet apart at shoulder width and pointing forward, arms straight and angled down and away from the body at about 45 degrees, palms facing the thighs, so the arms, hands and legs are clearly separated from the body and from each other; both hands empty, the fingers loosely curled as if around a grip; neutral face, looking straight ahead. All three views at the same scale, standing on one shared baseline, orthographic with no perspective, evenly spaced with a wide gap between them, nothing overlapping. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no hatching, no highlights, no rim light, no glow and no light direction at all; thin dark lines only where two colors or parts meet, no thick outer contour. Plain flat medium grey (#808080) background, no floor, no shadows, no text, no labels, no arrows, no extra views or characters. Aspect ratio 16:9.
```

| ID | File | Attach | `<NOTES>` |
|---|---|---|---|
| C1 | `blessed-meshy.png` | `blessed-design.png` | No sword, no weapon, nothing held, no halo. |
| C3 | `chorister-meshy.png` | `chorister-design.png` | No orb, nothing held. The robes reach the ground. |
| C4 | `cherub-meshy.png` | `cherub-design.png` | No wings, no bow, no quiver, nothing on the back. Standing, not hovering. |
| C5 | `dominion-meshy.png` (only if asked) | `dominion-design.png` | No wings, no mace, nothing on the back except the armor's back plate. |
| C6 | `cantor-meshy.png` (only if asked) | `cantor-design.png` | No book, no wings, no candles; nothing held. The robes reach the ground. |
| C7 | `carrier-meshy.png` (only if asked) | `carrier-design.png` | No wings, no shroud, nothing held. |
| C8 | `gatekeeper-meshy.png` | `gatekeeper-design.png` | No wings, nothing held, nothing on the back except the armor's back plate. |
| C9 | `fallen-meshy.png` | `fallen-design.png` | No shotgun, no wing stumps, nothing on the back except the armor's back plate. |
| C10 | `heretic-meshy.png` | `heretic-design.png` | No launcher, no halo, nothing held. The robes reach the ground. |
| C11 | `binder-meshy.png` | `binder-design.png` | No gun, no loose hanging chains or padlocks; the chains wrapped tight over the chest stay. |
| C12 | `betrayer-meshy.png` | `betrayer-design.png` | No revolver, no knives, nothing held. |

**Check before saving:** three views of the same character; nothing held, no wings; arms away from the body, feet apart; the back view really shows the back; no shading (the same color on the left and right sides of the body); the whole figure in each view with grey around it. If one view is wrong, reply *"Fix only the <side/back> view: …"*.

### The parts

One template, with the `<PART>` and `<VIEW>` of each. Attach the character's design image only. Start a new chat.

```text
Model sheet for 3D modeling: <PART>, copying the attached image, alone, <VIEW>, the whole object inside the frame with a margin around it. Orthographic with no perspective. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no highlights, no reflections, no glow; thin dark lines only where two parts meet. Plain flat medium grey (#808080) background, no hands, no body, no text, no labels. Aspect ratio 16:9.
```

| ID | File | Attach | `<PART>` | `<VIEW>` |
|---|---|---|---|---|
| C1 | `blessed-sword.png` | `blessed-design.png` | the longsword carried by the character: a straight double-edged steel blade with a central fuller and fine gold filigree near the guard, a straight gold crossguard with flared ends, a grip wrapped in brown leather, a round gold pommel | in exact side profile, horizontal, the blade pointing right |
| C2 | `watchman-helmet.png` | `watchman-design.png` | the Watchman's gold brimmed helmet with its short sky-blue plume | three views side by side: front, right side, back |
| C4 | `cherub-wings.png` | `cherub-design.png` | one of the character's wings, fully spread, with its feathers and gold-edged primaries | seen flat from the front, the wing's root at the left |
| C4 | `cherub-bow.png` | `cherub-design.png` | the character's gold bow, strung, with its leather grip | in exact side profile, vertical |
| C6 | `cantor-wings.png` | `cantor-design.png` | one of the character's large white wings, fully spread | seen flat from the front, the wing's root at the left |
| C8 | `gatekeeper-wing.png` | `gatekeeper-design.png` | one of the character's great white wings with the watchful golden eyes set into its feathers, fully spread | seen flat from the front, the wing's root at the left |

**Check:** the part alone, matching the design; no shine painted on metal.

---

## P Props for Meshy

The breakable props rendered from models in V5, so they share the characters' light. Same template as the ornaments (O) with the attachments and `<OBJECT>` of each; attach the existing game image so the design is kept. After the pilot is approved, also attach `prop-amphora-tall.png`.

| ID | File | Attach | `<OBJECT>` |
|---|---|---|---|
| P1 *pilot* | `prop-amphora-tall.png` | `amphora-tall.png` | the attached tall amphora, 1.0 m tall: round-bellied ivory and white pot with thin gold bands and two small handles. |
| P2 | `prop-amphora-squat.png` | `amphora-squat.png`, `prop-amphora-tall.png` | the attached squat amphora, 1.0 m tall, the same family. |
| P3 | `prop-amphora-lily.png` | `amphora-lily.png`, `prop-amphora-tall.png` | the attached lily amphora, 1.0 m tall, with its painted gold lily. |
| P4 | `prop-amphora-marked.png` | `amphora-marked.png`, `prop-amphora-tall.png` | the attached marked amphora, 1.0 m tall, with one big gold cross on its belly. |
| P5 | `prop-sanctuary-lamp.png` | `sanctuary-lamp.png` | the attached sanctuary lamp, 1.3 m tall: a saturated red glass cup in a black iron band on an iron tripod. The flame is left out. |
| P6 | `prop-blessing-chalice.png` | `blessing-chalice.png` | the attached blessing chalice, 1.2 m tall: an all-gold cup on a slim white marble stand. |

**Check:** each keeps its color family (red glass only for the lamp, all gold for the chalice, ivory for amphorae); no flame or glow.

---

## H HUD frames

The concept's HUD frames. Claude cuts them out and slices them so they stretch without distorting their corners; text and bars are drawn by the game. Attach: `look-concept-arena.png`, `ui-bar-frame.png`, `ui-slot-frame.png` (the existing frames, for the style). After the pilot is approved, also attach `hud-portrait-frame.png`.

```text
A single empty game interface frame, alone, front view, flat, centered, filling most of the image: <FRAME> In the style of the interface in the attached images: dark charred iron with polished gold edges and small engraved gold ornaments, crisp dark ink outlines, a little painterly texture. Everything inside the frame's opening and everything around the frame is flat pure green (#00FF00). No text, no letters, no numbers, no icons, no portrait, no bars, no glow outside the frame. Aspect ratio <RATIO>.
```

| ID | File | `<FRAME>` | Ratio |
|---|---|---|---|
| H1 *pilot* | `hud-portrait-frame.png` | a diamond-shaped portrait frame standing on one point, a thick dark iron border with a thin gold inner edge and a small gold ornament at each of the four points, the opening empty. | 1:1 |
| H2 | `hud-bars-frame.png` | two long thin horizontal bar frames stacked one above the other with a small gap, the upper one a little longer, each a dark iron border with thin gold edges, ends cut at a slant, the openings empty. | 21:9 |
| H3 | `hud-weapon-panel.png` | a wide rectangular panel frame with cut corners, a dark iron border with thin gold edges and a small gold ornament at the top center, the opening empty. | 16:9 |

**Check:** the opening is pure green (it becomes transparent); corners crisp; the same metal and gold as the existing UI.
