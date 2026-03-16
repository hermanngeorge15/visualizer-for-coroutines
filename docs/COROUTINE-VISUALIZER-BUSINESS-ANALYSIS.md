# Kotlin Coroutines Visualizer - Deep Dive Business Analysis

**Version:** 1.0  
**Date:** November 24, 2025  
**Objective:** Design and implement a Ktor-based backend that visualizes Kotlin coroutines using non-invasive wrapper/decorator patterns

---

## Executive Summary

This document provides a comprehensive business and technical analysis for building a Kotlin Coroutines Visualizer—a teaching and diagnostic tool that makes the invisible mechanics of coroutines visible through interactive diagrams and animations. The solution wraps the `kotlinx-coroutines-core` library **without modification**, using decorator patterns to emit rich visualization events consumed by a React + TypeScript frontend.

**Key Differentiators:**
- **Non-invasive**: Uses the official library as-is; no forking or patching
- **High-fidelity**: Captures actual coroutine behavior, not simulations
- **Dual-mode**: Teaching mode (verbose, deterministic) + Diagnostics mode (lightweight, production-ready)
- **Extensible**: Plugin architecture for custom visualizations and scenarios

---

## 1. Business Context & Problem Statement

### 1.1 The Challenge

Kotlin coroutines are powerful but conceptually complex:
- **Invisible execution**: Suspension, resumption, and dispatcher switching happen behind the scenes
- **Non-linear control flow**: Traditional debugging tools show single-threaded call stacks
- **Structured concurrency**: Parent-child relationships and cancellation propagation are implicit
- **Concurrency bugs**: Race conditions, deadlocks, and starvation are hard to reproduce and visualize

**Current solutions:**
- **DebugProbes**: JVM-only, sampling-based, coarse-grained
- **IDE debuggers**: Show state snapshots but not flow/relationships
- **Logging**: Requires manual instrumentation, hard to correlate

### 1.2 Target Audience

1. **Kotlin Educators**: Creating courses, tutorials, documentation
2. **Developer Teams**: Onboarding new team members to coroutine-based codebases
3. **Technical Writers**: Building interactive documentation
4. **Open Source Community**: Contributing teaching scenarios and visualizations

### 1.3 Value Proposition

| Stakeholder | Pain Point | Solution Benefit |
|-------------|------------|------------------|
| **Educators** | Abstract concepts are hard to explain with static diagrams | Live, interactive visualizations with step-through replay |
| **Developers** | Debugging async issues is time-consuming | Visual timeline showing exact suspension/resumption points |
| **Product Teams** | Documentation requires constant updates | Framework generates docs from real code examples |
| **Community** | Limited coroutine teaching resources | Extensible platform for sharing scenarios |

**Success Metrics:**
- Time to understand structured concurrency (baseline: 4 hours → target: 1.5 hours)
- Number of community-contributed teaching scenarios (target: 50+ in year 1)
- Adoption by 3+ Kotlin training providers
- 10K+ developers using the tool monthly

---

## 2. Technical Architecture Overview

### 2.1 High-Level Design

```
┌──────────────────────────────────────────────────────────────┐
│                   React + TypeScript Frontend                 │
│  ┌───────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  Hierarchy    │  │   Timeline   │  │   Thread Lanes   │  │
│  │  Tree View    │  │   Animation  │  │   Visualization  │  │
│  └───────────────┘  └──────────────┘  └──────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                            ↕ WebSocket/REST
┌──────────────────────────────────────────────────────────────┐
│              Ktor Backend (Kotlin/JVM)                        │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  HTTP API Layer                                        │  │
│  │  /api/coroutines, /api/timeline, /ws/events           │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Event Processing Pipeline                             │  │
│  │  EventBus → TimelineStore → ProjectionService         │  │
│  └────────────────────────────────────────────────────────┘  │
│  ┌────────────────────────────────────────────────────────┐  │
│  │  Instrumentation Layer (Wrappers/Decorators)           │  │
│  │  InstrumentedScope, InstrumentedDispatcher,            │  │
│  │  InstrumentedFlow, InstrumentedChannel                 │  │
│  └────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────┘
                            ↕
┌──────────────────────────────────────────────────────────────┐
│          kotlinx-coroutines-core (UNCHANGED)                  │
│  launch, async, Flow, Channel, Dispatcher, Job               │
└──────────────────────────────────────────────────────────────┘
```

### 2.2 Core Principles

1. **Non-Intrusive Wrapping**: All instrumentation happens at API boundaries
2. **Context Propagation**: Use `CoroutineContext.Element` to carry metadata
3. **Hook-Based Observation**: Leverage `invokeOnCompletion`, `ContinuationInterceptor`
4. **Event Sourcing**: Immutable event stream enables time-travel debugging
5. **Separation of Concerns**: Instrumentation, storage, and visualization are decoupled

---

## 3. Deep Dive: kotlinx-coroutines-core Internals

### 3.1 Core Abstractions We're Wrapping

#### 3.1.1 Job State Machine (`JobSupport`)

The foundation of coroutine lifecycle tracking:

```
[New] ───start()──→ [Active] ───complete()──→ [Completing] ──→ [Completed]
   │                    │                          │
   └────cancel()────────┴──────cancel()───→ [Cancelling] ──→ [Cancelled]
```

**Key Methods for Instrumentation:**
- `invokeOnCompletion(handler: CompletionHandler)`: Hook for lifecycle events
- `attachChild(child: ChildJob)`: Track parent-child relationships
- `parent: Job?`: Navigate hierarchy

