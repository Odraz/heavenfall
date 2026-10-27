# Brief: Meatgrinder as a Binding of Isaac style roguelite

The developer's (Tomas's) idea of 2026-10-10, kept as written (lightly cleaned), plus the reference images, the constraints from earlier decisions and the research so far. This is the input for the spec in this folder; it is not itself the spec.

## Why

Playtest 5 (2026-10-09, two friends who like Left 4 Dead, Borderlands and Dying Light): "only running around shooting, holding the mouse button", "no choices", "not much to do", wanted to pick up and break stuff (vases), sounds annoying (synthesized SFX), character sprites weak; skybox, level art and FP guns praised. The research report [reports/What makes horde shooters fun.md](../../reports/What%20makes%20horde%20shooters%20fun.md) concluded: the feel is fine, decisions are missing. The safe play is rewarded (health never comes from enemies, ranged enemies not worth the detour), pacing has no valleys, there is no teamwork pressure (no elites, no pins), and three relics per run is a tenth of the genre's decision rate. Reference games run three reward channels at once (frequent small pickups, occasional identity-defining picks, risk/reward events).

Tomas's goal: **fun with ultimate replayability.** Keep the premise: a Doom-style 2.5D shooter with distinct classes, abilities, passives and distinctive guns.

## Tomas's idea (as written)

Level-wise make it like Binding of Isaac. Instead of pre-defined levels I want each game a different level structure, the way Isaac generates it. We can keep the dungeons-in-heaven structure (Pearly Gates etc.) but each dungeon will be different each time, thematically and artistically the same (for example level 1, the Pearly Gates, will always be golden, ivory, marble, nice views, even though the map will be different). The size of the map and the count of rooms can increase with increasing level.

Due to 3D we must be careful with windows and views onto the dungeon itself; we cannot allow it, I guess. Windows or views outside in general could be possible only at the outermost walls (the red-marked sides in image 1). Roofs can vary: they can exist or not, or partially exist.

There will be one starting/lobby room, one treasure room (locked, not close to the lobby), one merchant room, a leveling-up room (close to the boss room), one boss room (far from the lobby, should be recognizable before entry, should have only one point of entry).

Already cleared rooms don't trigger the original waves of enemies again; they remain cleared but can spawn a few basic enemies (who cannot leave the room) to let players kill something when backtracking.

Players can view the map but only see what they already cleared, or neighbouring rooms of visited rooms if they encountered doors. In each dungeon there will be somewhere a map item, or a drop, or it can be bought, which unlocks and displays the whole map. Each type of room must be visually distinctive on the map, and cleared, discovered and undiscovered rooms must also be distinguished on the map. Defeating the boss unlocks the next level.

A pool of rooms can be pre-defined so the random map generator can pick from them. I want rooms to focus on a certain style of fight. Bigger rooms focus more on horde fighting; the remaining rooms can be projectile focused, flying-enemy focused, ground-enemy focused, elite-enemy focused, hazard focused (damaging lava, slippery ice, venomous slime, slowing goo etc.) or some clever combinations, but probably not all at once. I want level design to be smart, fun, meaningful. Obstacles should have meaningful purposes (cover spots, platforming advantages, spawns etc.). Fighting in a single room shouldn't take ages but a reasonable amount of time. It can spawn enemies in waves of increasing difficulty.

Merchant and leveling-up rooms can be smaller empty rooms, like the lobby. The treasure room is a regular enemy room, but the treasure spawns with a significant beam of light (a different beam than the enemy spawn) in the middle of the arena. The treasure chest is locked when it arrives and must be unlocked by the player who holds the key. The treasure must hold something valuable, worth the effort: probably account-bound relics which provide buffs and can later be used on any character. A player can have two equipped relics. Combining them can create various interesting combos (builds).

The merchant sells items. A player has an inventory (2 slots, which can stack up to a max item count) for items like heal, speed, shield, reflect, venom etc. Enemies now have a chance to drop something:
- **halo**: currency for the merchant shop; when picked up it goes to everybody's pockets; it flies to the player when nearby to make collecting easier;
- **items**: the same ones that can be bought at the merchant, but when picked up it is used right away (if not already active). It should motivate or attract players to try new items without spending money.

In rooms there are destructible objects (which deal AoE damage, give AoE buffs, have a small chance to drop an item).

