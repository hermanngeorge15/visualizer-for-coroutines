# Coroutine Visualizer Backend Blueprint (Ktor + kotlinx.coroutines)

This document distills how `kotlinx-coroutines-core` implements its primitives and proposes a decorator-based Ktor backend that emits visualization-friendly events without forking the library. It ends with a business analysis and rollout guidance for a Kotlin coroutine visualizer.

## 1. Understanding kotlinx-coroutines-core (what we are wrapping)

### Job & state machine
`JobSupport` is the canonical state machine that tracks every coroutine lifecycle transition (`EMPTY_*`, `SINGLE`, `LIST_*`, `COMPLETING`, `CANCELLING`, `FINAL_*`). Instrumenting coroutine lifecycles means observing the same transitions it manages.

```24:41:kotlinx-coroutines-core/common/src/JobSupport.kt
public open class JobSupport constructor(active: Boolean) : Job, ChildJob, ParentJob {
    final override val key: CoroutineContext.Key<*> get() = Job

    /*
       === Internal states ===
```

### Builders sit on top of `AbstractCoroutine`
Every builder (`launch`, `async`, etc.) instantiates a concrete `AbstractCoroutine`, links it to a parent job, and delegates lifecycle callbacks (`onStart`, `onCompleted`, `onCancelled`), making them ideal interception points.

```36:70:kotlinx-coroutines-core/common/src/AbstractCoroutine.kt
public abstract class AbstractCoroutine<in T>(
    parentContext: CoroutineContext,
    initParentJob: Boolean,
    active: Boolean
) : JobSupport(active), Job, Continuation<T>, CoroutineScope {
    @Suppress("LeakingThis")
    public final override val context: CoroutineContext = parentContext + this
    protected open fun onCompleted(value: T) {}
    protected open fun onCancelled(cause: Throwable, handled: Boolean) {}
```

### Builder utilities (`launch` / `async`)
Decorators can wrap the public builder API before it constructs `StandaloneCoroutine`, `DeferredCoroutine`, etc., keeping user code nearly identical.

```44:89:kotlinx-coroutines-core/common/src/Builders.common.kt
public fun CoroutineScope.launch(
    context: CoroutineContext = EmptyCoroutineContext,
    start: CoroutineStart = CoroutineStart.DEFAULT,
    block: suspend CoroutineScope.() -> Unit
): Job {
    val newContext = newCoroutineContext(context)
    val coroutine = if (start.isLazy)
        LazyStandaloneCoroutine(newContext, block) else
        StandaloneCoroutine(newContext, active = true)
    coroutine.start(start, coroutine, block)
    return coroutine
}
```

### Flow & collectors
`Flow.collect` is a suspend function that honors context preservation via `SafeCollector`, so wrapping collectors allows emission of `FlowCollected` and `ValueEmitted` events without altering flow semantics.

```176:229:kotlinx-coroutines-core/common/src/flow/Flow.kt
public interface Flow<out T> {
    public suspend fun collect(collector: FlowCollector<T>)
}

@ExperimentalCoroutinesApi
public abstract class AbstractFlow<T> : Flow<T>, CancellableFlow<T> {
    public final override suspend fun collect(collector: FlowCollector<T>) {
        val safeCollector = SafeCollector(collector, coroutineContext)
        try {
            collectSafely(safeCollector)
        } finally {
            safeCollector.releaseIntercepted()
        }
    }
```

### Dispatchers & threads
`Dispatchers` exposes `Default`, `IO`, `Main`, etc., backed by shared schedulers. A dispatcher decorator can track scheduling decisions without changing the underlying pools.

```14:65:kotlinx-coroutines-core/jvm/src/Dispatchers.kt
public actual object Dispatchers {
    @JvmStatic
    public actual val Default: CoroutineDispatcher = DefaultScheduler
    @JvmStatic
    public actual val Main: MainCoroutineDispatcher get() = MainDispatcherLoader.dispatcher
    @JvmStatic
    public actual val Unconfined: CoroutineDispatcher = kotlinx.coroutines.Unconfined
    @JvmStatic
    public val IO: CoroutineDispatcher get() = DefaultIoScheduler
}
```

### DebugProbes as a complementary signal
`kotlinx-coroutines-debug` injects hooks on coroutine creation, suspension, and resumption. Our backend can offer a “DebugProbes passthrough” mode to reuse snapshot data when low effort is desired.

```11:48:kotlinx-coroutines-debug/src/DebugProbes.kt
/**
 * Debug probes is a dynamic attach mechanism which installs multiple hooks into coroutines machinery.
 * It slows down all coroutine-related code, but in return provides diagnostic information, including
 * asynchronous stacktraces, coroutine dumps ...
 */
@ExperimentalCoroutinesApi
public object DebugProbes {
    public fun install() { DebugProbesImpl.install() }
    public fun uninstall() { DebugProbesImpl.uninstall() }
    public fun dumpCoroutinesInfo(): List<CoroutineInfo> =
        DebugProbesImpl.dumpCoroutinesInfo().map { CoroutineInfo(it) }
```