**Wrapper Strategy:**
```kotlin
class LifecycleProbe(private val eventSink: EventSink, private val coroutineId: String) : JobNode() {
    override fun invoke(cause: Throwable?) {
        eventSink.publish(
            CoroutineCompletedEvent(
                coroutineId = coroutineId,
                outcome = if (cause != null) Outcome.Cancelled(cause.message) else Outcome.Success,
                timestamp = Clock.System.now()
            )
        )
    }
}
```

#### 3.1.2 Coroutine Builders (`launch`, `async`)

From `kotlinx-coroutines-core/common/src/Builders.common.kt`:

```kotlin
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

**Wrapper Strategy:**
- Intercept at the public API level
- Inject `InstrumentationContext` into the coroutine context
- Wrap the user's block to emit lifecycle events
- Return a proxy Job that forwards to the real Job

#### 3.1.3 Dispatchers (`CoroutineDispatcher`)

```kotlin
public abstract class CoroutineDispatcher : ContinuationInterceptor {
    public abstract fun dispatch(context: CoroutineContext, block: Runnable)
    public open fun isDispatchNeeded(context: CoroutineContext): Boolean = true
}
```

**Wrapper Strategy:**
- Create `InstrumentedDispatcher` that delegates to real dispatchers
- Emit `DispatcherSelected` before `dispatch()`
- Wrap the `Runnable` to capture thread assignment
- Preserve `isDispatchNeeded` semantics for performance

#### 3.1.4 Flow Collectors

From `kotlinx-coroutines-core/common/src/flow/Flow.kt`:

```kotlin
public interface Flow<out T> {
    public suspend fun collect(collector: FlowCollector<T>)
}

public interface FlowCollector<in T> {
    public suspend fun emit(value: T)
}
```

**Wrapper Strategy:**
- Wrap `FlowCollector` to intercept emissions
- Track collection start/completion
- Emit events for each value, preserving order
- Handle backpressure/cancellation transparently

#### 3.1.5 Channels

From `kotlinx-coroutines-core/common/src/channels/Channel.kt`:

```kotlin
public interface Channel<E> : SendChannel<E>, ReceiveChannel<E> {
    public suspend fun send(element: E)
    public suspend fun receive(): E
}
```

**Wrapper Strategy:**
- Delegate pattern wrapping `SendChannel` and `ReceiveChannel`
- Track buffer depth using `trySend().isSuccess` results
- Emit send/receive pairs with correlation IDs
- Handle rendezvous vs buffered semantics

### 3.2 Suspension & Resumption Mechanism

**Key Insight:** Kotlin uses `Continuation` for suspension:

```kotlin
public interface Continuation<in T> {
    public val context: CoroutineContext
    public fun resumeWith(result: Result<T>)
}
```

**Instrumentation Touchpoint:**  
`ContinuationInterceptor` lets us wrap continuations:

```kotlin
class InstrumentedInterceptor(
    private val delegate: ContinuationInterceptor,
    private val sink: EventSink
) : ContinuationInterceptor {
    override fun <T> interceptContinuation(continuation: Continuation<T>): Continuation<T> {
        return object : Continuation<T> {
            override val context = continuation.context
            override fun resumeWith(result: Result<T>) {
                sink.publish(CoroutineResumedEvent(
                    coroutineId = context[InstrumentationContext]?.id,
                    threadId = Thread.currentThread().name,
                    timestamp = Clock.System.now()
                ))
                continuation.resumeWith(result)
            }
        }
    }
}
```

### 3.3 Exception Propagation

From `kotlinx-coroutines-core/common/src/CoroutineExceptionHandler.kt`:

- **Default behavior**: Child failures cancel parent (structured concurrency)
- **SupervisorJob**: Isolates child failures
- **CoroutineExceptionHandler**: Last-resort handler for uncaught exceptions

**Visualization Strategy:**
- Track exception origin (coroutine ID)
- Show propagation path (child → parent chain)
- Differentiate `CancellationException` from failures
- Highlight supervisor boundaries

---

## 4. Wrapper/Decorator Implementation Strategy

### 4.1 Instrumentation Context Element

```kotlin
@Serializable
data class InstrumentationContext(
    val coroutineId: String,
    val scopeId: String,
    val name: String?,
    val tags: Map<String, String> = emptyMap(),
    val parentId: String? = null
) : AbstractCoroutineContextElement(InstrumentationContext) {
    companion object Key : CoroutineContext.Key<InstrumentationContext>
}
```

**Why:** Flows through coroutine context automatically, accessible from any suspension point.

### 4.2 InstrumentedScope

```kotlin
class InstrumentedScope(
    private val delegate: CoroutineScope,
    private val eventSink: EventSink,
    private val idRegistry: IdRegistry
) : CoroutineScope by delegate {

    fun launch(
        context: CoroutineContext = EmptyCoroutineContext,
        start: CoroutineStart = CoroutineStart.DEFAULT,
        name: String? = null,
        block: suspend CoroutineScope.() -> Unit
    ): Job {
        val coroutineId = idRegistry.nextId()
        val parentId = coroutineContext[Job]?.let { idRegistry.lookup(it) }
        val scopeId = idRegistry.scopeId(this)
        
        val instrumentation = InstrumentationContext(
            coroutineId = coroutineId,
            scopeId = scopeId,
            name = name,
            parentId = parentId
        )
        
        eventSink.publish(CoroutineCreatedEvent(
            coroutineId = coroutineId,
            parentId = parentId,
            dispatcherId = resolveDispatcherId(context),
            name = name,
            timestamp = Clock.System.now()
        ))
        
        val job = delegate.launch(context + instrumentation, start) {
            try {
                eventSink.publish(CoroutineStartedEvent(coroutineId))
                block()
                eventSink.publish(CoroutineCompletedEvent(coroutineId, Outcome.Success))
            } catch (e: CancellationException) {
                eventSink.publish(CoroutineCancelledEvent(coroutineId, e.message, true))
                throw e
            } catch (e: Throwable) {
                eventSink.publish(ExceptionThrownEvent(coroutineId, e::class.simpleName, e.message))
                throw e
            }
        }
        
        // Track lifecycle transitions
        job.invokeOnCompletion { cause ->
            if (cause != null && cause !is CancellationException) {
                eventSink.publish(CoroutineFailedEvent(coroutineId, cause.message))
            }
        }
        
        idRegistry.register(job, coroutineId)
        return job
    }
    
    // Similar for async, withContext, etc.
}
```

### 4.3 InstrumentedDispatcher

```kotlin
class InstrumentedDispatcher(
    private val delegate: CoroutineDispatcher,
    private val dispatcherId: String,
    private val sink: EventSink
) : CoroutineDispatcher() {
    
    override fun dispatch(context: CoroutineContext, block: Runnable) {
        val coroutineId = context[InstrumentationContext]?.coroutineId
        
        sink.publish(DispatcherSelectedEvent(
            coroutineId = coroutineId,
            dispatcherId = dispatcherId,
            queueDepth = estimateQueueDepth(),
            timestamp = Clock.System.now()
        ))
        
        delegate.dispatch(context) {
            val threadId = Thread.currentThread().name
            sink.publish(ThreadAssignedEvent(
                coroutineId = coroutineId,
                threadId = threadId,
                dispatcherId = dispatcherId,
                timestamp = Clock.System.now()
            ))
            block.run()
        }
    }
    
    override fun isDispatchNeeded(context: CoroutineContext): Boolean =
        delegate.isDispatchNeeded(context)
    
    // Estimate queue depth (dispatcher-specific)
    private fun estimateQueueDepth(): Int {
        return when (delegate) {
            is DefaultScheduler -> delegate.toString().extractQueueDepth()
            else -> 0
        }
    }
}
```

### 4.4 InstrumentedFlow

```kotlin
class InstrumentedFlow<T>(
    private val delegate: Flow<T>,
    private val flowId: String,
    private val sink: EventSink
) : Flow<T> {
    
    override suspend fun collect(collector: FlowCollector<T>) {
        val collectorId = UUID.randomUUID().toString()
        val coroutineId = currentCoroutineContext()[InstrumentationContext]?.coroutineId
        
        sink.publish(FlowCollectionStartedEvent(
            flowId = flowId,
            collectorId = collectorId,
            coroutineId = coroutineId,
            timestamp = Clock.System.now()
        ))
        
        var sequence = 0L
        try {
            delegate.collect { value ->
                sink.publish(FlowValueEmittedEvent(
                    flowId = flowId,
                    collectorId = collectorId,
                    sequence = sequence++,
                    valuePreview = value.toPreviewString(),
                    timestamp = Clock.System.now()
                ))
                collector.emit(value)
            }
            sink.publish(FlowCollectionCompletedEvent(flowId, collectorId))
        } catch (e: Throwable) {
            sink.publish(FlowCollectionFailedEvent(flowId, collectorId, e.message))
            throw e
        }
    }
}