By killing enemies or healing, players are rewarded with XP, which unlocks new talent points, but those have to be learnt at the leveling-up room via some demonic medium. Here a player can also modify their build, which is otherwise locked in the dungeon: reallocate relics and talents. My idea of talents is similar to World of Warcraft or Borderlands, where each class can be specialized in three different playstyles (ranged, melee, AoE, DoT, slowing, hazards, traps, combinations etc.). Talents can also introduce new abilities, which can also be reallocated or assigned here.

Summary: a player starts the game in the browser with either a saved character's progression, or loads it from a previously saved file (some hash, I don't know), or brand new. With these characters, players can progress either in SP or MP. The host dictates which unlocked dungeons are available for the group according to their progress. In the lobby (SP or MP) a player can set up their character with unlocked relics, or reallocate talent points and assign abilities. Items remain from the last session, the last played dungeon. When playing, players explore dungeons, level up, unlock relics and new ways of killing enemies; there are potentially 3 talent trees per class × 4 classes ways of playing through the game. Players cooperate to beat the dungeon, but they can also compete in combos (count of fast consecutive kills). It would be really cool if relics + abilities + primary/secondary attacks created fun combos.

Bosses should be distinctive, appropriately complex, with multiple moves, exploring various ways of player movement (jumping, dodging), aiming (blobs which need to be destroyed etc.) and teamwork (saving other players, actions at the same time, a specific order etc.).

## Reference images (research_notes/Isaac style roguelite/images/)

1. `1.png`: a Binding of Isaac floor map (grey squares = rooms; one big 2×2 room, 1×1 rooms, a 2×1 and a 1×2-ish room; icons: crown = treasure room, coin = shop, small skull = mini-boss/challenge, red item, big dark skull room = boss). Tomas drew **red lines on the outermost faces** of the layout: only those walls may have windows or views outside.
2. `2.png`, 3. `3.png`: pixel-art "creature" shapes (Horse, Giraffe, Kangaroo, Pony, Pig, Koala, Dog, Wiener Dog, Poodle, Capybara, Rabbit, Rat) made of 1×1 circles, 2×2 squares and L-shaped blocks, each tagged with a rarity letter (C common, UC uncommon, R rare, E epic, L legendary, S special). They show room-cluster shapes built from room pieces of different sizes, with rarity tiers.
4. `4.png`: the same Isaac map, unannotated.
5. `5.webp`: a full Isaac map overlay in game (rooms of 1×1, 2×1, 2×2, L; icons for room types; HUD with hearts, coins 45, bombs 17, keys 01, a timer).

## Constraints from earlier decisions (still hold unless the spec explicitly changes them)

- **Premise and lore:** "reverse Doom": four damned heroes storm Heaven to break the seven trumpets ([lore.md](../lore.md), [heavens.md](../heavens.md): nine heavens, each a sin's opposite virtue, each with a look, a level feature, a new enemy and a boss). Angels burst into feathers and gold sparks, no blood. Flavor text states the origin plainly, no punchline ending.
- **Classes** ([classes.md](../classes.md)): the Fallen (tank, shotgun, Falling Star leap, Blasphemy taunt), the Heretic Saint (healer, censer clouds, Martyr's Shroud), the Binder (support/melee, chains, Scourge, Discord shout), the Betrayer (damage, revolver, Silver Bullet, Shadowstep dash). Design rules: one verb per class; LMB primary and RMB secondary, each better in a different situation; **one visible effect per ability, no hidden or conditional riders**; **no "press the moment it's ready" buffs**; every class fun in a pure swarm; power from doing the class's job. Healing and shielding stay separate; taunting belongs to Blasphemy only.
- **Very large enemy masses** are non-negotiable (the game targets 1 000+ enemies, browser performance is the top technical constraint).
- **Renderer:** 2.5D billboards (characters are sprites), real geometry walls with painted textures, baked floor lightmap, painted sky; the zone rule: a player must never see into another arena (M10). Painted first-person weapons (M11).
- **Netcode:** browser P2P (PeerJS/WebRTC), host-authoritative sim, 1–4 players, bots fill the party.
- **UI:** menu panels never move or resize when something opens (swap to a separate view with Back); matching rows in side-by-side cards line up; HUD slots and HP never hidden by art.
- **Specs:** minimal in scope but precise (concrete numbers, exact rules, an explicit out-of-scope list), implementable autonomously by an AI agent, stages ordered so each one's tests are satisfiable. All repo files in English.
