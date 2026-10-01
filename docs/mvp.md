# MVP Specification

Working title: **Heavenfall**. The repository name (Meatgrinder) is a placeholder.

The MVP is a **fully working prototype**, not the full game. Up to four players, each in a different role, fight through one short dungeon against over a thousand enemies, in the browser, at 60 FPS. Everything listed here must work; everything else is out of scope (§14).

All numbers are **initial tuning values**. They are precise so the first build is unambiguous, and they are expected to change after playtesting.

Units are meters (m), seconds (s), milliseconds (ms) and hit points (HP). KB means 1 000 bytes.

---

## 0. Instructions for the implementing agent

**Approach**
1. **Read the whole spec first.** Then implement the milestones in §16 strictly in order. Don't start a milestone until the previous one meets its definition of done.
2. **This spec is the source of truth.** If it's silent or ambiguous, choose the simplest option consistent with it and record the choice in `docs/decisions.md`, one line per decision: `§<section> — <decision>`. Don't add anything listed in §14 or anything else not specified here. Internal code structure, helper modules and extra tests are up to you.
3. **Definition of done for each milestone:**
   - `npm run typecheck`, `npm test` and every end-to-end test available at that milestone (§13.2) pass;
   - the milestone's features were checked visually: run the dev server, open it in the browser and take screenshots;
   - the work is committed.

**Git and housekeeping**
- Work on the branch `mvp`, with at least one commit per milestone and messages starting `M<n>:`.
- Don't push, rewrite history or change repository settings.
- `.gitignore` already covers `node_modules/`, `dist/`, `test-results/` and `playwright-report/`.
- In milestone 1, create `docs/decisions.md`, and replace the README's *Getting started* section with the npm commands (§2.1) and the dev URLs (§2.5). Keep the Git LFS note.

**When something blocks the work**
- Diagnose it, try a different approach, and record it in `docs/decisions.md`.
- Stop and report only if a requirement can't be met at all, for example a performance target that's unreachable after optimizing.

**Human checkpoints.** These can't be done or verified by the agent. Prepare everything they need and list them in the final report:
- Creating the GitHub repository, pushing, and enabling GitHub Pages with *Source: GitHub Actions*.
- Playing multiplayer across two different networks.
- A real 4-player playthrough.
- Measuring FPS on the target laptop (§12).

---

## 1. Setting

Four damned souls escape Hell and storm Heaven. The MVP contains only the first dungeon, **The Pearly Gates**.

Art rules:
- **Heaven:** pastel sky blue, gold and ivory. Enemies are white and gold with **thick dark outlines**, like stained-glass lead lines, so they stay readable against the bright world.
- **Players:** ember red, soot black and brimstone orange.
- **Enemy death:** each enemy bursts into feathers and gold sparks. There is no blood.
- **Rendering:** unlit, with pale blue distance fog.

---

## 2. Technology and architecture

### 2.1 Stack

| Concern | Choice |
|---|---|
| Language | TypeScript (strict) |
| Build / dev server | Vite |
| Rendering | Three.js (WebGL2) |
| Networking | PeerJS (WebRTC data channels), public PeerJS cloud signaling server, Google public STUN |
| UI (menus, HUD) | Plain HTML/CSS overlaid on the canvas |
| Unit tests | Vitest (§13.1) |
| End-to-end tests | Playwright with Chromium (§13.2) |
| Hosting | GitHub Pages |
| Runtime for tooling | Node 22 |
| Target | Desktop Chrome, Edge and Firefox with keyboard and mouse |

Use the latest stable version of each package at project start, and commit `package-lock.json`.

Commands:

| Command | Does |
|---|---|
| `npm install` | Install dependencies |
| `npm run dev` | Dev server |
| `npm run build` | Static build in `dist/` |
| `npm run preview` | Serve `dist/` |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Unit tests |
| `npm run e2e` | Builds, serves the build and runs Playwright |

### 2.2 Architecture

```
src/
  main.ts          entry: boots UI, owns the top-level screen state machine
  ui/              screens and HUD (DOM)
  sim/             game simulation: pure TS, NO three.js / DOM imports
  sim/worker.ts    Web Worker entry that runs the host simulation
  sim/movement.ts  shared player and enemy movement (§5.2)
  sim/flowfield.ts shared flow fields (§7.3), also used by the bot
  render/          three.js scene, billboards, first-person weapon, VFX
  net/             Transport interface, LocalTransport, PeerTransport, protocol encode/decode
  data/            classes, enemies, dungeons (plain TS data)
assets/sprites/    SVG source art
e2e/               Playwright tests
```

- **One code path.** Every game has exactly one **host simulation**, and every player, including the host's own player, talks to it through a `Transport`.
  - **Singleplayer:** the host simulation runs locally. The player uses `LocalTransport` with no network.
  - **Multiplayer, host's own player:** uses `LocalTransport`.
  - **Multiplayer, remote clients:** use `PeerTransport`.
  - Rendering and input code never knows which transport it's using.
- **The host simulation runs in a dedicated Web Worker.** Browsers pause `requestAnimationFrame` and throttle timers on the main thread when a tab is in the background, which would freeze the game for every player if the host alt-tabs. The worker isn't throttled that way.
  - `LocalTransport` is `postMessage` between the main thread and the worker.
  - The host's main thread owns the PeerJS connections and relays messages between remote clients and the worker.
  - The worker encodes every snapshot (§9.4) itself and posts it to the main thread, which only forwards remote clients' snapshots to their connections. Forwarding is driven by worker messages, not main-thread timers, so it keeps full rate while the host's tab is in the background.
- **The simulation is authoritative** for enemies, projectiles, damage, abilities, cooldowns and arena state. Each player's own position is **client-authoritative** (§9.3).
- **Simulation tick:** a fixed **30 Hz**, using an accumulator driven by `performance.now()` inside the worker.
- **Randomness:** all simulation randomness (weapon spread) uses a seeded PRNG (mulberry32). The seed is random per game unless set with `?seed=` (§2.5).
- **Local player movement** runs on each player's own main thread, every render frame (dt clamped to 50 ms). It uses `sim/movement.ts`, which the host also uses for validation.

### 2.3 Conventions
- **Simulation coordinates:** `x` points east (grid column), `y` points south (grid row), `z` points up.
- **Grid cells:** cell `(col, row)` covers `x ∈ [col, col+1)`, `y ∈ [row, row+1)`. ASCII row 0 is the first line of the map. **Reading order** is row by row, left to right.
- **Three.js mapping:** `three.x = x`, `three.y = z`, `three.z = y`. This is a pure axis swap; don't negate anything.
- **Yaw** is measured from +x toward +y. **Pitch** is positive when looking up.
- **Aim direction** = `(cos(pitch)·cos(yaw), cos(pitch)·sin(yaw), sin(pitch))`.
- **Body points.** Every body is a vertical cylinder with its *feet* at `(x, y, z)`.
  - *Body center* = feet + height / 2.
  - *Eye*: players at feet + 1.6 m; the Gatekeeper at feet + 5 m; every other enemy at its body center.
- **Placing a body on a cell** means its feet go to the cell's center at that cell's floor height (Cherubs: 4 m above it).

### 2.4 Version and deployment
- **Build version:** the constant `__BUILD_VERSION__` is `<package.json version>-<git short hash>`, injected by Vite's `define`.
- **Deployment:** the workflow `.github/workflows/pages.yml` runs typecheck, unit tests and build, then deploys `dist/` to GitHub Pages on every push to `main`. Vite uses `base: './'`. The repository has no remote yet, so the workflow only starts working after the human checkpoint in §0.

### 2.5 Dev and test tools
All URL parameters also work in the production build, because the end-to-end tests run against it.

