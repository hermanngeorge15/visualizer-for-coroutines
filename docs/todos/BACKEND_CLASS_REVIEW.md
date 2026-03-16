# Backend Implementation Review (2025-11-26)

Each checkbox represents a follow-up item after reviewing the class’ purpose, current implementation details, and potential adjustments.

## App Bootstrap & HTTP Layer

- [ ] `backend/src/main/kotlin/com/jh/proj/coroutineviz/Application.kt`
  - Purpose: Entry point that delegates to `EngineMain` and wires the Ktor module.
  - Logic: `module()` simply invokes `configureHTTP`, `configureMonitoring`, `configureSerialization`, and `configureRouting`, so every feature flag must be handled inside those functions.
  - Suggestions: Introduce environment-aware wiring (dev vs prod), and consider exposing a `configureCore` so tests can register a reduced stack.

- [ ] `backend/src/main/kotlin/com/jh/proj/coroutineviz/HTTP.kt`
  - Purpose: Configures CORS plus AsyncAPI/Swagger/OpenAPI assets.
  - Logic: Hosts (`localhost:3000`, `127.0.0.1:3000`) and HTTP methods are hard-coded; Swagger/OpenAPI are mounted via two separate `routing` blocks which both hang off the application root.
  - Suggestions: Externalize allowed origins/methods to config and collapse the duplicated `routing {}` sections into a shared block (or a `routing { openAPI(...) ; swaggerUI(...) }`) to avoid re-registration. Consider guarding AsyncAPI with feature toggles if not needed in prod.

- [ ] `backend/src/main/kotlin/com/jh/proj/coroutineviz/Monitoring.kt`
  - Purpose: Installs Micrometer with Prometheus registry and exposes `/metrics-micrometer`.
  - Logic: Uses default Prometheus config with no histogram/custom metrics yet.
  - Suggestions: Add JVM/system binders, include authentication/secret for metrics in prod, and reuse the registry instance in serialization/HTTP if metrics there need access.

- [ ] `backend/src/main/kotlin/com/jh/proj/coroutineviz/Serialization.kt`
  - Purpose: Installs `ContentNegotiation` with Kotlinx serialization and exposes a sample `/json/kotlinx-serialization` endpoint.
  - Logic: Sample endpoint is primarily smoke-test scaffolding.
  - Suggestions: Remove or hide the sample endpoint in prod builds, and configure JSON (pretty print, explicit nulls) centrally so the rest of the stack inherits consistent settings.

- [ ] `backend/src/main/kotlin/com/jh/proj/coroutineviz/Routing.kt`
  - Purpose: Main HTTP surface (hello world, SSE test, scenario triggers, test harness, session CRUD, scenario DSL endpoints).
  - Logic: A single 900+ line file mixes demo/test routes with public API. Session routes rely on the global `SessionManager`, scenario routes spin up `VizEventMain` or `ScenarioRunner`, and SSE streaming directly collects from `session.bus`.
  - Suggestions:
    - Break the file into feature modules (basic ping, scenario execution, session management, SSE streaming) to shrink blast radius and share auth/pipeline config.
    - Extract repeated `VizEventMain()` creation/try/catch into helpers.
    - Add request validation + consistent error payloads (structured problem response vs raw maps).
    - For SSE, guard against head-of-line blocking by using buffered flows or per-client coroutine scopes.

- [ ] DTOs inside `Routing.kt` (`SessionSnapshotResponse`, `ScenarioCompletionResponse`, `ScenarioResponse`, `ScenarioResultData`, `CoroutineNodeDto`)
  - Purpose: Shape API responses for snapshots, scenario completions, and aggregated coroutine nodes.
  - Suggestions: Co-locate them under a `dto` package so they can be shared with frontend typed clients, and add `@SerialName` to keep backward compatibility if field names change.

## Core Event Model (`backend/src/main/kotlin/com/jh/proj/coroutineviz/events`)