## 2. High-level mental model

- **Nodes**: coroutine instances (Jobs), scopes, dispatchers, threads, channels, flows.
- **Edges**: parent→child job links, scope ownership, dispatcher-thread assignments, channel send/receive pairs.
- **Events**: timestamped immutable records describing state transitions (`CoroutineCreated`, `CoroutineSuspended`, etc.).
- **Timelines**: per-coroutine and per-thread sequences for animation; events map to keyframes.
- **Identifiers**: ULID/UUID for every coroutine, scope, dispatcher view, flow collector, and channel endpoint to keep state referentially stable in the frontend.

Visualizations then layer:
1. **Structure graph** (nodes & edges).
2. **Lifecycle timelines** (events sorted by wall-clock and logical sequence).
3. **Execution lanes** (dispatcher/thread assignment vs. actual time).

## 3. Core backend architecture (Ktor-first)

### 3.1 Components
- **`VisualizerApplication`**: Ktor module wiring HTTP routes, WebSockets/SSE, and dependency injection.
- **`EventSink` (interface)**: `fun publish(event: VisualizerEvent)` implemented by `InMemoryEventBus`, `PersistentEventStore`, etc.
- **`IdRegistry`**: generates/stores stable IDs, including mapping of `Job`/`CoroutineContext` hash to our IDs.
- **`InstrumentationContext`**: attaches to `CoroutineContext` as an element to ferry IDs and metadata.
- **`TimelineStore`**: ring-buffer with snapshot persistence for replay/step-through.
- **`ProjectionService`**: builds derived views (hierarchy tree, dispatcher occupancy, channel backpressure).
- **`StreamingController`**: multiplexes WebSocket/SSE streams, applies filters (by scope, tag, severity).
- **`ScenarioRunner`** (optional): runs curated teaching samples inside the same backend for quick demos.

### 3.2 Glue with Ktor
```
fun Application.visualizerModule() {
    install(DefaultHeaders)
    install(ContentNegotiation) { json() }
    install(WebSockets)
    routing {
        visualizerRoutes(eventStore, projectionService, scenarioRunner)
    }
}
```
Key routes:
- `GET /api/coroutines` — paged snapshots.
- `GET /api/timeline/{id}` — events for a coroutine/scope.
- `GET /api/hierarchy` — tree derived from parent-child edges.
- `WebSocket /ws/events` or `GET /sse/events` — live firehose with filter query params.
- `POST /api/scenarios/{name}/run` — spin up built-in teaching scenarios.

### 3.3 Processing pipeline
1. **Wrapper** intercepts a coroutine action and emits a strongly typed event via `EventSink`.
2. **EventBus** fans out to:
   - real-time stream,
   - snapshot buffer (for later queries),
   - optional OTLP/DebugProbe bridge.
3. **Projection jobs** consume the same bus to maintain derived models (hierarchy, thread lanes).
4. **Frontend** fetches snapshots + subscribes to live updates.

## 4. Event model & data structures

Use a sealed hierarchy that is easy to serialize with kotlinx.serialization or Jackson.

```kotlin
sealed interface VisualizerEvent {
    val eventId: String
    val timestamp: Instant
    val coroutineId: String?
    val scopeId: String?
    val tags: Map<String, String>
}

sealed interface CoroutineEvent : VisualizerEvent
data class CoroutineCreated(..., val dispatcherId: String, val parentId: String?) : CoroutineEvent
data class CoroutineStateChanged(..., val from: CoroutineState, val to: CoroutineState) : CoroutineEvent
data class CoroutineSuspended(..., val suspensionPoint: SuspensionSite) : CoroutineEvent
data class CoroutineResumed(..., val threadId: String, val dispatcherId: String) : CoroutineEvent
data class CoroutineCompleted(..., val outcome: Outcome, val duration: Duration) : CoroutineEvent
data class CoroutineCancelled(..., val cause: String, val propagatedToParent: Boolean) : CoroutineEvent

sealed interface DispatcherEvent : VisualizerEvent
data class DispatcherSelected(..., val dispatcherId: String, val reason: String) : DispatcherEvent
data class ThreadAssigned(..., val threadId: String, val queueDepth: Int) : DispatcherEvent

sealed interface FlowEvent : VisualizerEvent
data class FlowCollected(..., val collectorId: String) : FlowEvent
data class ValueEmitted(..., val valuePreview: String, val sequence: Long) : FlowEvent

sealed interface ChannelEvent : VisualizerEvent
data class ChannelSend(..., val channelId: String, val buffered: Int) : ChannelEvent
data class ChannelReceive(..., val channelId: String, val remaining: Int) : ChannelEvent
```

**Frontend needs**: `eventId`, `timestamp`, actor IDs, labels, hierarchical references, and a `stepIndex` to support deterministic playback even when timestamps collide (e.g., use monotonic counter).

