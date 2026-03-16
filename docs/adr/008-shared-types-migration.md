# ADR-008: Frontend Migration to Shared Types

## Status
Accepted

## Date
2026-03-16

## Context
The frontend has a manually maintained `src/types/api.ts` (345 lines) that defines event types, session models, and API response shapes. The monorepo now has `shared/api-types/` with generated OpenAPI types and 48 SSE event interfaces that are the source of truth.

## Decision
Replace `frontend/src/types/api.ts` with imports from `@vizcor/api-types`:

1. Add `shared/api-types` as a TypeScript path alias in the frontend's tsconfig and vite config
2. Update all imports from `@/types/api` to `@vizcor/api-types`
3. Remove `src/types/api.ts`
4. Update the event normalization layer in `api-client.ts` to use shared event type discriminated union

## Rationale
- Single source of truth for types (backend-driven)
- New event types (channels, sync, validation) are already defined in shared types
- Eliminates manual synchronization between FE and BE types
- TypeScript compiler catches contract drift at build time

## Consequences
- All frontend files importing from `@/types/api` need updating
- Event normalization may need adjustment for new event categories
- Build depends on shared types being available (monorepo workspace handles this)
