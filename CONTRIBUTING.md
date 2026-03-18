# Contributing to Coroutine Visualizer

Thanks for your interest in contributing! This guide covers how to get started, our conventions, and how to submit changes.

## Prerequisites

- JDK 17+ (backend)
- Node.js 24+ (frontend)
- pnpm 9+ (frontend package manager)
- Docker (optional, for one-command setup)

## Setup

```bash
# Clone the repo
git clone https://github.com/hermanngeorge15/visualizer-for-coroutines.git
cd visualizer-for-coroutines

# Option 1: Docker (recommended)
docker compose up

# Option 2: Local
cd backend && ./gradlew run      # starts on :8080
cd frontend && pnpm dev           # starts on :3000, proxies /api to :8080
```

See [docs/guides/SETUP.md](docs/guides/SETUP.md) for detailed setup and troubleshooting.

## Project Structure

```
visualizer-for-coroutines/
  backend/                  # Kotlin 2.2 + Ktor 3.3
    coroutine-viz-core/     # Core library (events, wrappers, session)
    src/main/kotlin/        # Server routes, scenarios
    src/test/kotlin/        # Backend tests
  frontend/                 # React 19 + TypeScript + Vite
    src/components/         # Visualization panels
    src/hooks/              # Data hooks (SSE, API)
    src/routes/             # TanStack Router pages
  docs/                     # Documentation (gitignored)
  intellij-plugin/          # IntelliJ IDE plugin
```

## Development Workflow

1. Create a branch from `main`
2. Make your changes
3. Run tests to verify
4. Submit a PR

### Running Tests

```bash
# Frontend (Vitest + Testing Library)
cd frontend && pnpm test

# Backend (JUnit 5 + Ktor Test Host)
cd backend && ./gradlew test
```

### Linting

```bash
# Frontend
cd frontend && pnpm lint

# Backend
cd backend && ./gradlew detekt
```

## Code Conventions

### Kotlin (Backend)

- Follow `detekt` and `ktlint` rules
- Use structured concurrency — never `GlobalScope`
- Use `suspend` functions and `Flow` for async work
- Colocate tests in `src/test/kotlin/` mirroring main source structure

### TypeScript (Frontend)

- Strict mode enabled
- ESLint flat config with browser globals
- Avoid `any` where possible — use proper types from `@vizcor/api-types`
- Colocate tests next to source files (`*.test.ts`, `*.test.tsx`)

### General

- Keep files focused — one component/class per file
- Prefer composition over inheritance
- Write tests for new features and bug fixes

## Commit Messages

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
feat: add channel buffer gauge visualization
fix: correct thread lane utilization calculation
docs: update setup guide with Docker instructions
test: add validation panel integration tests
refactor: extract event filtering into shared hook
```

Format: `<type>: <description>`

Types: `feat`, `fix`, `docs`, `test`, `refactor`, `chore`, `ci`, `perf`

## Pull Requests

- Keep PRs focused and under 500 lines where possible
- Link to related issues
- Include a clear description of what and why
- Add screenshots for UI changes
- Ensure all tests pass before requesting review

### PR Template

The repo includes a PR template at `.github/pull_request_template.md`. Fill in all sections.

## Architecture

The backend uses an event-sourced architecture:

1. **Instrumentation Wrappers** — `VizScope`, `InstrumentedFlow`, `VizMutex`, `VizSemaphore` emit events during execution
2. **Event System** — 48+ event types across coroutine, job, flow, channel, dispatcher, sync, actor, select packages
3. **Session Management** — `VizSession` with `EventBus`, `EventStore`, `RuntimeSnapshot`, `ProjectionService`

The frontend consumes events via SSE and renders them as interactive visualizations.

See [docs/adr/](docs/adr/) for architecture decision records.

## Reporting Issues

Use [GitHub Issues](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues) with the provided templates:
- Bug reports
- Feature requests

## Questions?

Open a discussion or reach out via issues. We're happy to help you get started.
