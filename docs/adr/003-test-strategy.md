# ADR-003: Test Strategy

## Status
Accepted

## Date
2026-03-16

## Context
- Frontend: Zero test coverage. No test framework installed. 43 source files, ~5,100 LOC.
- Backend: 6 test files (1,333 lines) covering core coroutine logic. 77 source files, ~7,900 LOC. No HTTP endpoint integration tests.

The monorepo conversion and ongoing feature work (channel visualization, job status FE) require regression protection.

## Decision

### Frontend Testing
- **Framework**: Vitest (native Vite integration, fast, compatible with Testing Library)
- **Component testing**: @testing-library/react for component rendering
- **Hook testing**: @testing-library/react `renderHook` for custom hooks
- **API mocking**: MSW (already a dependency) for integration tests

**Priority test targets** (ordered by risk/impact):
1. `api-client.ts` — API layer, contract with backend
2. `use-event-stream.ts` — SSE connection, real-time data flow
3. `use-hierarchy.ts` — Tree data transformation logic
4. `use-sessions.ts` — CRUD operations, cache invalidation
5. Key components: `SessionDetails`, `ScenarioBuilder`

### Backend Testing
- **Framework**: JUnit 5 + Ktor Test Host (already configured)
- **Coroutine testing**: kotlinx-coroutines-test (already a dependency)

**Priority test targets**:
1. HTTP endpoint integration tests (SessionRoutes, ScenarioRunnerRoutes)
2. SSE streaming endpoint tests
3. Flow wrapper tests (InstrumentedFlow, InstrumentedSharedFlow, InstrumentedStateFlow)
4. Event serialization round-trip tests

### Coverage Targets
- Frontend: 60% line coverage on `src/lib/` and `src/hooks/`, 40% on components
- Backend: 70% on `wrappers/`, 80% on `routes/`, 60% on `session/`

## Consequences
- Vitest added as dev dependency to frontend
- Test files colocated with source (`*.test.ts`, `*.test.tsx`)
- CI runs tests on every PR (path-filtered)
- MSW handlers shared between dev mocking and tests