- **Menu skip:** `?dev=1&map=<sandbox|pearly-gates>&class=<fallen|heretic|binder|betrayer>[&seed=N]` skips the menus and starts a singleplayer game directly, with the player name `Dev`. A missing or invalid `map` means `sandbox`; a missing or invalid `class` means `fallen`. `seed` is honored only together with `dev=1`.
- **God mode:** `?god=1` makes every player invulnerable (§5.5 step 3) for the whole game. Only the host's URL matters.
- **Dev keys** (only with `dev=1`): `G` toggles invulnerability for the local player, `K` kills every living enemy, including the Gatekeeper, without kill credit.
- **Benchmark:** `?bench=1` starts a singleplayer game on the sandbox. Other parameters are ignored.
  - The player is an invulnerable Betrayer that doesn't shoot, placed on the arena's entry cell 0. The arena enters combat immediately (its doors close).
  - Instead of waves, the simulation keeps **exactly 1 500 Blessed** alive, spawning with the normal rules (§8.2) whenever fewer are alive.
  - The camera rotates in place at 0.3 rad/s with pitch 0.
  - Measuring starts when 1 500 Blessed are alive for the first time and lasts 30 s. Then it shows on screen the average FPS, the 1%-low FPS (the frame rate of the slowest 1% of frames), and the average and maximum simulation ms per tick.
  - It also logs one console line: `BENCH {"fps":…,"fpsLow":…,"simMs":…,"simMsMax":…}`.
- **Bot:** `?bot=1` replaces the local player's input in game. The menus are still used normally (or skipped with `dev=1`). The bot never requests pointer lock, and does nothing while dead. Every render frame it:
  - **Aims and fires:** turns instantly to aim at the body center of the nearest living enemy (distance from its eye, §5.3) that it has line of sight to, checking line of sight at most 4 times per second. It holds fire while such an enemy exists.
  - **Uses abilities:** presses Q and E whenever their displayed cooldowns are ready.
  - **Picks a goal:**
    - A client's bot in multiplayer: the host's player while farther than 6 m from it, otherwise no goal.
    - The host's bot (and the singleplayer bot):
      - while an arena is in combat: no goal while an enemy is in line of sight, otherwise the nearest living enemy (straight-line distance);
      - otherwise: entry cell 0 of the next arena, which is arena `arenaIndex` if it's idle and arena `arenaIndex + 1` if it's cleared (§8.2). If there's no such arena, no goal.
  - **Moves:** follows a ground flow field (§7.3) built toward the goal's cell, recomputed when the goal cell changes but at most twice per second. It steers like an enemy (§7.3). With no goal, or no path, it stands still.
  - **Jumps** when its horizontal movement was blocked in the previous frame.
- **Sandbox map:** `sandbox` is a small test map (§8.4) used from milestone 1. It isn't selectable in the menus.
- **Debug overlay:** `F3` toggles it in every mode. It shows FPS, simulation ms per tick, living enemies, projectiles, and network KB/s in and out (payload bytes over PeerJS).
- **Debug object:** `window.__heavenfall` is a read-only object, updated every frame, for tests to read. Outside a game its game fields are 0, empty or `null`.

```ts
{
  screen: 'title' | 'singleplayerSetup' | 'multiplayer' | 'hostSetup' | 'join'
        | 'lobby' | 'loading' | 'inGame' | 'results',
  paused: boolean,                 // the Pause overlay is open
  fps: number,                     // average over the last 1 s
  simMs: number,                   // host: average worker ms per tick over the last 1 s; clients: 0
  lastSnapshotTick: number,        // tick of the newest complete snapshot
  enemies: number,                 // living enemies in the newest complete snapshot
  enemyCountsByTick: Record<number, number>, // living enemies in each of the last 90 complete snapshots
  projectiles: number,
  arenaIndex: number,
  arenaPhase: 'idle' | 'combat' | 'cleared',
  netInKBps: number, netOutKBps: number,     // payload bytes received / sent over PeerJS in the last 1 s
  players: Array<{ id: number, classId: string, hp: number, dead: boolean, kills: number }>,
  gameResult: null | 'victory' | 'defeat',
}
```

---

## 3. Screens and flow

```
Title ──► Singleplayer Setup ──► Loading ──► In Game ──► Results ──► Title
  │
  └──► Multiplayer ──► Host Setup ──► Lobby ──► Loading ──► In Game ──► Results ──► Title
             └──────► Join ─────────► Lobby
```

| Screen | Contents | Actions |
|---|---|---|
| **Title** | Game title; **Player name** field (1–16 characters after trimming, remembered in `localStorage`); a message line, empty unless set by a return to Title | `Singleplayer`, `Multiplayer` (both disabled while the name is empty) |
| **Singleplayer Setup** | Class picker (4 cards: name, role, HP, 1-line description), dungeon picker (1 entry: *The Pearly Gates*) | `Start` (enabled once a class is picked), `Back` |
| **Multiplayer** | — | `Host game`, `Join game`, `Back` |
| **Host Setup** | Password field (0–32 chars; empty means an open game), dungeon picker | `Create` (registers the game ID, then goes to Lobby; errors shown inline), `Back` |
| **Join** | Game ID field (6 chars, case-insensitive, normalized to upper case), password field | `Join` (connects, then goes to Lobby; errors shown inline), `Back` |
| **Lobby** | Game ID shown large with a `Copy` button (host only); dungeon name; 4 player slots (name, class, "host" tag); class picker | Everyone: pick a class. Host: `Start`. Everyone: `Leave` |
| **Loading** | Progress text | — |
| **In Game** | 3D view and HUD (§10) | Pause overlay: `Resume`, `Leave game` |
| **Results** | *Victory* or *Defeat*, run time, kills per player | `Back to title` |

**Title messages.** These are set when a game or lobby sends the player back to Title, and cleared by the next button press:
- `Host left the game`: the host left or timed out (§9.4).
- `Loading took too long`: `reject { reason: 'load_timeout' }`.

**Lobby rules**
- There are 4 slots, and the host occupies one of them and picks a class too.
- **Player IDs:** the host is 0. Each joining client gets the lowest free ID from 1 to 3.
- Each class can be taken by **only one player**. A taken class is greyed out and shows who took it.
- The host's `Start` button is enabled only when every connected player has picked a class. Starting with 1 to 4 players is allowed.
- A player leaving the lobby frees their slot and class.

**Loading**
- In singleplayer, Loading builds the map and sprite atlas, then enters the game.
- In multiplayer:
  1. The host sends `start`.
  2. Every player, including the host, loads and sends `ready`.
  3. When all players are ready, the host sends `go` and everyone enters the game at the same time.
  4. A client not ready 20 s after `start` receives `reject { reason: 'load_timeout' }`, returns to Title, and the game starts without them. A client that leaves or disconnects during Loading is dropped the same way, without the `reject`.
- **Player index:** `start.players` lists the players sorted by `id`. A player's *index* (0–3) is its position in that list. The singleplayer player has index 0.
- The player with index *i* is placed on the *i*-th `S` marker in reading order.

**Pause**
- The Pause overlay opens when **pointer lock is lost**, and when an `Esc` keydown reaches the page; opening it releases pointer lock if held. (Browsers usually consume `Esc` to release pointer lock without passing it to the page, so the lock-loss event covers that case; automated tests may deliver the keydown directly.)
- `Resume` closes the overlay and requests pointer lock; the click counts as the required user gesture. If the request fails (Chrome refuses it for about 1 s after the user pressed `Esc`), the game continues without it.
- While the overlay is closed and pointer lock isn't held, a click in the game requests it.
- In singleplayer, Pause pauses the simulation (through an internal worker message, not part of §9.2). In multiplayer it doesn't.

**Errors, shown inline**

| Screen | Error | Cause |
|---|---|---|
| Host Setup | `Couldn't reach the matchmaking server` | Signaling server unreachable, or 5 attempts at registering a game ID failed. |
| Join | `Game not found` | PeerJS `peer-unavailable`. |
| Join | `Wrong password`, `Game is full`, `Game already started`, `Version mismatch` | The matching `reject` reason (§9.2). |
| Join | `Connection failed` | Any other error, or no `welcome` within 10 s. |

**End of game**
- On victory or defeat, the result is shown as a large text overlay for 3 s, then the Results screen appears.
- **Run time** is simulation time from `go` (singleplayer: from entering the game) to the result, so time spent paused doesn't count.
- **Kills per player** lists the players still connected at the end.
- The session ends at Results: the host closes all connections and destroys its PeerJS peer.
- **Leaving:** `Leave game` and `Leave` send `leave` and return to Title.

