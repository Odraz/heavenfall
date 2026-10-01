# MVP Specification

Working title: **Heavenfall**. The repository name is a placeholder.

The MVP is a **fully working prototype**, not the full game. Up to four players, each in a different role, fight through one short dungeon against over a thousand enemies, in the browser, at 60 FPS. Everything listed here must work; everything else is out of scope (§14).

All numbers are **initial tuning values**. They are precise so the first build is unambiguous, and they are expected to change after playtesting.

Units are meters (m), seconds (s), milliseconds (ms) and hit points (HP).

---

## 0. Instructions for the implementing agent

**Approach**
1. **Read the whole spec first.** Then implement the milestones in §16 strictly in order. Don't start a milestone until the previous one meets its definition of done.
2. **This spec is the source of truth.** If it's silent or ambiguous, choose the simplest option consistent with it and record the choice as one line in `docs/decisions.md` (section number and decision). Don't add anything listed in §14 or anything else not specified here.
3. **Definition of done for each milestone:**
   - `npm run typecheck`, `npm test` and (from milestone 2) `npm run e2e` all pass;
   - the milestone's features were checked visually: run the dev server, open it in the browser and take screenshots;
   - the work is committed.

**Git and housekeeping**
- Work on the branch `mvp`, with at least one commit per milestone and messages starting `M<n>:`.
- Don't push, rewrite history or change repository settings.
- In milestone 1, add `node_modules/`, `dist/`, `test-results/` and `playwright-report/` to `.gitignore`. Replace the README's *Getting started* section with the npm commands and the dev URLs.

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
  render/          three.js scene, billboards, first-person weapon, VFX
  net/             Transport interface, LocalTransport, PeerTransport, protocol encode/decode
  data/            classes, enemies, dungeons (plain TS data)
