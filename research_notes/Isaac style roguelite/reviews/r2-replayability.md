# Round 2: replayability, item composition and specification audit

Reviewed **2026-10-11** by the item/replayability agent. Scope: core rules, lore, four class catalogs, consumable/relic catalog, prior Isaac and horde-fun research. No game code, frontend changes, tests or gameplay execution. This review uses mental scenarios and source reading; it cannot certify a bugless implementation or empirically prove fun.

## Catalog delivered

[items-relics.md](../../../docs/rogue/items-relics.md) now contains eight items, twelve relics, six replacement combos, exact cooldowns/caps/ownership, compatibility-aware offers, four deed conditions and class/party/abuse walkthroughs. [vertical_slice_research.md](../vertical_slice_research.md) distinguishes verified developer statements from our adaptation and contains direct source links.

The core adaptation is run identity with bounded state composition: item areas set up states, direct attacks cash them out, relics offer visible small rewards, and six named combos deliberately exchange an effect rather than add one. Persistent collection opens options; run Rites, stock and route costs force those options to interact with the current floor.

## Findings and resolutions made during this pass

| Finding | Failure scenario | Resolution |
|---|---|---|
| All item/relic tables were empty | An implementing agent would invent effects, prices, combos and attribution | Complete fixed MVP catalog with exact stable IDs and dimensions |
| A late-path Rite guarantee postponed unlucky new-player build choices | First several encounters had no meaningful kit change | First compulsory-route combat clear unconditionally pays a Rite; every preview reflects the finalized reward |
| Relics claimed to be pure sidegrades relative to empty slots | Added damage/control necessarily gives progress power | Core and catalog describe bounded progress honestly; sidegrades compare two occupied choices |
| Every item required pure-swarm utility despite obligatory reflect ward | Ward would need a hidden second unrelated effect | Ward is intentionally ranged/boss-specialized; other seven items cover swarm choices |
| Two Q/E-kill seals could both be dead in a Binder's whole current kit | Both offered choices unusable in the current run | Compatible-first weighted offer when useful unowned IDs exist, second card unrestricted; collection-only cards explicitly labelled |
| Base Betrayer E was wrongly treated as a pure dash | Last Plea would be flagged dormant despite native 40-damage cut | Compatibility table counts native Shadowstep cut; only its pure-launch replacement disables E damage |
| Item auto-use bypassed global cooldown | Contact with a drop pile could consume multiple charges in one tick | Manual/automatic use/refresh share 1 s; cooldown pickups store-or-remain |
| Shield ownership/replacement could stack or steal Shroud burst | Item restoration would burst a replaced shield or claim E kills | Single channel; refuse weaker/equal manual application; explicit source and no replacement/expiry burst |
| Reflection could become Q damage or recursively reflect | Ward kill might fire seals or pass between wards forever | Reflect once; item owner, secondary proc origin, no new procs |
| Ranged areas lacked height and wall rules | Ground ash/poison hits flyers or bosses through floors | Item-specific floor eligibility, Ward sphere, room clipping and source membership |
| Kill-trigger state sampled after despawn | Pooled/censed deaths never trigger, or newly created state rewrites old death | Immutable pre-fatal-damage snapshot and stable trigger order |
| Q/E and generated passive damage blurred together | Fire ability fails its seal, or passive shatter recursively becomes Q damage | Native delayed ability root retains depth-0 slot; separate passive discharge is depth 1 |
| Landing augmentation had no item/relic rule | Quill launch could create class landing discharge, then another relic launch forever | One direct-item landing bundle respects each applicable owned node's predicates and caps, control before damage at depth 1; relic/combo launch cannot dispatch it |
| Relic swap/death/rejoin could reset internal cooldown | Repeated Confessional swaps restore burst budget | Preserve per-relic run cooldowns; remove effects while retaining timers |
| Full Rite build could miss Mercy because no actual node selected | Fast veteran completes objective but gets no deed | Host `sundialQualified` at timely seal independent of bonus claim/fallback |
| Mid-run admission could farm a whole-run deed | Join just before boss death for no-death/Sentence reward | All deed eligibility captured for profiles present at start with a prior heaven clear |
| Cleared-room trickle/boss summons could become reward farms | Safe backtracking earns deed streak; boss adds manufacture endless sustain | Trickle excluded from proc/streak/deed; boss summons enable control and at most eight ordinary ranged-kill motes per fight, no XP/halos/items or passive harvest |
| Per-item cap and core global cap disagreed | Persistent item+relic areas exceed browser entity budget | Combined four persistent areas per human; manual use rejects cap without charge; autonomous proc skips under its CD |

## Mental replay audit

