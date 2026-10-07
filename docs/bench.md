# Benchmark results

`npm run bench` (§12) on the agent's machine. Targets: average FPS ≥ 58, average simulation ms per tick ≤ 8.

| Date | Milestone | Commit | FPS | 1%-low FPS | Sim ms (avg) | Sim ms (max) | Result |
|---|---|---|---|---|---|---|---|
| 2026-10-04 | M6 (final art) | 88fd59c | 59.84 | 50.65 | 3.77 | 10.6 | Pass |
| 2026-10-04 | M7 (multiplayer) | 189bae9 | 59.63 | 39.57 | 3.78 | 8.8 | Pass |
| 2026-10-05 | M8.3 (audio) | 179b1f4 + stage 3 | 59.18 | 29.15 | 2.6 | 6.7 | Pass |
| 2026-10-05 | M8.5 (joining and chat) | 6db61d6 + stage 5 | 28.22 | 1 | 4.23 | 10.8 | Sim: pass. FPS: not measured (window throttled, see below) |
| 2026-10-06 | M9.2 (abilities) | 8a43245 + stage 2 | 0.97 | 1 | 3.44 | 6.3 | Sim: pass. FPS: not measured (window throttled, see below) |
| 2026-10-06 | M9 (rerun by the human) | b5d1d34 | 59.5 | 36.99 | 2.29 | 9.3 | Pass |

Machine: Intel Iris Xe Graphics (0x46A6), ANGLE Direct3D11, hardware GPU (FPS counts). Browser: Playwright's Chromium 153.0.8010.12, headed, 1920 × 1080.

M8.3: the first run after the audio stage measured 0.99 FPS with normal simulation times (4.8 ms), a sign the window was hidden or throttled; the rerun above is the recorded result. Its lower 1%-low is likely the music track decoding at the start, which can overlap the measurement.

M8.5: two runs measured 24.3 and 28.22 FPS with a 1%-low of 1 FPS (one-second frames) and normal simulation times (3.37 and 4.23 ms). The committed stage 4 code, run right after under the same conditions, measured 0.97 FPS, so the headed benchmark window was being throttled by the desktop (locked or covered), as in the first M8.3 run; the FPS numbers aren't a measurement of the game. Stage 5 adds no per-frame rendering work (the chat is DOM shown only with messages). The FPS rerun needs an active, uncovered desktop.

M9.2: the run measured 0.97 FPS with a 1%-low of 1 FPS and normal simulation times (3.44 ms average, 6.3 ms max), the same signs of a throttled headed window as M8.5. Stage 2 adds per-frame work only while a Field of Blood is down (one pool mesh of about 150 quads, a glare cylinder, 12 embers per second, 30 coins for 0.3 s), none in the benchmark. The FPS rerun needs an active, uncovered desktop. The human reran it on an uncovered desktop after stage 3 (the row above): 59.5 FPS passes the 58 FPS target.

## M10 performance gate

