# Roadmap

**Last updated:** March 2026

This is the single source of truth for what's built and what's left. Previous planning docs (`TODO_STEP_BY_STEP.md`, `BACKEND_IMPLEMENTATION_TASKS.md`, `FRONTEND_IMPLEMENTATION_TASKS.md`, `IMPLEMENTATION_TODOS.md`) have been retired — they showed 0% completion despite ~92% of items being done.

---

## What's Done

### Backend (coroutine-viz-core + Ktor server)

- [x] **48 event types** — Coroutine lifecycle (8), Job (4), Channel (9), Flow (10), Reactive (3), Deferred (3), Sync (14), Dispatcher (2), Select (4), Actor (7), plus WaitingForChildren, SuspensionPoint, AntiPatternDetected, ValidationFindingEmitted
- [x] **Event serialization** — All `@Serializable`, polymorphic, round-trip tested (88 tests)
- [x] **9 instrumentation wrappers** — VizScope, VizDispatchers, InstrumentedFlow, InstrumentedSharedFlow, InstrumentedStateFlow, InstrumentedChannel, InstrumentedDeferred, VizMutex, VizSemaphore
- [x] **Session management** — VizSession, EventBus (SharedFlow), EventStore (in-memory), RuntimeSnapshot, ProjectionService, SessionManager
- [x] **Projection service** — Coroutine hierarchy trees, thread activity timelines, per-coroutine timelines with computed durations
- [x] **Validation engine** — 20+ rules across 6 categories (lifecycle, hierarchy, structured concurrency, performance, threading, resource, exception handling), ValidationRuleRegistry, RealTimeValidator, SuggestionProvider
- [x] **Deadlock detection** — Cycle detection in wait-for graphs, DeadlockDetector
- [x] **Anti-pattern detection** — AntiPatternDetector with event emission
- [x] **9 route modules** — Sessions, Validation, Scenarios, Patterns, Flow, Sync, Viz, Root, Test
- [x] **SSE streaming** — History replay + live events, sequence-filtered to avoid duplicates
- [x] **20+ scenarios** — Basic (nested, parallel, cancellation, deep-nesting, mixed, exception), Channel (rendezvous, buffered, fan-out), Flow (simple, operators, stateflow, sharedflow), Patterns (retry, producer-consumer, fan-out-fan-in, supervisor, circuit-breaker), Realistic (order-processing, user-registration, report-generation), Sync (10 mutex/semaphore/combined scenarios)
- [x] **Custom scenario endpoint** — POST JSON DSL with hierarchical coroutine definitions
- [x] **Core library extraction** — `coroutine-viz-core` module (11,045 LoC) separated from Ktor app
- [x] **Ktor setup** — ContentNegotiation, CORS, OpenAPI/Swagger, Prometheus metrics, Logback
- [x] **Docker** — Dockerfile, docker-compose for development
- [x] **Tests** — 24 test files covering events, validation, wrappers, routes, integration

### Frontend (React 19 + TypeScript)

- [x] **60+ components** — All visualization panels fully implemented with real rendering, animations, and interactivity
- [x] **Coroutine Tree** — Hierarchical list with state colors, pulsing/shake animations, nesting
- [x] **Coroutine Graph** — Interactive DAG with pan/zoom/reset, lock toggle
- [x] **Events List** — Reverse-chronological, search/filter, service icons, VirtualizedEventList for performance
- [x] **Thread Lanes** — Per-dispatcher lanes, utilization gauges, thread segments
- [x] **Dispatcher Overview** — Summary cards per dispatcher
- [x] **Channel Panel** — Buffer gauge, timeline, producer/consumer view
- [x] **Flow Panel** — Operator chain, value trace, backpressure indicator, SharedFlow/StateFlow
- [x] **Sync Panel** — Mutex state, semaphore gauge, wait queue, deadlock warning
- [x] **Job Panel** — Job hierarchy, waiting-for-children cards, state badges
- [x] **Validation Panel** — Run validation, score card, severity filter, category groups, finding cards
- [x] **Actor Panel** — Actor pool, cards, mailbox visualization
- [x] **Select Panel** — Clause bars, winner highlight, duration tracking
- [x] **Exception Propagation Overlay** — Exception chain visualization
- [x] **Scenario Form + Builder** — Built-in scenarios + custom scenario authoring
- [x] **Gallery** — Curated scenarios with difficulty levels
- [x] **18 custom hooks** — useEventStream (real SSE), useSession, useHierarchy, useTimeline, useChannelEvents, useFlowEvents, useSyncEvents, useJobEvents, useActorEvents, useSelectEvents, useAntiPatterns, useThreadActivity, useValidation, useScenarios, useEventCategories, useEventRetention, useKeyboardNav, useEnhancedHierarchy
- [x] **API client** — Full REST integration with fetch, SSE EventSource, error handling
- [x] **870-line type definitions** — 80+ types, 58 event kinds, category unions, const sets
- [x] **Routing** — TanStack Router with sessions, scenarios, gallery, builder pages
- [x] **Animation system** — framer-motion variants, reduced-motion support, throttling
- [x] **Accessibility** — Skip navigation, ARIA labels, high-contrast mode
- [x] **Tests** — 18 test files (components + hooks + API client), Vitest + Testing Library + MSW

