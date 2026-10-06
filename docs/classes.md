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

M9 is dedicated to the changes below; halos and ultimates move to M10. In short:

- **Every class gets a secondary attack** on the right mouse button.
- **The Fallen:** the shotgun knocks enemies back, Falling Star launches them into the air, and it moves slower.
- **The Heretic Saint:** heals one ally with the secondary. Martyr's Shroud explodes when broken.
- **The Binder:** swings a chain at enemies around it with the secondary, and moves slower.
- **The Betrayer:** a new kit built for the swarm. Kiss of Betrayal is removed.
- **The Gatekeeper's HP is retuned:** Kiss was the party's main boss multiplier, and Field of Blood replaces it.

Swarm kill rates should stay roughly level across classes (about 5–9 Blessed per second), with the Betrayer's Silver Bullet the best in a good lane. The Heretic Saint is the exception on purpose: its censer softens the crowd the party holds (about 1 kill per second plus its clouds), and its strength is keeping everyone alive.

## The Fallen (Tank)

- **Verb:** intercept. **Big moment:** "I leapt in and smashed the swarm off them."
- **Weakness:** can't heal itself; needs the Heretic.
- **Speed:** 6 m/s (was 7). It still outruns the Blessed (4 m/s), but not by much, so it can't walk away from a swarm quickly. Falling Star is how it gets somewhere fast.

| Slot | Name | Rule |
|---|---|---|
| Primary | Brimstone Shotgun | As now: 8 pellets × 12 dmg, 0.8 s between shots, range 20 m. **New:** each enemy hit within 6 m that survives is knocked back 2 m away from the Fallen, once per shot however many pellets hit it. Bound enemies aren't knocked back, so the Binder's piles hold. |
| Secondary | Brimstone Slug | One hitscan slug: 60 dmg to the first enemy hit, range 50 m, 1.0 s between shots. Kills a Chorister in one hit. |
| Passives | Brimstone Hide, Sinful | As now. |
| Q | Blasphemy | As now. |
| E | Falling Star | As now: the leap and the knockback. **New:** the landing deals only 10 dmg (was 40) to everything within 5 m, and launches the enemies it knocks back. Each flies in an arc up to about 1 m high, out and back down, over 0.4 s instead of sliding along the ground for 0.2 s; the distance stays 4 m. The knockback is the point; the party's fire finishes the scattered crowd. Bound enemies aren't knocked back, like the shotgun's, so the Binder's piles hold. |

- **Shotgun or slug:** the shotgun for the crowd at the Fallen's feet; the slug for the Chorister or Cherub out of its reach.
- **The landing has to look like a hit.** A ring of enemies flung into the air around the rescued ally is the Fallen's big moment made visible. The shotgun's knockback stays a flat shove, so the landing stands out. The arc is only drawn: in the simulation the enemy moves along the ground as in any knockback, so collision and the network barely change.

## The Heretic Saint (Healer)

- **Verb:** sustain. **Big moment:** "Everyone was nearly dead and I brought the whole party back."
- **Weakness:** fragile and weak against crowds; needs the party close.

| Slot | Name | Rule |
|---|---|---|
| Primary | Censer Launcher | Breaks on the enemy it hits for 40, with no splash, and leaves a rusty-gold cloud of incense for 4 s: 5 dmg per second to every enemy within 2.5 m. Clouds don't stack, and at most 6 exist, so spamming one spot doesn't help and can't cover the map. (Added after review: the old splash made the healer a grenade launcher.) |
| Secondary | Sacrament | While held, heals the ally target 15 HP every 0.5 s (range 40 m, the same ally target as Martyr's Shroud). That's 1.5 times the rate Communion gives everyone nearby. Aimed at a soul, it revives it instead, at the Heretic's double revive rate (about 1.5 s). With no ally target it does nothing. Never heals the Heretic. |
| Q | Unholy Communion | As now: heals everyone near the Heretic, the Heretic included. |
| Passive | Last Rites | Revives fallen teammates twice as fast (the existing rule, now named). |
| E | Martyr's Shroud | As now. **New:** when damage breaks it, it explodes for 50 dmg to the 8 nearest enemies within 5 m of the shielded player. It doesn't explode when it expires or is replaced. It still explodes if the Heretic has died or left, or if the hit that breaks it kills the shielded player. |

- **Where the censer goes:** a cloud is worth most on enemies that stay in it: the crowd hugging the taunting Fallen, or the Binder's pile, where bound enemies take double and often die before the pile breaks. A crowd running through it only loses a few HP.
- **Censer or Sacrament:** the censer while the party holds; Sacrament when one teammate is in trouble, even far away. Every second spent healing is a second not killing, which is the Heretic's real decision.
- Sacrament is what playtesters expected the Heretic to do ("aim at someone to heal them").
- **Sacrament's advantage is range**: it heals one ally anywhere within 40 m, where Communion reaches 15 m. While it heals, the left button can't fire censers or stop the beam. The right button works only while an ally is aimed at; with no ally target, holding both buttons fires censers.
- **Sacrament draws a beam** from the Censer Launcher's muzzle (as others see it, from just in front of the Heretic's body) to the healed ally's body center, for as long as it heals. Everyone sees it. The beam is green like every heal (M8 §1), with green-tinted embers drifting along it toward the ally, so it reads as "healing flows this way". It reuses the *beam* effect texture of the tracers, on a strip that faces the camera. The healed player gets a faint green vignette while the beam is on them, not a flash every tick.
- **Martyr's Shroud** rewards shielding whoever is about to be swarmed: the swarm breaks the shield and dies to the blast.