`sh scripts/bench-gate.sh` (M10 §2.3): each run is `npm run bench` uncapped (`--uncapped`: Chromium's frame-rate limit and vsync off; median of 3 runs, 60 s cool-down before each, since the laptop throttles under back-to-back runs) and capped (one run). The flags do uncap the frame rate on this machine (about 140 FPS). A stage passes when every run has capped FPS ≥ 58, simulation ≤ 8 ms, and uncapped frame time ≤ 6% above the previous stage (≤ 10% above the baseline after the last stage). Calls, triangles and texture MB are the renderer's numbers in the last measured frame of the uncapped arcade run (texture MB: estimated GPU memory of the scene's textures, mipmaps included).

| Date | Stage | Commit | Run | Frame ms (uncapped, median) | Spread | FPS (capped) | 1%-low (capped) | Sim ms (avg) | Draw calls | Triangles | Texture MB | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-06 | M10 baseline | 44b37d7 | sandbox | 7.13 | 1.7% | 59.5 | 34.75 | 2.02 | 7 | 7 432 | 274.4 | — |
| 2026-10-06 | M10 baseline | 44b37d7 | pearly-gates | 7.17 | 0.7% | 59.42 | 31.72 | 1.95 | 7 | 25 100 | 274.4 | — |
| 2026-10-06 | M10 baseline | 44b37d7 | pearly-gates arcade | 7.21 | 0.8% | 59.71 | 42.82 | 1.87 | 8 | 25 124 | 274.4 | — |
| 2026-10-06 | M10.1 (gate and sky) | 2aa4544 | sandbox | 6.84 (5 runs) | 76% (one run disturbed by a type check, 12.06 ms) | 59.61 | 38.16 | 1.81 | 7 | 7 432 | 293.7 | Pass |
| 2026-10-06 | M10.1 (gate and sky) | 2aa4544 | pearly-gates | 7.00 | 0.1% | 59.94 | 58.79 | 1.86 | 7 | 25 100 | 293.7 | Pass |
| 2026-10-06 | M10.1 (gate and sky) | 2aa4544 | pearly-gates arcade | 7.10 | 0.8% | 59.94 | 58.94 | 1.85 | 8 | 25 124 | 293.7 | Pass |

M10.1: the sky texture adds 19.3 MB (2 701 × 1 344, mipmapped) and no draw call (the dome replaces the gradient dome). The capped Pearly Gates run first measured 7.67 ms of simulation on average (20 ms max), a sign of other work on the machine; its rerun (above) measured 4.0 ms. Drawing the sky first instead of last (§2.2): 6.95 ms against 7.10 ms on the arcade view (median of 3 each), so it's drawn first from stage 2.
| 2026-10-06 | M10.2 (open edges) | f42aa18 | sandbox | 7.19 | 0.7% | 59.61 | 38.34 | 1.80 | 7 | 8 642 | 293.7 | Pass (+5.1% on M10.1's 5-run median; +3.2% on its first 3 runs) |
| 2026-10-06 | M10.2 (open edges) | f42aa18 | pearly-gates | 7.27 | 2.9% | 59.93 | 58.79 | 1.89 | 7 | 30 464 | 293.7 | Pass (+3.9%) |
| 2026-10-06 | M10.2 (open edges) | f42aa18 | pearly-gates arcade | 7.22 | 0.4% | 59.82 | 48.5 | 1.82 | 8 | 30 494 | 293.7 | Pass (+1.7%) |

M10.2: in both the M10.1 and M10.2 gates the capped Pearly Gates run (always the 4th run of the sequence) measured about 7.7–7.9 ms of simulation on average where the runs before and after measured under 4; rerun alone on an idle desktop it measured 3.97 and 3.96 ms (59.93 FPS, recorded above). Something on the machine runs at that point; the simulation itself is unchanged. The capped runs' simulation time is about twice the uncapped runs' (about 4 against 2 ms): with the frame rate capped the CPU runs at lower clocks.
| 2026-10-07 | M10.3 (surfaces) | b280b43 | sandbox | 7.37 | 1.1% | 59.4 | 31.7 | 1.93 | 5 | 8 986 | 332.9 | Pass (+2.5%) |
| 2026-10-07 | M10.3 (surfaces) | b280b43 | pearly-gates | 7.47 | 0.5% | 59.28 | 29.18 | 1.83 | 5 | 34 510 | 332.9 | Pass (+2.8%) |
| 2026-10-07 | M10.3 (surfaces) | b280b43 | pearly-gates arcade | 7.40 | 0.3% | 59.89 | 53.11 | 1.82 | 6 | 34 540 | 332.9 | Pass (+2.5%) |

M10.3: the terrain is one draw call instead of three (7 → 5 calls); the texture array adds 39.2 MB (10 layers of 1 024², mipmapped), less the three old terrain textures. Against the baseline: +3.4%, +4.2% and +2.6%.
| 2026-10-07 | M10.4 (light) | f3532eb | sandbox | 7.35 (5 runs) | 5.2% | 59.96 | 58.57 | 1.76 | 7 | 14 990 | 333.1 | Pass (−0.3%) |
| 2026-10-07 | M10.4 (light) | f3532eb | pearly-gates | 7.48 | 0.8% | 59.95 | 58.92 | 1.75 | 7 | 40 514 | 334.0 | Pass (+0.1%) |
| 2026-10-07 | M10.4 (light) | f3532eb | pearly-gates arcade | 7.46 | 1.5% | 59.94 | 58.86 | 1.81 | 8 | 40 544 | 334.0 | Pass (+0.8%) |

M10.4: the contact shadows add 2 draw calls (two passes) and 2 triangles per character (about 6 000 with the swarm); the lightmap 0.9 MB. Against the baseline: +3.1%, +4.3% and +3.5%.
| 2026-10-07 | M10.5 (relief) | d7ea344 | sandbox | 7.34 | 1.5% | 59.93 | 58.77 | 1.77 | 7 | 15 652 | 333.1 | Pass (−0.1%) |
| 2026-10-07 | M10.5 (relief) | d7ea344 | pearly-gates | 7.54 | 0.4% | 59.96 | 58.94 | 1.75 | 7 | 47 808 | 334.0 | Pass (+0.8%) |
| 2026-10-07 | M10.5 (relief) | d7ea344 | pearly-gates arcade | 7.47 | 0.7% | 59.78 | 46.38 | 1.76 | 8 | 47 838 | 334.0 | Pass (+0.1%) |

M10.5: the relief adds about 7 300 triangles to the Pearly Gates' terrain (crowns, pilaster strips, 58 window recesses). Against the baseline: +2.9%, +5.2% and +3.6%.
| 2026-10-07 | M10.6 (arches), first gate | 67586f5 | sandbox | 8.11 | 1.1% | 58.37 | 29.9 | 1.80 | 8 | 17 976 | 333.1 | Fail (+10.5%) |
| 2026-10-07 | M10.6 (arches), first gate | 67586f5 | pearly-gates | 8.24 | 0.2% | 58.17 | 29.85 | 1.81 | 8 | 53 106 | 334.0 | Fail (+9.3%) |
| 2026-10-07 | M10.6 (arches), first gate | 67586f5 | pearly-gates arcade | 8.27 | 2.1% | 58.45 | 29.9 | 1.82 | 9 | 53 136 | 334.0 | Fail (+10.7%) |
| 2026-10-07 | M10.6 (arches), sky drawn last | ab2739a | sandbox | 7.88 | 2.2% | 58.92 | 29.91 | 1.77 | 9 | 18 364 | 333.1 | Rerun (+7.4%, see below) |
| 2026-10-07 | M10.6 (arches), sky drawn last | ab2739a | pearly-gates | 7.89 | 0.3% | 58.69 | 29.94 | 1.81 | 9 | 53 982 | 334.0 | Pass (+4.6%) |
| 2026-10-07 | M10.6 (arches), sky drawn last | ab2739a | pearly-gates arcade | 7.97 | 0.6% | 59.47 | 33.64 | 1.79 | 10 | 54 012 | 334.0 | Rerun (+6.7%, see below) |
| 2026-10-07 | M10.6 rerun: M10.5 and M10.6 back to back | d7ea344 / ab2739a | sandbox | 7.30 → 7.46 | — | 59.96 (M10.6) | 58.92 | 1.74 | 9 | 18 364 | 333.1 | Pass (+2.2%) |
| 2026-10-07 | M10.6 rerun: M10.5 and M10.6 back to back | d7ea344 / ab2739a | pearly-gates arcade | 7.45 → 7.61 | — | 59.96 | 58.92 | 1.68 | 10 | 54 012 | 334.0 | Pass (+2.1%) |

M10.6: the first gate failed all three runs by about 10%: the sky, drawn first since stage 2, was shaded under the arcades' large painted faces before they covered it. Drawn last (ab2739a), the sandbox measured 7.43 ms right away, but the full gate an hour later read 7.88 and 7.97 ms, with capped 1%-lows of 30 FPS in every run where M10.5 had 59. Measured back to back (two runs each, alternating builds, same session), M10.6 costs +2.2% and +2.1% on M10.5, and capped it runs at 59.96 FPS with a 1%-low of 58.92 and no frame over 20 ms (the benchmark now counts them), the same as M10.5: the gate's readings came from a slower spell of the machine. Per §2.3 a failure within the noise is run again before anything is cut; the back-to-back runs are that rerun. The painted faces add 2 draw calls (the cut-out mesh and the alpha pass) and the arches about 6 200 triangles.
| 2026-10-07 | M10.7 (atmosphere), gate | 539fdfc | sandbox | 7.97 | 0.4% | 58.34 | 29.84 | 1.75 | 11 | 18 558 | 344.7 | +1.1% on M10.6's gate run |
| 2026-10-07 | M10.7 (atmosphere), gate | 539fdfc | pearly-gates | 7.91 | 0.4% | 58.6 | 29.86 | 1.80 | 11 | 54 190 | 345.6 | +0.3% |
| 2026-10-07 | M10.7 (atmosphere), gate | 539fdfc | pearly-gates arcade | 8.07 | 0.6% | 59.26 | 29.93 | 1.83 | 12 | 54 220 | 345.6 | +1.3% |

### M10 final: against the baseline, back to back

The gate runs drifted by several percent between sessions (the baseline measured 7.13 ms in the morning and 6.63–6.74 ms at night), so the final check against the baseline (≤ +10%) measures both builds in one session, alternating single uncapped runs, two each per view: the baseline is commit 44b37d7 with only the benchmark's instrumentation added (`../mg-base0`). Steps taken until it passed:

| Build | Sandbox | Pearly Gates | Arcade view |
|---|---|---|---|
| 539fdfc (M10.7 as specified) | 6.70 → 7.56 (+12.8%) | 6.66 → 7.49 (+12.5%) | 6.74 → 7.62 (+13.1%) |
| 36edd14 (fog color per vertex, sky mip from the viewport) | 6.99 → 7.79 (+11.4%) | 7.04 → 7.75 (+10.1%) | 7.08 → 7.91 (+11.7%) |
| fc44352 (the sky's coordinates per vertex) | 6.66 → 7.37 (+10.7%) | 6.69 → 7.41 (+10.8%) | 6.72 → 7.49 (+11.5%) |
| 09c8bda (cut 1–2: no wisps, minimum cloud and spire counts, 12 shafts) | 6.69 → 7.34 (+9.8%) | 6.67 → 7.33 (+9.9%) | 6.72 → 7.53 (+12.0%) |
| **7491068 (cut 3: contact shadows under players and the Gatekeeper only)** | **6.64 → 7.26 (+9.3%)** | **6.66 → 7.25 (+8.9%)** | **6.78 → 7.44 (+9.7%)** |

Final build (7491068), capped: sandbox 59.93 FPS (1%-low 58.92), Pearly Gates 59.96 (58.9), arcade 59.95 (58.98), no frame over 20 ms; simulation 3.5–3.6 ms per tick on average (8.5 ms max). Budgets (§2.1), arcade run: 12 draw calls (+4; the baseline's 8), 51 136 triangles (+26 000 on the Pearly Gates), 345.6 MB of textures (+71 MB). Download: the new images add 4.3 MB (the sky 0.23, the arcade 2.37, the clouds and spires 0.76, the shaft 0.02, the five new terrain textures 0.94) and the four old terrain textures shrank from 5.26 MB of PNG to 0.80 MB of JPEG, so the first load is about 0.15 MB smaller.

Measured costs in the arcade view (one run each, same session, M10.7 before the cuts at 7.60 ms): the swarm's contact shadows 0.21 ms, the painted arches 0.17 ms (alpha to coverage 0.11 of it), the clouds, spires and shafts 0.10 ms.

## M10 gate: the Heavenly Gate

M10 gate §4. Back to back, in one session: `sh scripts/bench-ab.sh <build A> <build B> <args>` alternates single uncapped runs (A B A B), then one capped run each, with a 60 s cool-down before every run. "Frame ms" is the mean of a build's two uncapped runs. Budgets against the M10 final build (7491068): draw calls +3 with a gate, triangles +2 500, texture memory +65 MB with a gate (0 elsewhere), download +5 MB.

| Date | Stage | Builds (A → B) | Run | Frame ms, A → B (uncapped) | Change | FPS capped (A / B) | Frames over 20 ms capped (A / B) | Sim ms (B, uncapped) | Draw calls | Triangles | Texture MB | Result |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-07 | M10.8.1 (gate view) | 7491068 → stage 1 | pearly-gates | 7.45 → 7.55 | +1.3% | 59.47 / 58.95 | 14 / 29 | 1.92 | 11 | 51 106 | 345.6 | Pass (no rendering change) |
| 2026-10-07 | M10.8.1 (gate view) | 7491068 → stage 1 | pearly-gates arcade | 7.52 → 7.65 | +1.8% | 59.92 / 59.37 | 1 / 18 | 2.24 | 12 | 51 136 | 345.6 | Pass (no rendering change) |
| 2026-10-07 | M10.8.1 (gate view) | stage 1 | pearly-gates gate (baseline, median of 3) | 7.02 (6.83, 7.02, 7.36) | — | 59.92 | 1 | 2.43 | 13 | 51 126 | 345.6 | Baseline |

M10.8.1: stage 1 changes only how the benchmark picks its arena and camera, so the first two rows measure noise: the same frame on the same scene, +1.3% and +1.8%. The human worked on another screen during the runs, which shows as about 450 frames over 20 ms in every uncapped run (both builds alike, about one every 60 ms) and more slow frames in the capped runs than in M10's final session; the alternating order keeps the comparison fair. The gate view's three runs spread by 7.5%; its baseline is informational, since the gate's own check after stages 2 and 3 runs it back to back against this build. In the gate view the swarm surrounds the player at the boss arena's entry, the Gatekeeper on his dais: 1 499 enemies and the Gatekeeper.
| 2026-10-07 | M10.8.2 (the gate), first | stage 1 → stage 2 | pearly-gates gate | 7.26 → 7.32 | +0.8% | 59.95 / 59.95 | 0 / 0 | 1.88 | 15 | 52 416 | 407.8 | Pass (≤ +5%) |
| 2026-10-07 | M10.8.2 (the gate), first | 7491068 → stage 2 | pearly-gates | 7.61 → 7.83 | +2.9% | 58.83 / 58.75 | 33 / 36 | 2.42 | 13 | 52 396 | 407.8 | Rerun |
| 2026-10-07 | M10.8.2 (the gate), first, order swapped | stage 2 → 7491068 | pearly-gates | 7.54 ← 7.41 | +1.8% | 59.57 / 59.96 | 6 / 0 | 1.85 | 13 | 52 396 | 407.8 | Fail (four pairs: +2.3%) |
| 2026-10-07 | M10.8.2 (the gate), first | 7491068 → stage 2 | pearly-gates arcade | 7.82 → 7.69 | −1.6% | 59.09 / 59.94 | 25 / 0 | 1.98 | 12 | 50 162 | 407.8 | Pass (≤ +2%) |
| 2026-10-07 | M10.8.2 (the gate), alpha passes merged | 7491068 → stage 2 | pearly-gates | 7.26 → 7.33 | +1.0% | 59.94 / 59.95 | 0 / 0 | 1.76 | 12 | 52 396 | 407.8 | Pass |
| 2026-10-07 | M10.8.2 (the gate), alpha passes merged, order swapped | stage 2 → 7491068 | pearly-gates | 7.34 ← 7.39 | −0.6% | 59.95 / 59.95 | 0 / 0 | 1.76 | 12 | 52 396 | 407.8 | Pass (four pairs: +0.2%) |

M10.8.2: the gate view's first stage 1 run (9.06 ms, simulation 3.6 ms on average and 19 ms at most) was disturbed; the change is against its clean run (7.26 ms). The first gate on the Pearly Gates measured +2.9%, then +1.8% with the builds' order swapped (four pairs, both orders: +2.3%, over the +2% budget). Merging the gate's alpha-restore pass into the arches' (decisions) took it to +1.0% and −0.6% (+0.2% over four pairs) with the same image; the arcade and gate views, which passed before, only lose a draw call by it. Budgets: draw calls +1 with the gate in view (the gate mesh; the alpha pass is shared; the gate view's 13 → 15 was measured with its then-separate alpha pass); triangles +1 290 in view (the gate mesh is 1 132, partly culled, less the terrain the gate replaces); texture memory +62.2 MB (the gate array, 4 layers of 1 280 × 2 276, mipmapped); download +4.4 MB (the four images). The arcade view draws 974 triangles fewer: the west wall's cells, now the gate's, are no longer drawn.
| 2026-10-07 | M10.8.3 (clouds and radiance) | 7491068 → stage 3 | pearly-gates (both orders) | 7.40 → 7.44 (clean pairs) | +0.2%, −1.3%, +0.3% (a fourth pair disturbed: 8.01 ms) | 59.07 / 58.93, 59.17 / 58.80 | 26 / 30, 23 / 34 | 1.80 | 13 | 52 410 | 407.8 | Pass |
| 2026-10-07 | M10.8.3 (clouds and radiance) | 7491068 → stage 3 | pearly-gates arcade (both orders) | 7.59 → 7.63 (clean runs) | +0.5% | 59.70 / 59.69, 59.67 / 59.62 | 7 / 7, 8 / 10 | 1.82 | 12 | 51 306 | 407.8 | Pass |
| 2026-10-07 | M10.8.3 (clouds and radiance) | stage 1 → stage 3 | pearly-gates gate (both orders, two sessions) | 6.95 → 7.41 (clean runs) | +6.5% | 59.79 / 59.74, 59.89 / 59.58, 59.79 / 59.59 | 3 / 4, 2 / 10, 5 / 11 | 1.90 | 15 | 52 430 | 407.8 | Fail |
| 2026-10-07 | M10.8.3, cut 1: no radiance | stage 1 → stage 3 | pearly-gates gate (both orders) | 7.11 → 7.32 (clean runs) | +3.0% (pairs +3.6%, +3.5%, +3.3%) | 59.91 / 59.91, 59.79 / 59.73 | 1 / 1, 4 / 5 | 1.84 | 14 | 52 428 | 407.8 | Pass |
| 2026-10-07 | M10.8.3, sandbox check | 7491068 → stage 3 | sandbox (capped) | — | — | 57.74 / 58.81 | 66 / 34 | 3.22 (capped) | 11 / 11 | 15 488 / 15 488 | 344.7 / 344.7 | Pass (identical) |

M10.8.3: many runs this session were disturbed (simulation 3–6.5 ms on average where undisturbed runs measure 1.7–2.3 ms, frame times up to 11 ms); "clean" figures leave out runs with a simulation average over 2.5 ms. With the radiance the gate view measured +6.5% on stage 1 in both orders, over the +5% budget; stage 2 there had been +0.8%, so stage 3's additions cost it. The first cut of §4, the radiance, brought it to +3.0%, every pair within +3.3–3.6%. The Pearly Gates and the arcade view were measured with the radiance, which the cut only removes. The cloud banks behind the gate add 12 triangles to the clouds' draw call; the gate's triangles now count in every view (+1 132 in the arcade view), since its alpha pass is merged into the arches', which is drawn in every view. The sandbox draws exactly what the M10 final build draws: 11 calls, 15 488 triangles, 344.7 MB of textures.

**Final against the M10 final build (7491068):** draw calls +1 with the gate in view (the gate mesh; its alpha pass merged into the arches'), 0 elsewhere, against +3 allowed; triangles at most +1 324 (budget +2 500); texture memory +62.2 MB on maps with a gate, 0 elsewhere (budget +65 MB); download +4.4 MB (budget +5 MB); no new per-frame JavaScript; level build about +8 ms (budget +50 ms).

## M11: painted first-person weapons

M11 §5, run once on the final build (decisions): the Binder firing in the arcade view, `--class binder --hud-fire`, back to back against the baseline commit 2e42ba2 (`M11.2: Benchmark options`) with `scripts/bench-ab.sh` in both orders. Budgets: uncapped mean frame time +3% at most; capped at least 58 FPS with no more frames over 20 ms than the baseline; draw calls, triangles and texture memory unchanged (the weapon is HTML).

| Date | Build | Run | Frame ms, A → B (uncapped) | Change | FPS capped (A / B) | Frames over 20 ms capped (A / B) | Draw calls | Triangles | Texture MB | Result |
|---|---|---|---|---|---|---|---|---|---|---|
| 2026-10-07 | stage 3 as built | arcade, Binder firing, both orders | 7.67 → 7.84 | +2.3% (pairs +1.2, +2.5, +3.3, +2.3) | 58.63 / 57.67, 58.44 / 57.55 | 39 / 68, 44 / 65 | 12 | 51 306 | 407.8 | Fail (capped) |
| 2026-10-07 | cut 1: glow without screen blend | arcade, Binder firing, capped only | — | — | 59.24 / 59.11, 59.61 / 58.91 | 21 / 24, 10 / 30 | 12 | 51 306 | 407.8 | Fail (slow frames) |
| 2026-10-07 | cut 2: no light (cut 1 kept) | arcade, Binder firing, capped only | — | — | 59.44 / 59.07, 59.50 / 59.11, 59.37 / 59.07 | 15 / 25, 13 / 25, 17 / 25 | 12 | 51 306 | 407.8 | No change: cut 2 undone |
| 2026-10-08 | layers promoted (`will-change`), light back | arcade, Binder firing, capped only | — | — | 59.54 / 59.24, 59.40 / 58.97, 59.27 / 59.23 | 12 / 21, 16 / 29, 20 / 21 | 12 | 51 306 | 407.8 | Fail (slow frames) |
| 2026-10-08 | **cut 3: layers at 75% of their storage scale** | arcade, Binder firing, both orders | **7.61 → 7.56** | **−0.7%** | 58.38 / 57.88, 58.51 / 58.05 | 47 / 62, 43 / 57 | 12 | 51 306 | 407.8 | Uncapped pass; capped short (see below) |

M11: the Binder at rest measured the same in both builds (13 / 13 and 22 / 22 frames over 20 ms, 59.5 FPS), so the extra slow frames come only from firing. A trace showed the main thread no busier (2.75 ms against 3.04 ms per frame in BeginMainFrame) but the GPU thread blocked in Present on nearly every frame (597 of 598 over 8 ms, against 161 of 599 in the baseline). Single capped runs of variants of the stage 3 build (frames over 20 ms; the baseline's runs that session 10–22, about 16): as built 26; the weapon hidden 16; the muzzle flash hidden 19; the glow layers hidden 23; the alt frame hidden 19; no filter 27; no `will-change` 26; neither 25; with cut 3 19 and 22. So the cost is the weapon's large images moving every frame, spread over its layers, and cut 3 is the one that helps. In the final pairs the capped runs followed the uncapped ones and were slower for both builds (the baseline 58.4 against 59.4 in the capped-only sessions); one of the build's capped runs was disturbed (simulation 7.7 ms on average, against 4.3). Every cut of §5 has been tried; the remaining difference (about 10–15 more frames over 20 ms in 30 s, one every 2–3 s, with 1 500 enemies and the Chain Gun firing nonstop) is left to the human's playtest. Download per class after cut 3: Fallen 0.41 MB, Heretic 0.28 MB, Binder 0.75 MB, Betrayer 0.06 MB (budget 2.5 MB).
