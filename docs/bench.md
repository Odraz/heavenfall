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
