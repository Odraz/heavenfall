# Playtest 3 — checklist for M12

What to try and watch for on the M12 build: [m12.md](../m12.md) §13's human criteria, and the questions the implementation left open (the M12 lines of [decisions.md](../decisions.md), the M12 section of [bench.md](../bench.md)). Afterwards, write the session up as `docs/playtests/<date>.md`, like playtest 2's.

## Before the session

- [ ] Everyone opens https://odraz.github.io/heavenfall/ and reloads, so all run the same build (a mismatched build is turned away in the Lobby).
- [ ] The build is M12's: as the Fallen, holding E shows an arc and two rings on the floor.
- [ ] Each player knows the new controls: the Fallen holds E to aim Falling Star, releases to leap, right mouse cancels; the Betrayer's Shadowstep (E) now cuts the enemies in its path.
- [ ] Screen shake is on for at least one player (Settings, on the Title or in Pause), so its effect can be judged; turn it off once to check it goes away.
- [ ] One player keeps the F3 overlay at hand for the frame time in the Cloister's last waves (the director's line shows with `?dev=1` only).
- [ ] Each class is played by someone, swapped between arenas if possible, so each has a way to clear a stack tried.

## The horde (§2, §3)

- [ ] Waves come from several sides, from wherever the party isn't, over about 10 s, each spawn point under a golden ray.
- [ ] The fights have a rhythm: a build up, a peak, about 10 s of breath (enough for Communion and most cooldowns), then the next wave. Not dead time, not nonstop.
- [ ] Backing away and holding the trigger is the weak way to play: the waves keep arriving from where the party is going.
- [ ] Getting caught in a crowd is dangerous: three Blessed hold the Fallen and the Binder in place, the Blessed strike soon after reaching you, and getting out takes a class's tool or a teammate.
- [ ] Single player (if someone tries it): HP comes back only in the breath between waves.

## Every class clears a stack (§5)

**Fallen**
- [ ] The shotgun at point blank bursts several Blessed per shot; beyond 6 m it is weak, and the slug is the tool at range.
- [ ] Falling Star: the preview is easy to read (gold-orange valid, red invalid), aiming at the floor, at your own feet (a slam) and at an ally (it snaps to them, gold chevron) all work, and it never leaps into a wall.
- [ ] A leap onto a crowd, or a slam after a taunt, crushes it: a crater of burst deaths.
- [ ] Blasphemy: the crowd recoils, red and trembling, for a moment, then comes for the Fallen. Does it pull a swarm off a teammate in time?

**Binder**
- [ ] The Scourge kills every Blessed in its arc, bursting them; Chains piles a crowd, and Falling Star or the Scourge on a pile kills it whole.

**Betrayer**
- [ ] The Silver Bullet through a lined-up crowd (a corridor, a chasing column, a Binder's pile) tears through ten.
- [ ] Shadowstep through a crowd cuts a lane. **Open:** does the first-person dagger slash look right (start, middle, end, the smear, the revolver dropping), and is the streak along the path visible? It was made a silver line on a dark band because silver alone didn't show on the marble; it's still subtle.

**Heretic**
- [ ] Incense on a crowd that stays put (taunted, piled, or clinging to a shielded or wading teammate) kills it; the censer fires faster than before.
- [ ] The Shroud's blast clears the crowd around a swarmed ally.
- [ ] Communion (120 every 8 s) feels like a timing decision ("after the wave hits"), and the party gets by with it.

## Kills that show (§4)

- [ ] Big hits look and sound brutal, the heaviest most of all (a point-blank shotgun, the Scourge, a crater, a Shroud blast); weak hits (Chain Gun bullets, incense, the shotgun at range) don't.
- [ ] Your own kills feel instant: the enemy flinches and the kill marker comes at once.
- [ ] Mass kills sound like it, and your own big moments shake the screen without making it hard to aim.
- [ ] **Open:** under heavy killing, only some burst deaths shed torn halves and swords (all of them up to 8 bursts in 0.5 s, then 1 in 4, and 1 in 8 above 24), and feathers and sparks were halved for performance. Does a crater on a pile still look torn apart? Do big fights look thin?
- [ ] **Open:** from the Fallen's own eyes, are the halves and swords lying after a crater readable, or lost in the crowd closing back in?

## Knowing how you're doing (§6)

- [ ] Players notice when they're hurt (red edge), healed (green), shielded (a steady blue edge while it lasts, a flash when it goes) and nearly dead (heartbeat and a dark crimson edge below 35% HP).
- [ ] **Open:** at the spec's strengths the shield edge (0.2) and the low-HP edge (0.3–0.55) are faint, mostly in the corners. Strong enough?
- [ ] Cherub arrows (pale cyan, with a trail) are seen coming and can be dodged.

## Performance

- [ ] The frame rate holds in the Cloister of Hymns' last waves (F3), the busiest fights with the most burst deaths. The performance gate passed without bursts but measured +4.7–5.0% (budget +3%) in its benchmark of 40 burst deaths a second. If the game stutters, note where; then decide whether to cut more of the burst look (fewer pieces, a shorter piece life, fewer spawn rays) or accept it.
- [ ] Nobody is dropped while loading (20 s limit) or mid-game.

## Afterwards

- [ ] Ask each player which class's way of clearing a stack felt best and which felt weakest, and whether being overwhelmed felt like a real risk.
- [ ] Write it up in `docs/playtests/<date>.md`: who played what, what they said, notes, analysis, decisions.
