# Meshy guide

How to turn Gemini images into the 3D models Claude uses: characters (rendered into sprites, [V3](v3.md)), ornaments and decorations (merged into the architecture, [V2](v2.md) and [V5](v5.md)), and props (rendered into sprites, V5). Meshy only makes the **source models**: nothing Meshy outputs is shown in the game directly. Claude imports, cleans, lights and renders everything in Blender (`scripts/blender/`), so the style stays the game's inked cel look.

You don't need to understand 3D: follow the steps, check the listed things, save the files under the given names, and tell Claude.

Facts about Meshy below were checked against its docs on 2026-10-07 (Meshy 7.1). Its UI changes often; if a button has moved, the setting's name is usually still the same. Claude re-checks the docs when V2 starts.

---

## 1. The account

- **Plan: Pro** (about $20 a month) or higher. The free plan can't download Meshy 6/7 models, and multi-view, A-pose and Remesh are paid features.
- Each image-to-3D run costs about 30 credits. Expect 3–5 runs per character and 2–3 per ornament or prop before one is good. **Rigging, animation and Remesh are free.**
- **How much in total (estimate):** about 12 characters × 4 runs, 9 ornaments and decorations × 3, 6 props × 3, about 15 parts (wings, weapons) × 2: roughly 120 runs, about 3 600 credits. Look at your plan's monthly credits when you subscribe; spread the work over the months V2–V5 run, or take a bigger plan for one month. Cancel when the last model is accepted.
- **License: Private** (paid plans), so no attribution is needed. Record the plan and dates for the [asset manifest](../rogue/asset-manifest.md).

## 2. The images (Gemini, not Meshy)

Make every input image in Gemini with the prompts in [prompts.md](prompts.md), not with Meshy's text prompt. Retrying in Gemini costs nothing, you control the look exactly, and Meshy's text-to-3D only runs on the older Meshy 6.

For a character:
1. **The design image** (`<id>-design-v2.png`): the look, in the game's inked style. Iterate until you like it; everything after copies it.
2. **The model sheet** (`<id>-turnaround-v2.png`): front, side and back, flat colors, made from the design image.
3. **Claude cuts the sheet into three images** (`<id>-mv-front.png`, `-mv-side.png`, `-mv-back.png`) with the same scale and margins. Tell Claude when you save the sheet, and wait for the three files.
4. **Each separate part** (`<id>-<part>.png`: a weapon, wings): the part alone.

For an ornament or a prop: one sheet (`orn-<id>.png`, `prop-<id>.png`) with front, side and top views; Claude cuts it the same way.

What makes an image good for Meshy (the prompts already ask for all of it):

| Rule | Why |
|---|---|
| A-pose: arms 45° down and away from the body, feet apart | Rigging needs every limb clearly separate |
| Hands empty, loosely curled | Weapons are separate models; Claude attaches them to the hand |
| No light, no shadows, no shading: flat true colors | Meshy paints the image onto the model. A painted shadow stays on the model forever and gets shaded again by Claude's lighting |
| Thin inner lines, no thick outer contour | An outline at the image's edge ends up as a stripe on the model's side. Claude draws the outline when rendering |
| Medium grey background | Meshy removes it; grey is far from ivory and gold. Green would tint the edges |
| Orthographic, the whole figure in frame | Perspective distorts the proportions |
| No halo, wings or long chains on the body | Not part of the body plan the rigging understands. Claude adds them (halos in code, wings rigged in Blender) |
| Floor-length robes only for **path B** characters | Rigging gives legs bones, not the cloth between them; it stretches like rubber. Path B characters are rigged by Claude instead, who gives the robe its own bones |

## 3. Which path each model takes

| Path | Models | In Meshy |
|---|---|---|
| **A: character, Meshy rig** | Blessed (also used for the Watchman), Dominion, Fallen, Binder, Betrayer | generate (§4) → rig and animate (§6) → download |
| **B: character, Claude rigs** | Chorister, Lectern Cantor, Cherub, Stray-Carrier, Gatekeeper, Heretic Saint | generate (§4) with A-pose → download the model only |
| **Static** | ornaments O1–O7, props P1–P6, parts (weapons, wings, helmet, Clarion) | generate (§5) → download |

## 4. Generating a character

Open **Model → Image to 3D** (the first of the three tabs at the top).

| Setting | Choice | Why |
|---|---|---|
| High Detail / Smart Topology | **High Detail** | Smart Topology makes low-poly real-time meshes. We render offline and want the detail |
| Model | **Meshy 7.1 – Flagship** (or the newest flagship) | The best quality |
| Image | Turn **Multi-view on**, then upload `-mv-front`, `-mv-side`, `-mv-back` into its slots | Much better shape than one image, especially the back |
| Resolution | **Standard**. Only if details come out blurry, try **Ultra 2K** | A character is at most about 500 px tall in a sprite, so more won't show. Ultra 4K only takes one image, and its meshes are too heavy to rig |
| Split | **Off** | Meant for 3D printing. Rigging wants one mesh |
| Texture | **On** | Rigging only works on textured models |
| Pose | **On → A-Pose** | Straightens the pose for rigging even if the image is a little off |
| Image Enhancement | **Off** | The image is already clean, and enhancement may change the style. Try it On only if a result is bad |
| License | **Private** | |

Press **Generate** (about 2 minutes).

### Checking the result

