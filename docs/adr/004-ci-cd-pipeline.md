# ADR-004: CI/CD Pipeline

## Status
Accepted

## Date
2026-03-16

## Context
Neither repository has CI/CD. PRs are merged without automated checks. The backend has ESLint-equivalent tools (detekt, ktlint) mentioned in docs but not enforced. The frontend has 62 ESLint errors from a misconfigured flat config.

## Decision
Implement GitHub Actions workflows with path filtering:

### Frontend Workflow (`.github/workflows/ci-frontend.yml`)
Triggers on changes to `frontend/**`:
1. **Lint**: `pnpm lint` (ESLint)
2. **Type check**: `tsc --noEmit`
3. **Test**: `pnpm test` (Vitest)
4. **Build**: `pnpm build`

### Backend Workflow (`.github/workflows/ci-backend.yml`)
Triggers on changes to `backend/**`:
1. **Lint**: `./gradlew detekt` + `./gradlew ktlintCheck`
2. **Test**: `./gradlew test`
3. **Build**: `./gradlew build`

### Shared Workflow (`.github/workflows/ci-shared.yml`)
Triggers on changes to `shared/**`:
1. Regenerate types from OpenAPI spec
2. Verify no diff (types are up-to-date)

### Branch Protection
- Require CI pass before merge on `main`
- Require at least 1 review

## Rationale
- Path filtering prevents unnecessary builds (FE changes don't trigger BE CI)
- GitHub Actions is free for public repos and already integrated
- Separate workflows allow independent failure/success

## Consequences
- All PRs must pass CI before merge
- Developers must fix lint/test issues locally before pushing
- detekt and ktlint must be added to `build.gradle.kts`
- ESLint config must be fixed first (ADR prerequisite)
