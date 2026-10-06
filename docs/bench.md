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
