# Revision 6: talent composition and class review

Reviewed 2026-10-11 against the current core rules, all four catalogs, item/relic provenance, `docs/classes.md`, lore and the horde-fun report. This is a specification review and paper simulation. No game code, frontend or tests were changed or executed; no clear-speed or fun claim here is a measured result.

## Findings and implemented resolutions

| Finding | Concrete failure | Resolution |
|---|---|---|
| Same-input exclusion still prevented Isaac-style composition | Piercing pellets could not also throw survivors; banking a Silver Bullet could not also nail its endpoint; Long Chain could not deliver a chosen censer area. Rite substitution provided variation but still only one effect change. | Catalogs now classify every augment as Delivery or Payload. One of each may compose on a named input, while same-channel alternatives still exclude. Explicit composed examples retain native damage budgets, shared hit sets, two visible effects and same-channel Rite substitution. Core §9.3/§9.10 was changed by the coordinator. |
| New alternatives had little explicit shaping support | Son of the Morning was tied to the base leap; replacing it with Rain/Gatebreaker left the learned shape inactive. Sicarius dash nodes targeted only Shadowstep. | Son explicitly shapes Star/Gatebreaker/Rain/Cast Out with authored footprint numbers. Long Knife and Scattered Sheep explicitly target both Shadowstep and Way Back, with defined combined width and damage metadata. Other alternatives retain authored passive synergies; there is no blanket inheritance. |
| Two Betrayer alternatives discarded the party's Field | Both marksman Coin and melee Way Back replaced Q Field, and the catalog advised swapping Field back for the boss. A swarm identity became a preparation penalty. | Way Back now replaces Shadowstep on E. Sicarius and Akeldama retain Q Field; only the optional marksman Coin trades away its party cadence. Way Back cannot coexist with an equipped Shadowstep and carries E cooldown after cancellation. |
| Per-node caps did not cap simultaneous kill listeners | Judecca + Blood Money + Broken Vessel could all activate from one root, with capstones adding another discharge. | Every class declares its exact kill-discharge IDs and the core two-effective-node limit. One root collects a node once at its first eligible resolving tick, bundling that tick's qualifying deaths under row caps. Later native pulses cannot re-dispatch it. Existing secondary recursion protection and finite area-only propagation remain. |
| A documented Akeldama extension violated the new discharge limit | C6 Blood Money/Broken Vessel plus A Judecca produced three effective nodes. | Its legal A dip is now Glancing Silver + Informer, plus B Through the Throng. The spread build uses Nail/Cast Down/Broken Vessel instead of Blood Money. Gates, channels and useful alternatives are stated in the revised scenarios. |
| Delayed root listeners lacked lifetime semantics | A censer/Trial root can kill at several different ticks, allowing an apparently once-per-root Kindling to activate again later. | First eligible tick collects Kindling once, maximum 60 origin cells; dispatch flags persist for the delayed root. Judecca likewise has 60 origin frost puffs, with merged slow rather than multiplied overlap. |
| State predicates could be licensed by a dormant effect cycle | A relic that only launches on an airborne kill is not a native airborne source for a landing Rite without a seeded launcher. Removing a Payload could also remove a reader's only setup. | Catalogs use the finite source closure in core §9.9/items §2.1.1 after resolving the effective proposed kit. Own-source and direct-launch requirements retain owner and provenance restrictions. No unseeded cycle qualifies. |
| One Rite needed a surviving target, not merely a pool | Irons in the Fire's native 60 damage kills ordinary 20-HP Blessed and 60-HP Choristers; the stationary boss is bind-immune. | The offer also requires an authored eligible ground survivor. Ownership remains legal and its row states the elite-survivor purpose. It is not promised as a pure-fodder active effect. |
| Composed branch Payloads lacked cardinality/order | A coin split with bank/nail/recoil could otherwise recoil three times or nail a ricochet wall as well as its endpoint. | Delivery resolves the ray; Recoil grants one envelope per accepted root; each of at most three Coin branches nails only its terminal endpoint, sharing acquired bind IDs. A bounce is not terminal. |
| A near-wall Coin could be positioned behind its caster | “0.5 m before wall” with insufficient forward clearance yielded a negative distance. | Coin requires a valid forward center and sphere clearance; insufficient room rejects without cooldown. |

## Catalog data for implementation

Delivery IDs:

- Fallen: `fallen.a.2a`, `fallen.c.1b`.
- Heretic: `heretic.a.3b`.
- Binder: `binder.a.1a`, `binder.b.1a`, `binder.b.3b`, `binder.c.1a`, `binder.c.2b`.
- Betrayer: `betrayer.a.1a`, `betrayer.a.2a`, `betrayer.a.3b`, `betrayer.b.2a`, `betrayer.c.1b`.

