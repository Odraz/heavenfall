# Your guide to the new look

Your side of the look overhaul, step by step, in the order to do it. Each step says what to do, which prompt to use, where to save the result and what to tell Claude. Tick the boxes as you go; Claude ticks the asset checklist in [prompts.md](prompts.md) when files arrive.

Claude's side is in the milestone briefs ([V1](v1.md)–[V5](v5.md)) and the [spec](spec.md). You never need to read those to do your part, but each phase links the brief if you want to see what's being built.

## What you need

| What | When | Cost |
|---|---|---|
| Gemini (as for every image so far) | from V1 | what you have |
| **Meshy Pro** or higher ([meshy.md](meshy.md) §1) | from V2 step 2.3 until the last model in V5 | about $20 a month; roughly 3 600 credits in total, so several months or one bigger plan |
| Your time | each phase | V1: about an evening of images and play; V2: a few evenings of images; V3: about an evening per character; V4: play sessions; V5: images and acceptance sessions |

Claude installs its own tools (texture compression, model compression) and asks you first.

**You can work ahead.** Images for the next milestone can be made while Claude builds the current one, as with the rogue assets. The timeline at the end shows what overlaps.

---

## Phase 0: before you start

Do this once R9 is accepted and merged.

- [ ] **0.1 Read [README.md](README.md)** (10 minutes): what you'll get, what stays the same, the decisions.
- [x] **0.2 Answer the decisions** D1–D7 in [README.md](README.md#decisions). Send them in one message; the defaults are fine if you agree with them:
  Answered 2026-10-25: D1 yes; D2 pilot first, as locked gated arches with an aisle glimpsed behind, nothing enterable; D3 yes; D4 keep identities; D5 the laptop only; D6 Meshy Pro; D7 keep today's HUD.
- [x] **0.3 Optional: the full-resolution concept.** Saved as `assets/art-src/reference/look-compare-full.jpeg` (the target half, 1 376 × 768); the comparison stays in `look-compare.webp` (2 000 × 603).
- [ ] **0.4 Start V1:** send the preparation prompt from [v1.md](v1.md#start-this-milestone).

---

<a id="v1"></a>
## Phase 1: V1 Foundations and light

Claude makes the game draw less and light better. Brief: [v1.md](v1.md).

- [ ] **1.1 Review the prepared brief** Claude gives you. Correct anything that sounds wrong, then send the implementation prompt from [v1.md](v1.md#start-this-milestone).
- [ ] **1.2 Make the four concept views.** When Claude says the `look-today-*.png` screenshots are saved, make L1–L4 ([prompts.md](prompts.md#l-concept-views)), one new chat each. Save in `assets/art-src/reference/`, then:
  ```text
  I saved the concept views: look-concept-corridor, -terrace, -refiner, -gate.
  ```
- [ ] **1.3 Work ahead (optional):** start Phase 2's pilots: T1, T4 and K1.
- [ ] **1.4 Benchmark (optional, recommended).** Claude asks at two points (before changes, after culling and compression). Say yes when you're at the laptop and can leave it alone for 15 minutes; the desktop must stay uncovered.
- [ ] **1.5 Play** with the checklist in [v1.md](v1.md#play-checklist) and send your impressions (the feedback message at the end of this guide).
- [ ] **1.6 Accept V1** when you're happy:
  ```text
  I accept V1 at [SHA].
  ```

---

<a id="v2"></a>
## Phase 2: V2 Architecture

Claude builds the modeled walls, columns, doorways, arcades and vaults. Brief: [v2.md](v2.md). Phase 3 can run at the same time once V1 is accepted.

- [ ] **2.1 Texture pilots.** Make T1 `tex-marble-floor` and T4 `tex-ashlar` ([prompts.md](prompts.md#t-surface-textures)), save in `assets/art-src/look/`, tell Claude, and wait until you've seen them in the game.
- [ ] **2.2 The rest of the textures:** T2, T3, T5, T6, T8, T9, T10 (T7 lava can wait for V4), each with the approved pilot attached.
- [ ] **2.3 Kit sheet pilot.** Make K1 `kit-wall-bay` ([prompts.md](prompts.md#k-kit-reference-sheets)), save in `assets/art-src/reference/`, tell Claude. After approval: K7 `kit-gate` (needed for the gated arches), then K2–K6.
- [ ] **2.4 Meshy: the capital.** Subscribe to Meshy ([meshy.md](meshy.md) §1). Make O1 `orn-capital` ([prompts.md](prompts.md#o-ornaments-and-decorations-for-meshy)), save it, and ask Claude to cut it:
  ```text
  I saved orn-capital.png. Please cut it into the three Meshy views.
  ```
  Then follow [meshy.md](meshy.md) §5 (static model) with the three views, download `model.glb` into `assets/art-src/models/orn-capital/`, and tell Claude. Then O2 `orn-boss` the same way.
- [ ] **2.5 Review the pilot room.** Claude stops after building one room and sends before/after screenshots beside your concept. Say what's off (*"the columns are too thin"*, *"too much gold"*) until it looks right.
- [ ] **2.6 Decide the gated arches (D2).** Claude adds the locked gates to the pilot room and stops again. Look through them and shoot them, then say: everywhere they fit, shallow gated recesses only, or none.
- [ ] **2.7 Benchmark** when Claude asks (pilot room, then the full floor).
- [ ] **2.8 Play** ([v2.md](v2.md#play-checklist)), send feedback, **accept V2**.

---

<a id="v3"></a>
## Phase 3: V3 Characters

Every character remade from a Meshy model. Brief: [v3.md](v3.md). Do them **in this order, one at a time**: Claude renders each and shows it to you in the game before you start the next. The Blessed is the pilot; nothing else starts until you like it.

### The loop for one character

1. **Design** (if the table says so): the design prompt in [prompts.md](prompts.md#c-characters-for-meshy), the listed attachments, save in `assets/art-src/reference/`. Iterate until you like it.
2. **Meshy sheet:** the sheet prompt with only the design attached. Save, then:
   ```text
   I saved <id>-meshy.png. Please cut it into the three Meshy views.
   ```
3. **Parts** (if listed): the parts prompt. Save.
4. **Meshy:** generate the model from the three views ([meshy.md](meshy.md) §4). Check it from every side.
5. **Path A only:** rig and animate ([meshy.md](meshy.md) §6, the animation table).
6. **Parts in Meshy:** each part as a static model (§5).
7. **Download** into `assets/art-src/models/<id>/` as [meshy.md](meshy.md) §7 shows.
8. **Tell Claude:**
   ```text
   The <character> files are in assets/art-src/models/<id>/: model.glb,
   [rigged.glb, idle.glb, walk.glb, ...], [parts]. Please render it and
   show me old and new side by side.
   ```
9. **Look at it in the game** at real size and in a crowd. Accept or say what's wrong.

### The order and what each needs

| Step | Character | Images you make | Meshy |
|---|---|---|---|
| [ ] 3.1 | **Blessed (pilot)** | `blessed-design`, `blessed-meshy`, `blessed-sword` | path A: model, rig, 5 animations; sword static |
| [ ] 3.2 | Watchman | `watchman-helmet` | 6 rifle animations on the **Blessed's** rig; helmet and `watchman-clarion` static |
| [ ] 3.3 | Chorister | `chorister-design`, `chorister-meshy` | path B: model only |
| [ ] 3.4 | Cherub | `cherub-design`, `cherub-meshy`, `cherub-wings`, `cherub-bow` | path B: model; wings and bow static |
| [ ] 3.5 | Dominion | none, unless Claude asks for `dominion-meshy` | path A: model, rig, 5 animations; `dominion-mace` and `dominion-wings` static |
| [ ] 3.6 | Lectern Cantor | `cantor-wings` | path B: model from the existing turnaround; wings and `cantor-hymnal` static |
| [ ] 3.7 | Stray-Carrier | none, unless Claude asks | path B: model; `carrier-wings`, `carrier-shroud` static |
| [ ] 3.8 | Gatekeeper | `gatekeeper-design`, `gatekeeper-meshy`, `gatekeeper-wing` | path B: model; wing and `gatekeeper-trumpet` static |
| [ ] 3.9 | Fallen | `fallen-design`, `fallen-meshy` | path A: model, rig, idle and walk |
| [ ] 3.10 | Heretic Saint | `heretic-design`, `heretic-meshy` | path B: model only |
| [ ] 3.11 | Binder | `binder-design`, `binder-meshy` | path A: model, rig, idle and walk |
| [ ] 3.12 | Betrayer | `betrayer-design`, `betrayer-meshy` | path A: model, rig, idle and walk |

For the Dominion, Cantor and Carrier, Claude first checks whether their existing turnarounds (from R2) work in Meshy. Ask before making anything for them:
```text
Do the existing Dominion, Cantor and Carrier turnarounds pass the Meshy rules?
```

The players' weapons: Claude checks the existing `weapon-*-sheet.png` references first and asks only if one can't be used.

- [ ] **3.13 Benchmark** when Claude asks (load time and memory with every enemy).
- [ ] **3.14 Play** ([v3.md](v3.md#play-checklist)), send feedback, **accept V3**.

---

<a id="v4"></a>
## Phase 4: V4 Effects

Lava, fire, sparks, lights. Brief: [v4.md](v4.md). Almost no images: Claude simulates the fire and smoke in Blender.

- [ ] **4.1** T7 `tex-lava` if you didn't make it in Phase 2.
- [ ] **4.2 One session per class** when Claude asks (stage 6): play its abilities in a full room and say what's unclear, too bright or tiring.
- [ ] **4.3 Benchmark** when Claude asks (a full crest with every class).
- [ ] **4.4 Play** ([v4.md](v4.md#play-checklist)), **accept V4**.

---

<a id="v5"></a>
## Phase 5: V5 Props and finish

Brief: [v5.md](v5.md).

- [ ] **5.1 Decorations:** O3–O7 ([prompts.md](prompts.md#o-ornaments-and-decorations-for-meshy)), each cut by Claude, made static in Meshy, downloaded into `assets/art-src/models/orn-<id>/`.
- [ ] **5.2 Props:** P1 `prop-amphora-tall` first (pilot), then P2–P6 ([prompts.md](prompts.md#p-props-for-meshy)), the same way into `assets/art-src/models/prop-<id>/`.
- [ ] **5.3 Cancel Meshy** once every model is accepted.
- [ ] **5.4 Final benchmark** on every quality setting (Claude asks).
- [ ] **5.5 Acceptance sessions:** solo with each class, co-op with one player on Low and one on High, a full run to the Gatekeeper.
- [ ] **5.6 Accept the look**, and separately tell Claude when to merge:
  ```text
  I accept the look at [SHA].
  ```

---

## Messages to Claude

**Feedback after playing:**
```text
I played V[N] at [SHA] on [Low/Medium/High], [solo/co-op], [room or seed].
What looks better: [...]
What looks wrong or worse, where: [...]
Anything harder to read than before (enemies, hazards, states): [...]
Did it feel slower or stutter, where: [...]
```

**A file is in:**
```text
I saved [file names] in [folder].
```

**Something in Gemini or Meshy doesn't work:**
```text
[Prompt ID] keeps coming out [what's wrong]. Attached the best try:
[file name]. What should I change?
```

---

## Timeline at a glance

| While Claude builds | You make (ahead) | You review |
|---|---|---|
| V1 | L1–L4; then T1, T4, K1 pilots | the grade and light; V1 play |
| V2 | T2–T10, K2–K7, O1–O2; the Blessed (C1) once V1 is accepted | the pilot room; V2 play |
| V3 (alongside V2) | C2–C12 one by one; T7 | each character in the game |
| V4 | O3–O7, P1–P6 | each class's effects |
| V5 | nothing new | the whole game, acceptance |
