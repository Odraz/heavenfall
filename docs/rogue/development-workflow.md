# Developing the rogue variant with AI

Revision 9. You own the taste: whether a fight is interesting, whether classes feel different, whether you want another run. The AI owns turning the rules into working code: reading the current code, state machines, host authority, networking, persistence, content integration and the presentation each feature needs. You shouldn't have to design a protocol or list talent edge cases; you review outcomes, supply assets and play.

## The files and their jobs

| File | Purpose | Maintained by |
|---|---|---|
| [implementation.md](implementation.md) | Milestone order, dependencies, branch and verification policy | AI, with your product decisions |
| `r00.md` … `r09.md` | One milestone's outcome, contracts, stages, assets and play checklist | AI prepares; you review |
| `r00-report.md` … `r09-report.md` | What changed, commits, checks run, defects, your play feedback | AI, during the milestone |
| `implementation-decisions.md` | Decisions made while implementing, next to the spec clause they touch | AI, from R0 |
| `asset-manifest.md` | Every asset: requested, received, accepted, integrated, with its game events | AI from R0; you supply the files |
| [game.md](game.md) and the catalogs | The rules and content | AI updates them when you accept a design change |
| [slice-acceptance.md](slice-acceptance.md) | What "done" means for the whole slice | AI tracks evidence; you judge feel |
| [art-prompts.md](art-prompts.md), [audio-prompts.md](audio-prompts.md), [asset-plan.md](asset-plan.md) | What to generate, how, and when | AI; you generate |

The briefs are `r00.md` to `r09.md` (displayed as R0 to R9). R0 is executed and awaiting your review ([r00-report.md](r00-report.md)); R1 is implemented and verified, **accepted** ([r01-report.md](r01-report.md)), with Gate A closed by Tomas on 2026-10-13. R2–R9 are **planned** and get prepared one at a time against the code that exists by then, after the preceding gate is satisfied. A planned brief is a plan, not proof its dependencies work.

## The milestone loop

Start a fresh AI conversation per milestone if the previous one got long; the repository carries the context. Give it the brief and the previous report.

1. **Prepare.** The AI reads the current code, the spec clauses and the previous report, and expands the brief: exact files, data, messages, small ordered stages, the assets it needs, a play checklist. Documentation only.
2. **Review the brief.** Read the outcome, the exclusions, what's asked of you. Correct a product choice or a misunderstanding. If preparation found a dependency problem, the AI states the repair before building on it.
3. **Implement.** Send the implementation prompt. The AI works through the stages with small local commits and doesn't stop to ask about routine choices. It records material design changes and explains anything that truly blocks it.
4. **Play and respond.** Use the checklist. Send observations (the feedback prompt below, or just a sentence like *"I backed up in the same circle the whole room"*). The AI diagnoses, fixes, updates the report.
5. **Accept.** Your explicit acceptance closes the milestone; the AI records it against the commit you played and tags it. Then it prepares the next brief when you ask.

You can ask for the next brief's preparation while you're producing assets. Don't start a milestone on top of one with unresolved blocking defects. The three fun gates (A in R1, B in R2, C in R4; see [implementation.md](implementation.md)) pause expansion until you're satisfied with the answer.

| Milestone | You provide or review | The AI delivers | Your main question |
|---|---|---|---|
| [R0](r00.md) | Review the allowlist; start the audio/art pilots | Baseline on `rogue`, records, prepared R1 | Do we have a safe starting point and a concrete first task? |
| [R1](r01.md) | Play three seeds solo and co-op | Generated floors, room lifecycle, map | Does a new floor feel new; did I pick a door for a reason? (Gate A) |
| [R2](r02.md) | Chain Gun takes, Dominion and prop pilots, S1 sounds | Props, halos, motes, the Dominion, fire, crest, recorded combat sound | What made me change position or target? (Gate B) |
| [R3](r03.md) | Item icons, the Pardoner; a helper for reconnect | Profiles, XP, shop, eight items, reward previews | Are charges, purchases and progress kept or lost exactly when expected? |
| [R4](r04.md) | The Betrayer's three ability icons; play two plans | The Betrayer's full trees, Rites, the Confessional | Did a Rite change my next fight; what did I give up? (Gate C) |
| [R5](r05.md) | The other nine ability icons | All four classes | Can I say why I'd pick either of two builds per class? |
| [R6](r06.md) | Relic icons, key/chest/bell/sundial | Relics, combos, bargain, Bells, Sundial, teleport, deeds, Edicts | Is the benefit worth what I give up? |
| [R7](r07.md) | Boss parts and trumpet; fresh solo runs; human co-op | The authored Gatekeeper and the ending | Can each fresh class win and read the threats? |
| [R8](r08.md) | Remaining sounds; full-run listening | Readable cues, all recordings, the manifest | Which cue is unclear, which sound gets tiring? |
| [R9](r09.md) | Acceptance sessions, four humans for the crest, final decision | Evidence report, accepted branch, merge preparation | Do I want another run, even with the collection complete? |

You don't need every asset before coding starts, or four people for every milestone. Four-human horde evidence and real multiplayer lifecycle evidence are needed for final acceptance; bots help development but don't replace them.

## Verification policy (applies to every prompt below)