assets/sprites/    SVG source art
```

- **One code path.** Every game has exactly one **host simulation**, and every player, including the host's own player, talks to it through a `Transport`.
  - **Singleplayer:** the host simulation runs locally. The player uses `LocalTransport` with no network.
  - **Multiplayer, host's own player:** uses `LocalTransport`.
  - **Multiplayer, remote clients:** use `PeerTransport`.
  - Rendering and input code never knows which transport it's using.
- **The host simulation runs in a dedicated Web Worker.** Browsers pause `requestAnimationFrame` and throttle timers on the main thread when a tab is in the background, which would freeze the game for every player if the host alt-tabs. The worker isn't throttled that way.
  - The host's main thread owns the PeerJS connections and relays messages between remote clients and the worker.
  - `LocalTransport` is `postMessage` to the worker.
- **The simulation is authoritative** for enemies, projectiles, damage, abilities, cooldowns and arena state. Each player's own position is **client-authoritative** (§9.3).
- **Simulation tick:** a fixed **30 Hz**, using an accumulator driven by `performance.now()` inside the worker.
- **Randomness:** all simulation randomness (spawn point choice, pellet spread) uses a seeded PRNG (mulberry32). The seed is random per game unless set with `?seed=` in dev mode.
- **Local player movement** runs on each player's own main thread, every render frame (dt clamped to 50 ms). It uses the shared module `sim/movement.ts`, which the host also uses for validation.

### 2.3 Conventions
- **Simulation coordinates:** `x` points east (grid column), `y` points south (grid row), `z` points up.
- **Grid cells:** cell `(col, row)` covers `x ∈ [col, col+1)`, `y ∈ [row, row+1)`. ASCII row 0 is the first line of the map.
- **Three.js mapping:** `three.x = x`, `three.y = z`, `three.z = y`. This is a pure axis swap; don't negate anything.
- **Yaw** is measured from +x toward +y. **Pitch** is positive when looking up.
- **Aim direction** = `(cos(pitch)·cos(yaw), cos(pitch)·sin(yaw), sin(pitch))`.

### 2.4 Version and deployment
- **Build version:** the constant `__BUILD_VERSION__` is `<package.json version>-<git short hash>`, injected by Vite's `define`.
- **Deployment:** the workflow `.github/workflows/pages.yml` runs typecheck, unit tests and build, then deploys `dist/` to GitHub Pages on every push to `main`. Vite uses `base: './'`. The repository has no remote yet, so the workflow only starts working after the human checkpoint in §0.

### 2.5 Dev and test tools
All URL parameters also work in the production build, because the end-to-end tests run against it.

- **Menu skip:** `?dev=1&map=<sandbox|pearly-gates>&class=<fallen|heretic|binder|betrayer>[&seed=N]` skips the menus and starts a singleplayer game directly.
- **Dev keys** (only with `dev=1`): `G` toggles invulnerability, `K` kills every living enemy.
- **Benchmark:** `?bench=1` starts the sandbox with an invulnerable Betrayer that doesn't shoot.
  - The simulation keeps **exactly 1 500 Blessed** alive, respawning any that die. The camera slowly rotates in place.
  - After 30 s it shows the average and 1%-low FPS and the average and max simulation ms on screen.
  - It also logs one console line: `BENCH {"fps":…,"fpsLow":…,"simMs":…,"simMsMax":…}`.
- **Bot:** `?bot=1` replaces the local player's input. It works together with the normal menus. Each tick the bot:
  - aims at the nearest enemy it has line of sight to, and holds fire while one exists;
  - presses Q and E whenever they're ready;
  - walks toward the host's player when farther than 6 m from it (the host's own bot just walks toward the nearest enemy);
  - jumps when blocked.
  It never needs pointer lock.
- **Sandbox map:** `sandbox` is a small test map (§8.4) used from milestone 1. It isn't selectable in the menus.
- **Debug overlay:** `F3` toggles it in every mode. It shows FPS, simulation ms per tick, living enemies, projectiles, and network KB/s in and out.
- **Debug object:** `window.__heavenfall` is a read-only object, updated every frame, for tests to read: `{ screen, fps, simMs, tick, lastSnapshotTick, enemies, projectiles, arenaIndex, arenaPhase, players: [{ id, classId, hp, dead, kills }], gameResult }`.

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
| **Title** | Game title, **Player name** field (1–16 chars, remembered in `localStorage`) | `Singleplayer`, `Multiplayer` (both disabled while the name is empty) |
| **Singleplayer Setup** | Class picker (4 cards: name, role, HP, 1-line description), dungeon picker (1 entry: *The Pearly Gates*) | `Start` (enabled once a class is picked), `Back` |
| **Multiplayer** | — | `Host game`, `Join game`, `Back` |
| **Host Setup** | Password field (0–32 chars; empty means an open game), dungeon picker | `Create` (registers the game ID, then goes to Lobby; errors shown inline), `Back` |
| **Join** | Game ID field (6 chars, case-insensitive, normalized to upper case), password field | `Join` (connects, then goes to Lobby; errors shown inline), `Back` |
| **Lobby** | Game ID shown large with a `Copy` button (host only); dungeon name; 4 player slots (name, class, "host" tag); class picker | Everyone: pick a class. Host: `Start`. Everyone: `Leave` |
| **Loading** | Progress text | — |
| **In Game** | 3D view and HUD (§10) | Pause overlay: `Resume`, `Leave game` |
| **Results** | *Victory* or *Defeat*, run time, kills per player | `Back to title` |

**Lobby rules**
- There are 4 slots, and the host occupies one of them and picks a class too.
- Each class can be taken by **only one player**. A taken class is greyed out and shows who took it.
- The host's `Start` button is enabled only when every connected player has picked a class. Starting with 1 to 4 players is allowed.
- A player leaving the lobby frees their slot and class.

**Loading**
- In singleplayer, Loading builds the map and sprite atlas, then enters the game.
- In multiplayer:
  1. The host sends `start`.
  2. Every player, including the host, loads and sends `ready`.
  3. When all players are ready, the host sends `go` and everyone enters the game at the same time.
  4. A client not ready after 20 s receives `reject { reason: 'load_timeout' }`, returns to Title with an error, and the game starts without them.
- Player *i* in the `start` player list spawns on the *i*-th `S` marker in reading order.

**Pause**
- The Pause overlay opens whenever **pointer lock is lost**. Browsers consume `Esc` to release pointer lock, so a keydown handler isn't reliable.
- `Resume` re-requests pointer lock. The click on the button counts as the required user gesture.
- In singleplayer, Pause pauses the simulation. In multiplayer it doesn't.

**Errors, shown inline**

| Screen | Error | Cause |
|---|---|---|
| Host Setup | `Couldn't reach the matchmaking server` | Signaling server unreachable, or 5 attempts at registering a game ID failed. |
| Join | `Game not found` | PeerJS `peer-unavailable`. |
| Join | `Wrong password`, `Game is full`, `Game already started`, `Version mismatch` | The matching `reject` reason (§9.2). |
| Join | `Connection failed` | Any other error, or no `welcome` within 10 s. |

**End of game**
- On victory or defeat, the result is shown as a large text overlay for 3 s, then the Results screen appears.
- The session ends at Results: the host closes all connections and destroys its PeerJS peer.
- **Leaving:** `Leave game` and `Leave` send `leave` and return to Title.

---

## 4. Controls and camera

| Input | Action |
|---|---|
| Mouse | Look. Pointer lock is requested on the first click in game. |
| W A S D | Move |
| Space | Jump |
| Left mouse (hold) | Primary weapon |
| Q | Ability 1 |
| E | Ability 2 |
| Esc | Release pointer lock, which opens Pause |
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
- **Bodies:** every player and enemy is a vertical cylinder with its feet at `z`. Players are radius 0.4 m and height 1.8 m, with eyes at 1.6 m above the feet.
- **Overlapped cells:** the cells whose squares intersect the body's circle. **Ground height** is the highest floor height among the overlapped floor cells.
- **Blocking cells.** A cell blocks a body if any of these is true:
  - it is a wall or a closed door;
  - the body is grounded and the cell's floor is more than **0.5 m** above the feet (step-up limit);
  - the body is airborne and the cell's floor is above the feet.
- **Resolution:**
  - Horizontal movement is applied **along x, then along y**. Each axis move is cancelled if the circle would then overlap a blocking cell.
  - A grounded body whose ground height rises (by 0.5 m or less) snaps its feet up to it.
  - A body whose ground height drops below its feet becomes airborne.
  - An airborne body lands when its feet reach the ground height.
