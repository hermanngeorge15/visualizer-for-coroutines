# ADR-006: PR Consolidation Strategy

## Status
Accepted

## Date
2026-03-16

## Context
The backend has 6 open PRs, 3 with merge conflicts. The frontend has 2 open PRs, both clean. Before monorepo conversion, all PRs must be resolved to establish clean `main` branches.

### Current PR State
| Repo | PR | Status | Conflicts | Action |
|------|----|--------|-----------|--------|
| FE | #5 | Clean | None | Merge |
| FE | #3 | Clean | None | Merge (paired with BE #12) |
| BE | #12 | Clean | None | Merge (paired with FE #3) |
| BE | #8 | Clean | None | Merge (closes Issue #4) |
| BE | #9 | Clean | None | Merge |
| BE | #10 | Conflicts | Trivial | Resolve after #8/#9, merge |
| BE | #7 | Conflicts | Complex | Close, extract checksystem as new PR |
| BE | #6 | Conflicts | Moderate | Resolve, address 3 review comments, merge |

## Decision

### Merge Order
1. FE #5 (docs) — zero risk
2. FE #3 + BE #12 (realistic scenarios) — paired feature
3. BE #8 (flow wrappers) — closes Issue #4
4. BE #9 (mutex/semaphore) — new feature with tests
5. BE #6 (job status) — resolve conflicts + address reviews
6. BE #10 (kdoc) — resolve trivial conflicts
7. BE #7 — close with explanation, create focused follow-up issues

### PR #7 Rationale
PR #7 (event validation) changes 36 files with +5,534/-1,717 lines. This is too large for effective review. The checksystem package will be extracted into a focused PR after the monorepo conversion. The validation framework becomes Issue #3's new implementation plan.

## Consequences
- All 8 PRs resolved before monorepo conversion
- Clean `main` branches on both repos
- PR #7's work is preserved in its branch, not lost
- Issue #3 remains open with a new implementation plan
