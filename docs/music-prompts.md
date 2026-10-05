# Music prompts

Prompts for the 7 music tracks of milestone 8 ([m8.md](m8.md) §9.2). They're written for Suno; other generators take the *Style* text as their description.

## The idea

All tracks share one sound, so they feel like one score:
- **Same key:** D minor.
- **Heaven's instruments** in every track: pipe organ, wordless choir, harp, bells.
- **Hell's instruments**, which arrive and grow arena by arena: distorted guitars, heavy drums, low brass.

| Track | Feel | BPM | Hell's share |
|---|---|---|---|
| Calm | serene, a little uneasy | 70 | none, only a low drone |
| Arena 1 | the first fight | 120 | guitars and drums enter |
| Arena 2 | wind and height | 135 | double kick, tremolo guitars |
| Arena 3 | a hymn under siege | 150 | full metal against Gregorian chant |
| Boss | the Gate itself, epic | 165 | everything: choir, organ, orchestra and metal |
| Victory / Defeat | short stings | — | — |

## Checklist

Save each as MP3 in `assets/music/` with exactly this name:

- [ ] `calm.mp3`
- [ ] `arena-1.mp3`
- [ ] `arena-2.mp3`
- [ ] `arena-3.mp3`
- [ ] `boss.mp3`
- [ ] `victory.mp3`
- [ ] `defeat.mp3`

## How to use (Suno)

1. **Custom mode.** Paste *Style* into the style field and *Lyrics* into the lyrics field. Turn on *Instrumental* only where a prompt says so; the choir tracks need vocals on, so the choir can sing.
2. **Make Calm first.** Generate until you like it, then make the other tracks with Calm as the reference if your Suno version can (*Cover*, *Persona* or *Inspo*). This keeps the sound consistent. Otherwise, generate a few of each and pick the ones that sound most alike.
3. **Length:** let the looping tracks run 2–3 minutes. Claude cuts a seamless loop from the middle, so intros and endings don't matter. Avoid a long fade-out.
4. **Reject a take** with sung lyrics in a modern pop style, a lead singer, a key that sounds bright and happy (except Victory), or silence gaps in the middle.
5. **License:** check that your plan lets you use the tracks in a game you share.

---

## 1. Calm — `calm.mp3`

Between fights: menus, Lobby, corridors, the countdown and cleared arenas.

**Style:**
```
dark celestial ambient, cinematic, D minor, 70 BPM, soft pipe organ pads, distant ethereal wordless female choir, slow harp arpeggios, faint tubular bells, deep sub-bass drone underneath, heavenly cathedral reverb, serene but uneasy, no drums, no guitars, seamless loop, video game exploration music
```
**Exclude styles:** `drums, percussion, pop vocals, lyrics, guitar, upbeat`

**Lyrics** (vocals on, for the wordless choir):
```
[Intro]
[Harp and organ, soft]

[Verse]
(Aaah... aaah...)

[Interlude]
[Tubular bells, low drone swells]

[Verse]
(Ooh... aaah...)

[Bridge]
[Harp alone, the drone grows darker]

[Outro]
(Aaah...)
```

## 2. Arena 1, Courtyard of Clouds — `arena-1.mp3`

The first fight. The organ theme meets metal for the first time.

**Style:**
```
symphonic metal, instrumental, D minor, 120 BPM, heavy palm-muted baritone guitars, punchy driving drums, pipe organ lead melody, wordless choir accents, harp flourishes, tubular bells, heroic yet sinister, Doom-like FPS combat music, relentless, no lead vocals
```
**Exclude styles:** `pop, lead vocals, lyrics, ballad, electronic`

**Lyrics:** turn *Instrumental* on, or leave vocals on with:
```
[Intro]
[Organ theme, then drums and guitars crash in]

[Verse]
[Palm-muted riff, organ melody on top]

[Chorus]
(Aaah... aaah...)
[Choir swells with the organ]

[Breakdown]
[Heavy half-time riff, bells]

[Chorus]
(Aaah... aaah...)
```