- [ ] `VizEvent` & `CoroutineEvent`
  - Purpose: Base sealed interfaces that enforce session/sequence metadata for every event.
  - Suggestions: Add common helper methods (e.g., `fun withSeq(next: Long)`) so manual event creation can’t accidentally reuse a sequence.

- [ ] Coroutine lifecycle data classes (`CoroutineCreated`, `CoroutineStarted`, `CoroutineBodyCompleted`, `CoroutineCompleted`, `CoroutineCancelled`, `CoroutineFailed`, `CoroutineSuspended`, `CoroutineResumed`)
  - Purpose: Model DSL lifecycle transitions; each data class simply overrides `kind`.
  - Suggestions: Consider consolidating repetitive overrides via an abstract base to remove boilerplate and enforce consistent naming.

- [ ] Job-oriented events (`JobJoinRequested`, `JobJoinCompleted`, `JobCancellationRequested`, `JobStateChanged`)
  - Purpose: Track blocking/cancellation semantics on jobs.
  - Suggestions: Emit them from `VizScope` when `join/cancel` helpers are eventually introduced, otherwise remove dead code.

- [ ] Deferred events (`InstrumentedDeferred`, `DeferredAwaitStarted`, `DeferredAwaitCompleted`, `DeferredValueAvailable`)
  - Purpose: Provide hooks when awaiting deferred values or when async completes.
  - Logic: `InstrumentedDeferred.await()` emits await start/completion and suspension/resume around `delegate.await()`, but it never updates the `bodyTerminalEventEmitted` guard defined in `vizAsync`, so duplicate terminal events are still possible.
  - Suggestions: Set/clear the guard (see `VizScope.vizAsync` below) and cache the awaiter metadata instead of re-reading `currentCoroutineContext()` multiple times.

- [ ] Dispatcher/thread events (`DispatcherSelected`, `ThreadAssigned`, `InstrumentedDispatcher`)
  - Purpose: Track dispatcher routing plus actual thread execution.
  - Suggestions: Surface queue depth/worker pool metadata from delegate dispatchers and ensure `InstrumentedDispatcher` is idempotent (detect double-wrapping).

- [ ] Flow events (`FlowCreated`, `FlowCollectionStarted`, `FlowValueEmitted`, `FlowCollectionCompleted`, `FlowCollectionCancelled`, `FlowBufferOverflow`)
  - Purpose: Trace Flow lifecycle and emissions.
  - Suggestions: Emit `FlowCreated`/`FlowBufferOverflow` from `InstrumentedFlow` so store/projection can visualize flows; currently only collection-time events are fired.

- [ ] Misc instrumentation events (`DispatcherSelected`, `ThreadAssigned`, `SuspensionPoint`)
  - Purpose: `SuspensionPoint` captures stack frames for suspension reasons.
  - Suggestions: Allow configurable frame filters so internal helper packages are excluded automatically.

## Instrumentation Wrappers & Helpers

- [ ] `backend/src/main/kotlin/com/jh/proj/coroutineviz/wrappers/VizScope.kt`
  - Purpose: Provides `vizLaunch`, `vizAsync`, `vizDelay`, and cancellation helpers that emit tracking events.
  - Logic highlights:
    - Each launch/async creates a `VizCoroutineElement` and `EventContext`, emits created/started/thread events, wraps body to send terminal events, and uses `invokeOnCompletion` for cancellation/failure reporting.
    - `vizAsync` defines `bodyTerminalEventEmitted` but never flips it to `true`, so the guard is ineffective.  
      ```258:390:backend/src/main/kotlin/com/jh/proj/coroutineviz/wrappers/VizScope.kt
        val bodyTerminalEventEmitted = AtomicBoolean(false)
        …
        if (!bodyTerminalEventEmitted.get()) {
            when {
                cause == null -> session.send(CoroutineCompleted(…))
                …
            }
        }
      ```
  - Suggestions:
    - Extract shared logic between `vizLaunch` and `vizAsync` (event preamble, thread assignment, body completion) into private helpers to avoid divergence.
    - Properly set `bodyTerminalEventEmitted` when emitting completion/cancel/failure so duplicate terminal events cannot occur.
    - Consider returning a typed `VizJob`/`VizDeferred` wrapper again (currently commented out) so callers can hook additional telemetry.

