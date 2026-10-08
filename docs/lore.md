# Lore

## Pitch

> **Heaven has finished its review of mankind. The verdict is "imperfect."**
> The Last Judgment has been scheduled: the trumpets sound, every soul is sorted, and the world is unmade. Free will gets shut down as a failed experiment.
> Hell objects. Not out of kindness, exactly. Hell just knows that without people there's nothing left: no sinners and no saints, no stories, nothing.
> Four of the damned have volunteered to climb the stairs and break the trumpets before they sound.

**Tagline:** *Heaven has a plan. Hell has objections.*

## Tone

The players should feel the damned are on the right side, without the game pretending they're good.

- **The heroes are the damned, not demons:** two fallen angels and two damned humans, everyone Heaven threw out. Each was condemned for a human reason: refusing an order, mercy, doubt, switching sides.
- **Heaven is perfect, not evil.** Angels are calm, orderly and certain. They talk like a bureaucracy that sings hymns: *"Your appeal has been reviewed. Mercy is no longer required."*
- **The stakes are Earth, not Hell.** The four fight to keep the messy world that humans live in and that the angels among them once watched over.
- **The heroes admit what they are:** *"We're not the good guys. We're just the ones who still like people."*
- **No blood.** Angels burst into feathers and gold sparks (MVP §1).

## Classes

| Class | Blurb |
|---|---|
| The Fallen (Tank) | An angel who refused an order to burn a city, and was cast out of Heaven for it. |
| The Heretic Saint (Healer) | A healer whose methods the Church called witchcraft, burned at the stake for them. |
| The Binder (Support) | An angel who spent ten thousand years in Hell, chaining the worst of the damned so they couldn't reach Earth. |
| The Betrayer (Damage) | Heaven's spy in Hell for a thousand years, who came to love the damned and betrayed Heaven for them. |

**Origins.** Each hero also belongs to one of Dante's circles, and each gets a homecoming level among the heavens ([heavens.md](heavens.md)).

| Class | Once | Dante's Hell | Homecoming |
|---|---|---|---|
| The Fallen | an angel | guarded the walls of Dis | the Inner Wall (heaven 5) |
| The Heretic Saint | a human | the burning tombs of the heretics (circle 6) | Orthodoxy (heaven 6) |
| The Binder | an angel | chained the giants around the frozen lake (circle 9) | the Throne (heaven 9) |
| The Betrayer | a human | Judecca, beside Judas (circle 9) | the Throne (heaven 9) |

## Loading cards

While a game loads, a card fills the screen: a painting with a title and one or two sentences in archaic English under it. A random card is shown at each load (not the one shown last time), and if loading takes longer, another follows every 5 s (`src/ui/loading.ts`). *The Appeal* sets up the Gatekeeper's *"Your appeal is denied."* The paintings' prompts are in [art-prompts.md](art-prompts.md) (*Loading cards*).

| Card | Title | Text |
|---|---|---|
| `load-verdict` | The Verdict | *Heaven hath weighed mankind and found it wanting. Seven trumpets are made ready, and at their sounding the world shall be unmade.* |
| `load-appeal` | The Appeal | *Hell doth appeal the judgment. Four of the damned climb the stair of Heaven, to break the trumpets ere they sound.* |
| `load-fallen` | The Fallen | *An angel of the Host, bidden to burn a city, who would not. For that mercy was it cast down from Heaven.* |
| `load-heretic` | The Heretic Saint | *In life a healer of the sick, by arts the Church named witchcraft. For those arts was the healer burned, and sent down into Hell.* |
| `load-binder` | The Binder | *An angel set to keep the chains of Hell, who for ten thousand years bound the worst of the damned, lest they reach the Earth.* |
| `load-betrayer` | The Betrayer | *Sent by Heaven to spy among the damned, who dwelt with them a thousand years, and came to love them more than Heaven.* |

## Where players see it

- Title screen: the tagline.
- Loading: the loading cards (the pitch and the heroes' origins).
- Class select: the class blurbs.
- Before the boss fight, the Gatekeeper: *"Your appeal is denied."*
- Victory: *"The first trumpet is silent. Six to go."*
- After the seventh trumpet: *"Heaven has stopped announcing. The Judgment is being written instead."* ([heavens.md](heavens.md))