// Extension function for easy wrapping
fun <T> Flow<T>.instrumented(id: String, sink: EventSink): Flow<T> =
    InstrumentedFlow(this, id, sink)
```

### 4.5 InstrumentedChannel

```kotlin
class InstrumentedChannel<E>(
    private val delegate: Channel<E>,
    private val channelId: String,
    private val sink: EventSink
) : Channel<E> by delegate {
    
    override suspend fun send(element: E) {
        val coroutineId = currentCoroutineContext()[InstrumentationContext]?.coroutineId
        
        sink.publish(ChannelSendRequestedEvent(
            channelId = channelId,
            senderId = coroutineId,
            valuePreview = element.toPreviewString(),
            bufferSize = estimateBufferSize(),
            timestamp = Clock.System.now()
        ))
        
        val startTime = Clock.System.now()
        delegate.send(element)
        val endTime = Clock.System.now()
        
        sink.publish(ChannelSendCompletedEvent(
            channelId = channelId,
            senderId = coroutineId,
            suspended = (endTime - startTime).inWholeMilliseconds > 0,
            timestamp = endTime
        ))
    }
    
    override suspend fun receive(): E {
        val coroutineId = currentCoroutineContext()[InstrumentationContext]?.coroutineId
        
        sink.publish(ChannelReceiveRequestedEvent(
            channelId = channelId,
            receiverId = coroutineId,
            bufferSize = estimateBufferSize(),
            timestamp = Clock.System.now()
        ))
        
        val startTime = Clock.System.now()
        val element = delegate.receive()
        val endTime = Clock.System.now()
        
        sink.publish(ChannelReceiveCompletedEvent(
            channelId = channelId,
            receiverId = coroutineId,
            valuePreview = element.toPreviewString(),
            suspended = (endTime - startTime).inWholeMilliseconds > 0,
            timestamp = endTime
        ))
        
        return element
    }
    
    private fun estimateBufferSize(): Int {
        // Use isEmpty/isFull to estimate
        return when {
            delegate.isClosedForSend -> 0
            else -> -1 // Unknown
        }
    }
}
```

---

## 5. Event Model Design

### 5.1 Event Hierarchy

```kotlin
@Serializable
sealed interface VisualizerEvent {
    val eventId: String
    val timestamp: Instant
    val stepIndex: Long  // Monotonic counter for deterministic replay
    val tags: Map<String, String>
}