- **Players:**
  - Horizontal movement has instant acceleration and full air control. Speed is set per class (§6).
  - **Jump:** vertical velocity 7 m/s, only while grounded. With gravity, a jump peaks at about 1.22 m, so ledges up to about 1.2 m can be climbed.
  - **Gravity:** 20 m/s². There is no fall damage.
  - Players pass through enemies and other players.
- **Ground enemies:** use the same rules with their own radius. They never jump.
- **Flying enemies:** collide with walls and closed doors only. Their height is set by hovering (§7.1).

### 5.3 Aiming and targeting
- **Crosshair ray:** a 3D ray from the player's eye along the aim direction. It stops at the first enemy cylinder it hits, or at a wall or terrain (any point where the ray is below the floor height of the cell it's passing through).
- **Crosshair target:** the enemy hit by the crosshair ray, if any.
- **Ally target:** the living ally (not self) with the smallest angle between the aim direction and the direction to the ally's body center. The angle must be **10° or less**, the ally must be within the ability's range, and there must be line of sight. **Enemies don't block ally targeting.**
- **Line of sight:** a 3D segment between two points, blocked by walls, closed doors and terrain only.
- **Distance to an entity:** the 3D distance from a point to the closest point of the entity's cylinder. All radii and ranges use this unless stated otherwise.
- **Hitscan:** the ray hits the first enemy cylinder or wall or terrain. *Pierce* means it continues through up to N enemies.
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
| **Silenced** | Can't start a cast. A cast in progress is **cancelled** and its timer restarts from 0. *Casts* are: Chorister orb, Cherub arrow, Gatekeeper Orb Volley and Judgment. Blessed melee isn't a cast. |
| **Marked** | Takes ×3 damage (§5.5). Only one mark exists at a time; a new mark replaces the old one. |
| **Knocked back** | Pushed horizontally over 0.2 s using normal collision. Ground enemies can fall off ledges. |

The **Gatekeeper is immune** to slow, root, pull and knockback. It can be silenced and marked.

### 5.7 Death and respawn
- **Death:** at HP 0 a player is **dead**. Their camera stays at the death position's eye height and can only rotate. The text *"You are dead — you respawn when this arena is cleared"* is shown.
- **Respawn:** when an arena is cleared, every dead connected player respawns at full HP on that arena's entry cells (§8.2). The host sends `playerRespawned` to all and a `teleport` to the respawned player.
- **While dead:** the host ignores that player's position, fire and ability input.
- **Defeat:** the run is a defeat when **all connected players are dead** at the same time.
- **Singleplayer only:** after 4 s without taking damage, the player regenerates 3% of max HP per second.

---

## 6. Classes

Every class has one primary weapon with infinite ammo and two abilities. Cooldowns start when the ability is used. "Range" for ally abilities is the ally-target range (§5.3).

### 6.1 The Fallen (Tank)
HP **400** · speed **7 m/s**
- **Brimstone Hide (passive):** takes 40% less damage (§5.5).
- **Sinful (passive):** in enemy targeting (§7.2), the Fallen's distance counts as half.

| Slot | Name | Spec |
|---|---|---|
| Primary | Brimstone Shotgun | 8 hitscan pellets × 10 dmg, random spread up to ±8° horizontally and ±4° vertically, range 20 m, 0.9 s between shots. |
| Q | Blasphemy | Every enemy within 15 m, including the Gatekeeper, targets the Fallen for 5 s. Cooldown 12 s. |
| E | Falling Star | Leaps to an ally target (range 30 m). **If there's no ally target, nothing happens and there's no cooldown.** The Fallen moves linearly from its position to the ally's position over 0.4 s, ignoring collision, and is invulnerable during the leap. On landing: 30 dmg to enemies within 5 m and a 4 m knockback away from the landing point. Cooldown 15 s. |

### 6.2 The Heretic Saint (Healer)
HP **150** · speed **8 m/s**

| Slot | Name | Spec |
|---|---|---|
| Primary | Censer Launcher | Projectile, 20 m/s, radius 0.2 m. Explodes on the first enemy, on a wall or terrain, or after 25 m: 40 dmg to enemies within 3 m. 1.0 s between shots. |
| Q | Unholy Communion | Heals every living player within 15 m, including self, for 80 HP. Line of sight isn't required. Cooldown 4 s. |
| E | Martyr's Shroud | Shield on an ally target (range 40 m), or on self if there's no ally target. It absorbs 150 dmg and lasts 8 s. Cooldown 10 s. |

### 6.3 The Binder (Support)
HP **200** · speed **8 m/s**

| Slot | Name | Spec |
|---|---|---|
| Primary | Chain Gun | Hitscan, 12 dmg, 10 shots/s, random spread up to ±2°, range 40 m. Each hit slows the enemy for 1 s. |
| Q | Chains of Tartarus | Affects every non-boss enemy within 20 m whose direction from the Binder's eye is within 30° of the aim direction. **Destination:** walk from the Binder along the horizontal aim direction in 0.25 m steps, up to 5 m; the destination is the last point reached without crossing a blocking cell. Each affected enemy moves linearly to the destination over 0.3 s, ignoring collision, then is rooted for 1.5 s. Ground enemies end on the floor there; flyers keep their hover height. Cooldown 10 s. |
| E | Discord | The **impact point** is where the crosshair ray stops, or 40 m along it if it hits nothing within 40 m. Every enemy within 8 m of that point is silenced for 4 s. Cooldown 12 s. |