---

## 4. Controls and camera

| Input | Action |
|---|---|
| Mouse | Look (while pointer lock is held) |
| W A S D | Move |
| Space | Jump |
| Left mouse (hold) | Primary weapon |
| Q | Ability 1 |
| E | Ability 2 |
| Esc | Opens Pause and releases pointer lock (§3) |
| F3 | Debug overlay |

- **Mouse sensitivity:** 0.0022 rad per pixel, hardcoded.
- **Pitch:** limited to ±85°.
- **Camera:** vertical field of view 75°, near plane 0.05 m, far plane 200 m.
- **Fog:** linear from 40 m to 150 m.
- There is no crouching.

---

## 5. World and rules

### 5.1 Heightfield
- **Grid:** the map is a 2D grid of **1 m cells**, at most 256 × 256.
- **Cells:** each cell is either a **wall** or a **floor** with its own height. Floor heights go from 0 to 8.75 m in **0.25 m steps**.
- **No overlap:** there are no overlapping floors, bridges or ceilings. Above everything is open sky.
- **Walls** are solid columns rising to a global top of 16 m. A **closed door** behaves exactly like a wall.
- **Stairs** are runs of floor cells whose heights rise by at most 0.5 m per cell. **Terraces** are raised floor areas. Their edges are **ledges**, and anyone can drop off a ledge from any height.
- **Level design rule:** every floor area a player can reach must also be reachable by ground enemies via stairs. There are no jump-only perches.

### 5.2 Movement and collision
- **Bodies:** players are radius 0.4 m and height 1.8 m. Enemy sizes are in §7.1.
- **Overlapped cells:** the cells whose squares intersect the body's circle. **Ground height** is the highest floor height among the overlapped floor cells that don't block the body. (Normally a body overlaps no blocking cell, so this is simply the highest overlapped floor.)
- **Blocking cells.** A cell blocks a body if any of these is true:
  - it is a wall or a closed door;
  - the body is grounded and the cell's floor is more than **0.5 m** above the feet (step-up limit);
  - the body is airborne and the cell's floor is above the feet.
- **Resolution:**
  - Each update splits horizontal movement into equal **substeps of at most 0.25 m**, so fast moves can't pass through a 1 m wall.
  - Each substep is applied **along x, then along y**. Each axis move is cancelled if the circle would then overlap a blocking cell it didn't overlap before the move. So a body moved into a blocking cell by something that ignores collision (Chains, Falling Star) can still move out of it.
  - A grounded body whose ground height rises (by 0.5 m or less) snaps its feet up to it.
  - A body whose ground height drops below its feet becomes airborne.
  - An airborne body lands when its feet reach the ground height.
- **Players:**
  - Horizontal movement has instant acceleration and full air control. Speed is set per class (§6).
  - **Jump:** vertical velocity 7 m/s, only while grounded. With gravity, a jump peaks at about 1.22 m, so ledges up to 1.0 m can be climbed (heights come in 0.25 m steps).
  - **Gravity:** 20 m/s², integrated exactly for constant acceleration (`z += v·dt − ½·g·dt²`, then `v −= g·dt`), so jump height doesn't depend on frame rate. There is no fall damage.
  - Players pass through enemies and other players.
- **Ground enemies:** use the same rules with their own radius. They never jump.
- **Flying enemies:** collide with walls and closed doors only. Their height is set by hovering (§7.1).

### 5.3 Aiming and targeting
- **Origins:** all player weapons and abilities originate at the player's eye. Enemy projectiles originate at the enemy's eye.
- **Crosshair ray:** a 3D ray from the player's eye along the aim direction. It stops at the first enemy cylinder it hits, or at a wall or terrain (any point where the ray is below the floor height of the cell it's passing through).
- **Crosshair target:** the enemy hit by the crosshair ray, if any.
- **Ally target:** the living ally (not self) with the smallest angle between the aim direction and the direction from the eye to the ally's body center. The angle must be **10° or less**, the ally must be within the ability's range, and there must be line of sight. **Enemies don't block ally targeting.**
- **Line of sight:** a 3D segment between two points, blocked by walls, closed doors and terrain only.
  - From a player: from the player's eye to the target's body center.
  - From an enemy to a player: from the enemy's eye to the player's body center.
  - Line of sight is required only where this spec says so: ally targets, Chains of Tartarus (§6.3), enemy targeting and attacks (§7), Judgment (§7.4) and the bot (§2.5). Other area effects (Blasphemy, Unholy Communion, Discord, explosions, landings) don't need it.
- **Distance to an entity:** the 3D distance from a point to the closest point of the entity's cylinder. All radii and ranges use this unless stated otherwise.
  - Areas centered on a player measure from that player's body center.
  - **Horizontal distance between two bodies** is measured between their vertical axes.
- **Hitscan:** the ray hits the first enemy cylinder or wall or terrain. *Pierce* means it continues through up to N enemies.
- **Spread:** a uniformly random offset is added to yaw and, independently, to pitch.
- **No friendly fire.** **No lag compensation:** the host resolves shots using its own current state.

### 5.4 Projectiles
- Projectiles fly in straight lines at constant speed, with no gravity.
- Each tick they're tested as a **swept segment** (from the previous position to the new one) against target cylinders and the heightfield. Player projectiles hit enemies; enemy projectiles hit players.
- At most **400** projectiles exist at once. Spawning one more removes the oldest.

### 5.5 Damage pipeline
Every hit is resolved in this order:

1. **Kiss of Betrayal:** if the target enemy is marked, damage ×3.
2. **Brimstone Hide:** if the target is the Fallen, damage ×0.6.
3. **Invulnerability:** if the target is invulnerable, damage is 0.
4. **Shield:** the shield absorbs damage first; the remainder goes to HP.
5. **Death:** at HP 0 or below, the target dies. The player whose hit caused it gets the **kill credit**.

Other rules:
- Damage-based thresholds, such as the Judgment interrupt, count damage after step 1.
- Healing is capped at max HP. Dead players can't be healed.
- A new shield **replaces** an existing one.

### 5.6 Status effects (enemies)

| Effect | Rule |
|---|---|
| **Slowed** | Movement speed ×0.7. Re-applying refreshes the duration; it doesn't stack. |
| **Rooted** | Can't move, but can still attack and cast. |
| **Silenced** | Can't start a cast, and a cast in progress is **cancelled**. A cast that would start while silenced starts when silence ends, with its wind-up from 0. *Casts* are: Chorister orb, Cherub arrow, Gatekeeper Orb Volley and Judgment. Blessed melee isn't a cast. |
| **Marked** | Takes ×3 damage (§5.5). Only one mark exists at a time; a new mark replaces the old one. |
| **Knocked back** | Pushed horizontally over 0.2 s using normal collision, without steering. Ground enemies can fall off ledges. |

The **Gatekeeper is immune** to slow, root, pull and knockback. It can be silenced and marked.

### 5.7 Death and respawn
- **Death:** at HP 0 a player is **dead**. Their camera stays at the death position's eye height and can only rotate. The text *"You are dead — you respawn when this arena is cleared"* is shown.
- **Respawn:** when an arena is cleared, every dead connected player respawns at full HP on that arena's entry cell for their index (§8.2). The host sends `playerRespawned` to all and a `teleport` to the respawned player.
- **While dead:** the host ignores that player's position, fire and ability input.
- **Defeat:** the run is a defeat when **all connected players are dead** at the same time.
- **Singleplayer only:** after 4 s without taking damage, the player regenerates 3% of max HP per second.

---

## 6. Classes

Every class has one primary weapon with infinite ammo and two abilities. Class IDs (used in URLs, messages and the debug object) are `fallen`, `heretic`, `binder` and `betrayer`. Cooldowns start when the ability is used. "Range" for ally abilities is the ally-target range (§5.3).