// === Coroutine Lifecycle Events ===

@Serializable
sealed interface CoroutineLifecycleEvent : VisualizerEvent {
    val coroutineId: String
}

@Serializable
data class CoroutineCreatedEvent(
    override val eventId: String = ULID.nextULID(),
    override val coroutineId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val parentId: String?,
    val scopeId: String,
    val dispatcherId: String,
    val name: String?,
    override val tags: Map<String, String> = emptyMap()
) : CoroutineLifecycleEvent

@Serializable
data class CoroutineStartedEvent(
    override val eventId: String = ULID.nextULID(),
    override val coroutineId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val threadId: String,
    override val tags: Map<String, String> = emptyMap()
) : CoroutineLifecycleEvent

@Serializable
data class CoroutineSuspendedEvent(
    override val eventId: String = ULID.nextULID(),
    override val coroutineId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val suspensionPoint: SuspensionPoint,
    override val tags: Map<String, String> = emptyMap()
) : CoroutineLifecycleEvent

@Serializable
data class SuspensionPoint(
    val function: String,
    val fileName: String?,
    val lineNumber: Int?,
    val reason: String  // "delay", "withContext", "channel.receive", etc.
)

@Serializable
data class CoroutineResumedEvent(
    override val eventId: String = ULID.nextULID(),
    override val coroutineId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val threadId: String,
    val dispatcherId: String,
    override val tags: Map<String, String> = emptyMap()
) : CoroutineLifecycleEvent

@Serializable
data class CoroutineCompletedEvent(
    override val eventId: String = ULID.nextULID(),
    override val coroutineId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val outcome: Outcome,
    val durationMs: Long,
    override val tags: Map<String, String> = emptyMap()
) : CoroutineLifecycleEvent

@Serializable
sealed interface Outcome {
    @Serializable object Success : Outcome
    @Serializable data class Cancelled(val reason: String?) : Outcome
    @Serializable data class Failed(val exception: String, val message: String?) : Outcome
}

// === Dispatcher Events ===

@Serializable
sealed interface DispatcherEvent : VisualizerEvent {
    val dispatcherId: String
}

@Serializable
data class DispatcherSelectedEvent(
    override val eventId: String = ULID.nextULID(),
    override val dispatcherId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val coroutineId: String?,
    val queueDepth: Int,
    override val tags: Map<String, String> = emptyMap()
) : DispatcherEvent

@Serializable
data class ThreadAssignedEvent(
    override val eventId: String = ULID.nextULID(),
    override val dispatcherId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val coroutineId: String?,
    val threadId: String,
    override val tags: Map<String, String> = emptyMap()
) : DispatcherEvent

// === Flow Events ===

@Serializable
sealed interface FlowEvent : VisualizerEvent {
    val flowId: String
}

@Serializable
data class FlowCollectionStartedEvent(
    override val eventId: String = ULID.nextULID(),
    override val flowId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val collectorId: String,
    val coroutineId: String?,
    override val tags: Map<String, String> = emptyMap()
) : FlowEvent

@Serializable
data class FlowValueEmittedEvent(
    override val eventId: String = ULID.nextULID(),
    override val flowId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val collectorId: String,
    val sequence: Long,
    val valuePreview: String,
    override val tags: Map<String, String> = emptyMap()
) : FlowEvent

// === Channel Events ===

@Serializable
sealed interface ChannelEvent : VisualizerEvent {
    val channelId: String
}

@Serializable
data class ChannelSendRequestedEvent(
    override val eventId: String = ULID.nextULID(),
    override val channelId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val senderId: String?,
    val valuePreview: String,
    val bufferSize: Int,
    override val tags: Map<String, String> = emptyMap()
) : ChannelEvent

@Serializable
data class ChannelReceiveRequestedEvent(
    override val eventId: String = ULID.nextULID(),
    override val channelId: String,
    override val timestamp: Instant,
    override val stepIndex: Long,
    val receiverId: String?,
    val bufferSize: Int,
    override val tags: Map<String, String> = emptyMap()
) : ChannelEvent

// === Exception Events ===

@Serializable
data class ExceptionThrownEvent(
    override val eventId: String = ULID.nextULID(),
    override val timestamp: Instant,
    override val stepIndex: Long,
    val coroutineId: String,
    val exceptionType: String,
    val message: String?,
    val stackTrace: String?,
    override val tags: Map<String, String> = emptyMap()
) : VisualizerEvent