### 6.4 The Betrayer (Damage)
HP **120** · speed **9 m/s**

| Slot | Name | Spec |
|---|---|---|
| Primary | Silver Revolver | Hitscan, 60 dmg, pierces up to 3 enemies, range 60 m, 0.35 s between shots. |
| Q | Kiss of Betrayal | Marks the crosshair target within 50 m, including the Gatekeeper, for 6 s. **If there's no target, nothing happens and there's no cooldown.** Cooldown 10 s. |
| E | Shadowstep | Dashes horizontally in the current movement direction (forward if not moving) at 40 m/s for 0.2 s, which is 8 m. The dash uses normal movement rules (§5.2) and can carry the player off a ledge. Invulnerable for 0.5 s from the start. Cooldown 6 s. |

**Fire rate:** each weapon fires when the trigger is held and its fire timer is ready. Timers are measured in seconds and checked every tick, so the chain gun fires on the ticks where 0.1 s has passed. Fractions carry over between ticks.

---

## 7. Enemies

### 7.1 Types

| Type | Role | HP | Body (r × h) | Speed | Behavior |
|---|---|---|---|---|---|
| **Blessed** | Ground melee | 20 | 0.35 × 1.6 m | 6 m/s | Swarms of the righteous dead. Follows the ground flow field to its target and **stops moving within 1.0 m horizontally** of it. **Melee:** while within 1.2 m horizontally and with less than 1.5 m difference between its feet and the target's feet, it deals 5 dmg 0.5 s after entering range, then every 1 s. |
| **Chorister** | Ground ranged | 60 | 0.45 × 2.0 m | 3 m/s | Follows the ground flow field until it's within 20 m of its target with line of sight, then stops and **casts**: a 1.0 s wind-up (sprite glows), then fires an orb at the target's body center (12 m/s, 12 dmg, radius 0.3 m). Next cast starts 1.5 s after firing. Walks again if line of sight is lost. |
| **Cherub** | Flying ranged | 30 | 0.4 × 0.8 m | 7 m/s | Winged archer. **Hovers with its feet 4 m above the ground height** under it, changing height at up to 6 m/s. Follows the air flow field until it's within 25 m of its target with line of sight. Then it **strafes** sideways at 2 m/s (switching direction every 2 s and when blocked) and **casts**: a 0.5 s wind-up, then an arrow at the target's body center (25 m/s, 8 dmg, radius 0.15 m). Next cast starts 1.3 s after firing. |
| **The Gatekeeper** | Final boss | 40 000 | 2.0 × 6.0 m | 0 | See §7.4. |

### 7.2 Targeting
- **Rule:** each enemy targets the living, connected player with the **lowest flow-field distance** from the enemy's cell. Ground enemies use the ground field and Cherubs use the air field. The Fallen's distance is halved (*Sinful*).
- **The Gatekeeper** has no flow field. It uses straight-line distance, considers only players it has line of sight to (Sinful still applies), and keeps its current target while none are visible.
- **Re-evaluation:** every 1 s, staggered across enemies by slot index. It happens **immediately** when the current target dies or disconnects.
- **Blasphemy** overrides targeting for its duration, unless the Fallen dies.
- If no living player is reachable, the enemy stands still.

### 7.3 Pathfinding (for scale)
- **Ground flow field:** one per living player, recomputed every 0.25 s.
  - Computed with Dijkstra over 8 neighbors, cost **10** for orthogonal steps and **14** for diagonal steps (a bucket queue is enough).
  - A step from cell A to cell B is allowed if B is floor and `height(B) − height(A) ≤ 0.5 m`. Dropping down by any amount is allowed.
  - A diagonal step is allowed only if both orthogonal steps it cuts past are allowed.
  - Distances are computed **backward** from the player's cell over these one-way steps, so they measure paths **to** the player.
- **Air flow field:** one per living player, built the same way, except any floor cell connects to any neighboring floor cell regardless of height. Walls and closed doors still block.
- **Steering:** an enemy moves toward the center of the neighbor cell with the lowest distance. When it's in the target's cell or an adjacent one, it moves directly toward the target.
- **Separation:** two spatial hashes with 1 m cells, one for ground enemies and one for flyers. Each tick, each enemy is pushed apart from up to 8 overlapping neighbors found in its 3×3 hash cells. The push is half the overlap each, and it is cancelled if it would enter a blocking cell.
- **Falling:** ground enemies that walk or are knocked off a ledge fall with gravity 20 m/s².
- **Line of sight:** each enemy checks it at most twice per second, staggered.

### 7.4 The Gatekeeper
Stands on the `B` marker, on a dais 3 m above the arena floor that players can't reach. Its eye is 5 m above its feet.
All timers start when the boss arena enters combat.
- **Orb Volley (cast):**
  - The first Volley starts at 2 s. Each next one starts 4 s after the previous one fired, or was cancelled.
  - A 0.5 s wind-up, then 8 orbs spread evenly across ±25° horizontally, aimed at the target's body center. Each orb does 15 dmg at 12 m/s.