### 6.1 The Fallen (Tank)
HP **400** · speed **7 m/s**
- **Brimstone Hide (passive):** takes 40% less damage (§5.5).
- **Sinful (passive):** in enemy targeting (§7.2), the Fallen's distance counts as half.

| Slot | Name | Spec |
|---|---|---|
| Primary | Brimstone Shotgun | 8 hitscan pellets × 10 dmg, spread up to ±8° in yaw and ±4° in pitch, range 20 m, 0.9 s between shots. |
| Q | Blasphemy | Every enemy within 15 m, including the Gatekeeper, targets the Fallen for 5 s. Cooldown 12 s. |
| E | Falling Star | Leaps to an ally target (range 30 m). **If there's no ally target, nothing happens and there's no cooldown.** The Fallen moves linearly from its position to the ally's position at the moment E is pressed, over 0.4 s, ignoring collision, and is invulnerable during the leap. On landing: 30 dmg to enemies within 5 m and a 4 m knockback away from the landing point. Cooldown 15 s. |

### 6.2 The Heretic Saint (Healer)
HP **150** · speed **8 m/s**

| Slot | Name | Spec |
|---|---|---|
| Primary | Censer Launcher | Projectile, 20 m/s, radius 0.2 m. Explodes on the first enemy, on a wall or terrain, or after flying 25 m: 40 dmg to enemies within 3 m of the explosion point. 1.0 s between shots. |
| Q | Unholy Communion | Heals every living player within 15 m, including self, for 80 HP. Cooldown 4 s. |
| E | Martyr's Shroud | Shield on an ally target (range 40 m), or on self if there's no ally target. It absorbs 150 dmg and lasts 8 s. Cooldown 10 s. |

### 6.3 The Binder (Support)
HP **200** · speed **8 m/s**

| Slot | Name | Spec |
|---|---|---|
| Primary | Chain Gun | Hitscan, 12 dmg, 10 shots/s, spread up to ±2° in yaw and pitch, range 40 m. Each hit slows the enemy for 1 s. |
| Q | Chains of Tartarus | Affects every non-boss enemy within 20 m that the Binder has line of sight to and whose body center is within 30° of the aim direction, seen from the Binder's eye. **Destination:** starting at the Binder's feet, walk along the horizontal aim direction in 0.25 m steps, up to 5 m. A step is blocked if its point lies in a wall, a closed door, or a floor more than 0.5 m above the previous point's floor; dropping down is allowed. The destination is the last point reached before the first blocked step. Each affected enemy moves linearly to the destination over 0.3 s, ignoring collision, then is rooted for 1.5 s. Ground enemies end on the floor there; flyers keep their hover height. Cooldown 10 s. |
| E | Discord | The **impact point** is where the crosshair ray stops, or 40 m along it if it hits nothing within 40 m. Every enemy within 8 m of that point is silenced for 4 s. Cooldown 12 s. |

### 6.4 The Betrayer (Damage)
HP **120** · speed **9 m/s**

| Slot | Name | Spec |
|---|---|---|
| Primary | Silver Revolver | Hitscan, 60 dmg, pierces up to 3 enemies, range 60 m, 0.35 s between shots. |
| Q | Kiss of Betrayal | Marks the crosshair target within 50 m, including the Gatekeeper, for 6 s. **If there's no target, nothing happens and there's no cooldown.** Cooldown 10 s. |
| E | Shadowstep | Dashes horizontally in the current movement direction (the WASD direction relative to yaw; forward if not moving) at 40 m/s for 0.2 s, which is 8 m. The dash uses normal movement rules (§5.2), gravity still applies, and it can carry the player off a ledge. Invulnerable for 0.5 s from the start. Cooldown 6 s. |

**Fire rate:** each weapon has a fire timer in seconds. While the trigger is held, the weapon fires whenever the timer is 0 or less, and adds the time between shots to it. The timer counts down every tick and, while the trigger is released, stops at 0. Comparisons use a tolerance of 1e-6 s. So the chain gun fires on every third tick, and fractions carry over between ticks.

---

## 7. Enemies

### 7.1 Types

| Type | Role | HP | Body (r × h) | Speed | Behavior |
|---|---|---|---|---|---|
| **Blessed** | Ground melee | 20 | 0.35 × 1.6 m | 6 m/s | Swarms of the righteous dead. Follows the ground flow field to its target and **stops moving within 1.0 m horizontally** of it. **Melee:** while within 1.2 m horizontally and with less than 1.5 m difference between its feet and the target's feet, it deals 5 dmg 0.5 s after entering range, then every 1 s. |
| **Chorister** | Ground ranged | 60 | 0.45 × 2.0 m | 3 m/s | Follows the ground flow field until it's within 20 m of its target with line of sight, then stops and **casts**: a 1.0 s wind-up (sprite glows), then fires an orb at the target's body center (12 m/s, 12 dmg, radius 0.3 m). Next cast starts 1.5 s after firing. Between casts, it walks again if line of sight is lost or the target is farther than 20 m. |
| **Cherub** | Flying ranged | 30 | 0.4 × 0.8 m | 7 m/s | Winged archer. **Hovers with its feet 4 m above the ground height** under it, changing height at up to 6 m/s. Follows the air flow field until it's within 25 m of its target with line of sight. Then it **strafes** sideways (perpendicular to the horizontal direction to its target) at 2 m/s, switching direction every 2 s and when blocked, and **casts** while strafing: a 0.5 s wind-up, then an arrow at the target's body center (25 m/s, 8 dmg, radius 0.15 m). Next cast starts 1.3 s after firing. Between casts, it follows the field again if line of sight is lost or the target is farther than 25 m. |
| **The Gatekeeper** | Final boss | 40 000 | 2.0 × 6.0 m | 0 | See §7.4. |

### 7.2 Targeting
- **Rule:** each enemy targets the living, connected player with the **lowest flow-field distance** from the enemy's cell. Ground enemies use the ground field and Cherubs use the air field. The Fallen's distance is halved (*Sinful*).
- **The Gatekeeper** has no flow field. It uses straight-line distance and considers only players it has line of sight to (Sinful still applies). While none are visible, it keeps its current target; if it has none, it takes the nearest living player.
- **Re-evaluation:** every 1 s, staggered across enemies by slot index. It happens **immediately** when the current target dies or disconnects.
- **Blasphemy** overrides targeting for its duration, unless the Fallen dies.
- If no living player is reachable, the enemy stands still.

### 7.3 Pathfinding (for scale)
- **Ground flow field:** one per living player, recomputed every 0.25 s. The fields are recomputed on different ticks, not all on the same one.
  - Computed with Dijkstra over 8 neighbors, cost **10** for orthogonal steps and **14** for diagonal steps (a bucket queue is enough).
  - A step from cell A to cell B is allowed if B is floor and `height(B) − height(A) ≤ 0.5 m`. Dropping down by any amount is allowed.
  - A diagonal step is allowed only if both orthogonal steps it cuts past are allowed.
  - Distances are computed **backward** from the target cell over these one-way steps, so they measure paths **to** it.
- **Air flow field:** one per living player, built the same way, except any floor cell connects to any neighboring floor cell regardless of height. Walls and closed doors still block.
- **Steering:** an enemy moves toward the center of the neighbor cell with the lowest distance. When it's in the target's cell or an adjacent one, it moves directly toward the target.
- **Separation:** two spatial hashes with 1 m cells, one for ground enemies and one for flyers; the Gatekeeper is in neither. Each tick, each enemy is pushed apart from up to 8 overlapping neighbors found in its 3×3 hash cells. The push is half the overlap each, and it is cancelled if it would make the enemy overlap a blocking cell it didn't overlap before.
- **Falling:** ground enemies that walk or are knocked off a ledge fall with gravity 20 m/s².
- **Line of sight:** each enemy checks it at most twice per second, staggered.

