# AGENTS.md Must-Do Expansion

## Summary

Update `AGENTS.md` so it explicitly requires two non-optional behaviors on every agent run:

1. Every repository change must be reflected in tests, with tests treated as the source of truth for behavior.
2. Every repository change must be reflected in `docs/`, and every backend domain module plus top-level frontend feature module must have a corresponding markdown doc under `docs/`.

This update should tighten the existing guidance rather than add a disconnected note. The new rules should be written as repo-wide operating requirements, not best-effort suggestions.

## Key Changes

- Add a new high-visibility section near the top of `AGENTS.md` titled something like `## Must-Do On Every Run` or `## Non-Negotiable Agent Duties`.
- In that section, add explicit MUST-level rules:
  - For every code change, update or add unit tests and integration tests that cover the new or changed behavior.
  - Tests must remain the behavioral source of truth; agents must not leave behavior changes undocumented by tests.
  - For every code change, update the relevant docs under `docs/`.
  - Each backend domain module and each top-level frontend feature module must have a corresponding `.md` file in `docs/`.
  - If a module doc does not exist, the agent must create it and document the module’s current state, not just the new delta.
  - If a module doc already exists, the agent must update it to match the current implementation.

- Strengthen existing `Test-Driven`, `Test Integrity`, and `Documentation Rules` sections so they align with the new MUST-do section instead of partially overlapping it.
- Expand `Documentation Rules` to define the required doc scope:
  - Backend scope: modules under `backend/src/domain/`
  - Frontend scope: top-level feature modules such as auth, dashboard, customers, inventory, locations, orders, products, team/invite, and similar feature-level areas
- Add naming guidance for module docs so the implementer does not have to choose ad hoc patterns:
  - Use stable feature/domain-oriented filenames under `docs/`
  - Prefer one module per file
  - Use existing docs like `team-role-management.md` as the depth/format reference until a more formal template exists

- Update the `PR Checklist` so it includes:
  - Tests added or updated for all changed behavior
  - Relevant unit and integration coverage updated
  - Relevant module docs created or updated under `docs/`
  - No touched module is left without a corresponding doc

## Public Interfaces / Policy Changes

- `AGENTS.md` becomes stricter policy, not just guidance.
- The effective documentation contract becomes:
  - One `.md` file per backend domain module
  - One `.md` file per top-level frontend feature module
  - Agents must backfill missing docs when working in a module that lacks one
- The effective testing contract becomes:
  - Behavior-changing work is incomplete unless both implementation and tests are updated together
  - Unit and integration coverage should reflect new functionality whenever applicable, with tests remaining authoritative on expected behavior

## Acceptance Criteria

- `AGENTS.md` contains a dedicated MUST-do section with explicit wording for testing and documentation obligations.
- The updated text clearly states that tests are the source of truth for behavior.
- The updated text clearly states that docs must reflect the current repository state, not just new deltas.
- The updated text clearly defines module doc scope as backend domain modules plus top-level frontend feature modules.
- The `PR Checklist` includes both the testing and documentation obligations in concrete checklist items.
- The new wording does not conflict with the existing `Test Integrity` or `Documentation Rules` sections.

## Assumptions and Defaults

- “Each module” means backend domain modules and top-level frontend feature modules.
- The AGENTS update should mandate doc creation/update behavior but does not need to enumerate every expected doc filename in this edit.
- “Integration tests” should be phrased as required when the changed behavior is exercised at that level, while still keeping the rule strong enough that agents do not skip meaningful integration coverage.
- Existing docs remain the reference for depth and style unless a dedicated doc template is added later.