- [ ] `VizCoroutineElement`
  - Purpose: `CoroutineContext.Element` used to carry ids/labels through nested launches.
  - Suggestions: Expand to include scope/session references so instrumentation does not have to look them up repeatedly.

- [ ] `VizDispatchers`
  - Purpose: Factory/holder for `InstrumentedDispatcher` instances corresponding to Default/IO/Unconfined plus a `instrument()` helper.
  - Suggestions: Cache per session+name to avoid duplicating dispatcher IDs, and expose lifecycle to close custom executors when sessions end.

- [ ] `events/InstrumentedDispatcher.kt`
  - Purpose: Wraps a base dispatcher to emit `DispatcherSelected` and `ThreadAssigned`.
  - Suggestions: Propagate `delay`/`limitedParallelism` overrides to delegate or extend `CoroutineDispatcher` properly so instrumentation survives `limitedParallelism`.

- [ ] `wrappers/InstrumentedFlow.kt`
  - Purpose: Decorates a `Flow` to emit collection start/value/completion/cancel events.
  - Logic: Directly calls `session.eventBus.send(...)`, so events bypass `EventStore`/`EventApplier` and never reach snapshots.  
    ```30:97:backend/src/main/kotlin/com/jh/proj/coroutineviz/wrappers/InstrumentedFlow.kt
        session.eventBus.send(
            FlowCollectionStarted(…)
        )
        …
        session.eventBus.send(
            FlowValueEmitted(…)
        )
    ```
  - Suggestions: Route through `session.send(...)` so flows are persisted like coroutine events, and emit a distinct `FlowCreated` event when wrapping occurs.

## Session Runtime & Projections

- [ ] `VizSession`
  - Purpose: Encapsulates session-scoped scope, bus, store, snapshot, and projection service.
  - Suggestions: Guard `send()` with try/catch so a failing `EventApplier` doesn’t prevent bus emission, and expose lifecycle hooks so long-running sessions can evict old events.

- [ ] `EventBus`
  - Purpose: `MutableSharedFlow`-backed broadcaster with `DROP_OLDEST`.
  - Suggestions: Surface metrics for dropped events and consider per-session channel sizes or backpressure (SSE clients currently risk data loss under load).

- [ ] `EventStore`
  - Purpose: In-memory append-only `CopyOnWriteArrayList`.
  - Suggestions: Replace with lock-free ring buffer or persistent storage; `CopyOnWrite` is expensive for high-frequency appends.

- [ ] `RuntimeSnapshot`, `CoroutineNode`, `CoroutineState`
  - Purpose: Mutable map of coroutine nodes plus enums for state transitions.
  - Suggestions: Use thread-safe structures or ensure all calls go through a single thread; currently `session.send()` might be invoked from any dispatcher.

- [ ] `EventApplier`
  - Purpose: Applies events to `RuntimeSnapshot` (state machine + thread metadata).
  - Suggestions: Expand to handle dispatcher/deferred/flow events, and validate state transitions. Consider emitting warnings via metrics instead of logs for observability.

- [ ] `ProjectionService`, `HierarchyNode`, `ThreadEvent`, `CoroutineTimeline`, `TimelineEventSummary`
  - Purpose: Builds derived views (hierarchy tree, thread activity, timelines) by subscribing to the bus.
  - Logic: `getHierarchyTree()` currently returns a flat list sorted by creation instead of a nested structure, even though `buildTree()` suggests otherwise.  
    ```136:151:backend/src/main/kotlin/com/jh/proj/coroutineviz/session/ProjectionService.kt
    fun getHierarchyTree(scopeId: String?): List<HierarchyNode> {
        …
        return buildTree(roots, filtered)
    }
    private fun buildTree(…): List<HierarchyNode> {
        return allNodes.sortedBy { it.createdAtNanos }
    }
    ```
  - Suggestions: Actually construct a tree (e.g., parent contains child nodes) or clarify that the API is flat. Also, reset projection state when sessions are closed to prevent leaks.

