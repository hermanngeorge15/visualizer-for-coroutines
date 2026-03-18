# ADR-013: Core Library Extraction

## Status
Accepted

## Date
2026-03-17

## Context
The backend is a monolithic Ktor application containing both the core visualization logic (events, wrappers, session management, validation) and the HTTP/SSE web layer. To support the IntelliJ plugin (Phase 4), the core logic must be available as a standalone library without Ktor dependencies.

## Decision
Convert the backend to a multi-module Gradle project with two modules:

### Module: `coroutine-viz-core`
**102 source files** extracted to a standalone library with zero Ktor dependencies.

```
coroutine-viz-core/
├── events/          — 45+ event types (VizEvent, CoroutineEvent, Flow/Channel/Mutex/etc.)
├── wrappers/        — VizScope, InstrumentedFlow, VizMutex, VizSemaphore, VizSelect, VizActor
├── session/         — VizSession, EventBus, EventStore, RuntimeSnapshot, ProjectionService
├── models/          — CoroutineNode, CoroutineState, CoroutineTimeline
├── checksystem/     — Validators, EventRecorder, AntiPatternDetector, TimingAnalyzer
├── validation/      — ValidationRule, ValidationRuleRegistry, 20 rules across 6 categories
└── sync/            — DeadlockDetector
```

**Dependencies:** kotlinx-coroutines-core, kotlinx-serialization-json, slf4j-api

### Module: `backend` (root)
Thin HTTP layer depending on `coroutine-viz-core`:
```
backend/
├── routes/          — HTTP endpoints, SSE streaming
├── scenarios/       — Scenario runners (PatternScenarios, SyncScenarios)
├── Application.kt   — Ktor server setup
└── HTTP/Monitoring/Serialization/Routing
```

**Dependencies:** coroutine-viz-core + Ktor + Micrometer

### Build Configuration
```kotlin
// settings.gradle.kts
include("coroutine-viz-core")

// build.gradle.kts (root/backend)
dependencies {
    implementation(project(":coroutine-viz-core"))
}
```

### Publishing
Core library is published via Maven:
- Group: `com.jh.coroutine-visualizer`
- Artifact: `coroutine-viz-core`
- Version: `0.1.0`

## Rationale
- **Zero Ktor dependency** verified — no file in the core packages imports `io.ktor`
- **Identical package names** — no import changes needed in either module
- **Sources duplicated temporarily** — both modules contain the core source files during transition; the backend's copies will be removed once all tests are migrated
- **Core library tests pass independently** — validated with `./gradlew :coroutine-viz-core:test`

## Consequences
### Positive
- IntelliJ plugin can depend on `coroutine-viz-core` JAR directly
- Core library can be used in CLI tools, test frameworks, or other integrations
- Clear separation of concerns (visualization logic vs HTTP transport)

### Negative
- Source duplication during transition period
- Two test suites to maintain until migration completes
- Gradle multi-module adds build complexity
