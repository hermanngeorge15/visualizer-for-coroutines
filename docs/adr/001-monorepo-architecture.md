# ADR-001: Monorepo Architecture

## Status
Accepted

## Date
2026-03-16

## Context
The Coroutine Visualizer project consists of two separate repositories:
- `vizcor-fe` (React 19 + TypeScript frontend)
- `vizcor-be` (Kotlin + Ktor backend)

These repos share a tight API contract (SSE streaming, REST endpoints), have paired PRs (FE #3 + BE #12), and require coordinated releases. Managing two repos introduces friction: cross-repo PR coordination, duplicated CI config, and API contract drift between `types/api.ts` and Kotlin event models.

## Decision
Combine both repositories into a single monorepo with the following structure:

```
visualizer-for-coroutines/
├── frontend/              # React 19 + TypeScript (pnpm)
├── backend/               # Kotlin + Ktor (Gradle)
├── shared/
│   └── api-types/         # Generated TS types from OpenAPI spec
├── docker-compose.yml     # Local dev environment
├── docs/
│   └── adr/               # Architecture Decision Records
├── .github/
│   └── workflows/         # Path-filtered CI workflows
├── CLAUDE.md
└── package.json           # pnpm workspace root
```

## Rationale
- **Not using Turborepo**: Backend is Gradle-based, not Node.js. Turborepo only accelerates JS/TS builds. A pnpm workspace for FE + Gradle for BE with `docker-compose` is simpler and fits the actual stack.
- **Not using Nx**: Same reasoning. Nx Gradle support exists but adds complexity for a two-project repo.
- **Preserving directory names**: `frontend/` and `backend/` are already the directory names. No rename needed.

## Consequences
- Single repo for all changes eliminates cross-repo PR coordination
- Shared types generated from BE OpenAPI spec prevent contract drift
- Path-filtered CI avoids unnecessary builds
- Developers need both pnpm and Gradle/JDK installed locally (mitigated by Docker)
- Git history from both repos will be preserved via `git subtree` or flattened