- **Judgment (cast):**
  - The first starts at 20 s. Each next one starts 25 s after the previous one completed or was interrupted.
  - If a Volley wind-up is in progress when Judgment is due, Judgment waits until the Volley fires.
  - A **3 s cast** with a large growing glow on the boss and the Judgment cast bar on screen.
  - When the cast completes, every living player with line of sight to the boss's eye takes damage equal to **100% of their max HP**, through the normal pipeline (§5.5). The Fallen survives thanks to Brimstone Hide, and a fresh Martyr's Shroud saves its target. Everyone else must break line of sight behind pillars or under the dais edge.
  - The cast is **interrupted** by Discord, or by the boss taking **2 000 damage** during it.
  - Orb Volley doesn't fire during Judgment.
- **Summon:** at 30 s and every 30 s after, spawns 150 Blessed and 10 Cherubs from the arena's spawn points (not a cast; silence doesn't stop it).

### 7.5 Party-size scaling
The multiplier applies to wave counts and summon counts (rounded up), the Gatekeeper's HP, and the Judgment interrupt threshold.

| Players at start | 1 | 2 | 3 | 4 |
|---|---|---|---|---|
| Multiplier | 0.4 | 0.6 | 0.8 | 1.0 |

The party size is fixed at `go`. Disconnects don't change it.

---

## 8. Dungeons and arenas

### 8.1 Map format
A dungeon is a TS module in `src/data/dungeons/<id>.ts` exporting **two ASCII grids of equal size** (one character per 1 m cell) plus the arena definitions.

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
| `D` | Door cell |
| `x` | Enemy spawn point |
| `B` | Gatekeeper position (at most 1) |

**The loader rejects a map**, with an error naming the row and column, when:
- the two grids differ in size;
- a character is unknown;
- a marker sits on a wall;
- there aren't exactly 4 `S` markers;
- there's more than one `B`;
- a door cell doesn't belong to exactly one arena.

**Level validation.** These rules are checked by unit tests for every shipped map, not at runtime. Reachability is computed from the `S` cells with all doors open.
- **Ground enemy reach:** every cell reachable with up-steps of at most 0.5 m (drops allowed) is "enemy-reachable".
- **Player reach:** every cell reachable with up-steps of at most 1.2 m (jump) is "player-reachable".
- **No jump-only perches:** the two sets must be **equal**. This enforces the §5.1 rule.
- Every arena's entry cells and `x` cells are enemy-reachable.
- The `B` cell isn't player-reachable.
- Every arena has at least 6 `x` cells and exactly 4 entry cells. Entry cells are floor cells inside its `rect`.

### 8.2 Arenas

```ts
{ id: string, name: string,
  rect: { x0, y0, x1, y1 },                 // inclusive cell bounds
  doors: Array<[col, row]>,                  // must be D cells
  entryCells: [[c,r],[c,r],[c,r],[c,r]],     // floor cells inside rect, one per player index
  waves: Array<{ blessed: number, choristers: number, cherubs: number }>,
  boss: boolean }
```

An arena's spawn points are the `x` cells inside its `rect`. Each arena needs at least 6.

**Lifecycle:** `idle → combat → cleared`.

1. **Start.** When any living player's position is inside `rect`, the arena enters combat.
   - Its doors close.
   - Every living player outside `rect`, or standing on a door cell, is **teleported** to their entry cell (§9.3).
2. **Waves.**
   - Wave 1 starts immediately.
   - Wave *n + 1* starts when wave *n* has fully spawned and either at most 20% of wave *n*'s enemies are still alive, or 20 s have passed since wave *n* began spawning.
3. **Spawning.**
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
Linear layout: Start room → corridor → **Arena 1** → corridor → **Arena 2** → corridor → **Arena 3**. The corridors contain stair runs and the route climbs overall. The start room holds the 4 `S` markers. There are no enemies outside arenas.

| Arena | Size | Verticality | Waves |
|---|---|---|---|
| 1. Courtyard of Clouds | ~40 × 40 m | A central terrace 2 m high with stairs on all 4 sides. A 1 m ledge on one side to teach jumping. | 200 Blessed; then 300 Blessed + 20 Cherubs |
| 2. Cloister of Hymns | ~50 × 40 m | A nave at floor level with pillars. Side galleries 3 m high, each reached by 2 staircases. | 300 Blessed + 20 Choristers + 20 Cherubs; then 400 Blessed + 40 Choristers + 30 Cherubs |
| 3. The Gate (boss) | ~60 × 50 m | Main floor plus side terraces at 1.5 m and 3 m. The Gatekeeper's dais is 3 m high with no stairs. At least 6 pillars and the dais edge give cover from Judgment. | 10 Choristers + 10 Cherubs; plus the Gatekeeper and its summons |

### 8.4 Sandbox (dev only)
- About 48 × 48 m.
- A start room with 4 `S` markers, a door, and one arena containing:
  - stairs;
  - a 2 m terrace;
  - a 1 m ledge;
  - 8 spawn points.
- One wave: 1 000 Blessed, 20 Choristers and 20 Cherubs.

---

## 9. Networking