### Infrastructure & Docs

- [x] **Monorepo** — frontend + backend + core + plugin + docs-site
- [x] **GitHub Actions CI** — Backend, frontend, core, plugin workflows
- [x] **Dependabot** — Automated dependency updates
- [x] **PR/Issue templates** — Standardized contribution flow
- [x] **CODEOWNERS** — Code review assignments
- [x] **22 ADRs** — All major architecture decisions documented (001-014 existing + 015-022 for remaining features)
- [x] **9 advanced topic guides** — Actor, backpressure, internals, exceptions, mutex/semaphore, anti-patterns, real-world patterns, select, testing
- [x] **User Guide, API Reference, Deployment Runbook, CONTRIBUTING.md, CHANGELOG.md**
- [x] **Implementation Analysis** — Deep-dive guide for all remaining features (`docs/planning/IMPLEMENTATION_ANALYSIS.md`)
- [x] **GitHub Issues** — ~50 issues across 13 epics tracking all remaining work

---

## What's Left

### Production Readiness
> [Epic #16](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/16) | Issues #29-#34

- [ ] **Health endpoint** — `GET /health` with component checks, memory, uptime
- [ ] **Logging cleanup** — Replace any remaining `println` with structured Logback, add dev/prod profiles
- [ ] **CORS from config** — Read allowed origins from `application.yaml` / env var instead of hardcoded
- [ ] **OpenAPI polish** — Add descriptions to all endpoints and DTOs, validate generated spec
- [ ] **Bounded event store** — Add max events per session limit to prevent unbounded memory growth
- [ ] **Micrometer metrics** — Events emitted/dropped counters, SSE client gauge, buffer size gauge

### Persistence & Data
> [ADR-015](../adr/015-persistence-strategy.md) | [Epic #17](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/17) | Issues #35-#37

- [ ] **Storage abstractions** — `SessionStore` and `EventStoreInterface` interfaces, in-memory implementations
- [ ] **JDBC storage** — Exposed ORM + H2 (dev) + PostgreSQL (prod) + HikariCP, events as JSONB
- [ ] **Retention policy** — Background cleanup: max-age TTL, max-events-per-session trim
- [ ] **Session persistence across restarts** — Events survive server restart

### Authentication & Multi-tenancy
> [ADR-016](../adr/016-authentication-architecture.md) | [Epic #18](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/18) | Issues #38-#40

- [ ] **API key auth** — `X-API-Key` header, in-memory key store, protect session routes, allow unauthenticated `/health` and `/openapi`
- [ ] **JWT support** — `ktor-server-auth-jwt`, verify issuer/audience/secret, extract `UserPrincipal` with roles
- [ ] **Tenant isolation** — Filter sessions by authenticated user, prevent cross-tenant access

### Replay & Time Travel
> [ADR-017](../adr/017-replay-engine-design.md) | [Epic #19](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/19) | Issues #41-#43

- [ ] **Replay controller** — Play/pause/stop/step-forward/step-back controls
- [ ] **Playback speed** — 0.5x, 1x, 2x, 5x speed selector
- [ ] **Step-through mode** — Step one event at a time, highlight current event across all views
- [ ] **Progress bar** — Scrubber for timeline position

### Export System
> [ADR-018](../adr/018-export-system-design.md) | [Epic #20](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/20) | Issues #44-#46

- [ ] **PNG export** — html2canvas captures DOM element, download triggered
- [ ] **SVG export** — Serialize graph SVG with embedded styles for standalone rendering
- [ ] **Video/GIF export** — MediaRecorder API records canvas, WebM download

### Session Sharing
> [ADR-019](../adr/019-session-sharing.md) | [Epic #21](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/21) | Issues #47-#48 | Depends on #17

- [ ] **Share tokens** — UUID token linked to session, permissions, expiry (1d/7d/30d/never)
- [ ] **Share endpoints** — `POST /api/sessions/:id/share`, `GET /api/shared/:token`
- [ ] **Read-only view** — ShareModal with copy-to-clipboard, read-only session view

### Session Comparison
> [Epic #22](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/22) | Issues #49-#50

- [ ] **Comparison service** — `ComparisonService.compare(sessionA, sessionB)` returning event count deltas, duration deltas, thread utilization deltas
- [ ] **Comparison endpoint** — `GET /api/sessions/compare?a={id}&b={id}`
- [ ] **Side-by-side UI** — Compare two sessions visually with delta highlights

### Performance & Scaling
> [ADR-020](../adr/020-performance-scaling.md) | [Epic #24](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/24) | Issues #52-#54

- [ ] **Load testing harness** — Synthetic event producer (N coroutines x M events/sec), dev-only route
- [ ] **Sampling** — Per-event-type sampling rate (0.0-1.0), always pass lifecycle events, `X-Sampled` metadata
- [ ] **Event batching** — Configurable batch size/timeout for high-throughput
- [ ] **SSE compression** — Gzip for remote clients

### Observability Integration
> [Epic #23](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/23) | Issue #51

- [ ] **OpenTelemetry exporter** — Map events to OTLP spans, batch processor, configurable flush interval, zero overhead when disabled
- [ ] **Jaeger/Zipkin verification** — Coroutine spans visible in trace backends with parent-child relationships preserved

### IntelliJ Plugin
> [ADR-010](../adr/010-intellij-plugin-architecture.md), [ADR-014](../adr/014-plugin-communication-protocol.md) | [Epic #25](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/25) | Issues #55-#58

- [ ] **Tool window** — JCEF panel loading frontend React app
- [ ] **Backend auto-detect** — Find running backend on localhost:8080, show connection status
- [ ] **Run configuration** — Custom "Coroutine Visualizer" run config wrapping user's main class with instrumentation
- [ ] **DebugProbes hybrid** — Merge DebugProbes snapshots with VizSession events in debug mode
- [ ] **Marketplace publishing** — Description, icon, submit to JetBrains Marketplace

### SDK & CI/CD
> [ADR-021](../adr/021-sdk-distribution.md) | [Epic #26](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/26) | Issues #59-#61

- [ ] **SDK packaging** — Publish `coroutine-viz-core` to GitHub Packages, sample app showing SDK usage
- [ ] **CI/CD plugin** — Gradle task `coroutineVizCheck` that runs scenarios and compares against baselines
- [ ] **CLI tool** — `java -jar coroutine-viz-ci.jar check --config ci-config.yaml`

### Frontend Testing & Polish
> [ADR-022](../adr/022-frontend-testing-strategy.md) | [Epic #27](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/27) | Issues #62-#65

- [ ] **Missing tests** — Actor, select, anti-pattern component and hook tests
- [ ] **E2E tests** — Playwright for full scenario flows (create session → run → verify panels → validate)
- [ ] **Visual regression** — Chromatic snapshot tests for key components
- [ ] **Storybook** — Component documentation and interactive stories
- [ ] **Theme customization** — User-selectable color schemes beyond light/dark
- [ ] **Layout customization** — Drag-and-drop panel arrangement, saved presets
- [ ] **Interactive tutorial** — react-joyride walkthrough for new users

### Marketing Site
> [Epic #28](https://github.com/hermanngeorge15/visualizer-for-coroutines/issues/28) | Issues #66-#67

- [ ] **Astro docs-site** — Landing page with hero, demo GIF, features, how-it-works
- [ ] **Content marketing** — Demo video, blog posts, conference talk submissions, Kotlin community outreach
- [ ] **Deployment** — Vercel/Cloudflare Pages, SEO (meta tags, Open Graph, sitemap)

### Billing (deferred)

Not in current scope. Will revisit after core features are complete.

---

## Priority Order

**Phase 1 — Production Readiness** (weeks 1-2):
1. Health endpoint + logging cleanup + CORS from config
2. Bounded event store + Micrometer metrics
3. Missing frontend tests (actor, select, anti-pattern)

**Phase 2 — User Value** (weeks 3-6):
4. Replay controller + step-through mode
5. Export (PNG/SVG/video)
6. Session comparison

**Phase 3 — Data & Security** (weeks 7-10):
7. Database persistence + retention
8. Authentication (API key → JWT → tenant isolation)
9. Session sharing

**Phase 4 — Scale & Integration** (weeks 11-16):
10. Performance (sampling, load test, SSE compression)
11. OpenTelemetry integration
12. SDK packaging + CI/CD plugin
13. IntelliJ plugin

**Phase 5 — Polish & Growth** (weeks 17+):
14. E2E tests + Storybook + visual regression
15. Theme/layout customization + interactive tutorial
16. Marketing site + content
