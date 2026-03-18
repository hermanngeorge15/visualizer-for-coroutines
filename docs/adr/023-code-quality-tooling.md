# ADR-023: Code Quality Tooling (ktlint + detekt)

## Status
Accepted

## Date
2026-03-18

## Context
CLAUDE.md states "Follow `detekt` and `ktlint` rules" but neither tool was configured. The backend has ~24K lines of Kotlin with zero static analysis or formatting enforcement.

## Decision
Add ktlint (v12.2.0) for formatting and detekt (v1.23.7) for static analysis to the backend module.

- Root `.editorconfig` with `indent_size=4`, `max_line_length=140`, `ktlint_official` style
- `no-wildcard-imports` disabled for now -- wildcard imports are baselined for incremental cleanup
- Shared `backend/detekt.yml` with formatting rules disabled (handled by ktlint)
- `GlobalCoroutineUsage: true` (per CLAUDE.md: never `GlobalScope`)
- Detekt baseline captures existing violations for incremental cleanup
- CI gates on `ktlintCheck` and `detekt` before tests

## Rationale
- ktlint handles formatting deterministically; detekt handles semantic analysis. No overlap when detekt formatting is disabled.
- Baseline approach allows immediate CI gating without massive cleanup.
- Wildcard import expansion deferred to a follow-up PR to avoid a large, error-prone diff.

## Consequences
- All PRs must pass `ktlintCheck` and `detekt`
- Developers can run `./gradlew ktlintFormat` to auto-fix locally
- Existing detekt violations are baselined for incremental cleanup
- ADR-004's prerequisite for ktlint/detekt is fulfilled
