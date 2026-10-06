# Art prompts

Every image milestone 6 needs ([mvp.md](mvp.md) §11.2), with a ready-to-paste prompt for each. There are two kinds:

- **Part A, model references (16 images).** Claude builds the characters and first-person weapons as 3D models in Blender and renders them into sprite atlases, as it did for the Blessed. These images show what to build: one front picture to set the look, then front, side and back views to model from. They are never shown in the game.
- **Part B, game assets (43 images).** Used in the game directly, after Claude cuts out the background, crops and resizes them.

The target look is the concept art in `assets/art-src/reference/concept-*.webp`. The game should look like a painted 3D game, but every character is a flat sprite that faces the camera, like in Doom. Pre-rendering 3D models is what gets both: 8 directions and every animation frame come from the same model, which an image generator can't draw consistently.

---

## Checklist

Save every image as PNG with exactly this name. Part A goes in `assets/art-src/reference/`, Part B in `assets/art-src/`.

**Already done:** `concept-1.webp` (corridor), `concept-2.webp` (Cherubs), `concept-3.webp` (Fallen in the swarm), `blessed-front.jpg`, `chorister-front.jpg`, `cherub-front.jpg`.

**Part A: model references** (`assets/art-src/reference/`)
- [x] A1 Fronts: `fallen-front.png`, `heretic-front.png`, `binder-front.png`, `betrayer-front.png`, `gatekeeper-front.png`
- [x] A2 Turnarounds: `chorister-turnaround.png`, `cherub-turnaround.png`, `gatekeeper-turnaround.png`, `fallen-turnaround.png`, `heretic-turnaround.png`, `binder-turnaround.png`, `betrayer-turnaround.png`
- [x] A3 Weapon sheets: `weapon-shotgun-sheet.png`, `weapon-censer-sheet.png`, `weapon-chaingun-sheet.png`, `weapon-revolver-sheet.png`

**Part B: game assets** (`assets/art-src/`)
- [x] B1 World sprites: `proj-censer.png`, `proj-orb.png`, `proj-arrow.png`, `feather.png`, `spark.png`, `ember.png`, `mark.png`, `chain-ring.png`
- [x] B2 Decorations: `decor-candelabrum.png`, `decor-lily-urn.png`, `decor-harp.png`, `decor-cloud-tuft.png`, `decor-angel-statue.png`, `decor-fountain.png`
- [x] B3 HUD: `muzzle-flash.png`, `icon-blasphemy.png`, `icon-falling-star.png`, `icon-communion.png`, `icon-shroud.png`, `icon-chains.png`, `icon-discord.png`, `icon-kiss.png`, `icon-shadowstep.png`, `class-fallen.png`, `class-heretic.png`, `class-binder.png`, `class-betrayer.png`
- [x] B4 Terrain textures: `tex-floor.png`, `tex-riser.png`, `tex-wall.png`, `tex-door.png`
- [x] B5 Effect textures: `fx-ring.png`, `fx-beam.png`, `fx-chain.png`, `fx-glow.png`, `fx-smoke.png`
- [x] B6 UI: `ui-logo.png`, `ui-title-bg.png`, `ui-panel.png`, `ui-button.png`, `ui-button-hover.png`, `ui-bar-frame.png`, `ui-slot-frame.png`

---

## How to use (Gemini)