### Example event stream (simplified)
1. `CoroutineCreated(id=A, parentId=root, dispatcher=Default)`
2. `DispatcherSelected(id=A, dispatcher=Default)`
3. `ThreadAssigned(id=A, thread="DefaultWorker-1")`
4. `CoroutineSuspended(id=A, suspensionPoint="withContext(IO)")`
5. `DispatcherSelected(id=A, dispatcher=IO)`
6. `ThreadAssigned(id=A, thread="IODispatcher-3")`
7. `CoroutineResumed(id=A)`
8. `CoroutineCompleted(id=A, outcome=Value(result=42))`

Events can be replayed either by timestamp or by `stepIndex` for deterministic animation.

## 5. Decorator wrappers for coroutine primitives

### 5.1 Scopes & builders

```kotlin
class InstrumentedScope(
    private val delegate: CoroutineScope,
    private val sink: EventSink,
    private val idRegistry: IdRegistry
) : CoroutineScope by delegate {

    fun launch(
        context: CoroutineContext = EmptyCoroutineContext,
        start: CoroutineStart = CoroutineStart.DEFAULT,
        name: String? = null,
        block: suspend CoroutineScope.() -> Unit
    ): Job {
        val id = idRegistry.nextCoroutineId(name)
        val metadataContext = context + InstrumentationContext(id, name)
        sink.publish(CoroutineCreatedEvent(id, parentId(), dispatcher(metadataContext)))
        return delegate.launch(metadataContext, start) {
            emitLifecycle(id) { CoroutineStateChangedEvent(id, from, to) }
            try {
                block()
                sink.publish(CoroutineCompletedEvent(id, Outcome.Success))
            } catch (ex: CancellationException) {
                sink.publish(CoroutineCancelledEvent(id, ex.message, true))
                throw ex
            } catch (ex: Throwable) {
                sink.publish(ExceptionThrownEvent(id, ex))
                throw ex
            }
        }
    }
}
```

Key ideas:
- `InstrumentationContext` stores IDs & tags and is merged into `CoroutineContext`.
- Lifecycle updates hook into `invokeOnCompletion` / `invokeOnCancellation`.
- Structured concurrency info comes from `coroutineContext[Job]?.children`.

### 5.2 Dispatchers

Wrap `CoroutineDispatcher.dispatch` to emit scheduling events.

```kotlin
class InstrumentedDispatcher(
    private val delegate: CoroutineDispatcher,
    private val dispatcherId: String,
    private val sink: EventSink
) : CoroutineDispatcher() {
    override fun dispatch(context: CoroutineContext, block: Runnable) {
        val coroutineId = context[InstrumentationContext]?.id
        sink.publish(DispatcherSelectedEvent(coroutineId, dispatcherId))
        delegate.dispatch(context) {
            sink.publish(ThreadAssignedEvent(coroutineId, Thread.currentThread().name))
            block.run()
        }
    }

    override fun isDispatchNeeded(context: CoroutineContext): Boolean =
        delegate.isDispatchNeeded(context)
}
```

### 5.3 Flow & channels

- **Flows**: wrap `Flow.collect` with a `CollectingContext` that emits `FlowCollected`, `ValueEmitted`, and `FlowCompleted`.
- **Channels**: decorate `SendChannel` / `ReceiveChannel` interfaces to track buffer depth and backpressure.

```kotlin
class InstrumentedFlow<T>(
    private val delegate: Flow<T>,
    private val id: String,
    private val sink: EventSink
) : Flow<T> {
    override suspend fun collect(collector: FlowCollector<T>) {
        val collectorId = sink.lookupCollectorId(collector)
        sink.publish(FlowCollected(id, collectorId))
        delegate.collect { value ->
            sink.publish(ValueEmitted(id, collectorId, preview(value)))
            collector.emit(value)
        }
        sink.publish(FlowCompleted(id))
    }
}
```

### 5.4 Sample Ktor usage

```kotlin
fun Route.demoRoutes(factory: InstrumentedScopeFactory) {
    post("/api/scenarios/race") {
        val scope = factory.from(call)
        val deferred = scope.async { simulateRaceCondition() }
        call.respond(mapOf("runId" to deferred.coroutineId))
    }
}
```

User code only swaps `CoroutineScope.launch` with `InstrumentedScope.launch`, keeping business logic untouched.

## 6. Monitoring, debugging & tracing integration

| Tool | How it works | Integration approach | Trade-offs |
| --- | --- | --- | --- |
| **DebugProbes** (`kotlinx-coroutines-debug`) | Bytecode-level hooks capture creation/suspension/resumption snapshots. | Provide opt-in feature that installs probes and converts `CoroutineInfo` snapshots into `VisualizerEvent`s when explicit wrappers are not available (e.g., third-party code). | Sampling only (no continuous stream), coarse granularity, JVM-only. |
| **OpenTelemetry** | Context propagation via `ContextElement`; spans timings. | Add `CoroutineContext` element that starts/stops spans in parallel with events, translate events into OTLP logs/spans for external tracing backends. | Requires OTEL collector, may add overhead; great for aligning visualization with production traces. |
| **BlockHound/Reactor hooks** | Detect blocking calls. | Use instrumentation context to tag events whenever BlockHound reports blocking to show “starvation/backpressure” overlays. | Niche but useful for teaching anti-patterns. |