### 7.4 The Gatekeeper
Stands on the `B` marker, on a dais 3 m above the arena floor that players can't reach.
All timers start when the boss arena enters combat. A cast that's due while another cast or silence prevents it starts as soon as it's allowed.
- **Orb Volley (cast):**
  - The first Volley starts at 2 s. Each next one is due 4 s after the previous one fired, or was cancelled.
  - A 0.5 s wind-up, then 8 orbs spread evenly from −25° to +25° horizontally around the direction to the target's body center. Each orb does 15 dmg at 12 m/s, radius 0.3 m.
  - Volleys don't start during Judgment.
- **Judgment (cast):**
  - The first is due at 20 s. Each next one is due 25 s after the previous one completed or was interrupted.
  - If a Volley wind-up is in progress when Judgment is due, Judgment waits until the Volley fires.
  - A **3 s cast** with a large growing glow on the boss and the Judgment cast bar on screen.
  - When the cast completes, every living player whose **eye** has line of sight to the boss's eye takes damage equal to **100% of their max HP**, through the normal pipeline (§5.5). At full HP the Fallen survives thanks to Brimstone Hide, and a Martyr's Shroud absorbs 150 of it. Everyone else must break line of sight behind pillars or under the dais edge.
  - The cast is **interrupted** by Discord (silence), or by the boss taking **2 000 damage** during it.
- **Summon:** at 30 s and every 30 s after, spawns 150 Blessed and 10 Cherubs from the arena's spawn points (§8.2). It isn't a cast, so silence doesn't stop it.

### 7.5 Party-size scaling
The multiplier applies to wave counts and summon counts, the Gatekeeper's HP, and the Judgment interrupt threshold. Each enemy count is multiplied and rounded up separately; 0 stays 0.

| Players at start | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Multiplier | 0.4 | 0.6 | 0.8 | 1.0 |

The party size is the number of players at `go` (1 in singleplayer). Disconnects don't change it.

---

## 8. Dungeons and arenas

### 8.1 Map format
A dungeon is a TS module in `src/data/dungeons/<id>.ts` exporting **two ASCII grids of equal size** (one character per 1 m cell) plus the arena definitions (§8.2) in order.

The grids may be written by hand or produced by small builder helpers in `src/data/dungeons/build.ts`, such as `fillRect`, `stairs`, `pillar` and `marker`. Whichever way, the exported data is the two grids. Large maps are expected to use the helpers.

**Height layer:**

| Char | Meaning |
|---|---|
| `#` | Wall |
| `0`–`9`, `a`–`z` | Floor at height index 0–35, multiplied by 0.25 m. So `0` is 0 m, `4` is 1 m, `9` is 2.25 m, `a` is 2.5 m and `z` is 8.75 m. |

**Marker layer:**

| Char | Meaning |
|---|---|
| `.` | Nothing |
| `S` | Player spawn (exactly 4) |
| `D` | Door cell; its height-layer character is its floor height when open |
| `x` | Enemy spawn point |
| `B` | Gatekeeper position (at most 1) |

**The loader rejects a map**, with an error naming the row and column, when:
- the two grids differ in size, or a row's length differs from the first row's;
- a character is unknown;
- a marker sits on a wall;
- there aren't exactly 4 `S` markers;
- there's more than one `B`;
- an arena's `doors` entry isn't a `D` cell;
- a `D` cell isn't in exactly one arena's `doors`.

**Level validation.** These rules are checked by unit tests for every shipped map, not at runtime. Reachability is computed from the `S` cells with all doors open, using the flow-field step rules (§7.3: 8 neighbors, no corner cutting, drops allowed) with the given up-step limit.
- **Ground enemy reach:** cells reachable with up-steps of at most 0.5 m are "enemy-reachable".
- **Player reach:** cells reachable with up-steps of at most 1.0 m (jump) are "player-reachable".
- **No jump-only perches:** the two sets must be **equal**. This enforces the §5.1 rule.
- Every arena's entry cells and `x` cells are enemy-reachable.
- The `B` cell isn't player-reachable.
- Every arena has at least 6 `x` cells inside its `rect` and exactly 4 entry cells, which are floor cells inside its `rect`.
- Arena `rect`s don't overlap, and no `S` cell is inside one.
- A map has a `B` cell exactly when it has a boss arena (`boss: true`). Only the last arena can be a boss arena, and the `B` cell is inside its `rect`.

### 8.2 Arenas

```ts
{ id: string, name: string,
  rect: { x0, y0, x1, y1 },                 // inclusive cell bounds
  doors: Array<[col, row]>,                  // must be D cells
  entryCells: [[c,r],[c,r],[c,r],[c,r]],     // floor cells inside rect, one per player index
  waves: Array<{ blessed: number, choristers: number, cherubs: number }>,  // values for 4 players
  boss: boolean }
```

- A position is **inside** `rect` when `x ∈ [x0, x1 + 1)` and `y ∈ [y0, y1 + 1)`.
- An arena's **spawn points** are the `x` cells inside its `rect`.
- **Arena index** (`arenaIndex` in snapshots and the debug object): the highest-index arena that has left *idle*, or 0 if none has. `arenaPhase` is that arena's phase.

**Lifecycle:** `idle → combat → cleared`. Doors are open while idle and cleared.

1. **Start.** When any living player's feet are inside `rect`, the arena enters combat.
   - Its doors close.
   - Every living player outside `rect`, or standing on a door cell, is **teleported** to their entry cell (§9.3).
2. **Waves.**
   - Wave 1 starts immediately.
   - Wave *n + 1* starts when wave *n* has fully spawned and either at most 20% of wave *n*'s enemies are still alive, or 20 s have passed since wave *n* began spawning.
3. **Spawning** (waves and summons alike).
   - New enemies are placed on a spawn point (§2.3).
   - Each spawn point spawns at most **50 enemies per second**.
   - New enemies are assigned round-robin to spawn points more than 8 m from every living player. If there are none, all spawn points are used.
   - **Global cap:** 1 500 living enemies. Spawning pauses while the cap is reached.
   - **Type order:** within a wave, Blessed, Choristers and Cherubs are interleaved in proportion to their counts.
4. **Cleared.** When every wave has fully spawned and none of the arena's enemies are alive:
   - doors open;
   - dead players respawn at full HP on the entry cells.
5. **Boss arena.**
   - Its only wave holds the non-boss enemies. The Gatekeeper is placed on `B` when combat starts.
   - It never becomes *cleared*.
   - When the Gatekeeper dies, the result is **Victory**: every remaining enemy bursts into feathers without kill credit.
- **"Enemies remaining" (HUD):** living enemies in the arena plus enemies of the arena's waves not yet spawned. In the boss arena it counts living enemies only, excluding the Gatekeeper.

### 8.3 The Pearly Gates (values for 4 players)
Linear layout: Start room → corridor → **Arena 1** → corridor → **Arena 2** → corridor → **Arena 3**. The corridors contain stair runs and the route climbs overall. The start room holds the 4 `S` markers. There are no enemies outside arenas. Each arena has a door on the side it's entered from and, except the boss arena, one on the side it's left from.

| Arena | Size | Verticality | Waves |
|---|---|---|---|
| 1. Courtyard of Clouds | ~40 × 40 m | A central terrace 2 m high with stairs on all 4 sides. A 1 m ledge on one side to teach jumping; the top of the ledge is also reachable by stairs. | 200 Blessed; then 300 Blessed + 20 Cherubs |
| 2. Cloister of Hymns | ~50 × 40 m | A nave at floor level with pillars. Side galleries 3 m high, each reached by 2 staircases. | 300 Blessed + 20 Choristers + 20 Cherubs; then 400 Blessed + 40 Choristers + 30 Cherubs |
| 3. The Gate (boss) | ~60 × 50 m | Main floor plus side terraces at 1.5 m and 3 m, none touching the dais. The Gatekeeper's dais is 3 m high, at least 6 × 6 m, with no stairs. At least 6 pillars and the dais edge give cover from Judgment. | 10 Choristers + 10 Cherubs; plus the Gatekeeper and its summons |

### 8.4 Sandbox (dev only)
- About 48 × 48 m.
- A start room with 4 `S` markers and one arena (not a boss arena) entered through a door. The arena contains:
  - stairs;
  - a 2 m terrace;
  - a 1 m ledge whose top is also reachable by stairs;
  - 8 spawn points.
