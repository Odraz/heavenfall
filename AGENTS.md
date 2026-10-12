# Project instructions

## Tested handoffs

For this project, the user has replaced the general no-tests preference: every implemented stage or milestone must be tested before handoff.

- Add or update meaningful tests for changed behavior, including regressions and important failure paths.
- Run the complete unit suite, typecheck and production build for each implemented stage. Run the relevant end-to-end suites when session, networking, loading or player-facing behavior changes; follow the milestone brief's named checks.
- Fix failures within the requested scope before handing over a stage. Report the exact commands and results, and distinguish passing checks from checks blocked by an external dependency. Never describe a blocked or unrun check as passed.
- Keep the existing performance thresholds. Run timing-sensitive tests without competing test workers; do not loosen a limit to obtain a green result.
- Run benchmarks only when the user asks. Automated tests do not replace the user's human play/feel acceptance.

Keep changes scoped to the requested stage and established patterns. Prioritize simulation authority, APIs/protocols, domain logic, security, performance and maintainability. Include only presentation explicitly required by the requested stage.
