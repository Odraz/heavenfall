# M12 follow-up: after the solo playtest

The solo playtest of M12 ([playtests/2026-10-09.md](playtests/2026-10-09.md)) found it heading the right way. This follow-up is tuning plus a few small additions the notes asked for:

1. **Ranged enemies are fairer to dodge and easier to see** (§1): slower arrows, bigger Choristers and Cherubs, and every orb (the Choristers' and the Gatekeeper's volley) becomes a slow **globe** that shatters into a small golden blast, which cover blocks, and can be shot down to blast the enemies around it instead.
2. **Class tuning** (§2): the Binder gets sturdier and holds its pile longer, and everyone sees the pile chained; the Fallen's slug fires faster; the Heretic's censer hits harder and its heal and shield come less often, so each use is a decision.
3. **Healing** (§3): in single player, a breath of at least 6 s before each next wave, and a faster one; a full heal when an arena is cleared; a shorter solo boss.
4. **Arenas** (§4): a second way up Arena 1's ledge; a few Cherubs over Arena 1's terrace and a few Choristers on Arena 2's walkways late in the fight.

Nothing else changes. Out of scope: pickups, new enemy types, other arena changes, the Betrayer, the Fallen's shotgun, and the Binder's speed and slow (kept for a later pass if the Binder is still too hard). All numbers are **initial values**.

---

## 0. Instructions for the implementing agent

1. Read this document and the parts of [m12.md](m12.md) it changes (§2.1, §2.3, §2.5, §5, §6.3). Where they disagree, this one wins; the rest of M12, including its definition of done, still holds.
2. Implement the stages of §6 in order. Each stage: typecheck, unit tests and end-to-end tests pass, its features are checked with screenshots in `screenshots/m12/` with the prefix `fu-`, and the work is committed with a message starting `M12.<stage>:` (stages 6–9).
3. Where this document is silent, choose the simplest option consistent with it and add a line to `docs/decisions.md`: `M12 follow-up §<section> — <decision>`.
4. Update `classes.md`, the class cards' descriptions and hints (`classes.ts`, `weapons.ts`) and comments wherever they state a changed value.
5. No benchmark. The playtest is the human's.

---

## 1. Ranged enemies

### 1.1 Cherub arrows

Speed **18 m/s** (was 25): an arrow from 25 m takes 1.4 s (was 1.0). Damage, wind-up and the look (M12 §6.3) as now.

### 1.2 Bigger Choristers and Cherubs

| | Hit cylinder height | Radius | Drawn |
|---|---|---|---|
| Chorister | **2.4 m** (was 2.0) | 0.45 m, unchanged | **×1.2** |
| Cherub | 0.8 m, unchanged (it sets the levels' headroom) | 0.4 m, unchanged | **×1.15** |

The radius stays: movement needs a body narrower than a cell. "Drawn" scales the sprite's height and width from its feet (a new per-type draw scale; the atlases are unchanged), including its burst death, pain and stun. Everything placed by the height follows it (the taunt mark, the glows, a Chorister's cast point). Cherub hovering is unchanged.

### 1.3 The globe

Every orb, the Chorister's and the Gatekeeper's Orb Volley's alike, becomes a **globe** (`PROJ_ORB`, renamed `PROJ_GLOBE`, value 1 as now). Everything below holds for both.

