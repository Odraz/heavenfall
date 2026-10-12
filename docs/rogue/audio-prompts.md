# Rogue audio prompts

Every new sound the Pearly Gates roguelite needs, each with a ready-to-paste prompt for **Suno's Sounds** mode. It works like [music-prompts.md](../music-prompts.md): one shared sound, a checklist of exact file names, and a short routine.

**Why this matters:** playtest 5 found the synthesized sounds annoying. The slice therefore ships **recorded** sounds for everything that repeats often in a fight ([game.md](game.md) §1.3): 17 families with **3 different takes each** (51 keepers), so the game can rotate them and no shot sounds exactly like the last. Everything else in this file improves the game but has a fallback: until its recording arrives, the game uses a synthesized cue made by Claude.

**What stays:** the seven music tracks in `assets/music/` (they were made together in D minor and nobody complained about them). There are no new music prompts here; if you ever want to replace a track, use [music-prompts.md](../music-prompts.md). Spoken lines are optional and at the end.

---

## Checklist

Save each file as `<id>-01.wav`, `-02`, `-03` in `assets/audio-src/rogue/sfx/` (loops in `.../loops/`, voices in `.../voice/`). WAV if Suno offers it, otherwise MP3 with the same name. **Keep** is how many good takes Claude needs; generate until you have that many. **Needed by** is the milestone ([implementation.md](implementation.md)) whose playtest first uses it.

**S1 Required: frequent combat sounds** (keep 3 of each, needed by R2; `chaingun` is the pilot, do it first)
- [x] `chaingun` · [x] `shotgun` · [x] `slug` · [x] `censerLaunch` · [x] `censerBreak` · [x] `revolver` · [x] `silverBullet` · [x] `scourge` · [x] `daggerCut`
- [x] `hitTick` · [x] `killTick` · [x] `burstPop` · [x] `blessedDeath` · [x] `massKill`
- [ ] `porcelainBreak` · [ ] `blastLampCrack` · [ ] `blastLampBurst` (3 takes each generated; heard only once the props exist)

In the game since 2026-10-12 (branch `sfx-samples`). Accepted for now but not liked: `massKill` (no multi-kill payoff yet) and `scourge` (not chain enough); a later try could use a chain *dropped* onto concrete.

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

**S8 Loops** (keep 1 each, mode *Loop*)
- [ ] `refinerFire` (R2) · [ ] `incense` (R2) · [ ] `lowHealth` (R3) · [ ] `reviveHum` (R3) · [ ] `confessionalAmbience` (R4)
- [ ] `gatebreakerMove` · [ ] `rainOfFire` · [ ] `trialByFire` · [ ] `breadOfAngels` · [ ] `cloudOfWitnesses` · [ ] `wellOfGiants` · [ ] `silverWire` (R4–R5)

**S9 Recommended: re-record the existing synthesized cues** (R8, keep 1 each; `meleeHit`, `orbFired`, `arrowFired` keep 3, they repeat a lot)
- [ ] `meleeHit` · [ ] `orbFired` · [ ] `arrowFired` · [ ] `choristerWindup` · [ ] `cherubWindup` · [ ] `globeShatter`
- [ ] `blasphemy` · [ ] `fallingStarLeap` · [ ] `fallingStarLand` · [ ] `communion` · [ ] `shroud` · [ ] `shroudBurst` · [ ] `chains` · [ ] `discord` · [ ] `fieldOfBlood` · [ ] `shadowstep`
- [ ] `healed` · [ ] `shieldUp` · [ ] `shieldBroken` · [ ] `interrupted` · [ ] `revive` · [ ] `hurt` · [ ] `death` · [ ] `abilityReady` · [ ] `countdownTick` · [ ] `buttonClick`

**S10 Optional: voices** (any time, nothing depends on them)

**Totals:** 51 required keepers (S1); 123 more keepers with synthesized fallbacks (91 for the 84 new events in S2–S8, 32 for the 26 recommended re-recordings in S9); 14 optional voice lines.

---

## How to use (Suno Sounds)