- One wave (values for 4 players): 1 000 Blessed, 20 Choristers and 20 Cherubs.

---

## 9. Networking

### 9.1 Session
- **Game ID:** 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. The host registers the PeerJS peer ID `heavenfall-<ID>`. On `unavailable-id` it generates a new ID, up to 5 attempts.
- **Topology:** a star. Each client connects only to the host. The host accepts at most 3 clients.
- **Connections:** each client opens two PeerJS DataConnections to the host:
  - `ctrl`: reliable, JSON. Used for lobby and game events.
  - `snap`: unreliable, raw `ArrayBuffer` with no PeerJS serialization. Used for client input and host snapshots.
- **Password:** kept only in the host's memory. It's sent in `hello` over the DTLS-encrypted `ctrl` channel.
- **Heartbeat:** both sides send `ping` on `ctrl` every 1 s. Any message on either channel counts as a sign of life. If nothing arrives from a peer for **5 s**, that peer is disconnected.

### 9.2 `ctrl` messages

| Direction | Message | Fields |
|---|---|---|
| C→H | `hello` | `name`, `password`, `version` |
| H→C | `welcome` | `playerId` (1–3), `lobby` (the fields of the `lobby` message) |
| H→C | `reject` | `reason`: `bad_password` \| `full` \| `in_progress` \| `version` \| `load_timeout` |
| C→H | `pickClass` | `classId` (rejected silently if taken) |
| H→all | `lobby` | `dungeonId`, `players[]` {`id`, `name`, `classId` \| null, `isHost`}; sent on every change |
| H→all | `start` | `dungeonId`, `players[]` {`id`, `name`, `classId`}, sorted by `id` |
| C→H | `ready` | — |
| H→all | `go` | — |
| H→all | `event` | One of the event types below |
| any | `ping`, `leave` | — |

`version` must equal `__BUILD_VERSION__`. "All" includes the host's own player, through `LocalTransport`, which carries the same messages without serialization.

**Event types:**

| Type | Fields | Sent to |
|---|---|---|
| `abilityUsed` | `playerId`, `slot` (`Q` \| `E`), `x`, `y`, `z`, `targetPlayerId?` | all (drives VFX at `x`, `y`, `z`: the user's feet for Blasphemy, Unholy Communion and Shadowstep; the ally's feet for Falling Star and Martyr's Shroud; the destination for Chains; the impact point for Discord; the marked enemy's feet for Kiss) |
| `teleport` | `teleportId`, `x`, `y`, `z` | the one player being moved |
| `playerDied` | `playerId` | all |
| `playerRespawned` | `playerId` | all |
| `arenaStarted` | `arenaIndex` | all |
| `arenaCleared` | `arenaIndex` | all |
| `bossCast` | `phase`: `start` \| `interrupted` \| `completed` | all |
| `gameOver` | `result`: `victory` \| `defeat`, `timeMs`, `kills`: {playerId: count} | all |

### 9.3 Input and authority

**Input to the host**, from every player at 30 Hz, binary and little-endian: on `snap` for remote clients, through `LocalTransport` for the host's own player.

| Field | Type |
|---|---|
| `seq` | u32 |
| `x`, `y`, `z` | f32 |
| `yaw`, `pitch` | f32 |
| `fireHeld` | u8 |
| `qPresses`, `ePresses` | u8 counters that wrap |
| `allyTargetId` | u8, 255 = none |
| `lastTeleportId` | u16 |

- **Order:** an input whose `seq` isn't higher than the last accepted one is ignored.
- **Why counters:** ability presses are sent as running counters instead of flags, so a lost packet can't drop a press. The host treats any increase, by any amount, as one press.
- **Movement is client-authoritative.** This is co-op, so there's no anti-cheat. The host accepts the reported position, except:
  - **Speed check:** if the horizontal distance since the previous accepted position is more than `1.2 × class speed × elapsed + 0.5 m`, where *elapsed* is host time since that input arrived, the position is clamped to that distance. The check is skipped for 0.6 s after an accepted Falling Star or Shadowstep.
  - **Floor check:** feet below the ground height are raised to it.
  - **Teleports:** a teleport moves the player on the host immediately. Inputs with `lastTeleportId` older than the host's latest teleport for that player are ignored. On receiving `teleport`, the client moves its player there at once and reports the new `teleportId`.