Mode toggles:
- **Teaching mode**: emit full event payloads, enable deterministic scheduling (optional virtual time).
- **Diagnostics mode**: thin wrappers + DebugProbes/OTEL bridging for low overhead.

## 7. Concurrency scenarios & emitted events

### 7.1 Race condition
```kotlin
suspend fun race(scope: InstrumentedScope): Int {
    var counter = 0
    scope.coroutineScope {
        repeat(2) {
            launch(Dispatchers.Default) {
                val snapshot = counter
                delay(10)
                counter = snapshot + 1
            }
        }
    }
    return counter
}
```
**Events**: two `CoroutineCreated`, interleaved `CoroutineSuspended` (`delay`), resumed on same dispatcher, final `ValueEmitted` from shared-state tracker showing lost increment. Visualization: two lanes writing to same shared node with red warning when writes overlap.

### 7.2 Starvation/blocking
```kotlin
scope.launch(Dispatchers.Default) {
    withContext(Dispatchers.Default) {
        Thread.sleep(1000) // intentional blocking
    }
}
```
**Events**: `ThreadAssigned` stays on one worker, queue depth grows, `BlockingDetected` (hooked from BlockHound). Visualization: highlight dispatcher lane turning red, other coroutines waiting.

### 7.3 Cancellation & exception propagation
```kotlin
suspend fun cancellation(scope: InstrumentedScope) = scope.coroutineScope {
    val parent = launch {
        val child = launch {
            try { delay(Long.MAX_VALUE) } finally { println("child cancelled") }
        }
        delay(50)
        child.cancel(CancellationException("timeout"))
        throw IllegalStateException("boom")
    }
    parent.invokeOnCompletion { cause -> println("parent done: $cause") }
}
```
**Events**: `CoroutineCancelled` for child with cause=timeout, `ExceptionThrown` for parent, `ExceptionPropagated` up the hierarchy, `ScopeBoundaryClosed`. Visualization: tree view showing cascading cancellation; timeline shows parent exception hitting child.

DebugProbes view: show `dumpCoroutinesInfo` before/after cancellation to cross-check.

## 8. Frontend integration hints (React + TypeScript)

- **Transport**: WebSocket for live events (`VisualizerEvent` JSON), REST for snapshots/metadata.
- **Contract**:
  - `GET /api/events?since=<step>` returns batches with `nextStep`.
  - `GET /api/coroutines/{id}` returns structure, tags, context, children.
  - `GET /api/threads` returns thread timelines.
  - `GET /api/flows/{id}/timeline` returns emission events.
- **Normalization**: group events by `coroutineId`, `dispatcherId`, `threadId`. Provide derived maps:
  - `hierarchy: Record<ScopeId, ScopeNode>`
  - `timelines: Record<EntityId, VisualTimeline>`
  - `channels: Record<ChannelId, ChannelState>`
- **Animation-friendly**: include `stepIndex`, durations, and `linkId` to connect pairs (send→receive, suspend→resume).

## 9. Business analysis & rollout plan

### Value proposition
- **Educators**: turn invisible coroutine mechanics into tangible diagrams, accelerating onboarding.
- **Product teams**: reusable instrumentation for demos, documentation, and incident post-mortems.
- **Community**: open framework encourages contributions of teaching scenarios.

### Stakeholders & dependencies
- Kotlin educator / advocate (product owner).
- Backend engineer (this design).
- Frontend/visualization engineer.
- DevRel / content team for scenarios.
- Depend on `kotlinx-coroutines-core` (no fork), optional `kotlinx-coroutines-debug`, OpenTelemetry SDK.

### Risks & mitigations
- **Performance overhead**: mitigate via opt-in instrumentation scopes and sampling.
- **API drift** in kotlinx.coroutines: rely on stable public builders; for internals (Job states) confine to reflection-free observation using existing hooks.
- **Data volume**: implement reservoir sampling, server-side filtering, compression.
- **JVM-only** initially; treat native/JS as stretch goal (requires expect/actual wrappers).

### Phased delivery
1. **Foundations (2–3 weeks)**: Event model, in-memory sink, instrumented scope/launch/async, REST endpoints, simple frontend stub.
2. **Concurrency primitives (3 weeks)**: dispatcher wrapper, Flow/Channel instrumentation, timeline projections.
3. **Teaching scenarios (2 weeks)**: curate race/starvation/cancellation demos with stepper UI.
4. **Observability mode (2 weeks)**: DebugProbes bridge, OTEL exporter, filtering & persistence.

KPIs: time-to-understand structured concurrency (developer surveys), number of recorded scenarios, backend throughput.

## 10. Architectural options

