# Art prompts

Every image milestone 6 needs ([mvp.md](mvp.md) §11.2), with a ready-to-paste prompt for each. There are two kinds:

- **Part A, model references (16 images).** Claude builds the characters as 3D models in Blender and renders them into sprite atlases, as it did for the Blessed (the first-person weapons were Blender models too until M11 replaced them with paintings; their sheets are still attached to the M11 prompts). These images show what to build: one front picture to set the look, then front, side and back views to model from. They are never shown in the game.
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

The first-person weapons, each held in its class's own hands. The left view was for modeling (the M8 Blender weapons, replaced in M11 by the paintings below, which attach these sheets), the right one shows how it should look on screen. Save in `assets/art-src/reference/`.

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

## Milestone 12

New images for the burst death ([m12.md](m12.md) §4.2) and the Betrayer's dagger slash (§5.7). The burst death: when sudden big damage kills an enemy, its body is blasted back and torn apart. No blood ([lore.md](lore.md)): Heaven's bodies break like porcelain with light inside. Claude cuts the pieces out and prepares them; the game flings them along the hit, where they tumble and fall to the floor, and draws the burst as one flash. Save them in `assets/art-src/`.

Only the Cherubs have wings, so the torn wings are theirs. The Blessed, nine in ten of all kills, are torn in half: Claude renders their halves and sword from the Blessed's own Blender model (m12.md §4.2.1), so they match the sprite in the game exactly. No image is needed for them.

