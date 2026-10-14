# Rogue asset manifest

Execution record from R0 ([r00.md](r00.md) stage 3), maintained by the AI from R0 onward. One row per asset named in [asset-coverage.md](asset-coverage.md); prompts are in [art-prompts.md](art-prompts.md) and [audio-prompts.md](audio-prompts.md), order and provenance rules in [asset-plan.md](asset-plan.md). Inventoried on 2026-10-12 at branch `rogue` against the files actually on disk. Paths in `sourcePath` and `runtimePath` exist; `—` means no file yet. New files go where [asset-plan.md](asset-plan.md) says: art sources in `assets/art-src/<assetId>.png` (model references in `assets/art-src/reference/`), sound sources in `assets/audio-src/sfx/<id>-NN.*` (loops in `loops/`, voices in `voice/`); a planned path that differs is written in `notes` as "(planned)". Art is requested from Gemini, audio from Suno Sounds or ElevenLabs; `generator`, `generatedAt` and `plan` (the subscription plan at generation time) record what was actually used, so they stay `—` until a file arrives. `required`: **yes** = must be in before R9 acceptance; **no** = has a synthesized or coded fallback.

**Statuses.** `requested`: new asset, not made yet (or coded treatment not built yet). `reuse-review`: an existing file the spec reuses; checked in context at its milestone. `received`: source takes on disk, not yet cut to a runtime file or connected to an event. `integrated-review`: source takes received, cut to runtime files and connected to their game event; awaiting listening acceptance in a real fight. `accepted`: seen or heard in the intended build and approved (no row has it yet; a file in a folder is not done).

**R03 runtime preview note.** The eight item source images, Pardoner portrait, Chart and Rite page are now referenced directly by the game. Their solid source backgrounds remain visible: these are source previews, not accepted cutouts. The box/pedestal art remains unintegrated; coded pedestals, ground-area outlines, Ward dome and Stair beam are the current fallbacks. Reward glyphs are implemented. Existing synthesized cues cover item use/landing/reflection and level-up; recording rows remain requested. Human visual/listening acceptance is open; no source provenance was invented.

**S1 provenance note.** The Suno takes have no provenance sidecars: `generatedAt` is the date of their first commit (`dc7c6c6`), and their exact prompt, generation date and hashes are still to be recorded. `plan` is from [asset-plan.md](asset-plan.md) ("Pro since at least 2026-10-11").