1. **The plan.** Sounds needs a Pro or Premier subscription; **you have Pro** (2026-10-11), which is enough. Studio editing is Premier-only and not needed: Claude does the cutting ([release notes, 27 Jan 2026](https://suno.com/release-notes/make-loops-and-samples-from-scratch-with-sounds)). Make the sounds while subscribed: Suno grants commercial use for what you generate on a paid plan, not retroactively for free-plan generations ([paid](https://help.suno.com/en/articles/2410177), [free](https://help.suno.com/en/articles/2425729)). Before you share the game, check Suno's terms also cover Sounds output, and tell Claude your plan so it records it with the files.
2. **Mode.** *Create → Sounds*. Choose **One-Shot** for everything except S8, which is **Loop**. Leave key and BPM empty (they're for musical loops; none of these are music).
3. **Paste the whole prompt** from its section. Every prompt already ends with the shared house sentence (below) and fits Suno's **500-character limit**; don't shorten it. If you edit a prompt, keep it under 500 (Suno shows the count). There is no length slider in Sounds, so the length is written into the prompt.
4. **Click Create twice per sound** in your own Chrome (each Create gives two samples, so four takes), then tell Claude which sounds are done. Suno shows a "Verify you are human" check on every Create made from Claude's browser, so you click Create and Claude does the rest (since 2026-10-12): it finds the takes in your workspace, downloads them through [usesuno.com's batch downloader](https://usesuno.com/tools/batch/) (Suno's own Download uses the Pro plan's 20 downloads a month), picks the best by analysis, cuts them and puts them in the game. You may get a few save dialogs and a usesuno human check to click.
5. **Don't trim anything yourself.** If the sound you want is in the take once, cleanly, Claude can cut it out, even from a 2 s file with other noises around it (see *Cutting* below). Long tails, silence and extra hits before or after are fine.
6. **Listen in the game**, and compare with **F8** (or *Settings → Recorded SFX*), which switches between the recordings and the old synthesized cues. Tell Claude which sounds or takes are wrong; it swaps in a spare or rewrites the prompt. The first sound of each section is its pilot: listen to it before generating the rest.
7. **Reject a take** (generate again) if:
   - the wanted sound isn't in it, or is buried under another sound at the same moment;
   - there is music, a beat, singing or speech on top of it;
   - it has a long echo or hall reverb (Claude can shorten a tail, but not remove reverb from the hit itself);
   - it crackles or distorts at its loudest point;
   - it sounds like a different world: sci-fi lasers, cartoon, modern guns, gore;
   - for frequent families: it's too similar to a take you already kept (three takes should sound like the same gun fired three times, not three guns, and not three copies).
8. **If a sound comes out as the wrong thing** (most often: anything near a weapon turns into a gunshot), describe the physical action with everyday objects instead of its game name, and leave out words like *launcher, fire, shot, blast, impact, recoil*. Saying "not a gun" tends to make it more gun-like; describe what it **is** instead. Tell Claude, and it will rewrite the prompt.
9. **Where the files go:** Claude keeps the chosen takes as `<id>-01.mp3` … in `assets/audio-src/rogue/sfx/`, the unused ones in `spare/`, and replaced ones in `rejected/`; `python -I scripts/sfx_cut.py` cuts them into `assets/sfx/<id>-NN.wav`, which the game loads.

### What Claude does with each file

Cuts and trims, fades, cleans the low rumble, matches loudness, converts to the runtime format (decided at integration, with a fallback, per [game.md](game.md) §1.3), keeps your original untouched in `assets/audio-src/`, connects it to the game event and records its source in the asset manifest. The existing mixer still decides priority, how many sounds play at once and the mass-kill aggregation, so a crest of 1 000 deaths still plays one `massKill`, not a thousand.

---

## Keeping every sound in the same direction

**Can Suno lock a style, like a Persona?** Not for Sounds. As of October 2026, Suno's style tools (Personas, now *Style Personas* in the *Voices* menu, and *Cover*) work for songs; Sounds has no reference-audio or style lock, and each generation starts from the prompt alone ([Sounds guide](https://help.suno.com/en/articles/10625537)). So consistency comes from four things we control, not from Suno:

1. **One sound palette.** Every prompt is built only from these materials. The players' side and Heaven's side never borrow from each other, so the player always hears whose sound it is.

   | Side | Materials | Character |
   |---|---|---|
   | **The damned** (players, their weapons and abilities) | blackened iron, bronze, chains, brimstone, embers, cold silver, leather, soot | heavy, close, gritty, warm low end |
   | **Heaven** (enemies, props, the boss, rewards) | ivory porcelain, polished gold, white marble, glass, feathers, bells, a wordless choir breath | bright, clean, orderly, glassy, never wet or gory |
   | **Never** | electronic beeps, lasers, modern firearms, cartoon sounds, blood, screams, music | |

   **Describe a real recording, not the game thing** (first in-game listen of S1, 2026-10-12). Suno learned from real recordings, so a prompt works best when it names an everyday object and action a foley artist could record: *a steel tow chain slammed onto a metal workbench*, not *a chain flail*; *a shelf of porcelain plates toppling onto stone*, not *a crowd of angels bursting*. Fantasy words (angel, holy, supernatural, soul) and abstract ones (a breath of air, a rush of feathers, a rising whistle) came back as breathing, gasping or scream-like noise. A real gun may stand in for a gun's sound (a .38 revolver at a range); the palette is about how it sounds in the game, not what Suno is told. All of S2–S9 was rewritten this way on 2026-10-12, with these lessons from S1:
   - **No breath, whoosh, rush of air, whistle or choir.** They become gasps, sighs or screams. A tonal cue comes from a real instrument instead: a handbell, a gong roll, a pipe organ chord, a wet finger on a glass rim, a bow on a cymbal. A swish comes from a real object passing the microphone (a stick, a cloak).
   - **Big impacts: drop a heavy thing, don't strike with it.** "A sledgehammer smashing tiles" came out as a gunshot; *dropped* anvils, blocks and statues give a thump. "Cinematic impact" takes start with a 0.5–2.5 s riser, which Claude cuts away.
   - **Scale comes from the cut, not the prompt.** Suno records human-sized things; Claude will lower the pitch of a footstep or slam when cutting, to make it a giant's.
   - **Chains are hard.** A swung chain lacked chain in every take; a chain *dropped onto concrete* is the classic chain recording and the best bet.
   - **Takes run 2–5 s** whatever the prompt says; the length in the prompt only steers the character. Claude cuts the event out.

2. **One house sentence**, word for word at the end of every one-shot prompt:

   > *Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.*

   and every loop prompt:

   > *Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.*

   A few prompts change only the last "No …" list where the sound needs a chord, a choir breath or a whisper; the prompt says so. The sentences are kept short because **Suno's Sounds prompt is limited to 500 characters**; every prompt in this file fits (the longest is about 430).

   *Dry* matters most: sounds made dry can all be placed in the same space later; sounds with their own baked reverb each bring a different room.
3. **Approval against the pilot.** The first approved take of each section is its reference. When choosing later takes, play the reference first, then the candidate. If it sounds like another game, reject it.
4. **One finishing chain**, applied by Claude identically to every file: the same trimming rules, fades, low-cut, mono for positional sounds, loudness matched per category (weapons, impacts, pickups, warnings, UI), the same sample rate and format. The game can then put them all in one shared space (a short marble-hall reverb in the existing mixer) so sounds from forty different generations sit in the same room. This chain is the main reason a library made from many sessions sounds like one game, exactly as a sound designer masters a library.

**Music and voices.** The existing music already shares one key (D minor) and one instrument palette ([music-prompts.md](../music-prompts.md)). Any new music should use the same key and palette and Calm as the reference (*Cover*, or a *Style Persona* made from `calm.mp3`). For voices, Suno's Speech (beta since 1 Oct 2026) makes speech together with a soundtrack in one take, so a dry isolated line and the same voice across lines aren't guaranteed; see S10.

---

## Cutting the usable part out of a long take

**Yes, Claude can do this.** Suno often returns a sample longer than asked, with the wanted hit plus extra noises. As long as the wanted sound happens once, cleanly, in the take, it's usable.

How it works (the tool is set up the first time audio arrives, in R2, with your OK to install [ffmpeg](https://ffmpeg.org/), a free audio tool: `winget install Gyan.FFmpeg`):

1. Claude decodes the file and finds every separate event in it: where the sound rises out of silence, how long it rings and how bright or deep it is. One take with three separate hits becomes three candidates, so a single Suno file can give two or three takes.
2. For each candidate it makes a waveform and spectrum picture it can look at, and picks the cut: just before the attack, and where the tail falls 50 dB below the peak (or the length the prompt asked for, for frequent sounds like the Chain Gun).
3. It cuts there, adds a tiny fade-in (5 ms) and a fade-out (20–60 ms) so there is no click, removes rumble below 40 Hz, matches the loudness, and exports both a lossless master and the runtime file. Your original stays untouched.
4. For loops, it finds a cut point where the end joins the start without a click and crossfades the seam.
5. **Claude can't hear.** It chooses by analysis and then asks you to listen, in the game or on a small preview page with every candidate side by side. Your ears decide which takes ship.

What cutting **can't** fix: music or another sound playing at the same moment as the hit (separation leaves artifacts), reverb baked into the hit itself, crackling distortion, or a sound that is simply the wrong character. Those takes are rejected at step 7 above.

---

## S1 Required: frequent combat sounds

Each repeats many times a minute, some many times a second, so: short, a clear start, a short tail, and nothing shrill. **Keep 3 of each.** They replace the synthesized cues of the same name in `src/audio/sfx.ts`.

### chaingun — the Binder's Chain Gun · keep 3 · pilot

Fires **twelve times a second** for whole rooms: the most-heard sound in the game. It must be tiny.

```text
One very short shot of a chain-fed rotary gun of blackened iron, about 0.08 seconds: a crisp low metallic click, a small dry powder snap and a tight iron body thump, almost no tail. It will repeat twelve times per second, so it is compact and never shrill. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Suno makes a short burst, not one shot** (seen 2026-10-11, every time). That's fine: keep bursts whose **first shot starts from silence**. Claude cuts that first shot (the first 75 ms), so each file gives one take. The rattling tail after the burst doesn't matter.

**Reject if:** it rings, whines or has a bright high tone (at 12 per second it becomes a drill); it sounds like a modern machine gun; the burst starts in the middle of a shot or under noise (the first shot must have silence before it).

### shotgun — the Fallen's Brimstone Shotgun · keep 3

Every 0.9 s.

```text
One heavy blast of a blackened-iron brimstone shotgun, about 0.3 seconds: a deep punch, a gritty mechanical crack and a brief falling tail of smoldering powder. Strong but short, not a long explosion. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** a pump-action rack is included (the game doesn't animate one); it booms for more than half a second.

### slug — the Fallen's Brimstone Slug · keep 3

The shotgun's secondary: one heavy round. Must be distinct from the shotgun.

```text
One dense brimstone slug fired from a heavy iron shotgun, about 0.4 seconds: lower and more concentrated than a scatter blast, a hard iron strike, a short bass pressure hit and a coarse ember crack. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** you can't tell it from the shotgun takes when played one after the other.

### censerLaunch — the Heretic Saint's Censer Launcher · keep 3

The shot, not the impact. Every 0.85 s. **It must not sound like a gun:** the Heretic is the only class without one. The prompt describes what physically happens (a heavy bronze censer flung out of a tube on its chain) and avoids gun words. Try A first; if takes still sound like a shotgun, use B, which describes an everyday object instead.

**A**
```text
A heavy bronze incense censer flung hard out of a short bronze tube, about 0.25 seconds: a hollow metallic clunk like a heavy lid slammed onto a bronze pot, a quick rattle of its chain and a whoosh of air with crackling hot coals. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**B**
```text
A heavy brass lid slammed shut on a bronze pot and a metal chain whipped through the air right after, about 0.25 seconds: one hollow brassy clunk, a short chain rattle and a soft whoosh. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** you hear a bang or a crack (a gun); there is no hollow metal clunk.

### censerBreak — the censer hitting an enemy · keep 3

The impact. It must be metal and coals, never a blast. Try A first, B if it still comes out as a gunshot.

**A**
```text
A bronze church censer thrown down hard onto a stone floor, about 0.5 seconds: a ringing clang of bronze, its lid bursting open, hot coals scattering and skittering across the stone with a soft sizzle. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**B**
```text
A small brass bell dropped onto a stone floor with a handful of hot charcoal spilling out around it, about 0.5 seconds: one bright metallic clang, a dry scatter of coals and a quiet sizzle. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** it booms or cracks like a shot; it sounds like glass (glass is Heaven's; the censer is Hell's bronze).

### revolver — the Betrayer's Silver Revolver · keep 3

Every 0.3 s.

```text
A single shot from a .38 revolver, close-miked at a shooting range, about 0.3 seconds: one sharp loud gunshot crack with a punchy body and a short bright metallic tail. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

*First prompt, rejected 2026-10-12 (didn't sound like a revolver):* "One shot of an ornate long-barreled silver revolver, about 0.25 seconds: a precise sharp crack, a tight metallic body and a brief bright silver ring as it fades. No huge bass boom."

**Reject if:** the silver ring lasts longer than the crack; a hammer cock or cylinder spin is included.

### silverBullet — the Betrayer's Silver Bullet · keep 3

The big line shot that tears through ten enemies; every 1.5 s.

```text
A single shot from a heavy .44 Magnum revolver, close-miked at a shooting range, about 0.5 seconds: a deep powerful gunshot crack with a strong low boom, then a brief bright metallic ring of the steel frame. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

*First prompt, rejected 2026-10-12 (the "rising whistle" came out as a scream-like noise):* "One supernatural silver bullet fired from a revolver, about 0.4 seconds: a bright concentrated crack, then a tight rising silver whistle as it tears away into the distance, then a short metallic shimmer."

**Reject if:** ricochets or several impacts follow (the game plays the hits).

### scourge — the Binder's Scourge · keep 3

A heavy chain swung in an arc; every 0.8 s.

```text
A heavy steel tow chain swung hard and slammed down onto a metal workbench, about 0.4 seconds: a loud jangling rattle of thick links and one sharp clank of chain on steel. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

*First prompt, rejected 2026-10-12 (not enough chain):* "A heavy iron chain flail swung once in a wide arc, about 0.3 seconds: a rough short swish of chain links through the air ending in one solid iron crack. No long rattle."

### daggerCut — the Betrayer's dagger during Shadowstep · keep 3

Plays once per dash while the dagger cuts through 10–15 enemies.

```text
One fast slash of a short silver dagger through the air and through light cloth, about 0.15 seconds: a quick dry silver scrape and a soft cloth slice. No wet flesh, no gore. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### hitTick — your shot hit · keep 3

The confirmation you hear on almost every hit. Very quiet in the mix; must not tire.

```text
One tiny dry hit confirmation, about 0.05 seconds: a hard soft-edged tick of metal on porcelain, readable but not piercing, no pitch or musical note. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** it has a tone you could hum; it's longer than a blink.

### killTick — your shot killed · keep 3

```text
One short warm kill confirmation, about 0.1 seconds: a soft click with a small low thump under it, a little fuller than a hit tick, no musical note and no fanfare. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### burstPop — an angel bursts into feathers · keep 3

The burst death: a body blasted apart by sudden big damage (no blood: porcelain and light).

```text
One angel body bursting apart into feathers and gold light, about 0.2 seconds: a dry snap of breaking porcelain, a light rush of feathers and cloth and a small bright crack of gold. No wet sound, no scream. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### blessedDeath — a Blessed collapses · keep 3

The ordinary death, nine in ten kills. The mixer limits how many play at once.

```text
A thin porcelain Christmas ornament crushed in a fist, about 0.3 seconds: a crisp dry crackle of breaking porcelain and a light bright scatter of tiny metal beads onto a plate. Small and clear. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

*First prompt, rejected 2026-10-12 (a soft low breath, lost in the mix):* "One holy pilgrim-soldier collapsing and dissolving into gold sparks, about 0.25 seconds: a short soft breath of air, a dry rustle of feathers and cloth and a faint tick of gold sparks. Quiet and restrained, no voice and no pain scream."

**Reject if:** a voice or sigh is in it (it plays hundreds of times a room).

### massKill — many angels at once · keep 3

One sound for a whole crowd dying in the same moment (a Silver Bullet line, a Falling Star crater, a blast).

```text
A tall shelf loaded with porcelain plates and vases toppling onto a stone floor all at once, about 0.7 seconds: a deep heavy thump of the impact and one big dense crash of shattering porcelain, then a short scatter of shards. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

*First prompt, rejected 2026-10-12 (the "rush of feathers" sounded like people gasping, not powerful):* "A whole crowd of angels bursting into feathers and gold sparks at the same moment, about 0.5 seconds: one broad papery rush of many feathers, a crunchy cluster of small porcelain and gold cracks and a brief low punch under it. One single crowd event, not a sequence. No screams, no voices."

### porcelainBreak — an amphora shatters · keep 3

The vases players asked to smash (loot props).

```text
One ivory porcelain vase shattering on a marble floor, about 0.4 seconds: a clear porcelain crack, small dry shards falling and a short restrained tinkle. Not glass, not a bottle. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### blastLampCrack — the sanctuary lamp about to explode · keep 3

Plays the moment a lamp is hit; it explodes 0.2 s later.

```text
A red glass lamp cracking sharply under heat just before it bursts, about 0.1 seconds: one brittle glass fracture with a single iron tick. No explosion. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### blastLampBurst — the sanctuary lamp explodes · keep 3

```text
A red glass sanctuary lamp of burning oil exploding once, about 0.4 seconds: a deep compact whoomp of flame, a scatter of dry glass fragments and a short rattle of an iron band. Distinct from any gunshot. Not a cinematic explosion. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** it sounds like a gunshot or a grenade (it must read as "the lamp", not "someone fired").

---

## S2 Rooms, the Dominion and the fire

### doorsSeal — the room seals · keep 1 · R1

```text
Two heavy iron-bound oak church doors swung shut together, about 0.5 seconds: a low wooden scrape, one heavy iron latch dropping into place and a solid thud. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### arenaCleared — the room is cleared · keep 1 · R1

```text
A heavy iron padlock unlocked and dropped open onto a wooden table, then one soft strike of a small brass handbell, about 0.6 seconds. One bell strike, not a tune. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

A handbell instead of the first draft's "wordless choir chord": choir and breath words came back as gasping in S1.

### dominionStep — the Dominion's footstep · keep 2 · R2

Each step is positional and heard through the crowd at 25 m: you hear where it is.

```text
One heavy stamp of a boot in full plate armor onto a stone floor, about 0.3 seconds: a deep low thud of the boot and a short clank of armor plates. One single step. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** it's a sequence of steps; it's a drum. A real armored step is human-sized: Claude will lower its pitch when cutting (to add to `scripts/sfx_cut.py` with this sound), to make it a giant's.

### dominionTell — the mace wind-up · keep 1 · R2

The 1.5 s warning before the slam; players must hear it through a crowd. The game stretches it to the exact remaining wind-up.

```text
A large bronze gong played with a soft mallet roll, swelling steadily louder for about 1.5 seconds and stopped dead at its loudest, before any strike. One swell. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No melody, beat, voice, ambience or reverb.
```

**Reject if:** it has a melody or a hit at the end (the slam is its own sound).

### dominionSlam — the mace strikes · keep 2 · R2

```text
A heavy iron anvil dropped from a height onto a stone slab, about 0.6 seconds: a deep heavy thud, cracking stone and a short dull ring of iron. Not a bell. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### refinerIgnite — the fire channels flare up at the seal · keep 1 · R2

When a hazard room seals, its coals flare to full flame over 1 s with a roar ([rooms.md](rooms.md) §7). The steady burning is the `refinerFire` loop (S8).

```text
A large gas furnace burner lighting up, about 1 second: a click, a low thump of the gas catching and a short steady roar of flame that settles down. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### chaliceHeal — the blessing chalice heals · keep 1 · R2

Brighter than Communion's heal so players learn the chalice.

```text
A crystal wine glass struck lightly with a silver spoon, about 0.5 seconds: one clear bright ringing tone with a soft pour of water into a metal cup under it. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

---

## S3 Pickups and the shop

### goldPickup — a halo collected · keep 3 · R2

Heard every few seconds in a fight (coins drop in the crowd). Short and pleasant.

```text
One gold coin dropped onto a small pile of gold coins, about 0.2 seconds: a short warm metallic chink. Not a bell, not a jingle. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### motePickup — a heal mote collected · keep 2 · R2

Also plays for each mote Bread of Angels harvests.

```text
One glass marble dropped into an empty glass bowl, about 0.2 seconds: a clean short glassy clink, gentle and clear, not piercing. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** you'd confuse it with `goldPickup` (one is metal, one is glass).

### purchase — an item bought · keep 1 · R3

```text
One purchase at a merchant's stall, about 0.25 seconds: two quick soft chinks of gold coins and one firm tap on a wooden counter. No cash register. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### interactionReject — "not enough halos", "inventory full" · keep 1 · R3

```text
Two quick soft knocks of a knuckle on a wooden table, about 0.15 seconds, quiet and dull. No buzzer, no alarm. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### chartReveal — the whole map revealed · keep 1 · R3

```text
A rolled parchment map unrolled flat on a wooden table, about 0.4 seconds: a crisp rustle of paper and one light tap of a brass weight set on its corner. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

---

## S4 Items

Each item plays its sound once when used (or when a thrown item lands). Storing an item in the inventory plays nothing. Keep 1 each, R3.

### item-balm — Balm of the Rejected (heal yourself)

```text
A small ceramic jar with a wax seal cracked open, about 0.3 seconds: a dry snap of breaking wax and a tiny clink of the ceramic lid. No drinking or gulping. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### item-seal — Wax Seal of Sanctuary (a shield on you)

```text
A wax seal broken off a folded letter, then a large glass bowl tapped once so it hums briefly, about 0.4 seconds: a dry crack of wax and a short clean glassy hum. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### item-feather — Pilgrim's Feather (run faster)

```text
A large bird's wing flapping once close to the microphone, about 0.3 seconds: one quick strong beat of feathers. No bird call. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### item-throw — any thrown item leaves the hand

New: the throw and the landing are separate events in the game, so throws need their own short sound (Bitter Water, Ash of Stillness, Plume of Expulsion).

```text
A small leather pouch thrown hard overhand past the microphone, about 0.2 seconds: a quick swish of a sleeve and the pouch passing by. No impact. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### item-mirror-place — Mirror Ward placed

```text
A shallow silver bowl set down on a marble table, about 0.3 seconds: a short metallic tap and a light ring of the bowl. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### item-mirror-return — a projectile sent back by the ward

Can happen several times a second in a ranged room; keep it tiny.

```text
A small steel ball bearing bouncing off a metal plate, about 0.15 seconds: one precise bright ping. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### item-water-land — Bitter Water lands (a poison pool)

```text
A narrow glass flask smashing on marble and spilling water, about 0.45 seconds: a crisp glass break, a small splash and a short fizz. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### item-ash-land — Ash of Stillness lands (a slowing circle)

```text
A bag of flour dumped onto a stone floor, about 0.4 seconds: a soft dry granular thump and a fine sandy hiss settling. No glass. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### item-chain-place — Chain Vial placed (a binding circle)

```text
A small glass vial set down on stone, then a short steel chain dropped beside it in a coil, about 0.35 seconds: a small glass tap and a sharp rattle of chain links. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### item-plume-land — Plume of Expulsion lands (a launching circle)

```text
A feather duster slapped hard onto a wooden table, about 0.3 seconds: a soft thump and a brisk ruffle of feathers. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

---

## S5 Progress, rewards and states

### levelUp — a level gained · keep 1 · R3

```text
A short warm rising chord on a church pipe organ, about 0.6 seconds, ending cleanly. Not a fanfare, not a jingle. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No beat, voice, ambience or reverb.
```

The house sentence's "no music" is left out on purpose: a chord is wanted here. **Reject if** it turns into a tune.

### riteOffer — a Rite page opened · keep 1 · R4

```text
A thick parchment page turned over and one ember popping in a fireplace, about 0.3 seconds: a crisp page turn and a small crackle. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### riteTaken — a Rite chosen · keep 1 · R4

```text
Hot sealing wax stamped onto parchment with a firm thump, about 0.45 seconds, with one low church organ note under it. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No melody, beat, voice, ambience or reverb.
```

### keyPickup — the key taken · keep 1 · R6

```text
A large iron key picked up from a stone table, about 0.25 seconds: a compact metallic clink. No lock. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### chestOpen — the Reliquary opened · keep 1 · R6

```text
An old wooden chest unlocked with a key and its heavy lid opened, about 0.6 seconds: a key turning in an iron lock, a click and a short low creak of hinges. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### relicClaim — a relic chosen · keep 1 · R6

```text
A small wooden box lid clicked shut, then one soft strike of a small brass bell fading out, about 0.5 seconds. One strike, not a tune. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### bargainAccept — the Advocate's bargain signed · keep 1 · R6

```text
A contract signed and sealed, about 0.5 seconds: a dry scratch of a quill on parchment, a firm stamp of hot wax and a heavy leather book closed with a thump. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### judgmentBell — the Bell of Judgment rung · keep 1 · R6

Heard across the whole floor. The bell's own ringing is wanted here, so this prompt allows a long natural decay.

```text
One deep heavy bronze bell struck once, a strong single onset and its natural resonance fading over about four seconds. One strike only. Dry isolated sound effect for a dark-fantasy game, no room echo: only the bell's own ringing. No music, beat, voice or other sounds.
```

### teleportStart — Pilgrim's Return begins · keep 1 · R6

The 1.5 s channel before a teleport; others hear it too.

```text
A wet finger circling the rim of a crystal glass, its ringing tone slowly growing louder for about 1.5 seconds, then stopping. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No melody, beat, voice, ambience or reverb.
```

### teleportArrive — Pilgrim's Return arrives · keep 1 · R6

```text
A heavy wool cloak flapped once and a boot stepping onto a stone floor, about 0.35 seconds. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### streakTier — a kill-streak tier reached · keep 1 · R6

Sacrilege, Desecration, Massacre, Apocalypse, Armageddon ([m12-followup-2.md](../m12-followup-2.md) §3). The game raises the pitch per tier, so one take is enough.

```text
One hard hit on a large orchestral bass drum together with one bright strike of a small brass handbell, about 0.5 seconds, ending cleanly. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No melody, beat, voice, ambience or reverb.
```

### The state cues

The seven enemy states ([game.md](game.md) §4.11) are what talents, items and relics share. These short cues play when a talent, item or relic **applies** a state, so they repeat often in build-heavy runs: keep them tiny. One cue per state, shared by every node that applies it (see [asset-coverage.md](asset-coverage.md)).

#### state-bind — an enemy is bound by a chain · keep 2 · R3

```text
A steel padlock snapped shut on a chain, about 0.15 seconds: a hard metallic snap and click. No rattle. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### state-launch — an enemy is flung into the air · keep 1 · R4

```text
A heavy blanket snapped hard in the air once, about 0.15 seconds: one sharp flap of cloth. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### state-land — a flung enemy lands · keep 2 · R4

```text
A sack of grain dropped onto a stone floor, about 0.2 seconds: a compact dull thud. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### state-fire — a patch of floor catches fire · keep 1 · R4

```text
A match struck and a small pool of lamp oil catching fire, about 0.3 seconds: a scratch and a soft thump of flame. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### fireOut — a fire area goes out · keep 1 · R4

New: shared by Rain of Fire, Trial by Fire and every fire area's end (their catalogs ask for "a hiss as it goes out").

```text
A small fire smothered with a damp cloth, about 0.4 seconds: a short soft hiss of steam as the embers go quiet. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### The relic cues

Relics and combos share five cues ([asset-coverage.md](asset-coverage.md)): R6, keep 1 each.

#### relic-rune — a slowing circle or rune stamps the floor (Usher's Badge, First Plea, Comb)

New: these relics' catalog rows ask for "a small authored rune stamp".

```text
A heavy stone seal pressed into a wet clay tablet, about 0.3 seconds: a soft heavy press and a low settling scrape of stone. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### relic-ember — an ember flies to an enemy (Broken Thurible, Abandoned Mercy)

```text
A glowing coal popping out of a fireplace and bouncing on stone, about 0.2 seconds: one sharp crackling pop and a tiny tick. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### relic-wheel — a gold wheel starts rolling (Wheel of Review, Harrow of the Host)

```text
A small metal cart wheel set rolling across a stone floor, about 0.4 seconds: a bright clack and a short rattling roll. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### relic-stamp — a counterseal stamps (Counterseal, Appeal in the Marble)

```text
A heavy iron seal slammed down onto a marble desk, about 0.3 seconds: a firm formal thump and a brittle snap. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### relic-chorus — a ring of choral light bursts (Choral Fragment, Broken Chorus)

New: the catalog asks for "one bounded bright burst".

```text
A large crystal bowl struck with a padded mallet while a thin glass pane cracks at the same moment, about 0.4 seconds: one bright ringing tone and a sharp crack. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

---

## S6 New abilities

The twelve abilities that talents unlock ([game.md](game.md) §9.4). Each is used every 6–15 s, so one good take is enough. Hits, binds and landings they cause use the shared cues (`burstPop`, `state-bind`, `state-land`, `fireOut`, `motePickup`); their steady sounds are S8 loops. Keep 1 each.

### The Betrayer (R4)

#### judasCoinSpin — Judas Coin flicked into the air

```text
A silver coin flicked high by a thumb and spinning in the air, about 0.4 seconds: a sharp thumb flick and the coin's thin ringing spin. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### judasCoinSplit — a shot splits on the coin into three

```text
Three small steel ball bearings striking a metal plate almost at once, about 0.3 seconds: a bright quick triple ping. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### wayBackMarker — The Way Back: shadow left behind

```text
A heavy velvet curtain pulled sharply aside, about 0.3 seconds: one soft dark swish of thick fabric. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### wayBackReturn — The Way Back: dash back to the shadow

The dagger cuts along the way play `daggerCut`.

```text
A sheet of thick cloth whipped fast through the air, ending with a knife drawn from a steel sheath, about 0.35 seconds. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### silverWirePlace — Silver Wire strung

Each enemy it binds plays `state-bind`.

```text
Two tent stakes hammered into the ground, then a steel wire pulled taut between them, about 0.3 seconds: two firm taps and one taut metallic twang. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### The Fallen (R5)

#### gatebreakerStart — Gatebreaker: the charge begins

```text
A heavy man in plate armor breaking into a sprint, about 0.45 seconds: a loud clank and creak of armor plates and the first heavy boot stomps on stone. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### gatebreakerWall — Gatebreaker: stopped by a wall

```text
A heavy armored man running full speed into a thick wooden door, about 0.5 seconds: one deep boom of metal against wood and a short crunch. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### rainOfFireStart — Rain of Fire called down

The 6 s of burning is the `rainOfFire` loop; its end is `fireOut`.

```text
A shovel of glowing coals thrown across a stone floor, about 0.5 seconds: a low thump and a spreading patter of coals landing and crackling. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### castOut — Cast Out: the wing blast

The bodies landing afterwards play `state-land`.

```text
A huge canvas tarp snapped hard once in a strong wind, about 0.45 seconds: one deep heavy flap of fabric. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### The Heretic Saint (R5)

#### trialByFireStart — Trial by Fire begins

Bread of Angels has no start one-shot: its loop starts at once.

```text
A small iron furnace door swung open, about 0.4 seconds: a dry scrape of metal and the low roar of the fire inside. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### cloudOfWitnessesStart — Cloud of Witnesses gathers

```text
A brass censer swung on its chain and a thick puff of smoke released, about 0.6 seconds: a small chain rattle and a soft hiss of steam escaping. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### The Binder (R5)

#### wellOfGiantsStart — The Well of the Giants opens

```text
A heavy iron manhole cover dragged open on stone, about 0.5 seconds: a deep grinding scrape and a hollow low resonance. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### ringOfGiants — Ring of the Giants

```text
Several heavy steel chains dropped onto a concrete floor all around the microphone at once, about 0.5 seconds: a loud chain rattle and one heavy padlock clamp. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

#### boundaryChain — The Boundary Chain laid

Each bind plays `state-bind` (at most 4 a second, by the catalog).

```text
A heavy steel chain dragged across a concrete floor and a steel stake hammered in once, about 0.45 seconds: a chain rattle and one firm metal knock. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

---

## S7 The Gatekeeper

Each move has its own wind-up sound ([game.md](game.md) §11.2), and wind-ups must stay audible through a crowd of adds. The game stretches or schedules each warning to the exact remaining cast time; the length here is only a target. **The first trumpet never sounds:** no trumpet, horn or fanfare in any of these. R7, keep 1 each. `judgmentCharge`, `judgmentBlast`, `volleyWindup`, `volleyFired` and `interrupted` already exist as synthesized cues.

### judgmentCharge — Judgment: 3 seconds to hide

```text
A church pipe organ holding one low dissonant chord that swells steadily louder and brighter for three seconds, ending at its loudest. No trumpet, no blast at the end. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No melody, beat, voice, ambience or reverb.
```

### judgmentBlast — Judgment strikes

```text
One very close thunderclap, about 0.8 seconds: an immense sharp crack and a short rolling rumble. No rain. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### volleyWindup — the Orb Volley gathers

```text
Several crystal glasses rubbed at the rim at once, their tones rising together for about 0.4 seconds. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No melody, beat, voice, ambience or reverb.
```

### volleyFired — the Orb Volley released

```text
A slingshot releasing a handful of glass marbles at once, about 0.3 seconds: one rubber snap and a quick glassy rattle. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### tollTell — the Toll prepares

Must be clearly different from Judgment's charge and from the hanging bell.

```text
A heavy iron crowbar dragged across a stone floor and lifted, about 0.55 seconds: a low resonant scrape of metal on stone. Not a bell. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### tollImpact — the Toll strikes and a ring rolls out

```text
A heavy iron bar slammed flat onto a stone floor, about 0.45 seconds: a heavy metallic slam and a short rumble. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### tollPersonalWhoosh — the ring is about to reach you: jump

Played only to the player the ring is about to reach.

```text
A long stick swung fast right past the microphone, about 0.2 seconds: a quick swish rising in pitch. No impact. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### callTell — Called to the Gate: a player is targeted

```text
One strike of a small brass handbell, then a chain pulled taut through an iron ring, about 0.45 seconds. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### sealBreak — the Seal breaks and frees the player

```text
A steel padlock cut with bolt cutters, about 0.35 seconds: a hard metallic snap and the chain falling loose. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### callReleased — a held player set down safely

```text
A heavy chain loosened and dropped slack onto a wooden floor, about 0.25 seconds: a short rattle and a soft thud. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### watcherOpen — the Watchers open

Up to seven eyes open at once; one sound for all of them.

```text
Several wooden window shutters swung open at once, about 0.4 seconds: a dry creak and a cluster of small brass latch clicks. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### watcherBreak — a Watcher shot apart

```text
A porcelain doll's head dropped onto a marble floor, about 0.4 seconds: a crack of porcelain and a scatter of small metal parts. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### hostDescend — the Host arrives (adds descend; also the Bell's wave)

```text
A large flock of pigeons landing all at once on a stone square, about 0.6 seconds: a thick flutter of many wings settling. No bird calls. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

### bossTransition — 50%: he lifts the first trumpet, silent

```text
A huge stone statue grinding as it turns on its base, about 1 second: a heavy grinding of stone and a deep creak. No trumpet, no horn. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

**Reject if:** anything in it could be heard as a brass note.

### bossDefeat — the Gatekeeper falls

```text
A tall marble statue toppling onto a stone floor and breaking apart, about 1.2 seconds: a heavy crash, cracking marble, scattering pieces and one soft strike of a large bell fading. Dry isolated sound effect for a dark-fantasy game: one event, instant start, short tail, then silence. No music, beat, voice, ambience or reverb.
```

---

## S8 Loops

Mode **Loop**. Leave key and BPM empty. Suno makes them seamless; Claude still checks the seam and fixes it. The game starts and stops them at the exact moment the effect starts and ends, and adds `fireOut` or another end cue itself. Keep 1 each.

### refinerFire — Refiner's Fire channels burning (R2)

```text
A coal forge burning steadily: a low even crackle of embers and a contained hiss of flame, calm, not a roaring wildfire. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.
```

### incense — a censer cloud (R2)

The Heretic's clouds: up to six at once, so very quiet and sparse.

```text
A censer of smoldering incense: a soft dry hiss of embers, faint smoky air and very sparse small crackles. No bells. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.
```

### lowHealth — low health heartbeat (R3)

Replaces the synthesized `heartbeat`.

```text
A slow quiet heartbeat heard from inside the body, close and subdued, steady rhythm, no breathing. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, melody, voice or reverb.
```

### reviveHum — reviving a soul (R3)

Plays while a teammate revives you or you revive one; the success is `revive`.

```text
A wet finger circling the rim of a crystal glass: a soft steady pure ringing tone, gentle and even. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.
```

### confessionalAmbience — the Confessional's air (R4)

The only room ambience: the quiet before the boss.

```text
A dark wooden chapel at night: an almost silent hush, a very distant slow crackle of a candle and the faint creak of old wood. No whispers. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.
```

### gatebreakerMove — Gatebreaker charging (R5)

```text
A suit of plate armor carried at a run: a steady rattle and creak of metal plates. No footsteps. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.
```

### rainOfFire — Rain of Fire burning, 6 s (R5)

```text
Sparks and burning embers showering onto a stone floor from a collapsing bonfire: a fine steady patter and crackle. No explosions, no thunder. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.
```

### trialByFire — Trial by Fire, 4 s (R5)

```text
A bonfire burning close: a steady crackle of burning wood and a low roar of flame. No footsteps. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.
```

### breadOfAngels — Bread of Angels, 6 s (R5)

```text
A large bronze singing bowl rubbed continuously with a wooden stick: a low eerie steady hum. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.
```

### cloudOfWitnesses — Cloud of Witnesses (R5)

```text
Thick smoke pouring from a smoldering pile of damp leaves: a soft steady hiss and faint crackle, with a far-off crowd murmur too faint to make out words. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, clear words or reverb.
```

### wellOfGiants — The Well of the Giants pulling, 5 s (R5)

```text
A large drain swallowing water steadily while a heavy chain turns slowly on an iron winch: a low steady gurgle and a slow chain creak. No lock or impact. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.
```

### silverWire — Silver Wire strung (R4)

Very quiet; it can last a while.

```text
A steel cable under tension humming in the wind: a faint steady metallic hum with an occasional soft creak. Seamless dry loop for a dark-fantasy game: steady even texture, no start, end, build-up or loud event. No music, beat, voice or reverb.
```

---

## S9 Recommended: re-record the existing synthesized cues

These events already have synthesized sounds in `src/audio/sfx.ts`, so nothing breaks without them, but they are part of what playtest 5 called annoying. Do them in R8 if time allows, in this order: the enemy attacks first (they repeat most), then the base abilities, then the rest. Same routine; keep 1 each unless stated.

| ID | Keep | Prompt (paste it, then add the one-shot house sentence; together they stay around 300 characters, well under 500) |
|---|---|---|
| `meleeHit` | 3 | A wooden staff striking padded leather armor, about 0.15 seconds: a compact thud with a short blunt metal clink. No wet sound. |
| `orbFired` | 3 | A glass marble shot from a slingshot, about 0.2 seconds: a tight rubber snap and a quick glassy tick. |
| `arrowFired` | 3 | A small bow releasing an arrow, about 0.2 seconds: a short crisp twang of the bowstring and a quick swish. |
| `choristerWindup` | 1 | A violin bow drawn across the edge of a brass cymbal, rising, about 0.5 seconds: a focused eerie ringing tone. |
| `cherubWindup` | 1 | A small bow drawn back, about 0.3 seconds: a quick taut creak of wood and string and a short flutter of a small bird's wings. No bird call. |
| `globeShatter` | 1 | A thin glass Christmas bauble dropped and popping on a stone floor, about 0.35 seconds: a crisp hollow glass pop and a tinkle of shards. |
| `blasphemy` | 1 | A heavy iron anvil struck once hard with a hammer, about 0.45 seconds: a low booming metallic clang and a short rattle. |
| `fallingStarLeap` | 1 | A heavy cloak swirled hard as a heavy man jumps, about 0.25 seconds: a fast flap of fabric and a creak of leather. |
| `fallingStarLand` | 1 | A heavy concrete block dropped onto a stone floor from a height, about 0.5 seconds: a deep heavy thump and a short crunch of stone. |
| `communion` | 1 | Several small brass handbells rung softly together once, about 0.45 seconds: a warm gentle chord fading. |
| `shroud` | 1 | A large glass bowl lowered onto a table and gently tapped, about 0.4 seconds: a quiet steady glassy hum. |
| `shroudBurst` | 1 | A thick glass pane shattering outward, about 0.45 seconds: a hollow crack and falling glass. |
| `chains` | 1 | Several heavy steel chains thrown down onto a concrete floor and pulled tight, about 0.5 seconds: a loud chain rattle and one firm clank. |
| `discord` | 1 | A large blacksmith's bellows squeezed hard once next to the microphone, about 0.5 seconds: a strong blast of air with a wooden creak. |
| `fieldOfBlood` | 1 | A handful of silver coins thrown down onto stone, about 0.4 seconds: a scatter of coins and one low dull thud of a leather bag landing. |
| `shadowstep` | 1 | A heavy cloak swirled quickly, about 0.25 seconds: a brief rush of fabric and the soft ring of a knife being drawn. |
| `healed` | 1 | A small glass wind chime touched lightly once, about 0.2 seconds: a soft bright tinkle. |
| `shieldUp` | 1 | A wine glass flicked with a fingernail, about 0.25 seconds: a short clear ring. |
| `shieldBroken` | 1 | A drinking glass dropped and breaking on a stone floor, about 0.35 seconds: a sharp crack and a brief tinkle. |
| `interrupted` | 1 | A taut rope snapping, about 0.2 seconds: one sharp dry crack. |
| `revive` | 1 | One warm strike of a tubular chime, about 0.4 seconds, fading. |
| `hurt` | 1 | A fist punching a leather coat worn over chain mail, about 0.12 seconds: a dry thud with a small metal jingle. |
| `death` | 1 | A man in plate armor collapsing onto a stone floor, about 0.45 seconds: a heavy clatter of metal plates and a dull thud. |
| `abilityReady` | 1 | A small metal latch clicked open, about 0.1 seconds: a soft clear click. |
| `countdownTick` | 1 | One tick of a large mechanical clock, about 0.1 seconds. |
| `buttonClick` | 1 | A small wooden button pressed on a desk, about 0.1 seconds: a soft clean click. |

The existing `victory`, `defeat`, `buttonHover`, `fieldEntered` and `sacrament` cues stay as they are.

---

## S10 Optional: voices

Nothing in the game depends on a voice line: every warning is a sound plus a visual, and every number is on a card. **Recommendation: skip voices for the slice.** Speech that sounds like the same character across lines is not something Suno guarantees yet (Speech is beta and generates speech with a soundtrack), and wrong-sounding voices hurt more than silence.

If you want to try anyway: use Suno's *Speech*, one line per generation, and keep the first take you like as that character's reference (*Voices* lets you upload it as a voice). Reject takes with music or effects under the voice. Save as `voice-<id>-01.wav` in `assets/audio-src/rogue/voice/`; Claude adds subtitles and the playing rules.

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

The voice prompt: *"One dry close-mic English spoken line by <speaker and direction>. Say exactly once: "<line>". No singing, no music, no sound effects, no other words, no reverb."*

The Gatekeeper's victory line replaces the earlier draft's *"Stand before Judgment."*, which would have spoken over the Judgment warning; the boss catalog already defines the start and victory lines.
