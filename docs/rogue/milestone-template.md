# Rogue milestone brief template

Copy this structure when preparing or revising `rNN.md`. The AI fills the technical detail by inspecting the current code and authoritative rules. The human reviews outcome, product choices and play criteria. A planned brief becomes prepared only after its stages and dependency contracts are concrete.

## Identity and readiness

- Milestone: R[N]; status: planned/prepared/implementing/awaiting-human-play/accepted.
- Spec baseline and preparation date.
- Integration branch and inspected starting SHA; preceding accepted checkpoint.
- Relevant reports and unresolved defects that affect this milestone.
- Exact prerequisite behavior; classify each as present, needs repair or deliberately deferred.

## Playable outcome

State what the player can do after this milestone and which meaningful decision it supports. Describe a concrete before/after case. Name fixture limitations and exclusions; do not treat a later required feature as removed from the slice.

## Source of truth

Link the authoritative core sections, catalog rows and lore constraints. List actual affected modules and the existing patterns to follow. Record any proposed design change at its owning spec clause, with the reason and the human decision needed.

## Implementation contracts

For each affected contract, define the following or explain why it is outside this milestone:

| Concern | Required preparation detail |
|---|---|
| Ownership and state | Host/client/profile/content owner; state transitions and terminal states |
| Identity and events | Run/request/action/source/entity identity; held/targeted input, ordering, deduplication and retries |
| Timing and geometry | Accepted cast/hit/expiry times; room/height/heading and terrain rules |
| Bounds | Entity/area/proc/queue/byte limits; reserved capacity; full-cap rejection, overflow/resync and final-source cleanup |
| Progression | Charge and stake boundary; XP/ownership; exactly-once settlement and post-win updates |
| Recovery | Death, leave, host exit, reconnect, late sync and stale-state behavior |
| Compatibility | Protocol/content/save versions, dirty-build fingerprint, migrations and incompatible-build handling before stake |
| Presentation | Accepted facts rendered; cues/current-kit descriptions; necessary game UI only |

Do not invent every future protocol field in an early milestone. Establish the shared contract needed now and name the later owner. Do not publish an interaction before its required authority and persistence exist.

## Ordered stages

For each stage specify deliverable, exact files/contracts, dependency, the tests worth adding, useful observation and coherent commit boundary. A stage should be independently reviewable; it need not be an independent public release. Avoid unrelated cleanup and broad rewrites.

## Human inputs and asset handoff

List the few choices that need a human answer, with concrete defaults where reasonable. For each asset give prompt ID, source path, quantity, runtime consumer, needed-by stage, acceptance and fallback. Distinguish required functionality/recordings from optional paintings/music/voices.

## Focused play checklist

Provide class/build/party/seed setup and a short reproducible route through the feature. Explain what to watch and what feedback would indicate failure. Separate ordinary profile play from disposable debug clones; no debug progression writes.

## Completion and report

Define implementation completeness, the verification that runs (the workflow's policy: unit suite every stage, new tests where logic is pure, typecheck/build every commit, e2e when the session flow changes, benchmark only when the human asks), the human feel gate and blockers that prevent moving on.

Create `rNN-report.md` during execution. Include:

- Branch, milestone starting SHA, code checkpoint SHA and reporting commit if different.
- Delivered features and changed files; explicit fixture limitations.
- Authoritative design decisions and relevant migrations/protocol versions.
- Checks actually performed, exact commands/results, and checks not performed.
- Human observation records tied to the observed SHA and setup.
- Defects with reproduction, severity, owner and next action; deferred optional assets.
- Final status and the next milestone's dependency readiness.

The reporting commit can follow the code checkpoint it describes; do not attempt to store a commit's own hash inside that commit. Never create a fabricated accepted report in advance.
