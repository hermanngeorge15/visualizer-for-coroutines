---
sidebar_position: 1
---

# Architecture

The Kotlin Coroutine Visualizer uses an event-sourced architecture where every coroutine operation is captured as an immutable event, stored, projected into views, and streamed to clients.

## High-Level Overview

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│ Instrumented │────>│   EventBus   │────>│  EventStore  │
│   Wrappers   │     │              │     │              │
└──────────────┘     └──────┬───────┘     └──────────────┘
                            │
                    ┌───────┴────────┐
                    │                │
              ┌─────▼─────┐   ┌─────▼─────┐
              │ Projection │   │    SSE    │
              │  Service   │   │  Stream   │
              └─────┬──────┘   └─────┬─────┘
                    │                │
              ┌─────▼─────┐   ┌─────▼─────┐
              │  Runtime   │   │  Frontend │
              │  Snapshot  │   │  / Plugin │
              └────────────┘   └───────────┘
```

## Backend Layers

### Layer 1: Instrumentation Wrappers

`VizScope`, `InstrumentedFlow`, `VizMutex`, `VizSemaphore`, `VizSelect`, `VizActor` — these wrap standard Kotlin coroutine APIs and emit events for every operation.

### Layer 2: Event System

- **EventBus** — In-memory pub/sub for event distribution
- **EventStore** — Append-only store for all events in a session
- **Event Types** — 50+ types across coroutine, job, flow, dispatcher, deferred, channel, and sync packages

### Layer 3: Session Management

- **VizSession** — Top-level container grouping EventBus, EventStore, RuntimeSnapshot, and ProjectionService
- **RuntimeSnapshot** — Mutable projection of current state (active coroutines, held locks, etc.)
- **ProjectionService** — Computes derived views (tree structure, timeline data, validation results)

## Frontend Architecture

- **React 19** with **TypeScript** strict mode
- **TanStack Router** for file-based routing
- **TanStack Query** for server state management
- **SSE client** for real-time event streaming
- **HeroUI** + **Tailwind** for UI components
- **Framer Motion** for animations

## API Layer

- **Ktor 3.3** serves REST endpoints and SSE streams
- **OpenAPI spec** generates TypeScript types in `shared/api-types/`
- Endpoints: sessions CRUD, scenario execution, event streaming, validation results

## Module Structure

```
backend/
├── src/main/kotlin/
│   ├── core/          # EventBus, EventStore, VizSession
│   ├── events/        # All event type definitions
│   ├── wrappers/      # Instrumentation wrappers
│   ├── scenarios/     # Built-in scenario definitions
│   ├── projections/   # ProjectionService, RuntimeSnapshot
│   ├── validation/    # ValidationEngine, rules
│   └── routes/        # Ktor route handlers
```

## Architecture Decision Records

Key design decisions are documented in `docs/adr/`:

- Event sourcing over mutable state
- SSE over WebSocket for streaming
- Per-session isolation
- Projection-based views

See the `docs/adr/` directory in the repository for full ADR documents.
