# ADR-024: Animation Color System

**Status:** Accepted
**Date:** 2026-03-19

## Context

The visualizer had duplicate `getStateConfig()` functions in `CoroutineTree.tsx` and `CoroutineTreeGraph.tsx`, each with its own color mappings. Only 3 animation colors (indigo, amber, red) were used for 7 coroutine states, making it hard to distinguish SUSPENDED from WAITING_FOR_CHILDREN or CANCELLED from CREATED at a glance. Event list colors in `EventsList.tsx` were inconsistent with the tree views.

## Decision

Introduce a centralized color configuration in `src/lib/coroutine-state-colors.ts` that maps each of the 7 coroutine states to a distinct color family:

| State                | Color   | HeroUI Semantic | Animation       |
|----------------------|---------|-----------------|-----------------|
| CREATED              | slate   | default         | none            |
| ACTIVE               | indigo  | primary         | fast pulse glow |
| SUSPENDED            | amber   | warning         | slow pulse      |
| WAITING_FOR_CHILDREN | purple  | secondary       | medium pulse    |
| COMPLETED            | emerald | success         | one-shot fade   |
| CANCELLED            | gray    | default         | dim             |
| FAILED               | rose    | danger          | shake           |

Key changes from previous mapping:
- **SUSPENDED**: secondary (purple) → warning (amber) — amber conveys "paused/waiting"
- **WAITING_FOR_CHILDREN**: primary (indigo) → secondary (purple) — purple is distinct from ACTIVE
- **CANCELLED**: warning (amber) → default (gray) — gray conveys "inactive/stopped"

Animation variants in `animation-variants.ts` are extended with state-specific variants (`pulseSuspended`, `pulseWaitingForChildren`, `fadeCompleted`, `dimCancelled`) and a `getStateVariant()` helper that returns the correct variant for any state.

## Consequences

- All components share a single source of truth for state colors
- 7 distinct colors make every state visually identifiable
- Animation behavior is tied to state semantics (active states pulse, terminal states settle)
- Future components only need to import `getStateColors()` instead of writing switch statements
- Color changes propagate automatically across tree, graph, and event list views