@Serializable
data class ExceptionPropagatedEvent(
    override val eventId: String = ULID.nextULID(),
    override val timestamp: Instant,
    override val stepIndex: Long,
    val fromCoroutineId: String,
    val toCoroutineId: String,
    val exceptionType: String,
    override val tags: Map<String, String> = emptyMap()
) : VisualizerEvent
```

### 5.2 Event Stream Example

**Scenario:** Simple async computation with dispatcher switch

```kotlin
scope.async {
    val result = withContext(Dispatchers.IO) {
        fetchData()
    }
    result
}
```

**Generated Events:**

1. `CoroutineCreatedEvent(id=A, parent=root, dispatcher=Default, name="async")`
2. `CoroutineStartedEvent(id=A, thread="DefaultDispatcher-worker-1")`
3. `CoroutineSuspendedEvent(id=A, suspensionPoint=SuspensionPoint("withContext", ...))`
4. `DispatcherSelectedEvent(coroutineId=A, dispatcherId=IO)`
5. `CoroutineResumedEvent(id=A, thread="IODispatcher-worker-3", dispatcher=IO)`
6. `CoroutineSuspendedEvent(id=A, suspensionPoint=SuspensionPoint("fetchData", ...))`
7. `CoroutineResumedEvent(id=A, thread="IODispatcher-worker-3")`
8. `DispatcherSelectedEvent(coroutineId=A, dispatcherId=Default)`
9. `CoroutineResumedEvent(id=A, thread="DefaultDispatcher-worker-2", dispatcher=Default)`
10. `CoroutineCompletedEvent(id=A, outcome=Success, durationMs=145)`

---

## 6. Ktor Backend Architecture

### 6.1 Application Module

```kotlin
fun Application.visualizerModule() {
    install(ContentNegotiation) {
        json(Json {
            prettyPrint = true
            ignoreUnknownKeys = true
        })
    }
    
    install(WebSockets) {
        pingPeriod = Duration.ofSeconds(15)
        timeout = Duration.ofSeconds(15)
        maxFrameSize = Long.MAX_VALUE
        masking = false
    }
    
    install(CORS) {
        anyHost()
        allowHeader(HttpHeaders.ContentType)
    }
    
    // Dependency injection
    val eventBus = InMemoryEventBus()
    val idRegistry = IdRegistry()
    val timelineStore = TimelineStore(eventBus)
    val projectionService = ProjectionService(eventBus)
    val scenarioRunner = ScenarioRunner(eventBus, idRegistry)
    
    routing {
        visualizerRoutes(eventBus, timelineStore, projectionService, scenarioRunner)
    }
}
```

### 6.2 HTTP Routes

```kotlin
fun Route.visualizerRoutes(
    eventBus: EventBus,
    timelineStore: TimelineStore,
    projectionService: ProjectionService,
    scenarioRunner: ScenarioRunner
) {
    route("/api") {
        // Query events
        get("/events") {
            val sinceStep = call.parameters["sinceStep"]?.toLongOrNull() ?: 0
            val limit = call.parameters["limit"]?.toIntOrNull() ?: 100
            val filter = call.parameters["filter"]?.let { EventFilter.parse(it) }
            
            val events = timelineStore.getEvents(sinceStep, limit, filter)
            call.respond(EventsResponse(
                events = events,
                nextStep = events.lastOrNull()?.stepIndex?.plus(1) ?: sinceStep,
                hasMore = events.size == limit
            ))
        }
        
        // Get coroutine hierarchy
        get("/hierarchy") {
            val scopeId = call.parameters["scopeId"]
            val tree = projectionService.getHierarchyTree(scopeId)
            call.respond(tree)
        }
        
        // Get coroutine timeline
        get("/coroutines/{id}/timeline") {
            val coroutineId = call.parameters["id"]!!
            val events = timelineStore.getCoroutineTimeline(coroutineId)
            call.respond(events)
        }
        
        // Get thread activity
        get("/threads") {
            val threads = projectionService.getThreadActivity()
            call.respond(threads)
        }
        
        // Run teaching scenario
        post("/scenarios/{name}/run") {
            val scenarioName = call.parameters["name"]!!
            val runId = scenarioRunner.runScenario(scenarioName)
            call.respond(mapOf("runId" to runId))
        }
        
        // Get scenario status
        get("/scenarios/{runId}/status") {
            val runId = call.parameters["runId"]!!
            val status = scenarioRunner.getStatus(runId)
            call.respond(status)
        }
    }
    
    // WebSocket for live streaming
    webSocket("/ws/events") {
        val filter = call.parameters["filter"]?.let { EventFilter.parse(it) }
        val subscription = eventBus.subscribe(filter)
        
        try {
            for (event in subscription) {
                send(Json.encodeToString(VisualizerEvent.serializer(), event))
            }
        } finally {
            subscription.cancel()
        }
    }
}
```

### 6.3 Event Bus Implementation

```kotlin
interface EventBus {
    fun publish(event: VisualizerEvent)
    fun subscribe(filter: EventFilter? = null): ReceiveChannel<VisualizerEvent>
}

class InMemoryEventBus : EventBus {
    private val _events = MutableSharedFlow<VisualizerEvent>(
        replay = 1000,
        extraBufferCapacity = 1000,
        onBufferOverflow = BufferOverflow.DROP_OLDEST
    )
    
    private val stepCounter = AtomicLong(0)
    
    override fun publish(event: VisualizerEvent) {
        // Ensure stepIndex is set
        val enrichedEvent = when (event) {
            is CoroutineCreatedEvent -> event.copy(stepIndex = stepCounter.getAndIncrement())
            // ... similar for all event types
            else -> event
        }
        _events.tryEmit(enrichedEvent)
    }
    
    override fun subscribe(filter: EventFilter?): ReceiveChannel<VisualizerEvent> {
        return _events
            .filter { filter?.matches(it) ?: true }
            .produceIn(CoroutineScope(Dispatchers.Default))
    }
}
```

### 6.4 Timeline Store

```kotlin
class TimelineStore(eventBus: EventBus) {
    private val events = ConcurrentLinkedQueue<VisualizerEvent>()
    private val coroutineTimelines = ConcurrentHashMap<String, MutableList<VisualizerEvent>>()
    
