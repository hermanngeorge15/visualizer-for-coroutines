# ADR-002: Shared API Contract via OpenAPI

## Status
Accepted

## Date
2026-03-16

## Context
The frontend maintains a manual `types/api.ts` (345 lines) that mirrors backend Kotlin data classes and event types. When the backend adds new event types (e.g., Flow events in PR #8, Mutex events in PR #9), the frontend types must be updated manually. This has already led to normalization workarounds (PascalCase to kebab-case mapping in `api-client.ts`).

The backend already has Ktor Swagger/OpenAPI configured, producing a spec at `/swagger` and `/openapi.json`.

## Decision
Generate TypeScript types from the backend's OpenAPI specification:

1. Backend generates OpenAPI spec as part of the build (`./gradlew generateOpenApiSpec`)
2. Spec is committed to `shared/api-types/openapi.json`
3. TypeScript types are generated via `openapi-typescript` into `shared/api-types/generated.ts`
4. Frontend imports from `@vizcor/api-types` (pnpm workspace package)
5. CI validates that generated types are up-to-date

## Rationale
- Single source of truth for API contract (Kotlin models)
- Type changes in backend automatically propagate to frontend
- OpenAPI spec also serves as API documentation
- `openapi-typescript` is zero-runtime, produces pure type definitions

## Consequences
- Frontend `types/api.ts` will be replaced by generated types
- Backend must keep OpenAPI annotations accurate
- Build pipeline has a generation step
- SSE event types need a separate schema (OpenAPI doesn't model SSE well) — these will be manually maintained in `shared/api-types/events.ts` until a better solution exists
