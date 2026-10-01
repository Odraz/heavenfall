# Implementation decisions

Choices made where [mvp.md](mvp.md) is silent or ambiguous, one per line (§0).

- §2.1 — TypeScript 7 (the native `tsc`), Vite 8, Vitest 5, Three.js 0.186 and Playwright 1.63 are the latest stable versions at project start.
- §2.5 — Until the Pearly Gates exists (milestone 4), `map=pearly-gates` counts as invalid and opens the sandbox.
- §2.5 — `seed` is read as a non-negative decimal integer taken modulo 2³²; any other value means a random seed.
- §8.1 — Loader errors that aren't tied to one cell (an empty grid, fewer than 4 `S` markers) name row 0, column 0. A grid that's too large names the first row or column past 256. Grids of different sizes name the first missing row.
- §8.4 — Sandbox doors sit just outside the arena's `rect`, in the corridor, so entering the `rect` means passing the door.
- §11.1 — Terrain is unlit, but faces get a fixed per-vertex tint by orientation and walls darken toward their base, so edges and ledges stay readable without lighting.