- **Slower:** 8 m/s (was 12), so a globe from 20 m takes 2.5 s.
- **It shatters on what it touches:** a player, terrain, or the end of its range. It deals its damage (a Chorister's **12**, a volley's **15**) **to every living targetable player within 1.5 m** of the shatter point (`distToCylinder` to the player's cylinder) **and in line of sight of it** (`lineOfSight` from the shatter point, moved 0.1 m back along the globe's flight so it isn't inside the wall it hit, to the player's body center), once each; the player it hit directly always takes it. It doesn't hurt enemies. Cover protects: a pillar between you and the shatter blocks it, while a globe that breaks on the wall beside you, on your side of it, still hurts.
- **It can be shot down:** a player's hitscan ray (pellet, slug, bullet, Chain Gun round, Silver Bullet) or censer that passes within **0.3 m** of a globe's center (the globe itself) anywhere along the path it flew in the last **0.25 s** (so a shot hits the globe where the shooter saw it drawn, up to 2 m behind where the host has it: other players see it after their render delay), before the ray stops (terrain, its last enemy hit, or its range), shatters the globe at its center. The ray or censer carries on as if the globe weren't there. Shot down, it deals **40 dmg to every living enemy within 1.5 m** (to the cylinder) and in line of sight of its center, as a hit from that player (credited, force 40, so its kills burst by M12 §4.1), and nothing to players. At most one ray shatters a globe; the first in the host's processing order wins.
- **Event `globeShatter`:** `x, y, z` and `by` (the shooter's `playerId`, or −1 when it shattered on its own).
- **The look, on every client after the render delay:** the globe is drawn with the orb's sprite at 1.3× today's size, gold. A shatter is a **subtle golden burst**, sized to show the blast's reach: a soft gold flash (`vfx.glow`, `0xffe08a`, 0.3 → 1.0 m over 180 ms), a thin gold ground ring (`vfx.ring`, `0xffd27a`, 0.3 → 1.5 m over 250 ms) on the floor under it, and **10 glass shards** (`Particles`, gold-white, 0.08 m, thrown out at 3–5 m/s, falling, 0.6 s). Shot down: the same with a brighter flash (to 1.3 m) and 16 shards. New sound **`globeShatter`**: a glassy crack with a ringing tail, about 0.35 s, synthesized in `sfx.ts`, priority `PRIO_ABILITY`; shot down, at rate 1.2. `orbFired` plays for every globe as for an orb today.

---

## 2. Classes

### 2.1 Fallen

Slug **0.85 s** between shots (was 1.0). The shotgun is unchanged.

### 2.2 Binder

- **HP 240** (was 200).
- **Chains of Tartarus binds for 2.5 s** (`CHAINS_ROOT`, was 1.5), so the Binder reaches the pile with the Scourge.
- **The chains show** (every client, cosmetic): when a Chains pull ends (0.3 s after the cast, at the pile point: the Chains destination, already sent as `abilityUsed` Q's `x, y, z`), **6 red-hot chains** come down onto the pile, forming an inverted cone:
  - each runs from a point on a circle of **5 m** radius **8 m** above the pile point's floor to a point on a circle of **1.2 m** radius on that floor, the 6 evenly spaced around the circles with a random rotation, the bottom point at the same angle as the top;
  - each is a camera-facing strip **0.22 m** wide (Sacrament's `Ribbon`), *beam* texture, `0xff5a1e` with a near-white `0xffd2a0` core, additive;
  - they come down from the top over **120 ms** (cubic ease-out), as the spawn ray does, hold, and fade out over the last **0.4 s** of **1.2 s**; a red ground ring (`vfx.ring`, `0xff5a1e`, 0.5 → 1.6 m over 300 ms) where they land;
  - Chains with no targets show nothing. A new cast replaces the chains of the same Binder's previous one;
  - other clients start them 0.3 s after `abilityUsed`, after the render delay; the Binder's own client 0.3 s after its own event.

Speed (6 m/s) and the Fetters slow (0.7) are unchanged.

### 2.3 Heretic

HP stays 150. Less self-sustain, so the heal and the shield are timing decisions rather than buttons pressed when ready, and more damage on one target:

- **Censer impact 60 dmg** (was 40), to the enemy it hits only, as now. It kills a Chorister in one hit.
- **Unholy Communion cooldown 10 s** (was 8). Heal 120 as now.
- **Martyr's Shroud cooldown 12 s** (was 10). Shield 150 and burst as now.
- **Incense cloud radius 3 m** (was 2.5), drawn to match. Damage, pulses and duration as now.

Self-sustain falls from about 30 HP/s (120 per 8 s + 150 per 10 s) to about 24.5 HP/s. Damage on the Gatekeeper rises from about 57 per second to about 81.

---

## 3. Healing

### 3.1 A breath before each wave (single player)

In single player, in the three combat arenas:
- **The 30% rule leads to a breath:** in build up, when the wave is fully placed and 30% or fewer of it are left, the director enters **relax** instead of starting the next wave at once (M12 §2.3). A player who clears fast gets a breath too; before, only a peak led to one, so a well-played arena could pass with no healing at all.
- **Relax lasts at least 6 s** before it can start the next wave. Its exits are otherwise as now (2 s below 25, or 10 s with 30% or fewer left).
- **The breath** (M12 §2.5): **8%** of max HP per second after **2 s** without damage (was 5% after 3 s), still only in relax. A 6 s breath gives back up to 32%.

Multiplayer is unchanged.

### 3.2 A full heal when an arena is cleared

When an arena is cleared, **every living player is healed to full HP** at once, in every mode, as the fallen are already brought back at full (MVP §8.2). No waiting in the corridor. Elsewhere, regeneration is as today.

### 3.3 A shorter solo boss

The Gatekeeper's solo multiplier is **0.3** (was 0.4): 8 700 HP, and Judgment's interrupt threshold scales with it (390). Its summons and every other count keep today's multipliers.

---

## 4. Arenas

### 4.1 A second way up Arena 1's ledge

Arena 1's 1 m ledge (x 26–35, y 33–39) has stairs only on its east side, so enemies come up one 2-cell funnel. Add a **0.5 m step** at its north-west corner: cells (26, 32) and (27, 32), `g.stairs(26, 32, 27, 32, 'S', 0.5, 0.5)`. The rest of the north edge stays a jump.

### 4.2 Squads: Cherubs over the terrace, Choristers on the bridge

A wave may have a **squad**: a few enemies of one type placed only on the squad's own points.

- **`WaveDef.squad?: { type: 'cherubs' | 'choristers'; count: number; at: Array<[number, number]> }`**, count for 4 players, scaled by `scaleCount`.
- **Placement:** starting **5 s** after the wave starts, one squad enemy every **0.5 s**, round-robin over the squad's points that are more than **8 m** from every living player (`distToCylinder`, the 8 m rule); when none is, it waits. Not affected by the wave's 15 m rule or its pace budget. Squad enemies count in the wave's total, its living count and enemies remaining, and the wave is fully placed only when its squad is too.
- **Spawn rays** (M12 §2.4) flare on squad points as on spawn points (the map exposes each arena's squad points beside its spawn points).

| Arena | Wave 3 | Wave 4 | Points (cell) |
|---|---|---|---|
| 1. Courtyard of Clouds | 6 Cherubs | 10 Cherubs | the terrace's inner corners: (40, 18), (47, 18), (40, 25), (47, 25) |
| 2. The Cloudbridge | 4 Choristers | 6 Choristers | on the 3.5 m walkways: (88, 21), (104, 21), (109, 29), (98, 33) |

Solo, that's 3 and 4 Cherubs, and 2 and 3 Choristers. The regular waves of M12 §2.1 are unchanged.

---

## 5. Tests

| Area | Required checks |
|---|---|
| Numbers | The values of §1.1, §1.2, §2 and §3.3 in `ENEMIES`, `CASTERS`, `CLASSES`, `WEAPONS`, `SECONDARIES`, `ABILITIES` and the constants. |
| Globe | A Chorister and the volley fire `PROJ_GLOBE` at 8 m/s. On a player a Chorister's globe deals 12 to that player and to another 1.2 m away, not to one 2 m away, not to one 1.2 m away behind a pillar, and not to enemies; a volley globe deals 15. On terrain and at the end of its range it shatters the same way. A pellet passing 0.25 m from it shatters it (not at 0.4 m) and still hits the enemy behind; the shatter deals 40 to enemies within 1.5 m (not at 2 m, not behind a pillar), credited, and nothing to players; a censer passing by shatters it and flies on. One `globeShatter` per shatter, with `by`. |
| Binder | Bound for 2.5 s; 240 HP. |
| Heretic | Censer impact 60; Communion cooldown 10 s; Shroud cooldown 12 s; a cloud reaches 3 m (an enemy at 2.9 m takes a pulse, not at 3.1 m). |
| Breath | Single player: the 30% rule in build up enters relax, not the next wave; relax never starts a wave before 6 s; 8% per second after 2 s, only in relax. Multiplayer: the 30% rule starts the next wave at once, as now. |
| Clear | On a clear, a living player at 30% HP is at full; in single player and with 2 players. |
| Boss | Solo Gatekeeper 8 700 HP, interrupt 390; with 2 players unchanged. |
| Squads | Arena 1's waves 3 and 4 place 6 and 10 Cherubs (3 and 4 solo) only on the terrace points, from 5 s after the wave starts, one per 0.5 s, never within 8 m of a player (they wait); they count in the wave's total; the wave isn't fully placed until they are. Same for Arena 2's Choristers. |
| Ledge | Cells (26, 32) and (27, 32) are 0.5 m; the ledge is reachable on foot from both stairs (the flow field reaches the ledge's west end through them). |

The full solo end-to-end run must still clear every arena within its limits (each wave now waits at least 6 s in relax); record its time.

---

## 6. Stages

6. **The numbers and healing.** §1.1, §1.2, §2.1, §2.2 without the chains' look, §2.3, §3; the texts (§0.4); the tests.
7. **The globe.** §1.3; the tests.
8. **The arenas.** §4.1, §4.2; the tests.
9. **The chains.** §2.2's look. Screenshots: the chains mid-descent and holding over a pile, from the Binder and from a distance.

Screenshots for stages 6–8: a Chorister and a Cherub beside a Blessed at the new sizes; a globe in flight, shattering on the floor, and shot down among Blessed; the ledge's new step; Cherubs over Arena 1's terrace.

---

## 7. Acceptance criteria

**Verified by the agent**
- [ ] Typecheck, unit tests and end-to-end tests pass, with every check of §5.
- [ ] The screenshots of §6.

**Verified by the human in the next playtest**
- [ ] Cherub arrows and globes are fair to dodge, and cover protects from a globe's blast; Choristers and Cherubs stand out in a crowd.
- [ ] Shooting a globe down takes aim and feels like a reward, not the main way to clear; its blast reads as a small golden burst.
- [ ] The Binder gets past Arena 2 solo and reaches its pile in time; the chains make the bind obvious.
- [ ] The Heretic's heal and shield feel like decisions; the Heretic is less unkillable; its solo boss fight is long but not hopeless.
- [ ] Solo, every wave is followed by a breath that gives enough back; nobody waits after a clear.
- [ ] Arena 1's ledge can't be held from one spot; the Cherubs and the bridge Choristers add a threat late in the fight without swamping it.