| Option | Description | Pros | Cons | Recommendation |
| --- | --- | --- | --- | --- |
| **A. Decorator-first (proposed)** | Wrap builders/dispatchers/flows via Kotlin APIs, emit events in-process, optional integration with probes/tracing. | Precise, works across JVM targets, matches real semantics, deterministic for teaching. | Requires developers to adopt wrappers; partial coverage when third-party code uses raw APIs. | **Recommended for v1**: maximal control and fidelity for visualizations. |
| **B. DebugProbes-centric** | Install probes globally, translate snapshots to events without wrapping user code. | Zero code changes for users, easy to retrofit. | JVM-only, lower fidelity (no channel/flow detail), weak guarantees on ordering. | Useful as fallback/“diagnostics mode”, but insufficient alone for teaching-centric animations. |

The recommended path is Option A with Option B as an optional bridge. This keeps user code nearly identical (wrappers mirror signatures) while delivering the detailed, structured data the React visualizer needs.

## 11. Implementation Deep Dive (wrapping kotlinx-coroutines-core)

### 11.1 Hooking lifecycle transitions driven by `JobSupport`
`JobSupport` exposes `invokeOnCompletion`/`invokeOnCompletionInternal`, which admit handlers at every state transition (`Empty`, `Single`, `NodeList`, `Finishing`). We piggy-back on those hooks to emit lifecycle events without touching internal state fields.

```445:519:kotlinx-coroutines-core/common/src/JobSupport.kt
public final override fun invokeOnCompletion(handler: CompletionHandler): DisposableHandle =
    invokeOnCompletionInternal(
        invokeImmediately = true,
        node = InvokeOnCompletion(handler),
    )

internal fun invokeOnCompletionInternal(
    invokeImmediately: Boolean,
    node: JobNode
): DisposableHandle {
    node.job = this
    val added = tryPutNodeIntoList(node) { state, list ->
        ...
        list.addLast(node, LIST_ON_COMPLETION_PERMISSION)
    }
    when {
        added -> return node
        invokeImmediately -> node.invoke((state as? CompletedExceptionally)?.cause)
    }
    return NonDisposableHandle
}
```

**Implementation steps**
- Provide `LifecycleProbeNode : JobNode()` that overrides `invoke` to publish `CoroutineStateChanged` with the `from/to` state resolved via `JobSupport.state`.
- Attach probe when instrumentation scope creates a coroutine (`job.invokeOnCompletion(lifecycleProbe)`).
- For cancellation-specific telemetry, register another handler using `invokeOnCompletion(onCancelling = true, …)` which fires as soon as `notifyCancelling` starts to run.

### 11.2 Instrumentation context element
Create `InstrumentationContext : AbstractCoroutineContextElement(Key)` storing `coroutineId`, `scopeId`, `tags`, `debugMetadata`. Every wrapper (`launch`, `async`, `flow`, `channel`) enriches the provided `CoroutineContext`:
```kotlin
val metadataContext = existingContext + InstrumentationContext(id, scopeId, tags)
delegate.launch(metadataContext) { ... }
```
The context element allows downstream interceptors (dispatchers, collectors) to fetch IDs via `context[InstrumentationContext]` without additional parameters.

### 11.3 Decorating builders without changing semantics
`launch`/`async` composition (`newCoroutineContext`, instantiating `StandaloneCoroutine`/`DeferredCoroutine`, then `start`) means we can mirror the public API and wrap only around the block:

```44:89:kotlinx-coroutines-core/common/src/Builders.common.kt
public fun CoroutineScope.launch(...): Job {
    val newContext = newCoroutineContext(context)
    val coroutine = if (start.isLazy)
        LazyStandaloneCoroutine(newContext, block) else
        StandaloneCoroutine(newContext, active = true)
    coroutine.start(start, coroutine, block)
    return coroutine
}
```

**Decorator plan**
1. `InstrumentedScope.launch`/`async` call the real builder but provide `InstrumentationContext`.
2. Immediately emit `CoroutineCreated` with:
   - `coroutineId` (from `IdRegistry`).
   - `parentId` (`coroutineContext[Job]?.let(idRegistry::lookup)`).
   - `dispatcherId` (resolve from `newContext[ContinuationInterceptor]`).
3. Use `job.invokeOnCompletion` hooks (11.1) for `CoroutineCompleted` / `CoroutineCancelled`.
4. Wrap the supplied `block` with `try/finally` to emit `ExceptionThrown` before rethrow.

### 11.4 Tracking dispatcher → thread hops
Dispatchers surface as `CoroutineDispatcher`s with overridable `dispatch`. Wrapping them once and passing through to e.g. `Dispatchers.Default` is enough:

```14:65:kotlinx-coroutines-core/jvm/src/Dispatchers.kt
public actual object Dispatchers {
    public actual val Default: CoroutineDispatcher = DefaultScheduler
    public val IO: CoroutineDispatcher get() = DefaultIoScheduler
}
```