    init {
        eventBus.subscribe().consumeEach { event ->
            events.offer(event)
            
            // Index by coroutine
            when (event) {
                is CoroutineLifecycleEvent -> {
                    coroutineTimelines
                        .getOrPut(event.coroutineId) { mutableListOf() }
                        .add(event)
                }
                // ... similar for other event types
            }
        }
    }
    
    fun getEvents(sinceStep: Long, limit: Int, filter: EventFilter?): List<VisualizerEvent> {
        return events
            .asSequence()
            .filter { it.stepIndex >= sinceStep }
            .filter { filter?.matches(it) ?: true }
            .take(limit)
            .toList()
    }
    
    fun getCoroutineTimeline(coroutineId: String): List<VisualizerEvent> {
        return coroutineTimelines[coroutineId] ?: emptyList()
    }
}
```

### 6.5 Projection Service

```kotlin
class ProjectionService(eventBus: EventBus) {
    private val hierarchyIndex = ConcurrentHashMap<String, HierarchyNode>()
    private val threadActivity = ConcurrentHashMap<String, MutableList<ThreadEvent>>()
    
    init {
        eventBus.subscribe().consumeEach { event ->
            when (event) {
                is CoroutineCreatedEvent -> {
                    hierarchyIndex[event.coroutineId] = HierarchyNode(
                        id = event.coroutineId,
                        parentId = event.parentId,
                        name = event.name,
                        createdAt = event.timestamp
                    )
                }
                is ThreadAssignedEvent -> {
                    event.coroutineId?.let { coroutineId ->
                        threadActivity
                            .getOrPut(event.threadId) { mutableListOf() }
                            .add(ThreadEvent(coroutineId, event.timestamp, ThreadEventType.ASSIGNED))
                    }
                }
                // ... more projections
            }
        }
    }
    
    fun getHierarchyTree(scopeId: String?): HierarchyTree {
        val nodes = hierarchyIndex.values
        val filtered = if (scopeId != null) {
            nodes.filter { it.scopeId == scopeId }
        } else {
            nodes
        }
        return HierarchyTree.build(filtered)
    }
    
    fun getThreadActivity(): Map<String, List<ThreadEvent>> {
        return threadActivity.toMap()
    }
}

data class HierarchyNode(
    val id: String,
    val parentId: String?,
    val name: String?,
    val createdAt: Instant,
    val children: MutableList<HierarchyNode> = mutableListOf()
)
```

---

## 7. Integration with Existing Tools

### 7.1 DebugProbes Integration

**Use Case:** Fallback mode for code we don't control

```kotlin
class DebugProbesBridge(private val eventBus: EventBus) {
    private var installed = false
    
    fun install() {
        if (!installed) {
            DebugProbes.install()
            DebugProbes.enableCreationStackTraces = true
            installed = true
        }
    }
    
    fun takeSnapshot(): List<VisualizerEvent> {
        val snapshot = DebugProbes.dumpCoroutinesInfo()
        return snapshot.map { info ->
            CoroutineStateSnapshot(
                coroutineId = info.sequenceNumber.toString(),
                state = info.state,
                context = info.context.toString(),
                stackTrace = info.lastObservedStackTrace().joinToString("\n"),
                timestamp = Clock.System.now(),
                source = "debug-probes"
            )
        }
    }
}
```

**Mode Toggle:**

```kotlin
enum class InstrumentationMode {
    TEACHING,     // Full wrappers, verbose events
    DIAGNOSTICS,  // DebugProbes + thin wrappers
    HYBRID        // Wrappers for user code, DebugProbes for libraries
}
```

### 7.2 OpenTelemetry Integration

**Use Case:** Production-grade distributed tracing

```kotlin
class OTelCoroutineTracer(
    private val tracer: Tracer,
    private val eventBus: EventBus
) {
    fun createTracingContext(coroutineId: String, parentId: String?): CoroutineContext {
        val parentSpan = parentId?.let { spanRegistry[it] }
        val spanContext = parentSpan?.storeToContext(Context.current()) ?: Context.current()
        
        val span = tracer.spanBuilder("coroutine")
            .setParent(spanContext)
            .setAttribute("coroutine.id", coroutineId)
            .startSpan()
        
        spanRegistry[coroutineId] = span
        
        return OTelContext(span)
    }
    
    init {
        eventBus.subscribe().consumeEach { event ->
            when (event) {
                is CoroutineCreatedEvent -> {
                    spanRegistry[event.coroutineId]?.addEvent("created")
                }
                is CoroutineCompletedEvent -> {
                    spanRegistry[event.coroutineId]?.let { span ->
                        span.addEvent("completed")
                        span.end()
                        spanRegistry.remove(event.coroutineId)
                    }
                }
                // ... more mappings
            }
        }
    }
}
```

---

## 8. Teaching Scenarios Library

### 8.1 Scenario Runner

```kotlin
class ScenarioRunner(
    private val eventBus: EventBus,
    private val idRegistry: IdRegistry
) {
    private val scenarios = mapOf(
        "race-condition" to RaceConditionScenario(),
        "starvation" to StarvationScenario(),
        "cancellation" to CancellationScenario(),
        "flow-backpressure" to FlowBackpressureScenario()
    )
    
    fun runScenario(name: String): String {
        val scenario = scenarios[name] ?: throw IllegalArgumentException("Unknown scenario: $name")
        val runId = ULID.nextULID()
        
        val scope = InstrumentedScope(
            delegate = CoroutineScope(Dispatchers.Default + Job()),
            eventSink = eventBus,
            idRegistry = idRegistry
        )
        
        scope.launch {
            scenario.run(this)
        }
        
        return runId
    }
}
```

### 8.2 Example: Race Condition Scenario

```kotlin
class RaceConditionScenario : Scenario {
    override suspend fun run(scope: InstrumentedScope) {
        var counter = 0
        val jobs = List(10) {
            scope.launch(name = "incrementer-$it") {
                repeat(100) {
                    val temp = counter  // Read
                    delay(1)            // Simulate work
                    counter = temp + 1  // Write (race!)
                }
            }
        }
        jobs.joinAll()
        
        // Expected: 1000, Actual: < 1000 (lost updates)
        println("Final counter: $counter")
    }
}
```

**Visualization:** Timeline shows overlapping reads/writes to `counter`, highlighting lost updates in red.

### 8.3 Example: Starvation Scenario

```kotlin
class StarvationScenario : Scenario {
    override suspend fun run(scope: InstrumentedScope) {
        val dispatcher = Dispatchers.Default.limitedParallelism(2)
        
        // Hog the dispatcher with blocking calls
        repeat(2) {
            scope.launch(dispatcher, name = "blocker-$it") {
                Thread.sleep(5000) // Blocking!
            }
        }
        
        delay(100) // Let blockers start
        
        // This coroutine is starved
        scope.launch(dispatcher, name = "starved") {
            println("Finally running!")
        }
    }
}
```

**Visualization:** Dispatcher lanes show "blocker" coroutines occupying all threads, "starved" coroutine stuck in queue.

---

## 9. Frontend Integration Contract

### 9.1 REST API Contract

```typescript
// GET /api/events?sinceStep=0&limit=100&filter=coroutineId:A
interface EventsResponse {
  events: VisualizerEvent[]
  nextStep: number
  hasMore: boolean
}

