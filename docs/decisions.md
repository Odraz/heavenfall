# Implementation decisions

Choices made where [mvp.md](mvp.md) is silent or ambiguous, one per line (§0).

- §2.1 — TypeScript 7 (the native `tsc`), Vite 8, Vitest 5, Three.js 0.186 and Playwright 1.63 are the latest stable versions at project start.
- §2.2 — The worker runs its first tick as soon as it starts; later ticks follow the 30 Hz accumulator.
- §2.5 — Until the Pearly Gates exists (milestone 4), `map=pearly-gates` counts as invalid and opens the sandbox.
- §2.5 — `seed` is read as a non-negative decimal integer taken modulo 2³²; any other value means a random seed.
- §2.5 — The F3 overlay also shows the local player's position and yaw; the screenshot helper (`scripts/screenshot.mjs`) steers by it.
- §2.5 — Dev key `K` and the singleplayer pause reach the worker as internal messages, like the other host-only worker messages.
- §2.5 — Benchmark 1%-low FPS is 1000 ÷ the average frame time of the slowest 1% of frames (at least one frame) in the 30 s window.
- §2.5 — Bot: between line-of-sight checks it keeps aiming at the enemy it chose while that enemy is still in the interpolated set; it stops when within 0.2 m of its goal point; when it's in the goal's cell or next to it, it heads straight for the goal point.
- §5.2 — Feet are compared with floors using a 1e-6 m tolerance, so a jump peaking exactly at a ledge height still lands on it.
- §7.1 — A Cherub following the air field moves straight toward its target's horizontal position when in the target's cell or next to it (only the Blessed have a stop distance).
- §7.2 — An enemy also picks its first target when it spawns; ties in distance go to the lower player index.
- §7.3 — "Every 0.25 s" for flow fields is tick-based: player index *i* recomputes on ticks where ⌊(tick + 2i) ÷ 7.5⌋ changes (alternating 7- and 8-tick gaps, 0.25 s on average, never on the same tick as another player). Doors opening or closing recompute every field on the next tick.
- §7.3 — Separation treats bodies as cylinders: two enemies overlap only if their circles and their height ranges both overlap. Enemies at exactly the same spot are pushed apart along a fixed angle derived from their slot numbers.
- §8.1 — Loader errors that aren't tied to one cell (an empty grid, fewer than 4 `S` markers) name row 0, column 0. A grid that's too large names the first row or column past 256. Grids of different sizes name the first missing row.
- §8.2 — Spawn-point budgets grow every tick in every arena, even while idle, so they are full when combat starts. The cap of 2 applies to the budget carried into the next tick (after placing), so a busy spawn point sustains exactly 50 enemies per second; capping before placing would give 45.
- §8.2 — Wave progression is checked each tick before placing, so a wave that starts can place its first enemies in the same tick.
- §8.4 — Sandbox doors sit just outside the arena's `rect`, in the corridor, so entering the `rect` means passing the door.
- §9.3 — The host's floor check raises the feet to the highest floor among the cells the player's circle overlaps (walls and closed doors excluded). The speed check's first interval is measured from when the simulation started.
- §9.4 — Clients derive enemy height as the highest floor under the enemy's circle (walls excluded); Cherubs add 4 m and move toward it at up to 6 m/s, starting at the target height when a slot first appears.
- §9.4 — Interpolation draws the enemies of the snapshot at or before the render tick, moved toward the next snapshot where present; an enemy's state and flags switch to the next snapshot's halfway between them.
- §11.1 — Terrain is unlit, but faces get a fixed per-vertex tint by orientation and walls darken toward their base, so edges and ledges stay readable without lighting.
- §11.1 — All sprite billboards share one atlas material, so they are one `InstancedMesh`; billboards face the camera's horizontal right vector.
- §12 — `npm run bench` launches Playwright's Chromium headed; if that fails, it falls back to the installed Chrome, then Edge (both Chromium), and prints which one ran. On the agent's machine Playwright's headed Chromium can't start (Windows reports a side-by-side configuration error), so the benchmark ran in Chrome. The headless Chromium used by the end-to-end tests works. The benchmark browser also runs with Windows occlusion detection off, so a window covering it on a shared desktop doesn't throttle its frame rate.