## 3. Arena 2, The Cloudbridge — `arena-2.mp3`

Higher and faster: wind, height and falling.

**Style:**
```
symphonic metal, instrumental, D minor, 135 BPM, double kick drums, tremolo-picked distorted guitars, soaring pipe organ, wordless choir more present, brass stabs, airy wind textures, harp runs, vertigo and urgency, epic FPS combat music, no lead vocals
```
**Exclude styles:** `pop, lead vocals, lyrics, ballad, electronic`

**Lyrics** (vocals on):
```
[Intro]
[Wind, then tremolo guitars and double kick]

[Verse]
[Galloping riff, organ countermelody]

[Chorus]
(Aaah... ooh...)
[Full choir, brass stabs]

[Bridge]
[Harp runs over pounding drums]

[Chorus]
(Aaah... ooh...)
```

## 4. Arena 3, Cloister of Hymns — `arena-3.mp3`

A hymn under siege. The Choristers' song fights the metal.

**Style:**
```
dark symphonic metal, D minor, 150 BPM, Gregorian male chant in Latin, crushing down-tuned guitars, blast beats alternating with groove, church bells, pipe organ counterpoint, low brass, cathedral reverb, ominous and holy, epic FPS combat music
```
**Exclude styles:** `pop, female lead vocals, english lyrics, ballad, electronic`

**Lyrics** (vocals on; *Sanctus* is the traditional Latin hymn):
```
[Intro]
[Church bells, Gregorian chant alone]
Sanctus, sanctus, sanctus

[Verse]
[Crushing riff, chant over the top]
Sanctus Dominus Deus Sabaoth

[Chorus]
[Blast beats, full male choir, organ]
Pleni sunt caeli et terra gloria tua

[Breakdown]
[Bells and half-time riff]

[Chorus]
Hosanna in excelsis
```

## 5. Boss, The Gate — `boss.mp3`

The Gatekeeper and Judgment. Everything at once.

**Style:**
```
epic orchestral metal, D minor, 165 BPM, massive full choir chanting in Latin, thunderous pipe organ, timpani, full brass section, double kick drums, heavy distorted guitars, string ostinato, apocalyptic, final boss battle music, climactic and overwhelming
```
**Exclude styles:** `pop, lead vocals, english lyrics, ballad, electronic, lo-fi`

**Lyrics** (vocals on; *Dies irae*, "day of wrath", fits Judgment):
```
[Intro]
[Organ and timpani, choir enters]
Dies irae, dies illa

[Verse]
[Double kick, string ostinato, guitars]
Solvet saeclum in favilla

[Chorus]
[Full choir, brass, everything]
Dies irae, dies illa
Quantus tremor est futurus

[Bridge]
[Choir alone, then the whole orchestra slams back]
Tuba mirum spargens sonum

[Chorus]
Dies irae, dies illa
```

## 6. Victory — `victory.mp3`

A sting of 10–20 seconds when the Gatekeeper falls.

**Style:**
```
short triumphant orchestral sting, dark fantasy, starts in D minor and resolves to a huge D major chord, pipe organ, full choir, brass fanfare, timpani roll, cathedral reverb, ending with a long ringing final chord, 15 seconds
```
**Lyrics** (vocals on):
```
[Intro]
[Timpani roll, brass fanfare]
(Aaaaah!)
[Final chord, organ and choir ring out]
[End]
```

## 7. Defeat — `defeat.mp3`

A sting of 8–15 seconds when the party falls.

**Style:**
```
short somber orchestral sting, D minor, slow descending wordless choir, low pipe organ, single deep church bell toll, fading into silence, cathedral reverb, 10 seconds
```
**Lyrics** (vocals on):
```
[Intro]
[Bell toll]
(Aaah... aaah...)
[Choir descends, organ fades]
[End]
```