- [x] `shred-wing.png` (Cherubs)
- [x] `shred-wingtip.png` (Cherubs)
- [x] `fx-burst.png` (everyone)
- [x] `fp-betrayer-dagger.png` (the Betrayer's Shadowstep slash, first person; mirrored, 1357 × 774, an upscaled copy welcome)

#### The Betrayer's dagger — `fp-betrayer-dagger.png` · 16:9
The Betrayer's left hand lets go of the revolver and slashes with a dagger held in a reverse grip while it dashes (m12.md §5.7), like the Binder's fist in M11. The first try came out with a forward grip and a sword-length blade; the second, with the prompt below, came out right but as a right hand, and is used **mirrored**: a left hand from the bottom right, the arm crossed for a backhand cut, the blade on the fist's left side. Upscale it like the M11 weapons. A first-person overlay in the style of the M11 weapons (see *First-person weapons (M11)*: generate at the largest size, then upscale to at least 3 840 × 2 160). Attach: `fp-betrayer.png` first, then `betrayer-front.png`.
```text
This is not a game screenshot and not a scene. A first-person view of only the player's left forearm and hand slashing with a dagger, as a separate overlay for the attached first-person weapon image, in exactly its style: the left forearm in the same dark brown leather glove and sleeve as the attached image comes in from the bottom-left corner of the image, the hand at about 25% of the image width from the left and 80% of the image height from the top, the fist clenched knuckles-up, holding a short, slightly curved silver dagger in a reverse grip: the blade comes out of the bottom of the fist on the little-finger side and points down and slightly to the right, its edge facing right, the direction of the slash. The dagger is short, the blade about as long as the forearm from wrist to elbow, not a sword, with a dark leather grip and a small silver crossguard set with one red gem, like the gems on the attached revolver. Caught mid-slash from left to right; the speed is shown by painted streaks and smeared highlights along the blade, inside its outline. Art style: stylized 3D game art with a hand-inked graphic-novel finish: bold black ink outlines, cel shading in 2–3 tones with painterly brush texture, warm golden key light from the upper left. Everything except the forearm, hand and dagger is flat pure green (#00FF00): no revolver, no right hand, no background, no text, no glow or haze outside the outline. Aspect ratio 16:9.
```

#### Torn wing — `shred-wing.png` · 1:1
Drawn about 0.55 m across, tumbling through the air. Attach: `cherub-front.jpg`, `concept-1.webp`, `feather.png`.
```text
A torn-off angel wing: the upper half of a white feathered wing ripped away at its root, the torn edge ragged with loose broken feathers and a snapped pale bone, the long flight feathers still intact and fanned, a few gold-tipped feathers. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 48 pixels. No blood. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no glow, no shadow, no text. Aspect ratio 1:1.
```

#### Torn wing tip — `shred-wingtip.png` · 1:1
Drawn about 0.35 m across. Attach: `cherub-front.jpg`, `concept-1.webp`, `feather.png`.
```text
A small torn piece of an angel wing: a ragged clump of five or six long white flight feathers still joined at a torn edge, bent and splayed, one feather snapped. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 32 pixels. No blood. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no glow, no shadow, no text. Aspect ratio 1:1.
```

#### Burst — `fx-burst.png` · 1:1
The flash where a body bursts, drawn about 1–2 m across, growing as it fades. Attach: `blessed-front.jpg`, `concept-1.webp`, `feather.png`.
```text
A burst of holy light where an angel was torn apart: a jagged star-shaped explosion of white-gold light with hard-edged rays, a ring of white feathers and small gold shards flying outward from the center, a white-hot core. Game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline around the rays and feathers, flat cel shading, crisp hard edges, the light painted as solid hard-edged bands of white and pale gold. No blood. Centered, the whole burst inside the frame. Isolated on a flat pure green (#00FF00) background: no soft glow or haze outside the outline, no text. Aspect ratio 1:1.
```

---

## Milestone 10

10 images for the level art ([m10.md](m10.md)), plus 5 prop sheets made early for a later milestone. The goal is the look of the concept art, `concept-1` above all, at almost no cost per frame, so the prompts ask for flat, evenly lit images: the game adds its own baked light. Attach `concept-1.webp`, `concept-2.webp` and `concept-3.webp` to every prompt unless it says otherwise. Save them as named: the sky, textures and effects in `assets/art-src/`, the prop sheets in `assets/art-src/reference/`. Generate each in a new chat. They're needed in stages, so you can do them stage by stage.

**Optional extras that help** (not required): a close-up photo or painting of a real gold-inlay marble floor; a real arcade with arched windows seen from inside; any artwork of floating spires and towers in clouds. Attach them to the prompts they match.

JPEG is fine for all of them (`.jfif` or `.jpg`, same base name).

- [x] Stage 1: `sky-day`
- [x] Stages 3 and 5: `tex-floor-plain`, `tex-floor-medallion`, `tex-wall-window`, `tex-wall-pilaster`, `tex-cornice` (Claude fixes the plain floor's grid, adds the frieze to the window wall and crops the cornice to whole repeats of its pattern: [m10.md](m10.md) §5.1)
- [x] Stages 2 and 6: `tex-arcade` (Claude keys out the green, extends it to 1:2 and splits it into two layers: [m10.md](m10.md) §6)
- [x] Stage 7: `fx-lightshaft`
- [x] Stage 7: `fx-clouds` (Claude cleans the green rim off the soft edges: [m10.md](m10.md) §7.2)
- [ ] Stage 7: `fx-spires` (Claude cleans it like the clouds: [m10.md](m10.md) §7.3)
- [x] Later milestone (sprites from 3D models, not used in M10): `prop-arch-sheet`, `prop-column-sheet`, `prop-balustrade-sheet`, `prop-spire-sheet`, `prop-island-sheet`

### Sky (stage 1)

#### Sky — `sky-day.png` · 21:9
A horizon band around the player: the game shows it over half the circle and its mirror image over the other half, so its edges need not match, and blends the top and bottom into plain color. Generate at the largest size available.
```text
A wide panoramic painted sky of a heavenly realm, seen from a high floating terrace: a bright blue sky with big sunlit cumulus clouds, warm golden haze along the horizon, and in the distance floating spires, slender white towers, domes and broken arches rising out of the clouds at many different distances, some tiny and pale in the haze, some larger and clearer. Soft sunlight from the left, a hint of golden light rays through the clouds. The horizon is at about one third of the image height from the bottom; below it, thick white clouds and haze fade to pale gold. The upper half is clear deep blue with a few light clouds. Hand-painted stylized game skybox matching the sky in the attached images: painterly brush texture, soft edges, no ink outlines, rich saturated color. The left edge continues the right edge. No ground, no people, no birds, no text, no sun disc. Aspect ratio 21:9.
```

### Surfaces (stages 3 and 5)

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
The game stretches it vertically from the floor toward the cornice (about 1.7×), keeping the frieze at the bottom. It's a painted window; the game sets its glass back into the wall, but doesn't make it a real hole.
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

### Arches (stages 2 and 6)

#### Arcade bay — `tex-arcade.png` · 9:16
One bay of the arcade that runs along every open edge of the level, like the arches on the left of `concept-1`. Bays stand side by side, so each side edge shows half a pier. The game cuts out the green, so you see the sky through the arch. It's 4 m wide and 8 m tall in the game; Claude extends it to 1:2. Attach `tex-wall.png` too, so the stone matches.
```text
Game texture, viewed straight on, orthographic, filling the whole image: one bay of a grand Gothic arcade in ivory stone and gold. At the left and right edges, half of a square stone pier each (each 12% of the image width), cut exactly at the image edge so two images side by side make a whole pier. Between them, one tall pointed-arch opening whose apex is at 75% of the image height from the bottom, framed by a carved molding with gold-leaf trim and a small gold lily keystone. Across the bottom 17% of the opening, a stone balustrade: a plinth, a row of fat ivory balusters with gold accents, and a thin gold-trimmed top rail. Above the arch, solid ivory stone spandrels with fine gold scrollwork, and the top 20% of the image plain ivory stone blocks with thin dark joints. Everything that is open, inside the arch above the balustrade and between the balusters, is flat pure green (#00FF00), with no sky, no clouds and no glass. Hand-painted stylized texture matching the architecture in the attached images: painterly brush texture, crisp dark ink-like lines along the carved edges and joints. Even, flat lighting: no cast shadows, no vignette, no perspective. No text. Aspect ratio 9:16.
```

**Check before saving:** the opening is one clean green area (no sky painted into it), the arch is centered and symmetric, and the left and right edges are cut through the piers.

### Atmosphere (stage 7)

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

#### Distant spires — `fx-spires.png` · 1:1
Four far-off structures the game stands in the cloud sea 60–120 m beyond the level, so the sky has depth that shifts as you move, as in `concept-1` and `concept-2`. Seen from far away through haze, so simple shapes and soft detail. Attach `sky-day` from `assets/art-src/` too, so they match the spires painted in it.
```text
Four separate distant fantasy structures of a heavenly city arranged in a 2 × 2 grid, one in each quarter of the image, each fully inside its quarter with a clear margin of background around it, none touching another or the image edge: a cluster of three slender white towers of different heights with pointed gold-capped roofs; a single tall round tower topped by a gold dome; a small floating island of rock, its underside a tapering cone, carrying a white pavilion with a gold dome; a tall broken pointed arch on two slender piers. Each is tall and upright, standing straight, seen from straight in front at eye level, with no perspective. The bottom fifth of each fades into soft white cloud, so it seems to rise out of a sea of clouds. Pale ivory stone with gold accents, softly lit from the front, slightly brighter at the top, a little hazy as if seen from far away. Hand-painted stylized look matching the spires of the attached sky: painterly brush texture, soft edges, only faint thin outlines. Isolated on a flat pure green (#00FF00) background: no sky, no ground, no people, no text. Aspect ratio 1:1.
```

**Check before saving:** four separate, upright structures, none cut by its quarter's edge, no green inside them except between the island's pavilion columns, and clouds only at their feet.

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

---

## The Heavenly Gate (M10 follow-up)

4 images for the gate that replaces the boss arena's west wall ([m10-gate.md](m10-gate.md)): the golden gate of the title painting. The game builds simple shapes (square posts, crown boxes, crossed cards for the spires) and lays these paintings on them, so both are **flat, straight-on elevations**: no perspective, perfectly symmetric, evenly lit (the game adds its own sunlight). The sky shows through the bars, so the gaps must be clean flat green. Players can walk right up to the gate, so **generate at the largest size your tool offers, and upscale 4× (the generator's own upscale, or a free AI upscaler such as Upscayl)**. Save them in `assets/art-src/` as PNG. Generate each in a new chat.

**Attach to both:** `assets/art-src/ui-title-bg.png` (the title painting: the gate to match) and `assets/art-src/reference/concept-1.webp`.

- [x] `gate-leaves`
- [x] `gate-railing`
- [x] `gate-post-shaft`
- [x] `gate-post-top` (saved as `gate-post-top-2`; the first try had a ghost scene over its spire)

#### Gate leaves — `gate-leaves.png` · 9:16
The two closed leaves of the great gate, 18 m wide; their arched top reaches 32 m at the center. White stone gateposts stand at both sides in the game, so the image is only the ironwork.
```text
The two closed leaves of a colossal heavenly gate, exactly like the great golden gate in the first attached image, seen perfectly straight on as a flat elevation with no perspective, perfectly symmetric left to right, filling the whole frame. Elegant wrought ironwork of white and gold: tall slender vertical bars close together, with large flowing gold scrollwork, rings and curls, a great circle formed by curved bars across both leaves at mid height, and a round gold medallion at the top center. The two leaves meet at a vertical center line, marked by a heavier gold bar. Their outer edges are straight vertical frames from the bottom edge up to 60% of the image height; from there the top edge sweeps up in one smooth round arch to the top center of the image, lined with a row of small gold spear-point finials. A solid gold rail runs along the bottom edge. The gaps between the bars are clearly open, each about as wide as a bar, and every gap, and all the space above the arched top, is flat pure green (#00FF00), so the gate can be cut out and the sky seen through it. Even, flat, frontal light: no shadows, no glow, no light rays. Hand-painted stylized game art matching the attached images: crisp thin dark ink outlines, cel shading, white enamel and bright gold. No posts or pillars at the sides, no wall, no sky, no clouds, no people, no text. Aspect ratio 9:16.
```

**Check before saving:** symmetric; the leaves fill the frame edge to edge with straight vertical outer edges; the arched top touches the top edge only at the center; every gap is clean green (not grey or blurred) and about as wide as the bars; no posts at the sides.

#### Railing — `gate-railing.png` · 9:16
One panel of the tall gilded railing either side of the gate, 6 m wide and 10.7 m tall. The game repeats it four times between spired posts, so its left and right edges must continue into each other.
```text
One panel of a tall heavenly railing, matching the gilded railings beside the great gate in the first attached image, seen perfectly straight on as a flat elevation with no perspective, perfectly symmetric left to right, filling the whole frame. White and gold wrought ironwork: evenly spaced tall vertical bars from the bottom edge to near the top edge, each ending in a gold spear-point finial, a horizontal band of gold scrollwork across the bars at 15% and at 80% of the height, and a gentle gold arch of curved bars between the two bands. A solid gold rail along the bottom edge and a thin gold rail just below the finials. The left edge continues seamlessly into the right edge: the bars, rails and scroll bands line up so that panels placed side by side form one continuous railing, with no post or frame at either side. The gaps between the bars are clearly open, each about twice as wide as a bar, and every gap, and the space above the finials, is flat pure green (#00FF00). Even, flat, frontal light: no shadows, no glow. Hand-painted stylized game art matching the attached images: crisp thin dark ink outlines, cel shading, white enamel and bright gold. No posts, no wall, no sky, no clouds, no people, no text. Aspect ratio 9:16.
```

**Check before saving:** symmetric; no post or frame at either side; the rails and bands meet the left and right edges at the same heights; every gap is clean green.

#### Post shaft — `gate-post-shaft.png` · 9:16
One face of the tall square white posts beside the gate (the title painting's gateposts), 3 m wide. The game repeats it up the post, so its top must continue into its bottom. Opaque: no green.
```text
One flat face of a tall square heavenly gatepost, exactly like the white posts beside the great gate in the first attached image, seen perfectly straight on with no perspective, perfectly symmetric left to right, filling the whole frame edge to edge. Smooth white enamel stone with a long recessed vertical panel down the middle framed by thin gold lines, a slender gold vertical ornament inside the panel, and thin gold edge lines along the left and right edges. The top edge continues seamlessly into the bottom edge: the panel, its gold frame and the ornament run straight off the top and bottom, so faces placed one above another form one continuous post. Even, flat, frontal light: no shadows. Hand-painted stylized game art matching the attached images: crisp thin dark ink outlines, cel shading, white enamel and bright gold. No background, no capital, no base, no text. Aspect ratio 9:16.
```

**Check before saving:** fills the frame with no background; symmetric; the panel and lines run straight off the top and bottom edges at the same positions.

#### Post top — `gate-post-top.png` · 9:16
The gold crown and slender spire on top of each gatepost, as in the title painting. The game puts the crown on a 4 m box around the post's top and the spire on crossed cards above it, so it must be seen straight on and centered, with only green around it.
```text
The top of a tall heavenly gatepost, exactly like the crowned spires on the white posts in the first attached image, seen perfectly straight on with no perspective, perfectly symmetric left to right, centered. At the bottom, a square crown of gold: a band of tall pointed gold leaves and pointed arches flaring outward, as wide as one third of the image width, its bottom edge at the bottom edge of the image, about one fifth of the image height tall. Above it, rising from its center, a very slender white spire with gold edges and a small gold ring near its base, tapering to a sharp gold tip just below the top edge of the image; the spire's base is one sixth of the image width. Everything around the crown and spire is flat pure green (#00FF00). Even, flat, frontal light: no shadows, no glow. Hand-painted stylized game art matching the attached images: crisp thin dark ink outlines, cel shading, white enamel and bright gold. No post below the crown, no sky, no clouds, no text. Aspect ratio 9:16.
```

**Check before saving:** symmetric and centered; the crown sits on the bottom edge and is clearly wider than the spire's base; the tip doesn't touch the top edge; only green around it.

#### Kept for later: the cathedral-style gate
The first attempt, a cathedral front with towers and a pointed portal, isn't used by this gate. It's kept for later level design. Save the full-quality originals in `assets/art-src/reference/` as `cathedral-gate-front` (the towers, sunburst and portal) and `cathedral-gate-doors` (the scrolled doors), JPEG.

---

## First-person weapons (M11)

8 images for the painted weapons in the player's hands ([m11.md](m11.md)): one view per class, plus three changed copies and the Binder's chain. Each image is a whole **16:9 first-person view**, with everything but the weapon and hands flat green. Claude cuts the weapon out and puts it on screen exactly where it is in the image, so **where it sits in the frame matters**. Save them in `assets/art-src/` as PNG (JPEG is fine too).

**Size:** the weapon is on screen all the time and big, so generate at the **largest size your tool offers**. Then upscale to **at least 3 840 × 2 160** (the generator's own upscale, or a free AI upscaler such as Upscayl).

- [x] `fp-fallen`
- [ ] `fp-fallen-pump`: skipped (it didn't come out right); Claude makes the pump from `fp-fallen`
- [x] `fp-heretic`
- [x] `fp-heretic-empty`: made, but not used (its muzzle came out ugly); Claude removes the censer from `fp-heretic` instead
- [x] `fp-binder`: made **without hands** (the right hand didn't come out right)
- [x] `fp-binder-spin`
- [x] `fp-binder-sweep`: made in place of `fp-binder-scourge`, the left fist alone. The chain comes from `chain-ring.png`
- [x] `fp-betrayer`

**Optional:** `fp-binder`, `fp-binder-spin`, `fp-binder-sweep` and `fp-betrayer` are about 930 px tall, so they're a little soft on large screens. Upscaled copies (Upscayl, a digital-art model, 4×) saved under the same names would make them sharper. Upscale the Binder's pair with the same settings so they still line up.

**Order:** make each class's main image first, then its changed copy from it. Generate each main image in a new chat.

### The four weapons

All four use this template, with the class's values from the table below.

```text
This is not a game screenshot and not a scene: no enemies, no HUD, no crosshair, no level. A first-person shooter weapon view showing only the player's own weapon and hands, framed like the weapon in the first attached image: the <WEAPON> held in <HANDS>, coming into the frame from the bottom edge <SIDE>, pointing forward into the distance toward the center of the image, angled slightly inward. The muzzle is just below and right of the image center, at about <MX>% of the image width from the left and 58% of the image height from the top. No part of the weapon or hands reaches higher than 45% of the image height from the top. The forearms are cut off cleanly by the bottom edge of the image. The weapon's design is copied exactly from the attached weapon sheet: <DESCRIPTION>. The hands and forearms match the attached character. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, worn and scratched metal with crisp highlights, light ink hatching in the deepest shadows, warm golden key light from the upper left and a soft cool fill from the right. The glowing parts glow brightly inside their own outlines. Palette: soot black and charred iron with ember red and glowing brimstone-orange accents. Everything except the weapon, hands and forearms is flat pure green (#00FF00): no background, no floor, no sky, no text, no muzzle flash, no smoke, no sparks, no glow or haze outside the outline. Aspect ratio 16:9.
```

| File | Attach | `<WEAPON>` | `<HANDS>` | `<SIDE>` | `<MX>` | `<DESCRIPTION>` |
|---|---|---|---|---|---|---|
| `fp-fallen.png` | `concept-1.webp`, `weapon-shotgun-sheet.png`, `fallen-front.png` | Brimstone Shotgun | both of the Fallen's charred-black armored gauntlets with glowing molten-orange cracks and spiked vambraces, the right hand on the grip and the left hand on the pump under the barrel | right of center | 58 | a heavy pump-action shotgun of blackened iron with a wide double barrel, glowing red-orange runes carved along the barrel and stock, molten seams, a small orange front sight |
| `fp-heretic.png` | `concept-1.webp`, `weapon-censer-sheet.png`, `heretic-front.png` | Censer Launcher | soot-black cloth-wrapped hands with ember-red bandages and ragged black sleeves, the right hand on the grip and the left hand under the barrel | right of center | 58 | a stubby wide-mouthed launcher of blackened bronze covered in gothic church filigree, a round incense censer with glowing orange coals loaded in its muzzle and clearly visible, a short chain hanging below |
| `fp-binder.png` | `concept-2.webp`, `weapon-chaingun-sheet.png`, `binder-front.png` | Chain Gun | only the right hand, in a black iron glove with chain links wrapped around the wrist, on the rear grip; the left hand is not in view | right of center | 58 | a rotary chain gun with six blackened barrels whose front ends are clearly visible, glowing red-hot bands around the barrels, wrapped in heavy chains, a belt of chain links feeding into its side |
| `fp-betrayer.png` | `concept-3.webp`, `weapon-revolver-sheet.png`, `betrayer-front.png` | Silver Revolver | slim black leather gloves in a two-handed grip, the right hand on the grip and the left hand cupped under it | a little right of center | 54 | an ornate long-barreled silver revolver with engraved filigree, a six-chamber cylinder, a black grip and a small blood-red gem on the hammer |

The concept images are in `assets/art-src/reference/`, like the weapon sheets and the character fronts. They show the framing: the weapon low on the right, pointing at the center.

**Pointing fix.** If the weapon looks turned to the left (you see its whole side, and it seems to aim past the center), add this sentence right after the one about the muzzle and generate again:
```text
The weapon points straight ahead, away from the viewer, exactly at the center of the image: we see it mostly from behind and a little from above, its back end nearest to us and its muzzle farthest, with only a thin sliver of its side visible. The line of the barrel, continued forward, runs through the exact center of the image.
```
The delivered Censer Launcher and Silver Revolver look turned left. Claude can rotate them on screen so they aim at the crosshair (see [m11.md](m11.md) §2), but a rotation can't hide the side the painting shows. Regenerate them with this fix if they still look turned in the previews.

**If Gemini paints a whole game scene** (enemies, a level, a HUD) instead of the weapon on green, start a new chat and attach only the weapon sheet and the character front.

**Check before saving:**
- only the weapon, hands and forearms, everything else clean flat green;
- the weapon comes in from the bottom edge, and nothing of it is in the top 45% of the image;
- the muzzle is a little right of and below the center;
- the design matches the weapon sheet; the hands match the class;
- no muzzle flash, smoke, text or glow outside the outline.

### The changed copies

Each is the main image with one thing changed, so the game can swap between them. Start a new chat and **attach only the finished main image** (after upscaling is fine).

```text
Edit the attached image. Change only this: <CHANGE>. Keep everything else exactly as it is: the same image size and framing, the same position, angle and size of the weapon and hands, the same lines, colors and light, and the same flat pure green (#00FF00) background. No muzzle flash, no smoke, no sparks, no glow outside the outline, no text.
```

| File | Attach | `<CHANGE>` |
|---|---|---|
| `fp-heretic-empty.png` | `fp-heretic.png` | the incense censer in the launcher's muzzle is gone, just fired: the muzzle is an empty dark bronze bore with a faint orange glow deep inside |
| `fp-binder-spin.png` | `fp-binder.png` | the six barrels are spinning very fast: paint the barrel cluster as a smooth circular motion blur around its axis, the glowing red-hot bands smeared into continuous bright rings, the barrels' front ends blurred into one ring; the chains wrapped around the barrels blurred the same way |
| `fp-fallen-pump.png` (optional) | `fp-fallen.png` | the pump grip under the barrel and the left hand holding it slide back toward the viewer by about the length of the hand, as when racking a pump-action shotgun; the barrel and the right hand stay exactly where they are |

**Check before saving:** lay the two images over each other (or flip between them): only the named part changed, nothing else moved. If the whole weapon shifted or changed shape, try again.

### The Binder's chain — `fp-binder-scourge.png` · 16:9

The Scourge: the Binder's free left hand whips a chain across the view. The game swings this image across the screen, so it only shows the fist and the chain. Start a new chat. Attach `fp-binder.png` (to match its style and gloves) and `binder-front.png`.

```text
This is not a game screenshot and not a scene. A first-person view of only the player's left forearm and fist swinging a chain, as a separate overlay for the attached first-person weapon image, in exactly its style: the left forearm comes in from the bottom-left corner of the image, the fist in a black iron glove with chain links wrapped around the wrist, matching the attached images, at about 20% of the image width from the left and 85% of the image height from the top, gripping a heavy chain of red-hot glowing iron links. The chain sweeps out from the fist toward the upper right in one long smooth curve, as if whipped hard from left to right, and ends in a heavy hooked iron weight with red-hot edges at about 75% of the image width from the left and 45% of the image height from the top. The speed is shown by painted streaks and smeared highlights along the links, inside the chain's outline. Art style: stylized 3D game art with a hand-inked graphic-novel finish: bold black ink outlines, cel shading in 2–3 tones with painterly brush texture, warm golden key light from the upper left. Everything except the forearm, fist, chain and weight is flat pure green (#00FF00): no gun, no right hand, no background, no text, no glow or haze outside the outline. Aspect ratio 16:9.
```

**Check before saving:** one forearm, fist, chain and weight, nothing else (no gun, no second hand); the chain is one continuous curve with a crisp outline; clean flat green around it.

---

## Pro character models (Meshy)

The images Meshy turns into 3D models, for the sprites rendered from professional models (milestone not numbered yet). The whole process is in [meshy-guide.md](meshy-guide.md). The Blessed is the pilot; the other characters follow once it works.

These images are **inputs for Meshy, not art**. Meshy paints the image's colors onto the model, so the views must be flat (no light, no shadows) and the background a plain grey it can remove. Save them in `assets/art-src/reference/`.

- [ ] `blessed-design.png`: the upgraded look
- [ ] `blessed-turnaround.png`: front, side and back for Meshy (Claude cuts it into `blessed-mv-front.png`, `blessed-mv-side.png`, `blessed-mv-back.png`)
- [ ] `blessed-sword.png`: the sword on its own

### The Blessed's design — `blessed-design.png` · 9:16

Attach: `blessed-front.jpg`, `concept-4.jfif`

Raises the Blessed to the concept's level of detail while keeping who he is. Two changes on purpose: the robe becomes a **tabard that ends above the knee** (Meshy's rigging gives legs bones but not a long robe, which would stretch like rubber between the legs), and there is **no halo** (the game draws it in code, so it always faces the camera).

```text
A redesign of the first attached character, the Blessed, a holy pilgrim-soldier of Heaven and the most common enemy, keeping his identity: a gaunt, bald old man with a short white beard and blind, pale white eyes, ivory cloth with sky-blue trim and polished gold, a straight longsword. Raise the detail and craftsmanship to the level of the soldiers in the second attached image: fitted white plate armor with engraved gold filigree edges over an ivory padded gambeson; layered white pauldrons with gold rims; a gold-trimmed ivory cowl draped over the shoulders; a sky-blue sash at the waist with a gold buckle; an ivory tabard with sky-blue borders and a small gold sunburst on the chest, split at the front, back and sides and reaching just above the knees, so the armored legs are fully visible: white greaves, gold-rimmed knee cops, steel sabatons; gold bracers. No halo, no helmet, no cape, no floor-length robe. He holds the longsword in the right hand, low and diagonally across the body, point down. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: ivory, white and polished gold with pastel sky-blue accents. Full body, front view facing the viewer, centered, the whole figure inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 9:16.
```

**Check before saving:** the same face (bald, white beard, pale eyes); the legs visible below the tabard from the knee down; no halo; the sword in the right hand. Generate again until you like the look: everything after this copies it.

**The Blessed keeps the sword.** The concept's golden scepter-mace is reserved for a future enemy: bigger, slower, armored and stronger than the Blessed.

### The Blessed for Meshy — `blessed-turnaround.png` · 16:9

Attach: `blessed-design.png` only. Start a new chat.

```text
Character model sheet for 3D modeling, copying the character in the attached image: three full-body views side by side, from left to right: front, right side profile, back. Copy the attached design exactly: same face, proportions, armor, clothing and colors in every view. Pose in every view: a neutral A-pose: standing straight, feet apart at shoulder width and pointing forward, arms straight and angled down and away from the body at about 45 degrees, palms facing the thighs, so the arms, hands and legs are clearly separated from the body and from each other; both hands empty, the fingers loosely curled as if around a sword grip; neutral face, mouth closed, looking straight ahead. No sword, no weapon, nothing held, no halo. All three views at the same scale, standing on one shared baseline, orthographic with no perspective, evenly spaced with a wide gap between them, nothing overlapping. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no hatching, no highlights, no rim light, no glow and no light direction at all; thin dark lines only where two colors or parts meet, no thick outer contour. Plain flat medium grey (#808080) background, no floor, no shadows, no text, no labels, no arrows, no extra views or characters. Aspect ratio 16:9.
```

**Check before saving:**
- three views, the same character in each (same armor, same tabard length, same trim);
- arms clearly away from the body, both hands empty, feet apart;
- the side view is a true profile and the back view really shows the back (a cowl and tabard back, not a second front);
- no shadows or shading: the ivory looks the same color on the left and right sides of the body;
- the whole figure inside each view, feet included, with grey around it.

If one view is wrong, reply *"Fix only the <side/back> view: …"* rather than starting over.

### The Blessed's sword — `blessed-sword.png` · 16:9

Attach: `blessed-design.png` only. Start a new chat.

```text
Weapon model sheet for 3D modeling: the longsword carried by the character in the attached image, alone, in exact side profile, horizontal, the blade pointing right, the whole sword inside the frame with a margin around it. Copy the attached design: a straight double-edged steel blade with a central fuller and fine gold filigree near the guard, a straight gold crossguard with flared ends, a grip wrapped in brown leather, a round gold pommel. Orthographic with no perspective. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no highlights, no reflections, no glow; thin dark lines only where two parts meet. Plain flat medium grey (#808080) background, no hands, no text, no labels. Aspect ratio 16:9.
```

**Check before saving:** the whole sword, straight and horizontal, matching the design image; no hands; no shine or reflections painted on the blade.

---

## Loading cards

Full-screen paintings shown while a game loads, one per card in [lore.md](lore.md) (*Loading cards*). The two premise cards tell the story; the four hero cards each show **the hero before damnation, at the moment of condemnation**. The card's title and text sit over the bottom third. Save in `assets/art-src/`; Claude crops them to 16:9 and ships them as JPEG, like the title background.

**The style: silhouettes.** Every card is told in dark ink-outlined silhouettes against a glowing sky, taken from the cloud bank and the row of trumpeting angels at the bottom of a rejected Verdict image (`assets/art-src/reference/silhouette-style.png`). It suits a loading screen: one strong shape per card, read at a glance, and the dark bottom band carries the text. Each card has its own sky color and one small glowing accent; everything else is outline.

**Keeping the six consistent**
- **One style paragraph.** Every prompt ends with the same paragraph, word for word. Don't edit it in one prompt only.
- **One style image.** Attach `silhouette-style.png` to every card, and an approved card or two (`load-fallen.png`, `load-heretic.png`) to any card regenerated later.
- **Outlines that tell the heroes apart:** the Fallen's horns and great wings, the Heretic's tall gaunt frame and halo ring, the Binder's stocky build and chains, the Betrayer's slim frame and long coat with split tails. Each hero's front is attached for its outline.
- **Start a new chat for each card.**
- **Compare them side by side.** When all six are in, Claude puts them on one contact sheet; regenerate any card that stands out.
- **If a result is too busy or too literal,** reply *"Simpler: fewer shapes, more empty sky, one strong silhouette."*

#### The Verdict — `load-verdict.png` · 16:9
Two candidates; generate both and keep the better one as `load-verdict.png`. Both show the Verdict from Earth's side: the only card about the people the damned fight for. **Heaven is never shown, only its signs:** angels sounding trumpets drawn literally looked comic (two rejected attempts), so the threat is a light in the sky that shouldn't be there.

Attach to both: `silhouette-style.png`, `load-fallen.png`, `load-heretic.png` (approved cards, for the look).

**A. The Angelus.** After Millet's painting: two farmers pray at dusk under a sky glowing with a light greater than the sun. The farmers, the church and the birds are right in `verdict-angelus.png` (a rejected attempt); its seven pillars of light looked like science fiction, so the light is natural rays through clouds. To fix that image rather than start over, attach it and reply with the edit below.
```text
A clear, simple story told at a glance, staged like a single frame of a film, after Millet's painting The Angelus. Dusk over a wide, flat field of harvested wheat with sheaves standing in it. In the foreground, two farmers in plain work clothes stand facing each other with heads bowed in evening prayer, a basket and a pitchfork beside them; far away, a small village church spire. They do not look up. Above them, a vast, heavy ceiling of cloud covers the whole sky, glowing gold from within as if a light far greater than the sun were behind it, and soft natural rays of light fall through its gaps across the land, beautiful and ominous. Far in the distance, a host of tiny winged knights with burning swords emerges from behind the golden clouds, so small and far away that at first glance they read as a flock of birds; only their wings and the tiny flames of their swords give them away. No beams or pillars in the sky, only clouds and natural rays of light. Low on the horizon the sky glows orange. Glowing accents: the gold glow inside the clouds, the rays of light, the tiny flames of the distant swords, one lit window in the distant church. Art style matching the attached silhouette-style image: the scene is told in silhouettes. Every figure, cloud and landform is a dark charcoal-grey to near-black shape with crisp hand-inked outlines, a little painterly brush texture and only slight tonal variation inside, set against a luminous glowing sky. Inside the silhouettes there is no detail except small glowing accents. Depth comes from 2–3 layered planes of silhouettes, the farther ones lighter and hazier. Every figure reads by its outline alone. Most of the image is open glowing sky; the bottom third is a dark band of silhouetted clouds or ground, calm, with little detail. No text, no letters, no logo, no blood. Aspect ratio 16:9.
```

Edit for `verdict-angelus.png` (the cloud-sky version, with birds):
```text
Keep everything in this image exactly as it is: the farmers, the field, the sheaves, the church, the clouds and the rays of light. Replace only the flock of birds: in the same place, far in the distance, a host of tiny winged knights with burning swords emerges from behind the golden clouds. Keep them as small as the birds were, dark silhouettes, so at first glance they still read as a flock of birds; only their outspread wings and the tiny flames of their raised swords give them away. Many of them, in a loose flock, not a row. No details on them, no faces, no trumpets.
```

**B. The child on the rooftop.** One child sees Heaven open above a sleeping city.
```text
A clear, simple story told at a glance, staged like a single frame of a film. Night over a crowded old city of steep roofs, chimneys, church spires and countless lit windows. In the foreground on the right, a small child in a nightshirt sits on a rooftop ridge beside a chimney, seen from behind, looking up. High above the city, the heavy clouds have opened in a vast, perfectly round hole, its edges unnaturally smooth, and a column of blinding golden light pours down through it onto the middle of the city like daylight at midnight. Flocks of birds rise from the roofs and scatter away from the light. There are no angels and no figures in the sky. The rest of the sky is deep night blue. Glowing accents: the round opening and its column of light, the city's lit windows, a thin gold rim along the child's outline. Art style matching the attached silhouette-style image: the scene is told in silhouettes. Every figure, cloud and landform is a dark charcoal-grey to near-black shape with crisp hand-inked outlines, a little painterly brush texture and only slight tonal variation inside, set against a luminous glowing sky. Inside the silhouettes there is no detail except small glowing accents. Depth comes from 2–3 layered planes of silhouettes, the farther ones lighter and hazier. Every figure reads by its outline alone. Most of the image is open glowing sky; the bottom third is a dark band of silhouetted clouds or ground, calm, with little detail. No text, no letters, no logo, no blood. Aspect ratio 16:9.
```

#### The Appeal — `load-appeal.png` · 16:9
Attach: `silhouette-style.png`, `objection-mood.png`, `load-verdict.png`
`objection-mood.png` (a crop of a rejected attempt) sets this card's red, the embers and sparks, and the dark stepped stair.
```text
Four figures stand together at the foot of a stair in the foreground, large in the frame, seen from behind, looking up the stair: a hulking horned knight with the burnt stumps of wings, a tall gaunt hooded figure with a broken halo ring above the head, a stocky figure hung with looped chains, and a slim figure in a long coat with split tails. Ahead of them, a dark stone stair climbs away into the distance, seen through drifting red smoke, each flight fainter than the last, until it is lost in the haze. Far away at its top, small and high, a pale gold light shines through the smoke: Heaven, not shown, only its light. The whole sky is deep red and burning orange, thick with smoke, full of embers and sparks swirling up around the figures. Glowing accents: the embers and sparks, the halo ring, the chain links glowing red, the distant gold light. Art style matching the attached silhouette-style image: the scene is told in silhouettes. Every figure, cloud and landform is a dark charcoal-grey to near-black shape with crisp hand-inked outlines, a little painterly brush texture and only slight tonal variation inside, set against a luminous glowing sky. Inside the silhouettes there is no detail except small glowing accents. Depth comes from 2–3 layered planes of silhouettes, the farther ones lighter and hazier. Every figure reads by its outline alone. Most of the image is open glowing sky; the bottom third is a dark band of silhouetted clouds or ground, calm, with little detail. No text, no letters, no logo, no blood. Aspect ratio 16:9.
```

#### The Fallen — `load-fallen.png` · 16:9
Attach: `silhouette-style.png`, `load-verdict.png`, `fallen-front.png`
The front is attached only for the outline: the scene shows the hero before damnation.
```text
A clear, simple story told at a glance, staged like a single frame of a film. Night. In the foreground on the right, alone on a hilltop, an armored angel knight with a horned helm kneels, seen from behind and a little to the side, broken: its sword dropped on the ground beside it, head bowed, one hand pressed to its chest, its great wings drooping to the ground. It watches the far distance, where a walled city in the valley burns: the fires are the brightest thing in the image, and tiny winged figures with flaming swords circle above the flames, its comrades doing what it refused to do. Nobody else is near it. Smoke rises from the city into a night-blue sky lit orange from below. Glowing accents: the burning city, the tiny flaming swords above it, embers drifting on the wind. Art style matching the attached silhouette-style image: the scene is told in silhouettes. Every figure, cloud and landform is a dark charcoal-grey to near-black shape with crisp hand-inked outlines, a little painterly brush texture and only slight tonal variation inside, set against a luminous glowing sky. Inside the silhouettes there is no detail except small glowing accents. Depth comes from 2–3 layered planes of silhouettes, the farther ones lighter and hazier. Every figure reads by its outline alone. Most of the image is open glowing sky; the bottom third is a dark band of silhouetted clouds or ground, calm, with little detail. No text, no letters, no logo, no blood. Aspect ratio 16:9.
```

#### The Heretic Saint — `load-heretic.png` · 16:9
Attach: `silhouette-style.png`, `load-verdict.png`, `heretic-front.png`
The front is attached only for the outline: the scene shows the hero before damnation.
```text
Dusk in a medieval town square. At the center, a tall, gaunt figure in a plain robe stands bound to a tall stake on a pyre of bundled branches, head raised, calm; a thin halo ring floats above the head, a crack through it. Flames are just catching at the foot of the pyre. Around it, a crowd with torches: a mother reaching toward the stake while guards hold her back, and on a platform beside it a bishop in a tall mitre holding up a scroll. Steep roofs and a church spire against the sky. The sky glows dusky orange low down, fading to violet above. Glowing accents: the flames at the foot of the pyre, the torches, the halo ring. Art style matching the attached silhouette-style image: the scene is told in silhouettes. Every figure, cloud and landform is a dark charcoal-grey to near-black shape with crisp hand-inked outlines, a little painterly brush texture and only slight tonal variation inside, set against a luminous glowing sky. Inside the silhouettes there is no detail except small glowing accents. Depth comes from 2–3 layered planes of silhouettes, the farther ones lighter and hazier. Every figure reads by its outline alone. Most of the image is open glowing sky; the bottom third is a dark band of silhouetted clouds or ground, calm, with little detail. No text, no letters, no logo, no blood. Aspect ratio 16:9.
```

#### The Binder — `load-binder.png` · 16:9
Attach: `silhouette-style.png`, `load-verdict.png`, `binder-front.png`
The front is attached only for the outline: the scene shows the hero before damnation.
```text
The deepest pit of Hell. A colossal giant rises from the abyss, straining with its huge shoulders and arms, a great chain wrapped taut around them. On a narrow rock ledge, small against the giant, a stocky angel braces and hauls the chain, heavy chains looped over its shoulders and arms. Its armor is falling apart, and the outline shows it: ragged broken edges, a plate hanging loose from a strap, gaps where pieces are missing, a cracked-off shoulder plate. Its small wings are folded tight. Below, the abyss glows red-orange from lava far down; the dark rises to black at the top. Glowing accents: the chain links glowing red-hot, the lava glow. Art style matching the attached silhouette-style image: the scene is told in silhouettes. Every figure, cloud and landform is a dark charcoal-grey to near-black shape with crisp hand-inked outlines, a little painterly brush texture and only slight tonal variation inside, set against a luminous glowing sky. Inside the silhouettes there is no detail except small glowing accents. Depth comes from 2–3 layered planes of silhouettes, the farther ones lighter and hazier. Every figure reads by its outline alone. Most of the image is open glowing sky; the bottom third is a dark band of silhouetted clouds or ground, calm, with little detail. No text, no letters, no logo, no blood. Aspect ratio 16:9.
```

#### The Betrayer — `load-betrayer.png` · 16:9
Attach: `silhouette-style.png`, `betrayer-mood.png`, `load-verdict.png`, `betrayer-front.png`
`betrayer-mood.png` (a rejected attempt with the right look) sets this card's cavern, red light and the shaft of light from the ceiling.
The front is attached only for the outline: the scene shows the hero before damnation.
```text
A clear, simple story told at a glance, staged like a single frame of a film: a spy turning its back on Heaven. A vast cavern in Hell with jagged stalactites. On the right, a shaft of golden light falls from a crack in the cavern ceiling onto the floor, calling the spy home. A slim figure in a narrow hood and a long fitted coat with tails split to the knees, a sash at the waist, has just stepped out of that light, its back to it, walking away toward the left. Behind it, in the pool of light, lies a dropped pouch of silver coins spilling open: Heaven's pay, left behind. On the left, ragged damned souls, plain humans in rags and not monsters, sit around a campfire; one of them holds out a piece of bread toward the approaching figure, and the others make room for it. The cavern glows warm red around the fire and fades to black at the edges. Glowing accents: the shaft of golden light, the coins in it, the campfire. Art style matching the attached silhouette-style image: the scene is told in silhouettes. Every figure, cloud and landform is a dark charcoal-grey to near-black shape with crisp hand-inked outlines, a little painterly brush texture and only slight tonal variation inside, set against a luminous glowing sky. Inside the silhouettes there is no detail except small glowing accents. Depth comes from 2–3 layered planes of silhouettes, the farther ones lighter and hazier. Every figure reads by its outline alone. Most of the image is open glowing sky; the bottom third is a dark band of silhouetted clouds or ground, calm, with little detail. No text, no letters, no logo, no blood. Aspect ratio 16:9.
```

**Check before saving:** no text or letters anywhere; every figure reads by its outline alone; only the listed accents glow; the bottom third is a dark, calm band; the same look as `silhouette-style.png` and `load-verdict.png`.