### 9.1 Session
- **Game ID:** 6 characters from `ABCDEFGHJKLMNPQRSTUVWXYZ23456789`. The host registers the PeerJS peer ID `heavenfall-<ID>`. On `unavailable-id` it generates a new ID, up to 5 attempts.
- **Topology:** a star. Each client connects only to the host. The host accepts at most 3 clients.
- **Connections:** each client opens two PeerJS DataConnections to the host:
  - `ctrl`: reliable, JSON. Used for lobby and game events.
  - `snap`: unreliable, raw `ArrayBuffer` with no PeerJS serialization. Used for client input and host snapshots.
- **Password:** kept only in the host's memory. It's sent in `hello` over the DTLS-encrypted `ctrl` channel.
- **Heartbeat:** both sides send `ping` on `ctrl` every 1 s. If nothing arrives from a peer for **5 s**, that peer is disconnected.

### 9.2 `ctrl` messages

| Direction | Message | Fields |
|---|---|---|
| C→H | `hello` | `name`, `password`, `version` |
| H→C | `welcome` | `playerId` (0–3), `lobby` |
| H→C | `reject` | `reason`: `bad_password` \| `full` \| `in_progress` \| `version` \| `load_timeout` |
| C→H | `pickClass` | `classId` (rejected silently if taken) |
| H→all | `lobby` | `dungeonId`, `players[]` {`id`, `name`, `classId` \| null, `isHost`} |
| H→all | `start` | `dungeonId`, `players[]` {`id`, `name`, `classId`} |
| C→H | `ready` | — |
| H→all | `go` | — |
| H→all | `event` | One of the event types below |
| any | `ping`, `leave` | — |

`version` must equal `__BUILD_VERSION__`.

**Event types:**

| Type | Fields | Sent to |
|---|---|---|
| `abilityUsed` | `playerId`, `slot` (`Q` \| `E`), `x`, `y`, `z`, `targetPlayerId?` | all (drives VFX) |
| `teleport` | `teleportId`, `x`, `y`, `z` | the one player being moved |
| `playerDied` | `playerId` | all |
| `playerRespawned` | `playerId` | all |
| `arenaStarted` | `arenaIndex` | all |
| `arenaCleared` | `arenaIndex` | all |
| `bossCast` | `phase`: `start` \| `interrupted` \| `completed` | all |
| `gameOver` | `result`: `victory` \| `defeat`, `timeMs`, `kills`: {playerId: count} | all |

`LocalTransport` carries the same messages without serialization.

### 9.3 Input and authority

**Client to host input**, every 30 Hz, on `snap`:

| Field | Type |
|---|---|
| `seq` | u32 |
| `x`, `y`, `z` | f32 |
| `yaw`, `pitch` | f32 |
| `fireHeld` | u8 |
| `qPresses`, `ePresses` | u8 counters that wrap |
| `allyTargetId` | u8, 255 = none |
| `lastTeleportId` | u16 |

- **Why counters:** ability presses are sent as running counters instead of flags, so a lost packet can't drop a press. The host treats any increase as a press.
- **Movement is client-authoritative.** This is co-op, so there's no anti-cheat. The host accepts the reported position, except:
  - **Speed check:** if the horizontal distance since the previous accepted position is more than `1.2 × class speed × elapsed + 0.5 m`, the position is clamped to that distance. The check is skipped for 0.6 s after an accepted Falling Star or Shadowstep.
  - **Floor check:** feet below the ground height are raised to it.
  - **Teleports:** inputs with `lastTeleportId` older than the host's latest teleport for that player are ignored.