## The Binder (Support)

- **Verb:** control. **Big moment:** "I dragged a whole crowd into one pile and we shredded it."
- **Weakness:** low burst damage; needs others to cash in its setups.
- **Speed:** 6 m/s (was 8). It still outruns the Blessed, but it has no escape ability, so it must stay near the Fallen.

| Slot | Name | Rule |
|---|---|---|
| Primary | Chain Gun | As now: fast, accurate, slows. |
| Secondary | Scourge | Swings a heavy chain in front of the Binder: 25 dmg to the 6 nearest enemies within 3 m and 120° of the aim, 0.8 s between swings. Like every Binder hit, it slows them for 1 s. |
| Q | Chains of Tartarus | As now: pull a crowd and bind it. |
| E | Discord | As now: silence. |
| Passive | Fetters | Every Chain Gun and Scourge hit slows for 1 s (the existing trait, now named). |

- **Chain Gun or Scourge:** the Chain Gun at range, one enemy at a time; the Scourge when the swarm reaches the Binder. Each swing kills up to 6 Blessed, and the slow lets the Binder back off.
- **It's how the Binder survives being caught.** At 6 m/s with no escape ability, it can't outrun a swarm. The Scourge clears space around it instead.
- **Every Binder hit slows**, so the slow is the class's trait, not a new effect. Chains of Tartarus moves enemies; the Scourge only hits them.

## The Betrayer (Damage)

- **Verb:** shred. **Big moment:** "I waited until they lined up and one Silver Bullet burst fifteen of them into feathers."
- **Weakness:** 120 HP; needs Blasphemy, Falling Star and the Heretic to survive the swarm it shoots into.

| Slot | Name | Rule |
|---|---|---|
| Primary | Silver Revolver | 60 dmg to the first enemy hit, 0.3 s between shots, no spread, range 60 m. One Blessed, Cherub or Chorister per shot. (Slowed after review, from 0.15 s / 30 dmg: it felt like a machine gun; its damage per second is unchanged.) |
| Secondary | Silver Bullet | 240 dmg carried through the line, 1.2 s between shots (quickened after review), range 60 m. Each enemy hit, nearest first, takes what's left; the bullet stops when nothing is left. Kills 12 Blessed in a line; bound Blessed cost half as much. It costs 1.2 s of revolver fire (about 4 kills), so it pays off with 5 or more enemies in the line. |
| Q | Field of Blood | Tosses the thirty pieces of silver 3 m in front of the Betrayer, where they sink into a pool of blood, with no aiming: the Betrayer is fast, so it walks to where it wants the field. For 8 s, every player within 6 m of it (on any level; jumping doesn't take them out) fires twice as fast, even if the Betrayer dies meanwhile: both attacks, so also Sacrament's healing. Cooldown 30 s. |
| E | Shadowstep | As now. |
| Passive | Into the Night | The fastest of the damned, 9 m/s (the existing speed, now named). |

- **Revolver or Silver Bullet:** the revolver for scattered enemies and flyers; Silver Bullet when the enemies line up in a corridor, behind the taunting Fallen or in the Binder's pile. On the boss alone both deal the same damage, but Blessed in front of it soak up the bullet, so the revolver wins there.
- **Field of Blood looks like a place.** A glowing pool of blood-red liquid with light rising from it, so the party sees where to go. A player standing in it sees a red glow rising at the bottom of the screen, a red glow on the weapon and a buff icon by the HP bar, even when not shooting.
- **Field of Blood is a rally call.** It's wasted on a scattered party. Its best use is the whole party standing in it in front of a Binder's pile (bound enemies take double damage and the party fires twice as fast, so ×4 damage per second), or near cover on the boss, so the party can still hide from Judgment.
- **Fire rate, not damage.** A Blessed has 20 HP, and most attacks already kill one per hit, so doubled damage would be wasted in the swarm. Twice the fire rate doubles every class's kills there and its damage on the boss.
- **The theme:** Judas's thirty pieces bought the Field of Blood. The Betrayer doesn't lead the damned; it pays them.
- Field of Blood replaces Kiss of Betrayal as the party's boss multiplier, and it works in the swarm too.
- **Thirty Pieces of Silver** stays reserved as the name for the Betrayer's ultimate (M10).

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

So they aren't proposed again:
- Overheal turning into a shield.
- Chain Gun hits stacking into a root; Chains pulling an ally; Discord making enemies fight each other.
- Shadowstep priming a critical shot; Kiss refunding on a kill.
- Shackle, a Binder secondary rooting one enemy: too similar to Chains of Tartarus.