Implementation summary:
- `InstrumentedDispatcher(delegate, dispatcherId, sink)` (see §5.2) publishes `DispatcherSelected` before delegating and `ThreadAssigned` once the runnable executes.
- Provide helpers: `visualizerDispatchers.default`, `visualizerDispatchers.io`, etc., so teaching scenarios can opt in easily while production code can operate on unmodified dispatchers.

### 11.5 Flow instrumentation depth
Because `Flow.collect` must preserve context via `SafeCollector`, we wrap the `FlowCollector` rather than the flow builder:

```176:229:kotlinx-coroutines-core/common/src/flow/Flow.kt
public final override suspend fun collect(collector: FlowCollector<T>) {
    val safeCollector = SafeCollector(collector, coroutineContext)
    try {
        collectSafely(safeCollector)
    } finally {
        safeCollector.releaseIntercepted()
    }
}
```

Steps:
1. `InstrumentedFlow` keeps `flowId`.
2. Custom `FlowCollector` wrapper emits `FlowCollected` once and `ValueEmitted` for every `emit`.
3. Because `SafeCollector` enforces dispatcher affinity, we piggy-back on `collectorContext = coroutineContext[ContinuationInterceptor]` to link emissions to dispatcher timelines.
4. On completion or exception, signal `FlowCompleted`/`ExceptionThrown`.

### 11.6 Channel instrumentation touchpoints
`BufferedChannel.send/trySend` and related helpers (`sendImpl`, `sendOnNoWaiterSuspend`) already treat rendezvous vs buffered paths differently.

```33:208:kotlinx-coroutines-core/common/src/channels/BufferedChannel.kt
internal open class BufferedChannel<E>(...): Channel<E> {
    ...
    override suspend fun send(element: E): Unit =
        sendImpl(
            element = element,
            waiter = null,
            onRendezvousOrBuffered = {},
            onSuspend = { _, _ -> assert { false } },
            onClosed = { onClosedSend(element) },
            onNoWaiterSuspend = { segm, i, elem, s -> sendOnNoWaiterSuspend(segm, i, elem, s) }
        )
    ...
}
```

Instead of modifying this class, create `InstrumentedChannel<E>` delegating to any `Channel<E>`:
- Override `send`/`receive`/`trySend`/`tryReceive`.
- Before delegating, emit `ChannelSendRequested`/`ChannelReceiveRequested`.
- Observe suspension/resume by installing `invokeOnCancellation` on the `CancellableContinuation` that `send`/`receive` use internally (wrap via `suspendCancellableCoroutine`).
- For buffered-depth, poll `Channel<E>.isClosedForSend`/`isClosedForReceive` and `Channel<E>.trySend` results to feed buffer metrics.

### 11.7 Capturing suspension points
`startCoroutineCancellable`/`suspendCoroutineUninterceptedOrReturn` (see `Builders.common.kt` `withContext`) already differentiate fast/slow paths.
Hook points:
- Wrap `suspend` blocks with `suspendCoroutineUninterceptedOrReturn` to intercept before/after `DispatchedCoroutine.getResult()` (lines 140–173).
- Use `ContinuationInterceptor` to install a `Continuation` wrapper that emits `CoroutineSuspended` before invoking delegate’s `resumeWith`.

### 11.8 DebugProbes & OpenTelemetry bridge
Leverage `DebugProbes.dumpCoroutinesInfo()` for “sampling snapshots” mode:
```11:101:kotlinx-coroutines-debug/src/DebugProbes.kt
public object DebugProbes {
    public fun install() { DebugProbesImpl.install() }
    public fun dumpCoroutinesInfo(): List<CoroutineInfo> =
        DebugProbesImpl.dumpCoroutinesInfo().map { CoroutineInfo(it) }
}
```

Bridge mechanics:
1. When probes are enabled, periodically call `dumpCoroutinesInfo`.
2. Convert each `CoroutineInfo` into `CoroutineStateSnapshot` events, tagging them with `source = "debug-probe"`.
3. For OpenTelemetry, create a `CoroutineContext.Element` that starts a span on `CoroutineCreated` and ends on `CoroutineCompleted`, linking spans via `parentSpanId`.

### 11.9 Step-by-step rollout for the first implementation spike
1. **Foundational module**
   - Define `InstrumentationContext`, `EventSink`, `VisualizerEvent`.
   - Provide `IdRegistry` + stable ULID generator.
2. **Coroutine builders**
   - Implement `InstrumentedScope` and `InstrumentedDispatcher`.
   - Add lifecycle probes using `invokeOnCompletion`.
   - Ship sample Ktor endpoint proving `CoroutineCreated → CoroutineCompleted`.
3. **Suspension tracking**
   - Implement `Continuation` wrapper injecting events around `resumeWith`.
   - Extend dispatcher wrapper to log thread hops.
4. **Flow & channel coverage**
   - Provide `instrumentedFlow(flow)` factory.
   - Implement `InstrumentedChannel` decorator alongside helper extension `Channel<E>.instrumented(id)`.