Turn the model around in the preview. **Generate again** if:
- the hands are blobs or fused to the hips, or the legs are fused together;
- the back is a mirrored front (a face or chest emblem on the back);
- the face is melted or doubled (small in the game, but a broken face shows);
- painted shadows or light sit in the texture (one side of the body darker than the other);
- grey background is stuck to the edges.

Small texture smudges and slightly soft details are fine: at sprite size they disappear. When a run is good, stop: the next one isn't necessarily better.

### Remesh (only if needed)

Meshy's rigging refuses models with **more than 300 000 faces**. If a model is over that (the face count is in the model's details, or rigging refuses it), use **Remesh**: about **150 000 faces**, triangles, keep the texture. Standard resolution usually doesn't need this. Path B models never need it.

## 5. Generating a static model (ornaments, props, parts)

Same tab and settings as a character, except:
- **Multi-view on** with the three cut views if the sheet has them, **off** with the single image for a weapon or a part drawn in one view;
- **Pose: None**;
- no remesh, no rigging, no animation.

Check: the shape matches the sheet from every side; no grey stuck to the edges; carved detail present but not melted; a thin object (a sword, a harp's strings, a baluster) isn't bent or fused. If a thin object fails twice, stop: Claude models it in Blender from the sheet, which is quick for simple shapes.

## 6. Rigging and animation (path A only)

Open **Animate** (left bar) and choose the generated (or remeshed) model.

1. **Rigging** runs automatically. If it asks for a **height**, give the character's height in the game (table below); Claude scales it anyway. Check the preview: the skeleton's joints sit at the shoulders, elbows, wrists, hips, knees and ankles. If the rig failed or a joint is clearly misplaced, the pose in the image was probably the problem; generate the model again first.
2. **Animations:** pick from the library. Preview each on the model and watch the hands and the tabard: nothing should stretch or pass through the body badly. Prefer animations that stay **in place**; if one walks forward across the floor, that's fine too: Claude removes the movement. Claude retimes every clip to the game's frame counts, so length doesn't matter.

| Character | Height | Animations needed (file name: what to look for) |
|---|---|---|
| **Blessed** | 1.6 m | `idle`: standing, slight breathing · `walk`: a steady determined march, not a run · `attack`: a one-handed overhead or diagonal sword swing from the right hand · `pain`: a short flinch · `death`: collapsing to the ground |
| **Watchman** (on the Blessed's model) | 1.6 m | `idle-rifle`: standing holding a long gun upright · `walk-rifle` · `aim`: raising a rifle to the shoulder and firing · `reload`: a rifle reload · `pain` · `death` |
| **Dominion** | 3.4 m | `idle`: heavy, grounded · `walk`: slow, heavy steps · `attack`: a two-handed overhead slam into the ground · `pain` · `death`: falling forward to its knees, then down |
| **Fallen** | 1.8 m | `idle`: holding a rifle or shotgun in both hands, relaxed · `walk`: walking holding it |
| **Binder** | 1.8 m | `idle`: holding a heavy gun at the hip · `walk` with it |
| **Betrayer** | 1.8 m | `idle`: a pistol held down at the side · `walk` with it |

If the library has nothing close for one clip, download the others and tell Claude which is missing; Claude can animate it in Blender.

## 7. Download and hand-off

Download as **GLB** (it keeps the textures inside the file). If Meshy offers a texture size, choose the largest.

Save like this, one folder per model:

```
assets/art-src/models/blessed/
  model.glb      the generated model, before rigging (in case Claude needs to rig it again)
  rigged.glb     the rigged model without animation (path A)
  idle.glb  walk.glb  attack.glb  pain.glb  death.glb   (path A: one file per animation)
  sword.glb      a part, generated on its own
assets/art-src/models/chorister/
  model.glb      path B: the model only
assets/art-src/models/orn-capital/
  model.glb      an ornament
assets/art-src/models/prop-amphora-tall/
  model.glb      a prop
```

If an export puts several animations in one file, that's fine too: say which is which. Then tell Claude (the message is in [guide.md](guide.md)).

Claude's part:
1. Imports and scales the model, attaches parts to the right bones with the right grip, and rigs path B models in Blender.
2. Sets up the look: cel shading in 2–3 tones over Meshy's colors, ink outlines, the game's sunlight, so the model matches the levels and the other sprites.
3. Renders every direction and frame and packs the sprite atlas in the same format as today (characters, props), or bakes and merges the model into the architecture kit (ornaments, decorations).
4. Shows the result in the game next to the old one, at real size and in a crowd, before rendering the next.

## 8. If something goes wrong

| Problem | Try |
|---|---|
| Meshy invents a different back or side | Check the sheet: are the three views really the same character? Fix the bad view in Gemini (*"Fix only the back view: …"*) |
| Arms or legs fused | A wider A-pose in the image (arms further from the body, feet further apart) |
| Rigging fails | Over 300 000 faces (Remesh), or the body plan is unclear (cloth hiding the legs: the character may belong on path B; ask Claude) |
| The tabard stretches badly when walking | Tell Claude: it can re-weight the cloth in Blender. If it's hopeless, shorten the tabard in the design image |
| Too plastic or too detailed in Meshy's preview | Normal: Claude's shading and outlines turn it into the comic look. Judge it in the game, not in Meshy's preview |
| An ornament's carving is mush | Try Ultra 2K once; otherwise Claude models the main shape in Blender and keeps Meshy's texture |

**Not tested yet** (found out on the first run): whether Meshy's A-pose option works together with multi-view, how many faces a Standard model has, and which download options Meshy offers for animations. The Blessed pilot answers all three; Claude updates this guide afterwards.
