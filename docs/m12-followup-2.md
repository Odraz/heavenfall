# M12 follow-up 2: after the multiplayer playtest

The multiplayer playtest ([playtests/2026-10-09-mp.md](playtests/2026-10-09-mp.md)) asked for three things:

1. **Backpedalling is slower** (§1): running backwards from the horde, the move playtest 2 found boring, costs speed; strafing doesn't.
2. **A score sheet on Tab** (§2): everyone's numbers during the game, as on Results.
3. **Kill streaks** (§3): quick kills build a streak, and its milestones are announced.

Nothing else changes. Out of scope: voice lines, rewards for streaks, the boss arena's enemy count, other tuning. All numbers are **initial values**.

---

## 0. Instructions for the implementing agent

1. Read this document, then [m12.md](m12.md) §0 and [m12-followup.md](m12-followup.md) §0; their rules hold here. Where they disagree, this one wins.
2. Implement the stages of §5 in order. Each stage: typecheck, unit tests and end-to-end tests pass, its features are checked with screenshots in `screenshots/m12/` with the prefix `fu2-`, and the work is committed with a message starting `M12.<stage>:` (stages 11–13).
3. Where this document is silent, choose the simplest option consistent with it and add a line to `docs/decisions.md`: `M12 follow-up 2 §<section> — <decision>`.
4. No benchmark. The playtest is the human's.

---

## 1. Backpedalling

A player moving against the way they face is slower:

- *d* = the dot product of the horizontal movement direction (`mx`, `my`, normalized) and the view's horizontal facing (from `yaw`).
- The speed factor is **1** when *d* ≥ 0, and **1 − 0.25 × (−*d*)** when *d* < 0 (`BACKPEDAL_SLOW` 0.25): straight back 75%, diagonally back about 82%, sideways and forward 100%.
- It multiplies the class speed together with wading (M12 §3.1), in `LocalPlayer.update`. It doesn't apply to Shadowstep's dash or the Falling Star's leap. It applies in the air.
- Bots move through the same code, so they are slowed too.
- The host's speed check (`1.2 × p.speed`) is unchanged: a slower player always passes it.
- `debugState` gets the factor (`backpedal`), like `wade.factor`.

---

## 2. The score sheet

### 2.1 The numbers

- `PlayerStats` gets **`bestStreak`** (§3.1). Results shows it as a last column, **Best streak**, in single player too.
- The host sends a new event **`stats`** to all, once per second of game time (every 30 ticks) while the game runs: `stats: Record<number, PlayerStats>` for the connected players, the same numbers as `gameOver` sends. Nothing else is sent for it.

### 2.2 The table

- **Hold Tab** to show it; release to hide it. The browser's default for Tab is prevented in game. It doesn't show while the chat line is open or on Pause.
- **Top left**, on the same dark plate and in the same type as the hints panel (`.hints`), above everything but Pause. If the debug overlay is open, the table goes below it.
- Columns as Results: the player's name, **Kills**, **Damage**, **Deaths**, **Revive assists** (only with more than one player), **Best streak**. Rows by player ID; your own row highlighted as on Results. Players who left are dropped at the next `stats`.
- It shows the newest `stats`; until the first one arrives, zeros.
- The general hints (`GENERAL_HINTS`) get a line **"Hold Tab: scores."**, and the hints panel shows the general lines in single player too.

---

## 3. Kill streaks

### 3.1 The rules (host)

Each player has a **streak** (count), the tick of their last credited kill, and a **best streak**.

- A credited kill (the `shooter.kills++` in the damage step, the Gatekeeper's included) within **1.0 s** (30 ticks) of the player's last credited kill adds 1 to the streak; otherwise the streak starts again at 1.
- The streak **ends** when 30 ticks pass without a kill, when the player dies, or when the game ends. It ends at the start of the tick in which it runs out, before that tick's damage.
- The best streak is the highest streak the player reached in this game.
- **Tiers**, each crossed once per streak:

  | Kills | Name |
  |---|---|
  | 10 | Sacrilege |
  | 25 | Desecration |
  | 50 | Massacre |
  | 100 | Apocalypse |
  | 200 | Armageddon |

- **Events**, to all:
  - **`streak`** `{ playerId, count, tier }` (tier 0–4) when a tick's kills take the streak over a tier. At most one per player per tick: with several tiers crossed in one tick (a Silver Bullet through a crowd), only the highest is sent.
  - **`streakEnd`** `{ playerId, count }` when a streak of at least 10 ends.

### 3.2 What players see and hear

- **Your own tier:** a banner **at the top center, 18% from the top** (below the countdown line; streaks can't happen during a countdown): the tier's name in capitals, gold, the size of the countdown's big number (`.countdown-big`) at 60%, and under it in small white type **"25 kills"** (the event's count). It pops in over 120 ms (scale 1.3 → 1), holds 1.5 s and fades over 0.5 s. A newer tier replaces it at once.
- **Your streak ends** (`streakEnd`, at least 10): the same place, small white type only, **"Streak 37"**, holding 1.5 s, fading 0.5 s. Not shown while a tier banner is up; the tier banner isn't replaced by it.
- **Someone else's tier:** a line among the chat messages (M8 §7), gold, no sender: **"Bob: Massacre (50)"**. No line for their streak's end.
- **Sound:** a new **`streakTier`**, synthesized in `sfx.ts` (a short, bright choir-like chord with a low hit, about 0.6 s), for your own tier only, at `PRIO_ABILITY`, its rate rising with the tier: `2^(2 × tier / 12)`. Others' tiers make no sound.
- Single player shows the banner and plays the sound the same way.

---

## 4. Tests

### 4.1 Unit tests

| Area | Checks |
|---|---|
| Backpedal | The factor at *d* = 1, 0, −0.707, −1 (1, 1, ≈0.823, 0.75); it multiplies with wading; dash and leap ignore it. |
| Streak | Kills 30 ticks apart continue a streak, 31 apart start a new one; death and game end end it; `streak` at 10, 25, 50, 100, 200, once each; ten kills in one tick from 8 send one event (tier 0), and from 20 to 26 in one tick one event (tier 1); `streakEnd` only from 10 up; the best streak survives a new, shorter streak. |
| Stats | `stats` every 30 ticks with every connected player's numbers, `bestStreak` included; `gameOver` carries `bestStreak`. |
| Results | The Best streak column, with one player and with four. |

### 4.2 End-to-end

In single player (`dev=1`): holding Tab shows the table with the player's row, and releasing it hides it. With `bot=1&god=1` (the Fallen) in a combat arena, the player reaches a tier and the banner appears within 90 s. (`killAll` doesn't do: its kills have no credit.)

---

## 5. Stages

11. **Backpedalling.** §1; the tests.
12. **The score sheet.** §2, with `bestStreak` counted (§3.1's rules, without events); the tests. Screenshot: the table in a four-player game (bots).
13. **Streaks.** §3.1's events, §3.2; the tests. Screenshots: a tier banner, a streak's end, another player's line.

---

## 6. Acceptance criteria

**Verified by the agent**
- [ ] Typecheck, unit tests and end-to-end tests pass, with every check of §4.
- [ ] The screenshots of §5.

**Verified by the humans in the next playtest**
- [ ] Backing away from the horde is a worse choice than strafing or turning; nobody feels stuck. The Binder can still get out.
- [ ] Tab shows how everyone's doing at a glance, without getting in the way.
- [ ] Streaks reward clearing a crowd fast; a tier feels earned, not constant. The 1 s gap neither ends streaks mid-fight nor lets one last a whole wave.
- [ ] The run is recorded with its bot count, and one run is humans only.