Every other Kind-augment ID is Payload. Ability unlocks and passive/movement/capstone rules are not inferred augments. Input-specific capstone behavior remains explicitly authored; it cannot be used to add an unbounded rider.

Kill-discharge IDs:

- Fallen: `fallen.b.1b`.
- Heretic: `heretic.b.1b`.
- Binder: `binder.a.1b`, `binder.b.cap`, `binder.c.1b`.
- Betrayer: `betrayer.a.1b`, `betrayer.a.cap`, `betrayer.c.2a`, `betrayer.c.2b`.

The Burning Plain/The Sixth Circle have the existing finite area-only propagation exception; Bread is a bounded native resource harvest; landing, pickup and revival listeners retain their own event lineage. They never become new recursive damage roots.

Native Q/E damage metadata remains in each catalog. Important change: `wayBack` is E, true without Scattered Sheep and false with that Payload. Coin is Q but its split kills remain LMB/RMB. Binder Q/E remain false, including secondary Shattered Hymn interception. Long Knife/other Delivery geometry alone does not change native-damage ownership.

## Paper scenarios revisited

1. A fresh Fallen receives Heave, then As We Fell: the tier gate and own direct-launch source work; a compatible Through the Ranks Delivery can join later without a third visible attack rider. Fire-and-Brimstone remains an alternative Payload.
2. A completed firewalker receives Son of the Morning while Rain is assigned: its radius-7 authored shape is immediately useful. A learned Brand-to-Wormwood substitution removes only Brand's contribution; other fires remain, and own launch readers may become usable after resolving the swap.
3. A fire-only Saint receives Long Chain: it remains fire-only and cannot receive Walk in the Smoke based on phantom incense. An Altar/Scapegoat Payload swap or Witnesses produces the actual source. Bread + Cunning Folk + Lazarus produces at most six admitted harvest motes, with one bounded pickup blast per 0.5 s.
4. A Binder with Chains Shatter and Frost cannot receive Chain Holds as a third discharge. A ground-only Boundary cannot qualify Brought Low by borrowing an allied bind. Voice plus Where They Fall resolves native launch, then control at landing, then secondary landing damage in the canonical order.
5. An Akeldama veteran keeps Glancing + Nail, receives Recoil as a same-Payload substitution, then One of Them and Way Back. Way Back replaces E Wire, preserves Q Field/Potter, and is meaningfully different because the return needs preparation.
6. A wide Sicarius return with Scattered Sheep retains the E movement envelope but replaces damage with launched front ranks. The class-wide touch capstone remains secondary, never converts those kills into E seals or third kill discharges.
7. A split Silver Bullet cannot hit the same boss three times. Its primary deaths finish before Judecca/Broken Vessel samples/dispatch; a later frost cannot retroactively qualify Halt's first victim. Recoil is one player movement envelope, not one per branch.

## Readiness and remaining evidence

All 84 stable nodes, 12 alternative abilities, channels, supported target IDs, source predicates, event lineage and the legal six-/nine-point examples have a concrete catalog contract. Existing floor-specialist nodes remain intentional: Brought Low has no pure-Blessed target, Informer depends on ranged/elite enemies and Known Ground on actual environmental content. The spec should say this directly instead of pretending every node is active in every room.

The changes improve combinatorial decisions; they do not establish unlimited replayability or perfect balance. Observed validation still needs to measure dense-crowd performance, individual tree clear speed, return safety, fire propagation coverage and whether repeated runs produce distinct choices. The numbers remain tunable initial values. No tests or playtests were run in this review.

## Integrated second round

Re-read the integrated core §9.3–§9.10/§14.11, item metadata/producibility rules and current Gatekeeper part/hold behavior after the initial edits. Corrected the remaining catalog boss advice: keeping Judas Coin is legal, with Field restoration an optional coordinated-DPS trade; the B six-point examples choose Knife or Sheep for their point budget, and explicitly permit both at seven points. Identified the core's old “new ability has one visible effect” clause and the passive-capstone channel wording; the coordinator reconciled both with the native two-effect and explicit passive-compatibility rules. Enemy-event eligibility now excludes trickle and boss parts from discharges while retaining native/defensive gameplay, and a missing read state never creates a third-listener loophole. The updated item table correctly treats Way Back as E and Scattered Sheep as a nondamaging Payload. No unresolved catalog/core contradiction was found in this final manual pass; implementation and observed play remain the evidence gates above.