5. **Streaming & persistence**
   - Build in-memory `TimelineStore` with cursor-based pagination (`sinceStep`).
   - Expose `/ws/events` streaming filtered by `scopeId`.
6. **Diagnostics bridge**
   - Add toggles for DebugProbes + OTEL.
   - Document how to run backend in “teaching” vs “diagnostics” mode.

These steps keep the implementation grounded in real `kotlinx-coroutines-core` mechanics while remaining additive (decorators only) so the upstream library stays untouched.

## 12. Reference implementation you can drop into chat

Below is a trimmed, production-ready baseline that you can paste into chat to answer “how do we track coroutine status for visualization?”  It wires together a tracker, scope helpers, and a websocket bridge.  It compiles as-is on JVM with `kotlinx-coroutines-core` + `ktor-server-websockets`.

```kotlin
// shared/events/CoroutineEvents.kt
sealed interface CoroutineEvent {
    val eventId: String
    val timestamp: Instant
    val coroutineId: String
}

data class JobCreated(
    override val eventId: String,
    override val timestamp: Instant = Instant.now(),
    override val coroutineId: String,
    val parentId: String?,
    val dispatcher: String,
    val name: String?
) : CoroutineEvent

data class JobStateChanged(
    override val eventId: String,
    override val timestamp: Instant = Instant.now(),
    override val coroutineId: String,
    val state: JobState,
    val outcome: Outcome? = null,
    val error: String? = null
) : CoroutineEvent

enum class JobState { Active, Completing, Completed, Cancelled, Failed }
sealed interface Outcome { data class Value(val preview: String) : Outcome; object None : Outcome }
```

```kotlin
// shared/tracking/CoroutineTracker.kt
interface CoroutineTracker {
    fun jobCreated(event: JobCreated)
    fun jobStateChanged(event: JobStateChanged)
    fun snapshot(): List<TrackedJob>
}

data class TrackedJob(
    val id: String,
    val parentId: String?,
    val name: String?,
    val dispatcher: String,
    val state: JobState,
    val startedAt: Instant,
    val finishedAt: Instant?,
    val error: String?
)

class InMemoryCoroutineTracker : CoroutineTracker {
    private val jobs = ConcurrentHashMap<String, TrackedJob>()
    private val listeners = CopyOnWriteArrayList<(CoroutineEvent) -> Unit>()

    fun listen(block: (CoroutineEvent) -> Unit) {
        listeners += block
    }

    override fun jobCreated(event: JobCreated) {
        jobs[event.coroutineId] = TrackedJob(
            id = event.coroutineId,
            parentId = event.parentId,
            name = event.name,
            dispatcher = event.dispatcher,
            state = JobState.Active,
            startedAt = event.timestamp,
            finishedAt = null,
            error = null
        )
        broadcast(event)
    }

    override fun jobStateChanged(event: JobStateChanged) {
        jobs.computeIfPresent(event.coroutineId) { _, job ->
            job.copy(
                state = event.state,
                finishedAt = when (event.state) {
                    JobState.Completed, JobState.Cancelled, JobState.Failed -> event.timestamp
                    else -> job.finishedAt
                },
                error = event.error ?: job.error
            )
        }
        broadcast(event)
    }

    override fun snapshot(): List<TrackedJob> = jobs.values.toList()

    private fun broadcast(event: CoroutineEvent) = listeners.forEach { it(event) }
}
```

```kotlin
// shared/tracking/TrackingContext.kt
class TrackingContext(
    val coroutineId: String,
    val name: String?,
    val parentId: String?
) : AbstractCoroutineContextElement(Key) {
    companion object Key : CoroutineContext.Key<TrackingContext>
}
```