**Art receipt, 2026-10-12.** 27 user-provided JPEG/JFIF sources (4 model references, 23 game assets) converted to PNG at original resolution, with decoded pixels verified unchanged. Redundant original downloads were moved out of the source tree during the 2026-10-13 cleanup; normalized PNG sources are retained. Historical originals remain recoverable from Git and an ignored local archive at `tmp/asset-originals-2026-10-13/`. Generation tool, generation date and subscription plan remain unknown. No runtime art was exported or accepted; preparation notes and remaining sources are in [art-prompts.md](art-prompts.md#received-sources--2026-10-12).

**Art receipt, 2026-10-14.** A2, B5 and B8 received (19 sources); with the 14 JFIF sources supplied on 2026-10-13 (`shop-pedestal`, `item-plume`, all twelve B9 icons), 33 sources were converted to PNG at original resolution, with decoded pixels verified unchanged. Originals and SHA-256 hashes are in the ignored local archive `tmp/asset-originals-2026-10-14/`. Generation tool, generation date and subscription plan remain unknown. Only B6 (3 boss parts) is still missing. No new runtime art was exported or accepted; preparation notes are in [art-prompts.md](art-prompts.md#received-sources--2026-10-14).

**Historical R2.2 fallback, 2026-10-13.** All six B1 prop sources remain `received`; none is visually accepted. Inspected amphora/lamp sources have a solid green background requiring preparation. `src/client/props.ts` currently renders labeled coded ivory variants, a marked cross/glint, red-black lamp and gold chalice in one billboard atlas; accepted breaks drive shards, blast smoke/rings and heal feedback. The three S1 prop families now have named synthesized entries and accepted event mappings; their received MP3s still need runtime cutting in R2.3.

**Historical R2.6 fallback, 2026-10-13.** S1's 51 mono runtime takes, including all three prop families, are integrated and remain pending human listening acceptance. A1/B1/B2/B10 runtime art retains the documented coded presentation; received sources are preserved without implying approval. `src/client/spawnView.ts` supplies pooled gold warning beams/progress disks, with finite synthesized arrival and crest cues in `src/audio/sfx.ts`. Unintegrated S2 Dominion, S3 pickup and S8 fire recordings remain explicit synthesized fallbacks. No new generated art or recording is claimed.

**Current playtest integration, 2026-10-13.** Props, gold halos, motes and the Refiner channel now use the supplied art through `scripts/cutout.py`. The Dominion uses `scripts/blender/dominion.py` and a 140-frame atlas (five rendered directions mirrored to eight), following the original character pipeline. Active/depleted prop presentation is a per-instance shader with no extra texture upload. All remain pending human visual acceptance. The rows below supersede the historical fallback notes.

## Art: new

| assetId | kind | required | neededBy | status | sourcePath | runtimePath | events | generator | generatedAt | plan | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| dominion-design | model-ref | yes | R2 | received | `assets/art-src/reference/dominion-design.png` | — | Dominion enemy (via model) | — | — | — | A1 pilot; never shown in game; original archived locally and in Git history |
| dominion-turnaround | model-ref | yes | R2 | received | `assets/art-src/reference/dominion-turnaround.png` | — | Dominion enemy (via model) | — | — | — | A1; original archived locally and in Git history |
| dominion-wings | model-ref | yes | R2 | received | `assets/art-src/reference/dominion-wings.png` | — | Dominion enemy (via model) | — | — | — | A1; original archived locally and in Git history |
| dominion-mace | model-ref | yes | R2 | received | `assets/art-src/reference/dominion-mace.png` | — | Dominion enemy (via model) | — | — | — | A1; original archived locally and in Git history |
| cantor-design | model-ref | yes | R2 follow-up | received | `assets/art-src/reference/cantor-design.png` | — | Lectern Cantor enemy (via model) | — | — | — | A3 pilot; brown book and added wings, see art-prompts.md receipt notes; never shown in game; original archived locally |
| cantor-turnaround | model-ref | yes | R2 follow-up | received | `assets/art-src/reference/cantor-turnaround.png` | — | Lectern Cantor enemy (via model) | — | — | — | A3; wings included; never shown in game; original archived locally |
| cantor-hymnal | model-ref | yes | R2 follow-up | received | `assets/art-src/reference/cantor-hymnal.png` | — | Lectern Cantor enemy (via model) | — | — | — | A3; brown, not bronze; never shown in game; original archived locally |
| carrier-design | model-ref | yes | R2 follow-up | received | `assets/art-src/reference/carrier-design.png` | — | Stray-Carrier enemy (via model) | — | — | — | A4 pilot; never shown in game; original archived locally |
| carrier-turnaround | model-ref | yes | R2 follow-up | received | `assets/art-src/reference/carrier-turnaround.png` | — | Stray-Carrier enemy (via model) | — | — | — | A4; never shown in game; original archived locally |
| carrier-wings | model-ref | yes | R2 follow-up | received | `assets/art-src/reference/carrier-wings.png` | — | Stray-Carrier enemy (via model) | — | — | — | A4; half-spread, no true profile; never shown in game; original archived locally |
| carrier-shroud | model-ref | yes | R2 follow-up | received | `assets/art-src/reference/carrier-shroud.png` | — | Stray-Carrier enemy (via model) | — | — | — | A4; never shown in game; original archived locally |
| dominion-atlas | atlas | yes | R2 | integrated-review | `scripts/blender/dominion.py` | `assets/sprites/dominion/atlas.png` + `atlas.json` | idle/walk/cast/pain/death, eight runtime directions | local Blender model from supplied references | 2026-10-13 | — | Same shared materials, rig and renderer as the existing enemies; pending human acceptance |
| gatekeeper-trumpet | model-ref | yes | R7 | received | `assets/art-src/reference/gatekeeper-trumpet.png` | — | trumpet added to Gatekeeper model | — | — | — | A2; fallback: existing Gatekeeper with coded gold bar raised; see art-prompts.md 2026-10-14 receipt; original archived locally |
| gatekeeper-trumpet-raised | model-ref | yes | R7 | received | `assets/art-src/reference/gatekeeper-trumpet-raised.png` | — | Gatekeeper raised pose (50%) | — | — | — | A2; see art-prompts.md 2026-10-14 receipt; original archived locally |
| amphora-tall | sprite | yes | R2 | integrated-review | `assets/art-src/amphora-tall.png` | `assets/sprites/amphora-tall.png` | Host prop/pickup presentation | — | — | — | Prepared from supplied art; pending human visual acceptance |
| amphora-squat | sprite | yes | R2 | integrated-review | `assets/art-src/amphora-squat.png` | `assets/sprites/amphora-squat.png` | Host prop/pickup presentation | — | — | — | Prepared from supplied art; pending human visual acceptance |
| amphora-lily | sprite | yes | R2 | integrated-review | `assets/art-src/amphora-lily.png` | `assets/sprites/amphora-lily.png` | Host prop/pickup presentation | — | — | — | Prepared from supplied art; pending human visual acceptance |
| amphora-marked | sprite | yes | R2 (look), R6 (Chart) | integrated-review | `assets/art-src/amphora-marked.png` | `assets/sprites/amphora-marked.png` | Host prop/pickup presentation | — | — | — | Prepared from supplied art; pending human visual acceptance |
| sanctuary-lamp | sprite | yes | R2 | integrated-review | `assets/art-src/sanctuary-lamp.png` | `assets/sprites/sanctuary-lamp.png` | Host prop/pickup presentation | — | — | — | Prepared from supplied art; pending human visual acceptance |
| blessing-chalice | sprite | yes | R2 | integrated-review | `assets/art-src/blessing-chalice.png` | `assets/sprites/blessing-chalice.png` | Host prop/pickup presentation | — | — | — | Prepared from supplied art; pending human visual acceptance |
| gold-halo | sprite | yes | R2 | integrated-review | `assets/art-src/gold-halo.png` | `assets/sprites/gold-halo.png` | Host prop/pickup presentation | — | — | — | Prepared from supplied art; pending human visual acceptance |
| heal-mote | sprite | yes | R2 | integrated-review | `assets/art-src/heal-mote.png` | `assets/sprites/heal-mote.png` | Host prop/pickup presentation | — | — | — | Prepared from supplied art; pending human visual acceptance |
| rite-page | sprite | yes | R4 | received | `assets/art-src/rite-page.png` | — | Rite page pickup | — | — | — | B2; R3 door/map plate glyph is coded; original archived locally and in Git history |
| npc-pardoner | sprite | yes | R3 | received | `assets/art-src/npc-pardoner.png` | — | Pardoner's stall figure | — | — | — | B3; source portrait preview integrated; cutout pending; original archived locally and in Git history |
| pardoner-box | sprite | yes | R3 | received | `assets/art-src/pardoner-box.png` | — | Pardoner's stall | — | — | — | B3; original archived locally and in Git history |
| shop-pedestal | sprite | yes | R3 | received | `assets/art-src/shop-pedestal.png` | — | stall pedestal; item shown = its B7 sprite | — | — | — | B3; source on disk, cutout and runtime integration pending; fallback: coded pedestal |
| chart-scroll | sprite | yes | R3 | received | `assets/art-src/chart-scroll.png` | — | the Chart for sale | — | — | — | B3; original archived locally and in Git history |
| confessional-grille | sprite | yes | R1 (shell), R4 | received | `assets/art-src/confessional-grille.png` | — | Confessional; the Advocate = two ember eyes in it | — | — | — | B4; R1.5 visual check: stone surround and visible lit body detail fail the panel-only/eyes-only prompt; source preserved, no runtime export. R1.5 uses the brief's existing-wall fallback; original archived locally and in Git history |
| tex-confessional-wood | texture | yes | R1 (shell), R4 | received | `assets/art-src/tex-confessional-wood.png` | — | Confessional walls and door leaf | — | — | — | B4; R1.5 visual check: framed tops/bottoms do not join as a seamless vertical tile; source preserved, no runtime export. Existing wall texture retained; original archived locally and in Git history |
| shared-key | sprite | yes | R6 | received | `assets/art-src/shared-key.png` | — | key; beam = fx-beam | — | — | — | B5; fallback: coded key glyph; see art-prompts.md 2026-10-14 receipt; original archived locally |
| reliquary-chest | sprite | yes | R6 | received | `assets/art-src/reliquary-chest.png` | — | Reliquary closed; beam = fx-beam | — | — | — | B5; fallback: coded box; see art-prompts.md 2026-10-14 receipt; original archived locally |
| reliquary-chest-open | sprite | yes | R6 | received | `assets/art-src/reliquary-chest-open.png` | — | Reliquary open | — | — | — | B5; aligned with the closed chest; see art-prompts.md 2026-10-14 receipt; original archived locally |
| judgment-bell | sprite | yes | R6 | received | `assets/art-src/judgment-bell.png` | — | Bell of Judgment; chain and shaft coded | — | — | — | B5; fallback: coded bell glyph; see art-prompts.md 2026-10-14 receipt; original archived locally |
| sundial | sprite | yes | R6 | received | `assets/art-src/sundial.png` | — | HUD icon under minimap; Confessional prop | — | — | — | B5; fallback: coded gnomon glyph; see art-prompts.md 2026-10-14 receipt; original archived locally |
| watcher-open | sprite | yes | R7 | requested | — | — | Gatekeeper's Watchers | — | — | — | B6; rims, tethers coded; fallback: coded eye glyph |
| watcher-closed | sprite | yes | R7 | requested | — | — | Gatekeeper's Watchers | — | — | — | B6 |
| judgment-seal | sprite | yes | R7 | requested | — | — | Judgment Seal on a held player | — | — | — | B6; fallback: coded lock glyph |
| item-balm | icon | yes | R3 | received | `assets/art-src/item-balm.png` | — | Balm of the Rejected: pickup, pedestal, HUD slot | — | — | — | B7 pilot, magenta background; HUD icon composited by Claude; fallback: name in slot; original archived locally and in Git history |
| item-seal | icon | yes | R3 | received | `assets/art-src/item-seal.png` | — | Wax Seal of Sanctuary | — | — | — | B7; original archived locally and in Git history |
| item-feather | icon | yes | R3 | received | `assets/art-src/item-feather.png` | — | Pilgrim's Feather | — | — | — | B7; original archived locally and in Git history |
| item-mirror | icon | yes | R3 | received | `assets/art-src/item-mirror.png` | — | Mirror Ward | — | — | — | B7; original archived locally and in Git history |
| item-venom | icon | yes | R3 | received | `assets/art-src/item-venom.png` | — | Bitter Water | — | — | — | B7, magenta background; original archived locally and in Git history |
| item-frost | icon | yes | R3 | received | `assets/art-src/item-frost.png` | — | Ash of Stillness | — | — | — | B7; original archived locally and in Git history |
| item-chain | icon | yes | R3 | received | `assets/art-src/item-chain.png` | — | Chain Vial | — | — | — | B7; original archived locally and in Git history |
| item-plume | icon | yes | R3 | received | `assets/art-src/item-plume.png` | — | Plume of Expulsion | — | — | — | B7; source preview integrated, cutout and visual acceptance pending |
| relic-usher | icon | yes | R6 | received | `assets/art-src/relic-usher.png` | — | Usher's Badge | — | — | — | B8 pilot; fallback: name on card; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-thurible | icon | yes | R6 | received | `assets/art-src/relic-thurible.png` | — | Broken Thurible | — | — | — | B8; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-link | icon | yes | R6 | received | `assets/art-src/relic-link.png` | — | Last Link | — | — | — | B8; twisted link, soft burst beyond outline; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-tile | icon | yes | R6 | received | `assets/art-src/relic-tile.png` | — | Petitioner's Tile | — | — | — | B8; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-qseal | icon | yes | R6 | received | `assets/art-src/relic-qseal.png` | — | Seal of the First Plea | — | — | — | B8; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-eseal | icon | yes | R6 | received | `assets/art-src/relic-eseal.png` | — | Seal of the Last Plea | — | — | — | B8; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-comb | icon | yes | R6 | received | `assets/art-src/relic-comb.png` | — | Comb of the Host | — | — | — | B8; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-wheel | icon | yes | R6 | received | `assets/art-src/relic-wheel.png` | — | Wheel of Review | — | — | — | B8; twelve spokes, streaks outside outline; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-unbroken | icon | yes | R6 | received | `assets/art-src/relic-unbroken.png` | — | Unbroken Quill | — | — | — | B8; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-mercy | icon | yes | R6 | received | `assets/art-src/relic-mercy.png` | — | Mercy's Wax | — | — | — | B8; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-armageddon | icon | yes | R6 | received | `assets/art-src/relic-armageddon.png` | — | Choral Fragment | — | — | — | B8; see art-prompts.md 2026-10-14 receipt; original archived locally |
| relic-sentence3 | icon | yes | R6 | received | `assets/art-src/relic-sentence3.png` | — | Counterseal | — | — | — | B8; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-judas-coin | icon | yes | R4 | received | `assets/art-src/icon-judas-coin.png` | — | Judas Coin (Q/E slot) | — | — | — | B9 pilot; fallback: ability name in slot; inner frame to crop before pilot approval; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-way-back | icon | yes | R4 | received | `assets/art-src/icon-way-back.png` | — | The Way Back | — | — | — | B9; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-silver-wire | icon | yes | R4 | received | `assets/art-src/icon-silver-wire.png` | — | Silver Wire | — | — | — | B9; faint at 48 px; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-gatebreaker | icon | yes | R5 | received | `assets/art-src/icon-gatebreaker.png` | — | Gatebreaker | — | — | — | B9; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-rain-of-fire | icon | yes | R5 | received | `assets/art-src/icon-rain-of-fire.png` | — | Rain of Fire | — | — | — | B9; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-cast-out | icon | yes | R5 | received | `assets/art-src/icon-cast-out.png` | — | Cast Out | — | — | — | B9; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-bread-of-angels | icon | yes | R5 | received | `assets/art-src/icon-bread-of-angels.png` | — | Bread of Angels | — | — | — | B9; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-trial-by-fire | icon | yes | R5 | received | `assets/art-src/icon-trial-by-fire.png` | — | Trial by Fire | — | — | — | B9; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-cloud-of-witnesses | icon | yes | R5 | received | `assets/art-src/icon-cloud-of-witnesses.png` | — | Cloud of Witnesses | — | — | — | B9; figure lost at 48 px; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-well-of-giants | icon | yes | R5 | received | `assets/art-src/icon-well-of-giants.png` | — | The Well of the Giants | — | — | — | B9; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-ring-of-giants | icon | yes | R5 | received | `assets/art-src/icon-ring-of-giants.png` | — | Ring of the Giants | — | — | — | B9; see art-prompts.md 2026-10-14 receipt; original archived locally |
| icon-boundary-chain | icon | yes | R5 | received | `assets/art-src/icon-boundary-chain.png` | — | The Boundary Chain | — | — | — | B9; see art-prompts.md 2026-10-14 receipt; original archived locally |
| tex-refiner-channel | texture | yes | R2 | integrated-review | `assets/art-src/tex-refiner-channel.png` | `assets/textures/tex-refiner-channel.jpg` | Refiner channel floor; active flame and clear dim | — | — | — | Prepared from supplied art; pending human visual acceptance |
| fx-flames | texture | yes | R2 | received | `assets/art-src/fx-flames.png` | — | Refiner's Fire (scrolling); all fire effects R4–R5 | — | — | — | B10; fallback: fx-glow; original archived locally and in Git history |
| combo-expulsion | icon | no | R6 | requested | — | — | Order of Expulsion badge | — | — | — | B11 optional; default: combo badge (coded) |
| combo-abandoned | icon | no | R6 | requested | — | — | Abandoned Mercy badge | — | — | — | B11 optional |
| combo-chorus | icon | no | R6 | requested | — | — | Broken Chorus badge | — | — | — | B11 optional |
| combo-appeal | icon | no | R6 | requested | — | — | Appeal in the Marble badge | — | — | — | B11 optional |
| combo-reversal | icon | no | R6 | requested | — | — | Reversal of Judgment badge | — | — | — | B11 optional |
| combo-harrow | icon | no | R6 | requested | — | — | Harrow of the Host badge | — | — | — | B11 optional |
| talent-fallen-* (18) | icon | no | R5 | requested | — | — | Fallen talent cards | — | — | — | B11 optional; IDs in art-prompts.md; default: tree glyph + name |
| talent-heretic-* (18) | icon | no | R5 | requested | — | — | Heretic Saint talent cards | — | — | — | B11 optional |
| talent-binder-* (18) | icon | no | R5 | requested | — | — | Binder talent cards | — | — | — | B11 optional |
| talent-betrayer-* (18) | icon | no | R4 | requested | — | — | Betrayer talent cards | — | — | — | B11 optional |

## Art: reused

| assetId | kind | required | neededBy | status | sourcePath | runtimePath | events | generator | generatedAt | plan | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| fx-ring | texture | yes | R2 | reuse-review | `assets/art-src/fx-ring.png` | `assets/textures/fx-ring.png` | blast ring (red), chalice ring (gold), runtime rings; gold-halo fallback | — | — | — | pre-rogue art |
| fx-smoke | texture | yes | R2 | reuse-review | `assets/art-src/fx-smoke.png` | `assets/textures/fx-smoke.png` | blast smoke; incense (rusty gold) R2–R5 | — | — | — | pre-rogue art |
| fx-glow | texture | yes | R2 | reuse-review | `assets/art-src/fx-glow.png` | `assets/textures/fx-glow.png` | all fire effects; Refiner fallback | — | — | — | pre-rogue art |
| fx-beam | texture | yes | R6 | reuse-review | `assets/art-src/fx-beam.png` | `assets/textures/fx-beam.png` | key beam; chest white/blue beam | — | — | — | pre-rogue art |
| fx-chain | texture | yes | R6 | reuse-review | `assets/art-src/fx-chain.png` | `assets/textures/fx-chain.png` | Bell chain (gold); runtime chains | — | — | — | pre-rogue art |
| fx-lightshaft | texture | yes | R6 | reuse-review | `assets/art-src/fx-lightshaft.jfif` | `assets/textures/fx-lightshaft.png` | Bell light shaft | — | — | — | pre-rogue art |
| ember | sprite | yes | R2 | reuse-review | `assets/art-src/ember.png` | `assets/sprites/ember.png` | Refiner embers; all fire effects | — | — | — | pre-rogue art |
| spark | sprite | yes | R2 | reuse-review | `assets/art-src/spark.png` | `assets/sprites/spark.png` | runtime effects; heal-mote fallback (green) | — | — | — | pre-rogue art |
| feather | sprite | yes | R1 | reuse-review | `assets/art-src/feather.png` | `assets/sprites/feather.png` | runtime effects | — | — | — | pre-rogue art |
| tex-riser | texture | yes | R2 | reuse-review | `assets/art-src/tex-riser.png` | `assets/textures/tex-riser.jpg` | Refiner's Fire gold rim | — | — | — | pre-rogue art |
| tex-floor | texture | yes | R2 | reuse-review | `assets/art-src/tex-floor.png` | `assets/textures/tex-floor.jpg` | floors; Refiner fallback (tinted red) | — | — | — | pre-rogue art |
| tex-door | texture | yes | R1 | reuse-review | `assets/art-src/tex-door.png` | `assets/textures/tex-door.jpg` | door leaves; Reliquary leaf tinted white-gold | — | — | — | pre-rogue art |
| gate-leaves | texture | yes | R1 | reuse-review | `assets/art-src/gate-leaves.jfif` | `assets/textures/gate-leaves.webp` | boss door leaf | — | — | — | pre-rogue art |
| tex-wall | texture | yes | R1 | reuse-review | `assets/art-src/tex-wall.png` | `assets/textures/tex-wall.jpg` | Confessional fallback | — | — | — | coverage says "existing wall texture"; tex-wall assumed |
| blessed-atlas | atlas | yes | R1 | reuse-review | `assets/art-src/reference/blessed-front.jpg` | `assets/sprites/blessed/atlas.png` | base enemy; Dominion fallback | — | — | — | pre-rogue art |
| gatekeeper-atlas | atlas | yes | R7 | reuse-review | `assets/art-src/reference/gatekeeper-front.png`, `gatekeeper-turnaround.png` | `assets/sprites/gatekeeper/atlas.png` | boss body; gains A2 trumpet and raised pose | — | — | — | re-rendered in R7 |
| player-atlases | atlas | yes | R1 | reuse-review | `assets/art-src/reference/{fallen,heretic,binder,betrayer}-front.png` | `assets/sprites/{fallen,heretic,binder,betrayer}/atlas.png` | the four players | — | — | — | pre-rogue art |
| enemy-atlases | atlas | yes | R1 | reuse-review | `assets/art-src/reference/{chorister,cherub}-front.jpg` | `assets/sprites/{chorister,cherub}/atlas.png` | Chorister, Cherub | — | — | — | pre-rogue art |
| fp-weapons | sprite | yes | R1 | reuse-review | `assets/art-src/fp-*` | `assets/sprites/weapon-{fallen,heretic,binder,betrayer}/` | first-person weapons | — | — | — | pre-rogue art |
| architecture-kit | texture | yes | R1 | reuse-review | `assets/art-src/tex-*`, `gate-*` | `assets/textures/tex-*`, `arcade-*`, `gate-*` | marble/gold rooms (modular kit, no room paintings) | — | — | — | pre-rogue art |
| decorations | sprite | yes | R1 | reuse-review | `assets/art-src/decor-*.png` | `assets/sprites/decor-*.png` | room decorations | — | — | — | pre-rogue art |
| sky | texture | yes | R1 | reuse-review | `assets/art-src/sky-day.jfif` | `assets/textures/sky-day.jpg` | sky | — | — | — | pre-rogue art |
| base-icons | icon | yes | R1 | reuse-review | `assets/art-src/icon-*.png`, `class-*.png` | `assets/sprites/icon-*.png`, `class-*.png` | base ability and class icons | — | — | — | pre-rogue art |
| ui-frames | ui | yes | R1 | reuse-review | `assets/art-src/ui-*.png` | `assets/ui/ui-*`, `portrait-*.png` | menus, HUD frames | — | — | — | pre-rogue art |
| loading-cards | ui | yes | R1 | reuse-review | `assets/art-src/load-*` | `assets/ui/load-*.jpg` | loading screens | — | — | — | pre-rogue art |

## Audio: S1 required recordings

Each family needs 3 accepted takes (51 keepers); runtime WAVs load through `src/audio/recorded.ts` and play from `src/client/sounds.ts` while the Recorded SFX setting is on (default on; F8 toggles).

R2.3 runtime inventory: all **17 families / 51 WAVs** exist and are connected. Nine prop WAVs were cut from the received keepers with the existing tool; all sources/spares are preserved. Runtime audit found mono 48-kHz 16-bit, nonempty, <=1-second files; the nine MP3 SHA-256 hashes match their committed LFS OIDs. No new provider generation or paid request ran. Listening/readability acceptance remains pending. S2 Dominion/fire, S3 pickups/chalice and S8 fire/incense recordings are still missing; their named synthesized entries exist in `src/audio/sfx.ts`. Pickup/chalice, Dominion and fire event consumers are connected as of R2.5, including the room-local fire ambient fallback. R2.7 rechecked the 51-file runtime inventory; no new asset was processed or accepted.

| assetId | kind | required | neededBy | status | sourcePath | runtimePath | events | generator | generatedAt | plan | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| chaingun | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/chaingun-01..03.mp3` | `assets/sfx/chaingun-01..03.wav` | `chaingun` (Binder primary) | Suno Sounds | 2026-10-12 | Pro | pilot; pilot cuts also in `sfx/cut/` |
| shotgun | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/shotgun-01..03.mp3` | `assets/sfx/shotgun-01..03.wav` | `shotgun` (Fallen primary) | Suno Sounds | 2026-10-12 | Pro | — |
| slug | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/slug-01..03.mp3` | `assets/sfx/slug-01..03.wav` | `slug` (Fallen secondary) | Suno Sounds | 2026-10-12 | Pro | — |
| censerLaunch | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/censerLaunch-01..03.mp3` | `assets/sfx/censerLaunch-01..03.wav` | `censerLaunch` (Heretic primary) | Suno Sounds | 2026-10-12 | Pro | 2 spares in `sfx/spare/` |
| censerBreak | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/censerBreak-01..03.mp3` | `assets/sfx/censerBreak-01..03.wav` | `censerBreak` (censer hits) | Suno Sounds | 2026-10-12 | Pro | 1 spare |
| revolver | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/revolver-01..03.mp3` | `assets/sfx/revolver-01..03.wav` | `revolver` (Betrayer primary) | Suno Sounds | 2026-10-12 | Pro | — |
| silverBullet | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/silverBullet-01..03.mp3` | `assets/sfx/silverBullet-01..03.wav` | `silverBullet` (Betrayer secondary) | Suno Sounds | 2026-10-12 | Pro | 1 spare |
| scourge | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/scourge-01..03.mp3` | `assets/sfx/scourge-01..03.wav` | `scourge` (Binder secondary) | Suno Sounds | 2026-10-12 | Pro | accepted for now but not liked; 1 spare |
| daggerCut | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/daggerCut-01..03.mp3` | `assets/sfx/daggerCut-01..03.wav` | `daggerCut` (Shadowstep cuts; later Way Back) | Suno Sounds | 2026-10-12 | Pro | 1 spare |
| hitTick | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/hitTick-01..03.mp3` | `assets/sfx/hitTick-01..03.wav` | `hitTick` (your shot hit) | Suno Sounds | 2026-10-12 | Pro | 1 spare |
| killTick | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/killTick-01..03.mp3` | `assets/sfx/killTick-01..03.wav` | `killTick` (your shot killed) | Suno Sounds | 2026-10-12 | Pro | 1 spare |
| burstPop | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/burstPop-01..03.mp3` | `assets/sfx/burstPop-01..03.wav` | `burstPop` (angel bursts; later Gatebreaker bursts) | Suno Sounds | 2026-10-12 | Pro | 1 spare |
| blessedDeath | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/blessedDeath-01..03.mp3` | `assets/sfx/blessedDeath-01..03.wav` | `blessedDeath` (aggregated, voice-limited) | Suno Sounds | 2026-10-12 | Pro | 1 spare |
| massKill | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/massKill-01..03.mp3` | `assets/sfx/massKill-01..03.wav` | `massKill` (one per crest) | Suno Sounds | 2026-10-12 | Pro | accepted for now but not liked; 2 spares |
| porcelainBreak | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/porcelainBreak-01..03.mp3` | `assets/sfx/porcelainBreak-01..03.wav` | amphora breaks; marked amphora (then `chartReveal` R6) | Suno Sounds | 2026-10-12 | Pro | R2.3 cut and connected; human ear approval pending; 1 spare |
| blastLampCrack | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/blastLampCrack-01..03.mp3` | `assets/sfx/blastLampCrack-01..03.wav` | lamp hit (bursts 0.2 s later) | Suno Sounds | 2026-10-12 | Pro | R2.3 cut and connected; human ear approval pending; 1 spare |
| blastLampBurst | sfx | yes | R2 | integrated-review | `assets/audio-src/sfx/blastLampBurst-01..03.mp3` | `assets/sfx/blastLampBurst-01..03.wav` | lamp explodes | Suno Sounds | 2026-10-12 | Pro | R2.3 cut and connected; human ear approval pending; 1 spare |

## Audio: new events (S2–S8)

R2.5: `src/client/hazards.ts` supplies pooled coded red-orange motion/ground glow and narrow gold channel edges. Received B10 sources remain preserved, without runtime texture/flame export or human visual acceptance. `refinerIgnite` and a finite voice-capped room-local `refinerFire` synth are connected; S8 recordings remain missing. Active/dim captures were inspected in production Chromium. This does not mark the requested art/audio assets delivered or accepted.

All have a synthesized fallback (`required` = no), but a missing readable cue blocks its own milestone. `keep` = takes needed.

| assetId | kind | required | neededBy | status | sourcePath | runtimePath | events | generator | generatedAt | plan | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| doorsSeal | sfx | no | R1 | requested | — | — | room seals | — | — | — | S2, keep 1; synth cue exists in `sfx.ts` |
| arenaCleared | sfx | no | R1 | requested | — | — | room cleared | — | — | — | S2, keep 1; synth cue exists |
| dominionStep | sfx | no | R2 | requested | — | — | Dominion step | — | — | — | S2, keep 2 |
| dominionTell | sfx | no | R2 | requested | — | — | mace wind-up; stops if canceled | — | — | — | S2, keep 1 |
| dominionSlam | sfx | no | R2 | requested | — | — | mace slam, on the accepted tick | — | — | — | S2, keep 2 |
| refinerIgnite | sfx | no | R2 | requested | — | — | Refiner's Fire flares at the seal | — | — | — | S2, keep 1 |
| chaliceHeal | sfx | no | R2 | requested | — | — | chalice heal | — | — | — | S2, keep 1 |
| goldPickup | sfx | no | R2 | requested | — | — | halo collected; marked amphora's halo until R6 | — | — | — | S3, keep 3 (frequent) |
| motePickup | sfx | no | R2 | requested | — | — | mote collected; Bread of Angels harvest | — | — | — | S3, keep 2 |
| purchase | sfx | no | R3 | requested | — | — | purchase (never on refusal) | — | — | — | S3, keep 1 |
| interactionReject | sfx | no | R3 | requested | — | — | refused interaction | — | — | — | S3, keep 1 |
| chartReveal | sfx | no | R3 | requested | — | — | Chart bought; Chart applied (R6) | — | — | — | S3, keep 1 |
| item-balm | sfx | no | R3 | requested | — | — | Balm used | — | — | — | S4, keep 1 |
| item-seal | sfx | no | R3 | requested | — | — | Wax Seal used | — | — | — | S4, keep 1 |
| item-feather | sfx | no | R3 | requested | — | — | Feather used | — | — | — | S4, keep 1 |
| item-throw | sfx | no | R3 | requested | — | — | Bitter Water, Ash, Plume thrown | — | — | — | S4, keep 1 |
| item-mirror-place | sfx | no | R3 | requested | — | — | Mirror Ward placed | — | — | — | S4, keep 1 |
| item-mirror-return | sfx | no | R3 | requested | — | — | Mirror returns a projectile | — | — | — | S4, keep 1 |
| item-water-land | sfx | no | R3 | requested | — | — | Bitter Water lands | — | — | — | S4, keep 1 |
| item-ash-land | sfx | no | R3 | requested | — | — | Ash lands | — | — | — | S4, keep 1 |
| item-chain-place | sfx | no | R3 | requested | — | — | Chain Vial placed | — | — | — | S4, keep 1 |
| item-plume-land | sfx | no | R3 | requested | — | — | Plume lands | — | — | — | S4, keep 1 |
| levelUp | sfx | no | R3 | requested | — | — | level gained | — | — | — | S5, keep 1 |
| riteOffer | sfx | no | R4 | requested | — | — | Rite page opened | — | — | — | S5, keep 1 |
| riteTaken | sfx | no | R4 | requested | — | — | Rite taken | — | — | — | S5, keep 1 |
| keyPickup | sfx | no | R6 | requested | — | — | key taken | — | — | — | S5, keep 1 |
| chestOpen | sfx | no | R6 | requested | — | — | Reliquary opened | — | — | — | S5, keep 1 |
| relicClaim | sfx | no | R6 | requested | — | — | relic claimed | — | — | — | S5, keep 1 |
| bargainAccept | sfx | no | R6 | requested | — | — | Advocate's bargain signed | — | — | — | S5, keep 1 |
| judgmentBell | sfx | no | R6 | requested | — | — | Bell rung | — | — | — | S5, keep 1 |
| teleportStart | sfx | no | R6 | requested | — | — | Pilgrim's Return channel | — | — | — | S5, keep 1 |
| teleportArrive | sfx | no | R6 | requested | — | — | Pilgrim's Return arrival | — | — | — | S5, keep 1 |
| streakTier | sfx | no | R6 | requested | — | — | streak tier (pitch per tier) | — | — | — | S5, keep 1 |
| state-bind | sfx | no | R3 | requested | — | — | bound applied; Boundary Chain/Silver Wire binds (≤4/s); bind relics | — | — | — | S5, keep 2; never per tick |
| state-launch | sfx | no | R4 | requested | — | — | airborne applied; launch relics | — | — | — | S5, keep 1 |
| state-land | sfx | no | R4 | requested | — | — | flung enemy lands; Cast Out landings | — | — | — | S5, keep 2 |
| state-fire | sfx | no | R4 | requested | — | — | fire patch applied | — | — | — | S5, keep 1 |
| fireOut | sfx | no | R4 | requested | — | — | fire area ends | — | — | — | S5, keep 1 |
| relic-rune | sfx | no | R6 | requested | — | — | Usher's Badge, First Plea, Comb | — | — | — | S5, keep 1 |
| relic-ember | sfx | no | R6 | requested | — | — | Broken Thurible, Abandoned Mercy | — | — | — | S5, keep 1 |
| relic-wheel | sfx | no | R6 | requested | — | — | Wheel of Review, Harrow of the Host | — | — | — | S5, keep 1 |
| relic-stamp | sfx | no | R6 | requested | — | — | Counterseal, Appeal in the Marble | — | — | — | S5, keep 1 |
| relic-chorus | sfx | no | R6 | requested | — | — | Choral Fragment, Broken Chorus | — | — | — | S5, keep 1 |
| judasCoinSpin | sfx | no | R4 | requested | — | — | Judas Coin flicked | — | — | — | S6, keep 1 |
| judasCoinSplit | sfx | no | R4 | requested | — | — | shot splits on the coin | — | — | — | S6, keep 1 |
| wayBackMarker | sfx | no | R4 | requested | — | — | Way Back shadow left | — | — | — | S6, keep 1 |
| wayBackReturn | sfx | no | R4 | requested | — | — | Way Back dash back | — | — | — | S6, keep 1 |
| silverWirePlace | sfx | no | R4 | requested | — | — | Silver Wire strung | — | — | — | S6, keep 1 |
| gatebreakerStart | sfx | no | R5 | requested | — | — | Gatebreaker charge begins | — | — | — | S6, keep 1 |
| gatebreakerWall | sfx | no | R5 | requested | — | — | Gatebreaker stopped by a wall | — | — | — | S6, keep 1 |
| rainOfFireStart | sfx | no | R5 | requested | — | — | Rain of Fire called | — | — | — | S6, keep 1 |
| castOut | sfx | no | R5 | requested | — | — | Cast Out wing blast | — | — | — | S6, keep 1 |
| trialByFireStart | sfx | no | R5 | requested | — | — | Trial by Fire begins | — | — | — | S6, keep 1 |
| cloudOfWitnessesStart | sfx | no | R5 | requested | — | — | Cloud of Witnesses gathers | — | — | — | S6, keep 1 |
| wellOfGiantsStart | sfx | no | R5 | requested | — | — | Well of the Giants opens | — | — | — | S6, keep 1 |
| ringOfGiants | sfx | no | R5 | requested | — | — | Ring of the Giants | — | — | — | S6, keep 1 |
| boundaryChain | sfx | no | R5 | requested | — | — | Boundary Chain laid | — | — | — | S6, keep 1 |
| judgmentCharge | sfx | no | R7 | requested | — | — | Judgment: 3 s to hide | — | — | — | S7, keep 1; synth cue exists |
| judgmentBlast | sfx | no | R7 | requested | — | — | Judgment strikes | — | — | — | S7, keep 1; synth cue exists |
| volleyWindup | sfx | no | R7 | requested | — | — | Orb Volley gathers | — | — | — | S7, keep 1; synth cue exists |
| volleyFired | sfx | no | R7 | requested | — | — | Orb Volley released | — | — | — | S7, keep 1; synth cue exists |
| tollTell | sfx | no | R7 | requested | — | — | Toll prepares | — | — | — | S7, keep 1 |
| tollImpact | sfx | no | R7 | requested | — | — | Toll strikes, ring rolls out | — | — | — | S7, keep 1 |
| tollPersonalWhoosh | sfx | no | R7 | requested | — | — | ring about to reach you | — | — | — | S7, keep 1 |
| callTell | sfx | no | R7 | requested | — | — | Called to the Gate | — | — | — | S7, keep 1 |
| sealBreak | sfx | no | R7 | requested | — | — | Seal breaks | — | — | — | S7, keep 1 |
| callReleased | sfx | no | R7 | requested | — | — | held player set down | — | — | — | S7, keep 1 |
| watcherOpen | sfx | no | R7 | requested | — | — | Watchers open | — | — | — | S7, keep 1 |
| watcherBreak | sfx | no | R7 | requested | — | — | Watcher shot apart | — | — | — | S7, keep 1 |
| hostDescend | sfx | no | R6 | requested | — | — | Host arrives; Bell's wave (R6) | — | — | — | S7, keep 1; first used by the Bell in R6 |
| bossTransition | sfx | no | R7 | requested | — | — | 50%: trumpet lifted | — | — | — | S7, keep 1 |
| bossDefeat | sfx | no | R7 | requested | — | — | Gatekeeper falls | — | — | — | S7, keep 1 |
| refinerFire | loop | no | R2 | requested | — | — | Refiner's Fire burning; fades at the clear | — | — | — | S8 |
| incense | loop | no | R2 | requested | — | — | censer cloud; incense talents | — | — | — | S8 |
| lowHealth | loop | no | R3 | requested | — | — | low health | — | — | — | S8; replaces synth `heartbeat` |
| reviveHum | loop | no | R3 | requested | — | — | revive in progress | — | — | — | S8; synth cue exists |
| confessionalAmbience | loop | no | R4 | requested | — | — | Confessional air | — | — | — | S8 |
| gatebreakerMove | loop | no | R5 | requested | — | — | Gatebreaker charging | — | — | — | S8 |
| rainOfFire | loop | no | R5 | requested | — | — | Rain of Fire burning, 6 s | — | — | — | S8 |
| trialByFire | loop | no | R5 | requested | — | — | Trial by Fire, 4 s | — | — | — | S8 |
| breadOfAngels | loop | no | R5 | requested | — | — | Bread of Angels, 6 s | — | — | — | S8 |
| cloudOfWitnesses | loop | no | R5 | requested | — | — | Cloud of Witnesses | — | — | — | S8 |
| wellOfGiants | loop | no | R5 | requested | — | — | Well of the Giants pulling, 5 s | — | — | — | S8 |
| silverWire | loop | no | R4 | requested | — | — | Silver Wire strung | — | — | — | S8 |

## Audio: S9 re-recordings (recommended)

Each replaces an existing synthesized cue in `src/audio/sfx.ts`; nothing breaks without it.

| assetId | kind | required | neededBy | status | sourcePath | runtimePath | events | generator | generatedAt | plan | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| meleeHit | sfx | no | R8 | requested | — | — | enemy melee blow | — | — | — | keep 3 |
| orbFired | sfx | no | R8 | requested | — | — | Chorister orb | — | — | — | keep 3 |
| arrowFired | sfx | no | R8 | requested | — | — | Cherub arrow | — | — | — | keep 3 |
| choristerWindup | sfx | no | R8 | requested | — | — | Chorister wind-up | — | — | — | keep 1 |
| cherubWindup | sfx | no | R8 | requested | — | — | Cherub wind-up | — | — | — | keep 1 |
| globeShatter | sfx | no | R8 | requested | — | — | globe shatters | — | — | — | keep 1 |
| blasphemy | sfx | no | R8 | requested | — | — | Fallen Q | — | — | — | keep 1 |
| fallingStarLeap | sfx | no | R8 | requested | — | — | Falling Star leap | — | — | — | keep 1 |
| fallingStarLand | sfx | no | R8 | requested | — | — | Falling Star landing | — | — | — | keep 1 |
| communion | sfx | no | R8 | requested | — | — | Heretic Q | — | — | — | keep 1 |
| shroud | sfx | no | R8 | requested | — | — | Heretic E | — | — | — | keep 1 |
| shroudBurst | sfx | no | R8 | requested | — | — | Shroud burst | — | — | — | keep 1 |
| chains | sfx | no | R8 | requested | — | — | Binder Q | — | — | — | keep 1 |
| discord | sfx | no | R8 | requested | — | — | Binder E | — | — | — | keep 1 |
| fieldOfBlood | sfx | no | R8 | requested | — | — | Betrayer Q | — | — | — | keep 1 |
| shadowstep | sfx | no | R8 | requested | — | — | Betrayer E | — | — | — | keep 1 |
| healed | sfx | no | R8 | requested | — | — | healed | — | — | — | keep 1 |
| shieldUp | sfx | no | R8 | requested | — | — | shield up; Mercy's Wax (R6) | — | — | — | keep 1 |
| shieldBroken | sfx | no | R8 | requested | — | — | shield broken | — | — | — | keep 1 |
| interrupted | sfx | no | R8 | requested | — | — | cast interrupted (stays at R7) | — | — | — | keep 1 |
| revive | sfx | no | R8 | requested | — | — | revive done; revive talent reactions | — | — | — | keep 1 |
| hurt | sfx | no | R8 | requested | — | — | player hurt | — | — | — | keep 1 |
| death | sfx | no | R8 | requested | — | — | player death | — | — | — | keep 1 |
| abilityReady | sfx | no | R8 | requested | — | — | ability ready | — | — | — | keep 1 |
| countdownTick | sfx | no | R8 | requested | — | — | countdown tick | — | — | — | keep 1 |
| buttonClick | sfx | no | R8 | requested | — | — | UI click | — | — | — | keep 1 |

## Audio: reused and optional

| assetId | kind | required | neededBy | status | sourcePath | runtimePath | events | generator | generatedAt | plan | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| victory | synth | yes | — | reuse-review | — | `src/audio/sfx.ts` | `victory` | — | — | — | kept as is |
| defeat | synth | yes | — | reuse-review | — | `src/audio/sfx.ts` | `defeat` | — | — | — | kept as is |
| buttonHover | synth | yes | — | reuse-review | — | `src/audio/sfx.ts` | `buttonHover` | — | — | — | kept as is |
| fieldEntered | synth | yes | — | reuse-review | — | `src/audio/sfx.ts` | `fieldEntered` | — | — | — | kept as is |
| sacrament | synth | yes | — | reuse-review | — | `src/audio/sfx.ts` | `sacrament` (Heretic secondary) | — | — | — | kept as is |
| music | music | yes | — | reuse-review | — | `assets/music/{arena-1,arena-2,arena-3,boss,calm,defeat,victory}.mp3` | music tracks | — | — | — | seven tracks stay; replacements via `docs/music-prompts.md` |
| voice-gatekeeper-* (4) | voice | no | R7 | requested | — | — | enter, call, phase2, victory lines | — | — | — | S10 optional; skip advised for the slice; subtitles always |
| voice-advocate-* (3) | voice | no | R6 | requested | — | — | greet, bargain, decline lines | — | — | — | S10 optional; skip advised |
| voice-pardoner-* (2) | voice | no | R3 | requested | — | — | greet, purchase lines | — | — | — | S10 optional; skip advised |
| voice-announcer-* (5) | voice | no | R6 | requested | — | — | streak tiers | — | — | — | S10 optional; skip advised |

## Coded treatments

Drawn in code by Claude; no image is generated for them.

| assetId | kind | required | neededBy | status | sourcePath | runtimePath | events | generator | generatedAt | plan | notes |
|---|---|---|---|---|---|---|---|---|---|---|---|
| runtime-primitives | coded | yes | every milestone | requested | — | — | rings, lanes, decals, timers, boundaries, telegraphs, seven state looks | code | — | — | uses fx-ring, fx-beam, fx-chain, fx-glow, fx-smoke, feather, spark, ember |
| room-sigils | coded | yes | R1 | requested | — | — | map and door glyphs: Breach broken chain, horde three heads, ranged orb, flyers wing, elite star, hazard flame, boss trumpet | code | — | — | ground hoof reserved for later heavens |
| reward-sigils | coded | yes | R3 | requested | — | — | Pardoner halo coin, Confessional horned eye behind grille, Rite burning page | code | — | — | — |
| rest-sigils | coded | yes | R6 | requested | — | — | Reliquary chest (gold closed, grey open), key, bell, Sundial gnomon | code | — | — | — |
| edict-marks | coded | yes | R6 | requested | — | — | Host mace and ranks, Penance crossed droplet, Swift Hymns fast orb, Poverty fading halo, Trumpet eye on a trumpet | code | — | — | — |
| marked-amphora-glint | coded | yes | R2 | integrated-review | `src/client/props.ts` | `src/client/props.ts` | glint every 3 s on amphora-marked | code | — | — | R2.2 implemented; R2.7 status audit corrected the stale requested row; human readability acceptance pending |
| bell-chain-shaft | coded | yes | R6 | requested | — | — | Bell chain (fx-chain gold) and light shaft (fx-lightshaft) | code | — | — | — |
| watcher-rims-tethers | coded | yes | R7 | requested | — | — | Watcher red/grey rims, tethers, held player's lift | code | — | — | — |
| combo-badge | coded | yes | R6 | requested | — | — | combo card: its two relic icons + name | code | — | — | replaced by optional combo-* emblems |
| talent-card-glyph | coded | yes | R4–R5 | requested | — | — | talent card: tree glyph + name | code | — | — | replaced by optional talent-* icons |

## October 14 R03 transparent runtime follow-up

The eight consumables plus Chart, Rite page and Pardoner now use alpha-enabled assets from `assets/items/` instead of raw chroma-backed source previews. Originals remain in `assets/art-src/`. Built-in imagegen performed background extraction per asset; exact prompts and runtime paths are recorded in [r03-followup.md](r03-followup.md). Renderer alpha is enabled for world pickups and shop sprites. Automated alpha inspection and production screenshot review belong to the follow-up evidence; human aesthetic acceptance remains separate.