1. **Attach the references** listed under each prompt (the files in `assets/art-src/reference/`). They carry the style, and prompts that say *"the attached character"* depend on them. Start a new chat for each image, so an earlier image doesn't bleed into the next one.
2. **Order:** A1 first, since the turnarounds, weapon sheets and class icons attach those fronts. Then A2, A3, then Part B in any order.
3. **Aspect ratio:** each prompt ends with one of Gemini's supported ratios. If the image comes out in a different shape, reply *"Make it W:H"*.
4. **Resolution:** the largest your Gemini version offers. 1024 px is enough for everything except the terrain textures, which should be 2048 px if available.
5. **Check before saving.** Generate again (or ask Gemini to fix it) when you see:
   - a background that isn't flat green (a gradient, a floor, a shadow under the feet, a checkerboard);
   - any text, letters, labels or watermarks (except the logo's word);
   - part of the subject cut off by the edge, unless the prompt asks for that;
   - for turnarounds: views that don't match each other (different armor, a weapon in a different hand), or extra views;
   - for enemies: a design that breaks the rules in *Telling enemies apart* below.
6. **Integration is Claude's part:** modeling from Part A, cutting out the green, cropping, making textures seamless, resizing, and checking everything in the game.

**Why the prompts insist on these things**
- **Flat pure green background:** Gemini can't make transparent images, and green appears nowhere in the palette, so it cuts out cleanly.
- **No glow or haze outside the outline:** the game drops every sprite pixel that is less than 50% opaque, so a soft glow turns into a ragged blob. Glows painted *inside* a shape are fine.
- **Front view and a bold outline:** sprites face the camera and are often only 30–150 px tall on screen, so the silhouette has to read at a glance.
- **Light enemies, dark players:** the game shows status effects (hurt, silenced, wind-up) by tinting enemy sprites, which works best on white and gold. Players stay dark so they read as Hell's side.
- **Effect textures on pure black:** the game draws them additively, so black becomes transparent and they can be tinted in code.

---

## Telling enemies apart

All enemies share the style and the Heaven palette, so each one differs in four ways at once: size, silhouette, dominant material and one signature feature. Even in greyscale they differ in brightness. The existing fronts already follow this; keep it when regenerating.

| Enemy | In-game height | Silhouette | Dominant material | Signature (only this enemy has it) |
|---|---|---|---|---|
| **Blessed** | 1.6 m, human | Upright pilgrim-soldier, sword held low and diagonal | Ivory cloth with sky-blue trim, mid brightness | Gold halo ring; the only one with a sword |
| **Chorister** | 2.0 m, tallest walker | Narrow bell of floor-length robes, high stiff collar | Brilliant white silk with broad gold bands, the brightest | Glowing orb held at the chest, open singing mouth; the only one that glows constantly |
| **Cherub** | 0.8 m, flies 4 m up | Wide and horizontal: wings spread | Polished gold armor, the warmest and darkest | Expressionless gold mask and bow; the only one with wings |
| **Gatekeeper** | 6 m, boss | Massive, perfectly symmetric | White marble and gold plate | Six wings, a single eye, a giant golden key |

The players follow the same idea in Hell's palette: the Fallen is the bulkiest, with horns and wing stumps; the Heretic Saint is tall and thin, with a halo; the Binder is stocky, with hanging chains; the Betrayer is slim, with long coat tails.

---

## Part A: model references

### A1 Fronts

The look Claude's models aim for. Save in `assets/art-src/reference/`.

#### Fallen — `fallen-front.png` · 2:3
Attach: `concept-3.webp`, `blessed-front.jpg`
```text
The Fallen, a fallen angel turned demon knight, the party's tank: a hulking figure much broader than a human, in spiked charred-black plate armor with rust-red enamel plates and glowing molten-orange cracks between them, a closed horned helm with two ember-glowing eye slits and no visible face, the burnt skeletal stumps of wings rising from the back, holding a heavy blackened-iron brimstone shotgun with glowing red runes across the body in both hands. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: soot black and charred iron with ember red and glowing brimstone-orange accents. Full body, front view facing the viewer, centered, the whole figure inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 2:3.
```

#### Heretic Saint — `heretic-front.png` · 9:16
Attach: `concept-3.webp`, `blessed-front.jpg`
```text
The Heretic Saint, the party's healer: a tall, gaunt figure in tattered soot-black monastic robes with ember-red trim, a rope belt hung with charred prayer beads, a deep hood that leaves only a pale ash-grey jaw visible, a cracked blackened-iron halo with smoldering orange cracks floating above the head, carrying a stubby censer launcher of blackened bronze with gothic filigree, an incense censer with glowing coals loaded in its muzzle. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: soot black and charred iron with ember red and glowing brimstone-orange accents. Full body, front view facing the viewer, centered, the whole figure inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 9:16.
```

#### Binder — `binder-front.png` · 2:3
Attach: `concept-2.webp`, `concept-3.webp`, `blessed-front.jpg`
```text
The Binder, a jailer of Hell, the party's support: a stocky, broad, shorter figure in a ragged black hood over a faceless iron mask, an iron collar, heavy black chains with red-hot glowing links wrapped crosswise over the chest and hanging in loops from the arms, padlocks dangling, holding a six-barrel rotary chain gun of blackened iron with red-hot glowing bands, fed by a belt of chain links. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: soot black and charred iron with ember red and glowing brimstone-orange accents. Full body, front view facing the viewer, centered, the whole figure inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 2:3.
```

#### Betrayer — `betrayer-front.png` · 9:16
Attach: `concept-3.webp`, `blessed-front.jpg`
```text
The Betrayer, an assassin, the party's damage dealer: a slim, agile figure in a narrow black hood that hides the face except for a smirking mouth, a long fitted black coat with tails split to the knees, a blood-red sash at the waist, a row of thirty small silver coins stitched down the front of the coat, black leather gloves, holding an ornate long-barreled silver revolver in the right hand, pointed down at the side. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: soot black and charred iron with ember red, brimstone orange and cold silver. Full body, front view facing the viewer, centered, the whole figure inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 9:16.
```

#### Gatekeeper — `gatekeeper-front.png` · 1:1
Attach: `concept-1.webp`, `blessed-front.jpg`
```text
The Gatekeeper, the colossal final boss guarding the Pearly Gates: a towering armored angel of white marble and polished gold plate, monumental like a living cathedral statue, a faceless golden helm with a single glowing pale-gold eye in its center, six great white wings fanned symmetrically behind it (two raised, two spread out, two lowered) with watchful golden eyes set into the feathers, a gold-trimmed marble tabard, holding a giant ornate golden key upright like a staff in its right hand, standing perfectly symmetric. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Full body, front view facing the viewer, centered, the whole figure and all wings inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

### A2 Turnarounds

Front, side and back of the same character, for modeling. All seven use the same prompt with a different pose. Attach the character's front image (`<id>-front.png` or `.jpg`) and nothing else, so the design is copied rather than reinvented. Save in `assets/art-src/reference/`.

```text
Character turnaround reference sheet of the character in the attached image: three full-body views side by side, from left to right: front, right side profile, back. Copy the attached design exactly: same proportions, armor, clothing, colors and props in every view. All three views at the same scale, standing on one shared baseline, orthographic with no perspective, evenly spaced, nothing overlapping. Pose in every view: <POSE>. Same hand-inked style as the attached image: bold black ink outlines, cel shading in 2–3 tones with painterly brush texture. Even, flat lighting. Plain flat light grey background, no floor, no shadows, no text, no labels, no arrows, no extra views or characters. Aspect ratio <RATIO>.
```

| File | Attach | `<POSE>` | `<RATIO>` |
|---|---|---|---|
| `chorister-turnaround.png` | `chorister-front.jpg` | standing straight, holding the glowing orb in both hands in front of the chest, the robe hem touching the ground | 16:9 |
| `cherub-turnaround.png` | `cherub-front.jpg` | hovering, wings spread fully to the sides, legs dangling, the bow held lowered in the left hand with no arrow nocked | 21:9 |
| `gatekeeper-turnaround.png` | `gatekeeper-front.png` | standing straight, all six wings spread, the key held upright in the right hand | 21:9 |
| `fallen-turnaround.png` | `fallen-front.png` | standing relaxed, holding the shotgun in both hands, muzzle pointing down and forward | 16:9 |
| `heretic-turnaround.png` | `heretic-front.png` | standing relaxed, holding the censer launcher in both hands, muzzle pointing down and forward | 16:9 |
| `binder-turnaround.png` | `binder-front.png` | standing relaxed, holding the chain gun in both hands at the hip, barrels pointing forward | 16:9 |
| `betrayer-turnaround.png` | `betrayer-front.png` | standing relaxed, the revolver held in the right hand pointing down at the side, left arm relaxed | 16:9 |

### A3 Weapon sheets

The first-person weapons, each held in its class's own hands. The left view is for modeling, the right one shows how it should look on screen. Save in `assets/art-src/reference/`.

```text
Weapon design reference sheet for the <WEAPON> carried by the character in the attached image: two views side by side. Left: an exact side profile of the weapon alone, horizontal, muzzle pointing right. Right: the same weapon as a first-person shooter viewmodel, seen from just behind and above, held in <HANDS>, pointing straight forward into the distance, centered, the hands and the rear of the weapon cut off by the bottom edge of the image. Same design in both views: <DESCRIPTION>. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached images: bold black ink outlines, cel shading in 2–3 tones with painterly brush texture, crisp edges. Palette: soot black and charred iron with ember red and glowing brimstone-orange accents. Even, flat lighting. Plain flat light grey background, no text, no labels, no scenery. Aspect ratio 16:9.
```

| File | Attach | `<WEAPON>` | `<HANDS>` | `<DESCRIPTION>` |
|---|---|---|---|---|
| `weapon-shotgun-sheet.png` | `fallen-front.png`, `concept-1.webp` | Brimstone Shotgun | the Fallen's charred-black armored gauntlets with glowing molten cracks | a heavy pump-action shotgun of blackened iron with a wide double barrel, glowing red-orange runes carved along the barrel and stock, molten seams |
| `weapon-censer-sheet.png` | `heretic-front.png` | Censer Launcher | soot-black cloth-wrapped hands with ember-red bandages | a stubby wide-mouthed launcher of blackened bronze covered in gothic church filigree, a round incense censer with glowing orange coals loaded in its muzzle, a short chain hanging below |
| `weapon-chaingun-sheet.png` | `binder-front.png`, `concept-2.webp` | Chain Gun | black iron gloves with chain links wrapped around the wrists | a rotary chain gun with six blackened barrels and glowing red-hot bands around them, wrapped in heavy chains, a belt of chain links feeding into its side |
| `weapon-revolver-sheet.png` | `betrayer-front.png` | Silver Revolver | slim black leather gloves, the right hand on the grip and the left supporting it | an ornate long-barreled silver revolver with engraved filigree, a six-chamber cylinder, a black grip and a small blood-red gem on the hammer |

---

## Part B: game assets

Save in `assets/art-src/`.

### B1 World sprites

Projectiles, particles and status markers. Often only 10–40 px on screen, so they must be simple. If a generated particle loses too much at that size, Claude redraws it in the same style.

Attach to each: `blessed-front.jpg`, `concept-1.webp`

#### Censer — `proj-censer.png` · 1:1
```text
A flying incense censer seen from the front: a round blackened-bronze church censer with pierced gothic filigree, glowing orange coals visible through the holes, a short broken chain and a few sparks. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 32 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no glow or haze outside the outline, no text. Aspect ratio 1:1.
```

#### Orb — `proj-orb.png` · 1:1
```text
An orb of holy light fired by angels: a gold-white sphere with a hard crisp edge, a thin gold halo ring around it, a faint stained-glass pattern inside, its glow painted as solid hard-edged bands of pale gold inside the outline. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 32 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no soft glow or haze outside the outline, no text. Aspect ratio 1:1.
```

#### Arrow — `proj-arrow.png` · 1:1
```text
A golden arrow flying straight at the viewer, seen exactly head-on: a gleaming gold diamond-shaped arrowhead in the center, white feather fletching radiating around it behind, a little of the shaft visible. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 32 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no glow or haze outside the outline, no text. Aspect ratio 1:1.
```

#### Feather — `feather.png` · 2:3
```text
A single white angel feather with a gold quill, gently curved, falling. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 24 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no glow, no text. Aspect ratio 2:3.
```

#### Spark — `spark.png` · 1:1
```text
A sharp four-pointed gold star spark with a white-hot center. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 16 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no soft glow, no text. Aspect ratio 1:1.
```

#### Ember — `ember.png` · 1:1
```text
A single flying ember: a jagged chunk of burning coal with a glowing orange-yellow core and charred black edges. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 16 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no soft glow, no smoke, no text. Aspect ratio 1:1.
```

#### Mark — `mark.png` · 1:1
Floats above an enemy marked by Kiss of Betrayal.
```text
A brand of betrayal: a pair of blood-red kissing lips inside a thin red sigil ring, with one small tarnished silver coin below, simple, bold and menacing. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 32 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no soft glow, no text. Aspect ratio 1:1.
```

#### Chain ring — `chain-ring.png` · 21:9
Lies around the feet of a rooted enemy.
```text
A closed ring of heavy black iron chain lying on the ground, seen from a low angle so it appears as a wide flat ellipse, its links glowing red-hot. Game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges. Centered, the whole ring in frame, the inside of the ring empty and showing the green background. Isolated on a flat pure green (#00FF00) background: no ground, no shadow, no glow, no text. Aspect ratio 21:9.
```

### B2 Decorations

Props in the arenas. They are billboards like the characters, so they always face the camera: front views with the base on the bottom edge. Heights are their size in the game.

Attach to each: `concept-1.webp`, `blessed-front.jpg`

#### Candelabrum (1.8 m) — `decor-candelabrum.png` · 3:4
```text
A tall standing church candelabrum of polished gold: an ornate twisted stem on three clawed feet, seven branches holding white candles, small candle flames painted as solid hard-edged pale-gold shapes. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 3:4.
```

#### Lily urn (1.0 m) — `decor-lily-urn.png` · 3:4
```text
A white marble urn with a gold rim and two curled gold handles, holding a full bouquet of white lilies with pale green stems and gold stamens. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 3:4.
```

#### Harp (1.4 m) — `decor-harp.png` · 3:4
```text
A tall golden angelic harp standing upright on its base, seen from its broad side so the whole triangular frame and the strings are visible: an ornate carved pillar topped with a small angel head, a curved neck with feather carvings, thin pale strings. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background, also visible between the strings: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 3:4.
```

#### Cloud tuft (1.0 m) — `decor-cloud-tuft.png` · 4:3
```text
A small fluffy cloud resting on the ground like a bush: puffy rounded cumulus lobes with a flat bottom, white with pastel sky-blue shading and a warm gold rim light along the top, drawn as solid shapes with ink outlines, not soft or misty. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Front view, centered, the whole cloud inside the frame with its flat bottom on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no haze outside the outline. Aspect ratio 4:3.
```

#### Angel statue (3.0 m) — `decor-angel-statue.png` · 2:3
```text
A white marble statue of a praying angel with folded wings and bowed head, hands pressed together, robes carved in deep folds, gold leaf on the halo and the hem, standing on a short square marble plinth with gold trim. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white marble, ivory and polished gold with pastel sky-blue shadows. Front view, centered, the whole statue inside the frame with the plinth on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 2:3.
```

#### Fountain (2.0 m) — `decor-fountain.png` · 1:1
```text
A tiered white marble fountain with gold trim: a wide round lower basin, a smaller middle basin and a top bowl on a carved pedestal, water spilling from each tier, the water painted as solid hard-edged pale-blue shapes with white highlights and ink outlines. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Front view at eye level, centered, the whole fountain inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no spray mist, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

### B3 HUD

#### Muzzle flash — `muzzle-flash.png` · 1:1
Drawn at the muzzle of every class's first-person weapon. Attach: `concept-1.webp`
```text
A muzzle flash seen from behind the gun: a jagged star-shaped burst of brimstone fire with a yellow-white core, orange and ember-red outer flames and a few flying sparks. Game effect sprite in a hand-inked graphic-novel style matching the attached image: bold black ink outline, flames cel-shaded in hard-edged color bands, crisp edges. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no smoke, no soft glow outside the outline, no text. Aspect ratio 1:1.
```

#### Ability icons

Square icons for Q and E, shown at about 48 px inside the slot frame (B6). All eight share the same style sentence, so they match each other. Attach to each: `concept-1.webp`, plus the user's front from A1 (for example `fallen-front.png` for Blasphemy).

| File | Ability | Symbol |
|---|---|---|
| `icon-blasphemy.png` | Fallen, Q: taunt | An inverted cross bursting into flames, with rings of a defiant shockwave radiating outward. |
| `icon-falling-star.png` | Fallen, E: leap to an ally | A burning meteor plunging diagonally downward with a fiery tail, crashing into the ground in a jagged impact burst. |
| `icon-communion.png` | Heretic Saint, Q: group heal | A black iron chalice overflowing with glowing ember-red wine, drops rising upward like sparks. |
| `icon-shroud.png` | Heretic Saint, E: shield | A tattered burial shroud billowing into a protective dome, its frayed edges glowing pale orange, like a shield of cloth. |
| `icon-chains.png` | Binder, Q: pull and root | Heavy black chains with red-hot glowing links lashing forward and coiling around, a hook at the end. |
| `icon-discord.png` | Binder, E: silence | A broken golden angelic harp with snapped, curling strings, jagged dissonant sound waves cracking outward. |
| `icon-kiss.png` | Betrayer, Q: mark | Blood-red lips in a kiss beside a single tarnished silver coin. |
| `icon-shadowstep.png` | Betrayer, E: dash | A hooded figure dashing sideways, leaving a trail of black smoky afterimages behind it. |

```text
<SYMBOL> Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

#### Class icons

Portraits in the party frames. Attach the class's front from A1, so the portrait shows the same character.

| File | Attach | Subject |
|---|---|---|
| `class-fallen.png` | `fallen-front.png` | the Fallen: the horned helm with ember-glowing eye slits, molten-orange cracks in the armor |
| `class-heretic.png` | `heretic-front.png` | the Heretic Saint: the deep black hood with the pale jaw, the cracked smoldering halo above |
| `class-binder.png` | `binder-front.png` | the Binder: the faceless iron mask under the hood, the iron collar, red-hot chains across the shoulders |
| `class-betrayer.png` | `betrayer-front.png` | the Betrayer: the narrow hood and smirking mouth, the silver coins on the coat collar |

```text
Portrait of the character in the attached image, <SUBJECT>. Copy the attached design exactly. Square character portrait icon in a hand-inked graphic-novel style matching the attached image: head and shoulders, front view, centered, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

### B4 Terrain textures

The ground and walls of the whole map. Each texture covers a 4 × 4 m area and repeats, so it must tile without visible seams and have no lighting of its own (the game adds shading by face direction). Claude fixes small seams. Generate at 2048 px if available.

Attach to each: `concept-1.webp`

#### Floor — `tex-floor.png` · 1:1
On top of every floor cell.
```text
Seamless tileable game texture, viewed straight down, orthographic, filling the whole square: a polished ivory marble floor of exactly 2 × 2 large square tiles, separated by thin inlaid gold lines, each tile with a thin inset border of pale gold, small gold ornaments at the tile corners, faint pale grey-blue marble veining and light wear. Hand-painted stylized texture matching the floor in the attached image: painterly brush texture, crisp dark ink-like lines along the joints. Even, flat lighting: no shadows, no highlights, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```

#### Riser — `tex-riser.png` · 1:1
On the vertical sides of stairs, ledges and terraces.
```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: carved ivory stone with vertical fluting like the grooves of a classical column, eight evenly spaced grooves across the width, gold leaf in the bottom of each groove, slight wear on the ridges. Hand-painted stylized texture matching the stonework in the attached image: painterly brush texture, crisp dark ink-like lines along the carved edges. Even, flat lighting: no shadows across the surface, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```

#### Wall — `tex-wall.png` · 1:1
On every wall, which rises 16 m, so it repeats four times upward.
```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: a wall of large ivory sandstone blocks laid in staggered courses, seven courses of blocks, and along the bottom one narrow carved frieze band with gold-leaf trim and a simple repeating leaf pattern. Thin dark joints between the blocks, subtle color variation and light weathering. Hand-painted stylized texture matching the walls in the attached image: painterly brush texture, crisp dark ink-like lines along the joints. Even, flat lighting: no shadows, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```

#### Door — `tex-door.png` · 1:1
On the doors that seal an arena during combat.
```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: a sealed pearly gate, thick vertical bars of polished gold with ornate scrollwork and pearl inlays, set in front of a solid pearl-white panel with a soft mother-of-pearl sheen, so nothing is seen through the bars. Hand-painted stylized texture matching the attached image: painterly brush texture, crisp black ink outlines. Even, flat lighting: no shadows, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```

### B5 Effect textures

Ability effects. The game draws them additively, so black becomes transparent, and tints the white ones per ability (the ring is red for Blasphemy and green for Unholy Communion). Soft edges are fine here.

No attachments.

#### Ring — `fx-ring.png` · 1:1
The taunt ring, the heal ring and the landing shockwave.
```text
A single thin glowing ring of light, a perfect circle centered in the frame, its outer edge at 90% of the frame width, a bright white core line with a soft falloff inside and outside, a faint energy texture along the ring. Pure white and light grey only, no color. On a pure black (#000000) background; the center of the ring is pure black. Flat, seen straight on, no perspective. No text. Aspect ratio 1:1.
```

#### Beam — `fx-beam.png` · 1:1
Tracers and the mark beam, stretched along their length.
```text
A horizontal beam of light crossing the whole width of the frame from the left edge to the right edge, centered vertically, a bright white core fading smoothly to black above and below, the beam about one fifth of the frame tall, a faint wavering energy texture along it, the same brightness along its whole length so the left edge continues the right edge. Pure white and light grey only, no color. On a pure black (#000000) background. No text. Aspect ratio 1:1.
```

#### Chain — `fx-chain.png` · 1:1
Repeated along the chain lines of Chains of Tartarus.
```text
A horizontal row of four interlocking chain links crossing the whole width of the frame from the left edge to the right edge, centered vertically, the links glowing red-hot: a bright yellow-orange core and ember-red edges, with thin dark lines where the links overlap. The left edge continues the right edge seamlessly. On a pure black (#000000) background. No text. Aspect ratio 1:1.
```

#### Glow — `fx-glow.png` · 1:1
The Judgment glow and the censer explosion.
```text
A soft round glow of light centered in the frame: a bright white center fading smoothly and evenly to black, reaching black just before the edges of the frame, with a few faint radiating light streaks. Pure white and light grey only, no color. On a pure black (#000000) background. No text. Aspect ratio 1:1.
```

#### Smoke — `fx-smoke.png` · 1:1
The Discord burst.
```text
A single puff of wispy swirling smoke centered in the frame, light grey with brighter white curls, painterly brush texture, fading to black well before the edges of the frame on all sides. Greyscale only, no color. On a pure black (#000000) background. No text. Aspect ratio 1:1.
```

### B6 UI

Menus and HUD frames, in Hell's palette so they stand out against the bright world. The panel, button, bar frame and slot frame are stretched to any size by keeping their corners and edges and stretching the middle, so their borders must be even and their centers plain.

Attach to each: `concept-1.webp`, `concept-3.webp`

#### Logo — `ui-logo.png` · 21:9
```text
The game logo: the word "HEAVENFALL" in tall, sharp classical Roman capital letters like those carved in stone, the letters made of polished gold that is charred black and cracked at the edges with glowing ember-orange fissures, a few embers rising. Hand-inked graphic-novel style matching the attached images: bold black ink outline around the whole logo, cel shading with painterly brush texture. Spelled exactly HEAVENFALL, no other text. Wide letter spacing suitable for headline. Centered. Isolated on a flat pure green (#00FF00) background: no soft glow or smoke outside the outline. Aspect ratio 21:9.
```
Gemini still draws the letters touching; `scripts/cutout.py` spaces them out (and drops the floating embers).

#### Title background — `ui-title-bg.png` · 16:9
The full-screen image behind the Title and menus. The menu panel sits on the left, so the left third is calm.
```text
A wide painted scene: the Pearly Gates of Heaven, colossal white-and-gold gates and spires on a sea of clouds at golden hour, a vast host of white-robed soldiers with gold halos and winged archers in gold armor gathered before the gates. In the right foreground, four dark figures from Hell seen from behind, looking up at the gates: a hulking horned knight in charred armor with glowing cracks, a tall hooded figure with a cracked smoldering halo, a stocky figure wrapped in red-hot chains, and a slim figure in a long black coat. Embers rise around them. The left third of the image is calmer: open sky and clouds with little detail. Stylized 3D game art with a hand-inked graphic-novel finish matching the attached images: bold ink outlines, cel shading with painterly brush texture, pale blue distance haze. No text, no logo. Aspect ratio 16:9.
```

#### Panel — `ui-panel.png` · 1:1
Behind every menu, the Pause overlay and the result text.
```text
A game UI panel seen flat and straight on, filling almost the whole frame with a thin margin: a rectangular plate of blackened iron with a plain, smooth, very dark charcoal center with no pattern, an ornate gold border of the same thickness on all four sides, gothic corner ornaments, a faint ember-red line just inside the border. Perfectly symmetric left-right and top-bottom. Hand-inked style matching the attached images: black ink outlines, cel shading. No text, no icons, no perspective. Isolated on a flat pure green (#00FF00) background around the panel. Aspect ratio 1:1.
```

#### Button — `ui-button.png` · 21:9
```text
A wide game UI button seen flat and straight on, filling almost the whole frame width with a thin margin: a horizontal plate of blackened iron with a plain, smooth, dark charcoal center, a gold beveled border of the same thickness on all sides, a small gothic ornament at the left and right ends. Perfectly symmetric. Hand-inked style matching the attached images: black ink outlines, cel shading. No text, no icons, no perspective. Isolated on a flat pure green (#00FF00) background around the button. Aspect ratio 21:9.
```

#### Button, hover — `ui-button-hover.png` · 21:9
Attach `ui-button.png` instead of the concept images.
```text
The same game UI button as the attached image, in its highlighted state: exactly the same shape, size and position, with the gold border brighter and warmer, a glowing ember-orange line along the inside of the border, and the dark center slightly lighter. Nothing else changes. No text, no perspective. Isolated on a flat pure green (#00FF00) background around the button. Aspect ratio 21:9.
```

#### Bar frame — `ui-bar-frame.png` · 21:9
Around the HP bar and the Gatekeeper's HP and cast bars. The bar is drawn inside it.
```text
A long thin horizontal frame for a health bar, seen flat and straight on, spanning almost the whole frame width, about one sixth of the frame tall: a thin rim of blackened iron with a gold edge of the same thickness all around, a small gothic ornament at each end. The inside of the frame is empty and shows the green background. Perfectly symmetric. Hand-inked style matching the attached images: black ink outlines, cel shading. No text, no perspective. Isolated on a flat pure green (#00FF00) background inside and around the frame. Aspect ratio 21:9.
```

#### Slot frame — `ui-slot-frame.png` · 1:1
Around each ability icon.
```text
A square frame for a game ability icon, seen flat and straight on, filling almost the whole frame with a thin margin: a rim of blackened iron with a gold edge of the same thickness on all four sides, small gold ornaments at the corners. The inside of the frame is empty and shows the green background. Perfectly symmetric. Hand-inked style matching the attached images: black ink outlines, cel shading. No text, no perspective. Isolated on a flat pure green (#00FF00) background inside and around the frame. Aspect ratio 1:1.
```

---

## Milestone 9

Two new images for the class rework ([m9.md](m9.md) §9). Everything else M9 needs is made by Claude: the Scourge's first-person frames come from the Binder's Blender model, and the effects reuse the existing textures. Save both in `assets/art-src/`.

- [x] `icon-field-of-blood.png`
- [x] `coin.png`

#### Field of Blood icon — `icon-field-of-blood.png` · 1:1
The Betrayer's new Q: throws the thirty pieces of silver onto the ground, and everyone standing in the field fires twice as fast. Replaces `icon-kiss.png`. Attach: `concept-1.webp`, `betrayer-front.png`, and `icon-shadowstep.png` so it matches the other icons.

Use the ability icon prompt (B3, *Ability icons*) with this `<SYMBOL>`:
```text
A scatter of tarnished silver coins spilling onto cracked earth, a pool of blood-red light spreading beneath them and seeping into the cracks.
```

#### Coin — `coin.png` · 1:1
Thirty of these lie scattered in the middle of a Field of Blood, drawn about 0.12 m wide. Attach: `blessed-front.jpg`, `concept-1.webp`
```text
A single old tarnished silver coin seen straight on: a worn, slightly irregular round coin with a raised rim, a crude stamped profile of a face in the middle, darkened grooves and one bright glint on the edge. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 16 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no soft glow, no text. Aspect ratio 1:1.
```

---

## Milestone 10

9 images for the level art ([m10.md](m10.md)), plus 5 prop sheets made early for a later milestone. The goal is the look of the concept art, `concept-1` above all, at almost no cost per frame, so the prompts ask for flat, evenly lit images: the game adds its own baked light. Attach `concept-1.webp`, `concept-2.webp` and `concept-3.webp` to every prompt unless it says otherwise. Save them as named: the sky, textures and effects in `assets/art-src/`, the prop sheets in `assets/art-src/reference/`. Generate each in a new chat. They're needed in stages, so you can do them stage by stage.

**Optional extras that help** (not required): a close-up photo or painting of a real gold-inlay marble floor; a real arcade with arched windows seen from inside; any artwork of floating spires and towers in clouds. Attach them to the prompts they match.

JPEG is fine for all of them (`.jfif` or `.jpg`, same base name).

- [x] Stage 1: `sky-day`
- [x] Stage 3: `tex-floor-plain`, `tex-floor-medallion`, `tex-wall-window`, `tex-wall-pilaster`, `tex-cornice` (Claude fixes the plain floor's grid, adds the frieze to the window wall and crops the cornice to whole repeats of its pattern: [m10.md](m10.md) §5.1)
- [x] Stage 4: `tex-arcade` (Claude keys out the green, extends it to 1:2 and splits it into two layers: [m10.md](m10.md) §6)
- [x] Stage 5: `fx-lightshaft`
- [x] Stage 5: `fx-clouds` (Claude cleans the green rim off the soft edges: [m10.md](m10.md) §7.2)
- [x] Later milestone (sprites from 3D models, not used in M10): `prop-arch-sheet`, `prop-column-sheet`, `prop-balustrade-sheet`, `prop-spire-sheet`, `prop-island-sheet`

### Sky (stage 1)

#### Sky — `sky-day.png` · 21:9
A horizon band that wraps all the way around the player. Claude closes the seam and blends the top and bottom into plain color, so don't worry about the exact edges, but the left and right edges should match as closely as you can get them. Generate at the largest size available.
```text
A wide panoramic painted sky of a heavenly realm, seen from a high floating terrace: a bright blue sky with big sunlit cumulus clouds, warm golden haze along the horizon, and in the distance floating spires, slender white towers, domes and broken arches rising out of the clouds at many different distances, some tiny and pale in the haze, some larger and clearer. Soft sunlight from the left, a hint of golden light rays through the clouds. The horizon is at about one third of the image height from the bottom; below it, thick white clouds and haze fade to pale gold. The upper half is clear deep blue with a few light clouds. Hand-painted stylized game skybox matching the sky in the attached images: painterly brush texture, soft edges, no ink outlines, rich saturated color. The left edge continues the right edge. No ground, no people, no birds, no text, no sun disc. Aspect ratio 21:9.
```

### Surfaces (stage 3)

Same rules as B4 *Terrain textures*: seamless, flat even lighting, no shadows, no vignette, no perspective, no text. Generate at 2048 px if available. Also attach `tex-floor.png` or `tex-wall.png` from `assets/art-src/` (whichever is the same kind), so the new ones match the existing ones.

#### Plain floor — `tex-floor-plain.png` · 1:1
A calmer variation of the floor.
```text
Seamless tileable game texture, viewed straight down, orthographic, filling the whole square: a polished ivory marble floor with soft pale grey-blue and gold veining and faint large-scale color variation, with a single thin gold line running straight across the whole texture from left to right and another from top to bottom, crossing in the center, so it joins neighboring tiles of the other floor texture. No other pattern. Hand-painted stylized texture matching the floor in the attached image: painterly brush texture, low contrast, crisp thin dark ink-like lines only along the gold lines. Even, flat lighting: no shadows, no highlights, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```

#### Medallion floor — `tex-floor-medallion.png` · 1:1
A large gold inlay, used on one 4 × 4 m area at arena centers and before doors.
```text
Game texture, viewed straight down, orthographic, filling the whole square: a polished ivory marble floor with one large circular medallion inlaid in the center, 85% of the width: concentric rings of gold, a sunburst of 16 thin gold rays, and a simple eight-petal lily in the middle, with fine gold scrollwork and a thin dark ink-like outline on every gold line. Outside the circle, plain ivory marble with faint veining. Hand-painted stylized texture matching the floor in the attached image: painterly brush texture, low-to-medium contrast, no color brighter than pale gold. Even, flat lighting: no shadows, no highlights, no vignette, no perspective. The corners are plain ivory marble that continues into the neighboring tiles. No text. Aspect ratio 1:1.
```

#### Window wall — `tex-wall-window.png` · 1:1
The wall rises 16 m, so this repeats upward four times. It's a painted window; the game doesn't make it a real hole.
```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: an ivory sandstone wall, with one tall pointed-arch window centered, 45% of the width and 70% of the height, set in a deep carved frame with a gold-leaf molding, the glass a soft sky-blue gradient with a pale cloud and thin gold tracery bars, the inner edge of the frame painted dark to suggest depth. Above and below the window, plain ivory blocks with thin dark joints. The left and right edges show plain blocks that continue into the neighboring tile, and the top and bottom edges match. Hand-painted stylized texture matching the walls in the attached image: painterly brush texture, crisp dark ink-like lines along the carved edges and joints. Even, flat lighting: no cast shadows, no vignette, no perspective. No text. Aspect ratio 1:1.
```

#### Pilaster wall — `tex-wall-pilaster.png` · 1:1
Goes between windows.
```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: an ivory sandstone wall with one wide fluted pilaster centered, 40% of the width, running the full height of the image: six vertical flutes, a thin gold molding on each side, small gold leaf ornaments at regular intervals. Plain ivory blocks with thin dark joints on both sides. The left and right edges show plain blocks that continue into the neighboring tile, and the top and bottom edges match. Hand-painted stylized texture matching the walls in the attached image: painterly brush texture, crisp dark ink-like lines along the carved edges and joints. Even, flat lighting: no cast shadows, no vignette, no perspective. No text. Aspect ratio 1:1.
```

#### Cornice — `tex-cornice.png` · 21:9
A horizontal band for the top of every wall. It only repeats left to right. Claude crops it.
```text
Seamless horizontally tileable game texture, viewed straight on, orthographic, filling the whole image: a grand classical cornice band in ivory stone and gold, from top to bottom: a thin gold strip, a row of small evenly spaced dentils, a wide band with a repeating carved leaf-and-lily pattern with gold-leaf trim, then a projecting molding with a thin gold line at the bottom. Hand-painted stylized texture matching the stonework in the attached images: painterly brush texture, crisp dark ink-like lines along the carved edges. Even, flat lighting: no cast shadows, no vignette, no perspective. The left edge continues the right edge. No text. Aspect ratio 21:9.
```

### Arches (stage 4)

#### Arcade bay — `tex-arcade.png` · 9:16
One bay of the arcade that runs along every open edge of the level, like the arches on the left of `concept-1`. Bays stand side by side, so each side edge shows half a pier. The game cuts out the green, so you see the sky through the arch. It's 4 m wide and 8 m tall in the game; Claude extends it to 1:2. Attach `tex-wall.png` too, so the stone matches.
```text
Game texture, viewed straight on, orthographic, filling the whole image: one bay of a grand Gothic arcade in ivory stone and gold. At the left and right edges, half of a square stone pier each (each 12% of the image width), cut exactly at the image edge so two images side by side make a whole pier. Between them, one tall pointed-arch opening whose apex is at 75% of the image height from the bottom, framed by a carved molding with gold-leaf trim and a small gold lily keystone. Across the bottom 17% of the opening, a stone balustrade: a plinth, a row of fat ivory balusters with gold accents, and a thin gold-trimmed top rail. Above the arch, solid ivory stone spandrels with fine gold scrollwork, and the top 20% of the image plain ivory stone blocks with thin dark joints. Everything that is open, inside the arch above the balustrade and between the balusters, is flat pure green (#00FF00), with no sky, no clouds and no glass. Hand-painted stylized texture matching the architecture in the attached images: painterly brush texture, crisp dark ink-like lines along the carved edges and joints. Even, flat lighting: no cast shadows, no vignette, no perspective. No text. Aspect ratio 9:16.
```

**Check before saving:** the opening is one clean green area (no sky painted into it), the arch is centered and symmetric, and the left and right edges are cut through the piers.

### Atmosphere (stage 5)

#### Light shaft — `fx-lightshaft.png` · 3:4
The game turns brightness into opacity, so black becomes transparent. Tinted warm gold by the game. No attachments.
```text
A single tall shaft of sunlight, a soft-edged vertical beam of light, widest at the top and narrowing slightly toward the bottom, centered, 40% of the image width, brightest in the middle with a gentle falloff to both sides, a few faint darker streaks along its length, and a fade to nothing at the top and bottom edges. Pure white and light grey only, no color. On a pure black (#000000) background. Flat, seen straight on, no perspective. No text. Aspect ratio 3:4.
```

#### Clouds — `fx-clouds.png` · 1:1
Four clouds the game scatters around and below the level, so the arches look out onto clouds as in `concept-1`. Attach `sky-day` from `assets/art-src/` too, so they match its clouds.
```text
Four separate painted cumulus clouds arranged in a 2 × 2 grid, one in each quarter of the image, each fully inside its quarter with a clear margin of background around it, none touching another or the image edge. Different shapes: one tall billowing cloud, one wide flat cloud bank, one small round puff, one long wispy streak. Soft fluffy edges, sunlit warm white and pale gold tops, soft blue-grey and lavender undersides. Hand-painted stylized look matching the clouds of the attached sky: painterly brush texture, soft edges, no ink outlines. Isolated on a flat pure green (#00FF00) background: no sky, no ground, no text. Aspect ratio 1:1.
```

### Architecture (a later milestone)

Not used in M10, which builds its arches from painted textures (above) on simple geometry: reveals, crowns and pilaster strips. Kept as references for the later milestone that renders better sprites from professional 3D models.

Reference sheets that Claude models in Blender, like the Part A turnarounds: each shows one prop from the front, the side and the top, at the same scale, so it can be built accurately. They're never shown in the game. Save in `assets/art-src/reference/`.

**Attach only `concept-1.webp`**, for the style. With the swarm concept (`concept-3.webp`) attached, Gemini copies the whole game scene, HUD and all, instead of drawing a sheet. If it still draws a scene, start a new chat with no attachment at all.

**Check before saving:** exactly three views of one object on plain grey, nothing else (no enemies, HUD, floor or sky), and the three views match each other.

All five use this template, with the `<PROP>` text of each:
```text
This is not a game screenshot and not a scene: no characters, no HUD, no floor, no sky, no landscape. Only one object, drawn three times. A model sheet of <PROP> for a 3D artist. Three orthographic views of the same object, side by side on a plain light grey background: front view on the left, side view in the middle, top view on the right, at exactly the same scale, aligned, with no perspective. Hand-painted stylized game-art look matching the architecture in the attached images: ivory stone with gold leaf trim, clean readable shapes, thick dark ink-like outlines, flat even lighting with no cast shadows, simple shapes rather than tiny detail. Every view is complete and uncropped. No text, no letters, no numbers, no measurements. Aspect ratio 16:9.
```

| File | `<PROP>` |
|---|---|
| `prop-arch-sheet.png` | a single grand pointed arch about 6 m wide, springing from two short square piers, with a carved gold-trimmed molding on the face, a keystone with a small lily, and a plain flat back |
| `prop-column-sheet.png` | a single tall classical column about 8 m high: a square plinth, a fluted shaft with gold bands at the bottom and top, and an ornate capital with acanthus leaves and small gold volutes |
| `prop-balustrade-sheet.png` | a 2 m section of a stone balustrade about 1.1 m high: a pier at each end with a small ornament on top, a row of five fat baluster posts between them, and a thin gold-trimmed top rail |
| `prop-spire-sheet.png` | a cluster of three slender white towers of different heights (the tallest about 40 m) with pointed gold-capped roofs, one with a small dome, joined at the base by a low terrace with a few arched openings |
| `prop-island-sheet.png` | a small floating island of rock, about 30 m wide, its underside a tapering cone of rough stone with a few hanging roots and waterfalls dripping off the edge, with a flat grassy top carrying one small white pavilion with a gold dome and two columns |
