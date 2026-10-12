# Rogue audio prompts

Every new sound the Pearly Gates roguelite needs, with manuals for **Suno Sounds** and **ElevenLabs Sound Effects**, shared sound IDs and ready-to-paste prompts. It works like [music-prompts.md](../music-prompts.md): one shared sound, a checklist of exact file names, and a short routine.

**Why this matters:** playtest 5 found the synthesized sounds annoying. The slice therefore ships **recorded** sounds for everything that repeats often in a fight ([game.md](game.md) §1.3): 17 families with **3 different takes each** (51 keepers), so the game can rotate them and no shot sounds exactly like the last. Everything else in this file improves the game but has a fallback: until its recording arrives, the game uses a synthesized cue made by Claude.

**What stays:** the seven music tracks in `assets/music/` (they were made together in D minor and nobody complained about them). There are no new music prompts here; if you ever want to replace a track, use [music-prompts.md](../music-prompts.md). Spoken lines are optional and at the end.

---

## Checklist

Save each file as `<id>-01.wav`, `-02`, `-03` in `assets/audio-src/rogue/sfx/` (loops in `.../loops/`, voices in `.../voice/`). Keep the original WAV or MP3 from either provider; prefer a native WAV when available. ElevenLabs offers WAV at 48 kHz. Converting an MP3 to WAV does not restore lost detail. Keep the original download and its provenance sidecar. **Keep** is how many good takes Claude needs; generate until you have that many. **Needed by** is the milestone ([implementation.md](implementation.md)) whose playtest first uses it.

**S1 Required: frequent combat sounds** (keep 3 of each, needed by R2; `chaingun` is the repetition pilot; compare providers on a small batch first)
- [x] `chaingun` · [x] `shotgun` · [x] `slug` · [x] `censerLaunch` · [x] `censerBreak` · [x] `revolver` · [x] `silverBullet` · [x] `scourge` · [x] `daggerCut`
- [x] `hitTick` · [x] `killTick` · [x] `burstPop` · [x] `blessedDeath` · [x] `massKill`
- [ ] `porcelainBreak` · [ ] `blastLampCrack` · [ ] `blastLampBurst` (3 Suno source takes each available; heard only once the props exist)

**Current installed audio (2026-10-12): Suno.** The full ElevenLabs S1 trial was rejected as worse and rolled back: all 51 original Suno source takes and all 42 previous combat runtime WAVs were restored byte-for-byte. The ElevenLabs local audio, downloads and audition preview were removed; its generation/provenance records remain historical records. The three prop families retain their Suno sources and await their event connections. Future keepers may come from **either provider**, including a mixture within one family if they sound consistent. A checklist tick identifies an existing combat event connection; each new take still needs listening approval.

**S2 Rooms, the Dominion and the fire** (R1–R2)
- [ ] `doorsSeal` (1) · [ ] `arenaCleared` (1) · [ ] `dominionStep` (2) · [ ] `dominionTell` (1) · [ ] `dominionSlam` (2) · [ ] `refinerIgnite` (1) · [ ] `chaliceHeal` (1)

**S3 Pickups and the shop** (R2–R3)
- [ ] `goldPickup` (3, frequent) · [ ] `motePickup` (2) · [ ] `purchase` (1) · [ ] `interactionReject` (1) · [ ] `chartReveal` (1)

**S4 Items** (R3, keep 1 each)
- [ ] `item-balm` · [ ] `item-seal` · [ ] `item-feather` · [ ] `item-throw` · [ ] `item-mirror-place` · [ ] `item-mirror-return` · [ ] `item-water-land` · [ ] `item-ash-land` · [ ] `item-chain-place` · [ ] `item-plume-land`

**S5 Progress, rewards and states** (R3–R6, keep 1 each; `state-bind` and `state-land` keep 2)
- [ ] `levelUp` · [ ] `riteOffer` · [ ] `riteTaken` · [ ] `keyPickup` · [ ] `chestOpen` · [ ] `relicClaim` · [ ] `bargainAccept` · [ ] `judgmentBell` · [ ] `teleportStart` · [ ] `teleportArrive` · [ ] `streakTier`
- [ ] `state-bind` · [ ] `state-launch` · [ ] `state-land` · [ ] `state-fire` · [ ] `fireOut`
- [ ] `relic-rune` · [ ] `relic-ember` · [ ] `relic-wheel` · [ ] `relic-stamp` · [ ] `relic-chorus`

