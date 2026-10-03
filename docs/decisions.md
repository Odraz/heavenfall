# Implementation decisions

Choices made where [mvp.md](mvp.md) is silent or ambiguous, one per line (§0).

- §2.1 — TypeScript 7 (the native `tsc`), Vite 8, Vitest 5, Three.js 0.186 and Playwright 1.63 are the latest stable versions at project start.
- §2.2 — The worker runs its first tick as soon as it starts; later ticks follow the 30 Hz accumulator.
- §2.5 — Until the Pearly Gates exists (milestone 4), `map=pearly-gates` counts as invalid and opens the sandbox.
- §2.5 — `seed` is read as a non-negative decimal integer taken modulo 2³²; any other value means a random seed.
- §2.5 — The F3 overlay also shows the local player's position and yaw; the screenshot helper (`scripts/screenshot.mjs`) steers by it.
- §2.5 — Dev keys `K` and `G` and the singleplayer pause reach the worker as internal messages, like the other host-only worker messages.
- §2.5 — Benchmark 1%-low FPS is 1000 ÷ the average frame time of the slowest 1% of frames (at least one frame) in the 30 s window.
- §2.5 — Bot: between line-of-sight checks it keeps aiming at the enemy it chose while that enemy is still in the interpolated set; it stops when within 0.2 m of its goal point; when it's in the goal's cell or next to it, it heads straight for the goal point. Its Shadowstep goes in its movement direction, or forward when it stands still.
- §3 — When the result overlay appears it replaces the death text.
- §5.2 — Feet are compared with floors using a 1e-6 m tolerance, so a jump peaking exactly at a ledge height still lands on it.
- §5.4 — Projectiles test the heightfield with their center point; their radius only enlarges the target cylinders. A projectile removed to make room for a new one (the 400 cap) doesn't explode.
- §5.6 — Knockback moves the enemy on the 6 ticks after it's applied (20 m/s for 0.2 s). A pulled enemy doesn't act during the 0.3 s pull and shows the rooted flag during it. Slow also slows Cherub strafing.
- §5.7 — Singleplayer regeneration starts 4 s after the last damaging hit or the start of the game, and only while alive.
- §6 — A cooldown starts on the tick the ability is used and counts down from the next tick. Chains of Tartarus and Discord start their cooldown even when they affect no enemy; only Kiss of Betrayal and Falling Star are exempt (§6).
- §6.1 — Falling Star's landing applies its damage first, then knocks back the survivors; an enemy exactly on the landing point is pushed along a fixed angle from its slot number.
- §6.3 — The Chains destination walk starts from the floor of the cell under the Binder's feet and checks each 0.25 m point's cell.
- §6.4 — "Pierces up to 3 enemies": one revolver shot hits at most 3 enemies (the nearest 3 along the ray).
- §7.1 — A Cherub following the air field moves straight toward its target's horizontal position when in the target's cell or next to it (only the Blessed have a stop distance).
- §7.1 — A started wind-up finishes even if line of sight or range is lost; only silence or losing the target cancels it. The projectile aims at the target's body center when it's fired. Choristers stand still while their target is in range or while winding up; Cherubs keep strafing while winding up.
- §7.1 — Enemy state `attacking` is sent while a Blessed is in melee range and on the tick a cast fires.
- §7.2 — An enemy also picks its first target when it spawns; ties in distance go to the lower player index.
- §7.3 — "Every 0.25 s" for flow fields is tick-based: player index *i* recomputes on ticks where ⌊(tick + 2i) ÷ 7.5⌋ changes (alternating 7- and 8-tick gaps, 0.25 s on average, never on the same tick as another player). Doors opening or closing recompute every field on the next tick.
- §7.3 — Separation can't carry an enemy further in a tick than it walks (its speed × 1/30 s, or its own walk if that was longer); pushes are scaled down to fit. Without this, the crowd behind shoved the front of a swarm forward at 9.2 m/s sustained, faster than the Fallen.
- §7.3 — Separation treats bodies as cylinders: two enemies overlap only if their circles and their height ranges both overlap. Enemies at exactly the same spot are pushed apart along a fixed angle derived from their slot numbers.
- §8.1 — Loader errors that aren't tied to one cell (an empty grid, fewer than 4 `S` markers) name row 0, column 0. A grid that's too large names the first row or column past 256. Grids of different sizes name the first missing row.
- §8.2 — Spawn-point budgets grow every tick in every arena, even while idle, so they are full when combat starts. The cap of 2 applies to the budget carried into the next tick (after placing), so a busy spawn point sustains exactly its rate; capping before placing would lose some (45 instead of 50 at the spec's rate).
- §8.2 — Wave progression is checked each tick before placing, so a wave that starts can place its first enemies in the same tick.
- §8.4 — Sandbox doors sit just outside the arena's `rect`, in the corridor, so entering the `rect` means passing the door.
- §9.3 — The host's floor check raises the feet to the highest floor among the cells the player's circle overlaps (walls and closed doors excluded). The speed check's first interval is measured from when the simulation started.
- §9.3 — The client counts every E press, including a Falling Star it doesn't execute for lack of an ally target; the host then ignores it.
- §9.4 — Cooldowns are sent rounded to whole milliseconds.
- §9.4 — Clients derive enemy height as the highest floor under the enemy's circle (walls excluded); Cherubs add 4 m and move toward it at up to 6 m/s, starting at the target height when a slot first appears.
- §9.4 — Interpolation draws the enemies, projectiles and other players of the snapshot at or before the render tick, moved toward the next snapshot where present; an enemy's state and flags switch to the next snapshot's halfway between them. Feather and censer bursts play after the same render delay, so they line up with the enemy or censer vanishing on screen.
- §10 — Damage taken compares HP + shield between snapshots; healed means HP went up; shield applied means the shield went up, broken means it went to 0.
- §10 — Ability VFX: taunt ring red to 15 m, heal ring green to 15 m, landing shockwave a ring to 5 m 0.4 s after the press, shield bubble a translucent blue sphere (visible from inside too), chain lines from the destination fanning out over the Binder's 30° cone, grey burst a sphere growing to 8 m, mark beam a line from the Betrayer plus a vertical column on the target, afterimage 3 darkened copies of the Betrayer's sprite at the start point (others see it, the user doesn't).
- §11.1 — Terrain is unlit, but faces get a fixed per-vertex tint by orientation and walls darken toward their base, so edges and ledges stay readable without lighting.
- §11.1 — All world billboards share one atlas material, so they are one `InstancedMesh`; billboards face the camera's horizontal right vector. Status tints are a per-instance multiply color plus a glow color and amount.
- §11.2 — Weapon sprites, the muzzle flash and the icons are drawn as HUD images straight from their SVGs, not from the atlas; the atlas holds only world sprites. Other players are drawn as billboards (hidden while dead).
- §11.1 — The Blessed's model is built from primitives in code (no external model), with a toon shader, inverted-hull ink lines and a 2 px outer contour added in post. Its halo always faces the camera so it reads as a ring from every direction, and shrinks away during the death animation. The atlas height is rounded up to a multiple of 64 instead of a power of two (2048 × 2176), since WebGL 2 mipmaps any size.
- §12 — `npm run bench` launches Playwright's Chromium headed; if that fails, it falls back to the installed Chrome, then Edge (both Chromium), and prints which one ran. During milestone 2 Playwright's headed Chromium couldn't start on the agent's machine (Windows reported a side-by-side configuration error) and the benchmark ran in Chrome; from milestone 3 it starts, and the fallback stays as a safeguard. The benchmark browser also runs with Windows occlusion detection off, so a window covering it on a shared desktop doesn't throttle its frame rate.

## Tuning changes after playtesting

The spec's numbers are initial tuning values (see the top of mvp.md); these were changed at the user's request.

- §7.1 — Blessed speed is 4 m/s (spec: 6), so every class outruns them comfortably: the Fallen by 3 m/s, the Betrayer by 5 m/s.
- §8.2 — Each spawn point places at most 10 enemies per second (spec: 50), so the swarm builds up over several seconds instead of appearing at once. The benchmark (§2.5) still reaches 1 500 enemies before measuring, about 19 s after the start in the sandbox.
