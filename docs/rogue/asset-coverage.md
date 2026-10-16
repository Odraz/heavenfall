# Rogue asset coverage

Revision 10, 2026-10-13. **Which game feature or event uses which file.** For implementers: every row has a source (a prompt in [art-prompts.md](art-prompts.md) / [audio-prompts.md](audio-prompts.md), or a reused/derived/coded treatment), a milestone and a fallback/current integration. `asset-manifest.md` tracks the real files. [game.md](game.md) and the catalogs own the mechanics. R02 art integration below awaits human review; see [the playtest follow-up](r02-playtest-report.md).

## Art coverage

| Feature | Files (prompt section) or treatment | Milestone | Fallback until delivered |
|---|---|---|---|
| Dominion | `dominion-design`, `-turnaround`, `-wings`, `-mace` (A1) → model → directional atlas | R2 | Integrated `scripts/blender/dominion.py` and 140 frames in `assets/sprites/dominion`; five angles mirror to eight, idle/walk/cast/pain/death. |
| Watchman | `watchman-design`, `-clarion`, `-aim` (A5) → the Blessed model with helmet, plume and Clarion → directional atlas; thread, muzzle flash, tracer and spark coded | R04 follow-up ([brief](r04-watchman.md)) | Integrated `scripts/blender/watchman.py` and 240 frames in `assets/sprites/watchman` (8 directions; idle, walk, cast = aim + fire, reload, pain, death). |
| Loot props | `amphora-tall`, `-squat`, `-lily` (B1); variant = canonical loot-socket index mod 3 (rooms.md §8); shared porcelain shards | R2 | Original cutouts integrated in the world atlas. |
| Marked amphora | `amphora-marked` (B1) + coded glint | R2 (look), R6 (Chart) | Original cutout integrated. |
| Blast prop | `sanctuary-lamp` (B1); fireball ring = `fx-ring` tinted, smoke = `fx-smoke` | R2 | Original cutout, extinguished/depleted tint and active glow; 15-second recharge. |
| Blessing prop | `blessing-chalice` (B1); heal ring = `fx-ring` green | R2 | Original cutout, green liquid fill/overflow and active glow; 15-second recharge. |
| Halos (ordinary coin 1, vase coin 3, gold halo 6) | `gold-halo` (B2), coin drawn smaller and paler | R2 | Original cutout with soft alpha, gentle bob/shrink and no additive glow. |
| Heal mote | `heal-mote` (B2, magenta background) | R2 | Magenta-keyed original cutout, bobbing and pooled green glow integrated. |
| Refiner's Fire | `tex-refiner-channel` (B10); gold rim = existing riser texture; pooled flames/embers = existing effects | R2 | Painted channel texture integrated; supplied `fx-flames` remains a future refinement. |
| All fire effects (Rain/Trial by Fire, burning floor, fire talents) | `fx-flames` + `ember` + `fx-glow`, tinted red-orange | R4–R5 | `fx-glow` |
| Incense (Cloud of Witnesses, talents) | existing `fx-smoke` tinted rusty gold | R2–R5 | — |
| The Pardoner's stall | `npc-pardoner`, `pardoner-box`, `shop-pedestal`, `chart-scroll` (B3); item on pedestal = the item's B7 sprite | R3 | coded pedestal; no figure |
| Items (world pickup, pedestal, HUD slot) | `item-<id>` (B7): one cutout per item; Claude composites the HUD icon on the ability-slot background | R3 | the item's name in the slot |
| Rite page | `rite-page` (B2); door/map plate "burning page" glyph is coded | R3 (plate), R4 (page) | coded page glyph |
| Confessional | `confessional-grille`, `tex-confessional-wood` (B4); the Advocate = the two ember eyes in the grille | R1 (shell), R4 | existing wall texture; a dark panel |
| Sundial | `sundial` (B5): HUD icon under the minimap and a Confessional prop | R6 | coded gnomon glyph |
| Key, Reliquary chest | `shared-key`, `reliquary-chest`, `-open` (B5); key beam and the chest's white/blue beam = `fx-beam` | R6 | coded key glyph; coded box |
| Bell of Judgment | `judgment-bell` (B5); chain and light shaft coded (`fx-chain` gold, `fx-lightshaft`) | R6 | coded bell glyph |
| Relics, combos | `relic-<id>` (B8); combo badge = its two relic icons + name, optional `combo-<id>` (B11) | R6 | name on the card |
| New abilities (Q/E slot) | `icon-<ability>` (B9), existing ability-icon style | R4 (Betrayer), R5 | ability name in the slot |
| Talent cards | optional `talent-<class>-<tree>-<node>` (B11); else tree glyph + name | R4–R5 | tree glyph + name |
| Gatekeeper's trumpet | `gatekeeper-trumpet`, `-trumpet-raised` (A2) → added to the Gatekeeper model, new raised pose | R7 | the existing Gatekeeper with a coded gold bar raised |
| Watchers, Seal | `watcher-open`, `watcher-closed`, `judgment-seal` (B6); red/grey rims, tethers and the held player's lift are coded | R7 | coded eye/lock glyphs |
| Rings, lanes, decals, timers, boundaries, telegraphs, seven state looks | runtime primitives and existing `fx-ring`, `fx-beam`, `fx-chain`, `fx-glow`, `fx-smoke`, `feather`, `spark`, `ember` | every milestone | — |
| Map, door sigils, reward plates, Edict/state/dormancy marks | coded vector glyphs: Breach broken chain; horde three heads; ranged orb; flyers wing; elite star; hazard flame; boss trumpet; Pardoner halo coin; Confessional horned eye behind a grille; Reliquary chest (gold closed, grey open); key; bell; Sundial gnomon. Edicts: Host mace and ranks; Penance crossed droplet; Swift Hymns fast orb; Poverty fading halo; Trumpet eye on a trumpet. Ground hoof is reserved for later heavens. | R1 (rooms), R3 (rewards), R6 (rest) | — |
| Door leaves | existing `tex-door`; the Reliquary leaf tinted white-gold; the Confessional leaf `tex-confessional-wood`; the boss leaf the existing gate art | R1 | — |
| Everything else (players, base enemies, Gatekeeper body, weapons, architecture, sky, menus, loading) | reused | — | — |

