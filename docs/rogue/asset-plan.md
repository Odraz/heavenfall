# Rogue asset plan

Revision 9, 2026-10-11. **What to make and when.** The prompts are in [art-prompts.md](art-prompts.md) and [audio-prompts.md](audio-prompts.md); which game event uses which file is in [asset-coverage.md](asset-coverage.md). Nothing here has been generated yet.

## Reuse first

The four players, the Blessed, Chorister, Cherub and Gatekeeper, the first-person weapons, the marble/gold architecture kit, the sky, the decorations, the base ability and class icons, the UI frames, the loading cards and the seven music tracks all stay. The twenty rooms are built from the existing modular kit; no room paintings. Moving characters are 3D models rendered into sprites by Claude (the [Meshy guide](../look/meshy.md) pipeline or Blender), never generated frame by frame.

## What to make, in order

Each step is a small batch. Make the **pilot** first, send Claude the file names, and continue once Claude has tried it in the game and you've seen or heard it at real size and rate.

| When | Art | Audio | Needed by |
|---|---|---|---|
| **Now (during R0–R1)** | Pilots: `dominion-design`, `amphora-tall` | Pilot: `chaingun` ×3 | R2 |
| **During R1** | A1 rest (`dominion-turnaround`, `-wings`, `-mace`); B1 rest; `gold-halo`, `heal-mote`; B10; optional B4 | S1 rest (16 families ×3); S2; S3 `goldPickup`, `motePickup`; S8 `refinerFire`, `incense` | R2 |
| **R2 commander follow-up** | Pilots first: `cantor-design`, then A3 rest (`cantor-turnaround`, `-hymnal`); after the Cantor plays well, `carrier-design`, then A4 rest (`carrier-turnaround`, `-wings`, `-shroud`) | Cantor and Carrier sounds (to be written into audio-prompts.md) | the commander follow-up, before R3 |
| **During R2** | B3 (Pardoner's stall); B7 (items, pilot `item-balm`) | S3 rest; S4; S5 `levelUp`, `state-bind`; S8 `lowHealth`, `reviveHum` | R3 |
| **During R3** | B4 (Confessional) if not done; `rite-page`; B9 Betrayer's three (pilot `icon-judas-coin`) | S5 Rites and states; S6 Betrayer; S8 `confessionalAmbience`, `silverWire` | R4 |
| **During R4** | B9 other nine | S6 rest; S8 ability loops | R5 |
| **During R5** | B5; B8 (relics, pilot `relic-usher`) | S5 rewards and relic cues | R6 |
| **During R6** | A2 (trumpet); B6 (boss parts) | S7 | R7 |
| **During R7–R8** | Optional B11 | Recommended S9; optional S10 voices | R8 |

Producing the next batch while the AI implements the current milestone keeps both moving. Until an asset arrives, the game uses a labeled placeholder or a synthesized cue; required assets (art B1–B10, A1–A4 and audio S1) must be in before R9 acceptance.

## The first request

1. `chaingun-01.wav`, `-02`, `-03`: [audio-prompts.md](audio-prompts.md) S1, the pilot.
2. `dominion-design.png`: [art-prompts.md](art-prompts.md) A1.
3. `amphora-tall.png`: [art-prompts.md](art-prompts.md) B1, the pilot that sets how new props sit next to existing scenery.

Don't start with the 84 talent icons, voices or music.

## Where files go

| Kind | Source (what you save) | Runtime (what Claude exports) |
|---|---|---|
| Art | `assets/art-src/` | `assets/sprites/`, `assets/textures/`, `assets/ui/` as today |
| Model references | `assets/art-src/reference/` | rendered atlases in `assets/sprites/` |
| Sound effects | `assets/audio-src/sfx/` | decided at integration (R2), with a fallback |
| Loops | `assets/audio-src/loops/` | same |
| Voices (optional) | `assets/audio-src/voice/` | same |

Use the prompt ID as the file name; takes add `-01`, `-02`, `-03`. Never overwrite an approved file: a replacement gets the next number. Keep the original download untouched; Claude's cuts and exports are separate files. The repository's `.gitattributes` already stores images, audio and models with Git LFS.

## Provenance

For each shipped file the manifest records the tool (Gemini, ElevenLabs Sound Effects/Text to Speech, Meshy; Suno for legacy recordings/music), generation date, prompt ID and actual prompt, original filename and hash, and subscription plan at generation time. For ElevenLabs, also record duration, looping, prompt influence, enhancement state, variation/history reference and model/voice ID when applicable. Native WAV/MP3 imports write provenance sidecars; copy their actual generation metadata into the shipping manifest. Suggested document settings are not proof of the settings used. Unknown plan/model/date fields stay unknown until supplied.

Follow [audio-prompts.md](audio-prompts.md) for native ElevenLabs downloads and importing; no third-party downloader is needed. Record the commercial rights of the plan used to generate shipping audio ([ElevenLabs publication policy](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform)). Existing Suno takes retain their original provenance (Pro since at least 2026-10-11); never relabel them as ElevenLabs. Gemini and Meshy terms are recorded the same way.

## Acceptance of an asset

- **Art:** silhouette and colors right → clean cutout and crop → consistent with its family → readable at real size in the game, in a crowd. State colors stay fixed (bound: red-hot chains; slowed: violet; airborne: arc and shadow; taunted: trembling red; censed: rusty gold; pooled: the area itself). Never paint a hazard edge, ring or target into an image; the game draws them.
- **Audio:** the right sound, dry → cut, faded, loudness-matched → connected to the exact game event → heard at real rate through a full room (and a crest for warnings). The mixer's priorities, voice cap, limiter and mass-kill aggregation stay. No sound file decides damage timing, a cast deadline or success.
- **An asset counts as done only after you've seen or heard it in the game.** A file in the folder, or a row in the manifest, is not done.
