# Meshy guide

How to turn a character image into a professional 3D model that Claude renders into the game's sprites. Meshy only replaces the **source model**: the game stays a 2.5D billboard renderer, and Claude still renders 8 directions × every animation frame in Blender (`scripts/blender/`) and packs them into the same sprite atlases. A sprite costs the same to draw however detailed the model is, so this doesn't touch performance for 1 000+ enemies; only texture memory grows, which compressed textures (KTX2) will cover.

**The pilot is the Blessed.** If it looks right in the game next to today's Blessed, the other characters follow the same steps.

Facts about Meshy below were checked against its docs on 2026-10-07 (Meshy 7.1). Its UI changes often; if a button has moved, the setting's name is usually still the same.

---

## 1. The account

- **Plan: Pro** (about $20 a month; one month is enough for the pilot). The free plan can't download Meshy 6/7 models, and multi-view, A-pose and Remesh are paid features.
- Each image-to-3D run costs about 30 credits. Expect 3–5 runs per character before one is good. **Rigging, animation and Remesh are free.**
- **License: Private** (paid plans), so no attribution is needed.

## 2. The images (Gemini, not Meshy)

Make the images in Gemini with the prompts in [art-prompts.md](art-prompts.md#pro-character-models-meshy), not with Meshy's text prompt. Retrying in Gemini costs nothing, you control the look exactly, and Meshy's text-to-3D only runs on the older Meshy 6.

For each character:
1. **The design image** (`<id>-design.png`): the look, in the game's inked style. Iterate until you like it; everything after copies it.
2. **The turnaround** (`<id>-turnaround.png`): front, side and back, made from the design image.
3. **Claude cuts the turnaround into three images** (`<id>-mv-front.png`, `-mv-side.png`, `-mv-back.png`) with the same scale and margins. Ask for this when you save the turnaround.
4. **Each weapon** (`<id>-sword.png` etc.): the weapon alone, side view.

What makes an image good for Meshy (the prompts already ask for all of it):

| Rule | Why |
|---|---|
| A-pose: arms 45° down and away from the body, feet apart | Meshy's rigging needs every limb clearly separate |
| Hands empty, loosely curled | The weapon is a separate model; Claude attaches it to the hand |
| No light, no shadows, no shading: flat true colors | Meshy paints the image onto the model. A painted shadow stays on the model forever and gets shaded again by Claude's lighting |
| Thin inner lines, no thick outer contour | An outline painted at the image's edge ends up as a stripe on the model's side. Claude draws the outline when rendering |
| Medium grey background | Meshy removes it; grey is far from ivory and gold. Green would tint the edges |
| Orthographic, the whole figure in frame | Perspective distorts the proportions |
| No floor-length robes, no capes reaching the ground | Rigging gives the legs bones, not the cloth between them, so it stretches like rubber when walking |
| No halo, wings or long chains on the model | Not part of the body plan the rigging understands. Claude adds them (halos in code, wings rigged in Blender) |

## 3. Generating the character

Open **Model → Image to 3D** (the first of the three tabs at the top).

| Setting | Choice | Why |
|---|---|---|
| High Detail / Smart Topology | **High Detail** | Smart Topology makes low-poly real-time meshes (100–15 000 polygons). We render offline and want the detail |
| Model | **Meshy 7.1 – Flagship** | The best quality |
| Image | Turn **Multi-view on**, then upload the front, side and back images into its slots | Much better shape than one image, especially the back |
| Resolution | **Standard**. Only if details come out blurry, try **Ultra 2K** | A character is about 350 px tall in the sprite atlas, so more detail won't show. Ultra 4K only takes one image, and its meshes are far too heavy to rig |
| Split | **Off** | Cuts the model into separate parts, meant for 3D printing. Rigging wants one mesh |
| Texture | **On** | Rigging only works on textured models |
| Pose | **On → A-Pose** | Straightens the pose for rigging even if the image is a little off |
| Image Enhancement | **Off** | The image is already clean, and enhancement may change the style. Try it On only if a result is bad |
| License | **Private** | |

Press **Generate** (about 2 minutes).

### Checking the result

Turn the model around in the preview. **Generate again** if:
- the hands are blobs or fused to the hips, or the legs are fused together;
- the back is a mirrored front (a face or chest emblem on the back);
- the face is melted or doubled (look closely: in the game it's small, but a broken face shows);
- painted shadows or light sit in the texture (one side of the body darker than the other);
- grey background is left stuck to the edges.

Small texture smudges and slightly soft details are fine: at sprite size they disappear. When a run is good, don't keep rolling: the next one isn't necessarily better.

### Remesh (only if needed)

Meshy's rigging refuses models with **more than 300 000 faces**. If the model is over that (Meshy shows the face count in the model's details, or Meshy refuses to rig it), use **Remesh** on it: about **150 000 faces**, triangles, keep the texture. Standard resolution usually doesn't need this.

## 4. Rigging and animation

Open **Animate** (left bar) and choose the generated (or remeshed) model.

1. **Rigging** runs automatically. If it asks for a **height**, give the character's height in the game (Blessed: **1.6 m**); Claude scales it anyway. Check the preview: the skeleton's joints should sit at the shoulders, elbows, wrists, hips, knees and ankles. If the rig failed or a joint is clearly misplaced, the pose in the image was probably the problem; generate the model again first.
2. **Animations:** pick from the library (500+). Preview each one on the model and look at the hands and the tabard: nothing should stretch or pass through the body badly.

| Character | Animations needed (game name: what to look for) |
|---|---|
| **Blessed** | `idle`: standing, slight breathing · `walk`: a steady determined march, not a run · `attack`: a one-handed overhead or diagonal sword swing from the right hand · `pain`: a short flinch or hit reaction · `death`: collapsing to the ground |
| Chorister (later) | `idle`, `walk`, `cast` (both hands raised to the chest), `pain`, `death` |
| Players (later) | `idle`, `walk` |
| Cherub, Gatekeeper | Not Meshy's rigging (wings). Claude rigs and animates them in Blender |

Prefer animations that stay **in place**. If an animation walks forward across the floor, that's fine too: Claude removes the movement.

## 5. Weapons

Same tab and settings as the character, except:
- **Multi-view off**: upload the single weapon image;
- **Pose: None**;
- no remesh, no rigging, no animation.

A thin weapon like the sword can come out too thick or bent. If it does after two runs, stop: Claude models it in Blender from the image instead, which is quick for a blade.

## 6. Download and hand-off

Download as **GLB** (it keeps the textures inside the file). If Meshy offers a texture size, choose the largest.

Save the files like this (folder per character):

```
assets/art-src/models/blessed/
  model.glb      the generated model, before rigging (in case Claude needs to rig it again)
  rigged.glb     the rigged model without animation
  idle.glb  walk.glb  attack.glb  pain.glb  death.glb
  sword.glb
```

If an export includes several animations in one file, that's fine too: say which is which.

Then tell Claude. Claude's part:
1. Attaches the weapon to the hand bone, with the right grip and angle.
2. Sets up the look: cel shading in 2–3 tones, ink outlines, the game's sunlight and colors, so the model matches the levels and the other sprites.
3. Renders the 8 directions of every animation and packs the sprite atlas (same format as today, so the game code barely changes).
4. Shows the new Blessed in the game next to the old one, and measures memory and frame time with the bench gate.

## 7. If something goes wrong

| Problem | Try |
|---|---|
| Meshy invents a different back or side | Check the turnaround: are the three views really the same character? Fix the bad view in Gemini |
| Arms or legs fused | A wider A-pose in the image (arms further from the body, feet further apart) |
| Rigging fails | The model has over 300 000 faces (Remesh), or the body plan is unclear (cloth hiding the legs) |
| The tabard stretches badly when walking | Tell Claude: it can re-weight the cloth in Blender. If it's hopeless, shorten the tabard in the design image |
| The look is too plastic or too detailed | Normal: Claude's shading and outlines turn it into the comic look. Judge it in the game, not in Meshy's preview |

**Not tested yet** (we find out on the first run): whether Meshy's A-pose option works together with multi-view, how many faces a Standard model has, and which download options Meshy offers for animations.
