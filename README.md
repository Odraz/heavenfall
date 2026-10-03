# Meatgrinder

A 4-player co-op first-person shooter: Doom-style action with the teamwork of MMO dungeon runs. A party of four clears dungeons packed with thousands of monsters.

## Concept

- **Four classes, four roles.** Every role matters:
  - **Tank**: durable; can taunt and rush in to rescue teammates.
  - **Healer**: heals and protects the party.
  - **Support**: deals damage, focused on crowd-control abilities.
  - **Damage**: fragile, but deals very high damage.
- **Swarms at scale.** Thousands of enemies on screen at once, made possible by simple AI.
- **Simple visuals.** Billboard sprites drawn in vector graphics.

## Getting started

This repo uses [Git LFS](https://git-lfs.com/) for binary assets (textures, audio, models, WADs). Install it once before cloning:

```bash
git lfs install
```

Then clone as usual; LFS files download automatically.

The game runs in the browser and needs Node 22. The working title is **Heavenfall**; the MVP specification is [docs/mvp.md](docs/mvp.md), and implementation decisions are in [docs/decisions.md](docs/decisions.md).

| Command | Does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server at http://localhost:5173/ |
| `npm run build` | Static build in `dist/` |
| `npm run preview` | Serve `dist/` at http://localhost:4173/ |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests (Vitest) |
| `npm run e2e` | Builds, serves the build and runs the Playwright tests |
| `npm run bench` | Builds, serves the build and runs the browser benchmark |

Before the first `npm run e2e` or `npm run bench`, install Playwright's Chromium once with `npx playwright install chromium`.

### Dev URLs

These work on the dev server (port 5173), the preview server (port 4173) and the production build.

| URL | Opens |
|---|---|
| http://localhost:5173/?dev=1&map=sandbox&class=fallen | Skips the menus into a singleplayer game. `map` is `sandbox` (a small test map) or `pearly-gates` (the dungeon); `class` is `fallen`, `heretic`, `binder` or `betrayer`; add `&seed=N` for a fixed seed. |
| http://localhost:5173/?dev=1&god=1 | God mode: every player is invulnerable. |
| http://localhost:5173/?dev=1&bot=1 | A bot plays the local player. |
| http://localhost:5173/?bench=1 | The benchmark: 1 500 enemies for 30 s, then shows FPS and simulation time. |

In game: mouse to look (click to capture the pointer), WASD to move, Space to jump, F3 for the debug overlay. With `dev=1`, K kills every enemy.

### Blessed sprites

The Blessed's animated 8-direction sprites are rendered from a 3D model built in code. To regenerate `assets/sprites/blessed/` after changing [scripts/blender/blessed.py](scripts/blender/blessed.py), run it with Blender 5.2 (about 2 minutes):

```bash
blender -b --factory-startup -P scripts/blender/blessed.py -- sprites assets/sprites/blessed
```

`-- sheet walk preview.png` renders one animation as a contact sheet (rows: directions, columns: frames) for checking poses.
