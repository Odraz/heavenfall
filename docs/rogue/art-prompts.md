# Rogue art prompts

Every new image the Pearly Gates roguelite needs, each with a ready-to-paste prompt. It follows the same rules as the original [art-prompts.md](../art-prompts.md): the same tool (Gemini), the same backgrounds, the same style sentences, the same file conventions. Everything that already exists (the four players, the Blessed, Chorister, Cherub, Gatekeeper, the first-person weapons, the marble/gold architecture kit, the sky, the decorations, the base ability icons, the UI frames, the loading cards) is **reused, not regenerated**.

There are two kinds of images, as before:

- **Part A, model references (16 images).** For the three commanders (the Dominion, the Lectern Cantor and the Stray-Carrier), the Watchman and the Gatekeeper's trumpet. Claude builds them as 3D models and renders them into sprites; these images are never shown in the game. They follow the [Meshy guide](../look/meshy.md) format (flat colors, grey background, A-pose), which also works for Claude's own Blender modeling.
- **Part B, game assets.** Used in the game directly after Claude cuts out the background, crops and resizes them.

Map icons, door sigils, reward plates, state markers, rings, lanes, timers, text and numbers are **drawn in code**, not generated. Do not make images for them.

---

## Checklist

Save every image as PNG with exactly this name: Part A in `assets/art-src/reference/`, Part B in `assets/art-src/`. "Needed by" is the milestone ([implementation.md](implementation.md)) whose play checkpoint first shows the image; until it arrives the game uses a labeled placeholder. **Required** images must exist before the slice is accepted; **optional** ones have a coded or reused fallback.

**Checked means source received**, not integrated or accepted in the game. Every received source is stored as PNG under its target name; JPEG/JFIF downloads are converted on receipt (see the dated receipts). For partially received families, the missing files are listed below. Runtime preparation and human acceptance remain tracked in [asset-manifest.md](asset-manifest.md).

**Part A: model references** (`assets/art-src/reference/`)
- [x] A1 The Dominion, needed by R2, required: `dominion-design.png` (do this first), `dominion-turnaround.png`, `dominion-wings.png`, `dominion-mace.png`
- [x] A2 The Gatekeeper's trumpet, needed by R7, required: `gatekeeper-trumpet.png`, `gatekeeper-trumpet-raised.png`
- [x] A3 The Lectern Cantor, needed by the R2 commander follow-up, required: `cantor-design.png` (do this first), `cantor-turnaround.png`, `cantor-hymnal.png`
- [x] A4 The Stray-Carrier, needed by the R2 commander follow-up (after the Cantor), required: `carrier-design.png` (do this first), `carrier-turnaround.png`, `carrier-wings.png`, `carrier-shroud.png`
- [x] A5 The Watchman, needed by the [R04 follow-up](r04-watchman.md) stage 4, required: `watchman-design.png` (pilot, do this first), `watchman-clarion.png`, `watchman-aim.png`

