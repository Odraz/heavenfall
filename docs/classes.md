# Classes

What each class is for and how it should feel. This is a living design document, like [lore.md](lore.md): it records intent, not exact rules. Milestone specs (`m<n>.md`) turn changes here into exact rules; current values live in the code and [decisions.md](decisions.md).

Numbers here are starting points for the spec.

## Design rules

- **One verb per class**, and one big moment a player would tell friends about.
- **Two attacks per class.** Left mouse fires the primary, right mouse the secondary, both with infinite ammo. Each is clearly the better one in some situation (a crowd or one target, near or far, an enemy or an ally), so neither is worth holding all the time.
- **Every ability rewards timing.** Its value depends on where and when it's used. An ability worth pressing the moment it's ready is a stat, not a decision.
- **One effect per ability, with no hidden riders.** A second effect is allowed only if it's visible on its own (a knockback, an explosion); invisible or conditional bonuses aren't. Taunting belongs to Blasphemy only. Healing and shielding stay separate.
- **Every class is fun in a pure swarm of Blessed.** Elite enemies may reward a class, but no class needs them.
- **Power comes from doing the class's job**, not from stats. Each class has a weakness another class covers.

## Milestone 9: the class rework

M9 is dedicated to the changes below; halos and ultimates move to M13 (M10 became the level art, M11 the first-person weapons, M12 the horde). In short:

- **Every class gets a secondary attack** on the right mouse button.
- **The Fallen:** the shotgun knocks enemies back, Falling Star launches them into the air, and it moves slower.
- **The Heretic Saint:** heals one ally with the secondary. Martyr's Shroud explodes when broken.
- **The Binder:** swings a chain at enemies around it with the secondary, and moves slower.
- **The Betrayer:** a new kit built for the swarm. Kiss of Betrayal is removed.
- **The Gatekeeper's HP is retuned:** Kiss was the party's main boss multiplier, and Field of Blood replaces it.

Swarm kill rates should stay roughly level across classes (about 5–9 Blessed per second), with the Betrayer's Silver Bullet the best in a good lane. The Heretic Saint is the exception on purpose: its censer softens the crowd the party holds (about 1 kill per second plus its clouds), and its strength is keeping everyone alive.

## Milestone 12: the horde

The second playtest ([playtests/2026-10-08.md](playtests/2026-10-08.md)) found that fighting the horde was "back up and hold the trigger": it merged into one crowd behind the party, being caught was harmless, kills didn't show, and most classes had no way to clear a crowd. The horde stays; M12 ([m12.md](m12.md)) makes **clearing it fun, with a real risk of being overwhelmed**, before any new enemy types or threats:

- **The horde surrounds the party, paced by a director:** bigger waves that keep arriving for 10 s from wherever the party isn't, each started by a director that watches how hard-pressed the party is (build up, peak, relax), with a gold glow where enemies spawn.
- **Being caught is dangerous:** players wade through crowds (each enemy pressing on them slows them, down to 55%), and the Blessed strike sooner.
- **Every class clears a stack its own way**, in its own shape: the Fallen a **circle** around itself (taunt the crowd on, shotgun at point blank, the crater or a slam at its own feet), the Binder an **arc** (pile with Chains, sweep with the Scourge), the Betrayer a **line** (Silver Bullet through ten, the dash cut), the Heretic an **area** (incense on a held crowd, the Shroud's blast). The Fallen and the Binder stack crowds; the Betrayer and the Heretic cash them in.
- **Kills show:** sudden big damage blasts an enemy back and tears it apart (a Blessed torn in half, a Cherub losing its wings) in a burst of light and feathers, heavier for the heaviest blows; your own kills are confirmed on your screen at once; your big moments shake the screen.

Kill rates may now go well above 9 per second where a class does its job on a stacked crowd. Clearing a stack is meant to feel like a payoff, not a stat.

## The Fallen (Tank)

- **Verb:** intercept. **Big moment:** "I leapt in and smashed the swarm off them."
- **Weakness:** can't heal itself; needs the Heretic.
- **Speed:** 6 m/s (was 7). It still outruns the Blessed (4 m/s), but not by much, so it can't walk away from a swarm quickly. Falling Star is how it gets somewhere fast.

| Slot | Name | Rule |
|---|---|---|
| Primary | Brimstone Shotgun | 8 pellets, range 20 m. **M12:** 20 dmg per pellet within 6 m, 10 beyond (was 12), spread ±11° (was ±8°), 0.9 s between shots (was 0.8): up close every pellet kills a Blessed and bursts it; backing away, a Blessed needs two pellets. M9: each enemy hit within 6 m that survives is knocked back 2 m away from the Fallen, once per shot however many pellets hit it. Bound enemies aren't knocked back, so the Binder's piles hold. |
| Secondary | Brimstone Slug | One hitscan slug: 60 dmg to the first enemy hit, range 50 m, 0.85 s between shots (**M12 follow-up:** was 1.0; the shotgun stays at 0.9 s). Kills a Chorister in one hit. |
| Passives | Brimstone Hide, Sinful | As now. |
| Q | Blasphemy | As before: every enemy within 12 m targets the Fallen for 5 s, cooldown 12 s. **M12:** it also stuns them for 1 s (not the Gatekeeper), mainly as a visual beat: the crowd recoils ("what was that?!"), trembling and red, sees the Fallen and comes for it. Stunned enemies don't slow anyone wading, so a swarmed ally walks out. |
| E | Falling Star | The leap and the knockback. M9: the landing launches the enemies it knocks back. Each flies in an arc up to about 1 m high, out and back down, over 0.4 s; the distance is 4 m. Bound enemies aren't knocked back, like the shotgun's, so the Binder's piles hold. **M12:** it leaps anywhere within 30 m, not only to an ally: hold E to see the arc and the landing rings, release to leap. Aimed within 2.5 m of an ally, it lands on them; aimed at its own feet, it slams in place. Red, and no leap, where the arc hits a wall or the landing isn't a place enemies can walk to (the Gatekeeper's dais). The landing deals 40 dmg within 3.5 m, which bursts the Blessed under it heavily, and 10 dmg out to 6 m. Cooldown 10 s (was 15): it's the Fallen's main crowd tool, kept for rescues only by choice. Landing on the Binder's pile kills it whole (bound enemies take double and stay). |

- **Shotgun or slug:** the shotgun for the crowd at the Fallen's feet; the slug for the Chorister or Cherub out of its reach.
- **The landing has to look like a hit.** A crater of burst Blessed and a ring of enemies flung into the air around the landing (often around the rescued ally) is the Fallen's big moment made visible. The shotgun's knockback stays a flat shove, so the landing stands out. The arc is only drawn: in the simulation the enemy moves along the ground as in any knockback, so collision and the network barely change.

## The Heretic Saint (Healer)

- **Verb:** sustain. **Big moment:** "Everyone was nearly dead and I brought the whole party back."
- **Weakness:** fragile and weak against crowds; needs the party close.

| Slot | Name | Rule |
|---|---|---|
| Primary | Censer Launcher | Breaks on the enemy it hits for 60 (**M12 follow-up:** was 40, for the boss fight), with no splash, and leaves a rusty-gold cloud of incense for 4 s. Clouds don't stack, and at most 6 exist, so spamming one spot doesn't help and can't cover the map. (Added after review: the old splash made the healer a grenade launcher.) **M12:** 0.85 s between shots (was 1.0 s); the cloud deals 5 per pulse (was 2.5), pulsing the moment it lands and every 0.5 s, so a Blessed that stays in it dies in 1.5 s; an enemy in two clouds still takes one pulse. **M12 follow-up:** the cloud's radius is 3 m (was 2.5). |
| Secondary | Sacrament | While held, heals the ally target 15 HP every 0.5 s (range 40 m, the same ally target as Martyr's Shroud). That's 1.5 times the rate Communion gives everyone nearby. Aimed at a soul, it revives it instead, at the Heretic's double revive rate (about 1.5 s). With no ally target it does nothing. Never heals the Heretic. |
| Q | Unholy Communion | Heals everyone within 15 m, the Heretic included. **M12:** 120 HP every 8 s (was 80 every 4 s): less healing overall, but a timing decision ("after the wave hits") instead of a button pressed whenever ready. **M12 follow-up:** cooldown 10 s: the Heretic's own sustain from Communion and the Shroud, not its HP, made it nearly unkillable. |
| Passive | Last Rites | Revives fallen teammates twice as fast (the existing rule, now named). |
| E | Martyr's Shroud | When damage breaks it, it explodes for 50 dmg to every enemy within 3.5 m of the shielded player (**M12:** was the 8 nearest within 5 m; uncapped over 5 m it would have out-killed the Fallen's crater). It doesn't explode when it expires or is replaced. It still explodes if the Heretic has died or left, or if the hit that breaks it kills the shielded player. **M12 follow-up:** cooldown 12 s (was 10). |

- **Where the censer goes:** a cloud is worth most on enemies that stay in it: the crowd hugging the taunting Fallen, or the Binder's pile, where bound enemies take double and often die before the pile breaks. A crowd running through it only loses a few HP.
- **Censer or Sacrament:** the censer while the party holds; Sacrament when one teammate is in trouble, even far away. Every second spent healing is a second not killing, which is the Heretic's real decision.
- Sacrament is what playtesters expected the Heretic to do ("aim at someone to heal them").
- **Sacrament's advantage is range**: it heals one ally anywhere within 40 m, where Communion reaches 15 m. While it heals, the left button can't fire censers or stop the beam. The right button works only while an ally is aimed at; with no ally target, holding both buttons fires censers.
- **Sacrament draws a beam** from the Censer Launcher's muzzle (as others see it, from just in front of the Heretic's body) to the healed ally's body center, for as long as it heals. Everyone sees it. The beam is green like every heal (M8 §1), with green-tinted embers drifting along it toward the ally, so it reads as "healing flows this way". It reuses the *beam* effect texture of the tracers, on a strip that faces the camera. The healed player gets a faint green vignette while the beam is on them, not a flash every tick.
- **Martyr's Shroud** rewards shielding whoever is about to be swarmed: the swarm breaks the shield and dies to the blast.

## The Binder (Support)

- **Verb:** control. **Big moment:** "I dragged a whole crowd into one pile and we shredded it."
- **Weakness:** must stand in the crowd to kill fast, with 240 HP (**M12 follow-up:** was 200) and no escape; needs others to cash in its piles.
- **Speed:** 6 m/s (was 8). It still outruns the Blessed, but it has no escape ability, so it must stay near the Fallen.

| Slot | Name | Rule |
|---|---|---|
| Primary | Chain Gun | As now: fast, accurate, slows. |
| Secondary | Scourge | Swings a heavy chain in front of the Binder: 25 dmg to every enemy within 3 m and 120° of the aim (**M12:** was the 6 nearest, so the swing passed visibly through enemies it didn't hurt), 0.8 s between swings. Like every Binder hit, it slows them for 1 s. |
| Q | Chains of Tartarus | As now: pull a crowd and bind it. **M12 follow-up:** bound for 2.5 s (was 1.5), so the Binder reaches the pile with the Scourge; red-hot chains come down onto the pile so everyone sees it's bound. |
| E | Discord | As now: silence. |
| Passive | Fetters | Every Chain Gun and Scourge hit slows for 1 s (the existing trait, now named). |

- **Chain Gun or Scourge:** the Chain Gun at range, one enemy at a time; the Scourge when the swarm reaches the Binder. Each swing kills every Blessed in its arc (M12), so a swing is how the Binder breaks free when the crowd holds it.
- **It's how the Binder survives being caught.** At 6 m/s with no escape ability, it can't outrun a swarm. The Scourge clears space around it instead.
- **Every Binder hit slows**, so the slow is the class's trait, not a new effect. Chains of Tartarus moves enemies; the Scourge only hits them.

## The Betrayer (Damage)

- **Verb:** shred. **Big moment:** "I waited until they lined up and one Silver Bullet tore through ten of them."
- **Weakness:** 120 HP; needs Blasphemy, Falling Star and the Heretic to survive the swarm it shoots into.

| Slot | Name | Rule |
|---|---|---|
| Primary | Silver Revolver | 60 dmg to the first enemy hit, 0.3 s between shots, no spread, range 60 m. One Blessed, Cherub or Chorister per shot. (Slowed after review, from 0.15 s / 30 dmg: it felt like a machine gun; its damage per second is unchanged.) |
| Secondary | Silver Bullet | **M12:** 200 dmg carried through the line (was 240), 1.5 s between shots (was 1.2), range 60 m. Each enemy hit, nearest first, takes what's left; the bullet stops when nothing is left. Kills 10 Blessed in a line; bound Blessed cost half as much. Equal to the revolver with 5 in a line, up to twice as good with 10 or more; the revolver wins on single targets and the boss (200 against 133 damage per second). |
| Q | Field of Blood | Tosses the thirty pieces of silver 3 m in front of the Betrayer, where they sink into a pool of blood, with no aiming: the Betrayer is fast, so it walks to where it wants the field. For 8 s, every player within 6 m of it (on any level; jumping doesn't take them out) fires twice as fast, even if the Betrayer dies meanwhile: both attacks, so also Sacrament's healing. Cooldown 30 s. |
| E | Shadowstep | Dashes 8 m the way the Betrayer moves, invulnerable for 0.5 s, cooldown 6 s. **M12:** the dagger cuts every enemy within 0.5 m of the path (about 10–15 Blessed in a crowd) for 40 dmg, which bursts a Blessed, leaving a silver streak. It's the Betrayer's way through a crowd: the dash isn't slowed by wading, so the Betrayer chooses a line through the crowd instead of only backing away. |
| Passive | Into the Night | The fastest of the damned, 9 m/s (the existing speed, now named). |

- **Revolver or Silver Bullet:** the revolver for scattered enemies, flyers and the boss; Silver Bullet when ten or more line up in a corridor, behind the taunting Fallen or in the Binder's pile.
- **Field of Blood looks like a place.** A glowing pool of blood-red liquid with light rising from it, so the party sees where to go. A player standing in it sees a red glow rising at the bottom of the screen, a red glow on the weapon and a buff icon by the HP bar, even when not shooting.
- **Field of Blood is a rally call.** It's wasted on a scattered party. Its best use is the whole party standing in it in front of a Binder's pile (bound enemies take double damage and the party fires twice as fast, so ×4 damage per second), or near cover on the boss, so the party can still hide from Judgment.
- **Fire rate, not damage.** A Blessed has 20 HP, and most attacks already kill one per hit, so doubled damage would be wasted in the swarm. Twice the fire rate doubles every class's kills there and its damage on the boss.
- **The theme:** Judas's thirty pieces bought the Field of Blood. The Betrayer doesn't lead the damned; it pays them.
- Field of Blood replaces Kiss of Betrayal as the party's boss multiplier, and it works in the swarm too.
- **Thirty Pieces of Silver** stays reserved as the name for the Betrayer's ultimate (M13).

## Exact rules

[m9.md](m9.md) turns this rework into exact rules: controls (the last-pressed button wins, except that the Heretic's beam wins whenever an ally is aimed at; one shared fire timer), effects, sounds, texts, the bot, the protocol and the Gatekeeper's new HP. Implemented in M9; the choices made along the way are the `M9` lines of [decisions.md](decisions.md). Two that touch the rules here: in a Field of Blood the crosshair and the own tracers turn blood red too, and Martyr's Shroud's blast uses the censer's ember burst.

## Rejected ideas
For now, they can still come in play later:
- Kiss of Betrayal: it only pays off against tough single targets, which the swarm rarely has.
- Field of Blood doubling damage: most attacks already kill a Blessed in one hit, so it did nothing in the swarm. It doubles the fire rate instead.
- Shattered ground after Falling Star: a lingering zone on top of a leap and a knockback is too much for one ability.
- Censers healing teammates: Sacrament gives healing its own button instead.
- Two Masters, a timed second revolver: nothing to decide, so it's pressed the moment it's ready.
- Greed, fire rate rising with each kill: in a swarm it maxes out in two shots, and on the boss it does nothing.
- A Betrayer double jump: players already pass through enemies, and it would break the rule against jump-only perches.
- A Fallen charge or War Stomp (playtest 2): Falling Star aimed anywhere now does both jobs, and a War Stomp's stun plus knockback is two effects. A charge may return as a new ability later.
- Enemies blocking players: wading slows players in a crowd instead, without changing the network.
- New enemy types and threats (playtest 2's reviews): an Exalted charger, leading shots, a grab special that drags a lone player into the crowd until a teammate frees them. Deferred until clearing the horde is fun on its own (M12).

So they aren't proposed again:
- Overheal turning into a shield.
- Chain Gun hits stacking into a root; Chains pulling an ally; Discord making enemies fight each other.
- Shadowstep priming a critical shot; Kiss refunding on a kill.
- Shackle, a Binder secondary rooting one enemy: too similar to Chains of Tartarus.