- **Abilities:**
  - **Non-movement abilities** (Blasphemy, Unholy Communion, Martyr's Shroud, Chains, Discord, Kiss) are resolved by the host when it sees the press, using the latest reported position and aim. If the cooldown isn't ready or the ability has no valid target, the press is ignored.
  - **Movement abilities** (Falling Star, Shadowstep) are executed by the client immediately, when its displayed cooldown is ready. The client picks the Falling Star ally and sends it in `allyTargetId`. The host accepts the press when the cooldown has 0.25 s or less remaining, then:
    - starts the cooldown;
    - applies invulnerability;
    - for Falling Star, applies the landing damage and knockback 0.4 s later, at the Fallen's latest reported position.
  - **Displayed cooldown:** the newest snapshot value minus the time since it arrived. For movement abilities, the client also starts its own timer on use and shows the larger of the two.
- **Firing:** the host resolves `fireHeld` each tick using the latest reported position and aim.

### 9.4 Snapshots
The host sends a snapshot to each client at **10 Hz**, and to its own player at **30 Hz** (every tick). The format is binary and little-endian, the same through both transports (`LocalTransport` transfers the `ArrayBuffer`).

| Block | Fields |
|---|---|
| Header | `tick` u32, `partIndex` u8, `partCount` u8, `arenaIndex` u8, `arenaPhase` u8 (0 idle, 1 combat, 2 cleared), `enemiesRemaining` u16, `bossHp` u32, `bossMaxHp` u32, `bossCast` u8 (0 none, 1 volley, 2 judgment), `bossCastProgress` u8 (0–255), `playerCount` u8, `enemyCount` u16, `projectileCount` u16 = **25 bytes** |
| Players (each) | `id` u8, `x`/`y`/`z` f32, `yaw` f32, `hp` u16, `shield` u16, `dead` u8, `cdQ`/`cdE` u16 ms remaining, `kills` u16 = **28 bytes** |
| Enemies (each) | `slot` u16, `x` u16, `y` u16 (1/64 m), `type:4` \| `state:4` u8, `flags` u8 = **8 bytes** |
| Projectiles (each) | `slot` u16, `kind` u8, `x`/`y`/`z` u16 (1/64 m) = **9 bytes** |

The counts give the number of records of each block in that part; blocks follow the header in the order above. `bossHp` and `bossMaxHp` are 0 outside the boss fight.

**Enemy encoding:**
- `type`: 0 Blessed, 1 Chorister, 2 Cherub, 3 Gatekeeper. `type` is the low 4 bits.
- `state`: 0 idle, 1 moving, 2 wind-up, 3 attacking, 4 falling.
- `flags` bits: 0 hurt since the previous snapshot sent to this recipient, 1 marked, 2 rooted, 3 silenced, 4 slowed.

**Projectile kinds:** 0 censer, 1 orb, 2 arrow.

**Message size**
- A snapshot whose encoding would exceed **16 000 bytes** is split into parts.
- Every part carries the full header, all players, and a contiguous range of the enemy and projectile lists, each part as full as fits.
- A client uses a tick only when all its parts have arrived, and otherwise drops it. A *complete snapshot* is one whose parts have all arrived.

**Rules**
- **Slots:** enemies use a pool of 4 096 slots and projectiles a pool of 1 024. A freed slot isn't reused for **1 s**, so interpolation never connects two different entities. If no slot is free, enemy spawning waits and a new projectile isn't created.
- **Enemy height isn't sent.** Clients derive it from the heightfield: ground height for ground enemies (snapping to the floor while falling, an accepted cosmetic glitch), and ground height + 4 m for Cherubs, smoothed.
- **Interpolation:** clients render remote players, enemies and projectiles **1.5 snapshot intervals in the past**: 4.5 ticks (150 ms) on remote clients, 1.5 ticks (50 ms) on the host.
  - The client's estimate of the current tick is the newest complete snapshot's tick plus the time since it arrived × 30. It renders at that estimate minus the delay.
  - Positions are interpolated linearly between the two complete snapshots around the render tick. If there's no newer one, the newest is held; there's no extrapolation.
  - The local player is drawn from local movement.
- **Feather burst:** when an enemy slot disappears from a complete snapshot, the client plays the burst at its last position. When a censer projectile disappears, the client plays the censer explosion (§10).
- **Disconnects:**
  - If the host leaves (a `leave` or heartbeat timeout), clients return to Title with the message `Host left the game`. After `gameOver`, clients ignore this, because the host closes all connections at Results.
  - If a client leaves, their player is removed and the game continues.

---

## 10. HUD and feedback

**HUD layout**
- **Center:** crosshair.
- **Bottom-left:** own HP bar, with the shield shown as a blue overlay segment.
- **Bottom-center:** first-person weapon sprite.
- **Bottom-right:** Q and E ability icons with a cooldown sweep and seconds remaining.
- **Left, multiplayer only:** party frames with name, class icon, HP and shield bar, and dead state.
- **Top, boss arena only:** Gatekeeper HP bar, with the Judgment cast bar under it.
- **Top-right:** enemies remaining.

**Feedback.** All of these are required.

| Event | Feedback |
|---|---|
| Own shot fired | Immediate, local: muzzle flash and weapon recoil (8% of screen height, recovers over 120 ms). Hitscan weapons also draw a tracer from the weapon to where the local ray stops, one per pellet. |
| Own hit (hitscan) | **Hit marker:** a white ✕ around the crosshair for 100 ms, shown immediately when the local ray test hits an interpolated enemy. This is cosmetic; the host still resolves the real hit. |
| Own kill | **Kill marker:** a red ✕ for 150 ms when the player's `kills` counter increases in a snapshot. |
| Enemy damaged | Its billboard flashes white for 100 ms when the `hurt` flag is set. |
| Enemy death | A feather and spark burst: 12 feathers and 8 sparks, lasting 0.8 s. |
| Censer explosion | An ember burst of 3 m radius, lasting 0.4 s. |
| Status on enemy | Rooted: chain ring at the feet. Silenced: grey tint. Marked: red glow and an icon above the head. Wind-up: gold glow. |
| Damage taken | A red vignette at the screen edges with opacity `clamp(lost HP and shield since the previous snapshot ÷ max HP × 3, 0.2, 0.8)`, fading over 300 ms. The HP bar shakes for 150 ms. |
| Healed | A green vignette at opacity 0.3, fading over 300 ms. |
| Shield applied or broken | Blue screen-edge pulse; the shield segment appears or disappears. |
| Ability used | VFX at the event position: taunt ring (Blasphemy), landing shockwave (Falling Star), heal ring (Unholy Communion), shield bubble on the target (Martyr's Shroud), chain lines (Chains of Tartarus), grey burst (Discord), mark beam (Kiss of Betrayal), afterimage trail (Shadowstep). |
| Judgment starts | Large centered text *"JUDGMENT — break line of sight!"* for the 3 s cast. On completion, a white full-screen flash. On interruption, the text *"Interrupted!"* for 1 s. |
| Arena started or cleared | Centered text *"The doors are sealed"* or *"Arena cleared"* for 2 s. |
| Own death | The screen desaturates to grey, with the death text (§5.7). |

---

## 11. Rendering and assets

### 11.1 Rendering
- **Sprites:** SVG files in `assets/sprites/`, one frame per entity type, rasterized at load time into one 2048² canvas atlas.
- **Billboards:** enemies, remote players, projectiles and particles are billboards that rotate only around the vertical axis.
  - They're anchored at the feet and drawn with **one `InstancedMesh`** per material, updated every frame.
  - Billboard height = body height (projectiles: 2 × radius). Width = height × the sprite's aspect ratio.
  - Status effects (§10) are tinted or glowing through per-instance color attributes.
- **First-person weapon:** a screen-space sprite at the bottom-center.
- **Terrain:** one merged mesh built from the heightfield:
  - a top quad at each floor cell's height;
  - vertical side quads wherever a neighbor floor is lower;
  - wall columns from the lowest adjacent floor up to 16 m;
  - door cells as separate meshes, shown when closed.
- **Terrain textures:** two textures generated in code with canvas (no image files): stone tiles for tops, brick for sides and walls.
- **Sky:** a gradient dome from pale blue to gold. There is no ceiling.
- **Particles:** a pool of at most 4 000. When it's full, a new particle replaces the oldest.

### 11.2 Assets
The implementing AI creates all art as hand-written SVG.

**Style rules**
- Flat shapes, at most about 40 elements per sprite.
- A dark outline at least 4% of the sprite's height.
- Colors from the §1 palette.
- Front view only, one frame each.

**Required sprites**

| Group | Sprites |
|---|---|
| Players (billboards) | Fallen, Heretic Saint, Binder, Betrayer |
| First-person weapons | Brimstone Shotgun, Censer Launcher, Chain Gun, Silver Revolver, muzzle flash |
| Enemies | Blessed, Chorister, Cherub, Gatekeeper |
| Projectiles | censer, orb, arrow |
| Particles | feather, spark, ember |
| Icons | 8 ability icons, 4 class icons |

---

## 12. Performance targets

On a mid-range laptop (integrated GPU from 2022 or later) in Chrome at 1080p:
- **60 FPS** average with 1 500 living enemies.
- An average simulation tick of **8 ms or less** in the worker.
- Host upload of **3.5 Mbit/s (437 KB/s) or less** with 3 clients in The Pearly Gates.

**How they're measured**
- **FPS and simulation time:** with `?bench=1` (§2.5). The agent runs the benchmark on its own machine and reports the numbers. The target-laptop measurement is a human checkpoint.
- **Simulation time is also a unit test** (§13.1), so it's verifiable without a GPU.
- **Upload:** the host's `netOutKBps`, checked by the multiplayer end-to-end test (§13.2).

---

## 13. Tests

**What these are:** unit tests are small automated checks that run a piece of game logic with known input and verify the exact output, for example "a player on the ground can step up 0.5 m but not 0.75 m". They run with `npm test` in seconds and catch rule regressions without playing the game. They make sense for the **simulation and protocol logic**, because those are pure TypeScript with exact rules from this spec. They don't make sense for rendering, menus or real WebRTC connections, which are covered by the end-to-end tests and checked by hand against §17.

### 13.1 Unit tests (Vitest)
Tests live next to the code as `*.test.ts`, use small hand-written test maps, and use a fixed seed.

| Area | Required checks |
|---|---|
| Map loader | Parses heights and markers. Rejects every invalid case in §8.1 with the right row and column. |
| Level validation | Every rule in §8.1 *Level validation* holds for `sandbox` and `pearly-gates`. |
| Simulation performance | The sandbox with the arena's waves disabled, 4 invulnerable players standing on its entry cells and 1 500 Blessed placed on its spawn points at tick 0, run for 300 ticks: average tick of 8 ms or less. Skipped when the `CI` environment variable is set, because shared CI machines have unreliable timing. |
| Movement | Step-up of 0.5 m is allowed and 0.75 m is blocked. A jump reaches a 1.0 m ledge but not a 1.25 m one, at both 16 ms and 50 ms frames. Walking off a ledge falls and lands. Walls block. A 2 m move in one update doesn't pass through a 1 m wall. A body placed overlapping a wall can move out of it. Ground height uses the highest overlapped non-blocking cell. Movement along x and y is applied separately. |
| Flow fields | The ground field routes via stairs, not up a cliff. Dropping down is allowed. The air field crosses cliffs. Walls block both fields. Diagonal corner-cutting is blocked. Costs are 10 and 14. |
| Targeting | Lowest distance wins. Sinful halves the Fallen's distance. Blasphemy overrides and ends when the Fallen dies. Retargeting happens immediately when the target dies. The Gatekeeper requires line of sight. |
| Damage pipeline | Each step of §5.5 in order, kill credit, heal cap, shield replacement. |
| Status effects | Slow refreshes without stacking. A rooted enemy can't move but can attack. Silence cancels a wind-up, and a cast due during silence starts when it ends. Boss immunities. |
| Abilities | One test per ability (8), including its no-target and edge cases (Chains destination at a wall and at a cliff, Chains ignoring enemies behind walls, Discord hitting nothing). |
| Combat | Hitscan range and pierce. Projectile swept hits at high speed. Hit tests at different heights. Fire timers (chain gun fires every third tick). |
| Gatekeeper | Judgment completes and damages only players in line of sight. It's interrupted by Discord and by the damage threshold. Volley and Judgment timing. Summon timing. |
| Arenas | Start on entry. Doors close. Stragglers are teleported. Wave progression at 20% and at 20 s. Spawn rate and cap. Clearing. Respawn. Victory. Defeat. `arenaIndex`. |
| Scaling | Multipliers for 1 to 4 players, rounded up per type. |
| Protocol | Snapshot and input encode/decode round-trip, splitting above 16 000 bytes, the 1 s slot reuse delay, the per-recipient `hurt` flag. Lobby: player IDs, unique classes, wrong password, full game, version mismatch. |

### 13.2 End-to-end tests (Playwright)
These are automated browser tests that click through the real built game the way a player would.
- They live in `e2e/` and run against `npm run preview` in Chromium with WebGL (SwiftShader is fine).
- They read state from `window.__heavenfall` (§2.5) and fail on any console error or uncaught page error.
- They need internet access, because multiplayer uses the public PeerJS server.

| Test | Steps and checks | From milestone |
|---|---|---|
| Singleplayer smoke | For each class, open `?dev=1&map=sandbox&class=<id>&bot=1&god=1&seed=1` and run for 15 s. Checks: `fps > 0`; `enemies > 0` in at least one sample; from milestone 3, the player's `kills > 0` at the end. | 2 (Fallen only); 3 (all 4 classes) |
| Full solo run | Open `?dev=1&map=pearly-gates&class=fallen&bot=1&god=1&seed=1`. While `arenaPhase` is `combat`, press `K` once per second. Checks: each arena reaches `combat` within 60 s of the previous one being cleared (the first within 60 s of the start); arenas 1 and 2 reach `cleared`; `gameResult` becomes `victory`; `screen` becomes `results`. | 4 |
| Menus | Using only the UI: on Title enter a name, click `Singleplayer`, pick the Fallen, click `Start`, and wait for `screen = inGame`. Press `Esc`: `paused` is true. Click `Resume`: `paused` is false. Press `Esc` and click `Leave game`: `screen = title`. | 5 |
| Multiplayer | 4 browser contexts A–D, each opening `?bot=1` (A also with `god=1`), using the real menus. (1) A hosts with password `pw` and reads the game ID. (2) B joins with password `x` and sees `Wrong password`, then joins with `pw`; C and D join. (3) A picks the Fallen; on B's screen the Fallen becomes greyed out and shows A's name. B, C and D pick the Heretic Saint, the Binder and the Betrayer. A clicks `Start`. (4) Everyone reaches `inGame` within 30 s, and A's `arenaPhase` becomes `combat` within 60 s. (5) For 30 s, sampled every 1 s: every client's `lastSnapshotTick` has increased since the previous sample; for each client, its `enemyCountsByTick` at its `lastSnapshotTick` equals A's at the same tick; A's `netOutKBps` is 437 or less. (6) A presses `Esc` and clicks `Leave game`. Every client's `screen` becomes `title` with the message `Host left the game` within 6 s. | 6 |

---

## 14. Out of scope for the MVP

Audio, ultimates, halos and loot, progression and saving, other dungeons and enemy types, overlapping floors, bridges, ceilings, moving platforms, directional or animated sprites, settings screen, gamepad, mobile, reconnecting, joining mid-game, lag compensation, client-side prediction beyond local movement, TURN relay, a self-hosted signaling server, dedicated servers, anti-cheat, chat.

## 15. Known risks

- **Strict NAT:** without a TURN relay, some players behind strict NAT can't connect (`Connection failed`). The fix after the MVP is adding a TURN server.
- **Signaling:** the public PeerJS signaling server is a free third-party service. The fix after the MVP is self-hosting `peerjs-server`.
- **Bandwidth:** The Pearly Gates peaks at about 800 living enemies, about 7.5 KB per snapshot and 1.8 Mbit/s with 3 clients. At the 1 500 enemy cap, a snapshot can reach about 16 KB, which is about 3.8 Mbit/s and over the target; that only happens in the sandbox. If real games go over budget, add relevance filtering or delta encoding before cutting the enemy count.
- **Solo balance:** solo Heretic Saint damage is low against the Gatekeeper. This is acceptable for the MVP and will be tuned after playtesting.

---

## 16. Implementation milestones

Each milestone is playable, and its tests pass, before the next one starts.

1. **Walk**
   - Vite + TypeScript + Three.js scaffold, Vitest, `docs/decisions.md` and the README update (§0).
   - Map loader, builder helpers, the sandbox map and level validation tests.
   - Terrain rendering, sky and fog.
   - First-person movement with stairs, jumping and collision, with pointer lock.
   - Dev URL mode (`map`, `class`, `seed`), the `F3` overlay and `window.__heavenfall` with the fields that exist so far.
   - The GitHub Pages workflow file.
2. **Swarm**
   - Simulation in the worker, `LocalTransport`, binary snapshots at 30 Hz to the local player, input messages.
   - The arena lifecycle (§8.2 items 1–4), spawning, party-size scaling and teleports in the sandbox.
   - Blessed and Cherubs with ground and air flow fields, targeting, separation and falling. Their attacks come in milestone 3, and Choristers in waves are skipped until then.
   - Instanced billboards, with placeholder sprites allowed.
   - `god=1`, the dev key `K`, the benchmark mode and the Node simulation benchmark: 1 500 enemies at 60 FPS.
   - The bot (shooting and abilities take effect from milestone 3).
   - The Playwright setup and the singleplayer smoke test.
3. **Fight**
   - The 4 classes: weapons and abilities, and the dev key `G`.
   - Enemy attacks, Choristers, projectiles, the damage pipeline and status effects.
   - Death, respawn and defeat, the result overlay and the Results screen. Until milestone 5, `Back to title` reloads the page.
   - HUD and all feedback (§10).
   - All sprites (§11.2).
4. **Dungeon**
   - The Pearly Gates map with multiple arenas.
   - The boss arena and the Gatekeeper.
   - Victory.
   - The full solo run test.
5. **Menus:** Title, Singleplayer Setup, Loading and Pause, and the menus test.
6. **Multiplayer:** `PeerTransport`, Host Setup, Join, Lobby, the ready/go handshake, 10 Hz snapshots with splitting and interpolation, client input, teleports over the network, heartbeat, disconnects, the Title messages and the multiplayer test.

## 17. Acceptance criteria

**Verified by the agent.** The MVP is handed over when all of these pass.
- [ ] `npm run typecheck`, `npm test` (every area in §13.1) and `npm run e2e` (every test in §13.2) pass.
- [ ] The benchmark (`?bench=1`) on the agent's machine and the Node simulation benchmark meet §12. Both results are recorded in the final report.
- [ ] Screenshots show:
  - every feedback item in §10 (short-lived ones may be captured with their durations temporarily increased, without committing that change);
  - every class's Q and E in action;
  - all three Pearly Gates arenas;
  - the Gatekeeper casting Judgment.
- [ ] The final report lists the decisions from `docs/decisions.md` and the human checkpoints.

**Verified by a human** after handover:
- [ ] A host creates a game on the GitHub Pages build. A player on another network (without strict NAT) joins with the ID and password.
- [ ] Four people complete the dungeon together, and every class feels distinct and useful.
- [ ] Single runs with each class are completable, or the balance issues are noted for tuning.
- [ ] The game keeps running for clients while the host's tab is in the background.
- [ ] The performance targets in §12 are met on the target laptop.