- **Abilities:**
  - **Non-movement abilities** (Blasphemy, Unholy Communion, Martyr's Shroud, Chains, Discord, Kiss) are resolved by the host when it sees the press, using the latest reported position and aim. If the cooldown isn't ready or the ability has no valid target, the press is ignored.
  - **Movement abilities** (Falling Star, Shadowstep) are executed by the client immediately, when its displayed cooldown is ready. The client picks the Falling Star ally and sends it in `allyTargetId`. The host then:
    - starts the cooldown;
    - applies invulnerability;
    - for Falling Star, applies the landing damage and knockback 0.4 s later, at the Fallen's latest reported position.
- **Firing:** the host resolves `fireHeld` each tick using the latest reported position and aim.

### 9.4 Snapshots
The host sends a snapshot to each client at **10 Hz**, and to its own player through `LocalTransport` at **30 Hz** (every tick). The format is binary and little-endian.

| Block | Fields |
|---|---|
| Header | `tick` u32, `partIndex` u8, `partCount` u8, `arenaIndex` u8, `arenaPhase` u8 (0 idle, 1 combat, 2 cleared), `enemiesRemaining` u16, `bossHp` u32, `bossMaxHp` u32, `bossCast` u8 (0 none, 1 volley, 2 judgment), `bossCastProgress` u8 (0–255) |
| Players (each) | `id` u8, `x`/`y`/`z` f32, `yaw` f32, `hp` u16, `shield` u16, `dead` u8, `cdQ`/`cdE` u16 ms remaining, `kills` u16 |
| Enemies (each) | `slot` u16, `x` u16, `y` u16 (1/64 m), `type:4` \| `state:4` u8, `flags` u8 = **8 bytes** |
| Projectiles (each) | `slot` u16, `kind` u8, `x`/`y`/`z` u16 (1/64 m) = **9 bytes** |

**Enemy encoding:**
- `type`: 0 Blessed, 1 Chorister, 2 Cherub, 3 Gatekeeper.
- `state`: 0 idle, 1 moving, 2 wind-up, 3 attacking, 4 falling.
- `flags` bits: 0 hurt since the previous snapshot, 1 marked, 2 rooted, 3 silenced, 4 slowed.

**Projectile kinds:** 0 censer, 1 orb, 2 arrow.

**Message size**
- A snapshot whose encoding would exceed **16 000 bytes** is split into parts.
- Every part carries the full header, all players, and a contiguous range of the enemy and projectile lists.
- A client uses a tick only when all its parts have arrived, and otherwise drops it.

**Rules**
- **Enemy height isn't sent.** Clients derive it from the heightfield: ground height for ground enemies (snapping to the floor while falling, an accepted cosmetic glitch), and ground height + 4 m for Cherubs, smoothed.
- **Slots** of dead enemies and removed projectiles aren't reused for **1 s**, so interpolation never connects two different entities.
- **Interpolation:** clients render remote players, enemies and projectiles **1.5 snapshot intervals in the past** (150 ms remote, 50 ms on the host). The local player is drawn from local movement.
- **Feather burst:** when an enemy slot disappears from a complete snapshot, the client plays the burst at its last position.
- **Disconnects:**
  - If the host leaves (a `leave` or heartbeat timeout), clients show *"Host left the game"* and return to Title.
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
| Own shot fired | Immediate, local: muzzle flash, weapon recoil (8% of screen height, recovers over 120 ms), and a hitscan tracer from the weapon to where the local ray stops. |
| Own hit | **Hit marker:** a white ✕ around the crosshair for 100 ms, shown immediately when the local ray test hits an interpolated enemy. This is cosmetic; the host still resolves the real hit. |
| Own kill | **Kill marker:** a red ✕ for 150 ms when the player's `kills` counter increases in a snapshot. |
| Enemy damaged | Its billboard flashes white for 100 ms when the `hurt` flag is set. |
| Enemy death | A feather and spark burst: 12 feathers and 8 sparks, lasting 0.8 s. |
| Status on enemy | Rooted: chain ring at the feet. Silenced: grey tint. Marked: red glow and an icon above the head. Wind-up: gold glow. |
| Damage taken | A red vignette at the screen edges with opacity `clamp(lost HP and shield ÷ max HP × 3, 0.2, 0.8)`, fading over 300 ms. The HP bar shakes for 150 ms. |
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
- **Particles:** a pool of at most 4 000.

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
| Particles | feather, spark |
| Icons | 8 ability icons, 4 class icons |

---

## 12. Performance targets

On a mid-range laptop (integrated GPU from 2022 or later) in Chrome at 1080p:
- **60 FPS** with 1 500 living enemies.
- A simulation tick of **8 ms or less** in the worker.
- Host upload of **3.5 Mbit/s or less** with 3 clients.

**How they're measured**
- **FPS and simulation time:** with `?bench=1` (§2.5). The agent runs the benchmark on its own machine and reports the numbers. The target-laptop measurement is a human checkpoint.
- **Simulation time is also a unit test:** 1 500 Blessed chasing 4 players in the sandbox for 300 ticks, with an average tick of **8 ms or less** in Node. This makes it verifiable without a GPU.
- **Upload:** `F3` network KB/s on the host during the multiplayer end-to-end test.

---

## 13. Tests

**What these are:** unit tests are small automated checks that run a piece of game logic with known input and verify the exact output, for example "a player on the ground can step up 0.5 m but not 0.75 m". They run with `npm test` in seconds and catch rule regressions without playing the game. They make sense for the **simulation and protocol logic**, because those are pure TypeScript with exact rules from this spec. They don't make sense for rendering, menus or real WebRTC connections, which are checked by hand against §17.

### 13.1 Unit tests (Vitest)
Tests live next to the code as `*.test.ts`, use small hand-written test maps, and use a fixed seed.

| Area | Required checks |
|---|---|
| Map loader | Parses heights and markers. Rejects every invalid case in §8.1 with the right row and column. |
| Level validation | Every rule in §8.1 *Level validation* holds for `sandbox` and `pearly-gates`. |
| Simulation performance | The §12 Node benchmark: average tick of 8 ms or less. |
| Movement | Step-up of 0.5 m is allowed and 0.75 m is blocked. A jump reaches a 1.0 m ledge but not a 1.5 m one. Walking off a ledge falls and lands. Walls block. Ground height uses the highest overlapped cell. Movement along x and y is applied separately. |
| Flow fields | The ground field routes via stairs, not up a cliff. Dropping down is allowed. The air field crosses cliffs. Walls block both fields. Diagonal corner-cutting is blocked. Costs are 10 and 14. |
| Targeting | Lowest distance wins. Sinful halves the Fallen's distance. Blasphemy overrides and ends when the Fallen dies. Retargeting happens immediately when the target dies. The Gatekeeper requires line of sight. |
| Damage pipeline | Each step of §5.5 in order, kill credit, heal cap, shield replacement. |
| Status effects | Slow refreshes without stacking. A rooted enemy can't move but can attack. Silence cancels a wind-up. Boss immunities. |
| Abilities | One test per ability (8), including its no-target and edge cases (Chains destination at a wall, Discord hitting nothing). |
| Combat | Hitscan range and pierce. Projectile swept hits at high speed. Hit tests at different heights. |
| Gatekeeper | Judgment completes and damages only players in line of sight. It's interrupted by Discord and by the damage threshold. Summon timing. |
| Arenas | Start on entry. Doors close. Stragglers are teleported. Wave progression at 20% and at 20 s. Spawn cap. Clearing. Respawn. Victory. Defeat. |
| Scaling | Multipliers for 1 to 4 players, rounded up. |
| Protocol | Snapshot encode/decode round-trip, splitting above 16 000 bytes, the 1 s slot reuse delay. Lobby: unique classes, wrong password, full game, version mismatch. |

### 13.2 End-to-end tests (Playwright)
These are automated browser tests that click through the real built game the way a player would.
- They live in `e2e/` and run against `npm run preview` in Chromium with WebGL (SwiftShader is fine).
- They read state from `window.__heavenfall` (§2.5).
- They need internet access, because multiplayer uses the public PeerJS server.

| Test | Steps and checks | From milestone |
|---|---|---|
| Singleplayer smoke | For each class, open `?dev=1&map=sandbox&class=<id>&bot=1`. For 15 s: no console errors, `fps > 0`, `enemies > 0`, and (from milestone 3) the bot's kill count rises. | 2 (all 4 classes from 3) |
| Full solo run | `?dev=1&map=pearly-gates&class=fallen&bot=1&seed=1`, with the test pressing `G` (invulnerable) and `K` (kill all) to advance each arena. Checks that every arena goes idle → combat → cleared, `gameResult` becomes `victory`, and Results is shown. | 4 |
| Menus | From Title through Singleplayer Setup into the game, through Pause, and back to Title, using only the UI. | 5 |
| Multiplayer | 4 browser contexts, all with `?bot=1`, using the real menus. The host creates a game with a password. One client first joins with a wrong password and checks for `Wrong password`. Three clients join. A duplicate class pick is refused. Everyone picks a different class and the host starts. For 30 s, every client's `lastSnapshotTick` keeps rising and its `enemies` count is within 5% of the host's. Then the host clicks `Leave game`, and every client shows *"Host left the game"* and returns to Title within 6 s. | 6 |

A milestone (§16) is done only when `npm run typecheck`, `npm test` and every end-to-end test available at that milestone pass.

---

## 14. Out of scope for the MVP

Audio, ultimates, halos and loot, progression and saving, other dungeons and enemy types, overlapping floors, bridges, ceilings, moving platforms, directional or animated sprites, settings screen, gamepad, mobile, reconnecting, joining mid-game, lag compensation, TURN relay, a self-hosted signaling server, dedicated servers, anti-cheat, chat.

## 15. Known risks

- **Strict NAT:** without a TURN relay, some players behind strict NAT can't connect (`Connection failed`). The fix after the MVP is adding a TURN server.
- **Signaling:** the public PeerJS signaling server is a free third-party service. The fix after the MVP is self-hosting `peerjs-server`.
- **Bandwidth:** about 12 KB per snapshot at 1 500 enemies. If it goes over budget, add relevance filtering or delta encoding before cutting the enemy count.
- **Solo balance:** solo Heretic Saint damage is low against the Gatekeeper. This is acceptable for the MVP and will be tuned after playtesting.

---

## 16. Implementation milestones

Each milestone is playable, and its tests pass, before the next one starts.

1. **Walk**
   - Vite + TypeScript + Three.js scaffold.
   - Map loader with the sandbox map.
   - Terrain rendering and sky.
   - First-person movement with stairs, jumping and collision.
   - Dev URL mode, the `F3` overlay and `window.__heavenfall`.
   - The GitHub Pages workflow file, `.gitignore` and README updates (§0).
2. **Swarm**
   - Simulation in the worker, `LocalTransport`, snapshots at 30 Hz to the local player.
   - Blessed and Cherubs with ground and air flow fields, separation and falling.
   - Instanced billboards.
   - The benchmark mode and the Node simulation benchmark: 1 500 enemies at 60 FPS.
   - The bot (shooting is added in milestone 3).
   - The Playwright setup and the singleplayer smoke test.
3. **Fight**
   - The 4 classes: weapons and abilities.
   - Choristers, projectiles, the damage pipeline and status effects.
   - Death and respawn.
   - HUD and all feedback (§10).
   - All sprites (§11.2).
4. **Dungeon**
   - The Pearly Gates map and the arena lifecycle.
   - The Gatekeeper.
   - Victory, defeat and the Results screen.
5. **Menus:** Title, Singleplayer Setup, Loading and Pause.
6. **Multiplayer:** `PeerTransport`, Host Setup, Join, Lobby, the ready/go handshake, 10 Hz snapshots with splitting and interpolation, client input, teleports, heartbeat and disconnects.

## 17. Acceptance criteria

**Verified by the agent.** The MVP is handed over when all of these pass.
- [ ] `npm run typecheck`, `npm test` (every area in §13.1) and `npm run e2e` (every test in §13.2) pass.
- [ ] The benchmark (`?bench=1`) on the agent's machine and the Node simulation benchmark meet §12. Both results are recorded in the final report.
- [ ] Screenshots show:
  - every feedback item in §10;
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