// GET /api/hierarchy?scopeId=root
interface HierarchyTree {
  root: HierarchyNode
  nodes: Record<string, HierarchyNode>
}

interface HierarchyNode {
  id: string
  parentId: string | null
  name: string | null
  children: string[]  // Child IDs
  state: 'active' | 'completed' | 'cancelled' | 'failed'
}

// GET /api/coroutines/{id}/timeline
interface Timeline {
  coroutineId: string
  events: VisualizerEvent[]
  duration: number
  outcome: Outcome
}
```

### 9.2 WebSocket Protocol

```typescript
// Client → Server
interface SubscribeMessage {
  type: 'subscribe'
  filter?: {
    coroutineId?: string
    scopeId?: string
    eventType?: string[]
  }
}

// Server → Client
interface EventMessage {
  type: 'event'
  data: VisualizerEvent
}

// Usage
const ws = new WebSocket('ws://localhost:8080/ws/events?filter=scopeId:root')
ws.onmessage = (msg) => {
  const event = JSON.parse(msg.data) as VisualizerEvent
  // Update visualization
}
```

### 9.3 Frontend Data Normalization

```typescript
interface NormalizedState {
  coroutines: Record<string, Coroutine>
  timelines: Record<string, VisualizerEvent[]>
  hierarchy: HierarchyTree
  threads: Record<string, ThreadActivity>
}