**Run 1:** the base class still has useful item choices before the account collection exists. Picking the guaranteed main-route Rite teaches a visible build change. One chest choice gives a permanent objective even if the attempt loses at the boss. The inventory's valley exception avoids automatically wasting a placed item on an empty clear reward.

**Runs 2–8:** the account tries new classes, starts with different combinations and acquires more chest relics. A rush refuses a bell/empty-reward detour; a full clear accepts those risks for Rites and XP. The bargain's reduced HP remains a boss risk even if the rewarded relic merely adds another future character option. Compatible-first offers prevent the normal early reward from consisting entirely of dormant Q/E effects.

**Runs after collection:** the Reliquary changes to a run Rite rather than an empty repeat chest. Six combos are not automatic best-in-slot: each loses reliability, target freedom, personal defense or independent setup. Four deeds give distinct intentions, and voluntary Edicts vary the pressures. Random stock matters when the player cannot buy every good and has only two carry slots.

**Co-op:** the Binder's states make another character's kill relic useful; halo/XP wallets do not steal rewards. A human pickup, not wallet broadcast, owns Quill. Boss rewards/deeds settle per admitted eligible profile, avoiding first-win carries and mid-run award farms. Solo does not depend on another human supplying a base-required mechanic.

**Adversarial source chain:** direct venom kill → pooled trigger → short bind; a later revolver kill may exploit bound. Counterseal's damage cannot cause the same chain. Mirror is once-reflected and secondary. A direct item launch dispatches one capped landing bundle, including allied nodes only where their ownership/position rules permit; its outputs are secondary and slotless. A relic launch cannot dispatch the bundle. This is controlled synergy rather than uncapped recursion.

## Cross-file reconciliation checklist sent to coordinator

These were sent to the owning agents. The final read confirmed compatible offers, native/secondary provenance, pickup ownership, item-area reservations and the persistent/effective save projection in the core. Appendix/revision checks belong to the coordinator's final publication pass.

- Core §8.3 chest/bargain draw order must reference compatible-first per-relic weighting and the catalog's compatibility table; fixed stored offers do not reroll on loadout change.
- Core §14.11 source-depth language must distinguish native delayed ability damage from separate passive discharge and preserve direct item's capped landing-bundle exception.
- Core §14.11 sustain lifecycle should clear self effects/shields on death while item areas persist until their ordinary expiry; disconnect/leave removes them. Each area/state owns a source token.
- Core Appendix A and economy worked examples must replace hypothetical Holy water/Censer bomb/Feather draught/Frost flask with the actual Balm/Ash/Feather catalog and actual prices. No unavailable prototype item should appear in an implementation-ready scenario.
- Class shared contracts need the same root/secondary distinction. In particular Fallen's old blanket exclusion of node-created fire must not suppress native Rain of Fire or a direct burning-ring augment's original Q/E source.
- Final counts, title/revision status and completion index should make clear that all four classes and the item/encounter catalogs are authoritative; older draft constraints that differ must be removed or explicitly historical.

## Third-pass settlement and exhaustion audit

The final pass additionally walked cached disconnected victory delivery, same-run post-victory reload, a second admission after settlement, duplicate claim/use requests, two simultaneously pending chest/bargain offers, an exhausted relic collection, a thrown item competing with a new relic area, death while a consumable is active, learned nodes gated independently of Rites, pawned equipment in a defeat save and an old settlement arriving after a new run. This led to these concrete core corrections:

- Explicit `new`/`resume`/`settled` admission prevents post-win reload from risking safe inventory again.
- A session-bounded 16-completed-run settlement cache delivers a disconnected victory before a new admission; revisions compare only within their run.
- Runtime Rites survive boss settlement until actual exit, while save projection excludes Rite-only assignments and unpromoted pawn overlays.
- Bargain acceptance atomically charges HP and grants once; terminal decline releases reservations without rerolling. Reservation blockage never masquerades as an exhausted collection or awards a free Rite.
- Accepted thrown flights reserve their landing-area entitlement before spending a charge, so a competing proc cannot consume it.

The coordinator was also asked to reconcile the older unconditional different-run defeat sentence with cached-settlement lookup, and explicitly state whether accepted item flights survive owner death. These are lifecycle wording checks, not claims of an executed recovery test.

## Limits and evidence

This specification can close authored rule gaps and define credible replay loops; it cannot guarantee unlimited enjoyment, perfect balance or an absence of implementation bugs. A single authored dungeon has finite content. The useful validation after implementation is observed route/build variation, moments when players change their plan, number of visible decisions, readability during the crest, and absence of a universally dominant combo. No test execution is implied by these suggested future observations.
