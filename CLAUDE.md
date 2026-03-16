# Visualizer for Coroutines

Monorepo for the Kotlin Coroutine Visualizer — a real-time tool for visualizing coroutine execution, flow operators, synchronization primitives, and structured concurrency.

## Structure

- `frontend/` — React 19 + TypeScript, Vite, TanStack Router/Query, HeroUI, Tailwind
- `backend/` — Kotlin 2.2 + Ktor 3.3, SSE streaming, event-sourced architecture
- `shared/api-types/` — Generated TypeScript types from backend OpenAPI spec
- `docs/adr/` — Architecture Decision Records

## Development

```bash
# Docker (recommended)
docker compose up

# Local
cd backend && ./gradlew run      # starts on :8080
cd frontend && pnpm dev           # starts on :3000, proxies /api to :8080
```

## Testing

```bash
# Frontend (Vitest + Testing Library)
cd frontend && pnpm test

# Backend (JUnit 5 + Ktor Test Host)
cd backend && ./gradlew test
```

## Architecture

The backend uses an event-sourced architecture with three layers:
1. **Instrumentation Wrappers** — VizScope, InstrumentedFlow, VizMutex, VizSemaphore
2. **Event System** — 32+ event types across coroutine, job, flow, dispatcher, deferred packages
3. **Session Management** — VizSession with EventBus, EventStore, RuntimeSnapshot, ProjectionService

The frontend consumes events via SSE and renders them as interactive visualizations (tree, graph, timeline, thread lanes).

## Key conventions

- Kotlin: Follow `detekt` and `ktlint` rules, use structured concurrency, never `GlobalScope`
- TypeScript: Strict mode, ESLint flat config with browser globals, no `any` where avoidable
- Tests: Colocated with source files (`*.test.ts`, `*.test.tsx` for FE; `src/test/` for BE)
- Commits: Conventional commits (`feat:`, `fix:`, `docs:`, `test:`)
- PRs: Focused, < 500 lines where possible, linked to issues