**S6 New abilities** (R4 for the Betrayer's three, R5 for the rest, keep 1 each)
- [ ] `judasCoinSpin` · [ ] `judasCoinSplit` · [ ] `wayBackMarker` · [ ] `wayBackReturn` · [ ] `silverWirePlace`
- [ ] `gatebreakerStart` · [ ] `gatebreakerWall` · [ ] `rainOfFireStart` · [ ] `castOut`
- [ ] `trialByFireStart` · [ ] `cloudOfWitnessesStart` · [ ] `wellOfGiantsStart` · [ ] `ringOfGiants` · [ ] `boundaryChain`

**S7 The Gatekeeper** (R7, keep 1 each)
- [ ] `judgmentCharge` · [ ] `judgmentBlast` · [ ] `volleyWindup` · [ ] `volleyFired` · [ ] `tollTell` · [ ] `tollImpact` · [ ] `tollPersonalWhoosh`
- [ ] `callTell` · [ ] `sealBreak` · [ ] `callReleased` · [ ] `watcherOpen` · [ ] `watcherBreak` · [ ] `hostDescend` · [ ] `bossTransition` · [ ] `bossDefeat`

**S8 Loops** (keep 1 each; Suno **Loop**, ElevenLabs **Looping On**)
- [ ] `refinerFire` (R2) · [ ] `incense` (R2) · [ ] `lowHealth` (R3) · [ ] `reviveHum` (R3) · [ ] `confessionalAmbience` (R4)
- [ ] `gatebreakerMove` · [ ] `rainOfFire` · [ ] `trialByFire` · [ ] `breadOfAngels` · [ ] `cloudOfWitnesses` · [ ] `wellOfGiants` · [ ] `silverWire` (R4–R5)

**S9 Recommended: re-record the existing synthesized cues** (R8, keep 1 each; `meleeHit`, `orbFired`, `arrowFired` keep 3, they repeat a lot)
- [ ] `meleeHit` · [ ] `orbFired` · [ ] `arrowFired` · [ ] `choristerWindup` · [ ] `cherubWindup` · [ ] `globeShatter`
- [ ] `blasphemy` · [ ] `fallingStarLeap` · [ ] `fallingStarLand` · [ ] `communion` · [ ] `shroud` · [ ] `shroudBurst` · [ ] `chains` · [ ] `discord` · [ ] `fieldOfBlood` · [ ] `shadowstep`
- [ ] `healed` · [ ] `shieldUp` · [ ] `shieldBroken` · [ ] `interrupted` · [ ] `revive` · [ ] `hurt` · [ ] `death` · [ ] `abilityReady` · [ ] `countdownTick` · [ ] `buttonClick`

**S10 Optional: voices** (any time, nothing depends on them)

**Totals:** 51 required keepers (S1); 123 more keepers with synthesized fallbacks (91 for the 84 new events in S2–S8, 32 for the 26 recommended re-recordings in S9); 14 optional voice lines.

---

## Choosing and mixing providers

Choose the **take by ear**, not the provider name. Suno supplies the current combat library; ElevenLabs remains an option for individual sounds. Try one small batch against the installed pilot before generating a whole section. A clear attack on a waveform is useful evidence for a cut, but it does not prove that a chain sounds like a chain or a crowd burst feels satisfying.

| Setting | Suno Sounds | ElevenLabs Sound Effects |
|---|---|---|
| One-shot | **One Shot** | **Looping Off** |
| Repeating texture | **Loop** | **Looping On** |
| Length | Describe the audible duration in the prompt; measure and trim the result | Set the duration control separately from the prompt's audible event length |
| Variations | Two per Create; two Creates give four candidates | Four per Generate; one Generate gives four candidates |
| Prompt controls | Concise source/action description; use foley alternatives if the fantasy description misses | Duration, prompt influence and enhancement when available |
| Downloads | Native download or the existing usesuno batch route below | Native History download; WAV or MP3 |
| Provider recorded on each take | `Suno Sounds` | `ElevenLabs` |

**Reading the catalog:** every **Generate** row below is explicitly an **ElevenLabs** settings row. Those controls are not Suno settings. The duration **inside the prompt** is the intended audible event and applies to both providers. Use a labeled **Suno alternative** where supplied; otherwise start with the shared prompt and adapt its physical source as needed. Shared prompts fit within 450 characters; preserved Suno alternatives fit the project's observed 500-character Sounds limit. Always follow the actual input counter if the product changes.

## How to use (Suno Sounds)

1. Open **Create → Sounds** (the position of Sounds varies with the current Create layout). Sounds requires Pro or Premier according to the [release note](https://suno.com/release-notes/make-loops-and-samples-from-scratch-with-sounds). The project's earlier Suno takes were generated on Pro; record the plan actually used for each new generation.
2. Choose **One Shot** for S1–S7/S9, or **Loop** for S8. Leave key and BPM unset for nonmusical SFX when the UI allows it. Describe the source, action and desired audible length in the prompt; do not copy ElevenLabs duration/influence controls into Suno. For S8, add an approximate loop length if useful, while keeping the steady-texture description. [Suno's Sounds guide](https://help.suno.com/en/articles/10625537) explains these controls and duration prompting.
3. Paste the shared prompt or the labeled Suno alternative. Our earlier sessions often got clearer results from real objects: thick tow-chain links on steel, porcelain cracking on marble, or a bronze lid and hot coals. This is project experience, not a universal ban on fantasy words, whooshes or choir. If the first take is wrong, change one acoustic detail and compare again.
4. Click **Create twice** for a frequent family needing three keepers: each Create makes two samples. Listen to all four; for a one-keeper family, one Create may be enough. In the previous Claude/Suno browser workflow, human checks required the user to click Create. If one appears again, the user completes it; the agent can still organize the prompts and downloads.
5. In your **Library/Workspace**, use **… → Download** and choose the available audio format. Prefer native WAV; otherwise retain the original MP3. Suno also documents selecting several entries and using **Download All** to obtain a ZIP ([download guide](https://help.suno.com/en/articles/2409921)). Check the account's allowance: Suno currently lists **20 monthly Pro download credits**, **60 Premier**, with Studio workflows exempt; these are download credits, separate from generation credits ([download policy](https://help.suno.com/en/articles/13876865)).
6. **Existing usesuno.com route:** for your own samples already accessible through public links, open [Batch](https://usesuno.com/tools/batch/), paste up to 20 individual links (one per line), click **Load songs**, select the intended takes, choose **MP3** or **Original**, then **Download selected**. Export the selected metadata as JSON too. Its WAV option converts locally; treat that as a converted master, not a native lossless source. The service supports public links; publishing a private take is a separate choice, not a download step. Keep its returned filenames mapped to prompt IDs. Handle any browser save or human-check dialogs when they arise.
7. Keep long takes if the wanted event is isolated. Our Suno session often produced 2–5-second files; a stated 0.3-second event is a request, not a guarantee. For Chain Gun, an isolated first shot of a burst can be cut to 75 ms. Reject music, baked reverb, distortion or the wrong material instead of trying to repair them with trimming.
8. Stage the files with **Suno provenance** using the shared handoff below, then listen to the processed pilot in the game with F8 before selecting further replacements.

## How to use (ElevenLabs Sound Effects)

1. Open **Sound Effects** in ElevenLabs. Use **History** to find your generations. This is the Sound Effects tool, not Music or Text to Speech. Claude prepares prompts and settings; you generate and approve by ear, and Claude imports and finishes the downloads. Browser assistance can handle visible controls when available; there is no provider-specific rule requiring manual generation.
2. Set the **duration control**, **Looping**, and **prompt influence** from the sound's **Generate** row below. The time written inside a prompt describes the audible event; the duration control sets the whole generated clip, including room for its decay. A 0.08 s gun click can be inside a 0.5 s clip: Claude trims the silence afterward. If the website's minimum is longer, use its minimum and keep the same event description. Do not leave every sound at the screenshot's 2.1 s setting.
3. Paste the shared/ElevenLabs prompt, rather than a longer labeled Suno alternative. These prompts stay within the documented **450-character** limit. The supplied settings are our starting choices, not ElevenLabs defaults or guaranteed results. Start at **30% influence** for variation; use **60–75%** when the material or event is wrong. Higher influence trades variation for closer adherence; compare by ear before adopting it for a family.
4. Where the **wand/enhancement toggle** is available, its tooltip says it automatically improves short or unclear prompts. Turn it **Off** for authored prompts so the submitted text stays repeatable. If you use enhancement, inspect and record the final submitted text. The control was observed in our 2026-10-12 session; availability may vary.
5. Click the generate arrow **once** for four variations. Listen to all four and star useful ones. Keep the required number of distinct good takes; regenerate only if the batch lacks enough keepers. For frequent families, three keepers should sound like the same source performed three times.
6. In History, use each chosen variation's **download icon → WAV (48 kHz)**. If WAV conversion stalls, use the native **MP3 (44.1 kHz)** download and preserve that original format; this fallback was needed in our trial. Download useful alternatives too. ElevenLabs downloads are native; usesuno.com is only relevant to the Suno route above. Generation consumes credits; downloading an existing result does not consume another generation. Check the displayed cost before generating, especially for loops. Use the native download for an existing ElevenLabs result rather than generating another copy.
7. Tell Claude the **provider**, prompt IDs and variations you like. With browser access, Claude finds the matching History batch, downloads the variations natively and maps each downloaded file to its ID; you only handle any browser challenge or save dialog that requires your interaction. Without browser access, download them yourself and supply the filenames. **Import explicitly by ID**, using the commands below. ElevenLabs filenames and WAV tags are not assumed to contain a usable prompt ID. Download/import one sound family at a time if filenames are ambiguous. No manual trimming is needed.
8. Compare the pilot in the game with **F8** (or *Settings → Recorded SFX*) before doing the rest of its section. A waveform can show attacks, silence and clipping, but your ears judge chains, feathers, character and fatigue. Reject an incorrect source, overlapping music/speech, baked hall reverb, distortion or a repetitive/overlong event; cuts cannot repair those.

The current [product guide](https://elevenlabs.io/docs/eleven-creative/playground/sound-effects) documents the duration control, looping, 30% default influence, four variations and native MP3/WAV downloads. The [API reference](https://elevenlabs.io/docs/api-reference/text-to-sound-effects/convert) specifies 0.5–30 s and influence 0–1; the overview gives a different minimum, so the settings here use 0.5 s or longer and defer to the actual website control. These are website instructions; no API key is needed. [Pricing](https://elevenlabs.io/pricing) confirms credits are charged for generation requests rather than downloads.

## Shared handoff: download → stage → choose → finish

Both providers use the same importer. Supply **`--provider suno`** or **`--provider elevenlabs`** explicitly so each take receives the correct provenance. Use actual downloaded paths in place of these examples; import only named files:

```powershell
python -I scripts/sfx_inbox.py import scourge "C:/Users/TPouzar/Downloads/suno-chain-variation-1.mp3" "C:/Users/TPouzar/Downloads/suno-chain-variation-2.mp3" --provider suno
python -I scripts/sfx_inbox.py import scourge "C:/Users/TPouzar/Downloads/elevenlabs-chain-variation-1.wav" --provider elevenlabs
```

Import **copies** sources to `assets/audio-src/rogue/sfx/inbox/<id>-<take>.wav` or `.mp3`, retains their original bytes, and writes a JSON sidecar with `provider`, `tool`, original filename, hash, import date and this document's suggested prompts. ElevenLabs suggested settings are only attached to ElevenLabs imports. An identical take with matching provider, generation metadata and processing settings already in this family's inbox is reused. Installed, spare and rejected sources can be staged again deliberately; another family's copy does not block an import.

The sidecar's **suggested** prompts/settings are not proof of what was generated: add `--metadata <generation.json>` containing a JSON object with the actual prompt, generation date, variation/history reference, model (if displayed) and subscription plan. Record Suno's mode/key/BPM or ElevenLabs' duration/looping/influence/enhancement as applicable. Unknown fields stay unknown; do not infer the plan from the screenshot's credit balance. For one batch, use metadata common to that batch; if variants need separate metadata, import them individually. This file supplies the sidecar's `generation` object, not an entire sidecar. UTF-8 files with or without a BOM are accepted. Conflicting `provider`/`tool` fields are rejected.

If a take already has a correct sidecar, retain its original generation details when importing, or copy it with the audio into an unused inbox slot. For loops and speech, the same importer accepts `--kind loops` and `--kind voice`.

### Selecting takes from either provider

Once staged, `analyze` and `place` work with both providers' WAV/MP3 files and preserve their sidecars. For example, if inbox takes `1` and `2` are Suno and `3` is ElevenLabs:

```powershell
python -I scripts/sfx_inbox.py analyze scourge
python -I scripts/sfx_inbox.py place scourge 1 2 3
python -I scripts/sfx_cut.py scourge
```

Compare the three by ear at the actual repetition rate: they should sound like the same chain, gun or porcelain body performed differently. Prefer one provider for a whole family if mixing takes changes its character. Mixing across different families is fine when the palette, space and category levels agree.

`place` replaces the **whole family's** selected source set, archiving the current takes. To replace only one existing take while retaining two, first copy the two approved existing sources and their sidecars into unused inbox slots, then select those two together with the new candidate. `place --add` appends without replacing existing sources; use it when deliberately keeping extra takes. Never overwrite an approved source directly.

### Finishing a downloaded session

`python -I scripts/sfx_finish_session.py <session.json> [id ...]` uses the same importer and cutter for **Suno, ElevenLabs or mixed S1 batches**. In a fresh session manifest, `jobs` maps sound IDs to downloaded `files`. Supply `select` with their **1-based file positions**, in keeper order, after listening. These positions are independent of provider variation numbers. There is no requirement for four downloads; each job may select as many keepers as needed, normally three for S1.

For example, this manifest selects two Suno takes and one ElevenLabs take for `scourge`:

```json
{
  "provider": "suno",
  "jobs": {
    "scourge": {
      "select": [1, 2, 3],
      "generation": {
        "prompt": "<actual submitted Suno prompt>",
        "mode": "One Shot",
        "subscription_plan": null,
        "generation_date": null
      },
      "files": [
        {"path": "C:/Users/TPouzar/Downloads/suno-chain-1.mp3", "generation": {"variation": 1}},
        {"path": "C:/Users/TPouzar/Downloads/suno-chain-2.mp3", "generation": {"variation": 2}},
        {
          "path": "C:/Users/TPouzar/Downloads/elevenlabs-chain-1.wav",
          "provider": "elevenlabs",
          "generation": {
            "prompt": "<actual submitted ElevenLabs prompt>",
            "duration_seconds": 2.1,
            "prompt_influence": 0.3,
            "loop": false,
            "enhancement": false,
            "variation": 1,
            "subscription_plan": null,
            "generation_date": null
          }
        }
      ]
    }
  }
}
```

Replace placeholder paths/prompts and record only known settings. A `provider` on a file overrides its job's provider, which overrides the session default. Job `generation` defaults apply only to files from that job's provider; a file from another provider supplies its own generation metadata. File metadata overrides job metadata. Relative download paths resolve from the manifest's directory. Job/file `processing` objects supply the cutting overrides described below, with file settings taking precedence.

Without `select`, the command refuses to install unless **`--auto-select`** is supplied explicitly. That option ranks only this session's downloads by signal measurements and keeps the job's `keep` count (default three). Signal ranking does not establish sound quality or listening approval. The finisher validates requested jobs, stages sources, prepares all selected cuts before replacing a family, then records each installed take's provenance and selection in `<session-stem>-installation.json`. Replaced sources/runtime WAVs are archived; unused candidates go to `spare/`. Rerunning skips completed audit entries. If runtime export failed after source placement, rerunning resumes it only if the source bytes and sidecars still match the audit. An audit describes that installation, so use a **fresh manifest filename** for a new replacement session.

The retained 2026-10-12 trial records describe a rejected installation and deleted downloads, not the current library. They remain local historical records (`sessions/`, `rejected/` and `reports/audio/` are git-ignored; the 25 takes rejected before 2026-10-12 stay tracked in `rejected/`); use the schema above for future sessions.

`place` retains WAV/MP3 format and sidecars, puts unused takes in `spare/`, and archives replaced sources in `rejected/` before installing keepers under the existing IDs. `--add` appends keepers. The old Suno tag-based `collect` command is retired; both staging routes use explicit filenames and IDs.

For loops, use `import <id> <files> --provider <suno|elevenlabs> --kind loops`, then `analyze`/`place` with the same `--kind loops`; for speech use `--kind voice`. These land in their own source directories. `analyze` prints measurements for loops/voices without ranking them or applying one-shot rejection flags; steady energy or several syllables are expected there. **The cutter handles all 17 S1 families**, including the three prop sounds, and archives replaced runtime WAVs in `assets/audio-src/rogue/sfx/rejected/runtime/`. The 14 existing combat families are already connected to the game; the three prop families still need their props and event connections. S2–S9's other IDs, loops and voices require finishing and connection at their owning milestone; do not claim the cutter integrates them automatically. The sound IDs, keep counts and milestone owners below remain the handoff contract.

### What Claude does with each file

For all 17 S1 families, the existing cutter decodes to mono 48 kHz, removes rumble below 40 Hz, locates the onset (or peak for the existing impact rules), trims, fades and exports 16-bit WAV in `assets/sfx/`. It normalizes peak level to -1 dBFS; the game matches the recorded cue's loudness to its synthesized reference. For future families, choose the finishing rules at integration: keep warning swells intact, preserve a bell's natural ringing, and verify loop seams without imposing one-shot fades. Keep all source downloads untouched. Analysis suggests cuts and flags; you approve by ear. The default `massKill` rule anchors near the peak to skip the old trailer risers. Cut settings depend on the approved take, not its provider. An immediate burst from either provider may need an onset override to preserve its quieter feather attack.

For an approved immediate burst, pass `--processing <cut-settings.json>` at import, or put this `processing` object on its session job/file:

```json
{"anchor": "onset", "pre_roll_seconds": 0.003}
```

The cutter reads these overrides from each source sidecar's `processing` object. Supported fields are `anchor` (`onset` or `peak`), `pre_roll_seconds`, `max_duration_seconds` and `fade_out_seconds`. Omitted fields use the family's existing defaults; durations must be finite, with a maximum cut length of at least 0.005 s and nonnegative pre-roll/fade. These are post-processing settings, separate from generation metadata. Existing Suno takes without overrides retain their finishing rules.

The existing mixer owns priorities, simultaneous voice limits and mass-kill aggregation: a crest of 1 000 deaths plays one `massKill`, not a thousand. Audio length never decides damage timing or cast deadlines.

### Provenance

Record **each take's** actual provider, submitted prompt, generation date, plan, variant/history link and original download format. A mixed family must not receive one guessed provider for all its takes. Suno mode/key/BPM and ElevenLabs duration/influence/looping/enhancement belong to their own generations. Use the plan's applicable shipping rights (Suno's [paid-plan guide](https://help.suno.com/en/articles/2410177), ElevenLabs' [publication policy](https://help.elevenlabs.io/hc/en-us/articles/13313564601361-Can-I-publish-the-content-I-generate-on-the-platform) and [pricing](https://elevenlabs.io/pricing)); do not assume a later upgrade changes earlier generations' rights. Existing Suno files keep their original provider and plan provenance.

---

## Keeping every sound in the same direction

1. **One material palette.** The damned use blackened iron, bronze, thick chains, brimstone, embers, cold silver and leather: close, heavy, gritty, warm low end. Heaven uses ivory porcelain, polished gold, white marble, glass, feathers and bells: bright, orderly and glassy, never wet or gory. Avoid sci-fi lasers, electronic UI beeps, cartoon sounds and recognizable modern firearm recordings; fantasy weapon cues can still have a powder crack.
2. **Describe the actual game event and how it sounds.** ElevenLabs can use fantasy context together with physical acoustic detail: a crowd of angels bursting into feathers is a valid starting point. Specify chain-link jangle, feather flutter, porcelain crunch, scale, attack and decay. Use the Suno foley alternatives when its direct fantasy description fails; try the direct event description in ElevenLabs. These are provider-specific starting points, not a guarantee that either one sounds better. Foley analogies remain useful fallbacks when a specific take is wrong. For layered actions, say whether layers happen together or in order. If a complex prompt fails, generate its layers separately and combine during finishing.
3. **One house sentence** at the end of one-shots:

   > Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.

   And for loops:

   > Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.

   Tonal rewards, warning swells, the heartbeat, wordless witnesses and the long bell use explicit exceptions in their prompts. A warning can build; its house sentence must not demand an immediate impact. Dry means no baked room echo, not no natural material resonance.
4. **One pilot and finishing policy per family.** Play the approved pilot before each candidate. Keep the same duration/influence/enhancement settings for a batch; change one variable when troubleshooting. Use consistent output format and category levels, and compare at actual repetition rate. Shared room reverb is an integration choice, not something a generation setting guarantees.

**Before another replacement batch:** compare a small `scourge`, `massKill` or `chaingun` pilot against its installed Suno take. The full ElevenLabs replacement on 2026-10-12 was rejected; keep the current sound until a new take is approved by ear. The music in `assets/music/` retains its existing D-minor palette and [music workflow](../music-prompts.md). Optional speech now uses ElevenLabs Text to Speech, with a fixed voice per character (S10).

---

## S1 Required: frequent combat sounds

Each repeats many times a minute, some many times a second, so: short, a clear start, a short tail, and nothing shrill. **Keep 3 of each.** They replace the synthesized cues of the same name in `src/audio/sfx.ts`.

### chaingun — the Binder's Chain Gun · keep 3 · pilot

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Fires **twelve times a second** for whole rooms: the most-heard sound in the game. It must be tiny.

**ElevenLabs prompt**

```text
One single mechanical shot from a chain-fed blackened-iron fantasy rotary gun: a compact low iron click, dry powder snap and tiny body thump, about 0.08 seconds, then silence. No burst or sustained firing, no shrill whine. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Suno alternative (previous Suno prompt)**

```text
One very short shot of a chain-fed rotary gun of blackened iron, about 0.08 seconds: a crisp low metallic click, a small dry powder snap and a tight iron body thump, almost no tail. It will repeat twelve times per second, so it is compact and never shrill. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Generate a single shot first.** The exported clip can be longer than the audible event; the existing cutter keeps at most 75 ms. If a take contains a burst, use it only if its first shot is isolated and starts cleanly. Reject continuous firing with no separable attack.

**Reject if:** it rings, whines or has a bright high tone (at 12 per second it becomes a drill); it sounds like a modern machine gun; the burst starts in the middle of a shot or under noise (the first shot must have silence before it).

### shotgun — the Fallen's Brimstone Shotgun · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Every 0.9 s.

```text
One heavy blast of a blackened-iron brimstone shotgun, about 0.3 seconds: a deep punch, a gritty mechanical crack and a brief falling tail of smoldering powder. Strong but short, not a long explosion. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Reject if:** a pump-action rack is included (the game doesn't animate one); it booms for more than half a second.

### slug — the Fallen's Brimstone Slug · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The shotgun's secondary: one heavy round. Must be distinct from the shotgun.

```text
One dense brimstone slug fired from a heavy iron shotgun, about 0.4 seconds: lower and more concentrated than a scatter blast, a hard iron strike, a short bass pressure hit and a coarse ember crack. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Reject if:** you can't tell it from the shotgun takes when played one after the other.

### censerLaunch — the Heretic Saint's Censer Launcher · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The shot, not the impact. Every 0.85 s. **It must not sound like a gun:** the Heretic is the only class without one. The prompt describes what physically happens (a heavy bronze censer flung out of a tube on its chain) and avoids gun words. Try A first; if takes still sound like a shotgun, use B, which describes an everyday object instead.

**A**
```text
A heavy bronze incense censer flung hard out of a short bronze tube, about 0.25 seconds: a hollow metallic clunk like a heavy lid slammed onto a bronze pot, a quick rattle of its chain and a whoosh of air with crackling hot coals. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**B**
```text
A heavy brass lid slammed shut on a bronze pot and a metal chain whipped through the air right after, about 0.25 seconds: one hollow brassy clunk, a short chain rattle and a soft whoosh. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Reject if:** you hear a bang or a crack (a gun); there is no hollow metal clunk.

### censerBreak — the censer hitting an enemy · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The impact. It must be metal and coals, never a blast. Try A first, B if it still comes out as a gunshot.

**A**
```text
A bronze church censer thrown down hard onto a stone floor, about 0.5 seconds: a ringing clang of bronze, its lid bursting open, hot coals scattering and skittering across the stone with a soft sizzle. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**B**
```text
A small brass bell dropped onto a stone floor with a handful of hot charcoal spilling out around it, about 0.5 seconds: one bright metallic clang, a dry scatter of coals and a quiet sizzle. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Reject if:** it booms or cracks like a shot; it sounds like glass (glass is Heaven's; the censer is Hell's bronze).

### revolver — the Betrayer's Silver Revolver · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Every 0.3 s.

**ElevenLabs prompt**

```text
One shot from an ornate silver fantasy revolver, about 0.25 seconds: a precise dry powder crack, tight metallic body and brief cold silver ring. Smaller and sharper than the shotgun, no huge bass boom, cocking or cylinder spin. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Suno alternative (previous Suno prompt)**

```text
A single shot from a .38 revolver, close-miked at a shooting range, about 0.3 seconds: one sharp loud gunshot crack with a punchy body and a short bright metallic tail. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** the silver ring lasts longer than the crack; a hammer cock or cylinder spin is included.

### silverBullet — the Betrayer's Silver Bullet · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The big line shot that tears through ten enemies; every 1.5 s.

**ElevenLabs prompt**

```text
One powerful silver bullet fired from a heavy fantasy revolver, about 0.4 seconds: a concentrated low crack with a bright silver edge and short metallic shimmer as it tears away. One shot only, no ricochet or follow-up impacts. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Suno alternative (previous Suno prompt)**

```text
A single shot from a heavy .44 Magnum revolver, close-miked at a shooting range, about 0.5 seconds: a deep powerful gunshot crack with a strong low boom, then a brief bright metallic ring of the steel frame. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** ricochets or several impacts follow (the game plays the hits).

### scourge — the Binder's Scourge · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **60%** · Enhancement **Off if available**.

A heavy chain swung in an arc; every 0.8 s.

**ElevenLabs prompt**

```text
One heavy iron chain flail swung fast in a wide arc, about 0.4 seconds: unmistakable thick chain links scraping and jangling through the air, ending in a solid low iron clank. The chain rattle is the main sound, close and weighty, with a brief decay. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Suno alternative (previous Suno prompt)**

```text
A heavy steel tow chain swung hard and slammed down onto a metal workbench, about 0.4 seconds: a loud jangling rattle of thick links and one sharp clank of chain on steel. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### daggerCut — the Betrayer's dagger during Shadowstep · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Plays once per dash while the dagger cuts through 10–15 enemies.

```text
One fast slash of a short silver dagger through the air and through light cloth, about 0.15 seconds: a quick dry silver scrape and a soft cloth slice. No wet flesh, no gore. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### hitTick — your shot hit · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The confirmation you hear on almost every hit. Very quiet in the mix; must not tire.

```text
One tiny dry hit confirmation, about 0.05 seconds: a hard soft-edged tick of metal on porcelain, readable but not piercing, no pitch or musical note. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Reject if:** it has a tone you could hum; it's longer than a blink.

### killTick — your shot killed · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
One short warm kill confirmation, about 0.1 seconds: a soft click with a small low thump under it, a little fuller than a hit tick, no musical note and no fanfare. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### burstPop — an angel bursts into feathers · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The burst death: a body blasted apart by sudden big damage (no blood: porcelain and light).

```text
One angel body bursting apart into feathers and gold light, about 0.2 seconds: a dry snap of breaking porcelain, a light rush of feathers and cloth and a small bright crack of gold. No wet sound, no scream. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### blessedDeath — a Blessed collapses · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The ordinary death, nine in ten kills. The mixer limits how many play at once.

**ElevenLabs prompt**

```text
One angelic porcelain soldier collapsing into feathers and gold sparks, about 0.25 seconds: a crisp small porcelain crack, soft feather flutter and a few bright gold ticks. Restrained but clear in a busy fight. No gasp, pain or scream. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Suno alternative (previous Suno prompt)**

```text
A thin porcelain Christmas ornament crushed in a fist, about 0.3 seconds: a crisp dry crackle of breaking porcelain and a light bright scatter of tiny metal beads onto a plate. Small and clear. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** a voice or sigh is in it (it plays hundreds of times a room).

### massKill — many angels at once · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **60%** · Enhancement **Off if available**.

One sound for a whole crowd dying in the same moment (a Silver Bullet line, Falling Star crater or blast). The original Suno takes were imperfect, but the full ElevenLabs trial was worse and was rolled back. Keep the installed takes as the comparison reference; evaluate any new candidate for feather rush, dense porcelain crunch and a low punch before selecting it.

**ElevenLabs prompt**

```text
A whole crowd of angels bursting into feathers and gold sparks at the same moment, about 0.5 seconds: one broad papery rush of many feathers, a crunchy cluster of small porcelain and gold cracks and a brief low punch under it. One single crowd event, not a sequence. No screams, no voices. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Suno alternative (previous Suno prompt)**

```text
A heavy cinematic impact hit like those in movie trailers, about 0.6 seconds: a deep punchy sub-bass boom with a crunchy layer of shattering stone and ceramic debris, then a quick clean decay. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

Ask for an immediate crowd burst, without a trailer riser. The existing cutter anchors `massKill` near the peak; listen to the cut to ensure it retains the feather attack. Adjust its cut only after approving a new take.

### porcelainBreak — an amphora shatters · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The vases players asked to smash (loot props).

```text
One ivory porcelain vase shattering on a marble floor, about 0.4 seconds: a clear porcelain crack, small dry shards falling and a short restrained tinkle. Not glass, not a bottle. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### blastLampCrack — the sanctuary lamp about to explode · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Plays the moment a lamp is hit; it explodes 0.2 s later.

```text
A red glass lamp cracking sharply under heat just before it bursts, about 0.1 seconds: one brittle glass fracture with a single iron tick. No explosion. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### blastLampBurst — the sanctuary lamp explodes · keep 3

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A red glass sanctuary lamp of burning oil exploding once, about 0.4 seconds: a deep compact whoomp of flame, a scatter of dry glass fragments and a short rattle of an iron band. Distinct from any gunshot. Not a cinematic explosion. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Reject if:** it sounds like a gunshot or a grenade (it must read as "the lamp", not "someone fired").

---

## S2 Rooms, the Dominion and the fire

### doorsSeal — the room seals · keep 1 · R1

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
Two heavy iron-bound oak church doors swung shut together, about 0.5 seconds: a low wooden scrape, one heavy iron latch dropping into place and a solid thud. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### arenaCleared — the room is cleared · keep 1 · R1

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
Heavy iron door latches release together, followed by one warm clear gold bell strike, about 0.6 seconds. A small satisfying room-clear reward, no tune or fanfare. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

The bell keeps this reward distinct from the weapon and crowd-death cues.

### dominionStep — the Dominion's footstep · keep 2 · R2

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Each step is positional and heard through the crowd at 25 m: you hear where it is.

```text
One enormous armored angel planting a marble-and-gold foot on stone, about 0.3 seconds: a deep weighty floor thud and a brief clean gold armor clank. One step, heavy enough to locate through a crowd, no drum rhythm. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Reject if:** it's a sequence of steps; it's a drum. Generate the giant scale directly first. Pitch adjustment is a finishing fallback if the approved take still lacks weight.

### dominionTell — the mace wind-up · keep 1 · R2

**Generate:** **ElevenLabs settings** · Duration **1.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The 1.5 s warning before the slam; players must hear it through a crowd. The game stretches it to the exact remaining wind-up.

```text
A large bronze gong played with a soft mallet roll, swelling steadily louder for about 1.5 seconds and stopped dead at its loudest, before any strike. One swell. Dry isolated dark-fantasy warning. One continuous swell, no final impact or room echo. No melody, beat, voice, ambience or reverb.
```

**Reject if:** it has a melody or a hit at the end (the slam is its own sound).

### dominionSlam — the mace strikes · keep 2 · R2

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
An enormous angel slamming a heavy gold-and-marble mace into the stone floor, about 0.6 seconds: a deep compact impact, cracking marble and a short low metal ring. Weighty and immediate, no riser or bell strike. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### refinerIgnite — the fire channels flare up at the seal · keep 1 · R2

**Generate:** **ElevenLabs settings** · Duration **1.2 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

When a hazard room seals, its coals flare to full flame over 1 s with a roar ([rooms.md](rooms.md) §7). The steady burning is the `refinerFire` loop (S8).

```text
A large gas furnace burner lighting up, about 1 second: a click, a low thump of the gas catching and a short steady roar of flame that settles down. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### chaliceHeal — the blessing chalice heals · keep 1 · R2

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Brighter than Communion's heal so players learn the chalice.

```text
A crystal wine glass struck lightly with a silver spoon, about 0.5 seconds: one clear bright ringing tone with a soft pour of water into a metal cup under it. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

---

## S3 Pickups and the shop

### goldPickup — a halo collected · keep 3 · R2

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Heard every few seconds in a fight (coins drop in the crowd). Short and pleasant.

```text
One gold coin dropped onto a small pile of gold coins, about 0.2 seconds: a short warm metallic chink. Not a bell, not a jingle. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### motePickup — a heal mote collected · keep 2 · R2

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Also plays for each mote Bread of Angels harvests.

```text
One glass marble dropped into an empty glass bowl, about 0.2 seconds: a clean short glassy clink, gentle and clear, not piercing. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Reject if:** you'd confuse it with `goldPickup` (one is metal, one is glass).

### purchase — an item bought · keep 1 · R3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
One purchase at a merchant's stall, about 0.25 seconds: two quick soft chinks of gold coins and one firm tap on a wooden counter. No cash register. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### interactionReject — "not enough halos", "inventory full" · keep 1 · R3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
Two quick soft knocks of a knuckle on a wooden table, about 0.15 seconds, quiet and dull. No buzzer, no alarm. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### chartReveal — the whole map revealed · keep 1 · R3

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A rolled parchment map unrolled flat on a wooden table, about 0.4 seconds: a crisp rustle of paper and one light tap of a brass weight set on its corner. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

---

## S4 Items

Each item plays its sound once when used (or when a thrown item lands). Storing an item in the inventory plays nothing. Keep 1 each, R3.

### item-balm — Balm of the Rejected (heal yourself)

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A small ceramic jar with a wax seal cracked open, about 0.3 seconds: a dry snap of breaking wax and a tiny clink of the ceramic lid. No drinking or gulping. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### item-seal — Wax Seal of Sanctuary (a shield on you)

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A wax seal broken off a folded letter, then a large glass bowl tapped once so it hums briefly, about 0.4 seconds: a dry crack of wax and a short clean glassy hum. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### item-feather — Pilgrim's Feather (run faster)

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A large bird's wing flapping once close to the microphone, about 0.3 seconds: one quick strong beat of feathers. No bird call. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### item-throw — any thrown item leaves the hand

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

New: the throw and the landing are separate events in the game, so throws need their own short sound (Bitter Water, Ash of Stillness, Plume of Expulsion).

```text
A small leather pouch thrown hard overhand past the microphone, about 0.2 seconds: a quick swish of a sleeve and the pouch passing by. No impact. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### item-mirror-place — Mirror Ward placed

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A shallow silver bowl set down on a marble table, about 0.3 seconds: a short metallic tap and a light ring of the bowl. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### item-mirror-return — a projectile sent back by the ward

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Can happen several times a second in a ranged room; keep it tiny.

```text
A small steel ball bearing bouncing off a metal plate, about 0.15 seconds: one precise bright ping. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### item-water-land — Bitter Water lands (a poison pool)

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A narrow glass flask smashing on marble and spilling water, about 0.45 seconds: a crisp glass break, a small splash and a short fizz. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### item-ash-land — Ash of Stillness lands (a slowing circle)

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A bag of flour dumped onto a stone floor, about 0.4 seconds: a soft dry granular thump and a fine sandy hiss settling. No glass. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### item-chain-place — Chain Vial placed (a binding circle)

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A small glass vial set down on stone, then a short steel chain dropped beside it in a coil, about 0.35 seconds: a small glass tap and a sharp rattle of chain links. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### item-plume-land — Plume of Expulsion lands (a launching circle)

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A magical plume striking marble and releasing one compact gust, about 0.3 seconds: a soft impact under a brisk feather flutter and a short upward rush of air. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

---

## S5 Progress, rewards and states

### levelUp — a level gained · keep 1 · R3

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A short warm rising chord on a church pipe organ, about 0.6 seconds, ending cleanly. Not a fanfare, not a jingle. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No beat, voice, ambience or reverb.
```

The house sentence's "no music" is left out on purpose: a chord is wanted here. **Reject if** it turns into a tune.

### riteOffer — a Rite page opened · keep 1 · R4

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A thick parchment page turned over and one ember popping in a fireplace, about 0.3 seconds: a crisp page turn and a small crackle. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### riteTaken — a Rite chosen · keep 1 · R4

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
Hot sealing wax stamped onto parchment with a firm thump, about 0.45 seconds, with one low church organ note under it. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No melody, beat, voice, ambience or reverb.
```

### keyPickup — the key taken · keep 1 · R6

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A large iron key picked up from a stone table, about 0.25 seconds: a compact metallic clink. No lock. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### chestOpen — the Reliquary opened · keep 1 · R6

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
An old wooden chest unlocked with a key and its heavy lid opened, about 0.6 seconds: a key turning in an iron lock, a click and a short low creak of hinges. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### relicClaim — a relic chosen · keep 1 · R6

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A small wooden box lid clicked shut, then one soft strike of a small brass bell fading out, about 0.5 seconds. One strike, not a tune. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### bargainAccept — the Advocate's bargain signed · keep 1 · R6

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A contract signed and sealed, about 0.5 seconds: a dry scratch of a quill on parchment, a firm stamp of hot wax and a heavy leather book closed with a thump. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### judgmentBell — the Bell of Judgment rung · keep 1 · R6

**Generate:** **ElevenLabs settings** · Duration **4.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Heard across the whole floor. The bell's own ringing is wanted here, so this prompt allows a long natural decay.

```text
One deep heavy bronze bell struck once, a strong single onset and its natural resonance fading over about four seconds. One strike only. Dry isolated sound effect for a dark-fantasy game, no room echo: only the bell's own ringing. No music, beat, voice or other sounds.
```

### teleportStart — Pilgrim's Return begins · keep 1 · R6

**Generate:** **ElevenLabs settings** · Duration **1.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The 1.5 s channel before a teleport; others hear it too.

```text
A wet finger circling the rim of a crystal glass, its ringing tone slowly growing louder for about 1.5 seconds, then stopping. Dry isolated dark-fantasy warning. One continuous swell, no final impact or room echo. No melody, beat, voice, ambience or reverb.
```

### teleportArrive — Pilgrim's Return arrives · keep 1 · R6

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A heavy wool cloak flapped once and a boot stepping onto a stone floor, about 0.35 seconds. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### streakTier — a kill-streak tier reached · keep 1 · R6

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Sacrilege, Desecration, Massacre, Apocalypse, Armageddon ([m12-followup-2.md](../m12-followup-2.md) §3). The game raises the pitch per tier, so one take is enough.

```text
One hard hit on a large orchestral bass drum together with one bright strike of a small brass handbell, about 0.5 seconds, ending cleanly. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No melody, beat, voice, ambience or reverb.
```

### The state cues

The seven enemy states ([game.md](game.md) §4.11) are what talents, items and relics share. These short cues play when a talent, item or relic **applies** a state, so they repeat often in build-heavy runs: keep them tiny. One cue per state, shared by every node that applies it (see [asset-coverage.md](asset-coverage.md)).

#### state-bind — an enemy is bound by a chain · keep 2 · R3

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A steel padlock snapped shut on a chain, about 0.15 seconds: a hard metallic snap and click. No rattle. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### state-launch — an enemy is flung into the air · keep 1 · R4

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
One angel abruptly flung upward, about 0.15 seconds: a compact rising rush of air and feather flutter, no landing impact. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### state-land — a flung enemy lands · keep 2 · R4

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A sack of grain dropped onto a stone floor, about 0.2 seconds: a compact dull thud. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### state-fire — a patch of floor catches fire · keep 1 · R4

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A match struck and a small pool of lamp oil catching fire, about 0.3 seconds: a scratch and a soft thump of flame. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### fireOut — a fire area goes out · keep 1 · R4

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

New: shared by Rain of Fire, Trial by Fire and every fire area's end (their catalogs ask for "a hiss as it goes out").

```text
A small fire smothered with a damp cloth, about 0.4 seconds: a short soft hiss of steam as the embers go quiet. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### The relic cues

Relics and combos share five cues ([asset-coverage.md](asset-coverage.md)): R6, keep 1 each.

#### relic-rune — a slowing circle or rune stamps the floor (Usher's Badge, First Plea, Comb)

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

New: these relics' catalog rows ask for "a small authored rune stamp".

```text
A heavy stone seal pressed into a wet clay tablet, about 0.3 seconds: a soft heavy press and a low settling scrape of stone. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### relic-ember — an ember flies to an enemy (Broken Thurible, Abandoned Mercy)

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A glowing coal popping out of a fireplace and bouncing on stone, about 0.2 seconds: one sharp crackling pop and a tiny tick. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### relic-wheel — a gold wheel starts rolling (Wheel of Review, Harrow of the Host)

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A small metal cart wheel set rolling across a stone floor, about 0.4 seconds: a bright clack and a short rattling roll. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### relic-stamp — a counterseal stamps (Counterseal, Appeal in the Marble)

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A heavy iron seal slammed down onto a marble desk, about 0.3 seconds: a firm formal thump and a brittle snap. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### relic-chorus — a ring of choral light bursts (Choral Fragment, Broken Chorus)

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

New: the catalog asks for "one bounded bright burst".

```text
One ring of choral light bursting outward, about 0.4 seconds: a bright crystalline shimmer, brief porcelain crack and tiny wordless choir chord together. One bounded burst, no melody or sung syllables. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No beat, speech, ambience or reverb.
```

---

## S6 New abilities

The twelve abilities that talents unlock ([game.md](game.md) §9.4). Each is used every 6–15 s, so one good take is enough. Hits, binds and landings they cause use the shared cues (`burstPop`, `state-bind`, `state-land`, `fireOut`, `motePickup`); their steady sounds are S8 loops. Keep 1 each.

### The Betrayer (R4)

#### judasCoinSpin — Judas Coin flicked into the air

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A silver coin flicked high by a thumb and spinning in the air, about 0.4 seconds: a sharp thumb flick and the coin's thin ringing spin. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### judasCoinSplit — a shot splits on the coin into three

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
Three small steel ball bearings striking a metal plate almost at once, about 0.3 seconds: a bright quick triple ping. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### wayBackMarker — The Way Back: shadow left behind

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A heavy velvet curtain pulled sharply aside, about 0.3 seconds: one soft dark swish of thick fabric. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### wayBackReturn — The Way Back: dash back to the shadow

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The dagger cuts along the way play `daggerCut`.

```text
A sheet of thick cloth whipped fast through the air, ending with a knife drawn from a steel sheath, about 0.35 seconds. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### silverWirePlace — Silver Wire strung

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Each enemy it binds plays `state-bind`.

```text
Two tent stakes hammered into the ground, then a steel wire pulled taut between them, about 0.3 seconds: two firm taps and one taut metallic twang. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### The Fallen (R5)

#### gatebreakerStart — Gatebreaker: the charge begins

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A heavy man in plate armor breaking into a sprint, about 0.45 seconds: a loud clank and creak of armor plates and the first heavy boot stomps on stone. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### gatebreakerWall — Gatebreaker: stopped by a wall

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A heavy armored man running full speed into a thick wooden door, about 0.5 seconds: one deep boom of metal against wood and a short crunch. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### rainOfFireStart — Rain of Fire called down

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The 6 s of burning is the `rainOfFire` loop; its end is `fireOut`.

```text
A shovel of glowing coals thrown across a stone floor, about 0.5 seconds: a low thump and a spreading patter of coals landing and crackling. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### castOut — Cast Out: the wing blast

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

The bodies landing afterwards play `state-land`.

```text
A fallen angel snapping enormous wings once to cast a crowd outward, about 0.45 seconds: a deep forceful gust with thick feather flutter, one broad wing beat, no landing impacts. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### The Heretic Saint (R5)

#### trialByFireStart — Trial by Fire begins

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Bread of Angels has no start one-shot: its loop starts at once.

```text
A small iron furnace door swung open, about 0.4 seconds: a dry scrape of metal and the low roar of the fire inside. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### cloudOfWitnessesStart — Cloud of Witnesses gathers

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A brass censer swung on its chain and a thick puff of smoke released, about 0.6 seconds: a small chain rattle and a soft hiss of steam escaping. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### The Binder (R5)

#### wellOfGiantsStart — The Well of the Giants opens

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A heavy iron manhole cover dragged open on stone, about 0.5 seconds: a deep grinding scrape and a hollow low resonance. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### ringOfGiants — Ring of the Giants

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
Several heavy steel chains dropped onto a concrete floor all around the microphone at once, about 0.5 seconds: a loud chain rattle and one heavy padlock clamp. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

#### boundaryChain — The Boundary Chain laid

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Each bind plays `state-bind` (at most 4 a second, by the catalog).

```text
A heavy steel chain dragged across a concrete floor and a steel stake hammered in once, about 0.45 seconds: a chain rattle and one firm metal knock. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

---

## S7 The Gatekeeper

Each move has its own wind-up sound ([game.md](game.md) §11.2), and wind-ups must stay audible through a crowd of adds. The game stretches or schedules each warning to the exact remaining cast time; the length here is only a target. **The first trumpet never sounds:** no trumpet, horn or fanfare in any of these. R7, keep 1 each. `judgmentCharge`, `judgmentBlast`, `volleyWindup`, `volleyFired` and `interrupted` already exist as synthesized cues.

### judgmentCharge — Judgment: 3 seconds to hide

**Generate:** **ElevenLabs settings** · Duration **3 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A church pipe organ holding one low dissonant chord that swells steadily louder and brighter for three seconds, ending at its loudest. No trumpet, no blast at the end. Dry isolated dark-fantasy warning. One continuous swell, no final impact or room echo. No melody, beat, voice, ambience or reverb.
```

### judgmentBlast — Judgment strikes

**Generate:** **ElevenLabs settings** · Duration **1.1 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
One very close thunderclap, about 0.8 seconds: an immense sharp crack and a short rolling rumble. No rain. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### volleyWindup — the Orb Volley gathers

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
Several crystal glasses rubbed at the rim at once, their tones rising together for about 0.4 seconds. Dry isolated dark-fantasy warning. One continuous swell, no final impact or room echo. No melody, beat, voice, ambience or reverb.
```

### volleyFired — the Orb Volley released

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A slingshot releasing a handful of glass marbles at once, about 0.3 seconds: one rubber snap and a quick glassy rattle. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### tollTell — the Toll prepares

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Must be clearly different from Judgment's charge and from the hanging bell.

```text
A heavy iron crowbar dragged across a stone floor and lifted, about 0.55 seconds: a low resonant scrape of metal on stone. Not a bell. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### tollImpact — the Toll strikes and a ring rolls out

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A heavy iron bar slammed flat onto a stone floor, about 0.45 seconds: a heavy metallic slam and a short rumble. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### tollPersonalWhoosh — the ring is about to reach you: jump

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Played only to the player the ring is about to reach.

```text
A long stick swung fast right past the microphone, about 0.2 seconds: a quick swish rising in pitch. No impact. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### callTell — Called to the Gate: a player is targeted

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
One strike of a small brass handbell, then a chain pulled taut through an iron ring, about 0.45 seconds. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### sealBreak — the Seal breaks and frees the player

**Generate:** **ElevenLabs settings** · Duration **0.6 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A steel padlock cut with bolt cutters, about 0.35 seconds: a hard metallic snap and the chain falling loose. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### callReleased — a held player set down safely

**Generate:** **ElevenLabs settings** · Duration **0.5 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A heavy chain loosened and dropped slack onto a wooden floor, about 0.25 seconds: a short rattle and a soft thud. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### watcherOpen — the Watchers open

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

Up to seven eyes open at once; one sound for all of them.

```text
Several wooden window shutters swung open at once, about 0.4 seconds: a dry creak and a cluster of small brass latch clicks. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### watcherBreak — a Watcher shot apart

**Generate:** **ElevenLabs settings** · Duration **0.7 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A porcelain doll's head dropped onto a marble floor, about 0.4 seconds: a crack of porcelain and a scatter of small metal parts. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### hostDescend — the Host arrives (adds descend; also the Bell's wave)

**Generate:** **ElevenLabs settings** · Duration **0.8 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A host of armored angels descending together onto marble, about 0.6 seconds: one broad flutter of many feathered wings and a restrained cluster of gold armor ticks as they settle. One arrival, not a sequence or bird flock. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

### bossTransition — 50%: he lifts the first trumpet, silent

**Generate:** **ElevenLabs settings** · Duration **1.2 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A huge stone statue grinding as it turns on its base, about 1 second: a heavy grinding of stone and a deep creak. No trumpet, no horn. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

**Reject if:** anything in it could be heard as a brass note.

### bossDefeat — the Gatekeeper falls

**Generate:** **ElevenLabs settings** · Duration **1.4 s** · Looping **Off** · Influence **30%** · Enhancement **Off if available**.

```text
A colossal marble-and-gold angel falling and breaking apart, about 1.2 seconds: a deep stone crash, cracking marble and a brief scatter of gold and feathers, ending with one soft bell strike. Dry isolated dark-fantasy SFX. One event, immediate attack, short decay then silence. No music, speech, ambience or reverb.
```

---

## S8 Loops

**Loop** in Suno or **Looping On** in ElevenLabs. The duration controls below apply to ElevenLabs; for Suno, request an approximate duration in the prompt if useful. Play the seam repeatedly; the loop setting requests a seamless join, but the result still needs listening approval. Claude fixes small seam clicks during finishing. The game starts and stops them at the exact moment the effect starts and ends, and adds `fireOut` or another end cue itself. Keep 1 each.

### refinerFire — Refiner's Fire channels burning (R2)

**Generate:** **ElevenLabs settings** · Duration **6 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

```text
A coal forge burning steadily: a low even crackle of embers and a contained hiss of flame, calm, not a roaring wildfire. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.
```

### incense — a censer cloud (R2)

**Generate:** **ElevenLabs settings** · Duration **6 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

The Heretic's clouds: up to six at once, so very quiet and sparse.

```text
A censer of smoldering incense: a soft dry hiss of embers, faint smoky air and very sparse small crackles. No bells. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.
```

### lowHealth — low health heartbeat (R3)

**Generate:** **ElevenLabs settings** · Duration **4 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

Replaces the synthesized `heartbeat`.

```text
A slow quiet heartbeat heard from inside the body, close and subdued, steady rhythm, no breathing. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, melody, voice or reverb.
```

### reviveHum — reviving a soul (R3)

**Generate:** **ElevenLabs settings** · Duration **4 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

Plays while a teammate revives you or you revive one; the success is `revive`.

```text
A wet finger circling the rim of a crystal glass: a soft steady pure ringing tone, gentle and even. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.
```

### confessionalAmbience — the Confessional's air (R4)

**Generate:** **ElevenLabs settings** · Duration **12 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

The only room ambience: the quiet before the boss.

```text
A dark wooden chapel at night: an almost silent hush, a very distant slow crackle of a candle and the faint creak of old wood. No whispers. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.
```

### gatebreakerMove — Gatebreaker charging (R5)

**Generate:** **ElevenLabs settings** · Duration **4 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

```text
A suit of plate armor carried at a run: a steady rattle and creak of metal plates. No footsteps. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.
```

### rainOfFire — Rain of Fire burning, 6 s (R5)

**Generate:** **ElevenLabs settings** · Duration **6 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

```text
Sparks and burning embers showering onto a stone floor from a collapsing bonfire: a fine steady patter and crackle. No explosions, no thunder. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.
```

### trialByFire — Trial by Fire, 4 s (R5)

**Generate:** **ElevenLabs settings** · Duration **4 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

```text
A bonfire burning close: a steady crackle of burning wood and a low roar of flame. No footsteps. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.
```

### breadOfAngels — Bread of Angels, 6 s (R5)

**Generate:** **ElevenLabs settings** · Duration **6 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

```text
A large bronze singing bowl rubbed continuously with a wooden stick: a low eerie steady hum. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.
```

### cloudOfWitnesses — Cloud of Witnesses (R5)

**Generate:** **ElevenLabs settings** · Duration **8 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

```text
A spectral cloud of witnesses suspended in incense: a soft steady smoky hiss and distant layered wordless murmurs, restrained and indistinct. No breathing gasps or intelligible words. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, beat or reverb.
```

### wellOfGiants — The Well of the Giants pulling, 5 s (R5)

**Generate:** **ElevenLabs settings** · Duration **5 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

```text
A large drain swallowing water steadily while a heavy chain turns slowly on an iron winch: a low steady gurgle and a slow chain creak. No lock or impact. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.
```

### silverWire — Silver Wire strung (R4)

**Generate:** **ElevenLabs settings** · Duration **6 s** · Looping **On** · Influence **30%** · Enhancement **Off if available**.

Very quiet; it can last a while.

```text
A steel cable under tension humming in the wind: a faint steady metallic hum with an occasional soft creak. Seamless dry dark-fantasy loop, steady texture, no intro, outro or large accents. No music, speech or reverb.
```

---

## S9 Recommended: re-record the existing synthesized cues

These events already have synthesized sounds in `src/audio/sfx.ts`, so nothing breaks without them, but they are part of what playtest 5 called annoying. Do them in R8 if time allows, in this order: the enemy attacks first (they repeat most), then the base abilities, then the rest. Same routine; keep 1 each unless stated. For ElevenLabs S9 rows: **Looping Off, influence 30%, enhancement Off if available**, using the duration column. For Suno, choose **One Shot** and use the event length already written in the prompt. Both providers use the same finishing and listening criteria.

| ID | Keep | ElevenLabs duration (s) | Prompt (append the one-shot house sentence; full prompt ≤450 characters) |
|---|---|---|---|
| `meleeHit` | 3 | 0.5 | A wooden staff striking padded leather armor, about 0.15 seconds: a compact thud with a short blunt metal clink. No wet sound. |
| `orbFired` | 3 | 0.5 | A glass marble shot from a slingshot, about 0.2 seconds: a tight rubber snap and a quick glassy tick. |
| `arrowFired` | 3 | 0.5 | A small bow releasing an arrow, about 0.2 seconds: a short crisp twang of the bowstring and a quick swish. |
| `choristerWindup` | 1 | 0.8 | A violin bow drawn across the edge of a brass cymbal, rising, about 0.5 seconds: a focused eerie ringing tone. |
| `cherubWindup` | 1 | 0.6 | A small bow drawn back, about 0.3 seconds: a quick taut creak of wood and string and a short flutter of a small bird's wings. No bird call. |
| `globeShatter` | 1 | 0.6 | A thin glass Christmas bauble dropped and popping on a stone floor, about 0.35 seconds: a crisp hollow glass pop and a tinkle of shards. |
| `blasphemy` | 1 | 0.7 | A heavy iron anvil struck once hard with a hammer, about 0.45 seconds: a low booming metallic clang and a short rattle. |
| `fallingStarLeap` | 1 | 0.5 | A heavy cloak swirled hard as a heavy man jumps, about 0.25 seconds: a fast flap of fabric and a creak of leather. |
| `fallingStarLand` | 1 | 0.8 | A heavy concrete block dropped onto a stone floor from a height, about 0.5 seconds: a deep heavy thump and a short crunch of stone. |
| `communion` | 1 | 0.7 | Several small brass handbells rung softly together once, about 0.45 seconds: a warm gentle chord fading. |
| `shroud` | 1 | 0.7 | A large glass bowl lowered onto a table and gently tapped, about 0.4 seconds: a quiet steady glassy hum. |
| `shroudBurst` | 1 | 0.7 | A thick glass pane shattering outward, about 0.45 seconds: a hollow crack and falling glass. |
| `chains` | 1 | 0.8 | Several heavy steel chains thrown down onto a concrete floor and pulled tight, about 0.5 seconds: a loud chain rattle and one firm clank. |
| `discord` | 1 | 0.8 | A large blacksmith's bellows squeezed hard once next to the microphone, about 0.5 seconds: a strong blast of air with a wooden creak. |
| `fieldOfBlood` | 1 | 0.7 | A handful of silver coins thrown down onto stone, about 0.4 seconds: a scatter of coins and one low dull thud of a leather bag landing. |
| `shadowstep` | 1 | 0.5 | A heavy cloak swirled quickly, about 0.25 seconds: a brief rush of fabric and the soft ring of a knife being drawn. |
| `healed` | 1 | 0.5 | A small glass wind chime touched lightly once, about 0.2 seconds: a soft bright tinkle. |
| `shieldUp` | 1 | 0.5 | A wine glass flicked with a fingernail, about 0.25 seconds: a short clear ring. |
| `shieldBroken` | 1 | 0.6 | A drinking glass dropped and breaking on a stone floor, about 0.35 seconds: a sharp crack and a brief tinkle. |
| `interrupted` | 1 | 0.5 | A taut rope snapping, about 0.2 seconds: one sharp dry crack. |
| `revive` | 1 | 0.7 | One warm strike of a tubular chime, about 0.4 seconds, fading. |
| `hurt` | 1 | 0.5 | A fist punching a leather coat worn over chain mail, about 0.12 seconds: a dry thud with a small metal jingle. |
| `death` | 1 | 0.7 | A man in plate armor collapsing onto a stone floor, about 0.45 seconds: a heavy clatter of metal plates and a dull thud. |
| `abilityReady` | 1 | 0.5 | A small metal latch clicked open, about 0.1 seconds: a soft clear click. |
| `countdownTick` | 1 | 0.5 | One tick of a large mechanical clock, about 0.1 seconds. |
| `buttonClick` | 1 | 0.5 | A small wooden button pressed on a desk, about 0.1 seconds: a soft clean click. |

The existing `victory`, `defeat`, `buttonHover`, `fieldEntered` and `sacrament` cues stay as they are.

---

## S10 Optional: voices

Nothing in the game depends on a voice line: every warning is a sound plus a visual, and every number is on a card. Voices remain optional for the slice. Use **ElevenLabs Text to Speech**, separate from Sound Effects.

Choose one suitable voice from the library (or Voice Design) for each speaker. Save its **voice ID, model and settings**, then use that same preset for every line by that speaker. Enter **only the exact spoken line** in the text field: do not paste the speaker direction as dialogue. Audition one pilot line per speaker for delivery, then generate the remaining lines. Keep dry spoken audio with no music, singing or effects. Fixed voice/settings improve consistency but each line still needs approval. See the [Text to Speech guide](https://elevenlabs.io/docs/eleven-creative/playground/text-to-speech).

Download natively, preserve the actual export format, and import by the table's full ID with `--kind voice` (for example `voice-gatekeeper-enter`; do not prefix it twice). Expand `voice-announcer-<tier>` into five IDs: `voice-announcer-sacrilege`, `voice-announcer-desecration`, `voice-announcer-massacre`, `voice-announcer-apocalypse`, `voice-announcer-armageddon`. Subtitles and play rules are integration work at the owning milestone.

| ID | Speaker and direction | Line | Plays |
|---|---|---|---|
| `voice-gatekeeper-enter` | Gatekeeper: resonant, measured, cold certainty, a bureaucrat of Heaven, no villain laughter | "Your appeal is denied." | once at the start of the fight ([bosses.md](bosses.md) §1) |
| `voice-gatekeeper-call` | Gatekeeper | "You have been called." | when Called to the Gate starts |
| `voice-gatekeeper-phase2` | Gatekeeper | "Let the witnesses see." | at 50%, as he lifts the trumpet |
| `voice-gatekeeper-victory` | Gatekeeper, fading | "The first trumpet is silent. Six to go." | at victory ([bosses.md](bosses.md) §1) |
| `voice-advocate-greet` | the Advocate: quiet, weary legal counsel through a grille, restrained warmth | "Your appeal is not yet heard." | first time a player opens the Advocate |
| `voice-advocate-bargain` | the Advocate | "A part of you, held until victory." | when the bargain card is shown |
| `voice-advocate-decline` | the Advocate | "Then keep what remains." | when the bargain is declined |
| `voice-pardoner-greet` | the Pardoner: polite, precise, a little too smooth | "Provision for the road ahead." | first visit to the stall |
| `voice-pardoner-purchase` | the Pardoner | "A prudent offering." | now and then on a purchase |
| `voice-announcer-<tier>` | one announcer: restrained, resonant, the same voice for all five | "Sacrilege." / "Desecration." / "Massacre." / "Apocalypse." / "Armageddon." | streak tiers |

Keep the speaker direction as a saved voice brief, not as text to be spoken.

The Gatekeeper's victory line replaces the earlier draft's *"Stand before Judgment."*, which would have spoken over the Judgment warning; the boss catalog already defines the start and victory lines.
