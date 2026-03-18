# ADR-010: IntelliJ Plugin Architecture

## Status
Proposed

## Date
2026-03-17

## Context
The web-based visualizer provides comprehensive coroutine visualization but requires switching between IDE and browser. An IntelliJ IDEA plugin would provide an integrated experience where developers can visualize coroutine behavior directly in their IDE, alongside their code.

Two approaches exist for gathering coroutine runtime data:
1. **VizSession events** — Our existing instrumentation wrappers (`VizScope`, `InstrumentedFlow`, etc.) emit typed events with rich metadata
2. **DebugProbes** — Kotlin's `kotlinx-coroutines-debug` provides coroutine state inspection but with less detail and no event history

## Decision
Adopt a **hybrid approach** with VizSession events as the primary data source and DebugProbes as a fallback.

### Primary: VizSession Instrumentation (Recommended)
- User instruments their code with `VizScope` wrappers (explicit opt-in)
- Events are sent from the instrumented application to the plugin via a lightweight HTTP receiver
- Full event history, operator chains, backpressure data, validation findings

### Fallback: DebugProbes (Zero-configuration)
- User enables `DebugProbes.install()` in their coroutine scope
- Plugin polls `DebugProbes.dumpCoroutines()` for state snapshots
- Provides basic tree view and state tracking without instrumentation
- No event history, no flow/channel/sync visualization

### Module Extraction Strategy
Before building the plugin, extract a reusable core library:

```
coroutine-viz-core/
├── events/          — All 45+ event types (sealed hierarchy)
├── wrappers/        — VizScope, InstrumentedFlow, VizMutex, etc.
├── session/         — VizSession, EventBus, EventStore, RuntimeSnapshot
├── checksystem/     — Validators, EventRecorder, TimingAnalyzer
├── validation/      — ValidationRule system (Phase 3)
├── models/          — CoroutineNode, CoroutineState, etc.
└── sync/            — DeadlockDetector
```

The existing backend becomes a thin HTTP/SSE layer over `coroutine-viz-core`:
```
backend/
├── routes/          — HTTP endpoints, SSE streaming
├── scenarios/       — Scenario runner (backend-only)
└── Application.kt   — Ktor server setup
```

### Plugin Communication Protocol
```
[User's App] ---(HTTP POST events)---> [Plugin EventReceiver :8090]
                                              |
                                        [PluginSession]
                                              |
                                  [Tool Window UI (Swing)]
```

- Plugin starts a lightweight HTTP server (Netty or Ktor-client) on a configurable port
- Instrumented app sends events via `PluginEventSink` (included in `coroutine-viz-core`)
- Plugin processes events through the same `EventBus` → `RuntimeSnapshot` → `ProjectionService` pipeline

### Plugin Structure
```
intellij-plugin/
├── src/main/kotlin/
│   ├── CoroutineVisualizerPlugin.kt       — Plugin entry point
│   ├── CoroutineVisualizerToolWindowFactory.kt
│   ├── receiver/
│   │   ├── PluginEventReceiver.kt         — HTTP server for events
│   │   └── PluginSession.kt              — Manages event state
│   ├── ui/
│   │   ├── TreePanel.kt                   — JTree coroutine hierarchy
│   │   ├── TimelinePanel.kt              — Custom timeline drawing
│   │   ├── EventLogPanel.kt             — JTable event log
│   │   └── renderers/                    — Custom cell renderers
│   ├── actions/
│   │   └── RunWithVisualizerAction.kt    — Run configuration
│   └── settings/
│       └── VisualizerSettingsConfigurable.kt
├── src/main/resources/
│   └── META-INF/plugin.xml
├── build.gradle.kts                       — IntelliJ Gradle Plugin
└── src/test/kotlin/
```

### Target Compatibility
- IntelliJ IDEA 2024.1+ (241.x platform)
- Kotlin plugin required
- JDK 17+ runtime

## Rationale
- **Hybrid approach** serves both power users (full instrumentation) and casual users (DebugProbes)
- **Library extraction** enables code reuse without duplication between web and plugin
- **HTTP-based communication** is simpler than JDWP/debug agent integration and works across processes
- **VizSession events** provide richer data than DebugProbes (operator chains, backpressure, validation)
- **Existing backend code** (EventBus, RuntimeSnapshot, ProjectionService) can be directly reused

## Consequences
### Positive
- Developers visualize coroutines without leaving IntelliJ
- Core library enables future integrations (VS Code, CLI tool)
- DebugProbes fallback requires zero code changes from users

### Negative
- Library extraction is a significant refactoring effort
- Plugin development has a steep learning curve (IntelliJ Platform SDK)
- Swing UI is less capable than React for animations
- Two codepaths to maintain (VizSession vs DebugProbes)

### Risks
- IntelliJ Platform API changes between versions may require compatibility shims
- HTTP receiver port conflicts with other tools
- Performance impact of running event receiver alongside IDE

## Related
- ADR-001: Monorepo Architecture (will add `intellij-plugin/` and `coroutine-viz-core/`)
- Phase 4 of Product Roadmap