Export sizes, pivots, atlas angles/frames and memory are decided per batch from the actual consumer, not from the source image's size.

## Required recorded sound families

17 families × at least 3 distinct accepted takes = **51 keepers** ([game.md](game.md) §1.3). Required for R9; integrated from R2.

| Category | IDs | Existing event |
|---|---|---|
| Primaries and the censer's impact | `shotgun`, `censerLaunch`, `censerBreak`, `chaingun`, `revolver` | same names in `src/audio/sfx.ts` |
| Damaging secondaries and the dagger | `slug`, `scourge`, `silverBullet`, `daggerCut` | same names |
| Hits, deaths, mass kills | `hitTick`, `killTick`, `burstPop`, `massKill`, `blessedDeath` | same names; deaths stay aggregated and voice-limited |
| Breakables | `porcelainBreak`, `blastLampCrack`, `blastLampBurst` | new |

If another event turns out to repeat as often (likely `meleeHit`, `orbFired`, `arrowFired`, `goldPickup`), it gets 3 takes too; [audio-prompts.md](audio-prompts.md) already asks for them.

## Event-to-sound mapping

One game event plays one sound family; an alias is not a second event. New event names are finalized in their milestone.

| Game event (catalog or existing) | Sound family | Milestone |
|---|---|---|
| Room seals / clears | `doorsSeal` / `arenaCleared` | R1 |
| Dominion step / wind-up / slam; a canceled wind-up stops its sound; the slam plays on the accepted tick | `dominionStep` / `dominionTell` / `dominionSlam` | R2 |
| Watchman aim / shot; a canceled aim stops its note; the shot plays once per accepted `shot` counter change | `watchmanAim` / `watchmanShot` | R04 follow-up |
| Refiner's Fire flares at the seal / burns / dims at the clear | `refinerIgnite` / `refinerFire` loop / loop fade | R2 |
| Chalice heal | `chaliceHeal` | R2 |
| Halo / mote collected | `goldPickup` / `motePickup` | R2 |
| Marked amphora breaks; the Chart is applied | `porcelainBreak`, then `chartReveal` (R6; before that, `goldPickup` for its gold halo) | R2 / R6 |
| Purchase / refused interaction (never plays a success sound) | `purchase` / `interactionReject` | R3 |
| Chart bought | `chartReveal` | R3 |
| Item used: Balm, Seal, Feather | `item-balm`, `item-seal`, `item-feather` | R3 |
| Item thrown (Bitter Water, Ash, Plume) / landed | `item-throw` / `item-water-land`, `item-ash-land`, `item-plume-land` | R3 |
| Item placed: Mirror, Chain / Mirror returns a projectile | `item-mirror-place`, `item-chain-place` / `item-mirror-return` | R3 |
| Level up / low health / revive in progress / revive done | `levelUp` / `lowHealth` loop (replaces `heartbeat`) / `reviveHum` / `revive` | R3 |
| Rite page opened / Rite taken | `riteOffer` / `riteTaken` | R4 |
| A talent, item or relic **applies** a state: bound / airborne / lands / fire patch / fire area ends | `state-bind` / `state-launch` / `state-land` / `state-fire` / `fireOut`; never a sound per tick of membership | R3–R5 |
| Incense cloud | `incense` loop | R2 |
| Confessional | `confessionalAmbience` loop | R4 |
| The twelve alternatives | their S6 one-shots and S8 loops; Bread of Angels harvest = `motePickup`; Gatebreaker bursts = `burstPop`; Cast Out landings = `state-land`; Boundary Chain/Silver Wire binds = `state-bind` (≤4 per second); Way Back cuts = `daggerCut`; endings of fire = `fireOut` | R4–R5 |
| Talent shape changes (more pellets, wider cones, longer chains) | the native attack's own sound; no new event | R4–R5 |
| Talent payloads | fire → `state-fire`; bind → `state-bind`; launch/land → `state-launch`/`state-land`; incense → `incense`; revive/mote reactions → `revive`/`motePickup`; native damage → its attack family | R4–R5 |
| Key / chest / relic claim / bargain | `keyPickup` / `chestOpen` / `relicClaim` / `bargainAccept` | R6 |
| Bell rung / its wave arrives | `judgmentBell` / `hostDescend` | R6 |
| Pilgrim's Return channel / arrival | `teleportStart` / `teleportArrive` | R6 |
| Streak tier | `streakTier` (pitch per tier) | R6 |
| Relics: Usher's Badge, First Plea, Comb | `relic-rune` | R6 |
| Relics: Broken Thurible, Abandoned Mercy | `relic-ember` | R6 |
| Relics: Wheel of Review, Harrow of the Host | `relic-wheel` | R6 |
| Relics: Counterseal, Appeal in the Marble | `relic-stamp` | R6 |
| Relics: Choral Fragment, Broken Chorus | `relic-chorus` | R6 |
| Relics: Last Link, Petitioner's Tile, Last Plea, Unbroken Quill, Order of Expulsion, Reversal | `state-bind` / `state-launch` | R6 |
| Relic: Mercy's Wax | `shieldUp` | R6 |
| A combo replaces relic b's effect | relic b's sound is replaced too; never both | R6 |
| Gatekeeper: Judgment, Volley, Toll, Call, Seal, release, Watchers, Host, 50%, death | `judgmentCharge`/`judgmentBlast`, `volleyWindup`/`volleyFired`, `tollTell`/`tollImpact`/`tollPersonalWhoosh`, `callTell`, `sealBreak`, `callReleased`, `watcherOpen`/`watcherBreak`, `hostDescend`, `bossTransition`, `bossDefeat`; `interrupted` stays | R7 |
| Existing base abilities, enemy attacks, player state, UI | the existing synthesized cues, replaced by S9 recordings when they arrive | R8 |
| Existing `victory`, `defeat`, `buttonHover`, `fieldEntered`, `sacrament` | kept | — |

Never play: a bind sound every frame, a death voice per enemy in a crest, a purchase on refusal, a use sound when an item is stored, a second use sound on landing, or a warning after its cast was canceled. A reflected projectile reuses its sound; sound never creates a proc.

## Optional

- Music: the seven existing tracks stay; replacements use [music-prompts.md](../music-prompts.md).
- Voices: [audio-prompts.md](audio-prompts.md) S10 (recommended: skip for the slice). Never the only warning; subtitles always.

## Handoff rule

Each required row needs: source file, accepted game event, milestone, fallback, provenance. A missing required recording blocks R9; a missing readable cue blocks its own milestone. Before R9, every catalog row's *Visible effect* and *Sound* column is checked against what the game actually shows and plays. An asset is **observed** only after it's been seen or heard in the intended build.