// Redux/Zustand store
function eventsReducer(state: NormalizedState, event: VisualizerEvent) {
  switch (event.type) {
    case 'CoroutineCreated':
      return {
        ...state,
        coroutines: {
          ...state.coroutines,
          [event.coroutineId]: {
            id: event.coroutineId,
            name: event.name,
            state: 'active',
            parentId: event.parentId
          }
        }
      }
    // ... more cases
  }
}
```

---

## 10. Business Analysis & Go-to-Market

### 10.1 Development Roadmap

**Phase 1: Foundation (8 weeks)**
- Core event model + serialization
- `InstrumentedScope` with `launch`/`async` support
- In-memory event bus
- Basic Ktor HTTP API
- Simple CLI demo

**Deliverables:**
- Working backend that captures coroutine lifecycle
- REST API for querying events
- 3 teaching scenarios (race, cancellation, basic flow)

**Phase 2: Concurrency Primitives (6 weeks)**
- Dispatcher instrumentation
- Flow wrappers
- Channel wrappers
- Timeline projections
- WebSocket streaming

**Deliverables:**
- Full coroutine primitive coverage
- Real-time event streaming
- 5 more scenarios (starvation, deadlock, etc.)

**Phase 3: Visualization & Polish (6 weeks)**
- React frontend skeleton (timeline, hierarchy, thread lanes)
- Scenario replay controls (play/pause/step)
- DebugProbes integration
- Documentation site

**Deliverables:**
- Interactive web UI
- Onboarding tutorial
- API documentation

**Phase 4: Production Features (6 weeks)**
- OpenTelemetry export
- Event persistence (SQLite/PostgreSQL)
- Performance optimizations
- Multi-scenario comparison

**Deliverables:**
- Production-ready backend
- Performance benchmarks
- Integration guides

### 10.2 Resource Requirements

| Role | Duration | FTE | Cost (USD) |
|------|----------|-----|------------|
| Senior Kotlin Engineer | 20 weeks | 1.0 | $60,000 |
| Frontend Engineer (React/TS) | 12 weeks | 0.75 | $27,000 |
| DevRel/Educator | 8 weeks | 0.5 | $12,000 |
| **Total** | | | **$99,000** |

### 10.3 Pricing Model

**Open Source Foundation:**
- Core framework: MIT license
- Teaching scenarios: Community-contributed

**Premium Tiers:**
1. **Individual (Free)**: Web UI, 10 scenarios, community support
2. **Team ($49/month)**: Scenario sharing, team collaboration, priority support
3. **Enterprise ($499/month)**: On-premise deployment, custom scenarios, SSO, SLA

### 10.4 Success Metrics

**Adoption Metrics:**
- GitHub stars: 1,000+ in 6 months
- Monthly active users: 5,000+ in year 1
- Training partners: 3+ institutions

**Engagement Metrics:**
- Average session duration: 15+ minutes
- Scenario completions: 80%+ finish rate
- Community scenarios: 20+ contributed

**Business Metrics:**
- Paid conversions: 5% of active users
- Enterprise deals: 2+ in year 1
- Conference talks/workshops: 10+ in year 1

---

## 11. Risk Analysis & Mitigation

### 11.1 Technical Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Performance overhead** | High | Medium | Opt-in instrumentation; sampling mode; profiling |
| **API incompatibility** with new coroutines versions | High | Medium | Pin to stable releases; automated compatibility tests |
| **Incomplete coverage** of primitives | Medium | High | Prioritize common scenarios; document limitations |
| **Event volume overwhelming frontend** | Medium | Medium | Server-side filtering; pagination; aggregation |

### 11.2 Business Risks

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| **Low adoption** | High | Medium | Partnership with training providers; conference demos |
| **Competing tools emerge** | Medium | Low | Focus on teaching use case; community engagement |
| **Maintenance burden** | Medium | High | Clear contribution guidelines; automated testing |

### 11.3 Compliance & Legal

- **License**: MIT for core framework ensures broad adoption
- **Privacy**: Events contain only synthetic data; no PII
- **Security**: WebSocket authentication; rate limiting; input validation

---

## 12. Conclusion & Recommendations

### 12.1 Key Takeaways

1. **Non-invasive wrappers** enable visualization without forking `kotlinx-coroutines`
2. **Event sourcing** provides time-travel debugging and replay capabilities
3. **Ktor backend** offers clean HTTP/WebSocket APIs for frontend integration
4. **Dual-mode operation** serves both teaching and production diagnostics use cases
5. **Community-driven scenarios** create network effects for adoption

### 12.2 Recommended Approach

**Start with Option A (Decorator-First) because:**
- Provides highest fidelity for teaching scenarios
- Works across JVM, Android, and potentially Native
- Deterministic event ordering enables reliable animations
- Extensible to custom visualizations

**Supplement with Option B (DebugProbes Bridge) for:**
- Third-party code we don't control
- Quick diagnostics without instrumentation
- Cross-validation of wrapper correctness

### 12.3 Next Steps

1. **Week 1-2**: Build core event model + `InstrumentedScope` prototype
2. **Week 3-4**: Implement Ktor API + in-memory event bus
3. **Week 5-6**: Create 3 teaching scenarios + basic CLI demo
4. **Week 7-8**: Onboard 5 beta testers; gather feedback
5. **Week 9+**: Iterate based on feedback; plan Phase 2

### 12.4 Open Questions for Stakeholders

1. Should we prioritize Native/JS support in Phase 1, or focus on JVM?
2. What is the preferred hosting model (SaaS vs self-hosted)?
3. Are there existing training materials we can integrate with?
4. What level of DebugProbes integration is needed for MVP?

---

## Appendix A: Code Repository Structure

```
kotlinx-coroutines-visualizer/
├── backend/                          # Ktor backend
│   ├── src/main/kotlin/
│   │   ├── api/                      # HTTP routes
│   │   ├── domain/
│   │   │   ├── events/               # Event model
│   │   │   ├── wrappers/             # Instrumented wrappers
│   │   │   └── scenarios/            # Teaching scenarios
│   │   ├── infrastructure/
│   │   │   ├── EventBus.kt
│   │   │   ├── TimelineStore.kt
│   │   │   └── ProjectionService.kt
│   │   └── Application.kt
│   └── build.gradle.kts
├── frontend/                          # React + TypeScript UI
│   ├── src/
│   │   ├── components/
│   │   │   ├── HierarchyTree.tsx
│   │   │   ├── Timeline.tsx
│   │   │   └── ThreadLanes.tsx
│   │   ├── stores/
│   │   │   └── eventsStore.ts
│   │   └── App.tsx
│   └── package.json
├── scenarios/                         # Community scenarios
│   ├── race-condition.kt
│   ├── starvation.kt
│   └── cancellation.kt
├── docs/
│   ├── architecture.md
│   ├── api-reference.md
│   └── contributing.md
└── README.md
```

---

## Appendix B: Glossary

| Term | Definition |
|------|------------|
| **Decorator Pattern** | Wraps an object to add behavior without modifying it |
| **Event Sourcing** | Storing state changes as immutable events |
| **Structured Concurrency** | Parent-child coroutine relationships enforce cancellation propagation |
| **Suspension Point** | Location where a coroutine pauses execution |
| **DebugProbes** | JVM agent for coroutine debugging in `kotlinx-coroutines-debug` |
| **ULID** | Universally Unique Lexicographically Sortable Identifier |

---

**Document End**

*For questions or contributions, contact: [project maintainers]*