```kotlin
// shared/tracking/TrackedScope.kt
class TrackedScope(
    private val delegate: CoroutineScope,
    private val tracker: CoroutineTracker,
    private val idSource: () -> String = { ULID.random() }
) : CoroutineScope by delegate {

    fun launchTracked(
        context: CoroutineContext = EmptyCoroutineContext,
        start: CoroutineStart = CoroutineStart.DEFAULT,
        name: String? = null,
        block: suspend CoroutineScope.() -> Unit
    ): Job = instrument(builder = { launch(it, start, block = itBlock(name, block)) }, context, name)

    fun <T> asyncTracked(
        context: CoroutineContext = EmptyCoroutineContext,
        start: CoroutineStart = CoroutineStart.DEFAULT,
        name: String? = null,
        block: suspend CoroutineScope.() -> T
    ): Deferred<T> = instrument(builder = { async(it, start, block = itBlock(name, block)) }, context, name)

    private fun <T : Job> instrument(
        builder: CoroutineScope.(CoroutineContext) -> T,
        context: CoroutineContext,
        name: String?
    ): T {
        val parentCtx = coroutineContext[TrackingContext]
        val coroutineId = idSource()
        val combined = context + TrackingContext(
            coroutineId = coroutineId,
            name = name,
            parentId = parentCtx?.coroutineId
        )
        tracker.jobCreated(
            JobCreated(
                eventId = ULID.random(),
                coroutineId = coroutineId,
                parentId = parentCtx?.coroutineId,
                dispatcher = (combined[ContinuationInterceptor] as? CoroutineDispatcher)?.javaClass?.simpleName ?: "Default",
                name = name
            )
        )
        return builder(combined).also { job ->
            job.invokeOnCompletion { cause ->
                val (state, outcome, error) = when {
                    cause == null -> JobState.Completed to Outcome.None to null
                    cause is CancellationException -> JobState.Cancelled to Outcome.None to cause.message
                    else -> JobState.Failed to Outcome.None to (cause?.stackTraceToString())
                }.let { Triple(it.first, it.second, it.third) }
                tracker.jobStateChanged(
                    JobStateChanged(
                        eventId = ULID.random(),
                        coroutineId = coroutineId,
                        state = state,
                        outcome = outcome,
                        error = error
                    )
                )
            }
        }
    }

    private fun <T> itBlock(
        name: String?,
        block: suspend CoroutineScope.() -> T
    ): suspend CoroutineScope.() -> T = {
        val ctx = coroutineContext[TrackingContext]
        try {
            block()
        } catch (t: Throwable) {
            tracker.jobStateChanged(
                JobStateChanged(
                    eventId = ULID.random(),
                    coroutineId = ctx?.coroutineId ?: "unknown",
                    state = if (t is CancellationException) JobState.Cancelled else JobState.Failed,
                    error = t.message
                )
            )
            throw t
        }
    }
}
```

```kotlin
// shared/tracking/TrackedDispatcher.kt
class TrackedDispatcher(
    private val delegate: CoroutineDispatcher,
    private val dispatcherId: String,
    private val tracker: CoroutineTracker
) : CoroutineDispatcher() {

    override fun dispatch(context: CoroutineContext, block: Runnable) {
        val ctx = context[TrackingContext] ?: return delegate.dispatch(context, block)
        tracker.jobStateChanged(
            JobStateChanged(
                eventId = ULID.random(),
                coroutineId = ctx.coroutineId,
                state = JobState.Active,
                outcome = Outcome.None,
                error = null
            )
        )
        delegate.dispatch(context) {
            tracker.jobStateChanged(
                JobStateChanged(
                    eventId = ULID.random(),
                    coroutineId = ctx.coroutineId,
                    state = JobState.Active,
                    outcome = Outcome.None,
                    error = null
                )
            )
            block.run()
        }
    }

    override fun isDispatchNeeded(context: CoroutineContext): Boolean =
        delegate.isDispatchNeeded(context)
}
```

```kotlin
// ktor/VisualizerModule.kt
fun Application.visualizerModule(tracker: InMemoryCoroutineTracker) {
    install(WebSockets)
    routing {
        webSocket("/ws/coroutines") {
            val sessionChannel = Channel<CoroutineEvent>(Channel.UNLIMITED)
            val listener: (CoroutineEvent) -> Unit = { event ->
                sessionChannel.trySend(event)
            }
            tracker.listen(listener)
            try {
                tracker.snapshot().forEach { job ->
                    outgoing.send(Frame.Text(Json.encodeToString(job)))
                }
                for (event in sessionChannel) {
                    outgoing.send(Frame.Text(Json.encodeToString(event)))
                }
            } finally {
                tracker.listen { } // remove listener in real code
                sessionChannel.close()
            }
        }
    }
}
```

```kotlin
// Using the tracked scope inside a Ktor handler
class DemoController(
    private val tracker: InMemoryCoroutineTracker,
    private val applicationScope: CoroutineScope
) {
    suspend fun runScenario(): HttpStatusCode {
        val trackedScope = TrackedScope(applicationScope, tracker)
        val parent = trackedScope.launchTracked(name = "parent") {
            val childA = launchTracked(name = "child-A") { delay(200); println("done A") }
            val childB = launchTracked(name = "child-B") { delay(100); error("boom") }
            joinAll(childA, childB)
        }
        parent.join()
        return HttpStatusCode.OK
    }
}
```

### How to explain it in chat
> Use `TrackedScope.launchTracked/asyncTracked` everywhere you currently call `launch`/`async`.  Each wrapper injects a `TrackingContext` into the coroutine, emits `JobCreated`, and hooks `invokeOnCompletion` to push `JobStateChanged` events (completed / cancelled / failed).  A central `CoroutineTracker` keeps the latest snapshot and feeds WebSocket clients so the UI can show bars for “waiting on children”, “running”, or “failed”.  For dispatchers, wrap `CoroutineDispatcher` with `TrackedDispatcher` to log scheduling hops without touching user code.  This gives you deterministic status updates for every parent/child job your visualizer needs.

Drop the snippet + explanation into chat to answer the original question with both design and runnable code.

---
Prepared by: GPT-5.1 Codex (senior Kotlin backend + educator role)  
Scope: Backend architecture + business analysis for a coroutine visualizer powered by Ktor.