- **Every delivered stage or milestone must be tested** (your project instruction, confirmed 2026-10-12; see [AGENTS.md](../../AGENTS.md)). The AI adds meaningful coverage for changed behavior and explains results in plain words. `npm test` (the existing vitest suite) runs at every stage; the AI updates tests a deliberate change makes obsolete and adds tests for pure logic (generator, transforms, pool validation, profile codec/migration, legality resolver, ledgers). `npm run e2e` runs when a stage changes the session/network flow. Keep performance limits intact and run timing-sensitive tests without competing workers. A blocked or unrun check is reported as such, never as passed.
- **`npm run typecheck` and `npm run build`** at every commit.
- **`npm run bench` only when you ask**, after you've played the build. Don't put benchmark gates inside stages. Compare builds back to back (the laptop drifts 5–10%); never two benchmarks at once (both use port 4173).
- **Never claim** a play session, measurement or check that didn't happen. Reports keep tests, measurements, inspection and your observations separate.

## Copyable preparation prompt

Replace `NN` with `01` … `09`.

```text
Prepare docs/rogue/rNN.md for implementation. Planning documentation only:
no game code, no Git history changes.

Read docs/rogue/README.md, development-workflow.md, implementation.md, the
brief, the previous milestone's report, docs/lore.md and the spec/catalog
sections the brief cites. Inspect the current code and Git state, and keep
implemented behavior apart from proposals.

Expand the brief with the exact files to create/change, data shapes,
messages and byte layouts, save fields, small ordered stages that each end
in a playable or reviewable commit, the tests worth adding, the assets
needed (prompt IDs and fallbacks) and a short play checklist. Propose a
concrete default for each open choice. Finish with the brief, the few
inputs needed from me and the first stage. Mark it prepared only when its
contracts are concrete enough to implement without guessing.
```

A brief isn't prepared if it leaves things like charge timing, authority, duplicate requests or feature ownership as TODOs. A cosmetic preference can keep a documented fallback.

## Copyable implementation prompt

```text
Implement the prepared docs/rogue/rNN.md in its ordered stages, following
docs/rogue/development-workflow.md and the spec. Work on the rogue branch
recorded in docs/rogue/r00-report.md; never commit to main.

Read the current code before editing. Keep the fixed dungeon working as a
development fixture. Stay within this milestone; build only the game UI
its features need. Small coherent commits, staged by explicit path.
Record the start/end SHAs and changed files in docs/rogue/rNN-report.md.
Don't push, merge or publish.

Follow the verification policy in the workflow: npm test every stage,
add tests where logic is pure, typecheck and build every commit, e2e when
the session/network flow changes, no benchmark unless I ask. Report what
ran and what failed accurately, in plain words.

Make routine implementation decisions yourself. If a material design
conflict or dependency blocks you, propose a concrete repair and say what
you need from me. At the end give me how to start the build, the fixture
limitations, open defects and a short play checklist, and set the status
to awaiting-human-play.
```

## Copyable play feedback prompt

```text
I played R[N] at commit [SHA] as [class/build], with [humans/bots], on
[device/browser], seed [if shown].

What I tried: [...]
What felt good: [...]
What felt boring or unclear, and when: [...]
What happened / what I expected: [...]
How to reproduce, logs or recordings: [...]
Assets delivered: [file names, or none]
My decision: [accept this checkpoint / fix these first]

Fix what's actionable within the milestone, same branch and policy. Update
the report and the owning spec clause if a design change is needed. Keep
what I observed apart from your diagnosis. Don't mark it accepted until my
decision and the report refer to the same build.
```

## Independent review prompt

For a second opinion on a finished checkpoint, in a fresh conversation:

```text
Review milestone R[N] against docs/rogue/rNN.md and its report. Diff the
milestone's recorded start SHA to its end SHA, plus any intended
uncommitted changes, and also against origin/main so earlier milestones
don't hide this one's defects. Don't fetch, change refs or edit code.

Read the relevant spec and surrounding code. Focus on authority, ordering,
identity, bounded work, save safety, dependencies and whether each
mechanic creates its intended player decision. You may run npm test and
npm run typecheck. Report findings with files and lines, separating
defects, design concerns and things that need a human to play.
```

If you ask for several reviewers, give each one area (combat/network, progression/rewards, encounters/feel). One implementer fixes shared modules. A finding is something to investigate, not proof.

## Asset requests

Every request names the **prompt ID, file name, quantity, game event, needed-by stage and fallback**. You generate and select; the AI checks size/duration, cuts and processes, connects it to the game, records provenance. A received file isn't an accepted asset until it's been seen or heard in the game. Start with the pilots in [asset-plan.md](asset-plan.md). Never count a required recording as done because a synthesized fallback exists.

## Statuses and the final merge

`planned → prepared → implementing → awaiting-human-play → accepted`, plus a blocker note with its owner when needed. Accepted SHAs and tags never move; later fixes get new SHAs.

Keep `main` playable. At each milestone check whether `main` has moved and merge it into `rogue` there, so integration isn't left to the end. Don't merge because all files exist. After you accept R9, use a separate instruction:

```text
I accept the R9 build at [SHA]. Check the Git state and the main base
recorded for it. If both are unchanged, tag the previous main and merge
rogue into main locally. If main has moved, merge main into rogue first,
resolve conflicts, run the checks and give me the new SHA and a play
checklist to accept again; leave main unchanged until then. Don't discard
local work, push or deploy.
```

Pushing and deployment are separate instructions. After the merge, rogue is the main game and the fixed dungeon stays reachable as a development fixture.
