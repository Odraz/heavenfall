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
| http://localhost:5173/ | The menus: enter a name, then start a singleplayer run through The Pearly Gates, or host or join a multiplayer game. |
| http://localhost:5173/?dev=1&map=sandbox&class=fallen | Skips the menus into a singleplayer game. `map` is `sandbox` (a small test map) or `pearly-gates` (the dungeon); `class` is `fallen`, `heretic`, `binder` or `betrayer`; add `&seed=N` for a fixed seed. |
| http://localhost:5173/?dev=1&god=1 | God mode: every player is invulnerable. |
| http://localhost:5173/?dev=1&bot=1 | A bot plays the local player. |
| http://localhost:5173/?bench=1 | The benchmark: 1 500 enemies for 30 s, then shows FPS and simulation time. |
| http://localhost:5173/?join=ABC234 | An invite link: Title offers `Join game ABC234`, which opens the Join screen with the ID filled in. |
| http://localhost:5173/?bot=1&autojoin=1&join=ABC234&class=heretic&name=Bot2 | Bot auto-join, for testing co-op abilities alone: joins open game `ABC234` without the menus and picks `class` if it's free (otherwise the first free class). Host an open game (no password), then open this in up to three tabs. |

In game: mouse to look (click to capture the pointer), WASD to move, Space to jump, left mouse to fire, Q and E for abilities, H for the class hints, Esc to pause, F3 for the debug overlay. With `dev=1`, K kills every enemy and G toggles invulnerability.

### Multiplayer

Up to 4 players, each in their own browser, connect directly to the host's browser (WebRTC through [PeerJS](https://peerjs.com/), with the public PeerJS server only to find each other). Everyone must open the same build of the game, so play on the same deployed URL.

1. The host clicks `Multiplayer` → `Host game`, optionally sets a password, and clicks `Create`. The Lobby shows a 6-character game ID; `Copy invite link` copies a link to the game.
2. Each friend opens the invite link, enters a name, clicks `Join game <ID>`, types the password (if any) and clicks `Join`. Without the link: `Multiplayer` → `Join game`, then type the game ID and the password.
3. Everyone picks a different class; the host clicks `Start`.

In game, an arena seals 60 s after the first player enters it, or 5 s after the whole party is inside. A player who falls leaves a soul floating where they fell: shoot it to revive them (the Heretic Saint revives twice as fast, and Unholy Communion helps too). Clearing the arena brings back everyone who's still down.

To try it on one computer, open the game in two browser windows. Players whose networks can't connect directly (some office, mobile or VPN networks) go through a relay server ([Metered](https://www.metered.ca/), free plan); its credentials are in [src/net/peerConfig.ts](src/net/peerConfig.ts).

### Sound and music

Sound effects are synthesized in code: each is a parameter set in [src/audio/sfx.ts](src/audio/sfx.ts), rendered by [src/audio/synth.ts](src/audio/synth.ts). The music tracks are MP3s in `assets/music/`, made from the prompts in [docs/music-prompts.md](docs/music-prompts.md) and listed with their loop points in [src/data/music.ts](src/data/music.ts); a track that isn't listed isn't played. After replacing or adding a track, find its loop points with:

```bash
node scripts/music-loops.mjs calm arena-1
```

The volume sliders are on the Title and in the Pause overlay.

### Blessed sprites

The Blessed's animated 8-direction sprites are rendered from a 3D model built in code. To regenerate `assets/sprites/blessed/` after changing [scripts/blender/blessed.py](scripts/blender/blessed.py), run it with Blender 5.2 (about 2 minutes):

```bash
blender -b --factory-startup -P scripts/blender/blessed.py -- sprites assets/sprites/blessed
```

`-- sheet walk preview.png` renders one animation as a contact sheet (rows: directions, columns: frames) for checking poses.
