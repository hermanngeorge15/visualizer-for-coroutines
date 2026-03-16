# ADR-007: Frontend Visualization Expansion

## Status
Accepted

## Date
2026-03-16

## Context
The backend now supports 48+ event types across 8 categories (coroutines, jobs, flow, channels, mutex/semaphore, dispatchers, deferred, validation). The frontend only visualizes basic coroutine lifecycle events (tree, graph, timeline, thread lanes). Channel, flow operator, mutex/semaphore, and validation visualizations are missing entirely.

## Decision
Expand the frontend with dedicated visualization panels for each event category:

1. **Channel Panel** — Buffer state gauge, send/receive timeline, producer-consumer flow diagram
2. **Flow Operator Panel** — Operator chain DAG, backpressure indicators, value transformation trace
3. **Sync Primitives Panel** — Lock state indicators, wait queue visualization, deadlock warnings
4. **Job Status Panel** — WaitingForChildren indicators, job state machine, parent-child blocking view
5. **Validation Panel** — Run validators on session, show pass/fail results with details

Each panel is a new route/tab in the session detail view, activated when the session contains relevant events.

## Rationale
- Event-type detection determines which panels are shown (no empty panels)
- Each panel is independent and can be developed/tested in isolation
- Reuses existing SSE infrastructure and TanStack Query caching
- Shared types from @vizcor/api-types ensure type safety

## Consequences
- 5 new component groups (~15-20 new components)
- New hooks for filtering events by category
- Session detail view needs a tab/panel navigation system
- Bundle size increase mitigated by route-based code splitting