**Part B: game assets** (`assets/art-src/`)
- [x] B1 Breakable props, needed by R2, required: `amphora-tall.png` (pilot, do it first), `amphora-squat.png`, `amphora-lily.png`, `amphora-marked.png`, `sanctuary-lamp.png`, `blessing-chalice.png`
- [x] B2 Pickups, needed by R2 (halo, mote) and R4 (page), required: `gold-halo.png`, `heal-mote.png`, `rite-page.png`
- [x] B3 The Pardoner's stall, needed by R3, required: `npc-pardoner.png`, `pardoner-box.png`, `shop-pedestal.png`, `chart-scroll.png`.
- [x] B4 The Confessional, needed by R1 (shell) and R4 (Advocate), required: `confessional-grille.png`, `tex-confessional-wood.png`
- [x] B5 Rewards and challenges, needed by R6, required: `shared-key.png`, `reliquary-chest.png`, `reliquary-chest-open.png`, `judgment-bell.png`, `sundial.png`
- [x] B6 Boss parts, needed by R7, required, **received 2026-10-25 as JPEG** (conversion and cutout in R8 stage 4): `watcher-open.png`, `watcher-closed.png`, `judgment-seal.png`
- [x] B7 Item icons, **redo by shape (2026-10-15), received and integrated the same day**: tubes `item-balm.png` (pilot), `item-seal.png`, `item-feather.png`; jars `item-venom.png` (pilot), `item-frost.png`, `item-chain.png`, `item-plume.png`. `item-mirror.png` stays.
- [x] B8 Relic icons, needed by R6, required: `relic-usher.png` (pilot), `relic-thurible.png`, `relic-link.png`, `relic-tile.png`, `relic-qseal.png`, `relic-eseal.png`, `relic-comb.png`, `relic-wheel.png`, `relic-unbroken.png`, `relic-mercy.png`, `relic-armageddon.png`, `relic-sentence3.png`
- [x] B9 New ability icons, needed by R4 (Betrayer's three) and R5 (the other nine), required: `icon-judas-coin.png` (pilot), `icon-way-back.png`, `icon-silver-wire.png`, `icon-gatebreaker.png`, `icon-rain-of-fire.png`, `icon-cast-out.png`, `icon-bread-of-angels.png`, `icon-trial-by-fire.png`, `icon-cloud-of-witnesses.png`, `icon-well-of-giants.png`, `icon-ring-of-giants.png`, `icon-boundary-chain.png`.
- [x] B10 Hazard and effect textures, needed by R2, required: `tex-refiner-channel.png`, `fx-flames.png`
- [ ] B11 Optional: 6 combo emblems `combo-<id>.png` (R6) and 72 talent icons `talent-<class>-<tree>-<node>.png` (R4–R5). Without them the cards show the class glyph and the talent's name.

**Totals:** 16 model references + 57 required game assets + 78 optional icons (A5's three added 2026-10-16). Earlier drafts also listed `fx-embers`, `fx-incense-wisp` and `silent-trumpet`; the first two are covered by the existing `ember.png` and `fx-smoke.png`, and the trumpet is now the A2 model reference.

**Current receipt status — 2026-10-25:** 73/73 required sources received (all 16 model references and 57 game assets). B6 arrived on 2026-10-25 as `assets/art-src/{watcher-open,watcher-closed,judgment-seal}.jpeg` (2048 × 2048, flat green). All three pass their checks; the open eye has a faint smear on the bottom gold point to clean while cutting. Only the optional B11 icons remain. The dated receipts below record each batch.

### Received sources — 2026-10-12

**27/63 required sources received:** 4 model references and 23 game assets; 36 required sources still missing. The JPEG/JFIF downloads were converted to PNG at their original resolution, with decoded pixels verified unchanged. Their green, magenta, grey or black backgrounds remain for later preparation. This receipt does not approve the pilots or replace the in-game acceptance check.

The original downloads are preserved byte for byte under `tmp/asset-originals-2026-10-13/props/` and `tmp/asset-originals-2026-10-13/dominion/`, with their original filenames. PNG sources use the prompt IDs above. Generation tool, generation date and subscription plan are unconfirmed; the receipt date is not a generation date.

| Original filename | PNG source | Reason |
|---|---|---|
| `tem-venom.jfif` | `item-venom.png` | Filename typo; the image shows the Bitter Water flask. |
| `shop-pedestal.jfif` | `pardoner-box.png` | The image shows the indulgence box: slanted lid, coin slot, red velvet panels and padlock. The empty marble shop pedestal is still needed. |

**Preparation notes from source inspection:**

- The Dominion design and wing sheet show wings extending outward; review them against the folded-down silhouette before modeling.
- `heal-mote.png` includes detached sparkles; account for them when cropping the small pickup.
- `item-frost.png` has violet plumes reaching the top edge; review the crop at 48 px before accepting it.
- `confessional-grille.png` includes a stone surround; review the panel crop and how it joins the wood wall.
- Tile seams (`tex-confessional-wood`, `tex-refiner-channel`, `fx-flames`), chroma-key edges and readability at gameplay size still need integration checks.

### Received sources — commanders, 2026-10-13

**A3 and A4 received: 7 model references.** The JPEG/JFIF downloads were converted to PNG at their original resolution, with decoded pixels verified unchanged; the originals are preserved byte for byte under `tmp/asset-originals-2026-10-13/commanders/` (`cantor-turnaround..jfif` had a doubled dot). This receipt does not approve the designs.

**Preparation notes from source inspection** (decide before modeling):

- **Cantor's book color:** `cantor-design.png` and `cantor-hymnal.png` show a **brown leather** book with gold fittings, not the dark bronze the prompt asked for. Bronze was meant to repeat the Dominion's "armored side" language; brown still reads as the front against the white robes. Accept it, or regenerate only the color (*"Same image, but the book cover is smooth dark bronze metal, not brown leather"*).
- **Cantor's wings:** the design added large spread white wings, which the Choristers don't have; the turnaround keeps them. The silhouette still reads (candle crown above everything, book in front). If accepted, the wings need their own geometry: no `cantor-wings.png` exists, so either a wing sheet is generated or the Dominion's wing model is adapted and spread.
- **Cantor's back:** plain white with one gold band down the spine, as asked: the front and back read differently.
- **Carrier's proportions:** the shroud reaches just below the feet and pools to the sides, rather than trailing two body lengths; the arms are only slightly long in the design and normal in the turnaround. Both still read; the model can lengthen the shroud.
- **Carrier's wings:** `carrier-wings.png` shows the pair from behind plus one more wing, half-spread rather than fully spread, and the third view is not a true side profile. Usable for feather texture and outline; the spread pose is set in Blender.

### Received sources — A5 the Watchman, 2026-10-16

**A5 received: 3 model references** (`watchman-design.png`, `watchman-clarion.png`, `watchman-aim.png`). The JFIF downloads were converted to PNG at their original resolution (1696 × 2528, 1022 × 430 and 2048 × 2048), with decoded pixels verified unchanged. The originals are preserved byte for byte, with SHA-256 hashes in `receipt.json`, under `tmp/asset-originals-2026-10-16/`. Generation tool, generation date and subscription plan are unconfirmed. This receipt does not approve the pilot or replace the in-game check.

**Checked against the prompts:**

- **Design (pilot):** matches. It is clearly a Blessed (the same face, beard, blank eyes, halo, robes and armor) with a gold brimmed helmet, a sky-blue plume and no sword; the Clarion is held upright in the right hand with the stock at the hip; the left hand is empty; no wings, smoke or flash. The trumpet bell stands well above the helmet, but the plume reaches about the same height, so the bell is not clearly the single highest point. The model can lengthen the barrel slightly or shorten the plume.
- **Clarion:** matches the design (ivory stock and barrel, gold rings, engraved gold bell about four times the barrel's width, a sight bead near the bell), straight, horizontal, no hands, flat colors. It has a flintlock lock plate and hammer, which the prompt excluded, but the design has the same lock, so the two agree; keep it, since it helps the gun read as a gun. At 1022 × 430 it is small, though enough for proportions and colors. Regenerate at a higher resolution only if Claude needs more detail when modeling.
- **Aim:** matches. The same character and gun, barrel level, stock at the right shoulder, the left hand under the barrel, a wide stance, no smoke, flash or beam. It aims to the viewer's right rather than the left, and the view is closer to front than three-quarter. Neither matters, because the sprite directions are rendered from the model.

### Received sources — 2026-10-14

**A2, B5 and B8 received (19 sources), and the JFIF sources supplied on 2026-10-13 normalized (14: `shop-pedestal`, `item-plume` and all twelve B9 icons).** All 33 were converted to PNG under their target names at original resolution (2048 × 2048, except the chest pair at 2400 × 1792, the trumpet sheet at 3168 × 1344 and the pedestal at 1696 × 2528), with decoded pixels verified unchanged. The originals are preserved byte for byte, with SHA-256 hashes in `receipt.json`, under `tmp/asset-originals-2026-10-14/`. Generation tool, generation date and subscription plan are unconfirmed. This receipt does not approve the pilots (`relic-usher`, `icon-judas-coin`) or replace the in-game acceptance check.

**Preparation notes from source inspection:**

- **A2:** the trumpet sheet matches the prompt (grey background, bell to the right, small orderly eyes, a blank banner), though the bell has light shading rather than flat color. The raised pose keeps the existing Gatekeeper's design and key; the mouthpiece is held away from the helmet, as asked.
- **Reliquary chest:** the open and closed images line up (body, feet and keyhole plate in the same place), so the lid can swap without a jump. The roof panels read as pale blue glass rather than enamel. The open chest's inner light is a soft glow; check how it keys.
- **Key, bell and sundial** match their prompts and read at 32 px. The key's bit has cross-shaped teeth rather than three square ones.
- **`relic-link`:** the link is drawn bent into a twist, so at small size it can read as two links. Its white-gold burst has soft rays beyond the outline that keying will clip.
- **`relic-wheel`:** twelve spokes, not eight, and its speed streaks sit outside the outline as soft smoke. Keying will cut them; the wheel still reads.
- **`relic-tile`** has three chains, not two. **`relic-mercy`** has two crossed gold lines rather than one sundial shadow line; at 48 px it is still distinct from `item-seal` (a lump without a ribbon, not a round stamp). **`relic-armageddon`:** the gold ring has a soft glow outside the outline.
- **The relic set at 48 px:** the two Plea seals read as a pair (round and square), and no two relics are confusable. The comb has six teeth.
- **`icon-judas-coin`:** a darker inner square with a visible edge sits inside the charcoal background, like a frame. Crop to it or regenerate before approving the pilot.
- **`icon-silver-wire`:** the symbol fills well under 80% of the square and is faint at 48 px. **`icon-cloud-of-witnesses`:** the witnesses' faces are skull-like, and at 48 px the hooded figure is lost in the smoke.
- **The other B9 icons** match the existing icons' background and line weight. The Binder's three read as a pit, a ring and a staked fence at 48 px; the boundary chain is strung between its stakes rather than lying on the floor, which still reads as a fence.
- **`shop-pedestal`** (empty cushion) and **`item-plume`** (three feathers, gold band) match their prompts.

---

## How to use (Gemini)

The same routine as the original file, with three additions for this pack (marked **new**).

1. **Attach exactly the files listed under each prompt**, nothing more. They carry the style; prompts that say *"the attached …"* depend on them. Existing references are in `assets/art-src/reference/` and existing game art in `assets/art-src/`. **Start a new chat for each image**, so an earlier image doesn't bleed into the next one.
2. **New: pilot first, then the family.** Each family has one pilot, marked *pilot* in the checklist. Generate it, save it, and send it to Claude before the rest. Claude checks it in the game at real size; once it's approved, **attach the approved pilot** to every other prompt of that family (each prompt lists it). This is what keeps eight items or twelve relics looking like one set.
3. **Aspect ratio:** each prompt names one of Gemini's ratios at the end. If the image comes out in a different shape, reply *"Make it W:H"*.
4. **Resolution:** the largest your Gemini version offers. 1024 px is enough for everything except textures (2048 px if available).
5. **New: green objects get a magenta background.** Gemini can't make transparent images, so sprites sit on flat pure green (#00FF00), which Claude keys out. Three objects in this pack are themselves green (`heal-mote`, `item-balm`, `item-venom`); their prompts ask for flat pure magenta (#FF00FF) instead. Don't change the background of any other prompt.
6. **Check before saving.** Generate again (or ask Gemini to fix it) when you see:
   - a background that isn't flat green (or magenta where asked): a gradient, a floor, a shadow under the object, a checkerboard;
   - any text, letters, numbers, labels or watermarks;
   - part of the subject cut off by the edge;
   - a glow, haze or smoke outside the outline (the game drops every pixel less than 50% opaque, so a soft glow becomes a ragged blob; glow painted *inside* a shape is fine);
   - the specific points under the prompt's **Check** line.
7. **New: one fix at a time.** If one detail is wrong, reply with only that fix (*"Same image, but the handles are gold, not silver"*) rather than starting over. Start over only if two or more things are wrong.
8. **Integration is Claude's part:** keying out the background, cropping, resizing, making textures seamless, rendering the 3D models into sprites, compositing the item and relic icons onto their HUD backgrounds, and checking everything in the game at real size. Tell Claude the file name when you save it.

**Why the prompts insist on these things** (unchanged from the original file)
- **Flat pure green background:** green appears nowhere in Heaven's palette, so it keys out cleanly. Magenta for the three green objects, for the same reason.
- **Front view and a bold outline:** sprites face the camera and are often only 30–150 px tall on screen, so the silhouette has to read at a glance.
- **Light Heaven, dark Hell:** Heaven's objects are ivory, white and gold; Hell's (the players' things) are soot, charred iron, ember red and silver. The game tints enemy sprites for states, which works best on white and gold.
- **Effect textures on pure black:** the game draws them additively, so black becomes transparent and the game tints them per effect.

---

## The style sentences

Every prompt below already contains its style sentence in full, so you can paste each prompt as it is. They are listed here so you can see that they are the same word for word; never edit one prompt's style sentence alone.

| Name | Used by | Origin |
|---|---|---|
| **Object** | props, interaction objects, boss parts | the original B2 *Decorations* sentence |
| **Pickup** | small floating pickups (halo, mote, page, key, scroll) | the original B1 *World sprites* sentence |
| **Item / relic** | item and relic icons | new: the B1 sentence at icon size, isolated, so one image serves as the world pickup and the HUD/card icon |
| **Ability** | new ability icons, optional talent and combo icons | the original B3 *Ability icons* sentence, unchanged, so the new icons match the eight existing ones |
| **Texture / effect** | textures, effect textures | the original B4 and B5 sentences |
| **Model sheet** | Part A | the [Meshy guide](../look/meshy.md)'s flat-color sentence, as in the original *Pro character models* section |

---

## Telling things apart

New objects share Heaven's palette with everything already in the arenas, so each kind differs in **color family, silhouette and size at once**. The game's rules depend on players recognizing them in a crowd of a thousand ([game.md](game.md) §4.9, §4.10).

| Kind | Color family | Silhouette | Height in game | Rule it signals |
|---|---|---|---|---|
| **Loot** (amphorae) | ivory and white, thin gold | round-bellied pot, small handles | 1.0 m | "break me for a drop" |
| **Marked amphora** | ivory with **one big gold cross** | the same pot | 1.0 m | "break me for the map" |
| **Blast** (sanctuary lamp) | **saturated red glass, black iron band** | a cup on a tripod, a flame inside | 1.3 m | "I explode" |
| **Blessing** (chalice) | **all gold**, white marble stand | a cup on a slim stand | 1.2 m | "I heal" |
| **Dominion** | white and gold armor, dark bronze face | twice a Blessed's height, a mace head above the crowd | 3.4 m | the elite |
| **Lectern Cantor** | white silk and gold robes, a **dark bronze** book in front | a head taller than the Choristers, a crown of candles, a huge book held like a shield | 3.2 m | commander of the Choristers; bronze side = shielded front |
| **Stray-Carrier** | gold armor and mask, white wings, a **long white shroud** | 2.5 × a Cherub, a white tail of cloth hanging 2 m below it | 2 m body, 5 m wings, flies 4 m up | commander of the Cherubs |
| **Watchman** | a Blessed's ivory and white, a **gold helmet** with a sky-blue plume | a Blessed with a long gun upright on its shoulder, a **trumpet bell above the crowd** | 2.1 m (bell about 2.5 m) | the only enemy with a gun; its aim is a gold thread |
| **Heal mote** | **green** | a small almond-shaped drop | 0.3 m | heals the collector |
| **Halo** | gold | a thick ring | 0.4 m | money |
| **Hazard** (Refiner's Fire) | red-orange flame in a sunk channel with a gold rim | a line on the floor | floor | "hurts enemies more than you" |

Green is used only for healing and blue only for shields, everywhere in the game (M8). Violet means slowed, red-hot chains mean bound. The prompts below keep to these colors.

---

## Part A: model references

### A1 The Dominion

The new elite enemy ([rooms.md](rooms.md) §6): *"Its mace strikes everything around it, angels too."* It is the "bigger, slower, armored and stronger than the Blessed" enemy with the golden scepter-mace that the original file reserved from `concept-4.jfif`. Twice a Blessed's height (3.4 m drawn), broad, slow (3.5 m/s), wings folded down like a cloak (it doesn't fly), a flanged gold mace held upright so its head stands **above every crowd, about 4 m up**, a dark bronze face plate.

Four images, in this order. The design sets the look; the other three copy it for modeling. As for the Blessed, the model has **no wings and no weapon**: the wings and mace are separate references that Claude attaches in Blender, because rigging can't handle them on the body ([Meshy guide](../look/meshy.md) §2).

#### The Dominion's design — `dominion-design.png` · 2:3

Attach: `blessed-front.jpg`, `gatekeeper-front.png`, `concept-4.jfif`

```text
The Dominion, an elite enforcer of Heaven: a towering armored angel twice the height of the first attached character, very broad shoulders and a heavy, grounded stance, in white plate armor with polished gold trim and engraved gold filigree like the soldiers holding golden maces in the third attached image, a smooth dark bronze face plate with no features except two narrow pale-gold eye slits, two large white wings folded down behind it and hanging to the backs of the knees like a stiff cloak, an ivory tabard with sky-blue borders split at the front and sides and ending above the knees, so the armored legs are fully visible: white greaves, gold knee cops, heavy steel sabatons. It holds a long ornate gold mace upright in the right hand beside the body: a long dark-gold haft with a leather grip, and a large head of six blunt gold flanges that rises above the Dominion's own head. Calm, orderly and certain, not monstrous: no horns, no spikes, no skulls, no blood. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents and a dark bronze face plate. Full body, front view facing the viewer, centered, the whole figure, the folded wings and the whole mace inside the frame, the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 2:3.
```

**Check before saving:** clearly bigger and broader than the Blessed when you picture them side by side; the mace head above the helmet; wings folded down, not spread; legs visible below the tabard from the knee down; no horns or spikes; the face plate dark bronze. Generate again until you like the look: everything after this copies it.

#### The Dominion for modeling — `dominion-turnaround.png` · 16:9

Attach: `dominion-design.png` only. Start a new chat.

```text
Character model sheet for 3D modeling, copying the character in the attached image: three full-body views side by side, from left to right: front, right side profile, back. Copy the attached design exactly: same proportions, armor, face plate, tabard and colors in every view. Leave out the wings and the mace: no wings, no weapon, nothing held, nothing on the back except the armor's back plate. Pose in every view: a neutral A-pose: standing straight, feet apart at shoulder width and pointing forward, arms straight and angled down and away from the body at about 45 degrees, palms facing the thighs, so the arms, hands and legs are clearly separated from the body and from each other; both hands empty, the fingers loosely curled as if around a haft. All three views at the same scale, standing on one shared baseline, orthographic with no perspective, evenly spaced with a wide gap between them, nothing overlapping. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no hatching, no highlights, no rim light, no glow and no light direction at all; thin dark lines only where two colors or parts meet, no thick outer contour. Plain flat medium grey (#808080) background, no floor, no shadows, no text, no labels, no arrows, no extra views or characters. Aspect ratio 16:9.
```

**Check before saving:**
- three views of the same character (same armor, same tabard length, same trim);
- no wings, no mace, both hands empty, arms clearly away from the body, feet apart;
- the side view is a true profile and the back view really shows the back (a back plate, not a second front with a face plate);
- no shadows or shading: the white armor is the same color on the left and right of the body;
- the whole figure inside each view, feet included, with grey around it.

If one view is wrong, reply *"Fix only the <side/back> view: …"* rather than starting over.

#### The Dominion's wings — `dominion-wings.png` · 16:9

Attach: `dominion-design.png` only. Start a new chat.

```text
Model sheet for 3D modeling: the pair of folded wings of the character in the attached image, alone, without the body, in two views side by side: left, the pair seen from behind, folded down and hanging close together from the shoulder joints to knee height like a stiff cloak; right, one folded wing in exact side profile. Copy the attached design: large white feathers in clean overlapping rows, the long flight feathers at the bottom, a thin gold edge along the top of each wing. Orthographic with no perspective, both views at the same scale, the whole wings inside the frame. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no highlights, no glow; thin dark lines only where feathers or parts meet. Plain flat medium grey (#808080) background, no body, no text, no labels. Aspect ratio 16:9.
```

**Check before saving:** no body or armor in the image; both views the same wings; folded, not spread.

#### The Dominion's mace — `dominion-mace.png` · 16:9

Attach: `dominion-design.png` only. Start a new chat.

```text
Weapon model sheet for 3D modeling: the mace carried by the character in the attached image, alone, in exact side profile, horizontal, the head pointing right, the whole mace inside the frame with a margin around it. Copy the attached design: a long dark-gold haft with a leather-wrapped grip near its end and a round gold pommel, and a large symmetric head of six blunt gold flanges with ivory inlay bands. Orthographic with no perspective. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no highlights, no reflections, no glow; thin dark lines only where two parts meet. Plain flat medium grey (#808080) background, no hands, no text, no labels. Aspect ratio 16:9.
```

**Check before saving:** the whole mace, straight and horizontal, matching the design image; six flanges; no hands; no shine painted on the gold.

**After the four images,** Claude builds the model and renders its 8 directions and the frames the game needs (idle, walk, mace raised for the wind-up, strike, recovery, pain, death). The animation never decides when the slam lands; the game does.

### A2 The Gatekeeper's trumpet

At 50% HP the Gatekeeper lifts **the first trumpet** in threat, and it stays silent ([bosses.md](bosses.md) §3). The existing Gatekeeper holds a giant key, so Claude adds the trumpet to the Gatekeeper's model and renders a new "trumpet raised" pose. Two references: the trumpet alone, and the pose.

#### The trumpet — `gatekeeper-trumpet.png` · 21:9

Attach: `gatekeeper-front.png`, `gatekeeper-turnaround.png`

```text
Prop model sheet for 3D modeling: a long ceremonial herald's trumpet of the colossal angel in the attached images, alone, in exact side profile, horizontal, the bell pointing right, the whole trumpet inside the frame with a margin around it. A straight slender tube of white ivory banded with polished gold rings, a wide flared gold bell engraved with a ring of small watchful eyes like those in the angel's wings, a gold mouthpiece, a hanging white-and-gold tasseled banner below the tube with no writing or symbols on it. Orderly, immaculate Heaven workmanship. Orthographic with no perspective. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no highlights, no reflections, no glow; thin dark lines only where two parts meet. Plain flat medium grey (#808080) background, no hands, no text, no letters, no sound waves, no labels. Aspect ratio 21:9.
```

**Check before saving:** no letters on the banner; no sound-wave lines coming out of the bell; the eyes on the bell small and orderly, not fleshy.

#### The pose — `gatekeeper-trumpet-raised.png` · 1:1

Attach: `gatekeeper-front.png`, `gatekeeper-trumpet.png`. Start a new chat.

```text
The colossal angel in the first attached image, copied exactly (same armor, single eye, six wings, colors), in a new pose: the giant golden key is planted upright in the left hand, and the right arm raises the trumpet from the second attached image high and diagonally above the head, the bell pointing up and outward, as if about to sound it, but its mouthpiece held away from the face: it is not being blown. All six wings spread. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Full body, front view facing the viewer, centered, the whole figure, all wings and the whole trumpet inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no sound waves, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check before saving:** the trumpet is the attached one; it isn't at the mouth; the key is still there; the design matches the existing Gatekeeper.

### A3 The Lectern Cantor

The commander of the Choristers ([rooms.md](rooms.md) §6.2): *"It sings a turning beam at the farthest of you from behind its hymnal; hide or close in, and hit it from behind."* A towering Chorister, a head taller than the Choristers (3.2 m drawn), slow (2.5 m/s), with a crown of lit candles above the crowd and a huge hymnal bound in **dark bronze** held in front like a tower shield. The bronze cover is its armored front, the same language as the Dominion's face plate; its back is plain white silk with no armor, so players can tell front from back at a glance. When it sings, the hymnal opens toward its target and the glowing pages fire the beam.

Three images, in this order. The design sets the look; the other two copy it for modeling. As for the Dominion, the body model has **no hymnal**: the book is a separate reference that Claude attaches in Blender, because it opens and closes.

#### The Cantor's design — `cantor-design.png` · 2:3

Attach: `chorister-front.jpg`, `dominion-design.png`

```text
The Lectern Cantor, the choirmaster who leads Heaven's choir into battle: a towering singing angel a head taller than the first attached character and copied from it: the same brilliant white silk robes with broad gold bands, the same high stiff collar, the same calm face with the mouth open in song and the eyes closed, but older and sterner, and over the robes a heavy floor-length cope of white brocade embroidered with gold, fastened at the chest with a large gold clasp. On its head a tall crown of slender white candles in a gold ring, the small flames lit, standing above everything else. In both arms, held upright in front of the chest and belly like a tower shield, a huge closed hymnal almost as tall as its torso, bound in smooth dark bronze with heavy gold corner guards, gold clasps and a raised gold cross on the cover; the dark bronze matches the face plate of the armored angel in the second attached image. Calm, devout and certain, not monstrous: no horns, no spikes, no skulls, no blood. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents and a dark bronze book cover. Full body, front view facing the viewer, centered, the whole figure, the candle crown and the whole book inside the frame, the robe hem on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 2:3.
```

**Check before saving:** clearly a Chorister's family (same robes, collar, singing face) but bigger and heavier; the book closed, held in front, its cover dark bronze, not gold or brown leather; the candle crown is the highest point; no glowing orb (that belongs to the ordinary Choristers); the candle flames small and inside the outline. Generate again until you like the look: everything after this copies it.

#### The Cantor for modeling — `cantor-turnaround.png` · 16:9

Attach: `cantor-design.png` only. Start a new chat.

```text
Character model sheet for 3D modeling, copying the character in the attached image: three full-body views side by side, from left to right: front, right side profile, back. Copy the attached design exactly: same proportions, robes, cope, collar, candle crown, face and colors in every view. Leave out the book: nothing held, both hands empty. The back of the cope is plain white silk with a single long gold lacing running down the spine and no embroidery, armor or ornament, so the back looks clearly different from the front. Pose in every view: a neutral A-pose: standing straight, arms straight and angled down and away from the body at about 45 degrees inside their wide sleeves, palms facing the thighs, so the arms and hands are clearly separated from the body; the floor-length robe hem touching the ground. All three views at the same scale, standing on one shared baseline, orthographic with no perspective, evenly spaced with a wide gap between them, nothing overlapping. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no hatching, no highlights, no rim light, no glow and no light direction at all; thin dark lines only where two colors or parts meet, no thick outer contour. The candle flames painted as small flat yellow shapes. Plain flat medium grey (#808080) background, no floor, no shadows, no text, no labels, no arrows, no extra views or characters. Aspect ratio 16:9.
```

**Check before saving:**
- three views of the same character (same cope, same collar, same candle crown);
- no book, both hands empty, arms clearly away from the body;
- the back view really shows the back: plain white silk with one gold lacing, no face, no clasp, no embroidery;
- no shadows or shading: the white robes are the same color on the left and right of the body;
- the whole figure inside each view, candle crown included, with grey around it.

If one view is wrong, reply *"Fix only the <side/back> view: …"* rather than starting over.

#### The Cantor's hymnal — `cantor-hymnal.png` · 16:9

Attach: `cantor-design.png` only. Start a new chat.

```text
Prop model sheet for 3D modeling: the huge hymnal carried by the character in the attached image, alone, in three views side by side at the same scale, from left to right: closed, seen straight from the front cover; closed, seen in exact side profile from the spine; open flat, seen straight from above, both pages showing. Copy the attached design: a tall book bound in smooth dark bronze with heavy gold corner guards, gold clasps and a raised gold cross on the cover, a thick block of ivory pages. The open pages are covered in rows of gold musical notation drawn as simple abstract marks, with no readable letters, words or numbers. Orthographic with no perspective, the whole book inside each view with a margin around it. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no highlights, no reflections, no glow; thin dark lines only where two parts meet. Plain flat medium grey (#808080) background, no hands, no text, no labels. Aspect ratio 16:9.
```

**Check before saving:** the same book as in the design (dark bronze, gold corners, gold cross); the open view really open with both pages flat; no readable letters or numbers on the pages; no shine on the bronze or gold.

**After the three images,** Claude builds the model and renders its 8 directions (the front and back must read differently from every side) and the frames the game needs: idle, walk, hymnal opening (the wind-up), singing with the hymnal open (the beam), hymnal closing (the recovery), pain, death. The glowing pages, the ray and the beam are drawn by the game; the animation never decides when the beam starts or ends.

### A4 The Stray-Carrier

The commander of the Cherubs ([rooms.md](rooms.md) §6.3): *"It carries whoever strays from the party into the crowd."* A Cherub grown huge: about 2.5 × a Cherub (a 2 m body under a 5 m wingspan), flying 4 m up like the Cherubs, in the same polished gold armor and expressionless gold mask, but the mask's **eyes are carved closed** as if asleep, its arms are very long, and a long white burial shroud hangs from its shoulders and trails two meters below its feet like a tail. Between swoops it shoots with a Cherub's gold bow, held in its left hand; when it carries a player it wraps the shroud around them.

Four images, in this order. As for the Dominion and the Cherub, the body model has **no wings, no bow and no shroud**: those are separate references that Claude attaches in Blender. The bow reuses the existing Cherub's bow, scaled up, so it needs no new image.

#### The Carrier's design — `carrier-design.png` · 1:1

Attach: `cherub-front.jpg`, `cherub-turnaround.png`, `concept-2.webp`

```text
The Stray-Carrier, the angel who carries lost souls away: a huge flying cherub copied from the character in the first attached image and grown to the size of a tall man: the same polished gold armor with engraved gold filigree and pastel sky-blue bands, the same smooth expressionless gold mask, but the mask's eyes are carved closed, calm and asleep, with no eye holes. Its arms are unnaturally long, hanging down to its knees, with long gold-gauntleted fingers; its bare feet dangle. Enormous white feathered wings spread fully to the sides, much larger than the first attached character's. A long white burial shroud of plain heavy linen is fastened to both shoulders with gold clasps and hangs down behind and below it, trailing far below its feet in long soft folds like a tail, twice as long as its body. In its left hand, held lowered, a gold bow like the first attached character's, with no arrow. Serene and unsettling, like a lullaby, not monstrous: no horns, no spikes, no skulls, no blood, no teeth. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Full figure hovering, front view facing the viewer, centered, the whole figure, both wingtips, the bow and the whole trailing shroud inside the frame. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check before saving:** clearly a Cherub (same gold armor and mask) but grown huge, not a baby; the mask's eyes closed, not open holes; the arms visibly too long; the white shroud hanging well below the feet, readable as one long white shape; wings white and spread; no arrow. Generate again until you like the look: everything after this copies it.

#### The Carrier for modeling — `carrier-turnaround.png` · 16:9

Attach: `carrier-design.png`, `cherub-turnaround.png`. Start a new chat.

```text
Character model sheet for 3D modeling, copying the character in the first attached image: three full-body views side by side, from left to right: front, right side profile, back, laid out like the second attached image. Copy the attached design exactly: same proportions, very long arms, gold armor, closed-eyed gold mask and colors in every view. Leave out the wings, the bow and the shroud: no wings, no weapon, no cloth, nothing held, only the two gold shoulder clasps where the shroud fastens and a smooth armored back where the wings attach. Pose in every view: hovering, the bare feet relaxed and pointing down, the legs slightly apart; the long arms straight and angled down and away from the body at about 45 degrees, palms facing the thighs, so the arms, hands and legs are clearly separated from the body and from each other; both hands empty. All three views at the same scale, on one shared baseline, orthographic with no perspective, evenly spaced with a wide gap between them, nothing overlapping. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no hatching, no highlights, no rim light, no glow and no light direction at all; thin dark lines only where two colors or parts meet, no thick outer contour. Plain flat medium grey (#808080) background, no floor, no shadows, no text, no labels, no arrows, no extra views or characters. Aspect ratio 16:9.
```

**Check before saving:**
- three views of the same character (same armor, same closed-eyed mask, same long arms);
- no wings, no bow, no shroud, both hands empty, arms clearly away from the body;
- the back view shows an armored back, not a second face;
- no shadows or shading: the gold is the same color on the left and right of the body;
- the whole figure inside each view, with grey around it.

If one view is wrong, reply *"Fix only the <side/back> view: …"* rather than starting over.

#### The Carrier's wings — `carrier-wings.png` · 16:9

Attach: `carrier-design.png` only. Start a new chat.

```text
Model sheet for 3D modeling: the pair of wings of the character in the attached image, alone, without the body, in two views side by side: left, the pair seen from behind, spread fully to the sides from the shoulder joints; right, one spread wing in exact side profile. Copy the attached design: very large white feathers in clean overlapping rows, the long flight feathers at the tips and bottom, a thin gold edge along the top of each wing. Orthographic with no perspective, both views at the same scale, the whole wings inside the frame. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no highlights, no glow; thin dark lines only where feathers or parts meet. Plain flat medium grey (#808080) background, no body, no text, no labels. Aspect ratio 16:9.
```

**Check before saving:** no body or armor in the image; both views the same wings; spread, not folded.

#### The Carrier's shroud — `carrier-shroud.png` · 16:9

Attach: `carrier-design.png` only. Start a new chat.

```text
Cloth model sheet for 3D modeling: the long burial shroud worn by the character in the attached image, alone, without the body, in two views side by side at the same scale: left, hanging straight down from its two gold shoulder clasps, seen from behind; right, the same in exact side profile. Copy the attached design: plain heavy white linen in long soft vertical folds, a narrow pale-gold border along its edges, two gold clasps at the top, its length about three times its width, the bottom edge slightly ragged. Orthographic with no perspective, the whole shroud inside the frame. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no highlights, no glow; thin dark lines only where folds or parts meet. Plain flat medium grey (#808080) background, no body, no text, no labels. Aspect ratio 16:9.
```

**Check before saving:** no body; the same two clasps as the design; long and narrow, hanging straight; no stains, no writing, no face shapes in the folds.

**After the four images,** Claude builds the model and renders its 8 directions and the frames the game needs: fly, shoot, shriek (the mark), swoop, carrying (long arms down, the shroud wrapped forward around where the player hangs; the game draws the carried player), pain, death. The lane, the marker over the stray and the drop ring are drawn by the game; the animation never decides when the grab happens.

### A5 The Watchman

The R04 follow-up's armed Blessed ([rooms.md](rooms.md) §6.4, [brief](r04-watchman.md)): *"It aims a gold thread at the nearest of you, then fires. Break its line of sight or kill it."* A Blessed soul set on Heaven's walls to watch for the damned: the same ivory robes, white armor, blank white eyes and gold halo as the Blessed, plus a **gold helmet** with a narrow brim and a short sky-blue plume, and **the Clarion**, a long gun with an ivory stock and a long barrel banded with gold rings like the Gatekeeper's trumpet, ending in a flared gold trumpet bell. It is barely taller than a Blessed (about 2.1 m drawn), but when it walks the Clarion stands upright on its shoulder, so the bell shows above the crowd (about 2.5 m). It is the only enemy with a gun.

Three images, in this order. The design (the pilot) sets the look; the other two copy it. Claude builds the body from the existing Blessed model and adds the helmet, plume and Clarion, so no turnaround is needed. The Clarion is a separate reference because Claude models it as its own prop.

#### The Watchman's design — `watchman-design.png` · 2:3 · pilot

Attach: `blessed-front.jpg`, `gatekeeper-trumpet.png`

```text
The Watchman, a soldier of Heaven set on its walls to watch for the damned: a figure copied from the character in the first attached image, the same build and height, the same pale stern face with blank white eyes and a short white beard, the same gold halo ring behind the head, the same ivory robes with pastel sky-blue borders, white plate armor and gold trim, but with no sword. On its head a polished gold helmet with a narrow flat brim and a short upright sky-blue plume, the face fully visible under it. In its right hand it carries a long gun upright against its right shoulder, the barrel pointing straight up, the stock resting in its hand at hip height: the gun has a carved ivory stock with gold fittings and a long slender barrel of white ivory banded with polished gold rings like the trumpet in the second attached image, ending in a flared gold trumpet bell that stands above the helmet. The left hand is empty and relaxed. A calm, watchful, orderly sentry, not monstrous: no horns, no spikes, no skulls, no blood, no smoke, no flame. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Full body, front view facing the viewer, centered, the whole figure and the whole gun inside the frame, the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 2:3.
```

**Check before saving:** clearly a Blessed (same face, robes, halo) with a helmet and a gun, not a new kind of angel; no sword; the trumpet bell is the highest point, above the helmet; the gun is held upright, not aimed; no wings; no smoke or muzzle flash. Generate again until you like the look: everything after this copies it.

#### The Clarion — `watchman-clarion.png` · 21:9

Attach: `watchman-design.png`, `gatekeeper-trumpet.png`. Start a new chat.

```text
Weapon model sheet for 3D modeling: the long gun carried by the character in the first attached image, alone, in exact side profile, horizontal, the trumpet bell pointing right, the whole gun inside the frame with a margin around it. Copy the attached design: a carved ivory stock with gold fittings and a gold trigger guard, a long slender barrel of white ivory banded with polished gold rings like the trumpet in the second attached image, ending in a flared gold trumpet bell about three times the barrel's width. A simple gold sight bead on top near the bell. Orderly, immaculate Heaven workmanship, no flintlock mechanism, no engraved eyes, no banner. Orthographic with no perspective. Colors as a flat color reference for texturing: every surface in its own true color, evenly lit, with no cast shadows, no shading, no highlights, no reflections, no glow; thin dark lines only where two parts meet. Plain flat medium grey (#808080) background, no hands, no text, no letters, no smoke, no labels. Aspect ratio 21:9.
```

**Check before saving:** the same gun as in the design (ivory and gold rings, trumpet bell); straight and horizontal; no hands; no smoke or flash; no shine painted on the gold.

#### The aim — `watchman-aim.png` · 1:1

Attach: `watchman-design.png`, `watchman-clarion.png`. Start a new chat.

```text
The character in the first attached image, copied exactly (same face, helmet, plume, halo, robes, armor and colors), in a new pose, seen in three-quarter view from its left front: it aims the gun from the second attached image at something far to the viewer's left, the stock against its right shoulder, its cheek beside the stock, its left hand under the barrel, the barrel level and the trumpet bell pointing straight ahead, the feet planted apart in a steady stance. It has not fired: no smoke, no flash, no beam. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Full body, centered, the whole figure and the whole gun inside the frame, the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check before saving:** the same character and gun; the barrel level, not raised; both hands on the gun; no smoke, flash or beam; the bell inside the frame.

**After the three images,** Claude builds the model from the Blessed's and renders its 8 directions and the frames the game needs: idle and walk (the Clarion upright on the shoulder), aim (leveled), fire (a short recoil), reload (lowered), pain, death. The gold thread, the muzzle flash, the tracer and the spark on cover are drawn by the game; the animation never decides when the shot fires.

---

## Part B: game assets

Save in `assets/art-src/`.

### B1 Breakable props

Billboards like the existing decorations, so they always face the camera: front views with the base on the bottom edge. Heights are their size in the game. Their families and colors are fixed rules ([game.md](game.md) §4.9): loot is ivory, blast is saturated red with a black stripe, blessing is gold. Each breaks into ivory shards, glass or gold dust that Claude cuts from the same image, so no separate shard images are needed.

**Pilot:** `amphora-tall.png`. After Claude approves it, attach it to the other five.

#### Tall amphora (1.0 m) — `amphora-tall.png` · 3:4

The common breakable vase (playtest 5 asked for vases to break). Attach: `concept-1.webp`, `decor-lily-urn.png` (from `assets/art-src/`)

```text
A tall slender ivory porcelain amphora with a narrow neck, a thin polished gold rim, two small curled gold handles at the shoulders and a thin gold band around the foot, smooth glazed surface with a faint pale grey-blue sheen, no painted figures or writing. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 3:4.
```

**Check:** reads as pottery you'd want to smash, not a trophy; plainer than the lily urn decoration, so the breakable and the decoration look different.

#### Squat amphora (1.0 m) — `amphora-squat.png` · 1:1

Attach: `concept-1.webp`, `amphora-tall.png` (approved)

```text
A squat, wide-bellied ivory porcelain amphora from the same set as the attached amphora: the same glaze, the same thin polished gold rim, the same two small curled gold handles and gold foot band, but low and round, about as wide as it is tall, with a short neck. No painted figures or writing. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** clearly the same set as the tall one, clearly a different silhouette.

#### Lily amphora (1.0 m) — `amphora-lily.png` · 3:4

Attach: `concept-1.webp`, `amphora-tall.png` (approved)

```text
An ivory porcelain amphora from the same set as the attached amphora, the same height, glaze, thin gold rim, small curled gold handles and gold foot band, with one bold raised relief of a single white lily on its belly, the relief's edges picked out in thin gold. No other decoration, no writing. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 3:4.
```

**Check:** the lily is a relief on the pot, not real flowers sticking out (that would look like the lily urn decoration).

#### Marked amphora (1.0 m) — `amphora-marked.png` · 3:4

Breaking it drops the floor's map ([game.md](game.md) §5.4). The game adds a slow glint running over the cross every 3 s. Attach: `concept-1.webp`, `amphora-tall.png` (approved)

```text
The attached ivory porcelain amphora, the same shape, size, handles and gold rim, with one large inlaid polished gold cross on its belly, the cross filling most of the belly's width and height, its gold clearly brighter than the rim. No other decoration, no writing. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 3:4.
```

**Check:** the cross is visible from across a room (picture it 60 px tall); otherwise identical to the tall amphora.

#### Sanctuary lamp (1.3 m) — `sanctuary-lamp.png` · 3:4

The blast prop: it explodes for 60 damage to enemies around it. Attach: `concept-1.webp`, `amphora-tall.png` (approved)

```text
A sanctuary lamp standing on the floor: a deep cup of saturated blood-red glass held in a broad band of black iron, standing on a short three-legged gold tripod, a small bright orange flame burning inside the red glass and visible through it. The red glass and the black iron band are the dominant colors, the gold only on the tripod. A heavy, dangerous-looking object, no skulls or symbols. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: saturated red glass and black iron with a little polished gold. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 3:4.
```

**Check:** the most saturated red thing in the arena; the black band reads as a stripe; the flame is inside the glass, not above it.

#### Blessing chalice (1.2 m) — `blessing-chalice.png` · 2:3

The blessing prop: hitting it heals every player within 6 m once. Attach: `concept-1.webp`, `amphora-tall.png` (approved)

```text
A tall gold chalice standing on a slim white marble pedestal: a wide polished gold cup with an engraved band, a gold stem with a knot, set on a round fluted marble column a little taller than the cup, a soft warm gold light glowing inside the cup, painted as solid hard-edged bands of pale gold inside the rim. All gold except the marble stand. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: polished gold and white marble with pastel sky-blue accents. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 2:3.
```

**Check:** gold, not red (the Heretic's chalice icon is red wine; this one must not look like Hell's); no liquid spilling.

### B2 Pickups

Small floating pickups, often 15–40 px on screen, so they must be simple. Attach to each: `blessed-front.jpg`, `concept-1.webp`, and for the last two the approved `gold-halo.png`.

#### Gold halo — `gold-halo.png` · 1:1

Halos are the shop currency. The game draws the ordinary coin (3 halos) as this image smaller and paler, and the gold halo (6) at full size and brightness, so one image serves both.

```text
A single angel's halo as a solid object: a thick polished gold ring seen at a slight angle so it reads as an ellipse, a bright white-gold highlight along its upper edge, a few small engraved notches around it, the center of the ring empty and showing the background. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 24 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no soft glow or haze outside the outline, no text. Aspect ratio 1:1.
```

**Check:** the middle of the ring is green (empty); no face or portrait on it; different from the tarnished silver `coin.png` of Field of Blood.

#### Heal mote — `heal-mote.png` · 1:1

Drops from ranged enemies, elites and vases; heals 8% to the player who collects it. **Magenta background**, because the mote is green.

```text
A single small healing mote: a bright green almond-shaped drop of light with a white-hot center, its glow painted as solid hard-edged bands of lighter green inside the outline, two small four-pointed green sparkles beside it. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 16 pixels. Centered, filling most of the frame. Isolated on a flat pure magenta (#FF00FF) background: no soft glow or haze outside the outline, no text. Aspect ratio 1:1.
```

**Check:** green, not blue (blue is shields); the background magenta.

#### Rite page — `rite-page.png` · 3:4

A Rite (a talent for this run only) lies on the reward spot as a page; the door plates show it as "a burning page". Attach also `relic-usher.png` if relics are already done, so the page doesn't look like a relic.

```text
A single loose page of old ivory parchment standing upright, its edges charred and smoldering with a thin line of glowing ember orange, a bold abstract ember-red sigil of three short strokes in a circle painted in its middle, a red-black ribbon hanging from its top corner. No writing, no letters. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 32 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no soft glow, no smoke, no text. Aspect ratio 3:4.
```

**Check:** reads as "burning page" at 32 px; no readable writing.

### B3 The Pardoner's stall

The merchant room ([game.md](game.md) §6.6, [rooms.md](rooms.md) §4): four item pedestals, a map pedestal, and the Pardoner behind his indulgence box on a 1.5 m plinth in the middle. Attach to each: `concept-1.webp`, `blessed-front.jpg`; to `npc-pardoner.png` also `heretic-front.png`.

**New character** ([lore.md](../lore.md)): *The Pardoner. A seller of indulgences who was refused at the Gates.* He is one of the damned like the players, so he is drawn in faded Hell-side colors, and he stays where he is (a single front image like a statue, no animation needed). If you'd rather have no shopkeeper, skip `npc-pardoner.png`: the box alone works.

#### The Pardoner (1.9 m) — `npc-pardoner.png` · 9:16

```text
The Pardoner, a seller of indulgences who was refused at the Gates of Heaven: a thin, stooped old man in a long faded crimson clerical robe with a tattered gold-embroidered stole, a soft tall cap, a satchel at his hip stuffed with rolled scrolls sealed in red wax, a string of small tin reliquaries hanging from his belt, ink-stained fingers spread over a small open tray of wax seals, a thin knowing smile. Shabby and sly, a soul of the damned, not an angel and not a demon: no halo, no wings, no horns. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, light ink hatching in the deepest shadows, warm golden key light from the upper left, crisp clean edges. Palette: faded crimson, soot black and tarnished gold, with a little ivory. Full body, front view facing the viewer, centered, the whole figure inside the frame with the feet on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 9:16.
```

**Check:** clearly not an angel (no halo, not white and gold) and clearly not one of the four heroes (no armor, no weapon); readable as a shopkeeper.

#### Indulgence box (1.5 m with its plinth) — `pardoner-box.png` · 1:1

The room's landmark: the Pardoner stands behind it.

```text
A large ornate indulgence box standing on a low square marble plinth: an ivory and gold chest-like box with a dark narrow coin slot in its slanted lid, red velvet panels on its sides framed in gold, small gold feet, a hanging gold padlock, symmetric elegant trim. No text, no price, no symbols. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with deep red velvet. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** no letters on it; it can't be mistaken for the Reliquary chest (no keyhole, a slot instead).

#### Shop pedestal (1.0 m) — `shop-pedestal.png` · 2:3

The game puts the item's pickup sprite floating above its empty top.

```text
A short white marble display pedestal: a square fluted column with a gold band at its top and bottom, a flat top covered with a small red velvet cushion with gold tassels at its corners, the cushion empty. No object on it, no text. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white marble, polished gold and deep red velvet. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 2:3.
```

**Check:** the cushion is empty.

#### The Chart (0.6 m, floating) — `chart-scroll.png` · 1:1

The map item: reveals the whole floor. It lies on the fifth pedestal and drops from the marked amphora.

```text
A partly unrolled ivory parchment scroll with gold end caps on both rods, the open part showing a simple diagram drawn in gold ink: small squares joined by short lines like a map of rooms, with one larger square, no words, no numbers, no real geography. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 32 pixels. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no soft glow, no text. Aspect ratio 1:1.
```

**Check:** the room diagram is visible at a glance; no letters.

### B4 The Confessional

The last room before the boss ([game.md](game.md) §9.6): a dark wood chapel where the Advocate, *Hell's counsel in the appeal of the damned*, speaks through a confessional grille. The darkest room of the heaven. Attach to each: `concept-1.webp`, `tex-wall.png` (from `assets/art-src/`)

#### Confessional grille (3 m wide, on the north wall) — `confessional-grille.png` · 3:2

The Advocate is never shown, only two ember eyes behind the lattice.

```text
A confessional grille panel set into a wall, seen straight on: a rectangular frame of dark carved wood with gothic tracery at its top, filled with a dense wrought black iron lattice, behind the lattice deep darkness and two small glowing ember-orange eyes, slightly narrowed, with a faint contained ember glow around them inside the frame. No face, no body, no text, no crosses, no signage. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, crisp clean edges. Palette: dark soot-brown wood, black iron and ember orange. Flat front view, orthographic, the whole panel filling the frame edge to edge. Aspect ratio 3:2.
```

**Check:** only two eyes visible behind the lattice; the panel fills the image (it's mounted on a wall, so no background to cut out).

#### Confessional wood wall — `tex-confessional-wood.png` · 1:1

The chapel's walls; repeats like `tex-wall.png`. Generate at 2048 px if available.

```text
Seamless tileable game texture, viewed straight on, orthographic, filling the whole square: dark carved wood panelling of a confessional chapel, four tall rectangular panels side by side, each with a raised frame and a simple gothic arch carved at its top, narrow vertical grain, soot-brown with a slight warm red undertone, worn smooth at the edges, thin gold leaf in the carved arches. Hand-painted stylized texture matching the stonework in the attached images: painterly brush texture, crisp dark ink-like lines along the carved edges. Even, flat lighting: no shadows, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```

**Check:** darker than everything else in the heaven; no crosses or symbols.

### B5 Rewards and challenges

Attach to each: `concept-1.webp`, `blessed-front.jpg`. For the open chest also the approved closed chest.

#### The key (0.6 m, floating) — `shared-key.png` · 1:1

St Peter's key: one per floor, opens the Reliquary chest. It hovers in a narrow gold beam on its room's reward spot.

```text
One large ornate gate key of polished gold with ivory inlay: a round bow shaped like a halo with a small cross inside, a long straight shaft, a bold bit with three broad square teeth. Tiny game sprite in a hand-inked graphic-novel style matching the attached images: bold black outline, flat cel shading, crisp hard edges, a simple shape readable at 32 pixels. Shown diagonally, bit at the lower right. Centered, filling most of the frame. Isolated on a flat pure green (#00FF00) background: no soft glow or haze outside the outline, no text. Aspect ratio 1:1.
```

**Check:** reads as a key at 32 px; clearly smaller and simpler than the Gatekeeper's giant key.

#### The Reliquary chest, closed (1.2 m) — `reliquary-chest.png` · 4:3

Descends in a white beam on the Reliquary's clear; the key holder opens it.

```text
A closed reliquary chest of white ivory and polished gold: a rectangular body on four small gold lion feet, a peaked roof-shaped lid like a small chapel with gold ridge ornaments, gold corner plates, panels of pale blue enamel on the sides, and one large clearly visible gold keyhole plate on the front with a dark keyhole. No writing, no figures. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 4:3.
```

**Check:** the keyhole is the first thing you notice.

#### The Reliquary chest, open — `reliquary-chest-open.png` · 4:3

Attach also `reliquary-chest.png` (approved). Claude lines the two up so the lid swaps without a jump.

```text
The exact chest from the attached image, the same view, size, proportions and position in the frame, now with its roof-shaped lid swung open and up behind it, the inside lined with pale blue velvet and filled with a soft white-gold light painted as solid hard-edged bands inside the chest's rim, nothing inside it. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with pastel sky-blue accents. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 4:3.
```

**Check:** the base, feet and keyhole plate exactly match the closed chest; the light stays inside the rim.

#### The Bell of Judgment (1.2 m) — `judgment-bell.png` · 1:1

Hangs 3 m above a cleared bell room's reward spot; ringing it with F starts a harder wave for a Rite ([game.md](game.md) §4.12). The game draws the long chain and the shaft of light above it.

```text
A large hanging church bell of deep gold bronze, seen from the front: a tall bell shape with a wide flared mouth whose lower rim is clearly visible, a band of engraved feathers around its shoulder, a heavy gold crown loop at the top for hanging, and the dark clapper visible inside the mouth. Nothing above the crown loop. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: deep gold bronze and polished gold. Front view, centered, the whole bell inside the frame. Isolated on a flat pure green (#00FF00) background: no floor, no chain, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** the lower rim and the clapper are visible (players aim at the rim to ring it); no chain painted.

#### The Sundial of Mercy (1.0 m, HUD icon and Confessional prop) — `sundial.png` · 1:1

Seal the boss room before 14:00 for an extra Rite ([game.md](game.md) §6.8). The HUD shows it under the minimap while it's lit; the Confessional has it as a prop.

```text
A round white marble sundial on a short fluted pedestal, seen from the front and slightly above so the dial face shows as an ellipse, a tall polished gold triangular gnomon in its middle casting one strong straight dark shadow across the dial, twelve small gold marks around the dial's edge, no numbers or letters. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white marble and polished gold. Front view, centered, the whole object inside the frame with its base on the bottom edge. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow outside the dial, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** reads as a sundial (gnomon and its shadow) at 32 px; no numbers.

### B6 Boss parts

In phase 2 the Gatekeeper's **Watchers** open in the air around the hall: eyes that see behind your pillar and that you shoot ([bosses.md](bosses.md) §3). The **Seal** holds a player Called to the Gate until the party breaks it. Both float; Watchers 6 m up. Attach to each: `gatekeeper-front.png`, `concept-1.webp`; to the second and fourth also the approved first of its pair.

#### Watcher, open (1.2 m across) — `watcher-open.png` · 1:1

The game adds the "vulnerable now" red rim, the grey "can't be damaged" tint and the opening animation.

```text
A single floating celestial eye construct: a large almond-shaped eye with a bright pale-gold iris and a black pupil, set between two ivory eyelid plates that are wide open, inside a symmetric geometric frame of polished gold with small white feathers fanning out from its sides, like the eyes in the attached angel's wings. Orderly and immaculate, not fleshy: no veins, no wet skin, no blood. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold with a pale-gold iris. Front view, centered, the whole object inside the frame. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** looks like it belongs to the Gatekeeper (same eye style as his wings); the pupil is the obvious target.

#### Watcher, closed — `watcher-closed.png` · 1:1

```text
The exact eye construct from the attached image, the same view, size, frame, feathers and position in the frame, with its two ivory eyelid plates firmly closed so no part of the eye or pupil shows. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold. Front view, centered, the whole object inside the frame. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** the outline matches the open one exactly (Claude swaps them in place).

#### Judgment Seal (1.0 m across) — `judgment-seal.png` · 1:1

Floats beside a player held at the Gate; breaking it frees them.

```text
A floating seal of judgment: a large round padlock of polished gold with a dark keyhole in its center, set inside a square ivory frame with gold corners, two short gold chains running from the sides of the frame out of the picture, the lock's body clearly heavy and breakable, with a fine crack already visible across it. No letters, no red wax. Art style: stylized 3D game art with a hand-inked graphic-novel finish, matching the attached reference images: bold black ink outlines (a thick outer contour, thinner inner lines), cel shading in 2–3 tones softened with painterly brush texture, warm golden key light from the upper left, crisp clean edges. Palette: white, ivory and polished gold. Front view, centered, the whole object inside the frame except the chain ends. Isolated on a flat pure green (#00FF00) background: no floor, no cast shadow, no scenery, no text, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** reads as "a lock to shoot"; different from the Reliquary's keyhole (round padlock, not a chest plate).

### B7 Item icons

The eight consumables ([items-relics.md](items-relics.md) §1). **One image per item serves three uses:** the pickup lying in the world, the shop pedestal, and the HUD inventory slot next to Q and E. Claude cuts it out for the world and composites it onto the HUD slot background for the icon, so it matches the ability icons beside it. Shown at about 48 px.

**Revision 2026-10-15: the shape tells you how to use it.** The first set didn't show whether an item is drunk, thrown or placed. In the new set every item **used on yourself is a test tube**, every **thrown item is a jar**, and the one **placed item stays a bowl on feet**. Only the contents and one mark tell items of the same family apart. Mirror Ward keeps its approved image. Save each new image under the same file name; the old ones stay in Git history.

| Family | Shape | Items |
|---|---|---|
| Use on yourself | a tall slender glass test tube with a round bottom, standing upright, cork stopper | Balm, Seal, Feather |
| Throw | a squat round thick-glass jar as wide as it is tall, ivory wax cap, a twine loop on the neck | Bitter Water, Ash, Chain Jar, Plume |
| Place | a silver bowl on three feet (unchanged) | Mirror Ward |

Attach to each: `concept-1.webp`, `blessed-front.jpg`, and after its family's pilot that pilot (approved). Don't attach the old item images; they bring back the old shapes.

**Pilots:** `item-balm.png` for the tubes, `item-venom.png` for the jars. Both are green on purpose: if those two read as different objects at 48 px, the shapes work. Generate both pilots first and send them to Claude.

| File | Item | Family | What it does | Background |
|---|---|---|---|---|
| `item-balm.png` | Balm of the Rejected | tube (*pilot*) | heals you 40% of max HP | **magenta** |
| `item-seal.png` | Wax Seal of Sanctuary | tube | a 100 shield on you | green |
| `item-feather.png` | Pilgrim's Feather | tube | +2 m/s for 12 s | green |
| `item-venom.png` | Bitter Water | jar (*pilot*) | thrown: a poison pool | **magenta** |
| `item-frost.png` | Ash of Stillness | jar | thrown: a slowing ash circle | green |
| `item-chain.png` | Chain Jar | jar | thrown: binds who crosses it | green |
| `item-plume.png` | Plume of Expulsion | jar | thrown: throws out who crosses it | green |
| `item-mirror.png` | Mirror Ward | bowl | placed: returns enemy projectiles | keep the approved image |

#### Balm of the Rejected — `item-balm.png` · 1:1 · tube pilot

```text
A tall slender glass test tube with a round bottom, standing upright, stoppered with a dark cork, filled almost to the top with glowing bright green balm painted as solid hard-edged bands of lighter green, a frayed red cord tied around the tube just below the cork. The tube is narrow and upright, clearly a tube to drink from, not a jar. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square from top to bottom, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure magenta (#FF00FF) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Wax Seal of Sanctuary — `item-seal.png` · 1:1 · tube

```text
A tall slender glass test tube with a round bottom, standing upright, filled with bright sky-blue liquid, its cork covered by a thick round cap of sky-blue sealing wax with a raised hexagon and a small cross pressed into it, the wax running a little way down the glass. The same tube shape as the attached pilot. Distinctly blue, no green. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square from top to bottom, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Pilgrim's Feather — `item-feather.png` · 1:1 · tube

```text
A tall slender glass test tube with a round bottom, standing upright, stoppered with a dark cork, filled with pale shimmering gold liquid, one short ivory feather with a gold quill pushed into the cork and standing straight up from it. The same tube shape as the attached pilot. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square from top to bottom, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Bitter Water — `item-venom.png` · 1:1 · jar pilot

```text
A squat round jar of thick glass, as wide as it is tall, heavy and made to be thrown and broken, its mouth sealed with an ivory wax cap, a short twine loop tied around its neck, filled with bubbling bright green water, a few hard-edged bubbles rising inside, one drop running down the outside of the glass. Clearly a round jar to throw, not a tube or a bottle. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure magenta (#FF00FF) background: no floor, no shadow, no text, no letters, no skull, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Ash of Stillness — `item-frost.png` · 1:1 · jar

```text
A squat round jar of thick glass, as wide as it is tall, its mouth sealed with an ivory wax cap, a short twine loop tied around its neck, filled with soft violet ash with a few pale frost-blue flecks in it, one thin wisp of violet ash curling out of a small crack in the wax cap and staying close above it. The same jar shape as the attached pilot. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Chain Jar — `item-chain.png` · 1:1 · jar

```text
A squat round jar of thick glass, as wide as it is tall, its mouth sealed with an ivory wax cap, a short twine loop tied around its neck, holding one coiled loop of red-hot iron chain that fills it, glowing yellow-orange at its core and ember-red at its edges, the chain links clearly visible through the glass. The same jar shape as the attached pilot. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Plume of Expulsion — `item-plume.png` · 1:1 · jar

```text
A squat round jar of thick glass, as wide as it is tall, a short twine loop tied around its neck, packed with ivory quill feathers, the tips of three long feathers pushing up through a split in its ivory wax cap and curling outward like a burst. The same jar shape as the attached pilot. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Mirror Ward — `item-mirror.png` · keep

The approved bowl on three feet with the returning arrow stays. It is the only placed item, and a bowl standing on the floor already says "put me down".

**Check the set:** Claude puts all eight side by side at 48 px. Each family must read from its outline alone: three upright tubes, four round jars, one bowl. Within a family, the contents' color and the one mark (red cord, blue wax, feather in the cork; green water, violet ash, glowing chain, feathers) must tell them apart. Regenerate any two that a player could confuse.

### B8 Relic icons

The twelve account-bound relics ([items-relics.md](items-relics.md) §2): shown in the Relics view grid, on the chest's offer cards and as two small icons on the HUD. They are relics **taken from Heaven**, so they are Heaven's objects (ivory, gold, marble, wax), damaged or broken. The interface draws the rarity border and the name; never paint them in. Claude composites each onto the relic card background.

Attach to each: `concept-1.webp`, `gatekeeper-front.png`, and after the pilot `relic-usher.png` (approved). For the two Plea seals attach each other once one exists, so they're clearly a pair but different.

**Pilot:** `relic-usher.png`.

#### Usher's Badge — `relic-usher.png` · 1:1

*Kill a taunted enemy: leave a slowing circle.* It marked the usher responsible for removing a rejected appeal.

```text
A heavy ceremonial usher's badge: a shield-shaped plate of dark crimson enamel framed in tarnished gold, a raised gold emblem of a closed door in its center, a broken gold chain hanging from its top, lying on a small heap of soft violet ash. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Broken Thurible — `relic-thurible.png` · 1:1

*Kill a censed enemy: send an ember to the next one.* It hung above the gate before the last petition was heard.

```text
A cracked gold church thurible (an incense censer on chains) hanging from one broken chain, a jagged crack down its pierced dome, one bright ember escaping from the crack, a thin curl of rusty-gold incense painted as a solid shape inside the outline. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** gold and cracked, so it isn't the Heretic's blackened-bronze censer.

#### Last Link — `relic-link.png` · 1:1

*Kill a bound enemy: launch survivors from the broken chain.* This link secured the final prisoner brought before the Gate.

```text
One single large chain link of red-hot iron, snapped open at one side, white-gold light shining out through the gap between its broken ends, small ivory feathers lifting away from the break. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Petitioner's Tile — `relic-tile.png` · 1:1

*Kill a pooled enemy: bind survivors around it.* Names were written on these tiles, then polished away.

```text
A worn square white marble floor tile seen at a slight angle, a thin gold inlay border, its middle polished smooth and blank where carved letters used to be, two short red-hot chains curling up out of its corners. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Seal of the First Plea — `relic-qseal.png` · 1:1

*A Q kill leaves a slow rune.* The first plea was stamped for consideration before it was denied.

```text
A round gold wax-style seal stamp, cracked through its middle, its face showing a single open ring, burning with a violet flame from inside the crack. Round silhouette. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** no letter Q anywhere.

#### Seal of the Last Plea — `relic-eseal.png` · 1:1

*An E kill launches survivors.* The last plea reached the same desk as the first.

```text
A square gold seal stamp with cut corners, matching the round seal in the attached image in material but clearly a different shape, cracked diagonally, its face showing two closing angular plates, two small ivory feathers bursting out of the crack. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

Attach also `relic-qseal.png` (approved). **Check:** no letter E; square where the First Plea is round.

#### Comb of the Host — `relic-comb.png` · 1:1

*An attack hitting 5+ lays a slowing comb across the crowd.* The Host used its teeth to keep the ranks in order.

```text
A wide ceremonial comb of ivory with a polished gold spine, exactly six long bold teeth pointing down, a strip of violet light running across the teeth. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** count the teeth: six.

#### Wheel of Review — `relic-wheel.png` · 1:1

*Kill a slowed enemy: roll a wheel at the next one.* Every rejected name passed beneath the turning wheel.

```text
A small ornate gold wheel standing upright, eight broad dark spokes, a thick rim engraved with a ring of tiny blank tablets, speed streaks behind it painted inside the outline as if it is rolling to the right. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Unbroken Quill — `relic-unbroken.png` · 1:1

*Collect a halo: launch enemies around you.* The verdict was written with this quill, which the condemned could not break.

```text
One strong ivory writing quill with a gold nib, standing diagonally, intact and unbent, laid across a snapped gold bar whose two broken halves lie beneath it. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Mercy's Wax — `relic-mercy.png` · 1:1

*Collect a heal mote: a small shield.* A petitioner left this wax beneath the Sundial while waiting for mercy.

```text
A soft lump of sky-blue petitioner's wax shaped by a thumb into a small curved shield, a short burnt-out candle wick sticking out of its top, a thin gold sundial shadow line pressed across it. Blue, never green. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check:** clearly different from the item Wax Seal of Sanctuary (a lump, not a stamped round seal).

#### Choral Fragment — `relic-armageddon.png` · 1:1

*Cross a streak tier: burst a choral ring.* A broken stave from the hymn appointed to announce the end of the world.

```text
A jagged broken fragment of a gold musical stave: five parallel gold lines on a cracked ivory plaque, two bold note heads on them, one thin gold ring rippling outward around the fragment. No letters or clefs that look like letters. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

#### Counterseal — `relic-sentence3.png` · 1:1

*Use an item: cast a bursting counterseal along your aim.* Hell pressed this seal against the Sentence entered by Heaven.

```text
A heavy black iron stamp with a gold handle and a gold-rimmed base, its stamping face turned toward the viewer showing a bold ivory geometric emblem of a broken circle crossed by one straight line, a few ember sparks around its edge. Hell's object among Heaven's: black and gold, formal, no skull, no horns. Game item icon in a hand-inked graphic-novel style matching the attached images: one object, centered, filling the middle 80% of the square, bold black ink outline (a thick outer contour, thinner inner lines), cel shading in 2–3 tones with painterly brush texture, high contrast, a simple shape readable at 48 pixels. Isolated on a flat pure green (#00FF00) background: no floor, no shadow, no text, no letters, no border or frame, no glow or haze outside the outline. Aspect ratio 1:1.
```

**Check the set:** Claude puts all twelve side by side; regenerate any two that read alike (the two seals, Mercy's Wax and the Wax Seal item).

### B9 New ability icons

The twelve alternative Q/E abilities that talents unlock, one per tree ([game.md](game.md) §9.4). They sit in the same Q/E slots as the existing eight icons, so they use **the existing ability icon prompt word for word**: the same dark charcoal background with an ember vignette, the same line weight. Shown at about 48 px.

Attach to each: `concept-1.webp`, the class's front (`fallen-front.png`, `heretic-front.png`, `binder-front.png` or `betrayer-front.png`), and the existing icon of the ability it replaces (listed), so the new one matches it but doesn't copy its symbol. After the pilot, also `icon-judas-coin.png` (approved).

**Pilot:** `icon-judas-coin.png`, because the Betrayer is the first class to get its trees (R4).

| File | Ability (slot, replaces) | What it does | Attach the existing |
|---|---|---|---|
| `icon-judas-coin.png` | Betrayer, Q, replaces Field of Blood | flick a coin; the first shot through it splits into three | `icon-field-of-blood.png` |
| `icon-way-back.png` | Betrayer, E, replaces Shadowstep | leave your shadow; press again to dash back to it, cutting | `icon-shadowstep.png` |
| `icon-silver-wire.png` | Betrayer, E, replaces Shadowstep | string a wire that binds who walks into it | `icon-shadowstep.png` |
| `icon-gatebreaker.png` | Fallen, E, replaces Falling Star | hold to charge, steering, bowling the crowd aside | `icon-falling-star.png` |
| `icon-rain-of-fire.png` | Fallen, E, replaces Falling Star | aim a circle; fire rains on it for 6 s | `icon-falling-star.png` |
| `icon-cast-out.png` | Fallen, Q, replaces Blasphemy | a wing blast hurls everything in front 6 m | `icon-blasphemy.png` |
| `icon-bread-of-angels.png` | Heretic Saint, E, replaces Martyr's Shroud | 6 s: kills near you drop heal motes | `icon-shroud.png` |
| `icon-trial-by-fire.png` | Heretic Saint, E, replaces Martyr's Shroud | 4 s: you leave a trail of fire | `icon-shroud.png` |
| `icon-cloud-of-witnesses.png` | Heretic Saint, Q, replaces Unholy Communion | cloak you or an ally in a moving incense cloud | `icon-communion.png` |
| `icon-well-of-giants.png` | Binder, E, replaces Discord | a pit that drags ground enemies in for 5 s | `icon-discord.png` |
| `icon-ring-of-giants.png` | Binder, Q, replaces Chains of Tartarus | chains drag everything within 7 m into a bound ring | `icon-chains.png` |
| `icon-boundary-chain.png` | Binder, Q, replaces Chains of Tartarus | a chain on the floor binds who steps on it | `icon-chains.png` |

The prompt, with `<SYMBOL>` from the list below (the existing B3 prompt, unchanged):

```text
<SYMBOL> Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

Ready to paste, one per icon:

#### Judas Coin — `icon-judas-coin.png`
```text
A single tarnished silver coin spinning edge-on in the air, one bright silver line striking it from the left and splitting at the coin into three bright silver lines fanning out to the right. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

#### The Way Back — `icon-way-back.png`
```text
A dark shadowy silhouette of a slim hooded figure standing still on the left, and a black-and-silver streak with a small silver dagger at its tip racing back toward that silhouette from the right, as if returning to it. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```
**Check:** different from Shadowstep's dashing figure: here the figure stands still and the streak comes back to it.

#### Silver Wire — `icon-silver-wire.png`
```text
A taut thin silver wire stretched low across the icon between two short posts, each post topped with a silver coin, and in the middle one red-hot chain loop snapping shut around the wire where something touched it. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

#### Gatebreaker — `icon-gatebreaker.png`
```text
A horned black iron helm lowered like a battering ram, wreathed in brimstone fire, smashing forward through broken gold gate bars, a burning furrow trailing behind it along the ground. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

#### Rain of Fire — `icon-rain-of-fire.png`
```text
A circle on a pale marble floor seen from above at an angle, red-orange flakes of fire falling into it from above like burning rain, the floor inside the circle burning with a brighter flaming rim at its edge. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```
**Check:** many small falling flakes, not one big meteor (that is Falling Star's icon).

#### Cast Out — `icon-cast-out.png`
```text
Two great black wings with glowing ember edges sweeping forward from the lower corners, a red shock cone rippling outward between them, three small pale angel figures flung away in arcs at the cone's far edge. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

#### Bread of Angels — `icon-bread-of-angels.png`
```text
A round charred loaf of bread broken in half, glowing ember cracks in its crust, six small bright green sparks orbiting it in a ring. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

#### Trial by Fire — `icon-trial-by-fire.png`
```text
A single footprint of glowing embers pressed into pale marble, a broad ribbon of red-orange flame trailing behind it in a curve from the lower left. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

#### Cloud of Witnesses — `icon-cloud-of-witnesses.png`
```text
A hooded silhouette wrapped head to toe in a thick swirling mantle of rusty-gold incense smoke, three faint pale faces of witnesses half-visible in the smoke around it. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```
**Check:** rusty gold, not green (not a heal) and not blue (not a shield).

#### The Well of the Giants — `icon-well-of-giants.png`
```text
A round black pit ringed with heavy iron, seen from above at an angle, red-hot chains spiraling inward across the floor into it, a few small pale figures sliding toward its mouth. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

#### Ring of the Giants — `icon-ring-of-giants.png`
```text
Red-hot chains bursting up from the floor in a closed circle and hauling small pale figures inward into a tight ring, an empty dark floor in the middle of the ring. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```

#### The Boundary Chain — `icon-boundary-chain.png`
```text
One straight red-hot chain lying across the floor from left to right, an iron stake driven into stone at each end, sparks flying from the middle where it rattles. Square game ability icon in a hand-inked graphic-novel style matching the attached images: one bold central symbol filling the middle 80% of the square, thick black ink outlines, cel shading with painterly brush texture, high contrast, readable at 48 pixels. The background fills the whole square edge to edge: dark charcoal with a subtle ember-orange vignette. No text, no letters, no border or frame. Aspect ratio 1:1.
```
**Check the Binder's three:** the existing `icon-chains.png` is a chain lashing forward with a hook; these must read as a circle (Ring), a straight fence (Boundary) and a pit (Well).

### B10 Hazard and effect textures

#### Refiner's Fire channel — `tex-refiner-channel.png` · 1:1

The floor of the hazard channels, sunk 0.5 m with a gold rim (the rim is the existing riser texture). When the room seals, the game scrolls flames over it; in cleared rooms it shows as dull embers. Attach: `concept-1.webp`, `tex-floor.png`. Generate at 2048 px if available.

```text
Seamless tileable game texture, viewed straight down, orthographic, filling the whole square: a bed of glowing coals in a furnace channel, irregular dark charcoal lumps with bright orange-red cracks and glowing yellow-orange gaps between them, a few gold-flecked embers, evenly spread over the whole square with no pattern repeating at a glance. Hand-painted stylized texture matching the attached images: painterly brush texture, crisp dark ink-like lines around the coal lumps. Even, flat lighting: no shadows, no flames, no smoke, no vignette, no perspective. The left edge continues the right edge and the top continues the bottom. No text. Aspect ratio 1:1.
```

**Check:** no flame shapes (the game adds them); tiles without a visible grid when Claude repeats it 4×4.

#### Flames — `fx-flames.png` · 1:1

A strip of flame the game scrolls along the hazard channels and reuses for every fire effect (Rain of Fire, Trial by Fire, burning floor, fire talents). Drawn additively and tinted by the game. No attachments.

```text
A row of tongues of fire crossing the whole width of the frame from the left edge to the right edge, their bases along the bottom edge of the frame and their tips licking up to about two thirds of the frame height, bright white-hot at the base fading through light grey to black at the tips, painterly brush texture, the left edge continuing the right edge seamlessly. Greyscale only, no color. On a pure black (#000000) background. No text. Aspect ratio 1:1.
```

**Check:** greyscale (the game tints it red-orange); the left and right edges match.

---

## B11 Optional: combo emblems and talent icons

Neither is needed for the slice: until they exist, combo cards show their two relic icons and the combo's name, and talent cards show the tree's glyph with the node's name. Make them only after the required images are in. Same ability-icon prompt as B9.

### Combo emblems

Six named relic pairs ([items-relics.md](items-relics.md) §3). Save as `combo-<id>.png`. Attach: `concept-1.webp` and the two relic icons of the pair. Use the B9 prompt with `<SYMBOL>` below, but replace *"dark charcoal with a subtle ember-orange vignette"* with *"dark charcoal with a subtle gold vignette"*, so combos read as relic things, not abilities.

| File | Combo (relics) | `<SYMBOL>` |
|---|---|---|
| `combo-expulsion.png` | Order of Expulsion (Usher's Badge + Unbroken Quill) | An ivory quill flying from a dark crimson usher's badge toward a small trembling red figure, drawing a feather circle around it. |
| `combo-abandoned.png` | Abandoned Mercy (Broken Thurible + Mercy's Wax) | A lump of sky-blue wax melting into a single rusty-gold ember that bursts out of a cracked gold censer. |
| `combo-chorus.png` | Broken Chorus (Last Link + Choral Fragment) | A broken gold musical stave cracking open beneath a small figure flung up into the air, a snapped red-hot chain link below. |
| `combo-appeal.png` | Appeal in the Marble (Petitioner's Tile + Counterseal) | A black iron stamp with a gold base pressing down onto a pale marble tile set in a shallow glowing pool. |
| `combo-reversal.png` | Reversal of Judgment (First Plea + Last Plea) | A square gold seal and a round gold seal, a gold arrow arcing from the square one back to the round one, which burns violet. |
| `combo-harrow.png` | Harrow of the Host (Comb + Wheel) | A broad gold wheel rolling between the six ivory teeth of a comb laid across a violet lane. |

### Talent icons

The 72 talent nodes that aren't abilities (passives, augments, capstones), from the four class catalogs. Save as `talent-<class>-<tree>-<node>.png` (for example `talent-fallen-a-1a.png` for `fallen.a.1a`). Attach: `concept-1.webp` and the class's front. Use the B9 prompt with the `<SYMBOL>` below. **Generate one pilot per class first** (the first row of each class) and attach it to the rest of that class.

**The Fallen** (ember red, brimstone orange, charred iron)

| File | Node | `<SYMBOL>` |
|---|---|---|
| `talent-fallen-a-1a.png` | Red Iron | A red-hot spark leaping from a black iron gauntlet to a pale fist that strikes it. |
| `talent-fallen-a-1b.png` | Weight of Sin | A trembling red crowd of small pale figures tinted violet, dragging their feet toward a horned silhouette. |
| `talent-fallen-a-2a.png` | Through the Ranks | One glowing pellet streak passing straight through a first pale figure into a second behind it. |
| `talent-fallen-a-2b.png` | Unbowed | Broad armored shoulders pushing through a crowd that parts on both sides in puffs of brimstone. |
| `talent-fallen-a-3b.png` | Underfoot | A heavy black iron boot stamping down, a brimstone flare bursting under it. |
| `talent-fallen-a-cap.png` | Wrath of Dis | A ring of red-iron shockwave bursting outward from a burning horned silhouette's feet. |
| `talent-fallen-b-1a.png` | Brimstone Tread | A trail of burning footprints. |
| `talent-fallen-b-1b.png` | Fire and Brimstone | A flame springing up from a spot of white feathers and gold sparks on the floor. |
| `talent-fallen-b-2a.png` | Brand | A gout of fire bursting from a slug's impact and spreading into a burning patch. |
| `talent-fallen-b-2b.png` | Pyre | Flames clinging to a pale running figure, trailing behind it. |
| `talent-fallen-b-3b.png` | Blasphemer's Ring | An inverted cross with a ring of fire bursting outward from its foot. |
| `talent-fallen-b-cap.png` | The Burning Plain | Fire racing outward across a floor in branching lines from a fallen pale body. |
| `talent-fallen-c-1a.png` | Heave | Pale figures flipping up and away in high arcs from a burning landing crater. |
| `talent-fallen-c-1b.png` | Son of the Morning | A morning star of white-gold light with a much larger ring around it. |
| `talent-fallen-c-2a.png` | As We Fell | A pale figure hitting the floor and bursting into white feathers on impact. |
| `talent-fallen-c-2b.png` | Wormwood | A star-white flash at a crater, a ring of small figures flung up around it. |
| `talent-fallen-c-3b.png` | Broken Wings | Red-hot chains snapping shut around a pale figure as it hits the floor. |
| `talent-fallen-c-cap.png` | A Third of the Stars | Several white-gold streaks falling like shooting stars, each into a small crater. |

**The Heretic Saint** (soot, rusty-gold incense, green healing, blue shields, red-orange fire)

| File | Node | `<SYMBOL>` |
|---|---|---|
| `talent-heretic-a-1a.png` | Cunning Folk | Small green motes streaming in a curve toward one wounded figure. |
| `talent-heretic-a-1b.png` | Exorcism | A green ring flashing white at its edge, small pale figures flying outward in arcs. |
| `talent-heretic-a-2a.png` | In Both Kinds | A green beam running to one figure and branching on to a second. |
| `talent-heretic-a-2b.png` | Lazarus | A soul rising out of the floor in a burst of white-gold light. |
| `talent-heretic-a-3b.png` | The Long Chain | A censer on a long chain arcing high over a crowd's heads. |
| `talent-heretic-a-cap.png` | Resurrection of the Body | Several souls rising in white light, pale green threads drawing motes toward them. |
| `talent-heretic-b-1a.png` | Ploughshares | A rusty censer split open, a narrow furrow of fire running out of it in a straight line. |
| `talent-heretic-b-1b.png` | Kindling | A single ember lighting a marble tile beside white feathers. |
| `talent-heretic-b-2a.png` | Pitch | Embers clinging to a pale figure walking out of a dark pool. |
| `talent-heretic-b-2b.png` | Wall of Fire | A green healing ring with a separate ring of red-orange fire around it. |
| `talent-heretic-b-3b.png` | Irons in the Fire | Red-hot irons snapping shut around a figure's feet. |
| `talent-heretic-b-cap.png` | The Sixth Circle | Flames racing outward in a wide circle over marble from a burst of gold sparks. |
| `talent-heretic-c-1a.png` | The Stake | A blue shield shattering into a ring of red-hot stakes and chains. |
| `talent-heretic-c-1b.png` | Walk in the Smoke | A striding hooded figure, a pale green swirl around its ankles, walking through rusty-gold smoke. |
| `talent-heretic-c-2a.png` | The Altar | A hooded figure inside a column of rusty-gold incense with a clear ring on the ground. |
| `talent-heretic-c-2b.png` | Scapegoat | Three separate plumes of rusty-gold incense standing side by side like a curtain. |
| `talent-heretic-c-3b.png` | The Common Cause | Violet chain motes dragging at a pale figure's feet inside rusty-gold smoke. |
| `talent-heretic-c-cap.png` | Pillar of Cloud | One tall pillar of rusty-gold cloud rising high, with a clear top and a ring on the floor. |

**The Binder** (charred iron, red-hot chains, violet slow, pale silence)

| File | Node | `<SYMBOL>` |
|---|---|---|
| `talent-binder-a-1a.png` | Cast Down | Red-hot chains falling from above onto a crosshair on the floor. |
| `talent-binder-a-1b.png` | The Chain Holds | A red-hot chain arcing from a burst of gold sparks to a next pale figure and closing around it. |
| `talent-binder-a-2a.png` | Where They Fall | A chain closing around a pale figure the moment it lands on the floor. |
| `talent-binder-a-2b.png` | Brought Low | A small winged gold figure crashing down into a pile, its wings bound with chains. |
| `talent-binder-a-3b.png` | Sunk in the Lake | Red-hot chains running down into a floor pool and staying lit. |
| `talent-binder-a-cap.png` | All of Tartarus | Chains lashing out in every direction from one center and dragging everything into one pile. |
| `talent-binder-b-1a.png` | Whirl | A chain spinning a full circle, a ring of sparks around it. |
| `talent-binder-b-1b.png` | Iron Stride | An iron-booted stride through a crowd tinted violet. |
| `talent-binder-b-2a.png` | Voice of the Pit | A shout of pale wind throwing small figures back and sliding winged ones away. |
| `talent-binder-b-2b.png` | Fettered Hands | A pale figure straining against red-hot chains, its arms pinned to its sides. |
| `talent-binder-b-3b.png` | The Long Flail | A very long chain flail, its tip cracking far away with a spark. |
| `talent-binder-b-cap.png` | The Chains Shatter | Red-hot chain fragments spraying outward from a burst of gold sparks. |
| `talent-binder-c-1a.png` | Barbed Rounds | A tracer punching through a first body and sparking on a second. |
| `talent-binder-c-1b.png` | Frost of Cocytus | Violet frost discs on the floor with drifting frost motes. |
| `talent-binder-c-2a.png` | The Procession | A second chain drawing a pale figure into a short bound file behind the first. |
| `talent-binder-c-2b.png` | The Whip | A chain cracking straight out along the floor in a long streak of sparks. |
| `talent-binder-c-3b.png` | Shattered Hymn | A gold orb and an arrow popping apart in front of a pale wind shout. |
| `talent-binder-c-cap.png` | The Wind of Cocytus | A swirl of pale frost wind tightening into red-hot chains. |

**The Betrayer** (cold silver, soot, ritual red)

| File | Node | `<SYMBOL>` |
|---|---|---|
| `talent-betrayer-a-1a.png` | Glancing Silver | A silver tracer bending off a wall with a silver spark. |
| `talent-betrayer-a-1b.png` | Judecca | A pale frost puff bursting from a body, violet frost on the figures around it. |
| `talent-betrayer-a-2a.png` | The Halt and the Lame | A silver tracer running on past a first body to a second. |
| `talent-betrayer-a-2b.png` | The Informer | A pale silver outline of a figure seen through a stone wall. |
| `talent-betrayer-a-3b.png` | Behind His Back | A silver line running deep through a crowd that faces away toward a horned silhouette. |
| `talent-betrayer-a-cap.png` | From Hand to Hand | Thin silver arcs leaping from a burst of gold sparks to three separate figures. |
| `talent-betrayer-b-1a.png` | Through the Throng | Black smoke curling at a slim figure's feet as it slips through a tight crowd. |
| `talent-betrayer-b-1b.png` | Recoil | A silver revolver's muzzle puff with a short dark streak shooting backward from it. |
| `talent-betrayer-b-2a.png` | The Long Knife | A very wide silver dagger streak. |
| `talent-betrayer-b-2b.png` | One of Them | A slim figure turning into a dark silhouette inside a pale crowd, one eye symbol above it. |
| `talent-betrayer-b-3b.png` | Scattered Sheep | A crowd of pale figures flying apart on both sides of a dark streak. |
| `talent-betrayer-b-cap.png` | A Thousand Years Among Them | A silver flicker at each of many cuts along a narrow lane of white feathers. |
| `talent-betrayer-c-1a.png` | The Nail | A silver nail with hot chains pinning a pale figure at the end of a line. |
| `talent-betrayer-c-1b.png` | Thrown Silver | Thirty small silver coins flying in an arc into a pool of blood-red light. |
| `talent-betrayer-c-2a.png` | Blood Money | Silver coins on a floor, a red-hot chain snapping up around a foot that steps on one. |
| `talent-betrayer-c-2b.png` | Broken Vessel | Clay-red shard rings cracking outward from a burst of gold sparks. |
| `talent-betrayer-c-3b.png` | Known Ground | A silver shimmer outlining a dangerous patch of floor beneath a slim figure. |
| `talent-betrayer-c-cap.png` | The Potter's Field | Red-hot chains rising from a blood-red pool onto the feet of figures crossing it. |

The twelve ability nodes (`<class>.<tree>.3a`) use their B9 icon; they need no talent icon.