- [ ] `EventContext` (+ extension functions)
  - Purpose: Aggregates metadata and supplies helper builders for lifecycle/job/thread events.
  - Suggestions: Add helpers for deferred/flow events so wrappers don’t craft them manually, and consider pooling contexts to cut allocations.

- [ ] `SessionManager`
  - Purpose: In-memory session registry with CRUD helpers and lightweight DTO.
  - Suggestions: Add TTL/cleanup, expose session names, and return HTTP-safe errors when collisions occur. Optionally persist across restarts.

- [ ] `VizEventMain`
  - Purpose: Scenario/test harness with multiple examples (simple launch, nested, async, exception propagation, dispatcher tracking, etc.).
  - Suggestions: Split into smaller scenario classes or move into `examples` to reduce noise in production builds. Consider turning these into automated tests instead of HTTP-driven demos.

## Scenario System (`backend/src/main/kotlin/com/jh/proj/coroutineviz/scenarios`)

- [ ] `ScenarioDSL.kt`
  - Purpose: Provides `CoroutineAction`, `CoroutineConfig`, `ScenarioConfig`, plus builders and `executeCoroutineConfig`.
  - Suggestions: Extend actions to cover `vizAsync`, `withContext`, and Flow operations. Add validation so IDs are unique before execution.

- [ ] `ScenarioDTO.kt`
  - Purpose: Serializable DTOs (`ActionDTO`, `CoroutineConfigDTO`, `ScenarioConfigRequest`, `ScenarioExecutionResponse`) and mapping helpers.
  - Suggestions: Accept numeric parameters directly (instead of `Map<String,String>`) and surface validation errors more precisely than `IllegalArgumentException`.

- [ ] `ScenarioRunner.kt`
  - Purpose: Predefined scenarios (nested, parallel, cancellation, deep nesting, mixed, exception, custom).
  - Suggestions: Return structured results instead of raw `Job`s, and plumb in cancellation/timeout support so API handlers don’t need to `job.join()` blindly.

## Checksystem Utilities

- [ ] `checksystem/EventRecorder.kt`
  - Purpose: Captures events grouped by coroutine and kind for later verification.
  - Suggestions: Integrate with tests or expose via diagnostics; currently unused in production.

- [ ] `checksystem/SequenceChecker.kt`
  - Purpose: Validates whether a coroutine emitted expected event kinds in order, using `EventRecorder`.
  - Logic bug: The function accepts a `Set<String>` but then treats it as an ordered list, so caller-provided order is lost.  
    ```7:18:backend/src/main/kotlin/com/jh/proj/coroutineviz/checksystem/SequenceChecker.kt
    fun checkSequence(coroutineId: String, expectedKinds: Set<String>): Boolean {
        val actualKinds = events.map { it.kind }
        val expectedKindsList = expectedKinds.toList()
        var setIndex = 0
        for (item in actualKinds) {
            if (setIndex < actualKinds.size && item == expectedKindsList[setIndex]) {
                setIndex++
            }
        }
        return setIndex == expectedKindsList.size
    }
    ```
  - Suggestions: Accept `List<String>` or varargs to preserve ordering, and add assertions/logging to highlight the first mismatch.

## Example Entry Points

- [ ] `examples/DispatcherExample.kt`
  - Purpose: Demonstrates how to use `VizDispatchers` + `VizScope` to visualize dispatcher/thread tracking.
  - Suggestions: Move into automated integration tests or docs, and surface its output via HTTP so frontend can trigger it without SSH access.


